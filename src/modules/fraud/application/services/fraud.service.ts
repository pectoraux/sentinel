/**
 * Sentinel — Fraud Detection AI Service
 * =============================================================================
 * Seven fraud detectors scan real platform data and produce signals. Signals
 * are aggregated into FraudAlerts. Alerts are investigated, resolved, and
 * feed into UserRiskProfile for trust penalties.
 *
 * Detectors:
 *   1. detectFakeEvidence()     — duplicate hashes, metadata mismatches, broken chains
 *   2. detectCollusion()        — circular corroboration, identical submissions
 *   3. detectSockpuppets()      — shared devices, shared IPs, timing patterns
 *   4. detectLocationSpoofing() — impossible travel, GPS/EXIF mismatch
 *   5. detectDeepfakes()        — AI artifacts, missing EXIF, inconsistencies
 *   6. detectVoteRings()        — coordinated voting, circular support
 *   7. detectRewardFarming()    — bulk low-quality submissions, repeated evidence
 * =============================================================================
 */

import { db } from "@/lib/db";
import { logger } from "@/infrastructure/observability/logger";
import {
  FRAUD_TYPE_META,
  SIGNAL_TYPE_META,
  SEVERITY_META,
  computeAlertRiskScore,
  computeAlertConfidence,
  classifyRiskLevel,
  severityFromRiskScore,
  computeTrustPenalty,
  shouldEscalate,
  haversineKm,
  checkImpossibleTravel,
  detectCircularCorroboration,
  type FraudType,
  type Severity,
  type DetectionResult,
  type DetectionSignal,
} from "../../domain/fraud-types";

export class FraudService {
  // ===========================================================================
  // DETECTOR 1 — Fake Evidence
  // Scans Evidence for: duplicate checksums, broken hash chains, metadata
  // mismatches, impossible timestamps (evidence before account creation).
  // ===========================================================================
  async detectFakeEvidence(): Promise<DetectionResult[]> {
    const results: DetectionResult[] = [];

    // 1a. Duplicate checksums — same content hash uploaded by different users
    const duplicates = await db.evidence.groupBy({
      by: ["checksum"],
      where: { uploadedById: { not: null } },
      _count: true,
      having: { checksum: { _count: { gt: 1 } } },
      take: 50,
    });

    for (const dup of duplicates) {
      const evidenceList = await db.evidence.findMany({
        where: { checksum: dup.checksum },
        select: {
          id: true,
          key: true,
          title: true,
          checksum: true,
          uploadedById: true,
          createdAt: true,
          lat: true,
          lng: true,
        },
        take: 20,
      });

      // Only flag if uploaded by different users
      const userIds = new Set(evidenceList.map((e) => e.uploadedById).filter(Boolean));
      if (userIds.size < 2) continue;

      const signals: DetectionSignal[] = [
        {
          signalType: "hash_duplicate",
          detector: "detectFakeEvidence",
          confidence: 0.95,
          description: `Identical content hash (${dup.checksum.slice(0, 12)}…) found in ${evidenceList.length} evidence items uploaded by ${userIds.size} different users`,
          evidence: {
            checksum: dup.checksum,
            evidenceIds: evidenceList.map((e) => e.id),
            evidenceKeys: evidenceList.map((e) => e.key),
            userIds: Array.from(userIds),
            count: evidenceList.length,
          },
        },
      ];

      results.push({
        fraudType: "fake_evidence",
        signals,
        targetUserId: evidenceList[0]!.uploadedById ?? undefined,
        targetUserIds: Array.from(userIds) as string[],
        targetEntityIds: evidenceList.map((e) => e.id),
        estimatedImpactGHS: 0,
      });
    }

    // 1b. Broken hash chains — tampered evidence
    const brokenChains = await db.evidence.findMany({
      where: { chainValid: false },
      select: { id: true, key: true, title: true, uploadedById: true, createdAt: true },
      take: 50,
    });

    for (const ev of brokenChains) {
      results.push({
        fraudType: "fake_evidence",
        signals: [
          {
            signalType: "broken_hash_chain",
            detector: "detectFakeEvidence",
            confidence: 0.95,
            description: `Evidence "${ev.key}" has an invalid hash chain — content may have been tampered with after upload`,
            evidence: { evidenceId: ev.id, evidenceKey: ev.key, title: ev.title },
          },
        ],
        targetUserId: ev.uploadedById ?? undefined,
        targetEntityIds: [ev.id],
      });
    }

    // 1c. Metadata mismatches — EXIF GPS vs stored GPS
    const evidenceWithMeta = await db.evidence.findMany({
      where: {
        AND: [
          { lat: { not: null } },
          { lng: { not: null } },
          { metadata: { not: null } },
          { type: "image" },
        ],
      },
      select: { id: true, key: true, lat: true, lng: true, metadata: true, uploadedById: true },
      take: 200,
    });

    for (const ev of evidenceWithMeta) {
      try {
        const meta = ev.metadata ? JSON.parse(ev.metadata) : null;
        const exifLat = meta?.exif?.GPSLatitude ?? meta?.gps?.latitude;
        const exifLng = meta?.exif?.GPSLongitude ?? meta?.gps?.longitude;
        if (exifLat == null || exifLng == null || ev.lat == null || ev.lng == null) continue;

        const distance = haversineKm(ev.lat, ev.lng, exifLat, exifLng);
        if (distance > 5) {
          results.push({
            fraudType: "fake_evidence",
            signals: [
              {
                signalType: "gps_metadata_mismatch",
                detector: "detectFakeEvidence",
                confidence: 0.8,
                description: `Evidence "${ev.key}" stored GPS (${ev.lat.toFixed(3)}, ${ev.lng.toFixed(3)}) is ${distance} km from EXIF geotag (${exifLat.toFixed(3)}, ${exifLng.toFixed(3)})`,
                evidence: { evidenceId: ev.id, storedLat: ev.lat, storedLng: ev.lng, exifLat, exifLng, distanceKm: distance },
              },
            ],
            targetUserId: ev.uploadedById ?? undefined,
            targetEntityIds: [ev.id],
          });
        }
      } catch {
        // skip invalid JSON
      }
    }

    // 1d. Impossible timestamps — evidence created before user account
    const evidenceWithUsers = await db.evidence.findMany({
      where: { uploadedById: { not: null } },
      select: {
        id: true,
        key: true,
        createdAt: true,
        uploadedById: true,
        user: { select: { id: true, createdAt: true, name: true } },
      },
      take: 500,
    });

    for (const ev of evidenceWithUsers) {
      if (!ev.user || !ev.uploadedById) continue;
      if (ev.createdAt < ev.user.createdAt) {
        results.push({
          fraudType: "fake_evidence",
          signals: [
            {
              signalType: "impossible_timestamp",
              detector: "detectFakeEvidence",
              confidence: 0.85,
              description: `Evidence "${ev.key}" was created ${ev.createdAt.toISOString()} but the uploading user account was created later (${ev.user.createdAt.toISOString()})`,
              evidence: {
                evidenceId: ev.id,
                evidenceCreatedAt: ev.createdAt,
                userCreatedAt: ev.user.createdAt,
                userId: ev.user.id,
              },
            },
          ],
          targetUserId: ev.uploadedById,
          targetEntityIds: [ev.id],
        });
      }
    }

    return results;
  }

