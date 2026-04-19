# Field Logging Device Checklist

Date: 2026-03-16

## Scope
Use this checklist on a real phone or tablet before field deployment.

## 1. Mobile layout
1. Open Quick Log, Mapping, Investigation Log, and Slope Assessment on the target device.
2. Confirm all primary save buttons remain visible without horizontal scrolling.
3. Confirm module headers and section titles remain readable in portrait mode.
4. Confirm selectors and textareas are usable with the on-screen keyboard open.

## 2. Camera and photo flow
1. In Quick Log, capture one photo from the device camera.
2. Confirm the preview renders before save.
3. Save the record.
4. Re-open Entry Detail and confirm the photo count is correct.
5. Open Photo Sheet export and confirm the image and caption render.

## 3. Offline behavior
1. Load the app once while online.
2. Put the device in airplane mode.
3. Re-open the app and confirm the main shell loads.
4. Open Quick Log and Mapping.
5. Save one test record with no network.
6. Confirm the record appears in Records after save.
7. Open Handover and confirm the page loads without SQL table errors.

## 4. PWA cache hygiene
1. After a new deployment, open the updated build.
2. Confirm any temporary debug banner is absent.
3. If the UI looks stale, unregister the service worker and clear site data.
4. Re-open the app and confirm the latest build assets are active.

## 5. Reopen and correction
1. Save one Quick Log, one Mapping, and one Investigation Log on device.
2. Re-open each record from Entry Detail.
3. Use `Edit in Module`.
4. Correct one field and resave.
5. Re-open again and confirm the corrected value persists.

## 6. Review workflow
1. From Records, open `Location Review` and `Timeline`.
2. Confirm the latest field observation / hazard appears.
3. Confirm deleted records do not inflate action counts.
4. Open Dashboard and Handover for the same location and confirm wording matches the saved records.

## 7. Export workflow
1. Generate `Project Delivery Summary`.
2. Confirm it opens as printable HTML on the device browser.
3. Generate `Photo Sheet`.
4. Confirm image cards paginate cleanly in print preview or Save PDF.
