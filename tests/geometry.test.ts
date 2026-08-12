import { describe, expect, it } from 'vitest'
import {
  findMinimumRotationToFitMm,
  GEOMETRY_EPSILON_MM,
  getMinimumPolygonDistanceMm,
  getRotatedBoundingSizeMm,
  getRotatedRectangleCornersMm,
  pointIsInsideRectMm,
  polygonIsInsideRectMm,
  polygonsIntersectMm,
  polygonsMaintainGapMm,
  polygonsOverlapMm,
  rotatedSizeFitsMm,
} from '../src/lib/geometry'

describe('rotated rectangle geometry', () => {
  it('calculates the axis-aligned bounds of a rotated rectangle', () => {
    const bounds = getRotatedBoundingSizeMm(100, 20, 30)
    expect(bounds.widthMm).toBeCloseTo(96.60254037844388, 12)
    expect(bounds.heightMm).toBeCloseTo(67.32050807568876, 12)
  })

  it('finds the least diagonal rotation for a 432 mm strip in A3 usable space', () => {
    const fit = findMinimumRotationToFitMm(432, 7.5, 400, 267)
    expect(fit).toBeDefined()
    expect(fit?.rotationDegrees).toBeGreaterThan(0)
    expect(fit?.rotationDegrees).toBeLessThan(90)
    expect(fit?.widthMm).toBeCloseTo(400, 8)
    expect(fit?.heightMm).toBeLessThanOrEqual(267 + 1e-8)

    const justBelow = (fit?.rotationDegrees ?? 0) - 0.000001
    expect(rotatedSizeFitsMm(432, 7.5, justBelow, 400, 267)).toBe(false)
  })

  it('returns no fit for an impossible oversized rectangle', () => {
    expect(findMinimumRotationToFitMm(1000, 1000, 400, 267)).toBeUndefined()
  })

  it('measures the real gap between parallel rotated rectangles', () => {
    const angleDegrees = 25
    const angleRadians = (angleDegrees * Math.PI) / 180
    const first = getRotatedRectangleCornersMm(432, 7.5, angleDegrees)
    const laneDistanceMm = 7.5 + 3
    const second = getRotatedRectangleCornersMm(432, 7.5, angleDegrees, {
      xMm: -Math.sin(angleRadians) * laneDistanceMm,
      yMm: Math.cos(angleRadians) * laneDistanceMm,
    })

    expect(polygonsOverlapMm(first, second)).toBe(false)
    expect(getMinimumPolygonDistanceMm(first, second)).toBeCloseTo(3, 10)
    expect(polygonsMaintainGapMm(first, second, 3)).toBe(true)
    expect(polygonsMaintainGapMm(first, second, 3.01)).toBe(false)
  })

  it('distinguishes oriented polygons whose bounding boxes overlap', () => {
    const angleDegrees = 25
    const angleRadians = (angleDegrees * Math.PI) / 180
    const first = getRotatedRectangleCornersMm(100, 7.5, angleDegrees)
    const second = getRotatedRectangleCornersMm(100, 7.5, angleDegrees, {
      xMm: -Math.sin(angleRadians) * 12.5,
      yMm: Math.cos(angleRadians) * 12.5,
    })

    expect(polygonsIntersectMm(first, second)).toBe(false)
    expect(getMinimumPolygonDistanceMm(first, second)).toBeCloseTo(5, 10)
  })

  it('checks points and complete polygons against a page rectangle', () => {
    const page = { xMm: 10, yMm: 10, widthMm: 100, heightMm: 80 }
    const insidePolygon = getRotatedRectangleCornersMm(40, 8, 20, {
      xMm: 30,
      yMm: 25,
    })
    const outsidePolygon = getRotatedRectangleCornersMm(100, 8, 20, {
      xMm: 30,
      yMm: 25,
    })

    expect(pointIsInsideRectMm({ xMm: 10, yMm: 90 }, page)).toBe(true)
    expect(pointIsInsideRectMm({ xMm: 9.9, yMm: 90 }, page)).toBe(false)
    expect(polygonIsInsideRectMm(insidePolygon, page)).toBe(true)
    expect(polygonIsInsideRectMm(outsidePolygon, page)).toBe(false)
  })

  it('allows shared edges at zero gap but rejects geometric overlap', () => {
    const first = getRotatedRectangleCornersMm(10, 5, 17)
    const angleRadians = (17 * Math.PI) / 180
    const atAlongAxis = (distanceMm: number) => ({
      xMm: Math.cos(angleRadians) * distanceMm,
      yMm: Math.sin(angleRadians) * distanceMm,
    })
    const touching = getRotatedRectangleCornersMm(
      10,
      5,
      17,
      atAlongAxis(10),
    )
    const overlapping = getRotatedRectangleCornersMm(
      10,
      5,
      17,
      atAlongAxis(9.9),
    )

    expect(polygonsIntersectMm(first, touching)).toBe(true)
    expect(polygonsOverlapMm(first, touching)).toBe(false)
    expect(polygonsMaintainGapMm(first, touching, 0)).toBe(true)
    expect(polygonsOverlapMm(first, overlapping)).toBe(true)
    expect(polygonsMaintainGapMm(first, overlapping, 0)).toBe(false)
  })

  it('uses the centralized tolerance around a touching edge', () => {
    const first = getRotatedRectangleCornersMm(10, 5, 0)
    const withinTolerance = getRotatedRectangleCornersMm(10, 5, 0, {
      xMm: 10 - GEOMETRY_EPSILON_MM / 2,
      yMm: 0,
    })
    const beyondTolerance = getRotatedRectangleCornersMm(10, 5, 0, {
      xMm: 10 - GEOMETRY_EPSILON_MM * 2,
      yMm: 0,
    })

    expect(polygonsOverlapMm(first, withinTolerance)).toBe(false)
    expect(polygonsMaintainGapMm(first, withinTolerance, 0)).toBe(true)
    expect(polygonsOverlapMm(first, beyondTolerance)).toBe(true)
    expect(polygonsMaintainGapMm(first, beyondTolerance, 0)).toBe(false)
  })
})