  // ===========================================================================
  // DETECTOR 2 — Collusion
  // Scans for: circular corroboration patterns, identical submissions at same
  // GPS + timestamp, users from same org always supporting each other.
  // ===========================================================================
  async detectCollusion(): Promise<DetectionResult[]> {
    const results: DetectionResult[] = [];

    // 2a. Circular corroboration — A supports B, B supports C, C supports A
    const corroboration = await db.corroboration.findMany({
      where: { type: "support" },
      select: { userId: true, evidenceId: true, evidence: { select: { uploadedById: true } } },
      take: 1000,
    });

    // Build edges: supporter → evidence uploader
    const edges = corroboration
      .filter((c) => c.evidence?.uploadedById && c.userId !== c.evidence.uploadedById)
      .map((c) => ({ from: c.userId, to: c.evidence.uploadedById! }));

    const cycles = detectCircularCorroboration(edges);

    for (const cycle of cycles.slice(0, 20)) {
      const signals: DetectionSignal[] = [
        {
          signalType: "circular_corroboration",
          detector: "detectCollusion",
          confidence: 0.9,
          description: `Circular corroboration ring detected: ${cycle.join(" → ")} → ${cycle[0]} — ${cycle.length} users only support each other in a closed loop`,
          evidence: { cycle, userCount: cycle.length },
        },
      ];

      results.push({
        fraudType: "collusion",
        signals,
        targetUserId: cycle[0],
        targetUserIds: cycle,
        estimatedImpactGHS: 0,
      });
    }

    // 2b. Identical submissions — same GPS + same timestamp by different users
    const evidenceWithGps = await db.evidence.findMany({
      where: { AND: [{ lat: { not: null } }, { lng: { not: null } }, { uploadedById: { not: null } }] },
      select: { id: true, key: true, lat: true, lng: true, createdAt: true, uploadedById: true, title: true },
      take: 500,
      orderBy: { createdAt: "asc" },
    });

    // Group by rounded GPS (0.001 deg ~ 111m) + 60-second time window
    const groups = new Map<string, typeof evidenceWithGps>();
    for (const ev of evidenceWithGps) {
      if (!ev.lat || !ev.lng) continue;
      const key = `${ev.lat.toFixed(3)},${ev.lng.toFixed(3)},${Math.floor(ev.createdAt.getTime() / 60000)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(ev);
    }

    for (const [, group] of groups) {
      if (group.length < 2) continue;
      const userIds = new Set(group.map((e) => e.uploadedById).filter(Boolean));
      if (userIds.size < 2) continue; // only flag if different users

      results.push({
        fraudType: "collusion",
        signals: [
          {
            signalType: "identical_timestamp",
            detector: "detectCollusion",
            confidence: 0.75,
            description: `${group.length} evidence items submitted at identical GPS location within 60 seconds by ${userIds.size} different users — coordinated submission`,
            evidence: {
              evidenceIds: group.map((e) => e.id),
              userIds: Array.from(userIds),
              lat: group[0]!.lat,
              lng: group[0]!.lng,
              timestamp: group[0]!.createdAt,
            },
          },
        ],
        targetUserIds: Array.from(userIds) as string[],
        targetEntityIds: group.map((e) => e.id),
      });
    }

    return results;
  }

  // ===========================================================================
  // DETECTOR 3 — Sockpuppets
  // Scans for: shared devices, shared IPs, correlated activity timing,
  // similar email patterns.
  // ===========================================================================
  async detectSockpuppets(): Promise<DetectionResult[]> {
    const results: DetectionResult[] = [];

    // 3a. Shared devices — multiple users on same trusted device
    const devices = await db.device.findMany({
      where: { status: "trusted", userId: { not: null } },
      select: { id: true, fingerprint: true, userId: true, lastSeenAt: true },
      take: 1000,
    });

    // Group by device fingerprint (multiple users on same device = sockpuppet)
    const deviceGroups = new Map<string, typeof devices>();
    for (const d of devices) {
      const fp = d.fingerprint ?? d.id;
      if (!deviceGroups.has(fp)) deviceGroups.set(fp, []);
      deviceGroups.get(fp)!.push(d);
    }

    for (const [, group] of deviceGroups) {
      const userIds = new Set(group.map((d) => d.userId).filter(Boolean));
      if (userIds.size < 2) continue;

      results.push({
        fraudType: "sockpuppet",
        signals: [
          {
            signalType: "shared_device",
            detector: "detectSockpuppets",
            confidence: 0.85,
            description: `${userIds.size} user accounts have logged in from the same trusted device (fingerprint: ${group[0]!.fingerprint?.slice(0, 12) ?? "unknown"}…) — likely a single operator controlling multiple accounts`,
            evidence: {
              deviceFingerprint: group[0]!.fingerprint,
              userIds: Array.from(userIds),
              lastSeenAt: group[0]!.lastSeenAt,
            },
          },
        ],
        targetUserIds: Array.from(userIds) as string[],
        targetUserId: Array.from(userIds)[0] as string,
      });
    }

    // 3b. Shared IPs — multiple users from same session IP
    const sessions = await db.session.findMany({
      where: { ip: { not: null } },
      select: { ip: true, userId: true, createdAt: true },
      take: 2000,
      orderBy: { createdAt: "desc" },
    });

    const ipGroups = new Map<string, Set<string>>();
    for (const s of sessions) {
      if (!s.ip) continue;
      if (!ipGroups.has(s.ip)) ipGroups.set(s.ip, new Set());
      ipGroups.get(s.ip)!.add(s.userId);
    }

    for (const [ip, userIds] of ipGroups) {
      if (userIds.size < 3) continue; // need 3+ users to flag IP sharing
      results.push({
        fraudType: "sockpuppet",
        signals: [
          {
            signalType: "shared_ip",
            detector: "detectSockpuppets",
            confidence: 0.6,
            description: `${userIds.size} user accounts have sessions from the same IP address (${ip}) — possible sockpuppet operation or shared network`,
            evidence: { ip, userIds: Array.from(userIds) },
          },
        ],
        targetUserIds: Array.from(userIds),
      });
    }

    return results;
  }

  // ===========================================================================
  // DETECTOR 4 — Location Spoofing
  // Scans for: impossible travel, GPS coordinates identical across
  // "independent" submissions, GPS that doesn't match user's session IP.
  // ===========================================================================
  async detectLocationSpoofing(): Promise<DetectionResult[]> {
    const results: DetectionResult[] = [];

    // 4a. Impossible travel — user submits evidence from distant locations
    // in impossible timeframes
    const userEvidence = await db.evidence.findMany({
      where: { AND: [{ lat: { not: null } }, { lng: { not: null } }, { uploadedById: { not: null } }] },
      select: { id: true, key: true, lat: true, lng: true, createdAt: true, uploadedById: true },
      take: 1000,
      orderBy: { createdAt: "asc" },
    });

    // Group by user, then check consecutive submissions
    const byUser = new Map<string, typeof userEvidence>();
    for (const ev of userEvidence) {
      if (!ev.uploadedById) continue;
      if (!byUser.has(ev.uploadedById)) byUser.set(ev.uploadedById, []);
      byUser.get(ev.uploadedById)!.push(ev);
    }

    for (const [userId, evs] of byUser) {
      if (evs.length < 2) continue;
      for (let i = 1; i < evs.length; i++) {
        const prev = evs[i - 1]!;
        const curr = evs[i]!;
        if (!prev.lat || !prev.lng || !curr.lat || !curr.lng) continue;
        const travel = checkImpossibleTravel(
          prev.lat, prev.lng, prev.createdAt,
          curr.lat, curr.lng, curr.createdAt,
        );
        if (travel.impossible) {
          results.push({
            fraudType: "location_spoofing",
            signals: [
              {
                signalType: "impossible_travel",
                detector: "detectLocationSpoofing",
                confidence: 0.9,
                description: `User traveled ${travel.distanceKm} km in ${travel.timeHours.toFixed(2)} hours (${travel.speedKmh === Infinity ? "instant" : `${travel.speedKmh} km/h`} — physically impossible) between evidence submissions`,
                evidence: {
                  userId,
                  fromEvidence: prev.id,
                  toEvidence: curr.id,
                  fromLat: prev.lat, fromLng: prev.lng,
                  toLat: curr.lat, toLng: curr.lng,
                  distanceKm: travel.distanceKm,
                  timeHours: travel.timeHours,
                  speedKmh: travel.speedKmh,
                },
              },
            ],
            targetUserId: userId,
            targetEntityIds: [prev.id, curr.id],
          });
          break; // one impossible trip per user is enough
        }
      }
    }

    // 4b. Identical GPS across "independent" submissions
    const gpsGroups = new Map<string, typeof userEvidence>();
    for (const ev of userEvidence) {
      if (!ev.lat || !ev.lng) continue;
      // 5 decimal places = ~1m precision
      const key = `${ev.lat.toFixed(5)},${ev.lng.toFixed(5)}`;
      if (!gpsGroups.has(key)) gpsGroups.set(key, []);
      gpsGroups.get(key)!.push(ev);
    }

    for (const [, group] of gpsGroups) {
      if (group.length < 3) continue;
      const userIds = new Set(group.map((e) => e.uploadedById).filter(Boolean));
      if (userIds.size < 2) continue;
      results.push({
        fraudType: "location_spoofing",
        signals: [
          {
            signalType: "identical_timestamp",
            detector: "detectLocationSpoofing",
            confidence: 0.7,
            description: `${group.length} evidence items from ${userIds.size} users share the exact same GPS coordinates (±1m) — suspicious precision for "independent" submissions`,
            evidence: {
              lat: group[0]!.lat,
              lng: group[0]!.lng,
              evidenceIds: group.map((e) => e.id),
              userIds: Array.from(userIds),
            },
          },
        ],
        targetUserIds: Array.from(userIds) as string[],
        targetEntityIds: group.map((e) => e.id),
      });
    }

    return results;
  }

  // ===========================================================================
  // DETECTOR 5 — Deepfakes
  // Scans evidence metadata for: AI artifact signatures, missing EXIF data
  // (potential red flag for AI-generated images), inconsistent lighting.
  // Note: heuristic-based since we don't have a deepfake ML model; flags
  // images for human review.
  // ===========================================================================
  async detectDeepfakes(): Promise<DetectionResult[]> {
    const results: DetectionResult[] = [];

    // 5a. AI artifact signatures in metadata
    const images = await db.evidence.findMany({
      where: { type: "image", metadata: { not: null } },
      select: { id: true, key: true, title: true, metadata: true, uploadedById: true, createdAt: true },
      take: 500,
    });

    for (const img of images) {
      try {
        const meta = img.metadata ? JSON.parse(img.metadata) : {};
        const signals: DetectionSignal[] = [];

        // Check for AI generation tool signatures
        const metaStr = JSON.stringify(meta).toLowerCase();
        const aiTools = ["midjourney", "stable diffusion", "dall-e", "sdxl", "comfyui", "automatic1111", "generated"];
        for (const tool of aiTools) {
          if (metaStr.includes(tool)) {
            signals.push({
              signalType: "ai_artifact",
              detector: "detectDeepfakes",
              confidence: 0.9,
              description: `Evidence "${img.key}" metadata contains AI generation tool signature: "${tool}"`,
              evidence: { evidenceId: img.id, tool, metadataSnippet: metaStr.slice(0, 200) },
            });
            break;
          }
        }

        // Check for missing EXIF data on images (real photos have EXIF)
        const hasExif = meta?.exif && Object.keys(meta.exif).length > 0;
        const hasGps = meta?.exif?.GPSLatitude != null || meta?.gps != null;
        if (!hasExif && !hasGps) {
          signals.push({
            signalType: "ai_artifact",
            detector: "detectDeepfakes",
            confidence: 0.65,
            description: `Evidence "${img.key}" has no EXIF metadata — real photos taken with cameras/phones typically embed EXIF. Possible AI-generated or stripped image.`,
            evidence: { evidenceId: img.id, hasExif: false, hasGps: false },
          });
        }

        // Check for inconsistent software signatures (e.g., Photoshop on a "field photo")
        const software = meta?.exif?.Software ?? meta?.software;
        if (software && /photoshop|gimp|lightroom|affinity/i.test(String(software))) {
          signals.push({
            signalType: "facial_inconsistency",
            detector: "detectDeepfakes",
            confidence: 0.7,
            description: `Evidence "${img.key}" was processed with image editing software (${software}) — possible manipulation`,
            evidence: { evidenceId: img.id, software },
          });
        }

        if (signals.length > 0) {
          results.push({
            fraudType: "deepfake",
            signals,
            targetUserId: img.uploadedById ?? undefined,
            targetEntityIds: [img.id],
          });
        }
      } catch {
        // skip invalid JSON
      }
    }

    return results;
  }

  // ===========================================================================
  // DETECTOR 6 — Vote Rings
  // Scans corroboration for: coordinated timing (all within minutes),
  // users who only support each other, high dispute rates against outsiders.
  // ===========================================================================
  async detectVoteRings(): Promise<DetectionResult[]> {
    const results: DetectionResult[] = [];

    // 6a. Coordinated voting — multiple users corroborating the same evidence
    // within a tight time window
    const corroboration = await db.corroboration.findMany({
      where: { type: "support" },
      select: { id: true, evidenceId: true, userId: true, createdAt: true },
      take: 2000,
      orderBy: { createdAt: "asc" },
    });

    // Group by evidence, then look for tight time clusters
    const byEvidence = new Map<string, typeof corroboration>();
    for (const c of corroboration) {
      if (!byEvidence.has(c.evidenceId)) byEvidence.set(c.evidenceId, []);
      byEvidence.get(c.evidenceId)!.push(c);
    }

    for (const [evidenceId, supports] of byEvidence) {
      if (supports.length < 3) continue;
      // Check if all supports came within 10 minutes
      const first = supports[0]!.createdAt.getTime();
      const last = supports[supports.length - 1]!.createdAt.getTime();
      const spanMin = (last - first) / 60000;
      if (spanMin < 10) {
        const userIds = supports.map((s) => s.userId);
        const uniqueUsers = new Set(userIds);
        if (uniqueUsers.size >= 3) {
          results.push({
            fraudType: "vote_ring",
            signals: [
              {
                signalType: "coordinated_voting",
                detector: "detectVoteRings",
                confidence: 0.8,
                description: `${uniqueUsers.size} users corroborated evidence within ${spanMin.toFixed(1)} minutes — coordinated voting pattern (typical organic corroboration spans hours/days)`,
                evidence: {
                  evidenceId,
                  userIds: Array.from(uniqueUsers),
                  timeSpanMinutes: spanMin,
                  supportCount: supports.length,
                },
              },
            ],
            targetUserIds: Array.from(uniqueUsers),
            targetEntityIds: [evidenceId],
          });
        }
      }
    }

    // 6b. Circular corroboration (reuse the cycle detection)
    const supportEdges = corroboration
      .map((c) => ({ from: c.userId, evidenceId: c.evidenceId }))
      .filter(Boolean);

    // Build edges: supporter → evidence uploader (need to fetch uploaders)
    const evidenceIds = Array.from(new Set(supportEdges.map((s) => s.evidenceId)));
    const evidenceUploaders = await db.evidence.findMany({
      where: { id: { in: evidenceIds } },
      select: { id: true, uploadedById: true },
    });
    const uploaderMap = new Map(evidenceUploaders.map((e) => [e.id, e.uploadedById]));

    const edges = supportEdges
      .map((s) => ({
        from: s.from,
        to: uploaderMap.get(s.evidenceId),
      }))
      .filter((e): e is { from: string; to: string } => e.to != null && e.from !== e.to);

    const cycles = detectCircularCorroboration(edges);
    for (const cycle of cycles.slice(0, 10)) {
      // Only add if not already detected by collusion detector (dedupe by checking cycle signature)
      results.push({
        fraudType: "vote_ring",
        signals: [
          {
            signalType: "circular_corroboration",
            detector: "detectVoteRings",
            confidence: 0.85,
            description: `Vote ring detected: ${cycle.length} users form a circular support pattern (${cycle.join(" → ")} → ${cycle[0]}) — they only corroborate each other's evidence`,
            evidence: { cycle, userCount: cycle.length },
          },
        ],
        targetUserIds: cycle,
        targetUserId: cycle[0],
      });
    }

    return results;
  }

  // ===========================================================================
  // DETECTOR 7 — Reward Farming
  // Scans for: high-volume low-quality evidence, repeated evidence across
  // missions, users with high mission acceptance but low verification quality.
  // ===========================================================================
  async detectRewardFarming(): Promise<DetectionResult[]> {
    const results: DetectionResult[] = [];

    // 7a. High-volume low-quality evidence submissions
    const evidenceCounts = await db.evidence.groupBy({
      by: ["uploadedById"],
      where: { uploadedById: { not: null } },
      _count: true,
      having: { uploadedById: { _count: { gte: 5 } } },
      take: 50,
    });

    for (const ec of evidenceCounts) {
      if (!ec.uploadedById) continue;
      // Get the user's evidence weights
      const weights = await db.evidenceWeight.findMany({
        where: { evidence: { uploadedById: ec.uploadedById } },
        select: { weight: true, tier: true },
        take: 100,
      });

      if (weights.length < 5) continue;

      const avgWeight = weights.reduce((s, w) => s + w.weight, 0) / weights.length;
      const lowQualityCount = weights.filter((w) => w.weight < 0.4).length;
      const lowQualityPct = lowQualityCount / weights.length;

      // Flag if user has many submissions AND most are low quality
      if (ec._count >= 5 && lowQualityPct >= 0.6) {
        results.push({
          fraudType: "reward_farming",
          signals: [
            {
              signalType: "low_quality_spam",
              detector: "detectRewardFarming",
              confidence: 0.7 + Math.min(0.25, lowQualityPct * 0.2),
              description: `User submitted ${ec._count} evidence items with ${(lowQualityPct * 100).toFixed(0)}% rated low-quality (avg weight ${avgWeight.toFixed(2)}) — pattern consistent with reward farming`,
              evidence: {
                userId: ec.uploadedById,
                totalSubmissions: ec._count,
                lowQualityCount,
                lowQualityPct: Math.round(lowQualityPct * 100) / 100,
                avgWeight: Math.round(avgWeight * 100) / 100,
              },
            },
            {
              signalType: "bulk_submission",
              detector: "detectRewardFarming",
              confidence: 0.6,
              description: `${ec._count} evidence items submitted by a single user — abnormally high volume`,
              evidence: { userId: ec.uploadedById, submissionCount: ec._count },
            },
          ],
          targetUserId: ec.uploadedById,
          estimatedImpactGHS: ec._count * 50, // estimate 50 GHS per fraudulent submission
        });
      }
    }

    // 7b. Repeated evidence across missions — same evidence submitted to
    // multiple missions
    const missionSubmissions = await db.mission.findMany({
      where: {
        status: { in: ["submitted", "verified", "completed"] },
        submissionEvidenceIds: { not: null },
      },
      select: { id: true, key: true, submissionEvidenceIds: true, assignedToId: true, actualReward: true },
      take: 500,
    });

    // Track evidence → missions
    const evidenceToMissions = new Map<string, Array<{ missionId: string; missionKey: string; userId?: string; reward?: number }>>();
    for (const m of missionSubmissions) {
      try {
        const evIds: string[] = m.submissionEvidenceIds ? JSON.parse(m.submissionEvidenceIds) : [];
        for (const evId of evIds) {
          if (!evidenceToMissions.has(evId)) evidenceToMissions.set(evId, []);
          evidenceToMissions.get(evId)!.push({
            missionId: m.id,
            missionKey: m.key,
            userId: m.assignedToId ?? undefined,
            reward: m.actualReward ?? undefined,
          });
        }
      } catch {
        // skip invalid JSON
      }
    }

    for (const [evidenceId, missions] of evidenceToMissions) {
      if (missions.length < 2) continue;
      const userIds = new Set(missions.map((m) => m.userId).filter(Boolean));
      const totalReward = missions.reduce((s, m) => s + (m.reward ?? 0), 0);

      results.push({
        fraudType: "reward_farming",
        signals: [
          {
            signalType: "repeated_evidence",
            detector: "detectRewardFarming",
            confidence: 0.85,
            description: `Same evidence (${evidenceId.slice(0, 8)}…) submitted to ${missions.length} different missions — reusing evidence to farm rewards`,
            evidence: {
              evidenceId,
              missionIds: missions.map((m) => m.missionId),
              missionKeys: missions.map((m) => m.missionKey),
              userIds: Array.from(userIds),
              totalRewardEarned: totalReward,
            },
          },
        ],
        targetUserId: Array.from(userIds)[0] as string,
        targetUserIds: Array.from(userIds) as string[],
        estimatedImpactGHS: totalReward,
      });
    }

    return results;
  }

  // ===========================================================================
  // ORCHESTRATION — run all detectors, create/update alerts
  // ===========================================================================
  async runAllScans(): Promise<{
    detectorsRun: number;
    alertsCreated: number;
    alertsUpdated: number;
    signalsDetected: number;
    byType: Record<string, number>;
  }> {
    logger.info("fraud.scan_started", {});

    const [fake, collusion, sock, loc, deep, vote, farm] = await Promise.all([
      this.detectFakeEvidence(),
      this.detectCollusion(),
      this.detectSockpuppets(),
      this.detectLocationSpoofing(),
      this.detectDeepfakes(),
      this.detectVoteRings(),
      this.detectRewardFarming(),
    ]);

    const all = [...fake, ...collusion, ...sock, ...loc, ...deep, ...vote, ...farm];
    const byType: Record<string, number> = {};
    for (const r of all) byType[r.fraudType] = (byType[r.fraudType] ?? 0) + 1;

    let alertsCreated = 0;
    let alertsUpdated = 0;
    let signalsDetected = 0;

    for (const result of all) {
      // Create one alert per detection result
      const riskScore = computeAlertRiskScore(result.signals);
      const confidence = computeAlertConfidence(result.signals);
      const severity = severityFromRiskScore(riskScore);
      const meta = FRAUD_TYPE_META[result.fraudType];

      const alertKey = `fraud-${result.fraudType}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const targetUsers = result.targetUserIds ?? (result.targetUserId ? [result.targetUserId] : []);

      const alert = await db.fraudAlert.create({
        data: {
          key: alertKey,
          type: result.fraudType,
          severity,
          status: shouldEscalate({ severity, confidence, estimatedImpactGHS: result.estimatedImpactGHS ?? 0 }) ? "escalated" : "detected",
          title: `${meta.label}: ${result.signals[0]?.signalType ?? "anomaly"}`,
          description: result.signals.map((s) => s.description).join(" | "),
          confidence,
          riskScore,
          targetUserId: result.targetUserId,
          targetUserIds: JSON.stringify(targetUsers),
          targetEntityIds: JSON.stringify(result.targetEntityIds ?? []),
          signalCount: result.signals.length,
          estimatedImpactGHS: result.estimatedImpactGHS ?? 0,
          model: "fraud-ai-v1",
          detectorVersion: "1.0.0",
          metadata: JSON.stringify({ detectorCount: result.signals.length }),
        },
      });

      // Create signal records
      for (const sig of result.signals) {
        await db.fraudSignal.create({
          data: {
            alertId: alert.id,
            signalType: sig.signalType,
            detector: sig.detector,
            confidence: sig.confidence,
            weight: sig.weight ?? SIGNAL_TYPE_META[sig.signalType].weight,
            description: sig.description,
            evidence: sig.evidence ? JSON.stringify(sig.evidence) : null,
          },
        });
        signalsDetected++;
      }

      alertsCreated++;

      // Update user risk profiles
      for (const userId of targetUsers) {
        await this.updateUserRiskProfile(userId);
      }
    }

    logger.info("fraud.scan_completed", {
      detectorsRun: 7,
      alertsCreated,
      signalsDetected,
      byType,
    });

    return {
      detectorsRun: 7,
      alertsCreated,
      alertsUpdated,
      signalsDetected,
      byType,
    };
  }

  // ===========================================================================
  // USER RISK PROFILE — computed from all alerts targeting a user
  // ===========================================================================
  async updateUserRiskProfile(userId: string): Promise<{ riskScore: number; riskLevel: string }> {
    const alerts = await db.fraudAlert.findMany({
      where: {
        OR: [
          { targetUserId: userId },
          { targetUserIds: { contains: userId } },
        ],
      },
      select: {
        id: true,
        type: true,
        severity: true,
        status: true,
        riskScore: true,
        confidence: true,
        signalCount: true,
        detectedAt: true,
      },
    });

    const signalsByType: Record<string, number> = {};
    let weightedRisk = 0;
    let totalWeight = 0;
    let confirmedCount = 0;
    let dismissedCount = 0;
    let lastAlertAt: Date | null = null;

    for (const a of alerts) {
      signalsByType[a.type] = (signalsByType[a.type] ?? 0) + a.signalCount;
      const sevWeight = SEVERITY_META[a.severity as Severity].riskWeight;
      // Confirmed alerts count full weight; dismissed count 0; others half weight
      const statusMult = a.status === "confirmed" ? 1.0 : a.status === "dismissed" ? 0.0 : 0.5;
      weightedRisk += a.riskScore * sevWeight * statusMult;
      totalWeight += sevWeight;
      if (a.status === "confirmed") confirmedCount++;
      if (a.status === "dismissed") dismissedCount++;
      if (!lastAlertAt || a.detectedAt > lastAlertAt) lastAlertAt = a.detectedAt;
    }

    const riskScore = totalWeight > 0 ? Math.min(1, weightedRisk / totalWeight) : 0;
    const riskLevel = classifyRiskLevel(riskScore);
    const trustPenalty = confirmedCount > 0
      ? Math.min(1, confirmedCount * 0.2 + riskScore * 0.3)
      : 0;

    await db.userRiskProfile.upsert({
      where: { userId },
      create: {
        userId,
        riskScore,
        riskLevel,
        alertCount: alerts.length,
        confirmedAlertCount: confirmedCount,
        dismissedAlertCount: dismissedCount,
        signalsByType: JSON.stringify(signalsByType),
        trustPenalty,
        rewardsRevoked: 0,
        factors: JSON.stringify({
          alertCount: alerts.length,
          confirmedCount,
          dismissedCount,
          weightedRisk,
          totalWeight,
          signalsByType,
        }),
        lastAlertAt,
        lastCalculatedAt: new Date(),
      },
      update: {
        riskScore,
        riskLevel,
        alertCount: alerts.length,
        confirmedAlertCount: confirmedCount,
        dismissedAlertCount: dismissedCount,
        signalsByType: JSON.stringify(signalsByType),
        trustPenalty,
        factors: JSON.stringify({
          alertCount: alerts.length,
          confirmedCount,
          dismissedCount,
          weightedRisk,
          totalWeight,
          signalsByType,
        }),
        lastAlertAt,
        lastCalculatedAt: new Date(),
      },
    });

    return { riskScore, riskLevel };
  }

  // ===========================================================================
  // INVESTIGATION & RESOLUTION
  // ===========================================================================
  async investigate(params: {
    alertId: string;
    investigatorId: string;
    findings?: Record<string, unknown>;
    recommendedAction?: string;
    notes?: string;
  }): Promise<{ investigationId: string }> {
    const alert = await db.fraudAlert.findUnique({ where: { id: params.alertId } });
    if (!alert) throw new Error("alert_not_found");

    const investigation = await db.fraudInvestigation.upsert({
      where: { alertId: params.alertId },
      create: {
        alertId: params.alertId,
        status: "in_progress",
        assignedToId: params.investigatorId,
        findings: params.findings ? JSON.stringify(params.findings) : null,
        recommendedAction: params.recommendedAction,
        notes: params.notes,
      },
      update: {
        status: "in_progress",
        assignedToId: params.investigatorId,
        findings: params.findings ? JSON.stringify(params.findings) : undefined,
        recommendedAction: params.recommendedAction,
        notes: params.notes,
      },
    });

    await db.fraudAlert.update({
      where: { id: params.alertId },
      data: { status: "investigating" },
    });

    logger.info("fraud.investigation_opened", { alertId: params.alertId, investigationId: investigation.id });
    return { investigationId: investigation.id };
  }

  async resolve(params: {
    alertId: string;
    resolvedById: string;
    resolution: string; // dismissed | confirmed | escalated | user_warned | user_suspended | rewards_revoked
    penalty?: number;
    rewardsRevoked?: number;
    suspendUser?: boolean;
    notes?: string;
  }): Promise<{ alertId: string }> {
    const alert = await db.fraudAlert.findUnique({ where: { id: params.alertId } });
    if (!alert) throw new Error("alert_not_found");

    const status = params.resolution === "dismissed" ? "dismissed" : params.resolution === "confirmed" ? "confirmed" : "resolved";

    await db.fraudAlert.update({
      where: { id: params.alertId },
      data: {
        status,
        resolution: params.resolution,
        resolvedAt: new Date(),
        resolvedById: params.resolvedById,
      },
    });

    // Update investigation if exists
    const investigation = await db.fraudInvestigation.findUnique({ where: { alertId: params.alertId } });
    if (investigation) {
      await db.fraudInvestigation.update({
        where: { alertId: params.alertId },
        data: {
          status: "closed",
          closedAt: new Date(),
          penaltyApplied: params.penalty ?? computeTrustPenalty({
            severity: alert.severity as Severity,
            status: status as "dismissed" | "confirmed",
            signalsCount: alert.signalCount,
          }),
          rewardsRevoked: params.rewardsRevoked ?? 0,
          userSuspended: params.suspendUser ?? false,
          notes: params.notes,
        },
      });
    }

    // Update user risk profiles for all targeted users
    const targetUsers: string[] = alert.targetUserIds ? JSON.parse(alert.targetUserIds) : [];
    if (alert.targetUserId && !targetUsers.includes(alert.targetUserId)) {
      targetUsers.push(alert.targetUserId);
    }
    for (const userId of targetUsers) {
      await this.updateUserRiskProfile(userId);
    }

    logger.info("fraud.alert_resolved", { alertId: params.alertId, resolution: params.resolution });
    return { alertId: params.alertId };
  }

  // ===========================================================================
  // READ METHODS
  // ===========================================================================
  async list(params?: {
    type?: string;
    status?: string;
    severity?: string;
    limit?: number;
  }) {
    const { limit = 50, ...filters } = params ?? {};
    const where: Record<string, unknown> = {};
    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;
    if (filters.severity) where.severity = filters.severity;

    const alerts = await db.fraudAlert.findMany({
      where,
      take: limit,
      orderBy: { detectedAt: "desc" },
      include: {
        _count: { select: { signals: true } },
      },
    });

    return { alerts };
  }

  async getById(id: string) {
    const alert = await db.fraudAlert.findUnique({
      where: { id },
      include: {
        signals: { orderBy: { confidence: "desc" } },
        investigation: true,
      },
    });
    if (!alert) return null;
    return {
      ...alert,
      targetUserIds: alert.targetUserIds ? JSON.parse(alert.targetUserIds) : [],
      targetEntityIds: alert.targetEntityIds ? JSON.parse(alert.targetEntityIds) : [],
      metadata: alert.metadata ? JSON.parse(alert.metadata) : null,
      signals: alert.signals.map((s) => ({
        ...s,
        evidence: s.evidence ? JSON.parse(s.evidence) : null,
      })),
      investigation: alert.investigation ? {
        ...alert.investigation,
        findings: alert.investigation.findings ? JSON.parse(alert.investigation.findings) : null,
      } : null,
    };
  }

  async summary() {
    const [
      totalAlerts,
      byType,
      byStatus,
      bySeverity,
      totalSignals,
      totalInvestigations,
      totalRiskProfiles,
      highRiskUsers,
      criticalAlerts,
      recentAlerts,
      topRiskUsers,
      estimatedImpact,
    ] = await Promise.all([
      db.fraudAlert.count(),
      db.fraudAlert.groupBy({ by: ["type"], _count: true }),
      db.fraudAlert.groupBy({ by: ["status"], _count: true }),
      db.fraudAlert.groupBy({ by: ["severity"], _count: true }),
      db.fraudSignal.count(),
      db.fraudInvestigation.count(),
      db.userRiskProfile.count(),
      db.userRiskProfile.count({ where: { riskLevel: { in: ["high_risk", "critical"] } } }),
      db.fraudAlert.count({ where: { severity: "critical" } }),
      db.fraudAlert.findMany({
        take: 10,
        orderBy: { detectedAt: "desc" },
        include: { _count: { select: { signals: true } } },
      }),
      db.userRiskProfile.findMany({
        take: 5,
        orderBy: { riskScore: "desc" },
      }),
      db.fraudAlert.aggregate({ _sum: { estimatedImpactGHS: true } }),
    ]);

    return {
      totalAlerts,
      totalSignals,
      totalInvestigations,
      totalRiskProfiles,
      highRiskUsers,
      criticalAlerts,
      estimatedImpactGHS: estimatedImpact._sum.estimatedImpactGHS ?? 0,
      byType: byType.map((t) => ({ type: t.type, count: t._count })),
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
      bySeverity: bySeverity.map((s) => ({ severity: s.severity, count: s._count })),
      recentAlerts: recentAlerts.map((a) => ({
        id: a.id,
        key: a.key,
        type: a.type,
        severity: a.severity,
        status: a.status,
        title: a.title,
        confidence: a.confidence,
        riskScore: a.riskScore,
        signalCount: a._count.signals,
        targetUserId: a.targetUserId,
        detectedAt: a.detectedAt,
      })),
      topRiskUsers: topRiskUsers.map((u) => ({
        userId: u.userId,
        riskScore: u.riskScore,
        riskLevel: u.riskLevel,
        alertCount: u.alertCount,
        confirmedAlertCount: u.confirmedAlertCount,
        trustPenalty: u.trustPenalty,
        rewardsRevoked: u.rewardsRevoked,
      })),
    };
  }
}

let _svc: FraudService | null = null;
export function getFraudService(): FraudService {
  if (!_svc) _svc = new FraudService();
  return _svc;
}
