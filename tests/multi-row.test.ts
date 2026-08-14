import { describe, expect, it } from 'vitest'
import {
  decodePDFRawStream,
  PDFArray,
  PDFDocument,
  PDFRawStream,
} from 'pdf-lib'
import { getStripTotalHeightMm, getStripWidthMm } from '../src/lib/dimensions'
import { addGroupHeader } from '../src/lib/group-headers'
import { planPdfLayout } from '../src/lib/pdf-layout'
import { createLabelsPdf } from '../src/lib/pdf-export'
import {
  parseProjectJson,
  serializeProject,
} from '../src/lib/project-file'
import {
  addStripRow,
  getStripJoinError,
  joinStrips,
  splitStripRows,
  updateStripRow,
} from '../src/lib/strip'
import { createProject, createStrip } from '../src/model/defaults'

function decodedPageContent(pdf: PDFDocument): string {
  const contents = pdf.getPage(0).node.Contents()
  if (!contents) return ''
  const streams =
    contents instanceof PDFArray
      ? Array.from({ length: contents.size() }, (_, index) =>
          contents.lookup(index, PDFRawStream),
        )
      : contents instanceof PDFRawStream
        ? [contents]
        : []
  return streams
    .map((stream) =>
      new TextDecoder().decode(decodePDFRawStream(stream).decode()),
    )
    .join('\n')
}

function asciiHex(text: string): string {
  return Array.from(new TextEncoder().encode(text), (byte) =>
    byte.toString(16).padStart(2, '0'),
  )
    .join('')
    .toUpperCase()
}

