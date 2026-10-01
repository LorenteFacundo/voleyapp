# Estado del piloto

Actualizado el 1 de octubre de 2026.

## Resumen

- **Repositorio**: modelo v2 completo (agenda única del club, fijos, clientes, caja, reportes, equipo, partidos, administración del piloto) con frontend nuevo. La base se reconstruye desde cero y se prueba en cada cambio (`npm run test:db`).
- **Producción**: sigue con el esquema anterior más las migraciones del piloto de septiembre. **Nada de lo nuevo está aplicado.** Producción tiene agujeros abiertos que cierra la migración urgente (ver abajo).

## Agujeros abiertos en producción

Confirmados reconstruyendo la base actual desde el historial de migraciones:

| Problema | Riesgo |
| --- | --- |
| La vista `clubes_publicos` corre con permisos de su dueño y acepta escrituras | Cualquier visitante sin cuenta puede modificar o borrar clubes |
| `reservar_turno_rango` y otras RPC anteriores siguen ejecutables | Cualquier usuario puede ocupar o bloquear turnos de cualquier club |
| `unirse_a_partido` no controla la visibilidad | Se puede entrar a partidos privados |
| Política de alta de perfiles y columna `rol` | Se puede crear un perfil con rol de administración |
| `admin_actualizar_rol` | Un admin se puede autopromover a superadmin |
| Inserción directa en `solicitudes_club` | El formulario de clubes saltea el límite de envíos |

`VITE_PILOT_BOOKINGS_ENABLED=false` solo escondía botones: no frena nada de esto. La migración `20261001120000_cierre_seguridad_urgente.sql` lo cierra, es compatible con el frontend publicado y se puede aplicar sola (runbook, Fase A).

## Para salir: pasos en orden

| Paso | Qué | Dónde |
| --- | --- | --- |
| 1 | Respaldo y migración urgente | [Runbook](runbook-piloto.md), Fase A |
| 2 | Plan de Supabase con copias de seguridad (recomendado) y, si se puede, proyecto de staging | Panel de Supabase |
| 3 | Dominio propio verificado en Resend (emails de Auth y avisos) | Resend + DNS |
| 4 | Chequeo previo, `db push` del modelo v2 y deploy del frontend en la misma ventana | Runbook, Fase B |
| 5 | Edge Functions, secretos, Auth (URLs, confirmación, SMTP, plantillas) y tareas programadas | Runbook |
| 6 | Términos y aviso de privacidad con el responsable de los datos (Ley 25.326) | Texto legal propio |
| 7 | Alta de clubes, invitación a sus dueños, carga de fijos y clientes | Administración y [guía para clubes](guia-club.md) |
| 8 | Habilitar a los jugadores invitados y quitar la pausa | Administración → Usuarios y Operación |

## Qué está listo en el repositorio

**Base de datos**

- Una sola tabla de ocupaciones (reservas de la app, cargas del club, fijos y bloqueos) con restricción de exclusión: no puede haber dos ocupaciones superpuestas en una cancha, ni con pedidos simultáneos.
- Fijos semanales que generan sus fechas 12 semanas adelante, con cambios a futuro, fechas salteadas y aviso de choques.
- Pagos y devoluciones como registro contable, saldo por cliente, deudas y caja.
- Equipo del club con roles (dueño y encargado) e invitaciones con token de un solo uso.
- Partidos con cupo, nivel, visibilidad pública o por enlace, aprobación, chat, transferencia de organización, cierre automático, puntos y logros.
- Avisos en la app y cola de emails con reintentos e idempotencia.
- Pausa global de reservas, lista de acceso del piloto, auditoría y límites por persona.
- Migración de datos anteriores (clubes, canchas, horarios, reservas, partidos), dejando registro de lo que no se pudo trasladar.

