import { Link } from 'react-router-dom';
import { Megaphone, Sparkles } from 'lucide-react';
import type { Reporte } from '@/api/tipos';
import { clasesBoton } from '@/components/ui/estilosBoton';
import { DIAS_SEMANA } from '@/lib/date';
import { useGestion } from '@/contexts/gestion';
import { agruparValles, horasValle, textoPorcentaje } from './reportes';

/** Los horarios con más lugar libre y la sugerencia de llenarlos con un partido abierto. */
export function HorasValle({ calor }: { calor: Reporte['calor'] }) {
  const { clubId } = useGestion();
  const franjas = agruparValles(horasValle(calor));
  if (!franjas.length) {
    if (!calor.some((celda) => Number(celda.disponibles) > 0)) return null;
    return (
      <p className="rounded-2xl border border-vb-gray/10 bg-white p-4 text-sm text-ink/70 shadow-card">
        <Sparkles size={16} className="mr-1 inline text-vb-orange-ink" aria-hidden="true" />
        Sin horas valle: todos los horarios publicados estuvieron ocupados al menos a la mitad.
      </p>
    );
  }

  return (
    <section aria-labelledby="horas-valle" className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <h3 id="horas-valle" className="flex items-center gap-2 text-base font-bold text-amber-950">
        <Sparkles size={18} aria-hidden="true" /> Horas valle
      </h3>
      <p className="mt-1 text-sm text-amber-950/80">
        Estos horarios estuvieron casi vacíos. Un partido abierto los puede llenar con jugadores de la app.
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {franjas.map((franja) => (
          <li key={`${franja.dia}-${franja.desde}`} className="rounded-xl bg-white px-3 py-2 text-sm shadow-sm">
            <span className="font-semibold text-ink">{DIAS_SEMANA[franja.dia]} de {franja.desde} a {franja.hasta} h</span>
            <span className="text-ink/65"> · {textoPorcentaje(franja.ratio)} ocupado</span>
          </li>
        ))}
      </ul>
      <Link to={`/gestion/${clubId}/agenda?publicar=1`} className={clasesBoton({ className: 'mt-4' })}>
        <Megaphone size={16} aria-hidden="true" /> Publicar un partido abierto
      </Link>
    </section>
  );
}
