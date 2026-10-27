from django.contrib import admin

from .models import AIRule


@admin.register(AIRule)
class AIRuleAdmin(admin.ModelAdmin):
    list_display = ("trigger_keyword", "service_type", "is_active", "updated_at")
    list_filter = ("is_active", "service_type")
    search_fields = ("trigger_keyword", "auto_response_template")
