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

function createModule(type,x,y){const t=document.getElementById(`${type}-template`);if(!t)return null;const m=t.content.firstElementChild.cloneNode(true);workspace.appendChild(m);const w=m.offsetWidth,h=m.offsetHeight;m.style.left=`${clamp(x-w/2,0,innerWidth-w)}px`;m.style.top=`${clamp(y-18,0,innerHeight-h)}px`;bringToFront(m);setupCommon(m);if(type==='sticky')setupSticky(m);if(type==='timer')setupTimer(m);if(type==='interactive')setupHourglass(m);if(type==='clock')setupClock(m);if(type==='stopwatch')setupStopwatch(m);if(type==='draw')setupDraw(m);if(type==='noise')setupNoise(m);if(type==='collections')setupCollections(m);if(type==='stoplight')setupStoplight(m);if(type==='image')setupImage(m);if(type==='youtube')setupYoutube(m);if(type==='windowshare')setupWindowShare(m);if(type==='boombox')setupBoombox(m);
  if(type==='spinner')setupSpinner(m);if(type==='hangman')setupHangman(m);if(type==='textbubble')setupTextBubble(m);if(type==='todo')setupTodo(m);return m}

function updateWorkspaceEmptyState(){
  workspace.classList.toggle('has-modules',Boolean(workspace.querySelector('.module')));
}
const workspaceModuleObserver=new MutationObserver(updateWorkspaceEmptyState);
workspaceModuleObserver.observe(workspace,{childList:true});
updateWorkspaceEmptyState();

function bringToFront(m){m.style.zIndex=++z}
function setupCommon(m){m.addEventListener('pointerdown',e=>{if(e.shiftKey){e.preventDefault();e.stopPropagation();toggleSelection(m);bringToFront(m)}},true);m.addEventListener('pointerdown',e=>{bringToFront(m);const interactive=e.target.closest('button,input,select,textarea,[contenteditable],iframe');if(!e.shiftKey&&!interactive&&!selectedModules.has(m))clearSelection()});m.querySelector('.module-delete').addEventListener('click',()=>{selectedModules.delete(m);m._cleanup?.();m.remove()});setupDrag(m);if(m.dataset.type!=='draw')setupResize(m)}
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

function setupTimer(m){const clip=m.querySelector('.shape-clip'),clipPath=m.querySelector('.shape-clip path'),outline=m.querySelector('.shape-outline'),foreign=m.querySelector('.shape-foreign'),fill=m.querySelector('.shape-fill'),shapeButtons=[...m.querySelectorAll('.timer-shapes [data-shape]')];const clipId=`shape-clip-${++uid}`;clip.id=clipId;foreign.setAttribute('clip-path',`url(#${clipId})`);const setShape=shape=>{const d=shapePaths[shape]||shapePaths.circle;clipPath.setAttribute('d',d);outline.setAttribute('d',d)};shapeButtons.forEach(b=>b.addEventListener('click',()=>{shapeButtons.forEach(x=>x.classList.remove('is-active'));b.classList.add('is-active');setShape(b.dataset.shape)}));m.querySelector('.timer-font')?.addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.timer-text')?.addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));
  m.querySelector('.timer-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));m.querySelector('.timer-shape-color').addEventListener('click',()=>cycleData(m,'shapeColor',['blue','green','amber','rose','purple','teal']));setShape('circle');m._cleanup=bindTimerControls(m,({progress})=>fill.style.setProperty('--progress',`${progress*360}deg`),{onFinish:()=>launchConfetti(m)})}

function setupHourglass(m){const hourStage=m.querySelector('.hourglass-stage'),candleStage=m.querySelector('.candle-stage'),countdownHour=m.querySelector('.hourglass-countdown'),countdownCandle=m.querySelector('.candle-countdown'),topClip=m.querySelector('.hg-top-clip'),bottomClip=m.querySelector('.hg-bottom-clip'),top=m.querySelector('.hg-sand-top'),bottom=m.querySelector('.hg-sand-bottom'),pile=m.querySelector('.hg-bottom-pile'),stream=m.querySelector('.hg-stream'),candleBody=m.querySelector('.candle-body'),candleScene=m.querySelector('.candle-scene'),modeButtons=[...m.querySelectorAll('[data-interactive]')],bgBtn=m.querySelector('.interactive-bg'),candleColorBtn=m.querySelector('.candle-color-control');const topId=`hg-top-${++uid}`,bottomId=`hg-bottom-${++uid}`;topClip.id=topId;bottomClip.id=bottomId;top.setAttribute('clip-path',`url(#${topId})`);bottom.setAttribute('clip-path',`url(#${bottomId})`);pile.setAttribute('clip-path',`url(#${bottomId})`);let mode='hourglass';const setMode=next=>{mode=next;m.dataset.interactiveMode=mode;hourStage.hidden=mode!=='hourglass';candleStage.hidden=mode!=='candle';modeButtons.forEach(b=>b.classList.toggle('is-active',b.dataset.interactive===mode))};modeButtons.forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.interactive)));bgBtn.addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));candleColorBtn.addEventListener('click',()=>cycleData(m,'candleColor',['cream','blush','sage','sky','lavender','charcoal']));const cleanup=bindTimerControls(m,({progress,running,left})=>{const text=formatCountdown(left);countdownHour.textContent=text;countdownCandle.textContent=text;const topY=62+96*progress,topH=96*(1-progress);top.setAttribute('y',topY.toFixed(2));top.setAttribute('height',Math.max(0,topH).toFixed(2));const bottomH=96*progress,bottomY=278-bottomH;bottom.setAttribute('y',bottomY.toFixed(2));bottom.setAttribute('height',bottomH.toFixed(2));pile.setAttribute('opacity',progress>0.03?'1':'0');pile.setAttribute('transform',`translate(0 ${Math.max(0,30-progress*30).toFixed(2)}) scale(1 ${Math.max(.18,progress).toFixed(3)})`);stream.setAttribute('opacity',running&&left>0?'1':'0');const h=Math.max(8,100*(1-progress));candleScene.style.setProperty('--candle-height',`${h}%`);m.classList.toggle('candle-finished',mode==='candle'&&left<=0)}, {onFinish:()=>{if(mode==='candle')m.classList.add('candle-finished')}});setMode('hourglass');m._cleanup=cleanup}

