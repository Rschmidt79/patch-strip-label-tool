import { describe, expect, it } from 'vitest'
import { createLabelsPdf } from '../src/lib/pdf-export'
import {
  findPdfUnsupportedCharacters,
  toPdfText,
} from '../src/lib/pdf-text'
import { addGroupHeader } from '../src/lib/group-headers'
import { resolveInitialPrintPreferences } from '../src/lib/print-preferences'
import { createProject } from '../src/model/defaults'

describe('PDF text encoding', () => {
  it('keeps Danish and Windows-1252 characters unchanged', () => {
    expect(toPdfText('ÆØÅ æøå – “Mic” € µ ×')).toBe('ÆØÅ æøå – “Mic” € µ ×')
  })

  it('composes decomposed accents and drops invisible characters', () => {
    expect(toPdfText('Ska\u030ane fo\u0308r e\u0301')).toBe('Skåne för é')
    expect(toPdfText('a\u200bb\ufeffc\u2060d')).toBe('abcd')

    const project = createProject()
    project.strips[0].rows[0].cells[0].line1 = 'Ska\u030ane\u200b'
    expect(findPdfUnsupportedCharacters(project)).toEqual([])
  })

  it('replaces characters the standard PDF fonts cannot encode', () => {
    expect(toPdfText('SDI → Router ≥ 75 Ω ✓ 🎤')).toBe(
      'SDI -> Router >= 75 Ohm v ?',
    )
  })

  it('lists unsupported characters from cells and headers once', () => {
    const project = createProject()
    const row = project.strips[0].rows[0]
    row.cells[0].line1 = 'A → B'
    row.cells[1].line2 = '→ Ω'
    project.strips[0].rows[0] = addGroupHeader(
      row,
      { startIndex: 0, endIndex: 1 },
      'Mix ≥',
    )
    expect(findPdfUnsupportedCharacters(project)).toEqual(['→', 'Ω', '≥'])
  })

  it('exports a PDF instead of failing on unsupported characters', async () => {
    const project = createProject()
    const row = project.strips[0].rows[0]
    row.cells[0].line1 = 'SDI → Router'
    row.cells[1].line1 = 'Ω 75 ✓'
    project.strips[0].rows[0] = addGroupHeader(
      row,
      { startIndex: 0, endIndex: 1 },
      'CH ≥ 1',
    )
    const preferences = resolveInitialPrintPreferences(undefined, project.page)
    const bytes = await createLabelsPdf(project, preferences)
    expect(bytes.byteLength).toBeGreaterThan(0)
  })
})
