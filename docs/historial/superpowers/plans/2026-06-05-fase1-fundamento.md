# Fase 1 — Fundamento: Plan de Implementación

> **For agentic workers:** Use subagent-driven-development to implement task-by-task.

**Goal:** Implementar transferencia de liderazgo al abandonar partido y búsqueda avanzada con filtros.

**Architecture:** Modificación del RPC `salirse_de_partido` + nueva RPC `buscar_partidos` + componente de filtros frontend.

**Tech Stack:** React + TypeScript + Supabase (Postgres + PostGIS) + Tailwind

---

## Task 1: Modificar RPC salirse_de_partido

**Files:**
- Modify: Supabase RPC `salirse_de_partido`

- [ ] **Step 1: Aplicar migración via Supabase MCP**

SQL del nuevo `salirse_de_partido`:

```sql
CREATE OR REPLACE FUNCTION public.salirse_de_partido(p_partido_id bigint)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE
  v_partido partidos%ROWTYPE;
  v_nuevo_organizador participantes_partido%ROWTYPE;
  v_resultado text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO v_partido FROM partidos WHERE id = p_partido_id;
  IF v_partido IS NULL THEN RAISE EXCEPTION 'Partido no encontrado'; END IF;
  IF v_partido.estado_partido = 'cancelado' THEN RAISE EXCEPTION 'El partido está cancelado'; END IF;

  -- Verificar que está inscrito
  IF NOT EXISTS (SELECT 1 FROM participantes_partido WHERE partido_id = p_partido_id AND usuario_id = auth.uid()) THEN
    RAISE EXCEPTION 'No estás inscrito en este partido';
  END IF;

  -- Si es organizador: transferir liderazgo o cancelar
  IF v_partido.organizador_id = auth.uid() THEN
    -- Buscar siguiente participante (el más antiguo que no sea el organizador)
    SELECT * INTO v_nuevo_organizador
    FROM participantes_partido
    WHERE partido_id = p_partido_id AND usuario_id != auth.uid()
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_nuevo_organizador.usuario_id IS NOT NULL THEN
      -- Transferir liderazgo
      UPDATE partidos SET organizador_id = v_nuevo_organizador.usuario_id WHERE id = p_partido_id;
      DELETE FROM participantes_partido WHERE partido_id = p_partido_id AND usuario_id = auth.uid();
      SELECT nombre_completo INTO v_resultado FROM usuarios WHERE id = v_nuevo_organizador.usuario_id;
      RETURN COALESCE(v_resultado, 'Otro jugador');
    ELSE
      -- No hay otros participantes → cancelar
      UPDATE partidos SET estado_partido = 'cancelado' WHERE id = p_partido_id;
      DELETE FROM participantes_partido WHERE partido_id = p_partido_id AND usuario_id = auth.uid();
      RETURN 'cancelado';
    END IF;
  ELSE
    -- No es organizador: simplemente salir
    DELETE FROM participantes_partido WHERE partido_id = p_partido_id AND usuario_id = auth.uid();
    RETURN 'saliste';
  END IF;
END;
$function$;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: salirse_de_partido con transferencia de liderazgo"
```

---

## Task 2: Actualizar MatchDetailPage

**Files:**
- Modify: `src/pages/MatchDetailPage.tsx`
- Modify: `src/lib/booking.ts`

- [ ] **Step 1: Actualizar salirseDePartido en booking.ts**

Cambiar la función para que retorne el resultado del RPC:

```typescript
export async function salirseDePartido(partidoId: number): Promise<string> {
  const { data, error } = await supabase.rpc('salirse_de_partido', {
    p_partido_id: partidoId,
  });
  if (error) throw new Error(error.message);
  return data as string;
}
```

- [ ] **Step 2: Actualizar handleLeave en MatchDetailPage**

Modificar para manejar los 3 casos:

```typescript
async function handleLeave() {
  if (!session || !partido) return;
  setLeaving(true);
  try {
    const resultado = await salirseDePartido(partido.id);
    if (resultado === 'cancelado') {
      toast.success('Partido cancelado. No había otros jugadores.');
    } else if (resultado === 'saliste') {
      toast.success('Saliste del partido');
    } else {
      toast.success(`Saliste del partido. ${resultado} es el nuevo organizador.`);
    }
    await refresh();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Error al salir');
  } finally {
    setLeaving(false);
  }
}
```

- [ ] **Step 3: Actualizar lógica del botón**

Cambiar `puedeSalirse` para incluir al organizador:

```typescript
const puedeSalirse = session && yaInscripto;
```

Y actualizar el texto del botón:

```tsx
{puedeSalirse && (
  <Button
    variant="ghost"
    size="sm"
    onClick={handleLeave}
    loading={leaving}
    fullWidth
    className={esOrganizador ? 'text-red-600 hover:text-red-700' : ''}
  >
    <LogOut size={16} />
    {esOrganizador
      ? (partido.participantes && partido.participantes.length > 1
          ? 'Abandonar partido (transferir liderazgo)'
          : 'Cancelar partido')
      : 'Salir del partido'
    }
  </Button>
)}
```

