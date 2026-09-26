import { applyAutoNumberingToRange } from './auto-numbering'
import { addGroupHeader } from './group-headers'
import { createId, createStrip } from '../model/defaults'
import type { LabelProject, LabelStrip, LabelStripRow } from '../model/project'

type CellText = readonly [line1: string, line2?: string]

function withCellText(
  row: LabelStripRow,
  cells: readonly CellText[],
): LabelStripRow {
  return {
    ...row,
    cells: row.cells.map((cell, index) => {
      const text = cells[index]
      return text ? { ...cell, line1: text[0], line2: text[1] ?? '' } : cell
    }),
  }
}

function withNumbering(
  row: LabelStripRow,
  startIndex: number,
  endIndex: number,
  line1Template: string,
  line2Template = '',
  startNumber = 1,
  digits = 1,
): LabelStripRow {
  return applyAutoNumberingToRange(
    row,
    { startIndex, endIndex },
    {
      line1Template,
      line2Template,
      startNumber,
      digits,
      cellCount: row.dimensions.cellCount,
    },
  )
}

function withHeaders(
  row: LabelStripRow,
  headers: readonly (readonly [startIndex: number, endIndex: number, text: string])[],
): LabelStripRow {
  return headers.reduce(
    (current, [startIndex, endIndex, text]) =>
      addGroupHeader(current, { startIndex, endIndex }, text),
    row,
  )
}

function singleRowStrip(
  name: string,
  cellCount: number,
  build: (row: LabelStripRow) => LabelStripRow,
  widthMm = 432,
): LabelStrip {
  const strip = createStrip(name, widthMm, 7.5, cellCount)
  return { ...strip, rows: strip.rows.map(build) }
}

function createRouterInputsStrip(): LabelStrip {
  return singleRowStrip('Video router inputs', 16, (row) => {
    const numbered = withNumbering(row, 0, 7, 'CAM {n}', 'SDI 12G')
    const named = withCellText(numbered, [
      ...numbered.cells.slice(0, 8).map((cell) => [cell.line1, cell.line2] as const),
      ['EVS 1', 'REPLAY'],
      ['EVS 2', 'REPLAY'],
      ['EVS 3', 'REPLAY'],
      ['EVS 4', 'REPLAY'],
      ['GFX', 'FILL'],
      ['GFX', 'KEY'],
      ['PLAYOUT', 'A'],
      ['PLAYOUT', 'B'],
    ])
    return withHeaders(named, [
      [0, 7, 'CAMERAS'],
      [8, 11, 'REPLAY'],
      [12, 15, 'GRAPHICS / PLAYOUT'],
    ])
  })
}

function createMultiviewerStrip(): LabelStrip {
  const strip = createStrip('Multiviewer and monitors', 432, 7.5, 8, 2)
  const [topRow, bottomRow] = strip.rows
  return {
    ...strip,
    rows: [
      withNumbering(topRow, 0, 7, 'MV {n}', 'IN'),
      withCellText(bottomRow, [
        ['PGM', 'MON'],
        ['PVW', 'MON'],
        ['CLEAN', 'FEED'],
        ['AUX 1'],
        ['AUX 2'],
        ['VISION', 'DESK'],
        ['PROD', 'DESK'],
        ['SPARE'],
      ]),
    ],
  }
}

function createStageboxStrip(): LabelStrip {
  return singleRowStrip('Audio stagebox', 16, (row) =>
    withHeaders(
      withCellText(row, [
        ['PRES 1', 'CH 1'],
        ['PRES 2', 'CH 2'],
        ['GUEST 1', 'CH 3'],
        ['GUEST 2', 'CH 4'],
        ['GUEST 3', 'CH 5'],
        ['GUEST 4', 'CH 6'],
        ['AMB L', 'CH 7'],
        ['AMB R', 'CH 8'],
        ['PGM L', 'OUT 1'],
        ['PGM R', 'OUT 2'],
        ['IFB 1', 'OUT 3'],
        ['IFB 2', 'OUT 4'],
        ['TB', 'OUT 5'],
        ['CUE', 'OUT 6'],
        ['SPARE', 'OUT 7'],
        ['SPARE', 'OUT 8'],
      ]),
      [
        [0, 7, 'MIC INPUTS'],
        [8, 15, 'OUTPUTS'],
      ],
    ),
  )
}

function createNetworkPanelStrip(): LabelStrip {
  return singleRowStrip('Network patch panel', 24, (row) =>
    withNumbering(row, 0, 23, 'PORT', '{n}', 1, 2),
  )
}

function createTieLinesStrip(): LabelStrip {
  return singleRowStrip('Tie lines to studio 2', 12, (row) =>
    withNumbering(row, 0, 11, 'TIE {n}', 'ST2', 1, 2),
  )
}

function createIntercomStrip(): LabelStrip {
  return singleRowStrip(
    'Intercom panel',
    8,
    (row) =>
      withCellText(row, [
        ['DIR'],
        ['CAM 1-4'],
        ['CAM 5-8'],
        ['SOUND'],
        ['VISION'],
        ['FLOOR'],
        ['EVS'],
        ['GFX'],
      ]),
    216,
  )
}

/** A realistic, fully editable sample project that shows the main features. */
export function createExampleProject(): LabelProject {
  const now = new Date().toISOString()

  return {
    schemaVersion: 5,
    id: createId('project'),
    name: 'Example OB Truck Rack',
    createdAt: now,
    updatedAt: now,
    page: {
      size: 'A3',
      orientation: 'landscape',
    },
    strips: [
      createRouterInputsStrip(),
      createMultiviewerStrip(),
      createStageboxStrip(),
      createNetworkPanelStrip(),
      createTieLinesStrip(),
      createIntercomStrip(),
    ],
  }
}
