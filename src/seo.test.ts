/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { seo } from '../seoPlugin.ts'

const raw = readFileSync(join(import.meta.dirname, '..', 'index.html'), 'utf8')
// The placeholder is replaced at build time; strip it so the HTML parser keeps <head> intact.
const doc = new DOMParser().parseFromString(raw.replace('%SITE_TAGS%', ''), 'text/html')
const meta = (key: string, attr: 'name' | 'property' = 'name') =>
  doc.querySelector(`meta[${attr}="${key}"]`)?.getAttribute('content') ?? ''

describe('index.html: SEO and GEO', () => {
  it('declares language and a descriptive title', () => {
    expect(doc.documentElement.lang).toBe('en')
    expect(doc.title.length).toBeGreaterThan(20)
    expect(doc.title.length).toBeLessThanOrEqual(70)
    expect(doc.title).toContain('FlowBoard')
  })

  it('has a meta description of a search-friendly length', () => {
    const d = meta('description')
    expect(d.length).toBeGreaterThanOrEqual(70)
    expect(d.length).toBeLessThanOrEqual(160)
  })

  it('has Open Graph and Twitter card tags', () => {
    expect(meta('og:title', 'property')).toBeTruthy()
    expect(meta('og:description', 'property')).toBeTruthy()
    expect(meta('og:type', 'property')).toBe('website')
    expect(meta('og:site_name', 'property')).toBe('FlowBoard')
    expect(meta('twitter:card')).toBeTruthy()
    expect(meta('twitter:title')).toBeTruthy()
  })

  it('allows indexing and sets a theme colour and favicon', () => {
    expect(meta('robots')).toContain('index')
    expect(meta('robots')).not.toContain('noindex')
    expect(meta('theme-color')).toMatch(/^#[0-9a-f]{6}$/i)
    expect(doc.querySelector('link[rel="icon"]')?.getAttribute('href')).toBe('/favicon.svg')
  })

  it('leaves absolute URLs to the build step, via a placeholder', () => {
    expect(raw).toContain('%SITE_TAGS%')
    expect(doc.querySelector('link[rel="canonical"]')).toBeNull()
  })

  it('describes the app with valid JSON-LD', () => {
    const json = JSON.parse(doc.querySelector('script[type="application/ld+json"]')!.textContent!)
    expect(json['@context']).toBe('https://schema.org')
    expect(json['@type']).toBe('WebApplication')
    expect(json.name).toBe('FlowBoard')
    expect(json.description).toBeTruthy()
  })

  it('ships crawlable fallback content with exactly one h1 inside #root', () => {
    const root = doc.getElementById('root')!
    expect(root.querySelectorAll('h1')).toHaveLength(1)
    expect(root.textContent).toMatch(/kanban/i)
  })

  it('loads web fonts without blocking first paint', () => {
    expect(raw).toMatch(/rel="preload"[\s\S]*as="style"[\s\S]*onload=/)
    expect(raw).toMatch(/<noscript>\s*<link[^>]*fonts\.googleapis\.com[^>]*rel="stylesheet"/)
    expect(raw).not.toMatch(/<link[^>]*rel="stylesheet"[^>]*fonts\.googleapis\.com(?![\s\S]*<\/noscript>)/)
  })
})

describe('seo build plugin', () => {
  const run = (url: string) => {
    const plugin = seo(url)
    const emitFile = vi.fn<(file: { fileName: string; source: string }) => void>()
    const html = (plugin.transformIndexHtml as (h: string) => string)('<head>\n%SITE_TAGS%\n</head>')
    ;(plugin.generateBundle as unknown as (this: { emitFile: typeof emitFile }) => void).call({ emitFile })
    const files = Object.fromEntries(
      emitFile.mock.calls.map(([f]) => [f.fileName, f.source]),
    )
    return { html, files }
  }

  it('adds canonical, og:url, a sitemap and a Sitemap line when the site URL is known', () => {
    const { html, files } = run('https://flowboard.example/')
    expect(html).toContain('<link rel="canonical" href="https://flowboard.example/" />')
    expect(html).toContain('<meta property="og:url" content="https://flowboard.example/" />')
    expect(files['sitemap.xml']).toContain('<loc>https://flowboard.example/</loc>')
    expect(files['robots.txt']).toContain('Sitemap: https://flowboard.example/sitemap.xml')
    expect(files['robots.txt']).toContain('Allow: /')
  })

  it('emits no absolute URLs and no sitemap when the site URL is unknown', () => {
    const { html, files } = run('')
    expect(html).not.toContain('%SITE_TAGS%')
    expect(html).not.toContain('canonical')
    expect(files['sitemap.xml']).toBeUndefined()
    expect(files['robots.txt']).toBe('User-agent: *\nAllow: /\n')
  })
})
