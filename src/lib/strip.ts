import { createCell, createId, createStripRow } from '../model/defaults'
import { MAX_ROWS_PER_STRIP } from '../config/content-limits'
import { GEOMETRY_EPSILON_MM } from './geometry'
import type { LabelCell, LabelStrip, LabelStripRow } from '../model/project'

export function resizeStripCells(
  strip: LabelStripRow,
  nextCount: number,
): LabelStripRow {
  const cellCount = Math.max(1, Math.min(64, Math.round(nextCount)))
  const retainedCells = strip.cells.slice(0, cellCount)
  const newCells = Array.from(
    { length: Math.max(0, cellCount - retainedCells.length) },
    (_, index) =>
      createCell(
        retainedCells.length + index,
        strip.defaultTextStyle,
        strip.defaultCellAppearance,
      ),
  )
  const groupHeaders = strip.groupHeaders
    .filter((header) => header.startCellIndex < cellCount)
    .map((header) => ({
      ...header,
      endCellIndex: Math.min(header.endCellIndex, cellCount - 1),
      style: { ...header.style },
    }))

  return {
    ...strip,
    dimensions: {
      ...strip.dimensions,
      widthMm:
        strip.dimensions.cellWidthMode === 'custom'
          ? strip.dimensions.customCellWidthMm * cellCount
          : strip.dimensions.widthMm,
      cellCount,
      customCellWidthMm:
        strip.dimensions.cellWidthMode === 'equal'
          ? strip.dimensions.widthMm / cellCount
          : strip.dimensions.customCellWidthMm,
    },
    cells: [...retainedCells, ...newCells],
    groupHeaders,
    autoNumbering: {
      ...strip.autoNumbering,
      cellCount,
    },
  }
}

export function duplicateStrip(strip: LabelStrip, name: string): LabelStrip {
  return {
    ...strip,
    id: createId('strip'),
    name,
    rows: strip.rows.map((row) => duplicateStripRow(row)),
  }
}

function duplicateStripRow(row: LabelStripRow): LabelStripRow {
  return {
    ...row,
    id: createId('row'),
    dimensions: { ...row.dimensions },
    defaultTextStyle: { ...row.defaultTextStyle },
    defaultCellAppearance: { ...row.defaultCellAppearance },
    autoNumbering: { ...row.autoNumbering },
    groupHeaders: row.groupHeaders.map((header) => ({
      ...header,
      id: createId('group'),
      style: { ...header.style },
    })),
    cells: row.cells.map<LabelCell>((cell) => ({
      ...cell,
      id: createId('cell'),
      style: { ...cell.style },
      appearance: { ...cell.appearance },
    })),
  }
}

export function updateStripRow(
  strip: LabelStrip,
  rowId: string,
  updater: (row: LabelStripRow) => LabelStripRow,
): LabelStrip {
  const currentRow = strip.rows.find((row) => row.id === rowId)
  if (!currentRow) return strip
  const updatedRow = updater(currentRow)
  const widthMm = updatedRow.dimensions.widthMm
  return {
    ...strip,
    rows: strip.rows.map((row) => {
      if (row.id === rowId) return updatedRow
      if (
        Math.abs(row.dimensions.widthMm - widthMm) <= GEOMETRY_EPSILON_MM
      ) {
        return row
      }
      return {
        ...row,
        dimensions: {
          ...row.dimensions,
          widthMm,
          customCellWidthMm: widthMm / row.dimensions.cellCount,
        },
      }
    }),
  }
}

export function addStripRow(strip: LabelStrip): LabelStrip {
  if (strip.rows.length >= MAX_ROWS_PER_STRIP) return strip
  const source = strip.rows.at(-1)
  const rowNumber = strip.rows.length + 1
  const row = source
    ? createStripRow(
        `${strip.name} row ${rowNumber}`,
        source.dimensions.widthMm,
        source.dimensions.heightMm,
        source.dimensions.cellCount,
      )
    : createStripRow(`${strip.name} row ${rowNumber}`)

  if (source) {
    row.dimensions = { ...source.dimensions }
    row.defaultTextStyle = { ...source.defaultTextStyle }
    row.defaultCellAppearance = { ...source.defaultCellAppearance }
    row.autoNumbering = {
      ...source.autoNumbering,
      cellCount: row.dimensions.cellCount,
    }
    row.cells = row.cells.map((cell) => ({
      ...cell,
      style: { ...source.defaultTextStyle },
      appearance: { ...source.defaultCellAppearance },
    }))
  }
  return { ...strip, rows: [...strip.rows, row] }
}

export class StripJoinError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StripJoinError'
  }
}

export function getStripJoinError(
  strips: readonly LabelStrip[],
  selectedStripIds: readonly string[],
): string | undefined {
  const selectedIdSet = new Set(selectedStripIds)
  const selected = strips.filter((strip) => selectedIdSet.has(strip.id))
  if (selected.length < 2) return 'Select at least two strips to join.'
  const widthMm = selected[0].rows[0]?.dimensions.widthMm
  if (widthMm === undefined) return 'A strip must contain at least one row.'
  if (
    selected.some(
      (strip) =>
        strip.rows.length === 0 ||
        strip.rows.some(
          (row) =>
            Math.abs(row.dimensions.widthMm - widthMm) >
            GEOMETRY_EPSILON_MM,
        ),
    )
  ) {
    return 'Selected strips must have the same physical width. No strip will be resized.'
  }
  const rowCount = selected.reduce((count, strip) => count + strip.rows.length, 0)
  if (rowCount > MAX_ROWS_PER_STRIP) {
    return `A joined strip can contain at most ${MAX_ROWS_PER_STRIP} rows.`
  }
  return undefined
}

export function joinStrips(
  strips: readonly LabelStrip[],
  selectedStripIds: readonly string[],
): LabelStrip[] {
  const error = getStripJoinError(strips, selectedStripIds)
  if (error) throw new StripJoinError(error)
  const selectedIdSet = new Set(selectedStripIds)
  const selected = strips.filter((strip) => selectedIdSet.has(strip.id))
  const first = selected[0]
  const joined: LabelStrip = {
    ...first,
    rows: selected.flatMap((strip) => strip.rows),
  }
  const firstIndex = strips.findIndex((strip) => strip.id === first.id)
  return strips.flatMap((strip, index) => {
    if (index === firstIndex) return [joined]
    return selectedIdSet.has(strip.id) ? [] : [strip]
  })
}

export function splitStripRows(strip: LabelStrip): LabelStrip[] {
  if (strip.rows.length <= 1) return [strip]
  return strip.rows.map((row, index) => ({
    id: index === 0 ? strip.id : createId('strip'),
    name: row.name || `${strip.name} row ${index + 1}`,
    rows: [row],
  }))
}

export function removeStrip(
  strips: readonly LabelStrip[],
  stripId: string,
): LabelStrip[] {
  return strips.filter((strip) => strip.id !== stripId)
}
