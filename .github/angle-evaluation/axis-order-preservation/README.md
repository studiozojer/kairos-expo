# Preserve longitude order before collision clearance

The previous axis-avoidance pass could place a planet on the other side of an angle, or overtake another planet. That made the chart visually incorrect even when labels were separated.

The solver now treats true angle longitudes and planetary order as hard constraints. It also checks the incoming planet-only layout: an already-crossed placement is restored to true longitude before attempting collision avoidance. If no valid position fits, it retains an order-preserving placement and reports the unresolved collision. Labels may overlap rather than imply a false ordering.

Reproduce with `KAIROS_ORDER_STRESS=1 KAIROS_DARK=1 KAIROS_ANNOTATIONS=both KAIROS_DPR=2` and `scripts/qa-angle-overlay.cjs`. Synthetic case: ASC 6.1° Aries, DSC 6.1° Libra, Neptune 1.92° Aries; Pallas and the other bodies retain their frozen Seattle positions. Houses/aspects are not recomputed, so this is layout evidence, not a calculated astronomical chart. Screenshots include all presentation modes on desktop/mobile.

Observed: Neptune and Pallas stay before ASC; Saturn stays after it. Full minute stacks remain visibly crowded, particularly Pallas near ASC. This deliberately prioritizes ordering over clearance. Native visuals remain unverified.

Validation: typecheck, web export, 905 tests across 112 suites. Regression cases cover pre-displaced input, impossible clearance, rotated charts, the 0°/360° seam, and unchanged true-position ticks.
