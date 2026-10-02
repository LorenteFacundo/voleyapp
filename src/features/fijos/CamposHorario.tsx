import { useState } from 'react';
import type { CanchaGestion } from '@/api/tipos';
import { Input, Select } from '@/components/ui/Input';
import { DIAS_LUNES_A_DOMINGO, DIAS_SEMANA, formatDuracion } from '@/lib/date';
import { SelectorOpciones } from '@/features/caja/SelectorOpciones';
import { DURACIONES, DURACIONES_RAPIDAS, horaFin, type ErroresHorario, type Horario } from './fijos';

type Props = {
  valor: Horario;
  onChange: (valor: Horario) => void;
  errores: ErroresHorario;
  canchas: Pick<CanchaGestion, 'id' | 'titulo'>[];
};

type OpcionDuracion = number | 'otra';

const OPCIONES_DURACION: { valor: OpcionDuracion; etiqueta: string }[] = [
  ...DURACIONES_RAPIDAS.map((minutos) => ({ valor: minutos, etiqueta: formatDuracion(minutos) })),
  { valor: 'otra', etiqueta: 'Otra' },
];

const HORA_VALIDA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Cancha, día, hora de inicio y duración de un fijo. */
export function CamposHorario({ valor, onChange, errores, canchas }: Props) {
  const [otraDuracion, setOtraDuracion] = useState(
    () => !(DURACIONES_RAPIDAS as readonly number[]).includes(valor.duracion),
  );
  const cambiar = (cambios: Partial<Horario>) => onChange({ ...valor, ...cambios });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Cancha"
          value={valor.canchaId ?? ''}
          onChange={(evento) => cambiar({ canchaId: evento.target.value ? Number(evento.target.value) : null })}
          error={errores.canchaId}
        >
          {valor.canchaId === null && <option value="">Elegí una cancha</option>}
          {canchas.map((cancha) => <option key={cancha.id} value={cancha.id}>{cancha.titulo}</option>)}
        </Select>
        <Select
          label="Día"
          value={valor.dia}
          onChange={(evento) => cambiar({ dia: Number(evento.target.value) })}
          error={errores.dia}
        >
          {DIAS_LUNES_A_DOMINGO.map((dia) => <option key={dia} value={dia}>{DIAS_SEMANA[dia]}</option>)}
        </Select>
      </div>
      <Input
        type="time"
        label="Hora de inicio"
        step={300}
        value={valor.hora}
        onChange={(evento) => cambiar({ hora: evento.target.value })}
        error={errores.hora}
        hint={HORA_VALIDA.test(valor.hora) && !errores.duracion
          ? `Termina a las ${horaFin(valor.hora, valor.duracion)}.`
          : 'Por ejemplo 19:30.'}
        className="sm:max-w-[50%] sm:pr-2"
      />
      <div className="space-y-2">
        <SelectorOpciones
          legend="Duración"
          opciones={OPCIONES_DURACION}
          valor={otraDuracion ? 'otra' : valor.duracion}
          onChange={(opcion) => {
            if (opcion === 'otra') {
              setOtraDuracion(true);
              return;
            }
            setOtraDuracion(false);
            cambiar({ duracion: opcion });
          }}
        />
        {otraDuracion && (
          <Select
            label="Duración exacta"
            value={valor.duracion}
            onChange={(evento) => cambiar({ duracion: Number(evento.target.value) })}
            error={errores.duracion}
            className="sm:max-w-[50%] sm:pr-2"
          >
            {DURACIONES.map((minutos) => <option key={minutos} value={minutos}>{formatDuracion(minutos)}</option>)}
          </Select>
        )}
        {!otraDuracion && errores.duracion && <p role="alert" className="text-sm text-red-700">{errores.duracion}</p>}
      </div>
    </div>
  );
}
