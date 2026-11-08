# Prefer fixed-angle clearance when the planets cannot all fit

The previous fallback retained Pallas overlapping ASC when it could not also clear Neptune. The new priority is: preserve longitude order and house/sign windows; minimize collisions with fixed angle strokes/annotations; then minimize planet-to-planet overlap. One bounded settling pass lets earlier planets respond to crowded placements selected later. True-position ticks stay fixed.

Screenshots here use `KAIROS_ORDER_STRESS=1 KAIROS_ORDER_ASC=8 KAIROS_ANNOTATIONS=degrees KAIROS_DARK=1 KAIROS_DPR=2` with `scripts/qa-angle-overlay.cjs`. This synthetic case places ASC at 8° Aries, DSC at 8° Libra, and Neptune at 1.92° Aries. Other bodies retain the frozen Seattle chart. Aspects/houses are not recalculated; this is visual layout evidence only.

Observed: ASC is clear in the 8° degrees-only layout; Neptune and Pallas remain before it but their stacks remain crowded. The sibling `axis-clearance-priority` captures the harder 6.1° ASC case with degrees and minutes. That case clears ASC in zodiac mode but still has overlapping angle/planet annotations in inner mode. This change does not make all dense layouts collision-free; unresolved IDs remain available from the layout.

Validation: typecheck, web export, 906 tests. A regression requires clearing the fixed stroke even when planet-to-planet overlap is unavoidable, checks preserved order/ticks, and checks that the settling pass opens room. Native visuals unverified.
