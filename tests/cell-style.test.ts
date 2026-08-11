import { describe, expect, it } from 'vitest'
import { applyAutoNumberingToRange } from '../src/lib/auto-numbering'
import {
  applyCellAppearanceToRange,
  resetCellRangeStyle,
} from '../src/lib/cell-style'
import { createStrip } from '../src/model/defaults'
import { resizeStripCells } from '../src/lib/strip'

describe('range cell styling', () => {
  it('changes only the selected range', () => {
    const strip = createStrip('Highlights', 432, 7.5, 12)
    const styled = applyCellAppearanceToRange(
      strip,
      { startIndex: 4, endIndex: 7 },
      { backgroundColor: '#3973b9', textColor: '#ffffff' },
    )

    expect(styled.cells.slice(4, 8).every(
      (cell) => cell.appearance.backgroundColor === '#3973b9',
    )).toBe(true)
    expect(styled.cells.slice(0, 4)).toEqual(strip.cells.slice(0, 4))
    expect(styled.cells.slice(8)).toEqual(strip.cells.slice(8))
  })

  it('survives range auto numbering exactly', () => {
    const strip = applyCellAppearanceToRange(
      createStrip('Styled numbering', 432, 7.5, 12),
      { startIndex: 0, endIndex: 5 },
      { backgroundColor: '#f4d35e', borderColor: '#9a7920' },
    )
    const appearances = strip.cells.map((cell) => ({ ...cell.appearance }))
    const numbered = applyAutoNumberingToRange(strip, {
      startIndex: 0,
      endIndex: 5,
    })

    expect(numbered.cells.map((cell) => cell.appearance)).toEqual(appearances)
  })

  it('resets text and appearance defaults only inside the selected range', () => {
    const strip = createStrip('Reset', 432, 7.5, 12)
    strip.cells[2].style = { ...strip.cells[2].style, alignment: 'right' }
    strip.cells[2].appearance = {
      backgroundColor: '#c74d49',
      textColor: '#ffffff',
      borderColor: '#722825',
    }
    strip.cells[3].appearance = { ...strip.cells[2].appearance }
    const outside = { ...strip.cells[3].appearance }
    const reset = resetCellRangeStyle(strip, { startIndex: 2, endIndex: 2 })

    expect(reset.cells[2].style).toEqual(strip.defaultTextStyle)
    expect(reset.cells[2].appearance).toEqual(strip.defaultCellAppearance)
    expect(reset.cells[3].appearance).toEqual(outside)
  })

  it('preserves styling when a styled cell survives a cell-count change', () => {
    const strip = applyCellAppearanceToRange(
      createStrip('Resize', 432, 7.5, 12),
      { startIndex: 4, endIndex: 7 },
      { backgroundColor: '#3b8f5a', textColor: '#ffffff' },
    )
    const cellIds = strip.cells.slice(0, 8).map((cell) => cell.id)
    const resized = resizeStripCells(strip, 20)

    expect(resized.cells.slice(0, 8).map((cell) => cell.id)).toEqual(cellIds)
    expect(resized.cells[4].appearance.backgroundColor).toBe('#3b8f5a')
    expect(resized.cells[7].appearance.textColor).toBe('#ffffff')
    expect(resized.dimensions.widthMm).toBe(432)
    expect(resized.dimensions.customCellWidthMm).toBe(21.6)
  })
})
