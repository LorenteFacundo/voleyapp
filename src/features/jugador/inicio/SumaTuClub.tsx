import { ArrowRight, Store } from 'lucide-react';
import { clasesBoton } from '@/components/ui/estilosBoton';

/** Llamado para clubes: lleva a la sección de la landing con el formulario. */
export function SumaTuClub() {
  return (
    <section aria-labelledby="suma-tu-club" className="rounded-2xl border border-vb-orange/20 bg-vb-orange-light p-5">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-vb-orange-ink shadow-card" aria-hidden="true">
        <Store size={22} />
      </span>
      <h2 id="suma-tu-club" className="mt-3 font-display text-lg font-black text-vb-blue">¿Tenés una cancha?</h2>
      <p className="mt-1 text-sm text-ink/70">
        Ordená tu agenda, recibí pedidos con seña y llená los horarios libres sin perder el día en WhatsApp.
      </p>
      {/* Carga completa para que el navegador baje hasta la sección de clubes. */}
      <a href="/#clubes" className={clasesBoton({ variant: 'blue', className: 'mt-4' })}>
        Sumá tu club <ArrowRight size={17} aria-hidden="true" />
      </a>
    </section>
  );
}
