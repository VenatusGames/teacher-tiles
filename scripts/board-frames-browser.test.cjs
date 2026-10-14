const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      const file = path.join(process.cwd(), decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
      return url.hostname === 'tiles.test' && fs.existsSync(file) && fs.statSync(file).isFile()
        ? route.fulfill({ path: file }) : route.abort();
    });
    await page.goto('http://tiles.test/', { waitUntil: 'domcontentloaded' });
    const snapshot = await page.evaluate(() => {
      const api = window.TeacherTilesBoard;
      api.load(api.blank());
      openBoardFrameMenu();
      document.getElementById('board-frame-capture').click();
      const button = document.querySelector('.board-frame-button');
      button.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      const input = document.querySelector('.board-frame-name-input');
      input.value = 'Morning meeting';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      const captured = api.capture();
      api.load(api.blank());
      api.load(captured);
      if (api.capture().frames[0]?.name !== 'Morning meeting') throw new Error('Frame rename did not survive restore');
      return captured;
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(saved => {
      const api = window.TeacherTilesBoard;
      api.load(saved);
      const roundTrip = api.capture().frames;
      const unknown = { id: 'future-tile', type: 'future-unsupported-tile', state: { important: 'retain me' } };
      api.load({ ...saved, objects: [unknown] });
      const retained = api.capture().objects;
      document.querySelector('.board-frame-delete').click();
      return { roundTrip, retained, afterDelete: api.capture().frames };
    }, snapshot);
    assert.deepEqual(result.roundTrip, snapshot.frames);
    assert.equal(result.retained[0].state.important, 'retain me');
    assert.deepEqual(result.afterDelete, []);
    assert.deepEqual(errors, []);
    console.log('Browser frame capture, rename, reload/restore, delete, and unavailable tile retention passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
