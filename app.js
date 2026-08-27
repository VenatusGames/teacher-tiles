const workspace=document.getElementById('workspace');
const menu=document.getElementById('context-menu');
const uiSfxToggle=document.getElementById('ui-sfx-toggle');
const themeToggle=document.getElementById('theme-toggle');
const fullscreenToggle=document.getElementById('fullscreen-toggle');
const trashZone=document.getElementById('trash-zone');
let z=10,spawn={x:innerWidth/2,y:innerHeight/2},uid=0;
const selectedModules=new Set();
function clearSelection(){for(const el of selectedModules)el.classList.remove('is-selected');selectedModules.clear()}
function toggleSelection(m){if(selectedModules.has(m)){selectedModules.delete(m);m.classList.remove('is-selected')}else{selectedModules.add(m);m.classList.add('is-selected')}}
const FONT_OPTIONS=['inter','poppins','nunito','quicksand','oswald','lora','merriweather','playfair','caveat','phantom'];

const UI_SFX_KEY='teachertiles-ui-sfx-muted';
let uiSfxMuted=localStorage.getItem(UI_SFX_KEY)==='true';
const uiSfxPrototype=new Audio('assets/ui/pop.mp3');
uiSfxPrototype.preload='auto';

function playUiSfx(kind='click'){
  if(uiSfxMuted)return;
  try{
    const sound=uiSfxPrototype.cloneNode();
    sound.volume=kind==='intro'?.62:kind==='collection'?.18:.11;
    sound.playbackRate=kind==='intro'?1:kind==='collection'?.92:1.35;
    sound.currentTime=0;
    sound.play().catch(()=>{});
  }catch{}
}

function updateUiSfxToggle(){
  if(!uiSfxToggle)return;
  uiSfxToggle.textContent=uiSfxMuted?'♩':'♪';
  uiSfxToggle.title=uiSfxMuted?'Turn UI sounds on':'Mute UI sounds';
  uiSfxToggle.setAttribute('aria-label',uiSfxToggle.title);
  uiSfxToggle.classList.toggle('is-muted',uiSfxMuted);
}

uiSfxToggle?.addEventListener('click',()=>{
  const wasMuted=uiSfxMuted;
  uiSfxMuted=!uiSfxMuted;
  localStorage.setItem(UI_SFX_KEY,String(uiSfxMuted));
  updateUiSfxToggle();
  if(wasMuted&&!uiSfxMuted)playUiSfx('click');
});
updateUiSfxToggle();

document.addEventListener('click',e=>{
  const target=e.target;
  if(!(target instanceof Element))return;
  if(target.closest('#ui-sfx-toggle'))return;
  const interactive=target.closest('button,[role="button"],input[type="checkbox"],input[type="radio"],select');
  if(interactive&&!interactive.disabled)playUiSfx('click');
},true);


document.addEventListener('click',e=>{
  const t=e.target;
  if(!(t instanceof Element))return;
  if(t.closest('.collection-add,.collection-jar,.collection-canvas'))playUiSfx('collection');
},true);

document.addEventListener('change',e=>{
  const target=e.target;
  if(target instanceof HTMLInputElement&&target.type==='range')playUiSfx('click');
},true);

const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const formatCountdown=s=>{s=Math.max(0,Math.ceil(s));const m=Math.floor(s/60),ss=s%60;return `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`};

workspace.addEventListener('contextmenu',e=>{e.preventDefault();spawn={x:e.clientX,y:e.clientY};setMenuCategory('all');menu.classList.remove('is-open');void menu.offsetWidth;menu.style.left=`${e.clientX}px`;menu.style.top=`${e.clientY}px`;menu.classList.add('is-open');const r=menu.getBoundingClientRect();menu.style.left=`${clamp(e.clientX,8,innerWidth-r.width-8)}px`;menu.style.top=`${clamp(e.clientY,8,innerHeight-r.height-8)}px`;menu.setAttribute('aria-hidden','false')});
document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target))closeMenu();if(e.target===workspace&&!e.shiftKey)clearSelection()});

const menuFilters=[...menu.querySelectorAll('[data-category-filter]')];
function setMenuCategory(category='all'){
  menuFilters.forEach(b=>b.classList.toggle('is-active',b.dataset.categoryFilter===category));
  menu.querySelectorAll('.context-menu__item[data-category]').forEach(item=>{item.hidden=category!=='all'&&item.dataset.category!==category});
  const list=menu.querySelector('.context-menu__list');if(list)list.scrollTop=0;
}
menuFilters.forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();setMenuCategory(b.dataset.categoryFilter)}));
setMenuCategory('all');

function closeMenu(){menu.classList.remove('is-open');menu.setAttribute('aria-hidden','true')}
menu.addEventListener('click',e=>{const b=e.target.closest('[data-module]');if(!b)return;createModule(b.dataset.module,spawn.x,spawn.y);closeMenu()});

function createModule(type,x,y){const t=document.getElementById(`${type}-template`);if(!t)return null;const m=t.content.firstElementChild.cloneNode(true);workspace.appendChild(m);const w=m.offsetWidth,h=m.offsetHeight;m.style.left=`${clamp(x-w/2,0,innerWidth-w)}px`;m.style.top=`${clamp(y-18,0,innerHeight-h)}px`;bringToFront(m);setupCommon(m);if(type==='sticky')setupSticky(m);if(type==='timer')setupTimer(m);if(type==='interactive')setupHourglass(m);if(type==='clock')setupClock(m);if(type==='noise')setupNoise(m);if(type==='collections')setupCollections(m);if(type==='stoplight')setupStoplight(m);if(type==='image')setupImage(m);if(type==='youtube')setupYoutube(m);if(type==='boombox')setupBoombox(m);
  if(type==='spinner')setupSpinner(m);if(type==='textbubble')setupTextBubble(m);if(type==='todo')setupTodo(m);return m}
