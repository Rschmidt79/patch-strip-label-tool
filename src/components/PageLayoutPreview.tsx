import type { LabelProject } from '../model/project'
import type { PrintLayoutPlan } from '../lib/print-layout'
import { getRotationOriginForBoundsMm } from '../lib/geometry'
import type { LineSegmentMm } from '../lib/cut-guides'
import {
  MAX_CUSTOM_STRIP_GAP_MM,
  MIN_CUSTOM_STRIP_GAP_MM,
  type PrintPreferences,
} from '../lib/print-preferences'
import { PrintSegmentArtwork } from './PrintSegmentArtwork'
import supportQrImageUrl from '../assets/bmc_qr.png'
import {
  SUPPORT_QR_LABEL_LINE_1,
  SUPPORT_QR_LABEL_LINE_2,
} from '../lib/support-qr'
import {
  getPageSizeDisplayName,
  PAGE_SIZE_IDS,
} from '../config/pages'

interface PageLayoutPreviewProps {
  project: LabelProject
  preferences: PrintPreferences
  plan: PrintLayoutPlan | undefined
  error: string | undefined
  onPreferencesChange: (preferences: PrintPreferences) => void
}

function PrintGuideLine({
  segment,
  pageHeightMm,
  className,
}: {
  segment: LineSegmentMm
  pageHeightMm: number
  className: string
}) {
  return (
    <line
      className={className}
      x1={segment.start.xMm}
      y1={pageHeightMm - segment.start.yMm}
      x2={segment.end.xMm}
      y2={pageHeightMm - segment.end.yMm}
    />
  )
}

