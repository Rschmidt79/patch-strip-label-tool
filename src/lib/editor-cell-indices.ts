export function getEditorCellIndices(cellCount: number): number[] {
  const normalizedCount = Math.max(0, Math.floor(cellCount))
  return Array.from({ length: normalizedCount }, (_, index) => index + 1)
}
