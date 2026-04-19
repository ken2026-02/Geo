# GeoField AU: Rock Engineering Roadmap & Validation Framework

This document outlines the controlled, engineering-justified expansion path for the GeoField AU rock engineering engine.

## PART 1 — Core Stability Policy

The following modules constitute the **Protected Stable Core**. They are NOT to be redesigned unless a verified bug is found:
- `/src/utils/rockKinematics.ts`
- `/src/utils/stereonet.ts`
- `/src/utils/markland.ts`
- `/src/screens/StructuralAssessment.tsx`
- Rock Engineering Brain integration
- Database schema and save flow

---

## PART 2 — Staged Engineering Roadmap

| Phase | Name | Engineering Purpose | Theory Basis |
| :--- | :--- | :--- | :--- |
| **A** | **Validation** | Verify current kinematic engine accuracy. | Geometric/Vector analysis. |
| **B** | **Markland Refinement** | Enhance stereonet visualization and interpretation. | Stereonet projection (Wulff). |
| **C** | **FoS Wedge Analysis** | Calculate Factor of Safety for wedges. | Limit Equilibrium (Force Equilibrium). |
| **D** | **Support Recommendations** | Provide evidence-based support intensity. | Q-System / RMR / Structural modifiers. |
| **E** | **Joint Clustering** | Automate grouping of joint data. | Statistical orientation clustering. |
| **F** | **Block Volume Estimation** | Approximate block sizes. | Geometric block theory. |
| **G** | **Rockfall Trajectory** | Screening-level trajectory analysis. | Particle kinematics (screening only). |

---

## PART 3 — Validation Foundation (Phase A)

Before any new module is added, the current engine must pass this validation suite.

### Validation Checklist

| Case | Description | Expected Result | Controlling Pair Expectation |
| :--- | :--- | :--- | :--- |
| **1** | True Planar | Admissible | N/A |
| **2** | Friction-Limited Planar | Inadmissible | N/A |
| **3** | True Wedge | Admissible | Consistent Pair |
| **4** | Geometric Wedge (Inadmissible) | Inadmissible | None |
| **5** | Toppling | Admissible | N/A |
| **6** | No Structural Control | Inadmissible | None |
| **7** | Multiple Wedge Pairs | Admissible | Consistent Selection |

---

## PART 4 — Theory Requirements for Future Modules

Future modules must be based on recognized geomechanics principles:

- **FoS Wedge Analysis**: Must use Limit Equilibrium (Force Equilibrium) for a single wedge. No heuristic formulas.
- **Support Recommendation**: Must use Q-based support intensity with explicit structural and groundwater modifiers. All decision logic must be documented.
- **Joint Clustering**: Must use explicit orientation clustering methods (e.g., Fisher distribution or similar). No "AI guessing".
- **Block Volume**: Must use geometry-based approximation. Assumptions (e.g., joint spacing) must be explicitly stated.
- **Rockfall Trajectory**: Must be clearly separated from full commercial simulation software. Screening-level analysis only.

---

## PART 5 — Algorithm Specification Template

All future phases must have an internal Algorithm Specification note created *before* implementation:

### [Phase Name] Algorithm Specification

1.  **Purpose**: Clear engineering goal.
2.  **Formulas / Logic**: Mathematical basis.
3.  **Coordinate Conventions**: Consistent with existing engine (x=E, y=N, z=Up).
4.  **Assumptions**: Explicit constraints.
5.  **Output Interpretation**: How to read the results.
6.  **Limitations**: Comparison vs full commercial software (e.g., Rocscience).
