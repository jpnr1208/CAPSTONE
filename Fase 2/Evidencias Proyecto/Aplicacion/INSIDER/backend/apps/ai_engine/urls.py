from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("ai/rules", views.AIRuleViewSet, basename="ai-rule")

urlpatterns = [
    path("ai/suggest/", views.SuggestView.as_view(), name="ai-suggest"),
    path("help/faq/", views.FAQSearchView.as_view(), name="faq"),
    path("catalog/", views.CatalogView.as_view(), name="catalog"),
] + router.urls
