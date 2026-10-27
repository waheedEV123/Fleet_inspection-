import { notFound } from 'next/navigation';
import Header from '@/app/components/Header';
import ReportActions from '@/app/components/ReportActions';
import { requireProfile } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { LBL, counts, energyLabel, fmtDate, itemsFor, labelOf } from '@/lib/checklist';
import type { Inspection } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ReportPage({ params, searchParams }: { params: { id: string }; searchParams: { saved?: string } }) {
  const profile = await requireProfile();
  const supabase = createClient();
  const { data } = await supabase.from('inspections').select('*').eq('id', params.id).maybeSingle();
  if (!data) notFound();
  const r = data as Inspection;
  const { data: settings } = await supabase.from('settings').select('manager_email, cc').eq('id', 1).maybeSingle();

  const urls: (string | null)[] = [];
  if (r.photos?.length) {
    const { data: signed } = await supabase.storage.from('damage-photos').createSignedUrls(r.photos.map((p) => p.path), 60 * 60);
    r.photos.forEach((_, i) => urls.push(signed?.[i]?.signedUrl ?? null));
  }

  const c = counts(r);
  const indexed = (r.photos || []).map((p, i) => ({ p, i }));
  const diagram = indexed.filter(({ p }) => p.kind === 'diagram');
  const shots = indexed.filter(({ p }) => p.kind !== 'diagram');
  const iss = Object.entries(r.checks).filter(([, v]) => v === 'issue');

  return (
    <>
      <Header profile={profile} current="report" />
      <main>
        <div className="print-head"><h1>Vehicle return inspection</h1><span>{r.ref}</span></div>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div className="plate-show"><span>{r.emirate || '-'}</span><span>{r.plate}</span></div>
            <span className={`badge ${r.damage || c.issue ? 'bad' : 'ok'}`}>
              {r.damage ? 'Damage or issues reported' : c.issue ? `${c.issue} issue${c.issue > 1 ? 's' : ''} found` : 'All clear'}
            </span>
          </div>
          <div className="meta">
            <div><span>Fleet number</span><b>{r.fleet_no || '-'}</b></div>
            <div><span>Reference</span><b>{r.ref}</b></div>
            <div><span>Vehicle</span><b>{r.model || '-'} ({r.powertrain === 'EV' ? 'Electric' : 'Fuel'})</b></div>
            <div><span>Returned by</span><b>{r.returned_by}{r.staff_id ? ` (${r.staff_id})` : ''}</b></div>
            <div><span>Staff email</span><b style={{ wordBreak: 'break-all' }}>{r.staff_email || '-'}</b></div>
            <div><span>Inspected by</span><b>{r.inspector_name || '-'}{r.region ? ` (${r.region})` : ''}</b></div>
            <div><span>Date and time</span><b>{fmtDate(r.inspected_at)}</b></div>
            <div><span>Odometer</span><b>{r.odometer ?? '-'} km</b></div>
            <div><span>{r.powertrain === 'EV' ? 'Battery' : 'Fuel'}</span><b>{energyLabel(r)}</b></div>
            <div><span>Checklist</span><b>{c.ok} OK, {c.issue} issue, {c.na} N/A</b></div>
          </div>
        </div>

        <ReportActions inspection={r} photoUrls={urls} managerEmail={settings?.manager_email || ''} cc={settings?.cc || ''} justSaved={searchParams.saved === '1'} isAdmin={profile.role === 'admin'} />

        {iss.length > 0 && (
          <div className="card">
            <h2>Issues</h2>
            <ul className="issues">
              {iss.map(([k]) => <li key={k}><b>{labelOf(k)}</b>{r.notes?.[k] && <small>{r.notes[k]}</small>}</li>)}
            </ul>
          </div>
        )}

        {r.damage && diagram.length > 0 && (
          <div className="card">
            <h2>Marked on the vehicle</h2>
            {diagram.map(({ p, i }) => (
              <div className="diagram-img" key={p.path}>
                {urls[i]
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={urls[i]!} alt="Vehicle diagram with damage marked in red" />
                  : <div className="empty">Diagram not available</div>}
              </div>
            ))}
          </div>
        )}

        {r.damage && shots.length > 0 && (
          <div className="card">
            <h2>Photos of damage and issues</h2>
            <div className="photos">
              {shots.map(({ p, i }, n) => (
                <div className="tile" key={p.path}>
                  {urls[i]
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={urls[i]!} alt={`Photo ${n + 1}`} loading="lazy" />
                    : <div className="empty">Photo not available</div>}
                  <div className="tb"><p><b>{p.area || 'Location not set'}</b></p>{p.note && <p>{p.note}</p>}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card">
          <h2>Full checklist</h2>
          {itemsFor(r.powertrain).map((g) => (
            <fieldset className="group" key={g.id}>
              <legend>{g.group}</legend>
              <ul className="chk">
                {g.items.map(({ key, label }) => (
                  <li key={key}><span>{label}</span><span className={`s-${r.checks[key]}`}>{LBL[r.checks[key]] || '-'}</span></li>
                ))}
              </ul>
            </fieldset>
          ))}
        </div>
        {r.remarks && <div className="card"><h2>Remarks</h2><p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{r.remarks}</p></div>}
      </main>
    </>
  );
}
