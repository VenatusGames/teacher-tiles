(()=>{'use strict';
const STICK_VARIANTS=[
  'tiles/popsicle-sticks/assets/stick-1.png',
  'tiles/popsicle-sticks/assets/stick-2.png',
  'tiles/popsicle-sticks/assets/stick-3.png'
];
const HANDWRITING_FONTS="'Caveat','Segoe Print','Bradley Hand','Comic Sans MS',cursive";
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
function cleanName(value){return String(value||'').replace(/\s+/g,' ').trim().slice(0,50)}
function rosterNames(value){
  const source=Array.isArray(value)?value:[];
  return [...new Set(source.map(item=>cleanName(typeof item==='string'?item:item?.name)).filter(Boolean))].slice(0,80);
}
function makeId(){return typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2,9)}`}
function hashText(value){let hash=2166136261;for(const char of String(value)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619)}return hash>>>0}
function defaultPose(name,index,id){
  const hash=hashText(`${id}:${name}:${index}`);
  return{
    offsetX:Math.round((((hash%1000)/999)-.5)*108),
    rotation:Number(((((hash>>>4)%1000)/999)-.5)*22).toFixed(2),
    depth:Number((((hash>>>9)%1000)/999).toFixed(3))
  };
}
function makeStick(name,index,prior={}){
  const id=String(prior.id||makeId());
  const pose=defaultPose(name,index,id);
  return{
    id,
    name:cleanName(prior.name||name)||`Student ${index+1}`,
    variant:Math.abs(Number(prior.variant??index))%STICK_VARIANTS.length,
    state:prior.state==='removed'?'removed':'cup',
    offsetX:Number.isFinite(Number(prior.offsetX))?Number(prior.offsetX):pose.offsetX,
    rotation:Number.isFinite(Number(prior.rotation))?Number(prior.rotation):pose.rotation,
    depth:Number.isFinite(Number(prior.depth))?Number(prior.depth):pose.depth
  };
}
function makeStickElement(stick,{drawn=false}={}){
  const el=document.createElement('div');
  el.className=`popsicle-stick${drawn?' popsicle-stick--drawn':''}`;
  el.style.setProperty('--stick-x',`${stick.offsetX}px`);
  el.style.setProperty('--stick-r',`${stick.rotation}deg`);
  el.style.setProperty('--stick-z',String(Math.round(stick.depth*30)));
  const image=document.createElement('img');
  image.className='popsicle-stick__art';
  image.src=STICK_VARIANTS[stick.variant%STICK_VARIANTS.length];
  image.alt='';image.draggable=false;
  const name=document.createElement('span');
  name.className='popsicle-stick__name';
  name.textContent=stick.name;
  name.style.fontFamily=HANDWRITING_FONTS;
  el.append(image,name);
  return el;
}
function setup(m){
  const importView=m.querySelector('.popsicle-sticks-import');
  const dashboard=m.querySelector('.popsicle-sticks-dashboard');
  const loaderAnchor=m.querySelector('.popsicle-sticks-loader-anchor');
  const classNameEl=m.querySelector('.popsicle-sticks-class-name');
  const changeClass=m.querySelector('.popsicle-sticks-change-class');
  const stack=m.querySelector('.popsicle-sticks-stack');
  const bundle=m.querySelector('.popsicle-sticks-bundle');
  const drawnHost=m.querySelector('.popsicle-sticks-drawn');
  const cup=m.querySelector('.popsicle-sticks-cup');
  const putBack=m.querySelector('.popsicle-sticks-put-back');
  const remove=m.querySelector('.popsicle-sticks-remove');
  const reset=m.querySelector('.popsicle-sticks-reset');
  const status=m.querySelector('.popsicle-sticks-status');
  let classId='';let className='';let sticks=[];let drawnId='';

  const getRoster=id=>typeof readClassRosters==='function'?readClassRosters().find(roster=>String(roster.id)===String(id))||null:null;
  const activeStick=()=>sticks.find(stick=>stick.id===drawnId)||null;
  const inCup=()=>sticks.filter(stick=>stick.state==='cup');
  const removed=()=>sticks.filter(stick=>stick.state==='removed'&&stick.id!==drawnId);
  const notify=reason=>{render();if(typeof notifyBoardChanged==='function')notifyBoardChanged(reason)};

  function showImport(show){
    importView.hidden=!show;dashboard.hidden=show;
  }
  function updateCopy(){
    const active=activeStick(),available=inCup().length,removedCount=removed().length;
    classNameEl.textContent=className||'Class';
    if(active)status.textContent=`${active.name} was drawn. Put it back for another chance, or remove it until reset.`;
    else if(available)status.textContent=`${available} ${available===1?'stick':'sticks'} left in the cup${removedCount?` · ${removedCount} removed`:''}. Click the cup to draw.`;
    else status.textContent=sticks.length?'The cup is empty. Reset All to put every stick back.':'This class has no students yet.';
    cup.disabled=Boolean(active)||available===0;
    putBack.hidden=!active;remove.hidden=!active;
    reset.disabled=!sticks.length||(!active&&removedCount===0&&available===sticks.length);
  }
  function renderCup(){
    stack.replaceChildren();
    const available=inCup().slice().sort((a,b)=>a.depth-b.depth);
    // Keep the cup readable with large rosters while still showing variety.
    const visible=available.slice(-Math.min(18,available.length));
    visible.forEach(stick=>stack.append(makeStickElement(stick)));
    drawnHost.replaceChildren();
    const active=activeStick();
    if(active){drawnHost.append(makeStickElement(active,{drawn:true}));drawnHost.hidden=false}
    else drawnHost.hidden=true;
    m.classList.toggle('has-drawn-stick',Boolean(active));
  }
  function render(){
    showImport(!classId&&!sticks.length);
    if(!dashboard.hidden){renderCup();updateCopy()}
  }
  function loadRoster(roster,{preserve=false,markChanged=true}={}){
    if(!roster)return;
    const names=rosterNames(roster.students);
    const previous=preserve?new Map(sticks.map(stick=>[stick.name,stick])):new Map();
    const oldDrawnName=activeStick()?.name||'';
    sticks=names.map((name,index)=>makeStick(name,index,previous.get(name)||{}));
    classId=String(roster.id||'');className=cleanName(roster.name)||'Class';
    const restoredDrawn=oldDrawnName?sticks.find(stick=>stick.name===oldDrawnName&&stick.state==='removed'):null;
    drawnId=restoredDrawn?.id||'';
    showImport(false);renderCup();updateCopy();
    if(markChanged&&typeof notifyBoardChanged==='function')notifyBoardChanged('popsicle-sticks-class');
  }
  function returnToClassPicker(){
    classId='';className='';sticks=[];drawnId='';showImport(true);
    if(typeof notifyBoardChanged==='function')notifyBoardChanged('popsicle-sticks-change-class');
  }
  function draw(){
    if(activeStick())return;
    const pool=inCup();if(!pool.length)return;
    const chosen=pool[Math.floor(Math.random()*pool.length)];
    chosen.state='removed';drawnId=chosen.id;notify('popsicle-sticks-draw');
  }
  function putDrawnBack(){
    const stick=activeStick();if(!stick)return;
    stick.state='cup';
    const pose=defaultPose(stick.name,sticks.indexOf(stick),`${stick.id}:${Date.now()}`);
    stick.offsetX=pose.offsetX;stick.rotation=pose.rotation;stick.depth=pose.depth;
    drawnId='';notify('popsicle-sticks-put-back');
  }
  function removeDrawn(){
    if(!activeStick())return;
    drawnId='';notify('popsicle-sticks-remove');
  }
  function resetAll(){
    sticks.forEach((stick,index)=>{
      stick.state='cup';const pose=defaultPose(stick.name,index,`${stick.id}:reset`);
      stick.offsetX=pose.offsetX;stick.rotation=pose.rotation;stick.depth=pose.depth;
    });
    drawnId='';notify('popsicle-sticks-reset');
  }
  function syncRoster(){
    if(!classId)return;
    const roster=getRoster(classId);if(!roster)return;
    loadRoster(roster,{preserve:true,markChanged:false});
  }

  const detach=typeof attachClassRosterLoader==='function'?attachClassRosterLoader(loaderAnchor,(_students,roster)=>loadRoster(roster)):()=>{};
  cup.addEventListener('click',draw);bundle?.addEventListener('click',draw);stack?.addEventListener('click',draw);putBack.addEventListener('click',putDrawnBack);remove.addEventListener('click',removeDrawn);reset.addEventListener('click',resetAll);changeClass.addEventListener('click',returnToClassPicker);
  window.addEventListener('teachertiles:classeschange',syncRoster);

  m._boardGetState=()=>({classId,className,drawnId,sticks:sticks.map(stick=>({...stick}))});
  m._boardSetState=state=>{
    classId=String(state?.classId||'');className=cleanName(state?.className)||'';
    sticks=(Array.isArray(state?.sticks)?state.sticks:[]).slice(0,80).map((stick,index)=>makeStick(stick?.name,index,stick||{}));
    drawnId=String(state?.drawnId||'');
    if(drawnId&&!sticks.some(stick=>stick.id===drawnId&&stick.state==='removed'))drawnId='';
    if(!sticks.length&&classId){const roster=getRoster(classId);if(roster){loadRoster(roster,{markChanged:false});return}}
    render();
  };
  const prior=m._cleanup;m._cleanup=()=>{detach();window.removeEventListener('teachertiles:classeschange',syncRoster);prior?.()};
  render();
}
window.TeacherTilesPopsicleSticks=Object.freeze({setup});
})();
