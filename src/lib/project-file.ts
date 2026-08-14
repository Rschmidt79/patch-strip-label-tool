import type {
  AutoNumberingSettings,
  CellAppearance,
  CellTextStyle,
  GroupHeader,
  GroupHeaderStyle,
  LabelCell,
  LabelProject,
  LabelStrip,
  LabelStripRow,
  PageSettings,
  StripDimensions,
} from '../model/project'
import {
  DEFAULT_CELL_APPEARANCE,
  DEFAULT_GROUP_HEADER_BAND_HEIGHT_MM,
  DEFAULT_GROUP_HEADER_STYLE,
} from '../model/defaults'
import { isHexColor } from './colors'
import { GroupHeaderRangeError, validateGroupHeaders } from './group-headers'
import {
  MAX_CELL_TEXT_LENGTH,
  MAX_CELLS_PER_STRIP,
  MAX_ID_LENGTH,
  MAX_LABEL_TEXT_LENGTH,
  MAX_NAME_LENGTH,
  MAX_PROJECT_FILE_BYTES,
  MAX_PROJECT_ROWS,
  MAX_PROJECT_STRIPS,
  MAX_ROWS_PER_STRIP,
  MAX_TIMESTAMP_LENGTH,
} from '../config/content-limits'
import {
  MAX_CUSTOM_STRIP_GAP_MM,
  MIN_CUSTOM_STRIP_GAP_MM,
  type LegacyPrintSettings,
} from './print-preferences'
import { inferProjectNameFromFileName } from './project-file-name'
import { PAGE_SIZE_IDS } from '../config/pages'

export interface ProjectImportResult {
  project: LabelProject
  legacyPrintSettings: LegacyPrintSettings
}

export class ProjectFileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProjectFileError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function expectRecord(
  value: unknown,
  path: string,
): Record<string, unknown> {
  if (!isRecord(value)) throw new ProjectFileError(`${path} must be an object.`)
  return value
}

function expectString(
  value: unknown,
  path: string,
  maximumLength?: number,
): string {
  if (typeof value !== 'string')
    throw new ProjectFileError(`${path} must be text.`)
  if (maximumLength !== undefined && value.length > maximumLength) {
    throw new ProjectFileError(
      `${path} must be no more than ${maximumLength} characters.`,
    )
  }
  return value
}

function expectNonEmptyString(
  value: unknown,
  path: string,
  maximumLength?: number,
): string {
  const text = expectString(value, path, maximumLength)
  if (!text.trim()) throw new ProjectFileError(`${path} cannot be empty.`)
  return text
}

function expectIsoDateString(value: unknown, path: string): string {
  const text = expectNonEmptyString(value, path, MAX_TIMESTAMP_LENGTH)
  if (!Number.isFinite(Date.parse(text))) {
    throw new ProjectFileError(`${path} must be a valid date and time.`)
  }
  return text
}

function expectNumber(
  value: unknown,
  path: string,
  minimum?: number,
  maximum?: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new ProjectFileError(`${path} must be a finite number.`)
  if (minimum !== undefined && value < minimum)
    throw new ProjectFileError(`${path} must be at least ${minimum}.`)
  if (maximum !== undefined && value > maximum)
    throw new ProjectFileError(`${path} must be no more than ${maximum}.`)
  return value
}

function expectInteger(
  value: unknown,
  path: string,
  minimum?: number,
  maximum?: number,
): number {
  const number = expectNumber(value, path, minimum, maximum)
  if (!Number.isInteger(number))
    throw new ProjectFileError(`${path} must be a whole number.`)
  return number
}

function expectEnum<T extends string>(
  value: unknown,
  path: string,
  allowed: readonly T[],
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new ProjectFileError(
      `${path} must be one of: ${allowed.join(', ')}.`,
    )
  }
  return value as T
}

