from django.contrib import admin

from .models import Claim, Complaint, Compliment, Financing, LegalMeeting, Request, StatusHistory


@admin.register(Request)
class RequestAdmin(admin.ModelAdmin):
    list_display = ("folio", "user", "category", "service", "status", "priority", "created_at")
    list_filter = ("status", "category", "priority")
    search_fields = ("folio", "user__email", "description")


@admin.register(Complaint)
class ComplaintAdmin(admin.ModelAdmin):
    list_display = ("folio", "target_name", "is_anonymous", "status", "created_at")
    list_filter = ("status", "is_anonymous")
    exclude = ("tracking_code_hash",)


@admin.register(Claim)
class ClaimAdmin(admin.ModelAdmin):
    list_display = ("folio", "category", "status", "is_anonymous", "created_at")
    list_filter = ("status", "category")


@admin.register(Compliment)
class ComplimentAdmin(admin.ModelAdmin):
    list_display = ("staff_name", "sender", "created_at")


@admin.register(Financing)
class FinancingAdmin(admin.ModelAdmin):
    list_display = ("user", "payment_period", "concept", "amount", "status", "due_date")
    list_filter = ("status", "payment_period")


admin.site.register(StatusHistory)
admin.site.register(LegalMeeting)
admin.site.site_header = "INSIDER · Duoc UC"
admin.site.site_title = "INSIDER Admin"
