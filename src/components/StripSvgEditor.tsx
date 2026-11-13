import { useState } from 'react'
import {
  CSS_PX_PER_MM,
  getCellWidthMm,
  getStripRowTopOffsetsMm,
  getStripTotalHeightMm,
  getPreviewLineFontSizesPt,
  getStripWidthMm,
  MM_PER_POINT,
  PREVIEW_FONT_FAMILY,
  PREVIEW_LINE_HEIGHT_RATIO,
} from '../lib/dimensions'
import {
  getCellContentGeometryMm,
  getGroupHeaderGeometryMm,
} from '../lib/group-headers'
import type { LabelCell, LabelStrip } from '../model/project'
import { MAX_CELL_TEXT_LENGTH } from '../config/content-limits'
import {
  formatCellEditValue,
  parseCellEditValue,
  resolveCellEditValue,
} from '../lib/cell-edit-text'
import { CellIndexRow } from './CellIndexRow'
import { StripArtwork } from './StripArtwork'

interface StripSvgEditorProps {
  strip: LabelStrip
  activeRowId: string | undefined
  selectedCellIds: readonly string[]
  selectedHeaderId: string | undefined
  editingCellId: string | undefined
  previewScale: number
  onSelectCell: (
    rowId: string,
    cellId: string,
    extendSelection: boolean,
  ) => void
  onSelectGroupHeader: (rowId: string, headerId: string) => void
  onClearSelection: () => void
  onChangeCellText: (
    rowId: string,
    cellId: string,
    line1: string,
    line2: string,
  ) => void
  onMoveCell: (rowId: string, cellId: string, direction: -1 | 1) => void
}

/**
 * The edit field is laid out at this multiple of its real size and scaled
 * back down by the SVG. Browsers position text imprecisely at font sizes of
 * two or three units, which made the text shift when a cell was opened.
 */
const EDITOR_LAYOUT_SCALE = 10

interface CellTextareaEditorProps {
  cell: LabelCell
  index: number
  cellWidthMm: number
  cellHeightMm: number
  onChangeCellText: (cellId: string, line1: string, line2: string) => void
  onMoveCell: (cellId: string, direction: -1 | 1) => void
  onClearSelection: () => void
}

function CellTextareaEditor({
  cell,
  index,
  cellWidthMm,
  cellHeightMm,
  onChangeCellText,
  onMoveCell,
  onClearSelection,
}: CellTextareaEditorProps) {
  const [draft, setDraft] = useState(() => formatCellEditValue(cell))
  const value = resolveCellEditValue(cell, draft)

  // Match the size and position of the text as it is drawn when not editing.
  const fittedSizesPt = getPreviewLineFontSizesPt(
    [cell.line1, cell.line2].filter(Boolean),
    cellWidthMm,
    cellHeightMm,
    cell.style,
  )
  const fontSizeMm =
    (fittedSizesPt.length > 0
      ? Math.min(...fittedSizesPt)
      : cell.style.autoFit
        ? Math.min(
            cell.style.fontSizePt,
            cellHeightMm / 1.15 / MM_PER_POINT,
          )
        : cell.style.fontSizePt) * MM_PER_POINT
  const lineCount = value.includes('\n') ? 2 : 1
  const lineHeightMm = fontSizeMm * PREVIEW_LINE_HEIGHT_RATIO
  const paddingTopMm = Math.max(
    0,
    (cellHeightMm - lineCount * lineHeightMm) / 2 -
      (lineCount > 1 ? lineHeightMm * 0.02 : 0),
  )
  const paddingInlineMm = Math.min(1.25, cellWidthMm * 0.08)

  return (
    <textarea
      className="svg-cell-input"
      autoFocus
      value={value}
      maxLength={MAX_CELL_TEXT_LENGTH * 2 + 1}
      aria-label={`Edit cell ${index + 1}, two lines maximum`}
      style={{
        textAlign: cell.style.alignment,
        fontFamily: PREVIEW_FONT_FAMILY,
        fontSize: `${fontSizeMm * EDITOR_LAYOUT_SCALE}px`,
        lineHeight: PREVIEW_LINE_HEIGHT_RATIO,
        paddingTop: `${paddingTopMm * EDITOR_LAYOUT_SCALE}px`,
        paddingInline: `${paddingInlineMm * EDITOR_LAYOUT_SCALE}px`,
        fontWeight: cell.style.fontWeight === 'bold' ? 700 : 400,
        color: cell.appearance.textColor,
      }}
      onChange={(event) => {
        const { line1, line2, value } = parseCellEditValue(event.target.value)
        setDraft(value)
        onChangeCellText(cell.id, line1, line2)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Tab') {
          event.preventDefault()
          onMoveCell(cell.id, event.shiftKey ? -1 : 1)
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          // Keep keyboard focus on the cell so arrow keys and Enter still work.
          const cellElement = event.currentTarget.closest('.svg-cell')
          if (cellElement instanceof SVGElement) cellElement.focus()
          onClearSelection()
        }
      }}
    />
  )
}

