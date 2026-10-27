'use client';
import { useState } from 'react';
import Link from 'next/link';
import { LBL, counts, energyLabel, fmtDate, itemsFor, labelOf } from '@/lib/checklist';
import { emailSubject, emailText } from '@/lib/report';
import type { Inspection } from '@/lib/types';

async function toDataUrl(src: string) {
  const b = await (await fetch(src)).blob();
  return await new Promise<string>((res) => { const f = new FileReader(); f.onload = () => res(String(f.result)); f.readAsDataURL(b); });
}

async function buildPdf(r: Inspection, urls: (string | null)[]) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 14;
  let y = 34;
  const need = (h: number) => { if (y + h > 284) { doc.addPage(); y = 16; } };
  doc.setFillColor(24, 34, 45); doc.rect(0, 0, W, 24, 'F'); doc.setFillColor(242, 183, 5); doc.rect(0, 24, W, 2, 'F');
  doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('Vehicle return inspection', M, 11);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(r.ref, M, 18); doc.text(fmtDate(r.inspected_at), W - M, 18, { align: 'right' });
  const c = counts(r);
  const fields: [string, string][] = [
    ['Fleet number', r.fleet_no || '-'], ['Plate', `${r.plate} (${r.emirate || '-'})`],
    ['Vehicle', `${r.model || '-'} (${r.powertrain === 'EV' ? 'Electric' : 'Fuel'})`],
    ['Returned by', `${r.returned_by}${r.staff_id ? ' (ID ' + r.staff_id + ')' : ''}`], ['Staff email', r.staff_email || '-'],
    ['Inspected by', `${r.inspector_name || '-'}${r.region ? ' (' + r.region + ')' : ''}`],
    ['Odometer', `${r.odometer ?? '-'} km`], [r.powertrain === 'EV' ? 'Battery' : 'Fuel', energyLabel(r)],
    ['Checklist', `${c.ok} OK, ${c.issue} issue, ${c.na} N/A`], ['Damage or issues', r.damage ? `Yes, ${r.photos.filter((p) => p.kind !== 'diagram').length} photo(s)${r.photos.some((p) => p.kind === 'diagram') ? ' + diagram' : ''}` : 'None found'],
  ];
  fields.forEach((f, i) => {
    const x = M + (i % 2) * 92; if (i % 2 === 0 && i) y += 12;
    doc.setFontSize(8); doc.setTextColor(91, 103, 115); doc.text(f[0], x, y);
    doc.setFontSize(11); doc.setTextColor(24, 34, 45); doc.text(doc.splitTextToSize(f[1], 88)[0], x, y + 5);
  });
  y += 16;
  const iss = Object.entries(r.checks).filter(([, v]) => v === 'issue');
  if (iss.length) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(183, 40, 31); doc.text('Issues', M, y); y += 6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(24, 34, 45);
    iss.forEach(([k]) => { const t = doc.splitTextToSize(`- ${labelOf(k)}${r.notes?.[k] ? ': ' + r.notes[k] : ''}`, W - 2 * M); need(t.length * 5); doc.text(t, M, y); y += t.length * 5; });
    y += 4;
  }
  itemsFor(r.powertrain).forEach((g) => {
    need(12); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(24, 34, 45); doc.text(g.group, M, y); y += 2;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
    g.items.forEach(({ key, label }) => {
      need(6); y += 5; doc.setTextColor(24, 34, 45); doc.text(label, M + 2, y);
      const s = r.checks[key];
      const col: [number, number, number] = s === 'ok' ? [30, 127, 69] : s === 'issue' ? [183, 40, 31] : [95, 105, 117];
      doc.setTextColor(...col); doc.text(LBL[s] || '-', W - M, y, { align: 'right' });
      doc.setDrawColor(220); doc.line(M, y + 1.5, W - M, y + 1.5);
    });
    y += 7;
  });
  if (r.remarks) {
    need(14); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(24, 34, 45); doc.text('Remarks', M, y); y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); const t = doc.splitTextToSize(r.remarks, W - 2 * M); need(t.length * 5); doc.text(t, M, y); y += t.length * 5 + 4;
  }
  const fit = (w: number, h: number, maxW: number, maxH: number) => { const k = Math.min(maxW / (w || 4), maxH / (h || 3)); return { w: (w || 4) * k, h: (h || 3) * k }; };
  const dIdx = r.photos.findIndex((p) => p.kind === 'diagram');
  if (r.damage && dIdx >= 0) {
    doc.addPage(); y = 16; doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(24, 34, 45); doc.text('Marked on the vehicle', M, y); y += 6;
    const p = r.photos[dIdx]; const sz = fit(p.w, p.h, W - 2 * M, 250);
    let data: string | null = null; try { if (urls[dIdx]) data = await toDataUrl(urls[dIdx]!); } catch {}
    if (data) doc.addImage(data, 'JPEG', (W - sz.w) / 2, y, sz.w, sz.h);
    else { doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text('Diagram unavailable', M, y + 6); }
  }
  const shots = r.photos.map((p, j) => ({ p, j })).filter(({ p }) => p.kind !== 'diagram');
  if (r.damage && shots.length) {
    doc.addPage(); y = 16; doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(24, 34, 45); doc.text('Photos of damage and issues', M, y); y += 6;
    const colW = 88;
    for (let i = 0; i < shots.length; i += 2) {
      let rowH = 0;
      const imgs: { n: number; j: number; data: string | null; w: number; h: number }[] = [];
      for (const n of [i, i + 1].filter((v) => v < shots.length)) {
        const { p, j } = shots[n]; let data: string | null = null;
        try { if (urls[j]) data = await toDataUrl(urls[j]!); } catch {}
        const sz = fit(p.w, p.h, colW, 90);
        imgs.push({ n, j, data, w: sz.w, h: sz.h }); rowH = Math.max(rowH, sz.h + 14);
      }
      need(rowH);
      imgs.forEach((o, k) => {
        const x = M + k * (colW + 6); const p = r.photos[o.j];
        if (o.data) doc.addImage(o.data, 'JPEG', x, y, o.w, o.h);
        else { doc.setDrawColor(200); doc.rect(x, y, colW, o.h); doc.setFontSize(9); doc.text('Photo unavailable', x + 4, y + 8); }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(24, 34, 45); doc.text(`${o.n + 1}. ${p.area || 'Location not set'}`, x, y + o.h + 5);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); if (p.note) doc.text(doc.splitTextToSize(p.note, colW)[0], x, y + o.h + 10);
      });
      y += rowH + 2;
    }
  }
  doc.save(`${r.ref}.pdf`);
}

