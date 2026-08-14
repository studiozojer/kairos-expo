/**
 * RingModule — one self-contained ring slot within a ChartConfig.
 *
 * Mirrors (cross-checked 2026-08-14):
 *  - kairos-engine crates/kairos-core/src/presets/preset.rs (`RingModule`)
 *  - swift .../Presets/PresetWireFormat.swift (`RingModuleWireFormat`)
 *  - swift .../Presets/Entities/RingModuleEntity.swift (`RingType` raw values)
 *  - kairos-engine crates/kairos-core/src/presets/enums.rs (`RingType`)
 *
 * Wire shape (camelCase both platforms; verified in classic.json
 * `/soloChart/rings[0]`, 2026-08-14):
 *   { "id": "zodiac", "ringType": "zodiac", "thickness": {...},
 *     "enabled": true, "style": {...}, "content": {...} }
 *
 * Note the asymmetry: the TS property is `type` (Swift `RingModule.type`),
 * the wire key is `ringType` (Rust `ring_type` → camelCase; the Swift
 * wire-format struct renames to match Rust). Order within `ChartConfig.rings`
 * determines visual position (innermost-first); there is no `sortOrder` on
 * the wire — it is assigned from array index on ingestion.
 *
 * Tolerance contract: same as core-types.ts (never throws, defaults on the
 * malformed). An unknown `ringType` degrades to `"zodiac"` — mirroring the
 * Swift entity projection `RingType(rawValue:) ?? .zodiac`
 * (PresetWireFormat.swift:272) — and style/content fall back to that
 * (resolved) type's defaults.
 */

import {
  parseRingThickness,
  serializeRingThickness,
  type RingThickness,
} from "./core-types";
import { bool, obj, oneOf, str } from "./decode";
import {
  parseRingContent,
  serializeRingContent,
  type RingContent,
} from "./ring-content";
import {
  parseRingStyle,
  serializeRingStyle,
  type RingStyle,
} from "./ring-styles";

/** Ring kind discriminator. Wire values are camelCase (Rust `rename_all = "camelCase"`). */
export const RING_TYPES = [
  "zodiac",
  "planets",
  "houses",
  "aspects",
  "decans",
  "signRulers",
  "terms",
  "lunarMansions",
  "fixedStars",
  "cuspAnnotations",
] as const;

export type RingType = (typeof RING_TYPES)[number];

/** Tolerant RingType parse: unknown/missing → "zodiac" (Swift entity pattern). */
export function parseRingType(v: unknown): RingType {
  return oneOf(v, RING_TYPES, "zodiac");
}

export interface RingModule {
  id: string;
  type: RingType;
  thickness: RingThickness;
  enabled: boolean;
  style: RingStyle;
  content: RingContent;
}

/**
 * Tolerant parse. Defaults: id "" (Swift entity default ringId), type
 * "zodiac" (see above), thickness `{ kind: "auto" }` (Rust
 * `#[serde(default)]` → `RingThickness::Auto`), enabled true (Rust
 * `default_enabled`; Swift entity default). Style/content parse tolerantly
 * with the RESOLVED ring type as the fallback hint.
 */
export function parseRingModule(v: unknown): RingModule {
  const o = obj(v);
  const type = parseRingType(o.ringType);
  return {
    id: str(o.id, ""),
    type,
    thickness: parseRingThickness(o.thickness),
    enabled: bool(o.enabled, true),
    style: parseRingStyle(o.style, type),
    content: parseRingContent(o.content, type),
  };
}

/** Serialize with the `ringType` wire key (Rust field order). */
export function serializeRingModule(m: RingModule): unknown {
  return {
    id: m.id,
    ringType: m.type,
    thickness: serializeRingThickness(m.thickness),
    enabled: m.enabled,
    style: serializeRingStyle(m.style),
    content: serializeRingContent(m.content),
  };
}
