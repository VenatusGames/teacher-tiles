const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={window:{}};vm.runInNewContext(fs.readFileSync(`${__dirname}/index.js`,'utf8'),context);
const {layout,shuffle}=context.window.TeacherTilesSeating;
for(const kind of ['rows','groups','horseshoe'])for(let n=1;n<=80;n++){
  const seats=layout(n,kind);assert.equal(seats.length,n);assert.equal(new Set(seats.map(p=>`${p.x},${p.y}`)).size,n);
  for(const p of seats)assert.ok(p.x>=0&&p.x<=91&&p.y>=10&&p.y<=91);
}
const names=['Alex','Blair','Casey','Devon'];assert.deepEqual([...shuffle(names)].sort(),[...names].sort());
console.log('Seating: 240 layout cases stay inside the room without duplicate positions; shuffling preserves students.');
