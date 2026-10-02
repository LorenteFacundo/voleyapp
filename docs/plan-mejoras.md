# Plan de mejoras VoleyApp (octubre 2026)

Análisis completo del repositorio: frontend, migraciones aplicadas, borradores pendientes y Edge Function. No se tocó la base remota. Las afirmaciones sobre "producción" se deducen de `supabase/migrations/`, y varias funciones existen solo en la base viva, así que conviene confirmarlas con una consulta de ACL (sección 5) antes de actuar.

## Estado de avance (1 de octubre de 2026)

Implementado en el repositorio y probado sobre una base reconstruida desde cero. **No está aplicado en producción**: el orden de despliegue está en el [runbook](runbook-piloto.md) y lo que falta, en el [estado del piloto](estado-piloto.md).

| Fase | Estado |
| --- | --- |
| 0. Cerrar y resguardar | Migración urgente lista (`20261001120000`), compatible con el frontend publicado. Falta aplicarla con respaldo previo. |
| 1. Base verificable | Hecho: baseline y reconstrucción de los pasos manuales, base local sin Docker (PGlite), pruebas de autorización por rol para cada RPC, React Query, panel usable desde el celular. Falta: proyecto de staging. |
| 2. Reemplazar el Excel | Hecho: modelo unificado, agenda (grilla, carga rápida, bloqueos, mover), clientes con saldo, fijos con cobro semanal, importación CSV, ajustes autoservicio, compartir turnos libres, roles, avisos al club, manifest para agregar a inicio. |
| 3. Jugadores y cobro | Hecho: pedidos con lista de acceso y pausa, cancelación con plazo del club, aviso de pago por alias, avisos y recordatorios, reportes. Falta: lista de espera. |
| 4. Crecimiento | Hecho: partidos abiertos publicados por el club. Fuera de alcance por ahora: Mercado Pago, WhatsApp Business, clases y torneos. |

Decisiones tomadas para avanzar (sección 8): se rehízo el modelo antes de activar; confirmación manual por defecto y automática opcional por club; cobro por alias con aviso del jugador, sin pagos online. Siguen abiertas el modelo de negocio, el presupuesto y los clubes piloto concretos.

Pendientes de ingeniería: tipos generados con `supabase gen types` (hoy los contratos están en `src/api/tipos.ts`), pruebas end-to-end con Playwright contra staging y un flujo de baja de cuenta (Ley 25.326). Las tablas nuevas ya definen qué pasa al borrar un usuario; falta revisar las anteriores (partidos, participantes, notificaciones).

---

## 1. Resumen

**Lo que está bien:**
- La idea tiene dos patas que se refuerzan: el jugador encuentra cancha y arma partido, y el club ordena su agenda.
- El diseño SQL de la agenda pendiente es sólido en lo esencial: lock por cancha, constraint de exclusión contra superposiciones, hora de Argentina y autorización derivada en el servidor.

**Lo que hay que resolver antes de sumar un solo club:**

1. **Hay 3 agujeros de seguridad abiertos hoy en la base, no en los borradores.** Cualquier usuario logueado puede bloquear turnos de cualquier club o meterse en partidos privados (sección 2.1).
2. **El listado de partidos sin filtros y el detalle de partido probablemente estén rotos.** La migración del 29/9 quitó permisos que las vistas necesitan, y el error se oculta, así que la app muestra "Sin partidos".
3. **El repo no reconstruye la base.** Las tablas base y unas 10 funciones que usa el frontend solo existen en la base viva.
4. **Todo el trabajo del piloto está sin commitear**: 39 archivos modificados y unos 50 nuevos desde junio.
5. **El borrador de agenda falla al aplicarse.** La tabla real `administradores_club` usa `user_id` y el borrador usa `usuario_id`.

**Del lado del club**, la agenda pendiente cubre lo mínimo: solicitudes, reserva externa, fijos, bloqueos y estado de pago. Todavía no le gana al Excel + WhatsApp. Faltan:
- clientes con teléfono;
- cobro semana a semana de los fijos (que son la mayor parte de la plata);
- vista en grilla por cancha;
- carga libre de horarios;
- avisos cuando entra una solicitud;
- que el propio club configure precios y horarios;
- acceso desde el celular.

**Recomendación central:** primero cerrar y resguardar (Fase 0) y dejar una base verificable (Fase 1). Después, enfocar el producto en que **el club gane tiempo desde el día 1 aunque ningún jugador use la app** (Fase 2). Recién ahí empujar a los jugadores y el cobro online.

---

