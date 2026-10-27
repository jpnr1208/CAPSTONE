"""python manage.py seed_data  → roles, usuarios semilla, reglas IA y datos demo."""
from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import CustomUser, Role
from apps.accounts.roles import ROLE_LABELS, ROLE_PERMISSIONS
from apps.ai_engine.models import AIRule
from apps.cases.models import Claim, Complaint, Compliment, Financing
from apps.cases.models import Request as CaseRequest
from apps.cases.services import record_status

DEFAULT_PASSWORD = "insiderduoc2026"

USERS = [
    # email, first, last, role, rut, career, campus, staff
    ("estudiante@duocuc.cl", "Camila", "Rojas", "ESTUDIANTE", "20.123.456-7",
     "Ingeniería en Informática", "San Joaquín", False),
    ("coordinador@duocuc.cl", "Rodrigo", "Fuentes", "COORDINADOR", "15.234.567-8",
     "Escuela de Informática y Telecomunicaciones", "San Joaquín", False),
    ("abogado@duocuc.cl", "Valentina", "Soto", "ABOGADO", "14.345.678-9", "Área Legal", "Casa Central", False),
    ("direccion@duocuc.cl", "Patricio", "Muñoz", "DIRECCION", "12.456.789-0", "Dirección de Sede", "San Joaquín", False),
    ("admin@duocuc.cl", "Ignacio", "Vergara", "ADMIN_TI", "16.567.890-1", "Tecnologías de la Información",
     "Casa Central", True),
    ("finanzas@duocuc.cl", "Francisca", "Lagos", "FINANZAS", "13.678.901-2", "Dirección de Finanzas",
     "Casa Central", False),
]

RULES = [
    ("certificado", "Certificado de alumno regular",
     "Hola {nombre}, tu certificado de alumno regular puede descargarse de inmediato desde Mi Duoc > "
     "Certificados. Si lo necesitas con timbre, lo emitiremos en un plazo de 24 horas. Folio: {folio}."),
    ("licencia medica", "Justificación de inasistencia",
     "Hola {nombre}, recibimos tu justificación. Recuerda que las licencias deben presentarse dentro de "
     "5 días hábiles desde la inasistencia. Tu caso {folio} será validado por Coordinación."),
    ("convalid", "Convalidación de asignaturas",
     "Hola {nombre}, el proceso de convalidación requiere programa de asignatura y concentración de notas "
     "de la institución de origen. La Escuela revisará tus antecedentes ({folio}) en un máximo de 10 días hábiles."),
    ("contrasena", "Acceso a plataformas (AVA / Mi Duoc)",
     "Hola {nombre}, puedes restablecer tu contraseña en https://cuenta.duoc.cl. Si el problema persiste, "
     "Soporte TI atenderá tu caso {folio} dentro de 24 horas."),
    ("beca", "Beca o beneficio",
     "Hola {nombre}, las postulaciones a becas internas se evalúan según calendario de la Dirección de "
     "Asuntos Estudiantiles. Revisaremos tu caso {folio} y te contactaremos con el resultado."),
    ("repact", "Repactación de deuda",
     "Hola {nombre}, Finanzas puede ofrecerte una repactación en hasta 6 cuotas sin interés. Tu caso "
     "{folio} fue derivado a un ejecutivo."),
    ("retiro", "Retiro de asignatura",
     "Hola {nombre}, el retiro de asignaturas está sujeto al calendario académico vigente. Validaremos "
     "tu solicitud {folio} con tu Jefe de Carrera."),
    ("nota", "Revisión de nota",
     "Hola {nombre}, la solicitud de revisión de nota ({folio}) será enviada al docente, quien tiene 5 "
     "días hábiles para responder según el Reglamento Académico."),
]


