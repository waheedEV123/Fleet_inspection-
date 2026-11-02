import Link from 'next/link';
import Header from '@/app/components/Header';
import ChartTip from '@/app/components/ChartTip';
import PrintButton from '@/app/components/PrintButton';
import { fmtDate, TYPE_INFO } from '@/lib/checklist';
import { pct, addDays, type Bar, type Dashboard } from '@/lib/dashboard';
import type { Profile } from '@/lib/types';

const nf = new Intl.NumberFormat('en-GB');
const fmtDay = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));

function niceMax(v: number) {
  if (v <= 4) return Math.max(1, v);
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

function BarList({ items, unit, empty }: { items: Bar[]; unit: string; empty: string }) {
  if (!items.length) return <p className="hint" style={{ margin: 0 }}>{empty}</p>;
  const max = Math.max(...items.map((i) => i.value));
  return (
    <ul className="barlist">
      {items.map((i) => (
        <li key={i.label} data-tip={`${i.label}|${nf.format(i.value)} ${unit}${i.sub ? '|' + i.sub : ''}`} tabIndex={0}>
          <span className="bl-label">{i.label}</span>
          <span className="bl-track"><span className="bl-fill" style={{ width: `${(i.value / max) * 100}%` }} /></span>
          <span className="bl-val">{nf.format(i.value)}</span>
        </li>
      ))}
    </ul>
  );
}

type Props = { profile: Profile; d: Dashboard; from: string; to: string; type: '' | 'handover' | 'return'; region: string; regionList: string[]; prevCount: number | null; startISO: string; endISO: string; today: string; failed: boolean };

export default function DashboardView({ profile, d, from, to, type, region, regionList, prevCount, startISO, endISO, today, failed }: Props) {
  const prob = d.damage + d.issuesOnly;
  const delta = prevCount != null && prevCount > 0 ? Math.round(((d.total - prevCount) / prevCount) * 100) : null;

  const qs = (o: Record<string, string>) => {
    const p = new URLSearchParams({ from, to, ...(type ? { type } : {}), ...(region ? { region } : {}), ...o });
    for (const [k, v] of Array.from(p.entries())) if (!v) p.delete(k);
    return `/dashboard?${p.toString()}`;
  };
  const presets = [
    { label: '7 days', from: addDays(today, -6) },
    { label: '30 days', from: addDays(today, -29) },
    { label: '90 days', from: addDays(today, -89) },
    { label: 'This year', from: `${today.slice(0, 4)}-01-01` },
  ];

  const tMax = niceMax(Math.max(1, ...d.trend.map((b) => b.total)));
  const step = Math.ceil(d.trend.length / 6);
  const rateMax = Math.max(10, Math.ceil(Math.max(...d.trend.map((b) => (b.total ? (b.damage / b.total) * 100 : 0))) / 10) * 10);
  const ratePts = d.trend.map((b, i) => ({ b, i, r: b.total ? (b.damage / b.total) * 100 : null }));
  const xOf = (i: number) => (d.trend.length === 1 ? 50 : (i / (d.trend.length - 1)) * 100);
  const line = ratePts.filter((p) => p.r != null).map((p) => `${xOf(p.i)},${100 - (p.r! / rateMax) * 100}`).join(' ');
  const grainWord = d.grain === 'day' ? 'day' : d.grain === 'week' ? 'week' : 'month';

  return (
    <>
      <Header profile={profile} current="dashboard" />
      <main className="dash">
        <form className="dash-filters no-print" method="get">
          <div className="presets" role="group" aria-label="Quick date ranges">
            {presets.map((p) => (
              <Link key={p.label} className="chip" aria-current={from === p.from && to === today ? 'true' : undefined} href={qs({ from: p.from, to: today })}>{p.label}</Link>
            ))}
          </div>
          <label className="f">From<input type="date" name="from" defaultValue={from} /></label>
          <label className="f">To<input type="date" name="to" defaultValue={to} /></label>
          <label className="f">Type
            <select name="type" defaultValue={type}>
              <option value="">All</option>
              <option value="handover">Handover</option>
              <option value="return">Return to staff</option>
            </select>
          </label>
          <label className="f">Region
            <select name="region" defaultValue={region}>
              <option value="">All regions</option>
              {regionList.map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
          <button className="btn primary" type="submit">Apply</button>
        </form>

        <div className="print-head"><h1>Inspection dashboard</h1><span>{fmtDay(startISO)} – {fmtDay(endISO)}</span></div>
        <p className="dash-range">
          <b>{fmtDay(startISO)} – {fmtDay(endISO)}</b>
          {type ? ` · ${TYPE_INFO[type].label}` : ''}{region ? ` · ${region}` : ''}
          <PrintButton />
        </p>
        {failed && <div className="err-box">Some inspections could not be loaded. Refresh the page to try again.</div>}
        {d.truncated && <div className="notice">Showing the latest 20,000 inspections in this range. Choose a shorter range for complete figures.</div>}

        {!d.total ? (
          <div className="empty">No inspections in this range. Choose a wider date range or clear the filters.</div>
        ) : (
          <>
            <section className="kpis">
              <div className="kpi">
                <span>Inspections</span><b>{nf.format(d.total)}</b>
                <small>{delta == null ? `${d.perDay.toFixed(1)} per day` : `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)}% vs previous ${d.days} days`}</small>
              </div>
              <div className="kpi">
                <span>Handover / Return</span><b className="pair">{nf.format(d.handover)} <i>/</i> {nf.format(d.ret)}</b>
                <small>{pct(d.handover, d.total)}% handovers</small>
              </div>
              <div className="kpi bad">
                <span>With damage or issues</span><b>{nf.format(prob)}</b>
                <small>{pct(prob, d.total)}% of inspections · {nf.format(d.damage)} with photos</small>
              </div>
              <div className="kpi">
                <span>Vehicles inspected</span><b>{nf.format(d.vehicles)}</b>
                <small>{nf.format(d.ev)} electric · {nf.format(d.fuel)} fuel</small>
              </div>
              <div className="kpi">
                <span>Returns signed by staff</span><b>{d.ret ? `${pct(d.returnsSigned, d.ret)}%` : '–'}</b>
                <small>{nf.format(d.returnsSigned)} of {nf.format(d.ret)} returns</small>
              </div>
              <div className="kpi">
                <span>Low fuel or battery</span><b>{nf.format(d.lowEnergy)}</b>
                <small>Below 20% battery, or ¼ tank or less</small>
              </div>
            </section>

            <section className="card">
              <div className="card-head">
                <h2>Inspections per {grainWord}</h2>
                <div className="legend">
                  <span><i style={{ background: 'var(--s1)' }} />Handover</span>
                  <span><i style={{ background: 'var(--s2)' }} />Return to staff</span>
                </div>
              </div>
              <div className="colchart" style={{ ['--n' as string]: d.trend.length }}>
                <div className="yaxis">
                  {[1, 0.5, 0].map((f) => <span key={f} style={{ bottom: `${f * 100}%` }}>{nf.format(Math.round(tMax * f))}</span>)}
                </div>
                <div className="plot">
                  {[1, 0.5].map((f) => <div key={f} className="gline" style={{ bottom: `${f * 100}%` }} />)}
                  {d.trend.map((b) => (
                    <div key={b.key} className="col" tabIndex={0}
                      data-tip={`${b.tip}|${nf.format(b.total)} inspections|Handover ${nf.format(b.handover)} · Return ${nf.format(b.ret)}|${nf.format(b.damage)} with damage or issues`}>
                      <div className="stack" style={{ height: `${(b.total / tMax) * 100}%` }}>
                        {b.ret > 0 && <div className="seg s2" style={{ flexGrow: b.ret }} />}
                        {b.handover > 0 && <div className="seg s1" style={{ flexGrow: b.handover }} />}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="xaxis">
                  {d.trend.map((b, i) => <span key={b.key}>{i % step === 0 ? b.label : ''}</span>)}
                </div>
              </div>
            </section>

            <section className="card">
              <div className="card-head">
                <h2>Share with damage or issues, per {grainWord}</h2>
                <span className="hint" style={{ margin: 0 }}>Overall {pct(prob, d.total)}%</span>
              </div>
              <div className="linechart">
                <div className="yaxis">
                  {[1, 0.5, 0].map((f) => <span key={f} style={{ bottom: `${f * 100}%` }}>{Math.round(rateMax * f)}%</span>)}
                </div>
                <div className="plot">
                  {[1, 0.5].map((f) => <div key={f} className="gline" style={{ bottom: `${f * 100}%` }} />)}
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <polyline points={line} fill="none" stroke="var(--bad)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                  </svg>
                  {ratePts.map((p) => p.r != null && (
                    <span key={p.b.key} className="dot" tabIndex={0} style={{ left: `${xOf(p.i)}%`, bottom: `${(p.r / rateMax) * 100}%` }}
                      data-tip={`${p.b.tip}|${Math.round(p.r)}% with damage or issues|${nf.format(p.b.damage)} of ${nf.format(p.b.total)} inspections`} />
                  ))}
                </div>
                <div className="xaxis" style={{ ['--n' as string]: d.trend.length }}>
                  {d.trend.map((b, i) => <span key={b.key}>{i % step === 0 ? b.label : ''}</span>)}
                </div>
              </div>
            </section>

            <div className="dash-grid">
              <section className="card">
                <h2>By region</h2>
                <table className="list">
                  <thead><tr><th>Region</th><th className="num">Inspections</th><th className="num">Handover / Return</th><th className="num">Damage or issues</th></tr></thead>
                  <tbody>
                    {d.regions.map((r) => (
                      <tr key={r.label}>
                        <td>{r.label}</td>
                        <td className="num">{nf.format(r.total)}</td>
                        <td className="num">{nf.format(r.handover)} / {nf.format(r.ret)}</td>
                        <td className="num">{nf.format(r.damage)} <span className="muted">({pct(r.damage, r.total)}%)</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section className="card">
                <h2>Most common checklist issues</h2>
                <BarList items={d.issues} unit="times marked Issue" empty="No checklist issues in this range." />
              </section>

              <section className="card">
                <h2>Where damage is found</h2>
                <BarList items={d.areas} unit="photos" empty="No damage photos in this range." />
              </section>

              <section className="card">
                <h2>Inspector activity</h2>
                <table className="list">
                  <thead><tr><th>Inspector</th><th>Region</th><th className="num">Inspections</th><th className="num">Damage or issues</th></tr></thead>
                  <tbody>
                    {d.inspectors.map((i) => (
                      <tr key={i.name}><td>{i.name}</td><td>{i.region || '–'}</td><td className="num">{nf.format(i.total)}</td><td className="num">{nf.format(i.damage)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section className="card">
                <h2>Vehicles with repeated damage or issues</h2>
                {d.repeatVehicles.length ? (
                  <table className="list">
                    <thead><tr><th>Fleet no.</th><th>Vehicle</th><th className="num">Reports</th><th>Latest</th></tr></thead>
                    <tbody>
                      {d.repeatVehicles.map((v) => (
                        <tr key={v.fleet || v.plate}>
                          <td><Link href={`/history?fleet=${encodeURIComponent(v.fleet)}&from=${from}&to=${to}`}>{v.fleet || '–'}</Link><div className="muted">{v.plate}</div></td>
                          <td>{v.model || '–'}</td>
                          <td className="num"><b>{v.reports}</b></td>
                          <td>{fmtDay(v.last)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <p className="hint" style={{ margin: 0 }}>No vehicle had damage or issues more than once in this range.</p>}
              </section>

              <section className="card">
                <h2>Staff with repeated damage at handover</h2>
                {d.staff.length ? (
                  <table className="list">
                    <thead><tr><th>Staff</th><th>Staff ID</th><th className="num">Reports</th><th>Latest</th></tr></thead>
                    <tbody>
                      {d.staff.map((s) => (
                        <tr key={s.id + s.name}><td>{s.name}</td><td>{s.id || '–'}</td><td className="num"><b>{s.reports}</b></td><td>{fmtDay(s.last)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                ) : <p className="hint" style={{ margin: 0 }}>No staff member handed over a vehicle with damage or issues more than once in this range.</p>}
              </section>
            </div>

            <section className="card">
              <h2>Latest damage and issue reports</h2>
              {d.recent.length ? (
                <div className="recent">
                  {d.recent.map((r) => (
                    <Link key={r.id} href={`/inspections/${r.id}`} className="recent-row">
                      <span className="type-chip">{TYPE_INFO[r.type].label}</span>
                      <span className="recent-main"><b>{r.fleet || r.plate}</b> · {r.staff}<small>{r.issues}</small></span>
                      <span className="muted recent-when">{fmtDate(r.when)}</span>
                    </Link>
                  ))}
                </div>
              ) : <p className="hint" style={{ margin: 0 }}>No damage or issues reported in this range.</p>}
            </section>
          </>
        )}
      </main>
      <ChartTip />
    </>
  );
}