- [ ] **Step 4: Build y commit**

```bash
npm run build
git add -A
git commit -m "feat: transferencia de liderazgo al abandonar partido"
```

---

## Task 3: Crear RPC buscar_partidos

**Files:**
- Supabase RPC

- [ ] **Step 1: Aplicar migración via MCP**

```sql
CREATE OR REPLACE FUNCTION public.buscar_partidos(
  p_nivel text DEFAULT NULL,
  p_texto text DEFAULT NULL,
  p_lat numeric DEFAULT NULL,
  p_lng numeric DEFAULT NULL,
  p_radio_km int DEFAULT NULL
)
RETURNS SETOF json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT json_build_object(
    'id', pp.id, 'organizador_id', pp.organizador_id,
    'estado_partido', pp.estado_partido, 'cupo_minimo', pp.cupo_minimo,
    'cupo_maximo', pp.cupo_maximo, 'cantidad_invitados_anonimos', pp.cantidad_invitados_anonimos,
    'nivel_requerido', pp.nivel_requerido, 'requiere_aprobacion', pp.requiere_aprobacion,
    'expira_pre_reserva_at', pp.expira_pre_reserva_at,
    'fecha', pp.fecha, 'hora_inicio', pp.hora_inicio, 'hora_fin', pp.hora_fin,
    'cancha_nombre', pp.cancha_nombre, 'precio_total', pp.precio_total,
    'precio_sena', pp.precio_sena, 'club_nombre', pp.club_nombre,
    'direccion', pp.direccion, 'latitud', pp.latitud, 'longitud', pp.longitud,
    'jugadores_confirmados', pp.jugadores_confirmados,
    'mi_estado_inscripcion', pp.mi_estado_inscripcion
  )
  FROM partidos_publicos pp
  JOIN clubes cl ON cl.nombre = pp.club_nombre
  WHERE
    (p_nivel IS NULL OR pp.nivel_requerido = p_nivel)
    AND (p_texto IS NULL OR (
      pp.club_nombre ILIKE '%' || p_texto || '%'
      OR pp.cancha_nombre ILIKE '%' || p_texto || '%'
      OR COALESCE(pp.direccion, '') ILIKE '%' || p_texto || '%'
    ))
    AND (p_radio_km IS NULL OR p_lat IS NULL OR p_lng IS NULL OR
      ST_DWithin(cl.ubicacion, ST_MakePoint(p_lng, p_lat)::geography, p_radio_km * 1000)
    )
  ORDER BY pp.fecha ASC, pp.hora_inicio ASC;
END;
$function$;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: RPC buscar_partidos con filtros de nivel, texto y cercanía"
```

---

## Task 4: Crear componente MatchFilters

**Files:**
- Create: `src/components/features/MatchFilters.tsx`

- [ ] **Step 1: Crear componente**

```typescript
// src/components/features/MatchFilters.tsx
import { useState } from 'react';
import { Search, MapPin, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export type FiltrosPartido = {
  nivel: string | null;
  texto: string;
  radioKm: number | null;
};

type Props = {
  filtros: FiltrosPartido;
  onFiltrosChange: (filtros: FiltrosPartido) => void;
  resultadoCount: number;
};

const NIVELES = [
  { value: null, label: 'Todos' },
  { value: 'recreativo', label: 'Recreativo' },
  { value: 'intermedio', label: 'Intermedio' },
  { value: 'competitivo', label: 'Competitivo' },
];

const RADIOS = [
  { value: null, label: 'Todos' },
  { value: 5, label: '5 km' },
  { value: 10, label: '10 km' },
  { value: 25, label: '25 km' },
  { value: 50, label: '50 km' },
];

export function MatchFilters({ filtros, onFiltrosChange, resultadoCount }: Props) {
  const [expanded, setExpanded] = useState(false);

  function update(partial: Partial<FiltrosPartido>) {
    onFiltrosChange({ ...filtros, ...partial });
  }

  const tieneFiltros = filtros.nivel || filtros.texto || filtros.radioKm;

  return (
    <div className="rounded-xl border border-vb-gray/10 bg-white p-4 shadow-card">
      {/* Barra principal */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-vb-gray/40" size={18} />
          <Input
            className="pl-10"
            placeholder="Buscar por club, cancha o dirección..."
            value={filtros.texto}
            onChange={(e) => update({ texto: e.target.value })}
          />
        </div>
        <Button
          variant={expanded ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setExpanded(!expanded)}
        >
          <SlidersHorizontal size={16} />
          Filtros
          {tieneFiltros && (
            <span className="ml-1 grid h-5 w-5 place-items-center rounded-full bg-vb-orange text-[10px] font-bold text-white">
              {[filtros.nivel, filtros.radioKm].filter(Boolean).length}
            </span>
          )}
        </Button>
      </div>

      {/* Filtros expandidos */}
      {expanded && (
        <div className="mt-4 grid gap-4 border-t border-vb-gray/10 pt-4">
          {/* Nivel */}
          <div>
            <label className="mb-2 block text-xs font-semibold text-vb-gray/60 uppercase tracking-wide">Nivel</label>
            <div className="flex flex-wrap gap-2">
              {NIVELES.map((n) => (
                <button
                  key={n.label}
                  onClick={() => update({ nivel: n.value })}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                    filtros.nivel === n.value
                      ? 'bg-vb-orange text-white'
                      : 'bg-vb-gray/10 text-vb-gray/60 hover:bg-vb-gray/20'
                  }`}
                >
                  {n.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cercanía */}
          <div>
            <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-vb-gray/60 uppercase tracking-wide">
              <MapPin size={14} />
              Cercanía
            </label>
            <div className="flex flex-wrap gap-2">
              {RADIOS.map((r) => (
                <button
                  key={r.label}
                  onClick={() => update({ radioKm: r.value })}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                    filtros.radioKm === r.value
                      ? 'bg-vb-orange text-white'
                      : 'bg-vb-gray/10 text-vb-gray/60 hover:bg-vb-gray/20'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Limpiar */}
          {tieneFiltros && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onFiltrosChange({ nivel: null, texto: '', radioKm: null })}
              className="justify-self-start"
            >
              <X size={14} />
              Limpiar filtros
            </Button>
          )}
        </div>
      )}

      {/* Contador */}
      <p className="mt-3 text-xs text-vb-gray/50">
        {resultadoCount} partido{resultadoCount !== 1 ? 's' : ''} encontrado{resultadoCount !== 1 ? 's' : ''}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/features/MatchFilters.tsx
