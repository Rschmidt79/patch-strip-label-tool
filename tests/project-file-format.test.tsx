import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Toolbar } from '../src/components/Toolbar'
import {
  LEGACY_PROJECT_FILE_EXTENSION,
  PROJECT_FILE_ACCEPT,
  PROJECT_FILE_EXTENSION,
  PROJECT_FILE_MIME_TYPE,
} from '../src/config/project-files'
import {
  createProjectFileName,
  inferProjectNameFromFileName,
} from '../src/lib/project-file-name'
import {
  ProjectFileError,
  readProjectFileWithCompatibility,
  serializeProject,
} from '../src/lib/project-file'
import { createProject } from '../src/model/defaults'

function renderToolbar(): string {
  return renderToStaticMarkup(
    <Toolbar
      projectName="FlyAway"
      onProjectNameChange={() => undefined}
      onNewProject={() => undefined}
      onOpenProject={() => undefined}
      onSaveProject={() => undefined}
      onPrintPdf={() => undefined}
      onExportPdf={() => undefined}
      onExportCalibration={() => undefined}
    />,
  )
}

describe('Rack Label Maker project file presentation', () => {
  it('creates .racklabel filenames from project names', () => {
    expect(createProjectFileName('FlyAway')).toBe('FlyAway.racklabel')
    expect(createProjectFileName('FlyAway.racklabel')).toBe(
      'FlyAway.racklabel',
    )
    expect(createProjectFileName('FlyAway.racklabel.racklabel')).toBe(
      'FlyAway.racklabel',
    )
    expect(createProjectFileName('FlyAway.json')).toBe('FlyAway.racklabel')
  })

  it('sanitizes unsafe and reserved filename stems', () => {
    const fileName = createProjectFileName(' ../../Rack: A\\B*?"<>| ')
    expect(fileName).toMatch(/\.racklabel$/)
    expect(fileName).not.toMatch(/[/\\:*?"<>|]/)
    expect(createProjectFileName('CON')).toBe('_CON.racklabel')
    expect(createProjectFileName('.racklabel')).toBe('Untitled.racklabel')
  })

  it('centralizes the custom MIME type and picker extensions', () => {
    expect(PROJECT_FILE_MIME_TYPE).toBe('application/x-racklabel+json')
    expect(PROJECT_FILE_ACCEPT).toContain(PROJECT_FILE_EXTENSION)
    expect(PROJECT_FILE_ACCEPT).toContain(LEGACY_PROJECT_FILE_EXTENSION)
    const toolbar = renderToolbar()
    expect(toolbar).toContain('.racklabel')
    expect(toolbar).toContain('.json')
  })

  it('infers a small fallback project name without replacing project data', async () => {
    const unnamed = createProject()
    unnamed.name = ''
    const imported = await readProjectFileWithCompatibility(
      new File([serializeProject(unnamed)], 'FlyAway.racklabel', {
        type: PROJECT_FILE_MIME_TYPE,
      }),
    )
    expect(imported.project.name).toBe('FlyAway')
    expect(inferProjectNameFromFileName('Legacy.json')).toBe('Legacy')

    const named = createProject()
    named.name = 'Meaningful project name'
    const preserved = await readProjectFileWithCompatibility(
      new File([serializeProject(named)], 'Different.racklabel'),
    )
    expect(preserved.project.name).toBe('Meaningful project name')
  })
})

describe('canonical project file loading', () => {
  it('loads .racklabel and legacy .json through the same reader', async () => {
    const project = createProject()
    project.name = 'Canonical format'
    const contents = serializeProject(project)
    const racklabel = await readProjectFileWithCompatibility(
      new File([contents], 'Canonical.racklabel', {
        type: PROJECT_FILE_MIME_TYPE,
      }),
    )
    const legacyJson = await readProjectFileWithCompatibility(
      new File([contents], 'Canonical.json', { type: 'application/json' }),
    )

    expect(racklabel).toEqual(legacyJson)
    expect(racklabel.project).toEqual(project)
    expect(racklabel.project.schemaVersion).toBe(5)
  })

  it('reports invalid JSON and invalid schemas for either extension', async () => {
    await expect(
      readProjectFileWithCompatibility(
        new File(['{invalid'], 'Broken.racklabel'),
      ),
    ).rejects.toEqual(
      new ProjectFileError('The selected file is not valid JSON.'),
    )

    await expect(
      readProjectFileWithCompatibility(
        new File(['{}'], 'Broken.json', { type: 'application/json' }),
      ),
    ).rejects.toThrow('schemaVersion')
  })

  it('turns file read failures into a user-facing project error', async () => {
    const unreadable = {
      name: 'Unreadable.racklabel',
      size: 10,
      text: () => Promise.reject(new Error('device error')),
    } as File

    await expect(readProjectFileWithCompatibility(unreadable)).rejects.toEqual(
      new ProjectFileError('The selected project file could not be read.'),
    )
  })
})
