# Bearing Capacity Module Implementation Spec v1

## 1. Purpose

This module is not a generic shallow footing calculator. It is a **tracked plant / working platform bearing check** aligned to the existing spreadsheet workflow in [F:\25T Slew Crane.xlsx](F:\25T Slew Crane.xlsx).

The implementation target is:

1. Calculation results align with the spreadsheet before any broader engineering cleanup.
2. Final report layout stays close to the spreadsheet output.
3. Page interaction is redesigned for mobile use, with parameter basis and source lookup built in.

This v1 scope covers these spreadsheet sheets only:

- `Inputs`
- `Linear`
- `Westergaard`
- `Boussinesq`

Out of scope for v1:

- `Geogrid`
- `Steel Plate`

## 2. Spreadsheet Method Summary

The spreadsheet performs two parallel tasks:

1. It calculates applied pressure at depth using three methods:
   - `Linear`
   - `Westergaard`
   - `Boussinesq`
2. It calculates allowable bearing capacity for the platform layer and each soil layer.

Each layer base is checked by comparing:

- applied pressure at base of layer
- allowable bearing capacity at that layer

Each method then returns `Ok!` or `Not ok!` per layer.

## 3. Core Inputs

### 3.1 Header / report inputs

These are report metadata rather than engineering drivers:

- Project
- Title
- Geotech Ref
- Machinery
- Date
- By

### 3.2 Key engineering inputs

From `Inputs`:

- `P` = machine / track pressure (`kPa`)
- `L` = track length (`m`)
- `B` = track width (`m`)
- `D` = platform thickness (`m`)
- `Bearing FOS`

### 3.3 Layered profile inputs

For the platform and each soil layer:

- description
- thickness
- `Su`
- `phi`
- `c`
- `gamma`
- `nu` for Westergaard
- `distribution` for Linear (`1V:xH`)

The platform is treated as the first layer in the profile and is checked in the same way as the underlying soil layers.

## 4. Spreadsheet Rules To Preserve

### 4.1 Distribution rules

The spreadsheet includes explicit business rules for linear load spread.

#### Cohesive material

- Very soft to soft: `1V:0H`
- Soft to firm: `1V:0.25H`
- Firm to hard: `1V:0.5H`

#### Cohesionless material

- `phi <= 30`: `1V:0.25H`
- `30 < phi <= 33`: `1V:0.5H`
- `phi > 33`: `1V:0.75H`

#### Platform reinforcement rule

- Unreinforced platforms: treat as very dense cohesionless material in the spreadsheet notes.
- Reinforced platforms: use `1V:1H` for the platform.

### 4.2 Evaluation depth rule

The spreadsheet checks layer performance at **base of layer** depth, not only at the surface or a single founding depth.

### 4.3 Multi-method parallel check

The module must preserve all three applied pressure methods in parallel:

- Linear
- Westergaard
- Boussinesq

No method is dropped in v1.

## 5. Formula Structure

## 5.1 Bearing capacity factors

The spreadsheet uses the classic form:

- `Nq = exp(pi * tan(phi)) * tan^2(45 + phi/2)`
- `Nc = (Nq - 1) * cot(phi)`

`Ngamma` varies by sheet formula usage and must be matched to the spreadsheet behavior rather than normalized too early.

Observed variants in the workbook:

### Linear sheet

- label shown: `Ng = 2 (Nq + 1) ¡Á tan f`
- current formula cells in `Linear!D57:D60` still appear to use:
  - `=(C57-1)*TAN(1.4*RADIANS(F15))`

### Inputs / Westergaard / Boussinesq

- label shown: `Ng = (Nq -1) ¡Á tan 1.4f`
- formula cells use:
  - `=(Nq - 1) * tan(1.4 phi)`

Implementation requirement:

- v1 must preserve **spreadsheet-equivalent results** even if the workbook has internal inconsistencies.
- Formula selection must be explicit and sheet-aligned in the implementation, not silently harmonized.

## 5.2 Bearing capacity equations

The spreadsheet uses:

- `Qult = surcharge + cohesion + unit weight term`
- `Qall = Qult / Bearing FOS`

Per observed layer formulas, the surcharge term is built from overburden accumulated from the layers above the current check layer.

Representative patterns observed:

### Platform

- `Qult = (c + surcharge_like_component) * Nc + 0.5 * gamma * B * Ngamma`

### Underlying layer

- `Qult = (c + surcharge_like_component) * Nc + accumulated_overburden * Nq + 0.5 * gamma * B * Ngamma`

Implementation requirement:

