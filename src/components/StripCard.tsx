import {
  CSS_PX_PER_MM,
  formatMillimeters,
  getCellWidthMm,
  getStripTotalHeightMm,
} from '../lib/dimensions'
import type { LabelStrip } from '../model/project'
import { MAX_NAME_LENGTH } from '../config/content-limits'
import { StripSvgEditor } from './StripSvgEditor'

interface StripCardProps {
  strip: LabelStrip
  index: number
  isActive: boolean
  selectedCellIds: readonly string[]
  editingCellId: string | undefined
  selectionLabel: string | undefined
  previewScale: number
  canMoveUp: boolean
  canMoveDown: boolean
  onActivate: () => void
  onRename: (name: string) => void
  onSelectCell: (cellId: string, extendSelection: boolean) => void
  onSelectGroupHeader: (startCellId: string, endCellId: string) => void
  onClearSelection: () => void
  onChangeCellText: (cellId: string, line1: string, line2: string) => void
  onMoveCell: (cellId: string, direction: -1 | 1) => void
  onDuplicate: () => void
  onDelete: () => void
  onMoveStrip: (direction: -1 | 1) => void
}

export function StripCard({
  strip,
  index,
  isActive,
  selectedCellIds,
  editingCellId,
  selectionLabel,
  previewScale,
  canMoveUp,
  canMoveDown,
  onActivate,
  onRename,
  onSelectCell,
  onSelectGroupHeader,
  onClearSelection,
  onChangeCellText,
  onMoveCell,
  onDuplicate,
  onDelete,
  onMoveStrip,
}: StripCardProps) {
  const cellWidthMm = getCellWidthMm(strip)
  const totalHeightMm = getStripTotalHeightMm(strip)
  const previewWidthPx =
    strip.dimensions.widthMm * CSS_PX_PER_MM * previewScale

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
              {formatMillimeters(strip.dimensions.widthMm)} ×{' '}
              {formatMillimeters(totalHeightMm)} mm
              <span>·</span>
              {strip.dimensions.cellCount} cells ×{' '}
              {formatMillimeters(cellWidthMm)} mm
            </p>
          </div>
        </div>

        <div className="strip-actions">
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
          <button className="button button-small button-danger" onClick={onDelete}>
            Delete strip
          </button>
        </div>
      </header>

      <div className="strip-scroll" onPointerDown={onActivate}>
        <div
          className="strip-ruler-track"
          style={{ width: previewWidthPx }}
          aria-hidden="true"
        >
          <span>0</span>
          <span>{formatMillimeters(strip.dimensions.widthMm / 2, 1)} mm</span>
          <span>{formatMillimeters(strip.dimensions.widthMm, 1)} mm</span>
        </div>
        <StripSvgEditor
          strip={strip}
          selectedCellIds={selectedCellIds}
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
          <i /> SVG geometry: {formatMillimeters(strip.dimensions.widthMm)} ×{' '}
          {formatMillimeters(totalHeightMm)} mm
        </span>
        <span>
          {selectionLabel
            ? `Selected: ${selectionLabel} · Shift-click extends range`
            : 'Click to edit · Shift-click selects range · Tab moves cell'}
        </span>
      </footer>
    </article>
  )
}
