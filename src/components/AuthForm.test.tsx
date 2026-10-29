import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { supabaseMock } from '../test/supabaseMock'
import AuthForm from './AuthForm'

const modeGroup = () => screen.getByRole('group', { name: 'How do you want to sign in?' })
const modeButton = (name: string) => within(modeGroup()).getByRole('button', { name })

async function fill(user: ReturnType<typeof userEvent.setup>, email: string, password?: string) {
  await user.type(screen.getByLabelText('Email Address'), email)
  if (password) await user.type(screen.getByLabelText('Password'), password)
}

describe('AuthForm: structure (WCAG audit)', () => {
  it('has a main landmark and a single h1', () => {
    render(<AuthForm />)
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'FlowBoard' })).toBeInTheDocument()
  })

  it('uses pressed-state buttons for the mode switch, not half-built tabs', async () => {
    const user = userEvent.setup()
    render(<AuthForm />)
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
    expect(modeButton('Password')).toHaveAttribute('aria-pressed', 'true')
    expect(modeButton('Sign up')).toHaveAttribute('aria-pressed', 'false')
    await user.click(modeButton('Sign up'))
    expect(modeButton('Sign up')).toHaveAttribute('aria-pressed', 'true')
    expect(modeButton('Password')).toHaveAttribute('aria-pressed', 'false')
  })

  it('lets password managers identify the email field', () => {
    render(<AuthForm />)
    const email = screen.getByLabelText('Email Address')
    expect(email).toHaveAttribute('autocomplete', 'email')
    expect(email).toHaveAttribute('maxlength', '254')
  })
})

describe('AuthForm: password rules (security audit)', () => {
  it('requires 8+ characters when signing up and says so up front', async () => {
    const user = userEvent.setup()
    render(<AuthForm />)
    await user.click(modeButton('Sign up'))
    const password = screen.getByLabelText('Password')
    expect(password).toHaveAttribute('minlength', '8')
    expect(password).toHaveAttribute('autocomplete', 'new-password')
    expect(password).toHaveAccessibleDescription('At least 8 characters.')
  })

  it('does not impose a length rule when signing in', () => {
    render(<AuthForm />)
    const password = screen.getByLabelText('Password')
    expect(password).not.toHaveAttribute('minlength')
    expect(password).toHaveAttribute('autocomplete', 'current-password')
    expect(screen.queryByText('At least 8 characters.')).not.toBeInTheDocument()
  })
})

describe('AuthForm: behaviour', () => {
  it('signs in with email and password', async () => {
    const user = userEvent.setup()
    render(<AuthForm />)
    await fill(user, 'sam@example.com', 'hunter2hunter2')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(supabaseMock.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'sam@example.com',
      password: 'hunter2hunter2',
    })
  })

  it('shows sign-in failures as an alert in the error style', async () => {
    supabaseMock.auth.signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    const user = userEvent.setup()
    render(<AuthForm />)
    await fill(user, 'sam@example.com', 'wrongwrong')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Invalid login credentials')
    expect(alert).toHaveClass('error')
  })

  it('sends a magic link and confirms with a polite status, not an alert', async () => {
    const user = userEvent.setup()
    render(<AuthForm />)
    await user.click(modeButton('Magic link'))
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
    await fill(user, 'sam@example.com')
    await user.click(screen.getByRole('button', { name: 'Send magic link' }))
    expect(supabaseMock.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'sam@example.com',
      options: { emailRedirectTo: window.location.origin },
    })
    expect(await screen.findByRole('status')).toHaveTextContent('Check your email for a sign-in link.')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('signs up and asks the user to confirm their email', async () => {
    const user = userEvent.setup()
    render(<AuthForm />)
    await user.click(modeButton('Sign up'))
    await fill(user, 'new@example.com', 'longenough1')
    // "Sign up" is both the mode button and the submit button; pick the submit one.
    await user.click(screen.getAllByRole('button', { name: 'Sign up' }).find((b) => b.getAttribute('type') === 'submit')!)
    expect(supabaseMock.auth.signUp).toHaveBeenCalledWith({ email: 'new@example.com', password: 'longenough1' })
    expect(await screen.findByRole('status')).toHaveTextContent('Check your email to confirm your account')
  })
})
