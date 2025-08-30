'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { setServerSession } from './actions'

export default function LoginContent() {
  const router = useRouter();
  const sp = useSearchParams();

  const redirectTo = sp.get('redirect') || sp.get('next') || '/dashboard';

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [loading, setLoading] = useState(false);
  const [msg,    setMsg]    = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
  let active = true
  ;(async () => {
    const { data: { session } } = await supabaseBrowser().auth.getSession()
    if (active && session) router.replace(redirectTo)
  })()
  return () => { active = false }
}, [router, redirectTo])

  useEffect(() => {
    const qsError = sp.get('error');
    if (qsError) setMsg(decodeURIComponent(qsError));
  }, [sp]);

  useEffect(() => {
    if (!cooldown) return;
    const t = setInterval(() => setCooldown(c => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const emailTrimmed = email.trim();
      const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed);
      if (!valid) { setMsg('Enter a valid email address.'); return; }

      const supabase = supabaseBrowser();
      const { error } = await supabase.auth.signInWithOtp({
        email: emailTrimmed,
        options: { shouldCreateUser: true },
      });

      if (error) { setMsg(mapSupabaseError(error)); return; }

      setMsg('We emailed you a 6-digit code. Enter it below.');
      setStage('code');
      setCooldown(30);
    } catch {
      setMsg('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
      const emailTrimmed = email.trim();
      const token = code.trim().replace(/\s/g, '');

      if (!/^\d{6}$/.test(token)) {
        setMsg('Enter the 6-digit code from the email.');
        return;
      }

      const supabase = supabaseBrowser();
      const { data, error } = await supabase.auth.verifyOtp({
        email: emailTrimmed,
        token,
        type: 'email',
      });

      if (error) {
        setMsg(mapSupabaseError(error));
        return;
      }

      if (data?.session) {
        // Try to persist SSR cookies, but DO NOT block redirect if this fails on Vercel.
        try {
          await setServerSession(
            data.session.access_token,
            data.session.refresh_token! // refresh_token is required
          );
        } catch {
          // swallow: client is already logged in; SSR cookie write can be retried on next request
        }

        router.replace(redirectTo);
        router.refresh();
        return;
      }

      setMsg('Could not start a session. Please try again.');
    } catch {
      // Only get here on actual verify failures/network issues.
      setMsg('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function mapSupabaseError(error: { message?: string; status?: number; name?: string }) {
    const m = (error?.message || '').toLowerCase();
    if (m.includes('rate limit') || m.includes('over_email_send_rate_limit')) return 'Too many requests. Try again shortly.';
    if (m.includes('expired')) return 'That code expired. Request a new one.';
    if (m.includes('invalid') && m.includes('token')) return 'Invalid code. Double-check the 6 digits.';
    if (m.includes('forbidden') || m.includes('not allowed')) return 'Sign-ups are disabled for this project.';
    return error.message || 'Unable to continue. Please try again.';
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
          <button type="submit" disabled={loading || !email} className="w-full rounded-lg border p-2 cursor-pointer">
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
          <button type="submit" disabled={loading || !code} className="w-full rounded-lg border p-2 cursor-pointer">
            {loading ? 'Verifying…' : 'Verify & continue'}
          </button>
          <button type="button" onClick={sendCode} disabled={loading || cooldown > 0} className="w-full rounded-lg border p-2 cursor-pointer">
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
          </button>
        </form>
      )}
    </div>
  );
}