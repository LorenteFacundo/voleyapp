import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Copy, Eraser, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { clubApi } from '@/api/club';
import { mensajeDeError } from '@/api/cliente';
import { claves } from '@/api/claves';
import { Button } from '@/components/ui/Button';
import { Aviso, Vacio } from '@/components/ui/Estados';
import { Select } from '@/components/ui/Input';
import { useConfirmar } from '@/components/ui/confirmar-contexto';
import { pluralizar } from '@/lib/format';
import { useGestion } from '@/contexts/gestion';
import { Apartado } from './Apartado';
import { BarraGuardar } from './BarraGuardar';
import { BloqueModal } from './BloqueModal';
import { CopiarCanchaModal, CopiarDiaModal } from './CopiarModales';
import { EditorSemana } from './EditorSemana';
import { GeneradorModal } from './GeneradorModal';
import {
  aPayload, bloquesPorCancha, describirBloque, firmaBloques, guardarBloque, ordenarBloques, quitarBloque, sugerirBloque,
  validarSemana, type Bloque,
} from './horarios';
import type { IrASeccion } from './secciones';
import { useAvisoSalida } from './useCambios';

type Dialogo =
  | { tipo: 'bloque'; bloque: Bloque | null; dia: number }
  | { tipo: 'generador' }
  | { tipo: 'copiar-dia'; dia: number }
  | { tipo: 'copiar-cancha' };

/**
 * Plantilla semanal de bloques que los jugadores pueden pedir, por cancha. Los
 * cambios quedan en borrador (por cancha) hasta guardarlos.
 */
