/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(import.meta.dirname, '..')
const migrationsDir = join(root, 'supabase', 'migrations')
const sql = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => readFileSync(join(migrationsDir, f), 'utf8'))
  .join('\n')

describe('database hardening migration', () => {
  it('removes all access for signed-out visitors', () => {
    expect(sql).toMatch(/revoke all on table public\.cards from anon/i)
  })

  it('gives signed-in users only select, insert, update and delete (no TRUNCATE)', () => {
    expect(sql).toMatch(/grant select, insert, update, delete on table public\.cards to authenticated/i)
    expect(sql).not.toMatch(/grant[^;]*truncate/i)
  })

  it('forces row level security', () => {
    expect(sql).toMatch(/alter table public\.cards force row level security/i)
  })

  it('caps text sizes to match the form limits', () => {
    expect(sql).toMatch(/char_length\(title\)\s*<=\s*200/i)
    expect(sql).toMatch(/char_length\(description\)\s*<=\s*5000/i)
    expect(sql).toMatch(/char_length\(assignee\)\s*<=\s*100/i)
  })
})

describe('client secrets', () => {
  const files = readdirSync(join(root, 'src'), { recursive: true, encoding: 'utf8' })
    .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f) && !f.startsWith('test'))
    .map((f) => readFileSync(join(root, 'src', f), 'utf8'))

  it('never references a service_role or secret key in client code', () => {
    for (const src of files) expect(src).not.toMatch(/service_role|SERVICE_ROLE|secret[_-]?key/i)
  })

  it('only reads the public Supabase URL and publishable key from the environment', () => {
    const names = new Set(files.flatMap((src) => [...src.matchAll(/import\.meta\.env\.(\w+)/g)].map((m) => m[1])))
    expect([...names].sort()).toEqual(['VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_URL'])
  })
})
