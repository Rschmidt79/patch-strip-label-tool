import { useRef } from 'react'
import { MAX_NAME_LENGTH } from '../config/content-limits'

interface ToolbarProps {
  projectName: string
  onProjectNameChange: (name: string) => void
  onNewProject: () => void
  onOpenProject: (file: File) => void | Promise<void>
  onSaveProject: () => void
  onPrintPdf: () => void | Promise<void>
  onExportPdf: () => void | Promise<void>
  onExportCalibration: () => void | Promise<void>
  busyAction?: 'pdf' | 'print' | 'calibration'
}

export function Toolbar({
  projectName,
  onProjectNameChange,
  onNewProject,
  onOpenProject,
  onSaveProject,
  onPrintPdf,
  onExportPdf,
  onExportCalibration,
  busyAction,
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <header className="topbar">
      <div className="brand" aria-label="Patch Strip Label Tool">
        <div className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div>
          <strong>Patch Strip</strong>
          <small>Label Tool</small>
        </div>
        <span className="beta-badge">Beta</span>
      </div>

      <label className="project-name-field">
        <span>Project</span>
        <input
          value={projectName}
          maxLength={MAX_NAME_LENGTH}
          onChange={(event) => onProjectNameChange(event.target.value)}
          aria-label="Project name"
        />
      </label>

      <nav className="toolbar-actions" aria-label="Project actions">
        <button className="button button-quiet" onClick={onNewProject}>
          New
        </button>
        <button
          className="button button-quiet"
          onClick={() => fileInputRef.current?.click()}
        >
          Open
        </button>
        <input
          ref={fileInputRef}
          className="visually-hidden"
          type="file"
          accept=".json,application/json"
          aria-label="Open project JSON file"
          onChange={async (event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) await onOpenProject(file)
          }}
        />
        <button
          className="button button-quiet"
          onClick={onSaveProject}
        >
          Save
        </button>
        <div className="toolbar-divider" />
        <button
          className="button button-quiet"
          onClick={onExportCalibration}
          disabled={busyAction !== undefined}
          title="Download a 100 × 100 mm printer calibration PDF"
        >
          {busyAction === 'calibration' ? 'Creating…' : 'Calibration'}
        </button>
        <button
          className="button button-quiet"
          onClick={onPrintPdf}
          disabled={busyAction !== undefined}
          title="Open the exact-size PDF in the browser for printing"
        >
          {busyAction === 'print' ? 'Preparing…' : 'Print'}
        </button>
        <button
          className="button button-primary"
          onClick={onExportPdf}
          disabled={busyAction !== undefined}
        >
          {busyAction === 'pdf' ? 'Creating PDF…' : 'Export PDF'}
        </button>
      </nav>
    </header>
  )
}
