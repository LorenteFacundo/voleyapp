# Fase 1 — Fundamento: Spec de Diseño

**Fecha:** 2026-06-05
**Estado:** Aprobado
**Alcance:** Transferencia de liderazgo + Búsqueda avanzada de partidos

---

## 1. Transferencia de liderazgo al abandonar partido

### Descripción
Cuando el organizador de un partido decide abandonarlo:
- Si hay otros participantes → el más antiguo (primero en inscribirse) se convierte en el nuevo organizador
- Si no hay otros participantes → el partido se cancela y se oculta de la lista

### Cambio en `salirse_de_partido`
El RPC actual bloquea al organizador con `RAISE EXCEPTION`. Se modifica para:

1. Verificar que el usuario es el organizador
2. Si es organizador:
   a. Buscar el participante más antiguo (por `created_at` en `participantes_partido`) que NO sea el organizador
   b. Si existe → transferir `organizador_id` a ese participante, eliminar al organizador de participantes
   c. Si no existe → cancelar partido (`estado_partido = 'cancelado'`) y eliminar al organizador de participantes
3. Si no es organizador → comportamiento actual (eliminar de participantes)

### UX en MatchDetailPage
- El botón "Salir del partido" ahora aparece también para el organizador
- Si el organizador es el único inscrito, el botón dice "Cancelar partido" con estilo danger
- Si hay otros inscrito, el botón dice "Abandonar partido" (transferirá el liderazgo)
- Toast de confirmación: "Abandonaste el partido. [Nombre] es el nuevo organizador." o "Partido cancelado."

### Backend
- Modificar RPC `salirse_de_partido` con lógica de transferencia
- No se necesitan nuevas tablas

---

## 2. Búsqueda avanzada de partidos

### Descripción
Agregar filtros a la búsqueda de partidos en `PartidosPage` y potencialmente en `HomePage`.

### Filtros

| Filtro | Tipo | Implementación |
|--------|------|----------------|
| Nivel | Select (recreativo/intermedio/competitivo/todos) | WHERE clause en query |
| Texto | Input text (busca en club_nombre, cancha_nombre, direccion) | ILIKE en query |
| Cercanía | Slider de km + geolocalización del usuario | RPC con PostGIS ST_DWithin |

### UX
- Barra de filtros debajo del header en `PartidosPage`
- Filtros como chips/botones expandibles
- Filtro de nivel: 4 botones (Todos, Recreativo, Intermedio, Competitivo)
- Filtro de texto: input con icono de búsqueda
- Filtro de cercanía: toggle + slider (5km, 10km, 25km, 50km, Todos)
- Los filtros se combinan (AND)
- Contador de resultados actualizado
- Botón "Limpiar filtros"

### Backend
- Nueva RPC `buscar_partidos(p_nivel text, p_texto text, p_lat numeric, p_lng numeric, p_radio_km int)`
- Similar a `partidos_publicos` pero con WHERE clauses dinámicas
- Para cercanía: usa `ST_DWithin(cl.ubicacion, ST_MakePoint(p_lng, p_lat)::geography, p_radio_km * 1000)`
- Retorna los mismos campos que `partidos_publicos`

### Frontend
- Hook `usePartidosFiltrados` que reemplaza o extiende `usePartidos`
- Componente `MatchFilters` con los controles de filtro
- Integración en `PartidosPage`
- Los filtros se persisten en URL params (opcional, para compartir búsquedas)

---

## Orden de implementación

```
1. Modificar RPC salirse_de_partido con lógica de transferencia
2. Actualizar MatchDetailPage para mostrar botón al organizador
3. Crear RPC buscar_partidos con filtros
4. Crear componente MatchFilters
5. Crear hook usePartidosFiltrados
6. Integrar filtros en PartidosPage
7. Build y verificar
```
