import { formatPageDescription, getPageDimensionsMm } from '../config/pages'
import type { LabelProject, LabelStrip } from '../model/project'
import { getStripTotalHeightMm } from './dimensions'
import {
  degreesToRadians,
  findMinimumRotationToFitMm,
  getRotatedBoundingSizeMm,
  getRotatedRectangleCornersMm,
  getRotationOriginForBoundsMm,
  polygonsMaintainGapMm,
  rectanglesOverlapMm,
  rotatedSizeFitsMm,
  type RectMm,
} from './geometry'

export const PDF_MARGIN_MM = 10
export const PDF_NOTICE_RESERVE_MM = 10
export const PDF_STRIP_GAP_MM = 3

const PLACEMENT_TOLERANCE_MM = 1e-8

export interface PdfStripPlacement {
  stripId: string
  pageIndex: number
  /** Bottom-left corner of the rotated axis-aligned bounds. */
  xMm: number
  yMm: number
  /** Original physical strip dimensions. These are never scaled. */
  widthMm: number
  heightMm: number
  rotationDegrees: number
  boundingWidthMm: number
  boundingHeightMm: number
}

export interface PdfPlacementFailure {
  stripId: string
  stripName: string
  stripWidthMm: number
  stripHeightMm: number
  availableWidthMm: number
  availableHeightMm: number
}

export interface PdfLayoutPlan {
  pageWidthMm: number
  pageHeightMm: number
  pageCount: number
  usableArea: RectMm
  placements: PdfStripPlacement[]
}

interface OrientationCandidate {
  rotationDegrees: number
  boundingWidthMm: number
  boundingHeightMm: number
}

interface PageState {
  pageIndex: number
  placements: PdfStripPlacement[]
}

export function getPlacementPolygonMm(
  placement: PdfStripPlacement,
) {
  const origin = getRotationOriginForBoundsMm(
    placement.xMm,
    placement.yMm,
    placement.heightMm,
    placement.rotationDegrees,
  )
  return getRotatedRectangleCornersMm(
    placement.widthMm,
    placement.heightMm,
    placement.rotationDegrees,
    origin,
  )
}

export class PdfPlacementError extends Error {
  readonly failures: PdfPlacementFailure[]

  constructor(project: LabelProject, failures: PdfPlacementFailure[]) {
    const pageDescription = formatPageDescription(
      project.page.size,
      project.page.orientation,
    )
    const details = failures
      .map(
        (failure) =>
          `“${failure.stripName}” (${failure.stripWidthMm} × ${failure.stripHeightMm} mm; usable area ${failure.availableWidthMm} × ${failure.availableHeightMm} mm)`,
      )
      .join(', ')
    super(
      `Cannot place ${details} on ${pageDescription} at its true size, even with automatic rotation. Labels are never scaled.`,
    )
    this.name = 'PdfPlacementError'
    this.failures = failures
  }
}

function getOrientationCandidates(
  strip: LabelStrip,
  usableArea: RectMm,
): OrientationCandidate[] {
  const widthMm = strip.dimensions.widthMm
  const heightMm = getStripTotalHeightMm(strip)
  const candidates: OrientationCandidate[] = []

  if (
    rotatedSizeFitsMm(
      widthMm,
      heightMm,
      0,
      usableArea.widthMm,
      usableArea.heightMm,
    )
  ) {
    candidates.push({
      rotationDegrees: 0,
      boundingWidthMm: widthMm,
      boundingHeightMm: heightMm,
    })
  }

  if (
    rotatedSizeFitsMm(
      widthMm,
      heightMm,
      90,
      usableArea.widthMm,
      usableArea.heightMm,
    )
  ) {
    const verticalBounds = getRotatedBoundingSizeMm(widthMm, heightMm, 90)
    candidates.push({
      rotationDegrees: 90,
      boundingWidthMm: verticalBounds.widthMm,
      boundingHeightMm: verticalBounds.heightMm,
    })
  }

  if (candidates.length === 0) {
    const diagonalFit = findMinimumRotationToFitMm(
      widthMm,
      heightMm,
      usableArea.widthMm,
      usableArea.heightMm,
    )
    if (diagonalFit) {
      candidates.push({
        rotationDegrees: diagonalFit.rotationDegrees,
        boundingWidthMm: diagonalFit.widthMm,
        boundingHeightMm: diagonalFit.heightMm,
      })
    }
  }

  return candidates
}

function uniqueSorted(values: number[], direction: 'ascending' | 'descending') {
  const sorted = [...values].sort((left, right) =>
    direction === 'ascending' ? left - right : right - left,
  )
  return sorted.filter(
    (value, index) =>
      index === 0 || Math.abs(value - sorted[index - 1]) > 1e-8,
  )
}

