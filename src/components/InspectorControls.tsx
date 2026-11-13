import { useEffect, useRef, useState } from 'react'
import { CELL_COLOR_PRESETS } from '../lib/cell-style'
import { getContrastingTextColor } from '../lib/colors'
import { shouldCommitNumberFieldBlur } from '../lib/number-field'
import type { CellAppearance, TextAlignment } from '../model/project'

interface NumberFieldProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  contextKey?: string
  /**
   * Apply the value only on blur or Enter, never while typing. Use this for
   * destructive values where an intermediate keystroke must not take effect.
   */
  commitOnBlur?: boolean
  /** Return false to reject the value; the field then shows the old value. */
  onChange: (value: number) => boolean | void
}

export function NumberField({
  label,
  value,
  min,
  max,
  step,
  unit,
  contextKey,
  commitOnBlur = false,
  onChange,
}: NumberFieldProps) {
  const formattedValue = String(Number(value.toFixed(3)))
  const [draft, setDraft] = useState(formattedValue)
  const inputRef = useRef<HTMLInputElement>(null)
  const focusedContextKeyRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    // Keep a focused draft while it still describes the stored value (for
    // example "4." while typing "4.5"), but follow outside changes such as
    // undo, presets, or another row becoming active.
    setDraft((current) =>
      document.activeElement === inputRef.current &&
      current !== '' &&
      Number(current) === Number(formattedValue)
        ? current
        : formattedValue,
    )
  }, [formattedValue])

  function commitDraft() {
    const parsedValue = Number(draft)
    const nextValue =
      draft !== '' && Number.isFinite(parsedValue)
        ? Math.min(max, Math.max(min, parsedValue))
        : value
    const accepted = nextValue === value || onChange(nextValue) !== false
    setDraft(accepted ? String(Number(nextValue.toFixed(3))) : formattedValue)
  }

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
          onFocus={() => {
            focusedContextKeyRef.current = contextKey
          }}
          onChange={(event) => {
            setDraft(event.target.value)
            if (commitOnBlur) return
            const nextValue = Number(event.target.value)
            if (
              event.target.value !== '' &&
              Number.isFinite(nextValue) &&
              nextValue >= min &&
              nextValue <= max
            ) {
              onChange(nextValue)
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commitDraft()
            }
          }}
          onBlur={() => {
            const shouldCommit = shouldCommitNumberFieldBlur(
              focusedContextKeyRef.current,
              contextKey,
            )
            focusedContextKeyRef.current = undefined
            if (!shouldCommit) {
              setDraft(formattedValue)
              return
            }
            commitDraft()
          }}
        />
        {unit && <em>{unit}</em>}
      </div>
    </label>
  )
}

export function AlignmentControl({
  value,
  onChange,
  label = 'Text alignment',
}: {
  value: TextAlignment
  onChange: (value: TextAlignment) => void
  label?: string
}) {
  return (
    <div className="segmented-control" aria-label={label}>
      {(['left', 'center', 'right'] as TextAlignment[]).map((alignment) => (
        <button
          key={alignment}
          className={value === alignment ? 'active' : ''}
          onClick={() => onChange(alignment)}
        >
          {alignment[0].toUpperCase() + alignment.slice(1)}
        </button>
      ))}
    </div>
  )
}

function ColorField({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string
  value: string | undefined
  fallback: string
  onChange: (value: string) => void
}) {
  return (
    <label className="color-field">
      <span>{label}</span>
      <input
        type="color"
        value={value ?? fallback}
        onChange={(event) => onChange(event.target.value)}
      />
      <code>{value ? value.toUpperCase() : 'MIXED'}</code>
    </label>
  )
}

export interface AppearanceValues {
  backgroundColor: string | undefined
  textColor: string | undefined
  borderColor?: string | undefined
}

export function AppearanceControls({
  values,
  showBorder = true,
  onChange,
  onShift,
  onReset,
  resetLabel = 'Reset style',
}: {
  values: AppearanceValues
  showBorder?: boolean
  onChange: (appearance: Partial<CellAppearance>) => void
  onShift: (direction: 'lighter' | 'darker') => void
  onReset: () => void
  resetLabel?: string
}) {
  return (
    <div className="appearance-controls">
      <div className="color-swatches" aria-label="Color presets">
        {CELL_COLOR_PRESETS.map((preset) => (
          <button
            key={preset.id}
            style={{ backgroundColor: preset.backgroundColor }}
            onClick={() =>
              onChange(
                showBorder
                  ? preset
                  : {
                      backgroundColor: preset.backgroundColor,
                      textColor: getContrastingTextColor(
                        preset.backgroundColor,
                      ),
                    },
              )
            }
            aria-label={`Apply ${preset.name}`}
            title={preset.name}
          />
        ))}
      </div>
      <div className="range-inline-actions three-actions">
        <button className="button button-small" onClick={() => onShift('lighter')}>
          Lighter
        </button>
        <button className="button button-small" onClick={() => onShift('darker')}>
          Darker
        </button>
        <button className="button button-small" onClick={onReset}>
          {resetLabel}
        </button>
      </div>
      <details className="advanced-options compact-advanced">
        <summary>Custom colors</summary>
        <div className="color-field-list">
          <ColorField
            label="Background"
            value={values.backgroundColor}
            fallback="#ffffff"
            onChange={(backgroundColor) => onChange({ backgroundColor })}
          />
          <ColorField
            label="Text"
            value={values.textColor}
            fallback="#101418"
            onChange={(textColor) => onChange({ textColor })}
          />
          {showBorder && (
            <ColorField
              label="Border"
              value={values.borderColor}
              fallback="#8c9490"
              onChange={(borderColor) => onChange({ borderColor })}
            />
          )}
        </div>
      </details>
    </div>
  )
}
