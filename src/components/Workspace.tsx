import { useState } from 'react'
import type { LabelProject, LabelStrip } from '../model/project'
import type { PrintLayoutPlan } from '../lib/print-layout'
import type { PrintPreferences } from '../lib/print-preferences'
import { PageLayoutPreview } from './PageLayoutPreview'
import { StripCard } from './StripCard'

interface WorkspaceProps {
  project: LabelProject
  strips: LabelStrip[]
  printPreferences: PrintPreferences
  pageLayoutPlan: PrintLayoutPlan | undefined
  pageLayoutError: string | undefined
  activeStripId: string | undefined
  activeRowId: string | undefined
  selectedJoinStripIds: readonly string[]
  joinError: string | undefined
  selectedCellIds: readonly string[]
  selectedCellCount: number
  editingCellId: string | undefined
  selectionLabel: string | undefined
  previewScale: number
  onPreviewScaleChange: (scale: number) => void
  onPrintPreferencesChange: (preferences: PrintPreferences) => void
  onActivateStrip: (stripId: string) => void
  onRenameStrip: (stripId: string, name: string) => void
  onSelectCell: (
    stripId: string,
    rowId: string,
    cellId: string,
    extendSelection: boolean,
  ) => void
  onSelectGroupHeader: (
    stripId: string,
    rowId: string,
    startCellId: string,
    endCellId: string,
  ) => void
  onClearSelection: () => void
  onChangeCellText: (
    stripId: string,
    rowId: string,
    cellId: string,
    line1: string,
    line2: string,
  ) => void
  onMoveCell: (
    stripId: string,
    rowId: string,
    cellId: string,
    direction: -1 | 1,
  ) => void
  onAddStrip: (rowCount: 1 | 2 | 3) => void
  onToggleJoinSelection: (stripId: string) => void
  onJoinStrips: () => void
  onAddRow: (stripId: string) => void
  onSplitRows: (stripId: string) => void
  onDuplicateStrip: (stripId: string) => void
  onDeleteStrip: (stripId: string) => void
  onMoveStrip: (stripId: string, direction: -1 | 1) => void
}

