import { describe, expect, it } from 'vitest'
import {
  formatCellEditValue,
  parseCellEditValue,
  resolveCellEditValue,
} from '../src/lib/cell-edit-text'
import { MAX_CELL_TEXT_LENGTH } from '../src/config/content-limits'

function typeInto(text: string) {
  let cell = { line1: '', line2: '' }
  let draft = formatCellEditValue(cell)
  for (const character of text) {
    const next = parseCellEditValue(resolveCellEditValue(cell, draft) + character)
    draft = next.value
    cell = { line1: next.line1, line2: next.line2 }
  }
  return { cell, value: resolveCellEditValue(cell, draft) }
}

describe('cell edit text', () => {
  it('keeps a typed line break so a second line can be typed', () => {
    const afterBreak = typeInto('SDI\n')
    expect(afterBreak.cell).toEqual({ line1: 'SDI', line2: '' })
    expect(afterBreak.value).toBe('SDI\n')

    expect(typeInto('SDI\nA').cell).toEqual({ line1: 'SDI', line2: 'A' })
  })

  it('folds further line breaks into the second line', () => {
    const parsed = parseCellEditValue('A\r\nB\nC')
    expect(parsed).toEqual({ line1: 'A', line2: 'B C', value: 'A\nB C' })
  })

  it('falls back to the stored text when the cell changed elsewhere', () => {
    expect(resolveCellEditValue({ line1: 'New', line2: '' }, 'Old\n')).toBe('New')
  })

  it('limits each line to the maximum cell text length', () => {
    const long = 'x'.repeat(MAX_CELL_TEXT_LENGTH + 5)
    const parsed = parseCellEditValue(`${long}\n${long}`)
    expect(parsed.line1).toHaveLength(MAX_CELL_TEXT_LENGTH)
    expect(parsed.line2).toHaveLength(MAX_CELL_TEXT_LENGTH)
  })
})
