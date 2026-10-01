# Guía del frontend

React 19 + Vite + TypeScript + Tailwind. Datos con Supabase vía funciones RPC y React Query. Todo el texto de la interfaz va en español rioplatense (voseo), claro y breve.

## Estructura

```text
src/
  api/          Acceso a datos. Única puerta a Supabase.
    tipos.ts      Tipos de lo que devuelven las RPC.
    cliente.ts    rpc()/rpcLista() y traducción de errores (ApiError).
    publico.ts    Catálogo, disponibilidad, partidos públicos, ranking.
    jugador.ts    Perfil, reservas, partidos, chat, notificaciones.
    club.ts       Panel de gestión del club.
    admin.ts      Administración global.
    claves.ts     Claves de caché de React Query.
    consultas.ts  Hooks useX() de lectura (useAgenda, useClubPanel, …).
  components/
    ui/           Piezas base (Button, Input/Select/Textarea/Switch, Modal, Tabs, Badge, Card, Estados, Confirmar).
    layout/       AppShell (encabezado + barra inferior), PageTitle, guardas, campanita.
  contexts/     auth.ts (useAuth) y AuthContext.tsx (proveedor).
  features/     Componentes y lógica de cada área (agenda, clientes, fijos, caja, reportes, ajustes, jugador, partidos, admin…).
  lib/          Utilidades puras: date, telefono, format, nivel, archivos (CSV/ICS), navigation, monitoring.
  pages/        Una página por ruta; delgadas, componen features.
    gestion/      Panel del club (GestionLayout provee useGestion()).
    admin/        Administración global.
```

## Datos

- Las pantallas nunca llaman a `supabase` directamente: usan `publicoApi`, `jugadorApi`, `clubApi` o `adminApi`.
- Lecturas: los hooks de `src/api/consultas.ts`. Si falta uno, se crea en la carpeta de la feature con `useQuery` y una clave de `claves`.
- Escrituras: `useMutation` y, al terminar, `queryClient.invalidateQueries({ queryKey: claves.gestion(clubId) })` (o el prefijo que corresponda) para refrescar todo lo relacionado.
- Errores: `mensajeDeError(error)` da un texto listo para mostrar (`toast.error(...)`). Los mensajes de negocio vienen del SQL en español.
- Permisos: las guardas de rutas solo ordenan la navegación. La seguridad está en el servidor (cada RPC valida el rol).

## Fechas, horas y dinero

- Siempre hora de Buenos Aires con `src/lib/date.ts`: `todayArgentinaISO`, `instanteArgentina(fecha, 'HH:MM')`, `fechaArgentina(instante)`, `horaArgentina(instante)`, `formatFechaHora`, `formatRangoHorario`, `formatDiaRelativo`.
- Nunca `new Date('YYYY-MM-DD')` ni `toLocaleString` sin `timeZone`.
- Fechas de calendario: `'YYYY-MM-DD'`. Instantes: ISO 8601.
- Montos: `formatMoney`. Teléfonos: `normalizarTelefono` antes de enviar, `formatTelefono` para mostrar, `enlaceWhatsApp(numero, mensaje)` para escribir.

## Interfaz

- Mobile first: botones de al menos 44 px (`Button` ya lo cumple), inputs de 16 px (sin zoom en iOS), nada de scroll horizontal de página (sí dentro de una grilla).
- Accesibilidad: todo botón con solo ícono lleva `aria-label`; nada de `div` clickeables (usar `button` o `Link`); los formularios usan `Input`/`Select`/`Textarea` con `label`; los diálogos son `Modal`; las confirmaciones usan `useConfirmar()` (nunca `window.confirm`).
- Estados: `Cargando`, `Vacio`, `ErrorCarga` (con reintento) y `Aviso` en `components/ui/Estados.tsx`. Ninguna pantalla muestra "sin datos" cuando en realidad hubo un error.
- Notificaciones efímeras: `toast` de `sonner`.
- Colores: tokens de Tailwind (`vb-orange`, `vb-blue`, `ink`, …). Estados de reserva con colores consistentes: pendiente ámbar, confirmada azul/verde, fijo índigo, bloqueo gris, cancelada tachada.
- Mapas: Leaflet se carga en un componente perezoso (`lazy`) que importa `leaflet/dist/leaflet.css` adentro; nunca en el bundle inicial.

## React

- Reglas de `eslint-plugin-react-hooks` v7: no llamar `setState` sincrónicamente dentro de efectos, no leer/escribir refs durante el render. Derivar estado de props, usar `key` para reiniciar formularios y React Query para datos remotos.
- Formularios: estado local controlado; validar en el cliente para dar feedback rápido, pero confiar en la validación del servidor.

## Calidad

- `npm run lint` (ESLint + TypeScript) y `npm test` deben pasar.
- La lógica pura (cálculos de grilla, armado de mensajes, parseo de CSV, etc.) va en archivos `.ts` con pruebas `*.test.ts` al lado.
