import type { AutoNumberingSettings, LabelStrip } from '../model/project'
import { normalizeCellRange, type CellRange } from './cell-range'

export type { CellRange } from './cell-range'

export function formatSequenceNumber(value: number, digits: number): string {
  const normalizedDigits = Math.max(1, Math.floor(digits))
  const integerValue = Math.trunc(value)
  const sign = integerValue < 0 ? '-' : ''
  return `${sign}${String(Math.abs(integerValue)).padStart(normalizedDigits, '0')}`
}

export function replaceNumberPlaceholder(
  template: string,
  formattedNumber: string,
): string {
  return template.replaceAll('{n}', formattedNumber)
}

export interface NumberPlaceholderInsertion {
  value: string
  cursorIndex: number
}

export function insertNumberPlaceholder(
  template: string,
  selectionStart?: number | null,
  selectionEnd?: number | null,
): NumberPlaceholderInsertion {
  const start =
    selectionStart === undefined || selectionStart === null
      ? template.length
      : Math.max(0, Math.min(template.length, Math.trunc(selectionStart)))
  const end =
    selectionEnd === undefined || selectionEnd === null
      ? start
      : Math.max(start, Math.min(template.length, Math.trunc(selectionEnd)))
  const token = '{n}'
  return {
    value: `${template.slice(0, start)}${token}${template.slice(end)}`,
    cursorIndex: start + token.length,
  }
}

export function applyAutoNumbering(
  strip: LabelStrip,
  settings: AutoNumberingSettings = strip.autoNumbering,
): LabelStrip {
  return applyAutoNumberingToRange(
    strip,
    { startIndex: 0, endIndex: strip.cells.length - 1 },
    settings,
  )
}

export function applyAutoNumberingToRange(
  strip: LabelStrip,
  range: CellRange,
  settings: AutoNumberingSettings = strip.autoNumbering,
): LabelStrip {
  const normalizedSettings: AutoNumberingSettings = {
    ...settings,
    startNumber: Math.trunc(settings.startNumber),
    digits: Math.max(1, Math.floor(settings.digits)),
    cellCount: strip.dimensions.cellCount,
  }
  const normalizedRange = normalizeCellRange(strip.cells.length, range)

  return {
    ...strip,
    autoNumbering: normalizedSettings,
    cells: strip.cells.map((cell, index) => {
      if (
        index < normalizedRange.startIndex ||
        index > normalizedRange.endIndex
      ) {
        return cell
      }

      const formattedNumber = formatSequenceNumber(
        normalizedSettings.startNumber + index - normalizedRange.startIndex,
        normalizedSettings.digits,
      )

      return {
        ...cell,
        line1: replaceNumberPlaceholder(
          normalizedSettings.line1Template,
          formattedNumber,
        ),
        line2: replaceNumberPlaceholder(
          normalizedSettings.line2Template,
          formattedNumber,
        ),
      }
    }),
  }
}

export function clearCellRangeContents(
  strip: LabelStrip,
  range: CellRange,
): LabelStrip {
  const normalizedRange = normalizeCellRange(strip.cells.length, range)
  return {
    ...strip,
    cells: strip.cells.map((cell, index) =>
      index >= normalizedRange.startIndex && index <= normalizedRange.endIndex
        ? { ...cell, line1: '', line2: '' }
        : cell,
    ),
  }
}
