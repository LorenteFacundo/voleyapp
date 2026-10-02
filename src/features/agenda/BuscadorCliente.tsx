import type { KeyboardEvent } from 'react';
import { Search, UserPlus, X } from 'lucide-react';
import type { ClienteListado, ClienteResumen } from '@/api/tipos';
import { formatTelefono } from '@/lib/telefono';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { GrupoChips } from './Chips';
import { useValorDiferido } from '@/hooks/useValorDiferido';
import { useBuscarClientes } from './hooks';
import { montoCorto } from './presentacion';

export type SeleccionCliente =
  | { modo: 'buscar'; termino: string }
  | { modo: 'existente'; cliente: ClienteResumen }
  | { modo: 'nuevo'; nombre: string; telefono: string }
  | { modo: 'ninguno' };

type Props = {
  clubId: number;
  valor: SeleccionCliente;
  onCambio: (valor: SeleccionCliente) => void;
  error?: string | null;
  errorNombre?: string | null;
  errorTelefono?: string | null;
};

const MODOS = [
  { value: 'buscar', label: 'Buscar' },
  { value: 'nuevo', label: 'Nuevo' },
  { value: 'ninguno', label: 'Sin cliente' },
] as const;

/** Lo que se escribió en el buscador sirve de punto de partida para un cliente nuevo. */
function nuevoDesde(termino: string): SeleccionCliente {
  const limpio = termino.trim();
  const pareceTelefono = /^[+\d\s().-]+$/.test(limpio) && limpio.replace(/\D/g, '').length >= 6;
  return { modo: 'nuevo', nombre: pareceTelefono ? '' : limpio, telefono: pareceTelefono ? limpio : '' };
}

function Resultado({ cliente, onElegir }: { cliente: ClienteListado; onElegir: () => void }) {
  return (
    <button
      type="button"
      onClick={onElegir}
      className="flex min-h-12 w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-ink/[0.04] focus-visible:bg-ink/[0.04] focus-visible:outline-none"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-ink">{cliente.nombre}</span>
        <span className="block truncate text-xs text-ink/65">
          {cliente.telefono ? formatTelefono(cliente.telefono) : cliente.email ?? 'Sin teléfono'}
        </span>
      </span>
      <span className="flex shrink-0 flex-wrap justify-end gap-1">
        {cliente.es_usuario_app && <Badge variant="info">App</Badge>}
        {Number(cliente.saldo) < 0 && <Badge variant="danger">Debe {montoCorto(-Number(cliente.saldo))}</Badge>}
      </span>
    </button>
  );
}

/** Elegir un cliente existente (con búsqueda), cargar uno nuevo o reservar sin cliente. */
export function BuscadorCliente({ clubId, valor, onCambio, error, errorNombre, errorTelefono }: Props) {
  const termino = valor.modo === 'buscar' ? valor.termino : '';
  const buscado = useValorDiferido(termino.trim(), 300);
  const busqueda = useBuscarClientes(clubId, buscado);
  const activa = buscado.length >= 2;
  const resultados = activa ? (busqueda.data ?? []).slice(0, 8) : [];
  const buscando = activa && (busqueda.isFetching || termino.trim() !== buscado);

  const alTeclear = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key !== 'Enter') return;
    // Enter no envía el formulario: elige el único resultado, si lo hay.
    evento.preventDefault();
    if (resultados.length === 1) onCambio({ modo: 'existente', cliente: resultados[0] });
  };

  return (
    <div className="space-y-3">
      <GrupoChips
        legend="Cliente"
        opciones={[...MODOS]}
        value={valor.modo === 'existente' ? 'buscar' : valor.modo}
        error={error}
        onChange={(modo) => {
          if (modo === 'buscar') onCambio({ modo: 'buscar', termino: '' });
          else if (modo === 'nuevo') onCambio(nuevoDesde(termino));
          else onCambio({ modo: 'ninguno' });
        }}
      />

      {valor.modo === 'existente' && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-vb-blue/30 bg-vb-blue/[0.04] px-3 py-2">
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{valor.cliente.nombre}</p>
            <p className="truncate text-sm text-ink/65">
              {valor.cliente.telefono ? formatTelefono(valor.cliente.telefono) : 'Sin teléfono'}
              {valor.cliente.es_usuario_app ? ' · Usuario de la app' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onCambio({ modo: 'buscar', termino: '' })}
            aria-label={`Cambiar el cliente ${valor.cliente.nombre}`}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink/65 hover:bg-ink/5 hover:text-ink"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      )}

      {valor.modo === 'buscar' && (
        <div>
          <div className="relative">
            <Input
              data-autofocus
              type="search"
              label="Buscar cliente por nombre o teléfono"
              labelOculto
              placeholder="Nombre o teléfono"
              autoComplete="off"
              enterKeyHint="search"
              value={termino}
              inputClassName="pl-10"
              onKeyDown={alTeclear}
              onChange={(evento) => onCambio({ modo: 'buscar', termino: evento.target.value })}
            />
            <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/65">
              {buscando ? <Spinner className="h-[18px] w-[18px]" /> : <Search size={18} />}
            </span>
          </div>
          <p className="sr-only" aria-live="polite">
            {activa && !buscando ? `${resultados.length} ${resultados.length === 1 ? 'cliente encontrado' : 'clientes encontrados'}` : ''}
          </p>
          {activa && (
            <ul className="mt-2 divide-y divide-ink/5 overflow-hidden rounded-xl border border-ink/10 bg-white">
              {busqueda.isError && (
                <li className="px-3 py-2 text-sm text-red-700">No pudimos buscar clientes. Revisá la conexión.</li>
              )}
              {resultados.map((cliente) => (
                <li key={cliente.id}>
                  <Resultado cliente={cliente} onElegir={() => onCambio({ modo: 'existente', cliente })} />
                </li>
              ))}
              {!buscando && !busqueda.isError && resultados.length === 0 && (
                <li className="px-3 py-2 text-sm text-ink/65">No hay clientes con «{buscado}».</li>
              )}
              <li>
                <button
                  type="button"
                  onClick={() => onCambio(nuevoDesde(termino))}
                  className="flex min-h-12 w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-vb-blue hover:bg-ink/[0.04] focus-visible:bg-ink/[0.04] focus-visible:outline-none"
                >
                  <UserPlus size={17} aria-hidden="true" /> Cargar «{termino.trim()}» como cliente nuevo
                </button>
              </li>
            </ul>
          )}
          {!activa && <p className="mt-1 text-xs text-ink/65">Escribí al menos 2 letras o números.</p>}
        </div>
      )}

      {valor.modo === 'nuevo' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            data-autofocus
            label="Nombre"
            autoComplete="off"
            maxLength={120}
            value={valor.nombre}
            error={errorNombre}
            onChange={(evento) => onCambio({ ...valor, nombre: evento.target.value })}
          />
          <Input
            label="Teléfono (opcional)"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="11 2233-4455"
            value={valor.telefono}
            error={errorTelefono}
            hint="Para escribirle por WhatsApp."
            onChange={(evento) => onCambio({ ...valor, telefono: evento.target.value })}
          />
        </div>
      )}

      {valor.modo === 'ninguno' && (
        <p className="text-sm text-ink/65">Para clases, torneos o eventos: poné un título abajo.</p>
      )}
    </div>
  );
}
