/**
 * Engine wire types — the `ChartCalculationResponse` JSON exactly as the Rust
 * engine serializes it, plus the render-side `Placement` derived from it.
 *
 * Sources (cross-checked 2026-08-14):
 *  - Rust: kairos-engine crates/kairos-core/src/graph/serializable.rs
 *    (`SerializableCombinedGraph` + friends — `#[derive(Serialize)]`, so the
 *    wire keys are the snake_case Rust field names; `sign_placement` /
 *    `aspect_type` are fieldless enums → PascalCase variant strings;
 *    `chart_id` is a `Uuid` → string; `datetime` is RFC3339).
 *  - Swift: kairos-engine swift/KairosCore/Sources/KairosCore/Engine/DTOs/
 *    {ChartResponseDTO,CelestialDTO,HouseDTO}.swift (the Codable mirrors).
 *  - The fixture: `../fixtures/engine/sibly-1776.json` (real engine output;
 *    where it and the Swift structs disagree, THE FIXTURE WINS — noted below).
 *
 * Fixture-verified notes:
 *  - `position.latitude/distance/speed_*` are ALWAYS present (Rust fills
 *    `Option`s with 0.0 before serializing); Swift decodes them as optionals
 *    and defaults `?? 0.0` at its Placement boundary. `right_ascension` /
 *    `declination` are `skip_serializing_if = None` — present for planets,
 *    absent for dynamic stars; the FFI path sends `Some(0.0)` for angles so
 *    they ARE present there.
 *  - `body` is the Rust `get_name()` string — "Sun", "MeanNode" (NO space!),
 *    "SouthNodeMean", "Imum Coeli". NOT the display names iOS's own comments
 *    claim ("Mean Node"). See `placementFromNode` for the normalization.
 *  - `id` is `body.to_lowercase().replace(" ", "_")` — "sun", "meannode"
 *    (no space → no underscore), "southnodemean", "imum_coeli". Aspect edge
 *    `from`/`to` are the same ids, so `Placement.id` must stay RAW for
 *    endpoint resolution.
 */

import { CELESTIAL_BODIES, type CelestialBodyId } from "../schema/enums.gen";

// =============================================================================
// Wire DTOs (snake_case, as on the wire)
// =============================================================================

export interface PositionDTO {
  longitude: number;
  latitude: number;
  distance: number;
  speed_longitude: number;
  speed_latitude: number;
  speed_distance: number;
  right_ascension?: number;
  declination?: number;
}

export interface CelestialNodeDTO {
  id: string;
  /** Rust `get_name()` — display-ish, but "MeanNode"/"SouthNodeMean" (no space). */
  body: string;
  /** Swiss-Ephemeris/custom numeric id (sun=0 … meanNode=10, trueNode=11, angles 2001+). */
  body_id: number;
  /** "planet" | "node" | "point" | "angle" | "asteroid" | "fixed_star" | "sign" | "house". */
  node_type?: string;
  position: PositionDTO;
  /** 1–12; `null` for angles/lots (the FFI assigns no house to those). */
  house_placement?: number | null;
  /** Sign enum variant name: "Aries" … "Pisces". */
  sign_placement: string;
}

export interface AspectEdgeDTO {
  /** Node id (e.g. "sun", "meannode") — matches CelestialNodeDTO.id. */
  from: string;
  to: string;
  /** AspectType variant name: "Conjunction", "Opposition", "Trine", … */
  aspect_type: string;
  orb: number;
  strength: number;
  is_applying: boolean;
}

export interface CelestialGraphDTO {
  nodes: CelestialNodeDTO[];
  edges: AspectEdgeDTO[];
}

export interface HouseNodeDTO {
  id: string; // "house_1" … "house_12"
  house_number: number;
  cusp_longitude: number;
  sign_on_cusp: string;
  size_degrees: number;
}

export interface HouseEdgeDTO {
  from: string;
  to: string;
  relationship: string; // "opposition" | "trine" | "square" | "sextile"
}

export interface HouseGraphDTO {
  nodes: HouseNodeDTO[];
  edges: HouseEdgeDTO[];
}

export interface CoordinatesDTO {
  latitude: number;
  longitude: number;
  elevation: number;
}

export interface LocationInfoDTO {
  name: string;
  country: string;
  region?: string | null;
  timezone: string;
}

export interface ChartMetadataDTO {
  /** UUID string — a FRESH one per calculation (`Chart::new`), never stable. */
  chart_id: string;
  /** ChartType debug string: "Natal" | "Transit" | "Progressed" | "Composite". */
  chart_type: string;
  /** RFC3339, e.g. "1776-07-04T22:10:00Z". */
  datetime: string;
  coordinates: CoordinatesDTO;
  location_info?: LocationInfoDTO | null;
  is_time_variant: boolean;
}

export interface ChartCalculationResponse {
  celestial: CelestialGraphDTO;
  houses: HouseGraphDTO;
  chart_metadata: ChartMetadataDTO;
}