## 2. Lo urgente: seguridad y cosas rotas hoy

### 2.1 Seguridad (estado aplicado)

| # | Severidad | Problema | Dónde | Arreglo |
|---|---|---|---|---|
| S1 | **Alta** | Cualquier usuario autenticado puede ocupar o bloquear cualquier turno, sin dejar registro de reserva. `reservar_turno_rango` acepta `p_estado_final='bloqueado_club'`. `reservar_turno_virtual` y `crear_partido_virtual` insertan ocupaciones en cualquier fecha u hora sin chequear horarios publicados. | [fix_partido_workflow:150](../supabase/migrations/20260531031502_fix_partido_workflow_and_views.sql), grants en [restrict_internal_rpc:31-36](../supabase/migrations/20260929145033_restrict_internal_rpc.sql) | Revocar `EXECUTE` a `authenticated` ya. El frontend no las usa: los wrappers de `lib/admin.ts` están muertos. Buscar también una sobrecarga vieja de 4 argumentos de `reservar_turno_rango`. |
| S2 | **Alta** | `unirse_a_partido` no chequea visibilidad ni token: se entra a partidos privados o "por enlace" probando ids secuenciales. Además el cupo se cuenta sin lock (dos joins simultáneos lo pasan) y no cuenta los invitados anónimos. | [fase2_actualizar_unirse:16-46](../supabase/migrations/20260605225755_fase2_actualizar_unirse_con_notif.sql) | Validar visibilidad y token, `SELECT … FOR UPDATE` sobre el partido y sumar `cantidad_invitados_anonimos`. |
| S3 | Media | Los tokens de invitación estuvieron expuestos públicamente en las vistas (`token_invitacion`). `buscar_partidos` (SECURITY DEFINER, ejecutable por anon) lista partidos `enlace`. | [recreate_partidos_publicos:13,60](../supabase/migrations/20260605183711_recreate_partidos_publicos_with_organizador.sql), [fase1_buscar_partidos](../supabase/migrations/20260605225003_fase1_buscar_partidos.sql) | Rotar todos los tokens no públicos. Revocar `buscar_partidos` a anon o filtrar solo `publico`. |
| S4 | Media | La política INSERT de `usuarios` solo chequea `id = auth.uid()`, así que una cuenta sin fila de perfil puede insertarse con `rol='superadmin'`. Hoy es latente porque el trigger crea la fila. | [bootstrap:86-90](../supabase/migrations/20260527150713_bootstrap_volleyball_app_api.sql) | `revoke insert, delete on usuarios` y borrar la política. Auditar los roles actuales. |
| S5 | Media | `admin_actualizar_rol` permite autopromoverse y no fija `search_path`. | Solo en la base viva | Ya está en el borrador de acceso; aplicarlo. |
| S6 | Media | Anon puede insertar directo en `solicitudes_club` y saltear el rate limit de la Edge Function. | [narrow_club_lead_insert](../supabase/migrations/20260929142952_narrow_club_lead_insert.sql) | Revocar el INSERT (está en el borrador de acceso). |
| S7 | Media | Siguen ejecutables RPC de borrado duro: `admin_cancelar_reserva`, `admin_eliminar_turno` (cascada a partidos y chat) y `admin_guardar_horarios_semanales` (borra todo y reinserta). El borrador revoca solo 4. | Base viva | Revocar todo lo que borra y pasar a soft delete con auditoría. |
| S8 | Baja | `usuarios.rol` es legible por anon, lo que permite enumerar las cuentas admin. | [pilot_hide_public_emails:3](../supabase/migrations/20260929120608_pilot_hide_public_emails.sql) | Quitar `rol` del grant público. |
| S9 | Baja | Unas 27 funciones SECURITY DEFINER sin `search_path`. Además: protección de contraseñas filtradas apagada, sin CSP en `vercel.json` y `spatial_ref_sys` sin RLS. | Varias | `search_path=''` con nombres calificados. Activar la protección en Auth. Agregar CSP. |
| S10 | Verificar | El `config.toml` local tiene registro abierto sin confirmar email. Si el remoto es igual, S1 y S2 son explotables con cuentas descartables. | `supabase/config.toml` | Exigir confirmación de email en el proyecto remoto. |

> La bandera `VITE_PILOT_BOOKINGS_ENABLED=false` solo esconde botones. Ninguno de estos agujeros se frena con ella.

### 2.2 Funcionamiento roto o con bugs

