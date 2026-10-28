import { useEffect, useState } from 'react'
import { messageLink, site } from '../config/site'
import { supabase } from '../lib/supabase'

type State = 'checking' | 'confirmed' | 'unconfirmed'

/**
 * Where the confirmation email lands. The Supabase client exchanges the code in the URL for a
 * session (detectSessionInUrl); a session here means the email is confirmed and the trial started.
 */
export function WelcomePage() {
  const [state, setState] = useState<State>('checking')

  useEffect(() => {
    let active = true
    const show = (confirmed: boolean) => {
      if (active) setState(confirmed ? 'confirmed' : 'unconfirmed')
    }
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) show(true)
    })
    supabase.auth.getSession().then(({ data: { session } }) => show(Boolean(session)))
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  return (
    <div className="page">
      {state === 'checking' && <p className="hint">Confirming your email…</p>}
      {state === 'confirmed' && (
        <>
          <h1>You are in! 🎉</h1>
          <p>
            Your email is confirmed and your {site.trialDays}-day free trial has started. We will message you within one working day
            to set up your courts, hours and rates.
          </p>
          <p>
            Want to speed it up? <a href={messageLink}>Message us</a> now.
          </p>
        </>
      )}
      {state === 'unconfirmed' && (
        <>
          <h1>This link did not work</h1>
          <p>
            It may have expired or already been used. Try signing up again, or email us at{' '}
            <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>.
          </p>
          <a className="btn dark" href="/#contact">
            Back to sign-up
          </a>
        </>
      )}
    </div>
  )
}
