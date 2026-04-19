# Bearing Capacity Formula Map And Gap Audit v1

## 1. Scope

This document is the implementation bridge between:

- the current spreadsheet in [F:\25T Slew Crane.xlsx](F:/25T%20Slew%20Crane.xlsx)
- the current app module in [D:\Geo\src\screens\BearingCapacity.tsx](D:/Geo/src/screens/BearingCapacity.tsx)

It has two purposes:

1. map spreadsheet formulas into software calculation units
2. identify the gap between the spreadsheet method and the current module

This is still v1 scope only:

- `Inputs`
- `Linear`
- `Westergaard`
- `Boussinesq`

Out of scope:

- `Geogrid`
- `Steel Plate`

## 2. Spreadsheet Sheet Roles

### Inputs

Acts as the master sheet for:

- header metadata
- key equipment inputs
- platform layer
- soil layers
- method-level pass/fail summary
- graphing source data for all methods

### Linear

Contains:

- layer definition repeated from `Inputs`
- linear stress at base of each layer
- per-layer allowable bearing capacity
- pass/fail check for the linear method
- graph-ready depth/pressure/allowable arrays

### Westergaard

Contains:

- layer definition repeated from `Inputs`
- Westergaard stress at base of each layer
- per-layer allowable bearing capacity
- pass/fail check for the Westergaard method
- graph-ready depth/pressure/allowable arrays

### Boussinesq

Contains:

- layer definition repeated from `Inputs`
- Boussinesq stress at base of each layer
- per-layer allowable bearing capacity
- pass/fail check for the Boussinesq method
- graph-ready depth/pressure/allowable arrays

## 3. Spreadsheet Formula Map

## 3.1 Inputs sheet

### Key inputs

| Spreadsheet cell | Meaning | Software field |
|---|---|---|
| `Inputs!D6` | Applied machine pressure `P` (`kPa`) | `input.equipment.pressureKPa` |
| `Inputs!D7` | Track length `L` (`m`) | `input.equipment.trackLengthM` |
| `Inputs!D8` | Track width `B` (`m`) | `input.equipment.trackWidthM` |
| `Inputs!D10` | Platform thickness `D` (`m`) | `input.platform.thicknessM` |
| `Inputs!D11` | Bearing factor of safety | `input.equipment.bearingFOS` |

### Layer table

| Spreadsheet columns | Meaning | Software field |
|---|---|---|
| `C` | Soil description | `layer.description` |
| `D` | Thickness | `layer.thicknessM` |
| `E` | `Su` | `layer.suKPa` |
| `F` | `phi` | `layer.phiDeg` |
| `G` | `c` | `layer.cKPa` |
| `H` | `gamma` | `layer.gammaKNm3` |
| `I` | `nu` for Westergaard | `layer.nu` |
| `J` | `distribution 1V:xH` | `layer.distributionRatio` |

### Summary checks

Observed structure:

- platform:
  - linear compares `Inputs!G69 > Inputs!D6`
  - Westergaard compares `Inputs!G69 > Inputs!D6`
  - Boussinesq compares `Inputs!G69 > Inputs!D6`
- lower layers compare:
  - layer `Qall`
  - against pressure at base of that layer for each method

Software mapping:

- `result.layerChecks[].pass.linear`
- `result.layerChecks[].pass.westergaard`
- `result.layerChecks[].pass.boussinesq`

## 3.2 Linear method

### Stress at base of layer

Observed formulas:

- Platform area:
  - `A* = (L + 2*x_platform*D_platform) * (B + 2*x_platform*D_platform)`
- Platform pressure:
  - `Td = (P * L * B) / A*`

- Layer 1 area:
  - `A* = (L + 2*x_platform*D_platform + 2*x_layer1*t_layer1) * (B + 2*x_platform*D_platform + 2*x_layer1*t_layer1)`
- Layer 1 pressure:
  - `Td = (P * L * B) / A*`

- Layer 2 and below:
  - continue adding `2 * x_i * thickness_i` to both loaded dimensions

Software unit:

- `calcLinearStressAtLayerBases(input): Array<{ layerId, baseDepthM, loadedAreaM2, pressureKPa }>`

