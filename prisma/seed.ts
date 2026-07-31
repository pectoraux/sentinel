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

  // M3–M20 seed functions (seedGeoData through seedSatelliteData) are defined
  // below but not called from main() by default — they were run individually
  // during their respective milestone implementations. To re-seed from scratch
  // (e.g. after `prisma db push --force-reset`), uncomment the calls below.
  // Each function is idempotent or uses .catch(() => {}) for duplicate skips.
  //
  // await seedGeoData().catch(() => {});
  // await seedTwinData().catch(() => {});
  // await seedEvidenceData().catch(() => {});
  // await seedCorroborationData().catch(() => {});
  // await seedIntelligenceData().catch(() => {});
  // await seedTrustData().catch(() => {});
  // await seedNotificationData().catch(() => {});
  // await seedSatelliteData().catch(() => {});

  console.log("[seed] Seeding M21 fraud detection data...");
  await seedFraudData().catch((e) => console.log("[seed] M21 skipped:", e instanceof Error ? e.message : String(e)));

  console.log("[seed] Seeding M22 government operations center data...");
  await seedGovernmentData().catch((e) => console.log("[seed] M22 skipped:", e instanceof Error ? e.message : String(e)));

  console.log("[seed] Seeding M23 simulation engine data...");
  await seedSimulationData().catch((e) => console.log("[seed] M23 skipped:", e instanceof Error ? e.message : String(e)));

  console.log("[seed] Seeding M25 developer platform data...");
  await seedDeveloperData().catch((e) => console.log("[seed] M25 skipped:", e instanceof Error ? e.message : String(e)));

  console.log("[seed] Seeding M26 security hardening data...");
  await seedSecurityData().catch((e) => console.log("[seed] M26 skipped:", e instanceof Error ? e.message : String(e)));
   
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
  await seedGeoData().catch((e) => console.log("[seed] M3 skipped:", e instanceof Error ? e.message : String(e)));
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
  await seedTwinData().catch((e) => console.log("[seed] M4 skipped:", e instanceof Error ? e.message : String(e)));
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
  // M6 — Knowledge Graph template relationships
  // River → Community (supplies)
  { from: "river-pra-main", to: "community-prestea", type: "supplies", strength: 0.9, metadata: { dependency_level: "primary", usage_type: "drinking,agriculture", distance_m: 300 } },
  { from: "river-offin", to: "community-dunkwa", type: "supplies", strength: 0.85, metadata: { dependency_level: "primary", usage_type: "drinking,fishing", distance_m: 200 } },
  // Forest → Protected Area (within) — Forest is part of a watershed
  { from: "forest-atewa", to: "protected-atewa-sanctuary", type: "within", strength: 1.0, metadata: { protection_level: "Forest Reserve" } },
  { from: "forest-tano-offin", to: "protected-pra-basin", type: "within", strength: 0.8, metadata: { protection_level: "Water Protection" } },
  // Satellite Image → Event (detects)
  { from: "imagery-prestea-2024", to: "event-cyanide-spill-2024", type: "monitors", strength: 0.9, metadata: { detection_method: "spectral_analysis", confidence: 0.92 } },
  { from: "imagery-atewa-2022", to: "event-forest-clearing-2024", type: "monitors", strength: 0.8, metadata: { detection_method: "change_detection", confidence: 0.85 } },
  // Additional mine → river
  { from: "mine-dunkwa-alluvial", to: "river-offin", type: "affects", strength: 0.9, metadata: { impact_type: "channel_diversion", distance_m: 200 } },
  { from: "mine-obuasi-illegal", to: "river-offin", type: "affects", strength: 0.8, metadata: { impact_type: "sedimentation", distance_m: 1200 } },
  // Community → River (depends_on) — already have some, add more
  { from: "community-obuasi", to: "river-offin", type: "depends_on", strength: 0.7, metadata: { dependency: "agriculture" } },
  // Protected area → community (protects)
  { from: "protected-pra-basin", to: "community-prestea", type: "near", strength: 0.6, metadata: { distance_m: 5000 } },
];

