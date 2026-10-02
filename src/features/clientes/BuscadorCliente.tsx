import { useId, useState } from 'react';
import { Search } from 'lucide-react';
import { useClientes } from '@/api/consultas';
import { mensajeDeError } from '@/api/cliente';
import { Badge } from '@/components/ui/Badge';
import { Button, Spinner } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatTelefono } from '@/lib/telefono';
import { useGestion } from '@/contexts/gestion';
import { SaldoCliente } from './SaldoCliente';
import { useValorDiferido } from '@/hooks/useValorDiferido';

export type ClienteElegido = { id: number; nombre: string; telefono: string | null };

type Props = {
  valor: ClienteElegido | null;
  onChange: (cliente: ClienteElegido | null) => void;
  etiqueta?: string;
  error?: string | null;
  /** Enfoca el campo de búsqueda al abrir el diálogo. */
  enfocar?: boolean;
};

const MAXIMO_RESULTADOS = 8;

/** Buscar un cliente del club por nombre o teléfono y elegirlo. */
export function BuscadorCliente({ valor, onChange, etiqueta = 'Cliente', error, enfocar = false }: Props) {
  const { clubId } = useGestion();
  const [texto, setTexto] = useState('');
  const termino = useValorDiferido(texto.trim(), 300);
  const buscar = termino.length >= 2;
  const resultados = useClientes(buscar ? clubId : null, termino, false);
  const idResultados = useId();

  if (valor) {
    return (
      <div>
        <p className="mb-1 text-sm font-semibold text-ink">{etiqueta}</p>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-vb-blue/30 bg-vb-blue/5 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{valor.nombre}</p>
            {valor.telefono && <p className="text-sm text-ink/65">{formatTelefono(valor.telefono)}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={() => onChange(null)} aria-label={`Cambiar el cliente (${valor.nombre})`}>
            Cambiar
          </Button>
        </div>
      </div>
    );
  }

  const lista = (resultados.data ?? []).slice(0, MAXIMO_RESULTADOS);
  const esperando = buscar && (texto.trim() !== termino || (resultados.isFetching && !resultados.data));

  return (
    <div>
      <Input
        label={etiqueta}
        type="search"
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
        placeholder="Buscá por nombre o teléfono"
        icono={<Search size={18} />}
        autoComplete="off"
        error={error}
        hint="Escribí al menos 2 letras o 3 números."
        aria-controls={buscar ? idResultados : undefined}
        data-autofocus={enfocar || undefined}
      />
      {buscar && (
        <div id={idResultados} className="mt-2">
          {resultados.isError ? (
            <p role="alert" className="text-sm text-red-700">{mensajeDeError(resultados.error)}</p>
          ) : esperando ? (
            <p role="status" className="flex items-center gap-2 text-sm text-ink/65">
              <Spinner className="text-vb-orange-ink" /> Buscando…
            </p>
          ) : lista.length ? (
            <>
              <p className="sr-only" role="status">
                {lista.length === 1 ? '1 cliente encontrado' : `${lista.length} clientes encontrados`}
              </p>
              <ul className="max-h-64 divide-y divide-ink/5 overflow-y-auto rounded-xl border border-ink/10 bg-white">
                {lista.map((cliente) => (
                  <li key={cliente.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange({ id: cliente.id, nombre: cliente.nombre, telefono: cliente.telefono });
                        setTexto('');
                      }}
                      className="flex min-h-12 w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-vb-orange-light focus-visible:bg-vb-orange-light focus-visible:outline-none"
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate font-semibold text-ink">{cliente.nombre}</span>
                          {cliente.es_usuario_app && <Badge variant="info">App</Badge>}
                        </span>
                        <span className="block text-sm text-ink/65">
                          {cliente.telefono ? formatTelefono(cliente.telefono) : 'Sin teléfono'}
                        </span>
                      </span>
                      <SaldoCliente saldo={cliente.saldo} className="text-sm" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p role="status" className="flex items-center gap-2 text-sm text-ink/65">
              <Search size={16} aria-hidden="true" /> No encontramos clientes con «{termino}».
            </p>
          )}
        </div>
      )}
    </div>
  );
}
