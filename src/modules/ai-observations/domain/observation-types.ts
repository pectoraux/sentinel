/**
 * Sentinel — AI Observation Domain
 * =============================================================================
 * The AI Observation Engine creates Intelligence Events from CV detection
 * results. Each observation stores:
 *   - Evidence: linked detection results
 *   - Confidence: from detection, adjusted by corroboration
 *   - Reasoning: AI-generated chain of thought
 *   - Affected entities: twin entities impacted
 *   - Historical comparison: trend analysis vs past observations
 * =============================================================================
 */

export type ObservationType =
  | "excavation"
  | "roads"
  | "tailings"
  | "forest_loss"
  | "water_changes"
  | "buildings"
  | "equipment";

export const OBSERVATION_TYPE_META: Record<string, { label: string; color: string; icon: string; severityMap: Record<string, string> }> = {
  excavation: { label: "Excavation", color: "#ef4444", icon: "Mountain", severityMap: { low: "low", medium: "high", high: "critical", critical: "critical" } },
  roads: { label: "Roads", color: "#64748b", icon: "Route", severityMap: { low: "low", medium: "medium", high: "high", critical: "critical" } },
  tailings: { label: "Tailings", color: "#f97316", icon: "Trash2", severityMap: { low: "medium", medium: "high", high: "critical", critical: "critical" } },
  forest_loss: { label: "Forest Loss", color: "#22c55e", icon: "TreePine", severityMap: { low: "medium", medium: "high", high: "critical", critical: "critical" } },
  water_changes: { label: "Water Changes", color: "#0ea5e9", icon: "Droplets", severityMap: { low: "medium", medium: "high", high: "critical", critical: "critical" } },
  buildings: { label: "Buildings", color: "#a78bfa", icon: "Building2", severityMap: { low: "low", medium: "medium", high: "high", critical: "critical" } },
  equipment: { label: "Equipment", color: "#14b8a6", icon: "Truck", severityMap: { low: "low", medium: "medium", high: "high", critical: "critical" } },
};

export type TrendDirection = "increasing" | "decreasing" | "stable" | "new";

export const TREND_META: Record<TrendDirection, { label: string; color: string; icon: string }> = {
  increasing: { label: "Increasing", color: "#ef4444", icon: "TrendingUp" },
  decreasing: { label: "Decreasing", color: "#22c55e", icon: "TrendingDown" },
  stable: { label: "Stable", color: "#64748b", icon: "Minus" },
  new: { label: "New Detection", color: "#0ea5e9", icon: "Sparkles" },
};

/**
 * Generate AI reasoning from a detection result.
 * This produces a structured chain of thought explaining why the AI created
 * this observation.
 */
export function generateReasoning(params: {
  type: string;
  detected: boolean;
  confidence: number;
  description: string;
  severity?: string;
  area?: { areaHectares?: number; percentage?: number };
  historicalCount: number;
  trend: TrendDirection;
}): { reasoning: string; steps: string[] } {
  const steps: string[] = [];

  // Step 1: Detection
  steps.push(
    `1. VISION ANALYSIS: The AI vision model analyzed the satellite/drone imagery and ${params.detected ? `detected ${params.type.replace(/_/g, " ")} with ${Math.round(params.confidence * 100)}% confidence` : "did not detect the target feature"}.`
  );

  // Step 2: Description
  steps.push(
    `2. OBSERVATION: ${params.description.slice(0, 300)}`
  );

  // Step 3: Severity assessment
  if (params.severity) {
    steps.push(
      `3. SEVERITY ASSESSMENT: Classified as ${params.severity.toUpperCase()} severity based on the extent and intensity of the detected activity.`
    );
  }

  // Step 4: Area impact
  if (params.area?.areaHectares) {
    steps.push(
      `4. IMPACT AREA: Estimated affected area of ${params.area.areaHectares} hectares.`
    );
  } else if (params.area?.percentage) {
    steps.push(
      `4. IMPACT AREA: Estimated ${params.area.percentage}% of the analyzed area is affected.`
    );
  }

  // Step 5: Historical comparison
  if (params.historicalCount === 0) {
    steps.push(
      `5. HISTORICAL COMPARISON: This is the FIRST detection of ${params.type.replace(/_/g, " ")} in this area. No prior observations exist for comparison.`
    );
  } else {
    const trendText = params.trend === "increasing" ? "an INCREASING trend" :
      params.trend === "decreasing" ? "a DECREASING trend" : "a STABLE pattern";
    steps.push(
      `5. HISTORICAL COMPARISON: ${params.historicalCount} prior observation(s) of ${params.type.replace(/_/g, " ")} exist in this area, showing ${trendText}.`
    );
  }

  // Step 6: Conclusion
  steps.push(
    `6. CONCLUSION: Based on ${Math.round(params.confidence * 100)}% confidence${params.severity ? ` and ${params.severity} severity` : ""}, an Intelligence Event has been ${params.detected ? "created" : "logged"} to alert relevant authorities and stakeholders.`
  );

  const reasoning = steps.join("\n\n");
  return { reasoning, steps };
}

/**
 * Determine the trend by comparing current confidence with historical observations.
 */
export function computeTrend(
  currentConfidence: number,
  historicalConfidences: number[]
): { trend: TrendDirection; changePercent: number } {
  if (historicalConfidences.length === 0) {
    return { trend: "new", changePercent: 0 };
  }

  const avgHistorical = historicalConfidences.reduce((a, b) => a + b, 0) / historicalConfidences.length;
  const changePercent = avgHistorical > 0 ? ((currentConfidence - avgHistorical) / avgHistorical) * 100 : 0;

  if (Math.abs(changePercent) < 10) {
    return { trend: "stable", changePercent };
  }

  return {
    trend: changePercent > 0 ? "increasing" : "decreasing",
    changePercent,
  };
}

/**
 * Map detection types to affected twin entity types.
 */
export function mapAffectedEntities(type: string): string[] {
  const mapping: Record<string, string[]> = {
    excavation: ["mine", "concession", "protected_area"],
    roads: ["road", "mine", "community"],
    tailings: ["mine", "river", "protected_area"],
    forest_loss: ["forest", "protected_area"],
    water_changes: ["river", "lake", "community"],
    buildings: ["mine", "community", "concession"],
    equipment: ["mine", "concession", "equipment"],
  };
  return mapping[type] ?? [];
}
