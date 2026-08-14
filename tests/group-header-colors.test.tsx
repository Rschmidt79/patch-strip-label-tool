import {
  decodePDFRawStream,
  PDFArray,
  PDFDocument,
  PDFRawStream,
} from 'pdf-lib'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PageLayoutPreview } from '../src/components/PageLayoutPreview'
import { StripArtwork } from '../src/components/StripArtwork'
import { DEFAULT_GROUP_HEADER_STYLE } from '../src/model/defaults'
import { addGroupHeader } from '../src/lib/group-headers'
import { createLabelsPdf } from '../src/lib/pdf-export'
import { planPrintLayout } from '../src/lib/print-layout'
import {
  parseProjectJson,
  serializeProject,
} from '../src/lib/project-file'
import { DEFAULT_PRINT_PREFERENCES } from '../src/lib/print-preferences'
import { createProject } from '../src/model/defaults'

function decodedPageContent(pdf: PDFDocument): string {
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

function coloredHeaderProject() {
  const project = createProject()
  const strip = project.strips[0]
  strip.rows[0] = addGroupHeader(
    strip.rows[0],
    { startIndex: 0, endIndex: 5 },
    'NETWORK',
  )
  strip.rows[0].groupHeaders[0].style = {
    ...strip.rows[0].groupHeaders[0].style,
    backgroundColor: '#112233',
    textColor: '#ffffff',
  }
  return project
}

describe('group-header background colours', () => {
  it('renders the same vector colour in the editor and page preview', () => {
    const project = coloredHeaderProject()
    const strip = project.strips[0]
    const plan = planPrintLayout(project, DEFAULT_PRINT_PREFERENCES)
    const editor = renderToStaticMarkup(
      <svg>
        <StripArtwork strip={strip} />
      </svg>,
    )
    const preview = renderToStaticMarkup(
      <PageLayoutPreview
        project={project}
        preferences={DEFAULT_PRINT_PREFERENCES}
        plan={plan}
        error={undefined}
        onPreferencesChange={() => undefined}
      />,
    )

    expect(editor).toContain('fill="#112233"')
    expect(editor).toContain('fill="#ffffff"')
    expect(preview).toContain('fill="#112233"')
    expect(preview).toContain('fill="#ffffff"')
  })

  it('renders the selected background and text colours into the vector PDF', async () => {
    const project = coloredHeaderProject()
    const bytes = await createLabelsPdf(project)
    const pdf = await PDFDocument.load(bytes)
    const content = decodedPageContent(pdf)

    expect(content).toContain(
      '0.06666666666666667 0.13333333333333333 0.2 rg',
    )
    expect(content).toContain('1 1 1 rg')
  })

  it('persists colours and supplies unchanged defaults to old headers without them', () => {
    const project = coloredHeaderProject()
    const reopened = parseProjectJson(serializeProject(project))
    expect(reopened.strips[0].rows[0].groupHeaders[0].style).toMatchObject({
      backgroundColor: '#112233',
      textColor: '#ffffff',
    })

    const legacy = JSON.parse(serializeProject(project))
    const block = legacy.strips[0]
    const row = { ...block.rows[0] }
    delete row.id
    delete row.name
    delete row.groupHeaders[0].style.backgroundColor
    delete row.groupHeaders[0].style.textColor
    legacy.schemaVersion = 2
    legacy.strips = [{ id: block.id, name: block.name, ...row }]
    const migrated = parseProjectJson(JSON.stringify(legacy))

    expect(migrated.strips[0].rows[0].groupHeaders[0].style).toMatchObject({
      backgroundColor: DEFAULT_GROUP_HEADER_STYLE.backgroundColor,
      textColor: DEFAULT_GROUP_HEADER_STYLE.textColor,
    })
  })
})
