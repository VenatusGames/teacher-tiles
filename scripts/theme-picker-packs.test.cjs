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
assert(picker.includes("if(!owns(product)){requestAccess(card);return}"), 'locked variations must still use the purchase/access flow');
assert(picker.includes("heading.onclick=()=>open(group)"), 'packs remain browsable so locked variations can be favorited');
assert(picker.includes('assets/ui/lock.svg')&&picker.includes('Unlock</span>')&&pickerCss.includes('.theme-picker-pack-locked>.theme-picker-lock'), 'theme packs must use the shared lock artwork and Unlock label');
assert(html.includes('theme-picker.css?v='), 'theme picker CSS cache buster must be updated');
assert(html.includes('animated-themes.css?v='), 'animated theme CSS cache buster must be updated');
assert(html.includes('theme-picker.js?v='), 'theme picker JS cache buster must be updated');
assert(html.includes('lesson-planner.js?v='), 'planner cloud fix cache buster must remain intact');
assert(html.includes('firebase-auth.js?v='), 'planner auth cloud fix cache buster must remain intact');

console.log('Theme packs: raster+SVG preview fallback, pack-level locking, purchase routing, and cache busting passed');
