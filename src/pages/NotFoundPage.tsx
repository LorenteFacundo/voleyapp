import { Link } from 'react-router-dom';
import { ArrowLeft, SearchX } from 'lucide-react';

export function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-line px-5 py-12 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-vb-orange-light text-vb-orange-ink"><SearchX size={30} /></span>
        <p className="mt-6 text-xs font-black uppercase tracking-[.2em] text-vb-orange-ink">404 · Ruta no encontrada</p>
        <h1 className="mt-3 font-display text-3xl font-black text-ink">No encontramos esta página</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink/65">Puede que el enlace haya cambiado o que ya no esté disponible.</p>
        <Link to="/app" className="mt-7 inline-flex items-center gap-2 rounded-full bg-vb-blue px-5 py-3 text-sm font-bold text-white transition hover:bg-vb-orange-ink"><ArrowLeft size={16} /> Ir a VoleyApp</Link>
      </div>
    </main>
  );
}