function parsePageSettingsWithCompatibility(
  value: unknown,
  requireLegacyStripGap: boolean,
): { page: PageSettings; legacyStripGapMm?: number } {
  const page = expectRecord(value, 'page')
  if (page.stripGapMm === undefined && requireLegacyStripGap) {
    throw new ProjectFileError('page.stripGapMm must be a finite number.')
  }
  const parsed: PageSettings = {
    size: expectEnum(page.size, 'page.size', PAGE_SIZE_IDS),
    orientation: expectEnum(page.orientation, 'page.orientation', [
      'portrait',
      'landscape',
    ]),
  }
  const legacyStripGapMm =
    page.stripGapMm === undefined
      ? undefined
      : expectNumber(
          page.stripGapMm,
          'page.stripGapMm',
          MIN_CUSTOM_STRIP_GAP_MM,
          MAX_CUSTOM_STRIP_GAP_MM,
        )
  return { page: parsed, legacyStripGapMm }
}

function parseTextStyle(value: unknown, path: string): CellTextStyle {
  const style = expectRecord(value, path)
  if (typeof style.autoFit !== 'boolean')
    throw new ProjectFileError(`${path}.autoFit must be true or false.`)

  return {
    alignment: expectEnum(style.alignment, `${path}.alignment`, [
      'left',
      'center',
      'right',
    ]),
    fontSizePt: expectNumber(style.fontSizePt, `${path}.fontSizePt`, 1, 100),
    fontWeight: expectEnum(style.fontWeight, `${path}.fontWeight`, [
      'normal',
      'bold',
    ]),
    autoFit: style.autoFit,
  }
}

function expectColor(value: unknown, path: string): string {
  if (!isHexColor(value)) {
    throw new ProjectFileError(`${path} must be a six-digit hex color.`)
  }
  return value.toLowerCase()
}

function parseCellAppearance(
  value: unknown,
  path: string,
  fallback: CellAppearance = DEFAULT_CELL_APPEARANCE,
): CellAppearance {
  if (value === undefined) return { ...fallback }
  const appearance = expectRecord(value, path)
  return {
    backgroundColor:
      appearance.backgroundColor === undefined
        ? fallback.backgroundColor
        : expectColor(appearance.backgroundColor, `${path}.backgroundColor`),
    textColor:
      appearance.textColor === undefined
        ? fallback.textColor
        : expectColor(appearance.textColor, `${path}.textColor`),
    borderColor:
      appearance.borderColor === undefined
        ? fallback.borderColor
        : expectColor(appearance.borderColor, `${path}.borderColor`),
  }
}

function parseGroupHeaderStyle(
  value: unknown,
  path: string,
): GroupHeaderStyle {
  if (value === undefined) return { ...DEFAULT_GROUP_HEADER_STYLE }
  const style = expectRecord(value, path)
  return {
    alignment:
      style.alignment === undefined
        ? DEFAULT_GROUP_HEADER_STYLE.alignment
        : expectEnum(style.alignment, `${path}.alignment`, [
            'left',
            'center',
            'right',
          ]),
    fontSizePt:
      style.fontSizePt === undefined
        ? DEFAULT_GROUP_HEADER_STYLE.fontSizePt
        : expectNumber(style.fontSizePt, `${path}.fontSizePt`, 1, 100),
    fontWeight:
      style.fontWeight === undefined
        ? DEFAULT_GROUP_HEADER_STYLE.fontWeight
        : expectEnum(style.fontWeight, `${path}.fontWeight`, [
            'normal',
            'bold',
          ]),
    backgroundColor:
      style.backgroundColor === undefined
        ? DEFAULT_GROUP_HEADER_STYLE.backgroundColor
        : expectColor(style.backgroundColor, `${path}.backgroundColor`),
    textColor:
      style.textColor === undefined
        ? DEFAULT_GROUP_HEADER_STYLE.textColor
        : expectColor(style.textColor, `${path}.textColor`),
  }
}

