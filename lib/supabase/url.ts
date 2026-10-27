// The project address, cleaned of anything after .supabase.co (a trailing slash, /rest/v1, quotes or spaces).
export function supabaseUrl() {
  const raw = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/^["']|["']$/g, '');
  try { return new URL(raw).origin; } catch { return raw; }
}
