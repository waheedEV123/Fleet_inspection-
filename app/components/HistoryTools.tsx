'use client';
import { counts, fmtDate, labelOf } from '@/lib/checklist';
import type { Inspection } from '@/lib/types';

export default function HistoryTools({ rows, from, to }: { rows: Inspection[]; from: string; to: string }) {
  function csv() {
    const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['Reference', 'Fleet No', 'Plate', 'Emirate', 'Vehicle', 'Powertrain', 'Inspected at', 'Returned by', 'Staff ID', 'Staff email', 'Inspector', 'Region', 'Odometer km', 'Fuel/Battery', 'OK', 'Issues', 'N/A', 'Damage or issues', 'Photos', 'Issue details', 'Remarks'];
    const lines = rows.map((r) => {
      const c = counts(r);
      const det = Object.entries(r.checks || {}).filter(([, v]) => v === 'issue').map(([k]) => labelOf(k) + (r.notes?.[k] ? ': ' + r.notes[k] : '')).join('; ');
      return [r.ref, r.fleet_no, r.plate, r.emirate, r.model, r.powertrain, fmtDate(r.inspected_at), r.returned_by, r.staff_id, r.staff_email, r.inspector_name, r.region, r.odometer, r.energy, c.ok, c.issue, c.na, r.damage ? 'Yes' : 'No', (r.photos || []).filter((p) => p.kind !== 'diagram').length, det, r.remarks].map(q).join(',');
    });
    const blob = new Blob(['﻿' + [head.map(q).join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `inspections-${from || 'all'}-to-${to || 'today'}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  return (
    <span className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button className="btn" onClick={() => window.print()}>Print list</button>
      <button className="btn" onClick={csv}>Download list (CSV)</button>
    </span>
  );
}
