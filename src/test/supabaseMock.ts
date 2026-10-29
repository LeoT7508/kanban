import { vi } from 'vitest'

const unsubscribe = vi.fn()

export const channelMock = { on: vi.fn(), subscribe: vi.fn() }

export const supabaseMock = {
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signInWithPassword: vi.fn(),
    signInWithOtp: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  },
  channel: vi.fn(),
  removeChannel: vi.fn(),
  from: vi.fn(),
}

// Re-applied before every test: signed-out session, no errors, inert realtime channel.
export function resetSupabaseMock() {
  channelMock.on.mockReset().mockReturnValue(channelMock)
  channelMock.subscribe.mockReset().mockReturnValue(channelMock)
  supabaseMock.channel.mockReset().mockReturnValue(channelMock)
  supabaseMock.removeChannel.mockReset().mockResolvedValue('ok')
  supabaseMock.auth.getSession.mockReset().mockResolvedValue({ data: { session: null } })
  supabaseMock.auth.onAuthStateChange.mockReset().mockReturnValue({ data: { subscription: { unsubscribe } } })
  supabaseMock.auth.signInWithPassword.mockReset().mockResolvedValue({ error: null })
  supabaseMock.auth.signInWithOtp.mockReset().mockResolvedValue({ error: null })
  supabaseMock.auth.signUp.mockReset().mockResolvedValue({ error: null, data: { session: null } })
  supabaseMock.auth.signOut.mockReset().mockResolvedValue({ error: null })
  supabaseMock.from.mockReset().mockImplementation(() => {
    throw new Error('supabase.from() was called without a test-specific mock')
  })
}
