# Runbook del piloto

Cómo llevar a producción los cambios de octubre 2026 y operar el piloto. Los comandos usan la CLI de Supabase con `npx` (no hace falta instalarla).

## Antes de empezar

- Tener acceso al proyecto de Supabase (`project ref` y contraseña de la base) y al proyecto de Vercel.
- Recomendado: plan pago de Supabase antes de tener clubes reales. Revisá las condiciones vigentes del plan Free sobre pausa por inactividad y copias de seguridad.
- Probar todo antes en `npm run dev:local`, y si es posible en un segundo proyecto de Supabase de staging con los mismos pasos.

```bash
npx supabase login
```

```bash
npx supabase link --project-ref TU_PROJECT_REF
```

## Respaldo (siempre antes de migrar)

Esquema, datos y roles por separado. Guardalos cifrados y fuera del repositorio: contienen datos personales.

```bash
npx supabase db dump --linked -f respaldo_esquema.sql
```

```bash
npx supabase db dump --linked --data-only -f respaldo_datos.sql
```

```bash
npx supabase db dump --linked --role-only -f respaldo_roles.sql
```

## Registrar en el historial los pasos que ya existían

El repositorio incluye tres migraciones que reconstruyen lo que se hizo a mano en el panel (esquema original y dos pasos intermedios). En producción ya están aplicadas: se registran sin ejecutarlas.

```bash
npx supabase migration repair --status applied 20260527000000 20260605183700 20260605224900
```

## Fase A: cierre de seguridad urgente (aplicar cuanto antes)

`20261001120000_cierre_seguridad_urgente.sql` cierra agujeros que hoy están abiertos en producción y es compatible con el frontend publicado:

- anónimos podían modificar y borrar clubes a través de la vista `clubes_publicos`;
- cualquier usuario podía bloquear u ocupar turnos de cualquier club;
- era posible entrar a partidos privados, crear perfiles con rol de admin y autopromoverse;
- el formulario de clubes salteaba el límite de envíos.

Pasos:

1. Hacer el respaldo.
2. En Supabase → SQL Editor, pegar y ejecutar el contenido de `supabase/migrations/20261001120000_cierre_seguridad_urgente.sql`.
3. Registrarla como aplicada:

```bash
npx supabase migration repair --status applied 20261001120000
```

4. Verificar en la app publicada que el catálogo y el panel de administración siguen cargando.

## Fase B: modelo v2 y frontend nuevo (en una misma ventana)

Las migraciones `20261001130000` a `20261001130600` reemplazan las funciones anteriores, así que el frontend nuevo y la base se actualizan juntos.

1. Hacer el respaldo.
2. Correr el chequeo previo (solo lectura) en el SQL Editor: `supabase/preflight/antes_del_modelo_v2.sql`. Revisar qué se va a normalizar u omitir, qué funciones o vistas creadas a mano quedarán cerradas y quién es dueño de PostGIS.
3. Aplicar las migraciones:

```bash
npx supabase db push
```

4. Revisar `private.migracion_omitidos` (turnos que no se pudieron trasladar) en el SQL Editor.
5. Desplegar el frontend en Vercel desde `main` (variables abajo). La variable `VITE_PILOT_BOOKINGS_ENABLED` ya no se usa: borrala.
6. Ingresar como admin global y revisar Administración → Resumen y Clubes.

Las reservas de jugadores quedan **pausadas** al terminar la migración (`app_config`). Los clubes operan su agenda igual. Se habilitan desde Administración → Operación.

### Vuelta atrás

La migración no borra datos: las tablas anteriores quedan intactas. Si la verificación inmediata falla, restaurá el respaldo del paso 1 (se pierde lo hecho después) y volvé a publicar el deploy anterior de Vercel. No borres tablas nuevas que ya tengan datos.

## Variables del frontend (Vercel)

| Variable | Valor |
| --- | --- |
| `VITE_SUPABASE_URL` | URL HTTPS del proyecto |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave publicable/anon (nunca `service_role` ni `sb_secret_`) |
| `VITE_SENTRY_DSN` | Opcional |
| `VITE_CLUB_LEADS_ENABLED` | `true` después de desplegar `submit-club-lead` |
| `VITE_CONTACT_WHATSAPP` | Opcional, dígitos internacionales |

Las vistas previas de Vercel no deben apuntar a producción. Si Supabase usa un dominio propio, agregalo a la política de contenido (`connect-src` e `img-src`) de `vercel.json`.

