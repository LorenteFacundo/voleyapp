# Fase 3 — Social: Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar muro de mensajes por partido, sistema de badges de logros, y ranking por puntos de actividad.

**Architecture:** Tres features interconectadas que comparten infraestructura de backend (tablas, RPCs). Los puntos alimentan los badges, y ambos se muestran en el perfil. El muro es independiente. Todo se integra con los flujos existentes de partidos.

**Tech Stack:** React + TypeScript + Supabase (Postgres RPC + RLS) + Tailwind + Lucide icons + Sonner toasts

---

## File Map

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `supabase/migrations/00002_fase3_social.sql` | Create | Tablas, RPCs, vistas, RLS, seed badges |
| `src/types/index.ts` | Modify | Tipos nuevos: MensajePartido, Badge, PuntosActividad, RankingEntry |
| `src/lib/booking.ts` | Modify | Funciones: enviarMensaje, fetchMensajes, fetchBadges, fetchRanking |
| `src/hooks/useMensajesPartido.ts` | Create | Hook para mensajes del partido |
| `src/hooks/useBadges.ts` | Create | Hook para badges del usuario |
| `src/hooks/useRanking.ts` | Create | Hook para leaderboard |
| `src/components/features/MatchMessages.tsx` | Create | Componente muro de mensajes |
| `src/components/features/BadgesGrid.tsx` | Create | Grid de badges en perfil |
| `src/components/features/RankingBoard.tsx` | Create | Leaderboard de jugadores |
| `src/pages/MatchDetailPage.tsx` | Modify | Integrar MatchMessages |
| `src/pages/PerfilPage.tsx` | Modify | Integrar BadgesGrid + puntos |
| `src/pages/HomePage.tsx` | Modify | Integrar RankingBoard o link a ranking |
| `src/lib/admin.ts` | Modify | Llamar otorgar_puntos/verificar_badges desde RPCs existentes |

---

## Task 1: Database schema — tablas y RPCs

**Files:**
- Create: `supabase/migrations/00002_fase3_social.sql`

- [ ] **Step 1: Crear archivo de migración con tablas**

```sql
-- 00002_fase3_social.sql
-- Fase 3: Social — Muro de mensajes, Badges, Ranking

-- ============ TABLAS ============

-- Mensajes del partido
CREATE TABLE IF NOT EXISTS public.mensajes_partido (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  partido_id bigint NOT NULL REFERENCES public.partidos(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
  texto text NOT NULL CHECK (char_length(texto) > 0 AND char_length(texto) <= 500),
  created_at timestamptz DEFAULT now()
);

-- Catálogo de badges
CREATE TABLE IF NOT EXISTS public.badges_catalogo (
  id varchar PRIMARY KEY,
  nombre text NOT NULL,
  descripcion text NOT NULL,
  icono varchar NOT NULL
);

-- Badges otorgados a usuarios
CREATE TABLE IF NOT EXISTS public.usuario_badges (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
  badge_id varchar NOT NULL REFERENCES public.badges_catalogo(id),
  otorgado_at timestamptz DEFAULT now(),
  UNIQUE(usuario_id, badge_id)
);

-- Puntos de actividad
CREATE TABLE IF NOT EXISTS public.puntos_actividad (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
  puntos int NOT NULL,
  motivo varchar NOT NULL,
  referencia_id bigint,
  created_at timestamptz DEFAULT now()
);

-- Agregar puntos_total a usuarios
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS puntos_total int DEFAULT 0;
```

- [ ] **Step 2: Agregar RLS y policies**

```sql
-- ============ RLS ============
ALTER TABLE public.mensajes_partido ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.puntos_actividad ENABLE ROW LEVEL SECURITY;

-- badges_catalogo: lectura pública
CREATE POLICY "Badges visibles para todos" ON public.badges_catalogo FOR SELECT USING (true);

-- usuario_badges: lectura pública
CREATE POLICY "Badges de usuario visibles" ON public.usuario_badges FOR SELECT USING (true);

-- mensajes_partido: lectura/escritura solo para participantes confirmados
CREATE POLICY "Mensajes visibles para participantes" ON public.mensajes_partido FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.participantes_partido pp
    WHERE pp.partido_id = mensajes_partido.partido_id
      AND pp.usuario_id = auth.uid()
      AND pp.estado_inscripcion = 'confirmado'
  )
);

CREATE POLICY "Participantes envían mensajes" ON public.mensajes_partido FOR INSERT WITH CHECK (
  usuario_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.participantes_partido pp
    WHERE pp.partido_id = mensajes_partido.partido_id
      AND pp.usuario_id = auth.uid()
      AND pp.estado_inscripcion = 'confirmado'
  )
);

-- puntos_actividad: lectura propia
CREATE POLICY "Usuario ve sus puntos" ON public.puntos_actividad FOR SELECT USING (usuario_id = auth.uid());
```

