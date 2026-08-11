import { describe, expect, it } from 'vitest'
import {
  parseProjectJson,
  ProjectFileError,
  serializeProject,
} from '../src/lib/project-file'
import { createProject } from '../src/model/defaults'
import { addGroupHeader } from '../src/lib/group-headers'
import { applyCellAppearanceToRange } from '../src/lib/cell-style'

describe('project JSON files', () => {
  it('round-trips a version 3 project with headers and cell styles', () => {
    const project = createProject()
    project.strips[0] = addGroupHeader(
      applyCellAppearanceToRange(
        project.strips[0],
        { startIndex: 0, endIndex: 5 },
        { backgroundColor: '#3973b9', textColor: '#ffffff' },
      ),
      { startIndex: 0, endIndex: 5 },
      'MICROPHONES',
    )
    project.strips[0].groupHeaders[0].style = {
      ...project.strips[0].groupHeaders[0].style,
      backgroundColor: '#112233',
      textColor: '#ffeeaa',
    }
    const imported = parseProjectJson(serializeProject(project))
    expect(imported).toEqual(project)
    expect(imported.schemaVersion).toBe(3)
  })

  it('migrates version 2 header projects to fixed-height internal bands', () => {
    const project = createProject()
    project.strips[0] = addGroupHeader(
      applyCellAppearanceToRange(
        project.strips[0],
        { startIndex: 0, endIndex: 5 },
        { backgroundColor: '#3973b9', textColor: '#ffffff' },
      ),
      { startIndex: 0, endIndex: 5 },
      'MICROPHONES',
    )
    project.strips[0].groupHeaders[0].style = {
      ...project.strips[0].groupHeaders[0].style,
      backgroundColor: '#112233',
      textColor: '#ffeeaa',
    }
    const legacy = JSON.parse(serializeProject(project))
    legacy.schemaVersion = 2
    legacy.strips[0].dimensions.groupHeaderHeightMm = 4
    delete legacy.strips[0].dimensions.groupHeaderBandHeightMm

    const imported = parseProjectJson(JSON.stringify(legacy))
    const strip = imported.strips[0]
    expect(imported.schemaVersion).toBe(3)
    expect(strip.dimensions.heightMm).toBe(7.5)
    expect(strip.dimensions.groupHeaderBandHeightMm).toBe(2)
    expect(strip.groupHeaders[0].text).toBe('MICROPHONES')
    expect(strip.groupHeaders[0]).toMatchObject({
      startCellIndex: 0,
      endCellIndex: 5,
      style: {
        backgroundColor: '#112233',
        textColor: '#ffeeaa',
      },
    })
    expect(strip.cells[0].appearance.backgroundColor).toBe('#3973b9')
  })

  it('migrates version 1 projects with sensible Milestone 4 defaults', () => {
    const legacy = JSON.parse(serializeProject(createProject()))
    legacy.schemaVersion = 1
    for (const strip of legacy.strips) {
      delete strip.dimensions.groupHeaderBandHeightMm
      delete strip.defaultCellAppearance
      delete strip.groupHeaders
      for (const cell of strip.cells) delete cell.appearance
    }

    const imported = parseProjectJson(JSON.stringify(legacy))
    expect(imported.schemaVersion).toBe(3)
    expect(imported.strips[0].dimensions.groupHeaderBandHeightMm).toBe(2)
    expect(imported.strips[0].groupHeaders).toEqual([])
    expect(imported.strips[0].cells[0].appearance).toEqual(
      imported.strips[0].defaultCellAppearance,
    )
  })

  it('rejects invalid JSON with a user-facing error', () => {
    expect(() => parseProjectJson('{invalid')).toThrowError(
      new ProjectFileError('The selected file is not valid JSON.'),
    )
  })

  it('rejects unsupported future versions', () => {
    const value = JSON.parse(serializeProject(createProject()))
    value.schemaVersion = 4
    expect(() => parseProjectJson(JSON.stringify(value))).toThrow(
      'Project version 4 is not supported',
    )
  })

  it('rejects mismatched cell counts', () => {
    const value = JSON.parse(serializeProject(createProject()))
    value.strips[0].cells.pop()
    expect(() => parseProjectJson(JSON.stringify(value))).toThrow(
      'must contain exactly 16 cells',
    )
  })
})
