import { access, readFile } from 'node:fs/promises'

const publicUrl = 'https://labels.rschmidt.dk/'
const expectedTitle = 'Free Rack Label Maker – 19" Rack & Patch Panel Labels'
const expectedDescription =
  'Design physically accurate 19-inch rack and patch panel labels free in your browser. Export printable PDFs for A4, A3, US Letter, US Legal, and more.'

const manifest = JSON.parse(
  await readFile(new URL('../dist/manifest.webmanifest', import.meta.url), 'utf8'),
)
const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8')
const robots = await readFile(
  new URL('../dist/robots.txt', import.meta.url),
  'utf8',
)
const sitemap = await readFile(
  new URL('../dist/sitemap.xml', import.meta.url),
  'utf8',
)
const structuredDataSource = html.match(
  /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
)?.[1]
const structuredData = structuredDataSource
  ? JSON.parse(structuredDataSource)
  : undefined

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
  html.includes(`<title>${expectedTitle.replace('&', '&amp;')}</title>`),
  'Production HTML title is incorrect.',
)
assert(
  html.includes(`content="${expectedDescription}"`),
  'Production meta description is incorrect.',
)
assert(
  html.includes(`<link rel="canonical" href="${publicUrl}">`) ||
    html.includes(`<link rel="canonical" href="${publicUrl}" />`),
  'Production canonical URL is incorrect.',
)
assert(
  structuredData?.['@graph']?.some(
    (entry) => entry['@type'] === 'WebApplication' && entry.url === publicUrl,
  ),
  'Production WebApplication JSON-LD is missing.',
)
assert(
  robots.includes(`Sitemap: ${publicUrl}sitemap.xml`),
  'Built robots.txt has the wrong sitemap URL.',
)
assert(
  (sitemap.match(/<loc>/g) ?? []).length === 1 &&
    sitemap.includes(`<loc>${publicUrl}</loc>`),
  'Built sitemap.xml does not contain only the canonical root URL.',
)
assert(
  manifest.icons?.some((icon) => icon.sizes === '192x192') &&
    manifest.icons?.some((icon) => icon.sizes === '512x512'),
  'Installable PWA icons are missing from the built manifest.',
)

await Promise.all(
  [
    'sw.js',
    'registerSW.js',
    'pwa-192x192.png',
    'pwa-512x512.png',
    'robots.txt',
    'sitemap.xml',
  ].map(
    (fileName) => access(new URL(`../dist/${fileName}`, import.meta.url)),
  ),
)

console.log(
  'Verified PWA manifest, SEO files, structured data, icons, and service worker.',
)
