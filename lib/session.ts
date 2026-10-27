import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';
import type { Profile } from './types';

// Returns the signed-in user's profile, or sends them to the sign-in page.
export async function requireProfile(): Promise<Profile> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!data || !data.active) redirect('/login?error=noaccess');
  return data as Profile;
}
