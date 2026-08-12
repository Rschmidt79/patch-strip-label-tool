export type PageSize = 'A4' | 'A3' | 'Letter' | 'Legal' | 'Tabloid'
export type PageOrientation = 'portrait' | 'landscape'
export type TextAlignment = 'left' | 'center' | 'right'
export type FontWeight = 'normal' | 'bold'
export type CellWidthMode = 'equal' | 'custom'

export interface PageSettings {
  size: PageSize
  orientation: PageOrientation
}

export interface CellTextStyle {
  alignment: TextAlignment
  fontSizePt: number
  fontWeight: FontWeight
  autoFit: boolean
}

export interface CellAppearance {
  backgroundColor: string
  textColor: string
  borderColor: string
}

export interface LabelCell {
  id: string
  line1: string
  line2: string
  style: CellTextStyle
  appearance: CellAppearance
}

export interface StripDimensions {
  widthMm: number
  heightMm: number
  groupHeaderBandHeightMm: number
  cellCount: number
  cellWidthMode: CellWidthMode
  customCellWidthMm: number
}

export interface GroupHeaderStyle {
  alignment: TextAlignment
  fontSizePt: number
  fontWeight: FontWeight
  backgroundColor: string
  textColor: string
}

export interface GroupHeader {
  id: string
  text: string
  startCellIndex: number
  endCellIndex: number
  style: GroupHeaderStyle
}

export interface AutoNumberingSettings {
  line1Template: string
  line2Template: string
  startNumber: number
  digits: number
  cellCount: number
}

export interface LabelStrip {
  id: string
  name: string
  dimensions: StripDimensions
  defaultTextStyle: CellTextStyle
  defaultCellAppearance: CellAppearance
  cells: LabelCell[]
  groupHeaders: GroupHeader[]
  autoNumbering: AutoNumberingSettings
}

export interface LabelProject {
  schemaVersion: 3
  id: string
  name: string
  createdAt: string
  updatedAt: string
  /** Legacy file compatibility only. Live output uses local PrintPreferences. */
  page: PageSettings
  strips: LabelStrip[]
}
