import { describe, expect, it } from 'vitest'
import { STRIP_PRESETS } from '../src/config/presets'
import { getCellWidthMm } from '../src/lib/dimensions'
import { createStrip } from '../src/model/defaults'

describe('full-width rack presets', () => {
  it('provides all common cell counts at exactly 432 mm total width', () => {
    const rackPresets = STRIP_PRESETS.filter(
      (preset) => preset.group === 'Full-width rack',
    )
    expect(rackPresets.map((preset) => preset.cellCount)).toEqual([
      4, 7, 8, 12, 16, 20, 24,
    ])
    rackPresets.forEach((preset) => {
      expect(preset.widthMm).toBe(432)
      expect(preset.heightMm).toBe(7.5)
    })
  })

  it('uses the exact 432 / 7 cell geometry without display rounding', () => {
    const strip = createStrip('Seven cells', 432, 7.5, 7)
    expect(getCellWidthMm(strip)).toBe(432 / 7)
    expect(getCellWidthMm(strip) * strip.dimensions.cellCount).toBe(432)
  })

  it('produces exactly 21.6 mm cells for the 20-cell layout', () => {
    const strip = createStrip('Twenty cells', 432, 7.5, 20)
    expect(getCellWidthMm(strip)).toBe(21.6)
  })
})
