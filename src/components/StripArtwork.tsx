import {
  fitFontSizePt,
  getCellWidthMm,
  getStripRowTopOffsetsMm,
  getStripTotalHeightMm,
  getStripWidthMm,
  MM_PER_POINT,
} from '../lib/dimensions'
import {
  getCellContentGeometryMm,
  getGroupHeaderGeometryMm,
} from '../lib/group-headers'
import type {
  GroupHeader,
  LabelCell,
  LabelStrip,
  LabelStripRow,
} from '../model/project'

interface SvgCellTextProps {
  cell: LabelCell
  cellX: number
  cellY: number
  cellWidthMm: number
  cellHeightMm: number
}

function SvgCellText({
  cell,
  cellX,
  cellY,
  cellWidthMm,
  cellHeightMm,
}: SvgCellTextProps) {
  const horizontalPaddingMm = Math.min(1.25, cellWidthMm * 0.08)
  const availableWidthMm = Math.max(0.5, cellWidthMm - horizontalPaddingMm * 2)
  const lines = [cell.line1, cell.line2].filter(Boolean)
  const { alignment, fontSizePt, fontWeight, autoFit } = cell.style
  const anchor =
    alignment === 'left' ? 'start' : alignment === 'right' ? 'end' : 'middle'
  const textX =
    alignment === 'left'
      ? cellX + horizontalPaddingMm
      : alignment === 'right'
        ? cellX + cellWidthMm - horizontalPaddingMm
        : cellX + cellWidthMm / 2

  if (lines.length === 0) return null

  const maximumLineSizePt =
    cellHeightMm /
    (lines.length === 1 ? 1.15 : lines.length * 1.12) /
    MM_PER_POINT
  const requestedSizePt = autoFit
    ? Math.min(fontSizePt, maximumLineSizePt)
    : fontSizePt
  const fittedSizesPt = lines.map((line) =>
    fitFontSizePt(
      line,
      availableWidthMm,
      requestedSizePt,
      fontWeight,
      autoFit,
    ),
  )
  const lineHeightMm = Math.max(...fittedSizesPt) * MM_PER_POINT * 1.04
  const firstBaseline =
    cellY +
    (lines.length === 1
      ? cellHeightMm / 2
      : cellHeightMm / 2 - lineHeightMm * 0.52)

  return (
    <g className="cell-copy" aria-hidden="true">
      {lines.map((line, index) => {
        const fittedSizePt = fittedSizesPt[index]
        return (
          <text
            key={`${index}-${line}`}
            x={textX}
            y={firstBaseline + index * lineHeightMm}
            textAnchor={anchor}
            dominantBaseline="middle"
            fontFamily="Inter, Segoe UI, sans-serif"
            fontSize={fittedSizePt * MM_PER_POINT}
            fontWeight={fontWeight === 'bold' ? 700 : 400}
            fill={cell.appearance.textColor}
          >
            {line}
          </text>
        )
      })}
    </g>
  )
}

function GroupHeaderText({
  row,
  header,
}: {
  row: LabelStripRow
  header: GroupHeader
}) {
  const geometry = getGroupHeaderGeometryMm(row, header)
  const horizontalPaddingMm = Math.min(1.25, geometry.widthMm * 0.06)
  const availableWidthMm = Math.max(
    0.5,
    geometry.widthMm - horizontalPaddingMm * 2,
  )
  const maximumHeightSizePt =
    (geometry.heightMm * 0.62) / MM_PER_POINT
  const requestedSizePt = Math.min(
    header.style.fontSizePt,
    maximumHeightSizePt,
  )
  const fittedSizePt = fitFontSizePt(
    header.text,
    availableWidthMm,
    requestedSizePt,
    header.style.fontWeight,
    true,
  )
  const textAnchor =
    header.style.alignment === 'left'
      ? 'start'
      : header.style.alignment === 'right'
        ? 'end'
        : 'middle'
  const textX =
    header.style.alignment === 'left'
      ? geometry.xMm + horizontalPaddingMm
      : header.style.alignment === 'right'
        ? geometry.xMm + geometry.widthMm - horizontalPaddingMm
        : geometry.xMm + geometry.widthMm / 2

  return (
    <text
      className="group-header-copy"
      x={textX}
      y={geometry.heightMm / 2}
      textAnchor={textAnchor}
      dominantBaseline="middle"
      fontFamily="Inter, Segoe UI, sans-serif"
      fontSize={fittedSizePt * MM_PER_POINT}
      fontWeight={header.style.fontWeight === 'bold' ? 700 : 400}
      fill={header.style.textColor}
      aria-hidden="true"
    >
      {header.text}
    </text>
  )
}

export function StripRowArtwork({
  row,
  hiddenCellIds = [],
}: {
  row: LabelStripRow
  hiddenCellIds?: readonly string[]
}) {
  const widthMm = row.dimensions.widthMm
  const totalHeightMm = row.dimensions.heightMm
  const cellWidthMm = getCellWidthMm(row)

  return (
    <g className="strip-artwork">
      <rect
        x={0}
        y={0}
        width={widthMm}
        height={totalHeightMm}
        fill="#ffffff"
      />

      {row.cells.map((cell, index) => {
        const cellX = index * cellWidthMm
        const contentGeometry = getCellContentGeometryMm(row, index)
        const contentTopMm =
          totalHeightMm - contentGeometry.yMm - contentGeometry.heightMm
        return (
          <g key={cell.id}>
            <rect
              x={cellX}
              y={0}
              width={cellWidthMm}
              height={totalHeightMm}
              fill={cell.appearance.backgroundColor}
              stroke={cell.appearance.borderColor}
              strokeWidth={0.12}
            />
            {!hiddenCellIds.includes(cell.id) && (
              <SvgCellText
                cell={cell}
                cellX={cellX}
                cellY={contentTopMm}
                cellWidthMm={cellWidthMm}
                cellHeightMm={contentGeometry.heightMm}
              />
            )}
          </g>
        )
      })}

      {row.groupHeaders.map((header) => {
        const geometry = getGroupHeaderGeometryMm(row, header)
        const headerTopMm =
          totalHeightMm - geometry.yMm - geometry.heightMm
        return (
          <g key={header.id}>
            <rect
              x={geometry.xMm}
              y={headerTopMm}
              width={geometry.widthMm}
              height={geometry.heightMm}
              fill={header.style.backgroundColor}
              stroke="#101418"
              strokeWidth={0.12}
            />
            <GroupHeaderText row={row} header={header} />
          </g>
        )
      })}
    </g>
  )
}

export function StripArtwork({
  strip,
  hiddenCellIds = [],
}: {
  strip: LabelStrip
  hiddenCellIds?: readonly string[]
}) {
  const widthMm = getStripWidthMm(strip)
  const totalHeightMm = getStripTotalHeightMm(strip)
  const rowTopOffsetsMm = getStripRowTopOffsetsMm(strip)

  return (
    <g className="strip-block-artwork">
      {strip.rows.map((row, index) => (
        <g
          key={row.id}
          transform={`translate(0 ${rowTopOffsetsMm[index]})`}
        >
          <StripRowArtwork row={row} hiddenCellIds={hiddenCellIds} />
        </g>
      ))}
      <rect
        x={0.09}
        y={0.09}
        width={Math.max(0, widthMm - 0.18)}
        height={Math.max(0, totalHeightMm - 0.18)}
        className="strip-outline"
        strokeWidth={0.18}
      />
    </g>
  )
}
