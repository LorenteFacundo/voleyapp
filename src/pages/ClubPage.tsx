import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, SearchX } from 'lucide-react';
import { useClubPublico } from '@/api/consultas';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Cargando, ErrorCarga } from '@/components/ui/Estados';
import { clasesBoton } from '@/components/ui/estilosBoton';
import { VistaClub } from '@/features/jugador/club/VistaClub';

function VolverACanchas() {
  return (
    <Link
      to="/canchas"
      className="mb-3 inline-flex min-h-10 items-center gap-1.5 rounded-lg text-sm font-semibold text-ink/65 hover:text-vb-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink"
    >
      <ArrowLeft size={16} aria-hidden="true" /> Todas las canchas
    </Link>
  );
}

function ClubNoEncontrado() {
  return (
    <Card padding="lg" className="mx-auto max-w-lg text-center">
      <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-vb-orange-light text-vb-orange-ink" aria-hidden="true">
        <SearchX size={28} />
      </span>
      <h1 className="font-display text-2xl font-black text-vb-blue">No encontramos este club</h1>
      <p className="mt-2 text-sm text-ink/65">Puede que el enlace esté mal escrito o que el club ya no esté publicado.</p>
      <Link to="/canchas" className={clasesBoton({ variant: 'primary', className: 'mt-5' })}>Ver todas las canchas</Link>
    </Card>
  );
}

export function ClubPage() {
  const { slug } = useParams<{ slug: string }>();
  const club = useClubPublico(slug);

  return (
    <AppShell>
      <VolverACanchas />
      {club.isPending ? (
        <Cargando texto="Cargando el club…" className="min-h-[40dvh]" />
      ) : club.isError ? (
        <ErrorCarga error={club.error} onRetry={() => club.refetch()} />
      ) : !club.data ? (
        <ClubNoEncontrado />
      ) : (
        <VistaClub club={club.data} />
      )}
    </AppShell>
  );
}
