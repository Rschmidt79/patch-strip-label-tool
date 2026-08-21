import {
  decodePDFRawStream,
  PDFArray,
  PDFDocument,
  PDFRawStream,
} from 'pdf-lib'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PageLayoutPreview } from '../src/components/PageLayoutPreview'
import {
  createCalibrationPdf,
  createLabelsPdf,
} from '../src/lib/pdf-export'
import { getPlacementPolygonMm } from '../src/lib/pdf-layout'
import { planPrintLayout } from '../src/lib/print-layout'
import {
  DEFAULT_PRINT_PREFERENCES,
  type PrintPreferences,
} from '../src/lib/print-preferences'
import { SPLIT_GLUE_TAB_WIDTH_MM } from '../src/lib/print-segments'
import { serializeProject } from '../src/lib/project-file'
import {
  getSupportQrDecorationPolygonMm,
  getSupportQrReservedAreaPolygonMm,
  SUPPORT_QR_BOX_SIZE_MM,
  SUPPORT_QR_LABEL_LINE_1,
  SUPPORT_QR_LABEL_LINE_2,
} from '../src/lib/support-qr'
import { polygonsOverlapMm } from '../src/lib/geometry'
import { createProject, createStrip } from '../src/model/defaults'

function preferences(
  change: Partial<PrintPreferences>,
): PrintPreferences {
  return { ...DEFAULT_PRINT_PREFERENCES, ...change }
}

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

