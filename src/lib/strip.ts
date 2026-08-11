import { createCell, createId } from '../model/defaults'
import type { LabelCell, LabelStrip } from '../model/project'

export function resizeStripCells(
  strip: LabelStrip,
  nextCount: number,
): LabelStrip {
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
    dimensions: { ...strip.dimensions },
    defaultTextStyle: { ...strip.defaultTextStyle },
    defaultCellAppearance: { ...strip.defaultCellAppearance },
    autoNumbering: { ...strip.autoNumbering },
    groupHeaders: strip.groupHeaders.map((header) => ({
      ...header,
      id: createId('group'),
      style: { ...header.style },
    })),
    cells: strip.cells.map<LabelCell>((cell) => ({
      ...cell,
      id: createId('cell'),
      style: { ...cell.style },
      appearance: { ...cell.appearance },
    })),
  }
}

export function removeStrip(
  strips: readonly LabelStrip[],
  stripId: string,
): LabelStrip[] {
  return strips.filter((strip) => strip.id !== stripId)
}
