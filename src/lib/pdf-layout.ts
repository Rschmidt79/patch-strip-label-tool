import { formatPageDescription, getPageDimensionsMm } from '../config/pages'
import type {
  LabelProject,
  LabelStrip,
  PageSettings,
} from '../model/project'
import { getTotalSharedEdgeLengthMm } from './cut-guides'
import { getStripTotalHeightMm } from './dimensions'
import {
  degreesToRadians,
  findMinimumRotationToFitMm,
  GEOMETRY_ANGLE_EPSILON_DEGREES,
  GEOMETRY_EPSILON_MM,
  GEOMETRY_EPSILON_MM2,
  getRotatedBoundingSizeMm,
  getRotatedRectangleCornersMm,
  getRotationOriginForBoundsMm,
  polygonIsInsideRectMm,
  polygonsMaintainGapMm,
  rectanglesOverlapMm,
  rotatedSizeFitsMm,
  type RectMm,
} from './geometry'

export const PDF_MARGIN_MM = 10
export const PDF_NOTICE_RESERVE_MM = 10
export const DEFAULT_PDF_STRIP_GAP_MM = 0
/** Compatibility name for callers that use the default gap. */
export const PDF_STRIP_GAP_MM = DEFAULT_PDF_STRIP_GAP_MM

const DIAGONAL_ANGLE_STEP_DEGREES = 0.5
const STAGGER_OFFSET_SAMPLE_COUNT = 4

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
  stripGapMm: number
  usableArea: RectMm
  placements: PdfStripPlacement[]
}

export interface PdfLayoutOptions {
  page?: PageSettings
  autoArrange?: boolean
  /** Required physical edge-to-edge clearance. Defaults to 0 mm. */
  stripGapMm?: number
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

interface AxisIntervalMm {
  minimumMm: number
  maximumMm: number
}

interface StaggeredLayoutScore {
  fittedCount: number
  wastedEnvelopeAreaMm2: number
  sharedEdgeLengthMm: number
  hasUsefulStagger: boolean
  staggerExtentMm: number
  staggerVarianceMm2: number
  rotationDegrees: number
  candidateOrder: number
}

interface StaggeredLayoutCandidate {
  placements: PdfStripPlacement[]
  score: StaggeredLayoutScore
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

  constructor(
    pageSettings: PageSettings,
    failures: PdfPlacementFailure[],
  ) {
    const pageDescription = formatPageDescription(
      pageSettings.size,
      pageSettings.orientation,
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
      index === 0 ||
      Math.abs(value - sorted[index - 1]) > GEOMETRY_EPSILON_MM,
  )
}

function tryPlaceOnPage(
  strip: LabelStrip,
  page: PageState,
  usableArea: RectMm,
  orientation: OrientationCandidate,
  stripGapMm: number,
): PdfStripPlacement | undefined {
  const rightMm = usableArea.xMm + usableArea.widthMm
  const topMm = usableArea.yMm + usableArea.heightMm
  const xCandidates = uniqueSorted(
    [
      usableArea.xMm,
      ...page.placements.map(
        (placement) =>
          placement.xMm + placement.boundingWidthMm + stripGapMm,
      ),
    ],
    'ascending',
  )
  const topCandidates = uniqueSorted(
    [
      topMm,
      ...page.placements.map(
        (placement) => placement.yMm - stripGapMm,
      ),
    ],
    'descending',
  )

  for (const candidateTopMm of topCandidates) {
    const yMm = candidateTopMm - orientation.boundingHeightMm
    if (yMm < usableArea.yMm - GEOMETRY_EPSILON_MM) continue

    for (const xMm of xCandidates) {
      if (
        xMm + orientation.boundingWidthMm >
        rightMm + GEOMETRY_EPSILON_MM
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
            stripGapMm,
          )
        ) {
          return false
        }
        return !polygonsMaintainGapMm(
          candidatePolygon,
          getPlacementPolygonMm(placement),
          stripGapMm,
        )
      })
      if (!conflicts) return candidate
    }
  }

  return undefined
}

function isDiagonalCandidate(orientation: { rotationDegrees: number }): boolean {
  return (
    orientation.rotationDegrees > GEOMETRY_ANGLE_EPSILON_DEGREES &&
    orientation.rotationDegrees < 90 - GEOMETRY_ANGLE_EPSILON_DEGREES
  )
}

