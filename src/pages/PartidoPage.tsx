import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, SearchX } from 'lucide-react';
import { usePartido } from '@/api/consultas';
import { useAuth } from '@/contexts/auth';
import { rutaIngreso } from '@/lib/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Cargando, ErrorCarga } from '@/components/ui/Estados';
import { clasesBoton } from '@/components/ui/estilosBoton';
import { DetallePartido } from '@/features/partidos/detalle/DetallePartido';
import { esPartidoNoEncontrado } from '@/features/partidos/estado';

function PartidoNoEncontrado({ rutaActual, conInvitacion }: { rutaActual: string; conInvitacion: boolean }) {
  const { session } = useAuth();
  return (
    <Card padding="lg" className="mx-auto max-w-lg text-center">
      <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-vb-orange-light text-vb-orange-ink" aria-hidden="true">
        <SearchX size={28} />
      </span>
      <h1 className="font-display text-2xl font-black text-vb-blue">No encontramos este partido</h1>
      <p className="mt-2 text-sm text-ink/65">
        {conInvitacion
          ? 'Puede que el partido se haya cancelado, que todavía espere la confirmación de la cancha o que el enlace esté incompleto.'
          : 'Puede que sea un partido privado, que se haya cancelado o que el enlace esté incompleto. Si te invitaron, abrí el enlace completo que te pasaron.'}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link to="/partidos" className={clasesBoton({ variant: 'primary' })}>Ver partidos abiertos</Link>
        {!session && <Link to={rutaIngreso(rutaActual)} className={clasesBoton({ variant: 'secondary' })}>Ingresar</Link>}
      </div>
      {!session && <p className="mt-3 text-xs text-ink/65">Si ya estás en el partido, ingresá para verlo.</p>}
    </Card>
  );
}

export function PartidoPage() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const invite = params.get('invite');
  const partidoId = Number(id);
  const valido = Number.isInteger(partidoId) && partidoId > 0;
  const partido = usePartido(valido ? partidoId : null, invite);
  const rutaActual = `/partido/${id ?? ''}${invite ? `?invite=${encodeURIComponent(invite)}` : ''}`;

  return (
    <AppShell>
      <Link
        to="/partidos"
        className="mb-3 inline-flex min-h-10 items-center gap-1.5 rounded-lg text-sm font-semibold text-ink/65 hover:text-vb-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink"
      >
        <ArrowLeft size={16} aria-hidden="true" /> Partidos
      </Link>
      {!valido ? (
        <PartidoNoEncontrado rutaActual={rutaActual} conInvitacion={!!invite} />
      ) : partido.isPending ? (
        <Cargando texto="Cargando el partido…" className="min-h-[40dvh]" />
      ) : partido.isError ? (
        esPartidoNoEncontrado(partido.error)
          ? <PartidoNoEncontrado rutaActual={rutaActual} conInvitacion={!!invite} />
          : <ErrorCarga error={partido.error} onRetry={() => partido.refetch()} />
      ) : (
        <DetallePartido partido={partido.data} invite={invite} />
      )}
    </AppShell>
  );
}
