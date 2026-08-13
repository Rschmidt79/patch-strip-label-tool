import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PRINT_PREFERENCES,
  getEffectiveStripGapMm,
  PRINT_PREFERENCES_STORAGE_KEY,
  readStoredPrintPreferences,
  resolveInitialPrintPreferences,
  savePrintPreferences,
  type StorageLike,
} from '../src/lib/print-preferences'

function createMemoryStorage(): StorageLike & { values: Map<string, string> } {
  const values = new Map<string, string>()
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
  }
}

describe('local print preferences', () => {
  it('defaults to edge-to-edge while retaining a 2 mm custom value', () => {
    expect(DEFAULT_PRINT_PREFERENCES.spacingMode).toBe('edge-to-edge')
    expect(DEFAULT_PRINT_PREFERENCES.customGapMm).toBe(2)
    expect(getEffectiveStripGapMm(DEFAULT_PRINT_PREFERENCES)).toBe(0)
    expect(
      getEffectiveStripGapMm({
        ...DEFAULT_PRINT_PREFERENCES,
        spacingMode: 'custom',
      }),
    ).toBe(2)
  })

  it('round-trips all print settings through dedicated local storage', () => {
    const storage = createMemoryStorage()
    const preferences = {
      ...DEFAULT_PRINT_PREFERENCES,
      paperSize: 'A4' as const,
      orientation: 'portrait' as const,
      spacingMode: 'custom' as const,
      customGapMm: 3.5,
      autoArrange: false,
      cutLines: false,
      cropMarks: true,
    }

    expect(savePrintPreferences(storage, preferences)).toBe(true)
    expect(storage.values.has(PRINT_PREFERENCES_STORAGE_KEY)).toBe(true)
    expect(readStoredPrintPreferences(storage)).toEqual(preferences)
  })

  it.each(['SRA3', 'Letter', 'Legal', 'Tabloid'] as const)(
    'persists the %s paper size in local print preferences',
    (paperSize) => {
      const storage = createMemoryStorage()
      const preferences = {
        ...DEFAULT_PRINT_PREFERENCES,
        paperSize,
      }

      expect(savePrintPreferences(storage, preferences)).toBe(true)
      expect(readStoredPrintPreferences(storage)).toEqual(preferences)
    },
  )

  it('ignores malformed storage without throwing', () => {
    const storage = createMemoryStorage()
    storage.values.set(PRINT_PREFERENCES_STORAGE_KEY, '{bad json')
    expect(readStoredPrintPreferences(storage)).toBeUndefined()

    storage.values.set(
      PRINT_PREFERENCES_STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_PRINT_PREFERENCES, customGapMm: -1 }),
    )
    expect(readStoredPrintPreferences(storage)).toBeUndefined()
  })

  it('uses a legacy project gap only when no local preference exists', () => {
    const legacy = {
      size: 'A4' as const,
      orientation: 'portrait' as const,
      stripGapMm: 3.5,
    }
    const fromLegacy = resolveInitialPrintPreferences(undefined, legacy)
    expect(fromLegacy).toMatchObject({
      paperSize: 'A4',
      orientation: 'portrait',
      spacingMode: 'custom',
      customGapMm: 3.5,
    })

    const stored = {
      ...DEFAULT_PRINT_PREFERENCES,
      paperSize: 'A3' as const,
      spacingMode: 'edge-to-edge' as const,
    }
    expect(resolveInitialPrintPreferences(stored, legacy)).toEqual(stored)
  })
})
