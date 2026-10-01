# Estado de preparación del piloto

## Alcance

Primer piloto en Zona Sur y Capital Federal. Jugadores pueden descubrir canchas y partidos; los clubes reciben solicitudes y confirman desde una agenda propia. Los pagos se registran como externos. El formulario público capta clubes interesados.

## Estado actual

- La landing está en `/` y la app en `/app`. Se agregaron agenda semanal, reservas manuales, alquileres fijos, excepciones y cambio futuro de series, asignación de administradores, solicitudes de clubes y vistas de “Mis reservas”.
- La agenda permite bloquear y reabrir un bloque publicado en el borrador SQL. Se retiraron del panel global y del cliente las acciones heredadas que borraban clubes, canchas, turnos o reservas; su revocación en la base sigue pendiente y no protege el backend hasta aplicar una migración revisada.
- Una consulta ACL de solo lectura a la base actual confirmó `EXECUTE` para `authenticated` en RPC heredadas de reservas/partidos y de borrado administrativo. `VITE_PILOT_BOOKINGS_ENABLED=false` solo apaga la interfaz; no es un freno del servidor. No abrir el piloto ni considerar segura la pausa hasta revisar y aplicar controles server-side de forma aprobada.
- La revisión de funciones encontró que `admin_actualizar_rol` permite que el administrador global se cambie su propio rol a `superadmin`, y que tres helpers de notificaciones `SECURITY DEFINER` aceptaban llamadas anónimas. El borrador pending-only prepara el cierre de esas rutas, impide el auto-cambio de rol, y la interfaz ya oculta acciones no permitidas según el rol; nada de esto protege producción hasta revisión y aplicación de la migración.
- `VITE_PILOT_BOOKINGS_ENABLED` se mantiene en `false`. Los SQL de agenda, partidos y operaciones siguen pendientes: `supabase/pilot_agenda_pending.sql`, `supabase/pilot_partidos_pending.sql` y `supabase/pending-migrations/20260929184629_pilot_access_and_operations.sql`. Este último se movió fuera de `supabase/migrations/` porque no fue aplicado ni superó la revisión.
- La migración integral de agenda fue rechazada por la revisión de seguridad de Supabase por combinar tablas, permisos, trigger y funciones `SECURITY DEFINER` sin una revisión aislada previa. No aplicar esos borradores con CLI ni dividirlos para eludir esa decisión. Requieren revisión posterior en un entorno aislado.
- No se ejecutó una copia de seguridad manual ni se verificó una restauración. El proyecto actual es Free y no admite ramas de base de datos. El usuario indicó trabajar sobre `main`; no se aplicaron las migraciones de agenda a la base principal. El cambio de agenda pendiente es aditivo; no se deben eliminar sus tablas si se habilita y comienza a guardar datos.
- Se recuperaron al repositorio las 28 migraciones históricas desde el ledger remoto y se conservaron los antiguos snapshots bajo `supabase/legacy-snapshots/`. La reconstrucción desde cero todavía no se verificó, porque no hay Docker/stack local ni un entorno de prueba independiente.

## Cambios ya aplicados en Supabase

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
| `20260929145033` | `restrict_internal_rpc` | Revoca RPC internos/sensibles a clientes no autorizados |

Al revisar el estado antes de la migración pendiente, la base conservaba 1 club, 2 canchas, 3 reservas, 2 partidos y 4 usuarios; no había rangos inválidos ni superposiciones ocupadas. La migración rechazada no se ejecutó.

## Configuración necesaria para publicar

- Completar `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` en el entorno de despliegue. No subir secretos al repositorio.
- Mantener `VITE_PILOT_BOOKINGS_ENABLED=false` hasta resolver las migraciones pendientes y validar los recorridos con cuentas de jugador, administrador de club y administrador global.
- `VITE_CONTACT_WHATSAPP` queda vacío hasta recibir el número real. El botón de WhatsApp no aparece con valor vacío.
- Agregar el dominio final a los redirect URLs de Supabase Auth; se necesita el dominio de despliegue para configurar recuperación de contraseña.
- `VITE_CLUB_LEADS_ENABLED` está apagado por defecto. La Edge Function de captación y su RPC de rate limiting están preparados en el repositorio, pero todavía no fueron desplegados ni probados en Supabase.
- `VITE_SENTRY_DSN` es opcional y se configura por entorno. La integración desactiva datos de usuario, cookies, headers, cuerpos, parámetros y breadcrumbs; no se habilita session replay.
- Se agregaron la validación de configuración previa al build, cabeceras de seguridad para Vercel, una pantalla 404 y el retorno al horario/acción elegidos después de iniciar sesión.
- Las fechas visibles y calculadas usan `America/Argentina/Buenos_Aires`. Las dos pantallas de reserva solicitan el bloque horario publicado completo, igual que la validación del servidor.
- El archivo local `.env` se conserva intacto, pero se quitó del seguimiento de Git y se agregó a `.gitignore`.

## Verificación y riesgos pendientes

- Pasan `npm test` (3 pruebas de fechas), `npm run lint`, `npm run build`, `npm run validate:env` y `npm audit --audit-level=low` (sin vulnerabilidades reportadas). CI ejecuta auditoría, prueba unitaria, tipos y build.
- En navegador local se verificó la landing, `/app` y que `/agenda` redirige a `/app` sin sesión; no se crearon cuentas ni se modificó la base. También se habían recorrido `/canchas`, `/partidos`, `/perfil` y una ruta inexistente en viewport móvil. No se probaron operaciones autenticadas ni el panel con rol de club por falta de un entorno aislado y cuentas piloto.
- El advisor de Supabase todavía informa: `spatial_ref_sys` sin RLS por PostGIS en `public` (error del linter), 27 funciones con `search_path` mutable, 9 funciones `SECURITY DEFINER` invocables por `anon`, 36 por `authenticated` y protección de contraseñas filtradas desactivada. Revisar cada función con su uso antes de cambiar permisos globalmente.
- La corrección pendiente usa `search_path = ''`, referencias calificadas y grants explícitos según la guía actual de Supabase. Sigue sin ejecutarse una prueba SQL aislada de sintaxis, permisos y regresión porque no hay base local ni proyecto de prueba aprobado.
- [Guía Supabase sobre RLS en tablas expuestas](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public), [funciones con search_path mutable](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [funciones SECURITY DEFINER accesibles por anon](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [funciones SECURITY DEFINER accesibles por usuarios autenticados](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [protección de contraseñas filtradas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Ver también el [runbook del piloto](runbook-piloto.md). La activación continúa bloqueada por la falta de respaldo restaurable y prueba de migración, revisión de permisos, remitente de correo verificado, responsables de clubes y decisión sobre `spatial_ref_sys`.