function cycleData(m,key,values){const current=m.dataset[key]||values[0],i=values.indexOf(current);m.dataset[key]=values[(i+1)%values.length]}
function setupClock(m){
  const display=m.querySelector('.clock-display');
  const content=m.querySelector('.clock-content');
  const main=m.querySelector('.clock-main');
  const sec=m.querySelector('.clock-seconds');
  const period=m.querySelector('.clock-period');
  const secondsBtn=m.querySelector('.clock-toggle-seconds');
  const periodBtn=m.querySelector('.clock-toggle-period');
  const modeBtn=m.querySelector('.clock-toggle-mode');
  const hourHand=m.querySelector('.analog-hour');
  const minuteHand=m.querySelector('.analog-minute');
  const secondHand=m.querySelector('.analog-second');

  const fit=()=>{
    if(m.dataset.clockMode==='analog')return;
    const aw=Math.max(30,display.clientWidth-12),ah=Math.max(30,display.clientHeight-12);
    let lo=12,hi=1200,best=12;
    for(let n=0;n<18;n++){
      const mid=(lo+hi)/2;
      m.style.setProperty('--clock-size',`${mid}px`);
      const r=content.getBoundingClientRect();
      if(r.width<=aw&&r.height<=ah){best=mid;lo=mid}else hi=mid;
    }
    m.style.setProperty('--clock-size',`${Math.max(12,best*.975)}px`);
  };
  const refit=()=>requestAnimationFrame(fit);

  m.querySelector('.clock-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.clock-font').addEventListener('click',()=>{cycleData(m,'font',FONT_OPTIONS);refit()});
  m.querySelector('.clock-text').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  modeBtn.addEventListener('click',()=>{
    const analog=m.dataset.clockMode!=='analog';
    m.dataset.clockMode=analog?'analog':'digital';
    modeBtn.classList.toggle('is-active',analog);
    modeBtn.querySelector('span').textContent=analog?'◴':'◷';
    secondsBtn.hidden=analog;
    periodBtn.hidden=analog;
    refit();
  });

  secondsBtn.addEventListener('click',()=>{m.classList.toggle('show-seconds');secondsBtn.classList.toggle('is-active');refit()});
  periodBtn.addEventListener('click',()=>{m.classList.toggle('hide-period');periodBtn.classList.toggle('is-active',!m.classList.contains('hide-period'));refit()});

  const update=()=>{
    const d=new Date();
    const parts=new Intl.DateTimeFormat([],{hour:'numeric',minute:'2-digit',hour12:true}).formatToParts(d);
    const hour=parts.find(p=>p.type==='hour')?.value||'';
    const minute=parts.find(p=>p.type==='minute')?.value||'';
    const dayPeriod=parts.find(p=>p.type==='dayPeriod')?.value||'';
    main.textContent=`${hour}:${minute}`;
    sec.textContent=`:${String(d.getSeconds()).padStart(2,'0')}`;
    period.textContent=dayPeriod;

    const seconds=d.getSeconds()+d.getMilliseconds()/1000;
    const minutes=d.getMinutes()+seconds/60;
    const hours=(d.getHours()%12)+minutes/60;
    hourHand.style.transform=`translateX(-50%) rotate(${hours*30}deg)`;
    minuteHand.style.transform=`translateX(-50%) rotate(${minutes*6}deg)`;
    secondHand.style.transform=`translateX(-50%) rotate(${seconds*6}deg)`;
    refit();
  };

  const ro=new ResizeObserver(refit);
  ro.observe(m);
  ro.observe(display);
  const id=setInterval(update,100);
  update();
  m._cleanup=()=>{clearInterval(id);ro.disconnect()};
}