function haveMatchingPhysicalSize(
  first: LabelStrip,
  second: LabelStrip,
): boolean {
  return (
    Math.abs(first.dimensions.widthMm - second.dimensions.widthMm) <=
      GEOMETRY_EPSILON_MM &&
    Math.abs(getStripTotalHeightMm(first) - getStripTotalHeightMm(second)) <=
      GEOMETRY_EPSILON_MM
  )
}

function placementStaysInsideUsableArea(
  placement: PdfStripPlacement,
  usableArea: RectMm,
): boolean {
  return polygonIsInsideRectMm(getPlacementPolygonMm(placement), usableArea)
}

function getDiagonalRotationCandidates(
  widthMm: number,
  heightMm: number,
  usableArea: RectMm,
): number[] {
  const minimumFit = findMinimumRotationToFitMm(
    widthMm,
    heightMm,
    usableArea.widthMm,
    usableArea.heightMm,
  )
  if (!minimumFit || !isDiagonalCandidate(minimumFit)) return []

  const candidates = [minimumFit.rotationDegrees]
  const firstSampleDegrees =
    Math.ceil(
      minimumFit.rotationDegrees / DIAGONAL_ANGLE_STEP_DEGREES,
    ) * DIAGONAL_ANGLE_STEP_DEGREES
  for (
    let rotationDegrees = firstSampleDegrees;
    rotationDegrees < 90;
    rotationDegrees += DIAGONAL_ANGLE_STEP_DEGREES
  ) {
    if (
      isDiagonalCandidate({ rotationDegrees }) &&
      rotatedSizeFitsMm(
        widthMm,
        heightMm,
        rotationDegrees,
        usableArea.widthMm,
        usableArea.heightMm,
      )
    ) {
      candidates.push(rotationDegrees)
    }
  }

  return uniqueSorted(candidates, 'ascending')
}

/**
 * Returns the range of origins along the rectangle's local normal axis for
 * which the complete rotated rectangle can remain inside the page rectangle.
 */
function getFeasibleNormalOriginRangeMm(
  widthMm: number,
  heightMm: number,
  rotationDegrees: number,
  usableArea: RectMm,
): AxisIntervalMm | undefined {
  const angleRadians = degreesToRadians(rotationDegrees)
  const cosine = Math.cos(angleRadians)
  const sine = Math.sin(angleRadians)
  const leftMm = usableArea.xMm
  const rightMm = leftMm + usableArea.widthMm
  const bottomMm = usableArea.yMm
  const topMm = bottomMm + usableArea.heightMm
  const minimumMm =
    cosine * bottomMm -
    sine * rightMm +
    widthMm * sine * cosine
  const maximumMm =
    cosine * topMm -
    sine * leftMm -
    heightMm -
    widthMm * sine * cosine

  if (maximumMm < minimumMm - GEOMETRY_EPSILON_MM) return undefined
  return { minimumMm, maximumMm }
}

function getFeasibleAlongOriginRangeMm(
  widthMm: number,
  heightMm: number,
  rotationDegrees: number,
  normalOriginMm: number,
  usableArea: RectMm,
): AxisIntervalMm | undefined {
  const angleRadians = degreesToRadians(rotationDegrees)
  const cosine = Math.cos(angleRadians)
  const sine = Math.sin(angleRadians)
  const leftMm = usableArea.xMm
  const rightMm = leftMm + usableArea.widthMm
  const bottomMm = usableArea.yMm
  const topMm = bottomMm + usableArea.heightMm
  const minimumMm = Math.max(
    (leftMm + (normalOriginMm + heightMm) * sine) / cosine,
    (bottomMm - normalOriginMm * cosine) / sine,
  )
  const maximumMm = Math.min(
    (rightMm + normalOriginMm * sine) / cosine - widthMm,
    (topMm - (normalOriginMm + heightMm) * cosine) / sine - widthMm,
  )

  if (maximumMm < minimumMm - GEOMETRY_EPSILON_MM) return undefined
  return { minimumMm, maximumMm }
}