| # | Problema | Dónde | Arreglo |
|---|---|---|---|
| F1 | **Listado sin filtros, detalle de partido y chat fallan con "permission denied".** Las vistas son `security_invoker` y el 29/9 se revocó `SELECT` sobre `partidos` y `participantes`. El error se traga y se muestra "Sin partidos". | [recreate_partidos_publicos:102-103](../supabase/migrations/20260605183711_recreate_partidos_publicos_with_organizador.sql), [restrict_core_table_access:8-9](../supabase/migrations/20260929145019_restrict_core_table_access.sql), [HomePage.tsx:25](../src/pages/HomePage.tsx) | Usar vistas o RPC definer con columnas en lista blanca, como `partidos_explorar` y `pilot_partido_detalle` del borrador. No re-otorgar `SELECT`, porque volvería a exponer tokens. |
| F2 | **Un nombre vacío al registrarse rompe la app.** `''[0].toUpperCase()` tira error en Perfil, Ranking y el muro del partido, y en el muro lo rompe *para todos* los participantes. | [PerfilPage.tsx:93](../src/pages/PerfilPage.tsx), [AuthForm.tsx:81](../src/components/features/AuthForm.tsx), trigger en [bootstrap:50](../supabase/migrations/20260527150713_bootstrap_volleyball_app_api.sql) | Campo requerido, `(nombre?.trim() \|\| fallback).charAt(0)` y `nullif(btrim(..),'')` en el trigger. |
| F3 | `pilot_salir_de_partido` no existe en ningún lado. Con el piloto encendido, nadie puede salir de un partido. | [booking.ts:81](../src/lib/booking.ts) | Escribir la RPC (con sucesor confirmado y liberación del turno). |
| F4 | `administradores_club` tiene `user_id` en la base, pero el borrador y el frontend usan `usuario_id`. La migración de agenda falla y la pestaña de asignación da error. | [tighten_rls:52,66](../supabase/migrations/20260527150855_tighten_rls_helpers_and_admin_club.sql), [pilot_agenda_pending.sql:4-20](../supabase/pilot_agenda_pending.sql), [ClubManagers.tsx:25](../src/components/admin/ClubManagers.tsx) | Usar `user_id` o migrar la columna explícitamente. |
| F5 | `obtener_turnos_disponibles`, `horarios_semanales` y varias `admin_*` no están en las migraciones. Si fallan, la UI muestra "No hay horarios" porque el error no se lee. | [useTurnos.ts](../src/hooks/useTurnos.ts), [CanchaDetailPage.tsx:40](../src/pages/CanchaDetailPage.tsx) | Migración baseline (sección 5) y mostrar los errores. |
| F6 | "Retomar después del login" en `/cancha/:id` nunca funciona. `useTurnos` arranca con `loading=false`, el efecto no encuentra el turno y se descarta. | [useTurnos.ts:10](../src/hooks/useTurnos.ts), [CanchaDetailPage.tsx:54-74](../src/pages/CanchaDetailPage.tsx) | Inicializar `loading` en `true` o usar un flag de "cargado para esta cancha". |
| F7 | Cambiar de pestaña Login/Registro envía el formulario, porque los botones de `Tabs` no tienen `type`. | [Tabs.tsx:13](../src/components/ui/Tabs.tsx), [AuthForm.tsx:72](../src/components/features/AuthForm.tsx) | `type="button"` y roles de tablist. |
| F8 | La geolocalización está bloqueada en producción por `Permissions-Policy: geolocation=()`. "Cercanía" mide en silencio desde el Obelisco. | [vercel.json:9](../vercel.json) | Cambiar a `geolocation=(self)`. |
| F9 | Los turnos de hoy desaparecen después de las 21 h, porque `CURRENT_DATE` está en UTC. A la vez, horarios ya pasados de hoy aparecen como reservables. | vistas de turnos y partidos, [ScheduleBoard.tsx](../src/components/features/ScheduleBoard.tsx) | Usar "hoy" de Argentina en todo el SQL y filtrar horarios ya iniciados. |
| F10 | Nada procesa vencimientos: no hay cron. Las pre-reservas quedan `pre_reservado` para siempre. Cancelar o salir de un partido no libera el turno. Los partidos pasados se listan siempre. | SQL varias | pg_cron para vencimientos, liberar turno al cancelar y filtrar por fecha. |
| F11 | **El panel y la agenda son inaccesibles desde el celular.** El header mobile solo tiene campanita y logout, y la BottomNav no tiene entrada. | [Header.tsx:46](../src/components/layout/Header.tsx), [BottomNav.tsx](../src/components/layout/BottomNav.tsx) | Agregar una pestaña "Club" en la BottomNav para los roles de club. |
| F12 | Agenda: si cambiás de semana rápido, puede mostrarse la semana vieja. Dice "no tenés clubes" mientras carga. Rechazar no pide confirmación, y los botones de confirmar y rechazar miden 24 px y están pegados. | [ClubAgendaPage.tsx:49-61,168](../src/pages/ClubAgendaPage.tsx) | Cancelar requests viejos (TanStack Query), estado de carga, confirmación y botones de 44 px. |
| F13 | En "Mis reservas" el nombre de la cancha nunca aparece: PostgREST devuelve un objeto y el código lo lee como array. | [MisReservasPage.tsx:59](../src/pages/MisReservasPage.tsx) | `canchas?.titulo`. |
| F14 | Cancelar el partido (organizador) y pausar todo el piloto se hacen con un solo toque, sin confirmación. | [MatchDetailPage.tsx:248](../src/pages/MatchDetailPage.tsx), [PilotAccess.tsx:55](../src/components/admin/PilotAccess.tsx) | Agregar diálogo de confirmación. |

