import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MobileScreenNotice } from '../src/components/MobileScreenNotice'

describe('small-screen notice', () => {
  it('explains the desktop-first experience and offers a way through', () => {
    const markup = renderToStaticMarkup(
      <MobileScreenNotice onContinue={() => undefined} />,
    )

    expect(markup).toContain('Racklabel works best on desktop 🖥️')
    expect(markup).toContain('precise label editing and printing')
    expect(markup).toContain('desktop or laptop')
    expect(markup).toContain('Continue anyway')
    expect(markup).toContain('role="dialog"')
  })
})
