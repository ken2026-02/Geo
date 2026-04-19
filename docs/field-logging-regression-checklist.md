# Field Logging End-to-End Regression Checklist

## Scope
Use this checklist after any change to the Field Logging chain:
- Quick Log
- Rock Mapping
- Investigation Log
- Slope Assessment
- Entry Detail
- Rock Engineering Dashboard
- Handover

## 1. Quick Log
1. Open [D:\Geo\src\screens\QuickLog.tsx](D:/Geo/src/screens/QuickLog.tsx).
2. Select a project and location.
3. Record at least one rock or soil observation.
4. Set:
   - Trigger category
   - Immediate action
   - Review required = on
5. Confirm generated summary reads as a field observation, not a raw label list.
6. Save.
7. Re-open the record in [D:\Geo\src\screens\EntryDetail.tsx](D:/Geo/src/screens/EntryDetail.tsx).
8. Verify:
   - observation mode
   - selected observations
   - trigger category
   - immediate action
   - review required
   - summary
9. Click `Edit in Module`.
10. Correct at least one structured field and resave.
11. Re-open the same entry and confirm the corrected values persist.
12. Open [D:\Geo\src\screens\RockEngineeringDashboard.tsx](D:/Geo/src/screens/RockEngineeringDashboard.tsx).
13. Verify the latest field observation / hazard card appears for the same location.
14. Open [D:\Geo\src\screens\Handover.tsx](D:/Geo/src/screens/Handover.tsx).
15. Verify the record appears in key field observations when review is required or handover is flagged.

## 2. Rock Mapping
1. Open [D:\Geo\src\screens\Mapping.tsx](D:/Geo/src/screens/Mapping.tsx).
2. Select a project and location.
3. Record lithology, weathering, strength, structure, groundwater.
4. Record at least one real discontinuity set with:
   - dip / dip direction
   - spacing
   - persistence
   - aperture
   - roughness
   - infill
   - joint water
5. Save.
6. Re-open in [D:\Geo\src\screens\EntryDetail.tsx](D:/Geo/src/screens/EntryDetail.tsx).
7. Verify Mapping details show all discontinuity descriptors.
8. Click `Edit in Module`.
9. Correct one discontinuity descriptor or orientation and resave.
10. Re-open the same entry and confirm the corrected set data persists.
11. Open [D:\Geo\src\screens\StructuralAssessment.tsx](D:/Geo/src/screens/StructuralAssessment.tsx) for the same location with no draft/nav state.
12. Verify latest Mapping discontinuity sets prefill J1/J2/J3.
13. Verify slope fields are not overwritten by Mapping.

## 3. Investigation Log
1. Open [D:\Geo\src\screens\InvestigationLog.tsx](D:/Geo/src/screens/InvestigationLog.tsx).
2. Select a project and location.
3. Record one valid log for each type as needed:
   - Cohesive
   - Granular
   - Fill
   - Transition
4. Save.
5. Re-open in [D:\Geo\src\screens\EntryDetail.tsx](D:/Geo/src/screens/EntryDetail.tsx).
6. Verify Investigation details show structured saved fields.
7. Click `Edit in Module`.
8. Correct one structured soil / fill field and resave.
9. Re-open the same entry and confirm the corrected values persist.
10. Open these screens for the same location with no draft:
   - [D:\Geo\src\screens\BearingCapacity.tsx](D:/Geo/src/screens/BearingCapacity.tsx)
   - [D:\Geo\src\screens\EarthPressure.tsx](D:/Geo/src/screens/EarthPressure.tsx)
   - [D:\Geo\src\screens\SettlementScreening.tsx](D:/Geo/src/screens/SettlementScreening.tsx)
   - [D:\Geo\src\screens\RetainingWallCheck.tsx](D:/Geo/src/screens/RetainingWallCheck.tsx)
   - [D:\Geo\src\screens\SoilSlopeStability.tsx](D:/Geo/src/screens/SoilSlopeStability.tsx)
11. Verify the latest Investigation Log seeds conservative default soil inputs.
12. Verify existing draft or nav state still takes precedence over seeded defaults.

## 4. Slope Assessment
1. Open [D:\Geo\src\screens\SlopeAssessment.tsx](D:/Geo/src/screens/SlopeAssessment.tsx).
2. Verify section order is readable:
   - field context
   - observed geometry / discontinuities
   - preliminary screening
   - suggested action
   - notes / handover
3. Save one record.
4. Re-open in Entry Detail and confirm summary remains consistent.

## 5. Records / Location review workflow
1. Open [D:\Geo\src\screens\Records.tsx](D:/Geo/src/screens/Records.tsx).
2. From one saved record, use:
   - `Open Entry`
   - `Location Review`
   - `Timeline`
3. Verify `Location Review` opens [D:\Geo\src\screens\LocationOverview.tsx](D:/Geo/src/screens/LocationOverview.tsx).
4. Verify the page shows:
   - rock engineering summary
   - soil engineering summary
   - latest field observation / hazard
5. Verify `Timeline` opens [D:\Geo\src\screens\LocationTimeline.tsx](D:/Geo/src/screens/LocationTimeline.tsx).
6. Verify deleted records do not inflate action items in the timeline.
## 6. Location review view
1. Open [D:\Geo\src\screens\LocationDetail.tsx](D:/Geo/src/screens/LocationDetail.tsx).
2. Confirm one page shows:
   - rock engineering summary
   - soil engineering summary
   - latest field observation / hazard
   - ground support summary
3. Verify quick hazard links to the latest ET7 record for that location.
4. Verify deleted records do not inflate counts or latest-item cards.

## 7. Dashboard / Handover wording
1. Open [D:\Geo\src\screens\RockEngineeringDashboard.tsx](D:/Geo/src/screens/RockEngineeringDashboard.tsx).
2. Confirm wording reads as field action language:
   - latest field observation / hazard
   - field support / control
   - shift actions
3. Open [D:\Geo\src\screens\Handover.tsx](D:/Geo/src/screens/Handover.tsx).
4. Use Copy.
5. Confirm exported text reads like shift handover language:
   - key field observations
   - rock engineering / soil engineering
   - support / control
   - shift action
   - risks / constraints

## 8. Cleanup checks
1. Delete or hide one test record.
2. Confirm deleted entries do not appear in:
   - Dashboard action/photo counts
   - latest engineering snapshot queries
   - Handover latest-item selection
3. Run:
   - `npm run validate:engineering`
   - `npx tsc --noEmit`
   - `npm run build`


## 9. Review hierarchy
1. Open [D:\Geo\src\screens\Locations.tsx](D:/Geo/src/screens/Locations.tsx).
2. Confirm each location card offers `Details`, `Review`, and `Timeline`.
3. Open [D:\Geo\src\screens\Projects.tsx](D:/Geo/src/screens/Projects.tsx).
4. Confirm the active project card offers direct links to `Locations`, `Records`, and `Handover`.
5. Confirm the page explains when to use these review surfaces.

## 10. Formal exports
1. From [D:\Geo\src\screens\Home.tsx](D:/Geo/src/screens/Home.tsx), generate `Project Summary`.
2. Confirm it opens as a printable HTML report, not plain text.
3. Confirm the report shows project metadata, total records, open actions, risk distribution, and recent records.
4. Confirm `Photo Sheet` still opens as printable HTML.

## 11. Performance / bundle
1. Run `npm run build`.
2. Confirm the build completes with manual chunk output for field logging / engineering areas.
3. Confirm no static import warning remains for `backupBundle`.
