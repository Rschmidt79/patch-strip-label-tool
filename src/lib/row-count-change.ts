import { MAX_ROWS_PER_STRIP } from '../config/content-limits'
import { createStripRow } from '../model/defaults'
import type {
  AutoNumberingSettings,
  CellAppearance,
  CellTextStyle,
  LabelStrip,
  LabelStripRow,
  StripDimensions,
} from '../model/project'
import { resizeStripRows } from './strip'

function hasSameTextStyle(left: CellTextStyle, right: CellTextStyle): boolean {
  return (
    left.alignment === right.alignment &&
    left.fontSizePt === right.fontSizePt &&
    left.fontWeight === right.fontWeight &&
    left.autoFit === right.autoFit
  )
}

function hasSameAppearance(
  left: CellAppearance,
  right: CellAppearance,
): boolean {
  return (
    left.backgroundColor === right.backgroundColor &&
    left.textColor === right.textColor &&
    left.borderColor === right.borderColor
  )
}

function hasSameDimensions(
  left: StripDimensions,
  right: StripDimensions,
): boolean {
  return (
    left.widthMm === right.widthMm &&
    left.heightMm === right.heightMm &&
    left.groupHeaderBandHeightMm === right.groupHeaderBandHeightMm &&
    left.cellCount === right.cellCount &&
    left.cellWidthMode === right.cellWidthMode &&
    left.customCellWidthMm === right.customCellWidthMm
  )
}

function hasSameAutoNumbering(
  left: AutoNumberingSettings,
  right: AutoNumberingSettings,
): boolean {
  return (
    left.line1Template === right.line1Template &&
    left.line2Template === right.line2Template &&
    left.startNumber === right.startNumber &&
    left.digits === right.digits &&
    left.cellCount === right.cellCount
  )
}

export function stripRowHasUserDataOrSettings(row: LabelStripRow): boolean {
  const defaultRow = createStripRow()

  if (
    !hasSameDimensions(row.dimensions, defaultRow.dimensions) ||
    !hasSameTextStyle(row.defaultTextStyle, defaultRow.defaultTextStyle) ||
    !hasSameAppearance(
      row.defaultCellAppearance,
      defaultRow.defaultCellAppearance,
    ) ||
    !hasSameAutoNumbering(row.autoNumbering, defaultRow.autoNumbering) ||
    row.groupHeaders.length > 0 ||
    row.cells.length !== defaultRow.cells.length
  ) {
    return true
  }

  return row.cells.some((cell, index) => {
    const defaultCell = defaultRow.cells[index]
    return (
      cell.line1 !== '' ||
      cell.line2 !== '' ||
      !defaultCell ||
      !hasSameTextStyle(cell.style, defaultCell.style) ||
      !hasSameAppearance(cell.appearance, defaultCell.appearance)
    )
  })
}

export function getRowRemovalConfirmationMessage(
  removedRowCount: number,
): string {
  return removedRowCount === 1
    ? 'Remove 1 row? Its content, dimensions, and formatting will be permanently lost.'
    : `Remove ${removedRowCount} rows? Their content, dimensions, and formatting will be permanently lost.`
}

export function applyStripRowCountChange(
  strip: LabelStrip,
  nextCount: number,
  confirmRemoval: (message: string) => boolean,
): LabelStrip {
  const normalizedCount = Math.max(
    1,
    Math.min(MAX_ROWS_PER_STRIP, Math.round(nextCount)),
  )
  const removedRows = strip.rows.slice(normalizedCount)

  if (
    removedRows.some(stripRowHasUserDataOrSettings) &&
    !confirmRemoval(getRowRemovalConfirmationMessage(removedRows.length))
  ) {
    return strip
  }

  return resizeStripRows(strip, normalizedCount)
}
