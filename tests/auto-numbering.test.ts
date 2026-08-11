import { describe, expect, it } from 'vitest'
import {
  applyAutoNumbering,
  applyAutoNumberingToRange,
  clearCellRangeContents,
  formatSequenceNumber,
  insertNumberPlaceholder,
  replaceNumberPlaceholder,
} from '../src/lib/auto-numbering'
import { createStrip } from '../src/model/defaults'

describe('auto numbering', () => {
  it('inserts the {n} token at the cursor or appends without a cursor', () => {
    expect(insertNumberPlaceholder('Router Out ', 7, 7)).toEqual({
      value: 'Router {n}Out ',
      cursorIndex: 10,
    })
    expect(insertNumberPlaceholder('Router Out')).toEqual({
      value: 'Router Out{n}',
      cursorIndex: 13,
    })
    expect(insertNumberPlaceholder('Router XX', 7, 9)).toEqual({
      value: 'Router {n}',
      cursorIndex: 10,
    })
  })

  it('keeps neutral numbering defaults unapplied in empty new strips', () => {
    const strip = createStrip()
    expect(strip.autoNumbering.line1Template).toBe('Router Out')
    expect(strip.autoNumbering.line2Template).toBe('{n}')
    expect(strip.cells.every((cell) => cell.line1 === '')).toBe(true)
    expect(strip.cells.every((cell) => cell.line2 === '')).toBe(true)

    const numbered = applyAutoNumbering(strip)
    expect(numbered.cells[0].line1).toBe('Router Out')
    expect(numbered.cells[0].line2).toBe('01')
  })

  it('pads and applies a sequence to both lines', () => {
    const strip = createStrip('Audio inputs', 108, 7.5, 4)
    strip.autoNumbering = {
      line1Template: 'Router Main',
      line2Template: 'Audio IN {n}',
      startNumber: 1,
      digits: 2,
      cellCount: 4,
    }

    const numbered = applyAutoNumbering(strip)

    expect(numbered.cells.map((cell) => [cell.line1, cell.line2])).toEqual([
      ['Router Main', 'Audio IN 01'],
      ['Router Main', 'Audio IN 02'],
      ['Router Main', 'Audio IN 03'],
      ['Router Main', 'Audio IN 04'],
    ])
  })

  it('replaces placeholders anywhere and preserves cell IDs and styles', () => {
    const strip = createStrip('Cameras', 81, 7.5, 3)
    strip.autoNumbering = {
      line1Template: 'CAM {n} / backup {n}',
      line2Template: 'Router IN {n}',
      startNumber: 7,
      digits: 3,
      cellCount: 3,
    }
    const originalIds = strip.cells.map((cell) => cell.id)
    const originalStyles = strip.cells.map((cell) => cell.style)

    const numbered = applyAutoNumbering(strip)

    expect(numbered.cells[0].line1).toBe('CAM 007 / backup 007')
    expect(numbered.cells[2].line2).toBe('Router IN 009')
    expect(numbered.cells.map((cell) => cell.id)).toEqual(originalIds)
    expect(numbered.cells.map((cell) => cell.style)).toEqual(originalStyles)
  })

  it('formats negative values with padding after the sign', () => {
    expect(formatSequenceNumber(-3, 3)).toBe('-003')
    expect(replaceNumberPlaceholder('AES {n}', '12')).toBe('AES 12')
  })

  it('applies to cells 1–4 without changing cells outside the range', () => {
    const strip = createStrip('Grouped routing', 432, 7.5, 16)
    const untouchedCells = strip.cells.slice(4).map((cell) => ({ ...cell }))
    const numbered = applyAutoNumberingToRange(
      strip,
      { startIndex: 0, endIndex: 3 },
      {
        line1Template: 'Router',
        line2Template: 'IN {n}',
        startNumber: 1,
        digits: 2,
        cellCount: 16,
      },
    )

    expect(numbered.cells.slice(0, 4).map((cell) => cell.line2)).toEqual([
      'IN 01',
      'IN 02',
      'IN 03',
      'IN 04',
    ])
    expect(numbered.cells.slice(4)).toEqual(untouchedCells)
  })

  it('applies a second template to cells 5–8 while preserving cells 1–4', () => {
    const strip = createStrip('Grouped routing', 432, 7.5, 16)
    const firstGroup = applyAutoNumberingToRange(
      strip,
      { startIndex: 0, endIndex: 3 },
      {
        line1Template: 'Router',
        line2Template: 'IN {n}',
        startNumber: 1,
        digits: 2,
        cellCount: 16,
      },
    )
    const firstGroupSnapshot = firstGroup.cells
      .slice(0, 4)
      .map((cell) => ({ ...cell }))

    const secondGroup = applyAutoNumberingToRange(
      firstGroup,
      { startIndex: 4, endIndex: 7 },
      {
        line1Template: 'Router',
        line2Template: 'OUT {n}',
        startNumber: 1,
        digits: 2,
        cellCount: 16,
      },
    )

    expect(secondGroup.cells.slice(0, 4)).toEqual(firstGroupSnapshot)
    expect(secondGroup.cells.slice(4, 8).map((cell) => cell.line2)).toEqual([
      'OUT 01',
      'OUT 02',
      'OUT 03',
      'OUT 04',
    ])
  })

  it('restarts numbering from the configured start for every range', () => {
    const strip = createStrip('AES groups', 432, 7.5, 16)
    const first = applyAutoNumberingToRange(
      strip,
      { startIndex: 8, endIndex: 11 },
      {
        ...strip.autoNumbering,
        line1Template: 'AES',
        line2Template: 'IN {n}',
        startNumber: 3,
        digits: 2,
      },
    )
    const second = applyAutoNumberingToRange(
      first,
      { startIndex: 12, endIndex: 15 },
      {
        ...strip.autoNumbering,
        line1Template: 'AES',
        line2Template: 'OUT {n}',
        startNumber: 3,
        digits: 2,
      },
    )

    expect(second.cells.slice(8, 12).map((cell) => cell.line2)).toEqual([
      'IN 03',
      'IN 04',
      'IN 05',
      'IN 06',
    ])
    expect(second.cells.slice(12, 16).map((cell) => cell.line2)).toEqual([
      'OUT 03',
      'OUT 04',
      'OUT 05',
      'OUT 06',
    ])
  })

  it('preserves cell IDs and styles when numbering or clearing a range', () => {
    const strip = createStrip('Preserve metadata', 432, 7.5, 16)
    strip.cells[5].style = {
      alignment: 'right',
      fontSizePt: 8,
      fontWeight: 'normal',
      autoFit: false,
    }
    const ids = strip.cells.map((cell) => cell.id)
    const styles = strip.cells.map((cell) => ({ ...cell.style }))

    const numbered = applyAutoNumberingToRange(
      strip,
      { startIndex: 4, endIndex: 7 },
      {
        ...strip.autoNumbering,
        line1Template: 'Router',
        line2Template: 'OUT {n}',
      },
    )
    const cleared = clearCellRangeContents(numbered, {
      startIndex: 6,
      endIndex: 7,
    })

    expect(cleared.cells.map((cell) => cell.id)).toEqual(ids)
    expect(cleared.cells.map((cell) => cell.style)).toEqual(styles)
    expect(cleared.cells[6].line1).toBe('')
    expect(cleared.cells[7].line2).toBe('')
    expect(cleared.cells[5].line2).toBe('OUT 02')
  })
})