## Edge Functions

```bash
npx supabase functions deploy submit-club-lead
```

```bash
npx supabase functions deploy enviar-notificaciones
```

Secretos (Supabase → Edge Functions → Secrets, o `npx supabase secrets set NOMBRE=valor`):

| Secreto | Para qué |
| --- | --- |
| `CLUB_LEAD_RATE_LIMIT_SALT` | Sal aleatoria para el límite del formulario de clubes |
| `SITIO_URL` | URL pública de la app (restringe el origen del formulario y arma los enlaces de los emails) |
| `RESEND_API_KEY` | Clave de Resend |
| `EMAIL_REMITENTE` | Ej. `VoleyApp <avisos@tudominio.com>`, con el dominio verificado en Resend |
| `ENVIOS_SECRETO` | Secreto largo y aleatorio compartido con el job de envíos |

## Tareas programadas y envío de emails

En Database → Extensions habilitar `pg_cron` y `pg_net`. Si `pg_cron` ya estaba habilitado al migrar, los jobs `voleyapp-tareas` (cada 5 minutos) y `voleyapp-fijos` (diario) quedaron creados. Si no, crearlos así:

```sql
select cron.schedule('voleyapp-tareas', '*/5 * * * *', 'select private.procesar_tareas()');
select cron.schedule('voleyapp-fijos', '15 6 * * *', 'select private.materializar_series()');
```

Job de emails (reemplazá el project ref y usá el mismo valor que `ENVIOS_SECRETO`):

```sql
select vault.create_secret('VALOR_DE_ENVIOS_SECRETO', 'envios_secreto');

select cron.schedule('voleyapp-emails', '* * * * *', $$
  select net.http_post(
    url := 'https://TU_PROJECT_REF.supabase.co/functions/v1/enviar-notificaciones',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-envios-secreto', (select decrypted_secret from vault.decrypted_secrets where name = 'envios_secreto')
    ),
    body := '{}'::jsonb
  )
$$);
```

Sin pg_cron, los pedidos igual vencen al operar y el admin puede correr las tareas desde Administración → Resumen.

## Auth

En Authentication → URL Configuration:

- Site URL: `https://tudominio`.
- Redirect URLs: `https://tudominio/**`.

En Authentication → Providers → Email:

- Confirm email: activado.
- Contraseña mínima: 8.
- Protección de contraseñas filtradas: activada, si el plan lo permite.

En Authentication → SMTP Settings, configurar Resend (host `smtp.resend.com`, puerto 465, usuario `resend`, contraseña = API key) con el remitente verificado. Las plantillas en español están en `supabase/templates/`: pegarlas en Authentication → Email Templates.

## Primeros pasos operativos

1. Administración → Clubes: crear el club y tocar "Invitar dueño". El enlace se manda por WhatsApp; la persona entra con ese email (confirmado) y acepta.
2. El dueño completa Ajustes: datos públicos, WhatsApp, alias para transferencias, canchas (fotos), horarios publicados, políticas y equipo. Después publica el club.
3. El dueño carga sus fijos (o los importa desde Excel) y empieza a anotar en la agenda lo que llega por WhatsApp.
4. Administración → Usuarios: habilitar el acceso al piloto de los jugadores invitados.
5. Administración → Operación: quitar la pausa cuando los clubes estén listos.

Los pagos y devoluciones se registran como externos: VoleyApp no cobra ni reintegra dinero. Antes del alta abierta hay que publicar términos y aviso de privacidad con la identidad del responsable de los datos (Ley 25.326).

## Incidentes

1. Administración → Operación: pausar las reservas de jugadores. Los clubes siguen operando.
2. Preservar logs (Supabase → Logs) y no borrar datos.
3. Revisar la auditoría (Administración → Auditoría) y, si corresponde, restaurar desde el respaldo.
4. Reanudar solo después de verificar disponibilidad y permisos.

## Métricas del piloto

Revisar cada semana:

- Porcentaje de la ocupación real de cada club cargada en la agenda.
- Pedidos de la app y su tiempo de respuesta.
- Pedidos vencidos sin respuesta.
- Deuda de fijos al cierre de la semana.
- Cancelaciones tardías y "no vinieron".
- Partidos realizados y uso semanal del dueño y del encargado.

Fuentes: Administración → Resumen y Reportes de cada club.
