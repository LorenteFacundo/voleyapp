import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { AdminPanel } from '@/components/features/AdminPanel';
import { toast } from 'sonner';

export function AdminPage() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  if (creating) {
    return (
      <main className="app-shell min-h-screen px-4 py-5">
        <div className="mx-auto max-w-4xl">
          <AdminPanel
            onBack={() => setCreating(false)}
            onCreated={() => {
              setCreating(false);
              toast.success('Cancha creada exitosamente');
            }}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell min-h-screen px-4 py-5">
      <div className="mx-auto max-w-6xl">
        <AdminDashboard onBack={() => navigate('/')} />
      </div>
    </main>
  );
}
