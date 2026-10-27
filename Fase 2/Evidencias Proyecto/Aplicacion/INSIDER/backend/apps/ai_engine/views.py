from rest_framework import permissions, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import RolePermission
from apps.audit.utils import log_action

from . import services
from .knowledge import CATALOG, CLAIM_CATEGORIES, FAQ, REQUEST_TYPES
from .models import AIRule
from .serializers import AIRuleSerializer, SuggestInputSerializer


class SuggestView(APIView):
    """Sugerencias IA en vivo para el formulario de solicitudes."""

    def post(self, request):
        ser = SuggestInputSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        return Response(services.suggest(ser.validated_data["description"],
                                         ser.validated_data.get("service") or None,
                                         user=request.user))


class FAQSearchView(APIView):
    """Buscador inteligente de la pantalla /ayuda."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        q = request.query_params.get("q", "").strip()
        if not q:
            return Response({"results": [{"question": f["q"], "answer": f["a"]} for f in FAQ]})
        return Response({"results": services.search_faq(q, limit=6)})


class CatalogView(APIView):
    """Catálogo para formularios dinámicos."""

    def get(self, request):
        return Response({
            "categories": [{"code": k, "label": v["label"], "services": v["services"]} for k, v in CATALOG.items()],
            "request_types": REQUEST_TYPES,
            "claim_categories": CLAIM_CATEGORIES,
        })


class AIRuleViewSet(viewsets.ModelViewSet):
    queryset = AIRule.objects.all()
    serializer_class = AIRuleSerializer
    permission_classes = [RolePermission("rules.manage")]
    filterset_fields = ("is_active", "service_type")
    search_fields = ("trigger_keyword", "service_type", "auto_response_template")

    def perform_create(self, serializer):
        rule = serializer.save()
        log_action(self.request, "rules.created", {"rule_id": rule.id, "keyword": rule.trigger_keyword})

    def perform_update(self, serializer):
        rule = serializer.save()
        log_action(self.request, "rules.updated", {"rule_id": rule.id})

    def perform_destroy(self, instance):
        log_action(self.request, "rules.deleted", {"rule_id": instance.id, "keyword": instance.trigger_keyword})
        instance.delete()