- v1 must reproduce the spreadsheet layer-by-layer equations exactly.
- Refactoring to a cleaner geotechnical expression can only happen after result parity is demonstrated.

## 5.3 Linear stress calculation

Observed spreadsheet method:

- expand loaded length and width by `2 * distribution * thickness` for each traversed layer
- compute loaded area `A*`
- compute pressure at layer base:
  - `Td = (P * L * B) / A*`

Representative formulas:

- Platform:
  - `A* = (L + 2*x_platform*D_platform) * (B + 2*x_platform*D_platform)`
- Layer 1:
  - `A* = (L + 2*x_platform*D_platform + 2*x_layer1*t_layer1) * (B + 2*x_platform*D_platform + 2*x_layer1*t_layer1)`

This is a 2D spread model, not a simple strip-only width spread.

## 5.4 Westergaard stress calculation

Observed formula pattern:

- `z` = depth to layer base
- `M2 = (B / (2z))^2`
- `N2 = (L / (2z))^2`
- `N3 = sqrt((1 - 2nu) / (2 - 2nu))`
- `term1 = 1 / (2pi)`
- `term2 = 2 * atan(1)`
- `term3 = atan(sqrt(N3^2 * (1/M2 + 1/N2) + N3^4 * (1/(M2*N2))))`
- `I = term1 * (term2 - term3)`
- `pressure = 4 * I * P`

This exact sequence should be preserved in code for v1.

## 5.5 Boussinesq stress calculation

Observed formula pattern:

- `b = B / 2`
- `z` = depth to layer base
- `m1 = L / B`
- `n1 = z / b`
- `term1 = 2 / pi`
- `term2 = (m1 * n1) / sqrt(1 + m1^2 + n1^2)`
- `term3 = (1 + m1^2 + 2*n1^2) / ((1 + n1^2) * (m1^2 + n1^2))`
- `term4 = asin(m1 / (sqrt(m1^2 + n1^2) * sqrt(1 + n1^2)))`
- `I4 = term1 * (term2 * term3 + term4)`
- `pressure = I4 * P`

This exact sequence should be preserved in code for v1.

## 6. Recommended Data Model

```ts
type BearingReportMeta = {
  projectId: string
  locationId: string
  title: string
  geotechRef: string
  machinery: string
  date: string
  by: string
}

type BearingEquipment = {
  pressureKPa: number
  trackLengthM: number
  trackWidthM: number
  bearingFOS: number
}

type BearingLayer = {
  id: string
  name: string
  description: string
  thicknessM: number
  suKPa: number | null
  phiDeg: number
  cKPa: number
  gammaKNm3: number
  nu: number | null
  distributionMode: 'auto' | 'manual'
  distributionRatio: number
  reinforced?: boolean
  materialClass?: string
  basisCode?: string
}

type BearingCheckInput = {
  meta: BearingReportMeta
  equipment: BearingEquipment
  platform: BearingLayer
  layers: BearingLayer[]
}

type LayerCheck = {
  layerId: string
  layerName: string
  baseDepthM: number
  bearing: {
    nq: number
    nc: number
    ngamma: number
    qult: number
    qall: number
  }
  stress: {
    linear: number
    westergaard: number
    boussinesq: number
  }
  pass: {
    linear: boolean
    westergaard: boolean
    boussinesq: boolean
  }
}

type BearingChartSeries = {
  depths: number[]
  pressureLinear: number[]
  pressureWestergaard: number[]
  pressureBoussinesq: number[]
  allowableStep: number[]
}

type BearingCheckResult = {
  layerChecks: LayerCheck[]
  summary: {
    overallPass: boolean
    controllingLayerId: string | null
    controllingMethod: 'linear' | 'westergaard' | 'boussinesq' | null
    controllingRatio: number | null
  }
  chart: BearingChartSeries
}
```

## 7. Page Structure For Mobile Use

The UI should not mimic spreadsheet layout. It should preserve spreadsheet logic while being usable on a phone.

### 7.1 Section A: Header / Report Setup

Fields:
- Project
- Location
- Title
- Geotech Ref
- Machinery
- Date
- By

### 7.2 Section B: Key Inputs

Fields:
- Pressure `P`
- Track Length `L`
- Track Width `B`
- Platform Thickness `D`
- Bearing FOS

### 7.3 Section C: Platform

Card fields:
- description
- reinforced toggle
- thickness
- `Su`
- `phi`
- `c`
- `gamma`
- `nu`
- distribution ratio
- basis link

### 7.4 Section D: Soil Profile

Each layer is a card with:
- name
- description
- thickness
- `Su`
- `phi`
- `c`
- `gamma`
- `nu`
- distribution rule
- basis/source link

