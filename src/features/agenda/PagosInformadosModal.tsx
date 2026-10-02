import { Banknote } from 'lucide-react';
import { usePagosInformados } from '@/api/consultas';
import type { CanchaGestion, Ocupacion } from '@/api/tipos';
import { fechaArgentina, formatDiaRelativo, formatRangoHorario, formatRelativo } from '@/lib/date';
import { Button } from '@/components/ui/Button';
import { Cargando, ErrorCarga, Vacio } from '@/components/ui/Estados';
import { Modal } from '@/components/ui/Modal';
import { useAhora } from './hooks';
import { montoCorto, nombreDeOcupacion, saldoDe } from './presentacion';

type Props = {
  clubId: number;
  canchas: CanchaGestion[];
  hoy: string;
  onClose: () => void;
  /** Abre el detalle para registrar el pago. */
  onVer: (ocupacion: Ocupacion) => void;
};

/** Jugadores que avisaron que transfirieron y todavía no tienen el pago registrado. */
export function PagosInformadosModal({ clubId, canchas, hoy, onClose, onVer }: Props) {
  const ahora = useAhora(60_000);
  const pagos = usePagosInformados(clubId);
  const titulos = new Map(canchas.map((cancha) => [cancha.id, cancha.titulo]));
  const lista = pagos.data ?? [];

  return (
    <Modal
      open
      onClose={onClose}
      title="Pagos informados"
      descripcion="Avisaron que transfirieron: verificá en tu cuenta y registrá el pago."
      size="lg"
    >
      {pagos.isPending ? (
        <Cargando texto="Buscando pagos informados…" />
      ) : pagos.isError ? (
        <ErrorCarga error={pagos.error} onRetry={() => void pagos.refetch()} />
      ) : (
        <div className="space-y-3">
          {lista.length === 0 ? (
            <Vacio
              icono={<Banknote size={32} />}
              titulo="No hay pagos para revisar"
              descripcion="Cuando un jugador avise desde la app que te transfirió, aparece acá."
            />
          ) : (
            <ul className="divide-y divide-ink/10 rounded-2xl border border-ink/10">
              {lista.map((ocupacion) => (
                <li key={ocupacion.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-ink">{nombreDeOcupacion(ocupacion)}</p>
                    <p className="text-sm text-ink/70">
                      {titulos.get(ocupacion.cancha_id) ?? 'Cancha'} · {formatDiaRelativo(fechaArgentina(ocupacion.inicio), hoy)}
                      {' · '}{formatRangoHorario(ocupacion.inicio, ocupacion.fin)}
                    </p>
                    <p className="text-sm text-violet-800">
                      Avisó {formatRelativo(ocupacion.pago_informado_at ?? ocupacion.created_at, new Date(ahora))} · falta cobrar{' '}
                      <strong>{montoCorto(saldoDe(ocupacion))}</strong>
                      {Number(ocupacion.sena) > 0 && Number(ocupacion.pagado) === 0 ? ` (seña ${montoCorto(ocupacion.sena)})` : ''}
                    </p>
                  </div>
                  <Button variant="secondary" onClick={() => onVer(ocupacion)}>Registrar pago</Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}
