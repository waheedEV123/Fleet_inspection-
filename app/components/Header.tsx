import Link from 'next/link';
import type { Profile } from '@/lib/types';

export default function Header({ profile, current }: { profile: Profile; current: 'new' | 'history' | 'admin' | 'report' }) {
  const tab = (key: string) => (current === key ? 'page' : undefined);
  return (
    <header className="top">
      <div className="top-inner">
        <h1>Vehicle inspection</h1>
        <p>Fleet Command Centre</p>
        <div className="who-bar">
          <span>
            Signed in as <b>{profile.name}</b>
            {profile.region ? ` · ${profile.region}` : ''}
          </span>
          <form action="/auth/signout" method="post">
            <button type="submit">Sign out</button>
          </form>
        </div>
        <nav className="tabs" aria-label="Sections">
          <Link href="/" aria-current={tab('new')}>New inspection</Link>
          <Link href="/history" aria-current={tab('history')}>History</Link>
          {profile.role === 'admin' && <Link href="/admin" aria-current={tab('admin')}>Settings</Link>}
        </nav>
      </div>
    </header>
  );
}
