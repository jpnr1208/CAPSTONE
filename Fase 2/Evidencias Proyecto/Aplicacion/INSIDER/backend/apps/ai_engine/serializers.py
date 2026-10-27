from rest_framework import serializers

from .models import AIRule


class AIRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIRule
        fields = ("id", "trigger_keyword", "service_type", "auto_response_template", "is_active",
                  "created_at", "updated_at")
        read_only_fields = ("created_at", "updated_at")


class SuggestInputSerializer(serializers.Serializer):
    description = serializers.CharField(max_length=5000)
    service = serializers.CharField(required=False, allow_blank=True)
