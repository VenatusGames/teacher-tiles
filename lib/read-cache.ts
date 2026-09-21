import { auth } from './firebase';
import type { Access } from './model';

// Tab-memory only. No decrypted data or keys are persisted to browser storage.
const entries = new Map<string, { expires: number; value: Promise<unknown> }>();
const identity = () => JSON.stringify([auth?.currentUser?.uid, auth?.currentUser?.email, auth?.currentUser?.emailVerified]);
let account = identity();
const reloadCacheKey = 'wigs:encrypted-class:v1';
export function clearReloadCache() { try { sessionStorage.removeItem(reloadCacheKey); } catch { /* Storage may be disabled. */ } }
export function readReloadCache(ownerId: string): Record<string, unknown> | null {
  try {
    const stored = JSON.parse(sessionStorage.getItem(reloadCacheKey) ?? 'null');
    if (stored?.ownerId === ownerId && stored.expires > Date.now()) return stored.payload;
    if (stored) clearReadCache(false);
    clearReloadCache();
  } catch { clearReloadCache(); }
  return null;
}
export function saveReloadCache(ownerId: string, payload: unknown) {
  try { sessionStorage.setItem(reloadCacheKey, JSON.stringify({ ownerId, expires: Date.now() + 5 * 60 * 1000, payload })); }
  catch { clearReloadCache(); }
}
export function clearReadCache(clearPersisted = true) { entries.clear(); account = identity(); if (clearPersisted) clearReloadCache(); }
function prefix(access: Access) {
  if (account !== identity()) clearReadCache(false);
  return JSON.stringify([auth?.currentUser?.uid, access.ownerId, access.role, '']) + ':';
}
export function invalidateReads(access: Access, name: string) {
  const start = prefix(access) + name;
  for (const key of entries.keys()) if (key.startsWith(start)) entries.delete(key);
}
export function patchCachedRead<T>(access: Access, name: string, update: (old: T) => T) {
  const key = prefix(access) + name;
  const previous = entries.get(key);
  if (!previous) return;
  const value = previous.value.then(old => update(old as T));
  const entry = { expires: previous.expires, value };
  entries.set(key, entry);
  void value.catch(() => { if (entries.get(key) === entry) entries.delete(key); });
}
export function cachedRead<T>(access: Access, name: string, load: () => Promise<T>, ttl = 30000): Promise<T> {
  const key = prefix(access) + name;
  const old = entries.get(key);
  if (old && old.expires > Date.now()) return old.value as Promise<T>;
  const value = load();
  const entry = { expires: Date.now() + ttl, value };
  // History browsing must never evict the roster, settings, or encryption keys.
  if (entries.size >= 500) {
    const historyKey = [...entries.keys()].find(candidate => candidate.includes(':history:'));
    if (historyKey) entries.delete(historyKey);
  }
  entries.set(key, entry);
  void value.catch(error => {
    // Reopening a broken history screen cannot repair a missing index. Keep
    // this failure until explicit Retry/Refresh instead of querying it again.
    if (error?.code === 'failed-precondition' && /index/i.test(error?.message ?? '')) return;
    if (entries.get(key) === entry) entries.delete(key);
  });
  return value;
}
