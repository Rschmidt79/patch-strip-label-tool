import { describe, expect, it, vi } from 'vitest'
import { PROJECT_FILE_MIME_TYPE } from '../src/config/project-files'
import { registerProjectFileLaunchHandler } from '../src/lib/file-handling'
import {
  readProjectFileWithCompatibility,
  serializeProject,
} from '../src/lib/project-file'
import { createProject } from '../src/model/defaults'
import type { LabelProject } from '../src/model/project'

interface TestLaunchParams {
  files?: Array<{ kind?: string; getFile: () => Promise<File> }>
}

type TestConsumer = (params: TestLaunchParams) => void | Promise<void>

function createLaunchHost() {
  let consumer: TestConsumer | undefined
  return {
    host: {
      launchQueue: {
        setConsumer(nextConsumer: TestConsumer) {
          consumer = nextConsumer
        },
      },
    },
    consume(params: TestLaunchParams) {
      if (!consumer) throw new Error('No launch consumer was registered.')
      return consumer(params)
    },
  }
}

describe('installed-app project file launching', () => {
  it('passes launched files to the normal project loader', async () => {
    const launchedProject = createProject()
    launchedProject.name = 'Launched project'
    const launchedFile = new File(
      [serializeProject(launchedProject)],
      'Launched.racklabel',
      { type: PROJECT_FILE_MIME_TYPE },
    )
    const launch = createLaunchHost()
    let loadedProject: LabelProject | undefined
    const onError = vi.fn()

    expect(
      registerProjectFileLaunchHandler(launch.host, {
        onFile: async (file) => {
          loadedProject = (
            await readProjectFileWithCompatibility(file)
          ).project
        },
        onError,
      }),
    ).toBe(true)

    await launch.consume({
      files: [{ kind: 'file', getFile: async () => launchedFile }],
    })
    expect(loadedProject).toEqual(launchedProject)
    expect(onError).not.toHaveBeenCalled()
  })

  it('lets a launched file replace stale startup state', async () => {
    let currentProject = createProject()
    currentProject.name = 'Stale locally restored project'
    const launchedProject = createProject()
    launchedProject.name = 'Project from launch file'
    const launchedFile = new File(
      [serializeProject(launchedProject)],
      'Current.racklabel',
    )
    const launch = createLaunchHost()

    registerProjectFileLaunchHandler(launch.host, {
      onFile: async (file) => {
        currentProject = (
          await readProjectFileWithCompatibility(file)
        ).project
      },
      onError: () => undefined,
    })
    await launch.consume({
      files: [{ kind: 'file', getFile: async () => launchedFile }],
    })

    expect(currentProject.name).toBe('Project from launch file')
  })

  it('does nothing when launchQueue or a valid launch file is unavailable', async () => {
    const onFile = vi.fn()
    const onError = vi.fn()
    expect(
      registerProjectFileLaunchHandler(undefined, { onFile, onError }),
    ).toBe(false)
    expect(registerProjectFileLaunchHandler({}, { onFile, onError })).toBe(
      false,
    )

    const launch = createLaunchHost()
    registerProjectFileLaunchHandler(launch.host, { onFile, onError })
    await launch.consume({ files: [] })
    await launch.consume({
      files: [{ kind: 'directory', getFile: vi.fn() }],
    })
    expect(onFile).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })

  it('reports handle and loader failures without replacing current state', async () => {
    const launch = createLaunchHost()
    const onError = vi.fn()
    let currentProjectName = 'Editor remains open'
    registerProjectFileLaunchHandler(launch.host, {
      onFile: async (file) => {
        currentProjectName = (
          await readProjectFileWithCompatibility(file)
        ).project.name
      },
      onError,
    })

    await launch.consume({
      files: [
        {
          kind: 'file',
          getFile: async () => new File(['not json'], 'Broken.racklabel'),
        },
      ],
    })
    expect(currentProjectName).toBe('Editor remains open')
    expect(onError).toHaveBeenCalledOnce()

    await launch.consume({
      files: [
        {
          kind: 'file',
          getFile: () => Promise.reject(new Error('File handle failed')),
        },
      ],
    })
    expect(onError).toHaveBeenLastCalledWith(
      new Error('File handle failed'),
    )
  })
})
