import type { Inspection, Status } from './types';

export type Group = { id: string; group: string; items: { key: string; label: string; evOnly?: boolean }[] };

export const CHECKLIST: Group[] = [
  { id: 'ext', group: 'Exterior', items: [
    { key: 'body', label: 'Body panels and paint' },
    { key: 'bumpers', label: 'Front and rear bumpers' },
    { key: 'glass', label: 'Windscreen and windows' },
    { key: 'mirrors', label: 'Side mirrors' },
    { key: 'lights', label: 'Headlights, indicators and brake lights' },
    { key: 'tyres', label: 'Tyres (tread and pressure)' },
    { key: 'wheels', label: 'Wheels and rims' },
  ] },
  { id: 'int', group: 'Interior', items: [
    { key: 'seats', label: 'Seats and upholstery' },
    { key: 'warn', label: 'Dashboard warning lights' },
    { key: 'ac', label: 'Air conditioning' },
    { key: 'horn', label: 'Horn and wipers' },
    { key: 'clean', label: 'Cleanliness' },
  ] },
  { id: 'doc', group: 'Documents and equipment', items: [
    { key: 'mulkiya', label: 'Registration card (Mulkiya)' },
    { key: 'card', label: 'Fuel or charging card, Salik tag' },
    { key: 'spare', label: 'Spare tyre or repair kit, jack' },
    { key: 'extg', label: 'Fire extinguisher' },
    { key: 'firstaid', label: 'First aid kit' },
    { key: 'triangle', label: 'Warning triangle' },
    { key: 'cable', label: 'Charging cable', evOnly: true },
  ] },
  { id: 'keys', group: 'Keys', items: [{ key: 'keys', label: 'Keys and remote' }] },
];

export const LBL: Record<Status, string> = { ok: 'OK', issue: 'Issue', na: 'N/A' };
export const AREAS = ['Front', 'Rear', 'Left side', 'Right side', 'Roof', 'Windscreen or glass', 'Wheels or tyres', 'Interior', 'Other'];
export const FUEL = ['Full', '3/4', '1/2', '1/4', 'Reserve'];
export const EMIRATES = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'RAK', 'Fujairah', 'UAQ'];

export const itemsFor = (pt: string) =>
  CHECKLIST.map((g) => ({ ...g, items: g.items.filter((i) => !i.evOnly || pt === 'EV') }));

export const labelOf = (k: string) => {
  for (const g of CHECKLIST) for (const i of g.items) if (i.key === k) return i.label;
  return k;
};

export function counts(r: Pick<Inspection, 'checks'>) {
  const v = Object.values(r.checks || {});
  return { ok: v.filter((x) => x === 'ok').length, issue: v.filter((x) => x === 'issue').length, na: v.filter((x) => x === 'na').length };
}

export const normFleet = (v: unknown) => String(v ?? '').trim().toUpperCase();
export const normPt = (v: unknown): 'EV' | 'Fuel' => (/\b(ev|bev|electric)\b|tesla/i.test(String(v ?? '')) ? 'EV' : 'Fuel');

const EMIRATE_ALIASES: Record<string, string> = {
  DUBAI: 'Dubai', DXB: 'Dubai', 'ABU DHABI': 'Abu Dhabi', AD: 'Abu Dhabi', AUH: 'Abu Dhabi', SHARJAH: 'Sharjah', SHJ: 'Sharjah',
  AJMAN: 'Ajman', AJM: 'Ajman', RAK: 'RAK', 'RAS AL KHAIMAH': 'RAK', FUJAIRAH: 'Fujairah', FUJ: 'Fujairah', UAQ: 'UAQ', 'UMM AL QUWAIN': 'UAQ',
};
export const normEmirate = (v: unknown) => EMIRATE_ALIASES[String(v ?? '').trim().toUpperCase()] || String(v ?? '').trim();

// Phone number used as the password: digits only, without +971 / 00971 / leading 0.
export function normPhone(v: unknown) {
  let d = String(v ?? '').replace(/\D/g, '');
  if (d.startsWith('00971')) d = d.slice(5);
  else if (d.startsWith('971')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  return d;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const fmtDate = (s: string | Date) => {
  const d = new Date(s);
  if (isNaN(+d)) return '';
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' });
};
export const localISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const makeRef = (fleet: string, d: Date) =>
  `INS-${fleet.replace(/[^A-Z0-9]/g, '')}-${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
export const energyLabel = (r: Pick<Inspection, 'powertrain' | 'energy'>) =>
  `${r.energy || '-'}${r.powertrain === 'EV' && r.energy ? '%' : ''}`;
