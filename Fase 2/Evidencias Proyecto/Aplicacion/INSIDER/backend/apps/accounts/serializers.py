from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Role

User = get_user_model()


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ("id", "name", "label", "permissions_json")


class UserProfileSerializer(serializers.ModelSerializer):
    role = serializers.CharField(source="role_name", read_only=True)
    role_label = serializers.SerializerMethodField()
    permissions = serializers.ListField(read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id", "email", "first_name", "last_name", "full_name", "rut", "career",
            "campus", "role", "role_label", "permissions", "status", "created_at", "last_login",
        )
        read_only_fields = ("id", "email", "rut", "career", "campus", "status", "created_at", "last_login")

    def get_role_label(self, obj):
        return obj.role.label if obj.role else None

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.email


class AdminUserSerializer(serializers.ModelSerializer):
    """Gestión de usuarios por Administrador TI."""

    role = serializers.SlugRelatedField(slug_field="name", queryset=Role.objects.all(), allow_null=True)
    password = serializers.CharField(write_only=True, required=False, min_length=8)

    class Meta:
        model = User
        fields = (
            "id", "email", "first_name", "last_name", "rut", "career", "campus",
            "role", "status", "is_active", "created_at", "last_login", "password",
        )
        read_only_fields = ("id", "created_at", "last_login")

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        user = User(**validated_data)
        user.username = validated_data["email"]
        if password:
            validate_password(password, user)
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for k, v in validated_data.items():
            setattr(instance, k, v)
        if password:
            validate_password(password, instance)
            instance.set_password(password)
        instance.save()
        return instance


class InsiderTokenSerializer(TokenObtainPairSerializer):
    """CU001: retorna tokens JWT + perfil con rol."""

    default_error_messages = {"no_active_account": "Credenciales inválidas o cuenta inactiva."}

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role_name
        token["name"] = user.get_full_name()
        return token

    def validate(self, attrs):
        attrs[self.username_field] = attrs.get(self.username_field, "").strip().lower()
        data = super().validate(attrs)
        if self.user.status != User.Status.ACTIVO:
            raise serializers.ValidationError({"detail": "Tu cuenta no está activa. Contacta a Soporte TI."})
        data["user"] = UserProfileSerializer(self.user).data
        return data


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField()
    new_password = serializers.CharField(min_length=8)

    def validate(self, attrs):
        user = self.context["request"].user
        if not user.check_password(attrs["current_password"]):
            raise serializers.ValidationError({"current_password": "La contraseña actual no es correcta."})
        validate_password(attrs["new_password"], user)
        return attrs


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetVerifySerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.RegexField(r"^\d{6}$", error_messages={"invalid": "El código debe tener 6 dígitos."})


class PasswordResetConfirmSerializer(serializers.Serializer):
    reset_token = serializers.CharField()
    new_password = serializers.CharField(min_length=8)