function bringToFront(m){m.style.zIndex=++z}
function setupCommon(m){m.addEventListener('pointerdown',e=>{if(e.shiftKey){e.preventDefault();e.stopPropagation();toggleSelection(m);bringToFront(m)}},true);m.addEventListener('pointerdown',e=>{bringToFront(m);const interactive=e.target.closest('button,input,select,textarea,[contenteditable],iframe');if(!e.shiftKey&&!interactive&&!selectedModules.has(m))clearSelection()});m.querySelector('.module-delete').addEventListener('click',()=>{selectedModules.delete(m);m._cleanup?.();m.remove()});setupDrag(m);setupResize(m)}
function setupDrag(m){
  const h=m.querySelector('.module-drag-handle'),guideX=workspace.querySelector('.snap-guide-x'),guideY=workspace.querySelector('.snap-guide-y');
  const SNAP=15;
  const pulse=mods=>{const unique=[...new Set(mods.filter(Boolean))];for(const el of unique){el.classList.remove('snap-pop');void el.offsetWidth;el.classList.add('snap-pop');setTimeout(()=>el.classList.remove('snap-pop'),240)}};
  const touching=(a,b)=>{const al=a.offsetLeft,at=a.offsetTop,ar=al+a.offsetWidth,ab=at+a.offsetHeight,bl=b.offsetLeft,bt=b.offsetTop,br=bl+b.offsetWidth,bb=bt+b.offsetHeight;const vo=Math.min(ab,bb)-Math.max(at,bt),ho=Math.min(ar,br)-Math.max(al,bl);return (vo>24&&(Math.abs(ar-bl)<=2.5||Math.abs(br-al)<=2.5))||(ho>24&&(Math.abs(ab-bt)<=2.5||Math.abs(bb-at)<=2.5))};
  const snappedGroup=start=>{const all=[...workspace.querySelectorAll('.module')],seen=new Set([start]),queue=[start];while(queue.length){const a=queue.shift();for(const b of all){if(seen.has(b)||b===a)continue;if(touching(a,b)){seen.add(b);queue.push(b)}}}return [...seen]};
  const clearPreview=()=>{guideX.classList.remove('is-visible');guideY.classList.remove('is-visible');document.querySelectorAll('.module.is-snap-target').forEach(x=>x.classList.remove('is-snap-target'))};
  const findSnap=(left,top)=>{const w=m.offsetWidth,hh=m.offsetHeight,right=left+w,bottom=top+hh;let sx=null,sy=null,bestX=SNAP+1,bestY=SNAP+1,targetX=null,targetY=null,seamX=0,seamY=0,xStart=0,xLength=0,yStart=0,yLength=0;for(const o of workspace.querySelectorAll('.module')){if(o===m||selectedModules.has(o))continue;const ol=o.offsetLeft,ot=o.offsetTop,ow=o.offsetWidth,oh=o.offsetHeight,or=ol+ow,ob=ot+oh;const vStart=Math.max(top,ot),vEnd=Math.min(bottom,ob),vOverlap=vEnd-vStart,hStart=Math.max(left,ol),hEnd=Math.min(right,or),hOverlap=hEnd-hStart;if(vOverlap>28){const a=Math.abs(left-or),b=Math.abs(right-ol);if(a<bestX){bestX=a;sx=or;targetX=o;seamX=or;xStart=vStart;xLength=vOverlap}if(b<bestX){bestX=b;sx=ol-w;targetX=o;seamX=ol;xStart=vStart;xLength=vOverlap}}if(hOverlap>28){const a=Math.abs(top-ob),b=Math.abs(bottom-ot);if(a<bestY){bestY=a;sy=ob;targetY=o;seamY=ob;yStart=hStart;yLength=hOverlap}if(b<bestY){bestY=b;sy=ot-hh;targetY=o;seamY=ot;yStart=hStart;yLength=hOverlap}}}return{left:sx,top:sy,targetX,targetY,seamX,seamY,xStart,xLength,yStart,yLength}};
  h.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();bringToFront(m);if(!selectedModules.has(m)){if(!e.shiftKey)clearSelection();selectedModules.add(m);m.classList.add('is-selected')}const group=[...selectedModules];const multi=group.length>1;for(const g of group)bringToFront(g);const origins=new Map(group.map(g=>[g,{left:g.offsetLeft,top:g.offsetTop}]));h.setPointerCapture(e.pointerId);const sx=e.clientX,sy=e.clientY;let pending=null,overTrash=false;
    const bounds=()=>{const rs=group.map(g=>g.getBoundingClientRect());return{left:Math.min(...rs.map(r=>r.left)),top:Math.min(...rs.map(r=>r.top)),right:Math.max(...rs.map(r=>r.right)),bottom:Math.max(...rs.map(r=>r.bottom))}};
    const trashHit=ev=>{if(!trashZone)return false;const b=trashZone.getBoundingClientRect();return ev.clientX>=b.left&&ev.clientX<=b.right&&ev.clientY>=b.top&&ev.clientY<=b.bottom};
    const setTrash=(visible,armed=false)=>{trashZone?.classList.toggle('is-visible',visible);trashZone?.classList.toggle('is-armed',visible&&armed);for(const g of group)g.classList.toggle('is-over-trash',visible&&armed)};
    setTrash(true,false);
    const move=ev=>{const dx=ev.clientX-sx,dy=ev.clientY-sy;for(const g of group){const o=origins.get(g);g.style.left=`${clamp(o.left+dx,0,innerWidth-g.offsetWidth)}px`;g.style.top=`${clamp(o.top+dy,0,innerHeight-g.offsetHeight)}px`}clearPreview();overTrash=trashHit(ev);setTrash(true,overTrash);if(overTrash||multi){pending=null;return}pending=findSnap(m.offsetLeft,m.offsetTop);if(pending.targetX)pending.targetX.classList.add('is-snap-target');if(pending.targetY)pending.targetY.classList.add('is-snap-target');if(pending.left!==null){const len=Math.max(12,Math.min(46,pending.xLength*.48)),st=pending.xStart+(pending.xLength-len)/2;Object.assign(guideX.style,{left:`${pending.seamX}px`,top:`${st}px`,height:`${len}px`});guideX.classList.add('is-visible')}if(pending.top!==null){const len=Math.max(12,Math.min(46,pending.yLength*.48)),st=pending.yStart+(pending.yLength-len)/2;Object.assign(guideY.style,{top:`${pending.seamY}px`,left:`${st}px`,width:`${len}px`});guideY.classList.add('is-visible')}};
    const cleanup=()=>{clearPreview();setTrash(false,false);h.removeEventListener('pointermove',move);h.removeEventListener('pointerup',end);h.removeEventListener('pointercancel',cancel)};
    const end=()=>{if(overTrash){cleanup();for(const g of group){selectedModules.delete(g);g._cleanup?.();g.classList.add('trash-delete');setTimeout(()=>g.remove(),150)}return}let willSnap=false;if(!multi&&pending){willSnap=pending.left!==null||pending.top!==null;if(pending.left!==null)m.style.left=`${clamp(pending.left,0,innerWidth-m.offsetWidth)}px`;if(pending.top!==null)m.style.top=`${clamp(pending.top,0,innerHeight-m.offsetHeight)}px`}cleanup();pulse(multi?group:(willSnap?snappedGroup(m):[m]))};
    const cancel=()=>cleanup();h.addEventListener('pointermove',move);h.addEventListener('pointerup',end);h.addEventListener('pointercancel',cancel)
  })
}
function setupResize(m){for(const d of ['t','r','b','l'])if(!m.querySelector(`[data-resize="${d}"]`)){const h=document.createElement('div');h.className=`resize-handle resize-handle--${d}`;h.dataset.resize=d;m.appendChild(h)}m.querySelectorAll('[data-resize]').forEach(h=>h.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();bringToFront(m);h.setPointerCapture(e.pointerId);const d=h.dataset.resize,sx=e.clientX,sy=e.clientY,sl=m.offsetLeft,st=m.offsetTop,sw=m.offsetWidth,sh=m.offsetHeight,cs=getComputedStyle(m),mw=parseFloat(cs.minWidth)||220,mh=parseFloat(cs.minHeight)||180;const move=ev=>{const dx=ev.clientX-sx,dy=ev.clientY-sy;let l=sl,t=st,w=sw,hh=sh;if(d.includes('r'))w=clamp(sw+dx,mw,innerWidth-sl);if(d.includes('b'))hh=clamp(sh+dy,mh,innerHeight-st);if(d.includes('l')){w=clamp(sw-dx,mw,sw+sl);l=sl+sw-w}if(d.includes('t')){hh=clamp(sh-dy,mh,sh+st);t=st+sh-hh}if(m._imageRatio){const ratio=m._imageRatio;if(d==='t'||d==='b'){w=Math.max(mw,hh*ratio);if(w>innerWidth-l){w=innerWidth-l;hh=w/ratio}if(d==='t')t=st+sh-hh}else{hh=Math.max(mh,w/ratio);if(hh>innerHeight-t){hh=innerHeight-t;w=hh*ratio}if(d.includes('l'))l=sl+sw-w;if(d.includes('t'))t=st+sh-hh}}Object.assign(m.style,{left:`${l}px`,top:`${t}px`,width:`${w}px`,height:`${hh}px`})};const end=()=>{h.removeEventListener('pointermove',move);h.removeEventListener('pointerup',end);h.removeEventListener('pointercancel',end)};h.addEventListener('pointermove',move);h.addEventListener('pointerup',end);h.addEventListener('pointercancel',end)}))}

function setupSticky(m){const ed=m.querySelector('.sticky-editor'),bar=m.querySelector('.sticky-toolbar'),size=m.querySelector('.sticky-font-size'),cycle=m.querySelector('.sticky-color-cycle'),font=m.querySelector('.sticky-font-cycle'),dot=cycle.querySelector('span'),colors=['yellow','pink','blue','green','lavender'],hex={yellow:'#fff2aa',pink:'#ffdbe5',blue:'#dbeeff',green:'#ddf4df',lavender:'#eadfff'};let i=0;bar.addEventListener('pointerdown',e=>{if(e.target.closest('button'))e.preventDefault()});bar.addEventListener('click',e=>{const b=e.target.closest('[data-command]');if(!b)return;ed.focus();document.execCommand(b.dataset.command,false,null)});size.addEventListener('change',()=>{ed.focus();document.execCommand('fontSize',false,'7');ed.querySelectorAll('font[size="7"]').forEach(f=>{f.removeAttribute('size');f.style.fontSize=`${size.value}px`})});font.addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));cycle.addEventListener('click',()=>{i=(i+1)%colors.length;m.dataset.color=colors[i];dot.style.background=hex[colors[i]]})}

const shapePaths={
  circle:'M50 4 A46 46 0 1 1 49.999 4 Z',
  triangle:'M50 5 L96 92 L4 92 Z',
  square:'M12 8 H88 Q92 8 92 12 V88 Q92 92 88 92 H12 Q8 92 8 88 V12 Q8 8 12 8 Z',
  star:'M50 4 L61.4 36.2 L95.5 36.9 L68.4 57.7 L78.2 90.4 L50 71 L21.8 90.4 L31.6 57.7 L4.5 36.9 L38.6 36.2 Z',
  heart:'M50 91 C42 82 10 63 7 35 C5 16 18 6 33 6 C42 6 48 11 50 18 C52 11 58 6 67 6 C82 6 95 16 93 35 C90 63 58 82 50 91 Z'
};

function launchConfetti(m){const layer=m.querySelector('.confetti-layer');if(!layer)return;layer.innerHTML='';const colors=['#ff6b7a','#ffd34e','#69c6ff','#7edc8b','#9d7cff','#ff9c5a'];for(let i=0;i<54;i++){const p=document.createElement('i');p.className='confetti-piece';const a=Math.random()*Math.PI*2,d=90+Math.random()*230;p.style.setProperty('--x',`${Math.cos(a)*d}px`);p.style.setProperty('--y',`${Math.sin(a)*d-50}px`);p.style.setProperty('--r',`${Math.round(Math.random()*760-380)}deg`);p.style.setProperty('--confetti',colors[i%colors.length]);p.style.width=`${6+Math.random()*5}px`;p.style.height=`${8+Math.random()*10}px`;p.style.animationDelay=`${Math.random()*.12}s`;layer.appendChild(p)}setTimeout(()=>layer.innerHTML='',1700)}

function bindTimerControls(m,onRender,{onFinish}={}){const remain=m.querySelector('.timer-remaining, .hourglass-countdown, .candle-countdown'),presets=[...m.querySelectorAll('[data-minutes]')],input=m.querySelector('.timer-custom'),set=m.querySelector('.timer-set'),start=m.querySelector('.timer-start'),reset=m.querySelector('.timer-reset');let total=300,left=300,running=false,end=0,interval=null,finished=false;const render=()=>{remain.textContent=formatCountdown(left);onRender({progress:1-clamp(left/total,0,1),running,left,total})};const stop=()=>{if(interval){clearInterval(interval);interval=null}};const setDuration=min=>{const n=Number(min);if(!Number.isFinite(n)||n<=0)return;running=false;finished=false;stop();m.classList.remove('is-running','candle-finished');total=Math.round(n*60);left=total;end=0;start.textContent='Start';render()};presets.forEach(b=>b.addEventListener('click',()=>{presets.forEach(x=>x.classList.remove('is-active'));b.classList.add('is-active');input.value='';setDuration(b.dataset.minutes)}));set.addEventListener('click',()=>{if(input.value){presets.forEach(x=>x.classList.remove('is-active'));setDuration(input.value)}});input.addEventListener('keydown',e=>{if(e.key==='Enter')set.click()});const tick=()=>{if(!running)return;left=Math.max(0,(end-Date.now())/1000);render();if(left<=0){running=false;stop();m.classList.remove('is-running');start.textContent='Start';if(!finished){finished=true;onFinish?.();m.animate([{transform:'scale(1)'},{transform:'scale(1.025)'},{transform:'scale(1)'}],{duration:500})}}};start.addEventListener('click',()=>{if(running){left=Math.max(0,(end-Date.now())/1000);running=false;stop();m.classList.remove('is-running');start.textContent='Resume';render();return}if(left<=0){left=total;finished=false;m.classList.remove('candle-finished')}running=true;end=Date.now()+left*1000;m.classList.add('is-running');start.textContent='Pause';interval=setInterval(tick,80);tick()});reset.addEventListener('click',()=>{running=false;finished=false;stop();left=total;m.classList.remove('is-running','candle-finished');start.textContent='Start';render()});render();return()=>stop()}

