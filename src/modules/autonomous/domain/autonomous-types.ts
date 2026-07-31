/**
 * Sentinel — Autonomous Investigation Engine Domain
 * =============================================================================
 * When an Intelligence Event is created, the AI automatically becomes an
 * investigator. It runs through 7 phases, updating confidence Bayesianly:
 *
 *   1. triggered          — Investigation auto-triggered by event creation
 *   2. gathering_context  — Gathers nearby historical events (spatial + temporal)
 *   3. analyzing_imagery  — Compares recent vs older satellite imagery
 *   4. identifying_impacts — Identifies affected rivers, forests, communities
 *   5. requesting_evidence — Auto-creates missions for trusted nearby contributors
 *   6. reasoning           — Explains why the event is/isn't credible
 *   7. monitoring          — Continuously updates confidence as evidence arrives
 *   8. concluded           — Final assessment + action recommendation
 * =============================================================================
 */

// ---------------------------------------------------------------------------
// Investigation phases — the 7-step autonomous workflow
// ---------------------------------------------------------------------------

export type InvestigationPhase =
  | "triggered"
  | "gathering_context"
  | "analyzing_imagery"
  | "identifying_impacts"
  | "requesting_evidence"
  | "reasoning"
  | "monitoring"
  | "concluded";

export const PHASE_META: Record<
  InvestigationPhase,
  { label: string; color: string; icon: string; description: string; order: number }
> = {
  triggered: { label: "Triggered", color: "#f59e0b", icon: "Zap", description: "Investigation auto-triggered by intelligence event creation", order: 0 },
  gathering_context: { label: "Gathering Context", color: "#0ea5e9", icon: "Search", description: "Gathering nearby historical events for spatial and temporal context", order: 1 },
  analyzing_imagery: { label: "Analyzing Imagery", color: "#a855f7", icon: "Satellite", description: "Comparing recent satellite imagery with older imagery for change detection", order: 2 },
  identifying_impacts: { label: "Identifying Impacts", color: "#ef4444", icon: "AlertTriangle", description: "Identifying affected rivers, forests, protected areas, and communities", order: 3 },
  requesting_evidence: { label: "Requesting Evidence", color: "#14b8a6", icon: "Send", description: "Auto-creating missions for trusted nearby contributors to gather evidence", order: 4 },
  reasoning: { label: "Reasoning", color: "#6366f1", icon: "Brain", description: "Explaining why the event is credible or not — full reasoning chain", order: 5 },
  monitoring: { label: "Monitoring", color: "#3b82f6", icon: "Eye", description: "Continuously updating confidence as new evidence arrives", order: 6 },
  concluded: { label: "Concluded", color: "#22c55e", icon: "CheckCircle2", description: "Final assessment with action recommendation", order: 7 },
};

// ---------------------------------------------------------------------------
// Trigger sources
// ---------------------------------------------------------------------------

export type TriggerSource =
  | "citizen_report"
  | "digital_twin"
  | "satellite_change"
  | "cv_detection"
  | "ai_observation"
  | "fraud_alert"
  | "manual";

export const TRIGGER_SOURCE_META: Record<
  TriggerSource,
  { label: string; color: string; icon: string; description: string; initialConfidence: number }
> = {
  citizen_report: { label: "Citizen Report", color: "#0ea5e9", icon: "Users", description: "Triggered by a citizen creating an intelligence event", initialConfidence: 0.4 },
  digital_twin: { label: "Digital Twin", color: "#6366f1", icon: "Box", description: "Triggered by the Digital Twin detecting an anomaly", initialConfidence: 0.6 },
  satellite_change: { label: "Satellite Change", color: "#a855f7", icon: "Satellite", description: "Triggered by satellite imagery change detection", initialConfidence: 0.7 },
  cv_detection: { label: "CV Detection", color: "#ef4444", icon: "Eye", description: "Triggered by computer vision detection (excavation, forest loss, etc.)", initialConfidence: 0.75 },
  ai_observation: { label: "AI Observation", color: "#14b8a6", icon: "Brain", description: "Triggered by the AI Observation Engine", initialConfidence: 0.65 },
  fraud_alert: { label: "Fraud Alert", color: "#dc2626", icon: "AlertTriangle", description: "Triggered by a fraud detection alert", initialConfidence: 0.3 },
  manual: { label: "Manual", color: "#64748b", icon: "User", description: "Manually triggered by an operator", initialConfidence: 0.5 },
};

