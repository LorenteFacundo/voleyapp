// Levanta el Supabase local y Vite apuntando a él. Ctrl+C detiene ambos.
// Uso: npm run dev:local            (conserva los datos)
//      npm run dev:local -- --reset (recrea la base con los datos de ejemplo)

import { spawn } from 'node:child_process';

const reiniciar = process.argv.includes('--reset');
const puerto = process.env.SUPABASE_LOCAL_PORT ?? '54321';

const servidor = spawn(process.execPath, [
  '--experimental-strip-types', '--no-warnings=ExperimentalWarning',
  'scripts/supabase-local/servidor.ts', ...(reiniciar ? ['--reset'] : []),
], { stdio: ['ignore', 'pipe', 'inherit'] });

let vite = null;

servidor.stdout.on('data', (datos) => {
  process.stdout.write(datos);
  if (!vite && String(datos).includes('Supabase local listo')) {
    vite = spawn('npx', ['vite', '--config', 'vite.config.ts'], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        VITE_SUPABASE_URL: `http://localhost:${puerto}`,
        VITE_SUPABASE_PUBLISHABLE_KEY: 'voleyapp-local-anon',
        VITE_CLUB_LEADS_ENABLED: 'true',
        VITE_ENTORNO_LOCAL: 'true',
      },
    });
    vite.on('exit', (codigo) => { servidor.kill(); process.exit(codigo ?? 0); });
  }
});

servidor.on('exit', (codigo) => {
  if (vite) vite.kill();
  process.exit(codigo ?? 0);
});

for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, () => {
    servidor.kill();
    if (vite) vite.kill();
  });
}
