import { CircleCheck } from 'lucide-react';
import type { ClubPublico } from '@/api/tipos';
import { Card } from '@/components/ui/Card';
import { Seccion } from '../Seccion';
import { politicasClub } from './politicas';

/** Cómo funciona reservar en este club: confirmación, cancelación y reglas propias. */
export function PoliticasClub({ club }: { club: ClubPublico }) {
  return (
    <Card padding="lg">
      <Seccion titulo="Antes de reservar">
        <ul className="space-y-2.5">
          {politicasClub(club).map((regla) => (
            <li key={regla} className="flex items-start gap-2 text-sm text-ink/75">
              <CircleCheck size={17} aria-hidden="true" className="mt-0.5 shrink-0 text-green-700" />
              {regla}
            </li>
          ))}
        </ul>
        {club.politicas?.trim() && (
          <div className="mt-4 rounded-xl bg-line px-3 py-3 text-sm">
            <p className="font-bold text-ink">Reglas del club</p>
            <p className="mt-1 whitespace-pre-line text-ink/70">{club.politicas}</p>
          </div>
        )}
      </Seccion>
    </Card>
  );
}
