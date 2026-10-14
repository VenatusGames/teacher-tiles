const assert = require('node:assert/strict');
const fs = require('node:fs');

const picker = fs.readFileSync('tiles/shared/theme-picker.js', 'utf8');
const pickerCss = fs.readFileSync('tiles/shared/theme-picker.css', 'utf8');
const animatedCss = fs.readFileSync('tiles/shared/animated-themes.css', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

for (const asset of ['underwater-ocean.png', 'rainy-window.png']) {
  const path = `assets/themes/previews/${asset}`;
  const bytes = fs.readFileSync(path);
  assert(bytes.length > 1000, `${path} must contain real preview artwork`);
  assert.equal(bytes.subarray(1, 4).toString('ascii'), 'PNG', `${path} must be a PNG`);
  assert(animatedCss.includes(`previews/${asset}`), `${asset} must be used by animated theme preview CSS`);
}

assert(animatedCss.includes("url('../../assets/themes/underwater-ocean.svg')"), 'underwater SVG remains as a fallback');
assert(animatedCss.includes("url('../../assets/themes/rainy-window.svg')"), 'rainy-window SVG remains as a fallback');
assert(picker.includes("heading.dataset.entitlement=product"), 'theme pack heading must carry the pack entitlement');
assert(picker.includes("theme-picker-pack-locked"), 'theme picker must render a pack-level locked state');
assert(picker.includes("requestAccess(heading)"), 'clicking a locked pack must use the pack purchase/access flow');
assert(picker.includes("active.product&&!owns(active.product)"), 'an open pack must close if ownership is lost');
assert(pickerCss.includes("theme-picker-pack-locked .theme-pack-stack::after"), 'lock badge must be drawn on the pack artwork');
assert(html.includes('theme-picker.css?v=20260924-pack-artwork-1'), 'theme picker CSS cache buster must be updated');
assert(html.includes('animated-themes.css?v=20260924-pack-artwork-1'), 'animated theme CSS cache buster must be updated');
assert(html.includes('theme-picker.js?v=20260924-pack-artwork-1'), 'theme picker JS cache buster must be updated');
assert(html.includes('lesson-planner.js?v=20260924-read-budget-1'), 'planner cloud fix cache buster must remain intact');
assert(html.includes('firebase-auth.js?v=20260924-read-budget-1'), 'planner auth cloud fix cache buster must remain intact');

console.log('Theme packs: raster+SVG preview fallback, pack-level locking, purchase routing, and cache busting passed');
