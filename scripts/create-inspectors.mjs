// Creates (or updates) inspector accounts from scripts/data/inspectors.csv.
// Columns: Name, Email, Phone, Region, Role (inspector or admin). The phone number is the password.
// Run: npm run create-inspectors
import { createClient } from '@supabase/supabase-js';
import { url, serviceKey, readCsv } from './env.mjs';

const normPhone = (v) => {
  let d = String(v ?? '').replace(/\D/g, '');
  if (d.startsWith('00971')) d = d.slice(5); else if (d.startsWith('971')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  return d;
};

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const rows = readCsv(process.argv[2] || 'scripts/data/inspectors.csv');

const existing = new Map();
for (let page = 1; ; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) { console.error(error.message); process.exit(1); }
  data.users.forEach((u) => existing.set((u.email || '').toLowerCase(), u.id));
  if (data.users.length < 1000) break;
}

let ok = 0, failed = 0;
for (const r of rows) {
  const email = r.Email.toLowerCase();
  const password = normPhone(r.Phone);
  if (!email || email.includes('your-email') || password.length < 8) { console.log(`Skipped ${r.Name || email}: fill in a real email and mobile number`); failed++; continue; }
  let id = existing.get(email);
  const res = id
    ? await admin.auth.admin.updateUserById(id, { password })
    : await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (res.error) { console.log(`Failed ${email}: ${res.error.message}`); failed++; continue; }
  id = id || res.data.user.id;
  const { error } = await admin.from('profiles').upsert({
    id, name: r.Name, email, region: r.Region || null, role: r.Role === 'admin' ? 'admin' : 'inspector', active: true,
  });
  if (error) { console.log(`Failed ${email}: ${error.message}`); failed++; continue; }
  console.log(`${existing.has(email) ? 'Updated' : 'Created'} ${r.Name} <${email}> (${r.Role || 'inspector'})`);
  ok++;
}
console.log(`\nDone: ${ok} saved, ${failed} skipped or failed.`);
