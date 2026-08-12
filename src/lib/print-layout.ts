import type { LabelProject } from '../model/project'
import {
  createPageCutGuidesMm,
  type PageCutGuidesMm,
} from './cut-guides'
import {
  getPlacementPolygonMm,
  planPdfLayout,
  type PdfLayoutPlan,
} from './pdf-layout'
import {
  getEffectiveStripGapMm,
  getPrintPageSettings,
  type PrintPreferences,
} from './print-preferences'

export interface PrintPageGuidesMm extends PageCutGuidesMm {
  pageIndex: number
}

export interface PrintLayoutPlan extends PdfLayoutPlan {
  preferences: PrintPreferences
  pageGuides: PrintPageGuidesMm[]
}

export function planPrintLayout(
  project: LabelProject,
  preferences: PrintPreferences,
): PrintLayoutPlan {
  const layout = planPdfLayout(project, {
    page: getPrintPageSettings(preferences),
    autoArrange: preferences.autoArrange,
    stripGapMm: getEffectiveStripGapMm(preferences),
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

  return { ...layout, preferences: { ...preferences }, pageGuides }
}
