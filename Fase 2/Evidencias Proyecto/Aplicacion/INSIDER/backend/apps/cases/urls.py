from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("requests", views.RequestViewSet, basename="request")
router.register("complaints", views.ComplaintViewSet, basename="complaint")
router.register("claims", views.ClaimViewSet, basename="claim")
router.register("compliments", views.ComplimentViewSet, basename="compliment")
router.register("financing", views.FinancingViewSet, basename="financing")
urlpatterns = router.urls
