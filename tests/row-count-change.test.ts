import { describe, expect, it, vi } from 'vitest'
import { createStrip } from '../src/model/defaults'
import { applyStripRowCountChange } from '../src/lib/row-count-change'

describe('destructive strip row-count changes', () => {
  it('reduces three empty default rows to one without confirmation', () => {
    const strip = createStrip('Empty rows', 432, 7.5, 16, 3)
    const confirmRemoval = vi.fn(() => false)

    const resized = applyStripRowCountChange(strip, 1, confirmRemoval)

    expect(confirmRemoval).not.toHaveBeenCalled()
    expect(resized.rows).toHaveLength(1)
  })

  it('requires confirmation when a removed row contains text', () => {
    const strip = createStrip('Text rows', 432, 7.5, 16, 3)
    strip.rows[1].cells[0].line1 = 'KEEP ME'
    const confirmRemoval = vi.fn(() => false)

    applyStripRowCountChange(strip, 1, confirmRemoval)

    expect(confirmRemoval).toHaveBeenCalledOnce()
    expect(confirmRemoval).toHaveBeenCalledWith(
      'Remove 2 rows? Their content, dimensions, and formatting will be permanently lost.',
    )
  })

  it('leaves the complete strip unchanged when removal is cancelled', () => {
    const strip = createStrip('Cancel', 432, 7.5, 16, 3)
    strip.rows[2].cells[4].line2 = 'DO NOT REMOVE'
    const snapshot = structuredClone(strip)

    const resized = applyStripRowCountChange(strip, 1, () => false)

    expect(resized).toBe(strip)
    expect(resized).toEqual(snapshot)
  })

  it('removes the requested number of rows after confirmation', () => {
    const strip = createStrip('Confirm', 432, 7.5, 16, 3)
    strip.rows[1].cells[0].line1 = 'REMOVE'
    const confirmRemoval = vi.fn(() => true)

    const resized = applyStripRowCountChange(strip, 1, confirmRemoval)

    expect(confirmRemoval).toHaveBeenCalledOnce()
    expect(resized.rows).toHaveLength(1)
    expect(resized.rows[0]).toBe(strip.rows[0])
  })

  it.each(['dimension', 'formatting'] as const)(
    'treats a non-default removed-row %s as meaningful settings',
    (change) => {
      const strip = createStrip('Settings', 432, 7.5, 16, 3)
      if (change === 'dimension') {
        strip.rows[2].dimensions.heightMm = 9
      } else {
        strip.rows[2].cells[0].style = {
          ...strip.rows[2].cells[0].style,
          alignment: 'right',
        }
      }
      const confirmRemoval = vi.fn(() => false)

      applyStripRowCountChange(strip, 1, confirmRemoval)

      expect(confirmRemoval).toHaveBeenCalledOnce()
    },
  )
})
