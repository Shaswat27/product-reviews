'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabaseBrowser'

export default function LoginPage() {
  const router = useRouter()
  const sp = useSearchParams()

  const redirectTo = sp.get('redirect') || sp.get('next') || '/dashboard'

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [stage, setStage] = useState<'email' | 'code'>('email')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  // If already logged in, bounce
  useEffect(() => {
    supabaseBrowser().auth.getSession().then(({ data }) => {
      if (data.session) router.replace(redirectTo)
    })
  }, [router, redirectTo])

  // Optional: show any server-passed error once
  useEffect(() => {
    const qsError = sp.get('error')
    if (qsError) setMsg(decodeURIComponent(qsError))
  }, [sp])

  // simple resend cooldown timer
  useEffect(() => {
    if (!cooldown) return
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault()
    setLoading(true)
    setMsg(null)
    try {
      const emailTrimmed = email.trim()
      const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)
      if (!valid) { setMsg('Enter a valid email address.'); return }

      const supabase = supabaseBrowser()
      // This sends a 6-digit code email (no link required)
      const { error } = await supabase.auth.signInWithOtp({
        email: emailTrimmed,
        options: {
          shouldCreateUser: true, // allow first-time signup
          // no emailRedirectTo needed for OTP-only
        },
      })

      if (error) { setMsg(mapSupabaseError(error)); return }

      setMsg('We emailed you a 6-digit code. Enter it below.')
      setStage('code')
      setCooldown(30) // throttle resends a bit
    } catch (err) {
      console.error(err)
      setMsg('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function verifyCode(e?: React.FormEvent) {
    e?.preventDefault()
    setLoading(true)
    setMsg(null)

    try {
      const emailTrimmed = email.trim()
      const token = code.trim().replace(/\s/g, '')

      if (!/^\d{6}$/.test(token)) {
        setMsg('Enter the 6-digit code from the email.')
        return
      }

      const supabase = supabaseBrowser()
      const { data, error } = await supabase.auth.verifyOtp({
        email: emailTrimmed,
        token,
        type: 'email', // OTP for email sign-in
      })

      if (error) {
        setMsg(mapSupabaseError(error))
        return
      }

      if (data?.session) {
        router.replace(redirectTo)
        return
      }

      setMsg('Could not start a session. Please try again.')
    } catch (err) {
      console.error(err)
      setMsg('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function mapSupabaseError(error: { message?: string; status?: number; name?: string }) {
    const m = (error?.message || '').toLowerCase()
    if (m.includes('rate limit') || m.includes('over_email_send_rate_limit')) return 'Too many requests. Try again shortly.'
    if (m.includes('expired')) return 'That code expired. Request a new one.'
    if (m.includes('invalid') && m.includes('token')) return 'Invalid code. Double-check the 6 digits.'
    if (m.includes('forbidden') || m.includes('not allowed')) return 'Sign-ups are disabled for this project.'
    return error.message || 'Unable to continue. Please try again.'
  }

  return (
    <div className="mx-auto max-w-md p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      {msg && <p className="text-sm opacity-80">{msg}</p>}

      {stage === 'email' && (
        <form onSubmit={sendCode} className="space-y-3">
          <label className="text-sm">Email</label>
          <input
            className="w-full border rounded p-2"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <button
            type="submit"
            disabled={loading || !email}
            className="w-full rounded-lg border p-2"
          >
            {loading ? 'Sending…' : 'Send code'}
          </button>
        </form>
      )}

      {stage === 'code' && (
        <form onSubmit={verifyCode} className="space-y-3">
          <label className="text-sm">6-digit code</label>
          <input
            className="w-full border rounded p-2 tracking-widest text-center"
            inputMode="numeric"
            pattern="\d*"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />

          <button
            type="submit"
            disabled={loading || !code}
            className="w-full rounded-lg border p-2"
          >
            {loading ? 'Verifying…' : 'Verify & continue'}
          </button>

          <button
            type="button"
            onClick={sendCode}
            disabled={loading || cooldown > 0}
            className="w-full rounded-lg border p-2"
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
          </button>
        </form>
      )}
    </div>
  )
}