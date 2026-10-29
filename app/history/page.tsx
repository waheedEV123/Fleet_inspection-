import Link from 'next/link';
import Header from '@/app/components/Header';
import HistoryTools from '@/app/components/HistoryTools';
import { requireProfile } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { TYPE_INFO, counts, fmtDate, normFleet, typeOf, ymd } from '@/lib/checklist';
import type { Inspection } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function HistoryPage({ searchParams }: { searchParams: { fleet?: string; from?: string; to?: string; type?: string } }) {
  const profile = await requireProfile();
  const today = new Date();
  const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30);
  const fleet = normFleet(searchParams.fleet);
  const from = searchParams.from ?? ymd(monthAgo);
  const to = searchParams.to ?? ymd(today);
  const type = searchParams.type === 'handover' || searchParams.type === 'return' ? searchParams.type : '';

  const supabase = createClient();
  let q = supabase.from('inspections').select('*').order('inspected_at', { ascending: false }).limit(1000);
  if (fleet) q = q.eq('fleet_no', fleet);
  if (type) q = q.eq('type', type);
  // Dates are entered in UAE time (UTC+4).
  if (from) q = q.gte('inspected_at', new Date(`${from}T00:00:00+04:00`).toISOString());
  if (to) q = q.lte('inspected_at', new Date(`${to}T23:59:59.999+04:00`).toISOString());
  const { data, error } = await q;
  const rows = (data || []) as Inspection[];

  return (
    <>
      <Header profile={profile} current="history" />
      <main>
        <form className="card no-print" method="get">
          <h2>Find inspection reports</h2>
          <div className="filters">
            <label className="f fl">Fleet number (leave blank for all)<input name="fleet" defaultValue={fleet} autoComplete="off" style={{ textTransform: 'uppercase' }} /></label>
            <label className="f ty">Type
              <select name="type" defaultValue={type}>
                <option value="">All</option>
                <option value="handover">Handover</option>
                <option value="return">Return to staff</option>
              </select>
            </label>
            <label className="f">From<input name="from" type="date" defaultValue={from} /></label>
            <label className="f">To<input name="to" type="date" defaultValue={to} /></label>
            <button className="btn primary go" type="submit">Search</button>
          </div>
        </form>
        <div className="print-head"><h1>Vehicle inspection reports</h1><span>{type ? `${TYPE_INFO[type].label}, ` : ''}{fleet ? `Fleet ${fleet}, ` : ''}{from || 'start'} to {to || 'today'}</span></div>
        {error && <div className="err-box">The search failed. Refresh the page to try again.</div>}
        {rows.length > 0 && (
          <div className="resbar">
            <b>{rows.length} inspection{rows.length === 1 ? '' : 's'}{rows.length === 1000 ? ' (showing the latest 1000)' : ''}</b>
            <HistoryTools rows={rows} from={from} to={to} />
          </div>
        )}
        {rows.length ? rows.map((r) => {
          const c = counts(r);
          return (
            <Link className="hist-row" key={r.id} href={`/inspections/${r.id}`}>
              <span className="plate-show"><span>{r.emirate || '-'}</span><span>{r.plate}</span></span>
              <span className="who">
                <b>{TYPE_INFO[typeOf(r)].label}: {r.fleet_no || 'No fleet no.'}, {r.returned_by}</b>
                <small>{fmtDate(r.inspected_at)}{r.model ? `, ${r.model}` : ''}{r.inspector_name ? `, by ${r.inspector_name}` : ''}</small>
              </span>
              <span className={`badge ${r.damage || c.issue ? 'bad' : 'ok'}`}>{r.damage ? 'Damage/issues' : c.issue ? 'Issues' : 'Clear'}</span>
            </Link>
          );
        }) : !error && <div className="empty">No inspections match. Try a wider date range or clear the fleet number.</div>}
      </main>
    </>
  );
}
