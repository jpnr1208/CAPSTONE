import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password, make_password
from django.core import signing
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from rest_framework import generics, permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.audit.utils import log_action

from .models import PasswordResetCode, Role
from .permissions import RolePermission
from .serializers import (
    AdminUserSerializer, ChangePasswordSerializer, InsiderTokenSerializer,
    PasswordResetConfirmSerializer, PasswordResetRequestSerializer,
    PasswordResetVerifySerializer, RoleSerializer, UserProfileSerializer,
)

User = get_user_model()
RESET_SALT = "insider.password-reset"


class LoginView(TokenObtainPairView):
    """CU001 - Iniciar sesión (JWT + perfil)."""

    serializer_class = InsiderTokenSerializer

    def post(self, request, *args, **kwargs):
        email = str(request.data.get("email", "")).strip().lower()
        try:
            response = super().post(request, *args, **kwargs)
        except Exception:
            log_action(request, "auth.login_failed", {"email": email})
            raise
        if response.status_code == 200:
            user = User.objects.filter(email=email).first()
            log_action(request, "auth.login", {"email": email}, user=user)
        else:
            log_action(request, "auth.login_failed", {"email": email})
        return response


class LogoutView(APIView):
    def post(self, request):
        try:
            RefreshToken(request.data.get("refresh")).blacklist()
        except (TokenError, TypeError):
            pass
        log_action(request, "auth.logout")
        return Response(status=status.HTTP_205_RESET_CONTENT)


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    http_method_names = ["get", "patch"]

    def get_object(self):
        return self.request.user

    def perform_update(self, serializer):
        serializer.save()
        log_action(self.request, "account.profile_updated", {"fields": list(self.request.data.keys())})


class ChangePasswordView(APIView):
    def post(self, request):
        ser = ChangePasswordSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        request.user.set_password(ser.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        log_action(request, "account.password_changed")
        return Response({"detail": "Contraseña actualizada correctamente."})


class _ResetThrottleMixin:
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"


class PasswordResetRequestView(_ResetThrottleMixin, APIView):
    """Pantalla /recuperar-password: envía un código de 6 dígitos."""

    def post(self, request):
        ser = PasswordResetRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        email = ser.validated_data["email"].lower()
        payload = {"detail": "Si el correo está registrado, recibirás un código de verificación."}
        user = User.objects.filter(email=email, is_active=True).first()
        if user:
            code = f"{secrets.randbelow(10**6):06d}"
            with transaction.atomic():
                user.reset_codes.filter(used_at__isnull=True).update(used_at=timezone.now())
                PasswordResetCode.objects.create(
                    user=user,
                    code_hash=make_password(code),
                    expires_at=timezone.now() + timedelta(minutes=settings.PASSWORD_RESET_CODE_MINUTES),
                )
            send_mail(
                "INSIDER Duoc UC - Código de verificación",
                f"Tu código de verificación es {code}. Expira en "
                f"{settings.PASSWORD_RESET_CODE_MINUTES} minutos.",
                settings.DEFAULT_FROM_EMAIL,
                [email],
                fail_silently=True,
            )
            log_action(request, "auth.password_reset_requested", user=user)
            if settings.DEBUG:
                payload["debug_code"] = code  # solo en desarrollo
        return Response(payload)


class PasswordResetVerifyView(_ResetThrottleMixin, APIView):
    """Pantalla /codigo-verificacion: valida el código y entrega un token firmado."""

    def post(self, request):
        ser = PasswordResetVerifySerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        email = ser.validated_data["email"].lower()
        reset = PasswordResetCode.objects.filter(user__email=email, used_at__isnull=True).first()
        if not reset or not reset.is_valid:
            return Response({"detail": "El código expiró o no es válido."}, status=400)
        if not check_password(ser.validated_data["code"], reset.code_hash):
            reset.attempts += 1
            reset.save(update_fields=["attempts"])
            return Response({"detail": "Código incorrecto."}, status=400)
        token = signing.dumps({"rid": reset.id, "uid": reset.user_id}, salt=RESET_SALT)
        return Response({"reset_token": token})


class PasswordResetConfirmView(_ResetThrottleMixin, APIView):
    """Pantalla /nueva-password: establece la nueva contraseña."""

    def post(self, request):
        ser = PasswordResetConfirmSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            data = signing.loads(
                ser.validated_data["reset_token"], salt=RESET_SALT,
                max_age=settings.PASSWORD_RESET_CODE_MINUTES * 60,
            )
        except signing.BadSignature:
            return Response({"detail": "El enlace de restablecimiento no es válido o expiró."}, status=400)
        reset = PasswordResetCode.objects.filter(id=data["rid"], user_id=data["uid"]).select_related("user").first()
        if not reset or not reset.is_valid:
            return Response({"detail": "El código ya fue utilizado."}, status=400)
        from django.contrib.auth.password_validation import validate_password

        validate_password(ser.validated_data["new_password"], reset.user)
        reset.user.set_password(ser.validated_data["new_password"])
        reset.user.save(update_fields=["password"])
        reset.used_at = timezone.now()
        reset.save(update_fields=["used_at"])
        log_action(request, "auth.password_reset_completed", user=reset.user)
        return Response({"detail": "Contraseña restablecida. Ya puedes iniciar sesión."})


class UserAdminViewSet(viewsets.ModelViewSet):
    """Administrador TI - gestión de usuarios."""

    queryset = User.objects.select_related("role").all()
    serializer_class = AdminUserSerializer
    permission_classes = [RolePermission("users.manage")]
    filterset_fields = ("role__name", "status", "campus", "is_active")
    search_fields = ("email", "first_name", "last_name", "rut")
    ordering_fields = ("email", "created_at", "last_login")

    def perform_create(self, serializer):
        user = serializer.save()
        log_action(self.request, "admin.user_created", {"user_id": user.id, "email": user.email})

    def perform_update(self, serializer):
        user = serializer.save()
        changed = [k for k in self.request.data.keys() if k != "password"]
        log_action(self.request, "admin.user_updated", {"user_id": user.id, "fields": changed})

    def perform_destroy(self, instance):
        # Baja lógica: se preserva la trazabilidad de casos.
        instance.is_active = False
        instance.status = User.Status.INACTIVO
        instance.save(update_fields=["is_active", "status"])
        log_action(self.request, "admin.user_deactivated", {"user_id": instance.id})


class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [RolePermission("roles.manage")]
    pagination_class = None

    def perform_update(self, serializer):
        role = serializer.save()
        log_action(self.request, "admin.role_updated", {"role": role.name})

    def perform_create(self, serializer):
        role = serializer.save()
        log_action(self.request, "admin.role_created", {"role": role.name})

    def destroy(self, request, *args, **kwargs):
        role = self.get_object()
        if role.users.exists():
            return Response({"detail": "No se puede eliminar un rol con usuarios asignados."}, status=400)
        log_action(request, "admin.role_deleted", {"role": role.name})
        return super().destroy(request, *args, **kwargs)