/**
 * Moves keyboard focus to a neighbouring cell: left/right within the row,
 * up/down to the same position in the adjacent row of the strip.
 */
function focusNeighbourCell(cellElement: Element, key: string): boolean {
  const rowElement = cellElement.closest('.svg-strip-row')
  if (!rowElement) return false
  const cellsInRow = Array.from(
    rowElement.querySelectorAll<SVGElement>(':scope > .svg-cell'),
  )
  const index = cellsInRow.findIndex((candidate) => candidate === cellElement)
  let target: SVGElement | undefined

  if (key === 'ArrowLeft') target = cellsInRow[index - 1]
  else if (key === 'ArrowRight') target = cellsInRow[index + 1]
  else if (key === 'Home') target = cellsInRow[0]
  else if (key === 'End') target = cellsInRow[cellsInRow.length - 1]
  else if (key === 'ArrowUp' || key === 'ArrowDown') {
    const rows = Array.from(
      rowElement.parentElement?.querySelectorAll(':scope > .svg-strip-row') ??
        [],
    )
    const adjacentRow =
      rows[rows.indexOf(rowElement) + (key === 'ArrowUp' ? -1 : 1)]
    const adjacentCells = Array.from(
      adjacentRow?.querySelectorAll<SVGElement>(':scope > .svg-cell') ?? [],
    )
    target = adjacentCells[Math.min(index, adjacentCells.length - 1)]
  } else {
    return false
  }

  target?.focus()
  return true
}

