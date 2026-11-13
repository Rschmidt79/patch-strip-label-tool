import { PDFDocument, StandardFonts } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import {
  layoutPdfTextLines,
  PDF_ACCENTED_CAPITAL_ASCENT_RATIO,
  type PdfFontVerticalMetrics,
} from '../src/lib/pdf-text-layout'
import { millimetersToPoints } from '../src/lib/dimensions'

async function getHelveticaBoldMetrics(): Promise<PdfFontVerticalMetrics> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.HelveticaBold)
  return {
    boxHeightRatio: font.heightAtSize(1),
    capHeightRatio: font.heightAtSize(1, { descender: false }),
  }
}

function getInkExtentsPt(
  placement: { sizePt: number; baselinePt: number },
  metrics: PdfFontVerticalMetrics,
) {
  return {
    bottomPt:
      placement.baselinePt -
      placement.sizePt * (metrics.boxHeightRatio - metrics.capHeightRatio),
    topPt:
      placement.baselinePt +
      placement.sizePt * PDF_ACCENTED_CAPITAL_ASCENT_RATIO,
  }
}

describe('PDF cell text placement', () => {
  const cellBottomPt = 100
  const cellHeightPt = millimetersToPoints(7.5)
  const epsilonPt = 1e-9

  it('keeps descenders and accented capitals inside a height-limited cell', async () => {
    const metrics = await getHelveticaBoldMetrics()
    // The sizes the width/height fit hands over for 24 pt text in 7.5 mm.
    const singleLineSizePt = cellHeightPt / 1.15 / metrics.boxHeightRatio
    const twoLineSizePt = cellHeightPt / 2.24 / metrics.boxHeightRatio

    for (const sizesPt of [[singleLineSizePt], [twoLineSizePt, twoLineSizePt]]) {
      const placements = layoutPdfTextLines({
        sizesPt,
        metrics,
        cellBottomPt,
        cellHeightPt,
        lineGapPt: sizesPt.length > 1 ? 0.45 : 0,
        allowShrink: true,
      })
      const first = getInkExtentsPt(placements[0], metrics)
      const last = getInkExtentsPt(placements[placements.length - 1], metrics)
      expect(last.bottomPt).toBeGreaterThanOrEqual(cellBottomPt - epsilonPt)
      expect(first.topPt).toBeLessThanOrEqual(
        cellBottomPt + cellHeightPt + epsilonPt,
      )
      placements.forEach((placement, index) =>
        expect(placement.sizePt).toBeLessThanOrEqual(sizesPt[index]),
      )
    }
  })

  it('leaves normal label sizes unchanged and centers capital letters', async () => {
    const metrics = await getHelveticaBoldMetrics()
    const [single] = layoutPdfTextLines({
      sizesPt: [6.5],
      metrics,
      cellBottomPt,
      cellHeightPt,
      lineGapPt: 0,
      allowShrink: true,
    })
    expect(single.sizePt).toBe(6.5)
    const capitalCenterPt =
      single.baselinePt + (6.5 * metrics.capHeightRatio) / 2
    expect(capitalCenterPt).toBeCloseTo(cellBottomPt + cellHeightPt / 2, 9)

    const two = layoutPdfTextLines({
      sizesPt: [6.5, 6.5],
      metrics,
      cellBottomPt,
      cellHeightPt,
      lineGapPt: 0.45,
      allowShrink: true,
    })
    expect(two.map((line) => line.sizePt)).toEqual([6.5, 6.5])
    expect(two[0].baselinePt - two[1].baselinePt).toBeCloseTo(
      6.5 * metrics.boxHeightRatio + 0.45,
      9,
    )
    const blockCenterPt =
      (two[0].baselinePt + 6.5 * metrics.capHeightRatio + two[1].baselinePt) /
      2
    expect(blockCenterPt).toBeCloseTo(cellBottomPt + cellHeightPt / 2, 9)
  })

  it('never shrinks text when auto-fit is off', async () => {
    const metrics = await getHelveticaBoldMetrics()
    const [line] = layoutPdfTextLines({
      sizesPt: [24],
      metrics,
      cellBottomPt,
      cellHeightPt,
      lineGapPt: 0,
      allowShrink: false,
    })
    expect(line.sizePt).toBe(24)
  })
})
