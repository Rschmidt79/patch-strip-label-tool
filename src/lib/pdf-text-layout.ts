/**
 * Vertical placement of PDF text lines inside a cell, in points.
 *
 * Lines keep the established line pitch (one font "box" per line), but each
 * baseline is placed so capital letters are optically centered in their box.
 * Descenders (g, j, p, q, y) and accented capitals (Å, Ø, É) then reach
 * slightly outside the box, so the block is also kept far enough from the
 * cell edges for that ink to stay inside the cell.
 */

/** Font heights per 1 pt of font size. */
export interface PdfFontVerticalMetrics {
  /** Ascender plus descender: the line box used for fitting and pitch. */
  boxHeightRatio: number
  /** Ascender only, which matches the capital height for Helvetica. */
  capHeightRatio: number
}

/**
 * Top of the tallest accented capital above the baseline, per 1 pt of font
 * size. Helvetica Bold "Å" reaches 0.962; regular Helvetica is lower.
 */
export const PDF_ACCENTED_CAPITAL_ASCENT_RATIO = 0.962

/** Share of the cell height kept clear of ink at the top and at the bottom. */
export const PDF_TEXT_EDGE_CLEARANCE_RATIO = 0.03

export interface PdfTextLineLayoutInput {
  /** Requested size of each line, top line first. */
  sizesPt: readonly number[]
  metrics: PdfFontVerticalMetrics
  cellBottomPt: number
  cellHeightPt: number
  lineGapPt: number
  /** Auto-fit cells may shrink further so all ink stays inside the cell. */
  allowShrink: boolean
}

export interface PdfTextLinePlacement {
  sizePt: number
  baselinePt: number
}

export function layoutPdfTextLines({
  sizesPt,
  metrics,
  cellBottomPt,
  cellHeightPt,
  lineGapPt,
  allowShrink,
}: PdfTextLineLayoutInput): PdfTextLinePlacement[] {
  if (sizesPt.length === 0) return []

  const { boxHeightRatio, capHeightRatio } = metrics
  const baselineInBoxRatio = (boxHeightRatio - capHeightRatio) / 2
  const descentRatio = boxHeightRatio - capHeightRatio
  const bottomOvershootRatio = Math.max(0, descentRatio - baselineInBoxRatio)
  const topOvershootRatio = Math.max(
    0,
    PDF_ACCENTED_CAPITAL_ASCENT_RATIO - boxHeightRatio + baselineInBoxRatio,
  )
  const totalGapPt = lineGapPt * (sizesPt.length - 1)
  const clearancePt = cellHeightPt * PDF_TEXT_EDGE_CLEARANCE_RATIO
  const inkHeightPt = cellHeightPt - clearancePt * 2
  const measure = (sizes: readonly number[]) => {
    const blockHeightPt =
      sizes.reduce((total, sizePt) => total + sizePt * boxHeightRatio, 0) +
      totalGapPt
    const topOvershootPt = sizes[0] * topOvershootRatio
    const bottomOvershootPt = sizes[sizes.length - 1] * bottomOvershootRatio
    return {
      blockHeightPt,
      topOvershootPt,
      bottomOvershootPt,
      requiredHeightPt: blockHeightPt + topOvershootPt + bottomOvershootPt,
    }
  }

  let sizes = [...sizesPt]
  let measured = measure(sizes)
  if (allowShrink && measured.requiredHeightPt > inkHeightPt) {
    const scalableHeightPt = measured.requiredHeightPt - totalGapPt
    const scale =
      scalableHeightPt > 0
        ? Math.max(0, inkHeightPt - totalGapPt) / scalableHeightPt
        : 1
    if (scale > 0 && scale < 1) {
      sizes = sizes.map((sizePt) => sizePt * scale)
      measured = measure(sizes)
    }
  }

  const centeredBottomPt =
    cellBottomPt + (cellHeightPt - measured.blockHeightPt) / 2
  const minimumBottomPt =
    cellBottomPt + clearancePt + measured.bottomOvershootPt
  const maximumBottomPt =
    cellBottomPt +
    cellHeightPt -
    clearancePt -
    measured.topOvershootPt -
    measured.blockHeightPt
  const blockBottomPt =
    maximumBottomPt >= minimumBottomPt
      ? Math.max(minimumBottomPt, Math.min(centeredBottomPt, maximumBottomPt))
      : centeredBottomPt

  let lineTopPt = blockBottomPt + measured.blockHeightPt
  return sizes.map((sizePt) => {
    lineTopPt -= sizePt * boxHeightRatio
    const placement = {
      sizePt,
      baselinePt: lineTopPt + sizePt * baselineInBoxRatio,
    }
    lineTopPt -= lineGapPt
    return placement
  })
}
