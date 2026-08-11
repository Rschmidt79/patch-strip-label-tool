import type { LabelProject } from '../model/project'
import type { PdfLayoutPlan } from '../lib/pdf-layout'
import {
  getRotationOriginForBoundsMm,
} from '../lib/geometry'
import { StripArtwork } from './StripArtwork'
import supportQrImageUrl from '../assets/bmc_qr.png'
import {
  getSupportQrDecorationGeometryMm,
  SUPPORT_QR_DISPLAY_URL,
} from '../lib/support-qr'

interface PageLayoutPreviewProps {
  project: LabelProject
  plan: PdfLayoutPlan | undefined
  error: string | undefined
  includeSupportQr: boolean
}

export function PageLayoutPreview({
  project,
  plan,
  error,
  includeSupportQr,
}: PageLayoutPreviewProps) {
  const stripsById = new Map(project.strips.map((strip) => [strip.id, strip]))

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
            {project.page.size} {project.page.orientation} · {plan.pageCount}{' '}
            {plan.pageCount === 1 ? 'page' : 'pages'}
          </b>
        )}
      </summary>

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
            const usableTopSvgMm =
              plan.pageHeightMm -
              plan.usableArea.yMm -
              plan.usableArea.heightMm
            const supportQrGeometry = includeSupportQr
              ? getSupportQrDecorationGeometryMm(
                  plan.pageWidthMm,
                  plan.pageHeightMm,
                )
              : undefined

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
                        Like the tool?
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
                        {SUPPORT_QR_DISPLAY_URL}
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
                    const strip = stripsById.get(placement.stripId)
                    if (!strip) return null

                    return (
                      <g
                        key={placement.stripId}
                        transform={`translate(${origin.xMm} ${plan.pageHeightMm - origin.yMm}) rotate(${-placement.rotationDegrees}) translate(0 ${-placement.heightMm})`}
                      >
                        <title>
                          {strip.name || 'Unnamed strip'}: {placement.widthMm} ×{' '}
                          {placement.heightMm} mm at{' '}
                          {placement.rotationDegrees.toFixed(2)}°
                        </title>
                        <StripArtwork strip={strip} />
                      </g>
                    )
                  })}
                </svg>
              </figure>
            )
          })}
        </div>
      )}
    </details>
  )
}
