import { useEffect, useRef, useState } from 'react'
import { STRIP_PRESETS } from '../config/presets'
import { MAX_LABEL_TEXT_LENGTH } from '../config/content-limits'
import {
  formatSequenceNumber,
  insertNumberPlaceholder,
} from '../lib/auto-numbering'
import { CELL_COLOR_PRESETS } from '../lib/cell-style'
import type { CellRange } from '../lib/cell-range'
import {
  formatMillimeters,
  getCellWidthMm,
  getStripTotalHeightMm,
} from '../lib/dimensions'
import { resizeStripCells } from '../lib/strip'
import type {
  CellAppearance,
  GroupHeader,
  LabelCell,
  LabelStrip,
  PageOrientation,
  PageSettings,
  PageSize,
  TextAlignment,
} from '../model/project'

interface SidebarProps {
  page: PageSettings
  activeStrip: LabelStrip | undefined
  selectedCell: LabelCell | undefined
  selectedCellCount: number
  selectedRangeLabel: string | undefined
  selectedRange: CellRange | undefined
  selectedGroupHeader: GroupHeader | undefined
  includeSupportQr: boolean
  onPageChange: (page: PageSettings) => void
  onUpdateStrip: (updater: (strip: LabelStrip) => LabelStrip) => void
  onUpdateCell: (updater: (cell: LabelCell) => LabelCell) => void
  onAddGroupHeader: (text: string) => void
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
  onIncludeSupportQrChange: (include: boolean) => void
}

interface NumberFieldProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  onChange: (value: number) => void
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: NumberFieldProps) {
  const formattedValue = String(Number(value.toFixed(3)))
  const [draft, setDraft] = useState(formattedValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setDraft(formattedValue)
    }
  }, [formattedValue])

  return (
    <label className="field">
      <span>{label}</span>
      <div className="number-input">
        <input
          ref={inputRef}
          type="number"
          value={draft}
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            const rawValue = event.target.value
            setDraft(rawValue)
            if (rawValue === '') return

            const nextValue = Number(rawValue)
            if (
              Number.isFinite(nextValue) &&
              nextValue >= min &&
              nextValue <= max
            ) {
              onChange(nextValue)
            }
          }}
          onBlur={() => {
            const parsedValue = Number(draft)
            const nextValue = Number.isFinite(parsedValue)
              ? Math.min(max, Math.max(min, parsedValue))
              : value
            setDraft(String(Number(nextValue.toFixed(3))))
            onChange(nextValue)
          }}
        />
        {unit && <em>{unit}</em>}
      </div>
    </label>
  )
}

function PanelTitle({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="panel-title">
      <h2>{title}</h2>
      {meta && <span>{meta}</span>}
    </div>
  )
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="color-field">
      <span>{label}</span>
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <code>{value.toUpperCase()}</code>
    </label>
  )
}

function GroupHeaderTextEditor({
  header,
  onAdd,
  onUpdate,
  onRemove,
}: {
  header: GroupHeader | undefined
  onAdd: (text: string) => void
  onUpdate: (updater: (header: GroupHeader) => GroupHeader) => void
  onRemove: () => void
}) {
  const [draft, setDraft] = useState(header?.text ?? '')

  function submit() {
    if (!draft.trim()) return
    if (header) {
      onUpdate((current) => ({ ...current, text: draft.trim() }))
    } else {
      onAdd(draft)
    }
  }

  return (
    <>
      <label className="field">
        <span>Header text</span>
        <input
          value={draft}
          maxLength={MAX_LABEL_TEXT_LENGTH}
          placeholder="MICROPHONES"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || !draft.trim()) return
            event.preventDefault()
            submit()
          }}
        />
      </label>
      <div className="range-inline-actions">
        <button
          className="button button-primary"
          disabled={!draft.trim()}
          onClick={submit}
        >
          {header ? 'Save header' : 'Add group header'}
        </button>
        {header && (
          <button className="button button-danger" onClick={onRemove}>
            Delete header
          </button>
        )}
      </div>
    </>
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

