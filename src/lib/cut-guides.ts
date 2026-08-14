import {
  GEOMETRY_ANGLE_EPSILON_DEGREES,
  GEOMETRY_EPSILON_MM,
  GEOMETRY_EPSILON_MM2,
  degreesToRadians,
  type PointMm,
} from './geometry'

export const CUT_LINE_WIDTH_MM = 0.18
export const CROP_MARK_WIDTH_MM = 0.16
export const CROP_MARK_OFFSET_MM = 0.6
export const CROP_MARK_LENGTH_MM = 2.8

export interface LineSegmentMm {
  start: PointMm
  end: PointMm
}

export interface CutGuideOptions {
  cutLines: boolean
  cropMarks: boolean
}

export interface PageCutGuidesMm {
  cutLines: LineSegmentMm[]
  cropMarks: LineSegmentMm[]
}

interface NormalizedLineSegment {
  directionX: number
  directionY: number
  normalX: number
  normalY: number
  normalOffsetMm: number
  minimumMm: number
  maximumMm: number
}

function normalizeLineSegment(
  segment: LineSegmentMm,
): NormalizedLineSegment | undefined {
  let directionX = segment.end.xMm - segment.start.xMm
  let directionY = segment.end.yMm - segment.start.yMm
  const lengthMm = Math.hypot(directionX, directionY)
  if (lengthMm <= GEOMETRY_EPSILON_MM) return undefined
  directionX /= lengthMm
  directionY /= lengthMm

  const angleEpsilon = Math.sin(
    degreesToRadians(GEOMETRY_ANGLE_EPSILON_DEGREES),
  )
  if (
    directionX < -angleEpsilon ||
    (Math.abs(directionX) <= angleEpsilon && directionY < 0)
  ) {
    directionX = -directionX
    directionY = -directionY
  }

  const normalX = -directionY
  const normalY = directionX
  const firstProjectionMm =
    segment.start.xMm * directionX + segment.start.yMm * directionY
  const secondProjectionMm =
    segment.end.xMm * directionX + segment.end.yMm * directionY
  return {
    directionX,
    directionY,
    normalX,
    normalY,
    normalOffsetMm:
      segment.start.xMm * normalX + segment.start.yMm * normalY,
    minimumMm: Math.min(firstProjectionMm, secondProjectionMm),
    maximumMm: Math.max(firstProjectionMm, secondProjectionMm),
  }
}

function linesAreCoincident(
  first: NormalizedLineSegment,
  second: NormalizedLineSegment,
): boolean {
  const cross =
    first.directionX * second.directionY -
    first.directionY * second.directionX
  return (
    Math.abs(cross) <=
      Math.sin(degreesToRadians(GEOMETRY_ANGLE_EPSILON_DEGREES)) &&
    Math.abs(first.normalOffsetMm - second.normalOffsetMm) <=
      GEOMETRY_EPSILON_MM
  )
}

function denormalizeLineSegment(
  line: NormalizedLineSegment,
  minimumMm: number,
  maximumMm: number,
): LineSegmentMm {
  const pointAt = (distanceMm: number): PointMm => ({
    xMm:
      line.directionX * distanceMm + line.normalX * line.normalOffsetMm,
    yMm:
      line.directionY * distanceMm + line.normalY * line.normalOffsetMm,
  })
  return { start: pointAt(minimumMm), end: pointAt(maximumMm) }
}

export function getPolygonEdgeSegmentsMm(
  polygon: readonly PointMm[],
): LineSegmentMm[] {
  return polygon.map((start, index) => ({
    start,
    end: polygon[(index + 1) % polygon.length],
  }))
}

export function getCoincidentSegmentOverlapMm(
  first: LineSegmentMm,
  second: LineSegmentMm,
): LineSegmentMm | undefined {
  const normalizedFirst = normalizeLineSegment(first)
  const normalizedSecond = normalizeLineSegment(second)
  if (
    !normalizedFirst ||
    !normalizedSecond ||
    !linesAreCoincident(normalizedFirst, normalizedSecond)
  ) {
    return undefined
  }
  const minimumMm = Math.max(
    normalizedFirst.minimumMm,
    normalizedSecond.minimumMm,
  )
  const maximumMm = Math.min(
    normalizedFirst.maximumMm,
    normalizedSecond.maximumMm,
  )
  if (maximumMm - minimumMm <= GEOMETRY_EPSILON_MM) return undefined
  return denormalizeLineSegment(normalizedFirst, minimumMm, maximumMm)
}

