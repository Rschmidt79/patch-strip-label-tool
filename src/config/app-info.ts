import type { PageOrientation, PageSize } from '../model/project'

export const APP_VERSION = __APP_VERSION__
export const BUILD_DATE = __BUILD_DATE__
export const SUPPORT_URL = 'https://buymeacoffee.com/rschmidt'

export const FEEDBACK_EMAIL_ADDRESS = 'schmidt0809@gmail.com'

export const PRINT_SCALING_TITLE =
  'Verify printer scaling is set to 100% / Actual Size.'
export const PRINT_SCALING_BODY =
  'Do not use Fit or Shrink. Some printer drivers may silently scale the document.'

export interface FeedbackDiagnostics {
  browser: string
  pageFormat: PageSize
  orientation: PageOrientation
}

function safeDiagnosticLine(value: string): string {
  return Array.from(value, (character) => {
    const code = character.charCodeAt(0)
    return code <= 31 || code === 127 ? ' ' : character
  })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500)
}

export function createFeedbackMailto({
  browser,
  pageFormat,
  orientation,
}: FeedbackDiagnostics): string {
  const subject = 'Patch Strip Label Tool feedback'
  const safeBrowser = safeDiagnosticLine(browser)
  const safePageFormat = safeDiagnosticLine(pageFormat)
  const safeOrientation = safeDiagnosticLine(orientation)
  const body = [
    'Patch Strip Label Tool feedback',
    '',
    `Version: v${APP_VERSION}`,
    `Build: ${BUILD_DATE}`,
    `Browser: ${safeBrowser}`,
    `Page format: ${safePageFormat}`,
    `Orientation: ${safeOrientation}`,
    '',
    'Feedback:',
    '[write here]',
  ].join('\n')

  return `mailto:${FEEDBACK_EMAIL_ADDRESS}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
