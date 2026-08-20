import { useRef, useState } from 'react'
import { MAX_LABEL_TEXT_LENGTH } from '../config/content-limits'
import {
  formatSequenceNumber,
  insertNumberPlaceholder,
} from '../lib/auto-numbering'
import type { CellRange } from '../lib/cell-range'
import {
  getContrastingTextColor,
  shiftHexColorLightness,
} from '../lib/colors'
import type { EditorSelection } from '../lib/editor-selection'
import { DEFAULT_GROUP_HEADER_STYLE } from '../model/defaults'
import type {
  CellAppearance,
  GroupHeader,
  LabelCell,
  LabelStripRow,
} from '../model/project'
import {
  AlignmentControl,
  AppearanceControls,
  NumberField,
  type AppearanceValues,
} from './InspectorControls'

interface SidebarProps {
  selectionKind: EditorSelection['kind'] | undefined
  activeRow: LabelStripRow | undefined
  selectedCell: LabelCell | undefined
  selectedCellCount: number
  selectedRangeLabel: string | undefined
  selectedRange: CellRange | undefined
  selectedGroupHeader: GroupHeader | undefined
  onUpdateRow: (updater: (row: LabelStripRow) => LabelStripRow) => void
  onUpdateCell: (updater: (cell: LabelCell) => LabelCell) => void
  onAddGroupHeader: () => void
  onUpdateSelectedGroupHeader: (
    updater: (header: GroupHeader) => GroupHeader,
  ) => void
  onRemoveSelectedGroupHeader: () => void
  onApplyCellAppearance: (appearance: Partial<CellAppearance>) => void
  onShiftCellLightness: (direction: 'lighter' | 'darker') => void
  onResetSelectedCellStyle: () => void
  onApplyAutoNumberingToSelection: () => void
  onApplyAutoNumberingToAll: () => void
  onClearSelectedCells: () => void
}

function PanelTitle({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="panel-title">
      <h2>{title}</h2>
      {meta && <span>{meta}</span>}
    </div>
  )
}

function commonValue<T>(values: readonly T[]): T | undefined {
  const first = values[0]
  return values.length > 0 && values.every((value) => value === first)
    ? first
    : undefined
}

function HeaderTextField({
  header,
  onUpdate,
}: {
  header: GroupHeader
  onUpdate: (text: string) => void
}) {
  const [draft, setDraft] = useState(header.text)

  function save() {
    if (draft.trim()) onUpdate(draft.trim())
  }

  return (
    <div className="cell-copy-fields">
      <label className="field">
        <span>Header text</span>
        <input
          value={draft}
          maxLength={MAX_LABEL_TEXT_LENGTH}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && draft.trim()) {
              event.preventDefault()
              save()
            }
          }}
        />
      </label>
      <button
        className="button button-primary"
        disabled={!draft.trim() || draft.trim() === header.text}
        onClick={save}
      >
        Save header
      </button>
    </div>
  )
}

function AutoNumberTemplateField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  placeholder: string
  onChange: (value: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  function insertToken() {
    const insertion = insertNumberPlaceholder(
      value,
      inputRef.current?.selectionStart,
      inputRef.current?.selectionEnd,
    )
    onChange(insertion.value)
    window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(
        insertion.cursorIndex,
        insertion.cursorIndex,
      )
    })
  }

  return (
    <div className="field auto-template-field">
      <span>{label}</span>
      <div className="auto-template-control">
        <input
          ref={inputRef}
          value={value}
          maxLength={MAX_LABEL_TEXT_LENGTH}
          placeholder={placeholder}
          aria-label={label}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          onClick={insertToken}
          aria-label={`Insert sequence number into ${label}`}
          title="Insert {n} — replaced with the sequence number"
        >
          #
        </button>
      </div>
    </div>
  )
}

