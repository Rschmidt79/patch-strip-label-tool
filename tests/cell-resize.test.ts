import { describe, expect, it } from 'vitest'
import { addGroupHeader } from '../src/lib/group-headers'
import {
  getCellResizeConfirmationMessage,
  getCellResizeLoss,
  resizeStripCells,
  updateStripRow,
} from '../src/lib/strip'
import { createStrip, createStripRow } from '../src/model/defaults'

describe('reducing the cell count', () => {
  it('reports the text and group headers a smaller count would discard', () => {
    let row = createStripRow('Row', 432, 7.5, 16)
    row.cells[1].line1 = 'CAM B'
    row.cells[9].line2 = '10'
    row.cells[15].line1 = 'CAM P'
    row = addGroupHeader(row, { startIndex: 0, endIndex: 3 }, 'Cams')
    row = addGroupHeader(row, { startIndex: 6, endIndex: 9 }, 'Mics')

    expect(getCellResizeLoss(row, 24)).toEqual({
      cellsWithText: 0,
      affectedGroupHeaders: 0,
    })
    expect(getCellResizeLoss(row, 8)).toEqual({
      cellsWithText: 2,
      affectedGroupHeaders: 1,
    })
    // The first keystroke of "24" used to truncate the row to two cells.
    expect(getCellResizeLoss(row, 2)).toEqual({
      cellsWithText: 2,
      affectedGroupHeaders: 2,
    })
  })

  it('asks only when something would be lost', () => {
    const row = createStripRow('Row', 432, 7.5, 16)
    expect(
      getCellResizeConfirmationMessage(8, getCellResizeLoss(row, 8)),
    ).toBeUndefined()

    row.cells[12].line1 = 'Keep me'
    expect(
      getCellResizeConfirmationMessage(8, getCellResizeLoss(row, 8)),
    ).toBe('Reduce this row to 8 cells? 1 cell with text will be removed.')
    expect(resizeStripCells(row, 24).cells[12].line1).toBe('Keep me')
  })

  it('returns the same strip when a row update changes nothing', () => {
    const strip = createStrip('Strip', 432, 7.5, 16, 2)
    expect(updateStripRow(strip, strip.rows[0].id, (row) => row)).toBe(strip)
  })
})