- [ ] **Step 3: Crear vista ranking_jugadores**

```sql
-- Vista ranking
CREATE OR REPLACE VIEW public.ranking_jugadores
WITH (security_invoker = true) AS
SELECT
  u.id,
  u.nombre_completo,
  u.nivel_voley,
  u.puntos_total,
  ROW_NUMBER() OVER (ORDER BY u.puntos_total DESC) AS posicion
FROM public.usuarios u
WHERE u.puntos_total > 0
ORDER BY u.puntos_total DESC
LIMIT 100;
```

- [ ] **Step 4: Crear RPC enviar_mensaje**

```sql
CREATE OR REPLACE FUNCTION public.enviar_mensaje(p_partido_id bigint, p_texto text)
RETURNS mensajes_partido
LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE v_mensaje mensajes_partido%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF char_length(trim(p_texto)) = 0 THEN RAISE EXCEPTION 'El mensaje no puede estar vacío'; END IF;
  IF char_length(p_texto) > 500 THEN RAISE EXCEPTION 'El mensaje no puede superar 500 caracteres'; END IF;

  -- Verificar que es participante confirmado
  IF NOT EXISTS (
    SELECT 1 FROM participantes_partido
    WHERE partido_id = p_partido_id AND usuario_id = auth.uid() AND estado_inscripcion = 'confirmado'
  ) THEN
    RAISE EXCEPTION 'Solo participantes confirmados pueden escribir mensajes';
  END IF;

  INSERT INTO mensajes_partido (partido_id, usuario_id, texto)
  VALUES (p_partido_id, auth.uid(), trim(p_texto))
  RETURNING * INTO v_mensaje;

  RETURN v_mensaje;
END;
$function$;
```

- [ ] **Step 5: Crear RPC otorgar_puntos**

```sql
CREATE OR REPLACE FUNCTION public.otorgar_puntos(
  p_usuario_id uuid, p_puntos int, p_motivo varchar, p_referencia_id bigint DEFAULT NULL
)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE v_nuevo_total int;
BEGIN
  INSERT INTO puntos_actividad (usuario_id, puntos, motivo, referencia_id)
  VALUES (p_usuario_id, p_puntos, p_motivo, p_referencia_id);

  UPDATE usuarios SET puntos_total = puntos_total + p_puntos
  WHERE id = p_usuario_id
  RETURNING puntos_total INTO v_nuevo_total;

  -- Verificar badges después de otorgar puntos
  PERFORM verificar_badges(p_usuario_id);

  RETURN v_nuevo_total;
END;
$function$;
```

- [ ] **Step 6: Crear RPC verificar_badges**

