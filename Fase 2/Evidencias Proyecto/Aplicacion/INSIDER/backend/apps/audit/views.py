import django_filters
from rest_framework import viewsets

from apps.accounts.permissions import RolePermission

from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogFilter(django_filters.FilterSet):
    date_from = django_filters.DateFilter(field_name="timestamp", lookup_expr="date__gte")
    date_to = django_filters.DateFilter(field_name="timestamp", lookup_expr="date__lte")
    action = django_filters.CharFilter(lookup_expr="icontains")

    class Meta:
        model = AuditLog
        fields = ("user", "action")


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.select_related("user")
    serializer_class = AuditLogSerializer
    permission_classes = [RolePermission("audit.view")]
    filterset_class = AuditLogFilter
    search_fields = ("action", "user__email", "ip_address")
    ordering_fields = ("timestamp", "action")
