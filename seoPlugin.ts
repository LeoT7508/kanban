import type { Plugin } from 'vite'

// Absolute URLs (canonical, og:url, sitemap) need the production origin, so they are
// only emitted when VITE_SITE_URL is set, e.g. VITE_SITE_URL=https://flowboard.example.com
export function seo(siteUrl: string): Plugin {
  const origin = siteUrl.replace(/\/+$/, '')
  return {
    name: 'seo',
    transformIndexHtml: (html) =>
      html.replace(
        '%SITE_TAGS%',
        origin ? `    <link rel="canonical" href="${origin}/" />\n    <meta property="og:url" content="${origin}/" />` : '',
      ),
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n${origin ? `\nSitemap: ${origin}/sitemap.xml\n` : ''}`,
      })
      if (origin) {
        this.emitFile({
          type: 'asset',
          fileName: 'sitemap.xml',
          source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${origin}/</loc></url>\n</urlset>\n`,
        })
      }
    },
  }
}
