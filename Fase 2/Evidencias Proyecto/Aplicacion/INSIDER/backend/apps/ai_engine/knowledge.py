"""Base de conocimiento local del asistente IA (catálogo + FAQ)."""

CATALOG = {
    "ACADEMICA": {
        "label": "Académica",
        "services": [
            "Certificado de alumno regular",
            "Revisión de nota",
            "Justificación de inasistencia",
            "Convalidación de asignaturas",
            "Cambio de sección o jornada",
            "Retiro de asignatura",
            "Congelamiento de estudios",
            "Proceso de titulación",
        ],
    },
    "FINANCIERA": {
        "label": "Financiera",
        "services": [
            "Repactación de deuda",
            "Beca o beneficio",
            "Devolución de dinero",
            "Certificado de deuda",
        ],
    },
    "ADMINISTRATIVA": {
        "label": "Administrativa",
        "services": [
            "Credencial estudiantil (TNE)",
            "Actualización de datos personales",
            "Certificado de concentración de notas",
        ],
    },
    "BIENESTAR": {
        "label": "Bienestar Estudiantil",
        "services": [
            "Apoyo psicológico",
            "Seguro escolar",
            "Inclusión y accesibilidad",
        ],
    },
    "TI": {
        "label": "Soporte TI",
        "services": [
            "Acceso a plataformas (AVA / Mi Duoc)",
            "Correo institucional",
            "Licencias de software",
        ],
    },
}

REQUEST_TYPES = ["Solicitud", "Consulta", "Apelación"]

CLAIM_CATEGORIES = [
    "Atención al estudiante", "Infraestructura", "Docencia", "Servicios digitales",
    "Proceso financiero", "Biblioteca", "Casino / Cafetería", "Otro",
]

# Palabras clave para clasificación (normalizadas sin tildes).
CATEGORY_KEYWORDS = {
    "ACADEMICA": ["nota", "evaluacion", "prueba", "examen", "asignatura", "ramo", "seccion", "docente",
                  "profesor", "inasistencia", "certificado alumno", "convalid", "titulacion", "practica",
                  "congel", "retiro", "malla", "horario", "jornada"],
    "FINANCIERA": ["pago", "deuda", "arancel", "mensualidad", "cuota", "beca", "beneficio", "credito",
                   "cae", "devolucion", "dinero", "repact", "boleta", "matricula"],
    "ADMINISTRATIVA": ["credencial", "tne", "datos personales", "direccion", "concentracion de notas",
                       "documento", "tramite"],
    "BIENESTAR": ["psicolog", "salud", "ansiedad", "estres", "seguro escolar", "accidente",
                  "discapacidad", "inclusion", "accesibilidad"],
    "TI": ["contrasena", "clave", "correo", "plataforma", "ava", "mi duoc", "login", "acceso",
           "licencia", "office", "wifi", "sistema"],
}

SERVICE_KEYWORDS = {
    "Certificado de alumno regular": ["certificado de alumno", "alumno regular", "certificado alumno"],
    "Revisión de nota": ["revision de nota", "recorreccion", "nota", "evaluacion"],
    "Justificación de inasistencia": ["inasistencia", "licencia medica", "falte", "ausencia", "justific"],
    "Convalidación de asignaturas": ["convalid", "homolog"],
    "Cambio de sección o jornada": ["cambio de seccion", "jornada", "vespertino", "diurno", "seccion"],
    "Retiro de asignatura": ["retiro de asignatura", "retirar ramo", "botar ramo", "retiro"],
    "Congelamiento de estudios": ["congel", "suspender estudios", "postergacion"],
    "Proceso de titulación": ["titulo", "titulacion", "egreso"],
    "Repactación de deuda": ["repact", "deuda", "atraso", "moroso"],
    "Beca o beneficio": ["beca", "beneficio", "gratuidad", "descuento"],
    "Devolución de dinero": ["devolucion", "reembolso", "cobro duplicado", "pague dos veces"],
    "Certificado de deuda": ["certificado de deuda"],
    "Credencial estudiantil (TNE)": ["tne", "credencial", "pase escolar"],
    "Actualización de datos personales": ["datos personales", "cambio de direccion", "telefono"],
    "Certificado de concentración de notas": ["concentracion de notas"],
    "Apoyo psicológico": ["psicolog", "ansiedad", "estres", "depresion", "angustia"],
    "Seguro escolar": ["seguro escolar", "accidente"],
    "Inclusión y accesibilidad": ["discapacidad", "inclusion", "accesibilidad", "neurodivergen"],
    "Acceso a plataformas (AVA / Mi Duoc)": ["ava", "mi duoc", "plataforma", "no puedo entrar", "acceso"],
    "Correo institucional": ["correo", "email", "outlook"],
    "Licencias de software": ["licencia", "office", "software", "adobe", "autocad"],
}