function NumberingControls({
  row,
  selectedCellCount,
  selectedRangeLabel,
  onUpdateRow,
  onApplySelection,
  onApplyAll,
}: {
  row: LabelStripRow
  selectedCellCount: number
  selectedRangeLabel: string | undefined
  onUpdateRow: (updater: (row: LabelStripRow) => LabelStripRow) => void
  onApplySelection: () => void
  onApplyAll: () => void
}) {
  return (
    <div className="numbering-controls">
      <AutoNumberTemplateField
        label="Line 1"
        value={row.autoNumbering.line1Template}
        placeholder="Router Out"
        onChange={(line1Template) =>
          onUpdateRow((current) => ({
            ...current,
            autoNumbering: { ...current.autoNumbering, line1Template },
          }))
        }
      />
      <AutoNumberTemplateField
        label="Line 2"
        value={row.autoNumbering.line2Template}
        placeholder="{n}"
        onChange={(line2Template) =>
          onUpdateRow((current) => ({
            ...current,
            autoNumbering: { ...current.autoNumbering, line2Template },
          }))
        }
      />
      <div className="field-row">
        <NumberField
          label="Start number"
          value={row.autoNumbering.startNumber}
          min={-999999}
          max={999999}
          step={1}
          onChange={(startNumber) =>
            onUpdateRow((current) => ({
              ...current,
              autoNumbering: {
                ...current.autoNumbering,
                startNumber: Math.trunc(startNumber),
              },
            }))
          }
        />
        <NumberField
          label="Digit padding"
          value={row.autoNumbering.digits}
          min={1}
          max={12}
          step={1}
          onChange={(digits) =>
            onUpdateRow((current) => ({
              ...current,
              autoNumbering: {
                ...current.autoNumbering,
                digits: Math.trunc(digits),
              },
            }))
          }
        />
      </div>
      <div className="numbering-preview">
        <span>Preview</span>
        <code>
          {formatSequenceNumber(
            row.autoNumbering.startNumber,
            row.autoNumbering.digits,
          )}
          {' → '}
          {formatSequenceNumber(
            row.autoNumbering.startNumber +
              (selectedCellCount || row.dimensions.cellCount) -
              1,
            row.autoNumbering.digits,
          )}
        </code>
      </div>
      <div className="numbering-actions">
        <button
          className="button button-primary"
          disabled={selectedCellCount === 0}
          onClick={onApplySelection}
        >
          {selectedRangeLabel
            ? `Apply to ${selectedRangeLabel.toLowerCase()}`
            : 'Apply to selection'}
        </button>
        <button className="button" onClick={onApplyAll}>
          Apply to all {row.dimensions.cellCount} cells
        </button>
      </div>
    </div>
  )
}