function tryPlaceOnPage(
  strip: LabelStrip,
  page: PageState,
  usableArea: RectMm,
  orientation: OrientationCandidate,
): PdfStripPlacement | undefined {
  const rightMm = usableArea.xMm + usableArea.widthMm
  const topMm = usableArea.yMm + usableArea.heightMm
  const xCandidates = uniqueSorted(
    [
      usableArea.xMm,
      ...page.placements.map(
        (placement) =>
          placement.xMm + placement.boundingWidthMm + PDF_STRIP_GAP_MM,
      ),
    ],
    'ascending',
  )
  const topCandidates = uniqueSorted(
    [
      topMm,
      ...page.placements.map(
        (placement) => placement.yMm - PDF_STRIP_GAP_MM,
      ),
    ],
    'descending',
  )

  for (const candidateTopMm of topCandidates) {
    const yMm = candidateTopMm - orientation.boundingHeightMm
    if (yMm < usableArea.yMm - PLACEMENT_TOLERANCE_MM) continue

    for (const xMm of xCandidates) {
      if (
        xMm + orientation.boundingWidthMm >
        rightMm + PLACEMENT_TOLERANCE_MM
      ) {
        continue
      }

      const candidate: PdfStripPlacement = {
        stripId: strip.id,
        pageIndex: page.pageIndex,
        xMm,
        yMm,
        widthMm: strip.dimensions.widthMm,
        heightMm: getStripTotalHeightMm(strip),
        rotationDegrees: orientation.rotationDegrees,
        boundingWidthMm: orientation.boundingWidthMm,
        boundingHeightMm: orientation.boundingHeightMm,
      }
      const candidateBounds: RectMm = {
        xMm: candidate.xMm,
        yMm: candidate.yMm,
        widthMm: candidate.boundingWidthMm,
        heightMm: candidate.boundingHeightMm,
      }
      const candidatePolygon = getPlacementPolygonMm(candidate)
      const conflicts = page.placements.some((placement) => {
        const placementBounds: RectMm = {
          xMm: placement.xMm,
          yMm: placement.yMm,
          widthMm: placement.boundingWidthMm,
          heightMm: placement.boundingHeightMm,
        }
        if (
          !rectanglesOverlapMm(
            candidateBounds,
            placementBounds,
            PDF_STRIP_GAP_MM,
          )
        ) {
          return false
        }
        return !polygonsMaintainGapMm(
          candidatePolygon,
          getPlacementPolygonMm(placement),
          PDF_STRIP_GAP_MM,
        )
      })
      if (!conflicts) return candidate
    }
  }

  return undefined
}

function isDiagonalCandidate(orientation: { rotationDegrees: number }): boolean {
  return (
    orientation.rotationDegrees > PLACEMENT_TOLERANCE_MM &&
    orientation.rotationDegrees < 90 - PLACEMENT_TOLERANCE_MM
  )
}

function haveMatchingPhysicalSize(
  first: LabelStrip,
  second: LabelStrip,
): boolean {
  return (
    Math.abs(first.dimensions.widthMm - second.dimensions.widthMm) <=
      PLACEMENT_TOLERANCE_MM &&
    Math.abs(getStripTotalHeightMm(first) - getStripTotalHeightMm(second)) <=
      PLACEMENT_TOLERANCE_MM
  )
}

function placementStaysInsideUsableArea(
  placement: PdfStripPlacement,
  usableArea: RectMm,
): boolean {
  const rightMm = usableArea.xMm + usableArea.widthMm
  const topMm = usableArea.yMm + usableArea.heightMm
  return getPlacementPolygonMm(placement).every(
    (corner) =>
      corner.xMm >= usableArea.xMm - PLACEMENT_TOLERANCE_MM &&
      corner.xMm <= rightMm + PLACEMENT_TOLERANCE_MM &&
      corner.yMm >= usableArea.yMm - PLACEMENT_TOLERANCE_MM &&
      corner.yMm <= topMm + PLACEMENT_TOLERANCE_MM,
  )
}

function createParallelDiagonalPlacements(
  strips: readonly LabelStrip[],
  pageIndex: number,
  usableArea: RectMm,
): PdfStripPlacement[] | undefined {
  const firstStrip = strips[0]
  if (!firstStrip || strips.length < 2) return undefined
  const widthMm = firstStrip.dimensions.widthMm
  const heightMm = getStripTotalHeightMm(firstStrip)

  for (let laneCount = strips.length; laneCount >= 2; laneCount -= 1) {
    const bandHeightMm =
      laneCount * heightMm + (laneCount - 1) * PDF_STRIP_GAP_MM
    const fit = findMinimumRotationToFitMm(
      widthMm,
      bandHeightMm,
      usableArea.widthMm,
      usableArea.heightMm,
    )
    if (!fit || !isDiagonalCandidate(fit)) continue

    const angleRadians = degreesToRadians(fit.rotationDegrees)
    const sine = Math.sin(angleRadians)
    const cosine = Math.cos(angleRadians)
    const bandBoundsXmm = usableArea.xMm
    const bandBoundsYmm =
      usableArea.yMm + usableArea.heightMm - fit.heightMm
    const bandOriginXmm = bandBoundsXmm + bandHeightMm * sine
    const stripBounds = getRotatedBoundingSizeMm(
      widthMm,
      heightMm,
      fit.rotationDegrees,
    )
    const placements = strips.slice(0, laneCount).map((strip, laneIndex) => {
      const laneOffsetMm = laneIndex * (heightMm + PDF_STRIP_GAP_MM)
      const originXmm = bandOriginXmm - laneOffsetMm * sine
      const originYmm = bandBoundsYmm + laneOffsetMm * cosine
      return {
        stripId: strip.id,
        pageIndex,
        xMm: originXmm - heightMm * sine,
        yMm: originYmm,
        widthMm,
        heightMm,
        rotationDegrees: fit.rotationDegrees,
        boundingWidthMm: stripBounds.widthMm,
        boundingHeightMm: stripBounds.heightMm,
      }
    })

    const allInside = placements.every((placement) =>
      placementStaysInsideUsableArea(placement, usableArea),
    )
    const allSeparated = placements.every((placement, index) =>
      placements.slice(index + 1).every((other) =>
        polygonsMaintainGapMm(
          getPlacementPolygonMm(placement),
          getPlacementPolygonMm(other),
          PDF_STRIP_GAP_MM,
        ),
      ),
    )
    if (allInside && allSeparated) return placements
  }

  return undefined
}

