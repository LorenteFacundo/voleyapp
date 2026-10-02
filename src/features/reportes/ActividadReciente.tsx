import { useId, useState } from 'react';
import { ChevronDown, History } from 'lucide-react';
import clsx from 'clsx';
import { useAuditoriaClub } from '@/api/consultas';
import { Button } from '@/components/ui/Button';
import { Cargando, ErrorCarga } from '@/components/ui/Estados';
import { formatFechaHora, formatRelativo } from '@/lib/date';
import { useGestion } from '@/contexts/gestion';
import { describirEvento } from './auditoria';

const VISIBLES = 20;

/** Registro de lo que hizo el equipo (se carga recién al abrirlo). */
export function ActividadReciente() {
  const [abierta, setAbierta] = useState(false);
  const panelId = useId();

  return (
    <section className="rounded-2xl border border-vb-gray/10 bg-white shadow-card">
      <h3 className="text-base font-bold">
        <button
          type="button"
          aria-expanded={abierta}
          aria-controls={panelId}
          onClick={() => setAbierta(!abierta)}
          className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink"
        >
          <span className="flex items-center gap-2">
            <History size={18} className="text-vb-orange-ink" aria-hidden="true" /> Actividad reciente
          </span>
          <ChevronDown size={18} className={clsx('transition-transform', abierta && 'rotate-180')} aria-hidden="true" />
        </button>
      </h3>
      <div id={panelId} hidden={!abierta} className="border-t border-ink/10 px-4 pb-4">
        {abierta && <ListaActividad />}
      </div>
    </section>
  );
}

function ListaActividad() {
  const { clubId } = useGestion();
  const auditoria = useAuditoriaClub(clubId);
  const [todas, setTodas] = useState(false);

  if (auditoria.isPending) return <Cargando texto="Cargando la actividad…" />;
  if (auditoria.isError) return <ErrorCarga className="mt-4" error={auditoria.error} onRetry={() => auditoria.refetch()} />;
  if (!auditoria.data.length) return <p className="pt-4 text-sm text-ink/65">Todavía no hay actividad registrada.</p>;

  const eventos = todas ? auditoria.data : auditoria.data.slice(0, VISIBLES);
  return (
    <>
      <ul className="divide-y divide-ink/5">
        {eventos.map((evento) => {
          const { titulo, detalle } = describirEvento(evento);
          return (
            <li key={evento.id} className="py-3">
              <p className="text-sm">
                <span className="font-semibold text-ink">{evento.actor}</span>{' '}
                <span className="text-ink/80">{titulo.charAt(0).toLowerCase() + titulo.slice(1)}</span>
              </p>
              {detalle && <p className="text-sm text-ink/65">{detalle}</p>}
              <time dateTime={evento.created_at} title={formatFechaHora(evento.created_at)} className="text-xs text-ink/65">
                {formatRelativo(evento.created_at)}
              </time>
            </li>
          );
        })}
      </ul>
      {auditoria.data.length > VISIBLES && (
        <Button variant="ghost" size="sm" onClick={() => setTodas(!todas)} aria-expanded={todas}>
          {todas ? 'Ver menos' : `Ver todo (${auditoria.data.length})`}
        </Button>
      )}
    </>
  );
}
