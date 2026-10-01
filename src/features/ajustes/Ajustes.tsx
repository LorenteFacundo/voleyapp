import { useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Select } from '@/components/ui/Input';
import { Tabs } from '@/components/ui/Tabs';
import { SeccionCanchas } from './SeccionCanchas';
import { SeccionClub } from './SeccionClub';
import { SeccionEquipo } from './SeccionEquipo';
import { SeccionHorarios } from './SeccionHorarios';
import { SeccionReservas } from './SeccionReservas';
import { esSeccionAjustes, SECCIONES_AJUSTES, type IrASeccion, type SeccionAjustes } from './secciones';

/**
 * Ajustes del club para dueños. La sección activa vive en la URL (?seccion=)
 * y todas quedan montadas para no perder cambios sin guardar al cambiar de pestaña.
 */
export function Ajustes() {
  const [params, setParams] = useSearchParams();
  const inicio = useRef<HTMLDivElement>(null);
  const pedida = params.get('seccion');
  const actual: SeccionAjustes = esSeccionAjustes(pedida) ? pedida : 'club';

  function cambiar(seccion: SeccionAjustes, extra?: Record<string, string>) {
    setParams((previos) => {
      const nuevos = new URLSearchParams(previos);
      nuevos.set('seccion', seccion);
      for (const [clave, valor] of Object.entries(extra ?? {})) nuevos.set(clave, valor);
      return nuevos;
    }, { replace: true });
  }

  // Desde dentro de una sección (por ejemplo "Completar"): además vuelve arriba.
  const irA: IrASeccion = (seccion, extra) => {
    cambiar(seccion, extra);
    inicio.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div ref={inicio} className="scroll-mt-20">
      <div className="mb-4">
        <h2 className="font-display text-xl font-black text-vb-blue">Ajustes del club</h2>
        <p className="mt-0.5 text-sm text-ink/65">Datos públicos, reglas de reserva, canchas, horarios y equipo.</p>
      </div>

      <Select
        label="Sección"
        className="mb-4 sm:hidden"
        value={actual}
        onChange={(evento) => cambiar(evento.target.value as SeccionAjustes)}
      >
        {SECCIONES_AJUSTES.map((seccion) => <option key={seccion.id} value={seccion.id}>{seccion.label}</option>)}
      </Select>
      <Tabs
        className="mb-5 hidden sm:flex"
        label="Secciones de ajustes"
        tabs={SECCIONES_AJUSTES.map((seccion) => ({ id: seccion.id, label: seccion.label }))}
        activeTab={actual}
        onChange={(seccion) => cambiar(seccion)}
      />

      <div hidden={actual !== 'club'}><SeccionClub /></div>
      <div hidden={actual !== 'reservas'}><SeccionReservas irA={irA} /></div>
      <div hidden={actual !== 'canchas'}><SeccionCanchas irA={irA} /></div>
      <div hidden={actual !== 'horarios'}><SeccionHorarios irA={irA} /></div>
      <div hidden={actual !== 'equipo'}><SeccionEquipo /></div>
    </div>
  );
}