**Club**: agenda por día y semana, carga en segundos de lo que llega por WhatsApp, pedidos de la app, bloqueos, cobros, clientes con saldo e importación desde Excel/CSV, fijos, caja, deudas, reportes, ajustes (datos, canchas con fotos, horarios, políticas, equipo) y mensaje para compartir los turnos libres.

**Jugadores**: catálogo y mapa de clubes, página pública de cada club, pedido de cancha, mis reservas con aviso de pago, partidos (crear, explorar, unirse, chat, invitar por enlace), perfil, logros y ranking.

**Administración**: resumen, clubes (alta e invitación al dueño), usuarios y roles, operación (pausa y lista de acceso), clubes interesados y auditoría.

**Calidad**: pruebas de base sobre PostgreSQL (migraciones desde cero, permisos de cada rol, RLS, aislamiento entre clubes, concurrencia y migración de datos), pruebas del frontend, ESLint con reglas de accesibilidad, TypeScript estricto, CI con auditoría de dependencias y cabeceras de seguridad en Vercel.

## Decisiones

- **Pagos externos**: la app registra cobros y devoluciones; no procesa dinero.
- **WhatsApp por enlace** (`wa.me` con el mensaje armado): sin API de WhatsApp Business ni costos por mensaje.
- **Confirmación manual por defecto**: hasta que el club cargue toda su ocupación en la agenda, cada pedido de la app lo confirma una persona. La confirmación automática se activa por club.
- **Reservas pausadas al migrar**: los clubes empiezan a operar su agenda antes de abrir pedidos de jugadores.
- **Coordenadas planas**: el mapa y la búsqueda ya no dependen de PostGIS.

## Riesgos y límites conocidos

- Si un club no carga en la agenda lo que llega por WhatsApp, la app puede ofrecer un horario que ya está tomado. La confirmación manual lo frena; el reporte de ocupación ayuda a medir cuánto se carga.
- PostGIS sigue instalado en `public`. La migración le quita los permisos a `anon` y `authenticated`, pero el linter de Supabase puede seguir marcando `spatial_ref_sys`. Moverlo de esquema implica recrear la extensión y no es necesario.
- Sin `pg_cron`, los pedidos vencen igual al operar, pero los recordatorios y el cierre de partidos dependen de que el admin corra las tareas a mano.
- Sin dominio en Resend, Auth usa el remitente de prueba de Supabase (pocos emails por hora) y los avisos quedan solo en la app.
- El Supabase local (`npm run dev:local`) emula un subconjunto de la API. La configuración real (Auth, SMTP, Storage, cron) se valida en staging o en producción después del respaldo.

## Lo aplicado antes en producción

| Versión | Migración | Efecto |
| --- | --- | --- |
| `20260929120415` | `pilot_club_leads` | Bandeja privada de consultas de clubes |
| `20260929120514` | `pilot_lock_profile_fields` | Impide editar rol y otros campos sensibles desde el perfil |
| `20260929120545` | `pilot_guard_admin_users` | Protege el listado de usuarios con admin global |
| `20260929120608` | `pilot_hide_public_emails` | Oculta emails en lectura pública |
| `20260929120732` | `pilot_no_occupied_overlap` | Valida rangos y evita superponer horarios ocupados |
| `20260929142952` | `narrow_club_lead_insert` | Limita el formulario público a sus campos |
| `20260929143010` | `guard_admin_listings` | Protege las listas administrativas y quita ejecución anónima |
| `20260929145019` | `restrict_core_table_access` | Cierra escrituras directas y limita lectura de reservas |
| `20260929145033` | `restrict_internal_rpc` | Revoca RPC internos o sensibles a clientes no autorizados |

Antes de esas migraciones la base tenía 1 club, 2 canchas, 3 reservas, 2 partidos y 4 usuarios. Los borradores que no se aplicaron (agenda, partidos y operaciones del piloto) quedaron como referencia en `supabase/legacy-snapshots/borradores-piloto/`: el modelo v2 los reemplaza.
