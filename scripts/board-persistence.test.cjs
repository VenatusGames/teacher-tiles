const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../firebase-auth.js'), 'utf8');
const storage = () => {
  const entries = new Map();
  return { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) };
};
function harness() {
  const docs = new Map();
  let nextId = 0;
  let failCommit = false;
  const snap = ref => ({ id: ref.id, exists: () => docs.has(ref.path), data: () => docs.get(ref.path) });
  const sdk = {
    collection: (_, ...parts) => ({ path: parts.join('/') }),
    doc: (parent, ...parts) => {
      const path = parts.length ? parts.join('/') : `${parent.path}/recovered-${++nextId}`;
      return { path, id: path.split('/').pop() };
    },
    serverTimestamp: () => 100,
    deleteField: () => null,
    getDoc: async ref => snap(ref),
    getDocs: async ref => ({ docs: [...docs.keys()].filter(path => path.startsWith(ref.path + '/') && !path.slice(ref.path.length + 1).includes('/')).map(path => snap({ path, id: path.split('/').pop() })) }),
    runTransaction: async (_, callback) => {
      const writes = [];
      await callback({ get: async ref => snap(ref), set: (ref, value) => writes.push(() => docs.set(ref.path, { ...docs.get(ref.path), ...value })), delete: ref => writes.push(() => docs.delete(ref.path)) });
      if (failCommit) throw new Error('Offline');
      writes.forEach(write => write());
    }
  };
  sdk.getDocFromServer = sdk.getDoc;
  sdk.getDocsFromServer = sdk.getDocs;
  const context = vm.createContext({ console: { ...console, error() {} }, TextEncoder, localStorage: storage(), sessionStorage: storage(),
    window: { setTimeout: () => 1 }, clearTimeout() {}, firestoreSdk: sdk, db: {}, currentUser: { uid: 'teacher' },
    boardList: [], activeBoardId: 'one', boardLoading: false, boardSaving: false, boardSavePromise: null,
    boardLocalHashes: new Map(), localBoardMemory: new Map(), localBoardDbPromise: null, cloudBoardSaveTimers: new Map(),
    localBoardSaveTimer: 0, boardsView: { hidden: true }, boardsSaveStatus: {}, pendingBoardChangeReason: '',
    INLINE_OBJECT_BUDGET: 560000, CHUNK_OBJECT_BUDGET: 520000, MAX_SINGLE_OBJECT_BYTES: 900000, PREVIEW_OBJECT_BUDGET: 90000,
    CLOUD_SAVE_DELAY: 1200, LOCAL_SAVE_DELAY: 280, boardListLoadedFromNetwork: false,
    setBoardStatus: message => { context.status = message; }, renderBoards() {}, markBoardCloudLoadedForSession() {},
    boardApi: () => ({ setActiveBoardId() {}, capture: () => context.workspace || context.localBoardMemory.get(`teacher:${context.activeBoardId}`)?.snapshot, load: snapshot => { context.workspace = snapshot; } }), activeBoardStorageKey: uid => `active-${uid}` });
  vm.runInContext(source.slice(source.indexOf('function boardCollection('), source.indexOf('function layoutBoardPreviewObjects(')), context);
  vm.runInContext(source.slice(source.indexOf('function backupCurrentBoard('), source.indexOf('window.addEventListener("beforeunload", backupCurrentBoard)')), context);
  // Preview rendering is unrelated to persistence.
  context.buildCompactPreviewObjects = objects => objects;
  const base = context.cleanBoardSnapshot({ frames: [{ id: 'frame-a', name: 'Morning', centerX: 12, centerY: 34, scale: 1 }], objects: [] });
  const hash = context.contentHashForSnapshot(base);
  const metadata = { name: 'Board 1', ...base, inlineObjects: [], storageFormat: 'inline-v2', revision: 1, contentHash: hash, stateChunkCount: 0, stateChunkHashes: [] };
  docs.set('users/teacher/boards/one', metadata);
  context.boardList = [context.normalizeBoardMetadata(snap({ path: 'users/teacher/boards/one', id: 'one' }))];
  return { c: context, docs, base, offline: value => { failCommit = value; } };
}
(async () => {
  {
    const { c, docs, base } = harness();
    await c.cacheSnapshotLocally('one', { ...base, frames: [{ id: 'unsaved-local-frame' }] });
    const original = c.boardList[0];
    docs.set('users/teacher/boards/last-night', { ...docs.get('users/teacher/boards/one'), name: 'Last night' });
    Object.assign(docs.get('users/teacher/boards/one'), { revision: 10, contentHash: 'another-device' });
    await c.refreshBoardLibrary();
    assert(c.boardList.some(board => board.id === 'last-night'), 'server-only board must appear despite cached library');
    assert.equal(c.boardList.find(board => board.id === 'one'), original, 'library refresh must not replace active metadata');
    assert.equal(original.revision, 1, 'library refresh must not rebase unsaved work');
    assert.equal((await c.readLocalBoardSnapshot('teacher', 'one')).snapshot.frames[0].id, 'unsaved-local-frame');
    c.firestoreSdk.getDocsFromServer = async () => { throw new Error('Offline'); };
    await assert.rejects(() => c.refreshBoardLibrary(), /Offline/);
    assert(c.boardList.some(board => board.id === 'last-night'), 'network failure must retain visible library');
  }
  {
    const { c, base } = harness();
    const reordered = JSON.parse(c.stableBoardJson(base));
    assert.equal(c.contentHashForSnapshot(base), c.contentHashForSnapshot(reordered), 'Firestore field ordering must not create false edits');
  }
  {
    const { c, docs, base } = harness();
    c.workspace = base;
    await c.cacheSnapshotLocally('one', base, { dirty: false });
    const newer = { ...base, frames: [{ id: 'focus-synced-frame' }] };
    Object.assign(docs.get('users/teacher/boards/one'), newer, { revision: 2, contentHash: c.contentHashForSnapshot(newer) });
    await c.refreshActiveBoardFromCloud();
    assert.equal(c.workspace.frames[0].id, 'focus-synced-frame');
  }
  {
    const { c, docs, base } = harness();
    const originalTransaction = c.firestoreSdk.runTransaction;
    let release, entered;
    const started = new Promise(resolve => { entered = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    let first = true;
    c.firestoreSdk.runTransaction = async (...args) => {
      if (first) { first = false; entered(); await gate; }
      return originalTransaction(...args);
    };
    await c.cacheSnapshotLocally('one', { ...base, frames: [{ id: 'first-edit' }] });
    const saving = c.saveCachedBoardToCloud('one');
    await started;
    await c.cacheSnapshotLocally('one', { ...base, frames: [{ id: 'edit-during-save' }] });
    release();
    await saving;
    assert.equal(docs.get('users/teacher/boards/one').frames[0].id, 'edit-during-save');
    assert.equal(docs.get('users/teacher/boards/one').revision, 3);
  }
  {
    const { c, docs, base } = harness();
    const changed = { ...base, frames: [...base.frames, { id: 'frame-b', name: 'Afternoon', centerX: 90, centerY: 80, scale: 2 }] };
    await c.cacheSnapshotLocally('one', changed);
    await c.saveCachedBoardToCloud('one');
    assert.equal(docs.get('users/teacher/boards/one').frames.length, 2);
    assert.equal(docs.get('users/teacher/boards/one').revision, 2);
    assert.equal((await c.readLocalBoardSnapshot('teacher', 'one')).dirty, false);
    assert.equal(c.sessionStorage.getItem('teacher:one'), null);
  }
  {
    const { c, docs, base } = harness();
    await c.cacheSnapshotLocally('one', { ...base, frames: [] });
    docs.get('users/teacher/boards/one').revision = 2;
    docs.get('users/teacher/boards/one').contentHash = 'other-device';
    await c.saveCachedBoardToCloud('one');
    assert.equal(docs.get('users/teacher/boards/one').frames.length, 1, 'stale deletion must not wipe cloud frames');
    assert.equal(docs.get('users/teacher/boards/recovered-1').frames.length, 0, 'conflicting local intent must also survive');
    assert.equal(c.activeBoardId, 'recovered-1');
  }
  {
    const { c, docs, base } = harness();
    await c.cacheSnapshotLocally('one', { ...base, frames: [{ id: 'local-edit' }] });
    c.localBoardMemory.clear();
    docs.get('users/teacher/boards/one').revision = 7;
    docs.get('users/teacher/boards/one').contentHash = 'new-cloud';
    const restored = await c.resolveBoardSnapshot('one');
    assert.equal(restored.snapshot.frames[0].id, 'local-edit', 'refresh must retain dirty older local edits');
    assert.equal(c.boardList[0].revision, 1, 'dirty edits retain their original base revision');
  }
  {
    const { c, docs, base, offline } = harness();
    const large = { ...base, objects: [{ id: 'large', text: 'x'.repeat(600000) }] };
    await c.cacheSnapshotLocally('one', large);
    offline(true);
    await c.saveCachedBoardToCloud('one');
    assert.equal(docs.size, 1, 'failed atomic save must leave no partially written chunks');
    assert.equal(docs.get('users/teacher/boards/one').revision, 1);
    assert.equal((await c.readLocalBoardSnapshot('teacher', 'one')).dirty, true);
    offline(false);
    await c.saveCachedBoardToCloud('one');
    assert.equal(docs.size, 2);
    const restored = await c.readCloudBoardSnapshot(c.boardList[0]);
    assert.equal(restored.snapshot.objects[0].text.length, 600000);
    docs.delete('users/teacher/boards/one/state/chunk-000');
    await assert.rejects(() => c.readCloudBoardSnapshot(c.boardList[0]), /chunks changed/);
  }
  {
    const { c, base } = harness();
    c.workspace = { ...base, frames: [{ id: 'last-millisecond' }] };
    c.backupCurrentBoard();
    await c.restoreEmergencyBoardSnapshot('teacher');
    const local = await c.readLocalBoardSnapshot('teacher', 'one');
    assert.equal(local.snapshot.frames[0].id, 'last-millisecond');
    assert.equal(local.dirty, true);
    c.boardLoading = true;
    c.workspace = { frames: [] };
    c.backupCurrentBoard();
    assert.equal(c.sessionStorage.getItem('teachertiles-last-local-board-teacher'), null, 'loading UI must never become an emergency save');
  }
  {
    const { c, docs, base } = harness();
    await c.cacheSnapshotLocally('one', base, { dirty: false });
    const newer = { ...base, frames: [{ id: 'new-device-frame' }] };
    Object.assign(docs.get('users/teacher/boards/one'), newer, { revision: 2, contentHash: c.contentHashForSnapshot(newer) });
    const restored = await c.resolveBoardSnapshot('one');
    assert.equal(restored.snapshot.frames[0].id, 'new-device-frame', 'reopening must check cloud rather than stale metadata');
  }
  console.log('Board persistence: frame round-trip, conflict recovery, refresh recovery, offline retry, atomic chunks, and fresh cloud reads passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
