import { useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { toast } from 'sonner';
import { enviarMensaje } from '@/lib/booking';
import { useMensajesPartido } from '@/hooks/useMensajesPartido';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';

type Props = {
  partidoId: number;
  puedeEscribir: boolean;
};

export function MatchMessages({ partidoId, puedeEscribir }: Props) {
  const { mensajes, loading, refresh } = useMensajesPartido(partidoId);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function handleEnviar() {
    if (!texto.trim()) return;
    setEnviando(true);
    try {
      await enviarMensaje(partidoId, texto);
      setTexto('');
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al enviar mensaje');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card padding="lg">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-vb-blue">
        <MessageSquare size={20} />
        Muro del partido
      </h2>

      {loading ? (
        <div className="grid gap-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={60} rounded />)}
        </div>
      ) : mensajes.length === 0 ? (
        <p className="py-6 text-center text-sm text-vb-gray/60">
          Todavía no hay mensajes. Sé el primero en saludar.
        </p>
      ) : (
        <div className="mb-4 grid gap-3 max-h-80 overflow-y-auto">
          {mensajes.map((m) => (
            <div key={m.id} className="flex gap-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-vb-orange-light text-vb-orange text-xs font-bold">
                {(m.nombre ?? 'U')[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-vb-blue">{m.nombre}</span>
                  <span className="text-xs text-vb-gray/40">{formatTimestamp(m.created_at)}</span>
                </div>
                <p className="text-sm text-vb-gray break-words">{m.texto}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {puedeEscribir && (
        <div className="flex gap-2 border-t border-vb-gray/10 pt-3">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value.slice(0, 500))}
            placeholder="Escribí un mensaje..."
            rows={1}
            className="flex-1 resize-none rounded-lg border border-vb-gray/15 px-3 py-2 text-sm focus:border-vb-orange focus:outline-none"
            maxLength={500}
          />
          <Button size="sm" onClick={handleEnviar} loading={enviando} disabled={!texto.trim()}>
            <Send size={16} />
          </Button>
        </div>
      )}
    </Card>
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
  if (diffDays < 7) return `hace ${diffDays}d`;
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}
