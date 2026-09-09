import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { emailLookup } from '@/lib/encryption';
import { cachedRead, clearReadCache } from '@/lib/read-cache';
import { LogIn, LoaderCircle, LogOut } from 'lucide-react';
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
    let generation = 0;
    let identity: string | undefined;
    const stopAuth = onAuthStateChanged(auth, current => {
      const nextIdentity = JSON.stringify([current?.uid, current?.email, current?.emailVerified]);
      setUser(current);
      // Token/User object refreshes for the same identity must not reload the class.
      if (nextIdentity === identity) return;
      identity = nextIdentity;
      const session = ++generation;
      setAccess(null); setError('');
      if (!current) { clearReadCache(); setLoading(false); return; }
      if (!current.email || !current.emailVerified) {
        clearReadCache(); setError('Use a Google account with a verified email address.'); setLoading(false); return;
      }
      setLoading(true);
      const accountScope: Access = { role: 'teacher', ownerId: current.uid };
      void cachedRead(accountScope, 'account-access', async () => {
        const hash = await emailLookup(current.email!);
        const [currentLink, legacyLink] = await Promise.all([
          getDoc(doc(db!, 'studentAccess', hash)),
          getDoc(doc(db!, 'studentLinks', normalizeEmail(current.email!))),
        ]);
        const assignment = (legacyLink.exists() ? legacyLink.data() : currentLink.data()) as { ownerId: string; studentId: string } | undefined;
        return resolveAccess(current.uid, assignment);
      }, Infinity).then(next => {
        if (session !== generation) return;
        setAccess(next); setLoading(false);
      }).catch(err => {
        if (session !== generation) return;
        setAccess(null); setError(friendlyError(err)); setLoading(false);
      });
    });
    const refresh = () => { clearReadCache(); setLoading(true); setRetry(value => value + 1); };
    window.addEventListener('wigs:refresh', refresh);
    return () => { generation++; stopAuth(); window.removeEventListener('wigs:refresh', refresh); };
  }, [retry]);
  const login = async () => {
    setBusy(true); setError('');
    try { await googleSignIn(); } catch (err) { setError(friendlyError(err)); }
    finally { setBusy(false); }
  };
  if (user && access && !loading && !error) return <GoalGardenApp key={`${user.uid}:${access.ownerId}:${access.role === 'student' ? access.studentId : 'teacher'}`} access={access} email={user.email ?? ''} />;
  return <main className="auth-gate"><section className="auth-card" aria-labelledby="sign-in-title">
    <img className="auth-mark brand-image" src="/wigs/favicon.png" alt="" /><p className="eyebrow">WIGs</p>
    <h1 id="sign-in-title">{loading ? 'Opening your WIGs…' : 'Sign in to continue'}</h1>
    <p>Use your Google account to open your class or your student profile.</p>
    {loading ? <LoaderCircle className="spin" aria-label="Loading" /> : <>
      {!firebaseConfigured && <p role="status">WIGs sign-in is being set up. Please check back soon.</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      {user ? <><button onClick={() => { clearReadCache(); setError(''); setLoading(true); setRetry(v => v + 1); }}>Try again</button><button onClick={() => void logOut().catch(err => setError(friendlyError(err)))}><LogOut /> Use another account</button></> : <button className="google-sign-in" onClick={() => void login()} disabled={busy || !firebaseConfigured}>{busy ? <LoaderCircle className="spin" /> : <LogIn />} {busy ? 'Signing in…' : 'Sign in with Google'}</button>}
    </>}
  </section></main>;
}
