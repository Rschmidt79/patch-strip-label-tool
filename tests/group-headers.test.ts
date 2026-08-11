import { describe, expect, it } from 'vitest'
import {
  addGroupHeader,
  getCellContentGeometryMm,
  getGroupHeaderGeometryMm,
  GroupHeaderRangeError,
  removeGroupHeader,
  updateGroupHeader,
} from '../src/lib/group-headers'
import { getStripTotalHeightMm } from '../src/lib/dimensions'
import { createStrip } from '../src/model/defaults'
import { duplicateStrip, removeStrip } from '../src/lib/strip'

describe('group headers', () => {
  it('maps cells 1–6 and 7–12 to exact physical boundaries', () => {
    const first = addGroupHeader(
      createStrip('Twelve cells', 432, 7.5, 12),
      { startIndex: 0, endIndex: 5 },
      'MICROPHONES',
    )
    const strip = addGroupHeader(
      first,
      { startIndex: 6, endIndex: 11 },
      'LINE AUDIO',
    )
    const firstGeometry = getGroupHeaderGeometryMm(strip, strip.groupHeaders[0])
    const secondGeometry = getGroupHeaderGeometryMm(strip, strip.groupHeaders[1])

    expect(firstGeometry.xMm).toBe(0)
    expect(firstGeometry.widthMm).toBe(216)
    expect(secondGeometry.xMm).toBe(216)
    expect(secondGeometry.widthMm).toBe(216)
  })

  it('keeps physical height at 7.5 mm with no, one, or several headers', () => {
    const withoutHeaders = createStrip('Header height', 432, 7.5, 12)
    const oneHeader = addGroupHeader(
      withoutHeaders,
      { startIndex: 0, endIndex: 5 },
      'MICROPHONES',
    )
    const severalHeaders = addGroupHeader(
      oneHeader,
      { startIndex: 6, endIndex: 11 },
      'LINE AUDIO',
    )

    expect(getStripTotalHeightMm(withoutHeaders)).toBe(7.5)
    expect(getStripTotalHeightMm(oneHeader)).toBe(7.5)
    expect(getStripTotalHeightMm(severalHeaders)).toBe(7.5)
  })

  it('subdivides only covered cells inside the existing strip height', () => {
    const strip = addGroupHeader(
      createStrip('Header height', 432, 7.5, 12),
      { startIndex: 0, endIndex: 5 },
      'MICROPHONES',
    )
    const header = getGroupHeaderGeometryMm(strip, strip.groupHeaders[0])
    const coveredCell = getCellContentGeometryMm(strip, 0)
    const uncoveredCell = getCellContentGeometryMm(strip, 6)

    expect(strip.dimensions.groupHeaderBandHeightMm).toBe(2)
    expect(header.yMm).toBe(5.5)
    expect(header.heightMm).toBe(2)
    expect(coveredCell.heightMm).toBe(5.5)
    expect(header.heightMm + coveredCell.heightMm).toBe(7.5)
    expect(uncoveredCell.heightMm).toBe(7.5)
    expect(uncoveredCell.hasGroupHeader).toBe(false)
  })

  it('rejects overlapping ranges and leaves the source strip unchanged', () => {
    const strip = addGroupHeader(
      createStrip('No overlaps', 432, 7.5, 12),
      { startIndex: 0, endIndex: 5 },
      'MICROPHONES',
    )

    expect(() =>
      addGroupHeader(
        strip,
        { startIndex: 4, endIndex: 8 },
        'OVERLAP',
      ),
    ).toThrow(GroupHeaderRangeError)
    expect(strip.groupHeaders).toHaveLength(1)
  })

  it('edits and removes a header without changing cell contents', () => {
    const strip = addGroupHeader(
      createStrip('Editable', 432, 7.5, 12),
      { startIndex: 0, endIndex: 5 },
      'MICROPHONES',
    )
    const cellSnapshot = strip.cells.map((cell) => ({ ...cell }))
    const edited = updateGroupHeader(strip, strip.groupHeaders[0].id, (header) => ({
      ...header,
      text: 'MICS',
    }))
    const removed = removeGroupHeader(edited, edited.groupHeaders[0].id)

    expect(edited.groupHeaders[0].text).toBe('MICS')
    expect(removed.groupHeaders).toHaveLength(0)
    expect(removed.cells).toEqual(cellSnapshot)
  })

  it('deleting a header keeps its strip while deleting a strip removes it', () => {
    const strip = addGroupHeader(
      createStrip('Keep cells', 432, 7.5, 12),
      { startIndex: 0, endIndex: 5 },
      'MICROPHONES',
    )
    const withoutHeader = removeGroupHeader(strip, strip.groupHeaders[0].id)
    expect(withoutHeader.id).toBe(strip.id)
    expect(withoutHeader.cells).toHaveLength(12)

    const otherStrip = createStrip('Other', 216, 7.5, 8)
    const remaining = removeStrip([withoutHeader, otherStrip], strip.id)
    expect(remaining).toEqual([otherStrip])
  })

  it('duplicates header data and issues fresh stable IDs', () => {
    const strip = addGroupHeader(
      createStrip('Original', 432, 7.5, 12),
      { startIndex: 0, endIndex: 5 },
      'MICROPHONES',
    )
    const copy = duplicateStrip(strip, 'Copy')

    expect(copy.groupHeaders[0]).toMatchObject({
      text: 'MICROPHONES',
      startCellIndex: 0,
      endCellIndex: 5,
      style: strip.groupHeaders[0].style,
    })
    expect(copy.groupHeaders[0].id).not.toBe(strip.groupHeaders[0].id)
    expect(copy.cells.map((cell) => cell.id)).not.toEqual(
      strip.cells.map((cell) => cell.id),
    )
  })
})