function setupTimer(m){const clip=m.querySelector('.shape-clip'),clipPath=m.querySelector('.shape-clip path'),outline=m.querySelector('.shape-outline'),foreign=m.querySelector('.shape-foreign'),fill=m.querySelector('.shape-fill'),shapeButtons=[...m.querySelectorAll('.timer-shapes [data-shape]')];const clipId=`shape-clip-${++uid}`;clip.id=clipId;foreign.setAttribute('clip-path',`url(#${clipId})`);const setShape=shape=>{const d=shapePaths[shape]||shapePaths.circle;clipPath.setAttribute('d',d);outline.setAttribute('d',d)};shapeButtons.forEach(b=>b.addEventListener('click',()=>{shapeButtons.forEach(x=>x.classList.remove('is-active'));b.classList.add('is-active');setShape(b.dataset.shape)}));m.querySelector('.timer-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));m.querySelector('.timer-shape-color').addEventListener('click',()=>cycleData(m,'shapeColor',['blue','green','amber','rose','purple','teal']));setShape('circle');m._cleanup=bindTimerControls(m,({progress})=>fill.style.setProperty('--progress',`${progress*360}deg`),{onFinish:()=>launchConfetti(m)})}

function setupHourglass(m){const hourStage=m.querySelector('.hourglass-stage'),candleStage=m.querySelector('.candle-stage'),countdownHour=m.querySelector('.hourglass-countdown'),countdownCandle=m.querySelector('.candle-countdown'),topClip=m.querySelector('.hg-top-clip'),bottomClip=m.querySelector('.hg-bottom-clip'),top=m.querySelector('.hg-sand-top'),bottom=m.querySelector('.hg-sand-bottom'),pile=m.querySelector('.hg-bottom-pile'),stream=m.querySelector('.hg-stream'),candleBody=m.querySelector('.candle-body'),candleScene=m.querySelector('.candle-scene'),modeButtons=[...m.querySelectorAll('[data-interactive]')],bgBtn=m.querySelector('.interactive-bg'),candleColorBtn=m.querySelector('.candle-color-control');const topId=`hg-top-${++uid}`,bottomId=`hg-bottom-${++uid}`;topClip.id=topId;bottomClip.id=bottomId;top.setAttribute('clip-path',`url(#${topId})`);bottom.setAttribute('clip-path',`url(#${bottomId})`);pile.setAttribute('clip-path',`url(#${bottomId})`);let mode='hourglass';const setMode=next=>{mode=next;m.dataset.interactiveMode=mode;hourStage.hidden=mode!=='hourglass';candleStage.hidden=mode!=='candle';modeButtons.forEach(b=>b.classList.toggle('is-active',b.dataset.interactive===mode))};modeButtons.forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.interactive)));bgBtn.addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));candleColorBtn.addEventListener('click',()=>cycleData(m,'candleColor',['cream','blush','sage','sky','lavender','charcoal']));const cleanup=bindTimerControls(m,({progress,running,left})=>{const text=formatCountdown(left);countdownHour.textContent=text;countdownCandle.textContent=text;const topY=62+96*progress,topH=96*(1-progress);top.setAttribute('y',topY.toFixed(2));top.setAttribute('height',Math.max(0,topH).toFixed(2));const bottomH=96*progress,bottomY=278-bottomH;bottom.setAttribute('y',bottomY.toFixed(2));bottom.setAttribute('height',bottomH.toFixed(2));pile.setAttribute('opacity',progress>0.03?'1':'0');pile.setAttribute('transform',`translate(0 ${Math.max(0,30-progress*30).toFixed(2)}) scale(1 ${Math.max(.18,progress).toFixed(3)})`);stream.setAttribute('opacity',running&&left>0?'1':'0');const h=Math.max(8,100*(1-progress));candleScene.style.setProperty('--candle-height',`${h}%`);m.classList.toggle('candle-finished',mode==='candle'&&left<=0)}, {onFinish:()=>{if(mode==='candle')m.classList.add('candle-finished')}});setMode('hourglass');m._cleanup=cleanup}

function cycleData(m,key,values){const current=m.dataset[key]||values[0],i=values.indexOf(current);m.dataset[key]=values[(i+1)%values.length]}
function setupClock(m){
  const display=m.querySelector('.clock-display'),content=m.querySelector('.clock-content'),main=m.querySelector('.clock-main'),sec=m.querySelector('.clock-seconds'),period=m.querySelector('.clock-period'),secondsBtn=m.querySelector('.clock-toggle-seconds'),periodBtn=m.querySelector('.clock-toggle-period');
  const fit=()=>{const aw=Math.max(30,display.clientWidth-12),ah=Math.max(30,display.clientHeight-12);let lo=12,hi=1200,best=12;for(let n=0;n<18;n++){const mid=(lo+hi)/2;m.style.setProperty('--clock-size',`${mid}px`);const r=content.getBoundingClientRect();if(r.width<=aw&&r.height<=ah){best=mid;lo=mid}else hi=mid}m.style.setProperty('--clock-size',`${Math.max(12,best*.975)}px`)};
  const refit=()=>requestAnimationFrame(fit);
  m.querySelector('.clock-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.clock-font').addEventListener('click',()=>{cycleData(m,'font',FONT_OPTIONS);refit()});
  m.querySelector('.clock-text').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));
  secondsBtn.addEventListener('click',()=>{m.classList.toggle('show-seconds');secondsBtn.classList.toggle('is-active');refit()});
  periodBtn.addEventListener('click',()=>{m.classList.toggle('hide-period');periodBtn.classList.toggle('is-active',!m.classList.contains('hide-period'));refit()});
  const update=()=>{const d=new Date(),parts=new Intl.DateTimeFormat([],{hour:'numeric',minute:'2-digit',hour12:true}).formatToParts(d);const hour=parts.find(p=>p.type==='hour')?.value||'',minute=parts.find(p=>p.type==='minute')?.value||'',dayPeriod=parts.find(p=>p.type==='dayPeriod')?.value||'';main.textContent=`${hour}:${minute}`;sec.textContent=`:${String(d.getSeconds()).padStart(2,'0')}`;period.textContent=dayPeriod;refit()};
  const ro=new ResizeObserver(refit);ro.observe(m);ro.observe(display);const id=setInterval(update,250);update();m._cleanup=()=>{clearInterval(id);ro.disconnect()}
}

function setupNoise(m){const button=m.querySelector('.noise-start'),fill=m.querySelector('.noise-fill'),db=m.querySelector('.noise-db'),status=m.querySelector('.noise-status'),range=m.querySelector('.noise-range'),threshold=m.querySelector('.noise-threshold');m.querySelector('.noise-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));m.querySelector('.noise-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));m.querySelector('.noise-text').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));const meterBtn=m.querySelector('.noise-meter-color');meterBtn.addEventListener('click',()=>{cycleData(m,'meter',['blue','green','amber','rose','purple']);meterBtn.dataset.current=m.dataset.meter});meterBtn.dataset.current=m.dataset.meter;let stream=null,ctx=null,analyser=null,raf=0,active=false;const data=new Uint8Array(1024);const updateThreshold=()=>threshold.style.left=`${range.value}%`;range.addEventListener('input',updateThreshold);updateThreshold();const stop=()=>{active=false;cancelAnimationFrame(raf);stream?.getTracks().forEach(t=>t.stop());if(ctx&&ctx.state!=='closed')ctx.close();stream=ctx=analyser=null;fill.style.width='0%';db.textContent='—';status.textContent='Microphone is off';button.textContent='Enable microphone';m.classList.remove('is-loud')};const loop=()=>{if(!active||!analyser)return;analyser.getByteTimeDomainData(data);let sum=0;for(let i=0;i<data.length;i++){const n=(data[i]-128)/128;sum+=n*n}const rms=Math.sqrt(sum/data.length);const level=clamp((20*Math.log10(rms||0.00001)+60)/60*100,0,100);fill.style.width=`${level}%`;db.textContent=`${Math.round(level)}%`;const loud=level>=Number(range.value);m.classList.toggle('is-loud',loud);status.textContent=loud?'Above alert level':'Listening';raf=requestAnimationFrame(loop)};button.addEventListener('click',async()=>{if(active){stop();return}try{stream=await navigator.mediaDevices.getUserMedia({audio:true});ctx=new (window.AudioContext||window.webkitAudioContext)();analyser=ctx.createAnalyser();analyser.fftSize=2048;ctx.createMediaStreamSource(stream).connect(analyser);active=true;button.textContent='Stop microphone';status.textContent='Listening';loop()}catch{status.textContent=location.protocol==='file:'?'Microphone needs localhost or HTTPS':'Microphone permission was denied';button.textContent='Try again'}});m._cleanup=stop}