function parseCell(
  value: unknown,
  path: string,
  defaultAppearance: CellAppearance,
): LabelCell {
  const cell = expectRecord(value, path)
  return {
    id: expectNonEmptyString(cell.id, `${path}.id`, MAX_ID_LENGTH),
    line1: expectString(
      cell.line1,
      `${path}.line1`,
      MAX_CELL_TEXT_LENGTH,
    ),
    line2: expectString(
      cell.line2,
      `${path}.line2`,
      MAX_CELL_TEXT_LENGTH,
    ),
    style: parseTextStyle(cell.style, `${path}.style`),
    appearance: parseCellAppearance(
      cell.appearance,
      `${path}.appearance`,
      defaultAppearance,
    ),
  }
}

function parseDimensions(value: unknown, path: string): StripDimensions {
  const dimensions = expectRecord(value, path)
  const parsed: StripDimensions = {
    widthMm: expectNumber(dimensions.widthMm, `${path}.widthMm`, 0.1, 5000),
    heightMm: expectNumber(
      dimensions.heightMm,
      `${path}.heightMm`,
      0.1,
      1000,
    ),
    groupHeaderBandHeightMm:
      dimensions.groupHeaderBandHeightMm === undefined
        ? DEFAULT_GROUP_HEADER_BAND_HEIGHT_MM
        : expectNumber(
            dimensions.groupHeaderBandHeightMm,
            `${path}.groupHeaderBandHeightMm`,
            0.5,
            50,
          ),
    cellCount: expectInteger(
      dimensions.cellCount,
      `${path}.cellCount`,
      1,
      MAX_CELLS_PER_STRIP,
    ),
    cellWidthMode: expectEnum(
      dimensions.cellWidthMode,
      `${path}.cellWidthMode`,
      ['equal', 'custom'],
    ),
    customCellWidthMm: expectNumber(
      dimensions.customCellWidthMm,
      `${path}.customCellWidthMm`,
      0.01,
      1000,
    ),
  }

  if (
    parsed.cellWidthMode === 'custom' &&
    Math.abs(
      parsed.customCellWidthMm * parsed.cellCount - parsed.widthMm,
    ) > 1e-6
  ) {
    throw new ProjectFileError(
      `${path} has inconsistent custom cell and total widths.`,
    )
  }

  if (parsed.groupHeaderBandHeightMm >= parsed.heightMm) {
    throw new ProjectFileError(
      `${path}.groupHeaderBandHeightMm must be smaller than the strip height.`,
    )
  }

  return parsed
}

function parseGroupHeader(value: unknown, path: string): GroupHeader {
  const header = expectRecord(value, path)
  return {
    id: expectNonEmptyString(header.id, `${path}.id`, MAX_ID_LENGTH),
    text: expectString(
      header.text,
      `${path}.text`,
      MAX_LABEL_TEXT_LENGTH,
    ),
    startCellIndex: expectInteger(
      header.startCellIndex,
      `${path}.startCellIndex`,
      0,
      MAX_CELLS_PER_STRIP - 1,
    ),
    endCellIndex: expectInteger(
      header.endCellIndex,
      `${path}.endCellIndex`,
      0,
      MAX_CELLS_PER_STRIP - 1,
    ),
    style: parseGroupHeaderStyle(header.style, `${path}.style`),
  }
}

function parseAutoNumbering(
  value: unknown,
  path: string,
): AutoNumberingSettings {
  const settings = expectRecord(value, path)
  return {
    line1Template: expectString(
      settings.line1Template,
      `${path}.line1Template`,
      MAX_LABEL_TEXT_LENGTH,
    ),
    line2Template: expectString(
      settings.line2Template,
      `${path}.line2Template`,
      MAX_LABEL_TEXT_LENGTH,
    ),
    startNumber: expectInteger(
      settings.startNumber,
      `${path}.startNumber`,
      -999999,
      999999,
    ),
    digits: expectInteger(settings.digits, `${path}.digits`, 1, 12),
    cellCount: expectInteger(
      settings.cellCount,
      `${path}.cellCount`,
      1,
      MAX_CELLS_PER_STRIP,
    ),
  }
}