export function planPdfLayout(project: LabelProject): PdfLayoutPlan {
  if (project.strips.length === 0)
    throw new Error('Add at least one strip before exporting a PDF.')

  const { widthMm: pageWidthMm, heightMm: pageHeightMm } =
    getPageDimensionsMm(project.page)
  const usableArea: RectMm = {
    xMm: PDF_MARGIN_MM,
    yMm: PDF_MARGIN_MM,
    widthMm: pageWidthMm - PDF_MARGIN_MM * 2,
    heightMm:
      pageHeightMm - PDF_MARGIN_MM * 2 - PDF_NOTICE_RESERVE_MM,
  }
  const orientationsByStrip = new Map(
    project.strips.map((strip) => [
      strip.id,
      getOrientationCandidates(strip, usableArea),
    ]),
  )
  const failures = project.strips
    .filter((strip) => orientationsByStrip.get(strip.id)?.length === 0)
    .map<PdfPlacementFailure>((strip) => ({
      stripId: strip.id,
      stripName: strip.name || 'Unnamed strip',
      stripWidthMm: strip.dimensions.widthMm,
      stripHeightMm: getStripTotalHeightMm(strip),
      availableWidthMm: usableArea.widthMm,
      availableHeightMm: usableArea.heightMm,
    }))

  if (failures.length > 0) throw new PdfPlacementError(project, failures)

  const pages: PageState[] = []
  const placements: PdfStripPlacement[] = []
  const placedStripIds = new Set<string>()

  for (let stripIndex = 0; stripIndex < project.strips.length; stripIndex += 1) {
    const strip = project.strips[stripIndex]
    if (placedStripIds.has(strip.id)) continue
    const orientations = orientationsByStrip.get(strip.id) ?? []
    let placement: PdfStripPlacement | undefined

    // Orientation priority is deterministic: horizontal, vertical, diagonal.
    for (const orientation of orientations) {
      for (const page of pages) {
        placement = tryPlaceOnPage(strip, page, usableArea, orientation)
        if (placement) break
      }
      if (placement) break
    }

    if (!placement) {
      const diagonalOnly =
        orientations.length === 1 && isDiagonalCandidate(orientations[0])
      if (diagonalOnly) {
        const matchingDiagonalStrips = project.strips
          .slice(stripIndex)
          .filter((candidate) => {
            if (placedStripIds.has(candidate.id)) return false
            const candidateOrientations =
              orientationsByStrip.get(candidate.id) ?? []
            return (
              haveMatchingPhysicalSize(strip, candidate) &&
              candidateOrientations.length === 1 &&
              isDiagonalCandidate(candidateOrientations[0])
            )
          })
        const parallelPlacements = createParallelDiagonalPlacements(
          matchingDiagonalStrips,
          pages.length,
          usableArea,
        )
        if (parallelPlacements) {
          pages.push({
            pageIndex: pages.length,
            placements: parallelPlacements,
          })
          placements.push(...parallelPlacements)
          parallelPlacements.forEach((parallelPlacement) =>
            placedStripIds.add(parallelPlacement.stripId),
          )
          continue
        }
      }

      const page: PageState = {
        pageIndex: pages.length,
        placements: [],
      }
      pages.push(page)
      placement = tryPlaceOnPage(strip, page, usableArea, orientations[0])
    }

    if (!placement) {
      throw new Error(`Could not place “${strip.name}” without scaling.`)
    }
    pages[placement.pageIndex].placements.push(placement)
    placements.push(placement)
    placedStripIds.add(placement.stripId)
  }

  return {
    pageWidthMm,
    pageHeightMm,
    pageCount: pages.length,
    usableArea,
    placements,
  }
}

/** Kept as a compatibility alias for callers from Milestone 2. */
export const planSequentialPdfLayout = planPdfLayout
