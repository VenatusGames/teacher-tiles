const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const contract=require('../templates/contract.js');
const backend=process.env.TT_FUNCTIONS_DIR||path.resolve(__dirname,'../../../teacher-tiles-functions/functions');
const board={objects:[{type:'sticky',editables:[{index:0,html:'<b>Welcome</b><script>alert(1)</script><img src=x onerror=alert(1)>'}],transform:{left:100,top:120,width:250,height:200},dataset:{bg:'white',activeClassId:'PRIVATE'},special:{students:['PRIVATE']}}]};
function fixture(){
 const records=new Map();let serial=0;const stats={reads:0};
 const snapshot=ref=>({id:ref.id,ref,exists:records.has(ref.key),data:()=>records.get(ref.key)});
 function collection(name,filters=[],maximum=Infinity,cursor=null,orders=[]){
  const field=(key,k)=>k==='__name__'?key.split('/').at(-1):records.get(key)[k];
  const cmp=(a,b)=>a<b?-1:a>b?1:0;
  const q={key:name,query:true,doc(id='auto'+(++serial)){const key=name+'/'+id;return {key,id,parent:collection(name),collection:sub=>collection(key+'/'+sub),get:async()=>{stats.reads++;return snapshot(q.doc(id));}};},where:(...f)=>collection(name,[...filters,f],maximum,cursor,orders),select:()=>q,orderBy:(...o)=>collection(name,filters,maximum,cursor,[...orders,o]),startAfter:(...v)=>collection(name,filters,maximum,v,orders),limit:n=>collection(name,filters,n,cursor,orders),get:async()=>{
   const actualOrders=orders.length?orders:[['__name__','asc']];const compare=(a,b)=>{for(const [k,dir] of actualOrders){const c=cmp(field(a,k),field(b,k))*(dir==='desc'?-1:1);if(c)return c;}return 0;};
   const keys=[...records.keys()].filter(k=>k.startsWith(name+'/')&&k.split('/').length===name.split('/').length+1).filter(k=>filters.every(([f,op,v])=>{const x=field(k,f);return op==='=='?x===v:op==='array-contains'?x?.includes(v):op==='in'?v.includes(x):x>v;})).sort(compare).filter(k=>{if(!cursor)return true;for(let i=0;i<actualOrders.length;i++){const [f,dir]=actualOrders[i],c=cmp(field(k,f),cursor[i])*(dir==='desc'?-1:1);if(c)return c>0;}return false;}).slice(0,maximum);stats.reads+=keys.length;return {docs:keys.map(k=>snapshot(q.doc(k.split('/').at(-1)))),size:keys.length};}};return q;
 }
 const db={collection,recursiveDelete:async ref=>{for(const key of records.keys())if(key===ref.key||key.startsWith(ref.key+'/'))records.delete(key);},runTransaction:async fn=>{const writes=[];const result=await fn({get:r=>r.get(),set:(r,v)=>writes.push(()=>records.set(r.key,structuredClone(v))),create:(r,v)=>writes.push(()=>records.set(r.key,structuredClone(v))),delete:r=>writes.push(()=>records.delete(r.key))});writes.forEach(w=>w());return result;}};
 class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
 const account=async r=>{if(!r.auth)throw new HttpsError('unauthenticated','Sign in');return {uid:r.auth.uid,customClaims:r.auth.uid==='admin'?{portalRole:'admin'}:{},emailVerified:true,email:r.auth.uid+'@example.com'};},developer=async r=>{if(r.auth?.uid!=='admin')throw new HttpsError('permission-denied','Admin only');return {uid:'admin'};};
 const modules={'./cosmetics-policy':require('../boards/cosmetics-policy.js'),'./cosmetics-catalog.json':require('../boards/cosmetics-catalog.json'),'firebase-admin/firestore':{getFirestore:()=>db,FieldValue:{serverTimestamp:()=>123},FieldPath:{documentId:()=>'__name__'}},'firebase-functions/v2/https':{onCall:(_,fn)=>fn,HttpsError},'../sandbox/admin-access':{requireAccount:account},'./sandbox/admin-access':{requireAccount:account},'../templates/contract':contract,'./admin-access':{requireDeveloper:developer},'./contract':contract,'./types.json':require(backend+'/templates/types.json'),'node:crypto':require('node:crypto')};
 function load(file){const exports={};vm.runInNewContext(fs.readFileSync(backend+'/'+file,'utf8'),{exports,require:n=>modules[n],console,Date,TextEncoder,URL,Buffer});return exports;}
 const nicknames=load('nicknames.js');modules['../nicknames']=nicknames;
 modules['./ticket-conversation']=modules['../ticket-conversation']=load('ticket-conversation.js');
 const reportApi=load('bug-reports.js'),reportAdmin=load('sandbox/bug-reports.js');
 const api=load('templates/index.js');modules['../templates']=api;const review=load('sandbox/templates.js').boardTemplateModeration;
 return {records,stats,nickname:(uid,nickname)=>nicknames.profileNickname({auth:uid?{uid}:null,data:{nickname}}),tickets:(uid,data={})=>reportApi.mySupportTickets({auth:uid?{uid}:null,data}),report:(uid,data)=>reportApi.submitBugReport({auth:uid?{uid}:null,data}),bugs:(uid,data)=>reportAdmin.developerBugReports({auth:uid?{uid}:null,data:{requestId:require('node:crypto').randomUUID(),...data}}),call:(uid,data)=>api.boardTemplates({auth:uid?{uid}:null,data:data.action==='import'?{clientVersion:1,supportedTypes:['sticky','richtext','timer'],...data}:data}),review:(uid,data)=>review({auth:uid?{uid}:null,data})};
}
const submission={action:'submit',title:'Morning welcome',description:'A calm welcome for the school day.',tags:['morning'],snapshot:board,confirmPrivacy:true};
test('export explicitly excludes private data, nested tab state, raw fields and executable HTML',()=>{
 const raw={...board,preferences:{private:'PRIVATE'},calendarEvents:['PRIVATE'],objects:[...board.objects,{type:'egghatching',fields:[{value:'PRIVATE'}],special:{activeClassId:'PRIVATE',students:['PRIVATE']},tabs:{items:[{type:'flowerpots',special:{activeClassId:'PRIVATE'}},{type:'sticky',editables:[{html:'Safe'}]}]}}]};
 const result=contract.sanitize(raw);const json=JSON.stringify(result.snapshot);assert(!json.includes('PRIVATE'));assert(!json.includes('script'));assert(!json.includes('onerror'));assert(json.includes('<b>Welcome</b>'));assert(result.warnings.length);assert.deepEqual(contract.sanitize(result.snapshot).snapshot,result.snapshot);
});
test('unsupported types and newer formats fail safely; templates and images are bounded',()=>{
 assert.throws(()=>contract.sanitize({...board,templateVersion:99}),/newer app/);assert.throws(()=>contract.sanitize({objects:Array.from({length:101},()=>({type:'sticky'}))}),/100 tiles/);
 assert.equal(contract.sanitize(board,{knownTypes:['timer']}).snapshot.objects.length,0);
 const result=contract.sanitize({objects:[{type:'image',special:{src:'https://untrusted.example/track.png'}}]});assert.equal(result.snapshot.objects[0].special.src,'');assert(result.warnings.length);
});
test('only manual admin approval publishes; stale review, resubmission, and author privacy are enforced',async()=>{
 const f=fixture();const {id}=await f.call('author',submission);assert.equal((await f.call('viewer',{action:'list'})).items.length,0);assert.equal((await f.call('author',{action:'list',mine:true})).items[0].status,'pending');
 await assert.rejects(f.call('viewer',{action:'detail',id}),{code:'not-found'});await assert.rejects(f.review('viewer',{action:'review',id,revision:1,decision:'approve'}),{code:'permission-denied'});
 await assert.rejects(f.review('admin',{action:'review',id,revision:9,decision:'approve'}),{code:'failed-precondition'});
 await f.review('admin',{action:'review',id,revision:1,decision:'send-back',feedback:'Please revise the title.'});assert.equal((await f.call('author',{action:'detail',id})).meta.feedback,'Please revise the title.');
 await f.call('author',{...submission,id});await f.review('admin',{action:'review',id,revision:2,decision:'approve'});
 const list=await f.call('viewer',{action:'list',search:'morning'});assert.equal(list.items.length,1);assert(!('owner' in list.items[0]));assert(!('snapshot' in list.items[0]));assert(!('inlineObjects' in list.items[0]));
 await assert.rejects(f.call('thief',{...submission,id}),{code:'permission-denied'});
});
test('votes and reports are unique; sixth report immediately removes listing and prevents imports',async()=>{
 const f=fixture(),{id}=await f.call('author',submission);await f.review('admin',{action:'review',id,revision:1,decision:'approve'});
 await f.call('voter',{action:'vote',id});await f.call('voter',{action:'vote',id});assert.equal((await f.call('voter',{action:'detail',id})).meta.votes,1);
 for(let i=0;i<5;i++)await f.call('reporter'+i,{action:'report',id,reason:'Please check the content.'});
 await f.call('reporter0',{action:'report',id,reason:'Duplicate report'});assert.equal((await f.call('viewer',{action:'list'})).items.length,1);
 await f.call('reporter5',{action:'report',id,reason:'Please check the content.'});assert.equal((await f.call('viewer',{action:'list'})).items.length,0);await assert.rejects(f.call('viewer',{action:'import',id,requestId:'attempt'}),{code:'not-found'});
 assert.equal((await f.review('admin',{action:'list',status:'unlisted'})).items.length,1);
});
test('imports are independent, capacity checked and retry-safe; all author writes are screened',async()=>{
 const f=fixture(),{id}=await f.call('author',submission);await f.review('admin',{action:'review',id,revision:1,decision:'approve'});
 const first=await f.call('viewer',{action:'import',id,requestId:'once'});const retry=await f.call('viewer',{action:'import',id,requestId:'once'});assert.equal(first.boardId,retry.boardId);assert(retry.alreadyCreated);
 await f.call('viewer',{action:'import',id,requestId:'twice'});await assert.rejects(f.call('viewer',{action:'import',id,requestId:'third'}),{code:'resource-exhausted'});
 assert.equal(f.records.get('users/viewer/boards/'+first.boardId).inlineObjects[0].editables[0].html,'<b>Welcome</b>');
 await assert.rejects(f.call(null,{action:'list'}),{code:'unauthenticated'});await assert.rejects(f.call('bad',{...submission,title:'porn collection'}),{code:'invalid-argument'});await assert.rejects(f.call('bad',{...submission,confirmPrivacy:false}),{code:'failed-precondition'});
 for(let i=0;i<3;i++)await f.call('busy',submission);await assert.rejects(f.call('busy',submission),{code:'resource-exhausted'});
});

