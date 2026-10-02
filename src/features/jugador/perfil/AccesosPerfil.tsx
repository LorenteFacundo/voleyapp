import { Link } from 'react-router-dom';
import { CalendarCheck, CalendarDays, ChevronRight, Shield, Trophy, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';

type Acceso = { to: string; titulo: string; descripcion: string; icono: LucideIcon };

/** Atajos a las otras secciones de la cuenta. */
export function AccesosPerfil({ esStaff, esAdmin }: { esStaff: boolean; esAdmin: boolean }) {
  const accesos: Acceso[] = [
    { to: '/mis-reservas', titulo: 'Mis reservas', descripcion: 'Pedidos, confirmaciones y pagos', icono: CalendarCheck },
    { to: '/partidos?vista=mios', titulo: 'Mis partidos', descripcion: 'Los que organizás y a los que te sumaste', icono: Trophy },
  ];
  if (esStaff) accesos.push({ to: '/gestion', titulo: 'Mi club', descripcion: 'Agenda, clientes y caja de tu club', icono: CalendarDays });
  if (esAdmin) accesos.push({ to: '/admin', titulo: 'Administración', descripcion: 'Panel general de VoleyApp', icono: Shield });

  return (
    <Card padding="none">
      <nav aria-label="Accesos de tu cuenta">
        <ul className="divide-y divide-ink/10">
          {accesos.map((acceso) => (
            <li key={acceso.to}>
              <Link
                to={acceso.to}
                className="flex min-h-16 items-center gap-3 px-4 py-3 transition first:rounded-t-2xl last:rounded-b-2xl hover:bg-ink/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-vb-orange-ink"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-vb-orange-light text-vb-orange-ink" aria-hidden="true">
                  <acceso.icono size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-ink">{acceso.titulo}</span>
                  <span className="block text-xs text-ink/65">{acceso.descripcion}</span>
                </span>
                <ChevronRight size={18} className="text-ink/65" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </Card>
  );
}
