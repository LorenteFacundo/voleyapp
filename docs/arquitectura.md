# Arquitectura

## Visión general

```text
React (Vercel) ──► Supabase
                    ├─ Auth (email + contraseña)
                    ├─ PostgREST: RPC públicas en el esquema public + lectura del catálogo
                    ├─ PostgreSQL: tablas con RLS, lógica en funciones SECURITY DEFINER
                    ├─ Storage: bucket canchas-fotos (carpeta club-<id>/ por club)
                    ├─ pg_cron: vencimientos, recordatorios, cierre de partidos, fijos
                    └─ Edge Functions: submit-club-lead (formulario de clubes), enviar-notificaciones (emails)
```

La interfaz nunca escribe tablas directamente: llama funciones RPC que validan quién es la persona, su rol en el club y las reglas del negocio dentro de una transacción. El catálogo público (clubes publicados, canchas activas y sus horarios) se lee directo, con columnas acotadas.

## Modelo de datos

```text
usuarios ──< club_miembros >── clubes ──< canchas ──< horarios_semanales
                  (dueno|encargado)  │         │
                                     │         └──< ocupaciones >── clientes_club
                                     │               │    │  └── series (fijos)
                                     ├──< clientes_club   │  └──< pagos
                                     ├──< series          └── partidos ──< participantes_partido
                                     ├──< pagos                   └──< mensajes_partido
                                     └──< auditoria
usuarios ──< notificaciones ──< envios_notificacion (cola de emails)
app_config (pausa y lista de acceso) · acceso_piloto · club_invitaciones · solicitudes_club
```

| Tabla | Qué guarda |
| --- | --- |
| `clubes` | Datos públicos, alias para transferencias, políticas (confirmación automática, anticipación mínima, ventana de reserva, plazo de cancelación, tiempo de respuesta) y si está publicado |
| `canchas` | Canchas del club: precio de referencia, seña, techada, superficie, fotos, activa |
| `horarios_semanales` | Plantilla de bloques que los jugadores pueden pedir (por día de semana). Si `hora_fin <= hora_inicio` el bloque termina al día siguiente |
| `ocupaciones` | **Única fuente de ocupación**: reservas de la app, cargas del club (WhatsApp, teléfono, mostrador), fechas de fijos y bloqueos. Período `[inicio, fin)` en `timestamptz` |
| `series` | Alquileres fijos semanales. Sus fechas se materializan como ocupaciones hasta 12 semanas adelante (`serie_fecha` identifica cada fecha aunque se mueva) |
| `clientes_club` | Agenda de contactos de cada club (incluye a los jugadores de la app que reservaron allí) |
| `pagos` | Cobros y devoluciones (montos negativos). `ocupaciones.pagado` se mantiene por trigger |
| `club_miembros` / `club_invitaciones` | Equipo del club. Las invitaciones guardan solo el hash del token, vencen a los 7 días y se aceptan con el email invitado y confirmado |
| `partidos` / `participantes_partido` | Capa social sobre una ocupación: cupo, nivel, visibilidad (pública o por enlace), aprobación, chat |
| `notificaciones` / `envios_notificacion` | Avisos en la app y cola de emails con reintentos |
| `auditoria` | Quién hizo qué en cada club (y en la administración) |
| `app_config` / `acceso_piloto` | Pausa global de reservas de jugadores y lista de acceso del piloto |

Las tablas anteriores (`disponibilidad_turnos`, `reservas`, `administradores_club`) conservan sus datos pero no están expuestas.

### Garantías en la base

- **Sin superposiciones**: restricción de exclusión `EXCLUDE USING gist (cancha_id WITH =, tstzrange(inicio, fin) WITH &&) WHERE estado IN ('pendiente','confirmada')`. Funciona aunque dos personas pidan el mismo horario al mismo tiempo.
- **Coherencia entre club, cancha, cliente, serie y pago**: claves foráneas compuestas `(id, club_id)`; un cliente de un club no puede quedar en una reserva de otro.
- **Cupo de partidos**: la inscripción bloquea la fila del partido (`FOR UPDATE`) y cuenta confirmados, pendientes e invitados.
- **Límites por persona**: hasta 3 pedidos sin respuesta, 4 reservas activas desde la app y 8 pedidos por día (serializados con un lock por usuario).

### Estados

```text
Ocupación (reserva):  pendiente ──club confirma──► confirmada ──► (se juega)
                         │  └──club rechaza──► rechazada
                         ├──vence sin respuesta──► vencida
                         └──cancela el jugador──► cancelada ◄── cancela el club / bloqueo
Partido:  borrador (cancha pedida) ──► abierto (cancha confirmada) ──► finalizado (después de jugarse)
             └──────────────► cancelado (si la reserva se cancela, rechaza o vence)
Pago (derivado): pendiente · parcial · pagado · sin_cargo · a_devolver (cancelada con plata cobrada)
```

## Seguridad

