import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  decodePDFRawStream,
  PDFArray,
  PDFDocument,
  PDFRawStream,
} from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { Toolbar } from '../src/components/Toolbar'
import { StripArtwork } from '../src/components/StripArtwork'
import {
  MAX_CELLS_PER_STRIP,
  MAX_CELL_TEXT_LENGTH,
  MAX_PROJECT_STRIPS,
} from '../src/config/content-limits'
import { addGroupHeader } from '../src/lib/group-headers'
import {
  createLabelsPdfFileName,
  safeFileStem,
} from '../src/lib/download'
import {
  parseProjectJson,
  ProjectFileError,
  serializeProject,
} from '../src/lib/project-file'
import { createProject } from '../src/model/defaults'
import { createLabelsPdf } from '../src/lib/pdf-export'

const ATTACK_STRINGS = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '"><svg onload=alert(1)>',
  'javascript:alert(1)',
  '</text><script>alert(1)</script>',
  '${alert(1)}',
  "{{constructor.constructor('alert(1)')()}}",
]

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)
    return statSync(path).isDirectory() ? listSourceFiles(path) : [path]
  })
}

function getDecodedPageContent(pdf: PDFDocument): string {
  const contents = pdf.getPage(0).node.Contents()
  if (!contents) return ''
  const streams =
    contents instanceof PDFArray
      ? Array.from({ length: contents.size() }, (_, index) =>
          contents.lookup(index, PDFRawStream),
        )
      : contents instanceof PDFRawStream
        ? [contents]
        : []
  return streams
    .map((stream) =>
      new TextDecoder().decode(decodePDFRawStream(stream).decode()),
    )
    .join('\n')
}

function asciiHex(text: string): string {
  return Array.from(new TextEncoder().encode(text), (byte) =>
    byte.toString(16).padStart(2, '0'),
  )
    .join('')
    .toUpperCase()
}

