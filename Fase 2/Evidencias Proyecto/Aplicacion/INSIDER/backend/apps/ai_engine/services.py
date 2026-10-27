"""Asistente de decisión IA de INSIDER.

Motor liviano y explicable (sin dependencias externas) que combina:
  1. Clasificación por palabras clave ponderadas (categoría, servicio, prioridad).
  2. Reglas de automatización configurables (modelo AIRule).
  3. Búsqueda semántica aproximada (similitud de Jaccard sobre tokens) en FAQ.

Diseñado para ser reemplazable por un LLM: basta con implementar las mismas
firmas públicas (`classify`, `suggest`, `draft_response`, `search_faq`).
"""
import re
import unicodedata
from types import SimpleNamespace

from .knowledge import (
    CATALOG, CATEGORY_KEYWORDS, FAQ, HIGH_PRIORITY_KEYWORDS, REQUIRED_DOCUMENTS,
    SENSITIVE_KEYWORDS, SERVICE_KEYWORDS,
)
from .models import AIRule

STOPWORDS = {
    "el", "la", "los", "las", "un", "una", "de", "del", "y", "o", "a", "en", "que", "por", "para",
    "con", "mi", "me", "se", "es", "no", "lo", "al", "su", "como", "mas", "pero", "ya", "le", "yo",
    "tengo", "quiero", "necesito", "hola", "favor", "porfavor",
}


def normalize(text):
    text = unicodedata.normalize("NFD", (text or "").lower())
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9ñ\s]", " ", text)).strip()


def tokens(text):
    return {t for t in normalize(text).split() if len(t) > 2 and t not in STOPWORDS}


def _score(text, keywords):
    return [k for k in keywords if k in text]


def service_category(service):
    for code, data in CATALOG.items():
        if service in data["services"]:
            return code
    return None


def classify(description, service=None):
    """Clasifica un texto libre. Retorna categoría, servicio, prioridad y confianza."""
    text = normalize(description)
    cat_scores = {c: _score(text, kws) for c, kws in CATEGORY_KEYWORDS.items()}
    svc_scores = {s: _score(text, kws) for s, kws in SERVICE_KEYWORDS.items()}

    best_service = service or max(svc_scores, key=lambda s: len(svc_scores[s]))
    if not service and not svc_scores[best_service]:
        best_service = None

    best_cat = service_category(best_service) if best_service else None
    if not best_cat:
        best_cat = max(cat_scores, key=lambda c: len(cat_scores[c]))
        if not cat_scores[best_cat]:
            best_cat = "ACADEMICA"

    hits = len(cat_scores.get(best_cat, [])) + len(svc_scores.get(best_service, []) if best_service else [])
    confidence = round(min(0.35 + 0.15 * hits, 0.97), 2)

    urgent = _score(text, HIGH_PRIORITY_KEYWORDS)
    sensitive = _score(text, SENSITIVE_KEYWORDS)
    priority = "ALTA" if (urgent or sensitive) else ("MEDIA" if len(text) > 180 else "BAJA")

    return {
        "category": best_cat,
        "category_label": CATALOG.get(best_cat, {}).get("label", best_cat),
        "service": best_service,
        "priority": priority,
        "confidence": confidence,
        "keywords": sorted(set(cat_scores.get(best_cat, []) + urgent)),
        "sensitive": bool(sensitive),
    }


def matching_rules(description, service=None):
    text = normalize(description)
    rules = []
    for rule in AIRule.objects.filter(is_active=True):
        kw = normalize(rule.trigger_keyword)
        if kw and kw in text and (not rule.service_type or not service or rule.service_type == service):
            rules.append(rule)
    return rules


def search_faq(query, limit=3):
    q = tokens(query)
    if not q:
        return []
    scored = []
    for item in FAQ:
        doc = tokens(item["q"] + " " + item["a"]) | set(item["tags"])
        inter = len(q & doc)
        if inter:
            scored.append((inter / len(q | doc) + 0.1 * inter, item))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [{"question": i["q"], "answer": i["a"], "score": round(s, 3)} for s, i in scored[:limit]]


def suggest(description, service=None, user=None):
    """CU002: sugerencias en vivo mientras el estudiante redacta."""
    result = classify(description, service)
    svc = service or result["service"]
    suggestions = []

    preview = SimpleNamespace(user=user, folio="(se asignará al enviar)", service=svc)

    if result["sensitive"]:
        suggestions.append({
            "type": "redirect",
            "title": "Esto podría corresponder a una denuncia",
            "text": "Detectamos términos asociados a conductas graves. Te recomendamos usar el canal "
                    "confidencial de Denuncias, gestionado por el Área Legal.",
            "link": "/denuncias",
        })
    if svc in REQUIRED_DOCUMENTS:
        suggestions.append({"type": "document", "title": "Documentación recomendada",
                            "text": REQUIRED_DOCUMENTS[svc]})
    for rule in matching_rules(description, svc):
        suggestions.append({"type": "rule", "title": f"Respuesta sugerida ({rule.trigger_keyword})",
                            "text": _fill(rule.auto_response_template, preview)})
    for faq in search_faq(description, limit=2):
        suggestions.append({"type": "faq", "title": faq["question"], "text": faq["answer"]})
    if len(normalize(description)) < 40:
        suggestions.append({"type": "tip", "title": "Agrega más detalle",
                            "text": "Incluye fechas, asignatura/sección y lo que necesitas para acelerar la respuesta."})

    return {"classification": result, "suggestions": suggestions}


def _fill(template, obj):
    user = getattr(obj, "user", None)
    values = {
        "nombre": (user.first_name if user else "") or "estudiante",
        "folio": getattr(obj, "folio", ""),
        "servicio": getattr(obj, "service", "") or getattr(obj, "category", ""),
    }
    for k, v in values.items():
        template = template.replace("{" + k + "}", str(v))
    return template


def draft_response(obj):
    """Borrador de respuesta para el coordinador (asistente de decisión)."""
    service = getattr(obj, "service", None)
    rules = matching_rules(obj.description, service)
    cls = classify(obj.description, service)
    if rules:
        body = _fill(rules[0].auto_response_template, obj)
        source = f"Regla '{rules[0].trigger_keyword}'"
    else:
        body = _fill(
            "Estimado/a {nombre}:\n\nHemos revisado tu caso {folio} asociado a {servicio}. "
            "Para continuar, nuestro equipo validará los antecedentes presentados y te "
            "informará la resolución dentro del plazo establecido.\n\nSaludos cordiales,\n"
            "Coordinación Académica - Duoc UC", obj)
        source = "Plantilla general"
    recommended = "RESUELTA" if cls["confidence"] >= 0.65 and not cls["sensitive"] else "EN_REVISION"
    return {
        "draft": body,
        "source": source,
        "classification": cls,
        "recommended_status": recommended,
        "rules_matched": [r.trigger_keyword for r in rules],
    }


def apply_automation(obj):
    """Se ejecuta al crear una solicitud: completa prioridad y sugerencia IA.

    Retorna el texto de respuesta automática si alguna regla aplica.
    """
    cls = classify(obj.description, obj.service)
    if not obj.priority:
        obj.priority = cls["priority"]
    obj.ai_category = cls["category"]
    rules = matching_rules(obj.description, obj.service)
    obj.ai_suggestion = _fill(rules[0].auto_response_template, obj) if rules else ""
    return obj.ai_suggestion or None
