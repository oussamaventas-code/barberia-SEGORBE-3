# Segorbe OS · Guía técnica y de operación

## 1. Arquitectura

- **Frontend**: React 19, Vite, Tailwind CSS v4, GSAP (animaciones) y Lucide (iconos). Las páginas del panel se cargan bajo demanda.
- **Backend**: Express 5 (`server.ts`) con validación Zod, límite de peticiones en los endpoints públicos y en el login, y cabeceras de seguridad básicas.
- **Base de datos (demo)**: PGlite, un PostgreSQL real que se ejecuta dentro del proceso de Node y guarda los datos en `.data/pglite`. El esquema está en `src/db/schema.ts` y las migraciones en `drizzle/`, que se aplican solas al arrancar.
- **Zona horaria**: las fechas se guardan en UTC y la disponibilidad se calcula en `Europe/Madrid`, con el cambio de hora de verano e invierno (`src/lib/timezone.ts`).

## 2. Autenticación (demo)

- Login con email y contraseña contra la tabla `profiles`. Las contraseñas se guardan con scrypt y sal.
- La sesión es un token firmado con HMAC-SHA256 que caduca a los 7 días. El secreto se toma de `SESSION_SECRET` o se genera en `.data/session-secret`.
- Roles: `ADMIN` (dirección), `STAFF` (equipo) y `CUSTOMER` (sin acceso al panel). El administrador crea usuarios y cambia contraseñas en **Configuración → Usuarios del panel**.
- Los clientes no necesitan cuenta: gestionan su cita con el código de reserva y su teléfono, o con el enlace seguro (código + token).

## 3. Reservas y concurrencia

- `createAtomicBooking` y `rescheduleAppointment` (`src/services/booking.ts`) trabajan dentro de una transacción y vuelven a comprobar la disponibilidad: citas activas, margen entre citas, bloqueos, festivos y horario.
- Todas las consultas de una reserva usan la misma transacción, lo que evita bloqueos en PGlite, que trabaja con una sola conexión.
- Cada reserva lleva una clave de idempotencia, de modo que un doble clic o un reintento de red no crea duplicados.
- Si dos clientes intentan el mismo hueco, el segundo recibe un 409 y la web le muestra de nuevo los huecos libres.

## 4. Datos de demostración

`src/services/bootstrap.ts` crea con una semilla fija (siempre los mismos datos): configuración del negocio, 6 servicios, 3 barberos con sus horarios (Nico descansa los lunes), un festivo, 220 clientes con sus consentimientos, unas 800 citas con cobros, notas de CRM, lista de espera y notificaciones.

- Borrar y regenerar: `npm run db:reset`.
- Arrancar sin datos de ejemplo: `DEMO_SEED=false`.

## 5. Notificaciones

Se guardan en la tabla `notifications`. Sin proveedor configurado (SMTP, SMS o WhatsApp), los envíos externos quedan como **"Envío pendiente"**: nunca se marcan como enviados sin haberse enviado de verdad.

## 6. Paso a producción (pendiente)

1. Sustituir PGlite por la base definitiva en `src/db/index.ts` (por ejemplo `drizzle-orm/node-postgres` o el driver de la plataforma elegida) y aplicar las migraciones de `drizzle/`.
2. Definir `SESSION_SECRET`, `ADMIN_EMAIL` y `ADMIN_PASSWORD`, y desactivar `DEMO_SEED`.
3. Revisar los datos reales del negocio en `/admin/configuracion` (dirección, NIF, textos legales), los precios en `/admin/servicios` y el equipo en `/admin/equipo`.
4. Configurar los proveedores de email, SMS o WhatsApp si se quieren envíos automáticos.
5. Revisar los textos legales (`/privacidad`, `/aviso-legal`, `/politica-cookies`, `/condiciones-reserva`) con asesoría jurídica.
