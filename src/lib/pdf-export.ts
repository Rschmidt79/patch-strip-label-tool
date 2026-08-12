import {
  concatTransformationMatrix,
  degrees,
  grayscale,
  PDFDocument,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  StandardFonts,
} from 'pdf-lib'
import supportQrDataUrl from '../assets/bmc_qr.png?inline'
import { getPageDimensionsMm } from '../config/pages'
import {
  getCellWidthMm,
  millimetersToPoints,
} from './dimensions'
import { hexToRgb } from './colors'
import {
  getCellContentGeometryMm,
  getGroupHeaderGeometryMm,
} from './group-headers'
import {
  PDF_MARGIN_MM,
  type PdfStripPlacement,
} from './pdf-layout'
import {
  CROP_MARK_WIDTH_MM,
  CUT_LINE_WIDTH_MM,
  type LineSegmentMm,
} from './cut-guides'
import { APP_NAME } from '../config/branding'
import {
  planPrintLayout,
  type PrintLayoutPlan,
} from './print-layout'
import {
  resolveInitialPrintPreferences,
  type PrintPreferences,
} from './print-preferences'
import {
  getSafeSupportQrDecorationGeometryMm,
  SUPPORT_QR_LABEL_LINE_1,
  SUPPORT_QR_LABEL_LINE_2,
  type SupportQrDecorationGeometryMm,
} from './support-qr'
import {
  degreesToRadians,
  getRotationOriginForBoundsMm,
} from './geometry'
import type {
  LabelCell,
  GroupHeader,
  LabelProject,
  LabelStrip,
  PageSettings,
} from '../model/project'

const PRINT_NOTICE_LINE_1 = 'PRINT AT 100% / ACTUAL SIZE'
const PRINT_NOTICE_LINE_2 = 'DO NOT FIT OR SHRINK TO PAGE'
const LABEL_HORIZONTAL_PADDING_MM = 1.1
export const CALIBRATION_SQUARE_SIZE_MM = 100
export const CALIBRATION_STROKE_WIDTH_MM = 0.25

export interface CalibrationSquareGeometryMm {
  xMm: number
  yMm: number
  sizeMm: number
}

export interface CalibrationOutlineGeometryMm {
  xMm: number
  yMm: number
  pathSizeMm: number
  strokeWidthMm: number
}

export interface PdfStripTransform {
  a: number
  b: number
  c: number
  d: number
  translateXPt: number
  translateYPt: number
}

function drawGuideLine(
  page: PDFPage,
  segment: LineSegmentMm,
  widthMm: number,
  shade: number,
): void {
  page.drawLine({
    start: {
      x: millimetersToPoints(segment.start.xMm),
      y: millimetersToPoints(segment.start.yMm),
    },
    end: {
      x: millimetersToPoints(segment.end.xMm),
      y: millimetersToPoints(segment.end.yMm),
    },
    thickness: millimetersToPoints(widthMm),
    color: grayscale(shade),
  })
}

