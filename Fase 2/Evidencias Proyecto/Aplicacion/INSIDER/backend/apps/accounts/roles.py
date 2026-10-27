"""Catálogo central de roles y permisos RBAC de INSIDER."""

ESTUDIANTE = "ESTUDIANTE"
COORDINADOR = "COORDINADOR"
ABOGADO = "ABOGADO"
DIRECCION = "DIRECCION"
ADMIN_TI = "ADMIN_TI"
FINANZAS = "FINANZAS"

ROLE_LABELS = {
    ESTUDIANTE: "Estudiante",
    COORDINADOR: "Coordinador Académico",
    ABOGADO: "Abogado / Área Legal",
    DIRECCION: "Dirección",
    ADMIN_TI: "Administrador TI",
    FINANZAS: "Finanzas",
}

ROLE_PERMISSIONS = {
    ESTUDIANTE: [
        "requests.create", "requests.view_own",
        "complaints.create", "claims.create",
        "compliments.create", "financing.view_own",
    ],
    COORDINADOR: [
        "requests.manage", "claims.manage", "ai.suggest",
        "compliments.view", "dashboard.view",
    ],
    ABOGADO: [
        "complaints.manage", "meetings.manage", "dashboard.view",
    ],
    DIRECCION: [
        "dashboard.view", "dashboard.executive",
        "requests.view_all", "claims.view_all",
        "complaints.view_stats", "compliments.view",
    ],
    ADMIN_TI: [
        "users.manage", "roles.manage", "rules.manage",
        "audit.view", "dashboard.view",
    ],
    FINANZAS: [
        "financing.manage", "dashboard.view",
    ],
}
