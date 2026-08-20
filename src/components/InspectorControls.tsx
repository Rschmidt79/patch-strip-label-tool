import { useEffect, useRef, useState } from 'react'
import { CELL_COLOR_PRESETS } from '../lib/cell-style'
import { getContrastingTextColor } from '../lib/colors'
import type { CellAppearance, TextAlignment } from '../model/project'

interface NumberFieldProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  onChange: (value: number) => void
}

export function NumberField({
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
    if (document.activeElement !== inputRef.current) setDraft(formattedValue)
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
            setDraft(event.target.value)
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
