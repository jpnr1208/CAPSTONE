# Sistema de Soluciones INSIDER · Duoc UC

Plataforma web unificada de **atención estudiantil e inteligencia institucional**: Solicitudes Académicas, Denuncias Confidenciales, Financiamiento, Reclamos y Felicitaciones, con **motor de automatización por reglas**, **asistente de decisión IA**, **RBAC** y **bitácora de auditoría**.

| Capa | Tecnología |
|---|---|
| Backend | Django 4.2 · Django REST Framework · SimpleJWT · django-cors-headers · django-filter |
| Frontend | React 18 (Vite) · Tailwind CSS · Lucide Icons · React Router DOM · Recharts |
| Base de datos | PostgreSQL en Supabase (`dj-database-url` + `psycopg2-binary`) |
| Entorno | GitHub Codespaces (puertos `8000` backend y `5173` frontend) |

---

## 1. Requisitos previos

- **Python 3.11+** y **pip**
- **Node.js LTS (20+)** y **npm**
- Acceso a internet hacia el proyecto Supabase
- (Opcional) **GitHub Codespaces**: el `.devcontainer/` instala todo automáticamente (`pip install` + `npm install`).

```
insider/
├── .devcontainer/          # Codespaces: Python 3.11 + Node LTS + post-create
├── backend/
│   ├── config/             # settings, urls, paginación
│   ├── apps/
│   │   ├── accounts/       # CustomUser, Role, JWT, RBAC, recuperación de clave, seed_data
│   │   ├── audit/          # AuditLog + utilidades de bitácora
│   │   ├── ai_engine/      # AIRule, clasificador IA, FAQ, catálogo de servicios
│   │   ├── cases/          # Request, Complaint, Claim, Compliment, Financing, timeline
│   │   └── dashboard/      # Métricas por rol y resumen de inicio
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── api/            # Axios + refresh JWT automático
    │   ├── context/        # AuthContext (sesión y permisos)
    │   ├── components/     # Layout, bandeja de casos, timeline, UI
    │   └── pages/          # 13 vistas
    ├── vite.config.js      # Proxy /api → :8000 (funciona igual en Codespaces)
    └── .env.example
```

---

## 2. Configuración de variables de entorno

### Backend (`backend/.env`)

```bash
cd backend
cp .env.example .env
```

```ini
DJANGO_SECRET_KEY=cambia-esta-clave-en-produccion
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=*

# Supabase PostgreSQL
DATABASE_URL=postgresql://postgres:insiderduoc2026@db.mrlwlnzzttxnueuaijab.supabase.co:5432/postgres
DB_HOST=db.mrlwlnzzttxnueuaijab.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=insiderduoc2026
DB_SSL_REQUIRE=True

CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
CSRF_TRUSTED_ORIGINS=http://localhost:5173,https://*.app.github.dev
JWT_ACCESS_MINUTES=60
JWT_REFRESH_DAYS=7
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
SLA_HOURS=72
```

> Prioridad de conexión: `DATABASE_URL` → variables `DB_*` → SQLite local (solo si ambas están vacías).

> ⚠️ **Codespaces / redes solo IPv4:** la conexión directa `db.<ref>.supabase.co` resuelve a **IPv6**. Si `migrate` falla con *"Network is unreachable"*, en Supabase ve a **Connect → Session pooler** y reemplaza `DATABASE_URL` por esa cadena (usuario `postgres.mrlwlnzzttxnueuaijab`, host `aws-0-<región>.pooler.supabase.com`, puerto `5432`).

### Frontend (`frontend/.env`)

```bash
cd frontend
cp .env.example .env
```

```ini
VITE_API_URL=/api/v1
VITE_PROXY_TARGET=http://localhost:8000
```

El frontend llama a `/api/v1` y **Vite hace de proxy hacia Django**, por lo que en Codespaces no es necesario hacer público el puerto 8000 ni configurar CORS adicional.

---

## 3. Comandos de inicialización Backend (Django)

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_data        # roles, 6 usuarios, reglas IA y datos demo
python manage.py runserver 0.0.0.0:8000
```

Opciones de `seed_data` (idempotente, se puede ejecutar varias veces):

| Opción | Efecto |
|---|---|
| `--no-demo` | Solo roles, usuarios y reglas (sin casos de ejemplo) |
| `--reset-passwords` | Restablece la clave de los 6 usuarios semilla a `insiderduoc2026` |

Otros comandos útiles:

```bash
python manage.py test                     # pruebas de integración (CU001–CU012)
TEST_SQLITE=1 python manage.py test       # pruebas sin tocar Supabase
python manage.py createsuperuser          # acceso a /admin
```

- API: `http://localhost:8000/api/v1/` · Health: `/api/v1/health/` · Admin Django: `/admin/` (`admin@duocuc.cl` es superusuario).

---

## 4. Comandos de inicialización Frontend (React/Vite)

```bash
cd frontend
npm install
npm run dev -- --host
```

Abre `http://localhost:5173` (en Codespaces, la pestaña **Ports → 5173**). Build de producción: `npm run build`.

---

## 5. Credenciales de prueba

Contraseña para todos: **`insiderduoc2026`**

