import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RowDimensionsControls } from '../src/components/RowDimensionsControls'
import { resizeStripRows } from '../src/lib/strip'
import { createStrip } from '../src/model/defaults'

const noOp = () => undefined

describe('strip row setup controls', () => {
  it('separates strip row count from active row selection', () => {
    const strip = createStrip('Rows', 432, 7.5, 16, 3)
    const markup = renderToStaticMarkup(
      <RowDimensionsControls
        strip={strip}
        activeRowId={strip.rows[1].id}
        onActivateRow={noOp}
        onSetRowCount={noOp}
        onUpdateRow={noOp}
      />,
    )

    expect(markup).toContain('Rows in strip')
    expect(markup).toContain('Edit row')
    expect(markup).toContain('3 rows')
    expect(markup).toContain('Row 1')
    expect(markup).toContain('Row 2')
    expect(markup).toContain('Row 3')
  })

  it('preserves a custom row count above the quick one-to-three choices', () => {
    const strip = resizeStripRows(
      createStrip('Custom rows', 432, 7.5, 16, 3),
      4,
    )
    const markup = renderToStaticMarkup(
      <RowDimensionsControls
        strip={strip}
        activeRowId={strip.rows[3].id}
        onActivateRow={noOp}
        onSetRowCount={noOp}
        onUpdateRow={noOp}
      />,
    )

    expect(markup).toContain('4 rows · custom')
    expect(markup).toContain('value="custom" selected=""')
  })
})
