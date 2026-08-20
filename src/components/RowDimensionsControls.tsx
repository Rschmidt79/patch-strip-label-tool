import { useState } from 'react'
import { STRIP_PRESETS } from '../config/presets'
import {
  formatMillimeters,
  getCellWidthMm,
  getStripTotalHeightMm,
} from '../lib/dimensions'
import { resizeStripCells } from '../lib/strip'
import type { LabelStrip, LabelStripRow } from '../model/project'
import { NumberField } from './InspectorControls'

export function RowDimensionsControls({
  strip,
  activeRowId,
  onActivateRow,
  onSetRowCount,
  onUpdateRow,
}: {
  strip: LabelStrip
  activeRowId: string | undefined
  onActivateRow: (rowId: string) => void
  onSetRowCount: (rowCount: 1 | 2 | 3) => void
  onUpdateRow: (
    rowId: string,
    updater: (row: LabelStripRow) => LabelStripRow,
  ) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const activeRow =
    strip.rows.find((row) => row.id === activeRowId) ?? strip.rows[0]
  if (!activeRow) return null

  const matchingPreset =
    STRIP_PRESETS.find(
      (preset) =>
        preset.widthMm === activeRow.dimensions.widthMm &&
        preset.heightMm === activeRow.dimensions.heightMm &&
        preset.cellCount === activeRow.dimensions.cellCount,
    )?.id ?? 'custom'

  const update = (updater: (row: LabelStripRow) => LabelStripRow) =>
    onUpdateRow(activeRow.id, updater)

  return (
    <section
      className={`row-dimensions ${expanded ? 'expanded' : ''}`}
      onPointerDown={(event) => {
        event.stopPropagation()
        onActivateRow(activeRow.id)
      }}
    >
      <div className="row-dimensions-bar">
        <label className="row-count-field">
          <span>Rows in strip</span>
          <select
            aria-label="Rows in strip"
            value={strip.rows.length <= 3 ? strip.rows.length : 'custom'}
            onChange={(event) => {
              if (event.target.value === 'custom') return
              onSetRowCount(Number(event.target.value) as 1 | 2 | 3)
            }}
          >
            <option value={1}>1 row</option>
            <option value={2}>2 rows</option>
            <option value={3}>3 rows</option>
            {strip.rows.length > 3 && (
              <option value="custom">{strip.rows.length} rows · custom</option>
            )}
          </select>
        </label>
        <div className="active-row-control">
          <span>Edit row</span>
          <div className="row-tabs" aria-label="Active physical row">
            {strip.rows.map((row, index) => (
              <button
                key={row.id}
                className={row.id === activeRow.id ? 'active' : ''}
                onClick={() => onActivateRow(row.id)}
              >
                Row {index + 1}
              </button>
            ))}
          </div>
        </div>
        <label className="row-preset-field">
          <span>Preset</span>
          <select
            aria-label="Row preset"
            value={matchingPreset}
            onChange={(event) => {
              const preset = STRIP_PRESETS.find(
                (item) => item.id === event.target.value,
              )
              if (
                preset?.widthMm === undefined ||
                preset.heightMm === undefined ||
                preset.cellCount === undefined
              ) return

              update((row) => {
                const resized = resizeStripCells(row, preset.cellCount!)
                return {
                  ...resized,
                  dimensions: {
                    ...resized.dimensions,
                    widthMm: preset.widthMm!,
                    heightMm: preset.heightMm!,
                    cellWidthMode: 'equal',
                    customCellWidthMm: preset.widthMm! / preset.cellCount!,
                  },
                }
              })
            }}
          >
            {(['Full-width rack', 'Other', 'Custom'] as const).map((group) => (
              <optgroup key={group} label={group}>
                {STRIP_PRESETS.filter((preset) => preset.group === group).map(
                  (preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name} — {preset.description}
                    </option>
                  ),
                )}
              </optgroup>
            ))}
          </select>
        </label>
        <span className="row-dimensions-summary">
          {formatMillimeters(activeRow.dimensions.widthMm)} ×{' '}
          {formatMillimeters(activeRow.dimensions.heightMm)} mm ·{' '}
          {activeRow.dimensions.cellCount} cells
        </span>
        <button
          className="button button-small"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? 'Close dimensions' : 'Custom dimensions…'}
        </button>
      </div>

      {expanded && (
        <div className="row-dimensions-panel">
          <div className="field-row">
            <NumberField
              label="Width"
              value={activeRow.dimensions.widthMm}
              min={10}
              max={1200}
              step={0.1}
              unit="mm"
              onChange={(widthMm) =>
                update((row) => ({
                  ...row,
                  dimensions: {
                    ...row.dimensions,
                    widthMm,
                    customCellWidthMm:
                      row.dimensions.cellWidthMode === 'custom'
                        ? widthMm / row.dimensions.cellCount
                        : row.dimensions.customCellWidthMm,
                  },
                }))
              }
            />
            <NumberField
              label="Cell row height"
              value={activeRow.dimensions.heightMm}
              min={3}
              max={100}
              step={0.1}
              unit="mm"
              onChange={(heightMm) =>
                update((row) => ({
                  ...row,
                  dimensions: {
                    ...row.dimensions,
                    heightMm,
                    groupHeaderBandHeightMm: Math.min(
                      row.dimensions.groupHeaderBandHeightMm,
                      Math.max(0.5, heightMm - 0.5),
                    ),
                  },
                }))
              }
            />
            <NumberField
              label="Cells"
              value={activeRow.dimensions.cellCount}
              min={1}
              max={64}
              step={1}
              onChange={(cellCount) =>
                update((row) => resizeStripCells(row, Math.trunc(cellCount)))
              }
            />
            <label className="field readonly-field">
              <span>Cell width</span>
              <output>{formatMillimeters(getCellWidthMm(activeRow))} mm</output>
            </label>
          </div>
          <details className="advanced-options">
            <summary>Advanced</summary>
            <div className="row-dimensions-advanced">
              <NumberField
                label="Internal header band"
                value={activeRow.dimensions.groupHeaderBandHeightMm}
                min={0.5}
                max={Math.max(0.5, activeRow.dimensions.heightMm - 0.5)}
                step={0.1}
                unit="mm"
                onChange={(groupHeaderBandHeightMm) =>
                  update((row) => ({
                    ...row,
                    dimensions: { ...row.dimensions, groupHeaderBandHeightMm },
                  }))
                }
              />
              <label className="toggle-field">
                <span>
                  <strong>Enter cell width directly</strong>
                  <small>Total width follows cell width × cells.</small>
                </span>
                <input
                  type="checkbox"
                  checked={activeRow.dimensions.cellWidthMode === 'custom'}
                  onChange={(event) =>
                    update((row) => ({
                      ...row,
                      dimensions: {
                        ...row.dimensions,
                        cellWidthMode: event.target.checked ? 'custom' : 'equal',
                        customCellWidthMm:
                          row.dimensions.widthMm / row.dimensions.cellCount,
                      },
                    }))
                  }
                />
              </label>
              {activeRow.dimensions.cellWidthMode === 'custom' && (
                <NumberField
                  label="Custom cell width"
                  value={activeRow.dimensions.customCellWidthMm}
                  min={1}
                  max={250}
                  step={0.1}
                  unit="mm"
                  onChange={(customCellWidthMm) =>
                    update((row) => ({
                      ...row,
                      dimensions: {
                        ...row.dimensions,
                        customCellWidthMm,
                        widthMm: customCellWidthMm * row.dimensions.cellCount,
                      },
                    }))
                  }
                />
              )}
              <p className="panel-note">
                Physical output height: {formatMillimeters(getStripTotalHeightMm(strip))} mm.
              </p>
            </div>
          </details>
        </div>
      )}
    </section>
  )
}
