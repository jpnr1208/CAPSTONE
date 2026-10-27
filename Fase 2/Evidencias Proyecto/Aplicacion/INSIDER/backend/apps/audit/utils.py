import logging

from .models import AuditLog

logger = logging.getLogger("insider.audit")


def get_client_ip(request):
    if request is None:
        return None
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def log_action(request, action, details=None, user=None, anonymous=False):
    """Registra una acción en la bitácora.

    anonymous=True evita guardar usuario e IP (denuncias anónimas).
    """
    try:
        if anonymous:
            actor, ip = None, None
        else:
            actor = user or (request.user if request and request.user.is_authenticated else None)
            ip = get_client_ip(request)
        return AuditLog.objects.create(user=actor, action=action, ip_address=ip, details=details or {})
    except Exception:  # la auditoría nunca debe romper el flujo principal
        logger.exception("No se pudo registrar la auditoría: %s", action)
        return None
