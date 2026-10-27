from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

router = DefaultRouter()
router.register("admin/users", views.UserAdminViewSet, basename="admin-user")
router.register("admin/roles", views.RoleViewSet, basename="admin-role")

urlpatterns = [
    path("auth/login/", views.LoginView.as_view(), name="login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("auth/logout/", views.LogoutView.as_view(), name="logout"),
    path("auth/me/", views.MeView.as_view(), name="me"),
    path("auth/change-password/", views.ChangePasswordView.as_view(), name="change-password"),
    path("auth/password-reset/request/", views.PasswordResetRequestView.as_view(), name="pwd-reset-request"),
    path("auth/password-reset/verify/", views.PasswordResetVerifyView.as_view(), name="pwd-reset-verify"),
    path("auth/password-reset/confirm/", views.PasswordResetConfirmView.as_view(), name="pwd-reset-confirm"),
] + router.urls