class Command(BaseCommand):
    help = "Carga roles, usuarios semilla, reglas de automatización y datos de demostración."

    def add_arguments(self, parser):
        parser.add_argument("--no-demo", action="store_true", help="No crear casos de demostración.")
        parser.add_argument("--reset-passwords", action="store_true",
                            help=f"Restablece la contraseña de los usuarios semilla a '{DEFAULT_PASSWORD}'.")

    @transaction.atomic
    def handle(self, *args, **opts):
        roles = {}
        for code, perms in ROLE_PERMISSIONS.items():
            role, _ = Role.objects.update_or_create(
                name=code, defaults={"label": ROLE_LABELS[code], "permissions_json": perms})
            roles[code] = role
        self.stdout.write(self.style.SUCCESS(f"✔ {len(roles)} roles sincronizados"))

        users = {}
        for email, first, last, role, rut, career, campus, is_super in USERS:
            user, created = CustomUser.objects.get_or_create(
                email=email,
                defaults={"username": email, "first_name": first, "last_name": last, "rut": rut,
                          "career": career, "campus": campus, "role": roles[role],
                          "is_staff": is_super, "is_superuser": is_super},
            )
            user.role = roles[role]
            if created or opts["reset_passwords"]:
                user.set_password(DEFAULT_PASSWORD)
            user.save()
            users[role] = user
            self.stdout.write(f"  {'+ creado' if created else '· existente'}: {email} ({ROLE_LABELS[role]})")

        for kw, svc, tpl in RULES:
            AIRule.objects.update_or_create(trigger_keyword=kw, service_type=svc,
                                            defaults={"auto_response_template": tpl, "is_active": True})
        self.stdout.write(self.style.SUCCESS(f"✔ {len(RULES)} reglas de automatización IA"))

        if not opts["no_demo"]:
            self._demo(users)
        self.stdout.write(self.style.SUCCESS(f"✔ Seed completado. Contraseña por defecto: {DEFAULT_PASSWORD}"))

    def _demo(self, users):
        student, coord, lawyer = users["ESTUDIANTE"], users["COORDINADOR"], users["ABOGADO"]
        today = timezone.localdate()

        # Mensualidades (marzo a diciembre del año en curso)
        for i, month in enumerate(range(3, 13), start=1):
            due = date(today.year, month, 5)
            if due < today:
                status = "PAGADO"
            else:
                status = "PENDIENTE"
            Financing.objects.get_or_create(
                user=student, payment_period=f"{today.year}-{month:02d}", concept="Mensualidad",
                defaults={"installment": i, "amount": 185000, "status": status, "due_date": due,
                          "paid_at": timezone.now() if status == "PAGADO" else None},
            )
        # Deja la última cuota vencida como impaga para demostrar el flujo de pago
        last_past = Financing.objects.filter(user=student, due_date__lt=today).order_by("-due_date").first()
        if last_past:
            last_past.status, last_past.paid_at = "VENCIDO", None
            last_past.save()

        if CaseRequest.objects.filter(user=student).exists():
            self.stdout.write("  · datos demo ya existentes (omitido)")
            return

        samples = [
            ("ACADEMICA", "Certificado de alumno regular", "Necesito un certificado de alumno regular para "
             "presentar en mi trabajo, idealmente con timbre.", "BAJA", "PENDIENTE"),
            ("ACADEMICA", "Justificación de inasistencia", "Falté a la evaluación de Programación Web por "
             "licencia médica, adjunto documento. Es urgente porque el examen es la próxima semana.",
             "ALTA", "EN_REVISION"),
            ("FINANCIERA", "Repactación de deuda", "Solicito repactar la deuda de mensualidades atrasadas "
             "por situación familiar.", "MEDIA", "CERRADA"),
        ]
        for cat, svc, desc, prio, st in samples:
            r = CaseRequest.objects.create(user=student, category=cat, service=svc, description=desc,
                                           priority=prio, status="PENDIENTE")
            record_status(r, "PENDIENTE", user=student, comment="Solicitud registrada.")
            if st in ("EN_REVISION", "CERRADA"):
                r.status, r.assigned_to = "EN_REVISION", coord
                r.save()
                record_status(r, "EN_REVISION", user=coord, from_status="PENDIENTE",
                              comment="Antecedentes en revisión por Coordinación.")
            if st == "CERRADA":
                r.status, r.closed_at = "CERRADA", timezone.now()
                r.resolution = "Se aprueba repactación en 4 cuotas sin interés a partir del próximo mes."
                r.save()
                record_status(r, "CERRADA", user=coord, from_status="EN_REVISION", comment=r.resolution)

        c = Claim.objects.create(user=student, category="Infraestructura",
                                 description="El laboratorio L-204 lleva dos semanas con el aire acondicionado malo.")
        record_status(c, "PENDIENTE", user=student, comment="Reclamo registrado.")

        Compliment.objects.create(sender=student, staff_name="Prof. Andrea Castillo", staff_role="Docente",
                                  message="Excelente disposición y claridad en el ramo de Base de Datos.")

        d = Complaint.objects.create(complainant=student, target_name="Área de casino - turno tarde",
                                     description="Se observó trato discriminatorio reiterado hacia estudiantes "
                                                 "extranjeros durante la atención en el casino.")
        record_status(d, "RECIBIDA", user=student, comment="Denuncia recibida por el canal confidencial.")
        d.status = "EN_INVESTIGACION"
        d.save()
        record_status(d, "EN_INVESTIGACION", user=lawyer, from_status="RECIBIDA",
                      comment="Se inicia investigación por el Área Legal.")
        self.stdout.write(self.style.SUCCESS("✔ Datos de demostración creados"))
