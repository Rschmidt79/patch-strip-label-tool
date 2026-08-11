const UNSAFE_FILE_NAME_CHARACTERS = /[/\\:*?"<>|\u202a-\u202e\u2066-\u2069]+/g
const WINDOWS_RESERVED_FILE_STEM = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i
const MAX_FILE_STEM_LENGTH = 80

export function safeFileStem(
  name: string,
  fallback = 'patch-strip-project',
): string {
  const withoutControlCharacters = Array.from(name, (character) => {
    const code = character.charCodeAt(0)
    return code <= 31 || code === 127 ? '-' : character
  }).join('')
  const normalized = withoutControlCharacters
    .normalize('NFKC')
    .replace(UNSAFE_FILE_NAME_CHARACTERS, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[. ]+/g, '')
    .slice(0, MAX_FILE_STEM_LENGTH)
    .replace(/[. ]+$/g, '')
  if (!normalized) return fallback
  return WINDOWS_RESERVED_FILE_STEM.test(normalized)
    ? `_${normalized}`
    : normalized
}

export function createLabelsPdfFileName(
  projectName: string,
  date = new Date(),
): string {
  const projectStem = safeFileStem(projectName, 'Untitled')
  const dateStamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
  return `Patch-Strip-Labels_${projectStem}_${dateStamp}.pdf`
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.style.display = 'none'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadText(
  text: string,
  fileName: string,
  mimeType: string,
): void {
  downloadBlob(new Blob([text], { type: mimeType }), fileName)
}

export function downloadBytes(
  bytes: Uint8Array,
  fileName: string,
  mimeType: string,
): void {
  const copy = new Uint8Array(bytes)
  downloadBlob(new Blob([copy.buffer], { type: mimeType }), fileName)
}

export function openPdfBytesInWindow(
  bytes: Uint8Array,
  targetWindow: Window,
): void {
  const copy = new Uint8Array(bytes)
  const url = URL.createObjectURL(
    new Blob([copy.buffer], { type: 'application/pdf' }),
  )
  targetWindow.location.replace(url)
  window.setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000)
}
