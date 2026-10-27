import os
import secrets
import uuid

from django.conf import settings
from django.core.validators import FileExtensionValidator
from django.db import IntegrityError, models, transaction
from django.utils import timezone

ALLOWED_EXT = ["pdf", "jpg", "jpeg", "png", "doc", "docx", "xlsx", "mp3", "mp4", "txt"]
file_validator = FileExtensionValidator(allowed_extensions=ALLOWED_EXT)


def _upload_path(folder, filename):
    ext = os.path.splitext(filename)[1].lower()
    return f"{folder}/{timezone.now():%Y/%m}/{uuid.uuid4().hex}{ext}"


# Funciones a nivel de módulo (serializables por las migraciones).
def request_upload(instance, filename):
    return _upload_path("requests", filename)


def complaint_upload(instance, filename):
    return _upload_path("complaints", filename)


def claim_upload(instance, filename):
    return _upload_path("claims", filename)


class CaseStatus(models.TextChoices):
    PENDIENTE = "PENDIENTE", "Pendiente"
    EN_REVISION = "EN_REVISION", "En revisión"
    EN_PROCESO = "EN_PROCESO", "En proceso"
    RESUELTA = "RESUELTA", "Resuelta"
    CERRADA = "CERRADA", "Cerrada"
    ANULADA = "ANULADA", "Anulada"


class ComplaintStatus(models.TextChoices):
    RECIBIDA = "RECIBIDA", "Recibida"
    EN_INVESTIGACION = "EN_INVESTIGACION", "En investigación"
    EN_DICTAMEN = "EN_DICTAMEN", "En dictamen"
    CERRADA = "CERRADA", "Cerrada"
    ANULADA = "ANULADA", "Anulada"


class Priority(models.TextChoices):
    BAJA = "BAJA", "Baja"
    MEDIA = "MEDIA", "Media"
    ALTA = "ALTA", "Alta"


OPEN_STATUSES = [CaseStatus.PENDIENTE, CaseStatus.EN_REVISION, CaseStatus.EN_PROCESO]


class FolioMixin(models.Model):
    FOLIO_PREFIX = "CAS"
    folio = models.CharField(max_length=30, unique=True, editable=False)

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if self.folio:
            return super().save(*args, **kwargs)
        for _ in range(5):
            self.folio = f"{self.FOLIO_PREFIX}-{timezone.now():%Y%m}-{secrets.token_hex(3).upper()}"
            try:
                with transaction.atomic():
                    return super().save(*args, **kwargs)
            except IntegrityError:
                self.pk = None
                continue
        raise IntegrityError("No fue posible generar un folio único.")


class Request(FolioMixin):
    FOLIO_PREFIX = "SOL"
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="requests")
    category = models.CharField(max_length=30, db_index=True)
    service = models.CharField(max_length=120)
    request_type = models.CharField(max_length=30, default="Solicitud")
    description = models.TextField()
    status = models.CharField(max_length=15, choices=CaseStatus.choices, default=CaseStatus.PENDIENTE, db_index=True)
    attached_file = models.FileField(upload_to=request_upload, blank=True, null=True, validators=[file_validator])
    priority = models.CharField(max_length=10, choices=Priority.choices, blank=True, db_index=True)
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name="assigned_requests")
    ai_category = models.CharField(max_length=30, blank=True)
    ai_suggestion = models.TextField(blank=True)
    resolution = models.TextField("dictamen / resolución", blank=True)
    cancel_reason = models.TextField(blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "solicitud"
        verbose_name_plural = "solicitudes"

    def __str__(self):
        return f"{self.folio} - {self.service}"


class Complaint(FolioMixin):
    FOLIO_PREFIX = "DEN"
    complainant = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name="complaints")
    target_name = models.CharField("persona o área denunciada", max_length=200)
    description = models.TextField()
    evidence_file = models.FileField(upload_to=complaint_upload, blank=True, null=True, validators=[file_validator])
    is_anonymous = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=ComplaintStatus.choices, default=ComplaintStatus.RECIBIDA,
                              db_index=True)
    legal_notes = models.TextField(blank=True)
    tracking_code_hash = models.CharField(max_length=128, blank=True)
    resolution = models.TextField("dictamen", blank=True)
    cancel_reason = models.TextField(blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "denuncia"
        verbose_name_plural = "denuncias"

    def __str__(self):
        return self.folio


class Claim(FolioMixin):
    FOLIO_PREFIX = "REC"
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
                             related_name="claims")
    category = models.CharField(max_length=60, db_index=True)
    description = models.TextField()
    attached_file = models.FileField(upload_to=claim_upload, blank=True, null=True, validators=[file_validator])
    is_anonymous = models.BooleanField(default=False)
    status = models.CharField(max_length=15, choices=CaseStatus.choices, default=CaseStatus.PENDIENTE, db_index=True)
    resolution = models.TextField(blank=True)
    cancel_reason = models.TextField(blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "reclamo"
        verbose_name_plural = "reclamos"

    def __str__(self):
        return self.folio


class Compliment(models.Model):
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="compliments")
    staff_name = models.CharField(max_length=150)
    staff_role = models.CharField(max_length=80, blank=True)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "felicitación"
        verbose_name_plural = "felicitaciones"


class Financing(models.Model):
    class Status(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Pendiente"
        PAGADO = "PAGADO", "Pagado"
        VENCIDO = "VENCIDO", "Vencido"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="financing")
    payment_period = models.CharField("periodo (AAAA-MM)", max_length=7, db_index=True)
    concept = models.CharField(max_length=120, default="Mensualidad")
    installment = models.PositiveSmallIntegerField(default=1)
    amount = models.DecimalField(max_digits=12, decimal_places=0)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDIENTE, db_index=True)
    due_date = models.DateField()
    paid_at = models.DateTimeField(null=True, blank=True)
    transaction_id = models.CharField(max_length=40, blank=True)

    class Meta:
        ordering = ["due_date"]
        unique_together = ("user", "payment_period", "concept")
        verbose_name = "financiamiento"
        verbose_name_plural = "financiamiento"


class StatusHistory(models.Model):
    """Timeline de estados (CU007) común para los tres tipos de caso."""

    class CaseType(models.TextChoices):
        REQUEST = "REQUEST", "Solicitud"
        COMPLAINT = "COMPLAINT", "Denuncia"
        CLAIM = "CLAIM", "Reclamo"

    case_type = models.CharField(max_length=10, choices=CaseType.choices)
    case_id = models.PositiveBigIntegerField()
    from_status = models.CharField(max_length=20, blank=True)
    to_status = models.CharField(max_length=20)
    comment = models.TextField(blank=True)
    is_public = models.BooleanField(default=True)
    changed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [models.Index(fields=["case_type", "case_id"])]


class LegalMeeting(models.Model):
    """Agenda de reuniones del Área Legal asociada a una denuncia."""

    complaint = models.ForeignKey(Complaint, on_delete=models.CASCADE, related_name="meetings")
    scheduled_at = models.DateTimeField()
    location = models.CharField(max_length=150, blank=True)
    participants = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["scheduled_at"]