test('frontend and server export contracts and tile catalogs stay in sync',()=>{
 assert.equal(fs.readFileSync(path.resolve(__dirname,'../templates/contract.js'),'utf8'),fs.readFileSync(backend+'/templates/contract.js','utf8'));
 const html=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8');const expected=[...html.matchAll(/<template id="([a-z0-9-]+)-template"/g)].map(m=>m[1]).concat('sticker');assert.deepEqual(new Set(require(backend+'/templates/types.json')),new Set(expected));
});
test('imports adapt to the receiving app and migrate retired Rainbow Breath tiles',async()=>{
 const migrated=contract.sanitize({objects:[{type:'rainbowbreath'}]},{knownTypes:['meditation']});assert.equal(migrated.snapshot.objects[0].type,'meditation');assert.equal(migrated.snapshot.objects[0].dataset.tileSkin,'meditation-rainbow');
 const f=fixture(),{id}=await f.call('author',submission);await f.review('admin',{action:'review',id,revision:1,decision:'approve'});
 await assert.rejects(f.call('viewer',{action:'import',id,requestId:'older',clientVersion:99}),{code:'failed-precondition'});
 await assert.rejects(f.call('viewer',{action:'import',id,requestId:'unavailable',supportedTypes:['timer']}),{code:'failed-precondition'});
});

