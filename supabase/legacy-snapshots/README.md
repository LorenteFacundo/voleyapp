# Esquemas de referencia históricos

Estos dos archivos son snapshots previos que no forman parte del historial aplicado en la base remota de VoleyApp. Se conservan como referencia y no deben ejecutarse como migraciones.

El historial canónico está en `../migrations/`: las versiones remotas anteriores se recuperaron de `supabase_migrations.schema_migrations`. Los cambios nuevos deben añadirse con `supabase migration new` y probarse en una base aislada antes de producción.
