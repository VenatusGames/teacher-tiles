const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let draws=[4294967295,4294967294,4294967293,4294967292,0,1,2,3,4,5];
const context={window:{},crypto:{getRandomValues(a){a[0]=draws.shift();return a;}}};
vm.runInNewContext(fs.readFileSync(`${__dirname}/index.js`,'utf8'),context);
assert.deepEqual(Array.from({length:6},()=>context.window.TeacherTilesDice.value()),[1,2,3,4,5,6]);
assert.equal(draws.length,0);console.log('Dice: rejects biased overflow values and maps all six faces correctly.');

for(const [w,h] of [[140,90],[300,250],[900,650],[250,900],[1200,280]])for(let count=1;count<=4;count++){const g=context.window.TeacherTilesDice.layout(w,h,count);assert(g.size>0);assert(g.cols*g.size+(g.cols-1)*g.gap<=w+.01);assert(g.rows*g.size+(g.rows-1)*g.gap<=h+.01);assert(g.rows*g.cols>=count);}
assert(context.window.TeacherTilesDice.layout(900,650,4).size>context.window.TeacherTilesDice.layout(300,250,4).size*2);
console.log('Dice: all counts fit wide and tall areas and grow beyond the old size cap.');