function setupCollections(m){
  const canvas=m.querySelector('.collection-canvas'),ctx=canvas.getContext('2d'),add=m.querySelector('.collection-add'),typeBtn=m.querySelector('.collection-type'),typeLabel=m.querySelector('.collection-type-label'),picker=m.querySelector('.collection-picker'),pickerButtons=[...m.querySelectorAll('[data-collection-type]')],countEl=m.querySelector('.collection-count'),clear=m.querySelector('.collection-clear'),bgBtn=m.querySelector('.collection-bg');
  const types=[
    {id:'pompom',label:'Pom poms'},{id:'candy',label:'Candies'},{id:'star',label:'Stars'},
    {id:'jellybean',label:'Jellybeans'},{id:'fruit',label:'Fruits'},{id:'coin',label:'Coins'}
  ];
  const colors=['#ef7e91','#70bce9','#f1c858','#72c58a','#9a82d8','#ef9b61'];
  const jarBehind=new Image();
  jarBehind.src='assets/jar-behind.png';
  let typeIndex=0,bodies=[],particles=[],raf=0,last=performance.now(),cw=260,ch=320,dpr=1,dead=false,currentJar=null;

  const jarRectFor=(w,h)=>{const size=Math.max(140,Math.min(w*.96,h*.98));return{x:(w-size)/2,y:(h-size)/2,w:size,h:size}};
  const jarBounds=()=>{const j=currentJar||jarRectFor(cw,ch);return{floor:j.y+j.h*.895,top:j.y+j.h*.105,neckL:j.x+j.w*.285,neckR:j.x+j.w*.715,bodyL:j.x+j.w*.215,bodyR:j.x+j.w*.785,shoulderTop:j.y+j.h*.205,shoulderBottom:j.y+j.h*.31,bottomCurve:j.y+j.h*.765,bottomL:j.x+j.w*.265,bottomR:j.x+j.w*.735,j}};
  const wallsAt=y=>{const b=jarBounds();if(y<b.shoulderTop)return[b.neckL,b.neckR];if(y<b.shoulderBottom){const t=clamp((y-b.shoulderTop)/(b.shoulderBottom-b.shoulderTop),0,1),ease=t*t*(3-2*t);return[b.neckL+(b.bodyL-b.neckL)*ease,b.neckR+(b.bodyR-b.neckR)*ease]}if(y>b.bottomCurve){const t=clamp((y-b.bottomCurve)/(b.floor-b.bottomCurve),0,1),ease=t*t*(3-2*t);return[b.bodyL+(b.bottomL-b.bodyL)*ease,b.bodyR+(b.bottomR-b.bodyR)*ease]}return[b.bodyL,b.bodyR]};

  function resizeCanvas(){
    const r=canvas.getBoundingClientRect(),nw=Math.max(220,r.width),nh=Math.max(210,r.height),old=currentJar||jarRectFor(cw,ch),next=jarRectFor(nw,nh),scale=next.w/old.w;
    if(bodies.length)for(const b of bodies){b.x=next.x+(b.x-old.x)*scale;b.y=next.y+(b.y-old.y)*scale;b.r*=scale}
    if(particles.length)for(const p of particles){p.x=next.x+(p.x-old.x)*scale;p.y=next.y+(p.y-old.y)*scale;p.r*=scale}
    cw=nw;ch=nh;currentJar=next;dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.round(cw*dpr);canvas.height=Math.round(ch*dpr);ctx.setTransform(dpr,0,0,dpr,0,0)
  }
  const ro=new ResizeObserver(resizeCanvas);ro.observe(canvas);resizeCanvas();

  function burst(body,n=7){
    for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=18+Math.random()*48;particles.push({type:body.type,variant:body.variant,color:body.color,x:body.x+(Math.random()-.5)*body.r*.5,y:body.y+body.r*.4,vx:Math.cos(a)*s,vy:Math.sin(a)*s-18,life:.38+Math.random()*.28,max:.66,r:Math.max(1.4,body.r*(.11+Math.random()*.08)),rot:Math.random()*Math.PI*2,av:(Math.random()-.5)*4})}
  }

  function addItem(){
    if(bodies.length>=80)return;
    const t=types[typeIndex],b=jarBounds(),r=Math.max(9,Math.min(16,b.j.w*.036))*(.88+Math.random()*.22);
    bodies.push({type:t.id,x:(b.neckL+b.neckR)/2+(Math.random()-.5)*(b.neckR-b.neckL)*.28,y:b.top-r-22,vx:(Math.random()-.5)*20,vy:18+Math.random()*12,r,rot:(Math.random()-.5)*.4,av:(Math.random()-.5)*1.25,color:colors[bodies.length%colors.length],variant:Math.floor(Math.random()*4),impact:false,onFloor:false});
    updateCount()
  }
  function updateCount(){countEl.textContent=`${bodies.length} item${bodies.length===1?'':'s'}`}

  function physics(dt){
    const floor=jarBounds().floor;
    for(const b of bodies){
      b.vy+=650*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;b.rot+=b.av*dt;
      b.vx*=Math.pow(.985,dt*60);b.av*=Math.pow(.94,dt*60);b.av=clamp(b.av,-2.25,2.25);b.onFloor=false;
      const [wl,wr]=wallsAt(b.y),edgeR=b.r*(b.type==='candy'?1.13:1.07);
      if(b.x-edgeR<wl){b.x=wl+edgeR;b.vx=Math.abs(b.vx)*.38;b.av=clamp(b.av+.18,-1.6,1.6)}
      if(b.x+edgeR>wr){b.x=wr-edgeR;b.vx=-Math.abs(b.vx)*.38;b.av=clamp(b.av-.18,-1.6,1.6)}
      if(b.y+b.r>floor){
        const impact=Math.abs(b.vy);b.y=floor-b.r;b.vy=-Math.abs(b.vy)*.14;b.vx*=.72;b.av*=.35;b.onFloor=true;
        if(impact>105&&!b.impact){burst(b,5);b.impact=true}
        if(Math.abs(b.vy)<18)b.vy=0;if(Math.abs(b.vx)<2.2)b.vx=0;if(Math.abs(b.av)<.12)b.av=0;
      }else b.impact=false;
    }
    for(let pass=0;pass<3;pass++)for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
      const a=bodies[i],b=bodies[j],dx=b.x-a.x,dy=b.y-a.y,rr=a.r+b.r,d2=dx*dx+dy*dy;if(d2<=0||d2>=rr*rr)continue;
      const d=Math.sqrt(d2),nx=dx/d,ny=dy/d,over=rr-d;a.x-=nx*over*.5;a.y-=ny*over*.5;b.x+=nx*over*.5;b.y+=ny*over*.5;
      const rvx=b.vx-a.vx,rvy=b.vy-a.vy,rel=rvx*nx+rvy*ny;if(rel<0){const imp=-(1.08)*rel*.46;a.vx-=imp*nx;a.vy-=imp*ny;b.vx+=imp*nx;b.vy+=imp*ny;const spin=clamp(rel*.0007,-.13,.13);a.av=clamp(a.av-spin,-1.5,1.5);b.av=clamp(b.av+spin,-1.5,1.5)}
    }
    for(const b of bodies){
      const [wl,wr]=wallsAt(b.y),edgeR=b.r*(b.type==='candy'?1.13:1.07);
      if(b.x-edgeR<wl){b.x=wl+edgeR;b.vx=Math.max(0,b.vx)*.3}
      if(b.x+edgeR>wr){b.x=wr-edgeR;b.vx=Math.min(0,b.vx)*.3}
      if(b.y+b.r>floor){b.y=floor-b.r;b.vy=Math.min(0,b.vy)*.15}
      if(b.y+b.r>=floor-.8){b.vx*=Math.pow(.88,dt*60);b.av*=Math.pow(.72,dt*60);if(Math.abs(b.vx)<1.5)b.vx=0;if(Math.abs(b.av)<.09)b.av=0}
      if(Math.hypot(b.vx,b.vy)<2.2&&Math.abs(b.av)<.1){b.vx=0;if(Math.abs(b.vy)<2)b.vy=0;b.av=0}
    }
    for(const p of particles){p.vy+=180*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.av*dt;p.life-=dt}
    particles=particles.filter(p=>p.life>0)
  }

  function starPath(r){ctx.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rad=i%2?r*.46:r,px=Math.cos(a)*rad,py=Math.sin(a)*rad;i?ctx.lineTo(px,py):ctx.moveTo(px,py)}ctx.closePath()}
  function drawPompom(b){
    const r=b.r;ctx.save();ctx.shadowColor='rgba(0,0,0,.13)';ctx.shadowBlur=r*.22;ctx.fillStyle=b.color;ctx.beginPath();ctx.arc(0,0,r*.7,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    for(let i=0;i<34;i++){const a=i*Math.PI*2/34+(b.variant*.17),dist=r*(.58+((i*17)%7)/34),fr=r*(.15+((i*13)%5)/42);ctx.globalAlpha=.78+.18*((i%3)/2);ctx.fillStyle=b.color;ctx.beginPath();ctx.arc(Math.cos(a)*dist,Math.sin(a)*dist,fr,0,Math.PI*2);ctx.fill()}
    ctx.globalAlpha=.28;ctx.fillStyle='#fff';for(let i=0;i<8;i++){const a=(i+.3)*Math.PI*2/8;ctx.beginPath();ctx.arc(Math.cos(a)*r*.42-r*.08,Math.sin(a)*r*.42-r*.1,r*.085,0,Math.PI*2);ctx.fill()}ctx.restore()
  }
  function drawBody(b){
    ctx.save();ctx.translate(b.x,b.y);ctx.rotate(b.rot);const r=b.r;
    if(b.type==='pompom')drawPompom(b);
    else if(b.type==='candy'){
      ctx.fillStyle=b.color;ctx.beginPath();ctx.roundRect(-r*.64,-r*.48,r*1.28,r*.96,r*.25);ctx.fill();ctx.beginPath();ctx.moveTo(-r*.62,-r*.32);ctx.lineTo(-r*1.05,-r*.62);ctx.lineTo(-r*.98,0);ctx.lineTo(-r*1.05,r*.62);ctx.lineTo(-r*.62,r*.32);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(r*.62,-r*.32);ctx.lineTo(r*1.05,-r*.62);ctx.lineTo(r*.98,0);ctx.lineTo(r*1.05,r*.62);ctx.lineTo(r*.62,r*.32);ctx.closePath();ctx.fill();ctx.strokeStyle='rgba(255,255,255,.5)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-r*.3,-r*.35);ctx.lineTo(r*.35,r*.28);ctx.stroke()
    }else if(b.type==='star'){
      ctx.fillStyle='#f0bd47';ctx.strokeStyle='#d39a25';ctx.lineWidth=1.2;starPath(r);ctx.fill();ctx.stroke();ctx.fillStyle='rgba(255,255,255,.32)';ctx.beginPath();ctx.arc(-r*.18,-r*.2,r*.16,0,Math.PI*2);ctx.fill()
    }else if(b.type==='jellybean'){
      ctx.scale(1.08,.86);ctx.fillStyle=['#8f78d8','#e7728b','#65b97d','#efb74e'][b.variant%4];ctx.beginPath();ctx.moveTo(-r*.75,-r*.1);ctx.bezierCurveTo(-r*.92,-r*.72,-r*.18,-r*.92,r*.3,-r*.66);ctx.bezierCurveTo(r*.95,-r*.32,r*.87,r*.5,r*.28,r*.72);ctx.bezierCurveTo(-r*.28,r*.92,-r*.52,r*.44,-r*.75,-r*.1);ctx.fill();ctx.fillStyle='rgba(255,255,255,.3)';ctx.beginPath();ctx.ellipse(-r*.23,-r*.38,r*.25,r*.1,-.35,0,Math.PI*2);ctx.fill()
    }else if(b.type==='fruit'){
      const fc=['#ef6b62','#f09a47','#e9c64e','#8cc765'][b.variant%4];ctx.fillStyle=fc;ctx.beginPath();ctx.arc(0,r*.08,r*.77,0,Math.PI*2);ctx.fill();ctx.fillStyle='#5e8f4f';ctx.beginPath();ctx.ellipse(r*.22,-r*.74,r*.34,r*.13,-.45,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#75543b';ctx.lineWidth=1.7;ctx.beginPath();ctx.moveTo(0,-r*.55);ctx.lineTo(r*.08,-r*.92);ctx.stroke();ctx.fillStyle='rgba(255,255,255,.24)';ctx.beginPath();ctx.arc(-r*.27,-r*.18,r*.18,0,Math.PI*2);ctx.fill()
    }else{
      ctx.fillStyle='#e5b23e';ctx.strokeStyle='#b98220';ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(0,0,r*.78,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.strokeStyle='rgba(255,244,180,.7)';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(0,0,r*.56,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#a9781d';ctx.font=`700 ${r*.7}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('¢',0,0)
    }
    ctx.restore()
  }
  function drawParticle(p){
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.globalAlpha=Math.max(0,p.life/p.max);const r=p.r;
    if(p.type==='pompom'){ctx.fillStyle=p.color;for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ctx.beginPath();ctx.arc(Math.cos(a)*r*.4,Math.sin(a)*r*.4,r*.55,0,Math.PI*2);ctx.fill()}}
    else if(p.type==='candy'){ctx.fillStyle=p.color;ctx.fillRect(-r*.7,-r*.38,r*1.4,r*.76);ctx.beginPath();ctx.moveTo(-r*.7,0);ctx.lineTo(-r*1.25,-r*.55);ctx.lineTo(-r*1.25,r*.55);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(r*.7,0);ctx.lineTo(r*1.25,-r*.55);ctx.lineTo(r*1.25,r*.55);ctx.closePath();ctx.fill()}
    else if(p.type==='star'){ctx.fillStyle='#f0bd47';starPath(r*1.1);ctx.fill()}
    else if(p.type==='jellybean'){ctx.fillStyle=['#8f78d8','#e7728b','#65b97d','#efb74e'][p.variant%4];ctx.beginPath();ctx.ellipse(0,0,r*1.15,r*.72,.45,0,Math.PI*2);ctx.fill()}
    else if(p.type==='fruit'){ctx.fillStyle=['#ef6b62','#f09a47','#e9c64e','#8cc765'][p.variant%4];ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.fillStyle='#5e8f4f';ctx.beginPath();ctx.ellipse(r*.35,-r*.75,r*.55,r*.22,-.45,0,Math.PI*2);ctx.fill()}
    else{ctx.fillStyle='#e5b23e';ctx.strokeStyle='#b98220';ctx.lineWidth=.8;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.stroke()}
    ctx.restore()
  }
  function draw(){
    ctx.clearRect(0,0,cw,ch);const j=currentJar||jarRectFor(cw,ch);
    if(jarBehind.complete)ctx.drawImage(jarBehind,j.x,j.y,j.w,j.h);
    for(const b of bodies)drawBody(b);for(const p of particles)drawParticle(p);
    if(jarBehind.complete){ctx.save();ctx.beginPath();ctx.rect(j.x+j.w*.205,j.y+j.h*.092,j.w*.59,j.h*.078);ctx.clip();ctx.drawImage(jarBehind,j.x,j.y,j.w,j.h);ctx.restore()}
  }
  function loop(now){if(dead)return;const dt=Math.min(.025,(now-last)/1000||.016);last=now;physics(dt);draw();raf=requestAnimationFrame(loop)}
  function renderType(){const t=types[typeIndex];m.dataset.item=t.id;typeLabel.textContent=t.label.toUpperCase();const preview=m.querySelector('.collection-current-preview');preview.className=`collectible-preview collection-current-preview preview-${t.id}`;pickerButtons.forEach(b=>b.classList.toggle('is-active',b.dataset.collectionType===t.id))}
  function closePicker(){picker.hidden=true;typeBtn.setAttribute('aria-expanded','false')}
  function togglePicker(){picker.hidden=!picker.hidden;typeBtn.setAttribute('aria-expanded',String(!picker.hidden))}
  canvas.addEventListener('pointerdown',e=>{const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,[l,rr]=wallsAt(y),b=jarBounds();if(x>=l&&x<=rr&&y>b.top&&y<b.floor+8)addItem()});
  add.addEventListener('click',addItem);
  typeBtn.addEventListener('click',e=>{e.stopPropagation();togglePicker()});
  picker.addEventListener('click',e=>{const b=e.target.closest('[data-collection-type]');if(!b)return;const i=types.findIndex(t=>t.id===b.dataset.collectionType);if(i>=0){typeIndex=i;renderType();closePicker()}});
  document.addEventListener('pointerdown',e=>{if(!m.contains(e.target)||!e.target.closest('.collection-picker-wrap'))closePicker()});
  bgBtn.addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  clear.addEventListener('click',()=>{bodies=[];particles=[];updateCount()});renderType();updateCount();raf=requestAnimationFrame(loop);
  m._cleanup=()=>{dead=true;cancelAnimationFrame(raf);ro.disconnect()}
}

function setupStoplight(m){
  const stage=m.querySelector('.stoplight-stage'),img=m.querySelector('.stoplight-image'),label=m.querySelector('.stoplight-label'),bg=m.querySelector('.stoplight-bg');
  const states=[
    {id:'green',label:'GO',src:'assets/stoplight-green.png',alt:'Green stoplight'},
    {id:'yellow',label:'LISTEN',src:'assets/stoplight-yellow.png',alt:'Yellow stoplight'},
    {id:'red',label:'STOP',src:'assets/stoplight-red.png',alt:'Red stoplight'}
  ];
  let i=0;
  const render=(animate=true)=>{const s=states[i];m.dataset.stoplight=s.id;label.textContent=s.label;img.src=s.src;img.alt=s.alt;if(animate){stage.classList.remove('stoplight-pop');void stage.offsetWidth;stage.classList.add('stoplight-pop');setTimeout(()=>stage.classList.remove('stoplight-pop'),220)}};
  stage.addEventListener('click',()=>{i=(i+1)%states.length;render(true)});
  bg.addEventListener('click',e=>{e.stopPropagation();cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal'])});
  render(false);
}



function getDraggedImageSource(dt){
  const file=[...dt.files].find(f=>f.type.startsWith('image/'));if(file)return{file};
  const uri=(dt.getData('text/uri-list')||'').split(/\r?\n/).find(x=>x&&!x.startsWith('#'));
  const html=dt.getData('text/html')||'';const match=html.match(/<img[^>]+src=["']([^"']+)["']/i);
  const plain=(dt.getData('text/plain')||'').trim();
  const url=match?.[1]||uri||(/^https?:\/\//i.test(plain)||/^data:image\//i.test(plain)?plain:'');
  return url?{url}:null
}
function setupImage(m){
  const stage=m.querySelector('.image-stage'),img=m.querySelector('.image-display'),input=m.querySelector('.image-input');let objectUrl='';
  const fitModule=()=>{const ratio=(img.naturalWidth||1)/(img.naturalHeight||1);m._imageRatio=ratio;const maxW=Math.min(680,innerWidth-36),maxH=Math.min(560,innerHeight-36);let w=Math.min(560,maxW),h=w/ratio;if(h>maxH){h=maxH;w=h*ratio}w=Math.max(220,w);h=w/ratio;if(h<150){h=150;w=h*ratio}m.style.width=`${w}px`;m.style.height=`${h}px`;m.style.left=`${clamp(m.offsetLeft,0,innerWidth-w)}px`;m.style.top=`${clamp(m.offsetTop,0,innerHeight-h)}px`};
  const setSrc=(src,alt='Board image')=>{img.onload=fitModule;img.onerror=()=>{img.hidden=true;m.classList.remove('has-image')};img.src=src;img.alt=alt;img.hidden=false;m.classList.add('has-image')};
  const setFile=file=>{if(!file||!file.type?.startsWith('image/'))return;if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=URL.createObjectURL(file);setSrc(objectUrl,file.name||'Board image')};
  const setUrl=url=>{if(!url)return;if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=''}setSrc(url,'Board image')};
  m._setImage=setFile;m._setImageUrl=setUrl;
  stage.addEventListener('click',()=>input.click());input.addEventListener('change',()=>setFile(input.files?.[0]));
  stage.addEventListener('dragover',e=>{e.preventDefault();e.stopPropagation();stage.classList.add('is-dragover')});
  stage.addEventListener('dragleave',()=>stage.classList.remove('is-dragover'));
  stage.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();stage.classList.remove('is-dragover');const src=getDraggedImageSource(e.dataTransfer);if(src?.file)setFile(src.file);else if(src?.url)setUrl(src.url)});
  const prior=m._cleanup;m._cleanup=()=>{prior?.();if(objectUrl)URL.revokeObjectURL(objectUrl)}
}

function setupYoutube(m){
  const frame=m.querySelector('.youtube-frame'),empty=m.querySelector('.youtube-empty'),input=m.querySelector('.youtube-url'),load=m.querySelector('.youtube-load'),error=m.querySelector('.youtube-error');
  m.querySelector('.youtube-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  const getId=value=>{
    const raw=(value||'').trim();if(!raw)return null;if(/^[A-Za-z0-9_-]{11}$/.test(raw))return raw;
    try{const u=new URL(raw);const host=u.hostname.replace(/^www\./,'').toLowerCase();if(host==='youtu.be')return u.pathname.split('/').filter(Boolean)[0]||null;if(host.endsWith('youtube.com')){const v=u.searchParams.get('v');if(v)return v;const parts=u.pathname.split('/').filter(Boolean);if(['embed','shorts','live'].includes(parts[0])&&parts[1])return parts[1]}}catch{}
    return null
  };
  const loadVideo=()=>{const id=getId(input.value);if(!id){error.textContent='Enter a valid YouTube link.';return}if(location.protocol==='file:'){error.textContent='YouTube embeds require localhost or HTTPS. Run the included site through a local server.';frame.hidden=true;m.classList.remove('has-video');return}error.textContent='';const origin=(location.protocol==='http:'||location.protocol==='https:')?`&origin=${encodeURIComponent(location.origin)}`:'';frame.src=`https://www.youtube.com/embed/${encodeURIComponent(id)}?rel=0${origin}`;frame.hidden=false;m.classList.add('has-video')};
  load.addEventListener('click',loadVideo);input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();loadVideo()}});
  const prior=m._cleanup;m._cleanup=()=>{prior?.();frame.src=''}
}

