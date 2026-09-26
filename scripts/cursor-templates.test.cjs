const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const root = path.join(__dirname, '../assets/cursors');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'packs.js'), 'utf8'), context);
(async () => {
  for (const pack of context.window.TeacherTilesCursorPacks.filter(p => ['pixel', 'toon'].includes(p.id))) {
    for (const state of ['normal', 'point', 'open', 'grab']) {
      const original = await sharp(path.join(root, 'templates', pack.id, `${state}.png`)).ensureAlpha().resize(32, 32, { kernel: pack.id === 'pixel' ? 'nearest' : 'lanczos3' }).raw().toBuffer();
      for (const cursor of pack.cursors) {
        const actual = await sharp(path.join(root, `${cursor.id}-${state}.png`)).ensureAlpha().raw().toBuffer();
        const color = cursor.color.slice(1).match(/../g).map(n => parseInt(n, 16));
        assert.equal(actual.length, original.length);
        for (let i = 0; i < original.length; i += 4) {
          assert.equal(actual[i + 3], original[i + 3], `${cursor.id}/${state}: silhouette and alpha must match the supplied sprite`);
          if (original[i + 3] > 0) for (let c = 0; c < 3; c++) assert.equal(actual[i + c], Math.round(original[i + c] * color[c] / 255), `${cursor.id}/${state}: only the color may change`);
        }
        assert(cursor.hotspots[state].every(v => v >= 0 && v < 32));
      }
    }
  }
  console.log('Pixel + Toon: all 40 sprites retain the exact source silhouettes, transparency, shading and expected palette colors.');
})().catch(error => { console.error(error); process.exitCode = 1; });
