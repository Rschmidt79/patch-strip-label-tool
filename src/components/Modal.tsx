import { useEffect, useRef, useState, type ReactNode } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface ModalProps {
  /** Class of the dialog panel, for example `print-reminder`. */
  className: string
  /** ID of the heading that names the dialog. */
  labelledBy: string
  onClose: () => void
  /** Whether a click on the dimmed backdrop closes the dialog. */
  closeOnBackdrop?: boolean
  children: ReactNode
}

/**
 * Modal dialog shell: Escape closes it, Tab stays inside it, and focus
 * returns to the element that opened it.
 */
export function Modal({
  className,
  labelledBy,
  onClose,
  closeOnBackdrop = true,
  children,
}: ModalProps) {
  // Captured while rendering, before an auto-focused button inside the
  // dialog takes focus, so it can be handed back when the dialog closes.
  const [opener] = useState(() =>
    typeof document !== 'undefined' &&
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : undefined,
  )

  const panelRef = useRef<HTMLElement>(null)
  const initialFocusRef = useRef<HTMLElement | undefined>(undefined)

  useEffect(() => {
    const panel = panelRef.current
    if (panel) {
      const active = document.activeElement
      if (active instanceof HTMLElement && panel.contains(active)) {
        initialFocusRef.current = active
      } else {
        // Focus must start inside the dialog, also when React re-runs this
        // effect in development.
        const target =
          initialFocusRef.current ??
          panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ??
          undefined
        target?.focus()
      }
    }
    return () => opener?.focus()
  }, [opener])

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onPointerDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose()
      }}
    >
      <section
        ref={panelRef}
        className={className}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            onClose()
            return
          }
          if (event.key !== 'Tab') return
          const focusable = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              FOCUSABLE_SELECTOR,
            ),
          )
          const first = focusable[0]
          const last = focusable[focusable.length - 1]
          if (!first || !last) {
            event.preventDefault()
            return
          }
          const active = document.activeElement
          if (event.shiftKey && (active === first || !event.currentTarget.contains(active))) {
            event.preventDefault()
            last.focus()
          } else if (!event.shiftKey && (active === last || !event.currentTarget.contains(active))) {
            event.preventDefault()
            first.focus()
          }
        }}
      >
        {children}
      </section>
    </div>
  )
}
