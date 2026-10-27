from django.urls import path

from .views import DashboardView, HomeView

urlpatterns = [
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("dashboard/home/", HomeView.as_view(), name="home"),
]