function setupStopwatch(m){
  const display=m.querySelector('.stopwatch-display');
  const start=m.querySelector('.stopwatch-start');
  const lap=m.querySelector('.stopwatch-lap');
  const clear=m.querySelector('.stopwatch-clear');
  const laps=m.querySelector('.stopwatch-laps');
  let running=false,startedAt=0,elapsed=0,raf=0,lapCount=0;

  const format=ms=>{
    const total=Math.max(0,ms);
    const minutes=Math.floor(total/60000);
    const seconds=Math.floor(total/1000)%60;
    const hundredths=Math.floor(total/10)%100;
    return `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}.${String(hundredths).padStart(2,'0')}`;
  };
  const current=()=>elapsed+(running?performance.now()-startedAt:0);
  const render=()=>{display.textContent=format(current());if(running)raf=requestAnimationFrame(render)};
  start.addEventListener('click',()=>{
    if(running){elapsed=current();running=false;cancelAnimationFrame(raf);start.textContent='Start'}
    else{startedAt=performance.now();running=true;start.textContent='Pause';render()}
  });
  lap.addEventListener('click',()=>{
    if(!running&&elapsed<=0)return;
    lapCount++;
    const row=document.createElement('div');
    row.className='stopwatch-lap-row';
    row.innerHTML=`<span>Lap ${lapCount}</span><strong>${format(current())}</strong>`;
    laps.prepend(row);
  });
  clear.addEventListener('click',()=>{
    running=false;cancelAnimationFrame(raf);startedAt=0;elapsed=0;lapCount=0;display.textContent='00:00.00';laps.replaceChildren();start.textContent='Start';
  });
  m.querySelector('.stopwatch-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.stopwatch-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.stopwatch-text').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));
  m._cleanup=()=>cancelAnimationFrame(raf);
}

function setupDraw(m){
  const toggle=m.querySelector('.draw-toggle');
  const toggleLabel=m.querySelector('.draw-toggle-label');
  const color=m.querySelector('.draw-color');
  const swatch=m.querySelector('.draw-color-swatch');
  const size=m.querySelector('.draw-size');
  const clear=m.querySelector('.draw-clear');
  const toolButtons=[...m.querySelectorAll('.draw-tool')];

  const canvas=document.createElement('canvas');
  canvas.className='board-drawing-canvas';
  canvas.width=Math.max(1,Math.round(innerWidth*(devicePixelRatio||1)));
  canvas.height=Math.max(1,Math.round(innerHeight*(devicePixelRatio||1)));
  canvas.style.width=`${innerWidth}px`;
  canvas.style.height=`${innerHeight}px`;
  workspace.appendChild(canvas);

  const ctx=canvas.getContext('2d');
  const dpr=devicePixelRatio||1;
  ctx.scale(dpr,dpr);
  ctx.lineCap='round';
  ctx.lineJoin='round';

  let enabled=false;
  let tool='brush';
  let drawing=false;
  let lastX=0,lastY=0,lastTime=0;

  const updatePointerMode=()=>{
    canvas.classList.toggle('is-active',enabled);
    canvas.style.pointerEvents=enabled?'auto':'none';
    toggle.classList.toggle('is-on',enabled);
    toggle.setAttribute('aria-pressed',String(enabled));
    toggleLabel.textContent=enabled?'ON':'OFF';
  };

  const updateSwatch=()=>{swatch.style.background=color.value};
  updateSwatch();

  toggle.addEventListener('click',()=>{enabled=!enabled;updatePointerMode()});
  color.addEventListener('input',updateSwatch);

  toolButtons.forEach(b=>b.addEventListener('click',()=>{
    tool=b.dataset.drawTool;
    toolButtons.forEach(x=>x.classList.toggle('is-active',x===b));
  }));

  clear.addEventListener('click',()=>{
    ctx.clearRect(0,0,canvas.width/dpr,canvas.height/dpr);
  });

  const point=e=>({x:e.clientX,y:e.clientY});

  const down=e=>{
    if(!enabled||e.button!==0)return;
    drawing=true;
    const p=point(e);
    lastX=p.x;
    lastY=p.y;
    lastTime=performance.now();
    canvas.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };

  const move=e=>{
    if(!drawing||!enabled)return;

    const p=point(e);
    const now=performance.now();
    const dx=p.x-lastX;
    const dy=p.y-lastY;
    const distance=Math.hypot(dx,dy);
    const dt=Math.max(1,now-lastTime);
    const speed=distance/dt;
    const baseSize=Number(size.value);

    ctx.save();

    if(tool==='eraser'){
      ctx.globalCompositeOperation='destination-out';
      ctx.globalAlpha=1;
      ctx.strokeStyle='#000';
      ctx.lineWidth=Math.max(4,baseSize*1.6);
      ctx.lineCap='round';
      ctx.lineJoin='round';
      ctx.beginPath();
      ctx.moveTo(lastX,lastY);
      ctx.lineTo(p.x,p.y);
      ctx.stroke();
    }else if(tool==='pencil'){
      ctx.globalCompositeOperation='source-over';
      ctx.globalAlpha=.88;
      ctx.strokeStyle=color.value;
      ctx.lineWidth=Math.max(1,baseSize*.28);
      ctx.lineCap='round';
      ctx.lineJoin='round';
      ctx.beginPath();
      ctx.moveTo(lastX,lastY);
      ctx.lineTo(p.x,p.y);
      ctx.stroke();
    }else{
      // Brush is softer and responds to movement speed:
      // slower strokes are fuller, faster strokes taper slightly.
      const speedFactor=clamp(1.15-speed*.18,.58,1.15);
      const brushWidth=Math.max(2,baseSize*speedFactor);

      ctx.globalCompositeOperation='source-over';
      ctx.globalAlpha=.72;
      ctx.strokeStyle=color.value;
      ctx.lineWidth=brushWidth;
      ctx.lineCap='round';
      ctx.lineJoin='round';
      ctx.shadowColor=color.value;
      ctx.shadowBlur=Math.max(0.5,brushWidth*.16);

      ctx.beginPath();
      ctx.moveTo(lastX,lastY);
      ctx.quadraticCurveTo(lastX,lastY,p.x,p.y);
      ctx.stroke();

      // A lighter secondary pass gives the brush a softer painted edge.
      ctx.globalAlpha=.18;
      ctx.lineWidth=brushWidth*1.35;
      ctx.shadowBlur=0;
      ctx.beginPath();
      ctx.moveTo(lastX,lastY);
      ctx.lineTo(p.x,p.y);
      ctx.stroke();
    }

    ctx.restore();

    lastX=p.x;
    lastY=p.y;
    lastTime=now;
    e.preventDefault();
  };

  const up=()=>{drawing=false};

  canvas.addEventListener('pointerdown',down);
  canvas.addEventListener('pointermove',move);
  canvas.addEventListener('pointerup',up);
  canvas.addEventListener('pointercancel',up);

  const resize=()=>{
    const old=document.createElement('canvas');
    old.width=canvas.width;
    old.height=canvas.height;
    old.getContext('2d').drawImage(canvas,0,0);

    const ndpr=devicePixelRatio||1;
    canvas.width=Math.max(1,Math.round(innerWidth*ndpr));
    canvas.height=Math.max(1,Math.round(innerHeight*ndpr));
    canvas.style.width=`${innerWidth}px`;
    canvas.style.height=`${innerHeight}px`;

    ctx.setTransform(ndpr,0,0,ndpr,0,0);
    ctx.drawImage(old,0,0,old.width,old.height,0,0,innerWidth,innerHeight);
    ctx.lineCap='round';
    ctx.lineJoin='round';
  };

  window.addEventListener('resize',resize);
  updatePointerMode();

  m._cleanup=()=>{
    window.removeEventListener('resize',resize);
    canvas.remove();
  };
}