// ---------------------------------------------------------------------------
// Confidence levels
// ---------------------------------------------------------------------------

export type ConfidenceLevel = "very_low" | "low" | "uncertain" | "moderate" | "high" | "very_high";

export const CONFIDENCE_LEVEL_META: Record<
  ConfidenceLevel,
  { label: string; color: string; minScore: number; description: string }
> = {
  very_low: { label: "Very Low", color: "#dc2626", minScore: 0.0, description: "Event is likely not credible — possible false positive" },
  low: { label: "Low", color: "#ef4444", minScore: 0.2, description: "Limited evidence supporting the event" },
  uncertain: { label: "Uncertain", color: "#f59e0b", minScore: 0.4, description: "Insufficient evidence — more data needed" },
  moderate: { label: "Moderate", color: "#0ea5e9", minScore: 0.55, description: "Moderate evidence — event appears credible" },
  high: { label: "High", color: "#22c55e", minScore: 0.75, description: "Strong evidence — event is highly credible" },
  very_high: { label: "Very High", color: "#14b8a6", minScore: 0.9, description: "Overwhelming evidence — event is confirmed credible" },
};

// ---------------------------------------------------------------------------
// Evidence request types
// ---------------------------------------------------------------------------

export type EvidenceRequestType =
  | "photo"
  | "video"
  | "water_sample"
  | "gps_verification"
  | "witness_statement"
  | "drone_footage";

export const EVIDENCE_REQUEST_TYPE_META: Record<
  EvidenceRequestType,
  { label: string; icon: string; description: string; confidenceBoost: number }
> = {
  photo: { label: "Photo Evidence", icon: "Camera", description: "Request current photos of the site from nearby contributors", confidenceBoost: 0.08 },
  video: { label: "Video Evidence", icon: "Video", description: "Request video footage showing active operations", confidenceBoost: 0.12 },
  water_sample: { label: "Water Sample", icon: "Droplets", description: "Request water quality samples from nearby rivers", confidenceBoost: 0.15 },
  gps_verification: { label: "GPS Verification", icon: "MapPin", description: "Request GPS verification of the reported location", confidenceBoost: 0.05 },
  witness_statement: { label: "Witness Statement", icon: "Users", description: "Request witness statements from community members", confidenceBoost: 0.07 },
  drone_footage: { label: "Drone Footage", icon: "Plane", description: "Request drone footage for aerial verification", confidenceBoost: 0.20 },
};

// ---------------------------------------------------------------------------
// Action recommendations
// ---------------------------------------------------------------------------

export type ActionType =
  | "dispatch_inspector"
  | "request_drone"
  | "wait_for_corroboration"
  | "escalate"
  | "dismiss"
  | "monitor"
  | "request_lab_analysis"
  | "notify_agency";

export const ACTION_TYPE_META: Record<
  ActionType,
  { label: string; color: string; icon: string; description: string; minConfidence: number }
> = {
  dispatch_inspector: { label: "Dispatch Inspector", color: "#ef4444", icon: "ShieldCheck", description: "Send a field inspector to verify the site immediately", minConfidence: 0.65 },
  request_drone: { label: "Request Drone Imagery", color: "#a855f7", icon: "Plane", description: "Deploy a drone for aerial surveillance of the site", minConfidence: 0.55 },
  wait_for_corroboration: { label: "Wait for Corroboration", color: "#f59e0b", icon: "Clock", description: "Insufficient evidence — wait for more corroborating data", minConfidence: 0.3 },
  escalate: { label: "Escalate", color: "#dc2626", icon: "ArrowUp", description: "Escalate to higher jurisdiction or national level", minConfidence: 0.7 },
  dismiss: { label: "Dismiss", color: "#64748b", icon: "XCircle", description: "Event is not credible — dismiss as false positive", minConfidence: 0.0 },
  monitor: { label: "Continue Monitoring", color: "#0ea5e9", icon: "Eye", description: "Continue monitoring for additional evidence", minConfidence: 0.4 },
  request_lab_analysis: { label: "Request Lab Analysis", color: "#14b8a6", icon: "FlaskConical", description: "Send water/soil samples to lab for mercury/heavy metal analysis", minConfidence: 0.5 },
  notify_agency: { label: "Notify Agency", color: "#6366f1", icon: "Bell", description: "Notify EPA, Minerals Commission, or other relevant agency", minConfidence: 0.6 },
};