function fitEditableText(el,m,cssVar){
  const measure=document.createElement('div');measure.className='text-fit-measure';m.appendChild(measure);
  const fit=()=>{const aw=Math.max(30,el.clientWidth-12),ah=Math.max(26,el.clientHeight-12);measure.style.width=`${aw}px`;measure.style.fontFamily=getComputedStyle(el).fontFamily;measure.style.fontWeight=getComputedStyle(el).fontWeight;measure.style.lineHeight=getComputedStyle(el).lineHeight;measure.textContent=el.innerText||' ';let lo=10,hi=800,best=10;for(let i=0;i<18;i++){const mid=(lo+hi)/2;measure.style.fontSize=`${mid}px`;if(measure.scrollHeight<=ah&&measure.scrollWidth<=aw){best=mid;lo=mid}else hi=mid}m.style.setProperty(cssVar,`${Math.max(10,best*.97)}px`)};
  const ro=new ResizeObserver(()=>requestAnimationFrame(fit));ro.observe(m);ro.observe(el);el.addEventListener('input',fit);requestAnimationFrame(fit);return()=>{ro.disconnect();measure.remove()}
}
function setupBoombox(m){
  const tracks=[
    {title:'Relaxing Rain',src:'assets/soundscapes/relaxing-rain.mp3',vinyl:'#6d7f91',deep:'#354553',label:'#dce6ee',text:'#273641'},
    {title:'Thunderstorm',src:'assets/soundscapes/Thunderstorm.mp3',vinyl:'#52596b',deep:'#292e3b',label:'#c8cddd',text:'#282d3a'},
    {title:'Blizzard',src:'assets/soundscapes/Blizzard.mp3',vinyl:'#b9d9e9',deep:'#6f9db3',label:'#edf8fc',text:'#31566a'},
    {title:'Flowing Stream',src:'assets/soundscapes/Flowing Stream.mp3',vinyl:'#4b9da0',deep:'#28696d',label:'#d4eeee',text:'#205456'},
    {title:'Campfire',src:'assets/soundscapes/campfire.mp3',vinyl:'#c96d3b',deep:'#783a24',label:'#f4d4b9',text:'#67321f'},
    {title:'Crickets',src:'assets/soundscapes/crickets.mp3',vinyl:'#6f8755',deep:'#3f5630',label:'#dce7ce',text:'#334626'},
    {title:'Waterfall',src:'assets/soundscapes/Waterfall.mp3',vinyl:'#4b83b1',deep:'#285375',label:'#d5e8f5',text:'#24445b'},
    {title:'Ocean Waves',src:'assets/soundscapes/ocean-waves.mp3',vinyl:'#315f87',deep:'#173b5b',label:'#cfe2ef',text:'#203d53'}
  ];
  const audio=m.querySelector('.boombox-audio'),titles=[...m.querySelectorAll('.boombox-title')],plays=[...m.querySelectorAll('.boombox-play')],prevs=[...m.querySelectorAll('.boombox-prev')],nexts=[...m.querySelectorAll('.boombox-next')],skips=[...m.querySelectorAll('.boombox-skip')],volumes=[...m.querySelectorAll('.boombox-volume')],volumeValues=[...m.querySelectorAll('.boombox-volume-value')],progresses=[...m.querySelectorAll('.boombox-progress span')],currents=[...m.querySelectorAll('.boombox-current')],durations=[...m.querySelectorAll('.boombox-duration')],styleButton=m.querySelector('.boombox-style-button'),styleMenu=m.querySelector('.boombox-style-menu');let index=0;
  const fmt=n=>{if(!Number.isFinite(n))return'0:00';n=Math.max(0,Math.floor(n));return`${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`};
  const each=(arr,fn)=>arr.forEach(fn);
  const renderPlay=()=>{each(plays,b=>{b.textContent=audio.paused?(b.closest('.boombox-view--ipod')?'▶❚❚':'▶'):'❚❚';b.classList.toggle('is-playing',!audio.paused)});m.classList.toggle('is-playing',!audio.paused)};
  const fitVinylTitle=t=>{
    const label=t.closest('.vinyl-label');
    if(!label)return;
    const words=[...t.querySelectorAll('.vinyl-title-word')];
    if(!words.length)return;
    let size=13;
    const minSize=6.5;
    t.style.fontSize=`${size}px`;
    const fits=()=>words.every(w=>w.scrollWidth<=label.clientWidth*.76)&&t.scrollHeight<=label.clientHeight*.72;
    while(size>minSize&&!fits()){
      size-=.25;
      t.style.fontSize=`${size}px`;
    }
  };
  const syncTrack=()=>{
    const track=tracks[index];
    each(titles,t=>{
      if(t.closest('.vinyl-label')){
        t.replaceChildren(...track.title.split(/\s+/).map(word=>{
          const span=document.createElement('span');
          span.className='vinyl-title-word';
          span.textContent=word;
          return span;
        }));
        requestAnimationFrame(()=>fitVinylTitle(t));
      }else{
        t.textContent=track.title;
      }
    });
    m.style.setProperty('--vinyl-label',track.label);
    m.style.setProperty('--vinyl-label-text',track.text);
  };
  const syncProgress=()=>{const pct=audio.duration?clamp(audio.currentTime/audio.duration*100,0,100):0;each(progresses,p=>p.style.width=`${pct}%`);each(currents,c=>c.textContent=fmt(audio.currentTime));each(durations,d=>d.textContent=fmt(audio.duration))};
  const load=(i,autoplay=false)=>{index=(i+tracks.length)%tracks.length;syncTrack();audio.src=tracks[index].src;audio.load();each(progresses,p=>p.style.width='0%');each(currents,c=>c.textContent='0:00');if(autoplay)audio.play().catch(()=>{});renderPlay()};
  each(plays,b=>b.addEventListener('click',()=>{if(audio.paused)audio.play().catch(()=>{});else audio.pause()}));
  each(prevs,b=>b.addEventListener('click',()=>load(index-1,!audio.paused)));
  each(nexts,b=>b.addEventListener('click',()=>load(index+1,!audio.paused)));
  each(skips,b=>b.addEventListener('click',()=>{if(Number.isFinite(audio.duration))audio.currentTime=Math.min(audio.duration,audio.currentTime+15)}));
  const setVolume=v=>{v=clamp(Number(v),0,100);audio.volume=v/100;each(volumes,x=>{if(Number(x.value)!==v)x.value=v});each(volumeValues,x=>x.textContent=`${Math.round(v)}%`)};
  each(volumes,v=>v.addEventListener('input',()=>setVolume(v.value)));
  const setStyle=style=>{
    m.dataset.playerStyle=style;
    m.querySelectorAll('.boombox-view').forEach(v=>v.hidden=!v.classList.contains(`boombox-view--${style}`));
    styleMenu.hidden=true;
    if(style==='vinyl')requestAnimationFrame(()=>m.querySelectorAll('.vinyl-label .boombox-title').forEach(fitVinylTitle));
    const rect=m.getBoundingClientRect();
    if(style==='compact'){
      m.style.width='390px';
      m.style.height='190px';
    }else{
      const needs={
        music:{w:330,h:430},
        ipod:{w:300,h:390},
        vinyl:{w:320,h:440}
      }[style];
      if(needs){
        if(rect.width<needs.w)m.style.width=`${needs.w}px`;
        if(rect.height<needs.h)m.style.height=`${needs.h}px`;
      }
    }
  };
  styleButton.addEventListener('click',e=>{e.stopPropagation();styleMenu.hidden=!styleMenu.hidden});
  styleMenu.querySelectorAll('[data-player-style-option]').forEach(b=>b.addEventListener('click',()=>setStyle(b.dataset.playerStyleOption)));
  document.addEventListener('pointerdown',m._boomboxOutside=e=>{if(!m.contains(e.target))styleMenu.hidden=true});
  audio.addEventListener('play',renderPlay);audio.addEventListener('pause',renderPlay);audio.addEventListener('loadedmetadata',syncProgress);audio.addEventListener('timeupdate',syncProgress);
  const vinylResizeObserver=new ResizeObserver(()=>{if(m.dataset.playerStyle==='vinyl')m.querySelectorAll('.vinyl-label .boombox-title').forEach(fitVinylTitle)});
  vinylResizeObserver.observe(m);
  setVolume(55);setStyle('compact');load(0,false);
  const prior=m._cleanup;m._cleanup=()=>{prior?.();vinylResizeObserver.disconnect();document.removeEventListener('pointerdown',m._boomboxOutside);audio.pause();audio.removeAttribute('src');audio.load()}
}

