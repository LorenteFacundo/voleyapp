import { useId } from 'react';
import { Globe, Link2 } from 'lucide-react';
import clsx from 'clsx';
import { NIVELES_PARTIDO, type NivelPartido } from '@/lib/nivel';
import { formatMoney } from '@/lib/format';
import { Input, Select, Switch, Textarea } from '@/components/ui/Input';
import { Contador } from './Contador';
import { precioSugerido } from './cupo';
import { CUPO_MAXIMO, CUPO_MINIMO, MAX_DESCRIPCION, textoPrecio, type ErroresPartido, type FormularioPartido } from './formulario';

const VISIBILIDADES = [
  { valor: 'publico', titulo: 'Público', descripcion: 'Aparece en "Buscar partido" para todos.', icono: Globe },
  { valor: 'enlace', titulo: 'Solo con enlace', descripcion: 'Lo ve y se suma quien tenga el enlace.', icono: Link2 },
] as const;

/**
 * Campos para organizar o editar un partido. `anotados` son las personas con
 * cuenta que ya ocupan lugar (al crear, solo quien organiza).
 */
export function CamposPartido({
  valor, onChange, errores, precioTotal, anotados,
}: {
  valor: FormularioPartido;
  onChange: (cambios: Partial<FormularioPartido>) => void;
  errores: ErroresPartido;
  precioTotal: number;
  anotados: number;
}) {
  const id = useId();
  const sugerido = precioSugerido(precioTotal, valor.cupoMaximo);
  const maxInvitados = Math.max(0, valor.cupoMaximo - anotados);

  return (
    <div className="space-y-5">
      <div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3">
          <Contador
            etiqueta="Mínimo para jugar"
            valor={valor.cupoMinimo}
            min={CUPO_MINIMO}
            max={valor.cupoMaximo}
            onChange={(cupoMinimo) => onChange({ cupoMinimo })}
          />
          <Contador
            etiqueta="Máximo de jugadores"
            valor={valor.cupoMaximo}
            min={Math.max(CUPO_MINIMO, valor.cupoMinimo, anotados + valor.invitados)}
            max={CUPO_MAXIMO}
            onChange={(cupoMaximo) => onChange({ cupoMaximo })}
          />
          <Contador
            etiqueta="Invitados sin cuenta"
            valor={valor.invitados}
            min={0}
            max={maxInvitados}
            onChange={(invitados) => onChange({ invitados })}
            ayuda="Gente que traés y no usa la app."
          />
        </div>
        {(errores.cupo || errores.invitados) && (
          <p role="alert" className="mt-2 text-sm text-red-700">{errores.cupo ?? errores.invitados}</p>
        )}
      </div>

      <Select
        label="Nivel requerido"
        value={valor.nivel}
        onChange={(evento) => onChange({ nivel: evento.target.value as NivelPartido })}
        hint="Solo se pueden sumar jugadores con ese nivel o más (según su perfil)."
      >
        {NIVELES_PARTIDO.map((nivel) => <option key={nivel.value} value={nivel.value}>{nivel.label}</option>)}
      </Select>

      <fieldset>
        <legend className="mb-1 text-sm font-semibold text-ink">¿Quién lo puede ver?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {VISIBILIDADES.map((opcion) => {
            const elegida = valor.visibilidad === opcion.valor;
            return (
              <label
                key={opcion.valor}
                className={clsx(
                  'flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition',
                  'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-vb-orange-ink',
                  elegida ? 'border-vb-orange-ink bg-vb-orange-light' : 'border-ink/15 bg-white hover:border-vb-orange/60',
                )}
              >
                <input
                  type="radio"
                  name={`${id}-visibilidad`}
                  value={opcion.valor}
                  checked={elegida}
                  onChange={() => onChange({ visibilidad: opcion.valor })}
                  className="mt-1 h-4 w-4 shrink-0 accent-vb-orange-ink"
                />
                <opcion.icono size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-ink/65" />
                <span className="min-w-0 text-sm font-bold text-ink">
                  {opcion.titulo}
                  <span className="block text-xs font-normal text-ink/65">{opcion.descripcion}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <Switch
        checked={valor.requiereAprobacion}
        onChange={(requiereAprobacion) => onChange({ requiereAprobacion })}
        label="Aprobar a cada jugador"
        descripcion="Elegís vos quién entra. Si lo dejás apagado, se suman directo."
      />

      <div>
        <Input
          label="Precio por jugador"
          inputMode="decimal"
          autoComplete="off"
          value={textoPrecio(valor, precioTotal)}
          onChange={(evento) => onChange({ precio: evento.target.value })}
          error={errores.precio}
          hint={precioTotal > 0
            ? `La cancha sale ${formatMoney(precioTotal)}. Sugerido: ${formatMoney(sugerido)} (dividido ${valor.cupoMaximo}). Vacío = a definir.`
            : 'Dejalo vacío si todavía no lo sabés.'}
        />
        {valor.precio !== null && precioTotal > 0 && valor.precio !== String(sugerido) && (
          <button
            type="button"
            onClick={() => onChange({ precio: null })}
            className="mt-1 min-h-9 rounded-lg text-sm font-semibold text-vb-blue underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink"
          >
            Usar el sugerido ({formatMoney(sugerido)})
          </button>
        )}
      </div>

      <Textarea
        label="Descripción (opcional)"
        rows={3}
        maxLength={MAX_DESCRIPCION}
        placeholder="Ej.: Mixto, traemos pelota. Se paga en el club."
        value={valor.descripcion}
        onChange={(evento) => onChange({ descripcion: evento.target.value })}
        error={errores.descripcion}
        hint={`${valor.descripcion.length}/${MAX_DESCRIPCION}`}
      />
    </div>
  );
}