function createPlacementFromLocalAxes(
  strip: LabelStrip,
  pageIndex: number,
  rotationDegrees: number,
  alongOriginMm: number,
  normalOriginMm: number,
): PdfStripPlacement {
  const widthMm = strip.dimensions.widthMm
  const heightMm = getStripTotalHeightMm(strip)
  const angleRadians = degreesToRadians(rotationDegrees)
  const cosine = Math.cos(angleRadians)
  const sine = Math.sin(angleRadians)
  const originXmm = alongOriginMm * cosine - normalOriginMm * sine
  const originYmm = alongOriginMm * sine + normalOriginMm * cosine
  const bounds = getRotatedBoundingSizeMm(
    widthMm,
    heightMm,
    rotationDegrees,
  )

  return {
    stripId: strip.id,
    pageIndex,
    xMm: originXmm - heightMm * sine,
    yMm: originYmm,
    widthMm,
    heightMm,
    rotationDegrees,
    boundingWidthMm: bounds.widthMm,
    boundingHeightMm: bounds.heightMm,
  }
}

function placementsAreValid(
  placements: readonly PdfStripPlacement[],
  usableArea: RectMm,
  stripGapMm: number,
): boolean {
  const polygons = placements.map(getPlacementPolygonMm)
  if (
    !placements.every((placement) =>
      placementStaysInsideUsableArea(placement, usableArea),
    )
  ) {
    return false
  }

  return polygons.every((polygon, index) =>
    polygons.slice(index + 1).every((other) =>
      polygonsMaintainGapMm(polygon, other, stripGapMm),
    ),
  )
}

function getOccupiedBoundsAreaMm2(
  placements: readonly PdfStripPlacement[],
): number {
  const points = placements.flatMap(getPlacementPolygonMm)
  if (points.length === 0) return 0
  const xValues = points.map((point) => point.xMm)
  const yValues = points.map((point) => point.yMm)
  return (
    (Math.max(...xValues) - Math.min(...xValues)) *
    (Math.max(...yValues) - Math.min(...yValues))
  )
}

function isBetterStaggeredLayout(
  candidate: StaggeredLayoutScore,
  current: StaggeredLayoutScore | undefined,
): boolean {
  if (!current) return true
  if (candidate.fittedCount !== current.fittedCount) {
    return candidate.fittedCount > current.fittedCount
  }
  const eitherLayoutSharesCuts =
    candidate.sharedEdgeLengthMm > GEOMETRY_EPSILON_MM ||
    current.sharedEdgeLengthMm > GEOMETRY_EPSILON_MM
  if (eitherLayoutSharesCuts) {
    if (
      Math.abs(
        candidate.wastedEnvelopeAreaMm2 - current.wastedEnvelopeAreaMm2,
      ) > GEOMETRY_EPSILON_MM2
    ) {
      return candidate.wastedEnvelopeAreaMm2 < current.wastedEnvelopeAreaMm2
    }
    if (
      Math.abs(candidate.sharedEdgeLengthMm - current.sharedEdgeLengthMm) >
      GEOMETRY_EPSILON_MM
    ) {
      return candidate.sharedEdgeLengthMm > current.sharedEdgeLengthMm
    }
  } else {
    if (candidate.hasUsefulStagger !== current.hasUsefulStagger) {
      return candidate.hasUsefulStagger
    }
    if (
      Math.abs(
        candidate.wastedEnvelopeAreaMm2 - current.wastedEnvelopeAreaMm2,
      ) > GEOMETRY_EPSILON_MM2
    ) {
      return candidate.wastedEnvelopeAreaMm2 < current.wastedEnvelopeAreaMm2
    }
  }
  if (
    Math.abs(candidate.staggerExtentMm - current.staggerExtentMm) >
    GEOMETRY_EPSILON_MM
  ) {
    return candidate.staggerExtentMm > current.staggerExtentMm
  }
  if (
    Math.abs(candidate.staggerVarianceMm2 - current.staggerVarianceMm2) >
    GEOMETRY_EPSILON_MM2
  ) {
    return candidate.staggerVarianceMm2 > current.staggerVarianceMm2
  }
  if (
    Math.abs(candidate.rotationDegrees - current.rotationDegrees) >
    GEOMETRY_ANGLE_EPSILON_DEGREES
  ) {
    return candidate.rotationDegrees < current.rotationDegrees
  }
  return candidate.candidateOrder < current.candidateOrder
}

type AlongAxisAlignment = 'minimum' | 'center' | 'maximum' | 'alternating'

