const HALF_TURN_RADIANS = Math.PI
const RIGHT_ANGLE_DEGREES = 90
export const GEOMETRY_EPSILON_MM = 1e-7
export const GEOMETRY_EPSILON_MM2 = 1e-7
export const GEOMETRY_ANGLE_EPSILON_DEGREES = 1e-9

export interface SizeMm {
  widthMm: number
  heightMm: number
}

export interface PointMm {
  xMm: number
  yMm: number
}

export interface RectMm extends PointMm, SizeMm {}

export interface RotationFit extends SizeMm {
  rotationDegrees: number
}

export function degreesToRadians(angleDegrees: number): number {
  return (angleDegrees * Math.PI) / 180
}

export function getRotatedBoundingSizeMm(
  widthMm: number,
  heightMm: number,
  rotationDegrees: number,
): SizeMm {
  const angleRadians = degreesToRadians(rotationDegrees)
  const cosine = Math.abs(Math.cos(angleRadians))
  const sine = Math.abs(Math.sin(angleRadians))

  return {
    widthMm: widthMm * cosine + heightMm * sine,
    heightMm: widthMm * sine + heightMm * cosine,
  }
}

export function rotatedSizeFitsMm(
  widthMm: number,
  heightMm: number,
  rotationDegrees: number,
  availableWidthMm: number,
  availableHeightMm: number,
): boolean {
  const bounds = getRotatedBoundingSizeMm(
    widthMm,
    heightMm,
    rotationDegrees,
  )
  return (
    bounds.widthMm <= availableWidthMm + GEOMETRY_EPSILON_MM &&
    bounds.heightMm <= availableHeightMm + GEOMETRY_EPSILON_MM
  )
}

function addAngleIfInRange(
  anglesRadians: number[],
  angleRadians: number,
): void {
  const rightAngleRadians = HALF_TURN_RADIANS / 2
  if (
    angleRadians >= -Number.EPSILON &&
    angleRadians <= rightAngleRadians + Number.EPSILON
  ) {
    anglesRadians.push(Math.min(rightAngleRadians, Math.max(0, angleRadians)))
  }
}

function getFitBoundaryAnglesRadians(
  widthMm: number,
  heightMm: number,
  availableWidthMm: number,
  availableHeightMm: number,
): number[] {
  const diagonalMm = Math.hypot(widthMm, heightMm)
  const stripAngleRadians = Math.atan2(heightMm, widthMm)
  const anglesRadians = [0, HALF_TURN_RADIANS / 2]

  if (availableWidthMm < diagonalMm) {
    const widthRootRadians = Math.acos(availableWidthMm / diagonalMm)
    addAngleIfInRange(
      anglesRadians,
      stripAngleRadians - widthRootRadians,
    )
    addAngleIfInRange(
      anglesRadians,
      stripAngleRadians + widthRootRadians,
    )
  }

  if (availableHeightMm < diagonalMm) {
    const heightRootRadians = Math.asin(availableHeightMm / diagonalMm)
    addAngleIfInRange(
      anglesRadians,
      heightRootRadians - stripAngleRadians,
    )
    addAngleIfInRange(
      anglesRadians,
      HALF_TURN_RADIANS - heightRootRadians - stripAngleRadians,
    )
  }

  return anglesRadians
    .sort((left, right) => left - right)
    .filter(
      (angle, index, sortedAngles) =>
        index === 0 ||
        Math.abs(angle - sortedAngles[index - 1]) >
          degreesToRadians(GEOMETRY_ANGLE_EPSILON_DEGREES),
    )
}

/**
 * Returns the least non-negative rotation that places an unscaled rectangle
 * inside the available rectangle, or undefined when no physical fit exists.
 * Candidate angles are the exact trigonometric boundaries where either
 * rotated bounding dimension meets its available dimension.
 */