test('only the author may edit or delete; edits preserve votes but require a fresh approval',async()=>{
 const f=fixture(),{id}=await f.call('author',submission);await f.review('admin',{action:'review',id,revision:1,decision:'approve',official:false});await f.call('voter',{action:'vote',id});
 await assert.rejects(f.call('other',{action:'delete',id}),{code:'permission-denied'});
 await assert.rejects(f.call('other',{action:'edit',id,title:'New title',description:'A better description.'}),{code:'permission-denied'});
 await f.call('author',{action:'edit',id,title:'Updated board',description:'A new reviewed description.',tags:['math'],official:true});
 const detail=await f.call('author',{action:'detail',id});assert.equal(detail.meta.status,'pending');assert.equal(detail.meta.votes,1);assert.equal(detail.meta.official,false);assert.equal((await f.call('viewer',{action:'discover'})).curated.length,0);
 await assert.rejects(f.review('admin',{action:'review',id,revision:1,decision:'approve'}),{code:'failed-precondition'});
 await f.review('admin',{action:'review',id,revision:2,decision:'approve'});await f.call('voter',{action:'vote',id});assert.equal((await f.call('voter',{action:'detail',id})).meta.votes,1);
 const imported=await f.call('reader',{action:'import',id,requestId:'copy'});await f.call('author',{action:'delete',id});assert.equal((await f.call('author',{action:'list',mine:true})).items.length,0);assert(!f.records.has('_boardTemplateBodies/'+id));assert(![...f.records.keys()].some(k=>k.startsWith('_boardTemplates/'+id)));assert(f.records.has('users/reader/boards/'+imported.boardId));
});
test('discovery ranks globally, only admin-approved official boards are curated, and tags support paging',async()=>{
 const f=fixture();for(let i=0;i<15;i++){const {id}=await f.call('author'+i,{...submission,tags:i%2?['math']:['morning'],official:true});await f.review('admin',{action:'review',id,revision:1,decision:'approve',official:i===3});for(let j=0;j<i;j++)await f.call('voter'+j,{action:'vote',id});}
 const before=f.stats.reads,home=await f.call('viewer',{action:'discover'});assert.equal(f.stats.reads-before,13);assert.equal(home.featured.length,0);assert.equal(home.curated.length,1);assert.equal(home.curated[0].votes,3);assert(home.highlyRated[0].preview.objects.length);
 const first=await f.call('viewer',{action:'list'}),second=await f.call('viewer',{action:'list',cursor:first.cursor});assert.equal(first.items.length,12);assert.equal(second.items.length,3);assert.equal(new Set([...first.items,...second.items].map(x=>x.id)).size,15);
 const tagged=await f.call('viewer',{action:'list',tag:'math'});assert(tagged.items.every(m=>m.tags.includes('math')));assert.equal(tagged.items[0].votes,13);
});

