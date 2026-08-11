import type { CellAppearance, LabelStrip } from '../model/project'
import { normalizeCellRange, type CellRange } from './cell-range'
import {
  getContrastingTextColor,
  shiftHexColorLightness,
} from './colors'

export interface CellColorPreset extends CellAppearance {
  id: string
  name: string
}

export const CELL_COLOR_PRESETS: readonly CellColorPreset[] = [
  {
    id: 'paper',
    name: 'Paper',
    backgroundColor: '#ffffff',
    textColor: '#101418',
    borderColor: '#8c9490',
  },
  {
    id: 'light-gray',
    name: 'Light gray',
    backgroundColor: '#d9dee2',
    textColor: '#101418',
    borderColor: '#737d84',
  },
  {
    id: 'dark',
    name: 'Dark',
    backgroundColor: '#3a444c',
    textColor: '#ffffff',
    borderColor: '#111820',
  },
  {
    id: 'yellow',
    name: 'Yellow',
    backgroundColor: '#f4d35e',
    textColor: '#101418',
    borderColor: '#9a7920',
  },
  {
    id: 'orange',
    name: 'Orange',
    backgroundColor: '#f28c45',
    textColor: '#101418',
    borderColor: '#934914',
  },
  {
    id: 'red',
    name: 'Red',
    backgroundColor: '#c74d49',
    textColor: '#ffffff',
    borderColor: '#722825',
  },
  {
    id: 'green',
    name: 'Green',
    backgroundColor: '#3b8f5a',
    textColor: '#ffffff',
    borderColor: '#205132',
  },
  {
    id: 'blue',
    name: 'Blue',
    backgroundColor: '#3973b9',
    textColor: '#ffffff',
    borderColor: '#1e4473',
  },
]

export function applyCellAppearanceToRange(
  strip: LabelStrip,
  range: CellRange,
  appearance: Partial<CellAppearance>,
): LabelStrip {
  const normalizedRange = normalizeCellRange(strip.cells.length, range)
  return {
    ...strip,
    cells: strip.cells.map((cell, index) =>
      index >= normalizedRange.startIndex && index <= normalizedRange.endIndex
        ? {
            ...cell,
            appearance: { ...cell.appearance, ...appearance },
          }
        : cell,
    ),
  }
}

export function shiftCellRangeLightness(
  strip: LabelStrip,
  range: CellRange,
  direction: 'lighter' | 'darker',
): LabelStrip {
  const normalizedRange = normalizeCellRange(strip.cells.length, range)
  return {
    ...strip,
    cells: strip.cells.map((cell, index) => {
      if (index < normalizedRange.startIndex || index > normalizedRange.endIndex)
        return cell
      const backgroundColor = shiftHexColorLightness(
        cell.appearance.backgroundColor,
        direction,
      )
      return {
        ...cell,
        appearance: {
          ...cell.appearance,
          backgroundColor,
          textColor: getContrastingTextColor(backgroundColor),
        },
      }
    }),
  }
}

export function resetCellRangeStyle(
  strip: LabelStrip,
  range: CellRange,
): LabelStrip {
  const normalizedRange = normalizeCellRange(strip.cells.length, range)
  return {
    ...strip,
    cells: strip.cells.map((cell, index) =>
      index >= normalizedRange.startIndex && index <= normalizedRange.endIndex
        ? {
            ...cell,
            style: { ...strip.defaultTextStyle },
            appearance: { ...strip.defaultCellAppearance },
          }
        : cell,
    ),
  }
}