```sql
CREATE OR REPLACE FUNCTION public.verificar_badges(p_usuario_id uuid)
RETURNS text[]
LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE
  v_nuevos text[] := '{}';
  v_count int;
  v_nivel int;
BEGIN
  -- primer_partido: crear o unirse al menos 1 partido
  IF NOT EXISTS (SELECT 1 FROM usuario_badges WHERE usuario_id = p_usuario_id AND badge_id = 'primer_partido') THEN
    SELECT COUNT(*) INTO v_count FROM (
      SELECT partido_id FROM participantes_partido WHERE usuario_id = p_usuario_id
      UNION
      SELECT id FROM partidos WHERE organizador_id = p_usuario_id
    ) t;
    IF v_count >= 1 THEN
      INSERT INTO usuario_badges (usuario_id, badge_id) VALUES (p_usuario_id, 'primer_partido');
      v_nuevos := array_append(v_nuevos, 'primer_partido');
    END IF;
  END IF;

  -- organizador_nato: crear 5+ partidos
  IF NOT EXISTS (SELECT 1 FROM usuario_badges WHERE usuario_id = p_usuario_id AND badge_id = 'organizador_nato') THEN
    SELECT COUNT(*) INTO v_count FROM partidos WHERE organizador_id = p_usuario_id;
    IF v_count >= 5 THEN
      INSERT INTO usuario_badges (usuario_id, badge_id) VALUES (p_usuario_id, 'organizador_nato');
      v_nuevos := array_append(v_nuevos, 'organizador_nato');
    END IF;
  END IF;

  -- sociable: unirse a 10+ partidos (como participante, no organizador)
  IF NOT EXISTS (SELECT 1 FROM usuario_badges WHERE usuario_id = p_usuario_id AND badge_id = 'sociable') THEN
    SELECT COUNT(*) INTO v_count FROM participantes_partido WHERE usuario_id = p_usuario_id;
    IF v_count >= 10 THEN
      INSERT INTO usuario_badges (usuario_id, badge_id) VALUES (p_usuario_id, 'sociable');
      v_nuevos := array_append(v_nuevos, 'sociable');
    END IF;
  END IF;

  -- veterano: 25+ partidos totales
  IF NOT EXISTS (SELECT 1 FROM usuario_badges WHERE usuario_id = p_usuario_id AND badge_id = 'veterano') THEN
    SELECT COUNT(*) INTO v_count FROM (
      SELECT partido_id FROM participantes_partido WHERE usuario_id = p_usuario_id
      UNION ALL
      SELECT id FROM partidos WHERE organizador_id = p_usuario_id
    ) t;
    IF v_count >= 25 THEN
      INSERT INTO usuario_badges (usuario_id, badge_id) VALUES (p_usuario_id, 'veterano');
      v_nuevos := array_append(v_nuevos, 'veterano');
    END IF;
  END IF;

  -- nivel_alto: nivel_voley >= 8
  IF NOT EXISTS (SELECT 1 FROM usuario_badges WHERE usuario_id = p_usuario_id AND badge_id = 'nivel_alto') THEN
    SELECT nivel_voley INTO v_nivel FROM usuarios WHERE id = p_usuario_id;
    IF v_nivel >= 8 THEN
      INSERT INTO usuario_badges (usuario_id, badge_id) VALUES (p_usuario_id, 'nivel_alto');
      v_nuevos := array_append(v_nuevos, 'nivel_alto');
    END IF;
  END IF;

  -- racha_3: últimos 3 partidos sin gap > 7 días
  IF NOT EXISTS (SELECT 1 FROM usuario_badges WHERE usuario_id = p_usuario_id AND badge_id = 'racha_3') THEN
    WITH partidos_usuario AS (
      SELECT t.fecha FROM participantes_partido pp
        JOIN partidos p ON p.id = pp.partido_id
        JOIN reservas r ON r.id = p.reserva_id
        JOIN disponibilidad_turnos t ON t.id = r.turno_id
        WHERE pp.usuario_id = p_usuario_id
      UNION
      SELECT t.fecha FROM partidos p
        JOIN reservas r ON r.id = p.reserva_id
        JOIN disponibilidad_turnos t ON t.id = r.turno_id
        WHERE p.organizador_id = p_usuario_id
    ),
    fechas_ordenadas AS (
      SELECT fecha, LAG(fecha) OVER (ORDER BY fecha DESC) AS fecha_anterior
      FROM partidos_usuario ORDER BY fecha DESC LIMIT 3
    )
    SELECT COUNT(*) INTO v_count FROM fechas_ordenadas
    WHERE fecha_anterior IS NOT NULL AND (fecha_anterior - fecha) <= 7;
    IF v_count >= 2 THEN
      INSERT INTO usuario_badges (usuario_id, badge_id) VALUES (p_usuario_id, 'racha_3');
      v_nuevos := array_append(v_nuevos, 'racha_3');
    END IF;
  END IF;

  RETURN v_nuevos;
END;
$function$;
```

- [ ] **Step 7: Seed catálogo de badges**

```sql
INSERT INTO public.badges_catalogo (id, nombre, descripcion, icono) VALUES
  ('primer_partido', 'Debut', 'Creaste o te uniste a tu primer partido', 'Volleyball'),
  ('racha_3', 'Racha de 3', 'Jugaste 3 partidos consecutivos sin abandonar', 'Flame'),
  ('organizador_nato', 'Organizador nato', 'Creaste 5 o más partidos', 'Star'),
  ('sociable', 'Sociable', 'Te uniste a 10 o más partidos', 'Users'),
  ('veterano', 'Veterano', 'Participaste en 25 o más partidos', 'Trophy'),
  ('nivel_alto', 'Nivel competitivo', 'Alcanzaste nivel de vóley 8 o superior', 'Zap')
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 8: Aplicar migración via Supabase MCP**

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/00002_fase3_social.sql
git commit -m "feat: Fase 3 schema - mensajes, badges, puntos, ranking"
```

