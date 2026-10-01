import { Phone } from 'lucide-react';
import type { Perfil } from '@/api/tipos';
import { useLogros } from '@/api/consultas';
import { etiquetaNivelVoley } from '@/lib/nivel';
import { formatNumero, iniciales } from '@/lib/format';
import { formatTelefono } from '@/lib/telefono';
import { Card } from '@/components/ui/Card';
import { resumenLogros } from './logros';
import { nombreVisible } from './nombre';

/** Encabezado del perfil: avatar, datos de contacto y estadísticas. */
export function ResumenPerfil({ perfil }: { perfil: Perfil }) {
  const logros = useLogros();
  const { obtenidos, total } = resumenLogros(logros.data);
  const nombre = nombreVisible(perfil);

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="relative overflow-hidden bg-vb-blue px-5 pb-5 pt-6 text-white">
        <span className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full border-[1.75rem] border-vb-orange/80" aria-hidden="true" />
        <div className="relative flex items-center gap-4">
          <span
            className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-vb-orange-ink font-display text-2xl font-black text-white ring-4 ring-white/15"
            aria-hidden="true"
          >
            {iniciales(nombre)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-xl font-black leading-tight text-white">{nombre}</p>
            <p className="truncate text-sm text-white/70">{perfil.email}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold text-white">
                Nivel {etiquetaNivelVoley(perfil.nivel).toLowerCase()}
              </span>
              {perfil.clubes.length > 0 && (
                <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold text-white">Equipo de club</span>
              )}
              {perfil.es_admin && (
                <span className="rounded-full bg-vb-yellow px-2.5 py-0.5 text-xs font-bold text-vb-blue">Administración</span>
              )}
            </div>
          </div>
        </div>
        <p className="relative mt-4 flex items-center gap-1.5 text-sm text-white/80">
          <Phone size={15} aria-hidden="true" />
          {perfil.telefono ? formatTelefono(perfil.telefono) : 'Sin teléfono: sumalo para que los clubes puedan avisarte.'}
        </p>
      </div>
      <dl className="grid grid-cols-3 divide-x divide-ink/10">
        <div className="px-2 py-4 text-center">
          <dt className="text-xs font-semibold text-ink/65">Puntos</dt>
          <dd className="font-display text-2xl font-black text-vb-blue">{formatNumero(perfil.puntos)}</dd>
        </div>
        <div className="px-2 py-4 text-center">
          <dt className="text-xs font-semibold text-ink/65">Partidos jugados</dt>
          <dd className="font-display text-2xl font-black text-vb-blue">{formatNumero(perfil.partidos_jugados)}</dd>
        </div>
        <div className="px-2 py-4 text-center">
          <dt className="text-xs font-semibold text-ink/65">Logros</dt>
          <dd className="font-display text-2xl font-black text-vb-blue">
            {logros.isSuccess ? `${obtenidos}/${total}` : '–'}
          </dd>
        </div>
      </dl>
    </Card>
  );
}