test('ten tags are supported and admins can search and delete every template status',async()=>{
 const f=fixture(),tags=Array.from({length:10},(_,i)=>'tag'+i),{id}=await f.call('author',{...submission,tags});assert.equal((await f.call('author',{action:'detail',id})).meta.tags.length,10);
 assert.equal((await f.review('admin',{action:'list',status:'all',search:'tag9'})).items.length,1);
 await f.review('admin',{action:'review',id,revision:1,decision:'approve'});assert.equal((await f.review('admin',{action:'list',status:'all',search:'tag9'})).items[0].status,'approved');
 await assert.rejects(f.review('other',{action:'delete',id}),{code:'permission-denied'});await f.review('admin',{action:'delete',id});assert.equal((await f.call('viewer',{action:'list'})).items.length,0);assert(!f.records.has('_boardTemplateBodies/'+id));
});
test('bug reporting is private, bounded, retry-safe, and only admins may track status',async()=>{
 const f=fixture(),data={category:'Saving & syncing',title:'A saved board disappeared',description:'After refreshing the browser, my saved board disappeared.',requestId:'1234567890abcdef'};
 await assert.rejects(f.report(null,data),{code:'unauthenticated'});const {id}=await f.report('author',data);await f.report('author',data);assert.equal((await f.bugs('admin',{action:'list'})).items.length,1);
 await assert.rejects(f.bugs('author',{action:'detail',id}),{code:'permission-denied'});await assert.rejects(f.bugs('author',{action:'update',id,status:'complete',revision:1}),{code:'permission-denied'});
 await f.bugs('admin',{action:'update',id,status:'in-progress',revision:1});assert.equal((await f.bugs('admin',{action:'detail',id})).report.status,'in-progress');
 await assert.rejects(f.bugs('admin',{action:'update',id,status:'complete',revision:1}),{code:'failed-precondition'});await f.bugs('admin',{action:'update',id,status:'complete',revision:2});assert.equal((await f.bugs('admin',{action:'list',status:'complete'})).items.length,1);
 await assert.rejects(f.report('author',{...data,category:'invalid'}),{code:'invalid-argument'});for(let i=1;i<5;i++)await f.report('author',{...data,requestId:'1234567890abcdef'+i});await assert.rejects(f.report('author',{...data,requestId:'1234567890abcdef6'}),{code:'resource-exhausted'});
});

