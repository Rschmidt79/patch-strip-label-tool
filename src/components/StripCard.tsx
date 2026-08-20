import {
  CSS_PX_PER_MM,
  formatMillimeters,
  getCellWidthMm,
  getStripTotalHeightMm,
  getStripWidthMm,
} from '../lib/dimensions'
import type { LabelStrip, LabelStripRow } from '../model/project'
import { MAX_NAME_LENGTH } from '../config/content-limits'
import { MAX_ROWS_PER_STRIP } from '../config/content-limits'
import { StripSvgEditor } from './StripSvgEditor'
import { RowDimensionsControls } from './RowDimensionsControls'

interface StripCardProps {
  strip: LabelStrip
  index: number
  isActive: boolean
  activeRowId: string | undefined
  isSelectedForJoin: boolean
  selectedCellIds: readonly string[]
  selectedHeaderId: string | undefined
  selectedCellCount: number
  editingCellId: string | undefined
  selectionLabel: string | undefined
  previewScale: number
  canMoveUp: boolean
  canMoveDown: boolean
  onActivate: () => void
  onActivateRow: (rowId: string) => void
  onSetRowCount: (rowCount: 1 | 2 | 3) => void
  onUpdateRow: (
    rowId: string,
    updater: (row: LabelStripRow) => LabelStripRow,
  ) => void
  onRename: (name: string) => void
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
  onToggleJoinSelection: () => void
  onAddRow: () => void
  onSplitRows: () => void
  onDuplicate: () => void
  onDelete: () => void
  onMoveStrip: (direction: -1 | 1) => void
}

export function StripCard({
  strip,
  index,
  isActive,
  activeRowId,
  isSelectedForJoin,
  selectedCellIds,
  selectedHeaderId,
  selectedCellCount,
  editingCellId,
  selectionLabel,
  previewScale,
  canMoveUp,
  canMoveDown,
  onActivate,
  onActivateRow,
  onSetRowCount,
  onUpdateRow,
  onRename,
  onSelectCell,
  onSelectGroupHeader,
  onClearSelection,
  onChangeCellText,
  onMoveCell,
  onToggleJoinSelection,
  onAddRow,
  onSplitRows,
  onDuplicate,
  onDelete,
  onMoveStrip,
}: StripCardProps) {
  const activeRow =
    strip.rows.find((row) => row.id === activeRowId) ?? strip.rows[0]
  const cellWidthMm = activeRow ? getCellWidthMm(activeRow) : 0
  const widthMm = getStripWidthMm(strip)
  const totalHeightMm = getStripTotalHeightMm(strip)
  const previewWidthPx = widthMm * CSS_PX_PER_MM * previewScale

  return (
    <article
      className={`strip-card ${isActive ? 'active' : ''}`}
      onPointerDown={onActivate}
    >
      <header className="strip-card-header">
        <div className="strip-identity">
          <span className="strip-index">{String(index + 1).padStart(2, '0')}</span>
          <div>
            <input
              className="strip-name-input"
              value={strip.name}
              maxLength={MAX_NAME_LENGTH}
              onChange={(event) => onRename(event.target.value)}
              aria-label={`Name of strip ${index + 1}`}
            />
            <p>
              {formatMillimeters(widthMm)} ×{' '}
              {formatMillimeters(totalHeightMm)} mm
              <span>·</span>
              {strip.rows.length} {strip.rows.length === 1 ? 'row' : 'rows'}
              {activeRow && (
                <>
                  <span>·</span>
                  active row: {activeRow.dimensions.cellCount} cells ×{' '}
                  {formatMillimeters(cellWidthMm)} mm
                </>
              )}
            </p>
          </div>
        </div>

        <div className="strip-actions">
          <label
            className="join-strip-toggle"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={isSelectedForJoin}
              onChange={onToggleJoinSelection}
            />
            Join
          </label>
          <button
            className="icon-button"
            onClick={() => onMoveStrip(-1)}
            disabled={!canMoveUp}
            aria-label="Move strip up"
            title="Move up"
          >
            ↑
          </button>
          <button
            className="icon-button"
            onClick={() => onMoveStrip(1)}
            disabled={!canMoveDown}
            aria-label="Move strip down"
            title="Move down"
          >
            ↓
          </button>
          <button className="button button-small" onClick={onDuplicate}>
            Duplicate
          </button>
          <button
            className="button button-small"
            onClick={onAddRow}
            disabled={strip.rows.length >= MAX_ROWS_PER_STRIP}
          >
            Add row
          </button>
          {strip.rows.length > 1 && (
            <button className="button button-small" onClick={onSplitRows}>
              Split rows
            </button>
          )}
          <button className="button button-small button-danger" onClick={onDelete}>
            Delete strip
          </button>
        </div>
      </header>

      <RowDimensionsControls
        strip={strip}
        activeRowId={activeRow?.id}
        onActivateRow={onActivateRow}
        onSetRowCount={onSetRowCount}
        onUpdateRow={onUpdateRow}
      />

      <div className="strip-scroll" onPointerDown={onActivate}>
        <div
          className="strip-ruler-track"
          style={{ width: previewWidthPx }}
          aria-hidden="true"
        >
          <span>0</span>
          <span>{formatMillimeters(widthMm / 2, 1)} mm</span>
          <span>{formatMillimeters(widthMm, 1)} mm</span>
        </div>
        <StripSvgEditor
          strip={strip}
          activeRowId={activeRowId}
          selectedCellIds={selectedCellIds}
          selectedHeaderId={selectedHeaderId}
          editingCellId={editingCellId}
          previewScale={previewScale}
          onSelectCell={onSelectCell}
          onSelectGroupHeader={onSelectGroupHeader}
          onClearSelection={onClearSelection}
          onChangeCellText={onChangeCellText}
          onMoveCell={onMoveCell}
        />
      </div>

      <footer className="strip-card-footer">
        <span className="dimension-status">
          <i /> SVG geometry: {formatMillimeters(widthMm)} ×{' '}
          {formatMillimeters(totalHeightMm)} mm
        </span>
        <span>
          {selectionLabel && selectedCellCount === 1
            ? 'Shift-click another cell in this row to select a range'
            : selectionLabel
              ? `Selected: ${selectionLabel} · Actions and formatting apply to this range`
              : 'Click to edit · Shift-click selects a range · Tab moves cell'}
        </span>
      </footer>
    </article>
  )
}
