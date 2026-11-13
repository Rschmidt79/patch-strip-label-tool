import { Component, type ErrorInfo, type ReactNode } from 'react'

interface AppErrorBoundaryProps {
  children: ReactNode
}

interface AppErrorBoundaryState {
  failed: boolean
}

/** Replaces a blank page with an explanation if rendering ever fails. */
export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Rack Label Maker stopped unexpectedly.', error, info)
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children
    return (
      <main className="app-error" role="alert">
        <h1>Something went wrong</h1>
        <p>
          The editor stopped unexpectedly. Reload the page to continue. Changes
          made since the last save are lost.
        </p>
        <button
          className="button button-primary"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </main>
    )
  }
}