export function Sidebar({
  page,
  activeStrip,
  selectedCell,
  selectedCellCount,
  selectedRangeLabel,
  selectedRange,
  selectedGroupHeader,
  includeSupportQr,
  onPageChange,
  onUpdateStrip,
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
  onIncludeSupportQrChange,
}: SidebarProps) {
  const matchingPreset = activeStrip
    ? STRIP_PRESETS.find(
        (preset) =>
          preset.widthMm === activeStrip.dimensions.widthMm &&
          preset.heightMm === activeStrip.dimensions.heightMm &&
          preset.cellCount === activeStrip.dimensions.cellCount,
      )?.id ?? 'custom'
    : 'custom'

  const cellWidthMm = activeStrip ? getCellWidthMm(activeStrip) : 0
  const totalHeightMm = activeStrip ? getStripTotalHeightMm(activeStrip) : 0
  const selectedAppearance =
    activeStrip && selectedRange
      ? activeStrip.cells[selectedRange.startIndex]?.appearance
      : undefined

  return (
    <aside className="sidebar">
      <section className="sidebar-panel">
        <PanelTitle title="Page setup" meta="Output" />
        <div className="field-row">
          <label className="field">
            <span>Paper</span>
            <select
              value={page.size}
              onChange={(event) =>
                onPageChange({ ...page, size: event.target.value as PageSize })
              }
            >
              <option value="A4">A4</option>
              <option value="A3">A3</option>
            </select>
          </label>
          <label className="field">
            <span>Orientation</span>
            <select
              value={page.orientation}
              onChange={(event) =>
                onPageChange({
                  ...page,
                  orientation: event.target.value as PageOrientation,
                })
              }
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </label>
        </div>
        <p className="panel-note">
          PDF rotates and packs strips automatically. Labels are never scaled
          to fit.
        </p>
        <label className="toggle-field pdf-qr-toggle">
          <span>
            <strong>Include support QR</strong>
            <small>PDF page decoration only; never part of a label.</small>
          </span>
          <input
            type="checkbox"
            checked={includeSupportQr}
            onChange={(event) =>
              onIncludeSupportQrChange(event.target.checked)
            }
          />
        </label>
      </section>

      <section className="sidebar-panel">
        <PanelTitle title="Strip dimensions" meta="Millimeters" />
        {activeStrip ? (
          <>
            <label className="field">
              <span>Preset</span>
              <select
                value={matchingPreset}
                onChange={(event) => {
                  const preset = STRIP_PRESETS.find(
                    (item) => item.id === event.target.value,
                  )
                  if (
                    preset?.widthMm === undefined ||
                    preset.heightMm === undefined ||
                    preset.cellCount === undefined
                  )
                    return

                  onUpdateStrip((strip) => {
                    const resized = resizeStripCells(strip, preset.cellCount!)
                    return {
                      ...resized,
                      dimensions: {
                        ...resized.dimensions,
                        widthMm: preset.widthMm!,
                        heightMm: preset.heightMm!,
                        cellWidthMode: 'equal',
                        customCellWidthMm:
                          preset.widthMm! / preset.cellCount!,
                      },
                    }
                  })
                }}
              >
                {(['Full-width rack', 'Other', 'Custom'] as const).map(
                  (group) => (
                    <optgroup key={group} label={group}>
                      {STRIP_PRESETS.filter(
                        (preset) => preset.group === group,
                      ).map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.name} — {preset.description}
                        </option>
                      ))}
                    </optgroup>
                  ),
                )}
              </select>
            </label>

            <div className="field-row">
              <NumberField
                label="Width"
                value={activeStrip.dimensions.widthMm}
                min={10}
                max={1200}
                step={0.1}
                unit="mm"
                onChange={(widthMm) =>
                  onUpdateStrip((strip) => ({
                    ...strip,
                    dimensions: {
                      ...strip.dimensions,
                      widthMm,
                      customCellWidthMm:
                        strip.dimensions.cellWidthMode === 'custom'
                          ? widthMm / strip.dimensions.cellCount
                          : strip.dimensions.customCellWidthMm,
                    },
                  }))
                }
              />
              <NumberField
                label="Cell row height"
                value={activeStrip.dimensions.heightMm}
                min={3}
                max={100}
                step={0.1}
                unit="mm"
                onChange={(heightMm) =>
                  onUpdateStrip((strip) => ({
                    ...strip,
                    dimensions: {
                      ...strip.dimensions,
                      heightMm,
                      groupHeaderBandHeightMm: Math.min(
                        strip.dimensions.groupHeaderBandHeightMm,
                        Math.max(0.5, heightMm - 0.5),
                      ),
                    },
                  }))
                }
              />
            </div>
            <div className="field-row">
              <NumberField
                label="Cells"
                value={activeStrip.dimensions.cellCount}
                min={1}
                max={64}
                step={1}
                onChange={(cellCount) =>
                  onUpdateStrip((strip) => resizeStripCells(strip, cellCount))
                }
              />
              <label className="field readonly-field">
                <span>Cell width</span>
                <output>{formatMillimeters(cellWidthMm)} mm</output>
              </label>
            </div>

            <details className="advanced-options">
              <summary>Advanced</summary>
              <NumberField
                label="Internal header band"
                value={activeStrip.dimensions.groupHeaderBandHeightMm}
                min={0.5}
                max={Math.max(0.5, activeStrip.dimensions.heightMm - 0.5)}
                step={0.1}
                unit="mm"
                onChange={(groupHeaderBandHeightMm) =>
                  onUpdateStrip((strip) => ({
                    ...strip,
                    dimensions: {
                      ...strip.dimensions,
                      groupHeaderBandHeightMm,
                    },
                  }))
                }
              />
              <label className="toggle-field">
                <span>
                  <strong>Enter cell width directly</strong>
                  <small>Total strip width follows cell width × cells.</small>
                </span>
                <input
                  type="checkbox"
                  checked={activeStrip.dimensions.cellWidthMode === 'custom'}
                  onChange={(event) =>
                    onUpdateStrip((strip) => ({
                      ...strip,
                      dimensions: {
                        ...strip.dimensions,
                        cellWidthMode: event.target.checked ? 'custom' : 'equal',
                        customCellWidthMm:
                          strip.dimensions.widthMm /
                          strip.dimensions.cellCount,
                      },
                    }))
                  }
                />
              </label>
              {activeStrip.dimensions.cellWidthMode === 'custom' && (
                <NumberField
                  label="Custom cell width"
                  value={activeStrip.dimensions.customCellWidthMm}
                  min={1}
                  max={250}
                  step={0.1}
                  unit="mm"
                  onChange={(customCellWidthMm) =>
                    onUpdateStrip((strip) => ({
                      ...strip,
                      dimensions: {
                        ...strip.dimensions,
                        customCellWidthMm,
                        widthMm:
                          customCellWidthMm * strip.dimensions.cellCount,
                      },
                    }))
                  }
                />
              )}
              <p className="panel-note">
                Physical output height: {formatMillimeters(totalHeightMm)} mm.
                Headers subdivide this height only where they exist.
              </p>
            </details>
          </>
        ) : (
          <p className="empty-panel">Add or select a strip to edit its size.</p>
        )}
      </section>

      <section className="sidebar-panel">
        <PanelTitle title="Text options" meta="Selected cell" />
        {selectedCell ? (
          <>
            <div className="segmented-control" aria-label="Text alignment">
              {(['left', 'center', 'right'] as TextAlignment[]).map(
                (alignment) => (
                  <button
                    key={alignment}
                    className={
                      selectedCell.style.alignment === alignment ? 'active' : ''
                    }
                    onClick={() =>
                      onUpdateCell((cell) => ({
                        ...cell,
                        style: { ...cell.style, alignment },
                      }))
                    }
                  >
                    {alignment[0].toUpperCase() + alignment.slice(1)}
                  </button>
                ),
              )}
            </div>

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
                className={`format-button ${
                  selectedCell.style.fontWeight === 'bold' ? 'active' : ''
                }`}
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
                aria-pressed={selectedCell.style.fontWeight === 'bold'}
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
          </>
        ) : (
          <p className="empty-panel">
            {selectedCellCount > 1
              ? 'Select one cell to edit its text style.'
              : 'Click a label cell to edit its text style.'}
          </p>
        )}
      </section>

      <section className="sidebar-panel range-actions-panel">
        <PanelTitle
          title="Selected range"
          meta={
            selectedRangeLabel
              ? `Selected: ${selectedRangeLabel}`
              : 'No cells selected'
          }
        />
        {activeStrip && selectedRange && selectedAppearance ? (
          <>
            <div className="range-action-group">
              <h3>Group header</h3>
              <GroupHeaderTextEditor
                key={selectedGroupHeader?.id ?? selectedRangeLabel}
                header={selectedGroupHeader}
                onAdd={onAddGroupHeader}
                onUpdate={onUpdateSelectedGroupHeader}
                onRemove={onRemoveSelectedGroupHeader}
              />
              {selectedGroupHeader && (
                <details className="advanced-options compact-advanced">
                  <summary>Header style</summary>
                  <div
                    className="segmented-control"
                    aria-label="Group header text alignment"
                  >
                    {(['left', 'center', 'right'] as TextAlignment[]).map(
                      (alignment) => (
                        <button
                          key={alignment}
                          className={
                            selectedGroupHeader.style.alignment === alignment
                              ? 'active'
                              : ''
                          }
                          onClick={() =>
                            onUpdateSelectedGroupHeader((header) => ({
                              ...header,
                              style: { ...header.style, alignment },
                            }))
                          }
                        >
                          {alignment[0].toUpperCase() + alignment.slice(1)}
                        </button>
                      ),
                    )}
                  </div>
                  <div className="field-row text-options-row">
                    <NumberField
                      label="Font size"
                      value={selectedGroupHeader.style.fontSizePt}
                      min={3.5}
                      max={24}
                      step={0.5}
                      unit="pt"
                      onChange={(fontSizePt) =>
                        onUpdateSelectedGroupHeader((header) => ({
                          ...header,
                          style: { ...header.style, fontSizePt },
                        }))
                      }
                    />
                    <button
                      className={`format-button ${
                        selectedGroupHeader.style.fontWeight === 'bold'
                          ? 'active'
                          : ''
                      }`}
                      onClick={() =>
                        onUpdateSelectedGroupHeader((header) => ({
                          ...header,
                          style: {
                            ...header.style,
                            fontWeight:
                              header.style.fontWeight === 'bold'
                                ? 'normal'
                                : 'bold',
                          },
                        }))
                      }
                    >
                      <b>B</b> Bold
                    </button>
                  </div>
                  <div className="color-field-list">
                    <ColorField
                      label="Background"
                      value={selectedGroupHeader.style.backgroundColor}
                      onChange={(backgroundColor) =>
                        onUpdateSelectedGroupHeader((header) => ({
                          ...header,
                          style: { ...header.style, backgroundColor },
                        }))
                      }
                    />
                    <ColorField
                      label="Text"
                      value={selectedGroupHeader.style.textColor}
                      onChange={(textColor) =>
                        onUpdateSelectedGroupHeader((header) => ({
                          ...header,
                          style: { ...header.style, textColor },
                        }))
                      }
                    />
                  </div>
                </details>
              )}
              {!selectedGroupHeader && activeStrip.groupHeaders.length > 0 && (
                <p className="panel-note">
                  Overlapping an existing header is rejected. Click a header in
                  the strip to select and edit its exact range.
                </p>
              )}
            </div>

            <div className="range-action-group range-style-group">
              <h3>Cell highlight</h3>
              <div className="color-swatches" aria-label="Cell color presets">
                {CELL_COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    style={{ backgroundColor: preset.backgroundColor }}
                    onClick={() => onApplyCellAppearance(preset)}
                    aria-label={`Apply ${preset.name} to ${selectedRangeLabel}`}
                    title={preset.name}
                  />
                ))}
              </div>
              <div className="range-inline-actions three-actions">
                <button
                  className="button button-small"
                  onClick={() => onShiftCellLightness('lighter')}
                >
                  Lighter
                </button>
                <button
                  className="button button-small"
                  onClick={() => onShiftCellLightness('darker')}
                >
                  Darker
                </button>
                <button
                  className="button button-small"
                  onClick={onResetSelectedCellStyle}
                >
                  Reset style
                </button>
              </div>
              <details className="advanced-options compact-advanced">
                <summary>Custom colors</summary>
                <div className="color-field-list">
                  <ColorField
                    label="Background"
                    value={selectedAppearance.backgroundColor}
                    onChange={(backgroundColor) =>
                      onApplyCellAppearance({ backgroundColor })
                    }
                  />
                  <ColorField
                    label="Text"
                    value={selectedAppearance.textColor}
                    onChange={(textColor) =>
                      onApplyCellAppearance({ textColor })
                    }
                  />
                  <ColorField
                    label="Border"
                    value={selectedAppearance.borderColor}
                    onChange={(borderColor) =>
                      onApplyCellAppearance({ borderColor })
                    }
                  />
                </div>
              </details>
            </div>

            <button
              className="button button-danger range-clear-button"
              onClick={onClearSelectedCells}
            >
              Clear selected cells
            </button>
          </>
        ) : (
          <p className="empty-panel">
            Select one cell or Shift-click a range to use group headers and
            highlights.
          </p>
        )}
      </section>

      <section className="sidebar-panel auto-numbering-panel">
        <PanelTitle
          title="Auto numbering"
          meta={
            selectedRangeLabel
              ? `Selected: ${selectedRangeLabel}`
              : 'No cells selected'
          }
        />
        {activeStrip ? (
          <>
            <AutoNumberTemplateField
              label="Line 1 template"
              value={activeStrip.autoNumbering.line1Template}
              placeholder="Router Out"
              onChange={(line1Template) =>
                onUpdateStrip((strip) => ({
                  ...strip,
                  autoNumbering: {
                    ...strip.autoNumbering,
                    line1Template,
                  },
                }))
              }
            />
            <AutoNumberTemplateField
              label="Line 2 template"
              value={activeStrip.autoNumbering.line2Template}
              placeholder="{n}"
              onChange={(line2Template) =>
                onUpdateStrip((strip) => ({
                  ...strip,
                  autoNumbering: {
                    ...strip.autoNumbering,
                    line2Template,
                  },
                }))
              }
            />
            <div className="field-row">
              <NumberField
                label="Start number"
                value={activeStrip.autoNumbering.startNumber}
                min={-999999}
                max={999999}
                step={1}
                onChange={(startNumber) =>
                  onUpdateStrip((strip) => ({
                    ...strip,
                    autoNumbering: {
                      ...strip.autoNumbering,
                      startNumber: Math.trunc(startNumber),
                    },
                  }))
                }
              />
              <NumberField
                label="Digit padding"
                value={activeStrip.autoNumbering.digits}
                min={1}
                max={12}
                step={1}
                onChange={(digits) =>
                  onUpdateStrip((strip) => ({
                    ...strip,
                    autoNumbering: {
                      ...strip.autoNumbering,
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
                  activeStrip.autoNumbering.startNumber,
                  activeStrip.autoNumbering.digits,
                )}
                {' → '}
                {formatSequenceNumber(
                  activeStrip.autoNumbering.startNumber +
                    (selectedCellCount || activeStrip.dimensions.cellCount) -
                    1,
                  activeStrip.autoNumbering.digits,
                )}
              </code>
            </div>
            <div className="numbering-actions">
              <button
                className="button button-primary apply-numbering-button"
                onClick={onApplyAutoNumberingToSelection}
                disabled={selectedCellCount === 0}
              >
                {selectedRangeLabel
                  ? `Apply to ${selectedRangeLabel.toLowerCase()}`
                  : 'Apply to selected cells'}
              </button>
              <button
                className="button numbering-secondary-button"
                onClick={onApplyAutoNumberingToAll}
              >
                Apply to all {activeStrip.dimensions.cellCount} cells
              </button>
            </div>
            <p className="panel-note numbering-note">
              Selected apply never changes cells outside the highlighted range.
              Use <code>{'{n}'}</code> anywhere in either template; cells remain
              editable afterwards.
            </p>
          </>
        ) : (
          <p className="empty-panel">
            Add or select a strip to configure numbering.
          </p>
        )}
      </section>
    </aside>
  )
}
