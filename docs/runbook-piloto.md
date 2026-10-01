# Operación del piloto VoleyApp

## Estado y regla de publicación

El repositorio está en `main`. El piloto no se considera habilitado por el solo hecho de desplegar el frontend: la aplicación arranca con nuevas reservas y captación apagadas. No aplicar SQL a la base principal hasta guardar una copia recuperable y verificar cada migración. El proyecto Supabase actual es Free y no permite ramas de base de datos; no hay un entorno online aislado habilitado.

## Configuración de Vercel

Configurar el proyecto como Vite, con `npm ci` y `npm run build`; la salida es `dist`. El archivo `vercel.json` mantiene la navegación directa de las rutas SPA y define cabeceras de seguridad.

Crear las variables por separado para Production y Preview:

- `VITE_SUPABASE_URL`: URL HTTPS del proyecto correspondiente.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: clave publicable/anon. Nunca usar una clave `service_role` o `sb_secret_` en el frontend.
- `VITE_PILOT_BOOKINGS_ENABLED=false` hasta verificar el esquema, la lista de acceso y los RPC del piloto.
- `VITE_CLUB_LEADS_ENABLED=false` hasta desplegar y probar `submit-club-lead` junto con su migración.
- `VITE_CONTACT_WHATSAPP`: opcional; dejar vacío hasta tener el número real.
- `VITE_SENTRY_DSN`: opcional hasta que exista un proyecto de Sentry y una DSN propia.

Las vistas previas no deben apuntar a producción. Como todavía no existe un proyecto Supabase separado, mantener deshabilitadas en Preview las acciones de escritura y no cargar allí claves de producción. La validación de build informa variables faltantes sin imprimir sus valores.

## Supabase, invitaciones y captación

Antes de aplicar una migración:

1. Consultar su efecto y revisar los registros que afecta; detenerse si hay incompatibilidades.
2. Generar y guardar un respaldo protegido fuera del repositorio. La salida predeterminada de `supabase db dump` es de esquema; no equivale a un respaldo completo de datos, Auth, Storage y permisos. El dump de datos puede contener datos personales: cifrarlo, limitar el acceso y no restaurarlo en entornos de prueba sin anonimización.
3. Ensayar restauración y migración en un entorno aislado. El proyecto actual no admite ramas de base de datos y no se creó otro proyecto; este control continúa pendiente.
4. Aplicar en producción solo con la pausa de nuevas operaciones activada y un procedimiento de vuelta probado. No eliminar tablas nuevas durante la reversión; conservar los datos generados.

Los borradores de agenda, partidos y operaciones continúan separados de las migraciones ejecutables hasta completar la revisión de seguridad y pruebas en un entorno aislado. Las cuentas se habilitarán desde el panel global, sin cambiarles el rol. Los enlaces de invitación solo identifican el partido y no otorgan acceso al piloto.

El formulario de clubes llama a la Edge Function `submit-club-lead`. Para publicarla, configurar de forma segura `CLUB_LEAD_RATE_LIMIT_SALT` en Supabase Functions y confirmar que la función conserva `verify_jwt = false` solo porque valida el cuerpo, limita frecuencia y usa el rol de servicio en servidor. El rol de servicio no se envía nunca al navegador. Mantener el formulario apagado hasta que la tabla, el RPC del limitador y la función estén desplegados y probados.

## Correo y avisos

Antes de invitar jugadores, elegir y verificar el dominio/remitente en Resend; configurar SMTP propio en Supabase Auth, confirmar direcciones de retorno por entorno y recorrer confirmación y recuperación de contraseña. No colocar API keys o credenciales SMTP en variables `VITE_*`. Los avisos transaccionales requieren además la cola/outbox, reintentos e idempotencia previstos; el envío de correo no debe revertir una operación de reserva.

## Alta de un club y atención

1. Contactar al club y registrar su interés en la bandeja privada.
2. Confirmar una persona responsable y qué cuenta administrará cada sede.
3. Revisar y cargar horarios publicados, precio, duración de los turnos y alquileres permanentes con el club.
4. Explicar que la solicitud queda pendiente hasta la confirmación, que los pagos/devoluciones se arreglan fuera de VoleyApp y que la agenda unifica app y canales externos.
5. Empezar con un grupo pequeño de cuentas invitadas en Zona Sur y CABA; resolver consultas manualmente y registrar cancelaciones/conflictos.

## Privacidad, pagos y recuperación

Guardar solo los datos necesarios para contactar al jugador o al responsable. Los pagos y devoluciones se registran como externos; VoleyApp no debe indicar que un reintegro ocurrió hasta que el club lo confirme. Publicar condiciones y aviso de privacidad revisados antes del alta abierta: hoy faltan la identidad legal/responsable de datos y su canal de contacto, por lo que no se deben inventar en el texto.

Ante incidentes, pausar nuevas operaciones, mantener disponibles la consulta y la gestión de reservas existentes, preservar logs y respaldos, y usar una versión compatible del frontend. Reanudar solo después de revisar los datos afectados y verificar de nuevo disponibilidad y permisos.

## Métricas de seguimiento

Revisar semanalmente solicitudes recibidas y confirmadas, tiempo de respuesta, reservas canceladas, partidos efectivamente realizados (marcados después del evento) y uso recurrente por club y jugador. No inferir “partido realizado” únicamente por el paso del tiempo.
