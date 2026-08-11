export interface StripPreset {
  id:
    | 'rack-4'
    | 'rack-7'
    | 'rack-8'
    | 'rack-12'
    | 'rack-16'
    | 'rack-20'
    | 'rack-24'
    | 'half-rack-8'
    | 'custom'
  group: 'Full-width rack' | 'Other' | 'Custom'
  name: string
  description: string
  widthMm?: number
  heightMm?: number
  cellCount?: number
}

export const STRIP_PRESETS: readonly StripPreset[] = [
  ...([4, 7, 8, 12, 16, 20, 24] as const).map((cellCount) => ({
    id: `rack-${cellCount}` as const,
    group: 'Full-width rack' as const,
    name: `Full rack · ${cellCount} cells`,
    description: `432 × 7.5 mm · ${(432 / cellCount).toFixed(2)} mm cells`,
    widthMm: 432,
    heightMm: 7.5,
    cellCount,
  })),
  {
    id: 'half-rack-8',
    group: 'Other',
    name: 'Half rack · 8 cells',
    description: '216 × 7.5 mm',
    widthMm: 216,
    heightMm: 7.5,
    cellCount: 8,
  },
  {
    id: 'custom',
    group: 'Custom',
    name: 'Custom',
    description: 'Set dimensions manually',
  },
] as const
