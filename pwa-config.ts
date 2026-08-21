import type { ManifestOptions } from 'vite-plugin-pwa'
import { APP_NAME, APP_SHORT_NAME } from './src/config/branding.ts'
import {
  PROJECT_FILE_EXTENSION,
  PROJECT_FILE_MIME_TYPE,
} from './src/config/project-files.ts'

type RackLabelMakerManifest = Partial<ManifestOptions> & {
  file_handlers: Array<{
    action: string
    accept: Record<string, string[]>
    launch_type: 'single-client'
  }>
}

export const PWA_THEME_COLOR = '#111519'
export const PWA_BACKGROUND_COLOR = '#111519'

export const RACK_LABEL_MAKER_MANIFEST: RackLabelMakerManifest = {
  id: '/',
  name: APP_NAME,
  short_name: APP_SHORT_NAME,
  description:
    'Free browser-based tool for true-size 19-inch rack and patch-panel labels with printable PDF export.',
  theme_color: PWA_THEME_COLOR,
  background_color: PWA_BACKGROUND_COLOR,
  display: 'standalone',
  start_url: '/',
  scope: '/',
  icons: [
    {
      src: 'pwa-192x192.png',
      sizes: '192x192',
      type: 'image/png',
    },
    {
      src: 'pwa-512x512.png',
      sizes: '512x512',
      type: 'image/png',
    },
    {
      src: 'maskable-icon-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
  file_handlers: [
    {
      action: '/',
      accept: {
        [PROJECT_FILE_MIME_TYPE]: [PROJECT_FILE_EXTENSION],
      },
      launch_type: 'single-client',
    },
  ],
}
