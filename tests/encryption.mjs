import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createHash } from 'node:crypto';

const moduleUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
function compile(file, imports = {}) {
  let source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  for (const [name, url] of Object.entries(imports)) source = source.replaceAll("from '" + name + "'", "from '" + url + "'");
  return moduleUrl(source);
}
const encryptionUrl = compile('lib/encryption.ts');
const encryption = await import(encryptionUrl);
const { encryptRecord, decryptRecord, importKey, toBase64, emailLookup } = encryption;
const raw = crypto.getRandomValues(new Uint8Array(32));
const key = await importKey(toBase64(raw));
const path = 'classes/test/students/test';
const payload = { name: 'Synthetic learner 🌱', imageKey: 'preset:smile', items: [{ answer: 'A test answer' }] };
const first = await encryptRecord(payload, key, path);
const second = await encryptRecord(payload, key, path);
const syntheticPhoto = 'data:image/jpeg;base64,' + toBase64(crypto.getRandomValues(new Uint8Array(24 * 1024)));
const photoEnvelope = await encryptRecord({ imageKey: syntheticPhoto }, key, path);
assert.deepEqual(await decryptRecord(photoEnvelope, key, path), { imageKey: syntheticPhoto });
assert(!JSON.stringify(photoEnvelope).includes(syntheticPhoto));
assert.notEqual(first.iv, second.iv);
assert.notEqual(first.ciphertext, second.ciphertext);
assert.deepEqual(await decryptRecord(first, key, path), payload);
assert(!JSON.stringify(first).includes(payload.name));
await assert.rejects(decryptRecord(first, key, path + '-other'));
await assert.rejects(decryptRecord(first, await importKey(toBase64(crypto.getRandomValues(new Uint8Array(32)))), path));
await assert.rejects(decryptRecord({ ...first, version: 2 }, key, path));
await assert.rejects(decryptRecord({ ...first, iv: 'broken' }, key, path));
await assert.rejects(decryptRecord({ ...first, ciphertext: (first.ciphertext[0] === 'A' ? 'B' : 'A') + first.ciphertext.slice(1) }, key, path));
await assert.rejects(encryptRecord('x'.repeat(720000), key, path), /too large/);
const address = name => [name, 'example.invalid'].join('@');
assert.equal(await emailLookup('  ' + address('Child').toUpperCase() + '  '), createHash('sha256').update(address('child')).digest('hex'));
assert.equal(await emailLookup(''), '');

