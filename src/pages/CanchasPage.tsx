import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { List, LocateFixed, Map as IconoMapa, Search, Store, Sun, Umbrella } from 'lucide-react';
import clsx from 'clsx';
import { useClubes } from '@/api/consultas';
import { useUbicacion } from '@/hooks/useGeolocation';
import { formatMoney, pluralizar } from '@/lib/format';
import { AppShell, PageTitle } from '@/components/layout/AppShell';
import { Spinner } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Aviso, ErrorCarga, Vacio } from '@/components/ui/Estados';
import { Skeleton } from '@/components/ui/Skeleton';
import { ChipFiltro } from '@/features/jugador/ChipFiltro';
import { ClubCard } from '@/features/jugador/ClubCard';
import { filtrarClubes, ordenarClubes, precioDesde } from '@/features/jugador/catalogo';
import { clasesBoton } from '@/components/ui/estilosBoton';
import { tieneCoordenadas } from '@/features/mapa/distancia';
import { MapaClubesPerezoso } from '@/features/mapa/MapaClubesPerezoso';

type Vista = 'lista' | 'mapa';

export function CanchasPage() {
  const [params, setParams] = useSearchParams();
  const busqueda = params.get('q') ?? '';
  const [techada, setTechada] = useState(false);
  const [arena, setArena] = useState(false);
  const [cerca, setCerca] = useState(false);
  const [vista, setVista] = useState<Vista>('lista');
  const ubicacion = useUbicacion();
  const clubes = useClubes();

  const origen = cerca && ubicacion.coordenadas
    ? { latitud: ubicacion.coordenadas[0], longitud: ubicacion.coordenadas[1] }
    : null;
  const resultados = clubes.data ? ordenarClubes(filtrarClubes(clubes.data, { busqueda, techada, arena }), origen) : [];
  const hayFiltros = !!busqueda.trim() || techada || arena;
  const sinUbicacion = resultados.filter(({ club }) => !tieneCoordenadas(club)).length;

  function cambiarBusqueda(valor: string) {
    setParams((actuales) => {
      const proximos = new URLSearchParams(actuales);
      if (valor) proximos.set('q', valor);
      else proximos.delete('q');
      return proximos;
    }, { replace: true });
  }

  function alternarCercania() {
    if (cerca) {
      setCerca(false);
      return;
    }
    setCerca(true);
    if (!ubicacion.coordenadas) ubicacion.pedir();
  }

  function limpiarFiltros() {
    cambiarBusqueda('');
    setTechada(false);
    setArena(false);
  }

  return (
    <AppShell ancho="amplio">
      <PageTitle titulo="Canchas" descripcion="Elegí un club, mirá los horarios libres y pedí tu cancha." />

      <div className="space-y-3">
        <Input
          className="max-w-xl"
          label="Buscar por club, barrio o dirección"
          type="search"
          enterKeyHint="search"
          placeholder="Ej.: Lanús, Palermo, Club Sur…"
          value={busqueda}
          onChange={(evento) => cambiarBusqueda(evento.target.value)}
          icono={<Search size={18} />}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="group" aria-label="Filtros">
            <ChipFiltro activo={techada} onClick={() => setTechada((valor) => !valor)}>
              <Umbrella size={16} aria-hidden="true" /> Techada
            </ChipFiltro>
            <ChipFiltro activo={arena} onClick={() => setArena((valor) => !valor)}>
              <Sun size={16} aria-hidden="true" /> Arena / beach
            </ChipFiltro>
            <ChipFiltro activo={cerca} onClick={alternarCercania}>
              {cerca && ubicacion.estado === 'buscando' ? <Spinner /> : <LocateFixed size={16} aria-hidden="true" />}
              Cerca mío
            </ChipFiltro>
          </div>
          <div className="flex rounded-xl bg-ink/5 p-1" role="group" aria-label="Cómo ver los clubes">
            {([['lista', 'Lista', List], ['mapa', 'Mapa', IconoMapa]] as const).map(([id, etiqueta, Icono]) => (
              <button
                key={id}
                type="button"
                aria-pressed={vista === id}
                onClick={() => setVista(id)}
                className={clsx(
                  'flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink',
                  vista === id ? 'bg-white text-vb-blue shadow-sm' : 'text-ink/65 hover:text-ink',
                )}
              >
                <Icono size={16} aria-hidden="true" /> {etiqueta}
              </button>
            ))}
          </div>
        </div>
        {cerca && ubicacion.estado === 'buscando' && <p role="status" className="text-sm text-ink/65">Buscando tu ubicación…</p>}
        {cerca && (ubicacion.estado === 'denegado' || ubicacion.estado === 'no_disponible') && (
          <Aviso tono="alerta" titulo="No pudimos usar tu ubicación">
            {ubicacion.estado === 'denegado'
              ? 'Habilitá el permiso de ubicación del navegador para ordenar por cercanía. Mientras tanto, te mostramos los clubes por nombre.'
              : 'Tu dispositivo no nos dio la ubicación. Probá de nuevo en un rato.'}
          </Aviso>
        )}
      </div>

      <div className="mt-5">
        {clubes.isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
            {Array.from({ length: 6 }, (_, indice) => <Skeleton key={indice} height={300} className="rounded-2xl" />)}
          </div>
        ) : clubes.isError ? (
          <ErrorCarga error={clubes.error} onRetry={() => clubes.refetch()} />
        ) : !clubes.data.length ? (
          <Vacio
            icono={<Store size={36} />}
            titulo="Todavía no hay clubes publicados"
            descripcion="Estamos sumando clubes de Zona Sur y Capital. ¿Tenés una cancha? Sumala a VoleyApp."
            accion={<a href="/#clubes" className={clasesBoton({ variant: 'primary' })}>Sumar mi club</a>}
          />
        ) : !resultados.length ? (
          <Vacio
            icono={<Search size={36} />}
            titulo="No encontramos clubes con esa búsqueda"
            descripcion="Probá con otro barrio o sacá algún filtro."
            accion={hayFiltros && <button type="button" onClick={limpiarFiltros} className={clasesBoton({ variant: 'secondary' })}>Limpiar filtros</button>}
          />
        ) : (
          <>
            <h2 className="sr-only">Resultados</h2>
            <p className="mb-3 text-sm font-semibold text-ink/65" aria-live="polite">
              {pluralizar(resultados.length, 'club', 'clubes')}
              {origen ? ' · del más cercano al más lejano' : ''}
            </p>
            {vista === 'lista' ? (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {resultados.map(({ club, distanciaKm }) => (
                  <li key={club.id}><ClubCard club={club} distanciaKm={distanciaKm} /></li>
                ))}
              </ul>
            ) : (
              <>
                <MapaClubesPerezoso
                  onVerLista={() => setVista('lista')}
                  ubicacion={origen ? ubicacion.coordenadas : null}
                  puntos={resultados.flatMap(({ club }) => {
                    if (!tieneCoordenadas(club)) return [];
                    const desde = precioDesde(club.canchas);
                    return [{
                      id: club.id,
                      nombre: club.nombre,
                      slug: club.slug,
                      zona: club.zona,
                      direccion: club.direccion,
                      latitud: club.latitud,
                      longitud: club.longitud,
                      detalle: desde ? `Desde ${formatMoney(desde)} el turno` : null,
                    }];
                  })}
                />
                {sinUbicacion > 0 && (
                  <p className="mt-2 text-sm text-ink/65">
                    {sinUbicacion === 1
                      ? '1 club no tiene la ubicación cargada y no aparece en el mapa: lo ves en la lista.'
                      : `${sinUbicacion} clubes no tienen la ubicación cargada y no aparecen en el mapa: los ves en la lista.`}
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
