"""CU005 - Dashboards analíticos por perfil."""
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Avg, Count, DurationField, ExpressionWrapper, F, Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts import roles
from apps.ai_engine.knowledge import CATALOG
from apps.audit.models import AuditLog
from apps.audit.serializers import AuditLogSerializer
from apps.cases.models import OPEN_STATUSES, Claim, Complaint, Compliment, Financing
from apps.cases.models import Request as CaseRequest
from apps.cases.serializers import RequestSerializer

User = get_user_model()


def by(qs, field):
    return [{"key": r[field] or "—", "total": r["total"]} for r in qs.values(field).annotate(total=Count("id")).order_by("-total")]


def monthly(qs, months=6):
    since = timezone.now() - timedelta(days=31 * months)
    rows = (qs.filter(created_at__gte=since).annotate(m=TruncMonth("created_at"))
            .values("m").annotate(total=Count("id")).order_by("m"))
    return [{"month": r["m"].strftime("%Y-%m"), "total": r["total"]} for r in rows]


def sla_stats(qs):
    closed = qs.filter(closed_at__isnull=False)
    dur = ExpressionWrapper(F("closed_at") - F("created_at"), output_field=DurationField())
    avg = closed.annotate(d=dur).aggregate(a=Avg("d"))["a"]
    limit = timedelta(hours=settings.SLA_HOURS)
    within = closed.annotate(d=dur).filter(d__lte=limit).count()
    total_closed = closed.count()
    now = timezone.now()
    open_breached = qs.filter(closed_at__isnull=True, created_at__lt=now - limit).count()
    return {
        "sla_hours": settings.SLA_HOURS,
        "avg_resolution_hours": round(avg.total_seconds() / 3600, 1) if avg else None,
        "compliance_pct": round(100 * within / total_closed, 1) if total_closed else None,
        "closed": total_closed,
        "open_breached": open_breached,
    }


def case_block(qs, extra_group=None):
    data = {
        "total": qs.count(),
        "open": qs.filter(status__in=OPEN_STATUSES + ["RECIBIDA", "EN_INVESTIGACION", "EN_DICTAMEN"]).count(),
        "by_status": by(qs, "status"),
        "monthly": monthly(qs),
        "sla": sla_stats(qs),
    }
    if extra_group:
        data[f"by_{extra_group}"] = by(qs, extra_group)
    return data


class DashboardView(APIView):
    def get(self, request):
        u = request.user
        role = u.role_name or (roles.DIRECCION if u.is_superuser else None)
        payload = {"role": role, "generated_at": timezone.now()}

        if role == roles.ESTUDIANTE:
            reqs = CaseRequest.objects.filter(user=u)
            fin = Financing.objects.filter(user=u)
            payload.update({
                "requests": case_block(reqs, "category"),
                "claims": Claim.objects.filter(user=u).count(),
                "complaints": Complaint.objects.filter(complainant=u).count(),
                "compliments": Compliment.objects.filter(sender=u).count(),
                "financing": {
                    "pending": fin.exclude(status="PAGADO").aggregate(t=Sum("amount"))["t"] or 0,
                    "paid": fin.filter(status="PAGADO").aggregate(t=Sum("amount"))["t"] or 0,
                    "overdue": fin.filter(status="VENCIDO").count(),
                },
            })
        elif role == roles.COORDINADOR:
            reqs = CaseRequest.objects.all()
            payload.update({
                "requests": case_block(reqs, "category"),
                "by_priority": by(reqs.filter(status__in=OPEN_STATUSES), "priority"),
                "by_service": by(reqs, "service")[:8],
                "claims": case_block(Claim.objects.all(), "category"),
                "assigned_to_me": reqs.filter(assigned_to=u, status__in=OPEN_STATUSES).count(),
            })
        elif role == roles.ABOGADO:
            comp = Complaint.objects.all()
            payload.update({
                "complaints": case_block(comp),
                "anonymous_pct": round(100 * comp.filter(is_anonymous=True).count() / comp.count(), 1) if comp.exists() else 0,
                "upcoming_meetings": list(
                    comp.filter(meetings__scheduled_at__gte=timezone.now())
                    .values("folio", "meetings__scheduled_at", "meetings__location")
                    .order_by("meetings__scheduled_at")[:5]
                ),
            })
        elif role == roles.DIRECCION:
            payload.update({
                "requests": case_block(CaseRequest.objects.all(), "category"),
                "claims": case_block(Claim.objects.all(), "category"),
                "complaints": {  # Solo agregados: sin detalle confidencial
                    "total": Complaint.objects.count(),
                    "by_status": by(Complaint.objects.all(), "status"),
                    "monthly": monthly(Complaint.objects.all()),
                },
                "compliments": {"total": Compliment.objects.count(),
                                "top_staff": by(Compliment.objects.all(), "staff_name")[:5]},
                "by_campus": [{"key": r["user__campus"] or "—", "total": r["total"]} for r in
                              CaseRequest.objects.values("user__campus").annotate(total=Count("id")).order_by("-total")],
                "users": User.objects.filter(is_active=True).count(),
            })
        elif role == roles.ADMIN_TI:
            since = timezone.now() - timedelta(days=7)
            payload.update({
                "users_by_role": by(User.objects.all(), "role__label"),
                "users_by_status": by(User.objects.all(), "status"),
                "failed_logins_7d": AuditLog.objects.filter(action="auth.login_failed", timestamp__gte=since).count(),
                "logins_7d": AuditLog.objects.filter(action="auth.login", timestamp__gte=since).count(),
                "actions_7d": by(AuditLog.objects.filter(timestamp__gte=since), "action")[:10],
                "recent_logs": AuditLogSerializer(AuditLog.objects.select_related("user")[:10], many=True).data,
            })
        elif role == roles.FINANZAS:
            fin = Financing.objects.all()
            payload.update({
                "financing": {
                    "total": fin.aggregate(t=Sum("amount"))["t"] or 0,
                    "by_status": [{"key": r["status"], "total": r["n"], "amount": r["t"]} for r in
                                  fin.values("status").annotate(n=Count("id"), t=Sum("amount")).order_by("status")],
                    "by_period": [{"key": r["payment_period"], "amount": r["t"], "paid": r["p"]} for r in
                                  fin.values("payment_period").annotate(
                                      t=Sum("amount"), p=Count("id", filter=Q(status="PAGADO"))
                                  ).order_by("payment_period")],
                    "debtors": fin.filter(status="VENCIDO").values("user").distinct().count(),
                },
            })
        return Response(payload)


class HomeView(APIView):
    """Resumen para /inicio: 'Hola Usuario, tienes X solicitudes en proceso'."""

    def get(self, request):
        u = request.user
        if u.has_role_perm("requests.manage", "requests.view_all"):
            base = CaseRequest.objects.all()
        else:
            base = CaseRequest.objects.filter(user=u)
        in_process = base.filter(status__in=OPEN_STATUSES).count()
        recent = base.select_related("user", "user__role")[:5]
        pending_payments = Financing.objects.filter(user=u).exclude(status="PAGADO").count()
        return Response({
            "name": u.first_name or u.email.split("@")[0],
            "role": u.role_name,
            "in_process": in_process,
            "pending_payments": pending_payments,
            "recent": RequestSerializer(recent, many=True, context={"request": request}).data,
            "categories": [{"code": k, "label": v["label"]} for k, v in CATALOG.items()],
        })