test('nicknames are generated once, case-insensitively unique, replaceable, and server-attributed',async()=>{
 const f=fixture(),first=await f.nickname('author');assert.match(first.nickname,/^TeacherTiles-\d{9}$/);assert.equal((await f.nickname('author')).nickname,first.nickname);
 await f.nickname('author','Ms Willow');await assert.rejects(f.nickname('other','ms willow'),{code:'already-exists'});await assert.rejects(f.nickname('other','TeacherTiles'),{code:'invalid-argument'});await assert.rejects(f.nickname(null,'Hello'),{code:'unauthenticated'});
 await f.nickname('author','Ms Oak');await f.nickname('other','Ms Willow');const {id}=await f.call('author',{...submission,authorName:'Fake name'});assert.equal((await f.call('author',{action:'detail',id})).meta.authorName,'Ms Oak');
});
test('only developers claim and feature boards; claimed submissions cannot be changed by their former submitter',async()=>{
 const f=fixture(),{id}=await f.call('author',submission);await assert.rejects(f.review('author',{action:'curate',id,revision:1,featured:true}),{code:'permission-denied'});await assert.rejects(f.review('admin',{action:'curate',id,revision:1,featured:true}),{code:'failed-precondition'});
 await f.review('admin',{action:'review',id,revision:1,decision:'approve'});await f.call('voter',{action:'vote',id});await f.review('admin',{action:'curate',id,revision:1,official:true,featured:true});assert.equal((await f.call('author',{action:'list',mine:true})).items.length,0);assert.equal((await f.call('viewer',{action:'discover'})).featured[0].id,id);assert.equal((await f.review('admin',{action:'list',status:'featured'})).items.length,1);
 await assert.rejects(f.call('author',{action:'delete',id}),{code:'permission-denied'});await assert.rejects(f.call('author',{...submission,id}),{code:'permission-denied'});await f.call('voter',{action:'vote',id});assert.equal((await f.call('viewer',{action:'detail',id})).meta.votes,1);
 await f.review('admin',{action:'curate',id,revision:2,official:false,featured:false});assert.equal((await f.call('viewer',{action:'discover'})).featured.length,0);assert.equal((await f.call('author',{action:'list',mine:true})).items.length,1);
});
test('Support users see only their own tickets and never internal reviewer fields',async()=>{
 const f=fixture(),{id}=await f.report('author',{requestId:'support-purchase-0001',category:'Purchases & coins',title:'Missing coins',description:'My coin purchase has not shown up in my account.'});await f.bugs('admin',{action:'update',id,revision:1,status:'in-progress'});const own=await f.tickets('author');assert.equal(own.items.length,1);assert.equal(own.items[0].status,'in-progress');assert(!('updatedBy' in own.items[0]));assert.equal((await f.tickets('other')).items.length,0);await assert.rejects(f.tickets(null),{code:'unauthenticated'});
});

test('ticket conversations authorize both sides, log transitions, retry safely and reopen closed tickets',async()=>{
 const f=fixture(),{id}=await f.report('author',{requestId:'conversation-ticket-0001',category:'Other',title:'Please help',description:'I need assistance with my board.'});
 await assert.rejects(f.tickets('other',{action:'detail',id}),{code:'not-found'});await assert.rejects(f.tickets('other',{action:'reply',id,message:'Intruder',requestId:'intruder-reply-0001'}),{code:'not-found'});
 const update={action:'update',id,revision:1,status:'complete',message:'This is fixed now.',requestId:'developer-reply-0001'};await f.bugs('admin',update);await f.bugs('admin',update);
 let detail=await f.tickets('author',{action:'detail',id});assert.equal(detail.events.length,1);assert.equal(detail.events[0].message,'This is fixed now.');assert.equal(detail.events[0].fromStatus,'new');assert.equal(detail.events[0].status,'complete');assert(!('authorEmail' in detail.report));assert.equal((await f.tickets('author')).items.length,1);
 const reply={action:'reply',id,message:'Thank you, but I still see the issue.',requestId:'author-reply-000001'};await f.tickets('author',reply);await f.tickets('author',reply);detail=await f.tickets('author',{action:'detail',id});assert.equal(detail.events.length,2);assert.equal(detail.report.status,'new');assert.equal(detail.events[0].role,'user');assert.equal(detail.events[0].fromStatus,'complete');assert.equal(detail.events[0].statusChanged,true);
 await assert.rejects(f.bugs('admin',{action:'update',id,revision:1,status:'complete'}),{code:'failed-precondition'});
 for(let i=0;i<32;i++)await f.tickets('author',{...reply,requestId:'page-reply-'+String(i).padStart(8,'0')});detail=await f.tickets('author',{action:'detail',id});assert.equal(detail.events.length,30);const older=await f.tickets('author',{action:'detail',id,cursor:detail.cursor});assert.equal(older.events.length,4);assert.equal(new Set([...detail.events,...older.events].map(e=>e.sequence)).size,34);
});

