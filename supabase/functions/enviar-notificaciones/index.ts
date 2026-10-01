// Envía por email las notificaciones encoladas en public.envios_notificacion.
//
// Se invoca periódicamente (pg_cron + pg_net, ver docs/runbook-piloto.md) con
// el encabezado x-envios-secreto. Toma lotes con bloqueo (no hay envíos
// duplicados entre ejecuciones concurrentes), envía con Resend usando una
// clave de idempotencia por envío y registra el resultado: los fallos se
// reintentan con espera exponencial hasta 5 veces.
//
// Variables (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY     clave de Resend
//   EMAIL_REMITENTE    p. ej. "VoleyApp <avisos@tudominio.com>" (dominio verificado en Resend)
//   SITIO_URL          URL pública de la app, p. ej. https://voleyapp.com.ar
//   ENVIOS_SECRETO     secreto compartido con el job que la invoca
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los provee Supabase.

import { createClient } from 'npm:@supabase/supabase-js@2';

type Envio = { id: number; destino: string; asunto: string; cuerpo: string; url: string | null; intentos: number };

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function escapar(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function enlace(sitio: string, url: string | null): string {
  const base = sitio.replace(/\/$/, '');
  return url && url.startsWith('/') && !url.startsWith('//') ? `${base}${url}` : `${base}/app`;
}

function html(envio: Envio, destino: string): string {
  return `<!doctype html>
<html lang="es"><body style="margin:0;background:#f8f9fa;font-family:Arial,Helvetica,sans-serif;color:#2d3436">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;padding:28px">
        <tr><td style="font-size:20px;font-weight:800;color:#1a237e;padding-bottom:4px">🏐 VoleyApp</td></tr>
        <tr><td style="font-size:18px;font-weight:700;padding:12px 0 8px">${escapar(envio.asunto)}</td></tr>
        <tr><td style="font-size:15px;line-height:1.5;color:#4a5054;padding-bottom:20px">${escapar(envio.cuerpo).replace(/\n/g, '<br>')}</td></tr>
        <tr><td><a href="${escapar(destino)}" style="display:inline-block;background:#ff6b35;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px">Abrir VoleyApp</a></td></tr>
        <tr><td style="font-size:12px;color:#8a9094;padding-top:24px">Recibís este aviso porque tenés una cuenta en VoleyApp.</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'Método no permitido' });

  const secreto = Deno.env.get('ENVIOS_SECRETO');
  const recibido = request.headers.get('x-envios-secreto') ?? '';
  if (!secreto || recibido.length !== secreto.length || recibido !== secreto) {
    return json(401, { error: 'No autorizado' });
  }

  const resendKey = Deno.env.get('RESEND_API_KEY');
  const remitente = Deno.env.get('EMAIL_REMITENTE');
  const sitio = Deno.env.get('SITIO_URL');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!resendKey || !remitente || !sitio || !supabaseUrl || !serviceKey) {
    console.error('enviar-notificaciones: falta configuración');
    return json(503, { error: 'Configuración incompleta' });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await supabase.rpc('sistema_tomar_envios', { p_limite: 20 });
  if (error) {
    console.error('enviar-notificaciones: no se pudo tomar la cola');
    return json(503, { error: 'No se pudo leer la cola' });
  }

  const envios = (data ?? []) as Envio[];
  let enviados = 0;
  for (const envio of envios) {
    const destino = enlace(sitio, envio.url);
    let ok = false;
    let detalle: string | null = null;
    try {
      const respuesta = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `voleyapp-envio-${envio.id}`,
        },
        body: JSON.stringify({
          from: remitente,
          to: [envio.destino],
          subject: envio.asunto,
          html: html(envio, destino),
          text: `${envio.asunto}\n\n${envio.cuerpo}\n\n${destino}`,
        }),
      });
      ok = respuesta.ok;
      if (!ok) detalle = `Resend ${respuesta.status}`;
    } catch (fallo) {
      detalle = fallo instanceof Error ? fallo.message.slice(0, 200) : 'Error de red';
    }
    if (ok) enviados += 1;
    await supabase.rpc('sistema_resultado_envio', { p_id: envio.id, p_ok: ok, p_error: detalle });
  }
  return json(200, { procesados: envios.length, enviados, fallidos: envios.length - enviados });
});
