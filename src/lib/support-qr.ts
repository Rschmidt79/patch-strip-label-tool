import {
  getPlacementPolygonMm,
  type PdfStripPlacement,
} from './pdf-layout'
import {
  getRotatedRectangleCornersMm,
  polygonsMaintainGapMm,
  type PointMm,
  type RectMm,
} from './geometry'

export const SUPPORT_QR_LABEL_LINE_1 =
  'Rack Label Maker is free to use.'
export const SUPPORT_QR_LABEL_LINE_2 =
  'Your support helps keep it alive.'
export const SUPPORT_QR_BOX_SIZE_MM = 20
export const SUPPORT_QR_IMAGE_INSET_MM = 1
export const SUPPORT_QR_CLEARANCE_MM = 2

const SUPPORT_QR_EDGE_MARGIN_MM = 5
const SUPPORT_QR_TEXT_WIDTH_MM = 48
const SUPPORT_QR_TEXT_GAP_MM = 3

export interface SupportQrDecorationGeometryMm {
  xMm: number
  yMm: number
  widthMm: number
  heightMm: number
  imageXmm: number
  imageYmm: number
  imageSizeMm: number
  textRightXmm: number
  textWidthMm: number
  boundsXmm: number
  boundsYmm: number
  boundsWidthMm: number
  boundsHeightMm: number
  reservedAreaMm: RectMm
}

/**
 * Returns the fixed bottom-right support decoration and the slightly larger
 * print-only area which packing must keep clear.
 */
export function getSupportQrDecorationGeometryMm(
  pageWidthMm: number,
  pageHeightMm: number,
): SupportQrDecorationGeometryMm | undefined {
  const xMm =
    pageWidthMm - SUPPORT_QR_EDGE_MARGIN_MM - SUPPORT_QR_BOX_SIZE_MM
  const yMm = SUPPORT_QR_EDGE_MARGIN_MM
  const textLeftMm =
    xMm - SUPPORT_QR_TEXT_GAP_MM - SUPPORT_QR_TEXT_WIDTH_MM
  const boundsWidthMm =
    xMm + SUPPORT_QR_BOX_SIZE_MM - textLeftMm

  if (
    xMm < SUPPORT_QR_EDGE_MARGIN_MM ||
    textLeftMm < SUPPORT_QR_EDGE_MARGIN_MM ||
    yMm + SUPPORT_QR_BOX_SIZE_MM >
      pageHeightMm - SUPPORT_QR_EDGE_MARGIN_MM
  ) {
    return undefined
  }

  return {
    xMm,
    yMm,
    widthMm: SUPPORT_QR_BOX_SIZE_MM,
    heightMm: SUPPORT_QR_BOX_SIZE_MM,
    imageXmm: xMm + SUPPORT_QR_IMAGE_INSET_MM,
    imageYmm: yMm + SUPPORT_QR_IMAGE_INSET_MM,
    imageSizeMm:
      SUPPORT_QR_BOX_SIZE_MM - SUPPORT_QR_IMAGE_INSET_MM * 2,
    textRightXmm: xMm - SUPPORT_QR_TEXT_GAP_MM,
    textWidthMm: SUPPORT_QR_TEXT_WIDTH_MM,
    boundsXmm: textLeftMm,
    boundsYmm: yMm,
    boundsWidthMm,
    boundsHeightMm: SUPPORT_QR_BOX_SIZE_MM,
    reservedAreaMm: {
      xMm: textLeftMm - SUPPORT_QR_CLEARANCE_MM,
      yMm: yMm - SUPPORT_QR_CLEARANCE_MM,
      widthMm: boundsWidthMm + SUPPORT_QR_CLEARANCE_MM * 2,
      heightMm: SUPPORT_QR_BOX_SIZE_MM + SUPPORT_QR_CLEARANCE_MM * 2,
    },
  }
}

export function getSupportQrDecorationPolygonMm(
  geometry: SupportQrDecorationGeometryMm,
): PointMm[] {
  return getRotatedRectangleCornersMm(
    geometry.boundsWidthMm,
    geometry.boundsHeightMm,
    0,
    { xMm: geometry.boundsXmm, yMm: geometry.boundsYmm },
  )
}

export function getSupportQrReservedAreaPolygonMm(
  geometry: SupportQrDecorationGeometryMm,
): PointMm[] {
  const area = geometry.reservedAreaMm
  return getRotatedRectangleCornersMm(
    area.widthMm,
    area.heightMm,
    0,
    { xMm: area.xMm, yMm: area.yMm },
  )
}

export function isSupportQrDecorationSafe(
  geometry: SupportQrDecorationGeometryMm,
  placements: readonly PdfStripPlacement[],
): boolean {
  const reservedPolygon = getSupportQrReservedAreaPolygonMm(geometry)
  return placements.every((placement) =>
    polygonsMaintainGapMm(
      reservedPolygon,
      getPlacementPolygonMm(placement),
      0,
    ),
  )
}

/** Compatibility helper for callers which already have placements. */
export function getSafeSupportQrDecorationGeometryMm(
  pageWidthMm: number,
  pageHeightMm: number,
  placements: readonly PdfStripPlacement[],
): SupportQrDecorationGeometryMm | undefined {
  const geometry = getSupportQrDecorationGeometryMm(
    pageWidthMm,
    pageHeightMm,
  )
  return geometry && isSupportQrDecorationSafe(geometry, placements)
    ? geometry
    : undefined
}
