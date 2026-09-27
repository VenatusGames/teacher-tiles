const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const backend=process.env.TT_FUNCTIONS_DIR||path.resolve(__dirname,'../../../../teacher-tiles-functions/functions');
function fixture(){
 const now=Date.now(),stamp=value=>({toMillis:()=>value}),stats={documentReads:0,aggregates:0};
 const users=['a','b','c'].map(uid=>({uid,email:uid+'@example.com',metadata:{creationTime:'2026-09-01'},customClaims:{}}));
 const records=new Map([['users/a',{subscriptionStatus:'active',patchAwards:{contributor:{awardedAt:stamp(1)}}}],['users/b',{}],['users/c',{subscriptionStatus:'active'}],['_sandboxUsers/a',{lastSeen:stamp(now-900000)}],['_sandboxUsers/b',{lastSeen:stamp(now),subscriptionPreview:true}],['_sandboxUsers/c',{lastSeen:stamp(now-1000)}]]);
 const doc=key=>({id:key.split('/')[1],ref:ref(key),data:()=>records.get(key)});
 function ref(key){return {key,get:async()=>{stats.documentReads++;return doc(key)},set:async data=>{records.set(key,{...records.get(key),...data})}};}
 function collection(name){let conditions=[],limit=Infinity,orders=[],cursor;
  const rows=()=>{let rows=[...records.keys()].filter(key=>key.startsWith(name+'/')).map(doc).filter(d=>conditions.every(([field,op,value])=>{const actual=d.data()[field],a=actual?.toMillis?.()??actual,b=value?.toMillis?.()??value;return op==='=='?a===b:a>=b}));
   if(orders[0]?.[0]==='lastSeen')rows.sort((a,b)=>b.data().lastSeen.toMillis()-a.data().lastSeen.toMillis());
   if(cursor)rows=rows.slice(rows.findIndex(d=>d.id===cursor.at(-1))+1);return rows.slice(0,limit);};
  const query={doc:uid=>ref(name+'/'+uid),where:(...args)=>{conditions.push(args);return query},orderBy:(...args)=>{orders.push(args);return query},startAfter:(...args)=>{cursor=args;return query},limit:n=>{limit=n;return query},count:()=>({get:async()=>{stats.aggregates++;return {data:()=>({count:rows().length})}}}),get:async()=>{const docs=rows();stats.documentReads+=docs.length;return {docs,empty:!docs.length,size:docs.length}}};return query;
 }
 const db={collection,getAll:async(...refs)=>{stats.documentReads+=refs.length;return refs.map(r=>doc(r.key))},runTransaction:async fn=>fn({get:r=>r.get(),set:(r,data)=>r.set(data)})};
 class HttpsError extends Error{constructor(code,message){super(message);this.code=code}}
 const guard=async req=>{if(req.auth?.uid!=='admin')throw new HttpsError('permission-denied','Denied');return {uid:'admin',role:'admin'}};
 const modules={'firebase-admin/auth':{getAuth:()=>({getUsers:async ids=>({users:users.filter(u=>ids.some(id=>id.uid===u.uid))}),listUsers:async()=>({users})})},'firebase-admin/firestore':{getFirestore:()=>db,Timestamp:{fromMillis:stamp},FieldPath:{documentId:()=>'id'},FieldValue:{serverTimestamp:()=>stamp(now)}},'firebase-functions/v2/https':{onCall:(_,fn)=>fn,HttpsError},'./admin-access':{requireDeveloper:guard},'../context':{accountRef:(db,uid)=>ref('users/'+uid),isSubscriptionActive:(data={})=>data.subscriptionStatus==='active'},'../patch-awards':require(backend+'/patch-awards.js')};
 const load=file=>{const exports={};vm.runInNewContext(fs.readFileSync(backend+'/sandbox/'+file,'utf8'),{exports,require:name=>modules[name],Date,Buffer});return exports};
 return {api:{...load('insights.js'),...load('bulk-patches.js'),...load('users.js')},stats,records,users};
}
const request=data=>({auth:{uid:'admin'},data});
test('insights use aggregate queries and do not read individual Firestore documents',async()=>{
 const {api,stats}=fixture();const result=await api.getDeveloperInsights(request({}));assert.equal(result.online,2);assert.equal(result.subscribers,2);assert.equal(result.total,3);assert.equal(stats.aggregates,2);assert.equal(stats.documentReads,0);
 await assert.rejects(api.getDeveloperInsights({auth:{uid:'beta'}}),{code:'permission-denied'});
});
test('online/subscriber filters query matching records and reuse their snapshots',async()=>{
 const {api,stats}=fixture();let result=await api.listDeveloperUsers(request({onlineOnly:true,subscribersOnly:true}));assert.equal(result.users.length,1);assert.equal(result.users[0].uid,'c');assert.equal(stats.documentReads,4);
 result=await api.listDeveloperUsers(request({subscribersOnly:true}));assert.equal(result.users.map(u=>u.uid).join(','),'a,c');
 result=await api.listDeveloperUsers(request({onlineOnly:true,query:'b@'}));assert.equal(result.users[0].uid,'b');
});
test('bulk selected awards preserve dates, skip duplicates, and reject non-admins',async()=>{
 const {api,records}=fixture(),data={scope:'selected',patchId:'contributor',uids:['a','c']};
 let result=await api.bulkGiveUserPatch(request(data));assert.equal(result.awarded,1);assert.equal(result.unchanged,1);assert.equal(records.get('users/a').patchAwards.contributor.awardedAt.toMillis(),1);
 result=await api.bulkGiveUserPatch(request(data));assert.equal(result.awarded,0);assert.equal(result.unchanged,2);
 await assert.rejects(api.bulkGiveUserPatch({auth:{uid:'beta'},data}),{code:'permission-denied'});
 await assert.rejects(api.bulkGiveUserPatch(request({...data,patchId:'teachertiles'})),{code:'invalid-argument'});
});
test('bulk all skips disabled users and does not grant beta access',async()=>{
 const {api,users,records}=fixture();users[1].disabled=true;const result=await api.bulkGiveUserPatch(request({scope:'all',patchId:'beta'}));assert.equal(result.awarded,2);assert.equal(result.skipped,1);assert.equal(records.get('_sandboxUsers/c').betaAccess,undefined);
});