test('imports enforce paid skins and stickers including hidden tabs, while members and purchasers may import',async()=>{
 const f=fixture(),snapshot={objects:[{...board.objects[0],dataset:{tileSkin:'sticky-taped'},tabs:{active:0,items:[board.objects[0],{type:'sticky',dataset:{tileSkin:'sticky-ripped'}}]}},{type:'sticker',sticker:{emoji:'😄'}}]}, {id}=await f.call('author',{...submission,snapshot});await f.review('admin',{action:'review',id,revision:1,decision:'approve'});
 await assert.rejects(f.call('reader',{action:'import',id,requestId:'locked'}),{code:'failed-precondition'});assert(![...f.records.keys()].some(k=>k.startsWith('users/reader/boards/')));
 f.records.set('users/reader',{ownedProductIds:['tile-skin-sticky-taped','tile-skin-sticky-ripped','sticker-faces-happy']});assert((await f.call('reader',{action:'import',id,requestId:'owned',supportedTypes:['sticky','sticker']})).boardId);
 f.records.set('users/member',{subscriptionStatus:'active'});assert((await f.call('member',{action:'import',id,requestId:'member',supportedTypes:['sticky','sticker']})).boardId);
});
test('likes survive edits and board replacement and remain limited to one per account',async()=>{
 const f=fixture(),{id}=await f.call('author',submission);await f.review('admin',{action:'review',id,revision:1,decision:'approve'});assert.equal((await f.call('reader',{action:'like',id,liked:true})).likes,1);assert.equal((await f.call('reader',{action:'like',id,liked:true})).likes,1);await f.call('author',{...submission,id});await f.review('admin',{action:'review',id,revision:2,decision:'approve'});assert.equal((await f.call('reader',{action:'like',id,liked:true})).likes,1);assert.equal((await f.call('reader',{action:'detail',id})).liked,true);
});
test('removing unowned cosmetics preserves content, purchased items, and tab order',()=>{
 const p=require('../boards/cosmetics-policy.js').policy(require('../boards/cosmetics-catalog.json')),snapshot={theme:'bamboo-green',objects:[{id:'kept',type:'sticky',dataset:{tileSkin:'sticky-taped'},editables:[{html:'Keep this text'}]},{type:'sticker',sticker:{emoji:'😄'}},{type:'sticker',sticker:{src:'assets/stickers/default/apple.png'}},{id:'tabs',type:'sticky',transform:{width:300},tabs:{active:1,items:[{id:'same',type:'sticky',dataset:{tileSkin:'sticky-ripped'},editables:[{html:'One'}]},{id:'same',type:'sticky',dataset:{tileSkin:'sticky-taped'},editables:[{html:'Two'}]}]}}]};
 const result=p.strip(snapshot,{ownedProductIds:['tile-skin-sticky-taped']});assert.equal(result.theme,'light');assert.equal(result.objects.length,3);assert.equal(result.objects[0].dataset.tileSkin,'sticky-taped');assert.equal(result.objects[0].editables[0].html,'Keep this text');assert.equal(result.objects[2].tabs.active,1);assert.equal(result.objects[2].tabs.items[0].dataset.tileSkin,undefined);assert.equal(snapshot.objects.length,4);assert.equal(p.missing(result,{ownedProductIds:['tile-skin-sticky-taped']}).length,0);
});