---

## Task 2: Tipos TypeScript

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Agregar tipos nuevos al final del archivo**

```typescript
// Fase 3: Social
export type MensajePartido = {
  id: number;
  partido_id: number;
  usuario_id: string;
  texto: string;
  created_at: string;
  nombre?: string; // JOIN con usuarios
};

export type BadgeCatalogo = {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
};

export type UsuarioBadge = BadgeCatalogo & {
  otorgado_at: string;
};

export type RankingEntry = {
  id: string;
  nombre_completo: string | null;
  nivel_voley: number | null;
  puntos_total: number;
  posicion: number;
};
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: tipos TypeScript para Fase 3 Social"
```

---

## Task 3: Funciones de backend (lib/booking.ts)

**Files:**
- Modify: `src/lib/booking.ts`

- [ ] **Step 1: Agregar funciones de mensajes**

```typescript
export async function enviarMensaje(partidoId: number, texto: string) {
  const { data, error } = await supabase.rpc('enviar_mensaje', {
    p_partido_id: partidoId,
    p_texto: texto,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchMensajesPartido(partidoId: number): Promise<MensajePartido[]> {
  const { data, error } = await supabase
    .from('mensajes_partido')
    .select('id, partido_id, usuario_id, texto, created_at, usuarios:usuario_id(nombre_completo)')
    .eq('partido_id', partidoId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((m: any) => ({
    id: m.id,
    partido_id: m.partido_id,
    usuario_id: m.usuario_id,
    texto: m.texto,
    created_at: m.created_at,
    nombre: m.usuarios?.nombre_completo ?? 'Jugador',
  }));
}
```

- [ ] **Step 2: Agregar funciones de badges**

```typescript
export async function fetchBadgesUsuario(usuarioId: string): Promise<UsuarioBadge[]> {
  const { data, error } = await supabase
    .from('usuario_badges')
    .select('badge_id, otorgado_at, badges_catalogo:badge_id(nombre, descripcion, icono)')
    .eq('usuario_id', usuarioId)
    .order('otorgado_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((b: any) => ({
    id: b.badge_id,
    nombre: b.badges_catalogo?.nombre ?? b.badge_id,
    descripcion: b.badges_catalogo?.descripcion ?? '',
    icono: b.badges_catalogo?.icono ?? 'Award',
    otorgado_at: b.otorgado_at,
  }));
}

export async function fetchBadgesCatalogo(): Promise<BadgeCatalogo[]> {
  const { data, error } = await supabase
    .from('badges_catalogo')
    .select('*')
    .order('id');
  if (error) throw new Error(error.message);
  return (data ?? []) as BadgeCatalogo[];
}
```

- [ ] **Step 3: Agregar funciones de ranking**

```typescript
export async function fetchRanking(limit = 20): Promise<RankingEntry[]> {
  const { data, error } = await supabase
    .from('ranking_jugadores')
    .select('*')
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as RankingEntry[];
}
```

- [ ] **Step 4: Importar tipos nuevos en booking.ts**

```typescript
import type { CanchaDetalle, ClubPublico, Turno, TurnoVirtual, MensajePartido, BadgeCatalogo, UsuarioBadge, RankingEntry } from '../types';
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/booking.ts
git commit -m "feat: funciones de mensajes, badges y ranking en booking.ts"
```

---

## Task 4: Hooks nuevos

**Files:**
- Create: `src/hooks/useMensajesPartido.ts`
- Create: `src/hooks/useBadges.ts`
- Create: `src/hooks/useRanking.ts`

- [ ] **Step 1: Crear useMensajesPartido**

```typescript
// src/hooks/useMensajesPartido.ts
import { useState, useEffect, useCallback } from 'react';
import { fetchMensajesPartido } from '@/lib/booking';
import type { MensajePartido } from '@/types';

export function useMensajesPartido(partidoId: number | null) {
  const [mensajes, setMensajes] = useState<MensajePartido[]>([]);
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!partidoId) { setMensajes([]); return; }
    let cancelled = false;
    setLoading(true);
    fetchMensajesPartido(partidoId).then((data) => {
      if (cancelled) return;
      setMensajes(data);
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setMensajes([]);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [partidoId, version]);

  return { mensajes, loading, refresh };
}
```

