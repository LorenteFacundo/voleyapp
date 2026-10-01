# Esquemas y borradores históricos

Nada de esta carpeta debe ejecutarse. Se conserva como referencia.

- `00001_initial_schema.sql` y `00002_fase3_social.sql`: snapshots previos que no forman parte del historial aplicado en la base remota. El esquema que existía antes de las migraciones versionadas se reconstruye en `../migrations/20260527000000_esquema_base_previo.sql`.
- `borradores-piloto/`: borradores de agenda, partidos y accesos del piloto (septiembre 2026). Nunca se aplicaron y quedaron reemplazados por el modelo v2 (`../migrations/20261001130000_*` en adelante), que resuelve los problemas detectados en su revisión (columna `user_id` de `administradores_club`, spam de solicitudes, cancelaciones que dejaban reservas colgadas, tokens nulos y cupo sin bloqueo).

El historial canónico está en `../migrations/` y se valida con `npm run test:db`, que lo reconstruye desde cero en una base PostgreSQL local (PGlite).
