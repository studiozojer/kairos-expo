# Axis stroke avoidance

The fixed-angle solver now reserves the rendered stroke as well as its label. Rendering and collision checks share the stroke endpoints. Planet collisions use individual glyph/degree/sign/minute/retrograde footprints from DegreeTextStack; later neighbors can move around earlier resolved bodies. Candidate searches start at true longitude, retain house/sign windows, and preserve true-position ticks.

Reproduce with `KAIROS_AXIS_STRESS=1 KAIROS_DARK=1 KAIROS_DPR=2` and `scripts/qa-angle-overlay.cjs`. This is a synthetic visual fixture: ASC=359°, DSC=179°, Neptune=1°; other nodes remain the frozen Seattle chart. Aspects and houses are not recalculated, so these images are layout evidence, not an astronomical chart.

- `../axis-stroke-first-pass`: stroke obstacles alone left Neptune blocked by immutable neighbors.
- `../axis-stroke-second-pass`: sequential resolution moved Neptune but oversized stack boxes crowded other bodies.
- This directory: individual element footprints and tighter clearance separate Neptune and the neighboring Aries glyphs on desktop/mobile. All four presentation modes captured at DPR 2.

Dense regions can still exhaust their permitted windows; unresolved placements are reported by the layout. This is not a guarantee of collision-free charts, particularly with full minute stacks. Native rendering has not been visually checked.

Validation: typecheck, web export, 902 tests across 112 suites.
