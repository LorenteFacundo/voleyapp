import { CalendarSearch, Check, Clock, Inbox, Mail, MessageCircle, Trophy, X } from 'lucide-react';
import { usePendientes } from '@/api/consultas';
import type { CanchaGestion, Ocupacion } from '@/api/tipos';
import { fechaArgentina, formatDiaRelativo, formatRangoHorario, todayArgentinaISO } from '@/lib/date';
import { enlaceWhatsApp, formatTelefono } from '@/lib/telefono';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Cargando, ErrorCarga, Vacio } from '@/components/ui/Estados';
import { Modal } from '@/components/ui/Modal';
import { useAhora } from './hooks';
import { cuentaRegresiva, montoCorto, nombreDeOcupacion, telefonoDeOcupacion } from './presentacion';
import { useResolverPedido } from './useResolverPedido';

type Props = {
  clubId: number;
  canchas: CanchaGestion[];
  onClose: () => void;
  /** Lleva la agenda al día del pedido y abre su detalle. */
  onVer: (ocupacion: Ocupacion) => void;
};

/** Pedidos hechos desde la app que esperan respuesta del club. */
export function PendientesModal({ clubId, canchas, onClose, onVer }: Props) {
  const pendientes = usePendientes(clubId);
  const ahora = useAhora(15_000);
  const hoy = todayArgentinaISO(new Date(ahora));
  const { confirmar, rechazar, procesando } = useResolverPedido(clubId);
  const titulos = new Map(canchas.map((cancha) => [cancha.id, cancha.titulo]));
  const lista = pendientes.data ?? [];

  return (
    <Modal
      open
      onClose={onClose}
      title="Pedidos sin responder"
      descripcion="Si no los respondés a tiempo, vencen y el horario se libera solo."
      size="lg"
    >
      {pendientes.isPending ? (
        <Cargando texto="Cargando pedidos…" />
      ) : pendientes.isError ? (
        <ErrorCarga error={pendientes.error} onRetry={() => void pendientes.refetch()} />
      ) : lista.length === 0 ? (
        <Vacio
          icono={<Inbox size={32} />}
          titulo="No hay pedidos pendientes"
          descripcion="Cuando alguien pida un horario desde la app, lo vas a ver acá y en la agenda."
        />
      ) : (
        <ul className="space-y-3">
          {lista.map((ocupacion) => {
            const cuenta = ocupacion.vence_at ? cuentaRegresiva(ocupacion.vence_at, ahora) : null;
            const telefono = telefonoDeOcupacion(ocupacion);
            const email = ocupacion.jugador?.email ?? ocupacion.cliente?.email ?? null;
            const enProceso = procesando === ocupacion.id;
            return (
              <li key={ocupacion.id}>
                <article className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-bold text-ink">{nombreDeOcupacion(ocupacion)}</h3>
                      <p className="text-sm font-semibold text-ink/75">
                        {titulos.get(ocupacion.cancha_id) ?? 'Cancha'} · {formatDiaRelativo(fechaArgentina(ocupacion.inicio), hoy)}
                        {' · '}{formatRangoHorario(ocupacion.inicio, ocupacion.fin)}
                      </p>
                    </div>
                    {cuenta && (
                      <Badge variant={cuenta.urgente ? 'danger' : 'warning'}>
                        <Clock size={12} aria-hidden="true" /> {cuenta.texto}
                      </Badge>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    {telefono && (
                      <a
                        href={enlaceWhatsApp(telefono)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-9 items-center gap-1.5 font-semibold text-green-800 hover:underline"
                      >
                        <MessageCircle size={15} aria-hidden="true" /> {formatTelefono(telefono)}
                      </a>
                    )}
                    {email && (
                      <a href={`mailto:${email}`} className="inline-flex min-h-9 items-center gap-1.5 break-all text-ink/70 hover:underline">
                        <Mail size={15} aria-hidden="true" /> {email}
                      </a>
                    )}
                    <span className="inline-flex min-h-9 items-center text-ink/70">
                      {montoCorto(ocupacion.precio)}
                      {Number(ocupacion.sena) > 0 ? ` · seña ${montoCorto(ocupacion.sena)}` : ''}
                    </span>
                  </div>

                  {ocupacion.partido && (
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-ink/70">
                      <Trophy size={15} aria-hidden="true" /> Quiere armar un partido abierto
                      ({ocupacion.partido.ocupados}/{ocupacion.partido.cupo_maximo} anotados).
                    </p>
                  )}
                  {ocupacion.notas && (
                    <p className="mt-2 whitespace-pre-line rounded-xl bg-white/80 px-3 py-2 text-sm text-ink/80">“{ocupacion.notas}”</p>
                  )}

                  <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                    <Button
                      variant="ghost"
                      className="col-span-2 sm:order-first sm:mr-auto"
                      onClick={() => onVer(ocupacion)}
                    >
                      <CalendarSearch size={17} aria-hidden="true" /> Ver en la agenda
                    </Button>
                    <Button variant="secondary" disabled={procesando !== null} onClick={() => void rechazar(ocupacion)}>
                      <X size={17} aria-hidden="true" /> Rechazar
                    </Button>
                    <Button
                      variant="success"
                      loading={enProceso}
                      disabled={procesando !== null && !enProceso}
                      onClick={() => confirmar(ocupacion)}
                    >
                      <Check size={17} aria-hidden="true" /> Confirmar
                    </Button>
                  </div>
                  <p className="sr-only" aria-live="polite">{enProceso ? 'Procesando el pedido…' : ''}</p>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
