const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../tiles/random-number/index.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../tiles/random-number/styles.css'), 'utf8');
const index = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

const registry = new Map();
class HTMLElement {}
const sandbox = {
  window: {}, document: {}, HTMLElement,
  customElements: { get:name=>registry.get(name), define:(name,ctor)=>registry.set(name,ctor) },
  crypto: require('node:crypto').webcrypto,
  Uint32Array, Number, Math, Object,
  notifyBoardChanged() {}
};
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const api = sandbox.window.TeacherTilesRandomNumber;
assert(api);
assert.deepEqual(Array.from(api.normalizeRange(20,5)), [5,20]);
assert(api.widthScaleFor('7') > api.widthScaleFor('77'));
assert(api.widthScaleFor('-999999999') > 0);
for(let i=0;i<1000;i++){const v=api.randomInclusive(-12,27);assert(v>=-12&&v<=27&&Number.isInteger(v));}

function control(value=''){
  return {value,textContent:'',style:{values:{},setProperty(k,v){this.values[k]=v}},dataset:{},listeners:{},addEventListener(t,fn){this.listeners[t]=fn},setAttribute(k,v){this[k]=v},blur(){}};
}
const display=control(), valueEl=control(), minInput=control('1'), maxInput=control('100'), generate=control();
const controls=new Map([['.random-number-display',display],['.random-number-value',valueEl],['.random-number-min',minInput],['.random-number-max',maxInput],['.random-number-generate',generate]]);
const tile={dataset:{},querySelector:s=>controls.get(s)||null};
api.setup(tile);
assert.equal(tile._randomNumberReady,true);
assert.equal(tile.dataset.randomNumberReady,undefined);
tile._boardSetState({min:10,max:30,value:17});
assert.deepEqual(JSON.parse(JSON.stringify(tile._boardGetState())),{min:10,max:30,value:17});
assert.equal(valueEl.textContent,'17');
assert.equal(valueEl.dataset.length,'2');
assert.match(valueEl.style.values['--random-number-width-size'],/cqw$/);
minInput.value='-5';maxInput.value='5';generate.listeners.click();
assert(tile._boardGetState().value>=-5&&tile._boardGetState().value<=5);

// Regression: earlier builds persisted data-random-number-ready="true".
// Board restore reapplies dataset before connecting the custom element, which
// used to make setup() return early and leave Generate/state restore dead.
const restoredValue=control(), restoredDisplay=control(), restoredMin=control('1'), restoredMax=control('100'), restoredGenerate=control();
const restoredControls=new Map([['.random-number-display',restoredDisplay],['.random-number-value',restoredValue],['.random-number-min',restoredMin],['.random-number-max',restoredMax],['.random-number-generate',restoredGenerate]]);
const restoredTile={dataset:{randomNumberReady:'true'},querySelector:s=>restoredControls.get(s)||null};
api.setup(restoredTile);
assert.equal(restoredTile._randomNumberReady,true);
assert.equal(restoredTile.dataset.randomNumberReady,undefined);
assert.equal(typeof restoredGenerate.listeners.click,'function');
assert.equal(typeof restoredTile._boardSetState,'function');
restoredTile._boardSetState({min:40,max:50,value:44});
assert.equal(restoredValue.textContent,'44');
restoredGenerate.listeners.click();
assert(restoredTile._boardGetState().value>=40&&restoredTile._boardGetState().value<=50);

assert(index.includes('data-module="randomnumber" data-category="math tools"'));
assert(index.includes('tiles/random-number/styles.css?v=20260924-6'));
assert(index.includes('tiles/random-number/index.js?v=20260924-7'));
assert(source.includes('--random-number-width-size'));
assert(!source.includes('ResizeObserver'));
assert(!source.includes('requestAnimationFrame'));
assert(!source.includes('getBoundingClientRect'));
assert(!source.includes('teachertiles:boardloaded'));
assert(css.includes('container-type:size'));
assert(css.includes('font-size:min(92cqh,var(--random-number-width-size))'));
assert(css.includes('.random-number-module:hover .random-number-display{bottom:146px}'));
assert(!css.includes('--random-number-idle-size'));
assert(!css.includes('--random-number-hover-size'));
console.log('Random Number: restored-tile initialization, Generate after refresh, state restore, CSS scaling, hover slide, range normalization, Math/Tools registration, and persistence passed.');
