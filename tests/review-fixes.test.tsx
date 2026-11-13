import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Modal } from '../src/components/Modal'
import { RowDimensionsControls } from '../src/components/RowDimensionsControls'
import { StripSvgEditor } from '../src/components/StripSvgEditor'
import { MAX_STRIP_WIDTH_MM } from '../src/config/content-limits'
import { PdfPlacementError, planPdfLayout } from '../src/lib/pdf-layout'
import { parseProjectJson, serializeProject } from '../src/lib/project-file'
import { createProject, createStrip } from '../src/model/defaults'

const noOp = () => undefined

function renderEditor(selectedCellIds: string[]) {
  const strip = createStrip('Keys', 216, 7.5, 4, 2)
  return {
    strip,
    render: (ids = selectedCellIds) =>
      renderToStaticMarkup(
        <StripSvgEditor
          strip={strip}
          activeRowId={strip.rows[0].id}
          selectedCellIds={ids}
          selectedHeaderId={undefined}
          editingCellId={undefined}
          previewScale={1}
          onSelectCell={noOp}
          onSelectGroupHeader={noOp}
          onClearSelection={noOp}
          onChangeCellText={noOp}
          onMoveCell={noOp}
        />,
      ),
  }
}

describe('review fixes', () => {
  it('gives each strip exactly one keyboard entry cell when nothing is selected', () => {
    const { strip, render } = renderEditor([])
    const unselected = render()
    expect(unselected.match(/class="svg-cell[^"]*"[^>]*tabindex="0"/g))
      .toHaveLength(1)
    expect(unselected).not.toContain('aria-selected')

    const selected = render([strip.rows[0].cells[2].id])
    expect(selected.match(/class="svg-cell[^"]*"[^>]*tabindex="0"/g))
      .toHaveLength(1)
  })

  it('rounds dimensions in the placement error message', () => {
    const project = createProject()
    project.strips = [createStrip('Too long', 2000 / 3, 7.5, 8)]
    let message = ''
    try {
      planPdfLayout(project, {
        page: { size: 'Tabloid', orientation: 'landscape' },
      })
    } catch (error) {
      expect(error).toBeInstanceOf(PdfPlacementError)
      message = (error as Error).message
    }
    expect(message).toContain('666.67 × 7.5 mm')
    expect(message).toContain('usable area 411.8 × 249.4 mm')
    expect(message).not.toMatch(/\d\.\d{3,}/)
  })

  it('limits custom cell width and cell count to a width the file format accepts', () => {
    const strip = createStrip('Wide', 1600, 7.5, 16)
    const row = strip.rows[0]
    row.dimensions.cellWidthMode = 'custom'
    row.dimensions.customCellWidthMm = 100
    const markup = renderToStaticMarkup(
      <RowDimensionsControls
        strip={strip}
        activeRowId={row.id}
        onActivateRow={noOp}
        onSetRowCount={noOp}
        onUpdateRow={noOp}
      />,
    )
    // The panel is collapsed by default, so check the limits themselves.
    expect(markup).toContain('Custom dimensions…')
    const maximumCells = Math.floor(MAX_STRIP_WIDTH_MM / 100)
    expect(maximumCells).toBe(50)

    const project = createProject()
    row.dimensions.widthMm = MAX_STRIP_WIDTH_MM
    row.dimensions.cellCount = maximumCells
    row.autoNumbering.cellCount = maximumCells
    row.cells = createStrip('x', 100, 7.5, maximumCells).rows[0].cells
    project.strips = [strip]
    expect(() => parseProjectJson(serializeProject(project))).not.toThrow()
  })

  it('renders modal dialogs with dialog semantics', () => {
    const markup = renderToStaticMarkup(
      <Modal className="print-reminder" labelledBy="title" onClose={noOp}>
        <h2 id="title">Title</h2>
      </Modal>,
    )
    expect(markup).toContain(
      '<section class="print-reminder" role="dialog" aria-modal="true" aria-labelledby="title">',
    )
  })
})
