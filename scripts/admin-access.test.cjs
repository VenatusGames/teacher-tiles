const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const backend=process.env.TT_FUNCTIONS_DIR||require('node:path').resolve(__dirname,'../../../teacher-tiles-functions/functions');
function backendApi(user){const exports={};class HttpsError extends Error{constructor(code,message){super(message);this.code=code}}vm.runInNewContext(fs.readFileSync(backend+'/admin-access.js','utf8'),{exports,require:name=>name==='firebase-admin/auth'?{getAuth:()=>({getUser:async()=>user})}:{HttpsError,onCall:(_,handler)=>handler}});return exports.requireDeveloper;}
const request={auth:{uid:'test-user',token:{auth_time:2000}}};
test('backend denies anonymous, non-admin, disabled, moderator and revoked sessions',async()=>{
 await assert.rejects(backendApi({})({}),{code:'unauthenticated'});
 for(const user of [{customClaims:{}},{customClaims:{portalRole:'moderator'}},{disabled:true,customClaims:{portalRole:'owner'}},{customClaims:{portalRole:'owner'},tokensValidAfterTime:new Date(3000000).toISOString()}])await assert.rejects(backendApi(user)(request));
 // Client-supplied flags and stale token roles do not grant access.
 await assert.rejects(backendApi({customClaims:{}})({auth:{uid:'x',token:{portalRole:'owner'}},data:{admin:true}}),{code:'permission-denied'});
});
test('backend allows only current owner/admin roles',async()=>{for(const role of ['owner','admin'])assert.equal((await backendApi({uid:'test-user',customClaims:{portalRole:role},tokensValidAfterTime:new Date(0).toISOString()})(request)).role,role)});
const authSource=fs.readFileSync('firebase-auth.js','utf8');
const handlers=authSource.slice(authSource.indexOf('let adminAuthGeneration ='),authSource.indexOf('async function initializeFirebaseAuth()'));
function uiContext({role='owner',failure=false,required=true}={}){
 const classes=new Set(['profile-badge--locked']);const check={hidden:true},label={textContent:''};const badge={classList:{toggle:(name,on)=>on?classes.add(name):classes.delete(name)},setAttribute(){},querySelector:()=>check};
 const user={uid:'test-user',email:'admin@example.com'},renders=[];const access={required,allowed:false,update(claims={}){this.allowed=['owner','admin'].includes(claims.portalRole)},status(){}};
 const ctx={window:{TeacherTilesAdminAccess:access,addEventListener(){}},document:{hidden:false,getElementById:id=>id==='profile-teachertiles-badge'?badge:label},auth:{currentUser:user},authSdk:{getIdTokenResult:async()=>({claims:{portalRole:role}})},functionsSdk:{httpsCallable:()=>async()=>{if(failure)throw Error('offline');return{data:{uid:user.uid,role}}}},cloudFunctions:{},syncProfileBadgeCount(){},renderUser:async u=>renders.push(u),location:{reload(){ctx.reloaded=true}},setInterval(){},Date};vm.createContext(ctx);vm.runInContext(handlers,ctx);return{ctx,user,renders,access,check,classes};
}
test('sandbox does not initialize account data when denied or verification fails',async()=>{for(const options of [{role:'moderator'},{failure:true}]){const c=uiContext(options);await c.ctx.handleAdminAuthChange(c.user);assert.equal(c.renders.length,0);assert.equal(c.access.allowed,false);assert.equal(c.check.hidden,true)}});
test('admin gets patch and one account initialization across token refreshes; revocation relocks',async()=>{const c=uiContext();await c.ctx.handleAdminAuthChange(c.user);await c.ctx.handleAdminAuthChange(c.user);assert.equal(c.renders.length,1);assert.equal(c.check.hidden,false);c.ctx.auth.currentUser=null;await c.ctx.handleAdminAuthChange(null);assert.equal(c.access.allowed,false);assert.equal(c.check.hidden,true);assert.equal(c.ctx.reloaded,true)});
test('ordinary accounts can still use production',async()=>{const c=uiContext({required:false,role:''});await c.ctx.handleAdminAuthChange(c.user);assert.equal(c.renders.length,1);assert.equal(c.check.hidden,true)});
