import { describe, expect, it } from 'vitest'
import {
  findMinimumRotationToFitMm,
  getMinimumPolygonDistanceMm,
  getRotatedBoundingSizeMm,
  getRotatedRectangleCornersMm,
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
})