function setupTextBubble(m){
  const text=m.querySelector('.textbubble-text');m.querySelector('.textbubble-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));m.querySelector('.textbubble-font').addEventListener('click',()=>{cycleData(m,'font',FONT_OPTIONS);requestAnimationFrame(()=>text.dispatchEvent(new Event('input')))});m.querySelector('.textbubble-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));const cleanup=fitEditableText(text,m,'--bubble-size');m._cleanup=cleanup
}

function setupTodo(m){
  const list=m.querySelector('.todo-list'),add=m.querySelector('.todo-add');
  m.querySelector('.todo-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));m.querySelector('.todo-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));m.querySelector('.todo-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));
  const addRow=(value='New step')=>{const row=document.createElement('div');row.className='todo-row';row.innerHTML='<input class="todo-check" type="checkbox" aria-label="Complete step"><input class="todo-item-text" type="text" aria-label="Checklist step"><button class="todo-remove" type="button" aria-label="Remove step">×</button>';const check=row.querySelector('.todo-check'),text=row.querySelector('.todo-item-text');text.value=value;check.addEventListener('change',()=>row.classList.toggle('is-done',check.checked));row.querySelector('.todo-remove').addEventListener('click',()=>row.remove());list.appendChild(row);requestAnimationFrame(()=>{text.focus();text.select()})};
  add.addEventListener('click',()=>addRow());addRow('First step');
}

