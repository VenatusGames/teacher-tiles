(() => {
  'use strict';
  const fields={'teachertiles.sticker-favorites.v1':'stickers','teacherTilesCursorFavorites':'cursors','teacherTiles.tileFavorites.v1':'tiles','teacherTiles.categoryPins.v1':'categories','teachertiles.sticker-usage.v1':'usage'};
  const prefix='teachertiles.collections.v1.';
  const parse=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
  const save=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
  const guest=Object.fromEntries(Object.keys(fields).map(k=>[k,parse(prefix+'migrated',false)?parse(cacheGuest(),{})[k]??(fields[k]==='usage'?{}:[]):parse(k,fields[k]==='usage'?{}:[])]));
  function cacheGuest(){return prefix+'guest'}
  let state=null,scope='',sdk,db,timer,lastRead=0,loading=false;
  const cache=uid=>prefix+(uid||'guest');
  function publish(){
    for(const [key,field] of Object.entries(fields)){
      const value=scope?(field==='usage'?state.data[field]||{}:Object.keys(state.data[field]||{}).filter(k=>state.data[field][k]===true)):guest[key];
      save(key,value);
      window.dispatchEvent(new StorageEvent('storage',{key,newValue:JSON.stringify(value)}));
    }
    window.dispatchEvent(new Event('teachertiles:collectionpreferences'));
  }
  function apply(data,ops){
    for(const [field,values] of Object.entries(ops||{})){
      data[field]??={};for(const [key,value] of Object.entries(values))data[field][key]=field==='usage'?Math.min(Number.MAX_SAFE_INTEGER,(Number(data[field][key])||0)+value):value;
    }
  }
  function seed(data,values){
    for(const [field,items] of Object.entries(values||{})){
      data[field]??={};for(const [key,value] of Object.entries(items)){
        if(field==='usage')data[field][key]=Math.max(Number(data[field][key])||0,value);
        else if(!(key in data[field]))data[field][key]=value;
      }
    }
  }
  const persist=()=>{if(scope)save(cache(scope),state)};
  function schedule(){if(scope&&!timer)timer=setTimeout(()=>{timer=null;void flush()},30000)}
  function write(key,text){
    const field=fields[key];if(!field)return;
    const value=JSON.parse(text),old=parse(key,field==='usage'?{}:[]);save(key,value);
    if(!scope){guest[key]=value;save(cache(''),guest);return;}
    const ops={};if(field==='usage'){
      for(const [id,count] of Object.entries(value))if(Number.isSafeInteger(count)&&count>(old[id]||0))ops[id]=count-(old[id]||0);
    }else{
      const next=new Set(value);for(const id of new Set([...old,...value]))if(next.has(id)!==old.includes(id))ops[id]=next.has(id);
    }
    state.pending[field]??={};for(const [id,v] of Object.entries(ops))state.pending[field][id]=field==='usage'?(state.pending[field][id]||0)+v:v;
    apply(state.data,{[field]:ops});persist();schedule();
  }
  async function flush(){
    if(!scope||loading||state.saving)return;
    const active=state,uid=scope;active.saving=true;
    try{
      if(!active.batch){
        if(!active.seed&&!Object.values(active.pending).some(v=>Object.keys(v).length))return;
        active.batch={id:crypto.randomUUID(),ops:active.pending,seed:active.seed||{}};active.pending={};delete active.seed;save(cache(uid),active);
      }
      const batch=active.batch,ref=sdk.doc(db,'users',uid,'private','collectionPreferences');
      const data=await sdk.runTransaction(db,async tx=>{
        const snapshot=await tx.get(ref),remote=snapshot.exists()?snapshot.data():{};
        const seen=remote.batches||[];
        if(!seen.includes(batch.id)){seed(remote,batch.seed);apply(remote,batch.ops);remote.batches=[...seen,batch.id].slice(-128);tx.set(ref,remote);}
        return remote;
      });
      active.batch=null;active.data=data;apply(active.data,active.pending);save(cache(uid),active);
      if(scope===uid&&state===active){publish();lastRead=Date.now();}
    }catch(error){console.warn('Collection preferences will retry syncing.',error);}
    finally{active.saving=false;save(cache(uid),active);if(state===active&&(active.batch||Object.values(active.pending).some(v=>Object.keys(v).length)))schedule();}
  }
  async function refresh(){
    if(!scope||loading||state.saving)return;
    loading=true;const active=state,uid=scope;
    try{
      const snapshot=await sdk.getDoc(sdk.doc(db,'users',uid,'private','collectionPreferences'));
      if(state!==active||scope!==uid)return;
      active.data=snapshot.exists()?snapshot.data():{};
      if(active.batch&&!active.data.batches?.includes(active.batch.id)){seed(active.data,active.batch.seed);apply(active.data,active.batch.ops);}
      seed(active.data,active.seed);
      apply(active.data,active.pending);persist();publish();lastRead=Date.now();
    }catch(error){console.warn('Collection preferences are using the saved local copy.',error);}
    finally{if(state===active){loading=false;schedule();}}
  }
  function setUser(uid,firestore,database){
    if(uid===scope&&state)return;
    clearTimeout(timer);timer=null;sdk=firestore;db=database;scope=uid||'';loading=false;lastRead=0;
    state=scope?parse(cache(scope),{data:{},pending:{},batch:null}):null;
    if(state){state.saving=false;
      // Import old browser-only choices once, into the first signed-in account.
      if(!parse(prefix+'migrated',false)){
        state.seed={};
        for(const [key,field] of Object.entries(fields)){
          const value=guest[key];state.seed[field]=field==='usage'?{...value}:Object.fromEntries(value.map(id=>[id,true]));
        }
        seed(state.data,state.seed);save(prefix+'migrated',true);persist();
      }
    }
    publish();if(scope)void refresh();
  }
  window.TeacherTilesCollectionPreferences={write,setUser,flush};
  window.addEventListener('online',()=>{void refresh();void flush()});
  window.addEventListener('focus',()=>{if(Date.now()-lastRead>300000)void refresh()});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)void flush()});
})();
