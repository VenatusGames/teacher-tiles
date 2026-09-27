// Display data only. Every mutation and access verification still goes to the server.
export function createUsersClient(call,getUid,storage=globalThis.sessionStorage) {
  const ttl=300000,prefix='tt-dev-users-v1:',pending=new Map();
  let owner='',cache=new Map(),epoch=0;
  function save(){try{storage.setItem(prefix+owner,JSON.stringify([...cache]));}catch{}}
  function scope(){const uid=getUid()||'';if(owner===uid)return;owner=uid;epoch++;cache=new Map();pending.clear();try{cache=new Map(JSON.parse(storage.getItem(prefix+owner)||'[]'));}catch{};}
  function invalidate(){scope();epoch++;cache.clear();pending.clear();try{storage.removeItem(prefix+owner);}catch{}}
  function clearSession(){epoch++;cache.clear();pending.clear();try{storage.removeItem(prefix+owner);for(let i=storage.length-1;i>=0;i--){const key=storage.key(i);if(key?.startsWith(prefix))storage.removeItem(key);}}catch{}owner='';}
  function put(key,response,time=Date.now()){cache.set(key,{time,response});if(cache.size>40)cache.delete(cache.keys().next().value);save();}
  function keyFor(name,data){return name+':'+JSON.stringify(data);}
  async function request(name,data={}){
    scope();const uid=owner,version=epoch;
    const readable=['listDeveloperUsers','getDeveloperUser'].includes(name);
    const key=keyFor(name,data),entry=cache.get(key);
    if(readable&&entry&&Date.now()-entry.time<ttl)return entry.response;
    if(readable&&pending.has(key))return pending.get(key);
    const promise=(async()=>{
      const response=await call(name,data);
      if(owner!==uid||epoch!==version)return response;
      if(readable){
        put(key,response);
        if(name==='listDeveloperUsers')for(const user of response.data.users){
          // Older deployed list functions do not yet include detail fields.
          if('patchAwards' in user)put(keyFor('getDeveloperUser',{uid:user.uid}),{data:user});
        }
      }else invalidate();
      return response;
    })();
    if(readable)pending.set(key,promise);
    try{return await promise;}finally{if(pending.get(key)===promise)pending.delete(key);}
  }
  return {request,invalidate,clearSession};
}
