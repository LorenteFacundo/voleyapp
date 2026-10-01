import { Link, Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { TicketX } from 'lucide-react';
import { publicoApi } from '@/api/publico';
import { claves } from '@/api/claves';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Cargando, ErrorCarga } from '@/components/ui/Estados';
import { clasesBoton } from '@/components/ui/estilosBoton';

// Los tokens de invitación tienen 32 caracteres; el servidor rechaza los de menos de 16.
const LARGO_MINIMO = 16;

function InvitacionInvalida() {
  return (
    <Card padding="lg" className="mx-auto max-w-lg text-center">
      <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-vb-orange-light text-vb-orange-ink" aria-hidden="true">
        <TicketX size={28} />
      </span>
      <h1 className="font-display text-2xl font-black text-vb-blue">Esta invitación ya no sirve</h1>
      <p className="mt-2 text-sm text-ink/65">
        Puede que el partido se haya cancelado, que ya se haya jugado o que el enlace esté incompleto. Pedile a quien te
        invitó que te lo vuelva a mandar, o buscá otro partido abierto.
      </p>
      <Link to="/partidos" className={clasesBoton({ variant: 'primary', className: 'mt-5' })}>Ver partidos abiertos</Link>
    </Card>
  );
}

/** /partido/invitar/:token → lleva al partido con la invitación aplicada. */
export function InvitacionPartidoPage() {
  const { token = '' } = useParams<{ token: string }>();
  const valido = token.length >= LARGO_MINIMO;
  const consulta = useQuery({
    queryKey: [...claves.partidos, 'invitacion', token],
    queryFn: () => publicoApi.buscarPartidoPorToken(token),
    enabled: valido,
    staleTime: 60_000,
  });

  if (valido && consulta.data) {
    return <Navigate to={`/partido/${consulta.data}?invite=${encodeURIComponent(token)}`} replace />;
  }

  return (
    <AppShell>
      {!valido ? (
        <InvitacionInvalida />
      ) : consulta.isPending ? (
        <Cargando texto="Abriendo la invitación…" className="min-h-[40dvh]" />
      ) : consulta.isError ? (
        <ErrorCarga error={consulta.error} onRetry={() => consulta.refetch()} />
      ) : (
        <InvitacionInvalida />
      )}
    </AppShell>
  );
}
