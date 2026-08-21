import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'
import { RACK_LABEL_MAKER_MANIFEST } from './pwa-config.ts'

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string }
const buildDate =
  process.env.APP_BUILD_DATE ?? new Date().toISOString().slice(0, 10)

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      pwaAssets: {
        image: 'public/pwa-icon.svg',
        preset: 'minimal-2023',
        overrideManifestIcons: true,
      },
      manifest: RACK_LABEL_MAKER_MANIFEST,
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{html,js,css,svg,png,ico,txt,xml}'],
        navigateFallback: 'index.html',
        runtimeCaching: [],
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
})
