"""Lógica de negocio compartida por los casos."""
import logging

from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.conf import settings

from .models import StatusHistory

logger = logging.getLogger("insider.cases")

CASE_TYPE = {"Request": "REQUEST", "Complaint": "COMPLAINT", "Claim": "CLAIM"}


def record_status(obj, to_status, user=None, comment="", from_status="", is_public=True):
    return StatusHistory.objects.create(
        case_type=CASE_TYPE[obj.__class__.__name__],
        case_id=obj.pk,
        from_status=from_status,
        to_status=to_status,
        comment=comment,
        changed_by=user,
        is_public=is_public,
    )


def transition(obj, to_status, user, comment="", **extra):
    previous = obj.status
    obj.status = to_status
    for k, v in extra.items():
        setattr(obj, k, v)
    obj.save()
    record_status(obj, to_status, user=user, comment=comment, from_status=previous)
    return obj


def timeline_for(obj, include_private=False):
    qs = StatusHistory.objects.filter(case_type=CASE_TYPE[obj.__class__.__name__], case_id=obj.pk)
    if not include_private:
        qs = qs.filter(is_public=True)
    return qs.select_related("changed_by")


def notify_role(role_name, subject, message):
    User = get_user_model()
    recipients = list(User.objects.filter(role__name=role_name, is_active=True).values_list("email", flat=True))
    if not recipients:
        return 0
    try:
        return send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, recipients, fail_silently=False)
    except Exception:
        logger.exception("Fallo al notificar al rol %s", role_name)
        return 0


def notify_user(user, subject, message):
    if not user or not user.email:
        return 0
    try:
        return send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=True)
    except Exception:
        return 0
