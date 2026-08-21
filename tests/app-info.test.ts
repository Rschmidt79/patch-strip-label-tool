import { describe, expect, it } from 'vitest'
import {
  APP_VERSION,
  BUILD_DATE,
  createFeedbackMailto,
  FEEDBACK_EMAIL_ADDRESS,
  SUPPORT_URL,
} from '../src/config/app-info'
import packageMetadata from '../package.json'
import { renderToStaticMarkup } from 'react-dom/server'
import { AboutDialog } from '../src/components/AboutDialog'

describe('application information', () => {
  it('exposes package version and a build-injected ISO date', () => {
    expect(APP_VERSION).toBe(packageMetadata.version)
    expect(BUILD_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('shows the 1.0 and 0.9 changelogs without a startup modal', () => {
    const markup = renderToStaticMarkup(
      AboutDialog({
        installPromptAvailable: false,
        onInstallApp: () => undefined,
        onClose: () => undefined,
      }),
    )

    expect(markup).toContain(`v${packageMetadata.version}`)
    expect(markup).toContain('free browser-based rack label maker')
    expect(markup).toContain('19-inch racks')
    expect(markup).toContain('print-ready PDFs')
    expect(markup).toContain(
      'Automatic split printing for A4, US Letter, and US Legal',
    )
    expect(markup).toContain('Physical glue tabs and assembly guidance')
    expect(markup).toContain('Stable 1.0 release')
    expect(markup).toContain('v0.9.0-beta')
    expect(markup).toContain('Redesigned Inspector')
    expect(markup).toContain('Side-by-side Print layout controls')
    expect(markup).toContain('v0.7.0-beta')
    expect(markup).toContain('SRA3 support')
  })

  it('builds a privacy-safe diagnostic feedback draft', () => {
    const href = createFeedbackMailto({
      browser: 'Beta Browser 1.0',
      pageFormat: 'A3',
      orientation: 'landscape',
    })
    const query = href.slice(href.indexOf('?') + 1)
    const parameters = new URLSearchParams(query)
    const body = parameters.get('body') ?? ''

    expect(href.startsWith(`mailto:${FEEDBACK_EMAIL_ADDRESS}?`)).toBe(true)
    expect(parameters.get('subject')).toBe('Rack Label Maker feedback')
    expect(body).toContain(`Version: v${APP_VERSION}`)
    expect(body).toContain(`Build: ${BUILD_DATE}`)
    expect(body).toContain('Browser: Beta Browser 1.0')
    expect(body).toContain('Page format: A3')
    expect(body).toContain('Orientation: landscape')
    expect(body).toContain('Feedback:\n[write here]')
    expect(body).not.toContain('Studio Rack Labels')
    expect(body).not.toContain('Router Out')
  })

  it('uses the configured external support destination', () => {
    expect(SUPPORT_URL).toBe('https://buymeacoffee.com/rschmidt')
  })

  it('uses the clear US paper display name in feedback diagnostics', () => {
    const href = createFeedbackMailto({
      browser: 'Beta Browser 1.0',
      pageFormat: 'Letter',
      orientation: 'portrait',
    })
    const parameters = new URLSearchParams(href.slice(href.indexOf('?') + 1))

    expect(parameters.get('body')).toContain(
      'Page format: US Letter (8.5 × 11 in)',
    )
  })

  it('encodes and flattens hostile diagnostic values without adding headers', () => {
    const href = createFeedbackMailto({
      browser: 'Browser\r\nBcc: attacker@example.test&subject=override',
      pageFormat: 'A3',
      orientation: 'landscape',
    })
    const query = href.slice(href.indexOf('?') + 1)
    const parameters = new URLSearchParams(query)
    const body = parameters.get('body') ?? ''

    expect(href).not.toContain('\r')
    expect(href).not.toContain('\n')
    expect(href).not.toContain('&subject=override')
    expect(href.toLowerCase()).not.toContain('&bcc=')
    expect(body).toContain(
      'Browser: Browser Bcc: attacker@example.test&subject=override',
    )
  })
})
