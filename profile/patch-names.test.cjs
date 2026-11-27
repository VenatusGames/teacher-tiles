const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function source(name) {
  return fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
}

function loadProfile(document) {
  const context = vm.createContext({ document });
  for (const name of ['patch-catalog.js', 'patches.js', 'awards.js']) {
    const code = source(`profile/${name}`).replace(/^import .*;\r?\n/gm, '').replace(/\bexport /g, '');
    vm.runInContext(code, context, { filename: name });
  }
  return context;
}

function patchNode() {
  const classes = new Set(['profile-badge--locked']);
  const title = { textContent: '' };
  const check = { hidden: true };
  const requirement = { textContent: '' };
  return {
    dataset: {}, attributes: {}, title, check, requirement,
    classList: {
      toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name),
      contains: name => classes.has(name)
    },
    setAttribute(name, value) { this.attributes[name] = value; },
    querySelector(selector) { return selector === 'strong' ? title : selector === '.profile-badge__requirement' ? requirement : check; },
    append() {}
  };
}

function profileFixture() {
  const patches = new Map();
  const inspector = { dataset: { patchId: 'beta' }, title: { textContent: '' }, flavor: { textContent: '' }, querySelector(selector) { return selector === 'h2' ? this.title : this.flavor; } };
  const grid = {
    querySelector(selector) { return patches.get(selector.split('--').at(-1)); },
    append(button) { patches.set(button.className.split('profile-badge--').at(-1), button); }
  };
  for (const id of ['beta', 'contributor', 'stickerer', 'tile-layer']) patches.set(id, patchNode());
  const document = {
    createElement: () => patchNode(),
    querySelector(selector) {
      if (selector === '.profile-badge-grid') return grid;
      if (selector === '.profile-patch-tabs') return null;
      if (selector === '.patch-inspector[open]') return inspector;
      return patches.get(selector.split('--').at(-1));
    }
  };
  return { patches, inspector, context: loadProfile(document) };
}

test('backend names update locked, earned, legacy beta, aria and open inspector labels as text', () => {
  const { patches, inspector, context } = profileFixture();
  context.user = { uid: 'member', metadata: { creationTime: '2026-08-01' } };
  context.catalog = { beta: 'Backend beta label', tiktok: '<b>Backend patch</b>', beloved: 'Backend locked label' };
  context.awards = { tiktok: { awardedAt: Date.parse('2026-09-01T00:00:00Z') } };
  vm.runInContext('syncAwardedPatches(user, awards, catalog)', context);
  assert.equal(patches.size, 11);
  assert.equal(patches.get('beta').title.textContent, 'Backend beta label');
  assert.equal(patches.get('beta').dataset.awarded, '2026-08-28');
  assert.equal(patches.get('beta').classList.contains('profile-badge--locked'), false);
  assert.equal(patches.get('tiktok').title.textContent, '<b>Backend patch</b>');
  assert.equal(patches.get('tiktok').dataset.awarded, '2026-09-01');
  assert.equal(patches.get('beloved').classList.contains('profile-badge--locked'), true);
  assert.match(patches.get('beloved').attributes['aria-label'], /^Backend locked label patch\. Locked/);
  assert.equal(inspector.title.textContent, 'Backend beta label');
  assert.doesNotMatch(patches.get('tiktok').innerHTML, /<b>Backend patch/);
  context.catalog.beta = 'Renamed by backend';
  vm.runInContext('syncAwardedPatches(user, awards, catalog)', context);
  assert.equal(patches.get('beta').title.textContent, 'Renamed by backend');
  assert.equal(inspector.title.textContent, 'Renamed by backend');
  assert.equal(patches.get('beta').requirement.textContent, 'Unlock: Renamed by backend!');
  assert.equal(inspector.flavor.textContent, 'Unlock: Renamed by backend!');
  context.awards.beta = { revoked: true };
  vm.runInContext('syncAwardedPatches(user, awards, catalog)', context);
  assert.equal(patches.get('beta').classList.contains('profile-badge--locked'), true);
});

