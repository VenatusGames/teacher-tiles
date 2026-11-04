import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicClass,createClassConnectClient} from '../class-connect/client.js';
const source='11111111-1111-4111-8111-111111111111';
const roster={id:'class-a',name:'Owls',logo:'🦉',students:['Amy Lee'],studentProfiles:{'student:amy lee':{emoji:'🐸',image:''}},starChart:{wholeClassStars:50}};
function setup(){let uid='owner',calls=[],events=[],fail=false;const api=createClassConnectClient({getUid:()=>uid,announce:e=>events.push(e),call:async(name,data)=>{calls.push({name,data});if(fail)throw Error('Offline');return {changed:0};}});return {api,calls,events,set uid(v){uid=v;},set fail(v){fail=v;}};}
test('The projection matches Class View avatars and excludes PBIS, IDs and private objects',()=>{
 const shared=publicClass(roster);assert.equal(shared.students[0].initials,'AL');assert.equal(shared.students[0].emoji,'🐸');assert.equal(shared.starChart,undefined);assert.equal(shared.id,undefined);assert.equal(shared.students[0].studentProfiles,undefined);
});
test('PBIS-only saves do not call the server again; roster edits do',async()=>{
 const h=setup();await h.api.sync([roster],'owner',source);await h.api.sync([{...roster,starChart:{wholeClassStars:999}}],'owner',source);assert.equal(h.calls.length,1);
 await h.api.sync([{...roster,name:'Robins'}],'owner',source);assert.equal(h.calls.length,2);assert.equal(h.calls[1].data.classes[0].view.name,'Robins');assert.equal(h.calls[1].data.sourceRevision,source);
});
test('Failed sync retries the last saved public snapshot without retaining reward data',async()=>{
 const h=setup();h.fail=true;await assert.rejects(h.api.sync([roster],'owner',source),/Offline/);h.fail=false;await h.api.retry();assert.equal(h.calls.length,2);assert.deepEqual(h.calls[0].data,h.calls[1].data);await h.api.retry();assert.equal(h.calls.length,2);assert.equal(h.events.at(-1).status,'saved');
});
test('Queued saves and failed retries cannot leak across an account switch',async()=>{
 const h=setup();const queued=h.api.sync([roster],'owner',source);h.uid='other';await assert.rejects(queued,/Sign in/);assert.equal(h.calls.length,0);
 h.uid='owner';h.fail=true;await assert.rejects(h.api.sync([roster],'owner',source));h.uid='other';await h.api.retry();assert.equal(h.calls.length,1);
});
