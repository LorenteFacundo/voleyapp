import { CheckCircle2, Settings2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { isAdminGlobal } from '@/lib/roles';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

type UserPanelProps = {
  onNavigateAdmin: () => void;
};

export function UserPanel({ onNavigateAdmin }: UserPanelProps) {
  const { session, perfil } = useAuth();

  if (!session) return null;

  const canManage = isAdminGlobal(perfil?.rol);

  return (
    <Card padding="md">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-md bg-court/10 text-court">
          <CheckCircle2 size={21} />
        </span>
        <div className="flex-1">
          <h2 className="font-bold text-ink">
            {perfil?.nombre_completo ?? session.user.email}
          </h2>
          <p className="text-sm text-ink/60">
            Nivel {perfil?.nivel_voley ?? '-'} &middot; {perfil?.rol ?? 'jugador'}
          </p>
        </div>
      </div>
      {canManage && (
        <Button
          variant="secondary"
          size="sm"
          fullWidth
          className="mt-3"
          onClick={onNavigateAdmin}
        >
          <Settings2 size={16} />
          Gestionar canchas
        </Button>
      )}
    </Card>
  );
}