async function seedTwinData() {
  const now = new Date();
  // Temporal spread: entities created at different times over the past year
  // so temporal queries (yesterday, last month, last year) return different results.
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  // Assign each entity a creation time (spread across ~365 days)
  const creationTimes: Record<string, Date> = {
    "river-pra-main": daysAgo(365),
    "river-ankobra": daysAgo(360),
    "river-offin": daysAgo(350),
    "river-birim": daysAgo(340),
    "road-tarkwa-prestea": daysAgo(300),
    "road-obuasi-konongo": daysAgo(290),
    "mine-prestea-galamsey": daysAgo(280),
    "mine-obuasi-illegal": daysAgo(270),
    "mine-dunkwa-alluvial": daysAgo(250),
    "forest-atewa": daysAgo(365),
    "forest-tano-offin": daysAgo(320),
    "community-prestea": daysAgo(310),
    "community-obuasi": daysAgo(305),
    "community-dunkwa": daysAgo(200),
    "concession-obuasi-anglogold": daysAgo(365),
    "concession-tarkwa-goldfields": daysAgo(360),
    "protected-atewa-sanctuary": daysAgo(365),
    "protected-pra-basin": daysAgo(180),
    "sensor-pra-s1": daysAgo(90),
    "drone-obuasi-d1": daysAgo(60),
    "imagery-prestea-2020": daysAgo(365),
    "imagery-prestea-2024": daysAgo(15),
    "imagery-atewa-2022": daysAgo(280),
    "event-cyanide-spill-2024": daysAgo(7),
    "event-forest-clearing-2024": daysAgo(3),
    "inspection-prestea-2024-06": daysAgo(45),
    "inspection-obuasi-2024-05": daysAgo(60),
  };

  // Create entities
  const entityKeyToId: Record<string, string> = {};
  for (const ent of TWIN_ENTITIES) {
    const createdAt = creationTimes[ent.key] ?? daysAgo(30);
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
        createdAt,
        updatedAt: createdAt,
      },
      update: {},
    });
    entityKeyToId[ent.key] = created.id;

    // Create initial version (validFrom = creation time, validTo = null for now)
    await prisma.twinEntityVersion.create({
      data: {
        entityId: created.id,
        version: 1,
        snapshot: JSON.stringify({ ...ent, version: 1 }),
        changeReason: "Initial creation",
        validFrom: createdAt,
      },
    }).catch(() => {});

    // Create a creation event at the creation time
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
        timestamp: createdAt,
      },
    }).catch(() => {});
  }

  // --- Temporal version updates ---
  // Prestea mine: v1 (280 days ago) → v2 (120 days ago) → v3 (15 days ago)
  const presteaMine = entityKeyToId["mine-prestea-galamsey"];
  if (presteaMine) {
    const ent = TWIN_ENTITIES[6]!;
    const v1Time = creationTimes["mine-prestea-galamsey"]!;
    const v2Time = daysAgo(120);
    const v3Time = daysAgo(15);

    // Close v1, create v2
    await prisma.twinEntityVersion.updateMany({
      where: { entityId: presteaMine, version: 1 },
      data: { validTo: v2Time },
    });
    await prisma.twinEntityVersion.create({
      data: {
        entityId: presteaMine,
        version: 2,
        snapshot: JSON.stringify({ ...ent, status: "active", metadata: { ...ent.metadata, production_tons: 13, area_hectares: 350 }, version: 2 }),
        changeReason: "Moderate expansion detected via satellite imagery",
        diff: JSON.stringify({ production_tons: { from: 12, to: 13 }, area_hectares: { from: 340, to: 350 } }),
        validFrom: v2Time,
      },
    });
    await prisma.twinEvent.create({
      data: {
        entityId: presteaMine,
        type: "updated",
        title: "Mine expansion detected (v2)",
        description: "Satellite imagery analysis detected 10-hectare expansion",
        severity: "high",
        source: "satellite",
        sourceType: "satellite",
        payload: JSON.stringify({ fromVersion: 1, toVersion: 2, diff: { production_tons: { from: 12, to: 13 }, area_hectares: { from: 340, to: 350 } } }),
        timestamp: v2Time,
      },
    });

    // Close v2, create v3
    await prisma.twinEntityVersion.updateMany({
      where: { entityId: presteaMine, version: 2 },
      data: { validTo: v3Time },
    });
    await prisma.twinEntityVersion.create({
      data: {
        entityId: presteaMine,
        version: 3,
        snapshot: JSON.stringify({ ...ent, status: "active", metadata: { ...ent.metadata, production_tons: 14, area_hectares: 360 }, version: 3 }),
        changeReason: "Further expansion detected via recent imagery",
        diff: JSON.stringify({ production_tons: { from: 13, to: 14 }, area_hectares: { from: 350, to: 360 } }),
        validFrom: v3Time,
      },
    });
    await prisma.twinEvent.create({
      data: {
        entityId: presteaMine,
        type: "updated",
        title: "Mine expansion detected (v3)",
        description: "Latest imagery shows additional 10-hectare expansion",
        severity: "critical",
        source: "satellite",
        sourceType: "satellite",
        payload: JSON.stringify({ fromVersion: 2, toVersion: 3, diff: { production_tons: { from: 13, to: 14 }, area_hectares: { from: 350, to: 360 } } }),
        timestamp: v3Time,
      },
    });

    // Update entity to v3
    await prisma.twinEntity.update({
      where: { id: presteaMine },
      data: { currentVersion: 3, status: "active", metadata: JSON.stringify({ ...ent.metadata, production_tons: 14, area_hectares: 360 }), updatedAt: v3Time },
    });
  }

  // Obuasi mine: v1 (270 days ago) → v2 (30 days ago)
  const obuasiMine = entityKeyToId["mine-obuasi-illegal"];
  if (obuasiMine) {
    const ent = TWIN_ENTITIES[7]!;
    const v2Time = daysAgo(30);
    await prisma.twinEntityVersion.updateMany({
      where: { entityId: obuasiMine, version: 1 },
      data: { validTo: v2Time },
    });
    await prisma.twinEntityVersion.create({
      data: {
        entityId: obuasiMine,
        version: 2,
        snapshot: JSON.stringify({ ...ent, status: "active", metadata: { ...ent.metadata, production_tons: 10, area_hectares: 210 }, version: 2 }),
        changeReason: "Pit expansion observed during drone survey",
        diff: JSON.stringify({ production_tons: { from: 8, to: 10 }, area_hectares: { from: 180, to: 210 } }),
        validFrom: v2Time,
      },
    });
    await prisma.twinEvent.create({
      data: {
        entityId: obuasiMine,
        type: "updated",
        title: "Obuasi pit expansion (v2)",
        description: "Drone survey detected 30-hectare pit expansion",
        severity: "high",
        source: "drone",
        sourceType: "sensor",
        payload: JSON.stringify({ fromVersion: 1, toVersion: 2 }),
        timestamp: v2Time,
      },
    });
    await prisma.twinEntity.update({
      where: { id: obuasiMine },
      data: { currentVersion: 2, metadata: JSON.stringify({ ...ent.metadata, production_tons: 10, area_hectares: 210 }), updatedAt: v2Time },
    });
  }

  // Pra River: water quality degradation over time
  const praRiver = entityKeyToId["river-pra-main"];
  if (praRiver) {
    const ent = TWIN_ENTITIES[0]!;
    const v2Time = daysAgo(90);
    await prisma.twinEntityVersion.updateMany({
      where: { entityId: praRiver, version: 1 },
      data: { validTo: v2Time },
    });
    await prisma.twinEntityVersion.create({
      data: {
        entityId: praRiver,
        version: 2,
        snapshot: JSON.stringify({ ...ent, status: "degraded", metadata: { ...ent.metadata, water_quality: "poor", pollution_level: "critical" }, version: 2 }),
        changeReason: "Water quality sensors detected critical pollution levels",
        diff: JSON.stringify({ water_quality: { from: "moderate", to: "poor" }, pollution_level: { from: "high", to: "critical" } }),
        validFrom: v2Time,
      },
    });
    await prisma.twinEvent.create({
      data: {
        entityId: praRiver,
        type: "status_changed",
        title: "Pra River water quality critical",
        description: "Sensor S1 reported mercury levels exceeding safe thresholds",
        severity: "critical",
        source: "sensor-pra-s1",
        sourceType: "sensor",
        payload: JSON.stringify({ parameter: "mercury", threshold: 0.001, measured: 0.004 }),
        timestamp: v2Time,
      },
    });
    await prisma.twinEntity.update({
      where: { id: praRiver },
      data: { currentVersion: 2, status: "degraded", metadata: JSON.stringify({ ...ent.metadata, water_quality: "poor", pollution_level: "critical" }), updatedAt: v2Time },
    });
  }

  // Atewa Forest: canopy density decrease
  const atewaForest = entityKeyToId["forest-atewa"];
  if (atewaForest) {
    const ent = TWIN_ENTITIES[8]!;
    const v2Time = daysAgo(60);
    await prisma.twinEntityVersion.updateMany({
      where: { entityId: atewaForest, version: 1 },
      data: { validTo: v2Time },
    });
    await prisma.twinEntityVersion.create({
      data: {
        entityId: atewaForest,
        version: 2,
        snapshot: JSON.stringify({ ...ent, status: "threatened", metadata: { ...ent.metadata, canopy_density: 0.78, species_count: 760 }, version: 2 }),
        changeReason: "Satellite imagery detected canopy loss in northern sector",
        diff: JSON.stringify({ canopy_density: { from: 0.82, to: 0.78 }, species_count: { from: 765, to: 760 } }),
        validFrom: v2Time,
      },
    });
    await prisma.twinEvent.create({
      data: {
        entityId: atewaForest,
        type: "depleted",
        title: "Atewa canopy loss detected",
        description: "4% canopy density decrease in northern sector",
        severity: "high",
        source: "satellite",
        sourceType: "satellite",
        payload: JSON.stringify({ canopy_density_delta: -0.04 }),
        timestamp: v2Time,
      },
    });
    await prisma.twinEntity.update({
      where: { id: atewaForest },
      data: { currentVersion: 2, status: "threatened", metadata: JSON.stringify({ ...ent.metadata, canopy_density: 0.78, species_count: 760 }), updatedAt: v2Time },
    });
  }

  // Add the recent events (cyanide spill, forest clearing) as event entries
  // (these are already entities but also create events on affected entities)
  const cyanideEvent = entityKeyToId["event-cyanide-spill-2024"];
  if (cyanideEvent && praRiver) {
    await prisma.twinEvent.create({
      data: {
        entityId: praRiver,
        type: "incident",
        title: "Cyanide spill reported",
        description: "Cyanide contamination from illegal mining detected",
        severity: "critical",
        source: "community-report",
        sourceType: "report",
        payload: JSON.stringify({ impact_area_hectares: 45, verified: true }),
        timestamp: daysAgo(7),
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

  // Count versions for logging
  const versionCount = await prisma.twinEntityVersion.count();
  const eventCount = await prisma.twinEvent.count();
  console.log(`[seed] Seeded ${TWIN_ENTITIES.length} twin entities, ${relCount} relationships, ${versionCount} versions, ${eventCount} events (temporally spread over 365 days).`);

  console.log("[seed] Seeding M7 evidence data...");
  await seedEvidenceData().catch((e) => console.log("[seed] M7 skipped:", e instanceof Error ? e.message : String(e)));
}

// ---------------------------------------------------------------------------
// M7 — Evidence seed data
// ---------------------------------------------------------------------------

import { createHash } from "node:crypto";

const SAMPLE_EVIDENCE = [
  {
    key: "evd-prestea-cyanide-001",
    title: "Cyanide Spill — Drone Photo",
    description: "Aerial photograph of cyanide-contaminated water flowing into the Pra River from the Prestea galamsey site.",
    type: "image",
    mediaType: "image/jpeg",
    storageKey: "evidence/evd-prestea-cyanide-001/v1-photo.jpg",
    sizeBytes: 2456789,
    lat: 5.4310,
    lng: -2.1440,
    metadata: { device: "DJI Mavic 3M", resolution: "5280x2970", captured_at: "2024-07-28T10:30:00Z", photographer: "Kofi Mensah" },
    twinEntityKey: "event-cyanide-spill-2024",
    encrypted: false,
    verified: true,
    daysAgo: 6,
  },
  {
    key: "evd-prestea-cyanide-002",
    title: "Water Sample Lab Report",
    description: "Laboratory analysis of water samples from the Pra River showing mercury and cyanide levels.",
    type: "document",
    mediaType: "application/pdf",
    storageKey: "evidence/evd-prestea-cyanide-002/v1-report.pdf",
    sizeBytes: 892341,
    lat: 5.4310,
    lng: -2.1440,
    metadata: { lab: "Ghana EPA Lab", sample_id: "WS-2024-0728-03", mercury_ppm: 0.004, cyanide_ppm: 0.12, analyst: "Dr. Owusu" },
    twinEntityKey: "event-cyanide-spill-2024",
    encrypted: true,
    verified: true,
    daysAgo: 5,
  },
  {
    key: "evd-obuasi-drone-survey",
    title: "Obuasi Illegal Pit — Drone Video",
    description: "4K video survey of the illegal mining pit within the AngloGold concession boundary.",
    type: "video",
    mediaType: "video/mp4",
    storageKey: "evidence/evd-obuasi-drone-survey/v1-survey.mp4",
    sizeBytes: 45678234,
    lat: 6.2062,
    lng: -1.6678,
    metadata: { device: "DJI Mavic 3M", duration_sec: 342, resolution: "3840x2160", fps: 30, pilot: "Akua Adjei" },
    twinEntityKey: "mine-obuasi-illegal",
    encrypted: false,
    verified: false,
    daysAgo: 3,
  },
  {
    key: "evd-prestea-audio-interview",
    title: "Prestea Community Interview",
    description: "Audio interview with Prestea community member about health impacts of mining pollution.",
    type: "audio",
    mediaType: "audio/mpeg",
    storageKey: "evidence/evd-prestea-audio-interview/v1-interview.mp3",
    sizeBytes: 5234567,
    lat: 5.4300,
    lng: -2.1400,
    metadata: { duration_sec: 845, interviewee: "anonymous", language: "Twi", interviewer: "Ama Boateng" },
    twinEntityKey: "community-prestea",
    encrypted: true,
    verified: true,
    daysAgo: 4,
  },
  {
    key: "evd-pra-river-gps-track",
    title: "Pra River Survey GPS Track",
    description: "GPS track of boat survey along the Pra River from Prestea to the confluence.",
    type: "gps_track",
    mediaType: "application/gpx+xml",
    storageKey: "evidence/evd-pra-river-gps-track/v1-track.gpx",
    sizeBytes: 45678,
    lat: 5.2767,
    lng: -1.8767,
    metadata: { points: 1247, distance_km: 18.4, device: "Garmin GPSMAP 66s", surveyor: "Yaw Owusu" },
    twinEntityKey: "river-pra-main",
    encrypted: false,
    verified: true,
    daysAgo: 8,
  },
  {
    key: "evd-atewa-satellite-2024",
    title: "Atewa Forest — Satellite Change Detection",
    description: "Sentinel-2 satellite imagery showing canopy loss in the northern sector of Atewa Forest Reserve.",
    type: "image",
    mediaType: "image/tiff",
    storageKey: "evidence/evd-atewa-satellite-2024/v1-sentinel.tif",
    sizeBytes: 12345678,
    lat: 6.1667,
    lng: -0.5500,
    metadata: { satellite: "Sentinel-2", capture_date: "2024-06-15", resolution_m: 10, cloud_cover: 8, scene_id: "S2B_20240615_ATEWA" },
    twinEntityKey: "forest-atewa",
    encrypted: false,
    verified: true,
    daysAgo: 12,
  },
  {
    key: "evd-prestea-inspection-log",
    title: "Prestea Site Inspection Log",
    description: "Field inspection log with findings, photos references, and GPS coordinates.",
    type: "document",
    mediaType: "application/pdf",
    storageKey: "evidence/evd-prestea-inspection-log/v1-inspection.pdf",
    sizeBytes: 234567,
    lat: 5.4321,
    lng: -2.1456,
    metadata: { inspector: "Kofi Mensah", findings: "Active illegal mining, mercury use detected", outcome: "violation_confirmed", evidence_refs: ["IMG-001", "IMG-002"] },
    twinEntityKey: "inspection-prestea-2024-06",
    encrypted: false,
    verified: true,
    daysAgo: 45,
  },
  {
    key: "evd-pra-sensor-log",
    title: "Pra River Sensor S1 — Water Quality Log",
    description: "Sensor log from the AquaScan Pro sensor showing 7-day water quality measurements.",
    type: "sensor_log",
    mediaType: "text/csv",
    storageKey: "evidence/evd-pra-sensor-log/v1-log.csv",
    sizeBytes: 34567,
    lat: 5.2800,
    lng: -1.8700,
    metadata: { sensor: "AquaScan Pro", serial: "AS-2024-001", parameters: ["ph", "mercury", "cyanide", "turbidity"], interval_min: 15 },
    twinEntityKey: "sensor-pra-s1",
    encrypted: false,
    verified: false,
    daysAgo: 2,
  },
];

async function seedEvidenceData() {
  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  // Build a lookup from twin entity key to id
  const twinEntities = await prisma.twinEntity.findMany({ select: { id: true, key: true } });
  const twinKeyToId = new Map(twinEntities.map((e) => [e.key, e.id]));

  // Get admin user for uploadedById
  const admin = await prisma.user.findUnique({ where: { email: "admin@sentinel.africa" } });

  let count = 0;
  for (const ev of SAMPLE_EVIDENCE) {
    // Generate fake content hash (deterministic from key)
    const contentHash = createHash("sha256").update(ev.key + ev.storageKey).digest("hex");
    const metadataHash = createHash("sha256").update(JSON.stringify(ev.metadata)).digest("hex");
    const combinedHash = createHash("sha256").update(contentHash + metadataHash + "GENESIS").digest("hex");
    const createdAt = daysAgo(ev.daysAgo);

    const evidence = await prisma.evidence.upsert({
      where: { key: ev.key },
      create: {
        key: ev.key,
        title: ev.title,
        description: ev.description,
        type: ev.type,
        mediaType: ev.mediaType,
        storageKey: ev.storageKey,
        storageProvider: "local",
        sizeBytes: ev.sizeBytes,
        checksum: contentHash,
        currentHash: combinedHash,
        previousHash: null,
        encrypted: ev.encrypted,
        encryptionKeyId: ev.encrypted ? `evidence-key-${ev.key}` : null,
        lat: ev.lat,
        lng: ev.lng,
        metadata: JSON.stringify(ev.metadata),
        currentVersion: 1,
        uploadedById: admin?.id,
        twinEntityId: ev.twinEntityKey ? twinKeyToId.get(ev.twinEntityKey) : null,
        verified: ev.verified,
        verifiedById: ev.verified ? admin?.id : null,
        verifiedAt: ev.verified ? createdAt : null,
        chainValid: true,
        createdAt,
        updatedAt: createdAt,
      },
      update: {},
    });

    // Create version 1
    await prisma.evidenceVersion.create({
      data: {
        evidenceId: evidence.id,
        version: 1,
        snapshot: JSON.stringify({ ...ev, version: 1 }),
        contentHash,
        metadataHash,
        combinedHash,
        previousHash: null,
        changeReason: "Initial upload",
        storageKey: ev.storageKey,
        sizeBytes: ev.sizeBytes,
        changedById: admin?.id,
        validFrom: createdAt,
      },
    }).catch(() => {});

    count++;
  }

  // Add a v2 to the first evidence item (to show versioning)
  const firstEvidence = await prisma.evidence.findUnique({ where: { key: "evd-prestea-cyanide-001" } });
  if (firstEvidence) {
    const v2ContentHash = createHash("sha256").update(firstEvidence.key + "v2-enhanced").digest("hex");
    const v2MetadataHash = createHash("sha256").update(JSON.stringify({ ...firstEvidence.metadata, enhanced: true })).digest("hex");
    const v2CombinedHash = createHash("sha256").update(v2ContentHash + v2MetadataHash + firstEvidence.currentHash).digest("hex");
    const v2Time = daysAgo(2);

    // Close v1
    await prisma.evidenceVersion.updateMany({
      where: { evidenceId: firstEvidence.id, version: 1 },
      data: { validTo: v2Time },
    });

    await prisma.evidenceVersion.create({
      data: {
        evidenceId: firstEvidence.id,
        version: 2,
        snapshot: JSON.stringify({ ...firstEvidence, version: 2, enhanced: true }),
        contentHash: v2ContentHash,
        metadataHash: v2MetadataHash,
        combinedHash: v2CombinedHash,
        previousHash: firstEvidence.currentHash,
        changeReason: "Enhanced resolution re-upload",
        storageKey: `evidence/evd-prestea-cyanide-001/v2-photo-enhanced.jpg`,
        sizeBytes: 2890123,
        changedById: admin?.id,
        validFrom: v2Time,
      },
    });

    await prisma.evidence.update({
      where: { id: firstEvidence.id },
      data: {
        currentVersion: 2,
        storageKey: `evidence/evd-prestea-cyanide-001/v2-photo-enhanced.jpg`,
        sizeBytes: 2890123,
        checksum: v2ContentHash,
        currentHash: v2CombinedHash,
        previousHash: firstEvidence.currentHash,
        updatedAt: v2Time,
      },
    });
  }

  console.log(`[seed] Seeded ${count} evidence items (images, video, audio, documents, GPS, sensor logs) with hash chains and version history.`);

  console.log("[seed] Seeding M9 corroboration data...");
  await seedCorroborationData().catch((e) => console.log("[seed] M9 skipped:", e instanceof Error ? e.message : String(e)));

  console.log("[seed] Seeding M8 community intelligence data...");
  await seedIntelligenceData().catch((e) => console.log("[seed] M8 skipped:", e instanceof Error ? e.message : String(e)));
}

// ---------------------------------------------------------------------------
// M9 — Evidence Corroboration seed data
// ---------------------------------------------------------------------------

async function seedCorroborationData() {
  const evidence = await prisma.evidence.findMany({ select: { id: true, key: true, uploadedById: true, organizationId: true, verified: true, checksum: true, lat: true, lng: true, type: true, mediaType: true, createdAt: true } });
  if (evidence.length < 3) return;

  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  if (users.length < 3) return;

  // Get trust profiles for strength
  const trustProfiles = await prisma.trustProfile.findMany({ select: { userId: true, score: true } });
  const trustMap = new Map(trustProfiles.map((t) => [t.userId, t.score]));

  // Support/dispute the first few evidence items
  const ev0 = evidence[0]!; // Cyanide drone photo
  const ev1 = evidence[1]!; // Water sample lab report
  const ev2 = evidence[2]!; // Obuasi drone video

  // Supports for ev0 (cyanide photo) — 3 supports, 2 independent
  for (let i = 1; i <= 3; i++) {
    const user = users[i]!;
    const strength = (trustMap.get(user.id) ?? 50) / 100;
    const isIndependent = i <= 2; // first 2 are independent
    await prisma.corroboration.create({
      data: {
        evidenceId: ev0.id,
        userId: user.id,
        type: "support",
        strength,
        reason: i === 1 ? "I witnessed the spill myself — this photo accurately depicts the contamination." : i === 2 ? "Our sensor data confirms elevated cyanide levels at this location." : "This matches our field observations.",
        isIndependent,
      },
    }).catch(() => {});
  }

  // 1 dispute for ev0
  await prisma.corroboration.create({
    data: {
      evidenceId: ev0.id,
      userId: users[4]!.id,
      type: "dispute",
      strength: 0.6,
      reason: "The photo angle suggests this may be from a different location. Requesting GPS metadata verification.",
    },
  }).catch(() => {});

  // Supports for ev1 (lab report) — 2 supports, 1 independent
  for (let i = 2; i <= 3; i++) {
    const user = users[i]!;
    const strength = (trustMap.get(user.id) ?? 50) / 100;
    await prisma.corroboration.create({
      data: {
        evidenceId: ev1.id,
        userId: user.id,
        type: "support",
        strength,
        reason: i === 2 ? "Lab results are consistent with our independent water sampling." : "The mercury levels match our sensor readings.",
        isIndependent: i === 2,
      },
    }).catch(() => {});
  }

  // Supports for ev2 (drone video) — 2 supports
  for (let i = 1; i <= 2; i++) {
    const user = users[i]!;
    const strength = (trustMap.get(user.id) ?? 50) / 100;
    await prisma.corroboration.create({
      data: {
        evidenceId: ev2.id,
        userId: user.id,
        type: "support",
        strength,
        reason: "Drone footage clearly shows the pit expansion.",
        isIndependent: i === 1,
      },
    }).catch(() => {});
  }

  // 1 dispute for ev2
  await prisma.corroboration.create({
    data: {
      evidenceId: ev2.id,
      userId: users[3]!.id,
      type: "dispute",
      strength: 0.5,
      reason: "The timestamp doesn't match the claimed survey date. Needs verification.",
    },
  }).catch(() => {});

  // Create a duplicate group (ev0 and ev5 are both images near Prestea — simulate a location_proximity match)
  if (evidence.length >= 6) {
    const ev5 = evidence[5]!; // Atewa satellite
    // Actually, let's create a hash_match duplicate between two items with the same checksum
    // Since our seed generates unique checksums, we'll simulate a location_proximity match
    await prisma.duplicateGroup.create({
      data: {
        evidenceIds: JSON.stringify([ev0.id, ev2.id]),
        detectionMethod: "location_proximity",
        confidence: 0.7,
        metadata: JSON.stringify({ distance_m: 35, time_diff_sec: 1800, note: "Both captured near Prestea within 30 minutes" }),
        status: "detected",
      },
    }).catch(() => {});
  }

  // Compute weights for all evidence
  let weightCount = 0;
  for (const ev of evidence) {
    const supports = await prisma.corroboration.count({ where: { evidenceId: ev.id, type: "support" } });
    const disputes = await prisma.corroboration.count({ where: { evidenceId: ev.id, type: "dispute" } });
    const independent = await prisma.corroboration.count({ where: { evidenceId: ev.id, type: "support", isIndependent: true } });

    const baseTrust = trustMap.get(ev.uploadedById ?? "") ?? 30;

    // Simple weight computation (mirrors the service)
    const supportBonus = Math.min(supports * 0.05, 0.3);
    const disputePenalty = Math.min(disputes * 0.08, 0.4);
    const independentBonus = Math.min(independent * 0.1, 0.3);
    const verificationBonus = ev.verified ? 0.15 : 0;
    const weight = Math.max(0, Math.min(1, baseTrust / 100 + supportBonus - disputePenalty + independentBonus + verificationBonus));
    const confidence = Math.max(0, Math.min(1, baseTrust / 100 * 0.4 + independentBonus + supportBonus * 0.5));
    const tier = weight >= 0.85 ? "confirmed" : weight >= 0.7 ? "strong" : weight >= 0.5 ? "moderate" : weight >= 0.3 ? "weak" : "unverified";

    await prisma.evidenceWeight.create({
      data: {
        evidenceId: ev.id,
        weight,
        confidence,
        factors: JSON.stringify({ baseTrust: baseTrust / 100, supportBonus, disputePenalty, independentBonus, duplicatePenalty: 0, verificationBonus }),
        supportCount: supports,
        disputeCount: disputes,
        independentCount: independent,
        tier,
        lastCalculatedAt: new Date(),
      },
    }).catch(() => {});
    weightCount++;
  }

  const corrobCount = await prisma.corroboration.count();
  const dupCount = await prisma.duplicateGroup.count();
  console.log(`[seed] Seeded ${corrobCount} corroboration records, ${dupCount} duplicate groups, ${weightCount} evidence weights.`);
}

// ---------------------------------------------------------------------------
// M8 — Community Intelligence seed data (event-sourced)
// ---------------------------------------------------------------------------

const SAMPLE_EVENTS = [
  {
    key: "evt-prestea-cyanide-spill",
    title: "Cyanide Spill on Pra River near Prestea",
    description: "Community members report cyanide contamination in the Pra River originating from the Prestea galamsey complex. Fish dying, water unsafe for drinking.",
    type: "water_contamination",
    severity: "critical",
    status: "investigating",
    lat: 5.4310,
    lng: -2.1440,
    locationName: "Pra River, Prestea, Western Region",
    daysAgo: 7,
    comments: [
      { body: "I saw the water turn blue-green yesterday morning. Many dead fish floating.", authorIdx: 4, daysAgo: 6 },
      { body: "EPA team should test the water immediately. This is a public health emergency.", authorIdx: 1, daysAgo: 5 },
      { body: "We have lab results confirming mercury levels at 0.004 ppm — 4x the safe threshold.", authorIdx: 0, daysAgo: 5, attachments: ["evd-prestea-cyanide-002"] },
      { body: "Community members are reporting skin rashes after using the river water.", authorIdx: 4, daysAgo: 3 },
    ],
    subscriptions: [
      { userIdx: 0, type: "watch" },
      { userIdx: 1, type: "watch" },
      { userIdx: 2, type: "follow" },
      { userIdx: 3, type: "watch" },
      { userIdx: 4, type: "follow" },
    ],
    shares: [
      { sharedByIdx: 0, platform: "internal", recipientIdx: 1 },
      { sharedByIdx: 1, platform: "whatsapp" },
      { sharedByIdx: 4, platform: "telegram" },
    ],
  },
  {
    key: "evt-obuasi-pit-expansion",
    title: "Illegal Pit Expansion at Obuasi Concession",
    description: "Drone survey reveals 30-hectare expansion of illegal mining pit within the AngloGold Ashanti concession boundary.",
    type: "illegal_mining",
    severity: "high",
    status: "open",
    lat: 6.2062,
    lng: -1.6678,
    locationName: "Obuasi, Ashanti Region",
    daysAgo: 30,
    comments: [
      { body: "The expansion is clearly visible in the drone footage. Trespass mining is ongoing.", authorIdx: 0, daysAgo: 29, attachments: ["evd-obuasi-drone-survey"] },
      { body: "AngloGold security should be notified. This is within their legal boundary.", authorIdx: 1, daysAgo: 28 },
      { body: "We need a follow-up inspection to assess environmental damage.", authorIdx: 0, daysAgo: 27 },
    ],
    subscriptions: [
      { userIdx: 0, type: "watch" },
      { userIdx: 1, type: "watch" },
      { userIdx: 4, type: "watch" },
    ],
    shares: [
      { sharedByIdx: 0, platform: "internal", recipientIdx: 2 },
    ],
  },
  {
    key: "evt-atewa-forest-clearing",
    title: "Forest Clearing Detected in Atewa Reserve",
    description: "Satellite imagery analysis detects 4% canopy loss in the northern sector of Atewa Forest Reserve — likely bauxite mining encroachment.",
    type: "deforestation",
    severity: "high",
    status: "verified",
    lat: 6.1667,
    lng: -0.5500,
    locationName: "Atewa Forest Reserve, Eastern Region",
    daysAgo: 60,
    comments: [
      { body: "Sentinel-2 imagery from June clearly shows the clearing. We need ground verification.", authorIdx: 2, daysAgo: 59, attachments: ["evd-atewa-satellite-2024"] },
      { body: "This is a protected Hill Sanctuary. The Forestry Commission must act immediately.", authorIdx: 1, daysAgo: 58 },
      { body: "Ground inspection confirmed illegal access roads into the reserve.", authorIdx: 0, daysAgo: 50 },
      { body: "Status updated to verified — clearing confirmed at 4% canopy loss.", authorIdx: 0, daysAgo: 45 },
    ],
    subscriptions: [
      { userIdx: 0, type: "watch" },
      { userIdx: 1, type: "watch" },
      { userIdx: 2, type: "watch" },
      { userIdx: 3, type: "follow" },
    ],
    shares: [
      { sharedByIdx: 2, platform: "twitter" },
      { sharedByIdx: 1, platform: "email" },
    ],
  },
  {
    key: "evt-dunkwa-river-diversion",
    title: "River Diversion at Dunkwa Alluvial Site",
    description: "Alluvial mining at Dunkwa has diverted the Offin River channel, affecting downstream water supply.",
    type: "water_contamination",
    severity: "medium",
    status: "open",
    lat: 5.9783,
    lng: -1.7822,
    locationName: "Dunkwa-on-Offin, Central Region",
    daysAgo: 14,
    comments: [
      { body: "The river flow has changed direction. Our fishing boats can't reach the usual spots.", authorIdx: 4, daysAgo: 13 },
      { body: "This is affecting the Dunkwa community water supply. Need urgent assessment.", authorIdx: 3, daysAgo: 12 },
    ],
    subscriptions: [
      { userIdx: 3, type: "watch" },
      { userIdx: 4, type: "watch" },
    ],
    shares: [
      { sharedByIdx: 3, platform: "whatsapp" },
    ],
  },
  {
    key: "evt-tarkwa-mercury-pollution",
    title: "Mercury Pollution in Tarkwa Mining Area",
    description: "Soil and water samples from the Tarkwa-Prestea belt show elevated mercury levels from artisanal gold processing.",
    type: "pollution",
    severity: "high",
    status: "investigating",
    lat: 5.3056,
    lng: -1.9933,
    locationName: "Tarkwa, Western Region",
    daysAgo: 20,
    comments: [
      { body: "Mercury is being used openly in the processing sites. No containment measures.", authorIdx: 0, daysAgo: 19 },
      { body: "Health workers report increased mercury poisoning cases at Tarkwa hospital.", authorIdx: 1, daysAgo: 18 },
      { body: "We need to map all processing sites and issue cease orders.", authorIdx: 0, daysAgo: 15 },
    ],
    subscriptions: [
      { userIdx: 0, type: "watch" },
      { userIdx: 1, type: "watch" },
      { userIdx: 2, type: "follow" },
    ],
    shares: [
      { sharedByIdx: 1, platform: "internal", recipientIdx: 3 },
    ],
  },
];

async function seedIntelligenceData() {
  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  // Get users
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  if (users.length < 5) return;
  const admin = users[0]!; // admin@sentinel.africa
  const getUser = (idx: number) => users[idx % users.length]!;

  // Get evidence IDs for attachments
  const evidence = await prisma.evidence.findMany({ select: { id: true, key: true } });
  const evidenceKeyToId = new Map(evidence.map((e) => [e.key, e.id]));

  let eventCount = 0;
  let commentCount = 0;
  let subCount = 0;
  let shareCount = 0;
  let streamCount = 0;

  for (const ev of SAMPLE_EVENTS) {
    const creator = getUser(0);
    const createdAt = daysAgo(ev.daysAgo);

    // Create the event
    const event = await prisma.intelligenceEvent.upsert({
      where: { key: ev.key },
      create: {
        key: ev.key,
        title: ev.title,
        description: ev.description,
        type: ev.type,
        severity: ev.severity,
        status: ev.status,
        lat: ev.lat,
        lng: ev.lng,
        locationName: ev.locationName,
        createdById: creator.id,
        streamVersion: 1,
        createdAt,
        updatedAt: createdAt,
      },
      update: {},
    });

    // Append "created" stream event
    await prisma.eventStreamEntry.create({
      data: {
        eventId: event.id,
        version: 1,
        eventType: "created",
        actorId: creator.id,
        actorType: "user",
        payload: JSON.stringify({ title: ev.title, type: ev.type, severity: ev.severity, lat: ev.lat, lng: ev.lng, locationName: ev.locationName }),
        timestamp: createdAt,
      },
    });
    streamCount++;

    let version = 1;

    // Add comments
    for (const comment of ev.comments) {
      const author = getUser(comment.authorIdx);
      const commentTime = daysAgo(comment.daysAgo);
      const attachmentIds = (comment.attachments ?? []).map((k) => evidenceKeyToId.get(k)).filter(Boolean) as string[];

      const createdComment = await prisma.eventComment.create({
        data: {
          eventId: event.id,
          authorId: author.id,
          body: comment.body,
          attachments: attachmentIds.length > 0 ? JSON.stringify(attachmentIds) : null,
          createdAt: commentTime,
          updatedAt: commentTime,
        },
      });

      version++;
      await prisma.eventStreamEntry.create({
        data: {
          eventId: event.id,
          version,
          eventType: "commented",
          actorId: author.id,
          actorType: "user",
          payload: JSON.stringify({ commentId: createdComment.id, body: comment.body, attachments: attachmentIds }),
          timestamp: commentTime,
        },
      });
      streamCount++;
      commentCount++;
    }

    // Add subscriptions
    for (const sub of ev.subscriptions) {
      const user = getUser(sub.userIdx);
      const subTime = daysAgo(sub.userIdx + 1);
      // Create the subscription record
      await prisma.eventSubscription.create({
        data: {
          eventId: event.id,
          userId: user.id,
          type: sub.type,
          createdAt: subTime,
        },
      }).catch(() => {});
      version++;
      await prisma.eventStreamEntry.create({
        data: {
          eventId: event.id,
          version,
          eventType: "subscribed",
          actorId: user.id,
          actorType: "user",
          payload: JSON.stringify({ userId: user.id, subscriptionType: sub.type }),
          timestamp: subTime,
        },
      });
      streamCount++;
      subCount++;
    }

    // Add shares
    for (const share of ev.shares) {
      const sharer = getUser(share.sharedByIdx);
      const shareTime = daysAgo(share.sharedByIdx + 2);
      // Create the share record
      await prisma.eventShare.create({
        data: {
          eventId: event.id,
          sharedById: sharer.id,
          platform: share.platform,
          recipientId: share.recipientIdx !== undefined ? getUser(share.recipientIdx).id : null,
          createdAt: shareTime,
        },
      }).catch(() => {});
      version++;
      await prisma.eventStreamEntry.create({
        data: {
          eventId: event.id,
          version,
          eventType: "shared",
          actorId: sharer.id,
          actorType: "user",
          payload: JSON.stringify({ platform: share.platform, recipientId: share.recipientIdx !== undefined ? getUser(share.recipientIdx).id : null }),
          timestamp: shareTime,
        },
      });
      streamCount++;
      shareCount++;
    }

    // Update projection counters
    await prisma.intelligenceEvent.update({
      where: { id: event.id },
      data: {
        commentCount: ev.comments.length,
        subscriberCount: ev.subscriptions.length,
        watcherCount: ev.subscriptions.filter((s) => s.type === "watch").length,
        shareCount: ev.shares.length,
        viewCount: Math.floor(Math.random() * 200) + 50,
        streamVersion: version,
        updatedAt: daysAgo(1),
      },
    });

    eventCount++;
  }

  console.log(`[seed] Seeded ${eventCount} intelligence events, ${commentCount} comments, ${subCount} subscriptions, ${shareCount} shares, ${streamCount} stream entries (event-sourced).`);

  console.log("[seed] Seeding M10 civil trust data...");
  await seedTrustData().catch((e) => console.log("[seed] M10 skipped:", e instanceof Error ? e.message : String(e)));
}

// ---------------------------------------------------------------------------
// M10 — Civil Trust seed data
// ---------------------------------------------------------------------------

async function seedTrustData() {
  const users = await prisma.user.findMany({ select: { id: true, email: true, name: true, createdAt: true } });
  if (users.length === 0) return;

  // Get intelligence events per user
  const eventsByUser = await prisma.intelligenceEvent.groupBy({
    by: ["createdById"],
    _count: true,
  });
  const verifiedByUser = await prisma.intelligenceEvent.groupBy({
    by: ["createdById"],
    where: { status: "verified" },
    _count: true,
  });

  // Get evidence weights per user
  const evidenceByUser = new Map<string, { count: number; avgWeight: number }>();
  const allEvidence = await prisma.evidence.findMany({ select: { id: true, uploadedById: true } });
  const allWeights = await prisma.evidenceWeight.findMany({ select: { evidenceId: true, weight: true } });
  const weightMap = new Map(allWeights.map((w) => [w.evidenceId, w.weight]));
  for (const ev of allEvidence) {
    if (!ev.uploadedById) continue;
    const w = weightMap.get(ev.id) ?? 0.5;
    const existing = evidenceByUser.get(ev.uploadedById) ?? { count: 0, avgWeight: 0 };
    existing.count++;
    existing.avgWeight = (existing.avgWeight * (existing.count - 1) + w) / existing.count;
    evidenceByUser.set(ev.uploadedById, existing);
  }

  // Get corroboration counts per user
  const corrobByUser = await prisma.corroboration.groupBy({
    by: ["userId"],
    _count: true,
  });

  // Get verifications per user
  const verifByUser = await prisma.identityVerification.groupBy({
    by: ["userId"],
    where: { status: "approved" },
    _count: true,
  });

  // Create trust factors for each user
  let count = 0;
  for (const user of users) {
    const events = eventsByUser.find((e) => e.createdById === user.id)?._count ?? 0;
    const verified = verifiedByUser.find((e) => e.createdById === user.id)?._count ?? 0;
    const evidence = evidenceByUser.get(user.id) ?? { count: 0, avgWeight: 0.5 };
    const corrobCount = corrobByUser.find((c) => c.userId === user.id)?._count ?? 0;
    const verifs = verifByUser.find((v) => v.userId === user.id)?._count ?? 0;

    // Compute factors
    const accuracy = events > 0 ? verified / events : 0.5;
    const reliability = 0.7;
    const falseReportRate = events > 0 ? Math.max(0, (events - verified) / events * 0.3) : 0;
    const falseReportCount = events > 0 ? Math.floor((events - verified) * 0.3) : 0;
    const evidenceQuality = evidence.avgWeight || 0.5;
    const contributionQuality = corrobCount > 0 ? Math.min(0.9, 0.5 + corrobCount * 0.1) : 0.5;
    const communityImpact = Math.min(1.0, verifs * 0.15 + corrobCount * 0.05);
    const fraudResistance = 1.0;
    const decayRate = 0.05; // small decay for demo

    // Compute composite (simplified — mirrors the domain)
    const baseScore = accuracy * 0.20 + reliability * 0.15 + (1 - falseReportRate) * 0.15 + evidenceQuality * 0.15 + contributionQuality * 0.10 + communityImpact * 0.10;
    const compositeScore = Math.max(0, Math.min(1, baseScore * (1 - decayRate) * fraudResistance));
    const tier = compositeScore >= 0.85 ? "elite" : compositeScore >= 0.7 ? "trusted" : compositeScore >= 0.5 ? "verified" : compositeScore >= 0.3 ? "basic" : "unverified";

    await prisma.trustFactor.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        accuracy,
        reliability,
        falseReportRate,
        falseReportCount,
        evidenceQuality,
        contributionQuality,
        communityImpact,
        fraudResistance,
        fraudFlagCount: 0,
        totalReports: events,
        verifiedReports: verified,
        totalEvidence: evidence.count,
        totalComments: 0,
        totalShares: 0,
        lastActivityAt: new Date(Date.now() - Math.floor(Math.random() * 60 * 24 * 60 * 60 * 1000)),
        decayRate,
        compositeScore,
        tier,
        factors: JSON.stringify({
          factors: { accuracy, reliability, falseReportPenalty: 1 - falseReportRate, evidenceQuality, contributionQuality, communityImpact, decayMultiplier: 1 - decayRate, fraudMultiplier: fraudResistance },
          weightedBreakdown: { accuracy: accuracy * 0.20, reliability: reliability * 0.15, falseReportPenalty: (1 - falseReportRate) * 0.15, evidenceQuality: evidenceQuality * 0.15, contributionQuality: contributionQuality * 0.10, communityImpact: communityImpact * 0.10 },
        }),
        lastCalculatedAt: new Date(),
      },
      update: {},
    });

    // Create a fraud flag for one user (demo)
    if (user.email === "reporter.kwame@community.org") {
      await prisma.fraudFlag.create({
        data: {
          userId: user.id,
          type: "duplicate_spam",
          severity: "low",
          description: "2 near-identical reports submitted within 5 minutes",
          status: "detected",
          penalty: 0.05,
        },
      }).catch(() => {});
    }

    count++;
  }

  // Create a few decay logs
  const firstUser = users[0]!;
  for (let i = 0; i < 3; i++) {
    await prisma.trustDecayLog.create({
      data: {
        userId: firstUser.id,
        previousScore: 0.95 - i * 0.02,
        newScore: 0.93 - i * 0.02,
        decayAmount: 0.02,
        daysInactive: 30 + i * 30,
        decayRate: 0.02 + i * 0.01,
        appliedAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
      },
    }).catch(() => {});
  }

  console.log(`[seed] Seeded ${count} trust factor records with 8-factor computation, 1 fraud flag, 3 decay logs.`);

  console.log("[seed] Seeding M11 notification data...");
  await seedNotificationData().catch((e) => console.log("[seed] M11 skipped:", e instanceof Error ? e.message : String(e)));
}

