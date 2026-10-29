import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { supabaseMock } from './test/supabaseMock'
import App from './App'

vi.mock('./components/Board', () => ({
  default: ({ email }: { email: string }) => <div>board for {email}</div>,
}))

const session = { user: { id: 'u1', email: 'sam@example.com' } }

describe('App', () => {
  it('shows an accessible loading indicator while the session resolves', () => {
    supabaseMock.auth.getSession.mockReturnValue(new Promise(() => {}))
    render(<App />)
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  })

  it('shows the sign-in page and a matching tab title when signed out', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'FlowBoard' })).toBeInTheDocument()
    expect(document.title).toBe('Sign in – FlowBoard')
  })

  it('lazy-loads the board and updates the tab title when signed in', async () => {
    supabaseMock.auth.getSession.mockResolvedValue({ data: { session } })
    render(<App />)
    expect(await screen.findByText('board for sam@example.com')).toBeInTheDocument()
    expect(document.title).toBe('My Board – FlowBoard')
  })

  it('returns to the sign-in page when the session ends', async () => {
    supabaseMock.auth.getSession.mockResolvedValue({ data: { session } })
    render(<App />)
    await screen.findByText('board for sam@example.com')
    const listener = supabaseMock.auth.onAuthStateChange.mock.calls[0][0] as (e: string, s: null) => void
    act(() => listener('SIGNED_OUT', null))
    expect(await screen.findByRole('heading', { name: 'FlowBoard' })).toBeInTheDocument()
    expect(document.title).toBe('Sign in – FlowBoard')
  })
})
