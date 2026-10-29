import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { resetSupabaseMock, supabaseMock } from './supabaseMock'

// Safety net: no test may reach the real database or the network.
vi.mock('../supabase', () => ({ supabase: supabaseMock }))

beforeEach(() => {
  resetSupabaseMock()
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('Network access is not allowed in tests')
    }),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
