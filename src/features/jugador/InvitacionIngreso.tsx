import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LogIn, UserPlus } from 'lucide-react';
import { rutaIngreso } from '@/lib/navigation';
import { Card } from '@/components/ui/Card';
import { clasesBoton } from '@/components/ui/estilosBoton';

/** Tarjeta para quien no inició sesión, con accesos a ingresar o crear cuenta y volver acá. */
export function InvitacionIngreso({
  titulo, descripcion, siguiente, icono,
}: { titulo: string; descripcion: ReactNode; siguiente: string; icono?: ReactNode }) {
  const ingreso = rutaIngreso(siguiente);
  const registro = `${ingreso}${ingreso.includes('?') ? '&' : '?'}modo=registro`;
  return (
    <Card padding="lg" className="mx-auto max-w-md text-center">
      {icono && (
        <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-vb-orange-light text-vb-orange-ink" aria-hidden="true">
          {icono}
        </span>
      )}
      <h2 className="font-display text-xl font-black text-vb-blue">{titulo}</h2>
      <p className="mt-2 text-sm text-ink/65">{descripcion}</p>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <Link to={ingreso} className={clasesBoton({ variant: 'primary', size: 'lg' })}>
          <LogIn size={18} aria-hidden="true" /> Ingresar
        </Link>
        <Link to={registro} className={clasesBoton({ variant: 'secondary', size: 'lg' })}>
          <UserPlus size={18} aria-hidden="true" /> Crear cuenta
        </Link>
      </div>
    </Card>
  );
}
