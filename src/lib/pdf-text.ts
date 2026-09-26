import type { LabelProject } from '../model/project'

// Characters beyond Latin-1 that the WinAnsi (Windows-1252) encoding used by
// the PDF standard Helvetica fonts can still represent.
const WIN_ANSI_EXTRA_CHARACTERS = new Set(
  Array.from('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'),
)

// Readable stand-ins for common label symbols that WinAnsi cannot encode.
const PDF_TEXT_REPLACEMENTS: Readonly<Record<string, string>> = {
  '→': '->',
  '←': '<-',
  '↔': '<->',
  '⇒': '=>',
  '⇐': '<=',
  '⇔': '<=>',
  '≥': '>=',
  '≤': '<=',
  '≠': '!=',
  '≈': '~',
  '−': '-',
  '‐': '-',
  '‑': '-',
  '‒': '-',
  '′': "'",
  '″': '"',
  'Ω': 'Ohm',
  'μ': 'µ',
  '✓': 'v',
  '✔': 'v',
  '✗': 'x',
  '✘': 'x',
}

export const PDF_UNSUPPORTED_CHARACTER_FALLBACK = '?'

export function isPdfEncodableCharacter(character: string): boolean {
  const codePoint = character.codePointAt(0)
  if (codePoint === undefined) return true
  if (codePoint >= 0x20 && codePoint <= 0x7e) return true
  if (codePoint >= 0xa0 && codePoint <= 0xff) return true
  return WIN_ANSI_EXTRA_CHARACTERS.has(character)
}

function toPdfCharacter(character: string): string {
  if (isPdfEncodableCharacter(character)) return character
  if (/\s/.test(character)) return ' '
  return PDF_TEXT_REPLACEMENTS[character] ?? PDF_UNSUPPORTED_CHARACTER_FALLBACK
}

/** Converts user text into characters the PDF standard fonts can encode. */
export function toPdfText(text: string): string {
  return Array.from(text, toPdfCharacter).join('')
}

/** Lists each distinct printed character that the PDF must substitute. */
export function findPdfUnsupportedCharacters(project: LabelProject): string[] {
  const unsupported = new Set<string>()
  const collect = (text: string) => {
    for (const character of text) {
      if (!isPdfEncodableCharacter(character) && !/\s/.test(character)) {
        unsupported.add(character)
      }
    }
  }

  for (const strip of project.strips) {
    for (const row of strip.rows) {
      for (const cell of row.cells) {
        collect(cell.line1)
        collect(cell.line2)
      }
      for (const header of row.groupHeaders) collect(header.text)
    }
  }
  return [...unsupported]
}
