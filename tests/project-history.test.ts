import { describe, expect, it } from 'vitest'
import {
  canRedoProjectChange,
  canUndoProjectChange,
  commitProjectChange,
  createProjectHistory,
  hasUnsavedProjectChanges,
  HISTORY_COALESCE_WINDOW_MS,
  markProjectSaved,
  MAX_PROJECT_HISTORY_ENTRIES,
  redoProjectChange,
  undoProjectChange,
} from '../src/lib/project-history'
import { createProject } from '../src/model/defaults'
import type { LabelProject } from '../src/model/project'

function rename(project: LabelProject, name: string): LabelProject {
  return { ...project, name }
}

describe('project undo/redo history', () => {
  it('undoes and redoes snapshots by identity', () => {
    const first = createProject()
    const second = rename(first, 'Second')
    const third = rename(second, 'Third')
    let history = createProjectHistory(first)
    expect(canUndoProjectChange(history)).toBe(false)

    history = commitProjectChange(history, second, { timestampMs: 0 })
    history = commitProjectChange(history, third, { timestampMs: 10 })
    expect(history.present).toBe(third)

    history = undoProjectChange(history)
    expect(history.present).toBe(second)
    expect(canRedoProjectChange(history)).toBe(true)
    history = undoProjectChange(history)
    expect(history.present).toBe(first)
    expect(undoProjectChange(history)).toBe(history)

    history = redoProjectChange(redoProjectChange(history))
    expect(history.present).toBe(third)
    expect(redoProjectChange(history)).toBe(history)
  })

  it('discards the redo branch after a new change and ignores no-ops', () => {
    const first = createProject()
    let history = commitProjectChange(
      createProjectHistory(first),
      rename(first, 'A'),
      { timestampMs: 0 },
    )
    expect(commitProjectChange(history, history.present, { timestampMs: 1 }))
      .toBe(history)

    history = undoProjectChange(history)
    history = commitProjectChange(history, rename(first, 'B'), {
      timestampMs: 2,
    })
    expect(canRedoProjectChange(history)).toBe(false)
    expect(history.present.name).toBe('B')
  })

  it('folds a continuous edit into one undo step but keeps separate edits apart', () => {
    const first = createProject()
    let history = createProjectHistory(first)
    const type = (name: string, timestampMs: number, key = 'cell-text:a') => {
      history = commitProjectChange(history, rename(history.present, name), {
        coalesceKey: key,
        timestampMs,
      })
    }

    type('C', 0)
    type('CA', 200)
    type('CAM', 400)
    expect(history.past).toHaveLength(1)
    expect(undoProjectChange(history).present).toBe(first)

    type('CAM 1', 400 + HISTORY_COALESCE_WINDOW_MS + 1)
    expect(history.past).toHaveLength(2)
    type('other cell', 400 + HISTORY_COALESCE_WINDOW_MS + 2, 'cell-text:b')
    expect(history.past).toHaveLength(3)
  })

  it('tracks unsaved changes against the saved snapshot, including after undo', () => {
    const first = createProject()
    let history = createProjectHistory(first)
    expect(hasUnsavedProjectChanges(history)).toBe(false)

    history = commitProjectChange(history, rename(first, 'A'), {
      coalesceKey: 'project-name',
      timestampMs: 0,
    })
    expect(hasUnsavedProjectChanges(history)).toBe(true)
    expect(hasUnsavedProjectChanges(undoProjectChange(history))).toBe(false)

    history = markProjectSaved(history)
    expect(hasUnsavedProjectChanges(history)).toBe(false)

    // Typing on directly after a save must not overwrite the saved snapshot.
    history = commitProjectChange(history, rename(history.present, 'AB'), {
      coalesceKey: 'project-name',
      timestampMs: 100,
    })
    expect(hasUnsavedProjectChanges(history)).toBe(true)
    history = undoProjectChange(history)
    expect(history.present.name).toBe('A')
    expect(hasUnsavedProjectChanges(history)).toBe(false)
  })

  it('caps the number of stored undo steps', () => {
    let history = createProjectHistory(createProject())
    for (let index = 0; index < MAX_PROJECT_HISTORY_ENTRIES + 25; index += 1) {
      history = commitProjectChange(
        history,
        rename(history.present, `Name ${index}`),
        { timestampMs: index },
      )
    }
    expect(history.past).toHaveLength(MAX_PROJECT_HISTORY_ENTRIES)
  })
})