function mergeCoincidentSegments(
  segments: readonly LineSegmentMm[],
): LineSegmentMm[] {
  const groups: NormalizedLineSegment[][] = []
  for (const segment of segments) {
    const normalized = normalizeLineSegment(segment)
    if (!normalized) continue
    const group = groups.find((candidate) =>
      linesAreCoincident(candidate[0], normalized),
    )
    if (group) group.push(normalized)
    else groups.push([normalized])
  }

  return groups.flatMap((group) => {
    const reference = group[0]
    const intervals = group
      .map((line) => ({
        minimumMm: line.minimumMm,
        maximumMm: line.maximumMm,
      }))
      .sort((left, right) => left.minimumMm - right.minimumMm)
    const merged: Array<{ minimumMm: number; maximumMm: number }> = []
    for (const interval of intervals) {
      const current = merged[merged.length - 1]
      if (
        current &&
        interval.minimumMm <= current.maximumMm + GEOMETRY_EPSILON_MM
      ) {
        current.maximumMm = Math.max(current.maximumMm, interval.maximumMm)
      } else {
        merged.push({ ...interval })
      }
    }
    return merged.map((interval) =>
      denormalizeLineSegment(
        reference,
        interval.minimumMm,
        interval.maximumMm,
      ),
    )
  })
}

export function getSharedEdgeSegmentsMm(
  polygons: readonly (readonly PointMm[])[],
): LineSegmentMm[] {
  const overlaps: LineSegmentMm[] = []
  for (let firstIndex = 0; firstIndex < polygons.length; firstIndex += 1) {
    const firstEdges = getPolygonEdgeSegmentsMm(polygons[firstIndex])
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < polygons.length;
      secondIndex += 1
    ) {
      const secondEdges = getPolygonEdgeSegmentsMm(polygons[secondIndex])
      for (const first of firstEdges) {
        for (const second of secondEdges) {
          const overlap = getCoincidentSegmentOverlapMm(first, second)
          if (overlap) overlaps.push(overlap)
        }
      }
    }
  }
  return mergeCoincidentSegments(overlaps)
}

export function getTotalSharedEdgeLengthMm(
  polygons: readonly (readonly PointMm[])[],
): number {
  return getSharedEdgeSegmentsMm(polygons).reduce(
    (total, segment) =>
      total +
      Math.hypot(
        segment.end.xMm - segment.start.xMm,
        segment.end.yMm - segment.start.yMm,
      ),
    0,
  )
}

export function getCutLineSegmentsMm(
  polygons: readonly (readonly PointMm[])[],
): LineSegmentMm[] {
  return mergeCoincidentSegments(
    polygons.flatMap((polygon) => getPolygonEdgeSegmentsMm(polygon)),
  )
}

function crossProduct(
  firstX: number,
  firstY: number,
  secondX: number,
  secondY: number,
): number {
  return firstX * secondY - firstY * secondX
}

function pointIsStrictlyInsideConvexPolygonMm(
  point: PointMm,
  polygon: readonly PointMm[],
): boolean {
  let hasPositive = false
  let hasNegative = false
  let isOnBoundary = false
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index]
    const end = polygon[(index + 1) % polygon.length]
    const cross = crossProduct(
      end.xMm - start.xMm,
      end.yMm - start.yMm,
      point.xMm - start.xMm,
      point.yMm - start.yMm,
    )
    if (cross > GEOMETRY_EPSILON_MM2) hasPositive = true
    else if (cross < -GEOMETRY_EPSILON_MM2) hasNegative = true
    else isOnBoundary = true
    if (hasPositive && hasNegative) return false
  }
  return !isOnBoundary && (hasPositive || hasNegative)
}

