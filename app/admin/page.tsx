import { redirect } from 'next/navigation';
import Header from '@/app/components/Header';
import AdminPanel from '@/app/components/AdminPanel';
import { requireProfile } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const profile = await requireProfile();
  if (profile.role !== 'admin') redirect('/');
  const supabase = createClient();
  const [{ data: settings }, { data: people }, { count }] = await Promise.all([
    supabase.from('settings').select('manager_email, cc').eq('id', 1).maybeSingle(),
    supabase.from('profiles').select('*').order('region').order('name'),
    supabase.from('vehicles').select('*', { count: 'exact', head: true }),
  ]);
  return (
    <>
      <Header profile={profile} current="admin" />
      <AdminPanel
        selfId={profile.id}
        initialSettings={{ manager_email: settings?.manager_email || '', cc: settings?.cc || '' }}
        initialPeople={(people || []) as Profile[]}
        vehicleCount={count || 0}
      />
    </>
  );
}