describe('multi-row physical label blocks', () => {
  it.each([1, 2, 3] as const)('creates a %i-row strip as one block', (rowCount) => {
    const strip = createStrip('Lemo', 432, 7.5, 16, rowCount)

    expect(strip.rows).toHaveLength(rowCount)
    expect(getStripWidthMm(strip)).toBe(432)
    expect(getStripTotalHeightMm(strip)).toBe(7.5 * rowCount)
    expect(strip.rows.every((row) => row.cells.length === 16)).toBe(true)
  })

  it('adds a compatible blank row and keeps existing rows independently editable', () => {
    const source = createStrip('Fiber', 432, 7.5, 16)
    source.rows[0].cells[0].line1 = 'TOP'
    const withRow = addStripRow(source)
    const edited = updateStripRow(withRow, withRow.rows[1].id, (row) => ({
      ...row,
      cells: row.cells.map((cell, index) =>
        index === 0 ? { ...cell, line1: 'BOTTOM' } : cell,
      ),
    }))

    expect(edited.rows).toHaveLength(2)
    expect(edited.rows[0].cells[0].line1).toBe('TOP')
    expect(edited.rows[1].cells[0].line1).toBe('BOTTOM')
    expect(edited.rows[1].dimensions).toEqual(edited.rows[0].dimensions)
  })

  it('joins compatible strips in top-to-bottom project order without changing rows', () => {
    const first = createStrip('A', 432, 7.5, 12)
    const second = createStrip('B', 432, 8, 16)
    const third = createStrip('C', 432, 6.5, 24)
    first.rows[0].cells[0].line1 = 'A1'
    second.rows[0].cells[0].style = {
      ...second.rows[0].cells[0].style,
      alignment: 'right',
    }
    third.rows[0] = addGroupHeader(
      third.rows[0],
      { startIndex: 0, endIndex: 5 },
      'FIBER',
    )
    const rowSnapshots = [first, second, third].map((strip) => strip.rows[0])

    const strips = joinStrips(
      [first, second, third],
      [third.id, first.id, second.id],
    )

    expect(strips).toHaveLength(1)
    expect(strips[0].id).toBe(first.id)
    expect(strips[0].rows).toEqual(rowSnapshots)
    expect(getStripTotalHeightMm(strips[0])).toBe(22)
  })

  it('prevents joins with different true-size widths', () => {
    const rack = createStrip('Rack', 432, 7.5, 16)
    const half = createStrip('Half', 216, 7.5, 8)
    const error = getStripJoinError([rack, half], [rack.id, half.id])

    expect(error).toContain('same physical width')
    expect(() => joinStrips([rack, half], [rack.id, half.id])).toThrow(
      'No strip will be resized',
    )
    expect(getStripWidthMm(rack)).toBe(432)
    expect(getStripWidthMm(half)).toBe(216)
  })

  it('splits joined rows back into strips while preserving complete row data', () => {
    const first = createStrip('Input', 432, 7.5, 12)
    const second = createStrip('Output', 432, 9, 20)
    second.rows[0].cells[3].appearance = {
      backgroundColor: '#3973b9',
      textColor: '#ffffff',
      borderColor: '#1e4473',
    }
    const joined = joinStrips([first, second], [first.id, second.id])[0]
    const rowsBeforeSplit = structuredClone(joined.rows)
    const split = splitStripRows(joined)

    expect(split).toHaveLength(2)
    expect(split.map((strip) => strip.rows[0])).toEqual(rowsBeforeSplit)
    expect(split.map((strip) => strip.name)).toEqual(['Input', 'Output'])
    expect(new Set(split.map((strip) => strip.id)).size).toBe(2)
  })

  it('round-trips multi-row projects and migrates legacy single-row files', () => {
    const project = createProject()
    project.strips = [createStrip('Three rows', 432, 7.5, 16, 3)]
    project.strips[0].rows[1].cells[4].line1 = 'LEMO'
    const reopened = parseProjectJson(serializeProject(project))

    expect(reopened).toEqual(project)
    expect(reopened.schemaVersion).toBe(5)
    expect(reopened.strips[0].rows[1].cells[4].line1).toBe('LEMO')

    const current = JSON.parse(serializeProject(createProject()))
    const block = current.strips[0]
    const row = { ...block.rows[0] }
    delete row.id
    delete row.name
    current.schemaVersion = 3
    current.strips = [{ id: block.id, name: block.name, ...row }]
    const migrated = parseProjectJson(JSON.stringify(current))

    expect(migrated.schemaVersion).toBe(5)
    expect(migrated.strips[0].rows).toHaveLength(1)
    expect(getStripWidthMm(migrated.strips[0])).toBe(432)
    expect(getStripTotalHeightMm(migrated.strips[0])).toBe(7.5)
  })

  it('places the complete block horizontally, vertically, or diagonally without splitting rows', () => {
    const horizontal = createProject()
    horizontal.page = { size: 'SRA3', orientation: 'landscape' }
    horizontal.strips = [createStrip('Horizontal', 432, 7.5, 16, 3)]
    const horizontalPlan = planPdfLayout(horizontal)
    expect(horizontalPlan.placements).toHaveLength(1)
    expect(horizontalPlan.placements[0]).toMatchObject({
      stripId: horizontal.strips[0].id,
      widthMm: 432,
      heightMm: 22.5,
      rotationDegrees: 0,
    })

    const vertical = createProject()
    vertical.page = { size: 'SRA3', orientation: 'portrait' }
    vertical.strips = [createStrip('Vertical', 400, 7.5, 16, 2)]
    const verticalPlan = planPdfLayout(vertical)
    expect(verticalPlan.placements).toHaveLength(1)
    expect(verticalPlan.placements[0].rotationDegrees).toBe(90)
    expect(verticalPlan.placements[0].heightMm).toBe(15)

    const diagonal = createProject()
    diagonal.page = { size: 'A3', orientation: 'landscape' }
    diagonal.strips = [createStrip('Diagonal', 432, 7.5, 16, 3)]
    const diagonalPlan = planPdfLayout(diagonal)
    expect(diagonalPlan.placements).toHaveLength(1)
    expect(diagonalPlan.placements[0].rotationDegrees).toBeGreaterThan(0)
    expect(diagonalPlan.placements[0].rotationDegrees).toBeLessThan(90)
    expect(diagonalPlan.placements[0].stripId).toBe(diagonal.strips[0].id)
    expect(diagonalPlan.placements[0].heightMm).toBe(22.5)
  })

  it('continues packing a small single-row strip after a small two-row block', () => {
    const project = createProject()
    project.page = { size: 'A3', orientation: 'landscape' }
    project.strips = [
      createStrip('Two rows', 100, 7.5, 8, 2),
      createStrip('Tiny strip', 40, 7.5, 4),
    ]

    const plan = planPdfLayout(project)

    expect(plan.pageCount).toBe(1)
    expect(plan.placements.map((placement) => placement.pageIndex)).toEqual([
      0, 0,
    ])
  })

  it('packs a small three-row block and a small two-row block on one page', () => {
    const project = createProject()
    project.page = { size: 'A3', orientation: 'landscape' }
    project.strips = [
      createStrip('Three rows', 100, 7.5, 8, 3),
      createStrip('Two rows', 80, 7.5, 8, 2),
    ]

    const plan = planPdfLayout(project)

    expect(plan.pageCount).toBe(1)
    expect(plan.placements).toHaveLength(2)
  })

  it('packs two-row and three-row 432 mm blocks together on A3', () => {
    const project = createProject()
    project.page = { size: 'A3', orientation: 'landscape' }
    project.strips = [
      createStrip('Two rack rows', 432, 7.5, 16, 2),
      createStrip('Three rack rows', 432, 7.5, 16, 3),
    ]

    const plan = planPdfLayout(project)

    expect(plan.pageCount).toBe(1)
    expect(plan.placements).toHaveLength(2)
    expect(plan.placements.map((placement) => placement.pageIndex)).toEqual([
      0, 0,
    ])
    expect(plan.placements.map((placement) => placement.heightMm)).toEqual([
      15, 22.5,
    ])
  })

  it('continues packing several normal strips after a multi-row block', () => {
    const project = createProject()
    project.page = { size: 'A3', orientation: 'landscape' }
    project.strips = [
      createStrip('Two rack rows', 432, 7.5, 16, 2),
      ...Array.from({ length: 6 }, (_, index) =>
        createStrip(`Normal ${index + 1}`, 80, 7.5, 4),
      ),
    ]

    const plan = planPdfLayout(project)

    expect(plan.pageCount).toBe(1)
    expect(plan.placements).toHaveLength(project.strips.length)
    expect(plan.placements.every((placement) => placement.pageIndex === 0)).toBe(
      true,
    )
  })

  it('draws every row inside one vector PDF placement', async () => {
    const project = createProject()
    project.page = { size: 'SRA3', orientation: 'landscape' }
    const strip = createStrip('PDF rows', 432, 7.5, 4, 3)
    strip.rows.forEach((row, index) => {
      row.cells[0].line1 = `ROW ${index + 1}`
    })
    project.strips = [strip]

    const bytes = await createLabelsPdf(project)
    const pdf = await PDFDocument.load(bytes)
    const content = decodedPageContent(pdf)

    expect(pdf.getPageCount()).toBe(1)
    for (const text of ['ROW 1', 'ROW 2', 'ROW 3']) {
      expect(content).toContain(asciiHex(text))
    }
    expect(planPdfLayout(project).placements).toHaveLength(1)
    expect(planPdfLayout(project).placements[0].heightMm).toBe(22.5)
  })
})