### 2.3 Fallas del borrador de agenda (además de F4)

- **Spam de solicitudes.** No hay tope por usuario ni guard de duplicados. Una solicitud pendiente bloquea durante hasta 24 h que el club cargue una reserva manual, un fijo o un bloqueo en ese horario. Arreglo: índice único parcial `(usuario_id, cancha_id, fecha, hora_inicio) where estado='pendiente'` y un máximo de N pendientes por usuario.
- **Cancelar una reserva confirmada deja la `reserva` colgada.** Después ese horario no se puede bloquear ni reabrir nunca más ([pilot_agenda_pending.sql:420-436, 504-506](../supabase/pilot_agenda_pending.sql)).
- **Confirmar una solicitud vencida informa éxito.** Marca la solicitud como `vencida`, devuelve `void` y la UI dice "Reserva confirmada".
- **La reserva manual exige coincidir exacto con un bloque publicado** ([:295-299](../supabase/pilot_agenda_pending.sql)). Cuando el club anota lo que le pidieron por WhatsApp ("de 20:30 a 22"), lo va a rechazar.
- **`pilot_partido_detalle` y la unión aceptan `NULL = NULL` como token válido.** Además `pilot_unirse_a_partido` delega en la función vieja, con la cuenta de cupo mal hecha.
- **Orden de aplicación obligatorio:** acceso → agenda → partidos, cada uno en una transacción. Las funciones de agenda llaman a `pilot_assert_new_booking_allowed`, que se define en acceso.

### 2.4 Infraestructura

- **I1.** Todo el trabajo del piloto está sin commitear. Hay que commitearlo por partes en una rama, hoy.
- **I2.** No hay baseline: la primera migración empieza con `alter table public.usuarios`, así que `supabase db reset` no puede funcionar.
- **I3.** No hay staging ni backups verificados. El proyecto es Free: verificar las condiciones actuales del plan sobre pausa por inactividad y backups antes de tener clubes reales.
- **I4.** Hay 3 tests (fechas) y el "lint" es solo `tsc`. Faltan tests de autorización SQL, que es donde están los riesgos.
- **I5.** Los tipos de `src/types` están escritos a mano y no detectan drift con la base.

---

## 3. El club: cómo trabaja hoy y qué necesita

### 3.1 Cómo opera un club hoy (hipótesis a validar con 3 a 5 clubes)

- **Pedidos:** entran por WhatsApp, a veces por llamada o Instagram. Alguien mira un Excel, un cuaderno o un Google Calendar y responde a mano. Muchas veces son dos personas (dueño y encargado), desde el celular.
- **Ingresos:** en vóley, la mayor parte de la ocupación son **grupos fijos semanales**. Los turnos sueltos rellenan huecos.
- **Cobro:** en efectivo o por transferencia al alias, a veces con seña. El dolor real es **perseguir a los fijos que deben** semanas.
- **Cancelaciones masivas:** lluvia (canchas abiertas y beach), feriados, torneos o clases propias. Hoy se avisa uno por uno.
- **Horarios:** muchos turnos nocturnos terminan a las 00:00 o más tarde.
- **Herramientas:** el club no va a dejar WhatsApp, porque ahí está su relación con los clientes.

**Pregunta para validar:** "¿cuánto tiempo por día pasás contestando WhatsApp y actualizando la planilla, y cuánta plata te deben hoy los fijos?". Esas dos respuestas son el pitch.

### 3.2 Qué cubre la agenda pendiente

