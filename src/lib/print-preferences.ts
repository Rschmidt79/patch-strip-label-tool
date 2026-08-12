import type {
  PageOrientation,
  PageSettings,
  PageSize,
} from '../model/project'

export const PRINT_PREFERENCES_STORAGE_KEY =
  'rack-label-maker.print-preferences.v1'
export const DEFAULT_CUSTOM_STRIP_GAP_MM = 2
export const MIN_CUSTOM_STRIP_GAP_MM = 0
export const MAX_CUSTOM_STRIP_GAP_MM = 20

export type StripSpacingMode = 'edge-to-edge' | 'custom'

export interface PrintPreferences {
  version: 1
  paperSize: PageSize
  orientation: PageOrientation
  autoArrange: boolean
  spacingMode: StripSpacingMode
  customGapMm: number
  cutLines: boolean
  cropMarks: boolean
}

export interface LegacyPrintSettings extends PageSettings {
  stripGapMm?: number
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export const DEFAULT_PRINT_PREFERENCES: PrintPreferences = {
  version: 1,
  paperSize: 'A3',
  orientation: 'landscape',
  autoArrange: true,
  spacingMode: 'edge-to-edge',
  customGapMm: DEFAULT_CUSTOM_STRIP_GAP_MM,
  cutLines: true,
  cropMarks: true,
}

export function getEffectiveStripGapMm(
  preferences: PrintPreferences,
): number {
  return preferences.spacingMode === 'edge-to-edge'
    ? 0
    : preferences.customGapMm
}

export function getPrintPageSettings(
  preferences: PrintPreferences,
): PageSettings {
  return {
    size: preferences.paperSize,
    orientation: preferences.orientation,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isValidCustomGapMm(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= MIN_CUSTOM_STRIP_GAP_MM &&
    value <= MAX_CUSTOM_STRIP_GAP_MM
  )
}

export function parsePrintPreferences(
  value: unknown,
): PrintPreferences | undefined {
  if (!isRecord(value) || value.version !== 1) return undefined
  if (value.paperSize !== 'A4' && value.paperSize !== 'A3') return undefined
  if (
    value.orientation !== 'portrait' &&
    value.orientation !== 'landscape'
  ) {
    return undefined
  }
  if (value.spacingMode !== 'edge-to-edge' && value.spacingMode !== 'custom') {
    return undefined
  }
  if (!isValidCustomGapMm(value.customGapMm)) return undefined
  if (
    typeof value.autoArrange !== 'boolean' ||
    typeof value.cutLines !== 'boolean' ||
    typeof value.cropMarks !== 'boolean'
  ) {
    return undefined
  }

  return {
    version: 1,
    paperSize: value.paperSize,
    orientation: value.orientation,
    autoArrange: value.autoArrange,
    spacingMode: value.spacingMode,
    customGapMm: value.customGapMm,
    cutLines: value.cutLines,
    cropMarks: value.cropMarks,
  }
}

export function readStoredPrintPreferences(
  storage: StorageLike | undefined,
): PrintPreferences | undefined {
  if (!storage) return undefined
  try {
    const serialized = storage.getItem(PRINT_PREFERENCES_STORAGE_KEY)
    return serialized
      ? parsePrintPreferences(JSON.parse(serialized))
      : undefined
  } catch {
    return undefined
  }
}

export function savePrintPreferences(
  storage: StorageLike | undefined,
  preferences: PrintPreferences,
): boolean {
  if (!storage) return false
  try {
    storage.setItem(
      PRINT_PREFERENCES_STORAGE_KEY,
      JSON.stringify(preferences),
    )
    return true
  } catch {
    return false
  }
}

/**
 * Local preferences win. A legacy project page is only used when this browser
 * has no valid print preference yet. Its stored gap is retained as Custom.
 */
export function resolveInitialPrintPreferences(
  stored: PrintPreferences | undefined,
  legacy: LegacyPrintSettings | undefined,
): PrintPreferences {
  if (stored) return stored

  const legacyGapMm = legacy?.stripGapMm
  const hasLegacyGap = isValidCustomGapMm(legacyGapMm)
  return {
    ...DEFAULT_PRINT_PREFERENCES,
    paperSize: legacy?.size ?? DEFAULT_PRINT_PREFERENCES.paperSize,
    orientation:
      legacy?.orientation ?? DEFAULT_PRINT_PREFERENCES.orientation,
    spacingMode:
      hasLegacyGap && legacyGapMm > 0 ? 'custom' : 'edge-to-edge',
    customGapMm: hasLegacyGap
      ? legacyGapMm
      : DEFAULT_PRINT_PREFERENCES.customGapMm,
  }
}