function getAlongOriginMm(
  interval: AxisIntervalMm,
  alignment: AlongAxisAlignment,
  laneIndex: number,
): number {
  if (alignment === 'minimum') return interval.minimumMm
  if (alignment === 'maximum') return interval.maximumMm
  if (alignment === 'alternating') {
    return laneIndex % 2 === 0 ? interval.minimumMm : interval.maximumMm
  }
  return (interval.minimumMm + interval.maximumMm) / 2
}

/**
 * Heuristic diagonal page packer for matching physical strips. It samples
 * rotation angles and lane offsets in the strip's local coordinate system.
 * Each lane independently chooses an along-axis origin, which permits the
 * staggered placements that conservative rotated bounding boxes reject.
 */
function createBestStaggeredDiagonalPlacements(
  strips: readonly LabelStrip[],
  pageIndex: number,
  usableArea: RectMm,
  stripGapMm: number,
): PdfStripPlacement[] | undefined {
  const firstStrip = strips[0]
  if (!firstStrip || strips.length < 2) return undefined
  const widthMm = firstStrip.dimensions.widthMm
  const heightMm = getStripTotalHeightMm(firstStrip)
  const lanePitchMm = heightMm + stripGapMm
  const rotations = getDiagonalRotationCandidates(
    widthMm,
    heightMm,
    usableArea,
  )
  const alignments: AlongAxisAlignment[] = [
    'minimum',
    'center',
    'maximum',
    'alternating',
  ]
  let best: StaggeredLayoutCandidate | undefined
  let candidateOrder = 0

  for (const rotationDegrees of rotations) {
    const normalRange = getFeasibleNormalOriginRangeMm(
      widthMm,
      heightMm,
      rotationDegrees,
      usableArea,
    )
    if (!normalRange) continue
    const normalSpanMm = normalRange.maximumMm - normalRange.minimumMm
    const laneCount = Math.min(
      strips.length,
      Math.floor(
        (normalSpanMm + GEOMETRY_EPSILON_MM) / lanePitchMm,
      ) + 1,
    )
    if (laneCount < 2) continue
    const offsetSlackMm = Math.max(
      0,
      normalSpanMm - (laneCount - 1) * lanePitchMm,
    )
    const offsetFractions = Array.from(
      { length: STAGGER_OFFSET_SAMPLE_COUNT + 1 },
      (_, index) => index / STAGGER_OFFSET_SAMPLE_COUNT,
    )

    for (const offsetFraction of offsetFractions) {
      const normalStartMm =
        normalRange.minimumMm + offsetSlackMm * offsetFraction
      const alongRanges = Array.from({ length: laneCount }, (_, laneIndex) =>
        getFeasibleAlongOriginRangeMm(
          widthMm,
          heightMm,
          rotationDegrees,
          normalStartMm + laneIndex * lanePitchMm,
          usableArea,
        ),
      )
      if (alongRanges.some((interval) => !interval)) continue

      for (const alignment of alignments) {
        const slots = alongRanges.map((interval, laneIndex) => {
          if (!interval) throw new Error('Expected a feasible lane interval.')
          return {
            alongOriginMm: getAlongOriginMm(
              interval,
              alignment,
              laneIndex,
            ),
            normalOriginMm: normalStartMm + laneIndex * lanePitchMm,
          }
        })
        const sortedSlots = slots.sort((left, right) => {
          const leftPlacement = createPlacementFromLocalAxes(
            firstStrip,
            pageIndex,
            rotationDegrees,
            left.alongOriginMm,
            left.normalOriginMm,
          )
          const rightPlacement = createPlacementFromLocalAxes(
            firstStrip,
            pageIndex,
            rotationDegrees,
            right.alongOriginMm,
            right.normalOriginMm,
          )
          const topDifference =
            rightPlacement.yMm + rightPlacement.boundingHeightMm -
            (leftPlacement.yMm + leftPlacement.boundingHeightMm)
          return Math.abs(topDifference) > GEOMETRY_EPSILON_MM
            ? topDifference
            : leftPlacement.xMm - rightPlacement.xMm
        })
        const placements = strips
          .slice(0, laneCount)
          .map((strip, index) => {
            const slot = sortedSlots[index]
            return createPlacementFromLocalAxes(
              strip,
              pageIndex,
              rotationDegrees,
              slot.alongOriginMm,
              slot.normalOriginMm,
            )
          })
        candidateOrder += 1
        if (!placementsAreValid(placements, usableArea, stripGapMm)) continue

        const xPositionsMm = placements.map((placement) => placement.xMm)
        const meanXmm =
          xPositionsMm.reduce((total, value) => total + value, 0) /
          xPositionsMm.length
        const occupiedBoundsAreaMm2 = getOccupiedBoundsAreaMm2(placements)
        const placementPolygons = placements.map(getPlacementPolygonMm)
        const score: StaggeredLayoutScore = {
          fittedCount: placements.length,
          wastedEnvelopeAreaMm2:
            occupiedBoundsAreaMm2 -
            placements.length * widthMm * heightMm,
          sharedEdgeLengthMm:
            stripGapMm <= GEOMETRY_EPSILON_MM
              ? getTotalSharedEdgeLengthMm(placementPolygons)
              : 0,
          hasUsefulStagger:
            Math.max(...xPositionsMm) - Math.min(...xPositionsMm) >= 0.25,
          staggerExtentMm:
            Math.max(...xPositionsMm) - Math.min(...xPositionsMm),
          staggerVarianceMm2:
            xPositionsMm.reduce(
              (total, value) => total + (value - meanXmm) ** 2,
              0,
            ) / xPositionsMm.length,
          rotationDegrees,
          candidateOrder,
        }
        if (isBetterStaggeredLayout(score, best?.score)) {
          best = { placements, score }
        }
      }
    }
  }

  return best?.placements
}

