import { APP_VERSION, BUILD_DATE, SUPPORT_URL } from '../config/app-info'

interface AppFooterProps {
  feedbackHref: string
  onOpenHelp: () => void
}

export function AppFooter({ feedbackHref, onOpenHelp }: AppFooterProps) {
  return (
    <footer className="app-footer">
      <span>
        v{APP_VERSION} · Build {BUILD_DATE}
      </span>
      <nav aria-label="Application information and support">
        <button type="button" onClick={onOpenHelp}>
          Help / About
        </button>
        <a href={feedbackHref}>Send feedback</a>
        <a
          href={SUPPORT_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          ☕ Buy me a coffee
        </a>
      </nav>
    </footer>
  )
}
