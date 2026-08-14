import {
  decodePDFRawStream,
  PDFArray,
  PDFDocument,
  PDFRawStream,
} from 'pdf-lib'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CellIndexRow } from '../src/components/CellIndexRow'
import { StripArtwork } from '../src/components/StripArtwork'
import { getEditorCellIndices } from '../src/lib/editor-cell-indices'
import { createLabelsPdf } from '../src/lib/pdf-export'
import { serializeProject } from '../src/lib/project-file'
import { createProject, createStrip, createStripRow } from '../src/model/defaults'

function getDecodedPageContent(pdf: PDFDocument): string {
  const contents = pdf.getPage(0).node.Contents()
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

describe('editor cell indices', () => {
  it.each([4, 7, 20, 24])(
    'creates UI indices 1 through %i',
    (cellCount) => {
      const indices = getEditorCellIndices(cellCount)
      expect(indices).toHaveLength(cellCount)
      expect(indices[0]).toBe(1)
      expect(indices.at(-1)).toBe(cellCount)
    },
  )

  it('renders exactly one aligned index per editor cell', () => {
    const strip = createStripRow('Indexed', 432, 7.5, 24)
    const markup = renderToStaticMarkup(
      <CellIndexRow
        cells={strip.cells}
        selectedCellIds={strip.cells.slice(12, 16).map((cell) => cell.id)}
        widthPx={1632}
      />,
    )

    expect(markup.match(/data-cell-index=/g)).toHaveLength(24)
    expect(markup).toContain('data-cell-index="1"')
    expect(markup).toContain('data-cell-index="24"')
    expect(markup.match(/class="selected"/g)).toHaveLength(4)
    expect(markup).toContain('grid-template-columns:repeat(24, minmax(0, 1fr))')
  })

  it('keeps cell indices out of shared artwork and project JSON', () => {
    const project = createProject()
    const artwork = renderToStaticMarkup(
      <svg>
        <StripArtwork strip={project.strips[0]} />
      </svg>,
    )
    const json = serializeProject(project)

    expect(artwork).not.toContain('cell-index-row')
    expect(artwork).not.toContain('data-editor-only')
    expect(json).not.toContain('cell-index-row')
    expect(json).not.toContain('data-cell-index')
    expect(json).not.toContain('editorCellIndices')
  })

  it('does not draw editor index labels into a blank-cell PDF', async () => {
    const project = createProject()
    const strip = createStrip('Blank indexed strip', 432, 7.5, 4)
    strip.rows[0].cells = strip.rows[0].cells.map((cell) => ({
      ...cell,
      line1: '',
      line2: '',
    }))
    project.strips = [strip]

    const bytes = await createLabelsPdf(project)
    const pdf = await PDFDocument.load(bytes)
    const content = getDecodedPageContent(pdf)

    for (const index of getEditorCellIndices(4)) {
      const hex = index.toString().charCodeAt(0).toString(16).toUpperCase()
      expect(content).not.toContain(`<${hex}> Tj`)
    }
  })
})
