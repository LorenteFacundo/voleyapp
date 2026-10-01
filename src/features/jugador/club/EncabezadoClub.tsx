import { MapPin, MessageCircle, Navigation, Phone, Share2, Sun, Umbrella, Zap } from 'lucide-react';
import { toast } from 'sonner';
import type { ClubPublico } from '@/api/tipos';
import { enlaceWhatsApp } from '@/lib/telefono';
import { pluralizar } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { enlaceGoogleMaps } from '@/features/mapa/enlaces';
import { tieneArena, tieneTechada } from '../catalogo';
import { clasesBoton } from '@/components/ui/estilosBoton';
import { compartirEnlace } from '@/lib/portapapeles';
import { IconoInstagram } from './IconoInstagram';
import { enlaceInstagram, enlaceTelefono, usuarioInstagram } from './politicas';

/** Nombre, ubicación, contacto y descripción del club. */
export function EncabezadoClub({ club }: { club: ClubPublico }) {
  const mapa = enlaceGoogleMaps(club);
  const instagram = enlaceInstagram(club.instagram);
  const telefono = enlaceTelefono(club.telefono);

  async function compartir() {
    const resultado = await compartirEnlace({
      titulo: club.nombre,
      texto: `Mirá los horarios de ${club.nombre} en VoleyApp`,
      url: `${window.location.origin}/club/${club.slug}`,
    });
    if (resultado === 'copiado') toast.success('Copiamos el enlace del club.');
    else if (resultado === 'error') toast.error('No pudimos copiar el enlace.');
  }

  return (
    <header className="relative overflow-hidden rounded-3xl border border-vb-gray/10 bg-white p-5 shadow-card sm:p-7">
      <span className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full border-[1.75rem] border-vb-orange-light" aria-hidden="true" />
      <div className="relative">
        {club.zona && <p className="text-xs font-black uppercase tracking-[.16em] text-vb-orange-ink">{club.zona}</p>}
        <h1 className="mt-1 font-display text-3xl font-black leading-tight tracking-tight text-vb-blue sm:text-4xl">{club.nombre}</h1>
        {club.direccion && (
          mapa ? (
            <a
              href={mapa}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-start gap-1.5 rounded text-sm text-ink/70 underline-offset-2 hover:text-vb-orange-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink"
            >
              <MapPin size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
              {club.direccion}
              <span className="sr-only"> (abre Google Maps)</span>
            </a>
          ) : (
            <p className="mt-2 flex items-start gap-1.5 text-sm text-ink/70">
              <MapPin size={16} aria-hidden="true" className="mt-0.5 shrink-0" /> {club.direccion}
            </p>
          )
        )}

        <div className="mt-3 flex flex-wrap gap-1.5">
          {club.confirmacion_automatica
            ? <Badge variant="success"><Zap size={12} aria-hidden="true" /> Confirmación inmediata</Badge>
            : <Badge variant="warning">Responde en hasta {club.respuesta_horas} h</Badge>}
          <Badge variant="muted">{club.canchas.length ? pluralizar(club.canchas.length, 'cancha') : 'Sin canchas publicadas'}</Badge>
          {tieneTechada(club) && <Badge variant="info"><Umbrella size={12} aria-hidden="true" /> Techada</Badge>}
          {tieneArena(club) && <Badge variant="court"><Sun size={12} aria-hidden="true" /> Arena</Badge>}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {club.whatsapp && (
            <a
              href={enlaceWhatsApp(club.whatsapp, `¡Hola! Te escribo desde VoleyApp por las canchas de ${club.nombre}.`)}
              target="_blank"
              rel="noopener noreferrer"
              className={clasesBoton({ variant: 'success', size: 'sm' })}
            >
              <MessageCircle size={16} aria-hidden="true" /> WhatsApp
            </a>
          )}
          {telefono && (
            <a href={telefono} className={clasesBoton({ variant: 'secondary', size: 'sm' })}>
              <Phone size={16} aria-hidden="true" /> Llamar
            </a>
          )}
          {instagram && (
            <a href={instagram} target="_blank" rel="noopener noreferrer" className={clasesBoton({ variant: 'secondary', size: 'sm' })}>
              <IconoInstagram size={16} /> @{usuarioInstagram(club.instagram)}
            </a>
          )}
          {mapa && (
            <a href={mapa} target="_blank" rel="noopener noreferrer" className={clasesBoton({ variant: 'secondary', size: 'sm' })}>
              <Navigation size={16} aria-hidden="true" /> Cómo llegar
            </a>
          )}
          <Button variant="secondary" size="sm" onClick={compartir}>
            <Share2 size={16} aria-hidden="true" /> Compartir
          </Button>
        </div>

        {club.descripcion && <p className="mt-4 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-ink/70">{club.descripcion}</p>}
      </div>
    </header>
  );
}
