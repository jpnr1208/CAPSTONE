from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


def health(_request):
    return JsonResponse({"status": "ok", "service": "INSIDER API", "version": "v1"})


api_v1 = [
    path("health/", health, name="health"),
    path("", include("apps.accounts.urls")),
    path("", include("apps.cases.urls")),
    path("", include("apps.ai_engine.urls")),
    path("", include("apps.audit.urls")),
    path("", include("apps.dashboard.urls")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include(api_v1)),
]
# Nota: los archivos adjuntos NO se sirven públicamente desde /media/.
# Se descargan vía endpoints protegidos (/api/v1/<recurso>/<id>/download/)
# que validan RBAC, preservando la confidencialidad de evidencias.