### Bearing capacity part on Linear sheet

Observed rows:

- `Linear!C57:E60`
- `Linear!F57:G60`

Observed pattern:

- `Nq = exp(pi * tan(phi)) * tan^2(45 + phi/2)`
- `Nc = (Nq - 1) * cot(phi)`
- `Ngamma` label says `2 (Nq + 1) tan(phi)` but formula cells currently use `=(Nq - 1) * tan(1.4 phi)`
- `Qult = (c + surcharge_like_component) * Nc + 0.5 * gamma * B * Ngamma + overburden * Nq`
- `Qall = Qult / FOS`

Software unit:

- `calcLayerAllowableBearingLinearVariant(input, layerIndex)`

### Graphing data

Observed:

- `Linear!D75:D108` depth array
- `Linear!E75:E108` applied pressure from `Inputs!I155:I188`
- `Linear!G75:G108` allowable capacity from `Inputs!K155:K188`

Software unit:

- `buildLinearChartSeries(input, result)`

## 3.3 Westergaard method

### Stress at base of layer

Observed formulas:

- `z = layer base depth`
- `M2 = (B / (2z))^2`
- `N2 = (L / (2z))^2`
- `N3 = sqrt((1 - 2nu) / (2 - 2nu))`
- `term1 = 1 / (2pi)`
- `term2 = 2 * atan(1)`
- `term3 = atan(sqrt(N3^2 * (1/M2 + 1/N2) + N3^4 * (1/(M2*N2))))`
- `I = term1 * (term2 - term3)`
- `pressure = 4 * I * P`

Software unit:

- `calcWestergaardStressAtLayerBases(input)`

### Bearing capacity part on Westergaard sheet

Observed rows:

- `Westergaard!C64:E67`
- `Westergaard!F64:G67`

Observed pattern:

- `Nq = exp(pi * tan(phi)) * tan^2(45 + phi/2)`
- `Nc = (Nq - 1) * cot(phi)`
- `Ngamma = (Nq - 1) * tan(1.4 phi)`
- `Qult`
- `Qall = Qult / FOS`
- check against `Pressure at base of layer`

Software unit:

- `calcLayerAllowableBearingGeneralVariant(input, layerIndex)`

### Graphing data

Observed:

- `Westergaard!B109:B133` depth array
- `Westergaard!K109:K133` applied pressure
- `Westergaard!L109:L133` stepwise allowable capacity

Software unit:

- `buildWestergaardChartSeries(input, result)`

## 3.4 Boussinesq method

### Stress at base of layer

Observed formulas:

- `b = B / 2`
- `z = layer base depth`
- `m1 = L / B`
- `n1 = z / b`
- `term1 = 2 / pi`
- `term2 = (m1 * n1) / sqrt(1 + m1^2 + n1^2)`
- `term3 = (1 + m1^2 + 2*n1^2) / ((1 + n1^2) * (m1^2 + n1^2))`
- `term4 = asin(m1 / (sqrt(m1^2 + n1^2) * sqrt(1 + n1^2)))`
- `I4 = term1 * (term2 * term3 + term4)`
- `pressure = I4 * P`

Software unit:

- `calcBoussinesqStressAtLayerBases(input)`

### Bearing capacity part on Boussinesq sheet

Observed rows:

- `Boussinesq!C59:E62`
- `Boussinesq!F59:G62`

Observed pattern:

- `Nq = exp(pi * tan(phi)) * tan^2(45 + phi/2)`
- `Nc = (Nq - 1) * cot(phi)`
- `Ngamma = (Nq - 1) * tan(1.4 phi)`
- `Qult`
- `Qall = Qult / FOS`

Software unit:

- same bearing-capacity path as the general variant, with spreadsheet-equivalent material values

### Graphing data

Observed:

- `Boussinesq!B104:B132` depth array
- `Boussinesq!K104:K132` applied pressure
- `Boussinesq!L104:L132` stepwise allowable capacity

Software unit:

- `buildBoussinesqChartSeries(input, result)`

## 4. Existing Module Gap Audit

