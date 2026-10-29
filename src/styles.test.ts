/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contrast } from './test/contrast'

const css = readFileSync(join(import.meta.dirname, 'index.css'), 'utf8')

const vars = Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]))
const v = (name: string) => vars[name]

// Body of the first rule whose selector is exactly `selector`.
const rule = (selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? ''
}

const WHITE = '#ffffff'

describe('colour contrast (WCAG 1.4.3 text ≥ 4.5, 1.4.11 UI ≥ 3)', () => {
  it.each([
    ['muted text on white', v('muted'), WHITE],
    ['muted text on the grey board', v('muted'), v('bg')],
    ['muted text on the focused-input background', v('muted'), v('focus-bg')],
    ['muted text on the drag-over column', v('muted'), '#e0f2fe'],
    ['body text on the grey board', v('text'), v('bg')],
    ['white on the avatar', WHITE, v('avatar')],
    ['white on the dark blue top bar', WHITE, v('primary-hover')],
    ['white on primary buttons', WHITE, v('primary')],
  ])('%s is at least 4.5:1', (_name, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5)
  })

  it.each([
    ['input borders on white', v('field-border'), WHITE],
    ['input borders on the grey board', v('field-border'), v('bg')],
    ['the counter pill on the grey board', v('primary-hover'), v('bg')],
  ])('%s are at least 3:1', (_name, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(3)
  })
})

describe('design decisions', () => {
  it('uses a dark blue top bar with light text', () => {
    expect(rule('.navbar')).toMatch(/background:\s*var\(--primary-hover\)/)
    expect(rule('.navbar')).toMatch(/color:\s*#fff/)
  })

  it('styles the column counter as a dark pill with light text at the column title size', () => {
    const count = rule('.count')
    expect(count).toMatch(/background:\s*var\(--primary-hover\)/)
    expect(count).toMatch(/color:\s*#fff/)
    expect(count).toMatch(/border-radius:\s*999px/)
    expect(count.match(/font-size:\s*([\d.]+rem)/)?.[1]).toBe(rule('.column-head h2').match(/font-size:\s*([\d.]+rem)/)?.[1])
  })

  it('separates columns with grey rules and puts shadows on cards, not columns', () => {
    expect(rule('.column + .column')).toMatch(/border-left:\s*1px solid #d0d0d6/)
    expect(rule('.vrule')).toMatch(/background:\s*#d0d0d6/)
    expect(rule('.card')).toMatch(/box-shadow/)
    expect(rule('.column')).not.toMatch(/box-shadow|background/)
  })

  it('keeps hit targets at least 44px tall', () => {
    for (const sel of ['.trash-btn', '.close-btn', '.add-btn', '.text-btn']) {
      expect(rule(sel)).toMatch(/(?:min-)?height:\s*44px/)
    }
  })
})

describe('accessibility utilities', () => {
  it('defines a screen-reader-only class', () => {
    expect(rule('.visually-hidden')).toMatch(/clip:\s*rect\(0 0 0 0\)/)
  })

  it('respects reduced motion', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/)
  })

  it('stacks the columns on narrow screens (reflow)', () => {
    expect(css).toMatch(/@media \(max-width: 640px\)[\s\S]*\.board\s*\{\s*grid-template-columns:\s*1fr/)
  })

  it('hides decorative focus-ring suppression only where an alternative exists', () => {
    expect(rule('.card-title:focus-visible')).toMatch(/outline:\s*none/)
    expect(rule('.card:focus-within')).toMatch(/outline:\s*2px solid/)
  })
})
