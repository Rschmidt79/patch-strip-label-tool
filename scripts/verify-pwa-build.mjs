import { access, readFile } from 'node:fs/promises'

const manifest = JSON.parse(
  await readFile(new URL('../dist/manifest.webmanifest', import.meta.url), 'utf8'),
)

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

assert(manifest.name === 'Rack Label Maker', 'PWA name is missing.')
assert(manifest.short_name === 'Rack Labels', 'PWA short name is missing.')
assert(manifest.display === 'standalone', 'PWA display mode is not standalone.')
assert(
  manifest.file_handlers?.[0]?.accept?.['application/x-racklabel+json']?.includes(
    '.racklabel',
  ),
  'The .racklabel file handler is missing from the built manifest.',
)
assert(
  manifest.icons?.some((icon) => icon.sizes === '192x192') &&
    manifest.icons?.some((icon) => icon.sizes === '512x512'),
  'Installable PWA icons are missing from the built manifest.',
)

await Promise.all(
  ['sw.js', 'registerSW.js', 'pwa-192x192.png', 'pwa-512x512.png'].map(
    (fileName) => access(new URL(`../dist/${fileName}`, import.meta.url)),
  ),
)

console.log('Verified PWA manifest, file association, icons, and service worker.')
