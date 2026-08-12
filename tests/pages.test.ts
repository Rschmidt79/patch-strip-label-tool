import { describe, expect, it } from 'vitest'
import {
  getPageDimensionsMm,
  getPageSizeDisplayName,
} from '../src/config/pages'
import type { PageSize } from '../src/model/project'

const US_PAGE_SIZES = [
  {
    size: 'Letter',
    displayName: 'US Letter (8.5 × 11 in)',
    widthMm: 215.9,
    heightMm: 279.4,
  },
  {
    size: 'Legal',
    displayName: 'US Legal (8.5 × 14 in)',
    widthMm: 215.9,
    heightMm: 355.6,
  },
  {
    size: 'Tabloid',
    displayName: 'US Tabloid (11 × 17 in)',
    widthMm: 279.4,
    heightMm: 431.8,
  },
] as const satisfies ReadonlyArray<{
  size: PageSize
  displayName: string
  widthMm: number
  heightMm: number
}>

describe('paper sizes', () => {
  it.each(US_PAGE_SIZES)(
    'defines exact $displayName portrait dimensions in millimeters',
    ({ size, displayName, widthMm, heightMm }) => {
      expect(getPageSizeDisplayName(size)).toBe(displayName)
      expect(
        getPageDimensionsMm({ size, orientation: 'portrait' }),
      ).toEqual({ widthMm, heightMm })
    },
  )

  it.each(US_PAGE_SIZES)(
    'swaps $displayName dimensions in landscape orientation',
    ({ size, widthMm, heightMm }) => {
      expect(
        getPageDimensionsMm({ size, orientation: 'landscape' }),
      ).toEqual({ widthMm: heightMm, heightMm: widthMm })
    },
  )
})
