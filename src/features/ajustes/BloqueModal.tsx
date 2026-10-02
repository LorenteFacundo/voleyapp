import { useId, useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import type { BloqueHorario } from '@/api/tipos';
import { Button } from '@/components/ui/Button';
import { Aviso } from '@/components/ui/Estados';
import { Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { formatDuracion } from '@/lib/date';
import { errorMonto, parsearMonto, textoMonto } from './club';
import {
  DIAS_EDITOR, duracionBloque, enumerarBloques, esHora, finVisible, nombreDia, nuevaClave, superposiciones,
  terminaAlDiaSiguiente, validarBloque, type Bloque,
} from './horarios';

type Props = {
  /** null para agregar uno nuevo. */
  bloque: Bloque | null;
  /** Valores iniciales de un bloque nuevo. */
  sugerido: BloqueHorario;
  /** Toda la semana, para avisar superposiciones. */
  bloques: Bloque[];
  canchaTitulo: string;
  onAplicar: (bloque: Bloque) => void;
  onEliminar: (bloque: Bloque) => void;
  onClose: () => void;
};

type Form = { dia: number; inicio: string; fin: string; precio: string; sena: string };

function aForm(bloque: BloqueHorario): Form {
  return {
    dia: bloque.dia_semana,
    inicio: bloque.hora_inicio,
    fin: bloque.hora_fin,
    precio: textoMonto(bloque.precio_total),
    sena: bloque.precio_sena ? textoMonto(bloque.precio_sena) : '',
  };
}

/** Alta o edición de un bloque del borrador (se guarda con "Guardar horarios"). */
export function BloqueModal({ bloque, sugerido, bloques, canchaTitulo, onAplicar, onEliminar, onClose }: Props) {
  const [form, setForm] = useState<Form>(() => aForm(bloque ?? sugerido));
  const [intentado, setIntentado] = useState(false);
  const formId = useId();

  const editar = <K extends keyof Form>(campo: K, valor: Form[K]) => setForm((previo) => ({ ...previo, [campo]: valor }));

  const candidato: Bloque = {
    clave: bloque?.clave ?? '',
    dia_semana: form.dia,
    hora_inicio: form.inicio,
    hora_fin: form.fin,
    precio_total: parsearMonto(form.precio) ?? 0,
    precio_sena: parsearMonto(form.sena) ?? 0,
  };
  const horasCompletas = esHora(form.inicio) && esHora(form.fin);
  const duracion = horasCompletas ? duracionBloque(form.inicio, form.fin) : 0;
  const errorMontos = errorMonto(form.precio) ?? errorMonto(form.sena, false);
  // Las superposiciones no dependen de los precios (pueden estar a medio escribir).
  const choques = horasCompletas ? superposiciones({ ...candidato, precio_total: 0, precio_sena: 0 }, bloques) : [];
  // Los errores de montos se muestran en cada campo; el resto, en un aviso.
  const errorBloque = errorMontos ? null : validarBloque(candidato);
  const problema = choques.length
    ? `Se superpone con ${enumerarBloques(choques)}.`
    : horasCompletas || intentado ? errorBloque : null;

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setIntentado(true);
    if (errorMontos || errorBloque || choques.length) return;
    onAplicar({ ...candidato, clave: bloque?.clave ?? nuevaClave() });
  }

  const siguiente = (form.dia + 1) % 7;

  return (
    <Modal
      open
      onClose={onClose}
      title={bloque ? 'Editar bloque' : 'Agregar bloque'}
      descripcion={canchaTitulo}
      footer={(
        <>
          {bloque && (
            <Button variant="ghost" className="text-red-700 sm:mr-auto" onClick={() => onEliminar(bloque)}>
              <Trash2 size={16} aria-hidden="true" /> Eliminar bloque
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form={formId}>{bloque ? 'Aplicar cambios' : 'Agregar'}</Button>
        </>
      )}
    >
      <form id={formId} onSubmit={enviar} noValidate className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Día"
          className="sm:col-span-2"
          value={form.dia}
          onChange={(evento) => editar('dia', Number(evento.target.value))}
        >
          {DIAS_EDITOR.map((dia) => <option key={dia} value={dia}>{nombreDia(dia)}</option>)}
        </Select>
        <Input label="Desde" type="time" step={300} required value={form.inicio} onChange={(evento) => editar('inicio', evento.target.value)} />
        <Input
          label="Hasta"
          type="time"
          step={300}
          required
          value={form.fin}
          onChange={(evento) => editar('fin', evento.target.value)}
          hint="Si termina a medianoche, poné 00:00."
        />
        {horasCompletas && duracion > 0 && (
          <p className="text-sm text-ink/70 sm:col-span-2" role="status">
            Dura {formatDuracion(duracion)}
            {terminaAlDiaSiguiente(candidato) && ` · termina el ${nombreDia(siguiente).toLowerCase()} a las ${finVisible(candidato)}`}.
          </p>
        )}
        <Input
          label="Precio"
          inputMode="numeric"
          placeholder="30.000"
          value={form.precio}
          error={intentado ? errorMonto(form.precio) : null}
          onChange={(evento) => editar('precio', evento.target.value)}
          hint="Lo que paga el grupo por el turno completo."
        />
        <Input
          label="Seña (opcional)"
          inputMode="numeric"
          placeholder="10.000"
          value={form.sena}
          error={intentado ? errorMonto(form.sena, false) : null}
          onChange={(evento) => editar('sena', evento.target.value)}
          hint="Lo que pedís para confirmar. No puede superar el precio."
        />
        {problema && <Aviso tono={intentado ? 'error' : 'alerta'} className="sm:col-span-2">{problema}</Aviso>}
        <p className="text-xs text-ink/65 sm:col-span-2">Los cambios quedan en borrador hasta que toques “Guardar horarios”.</p>
      </form>
    </Modal>
  );
}
