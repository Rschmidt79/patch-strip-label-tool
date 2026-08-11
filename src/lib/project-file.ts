import type {
  AutoNumberingSettings,
  CellAppearance,
  CellTextStyle,
  GroupHeader,
  GroupHeaderStyle,
  LabelCell,
  LabelProject,
  LabelStrip,
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
  MAX_PROJECT_STRIPS,
  MAX_TIMESTAMP_LENGTH,
} from '../config/content-limits'

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

function parsePageSettings(value: unknown): PageSettings {
  const page = expectRecord(value, 'page')
  return {
    size: expectEnum(page.size, 'page.size', ['A4', 'A3']),
    orientation: expectEnum(page.orientation, 'page.orientation', [
      'portrait',
      'landscape',
    ]),
  }
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

function parseStrip(value: unknown, index: number): LabelStrip {
  const path = `strips[${index}]`
  const strip = expectRecord(value, path)
  const dimensions = parseDimensions(strip.dimensions, `${path}.dimensions`)

  if (!Array.isArray(strip.cells))
    throw new ProjectFileError(`${path}.cells must be a list.`)
  if (strip.cells.length !== dimensions.cellCount) {
    throw new ProjectFileError(
      `${path}.cells must contain exactly ${dimensions.cellCount} cells.`,
    )
  }

  const autoNumbering = parseAutoNumbering(
    strip.autoNumbering,
    `${path}.autoNumbering`,
  )
  if (autoNumbering.cellCount !== dimensions.cellCount) {
    throw new ProjectFileError(
      `${path}.autoNumbering.cellCount must match ${path}.dimensions.cellCount.`,
    )
  }

  const defaultCellAppearance = parseCellAppearance(
    strip.defaultCellAppearance,
    `${path}.defaultCellAppearance`,
  )
  const groupHeaders =
    strip.groupHeaders === undefined
      ? []
      : Array.isArray(strip.groupHeaders)
        ? (() => {
            if (strip.groupHeaders.length > dimensions.cellCount) {
              throw new ProjectFileError(
                `${path}.groupHeaders cannot contain more entries than cells.`,
              )
            }
            return strip.groupHeaders.map((header, headerIndex) =>
              parseGroupHeader(
                header,
                `${path}.groupHeaders[${headerIndex}]`,
              ),
            )
          })()
        : (() => {
            throw new ProjectFileError(`${path}.groupHeaders must be a list.`)
          })()

  const parsed: LabelStrip = {
    id: expectNonEmptyString(strip.id, `${path}.id`, MAX_ID_LENGTH),
    name: expectString(strip.name, `${path}.name`, MAX_NAME_LENGTH),
    dimensions,
    defaultTextStyle: parseTextStyle(
      strip.defaultTextStyle,
      `${path}.defaultTextStyle`,
    ),
    defaultCellAppearance,
    cells: strip.cells.map((cell, cellIndex) =>
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

function parseSupportedVersion(value: Record<string, unknown>): LabelProject {
  if (!Array.isArray(value.strips))
    throw new ProjectFileError('strips must be a list.')
  if (value.strips.length > MAX_PROJECT_STRIPS) {
    throw new ProjectFileError(
      `strips must contain no more than ${MAX_PROJECT_STRIPS} strips.`,
    )
  }

  const project: LabelProject = {
    schemaVersion: 3,
    id: expectNonEmptyString(value.id, 'id', MAX_ID_LENGTH),
    name: expectString(value.name, 'name', MAX_NAME_LENGTH),
    createdAt: expectIsoDateString(value.createdAt, 'createdAt'),
    updatedAt: expectIsoDateString(value.updatedAt, 'updatedAt'),
    page: parsePageSettings(value.page),
    strips: value.strips.map(parseStrip),
  }

  const ids = [
    project.id,
    ...project.strips.flatMap((strip) => [
      strip.id,
      ...strip.cells.map((cell) => cell.id),
      ...strip.groupHeaders.map((header) => header.id),
    ]),
  ]
  if (new Set(ids).size !== ids.length)
    throw new ProjectFileError(
      'Project, strip, cell, and group header IDs must be unique.',
    )

  return project
}

function migrateProject(value: unknown): LabelProject {
  const root = expectRecord(value, 'project')
  const version = expectInteger(root.schemaVersion, 'schemaVersion', 1)

  switch (version) {
    case 1:
    case 2:
    case 3:
      return parseSupportedVersion(root)
    default:
      throw new ProjectFileError(
        `Project version ${version} is not supported by this application.`,
      )
  }
}

export function parseProjectJson(json: string): LabelProject {
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
  if (file.size > MAX_PROJECT_FILE_BYTES)
    throw new ProjectFileError('Project files must be smaller than 5 MB.')
  return parseProjectJson(await file.text())
}
