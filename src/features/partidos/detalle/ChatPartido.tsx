import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MessagesSquare, Send } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { useMensajes } from '@/api/consultas';
import { jugadorApi } from '@/api/jugador';
import { claves } from '@/api/claves';
import { mensajeDeError } from '@/api/cliente';
import type { Mensaje } from '@/api/tipos';
import { fechaArgentina, formatDiaRelativo, horaArgentina } from '@/lib/date';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Cargando, ErrorCarga } from '@/components/ui/Estados';
import { Textarea } from '@/components/ui/Input';
import { Seccion } from '@/features/jugador/Seccion';

const MAX_MENSAJE = 500;
const VISIBLES = 15;
/** Mensajes por pedido al servidor. */
const PAGINA = 50;

/** Charla del partido entre quien organiza y las personas confirmadas. */
export function ChatPartido({ partidoId }: { partidoId: number }) {
  const queryClient = useQueryClient();
  const mensajes = useMensajes(partidoId, true);
  const [texto, setTexto] = useState('');
  const [verTodos, setVerTodos] = useState(false);
  const [anteriores, setAnteriores] = useState<Mensaje[]>([]);
  const [sinMasAnteriores, setSinMasAnteriores] = useState(false);

  const cargarAnteriores = useMutation({
    mutationFn: (antesDe: number) => jugadorApi.mensajes(partidoId, antesDe),
    onSuccess: (pagina) => {
      setAnteriores((previos) => [...pagina, ...previos]);
      if (pagina.length < PAGINA) setSinMasAnteriores(true);
    },
    onError: (error) => toast.error(mensajeDeError(error)),
  });

  const enviar = useMutation({
    mutationFn: (contenido: string) => jugadorApi.enviarMensaje(partidoId, contenido),
    onSuccess: () => {
      setTexto('');
      void queryClient.invalidateQueries({ queryKey: claves.mensajes(partidoId) });
    },
    onError: (error) => toast.error(mensajeDeError(error)),
  });

  function mandar(evento?: FormEvent<HTMLFormElement>) {
    evento?.preventDefault();
    const contenido = texto.trim();
    if (!contenido || enviar.isPending) return;
    enviar.mutate(contenido);
  }

  function alTeclear(evento: KeyboardEvent<HTMLTextAreaElement>) {
    // Ctrl/Cmd + Enter envía; Enter solo hace un salto de línea.
    if (evento.key === 'Enter' && (evento.ctrlKey || evento.metaKey)) {
      evento.preventDefault();
      mandar();
    }
  }

  // Se juntan los recientes (que se refrescan solos) con los anteriores que se
  // pidieron, sin repetir, y se ordenan de arriba hacia abajo.
  const recientes = mensajes.data ?? [];
  const porId = new Map<number, Mensaje>();
  for (const mensaje of [...anteriores, ...recientes]) porId.set(mensaje.id, mensaje);
  const ordenados = [...porId.values()].sort((a, b) => a.id - b.id);
  const ocultos = verTodos ? 0 : Math.max(0, ordenados.length - VISIBLES);
  const visibles = ordenados.slice(ocultos);
  const puedePedirAnteriores = ocultos === 0 && !sinMasAnteriores
    && (anteriores.length > 0 || recientes.length >= PAGINA);

  return (
    <Card padding="lg">
      <Seccion titulo="Charla del partido" descripcion="Solo la ven las personas confirmadas.">
        {mensajes.isPending ? (
          <Cargando texto="Cargando mensajes…" />
        ) : mensajes.isError ? (
          <ErrorCarga error={mensajes.error} onRetry={() => mensajes.refetch()} />
        ) : !ordenados.length ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-line px-4 py-6 text-center">
            <MessagesSquare size={28} className="text-vb-orange-ink" aria-hidden="true" />
            <p className="text-sm text-ink/65">Todavía no hay mensajes. ¡Saludá y coordinen quién lleva la pelota!</p>
          </div>
        ) : (
          <>
            {ocultos > 0 && (
              <div className="mb-3 text-center">
                <Button variant="ghost" size="sm" onClick={() => setVerTodos(true)}>
                  Ver {ocultos === 1 ? '1 mensaje anterior' : `${ocultos} mensajes anteriores`}
                </Button>
              </div>
            )}
            {puedePedirAnteriores && (
              <div className="mb-3 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  loading={cargarAnteriores.isPending}
                  onClick={() => cargarAnteriores.mutate(ordenados[0].id)}
                >
                  Ver mensajes más viejos
                </Button>
              </div>
            )}
            <ol className="space-y-2" aria-label="Mensajes">
              {visibles.map((mensaje) => {
                const fecha = fechaArgentina(mensaje.created_at);
                return (
                  <li key={mensaje.id} className={clsx('flex', mensaje.es_mio ? 'justify-end' : 'justify-start')}>
                    <div
                      className={clsx(
                        'max-w-[85%] rounded-2xl px-3 py-2',
                        mensaje.es_mio ? 'rounded-br-md bg-vb-blue text-white' : 'rounded-bl-md bg-line text-ink',
                      )}
                    >
                      <p className={clsx('text-xs font-bold', mensaje.es_mio ? 'text-white/80' : 'text-vb-orange-ink')}>
                        {mensaje.es_mio ? 'Vos' : mensaje.autor}
                      </p>
                      <p className="whitespace-pre-wrap break-words text-sm">{mensaje.texto}</p>
                      <p className={clsx('mt-0.5 text-right text-[11px]', mensaje.es_mio ? 'text-white/70' : 'text-ink/65')}>
                        <time dateTime={mensaje.created_at}>{formatDiaRelativo(fecha)} · {horaArgentina(mensaje.created_at)}</time>
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        )}

        <form onSubmit={mandar} className="mt-4 space-y-2">
          <Textarea
            label="Escribí un mensaje"
            labelOculto
            rows={2}
            maxLength={MAX_MENSAJE}
            placeholder="Escribí un mensaje para el grupo…"
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            onKeyDown={alTeclear}
            hint={`${texto.length}/${MAX_MENSAJE} · Ctrl + Enter para enviar`}
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" loading={enviar.isPending} disabled={!texto.trim()}>
              {!enviar.isPending && <Send size={16} aria-hidden="true" />} Enviar
            </Button>
          </div>
        </form>
      </Seccion>
    </Card>
  );
}