function setupNoise(m){
  const button=m.querySelector('.noise-start');
  const db=m.querySelector('.noise-db');
  const status=m.querySelector('.noise-status');
  const statusDot=m.querySelector('.noise-status-dot');
  const range=m.querySelector('.noise-range');
  const sensitivity=m.querySelector('.noise-sensitivity');
  const thresholdValue=m.querySelector('.noise-threshold-value');
  const sensitivityValue=m.querySelector('.noise-sensitivity-value');
  const viewSelect=m.querySelector('.noise-view-select');
  const horizontalFill=m.querySelector('.noise-led-fill--horizontal');
  const verticalFill=m.querySelector('.noise-led-fill--vertical');
  const horizontalThreshold=m.querySelector('.noise-threshold--horizontal');
  const verticalThreshold=m.querySelector('.noise-vertical-alert-marker');
  const waveformThreshold=m.querySelector('.noise-waveform-threshold');
  const waveform=m.querySelector('.noise-waveform');
  const waveCtx=waveform.getContext('2d');
  const alert=m.querySelector('.noise-alert');

  // Start the Noise Detector at a comfortable finished size.
  if(!m.style.width)m.style.width='500px';
  if(!m.style.height)m.style.height='380px';

  m.querySelector('.noise-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.noise-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.noise-text').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  const meterBtn=m.querySelector('.noise-meter-color');
  meterBtn.addEventListener('click',()=>{
    cycleData(m,'meter',['blue','green','amber','rose','purple']);
    meterBtn.dataset.current=m.dataset.meter;
  });
  meterBtn.dataset.current=m.dataset.meter;

  let stream=null;
  let ctx=null;
  let analyser=null;
  let raf=0;
  let active=false;
  let smoothedLevel=0;
  let waveW=0;
  let waveH=0;
  const data=new Uint8Array(2048);

  const meterColor=()=>getComputedStyle(m).getPropertyValue('--meter-color').trim()||'#6f8fb7';
  const textColor=()=>getComputedStyle(m).getPropertyValue('--module-text').trim()||'#17191d';

  function resizeWaveform(){
    const rect=waveform.getBoundingClientRect();
    const dpr=Math.min(2,window.devicePixelRatio||1);
    waveW=Math.max(120,rect.width);
    waveH=Math.max(70,rect.height);
    waveform.width=Math.round(waveW*dpr);
    waveform.height=Math.round(waveH*dpr);
    waveCtx.setTransform(dpr,0,0,dpr,0,0);
  }

  const waveRO=new ResizeObserver(resizeWaveform);
  waveRO.observe(waveform);

  const moduleRO=new ResizeObserver(()=>{
    requestAnimationFrame(resizeWaveform);
  });
  moduleRO.observe(m);

  // Force the exact same layout calculation that a first drag used to trigger,
  // but do it immediately without changing the module's size or position.
  const stabilizeInitialLayout=()=>{
    void m.offsetWidth;
    resizeWaveform();
    requestAnimationFrame(()=>{
      void m.offsetHeight;
      resizeWaveform();
    });
  };

  resizeWaveform();
  requestAnimationFrame(stabilizeInitialLayout);

  const updateThreshold=()=>{
    const value=Number(range.value);
    thresholdValue.textContent=`${value}%`;

    horizontalThreshold.style.left=`${value}%`;

    // This marker lives outside the clipped fill track, so it stays visible.
    // 0% = bottom, 100% = top.
    verticalThreshold.style.bottom=`calc(${value}% - 2px)`;
    verticalThreshold.dataset.threshold=value;

    waveformThreshold.style.setProperty('--threshold',`${value}%`);
  };

  const updateSensitivity=()=>{
    sensitivityValue.textContent=`${sensitivity.value}%`;
  };

  const updateView=()=>{
    const mode=viewSelect.value;
    m.dataset.noiseView=mode;

    if(mode==='vertical'){
      m.style.width='320px';
      m.style.height='590px';
    }else{
      m.style.width='500px';
      m.style.height='380px';
    }

    if(mode==='waveform'){
      const frame=m.querySelector('.noise-waveform-frame');
      frame?.classList.remove('is-unfolding');
      void frame?.offsetWidth;
      frame?.classList.add('is-unfolding');
      setTimeout(()=>frame?.classList.remove('is-unfolding'),420);
    }

    requestAnimationFrame(()=>{
      void m.offsetWidth;
      void m.offsetHeight;
      resizeWaveform();

      if(mode==='vertical'){
        const settingsPanel=m.querySelector('.noise-settings-panel');
        const customization=m.querySelector('.noise-customization');

        // Force the vertical grid/flex state to resolve immediately instead of
        // waiting for the first manual resize.
        void m.getBoundingClientRect();
        void settingsPanel?.getBoundingClientRect();
        void customization?.getBoundingClientRect();

        requestAnimationFrame(()=>{
          void m.offsetWidth;
          void m.offsetHeight;
          void settingsPanel?.offsetHeight;
          void customization?.offsetHeight;
        });

        setTimeout(()=>{
          void m.getBoundingClientRect();
          void settingsPanel?.getBoundingClientRect();
          void customization?.getBoundingClientRect();
        },30);
      }
    });
  };

  range.addEventListener('input',updateThreshold);
  sensitivity.addEventListener('input',updateSensitivity);
  viewSelect.addEventListener('change',updateView);
  updateThreshold();
  updateSensitivity();
  updateView();

  function setLevelVisuals(level){
    horizontalFill.style.width=`${level}%`;
    verticalFill.style.height=`${level}%`;
  }

  function drawWaveform(){
    waveCtx.clearRect(0,0,waveW,waveH);

    const mid=waveH/2;
    waveCtx.lineWidth=1;
    waveCtx.strokeStyle='rgba(127,127,127,.18)';
    waveCtx.beginPath();
    waveCtx.moveTo(0,mid);
    waveCtx.lineTo(waveW,mid);
    waveCtx.stroke();

    if(!active||!analyser){
      waveCtx.strokeStyle='rgba(127,127,127,.22)';
      waveCtx.lineWidth=2;
      waveCtx.beginPath();
      waveCtx.moveTo(0,mid);
      waveCtx.lineTo(waveW,mid);
      waveCtx.stroke();
      return;
    }

    analyser.getByteTimeDomainData(data);
    waveCtx.strokeStyle=meterColor();
    waveCtx.lineWidth=Math.max(2,Math.min(4,waveH*.035));
    waveCtx.lineJoin='round';
    waveCtx.lineCap='round';
    waveCtx.beginPath();

    const step=waveW/(data.length-1);
    const sensitivityMultiplier=Number(sensitivity.value)/100;
    for(let i=0;i<data.length;i++){
      const centered=(data[i]-128)/128;
      const amp=clamp(centered*sensitivityMultiplier,-1,1);
      const x=i*step;
      const y=mid+amp*(waveH*.42);
      if(i===0)waveCtx.moveTo(x,y);
      else waveCtx.lineTo(x,y);
    }
    waveCtx.stroke();
  }

  function stop(){
    active=false;
    cancelAnimationFrame(raf);
    stream?.getTracks().forEach(t=>t.stop());
    if(ctx&&ctx.state!=='closed')ctx.close();
    stream=ctx=analyser=null;
    smoothedLevel=0;
    setLevelVisuals(0);
    drawWaveform();
    db.textContent='—';
    status.textContent='Microphone is off';
    statusDot.classList.remove('is-live');
    button.textContent='Enable microphone';
    m.classList.remove('is-loud');
    alert.hidden=true;
  }

  function loop(){
    if(!active||!analyser)return;

    analyser.getByteTimeDomainData(data);
    let sum=0;
    for(let i=0;i<data.length;i++){
      const n=(data[i]-128)/128;
      sum+=n*n;
    }

    const rms=Math.sqrt(sum/data.length);
    const rawLevel=clamp((20*Math.log10(rms||0.00001)+60)/60*100,0,100);
    const adjustedLevel=clamp(rawLevel*(Number(sensitivity.value)/100),0,100);
    smoothedLevel=smoothedLevel*.68+adjustedLevel*.32;

    setLevelVisuals(smoothedLevel);
    drawWaveform();
    db.textContent=`${Math.round(smoothedLevel)}%`;

    const loud=smoothedLevel>=Number(range.value);
    m.classList.toggle('is-loud',loud);
    alert.hidden=!loud;
    status.textContent=loud?'Above alert level':'Listening';
    statusDot.classList.toggle('is-loud',loud);

    raf=requestAnimationFrame(loop);
  }

  button.addEventListener('click',async()=>{
    if(active){
      stop();
      return;
    }

    try{
      stream=await navigator.mediaDevices.getUserMedia({audio:true});
      ctx=new (window.AudioContext||window.webkitAudioContext)();
      analyser=ctx.createAnalyser();
      analyser.fftSize=4096;
      analyser.smoothingTimeConstant=.72;
      ctx.createMediaStreamSource(stream).connect(analyser);

      active=true;
      button.textContent='Stop microphone';
      status.textContent='Listening';
      statusDot.classList.add('is-live');
      loop();
    }catch{
      status.textContent=location.protocol==='file:'?'Microphone needs localhost or HTTPS':'Microphone permission was denied';
      button.textContent='Try again';
    }
  });

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    waveRO.disconnect();
    moduleRO.disconnect();
    stop();
  };
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