function parseStripRow(
  value: unknown,
  path: string,
  identity?: { id: string; name: string },
): LabelStripRow {
  const row = expectRecord(value, path)
  const dimensions = parseDimensions(row.dimensions, `${path}.dimensions`)

  if (!Array.isArray(row.cells))
    throw new ProjectFileError(`${path}.cells must be a list.`)
  if (row.cells.length !== dimensions.cellCount) {
    throw new ProjectFileError(
      `${path}.cells must contain exactly ${dimensions.cellCount} cells.`,
    )
  }

  const autoNumbering = parseAutoNumbering(
    row.autoNumbering,
    `${path}.autoNumbering`,
  )
  if (autoNumbering.cellCount !== dimensions.cellCount) {
    throw new ProjectFileError(
      `${path}.autoNumbering.cellCount must match ${path}.dimensions.cellCount.`,
    )
  }

  const defaultCellAppearance = parseCellAppearance(
    row.defaultCellAppearance,
    `${path}.defaultCellAppearance`,
  )
  const groupHeaders =
    row.groupHeaders === undefined
      ? []
      : Array.isArray(row.groupHeaders)
        ? (() => {
            if (row.groupHeaders.length > dimensions.cellCount) {
              throw new ProjectFileError(
                `${path}.groupHeaders cannot contain more entries than cells.`,
              )
            }
            return row.groupHeaders.map((header, headerIndex) =>
              parseGroupHeader(
                header,
                `${path}.groupHeaders[${headerIndex}]`,
              ),
            )
          })()
        : (() => {
            throw new ProjectFileError(`${path}.groupHeaders must be a list.`)
          })()

  const parsed: LabelStripRow = {
    id:
      identity?.id ??
      expectNonEmptyString(row.id, `${path}.id`, MAX_ID_LENGTH),
    name:
      identity?.name ?? expectString(row.name, `${path}.name`, MAX_NAME_LENGTH),
    dimensions,
    defaultTextStyle: parseTextStyle(
      row.defaultTextStyle,
      `${path}.defaultTextStyle`,
    ),
    defaultCellAppearance,
    cells: row.cells.map((cell, cellIndex) =>
      parseCell(
        cell,
        `${path}.cells[${cellIndex}]`,
        defaultCellAppearance,
      ),
    ),
    groupHeaders,
    autoNumbering,
  }

  try {
    validateGroupHeaders(parsed)
  } catch (error) {
    if (error instanceof GroupHeaderRangeError) {
      throw new ProjectFileError(`${path}: ${error.message}`)
    }
    throw error
  }
  return parsed
}

function migratedLegacyRowId(stripId: string, index: number): string {
  let hash = 2_166_136_261
  for (const character of stripId) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16_777_619)
  }
  return `row-migrated-${index + 1}-${(hash >>> 0).toString(36)}`
}

function parseLegacyStrip(value: unknown, index: number): LabelStrip {
  const path = `strips[${index}]`
  const strip = expectRecord(value, path)
  const id = expectNonEmptyString(strip.id, `${path}.id`, MAX_ID_LENGTH)
  const name = expectString(strip.name, `${path}.name`, MAX_NAME_LENGTH)
  return {
    id,
    name,
    rows: [
      parseStripRow(strip, path, {
        id: migratedLegacyRowId(id, index),
        name,
      }),
    ],
  }
}

function parseStrip(value: unknown, index: number): LabelStrip {
  const path = `strips[${index}]`
  const strip = expectRecord(value, path)
  if (!Array.isArray(strip.rows)) {
    throw new ProjectFileError(`${path}.rows must be a list.`)
  }
  if (strip.rows.length < 1 || strip.rows.length > MAX_ROWS_PER_STRIP) {
    throw new ProjectFileError(
      `${path}.rows must contain between 1 and ${MAX_ROWS_PER_STRIP} rows.`,
    )
  }
  const rows = strip.rows.map((row, rowIndex) =>
    parseStripRow(row, `${path}.rows[${rowIndex}]`),
  )
  const widthMm = rows[0].dimensions.widthMm
  if (
    rows.some(
      (row) => Math.abs(row.dimensions.widthMm - widthMm) > 1e-6,
    )
  ) {
    throw new ProjectFileError(
      `${path}.rows must all have the same physical width.`,
    )
  }
  return {
    id: expectNonEmptyString(strip.id, `${path}.id`, MAX_ID_LENGTH),
    name: expectString(strip.name, `${path}.name`, MAX_NAME_LENGTH),
    rows,
  }
}