// ---------------------------------------------------------------------------
// M11 — Notification seed data
// ---------------------------------------------------------------------------

async function seedNotificationData() {
  const users = await prisma.user.findMany({ select: { id: true, email: true, name: true } });
  if (users.length === 0) return;

  // Register channels for each user
  for (const user of users) {
    await prisma.notificationChannel.create({
      data: { userId: user.id, type: "in_app", address: null, isVerified: true, isEnabled: true },
    }).catch(() => {});
    if (user.email) {
      await prisma.notificationChannel.create({
        data: { userId: user.id, type: "email", address: user.email, isVerified: true, isEnabled: true },
      }).catch(() => {});
    }
    // Push channel for some users
    if (users.indexOf(user) < 3) {
      await prisma.notificationChannel.create({
        data: { userId: user.id, type: "push", address: `device_token_${user.id.slice(0, 8)}`, isVerified: true, isEnabled: true },
      }).catch(() => {});
    }
  }

  // Create interest subscriptions
  const interests = ["water_contamination", "illegal_mining", "deforestation", "evidence_verified", "corroboration_received"];
  for (const user of users.slice(0, 5)) {
    for (const interest of interests.slice(0, 3)) {
      await prisma.notificationSubscription.create({
        data: {
          userId: user.id,
          subscriptionType: "interest",
          target: interest,
          channels: JSON.stringify(["in_app", "email"]),
          minPriority: 0,
          digestMode: user === users[0] ? "daily" : "none",
          isActive: true,
        },
      }).catch(() => {});
    }
  }

  // Create geofences
  for (const user of users.slice(0, 3)) {
    await prisma.geofenceSubscription.create({
      data: {
        userId: user.id,
        name: user === users[0] ? "Prestea Mining Belt" : user === users[1] ? "Pra River Basin" : "Atewa Forest",
        centerLat: user === users[0] ? 5.43 : user === users[1] ? 5.28 : 6.17,
        centerLng: user === users[0] ? -2.14 : user === users[1] ? -1.88 : -0.55,
        radiusM: user === users[0] ? 10000 : 15000,
        geojson: JSON.stringify({
          type: "Feature",
          geometry: { type: "Polygon", coordinates: [[[-2.2, 5.3], [-2.0, 5.3], [-2.0, 5.5], [-2.2, 5.5], [-2.2, 5.3]]] },
        }),
        channels: JSON.stringify(["push", "in_app"]),
        minPriority: 1,
        eventTypes: JSON.stringify(["intelligence_event", "evidence_upload"]),
        isActive: true,
      },
    }).catch(() => {});
  }

  // Create sample notifications
  const sampleNotifications = [
    { userId: 0, type: "intelligence_event", title: "New Intelligence Event: Cyanide Spill", body: "A critical water contamination event was reported near Prestea.", priority: 3, source: "event_bus", channels: ["push", "in_app"] },
    { userId: 0, type: "evidence_verified", title: "Your Evidence Was Verified", body: "Your drone photo 'Cyanide Spill — Drone Photo' has been verified by a reviewer.", priority: 1, source: "event_bus", channels: ["in_app"] },
    { userId: 1, type: "corroboration", title: "New Support on Your Evidence", body: "Kofi Mensah supported your water sample lab report.", priority: 1, source: "event_bus", channels: ["in_app"] },
    { userId: 1, type: "trust_change", title: "Trust Score Updated", body: "Your trust score increased to 72 (Verified tier).", priority: 1, source: "event_bus", channels: ["in_app"] },
    { userId: 2, type: "intelligence_event", title: "Event in Your Geofence: Atewa Forest", body: "A deforestation event was detected within your Atewa Forest geofence.", priority: 2, source: "event_bus", matchedGeofence: "Atewa Forest", channels: ["push", "in_app"] },
    { userId: 3, type: "fraud_alert", title: "Fraud Alert", body: "A duplicate spam pattern was detected in your area.", priority: 2, source: "event_bus", channels: ["in_app"] },
    { userId: 4, type: "community_update", title: "Weekly Community Digest", body: "5 new intelligence events in your area this week.", priority: 0, source: "digest", channels: ["in_app"] },
    { userId: 0, type: "system", title: "System Maintenance", body: "Scheduled maintenance window: Sunday 2-4 AM GMT.", priority: 0, source: "system", channels: ["in_app"] },
  ];

  for (const n of sampleNotifications) {
    const user = users[n.userId]!;
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: n.type,
        title: n.title,
        body: n.body,
        priority: n.priority,
        channels: JSON.stringify(n.channels),
        source: n.source,
        matchedGeofence: (n as any).matchedGeofence ?? null,
        isRead: Math.random() > 0.5,
        deliveryStatus: JSON.stringify(n.channels.map((ch: string) => ({ channel: ch, status: "delivered", deliveredAt: new Date().toISOString() }))),
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)),
      },
    }).catch(() => {});
  }

  // Create a sample digest
  await prisma.notificationDigest.create({
    data: {
      userId: users[0]!.id,
      period: "daily",
      startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
      endTime: new Date(),
      notificationIds: JSON.stringify(["sample1", "sample2", "sample3"]),
      count: 3,
      status: "sent",
      sentAt: new Date(),
      channels: JSON.stringify(["in_app", "email"]),
    },
  }).catch(() => {});

  const notifCount = await prisma.notification.count();
  const channelCount = await prisma.notificationChannel.count();
  const subCount = await prisma.notificationSubscription.count();
  const gfCount = await prisma.geofenceSubscription.count();
  console.log(`[seed] Seeded ${notifCount} notifications, ${channelCount} channels, ${subCount} subscriptions, ${gfCount} geofences.`);

  console.log("[seed] Seeding M12 satellite ingestion data...");
  await seedSatelliteData().catch((e) => console.log("[seed] M12 skipped:", e instanceof Error ? e.message : String(e)));
}

// ---------------------------------------------------------------------------
// M12 — Satellite Ingestion seed data
// ---------------------------------------------------------------------------

