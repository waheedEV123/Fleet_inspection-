import type { Inspection } from './types';
import { TYPE_INFO, counts, energyLabel, fmtDate, labelOf, typeOf } from './checklist';

export function emailSubject(r: Inspection) {
  return `${typeOf(r) === 'return' ? 'Vehicle return' : 'Vehicle handover'} ${r.fleet_no ? r.fleet_no + ' / ' : ''}${r.plate} - ${r.damage ? 'DAMAGE OR ISSUES REPORTED' : 'no damage'} - ${fmtDate(r.inspected_at)}`;
}

export function emailText(r: Inspection, link?: string) {
  const c = counts(r);
  const shots = (r.photos || []).filter((p) => !p.kind);
  const marked = (r.photos || []).some((p) => p.kind === 'diagram');
  const lines = [
    `${TYPE_INFO[typeOf(r)].title} ${r.ref}`, '',
    `Fleet no: ${r.fleet_no || '-'}`,
    `Plate: ${r.plate} (${r.emirate || '-'})`,
    `Vehicle: ${r.model || '-'} (${r.powertrain === 'EV' ? 'Electric' : 'Fuel'})`,
    `${TYPE_INFO[typeOf(r)].staff}: ${r.returned_by}${r.staff_id ? ' (ID ' + r.staff_id + ')' : ''}`,
    `Staff contact: ${[r.staff_mobile, r.staff_email].filter(Boolean).join(', ') || '-'}`,
    `Inspected by: ${r.inspector_name || '-'}${r.region ? ' (' + r.region + ')' : ''} on ${fmtDate(r.inspected_at)}`,
    `Odometer: ${r.odometer ?? '-'} km   ${r.powertrain === 'EV' ? 'Battery' : 'Fuel'}: ${energyLabel(r)}`, '',
    `Checklist: ${c.ok} OK, ${c.issue} issue${c.issue === 1 ? '' : 's'}, ${c.na} N/A`,
    `Damage or issues: ${r.damage ? `YES, ${shots.length} photo${shots.length === 1 ? '' : 's'}${marked ? ', marked on the vehicle diagram' : ''}` : 'None found'}`,
  ];
  const iss = Object.entries(r.checks).filter(([, v]) => v === 'issue');
  if (iss.length) { lines.push('', 'Issues:'); iss.forEach(([k]) => lines.push(`- ${labelOf(k)}${r.notes?.[k] ? ': ' + r.notes[k] : ''}`)); }
  if (r.damage) { lines.push('', 'Damage and issue details:'); shots.forEach((p, i) => lines.push(`- Photo ${i + 1}: ${p.area || 'Location not set'}${p.note ? ', ' + p.note : ''}`)); }
  if (r.remarks) lines.push('', `Remarks: ${r.remarks}`);
  if ((r.photos || []).some((p) => p.kind === 'signature')) lines.push('', `Signed by ${r.returned_by} (signature attached).`);
  if (link) lines.push('', `Full report with photos: ${link}`);
  return lines.join('\n');
}
