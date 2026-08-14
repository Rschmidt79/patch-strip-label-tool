import { describe, expect, it } from 'vitest'
import {
  parseProjectJson,
  parseProjectJsonWithCompatibility,
  ProjectFileError,
  serializeProject,
} from '../src/lib/project-file'
import { createProject } from '../src/model/defaults'
import { addGroupHeader } from '../src/lib/group-headers'
import { applyCellAppearanceToRange } from '../src/lib/cell-style'

function toLegacyProject(project = createProject(), schemaVersion = 3) {
  const legacy = JSON.parse(serializeProject(project))
  legacy.schemaVersion = schemaVersion
  legacy.strips = legacy.strips.map(
    (strip: { id: string; name: string; rows: Array<Record<string, unknown>> }) => {
      const row = { ...strip.rows[0] }
      delete row.id
      delete row.name
      return { id: strip.id, name: strip.name, ...row }
    },
  )
  return legacy
}

describe('project JSON files', () => {
  it('round-trips version 5 multi-row label content without print preferences', () => {
    const project = createProject()
    project.strips[0].rows[0] = addGroupHeader(
      applyCellAppearanceToRange(
        project.strips[0].rows[0],
        { startIndex: 0, endIndex: 5 },
        { backgroundColor: '#3973b9', textColor: '#ffffff' },
      ),
      { startIndex: 0, endIndex: 5 },
      'MICROPHONES',
    )
    project.strips[0].rows[0].groupHeaders[0].style = {
      ...project.strips[0].rows[0].groupHeaders[0].style,
      backgroundColor: '#112233',
      textColor: '#ffeeaa',
    }
    const imported = parseProjectJson(serializeProject(project))
    expect(imported).toEqual(project)
    expect(imported.schemaVersion).toBe(5)
    expect(serializeProject(project)).not.toContain('stripGapMm')
  })

  it('accepts SRA3 without changing the project schema version', () => {
    const project = createProject()
    project.page = { size: 'SRA3', orientation: 'landscape' }

    const imported = parseProjectJson(serializeProject(project))

    expect(imported.page).toEqual(project.page)
    expect(imported.schemaVersion).toBe(5)
  })

  it('migrates version 2 header projects to fixed-height internal bands', () => {
    const project = createProject()
    project.strips[0].rows[0] = addGroupHeader(
      applyCellAppearanceToRange(
        project.strips[0].rows[0],
        { startIndex: 0, endIndex: 5 },
        { backgroundColor: '#3973b9', textColor: '#ffffff' },
      ),
      { startIndex: 0, endIndex: 5 },
      'MICROPHONES',
    )
    project.strips[0].rows[0].groupHeaders[0].style = {
      ...project.strips[0].rows[0].groupHeaders[0].style,
      backgroundColor: '#112233',
      textColor: '#ffeeaa',
    }
    const legacy = toLegacyProject(project, 2)
    legacy.strips[0].dimensions.groupHeaderHeightMm = 4
    delete legacy.strips[0].dimensions.groupHeaderBandHeightMm

    const imported = parseProjectJson(JSON.stringify(legacy))
    const strip = imported.strips[0]
    const row = strip.rows[0]
    expect(imported.schemaVersion).toBe(5)
    expect(row.dimensions.heightMm).toBe(7.5)
    expect(row.dimensions.groupHeaderBandHeightMm).toBe(2)
    expect(row.groupHeaders[0].text).toBe('MICROPHONES')
    expect(row.groupHeaders[0]).toMatchObject({
      startCellIndex: 0,
      endCellIndex: 5,
      style: {
        backgroundColor: '#112233',
        textColor: '#ffeeaa',
      },
    })
    expect(row.cells[0].appearance.backgroundColor).toBe('#3973b9')
  })

  it('migrates version 1 projects with sensible Milestone 4 defaults', () => {
    const legacy = toLegacyProject(createProject(), 1)
    for (const strip of legacy.strips) {
      delete strip.dimensions.groupHeaderBandHeightMm
      delete strip.defaultCellAppearance
      delete strip.groupHeaders
      for (const cell of strip.cells) delete cell.appearance
    }

    const imported = parseProjectJson(JSON.stringify(legacy))
    expect(imported.schemaVersion).toBe(5)
    expect(imported.strips[0].rows[0].dimensions.groupHeaderBandHeightMm).toBe(2)
    expect(imported.strips[0].rows[0].groupHeaders).toEqual([])
    expect(imported.strips[0].rows[0].cells[0].appearance).toEqual(
      imported.strips[0].rows[0].defaultCellAppearance,
    )
  })

  it('rejects invalid JSON with a user-facing error', () => {
    expect(() => parseProjectJson('{invalid')).toThrowError(
      new ProjectFileError('The selected file is not valid JSON.'),
    )
  })

  it('rejects unsupported future versions', () => {
    const value = JSON.parse(serializeProject(createProject()))
    value.schemaVersion = 6
    expect(() => parseProjectJson(JSON.stringify(value))).toThrow(
      'Project version 6 is not supported',
    )
  })

  it('extracts a schema 4 stored gap without retaining it in label data', () => {
    const legacy = toLegacyProject(createProject(), 4)
    legacy.page.stripGapMm = 3.5

    const imported = parseProjectJsonWithCompatibility(JSON.stringify(legacy))
    expect(imported.project.schemaVersion).toBe(5)
    expect(imported.legacyPrintSettings.stripGapMm).toBe(3.5)
    expect(serializeProject(imported.project)).not.toContain('stripGapMm')
  })

  it('requires the legacy gap to be valid in schema 4 files', () => {
    const legacy = toLegacyProject(createProject(), 4)
    legacy.page.stripGapMm = -1

    expect(() =>
      parseProjectJsonWithCompatibility(JSON.stringify(legacy)),
    ).toThrow('page.stripGapMm must be at least 0.')
  })

  it('rejects mismatched cell counts', () => {
    const value = JSON.parse(serializeProject(createProject()))
    value.strips[0].rows[0].cells.pop()
    expect(() => parseProjectJson(JSON.stringify(value))).toThrow(
      'must contain exactly 16 cells',
    )
  })
})
