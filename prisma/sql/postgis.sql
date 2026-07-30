-- =============================================================================
-- Sentinel — PostGIS extension & spatial indexes (Production)
-- =============================================================================
-- Run AFTER `prisma db push --schema=prisma/schema.postgres.prisma`.
--
-- Prisma cannot declare native PostGIS geometry types, so they are added here
-- via raw SQL. This file is idempotent.
-- =============================================================================

-- 1. Enable PostGIS extension (must be a top-level statement)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- 2. Incident geospatial columns
ALTER TABLE "Incident"
  ADD COLUMN IF NOT EXISTS "geoPoint" geography(Point, 4326),
  ADD COLUMN IF NOT EXISTS "geoPolygon" geography(Polygon, 4326);

-- Spatial indexes for fast proximity / containment queries
CREATE INDEX IF NOT EXISTS "Incident_geoPoint_idx"
  ON "Incident" USING GIST ("geoPoint");

CREATE INDEX IF NOT EXISTS "Incident_geoPolygon_idx"
  ON "Incident" USING GIST ("geoPolygon");

-- 3. Report geospatial column
ALTER TABLE "Report"
  ADD COLUMN IF NOT EXISTS "geoPoint" geography(Point, 4326);

CREATE INDEX IF NOT EXISTS "Report_geoPoint_idx"
  ON "Report" USING GIST ("geoPoint");

-- 4. Helper: nearest-incident lookup function (example for future milestones)
CREATE OR REPLACE FUNCTION find_incidents_within_radius(
  p_lon double precision,
  p_lat double precision,
  p_radius_m integer
)
RETURNS TABLE (id text, reference text, distance_m double precision)
LANGUAGE sql STABLE AS $$
  SELECT
    i."id",
    i."reference",
    ST_Distance(i."geoPoint", ST_MakePoint(p_lon, p_lat)::geography) AS distance_m
  FROM "Incident" i
  WHERE i."geoPoint" IS NOT NULL
    AND ST_DWithin(i."geoPoint", ST_MakePoint(p_lon, p_lat)::geography, p_radius_m)
  ORDER BY distance_m ASC;
$$;
