"""Pruebas de integración de los casos de uso principales.

Ejecutar:  python manage.py test
Por defecto Django crea una base temporal en PostgreSQL (Supabase). Para correrlas
localmente con SQLite:  TEST_SQLITE=1 python manage.py test
"""
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from apps.audit.models import AuditLog
from apps.cases.models import Complaint, Financing
from apps.cases.models import Request as CaseRequest

PWD = "insiderduoc2026"


class InsiderFlowTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_data", verbosity=0)

    def client_for(self, email):
        c = APIClient()
        res = c.post("/api/v1/auth/login/", {"email": email, "password": PWD}, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
        return c, res.data

    def test_cu001_login_returns_profile_with_role(self):
        _, data = self.client_for("coordinador@duocuc.cl")
        self.assertEqual(data["user"]["role"], "COORDINADOR")
        self.assertIn("refresh", data)
        self.assertTrue(AuditLog.objects.filter(action="auth.login").exists())

    def test_login_invalid_credentials(self):
        res = APIClient().post("/api/v1/auth/login/", {"email": "estudiante@duocuc.cl", "password": "x"}, format="json")
        self.assertEqual(res.status_code, 401)

    def test_cu002_cu006_cu010_request_lifecycle(self):
        c, _ = self.client_for("estudiante@duocuc.cl")
        res = c.post("/api/v1/requests/", {
            "category": "ACADEMICA", "service": "Certificado de alumno regular", "request_type": "Solicitud",
            "description": "Necesito urgente un certificado de alumno regular para mi práctica.",
        })
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.data["priority"], "ALTA")
        self.assertTrue(res.data["ai_suggestion"])
        rid = res.data["id"]
        res = c.patch(f"/api/v1/requests/{rid}/", {"description": "Necesito un certificado de alumno regular, gracias."})
        self.assertEqual(res.status_code, 200, res.content)
        res = c.post(f"/api/v1/requests/{rid}/cancel/", {"reason": "Ya no lo necesito, gracias."}, format="json")
        self.assertEqual(res.data["status"], "ANULADA")
        tl = c.get(f"/api/v1/requests/{rid}/timeline/").data["events"]
        self.assertGreaterEqual(len(tl), 3)

    def test_cu012_coordinator_closes_with_resolution(self):
        c, _ = self.client_for("coordinador@duocuc.cl")
        req = CaseRequest.objects.filter(status="PENDIENTE").first()
        draft = c.get(f"/api/v1/requests/{req.id}/ai-suggestion/").data
        self.assertIn("draft", draft)
        res = c.post(f"/api/v1/requests/{req.id}/close/", {"resolution": draft["draft"]}, format="json")
        self.assertEqual(res.data["status"], "CERRADA")

    def test_cu011_filters(self):
        c, _ = self.client_for("coordinador@duocuc.cl")
        res = c.get("/api/v1/requests/", {"status": "PENDIENTE,EN_REVISION", "category": "ACADEMICA"})
        self.assertEqual(res.status_code, 200)
        self.assertTrue(all(r["status"] in ("PENDIENTE", "EN_REVISION") for r in res.data["results"]))

    def test_cu003_cu008_anonymous_complaint_keeps_no_identity(self):
        c, _ = self.client_for("estudiante@duocuc.cl")
        res = c.post("/api/v1/complaints/", {
            "target_name": "Funcionario X", "is_anonymous": "true",
            "description": "Relato detallado de los hechos ocurridos en la sede durante la semana pasada.",
        })
        self.assertEqual(res.status_code, 201, res.content)
        comp = Complaint.objects.get(folio=res.data["folio"])
        self.assertIsNone(comp.complainant)
        self.assertFalse(AuditLog.objects.filter(action="complaint.created", user__isnull=False,
                                                 details__folio=comp.folio).exists())
        track = {"folio": comp.folio, "tracking_code": res.data["tracking_code"]}
        self.assertEqual(c.post("/api/v1/complaints/track/", track, format="json").status_code, 200)
        res = c.post("/api/v1/complaints/track/cancel/", {**track, "reason": "Se resolvió por otra vía."}, format="json")
        self.assertEqual(res.data["status"], "ANULADA")

    def test_rbac_student_cannot_manage(self):
        c, _ = self.client_for("estudiante@duocuc.cl")
        self.assertEqual(c.get("/api/v1/admin/users/").status_code, 403)
        self.assertEqual(c.get("/api/v1/audit-logs/").status_code, 403)
        req = CaseRequest.objects.first()
        self.assertEqual(c.post(f"/api/v1/requests/{req.id}/close/", {"resolution": "x" * 20}, format="json").status_code, 403)

    def test_direction_cannot_read_complaints_detail(self):
        c, _ = self.client_for("direccion@duocuc.cl")
        self.assertEqual(c.get("/api/v1/complaints/").data["count"], 0)
        self.assertIn("complaints", c.get("/api/v1/dashboard/").data)

    def test_financing_payment_simulation(self):
        c, _ = self.client_for("estudiante@duocuc.cl")
        fin = Financing.objects.exclude(status="PAGADO").first()
        res = c.post(f"/api/v1/financing/{fin.id}/pay/")
        self.assertEqual(res.data["status"], "PAGADO")
        self.assertTrue(res.data["transaction_id"].startswith("SIM-"))

    def test_password_reset_flow(self):
        c = APIClient()
        with self.settings(DEBUG=True):
            code = c.post("/api/v1/auth/password-reset/request/", {"email": "finanzas@duocuc.cl"}, format="json").data["debug_code"]
        token = c.post("/api/v1/auth/password-reset/verify/", {"email": "finanzas@duocuc.cl", "code": code},
                       format="json").data["reset_token"]
        res = c.post("/api/v1/auth/password-reset/confirm/", {"reset_token": token, "new_password": "Nuev@Clave2026"},
                     format="json")
        self.assertEqual(res.status_code, 200, res.content)

    def test_dashboards_by_role(self):
        for email in ("estudiante", "coordinador", "abogado", "direccion", "admin", "finanzas"):
            c, _ = self.client_for(f"{email}@duocuc.cl")
            self.assertEqual(c.get("/api/v1/dashboard/").status_code, 200, email)