Vista semanal en lista por día, solicitudes de la app con confirmar o rechazar, reserva externa, alquiler fijo con excepciones y reprogramación, bloqueo y reapertura, estado de pago (pendiente, seña, pagado) y devolución pendiente.

### 3.3 Brechas frente al Excel + WhatsApp

| Necesidad del club | Hoy | Propuesta |
|---|---|---|
| Ver el día de un vistazo, como en la planilla | Lista por día mezclando canchas | **Grilla canchas × horas** (C1) |
| Anotar rápido lo que llegó por WhatsApp | Formulario sin `min` de fecha. Exige el bloque publicado exacto. Contacto en texto libre. | **Carga rápida** con cualquier horario dentro de la apertura y autocompletado de clientes (C2) |
| Saber quién es cada cliente y escribirle | Email del jugador o texto libre. El perfil no tiene teléfono. | **Directorio de clientes** con teléfono y botón de WhatsApp (C2) |
| Cobrar los fijos semana a semana | El fijo es una regla virtual: no tiene precio ni pago por fecha | **Series materializadas** con cobro y deuda por ocurrencia (C3) |
| Registrar cobros y cerrar la caja | Un select de estado de pago | **Pagos y caja diaria** (C4) |
| Cambiar precios u horarios sin depender de vos | Solo el admin global | **Autoservicio del club** (C5) |
| Enterarse de una solicitud nueva | Tiene que abrir la app, y la solicitud vence en 24 h | **Avisos push y email**, y después WhatsApp (C6) |
| Contestar "¿tenés lugar el jueves?" sin pensar | No existe | **Link público y "copiar turnos libres"** (C7) |
| Pasar su planilla actual | No existe | **Importar CSV/Excel** de fijos y clientes (C8) |
| Suspender por lluvia o feriado | Bloquear de a un horario | **Bloqueo masivo con aviso a los afectados** (C9) |
| Saber cómo le va | No existe | **Reportes de ocupación, ingresos y deuda** (C10) |
| Usarlo desde el celular | El panel no es accesible en mobile | **PWA instalable** con pestaña Club (C11) |
| Turnos hasta la medianoche | `time` y `hora_inicio < hora_fin` impiden 23:00–01:00 | **Rangos `tstzrange`** (sección 3.5) |

### 3.4 Principios de diseño para el lado club

1. **Valor desde el día 1 sin jugadores.** La agenda tiene que convenir aunque el 100 % de las reservas siga entrando por WhatsApp. Los jugadores vienen después.
2. **Más rápido que la planilla:** cargar una reserva en 3 toques o menos, con una mano, desde el celular.
3. **Convivir con WhatsApp en lugar de competir:** links, mensajes pre-armados y click-to-chat (`wa.me`).
4. **El club decide:** confirmación manual o automática, anticipación mínima, política de cancelación y seña.
5. **Pagos sin ficción:** VoleyApp registra lo que el club dice que cobró. No promete reintegros que no controla, en línea con el runbook.

### 3.5 Cambio de modelo de datos recomendado

Hoy la ocupación está repartida en cuatro conceptos que se pisan: `disponibilidad_turnos` (con turnos "virtuales"), `reservas`, `solicitudes_reserva` y `reservas_fijas` (regla sin materializar). Por eso cada RPC repite tres o cuatro chequeos de superposición distintos.

En la base hay 1 club, 3 reservas y 2 partidos, así que **este es el momento más barato para unificar**, antes de activar los borradores (que igual hay que rehacer por F4 y la sección 2.3).

```text
clubes ─┬─ canchas ─── tarifas (día, franja, duración permitida, precio, seña)
        ├─ horarios_apertura / cierres (feriados, mantenimiento)
        ├─ clientes_club (nombre, teléfono, email, usuario_id?, notas, etiquetas)
        ├─ series (fijo | clase | escuelita): cancha, día, hora, precio, cliente, vigencia
        ├─ reservas  ← ÚNICA fuente de ocupación
        │     periodo tstzrange, estado (solicitada|confirmada|cancelada|no_show|bloqueo),
        │     origen (app|whatsapp|telefono|mostrador|serie|bloqueo|clase),
        │     cliente_id, serie_id?, precio, creada_por
        │     EXCLUDE (cancha_id =, periodo &&) WHERE estado activo
        ├─ pagos (reserva_id | cliente_id, monto, medio, fecha, registrado_por)
        ├─ miembros_club (user_id, rol: dueño | encargado)
        └─ auditoria (quién, qué, cuándo, antes/después)
partidos ── reserva_id (la capa social queda arriba de la reserva)
notificaciones_outbox ── reintentos, idempotencia
```

