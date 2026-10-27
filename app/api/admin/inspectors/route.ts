import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { normPhone } from '@/lib/checklist';

// Adds an inspector, or updates their details and password if the email already exists. Admins only.
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in again.' }, { status: 401 });
  const { data: me } = await supabase.from('profiles').select('role, active').eq('id', user.id).maybeSingle();
  if (me?.role !== 'admin' || !me.active) return NextResponse.json({ error: 'Only administrators can add inspectors.' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const region = String(body.region || '').trim();
  const password = normPhone(body.phone);
  const role = body.role === 'admin' ? 'admin' : 'inspector';
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: 'Enter a name and a valid email.' }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: 'Enter the mobile number, for example 501234567.' }, { status: 400 });

  const admin = createAdminClient();
  const { data: existing } = await admin.from('profiles').select('id').eq('email', email).maybeSingle();
  let id = existing?.id as string | undefined;
  if (id) {
    const { error } = await admin.auth.admin.updateUserById(id, { password });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) return NextResponse.json({ error: error?.message || 'Could not create the account.' }, { status: 400 });
    id = data.user.id;
  }
  const { error: pErr } = await admin.from('profiles').upsert({ id, name, email, region: region || null, role, active: true });
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });
  return NextResponse.json({ ok: true, updated: !!existing });
}
