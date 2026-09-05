const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let draws=[4294967295,4294967294,4294967293,4294967292,0,1,2,3,4,5];
const context={window:{},crypto:{getRandomValues(a){a[0]=draws.shift();return a;}}};
vm.runInNewContext(fs.readFileSync(`${__dirname}/index.js`,'utf8'),context);
assert.deepEqual(Array.from({length:6},()=>context.window.TeacherTilesDice.value()),[1,2,3,4,5,6]);
assert.equal(draws.length,0);console.log('Dice: rejects biased overflow values and maps all six faces correctly.');
