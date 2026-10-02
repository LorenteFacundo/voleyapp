import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Textarea } from './Input';
import { ConfirmarContext, type Contexto, type OpcionesConfirmacion, type Respuesta } from './confirmar-contexto';

/** Reemplaza window.confirm por un diálogo accesible y consistente. */
export function ConfirmarProvider({ children }: { children: ReactNode }) {
  const [opciones, setOpciones] = useState<OpcionesConfirmacion | null>(null);
  const [motivo, setMotivo] = useState('');
  const resolver = useRef<((respuesta: Respuesta) => void) | null>(null);

  const pedir = useCallback<Contexto>((nuevas) => new Promise<Respuesta>((resolve) => {
    resolver.current?.({ confirmado: false, motivo: '' });
    resolver.current = resolve;
    setMotivo('');
    setOpciones(nuevas);
  }), []);

  const cerrar = (confirmado: boolean) => {
    resolver.current?.({ confirmado, motivo: motivo.trim() });
    resolver.current = null;
    setOpciones(null);
  };

  const faltaMotivo = !!opciones?.pedirMotivo?.obligatorio && motivo.trim().length < 2;

  return (
    <ConfirmarContext.Provider value={pedir}>
      {children}
      <Modal
        open={!!opciones}
        onClose={() => cerrar(false)}
        title={opciones?.titulo ?? ''}
        size="sm"
        footer={(
          <>
            <Button variant="secondary" onClick={() => cerrar(false)}>{opciones?.cancelar ?? 'Volver'}</Button>
            <Button variant={opciones?.peligro ? 'danger' : 'primary'} disabled={faltaMotivo} onClick={() => cerrar(true)} data-autofocus>
              {opciones?.confirmar ?? 'Confirmar'}
            </Button>
          </>
        )}
      >
        {opciones?.descripcion && <div className="text-sm text-ink/75">{opciones.descripcion}</div>}
        {opciones?.pedirMotivo && (
          <Textarea
            className="mt-4"
            label={opciones.pedirMotivo.etiqueta}
            placeholder={opciones.pedirMotivo.placeholder}
            value={motivo}
            maxLength={300}
            onChange={(evento) => setMotivo(evento.target.value)}
          />
        )}
      </Modal>
    </ConfirmarContext.Provider>
  );
}
