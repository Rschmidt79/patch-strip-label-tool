import type { LabelProject, LabelStrip } from '../model/project'
import type { PdfLayoutPlan } from '../lib/pdf-layout'
import { PageLayoutPreview } from './PageLayoutPreview'
import { StripCard } from './StripCard'

interface WorkspaceProps {
  project: LabelProject
  strips: LabelStrip[]
  pageLayoutPlan: PdfLayoutPlan | undefined
  pageLayoutError: string | undefined
  includeSupportQr: boolean
  activeStripId: string | undefined
  selectedCellIds: readonly string[]
  editingCellId: string | undefined
  selectionLabel: string | undefined
  previewScale: number
  onPreviewScaleChange: (scale: number) => void
  onActivateStrip: (stripId: string) => void
  onRenameStrip: (stripId: string, name: string) => void
  onSelectCell: (
    stripId: string,
    cellId: string,
    extendSelection: boolean,
  ) => void
  onSelectGroupHeader: (
    stripId: string,
    startCellId: string,
    endCellId: string,
  ) => void
  onClearSelection: () => void
  onChangeCellText: (
    stripId: string,
    cellId: string,
    line1: string,
    line2: string,
  ) => void
  onMoveCell: (stripId: string, cellId: string, direction: -1 | 1) => void
  onAddStrip: () => void
  onDuplicateStrip: (stripId: string) => void
  onDeleteStrip: (stripId: string) => void
  onMoveStrip: (stripId: string, direction: -1 | 1) => void
}

export function Workspace({
  project,
  strips,
  pageLayoutPlan,
  pageLayoutError,
  includeSupportQr,
  activeStripId,
  selectedCellIds,
  editingCellId,
  selectionLabel,
  previewScale,
  onPreviewScaleChange,
  onActivateStrip,
  onRenameStrip,
  onSelectCell,
  onSelectGroupHeader,
  onClearSelection,
  onChangeCellText,
  onMoveCell,
  onAddStrip,
  onDuplicateStrip,
  onDeleteStrip,
  onMoveStrip,
}: WorkspaceProps) {
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
        {strips.map((strip, index) => (
          <StripCard
            key={strip.id}
            strip={strip}
            index={index}
            isActive={strip.id === activeStripId}
            selectedCellIds={
              strip.id === activeStripId ? selectedCellIds : []
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
            onSelectCell={(cellId, extendSelection) =>
              onSelectCell(strip.id, cellId, extendSelection)
            }
            onSelectGroupHeader={(startCellId, endCellId) =>
              onSelectGroupHeader(strip.id, startCellId, endCellId)
            }
            onClearSelection={onClearSelection}
            onChangeCellText={(cellId, line1, line2) =>
              onChangeCellText(strip.id, cellId, line1, line2)
            }
            onMoveCell={(cellId, direction) =>
              onMoveCell(strip.id, cellId, direction)
            }
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
            <button className="button button-primary" onClick={onAddStrip}>
              Add first strip
            </button>
          </div>
        )}
      </div>

      {strips.length > 0 && (
        <>
          <button className="add-strip-button" onClick={onAddStrip}>
            <span>+</span> Add strip
          </button>
          <PageLayoutPreview
            project={project}
            plan={pageLayoutPlan}
            error={pageLayoutError}
            includeSupportQr={includeSupportQr}
          />
        </>
      )}
    </main>
  )
}