// ---------------------------------------------------------------------------
// Core computation functions
// ---------------------------------------------------------------------------

/**
 * Classify confidence score into a level.
 */
export function classifyConfidence(score: number): ConfidenceLevel {
  if (score >= 0.9) return "very_high";
  if (score >= 0.75) return "high";
  if (score >= 0.55) return "moderate";
  if (score >= 0.4) return "uncertain";
  if (score >= 0.2) return "low";
  return "very_low";
}

/**
 * Compute the Bayesian confidence update.
 * newConfidence = (prior × likelihood) / ((prior × likelihood) + ((1-prior) × (1-likelihood)))
 * This is the standard Bayesian update for binary hypotheses.
 */
export function bayesianUpdate(params: {
  prior: number;
  likelihood: number; // P(evidence | event is real) / P(evidence | event is fake)
}): { posterior: number; delta: number } {
  const { prior, likelihood } = params;
  // Clamp inputs
  const p = Math.min(0.99, Math.max(0.01, prior));
  const l = Math.min(10, Math.max(0.1, likelihood));
  // Bayesian update: posterior = (prior * likelihood) / (prior * likelihood + (1 - prior))
  const numerator = p * l;
  const denominator = numerator + (1 - p);
  const posterior = Math.min(0.99, Math.max(0.01, numerator / denominator));
  return { posterior: Math.round(posterior * 10000) / 10000, delta: Math.round((posterior - p) * 10000) / 10000 };
}

/**
 * Recommend the best action based on current confidence and context.
 */
export function recommendAction(params: {
  confidence: number;
  hasSatelliteChange: boolean;
  hasAffectedEntities: boolean;
  evidenceReceived: number;
  evidenceRequested: number;
  daysSinceTrigger: number;
}): { action: ActionType; reasoning: string; priority: string } {
  const { confidence, hasSatelliteChange, hasAffectedEntities, evidenceReceived, evidenceRequested, daysSinceTrigger } = params;

  // Very high confidence → dispatch inspector + notify agency
  if (confidence >= 0.9) {
    return {
      action: "dispatch_inspector",
      priority: "urgent",
      reasoning: `Confidence is ${(confidence * 100).toFixed(0)}% (very high). Satellite ${hasSatelliteChange ? "confirms" : "does not confirm"} changes. ${hasAffectedEntities ? "Affected entities identified." : "No affected entities yet."} Immediate inspector dispatch recommended.`,
    };
  }

  // High confidence → request drone + notify agency
  if (confidence >= 0.75) {
    return {
      action: "request_drone",
      priority: "high",
      reasoning: `Confidence is ${(confidence * 100).toFixed(0)}% (high). Aerial drone surveillance will provide definitive verification before dispatching inspectors.`,
    };
  }

  // Moderate confidence → monitor or request lab analysis
  if (confidence >= 0.55) {
    if (hasAffectedEntities) {
      return {
        action: "request_lab_analysis",
        priority: "medium",
        reasoning: `Confidence is ${(confidence * 100).toFixed(0)}% (moderate). Affected rivers/forests identified. Lab analysis of water/soil samples will confirm environmental impact.`,
      };
    }
    return {
      action: "monitor",
      priority: "medium",
      reasoning: `Confidence is ${(confidence * 100).toFixed(0)}% (moderate). Continue monitoring for additional evidence. ${evidenceRequested - evidenceReceived} evidence requests still pending.`,
    };
  }

  // Uncertain → wait for corroboration
  if (confidence >= 0.4) {
    if (evidenceRequested > 0 && evidenceReceived < evidenceRequested) {
      return {
        action: "wait_for_corroboration",
        priority: "medium",
        reasoning: `Confidence is ${(confidence * 100).toFixed(0)}% (uncertain). ${evidenceRequested - evidenceReceived} evidence requests still pending. Waiting for corroboration before taking action.`,
      };
    }
    return {
      action: "monitor",
      priority: "low",
      reasoning: `Confidence is ${(confidence * 100).toFixed(0)}% (uncertain). No pending evidence requests. Continuing to monitor for new data.`,
    };
  }

  // Low confidence after 7 days → dismiss
  if (confidence < 0.2 && daysSinceTrigger >= 7) {
    return {
      action: "dismiss",
      priority: "low",
      reasoning: `Confidence is ${(confidence * 100).toFixed(0)}% (very low) after ${daysSinceTrigger} days. No corroborating evidence found. Event likely a false positive.`,
    };
  }

  // Low confidence → wait
  return {
    action: "wait_for_corroboration",
    priority: "low",
    reasoning: `Confidence is ${(confidence * 100).toFixed(0)}% (low). Waiting for corroborating evidence before taking further action.`,
  };
}

