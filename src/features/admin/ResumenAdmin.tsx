import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Play } from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { adminApi } from '@/api/admin';
import { mensajeDeError } from '@/api/cliente';
import { useResumenAdmin } from '@/api/consultas';
import type { EstadoOperacion, ResumenAdmin as DatosResumen } from '@/api/tipos';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Aviso, Cargando, ErrorCarga } from '@/components/ui/Estados';
import { formatNumero } from '@/lib/format';
import { TAREAS_PROGRAMADAS } from './etiquetas';

type Tono = 'normal' | 'alerta' | 'error' | 'info';

type Indicador = { titulo: string; valor: number; detalle?: string; tono?: Tono; enlace?: string };

const TONOS: Record<Tono, string> = {
  normal: 'text-vb-blue',
  alerta: 'text-amber-700',
  error: 'text-red-700',
  info: 'text-vb-orange-ink',
};

function indicadores(resumen: DatosResumen): Indicador[] {
  return [
    { titulo: 'Clubes', valor: resumen.clubes, detalle: `${formatNumero(resumen.clubes_publicados)} publicados`, enlace: '/admin/clubes' },
    { titulo: 'Canchas activas', valor: resumen.canchas },
    { titulo: 'Usuarios', valor: resumen.usuarios, detalle: `+${formatNumero(resumen.usuarios_semana)} esta semana`, enlace: '/admin/usuarios' },
    { titulo: 'Reservas nuevas (7 días)', valor: resumen.reservas_semana, detalle: `${formatNumero(resumen.reservas_app_semana)} desde la app, sin contar fijos` },
    {
      titulo: 'Pedidos pendientes',
      valor: resumen.pendientes,
      detalle: 'Esperan respuesta de un club',
      tono: resumen.pendientes > 0 ? 'alerta' : 'normal',
    },
    {
      titulo: 'Vencidos (7 días)',
      valor: resumen.vencidas_semana,
      detalle: 'Pedidos que no se respondieron a tiempo',
      tono: resumen.vencidas_semana > 0 ? 'alerta' : 'normal',
    },
    {
      titulo: 'Clubes interesados nuevos',
      valor: resumen.leads_nuevos,
      detalle: 'Desde el formulario de la web',
      tono: resumen.leads_nuevos > 0 ? 'info' : 'normal',
      enlace: '/admin/solicitudes',
    },
    {
      titulo: 'Emails con error',
      valor: resumen.envios_con_error,
      detalle: 'Avisos que no se pudieron enviar',
      tono: resumen.envios_con_error > 0 ? 'error' : 'normal',
    },
  ];
}

function TarjetaIndicador({ indicador }: { indicador: Indicador }) {
  const contenido: ReactNode = (
    <>
      <span className="flex items-start justify-between gap-2 text-sm font-semibold text-ink/65">
        {indicador.titulo}
        {indicador.enlace && <ChevronRight size={16} className="shrink-0 text-ink/65" aria-hidden="true" />}
      </span>
      <span className={clsx('mt-1 block font-display text-3xl font-black', TONOS[indicador.tono ?? 'normal'])}>
        {formatNumero(indicador.valor)}
      </span>
      {indicador.detalle && <span className="mt-0.5 block text-xs text-ink/65">{indicador.detalle}</span>}
    </>
  );
  const clases = 'block h-full rounded-2xl border border-vb-gray/10 bg-white p-4 shadow-card';
  return indicador.enlace ? (
    <Link
      to={indicador.enlace}
      className={clsx(clases, 'transition hover:border-vb-orange/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink')}
    >
      {contenido}
    </Link>
  ) : (
    <div className={clases}>{contenido}</div>
  );
}

function EstadoActual({ operacion }: { operacion: EstadoOperacion }) {
  return (
    <Aviso
      tono={operacion.reservas_pausadas ? 'alerta' : 'exito'}
      titulo={operacion.reservas_pausadas ? 'Las reservas de jugadores están pausadas' : 'Las reservas de jugadores están habilitadas'}
    >
      {operacion.reservas_pausadas && operacion.motivo_pausa && <p>Mensaje para jugadores: “{operacion.motivo_pausa}”.</p>}
      <p>
        {operacion.requiere_lista_acceso
          ? 'Solo pueden reservar las cuentas habilitadas en la lista de acceso del piloto.'
          : 'Cualquier cuenta con el email confirmado puede reservar.'}{' '}
        <Link to="/admin/operacion" className="font-semibold underline">Cambiar</Link>
      </p>
    </Aviso>
  );
}

function TareasProgramadas() {
  const queryClient = useQueryClient();
  const [resultado, setResultado] = useState<Record<string, number> | null>(null);
  const ejecutar = useMutation({
    mutationFn: () => adminApi.ejecutarTareas(),
    onSuccess: (datos) => {
      setResultado(datos);
      toast.success('Tareas ejecutadas.');
      void queryClient.invalidateQueries();
    },
    onError: (error) => toast.error(mensajeDeError(error)),
  });

  return (
    <Card padding="lg">
      <h2 className="font-display text-lg font-bold text-vb-blue">Tareas automáticas</h2>
      <p className="mt-1 max-w-2xl text-sm text-ink/65">
        Vencen los pedidos que los clubes no respondieron a tiempo, se envían los recordatorios del día anterior, se cierran
        los partidos ya jugados (con sus puntos) y se generan las próximas fechas de los alquileres fijos. Normalmente las
        corre la base de datos sola (pg_cron); usá este botón si no está activo o para no esperar.
      </p>
      <Button className="mt-4" variant="blue" loading={ejecutar.isPending} onClick={() => ejecutar.mutate()}>
        <Play size={16} aria-hidden="true" /> Ejecutar tareas ahora
      </Button>
      {resultado && (
        <dl className="mt-4 grid gap-2 sm:grid-cols-2" aria-live="polite">
          {Object.entries(resultado).map(([clave, cantidad]) => (
            <div key={clave} className="flex items-center justify-between gap-3 rounded-xl bg-ink/5 px-3 py-2">
              <dt className="text-sm text-ink/70">{TAREAS_PROGRAMADAS[clave] ?? clave}</dt>
              <dd className="font-display text-lg font-black text-vb-blue">{formatNumero(cantidad)}</dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  );
}

export function ResumenAdmin() {
  const resumen = useResumenAdmin();
  if (resumen.isPending) return <Cargando texto="Cargando el resumen…" />;
  if (resumen.isError) return <ErrorCarga error={resumen.error} onRetry={() => resumen.refetch()} />;

  return (
    <div className="space-y-5">
      <h2 className="sr-only">Resumen</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {indicadores(resumen.data).map((indicador) => <TarjetaIndicador key={indicador.titulo} indicador={indicador} />)}
      </div>
      <EstadoActual operacion={resumen.data.operacion} />
      <TareasProgramadas />
    </div>
  );
}