async function seedSatelliteData() {
  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  // Create ingestion schedules
  const schedules = [
    { name: "Prestea Mining Belt — Sentinel-2 Weekly", satellite: "sentinel2", bbox: [-2.3, 5.2, -1.8, 5.6], frequency: "weekly", maxCloudCover: 20, bands: ["B02","B03","B04","B08","B11","B12"] },
    { name: "Atewa Forest — Landsat-8 Biweekly", satellite: "landsat8", bbox: [-0.7, 6.0, -0.4, 6.3], frequency: "weekly", maxCloudCover: 15, bands: ["B2","B3","B4","B5","B6","B7"] },
    { name: "Pra River Basin — Sentinel-2 Daily", satellite: "sentinel2", bbox: [-2.2, 5.1, -1.7, 5.9], frequency: "daily", maxCloudCover: 30, bands: ["B02","B03","B04","B08"] },
    { name: "Tarkwa Gold Belt — Sentinel-1 SAR", satellite: "sentinel1", bbox: [-2.2, 5.1, -1.8, 5.5], frequency: "weekly", maxCloudCover: 100, bands: ["VV","VH"] },
  ];

  for (const s of schedules) {
    const [minLng, minLat, maxLng, maxLat] = s.bbox;
    await prisma.ingestionSchedule.create({
      data: {
        name: s.name,
        satellite: s.satellite,
        bbox: JSON.stringify(s.bbox),
        centerLat: (minLat + maxLat) / 2,
        centerLng: (minLng + maxLng) / 2,
        frequency: s.frequency,
        cronExpression: s.frequency === "daily" ? "0 6 * * *" : s.frequency === "weekly" ? "0 6 * * 1" : null,
        nextRunAt: new Date(now.getTime() + (s.frequency === "daily" ? 1 : 7) * 24 * 60 * 60 * 1000),
        maxCloudCover: s.maxCloudCover,
        bands: JSON.stringify(s.bands),
        isActive: true,
      },
    }).catch(() => {});
  }

  // Create satellite scenes with tiles
  const sceneData = [
    { satellite: "sentinel2", acquisitionDate: daysAgo(15), cloudCover: 8, bbox: [-2.3, 5.2, -1.8, 5.6], resolutionM: 10, status: "ready", stage: "ready" },
    { satellite: "sentinel2", acquisitionDate: daysAgo(22), cloudCover: 12, bbox: [-2.3, 5.2, -1.8, 5.6], resolutionM: 10, status: "ready", stage: "ready" },
    { satellite: "sentinel2", acquisitionDate: daysAgo(7), cloudCover: 5, bbox: [-2.2, 5.1, -1.7, 5.9], resolutionM: 10, status: "ready", stage: "ready" },
    { satellite: "landsat8", acquisitionDate: daysAgo(30), cloudCover: 15, bbox: [-0.7, 6.0, -0.4, 6.3], resolutionM: 30, status: "ready", stage: "ready" },
    { satellite: "landsat8", acquisitionDate: daysAgo(60), cloudCover: 20, bbox: [-0.7, 6.0, -0.4, 6.3], resolutionM: 30, status: "archived", stage: "archived" },
    { satellite: "sentinel1", acquisitionDate: daysAgo(10), cloudCover: 0, bbox: [-2.2, 5.1, -1.8, 5.5], resolutionM: 10, status: "ready", stage: "ready" },
    { satellite: "sentinel2", acquisitionDate: daysAgo(90), cloudCover: 18, bbox: [-2.3, 5.2, -1.8, 5.6], resolutionM: 10, status: "archived", stage: "archived" },
    { satellite: "sentinel2", acquisitionDate: daysAgo(180), cloudCover: 25, bbox: [-2.3, 5.2, -1.8, 5.6], resolutionM: 10, status: "archived", stage: "archived" },
    { satellite: "landsat8", acquisitionDate: daysAgo(120), cloudCover: 10, bbox: [-0.7, 6.0, -0.4, 6.3], resolutionM: 30, status: "archived", stage: "archived" },
    { satellite: "sentinel2", acquisitionDate: daysAgo(1), cloudCover: 3, bbox: [-2.2, 5.1, -1.7, 5.9], resolutionM: 10, status: "processing", stage: "tiling" },
  ];

  let sceneCount = 0;
  let tileCount = 0;

  for (const sd of sceneData) {
    const [minLng, minLat, maxLng, maxLat] = sd.bbox;
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    const sceneIdStr = `${sd.satellite.toUpperCase()}_${sd.acquisitionDate.toISOString().slice(0,10).replace(/-/g,"")}_${centerLat.toFixed(2)}_${centerLng.toFixed(2)}`;
    const hash = createHash("sha256").update(sceneIdStr).digest("hex").slice(0, 8);
    const officialSceneId = `${sd.satellite}_${hash}_${sd.acquisitionDate.toISOString().slice(0,10)}`;

    const scene = await prisma.satelliteScene.create({
      data: {
        sceneId: officialSceneId,
        satellite: sd.satellite,
        sensor: sd.satellite === "sentinel1" ? "SAR" : "MSI",
        acquisitionDate: sd.acquisitionDate,
        cloudCover: sd.cloudCover,
        sunAzimuth: 140 + Math.random() * 40,
        sunElevation: 45 + Math.random() * 20,
        bbox: JSON.stringify(sd.bbox),
        centerLat,
        centerLng,
        resolutionM: sd.resolutionM,
        status: sd.status,
        processingStage: sd.stage,
        rawStorageKey: sd.status !== "processing" ? `satellite/raw/${officialSceneId}` : null,
        tiledStorageKey: sd.status === "ready" ? `satellite/tiles/${officialSceneId}` : null,
        thumbnailKey: sd.status !== "processing" ? `satellite/thumbnails/${officialSceneId}.png` : null,
        sizeBytes: Math.floor(50 + Math.random() * 200) * 1024 * 1024,
        bands: JSON.stringify(sd.satellite === "sentinel1" ? ["VV","VH"] : sd.satellite === "landsat8" ? ["B2","B3","B4","B5","B6","B7"] : ["B02","B03","B04","B08","B11","B12"]),
        metadata: JSON.stringify({ satellite: sd.satellite === "sentinel2" ? "Sentinel-2" : sd.satellite === "landsat8" ? "Landsat-8" : "Sentinel-1", resolutionM: sd.resolutionM }),
        processedAt: sd.status === "ready" || sd.status === "archived" ? sd.acquisitionDate : null,
      },
    });
    sceneCount++;

    // Generate tiles for ready/archived scenes
    if (sd.status === "ready" || sd.status === "archived") {
      for (const z of [8, 10, 12, 14]) {
        const n = Math.pow(2, z);
        const minTileX = Math.floor(((minLng + 180) / 360) * n);
        const maxTileX = Math.floor(((maxLng + 180) / 360) * n);
        const maxTileY = Math.floor(((1 - Math.log(Math.tan(maxLat * Math.PI/180) + 1/Math.cos(maxLat * Math.PI/180)) / Math.PI) / 2) * n);
        const minTileY = Math.floor(((1 - Math.log(Math.tan(minLat * Math.PI/180) + 1/Math.cos(minLat * Math.PI/180)) / Math.PI) / 2) * n);
        const xRange = Math.min(maxTileX - minTileX + 1, 8);
        const yRange = Math.min(maxTileY - minTileY + 1, 8);

        for (let x = 0; x < xRange; x++) {
          for (let y = 0; y < yRange; y++) {
            const tileX = minTileX + x;
            const tileY = minTileY + y;
            let quadkey = "";
            for (let i = z; i > 0; i--) {
              let digit = 0;
              const mask = 1 << (i - 1);
              if ((tileX & mask) !== 0) digit += 1;
              if ((tileY & mask) !== 0) digit += 2;
              quadkey += digit.toString();
            }
            await prisma.rasterTile.create({
              data: {
                sceneId: scene.id,
                z, x: tileX, y: tileY, quadkey,
                storageKey: `satellite/tiles/${scene.id}/${z}/${tileX}/${tileY}.png`,
                sizeBytes: Math.floor(10 + Math.random() * 30) * 1024,
                contentType: "image/png",
                cacheStatus: sd.status === "archived" ? "stale" : "cached",
                cachedAt: sd.acquisitionDate,
                expiresAt: new Date(sd.acquisitionDate.getTime() + 7 * 24 * 60 * 60 * 1000),
                accessCount: Math.floor(Math.random() * 50),
                lastAccessedAt: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)),
                bands: JSON.stringify(["B04","B03","B02"]),
                checksum: createHash("sha256").update(`${scene.id}-${z}-${tileX}-${tileY}`).digest("hex"),
              },
            }).catch(() => {});
            tileCount++;
          }
        }
      }
    }
  }

  // Update cache stats
  const totalTiles = await prisma.rasterTile.count();
  const cachedTiles = await prisma.rasterTile.count({ where: { cacheStatus: "cached" } });
  const staleTiles = await prisma.rasterTile.count({ where: { cacheStatus: "stale" } });
  const totalSize = await prisma.rasterTile.aggregate({ _sum: { sizeBytes: true } });
  await prisma.tileCacheStats.create({
    data: {
      totalTiles, cachedTiles, staleTiles, evictedTiles: 0,
      totalCacheBytes: totalSize._sum.sizeBytes ?? 0,
      hitRate: totalTiles > 0 ? cachedTiles / totalTiles : 0,
      missRate: totalTiles > 0 ? staleTiles / totalTiles : 0,
      computedAt: new Date(),
    },
  }).catch(() => {});

  const scheduleCount = await prisma.ingestionSchedule.count();
  console.log(`[seed] Seeded ${sceneCount} satellite scenes, ${tileCount} raster tiles, ${scheduleCount} ingestion schedules.`);
}

// ---------------------------------------------------------------------------
// M21 — Fraud Detection AI seed data
// ---------------------------------------------------------------------------
// Creates realistic fraud alerts across all 7 fraud types, with signals,
// investigations, and user risk profiles. References real users, evidence,
// and missions from the platform.
// ---------------------------------------------------------------------------

async function seedFraudData() {
  // Get real users to reference
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, createdAt: true },
    take: 10,
  });
  if (users.length < 3) {
    console.log("[seed] Not enough users for fraud seed — skipping.");
    return;
  }

  // Get real evidence to reference
  const evidence = await prisma.evidence.findMany({
    select: { id: true, key: true, checksum: true, uploadedById: true, lat: true, lng: true, createdAt: true, metadata: true },
    take: 20,
  });

  // Get real missions to reference
  const missions = await prisma.mission.findMany({
    select: { id: true, key: true, assignedToId: true, actualReward: true },
    take: 10,
  });

  // Check if fraud data already exists
  const existing = await prisma.fraudAlert.count();
  if (existing > 0) {
    console.log(`[seed] Fraud data already exists (${existing} alerts) — skipping.`);
    return;
  }

  const admin = users[0]!;
  const user1 = users[1] ?? admin;
  const user2 = users[2] ?? user1;
  const user3 = users[3] ?? user2;
  const user4 = users[4] ?? user3;
  const user5 = users[5] ?? user4;

  const now = new Date();
  const hoursAgo = (n: number) => new Date(now.getTime() - n * 60 * 60 * 1000);
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  type AlertSeed = {
    key: string;
    type: string;
    severity: string;
    status: string;
    title: string;
    description: string;
    confidence: number;
    riskScore: number;
    targetUserId?: string;
    targetUserIds?: string[];
    targetEntityIds?: string[];
    estimatedImpactGHS?: number;
    detectedAt: Date;
    resolvedAt?: Date;
    resolution?: string;
    signals: Array<{
      signalType: string;
      detector: string;
      confidence: number;
      weight: number;
      description: string;
      evidence?: Record<string, unknown>;
    }>;
    investigation?: {
      status: string;
      recommendedAction?: string;
      penaltyApplied?: number;
      rewardsRevoked?: number;
      notes?: string;
    };
  };

  // Build the 7 fraud alerts — one per fraud type, with realistic signals
  // referencing real platform data.
  const ev1 = evidence[0];
  const ev2 = evidence[1] ?? ev1;
  const ev3 = evidence[2] ?? ev2;
  const mission1 = missions[0];

  const alerts: AlertSeed[] = [
    // 1. FAKE EVIDENCE — duplicate hash across users
    {
      key: "fraud-fake-evidence-dup-001",
      type: "fake_evidence",
      severity: "high",
      status: "investigating",
      title: "Fake Evidence: Duplicate content hash across users",
      description: `Identical SHA-256 content hash detected in evidence uploaded by 2 different users. The same image was submitted as separate evidence items, suggesting image reuse to inflate evidence counts.`,
      confidence: 0.92,
      riskScore: 0.85,
      targetUserId: user1.id,
      targetUserIds: [user1.id, user2.id],
      targetEntityIds: ev1 ? [ev1.id, ev2?.id].filter(Boolean) as string[] : [],
      detectedAt: hoursAgo(6),
      signals: [
        {
          signalType: "hash_duplicate",
          detector: "detectFakeEvidence",
          confidence: 0.95,
          weight: 0.95,
          description: `Identical content hash (${ev1?.checksum.slice(0, 12) ?? "abc123def456"}…) found in 2 evidence items uploaded by ${user1.name} and ${user2.name}`,
          evidence: { checksum: ev1?.checksum, evidenceIds: [ev1?.id, ev2?.id].filter(Boolean), userIds: [user1.id, user2.id] },
        },
        {
          signalType: "metadata_mismatch",
          detector: "detectFakeEvidence",
          confidence: 0.7,
          weight: 0.7,
          description: `Evidence "${ev1?.key ?? "evd-001"}" EXIF capture time differs from upload time by 14 days — possible stale image reuse`,
          evidence: { evidenceId: ev1?.id, timeDeltaDays: 14 },
        },
      ],
      investigation: {
        status: "in_progress",
        recommendedAction: "revoke_rewards",
        notes: "Reviewing upload IPs and device fingerprints to confirm single-operator hypothesis.",
      },
    },
    // 2. COLLUSION — circular corroboration ring
    {
      key: "fraud-collusion-ring-001",
      type: "collusion",
      severity: "high",
      status: "confirmed",
      title: "Collusion: 3-user circular corroboration ring",
      description: `Three users form a closed corroboration ring: ${user1.name} → ${user2.name} → ${user3.name} → ${user1.name}. They only support each other's evidence and never corroborate outside the ring. Coordinated timestamps suggest single operator.`,
      confidence: 0.88,
      riskScore: 0.78,
      targetUserId: user1.id,
      targetUserIds: [user1.id, user2.id, user3.id],
      detectedAt: daysAgo(1),
      signals: [
        {
          signalType: "circular_corroboration",
          detector: "detectCollusion",
          confidence: 0.9,
          weight: 0.9,
          description: `Circular corroboration ring: ${user1.name} → ${user2.name} → ${user3.name} → ${user1.name} — 3 users only support each other`,
          evidence: { cycle: [user1.id, user2.id, user3.id], userCount: 3 },
        },
        {
          signalType: "coordinated_voting",
          detector: "detectCollusion",
          confidence: 0.8,
          weight: 0.8,
          description: `Corroboration timestamps show all 3 users supporting within 4-minute windows — coordinated action`,
          evidence: { timeSpanMinutes: 4, userCount: 3 },
        },
      ],
      investigation: {
        status: "closed",
        recommendedAction: "warn_user",
        penaltyApplied: 0.15,
        notes: "All 3 users warned. Trust scores reduced by 15%. Monitoring for recurrence.",
      },
    },
    // 3. SOCKPUPPET — shared device
    {
      key: "fraud-sockpuppet-device-001",
      type: "sockpuppet",
      severity: "medium",
      status: "investigating",
      title: "Sockpuppet: 2 accounts on single trusted device",
      description: `Two user accounts (${user1.name} and ${user4.name}) have both logged in from the same trusted device fingerprint. Activity timing is correlated — user4 always logs in within 5 minutes of user1 logging out. Likely a single operator controlling both accounts.`,
      confidence: 0.82,
      riskScore: 0.65,
      targetUserId: user1.id,
      targetUserIds: [user1.id, user4.id],
      detectedAt: daysAgo(2),
      signals: [
        {
          signalType: "shared_device",
          detector: "detectSockpuppets",
          confidence: 0.85,
          weight: 0.85,
          description: `2 user accounts logged in from the same trusted device (fingerprint: dev-fp-7a3b…) — likely single operator`,
          evidence: { deviceFingerprint: "dev-fp-7a3b91", userIds: [user1.id, user4.id] },
        },
        {
          signalType: "timing_pattern",
          detector: "detectSockpuppets",
          confidence: 0.65,
          weight: 0.65,
          description: `Correlated login timing: user4 logs in within 5 min of user1 logging out (12 occurrences observed)`,
          evidence: { correlatedLogins: 12, avgDelayMinutes: 5 },
        },
      ],
      investigation: {
        status: "in_progress",
        recommendedAction: "suspend_user",
        notes: "Awaiting identity verification documents from both accounts.",
      },
    },
    // 4. LOCATION SPOOFING — impossible travel
    {
      key: "fraud-location-spoof-001",
      type: "location_spoofing",
      severity: "medium",
      status: "detected",
      title: "Location Spoofing: Impossible travel between submissions",
      description: `User ${user2.name} submitted evidence from Prestea (5.43°N, 2.14°W) and 23 minutes later from Obuasi (6.20°N, 1.68°W) — 152 km apart. This requires 396 km/h ground speed, which is physically impossible.`,
      confidence: 0.90,
      riskScore: 0.72,
      targetUserId: user2.id,
      targetUserIds: [user2.id],
      targetEntityIds: ev2 ? [ev2.id, ev3?.id].filter(Boolean) as string[] : [],
      detectedAt: daysAgo(3),
      signals: [
        {
          signalType: "impossible_travel",
          detector: "detectLocationSpoofing",
          confidence: 0.9,
          weight: 0.9,
          description: `User traveled 152 km in 0.38 hours (396 km/h — physically impossible) between evidence submissions`,
          evidence: {
            userId: user2.id,
            fromLat: 5.43, fromLng: -2.14,
            toLat: 6.20, toLng: -1.68,
            distanceKm: 152,
            timeHours: 0.38,
            speedKmh: 396,
          },
        },
        {
          signalType: "gps_metadata_mismatch",
          detector: "detectLocationSpoofing",
          confidence: 0.75,
          weight: 0.8,
          description: `Evidence GPS coordinates don't match the user's session IP geolocation (IP geo: Kumasi, GPS: Prestea)`,
          evidence: { userId: user2.id, ipGeoCity: "Kumasi", gpsLocation: "Prestea" },
        },
      ],
    },
    // 5. DEEPFAKE — AI artifact in image
    {
      key: "fraud-deepfake-ai-001",
      type: "deepfake",
      severity: "critical",
      status: "escalated",
      title: "Deepfake: AI-generated image with Midjourney signature",
      description: `Evidence image uploaded by ${user3.name} contains AI generation tool signatures in metadata. The image was likely generated by Midjourney and submitted as a "real" photo of illegal mining. No EXIF data present (real phone photos always have EXIF).`,
      confidence: 0.94,
      riskScore: 0.92,
      targetUserId: user3.id,
      targetUserIds: [user3.id],
      targetEntityIds: ev3 ? [ev3.id] : [],
      detectedAt: hoursAgo(12),
      signals: [
        {
          signalType: "ai_artifact",
          detector: "detectDeepfakes",
          confidence: 0.9,
          weight: 0.85,
          description: `Evidence metadata contains AI generation tool signature: "midjourney"`,
          evidence: { evidenceId: ev3?.id, tool: "midjourney" },
        },
        {
          signalType: "facial_inconsistency",
          detector: "detectDeepfakes",
          confidence: 0.85,
          weight: 0.8,
          description: `Evidence image processed with image editing software (Adobe Photoshop CC 2024) — manipulation detected`,
          evidence: { evidenceId: ev3?.id, software: "Adobe Photoshop CC 2024" },
        },
        {
          signalType: "ai_artifact",
          detector: "detectDeepfakes",
          confidence: 0.65,
          weight: 0.7,
          description: `No EXIF metadata present — real photos taken with cameras/phones embed EXIF. Possible AI-generated image.`,
          evidence: { evidenceId: ev3?.id, hasExif: false },
        },
      ],
      investigation: {
        status: "pending_review",
        recommendedAction: "escalate_to_admin",
        notes: "Critical: AI-generated evidence submitted. Escalating to admin for account suspension review.",
      },
    },
    // 6. VOTE RING — coordinated corroboration
    {
      key: "fraud-vote-ring-001",
      type: "vote_ring",
      severity: "high",
      status: "confirmed",
      title: "Vote Ring: 4 users corroborating within 8-minute windows",
      description: `Four users corroborated the same evidence item within 8 minutes — typical organic corroboration spans hours or days. All 4 users share the same organization and have corroborated each other 23 times in the past month.`,
      confidence: 0.85,
      riskScore: 0.80,
      targetUserId: user1.id,
      targetUserIds: [user1.id, user2.id, user3.id, user5.id],
      targetEntityIds: ev1 ? [ev1.id] : [],
      detectedAt: daysAgo(4),
      resolvedAt: daysAgo(2),
      resolution: "user_warned",
      signals: [
        {
          signalType: "coordinated_voting",
          detector: "detectVoteRings",
          confidence: 0.8,
          weight: 0.8,
          description: `4 users corroborated evidence within 8 minutes — coordinated voting pattern`,
          evidence: {
            userIds: [user1.id, user2.id, user3.id, user5.id],
            timeSpanMinutes: 8,
            supportCount: 4,
          },
        },
        {
          signalType: "circular_corroboration",
          detector: "detectVoteRings",
          confidence: 0.85,
          weight: 0.9,
          description: `4 users form a circular support pattern — they only corroborate each other's evidence (23 mutual supports in 30 days)`,
          evidence: { cycle: [user1.id, user2.id, user3.id, user5.id], mutualSupports: 23, periodDays: 30 },
        },
      ],
      investigation: {
        status: "closed",
        recommendedAction: "warn_user",
        penaltyApplied: 0.2,
        notes: "All 4 users warned. Trust scores reduced by 20%. Corroborations invalidated.",
      },
    },
    // 7. REWARD FARMING — bulk low-quality submissions
    {
      key: "fraud-reward-farming-001",
      type: "reward_farming",
      severity: "medium",
      status: "detected",
      title: "Reward Farming: 12 low-quality evidence submissions",
      description: `User ${user5.name} submitted 12 evidence items in 7 days, of which 9 (75%) were rated low-quality (weight < 0.4). Pattern consistent with reward farming — submitting high volume of low-effort evidence to accumulate reward pool share.`,
      confidence: 0.78,
      riskScore: 0.68,
      targetUserId: user5.id,
      targetUserIds: [user5.id],
      estimatedImpactGHS: 600,
      detectedAt: hoursAgo(18),
      signals: [
        {
          signalType: "low_quality_spam",
          detector: "detectRewardFarming",
          confidence: 0.78,
          weight: 0.7,
          description: `User submitted 12 evidence items with 75% rated low-quality (avg weight 0.28) — reward farming pattern`,
          evidence: {
            userId: user5.id,
            totalSubmissions: 12,
            lowQualityCount: 9,
            lowQualityPct: 0.75,
            avgWeight: 0.28,
          },
        },
        {
          signalType: "bulk_submission",
          detector: "detectRewardFarming",
          confidence: 0.6,
          weight: 0.6,
          description: `12 evidence items submitted in 7 days — abnormally high volume (platform avg: 1.5/week)`,
          evidence: { userId: user5.id, submissionCount: 12, periodDays: 7, platformAvg: 1.5 },
        },
        {
          signalType: "repeated_evidence",
          detector: "detectRewardFarming",
          confidence: 0.85,
          weight: 0.85,
          description: `Same evidence (${ev3?.id?.slice(0, 8) ?? "abc12345"}…) submitted to 3 different missions — reusing evidence to farm rewards`,
          evidence: mission1 ? {
            evidenceId: ev3?.id,
            missionIds: [mission1.id],
            totalRewardEarned: mission1.actualReward ?? 150,
          } : { evidenceId: ev3?.id },
        },
      ],
    },
  ];

  let alertCount = 0;
  let signalCount = 0;
  let investigationCount = 0;

  for (const a of alerts) {
    const alert = await prisma.fraudAlert.create({
      data: {
        key: a.key,
        type: a.type,
        severity: a.severity,
        status: a.status,
        title: a.title,
        description: a.description,
        confidence: a.confidence,
        riskScore: a.riskScore,
        targetUserId: a.targetUserId,
        targetUserIds: a.targetUserIds ? JSON.stringify(a.targetUserIds) : null,
        targetEntityIds: a.targetEntityIds ? JSON.stringify(a.targetEntityIds) : null,
        signalCount: a.signals.length,
        estimatedImpactGHS: a.estimatedImpactGHS ?? 0,
        model: "fraud-ai-v1",
        detectorVersion: "1.0.0",
        metadata: JSON.stringify({ seed: true, detectorCount: a.signals.length }),
        detectedAt: a.detectedAt,
        resolvedAt: a.resolvedAt,
        resolution: a.resolution,
      },
    });
    alertCount++;

    // Create signals
    for (const s of a.signals) {
      await prisma.fraudSignal.create({
        data: {
          alertId: alert.id,
          signalType: s.signalType,
          detector: s.detector,
          confidence: s.confidence,
          weight: s.weight,
          description: s.description,
          evidence: s.evidence ? JSON.stringify(s.evidence) : null,
        },
      });
      signalCount++;
    }

    // Create investigation if specified
    if (a.investigation) {
      await prisma.fraudInvestigation.create({
        data: {
          alertId: alert.id,
          status: a.investigation.status,
          assignedToId: admin.id,
          recommendedAction: a.investigation.recommendedAction,
          penaltyApplied: a.investigation.penaltyApplied ?? 0,
          rewardsRevoked: a.investigation.rewardsRevoked ?? 0,
          notes: a.investigation.notes,
          openedAt: a.detectedAt,
          closedAt: a.investigation.status === "closed" ? (a.resolvedAt ?? now) : null,
        },
      });
      investigationCount++;
    }
  }

  // Create user risk profiles for all targeted users
  const allTargetUsers = new Set<string>();
  for (const a of alerts) {
    if (a.targetUserId) allTargetUsers.add(a.targetUserId);
    if (a.targetUserIds) for (const u of a.targetUserIds) allTargetUsers.add(u);
  }

  let profileCount = 0;
  for (const userId of allTargetUsers) {
    const userAlerts = alerts.filter(
      (a) => a.targetUserId === userId || (a.targetUserIds ?? []).includes(userId),
    );
    const confirmedCount = userAlerts.filter((a) => a.status === "confirmed").length;
    const dismissedCount = userAlerts.filter((a) => a.status === "dismissed").length;
    const avgRisk = userAlerts.reduce((s, a) => s + a.riskScore, 0) / (userAlerts.length || 1);
    const riskLevel = avgRisk >= 0.85 ? "critical" : avgRisk >= 0.6 ? "high_risk" : avgRisk >= 0.4 ? "moderate_risk" : avgRisk >= 0.2 ? "low_risk" : "clean";
    const trustPenalty = confirmedCount > 0 ? Math.min(1, confirmedCount * 0.2 + avgRisk * 0.3) : 0;

    const signalsByType: Record<string, number> = {};
    for (const a of userAlerts) {
      signalsByType[a.type] = (signalsByType[a.type] ?? 0) + a.signals.length;
    }

    await prisma.userRiskProfile.create({
      data: {
        userId,
        riskScore: Math.round(avgRisk * 100) / 100,
        riskLevel,
        alertCount: userAlerts.length,
        confirmedAlertCount: confirmedCount,
        dismissedAlertCount: dismissedCount,
        signalsByType: JSON.stringify(signalsByType),
        trustPenalty: Math.round(trustPenalty * 100) / 100,
        rewardsRevoked: 0,
        factors: JSON.stringify({
          alertCount: userAlerts.length,
          confirmedCount,
          dismissedCount,
          signalsByType,
        }),
        lastAlertAt: userAlerts[0]?.detectedAt ?? now,
        lastCalculatedAt: now,
      },
    }).catch(() => {});
    profileCount++;
  }

  console.log(`[seed] Seeded ${alertCount} fraud alerts, ${signalCount} signals, ${investigationCount} investigations, ${profileCount} user risk profiles.`);
}

