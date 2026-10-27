import os
import secrets

import django_filters
from django.contrib.auth.hashers import check_password, make_password
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.http import FileResponse
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from apps.accounts import roles
from apps.ai_engine.services import apply_automation, classify, draft_response
from apps.audit.utils import log_action

from .models import (
    OPEN_STATUSES, CaseStatus, Claim, Complaint, ComplaintStatus, Compliment, Financing, Priority,
)
from .models import Request as CaseRequest
from .serializers import (
    ClaimSerializer, ClaimWriteSerializer, CloseSerializer, ComplaintCreateSerializer,
    ComplaintLegalSerializer, ComplaintSerializer, ComplaintStatusSerializer, ComplaintTrackSerializer,
    ComplimentSerializer, FinancingSerializer, LegalMeetingSerializer, ReasonSerializer,
    RequestSerializer, RequestWriteSerializer, StatusChangeSerializer, StatusHistorySerializer,
)
from .services import notify_role, notify_user, record_status, timeline_for, transition

FINAL_STATUSES = {CaseStatus.CERRADA, CaseStatus.ANULADA, ComplaintStatus.CERRADA, ComplaintStatus.ANULADA}


def require(user, *perms):
    if not user.has_role_perm(*perms):
        raise PermissionDenied("No tienes permisos para realizar esta acción.")


class CSVInFilter(django_filters.BaseInFilter, django_filters.CharFilter):
    """Permite ?status=PENDIENTE,EN_REVISION"""


class BaseCaseFilter(django_filters.FilterSet):
    status = CSVInFilter(field_name="status", lookup_expr="in")
    date_from = django_filters.DateFilter(field_name="created_at", lookup_expr="date__gte")
    date_to = django_filters.DateFilter(field_name="created_at", lookup_expr="date__lte")
    folio = django_filters.CharFilter(lookup_expr="icontains")


class RequestFilter(BaseCaseFilter):
    priority = CSVInFilter(field_name="priority", lookup_expr="in")
    campus = django_filters.CharFilter(field_name="user__campus", lookup_expr="icontains")

    class Meta:
        model = CaseRequest
        fields = ("category", "service", "request_type", "assigned_to")


class ComplaintFilter(BaseCaseFilter):
    class Meta:
        model = Complaint
        fields = ("is_anonymous",)


class ClaimFilter(BaseCaseFilter):
    class Meta:
        model = Claim
        fields = ("category", "is_anonymous")


class CaseActionsMixin:
    """Acciones comunes: timeline (CU007) y descarga protegida de adjuntos."""

    file_field = "attached_file"
    manage_perms = ()

    def _is_staff(self):
        return self.request.user.has_role_perm(*self.manage_perms)

    @action(detail=True, methods=["get"])
    def timeline(self, request, pk=None):
        obj = self.get_object()
        events = timeline_for(obj, include_private=self._is_staff())
        return Response({
            "folio": obj.folio,
            "current_status": obj.status,
            "events": StatusHistorySerializer(events, many=True).data,
        })

    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        obj = self.get_object()
        f = getattr(obj, self.file_field)
        if not f:
            return Response({"detail": "El caso no tiene archivo adjunto."}, status=404)
        log_action(request, "file.download", {"folio": obj.folio})
        return FileResponse(f.open("rb"), as_attachment=True, filename=os.path.basename(f.name))