describe('split print and reserved support area', () => {
  it.each([
    ['A4', 'portrait'],
    ['A4', 'landscape'],
    ['Letter', 'portrait'],
    ['Letter', 'landscape'],
    ['Legal', 'portrait'],
    ['Legal', 'landscape'],
  ] as const)(
    'splits one 432 mm strip deterministically on %s %s',
    (paperSize, orientation) => {
      const project = createProject()
      project.strips = [createStrip('Full rack', 432, 7.5, 12)]
      const printPreferences = preferences({ paperSize, orientation })

      const first = planPrintLayout(project, printPreferences)
      const second = planPrintLayout(project, printPreferences)

      expect(second).toEqual(first)
      expect(first.pageCount).toBe(1)
      expect(first.printSegments).toHaveLength(2)
      expect(first.printSegments.map((segment) => segment.sourceStartMm)).toEqual([
        0,
        216,
      ])
      expect(first.printSegments.map((segment) => segment.sourceEndMm)).toEqual([
        216,
        432,
      ])
      expect(first.printSegments[0].glueTabWidthMm).toBe(
        SPLIT_GLUE_TAB_WIDTH_MM,
      )
      expect(first.printSegments[1].glueTabWidthMm).toBe(0)
      expect(
        new Set(first.placements.map((placement) => placement.pageIndex)).size,
      ).toBe(1)
      expect(
        new Set(
          first.placements.map((placement) => placement.rotationDegrees),
        ).size,
      ).toBe(1)
    },
  )

  it('keeps the assembled physical width exact and overlap print-only', () => {
    const project = createProject()
    project.strips = [createStrip('Full rack', 432, 7.5, 12)]
    const before = serializeProject(project)
    const plan = planPrintLayout(
      project,
      preferences({ paperSize: 'Legal', orientation: 'landscape' }),
    )

    expect(
      plan.printSegments.reduce(
        (widthMm, segment) => widthMm + segment.contentWidthMm,
        0,
      ),
    ).toBe(432)
    expect(
      plan.printSegments.reduce(
        (widthMm, segment) => widthMm + segment.printedWidthMm,
        0,
      ),
    ).toBe(432 + SPLIT_GLUE_TAB_WIDTH_MM)
    expect(serializeProject(project)).toBe(before)
    expect(JSON.parse(before).schemaVersion).toBe(5)
    expect(before).not.toContain('printSegments')
    expect(before).not.toContain('glueTab')
  })

  it('splits a multi-row strip once across the complete physical block', () => {
    const project = createProject()
    project.strips = [createStrip('Three rows', 432, 7.5, 12, 3)]
    const plan = planPrintLayout(
      project,
      preferences({ paperSize: 'Legal', orientation: 'portrait' }),
    )

    expect(plan.printSegments.map(({ sourceStartMm, sourceEndMm }) => ({
      sourceStartMm,
      sourceEndMm,
    }))).toEqual([
      { sourceStartMm: 0, sourceEndMm: 216 },
      { sourceStartMm: 216, sourceEndMm: 432 },
    ])
    expect(plan.placements.every((placement) => placement.heightMm === 22.5)).toBe(
      true,
    )
    expect(plan.pageCount).toBe(1)
    expect(
      new Set(plan.placements.map((placement) => placement.pageIndex)).size,
    ).toBe(1)
    expect(project.strips[0].rows).toHaveLength(3)
    expect(
      project.strips[0].rows.every((row) => row.dimensions.widthMm === 432),
    ).toBe(true)
  })

  it('does not split short strips or strips which fit larger paper', () => {
    const shortProject = createProject()
    shortProject.strips = [createStrip('Half rack', 216, 7.5, 8)]
    const shortPlan = planPrintLayout(
      shortProject,
      preferences({ paperSize: 'A4', orientation: 'landscape' }),
    )
    expect(shortPlan.printSegments).toHaveLength(1)
    expect(shortPlan.printSegments[0]).toMatchObject({
      segmentCount: 1,
      printedWidthMm: 216,
    })

    for (const paperSize of ['A3', 'SRA3', 'Tabloid'] as const) {
      const project = createProject()
      project.strips = [createStrip('Full rack', 432, 7.5, 12)]
      const plan = planPrintLayout(
        project,
        preferences({ paperSize, orientation: 'landscape' }),
      )
      expect(plan.printSegments).toHaveLength(1)
      expect(plan.placements[0].widthMm).toBe(432)
    }

  })

  it('packs sibling segments together when they fit on the same page', () => {
    const project = createProject()
    project.strips = [
      createStrip('Rack A', 432, 7.5, 12),
      createStrip('Rack B', 432, 7.5, 12),
    ]
    const plan = planPrintLayout(
      project,
      preferences({ paperSize: 'A4', orientation: 'portrait' }),
    )

    expect(plan.printSegments).toHaveLength(4)
    for (const strip of project.strips) {
      const segmentIds = plan.printSegments
        .filter((segment) => segment.stripId === strip.id)
        .map((segment) => segment.id)
      const pageIndices = plan.placements
        .filter((placement) => segmentIds.includes(placement.stripId))
        .map((placement) => placement.pageIndex)
      expect(new Set(pageIndices).size).toBe(1)
    }
  })

  it.each([
    { spacingMode: 'edge-to-edge', customGapMm: 2, cutLines: true, cropMarks: true },
    { spacingMode: 'custom', customGapMm: 3, cutLines: false, cropMarks: true },
    { spacingMode: 'custom', customGapMm: 2, cutLines: true, cropMarks: false },
  ] as const)(
    'preserves spacing and guide preferences for split items: %o',
    (change) => {
      const project = createProject()
      project.strips = [createStrip('Full rack', 432, 7.5, 12)]
      const plan = planPrintLayout(
        project,
        preferences({
          paperSize: 'A4',
          orientation: 'landscape',
          ...change,
        }),
      )

      expect(plan.stripGapMm).toBe(
        change.spacingMode === 'edge-to-edge' ? 0 : change.customGapMm,
      )
      expect(plan.pageGuides.every((guides) =>
        change.cutLines ? guides.cutLines.length > 0 : guides.cutLines.length === 0,
      )).toBe(true)
      expect(plan.pageGuides.every((guides) =>
        change.cropMarks
          ? guides.cropMarks.length > 0
          : guides.cropMarks.length === 0,
      )).toBe(true)
    },
  )

  it.each(['A4', 'Letter', 'Legal'] as const)(
    'uses one shared segment plan in preview and PDF output on %s',
    async (paperSize) => {
      const project = createProject()
      project.strips = [createStrip('Full rack', 432, 7.5, 12)]
      const printPreferences = preferences({
        paperSize,
        orientation: 'landscape',
      })
      const plan = planPrintLayout(project, printPreferences)
      const markup = renderToStaticMarkup(
        <PageLayoutPreview
          project={project}
          preferences={printPreferences}
          plan={plan}
          error={undefined}
          onPreferencesChange={() => undefined}
        />,
      )
      const pdf = await PDFDocument.load(
        await createLabelsPdf(project, printPreferences, plan),
      )
      const pdfContent = Array.from(
        { length: pdf.getPageCount() },
        (_, index) => getDecodedPageContent(pdf, index),
      ).join('\n')

      expect(markup.match(/class="print-segment-artwork"/g)).toHaveLength(2)
      expect(markup).toContain('data-segment="1/2"')
      expect(markup).toContain('data-segment="2/2"')
      expect(markup).toContain('viewBox="0 0 216 7.5"')
      expect(markup).toContain('viewBox="216 0 216 7.5"')
      expect(markup).not.toContain('aria-label="Split print assembly"')
      expect(markup).not.toContain('page-preview-assembly')
      expect(markup).toContain('1&gt;2')
      expect(pdf.getPageCount()).toBe(plan.pageCount)
      expect(pdfContent).toContain(asciiHex('GLUE'))
      expect(pdfContent).toContain(asciiHex('1>2'))
    },
  )

  it('reserves support geometry before packing and keeps all labels outside it', () => {
    const project = createProject()
    project.strips = Array.from({ length: 16 }, (_, index) =>
      createStrip(`Strip ${index + 1}`, 216, 7.5, 8),
    )
    const plan = planPrintLayout(
      project,
      preferences({ paperSize: 'A4', orientation: 'landscape' }),
    )
    const reservedPolygon = getSupportQrReservedAreaPolygonMm(plan.supportArea)

    expect(plan.reservedAreasMm).toEqual([plan.supportArea.reservedAreaMm])
    for (const placement of plan.placements) {
      expect(
        polygonsOverlapMm(
          getPlacementPolygonMm(placement),
          reservedPolygon,
        ),
      ).toBe(false)
    }
  })

  it('keeps the larger QR and exact support text inside the reserved area', async () => {
    const project = createProject()
    const plan = planPrintLayout(project, DEFAULT_PRINT_PREFERENCES)
    const geometry = plan.supportArea
    const reserved = geometry.reservedAreaMm
    const decorationPolygon = getSupportQrDecorationPolygonMm(geometry)

    expect(geometry.widthMm).toBe(SUPPORT_QR_BOX_SIZE_MM)
    expect(geometry.imageSizeMm).toBe(18)
    expect(geometry.boundsXmm).toBeGreaterThanOrEqual(reserved.xMm)
    expect(geometry.boundsYmm).toBeGreaterThanOrEqual(reserved.yMm)
    expect(geometry.boundsXmm + geometry.boundsWidthMm).toBeLessThanOrEqual(
      reserved.xMm + reserved.widthMm,
    )
    expect(geometry.boundsYmm + geometry.boundsHeightMm).toBeLessThanOrEqual(
      reserved.yMm + reserved.heightMm,
    )
    expect(decorationPolygon).toHaveLength(4)

    const pdf = await PDFDocument.load(
      await createLabelsPdf(project, DEFAULT_PRINT_PREFERENCES, plan),
    )
    const content = getDecodedPageContent(pdf, 0)
    expect(content).toContain(asciiHex(SUPPORT_QR_LABEL_LINE_1))
    expect(content).toContain(asciiHex(SUPPORT_QR_LABEL_LINE_2))
  })

  it('keeps calibration PDF free of support content and images', async () => {
    const pdf = await PDFDocument.load(
      await createCalibrationPdf({ size: 'A4', orientation: 'portrait' }),
    )
    const content = getDecodedPageContent(pdf, 0)

    expect(content).not.toContain(asciiHex(SUPPORT_QR_LABEL_LINE_1))
    expect(content).not.toContain(asciiHex(SUPPORT_QR_LABEL_LINE_2))
    expect(content).not.toMatch(/\/Image-[^\s]+ Do/)
  })
})
