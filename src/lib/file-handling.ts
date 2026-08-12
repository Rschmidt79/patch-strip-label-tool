interface ProjectFileHandle {
  kind?: string
  getFile: () => Promise<File>
}

interface ProjectLaunchParams {
  files?: readonly ProjectFileHandle[]
}

interface ProjectLaunchQueue {
  setConsumer: (
    consumer: (launchParams: ProjectLaunchParams) => void | Promise<void>,
  ) => void
}

interface FileHandlingHost {
  launchQueue?: ProjectLaunchQueue
}

export interface ProjectFileLaunchCallbacks {
  onFile: (file: File) => void | Promise<void>
  onError: (error: Error) => void
}

export function registerProjectFileLaunchHandler(
  host: unknown,
  callbacks: ProjectFileLaunchCallbacks,
): boolean {
  if (typeof host !== 'object' || host === null) return false
  const { launchQueue } = host as FileHandlingHost
  if (!launchQueue?.setConsumer) return false

  launchQueue.setConsumer(async (launchParams) => {
    const handle = launchParams.files?.find(
      (candidate) =>
        candidate.kind === undefined || candidate.kind === 'file',
    )
    if (!handle) return

    try {
      await callbacks.onFile(await handle.getFile())
    } catch (error) {
      callbacks.onError(
        error instanceof Error
          ? error
          : new Error('The launched project file could not be read.'),
      )
    }
  })
  return true
}