| # | Rol | Email | Permisos principales |
|---|---|---|---|
| 1 | Estudiante | `estudiante@duocuc.cl` | Crear solicitudes, denuncias anónimas/confidenciales, reclamos, felicitaciones; consultar financiamiento |
| 2 | Coordinador Académico | `coordinador@duocuc.cl` | Gestionar y resolver solicitudes y reclamos con sugerencias IA |
| 3 | Abogado / Área Legal | `abogado@duocuc.cl` | Denuncias confidenciales, agenda de reuniones y dictámenes |
| 4 | Dirección | `direccion@duocuc.cl` | Dashboards ejecutivos, métricas SLA, estadísticas globales |
| 5 | Administrador TI | `admin@duocuc.cl` | Usuarios, roles, reglas de automatización y logs de auditoría |
| 6 | Finanzas | `finanzas@duocuc.cl` | Mensualidades y estados de pago |

En modo desarrollo, la pantalla `/login` incluye botones para autocompletar estas credenciales.

---

## Anexo A · Casos de uso y endpoints (`/api/v1/`)

| CU | Descripción | Endpoint |
|---|---|---|
| CU001 | Iniciar sesión (JWT + perfil con rol) | `POST auth/login/` · `POST auth/refresh/` · `POST auth/logout/` · `GET/PATCH auth/me/` |
| CU002 | Registrar solicitud + sugerencias IA | `POST requests/` · `POST ai/suggest/` · `GET catalog/` |
| CU003 | Registrar denuncia (anónima/confidencial) + notificación legal | `POST complaints/` · `POST complaints/track/` |
| CU004 | Registrar felicitación | `POST compliments/` · `GET compliments/ranking/` |
| CU005 | Dashboard por perfil | `GET dashboard/` · `GET dashboard/home/` |
| CU006 | Modificar solicitud (solo *Pendiente*) | `PATCH requests/{id}/` |
| CU007 | Seguimiento / timeline | `GET {requests,claims,complaints}/{id}/timeline/` |
| CU008 | Anular denuncia (fundamentada) | `POST complaints/{id}/cancel/` · `POST complaints/track/cancel/` |
| CU009 | Registrar reclamo | `POST claims/` |
| CU010 | Anular solicitud (alumno) | `POST requests/{id}/cancel/` |
| CU011 | Búsqueda y filtrado avanzado | `GET requests/?search=&status=A,B&category=&priority=&date_from=&date_to=&ordering=` (igual en `claims/`, `complaints/`, `financing/`, `audit-logs/`) |
| CU012 | Cerrar caso con dictamen | `POST {requests,claims,complaints}/{id}/close/` |

Otros: `POST {recurso}/{id}/change-status/`, `GET requests/{id}/ai-suggestion/`, `GET/POST complaints/{id}/meetings/`, `POST financing/{id}/pay/`, `GET financing/summary/`, `GET {recurso}/{id}/download/`, `admin/users/`, `admin/roles/`, `ai/rules/`, `audit-logs/`, `help/faq/`, `auth/password-reset/{request,verify,confirm}/`, `auth/change-password/`.

## Anexo B · Pantallas (13)

`/login` · `/recuperar-password` · `/codigo-verificacion` · `/nueva-password` · `/inicio` · `/solicitudes` · `/financiamiento` · `/cuenta` · `/ayuda` · `/denuncias` · `/reclamos` · `/felicitaciones` · `/dashboard`

Las vistas se adaptan al rol: el estudiante ve formularios y su historial; Coordinación, Área Legal y Finanzas ven **bandejas de gestión** con filtros (CU011), timeline, borrador IA y cierre con dictamen; el Administrador TI gestiona usuarios, matriz RBAC, reglas IA y auditoría desde `/dashboard`.

## Anexo C · Seguridad y diseño

- **JWT** con rotación y *blacklist* del refresh token al cerrar sesión.
- **RBAC** declarativo: `Role.permissions_json` + `RolePermission(...)` en el backend y `hasPerm(...)` en el frontend. Los permisos son editables desde la matriz RBAC.
- **Denuncias anónimas**: no se guarda usuario ni IP (ni en el caso ni en la bitácora); el seguimiento usa folio + código (almacenado como hash). **Reclamos con identidad reservada**: se guarda el autor para permitirle el seguimiento, pero su nombre se oculta a quienes gestionan.
- **Adjuntos protegidos**: no se publican en `/media/`; se descargan por `/{recurso}/{id}/download/` validando permisos. Extensiones permitidas y límite de 10 MB.
- **Auditoría** de inicios de sesión (exitosos y fallidos), cambios de estado, cierres, descargas, pagos y administración.
- **Recuperación de clave**: código de 6 dígitos (hash, 15 min, máx. 5 intentos) + token firmado; *throttling* por IP.
- **Motor IA** (`apps/ai_engine/services.py`): clasificación por palabras clave ponderadas, prioridad, detección de contenido sensible (sugiere derivar a Denuncias), reglas `AIRule` con variables `{nombre}`, `{folio}`, `{servicio}` y búsqueda semántica aproximada en FAQ. Las funciones públicas (`classify`, `suggest`, `draft_response`) pueden reemplazarse por un LLM sin tocar las vistas.

> **Producción:** usa `DJANGO_DEBUG=False`, una `DJANGO_SECRET_KEY` robusta, `DJANGO_ALLOWED_HOSTS` explícito, un backend SMTP real, almacenamiento de archivos privado (p. ej., Supabase Storage/S3) y **rota la contraseña de la base de datos** antes de publicar el repositorio.