# =============================================================== Solicitudes
class RequestViewSet(CaseActionsMixin, viewsets.ModelViewSet):
    """CU002, CU006, CU007, CU010, CU011, CU012."""

    filterset_class = RequestFilter
    search_fields = ("folio", "description", "service", "user__email", "user__first_name",
                     "user__last_name", "user__rut")
    ordering_fields = ("created_at", "updated_at", "priority", "status")
    http_method_names = ["get", "post", "put", "patch", "head", "options"]
    manage_perms = ("requests.manage",)

    def get_queryset(self):
        qs = CaseRequest.objects.select_related("user", "user__role", "assigned_to")
        if self.request.user.has_role_perm("requests.manage", "requests.view_all"):
            return qs
        return qs.filter(user=self.request.user)

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return RequestWriteSerializer
        return RequestSerializer

    def create(self, request, *args, **kwargs):
        require(request.user, "requests.create")
        ser = RequestWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        with transaction.atomic():
            obj = CaseRequest(user=request.user, **ser.validated_data)
            auto = apply_automation(obj)
            obj.save()
            record_status(obj, CaseStatus.PENDIENTE, user=request.user, comment="Solicitud registrada.")
            if auto:
                record_status(obj, CaseStatus.PENDIENTE, comment=f"Respuesta automática: {auto}",
                              from_status=CaseStatus.PENDIENTE)
        if obj.priority == Priority.ALTA:
            notify_role(roles.COORDINADOR, f"[INSIDER] Solicitud prioritaria {obj.folio}",
                        f"Se registró la solicitud {obj.folio} ({obj.service}) con prioridad ALTA.")
        log_action(request, "request.created", {"folio": obj.folio, "priority": obj.priority})
        data = RequestSerializer(obj, context={"request": request}).data
        data["ai_analysis"] = classify(obj.description, obj.service)
        return Response(data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        """CU006 - Modificar solicitud (solo propietario y en estado Pendiente)."""
        partial = kwargs.pop("partial", False)
        obj = self.get_object()
        if obj.user_id != request.user.id:
            raise PermissionDenied("Solo el autor puede modificar la solicitud.")
        if obj.status != CaseStatus.PENDIENTE:
            raise ValidationError({"detail": "Solo se pueden modificar solicitudes en estado Pendiente."})
        ser = RequestWriteSerializer(obj, data=request.data, partial=partial)
        ser.is_valid(raise_exception=True)
        with transaction.atomic():
            obj = ser.save()
            obj.priority = ""
            apply_automation(obj)
            obj.save()
            record_status(obj, obj.status, user=request.user, comment="Solicitud modificada por el estudiante.",
                          from_status=obj.status)
        log_action(request, "request.updated", {"folio": obj.folio, "fields": list(request.data.keys())})
        return Response(RequestSerializer(obj, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        """CU010 - Anulamiento preventivo por el estudiante."""
        obj = self.get_object()
        if obj.user_id != request.user.id:
            raise PermissionDenied("Solo el autor puede anular la solicitud.")
        if obj.status not in (CaseStatus.PENDIENTE, CaseStatus.EN_REVISION):
            raise ValidationError({"detail": "La solicitud ya no puede anularse en su estado actual."})
        ser = ReasonSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        transition(obj, CaseStatus.ANULADA, request.user, comment=f"Anulada por el estudiante: {ser.validated_data['reason']}",
                   cancel_reason=ser.validated_data["reason"], closed_at=timezone.now())
        log_action(request, "request.cancelled", {"folio": obj.folio})
        return Response(RequestSerializer(obj, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="change-status")
    def change_status(self, request, pk=None):
        require(request.user, "requests.manage")
        obj = self.get_object()
        if obj.status in FINAL_STATUSES:
            raise ValidationError({"detail": "El caso ya está finalizado."})
        ser = StatusChangeSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        extra = {"assigned_to": obj.assigned_to or request.user}
        transition(obj, ser.validated_data["status"], request.user, ser.validated_data.get("comment", ""), **extra)
        notify_user(obj.user, f"[INSIDER] Tu solicitud {obj.folio} cambió de estado",
                    f"Nuevo estado: {obj.get_status_display()}.\n{ser.validated_data.get('comment', '')}")
        log_action(request, "request.status_changed", {"folio": obj.folio, "status": obj.status})
        return Response(RequestSerializer(obj, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        """CU012 - Cierre formal con dictamen."""
        require(request.user, "requests.manage")
        obj = self.get_object()
        if obj.status in FINAL_STATUSES:
            raise ValidationError({"detail": "El caso ya está finalizado."})
        ser = CloseSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        transition(obj, CaseStatus.CERRADA, request.user, comment=ser.validated_data["resolution"],
                   resolution=ser.validated_data["resolution"], closed_at=timezone.now(),
                   assigned_to=obj.assigned_to or request.user)
        notify_user(obj.user, f"[INSIDER] Solicitud {obj.folio} cerrada",
                    f"Resolución:\n{obj.resolution}")
        log_action(request, "request.closed", {"folio": obj.folio})
        return Response(RequestSerializer(obj, context={"request": request}).data)

    @action(detail=True, methods=["get"], url_path="ai-suggestion")
    def ai_suggestion(self, request, pk=None):
        require(request.user, "ai.suggest", "requests.manage")
        obj = self.get_object()
        log_action(request, "ai.draft_generated", {"folio": obj.folio})
        return Response(draft_response(obj))


# =============================================================== Denuncias
class ComplaintViewSet(CaseActionsMixin, viewsets.ModelViewSet):
    """CU003, CU008, CU012 + agenda legal."""

    filterset_class = ComplaintFilter
    search_fields = ("folio", "target_name", "description")
    ordering_fields = ("created_at", "status")
    http_method_names = ["get", "post", "patch", "head", "options"]
    file_field = "evidence_file"
    manage_perms = ("complaints.manage",)
    throttle_scope = None

    def get_queryset(self):
        qs = Complaint.objects.select_related("complainant").prefetch_related("meetings")
        if self._is_staff():
            return qs
        return qs.filter(complainant=self.request.user)

    def get_serializer_class(self):
        if self.action == "create":
            return ComplaintCreateSerializer
        return ComplaintLegalSerializer if self._is_staff() else ComplaintSerializer

    def create(self, request, *args, **kwargs):
        require(request.user, "complaints.create")
        ser = ComplaintCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        anonymous = ser.validated_data.get("is_anonymous", False)
        tracking_code = secrets.token_hex(4).upper() if anonymous else None
        with transaction.atomic():
            obj = Complaint(**ser.validated_data)
            obj.complainant = None if anonymous else request.user
            obj.tracking_code_hash = make_password(tracking_code) if anonymous else ""
            obj.save()
            record_status(obj, ComplaintStatus.RECIBIDA, user=None if anonymous else request.user,
                          comment="Denuncia recibida por el canal confidencial.")
        notify_role(roles.ABOGADO, f"[INSIDER] Nueva denuncia {obj.folio}",
                    f"Se ha recibido la denuncia {obj.folio} "
                    f"({'anónima' if anonymous else 'confidencial'}). Ingrese a INSIDER para gestionarla.")
        log_action(request, "complaint.created", {"folio": obj.folio, "anonymous": anonymous}, anonymous=anonymous)
        data = ComplaintSerializer(obj).data
        if anonymous:
            data["tracking_code"] = tracking_code
            data["notice"] = "Guarda el folio y código de seguimiento: no podremos recuperarlos."
        return Response(data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        """Solo el Área Legal puede actualizar notas legales."""
        require(request.user, "complaints.manage")
        obj = self.get_object()
        obj.legal_notes = request.data.get("legal_notes", obj.legal_notes)
        obj.save(update_fields=["legal_notes", "updated_at"])
        log_action(request, "complaint.notes_updated", {"folio": obj.folio})
        return Response(ComplaintLegalSerializer(obj).data)

    def update(self, request, *args, **kwargs):
        return self.partial_update(request, *args, **kwargs)

    def _cancel(self, request, obj, reason, anonymous=False):
        if obj.status in FINAL_STATUSES:
            raise ValidationError({"detail": "La denuncia ya está finalizada."})
        actor = None if anonymous else request.user
        transition(obj, ComplaintStatus.ANULADA, actor, comment=f"Anulación fundamentada: {reason}",
                   cancel_reason=reason, closed_at=timezone.now())
        notify_role(roles.ABOGADO, f"[INSIDER] Denuncia {obj.folio} anulada", f"Motivo: {reason}")
        log_action(request, "complaint.cancelled", {"folio": obj.folio}, anonymous=anonymous)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        """CU008 - Anulamiento de denuncia (denunciante o Área Legal)."""
        obj = self.get_object()
        ser = ReasonSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        self._cancel(request, obj, ser.validated_data["reason"])
        return Response(self.get_serializer(obj).data)

    def _find_tracked(self, data):
        ser = ComplaintTrackSerializer(data=data)
        ser.is_valid(raise_exception=True)
        obj = Complaint.objects.filter(folio=ser.validated_data["folio"].strip().upper(), is_anonymous=True).first()
        if not obj or not check_password(ser.validated_data["tracking_code"].strip().upper(), obj.tracking_code_hash):
            raise ValidationError({"detail": "Folio o código de seguimiento incorrecto."})
        return obj

    @action(detail=False, methods=["post"], throttle_classes=[ScopedRateThrottle],
            throttle_scope="password_reset")
    def track(self, request):
        """Seguimiento de denuncias anónimas mediante folio + código."""
        obj = self._find_tracked(request.data)
        return Response({
            "complaint": ComplaintSerializer(obj).data,
            "events": StatusHistorySerializer(timeline_for(obj), many=True).data,
        })

    @action(detail=False, methods=["post"], url_path="track/cancel", throttle_classes=[ScopedRateThrottle],
            throttle_scope="password_reset")
    def track_cancel(self, request):
        obj = self._find_tracked(request.data)
        ser = ReasonSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        self._cancel(request, obj, ser.validated_data["reason"], anonymous=True)
        return Response(ComplaintSerializer(obj).data)

    @action(detail=True, methods=["post"], url_path="change-status")
    def change_status(self, request, pk=None):
        require(request.user, "complaints.manage")
        obj = self.get_object()
        if obj.status in FINAL_STATUSES:
            raise ValidationError({"detail": "La denuncia ya está finalizada."})
        ser = ComplaintStatusSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        previous = obj.status
        obj.status = ser.validated_data["status"]
        obj.save(update_fields=["status", "updated_at"])
        record_status(obj, obj.status, user=request.user, comment=ser.validated_data.get("comment", ""),
                      from_status=previous, is_public=ser.validated_data["is_public"])
        log_action(request, "complaint.status_changed", {"folio": obj.folio, "status": obj.status})
        return Response(ComplaintLegalSerializer(obj).data)

    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        """CU012 - Cierre con dictamen legal."""
        require(request.user, "complaints.manage")
        obj = self.get_object()
        if obj.status in FINAL_STATUSES:
            raise ValidationError({"detail": "La denuncia ya está finalizada."})
        ser = CloseSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        transition(obj, ComplaintStatus.CERRADA, request.user, comment="Caso cerrado con dictamen.",
                   resolution=ser.validated_data["resolution"], closed_at=timezone.now())
        notify_user(obj.complainant, f"[INSIDER] Denuncia {obj.folio} cerrada",
                    "Tu denuncia fue cerrada con dictamen. Revisa el detalle en INSIDER.")
        log_action(request, "complaint.closed", {"folio": obj.folio})
        return Response(ComplaintLegalSerializer(obj).data)

    @action(detail=True, methods=["get", "post"])
    def meetings(self, request, pk=None):
        require(request.user, "meetings.manage")
        obj = self.get_object()
        if request.method == "POST":
            ser = LegalMeetingSerializer(data=request.data)
            ser.is_valid(raise_exception=True)
            meeting = ser.save(complaint=obj, created_by=request.user)
            record_status(obj, obj.status, user=request.user, from_status=obj.status, is_public=False,
                          comment=f"Reunión agendada para {meeting.scheduled_at:%d-%m-%Y %H:%M}.")
            log_action(request, "complaint.meeting_scheduled", {"folio": obj.folio, "meeting_id": meeting.id})
            return Response(LegalMeetingSerializer(meeting).data, status=201)
        return Response(LegalMeetingSerializer(obj.meetings.all(), many=True).data)


# =============================================================== Reclamos
class ClaimViewSet(CaseActionsMixin, viewsets.ModelViewSet):
    """CU009 + gestión por coordinación."""

    filterset_class = ClaimFilter
    search_fields = ("folio", "description", "category")
    ordering_fields = ("created_at", "status")
    http_method_names = ["get", "post", "head", "options"]
    manage_perms = ("claims.manage",)

    def get_queryset(self):
        qs = Claim.objects.select_related("user")
        if self.request.user.has_role_perm("claims.manage", "claims.view_all"):
            return qs
        return qs.filter(user=self.request.user)

    def get_serializer_class(self):
        return ClaimWriteSerializer if self.action == "create" else ClaimSerializer

    def create(self, request, *args, **kwargs):
        require(request.user, "claims.create")
        ser = ClaimWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        with transaction.atomic():
            obj = Claim.objects.create(user=request.user, **ser.validated_data)
            record_status(obj, CaseStatus.PENDIENTE, user=request.user, comment="Reclamo registrado.")
        log_action(request, "claim.created", {"folio": obj.folio})
        return Response(ClaimSerializer(obj, context={"request": request}).data, status=201)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        obj = self.get_object()
        if obj.user_id != request.user.id:
            raise PermissionDenied("Solo el autor puede anular el reclamo.")
        if obj.status not in (CaseStatus.PENDIENTE, CaseStatus.EN_REVISION):
            raise ValidationError({"detail": "El reclamo ya no puede anularse."})
        ser = ReasonSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        transition(obj, CaseStatus.ANULADA, request.user, comment=ser.validated_data["reason"],
                   cancel_reason=ser.validated_data["reason"], closed_at=timezone.now())
        log_action(request, "claim.cancelled", {"folio": obj.folio})
        return Response(ClaimSerializer(obj, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="change-status")
    def change_status(self, request, pk=None):
        require(request.user, "claims.manage")
        obj = self.get_object()
        if obj.status in FINAL_STATUSES:
            raise ValidationError({"detail": "El reclamo ya está finalizado."})
        ser = StatusChangeSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        transition(obj, ser.validated_data["status"], request.user, ser.validated_data.get("comment", ""))
        notify_user(obj.user, f"[INSIDER] Reclamo {obj.folio}", f"Nuevo estado: {obj.get_status_display()}")
        log_action(request, "claim.status_changed", {"folio": obj.folio, "status": obj.status})
        return Response(ClaimSerializer(obj, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        require(request.user, "claims.manage")
        obj = self.get_object()
        if obj.status in FINAL_STATUSES:
            raise ValidationError({"detail": "El reclamo ya está finalizado."})
        ser = CloseSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        transition(obj, CaseStatus.CERRADA, request.user, comment=ser.validated_data["resolution"],
                   resolution=ser.validated_data["resolution"], closed_at=timezone.now())
        notify_user(obj.user, f"[INSIDER] Reclamo {obj.folio} cerrado", obj.resolution)
        log_action(request, "claim.closed", {"folio": obj.folio})
        return Response(ClaimSerializer(obj, context={"request": request}).data)

    @action(detail=True, methods=["get"], url_path="ai-suggestion")
    def ai_suggestion(self, request, pk=None):
        require(request.user, "ai.suggest", "claims.manage")
        return Response(draft_response(self.get_object()))


# =============================================================== Felicitaciones
class ComplimentViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin,
                        viewsets.GenericViewSet):
    """CU004 - Registro de felicitaciones."""

    serializer_class = ComplimentSerializer
    search_fields = ("staff_name", "staff_role", "message")
    ordering_fields = ("created_at", "staff_name")

    def get_queryset(self):
        qs = Compliment.objects.select_related("sender")
        if self.request.user.has_role_perm("compliments.view"):
            return qs
        return qs.filter(sender=self.request.user)

    def perform_create(self, serializer):
        require(self.request.user, "compliments.create")
        obj = serializer.save(sender=self.request.user)
        log_action(self.request, "compliment.created", {"id": obj.id, "staff": obj.staff_name})

    @action(detail=False, methods=["get"])
    def ranking(self, request):
        require(request.user, "compliments.view")
        data = (Compliment.objects.values("staff_name").annotate(total=Count("id")).order_by("-total")[:10])
        return Response(list(data))


# =============================================================== Financiamiento
class FinancingFilter(django_filters.FilterSet):
    status = CSVInFilter(field_name="status", lookup_expr="in")
    period_from = django_filters.CharFilter(field_name="payment_period", lookup_expr="gte")
    period_to = django_filters.CharFilter(field_name="payment_period", lookup_expr="lte")

    class Meta:
        model = Financing
        fields = ("user", "payment_period", "concept")


class FinancingViewSet(viewsets.ModelViewSet):
    serializer_class = FinancingSerializer
    filterset_class = FinancingFilter
    search_fields = ("user__email", "user__rut", "user__first_name", "user__last_name", "concept")
    ordering_fields = ("due_date", "amount", "status")

    def _is_finance(self):
        return self.request.user.has_role_perm("financing.manage")

    def get_queryset(self):
        Financing.objects.filter(status=Financing.Status.PENDIENTE, due_date__lt=timezone.localdate()) \
            .update(status=Financing.Status.VENCIDO)
        qs = Financing.objects.select_related("user")
        if self._is_finance():
            return qs
        require(self.request.user, "financing.view_own")
        return qs.filter(user=self.request.user)

    def _guard_write(self):
        require(self.request.user, "financing.manage")

    def perform_create(self, serializer):
        self._guard_write()
        obj = serializer.save()
        log_action(self.request, "financing.created", {"id": obj.id})

    def perform_update(self, serializer):
        self._guard_write()
        obj = serializer.save()
        log_action(self.request, "financing.updated", {"id": obj.id, "status": obj.status})

    def perform_destroy(self, instance):
        self._guard_write()
        log_action(self.request, "financing.deleted", {"id": instance.id})
        instance.delete()

    @action(detail=True, methods=["post"])
    def pay(self, request, pk=None):
        """Simulación de pago (pasarela de prueba)."""
        obj = self.get_object()
        if obj.user_id != request.user.id and not self._is_finance():
            raise PermissionDenied()
        if obj.status == Financing.Status.PAGADO:
            raise ValidationError({"detail": "Esta cuota ya fue pagada."})
        obj.status = Financing.Status.PAGADO
        obj.paid_at = timezone.now()
        obj.transaction_id = f"SIM-{secrets.token_hex(5).upper()}"
        obj.save(update_fields=["status", "paid_at", "transaction_id"])
        log_action(request, "financing.paid", {"id": obj.id, "tx": obj.transaction_id, "amount": str(obj.amount)})
        return Response(FinancingSerializer(obj).data)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        qs = self.filter_queryset(self.get_queryset())
        agg = lambda s: qs.filter(status=s).aggregate(t=Sum("amount"), n=Count("id"))  # noqa: E731
        paid, pending, overdue = agg("PAGADO"), agg("PENDIENTE"), agg("VENCIDO")
        nxt = qs.filter(status__in=["PENDIENTE", "VENCIDO"]).order_by("due_date").first()
        return Response({
            "total": qs.aggregate(t=Sum("amount"))["t"] or 0,
            "paid": {"amount": paid["t"] or 0, "count": paid["n"]},
            "pending": {"amount": pending["t"] or 0, "count": pending["n"]},
            "overdue": {"amount": overdue["t"] or 0, "count": overdue["n"]},
            "next_due": FinancingSerializer(nxt).data if nxt else None,
        })
