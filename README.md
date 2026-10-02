# VoleyApp

Reservas de canchas, partidos y gestión de clubes de vóley para Zona Sur y CABA.

- **Jugadores**: encuentran clubes y horarios libres, piden la cancha (el club la confirma o se confirma sola), arman partidos con cupo y nivel, se suman a partidos de otros, chatean con su equipo y reciben avisos y recordatorios.
- **Clubes**: una agenda única para lo que llega por la app, por WhatsApp, por teléfono o en el mostrador; alquileres fijos con cobro semana a semana; clientes con saldo y botón de WhatsApp; caja, deudas, bloqueos por lluvia o feriado, reportes de ocupación, equipo con roles y una página pública para compartir turnos libres.
- **Administración**: alta de clubes e invitación a sus dueños, usuarios y roles, pausa y lista de acceso del piloto, bandeja de clubes interesados y auditoría.

## Stack

| Capa | Tecnología |
| --- | --- |
| Frontend | React 19, Vite, TypeScript, Tailwind, React Query, React Router |
| Backend | Supabase: PostgreSQL con RLS, funciones RPC, Auth, Storage y Edge Functions (Deno) |
| Pruebas | Vitest + Testing Library; PGlite (PostgreSQL en WASM) para probar migraciones, permisos y RPC |
| Deploy | Vercel (frontend) + Supabase |

## Empezar en 2 minutos (sin Docker ni cuenta de Supabase)

```bash
npm ci
```

```bash
npm run dev:local
```

Levanta un **Supabase local** (PostgreSQL real con las mismas migraciones, RLS y permisos que producción) con datos de ejemplo, y la app en http://localhost:5173. Contraseña de todas las cuentas de ejemplo: `voley1234`.

| Cuenta | Para probar |
| --- | --- |
| `club@voley.local` | Dueña de Club Demo Sur: agenda, clientes, fijos, caja, reportes y ajustes |
| `encargado@voley.local` | Encargado del mismo club (sin caja, reportes ni ajustes) |
| `costanera@voley.local` | Dueño de un club con confirmación automática |
| `ana@voley.local`, `beto@voley.local`, `caro@voley.local`, `dani@voley.local` | Jugadores habilitados |
| `admin@voley.local` | Administración global |

`npm run dev:local -- --reset` recrea la base con los datos de ejemplo. Los emails de recuperación de contraseña se imprimen en la consola.

> `npm run dev` usa las variables de `.env.local` (copiá `.env.example`) y se conecta al proyecto de Supabase configurado: si apunta a producción, todo lo que hagas es real.

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev:local` | App + Supabase local con datos de ejemplo |
| `npm run dev` | App contra el Supabase de `.env.local` |
| `npm run lint` | ESLint + TypeScript (app, pruebas y scripts) |
| `npm test` | Todas las pruebas |
| `npm run test:unit` | Pruebas del frontend (utilidades y componentes) |
| `npm run test:db` | Reconstruye la base desde cero y prueba permisos, RLS y RPC |
| `npm run build` | Valida la configuración y genera `dist/` |

## Estructura

```text
src/
  api/          Acceso a datos tipado (RPC de Supabase) y hooks de React Query
  components/   UI base accesible y layout
  contexts/     Sesión y perfil
  features/     Componentes por área (agenda, clientes, fijos, caja, reportes, ajustes, jugador, partidos, admin)
  lib/          Utilidades: fechas en hora de Argentina, teléfonos/WhatsApp, CSV, calendario
  pages/        Una página por ruta (gestion/ = panel del club, admin/ = administración)
supabase/
  migrations/   Historial completo de la base (reproducible desde cero)
  functions/    Edge Functions: submit-club-lead, enviar-notificaciones
  preflight/    Chequeos de solo lectura para correr antes de migrar producción
scripts/        Supabase local (servidor + datos de ejemplo) y validación de entorno
tests/db/       Pruebas de la base sobre PGlite
docs/           Arquitectura, runbook, guía para clubes, plan de mejoras
```

## Documentación

- [Arquitectura](docs/arquitectura.md): modelo de datos, estados, seguridad y catálogo de RPC.
- [Runbook del piloto](docs/runbook-piloto.md): cómo desplegar, migrar producción, configurar Auth, emails y tareas programadas.
- [Estado del piloto](docs/estado-piloto.md): qué está listo y qué falta.
- [Guía para clubes](docs/guia-club.md): cómo usar el panel del club.
- [Guía del frontend](docs/frontend.md): convenciones para desarrollar.
- [Plan de mejoras](docs/plan-mejoras.md): diagnóstico y hoja de ruta.

## Seguridad

Toda escritura y toda lectura de datos operativos pasa por funciones RPC que validan el rol en el servidor (`SECURITY DEFINER`, `search_path` vacío, permisos explícitos). Las tablas tienen RLS y la API está cerrada por defecto: anónimos solo leen el catálogo público y ejecutan 7 RPC de consulta. Las pruebas de `tests/db` verifican esas garantías en cada cambio.