/**
 * Generate the AI's credibility assessment — a human-readable explanation
 * of why the event is or isn't credible.
 */
export function generateCredibilityAssessment(params: {
  confidence: number;
  triggerSource: TriggerSource;
  historicalEventsFound: number;
  satelliteChangesDetected: number;
  affectedEntitiesCount: number;
  evidenceRequested: number;
  evidenceReceived: number;
  locationName?: string;
}): string {
  const { confidence, triggerSource, historicalEventsFound, satelliteChangesDetected, affectedEntitiesCount, evidenceRequested, evidenceReceived, locationName } = params;
  const level = classifyConfidence(confidence);
  const loc = locationName ?? "the reported location";

  const parts: string[] = [];

  // Opening
  parts.push(`Based on autonomous investigation of the event at ${loc}, the AI assesses this event as ${CONFIDENCE_LEVEL_META[level].label.toLowerCase()} credibility (${(confidence * 100).toFixed(0)}% confidence).`);

  // Trigger source reasoning
  parts.push(`The investigation was triggered by ${TRIGGER_SOURCE_META[triggerSource].label.toLowerCase()}, which provides an initial confidence of ${(TRIGGER_SOURCE_META[triggerSource].initialConfidence * 100).toFixed(0)}%.`);

  // Historical context
  if (historicalEventsFound > 0) {
    parts.push(`The AI found ${historicalEventsFound} historical event(s) in the vicinity, suggesting this is an area with a pattern of similar activity. This ${historicalEventsFound > 3 ? "strongly supports" : "moderately supports"} the credibility of the current event.`);
  } else {
    parts.push(`No historical events were found nearby, which ${confidence < 0.5 ? "slightly reduces" : "does not significantly affect"} credibility — this could be a new site.`);
  }

  // Satellite analysis
  if (satelliteChangesDetected > 0) {
    parts.push(`Satellite imagery comparison detected ${satelliteChangesDetected} change(s) — ${satelliteChangesDetected > 2 ? "significant" : "minor"} environmental modification visible between recent and older imagery. This ${satelliteChangesDetected > 2 ? "strongly corroborates" : "supports"} the reported event.`);
  } else {
    parts.push(`No satellite imagery changes were detected. This ${confidence > 0.6 ? "is concerning given the report" : "reduces confidence in the report"}.`);
  }

  // Impact analysis
  if (affectedEntitiesCount > 0) {
    parts.push(`${affectedEntitiesCount} affected entit${affectedEntitiesCount > 1 ? "ies" : "y"} (rivers, forests, communities) identified within the impact zone.`);
  }

  // Evidence gathering
  if (evidenceRequested > 0) {
    parts.push(`The AI requested ${evidenceRequested} piece(s) of additional evidence from nearby trusted contributors. ${evidenceReceived} have been received so far.`);
  }

  // Conclusion
  if (confidence >= 0.75) {
    parts.push(`Conclusion: The weight of evidence strongly supports the credibility of this event. Immediate action is recommended.`);
  } else if (confidence >= 0.55) {
    parts.push(`Conclusion: The evidence moderately supports the event's credibility, but additional verification is recommended before taking enforcement action.`);
  } else if (confidence >= 0.4) {
    parts.push(`Conclusion: Evidence is inconclusive. The AI recommends waiting for additional corroboration before taking action.`);
  } else {
    parts.push(`Conclusion: The evidence does not sufficiently support the event's credibility. The event may be a false positive, but monitoring will continue.`);
  }

  return parts.join(" ");
}
