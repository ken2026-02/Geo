# Site Logging Regression Checklist (Mobile, Offline)

This checklist is for the **Site Logging** module only. It focuses on end-to-end persistence (create → reopen → edit → report) and common PWA/offline failure modes.

## Preconditions

- One active Project selected
- App is online/offline doesn't matter (should work offline)
- If you see stale UI after an update, use **Clear cache & reload** on the Site Logging list page

## 1) Project → Site → Element

1. Go to `Projects` and create a new project (name + code).
2. Set it as Active.
3. Go to `Site Logging`.
4. Create a Site (site code is required).
5. Create one element for each type:
   - Anchor
   - Pile
   - Suitability test

Expected:
- Site appears in filters and quick-create site dropdown
- Element opens to the detail page and persists after refresh

## 2) Design Input

1. Open an element → `Design Input` tab.
2. Fill a few fields relevant to the element type.
3. Save.
4. Reload the page and confirm values persist.

Expected:
- Design input values rehydrate correctly
- Reference RL type selection persists

## 3) Field Logging (Intervals, Events, Photos)

1. In `Field Logging`, create a drilling record.
2. Add intervals from/to depths.
3. Use phrase quick-pick and confirm `logging_phrase_output` is updated.
4. Add at least one field event (with and without depth).
5. Add a photo with:
   - Photo type set (e.g. `material_at_depth`)
   - Depth (optional)
   - Drilling record (auto-defaults to active record)

Expected:
- Intervals order is stable (sorted by from depth)
- Events appear in the timeline
- Photo thumbnails load and persist after reload

## 4) Interpretation → Verification

1. In `Interpretation`, set:
   - Reference ToR depth
   - Actual ToR depth
   - Confidence + summary
2. In `Verification`, click Run Verification.
3. Confirm the correct engine runs:
   - Anchor element → anchor verification
   - Pile element → pile verification
   - Suitability → suitability verification

Expected:
- Verification status + reasons are shown and persisted

## 5) Clean-out / Approvals

1. In `Clean Out`, record a clean-out depth and base condition.
2. Mark approved for grouting (if applicable).
3. In `Approvals`, fill reviewer/approver and confirm the approval toggle persists.

Expected:
- Verification reasons update based on clean-out / approval requirements

## 6) Output Report

1. Open `Report` view for the element.
2. Print preview.
3. Confirm report contains:
   - Design summary
   - Interval summary
   - Field events
   - Photo attachment list (type/depth/caption)

## 7) Reference Pack Import/Export

1. On `Site Logging` list page: `Export pack` → save JSON.
2. Reset local data (or use a new project) → `Import pack`.
3. Confirm:
   - Sites created or updated
   - Ground reference restored
   - Borehole calibrations restored
   - Site phrases restored

