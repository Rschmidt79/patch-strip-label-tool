import { readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const webdriverUrl = process.argv[2] ?? 'http://127.0.0.1:4444'
const appUrl = process.argv[3] ?? 'http://127.0.0.1:4173'
const downloadDirectory = path.resolve(process.argv[4] ?? '/tmp')
const elementKey = 'element-6066-11e4-a52e-4f735466cecf'

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function request(endpoint, method = 'GET', body) {
  const response = await fetch(`${webdriverUrl}${endpoint}`, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const result = await response.json()
  if (!response.ok || result.value?.error) {
    throw new Error(
      `WebDriver ${method} ${endpoint} failed: ${JSON.stringify(result.value)}`,
    )
  }
  return result.value
}

async function waitFor(check, message, timeoutMilliseconds = 10_000) {
  const deadline = Date.now() + timeoutMilliseconds
  let lastValue
  while (Date.now() < deadline) {
    lastValue = await check()
    if (lastValue) return lastValue
    await delay(100)
  }
  throw new Error(`${message}. Last value: ${JSON.stringify(lastValue)}`)
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

let sessionId

async function execute(script, args = []) {
  return request(`/session/${sessionId}/execute/sync`, 'POST', { script, args })
}

async function clickButton(text) {
  const clicked = await execute(
    `const button = [...document.querySelectorAll('button')].find((item) => item.textContent.trim() === arguments[0]); if (!button) return false; button.click(); return true;`,
    [text],
  )
  assert(clicked, `Button not found: ${text}`)
  await delay(120)
}

async function setInputByLabel(label, value) {
  const changed = await execute(
    `const field = [...document.querySelectorAll('.field')].find((item) => item.querySelector(':scope > span')?.textContent.trim() === arguments[0]); const input = field?.querySelector('input'); if (!input) return false; const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input, arguments[1]); input.dispatchEvent(new Event('input', { bubbles: true })); return true;`,
    [label, String(value)],
  )
  assert(changed, `Input not found: ${label}`)
  await delay(100)
}

async function setEditorZoom(value) {
  const changed = await execute(
    `const select = document.querySelector('.zoom-control select'); if (!select) return false; select.value = arguments[0]; select.dispatchEvent(new Event('change', { bubbles: true })); return true;`,
    [String(value)],
  )
  assert(changed, `Editor zoom ${value} was not available`)
  await delay(120)
}

async function setActiveCellText(value) {
  const changed = await execute(
    `const input = document.querySelector('.strip-card:first-of-type .svg-cell-input'); if (!input) return false; const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; setter.call(input, arguments[0]); input.dispatchEvent(new Event('input', { bubbles: true })); return true;`,
    [value],
  )
  assert(changed, 'Individual cell editor did not open')
  await delay(120)
}

async function clickStripButton(stripIndex, text) {
  const clicked = await execute(
    `const card = document.querySelectorAll('.strip-card')[arguments[0]]; const button = [...(card?.querySelectorAll('button') ?? [])].find((item) => item.textContent.trim() === arguments[1]); if (!button) return false; button.click(); return true;`,
    [stripIndex, text],
  )
  assert(clicked, `Strip ${stripIndex + 1} button not found: ${text}`)
  await delay(120)
}

async function selectPreset(presetId) {
  const changed = await execute(
    `const select = document.querySelectorAll('.sidebar-panel')[1]?.querySelector('select'); if (!select) return false; select.value = arguments[0]; select.dispatchEvent(new Event('change', { bubbles: true })); return true;`,
    [presetId],
  )
  assert(changed, `Preset selector not found for ${presetId}`)
  await delay(120)
}

async function selectCell(index, extendSelection = false, stripIndex = 0) {
  const selected = await execute(
    `const card = document.querySelectorAll('.strip-card')[arguments[2]]; const cell = card?.querySelectorAll('.svg-cell')[arguments[0]]; if (!cell) return false; cell.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, shiftKey: arguments[1] })); return true;`,
    [index, extendSelection, stripIndex],
  )
  assert(selected, `Cell ${index + 1} was not found`)
  await delay(120)
}

async function selectRange(startIndex, endIndex, stripIndex = 0) {
  await selectCell(startIndex, false, stripIndex)
  await selectCell(endIndex, true, stripIndex)
}

async function addHeader(text) {
  const changed = await execute(
    `const input = document.querySelector('input[placeholder="MICROPHONES"]'); if (!input) return false; const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input, arguments[0]); input.dispatchEvent(new Event('input', { bubbles: true })); return true;`,
    [text],
  )
  assert(changed, 'Group header input was not found')
  await delay(100)
  await clickButton('Add group header')
}

async function waitForDownload(extension, previousFiles = []) {
  const previous = new Set(previousFiles)
  return waitFor(async () => {
    const files = await readdir(downloadDirectory)
    const candidate = files.find(
      (file) => file.endsWith(extension) && !previous.has(file),
    )
    if (!candidate) return false
    const filePath = path.join(downloadDirectory, candidate)
    const details = await stat(filePath)
    return details.size > 0 ? filePath : false
  }, `Timed out waiting for ${extension} download`, 20_000)
}

async function findElement(selector) {
  const value = await request(`/session/${sessionId}/element`, 'POST', {
    using: 'css selector',
    value: selector,
  })
  return value[elementKey]
}

try {
  const session = await request('/session', 'POST', {
    capabilities: {
      alwaysMatch: {
        browserName: 'firefox',
        'moz:firefoxOptions': {
          args: ['-headless'],
          prefs: {
            'browser.download.folderList': 2,
            'browser.download.dir': downloadDirectory,
            'browser.download.useDownloadDir': true,
            'browser.helperApps.neverAsk.saveToDisk':
              'application/pdf,application/x-racklabel+json,application/json,text/json,application/octet-stream',
            'pdfjs.disabled': true,
          },
        },
      },
    },
  })
  sessionId = session.sessionId
  await request(`/session/${sessionId}/window/rect`, 'POST', {
    width: 1600,
    height: 1100,
  })
  await request(`/session/${sessionId}/url`, 'POST', { url: appUrl })
  await waitFor(
    () => execute(`return document.readyState === 'complete' && Boolean(document.querySelector('.strip-card'));`),
    'Application did not load',
  )

  const betaUi = await execute(
    `return { title: document.title, description: document.querySelector('meta[name="description"]')?.content, beta: document.querySelector('.beta-badge')?.textContent.trim(), version: document.querySelector('.app-footer > span')?.textContent.replace(/\\s+/g, ' ').trim() };`,
  )
  assert(betaUi.title === 'Rack Label Maker', 'Production HTML title is incorrect')
  assert(betaUi.description?.includes('true-size rack'), 'Production meta description is missing')
  assert(betaUi.beta === 'Beta', 'Beta indicator is missing')
  assert(/^v0\.6\.0-beta · Build \d{4}-\d{2}-\d{2}$/.test(betaUi.version), 'Version/build footer is incorrect')

  const emptyDefaults = await execute(
    `return { cells: [...document.querySelectorAll('.strip-card:first-of-type .svg-cell')].map((cell) => cell.getAttribute('aria-label')), line1Template: document.querySelector('input[aria-label="Line 1 template"]')?.value, line2Template: document.querySelector('input[aria-label="Line 2 template"]')?.value };`,
  )
  assert(emptyDefaults.cells.every((label) => /^Cell \d+:\s*$/.test(label)), 'New strip cells were not empty')
  assert(emptyDefaults.line1Template === 'Router Out' && emptyDefaults.line2Template === '{n}', 'Neutral Auto Number templates were not retained unapplied')

  const presetCounts = [4, 7, 8, 12, 16, 20, 24]
  for (const count of presetCounts) {
    await selectPreset(`rack-${count}`)
    const geometry = await execute(
      `const card = document.querySelector('.strip-card:first-of-type'); const svg = card?.querySelector('.strip-svg'); const hit = card?.querySelector('.svg-cell .cell-hit-area'); const indices = [...(card?.querySelectorAll('.cell-index-row span') ?? [])].map((item) => Number(item.textContent)); return { widthMm: Number(svg?.dataset.widthMm), cellCount: card?.querySelectorAll('.svg-cell').length, cellWidthMm: Number(hit?.getAttribute('width')), indices, previewIndices: document.querySelectorAll('.page-layout-preview .cell-index-row').length };`,
    )
    assert(geometry.widthMm === 432, `rack-${count} width was not 432 mm`)
    assert(geometry.cellCount === count, `rack-${count} rendered ${geometry.cellCount} cells`)
    assert(
      Math.abs(geometry.cellWidthMm - 432 / count) < 1e-10,
      `rack-${count} cell width was rounded`,
    )
    assert(geometry.indices.length === count, `rack-${count} did not render ${count} editor indices`)
    assert(geometry.indices[0] === 1 && geometry.indices.at(-1) === count, `rack-${count} indices did not run from 1 to ${count}`)
    assert(geometry.previewIndices === 0, `rack-${count} indices leaked into page preview`)
  }

  await selectPreset('rack-12')
  await selectRange(0, 5)
  const rangeVisual = await execute(
    `const card = document.querySelector('.strip-card:first-of-type'); const selectedIndices = [...(card?.querySelectorAll('.cell-index-row span.selected') ?? [])].map((item) => Number(item.textContent)); const selectionRects = card?.querySelectorAll('.svg-cell .cell-selection').length; const footerItems = [...(card?.querySelectorAll('.strip-card-footer > span') ?? [])]; return { selectedIndices, selectionRects, footer: footerItems.at(-1)?.textContent.replace(/\\s+/g, ' ').trim(), sidebar: [...document.querySelectorAll('.panel-title > span')].map((item) => item.textContent.replace(/\\s+/g, ' ').trim()).filter((text) => text.startsWith('Selected:')) };`,
  )
  assert(JSON.stringify(rangeVisual.selectedIndices) === JSON.stringify([1, 2, 3, 4, 5, 6]), 'Selected index highlighting did not match cells 1–6')
  assert(rangeVisual.selectionRects === 6, 'Selected cell outlines were not visible')
  assert(rangeVisual.footer?.startsWith('Selected: Cells 1–6'), `Selected range status was not visible in the editor: ${JSON.stringify(rangeVisual)}`)
  assert(rangeVisual.sidebar.includes('Selected: Cells 1–6'), 'Selected range status was not visible in the sidebar')
  await addHeader('MICROPHONES')

  const headerGeometry = await execute(
    `const card = document.querySelector('.strip-card:first-of-type'); const svg = card?.querySelector('.strip-svg'); const header = card?.querySelector('.group-header-hit-area'); const cells = card?.querySelectorAll('.svg-cell .cell-hit-area'); const artworkGroups = [...(card?.querySelector('.strip-artwork')?.children ?? [])].filter((item) => item.tagName.toLowerCase() === 'g'); return { width: svg?.getAttribute('width'), height: svg?.getAttribute('height'), widthMm: Number(svg?.dataset.widthMm), heightMm: Number(svg?.dataset.heightMm), headerHeightMm: Number(header?.getAttribute('height')), coveredYmm: Number(cells?.[0]?.getAttribute('y')), coveredHeightMm: Number(cells?.[0]?.getAttribute('height')), uncoveredYmm: Number(cells?.[6]?.getAttribute('y')), uncoveredHeightMm: Number(cells?.[6]?.getAttribute('height')), headerText: card?.querySelector('.group-header-copy')?.textContent, coveredCellTextLines: artworkGroups[0]?.querySelectorAll('.cell-copy text').length };`,
  )
  assert(headerGeometry.width === '432mm', 'SVG width was not explicitly 432 mm')
  assert(headerGeometry.height === '7.5mm', 'SVG height was not explicitly 7.5 mm')
  assert(headerGeometry.widthMm === 432 && headerGeometry.heightMm === 7.5, 'Header changed the physical SVG dimensions')
  assert(headerGeometry.headerHeightMm === 2, 'Header band was not 2 mm high')
  assert(headerGeometry.coveredYmm === 2 && headerGeometry.coveredHeightMm === 5.5, 'Covered cells did not use the internal 5.5 mm content area')
  assert(headerGeometry.uncoveredYmm === 0 && headerGeometry.uncoveredHeightMm === 7.5, 'Cells outside the header did not retain full height')
  assert(headerGeometry.headerText === 'MICROPHONES', 'Group header was not rendered')
  assert(headerGeometry.coveredCellTextLines === 0, 'The new strip was unexpectedly auto-populated')

  const selectedHeader = await execute(
    `const header = document.querySelector('.strip-card:first-of-type .svg-group-header'); if (!header) return false; header.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return true;`,
  )
  assert(selectedHeader, 'Existing header could not be selected for editing')
  await delay(120)
  await clickButton('Delete header')
  const afterHeaderDelete = await execute(
    `return { cards: document.querySelectorAll('.strip-card').length, headers: document.querySelectorAll('.strip-card:first-of-type .group-header-copy').length, heightMm: Number(document.querySelector('.strip-card:first-of-type .strip-svg')?.dataset.heightMm) };`,
  )
  assert(afterHeaderDelete.cards === 1, 'Deleting a header deleted the strip')
  assert(afterHeaderDelete.headers === 0, 'Delete header did not remove the header')
  assert(afterHeaderDelete.heightMm === 7.5, 'Deleting a header changed strip height')

  await selectRange(0, 5)
  await addHeader('MICROPHONES')

  await selectRange(0, 5)
  await setInputByLabel('Line 1 template', 'Router Out')
  await setInputByLabel('Line 2 template', '')
  const preparedNumberInsertion = await execute(
    `const input = document.querySelector('input[aria-label="Line 2 template"]'); if (!input) return false; input.focus(); input.setSelectionRange(0, 0); const button = document.querySelector('button[aria-label="Insert sequence number into Line 2 template"]'); if (!button) return false; button.click(); return true;`,
  )
  assert(preparedNumberInsertion, 'The # Auto Number control was not available')
  await delay(120)
  const insertedTemplate = await execute(
    `return document.querySelector('input[aria-label="Line 2 template"]')?.value;`,
  )
  assert(insertedTemplate === '{n}', '# did not insert {n} at the cursor')
  await setInputByLabel('Start number', 1)
  await setInputByLabel('Digit padding', 2)
  await clickButton('Apply to cells 1–6')
  await selectRange(6, 11)
  await setInputByLabel('Line 1 template', 'LINE AUDIO')
  await setInputByLabel('Line 2 template', '{n}')
  await clickButton('Apply to cells 7–12')

  await selectRange(0, 5)
  const yellowApplied = await execute(
    `const button = document.querySelector('.color-swatches button[title="Yellow"]'); if (!button) return false; button.click(); return true;`,
  )
  assert(yellowApplied, 'Yellow range preset was not available')
  await delay(120)
  await selectRange(6, 11)
  const blueApplied = await execute(
    `const button = document.querySelector('.color-swatches button[title="Blue"]'); if (!button) return false; button.click(); return true;`,
  )
  assert(blueApplied, 'Blue range preset was not available')
  await delay(120)

  for (const zoom of [1, 1.35, 1.5]) {
    await setEditorZoom(zoom)
    const indexAlignment = await execute(
      `const card = document.querySelector('.strip-card:first-of-type'); const indices = [...(card?.querySelectorAll('.cell-index-row span') ?? [])]; const hits = [...(card?.querySelectorAll('.svg-cell .cell-hit-area') ?? [])]; const deltas = indices.map((index, cellIndex) => { const indexBounds = index.getBoundingClientRect(); const hitBounds = hits[cellIndex].getBoundingClientRect(); return { center: Math.abs((indexBounds.left + indexBounds.right) / 2 - (hitBounds.left + hitBounds.right) / 2), width: Math.abs(indexBounds.width - hitBounds.width) }; }); return { count: indices.length, maximumCenterDelta: Math.max(...deltas.map((item) => item.center)), maximumWidthDelta: Math.max(...deltas.map((item) => item.width)), rowWidth: card?.querySelector('.cell-index-row')?.getBoundingClientRect().width, svgWidth: card?.querySelector('.strip-svg')?.getBoundingClientRect().width, fontSize: getComputedStyle(indices[0]).fontSize };`,
    )
    assert(indexAlignment.count === 12, `Index count changed at ${zoom * 100}%`)
    assert(indexAlignment.maximumCenterDelta < 0.6 && indexAlignment.maximumWidthDelta < 0.6, `Cell indices were misaligned at ${zoom * 100}%`)
    assert(Math.abs(indexAlignment.rowWidth - indexAlignment.svgWidth) < 0.6, `Index row width disagreed with SVG at ${zoom * 100}%`)
    assert(indexAlignment.fontSize === '8px', `Cell indices were unreadable at ${zoom * 100}%`)
    await selectCell(6)
    await setActiveCellText(`One line ${Math.round(zoom * 100)}%`)
    const oneLineState = await execute(
      `const card = document.querySelector('.strip-card:first-of-type'); const groups = [...(card?.querySelector('.strip-artwork')?.children ?? [])].filter((item) => item.tagName.toLowerCase() === 'g'); const input = card?.querySelector('.svg-cell-input'); return { hidden: !groups[6]?.querySelector('.cell-copy'), lines: input?.value.split('\\n').length, zoom: document.querySelector('.zoom-control select')?.value };`,
    )
    assert(oneLineState.hidden, `Underlying one-line SVG text remained visible at ${zoom * 100}%`)
    assert(oneLineState.lines === 1 && Number(oneLineState.zoom) === zoom, `One-line editing failed at ${zoom * 100}%`)

    await selectCell(0)
    await setActiveCellText('Wireless\nMic 01')
    const twoLineState = await execute(
      `const card = document.querySelector('.strip-card:first-of-type'); const groups = [...(card?.querySelector('.strip-artwork')?.children ?? [])].filter((item) => item.tagName.toLowerCase() === 'g'); const input = card?.querySelector('.svg-cell-input'); return { hidden: !groups[0]?.querySelector('.cell-copy'), lines: input?.value.split('\\n').length, contentHeight: Number(card?.querySelectorAll('.svg-cell .cell-hit-area')[0]?.getAttribute('height')) };`,
    )
    assert(twoLineState.hidden, `Underlying two-line SVG text remained visible at ${zoom * 100}%`)
    assert(twoLineState.lines === 2 && twoLineState.contentHeight === 5.5, `Two-line covered-cell editing failed at ${zoom * 100}%`)
  }

  await clickStripButton(0, 'Duplicate')
  const duplicateState = await execute(
    `return { cards: document.querySelectorAll('.strip-card').length, headers: document.querySelectorAll('.strip-card .group-header-copy').length, yellow: document.querySelectorAll('.strip-card .strip-artwork rect[fill="#f4d35e"]').length, blue: document.querySelectorAll('.strip-card .strip-artwork rect[fill="#3973b9"]').length };`,
  )
  assert(duplicateState.cards === 2, 'Strip duplication failed')
  assert(duplicateState.headers === 2, 'Group headers did not survive duplication')
  assert(duplicateState.yellow === 12 && duplicateState.blue === 12, 'Cell colors did not survive duplication')

  await clickStripButton(1, 'Delete strip')
  const deleteDialog = await execute(
    `const dialog = document.querySelector('.delete-strip-confirmation'); return { question: dialog?.querySelector('h2')?.textContent.replace(/\\s+/g, ' ').trim(), hasDelete: [...(dialog?.querySelectorAll('button') ?? [])].some((button) => button.textContent.trim() === 'Delete Strip') };`,
  )
  assert(deleteDialog.question?.startsWith('Delete “') && deleteDialog.question.endsWith('and all of its labels?'), 'Delete Strip confirmation did not identify the strip')
  assert(deleteDialog.hasDelete, 'Delete Strip confirmation action was missing')
  await clickButton('Cancel')
  assert(await execute(`return document.querySelectorAll('.strip-card').length === 2;`), 'Cancel removed a strip')
  await clickStripButton(1, 'Delete strip')
  await clickButton('Delete Strip')
  assert(await execute(`return document.querySelectorAll('.strip-card').length === 1;`), 'Delete Strip did not remove the complete strip')
  await clickStripButton(0, 'Duplicate')

  const packedPreview = await execute(
    `const cards = document.querySelectorAll('.page-layout-preview .page-preview-card'); const preview = cards[0]?.querySelector('svg'); return { pages: cards.length, aria: preview?.getAttribute('aria-label'), headers: document.querySelectorAll('.page-layout-preview .group-header-copy').length, stripGroups: preview?.querySelectorAll(':scope > g:not(.page-preview-support)').length, supportDecorations: preview?.querySelectorAll(':scope > .page-preview-support').length, editorIndices: document.querySelectorAll('.page-layout-preview .cell-index-row').length, editorIndexMarkers: document.querySelectorAll('.page-layout-preview [data-editor-only="cell-indices"]').length };`,
  )
  assert(packedPreview.pages === 1, 'Two 432 mm strips did not share one A3 page')
  assert(packedPreview.aria === 'Page 1 layout with 2 strips', 'Page preview did not use the shared two-strip placement plan')
  assert(packedPreview.headers === 2 && packedPreview.stripGroups === 2, 'Page preview did not render both strips and headers')
  assert(packedPreview.supportDecorations === 1, 'Enabled support QR was not shown in the reserved preview area')
  assert(packedPreview.editorIndices === 0 && packedPreview.editorIndexMarkers === 0, 'Editor indices leaked into page preview')

  const beforeSave = await readdir(downloadDirectory)
  await clickButton('Save')
  const projectFile = await waitForDownload('.racklabel', beforeSave)
  const savedProject = JSON.parse(await readFile(projectFile, 'utf8'))
  assert(savedProject.schemaVersion === 3, 'Saved project did not use schema version 3')
  assert(savedProject.strips.length === 2, 'Saved project did not contain both strips')
  assert(savedProject.strips.every((strip) => strip.dimensions.heightMm === 7.5 && strip.dimensions.groupHeaderBandHeightMm === 2), 'Saved project did not preserve fixed-height internal headers')
  const savedProjectText = await readFile(projectFile, 'utf8')
  assert(!savedProjectText.includes('cell-index-row') && !savedProjectText.includes('data-cell-index'), 'Editor indices leaked into project JSON')
  await execute(`window.confirm = () => true;`)
  const fileInputId = await findElement('input[type="file"]')
  await request(`/session/${sessionId}/element/${fileInputId}/value`, 'POST', {
    text: projectFile,
  })
  await waitFor(
    () => execute(`return document.querySelector('.app-notice')?.textContent.includes('Opened') ?? false;`),
    'Saved project did not reopen',
  )

  const restoredState = await execute(
    `return { cards: document.querySelectorAll('.strip-card').length, headers: [...document.querySelectorAll('.strip-card:first-of-type .group-header-copy')].map((item) => item.textContent), firstCell: document.querySelector('.strip-card:first-of-type .svg-cell')?.getAttribute('aria-label'), previewHeaders: [...document.querySelectorAll('.page-layout-preview .group-header-copy')].map((item) => item.textContent), previewYellow: document.querySelectorAll('.page-layout-preview rect[fill="#f4d35e"]').length, previewBlue: document.querySelectorAll('.page-layout-preview rect[fill="#3973b9"]').length, previewPages: document.querySelectorAll('.page-layout-preview .page-preview-card').length, firstHeightMm: Number(document.querySelector('.strip-card:first-of-type .strip-svg')?.dataset.heightMm), indices: [...document.querySelectorAll('.strip-card:first-of-type .cell-index-row span')].map((item) => Number(item.textContent)) };`,
  )
  assert(restoredState.cards === 2, 'Reload did not restore both strips')
  assert(restoredState.headers.includes('MICROPHONES'), 'Reload did not restore the header')
  assert(restoredState.firstCell.includes('Wireless Mic 01'), 'Individual cell edit was not restored')
  assert(restoredState.previewHeaders.length === 2, 'Page preview did not render all headers')
  assert(restoredState.previewYellow === 12 && restoredState.previewBlue === 12, 'Page preview colors disagree with editor')
  assert(restoredState.previewPages === 1 && restoredState.firstHeightMm === 7.5, 'Reload changed the fixed-height one-page layout')
  assert(restoredState.indices.length === 12 && restoredState.indices[0] === 1 && restoredState.indices.at(-1) === 12, 'Editor indices did not recover from project cell count')

  const attackStrings = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '"><svg onload=alert(1)>',
    'javascript:alert(1)',
    '</text><script>alert(1)</script>',
    '${alert(1)}',
    "{{constructor.constructor('alert(1)')()}}",
  ]
  await execute(`window.__racklabelsAlertCount = 0; window.alert = () => { window.__racklabelsAlertCount += 1; };`)
  for (let attackIndex = 0; attackIndex < attackStrings.length; attackIndex += 1) {
    const attack = attackStrings[attackIndex]
    const secondLineAttack = attackStrings[(attackIndex + 1) % attackStrings.length]
    const projectChanged = await execute(
      `const input = document.querySelector('.project-name-field input'); if (!input) return false; const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input, arguments[0]); input.dispatchEvent(new Event('input', { bubbles: true })); return true;`,
      [attack],
    )
    assert(projectChanged, 'Project-name hostile-input field was unavailable')
    const stripChanged = await execute(
      `const input = document.querySelector('.strip-card:first-of-type .strip-name-input'); if (!input) return false; const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input, arguments[0]); input.dispatchEvent(new Event('input', { bubbles: true })); return true;`,
      [attack],
    )
    assert(stripChanged, 'Strip-name hostile-input field was unavailable')
    await selectCell(attackIndex)
    await setActiveCellText(`${attack}\n${secondLineAttack}`)
    const selectedHostileHeader = await execute(
      `const header = document.querySelector('.strip-card:first-of-type .svg-group-header'); if (!header) return false; header.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return true;`,
    )
    assert(selectedHostileHeader, 'Header could not be selected for hostile-input testing')
    await delay(100)
    await setInputByLabel('Header text', attack)
    await clickButton('Save header')

    const securityState = await execute(
      `const root = document.querySelector('.app-shell'); const cell = document.querySelectorAll('.strip-card:first-of-type .strip-artwork .cell-copy')[arguments[0]]; return { alerts: window.__racklabelsAlertCount, projectName: document.querySelector('.project-name-field input')?.value, stripName: document.querySelector('.strip-card:first-of-type .strip-name-input')?.value, cellLines: [...(cell?.querySelectorAll('text') ?? [])].map((item) => item.textContent), headerText: document.querySelector('.strip-card:first-of-type .group-header-copy')?.textContent, injectedScripts: root?.querySelectorAll('script').length, injectedImages: root?.querySelectorAll('img[src="x"]').length, injectedSvgHandlers: root?.querySelectorAll('svg[onload], [onerror]').length, networkX: performance.getEntriesByType('resource').filter((entry) => entry.name.endsWith('/x') || entry.name.includes('/x?')).length };`,
      [attackIndex],
    )
    assert(securityState.alerts === 0, `Hostile input executed alert for ${attack}`)
    assert(securityState.projectName === attack && securityState.stripName === attack, 'Hostile name input was not retained as literal data')
    assert(JSON.stringify(securityState.cellLines) === JSON.stringify([attack, secondLineAttack]), 'Hostile cell text escaped its text container')
    assert(securityState.headerText === attack, 'Hostile group-header text was not retained literally')
    assert(securityState.injectedScripts === 0 && securityState.injectedImages === 0 && securityState.injectedSvgHandlers === 0, 'Hostile input created an executable DOM element or handler')
    assert(securityState.networkX === 0, 'Hostile image markup caused an unexpected network request')
  }

  const beforeHostileSave = await readdir(downloadDirectory)
  await clickButton('Save')
  const hostileProjectFile = await waitForDownload('.racklabel', beforeHostileSave)
  const hostileProject = JSON.parse(await readFile(hostileProjectFile, 'utf8'))
  assert(hostileProject.name === attackStrings.at(-1), 'Hostile project name was not saved literally')
  assert(hostileProject.strips[0].name === attackStrings.at(-1), 'Hostile strip name was not saved literally')
  assert(hostileProject.strips[0].groupHeaders[0].text === attackStrings.at(-1), 'Hostile header was not saved literally')
  assert(!/[\\/:*?"<>|]/.test(path.basename(hostileProjectFile)), 'Generated project filename retained unsafe path characters')
  const hostileFileInputId = await findElement('input[type="file"]')
  await request(`/session/${sessionId}/element/${hostileFileInputId}/value`, 'POST', {
    text: hostileProjectFile,
  })
  await waitFor(
    () => execute(`return document.querySelector('.app-notice')?.textContent.includes('Opened') ?? false;`),
    'Hostile project did not reopen safely',
  )
  const hostileRestored = await execute(
    `return { alerts: window.__racklabelsAlertCount, projectName: document.querySelector('.project-name-field input')?.value, headerText: document.querySelector('.group-header-copy')?.textContent, injected: document.querySelector('.app-shell')?.querySelectorAll('script, img[src="x"], svg[onload], [onerror]').length };`,
  )
  assert(hostileRestored.alerts === 0 && hostileRestored.injected === 0, 'Reopening hostile JSON executed or injected markup')
  assert(hostileRestored.projectName === attackStrings.at(-1) && hostileRestored.headerText === attackStrings.at(-1), 'Reopening hostile JSON lost literal content')

  await clickButton('Help / About')
  const aboutState = await execute(
    `const dialog = document.querySelector('.about-dialog'); const text = dialog?.textContent.replace(/\\s+/g, ' ').trim() ?? ''; const support = [...(dialog?.querySelectorAll('a') ?? [])].find((item) => item.textContent.includes('Buy me a coffee')); return { title: dialog?.querySelector('h2')?.textContent, text, supportHref: support?.getAttribute('href'), supportTarget: support?.getAttribute('target'), supportRel: support?.getAttribute('rel'), version: dialog?.querySelector('.about-version')?.textContent.replace(/\\s+/g, ' ').trim() };`,
  )
  assert(aboutState.title === 'Rack Label Maker', 'Help/About did not open')
  for (const requiredText of ['true physical dimensions', '100% / Actual Size', 'Do not use Fit or Shrink', 'Shift-click', '{n}', '# button', 'saved', 'inside the configured physical strip height', 'entirely in your browser']) {
    assert(aboutState.text.includes(requiredText), `Help/About is missing: ${requiredText}`)
  }
  assert(aboutState.supportHref === 'https://buymeacoffee.com/rschmidt', 'Help support URL is incorrect')
  assert(aboutState.supportTarget === '_blank' && aboutState.supportRel === 'noopener noreferrer', 'Help support link safety attributes are missing')
  assert(/^v0\.6\.0-beta · Build \d{4}-\d{2}-\d{2}$/.test(aboutState.version), 'Help version/build information is incorrect')
  const aboutScreenshotFile = path.join(downloadDirectory, 'help-about.png')
  const aboutScreenshot = await request(`/session/${sessionId}/screenshot`)
  await writeFile(aboutScreenshotFile, Buffer.from(aboutScreenshot, 'base64'))
  const closedAbout = await execute(
    `const button = document.querySelector('button[aria-label="Close Help and About"]'); if (!button) return false; button.click(); return true;`,
  )
  assert(closedAbout, 'Help/About could not be closed')
  await delay(120)

  const footerActions = await execute(
    `const footer = document.querySelector('.app-footer'); const feedback = [...(footer?.querySelectorAll('a') ?? [])].find((item) => item.textContent.trim() === 'Send feedback'); const support = [...(footer?.querySelectorAll('a') ?? [])].find((item) => item.textContent.includes('Buy me a coffee')); const feedbackUrl = feedback ? new URL(feedback.href) : undefined; const body = feedbackUrl ? new URLSearchParams(feedbackUrl.search).get('body') : ''; return { feedbackHref: feedback?.getAttribute('href'), feedbackBody: body, supportHref: support?.getAttribute('href'), supportTarget: support?.getAttribute('target'), supportRel: support?.getAttribute('rel') };`,
  )
  assert(footerActions.feedbackHref?.startsWith('mailto:'), 'Feedback action is not a mailto link')
  for (const expected of ['Version: v0.6.0-beta', 'Build:', 'Browser:', 'Page format: A3', 'Orientation: landscape', 'Feedback:', '[write here]']) {
    assert(footerActions.feedbackBody.includes(expected), `Feedback draft is missing: ${expected}`)
  }
  for (const privateValue of ['Studio Rack Labels', 'Router Out', 'Wireless', 'MICROPHONES', '<script>', 'constructor.constructor']) {
    assert(!footerActions.feedbackBody.includes(privateValue), `Feedback draft leaked private project content: ${privateValue}`)
  }
  assert(footerActions.supportHref === 'https://buymeacoffee.com/rschmidt', 'Footer support URL is incorrect')
  assert(footerActions.supportTarget === '_blank' && footerActions.supportRel === 'noopener noreferrer', 'Footer support link safety attributes are missing')

  const mainWindowHandle = (await request(`/session/${sessionId}/window`))
  const supportHandlesBefore = await request(`/session/${sessionId}/window/handles`)
  const openedSupport = await execute(
    `const link = [...document.querySelectorAll('.app-footer a')].find((item) => item.textContent.includes('Buy me a coffee')); if (!link) return false; link.click(); return true;`,
  )
  assert(openedSupport, 'Support link could not be opened')
  const supportHandlesAfter = await waitFor(
    async () => {
      const handles = await request(`/session/${sessionId}/window/handles`)
      return handles.length > supportHandlesBefore.length ? handles : false
    },
    'Support link did not open a new tab',
  )
  const supportWindowHandle = supportHandlesAfter.find((handle) => !supportHandlesBefore.includes(handle))
  assert(supportWindowHandle, 'Support link new tab could not be identified')
  await request(`/session/${sessionId}/window`, 'POST', { handle: supportWindowHandle })
  const supportUrl = await waitFor(
    async () => {
      const currentUrl = await request(`/session/${sessionId}/url`)
      return currentUrl.startsWith('https://buymeacoffee.com/rschmidt') ? currentUrl : false
    },
    'Support tab did not navigate to Buy Me a Coffee',
    20_000,
  )
  assert(supportUrl.startsWith('https://buymeacoffee.com/rschmidt'), 'Support tab opened an unexpected URL')
  await request(`/session/${sessionId}/window`, 'DELETE')
  await request(`/session/${sessionId}/window`, 'POST', { handle: mainWindowHandle })

  const screenshotFile = path.join(downloadDirectory, 'editor-workflow.png')
  const screenshot = await request(`/session/${sessionId}/screenshot`)
  await writeFile(screenshotFile, Buffer.from(screenshot, 'base64'))

  const beforeCalibration = await readdir(downloadDirectory)
  await clickButton('Calibration')
  const calibrationReminder = await execute(
    `const dialog = document.querySelector('.print-reminder'); return { title: dialog?.querySelector('h2')?.textContent, body: dialog?.querySelector('p')?.textContent, button: [...(dialog?.querySelectorAll('button') ?? [])].some((item) => item.textContent.trim() === 'Download Calibration PDF') };`,
  )
  assert(calibrationReminder.title === 'Verify printer scaling is set to 100% / Actual Size.', 'Calibration scaling reminder title is missing')
  assert(calibrationReminder.body === 'Do not use Fit or Shrink. Some printer drivers may silently scale the document.', 'Calibration scaling reminder body is inconsistent')
  assert(calibrationReminder.button, 'Calibration download action is missing')
  await clickButton('Download Calibration PDF')
  const calibrationFile = await waitForDownload('.pdf', beforeCalibration)

  const beforePdf = await readdir(downloadDirectory)
  await clickButton('Export PDF')
  const pdfFile = await waitForDownload('.pdf', beforePdf)

  await clickButton('Print')
  const reminder = await execute(
    `return { title: document.querySelector('.print-reminder h2')?.textContent, body: document.querySelector('.print-reminder p')?.textContent, button: [...document.querySelectorAll('.print-reminder button')].some((item) => item.textContent.trim() === 'Open PDF for Printing') };`,
  )
  assert(reminder.title === 'Verify printer scaling is set to 100% / Actual Size.', 'Print scaling reminder title is missing')
  assert(reminder.body === 'Do not use Fit or Shrink. Some printer drivers may silently scale the document.', 'Print driver warning is missing')
  assert(reminder.button, 'Open PDF for Printing action is missing')
  await clickButton('Open PDF for Printing')
  await waitFor(
    () => execute(`return document.querySelector('.app-notice')?.textContent.includes('PDF opened for printing') ?? false;`),
    'Print PDF did not open',
    20_000,
  )
  const windowHandles = await request(`/session/${sessionId}/window/handles`)
  assert(windowHandles.length >= 2, 'Print workflow did not open a second browser tab')

  const result = {
    presets: presetCounts,
    headerGeometry,
    deleteHeaderKeepsStrip: true,
    deleteStripConfirmation: true,
    numberTokenInsertion: insertedTemplate,
    editorZooms: ['100%', '135%', '150%'],
    autoNumberedRanges: ['1–6', '7–12'],
    duplicateStrips: 2,
    packedA3Pages: packedPreview.pages,
    emptyNewStripVerified: true,
    hostileInputsVerified: attackStrings.length,
    hostileProjectFile,
    supportQrPreview: packedPreview.supportDecorations,
    betaUi,
    helpAboutVerified: true,
    feedbackDraftVerified: true,
    supportUrl,
    aboutScreenshotFile,
    calibrationFile,
    projectFile,
    pdfFile,
    screenshotFile,
    pagePreviewMatchesEditor: true,
    printReminderVerified: true,
    printWindowCount: windowHandles.length,
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
} finally {
  if (sessionId) {
    await request(`/session/${sessionId}`, 'DELETE').catch(() => undefined)
  }
}
