const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const context={window:{}};
vm.runInNewContext(fs.readFileSync(`${__dirname}/hourglass.js`,'utf8'),context);
const {sandLevels}=context.window.TeacherTilesHourglass;
let previous=sandLevels(0);
const width=y=>{const t=Math.min(1,Math.abs(y-190)/125);return 2.4+76*t*t*(3-2*t);};
function area(p){
  const levels=sandLevels(p);let grains=0;
  for(let y=65;y<315;y++)for(let x=150-width(y);x<150+width(y);x++){
    if(y<190 && p<1 && y>=levels.top+8*Math.exp(-Math.abs(x-150)/13))grains++;
    if(y>=190 && p>0 && y>=levels.bottom+.48*Math.abs(x-150))grains++;
  }
  return grains;
}
const full=area(0);
for(let i=0;i<=100;i++){
  const p=i/100,levels=sandLevels(p);
  assert.ok(levels.top>=previous.top,'Upper sand must drain down');
  assert.ok(levels.bottom<=previous.bottom,'Lower sand must build up');
  assert.ok(Math.abs(area(p)-full)<full*.005,'Total sand area must stay constant');
  previous=levels;
}
assert.equal(sandLevels(-1).progress,0);
assert.equal(sandLevels(2).progress,1);
assert.equal(sandLevels(NaN).progress,0);
console.log('Hourglass checks passed: monotonic draining/filling and conserved sand area at 101 timer positions.');
vm.runInNewContext(fs.readFileSync(`${__dirname}/garden-rocket.js`,'utf8'),context);
const {growth}=context.window.TeacherTilesGardenRocket;
for(const total of [1,8,60,300,3600]) {
  let prior=growth(0,total);
  for(let i=1;i<=1000;i++) {
    const current=growth(i/1000,total);
    for(const part of ['seed','stem','leaves','bud','bloom']) {
      assert.ok(current[part]>=prior[part] && current[part]<=1,`${part} must grow monotonically`);
    }
    if(current.seed<1)assert.equal(current.stem,0,'Seed must land before growth');
    if(current.bloom>0)assert.equal(current.bud,1,'Bud must form before petals open');
    prior=current;
  }
  assert.equal(prior.bloom,1,'Every duration must reach full bloom');
  assert.equal(prior.label,'In full bloom');
}
assert.equal(growth(0).seed,0,'Reset restores the floating seed');
assert.equal(growth(0).bloom,0,'Reset removes the flower');
console.log('Sunflower checks passed: ordered planting and growth for five timer durations.');
