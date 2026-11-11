const root=new URL('../',import.meta.url);
let source;
export async function boardFrame(container,{teacher,mode,allowedTypes,student,roster,onChange,onInput,onProfile,signal}){
 source??=fetch(new URL('index.html',root)).then(r=>{if(!r.ok)throw Error('Could not open the board.');return r.text();}).catch(e=>{source=null;throw e;});
 const html=await source;if(signal?.aborted||!container.isConnected)throw Error('Board closed.');
 const doc=new DOMParser().parseFromString(html,'text/html');
 doc.querySelectorAll('script[src]').forEach(s=>{if(/firebase-auth|community\/index|profile\/patches|class-connect\/boards|board-gate|splash|shop\/ui|shop\/ad-rewards|tile-menu-metadata|presentations\/index/.test(s.getAttribute('src')))s.remove();});
 doc.querySelector('#teachertiles-intro')?.remove();
 doc.querySelectorAll('script[src]').forEach(s=>{if(/class-connect\/student/.test(s.src))s.remove();});
 // Block injected event handlers/scripts even in older tile renderers.
 const nonce=crypto.randomUUID().replaceAll('-','');
 const csp=doc.createElement('meta');csp.httpEquiv='Content-Security-Policy';csp.content="script-src 'nonce-"+nonce+"' 'strict-dynamic'; object-src 'none'; base-uri 'self'";
 doc.head.prepend(csp);
 const base=doc.createElement('base');base.href=root.href;doc.head.prepend(base);
 const boot=doc.createElement('script');boot.src=new URL('class-connect/board-frame.js?v=20261110-sessions',root).href;base.after(boot);
 const style=doc.createElement('style');style.textContent=`#boards-toggle,#settings-toggle,#profile-toggle,#theme-shelf-toggle,#sticker-shelf-toggle,#tile-effects-shelf-toggle,#cursors-shelf-toggle,#shop-toggle,#boards-view,#profile-modal,#settings-modal,#shop-modal,#asset-shelf,#teachertiles-intro,.workspace-upcoming-controls,.board-preview,.tile-skins-toggle,.board-account-menu{ display:none!important}body.cc-controlled .module-delete,body.cc-controlled .module-tab-add,body.cc-controlled .tile-tab-close,body.cc-controlled .tile-appearance-toggle,body.cc-controlled .tile-settings-toggle,body.cc-controlled .tile-settings-beside-brush,body.cc-controlled #context-menu{display:none!important}.context-menu__item.cc-unavailable{display:none!important}#cc-frame-profile{position:fixed;right:18px;top:18px;z-index:999999;border:1px solid #dce2ec;background:white;padding:9px 14px;border-radius:14px;font:600 14px system-ui;display:flex;align-items:center;gap:9px}#cc-frame-profile .cc-board-avatar{display:grid;place-items:center;width:32px;height:32px;border-radius:9px;font-size:19px}#cc-frame-profile img{width:30px;height:30px;border-radius:9px;object-fit:cover}`;doc.head.append(style);
 doc.querySelectorAll('script').forEach(script=>script.setAttribute('nonce',nonce));
 const iframe=document.createElement('iframe');iframe.title=teacher?'Teacher session board':'Your class board';iframe.allow='microphone; camera; fullscreen; clipboard-write';iframe.srcdoc='<!doctype html>'+doc.documentElement.outerHTML;container.append(iframe);
 await new Promise((resolve,reject)=>{
  const cancel=()=>{clearTimeout(timeout);iframe.remove();reject(Error('Board closed.'));};
  const timeout=setTimeout(()=>{signal?.removeEventListener('abort',cancel);iframe.remove();reject(Error('The board could not finish loading. Please reopen it.'));},45000);
  signal?.addEventListener('abort',cancel,{once:true});
  iframe.onload=()=>{clearTimeout(timeout);signal?.removeEventListener('abort',cancel);resolve();};
 });
 if(!iframe.isConnected)throw Error('Board closed.');const win=iframe.contentWindow;if(!win.TeacherTilesBoard)throw Error('The board could not start.');
 const policy=win.ClassConnectPolicy;policy.controlled=!teacher&&mode==='controlled';policy.allowed=Array.isArray(allowedTypes)?allowedTypes:[];win.document.body.classList.toggle('cc-controlled',policy.controlled);
 win.document.querySelectorAll('.context-menu__item[data-module]').forEach(item=>{if(!policy.allowed.includes(item.dataset.module)){item.classList.add('cc-unavailable');item.dataset.tileDisabled='true';item.disabled=true;}});
 win.TeacherTilesTileMenu?.refresh();
 win.TeacherTilesBoard.clear();win.TeacherTilesBoard.setActiveBoardId('');
 policy.seedRoster(roster);
 if(student){const b=win.document.createElement('button');b.id='cc-frame-profile';if(student.image){const img=win.document.createElement('img');img.src=student.image;img.alt='';b.append(img);}else{const emoji=win.document.createElement('span');emoji.textContent=student.emoji||student.initials||student.name.slice(0,1);emoji.className='cc-board-avatar';emoji.style.background=`hsl(${Number(student.hue)||200} 65% 90%)`;b.append(emoji);}b.append(win.document.createTextNode(student.name));b.onclick=onProfile;win.document.body.append(b);}
 let previous=new Map(),initial=true;
 const snapshot=()=>{const s=win.TeacherTilesBoard.capture();return {schemaVersion:s.schemaVersion,theme:'light',camera:s.camera,objects:s.objects,frames:s.frames};};
 const update=data=>{
  data=data||win.TeacherTilesBoard.blank();
  policy.hydrating=true;
  try{if(initial){win.TeacherTilesBoard.load({...win.TeacherTilesBoard.blank(),...data});initial=false;}else{
   const next=new Map((data.objects||[]).map(o=>[o.id,JSON.stringify(o)]));
   win.withBoardChangesSuspended(()=>{for(const el of [...win.document.getElementById('workspace').querySelectorAll('.module')]){const id=el.dataset.boardObjectId;if(!next.has(id)||next.get(id)!==previous.get(id)){el._cleanup?.();el.remove();}}for(const obj of data.objects||[]){if(next.get(obj.id)!==previous.get(obj.id))win.restoreTeacherTilesBoardObject(obj);}win.clearSelection();win.updateWorkspaceEmptyState();});
  }previous=new Map((data?.objects||[]).map(o=>[o.id,JSON.stringify(o)]));}finally{policy.hydrating=false;policy.ready=true;}
 };
 win.addEventListener('teachertiles:boardchange',()=>{if(teacher&&mode==='controlled'&&policy.ready&&!policy.hydrating)onChange?.(snapshot());});
 for(const type of ['pointerdown','keydown','input','wheel'])win.document.addEventListener(type,e=>{if(e.isTrusted&&policy.ready)onInput?.();},{capture:true,passive:true});
 return {update,snapshot,stop(){win.document.exitFullscreen?.().catch(()=>{});win.document.body.inert=true;for(const m of win.document.querySelectorAll('.module'))m._deactivate?.();for(const media of win.document.querySelectorAll('audio,video'))media.pause();},close(){for(const m of win.document.getElementById('workspace').querySelectorAll('.module'))m._cleanup?.();iframe.remove();}};
}
