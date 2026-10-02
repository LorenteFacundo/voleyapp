import { useState } from 'react';
import { CalendarSearch, Sun, Umbrella, Volleyball } from 'lucide-react';
import clsx from 'clsx';
import type { CanchaPublica } from '@/api/tipos';
import { formatMoney } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Seccion } from '../Seccion';
import { etiquetaSuperficie } from './politicas';

function FotosCancha({ fotos, titulo }: { fotos: string[]; titulo: string }) {
  const [actual, setActual] = useState(0);
  const visibles = fotos.slice(0, 5);
  return (
    <div>
      <img
        src={visibles[actual] ?? visibles[0]}
        alt={`${titulo}, foto ${actual + 1} de ${visibles.length}`}
        loading="lazy"
        decoding="async"
        className="aspect-[16/9] w-full bg-ink/5 object-cover"
      />
      {visibles.length > 1 && (
        <div className="flex gap-1.5 px-4 pt-3">
          {visibles.map((foto, indice) => (
            <button
              key={foto}
              type="button"
              onClick={() => setActual(indice)}
              aria-label={`Ver foto ${indice + 1} de ${titulo}`}
              aria-pressed={indice === actual}
              className={clsx(
                'h-11 w-14 overflow-hidden rounded-lg border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink',
                indice === actual ? 'border-vb-orange-ink' : 'border-transparent opacity-70 hover:opacity-100',
              )}
            >
              <img src={foto} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Ficha de cada cancha del club: fotos, tipo, superficie y precio de referencia. */
export function CanchasClub({ canchas, onVerHorarios }: { canchas: CanchaPublica[]; onVerHorarios: (canchaId: number) => void }) {
  if (!canchas.length) return null;
  return (
    <Seccion titulo={canchas.length === 1 ? 'La cancha' : 'Las canchas'}>
      <ul className="grid gap-4 sm:grid-cols-2">
        {canchas.map((cancha) => {
          const superficie = etiquetaSuperficie(cancha.superficie);
          return (
            <li key={cancha.id}>
              <Card padding="none" className="flex h-full flex-col overflow-hidden">
                {cancha.fotos?.length ? (
                  <FotosCancha fotos={cancha.fotos} titulo={cancha.titulo} />
                ) : (
                  <div className="grid aspect-[16/9] place-items-center bg-gradient-to-br from-vb-blue to-[#2c3aa3]" aria-hidden="true">
                    <Volleyball size={44} className="text-white/25" />
                  </div>
                )}
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="font-display text-base font-black text-vb-blue">{cancha.titulo}</h3>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge variant={cancha.techada ? 'info' : 'court'}>
                      {cancha.techada ? <Umbrella size={12} aria-hidden="true" /> : <Sun size={12} aria-hidden="true" />}
                      {cancha.techada ? 'Techada' : 'Al aire libre'}
                    </Badge>
                    {superficie && <Badge variant="muted">{superficie}</Badge>}
                  </div>
                  {cancha.descripcion && <p className="mt-2 whitespace-pre-line text-sm text-ink/65">{cancha.descripcion}</p>}
                  {cancha.precio_total > 0 && (
                    <p className="mt-2 text-sm text-ink/70">
                      Turno <strong className="text-ink">{formatMoney(cancha.precio_total)}</strong>
                      {cancha.precio_sena > 0 && <> · Seña {formatMoney(cancha.precio_sena)}</>}
                    </p>
                  )}
                  <div className="mt-auto pt-3">
                    <Button variant="secondary" size="sm" onClick={() => onVerHorarios(cancha.id)}>
                      <CalendarSearch size={16} aria-hidden="true" /> Ver horarios de esta cancha
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </Seccion>
  );
}