- [ ] **Step 2: Crear useBadges**

```typescript
// src/hooks/useBadges.ts
import { useState, useEffect } from 'react';
import { fetchBadgesUsuario, fetchBadgesCatalogo } from '@/lib/booking';
import type { BadgeCatalogo, UsuarioBadge } from '@/types';

export function useBadges(usuarioId: string | null) {
  const [obtenidos, setObtenidos] = useState<UsuarioBadge[]>([]);
  const [catalogo, setCatalogo] = useState<BadgeCatalogo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!usuarioId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchBadgesUsuario(usuarioId), fetchBadgesCatalogo()])
      .then(([u, c]) => {
        if (cancelled) return;
        setObtenidos(u);
        setCatalogo(c);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [usuarioId]);

  return { obtenidos, catalogo, loading };
}
```

- [ ] **Step 3: Crear useRanking**

```typescript
// src/hooks/useRanking.ts
import { useState, useEffect, useCallback } from 'react';
import { fetchRanking } from '@/lib/booking';
import type { RankingEntry } from '@/types';

export function useRanking(limit = 20) {
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchRanking(limit).then((data) => {
      if (cancelled) return;
      setRanking(data);
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setRanking([]);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [limit, version]);

  return { ranking, loading, refresh };
}
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useMensajesPartido.ts src/hooks/useBadges.ts src/hooks/useRanking.ts
git commit -m "feat: hooks useMensajesPartido, useBadges, useRanking"
```

---

## Task 5: Componente MatchMessages

**Files:**
- Create: `src/components/features/MatchMessages.tsx`

- [ ] **Step 1: Crear componente**

```typescript
// src/components/features/MatchMessages.tsx
import { useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { toast } from 'sonner';
import { enviarMensaje } from '@/lib/booking';
import { useMensajesPartido } from '@/hooks/useMensajesPartido';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';

type Props = {
  partidoId: number;
  puedeEscribir: boolean;
};

export function MatchMessages({ partidoId, puedeEscribir }: Props) {
  const { mensajes, loading, refresh } = useMensajesPartido(partidoId);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function handleEnviar() {
    if (!texto.trim()) return;
    setEnviando(true);
    try {
      await enviarMensaje(partidoId, texto);
      setTexto('');
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al enviar mensaje');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card padding="lg">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-vb-blue">
        <MessageSquare size={20} />
        Muro del partido
      </h2>

      {loading ? (
        <div className="grid gap-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={60} rounded />)}
        </div>
      ) : mensajes.length === 0 ? (
        <p className="py-6 text-center text-sm text-vb-gray/60">
          Todavía no hay mensajes. Sé el primero en saludar.
        </p>
      ) : (
        <div className="mb-4 grid gap-3 max-h-80 overflow-y-auto">
          {mensajes.map((m) => (
            <div key={m.id} className="flex gap-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-vb-orange-light text-vb-orange text-xs font-bold">
                {(m.nombre ?? 'U')[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-vb-blue">{m.nombre}</span>
                  <span className="text-xs text-vb-gray/40">{formatTimestamp(m.created_at)}</span>
                </div>
                <p className="text-sm text-vb-gray break-words">{m.texto}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {puedeEscribir && (
        <div className="flex gap-2 border-t border-vb-gray/10 pt-3">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value.slice(0, 500))}
            placeholder="Escribí un mensaje..."
            rows={1}
            className="flex-1 resize-none rounded-lg border border-vb-gray/15 px-3 py-2 text-sm focus:border-vb-orange focus:outline-none"
            maxLength={500}
          />
          <Button size="sm" onClick={handleEnviar} loading={enviando} disabled={!texto.trim()}>
            <Send size={16} />
          </Button>
        </div>
      )}
    </Card>
  );
}

function formatTimestamp(ts: string): string {
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'ahora';
  if (diffMin < 60) return `hace ${diffMin}m`;
  const diffHs = Math.floor(diffMin / 60);
  if (diffHs < 24) return `hace ${diffHs}h`;
  const diffDays = Math.floor(diffHs / 24);
  if (diffDays < 7) return `hace ${diffDays}d`;
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/features/MatchMessages.tsx
git commit -m "feat: componente MatchMessages para muro del partido"
```

---

## Task 6: Componente BadgesGrid

**Files:**
- Create: `src/components/features/BadgesGrid.tsx`

- [ ] **Step 1: Crear componente**

