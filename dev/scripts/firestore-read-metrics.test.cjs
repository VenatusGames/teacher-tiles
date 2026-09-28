const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../tiles/shared/firestore-read-metrics.js'), 'utf8'), context);
const metrics = context.window.TeacherTilesReadDiagnostics;
(async () => {
  const snapshot = { metadata: { fromCache: false }, data: () => ({ private: 'never include me' }) };
  let sets = 0;
  const sdk = metrics.wrap({
    getDoc: async () => snapshot,
    getDocFromServer: async () => { throw new Error('Offline'); },
    getDocs: async () => ({ docs: [], metadata: { fromCache: false } }),
    getDocsFromServer: async () => ({ docs: [snapshot, snapshot, snapshot], metadata: { fromCache: false } }),
    runTransaction: async (_db, callback) => {
      const transaction = { marker: true, get: async () => snapshot, set() { assert.equal(this.marker, true); sets++; return this; } };
      // Firestore can retry a transaction callback; every attempted read counts.
      await callback(transaction);
      return callback(transaction);
    }
  });
  await sdk.getDoc({ path: 'users/private-user-id' });
  snapshot.metadata.fromCache = true;
  await sdk.getDoc({ path: 'users/private-user-id' });
  await sdk.getDocs({});
  await sdk.getDocsFromServer({});
  await assert.rejects(sdk.getDocFromServer({}), /Offline/);
  await sdk.runTransaction({}, async tx => { await tx.get({}); tx.set({}, {}); });
  assert.equal(sets, 2, 'the diagnostics proxy preserves transaction method bindings');
  const rows = metrics.summary().operations;
  assert.equal(rows.find(r => r.operation === 'getDoc').calls, 2);
  assert.equal(rows.find(r => r.operation === 'getDoc').documents, 1, 'cached reads do not inflate the server-read estimate');
  assert.equal(rows.find(r => r.operation === 'getDocs').documents, 1, 'empty queries still have a minimum read');
  assert.equal(rows.find(r => r.operation === 'getDocsFromServer').documents, 3);
  assert.equal(rows.find(r => r.operation === 'getDocFromServer').errors, 1);
  assert.equal(rows.find(r => r.operation === 'transaction.get').documents, 2);
  assert(!JSON.stringify(metrics.summary()).includes('private-user-id'));
  assert(!JSON.stringify(metrics.summary()).includes('never include me'));
  metrics.reset(); assert.equal(metrics.summary().operations.length, 0);
  console.log('Firestore read diagnostics: cache, query size, errors, transaction retries, bindings, and data privacy passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
