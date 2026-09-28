const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function setup(){
 const values=new Map(),storage={get length(){return values.size},key:i=>[...values.keys()][i],getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 let now=1000000,uid='admin-a',calls=[];
 const context={Date:{now:()=>now},Map,JSON};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../users-cache.js'),'utf8').replace('export function','function'),context);
 const call=async(name,data)=>{calls.push({name,data});return name==='listDeveloperUsers'?{data:{users:[{uid:'u',patchAwards:{},coinBalance:10}],nextPageToken:null}}:{data:{uid:'u'}};};
 return {client:()=>context.createUsersClient(call,()=>uid,storage),calls,values,advance:()=>now+=300001,account:value=>uid=value};
}
test('list, detail, repeated search, and portal reload reuse the same data',async()=>{
 const f=setup(),client=f.client();await client.request('listDeveloperUsers',{query:''});
 await client.request('getDeveloperUser',{uid:'u'});await client.request('listDeveloperUsers',{query:''});
 await f.client().request('getDeveloperUser',{uid:'u'});assert.equal(f.calls.length,1);
 f.advance();await client.request('getDeveloperUser',{uid:'u'});assert.equal(f.calls.length,2);
});
test('mutations bypass caching; refresh and sign-out invalidate cached display data',async()=>{
 const f=setup(),client=f.client();await client.request('listDeveloperUsers',{});
 await client.request('setUserBetaAccess',{uid:'u',enabled:true});await client.request('setUserBetaAccess',{uid:'u',enabled:true});assert.equal(f.calls.length,3);
 await client.request('listDeveloperUsers',{});client.invalidate();await client.request('listDeveloperUsers',{});assert.equal(f.calls.length,5);
 f.account('admin-b');await client.request('listDeveloperUsers',{});assert.equal(f.calls.length,6);
 client.clearSession();assert.equal(f.values.size,0);
});
test('simultaneous requests share one server call',async()=>{
 const f=setup(),client=f.client();await Promise.all([client.request('listDeveloperUsers',{}),client.request('listDeveloperUsers',{})]);assert.equal(f.calls.length,1);
});