## 4.1 Current screen behavior

The current module in [D:\Geo\src\screens\BearingCapacity.tsx](D:/Geo/src/screens/BearingCapacity.tsx):

- is a single-layer shallow foundation calculator
- uses:
  - footing width
  - footing depth
  - unit weight
  - cohesion
  - friction angle
  - groundwater depth
  - factor of safety
- outputs:
  - one `qUlt`
  - one `qAllow`
- stores one assessment row in [D:\Geo\src\repositories\bearingCapacityRepo.ts](D:/Geo/src/repositories/bearingCapacityRepo.ts)

It does **not** model:

- track pressure / track geometry
- platform as a layer
- layered soils
- Linear stress spread
- Westergaard stress
- Boussinesq stress
- per-layer pass/fail
- chart data
- report metadata fields matching the spreadsheet
- parameter basis / source lookup

## 4.2 Repository and persistence gap

Current table shape in `bearing_capacity_assessments` stores only:

- footing width
- footing depth
- unit weight
- cohesion
- friction angle
- groundwater depth
- factor of safety
- ultimate bearing capacity
- allowable bearing capacity
- controlling mode
- notes

This is inadequate for the spreadsheet-equivalent module because it cannot store:

- project report header fields
- equipment geometry
- platform definition
- layered soil profile
- per-layer calculation results
- method-specific applied pressures
- chart source data
- basis/source references

Conclusion:

- existing persistence is not extensible enough for the spreadsheet target
- this module will need either:
  - a new normalized bearing profile table design
  - or a JSON-backed assessment payload with report/cache fields

## 4.3 Entry detail gap

Current ET18 detail block in [D:\Geo\src\screens\EntryDetail.tsx](D:/Geo/src/screens/EntryDetail.tsx) shows only:

- ultimate capacity
- allowable capacity
- controlling mode
- notes

That is insufficient for the target module because the real review surface should show:

- key inputs
- platform and layers
- per-layer checks
- controlling layer / controlling method
- report-ready interpretation

## 4.4 UI gap

Current UI is not a mobile version of the spreadsheet workflow. It is a generic calculator page with:

- single soil preset
- no layered profile editing
- no method comparison
- no parameter basis access

Conclusion:

- this screen must be rebuilt rather than patched

## 5. Recommended Implementation Units

The next code phase should be built around these units.

### Calculation engine

- `calcBearingFactorsSpreadsheetVariant(...)`
- `calcLayerAllowableBearing(...)`
- `calcLinearStressAtLayerBases(...)`
- `calcWestergaardStressAtLayerBases(...)`
- `calcBoussinesqStressAtLayerBases(...)`
- `buildBearingChartSeries(...)`
- `evaluateBearingProfile(...)`

### UI components

- `BearingCapacityHeaderSection`
- `BearingCapacityKeyInputsSection`
- `BearingCapacityPlatformSection`
- `BearingCapacityLayerEditor`
- `BearingCapacityResultsSummary`
- `BearingCapacityLayerCheckTable`
- `BearingCapacityMethodChart`
- `BearingCapacityBasisDrawer`

### Persistence units

At minimum, the new model needs:

- main assessment record
- layer rows or structured layer payload
- report header fields
- stored summary result fields

## 6. Recommended Delivery Sequence

### Step 1

Lock the spreadsheet formulas into pure software functions.

### Step 2

Create one spreadsheet parity validation case using the provided workbook values.

### Step 3

Redesign the page for mobile use around:

- key inputs
- platform
- layers
- results
- basis

### Step 4

Replace ET18 persistence and detail display so the stored result matches the real engineering workflow.

### Step 5

Build formal report export that is visually close to the spreadsheet output.

## 7. Immediate Design Conclusions

These conclusions should be treated as fixed for the next implementation round:

1. The existing ET18 module is not close enough to spreadsheet logic to justify incremental patching.
2. A new layered calculation engine is required.
3. Existing persistence for ET18 is too narrow and must be redesigned.
4. The report should follow spreadsheet structure more closely than the on-phone editing page.
5. Parameter basis and source lookup must be designed into the module from the beginning.