```typescript
// src/components/features/BadgesGrid.tsx
import { Award, Lock } from 'lucide-react';
import { useBadges } from '@/hooks/useBadges';
import type { BadgeCatalogo } from '@/types';

// Mapa de iconos de Lucide
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Volleyball: () => <span className="text-lg">🏐</span>,
  Flame: () => <span className="text-lg">🔥</span>,
  Star: () => <span className="text-lg">⭐</span>,
  Users: () => <span className="text-lg">🤝</span>,
  Trophy: () => <span className="text-lg">🏆</span>,
  Zap: () => <span className="text-lg">💪</span>,
};

type Props = {
  usuarioId: string;
};

export function BadgesGrid({ usuarioId }: Props) {
  const { obtenidos, catalogo, loading } = useBadges(usuarioId);

  if (loading) {
    return <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-vb-gray/10" />)}</div>;
  }

  const obtenidosIds = new Set(obtenidos.map((b) => b.id));

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
      {catalogo.map((badge) => {
        const tiene = obtenidosIds.has(badge.id);
        return (
          <div
            key={badge.id}
            className={`flex flex-col items-center gap-2 rounded-xl p-3 text-center transition ${
              tiene ? 'bg-vb-orange-light' : 'bg-vb-gray/5 opacity-50'
            }`}
            title={badge.descripcion}
          >
            <div className={`grid h-10 w-10 place-items-center rounded-full ${tiene ? 'bg-vb-orange text-white' : 'bg-vb-gray/10 text-vb-gray/40'}`}>
              {tiene ? (ICON_MAP[badge.icono]?.({}) ?? <Award size={20} />) : <Lock size={16} />}
            </div>
            <span className={`text-xs font-semibold ${tiene ? 'text-vb-blue' : 'text-vb-gray/50 line-through'}`}>
              {badge.nombre}
            </span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/features/BadgesGrid.tsx
git commit -m "feat: componente BadgesGrid para perfil de jugador"
```

---

## Task 7: Componente RankingBoard

**Files:**
- Create: `src/components/features/RankingBoard.tsx`

- [ ] **Step 1: Crear componente**

```typescript
// src/components/features/RankingBoard.tsx
import { Trophy, Medal } from 'lucide-react';
import { useRanking } from '@/hooks/useRanking';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';

type Props = {
  limit?: number;
  mostrarTitulo?: boolean;
};

const MEDAL_COLORS = ['text-yellow-500', 'text-gray-400', 'text-amber-700'];

export function RankingBoard({ limit = 20, mostrarTitulo = true }: Props) {
  const { ranking, loading } = useRanking(limit);

  return (
    <Card padding="lg">
      {mostrarTitulo && (
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-vb-blue">
          <Trophy size={20} className="text-vb-orange" />
          Ranking de jugadores
        </h2>
      )}

      {loading ? (
        <div className="grid gap-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={48} rounded />)}
        </div>
      ) : ranking.length === 0 ? (
        <p className="py-6 text-center text-sm text-vb-gray/60">
          Todavía no hay jugadores con puntos.
        </p>
      ) : (
        <div className="grid gap-1">
          {ranking.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-vb-light"
            >
              <span className={`w-6 text-center font-bold ${entry.posicion <= 3 ? 'text-lg' : 'text-sm text-vb-gray/50'}`}>
                {entry.posicion <= 3 ? (
                  <Medal size={18} className={MEDAL_COLORS[entry.posicion - 1]} />
                ) : (
                  entry.posicion
                )}
              </span>
              <div className="grid h-8 w-8 place-items-center rounded-full bg-vb-orange-light text-vb-orange text-xs font-bold">
                {(entry.nombre_completo ?? 'U')[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-vb-blue">
                  {entry.nombre_completo ?? 'Jugador'}
                </p>
                <p className="text-xs text-vb-gray/50">Nivel {entry.nivel_voley ?? '-'}</p>
              </div>
              <span className="text-sm font-bold text-vb-orange">{entry.puntos_total}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/features/RankingBoard.tsx
git commit -m "feat: componente RankingBoard para leaderboard"
```

---

## Task 8: Integrar en MatchDetailPage

**Files:**
- Modify: `src/pages/MatchDetailPage.tsx`

- [ ] **Step 1: Importar MatchMessages**

Agregar import:
```typescript
import { MatchMessages } from '@/components/features/MatchMessages';
```

- [ ] **Step 2: Agregar sección de muro después de participantes**