export function Workspace({
  project,
  strips,
  printPreferences,
  pageLayoutPlan,
  pageLayoutError,
  activeStripId,
  activeRowId,
  selectedJoinStripIds,
  joinError,
  selectedCellIds,
  selectedCellCount,
  editingCellId,
  selectionLabel,
  previewScale,
  onPreviewScaleChange,
  onPrintPreferencesChange,
  onActivateStrip,
  onRenameStrip,
  onSelectCell,
  onSelectGroupHeader,
  onClearSelection,
  onChangeCellText,
  onMoveCell,
  onAddStrip,
  onToggleJoinSelection,
  onJoinStrips,
  onAddRow,
  onSplitRows,
  onDuplicateStrip,
  onDeleteStrip,
  onMoveStrip,
}: WorkspaceProps) {
  const [newStripRowCount, setNewStripRowCount] = useState<1 | 2 | 3>(1)

  return (
    <main className="workspace">
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">Label strips</span>
          <h1>Direct editor</h1>
          <p>Edit the printed copy in place. Every strip uses millimeters.</p>
        </div>
        <label className="zoom-control">
          <span>Editor zoom</span>
          <select
            value={previewScale}
            onChange={(event) => onPreviewScaleChange(Number(event.target.value))}
          >
            <option value={1}>100%</option>
            <option value={1.35}>135%</option>
            <option value={1.5}>150%</option>
            <option value={1.7}>170%</option>
            <option value={2}>200%</option>
          </select>
        </label>
      </div>

      <div className="strip-list">
        {selectedJoinStripIds.length > 0 && (
          <div className="strip-join-bar" role="status">
            <span>
              {selectedJoinStripIds.length} selected for joining
              {joinError ? ` · ${joinError}` : ' · Order follows the editor'}
            </span>
            <button
              className="button button-small button-primary"
              disabled={joinError !== undefined}
              onClick={onJoinStrips}
            >
              Join strips
            </button>
          </div>
        )}
        {strips.map((strip, index) => (
          <StripCard
            key={strip.id}
            strip={strip}
            index={index}
            isActive={strip.id === activeStripId}
            activeRowId={strip.id === activeStripId ? activeRowId : undefined}
            isSelectedForJoin={selectedJoinStripIds.includes(strip.id)}
            selectedCellIds={
              strip.id === activeStripId ? selectedCellIds : []
            }
            selectedCellCount={
              strip.id === activeStripId ? selectedCellCount : 0
            }
            editingCellId={
              strip.id === activeStripId ? editingCellId : undefined
            }
            selectionLabel={
              strip.id === activeStripId ? selectionLabel : undefined
            }
            previewScale={previewScale}
            canMoveUp={index > 0}
            canMoveDown={index < strips.length - 1}
            onActivate={() => onActivateStrip(strip.id)}
            onRename={(name) => onRenameStrip(strip.id, name)}
            onSelectCell={(rowId, cellId, extendSelection) =>
              onSelectCell(strip.id, rowId, cellId, extendSelection)
            }
            onSelectGroupHeader={(rowId, startCellId, endCellId) =>
              onSelectGroupHeader(strip.id, rowId, startCellId, endCellId)
            }
            onClearSelection={onClearSelection}
            onChangeCellText={(rowId, cellId, line1, line2) =>
              onChangeCellText(strip.id, rowId, cellId, line1, line2)
            }
            onMoveCell={(rowId, cellId, direction) =>
              onMoveCell(strip.id, rowId, cellId, direction)
            }
            onToggleJoinSelection={() => onToggleJoinSelection(strip.id)}
            onAddRow={() => onAddRow(strip.id)}
            onSplitRows={() => onSplitRows(strip.id)}
            onDuplicate={() => onDuplicateStrip(strip.id)}
            onDelete={() => onDeleteStrip(strip.id)}
            onMoveStrip={(direction) => onMoveStrip(strip.id, direction)}
          />
        ))}

        {strips.length === 0 && (
          <div className="empty-workspace">
            <div className="empty-strip-graphic" aria-hidden="true">
              {Array.from({ length: 8 }, (_, index) => (
                <span key={index} />
              ))}
            </div>
            <h2>No label strips yet</h2>
            <p>Add a strip to start laying out rack labels.</p>
            <label className="add-strip-rows-field">
              <span>Rows</span>
              <select
                value={newStripRowCount}
                onChange={(event) =>
                  setNewStripRowCount(Number(event.target.value) as 1 | 2 | 3)
                }
              >
                <option value={1}>1 row</option>
                <option value={2}>2 rows</option>
                <option value={3}>3 rows</option>
              </select>
            </label>
            <button
              className="button button-primary"
              onClick={() => onAddStrip(newStripRowCount)}
            >
              Add first strip
            </button>
          </div>
        )}
      </div>

      {strips.length > 0 && (
        <>
          <div className="add-strip-controls">
            <label className="add-strip-rows-field">
              <span>New strip</span>
              <select
                aria-label="Rows in new strip"
                value={newStripRowCount}
                onChange={(event) =>
                  setNewStripRowCount(Number(event.target.value) as 1 | 2 | 3)
                }
              >
                <option value={1}>1 row</option>
                <option value={2}>2 rows</option>
                <option value={3}>3 rows</option>
              </select>
            </label>
            <button
              className="add-strip-button"
              onClick={() => onAddStrip(newStripRowCount)}
            >
              <span>+</span> Add strip
            </button>
          </div>
          <PageLayoutPreview
            project={project}
            preferences={printPreferences}
            plan={pageLayoutPlan}
            error={pageLayoutError}
            onPreferencesChange={onPrintPreferencesChange}
          />
        </>
      )}
    </main>
  )
}
