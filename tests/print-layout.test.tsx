import {
  decodePDFRawStream,
  PDFArray,
  PDFDocument,
  PDFRawStream,
} from 'pdf-lib'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PageLayoutPreview } from '../src/components/PageLayoutPreview'
import { millimetersToPoints } from '../src/lib/dimensions'
import { createLabelsPdf } from '../src/lib/pdf-export'
import { planPrintLayout } from '../src/lib/print-layout'
import { DEFAULT_PRINT_PREFERENCES } from '../src/lib/print-preferences'
import { createProject, createStrip } from '../src/model/defaults'

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

describe('shared print layout plan', () => {
  it('drives preview and PDF cut guides from the same geometry', async () => {
    const project = createProject()
    project.strips = [
      createStrip('Long 1', 432, 7.5, 12),
      createStrip('Long 2', 432, 7.5, 12),
    ]
    const preferences = { ...DEFAULT_PRINT_PREFERENCES }
    const plan = planPrintLayout(project, preferences)
    const firstCutLine = plan.pageGuides[0].cutLines[0]
    const markup = renderToStaticMarkup(
      <PageLayoutPreview
        project={project}
        preferences={preferences}
        plan={plan}
        error={undefined}
        onPreferencesChange={() => undefined}
      />,
    )

    expect(markup).toContain('page-preview-cut-line')
    expect(markup).toContain(`x1="${firstCutLine.start.xMm}"`)
    expect(markup).toContain(
      `y1="${plan.pageHeightMm - firstCutLine.start.yMm}"`,
    )
    expect(markup).toContain('page-preview-crop-mark')

    const bytes = await createLabelsPdf(project, preferences, plan)
    const pdf = await PDFDocument.load(bytes)
    const content = getDecodedPageContent(pdf, 0)
    expect(content).toContain(
      `${millimetersToPoints(firstCutLine.start.xMm)} ${millimetersToPoints(firstCutLine.start.yMm)} m`,
    )
    expect(content).toContain(
      `${millimetersToPoints(firstCutLine.end.xMm)} ${millimetersToPoints(firstCutLine.end.yMm)} l`,
    )
  })

  it('can disable guide types without changing strip placement', () => {
    const project = createProject()
    project.strips = [createStrip('Long', 432, 7.5, 12)]
    const withGuides = planPrintLayout(project, DEFAULT_PRINT_PREFERENCES)
    const withoutGuides = planPrintLayout(project, {
      ...DEFAULT_PRINT_PREFERENCES,
      cutLines: false,
      cropMarks: false,
    })

    expect(withoutGuides.placements).toEqual(withGuides.placements)
    expect(withoutGuides.pageGuides[0]).toMatchObject({
      cutLines: [],
      cropMarks: [],
    })
  })

  it('keeps every strip exactly once across automatic extra pages', () => {
    const project = createProject()
    project.strips = Array.from({ length: 22 }, (_, index) =>
      createStrip(`Long ${index + 1}`, 432, 7.5, 12),
    )
    const plan = planPrintLayout(project, DEFAULT_PRINT_PREFERENCES)
    const placedIds = plan.placements.map((placement) => placement.stripId)

    expect(plan.pageCount).toBeGreaterThan(1)
    expect(placedIds).toHaveLength(project.strips.length)
    expect(new Set(placedIds).size).toBe(project.strips.length)
    expect(new Set(placedIds)).toEqual(
      new Set(project.strips.map((strip) => strip.id)),
    )
  })

  it('places one unscaled strip per page when auto arrange is off', () => {
    const project = createProject()
    project.strips = Array.from({ length: 3 }, (_, index) =>
      createStrip(`Long ${index + 1}`, 432, 7.5, 12),
    )
    const plan = planPrintLayout(project, {
      ...DEFAULT_PRINT_PREFERENCES,
      autoArrange: false,
    })

    expect(plan.pageCount).toBe(3)
    expect(plan.placements.map((placement) => placement.pageIndex)).toEqual([
      0, 1, 2,
    ])
    expect(plan.placements.every((placement) => placement.widthMm === 432)).toBe(
      true,
    )
  })
})