test('missing, invalid and inherited metadata stays generic without changing ownership', () => {
  const { patches, context } = profileFixture();
  context.user = { uid: 'member' };
  context.awards = { tiktok: { awardedAt: 1234 } };
  for (const catalog of [undefined, null, [], 4, { tiktok: '' }, { tiktok: 42 }, Object.create({ tiktok: 'Inherited' })]) {
    context.catalog = catalog;
    vm.runInContext('syncAwardedPatches(user, awards, catalog)', context);
    assert.equal(patches.get('tiktok').title.textContent, 'Patch name unavailable');
    assert.equal(patches.get('tiktok').classList.contains('profile-badge--locked'), false);
    assert.equal(patches.get('beloved').classList.contains('profile-badge--locked'), true);
  }
  vm.runInContext('syncAwardedPatches(null, {}, {})', context);
  assert.equal(patches.get('tiktok').classList.contains('profile-badge--locked'), true);
  assert.equal(patches.get('tiktok').dataset.awarded, undefined);
});

function accountFixture() {
  const auth = source('firebase-auth.js');
  const publish = auth.slice(auth.indexOf('function publishShopAccount('), auth.indexOf('async function callShopFunction('));
  const refresh = auth.slice(auth.indexOf('async function refreshShopAccount('), auth.indexOf('function applyReturnedShopAccount('));
  const events = [];
  const syncs = [];
  let response = { patchCatalog: { beta: 'Remote name' }, patchAwards: {} };
  let calls = 0;
  const context = vm.createContext({
    currentUser: { uid: 'member' },
    shopAccountState: { coinBalance: 0, ownedProductIds: [], patchAwards: {}, patchCatalog: {} },
    shopAccessCheckedAt: 0,
    profileCoinBalance: null, profileCoinCard: null,
    syncAwardedPatches: (...args) => syncs.push(args), syncSubscriberMarks() {},
    window: { dispatchEvent: event => events.push(event) },
    CustomEvent: class { constructor(name, options) { this.detail = options.detail; } },
    subscriberCoinNotice: { update() {} },
    callShopFunction: async () => { calls++; if (response instanceof Error) throw response; return response; }
  });
  vm.runInContext(publish + refresh, context);
  return { context, events, syncs, setResponse(value) { response = value; }, get calls() { return calls; } };
}

test('normal account load publishes catalog, failure clears labels and normal refresh recovers without polling', async () => {
  const fixture = accountFixture();
  await vm.runInContext('refreshShopAccount()', fixture.context);
  assert.equal(fixture.context.shopAccountState.patchCatalog.beta, 'Remote name');
  assert.equal(fixture.events.at(-1).detail.patchCatalog.beta, 'Remote name');
  assert.equal(fixture.syncs.at(-1)[2].beta, 'Remote name');
  fixture.setResponse(new Error('Unavailable'));
  await assert.rejects(vm.runInContext('refreshShopAccount()', fixture.context), /Unavailable/);
  assert.equal(Object.keys(fixture.context.shopAccountState.patchCatalog).length, 0);
  assert.equal(fixture.calls, 2);
  fixture.setResponse({ patchCatalog: { beta: 'Recovered name' } });
  await vm.runInContext('refreshShopAccount()', fixture.context);
  assert.equal(fixture.context.shopAccountState.patchCatalog.beta, 'Recovered name');
  fixture.context.currentUser = null;
  await vm.runInContext('refreshShopAccount()', fixture.context);
  assert.equal(Object.keys(fixture.context.shopAccountState.patchCatalog).length, 0);
  assert.equal(fixture.calls, 3);
});

test('account changes discard stale responses and reset catalog with ownership state', async () => {
  const fixture = accountFixture();
  let resolve;
  fixture.context.callShopFunction = () => new Promise(done => { resolve = done; });
  const pending = vm.runInContext('refreshShopAccount()', fixture.context);
  fixture.context.currentUser = { uid: 'other' };
  resolve({ patchCatalog: { beta: 'Old account label' } });
  await pending;
  assert.equal(fixture.context.shopAccountState.patchCatalog.beta, undefined);
  assert.match(source('firebase-auth.js'), /Object\.assign\(shopAccountState,\{ready:false,patchAwards:\{\},patchCatalog:\{\}/);
});