function decodePngDataUrl(dataUrl: string): Uint8Array {
  const separatorIndex = dataUrl.indexOf(',')
  if (
    separatorIndex < 0 ||
    !dataUrl.slice(0, separatorIndex).includes(';base64')
  ) {
    throw new Error('The bundled support QR asset is not a base64 PNG.')
  }
  const binary = atob(dataUrl.slice(separatorIndex + 1))
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

export function getPdfStripTransform(
  placement: PdfStripPlacement,
): PdfStripTransform {
  const originMm = getRotationOriginForBoundsMm(
    placement.xMm,
    placement.yMm,
    placement.heightMm,
    placement.rotationDegrees,
  )
  const angleRadians = degreesToRadians(placement.rotationDegrees)
  const cosine = Math.cos(angleRadians)
  const sine = Math.sin(angleRadians)
  return {
    a: cosine,
    b: sine,
    c: -sine,
    d: cosine,
    translateXPt: millimetersToPoints(originMm.xMm),
    translateYPt: millimetersToPoints(originMm.yMm),
  }
}

export function getCalibrationSquareGeometryMm(
  pageSettings: PageSettings,
): CalibrationSquareGeometryMm {
  const { widthMm, heightMm } = getPageDimensionsMm(pageSettings)
  return {
    xMm: (widthMm - CALIBRATION_SQUARE_SIZE_MM) / 2,
    yMm: (heightMm - CALIBRATION_SQUARE_SIZE_MM) / 2,
    sizeMm: CALIBRATION_SQUARE_SIZE_MM,
  }
}

export function getCalibrationOutlineGeometryMm(
  pageSettings: PageSettings,
): CalibrationOutlineGeometryMm {
  const square = getCalibrationSquareGeometryMm(pageSettings)
  return {
    xMm: square.xMm + CALIBRATION_STROKE_WIDTH_MM / 2,
    yMm: square.yMm + CALIBRATION_STROKE_WIDTH_MM / 2,
    pathSizeMm: square.sizeMm - CALIBRATION_STROKE_WIDTH_MM,
    strokeWidthMm: CALIBRATION_STROKE_WIDTH_MM,
  }
}

function drawPrintNotice(
  page: PDFPage,
  pageHeightMm: number,
  font: PDFFont,
): void {
  page.drawText(PRINT_NOTICE_LINE_1, {
    x: millimetersToPoints(PDF_MARGIN_MM),
    y: millimetersToPoints(pageHeightMm - PDF_MARGIN_MM - 2.5),
    size: 7,
    font,
    color: grayscale(0.15),
  })
  page.drawText(PRINT_NOTICE_LINE_2, {
    x: millimetersToPoints(PDF_MARGIN_MM),
    y: millimetersToPoints(pageHeightMm - PDF_MARGIN_MM - 6),
    size: 7,
    font,
    color: grayscale(0.15),
  })
}

function drawSupportQrDecoration(
  page: PDFPage,
  geometry: SupportQrDecorationGeometryMm,
  image: PDFImage,
  regularFont: PDFFont,
  boldFont: PDFFont,
): void {
  page.drawRectangle({
    x: millimetersToPoints(geometry.xMm),
    y: millimetersToPoints(geometry.yMm),
    width: millimetersToPoints(geometry.widthMm),
    height: millimetersToPoints(geometry.heightMm),
    color: rgb(1, 1, 1),
    borderColor: grayscale(0.82),
    borderWidth: millimetersToPoints(0.12),
  })
  page.drawImage(image, {
    x: millimetersToPoints(geometry.imageXmm),
    y: millimetersToPoints(geometry.imageYmm),
    width: millimetersToPoints(geometry.imageSizeMm),
    height: millimetersToPoints(geometry.imageSizeMm),
  })

  const title = SUPPORT_QR_LABEL_LINE_1
  const supportText = SUPPORT_QR_LABEL_LINE_2
  const titleSizePt = 5.5
  const urlSizePt = 5
  const titleWidthPt = boldFont.widthOfTextAtSize(title, titleSizePt)
  const supportTextWidthPt = regularFont.widthOfTextAtSize(
    supportText,
    urlSizePt,
  )
  const textRightPt = millimetersToPoints(geometry.textRightXmm)
  const centerYPt = millimetersToPoints(
    geometry.yMm + geometry.heightMm / 2,
  )

  page.drawText(title, {
    x: textRightPt - titleWidthPt,
    y: centerYPt + millimetersToPoints(0.7),
    size: titleSizePt,
    font: boldFont,
    color: grayscale(0.35),
  })
  page.drawText(supportText, {
    x: textRightPt - supportTextWidthPt,
    y: centerYPt - millimetersToPoints(1.8),
    size: urlSizePt,
    font: regularFont,
    color: grayscale(0.42),
  })
}

function fitPdfFontSize(
  text: string,
  font: PDFFont,
  requestedSizePt: number,
  maximumWidthPt: number,
  maximumHeightPt: number,
  autoFit: boolean,
): number {
  if (!autoFit || !text) return requestedSizePt

  const measuredWidthPt = font.widthOfTextAtSize(text, requestedSizePt)
  const measuredHeightPt = font.heightAtSize(requestedSizePt)
  const widthRatio =
    measuredWidthPt > 0 ? maximumWidthPt / measuredWidthPt : 1
  const heightRatio =
    measuredHeightPt > 0 ? maximumHeightPt / measuredHeightPt : 1

  return Math.max(
    0.1,
    requestedSizePt * Math.min(1, widthRatio, heightRatio),
  )
}

interface FittedPdfLine {
  text: string
  font: PDFFont
  sizePt: number
  widthPt: number
  heightPt: number
}

function drawCellText(
  page: PDFPage,
  cell: LabelCell,
  cellXPt: number,
  cellYPt: number,
  cellWidthPt: number,
  cellHeightPt: number,
  regularFont: PDFFont,
  boldFont: PDFFont,
): void {
  const textLines = [cell.line1, cell.line2].filter(Boolean)
  if (textLines.length === 0) return

  const font = cell.style.fontWeight === 'bold' ? boldFont : regularFont
  const maximumWidthPt = Math.max(
    0.1,
    cellWidthPt - millimetersToPoints(LABEL_HORIZONTAL_PADDING_MM * 2),
  )
  const maximumLineHeightPt =
    cellHeightPt / (textLines.length === 1 ? 1.15 : textLines.length * 1.12)
  const lines = textLines.map<FittedPdfLine>((text) => {
    const sizePt = fitPdfFontSize(
      text,
      font,
      cell.style.fontSizePt,
      maximumWidthPt,
      maximumLineHeightPt,
      cell.style.autoFit,
    )
    return {
      text,
      font,
      sizePt,
      widthPt: font.widthOfTextAtSize(text, sizePt),
      heightPt: font.heightAtSize(sizePt),
    }
  })

  const lineGapPt = lines.length > 1 ? 0.45 : 0
  const blockHeightPt =
    lines.reduce((total, line) => total + line.heightPt, 0) +
    lineGapPt * (lines.length - 1)
  let lineTopPt = cellYPt + (cellHeightPt + blockHeightPt) / 2

  for (const line of lines) {
    lineTopPt -= line.heightPt
    const xPt =
      cell.style.alignment === 'left'
        ? cellXPt + millimetersToPoints(LABEL_HORIZONTAL_PADDING_MM)
        : cell.style.alignment === 'right'
          ? cellXPt +
            cellWidthPt -
            millimetersToPoints(LABEL_HORIZONTAL_PADDING_MM) -
            line.widthPt
          : cellXPt + (cellWidthPt - line.widthPt) / 2

    const textColor = hexToRgb(cell.appearance.textColor)
    page.drawText(line.text, {
      x: xPt,
      y: lineTopPt,
      size: line.sizePt,
      font: line.font,
      color: rgb(textColor.red, textColor.green, textColor.blue),
    })
    lineTopPt -= lineGapPt
  }
}

function drawGroupHeaderText(
  page: PDFPage,
  header: GroupHeader,
  xPt: number,
  yPt: number,
  widthPt: number,
  heightPt: number,
  regularFont: PDFFont,
  boldFont: PDFFont,
): void {
  if (!header.text) return
  const font = header.style.fontWeight === 'bold' ? boldFont : regularFont
  const maximumWidthPt = Math.max(
    0.1,
    widthPt - millimetersToPoints(LABEL_HORIZONTAL_PADDING_MM * 2),
  )
  const sizePt = fitPdfFontSize(
    header.text,
    font,
    header.style.fontSizePt,
    maximumWidthPt,
    heightPt * 0.62,
    true,
  )
  const textWidthPt = font.widthOfTextAtSize(header.text, sizePt)
  const textHeightPt = font.heightAtSize(sizePt)
  const textXPt =
    header.style.alignment === 'left'
      ? xPt + millimetersToPoints(LABEL_HORIZONTAL_PADDING_MM)
      : header.style.alignment === 'right'
        ? xPt +
          widthPt -
          millimetersToPoints(LABEL_HORIZONTAL_PADDING_MM) -
          textWidthPt
        : xPt + (widthPt - textWidthPt) / 2
  const textColor = hexToRgb(header.style.textColor)

  page.drawText(header.text, {
    x: textXPt,
    y: yPt + (heightPt - textHeightPt) / 2,
    size: sizePt,
    font,
    color: rgb(textColor.red, textColor.green, textColor.blue),
  })
}

function drawStrip(
  page: PDFPage,
  strip: LabelStrip,
  placement: PdfStripPlacement,
  regularFont: PDFFont,
  boldFont: PDFFont,
): void {
  const transform = getPdfStripTransform(placement)
  const widthPt = millimetersToPoints(placement.widthMm)
  const heightPt = millimetersToPoints(placement.heightMm)
  const cellHeightPt = millimetersToPoints(strip.dimensions.heightMm)
  const cellWidthMm = getCellWidthMm(strip)
  const cellWidthPt = millimetersToPoints(cellWidthMm)

  // The matrix contains rotation and translation only. Physical dimensions
  // remain the direct millimeter-to-point conversion used below.
  page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(
      transform.a,
      transform.b,
      transform.c,
      transform.d,
      transform.translateXPt,
      transform.translateYPt,
    ),
  )

  page.drawRectangle({
    x: 0,
    y: 0,
    width: widthPt,
    height: heightPt,
    color: rgb(1, 1, 1),
  })

  strip.cells.forEach((cell, index) => {
    const fill = hexToRgb(cell.appearance.backgroundColor)
    const border = hexToRgb(cell.appearance.borderColor)
    page.drawRectangle({
      x: cellWidthPt * index,
      y: 0,
      width: cellWidthPt,
      height: cellHeightPt,
      color: rgb(fill.red, fill.green, fill.blue),
      borderColor: rgb(border.red, border.green, border.blue),
      borderWidth: millimetersToPoints(0.12),
    })
  })

  strip.groupHeaders.forEach((header) => {
    const geometry = getGroupHeaderGeometryMm(strip, header)
    const fill = hexToRgb(header.style.backgroundColor)
    page.drawRectangle({
      x: millimetersToPoints(geometry.xMm),
      y: millimetersToPoints(geometry.yMm),
      width: millimetersToPoints(geometry.widthMm),
      height: millimetersToPoints(geometry.heightMm),
      color: rgb(fill.red, fill.green, fill.blue),
      borderColor: grayscale(0.05),
      borderWidth: millimetersToPoints(0.12),
    })
  })

  strip.cells.forEach((cell, index) => {
    const contentGeometry = getCellContentGeometryMm(strip, index)
    drawCellText(
      page,
      cell,
      cellWidthPt * index,
      millimetersToPoints(contentGeometry.yMm),
      cellWidthPt,
      millimetersToPoints(contentGeometry.heightMm),
      regularFont,
      boldFont,
    )
  })

  strip.groupHeaders.forEach((header) => {
    const geometry = getGroupHeaderGeometryMm(strip, header)
    drawGroupHeaderText(
      page,
      header,
      millimetersToPoints(geometry.xMm),
      millimetersToPoints(geometry.yMm),
      millimetersToPoints(geometry.widthMm),
      millimetersToPoints(geometry.heightMm),
      regularFont,
      boldFont,
    )
  })

  page.drawRectangle({
    x: 0,
    y: 0,
    width: widthPt,
    height: heightPt,
    borderColor: grayscale(0.05),
    borderWidth: millimetersToPoints(0.18),
  })

  page.pushOperators(popGraphicsState())
}

