import { redirect } from 'next/navigation';
import DashboardView from './DashboardView';
import { requireProfile } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { DASH_COLUMNS, buildDashboard, dayKey, addDays } from '@/lib/dashboard';
import type { Inspection } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({ searchParams }: { searchParams: { from?: string; to?: string; type?: string; region?: string } }) {
  const profile = await requireProfile();
  if (profile.role !== 'admin') redirect('/');

  const today = dayKey(new Date());
  const valid = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);
  let to = valid(searchParams.to) ?? today;
  let from = valid(searchParams.from) ?? addDays(to, -29);
  if (from > to) [from, to] = [to, from];
  const type = searchParams.type === 'handover' || searchParams.type === 'return' ? searchParams.type : '';
  const region = searchParams.region || '';

  const supabase = createClient();
  const startISO = new Date(`${from}T00:00:00+04:00`).toISOString();
  const endISO = new Date(`${to}T23:59:59.999+04:00`).toISOString();

  const rows: Inspection[] = [];
  const LIMIT = 20000;
  let failed = false;
  for (let off = 0; off < LIMIT; off += 1000) {
    let q = supabase.from('inspections').select(DASH_COLUMNS).gte('inspected_at', startISO).lte('inspected_at', endISO)
      .order('inspected_at', { ascending: false }).range(off, off + 999);
    if (type) q = q.eq('type', type);
    if (region) q = q.eq('region', region);
    const { data, error } = await q;
    if (error) { failed = true; break; }
    rows.push(...((data || []) as unknown as Inspection[]));
    if (!data || data.length < 1000) break;
  }

  // Same-length period just before, for comparison.
  const span = Math.round((new Date(endISO).getTime() - new Date(startISO).getTime()) / 86400000);
  const prevFrom = addDays(from, -(span + 1)), prevTo = addDays(from, -1);
  let pq = supabase.from('inspections').select('id', { count: 'exact', head: true })
    .gte('inspected_at', new Date(`${prevFrom}T00:00:00+04:00`).toISOString())
    .lte('inspected_at', new Date(`${prevTo}T23:59:59.999+04:00`).toISOString());
  if (type) pq = pq.eq('type', type);
  if (region) pq = pq.eq('region', region);
  const { count: prevCount } = await pq;

  const { data: regionRows } = await supabase.from('profiles').select('region');
  const regionList = Array.from(new Set((regionRows || []).map((r: { region: string | null }) => r.region).filter(Boolean) as string[])).sort();

  const d = buildDashboard(rows, from, to, rows.length >= LIMIT);
  return <DashboardView profile={profile} d={d} from={from} to={to} type={type} region={region} regionList={regionList} prevCount={prevCount ?? null} startISO={startISO} endISO={endISO} today={today} failed={failed} />;
}