export function PageLayoutPreview({
  project,
  preferences,
  plan,
  error,
  onPreferencesChange,
}: PageLayoutPreviewProps) {
  const stripsById = new Map(project.strips.map((strip) => [strip.id, strip]))
  const segmentsById = new Map(
    plan?.printSegments.map((segment) => [segment.id, segment]) ?? [],
  )
  const updatePreferences = (change: Partial<PrintPreferences>) =>
    onPreferencesChange({ ...preferences, ...change })

  return (
    <details className="page-layout-preview" open>
      <summary>
        <span>
          <strong>Page layout preview</strong>
          <small>
            Display scaled to fit · all placement geometry remains in mm
          </small>
        </span>
        {plan && (
          <b>
            {getPageSizeDisplayName(preferences.paperSize)}{' '}
            {preferences.orientation} · {plan.pageCount}{' '}
            {plan.pageCount === 1 ? 'page' : 'pages'}
          </b>
        )}
      </summary>

      <div
        className={`page-layout-preview-body${plan ? '' : ' page-layout-preview-body-settings-only'}`}
      >
      <section className="print-layout-settings" aria-label="Print layout">
        <div className="print-layout-settings-heading">
          <div>
            <strong>Print layout</strong>
            <small>Saved locally · label content is unchanged</small>
          </div>
          <label className="print-setting-toggle">
            <input
              type="checkbox"
              checked={preferences.autoArrange}
              onChange={(event) =>
                updatePreferences({ autoArrange: event.target.checked })
              }
            />
            <span>Auto arrange</span>
          </label>
        </div>

        <div className="print-layout-settings-grid">
          <fieldset>
            <legend>Paper</legend>
            <div className="print-paper-fields">
              <label>
                <span>Size</span>
                <select
                  value={preferences.paperSize}
                  onChange={(event) =>
                    updatePreferences({
                      paperSize:
                        event.target.value as PrintPreferences['paperSize'],
                    })
                  }
                >
                  {PAGE_SIZE_IDS.map((size) => (
                    <option key={size} value={size}>
                      {getPageSizeDisplayName(size)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Orientation</span>
                <select
                  value={preferences.orientation}
                  onChange={(event) =>
                    updatePreferences({
                      orientation: event.target.value as
                        | 'portrait'
                        | 'landscape',
                    })
                  }
                >
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Spacing</legend>
            <label className="print-setting-choice">
              <input
                type="radio"
                name="strip-spacing"
                checked={preferences.spacingMode === 'edge-to-edge'}
                onChange={() =>
                  updatePreferences({ spacingMode: 'edge-to-edge' })
                }
              />
              <span>Edge-to-edge</span>
              <small>0 mm · shared cuts</small>
            </label>
            <label className="print-setting-choice custom-gap-choice">
              <input
                type="radio"
                name="strip-spacing"
                checked={preferences.spacingMode === 'custom'}
                onChange={() => updatePreferences({ spacingMode: 'custom' })}
              />
              <span>Custom gap</span>
              <span className="print-gap-input">
                <input
                  type="number"
                  aria-label="Custom strip gap in millimeters"
                  value={preferences.customGapMm}
                  min={MIN_CUSTOM_STRIP_GAP_MM}
                  max={MAX_CUSTOM_STRIP_GAP_MM}
                  step={0.5}
                  disabled={preferences.spacingMode !== 'custom'}
                  onChange={(event) => {
                    const customGapMm = Number(event.target.value)
                    if (
                      Number.isFinite(customGapMm) &&
                      customGapMm >= MIN_CUSTOM_STRIP_GAP_MM &&
                      customGapMm <= MAX_CUSTOM_STRIP_GAP_MM
                    ) {
                      updatePreferences({ customGapMm })
                    }
                  }}
                />
                mm
              </span>
            </label>
          </fieldset>

          <fieldset>
            <legend>Cut guides</legend>
            <label className="print-setting-toggle">
              <input
                type="checkbox"
                checked={preferences.cropMarks}
                onChange={(event) =>
                  updatePreferences({ cropMarks: event.target.checked })
                }
              />
              <span>Cut lines</span>
            </label>
          </fieldset>
        </div>
      </section>

      {error && (
        <div className="page-layout-error" role="status">
          {error}
        </div>
      )}

      {plan && (
        <div className="page-preview-grid">
          {Array.from({ length: plan.pageCount }, (_, pageIndex) => {
            const pagePlacements = plan.placements.filter(
              (placement) => placement.pageIndex === pageIndex,
            )
            const pageGuides = plan.pageGuides.find(
              (guides) => guides.pageIndex === pageIndex,
            )
            const usableTopSvgMm =
              plan.pageHeightMm -
              plan.usableArea.yMm -
              plan.usableArea.heightMm
            const supportQrGeometry = plan.supportArea

            return (
              <figure className="page-preview-card" key={pageIndex}>
                <figcaption>
                  <span>Page {pageIndex + 1}</span>
                  <span>
                    {plan.pageWidthMm} × {plan.pageHeightMm} mm
                  </span>
                </figcaption>
                <svg
                  viewBox={`0 0 ${plan.pageWidthMm} ${plan.pageHeightMm}`}
                  role="img"
                  aria-label={`Page ${pageIndex + 1} layout with ${pagePlacements.length} strips`}
                >
                  <rect
                    className="page-preview-paper"
                    x="0"
                    y="0"
                    width={plan.pageWidthMm}
                    height={plan.pageHeightMm}
                  />
                  <rect
                    className="page-preview-usable"
                    x={plan.usableArea.xMm}
                    y={usableTopSvgMm}
                    width={plan.usableArea.widthMm}
                    height={plan.usableArea.heightMm}
                  />
                  <text
                    className="page-preview-warning"
                    x={plan.usableArea.xMm}
                    y={usableTopSvgMm - 4}
                  >
                    PRINT AT 100% / ACTUAL SIZE · DO NOT FIT OR SHRINK TO PAGE
                  </text>

                  {supportQrGeometry && (
                    <g className="page-preview-support" aria-hidden="true">
                      <text
                        x={supportQrGeometry.textRightXmm}
                        y={
                          plan.pageHeightMm -
                          supportQrGeometry.yMm -
                          supportQrGeometry.heightMm / 2 -
                          1.2
                        }
                        textAnchor="end"
                      >
                        {SUPPORT_QR_LABEL_LINE_1}
                      </text>
                      <text
                        x={supportQrGeometry.textRightXmm}
                        y={
                          plan.pageHeightMm -
                          supportQrGeometry.yMm -
                          supportQrGeometry.heightMm / 2 +
                          1.8
                        }
                        textAnchor="end"
                      >
                        {SUPPORT_QR_LABEL_LINE_2}
                      </text>
                      <rect
                        x={supportQrGeometry.xMm}
                        y={
                          plan.pageHeightMm -
                          supportQrGeometry.yMm -
                          supportQrGeometry.heightMm
                        }
                        width={supportQrGeometry.widthMm}
                        height={supportQrGeometry.heightMm}
                      />
                      <image
                        href={supportQrImageUrl}
                        x={supportQrGeometry.imageXmm}
                        y={
                          plan.pageHeightMm -
                          supportQrGeometry.imageYmm -
                          supportQrGeometry.imageSizeMm
                        }
                        width={supportQrGeometry.imageSizeMm}
                        height={supportQrGeometry.imageSizeMm}
                        preserveAspectRatio="xMidYMid meet"
                      />
                    </g>
                  )}

                  {pagePlacements.map((placement) => {
                    const origin = getRotationOriginForBoundsMm(
                      placement.xMm,
                      placement.yMm,
                      placement.heightMm,
                      placement.rotationDegrees,
                    )
                    const segment = segmentsById.get(placement.stripId)
                    const strip = segment
                      ? stripsById.get(segment.stripId)
                      : undefined
                    if (!strip || !segment) return null

                    return (
                      <g
                        key={placement.stripId}
                        className="page-preview-strip"
                        transform={`translate(${origin.xMm} ${plan.pageHeightMm - origin.yMm}) rotate(${-placement.rotationDegrees}) translate(0 ${-placement.heightMm})`}
                      >
                        <title>
                          {strip.name || 'Unnamed strip'}
                          {segment.segmentCount > 1
                            ? `, segment ${segment.segmentIndex + 1} of ${segment.segmentCount}`
                            : ''}
                          : {placement.widthMm} × {placement.heightMm} mm at{' '}
                          {placement.rotationDegrees.toFixed(2)}°
                        </title>
                        <PrintSegmentArtwork
                          strip={strip}
                          segment={segment}
                        />
                      </g>
                    )
                  })}

                  {pageGuides && (
                    <g aria-hidden="true">
                      {pageGuides.cutLines.map((segment, index) => (
                        <PrintGuideLine
                          key={`cut-${index}`}
                          segment={segment}
                          pageHeightMm={plan.pageHeightMm}
                          className="page-preview-cut-line"
                        />
                      ))}
                      {pageGuides.cropMarks.map((segment, index) => (
                        <PrintGuideLine
                          key={`crop-${index}`}
                          segment={segment}
                          pageHeightMm={plan.pageHeightMm}
                          className="page-preview-crop-mark"
                        />
                      ))}
                    </g>
                  )}
                </svg>
              </figure>
            )
          })}
        </div>
      )}
      </div>
    </details>
  )
}
