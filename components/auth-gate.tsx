import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot, runTransaction } from 'firebase/firestore';
import { emailLookup } from '@/lib/encryption';
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
      stopRole(); setAccess(null); setUser(current); setError('');
      if (!current) { setLoading(false); return; }
      if (!current.email || !current.emailVerified) {
        setError('Use a Google account with a verified email address.'); setLoading(false); return;
      }
      setLoading(true);
      void emailLookup(current.email).then(hash => {
        if (session !== generation) return;
        const currentRef = doc(db!, 'studentAccess', hash);
        const legacyRef = doc(db!, 'studentLinks', normalizeEmail(current.email!));
        let revision = 0;
        const fail = (err: unknown) => { if (session === generation) { setAccess(null); setError(friendlyError(err)); setLoading(false); } };
        const refreshRole = () => {
          const request = ++revision;
          // Read both assignments consistently during the atomic legacy migration.
          void runTransaction(db!, async tx => {
            const currentLink = await tx.get(currentRef);
            const legacyLink = await tx.get(legacyRef);
            return (legacyLink.exists() ? legacyLink.data() : currentLink.data()) as { ownerId: string; studentId: string } | undefined;
          }).then(data => {
            if (session !== generation || request !== revision) return;
            setAccess(resolveAccess(current.uid, data)); setLoading(false); setError('');
          }).catch(err => { if (request === revision) fail(err); });
        };
        const stopCurrent = onSnapshot(currentRef, refreshRole, fail);
        const stopLegacy = onSnapshot(legacyRef, refreshRole, fail);
        stopRole = () => { revision++; stopCurrent(); stopLegacy(); };
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