export async function createLabelsPdf(
  project: LabelProject,
  preferences: PrintPreferences = resolveInitialPrintPreferences(
    undefined,
    project.page,
  ),
  suppliedPlan?: PrintLayoutPlan,
): Promise<Uint8Array> {
  const plan = suppliedPlan ?? planPrintLayout(project, preferences)
  const pdf = await PDFDocument.create()
  pdf.setTitle(project.name || 'Patch Strip Labels')
  pdf.setSubject('Dimensionally accurate patch strip labels')
  pdf.setCreator(APP_NAME)
  pdf.setProducer(`${APP_NAME} / pdf-lib`)

  const regularFont = await pdf.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold)
  const supportGeometries = Array.from(
    { length: plan.pageCount },
    (_, pageIndex) =>
      getSafeSupportQrDecorationGeometryMm(
        plan.pageWidthMm,
        plan.pageHeightMm,
        plan.placements.filter(
          (placement) => placement.pageIndex === pageIndex,
        ),
      ),
  )
  const supportQrImage = supportGeometries.some(Boolean)
    ? await pdf.embedPng(decodePngDataUrl(supportQrDataUrl))
    : undefined
  const pages = Array.from({ length: plan.pageCount }, (_, pageIndex) => {
    const page = pdf.addPage([
      millimetersToPoints(plan.pageWidthMm),
      millimetersToPoints(plan.pageHeightMm),
    ])
    drawPrintNotice(page, plan.pageHeightMm, boldFont)
    const supportGeometry = supportGeometries[pageIndex]
    if (supportGeometry && supportQrImage) {
      drawSupportQrDecoration(
        page,
        supportGeometry,
        supportQrImage,
        regularFont,
        boldFont,
      )
    }
    return page
  })

  for (const placement of plan.placements) {
    const strip = project.strips.find(
      (candidate) => candidate.id === placement.stripId,
    )
    if (!strip) continue
    drawStrip(
      pages[placement.pageIndex],
      strip,
      placement,
      regularFont,
      boldFont,
    )
  }

  for (const guides of plan.pageGuides) {
    const page = pages[guides.pageIndex]
    guides.cutLines.forEach((segment) =>
      drawGuideLine(page, segment, CUT_LINE_WIDTH_MM, 0.02),
    )
    guides.cropMarks.forEach((segment) =>
      drawGuideLine(page, segment, CROP_MARK_WIDTH_MM, 0.22),
    )
  }

  return pdf.save({ useObjectStreams: false })
}

