# Engineering Regression Validation

## Validation Method

Run:

```bash
npm run validate:engineering
```

This validation script reuses the existing engineering modules directly. It does not add a test framework, does not change application workflow, and is intended as a lightweight regression gate.

## Standard Engineering Cases

### Structural Example
- Slope: `78 / 140`
- J1: `65 / 50`
- J2: `56 / 230`
- J3: `45 / 127`
- Friction: `30`
- Expected:
  - planar sliding possible on `J3`
  - wedge sliding possible on `J1 + J3`
  - wedge trend about `113бу`
  - wedge plunge about `44бу`

### Case 1: Clear Planar Sliding
- Slope: `70 / 180`
- J1: `45 / 180`
- J2: `30 / 090`
- Friction: `30`
- Expected:
  - planar `true`
  - wedge `false`

### Case 2: Clear Wedge Sliding
- Slope: `60 / 180`
- J1: `50 / 170`
- J2: `50 / 190`
- J3: `20 / 090`
- Friction: `30`
- Expected:
  - wedge `true`
  - controlling pair `J1 + J2`
  - trend about `180бу`
  - plunge about `49.6бу`

### Case 3: No Failure
- Slope: `45 / 180`
- J1: `20 / 000`
- J2: `15 / 090`
- J3: `10 / 270`
- Friction: `30`
- Expected:
  - planar `false`
  - wedge `false`
  - toppling `false`

### Case 4: Toppling Sensitive
- Slope: `70 / 180`
- J1: `80 / 000`
- J2: `30 / 090`
- J3: `25 / 270`
- Friction: `25`
- Expected:
  - toppling `true`
  - planar `false`
  - wedge `false`

### Case 5: Numeric Input Edge Cases
Inputs checked against the shared parsing contract:
- `"" -> null`
- `"-" -> null`
- `"-10" -> -10`
- `"0.5" -> 0.5`
- `"10." -> 10`

## Projection And Geometry Checks
- Pole formula check for `45 / 127` -> `307 / 45`
- Rocscience renderer pole checks:
  - `45 / 180` -> north side
  - `45 / 090` -> west side
  - `78 / 140` -> NW quadrant
- Great-circle point count remains `91`
- Great-circle coordinates remain finite and within the unit stereonet
- Wedge geometry trend/plunge stays consistent with kinematic analysis

## Persistence Contract Checks
The script statically checks the key wedge persistence chain for:
- schema coverage
- wedge repo save coverage
- snapshot service exposure
- Entry Detail read coverage
- deleted-entry filtering in latest snapshot queries

Current contract fields checked:
- `controlling_pair`
- `wedge_trend`
- `wedge_plunge`
- `water_head`
- `water_force`
- `risk_class`
- `action_level`
- `support_recommendation`
- `review_required`
- `driving_force`
- `shear_resistance`
- `shotcrete_contribution`
- `bolt_contribution`
- `anchor_contribution`

## Summary Logic Checks
The script also checks the summary layer source for:
- latest wedge wording
- field action output
- wedge-driven promotion from a single mechanism to `Multiple mechanisms`

## Field Logging Contract Checks
The script now also statically checks the field logging chain for:
- `Mapping` screen coverage of persistence / aperture / joint water fields
- Mapping phrase generation coverage for those descriptors
- Mapping detail read coverage in Entry Detail
- `QuickLog` structured persistence for:
  - selected observations
  - trigger category
  - immediate action
  - review required
- `QuickLog` generated summary support and Entry Detail block presence
- `InvestigationLog` structured persistence and type-specific summary generation
- `InvestigationLog` Entry Detail block presence

## Expected Output
The script prints a PASS / FAIL table.
If any case fails, the process exits non-zero so it can be used as a lightweight regression gate before release work.
