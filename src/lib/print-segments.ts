import type { LabelStrip } from '../model/project'
import { getCellWidthMm, getStripWidthMm } from './dimensions'
import { GEOMETRY_EPSILON_MM } from './geometry'

export const SPLIT_GLUE_TAB_WIDTH_MM = 8

export interface PrintStripSegment {
  id: string
  stripId: string
  segmentIndex: number
  segmentCount: number
  sourceStartMm: number
  sourceEndMm: number
  contentWidthMm: number
  glueTabWidthMm: number
  printedWidthMm: number
}

export function getPrintSegmentJoinLabel(
  segment: PrintStripSegment,
): string | undefined {
  if (segment.glueTabWidthMm <= 0) return undefined
  return `${segment.segmentIndex + 1}>${segment.segmentIndex + 2}`
}

function getCommonCellBoundariesMm(strip: LabelStrip): number[] {
  const widthMm = getStripWidthMm(strip)
  const boundariesByRow = strip.rows.map((row) => {
    const cellWidthMm = getCellWidthMm(row)
    return Array.from(
      { length: row.dimensions.cellCount - 1 },
      (_, index) => cellWidthMm * (index + 1),
    ).filter(
      (boundaryMm) =>
        boundaryMm > GEOMETRY_EPSILON_MM &&
        boundaryMm < widthMm - GEOMETRY_EPSILON_MM,
    )
  })
  const firstRowBoundaries = boundariesByRow[0] ?? []
  return firstRowBoundaries.filter((boundaryMm) =>
    boundariesByRow.slice(1).every((rowBoundaries) =>
      rowBoundaries.some(
        (candidateMm) =>
          Math.abs(candidateMm - boundaryMm) <= GEOMETRY_EPSILON_MM,
      ),
    ),
  )
}

function getMinimumSegmentCount(
  widthMm: number,
  maximumPrintedWidthMm: number,
): number {
  for (let count = 2; count <= 100; count += 1) {
    const equalContentWidthMm = widthMm / count
    if (
      equalContentWidthMm + SPLIT_GLUE_TAB_WIDTH_MM <=
        maximumPrintedWidthMm + GEOMETRY_EPSILON_MM &&
      equalContentWidthMm <= maximumPrintedWidthMm + GEOMETRY_EPSILON_MM
    ) {
      return count
    }
  }
  throw new RangeError('The strip is too long to create practical print segments.')
}

function chooseSplitPositionsMm(
  strip: LabelStrip,
  segmentCount: number,
  maximumPrintedWidthMm: number,
): number[] {
  const widthMm = getStripWidthMm(strip)
  const commonBoundariesMm = getCommonCellBoundariesMm(strip)
  const splitPositionsMm: number[] = []
  let previousMm = 0

  for (let splitIndex = 1; splitIndex < segmentCount; splitIndex += 1) {
    const targetMm = (widthMm * splitIndex) / segmentCount
    const remainingSegments = segmentCount - splitIndex
    const remainingCapacityMm =
      Math.max(0, remainingSegments - 1) *
        (maximumPrintedWidthMm - SPLIT_GLUE_TAB_WIDTH_MM) +
      maximumPrintedWidthMm
    const minimumMm = Math.max(
      previousMm + GEOMETRY_EPSILON_MM,
      widthMm - remainingCapacityMm,
    )
    const maximumMm = Math.min(
      widthMm - GEOMETRY_EPSILON_MM,
      previousMm +
        maximumPrintedWidthMm -
        SPLIT_GLUE_TAB_WIDTH_MM,
    )
    const naturalBoundaryMm = commonBoundariesMm
      .filter(
        (boundaryMm) =>
          boundaryMm >= minimumMm - GEOMETRY_EPSILON_MM &&
          boundaryMm <= maximumMm + GEOMETRY_EPSILON_MM,
      )
      .sort(
        (leftMm, rightMm) =>
          Math.abs(leftMm - targetMm) - Math.abs(rightMm - targetMm) ||
          leftMm - rightMm,
      )[0]
    const splitMm =
      naturalBoundaryMm ?? Math.min(maximumMm, Math.max(minimumMm, targetMm))
    splitPositionsMm.push(splitMm)
    previousMm = splitMm
  }

  return splitPositionsMm
}

export function createWholePrintSegment(
  strip: LabelStrip,
): PrintStripSegment {
  const widthMm = getStripWidthMm(strip)
  return {
    id: strip.id,
    stripId: strip.id,
    segmentIndex: 0,
    segmentCount: 1,
    sourceStartMm: 0,
    sourceEndMm: widthMm,
    contentWidthMm: widthMm,
    glueTabWidthMm: 0,
    printedWidthMm: widthMm,
  }
}

export function createSplitPrintSegments(
  strip: LabelStrip,
  maximumPrintedWidthMm: number,
): PrintStripSegment[] {
  if (
    !Number.isFinite(maximumPrintedWidthMm) ||
    maximumPrintedWidthMm <= SPLIT_GLUE_TAB_WIDTH_MM
  ) {
    throw new RangeError('Maximum print segment width must exceed the glue tab width.')
  }

  const widthMm = getStripWidthMm(strip)
  const segmentCount = getMinimumSegmentCount(
    widthMm,
    maximumPrintedWidthMm,
  )
  const positionsMm = [
    0,
    ...chooseSplitPositionsMm(strip, segmentCount, maximumPrintedWidthMm),
    widthMm,
  ]

  return Array.from({ length: segmentCount }, (_, segmentIndex) => {
    const sourceStartMm = positionsMm[segmentIndex]
    const sourceEndMm = positionsMm[segmentIndex + 1]
    const contentWidthMm = sourceEndMm - sourceStartMm
    const glueTabWidthMm =
      segmentIndex < segmentCount - 1 ? SPLIT_GLUE_TAB_WIDTH_MM : 0
    return {
      id: `${strip.id}--print-segment-${segmentIndex + 1}-of-${segmentCount}`,
      stripId: strip.id,
      segmentIndex,
      segmentCount,
      sourceStartMm,
      sourceEndMm,
      contentWidthMm,
      glueTabWidthMm,
      printedWidthMm: contentWidthMm + glueTabWidthMm,
    }
  })
}

/** Creates geometry-only transient input for the existing PDF packer. */
export function createLayoutStripForPrintSegment(
  strip: LabelStrip,
  segment: PrintStripSegment,
): LabelStrip {
  return {
    ...strip,
    id: segment.id,
    name:
      segment.segmentCount === 1
        ? strip.name
        : `${strip.name} (${segment.segmentIndex + 1}/${segment.segmentCount})`,
    rows: strip.rows.map((row) => ({
      ...row,
      dimensions: {
        ...row.dimensions,
        widthMm: segment.printedWidthMm,
      },
    })),
  }
}