Actions:
- add layer
- remove layer
- reorder layer
- duplicate layer

### 7.5 Section E: Results

#### Summary card
- overall pass / fail
- controlling layer
- controlling method
- worst ratio

#### Layer check table
Per layer:
- base depth
- `Qall`
- linear pressure
- Westergaard pressure
- Boussinesq pressure
- pass/fail per method

#### Chart
Curves:
- Pressure (Linear)
- Pressure (Westergaard)
- Pressure (Boussinesq)
- Allowable Bearing Capacity

### 7.6 Section F: Basis / Source

Every parameter should expose:
- definition
- formula
- automatic recommendation rule
- applicability
- source code / reference code
- override rule

## 8. Parameter Basis Library

A basis library should be built into the module rather than buried in tooltips only.

Recommended structure:

```ts
type BasisSource = {
  code: string
  label: string
  kind: 'spreadsheet' | 'internal-rule' | 'design-note' | 'reference'
  detail: string
}

type ParameterBasis = {
  id: string
  parameter: string
  title: string
  definition: string
  guidance: string
  formula?: string
  applicability: string[]
  defaultRule?: string
  sources: BasisSource[]
}
```

Initial basis entries required:

- Pressure `P`
- Track length `L`
- Track width `B`
- Platform thickness `D`
- Bearing FOS
- `Su`
- `phi`
- `c`
- `gamma`
- `nu`
- Distribution ratio
- `Nq`
- `Nc`
- `Ngamma`
- Linear stress method
- Westergaard stress method
- Boussinesq stress method

## 9. Report Structure

The report should stay close to the spreadsheet output, not the phone UI.

### 9.1 Header
- Project
- Title
- Geotech Ref
- Machinery
- Date
- By

### 9.2 Key Inputs
Table format matching spreadsheet intent:
- P
- L
- B
- D
- Bearing FOS

### 9.3 Soil Layers Table
Columns:
- Soil Description
- Thickness
- Su
- phi
- c
- gamma
- nu
- Distribution
- Bearing Check:
  - Linear
  - Westergaard
  - Boussinesq

### 9.4 Chart
Same plotting logic as spreadsheet:
- x-axis = depth
- y-axis = pressure / bearing capacity
- lines:
  - Pressure (Linear)
  - Pressure (Westergaard)
  - Pressure (Boussinesq)
  - Allowable Bearing Capacity

### 9.5 Detailed Calculation Appendix
Include:
- Linear calculation table
- Westergaard calculation table
- Boussinesq calculation table
- Bearing capacity table

### 9.6 Basis / Source Appendix
Additional to spreadsheet, but recommended:
- parameter basis summary
- method notes
- auto-selected distribution rules
- overridden parameters and reasons

## 10. Spreadsheet To Software Mapping

### Inputs sheet
Software mapping:
- header metadata
- key inputs section
- platform section
- soil profile section
- summary check table

### Linear sheet
Software mapping:
- `calcLinearStressAtLayerBase(...)`
- linear stress chart series
- linear layer pass/fail table
- linear appendix in report

### Westergaard sheet
Software mapping:
- `calcWestergaardStressAtLayerBase(...)`
- Westergaard chart series
- Westergaard layer pass/fail table
- Westergaard appendix in report

### Boussinesq sheet
Software mapping:
- `calcBoussinesqStressAtLayerBase(...)`
- Boussinesq chart series
- Boussinesq layer pass/fail table
- Boussinesq appendix in report

### Geogrid / Steel Plate sheets
Software mapping:
- reserved for v2
- not part of v1 implementation

## 11. Implementation Order

### Step 1: Spreadsheet Formula Lock
Create explicit formula extraction notes and ensure every spreadsheet column has a software equivalent.

### Step 2: Pure Calculation Engine
Build pure functions first and validate against the spreadsheet sample case.

### Step 3: Mobile-first UI
Replace the current single-layer `BearingCapacity` screen with a profile-driven mobile workflow.

### Step 4: Formal Report Output
Generate a report that is visually close to the spreadsheet while including optional basis/source appendices.

## 12. Immediate Decisions Locked For v1

These assumptions are now fixed unless explicitly changed later:

1. v1 covers only `Inputs`, `Linear`, `Westergaard`, and `Boussinesq`.
2. Spreadsheet result parity takes priority over theory cleanup.
3. Report styling should stay close to the spreadsheet output.
4. Mobile interaction should be redesigned independently from the report layout.
5. Parameter basis and source lookup are part of v1, not an optional enhancement.