Qué gana el club con este modelo:
- **Una sola regla de superposición** en la base, con un constraint de exclusión sobre `tstzrange`. Cubre turnos que cruzan la medianoche y conviven duraciones de 60, 90 y 120 minutos.
- **Fijos materializados:** un cron genera las ocurrencias de las próximas 8 a 12 semanas. Así cada semana tiene su propio pago, asistencia y excepción, que es lo que el club necesita para cobrar.
- **Solicitud y reserva son lo mismo con otro estado,** y la consulta de la agenda pasa a ser trivial.
- **Precio por duración y franja (pico o valle)** en lugar de bloques fijos.

**Migración:** aditiva. Se crean las tablas nuevas, se hace backfill desde las actuales y se dejan las viejas en solo lectura hasta cambiar el frontend. No se borra nada.

### 3.6 Módulos para el club

**C1. Agenda en grilla (día y semana)**
- Columnas = canchas, filas = franjas de 30 minutos, con colores por estado: solicitada, confirmada, fijo, bloqueo, impaga.
- Tocar una celda vacía abre la carga rápida. Tocar una reserva abre su ficha: cliente, pago, WhatsApp, mover o cancelar.
- Indicadores del día: libres, impagos y pendientes por responder.
- Se actualiza sola con Supabase Realtime cuando entra una solicitud.

**C2. Carga rápida y clientes**
- Cliente (autocompletado), cancha, hora y duración. El precio se sugiere según la tarifa.
- Origen: WhatsApp, teléfono o mostrador.
- Ficha de cliente: historial, deuda, notas, "es fijo de los martes" y botón de WhatsApp con mensajes pre-armados (confirmación, recordatorio, cobro).
- El jugador de la app puede cargar su teléfono, opcional y con consentimiento, para que el club lo contacte.

**C3. Alquileres fijos de verdad**
- Serie con precio, cliente y vigencia, más un recordatorio de renovación antes del "hasta".
- Por semana: marcar pagado o debe, liberar la fecha (opcionalmente ofreciéndola como turno suelto) y mover solo esa semana.
- Saldo de deuda por grupo y mensaje de cobro con el total adeudado.

**C4. Cobros y caja**
- Registrar pagos (efectivo, transferencia, Mercado Pago) por reserva o a cuenta.
- Cierre del día con totales por medio de pago. Exportar a Excel para el contador.
- **Seña sin integración:** mostrar al jugador el alias del club. El jugador marca "ya transferí" (y opcionalmente sube el comprobante a Storage privado) y el club confirma.
- **Más adelante:** Mercado Pago Checkout con la cuenta del propio club vía OAuth. Permite reservas instantáneas con seña cobrada, sin confirmación manual.

**C5. Autoservicio del club**
- El dueño gestiona canchas, fotos, horarios de apertura, duraciones permitidas, tarifas por franja, seña, anticipación mínima y máxima, política de cancelación, confirmación automática o manual, y cierres (feriados, mantenimiento).
- Hoy todo esto depende del admin global, y eso no escala más allá de 3 o 4 clubes.

**C6. Avisos**
- **Etapa 1:**
  - Web Push (PWA) y email (Resend, ya previsto en el runbook) mediante un outbox con reintentos.
  - Al club: "nueva solicitud" y un recordatorio si falta poco para que venza.
  - Al jugador: confirmación, rechazo y recordatorio 24 h y 3 h antes.
- **Etapa 2:** WhatsApp Business (Cloud API) para recordatorios y cobros. Tiene costo por mensaje y requiere plantillas aprobadas, así que conviene después de validar el uso.
- **Regla:** el envío nunca revierte una operación de reserva (ya está en el runbook).

**C7. Link público y "turnos libres para compartir"**
- `/club/:slug` con la disponibilidad real y un botón para reservar o solicitar. El club lo pone en la bio de Instagram y en la respuesta automática de WhatsApp Business.
- Botón **"Copiar turnos libres de hoy o de la semana"**, que genera un texto listo para pegar en grupos, estados o historias. Ejemplo: "🏐 Libres hoy: 19 h Cancha 2 · 21 h Cancha 1 → reservá acá: link".
- Es la palanca de adopción más barata: convierte cada consulta de WhatsApp en un usuario de la app sin pelear con WhatsApp.

**C8. Importar y exportar**
- Onboarding con una plantilla CSV/Excel de fijos y clientes, y una vista previa con conflictos detectados antes de confirmar.
- Exportar reservas, cobros y deudas.
- Esto reduce el alta de un club de horas a minutos, y que lo haga el club mismo.

