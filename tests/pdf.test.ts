import {
  decodePDFRawStream,
  PDFArray,
  PDFDocument,
  PDFRawStream,
} from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { getPageDimensionsMm } from '../src/config/pages'
import { millimetersToPoints } from '../src/lib/dimensions'
import {
  getMinimumPolygonDistanceMm,
  getRotatedRectangleCornersMm,
  getRotationOriginForBoundsMm,
  rectanglesOverlapMm,
} from '../src/lib/geometry'
import {
  CALIBRATION_SQUARE_SIZE_MM,
  CALIBRATION_STROKE_WIDTH_MM,
  createCalibrationPdf,
  createLabelsPdf,
  getCalibrationSquareGeometryMm,
  getCalibrationOutlineGeometryMm,
  getPdfStripTransform,
} from '../src/lib/pdf-export'
import {
  getSupportQrDecorationGeometryMm,
  SUPPORT_QR_CLEARANCE_MM,
  SUPPORT_QR_DISPLAY_URL,
} from '../src/lib/support-qr'
import {
  getPlacementPolygonMm,
  PDF_STRIP_GAP_MM,
  PdfPlacementError,
  planPdfLayout,
} from '../src/lib/pdf-layout'
import { createProject, createStrip } from '../src/model/defaults'
import { addGroupHeader } from '../src/lib/group-headers'
import { applyCellAppearanceToRange } from '../src/lib/cell-style'

function getDecodedPageContent(pdf: PDFDocument, pageIndex: number): string {
  const contents = pdf.getPage(pageIndex).node.Contents()
  if (!contents) return ''
  const streams =
    contents instanceof PDFArray
      ? Array.from({ length: contents.size() }, (_, index) =>
          contents.lookup(index, PDFRawStream),
        )
      : contents instanceof PDFRawStream
        ? [contents]
        : []

  return streams
    .map((stream) =>
      new TextDecoder().decode(decodePDFRawStream(stream).decode()),
    )
    .join('\n')
}

function asciiHex(text: string): string {
  return Array.from(new TextEncoder().encode(text), (byte) =>
    byte.toString(16).padStart(2, '0'),
  )
    .join('')
    .toUpperCase()
}

