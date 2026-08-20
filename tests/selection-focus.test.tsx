import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { StripCard } from '../src/components/StripCard'
import { StripSvgEditor } from '../src/components/StripSvgEditor'
import { createStrip } from '../src/model/defaults'

const noOp = () => undefined

describe('cell range discoverability and focus indication', () => {
  it('keeps selected cells keyboard-focusable before edit mode', () => {
    const strip = createStrip('Focus', 216, 7.5, 4)
    const row = strip.rows[0]
    const selectedId = row.cells[1].id
    const markup = renderToStaticMarkup(
      <StripSvgEditor
        strip={strip}
        activeRowId={row.id}
        selectedCellIds={[selectedId]}
        selectedHeaderId={undefined}
        editingCellId={undefined}
        previewScale={1}
        onSelectCell={noOp}
        onSelectGroupHeader={noOp}
        onClearSelection={noOp}
        onChangeCellText={noOp}
        onMoveCell={noOp}
      />,
    )

    expect(markup).toContain('aria-selected="true"')
    expect(markup).toContain('tabindex="0"')
    expect(markup).toContain('class="cell-selection"')
    expect(markup).not.toContain('svg-cell-input')
  })

  it('keeps the textarea-based edit mode unchanged', () => {
    const strip = createStrip('Editing', 216, 7.5, 4)
    const row = strip.rows[0]
    const selectedId = row.cells[1].id
    const markup = renderToStaticMarkup(
      <StripSvgEditor
        strip={strip}
        activeRowId={row.id}
        selectedCellIds={[selectedId]}
        selectedHeaderId={undefined}
        editingCellId={selectedId}
        previewScale={1}
        onSelectCell={noOp}
        onSelectGroupHeader={noOp}
        onClearSelection={noOp}
        onChangeCellText={noOp}
        onMoveCell={noOp}
      />,
    )

    expect(markup).toContain('svg-cell selected editing')
    expect(markup).toContain('svg-cell-input')
    expect(markup).toContain('Edit cell 2, two lines maximum')
  })

  it('uses a compact SVG-bounds focus indicator instead of the browser outline', () => {
    const styles = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8')

    expect(styles).toMatch(
      /\.svg-cell:focus,\s*\.svg-group-header:focus\s*{\s*outline:\s*none;/,
    )
    expect(styles).toMatch(
      /\.svg-cell:focus-visible \.cell-hit-area,[\s\S]*?stroke-width:\s*0\.3px;/,
    )
    expect(styles).toMatch(
      /\.svg-cell:focus-visible \.cell-hit-area,[\s\S]*?vector-effect:\s*non-scaling-stroke;/,
    )
    expect(styles).toMatch(/\.svg-cell-input\s*{[\s\S]*?outline:\s*0;/)
  })

  it('shows a clear single-cell range hint and a multi-cell action scope message', () => {
    const strip = createStrip('Hints', 216, 7.5, 4)
    const row = strip.rows[0]
    const renderCard = (selectedCellCount: number, selectionLabel: string) =>
      renderToStaticMarkup(
        <StripCard
          strip={strip}
          index={0}
          isActive
          activeRowId={row.id}
          isSelectedForJoin={false}
          selectedCellIds={row.cells
            .slice(0, selectedCellCount)
            .map((cell) => cell.id)}
          selectedHeaderId={undefined}
          selectedCellCount={selectedCellCount}
          editingCellId={undefined}
          selectionLabel={selectionLabel}
          previewScale={1}
          canMoveUp={false}
          canMoveDown={false}
          onActivate={noOp}
          onActivateRow={noOp}
          onSetRowCount={noOp}
          onUpdateRow={noOp}
          onRename={noOp}
          onSelectCell={noOp}
          onSelectGroupHeader={noOp}
          onClearSelection={noOp}
          onChangeCellText={noOp}
          onMoveCell={noOp}
          onToggleJoinSelection={noOp}
          onAddRow={noOp}
          onSplitRows={noOp}
          onDuplicate={noOp}
          onDelete={noOp}
          onMoveStrip={noOp}
        />,
      )

    expect(renderCard(1, 'Cell 1')).toContain(
      'Shift-click another cell in this row to select a range',
    )
    expect(renderCard(3, 'Cells 1–3')).toContain(
      'Actions and formatting apply to this range',
    )
  })
})
