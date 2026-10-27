'use client';
import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { EMIRATES, normEmirate, normFleet, normPt } from '@/lib/checklist';
import type { Profile, Vehicle } from '@/lib/types';

export default function AdminPanel({ selfId, initialSettings, initialPeople, vehicleCount }: {
  selfId: string; initialSettings: { manager_email: string; cc: string }; initialPeople: Profile[]; vehicleCount: number;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [vCount, setVCount] = useState(vehicleCount);
  const [busy, setBusy] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [veh, setVeh] = useState({ fleet: '', plate: '', emirate: 'Dubai', model: '', pt: 'Fuel' });
  const [s, setS] = useState(initialSettings);
  const [people, setPeople] = useState(initialPeople);
  const [np, setNp] = useState({ name: '', email: '', phone: '', region: '', role: 'inspector' });

  const say = (text: string, bad = false) => { setMsg({ text, bad }); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  async function upsertVehicles(list: Vehicle[]) {
    for (let i = 0; i < list.length; i += 500) {
      const { error } = await supabase.from('vehicles').upsert(list.slice(i, i + 500).map((v) => ({ ...v, updated_at: new Date().toISOString() })));
      if (error) throw error;
    }
    const { count } = await supabase.from('vehicles').select('*', { count: 'exact', head: true });
    setVCount(count || 0);
  }

  async function importFile(file: File) {
    setBusy('import');
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: false });
      const h = rows.findIndex((r) => r.some((c) => /fleet/i.test(String(c))));
      if (h < 0) { setBusy(''); return say('No "Fleet No" column found. Use the template headings.', true); }
      const head = rows[h].map((c) => String(c).toLowerCase());
      const col: Record<string, number> = {};
      const pick = (k: string, re: RegExp) => { const i = head.findIndex((c, i) => re.test(c) && !Object.values(col).includes(i)); if (i >= 0) col[k] = i; };
      pick('fleet', /fleet/); pick('emirate', /emirate|state|city/); pick('plate', /plate|reg/); pick('powertrain', /power|fuel|type|\bev\b/); pick('model', /model|make|vehicle|desc/);
      if (col.plate === undefined) { setBusy(''); return say('No "Plate" column found. Use the template headings.', true); }
      const map: Record<string, Vehicle> = {};
      rows.slice(h + 1).forEach((r) => {
        const k = normFleet(r[col.fleet]); if (!k) return;
        const model = col.model !== undefined ? String(r[col.model]).trim() : '';
        map[k] = {
          fleet_no: k, plate: String(r[col.plate] || '').trim().toUpperCase(),
          emirate: col.emirate !== undefined ? normEmirate(r[col.emirate]) : '', model,
          powertrain: col.powertrain !== undefined ? normPt(r[col.powertrain]) : normPt(model),
        };
      });
      const list = Object.values(map);
      if (!list.length) { setBusy(''); return say('No vehicles found under the headings.', true); }
      await upsertVehicles(list);
      say(`Vehicle list saved: ${list.length} vehicles imported.`);
    } catch {
      say('That file could not be imported. Save it as .xlsx or .csv and try again.', true);
    }
    setBusy('');
  }

  function template() {
    const csv = 'Fleet No,Plate,Emirate,Make/Model,Powertrain\nF-1001,A 12345,Dubai,BYD Atto 3,EV\nF-1002,B 67890,Abu Dhabi,Toyota Hilux,Fuel\n';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'vehicle-list-template.csv'; a.click();
  }

  async function saveVehicle() {
    const k = normFleet(veh.fleet); const plate = veh.plate.trim().toUpperCase();
    if (!k || !plate) return say('Enter the fleet number and plate.', true);
    setBusy('veh');
    try {
      await upsertVehicles([{ fleet_no: k, plate, emirate: veh.emirate, model: veh.model.trim(), powertrain: veh.pt as 'Fuel' | 'EV' }]);
      say(`Vehicle ${k} saved.`); setVeh({ fleet: '', plate: '', emirate: 'Dubai', model: '', pt: 'Fuel' });
    } catch { say('The vehicle could not be saved. Try again.', true); }
    setBusy('');
  }

  async function loadVehicle(fleet: string) {
    const k = normFleet(fleet); if (!k) return;
    const { data } = await supabase.from('vehicles').select('*').eq('fleet_no', k).maybeSingle();
    if (data) setVeh({ fleet: k, plate: data.plate, emirate: data.emirate || 'Dubai', model: data.model, pt: data.powertrain });
  }

  async function saveSettings() {
    if (s.manager_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.manager_email.trim())) return say('Enter a valid fleet manager email.', true);
    setBusy('settings');
    const { error } = await supabase.from('settings').update({ manager_email: s.manager_email.trim() || null, cc: s.cc.trim() || null }).eq('id', 1);
    setBusy('');
    error ? say('Settings could not be saved. Try again.', true) : say('Settings saved.');
  }

  async function addPerson() {
    setBusy('person');
    const res = await fetch('/api/admin/inspectors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(np) });
    const out = await res.json().catch(() => ({}));
    setBusy('');
    if (!res.ok) return say(out.error || 'The inspector could not be saved.', true);
    say(out.updated ? `${np.name} updated. Their password is now their mobile number.` : `${np.name} added. They can sign in now.`);
    setNp({ name: '', email: '', phone: '', region: '', role: 'inspector' });
    const { data } = await supabase.from('profiles').select('*').order('region').order('name');
    if (data) setPeople(data as Profile[]);
    router.refresh();
  }

  async function toggleActive(p: Profile) {
    if (p.id === selfId) return say('You can\'t switch off your own access.', true);
    const { error } = await supabase.from('profiles').update({ active: !p.active }).eq('id', p.id);
    if (error) return say('That change could not be saved.', true);
    setPeople((ps) => ps.map((x) => (x.id === p.id ? { ...x, active: !p.active } : x)));
    say(`${p.name} ${p.active ? 'can no longer sign in' : 'can sign in again'}.`);
  }

  return (
    <main>
      {msg && <div className={msg.bad ? 'err-box' : 'notice'} role="status">{msg.text}</div>}

      <div className="card">
        <h2>Vehicle list</h2>
        <p className="hint">{vCount ? `${vCount} vehicles in the list.` : 'No vehicles yet.'}</p>
        <p className="hint">Import your fleet register from Excel (.xlsx) or CSV with these columns: Fleet No, Plate, Emirate, Make/Model and Powertrain (Fuel or EV). Vehicles with the same fleet number are updated; new ones are added.</p>
        <div className="photo-actions">
          <button className="btn primary" disabled={busy === 'import'} onClick={() => fileRef.current?.click()}>{busy === 'import' ? 'Importing…' : 'Import Excel or CSV'}</button>
          <button className="btn" onClick={template}>Download template</button>
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importFile(f); }} />
        <h3 className="sub">Add or update one vehicle</h3>
        <div className="grid">
          <label className="f">Fleet number<input value={veh.fleet} style={{ textTransform: 'uppercase' }} onChange={(e) => setVeh({ ...veh, fleet: e.target.value })} onBlur={(e) => loadVehicle(e.target.value)} /></label>
          <label className="f">Plate<input value={veh.plate} style={{ textTransform: 'uppercase' }} onChange={(e) => setVeh({ ...veh, plate: e.target.value })} /></label>
          <label className="f">Emirate
            <select value={veh.emirate} onChange={(e) => setVeh({ ...veh, emirate: e.target.value })}>
              {Array.from(new Set([...EMIRATES, veh.emirate].filter(Boolean))).map((em) => <option key={em}>{em}</option>)}
            </select>
          </label>
          <label className="f">Make and model<input value={veh.model} onChange={(e) => setVeh({ ...veh, model: e.target.value })} /></label>
          <label className="f">Powertrain
            <select value={veh.pt} onChange={(e) => setVeh({ ...veh, pt: e.target.value })}><option value="Fuel">Fuel</option><option value="EV">Electric</option></select>
          </label>
        </div>
        <div style={{ marginTop: 14 }}><button className="btn primary" disabled={busy === 'veh'} onClick={saveVehicle}>Save vehicle</button></div>
      </div>

      <div className="card">
        <h2>Inspectors</h2>
        <p className="hint">Inspectors sign in with their email and their mobile number (starting with 5) as the password. Adding someone who already exists updates their details and resets their password to the number you enter.</p>
        <div style={{ overflowX: 'auto' }}>
          <table className="list">
            <thead><tr><th>Name</th><th>Email</th><th>Region</th><th>Access</th></tr></thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}{p.role === 'admin' ? ' (admin)' : ''}</td>
                  <td>{p.email}</td>
                  <td>{p.region || '-'}</td>
                  <td><button className="btn link" onClick={() => toggleActive(p)}>{p.active ? 'Active, switch off' : 'Off, switch on'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 className="sub">Add or update an inspector</h3>
        <div className="grid">
          <label className="f">Name<input value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} /></label>
          <label className="f">Email<input type="email" value={np.email} onChange={(e) => setNp({ ...np, email: e.target.value })} /></label>
          <label className="f">Mobile number (password)<input inputMode="numeric" placeholder="501234567" value={np.phone} onChange={(e) => setNp({ ...np, phone: e.target.value })} /></label>
          <label className="f">Region<input placeholder="DXB-VMC" value={np.region} onChange={(e) => setNp({ ...np, region: e.target.value })} /></label>
          <label className="f">Role
            <select value={np.role} onChange={(e) => setNp({ ...np, role: e.target.value })}><option value="inspector">Inspector</option><option value="admin">Administrator</option></select>
          </label>
        </div>
        <div style={{ marginTop: 14 }}><button className="btn primary" disabled={busy === 'person'} onClick={addPerson}>{busy === 'person' ? 'Saving…' : 'Save inspector'}</button></div>
      </div>

      <div className="card">
        <h2>Report recipients</h2>
        <p className="hint">Every saved inspection is emailed to these addresses (when email is set up).</p>
        <div className="grid">
          <label className="f full">Fleet manager email<input type="email" placeholder="fleet.manager@eand.com" value={s.manager_email} onChange={(e) => setS({ ...s, manager_email: e.target.value })} /></label>
          <label className="f full">CC (optional, separate with commas)<input value={s.cc} onChange={(e) => setS({ ...s, cc: e.target.value })} /></label>
        </div>
        <div style={{ marginTop: 14 }}><button className="btn primary" disabled={busy === 'settings'} onClick={saveSettings}>Save settings</button></div>
      </div>
    </main>
  );
}