- **RLS en todas las tablas**. Las operativas no tienen políticas para `anon` ni `authenticated`: solo se accede por RPC.
- **RPC `SECURITY DEFINER` con `search_path = ''`** y nombres calificados. Cada una valida sesión, rol en el club (`private.exigir_staff`) o administración global (`private.exigir_admin_global`).
- **Permisos explícitos**: cada función se concede a quien corresponde (`anon`, `authenticated` o `service_role`). Las funciones y tablas nuevas quedan cerradas por defecto (privilegios por defecto revocados, incluido el `EXECUTE` de `PUBLIC`).
- **Anónimos** ejecutan solo: `estado_operacion`, `disponibilidad`, `explorar_partidos`, `partido_detalle`, `buscar_partido_por_token`, `ranking`, `ver_invitacion_club`.
- **Esquema `private`**: helpers internos, no expuestos por la API.
- **Datos personales**: emails y teléfonos solo los ve el club donde la persona reservó y la administración; en vistas públicas se muestra el nombre (nunca el email).
- **Piloto**: la pausa y la lista de acceso se aplican en el servidor (`private.exigir_puede_reservar`), no en la interfaz.
- **Auditoría**: las RPC del club y de administración registran acciones sensibles.

Las pruebas `tests/db/v2-seguridad.test.ts` y `tests/db/v2-revision.test.ts` verifican estas reglas (qué ejecuta `anon`, RLS activo, `search_path` fijo, aislamiento entre clubes y roles).

## Catálogo de RPC

| Grupo | Funciones | Quién |
| --- | --- | --- |
| Público | `estado_operacion`, `disponibilidad`, `explorar_partidos`, `partido_detalle`, `buscar_partido_por_token`, `ranking`, `ver_invitacion_club` | Cualquiera |
| Perfil | `mi_perfil`, `actualizar_mi_perfil`, `mis_logros` | Con sesión |
| Reservas | `solicitar_reserva`, `cancelar_mi_reserva`, `informar_pago`, `mis_reservas` | Con sesión (pedir: piloto habilitado) |
| Partidos | `partido_unirse`, `partido_salir`, `partido_resolver_inscripcion`, `partido_transferir`, `partido_actualizar`, `partido_cancelar`, `mis_partidos`, `enviar_mensaje`, `mensajes_partido` | Con sesión (cada una valida organizador o participante) |
| Notificaciones | `mis_notificaciones`, `notificaciones_sin_leer`, `marcar_notificacion_leida`, `marcar_todas_leidas` | Con sesión |
| Equipo | `aceptar_invitacion_club` | Con sesión y email confirmado |
| Club | `club_panel`, `club_agenda`, `club_pendientes`, `club_crear_reserva`, `club_conflictos`, `club_bloquear`, `club_resolver_solicitud`, `club_cancelar_ocupacion`, `club_mover_ocupacion`, `club_actualizar_ocupacion`, `club_registrar_pago`, `club_deudas`, `club_clientes`, `club_guardar_cliente`, `club_archivar_cliente`, `club_cliente_detalle`, `club_series`, `club_previsualizar_serie`, `club_crear_serie`, `club_modificar_serie`, `club_finalizar_serie`, `club_publicar_partido` | Dueño o encargado del club |
| Club (dueño) | `club_anular_pago`, `club_caja`, `club_reporte`, `club_auditoria`, `club_actualizar`, `club_guardar_cancha`, `club_guardar_horarios`, `club_equipo`, `club_invitar`, `club_revocar_invitacion`, `club_cambiar_miembro` | Dueño del club |
| Administración | `admin_resumen`, `admin_clubes`, `admin_crear_club`, `admin_usuarios`, `admin_actualizar_rol`, `admin_configurar_operacion`, `admin_definir_acceso`, `admin_auditoria`, `admin_ejecutar_tareas` | Admin global (actúa como dueño de cualquier club) |
| Sistema | `sistema_tomar_envios`, `sistema_resultado_envio`, `captacion_registrar_intento` | Solo `service_role` (Edge Functions) |

## Tareas programadas

`pg_cron` ejecuta (si la extensión está habilitada; si no, el admin puede correrlas desde su panel):

- Cada 5 minutos `private.procesar_tareas()`: vence pedidos sin respuesta (también se vencen al operar), cierra partidos ya jugados (puntos, partidos jugados, logros) y encola recordatorios del día anterior.
- Todos los días `private.materializar_series()`: genera las fechas de los fijos que entran en el horizonte de 12 semanas y avisa al club si alguna choca.
- Emails: un job llama a la Edge Function `enviar-notificaciones` cada minuto (ver runbook).

## Fechas y horas

Todo se guarda en `timestamptz`. Las fechas de pared se interpretan en `America/Argentina/Buenos_Aires` (`private.instante_ar`, `private.hoy_ar` y `src/lib/date.ts`). Los bloques que cruzan la medianoche terminan al día siguiente.

## Entorno local

`npm run dev:local` levanta `scripts/supabase-local/servidor.ts`: PGlite con las migraciones, más una emulación de PostgREST (RPC, lecturas con embebidos, filtros y orden), Auth (registro, login, refresco, recuperación) y Storage. Sirve para desarrollar y para demos; no reemplaza un proyecto de staging para validar la configuración real de Supabase.