function setupWindowShare(m){
  const video=m.querySelector('.windowshare-video');
  const empty=m.querySelector('.windowshare-empty');
  const startButton=m.querySelector('.windowshare-start');
  const changeButton=m.querySelector('.windowshare-change');
  const stopButton=m.querySelector('.windowshare-stop');
  const audioButton=m.querySelector('.windowshare-audio');
  const bgButton=m.querySelector('.windowshare-bg');
  const liveBadge=m.querySelector('.windowshare-live-badge');
  const message=m.querySelector('.windowshare-message');

  let stream=null;
  let messageTimer=0;

  function showMessage(text,hold=2600){
    clearTimeout(messageTimer);
    message.textContent=text;
    message.classList.add('is-visible');
    if(hold){
      messageTimer=setTimeout(()=>message.classList.remove('is-visible'),hold);
    }
  }

  function setAudioButton(){
    if(!stream){
      audioButton.textContent='🔊';
      audioButton.disabled=true;
      audioButton.title='No shared audio';
      return;
    }
    const tracks=stream.getAudioTracks();
    audioButton.disabled=!tracks.length;
    if(!tracks.length){
      audioButton.textContent='🔇';
      audioButton.title='This source is not sharing audio';
      return;
    }
    const enabled=tracks.some(t=>t.enabled);
    audioButton.textContent=enabled?'🔊':'🔇';
    audioButton.title=enabled?'Mute shared audio':'Unmute shared audio';
    audioButton.setAttribute('aria-label',audioButton.title);
  }

  function clearStreamTracks(){
    if(!stream)return;
    stream.getTracks().forEach(track=>{
      track.onended=null;
      try{track.stop()}catch{}
    });
    stream=null;
  }

  function resetShare({ended=false}={}){
    clearStreamTracks();
    video.pause();
    video.srcObject=null;
    m.classList.remove('is-sharing');
    liveBadge.hidden=true;
    setAudioButton();
    if(ended)showMessage('Sharing ended.',1800);
  }

  async function beginShare(){
    if(!navigator.mediaDevices?.getDisplayMedia){
      showMessage('Window sharing is not supported here. Open TeacherTiles through HTTPS or localhost.',4200);
      return;
    }

    if(!window.isSecureContext){
      showMessage('Window Share requires HTTPS or localhost.',4200);
      return;
    }

    try{
      const nextStream=await navigator.mediaDevices.getDisplayMedia({
        video:{
          frameRate:{ideal:30,max:60},
          cursor:'always'
        },
        audio:true,
        preferCurrentTab:false,
        selfBrowserSurface:'exclude',
        surfaceSwitching:'include',
        systemAudio:'include'
      });

      clearStreamTracks();
      stream=nextStream;

      const videoTrack=stream.getVideoTracks()[0];
      if(!videoTrack){
        resetShare();
        showMessage('No video source was selected.',2600);
        return;
      }

      videoTrack.onended=()=>resetShare({ended:true});
      stream.getAudioTracks().forEach(track=>{
        track.onended=()=>setAudioButton();
      });

      video.srcObject=stream;
      video.muted=false;
      try{await video.play()}catch{}

      m.classList.add('is-sharing');
      liveBadge.hidden=false;
      setAudioButton();

      const settings=videoTrack.getSettings?.()||{};
      const surface=settings.displaySurface;
      if(surface){
        const label=surface==='browser'?'Chrome tab':surface==='window'?'window':surface==='monitor'?'screen':surface;
        showMessage(`Sharing ${label}.`,1400);
      }
    }catch(err){
      if(err?.name==='NotAllowedError'||err?.name==='AbortError'){
        showMessage('Share cancelled.',1600);
      }else{
        console.error('Window Share error:',err);
        showMessage('Could not start sharing. Try selecting the source again.',3200);
      }
    }
  }

  startButton.addEventListener('click',beginShare);
  changeButton.addEventListener('click',beginShare);
  stopButton.addEventListener('click',()=>resetShare());

  audioButton.addEventListener('click',()=>{
    if(!stream)return;
    const tracks=stream.getAudioTracks();
    if(!tracks.length)return;
    const shouldEnable=!tracks.some(t=>t.enabled);
    tracks.forEach(t=>t.enabled=shouldEnable);
    setAudioButton();
  });

  bgButton.addEventListener('click',()=>{
    cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']);
  });

  setAudioButton();

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    clearTimeout(messageTimer);
    clearStreamTracks();
    video.pause();
    video.srcObject=null;
  };
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




