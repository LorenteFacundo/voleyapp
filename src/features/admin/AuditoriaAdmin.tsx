import { useId, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { useAuditoriaAdmin } from '@/api/consultas';
import type { EventoAuditoria } from '@/api/tipos';
import { Cargando, ErrorCarga, Vacio } from '@/components/ui/Estados';
import { Input, Select } from '@/components/ui/Input';
import { formatFechaHora } from '@/lib/date';
import { categoriaAccion, etiquetaAccion, etiquetaCategoria, textoBuscable } from './etiquetas';

function Evento({ evento }: { evento: EventoAuditoria }) {
  const conDetalle = evento.detalle && Object.keys(evento.detalle).length > 0;
  return (
    <li className="px-4 py-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <p className="font-semibold text-ink">{etiquetaAccion(evento.accion)}</p>
        <time dateTime={evento.created_at} className="shrink-0 text-xs text-ink/65">{formatFechaHora(evento.created_at)}</time>
      </div>
      <p className="text-sm text-ink/65">
        {evento.actor}
        {evento.club && <> · {evento.club}</>}
        {evento.entidad_id && <span className="text-ink/65"> · {evento.entidad} #{evento.entidad_id}</span>}
      </p>
      {conDetalle && (
        <details className="mt-1">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-vb-blue hover:underline">
            Ver detalle
          </summary>
          <pre className="mt-1 max-h-64 overflow-auto rounded-xl bg-ink/5 p-3 text-xs text-ink/80">
            {JSON.stringify(evento.detalle, null, 2)}
          </pre>
        </details>
      )}
    </li>
  );
}

export function AuditoriaAdmin() {
  const auditoria = useAuditoriaAdmin();
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState('');
  const tituloId = useId();

  let contenido;
  if (auditoria.isPending) contenido = <Cargando texto="Cargando la auditoría…" />;
  else if (auditoria.isError) contenido = <ErrorCarga error={auditoria.error} onRetry={() => auditoria.refetch()} />;
  else if (!auditoria.data.length) {
    contenido = <Vacio icono={<ClipboardList size={32} />} titulo="Todavía no hay movimientos registrados" />;
  } else {
    const categorias = [...new Set(auditoria.data.map((evento) => categoriaAccion(evento.accion)))]
      .sort((a, b) => etiquetaCategoria(a).localeCompare(etiquetaCategoria(b), 'es'));
    const filtro = textoBuscable(busqueda.trim());
    const visibles = auditoria.data.filter((evento) => (!categoria || categoriaAccion(evento.accion) === categoria)
      && (!filtro || textoBuscable(`${etiquetaAccion(evento.accion)} ${evento.actor} ${evento.club ?? ''} ${evento.entidad}`).includes(filtro)));

    contenido = (
      <>
        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_14rem]">
          <Input
            label="Buscar en la auditoría"
            labelOculto
            type="search"
            placeholder="Buscar por persona, club o acción"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
          />
          <Select label="Tipo de movimiento" labelOculto value={categoria} onChange={(evento) => setCategoria(evento.target.value)}>
            <option value="">Todos los movimientos</option>
            {categorias.map((valor) => <option key={valor} value={valor}>{etiquetaCategoria(valor)}</option>)}
          </Select>
        </div>
        {visibles.length ? (
          <ul className="divide-y divide-ink/10 overflow-hidden rounded-2xl border border-ink/10 bg-white">
            {visibles.map((evento) => <Evento key={evento.id} evento={evento} />)}
          </ul>
        ) : (
          <Vacio titulo="Ningún movimiento coincide con el filtro" />
        )}
        <p className="mt-3 text-center text-xs text-ink/65">Se muestran los últimos {auditoria.data.length} movimientos.</p>
      </>
    );
  }

  return (
    <section aria-labelledby={tituloId}>
      <div className="mb-4">
        <h2 id={tituloId} className="font-display text-xl font-black text-vb-blue">Auditoría</h2>
        <p className="mt-0.5 text-sm text-ink/65">Quién hizo qué y cuándo, en todos los clubes.</p>
      </div>
      {contenido}
    </section>
  );
}
