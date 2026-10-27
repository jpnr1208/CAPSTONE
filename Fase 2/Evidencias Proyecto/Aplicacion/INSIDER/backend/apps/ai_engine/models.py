from django.db import models


class AIRule(models.Model):
    """Regla de automatización: si la descripción contiene `trigger_keyword`
    (y opcionalmente coincide `service_type`), se propone la plantilla."""

    trigger_keyword = models.CharField("palabra gatillo", max_length=100)
    service_type = models.CharField("tipo de servicio", max_length=120, blank=True)
    auto_response_template = models.TextField("plantilla de respuesta")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "regla de automatización"
        verbose_name_plural = "reglas de automatización"
        ordering = ["trigger_keyword"]

    def __str__(self):
        return f"{self.trigger_keyword} → {self.service_type or 'cualquier servicio'}"