describe('untrusted project content', () => {
  it.each(ATTACK_STRINGS)(
    'renders hostile cell and header content as literal SVG text: %s',
    (attack) => {
      const project = createProject()
      const strip = project.strips[0]
      let row = strip.rows[0]
      row.cells[0] = {
        ...row.cells[0],
        line1: attack,
        line2: attack,
      }
      row = addGroupHeader(
        row,
        { startIndex: 0, endIndex: 3 },
        attack,
      )
      strip.rows[0] = row
      const markup = renderToStaticMarkup(
        <svg>
          <StripArtwork strip={strip} />
        </svg>,
      )

      expect(markup).not.toMatch(/<script(?:\s|>)/i)
      expect(markup).not.toMatch(/<img(?:\s|>)/i)
      expect(markup).not.toMatch(/<svg\s+onload/i)
      if (attack.includes('<')) expect(markup).toContain('&lt;')
    },
  )

  it('escapes malicious project names in the real toolbar input', () => {
    const attack = '"><svg onload=alert(1)>'
    const markup = renderToStaticMarkup(
      <Toolbar
        projectName={attack}
        onProjectNameChange={() => undefined}
        onNewProject={() => undefined}
        onOpenProject={() => undefined}
        onSaveProject={() => undefined}
        onPrintPdf={() => undefined}
        onExportPdf={() => undefined}
        onExportCalibration={() => undefined}
      />,
    )

    expect(markup).not.toMatch(/<svg\s+onload/i)
    expect(markup).toContain('&quot;&gt;&lt;svg onload=alert(1)&gt;')
  })

  it('preserves literal hostile names and label text through safe JSON parsing', () => {
    const project = createProject()
    const attack = '</text><script>alert(1)</script>'
    project.name = attack
    project.strips[0].name = attack
    project.strips[0].rows[0].cells[0].line1 = attack
    project.strips[0].rows[0] = addGroupHeader(
      project.strips[0].rows[0],
      { startIndex: 0, endIndex: 3 },
      attack,
    )

    const imported = parseProjectJson(serializeProject(project))
    expect(imported.name).toBe(attack)
    expect(imported.strips[0].name).toBe(attack)
    expect(imported.strips[0].rows[0].cells[0].line1).toBe(attack)
    expect(imported.strips[0].rows[0].groupHeaders[0].text).toBe(attack)
  })

  it('exports script-like angle-bracket text as inert PDF text data', async () => {
    const project = createProject()
    const attack = '</text><script>alert(1)</script>'
    project.strips[0].rows[0].cells[0].line1 = attack
    project.strips[0].rows[0] = addGroupHeader(
      project.strips[0].rows[0],
      { startIndex: 0, endIndex: 3 },
      '<script>alert(1)</script>',
    )

    const bytes = await createLabelsPdf(project)
    const pdf = await PDFDocument.load(bytes)
    const content = getDecodedPageContent(pdf)
    expect(content).toContain(asciiHex(attack))
    expect(content).toContain(asciiHex('<script>alert(1)</script>'))
  })

  it('does not copy prototype-pollution keys from imported JSON', () => {
    const serialized = serializeProject(createProject()).replace(
      /^\{/,
      '{"__proto__":{"polluted":true},',
    )
    const imported = parseProjectJson(serialized)
    expect(imported).not.toHaveProperty('__proto__.polluted', true)
    expect((Object.prototype as { polluted?: boolean }).polluted).toBeUndefined()
  })
})

describe('project import resource and style validation', () => {
  it('rejects non-finite numeric values represented by an overflowing exponent', () => {
    const serialized = serializeProject(createProject()).replace(
      '"widthMm": 432',
      '"widthMm": 1e999',
    )
    expect(() => parseProjectJson(serialized)).toThrow('finite number')
  })

  it('rejects excessive cell, strip, header, and text counts before rendering', () => {
    const tooManyCells = JSON.parse(serializeProject(createProject()))
    tooManyCells.strips[0].rows[0].dimensions.cellCount =
      MAX_CELLS_PER_STRIP + 1
    expect(() => parseProjectJson(JSON.stringify(tooManyCells))).toThrow(
      `no more than ${MAX_CELLS_PER_STRIP}`,
    )

    const tooManyStrips = JSON.parse(serializeProject(createProject()))
    tooManyStrips.strips = Array.from(
      { length: MAX_PROJECT_STRIPS + 1 },
      () => tooManyStrips.strips[0],
    )
    expect(() => parseProjectJson(JSON.stringify(tooManyStrips))).toThrow(
      `no more than ${MAX_PROJECT_STRIPS}`,
    )

    const tooManyHeaders = JSON.parse(serializeProject(createProject()))
    tooManyHeaders.strips[0].rows[0].groupHeaders = Array.from(
      { length: tooManyHeaders.strips[0].rows[0].dimensions.cellCount + 1 },
      () => ({ id: 'group', text: '', startCellIndex: 0, endCellIndex: 0 }),
    )
    expect(() => parseProjectJson(JSON.stringify(tooManyHeaders))).toThrow(
      'cannot contain more entries than cells',
    )

    const overlongText = JSON.parse(serializeProject(createProject()))
    overlongText.strips[0].rows[0].cells[0].line1 = 'x'.repeat(
      MAX_CELL_TEXT_LENGTH + 1,
    )
    expect(() => parseProjectJson(JSON.stringify(overlongText))).toThrow(
      `no more than ${MAX_CELL_TEXT_LENGTH} characters`,
    )
  })

  it('rejects executable CSS and URL-like color values', () => {
    for (const color of [
      'url(javascript:alert(1))',
      'expression(alert(1))',
      'red; background:url(https://example.test)',
      '#fff',
    ]) {
      const value = JSON.parse(serializeProject(createProject()))
      value.strips[0].rows[0].cells[0].appearance.backgroundColor = color
      expect(() => parseProjectJson(JSON.stringify(value))).toThrow(
        ProjectFileError,
      )
    }
  })
})

describe('safe browser output helpers', () => {
  it('creates human-readable filenames without path or reserved characters', () => {
    const stem = safeFileStem(' ../../Rack: A\\B*?"<>| ')
    const pdfName = createLabelsPdfFileName(
      ' ../../Rack: A\\B*?"<>| ',
      new Date(2026, 7, 11),
    )

    expect(stem).toContain('Rack')
    expect(stem).not.toMatch(/[/\\:*?"<>|]/)
    expect(
      Array.from(stem).every((character) => {
        const code = character.charCodeAt(0)
        return code > 31 && code !== 127
      }),
    ).toBe(true)
    expect(stem).not.toMatch(/^\./)
    expect(safeFileStem('CON')).toBe('_CON')
    expect(pdfName).toBe(`Patch-Strip-Labels_${stem}_2026-08-11.pdf`)
  })

  it('contains none of the audited executable-markup APIs in application source', () => {
    const source = listSourceFiles(join(process.cwd(), 'src'))
      .filter((path) => /\.(ts|tsx)$/.test(path))
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n')

    expect(source).not.toMatch(/dangerouslySetInnerHTML/)
    expect(source).not.toMatch(/\.innerHTML\b/)
    expect(source).not.toMatch(/\.outerHTML\b/)
    expect(source).not.toMatch(/insertAdjacentHTML/)
    expect(source).not.toMatch(/\beval\s*\(/)
    expect(source).not.toMatch(/new\s+Function\s*\(/)
    expect(source).not.toMatch(/document\.write\s*\(/)
    expect(source).not.toMatch(/javascript:/i)
  })

  it('ships a conservative CSP and related static-host headers', () => {
    const vercel = JSON.parse(
      readFileSync(join(process.cwd(), 'vercel.json'), 'utf8'),
    ) as {
      headers: Array<{
        headers: Array<{ key: string; value: string }>
      }>
    }
    const configured = new Map(
      vercel.headers[0].headers.map(({ key, value }) => [key, value]),
    )
    const csp = configured.get('Content-Security-Policy') ?? ''
    const netlifyHeaders = readFileSync(
      join(process.cwd(), 'public/_headers'),
      'utf8',
    )

    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("script-src 'self'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'")
    expect(configured.get('X-Content-Type-Options')).toBe('nosniff')
    expect(configured.get('Referrer-Policy')).toBe(
      'strict-origin-when-cross-origin',
    )
    expect(configured.get('Permissions-Policy')).toContain('camera=()')
    expect(netlifyHeaders).toContain(csp)
  })
})
