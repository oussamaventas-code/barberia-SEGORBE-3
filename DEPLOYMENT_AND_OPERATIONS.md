# CLUB SEGORBE OS — Guía de Operación, Seguridad y Despliegue

## 1. Arquitectura y Stack
- **Frontend**: React 19 + Vite + Tailwind CSS v4 + GSAP 3 / ScrollTrigger + Lucide React.
- **Backend**: Express (`server.ts`) en puerto `3000`, validación estricta con Zod, límite de tasa en endpoints públicos y verificación JWT de Firebase Admin (`Authorization: Bearer <ID_TOKEN>`).
- **Base de datos**: PostgreSQL (Cloud SQL) gestionado mediante Drizzle ORM (`src/db/schema.ts`, `src/db/index.ts`, `src/db/drizzle.config.ts`).
- **Zona horaria**: Almacenamiento de fechas en UTC (`timestamp with time zone`) y cálculo de disponibilidad/presentación en `Europe/Madrid` con soporte automático CET/CEST (`src/lib/timezone.ts`).

## 2. Seguridad y Control de Concurrencia
- **Reservas atómicas**: `createAtomicBooking` y `rescheduleAppointment` (`src/services/booking.ts`) ejecutan `pg_advisory_xact_lock(staffId)` dentro de una transacción PostgreSQL, revalidan la disponibilidad contra citas activas, márgenes (`buffer_minutes`), bloqueos (`blocked_slots`), festivos/excepciones (`staff_availability`) y horarios (`working_hours`).
- **Idempotencia**: El campo único `appointments.idempotency_key` evita duplicados por doble clic o reintentos de red.
- **RBAC**: El middleware `requireAuth` + `requireAdminOrStaff` + `requireAdmin` (`src/middleware/auth.ts`) verifica tokens en servidor y consulta el rol real en la tabla `profiles` (`ADMIN`, `STAFF`, `CUSTOMER`).
- **Aislamiento de cliente**: Las rutas `/api/public/my-booking` y `/api/public/my-bookings` exigen `bookingCode + accessToken` (o `phone`), o sesión Firebase vinculada, y nunca exponen notas internas (`customer_notes`) ni citas de terceros.

## 3. Variables de Entorno
Definidas en `.env.example` (sin secretos en repositorio):
- `SQL_HOST`, `SQL_DB_NAME`, `SQL_USER`, `SQL_PASSWORD`, `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD` (inyectadas por el entorno Cloud SQL).
- `ADMIN_EMAILS`: Lista separada por comas de correos Google que obtienen rol `ADMIN` automáticamente. Si está vacía, el primer usuario autenticado sobre una base sin administradores obtiene rol `ADMIN`.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`: Credenciales reales para envío de correo electrónico.
- `SMS_PROVIDER_API_KEY`, `WHATSAPP_BUSINESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`: Credenciales opcionales para SMS / WhatsApp Business.

## 4. Migraciones, Copias de Seguridad y Recuperación
- **Migraciones**: Actualizar `src/db/schema.ts` y ejecutar `npx drizzle-kit push` (usando `SQL_ADMIN_USER`) o la herramienta de actualización de esquema de Cloud SQL.
- **Copias de seguridad**: Habilitar backups automáticos diarios en Cloud SQL (Point-in-Time Recovery) y exportaciones lógicas periódicas con `pg_dump --format=custom`.
- **Plan de recuperación**:
  1. Ante caída del servidor Node.js: reinicio automático en Cloud Run / gestor de procesos; el pool `pg` reconecta bajo demanda sin sondeos de arranque.
  2. Ante corrupción lógica o borrado accidental: restaurar snapshot en Cloud SQL o recuperar desde `audit_logs` + `appointment_events`.
  3. Ante cambio de dominio propio: actualizar los orígenes autorizados en Firebase Authentication Console y configurar `APP_URL`.

## 5. Puesta en Producción y Checklist
1. Completar el asistente de `/admin/configuracion` (datos de contacto, datos fiscales/legales reales, horarios semanales, festivos).
2. Configurar precios y duraciones reales en `/admin/servicios` y dar de alta al equipo en `/admin/equipo`.
3. Configurar credenciales SMTP/SMS/WhatsApp si se desean envíos automáticos externos (mientras no estén configuradas, las notificaciones quedan en `PENDING_PROVIDER` sin simular envíos).
4. Revisar textos legales (`/privacidad`, `/aviso-legal`, `/politica-cookies`, `/condiciones-reserva`) con asesoría jurídica antes de abrir el dominio al público.
