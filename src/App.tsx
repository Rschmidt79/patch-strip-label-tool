import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AboutDialog } from './components/AboutDialog'
import { AppFooter } from './components/AppFooter'
import { MobileScreenNotice } from './components/MobileScreenNotice'
import { Sidebar } from './components/Sidebar'
import { Toolbar } from './components/Toolbar'
import { Workspace } from './components/Workspace'
import { createProject, createStrip } from './model/defaults'
import {
  addStripRow,
  duplicateStrip,
  getStripJoinError,
  joinStrips,
  removeStrip,
  resizeStripRows,
  splitStripRows,
  updateStripRow,
} from './lib/strip'
import {
  applyCellAppearanceToRange,
  resetCellRangeStyle,
  shiftCellRangeLightness,
} from './lib/cell-style'
import {
  addGroupHeader,
  GroupHeaderRangeError,
  removeGroupHeader,
  updateGroupHeader,
} from './lib/group-headers'
import {
  applyAutoNumbering,
  applyAutoNumberingToRange,
  clearCellRangeContents,
} from './lib/auto-numbering'
import {
  createLabelsPdfFileName,
  downloadBytes,
  downloadText,
  openPdfBytesInWindow,
} from './lib/download'
import { planPrintLayout, type PrintLayoutPlan } from './lib/print-layout'
import {
  ProjectFileError,
  readProjectFileWithCompatibility,
  serializeProject,
} from './lib/project-file'
import { createProjectFileName } from './lib/project-file-name'
import { registerProjectFileLaunchHandler } from './lib/file-handling'
import {
  listenForAppInstallPrompt,
  type AppInstallPromptEvent,
} from './lib/pwa-install'
import {
  getPrintPageSettings,
  readStoredPrintPreferences,
  resolveInitialPrintPreferences,
  savePrintPreferences,
  type PrintPreferences,
  type StorageLike,
} from './lib/print-preferences'
import type {
  CellAppearance,
  GroupHeader,
  LabelCell,
  LabelProject,
  LabelStrip,
  LabelStripRow,
} from './model/project'
import {
  createFeedbackMailto,
  PRINT_SCALING_BODY,
  PRINT_SCALING_TITLE,
} from './config/app-info'
import {
  MAX_PROJECT_ROWS,
  MAX_PROJECT_STRIPS,
} from './config/content-limits'
import { PROJECT_FILE_MIME_TYPE } from './config/project-files'
import {
  isEditorSelectionValid,
  resolveEditorCellSelection,
  selectEditorCell,
  type EditorSelection,
} from './lib/editor-selection'

interface AppNotice {
  kind: 'success' | 'error'
  message: string
}

interface PageLayoutResult {
  plan?: PrintLayoutPlan
  error?: string
}

function getBrowserStorage(): StorageLike | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined
  }
}

