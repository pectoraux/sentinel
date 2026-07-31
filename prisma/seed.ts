/**
 * Sentinel — Database seed
 * =============================================================================
 * Idempotent: safe to run multiple times. Seeds:
 *   - Permission catalogue
 *   - Role catalogue (with role→permission mappings)
 *   - Default feature flags
 *   - A bootstrap super_admin user (dev only)
 *
 * Run: `bun run db:seed`
 * =============================================================================
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  PERMISSION_CATALOGUE,
  ROLE_CATALOGUE,
} from "@/modules/iam/infrastructure/rbac";
import { DEFAULT_FLAGS } from "@/modules/feature-flags";

const prisma = new PrismaClient();

async function seedPermissions() {
  for (const p of PERMISSION_CATALOGUE) {
    await prisma.permission.upsert({
      where: { key: `${p.resource}:${p.action}` },
      create: {
        key: `${p.resource}:${p.action}`,
        name: p.name,
        description: p.description,
        resource: p.resource,
        action: p.action,
      },
      update: { name: p.name, description: p.description },
    });
  }
  // Wildcard permission for super_admin
  await prisma.permission.upsert({
    where: { key: "*" },
    create: {
      key: "*",
      name: "Wildcard",
      description: "Grants all permissions",
      resource: "*",
      action: "*",
    },
    update: {},
  });
}

async function seedRoles() {
  for (const r of ROLE_CATALOGUE) {
    const role = await prisma.role.upsert({
      where: { key: r.key },
      create: {
        key: r.key,
        name: r.name,
        description: r.description,
        isSystem: true,
      },
      update: { name: r.name, description: r.description },
    });
    // Map permissions
    if (r.permissions.includes("*")) {
      const wildcard = await prisma.permission.findUnique({ where: { key: "*" } });
      if (wildcard) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: { roleId: role.id, permissionId: wildcard.id },
          },
          create: { roleId: role.id, permissionId: wildcard.id },
          update: {},
        });
      }
    } else {
      for (const permKey of r.permissions) {
        const perm = await prisma.permission.findUnique({ where: { key: permKey } });
        if (perm) {
          await prisma.rolePermission.upsert({
            where: {
              roleId_permissionId: { roleId: role.id, permissionId: perm.id },
            },
            create: { roleId: role.id, permissionId: perm.id },
            update: {},
          });
        }
      }
    }
  }
}

async function seedFeatureFlags() {
  for (const f of DEFAULT_FLAGS) {
    await prisma.featureFlag.upsert({
      where: { key: f.key },
      create: {
        key: f.key,
        name: f.name,
        description: f.description,
        strategy: f.strategy,
        enabled: f.enabled,
      },
      update: {
        name: f.name,
        description: f.description,
        strategy: f.strategy,
      },
    });
  }
}

async function seedBootstrapUser() {
  // Development-only bootstrap admin. Password: "SentinelAdmin2024!"
  const passwordHash = await bcrypt.hash("SentinelAdmin2024!", 12);

  const user = await prisma.user.upsert({
    where: { email: "admin@sentinel.africa" },
    create: {
      email: "admin@sentinel.africa",
      name: "Sentinel Bootstrap Admin",
      passwordHash,
      status: "active",
    },
    update: {},
  });

  const adminRole = await prisma.role.findUnique({ where: { key: "super_admin" } });
  if (adminRole) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: adminRole.id } },
      create: { userId: user.id, roleId: adminRole.id },
      update: {},
    });
  }

   
  console.log("[seed] Bootstrap admin: admin@sentinel.africa / SentinelAdmin2024!");
}

async function main() {
   
  console.log("[seed] Seeding permissions...");
  await seedPermissions();
   
  console.log("[seed] Seeding roles...");
  await seedRoles();
   
  console.log("[seed] Seeding feature flags...");
  await seedFeatureFlags();
   
  console.log("[seed] Seeding bootstrap user...");
  await seedBootstrapUser();

  console.log("[seed] Seeding M2 identity & trust data...");
  await seedIdentityData();
   
  console.log("[seed] Done.");
}

// ---------------------------------------------------------------------------
// M2 — Identity & Trust seed data
// ---------------------------------------------------------------------------

const SAMPLE_ORGS = [
  {
    key: "epa-ghana",
    name: "Environmental Protection Agency — Ghana",
    type: "government_agency",
    country: "GH",
    region: "Greater Accra",
    description: "National environmental regulator coordinating anti-galamsey enforcement.",
    status: "active",
  },
  {
    key: "minerals-commission-gh",
    name: "Minerals Commission — Ghana",
    type: "regulator",
    country: "GH",
    region: "Greater Accra",
    description: "Regulates mineral rights and licenses; investigates illegal mining.",
    status: "active",
  },
  {
    key: "wacam-ghana",
    name: "WACAM — Concerned Farmers",
    type: "ngo",
    country: "GH",
    region: "Western",
    description: "Community advocacy NGO for farmers affected by mining pollution.",
    status: "active",
  },
  {
    key: "kwame-nkrumah-geoscience",
    name: "KNUST Geoscience Research Group",
    type: "researcher",
    country: "GH",
    region: "Ashanti",
    description: "Academic research on remote sensing for environmental monitoring.",
    status: "active",
  },
  {
    key: "forestry-commission-gh",
    name: "Forestry Commission — Ghana",
    type: "government_agency",
    country: "GH",
    region: "Greater Accra",
    description: "Protects forest reserves from illegal mining incursions.",
    status: "pending_verification",
  },
  {
    key: "akuapem-community-watch",
    name: "Akuapem Community Watch",
    type: "community",
    country: "GH",
    region: "Eastern",
    description: "Grassroots community intelligence network for environmental crimes.",
    status: "pending_verification",
  },
];

async function seedIdentityData() {
  const admin = await prisma.user.findUnique({
    where: { email: "admin@sentinel.africa" },
  });
  if (!admin) return;

  // Create sample organizations
  const orgIds: string[] = [];
  for (const org of SAMPLE_ORGS) {
    const created = await prisma.organization.upsert({
      where: { key: org.key },
      create: {
        key: org.key,
        name: org.name,
        type: org.type,
        country: org.country,
        region: org.region,
        description: org.description,
        status: org.status,
        verifiedAt: org.status === "active" ? new Date() : null,
        verifiedById: org.status === "active" ? admin.id : null,
      },
      update: {},
    });
    orgIds.push(created.id);
  }

  // Admin joins the EPA as owner (already verified active)
  const epa = await prisma.organization.findUnique({ where: { key: "epa-ghana" } });
  if (epa) {
    await prisma.organizationMember.upsert({
      where: {
        organizationId_userId: { organizationId: epa.id, userId: admin.id },
      },
      create: {
        organizationId: epa.id,
        userId: admin.id,
        role: "owner",
        status: "active",
      },
      update: {},
    });
  }

  // Seed additional demo users + trust profiles
  const demoUsers = [
    { email: "inspector.kofi@epa-ghana.gov", name: "Kofi Mensah", role: "inspector", orgKey: "epa-ghana", orgRole: "inspector" },
    { email: "moderator.ama@sentinel.africa", name: "Ama Boateng", role: "moderator", orgKey: null, orgRole: null },
    { email: "researcher.yaw@knust.edu.gh", name: "Yaw Owusu", role: "analyst", orgKey: "kwame-nkrumah-geoscience", orgRole: "member" },
    { email: "agent.akua@wacam-ghana.org", name: "Akua Adjei", role: "field_agent", orgKey: "wacam-ghana", orgRole: "member" },
    { email: "reporter.kwame@community.org", name: "Kwame Tetteh", role: "citizen_reporter", orgKey: "akuapem-community-watch", orgRole: "member" },
  ];

  for (const du of demoUsers) {
    const user = await prisma.user.upsert({
      where: { email: du.email },
      create: {
        email: du.email,
        name: du.name,
        passwordHash: await bcrypt.hash("SentinelUser2024!", 12),
        status: "active",
      },
      update: {},
    });
    // Assign RBAC role
    const role = await prisma.role.findUnique({ where: { key: du.role } });
    if (role) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        create: { userId: user.id, roleId: role.id },
        update: {},
      });
    }
    // Add to org
    if (du.orgKey) {
      const org = await prisma.organization.findUnique({ where: { key: du.orgKey } });
      if (org) {
        await prisma.organizationMember.upsert({
          where: {
            organizationId_userId: { organizationId: org.id, userId: user.id },
          },
          create: {
            organizationId: org.id,
            userId: user.id,
            role: du.orgRole ?? "member",
            status: "active",
            invitedBy: admin.id,
          },
          update: {},
        });
      }
    }
    // Seed a device for each demo user
    const fingerprint = `fp_${du.email.replace(/[^a-z0-9]/g, "_").slice(0, 24)}`;
    await prisma.device.upsert({
      where: { fingerprint },
      create: {
        userId: user.id,
        fingerprint,
        label: `${du.name.split(" ")[0]}'s Device`,
        platform: du.role === "field_agent" ? "android" : "web",
        userAgent: "Mozilla/5.0 (Sentinel Client)",
        status: Math.random() > 0.4 ? "trusted" : "active",
        lastSeenAt: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)),
        lastSeenIp: `102.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      },
      update: {},
    });
    // Seed verifications for some users
    const verifTypes = ["government_id", "phone_otp", "email"];
    for (const vtype of verifTypes) {
      if (Math.random() > 0.55) {
        await prisma.identityVerification.create({
          data: {
            userId: user.id,
            type: vtype,
            status: "approved",
            submittedData: JSON.stringify({ country: "GH" }),
            reviewedById: admin.id,
            reviewedAt: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)),
            submittedAt: new Date(Date.now() - Math.floor(Math.random() * 60 * 24 * 60 * 60 * 1000)),
          },
        });
      }
    }
    // Seed trust profile (compute simply from approved verifications)
    const approvedCount = await prisma.identityVerification.count({
      where: { userId: user.id, status: "approved" },
    });
    const orgCount = du.orgKey ? 1 : 0;
    const score = Math.min(
      100,
      approvedCount * 15 + orgCount * 10 + Math.floor(Math.random() * 20),
    );
    const tier = score >= 80 ? "elite" : score >= 60 ? "trusted" : score >= 40 ? "verified" : score >= 20 ? "basic" : "unverified";
    const badges: string[] = [];
    if (approvedCount >= 1) badges.push("id_verified");
    if (orgCount >= 1) badges.push("org_member");
    if (tier === "elite") badges.push("elite_member");
    await prisma.trustProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        score,
        tier,
        factors: JSON.stringify({ verifications: approvedCount, orgMemberships: orgCount }),
        badges: JSON.stringify(badges),
        lastRecalculatedAt: new Date(),
      },
      update: {},
    });
  }

  // Admin trust profile
  await prisma.trustProfile.upsert({
    where: { userId: admin.id },
    create: {
      userId: admin.id,
      score: 100,
      tier: "elite",
      factors: JSON.stringify({ verifications: 5, orgMemberships: 1, accountAgeDays: 1 }),
      badges: JSON.stringify(["id_verified", "thoroughly_verified", "org_member", "elite_member"]),
      lastRecalculatedAt: new Date(),
    },
    update: {},
  });

  console.log(`[seed] Seeded ${SAMPLE_ORGS.length} organizations, ${demoUsers.length} demo users with devices/verifications/trust.`);

  console.log("[seed] Seeding M3 geospatial data...");
  await seedGeoData();
}

// ---------------------------------------------------------------------------
// M3 — Geospatial seed data (Ghana-focused: galamsey mining sites, water bodies, forest reserves)
// ---------------------------------------------------------------------------

const GEO_LAYERS = [
  { key: "base-osm", name: "OpenStreetMap Base", type: "base", source: "osm", description: "Standard OSM basemap tiles", zIndex: 0, opacity: 1.0, config: JSON.stringify({ tileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", maxZoom: 19, attribution: "© OpenStreetMap" }) },
  { key: "satellite", name: "Satellite Imagery", type: "base", source: "sentinel", description: "Sentinel-2 satellite imagery", zIndex: 0, opacity: 1.0, config: JSON.stringify({ tileUrl: "", maxZoom: 18 }) },
  { key: "mining-sites", name: "Mining Sites", type: "data", source: "internal", description: "Known and suspected illegal mining (galamsey) sites", zIndex: 10, opacity: 0.9 },
  { key: "water-bodies", name: "Water Bodies", type: "data", source: "internal", description: "Rivers, lakes, and water bodies at risk from mining pollution", zIndex: 9, opacity: 0.8 },
  { key: "forest-reserves", name: "Forest Reserves", type: "data", source: "internal", description: "Protected forest reserves under threat from illegal mining", zIndex: 8, opacity: 0.7 },
  { key: "settlements", name: "Settlements", type: "data", source: "internal", description: "Nearby communities affected by mining", zIndex: 7, opacity: 0.8 },
  { key: "hot-zones", name: "Hot Zones", type: "overlay", source: "internal", description: "Active mining hot zones (cluster analysis)", zIndex: 15, opacity: 0.5 },
];

// Ghana coordinates: lng ~ -3.2 to 1.2, lat ~ 4.7 to 11.1
const SAMPLE_POIS = [
  // Mining sites (galamsey) — Pra River basin, Ashanti region
  { name: "Prestea Galamsey Site A", type: "mining_site", lat: 5.4321, lng: -2.1456, status: "active", severity: "critical", country: "GH", region: "Western" },
  { name: "Dunkwa Mining Complex", type: "mining_site", lat: 5.9783, lng: -1.7822, status: "monitored", severity: "high", country: "GH", region: "Central" },
  { name: "Obuasi Illegal Pit", type: "mining_site", lat: 6.2062, lng: -1.6678, status: "active", severity: "critical", country: "GH", region: "Ashanti" },
  { name: "Bibiani North Site", type: "mining_site", lat: 6.4639, lng: -2.3322, status: "monitored", severity: "high", country: "GH", region: "Western North" },
  { name: "Tarkwa Nsuaem Cluster", type: "mining_site", lat: 5.3056, lng: -1.9933, status: "active", severity: "critical", country: "GH", region: "Western" },
  { name: "Ayanfuri Alluvial", type: "mining_site", lat: 6.2345, lng: -1.8901, status: "verified", severity: "medium", country: "GH", region: "Central" },
  { name: "Konongo Pit", type: "mining_site", lat: 6.6217, lng: -1.0756, status: "active", severity: "high", country: "GH", region: "Ashanti" },
  { name: "Kibi Galamsey", type: "mining_site", lat: 6.1667, lng: -0.5500, status: "monitored", severity: "high", country: "GH", region: "Eastern" },
  { name: "Asankrangwa Site", type: "mining_site", lat: 5.8333, lng: -2.0833, status: "active", severity: "medium", country: "GH", region: "Western" },
  { name: "Bonte River Mining", type: "mining_site", lat: 5.5500, lng: -1.8500, status: "closed", severity: "low", country: "GH", region: "Central" },
  // Water bodies
  { name: "Pra River Confluence", type: "water_body", lat: 5.2767, lng: -1.8767, status: "active", country: "GH", region: "Central" },
  { name: "Ankobra River Mouth", type: "water_body", lat: 4.8667, lng: -2.3500, status: "active", country: "GH", region: "Western" },
  { name: "Offin River Bend", type: "water_body", lat: 6.3500, lng: -1.8500, status: "active", country: "GH", region: "Ashanti" },
  { name: "Birim River Crossing", type: "water_body", lat: 6.0500, lng: -0.8500, status: "active", country: "GH", region: "Eastern" },
  { name: "Volta Lake North", type: "water_body", lat: 7.8000, lng: -0.4500, status: "active", country: "GH", region: "Volta" },
  { name: "Tano River Upper", type: "water_body", lat: 7.2000, lng: -2.6000, status: "active", country: "GH", region: "Bono" },
  // Settlements
  { name: "Prestea Town", type: "settlement", lat: 5.4300, lng: -2.1400, status: "active", country: "GH", region: "Western" },
  { name: "Obuasi Municipality", type: "settlement", lat: 6.2000, lng: -1.6700, status: "active", country: "GH", region: "Ashanti" },
  { name: "Dunkwa-on-Offin", type: "settlement", lat: 5.9700, lng: -1.7800, status: "active", country: "GH", region: "Central" },
  { name: "Kibi Township", type: "settlement", lat: 6.1700, lng: -0.5500, status: "active", country: "GH", region: "Eastern" },
  { name: "Tarkwa Town", type: "settlement", lat: 5.3000, lng: -1.9900, status: "active", country: "GH", region: "Western" },
  // Sensor stations
  { name: "Pra River Sensor S1", type: "sensor_station", lat: 5.2800, lng: -1.8700, status: "active", country: "GH", region: "Central" },
  { name: "Ankobra Sensor S2", type: "sensor_station", lat: 4.8700, lng: -2.3500, status: "active", country: "GH", region: "Western" },
  { name: "Obuasi Air Quality S3", type: "sensor_station", lat: 6.2100, lng: -1.6700, status: "active", country: "GH", region: "Ashanti" },
  // Checkpoints
  { name: "Prestea Checkpoint C1", type: "checkpoint", lat: 5.4350, lng: -2.1430, status: "active", country: "GH", region: "Western" },
  { name: "Obuasi Checkpoint C2", type: "checkpoint", lat: 6.2090, lng: -1.6680, status: "active", country: "GH", region: "Ashanti" },
  // Incidents
  { name: "Cyanide Spill Report", type: "incident", lat: 5.4310, lng: -2.1440, status: "verified", severity: "critical", country: "GH", region: "Western" },
  { name: "River Diversion Report", type: "incident", lat: 6.2050, lng: -1.6680, status: "active", severity: "high", country: "GH", region: "Ashanti" },
  { name: "Forest Clearing Report", type: "incident", lat: 6.4650, lng: -2.3300, status: "active", severity: "high", country: "GH", region: "Western North" },
];

const SAMPLE_REGIONS = [
  {
    name: "Prestea Mining Concession",
    type: "mining_concession",
    coordinates: [[-2.1500, 5.4200], [-2.1300, 5.4200], [-2.1300, 5.4400], [-2.1500, 5.4400], [-2.1500, 5.4200]] as [number, number][],
    country: "GH",
    region: "Western",
  },
  {
    name: "Obuasi Mining Belt",
    type: "mining_concession",
    coordinates: [[-1.6900, 6.1900], [-1.6400, 6.1900], [-1.6400, 6.2200], [-1.6900, 6.2200], [-1.6900, 6.1900]] as [number, number][],
    country: "GH",
    region: "Ashanti",
  },
  {
    name: "Upper Pra River Basin",
    type: "water_body",
    coordinates: [[-2.2000, 5.8000], [-1.7000, 5.8000], [-1.7000, 6.2000], [-2.2000, 6.2000], [-2.2000, 5.8000]] as [number, number][],
    country: "GH",
    region: "Central",
  },
  {
    name: "Atewa Forest Reserve",
    type: "forest_reserve",
    coordinates: [[-0.6000, 6.1000], [-0.5000, 6.1000], [-0.5000, 6.2500], [-0.6000, 6.2500], [-0.6000, 6.1000]] as [number, number][],
    country: "GH",
    region: "Eastern",
  },
  {
    name: "Tarkwa-Prestea Hot Zone",
    type: "hot_zone",
    coordinates: [[-2.2000, 5.2000], [-1.9000, 5.2000], [-1.9000, 5.6000], [-2.2000, 5.6000], [-2.2000, 5.2000]] as [number, number][],
    country: "GH",
    region: "Western",
  },
  {
    name: "Birim River Protected Area",
    type: "protected_area",
    coordinates: [[-0.9000, 5.9000], [-0.7000, 5.9000], [-0.7000, 6.2000], [-0.9000, 6.2000], [-0.9000, 5.9000]] as [number, number][],
    country: "GH",
    region: "Eastern",
  },
];

async function seedGeoData() {
  // Create layers
  const layerMap: Record<string, string> = {};
  for (const layer of GEO_LAYERS) {
    const created = await prisma.geoLayer.upsert({
      where: { key: layer.key },
      create: {
        key: layer.key,
        name: layer.name,
        type: layer.type,
        source: layer.source,
        description: layer.description,
        zIndex: layer.zIndex,
        opacity: layer.opacity,
        visible: layer.type === "base" ? true : layer.key === "mining-sites" || layer.key === "water-bodies" || layer.key === "forest-reserves",
        config: layer.config ?? null,
      },
      update: {},
    });
    layerMap[layer.key] = created.id;
  }

  // Create POIs
  let poiCount = 0;
  for (const poi of SAMPLE_POIS) {
    const layerKey = poi.type === "mining_site" ? "mining-sites"
      : poi.type === "water_body" ? "water-bodies"
      : poi.type === "settlement" ? "settlements"
      : poi.type === "incident" ? "mining-sites"
      : "mining-sites";
    const geojson = JSON.stringify({
      type: "Feature",
      geometry: { type: "Point", coordinates: [poi.lng, poi.lat] },
      properties: { name: poi.name, type: poi.type, status: poi.status, severity: poi.severity },
    });
    await prisma.pointOfInterest.create({
      data: {
        name: poi.name,
        type: poi.type,
        lat: poi.lat,
        lng: poi.lng,
        geojson,
        layerId: layerMap[layerKey],
        country: poi.country,
        region: poi.region,
        status: poi.status,
        severity: poi.severity,
      },
    }).catch(() => {}); // skip duplicates on re-seed
    poiCount++;
  }

  // Create regions
  let regionCount = 0;
  for (const region of SAMPLE_REGIONS) {
    const layerKey = region.type === "forest_reserve" ? "forest-reserves"
      : region.type === "water_body" ? "water-bodies"
      : region.type === "hot_zone" ? "hot-zones"
      : "mining-sites";
    const geojson = JSON.stringify({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [region.coordinates] },
      properties: { name: region.name, type: region.type },
    });
    const minLng = Math.min(...region.coordinates.map((c) => c[0]));
    const maxLng = Math.max(...region.coordinates.map((c) => c[0]));
    const minLat = Math.min(...region.coordinates.map((c) => c[1]));
    const maxLat = Math.max(...region.coordinates.map((c) => c[1]));
    await prisma.spatialRegion.create({
      data: {
        name: region.name,
        type: region.type,
        geojson,
        bbox: JSON.stringify({ minLng, minLat, maxLng, maxLat }),
        areaKm2: (maxLng - minLng) * 111 * (maxLat - minLat) * 111,
        layerId: layerMap[layerKey],
        country: region.country,
        region: region.region,
        status: "active",
      },
    }).catch(() => {});
    regionCount++;
  }

  console.log(`[seed] Seeded ${GEO_LAYERS.length} layers, ${poiCount} POIs, ${regionCount} spatial regions.`);

  console.log("[seed] Seeding M4 digital twin data...");
  await seedTwinData();
}

// ---------------------------------------------------------------------------
// M4 — Digital Twin seed data
// ---------------------------------------------------------------------------

const TWIN_ENTITIES = [
  // Rivers
  { key: "river-pra-main", type: "river", name: "Pra River (Main)", description: "Major river in Ghana's mining belt, heavily impacted by galamsey.", lat: 5.2767, lng: -1.8767, status: "degraded", country: "GH", region: "Central", metadata: { flow_rate: "120 m³/s", water_quality: "poor", length_km: 240, pollution_level: "high", tributary_of: "Gulf of Guinea" } },
  { key: "river-ankobra", type: "river", name: "Ankobra River", description: "River draining the Tarkwa-Prestea mining area.", lat: 4.8667, lng: -2.3500, status: "degraded", country: "GH", region: "Western", metadata: { flow_rate: "85 m³/s", water_quality: "poor", length_km: 190, pollution_level: "critical" } },
  { key: "river-offin", type: "river", name: "Offin River", description: "Tributary affected by alluvial mining near Dunkwa.", lat: 6.3500, lng: -1.8500, status: "monitored", country: "GH", region: "Ashanti", metadata: { flow_rate: "60 m³/s", water_quality: "moderate", length_km: 170, pollution_level: "moderate" } },
  { key: "river-birim", type: "river", name: "Birim River", description: "River in the Eastern Region diamond/gold belt.", lat: 6.0500, lng: -0.8500, status: "monitored", country: "GH", region: "Eastern", metadata: { flow_rate: "45 m³/s", water_quality: "moderate", length_km: 145, pollution_level: "moderate" } },
  // Roads
  { key: "road-tarkwa-prestea", type: "road", name: "Tarkwa–Prestea Road", description: "Main access road to the Tarkwa-Prestea mining belt.", lat: 5.3678, lng: -2.0678, status: "degraded", country: "GH", region: "Western", metadata: { surface: "gravel", condition: "poor", length_km: 48, connects: "Tarkwa, Prestea" } },
  { key: "road-obuasi-konongo", type: "road", name: "Obuasi–Konongo Highway", description: "Highway through the Ashanti mining corridor.", lat: 6.4100, lng: -1.3700, status: "active", country: "GH", region: "Ashanti", metadata: { surface: "paved", condition: "fair", length_km: 65, connects: "Obuasi, Konongo" } },
  // Mines
  { key: "mine-prestea-galamsey", type: "mine", name: "Prestea Galamsey Complex", description: "Cluster of illegal mining operations along the Pra River.", lat: 5.4321, lng: -2.1456, status: "active", country: "GH", region: "Western", metadata: { operator: "illegal", mineral: "gold", production_tons: 12, area_hectares: 340, permits: "none" } },
  { key: "mine-obuasi-illegal", type: "mine", name: "Obuasi Illegal Pit", description: "Illegal open-pit mining within the Obuasi concession.", lat: 6.2062, lng: -1.6678, status: "active", country: "GH", region: "Ashanti", metadata: { operator: "illegal", mineral: "gold", production_tons: 8, area_hectares: 180, permits: "none" } },
  { key: "mine-dunkwa-alluvial", type: "mine", name: "Dunkwa Alluvial Site", description: "Alluvial gold mining along the Offin River.", lat: 5.9783, lng: -1.7822, status: "monitored", country: "GH", region: "Central", metadata: { operator: "mixed", mineral: "gold", production_tons: 5, area_hectares: 120, permits: "expired" } },
  // Forests
  { key: "forest-atewa", type: "forest", name: "Atewa Forest Reserve", description: "Biodiverse upland forest reserve threatened by bauxite mining.", lat: 6.1667, lng: -0.5500, status: "threatened", country: "GH", region: "Eastern", metadata: { area_hectares: 23266, canopy_density: 0.82, species_count: 765, protection_status: "Hill Sanctuary" } },
  { key: "forest-tano-offin", type: "forest", name: "Tano Offin Forest Reserve", description: "Forest reserve in the Western North mining area.", lat: 6.4639, lng: -2.3322, status: "degraded", country: "GH", region: "Western North", metadata: { area_hectares: 12450, canopy_density: 0.65, species_count: 412, protection_status: "Reserve" } },
  // Communities
  { key: "community-prestea", type: "community", name: "Prestea Community", description: "Mining town of ~35,000 affected by mercury contamination.", lat: 5.4300, lng: -2.1400, status: "active", country: "GH", region: "Western", metadata: { population: 35000, households: 7800, water_source: "Pra River", health_risk: "high", nearest_facility_km: 2 } },
  { key: "community-obuasi", type: "community", name: "Obuasi Municipality", description: "Mining municipality of ~175,000 with legacy environmental damage.", lat: 6.2000, lng: -1.6700, status: "active", country: "GH", region: "Ashanti", metadata: { population: 175000, households: 38000, water_source: "Borehole", health_risk: "medium", nearest_facility_km: 1 } },
  { key: "community-dunkwa", type: "community", name: "Dunkwa-on-Offin", description: "Riverside community dependent on the Offin River.", lat: 5.9700, lng: -1.7800, status: "active", country: "GH", region: "Central", metadata: { population: 21000, households: 4600, water_source: "Offin River", health_risk: "high", nearest_facility_km: 3 } },
  // Concessions
  { key: "concession-obuasi-anglogold", type: "concession", name: "Obuasi Concession (AngloGold)", description: "Large-scale legal mining concession.", lat: 6.2062, lng: -1.6678, status: "active", country: "GH", region: "Ashanti", metadata: { permit_number: "GMC-OB-001", holder: "AngloGold Ashanti", area_hectares: 4749, mineral: "gold", expiry_date: "2035-06-30", status: "active" } },
  { key: "concession-tarkwa-goldfields", type: "concession", name: "Tarkwa Concession (Gold Fields)", description: "Open-pit gold mining concession.", lat: 5.3056, lng: -1.9933, status: "active", country: "GH", region: "Western", metadata: { permit_number: "GMC-TW-003", holder: "Gold Fields Ghana", area_hectares: 2180, mineral: "gold", expiry_date: "2032-12-31", status: "active" } },
  // Protected areas
  { key: "protected-atewa-sanctuary", type: "protected_area", name: "Atewa Range Forest Reserve", description: "Protected upland forest designated as a Globally Significant Biodiversity Area.", lat: 6.1667, lng: -0.5500, status: "active", country: "GH", region: "Eastern", metadata: { protection_level: "Forest Reserve", gazette_date: "1926-01-01", managing_authority: "Forestry Commission", area_hectares: 23266 } },
  { key: "protected-pra-basin", type: "protected_area", name: "Pra River Basin Protection Zone", description: "Water protection zone along the Pra River.", lat: 5.2767, lng: -1.8767, status: "active", country: "GH", region: "Central", metadata: { protection_level: "Water Protection", gazette_date: "2015-03-15", managing_authority: "Water Resources Commission", area_hectares: 8500 } },
  // Equipment
  { key: "sensor-pra-s1", type: "equipment", name: "Pra River Sensor S1", description: "Water quality monitoring sensor on the Pra River.", lat: 5.2800, lng: -1.8700, status: "active", country: "GH", region: "Central", metadata: { model: "AquaScan Pro", serial: "AS-2024-001", status: "online", last_calibration: "2024-07-15", battery_level: 87, firmware: "v2.3.1" } },
  { key: "drone-obuasi-d1", type: "equipment", name: "Obuasi Survey Drone D1", description: "Aerial survey drone for mining site monitoring.", lat: 6.2100, lng: -1.6700, status: "active", country: "GH", region: "Ashanti", metadata: { model: "DJI Mavic 3M", serial: "DR-2024-014", status: "standby", last_calibration: "2024-07-20", battery_level: 92, firmware: "v4.1.0" } },
  // Historical imagery
  { key: "imagery-prestea-2020", type: "historical_imagery", name: "Prestea Imagery (Jan 2020)", description: "Pre-galamsey-expansion baseline satellite imagery.", lat: 5.4321, lng: -2.1456, status: "historical", country: "GH", region: "Western", metadata: { capture_date: "2020-01-15", satellite: "Sentinel-2", resolution_m: 10, cloud_cover: 12, scene_id: "S2A_20200115_PRESTEA", storage_key: "imagery/prestea-2020-01-15.tif" } },
  { key: "imagery-prestea-2024", type: "historical_imagery", name: "Prestea Imagery (Jul 2024)", description: "Current satellite imagery showing galamsey expansion.", lat: 5.4321, lng: -2.1456, status: "active", country: "GH", region: "Western", metadata: { capture_date: "2024-07-10", satellite: "Sentinel-2", resolution_m: 10, cloud_cover: 8, scene_id: "S2B_20240710_PRESTEA", storage_key: "imagery/prestea-2024-07-10.tif" } },
  { key: "imagery-atewa-2022", type: "historical_imagery", name: "Atewa Forest Imagery (2022)", description: "Baseline imagery of Atewa forest canopy.", lat: 6.1667, lng: -0.5500, status: "historical", country: "GH", region: "Eastern", metadata: { capture_date: "2022-03-20", satellite: "Landsat-8", resolution_m: 30, cloud_cover: 15, scene_id: "LC8_20220320_ATEWA", storage_key: "imagery/atewa-2022-03-20.tif" } },
  // Events
  { key: "event-cyanide-spill-2024", type: "event", name: "Pra River Cyanide Spill", description: "Reported cyanide contamination from illegal mining.", lat: 5.4310, lng: -2.1440, status: "active", country: "GH", region: "Western", metadata: { severity: "critical", impact_area_hectares: 45, casualties: 0, response_status: "investigating", verified: true } },
  { key: "event-forest-clearing-2024", type: "event", name: "Tano Offin Forest Clearing", description: "Detected forest clearing for illegal mining.", lat: 6.4650, lng: -2.3300, status: "active", country: "GH", region: "Western North", metadata: { severity: "high", impact_area_hectares: 28, casualties: 0, response_status: "pending", verified: true } },
  // Inspections
  { key: "inspection-prestea-2024-06", type: "inspection", name: "Prestea Site Inspection (Jun 2024)", description: "Field inspection of the Prestea galamsey complex.", lat: 5.4321, lng: -2.1456, status: "active", country: "GH", region: "Western", metadata: { inspector: "Kofi Mensah", findings: "Active illegal mining, mercury use detected", evidence_refs: ["IMG-001", "IMG-002"], outcome: "violation_confirmed", follow_up_required: true } },
  { key: "inspection-obuasi-2024-05", type: "inspection", name: "Obuasi Pit Inspection (May 2024)", description: "Inspection of the illegal pit within AngloGold concession.", lat: 6.2062, lng: -1.6678, status: "active", country: "GH", region: "Ashanti", metadata: { inspector: "Kofi Mensah", findings: "Trespass mining, environmental damage", evidence_refs: ["IMG-010"], outcome: "violation_confirmed", follow_up_required: true } },
];

const TWIN_RELATIONSHIPS = [
  // River relationships (upstream/downstream)
  { from: "river-offin", to: "river-pra-main", type: "downstream", metadata: { distance_m: 0, flow: "Offin → Pra" } },
  { from: "river-pra-main", to: "river-offin", type: "upstream", metadata: { distance_m: 0 } },
  // Mine affects river
  { from: "mine-prestea-galamsey", to: "river-pra-main", type: "affects", strength: 0.95, metadata: { impact: "mercury_contamination", distance_m: 800 } },
  { from: "mine-obuasi-illegal", to: "river-offin", type: "affects", strength: 0.8, metadata: { impact: "sedimentation", distance_m: 1200 } },
  { from: "mine-dunkwa-alluvial", to: "river-offin", type: "affects", strength: 0.9, metadata: { impact: "channel_diversion", distance_m: 200 } },
  // Mine threatens forest
  { from: "mine-prestea-galamsey", to: "forest-tano-offin", type: "threatens", strength: 0.7, metadata: { threat: "encroachment" } },
  // Concession contains mine
  { from: "concession-obuasi-anglogold", to: "mine-obuasi-illegal", type: "contains", metadata: { note: "illegal within legal concession" } },
  { from: "concession-tarkwa-goldfields", to: "mine-prestea-galamsey", type: "near", strength: 0.6, metadata: { distance_m: 3500 } },
  // Protected area contains forest
  { from: "protected-atewa-sanctuary", to: "forest-atewa", type: "contains", metadata: {} },
  { from: "protected-pra-basin", to: "river-pra-main", type: "contains", metadata: {} },
  // Community depends on / near river
  { from: "community-prestea", to: "river-pra-main", type: "depends_on", strength: 0.9, metadata: { dependency: "water_supply" } },
  { from: "community-dunkwa", to: "river-offin", type: "depends_on", strength: 0.85, metadata: { dependency: "water_supply" } },
  { from: "community-prestea", to: "mine-prestea-galamsey", type: "near", strength: 0.8, metadata: { distance_m: 500 } },
  { from: "community-obuasi", to: "mine-obuasi-illegal", type: "near", strength: 0.7, metadata: { distance_m: 800 } },
  // Road connects communities
  { from: "road-tarkwa-prestea", to: "community-prestea", type: "connects_to", bidirectional: true, metadata: {} },
  { from: "road-obuasi-konongo", to: "community-obuasi", type: "connects_to", bidirectional: true, metadata: {} },
  // Equipment monitors entities
  { from: "sensor-pra-s1", to: "river-pra-main", type: "monitors", metadata: { parameter: "water_quality" } },
  { from: "drone-obuasi-d1", to: "mine-obuasi-illegal", type: "monitors", metadata: { parameter: "extent_mapping" } },
  // Imagery monitors sites
  { from: "imagery-prestea-2020", to: "mine-prestea-galamsey", type: "monitors", metadata: { baseline: true } },
  { from: "imagery-prestea-2024", to: "mine-prestea-galamsey", type: "monitors", metadata: { current: true } },
  { from: "imagery-atewa-2022", to: "forest-atewa", type: "monitors", metadata: { baseline: true } },
  // Inspection monitors mine
  { from: "inspection-prestea-2024-06", to: "mine-prestea-galamsey", type: "monitors", metadata: {} },
  { from: "inspection-obuasi-2024-05", to: "mine-obuasi-illegal", type: "monitors", metadata: {} },
  // Event affects entities
  { from: "event-cyanide-spill-2024", to: "river-pra-main", type: "affects", strength: 1.0, metadata: { severity: "critical" } },
  { from: "event-cyanide-spill-2024", to: "community-prestea", type: "threatens", strength: 0.9, metadata: {} },
  { from: "event-forest-clearing-2024", to: "forest-tano-offin", type: "affects", strength: 0.9, metadata: {} },
];

async function seedTwinData() {
  // Create entities
  const entityKeyToId: Record<string, string> = {};
  for (const ent of TWIN_ENTITIES) {
    const created = await prisma.twinEntity.upsert({
      where: { key: ent.key },
      create: {
        key: ent.key,
        type: ent.type,
        name: ent.name,
        description: ent.description,
        lat: ent.lat,
        lng: ent.lng,
        status: ent.status,
        country: ent.country,
        region: ent.region,
        metadata: JSON.stringify(ent.metadata),
        currentVersion: 1,
      },
      update: {},
    });
    entityKeyToId[ent.key] = created.id;

    // Create initial version
    await prisma.twinEntityVersion.create({
      data: {
        entityId: created.id,
        version: 1,
        snapshot: JSON.stringify({ ...ent, version: 1 }),
        changeReason: "Initial creation",
        validFrom: new Date(created.createdAt),
      },
    }).catch(() => {});

    // Create a creation event
    await prisma.twinEvent.create({
      data: {
        entityId: created.id,
        type: "created",
        title: `${ent.name} created`,
        description: `Digital twin entity created for ${ent.type}`,
        severity: "info",
        source: "seed",
        sourceType: "system",
        payload: JSON.stringify({ type: ent.type, key: ent.key }),
      },
    }).catch(() => {});
  }

  // Add a couple of version updates to show versioning
  const presteaMine = entityKeyToId["mine-prestea-galamsey"];
  if (presteaMine) {
    await prisma.twinEntity.update({
      where: { id: presteaMine },
      data: { currentVersion: 2, status: "active", metadata: JSON.stringify({ ...TWIN_ENTITIES[6]!.metadata, production_tons: 14, area_hectares: 360 }) },
    });
    await prisma.twinEntityVersion.create({
      data: {
        entityId: presteaMine,
        version: 2,
        snapshot: JSON.stringify({ ...TWIN_ENTITIES[6], status: "active", metadata: { ...TWIN_ENTITIES[6]!.metadata, production_tons: 14, area_hectares: 360 }, version: 2 }),
        changeReason: "Expansion detected via satellite imagery",
        diff: JSON.stringify({ production_tons: { from: 12, to: 14 }, area_hectares: { from: 340, to: 360 } }),
        validFrom: new Date(),
      },
    });
    await prisma.twinEvent.create({
      data: {
        entityId: presteaMine,
        type: "updated",
        title: "Mine expansion detected",
        description: "Satellite imagery analysis detected 20-hectare expansion",
        severity: "high",
        source: "satellite",
        sourceType: "satellite",
        payload: JSON.stringify({ fromVersion: 1, toVersion: 2, diff: { production_tons: { from: 12, to: 14 }, area_hectares: { from: 340, to: 360 } } }),
      },
    });
  }

  // Create relationships
  let relCount = 0;
  for (const rel of TWIN_RELATIONSHIPS) {
    const fromId = entityKeyToId[rel.from];
    const toId = entityKeyToId[rel.to];
    if (!fromId || !toId) continue;
    await prisma.twinRelationship.create({
      data: {
        fromEntityId: fromId,
        toEntityId: toId,
        type: rel.type,
        strength: rel.strength ?? 1.0,
        metadata: rel.metadata ? JSON.stringify(rel.metadata) : null,
        bidirectional: rel.bidirectional ?? false,
      },
    }).catch(() => {});
    relCount++;
  }

  console.log(`[seed] Seeded ${TWIN_ENTITIES.length} twin entities, ${relCount} relationships.`);
}

main()
  .catch((e) => {
     
    console.error("[seed] Failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