describe('PDF layout and generation', () => {
  it('creates an exact A4 landscape page and preserves a 216 mm strip width', async () => {
    const project = createProject()
    project.page = { size: 'A4', orientation: 'landscape' }
    project.strips = [createStrip('Half rack', 216, 7.5, 8)]

    const plan = planPdfLayout(project)
    expect(plan.placements[0].widthMm).toBe(216)
    expect(plan.placements[0].heightMm).toBe(7.5)

    const bytes = await createLabelsPdf(project)
    const pdf = await PDFDocument.load(bytes)
    const pageSize = pdf.getPage(0).getSize()
    expect(pageSize.width).toBeCloseTo(millimetersToPoints(297), 10)
    expect(pageSize.height).toBeCloseTo(millimetersToPoints(210), 10)
  })

  it('fits a 432 mm strip diagonally on A3 landscape without scaling', async () => {
    const project = createProject()
    project.page = { size: 'A3', orientation: 'landscape' }

    const plan = planPdfLayout(project)
    const placement = plan.placements[0]
    expect(placement.rotationDegrees).toBeGreaterThan(0)
    expect(placement.rotationDegrees).toBeLessThan(90)
    expect(placement.widthMm).toBe(432)
    expect(placement.heightMm).toBe(7.5)
    expect(placement.boundingWidthMm).toBeCloseTo(plan.usableArea.widthMm, 8)
    expect(placement.boundingHeightMm).toBeLessThanOrEqual(
      plan.usableArea.heightMm + 1e-8,
    )

    const origin = getRotationOriginForBoundsMm(
      placement.xMm,
      placement.yMm,
      placement.heightMm,
      placement.rotationDegrees,
    )
    const corners = getRotatedRectangleCornersMm(
      placement.widthMm,
      placement.heightMm,
      placement.rotationDegrees,
      origin,
    )
    expect(Math.hypot(
      corners[1].xMm - corners[0].xMm,
      corners[1].yMm - corners[0].yMm,
    )).toBeCloseTo(432, 10)
    expect(Math.hypot(
      corners[3].xMm - corners[0].xMm,
      corners[3].yMm - corners[0].yMm,
    )).toBeCloseTo(7.5, 10)

    const transform = getPdfStripTransform(placement)
    expect(Math.hypot(transform.a, transform.b)).toBeCloseTo(1, 12)
    expect(Math.hypot(transform.c, transform.d)).toBeCloseTo(1, 12)
    expect(transform.a * transform.c + transform.b * transform.d).toBeCloseTo(
      0,
      12,
    )
    expect(transform.a).toBeCloseTo(transform.d, 12)
    expect(transform.b).toBeCloseTo(-transform.c, 12)
    expect(transform.a * transform.d - transform.b * transform.c).toBeCloseTo(
      1,
      12,
    )
    expect(Number.isFinite(transform.translateXPt)).toBe(true)
    expect(Number.isFinite(transform.translateYPt)).toBe(true)
    expect(Object.keys(transform).sort()).toEqual([
      'a',
      'b',
      'c',
      'd',
      'translateXPt',
      'translateYPt',
    ])

    const bytes = await createLabelsPdf(project)
    const pdf = await PDFDocument.load(bytes)
    const pageSize = pdf.getPage(0).getSize()
    expect(pageSize.width).toBeCloseTo(millimetersToPoints(420), 10)
    expect(pageSize.height).toBeCloseTo(millimetersToPoints(297), 10)
  })

  it('rejects an impossible oversized strip rather than scaling it', () => {
    const project = createProject()
    project.page = { size: 'A3', orientation: 'landscape' }
    project.strips = [createStrip('Impossible', 1000, 1000, 1)]

    expect(() => planPdfLayout(project)).toThrow(PdfPlacementError)
    expect(() => planPdfLayout(project)).toThrow('Labels are never scaled')
  })

  it('packs multiple strips without overlapping and is deterministic', () => {
    const project = createProject()
    project.page = { size: 'A4', orientation: 'landscape' }
    project.strips = Array.from({ length: 28 }, (_, index) =>
      createStrip(`Half rack ${index + 1}`, 216, 7.5, 8),
    )

    const firstPlan = planPdfLayout(project)
    const secondPlan = planPdfLayout(project)
    expect(secondPlan).toEqual(firstPlan)
    expect(firstPlan.pageCount).toBeGreaterThan(1)

    for (const placement of firstPlan.placements) {
      const samePage = firstPlan.placements.filter(
        (candidate) =>
          candidate.pageIndex === placement.pageIndex &&
          candidate.stripId !== placement.stripId,
      )
      for (const other of samePage) {
        expect(
          rectanglesOverlapMm(
            {
              xMm: placement.xMm,
              yMm: placement.yMm,
              widthMm: placement.boundingWidthMm,
              heightMm: placement.boundingHeightMm,
            },
            {
              xMm: other.xMm,
              yMm: other.yMm,
              widthMm: other.boundingWidthMm,
              heightMm: other.boundingHeightMm,
            },
          ),
        ).toBe(false)
      }
    }
  })

  it('packs two 432 mm strips in parallel on one A3 page using real polygons', () => {
    const project = createProject()
    project.page = { size: 'A3', orientation: 'landscape' }
    project.strips = [
      createStrip('Long strip 1', 432, 7.5, 12),
      createStrip('Long strip 2', 432, 7.5, 12),
    ]

    const firstPlan = planPdfLayout(project)
    const secondPlan = planPdfLayout(project)
    expect(firstPlan).toEqual(secondPlan)
    expect(firstPlan.pageCount).toBe(1)
    expect(firstPlan.placements).toHaveLength(2)
    expect(firstPlan.placements[0].rotationDegrees).toBe(
      firstPlan.placements[1].rotationDegrees,
    )

    const polygons = firstPlan.placements.map(getPlacementPolygonMm)
    expect(getMinimumPolygonDistanceMm(polygons[0], polygons[1])).toBeCloseTo(
      PDF_STRIP_GAP_MM,
      9,
    )
    for (const placement of firstPlan.placements) {
      expect(placement.widthMm).toBe(432)
      expect(placement.heightMm).toBe(7.5)
      for (const corner of getPlacementPolygonMm(placement)) {
        expect(corner.xMm).toBeGreaterThanOrEqual(
          firstPlan.usableArea.xMm - 1e-8,
        )
        expect(corner.xMm).toBeLessThanOrEqual(
          firstPlan.usableArea.xMm + firstPlan.usableArea.widthMm + 1e-8,
        )
        expect(corner.yMm).toBeGreaterThanOrEqual(
          firstPlan.usableArea.yMm - 1e-8,
        )
        expect(corner.yMm).toBeLessThanOrEqual(
          firstPlan.usableArea.yMm + firstPlan.usableArea.heightMm + 1e-8,
        )
      }
    }
  })

  it('adds pages deterministically when all diagonal lanes cannot share one page', () => {
    const project = createProject()
    project.page = { size: 'A3', orientation: 'landscape' }
    project.strips = Array.from({ length: 20 }, (_, index) =>
      createStrip(`Long strip ${index + 1}`, 432, 7.5, 12),
    )

    const plan = planPdfLayout(project)
    expect(plan.pageCount).toBeGreaterThan(1)
    expect(plan.placements).toHaveLength(20)
    expect(plan.placements.every((placement) => placement.widthMm === 432)).toBe(
      true,
    )
    expect(plan.placements.every((placement) => placement.heightMm === 7.5)).toBe(
      true,
    )
    for (const [index, placement] of plan.placements.entries()) {
      const placementPolygon = getPlacementPolygonMm(placement)
      for (const other of plan.placements.slice(index + 1)) {
        if (placement.pageIndex !== other.pageIndex) continue
        expect(
          getMinimumPolygonDistanceMm(
            placementPolygon,
            getPlacementPolygonMm(other),
          ),
        ).toBeGreaterThanOrEqual(PDF_STRIP_GAP_MM - 1e-8)
      }
      for (const corner of placementPolygon) {
        expect(corner.xMm).toBeGreaterThanOrEqual(
          plan.usableArea.xMm - 1e-8,
        )
        expect(corner.xMm).toBeLessThanOrEqual(
          plan.usableArea.xMm + plan.usableArea.widthMm + 1e-8,
        )
        expect(corner.yMm).toBeGreaterThanOrEqual(
          plan.usableArea.yMm - 1e-8,
        )
        expect(corner.yMm).toBeLessThanOrEqual(
          plan.usableArea.yMm + plan.usableArea.heightMm + 1e-8,
        )
      }
    }
  })

  it('keeps group-header vectors inside the fixed 7.5 mm PDF strip', async () => {
    const project = createProject()
    let strip = applyCellAppearanceToRange(
      createStrip('Styled groups', 432, 7.5, 12),
      { startIndex: 0, endIndex: 5 },
      { backgroundColor: '#3973b9', textColor: '#ffffff' },
    )
    strip = addGroupHeader(
      strip,
      { startIndex: 0, endIndex: 5 },
      'GROUP HEADER MICS',
    )
    strip = addGroupHeader(
      strip,
      { startIndex: 6, endIndex: 11 },
      'GROUP HEADER LINE',
    )
    project.strips = [strip]

    const plan = planPdfLayout(project)
    expect(plan.placements[0].widthMm).toBe(432)
    expect(plan.placements[0].heightMm).toBe(7.5)

    const bytes = await createLabelsPdf(project)
    const pdf = await PDFDocument.load(bytes)
    const content = getDecodedPageContent(pdf, 0)
    expect(content).toContain('47524F555020484541444552204D494353')
    expect(content).toContain('47524F555020484541444552204C494E45')
    expect(content).toContain('612.2834645669292 5.669291338582678 l')
    expect(content).toContain('0 21.25984251968504 l')
    expect(content).not.toContain('0 32.5984251968504 l')
    expect(content).toContain(
      '0.2235294117647059 0.45098039215686275 0.7254901960784313 rg',
    )
  })

  it('places the optional support QR outside label geometry without changing layout', async () => {
    const project = createProject()
    project.page = { size: 'A3', orientation: 'landscape' }
    project.strips = [
      createStrip('Long strip 1', 432, 7.5, 12),
      createStrip('Long strip 2', 432, 7.5, 12),
    ]
    const before = planPdfLayout(project)
    const geometry = getSupportQrDecorationGeometryMm(
      before.pageWidthMm,
      before.pageHeightMm,
    )
    expect(geometry).toBeDefined()
    if (!geometry) throw new Error('Expected A3 support decoration geometry.')

    const usableTopMm = before.usableArea.yMm + before.usableArea.heightMm
    expect(geometry.yMm).toBeGreaterThanOrEqual(
      usableTopMm + SUPPORT_QR_CLEARANCE_MM,
    )
    for (const placement of before.placements) {
      expect(
        rectanglesOverlapMm(geometry, {
          xMm: placement.xMm,
          yMm: placement.yMm,
          widthMm: placement.boundingWidthMm,
          heightMm: placement.boundingHeightMm,
        }),
      ).toBe(false)
    }

    const bytes = await createLabelsPdf(project, { includeSupportQr: true })
    const after = planPdfLayout(project)
    expect(after).toEqual(before)
    const pdf = await PDFDocument.load(bytes)
    const content = getDecodedPageContent(pdf, 0)
    expect(content).toContain(asciiHex(SUPPORT_QR_DISPLAY_URL))
    expect(content).toMatch(/\/Image-[^\s]+ Do/)
    expect(after.pageCount).toBe(1)
    expect(after.placements.every((placement) => placement.widthMm === 432)).toBe(
      true,
    )
    expect(after.placements.every((placement) => placement.heightMm === 7.5)).toBe(
      true,
    )
  })

  it('omits support decoration when disabled and from calibration PDFs', async () => {
    const project = createProject()
    const labelsBytes = await createLabelsPdf(project, {
      includeSupportQr: false,
    })
    const labelsPdf = await PDFDocument.load(labelsBytes)
    const labelContent = getDecodedPageContent(labelsPdf, 0)
    expect(labelContent).not.toContain(asciiHex(SUPPORT_QR_DISPLAY_URL))
    expect(labelContent).not.toMatch(/\/Image-[^\s]+ Do/)

    const calibrationBytes = await createCalibrationPdf({
      size: 'A4',
      orientation: 'portrait',
    })
    const calibrationPdf = await PDFDocument.load(calibrationBytes)
    const calibrationContent = getDecodedPageContent(calibrationPdf, 0)
    expect(calibrationContent).not.toContain(asciiHex(SUPPORT_QR_DISPLAY_URL))
    expect(calibrationContent).not.toMatch(/\/Image-[^\s]+ Do/)
  })

  it('keeps the canonical millimeter-to-point conversion unchanged', () => {
    expect(millimetersToPoints(25.4)).toBe(72)
    expect(millimetersToPoints(27)).toBeCloseTo(76.53543307086615, 12)
    expect(millimetersToPoints(100)).toBeCloseTo(283.46456692913387, 12)
  })

  it('uses an exact 100 × 100 mm calibration square', async () => {
    const pageSettings = { size: 'A4', orientation: 'portrait' } as const
    const pageDimensions = getPageDimensionsMm(pageSettings)
    const square = getCalibrationSquareGeometryMm(pageSettings)
    const outline = getCalibrationOutlineGeometryMm(pageSettings)
    expect(CALIBRATION_SQUARE_SIZE_MM).toBe(100)
    expect(square.sizeMm).toBe(100)
    expect(square.xMm).toBe((pageDimensions.widthMm - 100) / 2)
    expect(square.yMm).toBe((pageDimensions.heightMm - 100) / 2)
    expect(outline.pathSizeMm + outline.strokeWidthMm).toBe(100)
    expect(outline.xMm - CALIBRATION_STROKE_WIDTH_MM / 2).toBe(square.xMm)
    expect(outline.yMm - CALIBRATION_STROKE_WIDTH_MM / 2).toBe(square.yMm)

    const bytes = await createCalibrationPdf(pageSettings)
    const pdf = await PDFDocument.load(bytes)
    const pageSize = pdf.getPage(0).getSize()
    expect(pageSize.width).toBeCloseTo(millimetersToPoints(210), 10)
    expect(pageSize.height).toBeCloseTo(millimetersToPoints(297), 10)
  })
})
