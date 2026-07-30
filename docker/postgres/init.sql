-- =============================================================================
-- Sentinel — PostgreSQL bootstrap (runs once on first container init)
-- =============================================================================
-- Executed by the postgres image's docker-entrypoint-initdb.d hook BEFORE the
-- Sentinel app starts. Ensures the PostGIS extensions are present so the
-- subsequent prisma/sql/postgis.sql migration (geometry columns + spatial
-- indexes) succeeds.
--
-- This file is idempotent and safe to run on every fresh database init.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
