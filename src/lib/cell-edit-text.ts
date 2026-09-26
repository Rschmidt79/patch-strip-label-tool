import type { LabelCell } from '../model/project'
import { MAX_CELL_TEXT_LENGTH } from '../config/content-limits'

export interface CellEditText {
  line1: string
  line2: string
  /** The normalized textarea value, which keeps a typed line break. */
  value: string
}

export function formatCellEditValue(
  cell: Pick<LabelCell, 'line1' | 'line2'>,
): string {
  return cell.line2 ? `${cell.line1}\n${cell.line2}` : cell.line1
}

export function parseCellEditValue(rawValue: string): CellEditText {
  const normalized = rawValue.replace(/\r/g, '')
  const firstBreak = normalized.indexOf('\n')
  const line1 = (
    firstBreak === -1 ? normalized : normalized.slice(0, firstBreak)
  ).slice(0, MAX_CELL_TEXT_LENGTH)
  if (firstBreak === -1) return { line1, line2: '', value: line1 }

  const line2 = normalized
    .slice(firstBreak + 1)
    .replace(/\n/g, ' ')
    .slice(0, MAX_CELL_TEXT_LENGTH)
  return { line1, line2, value: `${line1}\n${line2}` }
}

/**
 * Chooses the textarea value: the local draft while it still describes the
 * stored cell text (so an empty second line keeps its line break), otherwise
 * the stored text.
 */
export function resolveCellEditValue(
  cell: Pick<LabelCell, 'line1' | 'line2'>,
  draft: string,
): string {
  const parsed = parseCellEditValue(draft)
  return parsed.line1 === cell.line1 && parsed.line2 === cell.line2
    ? parsed.value
    : formatCellEditValue(cell)
}
