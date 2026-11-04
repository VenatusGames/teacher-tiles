import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicClass,createClassConnectClient} from '../class-connect/client.js';
const source='11111111-1111-4111-8111-111111111111';
const roster={id:'class-a',name:'Owls',logo:'🦉',students:['Amy Lee'],studentProfiles:{'student:amy lee':{emoji:'🐸',image:''}},starChart:{wholeClassStars:50}};
function setup(){let uid='owner',calls=[],events=[],fail=false;const api=createClassConnectClient({getUid:()=>uid,announce:e=>events.push(e),call:async(name,data)=>{calls.push({name,data});if(fail)throw Error('Offline');return {changed:0};}});return {api,calls,events,set uid(v){uid=v;},set fail(v){fail=v;}};}
test('The projection matches Class View avatars and excludes raw PBIS maps and private account objects',()=>{
 const shared=publicClass(roster);assert.equal(shared.students[0].initials,'AL');assert.equal(shared.students[0].emoji,'🐸');assert.equal(shared.starChart,undefined);assert.equal(shared.id,undefined);assert.equal(shared.students[0].studentProfiles,undefined);
});
test('Private whole-class saves do not call the server again; shared roster edits do',async()=>{
 const h=setup();await h.api.sync([roster],'owner',source);await h.api.sync([{...roster,starChart:{wholeClassStars:999}}],'owner',source);assert.equal(h.calls.length,1);
 await h.api.sync([{...roster,name:'Robins'}],'owner',source);assert.equal(h.calls.length,2);assert.equal(h.calls[1].data.classes[0].view.name,'Robins');assert.equal(h.calls[1].data.sourceRevision,source);
});
test('Failed sync retries the last saved public snapshot without retaining private reward maps',async()=>{
 const h=setup();h.fail=true;await assert.rejects(h.api.sync([roster],'owner',source),/Offline/);h.fail=false;await h.api.retry();assert.equal(h.calls.length,2);assert.deepEqual(h.calls[0].data,h.calls[1].data);await h.api.retry();assert.equal(h.calls.length,2);assert.equal(h.events.at(-1).status,'saved');
});
test('Queued saves and failed retries cannot leak across an account switch',async()=>{
 const h=setup();const queued=h.api.sync([roster],'owner',source);h.uid='other';await assert.rejects(queued,/Sign in/);assert.equal(h.calls.length,0);
 h.uid='owner';h.fail=true;await assert.rejects(h.api.sync([roster],'owner',source));h.uid='other';await h.api.retry();assert.equal(h.calls.length,1);
});

test('Only enabled individual rewards and teacher permissions enter the projection',()=>{
 const shared=publicClass({...roster,studentBoards:true,allowStudentEmojiEditing:true,pbisStats:{eggPoints:false},starChart:{studentStars:{'student:amy lee':8}}});
 assert.equal(shared.students[0].rewards.stars,8);assert.equal(shared.students[0].rewards.eggPoints,undefined);assert.equal(shared.studentBoards,true);assert.equal(shared.allowStudentEmojiEditing,true);
 assert.deepEqual(publicClass({...roster,pbisEnabled:false}).students[0].rewards,{});
});
test('Student point changes sync, while disabled reward changes do not',async()=>{
 const h=setup();const c={...roster,pbisStats:{eggPoints:false}};await h.api.sync([c],'owner',source);
 await h.api.sync([{...c,eggHatching:{studentPoints:{'student:amy lee':6}}}],'owner',source);assert.equal(h.calls.length,1);
 await h.api.sync([{...c,starChart:{studentStars:{'student:amy lee':7}}}],'owner',source);assert.equal(h.calls.length,2);
});
test('Teacher avatar cache respects student identity, avatar versions and account scope',async()=>{
 let uid='owner';const api=createClassConnectClient({getUid:()=>uid,announce:()=>{},call:async()=>({edits:{a:{studentId:'alice-id',emoji:'🐸',avatarVersion:'v1'}}})});
 const profile={id:'alice-id',avatarVersion:'v1',emoji:'🦉',image:''};await api.refreshAvatars('class-a');assert.equal(api.resolveProfile('class-a',profile).emoji,'🐸');assert.equal(api.resolveProfile('class-b',profile).emoji,'🦉');assert.equal(api.resolveProfile('class-a',{...profile,avatarVersion:'v2'}).emoji,'🦉');uid='other';assert.equal(api.resolveProfile('class-a',profile).emoji,'🦉');
});

test('Legacy grade-level PBIS defaults match Class View unless explicitly overridden',()=>{
 for(const gradeLevel of ['7','12','Higher-Ed']){const view=publicClass({...roster,gradeLevel});assert.equal(view.pbisEnabled,false);assert.deepEqual(view.students[0].rewards,{});}
 assert.equal(publicClass({...roster,gradeLevel:'6'}).pbisEnabled,true);assert.equal(publicClass({...roster,gradeLevel:'12',pbisEnabled:true}).pbisEnabled,true);
});

test('PINs are separated from the public projection and changing one triggers a teacher sync',async()=>{
 const h=setup(),c={...roster,requireStudentPin:true,studentProfiles:{'student:amy lee':{id:'alice',pin:[0,1,2]}}};
 assert.equal(publicClass(c).students[0].pin,undefined);assert.equal(publicClass(c).access,undefined);
 await h.api.sync([c],'owner',source);assert.deepEqual(h.calls[0].data.classes[0].access.pins,{alice:[0,1,2]});
 c.studentProfiles['student:amy lee'].pin=[3,4,5];await h.api.sync([c],'owner',source);assert.equal(h.calls.length,2);
});
