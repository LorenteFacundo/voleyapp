import { loadEnv } from 'vite';

const env = loadEnv('production', process.cwd(), '');
const problems = [];

if (!env.VITE_SUPABASE_URL) {
  problems.push('VITE_SUPABASE_URL no está configurada.');
} else {
  try {
    const url = new URL(env.VITE_SUPABASE_URL);
    if (url.protocol !== 'https:') problems.push('VITE_SUPABASE_URL debe usar HTTPS en producción.');
    if (url.username || url.password || url.search || url.hash) problems.push('VITE_SUPABASE_URL no puede incluir credenciales ni parámetros.');
  } catch {
    problems.push('VITE_SUPABASE_URL no es una URL válida.');
  }
}

const publicKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!publicKey) {
  problems.push('VITE_SUPABASE_PUBLISHABLE_KEY no está configurada.');
} else if (publicKey.startsWith('sb_secret_')) {
  problems.push('No se permite una clave secreta en VITE_SUPABASE_PUBLISHABLE_KEY.');
} else if (publicKey.split('.').length === 3) {
  try {
    const claims = JSON.parse(Buffer.from(publicKey.split('.')[1], 'base64url').toString('utf8'));
    if (claims.role === 'service_role') problems.push('No se permite una clave service_role en el frontend.');
  } catch {
    // Legacy anon keys are JWTs; an unparsable value will fail when the client connects.
  }
}

const whatsapp = env.VITE_CONTACT_WHATSAPP?.trim();
if (whatsapp && !/^\d{10,15}$/.test(whatsapp)) {
  problems.push('VITE_CONTACT_WHATSAPP debe contener entre 10 y 15 dígitos internacionales, sin + ni espacios.');
}

const sentryDsn = env.VITE_SENTRY_DSN?.trim();
if (sentryDsn) {
  try {
    if (new URL(sentryDsn).protocol !== 'https:') problems.push('VITE_SENTRY_DSN debe usar HTTPS.');
  } catch {
    problems.push('VITE_SENTRY_DSN no es una URL válida.');
  }
}

if (problems.length) {
  console.error(`Configuración de producción incompleta:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}

console.log('Configuración de producción validada.');