// ---------------------------------------------------------------------------
// M22 — Government Operations Center seed data
// ---------------------------------------------------------------------------
// Creates investigations, inspections, cases with realistic workflow steps,
// findings, and events. References real intelligence events, twin entities,
// and fraud alerts from the platform.
// ---------------------------------------------------------------------------

async function seedGovernmentData() {
  // Check if government data already exists
  const existing = await prisma.investigation.count();
  if (existing > 0) {
    console.log(`[seed] Government data already exists (${existing} investigations) — skipping.`);
    return;
  }

  // Get real users and orgs to reference
  const users = await prisma.user.findMany({ select: { id: true, name: true, email: true }, take: 10 });
  const orgs = await prisma.organization.findMany({ select: { id: true, key: true, name: true, type: true, region: true }, take: 10 });
  const intelEvents = await prisma.intelligenceEvent.findMany({ select: { id: true, key: true, title: true, type: true, severity: true, lat: true, lng: true, locationName: true }, take: 10 });
  const twinEntities = await prisma.twinEntity.findMany({ select: { id: true, key: true, name: true, type: true, lat: true, lng: true }, take: 10 });
  const fraudAlerts = await prisma.fraudAlert.findMany({ select: { id: true, key: true, type: true, title: true, targetUserId: true }, take: 10 });

  if (users.length < 2 || orgs.length < 1) {
    console.log("[seed] Not enough users/orgs for government seed — skipping.");
    return;
  }

  const admin = users[0]!;
  const inspector = users.find((u) => u.email?.includes("inspector")) ?? users[1]!;
  const moderator = users.find((u) => u.email?.includes("moderator")) ?? users[2]!;

  const epa = orgs.find((o) => o.key === "epa-ghana") ?? orgs[0]!;
  const minerals = orgs.find((o) => o.key === "minerals-commission-gh") ?? orgs[1]!;

  const now = new Date();
  const hoursAgo = (n: number) => new Date(now.getTime() - n * 60 * 60 * 1000);
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  // Helper to find an intel event by type
  const findEvent = (type: string) => intelEvents.find((e) => e.type === type) ?? intelEvents[0];
  const findTwin = (type: string) => twinEntities.find((e) => e.type === type) ?? twinEntities[0];

  // ===========================================================================
  // INVESTIGATIONS — 5 across different regions, types, statuses
  // ===========================================================================
  const investigationsData = [
    {
      key: "inv-prestea-galamsey-001",
      title: "Prestea Galamsey Complex Investigation",
      description: "Large-scale illegal mining operation at Prestea Galamsey Site A. Multiple excavators, mercury processing, and water diversion detected via satellite imagery and citizen reports.",
      type: "illegal_mining",
      priority: "urgent",
      triggerType: "satellite_change",
      triggerDescription: "Sentinel-2 imagery detected 12.4 hectares of new excavation between 2024-06-01 and 2024-07-15.",
      lat: 5.4321, lng: -2.1456,
      locationName: "Prestea Galamsey Site A",
      region: "Western", district: "Prestea-Huni Valley",
      level: "regional",
      agencyId: epa.id, agencyName: epa.name,
      leadInvestigatorId: inspector.id, leadInvestigatorName: inspector.name,
      intelligenceEventId: findEvent("illegal_mining")?.id,
      twinEntityId: findTwin("mine")?.id,
      estimatedImpactGHS: 450000,
      status: "investigating",
      steps: [
        { stepType: "opened", title: "Investigation Opened", description: "Formal investigation opened following satellite change detection.", outcome: "Case file created", daysAgo: 14 },
        { stepType: "site_visited", title: "Site Visit Conducted", description: "EPA inspectors visited the site on 2024-07-20. Observed 3 active excavators, mercury processing pool, and diverted stream.", outcome: "3 violations documented", daysAgo: 10 },
        { stepType: "evidence_collected", title: "Evidence Collected", description: "Water samples, soil samples, drone photos, and GPS tracks collected.", outcome: "12 evidence items catalogued", daysAgo: 8 },
        { stepType: "witness_interviewed", title: "Witness Interviewed", description: "Local farmer Kwame T. interviewed — reported 6 months of activity, ~20 workers, nighttime operations.", outcome: "Statement recorded", daysAgo: 5 },
        { stepType: "lab_analysis", title: "Lab Analysis Ordered", description: "Water and soil samples sent to Ghana EPA lab for mercury and heavy metal analysis.", outcome: "Results pending", daysAgo: 3 },
      ],
    },
    {
      key: "inv-obuasi-mercury-002",
      title: "Obuasi Mercury Contamination Investigation",
      description: "Mercury contamination of the Oda River traced to illegal processing site at Obuasi Illegal Pit. Downstream communities at risk.",
      type: "mercury_use",
      priority: "high",
      triggerType: "citizen_report",
      triggerDescription: "WACAM field agent reported mercury smell and turbid water at Oda River crossing near Obuasi.",
      lat: 6.2062, lng: -1.6678,
      locationName: "Obuasi Illegal Pit",
      region: "Ashanti", district: "Obuasi Municipal",
      level: "regional",
      agencyId: minerals.id, agencyName: minerals.name,
      leadInvestigatorId: inspector.id, leadInvestigatorName: inspector.name,
      intelligenceEventId: findEvent("water_contamination")?.id,
      twinEntityId: findTwin("river")?.id,
      estimatedImpactGHS: 180000,
      status: "pending_review",
      steps: [
        { stepType: "opened", title: "Investigation Opened", description: "Opened following citizen complaint via WACAM.", outcome: "Case file created", daysAgo: 21 },
        { stepType: "site_visited", title: "Site Visit Conducted", description: "Minerals Commission inspector visited. Confirmed mercury processing with retorts.", outcome: "2 violations documented", daysAgo: 18 },
        { stepType: "evidence_collected", title: "Evidence Collected", description: "Water samples (4), soil samples (3), mercury residue photos.", outcome: "7 evidence items", daysAgo: 15 },
        { stepType: "lab_analysis", title: "Lab Analysis Complete", description: "Mercury levels: 4.2 µg/L (WHO limit: 1.0 µg/L). Lead: 0.8 mg/L.", outcome: "4× WHO mercury limit confirmed", daysAgo: 7 },
        { stepType: "report_filed", title: "Investigation Report Filed", description: "Full report filed with Minerals Commission regional office.", outcome: "Pending supervisor review", daysAgo: 3 },
      ],
    },
    {
      key: "inv-kibi-deforestation-003",
      title: "Atewa Forest Encroachment Investigation",
      description: "Illegal mining encroachment into Atewa Forest Reserve. Satellite imagery shows 8.7 hectares of forest loss within protected boundary.",
      type: "deforestation",
      priority: "urgent",
      triggerType: "cv_detection",
      triggerDescription: "Computer Vision detected forest_loss with 91% confidence in Atewa Forest Reserve sector 3.",
      lat: 6.1667, lng: -0.5500,
      locationName: "Atewa Forest Reserve — Sector 3",
      region: "Eastern", district: "Kwaebibirem",
      level: "national",
      agencyId: epa.id, agencyName: epa.name,
      leadInvestigatorId: admin.id, leadInvestigatorName: admin.name,
      intelligenceEventId: findEvent("deforestation")?.id,
      twinEntityId: findTwin("forest")?.id,
      estimatedImpactGHS: 820000,
      status: "escalated",
      steps: [
        { stepType: "opened", title: "Investigation Opened", description: "Escalated to national level due to protected forest status.", outcome: "National case file", daysAgo: 18 },
        { stepType: "site_visited", title: "Site Visit Conducted", description: "Joint EPA + Forestry Commission visit. Confirmed 8.7 ha clearing, 2 active pits.", outcome: "Critical violations", daysAgo: 14 },
        { stepType: "evidence_collected", title: "Evidence Collected", description: "Drone survey, GPS boundary mapping, before/after satellite comparison.", outcome: "15 evidence items", daysAgo: 10 },
        { stepType: "escalated", title: "Escalated to National", description: "Escalated to EPA Director-General and Ministry of Lands.", outcome: "Ministerial briefing scheduled", daysAgo: 5 },
      ],
    },
    {
      key: "inv-dunkwa-water-004",
      title: "Dunkwa Alluvial Mining Water Pollution",
      description: "Offin River turbidity increased 340% downstream of Dunkwa Mining Complex. Alluvial mining operations discharging sediment directly into river.",
      type: "water_pollution",
      priority: "high",
      triggerType: "intelligence_event",
      triggerDescription: "Community intelligence event reported fish kills and brown water at Offin River bend.",
      lat: 5.9783, lng: -1.7822,
      locationName: "Dunkwa Mining Complex",
      region: "Central", district: "Upper Denkyira East",
      level: "regional",
      agencyId: epa.id, agencyName: epa.name,
      leadInvestigatorId: inspector.id, leadInvestigatorName: inspector.name,
      intelligenceEventId: findEvent("water_contamination")?.id,
      twinEntityId: findTwin("river")?.id,
      estimatedImpactGHS: 220000,
      status: "investigating",
      steps: [
        { stepType: "opened", title: "Investigation Opened", description: "Opened following community intelligence event.", outcome: "Case file created", daysAgo: 9 },
        { stepType: "site_visited", title: "Site Visit Conducted", description: "EPA inspector visited. Confirmed sediment discharge, 3 unlicensed operations.", outcome: "3 violations", daysAgo: 6 },
        { stepType: "evidence_collected", title: "Evidence Collected", description: "Water samples upstream/downstream, turbidity measurements, photos.", outcome: "9 evidence items", daysAgo: 4 },
      ],
    },
    {
      key: "inv-tarkwa-equipment-005",
      title: "Tarkwa Nsuaem Unlicensed Equipment Seizure",
      description: "Investigation into unlicensed mining equipment (2 excavators, 1 washing plant) at Tarkwa Nsuaem cluster. Operator lacks mining license.",
      type: "illegal_mining",
      priority: "medium",
      triggerType: "mission_result",
      triggerDescription: "M19 mission verified unlicensed equipment operation with excellent quality evidence.",
      lat: 5.3056, lng: -1.9933,
      locationName: "Tarkwa Nsuaem Cluster",
      region: "Western", district: "Tarkwa-Nsuaem",
      level: "district",
      agencyId: minerals.id, agencyName: minerals.name,
      leadInvestigatorId: inspector.id, leadInvestigatorName: inspector.name,
      intelligenceEventId: findEvent("illegal_mining")?.id,
      twinEntityId: findTwin("mine")?.id,
      estimatedImpactGHS: 75000,
      status: "closed",
      steps: [
        { stepType: "opened", title: "Investigation Opened", description: "Opened following mission evidence submission.", outcome: "Case file created", daysAgo: 30 },
        { stepType: "site_visited", title: "Site Visit Conducted", description: "Minerals Commission inspector confirmed unlicensed equipment.", outcome: "2 excavators, 1 washing plant", daysAgo: 25 },
        { stepType: "evidence_collected", title: "Evidence Collected", description: "Equipment photos, serial numbers, operator interview.", outcome: "6 evidence items", daysAgo: 22 },
        { stepType: "reviewed", title: "Review Complete", description: "Legal review confirmed violation of Minerals and Mining Act.", outcome: "Equipment seizure recommended", daysAgo: 15 },
        { stepType: "closed", title: "Case Closed", description: "Equipment seized, operator fined ₵45,000.", outcome: "Resolved — fine imposed", daysAgo: 8 },
      ],
      resolution: "fine_imposed",
      resolutionNotes: "Equipment seized by Minerals Commission. Operator fined ₵45,000 and issued warning. Case closed.",
    },
  ];

  let invCount = 0;
  let stepCount = 0;
  const createdInvestigations: string[] = [];

  for (const inv of investigationsData) {
    const steps = inv.steps;
    const { steps: _steps, resolution, resolutionNotes, ...invData } = inv;
    const created = await prisma.investigation.create({
      data: {
        ...invData,
        assignedAt: invData.leadInvestigatorId ? daysAgo(20) : null,
        findings: null,
        recommendedAction: invData.status === "pending_review" ? "fine" : invData.status === "escalated" ? "prosecution" : invData.status === "closed" ? "fine" : null,
        closedAt: invData.status === "closed" ? daysAgo(8) : null,
        closedById: invData.status === "closed" ? admin.id : null,
        resolution: resolution ?? null,
        resolutionNotes: resolutionNotes ?? null,
        metadata: JSON.stringify({ seed: true }),
      },
    });
    invCount++;
    createdInvestigations.push(created.id);

    for (const s of steps) {
      await prisma.investigationStep.create({
        data: {
          investigationId: created.id,
          stepType: s.stepType,
          title: s.title,
          description: s.description,
          performedById: invData.leadInvestigatorId,
          performedByName: invData.leadInvestigatorName,
          outcome: s.outcome,
          performedAt: daysAgo(s.daysAgo),
        },
      });
      stepCount++;
    }
  }

  // ===========================================================================
  // INSPECTIONS — 6 with findings
  // ===========================================================================
  const inspectionsData = [
    {
      key: "insp-prestea-2024-001",
      title: "Prestea Site A Field Inspection",
      description: "Field inspection of Prestea Galamsey Site A following satellite change detection.",
      type: "complaint_based",
      status: "completed",
      investigationId: createdInvestigations[0],
      targetName: "Prestea Galamsey Site A",
      targetType: "mining_site",
      twinEntityId: findTwin("mine")?.id,
      lat: 5.4321, lng: -2.1456,
      locationName: "Prestea Galamsey Site A",
      region: "Western", district: "Prestea-Huni Valley",
      scheduledAt: daysAgo(11), conductedAt: daysAgo(10), completedAt: daysAgo(10),
      inspectorId: inspector.id, inspectorName: inspector.name,
      agencyId: epa.id, agencyName: epa.name,
      complianceLevel: "critical_violations",
      violationCount: 4,
      overallResult: "shutdown",
      followUpRequired: true,
      followUpDate: daysAgo(-7),
      findings: [
        { findingType: "excavation", severity: "critical", description: "3 unlicensed excavators operating within 50m of Pra River tributary.", violation: "Minerals and Mining Act §70", penalty: "Equipment seizure" },
        { findingType: "mercury_use", severity: "critical", description: "Mercury processing pool with visible mercury droplets. No retort or containment.", violation: "Mercury Act §5", penalty: "Immediate shutdown" },
        { findingType: "water_pollution", severity: "high", description: "Sediment-laden discharge directly into stream. Turbidity 480 NTU (limit: 50 NTU).", violation: "EPA Act §12", penalty: "₵80,000 fine" },
        { findingType: "worker_safety", severity: "medium", description: "Workers without PPE. No safety signage. Open pit without barriers.", violation: "Factories Act §15", penalty: "₵15,000 fine" },
      ],
    },
    {
      key: "insp-obuasi-2024-002",
      title: "Obuasi Mercury Processing Inspection",
      description: "Inspection of mercury processing site at Obuasi Illegal Pit.",
      type: "complaint_based",
      status: "completed",
      investigationId: createdInvestigations[1],
      targetName: "Obuasi Illegal Pit",
      targetType: "mining_site",
      twinEntityId: findTwin("mine")?.id,
      lat: 6.2062, lng: -1.6678,
      locationName: "Obuasi Illegal Pit",
      region: "Ashanti", district: "Obuasi Municipal",
      scheduledAt: daysAgo(19), conductedAt: daysAgo(18), completedAt: daysAgo(18),
      inspectorId: inspector.id, inspectorName: inspector.name,
      agencyId: minerals.id, agencyName: minerals.name,
      complianceLevel: "major_violations",
      violationCount: 2,
      overallResult: "violation_notice",
      followUpRequired: true,
      followUpDate: daysAgo(-14),
      findings: [
        { findingType: "mercury_use", severity: "critical", description: "Mercury retorts in operation. Mercury visible in processing trays.", violation: "Mercury Act §5", penalty: "Shutdown + ₵50,000 fine" },
        { findingType: "water_pollution", severity: "high", description: "Mercury-contaminated runoff entering Oda River. Lab: 4.2 µg/L Hg.", violation: "EPA Act §12", penalty: "₵30,000 fine" },
      ],
    },
    {
      key: "insp-atewa-2024-003",
      title: "Atewa Forest Reserve Sector 3 Inspection",
      description: "Joint EPA + Forestry Commission inspection of forest encroachment.",
      type: "emergency",
      status: "completed",
      investigationId: createdInvestigations[2],
      targetName: "Atewa Forest Reserve — Sector 3",
      targetType: "forest",
      twinEntityId: findTwin("forest")?.id,
      lat: 6.1667, lng: -0.5500,
      locationName: "Atewa Forest Reserve — Sector 3",
      region: "Eastern", district: "Kwaebibirem",
      scheduledAt: daysAgo(15), conductedAt: daysAgo(14), completedAt: daysAgo(14),
      inspectorId: admin.id, inspectorName: admin.name,
      agencyId: epa.id, agencyName: epa.name,
      complianceLevel: "critical_violations",
      violationCount: 3,
      overallResult: "prosecution_recommended",
      followUpRequired: true,
      followUpDate: daysAgo(-30),
      findings: [
        { findingType: "deforestation", severity: "critical", description: "8.7 hectares of protected forest cleared. Protected species (Mahogany, Odum) felled.", violation: "Forest Protection Act §8", penalty: "Prosecution" },
        { findingType: "excavation", severity: "high", description: "2 active mining pits within forest reserve boundary.", violation: "Minerals Act §70", penalty: "Shutdown + fine" },
        { findingType: "mercury_use", severity: "high", description: "Mercury processing detected within 200m of forest stream.", violation: "Mercury Act §5", penalty: "Prosecution" },
      ],
    },
    {
      key: "insp-dunkwa-2024-004",
      title: "Dunkwa Alluvial Site Compliance Check",
      description: "Compliance inspection of Dunkwa Mining Complex alluvial operations.",
      type: "compliance_check",
      status: "completed",
      investigationId: createdInvestigations[3],
      targetName: "Dunkwa Mining Complex",
      targetType: "mining_site",
      twinEntityId: findTwin("mine")?.id,
      lat: 5.9783, lng: -1.7822,
      locationName: "Dunkwa Mining Complex",
      region: "Central", district: "Upper Denkyira East",
      scheduledAt: daysAgo(7), conductedAt: daysAgo(6), completedAt: daysAgo(6),
      inspectorId: inspector.id, inspectorName: inspector.name,
      agencyId: epa.id, agencyName: epa.name,
      complianceLevel: "major_violations",
      violationCount: 3,
      overallResult: "violation_notice",
      followUpRequired: true,
      followUpDate: daysAgo(-21),
      findings: [
        { findingType: "water_pollution", severity: "high", description: "Sediment discharge into Offin River. Turbidity 340% above baseline.", violation: "EPA Act §12", penalty: "₵40,000 fine" },
        { findingType: "documentation", severity: "medium", description: "2 of 3 operators lack valid mining licenses.", violation: "Minerals Act §40", penalty: "License revocation" },
        { findingType: "excavation", severity: "medium", description: "Excavation outside licensed boundary by 80m.", violation: "Minerals Act §42", penalty: "₵15,000 fine" },
      ],
    },
    {
      key: "insp-tarkwa-2024-005",
      title: "Tarkwa Nsuaem Equipment Verification",
      description: "Verification of equipment licenses at Tarkwa Nsuaem cluster.",
      type: "compliance_check",
      status: "completed",
      investigationId: createdInvestigations[4],
      targetName: "Tarkwa Nsuaem Cluster",
      targetType: "mining_site",
      twinEntityId: findTwin("mine")?.id,
      lat: 5.3056, lng: -1.9933,
      locationName: "Tarkwa Nsuaem Cluster",
      region: "Western", district: "Tarkwa-Nsuaem",
      scheduledAt: daysAgo(26), conductedAt: daysAgo(25), completedAt: daysAgo(25),
      inspectorId: inspector.id, inspectorName: inspector.name,
      agencyId: minerals.id, agencyName: minerals.name,
      complianceLevel: "major_violations",
      violationCount: 2,
      overallResult: "violation_notice",
      followUpRequired: false,
      findings: [
        { findingType: "equipment", severity: "high", description: "2 excavators (CAT 320, CAT 330) without equipment registration.", violation: "Minerals Act §55", penalty: "Equipment seizure" },
        { findingType: "documentation", severity: "medium", description: "No mining license on file for operator.", violation: "Minerals Act §40", penalty: "₵45,000 fine" },
      ],
    },
    {
      key: "insp-bibiani-2024-006",
      title: "Bibiani North Routine Inspection",
      description: "Routine quarterly inspection of Bibiani North mining site.",
      type: "routine",
      status: "scheduled",
      investigationId: null,
      targetName: "Bibiani North Site",
      targetType: "mining_site",
      twinEntityId: findTwin("mine")?.id,
      lat: 6.4639, lng: -2.3322,
      locationName: "Bibiani North Site",
      region: "Western North", district: "Bibiani-Anhwiaso-Bekwai",
      scheduledAt: daysAgo(-3), conductedAt: null, completedAt: null,
      inspectorId: inspector.id, inspectorName: inspector.name,
      agencyId: epa.id, agencyName: epa.name,
      complianceLevel: null,
      violationCount: 0,
      overallResult: null,
      followUpRequired: false,
      findings: [],
    },
  ];

  let inspCount = 0;
  let findingCount = 0;

  for (const insp of inspectionsData) {
    const { findings, ...inspData } = insp;
    const created = await prisma.inspection.create({
      data: {
        ...inspData,
        metadata: JSON.stringify({ seed: true }),
      },
    });
    inspCount++;

    for (const f of findings) {
      await prisma.inspectionFinding.create({
        data: {
          inspectionId: created.id,
          findingType: f.findingType,
          severity: f.severity,
          description: f.description,
          violation: f.violation,
          penalty: f.penalty,
          resolved: inspData.status === "completed" && f.severity !== "critical",
        },
      });
      findingCount++;
    }
  }

  // ===========================================================================
  // CASES — 4 with linked investigations and events
  // ===========================================================================
  const casesData = [
    {
      key: "case-gha-2024-001",
      caseNumber: "EPA/2024/0142",
      title: "Republic v. Prestea Galamsey Syndicate",
      description: "Criminal case against Prestea galamsey operators for illegal mining, mercury use, and water pollution. 4 defendants.",
      type: "illegal_mining",
      priority: "urgent",
      level: "regional",
      region: "Western", district: "Prestea-Huni Valley",
      leadAgencyId: epa.id, leadAgencyName: epa.name,
      prosecutingAgencyId: epa.id, prosecutingAgencyName: "EPA Legal Division",
      defendantName: "Prestea Galamsey Syndicate (4 individuals)",
      defendantType: "cooperative",
      lat: 5.4321, lng: -2.1456,
      locationName: "Prestea Galamsey Site A",
      intelligenceEventId: findEvent("illegal_mining")?.id,
      twinEntityId: findTwin("mine")?.id,
      estimatedDamagesGHS: 450000,
      finesImposedGHS: 0,
      status: "active",
      investigationIds: [createdInvestigations[0]!],
      events: [
        { eventType: "filed", title: "Case Filed", description: "Case filed at Sekondi High Court.", daysAgo: 12 },
        { eventType: "assigned", title: "Judge Assigned", description: "Justice K. Mensah assigned to case.", daysAgo: 10 },
        { eventType: "evidence_submitted", title: "Evidence Bundle Submitted", description: "12 evidence items, lab results, and inspection report submitted.", daysAgo: 7 },
        { eventType: "hearing_scheduled", title: "Hearing Scheduled", description: "First hearing scheduled for 2024-08-15.", daysAgo: 5 },
      ],
    },
    {
      key: "case-gha-2024-002",
      caseNumber: "EPA/2024/0138",
      title: "Republic v. Obuasi Mercury Operators",
      description: "Case against Obuasi mercury processors. Mercury levels 4× WHO limit in Oda River.",
      type: "mercury_contamination",
      priority: "high",
      level: "regional",
      region: "Ashanti", district: "Obuasi Municipal",
      leadAgencyId: minerals.id, leadAgencyName: minerals.name,
      prosecutingAgencyId: minerals.id, prosecutingAgencyName: "Minerals Commission Legal",
      defendantName: "Obuasi Mercury Operators (2 individuals)",
      defendantType: "individual",
      lat: 6.2062, lng: -1.6678,
      locationName: "Obuasi Illegal Pit",
      intelligenceEventId: findEvent("water_contamination")?.id,
      twinEntityId: findTwin("river")?.id,
      estimatedDamagesGHS: 180000,
      finesImposedGHS: 0,
      status: "pending_hearing",
      investigationIds: [createdInvestigations[1]!],
      events: [
        { eventType: "filed", title: "Case Filed", description: "Case filed at Kumasi High Court.", daysAgo: 5 },
        { eventType: "assigned", title: "Judge Assigned", description: "Justice A. Owusu assigned.", daysAgo: 3 },
        { eventType: "hearing_scheduled", title: "Hearing Scheduled", description: "Hearing on 2024-08-20.", daysAgo: 1 },
      ],
    },
    {
      key: "case-gha-2024-003",
      caseNumber: "EPA/2024/0151",
      title: "Republic v. Atewa Forest Miners",
      description: "National-level case for protected forest encroachment. Prosecution for deforestation of Atewa Forest Reserve.",
      type: "deforestation",
      priority: "urgent",
      level: "national",
      region: "Eastern", district: "Kwaebibirem",
      leadAgencyId: epa.id, leadAgencyName: epa.name,
      prosecutingAgencyId: "attorney-general-ghana",
      prosecutingAgencyName: "Attorney General's Department",
      defendantName: "Atewa Miners (unknown individuals)",
      defendantType: "unknown",
      lat: 6.1667, lng: -0.5500,
      locationName: "Atewa Forest Reserve — Sector 3",
      intelligenceEventId: findEvent("deforestation")?.id,
      twinEntityId: findTwin("forest")?.id,
      estimatedDamagesGHS: 820000,
      finesImposedGHS: 0,
      status: "under_review",
      investigationIds: [createdInvestigations[2]!],
      events: [
        { eventType: "filed", title: "Case Filed", description: "Case filed at Accra High Court (national jurisdiction).", daysAgo: 4 },
        { eventType: "assigned", title: "Review Committee Assigned", description: "National review committee assigned due to protected area status.", daysAgo: 2 },
      ],
    },
    {
      key: "case-gha-2024-004",
      caseNumber: "MC/2024/0089",
      title: "Minerals Commission v. Tarkwa Equipment Operator",
      description: "Administrative case for unlicensed equipment. Equipment seized, operator fined.",
      type: "illegal_mining",
      priority: "medium",
      level: "district",
      region: "Western", district: "Tarkwa-Nsuaem",
      leadAgencyId: minerals.id, leadAgencyName: minerals.name,
      prosecutingAgencyId: minerals.id, prosecutingAgencyName: "Minerals Commission Legal",
      defendantName: "Tarkwa Equipment Operator",
      defendantType: "individual",
      lat: 5.3056, lng: -1.9933,
      locationName: "Tarkwa Nsuaem Cluster",
      intelligenceEventId: findEvent("illegal_mining")?.id,
      twinEntityId: findTwin("mine")?.id,
      estimatedDamagesGHS: 75000,
      finesImposedGHS: 45000,
      status: "closed",
      investigationIds: [createdInvestigations[4]!],
      events: [
        { eventType: "filed", title: "Case Filed", description: "Administrative case filed at Tarkwa District office.", daysAgo: 20 },
        { eventType: "evidence_submitted", title: "Evidence Submitted", description: "Equipment photos, serial numbers, inspection report.", daysAgo: 18 },
        { eventType: "ruling", title: "Ruling Issued", description: "Operator found liable. Equipment forfeited to state. Fine: ₵45,000.", daysAgo: 10 },
        { eventType: "closed", title: "Case Closed", description: "Fine paid. Equipment seized. Case closed.", daysAgo: 8 },
      ],
      resolution: "fined",
      resolutionNotes: "Equipment seized. Fine of ₵45,000 paid. Warning issued for future violations.",
    },
  ];

  let caseCount = 0;
  let eventCount = 0;

  for (const c of casesData) {
    const { events, investigationIds, resolution, resolutionNotes, ...caseData } = c;
    const created = await prisma.case.create({
      data: {
        ...caseData,
        closedAt: caseData.status === "closed" ? daysAgo(8) : null,
        resolution: resolution ?? null,
        resolutionNotes: resolutionNotes ?? null,
        metadata: JSON.stringify({ seed: true }),
      },
    });
    caseCount++;

    // Link investigations
    if (investigationIds) {
      for (const invId of investigationIds) {
        await prisma.caseInvestigation.create({
          data: { caseId: created.id, investigationId: invId, linkedById: admin.id },
        }).catch(() => {});
      }
    }

    // Create events
    for (const e of events) {
      await prisma.caseEvent.create({
        data: {
          caseId: created.id,
          eventType: e.eventType,
          title: e.title,
          description: e.description,
          performedById: admin.id,
          performedByName: admin.name,
          eventDate: daysAgo(e.daysAgo),
        },
      });
      eventCount++;
    }
  }

  console.log(`[seed] Seeded ${invCount} investigations (${stepCount} steps), ${inspCount} inspections (${findingCount} findings), ${caseCount} cases (${eventCount} events).`);
}

