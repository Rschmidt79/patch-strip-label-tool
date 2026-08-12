import { describe, expect, it } from 'vitest'
import {
  CROP_MARK_LENGTH_MM,
  CROP_MARK_OFFSET_MM,
  createPageCutGuidesMm,
  getCoincidentSegmentOverlapMm,
  getCutLineSegmentsMm,
  getPolygonEdgeSegmentsMm,
  getSharedEdgeSegmentsMm,
  type LineSegmentMm,
} from '../src/lib/cut-guides'
import {
  getRotatedRectangleCornersMm,
  type PointMm,
} from '../src/lib/geometry'

function segmentLengthMm(segment: LineSegmentMm): number {
  return Math.hypot(
    segment.end.xMm - segment.start.xMm,
    segment.end.yMm - segment.start.yMm,
  )
}

function distanceMm(first: PointMm, second: PointMm): number {
  return Math.hypot(first.xMm - second.xMm, first.yMm - second.yMm)
}

describe('cut-guide geometry', () => {
  it('detects a shared edge and emits its cut line only once', () => {
    const first = getRotatedRectangleCornersMm(10, 5, 0)
    const second = getRotatedRectangleCornersMm(10, 5, 0, {
      xMm: 10,
      yMm: 0,
    })

    const shared = getSharedEdgeSegmentsMm([first, second])
    expect(shared).toHaveLength(1)
    expect(segmentLengthMm(shared[0])).toBeCloseTo(5, 10)

    const cutLines = getCutLineSegmentsMm([first, second])
    expect(cutLines).toHaveLength(5)
    const duplicateSharedLines = cutLines.filter((line) =>
      getCoincidentSegmentOverlapMm(line, shared[0]),
    )
    expect(duplicateSharedLines).toHaveLength(1)
    expect(segmentLengthMm(duplicateSharedLines[0])).toBeCloseTo(5, 10)
  })

  it('keeps every exact arbitrarily rotated strip boundary in cut lines', () => {
    const polygon = getRotatedRectangleCornersMm(432, 7.5, 23.25, {
      xMm: 15,
      yMm: 20,
    })
    const cutLines = getCutLineSegmentsMm([polygon])
    const originalEdges = getPolygonEdgeSegmentsMm(polygon)

    expect(cutLines).toHaveLength(4)
    expect(cutLines.map(segmentLengthMm).sort((a, b) => a - b)).toEqual([
      expect.closeTo(7.5, 10),
      expect.closeTo(7.5, 10),
      expect.closeTo(432, 10),
      expect.closeTo(432, 10),
    ])
    for (const edge of originalEdges) {
      const matching = cutLines.find((line) => {
        const overlap = getCoincidentSegmentOverlapMm(edge, line)
        return (
          overlap !== undefined &&
          Math.abs(segmentLengthMm(overlap) - segmentLengthMm(edge)) < 1e-7
        )
      })
      expect(matching).toBeDefined()
    }
  })

  it('generates external crop marks without mutating strip dimensions', () => {
    const polygon = getRotatedRectangleCornersMm(100, 7.5, 31, {
      xMm: 20,
      yMm: 30,
    })
    const before = structuredClone(polygon)
    const guides = createPageCutGuidesMm([polygon], {
      cutLines: false,
      cropMarks: true,
    })

    expect(polygon).toEqual(before)
    expect(guides.cutLines).toEqual([])
    expect(guides.cropMarks).toHaveLength(8)
    for (const mark of guides.cropMarks) {
      expect(segmentLengthMm(mark)).toBeCloseTo(CROP_MARK_LENGTH_MM, 10)
      const nearestCornerDistanceMm = Math.min(
        ...polygon.flatMap((corner) => [
          distanceMm(mark.start, corner),
          distanceMm(mark.end, corner),
        ]),
      )
      expect(nearestCornerDistanceMm).toBeCloseTo(CROP_MARK_OFFSET_MM, 10)
    }
  })
})