**C9. Operación diaria**
- **Bloqueo masivo** por lluvia, feriado o torneo: elegir canchas y franja, ver la lista de afectados, cancelar con aviso y marcar la devolución pendiente si había seña.
- **Mover una reserva** a otro horario o cancha, en vez de cancelar y crear.
- **Lista de espera** para horarios ocupados, con aviso automático si se liberan.
- **Asistencia y no-show:** marcar "jugaron" o "no vinieron". Alimenta la métrica de partidos realizados del runbook y una eventual política de seña obligatoria para quienes faltan.

**C10. Reportes**
- Ocupación por cancha, día y franja (mapa de calor), ingresos registrados, deuda, clientes top y horas valle.
- Sugerencia derivada: "tus martes de 15 a 18 están vacíos: publicá un partido abierto o una promo".

**C11. Equipo, celular y auditoría**
- Roles dueño y encargado: el encargado opera la agenda pero no ve caja ni reportes. Invitación por link.
- PWA instalable con pestaña "Club" en la BottomNav.
- Registro de auditoría: quién confirmó, canceló o cambió un pago, y cuándo.

**C12. Diferencial de vóley: partidos abiertos del club**
- El club publica un "partido abierto" en horas valle con precio por jugador y cupo. La app lo llena con jugadores de su nivel.
- Esto convierte horas muertas en plata, y es algo que una agenda genérica no hace.
- Aplica también a partidos de jugadores: mostrar el **precio por jugador** (total ÷ cupo).

**C13. Más adelante:** clases y escuelita (series con alumnos y cuota mensual), torneos y ligas, varias sedes por club.

---

## 4. Mejoras para el jugador

- **Cancelar.** El jugador no puede cancelar su propia solicitud ni su reserva. Hace falta, con la política del club (por ejemplo, "hasta 24 h antes sin cargo").
- **Estado visible en los turnos:** mostrar "solicitado por otro" o "tu solicitud" en el horario, con un límite de pendientes.
- **"Mis reservas":** estados en español, datos del club (dirección, WhatsApp, alias para la seña) y la opción de agregar al calendario (`.ics`).
- **Errores visibles:** dejar de convertir errores en "no hay datos" (F1, F5 y hooks de mensajes, ranking y notificaciones).
- **Partidos:** ocultar los pasados, avisar al organizador una sola vez cuando se llega al mínimo (hoy avisa en cada unión) y elegir como nuevo organizador a un confirmado.
- **Detalles chicos:**
  - Unificar la escala de nivel: [nivel.ts](../src/lib/nivel.ts) dice que 3 es principiante y el servidor exige 3 o más para intermedio.
  - Contraseña mínima de 8 en todos lados.
  - Manejar el link de recuperación vencido.
  - El Toaster tapa la BottomNav.
  - Inputs de 16 px para que iOS no haga zoom.
  - Accesibilidad del Modal: `role="dialog"`, foco y Escape.

---

## 5. Ingeniería y operación

**Repositorio y proceso**
- Commitear hoy el trabajo pendiente en una rama, por partes: seguridad del frontend, landing, agenda UI, docs y SQL pendiente.
- Trabajar con PRs y el CI que ya existe.
- Borrar el código muerto: `AdminPanel` (455 líneas inalcanzables), los wrappers de RPC viejos, `MatchCard` duplicado y los tipos sin uso.

**Base de datos reproducible**
1. Inventario de ACL de la base viva, solo lectura:
   `select oid::regprocedure, prosecdef, proconfig, proacl from pg_proc where pronamespace='public'::regnamespace;`
2. `supabase db dump` del esquema como migración baseline, marcada como aplicada con `supabase migration repair`.
3. Verificar `supabase db reset` en un stack local con Docker.
4. Crear un segundo proyecto Supabase como **staging** y apuntar los Preview de Vercel ahí.

**Tests donde está el riesgo**
- **pgTAP** de autorización por rol (anon, jugador, encargado de otro club, admin) para cada RPC y vista. Habría detectado S1, S2, F1 y F4.
- **Chequeo en CI:** cada `rpc('x')` y `from('y')` del frontend tiene que existir en las migraciones.
- **Vitest + Testing Library:** `navigation.ts`, AuthForm, retomar después del login, matriz de rol × flag de `AdminGuard`.
- **Playwright** contra staging para los tres recorridos: jugador, club y admin.