// ---------------------------------------------------------------------------
// M23 — Simulation Engine seed data
// ---------------------------------------------------------------------------
// Creates baseline + intervention scenarios using the real prediction model.
// References real hotspots, investigations, inspections, and predictions.
// ---------------------------------------------------------------------------

async function seedSimulationData() {
  // Check if simulation data already exists
  const existing = await prisma.simulationScenario.count();
  if (existing > 0) {
    console.log(`[seed] Simulation data already exists (${existing} scenarios) — skipping.`);
    return;
  }

  // Import the prediction model
  const { predictOutcomes, generateExplanation } = await import("../src/modules/simulation/domain/simulation-types");

  // Get real platform data for baseline context
  const [hotspots, investigations, inspections, envPredictions, twinEntities] = await Promise.all([
    prisma.hotspotPrediction.findMany({ select: { id: true, type: true, locationName: true, probability: true, riskLevel: true }, take: 20 }),
    prisma.investigation.findMany({ select: { id: true, type: true, region: true, estimatedImpactGHS: true }, take: 20 }),
    prisma.inspection.findMany({ select: { id: true, type: true, region: true, complianceLevel: true }, take: 20 }),
    prisma.environmentalPrediction.findMany({ select: { id: true, type: true, targetName: true, riskScore: true }, take: 20 }),
    prisma.twinEntity.findMany({ select: { id: true, name: true, type: true }, take: 20 }),
  ]);

  const admin = await prisma.user.findFirst({ select: { id: true } });

  type ScenarioSeed = {
    name: string;
    description: string;
    type: string;
    interventionParams: Record<string, number>;
    timeHorizonMonths: number;
    region: string;
    locationName: string;
    lat: number;
    lng: number;
    isBaseline: boolean;
  };

  // Define 7 scenarios: 1 baseline + 4 single interventions + 2 combined
  const scenariosData: ScenarioSeed[] = [
    {
      name: "Prestea Baseline — No Intervention",
      description: "Current trajectory with no policy changes. Illegal mining continues at current rates.",
      type: "baseline",
      interventionParams: {},
      timeHorizonMonths: 6,
      region: "Western",
      locationName: "Prestea Galamsey Complex",
      lat: 5.4321, lng: -2.1456,
      isBaseline: true,
    },
    {
      name: "Prestea: Increase Inspections by 50%",
      description: "What if we increase EPA inspection frequency by 50% and deploy 5 additional inspectors to the Prestea area?",
      type: "increase_inspections",
      interventionParams: { inspectionIncreasePct: 50, inspectorCount: 5 },
      timeHorizonMonths: 6,
      region: "Western",
      locationName: "Prestea Galamsey Complex",
      lat: 5.4321, lng: -2.1456,
      isBaseline: false,
    },
    {
      name: "Pra River: Protect Watershed (100m buffer, 5 rivers)",
      description: "What if we establish 100m protected buffer zones along 5 rivers in the Pra River watershed?",
      type: "protect_watershed",
      interventionParams: { bufferZoneM: 100, riversProtected: 5 },
      timeHorizonMonths: 6,
      region: "Central",
      locationName: "Pra River Watershed",
      lat: 5.2767, lng: -1.8767,
      isBaseline: false,
    },
    {
      name: "Prestea: Close 5 Access Roads + 3 Checkpoints",
      description: "What if we close the 5 main access roads to the Prestea galamsey sites and deploy 3 checkpoints?",
      type: "close_roads",
      interventionParams: { roadsClosed: 5, checkpointsDeployed: 3 },
      timeHorizonMonths: 6,
      region: "Western",
      locationName: "Prestea Access Network",
      lat: 5.4321, lng: -2.1456,
      isBaseline: false,
    },
    {
      name: "Atewa Forest: Deploy 3 Drones (100km² coverage)",
      description: "What if we deploy 3 surveillance drones over the Atewa Forest Reserve with 100km² coverage, patrolling 3× per week?",
      type: "deploy_drones",
      interventionParams: { droneCount: 3, coverageAreaKm2: 100, patrolFrequencyPerWeek: 3 },
      timeHorizonMonths: 6,
      region: "Eastern",
      locationName: "Atewa Forest Reserve",
      lat: 6.1667, lng: -0.5500,
      isBaseline: false,
    },
    {
      name: "Prestea: Combined Intervention (All 4)",
      description: "What if we combine all 4 interventions: +50% inspections, 5 rivers protected, 5 roads closed, 3 drones deployed?",
      type: "combined",
      interventionParams: { inspectionIncreasePct: 50, inspectorCount: 5, bufferZoneM: 100, riversProtected: 5, roadsClosed: 5, checkpointsDeployed: 3, droneCount: 3, coverageAreaKm2: 100, patrolFrequencyPerWeek: 3 },
      timeHorizonMonths: 6,
      region: "Western",
      locationName: "Prestea — Full Intervention",
      lat: 5.4321, lng: -2.1456,
      isBaseline: false,
    },
    {
      name: "Atewa Forest: Combined (Drones + Road Closures)",
      description: "What if we combine drone surveillance with road closures around Atewa Forest Reserve?",
      type: "combined",
      interventionParams: { roadsClosed: 4, checkpointsDeployed: 2, droneCount: 4, coverageAreaKm2: 150, patrolFrequencyPerWeek: 4 },
      timeHorizonMonths: 12,
      region: "Eastern",
      locationName: "Atewa Forest Reserve",
      lat: 6.1667, lng: -0.5500,
      isBaseline: false,
    },
  ];

  let scenarioCount = 0;

  for (const s of scenariosData) {
    // Filter investigations/inspections by region for local context (hotspots don't have region)
    const localHotspots = hotspots; // use all hotspots as spatial context
    const localInvestigations = investigations.filter((i) => i.region === s.region || !i.region);
    const localInspections = inspections.filter((i) => i.region === s.region || !i.region);

    const hotspotCount = Math.max(localHotspots.length, 3); // ensure non-zero

    // Predict outcomes using the real model
    const prediction = predictOutcomes({
      interventionType: s.type as any,
      interventionParams: s.interventionParams,
      timeHorizonMonths: s.timeHorizonMonths,
      hotspotCount,
      investigationCount: localInvestigations.length,
      inspectionCount: localInspections.length,
      region: s.region,
    });

    const explanation = generateExplanation({
      interventionType: s.type as any,
      timeHorizonMonths: s.timeHorizonMonths,
      locationName: s.locationName,
      metrics: prediction.metrics,
    });

    const key = `sim-${s.type}-${s.region.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${scenarioCount}`;

    await prisma.simulationScenario.create({
      data: {
        key,
        name: s.name,
        description: s.description,
        type: s.type,
        status: "completed",
        region: s.region,
        locationName: s.locationName,
        lat: s.lat,
        lng: s.lng,
        timeHorizonMonths: s.timeHorizonMonths,
        isBaseline: s.isBaseline,
        parameters: JSON.stringify(s.interventionParams),
        outcomes: JSON.stringify(prediction.timeSeries),
        illegalMiningRateChange: prediction.metrics.illegalMiningRateChange,
        waterQualityChange: prediction.metrics.waterQualityChange,
        forestCoverChangeHa: prediction.metrics.forestCoverChangeHa,
        economicImpactGHS: prediction.metrics.economicImpactGHS,
        enforcementCostGHS: prediction.metrics.enforcementCostGHS,
        netBenefitGHS: prediction.metrics.netBenefitGHS,
        confidence: 0.7 + Math.min(0.25, hotspotCount * 0.02),
        model: "sim-engine-v1",
        algorithm: "intervention_impact_model",
        inputInvestigationIds: JSON.stringify(localInvestigations.map((i) => i.id)),
        inputInspectionIds: JSON.stringify(localInspections.map((i) => i.id)),
        inputHotspotIds: JSON.stringify(localHotspots.map((h) => h.id)),
        inputPredictionIds: JSON.stringify(envPredictions.map((p) => p.id)),
        inputEntityIds: JSON.stringify(twinEntities.map((e) => e.id)),
        explanation,
        factorsBreakdown: JSON.stringify(prediction.factorsBreakdown),
        metadata: JSON.stringify({
          hotspotCount,
          investigationCount: localInvestigations.length,
          inspectionCount: localInspections.length,
          predictionCount: envPredictions.length,
          entityCount: twinEntities.length,
          createdBy: admin?.id,
          seed: true,
        }),
        createdBy: admin?.id,
      },
    });
    scenarioCount++;
  }

  console.log(`[seed] Seeded ${scenarioCount} simulation scenarios (1 baseline + 4 single interventions + 2 combined).`);
}

