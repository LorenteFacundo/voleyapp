import { useQuery } from '@tanstack/react-query';
import { publicoApi } from '@/api/publico';
import { claves } from '@/api/claves';

/** Datos públicos de una invitación al equipo de un club (club, rol, email enmascarado, vencimiento). */
export function useInvitacionClub(token: string) {
  return useQuery({
    queryKey: claves.invitacionClub(token),
    queryFn: () => publicoApi.verInvitacionClub(token),
    enabled: token.length > 0,
    staleTime: 60_000,
  });
}
