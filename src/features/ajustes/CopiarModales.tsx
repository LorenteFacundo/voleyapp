import { useState } from 'react';
import type { CanchaGestion } from '@/api/tipos';
import { Button } from '@/components/ui/Button';
import { Aviso } from '@/components/ui/Estados';
import { Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { pluralizar } from '@/lib/format';
import {
  bloquesDelDia, copiarSemana, enumerarBloques, etiquetaRango, nombreDia, planCopiarDia, textoReemplazo, type Bloque,
} from './horarios';
import { SelectorDias } from './SelectorDias';

type CopiarDiaProps = {
  dia: number;
  bloques: Bloque[];
  onAplicar: (bloques: Bloque[]) => void;
  onClose: () => void;
};

/** Copia los bloques de un día a otros días de la misma cancha. */
export function CopiarDiaModal({ dia, bloques, onAplicar, onClose }: CopiarDiaProps) {
  const [destinos, setDestinos] = useState<number[]>([]);
  const origen = bloquesDelDia(bloques, dia);
  const plan = destinos.length ? planCopiarDia(bloques, dia, destinos) : null;
  const conflicto = plan?.conflictos.length
    ? `La copia choca con ${enumerarBloques(plan.conflictos.map((item) => item.existente))}. Revisá esos bloques antes de copiar.`
    : null;

  return (
    <Modal
      open
      onClose={onClose}
      title={`Copiar el ${nombreDia(dia).toLowerCase()}`}
      descripcion={`${pluralizar(origen.length, 'bloque')}: ${origen.map(etiquetaRango).join(', ')}`}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button disabled={!plan || !!conflicto} onClick={() => plan && onAplicar(plan.resultado)}>
            {destinos.length ? `Copiar a ${pluralizar(destinos.length, 'día')}` : 'Copiar'}
          </Button>
        </>
      )}
    >
      <div className="space-y-4">
        <SelectorDias leyenda="Copiar a" seleccionados={destinos} onChange={setDestinos} excluidos={[dia]} />
        <p className="text-sm text-ink/65">Los días elegidos quedan con los mismos horarios y precios. Lo que tenían se reemplaza.</p>
        {conflicto && <Aviso tono="error">{conflicto}</Aviso>}
        {plan && !conflicto && plan.reemplazados.length > 0 && (
          <Aviso tono="alerta">{textoReemplazo(plan.reemplazados)}</Aviso>
        )}
      </div>
    </Modal>
  );
}

type CopiarCanchaProps = {
  destino: CanchaGestion;
  /** Otras canchas con sus bloques actuales (con cambios sin guardar incluidos). */
  origenes: { cancha: CanchaGestion; bloques: Bloque[]; sinGuardar: boolean }[];
  bloquesActuales: number;
  onAplicar: (bloques: Bloque[]) => void;
  onClose: () => void;
};

/** Reemplaza la semana de una cancha por la de otra. */
export function CopiarCanchaModal({ destino, origenes, bloquesActuales, onAplicar, onClose }: CopiarCanchaProps) {
  const conBloques = origenes.filter((origen) => origen.bloques.length > 0);
  const [elegida, setElegida] = useState<number | null>(conBloques[0]?.cancha.id ?? null);
  const origen = conBloques.find((item) => item.cancha.id === elegida) ?? null;

  return (
    <Modal
      open
      onClose={onClose}
      title="Copiar desde otra cancha"
      descripcion={`Los horarios de ${destino.titulo} se reemplazan por los de la cancha que elijas.`}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button disabled={!origen} onClick={() => origen && onAplicar(copiarSemana(origen.bloques))}>Copiar horarios</Button>
        </>
      )}
    >
      {conBloques.length === 0 ? (
        <Aviso tono="info">Ninguna otra cancha tiene horarios cargados todavía.</Aviso>
      ) : (
        <div className="space-y-4">
          <Select
            label="Copiar los horarios de"
            value={elegida ?? ''}
            onChange={(evento) => setElegida(Number(evento.target.value))}
          >
            {conBloques.map((item) => (
              <option key={item.cancha.id} value={item.cancha.id}>
                {item.cancha.titulo} ({pluralizar(item.bloques.length, 'bloque')}{item.sinGuardar ? ', con cambios sin guardar' : ''})
              </option>
            ))}
          </Select>
          {origen && (
            <Aviso tono={bloquesActuales ? 'alerta' : 'info'}>
              {destino.titulo} va a quedar con {pluralizar(origen.bloques.length, 'bloque')}, iguales a los de {origen.cancha.titulo}
              {bloquesActuales ? ` (reemplaza ${bloquesActuales === 1 ? 'el bloque' : `los ${bloquesActuales} bloques`} que tiene ahora)` : ''}.
              {' '}Después podés ajustar precios u horarios.
            </Aviso>
          )}
        </div>
      )}
    </Modal>
  );
}
