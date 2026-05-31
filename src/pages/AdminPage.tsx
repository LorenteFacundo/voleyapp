import { useNavigate } from 'react-router-dom';
import { AdminPanel } from '@/components/features/AdminPanel';
import { toast } from 'sonner';

export function AdminPage() {
  const navigate = useNavigate();

  return (
    <main className="app-shell min-h-screen px-4 py-5">
      <div className="mx-auto max-w-4xl">
        <AdminPanel
          onBack={() => navigate('/')}
          onCreated={() => toast.success('Cancha creada exitosamente')}
        />
      </div>
    </main>
  );
}
