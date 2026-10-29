import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../supabase'
import logo from '../assets/logo-lg.svg'

type Mode = 'password' | 'magic' | 'signup'

const TABS: { id: Mode; label: string }[] = [
  { id: 'password', label: 'Password' },
  { id: 'magic', label: 'Magic link' },
  { id: 'signup', label: 'Sign up' },
]

export default function AuthForm() {
  const [mode, setMode] = useState<Mode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    setIsError(false)
    let error: { message: string } | null = null
    if (mode === 'password') {
      ;({ error } = await supabase.auth.signInWithPassword({ email, password }))
    } else if (mode === 'magic') {
      ;({ error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } }))
      if (!error) setMessage('Check your email for a sign-in link.')
    } else {
      const res = await supabase.auth.signUp({ email, password })
      error = res.error
      if (!error && !res.data.session) setMessage('Check your email to confirm your account, then sign in.')
    }
    setBusy(false)
    if (error) {
      setMessage(error.message)
      setIsError(true)
    }
  }

  const submitLabel = mode === 'password' ? 'Sign in' : mode === 'magic' ? 'Send magic link' : 'Sign up'

  return (
    <main className="auth-page">
      <div className="auth-brand">
        <div className="logo lg">
          <img src={logo} alt="" width={24} height={24} />
        </div>
        <h1>FlowBoard</h1>
        <p>Sign in to manage your boards</p>
      </div>
      <form className="auth-card" onSubmit={submit}>
        <div className="toggle" role="group" aria-label="How do you want to sign in?">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={mode === t.id}
              className={mode === t.id ? 'active' : ''}
              onClick={() => {
                setMode(t.id)
                setMessage('')
                setIsError(false)
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <label className="field">
          <span className="label">Email Address</span>
          <input type="email" required autoComplete="email" maxLength={254} placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {mode !== 'magic' && (
          <label className="field">
            <span className="label">Password</span>
            <input
              type="password"
              required
              minLength={mode === 'signup' ? 8 : undefined}
              aria-describedby={mode === 'signup' ? 'password-rule' : undefined}
              autoComplete={mode === 'password' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}
        {mode === 'signup' && (
          <span id="password-rule" className="hint password-rule">
            At least 8 characters.
          </span>
        )}
        {message && (
          <p role={isError ? 'alert' : 'status'} className={isError ? 'error' : 'success'}>
            {message}
          </p>
        )}
        <button type="submit" className="primary block" disabled={busy}>
          {submitLabel}
        </button>
      </form>
    </main>
  )
}
