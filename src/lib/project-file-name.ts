import {
  PROJECT_FILE_EXTENSION,
  PROJECT_FILE_EXTENSIONS,
} from '../config/project-files'
import { MAX_NAME_LENGTH } from '../config/content-limits'
import { safeFileStem } from './download'

const ENDING_PROJECT_FILE_EXTENSIONS = new RegExp(
  `(?:${PROJECT_FILE_EXTENSIONS.map((extension) =>
    extension.replace('.', '\\.'),
  ).join('|')})$`,
  'i',
)

export function stripProjectFileExtensions(name: string): string {
  let result = name.trim()
  let previous = ''
  while (result !== previous) {
    previous = result
    result = result.replace(ENDING_PROJECT_FILE_EXTENSIONS, '').trim()
  }
  return result
}

export function createProjectFileName(projectName: string): string {
  const withoutExtension = stripProjectFileExtensions(projectName)
  return `${safeFileStem(withoutExtension, 'Untitled')}${PROJECT_FILE_EXTENSION}`
}

export function inferProjectNameFromFileName(
  fileName: string,
): string | undefined {
  const withoutExtension = stripProjectFileExtensions(fileName)
  const inferredName = withoutExtension.trim().slice(0, MAX_NAME_LENGTH)
  return inferredName || undefined
}