function parseSupportedVersion(
  value: Record<string, unknown>,
  version: 1 | 2 | 3 | 4 | 5,
): ProjectImportResult {
  if (!Array.isArray(value.strips))
    throw new ProjectFileError('strips must be a list.')
  if (value.strips.length > MAX_PROJECT_STRIPS) {
    throw new ProjectFileError(
      `strips must contain no more than ${MAX_PROJECT_STRIPS} strips.`,
    )
  }

  const parsedPage = parsePageSettingsWithCompatibility(
    value.page,
    version === 4,
  )
  const strips =
    version === 5
      ? value.strips.map(parseStrip)
      : value.strips.map(parseLegacyStrip)
  const rowCount = strips.reduce((count, strip) => count + strip.rows.length, 0)
  if (rowCount > MAX_PROJECT_ROWS) {
    throw new ProjectFileError(
      `strips must contain no more than ${MAX_PROJECT_ROWS} rows in total.`,
    )
  }
  const project: LabelProject = {
    schemaVersion: 5,
    id: expectNonEmptyString(value.id, 'id', MAX_ID_LENGTH),
    name: expectString(value.name, 'name', MAX_NAME_LENGTH),
    createdAt: expectIsoDateString(value.createdAt, 'createdAt'),
    updatedAt: expectIsoDateString(value.updatedAt, 'updatedAt'),
    page: parsedPage.page,
    strips,
  }

  const ids = [
    project.id,
    ...project.strips.flatMap((strip) => [
      strip.id,
      ...strip.rows.flatMap((row) => [
        row.id,
        ...row.cells.map((cell) => cell.id),
        ...row.groupHeaders.map((header) => header.id),
      ]),
    ]),
  ]
  if (new Set(ids).size !== ids.length)
    throw new ProjectFileError(
      'Project, strip, cell, and group header IDs must be unique.',
    )

  return {
    project,
    legacyPrintSettings: {
      ...parsedPage.page,
      stripGapMm: parsedPage.legacyStripGapMm,
    },
  }
}

function migrateProject(value: unknown): ProjectImportResult {
  const root = expectRecord(value, 'project')
  const version = expectInteger(root.schemaVersion, 'schemaVersion', 1)

  switch (version) {
    case 1:
    case 2:
    case 3:
    case 4:
    case 5:
      return parseSupportedVersion(root, version)
    default:
      throw new ProjectFileError(
        `Project version ${version} is not supported by this application.`,
      )
  }
}

export function parseProjectJson(json: string): LabelProject {
  return parseProjectJsonWithCompatibility(json).project
}

export function parseProjectJsonWithCompatibility(
  json: string,
): ProjectImportResult {
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch {
    throw new ProjectFileError('The selected file is not valid JSON.')
  }

  return migrateProject(value)
}

export function serializeProject(project: LabelProject): string {
  return `${JSON.stringify(project, null, 2)}\n`
}

export async function readProjectFile(file: File): Promise<LabelProject> {
  return (await readProjectFileWithCompatibility(file)).project
}

export async function readProjectFileWithCompatibility(
  file: File,
): Promise<ProjectImportResult> {
  if (file.size > MAX_PROJECT_FILE_BYTES)
    throw new ProjectFileError('Project files must be smaller than 5 MB.')
  let json: string
  try {
    json = await file.text()
  } catch {
    throw new ProjectFileError('The selected project file could not be read.')
  }

  const imported = parseProjectJsonWithCompatibility(json)
  if (imported.project.name.trim()) return imported

  const inferredName = inferProjectNameFromFileName(file.name)
  return inferredName
    ? {
        ...imported,
        project: { ...imported.project, name: inferredName },
      }
    : imported
}
