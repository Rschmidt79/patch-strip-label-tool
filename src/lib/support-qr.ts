import { SUPPORT_URL } from '../config/app-info'
import { PDF_MARGIN_MM, PDF_NOTICE_RESERVE_MM } from './pdf-layout'

export const SUPPORT_QR_DISPLAY_URL = SUPPORT_URL.replace(/^https?:\/\//, '')
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
}

/**
 * Returns a decoration box wholly above the label-usable page area. The
 * placement planner never consumes this geometry, so labels cannot move or
 * scale when the decoration is enabled.
 */
export function getSupportQrDecorationGeometryMm(
  pageWidthMm: number,
  pageHeightMm: number,
): SupportQrDecorationGeometryMm | undefined {
  const xMm =
    pageWidthMm - SUPPORT_QR_EDGE_MARGIN_MM - SUPPORT_QR_BOX_SIZE_MM
  const yMm =
    pageHeightMm - SUPPORT_QR_EDGE_MARGIN_MM - SUPPORT_QR_BOX_SIZE_MM
  const usableTopMm =
    pageHeightMm - PDF_MARGIN_MM - PDF_NOTICE_RESERVE_MM
  const textLeftMm =
    xMm - SUPPORT_QR_TEXT_GAP_MM - SUPPORT_QR_TEXT_WIDTH_MM

  if (
    xMm < PDF_MARGIN_MM ||
    textLeftMm < PDF_MARGIN_MM ||
    yMm < usableTopMm + SUPPORT_QR_CLEARANCE_MM
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
  }
}
