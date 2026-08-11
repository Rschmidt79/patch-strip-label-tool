export interface CellRange {
  startIndex: number
  endIndex: number
}

export function normalizeCellRange(
  cellCount: number,
  range: CellRange,
): CellRange {
  const maximumIndex = Math.max(0, cellCount - 1)
  const firstIndex = Math.min(range.startIndex, range.endIndex)
  const lastIndex = Math.max(range.startIndex, range.endIndex)

  return {
    startIndex: Math.max(0, Math.min(maximumIndex, Math.trunc(firstIndex))),
    endIndex: Math.max(0, Math.min(maximumIndex, Math.trunc(lastIndex))),
  }
}

export function isValidCellRange(
  cellCount: number,
  range: CellRange,
): boolean {
  return (
    Number.isInteger(range.startIndex) &&
    Number.isInteger(range.endIndex) &&
    range.startIndex >= 0 &&
    range.endIndex >= range.startIndex &&
    range.endIndex < cellCount
  )
}
