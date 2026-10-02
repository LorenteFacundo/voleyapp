import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ExternalLink, LayoutDashboard, MailPlus, Plus } from 'lucide-react';
import { useClubesAdmin } from '@/api/consultas';
import type { ClubAdmin } from '@/api/tipos';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Cargando, ErrorCarga, Vacio } from '@/components/ui/Estados';
import { Input } from '@/components/ui/Input';
import { pluralizar } from '@/lib/format';
import { etiquetaRol } from '@/features/ajustes/equipo';
import { clasesBoton } from '@/components/ui/estilosBoton';
import { fechaCorta, textoBuscable } from './etiquetas';
import { InvitarDuenoModal } from './InvitarDuenoModal';
import { NuevoClubModal } from './NuevoClubModal';

function TarjetaClub({ club, onInvitar }: { club: ClubAdmin; onInvitar: () => void }) {
  const sinDueno = !club.equipo.some((miembro) => miembro.rol === 'dueno');
  return (
    <li>
      <Card padding="md" className="h-full">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg font-bold text-vb-blue">{club.nombre}</h3>
            <p className="text-sm text-ink/65">
              /club/{club.slug}{club.zona ? ` · ${club.zona}` : ''}
            </p>
          </div>
          {club.publicado ? <Badge variant="success">Publicado</Badge> : <Badge variant="warning">Sin publicar</Badge>}
        </div>

        <p className="mt-2 text-sm text-ink/75">
          {pluralizar(club.canchas, 'cancha activa', 'canchas activas')} · {pluralizar(club.reservas_proximas, 'reserva próxima', 'reservas próximas')}
        </p>
        <p className="text-xs text-ink/65">Alta: {fechaCorta(club.created_at)}</p>

        <div className="mt-3">
          <h4 className="text-xs font-bold uppercase tracking-wide text-ink/65">Equipo</h4>
          {club.equipo.length ? (
            <ul className="mt-1 space-y-0.5 text-sm">
              {club.equipo.map((miembro) => (
                <li key={miembro.email} className="truncate text-ink/75">
                  {miembro.nombre} <span className="text-ink/65">· {etiquetaRol(miembro.rol)} · {miembro.email}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-amber-800">Todavía no tiene equipo.</p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link to={`/gestion/${club.id}/agenda`} className={clasesBoton({ variant: 'secondary' })}>
            <LayoutDashboard size={14} aria-hidden="true" /> Abrir panel
          </Link>
          {club.publicado && (
            <Link to={`/club/${club.slug}`} className={clasesBoton({ variant: 'ghost' })}>
              <ExternalLink size={14} aria-hidden="true" /> Página pública
            </Link>
          )}
          <Button variant={sinDueno ? 'primary' : 'ghost'} onClick={onInvitar}>
            <MailPlus size={14} aria-hidden="true" /> Invitar dueño
          </Button>
        </div>
      </Card>
    </li>
  );
}

export function ClubesAdmin() {
  const clubes = useClubesAdmin();
  const [busqueda, setBusqueda] = useState('');
  const [creando, setCreando] = useState(false);
  const [invitarA, setInvitarA] = useState<ClubAdmin | null>(null);
  const tituloId = useId();

  const nuevo = (
    <Button onClick={() => setCreando(true)}>
      <Plus size={16} aria-hidden="true" /> Nuevo club
    </Button>
  );

  let contenido;
  if (clubes.isPending) contenido = <Cargando texto="Cargando clubes…" />;
  else if (clubes.isError) contenido = <ErrorCarga error={clubes.error} onRetry={() => clubes.refetch()} />;
  else if (!clubes.data.length) {
    contenido = <Vacio icono={<Building2 size={32} />} titulo="Todavía no hay clubes" descripcion="Creá el primero e invitá a su dueño." accion={nuevo} />;
  } else {
    const filtro = textoBuscable(busqueda.trim());
    const visibles = clubes.data.filter((club) => textoBuscable(`${club.nombre} ${club.slug} ${club.zona ?? ''}`).includes(filtro));
    contenido = (
      <>
        <p className="mb-3 text-sm text-ink/65" aria-live="polite">
          {filtro ? `${pluralizar(visibles.length, 'club')} de ${clubes.data.length}` : pluralizar(clubes.data.length, 'club')}
          {' · '}{pluralizar(clubes.data.filter((club) => club.publicado).length, 'publicado')}
        </p>
        {visibles.length ? (
          <ul className="grid gap-3 lg:grid-cols-2">
            {visibles.map((club) => <TarjetaClub key={club.id} club={club} onInvitar={() => setInvitarA(club)} />)}
          </ul>
        ) : (
          <Vacio titulo="Ningún club coincide con la búsqueda" />
        )}
      </>
    );
  }

  return (
    <section aria-labelledby={tituloId}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h2 id={tituloId} className="font-display text-xl font-black text-vb-blue">Clubes</h2>
        <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
          <Input
            label="Buscar club"
            labelOculto
            type="search"
            placeholder="Buscar por nombre o zona"
            className="min-w-0 flex-1 sm:w-64"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
          />
          {nuevo}
        </div>
      </div>
      {contenido}
      {creando && <NuevoClubModal onClose={() => setCreando(false)} />}
      {invitarA && <InvitarDuenoModal club={invitarA} onClose={() => setInvitarA(null)} />}
    </section>
  );
}
