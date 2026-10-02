import { useEffect, useRef } from 'react';
import { MessageCircle } from 'lucide-react';
import type { InvitacionCreada } from '@/api/tipos';
import { Aviso } from '@/components/ui/Estados';
import { Input } from '@/components/ui/Input';
import { enlaceCompartirWhatsApp } from '@/lib/telefono';
import { BotonCopiar } from '@/components/ui/BotonCopiar';
import { enlaceInvitacion, etiquetaRol, mensajeInvitacion, vencimientoInvitacion } from './equipo';
import { clasesBoton } from '@/components/ui/estilosBoton';

/**
 * Enlace de una invitación recién creada. El servidor guarda solo el hash del
 * token, así que esta es la única vez que se puede ver.
 */
export function EnlaceInvitacion({ invitacion, clubNombre }: { invitacion: InvitacionCreada; clubNombre: string }) {
  const enlace = enlaceInvitacion(invitacion.token);
  const mensaje = mensajeInvitacion(invitacion, clubNombre, enlace);
  const campo = useRef<HTMLInputElement>(null);

  // Al aparecer, el foco va al enlace (queda seleccionado para copiarlo). Si se
  // abre junto con un diálogo, data-autofocus hace lo mismo.
  useEffect(() => {
    campo.current?.focus();
  }, []);

  return (
    <div className="space-y-4">
      <Aviso tono="exito" titulo="Invitación creada">
        Mandale este enlace a <strong className="break-all">{invitacion.email}</strong> para que se sume a {clubNombre} como{' '}
        {etiquetaRol(invitacion.rol).toLowerCase()}. Vence el {vencimientoInvitacion(invitacion.expira_at)} (7 días).
      </Aviso>
      <Input
        ref={campo}
        data-autofocus
        label="Enlace de invitación"
        value={enlace}
        readOnly
        onFocus={(evento) => evento.currentTarget.select()}
        inputClassName="font-mono text-sm"
      />
      <div className="flex flex-wrap gap-2">
        <BotonCopiar texto={enlace} etiqueta="Copiar enlace" />
        <a href={enlaceCompartirWhatsApp(mensaje)} target="_blank" rel="noopener noreferrer" className={clasesBoton({ variant: 'success' })}>
          <MessageCircle size={16} aria-hidden="true" /> Compartir por WhatsApp
        </a>
      </div>
      <p className="text-xs text-ink/65">
        Para aceptarla tiene que ingresar (o crear su cuenta) con <strong className="break-all">{invitacion.email}</strong>.
        Por seguridad, el enlace se muestra una sola vez: si lo perdés, generá otra invitación y la anterior se anula.
      </p>
    </div>
  );
}
