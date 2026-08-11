import { DEFAULT_GROUP_HEADER_STYLE, createId } from '../model/defaults'
import type { GroupHeader, LabelStrip } from '../model/project'
import { getCellWidthMm, getGroupHeaderBandHeightMm } from './dimensions'
import { isValidCellRange, type CellRange } from './cell-range'

export interface GroupHeaderGeometryMm {
  xMm: number
  yMm: number
  widthMm: number
  heightMm: number
}

export interface CellContentGeometryMm extends GroupHeaderGeometryMm {
  hasGroupHeader: boolean
}

export class GroupHeaderRangeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GroupHeaderRangeError'
  }
}

export function groupHeaderRangesOverlap(
  first: CellRange,
  second: CellRange,
): boolean {
  return (
    first.startIndex <= second.endIndex &&
    second.startIndex <= first.endIndex
  )
}

function assertValidRange(strip: LabelStrip, range: CellRange): void {
  if (!isValidCellRange(strip.cells.length, range)) {
    throw new GroupHeaderRangeError(
      `Group header range must stay within cells 1–${strip.cells.length}.`,
    )
  }
}

function getHeaderRange(header: GroupHeader): CellRange {
  return {
    startIndex: header.startCellIndex,
    endIndex: header.endCellIndex,
  }
}

export function validateGroupHeaders(
  strip: LabelStrip,
  headers: readonly GroupHeader[] = strip.groupHeaders,
): void {
  headers.forEach((header) => {
    if (!header.text.trim()) {
      throw new GroupHeaderRangeError('Group header text cannot be empty.')
    }
    assertValidRange(strip, getHeaderRange(header))
  })
  for (let index = 0; index < headers.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < headers.length; otherIndex += 1) {
      if (
        groupHeaderRangesOverlap(
          getHeaderRange(headers[index]),
          getHeaderRange(headers[otherIndex]),
        )
      ) {
        throw new GroupHeaderRangeError(
          `Group header cells ${headers[index].startCellIndex + 1}–${headers[index].endCellIndex + 1} overlap cells ${headers[otherIndex].startCellIndex + 1}–${headers[otherIndex].endCellIndex + 1}.`,
        )
      }
    }
  }
}

export function addGroupHeader(
  strip: LabelStrip,
  range: CellRange,
  text: string,
): LabelStrip {
  assertValidRange(strip, range)
  if (!text.trim()) {
    throw new GroupHeaderRangeError('Enter group header text before adding it.')
  }
  const header: GroupHeader = {
    id: createId('group'),
    text: text.trim(),
    startCellIndex: range.startIndex,
    endCellIndex: range.endIndex,
    style: { ...DEFAULT_GROUP_HEADER_STYLE },
  }
  const groupHeaders = [...strip.groupHeaders, header].sort(
    (left, right) => left.startCellIndex - right.startCellIndex,
  )
  validateGroupHeaders(strip, groupHeaders)
  return { ...strip, groupHeaders }
}

export function updateGroupHeader(
  strip: LabelStrip,
  headerId: string,
  updater: (header: GroupHeader) => GroupHeader,
): LabelStrip {
  const groupHeaders = strip.groupHeaders.map((header) =>
    header.id === headerId ? updater(header) : header,
  )
  validateGroupHeaders(strip, groupHeaders)
  return { ...strip, groupHeaders }
}

export function removeGroupHeader(
  strip: LabelStrip,
  headerId: string,
): LabelStrip {
  return {
    ...strip,
    groupHeaders: strip.groupHeaders.filter((header) => header.id !== headerId),
  }
}

export function getGroupHeaderGeometryMm(
  strip: LabelStrip,
  header: GroupHeader,
): GroupHeaderGeometryMm {
  const cellWidthMm = getCellWidthMm(strip)
  const headerHeightMm = getGroupHeaderBandHeightMm(strip)
  return {
    xMm: header.startCellIndex * cellWidthMm,
    yMm:
      strip.dimensions.heightMm - headerHeightMm,
    widthMm:
      (header.endCellIndex - header.startCellIndex + 1) * cellWidthMm,
    heightMm: headerHeightMm,
  }
}

export function getGroupHeaderForCellIndex(
  strip: LabelStrip,
  cellIndex: number,
): GroupHeader | undefined {
  return strip.groupHeaders.find(
    (header) =>
      cellIndex >= header.startCellIndex && cellIndex <= header.endCellIndex,
  )
}

export function getCellContentGeometryMm(
  strip: LabelStrip,
  cellIndex: number,
): CellContentGeometryMm {
  const cellWidthMm = getCellWidthMm(strip)
  const hasGroupHeader = getGroupHeaderForCellIndex(strip, cellIndex) !== undefined
  const headerHeightMm = getGroupHeaderBandHeightMm(strip)
  const heightMm = hasGroupHeader
    ? strip.dimensions.heightMm - headerHeightMm
    : strip.dimensions.heightMm
  return {
    xMm: cellIndex * cellWidthMm,
    yMm: 0,
    widthMm: cellWidthMm,
    heightMm,
    hasGroupHeader,
  }
}
