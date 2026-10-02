import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import clsx from 'clsx';
import { claves } from '@/api/claves';
import { useNotificaciones, useNotificacionesSinLeer } from '@/api/consultas';
import { jugadorApi } from '@/api/jugador';
import type { Notificacion } from '@/api/tipos';
import { formatRelativo } from '@/lib/date';
import { Cargando, ErrorCarga, Vacio } from '@/components/ui/Estados';

export function NotificationBell() {
  const [abierto, setAbierto] = useState(false);
  const panelId = useId();
  const contenedor = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sinLeer = useNotificacionesSinLeer();
  const lista = useNotificaciones(abierto);

  useEffect(() => {
    if (!abierto) return;
    const cerrar = (evento: MouseEvent | KeyboardEvent) => {
      if (evento instanceof KeyboardEvent ? evento.key === 'Escape' : !contenedor.current?.contains(evento.target as Node)) {
        setAbierto(false);
      }
    };
    document.addEventListener('mousedown', cerrar);
    document.addEventListener('keydown', cerrar);
    return () => {
      document.removeEventListener('mousedown', cerrar);
      document.removeEventListener('keydown', cerrar);
    };
  }, [abierto]);

  const refrescar = () => queryClient.invalidateQueries({ queryKey: claves.notificaciones });

  async function abrirNotificacion(notificacion: Notificacion) {
    setAbierto(false);
    if (!notificacion.leida) {
      await jugadorApi.marcarLeida(notificacion.id).catch(() => undefined);
      void refrescar();
    }
    if (notificacion.url?.startsWith('/')) navigate(notificacion.url);
  }

  async function marcarTodas() {
    await jugadorApi.marcarTodasLeidas().catch(() => undefined);
    void refrescar();
  }

  const cantidad = sinLeer.data ?? 0;

  return (
    <div ref={contenedor} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((valor) => !valor)}
        aria-expanded={abierto}
        aria-controls={panelId}
        aria-label={cantidad ? `Notificaciones (${cantidad} sin leer)` : 'Notificaciones'}
        className="relative grid h-11 w-11 place-items-center rounded-full text-ink/70 transition hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink"
      >
        <Bell size={21} aria-hidden="true" />
        {cantidad > 0 && (
          <span className="absolute right-1.5 top-1.5 grid min-w-5 place-items-center rounded-full bg-vb-orange-ink px-1 text-[11px] font-bold leading-5 text-white">
            {cantidad > 9 ? '9+' : cantidad}
          </span>
        )}
      </button>
      {abierto && (
        <div
          id={panelId}
          className="fixed inset-x-3 top-16 z-50 max-h-[70dvh] overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-soft sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-ink/10 px-4 py-3">
            <h2 className="text-sm font-bold text-ink">Notificaciones</h2>
            {cantidad > 0 && (
              <button type="button" onClick={marcarTodas} className="flex items-center gap-1 text-xs font-semibold text-vb-blue hover:underline">
                <CheckCheck size={14} aria-hidden="true" /> Marcar todas como leídas
              </button>
            )}
          </div>
          <div className="max-h-[60dvh] overflow-y-auto">
            {lista.isPending ? <Cargando /> : lista.isError ? <ErrorCarga error={lista.error} onRetry={() => lista.refetch()} className="m-3" />
              : !lista.data?.length ? <Vacio titulo="No tenés notificaciones" descripcion="Te avisamos acá cuando un club responda o alguien se sume a tu partido." />
                : (
                  <ul className="divide-y divide-ink/5">
                    {lista.data.map((notificacion) => (
                      <li key={notificacion.id}>
                        <button
                          type="button"
                          onClick={() => abrirNotificacion(notificacion)}
                          className={clsx('w-full px-4 py-3 text-left transition hover:bg-ink/5', !notificacion.leida && 'bg-vb-orange-light/60')}
                        >
                          <span className="flex items-start gap-2">
                            {!notificacion.leida && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-vb-orange-ink" aria-label="Sin leer" />}
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-ink">{notificacion.titulo}</span>
                              {notificacion.cuerpo && <span className="mt-0.5 block text-xs text-ink/65">{notificacion.cuerpo}</span>}
                              <span className="mt-1 block text-xs text-ink/65">{formatRelativo(notificacion.created_at)}</span>
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
          </div>
        </div>
      )}
    </div>
  );
}
