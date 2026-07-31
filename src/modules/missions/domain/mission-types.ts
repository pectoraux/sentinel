/**
 * Sentinel — Mission System Domain
 * =============================================================================
 * When confidence is low, AI creates missions to gather additional evidence.
 * Nearby trusted users receive the mission. Rewards depend on verification quality.
 * =============================================================================
 */

export type MissionType =
  | "evidence_gathering"
  | "verification"
  | "inspection"
  | "drone_survey"
  | "sensor_check"
  | "witness_interview";

export const MISSION_TYPE_META: Record<MissionType, { label: string; icon: string; color: string; description: string }> = {
  evidence_gathering: { label: "Evidence Gathering", icon: "Camera", color: "#0ea5e9", description: "Collect photos, videos, or audio at the target location" },
  verification: { label: "Verification", icon: "CheckCircle", color: "#22c55e", description: "Verify a reported event by visiting the site" },
  inspection: { label: "Inspection", icon: "ClipboardCheck", color: "#f59e0b", description: "Formal inspection of a mining site or facility" },
  drone_survey: { label: "Drone Survey", icon: "Plane", color: "#14b8a6", description: "Conduct a drone flyover to capture aerial evidence" },
  sensor_check: { label: "Sensor Check", icon: "Cpu", color: "#a78bfa", description: "Check and calibrate sensor readings at the location" },
  witness_interview: { label: "Witness Interview", icon: "Users", color: "#ef4444", description: "Interview community members about the event" },
};

export type MissionPriority = "low" | "medium" | "high" | "urgent";

export const PRIORITY_META: Record<MissionPriority, { label: string; color: string; rewardMultiplier: number }> = {
  low: { label: "Low", color: "#64748b", rewardMultiplier: 1.0 },
  medium: { label: "Medium", color: "#0ea5e9", rewardMultiplier: 1.5 },
  high: { label: "High", color: "#f59e0b", rewardMultiplier: 2.0 },
  urgent: { label: "Urgent", color: "#ef4444", rewardMultiplier: 3.0 },
};

export type VerificationQuality = "low" | "medium" | "high" | "excellent";

export const QUALITY_META: Record<VerificationQuality, { label: string; multiplier: number; color: string }> = {
  low: { label: "Low", multiplier: 0.5, color: "#ef4444" },
  medium: { label: "Medium", multiplier: 1.0, color: "#f59e0b" },
  high: { label: "High", multiplier: 1.5, color: "#0ea5e9" },
  excellent: { label: "Excellent", multiplier: 2.0, color: "#22c55e" },
};

export type MissionStatus = "open" | "assigned" | "in_progress" | "submitted" | "verified" | "completed" | "expired" | "cancelled";

export const STATUS_META: Record<MissionStatus, { label: string; color: string }> = {
  open: { label: "Open", color: "#0ea5e9" },
  assigned: { label: "Assigned", color: "#8b5cf6" },
  in_progress: { label: "In Progress", color: "#f59e0b" },
  submitted: { label: "Submitted", color: "#14b8a6" },
  verified: { label: "Verified", color: "#22c55e" },
  completed: { label: "Completed", color: "#64748b" },
  expired: { label: "Expired", color: "#ef4444" },
  cancelled: { label: "Cancelled", color: "#64748b" },
};

/**
 * Calculate the reward for a mission based on verification quality.
 * Reward = baseReward × priorityMultiplier × qualityMultiplier
 */
export function calculateReward(params: {
  baseReward: number;
  priority: MissionPriority;
  quality: VerificationQuality;
}): { actualReward: number; qualityMultiplier: number } {
  const priorityMult = PRIORITY_META[params.priority].rewardMultiplier;
  const qualityMult = QUALITY_META[params.quality].multiplier;
  const actualReward = Math.round(params.baseReward * priorityMult * qualityMult);
  return { actualReward, qualityMultiplier: qualityMult };
}

/**
 * Generate AI mission instructions based on the trigger and target.
 */
export function generateMissionInstructions(params: {
  type: MissionType;
  locationName: string;
  radiusM: number;
  triggerDescription: string;
}): string {
  const typeInstructions: Record<MissionType, string> = {
    evidence_gathering: `Travel to within ${params.radiusM}m of ${params.locationName}. Take clear photos and/or video of the area, focusing on any visible environmental damage, mining activity, or water quality issues. Ensure GPS metadata is enabled on your device. ${params.triggerDescription}`,
    verification: `Visit the reported site at ${params.locationName} (within ${params.radiusM}m) to verify the intelligence event. Document what you observe with photos and notes. Confirm or deny the reported activity. ${params.triggerDescription}`,
    inspection: `Conduct a formal inspection of the site at ${params.locationName}. Check for compliance with environmental regulations. Document findings with photos, measurements, and field notes. ${params.triggerDescription}`,
    drone_survey: `Deploy a drone to survey the area within ${params.radiusM}m of ${params.locationName}. Capture aerial imagery showing the extent of any mining activity, deforestation, or water contamination. Fly at 100-200m altitude for overview, then lower for detail. ${params.triggerDescription}`,
    sensor_check: `Visit the sensor station near ${params.locationName} (within ${params.radiusM}m). Check sensor readings, verify calibration, and document any anomalies. Take photos of the sensor display and surrounding conditions. ${params.triggerDescription}`,
    witness_interview: `Interview community members near ${params.locationName} (within ${params.radiusM}m) about the reported environmental event. Record their observations with audio (with consent). Note names, dates, and specific details about what they witnessed. ${params.triggerDescription}`,
  };
  return typeInstructions[params.type];
}

/**
 * Determine which trust tiers are eligible for a mission.
 * Higher priority missions require higher trust tiers.
 */
export function getEligibleTiers(priority: MissionPriority): string[] {
  switch (priority) {
    case "urgent": return ["trusted", "elite"];
    case "high": return ["verified", "trusted", "elite"];
    case "medium": return ["basic", "verified", "trusted", "elite"];
    case "low": return ["basic", "verified", "trusted", "elite"];
  }
}
