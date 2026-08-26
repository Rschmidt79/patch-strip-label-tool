import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { StripJoinBar } from '../src/components/Workspace'

const noOp = () => undefined

describe('strip join status', () => {
  it('stays visible while the workspace scrolls and fits the compact layout', () => {
    const styles = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8')

    expect(styles).toMatch(/\.strip-join-bar\s*{[^}]*position:\s*sticky/s)
    expect(styles).toContain('width: calc(100vw - 334px)')
  })

  it('explains that join combines existing strips and provides cancel', () => {
    const markup = renderToStaticMarkup(
      <StripJoinBar
        selectedCount={2}
        error={undefined}
        onJoin={noOp}
        onCancel={noOp}
      />,
    )

    expect(markup).toContain('Join existing strips')
    expect(markup).toContain('2 selected')
    expect(markup).toContain('Keeps each strip’s content and settings')
    expect(markup).toContain('Cancel')
    expect(markup).toContain('Join selected')
    expect(markup).not.toContain('disabled')
  })

  it('shows the compatibility error and disables joining', () => {
    const markup = renderToStaticMarkup(
      <StripJoinBar
        selectedCount={1}
        error="Select at least two strips to join."
        onJoin={noOp}
        onCancel={noOp}
      />,
    )

    expect(markup).toContain('Select at least two strips to join.')
    expect(markup).toContain('disabled')
    expect(markup).toContain('Cancel')
  })
})
