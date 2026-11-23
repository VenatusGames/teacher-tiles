const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function setup() {
  const values = new Map();
  const storage = {
    get length() { return values.size; }, key: i => [...values.keys()][i],
    getItem: key => values.get(key), setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  };
  let now = 1000000, uid = 'admin-a';
  const calls = [];
  const context = vm.createContext({ Date: { now: () => now }, Map, JSON });
  const catalogSource = fs.readFileSync(path.join(__dirname, '../../profile/patch-catalog.js'), 'utf8').replace(/\bexport /g, '');
  vm.runInContext(catalogSource, context);
  const patchCatalog = vm.runInContext("Object.fromEntries(manualPatchIds.map(id => [id, 'Backend ' + id]))", context);
  const code = fs.readFileSync(path.join(__dirname, '../users-cache.js'), 'utf8').replace(/^import .*;\r?\n/gm, '').replace('export function', 'function');
  vm.runInContext(code, context);
  let respond = name => name === 'listDeveloperUsers'
    ? { data: { users: [{ uid: 'u', patchAwards: {}, coinBalance: 10 }], nextPageToken: null, patchCatalog } }
    : { data: { uid: 'u', patchAwards: {}, patchCatalog } };
  const call = async (name, data) => { calls.push({ name, data }); return respond(name, data); };
  return {
    client: () => context.createUsersClient(call, () => uid, storage), calls, values, patchCatalog,
    advance: () => now += 300001, account: value => uid = value,
    respond: callback => respond = callback
  };
}

test('list, detail, repeated search, and portal reload reuse the same data', async () => {
  const f = setup(), client = f.client();
  await client.request('listDeveloperUsers', { query: '' });
  const detail = await client.request('getDeveloperUser', { uid: 'u' });
  assert.deepEqual(detail.data.patchCatalog, f.patchCatalog);
  await client.request('listDeveloperUsers', { query: '' });
  await f.client().request('getDeveloperUser', { uid: 'u' });
  assert.equal(f.calls.length, 1);
  f.advance(); await client.request('getDeveloperUser', { uid: 'u' });
  assert.equal(f.calls.length, 2);
});

test('mutations bypass caching; refresh and sign-out invalidate cached display data', async () => {
  const f = setup(), client = f.client(); await client.request('listDeveloperUsers', {});
  await client.request('setUserBetaAccess', { uid: 'u', enabled: true });
  await client.request('setUserBetaAccess', { uid: 'u', enabled: true }); assert.equal(f.calls.length, 3);
  await client.request('listDeveloperUsers', {}); client.invalidate();
  await client.request('listDeveloperUsers', {}); assert.equal(f.calls.length, 5);
  f.account('admin-b'); await client.request('listDeveloperUsers', {}); assert.equal(f.calls.length, 6);
  client.clearSession(); assert.equal(f.values.size, 0);
});

test('simultaneous requests share one server call', async () => {
  const f = setup(), client = f.client();
  await Promise.all([client.request('listDeveloperUsers', {}), client.request('listDeveloperUsers', {})]);
  assert.equal(f.calls.length, 1);
});

test('incomplete name metadata cannot prime details or block a complete normal load', async () => {
  for (const patchCatalog of [undefined, {}, { beta: 'Only one name' }, { beta: 42 }, []]) {
    const f = setup(), client = f.client();
    f.respond(name => name === 'listDeveloperUsers'
      ? { data: { users: [{ uid: 'u', patchAwards: {} }], patchCatalog } }
      : { data: { uid: 'u', patchAwards: {}, patchCatalog: f.patchCatalog } });
    await client.request('listDeveloperUsers', {});
    const detail = await client.request('getDeveloperUser', { uid: 'u' });
    assert.deepEqual(detail.data.patchCatalog, f.patchCatalog);
    assert.equal(f.calls.length, 2);
    await client.request('getDeveloperUser', { uid: 'u' });
    assert.equal(f.calls.length, 2);
  }
});

test('old cache versions and incomplete persisted entries do not suppress fresh requests', async () => {
  for (const prefix of ['tt-dev-users-v3:', 'tt-dev-users-v4:']) {
    const f = setup();
    f.values.set(prefix + 'admin-a', JSON.stringify([
      ['getDeveloperUser:{"uid":"u"}', { time: 1000000, response: { data: { uid: 'u', patchAwards: {} } } }]
    ]));
    const response = await f.client().request('getDeveloperUser', { uid: 'u' });
    assert.deepEqual(response.data.patchCatalog, f.patchCatalog);
    assert.equal(f.calls.length, 1);
  }
});

test('incomplete detail responses are retried only on the next normal request', async () => {
  const f = setup(), client = f.client();
  f.respond(() => ({ data: { uid: 'u', patchAwards: {} } }));
  await client.request('getDeveloperUser', { uid: 'u' });
  assert.equal(f.calls.length, 1);
  f.respond(() => ({ data: { uid: 'u', patchAwards: {}, patchCatalog: f.patchCatalog } }));
  const response = await client.request('getDeveloperUser', { uid: 'u' });
  assert.equal(response.data.patchCatalog.beta, 'Backend beta');
  assert.equal(f.calls.length, 2);
});
