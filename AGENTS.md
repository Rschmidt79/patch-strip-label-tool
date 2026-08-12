# Patch Strip Label Tool — Agent Guide

## Product goal

Build a small, professional, entirely client-side web application for creating physical printed labels for broadcast rack panels, patch panels, and equipment. The primary workflow is fast, direct editing of label cells. The interface should feel like a focused editor, not a dense engineering configuration console.

The priority order is:

1. Fast editing
2. Easy understanding
3. Dimensional accuracy
4. Reliable PDF export

There is no backend, authentication, or database. Do not introduce one. Keep dependencies few and architecture straightforward.

## Non-negotiable dimensional accuracy

Physical dimensions are domain data, not presentation data. Store strip widths, strip heights, cell widths, page sizes, margins, and placement coordinates as numbers in millimeters. Never persist physical geometry in CSS pixels.

The SVG editor uses a `viewBox` whose user units correspond to millimeters and explicit root `width` and `height` attributes with `mm` units. CSS/browser scaling is only editor zoom and must never mutate physical dimensions.

For all PDF work:

- Convert directly from millimeters to PDF points with `points = millimeters * 72 / 25.4`.
- Keep label outlines, dividers, crop geometry, and text as vector content where the PDF library permits it. Do not render the SVG to a bitmap as the primary export path.
- Do not use browser CSS pixel measurements as PDF geometry input.
- Verify generated PDF page boxes and label geometry numerically, then print at `100%` / `Actual Size`.
- Put `Print at 100% / Actual Size — Do not Fit to Page` outside the label cutting area.
- The calibration artifact must contain a mathematically exact 100 × 100 mm square.
- Automatic placement must account for margins, the warning reserve, and diagonal fit inside the available page rectangle; do not ask the user for an angle.

Constants for conversion live in `src/lib/dimensions.ts`. Reuse them instead of creating local conversion factors.

## Current architecture

- `src/model/project.ts`: versioned serializable domain types. `LabelProject` is the JSON project root.
- `src/model/defaults.ts`: factories for projects, strips, cells, and stable IDs.
- `src/config/presets.ts`: declarative strip preset catalog. Add future presets here.
- `src/config/pages.ts`: canonical A4/A3 physical page dimensions and orientation handling.
- `src/lib/dimensions.ts`: dimensional conversion, display formatting, and preview text fitting.
- `src/lib/strip.ts`: pure strip transformations such as resizing and duplication.
- `src/lib/auto-numbering.ts`: pure sequence formatting, range-bounded template application, and range clearing.
- `src/lib/project-file.ts`: schema-version dispatch, complete JSON validation, serialization, and file reading.
- `src/config/project-files.ts`: canonical project extension, legacy extension, picker accept string, and custom MIME type.
- `src/lib/project-file-name.ts`: sanitized `.racklabel` filename generation and filename-based fallback project names.
- `src/lib/file-handling.ts`: feature-detected installed-PWA launch-file integration that delegates to the normal project reader.
- `src/lib/geometry.ts`: reusable rotated-rectangle bounds, exact fit-angle candidates, corners, and overlap geometry in millimeters.
- `src/lib/pdf-layout.ts`: deterministic unscaled horizontal/vertical/diagonal page packing and fit failures in millimeters.
- `src/lib/print-preferences.ts`: versioned local print/export preferences, validation, and legacy stored-gap compatibility.
- `src/lib/print-layout.ts`: shared composition of packing placements and page cut-guide geometry for preview and PDF.
- `src/lib/cut-guides.ts`: pure coincident-edge, deduplicated cut-line, shared-edge, and crop-mark geometry in millimeters.
- `src/lib/pdf-export.ts`: dynamically loaded client-side vector PDF and calibration generation.
- `src/lib/download.ts`: browser Blob download, dated PDF filename, and print-tab helpers.
- `src/components/Toolbar.tsx`: project identity and top-level actions.
- `src/components/Sidebar.tsx`: page, strip, and selected-cell controls.
- `src/components/Workspace.tsx`: strip collection and editor-level controls.
- `src/components/PageLayoutPreview.tsx`: SVG page preview driven by the shared PDF layout plan.
- `src/components/StripCard.tsx`: one strip's metadata, actions, ruler, and preview frame.
- `src/components/StripSvgEditor.tsx`: native SVG label geometry and direct cell editing.
- `src/App.tsx`: owns project state and coordinates selection and transformations.
- `src/styles.css`: the dark desktop-first visual system.

