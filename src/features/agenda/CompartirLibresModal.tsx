import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAgenda, useDisponibilidad } from '@/api/consultas';
import type { ClubPanel } from '@/api/tipos';
import { addDaysToISODate, diferenciaEnDias, formatFechaCorta } from '@/lib/date';
import { enlaceCompartirWhatsApp } from '@/lib/telefono';
import { Button } from '@/components/ui/Button';
import { Aviso, Cargando, ErrorCarga, Vacio } from '@/components/ui/Estados';
import { Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { GrupoChips } from './Chips';
import { libresCalculados, libresDeDisponibilidad, textoTurnosLibres } from './compartir';
import { EnlaceWhatsApp } from '@/components/ui/EnlaceWhatsApp';
import { useAhora } from './hooks';
import { copiarAlPortapapeles } from '@/lib/portapapeles';

type Props = {
  clubId: number;
  panel: ClubPanel;
  esDueno: boolean;
  hoy: string;
  /** Día que se estaba mirando en la agenda (se ofrece como opción). */
  fechaVista: string;
  onClose: () => void;
};

type Periodo = { id: string; label: string; desde: string; hasta: string; nombre: string };

export function CompartirLibresModal({ clubId, panel, esDueno, hoy, fechaVista, onClose }: Props) {
  const ahora = useAhora(60_000);
  const manana = addDaysToISODate(hoy, 1);
  const periodos = useMemo(() => {
    const lista: Periodo[] = [
      { id: 'hoy', label: 'Hoy', desde: hoy, hasta: hoy, nombre: 'hoy' },
      { id: 'manana', label: 'Mañana', desde: manana, hasta: manana, nombre: 'mañana' },
      { id: 'semana', label: 'Esta semana', desde: hoy, hasta: addDaysToISODate(hoy, 6), nombre: 'en los próximos 7 días' },
    ];
    if (fechaVista > manana && diferenciaEnDias(hoy, fechaVista) <= 30) {
      const corta = formatFechaCorta(fechaVista);
      lista.push({ id: 'dia', label: corta.charAt(0).toUpperCase() + corta.slice(1), desde: fechaVista, hasta: fechaVista, nombre: `el ${corta}` });
    }
    return lista;
  }, [hoy, manana, fechaVista]);
  const [periodoId, setPeriodoId] = useState(() => (fechaVista === manana ? 'manana' : fechaVista > manana ? 'dia' : 'hoy'));
  const periodo = periodos.find((item) => item.id === periodoId) ?? periodos[0];
  const [editado, setEditado] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const publicado = panel.club.publicado;
  // Publicado: la disponibilidad pública (respeta anticipación y ventana).
  // Sin publicar: se calcula con la agenda, porque la disponibilidad pública no lo incluye.
  const disponibilidad = useDisponibilidad(publicado ? { clubId, desde: periodo.desde, hasta: periodo.hasta } : null);
  const agenda = useAgenda(publicado ? null : clubId, periodo.desde, addDaysToISODate(periodo.hasta, 1));
  const consulta = publicado ? disponibilidad : agenda;
  const cargando = consulta.isPending || consulta.isPlaceholderData;

  const canchas = useMemo(() => panel.canchas.filter((cancha) => cancha.activa), [panel.canchas]);
  const libres = useMemo(() => {
    if (publicado) return libresDeDisponibilidad(disponibilidad.data?.bloques ?? []);
    return libresCalculados({
      horarios: panel.horarios,
      canchas: new Set(canchas.map((cancha) => cancha.id)),
      ocupaciones: agenda.data?.ocupaciones ?? [],
      desde: periodo.desde,
      hasta: periodo.hasta,
      ahora,
    });
  }, [publicado, disponibilidad.data, agenda.data, panel.horarios, canchas, periodo, ahora]);

  const enlace = `${window.location.origin}/club/${panel.club.slug}`;
  const generado = textoTurnosLibres({
    club: panel.club.nombre,
    libres,
    canchas: panel.canchas,
    hoy,
    cierre: publicado ? `Reservá acá: ${enlace}` : 'Respondé este mensaje para reservar.',
  });
  const texto = editado ?? generado ?? '';
  const hayHorarios = panel.horarios.some((horario) => horario.activo);

  const copiar = async () => {
    const ok = await copiarAlPortapapeles(texto);
    if (!ok) {
      toast.error('No pudimos copiar el texto. Seleccionalo y copialo a mano.');
      return;
    }
    setCopiado(true);
    toast.success('Copiado. Pegalo en WhatsApp, un grupo o tus estados.');
    window.setTimeout(() => setCopiado(false), 2500);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Compartir turnos libres"
      descripcion="Armamos el mensaje con los horarios libres, listo para mandar por WhatsApp."
      size="md"
      footer={texto && !cargando ? (
        <>
          <Button variant="secondary" onClick={() => void copiar()}>
            {copiado ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}
            {copiado ? 'Copiado' : 'Copiar'}
          </Button>
          <EnlaceWhatsApp href={enlaceCompartirWhatsApp(texto)} variante="destacado">Enviar por WhatsApp</EnlaceWhatsApp>
        </>
      ) : (
        <Button variant="secondary" onClick={onClose}>Cerrar</Button>
      )}
    >
      <div className="space-y-4">
        <GrupoChips
          legend="¿Qué turnos?"
          opciones={periodos.map((item) => ({ value: item.id, label: item.label }))}
          value={periodo.id}
          onChange={(id) => {
            setPeriodoId(id);
            setEditado(null);
            setCopiado(false);
          }}
        />

        {!publicado && (
          <Aviso tono="alerta" titulo="Tu club todavía no está publicado">
            Los jugadores no pueden ver la página del club ni reservar desde la app, así que el mensaje los invita a
            responderte por WhatsApp.{' '}
            {esDueno && (
              <Link to={`/gestion/${clubId}/ajustes`} className="font-semibold underline">Publicalo desde Ajustes.</Link>
            )}
          </Aviso>
        )}

        {cargando ? (
          <Cargando texto="Buscando turnos libres…" />
        ) : consulta.isError ? (
          <ErrorCarga error={consulta.error} onRetry={() => void consulta.refetch()} />
        ) : !generado ? (
          <Vacio
            icono={<Share2 size={32} />}
            titulo={`No hay turnos libres ${periodo.nombre}`}
            descripcion={!hayHorarios
              ? 'Todavía no hay horarios publicados para tus canchas.'
              : publicado
                ? 'Los horarios publicados están ocupados o ya no se pueden pedir con la anticipación mínima.'
                : 'Los horarios publicados están ocupados.'}
          />
        ) : (
          <Textarea
            label="Mensaje"
            hint="Podés editarlo antes de copiarlo o enviarlo."
            rows={Math.min(14, texto.split('\n').length + 1)}
            value={texto}
            onChange={(evento) => setEditado(evento.target.value)}
          />
        )}
      </div>
    </Modal>
  );
}