HIGH_PRIORITY_KEYWORDS = ["urgente", "hoy", "manana", "plazo", "vence", "titulacion", "examen",
                          "bloqueado", "inmediato", "reprobar", "emergencia"]

SENSITIVE_KEYWORDS = ["acoso", "abuso", "discrimin", "violencia", "amenaza", "hostig", "agresion",
                      "maltrato", "sexual", "bullying"]

REQUIRED_DOCUMENTS = {
    "Justificación de inasistencia": "Adjunta licencia médica o documento de respaldo (PDF o imagen).",
    "Convalidación de asignaturas": "Adjunta programa de asignatura y concentración de notas de origen.",
    "Revisión de nota": "Indica la evaluación, fecha y adjunta la pauta o evidencia si la tienes.",
    "Devolución de dinero": "Adjunta comprobante de pago y datos bancarios del titular.",
    "Beca o beneficio": "Adjunta documentos socioeconómicos que respalden tu postulación.",
    "Congelamiento de estudios": "Adjunta documento que respalde el motivo (laboral, médico, etc.).",
}

FAQ = [
    {"q": "¿Cuánto demora en responderse una solicitud?",
     "a": "El plazo objetivo (SLA) es de 72 horas hábiles. Puedes revisar el estado en el seguimiento de tu solicitud.",
     "tags": ["plazo", "demora", "sla", "tiempo", "solicitud"]},
    {"q": "¿Puedo hacer una denuncia de forma anónima?",
     "a": "Sí. En el módulo Denuncias marca la opción 'Anónima'. No se almacenará tu identidad y recibirás un folio y código de seguimiento.",
     "tags": ["denuncia", "anonima", "confidencial", "acoso"]},
    {"q": "¿Cómo modifico una solicitud enviada?",
     "a": "Mientras esté en estado 'Pendiente' puedes editarla desde Solicitudes > Mis solicitudes > Editar.",
     "tags": ["modificar", "editar", "solicitud", "cambiar"]},
    {"q": "¿Cómo anulo una solicitud?",
     "a": "Desde Mis solicitudes, selecciona 'Anular' e indica el motivo. Solo es posible antes de que sea resuelta.",
     "tags": ["anular", "cancelar", "solicitud"]},
    {"q": "¿Dónde veo mis cuotas y mensualidades?",
     "a": "En el módulo Financiamiento verás tus mensualidades, estados de pago y podrás simular el pago.",
     "tags": ["pago", "cuota", "mensualidad", "arancel", "financiamiento", "deuda"]},
    {"q": "Olvidé mi contraseña, ¿qué hago?",
     "a": "En la pantalla de acceso usa '¿Olvidaste tu contraseña?'. Te enviaremos un código de verificación a tu correo institucional.",
     "tags": ["contrasena", "clave", "olvide", "password", "recuperar"]},
    {"q": "¿Cuál es la diferencia entre un reclamo y una denuncia?",
     "a": "Un reclamo expresa disconformidad con un servicio. Una denuncia informa conductas graves (acoso, discriminación, fraude) y es gestionada por el Área Legal de forma confidencial.",
     "tags": ["reclamo", "denuncia", "diferencia"]},
    {"q": "¿Cómo felicito a un docente o funcionario?",
     "a": "Ingresa a Felicitaciones, indica el nombre de la persona y tu mensaje. Se enviará como reconocimiento formal.",
     "tags": ["felicitar", "felicitacion", "docente", "reconocimiento"]},
]