// =============================================================================
// Wire → enums.gen id resolution (mirrors Swift CelestialBody.fromBodyId /
// fromBackendName in CelestialBody.generated.swift)
// =============================================================================

/**
 * Numeric `body_id` → enums.gen key. Mirrors Swift `CelestialBody.fromBodyId`
 * case-for-case (both derive from codegen/celestial_bodies.yaml `rust_id`).
 * Swift maps BOTH lunar-node variants (10 Mean, 11 True) and both south-node
 * variants (23/24) onto the single rahu/ketu cases, and both Lilith variants
 * (12/13) onto blackMoonLilith. 2006 (AntiVertex) is deliberately unmapped —
 * Swift returns nil there too.
 */
export const BODY_ID_TO_BODY_KEY: Readonly<Record<number, CelestialBodyId>> = {
  0: "sun",
  1: "moon",
  2: "mercury",
  3: "venus",
  4: "mars",
  5: "jupiter",
  6: "saturn",
  7: "uranus",
  8: "neptune",
  9: "pluto",
  10: "rahu",
  11: "rahu",
  12: "blackMoonLilith",
  13: "blackMoonLilith",
  15: "chiron",
  16: "pholus",
  17: "ceres",
  18: "pallas",
  19: "juno",
  20: "vesta",
  23: "ketu",
  24: "ketu",
  1001: "regulus",
  1002: "spica",
  1003: "antares",
  1004: "aldebaran",
  1005: "sirius",
  1006: "vega",
  1007: "capella",
  1008: "rigel",
  1009: "procyon",
  1010: "betelgeuse",
  1011: "altair",
  1012: "fomalhaut",
  1013: "algol",
  2001: "ascendant",
  2002: "midheaven",
  2003: "descendant",
  2004: "imumCoeli",
  2005: "vertex",
  2007: "fortune",
  2008: "spirit",
  2009: "lotOfEros",
  10433: "eros",
};

/**
 * Name fallback (Swift `fromBackendName`, case-insensitive): the engine's
 * `get_name()` spellings ("MeanNode", "Imum Coeli", "Lot of Spirit", …) plus
 * the display names. Only consulted when the numeric id is unknown.
 */
const BODY_NAME_ALIASES: Readonly<Record<string, CelestialBodyId>> = {
  meannode: "rahu",
  truenode: "rahu",
  "mean node": "rahu",
  "true node": "rahu",
  "north node": "rahu",
  rahu: "rahu",
  southnodemean: "ketu",
  southnodetrue: "ketu",
  southnode: "ketu",
  "south node": "ketu",
  ketu: "ketu",
  meanapogee: "blackMoonLilith",
  oscuapogee: "blackMoonLilith",
  "mean apogee": "blackMoonLilith",
  "osculating apogee": "blackMoonLilith",
  "black moon lilith": "blackMoonLilith",
  imumcoeli: "imumCoeli",
  "imum coeli": "imumCoeli",
  partoffortune: "fortune",
  "part of fortune": "fortune",
  fortune: "fortune",
  lotofsoul: "spirit",
  "lot of soul": "spirit",
  "lot of spirit": "spirit",
  spirit: "spirit",
  lotoferos: "lotOfEros",
  "lot of eros": "lotOfEros",
  vertex: "vertex",
};

/** Lazily-built lowercase displayName → key inverse (covers every body plainly). */
let DISPLAY_NAME_INVERSE: Map<string, CelestialBodyId> | undefined;
function displayNameInverse(): Map<string, CelestialBodyId> {
  if (!DISPLAY_NAME_INVERSE) {
    DISPLAY_NAME_INVERSE = new Map(
      Object.entries(CELESTIAL_BODIES).map(([key, info]) => [
        info.displayName.toLowerCase(),
        key,
      ]),
    );
  }
  return DISPLAY_NAME_INVERSE;
}

/**
 * Resolve a wire node to an enums.gen body id. Order mirrors Swift
 * `Placement.celestialBody`: numeric `body_id` first, name fallback second.
 * Returns undefined for bodies outside the app's vocabulary (Swift nil).
 */
export function bodyKeyFromNode(node: CelestialNodeDTO): CelestialBodyId | undefined {
  const byId = BODY_ID_TO_BODY_KEY[node.body_id];
  if (byId !== undefined) return byId;
  const lower = node.body.toLowerCase();
  return BODY_NAME_ALIASES[lower] ?? displayNameInverse().get(lower);
}

// =============================================================================
// Placement
// =============================================================================

