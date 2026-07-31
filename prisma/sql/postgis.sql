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

-- =============================================================================
-- MILESTONE 3 — PostGIS columns for PointOfInterest & SpatialRegion
-- =============================================================================

-- PointOfInterest: native geography(Point, 4326) for fast ST_DWithin queries
ALTER TABLE "PointOfInterest"
  ADD COLUMN IF NOT EXISTS "geoPoint" geography(Point, 4326);

-- Populate geoPoint from lat/lng (run after data inserts)
UPDATE "PointOfInterest"
  SET "geoPoint" = ST_SetSRID(ST_MakePoint("lng", "lat"), 4326)::geography
  WHERE "geoPoint" IS NULL AND "lat" IS NOT NULL AND "lng" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "PointOfInterest_geoPoint_idx"
  ON "PointOfInterest" USING GIST ("geoPoint");

-- SpatialRegion: native geography(Polygon, 4326) for ST_Contains queries
ALTER TABLE "SpatialRegion"
  ADD COLUMN IF NOT EXISTS "geoPolygon" geography(Polygon, 4326);

CREATE INDEX IF NOT EXISTS "SpatialRegion_geoPolygon_idx"
  ON "SpatialRegion" USING GIST ("geoPolygon");

-- Trigger to auto-sync geoPoint from lat/lng on insert/update
CREATE OR REPLACE FUNCTION sync_poi_geoPoint()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."lat" IS NOT NULL AND NEW."lng" IS NOT NULL THEN
    NEW."geoPoint" := ST_SetSRID(ST_MakePoint(NEW."lng", NEW."lat"), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "PointOfInterest_sync_geoPoint" ON "PointOfInterest";
CREATE TRIGGER "PointOfInterest_sync_geoPoint"
  BEFORE INSERT OR UPDATE OF "lat", "lng" ON "PointOfInterest"
  FOR EACH ROW EXECUTE FUNCTION sync_poi_geoPoint();

-- Spatial query helper: find POIs within a radius (meters) of a point
CREATE OR REPLACE FUNCTION find_pois_within_radius(
  p_lon double precision,
  p_lat double precision,
  p_radius_m integer,
  p_type text DEFAULT NULL
)
RETURNS TABLE (
  id text, name text, type text, lat double precision, lng double precision,
  distance_m double precision
)
LANGUAGE sql STABLE AS $$
  SELECT
    p."id", p."name", p."type", p."lat", p."lng",
    ST_Distance(p."geoPoint", ST_MakePoint(p_lon, p_lat)::geography) AS distance_m
  FROM "PointOfInterest" p
  WHERE p."geoPoint" IS NOT NULL
    AND ST_DWithin(p."geoPoint", ST_MakePoint(p_lon, p_lat)::geography, p_radius_m)
    AND (p_type IS NULL OR p."type" = p_type)
  ORDER BY distance_m ASC;
$$;

-- Spatial query helper: find POIs within a polygon (WKT)
CREATE OR REPLACE FUNCTION find_pois_within_polygon(
  p_polygon_wkt text,
  p_type text DEFAULT NULL
)
RETURNS TABLE (id text, name text, type text, lat double precision, lng double precision)
LANGUAGE sql STABLE AS $$
  SELECT p."id", p."name", p."type", p."lat", p."lng"
  FROM "PointOfInterest" p
  WHERE p."geoPoint" IS NOT NULL
    AND ST_Contains(ST_GeographyToGeometry(ST_GeogFromText(p_polygon_wkt)),
                    ST_GeographyToGeometry(p."geoPoint"))
    AND (p_type IS NULL OR p."type" = p_type);
$$;

-- Spatial query helper: nearest N POIs to a point
CREATE OR REPLACE FUNCTION find_nearest_pois(
  p_lon double precision,
  p_lat double precision,
  p_limit integer DEFAULT 10,
  p_type text DEFAULT NULL
)
RETURNS TABLE (id text, name text, type text, lat double precision, lng double precision,
  distance_m double precision)
LANGUAGE sql STABLE AS $$
  SELECT p."id", p."name", p."type", p."lat", p."lng",
    ST_Distance(p."geoPoint", ST_MakePoint(p_lon, p_lat)::geography) AS distance_m
  FROM "PointOfInterest" p
  WHERE p."geoPoint" IS NOT NULL
    AND (p_type IS NULL OR p."type" = p_type)
  ORDER BY p."geoPoint" <-> ST_MakePoint(p_lon, p_lat)::geography
  LIMIT p_limit;
$$;
