(()=>{'use strict';
const STICK_VARIANTS=[
  'tiles/popsicle-sticks/assets/stick-1.png',
  'tiles/popsicle-sticks/assets/stick-2.png',
  'tiles/popsicle-sticks/assets/stick-3.png'
];
const HANDWRITING_FONTS="'Patrick Hand','Comic Sans MS','Segoe Print','Bradley Hand',cursive";
function normalizeName(name){
  return String(name||'').replace(/\s+/g,' ').trim().slice(0,40);
}
function normalizeNames(list){
  const source=Array.isArray(list)?list:[];
  const names=source.map(item=>typeof item==='string'?item:(item&&typeof item.name==='string'?item.name:''))
    .map(normalizeName)
    .filter(Boolean);
  return [...new Set(names)].slice(0,80);
}
function makeId(prefix='stick'){
  return typeof crypto!=='undefined'&&crypto.randomUUID?`${prefix}-${crypto.randomUUID()}`:`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
}
function variantFor(index){return Math.abs(Number(index)||0)%STICK_VARIANTS.length}
function poseFor(index,id=''){
  const seed=String(id||index);
  let hash=0;
  for(let i=0;i<seed.length;i++)hash=(hash*31+seed.charCodeAt(i))>>>0;
  const drift=((hash%1000)/999)-0.5;
  const sway=((((hash>>>3)%1000)/999)-0.5)*18;
  return {
    offsetX:Math.round(drift*112),
    rotation:Number(sway.toFixed(2)),
    depth:Number((((hash>>>5)%1000)/999).toFixed(3))
  };
}
function makeStick(name,index,existing={}){
  const id=String(existing.id||makeId());
  const pose=poseFor(index,id);
  return {
    id,
    name:normalizeName(existing.name||name)||`Student ${index+1}`,
    variant:variantFor(existing.variant??index),
    state:existing.state==='removed'||existing.state==='drawn'?'removed':'cup',
    offsetX:Number.isFinite(existing.offsetX)?Number(existing.offsetX):pose.offsetX,
    rotation:Number.isFinite(existing.rotation)?Number(existing.rotation):pose.rotation,
    depth:Number.isFinite(existing.depth)?Number(existing.depth):pose.depth
  };
}
function buildStickMarkup(stick,{drawn=false}={}){
  const card=document.createElement('div');
  card.className=`popsicle-stick${drawn?' is-drawn':''}`;
  card.style.setProperty('--stick-offset',`${stick.offsetX||0}px`);
  card.style.setProperty('--stick-rotation',`${stick.rotation||0}deg`);
  card.style.setProperty('--stick-depth',String(stick.depth||0));
  const img=document.createElement('img');
  img.className='popsicle-stick-art';
  img.src=STICK_VARIANTS[variantFor(stick.variant)];
  img.alt='';
  const label=document.createElement('span');
  label.className='popsicle-stick-name';
  label.textContent=stick.name;
  label.style.fontFamily=HANDWRITING_FONTS;
  card.append(img,label);
  return card;
}
function setup(m){
  const loaderAnchor=m.querySelector('.popsicle-sticks-loader-anchor');
  const stage=m.querySelector('.popsicle-sticks-stage');
  const stack=m.querySelector('.popsicle-sticks-stack');
  const drawnWrap=m.querySelector('.popsicle-sticks-drawn');
  const cup=m.querySelector('.popsicle-sticks-cup');
  const putBack=m.querySelector('.popsicle-sticks-put-back');
  const removeBtn=m.querySelector('.popsicle-sticks-remove');
  const resetBtn=m.querySelector('.popsicle-sticks-reset');
  const status=m.querySelector('.widget-status');
  const summary=m.querySelector('.popsicle-sticks-summary');
  let detachRosterLoader=()=>{};
  let classId='';
  let className='';
  let sticks=[];
  let drawnId='';

  function currentRoster(){
    return typeof readClassRosters==='function'&&classId?readClassRosters().find(item=>item.id===classId)||null:null;
  }
  function stickById(id){return sticks.find(stick=>stick.id===id)||null}
  function drawnStick(){return stickById(drawnId)}
  function cupSticks(){return sticks.filter(stick=>stick.state==='cup')}
  function removedCount(){return sticks.filter(stick=>stick.state==='removed'&&stick.id!==drawnId).length}
  function availableCount(){return cupSticks().length}
  function totalCount(){return sticks.length}
  function noClassLoaded(){return !classId&&sticks.length===0}

  function updateStatus(){
    const drawn=drawnStick();
    if(noClassLoaded()){
      status.textContent='Load a class, then click the cup to draw a popsicle stick.';
      summary.textContent='No class loaded';
      return;
    }
    const inCup=availableCount();
    const removed=removedCount();
    summary.textContent=`${className||'Class'} · ${inCup} in cup`+(removed?` · ${removed} removed`:'');
    if(drawn){
      status.textContent=`${drawn.name} is drawn. Put the stick back for another chance, or remove it from the cup.`;
      return;
    }
    if(inCup>0){
      status.textContent='Click the cup to draw a random name.';
      return;
    }
    status.textContent=totalCount()?'No sticks are left in the cup. Reset to add them all back.':'This class has no students yet. Add students in your class roster.';
  }

  function render(){
    const active=drawnStick();
    const inCup=cupSticks().slice().sort((a,b)=>(a.depth-b.depth)||a.name.localeCompare(b.name));
    stack.replaceChildren();
    if(inCup.length){
      const visible=inCup.slice(-Math.min(14,inCup.length));
      visible.forEach(stick=>stack.append(buildStickMarkup(stick)));
    }else{
      const empty=document.createElement('div');
      empty.className='popsicle-sticks-empty';
      empty.textContent=noClassLoaded()?'Load a class to add names to the cup.':'The cup is empty';
      stack.append(empty);
    }
    drawnWrap.replaceChildren();
    if(active){
      drawnWrap.append(buildStickMarkup(active,{drawn:true}));
      drawnWrap.hidden=false;
    }else drawnWrap.hidden=true;
    m.classList.toggle('has-drawn-stick',Boolean(active));
    cup.disabled=noClassLoaded()||Boolean(active)||availableCount()===0;
    putBack.hidden=!active;
    removeBtn.hidden=!active;
    resetBtn.disabled=noClassLoaded()||sticks.every(stick=>stick.state==='cup');
    updateStatus();
  }

  function commit(reason){
    render();
    if(typeof notifyBoardChanged==='function')notifyBoardChanged(reason||'popsicle-sticks');
  }

  function reseedFromRoster(roster,{notify=true,preserveState=false}={}){
    const names=normalizeNames(roster?.students||[]);
    classId=String(roster?.id||'');
    className=String(roster?.name||'').trim()||'Class';
    drawnId='';
    if(preserveState&&sticks.length){
      const previousByName=new Map(sticks.map((stick,index)=>[stick.name,{...stick,variant:variantFor(stick.variant??index)}]));
      sticks=names.map((name,index)=>makeStick(name,index,previousByName.get(name)||{}));
    }else sticks=names.map((name,index)=>makeStick(name,index));
    if(notify)commit('popsicle-sticks-class');
    else render();
  }

  function restoreState(state){
    const savedSticks=Array.isArray(state?.sticks)?state.sticks:[];
    classId=String(state?.classId||'');
    className=String(state?.className||'').trim()||'';
    drawnId='';
    if(savedSticks.length){
      sticks=savedSticks.map((stick,index)=>makeStick(stick?.name,index,stick));
      const savedDrawnId=String(state?.drawnId||'');
      const active=sticks.find(stick=>stick.id===savedDrawnId&&stick.state!=='cup');
      drawnId=active?active.id:'';
      if(active)active.state='removed';
      render();
      return;
    }
    const roster=currentRoster();
    if(roster){reseedFromRoster(roster,{notify:false,preserveState:false});return}
    sticks=[];render();
  }

  function drawRandomStick(){
    if(drawnStick())return;
    const pool=cupSticks();
    if(!pool.length)return;
    const chosen=pool[Math.floor(Math.random()*pool.length)];
    chosen.state='removed';
    drawnId=chosen.id;
    commit('popsicle-sticks-draw');
  }
  function putDrawnBack(){
    const active=drawnStick();
    if(!active)return;
    active.state='cup';
    const pose=poseFor(sticks.indexOf(active),active.id);
    active.offsetX=pose.offsetX;
    active.rotation=pose.rotation;
    active.depth=pose.depth;
    drawnId='';
    commit('popsicle-sticks-put-back');
  }
  function removeDrawnStick(){
    const active=drawnStick();
    if(!active)return;
    drawnId='';
    commit('popsicle-sticks-remove');
  }
  function resetAll(){
    sticks.forEach((stick,index)=>{
      stick.state='cup';
      const pose=poseFor(index,stick.id);
      stick.offsetX=pose.offsetX;
      stick.rotation=pose.rotation;
      stick.depth=pose.depth;
    });
    drawnId='';
    commit('popsicle-sticks-reset');
  }

  cup.addEventListener('click',drawRandomStick);
  putBack.addEventListener('click',putDrawnBack);
  removeBtn.addEventListener('click',removeDrawnStick);
  resetBtn.addEventListener('click',resetAll);

  if(loaderAnchor&&typeof attachClassRosterLoader==='function'){
    detachRosterLoader=attachClassRosterLoader(loaderAnchor,(_students,roster)=>{
      reseedFromRoster(roster,{notify:true,preserveState:false});
    });
  }
  window.addEventListener('teachertiles:classeschange',onClassesChange);
  function onClassesChange(){
    if(!classId)return;
    const roster=currentRoster();
    if(!roster)return;
    className=String(roster.name||className||'Class').trim()||'Class';
    updateStatus();
  }

  m._boardGetState=()=>({
    classId,
    className,
    drawnId,
    sticks:sticks.map(stick=>({
      id:stick.id,
      name:stick.name,
      variant:stick.variant,
      state:stick.state,
      offsetX:stick.offsetX,
      rotation:stick.rotation,
      depth:stick.depth
    }))
  });
  m._boardSetState=restoreState;
  const cleanup=m._cleanup;
  m._cleanup=()=>{
    detachRosterLoader?.();
    window.removeEventListener('teachertiles:classeschange',onClassesChange);
    cleanup?.();
  };
  render();
}
window.TeacherTilesPopsicleSticks=Object.freeze({setup});
})();
