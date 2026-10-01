import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length < 2 || normalized.length > maxLength || /[\u0000-\u001f\u007f]/.test(normalized)) return null;
  return normalized;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json(405, { error: 'Método no permitido' });

  const declaredLength = Number(request.headers.get('content-length') ?? '0');
  if (declaredLength > 8_192) return json(413, { error: 'Solicitud demasiado grande' });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Solicitud inválida' });
  }

  // Quietly accept honeypot submissions so bots cannot use the endpoint as a validator.
  if (typeof body.website === 'string' && body.website.trim()) return json(200, { ok: true });

  const club = cleanText(body.club_nombre, 120);
  const localidad = cleanText(body.localidad, 100);
  const nombre = cleanText(body.contacto_nombre, 100);
  const contacto = cleanText(body.contacto, 160);
  const cantidad = Number(body.cantidad_canchas);
  if (!club || !localidad || !nombre || !contacto ||
      !Number.isInteger(cantidad) || cantidad < 1 || cantidad > 100) {
    return json(400, { error: 'Revisá los datos ingresados' });
  }

  const serviceUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const rateLimitSalt = Deno.env.get('CLUB_LEAD_RATE_LIMIT_SALT');
  if (!serviceUrl || !serviceKey || !rateLimitSalt) {
    console.error('submit-club-lead is missing required server configuration');
    return json(503, { error: 'El formulario no está disponible por el momento' });
  }

  // Supabase's gateway supplies the client IP in the forwarded chain. Hash it
  // with a server-only salt so no raw address is retained by the application.
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim();
  const clientIp = request.headers.get('cf-connecting-ip')?.trim() || forwardedFor;
  if (!clientIp) return json(429, { error: 'No se pudo validar esta solicitud' });

  const supabase = createClient(serviceUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const addressHash = await sha256(`${rateLimitSalt}:${clientIp}`);
  const { data: allowed, error: rateError } = await supabase.rpc('pilot_registrar_intento_captacion', {
    p_hash: addressHash,
  });
  if (rateError) {
    console.error('submit-club-lead rate limiter failed');
    return json(503, { error: 'No pudimos validar la consulta. Intentá de nuevo más tarde.' });
  }
  if (allowed !== true) return json(429, { error: 'Alcanzaste el límite de consultas. Intentá más tarde.' });

  const { error: insertError } = await supabase.from('solicitudes_club').insert({
    club_nombre: club,
    localidad,
    contacto_nombre: nombre,
    contacto,
    cantidad_canchas: cantidad,
  });
  if (insertError) {
    console.error('submit-club-lead could not persist a validated lead');
    return json(503, { error: 'No pudimos enviar tu consulta. Intentá de nuevo en un momento.' });
  }
  return json(200, { ok: true });
});
