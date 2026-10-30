const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={window:{}};vm.runInNewContext(fs.readFileSync(`${__dirname}/index.js`,'utf8'),context);
const {layout,shuffle}=context.window.TeacherTilesSeating;
for(const kind of ['rows','groups','horseshoe'])for(let n=1;n<=80;n++){
  const seats=layout(n,kind);assert.equal(seats.length,n);assert.equal(new Set(seats.map(p=>`${p.x},${p.y}`)).size,n);
  for(const p of seats)assert.ok(p.x>=0&&p.x<=91&&p.y>=10&&p.y<=91);
}
const names=['Alex','Blair','Casey','Devon'];assert.deepEqual([...shuffle(names)].sort(),[...names].sort());
console.log('Seating: 240 layout cases stay inside the room without duplicate positions; shuffling preserves students.');

vm.runInNewContext(fs.readFileSync(`${__dirname}/furniture.js`,'utf8'),context);
const F=context.window.TeacherTilesSeatingFurniture,room={width:800,height:400},sizeOf=kind=>kind==='large'?[20,10]:[9,9];
const target={id:'target',kind:'desk',x:40,y:40,angle:0};
const near={id:'move',kind:'desk',x:31.6,y:40,angle:0};
assert.equal(F.snap(near,[target],sizeOf,room).item.x,31,'adjacent edges meet exactly');
assert.equal(F.snap(near,[target],sizeOf,room,true).item.x,31.6,'Alt bypasses snapping');
assert.equal(F.snap({...near,x:25},[target],sizeOf,room).item.x,25,'distant furniture does not jump');
const rotated={id:'rotated',kind:'large',x:-10,y:20,angle:90};
const fitted=F.contain(rotated,sizeOf('large'),room),box=F.bounds(fitted,sizeOf('large'),room);
assert.equal(box.x,0);assert(box.y>=10&&box.y+box.h<=100);
const rotatedSnap=F.snap({id:'move',kind:'desk',x:5.7,y:20,angle:0},[fitted],sizeOf,room);
assert.equal(rotatedSnap.item.x,5,'snaps against actual rotated edge');
console.log('Seating furniture: edge snapping, free movement, distance threshold, rotated bounds and containment.');