**Frontend**
- `supabase gen types typescript` en lugar de tipos a mano.
- TanStack Query: cache, deduplicación y cancelación. Arregla las carreras de la agenda y del panel, y los dobles fetch de `/app`.
- ESLint con `react-hooks` y `jsx-a11y`.
- Cargar Leaflet y Sentry de forma diferida.

**Jobs**
- `pg_cron` para vencer solicitudes y pre-reservas, materializar series, recordatorios y limpieza del rate limit.

**Operación**
- Backups diarios verificados con un ensayo de restauración. Sentry con DSN.
- Cabecera CSP y `geolocation=(self)`.
- Confirmación de email en Auth y protección de contraseñas filtradas.
- Decidir el `ON DELETE` de las FK a `usuarios` para poder atender pedidos de borrado (Ley 25.326).

---

## 6. Hoja de ruta

Tamaño estimado: S = días, M = 1 a 2 semanas, L = 3 semanas o más (una persona).

| Fase | Objetivo | Contenido | Criterio de salida | Tamaño |
|---|---|---|---|---|
| **0. Cerrar y resguardar** | Que nadie pueda romper nada hoy | Commit en rama. Inventario de ACL. Migración *solo de revokes* (S1, S2 temporal, S6, S7, `buscar_partidos` a anon, S4). Rotar tokens (S3). Backup y prueba de restauración. Confirmación de email. | Ningún usuario autenticado puede ocupar, bloquear ni unirse sin permiso, verificado con queries reales. Backup restaurado al menos una vez. | S |
| **1. Base verificable** | Poder cambiar la base sin miedo | Baseline, staging y stack local. pgTAP de autorización. Arreglos F1–F14. Vistas o RPC definer para partidos. Tipos generados. TanStack Query. Acceso mobile al panel. | `db reset` reproduce la base. CI corre pgTAP y el chequeo de RPC. Los tres recorridos pasan en staging. | M |
| **2. Reemplazar el Excel** | Que el club ahorre tiempo sin jugadores | Modelo unificado (3.5). C1 grilla, C2 carga rápida y clientes, C3 fijos con cobro, C5 autoservicio, C7 link y copiar turnos libres, C8 importar, C11 PWA y roles. Avisos etapa 1 al club (C6). | 2 o 3 clubes piloto operan **toda** su semana en la app (incluido lo que entra por WhatsApp) durante 4 semanas. | L |
| **3. Jugadores y cobro** | Que reservar por la app sea mejor que por WhatsApp | Solicitudes de jugadores encendidas para la lista de acceso. Cancelación con política. Seña por alias y comprobante (C4). Avisos al jugador. Lista de espera, bloqueo masivo y mover (C9). Reportes (C10). | Más del 30 % de las reservas sueltas de los clubes piloto entran por la app. Tiempo de respuesta menor a 2 h. | L |
| **4. Crecimiento** | Diferenciarse | Partidos abiertos del club (C12). Mercado Pago con la cuenta del club y confirmación automática. WhatsApp Business. Clases y torneos. Varias sedes. | Según el modelo de negocio elegido. | L |

---

## 7. Métricas del piloto (lado club)

- % de la ocupación real del club registrada en la app (meta: 100 %, si no la agenda no le sirve).
- Tiempo medio de respuesta a solicitudes, y cuántas vencen sin respuesta.
- Deuda de fijos al final de cada semana (debería bajar).
- Ocupación de horas valle antes y después de los partidos abiertos.
- No-shows y cancelaciones tardías.
- Uso semanal del dueño y del encargado (sesiones y cargas desde el celular).
- Además, las del runbook: solicitudes recibidas y confirmadas, partidos realizados marcados después del evento, y recurrencia.

---

## 8. Decisiones que necesito de vos

1. **¿Rehacer el modelo de reservas (3.5) antes de activar el piloto?** Recomendado: los borradores ya requieren retrabajo y la base casi no tiene datos. La alternativa es corregir los borradores, activarlos y migrar después con datos reales.
2. **Confirmación:** ¿manual por defecto, o automática cuando el horario está libre? Se puede elegir por club.
3. **Cobro online:** ¿seña por alias y comprobante alcanza para el piloto, o Mercado Pago desde el arranque?
4. **Modelo de negocio con clubes:** suscripción mensual, comisión por reserva o gratis durante el piloto. Define si Mercado Pago y el split de pagos son prioritarios.
5. **Presupuesto:** plan pago de Supabase (backups, sin pausas) y costo por mensaje de WhatsApp Business.
6. **Clubes piloto:** ¿hay 2 o 3 concretos para validar la sección 3.1 antes de construir la Fase 2?
