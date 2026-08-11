import type { LabelStrip } from '../model/project'

export const CSS_PX_PER_MM = 96 / 25.4
export const POINTS_PER_MM = 72 / 25.4
export const MM_PER_POINT = 25.4 / 72

export function millimetersToPoints(millimeters: number): number {
  return millimeters * POINTS_PER_MM
}

export function pointsToMillimeters(points: number): number {
  return points * MM_PER_POINT
}

export function getCellWidthMm(strip: LabelStrip): number {
  if (strip.dimensions.cellWidthMode === 'custom') {
    return strip.dimensions.customCellWidthMm
  }

  return strip.dimensions.widthMm / strip.dimensions.cellCount
}

export function getGroupHeaderBandHeightMm(strip: LabelStrip): number {
  return Math.min(
    strip.dimensions.groupHeaderBandHeightMm,
    Math.max(0, strip.dimensions.heightMm - 0.5),
  )
}

export function getGroupHeaderRowHeightMm(strip: LabelStrip): number {
  return strip.groupHeaders.length > 0 ? getGroupHeaderBandHeightMm(strip) : 0
}

export function getStripTotalHeightMm(strip: LabelStrip): number {
  return strip.dimensions.heightMm
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
  context.font = `${weight === 'bold' ? 700 : 400} ${requestedSizePx}px Inter, "Segoe UI", sans-serif`

  const measuredWidthPx = context.measureText(text).width
  const maximumWidthPx = maximumWidthMm * CSS_PX_PER_MM
  if (measuredWidthPx <= maximumWidthPx) return requestedSizePt

  return Math.max(3.5, requestedSizePt * (maximumWidthPx / measuredWidthPx))
}
