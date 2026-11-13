import type {
  LabelProject,
  PageSettings,
  StripDimensions,
} from '../model/project'
import {
  DEFAULT_CELL_APPEARANCE,
  DEFAULT_TEXT_STYLE,
} from '../model/defaults'
import {
  getPageDimensionsMm,
  getPageLayoutMarginsMm,
} from '../config/pages'
import {
  createPageCutGuidesMm,
  type PageCutGuidesMm,
} from './cut-guides'
import {
  getPlacementPolygonMm,
  PDF_NOTICE_RESERVE_MM,
  planPdfLayout,
  type PdfLayoutPlan,
} from './pdf-layout'
import {
  createLayoutStripForPrintSegment,
  createSplitPrintSegments,
  createWholePrintSegment,
  type PrintStripSegment,
} from './print-segments'
import {
  getEffectiveStripGapMm,
  getPrintPageSettings,
  type PrintPreferences,
} from './print-preferences'
import {
  getSupportQrDecorationGeometryMm,
  type SupportQrDecorationGeometryMm,
} from './support-qr'

export interface PrintPageGuidesMm extends PageCutGuidesMm {
  pageIndex: number
}

export interface PrintLayoutPlan extends PdfLayoutPlan {
  preferences: PrintPreferences
  pageGuides: PrintPageGuidesMm[]
  printSegments: PrintStripSegment[]
  supportArea: SupportQrDecorationGeometryMm
}

function canPlaceWholeStrip(
  project: LabelProject,
  stripIndex: number,
  preferences: PrintPreferences,
  supportArea: SupportQrDecorationGeometryMm,
): boolean {
  try {
    planPdfLayout(
      { ...project, strips: [project.strips[stripIndex]] },
      {
        page: getPrintPageSettings(preferences),
        autoArrange: preferences.autoArrange,
        stripGapMm: getEffectiveStripGapMm(preferences),
        reservedAreasMm: [supportArea.reservedAreaMm],
      },
    )
    return true
  } catch {
    return false
  }
}

function getMaximumCardinalSegmentWidthMm(
  preferences: PrintPreferences,
): number {
  const page = getPrintPageSettings(preferences)
  const dimensions = getPageDimensionsMm(page)
  const margins = getPageLayoutMarginsMm(page)
  const usableWidthMm =
    dimensions.widthMm - margins.leftMm - margins.rightMm
  const usableHeightMm =
    dimensions.heightMm -
    margins.topMm -
    margins.bottomMm -
    PDF_NOTICE_RESERVE_MM
  return Math.max(usableWidthMm, usableHeightMm)
}

export function planPrintLayout(
  project: LabelProject,
  preferences: PrintPreferences,
): PrintLayoutPlan {
  const page = getPrintPageSettings(preferences)
  const pageDimensions = getPageDimensionsMm(page)
  const supportArea = getSupportQrDecorationGeometryMm(
    pageDimensions.widthMm,
    pageDimensions.heightMm,
  )
  if (!supportArea) {
    throw new Error('The selected page is too small for the support area.')
  }
  const splitPrintEnabled =
    preferences.paperSize === 'A4' ||
    preferences.paperSize === 'Letter' ||
    preferences.paperSize === 'Legal'
  const maximumSegmentWidthMm =
    getMaximumCardinalSegmentWidthMm(preferences)
  const printSegments = project.strips.flatMap((strip, stripIndex) =>
    splitPrintEnabled &&
    !canPlaceWholeStrip(project, stripIndex, preferences, supportArea)
      ? createSplitPrintSegments(strip, maximumSegmentWidthMm)
      : [createWholePrintSegment(strip)],
  )
  const sourceStripsById = new Map(
    project.strips.map((strip) => [strip.id, strip]),
  )
  const layoutProject: LabelProject = {
    ...project,
    strips: printSegments.map((segment) => {
      const strip = sourceStripsById.get(segment.stripId)
      if (!strip) throw new Error(`Missing source strip ${segment.stripId}.`)
      return createLayoutStripForPrintSegment(strip, segment)
    }),
  }
  const layout = planPdfLayout(layoutProject, {
    page: getPrintPageSettings(preferences),
    autoArrange: preferences.autoArrange,
    stripGapMm: getEffectiveStripGapMm(preferences),
    reservedAreasMm: [supportArea.reservedAreaMm],
  })
  const pageGuides = Array.from(
    { length: layout.pageCount },
    (_, pageIndex): PrintPageGuidesMm => {
      const polygons = layout.placements
        .filter((placement) => placement.pageIndex === pageIndex)
        .map(getPlacementPolygonMm)
      return {
        pageIndex,
        ...createPageCutGuidesMm(polygons, preferences),
      }
    },
  )

  return {
    ...layout,
    preferences: { ...preferences },
    pageGuides,
    printSegments,
    supportArea,
  }
}

/** The only project data that influences placement and cut guides. */
interface PrintLayoutGeometry {
  page: PageSettings
  strips: Array<{
    id: string
    name: string
    rows: Array<{ id: string; dimensions: StripDimensions }>
  }>
}

/**
 * A stable key for everything in a project that the print layout depends on.
 * Cell text, colors, and text styles are deliberately absent, so typing does
 * not invalidate a layout that cannot have changed.
 */
export function getPrintLayoutGeometryKey(project: LabelProject): string {
  const geometry: PrintLayoutGeometry = {
    page: { size: project.page.size, orientation: project.page.orientation },
    strips: project.strips.map((strip) => ({
      id: strip.id,
      name: strip.name,
      rows: strip.rows.map((row) => ({
        id: row.id,
        dimensions: {
          widthMm: row.dimensions.widthMm,
          heightMm: row.dimensions.heightMm,
          groupHeaderBandHeightMm: row.dimensions.groupHeaderBandHeightMm,
          cellCount: row.dimensions.cellCount,
          cellWidthMode: row.dimensions.cellWidthMode,
          customCellWidthMm: row.dimensions.customCellWidthMm,
        },
      })),
    })),
  }
  return JSON.stringify(geometry)
}

/** Plans the same layout as `planPrintLayout` from a geometry key alone. */
export function planPrintLayoutFromGeometryKey(
  geometryKey: string,
  preferences: PrintPreferences,
): PrintLayoutPlan {
  const geometry: PrintLayoutGeometry = JSON.parse(geometryKey)
  const layoutProject: LabelProject = {
    schemaVersion: 5,
    id: 'print-layout-geometry',
    name: '',
    createdAt: '',
    updatedAt: '',
    page: geometry.page,
    strips: geometry.strips.map((strip) => ({
      id: strip.id,
      name: strip.name,
      rows: strip.rows.map((row) => ({
        id: row.id,
        name: '',
        dimensions: row.dimensions,
        defaultTextStyle: { ...DEFAULT_TEXT_STYLE },
        defaultCellAppearance: { ...DEFAULT_CELL_APPEARANCE },
        cells: [],
        groupHeaders: [],
        autoNumbering: {
          line1Template: '',
          line2Template: '',
          startNumber: 1,
          digits: 1,
          cellCount: row.dimensions.cellCount,
        },
      })),
    })),
  }
  return planPrintLayout(layoutProject, preferences)
}
