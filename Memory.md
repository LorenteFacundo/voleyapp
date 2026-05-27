# Memory Log - Aplicacion de Voleibol

## Estado Actual
- **Fase:** Construccion inicial en marcha.
- **Frontend:** React + Vite + TypeScript + Tailwind CSS + Leaflet.
- **Backend:** Supabase conectado por MCP y autenticado con OAuth.
- **Dev server:** `http://127.0.0.1:5173`

## Hecho el 2026-05-27
- Se instalo y autentico el MCP de Supabase para el proyecto `dlrcvkwauauoalsolshl`.
- Se instalaron las Agent Skills de Supabase.
- Se detecto que Supabase ya tenia un modelo inicial en español:
  - `usuarios`
  - `clubes`
  - `administradores_club`
  - `canchas`
  - `disponibilidad_turnos`
  - `reservas`
  - `partidos`
  - `participantes_partido`
- Se adapto el plan para trabajar sobre ese modelo existente en lugar de duplicar tablas en ingles.
- Se aplicaron migraciones incrementales:
  - perfil automatico al crear usuarios en Auth;
  - roles extendidos (`jugador`, `admin_cancha`, `admin_global`, `superadmin`);
  - campos de partido: nivel requerido, aprobacion manual y expiracion de pre-reserva;
  - politicas RLS faltantes para reservas, partidos, participantes y administradores de club;
  - RPC `crear_partido` para crear reserva + partido + participante organizador;
  - vista `partidos_publicos` para lectura limpia desde el frontend.
- Se corrio Supabase Advisors:
  - quedan avisos heredados de PostGIS en `public.spatial_ref_sys` y extension `postgis` en schema public;
  - no se tocaron automaticamente porque mover PostGIS o bloquear `spatial_ref_sys` puede romper dependencias.
- Se inicializo la app React en la carpeta del proyecto.
- Se configuro `.env.local` con URL y publishable key de Supabase.
- Se construyo una primera UI funcional:
  - mapa con Leaflet;
  - login/registro con Supabase Auth;
  - perfil basico de usuario;
  - listado de partidos abiertos;
  - listado de turnos disponibles;
  - formulario para crear pre-reserva/partido.
- `npm run build` pasa correctamente.
- Verificacion en navegador integrado:
  - la app renderiza en `http://127.0.0.1:5173`;
  - no hay errores ni warnings de consola;
  - la DB esta vacia, por eso la UI muestra 0 partidos y 0 turnos.

## Proximos pasos
- Cargar datos reales o seed inicial: clubes, canchas y disponibilidad de turnos.
- Probar registro/login con un usuario real.
- Probar `crear_partido` con un turno disponible real.
- Construir vistas de detalle:
  - `/cancha/:id`
  - `/partido/:id`
  - `/admin`
- Decidir si se corrigen los avisos heredados de PostGIS:
  - `ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;`
  - mover extension PostGIS fuera del schema `public` solo si se valida impacto.
