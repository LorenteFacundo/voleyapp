import { useState, useRef, useEffect } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotificaciones } from '@/hooks/useNotificaciones';
import { marcarNotificacionLeida, marcarTodasLeidas } from '@/lib/booking';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { Notificacion } from '@/types';

type Props = {
  isAuthenticated: boolean;
};

export function NotificationBell({ isAuthenticated }: Props) {
  const { notificaciones, noLeidas, refresh } = useNotificaciones(isAuthenticated);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Cerrar al hacer click fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  async function handleClickNotif(n: Notificacion) {
    await marcarNotificacionLeida(n.id);
    refresh();
    if (n.partido_id) navigate(`/partido/${n.partido_id}`);
    setOpen(false);
  }

  async function handleMarcarTodas() {
    await marcarTodasLeidas();
    refresh();
  }

  if (!isAuthenticated) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative grid h-9 w-9 place-items-center rounded-lg text-vb-gray/60 transition hover:bg-vb-gray/5 hover:text-vb-gray"
      >
        <Bell size={20} />
        {noLeidas > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-vb-orange px-1 text-[10px] font-bold text-white">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 max-h-96 overflow-hidden rounded-xl border border-vb-gray/10 bg-white shadow-card-hover">
          <div className="flex items-center justify-between border-b border-vb-gray/10 px-4 py-3">
            <h3 className="text-sm font-bold text-vb-blue">Notificaciones</h3>
            {noLeidas > 0 && (
              <button onClick={handleMarcarTodas} className="text-xs text-vb-orange hover:underline">
                Marcar todas leídas
              </button>
            )}
          </div>

          {notificaciones.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-vb-gray/50">
              No tenés notificaciones
            </p>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {notificaciones.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClickNotif(n)}
                  className={`w-full px-4 py-3 text-left transition hover:bg-vb-light ${
                    !n.leida ? 'bg-vb-orange-light/30' : ''
                  }`}
                >
                  <p className={`text-sm ${!n.leida ? 'font-semibold text-vb-blue' : 'text-vb-gray/70'}`}>
                    {n.titulo}
                  </p>
                  <p className="mt-0.5 text-xs text-vb-gray/40">
                    {formatTimestamp(n.created_at)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatTimestamp(ts: string): string {
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'ahora';
  if (diffMin < 60) return `hace ${diffMin}m`;
  const diffHs = Math.floor(diffMin / 60);
  if (diffHs < 24) return `hace ${diffHs}h`;
  const diffDays = Math.floor(diffHs / 24);
  return `hace ${diffDays}d`;
}
