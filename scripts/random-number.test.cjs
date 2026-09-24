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
  requestAnimationFrame: fn => fn(),
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
    clientWidth: 300,
    clientHeight: 150,
    scrollWidth: 200,
    scrollHeight: 100,
    listeners: {},
    addEventListener(type, fn) { this.listeners[type] = fn; },
    setAttribute(name, value) { this[name] = value; },
    blur() {}
  };
}
const display = control();
const minInput = control('1');
const maxInput = control('100');
const generateButton = control();
const controls = new Map([
  ['.random-number-display', display],
  ['.random-number-min', minInput],
  ['.random-number-max', maxInput],
  ['.random-number-generate', generateButton]
]);
const tile = {
  dataset: {},
  querySelector(selector) { return controls.get(selector) || null; }
};
api.setup(tile);
assert.equal(tile.dataset.randomNumberReady, 'true');
assert.equal(typeof tile._boardGetState, 'function');
assert.equal(typeof tile._boardSetState, 'function');
tile._boardSetState({ min: 30, max: 10, value: 17 });
assert.deepEqual(JSON.parse(JSON.stringify(tile._boardGetState())), { min: 10, max: 30, value: 17 });
assert.equal(display.textContent, '17');
minInput.value = '-5';
maxInput.value = '5';
generateButton.listeners.click();
const generated = tile._boardGetState();
assert(generated.value >= -5 && generated.value <= 5);

assert(index.includes('data-module="randomnumber" data-category="math tools"'), 'Random Number must be in Math and Tools');
assert(index.includes('id="randomnumber-template"'), 'Random Number template must exist');
assert(index.includes('tiles/random-number/styles.css'), 'Random Number stylesheet must load');
assert(index.includes('tiles/random-number/index.js'), 'Random Number script must load');
assert(source.includes('module._boardGetState'), 'Random Number state must save with boards');
assert(source.includes('module._boardSetState'), 'Random Number state must restore with boards');
console.log('Random Number: generation, range normalization, Math/Tools registration, and board persistence passed.');
