/**
 * Sentinel — Comprehensive Demo Data Seed for Neon
 * Creates enough coherent data for an investor demo
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("[seed-demo] Starting comprehensive demo data seed...");

  // Get admin user
  const admin = await prisma.user.findFirst({ where: { email: "admin@sentinel.africa" } });
  const citizen = await prisma.user.findFirst({ where: { email: "citizen@sentinel.africa" } });
  if (!admin) throw new Error("Admin user not found. Run seed-neon.ts first.");

  // === TWIN ENTITIES (if not enough) ===
  const existingTwins = await prisma.twinEntity.count();
  if (existingTwins < 10) {
    console.log("[seed-demo] Seeding twin entities...");
    const twins = [
      { key: "mine-prestea-a", name: "Prestea Galamsey Site A", type: "mine", lat: 5.4321, lng: -2.1456, status: "active", metadata: JSON.stringify({ severity: "critical", area_hectares: 12.4, type: "illegal_alluvial" }) },
      { key: "mine-obuasi-pit", name: "Obuasi Illegal Pit", type: "mine", lat: 6.2062, lng: -1.6678, status: "active", metadata: JSON.stringify({ severity: "critical", area_hectares: 8.7 }) },
      { key: "mine-dunkwa-complex", name: "Dunkwa Mining Complex", type: "mine", lat: 5.9783, lng: -1.7822, status: "monitored", metadata: JSON.stringify({ severity: "high" }) },
      { key: "mine-tarkwa-cluster", name: "Tarkwa Nsuaem Cluster", type: "mine", lat: 5.3056, lng: -1.9933, status: "active", metadata: JSON.stringify({ severity: "critical" }) },
      { key: "mine-atewa-sector3", name: "Atewa Forest Sector 3", type: "mine", lat: 6.1667, lng: -0.5500, status: "active", metadata: JSON.stringify({ severity: "critical", protected_area: true }) },
      { key: "river-pra", name: "Pra River", type: "river", lat: 5.2767, lng: -1.8767, status: "active", metadata: JSON.stringify({ turbidity: "high", mercury_level: "4.2 µg/L" }) },
      { key: "river-oda", name: "Oda River", type: "river", lat: 6.2062, lng: -1.6678, status: "active", metadata: JSON.stringify({ mercury_level: "4.2 µg/L", who_limit: "1.0 µg/L" }) },
      { key: "river-offin", name: "Offin River", type: "river", lat: 6.3500, lng: -1.8500, status: "active", metadata: JSON.stringify({ turbidity: "340% above baseline" }) },
      { key: "forest-atewa", name: "Atewa Forest Reserve", type: "forest", lat: 6.1667, lng: -0.5500, status: "active", metadata: JSON.stringify({ area_km2: 233, protected: true, forest_loss_ha: 8.7 }) },
      { key: "community-prestea", name: "Prestea Community", type: "community", lat: 5.4300, lng: -2.1400, status: "active", metadata: JSON.stringify({ population: 35000, water_source: "Pra River", health_risk: "high" }) },
      { key: "community-obuasi", name: "Obuasi Community", type: "community", lat: 6.2062, lng: -1.6678, status: "active", metadata: JSON.stringify({ population: 150000 }) },
      { key: "road-prestea-access", name: "Prestea Access Road", type: "road", lat: 5.4321, lng: -2.1456, status: "active", metadata: JSON.stringify({ type: "unpaved", heavy_equipment: true }) },
    ];
    for (const t of twins) {
      await prisma.twinEntity.upsert({
        where: { key: t.key },
        create: { ...t },
        update: {},
      });
    }
    console.log("[seed-demo] Seeded " + twins.length + " twin entities");
  }

  // === INTELLIGENCE EVENTS (if not enough) ===
  const existingEvents = await prisma.intelligenceEvent.count();
  if (existingEvents < 10) {
    console.log("[seed-demo] Seeding intelligence events...");
    const events = [
      { key: "evt-prestea-cyanide-001", title: "Cyanide spill at Prestea mining site", type: "water_contamination", status: "verified", severity: "critical", lat: 5.4321, lng: -2.1456, locationName: "Prestea Galamsey Site A", createdById: admin.id, evidenceIds: JSON.stringify([]), commentCount: 5, subscriberCount: 12, watcherCount: 8, shareCount: 3, viewCount: 145 },
      { key: "evt-obuasi-mercury-001", title: "Mercury contamination in Oda River at Obuasi", type: "water_contamination", status: "investigating", severity: "high", lat: 6.2062, lng: -1.6678, locationName: "Obuasi Illegal Pit", createdById: admin.id, commentCount: 3, subscriberCount: 8, viewCount: 92 },
      { key: "evt-atewa-deforestation-001", title: "Illegal logging and mining in Atewa Forest Reserve", type: "deforestation", status: "open", severity: "critical", lat: 6.1667, lng: -0.5500, locationName: "Atewa Forest Reserve — Sector 3", createdById: admin.id, commentCount: 7, subscriberCount: 20, viewCount: 210 },
      { key: "evt-dunkwa-sediment-001", title: "Sediment pollution in Offin River from Dunkwa mining", type: "water_contamination", status: "verified", severity: "high", lat: 5.9783, lng: -1.7822, locationName: "Dunkwa Mining Complex", createdById: admin.id, commentCount: 2, viewCount: 67 },
      { key: "evt-tarkwa-equipment-001", title: "Unlicensed excavators at Tarkwa Nsuaem", type: "illegal_mining", status: "resolved", severity: "medium", lat: 5.3056, lng: -1.9933, locationName: "Tarkwa Nsuaem Cluster", createdById: admin.id, commentCount: 4, viewCount: 88 },
      { key: "evt-prestea-mercury-002", title: "Mercury processing pool at Prestea Site B", type: "illegal_mining", status: "open", severity: "critical", lat: 5.4350, lng: -2.1480, locationName: "Prestea Site B", createdById: citizen?.id ?? admin.id, commentCount: 1, viewCount: 34 },
      { key: "evt-bibiani-deforest-001", title: "Forest clearing for mining at Bibiani North", type: "deforestation", status: "open", severity: "high", lat: 6.4639, lng: -2.3322, locationName: "Bibiani North Site", createdById: admin.id, viewCount: 45 },
      { key: "evt-konongo-excavation-001", title: "Illegal excavation near Konongo", type: "illegal_mining", status: "investigating", severity: "high", lat: 6.6217, lng: -1.0756, locationName: "Konongo Pit", createdById: admin.id, viewCount: 56 },
    ];
    for (const e of events) {
      await prisma.intelligenceEvent.upsert({
        where: { key: e.key },
        create: { ...e },
        update: {},
      });
    }
    console.log("[seed-demo] Seeded " + events.length + " intelligence events");
  }

  // === EVIDENCE (if not enough) ===
  const existingEvidence = await prisma.evidence.count();
  if (existingEvidence < 10) {
    console.log("[seed-demo] Seeding evidence...");
    const evidenceData = [
      { key: "evd-prestea-cyanide-001", title: "Cyanide spill — water sample photo", type: "image", mediaType: "image/jpeg", storageKey: "evidence/prestea-cyanide-001.jpg", sizeBytes: 2456789, checksum: createHash("sha256").update("evd-prestea-cyanide-001").digest("hex"), currentHash: createHash("sha256").update("evd-prestea-cyanide-001-v1").digest("hex"), lat: 5.4321, lng: -2.1456, uploadedById: admin.id, verified: true, verifiedById: admin.id, verifiedAt: new Date() },
      { key: "evd-obuasi-mercury-001", title: "Mercury processing — retort photo", type: "image", mediaType: "image/jpeg", storageKey: "evidence/obuasi-mercury-001.jpg", sizeBytes: 1892341, checksum: createHash("sha256").update("evd-obuasi-mercury-001").digest("hex"), currentHash: createHash("sha256").update("evd-obuasi-mercury-001-v1").digest("hex"), lat: 6.2062, lng: -1.6678, uploadedById: admin.id, verified: true, verifiedById: admin.id, verifiedAt: new Date() },
      { key: "evd-atewa-drone-001", title: "Drone footage — Atewa deforestation", type: "video", mediaType: "video/mp4", storageKey: "evidence/atewa-drone-001.mp4", sizeBytes: 45678234, checksum: createHash("sha256").update("evd-atewa-drone-001").digest("hex"), currentHash: createHash("sha256").update("evd-atewa-drone-001-v1").digest("hex"), lat: 6.1667, lng: -0.5500, uploadedById: admin.id, verified: true, verifiedById: admin.id, verifiedAt: new Date() },
      { key: "evd-dunkwa-water-001", title: "Offin River — turbid water photo", type: "image", mediaType: "image/jpeg", storageKey: "evidence/dunkwa-water-001.jpg", sizeBytes: 892341, checksum: createHash("sha256").update("evd-dunkwa-water-001").digest("hex"), currentHash: createHash("sha256").update("evd-dunkwa-water-001-v1").digest("hex"), lat: 5.9783, lng: -1.7822, uploadedById: admin.id, verified: false },
      { key: "evd-tarkwa-equipment-001", title: "Unlicensed excavator — CAT 320", type: "image", mediaType: "image/jpeg", storageKey: "evidence/tarkwa-equipment-001.jpg", sizeBytes: 5234567, checksum: createHash("sha256").update("evd-tarkwa-equipment-001").digest("hex"), currentHash: createHash("sha256").update("evd-tarkwa-equipment-001-v1").digest("hex"), lat: 5.3056, lng: -1.9933, uploadedById: admin.id, verified: true, verifiedById: admin.id, verifiedAt: new Date() },
      { key: "evd-prestea-gps-001", title: "GPS track — Prestea mining perimeter", type: "gps_track", mediaType: "application/gpx+xml", storageKey: "evidence/prestea-gps-001.gpx", sizeBytes: 45678, checksum: createHash("sha256").update("evd-prestea-gps-001").digest("hex"), currentHash: createHash("sha256").update("evd-prestea-gps-001-v1").digest("hex"), lat: 5.4321, lng: -2.1456, uploadedById: admin.id, verified: false },
    ];
    for (const e of evidenceData) {
      await prisma.evidence.upsert({
        where: { key: e.key },
        create: { ...e, currentVersion: 1, chainValid: true, storageProvider: "local" },
        update: {},
      });
    }
    console.log("[seed-demo] Seeded " + evidenceData.length + " evidence items");
  }

  // === MISSIONS ===
  const existingMissions = await prisma.mission.count();
  if (existingMissions === 0) {
    console.log("[seed-demo] Seeding missions...");
    const missions = [
      { key: "mission-prestea-evidence-001", title: "Evidence Gathering: Prestea Galamsey Site A", description: "Need additional evidence within 500m of the reported cyanide spill.", instructions: "Photograph the water at this GPS location. Take 3 photos from different angles. Note any unusual smells.", type: "evidence_gathering", priority: "urgent", triggerType: "low_confidence", triggerDescription: "Fused confidence 45% — need more evidence", lat: 5.4321, lng: -2.1456, radiusM: 500, locationName: "Prestea Galamsey Site A", baseReward: 100, maxReward: 600, status: "verified", assignedToId: citizen?.id ?? admin.id, acceptedAt: new Date(Date.now() - 5 * 86400000), submittedAt: new Date(Date.now() - 3 * 86400000), verifiedAt: new Date(Date.now() - 2 * 86400000), actualReward: 300, verificationQuality: "excellent", verifiedById: admin.id, expiresAt: new Date(Date.now() + 2 * 86400000) },
      { key: "mission-obuasi-water-001", title: "Water Sample: Oda River at Obuasi", description: "Collect water sample from Oda River to test for mercury.", instructions: "Collect 500ml water sample from the river. Record GPS. Note color and smell.", type: "evidence_gathering", priority: "high", triggerType: "low_confidence", triggerDescription: "Mercury levels 4× WHO limit — verify with field sample", lat: 6.2062, lng: -1.6678, radiusM: 500, locationName: "Obuasi — Oda River", baseReward: 100, maxReward: 400, status: "in_progress", assignedToId: citizen?.id ?? admin.id, acceptedAt: new Date(Date.now() - 2 * 86400000), expiresAt: new Date(Date.now() + 5 * 86400000) },
      { key: "mission-atewa-drone-001", title: "Drone Survey: Atewa Forest Sector 3", description: "Deploy drone for aerial surveillance of deforestation.", instructions: "Fly drone over sector 3. Capture 4K video of the clearing. Note boundaries.", type: "drone_survey", priority: "urgent", triggerType: "cv_detection", triggerDescription: "CV detected forest_loss with 91% confidence", lat: 6.1667, lng: -0.5500, radiusM: 1000, locationName: "Atewa Forest Reserve — Sector 3", baseReward: 200, maxReward: 1200, status: "open", expiresAt: new Date(Date.now() + 7 * 86400000) },
    ];
    for (const m of missions) {
      await prisma.mission.create({ data: m });
    }
    console.log("[seed-demo] Seeded " + missions.length + " missions");
  }

  // === REWARD POOLS ===
  const existingPools = await prisma.rewardPool.count();
  if (existingPools === 0) {
    console.log("[seed-demo] Seeding reward pools...");
    const pools = [
      { key: "pool-wacam-env-fund", name: "WACAM Environmental Monitoring Fund", type: "ngo_funding", sourceName: "WACAM Ghana", sourceType: "ngo", totalFunds: 15000, availableFunds: 10500, distributedFunds: 4500, distributionModel: "merit_based", status: "active", isPublic: true },
      { key: "pool-epa-enforcement", name: "EPA Enforcement Incentive Grant", type: "government_grant", sourceName: "EPA Ghana", sourceType: "government", totalFunds: 50000, availableFunds: 42000, distributedFunds: 8000, distributionModel: "merit_based", status: "active", isPublic: true },
      { key: "pool-prestea-community", name: "Prestea Community Evidence Fund", type: "donation", sourceName: "Community Donors", sourceType: "community", totalFunds: 3200, availableFunds: 2100, distributedFunds: 1100, distributionModel: "merit_based", status: "active", isPublic: true },
      { key: "pool-mission-rewards", name: "Mission Reward Fund", type: "mission_rewards", sourceName: "Sentinel Platform", sourceType: "platform", totalFunds: 8000, availableFunds: 6500, distributedFunds: 1500, distributionModel: "merit_based", status: "active", isPublic: true },
    ];
    for (const p of pools) {
      await prisma.rewardPool.create({ data: p });
    }
    console.log("[seed-demo] Seeded " + pools.length + " reward pools");
  }

  // === FRAUD ALERTS ===
  const existingFraud = await prisma.fraudAlert.count();
  if (existingFraud === 0) {
    console.log("[seed-demo] Seeding fraud alerts...");
    const alerts = [
      { key: "fraud-fake-evidence-001", type: "fake_evidence", severity: "high", status: "investigating", title: "Fake Evidence: Duplicate content hash across users", description: "Identical SHA-256 content hash found in evidence uploaded by 2 different users.", confidence: 0.92, riskScore: 0.85, targetUserId: admin.id, targetUserIds: JSON.stringify([admin.id]), signalCount: 2, estimatedImpactGHS: 0, model: "fraud-ai-v1", detectorVersion: "1.0.0" },
      { key: "fraud-deepfake-001", type: "deepfake", severity: "critical", status: "escalated", title: "Deepfake: AI-generated image with Midjourney signature", description: "Evidence image contains AI generation tool signatures. No EXIF data present.", confidence: 0.94, riskScore: 0.92, targetUserId: admin.id, targetUserIds: JSON.stringify([admin.id]), signalCount: 3, estimatedImpactGHS: 0, model: "fraud-ai-v1", detectorVersion: "1.0.0" },
      { key: "fraud-collusion-001", type: "collusion", severity: "high", status: "confirmed", title: "Collusion: 3-user circular corroboration ring", description: "Three users form a closed corroboration ring.", confidence: 0.88, riskScore: 0.78, targetUserId: admin.id, targetUserIds: JSON.stringify([admin.id]), signalCount: 2, estimatedImpactGHS: 0, model: "fraud-ai-v1", detectorVersion: "1.0.0" },
    ];
    for (const a of alerts) {
      await prisma.fraudAlert.create({ data: a });
    }
    console.log("[seed-demo] Seeded " + alerts.length + " fraud alerts");
  }

  // === HOTSPOT PREDICTIONS ===
  const existingHotspots = await prisma.hotspotPrediction.count();
  if (existingHotspots === 0) {
    console.log("[seed-demo] Seeding hotspot predictions...");
    const hotspots = [
      { type: "hotspot", lat: 5.4321, lng: -2.1456, locationName: "Prestea Galamsey Complex", prediction: "92% probability of active illegal mining. 8.7 hectares of new excavation detected.", probability: 0.92, confidence: 0.87, riskLevel: "critical", expansionDirection: "S", expansionRadiusKm: 1.5, expansionTimeframe: "1-3 months", explanation: "Spatial clustering of 3 mines + CV detection + satellite change + environmental risk.", factors: JSON.stringify([{ name: "Mine Density", weight: 0.25, contribution: 0.28 }, { name: "CV Detection", weight: 0.20, contribution: 0.18 }]), atRiskEntities: JSON.stringify([{ name: "Pra River", type: "river", distanceKm: 0.8 }, { name: "Prestea Community", type: "community", distanceKm: 1.2 }]) },
      { type: "hotspot", lat: 6.2062, lng: -1.6678, locationName: "Obuasi Illegal Pit", prediction: "85% probability. Mercury processing confirmed.", probability: 0.85, confidence: 0.82, riskLevel: "critical", expansionDirection: "N", expansionRadiusKm: 2.0, expansionTimeframe: "1-3 months", explanation: "Mercury detection + water contamination + community reports.", factors: JSON.stringify([]), atRiskEntities: JSON.stringify([{ name: "Oda River", type: "river", distanceKm: 0.5 }]) },
      { type: "hotspot", lat: 5.9783, lng: -1.7822, locationName: "Dunkwa Mining Complex", prediction: "78% probability. Sediment discharge into Offin River.", probability: 0.78, confidence: 0.75, riskLevel: "high", expansionDirection: "E", expansionRadiusKm: 1.2, expansionTimeframe: "3-6 months", explanation: "Turbidity 340% above baseline + 3 unlicensed operations.", factors: JSON.stringify([]), atRiskEntities: JSON.stringify([{ name: "Offin River", type: "river", distanceKm: 0.3 }]) },
    ];
    for (const h of hotspots) {
      await prisma.hotspotPrediction.create({ data: h });
    }
    console.log("[seed-demo] Seeded " + hotspots.length + " hotspot predictions");
  }

  // === ENVIRONMENTAL PREDICTIONS ===
  const existingEnvPreds = await prisma.environmentalPrediction.count();
  if (existingEnvPreds === 0) {
    console.log("[seed-demo] Seeding environmental predictions...");
    const preds = [
      { type: "sediment", targetName: "Pra River", targetType: "river", prediction: "Sediment flow risk: 74% — high probability of continued sedimentation from upstream mining.", riskScore: 0.74, riskLevel: "high", confidence: 0.82, timeframe: "1-3 months", factors: JSON.stringify([{ name: "Mine Proximity", weight: 0.30, contribution: 0.22 }, { name: "Excavation Activity", weight: 0.25, contribution: 0.19 }]), affectedEntities: JSON.stringify([{ name: "Prestea Community", impactLevel: "high" }]) },
      { type: "river_impact", targetName: "Oda River", targetType: "river", prediction: "River impact risk: 77% — mercury contamination 4× WHO limit.", riskScore: 0.77, riskLevel: "high", confidence: 0.85, timeframe: "immediate", factors: JSON.stringify([]), affectedEntities: JSON.stringify([{ name: "Obuasi Community", impactLevel: "critical" }]) },
      { type: "forest_loss", targetName: "Atewa Forest Reserve", targetType: "forest", prediction: "Forest loss risk: 70% — 8.7 hectares already cleared in protected area.", riskScore: 0.70, riskLevel: "high", confidence: 0.91, timeframe: "1-3 months", factors: JSON.stringify([]), affectedEntities: JSON.stringify([]) },
      { type: "protected_area_risk", targetName: "Atewa Forest Reserve", targetType: "protected_area", prediction: "Protected area risk: 69% — illegal mining encroachment into protected boundary.", riskScore: 0.69, riskLevel: "high", confidence: 0.88, timeframe: "1-3 months", factors: JSON.stringify([]), affectedEntities: JSON.stringify([]) },
    ];
    for (const p of preds) {
      await prisma.environmentalPrediction.create({ data: p });
    }
    console.log("[seed-demo] Seeded " + preds.length + " environmental predictions");
  }

  // === GOVERNMENT: INVESTIGATIONS ===
  const existingInvs = await prisma.investigation.count();
  if (existingInvs === 0) {
    console.log("[seed-demo] Seeding government investigations...");
    const invs = [
      { key: "inv-prestea-galamsey-001", title: "Prestea Galamsey Complex Investigation", description: "Large-scale illegal mining at Prestea. 3 excavators, mercury processing, water diversion.", type: "illegal_mining", priority: "urgent", triggerType: "satellite_change", triggerDescription: "Sentinel-2 detected 12.4 ha new excavation.", lat: 5.4321, lng: -2.1456, locationName: "Prestea Galamsey Site A", region: "Western", district: "Prestea-Huni Valley", level: "regional", agencyName: "EPA Ghana", leadInvestigatorName: "Kofi Mensah", estimatedImpactGHS: 450000, status: "investigating", assignedAt: new Date(Date.now() - 14 * 86400000) },
      { key: "inv-obuasi-mercury-002", title: "Obuasi Mercury Contamination Investigation", description: "Mercury contamination of Oda River. 4.2 µg/L (WHO limit: 1.0 µg/L).", type: "mercury_use", priority: "high", triggerType: "citizen_report", triggerDescription: "WACAM field agent reported mercury smell.", lat: 6.2062, lng: -1.6678, locationName: "Obuasi Illegal Pit", region: "Ashanti", district: "Obuasi Municipal", level: "regional", agencyName: "Minerals Commission", leadInvestigatorName: "Kofi Mensah", estimatedImpactGHS: 180000, status: "pending_review", assignedAt: new Date(Date.now() - 21 * 86400000) },
      { key: "inv-atewa-deforestation-003", title: "Atewa Forest Encroachment Investigation", description: "8.7 hectares of protected forest cleared for mining.", type: "deforestation", priority: "urgent", triggerType: "cv_detection", triggerDescription: "CV detected forest_loss 91% confidence.", lat: 6.1667, lng: -0.5500, locationName: "Atewa Forest Reserve", region: "Eastern", district: "Kwaebibirem", level: "national", agencyName: "EPA Ghana", leadInvestigatorName: "Sentinel Admin", estimatedImpactGHS: 820000, status: "escalated", assignedAt: new Date(Date.now() - 18 * 86400000) },
    ];
    for (const i of invs) {
      await prisma.investigation.create({ data: i });
    }
    console.log("[seed-demo] Seeded " + invs.length + " investigations");
  }

  // === GOVERNMENT: INSPECTIONS ===
  const existingInsps = await prisma.inspection.count();
  if (existingInsps === 0) {
    console.log("[seed-demo] Seeding inspections...");
    const insps = [
      { key: "insp-prestea-001", title: "Prestea Site A Field Inspection", type: "complaint_based", status: "completed", targetName: "Prestea Galamsey Site A", targetType: "mining_site", lat: 5.4321, lng: -2.1456, locationName: "Prestea Galamsey Site A", region: "Western", district: "Prestea-Huni Valley", scheduledAt: new Date(Date.now() - 10 * 86400000), conductedAt: new Date(Date.now() - 10 * 86400000), completedAt: new Date(Date.now() - 10 * 86400000), inspectorName: "Kofi Mensah", agencyName: "EPA Ghana", complianceLevel: "critical_violations", violationCount: 4, overallResult: "shutdown", followUpRequired: true, followUpDate: new Date(Date.now() + 7 * 86400000) },
      { key: "insp-obuasi-002", title: "Obuasi Mercury Processing Inspection", type: "complaint_based", status: "completed", targetName: "Obuasi Illegal Pit", targetType: "mining_site", lat: 6.2062, lng: -1.6678, locationName: "Obuasi Illegal Pit", region: "Ashanti", district: "Obuasi Municipal", scheduledAt: new Date(Date.now() - 18 * 86400000), conductedAt: new Date(Date.now() - 18 * 86400000), completedAt: new Date(Date.now() - 18 * 86400000), inspectorName: "Kofi Mensah", agencyName: "Minerals Commission", complianceLevel: "major_violations", violationCount: 2, overallResult: "violation_notice", followUpRequired: true, followUpDate: new Date(Date.now() + 14 * 86400000) },
      { key: "insp-atewa-003", title: "Atewa Forest Reserve Inspection", type: "emergency", status: "completed", targetName: "Atewa Forest Reserve — Sector 3", targetType: "forest", lat: 6.1667, lng: -0.5500, locationName: "Atewa Forest Reserve", region: "Eastern", district: "Kwaebibirem", scheduledAt: new Date(Date.now() - 14 * 86400000), conductedAt: new Date(Date.now() - 14 * 86400000), completedAt: new Date(Date.now() - 14 * 86400000), inspectorName: "Sentinel Admin", agencyName: "EPA Ghana", complianceLevel: "critical_violations", violationCount: 3, overallResult: "prosecution_recommended", followUpRequired: true, followUpDate: new Date(Date.now() + 30 * 86400000) },
    ];
    for (const i of insps) {
      await prisma.inspection.create({ data: i });
    }
    console.log("[seed-demo] Seeded " + insps.length + " inspections");
  }

  // === GOVERNMENT: CASES ===
  const existingCases = await prisma.case.count();
  if (existingCases === 0) {
    console.log("[seed-demo] Seeding cases...");
    const cases = [
      { key: "case-gha-001", caseNumber: "EPA/2024/0142", title: "Republic v. Prestea Galamsey Syndicate", description: "Criminal case against Prestea operators for illegal mining, mercury use, water pollution.", type: "illegal_mining", priority: "urgent", level: "regional", region: "Western", district: "Prestea-Huni Valley", leadAgencyName: "EPA Ghana", prosecutingAgencyName: "EPA Legal Division", defendantName: "Prestea Galamsey Syndicate (4 individuals)", defendantType: "cooperative", lat: 5.4321, lng: -2.1456, locationName: "Prestea Galamsey Site A", estimatedDamagesGHS: 450000, finesImposedGHS: 0, status: "active", filedAt: new Date(Date.now() - 12 * 86400000) },
      { key: "case-gha-003", caseNumber: "EPA/2024/0151", title: "Republic v. Atewa Forest Miners", description: "National case for protected forest encroachment.", type: "deforestation", priority: "urgent", level: "national", region: "Eastern", district: "Kwaebibirem", leadAgencyName: "EPA Ghana", prosecutingAgencyName: "Attorney General's Department", defendantName: "Atewa Miners (unknown)", defendantType: "unknown", lat: 6.1667, lng: -0.5500, locationName: "Atewa Forest Reserve", estimatedDamagesGHS: 820000, finesImposedGHS: 0, status: "under_review", filedAt: new Date(Date.now() - 4 * 86400000) },
      { key: "case-gha-004", caseNumber: "MC/2024/0089", title: "Minerals Commission v. Tarkwa Equipment Operator", description: "Administrative case for unlicensed equipment.", type: "illegal_mining", priority: "medium", level: "district", region: "Western", district: "Tarkwa-Nsuaem", leadAgencyName: "Minerals Commission", prosecutingAgencyName: "Minerals Commission Legal", defendantName: "Tarkwa Equipment Operator", defendantType: "individual", lat: 5.3056, lng: -1.9933, locationName: "Tarkwa Nsuaem", estimatedDamagesGHS: 75000, finesImposedGHS: 45000, status: "closed", resolution: "fined", resolutionNotes: "Equipment seized. Fine ₵45,000 paid.", filedAt: new Date(Date.now() - 20 * 86400000), closedAt: new Date(Date.now() - 8 * 86400000) },
    ];
    for (const c of cases) {
      await prisma.case.create({ data: c });
    }
    console.log("[seed-demo] Seeded " + cases.length + " cases");
  }

  // === SIMULATION SCENARIOS ===
  const existingSims = await prisma.simulationScenario.count();
  if (existingSims === 0) {
    console.log("[seed-demo] Seeding simulation scenarios...");
    const sims = [
      { key: "sim-prestea-baseline", name: "Prestea Baseline — No Intervention", description: "Current trajectory with no policy changes.", type: "baseline", region: "Western", locationName: "Prestea", lat: 5.4321, lng: -2.1456, timeHorizonMonths: 6, isBaseline: true, parameters: JSON.stringify({}), outcomes: JSON.stringify([]), illegalMiningRateChange: 0, waterQualityChange: 0, forestCoverChangeHa: 0, economicImpactGHS: 0, enforcementCostGHS: 0, netBenefitGHS: 0, confidence: 0.7 },
      { key: "sim-prestea-inspections", name: "Prestea: Increase Inspections by 50%", description: "What if we increase EPA inspection frequency by 50%?", type: "increase_inspections", region: "Western", locationName: "Prestea", lat: 5.4321, lng: -2.1456, timeHorizonMonths: 6, isBaseline: false, parameters: JSON.stringify({ inspectionIncreasePct: 50, inspectorCount: 5 }), outcomes: JSON.stringify([]), illegalMiningRateChange: -17.5, waterQualityChange: 3.0, forestCoverChangeHa: 16, economicImpactGHS: 189000, enforcementCostGHS: 105000, netBenefitGHS: 84000, confidence: 0.75 },
      { key: "sim-prestea-roads", name: "Prestea: Close 5 Access Roads + 3 Checkpoints", description: "What if we close access roads to galamsey sites?", type: "close_roads", region: "Western", locationName: "Prestea", lat: 5.4321, lng: -2.1456, timeHorizonMonths: 6, isBaseline: false, parameters: JSON.stringify({ roadsClosed: 5, checkpointsDeployed: 3 }), outcomes: JSON.stringify([]), illegalMiningRateChange: -19.2, waterQualityChange: 1.9, forestCoverChangeHa: 6, economicImpactGHS: 207000, enforcementCostGHS: 45000, netBenefitGHS: 162000, confidence: 0.78 },
      { key: "sim-prestea-combined", name: "Prestea: Combined Intervention (All 4)", description: "What if we combine all interventions?", type: "combined", region: "Western", locationName: "Prestea", lat: 5.4321, lng: -2.1456, timeHorizonMonths: 6, isBaseline: false, parameters: JSON.stringify({ inspectionIncreasePct: 50, inspectorCount: 5, roadsClosed: 5, checkpointsDeployed: 3, droneCount: 3, coverageAreaKm2: 100 }), outcomes: JSON.stringify([]), illegalMiningRateChange: -19.7, waterQualityChange: 6.6, forestCoverChangeHa: 33, economicImpactGHS: 428000, enforcementCostGHS: 240000, netBenefitGHS: 188000, confidence: 0.82 },
    ];
    for (const s of sims) {
      await prisma.simulationScenario.create({ data: s });
    }
    console.log("[seed-demo] Seeded " + sims.length + " simulation scenarios");
  }

  // === AUTONOMOUS INVESTIGATIONS ===
  const existingAuto = await prisma.autonomousInvestigation.count();
  if (existingAuto === 0) {
    console.log("[seed-demo] Seeding autonomous investigations...");
    const autos = [
      { key: "auto-inv-prestea-001", title: "Autonomous Investigation — Prestea Illegal Mining", description: "Auto-triggered when citizen reported illegal mining at Prestea.", triggerSource: "citizen_report", triggerDescription: "Citizen 'Kwame Tetteh' created intelligence event.", lat: 5.4321, lng: -2.1456, locationName: "Prestea Galamsey Site A", region: "Western", status: "monitoring", currentPhase: "monitoring", confidence: 0.82, confidenceLevel: "high", confidenceTrend: "increasing", historicalEventsFound: 7, satelliteChangesDetected: 3, affectedEntitiesCount: 4, evidenceRequested: 3, evidenceReceived: 2, recommendedAction: "dispatch_inspector", actionReasoning: "Confidence 82% (high). Satellite confirms changes. Dispatch inspector.", actionConfidence: 0.82, credibilityAssessment: "High credibility (82%). Strong corroboration from satellite + historical patterns.", reasoningChain: JSON.stringify(["Triggered by citizen report → 40%", "7 historical events found → +15%", "3 satellite changes → +20%", "4 affected entities → +8%", "Final: 82% (high)"]), triggeredAt: new Date(Date.now() - 3 * 86400000), lastUpdated: new Date(Date.now() - 2 * 3600000) },
      { key: "auto-inv-atewa-002", title: "Autonomous Investigation — Atewa Forest Deforestation", description: "Auto-triggered by CV detection of forest loss.", triggerSource: "cv_detection", triggerDescription: "CV detected forest_loss 91% confidence.", lat: 6.1667, lng: -0.5500, locationName: "Atewa Forest Reserve", region: "Eastern", status: "monitoring", currentPhase: "monitoring", confidence: 0.91, confidenceLevel: "very_high", confidenceTrend: "increasing", historicalEventsFound: 3, satelliteChangesDetected: 5, affectedEntitiesCount: 6, evidenceRequested: 3, evidenceReceived: 3, recommendedAction: "escalate", actionReasoning: "Confidence 91% (very high). Protected forest. Escalate to national.", actionConfidence: 0.91, credibilityAssessment: "Very high credibility (91%). Protected forest reserve affected.", reasoningChain: JSON.stringify(["Triggered by CV detection → 75%", "3 historical → +9%", "5 satellite → +7%", "All evidence received → +3%", "Final: 91% (very high)"]), triggeredAt: new Date(Date.now() - 5 * 86400000), lastUpdated: new Date(Date.now() - 6 * 3600000) },
    ];
    for (const a of autos) {
      await prisma.autonomousInvestigation.create({ data: { ...a, nearbyEventIds: JSON.stringify([]), affectedEntityIds: JSON.stringify([]), missionIds: JSON.stringify([]), satelliteSceneIds: JSON.stringify([]), metadata: JSON.stringify({ seed: true }) } });
    }
    console.log("[seed-demo] Seeded " + autos.length + " autonomous investigations");
  }

  // === SECURITY DATA ===
  const existingSec = await prisma.securityEvent.count();
  if (existingSec === 0) {
    console.log("[seed-demo] Seeding security data...");
    // Security policies
    const policies = [
      { key: "policy-zero-trust", name: "Zero Trust Access Policy", domain: "zero_trust", description: "mTLS + device posture + continuous auth", config: JSON.stringify({ mTLS: true }), complianceScore: 0.92, violationCount: 2 },
      { key: "policy-encryption", name: "Encryption Policy", domain: "encryption", description: "AES-256 at rest, TLS 1.3 in transit", config: JSON.stringify({ atRest: "AES-256-GCM" }), complianceScore: 0.98, violationCount: 0 },
      { key: "policy-waf", name: "WAF Rules Policy", domain: "waf", description: "OWASP Top 10 protection", config: JSON.stringify({ owaspTop10: true }), complianceScore: 0.88, violationCount: 45 },
    ];
    for (const p of policies) {
      await prisma.securityPolicy.create({ data: { ...p, enforcementMode: "enforce", isActive: true, lastCheckedAt: new Date() } });
    }
    // Security events
    const secEvents = [
      { domain: "waf", type: "waf_blocked", severity: "high", status: "resolved", title: "SQL Injection Attempt Blocked", description: "WAF blocked SQL injection on /api/v1/evidence.", sourceIp: "45.83.12.99", targetResource: "/api/v1/evidence" },
      { domain: "threat_detection", type: "brute_force_detected", severity: "critical", status: "resolved", title: "Brute Force Attack on Admin Login", description: "237 failed login attempts in 15 min.", sourceIp: "45.83.12.99", targetResource: "/api/v1/auth/signin" },
    ];
    for (const e of secEvents) {
      await prisma.securityEvent.create({ data: { ...e, detectedAt: new Date(Date.now() - 5 * 3600000) } });
    }
    console.log("[seed-demo] Seeded " + policies.length + " security policies, " + secEvents.length + " events");
  }

  // === PERFORMANCE DATA ===
  const existingPerf = await prisma.perfMetric.count();
  if (existingPerf === 0) {
    console.log("[seed-demo] Seeding performance data...");
    const metrics = [
      { domain: "users", metric: "concurrent_users", value: 42000, unit: "count", target: 500000, targetLabel: "Target: 500K", status: "good", capacityTier: "current", description: "Current concurrent users" },
      { domain: "events", metric: "events_stored", value: 12500000, unit: "count", target: 100000000, targetLabel: "Target: 100M", status: "good", capacityTier: "current", description: "Total events stored" },
      { domain: "imagery", metric: "imagery_storage", value: 850, unit: "TB", target: 2000, targetLabel: "Target: 2PB", status: "good", capacityTier: "current", description: "Imagery stored" },
      { domain: "caching", metric: "overall_hit_rate", value: 87, unit: "%", target: 95, targetLabel: "Target: >95%", status: "warning", capacityTier: "current", description: "Cache hit rate" },
      { domain: "optimization", metric: "p95_api_latency", value: 78, unit: "ms", target: 100, targetLabel: "Target: <100ms", status: "good", capacityTier: "current", description: "P95 API latency" },
    ];
    for (const m of metrics) {
      await prisma.perfMetric.create({ data: m });
    }
    // Cache stats
    await prisma.cacheStats.create({ data: { layer: "cdn", cacheName: "Cloudflare CDN", hitCount: 89000000, missCount: 4200000, hitRate: 95.5, sizeBytes: 500000000, maxBytes: 1900000000, entryCount: 45000, avgGetLatencyMs: 0.8, defaultTtlSec: 3600, status: "healthy" } });
    await prisma.cacheStats.create({ data: { layer: "redis", cacheName: "Redis Cluster", hitCount: 67000000, missCount: 8300000, hitRate: 89.0, sizeBytes: 1900000000, maxBytes: 1900000000, entryCount: 1200000, avgGetLatencyMs: 1.2, defaultTtlSec: 300, status: "healthy" } });
    console.log("[seed-demo] Seeded " + metrics.length + " perf metrics + 2 cache stats");
  }

  // === DEVELOPER DATA ===
  const existingWebhooks = await prisma.webhookEndpoint.count();
  if (existingWebhooks === 0) {
    console.log("[seed-demo] Seeding developer data...");
    await prisma.webhookEndpoint.create({ data: { key: "wh-epa-alerts", name: "EPA Alert Bot", description: "Sends fraud alerts to EPA Slack", url: "https://hooks.slack.com/services/T0/B0/XXXX", events: JSON.stringify(["alert.detected", "investigation.opened"]), secret: "whsec_a1b2c3d4", isActive: true, deliveryCount: 142, successCount: 138, failureCount: 4, lastDeliveryAt: new Date(Date.now() - 12 * 3600000), lastDeliveryStatus: "success" } });
    await prisma.apiKey.create({ data: { key: "sk_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0", keyPrefix: "sk_live_a1b2", name: "EPA Production Key", scopes: JSON.stringify(["read:evidence", "read:events", "read:investigations"]), rateLimitPerMin: 200, rateLimitPerDay: 50000, totalRequests: 15420, lastUsedAt: new Date(Date.now() - 1 * 3600000), status: "active" } });
    await prisma.sdkRelease.create({ data: { language: "javascript", version: "1.0.0", packageName: "@sentinel/sdk", registryUrl: "https://www.npmjs.com/package/@sentinel/sdk", downloadCount: 4521, isLatest: true, isStable: true, releaseNotes: "Initial release. Full REST API coverage.", minPlatformVersion: "v1", publishedAt: new Date(Date.now() - 30 * 86400000) } });
    await prisma.apiIntegration.create({ data: { key: "slack", name: "Slack", description: "Send real-time alerts to Slack channels", category: "messaging", platform: "slack", docsUrl: "https://api.slack.com/messaging/webhooks", isOfficial: true, installCount: 1240 } });
    console.log("[seed-demo] Seeded developer data (webhooks, API keys, SDK, integrations)");
  }

  // === PRODUCTION READINESS ===
  const existingProd = await prisma.prodReadinessCheck.count();
  if (existingProd === 0) {
    console.log("[seed-demo] Seeding production readiness...");
    const checks = [
      { domain: "accessibility", checkName: "wcag_keyboard_nav", description: "Keyboard navigation", status: "passed", complianceLevel: "AA" },
      { domain: "accessibility", checkName: "wcag_screen_reader", description: "Screen reader support", status: "passed", complianceLevel: "AA" },
      { domain: "i18n", checkName: "i18n_locale_switching", description: "Language switching", status: "passed", complianceLevel: "N/A" },
      { domain: "offline", checkName: "pwa_service_worker", description: "PWA service worker", status: "passed", complianceLevel: "N/A" },
      { domain: "mobile", checkName: "mobile_responsive", description: "Responsive design", status: "passed", complianceLevel: "N/A" },
      { domain: "monitoring", checkName: "monitor_uptime", description: "Uptime monitoring", status: "passed", complianceLevel: "N/A" },
      { domain: "incident_response", checkName: "ir_oncall", description: "24/7 on-call rotation", status: "passed", complianceLevel: "N/A" },
      { domain: "audit", checkName: "audit_go_no_go", description: "Final go/no-go checklist", status: "passed", complianceLevel: "N/A" },
    ];
    for (const c of checks) {
      await prisma.prodReadinessCheck.create({ data: { ...c, checkedAt: new Date() } });
    }
    // I18n locales
    const locales = [
      { locale: "en", language: "English", nativeName: "English", direction: "ltr", translationPct: 100, status: "active", totalKeys: 850, translatedKeys: 850, missingKeys: 0 },
      { locale: "fr", language: "French", nativeName: "Français", direction: "ltr", translationPct: 92, status: "active", totalKeys: 850, translatedKeys: 782, missingKeys: 68 },
      { locale: "sw", language: "Swahili", nativeName: "Kiswahili", direction: "ltr", translationPct: 85, status: "active", totalKeys: 850, translatedKeys: 723, missingKeys: 127 },
    ];
    for (const l of locales) {
      await prisma.i18nLocale.create({ data: l });
    }
    console.log("[seed-demo] Seeded " + checks.length + " readiness checks + " + locales.length + " locales");
  }

  // === CORROBORATION ===
  const existingCorr = await prisma.corroboration.count();
  if (existingCorr < 5) {
    console.log("[seed-demo] Seeding corroboration...");
    const evidenceList = await prisma.evidence.findMany({ take: 5 });
    for (let i = 0; i < evidenceList.length; i++) {
      const ev = evidenceList[i];
      if (!ev) continue;
      await prisma.corroboration.create({
        data: { evidenceId: ev.id, userId: admin.id, type: i % 3 === 0 ? "dispute" : "support", strength: 0.7 + (i * 0.05), reason: i % 3 === 0 ? "Location seems inconsistent with the report" : "I can verify this — I visited the site last week", isIndependent: i % 2 === 0 },
      }).catch(() => {});
    }
    console.log("[seed-demo] Seeded corroboration data");
  }

  // === TRUST FACTORS ===
  const existingTF = await prisma.trustFactor.count();
  if (existingTF < 5) {
    console.log("[seed-demo] Seeding trust factors...");
    const users = await prisma.user.findMany({ take: 5 });
    for (let i = 0; i < users.length; i++) {
      const u = users[i];
      if (!u) continue;
      const score = 0.3 + (i * 0.15);
      const tier = score >= 0.8 ? "elite" : score >= 0.65 ? "trusted" : score >= 0.5 ? "verified" : score >= 0.3 ? "basic" : "unverified";
      await prisma.trustFactor.upsert({
        where: { userId: u.id },
        create: { userId: u.id, accuracy: score, reliability: score + 0.05, falseReportRate: 1 - score, evidenceQuality: score - 0.05, contributionQuality: score, communityImpact: score * 0.8, fraudResistance: 1 - (i * 0.1), compositeScore: score, tier, totalReports: 3 + i * 2, verifiedReports: 1 + i, totalEvidence: 2 + i, lastActivityAt: new Date() },
        update: {},
      });
    }
    console.log("[seed-demo] Seeded trust factors");
  }

  console.log("[seed-demo] Done! All demo data seeded.");
}

main().catch(e => { console.error("[seed-demo] Failed:", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