workspace.addEventListener('dragover',e=>{const types=[...e.dataTransfer.types];if(types.includes('Files')||types.includes('text/uri-list')||types.includes('text/html')||types.includes('text/plain'))e.preventDefault()});
workspace.addEventListener('drop',e=>{if(e.target.closest('.image-module'))return;const src=getDraggedImageSource(e.dataTransfer);if(!src)return;e.preventDefault();const m=createModule('image',e.clientX,e.clientY);if(src.file)m?._setImage?.(src.file);else if(src.url)m?._setImageUrl?.(src.url)});

const saved=localStorage.getItem('modular-space-theme');if(saved==='dark')document.body.classList.add('dark');const updateTheme=()=>{const d=document.body.classList.contains('dark');themeToggle.textContent=d?'☀':'☾';themeToggle.title=d?'Switch to light mode':'Switch to dark mode'};themeToggle.addEventListener('click',()=>{document.body.classList.toggle('dark');localStorage.setItem('modular-space-theme',document.body.classList.contains('dark')?'dark':'light');updateTheme()});updateTheme();fullscreenToggle.addEventListener('click',async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen()}catch{}});document.addEventListener('fullscreenchange',()=>{fullscreenToggle.textContent=document.fullscreenElement?'↙':'⛶'});window.addEventListener('resize',()=>document.querySelectorAll('.module').forEach(m=>{m.style.left=`${clamp(m.offsetLeft,0,Math.max(0,innerWidth-m.offsetWidth))}px`;m.style.top=`${clamp(m.offsetTop,0,Math.max(0,innerHeight-m.offsetHeight))}px`}));



function setupSpinner(m){
  const canvas=m.querySelector('.spinner-canvas');
  const ctx=canvas.getContext('2d');
  const spinButton=m.querySelector('.spinner-spin-button');
  const winner=m.querySelector('.spinner-winner');
  const resultOverlay=m.querySelector('.spinner-result-overlay');
  const resultName=m.querySelector('.spinner-result-name');
  const confettiLayer=m.querySelector('.spinner-confetti-layer');
  const spinAudio=m.querySelector('.spinner-spin-audio');
  const input=m.querySelector('.spinner-name-input');
  const addButton=m.querySelector('.spinner-add-name');
  const list=m.querySelector('.spinner-name-list');
  const bgButton=m.querySelector('.spinner-bg');
  const fontButton=m.querySelector('.spinner-font');

  let names=['Alex','Jordan','Taylor','Morgan'];
  let rotation=0;
  let spinning=false;
  let raf=0;
  let winnerVisible=false;

  const palette=[
    '#f2b5a7','#f5d38b','#bedca8','#9fd8cf',
    '#a9c8ef','#c5b5ec','#efb5d0','#d7c6a5',
    '#f3c1a0','#b8d6e8','#c9dda5','#e5b7a7'
  ];

  const getWheelFont=()=>{
    const family=getComputedStyle(m).getPropertyValue('--module-font').trim();
    return family||'Inter,system-ui,sans-serif';
  };

  function renderNameList(){
    list.replaceChildren();
    names.forEach((name,i)=>{
      const chip=document.createElement('div');
      chip.className='spinner-name-chip';
      const text=document.createElement('span');
      text.textContent=name;
      const remove=document.createElement('button');
      remove.type='button';
      remove.setAttribute('aria-label',`Remove ${name}`);
      remove.textContent='×';
      remove.addEventListener('click',()=>{
        if(spinning)return;
        names.splice(i,1);
        renderNameList();
        drawWheel();
        winner.textContent=names.length?'CLICK TO SPIN':'ADD NAMES';
      });
      chip.append(text,remove);
      list.append(chip);
    });
  }

  function drawWheel(){
    const dpr=Math.max(1,window.devicePixelRatio||1);
    const size=560;
    if(canvas.width!==size*dpr||canvas.height!==size*dpr){
      canvas.width=size*dpr;
      canvas.height=size*dpr;
      canvas.style.aspectRatio='1';
    }
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,size,size);

    const cx=size/2,cy=size/2,r=258;
    ctx.save();
    ctx.translate(cx,cy);
    ctx.rotate(rotation);

    if(!names.length){
      ctx.beginPath();
      ctx.arc(0,0,r,0,Math.PI*2);
      ctx.fillStyle='#ececef';
      ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,.12)';
      ctx.lineWidth=3;
      ctx.stroke();
      ctx.restore();
      return;
    }

    const arc=Math.PI*2/names.length;
    const fontBase=Math.max(12,Math.min(25,165/names.length+10));
    const wheelFont=getWheelFont();

    names.forEach((name,i)=>{
      const start=-Math.PI/2+i*arc;
      const end=start+arc;

      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.arc(0,0,r,start,end);
      ctx.closePath();
      ctx.fillStyle=palette[i%palette.length];
      ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,.68)';
      ctx.lineWidth=2;
      ctx.stroke();

      ctx.save();
      ctx.rotate(start+arc/2);
      ctx.translate(r*.63,0);
      ctx.rotate(Math.PI/2);
      ctx.fillStyle='#22252a';
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      ctx.font=`800 ${fontBase}px ${wheelFont}`;

      let label=name;
      const maxWidth=Math.max(60,r*arc*.58);
      if(ctx.measureText(label).width>maxWidth){
        while(label.length>3&&ctx.measureText(label+'…').width>maxWidth)label=label.slice(0,-1);
        label+='…';
      }
      ctx.fillText(label,0,0);
      ctx.restore();
    });

    ctx.beginPath();
    ctx.arc(0,0,r,0,Math.PI*2);
    ctx.strokeStyle='rgba(0,0,0,.13)';
    ctx.lineWidth=4;
    ctx.stroke();
    ctx.restore();
  }

  function addName(){
    const value=input.value.trim();
    if(!value||spinning)return;
    names.push(value);
    input.value='';
    renderNameList();
    drawWheel();
    winner.textContent='CLICK TO SPIN';
    input.focus();
  }

  function fireSpinnerConfetti(){
    confettiLayer.replaceChildren();
    const colors=['#ff6b7a','#ffd34e','#69c6ff','#7edc8b','#9d7cff','#ff9c5a'];
    for(let i=0;i<66;i++){
      const p=document.createElement('i');
      p.className='spinner-confetti-piece';
      const a=Math.random()*Math.PI*2;
      const d=110+Math.random()*250;
      p.style.setProperty('--x',`${Math.cos(a)*d}px`);
      p.style.setProperty('--y',`${Math.sin(a)*d+65}px`);
      p.style.setProperty('--r',`${Math.round(Math.random()*900-450)}deg`);
      p.style.setProperty('--confetti',colors[i%colors.length]);
      p.style.width=`${5+Math.random()*6}px`;
      p.style.height=`${7+Math.random()*9}px`;
      p.style.animationDelay=`${Math.random()*.1}s`;
      confettiLayer.append(p);
    }
    setTimeout(()=>confettiLayer.replaceChildren(),1550);
  }

  function dismissWinner(){
    if(!winnerVisible)return;
    winnerVisible=false;
    resultOverlay.classList.remove('is-visible');
    resultOverlay.hidden=true;
    winner.textContent=names.length?'CLICK TO SPIN':'ADD NAMES';
  }

  function showWinner(name){
    winnerVisible=true;
    winner.textContent=name;
    resultName.textContent=name;
    resultOverlay.hidden=false;
    resultOverlay.classList.remove('is-visible');
    void resultOverlay.offsetWidth;
    resultOverlay.classList.add('is-visible');

    m.classList.remove('spinner-pop');
    void m.offsetWidth;
    m.classList.add('spinner-pop');

    fireSpinnerConfetti();
    playUiSfx('collection');
  }

  async function spin(){
    if(spinning||winnerVisible||names.length<1)return;

    spinning=true;
    m.classList.add('is-spinning');
    spinButton.disabled=true;
    winner.textContent='SPINNING…';

    resultOverlay.classList.remove('is-visible');
    resultOverlay.hidden=true;

    const arc=Math.PI*2/names.length;

    // Choose a target segment, but stop inside its safe center zone rather than on an edge.
    const targetIndex=Math.floor(Math.random()*names.length);
    const safety=arc*.18;
    const jitterRange=Math.max(0,arc/2-safety);
    const centerJitter=(Math.random()*2-1)*jitterRange*.55;

    // Segments are drawn starting at -PI/2 before wheel rotation.
    // The fixed pointer is at -PI/2, so solve the final rotation that places
    // the selected segment's interior point directly beneath the pointer.
    const targetLocalAngle=-Math.PI/2+(targetIndex+.5)*arc+centerJitter;
    const desiredRotation=-Math.PI/2-targetLocalAngle;

    const tau=Math.PI*2;
    const currentNorm=((rotation%tau)+tau)%tau;
    const desiredNorm=((desiredRotation%tau)+tau)%tau;

    let delta=desiredNorm-currentNorm;
    if(delta<0)delta+=tau;

    const turns=5+Math.floor(Math.random()*3);
    const total=turns*tau+delta;
    const startRotation=rotation;

    spinAudio.pause();
    spinAudio.currentTime=0;

    if(!Number.isFinite(spinAudio.duration)||spinAudio.duration<=0){
      await new Promise(resolve=>{
        const done=()=>resolve();
        spinAudio.addEventListener('loadedmetadata',done,{once:true});
        spinAudio.load();
      });
    }

    const duration=Math.max(600,(Number.isFinite(spinAudio.duration)?spinAudio.duration:3.683)*1000);
    const start=performance.now();
    const ease=t=>1-Math.pow(1-t,4);

    spinAudio.play().catch(()=>{});

    cancelAnimationFrame(raf);
    const tick=now=>{
      const t=Math.min(1,(now-start)/duration);
      rotation=startRotation+total*ease(t);
      drawWheel();

      if(t<1){
        raf=requestAnimationFrame(tick);
      }else{
        rotation=startRotation+total;
        drawWheel();

        spinning=false;
        m.classList.remove('is-spinning');
        spinButton.disabled=false;

        if(!spinAudio.paused){
          spinAudio.pause();
          spinAudio.currentTime=spinAudio.duration||0;
        }

        // Determine the actual winning segment from the wheel's final physical
        // position under the fixed pointer. This guarantees popup = landed tile.
        const finalNorm=((rotation%tau)+tau)%tau;
        const pointerLocal=(((-Math.PI/2-finalNorm)+tau)%tau);
        const segmentIndex=Math.floor(((pointerLocal+Math.PI/2+tau)%tau)/arc)%names.length;

        showWinner(names[segmentIndex]);
      }
    };

    raf=requestAnimationFrame(tick);
  }

  bgButton.addEventListener('click',()=>{
    cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']);
  });

  fontButton.addEventListener('click',()=>{
    cycleData(m,'font',FONT_OPTIONS);
    requestAnimationFrame(drawWheel);
  });

  addButton.addEventListener('click',addName);
  input.addEventListener('keydown',e=>{
    if(e.key==='Enter'){
      e.preventDefault();
      addName();
    }
  });

  spinButton.addEventListener('click',e=>{
    e.stopPropagation();
    spin();
  });

  canvas.addEventListener('click',e=>{
    e.stopPropagation();
    spin();
  });

  m.addEventListener('click',e=>{
    if(!winnerVisible)return;
    if(e.target.closest('.module-delete,.spinner-customization,.spinner-settings,.resize-handle'))return;
    dismissWinner();
  });

  const ro=new ResizeObserver(()=>drawWheel());
  ro.observe(m);

  renderNameList();
  drawWheel();

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    cancelAnimationFrame(raf);
    ro.disconnect();
    spinAudio.pause();
    spinAudio.currentTime=0;
  };
}