/**
 * Render-side placement. Mirrors kairos-engine KairosCore
 * `ChartModel/Placement.swift` as consumed by `PresetConfigurationBuilder`,
 * with two deliberate TS divergences:
 *
 *  - `bodyId` is the enums.gen string id ("sun", "rahu"), not Swift's Int —
 *    resolution happens once here (`bodyKeyFromNode`) so every downstream
 *    consumer compares in id space (iOS compares CelestialBody enum identity).
 *  - `bodyName` is the CANONICAL display name (`CELESTIAL_BODIES[id].displayName`),
 *    NOT the raw wire `body`. The wire ships "MeanNode"/"SouthNodeMean" (no
 *    space), which iOS's own three-name North-Node predicate
 *    (`PresetConfigurationBuilder.northNodeNames`) never matches — dead code
 *    on the current wire. Normalizing via id space makes the mirrored dedup
 *    behave as iOS intended and matches what iOS actually renders (glyph asset
 *    "north node" via CelestialBodyNameMapper.toAssetName). The raw wire
 *    string remains available as `id` ("meannode"), which is also what
 *    `AspectEdgeDTO.from/to` reference.
 *
 * `housePlacement` is `number` per the plan's interface; the wire's `null`
 * (angles/lots) becomes 0 — Swift keeps `Int?`, so 0 is the "no house"
 * sentinel here (houses are 1-indexed, 0 never collides).
 */
export interface Placement {
  id: string;
  bodyName: string;
  bodyId: string;
  longitude: number;
  latitude: number;
  speedLongitude: number;
  housePlacement: number;
  signPlacement: string;
  isRetrograde: boolean;
  glyphAsset: string;
}

export function placementFromNode(node: CelestialNodeDTO): Placement {
  const key = bodyKeyFromNode(node);
  const info = key !== undefined ? CELESTIAL_BODIES[key] : undefined;
  return {
    id: node.id,
    // Unknown body: keep the wire strings (Swift keeps bodyName raw and lets
    // the nil `celestialBody` drop it at filter time — our visibility filter
    // drops unknown ids equivalently, since enabledBodies normalize to known
    // enums.gen keys).
    bodyName: info?.displayName ?? node.body,
    bodyId: key ?? node.id,
    longitude: node.position.longitude,
    latitude: node.position.latitude,
    speedLongitude: node.position.speed_longitude,
    housePlacement: node.house_placement ?? 0,
    signPlacement: node.sign_placement,
    isRetrograde: node.position.speed_longitude < 0,
    // iOS: CelestialBodyNameMapper.toAssetName(bodyName) — e.g. "MeanNode" →
    // "north node". enums.gen's glyphAsset is the same table (both from
    // codegen YAML); fallback mirrors Swift's `default: lowercased`.
    glyphAsset: info?.glyphAsset ?? node.id,
  };
}

// =============================================================================
// Sign-relative degrees/minutes (Swift `Placement.degrees`/`.minutes`,
// KairosCore ChartModel/Placement.swift:76-84 — `adjustedLongitude` there is
// just `longitude` verbatim, "already in the correct zodiac system", so no
// tropical/sidereal adjustment happens here either)
// =============================================================================

/** Whole degrees within the placement's sign (0-29). */
export function degreesInSign(longitude: number): number {
  return Math.trunc(longitude % 30);
}

/** Minutes within the placement's current degree (0-59). */
export function minutesInSign(longitude: number): number {
  const remainder = longitude % 30;
  const fractional = remainder - Math.trunc(remainder);
  return Math.trunc(fractional * 60);
}

// =============================================================================
// Frame-derived points (mirror of kairos-ios CelestialBody.isFrameDerivedPoint)
// =============================================================================

/**
 * Bodies defined by the chart's own frame (observer location + time) rather
 * than an ephemeris position: the four angles, the three Arabic lots, and the
 * vertex. `PlanetsRingStyle.showFrameDerivedPoints: false` drops exactly this
 * set from a ring (kairos-ios CelestialBody+SubCategories.swift).
 */
export const FRAME_DERIVED_POINT_IDS: ReadonlySet<string> = new Set([
  "ascendant",
  "midheaven",
  "descendant",
  "imumCoeli",
  "fortune",
  "spirit",
  "lotOfEros",
  "vertex",
]);

/**
 * The three North-Node display names, lowercased — verbatim mirror of
 * `PresetConfigurationBuilder.northNodeNames` ("mean node", "true node",
 * "north node"). Matches against the NORMALIZED `Placement.bodyName`, so the
 * wire's "MeanNode"/"TrueNode" both land here as "North Node". "South Node"
 * is deliberately NOT a substring away from matching — exact set membership.
 */
export const NORTH_NODE_NAMES: ReadonlySet<string> = new Set([
  "mean node",
  "true node",
  "north node",
]);

/**
 * Mirror of `PresetConfigurationBuilder.deduplicateNorthNode`: the backend
 * may return multiple North Node variants (Mean/True); keep the FIRST in
 * engine node order. Runs at Placement-construction time in Swift — i.e.
 * BEFORE the ring visibility filters — and does the same here.
 */
export function deduplicateNorthNode(placements: Placement[]): Placement[] {
  let hasNorthNode = false;
  return placements.filter((p) => {
    const isNorthNode = NORTH_NODE_NAMES.has(p.bodyName.toLowerCase());
    if (isNorthNode) {
      if (hasNorthNode) return false;
      hasNorthNode = true;
    }
    return true;
  });
}
