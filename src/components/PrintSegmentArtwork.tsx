import { getStripTotalHeightMm } from '../lib/dimensions'
import {
  getPrintSegmentJoinLabel,
  type PrintStripSegment,
} from '../lib/print-segments'
import type { LabelStrip } from '../model/project'
import { StripArtwork } from './StripArtwork'

export function PrintSegmentArtwork({
  strip,
  segment,
}: {
  strip: LabelStrip
  segment: PrintStripSegment
}) {
  const heightMm = getStripTotalHeightMm(strip)
  const joinLabel = getPrintSegmentJoinLabel(segment)

  if (segment.segmentCount === 1) {
    return <StripArtwork strip={strip} />
  }

  return (
    <g
      className="print-segment-artwork"
      data-segment={`${segment.segmentIndex + 1}/${segment.segmentCount}`}
      data-source-start-mm={segment.sourceStartMm}
      data-source-end-mm={segment.sourceEndMm}
    >
      <rect
        className="print-segment-paper"
        x={0}
        y={0}
        width={segment.printedWidthMm}
        height={heightMm}
      />
      <svg
        x={0}
        y={0}
        width={segment.contentWidthMm}
        height={heightMm}
        viewBox={`${segment.sourceStartMm} 0 ${segment.contentWidthMm} ${heightMm}`}
        preserveAspectRatio="none"
        overflow="hidden"
      >
        <StripArtwork strip={strip} />
      </svg>
      {segment.glueTabWidthMm > 0 && (
        <g className="print-segment-glue-tab" aria-hidden="true">
          <rect
            x={segment.contentWidthMm}
            y={0}
            width={segment.glueTabWidthMm}
            height={heightMm}
          />
          <line
            className="print-segment-join-line"
            x1={segment.contentWidthMm}
            y1={0}
            x2={segment.contentWidthMm}
            y2={heightMm}
          />
          <text
            x={segment.contentWidthMm + segment.glueTabWidthMm / 2}
            y={heightMm / 2 - 0.75}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            GLUE
          </text>
          <text
            x={segment.contentWidthMm + segment.glueTabWidthMm / 2}
            y={heightMm / 2 + 0.85}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {joinLabel}
          </text>
        </g>
      )}
      <rect
        className="print-segment-outline"
        x={0.09}
        y={0.09}
        width={Math.max(0, segment.printedWidthMm - 0.18)}
        height={Math.max(0, heightMm - 0.18)}
      />
    </g>
  )
}