export function findMinimumRotationToFitMm(
  widthMm: number,
  heightMm: number,
  availableWidthMm: number,
  availableHeightMm: number,
): RotationFit | undefined {
  if (
    widthMm <= 0 ||
    heightMm <= 0 ||
    availableWidthMm <= 0 ||
    availableHeightMm <= 0
  ) {
    return undefined
  }

  const candidatesRadians = getFitBoundaryAnglesRadians(
    widthMm,
    heightMm,
    availableWidthMm,
    availableHeightMm,
  )

  for (const angleRadians of candidatesRadians) {
    const rotationDegrees = (angleRadians * 180) / Math.PI
    if (
      !rotatedSizeFitsMm(
        widthMm,
        heightMm,
        rotationDegrees,
        availableWidthMm,
        availableHeightMm,
      )
    ) {
      continue
    }

    return {
      rotationDegrees:
        Math.abs(rotationDegrees - RIGHT_ANGLE_DEGREES) <
        GEOMETRY_ANGLE_EPSILON_DEGREES
          ? RIGHT_ANGLE_DEGREES
          : rotationDegrees,
      ...getRotatedBoundingSizeMm(widthMm, heightMm, rotationDegrees),
    }
  }

  return undefined
}

export function getRotationOriginForBoundsMm(
  boundsXmm: number,
  boundsYmm: number,
  heightMm: number,
  rotationDegrees: number,
): PointMm {
  const sine = Math.sin(degreesToRadians(rotationDegrees))
  return {
    xMm: boundsXmm + heightMm * sine,
    yMm: boundsYmm,
  }
}

export function getRotatedRectangleCornersMm(
  widthMm: number,
  heightMm: number,
  rotationDegrees: number,
  origin: PointMm = { xMm: 0, yMm: 0 },
): PointMm[] {
  const angleRadians = degreesToRadians(rotationDegrees)
  const cosine = Math.cos(angleRadians)
  const sine = Math.sin(angleRadians)
  const transform = (xMm: number, yMm: number): PointMm => ({
    xMm: origin.xMm + xMm * cosine - yMm * sine,
    yMm: origin.yMm + xMm * sine + yMm * cosine,
  })

  return [
    transform(0, 0),
    transform(widthMm, 0),
    transform(widthMm, heightMm),
    transform(0, heightMm),
  ]
}

function projectPolygonOntoAxis(
  polygon: readonly PointMm[],
  axisX: number,
  axisY: number,
): { minimum: number; maximum: number } {
  const projections = polygon.map(
    (point) => point.xMm * axisX + point.yMm * axisY,
  )
  return {
    minimum: Math.min(...projections),
    maximum: Math.max(...projections),
  }
}

/** Returns true only for positive-area overlap; shared edges are valid. */
export function polygonsOverlapMm(
  first: readonly PointMm[],
  second: readonly PointMm[],
): boolean {
  if (first.length < 3 || second.length < 3) return false
  const polygons = [first, second]

  for (const polygon of polygons) {
    for (let index = 0; index < polygon.length; index += 1) {
      const start = polygon[index]
      const end = polygon[(index + 1) % polygon.length]
      const edgeX = end.xMm - start.xMm
      const edgeY = end.yMm - start.yMm
      const axisLength = Math.hypot(edgeX, edgeY)
      if (axisLength <= GEOMETRY_EPSILON_MM) continue
      const axisX = -edgeY / axisLength
      const axisY = edgeX / axisLength
      const firstProjection = projectPolygonOntoAxis(first, axisX, axisY)
      const secondProjection = projectPolygonOntoAxis(second, axisX, axisY)
      const overlapMm =
        Math.min(firstProjection.maximum, secondProjection.maximum) -
        Math.max(firstProjection.minimum, secondProjection.minimum)
      if (overlapMm <= GEOMETRY_EPSILON_MM) {
        return false
      }
    }
  }

  return true
}

/**
 * Convex polygon intersection test, including coincident edges and points.
 */
