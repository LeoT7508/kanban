import { lazy, Suspense, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import AuthForm from './components/AuthForm'

const Board = lazy(() => import('./components/Board'))

const Splash = () => (
  <div className="splash" role="status" aria-label="Loading">
    <span className="spinner" />
  </div>
)

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    document.title = session ? 'My Board – FlowBoard' : 'Sign in – FlowBoard'
  }, [session])

  if (!ready) return <Splash />
  return session ? (
    <Suspense fallback={<Splash />}>
      <Board userId={session.user.id} email={session.user.email ?? ''} />
    </Suspense>
  ) : (
    <AuthForm />
  )
}