export function Sidebar({
  selectionKind,
  activeRow,
  selectedCell,
  selectedCellCount,
  selectedRangeLabel,
  selectedRange,
  selectedGroupHeader,
  onUpdateRow,
  onUpdateCell,
  onAddGroupHeader,
  onUpdateSelectedGroupHeader,
  onRemoveSelectedGroupHeader,
  onApplyCellAppearance,
  onShiftCellLightness,
  onResetSelectedCellStyle,
  onApplyAutoNumberingToSelection,
  onApplyAutoNumberingToAll,
  onClearSelectedCells,
}: SidebarProps) {
  const selectedCells =
    activeRow && selectedRange
      ? activeRow.cells.slice(
          selectedRange.startIndex,
          selectedRange.endIndex + 1,
        )
      : []
  const cellAppearance: AppearanceValues = {
    backgroundColor: commonValue(
      selectedCells.map((cell) => cell.appearance.backgroundColor),
    ),
    textColor: commonValue(
      selectedCells.map((cell) => cell.appearance.textColor),
    ),
    borderColor: commonValue(
      selectedCells.map((cell) => cell.appearance.borderColor),
    ),
  }

  if (!selectionKind || (!selectedRange && !selectedGroupHeader)) {
    return (
      <aside className="sidebar inspector-sidebar">
        <section className="sidebar-panel inspector-empty">
          <span className="eyebrow">Inspector</span>
          <h2>Select something to edit</h2>
          <p>
            Click a cell, Shift-click a range, or click a group header directly.
            Row dimensions now live with each strip.
          </p>
        </section>
      </aside>
    )
  }

  if (selectionKind === 'header' && selectedGroupHeader) {
    const header = selectedGroupHeader
    return (
      <aside className="sidebar inspector-sidebar">
        <section className="sidebar-panel inspector-heading-panel">
          <PanelTitle title="Group header" meta="Header" />
          <HeaderTextField
            key={header.id}
            header={header}
            onUpdate={(text) =>
              onUpdateSelectedGroupHeader((current) => ({ ...current, text }))
            }
          />
        </section>
        <section className="sidebar-panel">
          <PanelTitle title="Typography" />
          <AlignmentControl
            value={header.style.alignment}
            label="Group header text alignment"
            onChange={(alignment) =>
              onUpdateSelectedGroupHeader((current) => ({
                ...current,
                style: { ...current.style, alignment },
              }))
            }
          />
          <div className="field-row text-options-row">
            <NumberField
              label="Font size"
              value={header.style.fontSizePt}
              min={3.5}
              max={24}
              step={0.5}
              unit="pt"
              onChange={(fontSizePt) =>
                onUpdateSelectedGroupHeader((current) => ({
                  ...current,
                  style: { ...current.style, fontSizePt },
                }))
              }
            />
            <button
              className={`format-button ${header.style.fontWeight === 'bold' ? 'active' : ''}`}
              aria-pressed={header.style.fontWeight === 'bold'}
              onClick={() =>
                onUpdateSelectedGroupHeader((current) => ({
                  ...current,
                  style: {
                    ...current.style,
                    fontWeight:
                      current.style.fontWeight === 'bold' ? 'normal' : 'bold',
                  },
                }))
              }
            >
              <b>B</b> Bold
            </button>
          </div>
        </section>
        <section className="sidebar-panel">
          <PanelTitle title="Appearance" />
          <AppearanceControls
            showBorder={false}
            values={{
              backgroundColor: header.style.backgroundColor,
              textColor: header.style.textColor,
            }}
            onChange={(appearance) =>
              onUpdateSelectedGroupHeader((current) => ({
                ...current,
                style: {
                  ...current.style,
                  ...(appearance.backgroundColor
                    ? { backgroundColor: appearance.backgroundColor }
                    : {}),
                  ...(appearance.textColor
                    ? { textColor: appearance.textColor }
                    : {}),
                },
              }))
            }
            onShift={(direction) =>
              onUpdateSelectedGroupHeader((current) => {
                const backgroundColor = shiftHexColorLightness(
                  current.style.backgroundColor,
                  direction,
                )
                return {
                  ...current,
                  style: {
                    ...current.style,
                    backgroundColor,
                    textColor: getContrastingTextColor(backgroundColor),
                  },
                }
              })
            }
            onReset={() =>
              onUpdateSelectedGroupHeader((current) => ({
                ...current,
                style: { ...DEFAULT_GROUP_HEADER_STYLE },
              }))
            }
          />
        </section>
        <section className="sidebar-panel">
          <details className="inspector-options" open>
            <summary>Options</summary>
            <button
              className="button button-danger range-clear-button"
              onClick={onRemoveSelectedGroupHeader}
            >
              Delete header
            </button>
            <p className="panel-note">The cells beneath the header are unchanged.</p>
          </details>
        </section>
      </aside>
    )
  }

  if (!activeRow || !selectedRange) return null

  return (
    <aside className="sidebar inspector-sidebar">
      <section className="sidebar-panel inspector-heading-panel">
        <PanelTitle
          title="Text input"
          meta={selectedRangeLabel ? `Selected: ${selectedRangeLabel}` : undefined}
        />
        <div className="inspector-primary-actions">
          <button
            className="button button-small add-header-action"
            onClick={onAddGroupHeader}
          >
            + Add header
          </button>
          <button
            className="button button-small button-danger"
            onClick={onClearSelectedCells}
          >
            Clear
          </button>
        </div>
        <NumberingControls
          row={activeRow}
          selectedCellCount={selectedCellCount}
          selectedRangeLabel={selectedRangeLabel}
          onUpdateRow={onUpdateRow}
          onApplySelection={onApplyAutoNumberingToSelection}
          onApplyAll={onApplyAutoNumberingToAll}
        />
      </section>

      {selectedCell && (
        <section className="sidebar-panel">
          <PanelTitle title="Typography" />
          <AlignmentControl
            value={selectedCell.style.alignment}
            onChange={(alignment) =>
              onUpdateCell((cell) => ({
                ...cell,
                style: { ...cell.style, alignment },
              }))
            }
          />
          <div className="field-row text-options-row">
            <NumberField
              label="Font size"
              value={selectedCell.style.fontSizePt}
              min={3.5}
              max={24}
              step={0.5}
              unit="pt"
              onChange={(fontSizePt) =>
                onUpdateCell((cell) => ({
                  ...cell,
                  style: { ...cell.style, fontSizePt },
                }))
              }
            />
            <button
              className={`format-button ${selectedCell.style.fontWeight === 'bold' ? 'active' : ''}`}
              aria-pressed={selectedCell.style.fontWeight === 'bold'}
              onClick={() =>
                onUpdateCell((cell) => ({
                  ...cell,
                  style: {
                    ...cell.style,
                    fontWeight:
                      cell.style.fontWeight === 'bold' ? 'normal' : 'bold',
                  },
                }))
              }
            >
              <b>B</b> Bold
            </button>
          </div>
          <label className="toggle-field compact-toggle">
            <span>
              <strong>Auto-fit text</strong>
              <small>Reduce size only when text is too wide.</small>
            </span>
            <input
              type="checkbox"
              checked={selectedCell.style.autoFit}
              onChange={(event) =>
                onUpdateCell((cell) => ({
                  ...cell,
                  style: { ...cell.style, autoFit: event.target.checked },
                }))
              }
            />
          </label>
        </section>
      )}

      <section className="sidebar-panel">
        <PanelTitle title="Appearance" meta={selectedCellCount > 1 ? 'Range' : undefined} />
        <AppearanceControls
          values={cellAppearance}
          resetLabel="Reset"
          onChange={onApplyCellAppearance}
          onShift={onShiftCellLightness}
          onReset={onResetSelectedCellStyle}
        />
      </section>

    </aside>
  )
}
