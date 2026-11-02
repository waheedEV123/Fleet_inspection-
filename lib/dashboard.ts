import { labelOf, typeOf, counts, TYPE_INFO, type InspType } from './checklist';
import type { Inspection } from './types';

// Columns the dashboard needs (keeps the download small).
export const DASH_COLUMNS =
  'id, ref, type, fleet_no, plate, emirate, model, powertrain, returned_by, staff_id, inspector_name, region, inspected_at, checks, notes, damage, photos, energy';

const TZ = 'Asia/Dubai';
const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const fromKey = (k: string) => new Date(`${k}T00:00:00+04:00`);
const addDays = (k: string, n: number) => { const d = fromKey(k); d.setUTCDate(d.getUTCDate() + n); return dayKey(d); };
const short = (k: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, ...opts }).format(fromKey(k));

export type Grain = 'day' | 'week' | 'month';
export type Bucket = { key: string; label: string; tip: string; handover: number; ret: number; total: number; damage: number };
export type Bar = { label: string; value: number; sub?: string; href?: string };
export type Row = Record<string, string | number>;

export type Dashboard = {
  total: number; handover: number; ret: number; damage: number; issuesOnly: number; clear: number;
  vehicles: number; perDay: number; days: number; returnsSigned: number; lowEnergy: number; ev: number; fuel: number;
  grain: Grain; trend: Bucket[];
  regions: { label: string; total: number; handover: number; ret: number; damage: number }[];
  issues: Bar[]; areas: Bar[];
  repeatVehicles: { fleet: string; plate: string; model: string; reports: number; last: string }[];
  staff: { name: string; id: string; reports: number; last: string }[];
  inspectors: { name: string; region: string; total: number; damage: number }[];
  recent: { id: string; ref: string; type: InspType; fleet: string; plate: string; staff: string; when: string; issues: string }[];
  truncated: boolean;
};

const isLow = (r: Inspection) => {
  if (!r.energy) return false;
  if (r.powertrain === 'EV') { const n = Number(r.energy); return !Number.isNaN(n) && n < 20; }
  return r.energy === 'Reserve' || r.energy === '1/4';
};
const hasProblem = (r: Inspection) => r.damage || counts(r).issue > 0;

