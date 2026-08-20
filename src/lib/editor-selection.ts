import type { LabelStrip } from '../model/project'

export type EditorSelection =
  | {
      kind: 'cell'
      stripId: string
      rowId: string
      cellId: string
    }
  | {
      kind: 'range'
      stripId: string
      rowId: string
      anchorCellId: string
      focusCellId: string
    }
  | {
      kind: 'header'
      stripId: string
      rowId: string
      headerId: string
    }

export interface ResolvedEditorCellSelection {
  stripId: string
  rowId: string
  startIndex: number
  endIndex: number
  cellIds: string[]
}

export function selectEditorCell(
  current: EditorSelection | undefined,
  stripId: string,
  rowId: string,
  cellId: string,
  extendSelection: boolean,
): EditorSelection {
  if (
    extendSelection &&
    current?.stripId === stripId &&
    current.rowId === rowId &&
    current.kind !== 'header'
  ) {
    return {
      kind: 'range',
      stripId,
      rowId,
      anchorCellId:
        current.kind === 'cell' ? current.cellId : current.anchorCellId,
      focusCellId: cellId,
    }
  }

  return { kind: 'cell', stripId, rowId, cellId }
}

export function resolveEditorCellSelection(
  strips: readonly LabelStrip[],
  selection: EditorSelection | undefined,
): ResolvedEditorCellSelection | undefined {
  if (!selection || selection.kind === 'header') return undefined

  const strip = strips.find((candidate) => candidate.id === selection.stripId)
  const row = strip?.rows.find((candidate) => candidate.id === selection.rowId)
  if (!strip || !row) return undefined

  const anchorCellId =
    selection.kind === 'cell' ? selection.cellId : selection.anchorCellId
  const focusCellId =
    selection.kind === 'cell' ? selection.cellId : selection.focusCellId
  const anchorIndex = row.cells.findIndex((cell) => cell.id === anchorCellId)
  const focusIndex = row.cells.findIndex((cell) => cell.id === focusCellId)
  if (anchorIndex < 0 || focusIndex < 0) return undefined

  const startIndex = Math.min(anchorIndex, focusIndex)
  const endIndex = Math.max(anchorIndex, focusIndex)
  return {
    stripId: strip.id,
    rowId: row.id,
    startIndex,
    endIndex,
    cellIds: row.cells
      .slice(startIndex, endIndex + 1)
      .map((cell) => cell.id),
  }
}

export function isEditorSelectionValid(
  strips: readonly LabelStrip[],
  selection: EditorSelection,
): boolean {
  if (selection.kind !== 'header') {
    return resolveEditorCellSelection(strips, selection) !== undefined
  }

  const strip = strips.find((candidate) => candidate.id === selection.stripId)
  const row = strip?.rows.find((candidate) => candidate.id === selection.rowId)
  return row?.groupHeaders.some(
    (header) => header.id === selection.headerId,
  ) ?? false
}