test('like and unlike requests are retry-safe and stay at zero or one per account',async()=>{const f=fixture(),{id}=await f.call('author',submission);await f.review('admin',{action:'review',id,revision:1,decision:'approve'});await f.call('reader',{action:'like',id,liked:true});assert.equal((await f.call('reader',{action:'like',id,liked:true})).likes,1);assert.equal((await f.call('reader',{action:'like',id,liked:false})).likes,0);assert.equal((await f.call('reader',{action:'like',id,liked:false})).likes,0);assert.equal((await f.call('reader',{action:'detail',id})).liked,false);});
test('developer ticket updates notify only their owner, acknowledgement preserves newer updates, deletion clears all history',async()=>{
 const f=fixture(),{id}=await f.report('author',{requestId:'notifications-ticket-1',category:'Other',title:'Support needed',description:'I need help with a board please.'});await f.bugs('admin',{action:'update',id,revision:1,status:'in-progress',message:'Looking into this.'});let notes=await f.tickets('author',{action:'notifications'});assert.equal(notes.items.length,1);assert.equal((await f.tickets('stranger',{action:'notifications'})).items.length,0);await f.bugs('admin',{action:'update',id,revision:2,status:'complete',message:'Fixed.'});await f.tickets('author',{action:'acknowledge',id,revision:2});assert.equal((await f.tickets('author',{action:'notifications'})).items.length,1);await assert.rejects(f.bugs('author',{action:'delete',id,confirm:true}),{code:'permission-denied'});await assert.rejects(f.bugs('admin',{action:'delete',id}),{code:'invalid-argument'});await f.bugs('admin',{action:'delete',id,confirm:true});assert.equal((await f.tickets('author')).items.length,0);assert.equal((await f.tickets('author',{action:'notifications'})).items.length,0);assert(![...f.records.keys()].some(k=>k.startsWith('_bugReports/'+id)));await assert.rejects(f.tickets('author',{action:'detail',id}),{code:'not-found'});
});
test('template import also requires ownership of its board theme',async()=>{const f=fixture(),{id}=await f.call('author',{...submission,snapshot:{...board,theme:'bamboo-green'}});await f.review('admin',{action:'review',id,revision:1,decision:'approve'});await assert.rejects(f.call('reader',{action:'import',id,requestId:'theme-check'}),{code:'failed-precondition'});f.records.set('users/reader',{ownedProductIds:['theme-bamboo']});assert((await f.call('reader',{action:'import',id,requestId:'theme-owned'})).boardId);});

test('template export preserves a progress title without sharing timer runtime',()=>{const saved=contract.sanitize({objects:[{type:'progressbar',fields:[{index:0,value:'Class reading goal'}],special:{targetAt:999999,running:true}},{type:'timer',timer:{total:600,left:120,running:true},dataset:{timerShape:'star'}}]});assert.equal(saved.snapshot.objects[0].special.title,'Class reading goal');assert.equal(saved.snapshot.objects[0].special.running,false);assert.equal(saved.snapshot.objects[0].special.targetAt,undefined);assert.equal(saved.snapshot.objects[1].timer,undefined);assert.equal(saved.snapshot.objects[1].dataset.timerShape,'star');});

test('only verified developers get preview subscription capacity, and it still stops at 20',async()=>{const f=fixture(),{id}=await f.call('author',submission);await f.review('admin',{action:'review',id,revision:1,decision:'approve'});for(const uid of ['admin','viewer']){f.records.set('_sandboxUsers/'+uid,{subscriptionPreview:true});for(let i=0;i<2;i++)f.records.set('users/'+uid+'/boards/board'+i,{});}await assert.rejects(f.call('viewer',{action:'import',id,requestId:'blocked'}),{code:'resource-exhausted'});await f.call('admin',{action:'import',id,requestId:'allowed'});for(let i=2;i<19;i++)f.records.set('users/admin/boards/board'+i,{});await assert.rejects(f.call('admin',{action:'import',id,requestId:'full'}),{code:'resource-exhausted'});f.records.set('_sandboxUsers/admin',{subscriptionPreview:false});await assert.rejects(f.call('admin',{action:'import',id,requestId:'disabled'}),{code:'resource-exhausted'});});
