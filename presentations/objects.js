(()=>{'use strict';
const contract=window.TeacherTilesPresentationObjects;
const entries=[['clock','Clock'],['colorpicker','Color Picker'],['grapher','Graphing Tool'],['rainbow','Rainbow'],['sticky','Sticky Note'],['tablemaker','Table Maker'],['tallychart','Tally Chart'],['translation','Translation'],['timer','Visual Timer'],['voicememo','Voice Memos']];
const nativeSizes={grapher:[820,640],tablemaker:[860,600],tallychart:[680,540],clock:[400,240],colorpicker:[440,400],rainbow:[560,430],sticky:[340,300],translation:[480,430],timer:[340,400],voicememo:[440,400]};
const tileSize=type=>({w:nativeSizes[type][0]*.6,h:nativeSizes[type][1]*.6});
const active=new Set(),pending=new Set(),audioCache=new Map(),liveMemos=new WeakMap();
function icon(type){const source=document.querySelector('[data-module="'+type+'"]');const art=source?.querySelector('svg,img');return art?art.outerHTML:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="18" height="18" rx="4"/></svg>';}
function dispose(host){for(const entry of [...active])if(host.contains(entry.el)){entry.capture();entry.cleanup();active.delete(entry);}}
new MutationObserver(()=>{for(const entry of [...active])if(!entry.el.isConnected||entry.el.closest('[hidden]')){entry.capture();entry.cleanup();active.delete(entry);}}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
function mountTile(el,e,{live=false,editable=false,change=()=>{},checkpoint=()=>{},deselect=()=>{},commit=()=>{},remove=()=>{},read,upload,scope='',error=console.warn}={}){
 if(!live){const preview=document.createElement('canvas');preview.width=Math.max(1,e.w*2);preview.height=Math.max(1,e.h*2);preview.className='pres-tile-static-preview';const g=preview.getContext('2d');g.scale(2,2);drawTile(g,{...e,x:0,y:0});el.append(preview);return;}
 const template=document.getElementById(e.tileType+'-template');if(!template)return;
 const m=template.content.firstElementChild.cloneNode(true),frame=document.createElement('div');frame.className='pres-embedded-tile';frame.append(m);el.append(frame);
 m.dataset.presentationEmbedded='true';if(!editable)m.querySelectorAll('.module-delete,.module-drag-handle,.resize-handle').forEach(n=>n.remove());
 const state=contract.tile(e).tileState;Object.assign(m.dataset,state.dataset);state.classes.forEach(c=>m.classList.add(c));
 const native=nativeSizes[e.tileType],tileScale=.6;
 m.style.cssText='position:absolute;left:0;top:0;width:'+native[0]+'px;height:'+native[1]+'px;min-width:0;min-height:0;transform-origin:0 0;';
 let disposed=false,ready=false,last='',capturing=false;
 m._presentationViewportScale=()=>{const slide=el.closest('.pres-slide');return Math.max(.01,tileScale*(slide?slide.getBoundingClientRect().width/960:1));};
 m.addEventListener('pointerenter',()=>m.classList.add('is-pointer-over'));m.addEventListener('pointerleave',()=>m.classList.remove('is-pointer-over'));m.addEventListener('focusin',()=>m.classList.add('has-keyboard-focus'));m.addEventListener('focusout',()=>m.classList.remove('has-keyboard-focus'));
 const fit=()=>{const slide=el.closest('.pres-slide'),scale=(slide?.clientWidth||960)/960,k=tileScale*scale;m.style.width=e.w/tileScale+'px';m.style.height=e.h/tileScale+'px';m.style.transform='scale('+k+')';m._presentationRefit?.();};
 const resize=new ResizeObserver(fit);resize.observe(el);
 const saveAudio=async memo=>{if(memo.asset)return memo;if(!memo.dataUrl||!upload)return {...memo,dataUrl:undefined};const key=scope+'|'+memo.dataUrl;let job=audioCache.get(key);if(!job){job=upload(memo.dataUrl);audioCache.set(key,job);job.catch(()=>audioCache.delete(key));}const asset=await job;return {name:memo.name,duration:memo.duration,asset};};
 function capture(){if(!ready||!editable||capturing)return;const raw={dataset:{...m.dataset},classes:[...m.classList],fields:captureBoardFields(m),special:m._boardGetState?.()||{},timer:m._boardTimerGetState?.(),sticky:m.querySelector('.sticky-editor')?.innerText||'',stickyHtml:m.querySelector('.sticky-editor')?.innerHTML||''};
  if(raw.timer?.running&&e.tileState?.timer?.running&&raw.timer.endAt===e.tileState.timer.endAt)raw.timer.left=e.tileState.timer.left;
  const commit=()=>{const clean=contract.tile({tileType:e.tileType,tileState:raw}).tileState,key=JSON.stringify(clean);if(key!==last){last=key;e.tileState=clean;change();}};
  if(e.tileType==='voicememo'&&raw.special.memos.some(m=>m.dataUrl)){capturing=true;liveMemos.set(e,raw.special.memos);const job=Promise.all(raw.special.memos.map(saveAudio)).then(memos=>{raw.special.memos=memos;commit();}).catch(error).finally(()=>{capturing=false;pending.delete(job);});pending.add(job);}else commit();
 }
 const entry={el,capture,cleanup(){if(disposed)return;disposed=true;clearInterval(tick);resize.disconnect();m.querySelectorAll('audio').forEach(a=>a.pause());m._cleanup?.();}};
 let tick=0;m._presentationChanged=()=>queueMicrotask(capture);active.add(entry);
 // Initialization is deferred until the module has a measurable, connected host.
 queueMicrotask(async()=>{if(disposed||!el.isConnected)return;
  try{withBoardChangesSuspended(()=>{if(m.classList.contains('classroom-widget'))setupClassroomTileControls(m);({grapher:setupGrapher,tablemaker:setupTableMaker,tallychart:setupTallyChart,clock:setupClock,sticky:setupSticky,translation:setupTranslation,timer:setupTimer,voicememo:setupVoiceMemo,colorpicker:TeacherTilesColorpicker.setup,rainbow:TeacherTilesRainbow.setup}[e.tileType])(m);restoreBoardFields(m,state.fields,{dispatch:true});if(e.tileType!=='voicememo')m._boardSetState?.(state.special);m._boardTimerSetState?.(state.timer);if(e.tileType==='sticky')m.querySelector('.sticky-editor').innerHTML=state.stickyHtml||'';if(e.tileType==='sticky'&&!state.stickyHtml)m.querySelector('.sticky-editor').textContent=state.sticky;});
   m.querySelector('.timer-sync-toggle')?.remove();m.dataset.timerSync='false';
   if(e.tileType==='voicememo'){const memos=await Promise.all((liveMemos.get(e)||state.special.memos).map(async memo=>({...memo,dataUrl:memo.dataUrl||(memo.asset?await read(memo.asset):'')})));if(disposed)return;m._boardSetState({...state.special,memos});}
   fit();ready=true;last=JSON.stringify(contract.tile(e).tileState);tick=setInterval(capture,600);
  }catch(err){error(err);entry.cleanup();active.delete(entry);}
 });

 // Tiles are live immediately. Only their own empty surfaces and native edge handles move them.
 for(const name of ['click','dblclick','contextmenu','keydown','wheel'])frame.addEventListener(name,event=>event.stopPropagation());
 frame.addEventListener('pointerdown',event=>event.stopPropagation());
 if(editable){
  prepareModuleTextEditors(m);
  const hotzone=event=>{const r=m.getBoundingClientRect(),near=event.clientX>r.right-Math.min(95,r.width*.4)&&event.clientY<r.top+75;m.classList.toggle('is-delete-hotzone',near);m.classList.toggle('is-tile-options-hotzone',near);};
  m.addEventListener('pointermove',hotzone);m.addEventListener('pointerleave',()=>m.classList.remove('is-delete-hotzone','is-tile-options-hotzone'));
  m.querySelector('.module-delete')?.addEventListener('click',event=>{event.stopPropagation();capture();remove();});
  for(const edge of ['t','r','b','l'])if(!m.querySelector('[data-resize="'+edge+'"]')){const handle=document.createElement('div');handle.className='resize-handle resize-handle--'+edge;handle.dataset.resize=edge;m.append(handle);}
  const textClicks=new WeakMap();
  m.addEventListener('pointerdown',event=>{if(event.button!==0)return;const field=findModuleTextEditTarget(event.target,m);if(!field)return;if(isImmediateModuleInput(field)||field.classList.contains('module-text-edit-active'))return;const previous=textClicks.get(field),now=performance.now();textClicks.set(field,{time:now,x:event.clientX,y:event.clientY});if(previous&&now-previous.time<420&&Math.hypot(event.clientX-previous.x,event.clientY-previous.y)<8){event.preventDefault();event.stopPropagation();textClicks.delete(field);checkpoint();enterModuleTextEdit(field);}},true);
  m.addEventListener('pointerdown',event=>{
   if(event.button!==0)return;
   const field=findModuleTextEditTarget(event.target,m);if(field&&isImmediateModuleInput(field)){enterModuleTextEdit(field);return;}
   const handle=event.target.closest('[data-resize]');
   if(!handle&&isInteractiveModuleTarget(event.target,m))return;
   event.preventDefault();event.stopPropagation();deselect();
   const start={x:e.x,y:e.y,w:e.w,h:e.h},sx=event.clientX,sy=event.clientY,slide=el.closest('.pres-slide'),scale=slide.getBoundingClientRect().width/960,edge=handle?.dataset.resize;
   let moved=false;const target=handle||m;target.setPointerCapture(event.pointerId);m.classList.add(edge?'is-resizing':'is-dragging');
   const paint=()=>{Object.assign(el.style,{left:e.x/9.6+'%',top:e.y/5.4+'%',width:e.w/9.6+'%',height:e.h/5.4+'%'});fit();};
   const move=ev=>{if(ev.pointerId!==event.pointerId)return;const dx=(ev.clientX-sx)/scale,dy=(ev.clientY-sy)/scale;if(!moved&&Math.abs(dx)+Math.abs(dy)<2)return;if(!moved){checkpoint();moved=true;}
    if(!edge){e.x=Math.max(0,Math.min(960-e.w,start.x+dx));e.y=Math.max(0,Math.min(540-e.h,start.y+dy));}
    else{let w=Math.max(100,start.w+(edge.includes('r')?dx:edge.includes('l')?-dx:0)),h=Math.max(80,start.h+(edge.includes('b')?dy:edge.includes('t')?-dy:0));if(ev.shiftKey){const k=Math.max(w/start.w,h/start.h);w=start.w*k;h=start.h*k;}w=Math.min(960,w);h=Math.min(540,h);e.x=Math.max(0,Math.min(960-w,edge.includes('l')?start.x+start.w-w:start.x));e.y=Math.max(0,Math.min(540-h,edge.includes('t')?start.y+start.h-h:start.y));e.w=w;e.h=h;}paint();
   };
   const finish=cancelled=>{target.removeEventListener('pointermove',move);target.removeEventListener('pointerup',up);target.removeEventListener('pointercancel',cancel);if(target.hasPointerCapture(event.pointerId))target.releasePointerCapture(event.pointerId);m.classList.remove('is-dragging','is-resizing');if(cancelled){Object.assign(e,start);paint();}else if(moved){capture();commit();}};
   const up=()=>finish(false),cancel=()=>finish(true);target.addEventListener('pointermove',move);target.addEventListener('pointerup',up);target.addEventListener('pointercancel',cancel);
  });
 }

}
function mountTable(el,e,{editable=false,change=()=>{},checkpoint=()=>{},select=()=>{}}={}){
 const table=document.createElement('table');table.className='pres-table';table.style.cssText='color:'+e.color+';--table-border:'+e.border+';font-size:'+e.fontSize/9.6+'cqw;';
 for(let r=0;r<e.rows;r++){const row=table.insertRow();row.style.height=100/e.rows+'%';for(let c=0;c<e.cols;c++){const cell=row.insertCell();cell.style.background=r===0&&e.header?e.headerFill:e.fill;cell.style.fontWeight=r===0&&e.header?'700':'400';cell.textContent=e.cells[r][c];if(editable){cell.addEventListener('dblclick',ev=>{ev.stopPropagation();checkpoint();cell.contentEditable='plaintext-only';cell.focus();});cell.addEventListener('pointerdown',ev=>{ev.stopPropagation();if(!cell.isContentEditable)select();});cell.addEventListener('keydown',ev=>{ev.stopPropagation();if(ev.key==='Escape'){cell.blur();}});cell.addEventListener('input',()=>{e.cells[r][c]=cell.innerText.slice(0,1000);change();});cell.addEventListener('blur',()=>cell.contentEditable='false');}}}
 el.append(table);if(editable){const move=document.createElement('button');move.className='pres-table-move';move.textContent='Move Table';move.setAttribute('aria-label','Drag to move table');el.append(move);}
}
function drawTable(g,e){const w=e.w/e.cols,h=e.h/e.rows;g.textBaseline='middle';g.font=e.fontSize+'px Arial';for(let r=0;r<e.rows;r++)for(let c=0;c<e.cols;c++){const x=e.x+c*w,y=e.y+r*h;g.fillStyle=r===0&&e.header?e.headerFill:e.fill;g.fillRect(x,y,w,h);g.strokeStyle=e.border;g.lineWidth=1;g.strokeRect(x+.5,y+.5,w-1,h-1);g.save();g.beginPath();g.rect(x+5,y+3,w-10,h-6);g.clip();g.fillStyle=e.color;g.font=(r===0&&e.header?'bold ':'')+e.fontSize+'px Arial';const words=String(e.cells[r][c]).split(/\s+/),lines=[];let line='';for(const word of words){if(line&&g.measureText(line+' '+word).width>w-12){lines.push(line);line=word;}else line+=(line?' ':'')+word;}lines.push(line);lines.forEach((s,i)=>g.fillText(s,x+6,y+Math.max(e.fontSize*.65,(h-lines.length*e.fontSize*1.2)/2)+i*e.fontSize*1.2));g.restore();}}

function drawTile(g,e){
 const s=e.tileState||{},colors={white:'#ffffff',cream:'#fff8e7',blue:'#e3edfc',pink:'#ffe5ef',green:'#e5f5e9',lavender:'#eee7fc',yellow:'#fff2aa',charcoal:'#293345'},fill=colors[s.dataset?.bg]||'#ffffff';g.save();g.translate(e.x,e.y);g.fillStyle=e.tileType==='sticky'?(colors[s.dataset?.color]||'#fff2aa'):fill;g.strokeStyle='#dce1e9';g.lineWidth=1;g.beginPath();g.roundRect(1,1,e.w-2,e.h-2,Math.min(15,e.w/15));g.fill();g.stroke();g.fillStyle='#263249';g.textAlign='center';g.textBaseline='middle';
 if(e.tileType==='clock'){g.font='bold '+Math.min(e.w/4.4,e.h/2.3)+'px Arial';g.fillText(new Intl.DateTimeFormat([],{hour:'numeric',minute:'2-digit'}).format(new Date()),e.w/2,e.h/2,e.w-20);}
 else if(e.tileType==='rainbow'){const colors=['#ef5350','#ff9800','#ffdf49','#65bd7d','#4ba9eb','#6554b1','#b27bd3'];for(let i=0;i<7;i++){g.beginPath();g.strokeStyle=colors[i];g.lineWidth=e.w/24;g.arc(e.w/2,e.h*.75,e.w*(.4-i*.042),Math.PI,2*Math.PI);g.stroke();}}
 else if(e.tileType==='timer'){const r=Math.min(e.w,e.h)*.34,t=s.timer||{},progress=t.total?Math.max(0,Math.min(1,t.left/t.total)):1;g.fillStyle='#e3edfc';g.beginPath();g.arc(e.w/2,e.h/2,r,0,Math.PI*2);g.fill();g.fillStyle='#91b6e4';g.beginPath();g.moveTo(e.w/2,e.h/2);g.arc(e.w/2,e.h/2,r,-Math.PI/2,-Math.PI/2+Math.PI*2*progress);g.closePath();g.fill();g.fillStyle='#263249';g.font='bold '+e.w/8+'px Arial';g.fillText(Math.floor((t.left||0)/60)+':'+String(Math.floor((t.left||0)%60)).padStart(2,'0'),e.w/2,e.h/2);}
 else if(e.tileType==='tablemaker'||e.tileType==='tallychart'){const rows=contract.tile(e).tileState.special.rows;const max=Math.max(1,...rows.map(r=>r.value??r.count));const w=(e.w-30)/Math.max(1,rows.length);rows.forEach((r,i)=>{const h=(e.h-50)*(r.value??r.count)/max;g.fillStyle=r.color;g.fillRect(15+i*w,e.h-25-h,w*.72,h);g.fillStyle='#263249';g.font=Math.min(14,w/4)+'px Arial';g.fillText(r.label,15+i*w+w*.36,e.h-12,w*.9);});}
 else if(e.tileType==='grapher'){const state=contract.tile(e).tileState.special,r=state.range;g.strokeStyle='#dce1e9';g.lineWidth=1;for(let i=1;i<10;i++){g.beginPath();g.moveTo(e.w*i/10,0);g.lineTo(e.w*i/10,e.h);g.moveTo(0,e.h*i/10);g.lineTo(e.w,e.h*i/10);g.stroke();}g.fillStyle='#729de0';for(const p of state.points){g.beginPath();g.arc((p.x-r.xmin)/(r.xmax-r.xmin)*e.w,(r.ymax-p.y)/(r.ymax-r.ymin)*e.h,3,0,Math.PI*2);g.fill();}g.fillStyle='#263249';g.font=Math.min(20,e.w/14)+'px Arial';g.fillText('y = '+state.equation,e.w/2,20,e.w-20);}
 else if(e.tileType==='colorpicker'){g.fillStyle=s.special?.color||'#6f8fb7';g.beginPath();g.arc(e.w/2,e.h*.42,Math.min(e.w,e.h)*.24,0,Math.PI*2);g.fill();g.fillStyle='#263249';g.font=e.w/13+'px Arial';g.fillText(s.special?.color||'#6F8FB7',e.w/2,e.h*.8);}
 else {g.textAlign='left';g.font='bold '+Math.min(22,e.w/12)+'px Arial';const name=entries.find(t=>t[0]===e.tileType)?.[1]||'';g.fillText(name,14,24,e.w-28);g.font=Math.min(18,e.w/15)+'px Arial';const body=e.tileType==='sticky'?s.sticky:e.tileType==='translation'?(s.special?.input||'Translate text')+'\n'+(s.special?.output||''):(s.special?.memos||[]).map(m=>'▶ '+m.name).join('\n');String(body||'').split('\n').slice(0,8).forEach((line,i)=>g.fillText(line,14,58+i*24,e.w-28));}
 g.restore();
}
window.TeacherTilesPresentationModules={entries,tileSize,icon,mountTile,mountTable,drawTable,drawTile,dispose,async flush(){for(const e of active)e.capture();await Promise.all([...pending]);}};
})();