export function StripSvgEditor({
  strip,
  activeRowId,
  selectedCellIds,
  selectedHeaderId,
  editingCellId,
  previewScale,
  onSelectCell,
  onSelectGroupHeader,
  onClearSelection,
  onChangeCellText,
  onMoveCell,
}: StripSvgEditorProps) {
  const widthMm = getStripWidthMm(strip)
  const totalHeightMm = getStripTotalHeightMm(strip)
  const displayWidthPx = widthMm * CSS_PX_PER_MM * previewScale
  const displayHeightPx = totalHeightMm * CSS_PX_PER_MM * previewScale
  const activeRow =
    strip.rows.find((row) => row.id === activeRowId) ?? strip.rows[0]
  const rowTopOffsetsMm = getStripRowTopOffsetsMm(strip)
  // With no selection in this strip, its first cell is the keyboard entry
  // point; otherwise the selected cells are.
  const hasSelectedCell =
    activeRow?.cells.some((cell) => selectedCellIds.includes(cell.id)) ??
    false
  const keyboardEntryCellId = hasSelectedCell
    ? undefined
    : strip.rows[0]?.cells[0]?.id
  const rowsWithOffsets = strip.rows.map((row, index) => ({
    row,
    topMm: rowTopOffsetsMm[index],
  }))

  return (
    <div className="strip-editor-stack" style={{ width: displayWidthPx }}>
      {activeRow && (
        <CellIndexRow
          cells={activeRow.cells}
          selectedCellIds={selectedCellIds}
          widthPx={displayWidthPx}
        />
      )}
      <div
        className="strip-svg-stage"
        style={{ width: displayWidthPx, height: displayHeightPx }}
      >
      <svg
        className="strip-svg"
        xmlns="http://www.w3.org/2000/svg"
        width={`${widthMm}mm`}
        height={`${totalHeightMm}mm`}
        viewBox={`0 0 ${widthMm} ${totalHeightMm}`}
        preserveAspectRatio="none"
        data-width-mm={widthMm}
        data-height-mm={totalHeightMm}
        aria-label={`${strip.name}, ${widthMm} by ${totalHeightMm} millimeters`}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) onClearSelection()
        }}
      >
        <StripArtwork strip={strip} hiddenCellIds={editingCellId ? [editingCellId] : []} />

        {rowsWithOffsets.map(({ row, topMm }, rowIndex) => {
          const { heightMm } = row.dimensions
          const cellWidthMm = getCellWidthMm(row)
          const rowIsActive = row.id === activeRow?.id
          return (
            <g
              key={`editor-${row.id}`}
              className={`svg-strip-row ${rowIsActive ? 'active' : ''}`}
              transform={`translate(0 ${topMm})`}
            >
              {row.groupHeaders.map((header) => {
                const headerGeometry = getGroupHeaderGeometryMm(row, header)
                const headerTopMm =
                  heightMm - headerGeometry.yMm - headerGeometry.heightMm
                const isSelected = rowIsActive && header.id === selectedHeaderId
                return (
                  <g
                    key={`hit-${header.id}`}
                    className="svg-group-header"
                    role="button"
                    tabIndex={0}
                    aria-label={`Row ${rowIndex + 1}, group header ${header.text}, cells ${header.startCellIndex + 1} through ${header.endCellIndex + 1}`}
                    onPointerDown={(event) => {
                      event.stopPropagation()
                      onSelectGroupHeader(row.id, header.id)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onSelectGroupHeader(row.id, header.id)
                      }
                    }}
                  >
                    <rect
                      x={header.startCellIndex * cellWidthMm}
                      y={headerTopMm}
                      width={headerGeometry.widthMm}
                      height={headerGeometry.heightMm}
                      className="group-header-hit-area"
                    />
                    {isSelected && (
                      <rect
                        x={header.startCellIndex * cellWidthMm + 0.1}
                        y={headerTopMm + 0.1}
                        width={Math.max(0, headerGeometry.widthMm - 0.2)}
                        height={Math.max(0, headerGeometry.heightMm - 0.2)}
                        className="cell-selection"
                        strokeWidth={0.35}
                      />
                    )}
                  </g>
                )
              })}

              {row.cells.map((cell, index) => {
                const cellX = index * cellWidthMm
                const contentGeometry = getCellContentGeometryMm(row, index)
                const contentTopMm =
                  heightMm - contentGeometry.yMm - contentGeometry.heightMm
                const isSelected =
                  rowIsActive && selectedCellIds.includes(cell.id)
                const isEditing = rowIsActive && cell.id === editingCellId

                return (
                  <g
                    key={cell.id}
                    className={`svg-cell ${isSelected ? 'selected' : ''} ${isEditing ? 'editing' : ''}`}
                    role="button"
                    tabIndex={
                      isSelected || cell.id === keyboardEntryCellId ? 0 : -1
                    }
                    aria-pressed={isSelected}
                    aria-label={`Row ${rowIndex + 1}, cell ${index + 1}: ${cell.line1} ${cell.line2}`}
                    onPointerDown={(event) => {
                      if (
                        event.target instanceof Element &&
                        event.target.closest('.svg-cell-input')
                      ) {
                        return
                      }
                      event.stopPropagation()
                      // Keep the browser from moving focus to this group
                      // after the edit textarea has auto-focused.
                      event.preventDefault()
                      onSelectCell(row.id, cell.id, event.shiftKey)
                    }}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return
                      if (focusNeighbourCell(event.currentTarget, event.key)) {
                        event.preventDefault()
                        return
                      }
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onSelectCell(row.id, cell.id, event.shiftKey)
                      }
                    }}
                  >
                    <rect
                      x={cellX}
                      y={contentTopMm}
                      width={cellWidthMm}
                      height={contentGeometry.heightMm}
                      className="cell-hit-area"
                    />

                    {isSelected && (
                      <rect
                        x={cellX + 0.1}
                        y={contentTopMm + 0.1}
                        width={Math.max(0, cellWidthMm - 0.2)}
                        height={Math.max(0, contentGeometry.heightMm - 0.2)}
                        className="cell-selection"
                        strokeWidth={0.35}
                      />
                    )}

                    {isEditing && (
                      <foreignObject
                        key={cell.id}
                        transform={`translate(${cellX} ${contentTopMm}) scale(${1 / EDITOR_LAYOUT_SCALE})`}
                        x={0}
                        y={0}
                        width={cellWidthMm * EDITOR_LAYOUT_SCALE}
                        height={
                          contentGeometry.heightMm * EDITOR_LAYOUT_SCALE
                        }
                      >
                        <CellTextareaEditor
                          cell={cell}
                          index={index}
                          cellWidthMm={cellWidthMm}
                          cellHeightMm={contentGeometry.heightMm}
                          onChangeCellText={(cellId, line1, line2) =>
                            onChangeCellText(row.id, cellId, line1, line2)
                          }
                          onMoveCell={(cellId, direction) =>
                            onMoveCell(row.id, cellId, direction)
                          }
                          onClearSelection={onClearSelection}
                        />
                      </foreignObject>
                    )}
                  </g>
                )
              })}
            </g>
          )
        })}
      </svg>
      </div>
    </div>
  )
}
