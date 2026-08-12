import type { PageOrientation, PageSettings, PageSize } from '../model/project'

export interface PageDimensionsMm {
  widthMm: number
  heightMm: number
}

export interface PageSizeDefinition extends PageDimensionsMm {
  displayName: string
}

export const PAGE_SIZE_DEFINITIONS: Readonly<
  Record<PageSize, PageSizeDefinition>
> = {
  A4: { displayName: 'A4', widthMm: 210, heightMm: 297 },
  A3: { displayName: 'A3', widthMm: 297, heightMm: 420 },
  Letter: {
    displayName: 'US Letter (8.5 × 11 in)',
    widthMm: 215.9,
    heightMm: 279.4,
  },
  Legal: {
    displayName: 'US Legal (8.5 × 14 in)',
    widthMm: 215.9,
    heightMm: 355.6,
  },
  Tabloid: {
    displayName: 'US Tabloid (11 × 17 in)',
    widthMm: 279.4,
    heightMm: 431.8,
  },
}

export const PAGE_SIZE_IDS = Object.freeze(
  Object.keys(PAGE_SIZE_DEFINITIONS) as PageSize[],
)

export function isPageSize(value: unknown): value is PageSize {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(PAGE_SIZE_DEFINITIONS, value)
  )
}

export function getPageSizeDisplayName(size: PageSize): string {
  return PAGE_SIZE_DEFINITIONS[size].displayName
}

export function getPageDimensionsMm(
  page: PageSettings,
): PageDimensionsMm {
  const portrait = PAGE_SIZE_DEFINITIONS[page.size]
  return page.orientation === 'portrait'
    ? { widthMm: portrait.widthMm, heightMm: portrait.heightMm }
    : { widthMm: portrait.heightMm, heightMm: portrait.widthMm }
}

export function formatPageDescription(
  size: PageSize,
  orientation: PageOrientation,
): string {
  return `${getPageSizeDisplayName(size)} ${orientation}`
}
