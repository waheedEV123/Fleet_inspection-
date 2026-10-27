// Loads the vehicle list from scripts/data/vehicles.csv (Fleet No, Plate, Emirate, Make/Model, Powertrain).
// Run: npm run import-vehicles
import { createClient } from '@supabase/supabase-js';
import { url, serviceKey, readCsv } from './env.mjs';

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const rows = readCsv(process.argv[2] || 'scripts/data/vehicles.csv');
const map = new Map();
for (const r of rows) {
  const fleet = (r['Fleet No'] || '').toUpperCase().trim();
  if (!fleet) continue;
  const model = r['Make/Model'] || '';
  const pt = /\b(ev|bev|electric)\b|tesla/i.test(`${r.Powertrain} ${model}`) ? 'EV' : 'Fuel';
  map.set(fleet, { fleet_no: fleet, plate: (r.Plate || '').toUpperCase(), emirate: r.Emirate || '', model, powertrain: pt, updated_at: new Date().toISOString() });
}
const list = [...map.values()];
for (let i = 0; i < list.length; i += 500) {
  const { error } = await admin.from('vehicles').upsert(list.slice(i, i + 500));
  if (error) { console.error(`Failed: ${error.message}`); process.exit(1); }
}
console.log(`Done: ${list.length} vehicles loaded.`);
