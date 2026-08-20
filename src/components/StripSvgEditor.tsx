import {
  CSS_PX_PER_MM,
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
import type { LabelCell, LabelStrip } from '../model/project'
import { MAX_CELL_TEXT_LENGTH } from '../config/content-limits'
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

function editValue(cell: LabelCell): string {
  return cell.line2 ? `${cell.line1}\n${cell.line2}` : cell.line1
}

interface CellTextareaEditorProps {
  cell: LabelCell
  index: number
  onChangeCellText: (cellId: string, line1: string, line2: string) => void
  onMoveCell: (cellId: string, direction: -1 | 1) => void
  onClearSelection: () => void
}

function CellTextareaEditor({
  cell,
  index,
  onChangeCellText,
  onMoveCell,
  onClearSelection,
}: CellTextareaEditorProps) {
  return (
    <textarea
      className="svg-cell-input"
      autoFocus
      value={editValue(cell)}
      maxLength={MAX_CELL_TEXT_LENGTH * 2 + 1}
      aria-label={`Edit cell ${index + 1}, two lines maximum`}
      style={{
        textAlign: cell.style.alignment,
        fontSize: `${cell.style.fontSizePt * MM_PER_POINT}px`,
        fontWeight: cell.style.fontWeight === 'bold' ? 700 : 400,
        color: cell.appearance.textColor,
      }}
      onChange={(event) => {
        const rawValue = event.target.value.replace(/\r/g, '')
        const firstBreak = rawValue.indexOf('\n')
        const line1 = (
          firstBreak === -1 ? rawValue : rawValue.slice(0, firstBreak)
        ).slice(0, MAX_CELL_TEXT_LENGTH)
        const line2 =
          firstBreak === -1
            ? ''
            : rawValue
                .slice(firstBreak + 1)
                .replace(/\n/g, ' ')
                .slice(0, MAX_CELL_TEXT_LENGTH)
        onChangeCellText(cell.id, line1, line2)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Tab') {
          event.preventDefault()
          onMoveCell(cell.id, event.shiftKey ? -1 : 1)
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          onClearSelection()
        }
      }}
    />
  )
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
                    tabIndex={isSelected ? 0 : -1}
                    aria-selected={isSelected}
                    aria-label={`Row ${rowIndex + 1}, cell ${index + 1}: ${cell.line1} ${cell.line2}`}
                    onPointerDown={(event) => {
                      if (
                        event.target instanceof Element &&
                        event.target.closest('.svg-cell-input')
                      ) {
                        return
                      }
                      event.stopPropagation()
                      if (event.shiftKey) event.preventDefault()
                      onSelectCell(row.id, cell.id, event.shiftKey)
                    }}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return
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
                        x={cellX + 0.45}
                        y={contentTopMm + 0.4}
                        width={Math.max(0.5, cellWidthMm - 0.9)}
                        height={Math.max(0.5, contentGeometry.heightMm - 0.8)}
                      >
                        <CellTextareaEditor
                          cell={cell}
                          index={index}
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