function drawCalibrationMarks(
  page: PDFPage,
  squareXPt: number,
  squareYPt: number,
  squareSizePt: number,
): void {
  const shortTickPt = millimetersToPoints(2)
  const longTickPt = millimetersToPoints(3.5)

  for (let millimeter = 0; millimeter <= 100; millimeter += 10) {
    const offsetPt = millimetersToPoints(millimeter)
    const tickPt = millimeter % 50 === 0 ? longTickPt : shortTickPt

    page.drawLine({
      start: { x: squareXPt + offsetPt, y: squareYPt },
      end: { x: squareXPt + offsetPt, y: squareYPt - tickPt },
      thickness: millimetersToPoints(0.2),
      color: grayscale(0.05),
    })
    page.drawLine({
      start: { x: squareXPt + offsetPt, y: squareYPt + squareSizePt },
      end: {
        x: squareXPt + offsetPt,
        y: squareYPt + squareSizePt + tickPt,
      },
      thickness: millimetersToPoints(0.2),
      color: grayscale(0.05),
    })
    page.drawLine({
      start: { x: squareXPt, y: squareYPt + offsetPt },
      end: { x: squareXPt - tickPt, y: squareYPt + offsetPt },
      thickness: millimetersToPoints(0.2),
      color: grayscale(0.05),
    })
    page.drawLine({
      start: { x: squareXPt + squareSizePt, y: squareYPt + offsetPt },
      end: {
        x: squareXPt + squareSizePt + tickPt,
        y: squareYPt + offsetPt,
      },
      thickness: millimetersToPoints(0.2),
      color: grayscale(0.05),
    })
  }
}

