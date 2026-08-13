interface MobileScreenNoticeProps {
  onContinue: () => void
}

export function MobileScreenNotice({ onContinue }: MobileScreenNoticeProps) {
  return (
    <div className="mobile-screen-notice-backdrop">
      <section
        className="mobile-screen-notice"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-screen-notice-title"
      >
        <span className="eyebrow">Larger screen recommended</span>
        <h2 id="mobile-screen-notice-title">
          Racklabel works best on desktop 🖥️
        </h2>
        <p>
          This tool is designed for precise label editing and printing on a
          larger screen.
        </p>
        <p>
          Please open Racklabel on a desktop or laptop to create your labels.
        </p>
        <button
          type="button"
          className="button button-quiet mobile-screen-notice-action"
          onClick={onContinue}
        >
          Continue anyway
        </button>
      </section>
    </div>
  )
}