git commit -m "feat: componente MatchFilters para búsqueda avanzada"
```

---

## Task 5: Crear hook usePartidosFiltrados

**Files:**
- Create: `src/hooks/usePartidosFiltrados.ts`

- [ ] **Step 1: Crear hook**

```typescript
// src/hooks/usePartidosFiltrados.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useGeolocation } from '@/hooks/useGeolocation';
import type { PartidoPublico } from '@/types';
import type { FiltrosPartido } from '@/components/features/MatchFilters';

export function usePartidosFiltrados(isAuthenticated: boolean) {
  const [partidos, setPartidos] = useState<PartidoPublico[]>([]);
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState(0);
  const [filtros, setFiltros] = useState<FiltrosPartido>({ nivel: null, texto: '', radioKm: null });
  const { center } = useGeolocation();

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!isAuthenticated) { setPartidos([]); return; }
    let cancelled = false;
    setLoading(true);

    const tieneFiltros = filtros.nivel || filtros.texto.trim() || filtros.radioKm;

    if (tieneFiltros) {
      // Usar RPC buscar_partidos
      supabase.rpc('buscar_partidos', {
        p_nivel: filtros.nivel || null,
        p_texto: filtros.texto.trim() || null,
        p_lat: filtros.radioKm ? center[0] : null,
        p_lng: filtros.radioKm ? center[1] : null,
        p_radio_km: filtros.radioKm || null,
      }).then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('Error buscando partidos:', error);
          setPartidos([]);
        } else {
          setPartidos((data ?? []) as unknown as PartidoPublico[]);
        }
        setLoading(false);
      });
    } else {
      // Sin filtros: usar partidos_publicos directamente
      supabase
        .from('partidos_publicos')
        .select('*')
        .order('fecha', { ascending: true })
        .order('hora_inicio', { ascending: true })
        .then(({ data, error }) => {
          if (cancelled) return;
          if (error) {
            setPartidos([]);
          } else {
            setPartidos(data as PartidoPublico[]);
          }
          setLoading(false);
        });
    }

    return () => { cancelled = true; };
  }, [isAuthenticated, filtros, center, version]);

  return { partidos, loading, filtros, setFiltros, refresh };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/usePartidosFiltrados.ts
git commit -m "feat: hook usePartidosFiltrados con filtros de nivel, texto y cercanía"
```

---

## Task 6: Integrar filtros en PartidosPage

**Files:**
- Modify: `src/pages/PartidosPage.tsx`

- [ ] **Step 1: Reemplazar usePartidos con usePartidosFiltrados**

Cambiar imports:
```typescript
import { usePartidosFiltrados } from '@/hooks/usePartidosFiltrados';
import { MatchFilters } from '@/components/features/MatchFilters';
```

Reemplazar el hook:
```typescript
const { partidos, loading, filtros, setFiltros, refresh } = usePartidosFiltrados(isAuthenticated);
```

- [ ] **Step 2: Agregar componente de filtros**

Después del header, antes del contenido:

```tsx
<main className="mx-auto max-w-7xl px-4 py-6">
  <MatchFilters
    filtros={filtros}
    onFiltrosChange={setFiltros}
    resultadoCount={partidos.length}
  />

  {/* ... contenido existente ... */}
</main>
```

- [ ] **Step 3: Build y commit**

```bash
npm run build
git add -A
git commit -m "feat: búsqueda avanzada de partidos con filtros en PartidosPage"
```

---

## Task 7: Actualizar MEMORY.md

- [ ] **Step 1: Agregar sección Fase 1 a Memory.md**
- [ ] **Step 2: Commit**