export function polygonsIntersectMm(
  first: readonly PointMm[],
  second: readonly PointMm[],
): boolean {
  if (first.length < 3 || second.length < 3) return false
  for (const polygon of [first, second]) {
    for (let index = 0; index < polygon.length; index += 1) {
      const start = polygon[index]
      const end = polygon[(index + 1) % polygon.length]
      const edgeX = end.xMm - start.xMm
      const edgeY = end.yMm - start.yMm
      const axisLength = Math.hypot(edgeX, edgeY)
      if (axisLength <= GEOMETRY_EPSILON_MM) continue
      const firstProjection = projectPolygonOntoAxis(
        first,
        -edgeY / axisLength,
        edgeX / axisLength,
      )
      const secondProjection = projectPolygonOntoAxis(
        second,
        -edgeY / axisLength,
        edgeX / axisLength,
      )
      if (
        firstProjection.maximum <
          secondProjection.minimum - GEOMETRY_EPSILON_MM ||
        secondProjection.maximum <
          firstProjection.minimum - GEOMETRY_EPSILON_MM
      ) {
        return false
      }
    }
  }
  return true
}

function pointToSegmentDistanceMm(
  point: PointMm,
  start: PointMm,
  end: PointMm,
): number {
  const segmentX = end.xMm - start.xMm
  const segmentY = end.yMm - start.yMm
  const lengthSquared = segmentX * segmentX + segmentY * segmentY
  if (lengthSquared <= Number.EPSILON) {
    return Math.hypot(point.xMm - start.xMm, point.yMm - start.yMm)
  }
  const projection = Math.max(
    0,
    Math.min(
      1,
      ((point.xMm - start.xMm) * segmentX +
        (point.yMm - start.yMm) * segmentY) /
        lengthSquared,
    ),
  )
  return Math.hypot(
    point.xMm - (start.xMm + projection * segmentX),
    point.yMm - (start.yMm + projection * segmentY),
  )
}

export function getMinimumPolygonDistanceMm(
  first: readonly PointMm[],
  second: readonly PointMm[],
): number {
  if (polygonsOverlapMm(first, second)) return 0
  let minimumDistanceMm = Number.POSITIVE_INFINITY

  const measureVerticesToEdges = (
    vertices: readonly PointMm[],
    edges: readonly PointMm[],
  ) => {
    for (const vertex of vertices) {
      for (let index = 0; index < edges.length; index += 1) {
        minimumDistanceMm = Math.min(
          minimumDistanceMm,
          pointToSegmentDistanceMm(
            vertex,
            edges[index],
            edges[(index + 1) % edges.length],
          ),
        )
      }
    }
  }

  measureVerticesToEdges(first, second)
  measureVerticesToEdges(second, first)
  return minimumDistanceMm
}

export function polygonsMaintainGapMm(
  first: readonly PointMm[],
  second: readonly PointMm[],
  minimumGapMm: number,
): boolean {
  if (polygonsOverlapMm(first, second)) return false
  return (
    getMinimumPolygonDistanceMm(first, second) + GEOMETRY_EPSILON_MM >=
    minimumGapMm
  )
}

export function pointIsInsideRectMm(
  point: PointMm,
  rectangle: RectMm,
): boolean {
  return (
    point.xMm >= rectangle.xMm - GEOMETRY_EPSILON_MM &&
    point.xMm <=
      rectangle.xMm + rectangle.widthMm + GEOMETRY_EPSILON_MM &&
    point.yMm >= rectangle.yMm - GEOMETRY_EPSILON_MM &&
    point.yMm <=
      rectangle.yMm + rectangle.heightMm + GEOMETRY_EPSILON_MM
  )
}

export function polygonIsInsideRectMm(
  polygon: readonly PointMm[],
  rectangle: RectMm,
): boolean {
  return (
    polygon.length >= 3 &&
    polygon.every((point) => pointIsInsideRectMm(point, rectangle))
  )
}

export function rectanglesOverlapMm(
  left: RectMm,
  right: RectMm,
  gapMm = 0,
): boolean {
  return !(
    left.xMm + left.widthMm + gapMm <=
      right.xMm + GEOMETRY_EPSILON_MM ||
    right.xMm + right.widthMm + gapMm <=
      left.xMm + GEOMETRY_EPSILON_MM ||
    left.yMm + left.heightMm + gapMm <=
      right.yMm + GEOMETRY_EPSILON_MM ||
    right.yMm + right.heightMm + gapMm <=
      left.yMm + GEOMETRY_EPSILON_MM
  )
}
