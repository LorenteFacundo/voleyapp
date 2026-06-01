import { Home, Trophy, MapPin, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';

const navItems = [
  { label: 'Inicio', icon: Home, path: '/' },
  { label: 'Partidos', icon: Trophy, path: '/partidos' },
  { label: 'Canchas', icon: MapPin, path: '/canchas' },
  { label: 'Perfil', icon: User, path: '/perfil' },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-vb-gray/10 bg-white/90 backdrop-blur-md md:hidden">
      <div className="mx-auto flex max-w-md items-center justify-around px-2 pb-safe">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={clsx(
                'relative flex flex-col items-center gap-0.5 py-2.5 px-3 transition-colors',
                isActive ? 'text-vb-orange' : 'text-vb-gray/50 hover:text-vb-gray'
              )}
            >
              <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-semibold">{item.label}</span>
              {isActive && (
                <span className="absolute top-0 h-0.5 w-6 rounded-b-full bg-vb-orange" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
