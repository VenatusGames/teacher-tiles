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
