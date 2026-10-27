from django.conf import settings
from django.utils import timezone
from rest_framework import serializers

from apps.ai_engine.knowledge import CATALOG, CLAIM_CATEGORIES, REQUEST_TYPES

from .models import (
    CaseStatus, Claim, Complaint, Compliment, Financing, LegalMeeting, StatusHistory,
)
from .models import Request as CaseRequest

MAX_UPLOAD_MB = 10


def validate_upload(f):
    if f and f.size > MAX_UPLOAD_MB * 1024 * 1024:
        raise serializers.ValidationError(f"El archivo supera el máximo de {MAX_UPLOAD_MB} MB.")
    return f


def download_url(kind, obj, field):
    return f"/api/v1/{kind}/{obj.pk}/download/" if getattr(obj, field) else None


class SLAMixin(serializers.Serializer):
    hours_open = serializers.SerializerMethodField()
    sla_breached = serializers.SerializerMethodField()

    def get_hours_open(self, obj):
        end = obj.closed_at or timezone.now()
        return round((end - obj.created_at).total_seconds() / 3600, 1)

    def get_sla_breached(self, obj):
        return self.get_hours_open(obj) > settings.SLA_HOURS


class StatusHistorySerializer(serializers.ModelSerializer):
    changed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = StatusHistory
        fields = ("id", "from_status", "to_status", "comment", "changed_by_name", "created_at")

    def get_changed_by_name(self, obj):
        if not obj.changed_by:
            return "Sistema INSIDER"
        role = obj.changed_by.role.label if obj.changed_by.role else ""
        return f"{obj.changed_by.get_full_name() or obj.changed_by.email}" + (f" ({role})" if role else "")


# ---------------------------------------------------------------- Solicitudes
class RequestSerializer(SLAMixin, serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    user_name = serializers.SerializerMethodField()
    user_email = serializers.EmailField(source="user.email", read_only=True)
    attachment_url = serializers.SerializerMethodField()
    category_label = serializers.SerializerMethodField()

    class Meta:
        model = CaseRequest
        fields = (
            "id", "folio", "user", "user_name", "user_email", "category", "category_label", "service",
            "request_type", "description", "status", "status_label", "priority", "attachment_url",
            "ai_category", "ai_suggestion", "resolution", "cancel_reason", "assigned_to",
            "closed_at", "created_at", "updated_at", "hours_open", "sla_breached",
        )
        read_only_fields = fields

    def get_user_name(self, obj):
        return obj.user.get_full_name() or obj.user.email

    def get_attachment_url(self, obj):
        return download_url("requests", obj, "attached_file")

    def get_category_label(self, obj):
        return CATALOG.get(obj.category, {}).get("label", obj.category)


class RequestWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = CaseRequest
        fields = ("category", "service", "request_type", "description", "attached_file")

    def validate_attached_file(self, f):
        return validate_upload(f)

    def validate_description(self, v):
        if len(v.strip()) < 20:
            raise serializers.ValidationError("Describe tu solicitud con al menos 20 caracteres.")
        return v.strip()

    def validate(self, attrs):
        category = attrs.get("category", getattr(self.instance, "category", None))
        service = attrs.get("service", getattr(self.instance, "service", None))
        rtype = attrs.get("request_type", getattr(self.instance, "request_type", "Solicitud"))
        if category not in CATALOG:
            raise serializers.ValidationError({"category": "Categoría no válida."})
        if service not in CATALOG[category]["services"]:
            raise serializers.ValidationError({"service": "El servicio no pertenece a la categoría."})
        if rtype not in REQUEST_TYPES:
            raise serializers.ValidationError({"request_type": "Tipo de solicitud no válido."})
        return attrs


class ReasonSerializer(serializers.Serializer):
    reason = serializers.CharField(min_length=10, max_length=2000,
                                   error_messages={"min_length": "Indica un motivo de al menos 10 caracteres."})


class StatusChangeSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[CaseStatus.EN_REVISION, CaseStatus.EN_PROCESO, CaseStatus.RESUELTA])
    comment = serializers.CharField(required=False, allow_blank=True, max_length=4000)


class CloseSerializer(serializers.Serializer):
    resolution = serializers.CharField(min_length=15, max_length=8000,
                                       error_messages={"min_length": "El dictamen debe tener al menos 15 caracteres."})


# ---------------------------------------------------------------- Denuncias
class ComplaintCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Complaint
        fields = ("target_name", "description", "evidence_file", "is_anonymous")

    def validate_evidence_file(self, f):
        return validate_upload(f)

    def validate_description(self, v):
        if len(v.strip()) < 30:
            raise serializers.ValidationError("Describe los hechos con al menos 30 caracteres.")
        return v.strip()


