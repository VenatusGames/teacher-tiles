import { readFileSync } from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
const env = await initializeTestEnvironment({ projectId: 'demo-wigs-tests', firestore: { host: '127.0.0.1', port: 8085, rules: readFileSync('firestore.rules', 'utf8') } });
const email = name => [name, 'example.invalid'].join('@');
const signed = (uid, extra = {}) => env.authenticatedContext(uid, { email: email(uid), email_verified: true, firebase: { sign_in_provider: 'google.com' }, ...extra }).firestore();
const teacher = signed('teacher-a'), other = signed('teacher-b'), formerStudent = signed('child'), anonymous = env.unauthenticatedContext().firestore();
const root = 'classes/teacher-a';
const profile = root + '/students/child-1';
const encrypted = () => ({ version: 1, iv: randomBytes(12).toString('base64'), ciphertext: randomBytes(64).toString('base64') });
const key = () => ({ version: 1, keyMaterial: randomBytes(32).toString('base64') });
const hash = createHash('sha256').update(email('child')).digest('hex');
let checks = 0;
const ok = async promise => { await assertSucceeds(promise); checks++; };
const no = async promise => { await assertFails(promise); checks++; };
try {
  await env.clearFirestore();
  await ok(setDoc(doc(teacher, root + '/keys/shared'), key()));
  await ok(setDoc(doc(teacher, root), encrypted()));
  await no(setDoc(doc(teacher, profile), encrypted()));
  await ok(setDoc(doc(teacher, root + '/keys/student_child-1'), key()));
  await ok(setDoc(doc(teacher, profile), encrypted()));
  await ok(setDoc(doc(teacher, root + '/questions/q'), encrypted()));
  await ok(setDoc(doc(teacher, root + '/answers/a'), encrypted()));
  await no(setDoc(doc(teacher, profile), { ...encrypted(), emailHash: hash }));
  await no(setDoc(doc(teacher, profile), { name: 'Plaintext' }));
  await no(setDoc(doc(teacher, root + '/keys/shared'), key()));
  await no(deleteDoc(doc(teacher, root + '/keys/shared')));
  await no(getDocs(collection(teacher, root + '/keys')));
  await no(getDocs(collection(teacher, 'classes')));
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'studentAccess', hash), { ownerId: 'teacher-a', studentId: 'child-1' });
    await setDoc(doc(db, 'studentLinks', email('child')), { ownerId: 'teacher-a', studentId: 'child-1' });
    await setDoc(doc(db, profile), { ...encrypted(), emailHash: hash });
  });
  for (const db of [other, formerStudent, anonymous, signed('teacher-a', { email_verified: false }), signed('teacher-a', { firebase: { sign_in_provider: 'password' } })]) {
    for (const path of [root, profile, root + '/keys/shared', root + '/keys/student_child-1', root + '/questions/q', root + '/answers/a']) {
      await no(getDoc(doc(db, path)));
      await no(setDoc(doc(db, path), encrypted()));
    }
    await no(getDocs(collection(db, root + '/students')));
    await no(setDoc(doc(db, profile + '/responses/2026-01-02'), encrypted()));
    await no(getDoc(doc(db, 'studentAccess', hash)));
    await no(deleteDoc(doc(db, 'studentAccess', hash)));
  }
  await ok(getDoc(doc(teacher, root)));
  await ok(getDocs(collection(teacher, root + '/students')));
  await ok(getDoc(doc(teacher, root + '/keys/shared')));
  await ok(getDoc(doc(teacher, 'studentAccess', hash)));
  await ok(getDoc(doc(teacher, 'studentLinks', email('child'))));
  await no(setDoc(doc(teacher, 'studentAccess', hash), { ownerId: 'teacher-a', studentId: 'child-1' }));
  await no(setDoc(doc(teacher, 'studentLinks', email('new')), { ownerId: 'teacher-a', studentId: 'child-1' }));
  const cleanup = writeBatch(teacher);
  cleanup.set(doc(teacher, profile), encrypted());
  cleanup.delete(doc(teacher, 'studentAccess', hash));
  cleanup.delete(doc(teacher, 'studentLinks', email('child')));
  await ok(cleanup.commit());
  await ok(setDoc(doc(teacher, profile + '/responses/2026-01-02'), encrypted()));
  await no(setDoc(doc(teacher, profile + '/responses/2026-01-02'), encrypted()));
  await no(setDoc(doc(teacher, profile + '/responses/invalid'), encrypted()));
  await ok(getDocs(collection(teacher, profile + '/responses')));
  await ok(deleteDoc(doc(teacher, profile + '/responses/2026-01-02')));
  await ok(deleteDoc(doc(teacher, profile)));
  console.log(`${checks} owner-only access, retired login, encrypted payload, and cleanup rule checks passed.`);
} finally { await env.cleanup(); }
