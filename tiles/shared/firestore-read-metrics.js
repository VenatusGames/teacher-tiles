/* Local-only diagnostics. Never store document contents, identifiers or telemetry remotely. */
(()=>{'use strict';
  const totals=new Map();
  function caller(){return (new Error().stack||'').split('\n').find(line=>line.includes('firebase-auth.js'))?.trim().replace(/(?:https?:\/\/|file:\/\/\/)[^ )]*\/firebase-auth\.js(?:\?[^ ):]*)?/g,'firebase-auth.js')||'unknown'}
  function record(operation,source,documents,error=false){const key=operation+' · '+source,row=totals.get(key)||{operation,source,calls:0,documents:0,errors:0};row.calls++;row.documents+=documents;if(error)row.errors++;totals.set(key,row)}
  function wrap(sdk){
    const wrapped={...sdk};
    for(const operation of ['getDoc','getDocs','getDocFromServer','getDocsFromServer']){
      wrapped[operation]=async(...args)=>{const source=caller();try{const result=await sdk[operation](...args);record(operation,source,result.metadata?.fromCache?0:Math.max(1,result.docs?.length??1));return result}catch(error){record(operation,source,0,true);throw error}};
    }
    wrapped.runTransaction=(db,callback,...options)=>{const source=caller();return sdk.runTransaction(db,transaction=>callback(new Proxy(transaction,{get(target,key){if(key==='get')return async ref=>{try{const result=await target.get(ref);record('transaction.get',source,1);return result}catch(error){record('transaction.get',source,0,true);throw error}};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value}})),...options)};
    return wrapped;
  }
  window.TeacherTilesReadDiagnostics=Object.freeze({wrap,summary:()=>({note:'Client reads in this page session only; excludes backend, console, rule-dependent reads and index billing.',operations:[...totals.values()].map(row=>({...row}))}),reset:()=>totals.clear()});
})();