class ComplaintSerializer(serializers.ModelSerializer):
    """Vista del denunciante (sin notas legales)."""

    status_label = serializers.CharField(source="get_status_display", read_only=True)
    has_evidence = serializers.SerializerMethodField()

    class Meta:
        model = Complaint
        fields = ("id", "folio", "target_name", "description", "is_anonymous", "status", "status_label",
                  "resolution", "cancel_reason", "has_evidence", "created_at", "closed_at")
        read_only_fields = fields

    def get_has_evidence(self, obj):
        return bool(obj.evidence_file)


class ComplaintLegalSerializer(SLAMixin, ComplaintSerializer):
    """Vista del Área Legal."""

    complainant_name = serializers.SerializerMethodField()
    complainant_email = serializers.SerializerMethodField()
    evidence_url = serializers.SerializerMethodField()
    meetings_count = serializers.IntegerField(source="meetings.count", read_only=True)

    class Meta(ComplaintSerializer.Meta):
        fields = ComplaintSerializer.Meta.fields + (
            "complainant_name", "complainant_email", "legal_notes", "evidence_url", "meetings_count",
            "hours_open", "sla_breached",
        )
        read_only_fields = tuple(f for f in fields if f != "legal_notes")

    def get_complainant_name(self, obj):
        if obj.is_anonymous or not obj.complainant:
            return "Anónimo"
        return obj.complainant.get_full_name() or obj.complainant.email

    def get_complainant_email(self, obj):
        return None if obj.is_anonymous or not obj.complainant else obj.complainant.email

    def get_evidence_url(self, obj):
        return download_url("complaints", obj, "evidence_file")


class ComplaintTrackSerializer(serializers.Serializer):
    folio = serializers.CharField()
    tracking_code = serializers.CharField()


class LegalMeetingSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)

    class Meta:
        model = LegalMeeting
        fields = ("id", "complaint", "scheduled_at", "location", "participants", "notes",
                  "created_by_name", "created_at")
        read_only_fields = ("complaint", "created_by_name", "created_at")


class ComplaintStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["EN_INVESTIGACION", "EN_DICTAMEN"])
    comment = serializers.CharField(required=False, allow_blank=True)
    is_public = serializers.BooleanField(default=True)


# ---------------------------------------------------------------- Reclamos
class ClaimSerializer(SLAMixin, serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    user_name = serializers.SerializerMethodField()
    attachment_url = serializers.SerializerMethodField()

    class Meta:
        model = Claim
        fields = ("id", "folio", "user_name", "category", "description", "is_anonymous", "status",
                  "status_label", "attachment_url", "resolution", "cancel_reason", "created_at",
                  "closed_at", "hours_open", "sla_breached")
        read_only_fields = fields

    def get_user_name(self, obj):
        request = self.context.get("request")
        is_owner = request and obj.user_id == request.user.id
        if obj.is_anonymous and not is_owner:
            return "Reservado (anónimo)"
        return (obj.user.get_full_name() or obj.user.email) if obj.user else "—"

    def get_attachment_url(self, obj):
        return download_url("claims", obj, "attached_file")


class ClaimWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Claim
        fields = ("category", "description", "attached_file", "is_anonymous")

    def validate_attached_file(self, f):
        return validate_upload(f)

    def validate_category(self, v):
        if v not in CLAIM_CATEGORIES:
            raise serializers.ValidationError("Categoría no válida.")
        return v

    def validate_description(self, v):
        if len(v.strip()) < 20:
            raise serializers.ValidationError("Describe tu reclamo con al menos 20 caracteres.")
        return v.strip()


# ---------------------------------------------------------------- Felicitaciones
class ComplimentSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()

    class Meta:
        model = Compliment
        fields = ("id", "sender_name", "staff_name", "staff_role", "message", "created_at")
        read_only_fields = ("id", "sender_name", "created_at")

    def get_sender_name(self, obj):
        return obj.sender.get_full_name() or obj.sender.email

    def validate_message(self, v):
        if len(v.strip()) < 10:
            raise serializers.ValidationError("El mensaje debe tener al menos 10 caracteres.")
        return v.strip()


# ---------------------------------------------------------------- Financiamiento
class FinancingSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    student_name = serializers.SerializerMethodField()
    student_email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = Financing
        fields = ("id", "user", "student_name", "student_email", "payment_period", "concept", "installment",
                  "amount", "status", "status_label", "due_date", "paid_at", "transaction_id")
        read_only_fields = ("paid_at", "transaction_id")

    def get_student_name(self, obj):
        return obj.user.get_full_name() or obj.user.email
