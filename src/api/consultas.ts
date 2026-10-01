import { QueryClient, keepPreviousData, useQuery } from '@tanstack/react-query';
import { ApiError } from './cliente';
import { adminApi } from './admin';
import { clubApi } from './club';
import { jugadorApi } from './jugador';
import { publicoApi } from './publico';
import { claves } from './claves';
import { useAuth } from '@/contexts/auth';

export function crearQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        // Los errores de negocio o permisos no mejoran reintentando.
        retry: (intentos, error) => !(error instanceof ApiError && error.code !== 'red') && intentos < 2,
      },
      mutations: { retry: false },
    },
  });
}

export { claves } from './claves';

// ---------------------------------------------------------------------------
// Público
// ---------------------------------------------------------------------------

export function useEstadoOperacion() {
  const { session } = useAuth();
  return useQuery({
    queryKey: [...claves.estadoOperacion, session?.user.id ?? null],
    queryFn: publicoApi.estadoOperacion,
    staleTime: 60_000,
  });
}

export function useClubes() {
  return useQuery({ queryKey: [...claves.catalogo, 'clubes'], queryFn: publicoApi.clubes, staleTime: 5 * 60_000 });
}

export function useClubPublico(slug: string | undefined) {
  return useQuery({
    queryKey: claves.club(slug ?? ''),
    queryFn: () => publicoApi.club(slug!),
    enabled: !!slug,
    staleTime: 5 * 60_000,
  });
}

export function useDisponibilidad(filtro: { clubId?: number; canchaId?: number; desde: string; hasta: string } | null) {
  return useQuery({
    queryKey: claves.disponibilidadDe(filtro ?? { desde: '', hasta: '' }),
    queryFn: () => publicoApi.disponibilidad(filtro!),
    enabled: !!filtro && (!!filtro.clubId || !!filtro.canchaId),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
}

export function useExplorarPartidos(filtros: Parameters<typeof publicoApi.explorarPartidos>[0]) {
  return useQuery({
    queryKey: claves.explorarPartidos(filtros ?? {}),
    queryFn: () => publicoApi.explorarPartidos(filtros),
    placeholderData: keepPreviousData,
  });
}

export function usePartido(id: number | null, token?: string | null) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [...claves.partido(id ?? 0, token), session?.user.id ?? null],
    queryFn: () => publicoApi.partidoDetalle(id!, token),
    enabled: !!id,
  });
}

export function useRanking(limite = 10) {
  return useQuery({ queryKey: [...claves.ranking, limite], queryFn: () => publicoApi.ranking(limite), staleTime: 5 * 60_000 });
}

// ---------------------------------------------------------------------------
// Jugador (requieren sesión)
// ---------------------------------------------------------------------------

export function useMisReservas(historial = false) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [...claves.misReservas(historial), session?.user.id],
    queryFn: () => jugadorApi.misReservas(historial),
    enabled: !!session,
  });
}

export function useMisPartidos() {
  const { session } = useAuth();
  return useQuery({ queryKey: [...claves.misPartidos, session?.user.id], queryFn: jugadorApi.misPartidos, enabled: !!session });
}

export function useMensajes(partidoId: number | null, habilitado: boolean) {
  return useQuery({
    queryKey: claves.mensajes(partidoId ?? 0),
    queryFn: () => jugadorApi.mensajes(partidoId!),
    enabled: !!partidoId && habilitado,
    refetchInterval: 20_000,
  });
}

export function useNotificaciones(abiertas: boolean) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [...claves.notificaciones, 'lista', session?.user.id],
    queryFn: () => jugadorApi.notificaciones(30),
    enabled: !!session && abiertas,
  });
}

export function useNotificacionesSinLeer() {
  const { session } = useAuth();
  return useQuery({
    queryKey: [...claves.notificaciones, 'sin-leer', session?.user.id],
    queryFn: jugadorApi.notificacionesSinLeer,
    enabled: !!session,
    refetchInterval: 60_000,
  });
}

export function useLogros() {
  const { session } = useAuth();
  return useQuery({ queryKey: [...claves.logros, session?.user.id], queryFn: jugadorApi.misLogros, enabled: !!session });
}

// ---------------------------------------------------------------------------
// Gestión del club
// ---------------------------------------------------------------------------