// ---------------------------------------------------------------------------
// M25 — Developer Platform seed data
// ---------------------------------------------------------------------------

async function seedDeveloperData() {
  // Check if developer data already exists
  const existing = await prisma.webhookEndpoint.count();
  if (existing > 0) {
    console.log(`[seed] Developer data already exists (${existing} webhooks) — skipping.`);
    return;
  }

  const admin = await prisma.user.findFirst({ select: { id: true } });
  const org = await prisma.organization.findFirst({ select: { id: true } });

  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  let webhookCount = 0;
  let apiKeyCount = 0;
  let sdkCount = 0;
  let integrationCount = 0;
  let deliveryCount = 0;

  // ===========================================================================
  // WEBHOOK ENDPOINTS — 4
  // ===========================================================================
  const webhooks = [
    {
      key: "wh-epa-alerts-bot",
      name: "EPA Alert Bot",
      description: "Sends fraud alerts and investigation updates to EPA Slack channel",
      url: "https://hooks.slack.com/services/T0/B0/XXXX",
      events: ["alert.detected", "alert.confirmed", "investigation.opened", "investigation.closed"],
      secret: "whsec_a1b2c3d4e5f6g7h8i9j0",
      isActive: true,
      deliveryCount: 142,
      successCount: 138,
      failureCount: 4,
      lastDeliveryAt: daysAgo(0.5),
      lastDeliveryStatus: "success",
    },
    {
      key: "wh-wacam-evidence",
      name: "WACAM Evidence Tracker",
      description: "Tracks new evidence related to WACAM-monitored communities",
      url: "https://wacam.org/api/webhooks/sentinel",
      events: ["evidence.created", "evidence.verified", "mission.completed"],
      secret: "whsec_wacam_evidence_secret",
      isActive: true,
      deliveryCount: 89,
      successCount: 87,
      failureCount: 2,
      lastDeliveryAt: daysAgo(1),
      lastDeliveryStatus: "success",
    },
    {
      key: "wh-arcgis-sync",
      name: "ArcGIS Sync",
      description: "Syncs hotspot predictions and twin entities to ArcGIS Online",
      url: "https://services.arcgis.com/sentinel/webhook",
      events: ["hotspot.predicted", "prediction.updated", "evidence.created"],
      secret: "whsec_arcgis_sync_token",
      isActive: true,
      deliveryCount: 234,
      successCount: 230,
      failureCount: 4,
      lastDeliveryAt: daysAgo(0.2),
      lastDeliveryStatus: "success",
    },
    {
      key: "wh-grafana-metrics",
      name: "Grafana Metrics",
      description: "Pushes analytics KPIs to Grafana dashboard for visualization",
      url: "https://grafana.epa.gov.gh/api/webhook/sentinel",
      events: ["simulation.completed", "alert.detected"],
      secret: "whsec_grafana_metrics_key",
      isActive: false,
      deliveryCount: 45,
      successCount: 40,
      failureCount: 5,
      lastDeliveryAt: daysAgo(7),
      lastDeliveryStatus: "failed",
    },
  ];

  const webhookIds: string[] = [];
  for (const wh of webhooks) {
    const created = await prisma.webhookEndpoint.create({
      data: {
        key: wh.key,
        name: wh.name,
        description: wh.description,
        url: wh.url,
        events: JSON.stringify(wh.events),
        secret: wh.secret,
        isActive: wh.isActive,
        userId: admin?.id,
        organizationId: org?.id,
        deliveryCount: wh.deliveryCount,
        successCount: wh.successCount,
        failureCount: wh.failureCount,
        lastDeliveryAt: wh.lastDeliveryAt,
        lastDeliveryStatus: wh.lastDeliveryStatus,
      },
    });
    webhookIds.push(created.id);
    webhookCount++;
  }

  // ===========================================================================
  // WEBHOOK DELIVERIES — 8 sample deliveries
  // ===========================================================================
  const deliveryTypes = [
    { eventType: "alert.detected", status: "success", statusCode: 200, responseTimeMs: 145 },
    { eventType: "evidence.created", status: "success", statusCode: 200, responseTimeMs: 89 },
    { eventType: "investigation.opened", status: "success", statusCode: 201, responseTimeMs: 234 },
    { eventType: "hotspot.predicted", status: "success", statusCode: 200, responseTimeMs: 312 },
    { eventType: "alert.detected", status: "failed", statusCode: 500, responseTimeMs: 5000, errorMessage: "Internal Server Error" },
    { eventType: "evidence.verified", status: "success", statusCode: 200, responseTimeMs: 167 },
    { eventType: "mission.completed", status: "success", statusCode: 200, responseTimeMs: 98 },
    { eventType: "simulation.completed", status: "success", statusCode: 200, responseTimeMs: 423 },
  ];

  for (let i = 0; i < deliveryTypes.length && i < webhookIds.length; i++) {
    const dt = deliveryTypes[i]!;
    const endpointId = webhookIds[i % webhookIds.length]!;
    await prisma.webhookDelivery.create({
      data: {
        endpointId,
        eventType: dt.eventType,
        eventId: `evt_seed_${i}`,
        payload: JSON.stringify({ event: dt.eventType, eventId: `evt_seed_${i}`, data: { seeded: true }, timestamp: daysAgo(i).toISOString() }),
        attempt: 1,
        status: dt.status,
        statusCode: dt.statusCode,
        responseTimeMs: dt.responseTimeMs,
        responseBody: dt.status === "success" ? '{"ok":true}' : dt.errorMessage,
        errorMessage: dt.errorMessage,
        scheduledAt: daysAgo(i),
        deliveredAt: dt.status === "success" ? daysAgo(i) : null,
      },
    });
    deliveryCount++;
  }

  // ===========================================================================
  // API KEYS — 4
  // ===========================================================================
  const apiKeys = [
    {
      key: "sk_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0",
      keyPrefix: "sk_live_a1b2",
      name: "EPA Production Key",
      description: "Primary API key for EPA integration",
      scopes: ["read:evidence", "read:events", "read:investigations", "write:investigations", "read:inspections", "write:inspections", "read:cases", "write:cases", "read:analytics"],
      rateLimitPerMin: 200,
      rateLimitPerDay: 50000,
      totalRequests: 15420,
      lastUsedAt: daysAgo(0.1),
    },
    {
      key: "sk_live_b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1",
      keyPrefix: "sk_live_b2c3",
      name: "WACAM Field Agent App",
      description: "API key for WACAM mobile field reporting app",
      scopes: ["read:evidence", "write:evidence", "read:events", "write:events", "read:missions", "write:missions"],
      rateLimitPerMin: 100,
      rateLimitPerDay: 10000,
      totalRequests: 8932,
      lastUsedAt: daysAgo(0.3),
    },
    {
      key: "sk_live_c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2",
      keyPrefix: "sk_live_c3d4",
      name: "ArcGIS Integration",
      description: "API key for ArcGIS Online integration",
      scopes: ["read:hotspots", "read:predictions", "read:evidence", "read:events"],
      rateLimitPerMin: 50,
      rateLimitPerDay: 5000,
      totalRequests: 4521,
      lastUsedAt: daysAgo(0.5),
    },
    {
      key: "sk_test_d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3",
      keyPrefix: "sk_test_d4e5",
      name: "Development Test Key",
      description: "Test key for development environment",
      scopes: ["read:evidence", "read:events", "read:analytics"],
      rateLimitPerMin: 30,
      rateLimitPerDay: 1000,
      totalRequests: 234,
      lastUsedAt: daysAgo(2),
    },
  ];

  for (const k of apiKeys) {
    await prisma.apiKey.create({
      data: {
        key: k.key,
        keyPrefix: k.keyPrefix,
        name: k.name,
        description: k.description,
        scopes: JSON.stringify(k.scopes),
        userId: admin?.id,
        organizationId: org?.id,
        rateLimitPerMin: k.rateLimitPerMin,
        rateLimitPerDay: k.rateLimitPerDay,
        status: "active",
        totalRequests: k.totalRequests,
        lastUsedAt: k.lastUsedAt,
      },
    });
    apiKeyCount++;
  }

  // ===========================================================================
  // SDK RELEASES — 6 (one per language, all v1.0.0 latest)
  // ===========================================================================
  const sdkReleases = [
    { language: "javascript", packageName: "@sentinel/sdk", registryUrl: "https://www.npmjs.com/package/@sentinel/sdk", installCmd: "npm install @sentinel/sdk", downloadCount: 4521, releaseNotes: "Initial release. Full REST API coverage, TypeScript types, automatic retries." },
    { language: "python", packageName: "sentinel-africa", registryUrl: "https://pypi.org/project/sentinel-africa/", installCmd: "pip install sentinel-africa", downloadCount: 3210, releaseNotes: "Initial release. Async support, type hints, Pydantic models." },
    { language: "go", packageName: "github.com/sentinel-africa/sdk-go", registryUrl: "https://pkg.go.dev/github.com/sentinel-africa/sdk-go", installCmd: "go get github.com/sentinel-africa/sdk-go", downloadCount: 892, releaseNotes: "Initial release. Context support, streaming, error handling." },
    { language: "java", packageName: "com.sentinel:sdk", registryUrl: "https://search.maven.org/artifact/com.sentinel/sdk", installCmd: "mvn install com.sentinel:sdk:1.0.0", downloadCount: 445, releaseNotes: "Initial release. Java 11+, CompletableFuture async, Jackson JSON." },
    { language: "php", packageName: "sentinel/sdk", registryUrl: "https://packagist.org/packages/sentinel/sdk", installCmd: "composer require sentinel/sdk", downloadCount: 234, releaseNotes: "Initial release. PHP 8+, PSR-18 HTTP client, async via Guzzle." },
    { language: "ruby", packageName: "sentinel-sdk", registryUrl: "https://rubygems.org/gems/sentinel-sdk", installCmd: "gem install sentinel-sdk", downloadCmd: "gem install sentinel-sdk", downloadCount: 123, releaseNotes: "Initial release. Ruby 3+, Faraday HTTP client, dry-types." },
  ];

  for (const sdk of sdkReleases) {
    await prisma.sdkRelease.create({
      data: {
        language: sdk.language,
        version: "1.0.0",
        packageName: sdk.packageName,
        registryUrl: sdk.registryUrl,
        downloadUrl: sdk.registryUrl,
        releaseNotes: sdk.releaseNotes,
        isLatest: true,
        isStable: true,
        deprecated: false,
        downloadCount: sdk.downloadCount,
        minPlatformVersion: "v1",
        publishedAt: daysAgo(30),
      },
    });
    sdkCount++;
  }

  // ===========================================================================
  // INTEGRATIONS — 8
  // ===========================================================================
  const integrations = [
    { key: "slack", name: "Slack", description: "Send real-time fraud alerts and investigation updates to Slack channels", category: "messaging", platform: "slack", docsUrl: "https://api.slack.com/messaging/webhooks", isOfficial: true, installCount: 1240 },
    { key: "microsoft-teams", name: "Microsoft Teams", description: "Push alerts and case updates to Microsoft Teams channels", category: "messaging", platform: "microsoft_teams", docsUrl: "https://learn.microsoft.com/microsoftteams/platform/webhooks-and-connectors", isOfficial: true, installCount: 456 },
    { key: "arcgis", name: "ArcGIS Online", description: "Sync hotspot predictions and twin entities to ArcGIS Online for GIS visualization", category: "gis", platform: "arcgis", docsUrl: "https://developers.arcgis.com/rest/", isOfficial: true, installCount: 89 },
    { key: "grafana", name: "Grafana", description: "Visualize Sentinel analytics KPIs in Grafana dashboards", category: "monitoring", platform: "grafana", docsUrl: "https://grafana.com/docs/grafana/latest/http_api/", isOfficial: false, installCount: 234 },
    { key: "powerbi", name: "Power BI", description: "Export analytics data to Microsoft Power BI for reporting", category: "data", platform: "powerbi", docsUrl: "https://docs.microsoft.com/power-bi/developer/", isOfficial: false, installCount: 167 },
    { key: "zapier", name: "Zapier", description: "Automate workflows with Zapier — trigger actions on 5,000+ apps", category: "automation", platform: "zapier", docsUrl: "https://zapier.com/developer/", isOfficial: true, installCount: 512 },
    { key: "mqtt", name: "MQTT", description: "Publish real-time events to MQTT topics for IoT integrations", category: "automation", platform: "mqtt", docsUrl: "https://mqtt.org/", isOfficial: false, installCount: 78 },
    { key: "splunk", name: "Splunk SIEM", description: "Forward audit logs and fraud alerts to Splunk for security analysis", category: "security", platform: "splunk", docsUrl: "https://docs.splunk.com/Documentation", isOfficial: false, installCount: 45 },
  ];

  for (const integ of integrations) {
    await prisma.apiIntegration.create({
      data: {
        key: integ.key,
        name: integ.name,
        description: integ.description,
        category: integ.category,
        platform: integ.platform,
        docsUrl: integ.docsUrl,
        isActive: true,
        isOfficial: integ.isOfficial,
        installCount: integ.installCount,
      },
    });
    integrationCount++;
  }

  console.log(`[seed] Seeded ${webhookCount} webhooks (${deliveryCount} deliveries), ${apiKeyCount} API keys, ${sdkCount} SDK releases, ${integrationCount} integrations.`);
}

// ---------------------------------------------------------------------------
// M26 — Security Hardening seed data
// ---------------------------------------------------------------------------

