'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const fallbackRoot = process.env.TT_FRONTEND_DIR || root;
const backend = process.env.TT_FUNCTIONS_DIR || path.resolve(root, '../teacher-tiles-functions/functions');
const { MANUAL_PATCH_IDS } = require(path.join(backend, 'catalog.js'));

test('portal single and bulk controls use response labels, preserve request IDs and recover after missing metadata', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname !== 'tiles.test') return route.abort();
      if (url.pathname === '/') {
        const html = fs.readFileSync(path.join(fallbackRoot, 'sandbox/portal.html'), 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
        return route.fulfill({ contentType: 'text/html', body: html });
      }
      const relative = url.pathname.slice(1);
      let file = path.join(root, relative);
      if (!fs.existsSync(file)) file = path.join(fallbackRoot, relative);
      if (!fs.existsSync(file)) return route.abort();
      return route.fulfill({ contentType: file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'image/svg+xml', body: fs.readFileSync(file) });
    });
    await page.goto('http://tiles.test/');
    const catalog = Object.fromEntries(Object.keys(MANUAL_PATCH_IDS).map(id => [id, `Server ${id}`]));
    catalog.tiktok = '<img src=x onerror=alert(1)> Remote patch';
    await page.evaluate(async patchCatalog => {
      window.patchCatalog = patchCatalog;
      window.mode = 'complete';
      window.calls = [];
      const user = { uid: 'member', email: 'member@example.com', coinBalance: 5, patchAwards: {}, legacyBeta: true };
      const call = async (name, data) => {
        calls.push({ name, data });
        const metadata = mode === 'complete' ? { patchCatalog: { ...window.patchCatalog } } : {};
        if (name === 'listDeveloperUsers') {
          if (mode === 'failed') throw new Error('Temporary list failure');
          return { data: { users: [{ ...user }], ...metadata } };
        }
        if (name === 'getDeveloperUser') return { data: { ...user, ...metadata } };
        if (name === 'giveUserPatch') {
          user.patchAwards[data.patchId] = data.enabled ? { awardedAt: Date.now() } : { revoked: true };
          return { data: { patchAwards: { ...user.patchAwards } } };
        }
        if (name === 'bulkGiveUserPatch' || name === 'bulkRemoveUserPatch') {
          return { data: { awarded: 1, removed: 1, unchanged: 0, skipped: 0, nextPageToken: null } };
        }
        throw new Error('Account tools not included in this fixture');
      };
      const { createUsersPanel } = await import('/sandbox/users.js');
      window.panel = createUsersPanel(call, () => 'admin');
      document.querySelector('.portal-shell').hidden = false;
      document.querySelector('.portal-shell').inert = false;
      document.getElementById('portal-access-screen').hidden = true;
      panel.element.hidden = false;
      await panel.load();
    }, catalog);
    await page.locator('.user-details-open').click();
    const picker = page.locator('#award-patch-select');
    await picker.waitFor();
    assert.equal(await picker.locator('option[value=beta]').textContent(), 'Server beta · Awarded');
    assert.equal(await picker.locator('option[value=tiktok]').textContent(), catalog.tiktok);
    assert.equal(await page.locator('.user-patch-choices img').count(), 0);
    assert.equal(await page.evaluate(() => calls.filter(call => call.name === 'getDeveloperUser').length), 0, 'Complete list primes detail metadata');
    await picker.selectOption('tiktok');
    await page.getByRole('button', { name: 'Give Patch', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.user-detail-status').textContent.includes('awarded.'));
    assert.deepEqual(await page.evaluate(() => calls.find(call => call.name === 'giveUserPatch').data), { uid: 'member', patchId: 'tiktok', enabled: true });
    await picker.selectOption('tiktok');
    await page.getByRole('button', { name: 'Remove Patch', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.user-detail-status').textContent.includes('removed.'));
    assert.equal(await page.evaluate(() => calls.filter(call => call.name === 'giveUserPatch').at(-1).data.enabled), false);
    await page.locator('.user-details-close').click();
    await page.locator('#users-selection-toggle').click();
    await page.locator('.user-select').check();
    await page.getByRole('button', { name: 'Bulk Patches', exact: true }).click();
    const bulk = page.locator('select[aria-label="Bulk patch"]');
    assert.equal(await bulk.locator('option[value=tiktok]').textContent(), catalog.tiktok);
    await bulk.selectOption('tiktok');
    await page.getByRole('button', { name: 'Review Award', exact: true }).click();
    assert.match(await page.locator('.bulk-summary').textContent(), /Remote patch/);
    await page.locator('.bulk-confirm [data-confirm]').click();
    await page.waitForFunction(() => document.querySelector('.bulk-progress').textContent.startsWith('Complete'));
    assert.deepEqual(await page.evaluate(() => calls.find(call => call.name === 'bulkGiveUserPatch').data), { scope: 'selected', patchId: 'tiktok', uids: ['member'] });
    await page.locator('.bulk-confirm [data-cancel]').click();
    await page.getByRole('button', { name: 'Bulk Patches', exact: true }).click();
    await page.locator('.bulk-patch-action').selectOption('remove');
    await bulk.selectOption('tiktok');
    await page.getByRole('button', { name: 'Review Removal', exact: true }).click();
    await page.locator('.bulk-confirm [data-confirm]').click();
    await page.waitForFunction(() => document.querySelector('.bulk-progress').textContent.startsWith('Complete'));
    assert.deepEqual(await page.evaluate(() => calls.find(call => call.name === 'bulkRemoveUserPatch').data), { scope: 'selected', patchId: 'tiktok', uids: ['member'] });
    await page.locator('.bulk-confirm [data-cancel]').click();
    await page.evaluate(() => { mode = 'missing'; });
    await page.locator('#users-refresh').click();
    await page.waitForFunction(() => document.querySelector('#users-status').textContent.includes('users loaded'));
    assert.equal(await bulk.isDisabled(), true);
    await page.locator('.user-details-open').click();
    assert.equal(await picker.isDisabled(), true);
    assert.match(await picker.textContent(), /unavailable/);
    assert.ok(await page.evaluate(() => calls.some(call => call.name === 'getDeveloperUser')));
    await page.locator('.user-details-close').click();
    await page.evaluate(() => { mode = 'failed'; });
    await page.locator('#users-refresh').click();
    await page.waitForFunction(() => document.querySelector('#users-status').textContent.includes('Temporary list failure'));
    assert.equal(await bulk.isDisabled(), true);
    await page.evaluate(() => { mode = 'complete'; patchCatalog.beta = 'Renamed remotely'; });
    await page.locator('#users-refresh').click();
    await page.waitForFunction(() => document.querySelector('#users-status').textContent.includes('users loaded'));
    await page.locator('.user-details-open').click();
    assert.equal(await picker.locator('option[value=beta]').textContent(), 'Renamed remotely · Awarded');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
