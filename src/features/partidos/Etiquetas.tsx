import type { EstadoInscripcion, EstadoPartido } from '@/api/tipos';
import { DIAS_SEMANA_CORTOS, diaSemana } from '@/lib/date';
import { etiquetaNivelPartido, type NivelPartido } from '@/lib/nivel';
import { Badge } from '@/components/ui/Badge';
import { ETIQUETAS_MI_ESTADO, presentarEstadoPartido } from './estado';

const VARIANTE_NIVEL: Record<NivelPartido, 'success' | 'info' | 'court'> = {
  recreativo: 'success',
  intermedio: 'info',
  competitivo: 'court',
};

export function EtiquetaNivel({ nivel }: { nivel: NivelPartido }) {
  return <Badge variant={VARIANTE_NIVEL[nivel] ?? 'default'}>{etiquetaNivelPartido(nivel)}</Badge>;
}

const VARIANTE_MI_ESTADO: Record<EstadoInscripcion, 'success' | 'warning' | 'danger'> = {
  confirmado: 'success',
  pendiente_aprobacion: 'warning',
  rechazado: 'danger',
  pendiente_pago: 'warning',
};

/** "Organizás", "Anotado", "Esperando aprobación"… */
export function EtiquetaMiEstado({ estado, organizo }: { estado: EstadoInscripcion | null; organizo: boolean }) {
  if (organizo) return <Badge variant="info">Organizás</Badge>;
  if (!estado) return null;
  return <Badge variant={VARIANTE_MI_ESTADO[estado]}>{ETIQUETAS_MI_ESTADO[estado]}</Badge>;
}

const VARIANTE_ESTADO: Record<ReturnType<typeof presentarEstadoPartido>['tono'], 'warning' | 'success' | 'info' | 'muted' | 'danger'> = {
  alerta: 'warning',
  exito: 'success',
  info: 'info',
  neutro: 'muted',
  error: 'danger',
};

export function EtiquetaEstadoPartido({ estado }: { estado: EstadoPartido }) {
  const presentacion = presentarEstadoPartido(estado);
  return <Badge variant={VARIANTE_ESTADO[presentacion.tono]}>{presentacion.etiqueta}</Badge>;
}

/** Hoja de calendario con el día de la semana y el número (decorativa). */
export function HojaCalendario({ fecha, apagada = false }: { fecha: string; apagada?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={
        apagada
          ? 'flex h-14 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-ink/5 text-ink/65'
          : 'flex h-14 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-vb-orange-light text-vb-orange-ink'
      }
    >
      <span className="text-[11px] font-bold uppercase leading-none">{DIAS_SEMANA_CORTOS[diaSemana(fecha)]}</span>
      <span className="mt-1 font-display text-xl font-black leading-none">{Number(fecha.slice(8, 10))}</span>
    </span>
  );
}
