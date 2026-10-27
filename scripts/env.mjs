// Reads .env.local so the scripts can run with plain `node`, and checks the Supabase settings.
import { readFileSync, existsSync } from 'node:fs';
for (const f of ['.env.local']) {
  if (!existsSync(f)) { console.error('No .env.local file found. Copy .env.example to .env.local and fill in your Supabase values.'); process.exit(1); }
  for (const line of readFileSync(f, 'utf8').replace(/^﻿/, '').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '').trim();
  }
}

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
if (/YOUR-PROJECT|your-service-role-key/i.test(rawUrl + serviceKey)) {
  console.error('.env.local still has the template placeholders. Fill in your real Supabase URL and keys.');
  process.exit(1);
}
if (!rawUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

let parsed;
try { parsed = new URL(rawUrl); } catch {
  console.error(`The Supabase URL is not a valid web address: "${rawUrl}"`);
  process.exit(1);
}
// Keep only https://xxxx.supabase.co, dropping anything after it (a trailing slash, /rest/v1, etc.).
export const url = parsed.origin;
const ref = parsed.hostname.split('.')[0];
console.log(`Supabase project: ${url}`);
if (!parsed.hostname.endsWith('.supabase.co')) {
  console.error('That does not look like a project URL. It should look like https://abcd1234.supabase.co');
  process.exit(1);
}

// Legacy keys are JWTs: check the key is the service_role key and belongs to this project.
if (serviceKey.startsWith('eyJ')) {
  try {
    const payload = JSON.parse(Buffer.from(serviceKey.split('.')[1], 'base64url').toString('utf8'));
    console.log(`Secret key: role "${payload.role}", project "${payload.ref}"`);
    if (payload.role !== 'service_role') {
      console.error('The SUPABASE_SERVICE_ROLE_KEY line has the anon key. Use the key labelled service_role.');
      process.exit(1);
    }
    if (payload.ref && payload.ref !== ref) {
      console.error(`The secret key is for project "${payload.ref}" but the URL is for "${ref}". Check both come from the same project.`);
      process.exit(1);
    }
  } catch {
    console.error('The SUPABASE_SERVICE_ROLE_KEY looks cut off. Copy it again with the copy button.');
    process.exit(1);
  }
} else if (!serviceKey.startsWith('sb_secret_')) {
  console.error('The SUPABASE_SERVICE_ROLE_KEY does not look like a Supabase secret key.');
  process.exit(1);
}

// Minimal CSV reader (handles quoted fields).
export function readCsv(path) {
  const text = readFileSync(path, 'utf8').replace(/^﻿/, '');
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell); if (row.some((c) => c.trim())) rows.push(row);
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}
