import {
  APP_VERSION,
  BUILD_DATE,
  PRINT_SCALING_BODY,
  PRINT_SCALING_TITLE,
  SUPPORT_URL,
} from '../config/app-info'
import { APP_NAME } from '../config/branding'

interface AboutDialogProps {
  installPromptAvailable: boolean
  onInstallApp: () => void | Promise<void>
  onClose: () => void
}

export function AboutDialog({
  installPromptAvailable,
  onInstallApp,
  onClose,
}: AboutDialogProps) {
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="about-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-dialog-title"
      >
        <div className="about-heading">
          <div>
            <span className="eyebrow">Help / About</span>
            <h2 id="about-dialog-title">{APP_NAME}</h2>
            <p>
              Create editable rack and patch-panel labels at true physical
              dimensions, entirely in your browser.
            </p>
          </div>
          <button
            className="icon-button about-close"
            onClick={onClose}
            aria-label="Close Help and About"
            autoFocus
          >
            ×
          </button>
        </div>

        <div className="about-print-warning">
          <strong>{PRINT_SCALING_TITLE}</strong>
          <span>{PRINT_SCALING_BODY}</span>
        </div>

        <div className="about-guide">
          <h3>Quick guide</h3>
          <ul>
            <li>Click a cell to edit it; Shift-click extends a range.</li>
            <li>
              Auto numbering replaces <code>{'{n}'}</code> with each sequence
              number. The <strong>#</strong> button inserts the token.
            </li>
            <li>
              Group headers subdivide only their covered cells and remain
              inside the configured physical strip height.
            </li>
            <li>
              Projects are saved as <code>.racklabel</code> files. Older JSON
              project files can still be opened.
            </li>
            <li>
              Label data stays in this browser; the application has no backend
              or cloud project storage.
            </li>
          </ul>
        </div>

        {installPromptAvailable && (
          <div className="about-install">
            <div>
              <h3>Install Rack Label Maker</h3>
              <p>
                Install the app to use it offline and, on supported desktop
                platforms, open <code>.racklabel</code> files directly.
              </p>
            </div>
            <button className="button button-small" onClick={onInstallApp}>
              Install App
            </button>
          </div>
        )}

        <div className="about-support">
          <div>
            <h3>Like the tool?</h3>
            <p>If it saved you some time, you can buy me a coffee.</p>
          </div>
          <a
            className="button button-small"
            href={SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            ☕ Buy me a coffee
          </a>
        </div>

        <footer className="about-version">
          v{APP_VERSION} · Build {BUILD_DATE}
        </footer>
      </section>
    </div>
  )
}
