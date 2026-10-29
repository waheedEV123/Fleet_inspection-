import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { emailSubject, emailText } from '@/lib/report';
import type { Inspection } from '@/lib/types';

// Emails the inspection to the fleet manager and the staff member through Resend, with the photos attached.
// Skips quietly when RESEND_API_KEY or the manager email is not set.
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ sent: false, reason: 'signed_out' }, { status: 401 });

  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return NextResponse.json({ sent: false, reason: 'email_not_configured' });

  const { id } = await request.json().catch(() => ({ id: null }));
  if (!id) return NextResponse.json({ sent: false, reason: 'missing_id' }, { status: 400 });

  const { data } = await supabase.from('inspections').select('*').eq('id', id).maybeSingle();
  if (!data) return NextResponse.json({ sent: false, reason: 'not_found' }, { status: 404 });
  const r = data as Inspection;
  if (r.inspector_email && r.inspector_email !== user.email) {
    return NextResponse.json({ sent: false, reason: 'not_yours' }, { status: 403 });
  }

  const { data: settings } = await supabase.from('settings').select('manager_email, cc').eq('id', 1).maybeSingle();
  const recipients = [settings?.manager_email, r.staff_email].filter(Boolean) as string[];
  if (!recipients.length) return NextResponse.json({ sent: false, reason: 'no_recipients' });

  const attachments: { filename: string; content: string }[] = [];
  for (let i = 0; i < (r.photos || []).length; i++) {
    const { data: file } = await supabase.storage.from('damage-photos').download(r.photos[i].path);
    if (file) attachments.push({ filename: r.photos[i].kind ? `${r.ref}-${r.photos[i].kind}.jpg` : `${r.ref}-photo-${i + 1}.jpg`, content: Buffer.from(await file.arrayBuffer()).toString('base64') });
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: recipients,
      cc: settings?.cc ? settings.cc.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined,
      subject: emailSubject(r),
      text: emailText(r, `${site}/inspections/${r.id}`),
      attachments: attachments.length ? attachments : undefined,
    }),
  });
  if (!res.ok) return NextResponse.json({ sent: false, reason: 'provider_error', detail: await res.text() }, { status: 502 });
  return NextResponse.json({ sent: true });
}
