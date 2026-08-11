import {
  getPlacementPolygonMm,
  type PdfStripPlacement,
} from './pdf-layout'
import {
  getRotatedRectangleCornersMm,
  polygonsMaintainGapMm,
  type PointMm,
} from './geometry'

export const SUPPORT_QR_LABEL_LINE_1 = 'Like the tool?'
export const SUPPORT_QR_LABEL_LINE_2 = 'Buy me a coffee'
export const SUPPORT_QR_BOX_SIZE_MM = 13
export const SUPPORT_QR_IMAGE_INSET_MM = 1
export const SUPPORT_QR_CLEARANCE_MM = 2

const SUPPORT_QR_EDGE_MARGIN_MM = 5
const SUPPORT_QR_TEXT_WIDTH_MM = 36
const SUPPORT_QR_TEXT_GAP_MM = 2

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
}

/**
 * Returns the fixed bottom-right page-decoration candidate. This geometry is
 * evaluated only after strip packing, so it can never move or scale labels.
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
    boundsWidthMm:
      xMm + SUPPORT_QR_BOX_SIZE_MM - textLeftMm,
    boundsHeightMm: SUPPORT_QR_BOX_SIZE_MM,
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

export function isSupportQrDecorationSafe(
  geometry: SupportQrDecorationGeometryMm,
  placements: readonly PdfStripPlacement[],
): boolean {
  const decorationPolygon = getSupportQrDecorationPolygonMm(geometry)
  return placements.every((placement) =>
    polygonsMaintainGapMm(
      decorationPolygon,
      getPlacementPolygonMm(placement),
      SUPPORT_QR_CLEARANCE_MM,
    ),
  )
}

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
