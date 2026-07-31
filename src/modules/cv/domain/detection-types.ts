/**
 * Sentinel — Computer Vision Domain
 * =============================================================================
 * Detection types for environmental monitoring. Each type has a specialized
 * VLM prompt that instructs the vision model to look for specific features
 * in satellite/drone imagery of mining areas.
 * =============================================================================
 */

export type DetectionType =
  | "excavation"
  | "roads"
  | "tailings"
  | "forest_loss"
  | "water_changes"
  | "buildings"
  | "equipment";

export interface DetectionTypeMeta {
  type: DetectionType;
  label: string;
  description: string;
  color: string;
  icon: string;
  // The VLM prompt instructs the model to detect this specific feature
  prompt: string;
  // Default confidence threshold (below this, detected=false)
  threshold: number;
}

export const DETECTION_TYPES: DetectionTypeMeta[] = [
  {
    type: "excavation",
    label: "Excavation",
    description: "Open-pit mining, surface excavation, earth removal, galamsey pits",
    color: "#ef4444",
    icon: "Mountain",
    prompt: `Analyze this satellite/drone image of a mining area in Ghana. 
Look for signs of EXCAVATION activity: open-pit mining, surface digging, earth removal, 
unauthorized mining pits (galamsey), exposed soil from digging, terraced excavation, 
or fresh earthworks. 

Respond in this exact JSON format:
{"detected": true/false, "confidence": 0.0-1.0, "description": "what you see", "severity": "low|medium|high|critical", "area_hectares": estimated_number, "details": "additional observations"}

If no excavation is visible, set detected=false and confidence to your certainty that it's absent.`,
    threshold: 0.5,
  },
  {
    type: "roads",
    label: "Roads",
    description: "Access roads, mining tracks, new road construction",
    color: "#64748b",
    icon: "Route",
    prompt: `Analyze this satellite/drone image. Look for ROADS and access tracks: 
paved roads, unpaved roads, mining access roads, new road construction, footpaths, 
or vehicle tracks. Pay special attention to newly constructed roads that may indicate 
recent mining activity.

Respond in this exact JSON format:
{"detected": true/false, "confidence": 0.0-1.0, "description": "what you see", "road_count": number, "details": "road types and conditions"}`,
    threshold: 0.5,
  },
  {
    type: "tailings",
    label: "Tailings",
    description: "Mining waste, tailings ponds, spoil heaps, waste dumps",
    color: "#f97316",
    icon: "Trash2",
    prompt: `Analyze this satellite/drone image of a mining area. Look for TAILINGS: 
mining waste material, tailings ponds or dams, spoil heaps, waste rock dumps, 
slurry deposits, or contaminated runoff. These appear as discolored areas, 
ponds with unnatural colors, or piled material near mining sites.

Respond in this exact JSON format:
{"detected": true/false, "confidence": 0.0-1.0, "description": "what you see", "severity": "low|medium|high|critical", "area_hectares": estimated_number, "details": "tailings type and condition"}`,
    threshold: 0.5,
  },
  {
    type: "forest_loss",
    label: "Forest Loss",
    description: "Deforestation, canopy clearing, vegetation removal",
    color: "#22c55e",
    icon: "TreePine",
    prompt: `Analyze this satellite/drone image. Look for FOREST LOSS: deforestation, 
canopy clearing, vegetation removal, burned areas, logging, or land use change 
from forest to bare ground. Look for the boundary between intact forest and 
cleared areas.

Respond in this exact JSON format:
{"detected": true/false, "confidence": 0.0-1.0, "description": "what you see", "severity": "low|medium|high|critical", "area_hectares": estimated_number, "percentage_lost": estimated_percent, "details": "forest type and clearing pattern"}`,
    threshold: 0.5,
  },
  {
    type: "water_changes",
    label: "Water Changes",
    description: "River pollution, sedimentation, water diversion, contamination",
    color: "#0ea5e9",
    icon: "Droplets",
    prompt: `Analyze this satellite/drone image near water bodies. Look for WATER CHANGES: 
river pollution (discoloration, turbidity), sedimentation, water diversion, 
unnatural water colors (blue-green from chemicals, brown from sediment), 
reduced water flow, or new water bodies from mining activity.

Respond in this exact JSON format:
{"detected": true/false, "confidence": 0.0-1.0, "description": "what you see", "severity": "low|medium|high|critical", "water_type": "river|lake|pond|stream", "details": "pollution indicators and water quality"}`,
    threshold: 0.5,
  },
  {
    type: "buildings",
    label: "Buildings",
    description: "Mining infrastructure, processing facilities, settlements",
    color: "#a78bfa",
    icon: "Building2",
    prompt: `Analyze this satellite/drone image. Look for BUILDINGS and infrastructure: 
mining processing facilities, workshops, warehouses, worker settlements, 
temporary structures, or permanent buildings near mining sites. 
Distinguish between industrial buildings and residential structures.

Respond in this exact JSON format:
{"detected": true/false, "confidence": 0.0-1.0, "description": "what you see", "building_count": estimated_number, "building_type": "industrial|residential|mixed", "details": "structure types and conditions"}`,
    threshold: 0.5,
  },
  {
    type: "equipment",
    label: "Equipment",
    description: "Mining machinery, excavators, vehicles, processing equipment",
    color: "#14b8a6",
    icon: "Truck",
    prompt: `Analyze this satellite/drone image of a mining area. Look for EQUIPMENT: 
excavators, bulldozers, mining trucks, processing equipment, pumps, generators, 
or other heavy machinery. Estimate the number and type of equipment visible.

Respond in this exact JSON format:
{"detected": true/false, "confidence": 0.0-1.0, "description": "what you see", "equipment_count": estimated_number, "equipment_types": ["list", "of", "types"], "details": "equipment condition and activity level"}`,
    threshold: 0.5,
  },
];

export function getDetectionType(type: string): DetectionTypeMeta | undefined {
  return DETECTION_TYPES.find((t) => t.type === type);
}

/**
 * Parse the VLM response into structured detection data.
 * The VLM is instructed to return JSON, but we handle malformed responses gracefully.
 */
export interface ParsedDetection {
  detected: boolean;
  confidence: number;
  description: string;
  severity?: string;
  area?: { areaHectares?: number; percentage?: number };
  details?: string;
  rawResponse: string;
}

export function parseDetectionResponse(rawResponse: string): ParsedDetection {
  // Try to extract JSON from the response
  try {
    // Find JSON object in the response
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        detected: Boolean(parsed.detected),
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
        description: parsed.description || rawResponse.slice(0, 500),
        severity: parsed.severity,
        area: parsed.area_hectares != null || parsed.percentage_lost != null
          ? { areaHectares: parsed.area_hectares, percentage: parsed.percentage_lost }
          : undefined,
        details: parsed.details,
        rawResponse,
      };
    }
  } catch {
    // JSON parse failed — treat as text response
  }

  // Fallback: analyze the text response
  const lower = rawResponse.toLowerCase();
  const detected = !lower.includes("not detected") && !lower.includes("no excavation") && 
    !lower.includes("no roads") && !lower.includes("no tailings") && !lower.includes("no forest loss") &&
    !lower.includes("no water") && !lower.includes("no buildings") && !lower.includes("no equipment") &&
    !lower.includes("not visible") && !lower.includes("none visible");
  
  return {
    detected,
    confidence: detected ? 0.7 : 0.3,
    description: rawResponse.slice(0, 500),
    rawResponse,
  };
}
