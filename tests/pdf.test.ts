import {
  decodePDFRawStream,
  PDFArray,
  PDFDocument,
  PDFRawStream,
} from 'pdf-lib'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getPageDimensionsMm } from '../src/config/pages'
import { millimetersToPoints } from '../src/lib/dimensions'
import {
  getMinimumPolygonDistanceMm,
  getRotatedRectangleCornersMm,
  getRotationOriginForBoundsMm,
  polygonsOverlapMm,
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
  getSupportQrDecorationPolygonMm,
  getSafeSupportQrDecorationGeometryMm,
  SUPPORT_QR_CLEARANCE_MM,
  SUPPORT_QR_LABEL_LINE_1,
  SUPPORT_QR_LABEL_LINE_2,
} from '../src/lib/support-qr'
import {
  getPlacementPolygonMm,
  PDF_STRIP_GAP_MM,
  PdfPlacementError,
  planPdfLayout,
  type PdfStripPlacement,
} from '../src/lib/pdf-layout'
import { createProject, createStrip } from '../src/model/defaults'
import { addGroupHeader } from '../src/lib/group-headers'
import { applyCellAppearanceToRange } from '../src/lib/cell-style'
import { getTotalSharedEdgeLengthMm } from '../src/lib/cut-guides'

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

  it.each([
    ['SRA3', 320, 450],
    ['Letter', 215.9, 279.4],
    ['Legal', 215.9, 355.6],
    ['Tabloid', 279.4, 431.8],
  ] as const)(
    'packs strips on the exact %s portrait page size',
    (size, widthMm, heightMm) => {
      const project = createProject()
      project.page = { size, orientation: 'portrait' }
      project.strips = [createStrip('Compact strip', 100, 7.5, 4)]

      const plan = planPdfLayout(project)

      expect(plan.pageWidthMm).toBe(widthMm)
      expect(plan.pageHeightMm).toBe(heightMm)
      expect(plan.placements).toHaveLength(1)
      expect(plan.placements[0].widthMm).toBe(100)
    },
  )

  it('creates exact SRA3 landscape output and keeps the 432 mm rack preset horizontal', async () => {
    const project = createProject()
    project.page = { size: 'SRA3', orientation: 'landscape' }
    project.strips = [createStrip('Full rack strip', 432, 7.5, 12)]

    const plan = planPdfLayout(project)
    expect(plan.pageWidthMm).toBe(450)
    expect(plan.pageHeightMm).toBe(320)
    expect(plan.pageMarginsMm).toEqual({
      leftMm: 9,
      rightMm: 9,
      topMm: 10,
      bottomMm: 10,
    })
    expect(plan.usableArea.widthMm).toBe(432)
    expect(plan.placements[0]).toMatchObject({
      xMm: 9,
      widthMm: 432,
      heightMm: 7.5,
      rotationDegrees: 0,
    })

    const bytes = await createLabelsPdf(project)
    const pdf = await PDFDocument.load(bytes)
    const pageSize = pdf.getPage(0).getSize()
    expect(pageSize.width).toBeCloseTo(millimetersToPoints(450), 10)
    expect(pageSize.height).toBeCloseTo(millimetersToPoints(320), 10)
  })

  it('uses vertical SRA3 placement before considering a diagonal fit', () => {
    const project = createProject()
    project.page = { size: 'SRA3', orientation: 'portrait' }
    project.strips = [createStrip('Tall rack strip', 400, 7.5, 12)]

    const plan = planPdfLayout(project)

    expect(plan.placements[0].rotationDegrees).toBe(90)
  })

  it('creates an exact US Letter portrait PDF page', async () => {
    const project = createProject()
    project.page = { size: 'Letter', orientation: 'portrait' }
    project.strips = [createStrip('Compact strip', 100, 7.5, 4)]

    const bytes = await createLabelsPdf(project)
    const pdf = await PDFDocument.load(bytes)
    const pageSize = pdf.getPage(0).getSize()

    expect(pageSize.width).toBeCloseTo(millimetersToPoints(215.9), 10)
    expect(pageSize.height).toBeCloseTo(millimetersToPoints(279.4), 10)
  })

  it('fits a long rack strip and creates an exact US Tabloid landscape PDF page', async () => {
    const project = createProject()
    project.page = { size: 'Tabloid', orientation: 'landscape' }
    project.strips = [createStrip('Long strip', 432, 7.5, 12)]

    const plan = planPdfLayout(project)
    expect(plan.placements).toHaveLength(1)
    expect(plan.placements[0].widthMm).toBe(432)
    expect(plan.placements[0].rotationDegrees).toBeGreaterThan(0)
    expect(plan.placements[0].rotationDegrees).toBeLessThan(90)

    const bytes = await createLabelsPdf(project)
    const pdf = await PDFDocument.load(bytes)
    const pageSize = pdf.getPage(0).getSize()

    expect(pageSize.width).toBeCloseTo(millimetersToPoints(431.8), 10)
    expect(pageSize.height).toBeCloseTo(millimetersToPoints(279.4), 10)
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

  it('packs two 432 mm strips diagonally on one A3 page using real polygons', () => {
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

  it('stagger-packs nine long strips per page before adding pages', () => {
    const project = createProject()
    project.page = { size: 'A3', orientation: 'landscape' }
    project.strips = Array.from({ length: 20 }, (_, index) =>
      createStrip(`Long strip ${index + 1}`, 432, 7.5, 12),
    )

    const plan = planPdfLayout(project, { stripGapMm: 2 })
    expect(plan.pageCount).toBe(3)
    expect(plan.stripGapMm).toBe(2)
    expect(plan.placements).toHaveLength(20)
    const firstPagePlacements = plan.placements.filter(
      (placement) => placement.pageIndex === 0,
    )
    expect(firstPagePlacements).toHaveLength(9)
    expect(
      new Set(
        firstPagePlacements.map((placement) =>
          placement.xMm.toFixed(6),
        ),
      ).size,
    ).toBeGreaterThan(1)
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
        ).toBeGreaterThanOrEqual(2 - 1e-8)
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

  it('edge-to-edge packing fits at least as many long strips and shares cuts', () => {
    const project = createProject()
    project.page = { size: 'A3', orientation: 'landscape' }
    project.strips = Array.from({ length: 20 }, (_, index) =>
      createStrip(`Long strip ${index + 1}`, 432, 7.5, 12),
    )

    const customGapPlan = planPdfLayout(project, { stripGapMm: 2 })
    const edgeToEdgePlan = planPdfLayout(project, { stripGapMm: 0 })
    const pageCount = (plan: typeof edgeToEdgePlan, pageIndex: number) =>
      plan.placements.filter(
        (placement) => placement.pageIndex === pageIndex,
      ).length

    expect(pageCount(customGapPlan, 0)).toBe(9)
    expect(pageCount(edgeToEdgePlan, 0)).toBeGreaterThanOrEqual(
      pageCount(customGapPlan, 0),
    )
    expect(pageCount(edgeToEdgePlan, 0)).toBe(12)
    expect(edgeToEdgePlan.pageCount).toBe(2)
    expect(
      new Set(edgeToEdgePlan.placements.map(({ stripId }) => stripId)).size,
    ).toBe(project.strips.length)

    const firstPagePolygons = edgeToEdgePlan.placements
      .filter((placement) => placement.pageIndex === 0)
      .map(getPlacementPolygonMm)
    expect(getTotalSharedEdgeLengthMm(firstPagePolygons)).toBeGreaterThan(0)
    for (const [index, polygon] of firstPagePolygons.entries()) {
      for (const other of firstPagePolygons.slice(index + 1)) {
        expect(polygonsOverlapMm(polygon, other)).toBe(false)
      }
    }
  })

  it('honors the configured physical strip gap', () => {
    const project = createProject()
    project.page = { size: 'A3', orientation: 'landscape' }
    project.strips = Array.from({ length: 4 }, (_, index) =>
      createStrip(`Long strip ${index + 1}`, 432, 7.5, 12),
    )

    const plan = planPdfLayout(project, { stripGapMm: 6 })
    expect(plan.stripGapMm).toBe(6)
    expect(plan.pageCount).toBe(1)
    for (const [index, placement] of plan.placements.entries()) {
      for (const other of plan.placements.slice(index + 1)) {
        expect(
          getMinimumPolygonDistanceMm(
            getPlacementPolygonMm(placement),
            getPlacementPolygonMm(other),
          ),
        ).toBeGreaterThanOrEqual(6 - 1e-8)
      }
    }

    expect(() => planPdfLayout(project, { stripGapMm: -1 })).toThrow(
      'Strip gap must be a non-negative number in mm.',
    )
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

  it('automatically places the support QR bottom-right without changing layout', async () => {
    const project = createProject()
    project.page = { size: 'A3', orientation: 'landscape' }
    project.strips = [
      createStrip('Long strip 1', 432, 7.5, 12),
      createStrip('Long strip 2', 432, 7.5, 12),
    ]
    const before = planPdfLayout(project)
    const geometry = getSafeSupportQrDecorationGeometryMm(
      before.pageWidthMm,
      before.pageHeightMm,
      before.placements,
    )
    expect(geometry).toBeDefined()
    if (!geometry) throw new Error('Expected A3 support decoration geometry.')

    expect(geometry.yMm).toBe(5)
    expect(geometry.xMm + geometry.widthMm).toBe(
      before.pageWidthMm - 5,
    )
    const decorationPolygon = getSupportQrDecorationPolygonMm(geometry)
    for (const placement of before.placements) {
      expect(
        getMinimumPolygonDistanceMm(
          decorationPolygon,
          getPlacementPolygonMm(placement),
        ),
      ).toBeGreaterThanOrEqual(SUPPORT_QR_CLEARANCE_MM - 1e-8)
    }

    const bytes = await createLabelsPdf(project)
    const after = planPdfLayout(project)
    expect(after).toEqual(before)
    const pdf = await PDFDocument.load(bytes)
    const content = getDecodedPageContent(pdf, 0)
    expect(content).toContain(asciiHex(SUPPORT_QR_LABEL_LINE_1))
    expect(content).toContain(asciiHex(SUPPORT_QR_LABEL_LINE_2))
    expect(content).toMatch(/\/Image-[^\s]+ Do/)
    expect(after.pageCount).toBe(1)
    expect(after.placements.every((placement) => placement.widthMm === 432)).toBe(
      true,
    )
    expect(after.placements.every((placement) => placement.heightMm === 7.5)).toBe(
      true,
    )
  })

  it('omits support decoration when bottom-right label geometry is occupied', () => {
    const geometry = getSupportQrDecorationGeometryMm(297, 210)
    expect(geometry).toBeDefined()
    if (!geometry) throw new Error('Expected A4 support decoration geometry.')
    const occupyingPlacement: PdfStripPlacement = {
      stripId: 'occupying-strip',
      pageIndex: 0,
      xMm: geometry.boundsXmm,
      yMm: geometry.boundsYmm,
      widthMm: geometry.boundsWidthMm,
      heightMm: geometry.boundsHeightMm,
      rotationDegrees: 0,
      boundingWidthMm: geometry.boundsWidthMm,
      boundingHeightMm: geometry.boundsHeightMm,
    }

    expect(
      getSafeSupportQrDecorationGeometryMm(297, 210, [
        occupyingPlacement,
      ]),
    ).toBeUndefined()
  })

  it('uses the automatic QR generator for Export and Print with no UI control', () => {
    const appSource = readFileSync(
      join(process.cwd(), 'src/App.tsx'),
      'utf8',
    )
    const userInterfaceSource = [
      'src/App.tsx',
      'src/components/Sidebar.tsx',
      'src/components/Workspace.tsx',
      'src/components/PageLayoutPreview.tsx',
    ]
      .map((path) => readFileSync(join(process.cwd(), path), 'utf8'))
      .join('\n')

    expect(appSource.match(/createLabelsPdf\(/g)).toHaveLength(2)
    expect(userInterfaceSource).not.toContain('Include support QR')
    expect(userInterfaceSource).not.toContain('includeSupportQr')
  })

  it('keeps support QR content out of calibration PDFs', async () => {

    const calibrationBytes = await createCalibrationPdf({
      size: 'A4',
      orientation: 'portrait',
    })
    const calibrationPdf = await PDFDocument.load(calibrationBytes)
    const calibrationContent = getDecodedPageContent(calibrationPdf, 0)
    expect(calibrationContent).not.toContain(
      asciiHex(SUPPORT_QR_LABEL_LINE_1),
    )
    expect(calibrationContent).not.toContain(
      asciiHex(SUPPORT_QR_LABEL_LINE_2),
    )
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