export function planPdfLayout(
  project: LabelProject,
  options: PdfLayoutOptions = {},
): PdfLayoutPlan {
  if (project.strips.length === 0)
    throw new Error('Add at least one strip before exporting a PDF.')
  const pageSettings = options.page ?? project.page
  const autoArrange = options.autoArrange ?? true
  const stripGapMm = options.stripGapMm ?? DEFAULT_PDF_STRIP_GAP_MM
  if (!Number.isFinite(stripGapMm) || stripGapMm < 0) {
    throw new RangeError('Strip gap must be a non-negative number in mm.')
  }

  const { widthMm: pageWidthMm, heightMm: pageHeightMm } =
    getPageDimensionsMm(pageSettings)
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

  if (failures.length > 0) {
    throw new PdfPlacementError(pageSettings, failures)
  }

  const pages: PageState[] = []
  const placements: PdfStripPlacement[] = []
  const placedStripIds = new Set<string>()

  for (let stripIndex = 0; stripIndex < project.strips.length; stripIndex += 1) {
    const strip = project.strips[stripIndex]
    if (placedStripIds.has(strip.id)) continue
    const orientations = orientationsByStrip.get(strip.id) ?? []
    let placement: PdfStripPlacement | undefined

    // Orientation priority is deterministic: horizontal, vertical, diagonal.
    if (autoArrange) {
      for (const orientation of orientations) {
        for (const page of pages) {
          placement = tryPlaceOnPage(
            strip,
            page,
            usableArea,
            orientation,
            stripGapMm,
          )
          if (placement) break
        }
        if (placement) break
      }
    }

    if (!placement) {
      const diagonalOnly =
        orientations.length === 1 && isDiagonalCandidate(orientations[0])
      if (autoArrange && diagonalOnly) {
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
        const staggeredPlacements = createBestStaggeredDiagonalPlacements(
          matchingDiagonalStrips,
          pages.length,
          usableArea,
          stripGapMm,
        )
        if (staggeredPlacements) {
          pages.push({
            pageIndex: pages.length,
            placements: staggeredPlacements,
          })
          placements.push(...staggeredPlacements)
          staggeredPlacements.forEach((staggeredPlacement) =>
            placedStripIds.add(staggeredPlacement.stripId),
          )
          continue
        }
      }

      const page: PageState = {
        pageIndex: pages.length,
        placements: [],
      }
      pages.push(page)
      placement = tryPlaceOnPage(
        strip,
        page,
        usableArea,
        orientations[0],
        stripGapMm,
      )
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
    stripGapMm,
    usableArea,
    placements,
  }
}

/** Kept as a compatibility alias for callers from Milestone 2. */
export const planSequentialPdfLayout = planPdfLayout