Después del bloque de participantes (antes del mapa), agregar:
```tsx
{/* Muro del partido */}
{yaInscripto && (
  <MatchMessages
    partidoId={partido.id}
    puedeEscribir={partido.mi_estado_inscripcion === 'confirmado'}
  />
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/MatchDetailPage.tsx
git commit -m "feat: integrar muro de mensajes en MatchDetailPage"
```

---

## Task 9: Integrar en PerfilPage

**Files:**
- Modify: `src/pages/PerfilPage.tsx`

- [ ] **Step 1: Importar BadgesGrid**

```typescript
import { BadgesGrid } from '@/components/features/BadgesGrid';
import { Award } from 'lucide-react';
```

- [ ] **Step 2: Agregar sección de puntos y badges después de stats**

Después del grid de stats (Nivel / Rol), agregar:
```tsx
{/* Puntos de actividad */}
<div className="w-full rounded-xl bg-vb-light p-4 text-center">
  <p className="text-3xl font-black text-vb-orange">{perfil?.puntos_total ?? 0}</p>
  <p className="text-xs text-vb-gray/60">Puntos de actividad</p>
</div>

{/* Badges */}
<div className="w-full">
  <h3 className="mb-3 flex items-center gap-2 font-bold text-vb-blue">
    <Award size={18} />
    Mis badges
  </h3>
  <BadgesGrid usuarioId={session.user.id} />
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/PerfilPage.tsx
git commit -m "feat: integrar badges y puntos en PerfilPage"
```

---

## Task 10: Integrar ranking en HomePage

**Files:**
- Modify: `src/pages/HomePage.tsx`

- [ ] **Step 1: Importar RankingBoard**

```typescript
import { RankingBoard } from '@/components/features/RankingBoard';
```

- [ ] **Step 2: Agregar RankingBoard en el sidebar (después del BookingFlow card)**

En el `<aside>` del desktop, después del card de "Reservar cancha":
```tsx
<RankingBoard limit={10} />
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/HomePage.tsx
git commit -m "feat: integrar ranking en HomePage sidebar"
```

---

## Task 11: Integrar puntos en flujos existentes

**Files:**
- Modify: `src/lib/admin.ts` (llamar otorgar_puntos después de crear partido)
- Modify: `src/lib/booking.ts` (llamar otorgar_puntos después de unirse)

- [ ] **Step 1: Agregar función otorgarPuntos en booking.ts**

```typescript
export async function otorgarPuntos(usuarioId: string, puntos: number, motivo: string, referenciaId?: number) {
  const { error } = await supabase.rpc('otorgar_puntos', {
    p_usuario_id: usuarioId,
    p_puntos: puntos,
    p_motivo: motivo,
    p_referencia_id: referenciaId ?? null,
  });
  if (error) console.error('Error otorgando puntos:', error.message);
}
```

- [ ] **Step 2: Integrar en BookingFlow después de crear partido**

En `BookingFlow.tsx`, después de `toast.success(...)` de crear partido, agregar:
```typescript
import { otorgarPuntos } from '@/lib/booking';
// ...
if (session?.user?.id) {
  otorgarPuntos(session.user.id, 10, 'crear_partido', partidoId ?? data);
}
```

- [ ] **Step 3: Integrar en MatchDetailPage después de unirse**

En `MatchDetailPage.tsx`, después de `toast.success('Te uniste al partido')`, agregar:
```typescript
if (session?.user?.id && partido) {
  otorgarPuntos(session.user.id, 5, 'unirse', partido.id);
}
```

- [ ] **Step 4: Integrar en MatchDetailPage después de salirse**

Después de `toast.success('Saliste del partido')`, agregar:
```typescript
if (session?.user?.id && partido) {
  otorgarPuntos(session.user.id, -5, 'salirse', partido.id);
}
```

- [ ] **Step 5: Build y verificar**

```bash
npm run build
```

- [ ] **Step 6: Commit final**

```bash
git add -A
git commit -m "feat: Fase 3 Social completa - mensajes, badges, puntos, ranking"
```

---

## Verificación final

- [ ] Build pasa sin errores: `npm run build`
- [ ] Muro de mensajes visible en `/partido/:id` para participantes
- [ ] Badges visibles en `/perfil`
- [ ] Puntos visibles en `/perfil`
- [ ] Ranking visible en HomePage sidebar
- [ ] Puntos se otorgan al crear partido y unirse