function setupChangelog(){
  const button=document.getElementById('changelog-toggle');
  const backdrop=document.getElementById('changelog-backdrop');
  const panel=document.getElementById('changelog-panel');
  const closeButton=document.getElementById('changelog-close');
  const content=document.getElementById('changelog-content');
  if(!button||!backdrop||!panel||!closeButton||!content)return;

  let loaded=false;

  const escapeHtml=value=>String(value)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");

  const inlineMarkdown=text=>{
    let safe=escapeHtml(text);
    safe=safe.replace(/`([^`]+)`/g,'<code>$1</code>');
    safe=safe.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
    safe=safe.replace(/\*([^*]+)\*/g,'<em>$1</em>');
    safe=safe.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return safe;
  };

  const renderMarkdown=markdown=>{
    const lines=markdown.replace(/\r\n?/g,'\n').split('\n');
    const out=[];
    let listOpen=false;

    const closeList=()=>{
      if(listOpen){
        out.push('</ul>');
        listOpen=false;
      }
    };

    for(const raw of lines){
      const line=raw.trimEnd();
      if(!line.trim()){
        closeList();
        continue;
      }

      const heading=line.match(/^(#{1,3})\s+(.+)$/);
      if(heading){
        closeList();
        const level=heading[1].length;
        out.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
        continue;
      }

      const bullet=line.match(/^\s*[-*]\s+(.+)$/);
      if(bullet){
        if(!listOpen){
          out.push('<ul>');
          listOpen=true;
        }
        out.push(`<li>${inlineMarkdown(bullet[1])}</li>`);
        continue;
      }

      closeList();
      out.push(`<p>${inlineMarkdown(line)}</p>`);
    }

    closeList();
    return out.join('');
  };

  async function loadChangelog(){
    content.innerHTML='<div class="changelog-loading">Loading changelog…</div>';

    try{
      let valid=[];

      if(Array.isArray(window.TeacherTilesChangelogData)&&window.TeacherTilesChangelogData.length){
        valid=window.TeacherTilesChangelogData
          .filter(entry=>entry&&entry.file&&typeof entry.text==='string')
          .slice()
          .sort((a,b)=>{
            const at=Date.parse(a.addedAt||0)||0;
            const bt=Date.parse(b.addedAt||0)||0;
            return bt-at;
          });
      }else{
        const response=await fetch(`changelog/index.json?ts=${Date.now()}`,{cache:'no-store'});
        if(!response.ok)throw new Error('Could not load changelog index.');

        const data=await response.json();
        const files=Array.isArray(data.files)?data.files:[];

        const entries=await Promise.all(files.map(async entry=>{
          const file=typeof entry==='string'?entry:entry.file;
          const addedAt=typeof entry==='object'&&entry?entry.addedAt:null;
          if(!file)return null;

          const res=await fetch(`changelog/${encodeURIComponent(file)}?ts=${Date.now()}`,{cache:'no-store'});
          if(!res.ok)return null;
          return {file,addedAt,text:await res.text()};
        }));

        valid=entries.filter(Boolean).sort((a,b)=>{
          const at=Date.parse(a.addedAt||0)||0;
          const bt=Date.parse(b.addedAt||0)||0;
          return bt-at;
        });
      }

      if(!valid.length){
        content.innerHTML='<div class="changelog-empty">No changelog entries yet.</div>';
        return;
      }

      content.replaceChildren();
      for(const entry of valid){
        const article=document.createElement('article');
        article.className='changelog-entry';
        article.innerHTML=renderMarkdown(entry.text);
        content.append(article);
      }

      loaded=true;
    }catch(err){
      content.innerHTML='<div class="changelog-error">The changelog could not be loaded.</div>';
      console.error(err);
    }
  }

  async function openChangelog(){
    backdrop.hidden=false;
    requestAnimationFrame(()=>backdrop.classList.add('is-open'));
    if(!loaded)await loadChangelog();
    closeButton.focus({preventScroll:true});
  }

  function closeChangelog(){
    backdrop.classList.remove('is-open');
    window.setTimeout(()=>{backdrop.hidden=true},190);
    button.focus({preventScroll:true});
  }

  button.addEventListener('click',openChangelog);
  closeButton.addEventListener('click',closeChangelog);
  backdrop.addEventListener('click',e=>{
    if(e.target===backdrop)closeChangelog();
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!backdrop.hidden)closeChangelog();
  });
}
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',setupChangelog,{once:true});
}else{
  setupChangelog();
}

(function setupTeacherTilesIntro() {
  const intro = document.getElementById('teachertiles-intro');
  if (!intro) return;

  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const holdTime = reduced ? 220 : 1260;

  if (!reduced) window.setTimeout(() => playUiSfx('intro'), 830);

  window.setTimeout(() => {
    intro.classList.add('is-leaving');
    window.setTimeout(() => intro.remove(), reduced ? 150 : 430);
  }, holdTime);
})();

