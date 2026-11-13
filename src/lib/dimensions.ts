import type {
  CellTextStyle,
  LabelStrip,
  LabelStripRow,
} from '../model/project'

export const CSS_PX_PER_MM = 96 / 25.4
export const POINTS_PER_MM = 72 / 25.4
export const MM_PER_POINT = 25.4 / 72

export function millimetersToPoints(millimeters: number): number {
  return millimeters * POINTS_PER_MM
}

export function pointsToMillimeters(points: number): number {
  return points * MM_PER_POINT
}

export function getCellWidthMm(row: LabelStripRow): number {
  if (row.dimensions.cellWidthMode === 'custom') {
    return row.dimensions.customCellWidthMm
  }

  return row.dimensions.widthMm / row.dimensions.cellCount
}

export function getGroupHeaderBandHeightMm(row: LabelStripRow): number {
  return Math.min(
    row.dimensions.groupHeaderBandHeightMm,
    Math.max(0, row.dimensions.heightMm - 0.5),
  )
}

export function getGroupHeaderRowHeightMm(row: LabelStripRow): number {
  return row.groupHeaders.length > 0 ? getGroupHeaderBandHeightMm(row) : 0
}

export function getStripWidthMm(strip: LabelStrip): number {
  return strip.rows[0]?.dimensions.widthMm ?? 0
}

export function getStripRowTopOffsetsMm(strip: LabelStrip): number[] {
  const offsetsMm: number[] = []
  let topMm = 0
  for (const row of strip.rows) {
    offsetsMm.push(topMm)
    topMm += row.dimensions.heightMm
  }
  return offsetsMm
}

export function getStripTotalHeightMm(
  strip: LabelStrip | LabelStripRow,
): number {
  return 'rows' in strip
    ? strip.rows.reduce(
        (heightMm, row) => heightMm + row.dimensions.heightMm,
        0,
      )
    : strip.dimensions.heightMm
}

export function formatMillimeters(value: number, precision = 2): string {
  return Number(value.toFixed(precision)).toString()
}

let measurementCanvas: HTMLCanvasElement | undefined

export function fitFontSizePt(
  text: string,
  maximumWidthMm: number,
  requestedSizePt: number,
  weight: 'normal' | 'bold',
  shouldFit: boolean,
): number {
  if (!shouldFit || !text || typeof document === 'undefined') {
    return requestedSizePt
  }

  measurementCanvas ??= document.createElement('canvas')
  const context = measurementCanvas.getContext('2d')
  if (!context) return requestedSizePt

  const requestedSizePx = requestedSizePt * (96 / 72)
  context.font = `${weight === 'bold' ? 700 : 400} ${requestedSizePx}px ${PREVIEW_FONT_FAMILY}`

  const measuredWidthPx = context.measureText(text).width
  const maximumWidthPx = maximumWidthMm * CSS_PX_PER_MM
  if (measuredWidthPx <= maximumWidthPx) return requestedSizePt

  return Math.max(3.5, requestedSizePt * (maximumWidthPx / measuredWidthPx))
}

/** Line pitch of two-line cell text relative to its font size. */
export const PREVIEW_LINE_HEIGHT_RATIO = 1.04
export const PREVIEW_FONT_FAMILY = 'Inter, "Segoe UI", sans-serif'

/**
 * Font size of each non-empty line as the editor preview draws it. The cell
 * text and the in-place edit field both use this, so text does not move or
 * change size when a cell is opened for editing.
 */
export function getPreviewLineFontSizesPt(
  lines: readonly string[],
  cellWidthMm: number,
  cellHeightMm: number,
  style: CellTextStyle,
): number[] {
  if (lines.length === 0) return []
  const horizontalPaddingMm = Math.min(1.25, cellWidthMm * 0.08)
  const availableWidthMm = Math.max(0.5, cellWidthMm - horizontalPaddingMm * 2)
  const maximumLineSizePt =
    cellHeightMm /
    (lines.length === 1 ? 1.15 : lines.length * 1.12) /
    MM_PER_POINT
  const requestedSizePt = style.autoFit
    ? Math.min(style.fontSizePt, maximumLineSizePt)
    : style.fontSizePt
  return lines.map((line) =>
    fitFontSizePt(
      line,
      availableWidthMm,
      requestedSizePt,
      style.fontWeight,
      style.autoFit,
    ),
  )
}
