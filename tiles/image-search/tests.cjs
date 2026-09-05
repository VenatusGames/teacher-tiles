const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = { window: {}, URL };
vm.runInNewContext(fs.readFileSync(`${__dirname}/index.js`, 'utf8'), context);
const { normalizeResult, readDrag, DRAG_TYPE } = context.window.TeacherTilesImageSearch;
const valid = {
  url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Example.jpg/960px-Example.jpg',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:Example.jpg',
  title: 'Example', creator: 'Photographer', license: 'CC BY-SA 4.0'
};
assert.equal(normalizeResult(valid).url, valid.url);
assert.ok(normalizeResult({ ...valid, url: valid.url.replace('thumb.', 'upload.') }));
for (const url of ['javascript:alert(1)', 'data:image/svg+xml,test', 'http://thumb.wikimedia.org/wikipedia/commons/a.jpg',
  'https://thumb.wikimedia.org.evil.test/wikipedia/commons/a.jpg', 'https://user:pass@thumb.wikimedia.org/wikipedia/commons/a.jpg',
  'https://thumb.wikimedia.org:8443/wikipedia/commons/a.jpg', 'https://thumb.wikimedia.org/other/a.jpg', valid.url + 'x'.repeat(4096)]) {
  assert.equal(normalizeResult({ ...valid, url }), null, url.slice(0, 120));
}
assert.equal(normalizeResult({ ...valid, sourceUrl: 'https://example.com/wiki/File:Example.jpg' }), null);
assert.equal(normalizeResult(null), null);
assert.equal(normalizeResult({ ...valid, title: 'a'.repeat(1000) }).title.length, 180);
assert.equal(readDrag({ getData: type => type === DRAG_TYPE ? JSON.stringify(valid) : '' }).sourceUrl, valid.sourceUrl);
assert.equal(readDrag({ getData: () => '{bad json' }), null);
assert.equal(readDrag({ getData: () => 'x'.repeat(12001) }), null);
assert.equal(readDrag(null), null);
console.log('Image Search URL validation and drag payload checks passed.');
