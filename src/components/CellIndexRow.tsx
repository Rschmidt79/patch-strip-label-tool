import { getEditorCellIndices } from '../lib/editor-cell-indices'
import type { LabelCell } from '../model/project'

interface CellIndexRowProps {
  cells: readonly LabelCell[]
  selectedCellIds: readonly string[]
  widthPx: number
}

export function CellIndexRow({
  cells,
  selectedCellIds,
  widthPx,
}: CellIndexRowProps) {
  const indices = getEditorCellIndices(cells.length)

  return (
    <div
      className="cell-index-row"
      style={{
        width: widthPx,
        gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))`,
      }}
      aria-hidden="true"
      data-editor-only="cell-indices"
    >
      {indices.map((cellIndex, index) => (
        <span
          key={cells[index].id}
          className={
            selectedCellIds.includes(cells[index].id) ? 'selected' : undefined
          }
          data-cell-index={cellIndex}
        >
          {cellIndex}
        </span>
      ))}
    </div>
  )
}
