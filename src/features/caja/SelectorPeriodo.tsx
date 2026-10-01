import { Input } from '@/components/ui/Input';
import { describirRango, type Rango } from './periodos';
import { SelectorOpciones } from './SelectorOpciones';

type Props<P extends string> = {
  presets: readonly { id: P; label: string }[];
  preset: P;
  rango: Rango;
  onPreset: (preset: P) => void;
  onRango: (rango: Rango) => void;
  /** Error del rango personalizado (por ejemplo, demasiado largo). */
  error: string | null;
  hoy: string;
  /** Fecha máxima que se puede elegir. */
  maximo?: string;
};

/** Períodos rápidos y, en "Personalizado", las dos fechas. */
export function SelectorPeriodo<P extends string>({
  presets, preset, rango, onPreset, onRango, error, hoy, maximo,
}: Props<P>) {
  const personalizado = preset === 'personalizado';
  return (
    <div className="space-y-3">
      <SelectorOpciones
        legend="Período"
        legendOculta
        opciones={presets.map((opcion) => ({ valor: opcion.id, etiqueta: opcion.label }))}
        valor={preset}
        onChange={onPreset}
      />
      {personalizado && (
        <div className="grid max-w-md grid-cols-2 gap-3">
          <Input
            type="date"
            label="Desde"
            value={rango.desde}
            max={maximo}
            onChange={(evento) => onRango({ ...rango, desde: evento.target.value })}
          />
          <Input
            type="date"
            label="Hasta"
            value={rango.hasta}
            min={rango.desde || undefined}
            max={maximo}
            onChange={(evento) => onRango({ ...rango, hasta: evento.target.value })}
          />
        </div>
      )}
      {error ? (
        <p role="alert" className="text-sm font-medium text-red-700">{error}</p>
      ) : (
        <p className="text-sm text-ink/65">{describirRango(rango, hoy)}</p>
      )}
    </div>
  );
}
