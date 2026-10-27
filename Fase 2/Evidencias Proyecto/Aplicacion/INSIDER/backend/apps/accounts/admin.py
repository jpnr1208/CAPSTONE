from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import CustomUser, PasswordResetCode, Role


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("name", "label")


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display = ("email", "first_name", "last_name", "role", "campus", "status", "is_active")
    list_filter = ("role", "status", "campus")
    search_fields = ("email", "first_name", "last_name", "rut")
    ordering = ("email",)
    fieldsets = UserAdmin.fieldsets + (
        ("INSIDER", {"fields": ("rut", "career", "campus", "role", "status")}),
    )


@admin.register(PasswordResetCode)
class PasswordResetCodeAdmin(admin.ModelAdmin):
    list_display = ("user", "created_at", "expires_at", "used_at", "attempts")
    readonly_fields = ("code_hash",)
