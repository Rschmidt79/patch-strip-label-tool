import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import packageMetadata from '../package.json'

const PUBLIC_URL = 'https://labels.rschmidt.dk/'
const TITLE = 'Free Rack Label Maker – 19" Rack & Patch Panel Labels'
const DESCRIPTION =
  'Design physically accurate 19-inch rack and patch panel labels free in your browser. Export printable PDFs for A4, A3, US Letter, US Legal, and more.'

function readProjectFile(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

function getStructuredDataSource(html: string): string {
  const match = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
  )
  if (!match) throw new Error('JSON-LD script is missing')
  return match[1]
}

describe('public search metadata', () => {
  it('ships human-readable initial HTML metadata for the canonical URL', () => {
    const html = readProjectFile('index.html')

    expect(html).toContain('<html lang="en">')
    expect(html).toContain(`<title>${TITLE.replace('&', '&amp;')}</title>`)
    expect(html).toContain(`name="description"\n      content="${DESCRIPTION}"`)
    expect(html).toContain('<meta name="robots" content="index, follow" />')
    expect(html).toContain(`<link rel="canonical" href="${PUBLIC_URL}" />`)
    expect(html).toContain(`content="${PUBLIC_URL}" />`)
    expect(html).toContain('property="og:title"')
    expect(html).toContain('property="og:description"')
    expect(html).toContain('name="twitter:card" content="summary"')
    expect(html.toLowerCase()).not.toContain('lemo')
  })

  it('uses valid, factual WebSite and WebApplication structured data', () => {
    const html = readProjectFile('index.html')
    const structuredData = JSON.parse(getStructuredDataSource(html)) as {
      '@context': string
      '@graph': Array<Record<string, unknown>>
    }

    expect(structuredData['@context']).toBe('https://schema.org')
    expect(structuredData['@graph'].map((entry) => entry['@type'])).toEqual([
      'WebSite',
      'WebApplication',
    ])
    expect(structuredData['@graph']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          '@type': 'WebSite',
          url: PUBLIC_URL,
          name: 'Rack Label Maker',
        }),
        expect.objectContaining({
          '@type': 'WebApplication',
          url: PUBLIC_URL,
          applicationCategory: 'DesignApplication',
          isAccessibleForFree: true,
        }),
      ]),
    )
    expect(html).not.toMatch(/aggregateRating|reviewCount|price/i)
  })

  it('publishes a crawlable root URL without invented sitemap routes', () => {
    const robots = readProjectFile('public/robots.txt')
    const sitemap = readProjectFile('public/sitemap.xml')

    expect(robots).toContain('User-agent: *')
    expect(robots).toContain('Allow: /')
    expect(robots).toContain(
      `Sitemap: ${PUBLIC_URL}sitemap.xml`,
    )
    expect(sitemap.match(/<loc>/g)).toHaveLength(1)
    expect(sitemap).toContain(`<loc>${PUBLIC_URL}</loc>`)
  })

  it('keeps inline JSON-LD authorized by the static-host CSP', () => {
    const html = readProjectFile('index.html')
    const structuredDataSource = getStructuredDataSource(html)
    const hash = createHash('sha256')
      .update(structuredDataSource)
      .digest('base64')
    const source = `'sha256-${hash}'`
    const vercel = readProjectFile('vercel.json')
    const netlifyHeaders = readProjectFile('public/_headers')

    expect(vercel).toContain(source)
    expect(netlifyHeaders).toContain(source)
    expect(vercel).not.toContain("script-src 'self' 'unsafe-inline'")
    expect(netlifyHeaders).not.toContain("script-src 'self' 'unsafe-inline'")
  })

  it('retains the final release version and no visible beta badge', () => {
    expect(packageMetadata.version).toBe('1.0.0')
    expect(readProjectFile('src/components/Toolbar.tsx')).not.toContain(
      'beta-badge',
    )
  })
})
