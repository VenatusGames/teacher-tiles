import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { emailLookup } from '@/lib/encryption';
import { clearReadCache } from '@/lib/read-cache';
import { LogIn, LoaderCircle, LogOut, Sprout } from 'lucide-react';
import { auth, db, firebaseConfigured, googleSignIn, logOut, friendlyError } from '@/lib/firebase';
import { normalizeEmail, resolveAccess, type Access } from '@/lib/model';
import { GoalGardenApp } from './goal-garden-app';

export function AuthGate() {
  const [user, setUser] = useState<User | null>(null);
  const [access, setAccess] = useState<Access | null>(null);
  const [loading, setLoading] = useState(firebaseConfigured);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!auth || !db) return;
    let stopRole = () => {};
    let generation = 0;
    const stopAuth = onAuthStateChanged(auth, current => {
      const session = ++generation;
      stopRole(); clearReadCache(); setAccess(null); setUser(current); setError('');
      if (!current) { setLoading(false); return; }
      if (!current.email || !current.emailVerified) {
        setError('Use a Google account with a verified email address.'); setLoading(false); return;
      }
      setLoading(true);
      void emailLookup(current.email).then(hash => {
        if (session !== generation) return;
        const currentRef = doc(db!, 'studentAccess', hash);
        const legacyRef = doc(db!, 'studentLinks', normalizeEmail(current.email!));
        type Link = { ownerId: string; studentId: string };
        let currentLink: Link | null | undefined;
        let legacyLink: Link | null | undefined;
        let active = true;
        let lastRole = '';
        const fail = (err: unknown) => { if (active && session === generation) { lastRole = ''; clearReadCache(); setAccess(null); setError(friendlyError(err)); setLoading(false); } };
        const refreshRole = () => {
          if (!active || session !== generation || currentLink === undefined || legacyLink === undefined) return;
          const next = resolveAccess(current.uid, legacyLink ?? currentLink ?? undefined);
          const signature = JSON.stringify(next);
          if (signature !== lastRole) { clearReadCache(); lastRole = signature; setAccess(next); }
          setLoading(false); setError('');
        };
        // Use server-confirmed listener values instead of reading them again.
        const stopCurrent = onSnapshot(currentRef, { includeMetadataChanges: true }, snapshot => {
          if (snapshot.metadata.fromCache) return;
          currentLink = snapshot.exists() ? snapshot.data() as Link : null; refreshRole();
        }, fail);
        const stopLegacy = onSnapshot(legacyRef, { includeMetadataChanges: true }, snapshot => {
          if (snapshot.metadata.fromCache) return;
          legacyLink = snapshot.exists() ? snapshot.data() as Link : null; refreshRole();
        }, fail);
        stopRole = () => { active = false; stopCurrent(); stopLegacy(); };
      }).catch(err => { if (session === generation) { setError(friendlyError(err)); setLoading(false); } });
    });
    return () => { generation++; stopRole(); stopAuth(); };
  }, [retry]);
  const login = async () => {
    setBusy(true); setError('');
    try { await googleSignIn(); } catch (err) { setError(friendlyError(err)); }
    finally { setBusy(false); }
  };
  if (user && access && !loading && !error) return <GoalGardenApp key={`${user.uid}:${access.ownerId}:${access.role === 'student' ? access.studentId : 'teacher'}`} access={access} email={user.email ?? ''} />;
  return <main className="auth-gate"><section className="auth-card" aria-labelledby="sign-in-title">
    <span className="auth-mark"><Sprout /></span><p className="eyebrow">WIGs</p>
    <h1 id="sign-in-title">{loading ? 'Opening your WIGs…' : 'Sign in to continue'}</h1>
    <p>Use your Google account to open your class or your student profile.</p>
    {loading ? <LoaderCircle className="spin" aria-label="Loading" /> : <>
      {!firebaseConfigured && <p role="status">WIGs sign-in is being set up. Please check back soon.</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      {user ? <><button onClick={() => { setError(''); setLoading(true); setRetry(v => v + 1); }}>Try again</button><button onClick={() => void logOut().catch(err => setError(friendlyError(err)))}><LogOut /> Use another account</button></> : <button className="google-sign-in" onClick={() => void login()} disabled={busy || !firebaseConfigured}>{busy ? <LoaderCircle className="spin" /> : <LogIn />} {busy ? 'Signing in…' : 'Sign in with Google'}</button>}
    </>}
  </section></main>;
}
