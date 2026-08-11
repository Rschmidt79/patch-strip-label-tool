import type { PageOrientation, PageSettings, PageSize } from '../model/project'

export interface PageDimensionsMm {
  widthMm: number
  heightMm: number
}

const PORTRAIT_PAGE_SIZES_MM: Record<PageSize, PageDimensionsMm> = {
  A4: { widthMm: 210, heightMm: 297 },
  A3: { widthMm: 297, heightMm: 420 },
}

export function getPageDimensionsMm(
  page: PageSettings,
): PageDimensionsMm {
  const portrait = PORTRAIT_PAGE_SIZES_MM[page.size]
  return page.orientation === 'portrait'
    ? { ...portrait }
    : { widthMm: portrait.heightMm, heightMm: portrait.widthMm }
}

export function formatPageDescription(
  size: PageSize,
  orientation: PageOrientation,
): string {
  return `${size} ${orientation}`
}
