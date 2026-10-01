import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LocateFixed, Search, Volleyball } from 'lucide-react';
import clsx from 'clsx';
import type { publicoApi } from '@/api/publico';
import { useExplorarPartidos } from '@/api/consultas';
import { useUbicacion } from '@/hooks/useGeolocation';
import { NIVELES_PARTIDO, type NivelPartido } from '@/lib/nivel';
import { pluralizar } from '@/lib/format';
import { Spinner } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Aviso, ErrorCarga, Vacio } from '@/components/ui/Estados';
import { Skeleton } from '@/components/ui/Skeleton';
import { ChipFiltro } from '@/features/jugador/ChipFiltro';
import { clasesBoton } from '@/components/ui/estilosBoton';
import { MatchCard } from './MatchCard';
import { useValorDiferido } from '@/hooks/useValorDiferido';

type Filtros = NonNullable<Parameters<typeof publicoApi.explorarPartidos>[0]>;

const RADIOS = [5, 10, 20] as const;

export function TarjetasCargando({ cantidad = 6 }: { cantidad?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      {Array.from({ length: cantidad }, (_, indice) => <Skeleton key={indice} height={196} className="rounded-2xl" />)}
    </div>
  );
}

/** Partidos abiertos con filtros por texto, nivel y cercanía. */
export function ExplorarPartidos() {
  const [texto, setTexto] = useState('');
  const busqueda = useValorDiferido(texto.trim(), 350);
  const [nivel, setNivel] = useState<NivelPartido | null>(null);
  const [cerca, setCerca] = useState(false);
  const [radio, setRadio] = useState<(typeof RADIOS)[number]>(10);
  const ubicacion = useUbicacion();
  const coordenadas = cerca ? ubicacion.coordenadas : null;

  // Solo se mandan los filtros usados, así la caché se comparte con el inicio.
  const filtros: Filtros = {};
  if (nivel) filtros.nivel = nivel;
  if (busqueda) filtros.texto = busqueda;
  if (coordenadas) {
    filtros.lat = coordenadas[0];
    filtros.lng = coordenadas[1];
    filtros.radioKm = radio;
  }
  const partidos = useExplorarPartidos(filtros);
  const hayFiltros = !!nivel || !!busqueda || cerca;

  function alternarCercania() {
    if (cerca) {
      setCerca(false);
      return;
    }
    setCerca(true);
    if (!ubicacion.coordenadas) ubicacion.pedir();
  }

  function limpiarFiltros() {
    setTexto('');
    setNivel(null);
    setCerca(false);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <Input
          label="Buscar por club, zona o cancha"
          type="search"
          enterKeyHint="search"
          placeholder="Ej.: Palermo, Club Sur…"
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          icono={<Search size={18} />}
        />
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filtrar por nivel">
          <ChipFiltro activo={nivel === null} onClick={() => setNivel(null)}>Todos los niveles</ChipFiltro>
          {NIVELES_PARTIDO.map((opcion) => (
            <ChipFiltro key={opcion.value} activo={nivel === opcion.value} onClick={() => setNivel(opcion.value)}>
              {opcion.label}
            </ChipFiltro>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ChipFiltro activo={cerca} onClick={alternarCercania}>
            {cerca && ubicacion.estado === 'buscando' ? <Spinner /> : <LocateFixed size={16} aria-hidden="true" />}
            Cerca mío
          </ChipFiltro>
          {cerca && ubicacion.coordenadas && (
            <div className="flex gap-2" role="group" aria-label="Distancia máxima">
              {RADIOS.map((opcion) => (
                <ChipFiltro key={opcion} activo={radio === opcion} onClick={() => setRadio(opcion)}>
                  {opcion} km
                </ChipFiltro>
              ))}
            </div>
          )}
          {hayFiltros && (
            <button
              type="button"
              onClick={limpiarFiltros}
              className="min-h-10 rounded-lg px-2 text-sm font-semibold text-vb-blue hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink"
            >
              Limpiar filtros
            </button>
          )}
        </div>
        {cerca && ubicacion.estado === 'buscando' && (
          <p role="status" className="text-sm text-ink/65">Buscando tu ubicación…</p>
        )}
        {cerca && (ubicacion.estado === 'denegado' || ubicacion.estado === 'no_disponible') && (
          <Aviso tono="alerta" titulo="No pudimos usar tu ubicación">
            {ubicacion.estado === 'denegado'
              ? 'Habilitá el permiso de ubicación del navegador para ver partidos cerca tuyo. Mientras tanto te mostramos todos.'
              : 'Tu dispositivo no nos dio la ubicación. Probá de nuevo en un rato; mientras tanto te mostramos todos.'}
          </Aviso>
        )}
      </div>

      {partidos.isPending ? (
        <TarjetasCargando />
      ) : partidos.isError ? (
        <ErrorCarga error={partidos.error} onRetry={() => partidos.refetch()} />
      ) : !partidos.data.length ? (
        <Vacio
          icono={<Volleyball size={36} />}
          titulo={hayFiltros ? 'No hay partidos con esos filtros' : 'Todavía no hay partidos abiertos'}
          descripcion={hayFiltros
            ? 'Probá con otro nivel, otra zona o una distancia mayor.'
            : 'Armá el primero: reservá una cancha y activá "Organizar un partido" para que se sume gente.'}
          accion={hayFiltros
            ? <button type="button" onClick={limpiarFiltros} className={clasesBoton({ variant: 'secondary' })}>Ver todos los partidos</button>
            : <Link to="/canchas" className={clasesBoton({ variant: 'primary' })}>Reservar una cancha</Link>}
        />
      ) : (
        <div aria-busy={partidos.isPlaceholderData || undefined}>
          <p className="mb-3 text-sm font-semibold text-ink/65" aria-live="polite">
            {pluralizar(partidos.data.length, 'partido abierto', 'partidos abiertos')}
          </p>
          <ul className={clsx('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', partidos.isPlaceholderData && 'opacity-60 transition-opacity')}>
            {partidos.data.map((partido) => (
              <li key={partido.id}><MatchCard partido={partido} /></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
