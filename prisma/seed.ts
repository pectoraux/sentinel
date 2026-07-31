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
}

main()
  .catch((e) => {
     
    console.error("[seed] Failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
