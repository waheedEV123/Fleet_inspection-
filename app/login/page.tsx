'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { normPhone } from '@/lib/checklist';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('error') === 'noaccess') {
      setErr('Your account does not have access. Contact the Fleet Command Centre.');
      createClient().auth.signOut();
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    const em = email.trim().toLowerCase();
    if (!em || !pass.trim()) return setErr('Enter your email and password.');
    setBusy(true);
    const supabase = createClient();
    // Inspectors use their mobile number as the password; accept it with or without +971 / 0.
    const tries = Array.from(new Set([normPhone(pass), pass.trim()])).filter(Boolean);
    let ok = false;
    let lastError = '';
    for (const p of tries) {
      try {
        const { error } = await supabase.auth.signInWithPassword({ email: em, password: p });
        if (!error) { ok = true; break; }
        lastError = error.message || String(error);
      } catch (e: any) {
        lastError = e?.message || String(e);
      }
    }
    setBusy(false);
    if (!ok) {
      if (/invalid login credentials/i.test(lastError)) return setErr('Email or password is incorrect. Your password is your mobile number starting with 5.');
      return setErr(`Sign in failed: ${lastError || 'no response from the server'}. Contact the Fleet Command Centre.`);
    }
    router.replace('/');
    router.refresh();
  }

  return (
    <>
      <header className="top">
        <div className="top-inner" style={{ paddingBottom: 14 }}>
          <h1>Vehicle inspection</h1>
          <p style={{ marginBottom: 0 }}>Fleet Command Centre</p>
        </div>
      </header>
      <main>
        <form className="card login" onSubmit={submit} noValidate>
          <h2>Inspector sign in</h2>
          <p className="hint">Use your e&amp; email. Your password is your mobile number starting with 5, without +971 or 0 (for example 501234567).</p>
          <div className="grid">
            <label className="f full">Email
              <input type="email" autoComplete="username" placeholder="name@eand.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="f full">Password
              <input type="password" inputMode="numeric" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} />
            </label>
          </div>
          <p className="err" role="alert">{err}</p>
          <button className="btn primary" type="submit" style={{ width: '100%' }} disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </main>
    </>
  );
}
