import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Sidebar } from '../src/components/Sidebar'
import { addGroupHeader } from '../src/lib/group-headers'
import { createStrip } from '../src/model/defaults'

const noOp = () => undefined

function baseProps() {
  const strip = createStrip('Inspector', 216, 7.5, 4)
  const row = strip.rows[0]
  return { strip, row }
}

describe('selection-based inspector', () => {
  it('puts cell copy before typography and appearance', () => {
    const { row } = baseProps()
    const markup = renderToStaticMarkup(
      <Sidebar
        selectionKind="cell"
        activeRow={row}
        selectedCell={row.cells[0]}
        selectedCellCount={1}
        selectedRangeLabel="Cell 1"
        selectedRange={{ startIndex: 0, endIndex: 0 }}
        selectedGroupHeader={undefined}
        onUpdateRow={noOp}
        onUpdateCell={noOp}
        onAddGroupHeader={noOp}
        onUpdateSelectedGroupHeader={noOp}
        onRemoveSelectedGroupHeader={noOp}
        onApplyCellAppearance={noOp}
        onShiftCellLightness={noOp}
        onResetSelectedCellStyle={noOp}
        onApplyAutoNumberingToSelection={noOp}
        onApplyAutoNumberingToAll={noOp}
        onClearSelectedCells={noOp}
      />,
    )

    expect(markup).toContain('Text input')
    expect(markup).not.toContain('<h2>Cell</h2>')
    expect(markup.indexOf('Line 1')).toBeLessThan(markup.indexOf('Typography'))
    expect(markup.indexOf('numbering-controls')).toBeLessThan(
      markup.indexOf('Typography'),
    )
    expect(markup).toContain('Appearance')
    expect(markup).toContain('+ Add header')
    expect(markup).not.toContain(
      'Enter ordinary text, or use {n} for a sequence.',
    )
    expect(markup).toContain('>Clear<')
    expect(markup).not.toContain('Options')
    expect(markup).toContain('>Reset<')
    expect(markup).not.toContain('Reset complete style')
  })

  it('reports mixed range appearance without inventing a stored value', () => {
    const { row } = baseProps()
    row.cells[1].appearance.backgroundColor = '#3973b9'
    const markup = renderToStaticMarkup(
      <Sidebar
        selectionKind="range"
        activeRow={row}
        selectedCell={undefined}
        selectedCellCount={2}
        selectedRangeLabel="Cells 1–2"
        selectedRange={{ startIndex: 0, endIndex: 1 }}
        selectedGroupHeader={undefined}
        onUpdateRow={noOp}
        onUpdateCell={noOp}
        onAddGroupHeader={noOp}
        onUpdateSelectedGroupHeader={noOp}
        onRemoveSelectedGroupHeader={noOp}
        onApplyCellAppearance={noOp}
        onShiftCellLightness={noOp}
        onResetSelectedCellStyle={noOp}
        onApplyAutoNumberingToSelection={noOp}
        onApplyAutoNumberingToAll={noOp}
        onClearSelectedCells={noOp}
      />,
    )

    expect(markup).toContain('MIXED')
    expect(markup).toContain('+ Add header')
    expect(markup.indexOf('Text input')).toBeLessThan(markup.indexOf('Appearance'))
    expect(markup).toContain('>Clear<')
    expect(markup).not.toContain('Options')
  })

  it('shows header controls without a border color field', () => {
    const { row } = baseProps()
    const withHeader = addGroupHeader(row, { startIndex: 0, endIndex: 1 }, 'Inputs')
    const header = withHeader.groupHeaders[0]
    const markup = renderToStaticMarkup(
      <Sidebar
        selectionKind="header"
        activeRow={withHeader}
        selectedCell={undefined}
        selectedCellCount={0}
        selectedRangeLabel={undefined}
        selectedRange={undefined}
        selectedGroupHeader={header}
        onUpdateRow={noOp}
        onUpdateCell={noOp}
        onAddGroupHeader={noOp}
        onUpdateSelectedGroupHeader={noOp}
        onRemoveSelectedGroupHeader={noOp}
        onApplyCellAppearance={noOp}
        onShiftCellLightness={noOp}
        onResetSelectedCellStyle={noOp}
        onApplyAutoNumberingToSelection={noOp}
        onApplyAutoNumberingToAll={noOp}
        onClearSelectedCells={noOp}
      />,
    )

    expect(markup).toContain('Group header')
    expect(markup).toContain('Header text')
    expect(markup).toContain('Delete header')
    expect(markup).not.toContain('+ Add header')
    expect(markup).not.toContain('Border')
  })
})
