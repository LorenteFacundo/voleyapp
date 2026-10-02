import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle } from 'lucide-react';
import { toast } from 'sonner';
import { clubApi } from '@/api/club';
import { mensajeDeError } from '@/api/cliente';
import { claves } from '@/api/claves';
import type { ClubPanel } from '@/api/tipos';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Aviso } from '@/components/ui/Estados';
import { Switch } from '@/components/ui/Input';
import { useConfirmar } from '@/components/ui/confirmar-contexto';
import { useGestion } from '@/contexts/gestion';
import { Apartado } from './Apartado';
import { checklistPublicacion, type ItemPublicacion } from './club';
import type { IrASeccion, SeccionAjustes } from './secciones';

const DONDE_SE_COMPLETA: Record<ItemPublicacion['id'], SeccionAjustes> = {
  cancha: 'canchas',
  horarios: 'horarios',
  whatsapp: 'club',
  alias: 'club',
};

/** Interruptor para mostrar el club en la app, con lo que falta para hacerlo. */
export function Publicacion({ irA }: { irA: IrASeccion }) {
  const { clubId, panel } = useGestion();
  const { club } = panel;
  const items = checklistPublicacion(club, panel.canchas, panel.horarios);
  const [error, setError] = useState<string | null>(null);
  const confirmar = useConfirmar();
  const queryClient = useQueryClient();

  const publicar = useMutation({
    mutationFn: (publicado: boolean) => clubApi.actualizarClub(clubId, { publicado }),
    onSuccess: (actualizado) => {
      queryClient.setQueryData<ClubPanel>(claves.panel(clubId), (previo) => (previo ? { ...previo, club: actualizado } : previo));
      setError(null);
      toast.success(actualizado.publicado ? '¡Listo! Tu club ya se muestra en VoleyApp.' : 'El club dejó de mostrarse en VoleyApp.');
      void queryClient.invalidateQueries({ queryKey: claves.gestion(clubId) });
      void queryClient.invalidateQueries({ queryKey: claves.catalogo });
      void queryClient.invalidateQueries({ queryKey: claves.disponibilidad });
    },
    onError: (motivo) => {
      const mensaje = mensajeDeError(motivo);
      setError(mensaje);
      toast.error(mensaje);
    },
  });

  async function cambiar(publicado: boolean) {
    if (!publicado) {
      const { confirmado } = await confirmar({
        titulo: '¿Dejar de mostrar el club?',
        descripcion: 'Los jugadores no van a ver el club ni van a poder pedir turnos desde la app. '
          + 'Las reservas que ya tenés no cambian y podés seguir usando la agenda.',
        confirmar: 'Ocultar el club',
        peligro: true,
      });
      if (!confirmado) return;
    }
    publicar.mutate(publicado);
  }

  return (
    <Apartado
      titulo="Publicación"
      descripcion="Mientras el club no esté publicado podés usar la agenda, los clientes y los fijos con normalidad."
    >
      <Switch
        checked={club.publicado}
        onChange={cambiar}
        disabled={publicar.isPending}
        label="Mostrar el club en VoleyApp"
        descripcion={club.publicado
          ? 'Visible: los jugadores encuentran el club y pueden pedir los horarios publicados.'
          : 'Oculto: el club todavía no aparece en la app.'}
      />
      {error && <Aviso tono="error" className="mt-4">{error}</Aviso>}
      <ul className="mt-4 space-y-2" aria-label="Lista para publicar">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink/10 px-3 py-2">
            <span className="flex min-w-0 items-center gap-2 text-sm text-ink">
              {item.listo
                ? <CheckCircle2 size={18} className="shrink-0 text-green-700" aria-hidden="true" />
                : <Circle size={18} className={item.requerido ? 'shrink-0 text-amber-600' : 'shrink-0 text-ink/65'} aria-hidden="true" />}
              <span>
                {item.texto}
                {' '}<span className="sr-only">{item.listo ? '(listo)' : '(pendiente)'}</span>
              </span>
              {!item.listo && <Badge variant={item.requerido ? 'warning' : 'muted'}>{item.requerido ? 'Necesario' : 'Recomendado'}</Badge>}
            </span>
            {!item.listo && (
              <Button variant="ghost" onClick={() => irA(DONDE_SE_COMPLETA[item.id])}>Completar</Button>
            )}
          </li>
        ))}
      </ul>
    </Apartado>
  );
}