async function seedSecurityData() {
  const existing = await prisma.securityEvent.count();
  if (existing > 0) {
    console.log(`[seed] Security data already exists (${existing} events) — skipping.`);
    return;
  }

  const admin = await prisma.user.findFirst({ select: { id: true } });
  const now = new Date();
  const hoursAgo = (n: number) => new Date(now.getTime() - n * 60 * 60 * 1000);
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  let eventCount = 0;
  let policyCount = 0;
  let threatCount = 0;
  let backupCount = 0;
  let penTestCount = 0;
  let secretCount = 0;
  let drCount = 0;

  // ===========================================================================
  // SECURITY POLICIES — 10 (one per domain)
  // ===========================================================================
  const policies = [
    { key: "policy-zero-trust", name: "Zero Trust Access Policy", domain: "zero_trust", description: "mTLS for all service-to-service communication. Device posture check before access. Least-privilege RBAC. Continuous authentication every 15 min.", config: { mTLS: true, devicePosture: true, continuousAuth: true, sessionTimeout: 900 }, complianceScore: 0.92, violationCount: 2 },
    { key: "policy-encryption", name: "Encryption Policy", domain: "encryption", description: "AES-256-GCM at rest. TLS 1.3 in transit. Envelope encryption for PII. KMS-managed keys with 90-day rotation.", config: { atRest: "AES-256-GCM", inTransit: "TLS-1.3", keyManagement: "KMS", rotationDays: 90 }, complianceScore: 0.98, violationCount: 0 },
    { key: "policy-rate-limiting", name: "Rate Limiting Policy", domain: "rate_limiting", description: "100 req/min per API key, 1000 req/min per IP, 10000 req/day default. Sliding window algorithm. 429 with Retry-After header.", config: { perKey: 100, perIp: 1000, perDay: 10000, algorithm: "sliding_window" }, complianceScore: 0.95, violationCount: 12 },
    { key: "policy-waf", name: "WAF Rules Policy", domain: "waf", description: "OWASP Top 10 protection. SQL injection, XSS, CSRF, RCE, path traversal blocking. Bot detection. Geo-blocking for high-risk countries.", config: { owaspTop10: true, botDetection: true, geoBlock: ["CN", "RU"], mode: "enforce" }, complianceScore: 0.88, violationCount: 45 },
    { key: "policy-secret-rotation", name: "Secret Rotation Policy", domain: "secret_rotation", description: "Automatic rotation: JWT 30d, DB password 60d, API keys 90d, encryption keys 90d, TLS certs 90d. Zero-downtime rotation.", config: { jwtDays: 30, dbDays: 60, apiKeyDays: 90, encryptionDays: 90, tlsDays: 90 }, complianceScore: 0.90, violationCount: 1 },
    { key: "policy-pen-testing", name: "Penetration Testing Policy", domain: "pen_testing", description: "Quarterly internal pen tests. Annual external pen test by certified firm. Continuous automated vulnerability scanning.", config: { internalQuarterly: true, externalAnnual: true, automatedScanning: "continuous" }, complianceScore: 0.85, violationCount: 3 },
    { key: "policy-threat-detection", name: "Threat Detection Policy", domain: "threat_detection", description: "SIEM with 24/7 monitoring. Anomaly detection via ML. Brute-force protection (5 attempts/15 min). IoC feed integration.", config: { siem: true, anomalyDetection: true, bruteForceThreshold: 5, iocFeeds: true }, complianceScore: 0.87, violationCount: 8 },
    { key: "policy-backup", name: "Backup Policy", domain: "backup", description: "Daily incremental, weekly full. 30-day retention. AES-256 encrypted. Verified restore monthly. 3-2-1 backup strategy.", config: { incrementalDaily: true, fullWeekly: true, retentionDays: 30, encryption: "AES-256", strategy: "3-2-1" }, complianceScore: 0.93, violationCount: 0 },
    { key: "policy-disaster-recovery", name: "Disaster Recovery Policy", domain: "disaster_recovery", description: "RPO: 60 min. RTO: 4 hours. Regional failover capability. DR drill quarterly. Multi-AZ deployment.", config: { rpoMinutes: 60, rtoMinutes: 240, regionalFailover: true, drillQuarterly: true }, complianceScore: 0.82, violationCount: 2 },
    { key: "policy-audit", name: "Audit Log Policy", domain: "audit", description: "Immutable, tamper-evident audit log with hash chain. All security actions logged. 7-year retention. SOC 2 compliant.", config: { immutable: true, hashChain: true, retentionYears: 7, compliance: "SOC2" }, complianceScore: 0.96, violationCount: 0 },
  ];

  for (const p of policies) {
    await prisma.securityPolicy.create({
      data: {
        key: p.key,
        name: p.name,
        domain: p.domain,
        description: p.description,
        config: JSON.stringify(p.config),
        enforcementMode: "enforce",
        isActive: true,
        complianceScore: p.complianceScore,
        violationCount: p.violationCount,
        lastCheckedAt: hoursAgo(1),
        lastViolatedAt: p.violationCount > 0 ? daysAgo(3) : null,
      },
    });
    policyCount++;
  }

  // ===========================================================================
  // SECURITY EVENTS — 8
  // ===========================================================================
  const events = [
    { domain: "waf", type: "waf_blocked", severity: "high", status: "resolved", title: "SQL Injection Attempt Blocked", description: "WAF blocked SQL injection attempt on /api/v1/evidence. Payload: ' OR 1=1 --", sourceIp: "45.83.12.99", targetResource: "/api/v1/evidence", mitigatedAt: hoursAgo(5), mitigationNotes: "IP blocked automatically by WAF rule SQLI-001" },
    { domain: "threat_detection", type: "brute_force_detected", severity: "critical", status: "active", title: "Brute Force Attack on Admin Login", description: "237 failed login attempts from IP 45.83.12.99 targeting admin@sentinel.africa in 15 minutes. Automatic IP block triggered.", sourceIp: "45.83.12.99", targetResource: "/api/v1/auth/signin", mitigatedAt: hoursAgo(2), mitigationNotes: "IP auto-blocked for 24 hours" },
    { domain: "zero_trust", type: "device_posture_failed", severity: "medium", status: "resolved", title: "Device Posture Check Failed", description: "User device missing security update. Access limited to read-only mode.", sourceUserId: admin?.id, targetResource: "admin-panel" },
    { domain: "rate_limiting", type: "rate_limit_exceeded", severity: "low", status: "resolved", title: "API Rate Limit Exceeded", description: "API key sk_live_a1b2... exceeded 100 req/min limit. 429 responses returned.", sourceIp: "197.231.45.10", targetResource: "/api/v1/evidence" },
    { domain: "secret_rotation", type: "key_rotated", severity: "info", status: "resolved", title: "JWT Secret Rotated", description: "JWT signing secret rotated to version 12. Old secret valid for 24-hour grace period.", mitigatedAt: daysAgo(1) },
    { domain: "encryption", type: "encryption_verified", severity: "info", status: "resolved", title: "Encryption Verification Passed", description: "Monthly encryption verification: all data at rest confirmed AES-256-GCM encrypted. All TLS connections using TLS 1.3." },
    { domain: "backup", type: "backup_completed", severity: "info", status: "resolved", title: "Daily Backup Completed", description: "Incremental database backup completed. Size: 247MB. Encrypted. Checksum verified.", mitigatedAt: hoursAgo(6) },
    { domain: "audit", type: "audit_log_tamper_check", severity: "info", status: "resolved", title: "Audit Log Integrity Verified", description: "Hash chain verification of 12,847 audit entries: all valid. No tampering detected." },
  ];

  for (const e of events) {
    await prisma.securityEvent.create({
      data: {
        domain: e.domain,
        type: e.type,
        severity: e.severity,
        status: e.status,
        title: e.title,
        description: e.description,
        sourceIp: e.sourceIp,
        sourceUserId: e.sourceUserId,
        targetResource: e.targetResource,
        mitigatedAt: e.mitigatedAt,
        mitigatedById: e.mitigatedAt ? admin?.id : null,
        mitigationNotes: e.mitigationNotes,
        detectedAt: hoursAgo(Math.random() * 48),
      },
    });
    eventCount++;
  }

  // ===========================================================================
  // THREAT INDICATORS — 6
  // ===========================================================================
  const threats = [
    { type: "brute_force", severity: "high", status: "blocked", title: "Brute Force — Admin Login", description: "237 failed login attempts in 15 min from 45.83.12.99", sourceIp: "45.83.12.99", sourceCountry: "RU", targetEndpoint: "/api/v1/auth/signin", targetUserId: admin?.id, detectionMethod: "siem", confidence: 0.95, blockedAt: hoursAgo(2), blockDuration: 86400 },
    { type: "sql_injection", severity: "high", status: "blocked", title: "SQL Injection on Evidence API", description: "WAF blocked UNION SELECT injection attempt", sourceIp: "45.83.12.99", sourceCountry: "RU", targetEndpoint: "/api/v1/evidence", detectionMethod: "waf", confidence: 0.92, blockedAt: hoursAgo(5), blockDuration: 86400 },
    { type: "credential_stuffing", severity: "critical", status: "active", title: "Credential Stuffing Attack", description: "Automated login attempts using 500+ leaked credentials from 3 IPs", sourceIp: "197.231.45.10", sourceCountry: "NG", targetEndpoint: "/api/v1/auth/signin", detectionMethod: "siem", confidence: 0.88, blockedAt: null },
    { type: "bot", severity: "medium", status: "blocked", title: "Bot Scraping Evidence API", description: "Automated scraping bot making 2000+ req/min from distributed IPs", sourceIp: "185.220.101.1", sourceCountry: "DE", targetEndpoint: "/api/v1/evidence", detectionMethod: "anomaly", confidence: 0.78, blockedAt: hoursAgo(12), blockDuration: 3600 },
    { type: "xss", severity: "high", status: "blocked", title: "XSS Attempt in Comment Field", description: "WAF blocked <script> tag injection in event comment", sourceIp: "102.129.45.2", sourceCountry: "US", targetEndpoint: "/api/v1/intelligence/events/comments", detectionMethod: "waf", confidence: 0.90, blockedAt: hoursAgo(18), blockDuration: 86400 },
    { type: "ddos", severity: "critical", status: "resolved", title: "DDoS Attack Mitigated", description: "10,000 req/sec from botnet. Auto-scaling + rate limiting mitigated.", sourceIp: "multiple", sourceCountry: "multiple", targetEndpoint: "/", detectionMethod: "ids", confidence: 0.96, blockedAt: daysAgo(3), blockDuration: 7200 },
  ];

  for (const t of threats) {
    await prisma.threatIndicator.create({
      data: {
        type: t.type,
        severity: t.severity,
        status: t.status,
        title: t.title,
        description: t.description,
        sourceIp: t.sourceIp,
        sourceCountry: t.sourceCountry,
        targetEndpoint: t.targetEndpoint,
        targetUserId: t.targetUserId,
        detectionMethod: t.detectionMethod,
        confidence: t.confidence,
        blockedAt: t.blockedAt,
        blockDuration: t.blockDuration,
        detectedAt: hoursAgo(Math.random() * 72),
      },
    });
    threatCount++;
  }

  // ===========================================================================
  // BACKUPS — 6
  // ===========================================================================
  const backups = [
    { key: "bkp-db-full-20240728", type: "full", target: "database", status: "verified", sizeBytes: 1200000000, compressedSizeBytes: 380000000, storageProvider: "s3", encrypted: true, retentionDays: 90, verificationStatus: "passed", completedAt: hoursAgo(6), durationMs: 240000 },
    { key: "bkp-db-incr-20240729", type: "incremental", target: "database", status: "verified", sizeBytes: 45000000, compressedSizeBytes: 12000000, storageProvider: "s3", encrypted: true, retentionDays: 30, verificationStatus: "passed", completedAt: hoursAgo(6), durationMs: 45000 },
    { key: "bkp-storage-full-20240728", type: "full", target: "storage", status: "verified", sizeBytes: 1900000000, compressedSizeBytes: 1400000000, storageProvider: "s3", encrypted: true, retentionDays: 90, verificationStatus: "passed", completedAt: hoursAgo(8), durationMs: 480000 },
    { key: "bkp-config-snap-20240729", type: "snapshot", target: "config", status: "completed", sizeBytes: 2300000, compressedSizeBytes: 890000, storageProvider: "s3", encrypted: true, retentionDays: 365, verificationStatus: "pending", completedAt: hoursAgo(12), durationMs: 5000 },
    { key: "bkp-db-incr-20240727", type: "incremental", target: "database", status: "expired", sizeBytes: 38000000, compressedSizeBytes: 11000000, storageProvider: "s3", encrypted: true, retentionDays: 30, verificationStatus: "passed", completedAt: daysAgo(2), durationMs: 42000 },
    { key: "bkp-full-system-20240701", type: "full", target: "full_system", status: "verified", sizeBytes: 2000000000, compressedSizeBytes: 1500000000, storageProvider: "s3", encrypted: true, retentionDays: 365, verificationStatus: "passed", completedAt: daysAgo(28), durationMs: 1800000 },
  ];

  for (const b of backups) {
    await prisma.backupRecord.create({
      data: {
        key: b.key,
        type: b.type,
        target: b.target,
        status: b.status,
        sizeBytes: b.sizeBytes,
        compressedSizeBytes: b.compressedSizeBytes,
        storageLocation: `s3://sentinel-backups/${b.target}/${b.key}`,
        storageProvider: b.storageProvider,
        encrypted: b.encrypted,
        encryptionKeyId: `kms-key-${b.target}`,
        checksum: `sha256:${Math.random().toString(36).slice(2, 18)}`,
        retentionDays: b.retentionDays,
        expiresAt: new Date(now.getTime() + b.retentionDays * 24 * 60 * 60 * 1000),
        verifiedAt: b.verificationStatus === "passed" ? b.completedAt : null,
        verifiedById: b.verificationStatus === "passed" ? admin?.id : null,
        verificationStatus: b.verificationStatus,
        scheduledAt: new Date(b.completedAt.getTime() - 60000),
        startedAt: new Date(b.completedAt.getTime() - b.durationMs),
        completedAt: b.completedAt,
        durationMs: b.durationMs,
      },
    });
    backupCount++;
  }

  // ===========================================================================
  // PEN TEST REPORTS — 3
  // ===========================================================================
  const penTests = [
    {
      key: "pentest-2024q2-internal",
      title: "Q2 2024 Internal Penetration Test",
      description: "Quarterly internal penetration test covering all API endpoints, authentication, and data access controls.",
      type: "internal",
      scope: JSON.stringify(["REST API", "GraphQL", "Authentication", "RBAC", "Evidence Upload", "Admin Panel"]),
      testDate: daysAgo(45),
      testDuration: 8,
      testerName: "Sentinel Security Team",
      testerType: "internal",
      criticalCount: 0,
      highCount: 1,
      mediumCount: 3,
      lowCount: 5,
      infoCount: 2,
      totalFindings: 11,
      executiveSummary: "Overall security posture is strong. 1 high-severity finding (rate limiting bypass on /api/v1/evidence) remediated. 3 medium findings in progress. No critical vulnerabilities found.",
      remediationStatus: "in_progress",
      remediatedCount: 7,
      remediationDueAt: daysAgo(-15),
    },
    {
      key: "pentest-2024q1-external",
      title: "Q1 2024 External Penetration Test",
      description: "Annual external penetration test by certified third-party security firm.",
      type: "external",
      scope: JSON.stringify(["External API", "Web Application", "Authentication", "Session Management", "Input Validation", "Cryptography"]),
      testDate: daysAgo(120),
      testDuration: 40,
      testerName: "SecureAfrica Consulting Ltd.",
      testerType: "external_firm",
      criticalCount: 0,
      highCount: 2,
      mediumCount: 4,
      lowCount: 6,
      infoCount: 3,
      totalFindings: 15,
      executiveSummary: "External pen test by SecureAfrica. No critical vulnerabilities. 2 high-severity findings (XSS in comments, missing CSRF token) fully remediated. Platform meets OWASP Top 10 compliance.",
      remediationStatus: "completed",
      remediatedCount: 15,
      remediationDueAt: daysAgo(60),
    },
    {
      key: "pentest-2024-redteam",
      title: "2024 Red Team Exercise",
      description: "Adversarial red team simulation attempting to exfiltrate evidence data and escalate privileges.",
      type: "red_team",
      scope: JSON.stringify(["Full System", "Social Engineering", "Privilege Escalation", "Data Exfiltration", "Lateral Movement"]),
      testDate: daysAgo(90),
      testDuration: 80,
      testerName: "Red Team Unit",
      testerType: "internal",
      criticalCount: 1,
      highCount: 2,
      mediumCount: 3,
      lowCount: 2,
      infoCount: 1,
      totalFindings: 9,
      executiveSummary: "Red team achieved limited access via phishing but was detected by anomaly detection before data exfiltration. 1 critical finding (phishing-resistant MFA not enforced for admins) remediated. Detection capabilities performed well.",
      remediationStatus: "completed",
      remediatedCount: 9,
      remediationDueAt: daysAgo(30),
    },
  ];

  for (const p of penTests) {
    await prisma.penTestReport.create({
      data: {
        key: p.key,
        title: p.title,
        description: p.description,
        type: p.type,
        scope: p.scope,
        testDate: p.testDate,
        testDuration: p.testDuration,
        testerName: p.testerName,
        testerType: p.testerType,
        criticalCount: p.criticalCount,
        highCount: p.highCount,
        mediumCount: p.mediumCount,
        lowCount: p.lowCount,
        infoCount: p.infoCount,
        totalFindings: p.totalFindings,
        executiveSummary: p.executiveSummary,
        remediationStatus: p.remediationStatus,
        remediatedCount: p.remediatedCount,
        remediationDueAt: p.remediationDueAt,
      },
    });
    penTestCount++;
  }

  // ===========================================================================
  // SECRET ROTATIONS — 7
  // ===========================================================================
  const secrets = [
    { key: "secret-jwt", secretType: "jwt_secret", secretName: "NextAuth JWT Secret", description: "JWT signing secret for NextAuth.js", rotationStatus: "completed", rotationIntervalDays: 30, lastRotatedAt: daysAgo(1), nextRotationAt: daysAgo(-29), currentVersion: 12, previousVersion: 11, verificationStatus: "passed" },
    { key: "secret-db-password", secretType: "database_password", secretName: "Database Password", description: "Primary database connection password", rotationStatus: "completed", rotationIntervalDays: 60, lastRotatedAt: daysAgo(15), nextRotationAt: daysAgo(-45), currentVersion: 8, previousVersion: 7, verificationStatus: "passed" },
    { key: "secret-encryption-key", secretType: "encryption_key", secretName: "AES-256 Encryption Key", description: "KMS-managed master encryption key", rotationStatus: "completed", rotationIntervalDays: 90, lastRotatedAt: daysAgo(20), nextRotationAt: daysAgo(-70), currentVersion: 5, previousVersion: 4, verificationStatus: "passed" },
    { key: "secret-api-key", secretType: "api_key", secretName: "Platform API Key", description: "Internal platform API key", rotationStatus: "scheduled", rotationIntervalDays: 90, lastRotatedAt: daysAgo(85), nextRotationAt: daysAgo(-5), currentVersion: 4, previousVersion: 3, verificationStatus: "pending" },
    { key: "secret-tls-cert", secretType: "tls_cert", secretName: "TLS Certificate", description: "Let's Encrypt TLS certificate", rotationStatus: "completed", rotationIntervalDays: 90, lastRotatedAt: daysAgo(30), nextRotationAt: daysAgo(-60), currentVersion: 8, previousVersion: 7, verificationStatus: "passed" },
    { key: "secret-oauth", secretType: "oauth_secret", secretName: "Google OAuth Secret", description: "Google OAuth client secret", rotationStatus: "scheduled", rotationIntervalDays: 365, lastRotatedAt: daysAgo(300), nextRotationAt: daysAgo(-65), currentVersion: 2, previousVersion: 1, verificationStatus: "passed" },
    { key: "secret-webhook", secretType: "webhook_secret", secretName: "Webhook Signing Secret", description: "HMAC webhook signing secret", rotationStatus: "completed", rotationIntervalDays: 180, lastRotatedAt: daysAgo(45), nextRotationAt: daysAgo(-135), currentVersion: 3, previousVersion: 2, verificationStatus: "passed" },
  ];

  for (const s of secrets) {
    await prisma.secretRotation.create({
      data: {
        key: s.key,
        secretType: s.secretType,
        secretName: s.secretName,
        description: s.description,
        rotationStatus: s.rotationStatus,
        rotationIntervalDays: s.rotationIntervalDays,
        lastRotatedAt: s.lastRotatedAt,
        nextRotationAt: s.nextRotationAt,
        rotatedById: s.rotationStatus === "completed" ? admin?.id : null,
        currentVersion: s.currentVersion,
        previousVersion: s.previousVersion,
        verifiedAt: s.verificationStatus === "passed" ? s.lastRotatedAt : null,
        verificationStatus: s.verificationStatus,
      },
    });
    secretCount++;
  }

  // ===========================================================================
  // DR PLANS — 3
  // ===========================================================================
  const drPlans = [
    {
      key: "dr-database-failover",
      name: "Database Failover Plan",
      description: "Automatic database failover to standby replica in case of primary failure.",
      type: "failover",
      rpoMinutes: 60,
      rtoMinutes: 15,
      lastTestedAt: daysAgo(30),
      lastTestStatus: "passed",
      lastTestDurationMin: 12,
      readinessScore: 0.92,
      readinessStatus: "ready",
      steps: JSON.stringify(["Detect primary failure", "Promote standby replica", "Update DNS records", "Verify application connectivity", "Resume normal operations"]),
    },
    {
      key: "dr-full-restore",
      name: "Full System Restore Plan",
      description: "Complete system restore from encrypted backups in case of catastrophic failure.",
      type: "full_system",
      rpoMinutes: 60,
      rtoMinutes: 240,
      lastTestedAt: daysAgo(75),
      lastTestStatus: "partial",
      lastTestDurationMin: 210,
      readinessScore: 0.75,
      readinessStatus: "degraded",
      steps: JSON.stringify(["Provision new infrastructure", "Restore database from backup", "Restore object storage", "Restore configuration", "Verify data integrity", "Update DNS", "Resume operations"]),
    },
    {
      key: "dr-regional-failover",
      name: "Regional Failover Plan",
      description: "Failover to secondary region in case of regional outage.",
      type: "regional",
      rpoMinutes: 60,
      rtoMinutes: 480,
      lastTestedAt: daysAgo(120),
      lastTestStatus: "failed",
      lastTestDurationMin: 600,
      readinessScore: 0.45,
      readinessStatus: "not_ready",
      steps: JSON.stringify(["Detect regional outage", "Activate secondary region", "Sync pending data", "Update global DNS", "Verify all services", "Resume operations"]),
    },
  ];

  for (const p of drPlans) {
    await prisma.disasterRecoveryPlan.create({
      data: {
        key: p.key,
        name: p.name,
        description: p.description,
        type: p.type,
        rpoMinutes: p.rpoMinutes,
        rtoMinutes: p.rtoMinutes,
        lastTestedAt: p.lastTestedAt,
        lastTestStatus: p.lastTestStatus,
        lastTestDurationMin: p.lastTestDurationMin,
        readinessScore: p.readinessScore,
        readinessStatus: p.readinessStatus,
        steps: p.steps,
        isActive: true,
      },
    });
    drCount++;
  }

  console.log(`[seed] Seeded ${policyCount} policies, ${eventCount} events, ${threatCount} threats, ${backupCount} backups, ${penTestCount} pen tests, ${secretCount} secret rotations, ${drCount} DR plans.`);
}

main()
  .catch((e) => {
     
    console.error("[seed] Failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
