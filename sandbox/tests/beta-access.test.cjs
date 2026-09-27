const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const backend=process.env.TT_FUNCTIONS_DIR||path.resolve(__dirname,'../../../../teacher-tiles-functions/functions');
function fixture(){
  const accounts=new Map([['admin',{uid:'admin',customClaims:{portalRole:'admin'}}],['beta',{uid:'beta',email:'beta@example.com',customClaims:{}}]]);
  const records=new Map([['_sandboxUsers/beta',{betaAccess:true,lastSeen:{toMillis:()=>1234}}],['users/beta',{subscriptionStatus:'active'}]]);
  const ref=key=>({key,get:async()=>({data:()=>records.get(key)}),set:async data=>records.set(key,{...records.get(key),...data})});
  const db={collection:name=>({doc:uid=>ref(name+'/'+uid)}),getAll:async(...refs)=>refs.map(r=>({data:()=>records.get(r.key)}))};
  class HttpsError extends Error{constructor(code,message,details){super(message);this.code=code;this.details=details}}
  const auth={getUser:async uid=>accounts.get(uid),listUsers:async()=>({users:[accounts.get('beta')],pageToken:'next'})};
  const modules={'firebase-admin/auth':{getAuth:()=>auth},'firebase-admin/firestore':{getFirestore:()=>db,FieldValue:{serverTimestamp:()=>({toMillis:()=>5678})}},'firebase-functions/v2/https':{HttpsError,onCall:(_,fn)=>fn},'../context':{accountRef:(db,uid)=>ref('users/'+uid),isSubscriptionActive:(data={})=>data.subscriptionStatus==='active'}};
  function load(file){const exports={};vm.runInNewContext(fs.readFileSync(backend+'/sandbox/'+file,'utf8'),{exports,require:name=>modules[name],Date});return exports;}
  modules['./admin-access']=load('admin-access.js');
  return {api:load('users.js'),accounts,records};
}
const request=(uid,data={})=>({auth:{uid,token:{auth_time:2000}},data});
test('beta access permits only sandbox verification; revoke is read from the server',async()=>{
  const {api,records}=fixture();assert.equal((await api.verifySandboxAccess(request('beta'))).role,'beta');
  await assert.rejects(api.listDeveloperUsers(request('beta')),{code:'permission-denied'});
  await assert.rejects(api.setUserBetaAccess(request('beta',{uid:'beta',enabled:true})),{code:'permission-denied'});
  await api.setUserBetaAccess(request('admin',{uid:'beta',enabled:false}));
  assert.equal(records.get('_sandboxUsers/beta').betaAccess,false);
  await assert.rejects(api.verifySandboxAccess(request('beta')),{code:'permission-denied'});
  await api.setUserBetaAccess(request('admin',{uid:'beta',enabled:true}));
  assert.equal((await api.verifySandboxAccess(request('beta'))).role,'beta');
});
test('user listing returns only profile, subscription and access fields with pagination',async()=>{
  const {api}=fixture();const result=await api.listDeveloperUsers(request('admin'));
  assert.equal(result.users[0].subscriber,true);assert.equal(result.users[0].lastSeen,1234);assert.equal(result.nextPageToken,'next');
  assert(!('customClaims' in result.users[0]));await assert.rejects(api.listDeveloperUsers({}),{code:'unauthenticated'});
});
test('activity cannot change beta access and disabled accounts cannot enter',async()=>{
  const {api,records,accounts}=fixture();await api.recordSiteActivity(request('beta',{betaAccess:false,uid:'admin'}));
  assert.equal(records.get('_sandboxUsers/beta').betaAccess,true);assert.equal(records.has('_sandboxUsers/admin'),false);
  accounts.get('beta').disabled=true;await assert.rejects(api.verifySandboxAccess(request('beta')),{code:'permission-denied'});
  await assert.rejects(api.setUserBetaAccess(request('admin',{uid:'beta',enabled:'yes'})),{code:'invalid-argument'});
});

test('activity updates are throttled across tabs and skipped in hidden tabs',async()=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../../site-activity.js'),'utf8').replace('export function','function');
 let now=1000000,calls=0,hidden=false;const values=new Map(),ticks=[];
 for(let i=0;i<2;i++){
  const context={Date:{now:()=>now},navigator:{},localStorage:{getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)},document:{get hidden(){return hidden},addEventListener(){},removeEventListener(){}},window:{addEventListener(){},removeEventListener(){}},setInterval:fn=>ticks.push(fn),clearInterval(){}};
  vm.createContext(context);vm.runInContext(source,context);context.startSiteActivity(()=>({uid:'same-user'}),async()=>{calls++});
 }
 await Promise.resolve();assert.equal(calls,1);await ticks[0]();await ticks[1]();assert.equal(calls,1);
 now+=300001;hidden=true;await ticks[0]();assert.equal(calls,1);hidden=false;await ticks[1]();assert.equal(calls,2);
});
