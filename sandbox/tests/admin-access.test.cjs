const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),backend=process.env.TT_FUNCTIONS_DIR||path.resolve(root,'../../teacher-tiles-functions/functions');
function backendApi(user,error){const exports={};class HttpsError extends Error{constructor(code,message,details){super(message);this.code=code;this.details=details}}vm.runInNewContext(fs.readFileSync(backend+'/sandbox/admin-access.js','utf8'),{exports,require:name=>name==='firebase-admin/auth'?{getAuth:()=>({getUser:async()=>{if(error)throw error;return user}})}:{HttpsError,onCall:(_,handler)=>handler}});return exports.requireDeveloper;}
const request={auth:{uid:'test-user',token:{auth_time:2000}}};
test('backend rejects anonymous, unprivileged, stale, disabled and revoked accounts',async()=>{
 await assert.rejects(backendApi({})({}),{code:'unauthenticated'});
 for(const user of [{customClaims:{}},{customClaims:{portalRole:'moderator'}},{disabled:true,customClaims:{portalRole:'owner'}},{customClaims:{portalRole:'owner'},tokensValidAfterTime:new Date(3000000).toISOString()}])await assert.rejects(backendApi(user)(request));
 await assert.rejects(backendApi({customClaims:{}})({auth:{uid:'x',token:{portalRole:'owner'}},data:{admin:true}}),{code:'permission-denied'});
});
test('backend accepts current administrator/owner roles and identifies missing server permissions',async()=>{
 for(const role of ['owner','admin'])assert.equal((await backendApi({uid:'test-user',customClaims:{portalRole:role},tokensValidAfterTime:new Date(0).toISOString()})(request)).role,role);
 await assert.rejects(backendApi(null,{code:'auth/insufficient-permission'})(request),e=>e.code==='failed-precondition'&&e.details.reason==='auth-reader-missing');
});
test('production source does not load sandbox code or need sandbox files',()=>{
 for(const f of ['index.html','app.js','firebase-auth.js'])assert.doesNotMatch(fs.readFileSync(path.join(root,f),'utf8'),/TeacherTilesSandbox|TeacherTilesAdminAccess|verifyDeveloperAccess|sandbox-access|sandbox\/dev-console/);
 assert(!fs.existsSync(path.join(root,'sandbox-access.js')));
});
test('account lifecycle prevents cloud initialization when access checks reject',async()=>{
 const source=fs.readFileSync(path.join(root,'firebase-auth.js'),'utf8');const handlers=source.slice(source.indexOf('let accountAuthGeneration'),source.indexOf('async function initializeFirebaseAuth()'));
 let deny=true,renders=0;const element={classList:{toggle(){}},setAttribute(){},querySelector:()=>({hidden:true})};
 const user={uid:'user'},ctx={window:{dispatchEvent:e=>{if(deny)e.detail.waitUntil(Promise.reject(Error('denied')))}},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail}},document:{getElementById:()=>element},auth:{currentUser:user},authSdk:{getIdTokenResult:async()=>({claims:{portalRole:'admin'}})},syncProfileBadgeCount(){},renderUser:async()=>renders++};
 vm.createContext(ctx);vm.runInContext(handlers,ctx);await ctx.handleAccountAuthChange(user);assert.equal(renders,0);deny=false;await ctx.handleAccountAuthChange(user);assert.equal(renders,1);await ctx.handleAccountAuthChange(user);assert.equal(renders,1);
});
