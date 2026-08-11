import { describe, expect, it } from 'vitest'
import {
  getCellWidthMm,
  millimetersToPoints,
} from '../src/lib/dimensions'
import { createStrip } from '../src/model/defaults'

describe('physical unit conversion', () => {
  it('converts 25.4 mm to exactly 72 PDF points', () => {
    expect(millimetersToPoints(25.4)).toBe(72)
  })

  it('converts 27 mm to PDF points without display rounding', () => {
    expect(millimetersToPoints(27)).toBeCloseTo(76.53543307086615, 12)
  })

  it('converts 100 mm to PDF points without display rounding', () => {
    expect(millimetersToPoints(100)).toBeCloseTo(283.46456692913387, 12)
  })

  it('keeps a 432 mm / 16 cell strip at exactly 27 mm per cell', () => {
    const strip = createStrip('Full rack', 432, 7.5, 16)
    expect(getCellWidthMm(strip)).toBe(27)
  })
})
