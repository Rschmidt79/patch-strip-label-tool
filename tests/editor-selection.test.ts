import { describe, expect, it } from 'vitest'
import {
  isEditorSelectionValid,
  resolveEditorCellSelection,
  selectEditorCell,
  type EditorSelection,
} from '../src/lib/editor-selection'
import { addGroupHeader } from '../src/lib/group-headers'
import { createStrip } from '../src/model/defaults'

describe('editor selection targets', () => {
  it('extends a cell selection into a contiguous range', () => {
    const strip = createStrip('Selection', 216, 7.5, 4)
    const row = strip.rows[0]
    const first = selectEditorCell(
      undefined,
      strip.id,
      row.id,
      row.cells[1].id,
      false,
    )
    const range = selectEditorCell(
      first,
      strip.id,
      row.id,
      row.cells[3].id,
      true,
    )

    expect(range.kind).toBe('range')
    expect(resolveEditorCellSelection([strip], range)).toMatchObject({
      startIndex: 1,
      endIndex: 3,
      cellIds: row.cells.slice(1, 4).map((cell) => cell.id),
    })
  })

  it('keeps a header separate from the cells beneath it', () => {
    const strip = createStrip('Header', 216, 7.5, 4)
    const row = strip.rows[0]
    const headerSelection: EditorSelection = {
      kind: 'header',
      stripId: strip.id,
      rowId: row.id,
      headerId: 'header-1',
    }

    expect(resolveEditorCellSelection([strip], headerSelection)).toBeUndefined()
    expect(
      selectEditorCell(
        headerSelection,
        strip.id,
        row.id,
        row.cells[2].id,
        true,
      ),
    ).toEqual({
      kind: 'cell',
      stripId: strip.id,
      rowId: row.id,
      cellId: row.cells[2].id,
    })
  })

  it('invalidates a cell selection when resizing removes its target', () => {
    const strip = createStrip('Resize', 216, 7.5, 4)
    const row = strip.rows[0]
    const selection: EditorSelection = {
      kind: 'cell',
      stripId: strip.id,
      rowId: row.id,
      cellId: row.cells[3].id,
    }
    const resized = {
      ...strip,
      rows: [{ ...row, cells: row.cells.slice(0, 2) }],
    }

    expect(resolveEditorCellSelection([resized], selection)).toBeUndefined()
    expect(isEditorSelectionValid([resized], selection)).toBe(false)
  })

  it('invalidates a header selection when resizing removes its target', () => {
    const strip = createStrip('Resize header', 216, 7.5, 4)
    const row = addGroupHeader(
      strip.rows[0],
      { startIndex: 2, endIndex: 3 },
      'Removed header',
    )
    const selection: EditorSelection = {
      kind: 'header',
      stripId: strip.id,
      rowId: row.id,
      headerId: row.groupHeaders[0].id,
    }
    const resized = {
      ...strip,
      rows: [{ ...row, cells: row.cells.slice(0, 2), groupHeaders: [] }],
    }

    expect(isEditorSelectionValid([{ ...strip, rows: [row] }], selection)).toBe(
      true,
    )
    expect(isEditorSelectionValid([resized], selection)).toBe(false)
  })
})