export function App() {
  const [project, setProject] = useState<LabelProject>(createProject)
  const [storedPrintPreferences] = useState(() =>
    readStoredPrintPreferences(getBrowserStorage()),
  )
  const [printPreferences, setPrintPreferences] = useState(() =>
    resolveInitialPrintPreferences(storedPrintPreferences, project.page),
  )
  const printPreferencesSource = useRef<
    'default' | 'legacy-project' | 'stored' | 'user'
  >(
    storedPrintPreferences ? 'stored' : 'default',
  )
  const [activeStripId, setActiveStripId] = useState<string | undefined>(
    project.strips[0]?.id,
  )
  const [activeRowId, setActiveRowId] = useState<string | undefined>(
    project.strips[0]?.rows[0]?.id,
  )
  const [selectedJoinStripIds, setSelectedJoinStripIds] = useState<string[]>([])
  const [selection, setSelection] = useState<EditorSelection | undefined>()
  const [editingCellId, setEditingCellId] = useState<string | undefined>()
  const [previewScale, setPreviewScale] = useState(1.35)
  const [notice, setNotice] = useState<AppNotice | undefined>()
  const [showPrintReminder, setShowPrintReminder] = useState(false)
  const [showCalibrationReminder, setShowCalibrationReminder] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [showMobileScreenNotice, setShowMobileScreenNotice] = useState(true)
  const [installPrompt, setInstallPrompt] = useState<
    AppInstallPromptEvent | undefined
  >()
  const [pendingDeleteStripId, setPendingDeleteStripId] = useState<string>()
  const [busyAction, setBusyAction] = useState<
    'pdf' | 'print' | 'calibration'
  >()

  useEffect(() => {
    savePrintPreferences(getBrowserStorage(), printPreferences)
  }, [printPreferences])

  useEffect(() => listenForAppInstallPrompt(window, setInstallPrompt), [])

  const activeStrip = useMemo(
    () => project.strips.find((strip) => strip.id === activeStripId),
    [activeStripId, project.strips],
  )
  const activeRow = useMemo(
    () => activeStrip?.rows.find((row) => row.id === activeRowId),
    [activeRowId, activeStrip],
  )
  const activeRowIndex = activeStrip?.rows.findIndex(
    (row) => row.id === activeRowId,
  ) ?? -1
  const resolvedSelection = useMemo(
    () => resolveEditorCellSelection(project.strips, selection),
    [project.strips, selection],
  )
  const selectedCell = useMemo(
    () =>
      resolvedSelection?.cellIds.length === 1
        ? project.strips
            .find((strip) => strip.id === resolvedSelection.stripId)
            ?.rows.find((row) => row.id === resolvedSelection.rowId)
            ?.cells[resolvedSelection.startIndex]
        : undefined,
    [project.strips, resolvedSelection],
  )
  const selectedRangeLabel = useMemo(() => {
    if (!resolvedSelection) return undefined
    const strip = project.strips.find(
      (candidate) => candidate.id === resolvedSelection.stripId,
    )
    const rowIndex = strip?.rows.findIndex(
      (row) => row.id === resolvedSelection.rowId,
    ) ?? -1
    const start = resolvedSelection.startIndex + 1
    const end = resolvedSelection.endIndex + 1
    const cells = start === end ? `Cell ${start}` : `Cells ${start}–${end}`
    return strip && strip.rows.length > 1 && rowIndex >= 0
      ? `Row ${rowIndex + 1} · ${cells}`
      : cells
  }, [project.strips, resolvedSelection])
  const selectedGroupHeader = useMemo(() => {
    if (!activeRow || selection?.kind !== 'header') return undefined
    return activeRow.groupHeaders.find(
      (header) => header.id === selection.headerId,
    )
  }, [activeRow, selection])
  const joinError = useMemo(
    () =>
      selectedJoinStripIds.length > 0
        ? getStripJoinError(project.strips, selectedJoinStripIds)
        : undefined,
    [project.strips, selectedJoinStripIds],
  )
  const pendingDeleteStrip = useMemo(
    () =>
      project.strips.find((strip) => strip.id === pendingDeleteStripId),
    [pendingDeleteStripId, project.strips],
  )
  const pageLayout = useMemo<PageLayoutResult>(() => {
    if (project.strips.length === 0) return {}
    try {
      return { plan: planPrintLayout(project, printPreferences) }
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : 'The page layout could not be calculated.',
      }
    }
  }, [printPreferences, project])
  const feedbackHref = useMemo(
    () =>
      createFeedbackMailto({
        browser: window.navigator.userAgent,
        pageFormat: printPreferences.paperSize,
        orientation: printPreferences.orientation,
      }),
    [printPreferences.orientation, printPreferences.paperSize],
  )

  function handlePrintPreferencesChange(preferences: PrintPreferences) {
    printPreferencesSource.current = 'user'
    setPrintPreferences(preferences)
  }

  function updateProject(updater: (current: LabelProject) => LabelProject) {
    setProject((current) => ({
      ...updater(current),
      updatedAt: new Date().toISOString(),
    }))
  }

  function updateStrip(
    stripId: string,
    updater: (strip: LabelStrip) => LabelStrip,
  ) {
    updateProject((current) => ({
      ...current,
      strips: current.strips.map((strip) =>
        strip.id === stripId ? updater(strip) : strip,
      ),
    }))
  }

  function updateRow(
    stripId: string,
    rowId: string,
    updater: (row: LabelStripRow) => LabelStripRow,
  ) {
    updateStrip(stripId, (strip) => updateStripRow(strip, rowId, updater))
  }

  function updateRowFromStripSetup(
    stripId: string,
    rowId: string,
    updater: (row: LabelStripRow) => LabelStripRow,
  ) {
    const source = project.strips.find((strip) => strip.id === stripId)
    if (!source) return
    const updatedStrip = updateStripRow(source, rowId, updater)
    const nextStrips = project.strips.map((strip) =>
      strip.id === stripId ? updatedStrip : strip,
    )

    updateStrip(stripId, () => updatedStrip)
    if (selection && !isEditorSelectionValid(nextStrips, selection)) {
      clearSelection()
    }
  }

  function updateSelectedCell(updater: (cell: LabelCell) => LabelCell) {
    if (!resolvedSelection || resolvedSelection.cellIds.length !== 1) return
    const selectedCellId = resolvedSelection.cellIds[0]
    updateRow(resolvedSelection.stripId, resolvedSelection.rowId, (row) => ({
      ...row,
      cells: row.cells.map((cell) =>
        cell.id === selectedCellId ? updater(cell) : cell,
      ),
    }))
  }

  function clearSelection() {
    setSelection(undefined)
    setEditingCellId(undefined)
  }

  function handleNewProject() {
    if (!window.confirm('Start a new project? Unsaved editor changes will be lost.'))
      return
    const nextProject = createProject()
    setProject(nextProject)
    setActiveStripId(nextProject.strips[0]?.id)
    setActiveRowId(nextProject.strips[0]?.rows[0]?.id)
    setSelectedJoinStripIds([])
    clearSelection()
    setNotice({ kind: 'success', message: 'New project created.' })
  }

  function handleSaveProject() {
    const fileName = createProjectFileName(project.name)
    downloadText(
      serializeProject(project),
      fileName,
      PROJECT_FILE_MIME_TYPE,
    )
    setNotice({ kind: 'success', message: `Saved ${fileName}` })
  }

  const loadProjectFileIntoEditor = useCallback(
    async (file: File, confirmReplacement: boolean) => {
      try {
        const imported = await readProjectFileWithCompatibility(file)
        const importedProject = imported.project
        if (
          confirmReplacement &&
          !window.confirm(
            `Open “${importedProject.name || 'Untitled project'}”? Unsaved editor changes will be lost.`,
          )
        ) {
          return
        }

        setProject(importedProject)
        if (printPreferencesSource.current === 'default') {
          printPreferencesSource.current = 'legacy-project'
          setPrintPreferences(
            resolveInitialPrintPreferences(
              undefined,
              imported.legacyPrintSettings,
            ),
          )
        }
        setActiveStripId(importedProject.strips[0]?.id)
        setActiveRowId(importedProject.strips[0]?.rows[0]?.id)
        setSelectedJoinStripIds([])
        setSelection(undefined)
        setEditingCellId(undefined)
        setNotice({ kind: 'success', message: `Opened ${file.name}` })
      } catch (error) {
        setNotice({
          kind: 'error',
          message:
            error instanceof ProjectFileError
              ? error.message
              : 'The project could not be opened.',
        })
      }
    },
    [],
  )

  useEffect(() => {
    registerProjectFileLaunchHandler(window, {
      onFile: (file) => loadProjectFileIntoEditor(file, false),
      onError: (error) =>
        setNotice({
          kind: 'error',
          message:
            error.message || 'The launched project file could not be read.',
        }),
    })
  }, [loadProjectFileIntoEditor])

  async function handleInstallApp() {
    if (!installPrompt) return
    try {
      await installPrompt.prompt()
      await installPrompt.userChoice
    } catch {
      setNotice({
        kind: 'error',
        message: 'The app installation prompt could not be opened.',
      })
    } finally {
      setInstallPrompt(undefined)
    }
  }

  async function handleExportPdf() {
    setBusyAction('pdf')
    setNotice(undefined)
    try {
      const { createLabelsPdf } = await import('./lib/pdf-export')
      const bytes = await createLabelsPdf(
        project,
        printPreferences,
        pageLayout.plan,
      )
      const fileName = createLabelsPdfFileName(project.name)
      downloadBytes(bytes, fileName, 'application/pdf')
      setNotice({ kind: 'success', message: `Created ${fileName} without scaling.` })
    } catch (error) {
      setNotice({
        kind: 'error',
        message:
          error instanceof Error ? error.message : 'PDF export failed.',
      })
    } finally {
      setBusyAction(undefined)
    }
  }

  async function handlePrintPdf() {
    const printWindow = window.open('about:blank', '_blank')
    if (!printWindow) {
      setNotice({
        kind: 'error',
        message: 'Allow pop-ups to open the generated PDF for printing.',
      })
      return
    }

    printWindow.document.title = 'Preparing exact-size label PDF…'
    printWindow.document.body.textContent = 'Preparing exact-size label PDF…'
    setBusyAction('print')
    setNotice(undefined)
    try {
      const { createLabelsPdf } = await import('./lib/pdf-export')
      const bytes = await createLabelsPdf(
        project,
        printPreferences,
        pageLayout.plan,
      )
      openPdfBytesInWindow(bytes, printWindow)
      setNotice({
        kind: 'success',
        message:
          'PDF opened for printing. PRINT AT 100% / ACTUAL SIZE — DO NOT FIT OR SHRINK TO PAGE.',
      })
    } catch (error) {
      printWindow.close()
      setNotice({
        kind: 'error',
        message:
          error instanceof Error ? error.message : 'Print PDF generation failed.',
      })
    } finally {
      setBusyAction(undefined)
    }
  }

  async function handleExportCalibration() {
    setBusyAction('calibration')
    setNotice(undefined)
    try {
      const { createCalibrationPdf } = await import('./lib/pdf-export')
      const printPage = getPrintPageSettings(printPreferences)
      const bytes = await createCalibrationPdf(printPage)
      const fileName = `patch-strip-calibration-${printPage.size.toLowerCase()}-${printPage.orientation}.pdf`
      downloadBytes(bytes, fileName, 'application/pdf')
      setNotice({
        kind: 'success',
        message: `Created ${fileName} with an exact 100 × 100 mm square.`,
      })
    } catch (error) {
      setNotice({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Calibration PDF export failed.',
      })
    } finally {
      setBusyAction(undefined)
    }
  }

  function handleAddStrip(rowCount: 1 | 2 | 3) {
    if (project.strips.length >= MAX_PROJECT_STRIPS) {
      setNotice({
        kind: 'error',
        message: `A project can contain at most ${MAX_PROJECT_STRIPS} strips.`,
      })
      return
    }
    const currentRowCount = project.strips.reduce(
      (count, strip) => count + strip.rows.length,
      0,
    )
    if (currentRowCount + rowCount > MAX_PROJECT_ROWS) {
      setNotice({
        kind: 'error',
        message: `A project can contain at most ${MAX_PROJECT_ROWS} rows.`,
      })
      return
    }
    const strip = createStrip(
      `Strip ${project.strips.length + 1}`,
      432,
      7.5,
      16,
      rowCount,
    )
    updateProject((current) => ({
      ...current,
      strips: [...current.strips, strip],
    }))
    setActiveStripId(strip.id)
    setActiveRowId(strip.rows[0]?.id)
    clearSelection()
  }

  function handleDuplicateStrip(stripId: string) {
    const sourceIndex = project.strips.findIndex((strip) => strip.id === stripId)
    const source = project.strips[sourceIndex]
    if (!source) return
    if (project.strips.length >= MAX_PROJECT_STRIPS) {
      setNotice({
        kind: 'error',
        message: `A project can contain at most ${MAX_PROJECT_STRIPS} strips.`,
      })
      return
    }
    const currentRowCount = project.strips.reduce(
      (count, strip) => count + strip.rows.length,
      0,
    )
    if (currentRowCount + source.rows.length > MAX_PROJECT_ROWS) {
      setNotice({
        kind: 'error',
        message: `A project can contain at most ${MAX_PROJECT_ROWS} rows.`,
      })
      return
    }

    const copy = duplicateStrip(source, `${source.name} copy`)
    updateProject((current) => {
      const strips = [...current.strips]
      strips.splice(sourceIndex + 1, 0, copy)
      return { ...current, strips }
    })
    setActiveStripId(copy.id)
    setActiveRowId(copy.rows[0]?.id)
    clearSelection()
  }

  function handleDeleteStrip(stripId: string) {
    const sourceIndex = project.strips.findIndex((strip) => strip.id === stripId)
    const remaining = removeStrip(project.strips, stripId)
    updateProject((current) => ({ ...current, strips: remaining }))

    if (activeStripId === stripId) {
      const nextStrip = remaining[Math.min(sourceIndex, remaining.length - 1)]
      setActiveStripId(nextStrip?.id)
      setActiveRowId(nextStrip?.rows[0]?.id)
    }
    setSelectedJoinStripIds((current) =>
      current.filter((selectedId) => selectedId !== stripId),
    )
    if (selection?.stripId === stripId) clearSelection()
  }

  function handleToggleJoinSelection(stripId: string) {
    setSelectedJoinStripIds((current) =>
      current.includes(stripId)
        ? current.filter((selectedId) => selectedId !== stripId)
        : [...current, stripId],
    )
  }

  function handleJoinStrips() {
    if (joinError) return
    const firstSelected = project.strips.find((strip) =>
      selectedJoinStripIds.includes(strip.id),
    )
    if (!firstSelected) return
    updateProject((current) => ({
      ...current,
      strips: joinStrips(current.strips, selectedJoinStripIds),
    }))
    setActiveStripId(firstSelected.id)
    setActiveRowId(firstSelected.rows[0]?.id)
    setSelectedJoinStripIds([])
    clearSelection()
    setNotice({
      kind: 'success',
      message: `Joined ${selectedJoinStripIds.length} strips into one ${selectedJoinStripIds.length}-part physical label.`,
    })
  }

  function handleAddRow(stripId: string) {
    const currentRowCount = project.strips.reduce(
      (count, strip) => count + strip.rows.length,
      0,
    )
    if (currentRowCount >= MAX_PROJECT_ROWS) {
      setNotice({
        kind: 'error',
        message: `A project can contain at most ${MAX_PROJECT_ROWS} rows.`,
      })
      return
    }
    const source = project.strips.find((strip) => strip.id === stripId)
    if (!source) return
    const updated = addStripRow(source)
    if (updated === source) return
    updateProject((current) => ({
      ...current,
      strips: current.strips.map((strip) =>
        strip.id === stripId ? updated : strip,
      ),
    }))
    setActiveStripId(stripId)
    setActiveRowId(updated.rows.at(-1)?.id)
    clearSelection()
  }

  function handleSetRowCount(stripId: string, rowCount: 1 | 2 | 3) {
    const source = project.strips.find((strip) => strip.id === stripId)
    if (!source || source.rows.length === rowCount) return

    const addedRows = Math.max(0, rowCount - source.rows.length)
    const currentRowCount = project.strips.reduce(
      (count, strip) => count + strip.rows.length,
      0,
    )
    if (currentRowCount + addedRows > MAX_PROJECT_ROWS) {
      setNotice({
        kind: 'error',
        message: `A project can contain at most ${MAX_PROJECT_ROWS} rows.`,
      })
      return
    }

    const resized = resizeStripRows(source, rowCount)
    updateStrip(stripId, () => resized)
    const nextActiveRow =
      resized.rows.find((row) => row.id === activeRowId) ?? resized.rows.at(-1)
    setActiveStripId(stripId)
    setActiveRowId(nextActiveRow?.id)
    if (
      selection?.stripId === stripId &&
      !resized.rows.some((row) => row.id === selection.rowId)
    ) {
      clearSelection()
    }
  }

  function handleSplitRows(stripId: string) {
    const sourceIndex = project.strips.findIndex((strip) => strip.id === stripId)
    const source = project.strips[sourceIndex]
    if (!source || source.rows.length <= 1) return
    if (project.strips.length - 1 + source.rows.length > MAX_PROJECT_STRIPS) {
      setNotice({
        kind: 'error',
        message: `Splitting would exceed the project limit of ${MAX_PROJECT_STRIPS} strips.`,
      })
      return
    }
    const split = splitStripRows(source)
    updateProject((current) => {
      const strips = [...current.strips]
      strips.splice(sourceIndex, 1, ...split)
      return { ...current, strips }
    })
    setActiveStripId(split[0].id)
    setActiveRowId(split[0].rows[0]?.id)
    setSelectedJoinStripIds((current) =>
      current.filter((selectedId) => selectedId !== stripId),
    )
    clearSelection()
    setNotice({
      kind: 'success',
      message: `Split “${source.name}” into ${split.length} individual strips.`,
    })
  }

  function handleMoveStrip(stripId: string, direction: -1 | 1) {
    updateProject((current) => {
      const fromIndex = current.strips.findIndex((strip) => strip.id === stripId)
      const toIndex = fromIndex + direction
      if (fromIndex < 0 || toIndex < 0 || toIndex >= current.strips.length)
        return current

      const strips = [...current.strips]
      const [moved] = strips.splice(fromIndex, 1)
      strips.splice(toIndex, 0, moved)
      return { ...current, strips }
    })
  }

  function handleMoveCell(
    stripId: string,
    rowId: string,
    cellId: string,
    direction: -1 | 1,
  ) {
    const flattenedCells = project.strips.flatMap((strip) =>
      strip.rows.flatMap((row) =>
        row.cells.map((cell) => ({
          stripId: strip.id,
          rowId: row.id,
          cellId: cell.id,
        })),
      ),
    )
    const currentIndex = flattenedCells.findIndex(
      (item) =>
        item.stripId === stripId &&
        item.rowId === rowId &&
        item.cellId === cellId,
    )
    const next = flattenedCells[currentIndex + direction]
    if (!next) return

    setActiveStripId(next.stripId)
    setActiveRowId(next.rowId)
    setSelection({
      kind: 'cell',
      stripId: next.stripId,
      rowId: next.rowId,
      cellId: next.cellId,
    })
    setEditingCellId(next.cellId)
  }

  function handleSelectCell(
    stripId: string,
    rowId: string,
    cellId: string,
    extendSelection: boolean,
  ) {
    setActiveStripId(stripId)
    setActiveRowId(rowId)

    setSelection((current) =>
      selectEditorCell(current, stripId, rowId, cellId, extendSelection),
    )
    setEditingCellId(extendSelection ? undefined : cellId)
  }

  function handleSelectGroupHeader(
    stripId: string,
    rowId: string,
    headerId: string,
  ) {
    setActiveStripId(stripId)
    setActiveRowId(rowId)
    setSelection({
      kind: 'header',
      stripId,
      rowId,
      headerId,
    })
    setEditingCellId(undefined)
  }

  function handleAddGroupHeader() {
    if (!activeStrip || !activeRow || !resolvedSelection) return
    try {
      const updatedRow = addGroupHeader(
        activeRow,
        resolvedSelection,
        'Header',
      )
      const addedHeader = updatedRow.groupHeaders.find(
        (header) =>
          !activeRow.groupHeaders.some((current) => current.id === header.id),
      )
      updateRow(activeStrip.id, activeRow.id, () => updatedRow)
      if (addedHeader) {
        setSelection({
          kind: 'header',
          stripId: activeStrip.id,
          rowId: activeRow.id,
          headerId: addedHeader.id,
        })
        setEditingCellId(undefined)
      }
      setNotice({
        kind: 'success',
        message: `Added a header above ${selectedRangeLabel}.`,
      })
    } catch (error) {
      setNotice({
        kind: 'error',
        message:
          error instanceof GroupHeaderRangeError
            ? error.message
            : 'The group header could not be added.',
      })
    }
  }

  function handleUpdateSelectedGroupHeader(
    updater: (header: GroupHeader) => GroupHeader,
  ) {
    if (!activeStrip || !activeRow || !selectedGroupHeader) return
    try {
      updateRow(activeStrip.id, activeRow.id, (row) =>
        updateGroupHeader(row, selectedGroupHeader.id, updater),
      )
    } catch (error) {
      setNotice({
        kind: 'error',
        message:
          error instanceof GroupHeaderRangeError
            ? error.message
            : 'The group header could not be updated.',
      })
    }
  }

  function handleRemoveSelectedGroupHeader() {
    if (!activeStrip || !activeRow || !selectedGroupHeader) return
    updateRow(activeStrip.id, activeRow.id, (row) =>
      removeGroupHeader(row, selectedGroupHeader.id),
    )
    setNotice({
      kind: 'success',
      message: `Deleted header “${selectedGroupHeader.text}”. Cell contents were unchanged.`,
    })
    clearSelection()
  }

  function handleApplyCellAppearance(appearance: Partial<CellAppearance>) {
    if (!activeStrip || !activeRow || !resolvedSelection) return
    updateRow(activeStrip.id, activeRow.id, (row) =>
      applyCellAppearanceToRange(row, resolvedSelection, appearance),
    )
  }

  function handleShiftCellLightness(direction: 'lighter' | 'darker') {
    if (!activeStrip || !activeRow || !resolvedSelection) return
    updateRow(activeStrip.id, activeRow.id, (row) =>
      shiftCellRangeLightness(row, resolvedSelection, direction),
    )
  }

  function handleResetSelectedCellStyle() {
    if (!activeStrip || !activeRow || !resolvedSelection) return
    updateRow(activeStrip.id, activeRow.id, (row) =>
      resetCellRangeStyle(row, resolvedSelection),
    )
    setNotice({
      kind: 'success',
      message: `Reset cell style for ${selectedRangeLabel}.`,
    })
  }

  function handleApplyAutoNumberingToSelection() {
    if (
      !activeStripId ||
      !activeStrip ||
      !activeRow ||
      !resolvedSelection ||
      resolvedSelection.stripId !== activeStripId
    ) {
      return
    }

    updateRow(activeStripId, activeRow.id, (row) =>
      applyAutoNumberingToRange(row, resolvedSelection),
    )
    setEditingCellId(undefined)
    setNotice({
      kind: 'success',
      message: `Applied numbering to ${selectedRangeLabel} in “${activeStrip.name}”.`,
    })
  }

  function handleApplyAutoNumberingToAll() {
    if (!activeStripId || !activeStrip || !activeRow) return
    updateRow(activeStripId, activeRow.id, (row) => applyAutoNumbering(row))
    setEditingCellId(undefined)
    setNotice({
      kind: 'success',
      message: `Applied numbering to all ${activeRow.dimensions.cellCount} cells in row ${activeRowIndex + 1} of “${activeStrip.name}”.`,
    })
  }

  function handleClearSelectedCells() {
    if (
      !activeStripId ||
      !activeStrip ||
      !activeRow ||
      !resolvedSelection ||
      resolvedSelection.stripId !== activeStripId
    ) {
      return
    }

    updateRow(activeStripId, activeRow.id, (row) =>
      clearCellRangeContents(row, resolvedSelection),
    )
    setEditingCellId(undefined)
    setNotice({
      kind: 'success',
      message: `Cleared ${selectedRangeLabel} in “${activeStrip.name}”.`,
    })
  }

  return (
    <div className="app-shell">
      {showMobileScreenNotice && (
        <MobileScreenNotice
          onContinue={() => setShowMobileScreenNotice(false)}
        />
      )}
      <Toolbar
        projectName={project.name}
        onProjectNameChange={(name) =>
          updateProject((current) => ({ ...current, name }))
        }
        onNewProject={handleNewProject}
        onOpenProject={(file) => loadProjectFileIntoEditor(file, true)}
        onSaveProject={handleSaveProject}
        onPrintPdf={() => setShowPrintReminder(true)}
        onExportPdf={handleExportPdf}
        onExportCalibration={() => setShowCalibrationReminder(true)}
        busyAction={busyAction}
      />
      {notice && (
        <div
          className={`app-notice ${notice.kind}`}
          role={notice.kind === 'error' ? 'alert' : 'status'}
        >
          <span>{notice.message}</span>
          <button onClick={() => setNotice(undefined)} aria-label="Dismiss message">
            ×
          </button>
        </div>
      )}
      {showPrintReminder && (
        <div
          className="modal-backdrop"
          role="presentation"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) setShowPrintReminder(false)
          }}
        >
          <section
            className="print-reminder"
            role="dialog"
            aria-modal="true"
            aria-labelledby="print-reminder-title"
          >
            <span className="eyebrow">Before printing</span>
            <h2 id="print-reminder-title">{PRINT_SCALING_TITLE}</h2>
            <p>{PRINT_SCALING_BODY}</p>
            <div className="modal-actions">
              <button
                className="button button-quiet"
                onClick={() => setShowPrintReminder(false)}
              >
                Cancel
              </button>
              <button
                className="button button-primary"
                autoFocus
                onClick={() => {
                  setShowPrintReminder(false)
                  void handlePrintPdf()
                }}
              >
                Open PDF for Printing
              </button>
            </div>
          </section>
        </div>
      )}
      {showCalibrationReminder && (
        <div
          className="modal-backdrop"
          role="presentation"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget)
              setShowCalibrationReminder(false)
          }}
        >
          <section
            className="print-reminder"
            role="dialog"
            aria-modal="true"
            aria-labelledby="calibration-reminder-title"
          >
            <span className="eyebrow">Before using calibration</span>
            <h2 id="calibration-reminder-title">{PRINT_SCALING_TITLE}</h2>
            <p>{PRINT_SCALING_BODY}</p>
            <div className="modal-actions">
              <button
                className="button button-quiet"
                onClick={() => setShowCalibrationReminder(false)}
              >
                Cancel
              </button>
              <button
                className="button button-primary"
                autoFocus
                onClick={() => {
                  setShowCalibrationReminder(false)
                  void handleExportCalibration()
                }}
              >
                Download Calibration PDF
              </button>
            </div>
          </section>
        </div>
      )}
      {pendingDeleteStrip && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="print-reminder delete-strip-confirmation"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-strip-title"
          >
            <span className="eyebrow">Delete strip</span>
            <h2 id="delete-strip-title">
              Delete “{pendingDeleteStrip.name || 'Unnamed strip'}” and all of
              its labels?
            </h2>
            <p>This removes the complete strip. Group header controls never delete a strip.</p>
            <div className="modal-actions">
              <button
                className="button button-quiet"
                autoFocus
                onClick={() => setPendingDeleteStripId(undefined)}
              >
                Cancel
              </button>
              <button
                className="button button-danger"
                onClick={() => {
                  handleDeleteStrip(pendingDeleteStrip.id)
                  setPendingDeleteStripId(undefined)
                }}
              >
                Delete Strip
              </button>
            </div>
          </section>
        </div>
      )}
      <div className="app-body">
        <Sidebar
          selectionKind={selection?.kind}
          activeRow={activeRow}
          selectedCell={selectedCell}
          selectedCellCount={resolvedSelection?.cellIds.length ?? 0}
          selectedRangeLabel={selectedRangeLabel}
          selectedRange={resolvedSelection}
          selectedGroupHeader={selectedGroupHeader}
          onUpdateRow={(updater) => {
            if (activeStripId && activeRowId) {
              updateRow(activeStripId, activeRowId, updater)
            }
          }}
          onUpdateCell={updateSelectedCell}
          onAddGroupHeader={handleAddGroupHeader}
          onUpdateSelectedGroupHeader={handleUpdateSelectedGroupHeader}
          onRemoveSelectedGroupHeader={handleRemoveSelectedGroupHeader}
          onApplyCellAppearance={handleApplyCellAppearance}
          onShiftCellLightness={handleShiftCellLightness}
          onResetSelectedCellStyle={handleResetSelectedCellStyle}
          onApplyAutoNumberingToSelection={
            handleApplyAutoNumberingToSelection
          }
          onApplyAutoNumberingToAll={handleApplyAutoNumberingToAll}
          onClearSelectedCells={handleClearSelectedCells}
        />
        <Workspace
          project={project}
          strips={project.strips}
          printPreferences={printPreferences}
          pageLayoutPlan={pageLayout.plan}
          pageLayoutError={pageLayout.error}
          activeStripId={activeStripId}
          activeRowId={activeRowId}
          selectedJoinStripIds={selectedJoinStripIds}
          joinError={joinError}
          selectedCellIds={resolvedSelection?.cellIds ?? []}
          selectedHeaderId={
            selection?.kind === 'header' ? selection.headerId : undefined
          }
          selectedCellCount={resolvedSelection?.cellIds.length ?? 0}
          editingCellId={editingCellId}
          selectionLabel={selectedRangeLabel}
          previewScale={previewScale}
          onPreviewScaleChange={setPreviewScale}
          onPrintPreferencesChange={handlePrintPreferencesChange}
          onActivateStrip={(stripId) => {
            if (stripId !== activeStripId) {
              setActiveStripId(stripId)
              setActiveRowId(
                project.strips.find((strip) => strip.id === stripId)?.rows[0]
                  ?.id,
              )
              clearSelection()
            }
          }}
          onActivateRow={(stripId, rowId) => {
            const changedRow = stripId !== activeStripId || rowId !== activeRowId
            setActiveStripId(stripId)
            setActiveRowId(rowId)
            if (changedRow) clearSelection()
          }}
          onUpdateRow={updateRowFromStripSetup}
          onSetRowCount={handleSetRowCount}
          onRenameStrip={(stripId, name) =>
            updateStrip(stripId, (strip) => ({ ...strip, name }))
          }
          onSelectCell={handleSelectCell}
          onSelectGroupHeader={handleSelectGroupHeader}
          onClearSelection={clearSelection}
          onChangeCellText={(stripId, rowId, cellId, line1, line2) =>
            updateRow(stripId, rowId, (row) => ({
              ...row,
              cells: row.cells.map((cell) =>
                cell.id === cellId ? { ...cell, line1, line2 } : cell,
              ),
            }))
          }
          onMoveCell={handleMoveCell}
          onAddStrip={handleAddStrip}
          onToggleJoinSelection={handleToggleJoinSelection}
          onJoinStrips={handleJoinStrips}
          onAddRow={handleAddRow}
          onSplitRows={handleSplitRows}
          onDuplicateStrip={handleDuplicateStrip}
          onDeleteStrip={setPendingDeleteStripId}
          onMoveStrip={handleMoveStrip}
        />
      </div>
      <AppFooter
        feedbackHref={feedbackHref}
        onOpenHelp={() => setShowAbout(true)}
      />
      {showAbout && (
        <AboutDialog
          installPromptAvailable={installPrompt !== undefined}
          onInstallApp={handleInstallApp}
          onClose={() => setShowAbout(false)}
        />
      )}
    </div>
  )
}