export function SeccionHorarios({ irA }: { irA: IrASeccion }) {
  const { clubId, panel } = useGestion();
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const confirmar = useConfirmar();
  const [borradores, setBorradores] = useState<Record<number, Bloque[]>>({});
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const guardados = useMemo(() => bloquesPorCancha(panel.horarios), [panel.horarios]);
  const inactivosGuardados = panel.horarios.filter((horario) => !horario.activo);

  const { canchas } = panel;
  const pedida = Number(params.get('cancha'));
  const cancha = canchas.find((item) => item.id === pedida) ?? canchas.find((item) => item.activa) ?? canchas[0] ?? null;

  const bloquesDe = (id: number) => borradores[id] ?? guardados[id] ?? [];
  const sinGuardar = (id: number) => borradores[id] !== undefined && firmaBloques(borradores[id]) !== firmaBloques(guardados[id] ?? []);
  const canchasSinGuardar = canchas.filter((item) => sinGuardar(item.id));
  useAvisoSalida(canchasSinGuardar.length > 0);

  const guardar = useMutation({
    mutationFn: ({ canchaId, bloques }: { canchaId: number; bloques: Bloque[] }) => clubApi.guardarHorarios(canchaId, aPayload(bloques)),
    onSuccess: async (cantidad, { canchaId }) => {
      // Se espera la recarga para no mostrar por un instante los horarios viejos.
      await queryClient.invalidateQueries({ queryKey: claves.gestion(clubId) });
      setBorradores(({ [canchaId]: _guardado, ...resto }) => resto);
      void queryClient.invalidateQueries({ queryKey: claves.catalogo });
      void queryClient.invalidateQueries({ queryKey: claves.disponibilidad });
      toast.success(cantidad
        ? `Horarios guardados: ${pluralizar(cantidad, 'bloque')} por semana.`
        : 'Horarios guardados: la cancha quedó sin bloques para reservar.');
    },
    onError: (error) => toast.error(mensajeDeError(error)),
  });

  if (!cancha) {
    return (
      <Apartado titulo="Horarios publicados">
        <Vacio
          icono={<CalendarClock size={32} />}
          titulo="Primero creá una cancha"
          descripcion="Los horarios se cargan por cancha. Creá al menos una y volvé acá."
          accion={<Button onClick={() => irA('canchas')}>Ir a Canchas</Button>}
        />
      </Apartado>
    );
  }

  const canchaId = cancha.id;
  const bloques = bloquesDe(canchaId);
  const validacion = validarSemana(bloques);
  const pendiente = sinGuardar(canchaId);
  const bloqueado = guardar.isPending;
  const otrasSinGuardar = canchasSinGuardar.filter((item) => item.id !== canchaId);
  const inactivos = inactivosGuardados.filter((horario) => horario.cancha_id === canchaId).length;

  function modificar(id: number, cambio: (actuales: Bloque[]) => Bloque[]) {
    setBorradores((previos) => ({ ...previos, [id]: ordenarBloques(cambio(previos[id] ?? guardados[id] ?? [])) }));
  }

  function elegirCancha(id: number) {
    setParams((previos) => {
      const nuevos = new URLSearchParams(previos);
      nuevos.set('cancha', String(id));
      return nuevos;
    }, { replace: true });
  }

  function quitar(bloque: Bloque) {
    modificar(canchaId, (actuales) => quitarBloque(actuales, bloque.clave));
    toast(`Quitaste ${describirBloque(bloque)}.`, {
      description: 'Se aplica cuando guardes los horarios.',
      action: { label: 'Deshacer', onClick: () => modificar(canchaId, (actuales) => guardarBloque(actuales, bloque)) },
    });
  }

  async function vaciar() {
    const { confirmado } = await confirmar({
      titulo: `¿Quitar todos los bloques de ${cancha?.titulo}?`,
      descripcion: 'La cancha queda sin horarios para reservar desde la app. No se aplica hasta que guardes.',
      confirmar: 'Quitar todos',
      peligro: true,
    });
    if (confirmado) modificar(canchaId, () => []);
  }

  async function descartar() {
    const { confirmado } = await confirmar({
      titulo: '¿Descartar los cambios?',
      descripcion: `Los horarios de ${cancha?.titulo} vuelven a como estaban guardados.`,
      confirmar: 'Descartar',
      peligro: true,
    });
    if (confirmado) setBorradores(({ [canchaId]: _descartado, ...resto }) => resto);
  }

  function aplicarYCerrar(nuevos: Bloque[]) {
    modificar(canchaId, () => nuevos);
    setDialogo(null);
  }

  return (
    <div className="space-y-5">
      <Apartado
        titulo="Horarios publicados"
        descripcion="Los turnos que los jugadores pueden pedir desde la app y la página del club, con su precio y seña. Fuera de estos horarios igual podés cargar reservas a mano en la Agenda."
      >
        <div className="space-y-4">
          {canchas.length > 1 && (
            <Select
              label="Cancha"
              className="max-w-sm"
              value={canchaId}
              onChange={(evento) => elegirCancha(Number(evento.target.value))}
            >
              {canchas.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.titulo}{item.activa ? '' : ' (inactiva)'}{sinGuardar(item.id) ? ' · sin guardar' : ''}
                </option>
              ))}
            </Select>
          )}

          {!cancha.activa && (
            <Aviso tono="alerta">
              {cancha.titulo} está inactiva: sus horarios no se muestran a los jugadores hasta que la actives en Canchas.
            </Aviso>
          )}
          {!panel.club.publicado && (
            <Aviso tono="info">
              Tu club todavía no está publicado: los jugadores van a ver estos horarios cuando lo publiques.{' '}
              <button type="button" className="font-semibold underline" onClick={() => irA('reservas')}>Ir a Publicación</button>
            </Aviso>
          )}
          {otrasSinGuardar.length > 0 && (
            <Aviso tono="alerta">
              También tenés cambios sin guardar en {otrasSinGuardar.map((item) => item.titulo).join(', ')}.{' '}
              <button type="button" className="font-semibold underline" onClick={() => elegirCancha(otrasSinGuardar[0].id)}>
                Ver {otrasSinGuardar[0].titulo}
              </button>
            </Aviso>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setDialogo({ tipo: 'generador' })} disabled={bloqueado}>
              <Wand2 size={16} aria-hidden="true" /> Generar bloques
            </Button>
            {canchas.length > 1 && (
              <Button variant="secondary" onClick={() => setDialogo({ tipo: 'copiar-cancha' })} disabled={bloqueado}>
                <Copy size={16} aria-hidden="true" /> Copiar de otra cancha
              </Button>
            )}
            {bloques.length > 0 && (
              <Button variant="ghost" onClick={vaciar} disabled={bloqueado}>
                <Eraser size={16} aria-hidden="true" /> Vaciar semana
              </Button>
            )}
            <p className="ml-auto text-sm text-ink/65" aria-live="polite">
              {pluralizar(bloques.length, 'bloque')} por semana{pendiente ? ' (sin guardar)' : ''}
            </p>
          </div>

          {validacion.total > 0 && (
            <Aviso tono="error" titulo={validacion.total === 1 ? 'Hay un problema para resolver antes de guardar' : `Hay ${validacion.total} problemas para resolver antes de guardar`}>
              <ul className="list-disc space-y-0.5 pl-5">
                {validacion.generales.map((mensaje) => <li key={mensaje}>{mensaje}</li>)}
                {ordenarBloques(bloques)
                  .filter((bloque) => validacion.porBloque[bloque.clave])
                  .map((bloque) => (
                    <li key={bloque.clave}>{describirBloque(bloque)}: {validacion.porBloque[bloque.clave].join(' ')}</li>
                  ))}
              </ul>
            </Aviso>
          )}

          {inactivos > 0 && !pendiente && (
            <p className="text-xs text-ink/65">
              Además hay {pluralizar(inactivos, 'bloque desactivado', 'bloques desactivados')} de la versión anterior: no se muestran a los
              jugadores y se descartan la próxima vez que guardes.
            </p>
          )}

          <EditorSemana
            bloques={bloques}
            errores={validacion.porBloque}
            bloqueado={bloqueado}
            onAgregar={(dia) => setDialogo({ tipo: 'bloque', bloque: null, dia })}
            onEditar={(bloque) => setDialogo({ tipo: 'bloque', bloque, dia: bloque.dia_semana })}
            onQuitar={quitar}
            onCopiarDia={(dia) => setDialogo({ tipo: 'copiar-dia', dia })}
          />
        </div>
      </Apartado>

      <BarraGuardar
        visible={pendiente}
        mensaje={`Cambios sin guardar en ${cancha.titulo}.`}
        guardando={bloqueado}
        onDescartar={descartar}
        onGuardar={() => guardar.mutate({ canchaId, bloques })}
        textoGuardar="Guardar horarios"
        deshabilitado={validacion.total > 0}
      />

      {dialogo?.tipo === 'bloque' && (
        <BloqueModal
          bloque={dialogo.bloque}
          sugerido={sugerirBloque(bloques, dialogo.dia, cancha)}
          bloques={bloques}
          canchaTitulo={cancha.titulo}
          onAplicar={(bloque) => {
            modificar(canchaId, (actuales) => guardarBloque(actuales, bloque));
            setDialogo(null);
          }}
          onEliminar={(bloque) => {
            quitar(bloque);
            setDialogo(null);
          }}
          onClose={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === 'generador' && (
        <GeneradorModal
          canchaTitulo={cancha.titulo}
          bloques={bloques}
          precio={cancha.precio_total}
          sena={cancha.precio_sena}
          onAplicar={aplicarYCerrar}
          onClose={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === 'copiar-dia' && (
        <CopiarDiaModal dia={dialogo.dia} bloques={bloques} onAplicar={aplicarYCerrar} onClose={() => setDialogo(null)} />
      )}
      {dialogo?.tipo === 'copiar-cancha' && (
        <CopiarCanchaModal
          destino={cancha}
          origenes={canchas
            .filter((item) => item.id !== canchaId)
            .map((item) => ({ cancha: item, bloques: bloquesDe(item.id), sinGuardar: sinGuardar(item.id) }))}
          bloquesActuales={bloques.length}
          onAplicar={aplicarYCerrar}
          onClose={() => setDialogo(null)}
        />
      )}
    </div>
  );
}
