import { useState } from 'react'
import {
  CSS_PX_PER_MM,
  getCellWidthMm,
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
  selectedCellIds: readonly string[]
  editingCellId: string | undefined
  previewScale: number
  onSelectCell: (cellId: string, extendSelection: boolean) => void
  onSelectGroupHeader: (startCellId: string, endCellId: string) => void
  onClearSelection: () => void
  onChangeCellText: (cellId: string, line1: string, line2: string) => void
  onMoveCell: (cellId: string, direction: -1 | 1) => void
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
  const [draft, setDraft] = useState(() => editValue(cell))

  return (
    <textarea
      className="svg-cell-input"
      autoFocus
      value={draft}
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
        const nextDraft = firstBreak === -1 ? line1 : `${line1}\n${line2}`

        setDraft(nextDraft)
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
  selectedCellIds,
  editingCellId,
  previewScale,
  onSelectCell,
  onSelectGroupHeader,
  onClearSelection,
  onChangeCellText,
  onMoveCell,
}: StripSvgEditorProps) {
  const { widthMm, heightMm } = strip.dimensions
  const cellWidthMm = getCellWidthMm(strip)
  const totalHeightMm = heightMm
  const displayWidthPx = widthMm * CSS_PX_PER_MM * previewScale
  const displayHeightPx = totalHeightMm * CSS_PX_PER_MM * previewScale

  return (
    <div className="strip-editor-stack" style={{ width: displayWidthPx }}>
      <CellIndexRow
        cells={strip.cells}
        selectedCellIds={selectedCellIds}
        widthPx={displayWidthPx}
      />
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
        <StripArtwork
          strip={strip}
          hiddenCellIds={editingCellId ? [editingCellId] : []}
        />

        {strip.groupHeaders.map((header) => {
          const startCell = strip.cells[header.startCellIndex]
          const endCell = strip.cells[header.endCellIndex]
          const headerGeometry = getGroupHeaderGeometryMm(strip, header)
          const headerTopMm =
            heightMm - headerGeometry.yMm - headerGeometry.heightMm
          const isSelected = strip.cells
            .slice(header.startCellIndex, header.endCellIndex + 1)
            .every((cell) => selectedCellIds.includes(cell.id))
          if (!startCell || !endCell) return null
          return (
            <g
              key={`hit-${header.id}`}
              className="svg-group-header"
              role="button"
              tabIndex={0}
              aria-label={`Group header ${header.text}, cells ${header.startCellIndex + 1} through ${header.endCellIndex + 1}`}
              onPointerDown={(event) => {
                event.stopPropagation()
                onSelectGroupHeader(startCell.id, endCell.id)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelectGroupHeader(startCell.id, endCell.id)
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
                  width={
                    (header.endCellIndex - header.startCellIndex + 1) *
                      cellWidthMm -
                    0.2
                  }
                  height={Math.max(0, headerGeometry.heightMm - 0.2)}
                  className="cell-selection"
                  strokeWidth={0.35}
                />
              )}
            </g>
          )
        })}

        {strip.cells.map((cell, index) => {
          const cellX = index * cellWidthMm
          const contentGeometry = getCellContentGeometryMm(strip, index)
          const contentTopMm =
            heightMm - contentGeometry.yMm - contentGeometry.heightMm
          const isSelected = selectedCellIds.includes(cell.id)
          const isEditing = cell.id === editingCellId

          return (
            <g
              key={cell.id}
              className={`svg-cell ${isSelected ? 'selected' : ''} ${isEditing ? 'editing' : ''}`}
              role="button"
              tabIndex={isSelected ? 0 : -1}
              aria-selected={isSelected}
              aria-label={`Cell ${index + 1}: ${cell.line1} ${cell.line2}`}
              onPointerDown={(event) => {
                if (
                  event.target instanceof Element &&
                  event.target.closest('.svg-cell-input')
                ) {
                  return
                }
                event.stopPropagation()
                if (event.shiftKey) event.preventDefault()
                onSelectCell(cell.id, event.shiftKey)
              }}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelectCell(cell.id, event.shiftKey)
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
                <>
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
                      onChangeCellText={onChangeCellText}
                      onMoveCell={onMoveCell}
                      onClearSelection={onClearSelection}
                    />
                  </foreignObject>
                </>
              )}
            </g>
          )
        })}
      </svg>
      </div>
    </div>
  )
}