export default function ReportActions({ inspection: r, photoUrls, managerEmail, cc, justSaved, isAdmin }: {
  inspection: Inspection; photoUrls: (string | null)[]; managerEmail: string; cc: string; justSaved: boolean; isAdmin: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(justSaved ? 'Inspection saved.' : '');
  const link = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
  const to = [managerEmail, r.staff_email].filter(Boolean).join(',');
  const mail = to
    ? `mailto:${to}?${cc ? 'cc=' + encodeURIComponent(cc) + '&' : ''}subject=${encodeURIComponent(emailSubject(r))}&body=${encodeURIComponent(emailText(r, link))}`
    : '';
  const mailLabel = managerEmail && r.staff_email ? 'Email fleet manager and staff' : managerEmail ? `Email ${managerEmail}` : 'Email staff';

  async function pdf() {
    setBusy(true);
    try { await buildPdf(r, photoUrls); } catch { setMsg('The PDF could not be created. Try again.'); }
    setBusy(false);
  }

  return (
    <>
      {msg && <div className="notice no-print" role="status">{msg}</div>}
      <div className="card no-print">
        <h2>Print or share</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn primary" onClick={() => window.print()}>Print report</button>
          <button className="btn" onClick={pdf} disabled={busy}>{busy ? 'Preparing PDF…' : 'Download PDF report'}</button>
          {mail && <a className="btn warn" href={mail}>{mailLabel}</a>}
        </div>
        {!managerEmail && (
          <p className="hint" style={{ margin: '10px 0 0' }}>
            No fleet manager email is set.{isAdmin ? ' Add it in Settings.' : ' Ask the administrator to add it.'}
          </p>
        )}
      </div>
      <div className="no-print" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '0 0 14px' }}>
        <Link className="btn primary" href="/">Start new inspection</Link>
        <Link className="btn" href="/history">Back to history</Link>
      </div>
    </>
  );
}
