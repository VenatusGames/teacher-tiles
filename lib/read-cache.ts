import { auth } from './firebase';
import type { Access } from './model';

// Tab-memory only. No decrypted data or keys are persisted to browser storage.
const entries = new Map<string, { expires: number; value: Promise<unknown> }>();
const identity = () => JSON.stringify([auth?.currentUser?.uid, auth?.currentUser?.email, auth?.currentUser?.emailVerified]);
let account = identity();
export function clearReadCache() { entries.clear(); account = identity(); }
function prefix(access: Access) {
  if (account !== identity()) clearReadCache();
  return JSON.stringify([auth?.currentUser?.uid, access.ownerId, access.role, access.role === 'student' ? access.studentId : '']) + ':';
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
  if (entries.size >= 500) entries.delete(entries.keys().next().value!);
  entries.set(key, entry);
  void value.catch(() => { if (entries.get(key) === entry) entries.delete(key); });
  return value;
}
