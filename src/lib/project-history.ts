import type { LabelProject } from '../model/project'

export const MAX_PROJECT_HISTORY_ENTRIES = 100
/** Consecutive edits of the same thing within this window share one undo step. */
export const HISTORY_COALESCE_WINDOW_MS = 1000

export interface ProjectHistory {
  past: readonly LabelProject[]
  present: LabelProject
  future: readonly LabelProject[]
  /** The snapshot last saved, opened, or created. Compared by identity. */
  saved: LabelProject
  lastCoalesceKey?: string
  lastCommitAtMs?: number
}

export interface ProjectCommitOptions {
  /** Identifies a continuous edit, such as typing in one cell. */
  coalesceKey?: string
  /** Supplied by the caller so that commits stay pure. */
  timestampMs: number
}

export function createProjectHistory(project: LabelProject): ProjectHistory {
  return { past: [], present: project, future: [], saved: project }
}

/** Records a new project snapshot. Returning the same project is a no-op. */
export function commitProjectChange(
  history: ProjectHistory,
  next: LabelProject,
  options: ProjectCommitOptions,
): ProjectHistory {
  if (next === history.present) return history

  const continuesPreviousEdit =
    options.coalesceKey !== undefined &&
    options.coalesceKey === history.lastCoalesceKey &&
    history.lastCommitAtMs !== undefined &&
    options.timestampMs - history.lastCommitAtMs >= 0 &&
    options.timestampMs - history.lastCommitAtMs <=
      HISTORY_COALESCE_WINDOW_MS &&
    history.past.length > 0 &&
    // Never fold an edit into the saved snapshot; it must stay reachable.
    history.present !== history.saved

  return {
    past: continuesPreviousEdit
      ? history.past
      : [...history.past, history.present].slice(-MAX_PROJECT_HISTORY_ENTRIES),
    present: next,
    future: [],
    saved: history.saved,
    lastCoalesceKey: options.coalesceKey,
    lastCommitAtMs: options.timestampMs,
  }
}

export function canUndoProjectChange(history: ProjectHistory): boolean {
  return history.past.length > 0
}

export function canRedoProjectChange(history: ProjectHistory): boolean {
  return history.future.length > 0
}

export function undoProjectChange(history: ProjectHistory): ProjectHistory {
  const previous = history.past.at(-1)
  if (!previous) return history
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
    saved: history.saved,
  }
}

export function redoProjectChange(history: ProjectHistory): ProjectHistory {
  const next = history.future[0]
  if (!next) return history
  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
    saved: history.saved,
  }
}

/** Marks the current snapshot as the one stored on disk. */
export function markProjectSaved(history: ProjectHistory): ProjectHistory {
  return {
    ...history,
    saved: history.present,
    // The next edit must start a new step so the saved snapshot survives.
    lastCoalesceKey: undefined,
    lastCommitAtMs: undefined,
  }
}

export function hasUnsavedProjectChanges(history: ProjectHistory): boolean {
  return history.present !== history.saved
}
