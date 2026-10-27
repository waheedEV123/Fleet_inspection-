'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AREAS, EMIRATES, FUEL, LBL, fmtDate, itemsFor, localISO, makeRef, normFleet, normPt } from '@/lib/checklist';
import type { Status, Vehicle } from '@/lib/types';
import DamageDiagram from './DamageDiagram';
import { renderDiagram, type Stroke } from '@/lib/carDiagram';

type DraftPhoto = { blob: Blob; url: string; w: number; h: number; area: string; note: string };

const empty = () => ({
  fleetNo: '', plate: '', emirate: 'Dubai', model: '', powertrain: 'Fuel' as 'Fuel' | 'EV',
  returnedBy: '', staffId: '', staffEmail: '', odometer: '', energy: '', inspectedAt: localISO(new Date()), remarks: '',
});

function loadImg(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

// Shrinks the photo and stamps the plate number and time on it as evidence.
async function compress(file: File, plate: string) {
  const src = URL.createObjectURL(file);
  try {
    const img = await loadImg(src);
    const s = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    const x = c.getContext('2d')!;
    x.drawImage(img, 0, 0, c.width, c.height);
    const band = Math.max(28, Math.round(c.height * 0.05));
    x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(0, c.height - band, c.width, band);
    x.fillStyle = '#fff'; x.font = `600 ${Math.round(band * 0.5)}px Arial, sans-serif`; x.textBaseline = 'middle';
    x.fillText(`${plate.toUpperCase()}   ${fmtDate(new Date())}`, 12, c.height - band / 2);
    const blob = await new Promise<Blob>((r, j) => c.toBlob((b) => (b ? r(b) : j(new Error('blob'))), 'image/jpeg', 0.82));
    return { blob, url: URL.createObjectURL(blob), w: c.width, h: c.height };
  } finally {
    URL.revokeObjectURL(src);
  }
}

export default function InspectionForm({ inspectorName, region }: { inspectorName: string; region: string | null }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [f, setF] = useState(empty);
  const [checks, setChecks] = useState<Record<string, Status>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [damage, setDamage] = useState<boolean | null>(null);
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [vehicles, setVehicles] = useState<Record<string, Vehicle>>({});
  const [vehLoaded, setVehLoaded] = useState(false);
  const [lookup, setLookup] = useState<{ text: string; cls: string }>({ text: '', cls: '' });
  const [toast, setToast] = useState<{ msg: string; bad?: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const noteRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const groups = itemsFor(f.powertrain);
  const allItems = groups.flatMap((g) => g.items);
  const done = allItems.filter((i) => checks[i.key]).length;

  function say(msg: string, bad = false) {
    setToast({ msg, bad });
    window.clearTimeout((say as any)._t);
    (say as any)._t = window.setTimeout(() => setToast(null), 3500);
  }

  // Load the whole vehicle list once (paged, Supabase returns 1,000 rows per request).
  useEffect(() => {
    (async () => {
      const map: Record<string, Vehicle> = {};
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from('vehicles').select('*').order('fleet_no').range(from, from + 999);
        if (error || !data) break;
        data.forEach((v: Vehicle) => (map[v.fleet_no] = v));
        if (data.length < 1000) break;
      }
      setVehicles(map);
      setVehLoaded(true);
    })();
  }, [supabase]);

  function set<K extends keyof ReturnType<typeof empty>>(k: K, v: ReturnType<typeof empty>[K]) {
    setF((p) => ({ ...p, [k]: v }));
  }

  function setPowertrain(pt: 'Fuel' | 'EV') {
    setF((p) => ({ ...p, powertrain: pt, energy: '' }));
    if (pt !== 'EV') setChecks((c) => { const n = { ...c }; delete n.cable; return n; });
  }

  function onFleet(v: string) {
    set('fleetNo', v);
    const key = normFleet(v);
    if (!key) return setLookup({ text: '', cls: '' });
    const veh = vehicles[key];
    if (!veh) {
      return setLookup({
        text: Object.keys(vehicles).length ? 'Not in the vehicle list. Enter the details below.' : vehLoaded ? 'The vehicle list is empty. Ask the administrator to import it.' : 'Loading vehicle list…',
        cls: 'miss',
      });
    }
    setLookup({ text: `Found: ${veh.model || 'Vehicle'}, ${veh.emirate || ''} ${veh.plate || ''}`, cls: 'found' });
    const pt = veh.powertrain === 'EV' || normPt(veh.model) === 'EV' ? 'EV' : 'Fuel';
    setF((p) => ({ ...p, fleetNo: v, plate: veh.plate || '', emirate: veh.emirate || p.emirate, model: veh.model || '', powertrain: pt, energy: pt === p.powertrain ? p.energy : '' }));
  }

  function setCheck(key: string, s: Status, groupId: string) {
    setChecks((c) => ({ ...c, [key]: s }));
    if (s === 'issue') {
      setTimeout(() => noteRefs.current[key]?.focus(), 0);
      if ((groupId === 'ext' || groupId === 'int') && damage === null) setDamage(true);
    }
  }

  function chooseDamage(v: boolean) {
    if (!v && (photos.length || strokes.length) && !confirm('Remove the photos and marks you added?')) return;
    if (!v) { setPhotos([]); setStrokes([]); }
    setDamage(v);
  }

  async function addFiles(files: FileList | null, input: HTMLInputElement) {
    if (!files) return;
    const added: DraftPhoto[] = [];
    for (const file of Array.from(files)) {
      try { added.push({ ...(await compress(file, f.plate)), area: '', note: '' }); }
      catch { say('That file could not be read as a photo.', true); }
    }
    input.value = '';
    setPhotos((p) => [...p, ...added]);
  }

  function validate(): [string, string] | null {
    if (!f.fleetNo.trim()) return ['Enter the fleet number.', '#fleetInput'];
    if (!f.plate.trim()) return ['Enter the plate number.', '#plateInput'];
    if (!f.returnedBy.trim()) return ['Enter who returned the vehicle.', '#returnedBy'];
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.staffEmail.trim())) return ['Enter the staff member\'s email so they receive the report.', '#staffEmail'];
    if (!String(f.odometer).trim()) return ['Enter the odometer reading.', '#odometer'];
    const missing = allItems.filter((i) => !checks[i.key]);
    if (missing.length) return [`${missing.length} checklist item${missing.length > 1 ? 's' : ''} still need${missing.length > 1 ? '' : 's'} a result.`, `[data-key="${missing[0].key}"]`];
    if (damage === null) return ['Answer whether there is any damage or issue.', '#dmgSeg'];
    if (damage && !photos.length) return ['Add at least one photo of the damage or issue.', '#btnCamera'];
    return null;
  }

  async function save() {
    const err = validate();
    if (err) {
      say(err[0], true);
      const el = document.querySelector<HTMLElement>(err[1]);
      el?.scrollIntoView({ block: 'center' }); el?.focus?.();
      return;
    }
    setSaving(true);
    try {
      const id = crypto.randomUUID();
      const stored: { path: string; area: string; note: string; w: number; h: number; kind?: 'diagram' }[] = [];
      if (strokes.length) {
        const dg = await renderDiagram(strokes);
        const path = `${id}/diagram.jpg`;
        const { error } = await supabase.storage.from('damage-photos').upload(path, dg.blob, { contentType: 'image/jpeg' });
        if (error) throw error;
        stored.push({ path, area: 'Damage diagram', note: '', w: dg.w, h: dg.h, kind: 'diagram' });
      }
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        const path = `${id}/${i + 1}.jpg`;
        const { error } = await supabase.storage.from('damage-photos').upload(path, p.blob, { contentType: 'image/jpeg' });
        if (error) throw error;
        stored.push({ path, area: p.area, note: p.note, w: p.w, h: p.h });
      }
      const d = new Date(f.inspectedAt || Date.now());
      const fleet = normFleet(f.fleetNo);
      const plate = f.plate.trim().toUpperCase();
      const ch: Record<string, Status> = {}; const nt: Record<string, string> = {};
      allItems.forEach(({ key }) => { ch[key] = checks[key]; if (ch[key] === 'issue' && notes[key]) nt[key] = notes[key]; });
      const { error } = await supabase.from('inspections').insert({
        id, ref: makeRef(fleet || plate, d), fleet_no: fleet, plate, emirate: f.emirate, model: f.model.trim(), powertrain: f.powertrain,
        returned_by: f.returnedBy.trim(), staff_id: f.staffId.trim() || null, staff_email: f.staffEmail.trim().toLowerCase(), odometer: f.odometer === '' ? null : Number(f.odometer),
        energy: f.energy || null, inspected_at: d.toISOString(), checks: ch, notes: nt, damage: !!damage, photos: stored,
        remarks: f.remarks.trim() || null,
      });
      if (error) throw error;
      // Email the fleet manager. If email isn't set up, the report page still offers a manual email button.
      try { await fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); } catch {}
      photos.forEach((p) => URL.revokeObjectURL(p.url));
      router.push(`/inspections/${id}?saved=1`);
    } catch (e: any) {
      setSaving(false);
      const msg = String(e?.message || '');
      say(/row-level security|permission|not authorized|JWT/i.test(msg)
        ? 'You don\'t have permission to save. Sign out and sign in again, or contact the Fleet Command Centre.'
        : 'Saving failed. Check your connection and tap Save inspection again.', true);
    }
  }

  const vehList = useMemo(() => Object.values(vehicles), [vehicles]);

  return (
    <>
      <main>
        <section>
          <div className="card">
            <h2>Vehicle and handover</h2>
            <label className="f" style={{ marginBottom: 14 }}>Fleet number
              <input id="fleetInput" list="fleetList" autoComplete="off" placeholder="Type or pick the fleet number" value={f.fleetNo} onChange={(e) => onFleet(e.target.value)} />
              <span className={`lookup ${lookup.cls}`}>{lookup.text}</span>
            </label>
            <datalist id="fleetList">
              {vehList.map((v) => <option key={v.fleet_no} value={v.fleet_no}>{`${v.plate} ${v.model || ''}`}</option>)}
            </datalist>
            <label className="f" style={{ marginBottom: 12 }}>Plate number
              <div className="plate">
                <select aria-label="Emirate" value={f.emirate} onChange={(e) => set('emirate', e.target.value)}>
                  {Array.from(new Set([...EMIRATES, f.emirate].filter(Boolean))).map((em) => <option key={em}>{em}</option>)}
                </select>
                <input id="plateInput" placeholder="A 12345" autoComplete="off" aria-label="Plate number" value={f.plate} onChange={(e) => set('plate', e.target.value)} />
              </div>
            </label>
            <div className="grid">
              <label className="f">Make and model<input value={f.model} placeholder="BYD Atto 3" onChange={(e) => set('model', e.target.value)} /></label>
              <div className="f" style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14, fontWeight: 600, color: 'var(--muted)' }}>Powertrain
                <div className="seg" role="radiogroup" aria-label="Powertrain">
                  {(['Fuel', 'EV'] as const).map((pt) => (
                    <button key={pt} type="button" role="radio" data-pt={pt} aria-checked={f.powertrain === pt} onClick={() => setPowertrain(pt)}>{pt === 'EV' ? 'Electric' : 'Fuel'}</button>
                  ))}
                </div>
              </div>
              <label className="f">Returned by (staff name)<input id="returnedBy" value={f.returnedBy} onChange={(e) => set('returnedBy', e.target.value)} /></label>
              <label className="f">Staff ID<input value={f.staffId} onChange={(e) => set('staffId', e.target.value)} /></label>
              <label className="f full">Staff email (receives the report)<input id="staffEmail" type="email" inputMode="email" autoComplete="off" placeholder="name@eand.com" value={f.staffEmail} onChange={(e) => set('staffEmail', e.target.value)} /></label>
              <label className="f">Odometer (km)<input id="odometer" type="number" inputMode="numeric" min={0} value={f.odometer} onChange={(e) => set('odometer', e.target.value)} /></label>
              {f.powertrain === 'EV' ? (
                <label className="f">Battery level (%)<input type="number" inputMode="numeric" min={0} max={100} value={f.energy} onChange={(e) => set('energy', e.target.value)} /></label>
              ) : (
                <label className="f">Fuel level
                  <select value={f.energy} onChange={(e) => set('energy', e.target.value)}>
                    <option value="">Select</option>
                    {FUEL.map((x) => <option key={x}>{x}</option>)}
                  </select>
                </label>
              )}
              <label className="f">Inspected by<input value={`${inspectorName}${region ? ` (${region})` : ''}`} readOnly /></label>
              <label className="f">Date and time<input type="datetime-local" value={f.inspectedAt} onChange={(e) => set('inspectedAt', e.target.value)} /></label>
            </div>
          </div>

          <div className="card">
            <h2>Checklist</h2>
            {groups.map((g) => (
              <fieldset className="group" key={g.id}>
                <legend>{g.group}<small>{g.items.filter((i) => checks[i.key]).length} of {g.items.length}</small></legend>
                {g.items.map(({ key, label }) => {
                  const v = checks[key] || '';
                  return (
                    <div className={`item ${v}`} key={key} data-key={key}>
                      <div className="item-label">{label}</div>
                      <div className="seg" role="radiogroup" aria-label={label}>
                        {(['ok', 'issue', 'na'] as Status[]).map((s) => (
                          <button key={s} type="button" role="radio" aria-checked={v === s} data-status={s} onClick={() => setCheck(key, s, g.id)}>{LBL[s]}</button>
                        ))}
                      </div>
                      {v === 'issue' && (
                        <input className="item-note" ref={(el) => { noteRefs.current[key] = el; }} placeholder="What's wrong?" value={notes[key] || ''} onChange={(e) => setNotes((n) => ({ ...n, [key]: e.target.value }))} />
                      )}
                    </div>
                  );
                })}
              </fieldset>
            ))}
          </div>

          <div className="card">
            <h2>Damage, internal or external issues</h2>
            <p className="hint">Is there any damage or any internal or external issue on the vehicle?</p>
            <div className="seg big" role="radiogroup" aria-label="Damage or issues found" id="dmgSeg" tabIndex={-1}>
              <button type="button" role="radio" data-dmg="no" aria-checked={damage === false} onClick={() => chooseDamage(false)}>No damage or issues</button>
              <button type="button" role="radio" data-dmg="yes" aria-checked={damage === true} onClick={() => chooseDamage(true)}>Yes, record with photos</button>
            </div>
            {damage === true && (
              <div>
                <DamageDiagram strokes={strokes} onChange={setStrokes} />
                <b style={{ display: 'block', marginTop: 18 }}>Photos</b>
                <div className="photo-actions">
                  <button type="button" className="btn primary" id="btnCamera" onClick={() => camRef.current?.click()}>Take photo</button>
                  <button type="button" className="btn" onClick={() => galRef.current?.click()}>Upload from phone</button>
                </div>
                <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => addFiles(e.target.files, e.target)} />
                <input ref={galRef} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files, e.target)} />
                {!photos.length ? (
                  <div className="empty">No photos yet. Take a photo of each damaged area or issue.</div>
                ) : (
                  <div className="photos">
                    {photos.map((p, i) => (
                      <div className="tile" key={p.url}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.url} alt={`Photo ${i + 1}`} />
                        <div className="tb">
                          <select aria-label="Location on the vehicle" value={p.area} onChange={(e) => setPhotos((ps) => ps.map((x, j) => (j === i ? { ...x, area: e.target.value } : x)))}>
                            <option value="">Where on the vehicle?</option>
                            {AREAS.map((a) => <option key={a}>{a}</option>)}
                          </select>
                          <input placeholder="Describe the damage or issue" value={p.note} onChange={(e) => setPhotos((ps) => ps.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} />
                          <button type="button" className="btn link" onClick={() => { URL.revokeObjectURL(p.url); setPhotos((ps) => ps.filter((_, j) => j !== i)); }}>Remove photo</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="card">
            <h2>Remarks</h2>
            <label className="f">Anything else the fleet manager should know<textarea value={f.remarks} onChange={(e) => set('remarks', e.target.value)} /></label>
          </div>
        </section>
      </main>

      <div className="footbar">
        <div className="in">
          <div className="progress">
            <span>{done} of {allItems.length} checked</span>
            <div className="bar"><i style={{ width: `${allItems.length ? (done / allItems.length) * 100 : 0}%` }} /></div>
          </div>
          <button className="btn warn" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save inspection'}</button>
        </div>
      </div>
      {toast && <div className={`toast${toast.bad ? ' bad' : ''}`} role="status">{toast.msg}</div>}
    </>
  );
}