// In-memory Firestore API exercises the real storage/migration code with Web Crypto.
// This tests application behavior, not server-side security rules (separate suite).
const rows = new Map();
const ref = path => ({ path, id: path.split('/').at(-1) });
const snapshot = reference => {
  const value = rows.get(reference.path);
  return { ref: reference, id: reference.id, exists: () => value !== undefined, data: () => value };
};
let commits = 0, failAt = -1;
let reads = 0, writeCount = 0;
let missingIndex = false, failedQueries = 0;
const firestore = {
  doc: (parent, ...parts) => ref([parent.path, ...parts].filter(Boolean).join('/')),
  collection: (parent, ...parts) => ref([parent.path, ...parts].filter(Boolean).join('/')),
  getDoc: async reference => { reads++; return snapshot(reference); },
  getDocs: async reference => {
    if (missingIndex && reference.path.endsWith('/responses')) { failedQueries++; throw Object.assign(new Error('The query requires an index.'), { code: 'failed-precondition' }); }
    let docs = [...rows.keys()].filter(path => path.startsWith(reference.path + '/') && path.split('/').length === reference.path.split('/').length + 1).map(path => snapshot(ref(path)));
    const constraints = reference.constraints ?? [];
    const direction = constraints.find(c => c.kind === 'order')?.direction ?? 'asc';
    docs.sort((a,b) => (direction === 'asc' ? 1 : -1) * a.id.localeCompare(b.id));
    for (const c of constraints) {
      if (c.kind === 'where') docs = docs.filter(row => c.op === '>=' ? row.id >= c.value : row.id <= c.value);
      if (c.kind === 'after') docs = docs.filter(row => direction === 'asc' ? row.id > c.value : row.id < c.value);
      if (c.kind === 'limit') docs = docs.slice(0,c.value);
    }
    reads += Math.max(1, docs.length); return { docs };
  },
  query: (reference, ...constraints) => ({ ...reference, constraints }),
  documentId: () => '__name__',
  orderBy: (_field, direction) => ({ kind: 'order', direction }),
  where: (_field, op, value) => ({ kind: 'where', op, value }),
  startAfter: value => ({ kind: 'after', value }),
  limit: value => ({ kind: 'limit', value }),
  deleteDoc: async reference => { rows.delete(reference.path); },
  runTransaction: async (_db, fn) => {
    const writes = [];
    const result = await fn({
      get: async reference => { reads++; return snapshot(reference); },
      set: (reference, data) => { writes.push(() => rows.set(reference.path, data)); },
      delete: reference => { writes.push(() => rows.delete(reference.path)); },
    });
    if (++commits === failAt) throw new Error('Simulated interruption');
    writeCount += writes.length;
    for (const write of writes) write();
    return result;
  },
  writeBatch: () => {
    const deletes = [];
    return { delete: reference => deletes.push(reference.path), commit: async () => { for (const path of deletes) rows.delete(path); } };
  },
};
const auth = { currentUser: { uid: 'teacher-test', email: address('teacher') } };
globalThis.encryptionHarness = { firestore, auth };
const firestoreUrl = moduleUrl('export const { doc, collection, getDoc, getDocs, runTransaction, writeBatch, deleteDoc, query, documentId, orderBy, where, startAfter, limit } = globalThis.encryptionHarness.firestore;');
const firebaseUrl = moduleUrl('export const auth = globalThis.encryptionHarness.auth; export const requireDb = () => ({});');
const modelUrl = compile('lib/model.ts');
const cacheUrl = compile('lib/read-cache.ts', { './firebase': firebaseUrl });
const cache = await import(cacheUrl);
const activityUrl = compile('lib/firestore-activity.ts', { 'firebase/firestore': firestoreUrl });
const activity = await import(activityUrl);
const vaultUrl = compile('lib/key-vault.ts', { 'firebase/firestore': firestoreUrl, './firestore-activity': activityUrl, './firebase': firebaseUrl, './encryption': encryptionUrl, './read-cache': cacheUrl });
const store = await import(compile('lib/class-store.ts', { 'firebase/firestore': firestoreUrl, './firestore-activity': activityUrl, './firebase': firebaseUrl, './encryption': encryptionUrl, './key-vault': vaultUrl, './model': modelUrl, './read-cache': cacheUrl }));
const teacher = { role: 'teacher', ownerId: auth.currentUser.uid };
let cacheLoads = 0;
await Promise.all([cache.cachedRead(teacher, 'test:dedupe', async () => ++cacheLoads), cache.cachedRead(teacher, 'test:dedupe', async () => ++cacheLoads)]);
assert.equal(cacheLoads, 1);
cache.invalidateReads(teacher, 'test:');
await cache.cachedRead(teacher, 'test:dedupe', async () => ++cacheLoads);
assert.equal(cacheLoads, 2);
await cache.cachedRead(teacher, 'test:expiry', async () => ++cacheLoads, -1);
await cache.cachedRead(teacher, 'test:expiry', async () => ++cacheLoads, -1);
assert.equal(cacheLoads, 4);
await assert.rejects(cache.cachedRead(teacher, 'test:retry', async () => { throw new Error('Temporary failure'); }));
assert.equal(await cache.cachedRead(teacher, 'test:retry', async () => 'recovered'), 'recovered');
const originalAccount = auth.currentUser;
auth.currentUser = { ...originalAccount };
await cache.cachedRead(teacher, 'test:dedupe', async () => ++cacheLoads);
assert.equal(cacheLoads, 4, 'Refreshing the same Google user object must preserve cached records');
auth.currentUser = { uid: 'different-account', email: address('different') };
await cache.cachedRead(teacher, 'test:dedupe', async () => ++cacheLoads);
assert.equal(cacheLoads, 5, 'Another account must not reuse cached records');
auth.currentUser = originalAccount;
cache.clearReadCache();
let essentialLoads = 0;
await cache.cachedRead(teacher, 'students', async () => ++essentialLoads, Infinity);
await cache.cachedRead(teacher, 'key:shared', async () => ++essentialLoads, Infinity);
for (let i = 0; i < 550; i++) await cache.cachedRead(teacher, 'history:test:page:' + i, async () => i, Infinity);
await cache.cachedRead(teacher, 'students', async () => ++essentialLoads, Infinity);
await cache.cachedRead(teacher, 'key:shared', async () => ++essentialLoads, Infinity);
assert.equal(essentialLoads, 2, 'History cache pressure cannot evict roster or encryption keys');
cache.clearReadCache();
const classPath = 'classes/' + teacher.ownerId;
let data = await store.loadClass(teacher);
assert.equal(data.students.length, 0);
assert.equal(data.questions.length, 1);
assert(rows.get(classPath).ciphertext);
const sharedMaterial = rows.get(classPath + '/keys/shared').keyMaterial;
await store.changeClass(teacher, { action: 'addStudent', name: 'Synthetic child', email: address('child'), imageKey: 'preset:smile' });
data = await store.loadClass(teacher);
const child = data.students[0];
const childPath = classPath + '/students/' + child.id;
assert(rows.get(childPath).ciphertext);
assert.equal(rows.get(childPath).emailHash, await emailLookup(address('child')));
assert.notEqual(rows.get(classPath + '/keys/student_' + child.id).keyMaterial, sharedMaterial);
assert(!rows.has('studentLinks/' + address('child')));
assert(!JSON.stringify([...rows]).includes(address('child')));
await store.changeClass(teacher, { action: 'updateStudentScores', id: child.id, currentScore: 2, goalScore: 8 });
await store.changeClass(teacher, { action: 'updateStudentName', id: child.id, name: 'Updated synthetic child' });
await store.changeClass(teacher, { action: 'updateStudentImage', id: child.id, imageKey: 'preset:yes' });
await store.changeClass(teacher, { action: 'saveSettings', title: 'Encrypted title', description: 'Encrypted description' });
await store.changeClass(teacher, { action: 'setQuestionFridayOnly', id: 'starter', fridayOnly: false });
data = await store.loadClass(teacher);
assert.equal(data.students[0].currentScore, 2);
assert.equal(data.students[0].name, 'Updated synthetic child');
assert.equal(data.students[0].imageKey, 'preset:yes');
assert.equal(data.settings.title, 'Encrypted title');
const warmReads = reads;
await Promise.all([store.loadClass(teacher), store.loadClass(teacher)]);
assert.equal(reads, warmReads, 'Repeated class loads must reuse memory reads');
const beforeToggleReads = reads, beforeToggleWrites = writeCount;
await store.changeClass(teacher, { action: 'setQuestionFridayOnly', id: 'starter', fridayOnly: true });
assert.equal((await store.loadClass(teacher)).questions[0].fridayOnly, true);
assert.equal(reads - beforeToggleReads, 1, 'Toggle reads only its transaction record; rendering uses the committed value');
assert.equal(writeCount - beforeToggleWrites, 1);
await store.changeClass(teacher, { action: 'setQuestionFridayOnly', id: 'starter', fridayOnly: false });
const beforeNameWrites = writeCount;
const beforeNameReads = reads;
await store.changeClass(teacher, { action: 'updateStudentName', id: child.id, name: 'Updated synthetic child' });
assert.equal(writeCount - beforeNameWrites, 1, 'Profile edits must not rewrite unchanged email assignments');
await store.loadClass(teacher);
assert.equal(reads - beforeNameReads, 1, 'Student edits must not reread the roster');
const beforePhotoReads = reads, beforePhotoWrites = writeCount;
await store.changeClass(teacher, { action: 'updateStudentImage', id: child.id, imageKey: syntheticPhoto });
assert.equal((await store.loadClass(teacher)).students[0].imageKey, syntheticPhoto);
assert.equal(reads - beforePhotoReads, 1, 'Photo save must read only its transaction record');
assert.equal(writeCount - beforePhotoWrites, 1);
const student = { role: 'student', ownerId: teacher.ownerId, studentId: child.id };
auth.currentUser = { uid: 'child-user', email: address('child') };
assert.equal((await store.loadClass(student)).students.length, 1);
await assert.rejects(store.changeClass(student, { action: 'saveSettings', title: 'Forbidden', description: 'Forbidden' }));
await assert.rejects(store.completedToday(student, 'other-student'));
const beforePartialReads = reads, beforePartialWrites = writeCount;
await assert.rejects(store.submitResponse(student, data.students[0], {
  ...data, questions: [...data.questions, { id: 'unfinished', prompt: 'Another required question', position: 2, fridayOnly: false }],
}, { starter: 'starter-1' }), /Answer every question/);
await assert.rejects(store.submitResponse(student, data.students[0], data, {}), /Answer every question/);
await assert.rejects(store.submitResponse(student, data.students[0], data, { starter: 'invalid-choice' }), /Answer every question/);
assert.equal(reads, beforePartialReads, 'Incomplete surveys must not contact Firestore');
assert.equal(writeCount, beforePartialWrites, 'Incomplete surveys must not save partial responses');
await store.submitResponse(student, data.students[0], data, { starter: 'starter-1' });
assert.equal(writeCount, beforePartialWrites + 1, 'A finished survey saves exactly one response');
assert(await store.completedToday(student, child.id));
const completedReads = reads;
assert(await store.completedToday(student, child.id));
assert.equal(reads, completedReads, 'Repeated completion checks reuse the saved completion');
await assert.rejects(store.submitResponse(student, data.students[0], data, { starter: 'starter-1' }), /already completed/);
assert.equal(writeCount, beforePartialWrites + 1, 'Repeated submission must not write a second completion');
const history = await store.loadHistory(student);
assert.equal(history[0].items[0].answer, 'On My Way');
const historyReads = reads;
await store.loadHistory(student);
assert.equal(reads, historyReads, 'Repeated history opens must reuse memory reads');
assert(!JSON.stringify([...rows]).includes('On My Way'));
auth.currentUser = { uid: teacher.ownerId, email: address('teacher') };
await store.changeClass(teacher, { action: 'updateStudentEmail', id: child.id, email: address('replacement') });
assert(!rows.has('studentAccess/' + await emailLookup(address('child'))));
assert(rows.has('studentAccess/' + await emailLookup(address('replacement'))));
await store.changeClass(teacher, { action: 'addQuestion', prompt: 'Another encrypted question', fridayOnly: true });
data = await store.loadClass(teacher);
const question = data.questions.find(q => q.id !== 'starter');
await store.changeClass(teacher, { action: 'addAnswer', questionId: question.id, label: 'Another encrypted answer', imageKey: null });
await store.changeClass(teacher, { action: 'deleteQuestion', id: question.id });
data = await store.loadClass(teacher);
assert.equal(data.questions.length, 1);
assert.equal(data.answers.length, 3);
const historyKey = await importKey(rows.get(classPath + '/keys/student_' + child.id).keyMaterial);
for (let day=1;day<=25;day++) {
  const date = '2025-01-' + String(day).padStart(2,'0');
  const recordPath = childPath + '/responses/' + date;
  rows.set(recordPath, await encryptRecord({createdAt:date+'T12:00:00.000Z',items:[{question:'Synthetic question',answer:'Synthetic answer',imageKey:null}]},historyKey,recordPath));
}
const filter = {studentId:child.id,from:'',to:'',order:'desc'};
const beforePageReads = reads;
const firstPage = await store.loadHistoryPage(teacher,filter);
assert.equal(firstPage.entries.length,10); assert(firstPage.hasMore);
assert.equal(reads-beforePageReads,11,'A history page fetches only ten entries plus one look-ahead');
const cachedPageReads = reads;
await store.loadHistoryPage(teacher,filter);
assert.equal(reads,cachedPageReads,'Returning to a history page reuses its cache');
const page2=await store.loadHistoryPage(teacher,{...filter,after:firstPage.entries.at(-1).id});
const page3=await store.loadHistoryPage(teacher,{...filter,after:page2.entries.at(-1).id});
assert.equal(new Set([...firstPage.entries,...page2.entries,...page3.entries].map(row=>row.id)).size,26);
assert.equal(page3.entries.length,6); assert(!page3.hasMore);
const filtered=await store.loadHistoryPage(teacher,{...filter,from:'2025-01-05',to:'2025-01-07',order:'asc'});
assert.deepEqual(filtered.entries.map(row=>row.id),['2025-01-05','2025-01-06','2025-01-07']);
await assert.rejects(store.loadHistoryPage(student,{...filter,studentId:'other-student'}));
await assert.rejects(store.loadHistoryPage(student,{...filter,studentId:'all'}), /Only your teacher/);
await store.changeClass(teacher, { action: 'addStudent', name: 'Second synthetic child', email: '', imageKey: null });
const secondChild = (await store.loadClass(teacher)).students.find(row => row.id !== child.id);
const secondKey = await importKey(rows.get(classPath + '/keys/student_' + secondChild.id).keyMaterial);
for (let day = 1; day <= 12; day++) {
  const date = '2025-01-' + String(day).padStart(2, '0');
  const path = classPath + '/students/' + secondChild.id + '/responses/' + date;
  rows.set(path, await encryptRecord({ createdAt: date + 'T12:00:00.000Z', items: [] }, secondKey, path));
}
missingIndex = true;
const brokenFilter = { studentId: 'all', from: '', to: '', order: 'desc' };
const failuresBefore = activity.getReadActivity().errors;
for (let i = 0; i < 10; i++) await assert.rejects(store.loadHistoryPage(teacher, brokenFilter), /requires an index/);
assert.equal(failedQueries, 1, 'Missing index must not fan out across students or retry on menu remount');
assert.equal(activity.getReadActivity().errors - failuresBefore, 1);
assert.equal(activity.getReadActivity().pending, 0);
missingIndex = false;
store.retryHistory(teacher);
for (const order of ['asc', 'desc']) {
  const allFilter = { studentId: 'all', from: '', to: '', order };
  const beforeAll = reads;
  const first = await store.loadHistoryPage(teacher, allFilter);
  assert(reads - beforeAll <= 12, 'All-student first page reads at most one candidate per student plus ten replacements');
  const warmReads = reads;
  await store.loadHistoryPage(teacher, allFilter);
  assert.equal(reads, warmReads, 'Reopening all-student history must reuse cached candidates');
  let page = first;
  const entries = [...page.entries];
  while (page.hasMore) {
    page = await store.loadHistoryPage(teacher, { ...allFilter, after: page.nextCursor });
    entries.push(...page.entries);
    assert(entries.length <= 38, 'Pagination must advance');
  }
  assert.equal(entries.length, 38);
  assert.equal(new Set(entries.map(row => row.studentId + ':' + row.id)).size, 38, 'Same-day records cannot be skipped or duplicated');
  assert.deepEqual(entries.map(row => row.id), entries.map(row => row.id).sort((a,b) => (order === 'asc' ? 1 : -1) * a.localeCompare(b)));
}
const allRange = { studentId: 'all', from: '2025-01-06', to: '2025-01-06', order: 'asc' };
assert.equal((await store.loadHistoryPage(teacher, allRange)).entries.length, 2);
await store.changeClass(teacher,{action:'deleteResponse',studentId:child.id,id:'2025-01-06'});
assert.equal((await store.loadHistoryPage(teacher, allRange)).entries.length, 1, 'Deleting a check-in invalidates all-student candidates');
assert.equal((await store.loadHistoryPage(teacher,{...filter,from:'2025-01-05',to:'2025-01-07',order:'asc'})).entries.length,2);
await store.changeClass(teacher, { action: 'deleteStudent', id: child.id });
assert(!rows.has(childPath));
assert(![...rows.keys()].some(path => path.startsWith(childPath + '/')));
assert(!rows.has('studentAccess/' + await emailLookup(address('replacement'))));

