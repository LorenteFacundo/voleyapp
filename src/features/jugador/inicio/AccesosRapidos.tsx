import { Link } from 'react-router-dom';
import { CalendarCheck, MapPin, Volleyball, type LucideIcon } from 'lucide-react';
import clsx from 'clsx';

const ACCESOS: { to: string; titulo: string; descripcion: string; icono: LucideIcon; color: string }[] = [
  { to: '/canchas', titulo: 'Reservar cancha', descripcion: 'Horarios libres de cada club', icono: MapPin, color: 'bg-vb-orange-light text-vb-orange-ink' },
  { to: '/partidos', titulo: 'Buscar partido', descripcion: 'Sumate a uno abierto', icono: Volleyball, color: 'bg-blue-50 text-vb-blue' },
  { to: '/mis-reservas', titulo: 'Mis reservas', descripcion: 'Pedidos, pagos y confirmaciones', icono: CalendarCheck, color: 'bg-green-50 text-green-700' },
];

export function AccesosRapidos({ className }: { className?: string }) {
  return (
    <nav aria-label="Accesos rápidos" className={className}>
      <ul className="grid grid-cols-3 gap-2 sm:gap-3">
        {ACCESOS.map((acceso) => (
          <li key={acceso.to}>
            <Link
              to={acceso.to}
              className="flex h-full flex-col items-center gap-2 rounded-2xl border border-vb-gray/10 bg-white px-2 py-3 text-center shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink sm:flex-row sm:gap-3 sm:p-4 sm:text-left"
            >
              <span className={clsx('grid h-11 w-11 shrink-0 place-items-center rounded-xl', acceso.color)} aria-hidden="true">
                <acceso.icono size={22} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold leading-tight text-ink">{acceso.titulo}</span>
                <span className="hidden text-xs text-ink/65 sm:block">{acceso.descripcion}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
