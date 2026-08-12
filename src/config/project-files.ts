export const PROJECT_FILE_EXTENSION = '.racklabel'
export const LEGACY_PROJECT_FILE_EXTENSION = '.json'
export const PROJECT_FILE_MIME_TYPE = 'application/x-racklabel+json'

export const PROJECT_FILE_ACCEPT = [
  PROJECT_FILE_EXTENSION,
  LEGACY_PROJECT_FILE_EXTENSION,
  PROJECT_FILE_MIME_TYPE,
  'application/json',
].join(',')

export const PROJECT_FILE_EXTENSIONS = [
  PROJECT_FILE_EXTENSION,
  LEGACY_PROJECT_FILE_EXTENSION,
] as const