// Legacy migration preserves names, scores, pictures, email, and response times,
// removes all old readable fields/paths, and can safely resume after interruption.
rows.clear();
cache.clearReadCache();
rows.set(classPath, { ownerId: teacher.ownerId, title: 'Legacy class', description: 'Legacy description', createdAt: {} });
rows.set(classPath + '/questions/q', { id: 'q', prompt: 'Legacy question', position: 1, fridayOnly: false });
rows.set(classPath + '/answers/a', { id: 'a', questionId: 'q', label: 'Legacy answer', imageKey: 'preset:yes', position: 1 });
rows.set(classPath + '/students/legacy', { id: 'legacy', name: 'Legacy synthetic child', email: address('legacy'), imageKey: 'preset:smile', currentScore: 3, goalScore: 7 });
rows.set('studentLinks/' + address('legacy'), { ownerId: teacher.ownerId, studentId: 'legacy' });
rows.set(classPath + '/students/legacy/responses/2026-01-02', { localDate: '2026-01-02', createdAt: { toDate: () => new Date('2026-01-02T15:00:00Z') }, items: [{ question: 'Legacy question', answer: 'Legacy answer', imageKey: 'preset:yes' }] });
failAt = commits + 4;
await assert.rejects(store.loadClass(teacher), /Simulated interruption/);
failAt = -1;
data = await store.loadClass(teacher);
assert.equal(data.students[0].currentScore, 3);
assert.equal(data.students[0].goalScore, 7);
assert.equal(data.students[0].imageKey, 'preset:smile');
assert.equal(data.students[0].email, address('legacy'));
assert.equal(data.settings.title, 'Legacy class');
assert.equal((await store.loadHistory(teacher))[0].createdAt, '2026-01-02T15:00:00.000Z');
assert(!rows.has('studentLinks/' + address('legacy')));
for (const [path, value] of rows) {
  if (path.startsWith('studentAccess/')) continue;
  if (path.includes('/keys/')) { assert.deepEqual(Object.keys(value).sort(), ['keyMaterial', 'version']); continue; }
  assert(value.ciphertext, path);
  assert.deepEqual(Object.keys(value).sort(), path.endsWith('/students/legacy') ? ['ciphertext', 'emailHash', 'iv', 'version'] : ['ciphertext', 'iv', 'version']);
}
const before = JSON.stringify([...rows]);
await store.loadClass(teacher);
assert.equal(JSON.stringify([...rows]), before);
rows.delete(classPath + '/keys/shared');
cache.clearReadCache();
const missingKeyState = JSON.stringify([...rows]);
await assert.rejects(store.loadClass(teacher), /encryption key is unavailable/);
assert.equal(JSON.stringify([...rows]), missingKeyState);
delete globalThis.encryptionHarness;
console.log('Encryption, migration, cache isolation/expiry, and read-count regressions passed (warm schedule/profile/photo save: 1 document read and 1 write; repeated warm class/history/completion loads: 0 reads). Counts exclude server rule evaluation.');