function getSegmentEdgeIntersectionParameters(
  segment: LineSegmentMm,
  edge: LineSegmentMm,
): number[] {
  const directionX = segment.end.xMm - segment.start.xMm
  const directionY = segment.end.yMm - segment.start.yMm
  const edgeX = edge.end.xMm - edge.start.xMm
  const edgeY = edge.end.yMm - edge.start.yMm
  const offsetX = edge.start.xMm - segment.start.xMm
  const offsetY = edge.start.yMm - segment.start.yMm
  const denominator = crossProduct(directionX, directionY, edgeX, edgeY)

  if (Math.abs(denominator) > GEOMETRY_EPSILON_MM2) {
    const segmentParameter =
      crossProduct(offsetX, offsetY, edgeX, edgeY) / denominator
    const edgeParameter =
      crossProduct(offsetX, offsetY, directionX, directionY) / denominator
    return segmentParameter >= -GEOMETRY_EPSILON_MM &&
      segmentParameter <= 1 + GEOMETRY_EPSILON_MM &&
      edgeParameter >= -GEOMETRY_EPSILON_MM &&
      edgeParameter <= 1 + GEOMETRY_EPSILON_MM
      ? [Math.max(0, Math.min(1, segmentParameter))]
      : []
  }

  if (
    Math.abs(crossProduct(offsetX, offsetY, directionX, directionY)) >
    GEOMETRY_EPSILON_MM2
  ) {
    return []
  }
  const lengthSquared = directionX * directionX + directionY * directionY
  if (lengthSquared <= GEOMETRY_EPSILON_MM * GEOMETRY_EPSILON_MM) return []
  return [edge.start, edge.end]
    .map(
      (point) =>
        ((point.xMm - segment.start.xMm) * directionX +
          (point.yMm - segment.start.yMm) * directionY) /
        lengthSquared,
    )
    .filter(
      (parameter) =>
        parameter >= -GEOMETRY_EPSILON_MM &&
        parameter <= 1 + GEOMETRY_EPSILON_MM,
    )
    .map((parameter) => Math.max(0, Math.min(1, parameter)))
}

/** True only when some positive-length part of a segment enters the polygon. */
export function segmentEntersPolygonInteriorMm(
  segment: LineSegmentMm,
  polygon: readonly PointMm[],
): boolean {
  if (polygon.length < 3) return false
  const parameters = [
    0,
    1,
    ...getPolygonEdgeSegmentsMm(polygon).flatMap((edge) =>
      getSegmentEdgeIntersectionParameters(segment, edge),
    ),
  ]
    .sort((left, right) => left - right)
    .filter(
      (parameter, index, sorted) =>
        index === 0 ||
        Math.abs(parameter - sorted[index - 1]) > GEOMETRY_EPSILON_MM,
    )
  const pointAt = (parameter: number): PointMm => ({
    xMm:
      segment.start.xMm +
      (segment.end.xMm - segment.start.xMm) * parameter,
    yMm:
      segment.start.yMm +
      (segment.end.yMm - segment.start.yMm) * parameter,
  })

  return parameters.some((parameter) =>
    pointIsStrictlyInsideConvexPolygonMm(pointAt(parameter), polygon),
  ) || parameters.slice(0, -1).some((parameter, index) =>
    pointIsStrictlyInsideConvexPolygonMm(
      pointAt((parameter + parameters[index + 1]) / 2),
      polygon,
    ),
  )
}

export function getCropMarkSegmentsMm(
  polygons: readonly (readonly PointMm[])[],
): LineSegmentMm[] {
  const marks = polygons.flatMap((polygon, polygonIndex) =>
    polygon.flatMap((corner, index) => {
      const previous = polygon[(index - 1 + polygon.length) % polygon.length]
      const next = polygon[(index + 1) % polygon.length]
      return [previous, next].flatMap((adjacent) => {
        const directionX = corner.xMm - adjacent.xMm
        const directionY = corner.yMm - adjacent.yMm
        const lengthMm = Math.hypot(directionX, directionY)
        if (lengthMm <= GEOMETRY_EPSILON_MM) return []
        const unitX = directionX / lengthMm
        const unitY = directionY / lengthMm
        const pointAt = (distanceMm: number): PointMm => ({
          xMm: corner.xMm + unitX * distanceMm,
          yMm: corner.yMm + unitY * distanceMm,
        })
        const mark = {
          start: pointAt(CROP_MARK_OFFSET_MM),
          end: pointAt(CROP_MARK_OFFSET_MM + CROP_MARK_LENGTH_MM),
        }
        const conflicts = polygons.some(
          (other, otherIndex) =>
            otherIndex !== polygonIndex &&
            segmentEntersPolygonInteriorMm(mark, other),
        )
        return conflicts ? [] : [mark]
      })
    }),
  )
  return mergeCoincidentSegments(marks)
}

export function createPageCutGuidesMm(
  polygons: readonly (readonly PointMm[])[],
  options: CutGuideOptions,
): PageCutGuidesMm {
  return {
    cutLines: options.cutLines ? getCutLineSegmentsMm(polygons) : [],
    cropMarks: options.cropMarks ? getCropMarkSegmentsMm(polygons) : [],
  }
}
