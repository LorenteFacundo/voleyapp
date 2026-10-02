import { toast } from 'sonner';
import type { ResultadoSerie } from '@/api/tipos';
import { formatFechaCorta } from '@/lib/date';
import { pluralizar } from '@/lib/format';
import { fechasCortas } from './fijos';

function omitidas(resultado: ResultadoSerie): string | null {
  return resultado.conflictos.length ? `Se omitieron por choques: ${fechasCortas(resultado.conflictos)}.` : null;
}

export function avisarFijoCreado(resultado: ResultadoSerie): void {
  toast.success(`Fijo creado: ${pluralizar(resultado.creadas, 'fecha reservada', 'fechas reservadas')}.`, {
    description: omitidas(resultado) ?? undefined,
  });
}

export function avisarFijoModificado(resultado: ResultadoSerie, reprogramado: boolean, desde: string): void {
  const canceladas = resultado.canceladas ?? 0;
  const detalle = [
    reprogramado && canceladas > 0 ? `Se liberaron ${pluralizar(canceladas, 'fecha')} del horario anterior.` : null,
    !reprogramado && canceladas > 0 ? `Se liberaron ${pluralizar(canceladas, 'fecha')} después de la nueva fecha de fin.` : null,
    omitidas(resultado),
  ].filter(Boolean).join(' ');
  toast.success(
    reprogramado
      ? `Fijo actualizado desde el ${formatFechaCorta(desde)}: ${pluralizar(resultado.creadas, 'fecha reservada', 'fechas reservadas')}.`
      : 'Cambios guardados en el fijo.',
    { description: detalle || undefined },
  );
}
