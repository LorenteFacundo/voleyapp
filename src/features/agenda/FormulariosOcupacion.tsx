import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { clubApi, type CambiosOcupacion } from '@/api/club';
import { mensajeDeError } from '@/api/cliente';
import type { CanchaGestion, Ocupacion } from '@/api/tipos';
import {
  esFechaISO, fechaArgentina, horaArgentina, instanteArgentina, minutosEntre, sumarMinutos,
} from '@/lib/date';
import { Button } from '@/components/ui/Button';
import { Aviso } from '@/components/ui/Estados';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { CamposHorario } from './CamposHorario';
import { GrupoChips } from './Chips';
import { errorDeDuracion, errorDeHora } from './formulario';
import { useInvalidarAgenda } from './hooks';
import { parsearMonto } from './precios';
import { usaLaApp } from './presentacion';

type PropsFormulario = {
  clubId: number;
  ocupacion: Ocupacion;
  onListo: (ocupacion: Ocupacion) => void;
  onVolver: () => void;
};

function textoMonto(valor: number): string {
  return valor ? String(Number(valor)) : '';
}

/** Precio, seña, título y notas. Solo se envían los datos que cambiaron. */
export function EditarOcupacionForm({ clubId, ocupacion, onListo, onVolver }: PropsFormulario) {
  const invalidar = useInvalidarAgenda(clubId);
  const [precio, setPrecio] = useState(() => textoMonto(ocupacion.precio));
  const [sena, setSena] = useState(() => textoMonto(ocupacion.sena));
  const [titulo, setTitulo] = useState(ocupacion.titulo ?? '');
  const [notas, setNotas] = useState(ocupacion.notas ?? '');
  const [errores, setErrores] = useState<{ precio?: string; sena?: string }>({});

  const guardar = useMutation({
    mutationFn: (cambios: CambiosOcupacion) => clubApi.actualizarOcupacion(ocupacion.id, cambios),
    onSuccess: (actualizada) => {
      toast.success('Guardaste los cambios.');
      onListo(actualizada);
    },
    onSettled: () => {
      void invalidar({ clienteId: ocupacion.cliente?.id });
    },
  });

  const enviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const nuevoPrecio = precio.trim() ? parsearMonto(precio) : 0;
    const nuevaSena = sena.trim() ? parsearMonto(sena) : 0;
    const nuevosErrores: { precio?: string; sena?: string } = {};
    if (nuevoPrecio === null) nuevosErrores.precio = 'Revisá el precio.';
    if (nuevaSena === null) nuevosErrores.sena = 'Revisá la seña.';
    else if (nuevoPrecio !== null && nuevaSena > nuevoPrecio) nuevosErrores.sena = 'La seña no puede superar el precio.';
    setErrores(nuevosErrores);
    if (Object.keys(nuevosErrores).length || nuevoPrecio === null || nuevaSena === null) return;

    const cambios: CambiosOcupacion = {};
    if (nuevoPrecio !== Number(ocupacion.precio)) cambios.precio = nuevoPrecio;
    if (nuevaSena !== Number(ocupacion.sena)) cambios.sena = nuevaSena;
    if (titulo.trim() !== (ocupacion.titulo ?? '')) cambios.titulo = titulo.trim() || null;
    if (notas.trim() !== (ocupacion.notas ?? '')) cambios.notas = notas.trim() || null;
    if (!Object.keys(cambios).length) {
      onVolver();
      return;
    }
    guardar.mutate(cambios);
  };

  return (
    <form onSubmit={enviar} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Precio"
          inputMode="decimal"
          autoComplete="off"
          value={precio}
          error={errores.precio}
          onChange={(evento) => setPrecio(evento.target.value)}
        />
        <Input
          label="Seña"
          inputMode="decimal"
          autoComplete="off"
          value={sena}
          error={errores.sena}
          hint="Lo que se pide para confirmar."
          onChange={(evento) => setSena(evento.target.value)}
        />
      </div>
      <Input
        label="Título (opcional)"
        placeholder="Ej.: Clase, Torneo, Cumpleaños"
        maxLength={120}
        value={titulo}
        onChange={(evento) => setTitulo(evento.target.value)}
      />
      <Textarea label="Notas" maxLength={500} value={notas} onChange={(evento) => setNotas(evento.target.value)} />
      {guardar.isError && <Aviso tono="error">{mensajeDeError(guardar.error)}</Aviso>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onVolver} disabled={guardar.isPending}>Volver</Button>
        <Button type="submit" loading={guardar.isPending}>Guardar cambios</Button>
      </div>
    </form>
  );
}

/** Cambiar cancha, día u horario. El servidor rechaza si se superpone. */
export function MoverOcupacionForm({ clubId, ocupacion, canchas, onListo, onVolver }: PropsFormulario & { canchas: CanchaGestion[] }) {
  const invalidar = useInvalidarAgenda(clubId);
  const [canchaId, setCanchaId] = useState(ocupacion.cancha_id);
  const [fecha, setFecha] = useState(() => fechaArgentina(ocupacion.inicio));
  const [hora, setHora] = useState(() => horaArgentina(ocupacion.inicio));
  const [duracion, setDuracion] = useState(() => minutosEntre(ocupacion.inicio, ocupacion.fin));
  const [intento, setIntento] = useState(false);

  const opcionesCancha = canchas
    .filter((cancha) => cancha.activa || cancha.id === ocupacion.cancha_id)
    .map((cancha) => ({ value: cancha.id, label: cancha.titulo }));
  const errorFecha = esFechaISO(fecha) ? null : 'Elegí una fecha.';
  const errorHora = errorDeHora(hora);
  const errorDur = errorDeDuracion(duracion);

  const mover = useMutation({
    mutationFn: (datos: { inicio: string; fin: string }) => clubApi.moverOcupacion(ocupacion.id, canchaId, datos.inicio, datos.fin),
    onSuccess: (movida) => {
      toast.success(usaLaApp(movida) && movida.serie_id == null
        ? 'Moviste la reserva. Le avisamos por la app.'
        : 'Moviste la reserva.');
      onListo(movida);
    },
    onSettled: () => {
      void invalidar({ clienteId: ocupacion.cliente?.id });
    },
  });

  const enviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setIntento(true);
    if (errorFecha || errorHora || errorDur) return;
    const inicio = instanteArgentina(fecha, hora);
    mover.mutate({ inicio, fin: sumarMinutos(inicio, duracion) });
  };

  return (
    <form onSubmit={enviar} className="space-y-4" noValidate>
      {opcionesCancha.length > 6 ? (
        <Select label="Cancha" value={canchaId} onChange={(evento) => setCanchaId(Number(evento.target.value))}>
          {opcionesCancha.map((opcion) => <option key={opcion.value} value={opcion.value}>{opcion.label}</option>)}
        </Select>
      ) : (
        <GrupoChips legend="Cancha" opciones={opcionesCancha} value={canchaId} onChange={setCanchaId} />
      )}
      <Input
        type="date"
        label="Fecha"
        value={fecha}
        error={intento ? errorFecha : null}
        onChange={(evento) => setFecha(evento.target.value)}
      />
      <CamposHorario
        hora={hora}
        duracion={duracion}
        onHora={setHora}
        onDuracion={setDuracion}
        errorHora={intento ? errorHora : null}
        errorDuracion={intento ? errorDur : null}
      />
      {mover.isError && <Aviso tono="error">{mensajeDeError(mover.error)}</Aviso>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onVolver} disabled={mover.isPending}>Volver</Button>
        <Button type="submit" loading={mover.isPending}>Mover reserva</Button>
      </div>
    </form>
  );
}
