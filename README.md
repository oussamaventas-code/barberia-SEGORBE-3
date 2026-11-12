# Segorbe OS

Sistema digital para **Barbería Segorbe** (C. Jesús Esteban, Murcia): web pública, reservas online en tiempo real, área de cliente y panel privado con agenda, CRM e informes.

> **Modo demostración.** La base de datos es **local** (PGlite, un PostgreSQL embebido que guarda los datos en `.data/`). No hace falta instalar ningún servidor de base de datos ni conectar nada en la nube. Al arrancar por primera vez se carga un conjunto de datos de ejemplo realista.

## Arrancar en 2 comandos

Requisitos: Node.js 20 o superior.

```bash
npm install
```

```bash
npm run dev
```

Abre <http://localhost:3000>.

La primera vez tarda unos segundos más mientras crea la base de datos y carga los datos demo.

## Accesos de demostración

| Dónde | Usuario | Contraseña |
| --- | --- | --- |
| Panel `/admin` (dueño, acceso total) | `admin@barberiasegorbe.demo` | `segorbe2026` |
| Panel `/admin` (barbero, sin configuración) | `barbero@barberiasegorbe.demo` | `barbero2026` |
| Área de cliente `/mi-cita` | código `CS-DEMO26` | teléfono `600111222` |

En la pantalla de login hay botones para rellenar estas credenciales con un clic.

## Qué incluye la demo

- **Web pública** (`/`): portada, carta de servicios con precios, equipo, cómo reservar, horario y ubicación.
- **Reserva online** (`/reservar`): 3 pasos (servicio → barbero, día y hora → datos). Solo muestra huecos realmente libres y evita dobles reservas aunque dos personas pulsen a la vez.
- **Área de cliente** (`/mi-cita`): consultar, cambiar o cancelar una cita, historial y descarga de datos personales (RGPD).
- **Panel privado** (`/admin`): resumen con KPIs, agenda diaria, semanal y mensual, citas manuales, bloqueos, cobros, ficha de cliente 360°, segmentación CRM, campaña de recuperación de clientes inactivos, catálogo, equipo y horarios, informes, auditoría y gestión de usuarios.

Datos de ejemplo: 3 barberos, 6 servicios, 220 clientes y unas 800 citas entre los últimos 75 días y las próximas 2 semanas, con cobros, cancelaciones, ausencias, notas internas y lista de espera.

## Marca y datos reales

Ya están cargados los datos de la ficha de Google: C. Jesús Esteban, 30009 Murcia · +34 643 11 28 58 · L-V 10:00–14:00 y 16:30–20:30 (sábado y domingo cerrado) · 4,8★ con 60 reseñas · Instagram [@barberiasegorbe](https://www.instagram.com/barberiasegorbe/).

El escudo (`src/components/Logo.tsx` y `public/images/logo.svg`) es una recreación vectorial del logotipo. Para usar el archivo original, guárdalo como `public/images/logo.png` y pásalo con `<LogoMark src="/images/logo.png" />`.

**Siguen siendo de ejemplo**: los nombres del equipo, los precios, los clientes y las citas. Se cambian desde el panel (Servicios, Equipo) o en `src/services/bootstrap.ts`.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con recarga en caliente |
| `npm run build` | Compila el frontend en `dist/` |
| `npm start` | Sirve la versión compilada (modo producción) |
| `npm run db:reset` | Borra la base local; se recrea con datos demo en el siguiente arranque |
| `npm run db:generate` | Genera una nueva migración SQL tras cambiar `src/db/schema.ts` |
| `npm run lint` | Comprobación de tipos TypeScript |

## Configuración

Copia `.env.example` a `.env` si necesitas cambiar algo. Lo más útil:

- `PORT`: puerto (3000 por defecto).
- `DB_DIR=memory`: base de datos en memoria; se borra al reiniciar.
- `DEMO_SEED=false`: arranca solo con la configuración mínima, sin clientes ni citas.
- `ADMIN_EMAIL` y `ADMIN_PASSWORD`: credenciales del administrador inicial.

## Estructura

```
server.ts                 Servidor Express (API + frontend)
drizzle/                  Migraciones SQL generadas
src/db/                   Esquema (Drizzle ORM) y conexión PGlite
src/services/             Disponibilidad, reservas atómicas, CRM, notificaciones, datos demo
src/routes/               API pública (/api/public) y privada (/api/admin)
src/middleware/auth.ts    Sesiones y control de roles
src/pages/                Páginas React (pública, reserva, cliente, admin)
public/images/            Fotografías
docs/                     Guía de operación y brief original
```

## Pasar a producción más adelante

El esquema es PostgreSQL estándar (Drizzle ORM). Para pasar a una base de datos gestionada (Cloudflare D1/Hyperdrive, Neon, Supabase, Cloud SQL…) solo hay que cambiar `src/db/index.ts` y aplicar las migraciones de `drizzle/`. Consulta [`docs/OPERACION.md`](docs/OPERACION.md).
