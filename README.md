# Rack Label Maker

A completely client-side React application for designing and exporting true-size labels for broadcast racks, patch panels, and equipment. Projects and PDFs remain in the browser; there is no backend, account, database, analytics, cloud storage, or required server runtime.

![Rack Label Maker with range-aware numbering](docs/range-selection-preview.png)

## Development

Install dependencies and start Vite:

```bash
npm install
npm run dev
```

Run the automated dimensional and domain tests:

```bash
npm test
```

Run ESLint:

```bash
npm run lint
```

## Production build

```bash
npm ci
npm run build
```

The deployable static output is `dist/`. It contains browser assets only; Node.js is not required after the build. Upload the contents of `dist/` to any static host, including:

- Vercel
- Netlify
- conventional static web hosting
- nginx or Apache
- similar static hosting and object-storage/CDN services

Before deployment, serve `dist/` with any plain static file server and verify the editor, project Save/Open, lazy-loaded PDF export, Print, and Help/About workflows.

The production build also generates `manifest.webmanifest`, install icons,
`registerSW.js`, and `sw.js`. The service worker precaches the application shell
for basic offline startup; it does not implement background project sync or an
aggressive runtime cache. Run `npm run verify:pwa` after `npm run build` to
verify the generated manifest, icons, file association, and service worker.

### Security headers

`vercel.json` configures the production CSP and related headers on Vercel.
`public/_headers` is copied to `dist/_headers` for Netlify-compatible hosts.
The policy permits only same-origin application code, local/data images and
fonts, and Blob URLs needed by generated PDF/Print workflows; framing and
plugin objects are blocked.

For nginx or Apache, configure the equivalent response headers on every static
asset and the SPA fallback response:

```text
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
X-Frame-Options: DENY
```

Inline styles remain permitted because React uses inline style properties for
editor zoom and validated colors. Scripts do not require `unsafe-inline` or
`unsafe-eval`.

## Static SPA fallback

The application currently uses a single screen, but a fallback to `index.html` prevents future client-side routes or direct navigation from returning a 404.

- `vercel.json` provides a minimal Vercel rewrite.
- `public/_redirects` is copied to `dist/_redirects` for Netlify-compatible hosts.
- On nginx, use `try_files $uri $uri/ /index.html;` in the site location.
- On Apache, enable `mod_rewrite` and rewrite non-file/non-directory requests to `/index.html`.

These files are optional on hosts that already provide a “single-page application” fallback. They do not make the build dependent on Vercel or Netlify.

## Custom domain

For a deployment such as `labels.rschmidt.dk`:

1. Build and deploy `dist/` using the chosen static host.
2. Add `labels.rschmidt.dk` as a custom domain in that host.
3. Create the DNS record requested by the host, normally a CNAME or provider-specific A/AAAA record.
4. Confirm HTTPS is active, then test project Save/Open, PDF export, Print, and PWA installation from the public URL.

No provider credentials, API secrets, or runtime environment variables belong in the repository. The public feedback destination is configured once in `src/config/app-info.ts`.

## Dimensional model

All physical geometry is persisted in millimeters. The strip SVG uses a millimeter-coordinate `viewBox` and explicit `width="…mm"` / `height="…mm"` attributes. Editor zoom and editor-only cell indices never alter or enter physical geometry.

PDF geometry is created directly from millimeters with `points = millimeters × 72 / 25.4`. No DOM or CSS pixel measurements enter the PDF path. The exporter preserves true strip dimensions, uses deterministic unscaled placement, and draws the exact same print-layout plan shown in Page Preview. Its diagonal heuristic tests multiple angles and staggered offsets, then validates the actual oriented strip polygons. Print settings default to edge-to-edge packing with vector cut lines; a custom gap retains a convenient 2 mm initial value. Layout margins default to 10 mm; SRA3 uses 9 mm left/right margins so the 432 mm rack preset fits horizontally while retaining 10 mm top/bottom margins and the separate print-warning reserve.

Paper, orientation, auto-arrange, spacing, and cut-guide choices are versioned preferences stored locally under a dedicated browser-storage key. Available paper sizes are A4, A3, SRA3 (320 × 450 mm), US Letter, US Legal, and US Tabloid. They are not written into label project files. Existing schema 1–3 projects still open normally. Compatibility schema 4 files containing the former `page.stripGapMm` field are normalized back to label schema 3; when no valid local print preference exists, that paper configuration and gap seed the initial print settings instead of being discarded. An established local preference always wins.

Export PDF downloads a dated PDF. Print opens the same exact-size PDF in the browser's normal print workflow. Always choose `100%` / `Actual Size`; never choose Fit, Shrink, or Scale to printable area. Some printer drivers silently scale PDFs, so verify the setting manually. The calibration PDF contains a mathematically exact 100 × 100 mm square.

## Project files

Save downloads a human-readable, versioned `.racklabel` document using the
project name as its filename, for example `FlyAway.racklabel`. The custom file
is JSON data using the same existing project schema, validation, and migration
path; changing the extension does not change or increment the schema version.
Older `.json` project files remain supported by Open and pass through exactly
the same reader as `.racklabel` files.

In a normal browser tab, use Open and Save as usual. Rack Label Maker is also
an installable PWA with basic offline application-shell support. On supported
Chromium-based desktop browser/OS combinations, the installed app can register
as a handler for `.racklabel` files. Double-clicking an associated document
then launches Rack Label Maker and loads the file through the normal project
validator without requiring a second Open step.

Native file association is progressive enhancement. It depends on browser,
operating-system, installation, secure-origin, and administrator support. A
browser without the File Handling or Launch Queue APIs continues to work
normally: Open accepts `.racklabel` and legacy `.json`, Save downloads a new
`.racklabel`, and PDF workflows are unaffected. Opening a document does not
grant or assume permission to overwrite the original file; Save continues to
create a download.

Project state is not sent to a backend or cloud service. Print/export
preferences are the only current local-storage persistence and remain separate
from the project schema.

## Numbering

Auto numbering accepts `{n}` anywhere in either line template; the adjacent `#` button inserts it automatically. Click a cell to select and edit it, then Shift-click another cell to select a contiguous range. Numbering, clearing, group headers, and cell appearance changes can be applied to the selected range without changing neighboring cells.

New strips begin empty. The neutral `Router Out` / `{n}` numbering template is
only applied when the user explicitly chooses Apply. Normal label and Print
PDFs automatically include the bundled Buy Me a Coffee QR in a collision-safe
bottom-right decoration area. It never changes strip placement and never
appears in calibration PDFs.

CSV, accounts, printer correction factors, analytics, cloud save, nested headers, and arbitrary uploaded fonts are intentionally not implemented.