export function useClubPanel(clubId: number | null) {
  return useQuery({
    queryKey: claves.panel(clubId ?? 0),
    queryFn: () => clubApi.panel(clubId!),
    enabled: !!clubId,
    refetchInterval: 60_000,
  });
}

export function useAgenda(clubId: number | null, desde: string, hasta: string, incluirCanceladas = false) {
  return useQuery({
    queryKey: claves.agenda(clubId ?? 0, desde, hasta, incluirCanceladas),
    queryFn: () => clubApi.agenda(clubId!, desde, hasta, incluirCanceladas),
    enabled: !!clubId,
    placeholderData: keepPreviousData,
    // La agenda se actualiza sola para ver pedidos nuevos sin recargar.
    refetchInterval: 30_000,
  });
}

export function usePendientes(clubId: number | null) {
  return useQuery({
    queryKey: claves.pendientes(clubId ?? 0),
    queryFn: () => clubApi.pendientes(clubId!),
    enabled: !!clubId,
    refetchInterval: 30_000,
  });
}

export function usePagosInformados(clubId: number | null) {
  return useQuery({
    queryKey: claves.pagosInformados(clubId ?? 0),
    queryFn: () => clubApi.pagosInformados(clubId!),
    enabled: !!clubId,
  });
}

export function useClientes(clubId: number | null, busqueda = '', archivados = false) {
  return useQuery({
    queryKey: claves.clientes(clubId ?? 0, busqueda, archivados),
    queryFn: () => clubApi.clientes(clubId!, busqueda, archivados),
    enabled: !!clubId,
    placeholderData: keepPreviousData,
  });
}

export function useClienteDetalle(clienteId: number | null) {
  return useQuery({
    queryKey: claves.cliente(clienteId ?? 0),
    queryFn: () => clubApi.clienteDetalle(clienteId!),
    enabled: !!clienteId,
  });
}

export function useSeries(clubId: number | null, finalizadas = false) {
  return useQuery({
    queryKey: claves.series(clubId ?? 0, finalizadas),
    queryFn: () => clubApi.series(clubId!, finalizadas),
    enabled: !!clubId,
  });
}

export function useCaja(clubId: number | null, desde: string, hasta: string) {
  return useQuery({
    queryKey: claves.caja(clubId ?? 0, desde, hasta),
    queryFn: () => clubApi.caja(clubId!, desde, hasta),
    enabled: !!clubId,
    placeholderData: keepPreviousData,
  });
}

export function useDeudas(clubId: number | null) {
  return useQuery({ queryKey: claves.deudas(clubId ?? 0), queryFn: () => clubApi.deudas(clubId!), enabled: !!clubId });
}

export function useReporte(clubId: number | null, desde: string, hasta: string) {
  return useQuery({
    queryKey: claves.reporte(clubId ?? 0, desde, hasta),
    queryFn: () => clubApi.reporte(clubId!, desde, hasta),
    enabled: !!clubId,
    placeholderData: keepPreviousData,
  });
}

export function useEquipo(clubId: number | null) {
  return useQuery({ queryKey: claves.equipo(clubId ?? 0), queryFn: () => clubApi.equipo(clubId!), enabled: !!clubId });
}

export function useAuditoriaClub(clubId: number | null) {
  return useQuery({
    queryKey: claves.auditoriaClub(clubId ?? 0),
    queryFn: () => clubApi.auditoria(clubId!),
    enabled: !!clubId,
  });
}

// ---------------------------------------------------------------------------
// Administración global
// ---------------------------------------------------------------------------

export function useResumenAdmin() {
  return useQuery({ queryKey: [...claves.admin, 'resumen'], queryFn: adminApi.resumen });
}

export function useClubesAdmin() {
  return useQuery({ queryKey: [...claves.admin, 'clubes'], queryFn: adminApi.clubes });
}

export function useUsuariosAdmin(busqueda: string) {
  return useQuery({
    queryKey: [...claves.admin, 'usuarios', busqueda],
    queryFn: () => adminApi.usuarios(busqueda),
    placeholderData: keepPreviousData,
  });
}

export function useLeads() {
  return useQuery({ queryKey: [...claves.admin, 'leads'], queryFn: adminApi.leads });
}

export function useAuditoriaAdmin() {
  return useQuery({ queryKey: [...claves.admin, 'auditoria'], queryFn: () => adminApi.auditoria(200) });
}
