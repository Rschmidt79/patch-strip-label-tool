import { describe, expect, it } from 'vitest'
import { createExampleProject } from '../src/lib/example-project'
import { createLabelsPdf } from '../src/lib/pdf-export'
import { findPdfUnsupportedCharacters } from '../src/lib/pdf-text'
import { planPrintLayout } from '../src/lib/print-layout'
import { DEFAULT_PRINT_PREFERENCES } from '../src/lib/print-preferences'
import { parseProjectJson, serializeProject } from '../src/lib/project-file'

describe('example project', () => {
  it('is a valid project that survives save and open', () => {
    const project = createExampleProject()
    const reopened = parseProjectJson(serializeProject(project))

    expect(reopened.strips).toHaveLength(project.strips.length)
    for (const strip of project.strips) {
      for (const row of strip.rows) {
        expect(row.cells).toHaveLength(row.dimensions.cellCount)
        expect(row.cells.some((cell) => cell.line1 !== '')).toBe(true)
      }
    }
  })

  it('issues fresh IDs on every load', () => {
    const first = createExampleProject()
    const second = createExampleProject()
    const ids = (project: typeof first) => [
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
    const firstIds = ids(first)

    expect(new Set(firstIds).size).toBe(firstIds.length)
    expect(ids(second).some((id) => firstIds.includes(id))).toBe(false)
  })

  it('fits every strip whole on one default A3 sheet using rotation', () => {
    const plan = planPrintLayout(createExampleProject(), DEFAULT_PRINT_PREFERENCES)

    expect(DEFAULT_PRINT_PREFERENCES.paperSize).toBe('A3')
    expect(plan.pageCount).toBe(1)
    expect(plan.printSegments.every((segment) => segment.segmentCount === 1)).toBe(true)
    expect(plan.placements).toHaveLength(createExampleProject().strips.length)
    expect(plan.placements.some((placement) => placement.rotationDegrees !== 0)).toBe(true)
  })

  it('exports a PDF without character substitutions', async () => {
    const project = createExampleProject()
    const bytes = await createLabelsPdf(
      project,
      DEFAULT_PRINT_PREFERENCES,
      planPrintLayout(project, DEFAULT_PRINT_PREFERENCES),
    )

    expect(findPdfUnsupportedCharacters(project)).toEqual([])
    expect(bytes.byteLength).toBeGreaterThan(0)
  })
})