function setupHangman(m){
  const status=m.querySelector('.hangman-status');
  const wordEl=m.querySelector('.hangman-word');
  const wrongEl=m.querySelector('.hangman-wrong-letters');
  const keyboard=m.querySelector('.hangman-keyboard');
  const setup=m.querySelector('.hangman-setup');
  const input=m.querySelector('.hangman-word-input');
  const saveButton=m.querySelector('.hangman-save-word');
  const result=m.querySelector('.hangman-result');
  const resultLabel=m.querySelector('.hangman-result-label');
  const resultMessage=m.querySelector('.hangman-result-message');
  const bgButton=m.querySelector('.hangman-bg');
  const fontButton=m.querySelector('.hangman-font');
  const parts=[...m.querySelectorAll('.hangman-part')];

  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  let secret='';
  let guessed=new Set();
  let wrong=[];
  let finished=false;
  const maxWrong=6;

  function normalizeWord(value){
    return value.toUpperCase().replace(/[^A-Z ]+/g,'').replace(/\s+/g,' ').trim();
  }

  function clearRound(){
    secret='';
    guessed=new Set();
    wrong=[];
    finished=false;
    m.classList.remove('is-finished');
    result.hidden=true;
    resultLabel.textContent='';
    resultMessage.textContent='';
    status.textContent='READY';
    wrongEl.textContent='—';

    parts.forEach(part=>part.classList.remove('is-visible'));

    wordEl.replaceChildren();
    const placeholder=document.createElement('div');
    placeholder.style.opacity='.35';
    placeholder.style.fontWeight='800';
    placeholder.style.fontSize='13px';
    placeholder.textContent='New round';
    wordEl.append(placeholder);

    keyboard.querySelectorAll('.hangman-key').forEach(b=>{
      b.disabled=true;
      b.classList.remove('is-correct','is-wrong');
    });
  }

  function openSetup(){
    clearRound();
    input.value='';
    setup.hidden=false;
    requestAnimationFrame(()=>input.focus());
  }

  function closeSetup(){
    setup.hidden=true;
  }

  function buildKeyboard(){
    keyboard.replaceChildren();
    alphabet.forEach(letter=>{
      const b=document.createElement('button');
      b.className='hangman-key';
      b.type='button';
      b.textContent=letter;
      b.dataset.letter=letter;
      b.disabled=true;
      b.addEventListener('click',()=>guess(letter));
      keyboard.append(b);
    });
  }

  function renderFigure(){
    parts.forEach((part,i)=>part.classList.toggle('is-visible',i<wrong.length));
  }

  function renderWord(){
    wordEl.replaceChildren();

    if(!secret)return;

    [...secret].forEach(char=>{
      const slot=document.createElement('span');
      slot.className='hangman-letter-slot';

      if(char===' '){
        slot.classList.add('is-space');
      }else{
        slot.textContent=guessed.has(char)||finished?char:'';
      }

      wordEl.append(slot);
    });
  }

  function renderKeyboard(){
    keyboard.querySelectorAll('.hangman-key').forEach(b=>{
      const letter=b.dataset.letter;
      const used=guessed.has(letter);

      b.disabled=!secret||finished||used;
      b.classList.toggle('is-correct',used&&secret.includes(letter));
      b.classList.toggle('is-wrong',used&&!secret.includes(letter));
    });
  }

  function render(){
    renderWord();
    renderFigure();
    renderKeyboard();
    wrongEl.textContent=wrong.length?wrong.join(' '):'—';

    if(secret&&!finished){
      const tries=maxWrong-wrong.length;
      status.textContent=`${tries} ${tries===1?'TRY':'TRIES'} LEFT`;
    }
  }

  function checkWin(){
    const letters=[...new Set(secret.replace(/ /g,''))];
    return letters.every(letter=>guessed.has(letter));
  }

  function finish(won){
    finished=true;
    m.classList.add('is-finished');
    renderWord();
    renderKeyboard();

    if(won){
      status.textContent='YOU WON!';
      resultLabel.textContent='YOU WON!';
      resultMessage.textContent=`The word was ${secret}!`;
      launchConfetti(m);
    }else{
      status.textContent='TRY AGAIN!';
      resultLabel.textContent='TRY AGAIN!';
      resultMessage.textContent=`The word was ${secret}!`;
    }

    result.hidden=false;
  }

  function guess(letter){
    if(!secret||finished||guessed.has(letter))return;

    guessed.add(letter);

    if(!secret.includes(letter)){
      wrong.push(letter);
    }

    if(checkWin()){
      finish(true);
      return;
    }

    if(wrong.length>=maxWrong){
      finish(false);
      return;
    }

    render();
  }

  function startGame(){
    const next=normalizeWord(input.value);

    if(!next){
      input.focus();
      return;
    }

    secret=next;
    guessed=new Set();
    wrong=[];
    finished=false;
    m.classList.remove('is-finished');
    closeSetup();
    render();
  }

  saveButton.addEventListener('click',startGame);

  input.addEventListener('keydown',e=>{
    if(e.key==='Enter'){
      e.preventDefault();
      startGame();
    }
  });

  result.addEventListener('click',e=>{
    e.stopPropagation();
    if(result.hidden)return;
    openSetup();
  });

  bgButton.addEventListener('click',()=>{
    cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']);
  });

  fontButton.addEventListener('click',()=>{
    cycleData(m,'font',FONT_OPTIONS);
  });

  buildKeyboard();
  openSetup();
}

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
  const changelogContent=document.getElementById('changelog-content');
  const newsContent=document.getElementById('news-content');
  const tabs=[...document.querySelectorAll('[data-updates-tab]')];
  const panes=[...document.querySelectorAll('[data-updates-pane]')];
  const contactForm=document.getElementById('contact-form');
  const contactStatus=document.getElementById('contact-status');
  const contactSubmit=document.getElementById('contact-submit');

  if(!button||!backdrop||!panel||!closeButton||!changelogContent||!newsContent)return;

  const loaded={changelog:false,news:false};
  let activeTab='changelog';

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

  async function loadFeed(kind){
    const isNews=kind==='news';
    const content=isNews?newsContent:changelogContent;
    const folder=isNews?'news':'changelog';
    const globalData=isNews?window.TeacherTilesNewsData:window.TeacherTilesChangelogData;
    const label=isNews?'news':'changelog';

    content.innerHTML=`<div class="changelog-loading">Loading ${label}…</div>`;

    try{
      let valid=[];

      if(Array.isArray(globalData)&&globalData.length){
        valid=globalData
          .filter(entry=>entry&&entry.file&&typeof entry.text==='string')
          .slice();
      }else{
        const response=await fetch(`${folder}/index.json?ts=${Date.now()}`,{cache:'no-store'});
        if(!response.ok)throw new Error(`Could not load ${label} index.`);

        const data=await response.json();
        const files=Array.isArray(data.files)?data.files:[];

        const entries=await Promise.all(files.map(async entry=>{
          const file=typeof entry==='string'?entry:entry.file;
          const addedAt=typeof entry==='object'&&entry?entry.addedAt:null;
          if(!file)return null;

          const res=await fetch(`${folder}/${encodeURIComponent(file)}?ts=${Date.now()}`,{cache:'no-store'});
          if(!res.ok)return null;
          return {file,addedAt,text:await res.text()};
        }));

        valid=entries.filter(Boolean);
      }

      if(!valid.length){
        content.innerHTML=`<div class="changelog-empty">No ${label} entries yet.</div>`;
        loaded[kind]=true;
        return;
      }

      content.replaceChildren();
      for(const entry of valid){
        const article=document.createElement('article');
        article.className='changelog-entry';
        article.innerHTML=renderMarkdown(entry.text);
        content.append(article);
      }

      loaded[kind]=true;
    }catch(err){
      content.innerHTML=`<div class="changelog-error">The ${label} feed could not be loaded.</div>`;
      console.error(err);
    }
  }

  async function selectTab(name){
    activeTab=name;

    for(const tab of tabs){
      const active=tab.dataset.updatesTab===name;
      tab.classList.toggle('is-active',active);
      tab.setAttribute('aria-selected',String(active));
    }

    for(const pane of panes){
      const active=pane.dataset.updatesPane===name;
      pane.hidden=!active;
      pane.classList.toggle('is-active',active);
    }

    if((name==='changelog'||name==='news')&&!loaded[name]){
      await loadFeed(name);
    }
  }

  async function openChangelog(){
    backdrop.hidden=false;
    requestAnimationFrame(()=>backdrop.classList.add('is-open'));
    await selectTab(activeTab);
    closeButton.focus({preventScroll:true});
  }

  function closeChangelog(){
    backdrop.classList.remove('is-open');
    window.setTimeout(()=>{backdrop.hidden=true},190);
    button.focus({preventScroll:true});
  }

  tabs.forEach(tab=>{
    tab.addEventListener('click',()=>selectTab(tab.dataset.updatesTab));
  });

  if(contactForm&&contactSubmit&&contactStatus){
    contactForm.addEventListener('submit',async e=>{
      e.preventDefault();

      if(!contactForm.reportValidity())return;

      const formData=new FormData(contactForm);
      const name=String(formData.get('name')||'').trim();
      const email=String(formData.get('email')||'').trim();
      const subject=String(formData.get('subject')||'').trim();
      const message=String(formData.get('message')||'').trim();

      contactSubmit.disabled=true;
      contactSubmit.textContent='Sending…';
      contactStatus.className='contact-status';
      contactStatus.textContent='Sending your message…';

      try{
        const payload=new FormData();
        payload.append('name',name);
        payload.append('email',email);
        payload.append('subject',subject);
        payload.append('message',message);
        payload.append('_subject',`TeacherTiles Contact: ${subject}`);
        payload.append('_template','table');
        payload.append('_captcha','false');

        const response=await fetch('https://formsubmit.co/ajax/jacksweikert@gmail.com',{
          method:'POST',
          headers:{Accept:'application/json'},
          body:payload
        });

        const result=await response.json().catch(()=>null);
        if(!response.ok||result?.success===false){
          throw new Error(result?.message||'Message could not be sent.');
        }

        contactForm.reset();
        contactStatus.className='contact-status is-success';
        contactStatus.textContent='Message sent. Thank you!';
      }catch(err){
        console.error(err);
        contactStatus.className='contact-status is-error';
        contactStatus.textContent='Could not send automatically. Please try again in a moment.';
      }finally{
        contactSubmit.disabled=false;
        contactSubmit.textContent='Send Message';
      }
    });
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

