import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { horaArgentina } from '@/lib/date';
import { Input } from '@/components/ui/Input';
import { useAhora } from '../useAhora';
import { primerNombre, saludoSegunHora } from './saludo';

/** Encabezado del inicio: saludo y buscador de canchas. */
export function Bienvenida({ nombre }: { nombre: string | null | undefined }) {
  const navigate = useNavigate();
  const ahora = useAhora(5 * 60_000);
  const [busqueda, setBusqueda] = useState('');
  const saludo = saludoSegunHora(Number(horaArgentina(ahora).slice(0, 2)));
  const primero = primerNombre(nombre);

  function buscar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const texto = busqueda.trim();
    navigate(texto ? `/canchas?q=${encodeURIComponent(texto)}` : '/canchas');
  }

  return (
    <section className="relative overflow-hidden rounded-3xl bg-vb-blue px-5 py-6 text-white shadow-card sm:px-8 sm:py-9">
      <span className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full border-[2.5rem] border-vb-orange/90 sm:right-8" aria-hidden="true" />
      <span className="pointer-events-none absolute -bottom-20 right-28 h-36 w-36 rounded-full border-[1.25rem] border-white/10" aria-hidden="true" />
      <div className="relative max-w-xl">
        <p className="text-sm font-semibold text-white/75">{saludo}{primero ? `, ${primero}` : ''}</p>
        <h1 className="mt-1 font-display text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl">
          ¿Qué jugamos <span className="text-vb-yellow">hoy</span>?
        </h1>
        <p className="mt-2 text-sm text-white/75">Encontrá cancha, armá tu partido o sumate a uno que ya está en marcha.</p>
        <form role="search" onSubmit={buscar} className="mt-5 flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-ink/65" aria-hidden="true" />
            <Input
              label="Buscar canchas por club, barrio o zona"
              labelOculto
              type="search"
              enterKeyHint="search"
              placeholder="Club, barrio o zona"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              inputClassName="min-h-12 pl-10"
            />
          </div>
          <button
            type="submit"
            className="min-h-12 shrink-0 rounded-xl bg-vb-orange-ink px-4 text-sm font-bold text-white shadow-card transition hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-vb-blue"
          >
            Buscar
          </button>
        </form>
      </div>
    </section>
  );
}