export async function createCalibrationPdf(
  pageSettings: PageSettings,
): Promise<Uint8Array> {
  const { widthMm, heightMm } = getPageDimensionsMm(pageSettings)
  const pdf = await PDFDocument.create()
  pdf.setTitle('100 mm Patch Strip Printer Calibration')
  pdf.setSubject('Exact 100 mm horizontal and vertical printer calibration')
  pdf.setCreator(APP_NAME)
  pdf.setProducer(`${APP_NAME} / pdf-lib`)

  const page = pdf.addPage([
    millimetersToPoints(widthMm),
    millimetersToPoints(heightMm),
  ])
  const regularFont = await pdf.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold)
  drawPrintNotice(page, heightMm, boldFont)

  const squareGeometry = getCalibrationSquareGeometryMm(pageSettings)
  const outlineGeometry = getCalibrationOutlineGeometryMm(pageSettings)
  const squareSizePt = millimetersToPoints(squareGeometry.sizeMm)
  const squareXPt = millimetersToPoints(squareGeometry.xMm)
  const squareYPt = millimetersToPoints(squareGeometry.yMm)

  page.drawRectangle({
    x: millimetersToPoints(outlineGeometry.xMm),
    y: millimetersToPoints(outlineGeometry.yMm),
    width: millimetersToPoints(outlineGeometry.pathSizeMm),
    height: millimetersToPoints(outlineGeometry.pathSizeMm),
    borderColor: grayscale(0.02),
    borderWidth: millimetersToPoints(outlineGeometry.strokeWidthMm),
  })
  drawCalibrationMarks(page, squareXPt, squareYPt, squareSizePt)

  const horizontalLabel = '100 mm horizontal'
  const horizontalSize = 9
  page.drawText(horizontalLabel, {
    x:
      squareXPt +
      (squareSizePt - regularFont.widthOfTextAtSize(horizontalLabel, horizontalSize)) /
        2,
    y: squareYPt - millimetersToPoints(9),
    size: horizontalSize,
    font: regularFont,
    color: grayscale(0.1),
  })
  page.drawText('100 mm vertical', {
    x: squareXPt - millimetersToPoints(9),
    y: squareYPt + millimetersToPoints(20),
    size: 9,
    font: regularFont,
    rotate: degrees(90),
    color: grayscale(0.1),
  })
  page.drawText('Measure the outside edges of the square in both directions.', {
    x: squareXPt,
    y: squareYPt - millimetersToPoints(16),
    size: 7,
    font: regularFont,
    color: grayscale(0.25),
  })

  return pdf.save({ useObjectStreams: false })
}