export function buildDashboard(rows: Inspection[], from: string, to: string, truncated: boolean): Dashboard {
  const days = Math.max(1, Math.round((fromKey(to).getTime() - fromKey(from).getTime()) / 86400000) + 1);
  const grain: Grain = days <= 45 ? 'day' : days <= 200 ? 'week' : 'month';

  // Time buckets, including empty ones so gaps show as zero.
  const bucketOf = (k: string) => {
    if (grain === 'day') return k;
    if (grain === 'month') return k.slice(0, 7);
    const dow = (new Date(`${k}T12:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
    return addDays(k, -dow);
  };
  const order: string[] = [];
  for (let k = from; k <= to; k = addDays(k, 1)) { const b = bucketOf(k); if (order[order.length - 1] !== b) order.push(b); }
  const buckets = new Map<string, Bucket>(order.map((b) => {
    const label = grain === 'day' ? short(b, { day: 'numeric', month: 'short' })
      : grain === 'week' ? short(b, { day: 'numeric', month: 'short' })
      : short(`${b}-01`, { month: 'short', year: '2-digit' });
    const tip = grain === 'day' ? short(b, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
      : grain === 'week' ? `Week of ${short(b, { day: 'numeric', month: 'short', year: 'numeric' })}`
      : short(`${b}-01`, { month: 'long', year: 'numeric' });
    return [b, { key: b, label, tip, handover: 0, ret: 0, total: 0, damage: 0 }];
  }));

  const regions = new Map<string, { label: string; total: number; handover: number; ret: number; damage: number }>();
  const issues = new Map<string, number>();
  const areas = new Map<string, number>();
  const veh = new Map<string, { fleet: string; plate: string; model: string; reports: number; last: string }>();
  const staff = new Map<string, { name: string; id: string; reports: number; last: string }>();
  const insp = new Map<string, { name: string; region: string; total: number; damage: number }>();
  const vehicles = new Set<string>();
  let handover = 0, ret = 0, damage = 0, issuesOnly = 0, returnsSigned = 0, lowEnergy = 0, ev = 0, fuel = 0;

  for (const r of rows) {
    const t = typeOf(r);
    const prob = hasProblem(r);
    const k = dayKey(new Date(r.inspected_at));
    t === 'return' ? ret++ : handover++;
    if (r.damage) damage++; else if (counts(r).issue > 0) issuesOnly++;
    if (t === 'return' && (r.photos || []).some((p) => p.kind === 'signature')) returnsSigned++;
    if (isLow(r)) lowEnergy++;
    r.powertrain === 'EV' ? ev++ : fuel++;
    vehicles.add(r.fleet_no || r.plate);

    const b = buckets.get(bucketOf(k));
    if (b) { t === 'return' ? b.ret++ : b.handover++; b.total++; if (prob) b.damage++; }

    const rg = r.region || 'Not set';
    const R = regions.get(rg) || { label: rg, total: 0, handover: 0, ret: 0, damage: 0 };
    R.total++; t === 'return' ? R.ret++ : R.handover++; if (prob) R.damage++; regions.set(rg, R);

    for (const [key, v] of Object.entries(r.checks || {})) if (v === 'issue') issues.set(key, (issues.get(key) || 0) + 1);
    for (const p of r.photos || []) if (!p.kind) { const a = p.area || 'Location not set'; areas.set(a, (areas.get(a) || 0) + 1); }

    const ins = r.inspector_name || 'Unknown';
    const I = insp.get(ins) || { name: ins, region: r.region || '', total: 0, damage: 0 };
    I.total++; if (prob) I.damage++; insp.set(ins, I);

    if (prob) {
      const vk = r.fleet_no || r.plate;
      const V = veh.get(vk) || { fleet: r.fleet_no, plate: r.plate, model: r.model || '', reports: 0, last: r.inspected_at };
      V.reports++; if (r.inspected_at > V.last) V.last = r.inspected_at; veh.set(vk, V);
      if (t === 'handover' && r.returned_by) {
        const sk = (r.staff_id || r.returned_by).trim().toLowerCase();
        const S = staff.get(sk) || { name: r.returned_by, id: r.staff_id || '', reports: 0, last: r.inspected_at };
        S.reports++; if (r.inspected_at > S.last) S.last = r.inspected_at; staff.set(sk, S);
      }
    }
  }

  const byDesc = <T,>(a: T[], f: (x: T) => number) => a.sort((x, y) => f(y) - f(x));
  const recent = rows.filter(hasProblem).slice(0, 8).map((r) => ({
    id: r.id, ref: r.ref, type: typeOf(r), fleet: r.fleet_no, plate: r.plate, staff: r.returned_by, when: r.inspected_at,
    issues: Object.entries(r.checks || {}).filter(([, v]) => v === 'issue').map(([k]) => labelOf(k)).join(', ') || (r.damage ? 'Damage recorded' : ''),
  }));

  return {
    total: rows.length, handover, ret, damage, issuesOnly, clear: rows.length - damage - issuesOnly,
    vehicles: vehicles.size, perDay: rows.length / days, days, returnsSigned, lowEnergy, ev, fuel,
    grain, trend: order.map((k) => buckets.get(k)!),
    regions: byDesc([...regions.values()], (x) => x.total),
    issues: byDesc([...issues.entries()].map(([k, v]) => ({ label: labelOf(k), value: v })), (x) => x.value).slice(0, 10),
    areas: byDesc([...areas.entries()].map(([k, v]) => ({ label: k, value: v })), (x) => x.value),
    repeatVehicles: byDesc([...veh.values()].filter((v) => v.reports >= 2), (x) => x.reports).slice(0, 10),
    staff: byDesc([...staff.values()].filter((s) => s.reports >= 2), (x) => x.reports).slice(0, 10),
    inspectors: byDesc([...insp.values()], (x) => x.total),
    recent, truncated,
  };
}

export const TYPE_LABEL = (t: InspType) => TYPE_INFO[t].label;
export const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
export { dayKey, addDays };
