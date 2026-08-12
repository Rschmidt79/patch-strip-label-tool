import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { APP_NAME, APP_SHORT_NAME } from '../src/config/branding'
import {
  PROJECT_FILE_EXTENSION,
  PROJECT_FILE_MIME_TYPE,
} from '../src/config/project-files'
import { RACK_LABEL_MAKER_MANIFEST } from '../pwa-config'

describe('installable PWA manifest', () => {
  it('defines standalone application identity and install icons', () => {
    expect(RACK_LABEL_MAKER_MANIFEST).toMatchObject({
      name: APP_NAME,
      short_name: APP_SHORT_NAME,
      display: 'standalone',
      start_url: '/',
      scope: '/',
      theme_color: '#111519',
      background_color: '#111519',
    })
    expect(RACK_LABEL_MAKER_MANIFEST.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: '192x192' }),
        expect.objectContaining({ sizes: '512x512' }),
        expect.objectContaining({ purpose: 'maskable' }),
      ]),
    )
    expect(existsSync(join(process.cwd(), 'public/pwa-icon.svg'))).toBe(true)
  })

  it('associates .racklabel with the centralized custom MIME type', () => {
    expect(RACK_LABEL_MAKER_MANIFEST.file_handlers).toEqual([
      {
        action: '/',
        accept: {
          [PROJECT_FILE_MIME_TYPE]: [PROJECT_FILE_EXTENSION],
        },
        launch_type: 'single-client',
      },
    ])
  })
})
