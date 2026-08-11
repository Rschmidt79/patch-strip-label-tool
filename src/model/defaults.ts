import type {
  CellAppearance,
  CellTextStyle,
  GroupHeaderStyle,
  LabelCell,
  LabelProject,
  LabelStrip,
} from './project'

export const DEFAULT_TEXT_STYLE: CellTextStyle = {
  alignment: 'center',
  fontSizePt: 6.5,
  fontWeight: 'bold',
  autoFit: true,
}

export const DEFAULT_CELL_APPEARANCE: CellAppearance = {
  backgroundColor: '#ffffff',
  textColor: '#101418',
  borderColor: '#8c9490',
}

export const DEFAULT_GROUP_HEADER_STYLE: GroupHeaderStyle = {
  alignment: 'center',
  fontSizePt: 5,
  fontWeight: 'bold',
  backgroundColor: '#e3e7e4',
  textColor: '#101418',
}

export const DEFAULT_GROUP_HEADER_BAND_HEIGHT_MM = 2

export function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

export function createCell(
  _index: number,
  style: CellTextStyle = DEFAULT_TEXT_STYLE,
  appearance: CellAppearance = DEFAULT_CELL_APPEARANCE,
): LabelCell {
  return {
    id: createId('cell'),
    line1: '',
    line2: '',
    style: { ...style },
    appearance: { ...appearance },
  }
}

export function createStrip(
  name = 'Strip 1',
  widthMm = 432,
  heightMm = 7.5,
  cellCount = 16,
): LabelStrip {
  const defaultTextStyle = { ...DEFAULT_TEXT_STYLE }
  const defaultCellAppearance = { ...DEFAULT_CELL_APPEARANCE }

  return {
    id: createId('strip'),
    name,
    dimensions: {
      widthMm,
      heightMm,
      groupHeaderBandHeightMm: DEFAULT_GROUP_HEADER_BAND_HEIGHT_MM,
      cellCount,
      cellWidthMode: 'equal',
      customCellWidthMm: widthMm / cellCount,
    },
    defaultTextStyle,
    defaultCellAppearance,
    cells: Array.from({ length: cellCount }, (_, index) =>
      createCell(index, defaultTextStyle, defaultCellAppearance),
    ),
    groupHeaders: [],
    autoNumbering: {
      line1Template: 'Router Out',
      line2Template: '{n}',
      startNumber: 1,
      digits: 2,
      cellCount,
    },
  }
}

export function createProject(): LabelProject {
  const now = new Date().toISOString()

  return {
    schemaVersion: 3,
    id: createId('project'),
    name: 'Studio Rack Labels',
    createdAt: now,
    updatedAt: now,
    page: {
      size: 'A3',
      orientation: 'landscape',
    },
    strips: [createStrip()],
  }
}
