const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../tiles/random-number/index.js'), 'utf8');
const index = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

const registry = new Map();
class HTMLElement {}
const sandbox = {
  window: {},
  HTMLElement,
  customElements: {
    get: name => registry.get(name),
    define: (name, ctor) => registry.set(name, ctor)
  },
  crypto: require('node:crypto').webcrypto,
  Uint32Array,
  Number,
  Math,
  Object,
  requestAnimationFrame: fn => { fn(); return 1; },
  cancelAnimationFrame() {},
  ResizeObserver: class { observe() {} disconnect() {} },
  notifyBoardChanged() {}
};
vm.createContext(sandbox);
vm.runInContext(source, sandbox);

const api = sandbox.window.TeacherTilesRandomNumber;
assert(api, 'Random Number API should be registered');
assert.deepEqual(Array.from(api.normalizeRange(20, 5)), [5, 20], 'reversed bounds should normalize');
assert.deepEqual(Array.from(api.normalizeRange(-4, 9)), [-4, 9]);
for (let i = 0; i < 5000; i += 1) {
  const value = api.randomInclusive(-12, 27);
  assert(value >= -12 && value <= 27 && Number.isInteger(value));
}
assert(registry.has('teacher-random-number'), 'custom element must register before tiles are created');

function control(value = '') {
  return {
    value,
    textContent: '',
    style: {},
    clientWidth: 340,
    clientHeight: 280,
    listeners: {},
    addEventListener(type, fn) { this.listeners[type] = fn; },
    setAttribute(name, value) { this[name] = value; },
    getBoundingClientRect() {
      const size = Number.parseFloat(this.style.fontSize) || 100;
      return { width: Math.max(1, String(this.textContent || '').length * size * .58), height: size * .78 };
    },
    blur() {}
  };
}
const display = control();
const valueElement = control('1');
valueElement.textContent = '1';
const minInput = control('1');
const maxInput = control('100');
const generateButton = control();
const controls = new Map([
  ['.random-number-display', display],
  ['.random-number-value', valueElement],
  ['.random-number-min', minInput],
  ['.random-number-max', maxInput],
  ['.random-number-generate', generateButton]
]);
const cssVars = {};
const tile = {
  dataset: {},
  clientWidth: 360,
  clientHeight: 300,
  style: { setProperty(name, value) { cssVars[name] = value; } },
  querySelector(selector) { return controls.get(selector) || null; }
};
api.setup(tile);
assert.equal(tile.dataset.randomNumberReady, 'true');
assert.equal(typeof tile._boardGetState, 'function');
assert.equal(typeof tile._boardSetState, 'function');
tile._boardSetState({ min: 30, max: 10, value: 17 });
assert.deepEqual(JSON.parse(JSON.stringify(tile._boardGetState())), { min: 10, max: 30, value: 17 });
assert.equal(valueElement.textContent, '17');
assert(Number.parseFloat(cssVars['--random-number-idle-size']) > 200, 'idle number should scale large enough to dominate the tile');
assert(Number.parseFloat(cssVars['--random-number-hover-size']) > 80, 'hover number should retain a large fitted size');
assert(Number.parseFloat(cssVars['--random-number-hover-size']) < Number.parseFloat(cssVars['--random-number-idle-size']), 'hover size should be smaller because controls reserve space');
minInput.value = '-5';
maxInput.value = '5';
generateButton.listeners.click();
const generated = tile._boardGetState();
assert(generated.value >= -5 && generated.value <= 5);

assert(index.includes('data-module="randomnumber" data-category="math tools"'), 'Random Number must be in Math and Tools');
assert(index.includes('id="randomnumber-template"'), 'Random Number template must exist');
assert(index.includes('tiles/random-number/styles.css'), 'Random Number stylesheet must load');
assert(index.includes('tiles/random-number/index.js'), 'Random Number script must load');
assert(index.includes('class="random-number-value"'), 'Random Number must use a separately measured value element');
assert(source.includes('module._boardGetState'), 'Random Number state must save with boards');
assert(source.includes('module._boardSetState'), 'Random Number state must restore with boards');
assert(source.includes('getBoundingClientRect()'), 'Random Number must size against the actual rendered number bounds');
assert(source.includes('resizeObserver.observe(module)'), 'Random Number must resize from the stable tile bounds, not the animated display bounds');
assert(!source.includes('resizeObserver.observe(display)'), 'animated hover display must not drive ResizeObserver sizing');
assert(source.includes("valueElement.style.transition = 'none'"), 'measurement must disable font-size transitions before reading bounds');

const css = fs.readFileSync(path.join(__dirname, '../tiles/random-number/styles.css'), 'utf8');
assert(css.includes('.random-number-display{position:absolute;left:6px;right:6px;top:6px;bottom:6px'), 'number display must fill the tile while controls are hidden');
assert(css.includes('left:50%;bottom:58px'), 'controls must be centered along the bottom while staying above tile buttons');
assert(css.includes('transform:translate(-50%,5px)'), 'hidden controls must remain horizontally centered');
assert(css.includes('.random-number-module:hover .random-number-controls{'), 'range and Generate controls must appear on tile hover');
assert(css.includes('.random-number-module:hover .random-number-display{bottom:146px}'), 'hover controls must reserve bottom space so the number slides upward');
assert(css.includes('.random-number-value{display:block;width:max-content;max-width:none;font-size:var(--random-number-idle-size)'), 'idle number must use the precomputed stable fit');
assert(css.includes('.random-number-module:hover .random-number-value{font-size:var(--random-number-hover-size)}'), 'hover must transition to a separately precomputed stable fit');
assert(css.includes('transition:bottom .18s cubic-bezier(.2,.8,.2,1)'), 'number stage must animate smoothly as controls appear and disappear');
assert(css.includes('transition:font-size .18s cubic-bezier(.2,.8,.2,1)'), 'number must smoothly rescale between stable idle and hover sizes');
assert(!css.includes('.random-number-controls:focus-within'), 'controls must not stay visible after the pointer leaves just because an input retained focus');
assert(css.includes('opacity:0;visibility:hidden;pointer-events:none'), 'range and Generate controls must hide when the tile is idle');
const randomTemplate = index.slice(index.indexOf('<template id="randomnumber-template">'), index.indexOf('</template>', index.indexOf('<template id="randomnumber-template">')));
assert(randomTemplate.indexOf('random-number-generate') < randomTemplate.indexOf('random-number-min'), 'Generate must be above the Min/Max row');
console.log('Random Number: stable initial scaling, full-tile fit, hover reserve/slide, centered controls, resize fit, generation, range normalization, Math/Tools registration, and board persistence passed.');
