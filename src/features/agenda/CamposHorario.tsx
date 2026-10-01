import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { GrupoChips } from './Chips';
import {
  DURACIONES_RAPIDAS, duracionEntre, esHoraValida, horaDeFin, terminaAlDiaSiguiente, textoDuracion,
} from './formulario';

type Props = {
  hora: string;
  duracion: number;
  onHora: (hora: string) => void;
  onDuracion: (minutos: number) => void;
  errorHora?: string | null;
  errorDuracion?: string | null;
  etiquetaHora?: string;
};

const RAPIDAS: readonly number[] = DURACIONES_RAPIDAS;

/** Hora de inicio (de a 5 minutos) y duración con atajos de 1 h, 1 h 30 y 2 h. */
export function CamposHorario({
  hora, duracion, onHora, onDuracion, errorHora, errorDuracion, etiquetaHora = 'Hora de inicio',
}: Props) {
  const [otra, setOtra] = useState(() => !RAPIDAS.includes(duracion));
  const horaValida = esHoraValida(hora);
  const fin = horaValida ? horaDeFin(hora, duracion) : '';
  const alDiaSiguiente = horaValida && terminaAlDiaSiguiente(hora, duracion);
  const opciones: { value: number | 'otra'; label: string }[] = [
    ...RAPIDAS.map((minutos) => ({ value: minutos, label: textoDuracion(minutos) })),
    { value: 'otra', label: 'Otra' },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,11rem)_1fr]">
      <Input
        type="time"
        step={300}
        label={etiquetaHora}
        value={hora}
        required
        error={errorHora}
        onChange={(evento) => onHora(evento.target.value)}
      />
      <div className="min-w-0">
        <GrupoChips
          legend="Duración"
          opciones={opciones}
          value={otra ? 'otra' : duracion}
          error={errorDuracion}
          onChange={(valor) => {
            if (valor === 'otra') {
              setOtra(true);
              return;
            }
            setOtra(false);
            onDuracion(valor);
          }}
        />
        {otra ? (
          <Input
            className="mt-2"
            type="time"
            step={300}
            label="Hasta"
            value={fin}
            disabled={!horaValida}
            hint={horaValida ? `${textoDuracion(duracion)}${alDiaSiguiente ? ', termina al día siguiente' : ''}.` : 'Elegí primero la hora de inicio.'}
            onChange={(evento) => {
              if (horaValida && esHoraValida(evento.target.value)) onDuracion(duracionEntre(hora, evento.target.value));
            }}
          />
        ) : horaValida && (
          <p className="mt-1.5 text-xs text-ink/65">
            Termina a las {fin}{alDiaSiguiente ? ' del día siguiente' : ''}.
          </p>
        )}
      </div>
    </div>
  );
}