Keep geometry/domain functions pure where practical. Keep components focused on interaction and rendering. If project state becomes unwieldy, move it to a typed reducer before adding a state-management dependency.

## Data-model conventions

- The JSON model is versioned through `schemaVersion`. Add migrations when the persisted shape changes after JSON save/load ships.
- Every project, strip, and cell has a stable ID. Duplication must issue new IDs.
- Keep every strip's `cells.length` equal to `dimensions.cellCount`.
- Cell text is explicitly `line1` and `line2`; do not store markup or arbitrary rich text.
- Per-cell text style permits generated labels to be edited independently.
- Presets are data, not conditional UI branches.

## Coding conventions

- Use React, TypeScript, Vite, and SVG. Keep TypeScript strict.
- Prefer named exports, small typed props, immutable updates, and pure helpers.
- Use millimeter-oriented names such as `widthMm` and `cellWidthMm`. Use explicit suffixes for other units such as `fontSizePt`.
- Avoid `any`, implicit unit conversions, hidden rounding, and duplicated constants.
- Round only for display. Retain full numeric precision in application state and export calculations.
- Preserve keyboard-first editing. Tab and Shift+Tab must continue to move between cells.
- Preserve the distinction between selection and editing: a normal cell click selects and edits one cell; Shift-click extends a contiguous range without opening an editor. Bulk operations must never affect cells outside the resolved range.
- Keep uncommon settings under an Advanced disclosure.
- Add dependencies only when they clearly reduce risk or complexity. Keep `pdf-lib` as the PDF primitive layer unless a reviewed replacement materially improves precise browser-side vector output.
- Keep the production artifact deployable as static files. Never add API routes, server functions, server rendering, database clients, or a required local companion application.
- Keep the PDF exporter dynamically loaded so PDF code does not increase initial editor startup cost.
- Maintain accessible labels, focus states, and button semantics.

## PDF implementation

`pdf-lib` is the only PDF runtime dependency. `src/lib/pdf-export.ts` constructs custom-sized PDF pages and vector content directly in points. It must not inspect rendered SVG/DOM dimensions. Print/export settings are separate local preferences; they default to edge-to-edge placement, vector cut lines, and vector crop marks, while Custom spacing starts at 2 mm. The shared placement planner uses 10 mm margins, reserves 10 mm for the print warning, and tries horizontal and vertical placements before a heuristic diagonal search over multiple angles and staggered long-axis offsets. Diagonal bounds checks, collision checks, and spacing use the actual oriented strip polygons rather than conservative rotated bounding boxes. Touching edges are valid at zero gap, positive-area overlap is never valid, and coincident cut edges are emitted only once. Candidate scoring first maximizes strips fitted on the current page, then considers compactness, useful shared cutting edges, and deterministic tie-breakers. New pages are added as required. A strip with no true-size placement at any angle aborts export with a clear error; it is never scaled.

The PDF applies rotation with a cosine/sine matrix whose determinant is one. Widths and heights are still converted directly from their original millimeter values. Export and Print both call the same PDF generator; Print opens a Blob PDF in a new browser tab and relies on the browser's normal print UI.

The exporter currently uses PDF standard Helvetica/Helvetica Bold. Custom font embedding and broader Unicode coverage remain future work.

## Static hosting

The application is intended to be hosted as a static website. `npm run build` must produce a self-contained `dist/` containing browser assets only. No Node.js runtime is permitted after build. Vercel and similar hosts should use `npm run build` with `dist` as the output directory. Do not add serverless functions, backend endpoints, secrets, database storage, or authentication.

## Milestone status

Milestones 1 through 3 are implemented: Vite/React/TypeScript foundation, typed editor model, direct SVG editing, strip management, text styling/auto-fit, presets, millimeter geometry, range-aware auto numbering and clearing, versioned JSON save/open with migrations, A4/A3 deterministic unscaled packing, automatic diagonal rotation, shared page preview, direct PDF print-tab workflow, clear non-fit reporting, calibration PDF, and automated dimensional/domain tests.

Intentionally still pending: CSV import/export, mathematically optimal packing, printer correction factors, robust dirty-state tracking, custom font embedding, broader Unicode handling, and additional migration versions.
