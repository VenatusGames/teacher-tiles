const workspace=document.getElementById('workspace');
const menu=document.getElementById('context-menu');
const settingsToggle=document.getElementById('settings-toggle');
const fullscreenToggle=document.getElementById('fullscreen-toggle');
const trashZone=document.getElementById('trash-zone');
const STICKER_Z_BASE=100000;
let tileZ=10,stickerZ=10,spawn={x:innerWidth/2,y:innerHeight/2},uid=0;
const selectedModules=new Set();
function clearSelection(){for(const el of selectedModules)el.classList.remove('is-selected');selectedModules.clear()}
function selectModule(m){if(!m||!m.isConnected)return;selectedModules.add(m);m.classList.add('is-selected')}
function toggleSelection(m){if(selectedModules.has(m)){selectedModules.delete(m);m.classList.remove('is-selected')}else selectModule(m)}
function selectModules(modules,{add=false}={}){if(!add)clearSelection();for(const m of modules)selectModule(m)}

let boardChangeSuspended=0;
let boardChangeTimer=0;
function notifyBoardChanged(reason='change'){
  if(boardChangeSuspended)return;
  clearTimeout(boardChangeTimer);
  boardChangeTimer=setTimeout(()=>{
    window.dispatchEvent(new CustomEvent('teachertiles:boardchange',{detail:{reason}}));
  },90);
}
function withBoardChangesSuspended(fn){
  boardChangeSuspended++;
  try{return fn()}finally{boardChangeSuspended=Math.max(0,boardChangeSuspended-1)}
}

const undoStack=[];
const redoStack=[];
const HISTORY_LIMIT=80;
let applyingHistory=false;

function isTypingTarget(target){
  if(!(target instanceof Element))return false;
  return Boolean(target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])'));
}

function disableModuleSpellcheck(root){
  if(!(root instanceof Element))return;
  if(root.classList.contains('module'))root.setAttribute('spellcheck','false');
  const fields=[];
  if(root.matches('input,textarea,[contenteditable]'))fields.push(root);
  fields.push(...root.querySelectorAll('input,textarea,[contenteditable]'));
  for(const field of fields){
    field.spellcheck=false;
    field.setAttribute('spellcheck','false');
  }
}

function captureModuleTransform(m){
  return{
    left:m.offsetLeft,
    top:m.offsetTop,
    width:m.offsetWidth,
    height:m.offsetHeight,
    rotation:m.dataset.stickerRotation??null,
    snapGroup:m.dataset.snapGroup??null
  };
}

function applyModuleTransform(m,state){
  if(!m||!state)return;
  const priorSnapGroup=m.dataset.snapGroup||'';
  Object.assign(m.style,{left:`${state.left}px`,top:`${state.top}px`,width:`${state.width}px`,height:`${state.height}px`});
  if(state.rotation!==null){
    m.dataset.stickerRotation=String(state.rotation);
    m.style.setProperty('--sticker-rotation',`${state.rotation}deg`);
    const readout=m.querySelector('.sticker-rotation-readout');
    if(readout)readout.textContent=`${Math.round(((Number(state.rotation)%360)+360)%360)}°`;
  }
  if(state.snapGroup!==undefined){
    if(state.snapGroup)m.dataset.snapGroup=String(state.snapGroup);
    else delete m.dataset.snapGroup;
    if(priorSnapGroup)refreshSnapGroupState(priorSnapGroup);
    if(state.snapGroup)refreshSnapGroupState(String(state.snapGroup));
    else m.classList.remove('is-snap-grouped');
  }
  if(m.dataset.type==='sticker')updateStickerVisualSize(m);
}

function transformsDiffer(a,b){
  if(!a||!b)return true;
  return Math.abs(a.left-b.left)>.1||Math.abs(a.top-b.top)>.1||Math.abs(a.width-b.width)>.1||Math.abs(a.height-b.height)>.1||String(a.rotation)!==String(b.rotation)||String(a.snapGroup)!==String(b.snapGroup);
}

function historyElements(action){
  if(action.type==='transform')return action.entries.map(entry=>entry.el);
  if(action.type==='delete')return action.entries.map(entry=>entry.el);
  if(action.type==='drawing')return action.el?[action.el]:[];
  return action.elements||[];
}

function finalizeHistoryAction(action){
  if(!action)return;
  if(action.type==='drawing')return;
  for(const el of historyElements(action))if(el&&!el.isConnected)el._cleanup?.();
}

function recordHistory(action){
  if(applyingHistory||!action)return;
  undoStack.push(action);
  while(undoStack.length>HISTORY_LIMIT)finalizeHistoryAction(undoStack.shift());
  while(redoStack.length)finalizeHistoryAction(redoStack.pop());
  notifyBoardChanged(action.type||'history');
}

function recordTransformHistory(modules,before){
  if(applyingHistory)return;
  const entries=[];
  for(const el of modules){
    if(!el||!el.isConnected)continue;
    const prior=before.get(el);
    const after=captureModuleTransform(el);
    if(prior&&transformsDiffer(prior,after))entries.push({el,before:prior,after});
  }
  if(entries.length)recordHistory({type:'transform',entries});
}

function detachHistoryElements(elements){
  const snapGroups=new Set(elements.map(el=>el?.dataset.snapGroup).filter(Boolean));
  for(const el of elements){
    selectedModules.delete(el);
    el.classList.remove('is-selected','is-over-trash','is-dragging');
    el._deactivate?.();
    if(el.isConnected)el.remove();
  }
  for(const id of snapGroups)refreshSnapGroupState(id);
}

function restoreDeletedEntries(entries){
  const snapGroups=new Set();
  for(const entry of [...entries].reverse()){
    const {el,nextSibling}=entry;
    if(el.dataset.snapGroup)snapGroups.add(el.dataset.snapGroup);
    if(el.isConnected)continue;
    if(nextSibling?.parentNode===workspace)workspace.insertBefore(el,nextSibling);
    else workspace.appendChild(el);
    el._reactivate?.();
  }
  for(const id of snapGroups)refreshSnapGroupState(id);
}

function applyHistoryAction(action,direction){
  applyingHistory=true;
  try{
    if(action.type==='add'){
      if(direction==='undo')detachHistoryElements(action.elements);
      else for(const el of action.elements)if(!el.isConnected){workspace.appendChild(el);el._reactivate?.()}
    }else if(action.type==='delete'){
      if(direction==='undo')restoreDeletedEntries(action.entries);
      else detachHistoryElements(action.entries.map(entry=>entry.el));
    }else if(action.type==='transform'){
      for(const entry of action.entries)applyModuleTransform(entry.el,direction==='undo'?entry.before:entry.after);
    }else if(action.type==='drawing'){
      action.el?._setDrawHistoryCursor?.(direction==='undo'?action.before:action.after);
    }
    const active=historyElements(action).filter(el=>el.isConnected);
    if(active.length)selectModules(active);
    else clearSelection();
    updateWorkspaceEmptyState();
  }finally{applyingHistory=false}
}

function undoBoardAction(){
  const action=undoStack.pop();
  if(!action)return;
  applyHistoryAction(action,'undo');
  redoStack.push(action);
  notifyBoardChanged('undo');
}

function redoBoardAction(){
  const action=redoStack.pop();
  if(!action)return;
  applyHistoryAction(action,'redo');
  undoStack.push(action);
  notifyBoardChanged('redo');
}

function deleteModules(modules,{record=true}={}){
  const unique=[...new Set(modules)].filter(el=>el?.isConnected&&el.classList.contains('module'));
  if(!unique.length)return;
  const entries=unique.map(el=>({el,nextSibling:el.nextSibling}));
  if(record)recordHistory({type:'delete',entries});
  detachHistoryElements(unique);
  updateWorkspaceEmptyState();
}
const FONT_OPTIONS=['inter','poppins','nunito','quicksand','oswald','lora','merriweather','playfair','caveat','phantom'];

const UI_SFX_KEY='teachertiles-ui-sfx-muted';
const APP_PREFERENCES_KEY='teachertiles-app-preferences-v1';
const DEFAULT_APP_PREFERENCES=Object.freeze({
  uiMuted:false,
  uiVolume:100,
  scrollSpeed:100,
  defaultViewSize:100,
  language:'en'
});

const CLASS_ROSTERS_KEY='teachertiles-class-rosters-v1';
const classRostersStorageKey=()=>`${CLASS_ROSTERS_KEY}:${window.TeacherTilesClassScope||'local'}`;
const STAR_CHART_LAST_CLASS_KEY='teachertiles-star-chart-last-class-v1';
const starChartLastClassStorageKey=()=>`${STAR_CHART_LAST_CLASS_KEY}:${window.TeacherTilesClassScope||'local'}`;
const CLASS_METER_LAST_CLASS_KEY='teachertiles-class-meter-last-class-v1';
const classMeterLastClassStorageKey=()=>`${CLASS_METER_LAST_CLASS_KEY}:${window.TeacherTilesClassScope||'local'}`;
const COLLECTIONS_LAST_CLASS_KEY='teachertiles-collections-last-class-v1';
const collectionsLastClassStorageKey=()=>`${COLLECTIONS_LAST_CLASS_KEY}:${window.TeacherTilesClassScope||'local'}`;
const COLLECTION_ITEM_TYPES=new Set(['pompom','candy','star','jellybean','fruit','coin']);
const CLASS_LOGO_OPTIONS=Object.freeze([
  Object.freeze({symbol:'👥',label:'Class team'}),Object.freeze({symbol:'🌟',label:'Shining star'}),
  Object.freeze({symbol:'🚀',label:'Rocket'}),Object.freeze({symbol:'🦉',label:'Owl'}),
  Object.freeze({symbol:'🐯',label:'Tiger'}),Object.freeze({symbol:'🌈',label:'Rainbow'}),
  Object.freeze({symbol:'⚡',label:'Lightning'}),Object.freeze({symbol:'🏆',label:'Trophy'}),
  Object.freeze({symbol:'🧠',label:'Brain'}),Object.freeze({symbol:'🎨',label:'Art palette'}),
  Object.freeze({symbol:'🌱',label:'Growing plant'}),Object.freeze({symbol:'🐝',label:'Bee'})
]);

function normalizeClassLogo(value){
  const logo=String(value||'').trim();
  return logo?Array.from(logo).slice(0,8).join(''):'👥';
}

function normalizeRosterNames(values){
  const names=[];
  const seen=new Set();
  for(const raw of Array.isArray(values)?values:[]){
    const name=String(raw||'').trim().replace(/\s+/g,' ');
    const key=name.toLocaleLowerCase();
    if(!name||seen.has(key))continue;
    seen.add(key);
    names.push(name.slice(0,60));
  }
  return names.slice(0,300);
}

function starChartStudentKey(name){
  return`student:${String(name||'').trim().toLocaleLowerCase()}`;
}

function normalizeStarChartCount(value){
  return Math.max(0,Math.min(9999,Math.round(Number(value)||0)));
}

function normalizeStarChartProgress(value,students=[]){
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const sourceStudents=source.studentStars&&typeof source.studentStars==='object'&&!Array.isArray(source.studentStars)?source.studentStars:{};
  const studentStars={};
  normalizeRosterNames(students).forEach(name=>{
    const key=starChartStudentKey(name);
    studentStars[key]=normalizeStarChartCount(sourceStudents[key]??sourceStudents[name]);
  });
  return{
    mode:source.mode==='whole'?'whole':'student',
    wholeClassStars:normalizeStarChartCount(source.wholeClassStars),
    studentStars
  };
}

function normalizeClassMeterProgress(value){
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  return{
    fill:Math.max(0,Math.min(100,Number(source.fill)||0)),
    wins:normalizeStarChartCount(source.wins)
  };
}

function normalizeCollectionProgress(value){
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const fillLineRaw=Number(source.fillLine);
  return{
    item:COLLECTION_ITEM_TYPES.has(source.item)?source.item:'pompom',
    count:Math.max(0,Math.min(80,Math.round(Number(source.count)||0))),
    filled:Boolean(source.filled),
    jarsFilled:normalizeStarChartCount(source.jarsFilled),
    fillLine:Number.isFinite(fillLineRaw)?Math.max(.24,Math.min(.72,fillLineRaw)):.32
  };
}

function normalizePunchcardProgress(value,students=[]){
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const sourceStudentPoints=source.studentPoints&&typeof source.studentPoints==='object'&&!Array.isArray(source.studentPoints)?source.studentPoints:{};
  const sourceStudentProgress=source.studentProgress&&typeof source.studentProgress==='object'&&!Array.isArray(source.studentProgress)?source.studentProgress:{};
  const studentPoints={},studentProgress={};
  normalizeRosterNames(students).forEach(name=>{
    const key=starChartStudentKey(name);
    studentPoints[key]=normalizeStarChartCount(sourceStudentPoints[key]??sourceStudentPoints[name]);
    studentProgress[key]=Math.max(0,Math.min(9,Math.round(Number(sourceStudentProgress[key]??sourceStudentProgress[name])||0)));
  });
  return{
    wholeClassPoints:normalizeStarChartCount(source.wholeClassPoints),
    wholeClassProgress:Math.max(0,Math.min(9,Math.round(Number(source.wholeClassProgress)||0))),
    studentPoints,
    studentProgress
  };
}

function normalizeRacerProgress(value,students=[]){
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const sourcePositions=source.positions&&typeof source.positions==='object'&&!Array.isArray(source.positions)?source.positions:{};
  const sourceWins=source.studentWins&&typeof source.studentWins==='object'&&!Array.isArray(source.studentWins)?source.studentWins:{};
  const sourceFinished=source.finished&&typeof source.finished==='object'&&!Array.isArray(source.finished)?source.finished:{};
  const positions={},studentWins={},finished={};
  normalizeRosterNames(students).forEach(name=>{
    const key=starChartStudentKey(name);
    positions[key]=Math.max(0,Math.min(100,Number(sourcePositions[key]??sourcePositions[name])||0));
    studentWins[key]=normalizeStarChartCount(sourceWins[key]??sourceWins[name]);
    finished[key]=Boolean(sourceFinished[key]??sourceFinished[name])||positions[key]>=100;
    if(finished[key])positions[key]=100;
  });
  return{positions,studentWins,finished};
}


function readClassRosters(){
  try{
    const value=JSON.parse(localStorage.getItem(classRostersStorageKey())||'[]');
    if(!Array.isArray(value))return [];
    return value.filter(Boolean).map((item,index)=>{
      const students=normalizeRosterNames(item.students);
      return{
        id:String(item.id||`class-${index+1}`),
        name:String(item.name||`Class ${index+1}`).trim().slice(0,50)||`Class ${index+1}`,
        logo:normalizeClassLogo(item.logo),
        students,
        starChart:normalizeStarChartProgress(item.starChart,students),
        classMeter:normalizeClassMeterProgress(item.classMeter),
        collectionJar:normalizeCollectionProgress(item.collectionJar),
        punchcards:normalizePunchcardProgress(item.punchcards,students),
        racer:normalizeRacerProgress(item.racer,students)
      };
    });
  }catch{return []}
}

const PBIS_CLOUD_SAVE_INTERVAL=10*60*1000;
let pbisCloudSaveTimer=0;
let pbisCloudSaveScope='';
let encryptedClassSaveQueue=Promise.resolve();
const lastEncryptedClassSaveSignatureByScope=new Map();
const pendingEncryptedClassSaveSignatureByScope=new Map();

const pbisDirtyStorageKey=(scope=window.TeacherTilesClassScope||'local')=>`teachertiles-pbis-dirty:${scope}`;
function markPbisLocalDirty(classes){
  const signature=JSON.stringify(Array.isArray(classes)?classes:[]);
  localStorage.setItem(pbisDirtyStorageKey(),signature);
  return signature;
}
function clearPbisLocalDirty(signature,scope=window.TeacherTilesClassScope||'local'){
  const key=pbisDirtyStorageKey(scope);
  if(localStorage.getItem(key)===signature)localStorage.removeItem(key);
}

function queueEncryptedClassSave(classes,description='classes'){
  const snapshot=structuredClone(Array.isArray(classes)?classes:[]);
  const scope=window.TeacherTilesClassScope||'local';
  const signature=JSON.stringify(snapshot);
  if(lastEncryptedClassSaveSignatureByScope.get(scope)===signature||pendingEncryptedClassSaveSignatureByScope.get(scope)===signature)return encryptedClassSaveQueue;
  pendingEncryptedClassSaveSignatureByScope.set(scope,signature);
  encryptedClassSaveQueue=encryptedClassSaveQueue.catch(()=>{}).then(()=>{
    if((window.TeacherTilesClassScope||'local')!==scope)return;
    const save=window.TeacherTilesEncryptedClasses?.save;
    if(typeof save!=='function')return;
    return save(snapshot).then(()=>{
      lastEncryptedClassSaveSignatureByScope.set(scope,signature);
      clearPbisLocalDirty(signature,scope);
    });
  }).catch(error=>console.error(`TeacherTiles could not save encrypted ${description}`,error)).finally(()=>{
    if(pendingEncryptedClassSaveSignatureByScope.get(scope)===signature)pendingEncryptedClassSaveSignatureByScope.delete(scope);
  });
  return encryptedClassSaveQueue;
}

function cancelPendingPbisCloudSave(){
  clearTimeout(pbisCloudSaveTimer);
  pbisCloudSaveTimer=0;
  pbisCloudSaveScope='';
}

function flushPbisCloudSave(){
  if(!pbisCloudSaveTimer&&!pbisCloudSaveScope)return;
  clearTimeout(pbisCloudSaveTimer);
  pbisCloudSaveTimer=0;
  const scope=pbisCloudSaveScope;
  pbisCloudSaveScope='';
  if(!scope||(window.TeacherTilesClassScope||'local')!==scope)return;
  const latest=readClassRosters();
  queueEncryptedClassSave(latest,'PBIS stats');
}

function schedulePbisCloudSave(){
  const scope=window.TeacherTilesClassScope||'local';
  if(pbisCloudSaveScope&&pbisCloudSaveScope!==scope)cancelPendingPbisCloudSave();
  pbisCloudSaveScope=scope;
  if(!pbisCloudSaveTimer)pbisCloudSaveTimer=setTimeout(flushPbisCloudSave,PBIS_CLOUD_SAVE_INTERVAL);
}

function writeClassRosters(classes){
  cancelPendingPbisCloudSave();
  markPbisLocalDirty(classes);
  localStorage.setItem(classRostersStorageKey(),JSON.stringify(classes));
  window.dispatchEvent(new CustomEvent('teachertiles:classeschange',{detail:{classes}}));
  queueEncryptedClassSave(classes);
}

function writeClassStarChart(classId,value){
  const classes=readClassRosters();
  const roster=classes.find(item=>item.id===classId);
  if(!roster)return null;
  roster.starChart=normalizeStarChartProgress(value,roster.students);
  markPbisLocalDirty(classes);
  localStorage.setItem(classRostersStorageKey(),JSON.stringify(classes));
  window.dispatchEvent(new CustomEvent('teachertiles:starchartchange',{detail:{classId,progress:roster.starChart}}));
  schedulePbisCloudSave();
  return roster.starChart;
}

function writeClassMeter(classId,value){
  const classes=readClassRosters();
  const roster=classes.find(item=>item.id===classId);
  if(!roster)return null;
  roster.classMeter=normalizeClassMeterProgress(value);
  markPbisLocalDirty(classes);
  localStorage.setItem(classRostersStorageKey(),JSON.stringify(classes));
  window.dispatchEvent(new CustomEvent('teachertiles:classmeterchange',{detail:{classId,progress:roster.classMeter}}));
  schedulePbisCloudSave();
  return roster.classMeter;
}

function writeClassCollection(classId,value){
  const classes=readClassRosters();
  const roster=classes.find(item=>item.id===classId);
  if(!roster)return null;
  roster.collectionJar=normalizeCollectionProgress(value);
  markPbisLocalDirty(classes);
  localStorage.setItem(classRostersStorageKey(),JSON.stringify(classes));
  window.dispatchEvent(new CustomEvent('teachertiles:collectionchange',{detail:{classId,progress:roster.collectionJar}}));
  schedulePbisCloudSave();
  return roster.collectionJar;
}

function writeClassPunchcards(classId,value){
  const classes=readClassRosters();
  const roster=classes.find(item=>item.id===classId);
  if(!roster)return null;
  roster.punchcards=normalizePunchcardProgress(value,roster.students);
  markPbisLocalDirty(classes);
  localStorage.setItem(classRostersStorageKey(),JSON.stringify(classes));
  window.dispatchEvent(new CustomEvent('teachertiles:punchcardchange',{detail:{classId,progress:roster.punchcards}}));
  schedulePbisCloudSave();
  return roster.punchcards;
}


function writeClassRacer(classId,value){
  const classes=readClassRosters();
  const roster=classes.find(item=>item.id===classId);
  if(!roster)return null;
  roster.racer=normalizeRacerProgress(value,roster.students);
  markPbisLocalDirty(classes);
  localStorage.setItem(classRostersStorageKey(),JSON.stringify(classes));
  window.dispatchEvent(new CustomEvent('teachertiles:racerchange',{detail:{classId,progress:roster.racer}}));
  schedulePbisCloudSave();
  return roster.racer;
}

window.addEventListener('pagehide',flushPbisCloudSave);

window.addEventListener('teachertiles:encryptedclassesloaded',event=>{
  const classes=Array.isArray(event.detail?.classes)?event.detail.classes:[];
  const scope=window.TeacherTilesClassScope||'local';
  const cloudSignature=JSON.stringify(classes);
  lastEncryptedClassSaveSignatureByScope.set(scope,cloudSignature);
  const localDirtySignature=localStorage.getItem(pbisDirtyStorageKey(scope));
  const localSnapshot=localStorage.getItem(classRostersStorageKey());
  if(localDirtySignature===cloudSignature)clearPbisLocalDirty(localDirtySignature,scope);
  else if(localDirtySignature&&localSnapshot!==null){
    const localClasses=readClassRosters();
    window.dispatchEvent(new CustomEvent('teachertiles:classeschange',{detail:{classes:localClasses,source:'local-dirty'}}));
    queueEncryptedClassSave(localClasses,'pending PBIS stats');
    return;
  }
  localStorage.setItem(classRostersStorageKey(),JSON.stringify(classes));
  window.dispatchEvent(new CustomEvent('teachertiles:classeschange',{detail:{classes,source:'encrypted-cloud'}}));
});

function classRosterId(){
  return typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():`class-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
}

function attachClassRosterLoader(anchor,onLoad){
  if(!anchor||typeof onLoad!=='function')return()=>{};
  const row=document.createElement('div');
  row.className='tile-class-loader';
  const select=document.createElement('select');
  select.setAttribute('aria-label','Choose a saved class roster');
  const load=document.createElement('button');
  load.type='button';
  load.textContent='Load Class';
  const refresh=()=>{
    const current=select.value;
    const classes=readClassRosters();
    select.replaceChildren(new Option(classes.length?'Choose a class…':'No saved classes',''));
    classes.forEach(item=>select.add(new Option(`${item.name} (${item.students.length})`,item.id)));
    if(classes.some(item=>item.id===current))select.value=current;
    load.disabled=!select.value;
  };
  load.addEventListener('click',()=>{
    const roster=readClassRosters().find(item=>item.id===select.value);
    if(roster)onLoad([...roster.students],roster);
  });
  select.addEventListener('change',()=>load.disabled=!select.value);
  row.append(select,load);
  anchor.before(row);
  refresh();
  window.addEventListener('teachertiles:classeschange',refresh);
  return()=>window.removeEventListener('teachertiles:classeschange',refresh);
}

const NAME_UI_MODULE_SELECTOR='.groupmaker-module,.lunchcount-module,.voting-module,.spinner-module';
document.addEventListener('pointerover',event=>{
  if(!(event.target instanceof Element))return;
  event.target.closest(NAME_UI_MODULE_SELECTOR)?.classList.remove('name-ui-force-hidden');
});
document.addEventListener('pointerout',event=>{
  if(!(event.target instanceof Element))return;
  const module=event.target.closest(NAME_UI_MODULE_SELECTOR);
  if(module&&!(event.relatedTarget instanceof Node&&module.contains(event.relatedTarget))){
    module.classList.add('name-ui-force-hidden');
  }
});

function fitNameModuleToRoster(module,count,{namesPerRow=5,rowHeight=31,threshold=10}={}){
  if(!module)return;
  if(!module.dataset.rosterBaseHeight)module.dataset.rosterBaseHeight=String(Math.max(module.offsetHeight,Number.parseFloat(getComputedStyle(module).height)||0));
  const base=Number(module.dataset.rosterBaseHeight)||module.offsetHeight;
  const extraRows=Math.max(0,Math.ceil((Math.max(0,count)-threshold)/namesPerRow));
  const desired=Math.min(Math.max(base,base+extraRows*rowHeight),Math.max(base,BOARD_HEIGHT-module.offsetTop));
  module.style.height=`${desired}px`;
}

function bindStudentPointerDrag(chip,name,module,onDrop){
  let pointerId=null;
  let startX=0,startY=0;
  let active=false;
  let ghost=null;

  const cleanup=()=>{
    ghost?.remove();ghost=null;active=false;pointerId=null;
    chip.classList.remove('is-dragging');
    module.classList.remove('is-dragging-student');
    module.querySelectorAll('.is-drop-target').forEach(node=>node.classList.remove('is-drop-target'));
  };

  chip.draggable=false;
  chip.addEventListener('pointerdown',event=>{
    if(event.button!==0||event.target.closest('button'))return;
    pointerId=event.pointerId;startX=event.clientX;startY=event.clientY;
    chip.setPointerCapture(pointerId);
  });
  chip.addEventListener('pointermove',event=>{
    if(event.pointerId!==pointerId)return;
    if(!active&&Math.hypot(event.clientX-startX,event.clientY-startY)<5)return;
    if(!active){
      active=true;chip.classList.add('is-dragging');module.classList.add('is-dragging-student');
      ghost=document.createElement('div');ghost.className='student-drag-ghost';ghost.textContent=name;document.body.appendChild(ghost);
    }
    ghost.style.left=`${event.clientX}px`;ghost.style.top=`${event.clientY}px`;
    ghost.hidden=true;
    const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-student-drop-target]');
    ghost.hidden=false;
    module.querySelectorAll('.is-drop-target').forEach(node=>node.classList.remove('is-drop-target'));
    if(target&&module.contains(target))target.classList.add('is-drop-target');
  });
  const finish=event=>{
    if(event.pointerId!==pointerId)return;
    try{chip.releasePointerCapture(pointerId)}catch{}
    if(active){
      ghost.hidden=true;
      const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-student-drop-target]');
      if(target&&module.contains(target))onDrop(target.dataset.studentDropTarget||'');
    }
    cleanup();
  };
  chip.addEventListener('pointerup',finish);
  chip.addEventListener('pointercancel',cleanup);
}

function setupProfileClasses(){
  const openButton=document.getElementById('profile-classes-button');
  const panel=document.getElementById('profile-classes-panel');
  const closeButton=document.getElementById('profile-classes-close');
  const backButton=document.getElementById('profile-classes-back');
  const form=document.getElementById('profile-class-create');
  const nameInput=document.getElementById('profile-class-name');
  const list=document.getElementById('profile-class-list');
  const listView=document.getElementById('profile-classes-list-view');
  const rosterView=document.getElementById('profile-roster-view');
  const rosterBack=document.getElementById('profile-roster-back');
  const rosterDone=document.getElementById('profile-roster-done');
  const rosterDelete=document.getElementById('profile-roster-delete');
  const rosterName=document.getElementById('profile-roster-name');
  const studentForm=document.getElementById('profile-student-add');
  const studentInput=document.getElementById('profile-student-name');
  const studentChips=document.getElementById('profile-roster-students');
  const rosterCount=document.getElementById('profile-roster-count');
  const logoOptions=document.getElementById('profile-roster-logo-options');
  const customLogoInput=document.getElementById('profile-roster-custom-logo');
  if(!openButton||!panel||!form||!nameInput||!list||!listView||!rosterView)return;
  document.body.appendChild(panel);
  let editingId='';
  let draftName='';
  let draftLogo='👥';
  let draftStudents=[];
  let originalSignature='';

  const draftSignature=()=>JSON.stringify({name:draftName.trim(),logo:normalizeClassLogo(draftLogo),students:normalizeRosterNames(draftStudents)});

  const syncLogoPicker=({syncCustom=true}={})=>{
    const logo=normalizeClassLogo(draftLogo);
    logoOptions?.querySelectorAll('[data-class-logo]').forEach(button=>{
      const selected=button.dataset.classLogo===logo;
      button.classList.toggle('is-selected',selected);
      button.setAttribute('aria-pressed',String(selected));
    });
    if(syncCustom&&customLogoInput)customLogoInput.value=CLASS_LOGO_OPTIONS.some(option=>option.symbol===logo)?'':logo;
  };

  CLASS_LOGO_OPTIONS.forEach(option=>{
    if(!logoOptions)return;
    const button=document.createElement('button');
    button.type='button';button.className='roster-logo-option';button.dataset.classLogo=option.symbol;
    button.textContent=option.symbol;button.title=option.label;button.setAttribute('aria-label',`Use ${option.label} as the class logo`);button.setAttribute('aria-pressed','false');
    button.addEventListener('click',()=>{draftLogo=option.symbol;syncLogoPicker()});
    logoOptions.append(button);
  });

  const renderDraft=()=>{
    studentChips.replaceChildren();
    const names=normalizeRosterNames(draftStudents);
    draftStudents=names;
    rosterCount.textContent=`${names.length} ${names.length===1?'student':'students'}`;
    if(!names.length){
      const empty=document.createElement('p');empty.className='roster-students-empty';empty.textContent='No students yet. Add a first name or nickname above.';studentChips.append(empty);return;
    }
    names.forEach((name,index)=>{
      const chip=document.createElement('div');chip.className='roster-student-chip';
      const label=document.createElement('span');label.textContent=name;
      const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label',`Remove ${name}`);
      remove.addEventListener('click',()=>{draftStudents.splice(index,1);renderDraft()});
      chip.append(label,remove);studentChips.append(chip);
    });
  };

  const saveDraftIfChanged=()=>{
    if(!editingId)return false;
    draftName=rosterName.value.trim().slice(0,50)||'Untitled Class';
    draftStudents=normalizeRosterNames(draftStudents);
    if(draftSignature()===originalSignature)return false;
    const classes=readClassRosters();
    const target=classes.find(item=>item.id===editingId);
    if(!target)return false;
    target.name=draftName;target.students=[...draftStudents];
    target.logo=normalizeClassLogo(draftLogo);
    writeClassRosters(classes);
    originalSignature=draftSignature();
    return true;
  };

  const showList=()=>{
    saveDraftIfChanged();editingId='';listView.hidden=false;rosterView.hidden=true;render();
  };

  const openRoster=item=>{
    editingId=item.id;draftName=item.name;draftLogo=normalizeClassLogo(item.logo);draftStudents=[...item.students];
    rosterName.value=draftName;originalSignature=draftSignature();
    listView.hidden=true;rosterView.hidden=false;syncLogoPicker();renderDraft();
    requestAnimationFrame(()=>studentInput.focus({preventScroll:true}));
  };

  const render=()=>{
    const classes=readClassRosters();
    list.replaceChildren();
    if(!classes.length){
      const empty=document.createElement('p');
      empty.className='profile-class-empty';
      empty.textContent='No classes yet. Create one to build your first roster.';
      list.append(empty);
      return;
    }
    classes.forEach(item=>{
      const card=document.createElement('article');
      card.className='profile-class-card';
      const icon=document.createElement('span');icon.className='profile-class-card__icon';icon.textContent=normalizeClassLogo(item.logo);
      const copy=document.createElement('span');copy.className='profile-class-card__copy';
      const title=document.createElement('strong');title.textContent=item.name;
      const count=document.createElement('small');count.textContent=`${item.students.length} ${item.students.length===1?'student':'students'}`;
      copy.append(title,count);
      const edit=document.createElement('button');
      edit.type='button';edit.className='profile-class-card__edit';edit.textContent='Edit Class';edit.setAttribute('aria-label',`Edit ${item.name}`);
      edit.addEventListener('click',()=>openRoster(item));
      card.append(icon,copy,edit);list.append(card);
    });
  };

  const setOpen=open=>{
    if(!open&&editingId)saveDraftIfChanged();
    panel.hidden=!open;openButton.setAttribute('aria-expanded',String(open));
    if(open){listView.hidden=false;rosterView.hidden=true;editingId='';render();requestAnimationFrame(()=>nameInput.focus({preventScroll:true}))}
    else document.getElementById('profile-toggle')?.focus({preventScroll:true});
  };
  openButton.addEventListener('click',()=>{
    document.getElementById('profile-student-view-close')?.click();
    document.querySelector('[data-profile-close]')?.click();
    setOpen(true);
  });
  closeButton?.addEventListener('click',()=>setOpen(false));
  backButton?.addEventListener('click',()=>{setOpen(false);document.getElementById('profile-toggle')?.click()});
  panel.querySelector('.classes-window__backdrop')?.addEventListener('click',()=>setOpen(false));
  rosterBack?.addEventListener('click',showList);
  rosterDone?.addEventListener('click',showList);
  rosterDelete?.addEventListener('click',()=>{
    if(!editingId)return;
    const classes=readClassRosters();
    const target=classes.find(item=>item.id===editingId);
    if(!target)return;
    if(!confirm(`Delete ${target.name}? This removes the class roster and its saved PBIS stats.`))return;
    const deletedId=editingId;
    editingId='';draftName='';draftLogo='👥';draftStudents=[];originalSignature='';
    writeClassRosters(classes.filter(item=>item.id!==deletedId));
    listView.hidden=false;rosterView.hidden=true;render();
  });
  rosterName?.addEventListener('input',()=>draftName=rosterName.value);
  let customLogoFreshFocus=false;
  customLogoInput?.addEventListener('focus',()=>{
    customLogoFreshFocus=true;
    customLogoInput.placeholder='';
    requestAnimationFrame(()=>customLogoInput.select());
  });
  customLogoInput?.addEventListener('click',()=>{
    if(!customLogoFreshFocus)return;
    customLogoFreshFocus=false;
    customLogoInput.select();
  });
  customLogoInput?.addEventListener('blur',()=>{
    customLogoFreshFocus=false;
    customLogoInput.placeholder='✨';
  });
  customLogoInput?.addEventListener('paste',event=>{
    const pasted=event.clipboardData?.getData('text');
    if(typeof pasted!=='string')return;
    event.preventDefault();
    customLogoFreshFocus=false;
    customLogoInput.value=pasted.trim();
    customLogoInput.dispatchEvent(new Event('input',{bubbles:true}));
  });
  customLogoInput?.addEventListener('input',()=>{
    const next=String(customLogoInput.value||'').trim();
    draftLogo=next?normalizeClassLogo(next):'👥';
    syncLogoPicker({syncCustom:false});
  });
  studentForm?.addEventListener('submit',event=>{
    event.preventDefault();
    const name=String(studentInput.value||'').trim().replace(/\s+/g,' ');
    if(!name)return;
    if(!draftStudents.some(item=>item.toLocaleLowerCase()===name.toLocaleLowerCase()))draftStudents.push(name.slice(0,60));
    studentInput.value='';renderDraft();studentInput.focus({preventScroll:true});
  });
  form.addEventListener('submit',event=>{
    event.preventDefault();
    const name=nameInput.value.trim();if(!name)return;
    const classes=readClassRosters();classes.push({id:classRosterId(),name:name.slice(0,50),logo:'👥',students:[],classMeter:normalizeClassMeterProgress(null),collectionJar:normalizeCollectionProgress(null),punchcards:normalizePunchcardProgress(null,[]),racer:normalizeRacerProgress(null,[])});
    writeClassRosters(classes);nameInput.value='';render();
  });
  window.addEventListener('teachertiles:classeschange',render);
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||panel.hidden)return;
    event.preventDefault();
    if(!rosterView.hidden)showList();else setOpen(false);
  });
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setupProfileClasses,{once:true});else setupProfileClasses();

const STUDENT_VIEW_STATS_KEY='teachertiles-student-view-stats-v1';
const studentViewStatsStorageKey=()=>`${STUDENT_VIEW_STATS_KEY}:${window.TeacherTilesClassScope||'local'}`;
const PBIS_STUDENT_STAT_DEFINITIONS=Object.freeze([
  Object.freeze({
    id:'stars',
    label:'Stars',
    description:'Stars earned in Star Chart',
    wholeClassDescription:'Whole-class stars earned in Star Chart',
    icon:'★',
    value:(roster,name)=>normalizeStarChartCount(roster.starChart?.studentStars?.[starChartStudentKey(name)]),
    wholeClassValue:roster=>normalizeStarChartCount(roster.starChart?.wholeClassStars)
  }),
  Object.freeze({
    id:'punchcardPoints',
    label:'Punchcard Points',
    description:'Punchcards completed by this student',
    wholeClassDescription:'Whole-class Punchcards completed by this class',
    icon:'●',
    value:(roster,name)=>normalizePunchcardProgress(roster.punchcards,roster.students).studentPoints[starChartStudentKey(name)]||0,
    wholeClassValue:roster=>normalizePunchcardProgress(roster.punchcards,roster.students).wholeClassPoints
  }),
  Object.freeze({
    id:'raceWins',
    label:'Race Wins',
    description:'Racer finish-line wins earned by this student',
    icon:'🏁',
    studentOnly:true,
    value:(roster,name)=>normalizeRacerProgress(roster.racer,roster.students).studentWins[starChartStudentKey(name)]||0,
    wholeClassValue:()=>0
  }),
  Object.freeze({
    id:'meterWins',
    label:'Class Meter Wins',
    description:'Whole-class Class Meter fills',
    wholeClassDescription:'Times this class filled its Class Meter',
    icon:'🌡️',
    wholeClassOnly:true,
    value:()=>0,
    wholeClassValue:roster=>normalizeClassMeterProgress(roster.classMeter).wins
  }),
  Object.freeze({
    id:'jarsFilled',
    label:'Jars Filled',
    description:'Whole-class Collection Jars filled',
    wholeClassDescription:'Collection Jars filled by this class',
    icon:'🫙',
    wholeClassOnly:true,
    value:()=>0,
    wholeClassValue:roster=>normalizeCollectionProgress(roster.collectionJar).jarsFilled
  })
]);

function readStudentViewStatPreferences(){
  let saved={};
  try{saved=JSON.parse(localStorage.getItem(studentViewStatsStorageKey())||'{}')||{}}catch{}
  return Object.fromEntries(PBIS_STUDENT_STAT_DEFINITIONS.map(stat=>[stat.id,saved[stat.id]!==false]));
}

function writeStudentViewStatPreferences(preferences){
  localStorage.setItem(studentViewStatsStorageKey(),JSON.stringify(preferences));
  window.dispatchEvent(new CustomEvent('teachertiles:studentstatschange',{detail:{preferences}}));
}

function studentProfileVisual(name,classId=''){
  const clean=String(name||'Student').trim()||'Student';
  const parts=clean.split(/\s+/).filter(Boolean);
  const initials=((parts[0]?.[0]||'S')+(parts.length>1?(parts.at(-1)?.[0]||''):'')).toLocaleUpperCase();
  let hash=0;
  for(const character of`${classId}:${clean}`)hash=(hash*31+character.codePointAt(0))>>>0;
  return{initials:initials.slice(0,2),hue:hash%360};
}

function setupStudentView(){
  const openButton=document.getElementById('profile-student-view-button');
  const panel=document.getElementById('profile-student-view-panel');
  const closeButton=document.getElementById('profile-student-view-close');
  const backButton=document.getElementById('profile-student-view-back');
  const rosterContainer=document.getElementById('student-view-rosters');
  const studentSearch=document.getElementById('student-view-search');
  const statMenuToggle=document.getElementById('student-view-stat-menu-toggle');
  const statMenu=document.getElementById('student-view-stat-menu');
  const toggleContainer=document.getElementById('student-view-stat-toggles');
  const detail=document.getElementById('student-view-detail');
  const detailClose=document.getElementById('student-view-detail-close');
  const detailAvatar=document.getElementById('student-profile-avatar');
  const detailClass=document.getElementById('student-profile-class');
  const detailName=document.getElementById('student-profile-name');
  const detailStats=document.getElementById('student-profile-stats');
  if(!openButton||!panel||!closeButton||!rosterContainer||!studentSearch||!statMenuToggle||!statMenu||!toggleContainer||!detail)return;
  document.body.appendChild(panel);
  let activeStudent=null;

  const setStatMenuOpen=open=>{
    statMenu.hidden=!open;
    statMenuToggle.setAttribute('aria-expanded',String(open));
    if(open)requestAnimationFrame(()=>statMenu.querySelector('input')?.focus({preventScroll:true}));
  };

  const enabledStats=({wholeClass=false}={})=>{
    const preferences=readStudentViewStatPreferences();
    return PBIS_STUDENT_STAT_DEFINITIONS.filter(stat=>preferences[stat.id]&&(!stat.wholeClassOnly||wholeClass)&&(!stat.studentOnly||!wholeClass));
  };

  const resetProfileStat=(stat,roster,name,{wholeClass=false}={})=>{
    if(!roster?.id)return;
    const target=wholeClass?roster.name:(String(name||'Student').trim()||'Student');
    const scope=wholeClass?`the whole-class ${stat.label} for ${target}`:`${stat.label} for ${target}`;
    if(!window.confirm(`Reset ${scope}? This cannot be undone.`))return;
    if(stat.id==='stars'){
      const progress=normalizeStarChartProgress(roster.starChart,roster.students);
      if(wholeClass)progress.wholeClassStars=0;else progress.studentStars[starChartStudentKey(name)]=0;
      writeClassStarChart(roster.id,progress);
    }else if(stat.id==='punchcardPoints'){
      const progress=normalizePunchcardProgress(roster.punchcards,roster.students);
      if(wholeClass)progress.wholeClassPoints=0;else progress.studentPoints[starChartStudentKey(name)]=0;
      writeClassPunchcards(roster.id,progress);
    }else if(stat.id==='raceWins'){
      const progress=normalizeRacerProgress(roster.racer,roster.students);
      progress.studentWins[starChartStudentKey(name)]=0;
      writeClassRacer(roster.id,progress);
    }else if(stat.id==='meterWins'){
      const progress=normalizeClassMeterProgress(roster.classMeter);
      progress.wins=0;
      writeClassMeter(roster.id,progress);
    }else if(stat.id==='jarsFilled'){
      const progress=normalizeCollectionProgress(roster.collectionJar);
      progress.jarsFilled=0;
      writeClassCollection(roster.id,progress);
    }
    flushPbisCloudSave();
  };

  const appendStats=(container,roster,name,{compact=false,wholeClass=false}={})=>{
    container.replaceChildren();
    const stats=enabledStats({wholeClass});
    if(!stats.length){
      const empty=document.createElement(compact?'span':'p');
      empty.className=compact?'student-view-stat-summary--empty':'student-profile-stats-empty';
      empty.textContent=compact?'Stats hidden':'No PBIS stats are currently enabled for student profiles.';
      container.append(empty);return;
    }
    stats.forEach(stat=>{
      const value=wholeClass?stat.wholeClassValue?.(roster)??0:stat.value(roster,name);
      const item=document.createElement(compact?'span':'div');
      item.className=compact?'student-view-stat-summary':'student-profile-stat';
      const icon=document.createElement('i');icon.textContent=stat.icon;icon.setAttribute('aria-hidden','true');
      const count=document.createElement('strong');count.textContent=String(value);
      if(compact){item.append(icon,count)}else{
        const copy=document.createElement('span');
        const label=document.createElement('small');label.textContent=wholeClass?(stat.wholeClassDescription||stat.description):stat.description;
        const reset=document.createElement('button');reset.type='button';reset.className='student-profile-stat__reset';reset.textContent='Reset';reset.disabled=Number(value)<=0;reset.setAttribute('aria-label',`Reset ${stat.label} for ${wholeClass?roster.name:name}`);
        reset.addEventListener('click',()=>resetProfileStat(stat,roster,name,{wholeClass}));
        copy.append(count,label);item.append(icon,copy,reset);
      }
      container.append(item);
    });
  };

  const renderDetail=()=>{
    if(!activeStudent)return;
    const roster=readClassRosters().find(item=>item.id===activeStudent.classId);
    if(!roster||(!activeStudent.wholeClass&&!roster.students.includes(activeStudent.name))){detail.hidden=true;activeStudent=null;return}
    const visual=studentProfileVisual(activeStudent.wholeClass?roster.name:activeStudent.name,`${roster.id}:${activeStudent.wholeClass?'whole':'student'}`);
    detailAvatar.textContent=activeStudent.wholeClass?normalizeClassLogo(roster.logo):visual.initials;
    detailAvatar.style.setProperty('--student-avatar-hue',String(visual.hue));
    detailClass.textContent=activeStudent.wholeClass?'Whole Class Profile':roster.name;
    detailName.textContent=activeStudent.wholeClass?roster.name:activeStudent.name;
    appendStats(detailStats,roster,activeStudent.name,{wholeClass:activeStudent.wholeClass});
  };

  const openDetail=(roster,name,{wholeClass=false}={})=>{
    activeStudent={classId:roster.id,name,wholeClass};
    detail.hidden=false;
    renderDetail();
    if(activeStudent)requestAnimationFrame(()=>detailClose?.focus({preventScroll:true}));
  };
  const closeDetail=()=>{detail.hidden=true;activeStudent=null};

  const renderToggles=()=>{
    const preferences=readStudentViewStatPreferences();
    toggleContainer.replaceChildren();
    PBIS_STUDENT_STAT_DEFINITIONS.forEach(stat=>{
      const label=document.createElement('label');label.className='student-view-stat-toggle';
      const input=document.createElement('input');input.type='checkbox';input.checked=preferences[stat.id];input.setAttribute('aria-label',`Show ${stat.label} on ${stat.wholeClassOnly?'whole-class':stat.studentOnly?'student':'student and class'} profiles`);
      const track=document.createElement('span');track.className='student-view-stat-toggle__track';
      const copy=document.createElement('span');
      const title=document.createElement('strong');title.textContent=`${stat.icon} ${stat.label}`;
      const description=document.createElement('small');description.textContent=stat.wholeClassOnly?(stat.wholeClassDescription||stat.description):stat.description;
      copy.append(title,description);label.append(input,track,copy);
      input.addEventListener('change',()=>{
        const next=readStudentViewStatPreferences();next[stat.id]=input.checked;writeStudentViewStatPreferences(next);renderRosters();renderDetail();
      });
      toggleContainer.append(label);
    });
  };

  const renderRosters=()=>{
    const classes=readClassRosters();
    rosterContainer.replaceChildren();
    const query=studentSearch.value.trim().toLocaleLowerCase();
    const populated=classes.map(roster=>({
      ...roster,
      students:query?roster.students.filter(name=>name.toLocaleLowerCase().includes(query)):roster.students
    })).filter(roster=>!query||roster.students.length||roster.name.toLocaleLowerCase().includes(query));
    if(!populated.length){
      const empty=document.createElement('div');empty.className='student-view-empty';
      empty.innerHTML=query?'<span aria-hidden="true">⌕</span><strong>No students found</strong><p>Try a different student or class name.</p>':'<span aria-hidden="true">👥</span><strong>No classes yet</strong><p>Create a class to see its whole-class profile and student profiles here.</p>';
      rosterContainer.append(empty);return;
    }
    populated.forEach(roster=>{
      const section=document.createElement('section');section.className='student-view-class';
      const header=document.createElement('header');
      const classProfile=document.createElement('button');classProfile.type='button';classProfile.className='student-view-class-profile';classProfile.setAttribute('aria-label',`Open ${roster.name} whole-class profile`);
      const classAvatar=document.createElement('span');classAvatar.className='student-view-class-profile__avatar';classAvatar.textContent=normalizeClassLogo(roster.logo);classAvatar.setAttribute('aria-hidden','true');
      const classCopy=document.createElement('span');classCopy.className='student-view-class-profile__copy';
      const classEyebrow=document.createElement('small');classEyebrow.textContent='WHOLE CLASS PROFILE';
      const title=document.createElement('h4');title.textContent=roster.name;title.title=roster.name;
      const classStats=document.createElement('span');classStats.className='student-view-class-profile__stats';appendStats(classStats,roster,'',{compact:true,wholeClass:true});
      classCopy.append(classEyebrow,title,classStats);
      const classArrow=document.createElement('i');classArrow.textContent='›';classArrow.setAttribute('aria-hidden','true');
      classProfile.append(classAvatar,classCopy,classArrow);classProfile.addEventListener('click',()=>openDetail(roster,'',{wholeClass:true}));
      const count=document.createElement('span');count.textContent=`${roster.students.length} ${roster.students.length===1?'student':'students'}`;
      header.append(classProfile,count);
      const grid=document.createElement('div');grid.className='student-view-grid';
      roster.students.forEach(name=>{
        const visual=studentProfileVisual(name,roster.id);
        const card=document.createElement('button');card.type='button';card.className='student-view-person';card.setAttribute('aria-label',`Open ${name}'s student profile`);
        const avatar=document.createElement('span');avatar.className='student-view-person__avatar';avatar.textContent=visual.initials;avatar.style.setProperty('--student-avatar-hue',String(visual.hue));
        const copy=document.createElement('span');copy.className='student-view-person__copy';
        const studentName=document.createElement('strong');studentName.textContent=name;studentName.title=name;
        const stats=document.createElement('span');stats.className='student-view-person__stats';appendStats(stats,roster,name,{compact:true});
        copy.append(studentName,stats);const arrow=document.createElement('i');arrow.textContent='›';arrow.setAttribute('aria-hidden','true');
        card.append(avatar,copy,arrow);card.addEventListener('click',()=>openDetail(roster,name));grid.append(card);
      });
      section.append(header,grid);rosterContainer.append(section);
    });
  };

  const render=()=>{renderToggles();renderRosters();if(!detail.hidden)renderDetail()};
  const setOpen=open=>{
    panel.hidden=!open;openButton.setAttribute('aria-expanded',String(open));
    if(open){setStatMenuOpen(false);render();requestAnimationFrame(()=>closeButton.focus({preventScroll:true}))}else{setStatMenuOpen(false);closeDetail();document.getElementById('profile-toggle')?.focus({preventScroll:true})}
  };
  openButton.addEventListener('click',()=>{
    document.getElementById('profile-classes-close')?.click();
    document.querySelector('[data-profile-close]')?.click();
    setOpen(true);
  });
  studentSearch.addEventListener('input',renderRosters);
  statMenuToggle.addEventListener('click',()=>setStatMenuOpen(statMenu.hidden));
  panel.addEventListener('pointerdown',event=>{
    if(!statMenu.hidden&&!event.target.closest('.student-view-stat-menu'))setStatMenuOpen(false);
  });
  closeButton.addEventListener('click',()=>setOpen(false));
  backButton?.addEventListener('click',()=>{setOpen(false);document.getElementById('profile-toggle')?.click()});
  panel.querySelector('.student-view-window__backdrop')?.addEventListener('click',()=>setOpen(false));
  detailClose?.addEventListener('click',closeDetail);
  detail.querySelector('.student-view-detail__backdrop')?.addEventListener('click',closeDetail);
  window.addEventListener('teachertiles:classeschange',()=>{if(!panel.hidden)render()});
  window.addEventListener('teachertiles:starchartchange',()=>{if(!panel.hidden){renderRosters();renderDetail()}});
  window.addEventListener('teachertiles:classmeterchange',()=>{if(!panel.hidden){renderRosters();renderDetail()}});
  window.addEventListener('teachertiles:collectionchange',()=>{if(!panel.hidden){renderRosters();renderDetail()}});
  window.addEventListener('teachertiles:punchcardchange',()=>{if(!panel.hidden){renderRosters();renderDetail()}});
  window.addEventListener('teachertiles:racerchange',()=>{if(!panel.hidden){renderRosters();renderDetail()}});
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||panel.hidden)return;
    event.preventDefault();
    if(!statMenu.hidden){setStatMenuOpen(false);statMenuToggle.focus({preventScroll:true})}
    else if(!detail.hidden)closeDetail();else setOpen(false);
  });
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setupStudentView,{once:true});else setupStudentView();

const TRANSLATION_LANGUAGES=[
  {code:'en',name:'English',nativeName:'English',speech:'en-US'},
  {code:'es',name:'Spanish',nativeName:'Español',speech:'es-ES'},
  {code:'fr',name:'French',nativeName:'Français',speech:'fr-FR'},
  {code:'de',name:'German',nativeName:'Deutsch',speech:'de-DE'},
  {code:'it',name:'Italian',nativeName:'Italiano',speech:'it-IT'},
  {code:'pt',name:'Portuguese',nativeName:'Português',speech:'pt-BR'},
  {code:'zh-CN',name:'Chinese (Simplified)',nativeName:'中文（简体）',speech:'zh-CN'},
  {code:'ja',name:'Japanese',nativeName:'日本語',speech:'ja-JP'},
  {code:'ko',name:'Korean',nativeName:'한국어',speech:'ko-KR'},
  {code:'ar',name:'Arabic',nativeName:'العربية',speech:'ar-SA'},
  {code:'hi',name:'Hindi',nativeName:'हिन्दी',speech:'hi-IN'},
  {code:'ru',name:'Russian',nativeName:'Русский',speech:'ru-RU'},
  {code:'uk',name:'Ukrainian',nativeName:'Українська',speech:'uk-UA'},
  {code:'pl',name:'Polish',nativeName:'Polski',speech:'pl-PL'},
  {code:'nl',name:'Dutch',nativeName:'Nederlands',speech:'nl-NL'},
  {code:'tr',name:'Turkish',nativeName:'Türkçe',speech:'tr-TR'},
  {code:'vi',name:'Vietnamese',nativeName:'Tiếng Việt',speech:'vi-VN'},
  {code:'tl',name:'Filipino',nativeName:'Filipino',speech:'fil-PH'},
  {code:'ht',name:'Haitian Creole',nativeName:'Kreyòl ayisyen',speech:'ht-HT'},
  {code:'el',name:'Greek',nativeName:'Ελληνικά',speech:'el-GR'},
  {code:'he',name:'Hebrew',nativeName:'עברית',speech:'he-IL'},
  {code:'sv',name:'Swedish',nativeName:'Svenska',speech:'sv-SE'}
];
const APP_LANGUAGE_CODES=new Set(TRANSLATION_LANGUAGES.map(language=>language.code));

function normalizeAppPreferences(value={}){
  const source=value&&typeof value==='object'?value:{};
  const prefClamp=(number,min,max)=>Math.max(min,Math.min(max,number));
  const rawVolume=Number(source.uiVolume);
  const rawScroll=Number(source.scrollSpeed);
  return{
    uiMuted:Boolean(source.uiMuted),
    uiVolume:prefClamp(Number.isFinite(rawVolume)?rawVolume:100,0,100),
    scrollSpeed:prefClamp(Number.isFinite(rawScroll)?rawScroll:100,50,175),
    defaultViewSize:[75,100,125,150].includes(Number(source.defaultViewSize))?Number(source.defaultViewSize):100,
    language:APP_LANGUAGE_CODES.has(source.language)?source.language:'en'
  };
}

function readStoredAppPreferences(){
  try{
    const saved=JSON.parse(localStorage.getItem(APP_PREFERENCES_KEY)||'null');
    if(saved&&typeof saved==='object')return normalizeAppPreferences({...DEFAULT_APP_PREFERENCES,...saved});
  }catch{}
  return normalizeAppPreferences({...DEFAULT_APP_PREFERENCES,uiMuted:localStorage.getItem(UI_SFX_KEY)==='true'});
}

let appPreferences=readStoredAppPreferences();
let uiSfxMuted=appPreferences.uiMuted;
const uiSfxPrototype=new Audio('assets/ui/pop.mp3');
uiSfxPrototype.preload='auto';
const confettiSfxPrototype=new Audio('assets/ui/confetti-pop.mp3');
confettiSfxPrototype.preload='auto';
const timerTadaSfxPrototype=new Audio('assets/ui/timer-tada.mp3');
timerTadaSfxPrototype.preload='auto';
const moneySfxPrototype=new Audio('assets/ui/coin-drop.mp3');
moneySfxPrototype.preload='auto';
const holePunchSfxPrototype=new Audio('assets/ui/hole-punch.mp3');
holePunchSfxPrototype.preload='auto';

function persistAppPreferences(){
  try{localStorage.setItem(APP_PREFERENCES_KEY,JSON.stringify(appPreferences))}catch{}
  try{localStorage.setItem(UI_SFX_KEY,String(appPreferences.uiMuted))}catch{}
}

function boardPreferenceSnapshot(){
  return{
    uiMuted:Boolean(appPreferences.uiMuted),
    uiVolume:Number.isFinite(Number(appPreferences.uiVolume))?Number(appPreferences.uiVolume):100,
    scrollSpeed:Number(appPreferences.scrollSpeed)||100,
    defaultViewSize:Number(appPreferences.defaultViewSize)||100,
    language:APP_LANGUAGE_CODES.has(appPreferences.language)?appPreferences.language:'en'
  };
}

function playUiSfx(kind='click'){
  if(appPreferences.uiMuted)return;
  try{
    const prototype=kind==='confetti'?confettiSfxPrototype:kind==='timer-tada'?timerTadaSfxPrototype:kind==='money'?moneySfxPrototype:kind==='hole-punch'?holePunchSfxPrototype:uiSfxPrototype;
    const sound=prototype.cloneNode();
    const base=kind==='intro'?.62:kind==='confetti'?.72:kind==='timer-tada'?.16:kind==='money'?.5:kind==='hole-punch'?.12:kind==='collection'?.18:.11;
    sound.volume=clamp(base*(appPreferences.uiVolume/100),0,1);
    sound.playbackRate=kind==='intro'||kind==='confetti'||kind==='timer-tada'||kind==='money'||kind==='hole-punch'?1:kind==='collection'?.92:1.35;
    sound.currentTime=0;
    sound.play().catch(()=>{});
  }catch{}
}

const classMeterFillSfxPrototype=new Audio('assets/ui/class-meter-fill.wav');
classMeterFillSfxPrototype.preload='auto';
function startClassMeterFillSfx(){
  if(appPreferences.uiMuted||Number(appPreferences.uiVolume)<=0)return()=>{};
  try{
    const sound=classMeterFillSfxPrototype.cloneNode();
    const targetVolume=clamp(.34*(Number(appPreferences.uiVolume)/100),0,1);
    const fadeDuration=180;
    let fadeFrame=0;
    let stopped=false;
    sound.volume=0;
    sound.currentTime=0;
    sound.loop=false;

    const fade=(from,to,duration,onDone)=>{
      if(fadeFrame)cancelAnimationFrame(fadeFrame);
      const startedAt=performance.now();
      const tick=now=>{
        const progress=clamp((now-startedAt)/duration,0,1);
        const eased=progress*progress*(3-2*progress);
        sound.volume=clamp(from+(to-from)*eased,0,1);
        if(progress<1)fadeFrame=requestAnimationFrame(tick);
        else{fadeFrame=0;onDone?.()}
      };
      fadeFrame=requestAnimationFrame(tick);
    };

    sound.play().then(()=>{
      if(stopped){sound.pause();sound.currentTime=0;return}
      fade(0,targetVolume,fadeDuration);
    }).catch(()=>{});
    return()=>{
      if(stopped)return;
      stopped=true;
      fade(sound.volume,0,240,()=>{sound.pause();sound.currentTime=0});
    };
  }catch{
    return()=>{};
  }
}

document.addEventListener('click',e=>{
  if(!e.isTrusted)return;
  const target=e.target;
  if(!(target instanceof Element))return;
  if(target.closest('#settings-ui-sfx-toggle,.punchcard-hole'))return;
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

// Pointer-clicked module controls should disappear again when the pointer leaves.
// Keyboard focus is preserved so the same controls remain accessible to tab users.
let lastUiInteractionWasKeyboard=false;
const SPACEBAR_FLASHCARD_SELECTOR='.abc-card,.cvcword-card,.highfrequency-card,.customflashcards-card';
let activeSpacebarFlashcard=null;
document.addEventListener('keydown',event=>{
  if(event.key==='Tab'||event.key==='Enter'||event.key===' '){
    lastUiInteractionWasKeyboard=true;
    document.body.classList.add('is-keyboard-navigation');
  }
},true);
document.addEventListener('pointerdown',event=>{
  lastUiInteractionWasKeyboard=false;
  document.body.classList.remove('is-keyboard-navigation');
  const target=event.target instanceof Element?event.target:null;
  activeSpacebarFlashcard=target?.closest(SPACEBAR_FLASHCARD_SELECTOR)||null;
},true);
document.addEventListener('pointerup',event=>{
  if(lastUiInteractionWasKeyboard||!(event.target instanceof Element))return;
  const control=event.target.closest('.customization-bar button,.lunchcount-inline-actions button');
  if(control instanceof HTMLElement)requestAnimationFrame(()=>control.blur());
},true);
document.addEventListener('change',event=>{
  if(lastUiInteractionWasKeyboard||!(event.target instanceof Element))return;
  const control=event.target.closest('.customization-bar input,.customization-bar select');
  if(control instanceof HTMLElement)requestAnimationFrame(()=>control.blur());
},true);

// Menu launchers use aria-expanded for their real open state. After a pointer
// closes a surface, release restored focus so the corner trays do not look active.
new MutationObserver(records=>{
  if(lastUiInteractionWasKeyboard)return;
  for(const record of records){
    const control=record.target;
    if(control instanceof HTMLElement&&control.matches('.workspace-control[aria-expanded="false"]')){
      requestAnimationFrame(()=>{
        if(!lastUiInteractionWasKeyboard&&control.matches(':focus'))control.blur();
      });
    }
  }
}).observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['aria-expanded']});

const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const formatCountdown=s=>{s=Math.max(0,Math.ceil(s));const m=Math.floor(s/60),ss=s%60;return `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`};

const APP_TRANSLATIONS={
  en:{
    'top.settings':'Settings','top.help':'Help','top.news':'News','top.fullscreen':'Fullscreen','top.profile':'Profile','top.themes':'Themes','top.stickers':'Stickers','top.shop':'Shop','top.boards':'Boards',
    'warning.signin':'Sign-in to save your TileSet layout.','hint.addTile':'Right-click anywhere to add a tile',
    'boards.title':'Boards','boards.back':'Back to Board','boards.loading':'Loading boards…',
    'context.addTile':'Add tile','context.all':'ALL','context.search':'Search tiles...','context.none':'No tiles found','context.try':'Try another search.',
    'context.cat.text':'TEXT','context.cat.media':'MEDIA','context.cat.tools':'TOOLS','context.cat.language':'LANGUAGE','context.cat.geography':'GEOGRAPHY','context.cat.accessibility':'ACCESSIBILITY','context.cat.time':'TIME','context.cat.audio':'AUDIO','context.cat.games':'GAMES','context.cat.literacy':'LITERACY','context.cat.math':'MATH','context.cat.science':'SCIENCE','context.cat.planning':'PLANNING','context.cat.pbis':'PBIS','context.cat.sel':'SEL',
    'settings.eyebrow':'TEACHERTILES','settings.title':'Settings & Help','settings.tab.settings':'Settings','settings.tab.help':'Help','settings.tab.news':'News','settings.tab.announcements':'Updates','settings.tab.contact':'Contact Us','settings.tab.terms':'Terms & Conditions',
    'settings.preferences.kicker':'Preferences','settings.preferences.title':'Make TeacherTiles yours.','settings.preferences.copy':'These preferences are stored with the current board and sync in the same autosave.',
    'settings.sound.title':'Sound','settings.sound.copy':'Control TeacherTiles interface sounds.','settings.mute.title':'Mute UI sounds','settings.mute.copy':'Silence button clicks and interface effects.',
    'settings.volume.title':'UI volume','settings.volume.copy':'Adjust the volume of interface sound effects.',
    'settings.board.title':'Board','settings.board.copy':'Tune how the canvas feels while you work.','settings.scroll.title':'Scroll speed','settings.scroll.copy':'Changes mouse-wheel zoom and shelf scrolling sensitivity.',
    'settings.view.title':'Default view size','settings.view.copy':'Sets your working zoom and the starting size for new boards.',
    'settings.language.title':'Language','settings.language.copy':'Choose the language used by TeacherTiles menus and controls.','settings.language.interface':'Interface language','settings.language.note':'Your tile content is never translated or changed.',
    'settings.save.note':'Preference changes join the current board’s normal autosave—no extra Firestore save system.',
    'help.kicker':'HELP CENTER','help.title':'TeacherTiles controls at a glance','help.copy':'Keyboard shortcuts and mouse controls for moving quickly around your board.',
    'help.search':'Help search — coming soon','help.comingSoon':'COMING SOON','help.keyboard.title':'Keyboard shortcuts','help.keyboard.copy':'Shortcuts are ignored while you are actively typing when appropriate.',
    'help.key.selectAll':'Select all tiles and stickers; press again to clear.','help.key.copy':'Copy the current board selection.','help.key.paste':'Paste copied tiles or stickers.','help.key.duplicate':'Duplicate the current selection.',
    'help.key.undo':'Undo the latest board action.','help.key.redo':'Redo an undone action. Ctrl/⌘ + Shift + Z also works.','help.key.delete':'Delete only the selected tile or sticker—even when it belongs to a snapped group.','help.key.arrows':'Navigate around the board.','help.key.escape':'Exit text editing or close the active overlay/menu.',
    'help.mouse.title':'Mouse & trackpad','help.mouse.copy':'The board is designed to stay fast without switching tools.',
    'help.mouse.pan.title':'Pan the board','help.mouse.pan.copy':'Left-drag empty board space or middle-mouse drag anywhere on the board.',
    'help.mouse.select.title':'Group select','help.mouse.select.copy':'Hold Shift and left-drag empty space to draw a selection box.',
    'help.mouse.menu.title':'Add tiles','help.mouse.menu.copy':'Right-click empty board space to open the Add Tile menu.',
    'help.mouse.zoom.title':'Zoom','help.mouse.zoom.copy':'Scroll over the board for fast zoom. Hold Shift while scrolling for precise 1% steps.',
    'help.mouse.move.title':'Move tiles','help.mouse.move.copy':'Drag anywhere on a tile that is not an active button, slider, canvas, or other control.',
    'help.mouse.snap.title':'Snap & group','help.mouse.snap.copy':'Place one tile against another to snap them into a group. Grouped tiles move together and share one layer.',
    'help.mouse.tug.title':'Hold, then tug','help.mouse.tug.copy':'Press and hold a grouped tile until it shakes, then pull through the resistance to detach and move it independently.',
    'help.mouse.text.title':'Edit text','help.mouse.text.copy':'Double-click a text field to type. Click away from it to leave text-edit mode.',
    'help.mouse.sticker.title':'Transform stickers','help.mouse.sticker.copy':'Use corner handles to resize and the round handle to rotate. Hold Shift while rotating to snap by 15°.',
    'help.mouse.trash.title':'Delete by dragging','help.mouse.trash.copy':'Drag any snapped tile into the corner trash to delete its entire group.',
    'help.mouse.clear.title':'Clear selection','help.mouse.clear.copy':'Click outside the current selection to deselect it.',
    'help.tutorial.kicker':'GUIDES','help.tutorial.title':'More tutorials are coming soon.','help.tutorial.copy':'Step-by-step guides, feature walkthroughs, and searchable help are planned for this page.',
    'profile.eyebrow':'TEACHERTILES ACCOUNT','profile.title':'Profile','profile.checking':'Checking your account…','profile.welcome':'WELCOME','profile.signinTitle':'Sign in to TeacherTiles','profile.signinCopy':'Log in to an account to save your TileSets, purchase optional cosmetics, access the full app, and explore all that TeacherTiles has to offer.','profile.google':'Continue with Google','profile.signedIn':'SIGNED IN','profile.coins':'COINS','profile.balance':'Account balance','profile.connectedTitle':'Your profile is connected.','profile.connectedCopy':'This account will be used for your saved TeacherTiles boards and account data.','profile.signout':'Sign out',
    'shop.title':'Shop','shop.coins':'Coins','shop.kicker':'MAKE IT YOURS','shop.customize':'Customize your board','shop.browse':'Browse visual packs made for TeacherTiles.','shop.collection':'COLLECTION','shop.themeCopy':'Color & board styles','shop.stickerPacks':'Sticker Packs','shop.stickerCopy':'Decorate your workspace','shop.coming':'COMING SOON','shop.tilePacks':'Tile Skins','shop.tileCopy':'Cosmetic Tile Skins','shop.comingTitle':'Coming Soon','shop.extras':'Extras','shop.extrasCopy':'More ways to customize',
    'boards.new':'New Board','boards.delete':'Delete board','boards.create':'Create new blank board'
  },
  es:{
    'top.settings':'Ajustes','top.help':'Ayuda','top.news':'Noticias','top.fullscreen':'Pantalla completa','top.profile':'Perfil','top.themes':'Temas','top.stickers':'Pegatinas','top.shop':'Tienda','top.boards':'Tableros',
    'warning.signin':'Inicia sesión para guardar el diseño de tu TileSet.','hint.addTile':'Haz clic derecho en cualquier lugar para añadir un tile',
    'boards.title':'Tableros','boards.back':'Volver al tablero','boards.loading':'Cargando tableros…',
    'context.addTile':'Añadir tile','context.all':'TODO','context.search':'Buscar tiles...','context.none':'No se encontraron tiles','context.try':'Prueba otra búsqueda.',
    'context.cat.text':'TEXTO','context.cat.media':'MULTIMEDIA','context.cat.tools':'HERRAMIENTAS','context.cat.language':'IDIOMAS','context.cat.geography':'GEOGRAFÍA','context.cat.accessibility':'ACCESIBILIDAD','context.cat.time':'TIEMPO','context.cat.audio':'AUDIO','context.cat.games':'JUEGOS','context.cat.literacy':'LECTOESCRITURA','context.cat.math':'MATEMÁTICAS','context.cat.science':'CIENCIAS','context.cat.planning':'PLANIFICACIÓN','context.cat.pbis':'PBIS','context.cat.sel':'SEL',
    'settings.eyebrow':'TEACHERTILES','settings.title':'Ajustes y ayuda','settings.tab.settings':'Ajustes','settings.tab.help':'Ayuda','settings.tab.news':'Noticias','settings.tab.announcements':'Actualizaciones','settings.tab.contact':'Contáctanos','settings.tab.terms':'Términos y condiciones',
    'settings.preferences.kicker':'Preferencias','settings.preferences.title':'Haz TeacherTiles a tu manera.','settings.preferences.copy':'Estas preferencias se guardan con el tablero actual y se sincronizan en el mismo autoguardado.',
    'settings.sound.title':'Sonido','settings.sound.copy':'Controla los sonidos de la interfaz de TeacherTiles.','settings.mute.title':'Silenciar sonidos de la interfaz','settings.mute.copy':'Silencia los clics de botones y los efectos de la interfaz.',
    'settings.volume.title':'Volumen de la interfaz','settings.volume.copy':'Ajusta el volumen de los efectos de sonido de la interfaz.',
    'settings.board.title':'Tablero','settings.board.copy':'Ajusta cómo se siente el lienzo mientras trabajas.','settings.scroll.title':'Velocidad de desplazamiento','settings.scroll.copy':'Cambia la sensibilidad del zoom con la rueda y del desplazamiento de las estanterías.',
    'settings.view.title':'Tamaño de vista predeterminado','settings.view.copy':'Define el zoom de trabajo y el tamaño inicial de los tableros nuevos.',
    'settings.language.title':'Idioma','settings.language.copy':'Elige el idioma de los menús y controles de TeacherTiles.','settings.language.interface':'Idioma de la interfaz','settings.language.note':'El contenido de tus tiles nunca se traduce ni se modifica.',
    'settings.save.note':'Los cambios de preferencias se incluyen en el autoguardado normal del tablero; no usan un sistema adicional de Firestore.',
    'help.kicker':'CENTRO DE AYUDA','help.title':'Controles de TeacherTiles de un vistazo.','help.copy':'Atajos de teclado y controles del ratón para moverte rápidamente por tu tablero.',
    'help.search':'Búsqueda de ayuda — próximamente','help.comingSoon':'PRÓXIMAMENTE','help.keyboard.title':'Atajos de teclado','help.keyboard.copy':'Los atajos se ignoran cuando estás escribiendo, cuando corresponde.',
    'help.key.selectAll':'Selecciona todos los tiles y pegatinas; vuelve a pulsar para limpiar la selección.','help.key.copy':'Copia la selección actual del tablero.','help.key.paste':'Pega tiles o pegatinas copiados.','help.key.duplicate':'Duplica la selección actual.',
    'help.key.undo':'Deshace la última acción del tablero.','help.key.redo':'Rehace una acción deshecha. Ctrl/⌘ + Shift + Z también funciona.','help.key.delete':'Elimina solo el tile o la pegatina seleccionada, incluso si pertenece a un grupo acoplado.','help.key.arrows':'Navega por el tablero.','help.key.escape':'Sale de la edición de texto o cierra el menú/superposición activo.',
    'help.mouse.title':'Ratón y trackpad','help.mouse.copy':'El tablero está diseñado para trabajar rápido sin cambiar de herramienta.',
    'help.mouse.pan.title':'Mover el tablero','help.mouse.pan.copy':'Arrastra con clic izquierdo un espacio vacío o arrastra con el botón central en cualquier parte del tablero.',
    'help.mouse.select.title':'Selección de grupo','help.mouse.select.copy':'Mantén Shift y arrastra con clic izquierdo un espacio vacío para dibujar un área de selección.',
    'help.mouse.menu.title':'Añadir tiles','help.mouse.menu.copy':'Haz clic derecho en un espacio vacío para abrir el menú Añadir tile.',
    'help.mouse.zoom.title':'Zoom','help.mouse.zoom.copy':'Desplázate sobre el tablero para usar el zoom rápido. Mantén Shift mientras te desplazas para ajustar en pasos precisos del 1 %.',
    'help.mouse.move.title':'Mover tiles','help.mouse.move.copy':'Arrastra cualquier parte de un tile que no sea un botón, deslizador, lienzo u otro control activo.',
    'help.mouse.snap.title':'Acoplar y agrupar','help.mouse.snap.copy':'Coloca un tile junto a otro para acoplarlos en un grupo. Los tiles agrupados se mueven juntos y comparten una capa.',
    'help.mouse.tug.title':'Mantener y tirar','help.mouse.tug.copy':'Mantén pulsado un tile agrupado hasta que tiemble y luego tira venciendo la resistencia para separarlo y moverlo de forma independiente.',
    'help.mouse.text.title':'Editar texto','help.mouse.text.copy':'Haz doble clic en un campo de texto para escribir. Haz clic fuera para salir del modo de edición.',
    'help.mouse.sticker.title':'Transformar pegatinas','help.mouse.sticker.copy':'Usa las esquinas para cambiar el tamaño y el control circular para rotar. Mantén Shift para ajustar la rotación en pasos de 15°.',
    'help.mouse.trash.title':'Eliminar arrastrando','help.mouse.trash.copy':'Arrastra cualquier tile acoplado a la papelera de la esquina para eliminar todo su grupo.',
    'help.mouse.clear.title':'Limpiar selección','help.mouse.clear.copy':'Haz clic fuera de la selección actual para deseleccionarla.',
    'help.tutorial.kicker':'GUÍAS','help.tutorial.title':'Próximamente habrá más tutoriales.','help.tutorial.copy':'Esta página tendrá guías paso a paso, recorridos de funciones y ayuda con búsqueda.',
    'profile.eyebrow':'CUENTA DE TEACHERTILES','profile.title':'Perfil','profile.checking':'Comprobando tu cuenta…','profile.welcome':'BIENVENIDO','profile.signinTitle':'Inicia sesión en TeacherTiles','profile.signinCopy':'Inicia sesión en una cuenta para guardar tus TileSets, comprar cosméticos opcionales, acceder a toda la aplicación y descubrir todo lo que TeacherTiles ofrece.','profile.google':'Continuar con Google','profile.signedIn':'SESIÓN INICIADA','profile.coins':'MONEDAS','profile.balance':'Saldo de la cuenta','profile.connectedTitle':'Tu perfil está conectado.','profile.connectedCopy':'Esta cuenta se usará para tus tableros guardados de TeacherTiles y los datos de tu cuenta.','profile.signout':'Cerrar sesión',
    'shop.title':'Tienda','shop.coins':'Monedas','shop.kicker':'HAZLO TUYO','shop.customize':'Personaliza tu tablero','shop.browse':'Explora paquetes visuales creados para TeacherTiles.','shop.collection':'COLECCIÓN','shop.themeCopy':'Colores y estilos de tablero','shop.stickerPacks':'Paquetes de pegatinas','shop.stickerCopy':'Decora tu espacio de trabajo','shop.coming':'PRÓXIMAMENTE','shop.tilePacks':'Aspectos de tiles','shop.tileCopy':'Aspectos cosméticos para tiles','shop.comingTitle':'Próximamente','shop.extras':'Extras','shop.extrasCopy':'Más formas de personalizar',
    'boards.new':'Nuevo tablero','boards.delete':'Eliminar tablero','boards.create':'Crear un tablero nuevo en blanco'
  }
};

const CONTEXT_MODULE_TRANSLATIONS={
  en:{
    sticky:['Sticky note','Write and format notes'],textbubble:['Text Bubble','Simple scalable text display'],todo:['To-Do','Build a customizable checklist'],visualschedule:['Visual Schedule','Build a picture-based daily schedule'],lessonplannertile:['Lesson Planner','Show today’s or this week’s lesson plans'],
    image:['Image','Display an image on the board'],youtube:['YouTube','Play a YouTube video'],windowshare:['Window Share','Share a tab, window, or screen'],timer:['Visual Timer','Shape-based progress timer'],
    interactive:['Interactive Timers','Hourglass and melting candle'],clock:['Clock','Current time display'],date:['Date','Today’s date in your chosen style'],calendar:['Calendar','Events, birthdays, holidays, and months'],
    stopwatch:['Stopwatch','Count up with lap times'],progressbar:['Progress Bar','Fill toward a set end time'],draw:['Draw','Draw freely across the board'],dictionary:['Dictionary','Look up complete word entries'],translation:['Translation','Translate typed or spoken language'],writinglines:['Writing Lines','Handwriting practice template'],
    abc:['ABC','Animated alphabet flashcards'],cvcword:['CVC Word','Random animated CVC flashcards'],highfrequency:['High Frequency Words','Grade-level animated word flashcards'],customflashcards:['Custom Flashcards','Create reusable text and image card sets'],shapes:['Shapes','Explore sides, vertices, and shape facts'],numberline:['Number Line','Interactive expandable number line'],
    hundredschart:['Hundreds Chart','Hide, reveal, and highlight 1–100'],tenframes:['Ten Frames','Build quantities with draggable counters'],ruler:['Ruler','Measure with draggable ruler points'],calculator:['Calculator','Basic classroom calculator'],
    grapher:['Graphing Tool','Plot points and graph equations'],tablemaker:['Table Maker','Turn your data into animated charts'],tallychart:['Tally Chart','Count and compare results in real time'],periodictable:['Periodic Table','Explore all 118 elements'],money:['Money','Drag money manipulatives and total them'],noise:['Noise detector','Live microphone sound level'],
    collections:['Collections','Fill a class reward jar together'],prizeboard:['Prize Board','Create and redeem student or whole-class rewards'],pbisconsole:['PBIS Console','Manage every tracked PBIS stat in one place'],punchcards:['Punchcards','Punch reward cards for students or the whole class'],racer:['Racer','Move student racers toward the finish line'],stoplight:['Stoplight','GO, LISTEN, and STOP visual cue'],starchart:['Star Chart','Award stars to a class or individual students'],classmeter:['Class Meter','Hold to fill a whole-class reward meter'],classvsclass:['Class vs Class','Coming soon: class incentive competitions'],spinner:['Spinner','Spin a wheel to pick a name'],groupmaker:['Group Maker','Shuffle students into balanced groups'],
    lunchcount:['Lunch Count','Tally lunches or sort student names'],voting:['Voting','Tally votes or sort student names'],ambiencevideo:['Ambience Video','Campfire, fireplace, and aquarium scenes'],hangman:['Hangman','Guess the hidden word'],
    wordypuzzle:['Wordy Puzzle','Guess the teacher’s secret word'],boombox:['Boom Box','Loop classroom soundscapes'],
    livecaption:['Live Captions','Display speech as clear, readable text'],voicememo:['Voice Memos','Record and replay short audio notes'],photobooth:['Photobooth','Take filtered photos with your camera'],mirror:['Mirror','Use the camera as a classroom mirror'],
    weather:['Weather','Compare current weather for several places'],weatherwheel:['Weather Wheel','Point to today’s weather'],seasonwheel:['Season Wheel','Explore spring, summer, fall, and winter'],temperature:['Temperature','Display the outdoor temperature your way'],worldmap:['World Map','Explore countries, continents, and hemispheres'],compass:['Compass','Explore directions and compass parts']
  },
  es:{
    sticky:['Nota adhesiva','Escribe y da formato a notas'],textbubble:['Burbuja de texto','Texto simple que se adapta de tamaño'],todo:['Lista de tareas','Crea una lista personalizable'],visualschedule:['Horario visual','Crea un horario diario con imágenes'],lessonplannertile:['Planificador de lecciones','Muestra los planes de hoy o de esta semana'],
    image:['Imagen','Muestra una imagen en el tablero'],youtube:['YouTube','Reproduce un video de YouTube'],windowshare:['Compartir ventana','Comparte una pestaña, ventana o pantalla'],timer:['Temporizador visual','Temporizador de progreso con formas'],
    interactive:['Temporizadores interactivos','Reloj de arena y vela que se derrite'],clock:['Reloj','Muestra la hora actual'],date:['Fecha','La fecha de hoy en el estilo que elijas'],calendar:['Calendario','Eventos, cumpleaños, días festivos y meses'],
    stopwatch:['Cronómetro','Cuenta el tiempo con vueltas'],progressbar:['Barra de progreso','Avanza hasta una hora final'],draw:['Dibujar','Dibuja libremente por el tablero'],dictionary:['Diccionario','Busca entradas completas de palabras'],translation:['Traducción','Traduce texto escrito o hablado'],writinglines:['Líneas de escritura','Plantilla para practicar la escritura'],
    abc:['ABC','Tarjetas animadas del alfabeto'],cvcword:['Palabra CVC','Tarjetas animadas de palabras CVC'],highfrequency:['Palabras de alta frecuencia','Tarjetas animadas por nivel'],customflashcards:['Tarjetas personalizadas','Crea colecciones reutilizables con texto e imágenes'],shapes:['Figuras','Explora lados, vértices y datos geométricos'],numberline:['Recta numérica','Recta numérica interactiva y ampliable'],
    hundredschart:['Tabla del 100','Oculta, revela y resalta del 1 al 100'],tenframes:['Marcos de diez','Construye cantidades con fichas arrastrables'],ruler:['Regla','Mide con puntos de regla arrastrables'],calculator:['Calculadora','Calculadora básica para el aula'],
    grapher:['Herramienta de gráficas','Traza puntos y grafica ecuaciones'],tablemaker:['Creador de tablas','Convierte tus datos en gráficas animadas'],tallychart:['Tabla de conteo','Cuenta y compara resultados en tiempo real'],periodictable:['Tabla periódica','Explora los 118 elementos'],money:['Dinero','Arrastra manipulativos de dinero y calcula el total'],noise:['Detector de ruido','Nivel de sonido en vivo con micrófono'],
    collections:['Colecciones','Llena en grupo el frasco de recompensas de la clase'],prizeboard:['Tablero de premios','Crea y canjea recompensas individuales o para toda la clase'],pbisconsole:['Consola PBIS','Administra todas las estadísticas PBIS en un solo lugar'],punchcards:['Tarjetas de puntos','Completa tarjetas para estudiantes o toda la clase'],racer:['Carrera','Mueve a los estudiantes hacia la meta'],stoplight:['Semáforo','Señal visual de SIGUE, ESCUCHA y ALTO'],starchart:['Tabla de estrellas','Otorga estrellas a la clase o a estudiantes'],classmeter:['Medidor de clase','Mantén pulsado para llenar una meta de toda la clase'],classvsclass:['Clase contra clase','Próximamente: competencias de incentivos'],spinner:['Ruleta','Gira una ruleta para elegir un nombre'],groupmaker:['Creador de grupos','Mezcla estudiantes en grupos equilibrados'],
    lunchcount:['Conteo de almuerzo','Cuenta almuerzos u organiza nombres'],voting:['Votación','Cuenta votos u organiza nombres'],ambiencevideo:['Video ambiente','Escenas de fogata, chimenea y acuario'],hangman:['Ahorcado','Adivina la palabra oculta'],
    wordypuzzle:['Rompecabezas de palabras','Adivina la palabra secreta del docente'],boombox:['Boom Box','Repite paisajes sonoros del aula'],
    livecaption:['Subtítulos en vivo','Muestra el habla como texto claro y legible'],voicememo:['Notas de voz','Graba y reproduce notas de audio cortas'],photobooth:['Fotomatón','Toma fotos con filtros usando tu cámara'],mirror:['Espejo','Usa la cámara como espejo del aula'],
    weather:['Clima','Compara el clima actual de varios lugares'],weatherwheel:['Rueda del clima','Señala el clima de hoy'],seasonwheel:['Rueda de estaciones','Explora primavera, verano, otoño e invierno'],temperature:['Temperatura','Muestra la temperatura exterior a tu manera'],worldmap:['Mapa mundial','Explora países, continentes y hemisferios'],compass:['Brújula','Explora direcciones y partes de la brújula']
  }
};

const runtimeInterfaceTranslations={};
const interfaceTranslationRequests=new Map();
const INTERFACE_TRANSLATION_CACHE_VERSION='v5';

function readCachedInterfaceTranslations(language){
  try{
    const value=JSON.parse(localStorage.getItem(`tt-interface-${INTERFACE_TRANSLATION_CACHE_VERSION}-${language}`)||'null');
    return value&&typeof value==='object'&&!Array.isArray(value)?value:null;
  }catch{return null}
}

function writeCachedInterfaceTranslations(language,value){
  try{localStorage.setItem(`tt-interface-${INTERFACE_TRANSLATION_CACHE_VERSION}-${language}`,JSON.stringify(value))}catch{}
}

async function translateInterfaceChunk(language,phrases){
  const marker='\uE000';
  const request=async values=>{
    const source=values.join(`\n${marker}\n`);
    const url=`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${encodeURIComponent(language)}&dt=t&q=${encodeURIComponent(source)}`;
    const response=await fetch(url);
    if(!response.ok)throw new Error(`interface-translation-${response.status}`);
    const data=await response.json();
    const result=Array.isArray(data?.[0])?data[0].map(segment=>Array.isArray(segment)?String(segment[0]||''):'').join(''):'';
    return result.split(marker).map(value=>value.trim());
  };
  const translated=await request(phrases);
  if(translated.length===phrases.length)return translated;
  return Promise.all(phrases.map(async phrase=>(await request([phrase]))[0]||phrase));
}

async function loadInterfaceTranslations(language){
  if(language==='en'||language==='es')return;
  if(runtimeInterfaceTranslations[language])return;
  if(interfaceTranslationRequests.has(language))return interfaceTranslationRequests.get(language);
  const request=(async()=>{
    const cached=readCachedInterfaceTranslations(language);
    if(cached){runtimeInterfaceTranslations[language]=cached;return}
    const sources=[...new Set([
      ...Object.values(APP_TRANSLATIONS.en),
      ...Object.values(CONTEXT_MODULE_TRANSLATIONS.en).flat()
    ])];
    const chunks=[];
    for(let index=0;index<sources.length;){
      const chunk=[];
      let length=0;
      while(index<sources.length&&chunk.length<12&&length+sources[index].length<2400){
        chunk.push(sources[index]);
        length+=sources[index].length+3;
        index++;
      }
      chunks.push(chunk);
    }
    const translatedBySource={};
    for(let index=0;index<chunks.length;index+=4){
      const group=chunks.slice(index,index+4);
      const results=await Promise.all(group.map(chunk=>translateInterfaceChunk(language,chunk)));
      group.forEach((chunk,chunkIndex)=>chunk.forEach((source,itemIndex)=>translatedBySource[source]=results[chunkIndex][itemIndex]||source));
    }
    translatedBySource.TEACHERTILES='TEACHERTILES';
    translatedBySource['TEACHERTILES ACCOUNT']='TEACHERTILES ACCOUNT';
    runtimeInterfaceTranslations[language]=translatedBySource;
    writeCachedInterfaceTranslations(language,translatedBySource);
  })().finally(()=>interfaceTranslationRequests.delete(language));
  interfaceTranslationRequests.set(language,request);
  return request;
}

function translateAppText(key){
  const lang=APP_LANGUAGE_CODES.has(appPreferences.language)?appPreferences.language:'en';
  const english=APP_TRANSLATIONS.en[key];
  return APP_TRANSLATIONS[lang]?.[key]||runtimeInterfaceTranslations[lang]?.[english]||english||key;
}

function applyAppLanguage({load=true}={}){
  const lang=APP_LANGUAGE_CODES.has(appPreferences.language)?appPreferences.language:'en';
  document.documentElement.lang=lang;
  document.querySelectorAll('[data-i18n]').forEach(node=>{
    const key=node.getAttribute('data-i18n');
    const value=translateAppText(key);
    if(value)node.textContent=value;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(node=>{
    const key=node.getAttribute('data-i18n-placeholder');
    const value=translateAppText(key);
    if(value)node.setAttribute('placeholder',value);
  });
  document.querySelectorAll('.context-menu__item[data-module]').forEach(item=>{
    const englishCopy=CONTEXT_MODULE_TRANSLATIONS.en[item.dataset.module];
    const copy=CONTEXT_MODULE_TRANSLATIONS[lang]?.[item.dataset.module]||(englishCopy?englishCopy.map(value=>runtimeInterfaceTranslations[lang]?.[value]||value):null);
    if(!copy)return;
    const strong=item.querySelector('strong');
    const small=item.querySelector('small');
    if(strong)strong.textContent=copy[0];
    if(small)small.textContent=copy[1];
  });
  settingsToggle?.setAttribute('aria-label',translateAppText('top.settings'));
  const shelfTitle=document.getElementById('asset-shelf-title');
  if(shelfTitle){
    const stickerPanel=document.getElementById('sticker-shelf-content');
    shelfTitle.textContent=stickerPanel&&!stickerPanel.hidden?translateAppText('top.stickers'):translateAppText('top.themes');
  }
  const settingsTitle=document.getElementById('settings-title');
  const activeSettingsTab=document.querySelector('[data-settings-tab].is-active [data-i18n]');
  if(settingsTitle&&activeSettingsTab)settingsTitle.textContent=activeSettingsTab.textContent.trim();
  window.dispatchEvent(new CustomEvent('teachertiles:languagechange',{detail:{language:lang}}));
  if(load&&lang!=='en'&&lang!=='es'&&!runtimeInterfaceTranslations[lang]){
    document.documentElement.dataset.interfaceLanguageLoading='true';
    loadInterfaceTranslations(lang).then(()=>{
      if(appPreferences.language===lang)applyAppLanguage({load:false});
    }).catch(()=>{}).finally(()=>{
      if(appPreferences.language===lang)delete document.documentElement.dataset.interfaceLanguageLoading;
    });
  }else delete document.documentElement.dataset.interfaceLanguageLoading;
}

function updateSettingsControls(){
  const mute=document.getElementById('settings-ui-sfx-toggle');
  const volume=document.getElementById('settings-ui-volume');
  const volumeOut=document.getElementById('settings-ui-volume-value');
  const scroll=document.getElementById('settings-scroll-speed');
  const scrollOut=document.getElementById('settings-scroll-speed-value');
  const view=document.getElementById('settings-default-view');
  const language=document.getElementById('settings-language');
  if(mute){
    mute.setAttribute('aria-checked',String(Boolean(appPreferences.uiMuted)));
    mute.setAttribute('aria-label',appPreferences.uiMuted?'Turn UI sounds on':'Mute UI sounds');
  }
  if(volume)volume.value=String(appPreferences.uiVolume);
  if(volumeOut)volumeOut.textContent=`${Math.round(appPreferences.uiVolume)}%`;
  if(scroll)scroll.value=String(appPreferences.scrollSpeed);
  if(scrollOut)scrollOut.textContent=`${Math.round(appPreferences.scrollSpeed)}%`;
  if(view)view.value=String(appPreferences.defaultViewSize);
  if(language)language.value=appPreferences.language;
  const volumeRow=volume?.closest('.settings-row');
  if(volumeRow)volumeRow.classList.toggle('is-disabled',Boolean(appPreferences.uiMuted));
}

function setCurrentBoardViewSize(percent){
  if(typeof boardCamera==='undefined')return;
  const next=clamp(Number(percent)/100,BOARD_MIN_ZOOM,BOARD_MAX_ZOOM);
  const cx=innerWidth/2,cy=innerHeight/2;
  const anchor=screenToBoard(cx,cy);
  boardCamera.scale=next;
  boardCamera.x=cx-anchor.x*next;
  boardCamera.y=cy-anchor.y*next;
  applyBoardCamera();
}

function applyAppPreferences(value,{persist=true,notify=false,applyView=false}={}){
  appPreferences=normalizeAppPreferences({...appPreferences,...value});
  uiSfxMuted=appPreferences.uiMuted;
  if(persist)persistAppPreferences();
  updateSettingsControls();
  applyAppLanguage();
  if(applyView)setCurrentBoardViewSize(appPreferences.defaultViewSize);
  if(notify)notifyBoardChanged('preferences');
  return boardPreferenceSnapshot();
}

window.TeacherTilesPreferences={
  get(){return boardPreferenceSnapshot()},
  apply(value,options){return applyAppPreferences(value,options)},
  t:translateAppText
};
window.TeacherTilesI18n={t:translateAppText,get language(){return appPreferences.language},apply:applyAppLanguage};

function setupSettingsHub(){
  const modal=document.getElementById('settings-modal');
  const closeButtons=[...document.querySelectorAll('[data-settings-close]')];
  const tabs=[...document.querySelectorAll('[data-settings-tab]')];
  const panes=[...document.querySelectorAll('[data-settings-pane]')];
  const title=document.getElementById('settings-title');
  const mute=document.getElementById('settings-ui-sfx-toggle');
  const volume=document.getElementById('settings-ui-volume');
  const scroll=document.getElementById('settings-scroll-speed');
  const view=document.getElementById('settings-default-view');
  const language=document.getElementById('settings-language');
  if(!modal||!settingsToggle)return;
  let lastFocus=null;
  let currentTab='settings';

  const updateTitle=()=>{
    const active=tabs.find(tab=>tab.dataset.settingsTab===currentTab);
    const label=active?.lastElementChild?.textContent?.trim();
    if(title&&label)title.textContent=label;
  };

  const showTab=name=>{
    currentTab=name;
    tabs.forEach(tab=>{
      const active=tab.dataset.settingsTab===name;
      tab.classList.toggle('is-active',active);
      tab.setAttribute('aria-selected',String(active));
    });
    panes.forEach(pane=>{
      const active=pane.dataset.settingsPane===name;
      pane.hidden=!active;
      pane.classList.toggle('is-active',active);
    });
    updateTitle();
    window.dispatchEvent(new CustomEvent('teachertiles:settings-tab',{detail:{name}}));
  };
  const close=()=>{
    if(modal.hidden)return;
    modal.hidden=true;
    modal.setAttribute('aria-hidden','true');
    settingsToggle.setAttribute('aria-expanded','false');
    if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});
    lastFocus=null;
  };
  const open=()=>{
    if(!modal.hidden){close();return}
    document.getElementById('asset-shelf-close')?.click();
    document.getElementById('shop-close')?.click();
    document.querySelector('[data-profile-close]')?.click();
    lastFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
    modal.hidden=false;
    modal.setAttribute('aria-hidden','false');
    settingsToggle.setAttribute('aria-expanded','true');
    updateSettingsControls();
    applyAppLanguage();
    updateTitle();
    requestAnimationFrame(()=>modal.querySelector('.settings-panel__close')?.focus({preventScroll:true}));
  };

  settingsToggle.addEventListener('click',open);
  closeButtons.forEach(button=>button.addEventListener('click',close));
  tabs.forEach(tab=>tab.addEventListener('click',()=>showTab(tab.dataset.settingsTab)));
  mute?.addEventListener('click',()=>{
    const wasMuted=appPreferences.uiMuted;
    applyAppPreferences({uiMuted:!wasMuted},{notify:true});
    if(wasMuted)playUiSfx('click');
  });
  volume?.addEventListener('input',()=>{
    appPreferences=normalizeAppPreferences({...appPreferences,uiVolume:Number(volume.value)});
    persistAppPreferences();
    updateSettingsControls();
  });
  volume?.addEventListener('change',()=>notifyBoardChanged('preferences'));
  scroll?.addEventListener('input',()=>{
    appPreferences=normalizeAppPreferences({...appPreferences,scrollSpeed:Number(scroll.value)});
    persistAppPreferences();
    updateSettingsControls();
  });
  scroll?.addEventListener('change',()=>notifyBoardChanged('preferences'));
  view?.addEventListener('change',()=>applyAppPreferences({defaultViewSize:Number(view.value)},{notify:true,applyView:true}));
  language?.addEventListener('change',()=>{applyAppPreferences({language:language.value},{notify:true});updateTitle();setMenuCategory(activeMenuCategory)});

  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!modal.hidden){event.preventDefault();close()}
  });
  document.addEventListener('click',event=>{
    if(modal.hidden)return;
    const target=event.target instanceof Element?event.target.closest('#profile-toggle,#theme-shelf-toggle,#sticker-shelf-toggle,#shop-toggle,#boards-toggle'):null;
    if(target)close();
  },true);

  updateSettingsControls();
  applyAppLanguage();
  showTab('settings');
}

setupSettingsHub();

const BOARD_WIDTH=12000;
const BOARD_HEIGHT=8000;
const boardCamera={x:0,y:0,scale:1};
const BOARD_MIN_ZOOM=.35;
const BOARD_MAX_ZOOM=1.8;
const BOARD_OVERSCROLL=120;
const zoomIndicator=document.getElementById('zoom-indicator');
const boardMinimap=document.getElementById('board-minimap');
const boardMinimapCanvas=document.getElementById('board-minimap-canvas');
let zoomIndicatorTimer=0;
let boardZoomIntentPercent=100;
let boardZoomWheelAt=0;
let boardZoomPrecision=false;
let boardMinimapShowTimer=0;
let boardMinimapHideTimer=0;
let boardMinimapFrame=0;

function drawBoardMinimap(){
  boardMinimapFrame=0;
  if(!boardMinimap?.classList.contains('is-visible')||!boardMinimapCanvas)return;
  const ctx=boardMinimapCanvas.getContext('2d');
  if(!ctx)return;
  const width=boardMinimapCanvas.width,height=boardMinimapCanvas.height,pad=12;
  const scale=Math.min((width-pad*2)/BOARD_WIDTH,(height-pad*2)/BOARD_HEIGHT);
  const boardWidth=BOARD_WIDTH*scale,boardHeight=BOARD_HEIGHT*scale;
  const ox=(width-boardWidth)/2,oy=(height-boardHeight)/2;
  const bodyStyle=getComputedStyle(document.body);
  const background=bodyStyle.getPropertyValue('--bg').trim()||'#edf1f5';
  const surface=bodyStyle.getPropertyValue('--surface-solid').trim()||'#ffffff';
  const accent=bodyStyle.getPropertyValue('--accent').trim()||'#4c8ed9';
  const text=bodyStyle.getPropertyValue('--text').trim()||'#17191d';
  ctx.clearRect(0,0,width,height);
  ctx.fillStyle=surface;ctx.fillRect(0,0,width,height);
  ctx.fillStyle=background;ctx.fillRect(ox,oy,boardWidth,boardHeight);

  for(const module of workspace.querySelectorAll('.module')){
    const left=Number.parseFloat(module.style.left)||module.offsetLeft;
    const top=Number.parseFloat(module.style.top)||module.offsetTop;
    const moduleWidth=Number.parseFloat(module.style.width)||module.offsetWidth;
    const moduleHeight=Number.parseFloat(module.style.height)||module.offsetHeight;
    ctx.globalAlpha=module.dataset.type==='sticker'?.62:.82;
    ctx.fillStyle=module.dataset.type==='sticker'?'#f2b84b':accent;
    ctx.fillRect(ox+left*scale,oy+top*scale,Math.max(3,moduleWidth*scale),Math.max(3,moduleHeight*scale));
  }
  ctx.globalAlpha=1;

  const bounds=visibleBoardBounds();
  const left=clamp(bounds.left,0,BOARD_WIDTH);
  const top=clamp(bounds.top,0,BOARD_HEIGHT);
  const right=clamp(bounds.right,0,BOARD_WIDTH);
  const bottom=clamp(bounds.bottom,0,BOARD_HEIGHT);
  ctx.fillStyle='rgba(255,255,255,.13)';
  ctx.strokeStyle=text;
  ctx.lineWidth=4;
  ctx.fillRect(ox+left*scale,oy+top*scale,Math.max(8,(right-left)*scale),Math.max(8,(bottom-top)*scale));
  ctx.strokeRect(ox+left*scale,oy+top*scale,Math.max(8,(right-left)*scale),Math.max(8,(bottom-top)*scale));
  ctx.strokeStyle='rgba(255,255,255,.62)';
  ctx.lineWidth=1.5;
  ctx.strokeRect(ox+left*scale+2,oy+top*scale+2,Math.max(4,(right-left)*scale-4),Math.max(4,(bottom-top)*scale-4));
}

function requestBoardMinimapDraw(){
  if(boardMinimapFrame||!boardMinimap?.classList.contains('is-visible'))return;
  boardMinimapFrame=requestAnimationFrame(drawBoardMinimap);
}

function showBoardMinimap(){
  if(!boardMinimap)return;
  clearTimeout(boardMinimapHideTimer);
  boardMinimap.classList.add('is-visible');
  boardMinimap.setAttribute('aria-hidden','false');
  requestBoardMinimapDraw();
}

function beginBoardMinimapDelay(){
  clearTimeout(boardMinimapShowTimer);
  clearTimeout(boardMinimapHideTimer);
  boardMinimapShowTimer=setTimeout(showBoardMinimap,700);
}

function scheduleBoardMinimapHide(delay=1100){
  clearTimeout(boardMinimapShowTimer);
  clearTimeout(boardMinimapHideTimer);
  boardMinimapShowTimer=0;
  boardMinimapHideTimer=setTimeout(()=>{
    boardMinimap?.classList.remove('is-visible');
    boardMinimap?.setAttribute('aria-hidden','true');
  },delay);
}

function centerBoardFromMinimapPointer(event){
  if(!boardMinimapCanvas)return;
  const rect=boardMinimapCanvas.getBoundingClientRect();
  const canvasX=(event.clientX-rect.left)/rect.width*boardMinimapCanvas.width;
  const canvasY=(event.clientY-rect.top)/rect.height*boardMinimapCanvas.height;
  const x=clamp((canvasX-12)/(boardMinimapCanvas.width-24),0,1)*BOARD_WIDTH;
  const y=clamp((canvasY-12)/(boardMinimapCanvas.height-24),0,1)*BOARD_HEIGHT;
  boardCamera.x=innerWidth/2-x*boardCamera.scale;
  boardCamera.y=innerHeight/2-y*boardCamera.scale;
  applyBoardCamera();
}

boardMinimapCanvas?.addEventListener('pointerdown',event=>{
  if(event.button!==0)return;
  event.preventDefault();
  clearTimeout(boardMinimapHideTimer);
  boardMinimap?.classList.add('is-dragging');
  boardMinimapCanvas.setPointerCapture(event.pointerId);
  centerBoardFromMinimapPointer(event);
  const move=next=>centerBoardFromMinimapPointer(next);
  const end=()=>{
    boardMinimap?.classList.remove('is-dragging');
    boardMinimapCanvas.removeEventListener('pointermove',move);
    boardMinimapCanvas.removeEventListener('pointerup',end);
    boardMinimapCanvas.removeEventListener('pointercancel',end);
    scheduleBoardMinimapHide(1300);
  };
  boardMinimapCanvas.addEventListener('pointermove',move);
  boardMinimapCanvas.addEventListener('pointerup',end);
  boardMinimapCanvas.addEventListener('pointercancel',end);
});

function showZoomIndicator(scale=boardCamera.scale,{precise=boardZoomPrecision}={}){
  if(!zoomIndicator)return;
  zoomIndicator.replaceChildren();
  const value=document.createElement('strong');
  value.textContent=`${Math.round(scale*100)}%`;
  zoomIndicator.appendChild(value);
  if(precise){
    const hint=document.createElement('small');
    hint.textContent='SHIFT · 1% STEPS';
    zoomIndicator.appendChild(hint);
  }
  zoomIndicator.classList.toggle('is-precise',precise);
  zoomIndicator.classList.add('is-visible');
  clearTimeout(zoomIndicatorTimer);
  if(!precise)zoomIndicatorTimer=setTimeout(()=>zoomIndicator.classList.remove('is-visible'),720);
}

workspace.style.width=`${BOARD_WIDTH}px`;
workspace.style.height=`${BOARD_HEIGHT}px`;
workspace.style.transformOrigin='0 0';
workspace.spellcheck=false;
workspace.setAttribute('spellcheck','false');

function clampBoardCamera(){
  const scaledW=BOARD_WIDTH*boardCamera.scale;
  const scaledH=BOARD_HEIGHT*boardCamera.scale;
  const minX=Math.min(BOARD_OVERSCROLL,innerWidth-scaledW-BOARD_OVERSCROLL);
  const minY=Math.min(BOARD_OVERSCROLL,innerHeight-scaledH-BOARD_OVERSCROLL);
  boardCamera.x=clamp(boardCamera.x,minX,BOARD_OVERSCROLL);
  boardCamera.y=clamp(boardCamera.y,minY,BOARD_OVERSCROLL);
}
function applyBoardCamera(){
  clampBoardCamera();
  const pixelRatio=window.devicePixelRatio||1;
  const renderedX=Math.round(boardCamera.x*pixelRatio)/pixelRatio;
  const renderedY=Math.round(boardCamera.y*pixelRatio)/pixelRatio;
  workspace.style.transform=`translate(${renderedX}px,${renderedY}px) scale(${boardCamera.scale})`;
  workspace.style.setProperty('--board-zoom',boardCamera.scale);
  requestAnimationFrame(()=>updateWorkspaceEmptyState());
  requestBoardMinimapDraw();
  notifyBoardChanged('camera');
}
function screenToBoard(clientX,clientY){
  return{x:(clientX-boardCamera.x)/boardCamera.scale,y:(clientY-boardCamera.y)/boardCamera.scale};
}
function visibleBoardBounds(){
  const tl=screenToBoard(0,0),br=screenToBoard(innerWidth,innerHeight);
  return{left:tl.x,top:tl.y,right:br.x,bottom:br.y};
}
function centerBoardCamera(){
  boardCamera.x=(innerWidth-BOARD_WIDTH*boardCamera.scale)/2;
  boardCamera.y=(innerHeight-BOARD_HEIGHT*boardCamera.scale)/2;
  applyBoardCamera();
}
centerBoardCamera();

workspace.addEventListener('wheel',e=>{
  if(e.ctrlKey)return;
  e.preventDefault();
  const wheelDelta=e.deltaY||e.deltaX;
  if(!wheelDelta)return;
  const now=performance.now();
  let next;
  if(e.shiftKey){
    boardZoomPrecision=true;
    boardZoomIntentPercent=Math.round(boardCamera.scale*100);
    boardZoomWheelAt=now;
    const nextPercent=clamp(boardZoomIntentPercent+(wheelDelta<0?1:-1),BOARD_MIN_ZOOM*100,BOARD_MAX_ZOOM*100);
    boardZoomIntentPercent=nextPercent;
    next=nextPercent/100;
  }else{
    boardZoomPrecision=false;
    if(now-boardZoomWheelAt>220)boardZoomIntentPercent=Math.round(boardCamera.scale*100);
    boardZoomWheelAt=now;
    const delta=e.deltaMode===1?wheelDelta*16:e.deltaMode===2?wheelDelta*innerHeight:wheelDelta;
    boardZoomIntentPercent=clamp(boardZoomIntentPercent-delta*.12*(appPreferences.scrollSpeed/100),BOARD_MIN_ZOOM*100,BOARD_MAX_ZOOM*100);
    next=clamp(Math.round(boardZoomIntentPercent)/100,BOARD_MIN_ZOOM,BOARD_MAX_ZOOM);
  }
  showZoomIndicator(next,{precise:e.shiftKey});
  if(Math.abs(next-boardCamera.scale)<.0001)return;
  const anchor=screenToBoard(e.clientX,e.clientY);
  boardCamera.scale=next;
  boardCamera.x=e.clientX-anchor.x*next;
  boardCamera.y=e.clientY-anchor.y*next;
  applyBoardCamera();
},{passive:false});

window.addEventListener('keydown',event=>{
  if(event.key!=='Shift'||event.repeat)return;
  boardZoomPrecision=true;
  showZoomIndicator(boardCamera.scale,{precise:true});
});
window.addEventListener('keyup',event=>{
  if(event.key!=='Shift')return;
  boardZoomPrecision=false;
  showZoomIndicator(boardCamera.scale,{precise:false});
});
window.addEventListener('blur',()=>{
  boardZoomPrecision=false;
  zoomIndicator?.classList.remove('is-precise','is-visible');
});

window.addEventListener('keydown',event=>{
  if(event.code!=='Space'||event.repeat||event.ctrlKey||event.metaKey||event.altKey)return;
  const target=event.target instanceof Element?event.target:null;
  if(isTypingTarget(target)||isTypingTarget(document.activeElement))return;
  const flashcard=target?.closest(SPACEBAR_FLASHCARD_SELECTOR)||null;
  if(flashcard&&flashcard===activeSpacebarFlashcard)return;
  if(target?.closest('.module')&&!flashcard)return;
  const interactive=target?.closest('button,a,[role="button"],[role="slider"],[role="checkbox"],[role="radio"]');
  if(interactive&&lastUiInteractionWasKeyboard&&!flashcard)return;
  if(boardKeyboardPanBlocked())return;
  event.preventDefault();
  event.stopPropagation();
  const defaultScale=clamp((Number(appPreferences.defaultViewSize)||100)/100,BOARD_MIN_ZOOM,BOARD_MAX_ZOOM);
  setCurrentBoardViewSize(appPreferences.defaultViewSize);
  boardZoomIntentPercent=Math.round(defaultScale*100);
  showZoomIndicator(defaultScale,{precise:false});
},{capture:true});

function beginBoardPan(e){
  closeMenu();
  e.preventDefault();
  workspace.classList.add('is-panning');
  workspace.setPointerCapture(e.pointerId);
  const sx=e.clientX,sy=e.clientY,startX=boardCamera.x,startY=boardCamera.y;
  let minimapDelayStarted=false;
  const move=ev=>{
    if(!minimapDelayStarted&&Math.hypot(ev.clientX-sx,ev.clientY-sy)>=5){
      minimapDelayStarted=true;
      beginBoardMinimapDelay();
    }
    boardCamera.x=startX+(ev.clientX-sx);
    boardCamera.y=startY+(ev.clientY-sy);
    applyBoardCamera();
  };
  const end=()=>{
    workspace.classList.remove('is-panning');
    scheduleBoardMinimapHide();
    workspace.removeEventListener('pointermove',move);
    workspace.removeEventListener('pointerup',end);
    workspace.removeEventListener('pointercancel',end);
  };
  workspace.addEventListener('pointermove',move);
  workspace.addEventListener('pointerup',end);
  workspace.addEventListener('pointercancel',end);
}

const boardPanKeys=new Set();
let boardKeyboardPanFrame=0;
let boardKeyboardPanTime=0;
const BOARD_KEYBOARD_PAN_SPEED=720;
const boardPanKeyDirection={
  arrowup:[0,1],
  arrowdown:[0,-1],
  arrowleft:[1,0],
  arrowright:[-1,0]
};

function boardKeyboardPanBlocked(){
  if(isTypingTarget(document.activeElement))return true;
  const shop=document.getElementById('shop-modal');
  if(shop&&!shop.hidden)return true;
  const profile=document.getElementById('profile-modal');
  if(profile&&!profile.hidden)return true;
  const settings=document.getElementById('settings-modal');
  if(settings&&!settings.hidden)return true;
  const boards=document.getElementById('boards-view');
  if(boards&&!boards.hidden)return true;
  return false;
}

function stopBoardKeyboardPan(){
  boardPanKeys.clear();
  if(boardKeyboardPanFrame)cancelAnimationFrame(boardKeyboardPanFrame);
  boardKeyboardPanFrame=0;
  boardKeyboardPanTime=0;
  workspace.classList.remove('is-keyboard-panning');
}

function runBoardKeyboardPan(now){
  if(!boardPanKeys.size||boardKeyboardPanBlocked()){stopBoardKeyboardPan();return}
  if(!boardKeyboardPanTime)boardKeyboardPanTime=now;
  const dt=Math.min(.04,(now-boardKeyboardPanTime)/1000);
  boardKeyboardPanTime=now;
  let dx=0,dy=0;
  for(const key of boardPanKeys){
    const dir=boardPanKeyDirection[key];
    if(dir){dx+=dir[0];dy+=dir[1]}
  }
  if(dx||dy){
    if(dx&&dy){const inv=Math.SQRT1_2;dx*=inv;dy*=inv}
    boardCamera.x+=dx*BOARD_KEYBOARD_PAN_SPEED*dt;
    boardCamera.y+=dy*BOARD_KEYBOARD_PAN_SPEED*dt;
    applyBoardCamera();
  }
  boardKeyboardPanFrame=requestAnimationFrame(runBoardKeyboardPan);
}

function startBoardKeyboardPan(key){
  boardPanKeys.add(key);
  workspace.classList.add('is-keyboard-panning');
  if(!boardKeyboardPanFrame){
    boardKeyboardPanTime=0;
    boardKeyboardPanFrame=requestAnimationFrame(runBoardKeyboardPan);
  }
}

window.addEventListener('blur',stopBoardKeyboardPan);
document.addEventListener('keyup',e=>{
  const key=e.key.toLowerCase();
  if(!boardPanKeyDirection[key])return;
  boardPanKeys.delete(key);
  if(!boardPanKeys.size)stopBoardKeyboardPan();
});

const selectionMarquee=document.createElement('div');
selectionMarquee.className='board-selection-marquee';
selectionMarquee.setAttribute('aria-hidden','true');
selectionMarquee.hidden=true;
document.body.appendChild(selectionMarquee);

function beginBoardSelection(e){
  if(e.button!==0||!e.shiftKey||e.target!==workspace)return;
  closeMenu();
  e.preventDefault();
  workspace.setPointerCapture(e.pointerId);
  const sx=e.clientX,sy=e.clientY;
  const base=new Set();
  clearSelection();
  let dragging=false;

  const draw=ev=>{
    const left=Math.min(sx,ev.clientX),top=Math.min(sy,ev.clientY);
    const right=Math.max(sx,ev.clientX),bottom=Math.max(sy,ev.clientY);
    Object.assign(selectionMarquee.style,{left:`${left}px`,top:`${top}px`,width:`${right-left}px`,height:`${bottom-top}px`});
    const hits=[];
    for(const m of workspace.querySelectorAll('.module')){
      const r=m.getBoundingClientRect();
      if(r.right>=left&&r.left<=right&&r.bottom>=top&&r.top<=bottom)hits.push(m);
    }
    clearSelection();
    for(const m of base)selectModule(m);
    for(const m of hits)selectModule(m);
  };

  const move=ev=>{
    if(!dragging&&Math.hypot(ev.clientX-sx,ev.clientY-sy)<4)return;
    if(!dragging){dragging=true;selectionMarquee.hidden=false;document.body.classList.add('is-board-selecting')}
    draw(ev);
  };
  const cleanup=()=>{
    selectionMarquee.hidden=true;
    selectionMarquee.style.width='0px';
    selectionMarquee.style.height='0px';
    document.body.classList.remove('is-board-selecting');
    workspace.removeEventListener('pointermove',move);
    workspace.removeEventListener('pointerup',end);
    workspace.removeEventListener('pointercancel',cancel);
  };
  const end=ev=>{if(dragging)draw(ev);cleanup()};
  const cancel=()=>cleanup();
  workspace.addEventListener('pointermove',move);
  workspace.addEventListener('pointerup',end);
  workspace.addEventListener('pointercancel',cancel);
}

workspace.addEventListener('pointerdown',e=>{
  if(e.target instanceof Element&&e.target.classList.contains('board-drawing-canvas'))return;
  if(e.button===1){beginBoardPan(e);return}
  if(e.button===0&&e.target===workspace){
    if(e.shiftKey)beginBoardSelection(e);
    else beginBoardPan(e);
  }
},true);

workspace.addEventListener('auxclick',e=>{
  if(e.button===1)e.preventDefault();
});

let boardClipboard=null;
let boardClipboardPasteCount=0;

function cloneBoardClipboardValue(value){
  if(typeof structuredClone==='function'){
    try{return structuredClone(value)}catch{}
  }
  return JSON.parse(JSON.stringify(value));
}

function selectedBoardModules(){
  return [...workspace.querySelectorAll('.module')]
    .filter(module=>selectedModules.has(module))
    .sort((a,b)=>(Number(a.style.zIndex)||0)-(Number(b.style.zIndex)||0));
}

function copyBoardSelection(){
  const modules=selectedBoardModules();
  if(!modules.length)return false;
  const objects=modules.map(serializeBoardModule).filter(Boolean);
  if(!objects.length)return false;
  boardClipboard={
    schemaVersion:BOARD_SAVE_SCHEMA_VERSION,
    objects:cloneBoardClipboardValue(objects)
  };
  boardClipboardPasteCount=0;
  return true;
}

function boardDuplicateOffset(objects,distance=34){
  if(!objects.length)return{x:distance,y:distance};
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  for(const object of objects){
    const t=object?.transform||{};
    const l=Number(t.left)||0;
    const tt=Number(t.top)||0;
    const w=Math.max(1,Number(t.width)||160);
    const h=Math.max(1,Number(t.height)||120);
    left=Math.min(left,l);top=Math.min(top,tt);right=Math.max(right,l+w);bottom=Math.max(bottom,tt+h);
  }
  let x=distance,y=distance;
  if(right+x>BOARD_WIDTH&&left-distance>=0)x=-distance;
  if(bottom+y>BOARD_HEIGHT&&top-distance>=0)y=-distance;
  return{x,y};
}

function duplicateBoardObjects(objects,{distance=34,record=true}={}){
  if(!Array.isArray(objects)||!objects.length)return[];
  const source=cloneBoardClipboardValue(objects);
  const offset=boardDuplicateOffset(source,distance);
  const snapGroupCounts=new Map();
  for(const state of source){
    const id=state?.dataset?.snapGroup;
    if(id)snapGroupCounts.set(id,(snapGroupCounts.get(id)||0)+1);
  }
  const duplicatedSnapGroups=new Map();
  const states=source.map(state=>{
    const next=cloneBoardClipboardValue(state);
    next.id=makeBoardObjectId();
    delete next.zIndex;
    const priorGroup=next?.dataset?.snapGroup;
    if(priorGroup){
      if((snapGroupCounts.get(priorGroup)||0)<2)delete next.dataset.snapGroup;
      else{
        if(!duplicatedSnapGroups.has(priorGroup))duplicatedSnapGroups.set(priorGroup,makeSnapGroupId());
        next.dataset.snapGroup=duplicatedSnapGroups.get(priorGroup);
      }
    }
    const t=next.transform||{};
    const width=Math.max(1,Number(t.width)||160);
    const height=Math.max(1,Number(t.height)||120);
    next.transform={
      ...t,
      left:clamp((Number(t.left)||0)+offset.x,0,BOARD_WIDTH-width),
      top:clamp((Number(t.top)||0)+offset.y,0,BOARD_HEIGHT-height),
      width,
      height
    };
    return next;
  });

  const created=[];
  withBoardChangesSuspended(()=>{
    for(const state of states){
      try{
        const module=restoreTeacherTilesBoardObject(state);
        if(module){bringToFront(module);created.push(module)}
      }catch(error){
        console.warn('TeacherTiles could not duplicate board object',state?.type,error);
      }
    }
  });

  if(!created.length)return[];
  normalizeSnapGroups();
  selectModules(created);
  if(record)recordHistory({type:'add',elements:created});
  updateWorkspaceEmptyState();
  return created;
}

function pasteBoardClipboard(){
  if(!boardClipboard?.objects?.length)return[];
  boardClipboardPasteCount+=1;
  return duplicateBoardObjects(boardClipboard.objects,{distance:34*Math.min(boardClipboardPasteCount,8)});
}

function duplicateBoardSelection(){
  const modules=selectedBoardModules();
  if(!modules.length)return[];
  const objects=modules.map(serializeBoardModule).filter(Boolean);
  return duplicateBoardObjects(objects,{distance:34});
}

document.addEventListener('keydown',e=>{
  if(isTypingTarget(e.target)||isTypingTarget(document.activeElement))return;
  const command=e.ctrlKey||e.metaKey;
  const key=e.key.toLowerCase();
  if(command&&!e.altKey&&!e.shiftKey&&key==='c'){
    if(selectedModules.size){
      e.preventDefault();
      copyBoardSelection();
    }
    return;
  }
  if(command&&!e.altKey&&!e.shiftKey&&key==='v'){
    if(boardClipboard?.objects?.length){
      e.preventDefault();
      pasteBoardClipboard();
    }
    return;
  }
  if(command&&!e.altKey&&!e.shiftKey&&key==='d'){
    e.preventDefault();
    if(selectedModules.size)duplicateBoardSelection();
    return;
  }
  if(command&&!e.altKey&&key==='a'&&!boardKeyboardPanBlocked()){
    e.preventDefault();
    const modules=[...workspace.querySelectorAll('.module')];
    const allSelected=modules.length>0&&modules.every(module=>selectedModules.has(module));
    if(allSelected){
      clearSelection();
    }else{
      clearSelection();
      for(const module of modules)selectModule(module);
    }
    return;
  }
  if(command&&!e.altKey&&(key==='z'||key==='y')){
    e.preventDefault();
    if(key==='y'||(key==='z'&&e.shiftKey))redoBoardAction();
    else undoBoardAction();
    return;
  }
  if((e.key==='Delete'||e.key==='Backspace')&&selectedModules.size){
    e.preventDefault();
    deleteModules([...selectedModules]);
    return;
  }
  if(!command&&!e.altKey&&boardPanKeyDirection[key]&&!boardKeyboardPanBlocked()){
    e.preventDefault();
    startBoardKeyboardPan(key);
  }
});

window.addEventListener('resize',applyBoardCamera);


workspace.addEventListener('contextmenu',e=>{e.preventDefault();spawn=screenToBoard(e.clientX,e.clientY);if(menuSearch)menuSearch.value='';setMenuCategoryDrawer(false);setMenuCategory('all');menu.classList.remove('is-open');void menu.offsetWidth;menu.style.left=`${e.clientX}px`;menu.style.top=`${e.clientY}px`;menu.classList.add('is-open');const r=menu.getBoundingClientRect();menu.style.left=`${clamp(e.clientX,8,innerWidth-r.width-8)}px`;menu.style.top=`${clamp(e.clientY,8,innerHeight-r.height-8)}px`;menu.setAttribute('aria-hidden','false')});
document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target))closeMenu()});

document.addEventListener('pointerdown',e=>{
  if(e.button!==0||!selectedModules.size)return;
  const target=e.target instanceof Element?e.target:null;
  const module=target?.closest('.module');
  if(module&&selectedModules.has(module))return;
  clearSelection();
},true);

const menuSearch=menu.querySelector('#context-menu-search');
const menuSearchClear=menu.querySelector('.context-menu__search-clear');
const menuNoResults=menu.querySelector('.context-menu__no-results');
const menuItems=[...menu.querySelectorAll('.context-menu__item[data-category]')];
const menuCategoryCycle=menu.querySelector('.context-menu__category-cycle');
const menuCategoryCycleLabel=menu.querySelector('.context-menu__category-cycle-label');
const menuDrawerFilters=[...menu.querySelectorAll('[data-category-drawer-filter]')];
const menuCategoryDrawer=menu.querySelector('.context-menu__category-drawer');
const menuCategoryDrawerToggle=menuCategoryCycle;
const menuCategoryDrawerClose=menu.querySelector('.context-menu__category-drawer-close');
let activeMenuCategory='all';
const menuCategoryOrder=['all','text','media','tools','time','audio','games','planning','pbis','accessibility','language','literacy','math','science','geography','sel'];

function menuCategoryLabel(category){
  return translateAppText(category==='all'?'context.all':`context.cat.${category}`);
}

function normalizeMenuSearch(value=''){
  return value.toLowerCase().trim().replace(/\s+/g,' ');
}

function applyMenuView(){
  const query=normalizeMenuSearch(menuSearch?.value);
  const searching=Boolean(query);
  menu.classList.toggle('is-searching',searching);
  if(searching)setMenuCategoryDrawer(false);
  menuSearchClear?.classList.toggle('is-visible',searching);

  let visibleCount=0;
  menuItems.forEach(item=>{
    const searchable=[
      item.querySelector('strong')?.textContent||'',
      item.querySelector('small')?.textContent||'',
      item.dataset.module||'',
      item.dataset.category||''
    ].join(' ').toLowerCase();

    const matchesSearch=!searching||searchable.includes(query);
    const categories=(item.dataset.category||'').split(/\s+/).filter(Boolean);
    const matchesCategory=activeMenuCategory==='all'||categories.includes(activeMenuCategory);
    const visible=searching?matchesSearch:matchesCategory;
    item.hidden=!visible;
    if(visible)visibleCount++;
  });

  if(menuNoResults)menuNoResults.hidden=!searching||visibleCount>0;
  const list=menu.querySelector('.context-menu__list');
  if(list)list.scrollTop=0;
}

function setMenuCategory(category='all'){
  activeMenuCategory=menuCategoryOrder.includes(category)?category:'all';
  const label=menuCategoryLabel(activeMenuCategory);
  if(menuCategoryCycleLabel)menuCategoryCycleLabel.textContent=label;
  if(menuCategoryCycle){
    menuCategoryCycle.setAttribute('aria-label',`Current category: ${label}. Open category menu.`);
  }
  menuDrawerFilters.forEach(b=>b.classList.toggle('is-active',b.dataset.categoryDrawerFilter===activeMenuCategory));
  applyMenuView();
}

function syncMenuCategoryDrawerLayout(){
  if(!menuCategoryDrawer||!menuDrawerFilters.length)return;
  const categoryButtons=menuDrawerFilters.filter(button=>button.dataset.categoryDrawerFilter!=='all');
  const sample=categoryButtons[0];
  if(!sample)return;

  const style=getComputedStyle(sample);
  const canvas=syncMenuCategoryDrawerLayout.canvas||(syncMenuCategoryDrawerLayout.canvas=document.createElement('canvas'));
  const context=canvas.getContext('2d');
  let longestLabel=0;
  if(context){
    context.font=`${style.fontStyle} ${style.fontVariant} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const letterSpacing=Number.parseFloat(style.letterSpacing)||0;
    categoryButtons.forEach(button=>{
      const label=(button.textContent||'').trim();
      longestLabel=Math.max(longestLabel,context.measureText(label).width+Math.max(0,label.length-1)*letterSpacing);
    });
  }

  const viewportWidth=Math.max(0,window.innerWidth-16);
  const menuWidth=menu.getBoundingClientRect().width||268;
  const columnWidth=Math.max(72,Math.ceil(longestLabel+22));
  const desiredWidth=Math.max(menuWidth,columnWidth*3+30);
  const drawerWidth=Math.min(viewportWidth,400,desiredWidth);
  menu.style.setProperty('--category-drawer-width',`${drawerWidth}px`);

  const menuRect=menu.getBoundingClientRect();
  const railRect=menuCategoryDrawer.parentElement?.getBoundingClientRect()||menuRect;
  const centeredLeft=menuRect.left+(menuRect.width-drawerWidth)/2;
  const viewportLeft=clamp(centeredLeft,8,Math.max(8,window.innerWidth-drawerWidth-8));
  menu.style.setProperty('--category-drawer-offset',`${Math.round(viewportLeft-railRect.left)}px`);
}

function setMenuCategoryDrawer(open){
  const show=Boolean(open);
  if(show)syncMenuCategoryDrawerLayout();
  menu.classList.toggle('has-category-drawer',show);
  menuCategoryDrawerToggle?.setAttribute('aria-expanded',String(show));
  menuCategoryDrawer?.setAttribute('aria-hidden',String(!show));
  menu.classList.remove('category-drawer-left');
}

function clearMenuSearch(){
  if(!menuSearch)return;
  menuSearch.value='';
  applyMenuView();
}

menuCategoryCycle?.addEventListener('click',event=>{
  event.stopPropagation();
  setMenuCategoryDrawer(!menu.classList.contains('has-category-drawer'));
});
menuDrawerFilters.forEach(b=>b.addEventListener('click',e=>{
  e.stopPropagation();
  setMenuCategory(b.dataset.categoryDrawerFilter);
  setMenuCategoryDrawer(false);
}));
menuCategoryDrawerClose?.addEventListener('click',event=>{event.stopPropagation();setMenuCategoryDrawer(false)});

menuSearch?.addEventListener('input',applyMenuView);
menuSearch?.addEventListener('pointerdown',e=>e.stopPropagation());
menuSearch?.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    e.stopPropagation();
    if(menu.classList.contains('has-category-drawer')){
      setMenuCategoryDrawer(false);
    }else if(menuSearch.value){
      clearMenuSearch();
    }else{
      closeMenu();
    }
  }
});
menuSearchClear?.addEventListener('click',e=>{
  e.stopPropagation();
  clearMenuSearch();
  menuSearch?.focus();
});

setMenuCategory('all');
window.addEventListener('resize',()=>{if(menu.classList.contains('has-category-drawer'))syncMenuCategoryDrawerLayout()});
window.addEventListener('teachertiles:languagechange',()=>requestAnimationFrame(syncMenuCategoryDrawerLayout));

function closeMenu(){
  setMenuCategoryDrawer(false);
  menu.classList.remove('is-open');
  menu.setAttribute('aria-hidden','true');
}
menu.addEventListener('click',e=>{const b=e.target.closest('[data-module]');if(!b)return;createModule(b.dataset.module,spawn.x,spawn.y);closeMenu()});

const TILE_SKIN_CATALOG=Object.freeze([
  Object.freeze({
    id:'magnifier-classic',
    productId:'tile-skin-magnifier-classic',
    tileType:'magnifier',
    tileLabel:'Magnifier',
    name:'Classic Magnifying Glass',
    description:'The original round lens with a steel rim and angled handle.',
    tags:'accessibility lens glass round classic original',
    released:1
  }),
  Object.freeze({
    id:'youtube-retro-tv',productId:'tile-skin-youtube-retro-tv',tileType:'youtube',tileLabel:'YouTube',
    name:'Vintage Television',description:'A woodgrain television with rounded glass, speaker vents, and tuning knobs.',
    tags:'youtube video tv television retro vintage old fashioned wood',released:2
  }),
  Object.freeze({
    id:'todo-clipboard',productId:'tile-skin-todo-clipboard',tileType:'todo',tileLabel:'To-Do',
    name:'Classroom Clipboard',description:'A paper checklist clipped onto a warm wooden board.',
    tags:'todo to-do checklist clipboard paper classroom office',released:3
  }),
  Object.freeze({
    id:'calendar-paper-stack',productId:'tile-skin-calendar-paper-stack',tileType:'calendar',tileLabel:'Calendar',
    name:'Page-Stack Calendar',description:'A bound paper calendar with dimensional pages layered underneath.',
    tags:'calendar paper pages stack realistic bound depth',released:4
  })
]);
const CURSOR_COLOR_PACK_PRODUCT_ID='cursor-color-pack';
const CURSOR_CATALOG=Object.freeze([
  Object.freeze({id:'default',productId:'',name:'System Default',description:'Use your normal device cursor.',color:'#252a31'}),
  Object.freeze({id:'blue',productId:CURSOR_COLOR_PACK_PRODUCT_ID,name:'Electric Blue',description:'Bright and crisp.',color:'#3182f6'}),
  Object.freeze({id:'red',productId:CURSOR_COLOR_PACK_PRODUCT_ID,name:'Cherry Red',description:'Bold classroom red.',color:'#ef4444'}),
  Object.freeze({id:'green',productId:CURSOR_COLOR_PACK_PRODUCT_ID,name:'Marker Green',description:'Lively marker green.',color:'#22a860'}),
  Object.freeze({id:'purple',productId:CURSOR_COLOR_PACK_PRODUCT_ID,name:'Violet',description:'Rich violet purple.',color:'#8b5cf6'}),
  Object.freeze({id:'gold',productId:CURSOR_COLOR_PACK_PRODUCT_ID,name:'Golden Chalk',description:'Warm golden yellow.',color:'#e2a51f'})
]);
const TILE_SKIN_DEFAULTS_KEY='teacherTilesDefaultTileSkins';
const ACTIVE_CURSOR_KEY='teacherTilesActiveCursor';
const SHOP_OWNED_PRODUCTS_KEY='teacherTilesOwnedShopPacks';
const stickerCatalogItems=(entries,tags='')=>Object.freeze(entries.map(([emoji,name])=>Object.freeze({emoji,name,tags})));
const ADDITIONAL_STICKER_PACKS=Object.freeze([
  Object.freeze({id:'faces-happy',productId:'sticker-faces-happy',category:'faces',name:'Happy Faces',description:'Eight cheerful smiles for celebrations and encouragement.',tags:'emoji emojis face faces happy smile smiles cheerful positive reaction emotion',price:180,items:stickerCatalogItems([['😄','Smiling face with open mouth'],['😁','Beaming face'],['😊','Smiling face with smiling eyes'],['🙂','Slightly smiling face'],['😇','Smiling face with halo'],['😌','Relieved face'],['☺️','Smiling face'],['🥰','Smiling face with hearts']])}),
  Object.freeze({id:'faces-silly',productId:'sticker-faces-silly',category:'faces',name:'Silly Faces',description:'Eight playful reactions for fun classroom moments.',tags:'emoji emojis face faces silly playful funny reaction expression emotion',price:180,items:stickerCatalogItems([['😛','Face with tongue'],['😜','Winking face with tongue'],['😝','Squinting face with tongue'],['🤭','Face with hand over mouth'],['🤫','Shushing face'],['🤗','Hugging face'],['🫠','Melting face'],['🙃','Upside-down face']])}),
  Object.freeze({id:'faces-worried',productId:'sticker-faces-worried',category:'faces',name:'Worried Faces',description:'Eight concerned and frustrated expressions.',tags:'emoji emojis face faces worried concern sad frustrated reaction expression emotion',price:180,items:stickerCatalogItems([['😟','Worried face'],['😕','Confused face'],['🙁','Slightly frowning face'],['☹️','Frowning face'],['😣','Persevering face'],['😖','Confounded face'],['😫','Tired face'],['😩','Weary face']])}),
  Object.freeze({id:'faces-big-reactions',productId:'sticker-faces-big-reactions',category:'faces',name:'Big Reactions',description:'Eight surprised, amazed, and dramatic expressions.',tags:'emoji emojis face faces surprised amazed shocked dramatic reaction expression emotion',price:180,items:stickerCatalogItems([['😮','Face with open mouth'],['😯','Hushed face'],['😲','Astonished face'],['😳','Flushed face'],['🥺','Pleading face'],['😱','Face screaming in fear'],['🤯','Exploding head'],['🥶','Cold face']])}),
  Object.freeze({id:'food-fruit',productId:'sticker-food-fruit',category:'food',name:'Fresh Fruit',description:'Eight colorful fruits for snacks, charts, and rewards.',tags:'food foods fruit fruits fresh snack healthy',price:180,items:stickerCatalogItems([['🍏','Green apple'],['🍐','Pear'],['🍊','Tangerine'],['🍋','Lemon'],['🍌','Banana'],['🍉','Watermelon'],['🍇','Grapes'],['🫐','Blueberries']])}),
  Object.freeze({id:'food-vegetables',productId:'sticker-food-vegetables',category:'food',name:'Vegetables',description:'Eight garden vegetables and healthy classroom favorites.',tags:'food foods vegetable vegetables veggie veggies garden healthy',price:180,items:stickerCatalogItems([['🥕','Carrot'],['🌽','Ear of corn'],['🥦','Broccoli'],['🥒','Cucumber'],['🫑','Bell pepper'],['🍅','Tomato'],['🍆','Eggplant'],['🥔','Potato']])}),
  Object.freeze({id:'food-meals',productId:'sticker-food-meals',category:'food',name:'Meals',description:'Eight lunch, dinner, and takeout favorites.',tags:'food foods meal meals lunch dinner entree',price:180,items:stickerCatalogItems([['🌭','Hot dog'],['🌮','Taco'],['🌯','Burrito'],['🥪','Sandwich'],['🍝','Spaghetti'],['🍜','Steaming bowl'],['🍣','Sushi'],['🍱','Bento box']])}),
  Object.freeze({id:'food-sweet-treats',productId:'sticker-food-sweet-treats',category:'food',name:'Sweet Treats',description:'Eight desserts, candies, and celebration treats.',tags:'food foods sweet sweets treat treats dessert desserts candy celebration',price:180,items:stickerCatalogItems([['🍦','Soft ice cream'],['🍧','Shaved ice'],['🍨','Ice cream'],['🍰','Shortcake'],['🎂','Birthday cake'],['🍫','Chocolate bar'],['🍬','Candy'],['🍭','Lollipop']])}),
  Object.freeze({id:'numbers-1-25',productId:'sticker-numbers-1-25',category:'learning',name:'Numbers 1–25',description:'Twenty-five bold number stickers for counting and labeling.',tags:'number numbers counting count math mathematics classroom label labels',price:180,items:Object.freeze(Array.from({length:25},(_,index)=>Object.freeze({emoji:String(index+1),name:`Number ${index+1}`,tags:'number numbers counting math'})))}),
  Object.freeze({id:'letters-lowercase',productId:'sticker-letters-lowercase',category:'learning',name:'Lowercase Letters',description:'All twenty-six lowercase letter stickers from a to z.',tags:'letter letters lowercase alphabet phonics literacy classroom',price:180,items:Object.freeze(Array.from({length:26},(_,index)=>{const letter=String.fromCharCode(97+index);return Object.freeze({emoji:letter,name:`Lowercase ${letter}`,tags:'letter letters lowercase alphabet phonics'})}))}),
  Object.freeze({id:'letters-uppercase',productId:'sticker-letters-uppercase',category:'learning',name:'Uppercase Letters',description:'All twenty-six uppercase letter stickers from A to Z.',tags:'letter letters uppercase capital capitals alphabet phonics literacy classroom',price:180,items:Object.freeze(Array.from({length:26},(_,index)=>{const letter=String.fromCharCode(65+index);return Object.freeze({emoji:letter,name:`Uppercase ${letter}`,tags:'letter letters uppercase capital alphabet phonics'})}))})
]);
const COLLECTION_PACK_PRODUCTS=Object.freeze({
  'pastel-theme-pack':'theme-pastel',
  'polka-dot-theme-pack':'theme-polka-dot',
  'programmer-theme-pack':'theme-programmer',
  'wood-theme-pack':'theme-wood',
  'notebook-theme-pack':'theme-notebook',
  'cardboard-theme-pack':'theme-cardboard',
  'metal-theme-pack':'theme-metal',
  'cosmos-theme-pack':'theme-cosmos',
  'corkboard-theme-pack':'theme-corkboard',
  'emoji-sticker-pack':'sticker-emoji',
  'nature-emojis-sticker-pack':'sticker-nature-emojis',
  'weather-emojis-sticker-pack':'sticker-weather-emojis',
  'animal-emojis-sticker-pack':'sticker-animal-emojis',
  'more-faces-sticker-pack':'sticker-more-faces',
  'symbols-sticker-pack':'sticker-symbols',
  'food-sticker-pack':'sticker-food',
  'colored-hearts-sticker-pack':'sticker-colored-hearts',
  'decorative-hearts-sticker-pack':'sticker-decorative-hearts',
  'country-flags-sticker-pack':'sticker-country-flags',
  ...Object.fromEntries(ADDITIONAL_STICKER_PACKS.map(pack=>[`${pack.id}-sticker-pack`,pack.productId]))
});
const THEME_CHOICE_PRODUCTS=Object.freeze({
  pastel:'theme-pastel',polka:'theme-polka-dot',programmer:'theme-programmer',wood:'theme-wood',notebook:'theme-notebook',cardboard:'theme-cardboard',metal:'theme-metal',cosmos:'theme-cosmos',corkboard:'theme-corkboard'
});

function getOwnedShopProducts(){
  try{
    const value=JSON.parse(localStorage.getItem(SHOP_OWNED_PRODUCTS_KEY)||'[]');
    return Array.isArray(value)?new Set(value):new Set();
  }catch{return new Set()}
}

function migrateLegacyCursorOwnership(){
  const owned=getOwnedShopProducts();
  const legacy=['cursor-blue','cursor-red','cursor-green','cursor-purple','cursor-gold'];
  if(owned.has(CURSOR_COLOR_PACK_PRODUCT_ID)||!legacy.some(id=>owned.has(id)))return;
  legacy.forEach(id=>owned.delete(id));
  owned.add(CURSOR_COLOR_PACK_PRODUCT_ID);
  try{localStorage.setItem(SHOP_OWNED_PRODUCTS_KEY,JSON.stringify([...owned]))}catch{}
}

function getDefaultTileSkins(){
  try{
    const value=JSON.parse(localStorage.getItem(TILE_SKIN_DEFAULTS_KEY)||'{}');
    return value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  }catch{return{}}
}

function tileSkinById(id){return TILE_SKIN_CATALOG.find(skin=>skin.id===id)||null}
function tileSkinIsOwned(skin){return Boolean(skin&&getOwnedShopProducts().has(skin.productId))}
function cursorById(id){return CURSOR_CATALOG.find(cursor=>cursor.id===id)||CURSOR_CATALOG[0]}
function cursorIsOwned(cursor){return Boolean(cursor&&(!cursor.productId||getOwnedShopProducts().has(cursor.productId)))}
function collectionPackIsOwned(pack){const product=COLLECTION_PACK_PRODUCTS[pack?.id];return !product||getOwnedShopProducts().has(product)}
function themeChoiceProduct(theme){const prefix=Object.keys(THEME_CHOICE_PRODUCTS).find(name=>String(theme||'').startsWith(`${name}-`));return prefix?THEME_CHOICE_PRODUCTS[prefix]:''}
function themeChoiceIsOwned(theme){const product=themeChoiceProduct(theme);return !product||getOwnedShopProducts().has(product)}

function applyAppCursor(id,{persist=true}={}){
  const requested=cursorById(id);
  const cursor=cursorIsOwned(requested)?requested:CURSOR_CATALOG[0];
  if(persist){try{localStorage.setItem(ACTIVE_CURSOR_KEY,cursor.id)}catch{}}
  document.body.dataset.appCursor=cursor.id;
  document.body.classList.toggle('has-custom-cursor',cursor.id!=='default');
  const cursorRoot=document.documentElement;
  if(cursor.id==='default'){
    cursorRoot.style.removeProperty('--teacher-cursor-normal');
    cursorRoot.style.removeProperty('--teacher-cursor-point');
    cursorRoot.style.removeProperty('--teacher-cursor-open');
    cursorRoot.style.removeProperty('--teacher-cursor-grab');
  }
  else{
    const asset=state=>new URL(`assets/cursors/${cursor.id}-${state}.png?v=3`,document.baseURI).href;
    cursorRoot.style.setProperty('--teacher-cursor-normal',`url("${asset('normal')}") 4 1`);
    cursorRoot.style.setProperty('--teacher-cursor-point',`url("${asset('point')}") 10 1`);
    cursorRoot.style.setProperty('--teacher-cursor-open',`url("${asset('open')}") 12 12`);
    cursorRoot.style.setProperty('--teacher-cursor-grab',`url("${asset('grab')}") 12 12`);
  }
  window.dispatchEvent(new CustomEvent('teachertiles:cursorchange',{detail:{cursorId:cursor.id}}));
  return cursor;
}

migrateLegacyCursorOwnership();
applyAppCursor(localStorage.getItem(ACTIVE_CURSOR_KEY)||'default',{persist:false});

function activeTileSkinForType(type){
  const skin=tileSkinById(getDefaultTileSkins()[type]);
  return skin?.tileType===type&&tileSkinIsOwned(skin)?skin:null;
}

function setDefaultTileSkin(type,id=''){
  const defaults=getDefaultTileSkins();
  const skin=tileSkinById(id);
  if(skin&&skin.tileType===type&&tileSkinIsOwned(skin))defaults[type]=skin.id;
  else delete defaults[type];
  try{localStorage.setItem(TILE_SKIN_DEFAULTS_KEY,JSON.stringify(defaults))}catch{}
  window.dispatchEvent(new CustomEvent('teachertiles:tileskinchange',{detail:{type,skinId:defaults[type]||''}}));
}

function applyNewModuleTileSkin(m,type,requestedSkinId=''){
  const requested=tileSkinById(requestedSkinId);
  const skin=requested?.tileType===type&&tileSkinIsOwned(requested)?requested:activeTileSkinForType(type);
  if(skin)m.dataset.tileSkin=skin.id;
}

function setupModuleByType(m,type){
  setupCommon(m);
  if(type==='sticky')setupSticky(m);
  if(type==='timer')setupTimer(m);
  if(type==='interactive')setupHourglass(m);
  if(type==='clock')setupClock(m);
  if(type==='stopwatch')setupStopwatch(m);
  if(type==='draw')setupDraw(m);
  if(type==='magnifier')setupMagnifier(m);
  if(type==='dictionary')setupDictionary(m);
  if(type==='translation')setupTranslation(m);
  if(type==='livecaption')setupLiveCaption(m);
  if(type==='voicememo')setupVoiceMemo(m);
  if(type==='photobooth')setupPhotobooth(m);
  if(type==='mirror')setupMirror(m);
  if(type==='weather')setupWeather(m);
  if(type==='weatherwheel')setupWeatherWheel(m);
  if(type==='seasonwheel')setupSeasonWheel(m);
  if(type==='temperature')setupTemperature(m);
  if(type==='worldmap')setupWorldMap(m);
  if(type==='compass')setupCompass(m);
  if(type==='writinglines')setupWritingLines(m);
  if(type==='noise')setupNoise(m);
  if(type==='starchart')setupStarChart(m);
  if(type==='classmeter')setupClassMeter(m);
  if(type==='collections')setupCollections(m);
  if(type==='prizeboard')setupPrizeBoard(m);
  if(type==='pbisconsole')setupPbisConsole(m);
  if(type==='punchcards')setupPunchcards(m);
  if(type==='racer')setupRacer(m);
  if(type==='stoplight')setupStoplight(m);
  if(type==='groupmaker')setupGroupMaker(m);
  if(type==='lunchcount')setupLunchCount(m);
  if(type==='voting')setupVoting(m);
  if(type==='image')setupImage(m);
  if(type==='youtube')setupYoutube(m);
  if(type==='ambiencevideo')setupAmbienceVideo(m);
  if(type==='windowshare')setupWindowShare(m);
  if(type==='boombox')setupBoombox(m);
  if(type==='spinner')setupSpinner(m);
  if(type==='hangman')setupHangman(m);
  if(type==='wordypuzzle')setupWordyPuzzle(m);
  if(type==='cvcword')setupCVCWord(m);
  if(type==='highfrequency')setupHighFrequencyWords(m);
  if(type==='customflashcards')setupCustomFlashcards(m);
  if(type==='abc')setupABC(m);
  if(type==='ruler')setupRuler(m);
  if(type==='calculator')setupCalculator(m);
  if(type==='grapher')setupGrapher(m);
  if(type==='tablemaker')setupTableMaker(m);
  if(type==='tallychart')setupTallyChart(m);
  if(type==='periodictable')setupPeriodicTable(m);
  if(type==='money')setupMoney(m);
  if(type==='patternmaker')setupPatternMaker(m);
  if(type==='shapemanipulatives')setupShapeManipulatives(m);
  if(type==='shapes')setupShapes(m);
  if(type==='numberline')setupNumberLine(m);
  if(type==='hundredschart')setupHundredsChart(m);
  if(type==='tenframes')setupTenFrames(m);
  if(type==='textbubble')setupTextBubble(m);
  if(type==='todo')setupTodo(m);
  if(type==='visualschedule')setupVisualSchedule(m);
  if(type==='lessonplannertile')setupLessonPlannerTile(m);
  if(type==='progressbar')setupProgressBar(m);
  if(type==='date')setupDate(m);
  if(type==='calendar')setupCalendar(m);
  setupEditableTileHeading(m,type);
}

function createModule(type,x,y,{record=true,boardState=null,tileSkin=''}={}){
  const t=document.getElementById(`${type}-template`);
  if(!t)return null;
  const m=t.content.firstElementChild.cloneNode(true);
  const pbisMenuItem=menu.querySelector(`[data-module="${CSS.escape(type)}"][data-pbis-tracking="true"]`);
  if(pbisMenuItem){
    const badge=document.createElement('span');
    badge.className='module-pbis-badge';
    badge.textContent='PBIS';
    badge.setAttribute('aria-label','PBIS tracking tile');
    m.appendChild(badge);
  }
  if(boardState)applyBoardPreSetupState(m,boardState);
  else applyNewModuleTileSkin(m,type,tileSkin);
  workspace.appendChild(m);
  const w=m.offsetWidth,h=m.offsetHeight;
  m.style.left=`${clamp(x-w/2,0,BOARD_WIDTH-w)}px`;
  m.style.top=`${clamp(y-18,0,BOARD_HEIGHT-h)}px`;
  bringToFront(m);
  m._isBoardRestore=Boolean(boardState);
  setupModuleByType(m,type);
  if(boardState)applyBoardPostSetupState(m,boardState);
  delete m._isBoardRestore;
  if(record)recordHistory({type:'add',elements:[m]});
  return m;
}

const workspaceEmptyHint=document.getElementById('workspace-empty-hint');

function moduleIntersectsViewport(m){
  const r=m.getBoundingClientRect();
  return r.right>0&&r.bottom>0&&r.left<innerWidth&&r.top<innerHeight;
}

function updateWorkspaceEmptyState(){
  const modules=[...workspace.querySelectorAll('.module')];
  const hasModules=modules.length>0;
  const hasVisibleModule=modules.some(moduleIntersectsViewport);
  workspace.classList.toggle('has-modules',hasModules);
  workspaceEmptyHint?.classList.toggle('is-visible',!hasVisibleModule);
}

const workspaceModuleObserver=new MutationObserver(updateWorkspaceEmptyState);
workspaceModuleObserver.observe(workspace,{childList:true,subtree:false});
updateWorkspaceEmptyState();

const workspaceSpellcheckObserver=new MutationObserver(records=>{
  for(const record of records){
    for(const node of record.addedNodes){
      if(node instanceof Element&&(node.classList.contains('module')||node.closest('.module')))disableModuleSpellcheck(node);
    }
  }
});
workspaceSpellcheckObserver.observe(workspace,{childList:true,subtree:true});

let snapGroupSequence=0;
function makeSnapGroupId(){return`sg-${Date.now().toString(36)}-${(++snapGroupSequence).toString(36)}`}
function snapGroupMembers(m){
  const id=m?.dataset.snapGroup;
  if(!id)return m?[m]:[];
  return[...workspace.querySelectorAll('.module')].filter(module=>module.dataset.snapGroup===id);
}
function refreshSnapGroupState(id){
  if(!id)return[];
  const members=[...workspace.querySelectorAll('.module')].filter(module=>module.dataset.snapGroup===id);
  syncSnapGroupClass(members);
  if(members.length>1){
    const z=Math.max(...members.map(module=>Number(module.style.zIndex)||1));
    for(const module of members)module.style.zIndex=String(z);
  }
  return members;
}
function syncSnapGroupClass(modules){
  const list=[...new Set(modules.filter(Boolean))];
  const grouped=list.length>1;
  for(const module of list)module.classList.toggle('is-snap-grouped',grouped);
}
function clearSnapGroupMember(m,{notify=true}={}){
  const id=m?.dataset.snapGroup;
  if(!id)return false;
  const prior=snapGroupMembers(m);
  delete m.dataset.snapGroup;
  m.classList.remove('is-snap-grouped');
  const remaining=prior.filter(module=>module!==m&&module.isConnected);
  if(remaining.length<=1){
    for(const module of remaining){delete module.dataset.snapGroup;module.classList.remove('is-snap-grouped')}
  }else syncSnapGroupClass(remaining);
  if(notify)notifyBoardChanged('ungroup');
  return true;
}
function assignSnapGroup(modules){
  const connected=[...new Set(modules.filter(module=>module?.isConnected&&module.dataset.type!=='sticker'))];
  if(connected.length<2)return connected;
  const expanded=new Set(connected);
  for(const module of connected)for(const member of snapGroupMembers(module))if(member.dataset.type!=='sticker')expanded.add(member);
  const group=[...expanded];
  const id=group.map(module=>module.dataset.snapGroup).find(Boolean)||makeSnapGroupId();
  for(const module of group)module.dataset.snapGroup=id;
  syncSnapGroupClass(group);
  syncSnapGroupLayer(group);
  notifyBoardChanged('group');
  return group;
}
function syncSnapGroupLayer(modules){
  const group=[...new Set(modules.filter(module=>module?.isConnected))];
  if(!group.length)return;
  const tiles=group.filter(module=>module.dataset.type!=='sticker');
  if(tiles.length){
    tileZ=Math.min(tileZ+1,STICKER_Z_BASE-1);
    for(const module of tiles)module.style.zIndex=String(tileZ);
  }
}
function normalizeSnapGroups(){
  const groups=new Map();
  for(const module of workspace.querySelectorAll('.module')){
    const id=module.dataset.snapGroup;
    if(id){if(!groups.has(id))groups.set(id,[]);groups.get(id).push(module)}
  }
  for(const modules of groups.values()){
    if(modules.length<2){delete modules[0]?.dataset.snapGroup;modules[0]?.classList.remove('is-snap-grouped');continue}
    syncSnapGroupClass(modules);
    const z=Math.max(...modules.map(module=>Number(module.style.zIndex)||1));
    for(const module of modules)module.style.zIndex=String(z);
    tileZ=Math.max(tileZ,z);
  }
}
function bringToFront(m){
  if(!m)return;
  if(m.dataset.type==='sticker'){m.style.zIndex=String(STICKER_Z_BASE+(++stickerZ));return}
  const group=snapGroupMembers(m);
  if(group.length>1){syncSnapGroupLayer(group);return}
  tileZ=Math.min(tileZ+1,STICKER_Z_BASE-1);m.style.zIndex=String(tileZ);
}
const TEXT_ENTRY_SELECTOR='textarea,[contenteditable]:not([contenteditable="false"]),[role="textbox"],input:not([type]),input[type="text"],input[type="search"],input[type="email"],input[type="url"],input[type="tel"],input[type="password"]';
let activeModuleTextEditor=null;
const moduleTextClickState=new WeakMap();

function collapseTextEntrySelection(field){
  if(!(field instanceof HTMLElement))return;
  if(field instanceof HTMLInputElement||field instanceof HTMLTextAreaElement){
    const end=Number.isFinite(field.selectionEnd)?field.selectionEnd:field.value.length;
    try{field.setSelectionRange(end,end)}catch{}
    return;
  }
  const selection=getSelection();
  if(selection)selection.removeAllRanges();
}

function findModuleTextEditTarget(target,m){
  if(!(target instanceof Element)||!m)return null;
  const field=target.closest(TEXT_ENTRY_SELECTOR);
  return field&&m.contains(field)?field:null;
}

function isDoubleClickModuleText(field){
  return field instanceof HTMLElement&&field.dataset.textEditMode==='double';
}

function isImmediateModuleInput(field){
  return !isDoubleClickModuleText(field);
}

function exitModuleTextEdit(field=activeModuleTextEditor){
  if(!field)return;
  collapseTextEntrySelection(field);
  field.classList.remove('module-text-edit-active');
  field.closest('.module')?.classList.remove('is-text-editing');
  if(document.activeElement===field)field.blur();
  if(activeModuleTextEditor===field)activeModuleTextEditor=null;
}

function enterModuleTextEdit(field){
  if(!(field instanceof HTMLElement))return;
  if(activeModuleTextEditor&&activeModuleTextEditor!==field)exitModuleTextEdit(activeModuleTextEditor);
  activeModuleTextEditor=field;
  field.classList.add('module-text-edit-active');
  field.closest('.module')?.classList.add('is-text-editing');
  field.focus({preventScroll:true});
  if(field instanceof HTMLInputElement||field instanceof HTMLTextAreaElement){
    const end=field.value.length;
    try{field.setSelectionRange(end,end)}catch{}
  }else if(field.isContentEditable){
    const selection=getSelection();
    if(selection){
      const range=document.createRange();
      range.selectNodeContents(field);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
}

function prepareModuleTextEditors(m){
  const selector=TEXT_ENTRY_SELECTOR;
  m.querySelectorAll(selector).forEach(field=>field.classList.add('module-text-edit-target'));
  const observer=new MutationObserver(records=>{
    for(const record of records){
      for(const node of record.addedNodes){
        if(!(node instanceof Element))continue;
        if(node.matches?.(selector))node.classList.add('module-text-edit-target');
        node.querySelectorAll?.(selector).forEach(field=>field.classList.add('module-text-edit-target'));
      }
    }
  });
  observer.observe(m,{childList:true,subtree:true});
  const previousCleanup=m._cleanup;
  m._cleanup=()=>{observer.disconnect();if(activeModuleTextEditor&&m.contains(activeModuleTextEditor))exitModuleTextEdit(activeModuleTextEditor);previousCleanup?.()};
}

function isInteractiveModuleTarget(target,m){
  if(!(target instanceof Element)||!m)return false;
  if(target.closest('.module-drag-handle'))return false;
  const textField=findModuleTextEditTarget(target,m);
  if(textField)return isImmediateModuleInput(textField)||textField.classList.contains('module-text-edit-active');
  if(target.closest('button,input,select,textarea,[contenteditable],[draggable="true"],iframe,audio,video,canvas,a,label,[role="button"],[role="slider"],[role="textbox"],[data-resize],[data-sticker-resize],.resize-handle,.sticker-rotate-handle,.module-delete,.ruler-handle'))return true;
  for(let el=target;el&&el!==m;el=el.parentElement){
    const cursor=getComputedStyle(el).cursor||'';
    if(cursor==='pointer'||cursor==='text'||cursor==='crosshair'||cursor==='grab'||cursor==='grabbing'||cursor==='not-allowed'||cursor.includes('resize'))return true;
  }
  return false;
}
function setupCommon(m){
  disableModuleSpellcheck(m);
  prepareModuleTextEditors(m);
  let grabCursorTarget=null;
  const clearGrabCursor=()=>{grabCursorTarget?.classList.remove('module-grab-cursor');grabCursorTarget=null};
  m.addEventListener('pointerover',e=>{
    const target=e.target instanceof Element?e.target:null;
    if(!target||findModuleTextEditTarget(target,m)||isInteractiveModuleTarget(target,m)){clearGrabCursor();return}
    if(grabCursorTarget!==target){clearGrabCursor();target.classList.add('module-grab-cursor');grabCursorTarget=target}
  });
  m.addEventListener('pointerleave',clearGrabCursor);
  m.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    const field=findModuleTextEditTarget(e.target,m);
    if(!field)return;
    if(isImmediateModuleInput(field)){
      e.stopPropagation();
      enterModuleTextEdit(field);
      return;
    }
    if(field.classList.contains('module-text-edit-active'))return;
    const previous=moduleTextClickState.get(field);
    const now=performance.now();
    const isDouble=previous&&now-previous.time<=420&&Math.hypot(e.clientX-previous.x,e.clientY-previous.y)<=8;
    moduleTextClickState.set(field,{time:now,x:e.clientX,y:e.clientY});
    if(isDouble){
      e.preventDefault();
      e.stopPropagation();
      moduleTextClickState.delete(field);
      enterModuleTextEdit(field);
    }
  },true);
  m.addEventListener('pointerdown',e=>{if(e.button===0&&e.shiftKey&&!isInteractiveModuleTarget(e.target,m)){e.preventDefault();e.stopPropagation();toggleSelection(m);bringToFront(m)}},true);
  m.addEventListener('pointerdown',e=>{bringToFront(m);const interactive=isInteractiveModuleTarget(e.target,m);if(!e.shiftKey&&!interactive&&!selectedModules.has(m))clearSelection()});
  m.querySelector('.module-delete').addEventListener('click',e=>{e.stopPropagation();deleteModules(selectedModules.has(m)?[...selectedModules]:[m])});
  setupDrag(m);
  if(!['draw','sticker'].includes(m.dataset.type))setupResize(m)
}
document.addEventListener('pointerdown',event=>{
  if(!activeModuleTextEditor||!(event.target instanceof Node))return;
  if(event.target===activeModuleTextEditor||activeModuleTextEditor.contains(event.target))return;
  exitModuleTextEdit(activeModuleTextEditor);
},true);

document.addEventListener('pointerdown',event=>{
  const field=document.activeElement;
  if(!(field instanceof HTMLElement)||!field.matches(TEXT_ENTRY_SELECTOR)||!(event.target instanceof Node))return;
  if(event.target===field||field.contains(event.target))return;
  collapseTextEntrySelection(field);
},true);

document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&activeModuleTextEditor){
    event.preventDefault();
    exitModuleTextEdit(activeModuleTextEditor);
  }
},true);

function setupDrag(m){
  const h=m,guideX=workspace.querySelector('.snap-guide-x'),guideY=workspace.querySelector('.snap-guide-y');
  const pulse=mods=>{const unique=[...new Set(mods.filter(Boolean))];for(const el of unique){el.classList.remove('snap-pop');void el.offsetWidth;el.classList.add('snap-pop');setTimeout(()=>el.classList.remove('snap-pop'),240)}};
  const touching=(a,b)=>{const al=a.offsetLeft,at=a.offsetTop,ar=al+a.offsetWidth,ab=at+a.offsetHeight,bl=b.offsetLeft,bt=b.offsetTop,br=bl+b.offsetWidth,bb=bt+b.offsetHeight;const vo=Math.min(ab,bb)-Math.max(at,bt),ho=Math.min(ar,br)-Math.max(al,bl);return (vo>24&&(Math.abs(ar-bl)<=2.5||Math.abs(br-al)<=2.5))||(ho>24&&(Math.abs(ab-bt)<=2.5||Math.abs(bb-at)<=2.5))};
  const snappedGroup=start=>{const all=[...workspace.querySelectorAll('.module')],seen=new Set([start]),queue=[start];while(queue.length){const a=queue.shift();for(const b of all){if(seen.has(b)||b===a)continue;if(touching(a,b)){seen.add(b);queue.push(b)}}}return [...seen]};
  const clearPreview=()=>{guideX.classList.remove('is-visible');guideY.classList.remove('is-visible');document.querySelectorAll('.module.is-snap-target').forEach(x=>x.classList.remove('is-snap-target'))};
  const findSnap=(left,top)=>{
    const SNAP=15/boardCamera.scale,EDGE_SNAP=20/boardCamera.scale;
    const w=m.offsetWidth,hh=m.offsetHeight,right=left+w,bottom=top+hh;
    let sx=null,sy=null,bestX=SNAP+1,bestY=SNAP+1,targetX=null,targetY=null,seamX=0,seamY=0,xStart=0,xLength=0,yStart=0,yLength=0;
    for(const o of workspace.querySelectorAll('.module')){
      if(o===m||selectedModules.has(o))continue;
      const ol=o.offsetLeft,ot=o.offsetTop,ow=o.offsetWidth,oh=o.offsetHeight,or=ol+ow,ob=ot+oh;
      const vStart=Math.max(top,ot),vEnd=Math.min(bottom,ob),vOverlap=vEnd-vStart,hStart=Math.max(left,ol),hEnd=Math.min(right,or),hOverlap=hEnd-hStart;
      if(vOverlap>28){
        const a=Math.abs(left-or),b=Math.abs(right-ol);
        if(a<bestX){bestX=a;sx=or;targetX=o;seamX=or;xStart=vStart;xLength=vOverlap}
        if(b<bestX){bestX=b;sx=ol-w;targetX=o;seamX=ol;xStart=vStart;xLength=vOverlap}
      }
      if(hOverlap>28){
        const a=Math.abs(top-ob),b=Math.abs(bottom-ot);
        if(a<bestY){bestY=a;sy=ob;targetY=o;seamY=ob;yStart=hStart;yLength=hOverlap}
        if(b<bestY){bestY=b;sy=ot-hh;targetY=o;seamY=ot;yStart=hStart;yLength=hOverlap}
      }
    }
    const view=visibleBoardBounds();
    const edgeCandidatesX=[
      {distance:Math.abs(left-view.left),value:view.left,seam:view.left},
      {distance:Math.abs(right-view.right),value:view.right-w,seam:view.right}
    ];
    for(const edge of edgeCandidatesX)if(edge.distance<=EDGE_SNAP&&edge.distance<bestX){
      bestX=edge.distance;sx=edge.value;targetX=null;seamX=edge.seam;xStart=Math.max(top,view.top);xLength=Math.max(32,Math.min(hh,view.bottom-view.top));
    }
    const edgeCandidatesY=[
      {distance:Math.abs(top-view.top),value:view.top,seam:view.top},
      {distance:Math.abs(bottom-view.bottom),value:view.bottom-hh,seam:view.bottom}
    ];
    for(const edge of edgeCandidatesY)if(edge.distance<=EDGE_SNAP&&edge.distance<bestY){
      bestY=edge.distance;sy=edge.value;targetY=null;seamY=edge.seam;yStart=Math.max(left,view.left);yLength=Math.max(32,Math.min(w,view.right-view.left));
    }
    return{left:sx,top:sy,targetX,targetY,seamX,seamY,xStart,xLength,yStart,yLength};
  };
  h.addEventListener('pointerdown',e=>{
    if(e.button!==0||e.shiftKey||isInteractiveModuleTarget(e.target,m))return;
    e.preventDefault();
    m.classList.add('is-dragging');
    document.body.classList.add('is-module-dragging');
    bringToFront(m);
    if(!selectedModules.has(m)){if(!e.shiftKey)clearSelection();selectedModules.add(m);m.classList.add('is-selected')}
    const selected=[...selectedModules];
    const connectedToAnchor=snapGroupMembers(m);
    const expanded=new Set();
    for(const selectedModule of selected){
      expanded.add(selectedModule);
      for(const member of snapGroupMembers(selectedModule))expanded.add(member);
    }
    let group=[...expanded];
    let multi=group.length>1;
    let tugCandidate=selected.length===1&&selected[0]===m&&connectedToAnchor.length>1;
    let tugArmed=false;
    let tugged=false;
    let tugBreakDx=0,tugBreakDy=0,tugBreakVisualDx=0,tugBreakVisualDy=0;
    const dragStartGroup=[...group];
    const origins=new Map(group.map(g=>[g,captureModuleTransform(g)]));
    h.setPointerCapture(e.pointerId);
    const sx=e.clientX,sy=e.clientY;
    const tugHoldTimer=tugCandidate?setTimeout(()=>{tugArmed=true;m.classList.add('is-tug-armed')},520):null;
    let pending=null,overTrash=false;
    const trashHit=ev=>{if(!trashZone)return false;const b=trashZone.getBoundingClientRect();return ev.clientX>=b.left&&ev.clientX<=b.right&&ev.clientY>=b.top&&ev.clientY<=b.bottom};
    const setTrash=(visible,armed=false)=>{trashZone?.classList.toggle('is-visible',visible);trashZone?.classList.toggle('is-armed',visible&&armed);for(const g of dragStartGroup)g.classList.toggle('is-over-trash',visible&&armed)};
    setTrash(true,false);
    const move=ev=>{
      const dx=(ev.clientX-sx)/boardCamera.scale,dy=(ev.clientY-sy)/boardCamera.scale;
      const distance=Math.hypot(ev.clientX-sx,ev.clientY-sy);
      if(tugCandidate&&!tugArmed&&distance>8){clearTimeout(tugHoldTimer);tugCandidate=false}
      if(tugArmed&&!tugged&&distance>=36){
        tugBreakDx=dx;tugBreakDy=dy;
        tugBreakVisualDx=dx*.2;tugBreakVisualDy=dy*.2;
        for(const member of group)if(member!==m)applyModuleTransform(member,origins.get(member));
        clearSnapGroupMember(m);
        group=[m];multi=false;tugCandidate=false;tugged=true;
        tugArmed=false;m.classList.remove('is-tug-armed');
        bringToFront(m);
      }
      for(const g of group){
        const o=origins.get(g);
        let moveX=dx,moveY=dy;
        if(tugArmed&&!tugged&&g===m){moveX=dx*.2;moveY=dy*.2}
        else if(tugged&&g===m){moveX=tugBreakVisualDx+(dx-tugBreakDx);moveY=tugBreakVisualDy+(dy-tugBreakDy)}
        g.style.left=`${clamp(o.left+moveX,0,BOARD_WIDTH-g.offsetWidth)}px`;
        g.style.top=`${clamp(o.top+moveY,0,BOARD_HEIGHT-g.offsetHeight)}px`;
      }
      clearPreview();
      overTrash=trashHit(ev);
      setTrash(true,overTrash);
      if(overTrash||multi){pending=null;return}
      pending=findSnap(m.offsetLeft,m.offsetTop);
      if(pending.targetX)pending.targetX.classList.add('is-snap-target');
      if(pending.targetY)pending.targetY.classList.add('is-snap-target');
      if(pending.left!==null){
        const len=Math.max(12/boardCamera.scale,Math.min(46/boardCamera.scale,pending.xLength*.48)),st=pending.xStart+(pending.xLength-len)/2;
        Object.assign(guideX.style,{left:`${pending.seamX}px`,top:`${st}px`,height:`${len}px`});guideX.classList.add('is-visible')
      }
      if(pending.top!==null){
        const len=Math.max(12/boardCamera.scale,Math.min(46/boardCamera.scale,pending.yLength*.48)),st=pending.yStart+(pending.yLength-len)/2;
        Object.assign(guideY.style,{top:`${pending.seamY}px`,left:`${st}px`,width:`${len}px`});guideY.classList.add('is-visible')
      }
    };
    const cleanup=()=>{clearTimeout(tugHoldTimer);m.classList.remove('is-dragging','is-tug-armed');document.body.classList.remove('is-module-dragging');clearPreview();setTrash(false,false);h.removeEventListener('pointermove',move);h.removeEventListener('pointerup',end);h.removeEventListener('pointercancel',cancel)};
    const end=()=>{
      if(overTrash){cleanup();deleteModules(dragStartGroup.filter(module=>module.isConnected));return}
      if(tugArmed&&!tugged){for(const [module,origin] of origins)applyModuleTransform(module,origin);cleanup();return}
      let willSnap=false;
      if(!multi&&pending){
        willSnap=pending.left!==null||pending.top!==null;
        if(pending.left!==null)m.style.left=`${clamp(pending.left,0,BOARD_WIDTH-m.offsetWidth)}px`;
        if(pending.top!==null)m.style.top=`${clamp(pending.top,0,BOARD_HEIGHT-m.offsetHeight)}px`;
      }
      let joined=group;
      if(willSnap){
        const snapMembers=snappedGroup(m);
        for(const member of snapMembers)if(!origins.has(member))origins.set(member,captureModuleTransform(member));
        joined=assignSnapGroup(snapMembers);
      }
      recordTransformHistory([...origins.keys()],origins);
      cleanup();
      pulse(multi?group:(willSnap?joined:[m]));
    };
    const cancel=()=>{for(const [g,origin] of origins)applyModuleTransform(g,origin);if(tugged)assignSnapGroup(connectedToAnchor);cleanup()};
    h.addEventListener('pointermove',move);
    h.addEventListener('pointerup',end);
    h.addEventListener('pointercancel',cancel);
  });
}

function setupResize(m){
  for(const d of ['t','r','b','l'])if(!m.querySelector(`[data-resize="${d}"]`)){const h=document.createElement('div');h.className=`resize-handle resize-handle--${d}`;h.dataset.resize=d;m.appendChild(h)}
  m.querySelectorAll('[data-resize]').forEach(h=>h.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    e.preventDefault();e.stopPropagation();
    const before=captureModuleTransform(m);
    clearSnapGroupMember(m);bringToFront(m);h.setPointerCapture(e.pointerId);
    const d=h.dataset.resize,sx=e.clientX,sy=e.clientY,sl=m.offsetLeft,st=m.offsetTop,sw=m.offsetWidth,sh=m.offsetHeight,cs=getComputedStyle(m),mw=parseFloat(cs.minWidth)||220,mh=parseFloat(cs.minHeight)||180;
    const move=ev=>{
      const dx=(ev.clientX-sx)/boardCamera.scale,dy=(ev.clientY-sy)/boardCamera.scale;
      let l=sl,t=st,w=sw,hh=sh;
      if(d.includes('r'))w=clamp(sw+dx,mw,BOARD_WIDTH-sl);
      if(d.includes('b'))hh=clamp(sh+dy,mh,BOARD_HEIGHT-st);
      if(d.includes('l')){w=clamp(sw-dx,mw,sw+sl);l=sl+sw-w}
      if(d.includes('t')){hh=clamp(sh-dy,mh,sh+st);t=st+sh-hh}
      if(m._imageRatio){
        const ratio=m._imageRatio;
        if(d==='t'||d==='b'){
          w=Math.max(mw,hh*ratio);
          if(w>BOARD_WIDTH-l){w=BOARD_WIDTH-l;hh=w/ratio}
          if(d==='t')t=st+sh-hh;
        }else{
          hh=Math.max(mh,w/ratio);
          if(hh>BOARD_HEIGHT-t){hh=BOARD_HEIGHT-t;w=hh*ratio}
          if(d.includes('l'))l=sl+sw-w;
          if(d.includes('t'))t=st+sh-hh;
        }
      }
      Object.assign(m.style,{left:`${l}px`,top:`${t}px`,width:`${w}px`,height:`${hh}px`});
    };
    const end=()=>{recordTransformHistory([m],new Map([[m,before]]));updateWorkspaceEmptyState();h.removeEventListener('pointermove',move);h.removeEventListener('pointerup',end);h.removeEventListener('pointercancel',end)};
    h.addEventListener('pointermove',move);h.addEventListener('pointerup',end);h.addEventListener('pointercancel',end);
  }));
}

function updateStickerVisualSize(m){
  const emoji=m.querySelector('.sticker-emoji');
  if(!emoji)return;
  const size=Math.max(38,Math.min(m.offsetWidth,m.offsetHeight)*.72);
  emoji.style.fontSize=`${size}px`;
  emoji.style.setProperty('--sticker-outline',`${Math.max(2.5,size*.052)}px`);
}

function setupStickerTransformControls(m){
  if(!m||m.dataset.stickerTransformReady)return;
  m.dataset.stickerTransformReady='true';
  const ratio=m._stickerRatio||Math.max(.12,m.offsetWidth/Math.max(1,m.offsetHeight));
  m._stickerRatio=ratio;

  const rotate=document.createElement('button');
  rotate.type='button';
  rotate.className='sticker-rotate-handle';
  rotate.setAttribute('aria-label','Rotate sticker');
  rotate.innerHTML='<span aria-hidden="true">↻</span><b class="sticker-rotation-readout" aria-hidden="true">0°</b>';
  m.appendChild(rotate);

  for(const d of ['tl','tr','bl','br']){
    const h=document.createElement('button');
    h.type='button';
    h.className=`sticker-resize-handle sticker-resize-handle--${d}`;
    h.dataset.stickerResize=d;
    h.setAttribute('aria-label','Resize sticker');
    m.appendChild(h);
  }

  m.querySelectorAll('[data-sticker-resize]').forEach(h=>h.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    e.preventDefault();e.stopPropagation();bringToFront(m);h.setPointerCapture(e.pointerId);
    const before=captureModuleTransform(m),d=h.dataset.stickerResize,sx=e.clientX,sy=e.clientY,sl=m.offsetLeft,st=m.offsetTop,sw=m.offsetWidth,sh=m.offsetHeight;
    const right=sl+sw,bottom=st+sh;
    const minW=Math.max(52,52*ratio);
    const maxW=Math.max(minW,Math.min(d.includes('r')?BOARD_WIDTH-sl:right,(d.includes('b')?BOARD_HEIGHT-st:bottom)*ratio));
    m.classList.add('is-sticker-resizing');
    const move=ev=>{
      const dx=(ev.clientX-sx)/boardCamera.scale,dy=(ev.clientY-sy)/boardCamera.scale;
      const fromX=d.includes('r')?sw+dx:sw-dx;
      const fromY=(d.includes('b')?sh+dy:sh-dy)*ratio;
      let w=Math.abs(fromX-sw)>=Math.abs(fromY-sw)?fromX:fromY;
      w=clamp(w,minW,maxW);
      const hh=w/ratio;
      const l=d.includes('l')?right-w:sl;
      const t=d.includes('t')?bottom-hh:st;
      Object.assign(m.style,{left:`${l}px`,top:`${t}px`,width:`${w}px`,height:`${hh}px`});
      updateStickerVisualSize(m);
    };
    const end=()=>{
      m.classList.remove('is-sticker-resizing');
      recordTransformHistory([m],new Map([[m,before]]));
      updateWorkspaceEmptyState();
      h.removeEventListener('pointermove',move);h.removeEventListener('pointerup',end);h.removeEventListener('pointercancel',end);
    };
    h.addEventListener('pointermove',move);h.addEventListener('pointerup',end);h.addEventListener('pointercancel',end);
  }));

  rotate.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    e.preventDefault();e.stopPropagation();bringToFront(m);rotate.setPointerCapture(e.pointerId);
    const rect=m.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
    const angleOf=ev=>Math.atan2(ev.clientY-cy,ev.clientX-cx)*180/Math.PI;
    let lastAngle=angleOf(e),accumulated=0;
    const before=captureModuleTransform(m),startRotation=parseFloat(m.dataset.stickerRotation)||0;
    const readout=rotate.querySelector('.sticker-rotation-readout');
    m.classList.add('is-sticker-rotating');
    const move=ev=>{
      const angle=angleOf(ev);
      let delta=angle-lastAngle;
      if(delta>180)delta-=360;
      if(delta<-180)delta+=360;
      accumulated+=delta;
      lastAngle=angle;
      let next=startRotation+accumulated;
      if(ev.shiftKey)next=Math.round(next/15)*15;
      m.dataset.stickerRotation=String(next);
      m.style.setProperty('--sticker-rotation',`${next}deg`);
      if(readout)readout.textContent=`${Math.round(((next%360)+360)%360)}°`;
    };
    const end=()=>{
      m.classList.remove('is-sticker-rotating');
      recordTransformHistory([m],new Map([[m,before]]));
      rotate.removeEventListener('pointermove',move);rotate.removeEventListener('pointerup',end);rotate.removeEventListener('pointercancel',end);
    };
    rotate.addEventListener('pointermove',move);rotate.addEventListener('pointerup',end);rotate.addEventListener('pointercancel',end);
  });

  updateStickerVisualSize(m);
}

function setupSticky(m){const ed=m.querySelector('.sticky-editor'),bar=m.querySelector('.sticky-toolbar'),size=m.querySelector('.sticky-font-size'),cycle=m.querySelector('.sticky-color-cycle'),font=m.querySelector('.sticky-font-cycle'),dot=cycle.querySelector('span'),colors=['yellow','pink','blue','green','lavender'],hex={yellow:'#fff2aa',pink:'#ffdbe5',blue:'#dbeeff',green:'#ddf4df',lavender:'#eadfff'};let i=Math.max(0,colors.indexOf(m.dataset.color));m.dataset.color=colors[i];dot.style.background=hex[colors[i]];bar.addEventListener('pointerdown',e=>{if(e.target.closest('button'))e.preventDefault()});bar.addEventListener('click',e=>{const b=e.target.closest('[data-command]');if(!b)return;ed.focus();document.execCommand(b.dataset.command,false,null)});size.addEventListener('change',()=>{ed.focus();document.execCommand('fontSize',false,'7');ed.querySelectorAll('font[size="7"]').forEach(f=>{f.removeAttribute('size');f.style.fontSize=`${size.value}px`})});font.addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));cycle.addEventListener('click',()=>{i=(i+1)%colors.length;m.dataset.color=colors[i];dot.style.background=hex[colors[i]]})}

const shapePaths={
  circle:'M50 4 A46 46 0 1 1 49.999 4 Z',
  triangle:'M50 5 L96 92 L4 92 Z',
  square:'M8 8 H92 V92 H8 Z',
  diamond:'M50 4 L96 50 L50 96 L4 50 Z',
  hexagon:'M25 6 H75 L96 50 L75 94 H25 L4 50 Z',
  star:'M50 4 L61.4 36.2 L95.5 36.9 L68.4 57.7 L78.2 90.4 L50 71 L21.8 90.4 L31.6 57.7 L4.5 36.9 L38.6 36.2 Z',
  heart:'M50 91 C42 82 10 63 7 35 C5 16 18 6 33 6 C42 6 48 11 50 18 C52 11 58 6 67 6 C82 6 95 16 93 35 C90 63 58 82 50 91 Z'
};

function launchConfetti(m){const layer=m.querySelector('.confetti-layer');if(!layer)return;layer.innerHTML='';const colors=['#ff6b7a','#ffd34e','#69c6ff','#7edc8b','#9d7cff','#ff9c5a'];for(let i=0;i<54;i++){const p=document.createElement('i');p.className='confetti-piece';const a=Math.random()*Math.PI*2,d=90+Math.random()*230;p.style.setProperty('--x',`${Math.cos(a)*d}px`);p.style.setProperty('--y',`${Math.sin(a)*d-50}px`);p.style.setProperty('--r',`${Math.round(Math.random()*760-380)}deg`);p.style.setProperty('--confetti',colors[i%colors.length]);p.style.width=`${6+Math.random()*5}px`;p.style.height=`${8+Math.random()*10}px`;p.style.animationDelay=`${Math.random()*.12}s`;layer.appendChild(p)}setTimeout(()=>layer.innerHTML='',1700)}

function celebrateTimerFinish(m){
  launchConfetti(m);
  playUiSfx('confetti');
  playUiSfx('timer-tada');
}

function bindTimerControls(m,onRender,{onFinish}={}){
  const remain=m.querySelector('.timer-remaining, .hourglass-countdown, .candle-countdown');
  const presets=[...m.querySelectorAll('[data-minutes]')];
  const input=m.querySelector('.timer-custom');
  const set=m.querySelector('.timer-set');
  const start=m.querySelector('.timer-start');
  const reset=m.querySelector('.timer-reset');
  let total=300,left=300,running=false,end=0,interval=null,finished=false;

  const render=()=>{
    remain.textContent=formatCountdown(left);
    onRender({progress:1-clamp(left/total,0,1),running,left,total});
  };
  const stop=()=>{if(interval){clearInterval(interval);interval=null}};
  const setDuration=min=>{
    const n=Number(min);
    if(!Number.isFinite(n)||n<=0)return;
    running=false;finished=false;stop();
    m.classList.remove('is-running','candle-finished');
    total=Math.round(n*60);left=total;end=0;
    start.textContent='Start';
    render();
  };

  presets.forEach(b=>b.addEventListener('click',()=>{
    presets.forEach(x=>x.classList.remove('is-active'));
    b.classList.add('is-active');
    input.value='';
    setDuration(b.dataset.minutes);
  }));
  set.addEventListener('click',()=>{
    if(input.value){
      presets.forEach(x=>x.classList.remove('is-active'));
      setDuration(input.value);
    }
  });
  input.addEventListener('keydown',e=>{if(e.key==='Enter')set.click()});

  const tick=()=>{
    if(!running)return;
    left=Math.max(0,(end-Date.now())/1000);
    render();
    if(left<=0){
      running=false;stop();m.classList.remove('is-running');start.textContent='Start';
      if(!finished){
        finished=true;
        onFinish?.();
        m.animate([{transform:'scale(1)'},{transform:'scale(1.025)'},{transform:'scale(1)'}],{duration:500});
      }
    }
  };

  start.addEventListener('click',()=>{
    if(running){
      left=Math.max(0,(end-Date.now())/1000);
      running=false;stop();m.classList.remove('is-running');start.textContent='Resume';render();
      return;
    }
    if(left<=0){left=total;finished=false;m.classList.remove('candle-finished')}
    running=true;end=Date.now()+left*1000;m.classList.add('is-running');start.textContent='Pause';
    interval=setInterval(tick,80);tick();
  });
  reset.addEventListener('click',()=>{
    running=false;finished=false;stop();left=total;m.classList.remove('is-running','candle-finished');start.textContent='Start';render();
  });

  m._boardTimerGetState=()=>({total,left:running?Math.max(0,(end-Date.now())/1000):left,running,finished});
  m._boardTimerSetState=state=>{
    if(!state)return;
    stop();
    total=Math.max(1,Number(state.total)||300);
    left=Math.max(0,Math.min(total,Number(state.left)??total));
    finished=Boolean(state.finished);
    running=Boolean(state.running)&&left>0;
    m.classList.toggle('is-running',running);
    start.textContent=running?'Pause':left<total&&left>0?'Resume':'Start';
    if(running){
      end=Date.now()+left*1000;
      interval=setInterval(tick,80);
    }else end=0;
    render();
  };

  render();
  return()=>{
    stop();
    delete m._boardTimerGetState;
    delete m._boardTimerSetState;
  };
}

function setupTimer(m){
  const stage=m.querySelector('.timer-stage'),visual=m.querySelector('.timer-visual'),readout=m.querySelector('.timer-readout'),clip=m.querySelector('.shape-clip'),clipPath=m.querySelector('.shape-clip path'),outline=m.querySelector('.shape-outline'),highlight=m.querySelector('.shape-highlight'),foreign=m.querySelector('.shape-foreign'),fill=m.querySelector('.shape-fill'),status=m.querySelector('.timer-status'),shapeButtons=[...m.querySelectorAll('.timer-shapes [data-shape]')];
  const clipId=`shape-clip-${++uid}`;
  clip.id=clipId;
  foreign.setAttribute('clip-path',`url(#${clipId})`);

  const setShape=(shape,animate=false)=>{
    const d=shapePaths[shape]||shapePaths.circle;
    m.dataset.timerShape=shape;
    clipPath.setAttribute('d',d);
    outline.setAttribute('d',d);
    highlight?.setAttribute('d',d);
    if(readout&&readout.parentElement!==visual)visual.appendChild(readout);
    requestAnimationFrame(sizeVisual);
    if(animate&&visual?.animate)visual.animate([
      {transform:'scale(1) rotate(0deg)'},
      {transform:'scale(.965) rotate(-.6deg)',offset:.38},
      {transform:'scale(1.012) rotate(.25deg)',offset:.72},
      {transform:'scale(1) rotate(0deg)'}
    ],{duration:330,easing:'cubic-bezier(.2,.8,.2,1)'});
  };

  shapeButtons.forEach(b=>b.addEventListener('click',()=>{
    shapeButtons.forEach(x=>x.classList.remove('is-active'));
    b.classList.add('is-active');
    setShape(b.dataset.shape,true);
  }));

  m.querySelector('.timer-font')?.addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.timer-text')?.addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));
  m.querySelector('.timer-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.timer-shape-color').addEventListener('click',()=>cycleData(m,'shapeColor',['blue','green','amber','rose','purple','teal']));

  const sizeVisual=()=>{
    if(!stage)return;
    const stageWidth=stage.clientWidth,stageHeight=stage.clientHeight;
    if(stageWidth<20||stageHeight<20)return;
    const shortest=Math.min(stageWidth,stageHeight);
    const breathingRoom=Math.max(10,Math.min(28,shortest*.055));
    const size=Math.max(118,shortest-(breathingRoom*2));
    visual.style.setProperty('--timer-visual-size',`${size}px`);
  };
  const sizeObserver=new ResizeObserver(sizeVisual);
  if(stage)sizeObserver.observe(stage);
  requestAnimationFrame(sizeVisual);

  const initialShape=shapePaths[m.dataset.timerShape]?m.dataset.timerShape:'circle';
  shapeButtons.forEach(button=>button.classList.toggle('is-active',button.dataset.shape===initialShape));
  setShape(initialShape);
  const stopTimer=bindTimerControls(m,({progress,running,left,total})=>{
    fill.style.setProperty('--progress',`${progress*360}deg`);
    m.style.setProperty('--timer-progress-ratio',progress.toFixed(4));
    const complete=left<=.05;
    const paused=!running&&!complete&&left<total-.05;
    m.classList.toggle('timer-complete',complete);
    m.classList.toggle('timer-paused',paused);
    if(status)status.textContent=complete?'DONE':running?'RUNNING':paused?'PAUSED':'READY';
  },{onFinish:()=>celebrateTimerFinish(m)});

  m._cleanup=()=>{
    stopTimer();
    sizeObserver.disconnect();
  };
}

function setupHourglass(m){const hourStage=m.querySelector('.hourglass-stage'),candleStage=m.querySelector('.candle-stage'),countdownHour=m.querySelector('.hourglass-countdown'),countdownCandle=m.querySelector('.candle-countdown'),topClip=m.querySelector('.hg-top-clip'),bottomClip=m.querySelector('.hg-bottom-clip'),top=m.querySelector('.hg-sand-top'),bottom=m.querySelector('.hg-sand-bottom'),pile=m.querySelector('.hg-bottom-pile'),stream=m.querySelector('.hg-stream'),candleBody=m.querySelector('.candle-body'),candleScene=m.querySelector('.candle-scene'),modeButtons=[...m.querySelectorAll('[data-interactive]')],bgBtn=m.querySelector('.interactive-bg'),candleColorBtn=m.querySelector('.candle-color-control');const topId=`hg-top-${++uid}`,bottomId=`hg-bottom-${++uid}`;topClip.id=topId;bottomClip.id=bottomId;top.setAttribute('clip-path',`url(#${topId})`);bottom.setAttribute('clip-path',`url(#${bottomId})`);pile.setAttribute('clip-path',`url(#${bottomId})`);let mode='hourglass';const setMode=next=>{mode=next==='candle'?'candle':'hourglass';m.dataset.interactiveMode=mode;hourStage.hidden=mode!=='hourglass';candleStage.hidden=mode!=='candle';modeButtons.forEach(b=>b.classList.toggle('is-active',b.dataset.interactive===mode))};modeButtons.forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.interactive)));bgBtn.addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));candleColorBtn.addEventListener('click',()=>cycleData(m,'candleColor',['cream','blush','sage','sky','lavender','charcoal']));const cleanup=bindTimerControls(m,({progress,running,left})=>{const text=formatCountdown(left);countdownHour.textContent=text;countdownCandle.textContent=text;const topY=62+96*progress,topH=96*(1-progress);top.setAttribute('y',topY.toFixed(2));top.setAttribute('height',Math.max(0,topH).toFixed(2));const bottomH=96*progress,bottomY=278-bottomH;bottom.setAttribute('y',bottomY.toFixed(2));bottom.setAttribute('height',bottomH.toFixed(2));pile.setAttribute('opacity',progress>0.03?'1':'0');pile.setAttribute('transform',`translate(0 ${Math.max(0,30-progress*30).toFixed(2)}) scale(1 ${Math.max(.18,progress).toFixed(3)})`);stream.setAttribute('opacity',running&&left>0?'1':'0');const h=78-(70*progress);candleScene.style.setProperty('--candle-height',`${Math.max(8,h)}%`);m.classList.toggle('candle-finished',mode==='candle'&&left<=0)}, {onFinish:()=>{if(mode==='candle')m.classList.add('candle-finished');celebrateTimerFinish(m)}});setMode(m.dataset.interactiveMode);m._boardGetState=()=>({mode});m._boardSetState=state=>setMode(state?.mode||m.dataset.interactiveMode);m._cleanup=cleanup}

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
      if(r.width/boardCamera.scale<=aw&&r.height/boardCamera.scale<=ah){best=mid;lo=mid}else hi=mid;
    }
    m.style.setProperty('--clock-size',`${Math.max(12,best*.975)}px`);
  };
  const refit=()=>requestAnimationFrame(fit);

  m.querySelector('.clock-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.clock-font').addEventListener('click',()=>{cycleData(m,'font',FONT_OPTIONS);refit()});
  m.querySelector('.clock-text').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  const syncModeControls=()=>{
    const analog=m.dataset.clockMode==='analog';
    modeBtn.classList.toggle('is-active',analog);
    modeBtn.querySelector('span').textContent=analog?'◴':'◷';
    secondsBtn.hidden=analog;
    periodBtn.hidden=analog;
  };

  modeBtn.addEventListener('click',()=>{
    const analog=m.dataset.clockMode!=='analog';
    m.dataset.clockMode=analog?'analog':'digital';
    syncModeControls();
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
  syncModeControls();
  secondsBtn.classList.toggle('is-active',m.classList.contains('show-seconds'));
  periodBtn.classList.toggle('is-active',!m.classList.contains('hide-period'));
  const id=setInterval(update,100);
  update();
  m._cleanup=()=>{clearInterval(id);ro.disconnect()};
}



function setupWritingLines(m){
  const paper=m.querySelector('.writinglines-paper');
  const rows=[...m.querySelectorAll('.writinglines-row')];
  const entries=[...m.querySelectorAll('.writinglines-entry')];
  const toggle=m.querySelector('.writinglines-toggle-type');
  const countBtn=m.querySelector('.writinglines-count');
  const countLabel=countBtn?.querySelector('span');
  const clear=m.querySelector('.writinglines-clear');
  const resizeHandles=[...m.querySelectorAll('[data-resize]')];
  let fitFrame=0;
  let preferredHeight=m.offsetHeight;
  let userSizingHeight=false;

  const visibleRows=()=>rows.filter(row=>!row.hidden);
  const visibleEntries=()=>entries.filter(entry=>!entry.closest('.writinglines-row')?.hidden);

  const fitAll=()=>{
    cancelAnimationFrame(fitFrame);
    fitFrame=requestAnimationFrame(()=>{
      const activeRows=visibleRows();
      const activeEntries=visibleEntries();
      if(!paper||!activeRows.length)return;

      const paperStyle=getComputedStyle(paper);
      const padY=(parseFloat(paperStyle.paddingTop)||0)+(parseFloat(paperStyle.paddingBottom)||0);
      const borderY=Math.max(0,paper.offsetHeight-paper.clientHeight);
      const moduleChrome=Math.max(0,m.offsetHeight-paper.offsetHeight);

      const targetModuleHeight=userSizingHeight?m.offsetHeight:preferredHeight;
      const targetPaperOuter=Math.max(10,targetModuleHeight-moduleChrome);
      const targetPaperInner=Math.max(10,targetPaperOuter-borderY-padY);
      const baseRowHeight=targetPaperInner/activeRows.length;

      paper.style.setProperty('--writing-row-height',`${baseRowHeight}px`);

      const innerWidth=Math.max(10,
        paper.clientWidth-
        (parseFloat(paperStyle.paddingLeft)||0)-
        (parseFloat(paperStyle.paddingRight)||0)
      );
      const availableTextWidth=Math.max(10,innerWidth-10);
      let sharedScale=1;

      activeEntries.forEach(entry=>{
        const naturalWidth=Math.max(entry.clientWidth,entry.scrollWidth);
        if(naturalWidth>availableTextWidth){
          sharedScale=Math.min(sharedScale,availableTextWidth/naturalWidth);
        }
      });

      sharedScale=Math.max(.22,Math.min(1,sharedScale));
      const finalRowHeight=baseRowHeight*sharedScale;
      paper.style.setProperty('--writing-row-height',`${finalRowHeight}px`);

      if(!userSizingHeight){
        const desiredPaperOuter=finalRowHeight*activeRows.length+padY+borderY;
        const desiredModuleHeight=moduleChrome+desiredPaperOuter;
        if(Math.abs(m.offsetHeight-desiredModuleHeight)>.75){
          m.style.height=`${desiredModuleHeight}px`;
        }
      }
    });
  };

  const setLineCount=count=>{
    const next=Math.max(1,Math.min(4,Number(count)||3));
    m.dataset.lineCount=String(next);
    rows.forEach((row,index)=>{
      row.hidden=index>=next;
    });
    if(countLabel)countLabel.textContent=String(next);
    countBtn?.setAttribute('aria-label',`${next} writing ${next===1?'line':'lines'}; click to change`);
    countBtn?.setAttribute('title',`${next} writing ${next===1?'line':'lines'} — click to change`);
    fitAll();
  };

  const setMode=typing=>{
    m.dataset.writingMode=typing?'type':'practice';
    toggle.classList.toggle('is-active',typing);
    entries.forEach(entry=>{
      entry.setAttribute('contenteditable',typing?'true':'false');
      entry.tabIndex=typing&&!entry.closest('.writinglines-row')?.hidden?0:-1;
    });
    fitAll();
    if(typing)requestAnimationFrame(()=>visibleEntries()[0]?.focus({preventScroll:true}));
  };

  toggle.addEventListener('click',()=>setMode(m.dataset.writingMode!=='type'));

  countBtn?.addEventListener('click',()=>{
    const current=Number(m.dataset.lineCount)||3;
    const next=current>=4?1:current+1;
    setLineCount(next);
    setMode(m.dataset.writingMode==='type');
  });

  clear.addEventListener('click',()=>{
    entries.forEach(entry=>entry.textContent='');
    fitAll();
    if(m.dataset.writingMode==='type')visibleEntries()[0]?.focus({preventScroll:true});
  });

  entries.forEach(entry=>{
    entry.addEventListener('input',fitAll);

    entry.addEventListener('keydown',e=>{
      const visible=visibleEntries();
      const index=visible.indexOf(entry);
      if(index<0)return;

      if(e.key==='Enter'){
        e.preventDefault();
        visible[Math.min(visible.length-1,index+1)]?.focus({preventScroll:true});
      }else if(e.key==='ArrowDown'&&index<visible.length-1){
        e.preventDefault();
        visible[index+1].focus({preventScroll:true});
      }else if(e.key==='ArrowUp'&&index>0){
        e.preventDefault();
        visible[index-1].focus({preventScroll:true});
      }
    });

    entry.addEventListener('paste',e=>{
      e.preventDefault();
      const text=(e.clipboardData||window.clipboardData)?.getData('text/plain')||'';
      document.execCommand('insertText',false,text.replace(/[\r\n]+/g,' '));
      requestAnimationFrame(fitAll);
    });
  });

  m.querySelector('.writinglines-bg').addEventListener('click',()=>{
    cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']);
  });

  m.querySelector('.writinglines-text').addEventListener('click',()=>{
    cycleData(m,'text',['dark','soft','blue','rose','white']);
  });

  resizeHandles.forEach(handle=>{
    const direction=handle.dataset.resize||'';
    if(!/[tb]/.test(direction))return;

    const begin=()=>{
      userSizingHeight=true;
    };
    const finish=()=>{
      preferredHeight=m.offsetHeight;
      userSizingHeight=false;
      fitAll();
    };

    handle.addEventListener('pointerdown',begin,true);
    handle.addEventListener('pointerup',finish,true);
    handle.addEventListener('pointercancel',finish,true);
  });

  const resizeObserver=new ResizeObserver(fitAll);
  resizeObserver.observe(m);
  if(paper)resizeObserver.observe(paper);

  if(document.fonts?.ready){
    document.fonts.ready.then(fitAll);
  }

  setLineCount(Number(m.dataset.lineCount)||3);
  setMode(m.dataset.writingMode==='type');
  fitAll();

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    cancelAnimationFrame(fitFrame);
    resizeObserver.disconnect();
  };
}

function setupStopwatch(m){
  const display=m.querySelector('.stopwatch-display');
  const start=m.querySelector('.stopwatch-start');
  const lap=m.querySelector('.stopwatch-lap');
  const clear=m.querySelector('.stopwatch-clear');
  const laps=m.querySelector('.stopwatch-laps');
  const bgBtn=m.querySelector('.stopwatch-bg');
  const fontBtn=m.querySelector('.stopwatch-font');
  const textBtn=m.querySelector('.stopwatch-text');
  const modeBtn=m.querySelector('.stopwatch-toggle-mode');
  const analogHand=m.querySelector('.analog-stopwatch-hand');
  const subdialHand=m.querySelector('.analog-stopwatch-subdial-hand');

  let running=false,startedAt=0,elapsed=0,raf=0,lapCount=0;

  const format=ms=>{
    const total=Math.max(0,ms);
    const minutes=Math.floor(total/60000);
    const seconds=Math.floor(total/1000)%60;
    const hundredths=Math.floor(total/10)%100;
    return `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}.${String(hundredths).padStart(2,'0')}`;
  };

  const current=()=>elapsed+(running?performance.now()-startedAt:0);

  const render=()=>{
    const now=current();
    display.textContent=format(now);

    const totalSeconds=now/1000;
    const seconds=totalSeconds%60;
    const minutes=(totalSeconds/60)%30;

    analogHand.style.transform=`translateX(-50%) rotate(${seconds*6}deg)`;
    subdialHand.style.transform=`translateX(-50%) rotate(${minutes*12}deg)`;

    if(running)raf=requestAnimationFrame(render);
  };

  start.addEventListener('click',()=>{
    if(running){
      elapsed=current();
      running=false;
      cancelAnimationFrame(raf);
      start.textContent='Start';
      render();
    }else{
      startedAt=performance.now();
      running=true;
      start.textContent='Pause';
      render();
    }
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
    running=false;
    cancelAnimationFrame(raf);
    startedAt=0;
    elapsed=0;
    lapCount=0;
    display.textContent='00:00.00';
    laps.replaceChildren();
    start.textContent='Start';
    analogHand.style.transform='translateX(-50%) rotate(0deg)';
    subdialHand.style.transform='translateX(-50%) rotate(0deg)';
  });

  bgBtn?.addEventListener('click',()=>{
    cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']);
  });

  fontBtn?.addEventListener('click',()=>{
    cycleData(m,'font',FONT_OPTIONS);
  });

  textBtn?.addEventListener('click',()=>{
    cycleData(m,'text',['dark','soft','blue','rose','white']);
  });

  const syncModeControl=()=>{
    const analog=m.dataset.stopwatchMode==='analog';
    modeBtn?.classList.toggle('is-active',analog);
    const icon=modeBtn?.querySelector('span');
    if(icon)icon.textContent=analog?'◴':'◷';
  };

  modeBtn?.addEventListener('click',()=>{
    const analog=m.dataset.stopwatchMode!=='analog';
    m.dataset.stopwatchMode=analog?'analog':'digital';
    syncModeControl();
    render();
  });

  m._boardGetState=()=>({
    elapsed:current(),
    running,
    laps:[...laps.querySelectorAll('.stopwatch-lap-row')].reverse().map(row=>({
      label:row.querySelector('span')?.textContent||'',
      time:row.querySelector('strong')?.textContent||''
    }))
  });
  m._boardSetState=state=>{
    if(!state)return;
    cancelAnimationFrame(raf);
    running=false;
    elapsed=Math.max(0,Number(state.elapsed)||0);
    startedAt=0;
    lapCount=0;
    laps.replaceChildren();
    for(const item of Array.isArray(state.laps)?state.laps:[]){
      lapCount++;
      const row=document.createElement('div');
      row.className='stopwatch-lap-row';
      row.innerHTML=`<span>${item.label||`Lap ${lapCount}`}</span><strong>${item.time||format(elapsed)}</strong>`;
      laps.prepend(row);
    }
    if(state.running&&elapsed>0){
      startedAt=performance.now();
      running=true;
      start.textContent='Pause';
    }else start.textContent=elapsed>0?'Start':'Start';
    render();
  };

  syncModeControl();
  render();
  m._cleanup=()=>cancelAnimationFrame(raf);
}

function setupMagnifier(m){
  const lens=m.querySelector('.magnifier-lens');
  const liveView=m.querySelector('.magnifier-live-view');
  const zoomValue=m.querySelector('.magnifier-zoom-value');
  const handleValue=m.querySelector('.magnifier-handle span');
  const zoomOut=m.querySelector('.magnifier-zoom-out');
  const zoomIn=m.querySelector('.magnifier-zoom-in');
  let zoom=clamp(Number(m.dataset.zoom)||2,1.5,3);
  let target=null;
  let clone=null;
  let lastCloneAt=0;
  let raf=0;
  let dead=false;

  const lensCenter=()=>{
    const rect=lens.getBoundingClientRect();
    return screenToBoard(rect.left+rect.width/2,rect.top+rect.height/2);
  };

  const targetUnderLens=()=>{
    const center=lensCenter();
    const candidates=[...workspace.querySelectorAll('.module')].filter(module=>{
      if(module===m||module.dataset.type==='magnifier'||!module.isConnected)return false;
      const left=module.offsetLeft,top=module.offsetTop;
      return center.x>=left&&center.x<=left+module.offsetWidth&&center.y>=top&&center.y<=top+module.offsetHeight;
    });
    return candidates.sort((a,b)=>{
      const z=(Number(a.style.zIndex)||0)-(Number(b.style.zIndex)||0);
      return z||([...workspace.children].indexOf(a)-[...workspace.children].indexOf(b));
    }).at(-1)||null;
  };

  const copyLiveState=(source,next)=>{
    const sourceFields=[...source.querySelectorAll('input,textarea,select')];
    const nextFields=[...next.querySelectorAll('input,textarea,select')];
    sourceFields.forEach((field,index)=>{
      const copy=nextFields[index];
      if(!copy)return;
      copy.value=field.value;
      if('checked'in field)copy.checked=field.checked;
    });
    next.querySelectorAll('[id]').forEach(element=>element.removeAttribute('id'));
    next.removeAttribute('id');
    next.querySelectorAll('button,input,textarea,select,a,[contenteditable]').forEach(control=>{
      control.tabIndex=-1;
      control.setAttribute('aria-hidden','true');
    });
  };

  const rebuildClone=nextTarget=>{
    liveView.replaceChildren();
    clone=null;
    if(!nextTarget)return;
    const next=nextTarget.cloneNode(true);
    next.classList.remove('is-selected','is-dragging','is-over-trash','is-snap-target','snap-pop');
    next.classList.add('magnifier-source-clone');
    next.setAttribute('aria-hidden','true');
    copyLiveState(nextTarget,next);
    next.style.width=`${nextTarget.offsetWidth}px`;
    next.style.height=`${nextTarget.offsetHeight}px`;
    next.style.minWidth='0';
    next.style.minHeight='0';
    next.style.maxWidth='none';
    next.style.maxHeight='none';
    next.style.margin='0';
    next.style.zIndex='1';
    next.style.pointerEvents='none';
    liveView.appendChild(next);
    const sourceCanvases=[...nextTarget.querySelectorAll('canvas')];
    const nextCanvases=[...next.querySelectorAll('canvas')];
    sourceCanvases.forEach((source,index)=>{
      const copy=nextCanvases[index];
      if(!copy)return;
      try{copy.getContext('2d')?.drawImage(source,0,0)}catch{}
    });
    clone=next;
  };

  const syncZoom=()=>{
    zoom=clamp(Math.round(zoom*4)/4,1.5,3);
    m.dataset.zoom=String(zoom);
    const label=`${Number.isInteger(zoom)?zoom:zoom.toFixed(2).replace(/0$/,'')}×`;
    zoomValue.textContent=label;
    handleValue.textContent=label;
    zoomOut.disabled=zoom<=1.5;
    zoomIn.disabled=zoom>=3;
    notifyBoardChanged('magnifier-zoom');
  };

  const positionClone=()=>{
    if(!clone||!target)return;
    const center=lensCenter();
    clone.style.setProperty('left',`${liveView.offsetWidth/2+(target.offsetLeft-center.x)*zoom}px`,'important');
    clone.style.setProperty('top',`${liveView.offsetHeight/2+(target.offsetTop-center.y)*zoom}px`,'important');
    clone.style.setProperty('transform-origin','0 0','important');
    clone.style.setProperty('transform',`scale(${zoom})`,'important');
  };

  const loop=now=>{
    if(dead||!m.isConnected)return;
    const nextTarget=targetUnderLens();
    if(nextTarget!==target||now-lastCloneAt>220){
      target=nextTarget;
      rebuildClone(target);
      lastCloneAt=now;
      m.classList.toggle('has-magnified-target',Boolean(target));
    }
    positionClone();
    raf=requestAnimationFrame(loop);
  };

  zoomOut.addEventListener('click',()=>{zoom-=.25;syncZoom()});
  zoomIn.addEventListener('click',()=>{zoom+=.25;syncZoom()});
  syncZoom();
  raf=requestAnimationFrame(loop);

  m._boardGetState=()=>({zoom});
  m._boardSetState=state=>{zoom=clamp(Number(state?.zoom)||2,1.5,3);syncZoom()};
  const priorCleanup=m._cleanup;
  m._cleanup=()=>{dead=true;cancelAnimationFrame(raf);priorCleanup?.()};
}

function setupDraw(m){
  const toggle=m.querySelector('.draw-toggle');
  const toggleLabel=m.querySelector('.draw-toggle-label');
  const color=m.querySelector('.draw-color');
  const swatch=m.querySelector('.draw-color-swatch');
  const size=m.querySelector('.draw-size');
  const clear=m.querySelector('.draw-clear');
  const undo=m.querySelector('.draw-undo');
  const redo=m.querySelector('.draw-redo');
  const toolButtons=[...m.querySelectorAll('.draw-tool')];

  const canvas=document.createElement('canvas');
  canvas.className='board-drawing-canvas';
  const drawScale=Math.min(1,4800/BOARD_WIDTH,3200/BOARD_HEIGHT);
  canvas.width=Math.max(1,Math.round(BOARD_WIDTH*drawScale));
  canvas.height=Math.max(1,Math.round(BOARD_HEIGHT*drawScale));
  canvas.style.width=`${BOARD_WIDTH}px`;
  canvas.style.height=`${BOARD_HEIGHT}px`;
  workspace.appendChild(canvas);

  const ctx=canvas.getContext('2d',{alpha:true,desynchronized:true})||canvas.getContext('2d');
  const dpr=drawScale;
  ctx.scale(dpr,dpr);
  ctx.lineCap='round';
  ctx.lineJoin='round';

  const baseCanvas=document.createElement('canvas');
  baseCanvas.width=canvas.width;
  baseCanvas.height=canvas.height;
  const baseCtx=baseCanvas.getContext('2d',{alpha:true})||baseCanvas.getContext('2d');

  let enabled=false;
  let tool='brush';
  let drawing=false;
  let currentStroke=null;
  let drawActions=[];
  let drawCursor=0;
  let baseImageData='';
  let pendingPoints=[];
  let drawFrame=0;
  let imageLoadToken=0;

  const updatePointerMode=()=>{
    canvas.classList.toggle('is-active',enabled);
    canvas.style.pointerEvents=enabled?'auto':'none';
    toggle.classList.toggle('is-on',enabled);
    toggle.setAttribute('aria-pressed',String(enabled));
    toggleLabel.textContent=enabled?'ON':'OFF';
    canvas.dataset.tool=tool;
  };

  const updateSwatch=()=>{swatch.style.background=color.value};
  updateSwatch();

  const updateHistoryButtons=()=>{
    undo.disabled=drawCursor<=0;
    redo.disabled=drawCursor>=drawActions.length;
  };

  toggle.addEventListener('click',()=>{enabled=!enabled;updatePointerMode()});
  color.addEventListener('input',updateSwatch);

  toolButtons.forEach(b=>b.addEventListener('click',()=>{
    tool=b.dataset.drawTool;
    toolButtons.forEach(x=>x.classList.toggle('is-active',x===b));
    canvas.dataset.tool=tool;
  }));

  const drawSegment=(action,from,to)=>{
    const dx=to.x-from.x,dy=to.y-from.y;
    const distance=Math.hypot(dx,dy);
    const dt=Math.max(1,(to.time||0)-(from.time||0));
    const speed=distance/dt;
    const baseSize=Number(action.size)||10;
    ctx.save();

    if(action.tool==='eraser'){
      ctx.globalCompositeOperation='destination-out';
      ctx.globalAlpha=1;
      ctx.strokeStyle='#000';
      ctx.lineWidth=Math.max(4,baseSize*1.6);
      ctx.lineCap='round';
      ctx.beginPath();
      ctx.moveTo(from.x,from.y);
      ctx.lineTo(to.x,to.y);
      ctx.stroke();
    }else if(action.tool==='pencil'){
      ctx.globalCompositeOperation='source-over';
      ctx.globalAlpha=.9;
      ctx.strokeStyle=action.color;
      ctx.lineWidth=Math.max(1,baseSize*.28);
      ctx.lineCap='round';
      ctx.beginPath();
      ctx.moveTo(from.x,from.y);
      ctx.lineTo(to.x,to.y);
      ctx.stroke();
    }else{
      const speedFactor=clamp(1.15-speed*.18,.58,1.15);
      const brushWidth=Math.max(2,baseSize*speedFactor);
      ctx.globalCompositeOperation='source-over';
      ctx.globalAlpha=.72;
      ctx.strokeStyle=action.color;
      ctx.lineWidth=brushWidth;
      ctx.lineCap='round';
      ctx.shadowColor=action.color;
      ctx.shadowBlur=Math.max(.5,brushWidth*.16);
      ctx.beginPath();
      ctx.moveTo(from.x,from.y);
      ctx.quadraticCurveTo(from.x,from.y,to.x,to.y);
      ctx.stroke();
      ctx.globalAlpha=.18;
      ctx.lineWidth=brushWidth*1.35;
      ctx.shadowBlur=0;
      ctx.beginPath();
      ctx.moveTo(from.x,from.y);
      ctx.lineTo(to.x,to.y);
      ctx.stroke();
    }
    ctx.restore();
  };

  const renderAction=action=>{
    if(action.type==='clear'){
      ctx.clearRect(0,0,BOARD_WIDTH,BOARD_HEIGHT);
      return;
    }
    const points=Array.isArray(action.points)?action.points:[];
    if(points.length===1)drawSegment(action,points[0],{...points[0],x:points[0].x+.01,y:points[0].y+.01,time:points[0].time+1});
    for(let index=1;index<points.length;index++)drawSegment(action,points[index-1],points[index]);
  };

  const redraw=()=>{
    ctx.save();
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,BOARD_WIDTH,BOARD_HEIGHT);
    if(baseCanvas.width&&baseCanvas.height)ctx.drawImage(baseCanvas,0,0,BOARD_WIDTH,BOARD_HEIGHT);
    for(let index=0;index<drawCursor;index++)renderAction(drawActions[index]);
    ctx.restore();
    updateHistoryButtons();
  };

  const setHistoryCursor=next=>{
    drawCursor=clamp(Math.round(Number(next)||0),0,drawActions.length);
    redraw();
  };

  const changeHistory=(next,reason)=>{
    const before=drawCursor;
    const after=clamp(next,0,drawActions.length);
    if(before===after)return;
    setHistoryCursor(after);
    recordHistory({type:'drawing',el:m,before,after,reason});
  };

  const pushAction=action=>{
    if(drawCursor<drawActions.length)drawActions.splice(drawCursor);
    const before=drawCursor;
    drawActions.push(action);
    drawCursor=drawActions.length;
    updateHistoryButtons();
    recordHistory({type:'drawing',el:m,before,after:drawCursor});
  };

  undo.addEventListener('click',()=>changeHistory(drawCursor-1,'draw-undo'));
  redo.addEventListener('click',()=>changeHistory(drawCursor+1,'draw-redo'));
  clear.addEventListener('click',()=>{
    const action={type:'clear'};
    renderAction(action);
    pushAction(action);
  });

  const point=e=>screenToBoard(e.clientX,e.clientY);

  const appendPendingPoint=()=>{
    drawFrame=0;
    if(!pendingPoints.length||!drawing||!currentStroke){pendingPoints=[];return}
    const points=pendingPoints;
    pendingPoints=[];
    for(const next of points){
      const prior=currentStroke.points.at(-1);
      if(Math.hypot(next.x-prior.x,next.y-prior.y)<.18)continue;
      currentStroke.points.push(next);
      drawSegment(currentStroke,prior,next);
    }
  };

  const flushPendingPoint=()=>{
    if(drawFrame){cancelAnimationFrame(drawFrame);drawFrame=0}
    appendPendingPoint();
  };

  const down=e=>{
    if(!enabled||e.button!==0)return;
    pendingPoints=[];
    drawing=true;
    const p=point(e);
    currentStroke={type:'stroke',tool,color:color.value,size:Number(size.value),points:[{x:p.x,y:p.y,time:performance.now()}]};
    canvas.setPointerCapture?.(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  };

  const move=e=>{
    if(!drawing||!enabled||!currentStroke)return;
    const events=typeof e.getCoalescedEvents==='function'?e.getCoalescedEvents():[e];
    for(const event of events){
      const p=point(event);
      pendingPoints.push({x:p.x,y:p.y,time:Number(event.timeStamp)||performance.now()});
    }
    if(!drawFrame)drawFrame=requestAnimationFrame(appendPendingPoint);
    e.preventDefault();
  };

  const up=()=>{
    if(drawing&&currentStroke){
      flushPendingPoint();
      if(currentStroke.points.length===1)renderAction(currentStroke);
      pushAction(currentStroke);
    }
    drawing=false;
    currentStroke=null;
  };

  canvas.addEventListener('pointerdown',down);
  canvas.addEventListener('pointermove',move);
  canvas.addEventListener('pointerup',up);
  canvas.addEventListener('pointercancel',up);

  updatePointerMode();
  updateHistoryButtons();
  m._setDrawHistoryCursor=setHistoryCursor;
  m._deactivate=()=>{enabled=false;updatePointerMode();canvas.hidden=true};
  m._reactivate=()=>{canvas.hidden=false;updatePointerMode()};

  const compactAction=action=>{
    if(action.type==='clear')return{t:'c'};
    let priorTime=0;
    return{
      t:'s',
      k:action.tool,
      c:action.color,
      z:Number(action.size)||10,
      p:(action.points||[]).map((p,index)=>{
        const time=Number(p.time)||0;
        const delta=index?clamp(Math.round(time-priorTime),1,80):0;
        priorTime=time;
        return[Math.round(Number(p.x)*10)/10,Math.round(Number(p.y)*10)/10,delta];
      })
    };
  };

  const expandAction=action=>{
    if(action?.t==='c'||action?.type==='clear')return{type:'clear'};
    if(action?.t!=='s'&&action?.type!=='stroke')return null;
    let time=0;
    const points=(Array.isArray(action.p)?action.p:action.points||[]).map(point=>{
      if(Array.isArray(point)){
        time+=Number(point[2])||0;
        return{x:Number(point[0])||0,y:Number(point[1])||0,time};
      }
      time=Number(point.time)||time+16;
      return{x:Number(point.x)||0,y:Number(point.y)||0,time};
    });
    if(!points.length)return null;
    return{
      type:'stroke',
      tool:action.k||action.tool||'brush',
      color:action.c||action.color||'#17191d',
      size:Number(action.z??action.size)||10,
      points
    };
  };

  m._boardGetState=()=>({
    image:baseImageData,
    actions:drawActions.slice(0,drawCursor).map(compactAction),
    tool,
    color:color.value,
    size:size.value
  });
  m._boardSetState=state=>{
    if(!state)return;
    if(state.color){color.value=state.color;updateSwatch()}
    if(state.size)size.value=String(state.size);
    if(state.tool){
      tool=state.tool;
      toolButtons.forEach(button=>button.classList.toggle('is-active',button.dataset.drawTool===tool));
      canvas.dataset.tool=tool;
    }
    drawActions=(Array.isArray(state.actions)?state.actions:[]).map(expandAction).filter(Boolean);
    drawCursor=drawActions.length;
    baseImageData=typeof state.image==='string'?state.image:'';
    const loadToken=++imageLoadToken;
    if(state.image){
      const image=new Image();
      image.onload=()=>{
        if(loadToken!==imageLoadToken)return;
        baseCtx.clearRect(0,0,baseCanvas.width,baseCanvas.height);
        baseCtx.drawImage(image,0,0,baseCanvas.width,baseCanvas.height);
        redraw();
      };
      image.onerror=()=>{
        if(loadToken!==imageLoadToken)return;
        baseCtx.clearRect(0,0,baseCanvas.width,baseCanvas.height);
        redraw();
      };
      image.src=state.image;
    }else{
      baseCtx.clearRect(0,0,baseCanvas.width,baseCanvas.height);
      redraw();
    }
  };

  const priorCleanup=m._cleanup;
  m._cleanup=()=>{
    if(drawFrame)cancelAnimationFrame(drawFrame);
    imageLoadToken++;
    canvas.remove();
    priorCleanup?.();
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
    const dpr=Math.min(2,window.devicePixelRatio||1);
    waveW=Math.max(120,waveform.clientWidth);
    waveH=Math.max(70,waveform.clientHeight);
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

function setupStarChart(m){
  const importView=m.querySelector('.starchart-import');
  const dashboard=m.querySelector('.starchart-dashboard');
  const className=m.querySelector('.starchart-class-name');
  const wholeClassName=m.querySelector('.starchart-whole-class-name');
  const wholeClassLogo=m.querySelector('.starchart-whole-badge');
  const changeClass=m.querySelector('.starchart-change-class');
  const modeButtons=[...m.querySelectorAll('[data-starchart-mode]')];
  const studentView=m.querySelector('.starchart-student-view');
  const wholeView=m.querySelector('.starchart-whole-view');
  const studentGrid=m.querySelector('.starchart-student-grid');
  const noStudents=m.querySelector('.starchart-no-students');
  const wholeCount=m.querySelector('.starchart-whole-count b');
  const wholeBundles=m.querySelector('.starchart-whole-bundles');
  const wholeAdd=m.querySelector('.starchart-whole-add');
  const wholeRemove=m.querySelector('.starchart-whole-remove');
  const showAllButton=m.querySelector('.starchart-show-all');
  let activeClassId='';
  let pendingClassId='';
  let roster=null;
  let progress=normalizeStarChartProgress(null,[]);
  let showAllStudents=false;
  let collapsedHeight=Math.max(380,m.offsetHeight||560);
  let showAllFrame=0;
  const animationTimers=new Set();
  const flyingStars=new Set();
  const bundleLevels=[
    {weight:1000,level:3,label:'1K'},
    {weight:100,level:2,label:'100'},
    {weight:10,level:1,label:'10'},
    {weight:1,level:0,label:'1'}
  ];

  const currentRoster=()=>readClassRosters().find(item=>item.id===activeClassId)||null;

  const syncShowAllSize=()=>{
    showAllFrame=0;
    if(!showAllStudents||progress.mode!=='student'||studentView.hidden||studentGrid.hidden){
      if(showAllStudents)m.style.height=`${collapsedHeight}px`;
      return;
    }
    m.style.height=`${collapsedHeight}px`;
    const availableGridHeight=studentGrid.clientHeight;
    const fullGridHeight=studentGrid.scrollHeight;
    const desired=fullGridHeight<=availableGridHeight+1?collapsedHeight:Math.ceil(collapsedHeight-availableGridHeight+fullGridHeight+4);
    m.style.height=`${clamp(desired,collapsedHeight,Math.max(collapsedHeight,BOARD_HEIGHT-m.offsetTop))}px`;
  };

  const scheduleShowAllSize=()=>{
    if(showAllFrame)cancelAnimationFrame(showAllFrame);
    showAllFrame=requestAnimationFrame(syncShowAllSize);
  };

  const setShowAllStudents=(show,{notify=false,captureHeight=true}={})=>{
    const next=Boolean(show);
    if(next&&!showAllStudents&&captureHeight)collapsedHeight=Math.max(380,m.offsetHeight||collapsedHeight);
    showAllStudents=next;
    m.classList.toggle('is-showing-all-students',showAllStudents);
    showAllButton.setAttribute('aria-pressed',String(showAllStudents));
    if(showAllStudents)scheduleShowAllSize();
    else{
      if(showAllFrame)cancelAnimationFrame(showAllFrame);
      showAllFrame=0;
      m.style.height=`${collapsedHeight}px`;
    }
    if(notify)notifyBoardChanged('star-chart-show-all');
  };

  const scheduleAnimation=(callback,delay)=>{
    const timer=setTimeout(()=>{animationTimers.delete(timer);callback()},delay);
    animationTimers.add(timer);
    return timer;
  };

  const renderStarBundles=(container,total,ownerLabel)=>{
    const count=normalizeStarChartCount(total);
    container.replaceChildren();
    container.dataset.total=String(count);
    if(!count){
      const empty=document.createElement('span');
      empty.className='starchart-star-empty';
      empty.textContent='No stars yet';
      container.append(empty);
      return;
    }

    let remaining=count;
    bundleLevels.forEach(level=>{
      const quantity=Math.floor(remaining/level.weight);
      remaining%=level.weight;
      for(let index=0;index<quantity;index++){
        const token=document.createElement('button');
        token.type='button';
        token.className=`starchart-star-token starchart-star-token--level-${level.level}`;
        token.dataset.starAction='remove';
        token.dataset.bundleValue=String(level.weight);
        const represented=level.weight===1?'1 star':`${level.weight.toLocaleString()} stars`;
        token.setAttribute('aria-label',`${represented} for ${ownerLabel}. Remove one star.`);
        token.title=`${represented} combined · click to remove 1`;
        const icon=document.createElement('span');icon.textContent='★';icon.setAttribute('aria-hidden','true');
        const value=document.createElement('small');value.textContent=level.label;value.setAttribute('aria-hidden','true');
        token.append(icon,value);container.append(token);
      }
    });
  };

  const landingTargetFor=studentKey=>{
    const container=studentKey==='__whole__'?wholeBundles:[...studentGrid.querySelectorAll('[data-student-key]')].find(row=>row.dataset.studentKey===studentKey)?.querySelector('.starchart-star-stage');
    if(!container)return null;
    const tokens=container.querySelectorAll('.starchart-star-token');
    return tokens[tokens.length-1]||container;
  };

  const animateStarAward=(sourceRect,targetRect)=>{
    const popLanding=()=>{
      if(!targetRect||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
      const flash=document.createElement('span');
      flash.className='starchart-landing-flash';
      flash.textContent='★';
      flash.setAttribute('aria-hidden','true');
      flash.style.left=`${targetRect.left+targetRect.width*.5}px`;
      flash.style.top=`${targetRect.top+targetRect.height*.5}px`;
      document.body.append(flash);
      flyingStars.add(flash);
      scheduleAnimation(()=>{flyingStars.delete(flash);flash.remove()},520);
    };
    if(!sourceRect||!targetRect||matchMedia('(prefers-reduced-motion: reduce)').matches)return;

    const star=document.createElement('span');
    star.className='starchart-flying-star';
    star.textContent='★';
    star.setAttribute('aria-hidden','true');
    const startX=sourceRect.left+Math.min(sourceRect.width*.78,sourceRect.width-10);
    const startY=sourceRect.top+sourceRect.height*.5;
    const endX=targetRect.left+targetRect.width*.5;
    const endY=targetRect.top+targetRect.height*.5;
    const dx=endX-startX;
    const dy=endY-startY;
    star.style.left=`${startX}px`;
    star.style.top=`${startY}px`;
    document.body.append(star);
    flyingStars.add(star);
    const animation=star.animate([
      {opacity:0,transform:'translate(-50%,-50%) scale(.15) rotate(-35deg)'},
      {offset:.18,opacity:1,transform:'translate(-50%,-50%) scale(1.45) rotate(35deg)'},
      {offset:.7,opacity:1,transform:`translate(calc(-50% + ${dx*.8}px),calc(-50% + ${dy-34}px)) scale(1.05) rotate(285deg)`},
      {opacity:0,transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.62) rotate(390deg)`}
    ],{duration:620,easing:'cubic-bezier(.2,.78,.24,1)',fill:'forwards'});
    scheduleAnimation(popLanding,455);
    const removeFlyingStar=()=>{flyingStars.delete(star);star.remove()};
    animation.finished.then(removeFlyingStar,removeFlyingStar);
  };

  const setSubtractPanelOpen=(card,open)=>{
    studentGrid.querySelectorAll('.starchart-subtract-panel').forEach(panel=>panel.hidden=true);
    studentGrid.querySelectorAll('.starchart-subtract-toggle').forEach(button=>button.setAttribute('aria-expanded','false'));
    studentGrid.querySelectorAll('.starchart-student-row.is-subtract-open').forEach(row=>row.classList.remove('is-subtract-open'));
    const panel=card?.querySelector('.starchart-subtract-panel');
    const toggle=card?.querySelector('.starchart-subtract-toggle');
    if(!panel||!toggle||!open){if(showAllStudents)scheduleShowAllSize();return}
    panel.hidden=false;
    card.classList.add('is-subtract-open');
    toggle.setAttribute('aria-expanded','true');
    requestAnimationFrame(()=>{const input=panel.querySelector('input');input?.focus({preventScroll:true});input?.select()});
    if(showAllStudents)scheduleShowAllSize();
  };

  const renderStudentGrid=()=>{
    studentGrid.replaceChildren();
    const students=roster?.students||[];
    studentGrid.style.setProperty('--starchart-student-count',String(students.length));
    noStudents.hidden=students.length>0;
    studentGrid.hidden=!students.length;

    students.forEach(name=>{
      const key=starChartStudentKey(name);
      const count=normalizeStarChartCount(progress.studentStars[key]);
      const row=document.createElement('article');
      row.className='starchart-student-row';
      row.dataset.studentKey=key;

      const main=document.createElement('div');main.className='starchart-student-row__main';
      const nameButton=document.createElement('button');
      nameButton.type='button';nameButton.className='starchart-student-name';nameButton.dataset.starAction='add';nameButton.setAttribute('aria-label',`Award a star to ${name}`);nameButton.title=`Click to award a star to ${name}`;
      const label=document.createElement('strong');label.textContent=name;label.title=name;
      const exact=document.createElement('span');
      const exactNumber=document.createElement('b');exactNumber.textContent=count.toLocaleString();
      exact.append(exactNumber,document.createTextNode(` ${count===1?'star':'stars'} total`));
      nameButton.append(label,exact);

      const starStage=document.createElement('div');starStage.className='starchart-star-stage';starStage.setAttribute('aria-label',`${count} stars earned by ${name}`);
      renderStarBundles(starStage,count,name);

      const subtractToggle=document.createElement('button');
      subtractToggle.type='button';subtractToggle.className='starchart-subtract-toggle';subtractToggle.dataset.subtractToggle='';subtractToggle.disabled=count===0;subtractToggle.setAttribute('aria-expanded','false');subtractToggle.setAttribute('aria-label',`Subtract multiple stars from ${name}`);
      subtractToggle.innerHTML='<span aria-hidden="true">−#</span><small>Subtract</small>';
      main.append(nameButton,starStage,subtractToggle);

      const panel=document.createElement('div');panel.className='starchart-subtract-panel';panel.hidden=true;
      const prompt=document.createElement('span');prompt.textContent=`Take stars away from ${name}`;
      const form=document.createElement('form');form.className='starchart-subtract-form';
      const input=document.createElement('input');input.type='number';input.min='1';input.max=String(count);input.step='1';input.value='1';input.inputMode='numeric';input.setAttribute('aria-label',`Number of stars to subtract from ${name}`);
      const takeAway=document.createElement('button');takeAway.type='submit';takeAway.textContent='Take away';
      const cancel=document.createElement('button');cancel.type='button';cancel.className='starchart-subtract-cancel';cancel.dataset.subtractCancel='';cancel.textContent='Cancel';
      subtractToggle.addEventListener('click',event=>{
        event.stopPropagation();
        setSubtractPanelOpen(row,subtractToggle.getAttribute('aria-expanded')!=='true');
      });
      cancel.addEventListener('click',event=>{event.stopPropagation();setSubtractPanelOpen(row,false)});
      form.addEventListener('submit',event=>{
        event.preventDefault();event.stopPropagation();
        if(!activeClassId)return;
        const currentValue=normalizeStarChartCount(progress.studentStars[key]);
        const requestedValue=Math.round(Number(input.value));
        if(!currentValue||!Number.isFinite(requestedValue)||requestedValue<1)return;
        progress.studentStars[key]=normalizeStarChartCount(currentValue-Math.min(currentValue,requestedValue));
        persistProgress();
        if(showAllStudents)scheduleShowAllSize();
      });
      form.append(input,takeAway,cancel);panel.append(prompt,form);
      row.append(main,panel);studentGrid.append(row);
    });
  };

  const render=()=>{
    const hasClass=Boolean(roster&&activeClassId);
    importView.hidden=hasClass;
    dashboard.hidden=!hasClass;
    if(!hasClass)return;
    className.textContent=roster.name;
    wholeClassName.textContent=roster.name;
    wholeClassLogo.textContent=normalizeClassLogo(roster.logo);
    wholeCount.textContent=String(progress.wholeClassStars);
    wholeRemove.disabled=progress.wholeClassStars===0;
    renderStarBundles(wholeBundles,progress.wholeClassStars,roster.name);
    const mode=progress.mode==='whole'?'whole':'student';
    modeButtons.forEach(button=>{
      const active=button.dataset.starchartMode===mode;
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-selected',String(active));
    });
    studentView.hidden=mode!=='student';
    wholeView.hidden=mode!=='whole';
    renderStudentGrid();
    if(showAllStudents)scheduleShowAllSize();
  };

  const loadClass=(classId,{notify=false}={})=>{
    const next=readClassRosters().find(item=>item.id===classId);
    if(!next){
      activeClassId='';roster=null;progress=normalizeStarChartProgress(null,[]);render();return false;
    }
    activeClassId=next.id;
    pendingClassId='';
    localStorage.setItem(starChartLastClassStorageKey(),activeClassId);
    roster=next;
    progress=normalizeStarChartProgress(next.starChart,next.students);
    render();
    if(notify)notifyBoardChanged('star-chart-class');
    return true;
  };

  const persistProgress=()=>{
    const saved=writeClassStarChart(activeClassId,progress);
    if(saved)progress=saved;
  };

  modeButtons.forEach(button=>button.addEventListener('click',()=>{
    const mode=button.dataset.starchartMode==='whole'?'whole':'student';
    if(progress.mode===mode)return;
    progress.mode=mode;
    persistProgress();
    notifyBoardChanged('star-chart-mode');
  }));

  studentGrid.addEventListener('click',event=>{
    const target=event.target instanceof Element?event.target:null;
    const row=target?.closest('[data-student-key]');
    if(!row||!activeClassId)return;
    if(target.closest('[data-subtract-toggle],[data-subtract-cancel]'))return;
    const action=target.closest('[data-star-action]');
    if(!action)return;
    const key=row.dataset.studentKey;
    const current=normalizeStarChartCount(progress.studentStars[key]);
    const adding=action.dataset.starAction==='add';
    if(!adding&&!current)return;
    const source=adding?action.getBoundingClientRect():null;
    progress.studentStars[key]=normalizeStarChartCount(current+(adding?1:-1));
    persistProgress();
    if(source)animateStarAward(source,landingTargetFor(key)?.getBoundingClientRect());
  });

  studentGrid.addEventListener('wheel',event=>{
    if(studentGrid.scrollHeight>studentGrid.clientHeight+1)event.stopPropagation();
  },{passive:true});
  showAllButton.addEventListener('click',()=>setShowAllStudents(!showAllStudents,{notify:true}));

  wholeAdd.addEventListener('click',()=>{
    const source=wholeAdd.getBoundingClientRect();
    progress.wholeClassStars=normalizeStarChartCount(progress.wholeClassStars+1);
    persistProgress();
    animateStarAward(source,landingTargetFor('__whole__')?.getBoundingClientRect());
  });
  wholeRemove.addEventListener('click',()=>{
    progress.wholeClassStars=normalizeStarChartCount(progress.wholeClassStars-1);
    persistProgress();
  });
  wholeBundles.addEventListener('click',event=>{
    if(!event.target.closest('.starchart-star-token')||!progress.wholeClassStars)return;
    progress.wholeClassStars=normalizeStarChartCount(progress.wholeClassStars-1);
    persistProgress();
  });
  changeClass.addEventListener('click',()=>{
    activeClassId='';pendingClassId='';roster=null;progress=normalizeStarChartProgress(null,[]);localStorage.removeItem(starChartLastClassStorageKey());render();notifyBoardChanged('star-chart-class');
  });

  m.querySelector('.starchart-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.starchart-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.starchart-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  const detachRosterLoader=attachClassRosterLoader(m.querySelector('.starchart-loader-anchor'),(_names,selectedRoster)=>loadClass(selectedRoster.id,{notify:true}));
  const handleClassesChange=()=>{
    if(!activeClassId){if(pendingClassId)loadClass(pendingClassId);return}
    const next=currentRoster();
    if(!next){activeClassId='';roster=null;progress=normalizeStarChartProgress(null,[]);localStorage.removeItem(starChartLastClassStorageKey());render();return}
    roster=next;progress=normalizeStarChartProgress(next.starChart,next.students);render();
  };
  const handleStarChartChange=event=>{
    if(event.detail?.classId!==activeClassId)return;
    const next=currentRoster();
    if(!next)return;
    roster=next;progress=normalizeStarChartProgress(next.starChart,next.students);render();
  };
  window.addEventListener('teachertiles:classeschange',handleClassesChange);
  window.addEventListener('teachertiles:starchartchange',handleStarChartChange);

  m._boardGetState=()=>({classId:activeClassId,showAllStudents,collapsedHeight});
  m._boardSetState=state=>{
    if(Number.isFinite(Number(state?.collapsedHeight)))collapsedHeight=clamp(Number(state.collapsedHeight),380,BOARD_HEIGHT);
    setShowAllStudents(Boolean(state?.showAllStudents),{captureHeight:false});
    const classId=String(state?.classId||'');
    if(!classId)return;
    if(!loadClass(classId))pendingClassId=classId;
  };
  const lastClassId=localStorage.getItem(starChartLastClassStorageKey())||'';
  if(!lastClassId||!loadClass(lastClassId))render();

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();detachRosterLoader();
    animationTimers.forEach(clearTimeout);animationTimers.clear();
    flyingStars.forEach(star=>star.remove());flyingStars.clear();
    if(showAllFrame)cancelAnimationFrame(showAllFrame);
    window.removeEventListener('teachertiles:classeschange',handleClassesChange);
    window.removeEventListener('teachertiles:starchartchange',handleStarChartChange);
  };
}

function setupClassMeter(m){
  const importView=m.querySelector('.classmeter-import');
  const dashboard=m.querySelector('.classmeter-dashboard');
  const className=m.querySelector('.classmeter-class-name');
  const classLogo=m.querySelector('.classmeter-class-logo');
  const changeClass=m.querySelector('.classmeter-change-class');
  const meter=m.querySelector('.classmeter-meter');
  const percent=m.querySelector('.classmeter-percent');
  const winCount=m.querySelector('.classmeter-win-count b');
  const fillButton=m.querySelector('.classmeter-fill');
  const decreaseButton=m.querySelector('.classmeter-decrease');
  const orientationButton=m.querySelector('.classmeter-orientation');
  const orientationIcon=orientationButton.querySelector('span');
  const orientationLabel=orientationButton.querySelector('strong');
  const settingsToggle=m.querySelector('.classmeter-settings-toggle');
  const settings=m.querySelector('.classmeter-settings');
  const removeWin=m.querySelector('.classmeter-remove-win');
  const resetWins=m.querySelector('.classmeter-reset-wins');
  const removeProgress=m.querySelector('.classmeter-remove-progress');
  const resetProgress=m.querySelector('.classmeter-reset-progress');
  const popup=m.querySelector('.classmeter-win-popup');
  let activeClassId='';
  let pendingClassId='';
  let roster=null;
  let progress=normalizeClassMeterProgress(null);
  let holding=false;
  let holdFrame=0;
  let lastFrameAt=0;
  let celebrationTimer=0;
  let celebrating=false;
  let stopFillSfx=null;

  const currentRoster=()=>readClassRosters().find(item=>item.id===activeClassId)||null;
  const renderProgress=()=>{
    const fill=Math.max(0,Math.min(100,Number(progress.fill)||0));
    m.style.setProperty('--classmeter-fill',`${fill}%`);
    m.classList.toggle('has-meter-fill',fill>0);
    meter.setAttribute('aria-valuenow',String(Math.round(fill)));
    percent.textContent=`${Math.round(fill)}%`;
    winCount.textContent=String(normalizeStarChartCount(progress.wins));
    decreaseButton.disabled=fill<=0||celebrating;
    removeProgress.disabled=fill<=0||celebrating;
    resetProgress.disabled=fill<=0||celebrating;
    removeWin.disabled=progress.wins<=0;
    resetWins.disabled=progress.wins<=0;
  };

  const render=()=>{
    const hasClass=Boolean(roster&&activeClassId);
    importView.hidden=hasClass;
    dashboard.hidden=!hasClass;
    if(!hasClass)return;
    className.textContent=roster.name;
    classLogo.textContent=normalizeClassLogo(roster.logo);
    renderProgress();
  };

  const persistProgress=()=>{
    const saved=writeClassMeter(activeClassId,progress);
    if(saved)progress=saved;
    renderProgress();
  };

  const setSettingsOpen=open=>{
    const show=Boolean(open);
    settings.hidden=!show;
    settingsToggle.setAttribute('aria-expanded',String(show));
  };

  const setOrientation=(orientation,{resize=false,notify=false}={})=>{
    const horizontal=orientation==='horizontal';
    m.dataset.orientation=horizontal?'horizontal':'vertical';
    orientationIcon.textContent=horizontal?'↕':'↔';
    orientationLabel.textContent=horizontal?'Vertical':'Horizontal';
    orientationButton.setAttribute('aria-label',`Switch to ${horizontal?'vertical':'horizontal'} meter`);
    if(resize){
      const width=horizontal?680:420;
      const height=horizontal?360:610;
      m.style.width=`${width}px`;
      m.style.height=`${height}px`;
      m.style.left=`${clamp(m.offsetLeft,0,BOARD_WIDTH-width)}px`;
      m.style.top=`${clamp(m.offsetTop,0,BOARD_HEIGHT-height)}px`;
    }
    if(notify)notifyBoardChanged('class-meter-orientation');
  };

  const stopHolding=({persist=true}={})=>{
    stopFillSfx?.();
    stopFillSfx=null;
    if(!holding)return;
    holding=false;
    m.classList.remove('is-meter-filling');
    if(holdFrame)cancelAnimationFrame(holdFrame);
    holdFrame=0;
    if(persist&&activeClassId&&!celebrating)persistProgress();
  };

  const celebrateFilledMeter=()=>{
    stopHolding({persist:false});
    celebrating=true;
    const saved=writeClassMeter(activeClassId,{fill:0,wins:normalizeStarChartCount(progress.wins+1)})||normalizeClassMeterProgress({fill:0,wins:progress.wins+1});
    progress={...saved,fill:100};
    renderProgress();
    m.classList.add('is-meter-filled');
    popup.hidden=false;
    launchConfetti(m);
    playUiSfx('confetti');
    clearTimeout(celebrationTimer);
    celebrationTimer=setTimeout(()=>{
      celebrating=false;
      progress=normalizeClassMeterProgress(saved);
      m.classList.remove('is-meter-filled');
      popup.hidden=true;
      renderProgress();
    },1500);
  };

  const fillTick=timestamp=>{
    if(!holding||celebrating)return;
    if(!lastFrameAt)lastFrameAt=timestamp;
    const elapsed=Math.min(50,Math.max(0,timestamp-lastFrameAt));
    lastFrameAt=timestamp;
    progress.fill=Math.min(100,progress.fill+elapsed*.022);
    renderProgress();
    if(progress.fill>=100){celebrateFilledMeter();return}
    holdFrame=requestAnimationFrame(fillTick);
  };

  const startHolding=()=>{
    if(holding||celebrating||!activeClassId)return;
    holding=true;
    lastFrameAt=performance.now();
    m.classList.add('is-meter-filling');
    stopFillSfx=startClassMeterFillSfx();
    holdFrame=requestAnimationFrame(fillTick);
  };

  const loadClass=(classId,{notify=false}={})=>{
    stopHolding({persist:false});
    clearTimeout(celebrationTimer);celebrating=false;m.classList.remove('is-meter-filled');popup.hidden=true;
    const next=readClassRosters().find(item=>item.id===classId);
    if(!next){activeClassId='';roster=null;progress=normalizeClassMeterProgress(null);render();return false}
    activeClassId=next.id;pendingClassId='';roster=next;progress=normalizeClassMeterProgress(next.classMeter);
    localStorage.setItem(classMeterLastClassStorageKey(),activeClassId);
    render();
    if(notify)notifyBoardChanged('class-meter-class');
    return true;
  };

  fillButton.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    event.preventDefault();
    try{fillButton.setPointerCapture(event.pointerId)}catch{}
    startHolding();
  });
  fillButton.addEventListener('pointerup',event=>{try{fillButton.releasePointerCapture(event.pointerId)}catch{}stopHolding()});
  fillButton.addEventListener('pointercancel',()=>stopHolding());
  fillButton.addEventListener('lostpointercapture',()=>stopHolding());
  fillButton.addEventListener('keydown',event=>{
    if((event.key===' '||event.key==='Enter')&&!event.repeat){event.preventDefault();startHolding()}
  });
  fillButton.addEventListener('keyup',event=>{
    if(event.key===' '||event.key==='Enter'){event.preventDefault();stopHolding()}
  });
  fillButton.addEventListener('blur',()=>stopHolding());

  settingsToggle.addEventListener('click',()=>setSettingsOpen(settings.hidden));
  orientationButton.addEventListener('click',()=>setOrientation(m.dataset.orientation==='horizontal'?'vertical':'horizontal',{resize:true,notify:true}));
  m.addEventListener('pointerdown',event=>{if(!settings.hidden&&!event.target.closest('.classmeter-settings-wrap'))setSettingsOpen(false)});
  m.addEventListener('pointerleave',()=>{
    if(holding)stopHolding();
    setSettingsOpen(false);
  });
  const decreaseProgress=()=>{if(!activeClassId||celebrating||progress.fill<=0)return;stopHolding({persist:false});progress.fill=Math.max(0,(Number(progress.fill)||0)-5);persistProgress()};
  decreaseButton.addEventListener('click',decreaseProgress);
  removeProgress.addEventListener('click',decreaseProgress);
  resetProgress.addEventListener('click',()=>{if(!activeClassId||celebrating||progress.fill<=0)return;stopHolding({persist:false});progress.fill=0;persistProgress();setSettingsOpen(false)});
  removeWin.addEventListener('click',()=>{if(!activeClassId||!progress.wins)return;progress.wins=normalizeStarChartCount(progress.wins-1);persistProgress()});
  resetWins.addEventListener('click',()=>{if(!activeClassId||!progress.wins)return;progress.wins=0;persistProgress();flushPbisCloudSave();setSettingsOpen(false)});
  changeClass.addEventListener('click',()=>{
    stopHolding();activeClassId='';pendingClassId='';roster=null;progress=normalizeClassMeterProgress(null);localStorage.removeItem(classMeterLastClassStorageKey());setSettingsOpen(false);render();notifyBoardChanged('class-meter-class');
  });

  m.querySelector('.classmeter-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.classmeter-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.classmeter-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  const detachRosterLoader=attachClassRosterLoader(m.querySelector('.classmeter-loader-anchor'),(_names,selectedRoster)=>loadClass(selectedRoster.id,{notify:true}));
  const handleClassesChange=()=>{
    if(!activeClassId){if(pendingClassId)loadClass(pendingClassId);return}
    const next=currentRoster();
    if(!next){activeClassId='';roster=null;progress=normalizeClassMeterProgress(null);localStorage.removeItem(classMeterLastClassStorageKey());render();return}
    roster=next;
    if(!holding&&!celebrating)progress=normalizeClassMeterProgress(next.classMeter);
    render();
  };
  const handleMeterChange=event=>{
    if(event.detail?.classId!==activeClassId||celebrating||holding)return;
    const next=currentRoster();if(!next)return;
    roster=next;progress=normalizeClassMeterProgress(next.classMeter);render();
  };
  window.addEventListener('teachertiles:classeschange',handleClassesChange);
  window.addEventListener('teachertiles:classmeterchange',handleMeterChange);

  m._boardGetState=()=>({classId:activeClassId,orientation:m.dataset.orientation==='horizontal'?'horizontal':'vertical'});
  m._boardSetState=state=>{
    setOrientation(state?.orientation==='horizontal'?'horizontal':'vertical');
    const classId=String(state?.classId||'');
    if(classId&&!loadClass(classId))pendingClassId=classId;
  };
  setOrientation(m.dataset.orientation);
  const lastClassId=localStorage.getItem(classMeterLastClassStorageKey())||'';
  if(!lastClassId||!loadClass(lastClassId))render();

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();stopHolding();clearTimeout(celebrationTimer);detachRosterLoader();
    window.removeEventListener('teachertiles:classeschange',handleClassesChange);
    window.removeEventListener('teachertiles:classmeterchange',handleMeterChange);
  };
}


const PRIZE_STAT_OPTIONS=Object.freeze([
  Object.freeze({id:'studentStars',label:'Student Stars',icon:'★',scope:'student'}),
  Object.freeze({id:'studentPunchcardPoints',label:'Punchcard Points',icon:'●',scope:'student'}),
  Object.freeze({id:'studentRaceWins',label:'Race Wins',icon:'🏁',scope:'student'}),
  Object.freeze({id:'classStars',label:'Whole-class Stars',icon:'★',scope:'class'}),
  Object.freeze({id:'meterWins',label:'Class Meter Wins',icon:'🏆',scope:'class'}),
  Object.freeze({id:'jarsFilled',label:'Jars Filled',icon:'🫙',scope:'class'}),
  Object.freeze({id:'classPunchcardPoints',label:'Whole-class Punchcard Points',icon:'●',scope:'class'})
]);

function prizePresetImage(kind='gift'){
  const presets={
    gift:['#6c7be8','#8f6ad8','🎁'],game:['#3ea886','#74c86b','🎮'],snack:['#ee835e','#f0ba4a','🍿'],choice:['#4d91df','#7dc5f2','⭐'],break:['#6c8db7','#9bb9d5','🛋️'],music:['#b66bc6','#e58db5','🎵'],helper:['#e0a13e','#f5cf67','👑'],mystery:['#4d566e','#828ba2','❓']
  };
  const [a,b,emoji]=presets[kind]||presets.gift;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 360"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="600" height="360" rx="46" fill="url(#g)"/><circle cx="520" cy="55" r="110" fill="white" opacity=".11"/><circle cx="60" cy="330" r="130" fill="white" opacity=".08"/><text x="300" y="215" text-anchor="middle" font-size="150" font-family="Arial, sans-serif">${emoji}</text></svg>`;
  return`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function prizeId(){return globalThis.crypto?.randomUUID?crypto.randomUUID():`prize-${Date.now()}-${Math.random().toString(36).slice(2,8)}`}
function normalizePrize(value){
  const source=value&&typeof value==='object'?value:{};
  const scope=source.scope==='class'?'class':'student';
  const allowed=scope==='student'?['studentStars','studentPunchcardPoints','studentRaceWins']:['classStars','meterWins','jarsFilled','classPunchcardPoints'];
  return{
    id:String(source.id||prizeId()),scope,title:String(source.title||'New Prize').trim().slice(0,80)||'New Prize',
    description:String(source.description||'').trim().slice(0,400),costStat:allowed.includes(source.costStat)?source.costStat:allowed[0],
    cost:Math.max(0,Math.min(9999,Math.round(Number(source.cost)||1))),image:String(source.image||prizePresetImage('gift'))
  };
}

function pbisBalance(roster,statId,studentName=''){
  if(!roster)return 0;
  if(statId==='studentStars')return normalizeStarChartCount(roster.starChart?.studentStars?.[starChartStudentKey(studentName)]);
  if(statId==='classStars')return normalizeStarChartCount(roster.starChart?.wholeClassStars);
  if(statId==='studentPunchcardPoints')return normalizePunchcardProgress(roster.punchcards,roster.students).studentPoints[starChartStudentKey(studentName)]||0;
  if(statId==='classPunchcardPoints')return normalizePunchcardProgress(roster.punchcards,roster.students).wholeClassPoints;
  if(statId==='studentRaceWins')return normalizeRacerProgress(roster.racer,roster.students).studentWins[starChartStudentKey(studentName)]||0;
  if(statId==='meterWins')return normalizeClassMeterProgress(roster.classMeter).wins;
  if(statId==='jarsFilled')return normalizeCollectionProgress(roster.collectionJar).jarsFilled;
  if(statId==='meterFill')return Math.round(normalizeClassMeterProgress(roster.classMeter).fill);
  if(statId==='jarItems')return normalizeCollectionProgress(roster.collectionJar).count;
  return 0;
}

function adjustPbisBalance(classId,statId,amount,{studentName='',mode='delta'}={}){
  const roster=readClassRosters().find(item=>item.id===classId);if(!roster)return null;
  const current=pbisBalance(roster,statId,studentName);
  let next=mode==='set'?Number(amount):current+Number(amount);
  if(statId==='meterFill')next=Math.max(0,Math.min(100,next));else if(statId==='jarItems')next=Math.max(0,Math.min(80,Math.round(next)));else next=normalizeStarChartCount(next);
  if(statId==='studentStars'||statId==='classStars'){
    const progress=normalizeStarChartProgress(roster.starChart,roster.students);
    if(statId==='studentStars')progress.studentStars[starChartStudentKey(studentName)]=next;else progress.wholeClassStars=next;
    writeClassStarChart(classId,progress);
  }else if(statId==='studentPunchcardPoints'||statId==='classPunchcardPoints'){
    const progress=normalizePunchcardProgress(roster.punchcards,roster.students);
    if(statId==='studentPunchcardPoints')progress.studentPoints[starChartStudentKey(studentName)]=next;else progress.wholeClassPoints=next;
    writeClassPunchcards(classId,progress);
  }else if(statId==='studentRaceWins'){
    const progress=normalizeRacerProgress(roster.racer,roster.students);
    progress.studentWins[starChartStudentKey(studentName)]=next;
    writeClassRacer(classId,progress);
  }else if(statId==='meterWins'||statId==='meterFill'){
    const progress=normalizeClassMeterProgress(roster.classMeter);
    if(statId==='meterWins')progress.wins=next;else progress.fill=next;
    writeClassMeter(classId,progress);
  }else if(statId==='jarsFilled'||statId==='jarItems'){
    const progress=normalizeCollectionProgress(roster.collectionJar);
    if(statId==='jarsFilled')progress.jarsFilled=next;else{progress.count=next;progress.filled=false}
    writeClassCollection(classId,progress);
  }
  flushPbisCloudSave();
  return next;
}

function makePrizeModal(){
  const overlay=document.createElement('div');overlay.className='prize-modal-overlay';overlay.hidden=true;
  const panel=document.createElement('section');panel.className='prize-modal';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');
  overlay.append(panel);document.body.append(overlay);
  overlay.addEventListener('pointerdown',event=>{if(event.target===overlay)overlay.hidden=true});
  return{overlay,panel,close:()=>{overlay.hidden=true;panel.replaceChildren()}};
}

async function downloadPrizeCoupon(prize,roster,recipient,statLabel){
  const canvas=document.createElement('canvas');canvas.width=1500;canvas.height=760;const ctx=canvas.getContext('2d');
  const draw=async()=>{
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const grad=ctx.createLinearGradient(0,0,1500,760);grad.addColorStop(0,'#edf6ff');grad.addColorStop(1,'#f4edff');ctx.fillStyle=grad;ctx.fillRect(0,0,1500,760);
    ctx.save();ctx.strokeStyle='#4d91df';ctx.lineWidth=8;ctx.setLineDash([24,18]);ctx.strokeRect(36,36,1428,688);ctx.restore();
    ctx.fillStyle='#1e4168';ctx.font='900 34px Arial';ctx.fillText('TEACHERTILES PRIZE COUPON',82,105);
    ctx.fillStyle='#132238';ctx.font='900 70px Arial';ctx.fillText(prize.title,82,205);
    ctx.fillStyle='#526174';ctx.font='600 29px Arial';
    const words=(prize.description||'Classroom reward').split(/\s+/);let line='',y=270;
    for(const word of words){const test=`${line}${word} `;if(ctx.measureText(test).width>790){ctx.fillText(line.trim(),82,y);line=`${word} `;y+=42}else line=test}if(line)ctx.fillText(line.trim(),82,y);
    ctx.fillStyle='#fff';ctx.strokeStyle='#d4dfed';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(82,470,850,190,28);ctx.fill();ctx.stroke();
    ctx.fillStyle='#6a7788';ctx.font='800 23px Arial';ctx.fillText('REDEEMED BY',120,525);ctx.fillStyle='#14243a';ctx.font='900 38px Arial';ctx.fillText(recipient,120,570);
    ctx.fillStyle='#6a7788';ctx.font='800 23px Arial';ctx.fillText('CLASS',510,525);ctx.fillStyle='#14243a';ctx.font='900 34px Arial';ctx.fillText(roster.name,510,570);
    ctx.fillStyle='#6a7788';ctx.font='800 23px Arial';ctx.fillText('COST',120,625);ctx.fillStyle='#286fb8';ctx.font='900 30px Arial';ctx.fillText(`${prize.cost} ${statLabel}`,220,625);
    try{
      const img=new Image();img.src=prize.image;await img.decode();
      const boxX=1000,boxY=130,boxW=390,boxH=390;
      const imageW=img.naturalWidth||img.width||boxW,imageH=img.naturalHeight||img.height||boxH;
      const scale=Math.min(boxW/imageW,boxH/imageH);
      const drawW=imageW*scale,drawH=imageH*scale,drawX=boxX+(boxW-drawW)/2,drawY=boxY+(boxH-drawH)/2;
      ctx.drawImage(img,drawX,drawY,drawW,drawH);
    }catch{}
    ctx.fillStyle='#53647a';ctx.font='700 21px Arial';ctx.fillText('Redeemed with TeacherTiles PBIS',1005,575);ctx.font='600 18px Arial';ctx.fillText(new Date().toLocaleDateString(),1005,612);
  };
  await draw();
  const link=document.createElement('a');link.download=`${prize.title.replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase()||'prize'}-coupon.png`;link.href=canvas.toDataURL('image/png');link.click();
}

function setupPrizeBoard(m){
  const importView=m.querySelector('.prizeboard-import'),dashboard=m.querySelector('.prizeboard-dashboard'),loaderAnchor=m.querySelector('.prizeboard-loader-anchor');
  const className=m.querySelector('.prizeboard-class-name'),classLogo=m.querySelector('.prizeboard-class-logo'),changeClass=m.querySelector('.prizeboard-change-class');
  const tabs=[...m.querySelectorAll('[data-prize-scope]')],grid=m.querySelector('.prizeboard-grid'),add=m.querySelector('.prizeboard-add');
  let activeClassId='',scope='student',prizes=[];const modal=makePrizeModal();
  const currentRoster=()=>readClassRosters().find(item=>item.id===activeClassId)||null;
  const statDefinition=id=>PRIZE_STAT_OPTIONS.find(item=>item.id===id)||PRIZE_STAT_OPTIONS[0];
  const notify=reason=>notifyBoardChanged(`prizeboard-${reason}`);
  const syncModuleSize=()=>requestAnimationFrame(()=>{
    if(!dashboard||dashboard.hidden)return;const count=Math.max(1,prizes.filter(p=>p.scope===scope).length);const width=Math.max(340,m.clientWidth-28);const cols=Math.max(1,Math.floor(width/190));const rows=Math.ceil(count/cols);const needed=245+rows*165;
    if(m.offsetHeight<needed)m.style.height=`${Math.min(BOARD_HEIGHT-m.offsetTop,needed)}px`;
  });
  const setClass=id=>{
    const roster=readClassRosters().find(item=>item.id===id);activeClassId=roster?.id||'';importView.hidden=Boolean(roster);dashboard.hidden=!roster;
    if(roster){className.textContent=roster.name;classLogo.textContent=normalizeClassLogo(roster.logo)}render();
  };
  const closeEditor=()=>modal.close();
  const openEditor=(existing=null)=>{
    const editing=existing?normalizePrize(existing):null;const working=editing||normalizePrize({scope,title:'',description:'',cost:1,image:prizePresetImage('gift')});
    modal.overlay.hidden=false;modal.panel.innerHTML=`<button class="prize-modal-close" type="button" aria-label="Close">×</button><div class="prize-editor"><div><small>${editing?'EDIT PRIZE':'NEW PRIZE'}</small><h2>${editing?'Update prize':'Create a prize'}</h2></div><label>Category<select class="prize-editor-scope"><option value="student">Prizes</option><option value="class">Whole Class Prizes</option></select></label><label>Title<input class="prize-editor-title" maxlength="80" placeholder="Prize title"></label><label>Description<textarea class="prize-editor-description" maxlength="400" rows="3" placeholder="What does the student earn?"></textarea></label><div class="prize-editor-row"><label>Cost<input class="prize-editor-cost" type="number" min="0" max="9999" step="1"></label><label>PBIS stat<select class="prize-editor-stat"></select></label></div><div><span class="prize-editor-label">Prize image</span><div class="prize-preset-grid"></div><label class="prize-upload">Upload your own<input type="file" accept="image/*"></label><div class="prize-editor-preview"><img alt="Prize preview"></div></div><div class="prize-editor-actions">${editing?'<button class="prize-editor-delete" type="button">Delete prize</button>':''}<button class="prize-editor-cancel" type="button">Cancel</button><button class="prize-editor-save" type="button">Save prize</button></div></div>`;
    const q=s=>modal.panel.querySelector(s),scopeSelect=q('.prize-editor-scope'),title=q('.prize-editor-title'),desc=q('.prize-editor-description'),cost=q('.prize-editor-cost'),stat=q('.prize-editor-stat'),preview=q('.prize-editor-preview img');
    scopeSelect.value=working.scope;title.value=working.title==='New Prize'?'':working.title;desc.value=working.description;cost.value=working.cost;preview.src=working.image;
    let selectedImage=working.image;
    const fillStats=()=>{const options=scopeSelect.value==='student'?PRIZE_STAT_OPTIONS.filter(item=>item.scope==='student'):PRIZE_STAT_OPTIONS.filter(item=>item.scope==='class');const wanted=stat.value||working.costStat;stat.replaceChildren(...options.map(item=>new Option(`${item.icon} ${item.label}`,item.id)));stat.value=options.some(item=>item.id===wanted)?wanted:options[0].id};fillStats();scopeSelect.addEventListener('change',fillStats);
    const presets=q('.prize-preset-grid');['gift','game','snack','choice','break','music','helper','mystery'].forEach(kind=>{const b=document.createElement('button');b.type='button';b.innerHTML=`<img src="${prizePresetImage(kind)}" alt="${kind} preset">`;b.addEventListener('click',()=>{selectedImage=prizePresetImage(kind);preview.src=selectedImage});presets.append(b)});
    q('.prize-upload input').addEventListener('change',event=>{const file=event.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{selectedImage=String(reader.result||selectedImage);preview.src=selectedImage};reader.readAsDataURL(file)});
    q('.prize-modal-close').addEventListener('click',closeEditor);q('.prize-editor-cancel').addEventListener('click',closeEditor);
    q('.prize-editor-delete')?.addEventListener('click',()=>{if(!confirm(`Delete ${working.title}?`))return;prizes=prizes.filter(item=>item.id!==working.id);closeEditor();render();notify('delete')});
    q('.prize-editor-save').addEventListener('click',()=>{const titleValue=title.value.trim();if(!titleValue){title.focus();return}const next=normalizePrize({id:editing?.id||prizeId(),scope:scopeSelect.value,title:titleValue,description:desc.value,cost:Number(cost.value),costStat:stat.value,image:selectedImage});if(editing)prizes=prizes.map(item=>item.id===editing.id?next:item);else prizes.push(next);scope=next.scope;closeEditor();render();notify('save')});
  };
  const openPrize=(prize)=>{
    const roster=currentRoster();if(!roster)return;const stat=statDefinition(prize.costStat);modal.overlay.hidden=false;
    const students=roster.students;modal.panel.innerHTML=`<button class="prize-modal-close" type="button" aria-label="Close">×</button><div class="prize-detail"><img class="prize-detail-image" src="${prize.image}" alt=""><div class="prize-detail-copy"><small>${prize.scope==='class'?'WHOLE CLASS PRIZE':'STUDENT PRIZE'}</small><h2></h2><p></p><div class="prize-detail-cost"><span>${stat.icon}</span><strong>${prize.cost}</strong><small>${stat.label}</small></div><div class="prize-redeem-target"></div><div class="prize-detail-balance"></div><div class="prize-detail-actions"><button class="prize-edit" type="button">Edit</button><button class="prize-redeem" type="button">Redeem prize</button></div></div></div>`;
    modal.panel.querySelector('h2').textContent=prize.title;modal.panel.querySelector('.prize-detail-copy>p').textContent=prize.description||'No description added.';
    const targetWrap=modal.panel.querySelector('.prize-redeem-target'),balance=modal.panel.querySelector('.prize-detail-balance'),redeem=modal.panel.querySelector('.prize-redeem');let student='';
    if(prize.scope==='student'){
      const label=document.createElement('label');label.innerHTML='<span>Redeem for</span>';const select=document.createElement('select');select.append(new Option(students.length?'Choose a student…':'No students in this class',''));students.forEach(name=>select.add(new Option(name,name)));label.append(select);targetWrap.append(label);select.addEventListener('change',()=>{student=select.value;refreshBalance()});
    }else{targetWrap.innerHTML=`<div class="prize-class-target"><span aria-hidden="true">${normalizeClassLogo(roster.logo)}</span><strong>${roster.name}</strong><small>Whole class redemption</small></div>`}
    const refreshBalance=()=>{const targetStudent=stat.scope==='student'?student:'';const amount=pbisBalance(currentRoster(),prize.costStat,targetStudent);const missing=amount<prize.cost;balance.innerHTML=`<span>Available balance</span><strong>${amount} ${stat.label}</strong>${missing?'<small>Not enough credit for this reward.</small>':''}`;redeem.disabled=missing||(prize.scope==='student'&&!student)};refreshBalance();
    modal.panel.querySelector('.prize-modal-close').addEventListener('click',()=>modal.close());modal.panel.querySelector('.prize-edit').addEventListener('click',()=>openEditor(prize));
    redeem.addEventListener('click',async()=>{const recipient=prize.scope==='class'?roster.name:student;if(!recipient)return;const spendStudent=stat.scope==='student'?student:'';if(pbisBalance(currentRoster(),prize.costStat,spendStudent)<prize.cost){refreshBalance();return}adjustPbisBalance(activeClassId,prize.costStat,-prize.cost,{studentName:spendStudent});modal.panel.innerHTML=`<button class="prize-modal-close" type="button" aria-label="Close">×</button><div class="prize-redeemed"><span aria-hidden="true">🎉</span><small>PRIZE REDEEMED</small><h2>${prize.title}</h2><p><strong>${recipient}</strong> redeemed this prize for ${prize.cost} ${stat.label}.</p><div class="prize-redeemed-actions"><button class="prize-coupon" type="button">Download coupon PNG</button><button class="prize-done" type="button">Done</button></div></div>`;modal.panel.querySelector('.prize-modal-close').addEventListener('click',()=>modal.close());modal.panel.querySelector('.prize-done').addEventListener('click',()=>modal.close());modal.panel.querySelector('.prize-coupon').addEventListener('click',()=>downloadPrizeCoupon(prize,roster,recipient,stat.label));});
  };
  const render=()=>{
    tabs.forEach(tab=>{const on=tab.dataset.prizeScope===scope;tab.classList.toggle('is-active',on);tab.setAttribute('aria-selected',String(on))});grid.replaceChildren();
    const visible=prizes.filter(item=>item.scope===scope);if(!visible.length){const empty=document.createElement('button');empty.type='button';empty.className='prizeboard-empty';empty.innerHTML=`<span aria-hidden="true">${scope==='class'?'🎉':'🎁'}</span><strong>No ${scope==='class'?'whole-class prizes':'prizes'} yet</strong><small>Add your first reward to this board.</small>`;empty.addEventListener('click',()=>openEditor());grid.append(empty)}
    visible.forEach(prize=>{const stat=statDefinition(prize.costStat);const card=document.createElement('article');card.className='prize-card';card.innerHTML=`<button class="prize-card-open" type="button"><img alt=""><span class="prize-card-copy"><strong></strong><small></small></span><span class="prize-card-cost"><i>${stat.icon}</i><b>${prize.cost}</b></span></button><button class="prize-card-delete" type="button" title="Delete prize">×</button>`;const openButton=card.querySelector('.prize-card-open'),deleteButton=card.querySelector('.prize-card-delete');openButton.setAttribute('aria-label',`Open ${prize.title}`);deleteButton.setAttribute('aria-label',`Delete ${prize.title}`);card.querySelector('img').src=prize.image;card.querySelector('.prize-card-copy strong').textContent=prize.title;card.querySelector('.prize-card-copy small').textContent=prize.description||stat.label;openButton.addEventListener('click',()=>openPrize(prize));deleteButton.addEventListener('click',event=>{event.stopPropagation();if(!confirm(`Delete ${prize.title}?`))return;prizes=prizes.filter(item=>item.id!==prize.id);render();notify('delete')});grid.append(card)});syncModuleSize();
  };
  tabs.forEach(tab=>tab.addEventListener('click',()=>{scope=tab.dataset.prizeScope;render();notify('tab')}));add.addEventListener('click',()=>openEditor());changeClass.addEventListener('click',()=>{activeClassId='';importView.hidden=false;dashboard.hidden=true;render();notify('class')});
  const detach=attachClassRosterLoader(loaderAnchor,(_,roster)=>{setClass(roster.id);notify('class')});
  m.querySelector('.prizeboard-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));m.querySelector('.prizeboard-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));m.querySelector('.prizeboard-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));
  const ro=new ResizeObserver(syncModuleSize);ro.observe(m);
  const refresh=()=>{if(activeClassId&&!currentRoster())setClass('');else render()};window.addEventListener('teachertiles:classeschange',refresh);window.addEventListener('teachertiles:starchartchange',refresh);window.addEventListener('teachertiles:classmeterchange',refresh);window.addEventListener('teachertiles:collectionchange',refresh);window.addEventListener('teachertiles:punchcardchange',refresh);window.addEventListener('teachertiles:racerchange',refresh);
  m._boardGetState=()=>({activeClassId,scope,prizes:prizes.map(normalizePrize)});m._boardSetState=state=>{if(!state)return;scope=state.scope==='class'?'class':'student';prizes=Array.isArray(state.prizes)?state.prizes.map(normalizePrize):[];setClass(String(state.activeClassId||''));render()};
  const prior=m._cleanup;m._cleanup=()=>{prior?.();detach();ro.disconnect();modal.overlay.remove();window.removeEventListener('teachertiles:classeschange',refresh);window.removeEventListener('teachertiles:starchartchange',refresh);window.removeEventListener('teachertiles:classmeterchange',refresh);window.removeEventListener('teachertiles:collectionchange',refresh);window.removeEventListener('teachertiles:punchcardchange',refresh);window.removeEventListener('teachertiles:racerchange',refresh)};
  render();
}

function setupPbisConsole(m){
  const importView=m.querySelector('.pbisconsole-import'),dashboard=m.querySelector('.pbisconsole-dashboard'),loaderAnchor=m.querySelector('.pbisconsole-loader-anchor'),className=m.querySelector('.pbisconsole-class-name'),classLogo=m.querySelector('.pbisconsole-class-logo'),changeClass=m.querySelector('.pbisconsole-change-class'),studentSelect=m.querySelector('.pbisconsole-student'),studentToolbar=m.querySelector('.pbisconsole-student-toolbar'),stats=m.querySelector('.pbisconsole-stats'),tabs=[...m.querySelectorAll('[data-pbisconsole-view]')];
  let activeClassId='',student='',view='students';
  const roster=()=>readClassRosters().find(item=>item.id===activeClassId)||null;
  const studentDefinitions=[{id:'studentStars',label:'Student Stars',icon:'★'},{id:'studentPunchcardPoints',label:'Punchcard Points',icon:'●'},{id:'studentRaceWins',label:'Race Wins',icon:'🏁'}];
  const classDefinitions=[{id:'classStars',label:'Whole-class Stars',icon:'★'},{id:'meterWins',label:'Class Meter Wins',icon:'🏆'},{id:'jarsFilled',label:'Jars Filled',icon:'🫙'},{id:'classPunchcardPoints',label:'Whole-class Punchcard Points',icon:'●'},{id:'meterFill',label:'Current Meter Fill',icon:'💧',suffix:'%'},{id:'jarItems',label:'Items in Current Jar',icon:'○'}];
  const setClass=id=>{
    const r=readClassRosters().find(item=>item.id===id);
    activeClassId=r?.id||'';
    importView.hidden=Boolean(r);dashboard.hidden=!r;
    if(r){
      className.textContent=r.name;classLogo.textContent=normalizeClassLogo(r.logo);
      const prior=student;
      studentSelect.replaceChildren(new Option(r.students.length?'Choose a student…':'No students',''));
      r.students.forEach(name=>studentSelect.add(new Option(name,name)));
      student=r.students.includes(prior)?prior:(r.students[0]||'');studentSelect.value=student;
    }
    render();
  };
  const render=()=>{
    const r=roster();if(!r)return;
    tabs.forEach(tab=>{const active=tab.dataset.pbisconsoleView===view;tab.classList.toggle('is-active',active);tab.setAttribute('aria-selected',String(active))});
    studentToolbar.hidden=view!=='students';
    stats.replaceChildren();
    const definitions=view==='students'?studentDefinitions:classDefinitions;
    definitions.forEach(def=>{
      const value=pbisBalance(r,def.id,student);
      const row=document.createElement('section');row.className='pbisconsole-stat';
      if(view==='students'){
        row.innerHTML=`<div class="pbisconsole-stat-copy"><span>${def.icon}</span><div><strong>${def.label}</strong><small>${student||'Choose a student'}</small></div></div><div class="pbisconsole-stat-value"><strong>${value}${def.suffix||''}</strong></div><div class="pbisconsole-reset"><button type="button" ${student&&value>0?'':'disabled'}>Reset</button></div>`;
        row.querySelector('button').addEventListener('click',()=>{if(!student)return;if(!confirm(`Reset ${def.label} for ${student}?`))return;adjustPbisBalance(activeClassId,def.id,0,{studentName:student,mode:'set'});render();notifyBoardChanged('pbis-console-student-reset')});
      }else{
        row.innerHTML=`<div class="pbisconsole-stat-copy"><span>${def.icon}</span><div><strong>${def.label}</strong><small>Whole class</small></div></div><div class="pbisconsole-stat-value"><strong>${value}${def.suffix||''}</strong></div><div class="pbisconsole-adjust"><input type="number" min="1" max="9999" step="1" value="1" aria-label="Adjustment amount"><button type="button" data-op="remove">Remove</button><button type="button" data-op="add">Add</button><button type="button" data-op="clear">Clear</button></div>`;
        const input=row.querySelector('input');
        row.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{const amount=Math.max(1,Math.round(Number(input.value)||1));if(button.dataset.op==='clear')adjustPbisBalance(activeClassId,def.id,0,{mode:'set'});else adjustPbisBalance(activeClassId,def.id,button.dataset.op==='add'?amount:-amount);render();notifyBoardChanged('pbis-console-class-adjust')}));
      }
      stats.append(row);
    });
  };
  tabs.forEach(tab=>tab.addEventListener('click',()=>{view=tab.dataset.pbisconsoleView==='class'?'class':'students';render();notifyBoardChanged('pbis-console-view')}));
  studentSelect.addEventListener('change',()=>{student=studentSelect.value;render();notifyBoardChanged('pbis-console-student')});
  changeClass.addEventListener('click',()=>{activeClassId='';student='';importView.hidden=false;dashboard.hidden=true;notifyBoardChanged('pbis-console-class')});
  const detach=attachClassRosterLoader(loaderAnchor,(_,r)=>{setClass(r.id);notifyBoardChanged('pbis-console-class')});
  m.querySelector('.pbisconsole-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.pbisconsole-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.pbisconsole-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));
  const refresh=()=>{if(activeClassId&&!roster())setClass('');else render()};
  ['teachertiles:classeschange','teachertiles:starchartchange','teachertiles:classmeterchange','teachertiles:collectionchange','teachertiles:punchcardchange','teachertiles:racerchange'].forEach(name=>window.addEventListener(name,refresh));
  m._boardGetState=()=>({activeClassId,student,view});
  m._boardSetState=state=>{student=String(state?.student||'');view=state?.view==='class'?'class':'students';setClass(String(state?.activeClassId||''))};
  const prior=m._cleanup;
  m._cleanup=()=>{prior?.();detach();['teachertiles:classeschange','teachertiles:starchartchange','teachertiles:classmeterchange','teachertiles:collectionchange','teachertiles:punchcardchange','teachertiles:racerchange'].forEach(name=>window.removeEventListener(name,refresh))};
}


function setupRacer(m){
  const importView=m.querySelector('.racer-import'),dashboard=m.querySelector('.racer-dashboard'),loaderAnchor=m.querySelector('.racer-loader-anchor');
  const className=m.querySelector('.racer-class-name'),classLogo=m.querySelector('.racer-class-logo'),changeClass=m.querySelector('.racer-change-class');
  const stage=m.querySelector('.racer-stage'),racers=m.querySelector('.racer-standees'),studentSelect=m.querySelector('.racer-student'),distanceInput=m.querySelector('.racer-distance'),moveButton=m.querySelector('.racer-move'),reset=m.querySelector('.racer-reset');
  const status=m.querySelector('.racer-status'),win=m.querySelector('.racer-win'),winName=m.querySelector('.racer-win-name'),winTotal=m.querySelector('.racer-win-total'),winDone=m.querySelector('.racer-win-done');
  let activeClassId='',selectedStudent='';
  const roster=()=>readClassRosters().find(item=>item.id===activeClassId)||null;
  const progress=()=>{const r=roster();return normalizeRacerProgress(r?.racer,r?.students||[])};
  const curveY=t=>54-40*t*(1-t);
  const keyFor=name=>starChartStudentKey(name);
  const studentIndex=(r,name)=>Math.max(0,r.students.indexOf(name));
  const tierFor=index=>index%6;
  const groupFor=index=>Math.floor(index/6)%5;
  const positionFor=(r,name,p)=>{
    const index=studentIndex(r,name),t=Math.max(0,Math.min(1,(p.positions[keyFor(name)]||0)/100));
    const x=Math.max(4.7,Math.min(95.3,6+t*88+(groupFor(index)-2)*.32));
    return{x,y:curveY(t),tier:tierFor(index),t};
  };
  const updateStatus=()=>{
    const r=roster();if(!r){status.textContent='';return}
    const p=progress(),finishers=r.students.filter(name=>p.finished[keyFor(name)]).length;
    status.textContent=finishers?`${finishers} ${finishers===1?'finisher':'finishers'} • Race continues until you reset`:'Move a student forward to begin the race';
  };
  const buildStandee=name=>{
    const r=roster(),visual=studentProfileVisual(name,r?.id||'');
    const node=document.createElement('button');node.type='button';node.className='racer-standee';node.dataset.student=name;node.setAttribute('aria-label',`Select ${name}`);
    node.innerHTML='<span class="racer-character"><span class="racer-face"><i></i><b></b></span><strong></strong><small>RACER</small></span><span class="racer-stick" aria-hidden="true"></span><span class="racer-winner-mark" aria-hidden="true">★</span>';
    node.style.setProperty('--racer-hue',String(visual.hue));
    node.querySelector('.racer-character strong').textContent=name;
    node.addEventListener('click',()=>{selectedStudent=name;studentSelect.value=name;renderSelection()});
    return node;
  };
  const renderSelection=()=>{
    const r=roster();if(!r)return;
    const p=progress(),key=keyFor(selectedStudent),done=Boolean(p.finished[key]);
    racers.querySelectorAll('.racer-standee').forEach(node=>node.classList.toggle('is-selected',node.dataset.student===selectedStudent));
    moveButton.disabled=!selectedStudent||done;distanceInput.disabled=!selectedStudent||done;
    moveButton.textContent=done?'Finished':'Add distance';
  };
  const renderTrack=()=>{
    const r=roster();if(!r)return;
    const p=progress(),wanted=new Set(r.students);
    racers.querySelectorAll('.racer-standee').forEach(node=>{if(!wanted.has(node.dataset.student))node.remove()});
    r.students.forEach(name=>{
      let node=[...racers.children].find(child=>child.dataset.student===name);
      if(!node){node=buildStandee(name);racers.append(node);requestAnimationFrame(()=>node.classList.add('is-ready'))}
      const pos=positionFor(r,name,p),key=keyFor(name),wins=p.studentWins[key]||0;
      node.style.left=`${pos.x}%`;node.style.top=`${pos.y}%`;node.style.setProperty('--racer-stick-height',`${18+pos.tier*14}px`);node.style.zIndex=String(20+pos.tier);
      node.classList.toggle('is-finished',Boolean(p.finished[key]));node.title=`${name} • ${Math.round(p.positions[key]||0)}% • ${wins} Race ${wins===1?'Win':'Wins'}`;
      const mark=node.querySelector('.racer-winner-mark');if(mark)mark.title=`${wins} Race ${wins===1?'Win':'Wins'}`;
    });
    updateStatus();renderSelection();
  };
  const render=()=>{
    const r=roster();if(!r)return;
    className.textContent=r.name;classLogo.textContent=normalizeClassLogo(r.logo);
    const prior=selectedStudent;studentSelect.replaceChildren(new Option(r.students.length?'Choose a student…':'No students',''));
    r.students.forEach(name=>studentSelect.add(new Option(name,name)));
    selectedStudent=r.students.includes(prior)?prior:(r.students[0]||'');studentSelect.value=selectedStudent;
    renderTrack();
  };
  const showWin=(name,total)=>{
    winName.textContent=name;winTotal.textContent=String(total);win.hidden=false;launchConfetti(m);playUiSfx('confetti');requestAnimationFrame(()=>winDone.focus({preventScroll:true}));
  };
  const moveStudent=()=>{
    const r=roster(),name=selectedStudent;if(!r||!name)return;
    const p=progress(),key=keyFor(name);if(p.finished[key])return;
    const amount=Math.max(1,Math.min(100,Math.round(Number(distanceInput.value)||1))),before=p.positions[key]||0,next=Math.min(100,before+amount),won=before<100&&next>=100;
    p.positions[key]=next;
    if(won){p.finished[key]=true;p.studentWins[key]=normalizeStarChartCount((p.studentWins[key]||0)+1)}
    writeClassRacer(activeClassId,p);if(won)flushPbisCloudSave();notifyBoardChanged('racer-distance');renderTrack();
    if(won)setTimeout(()=>showWin(name,p.studentWins[key]),520);
  };
  const resetRace=()=>{
    const r=roster();if(!r||!r.students.length)return;if(!confirm(`Reset the race board for ${r.name}? Race Win totals will be kept.`))return;
    const p=progress();r.students.forEach(name=>{const key=keyFor(name);p.positions[key]=0;p.finished[key]=false});writeClassRacer(activeClassId,p);flushPbisCloudSave();win.hidden=true;renderTrack();notifyBoardChanged('racer-reset');
  };
  const setClass=id=>{
    const r=readClassRosters().find(item=>item.id===id);activeClassId=r?.id||'';importView.hidden=Boolean(r);dashboard.hidden=!r;win.hidden=true;
    if(r)selectedStudent=r.students.includes(selectedStudent)?selectedStudent:(r.students[0]||'');else selectedStudent='';render();
  };
  studentSelect.addEventListener('change',()=>{selectedStudent=studentSelect.value;renderSelection();notifyBoardChanged('racer-student')});
  distanceInput.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();moveStudent()}});
  moveButton.addEventListener('click',moveStudent);reset.addEventListener('click',resetRace);winDone.addEventListener('click',()=>{win.hidden=true;moveButton.focus({preventScroll:true})});
  changeClass.addEventListener('click',()=>{activeClassId='';selectedStudent='';win.hidden=true;importView.hidden=false;dashboard.hidden=true;notifyBoardChanged('racer-class')});
  const detach=attachClassRosterLoader(loaderAnchor,(_,r)=>{setClass(r.id);notifyBoardChanged('racer-class')});
  m.querySelector('.racer-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.racer-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.racer-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));
  const refresh=()=>{if(activeClassId&&!roster())setClass('');else render()};
  ['teachertiles:classeschange','teachertiles:racerchange'].forEach(name=>window.addEventListener(name,refresh));
  const ro=new ResizeObserver(renderTrack);ro.observe(stage);
  m._boardGetState=()=>({activeClassId,selectedStudent});
  m._boardSetState=state=>{selectedStudent=String(state?.selectedStudent||'');setClass(String(state?.activeClassId||''))};
  const prior=m._cleanup;m._cleanup=()=>{prior?.();detach();ro.disconnect();['teachertiles:classeschange','teachertiles:racerchange'].forEach(name=>window.removeEventListener(name,refresh))};
  render();
}

function setupPunchcards(m){
  const importView=m.querySelector('.punchcard-import'),dashboard=m.querySelector('.punchcard-dashboard'),loaderAnchor=m.querySelector('.punchcard-loader-anchor');
  const className=m.querySelector('.punchcard-class-name'),classLogo=m.querySelector('.punchcard-class-logo'),changeClass=m.querySelector('.punchcard-change-class');
  const tabs=[...m.querySelectorAll('[data-punchcard-scope]')],studentWrap=m.querySelector('.punchcard-student-wrap'),studentSelect=m.querySelector('.punchcard-student');
  const card=m.querySelector('.punchcard-card'),cardName=m.querySelector('.punchcard-name'),cardType=m.querySelector('.punchcard-type'),holes=m.querySelector('.punchcard-holes'),points=m.querySelector('.punchcard-points-value');
  const reset=m.querySelector('.punchcard-reset'),complete=m.querySelector('.punchcard-complete'),completeName=m.querySelector('.punchcard-complete-name'),completePoints=m.querySelector('.punchcard-complete-points'),completeDone=m.querySelector('.punchcard-complete-done');
  let activeClassId='',scope='student',student='',busy=false;
  const roster=()=>readClassRosters().find(item=>item.id===activeClassId)||null;
  const targetKey=()=>starChartStudentKey(student);
  const currentProgress=()=>{
    const r=roster();if(!r)return 0;const progress=normalizePunchcardProgress(r.punchcards,r.students);
    return scope==='class'?progress.wholeClassProgress:(progress.studentProgress[targetKey()]||0);
  };
  const currentPoints=()=>{
    const r=roster();if(!r)return 0;const progress=normalizePunchcardProgress(r.punchcards,r.students);
    return scope==='class'?progress.wholeClassPoints:(progress.studentPoints[targetKey()]||0);
  };
  const persistProgress=value=>{
    const r=roster();if(!r)return;const progress=normalizePunchcardProgress(r.punchcards,r.students);const next=Math.max(0,Math.min(9,Math.round(Number(value)||0)));
    if(scope==='class')progress.wholeClassProgress=next;else if(student)progress.studentProgress[targetKey()]=next;
    writeClassPunchcards(activeClassId,progress);notifyBoardChanged('punchcard-progress');
  };
  const awardPoint=()=>{
    const r=roster();if(!r)return;const progress=normalizePunchcardProgress(r.punchcards,r.students);
    if(scope==='class'){progress.wholeClassPoints=normalizeStarChartCount(progress.wholeClassPoints+1);progress.wholeClassProgress=0}
    else if(student){const key=targetKey();progress.studentPoints[key]=normalizeStarChartCount((progress.studentPoints[key]||0)+1);progress.studentProgress[key]=0}
    writeClassPunchcards(activeClassId,progress);flushPbisCloudSave();notifyBoardChanged('punchcard-complete');
  };
  const render=()=>{
    const r=roster();if(!r)return;
    tabs.forEach(tab=>{const active=tab.dataset.punchcardScope===scope;tab.classList.toggle('is-active',active);tab.setAttribute('aria-selected',String(active))});
    studentWrap.hidden=scope!=='student';
    const prior=student;studentSelect.replaceChildren(new Option(r.students.length?'Choose a student…':'No students in this class',''));r.students.forEach(name=>studentSelect.add(new Option(name,name)));
    student=r.students.includes(prior)?prior:(r.students[0]||'');studentSelect.value=student;
    const target=scope==='class'?r.name:(student||'Choose a student');cardName.textContent=target;cardType.textContent=scope==='class'?'WHOLE CLASS PUNCHCARD':'STUDENT PUNCHCARD';points.textContent=String(currentPoints());
    card.classList.toggle('is-disabled',scope==='student'&&!student);holes.replaceChildren();const punched=currentProgress();
    for(let i=0;i<10;i++){
      const hole=document.createElement('button');hole.type='button';hole.className='punchcard-hole';hole.dataset.index=String(i);hole.setAttribute('aria-label',i<punched?`Punch ${i+1} completed`:`Punch hole ${i+1}`);hole.disabled=busy||i<punched||(scope==='student'&&!student);if(i<punched)hole.classList.add('is-punched');
      hole.addEventListener('click',event=>punch(hole,i,event));holes.append(hole);
    }
    reset.disabled=currentProgress()===0||(scope==='student'&&!student);
  };
  const punch=(hole,index,event)=>{
    if(busy||index!==currentProgress())return;
    busy=true;
    playUiSfx('hole-punch');
    const cardRect=card.getBoundingClientRect(),holeRect=hole.getBoundingClientRect();
    const disk=document.createElement('span');
    disk.className='punchcard-punched-disk';
    const size=Math.max(12,holeRect.width);
    const clickX=Number.isFinite(event?.clientX)?event.clientX:holeRect.left+holeRect.width/2;
    const clickY=Number.isFinite(event?.clientY)?event.clientY:holeRect.top+holeRect.height/2;
    disk.style.left=`${clickX-cardRect.left-size/2}px`;
    disk.style.top=`${clickY-cardRect.top-size/2}px`;
    disk.style.width=`${size}px`;
    disk.style.height=`${size}px`;
    disk.style.setProperty('--punch-fall-distance',`${Math.max(150,cardRect.bottom-clickY+size+86)}px`);
    disk.style.setProperty('--punch-drift-x',`${Math.round((Math.random()-.5)*42)}px`);
    disk.style.setProperty('--punch-drift-mid',`${Math.round((Math.random()-.5)*18)}px`);
    disk.style.setProperty('--punch-spin',`${Math.round((Math.random()>.5?1:-1)*(150+Math.random()*150))}deg`);
    card.append(disk);
    disk.addEventListener('animationend',()=>disk.remove(),{once:true});
    setTimeout(()=>disk.remove(),1250);
    hole.classList.add('is-punching');
    setTimeout(()=>{
      if(index===9){const target=scope==='class'?roster()?.name:student;awardPoint();completeName.textContent=target||'Punchcard';completePoints.textContent=String(currentPoints());complete.hidden=false;completeDone.focus({preventScroll:true})}
      else persistProgress(index+1);
      busy=false;render();
    },260);
  };
  const setClass=id=>{
    const r=readClassRosters().find(item=>item.id===id);activeClassId=r?.id||'';importView.hidden=Boolean(r);dashboard.hidden=!r;
    if(r){className.textContent=r.name;classLogo.textContent=normalizeClassLogo(r.logo);student=r.students.includes(student)?student:(r.students[0]||'')}
    render();
  };
  tabs.forEach(tab=>tab.addEventListener('click',()=>{scope=tab.dataset.punchcardScope==='class'?'class':'student';complete.hidden=true;render();notifyBoardChanged('punchcard-scope')}));
  studentSelect.addEventListener('change',()=>{student=studentSelect.value;complete.hidden=true;render();notifyBoardChanged('punchcard-student')});
  reset.addEventListener('click',()=>{const target=scope==='class'?roster()?.name:student;if(!target||currentProgress()===0)return;if(!confirm(`Reset the current Punchcard for ${target}?`))return;persistProgress(0);render()});
  completeDone.addEventListener('click',()=>{complete.hidden=true;render()});
  changeClass.addEventListener('click',()=>{activeClassId='';student='';complete.hidden=true;importView.hidden=false;dashboard.hidden=true;notifyBoardChanged('punchcard-class')});
  const detach=attachClassRosterLoader(loaderAnchor,(_,r)=>{setClass(r.id);notifyBoardChanged('punchcard-class')});
  m.querySelector('.punchcard-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.punchcard-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.punchcard-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));
  const refresh=()=>{if(activeClassId&&!roster())setClass('');else render()};
  ['teachertiles:classeschange','teachertiles:punchcardchange'].forEach(name=>window.addEventListener(name,refresh));
  m._boardGetState=()=>({activeClassId,scope,student});
  m._boardSetState=state=>{scope=state?.scope==='class'?'class':'student';student=String(state?.student||'');setClass(String(state?.activeClassId||''))};
  const prior=m._cleanup;m._cleanup=()=>{prior?.();detach();['teachertiles:classeschange','teachertiles:punchcardchange'].forEach(name=>window.removeEventListener(name,refresh))};
  render();
}

function setupCollections(m){
  const importView=m.querySelector('.collection-import'),dashboard=m.querySelector('.collection-dashboard'),className=m.querySelector('.collection-class-name'),classLogo=m.querySelector('.collection-class-logo'),changeClass=m.querySelector('.collection-change-class');
  const canvas=m.querySelector('.collection-canvas'),ctx=canvas.getContext('2d'),fillHandle=m.querySelector('.collection-fill-line-handle'),add=m.querySelector('.collection-add'),typeBtn=m.querySelector('.collection-type'),typeLabel=m.querySelector('.collection-type-label'),picker=m.querySelector('.collection-picker'),pickerButtons=[...m.querySelectorAll('[data-collection-type]')],countEl=m.querySelector('.collection-count'),bgBtn=m.querySelector('.collection-bg');
  const filledBanner=m.querySelector('.collection-filled-banner'),restart=m.querySelector('.collection-restart'),bannerRestart=m.querySelector('.collection-banner-restart'),settingsToggle=m.querySelector('.collection-settings-toggle'),settings=m.querySelector('.collection-settings'),jarsFilledEl=m.querySelector('.collection-jars-filled'),emptyCurrent=m.querySelector('.collection-empty-current'),addFill=m.querySelector('.collection-add-fill'),removeFill=m.querySelector('.collection-remove-fill'),resetFills=m.querySelector('.collection-reset-fills');
  const types=[
    {id:'pompom',label:'Pom poms'},{id:'candy',label:'Candies'},{id:'star',label:'Stars'},
    {id:'jellybean',label:'Jellybeans'},{id:'fruit',label:'Fruits'},{id:'coin',label:'Coins'}
  ];
  const colors=['#ef7e91','#70bce9','#f1c858','#72c58a','#9a82d8','#ef9b61'];
  const jarBehind=new Image();
  jarBehind.src='assets/jar-behind.png';
  let typeIndex=0,bodies=[],particles=[],raf=0,last=performance.now(),cw=260,ch=320,dpr=1,dead=false,currentJar=null;
  let activeClassId='',pendingClassId='',roster=null,progress=normalizeCollectionProgress(null),writing=false,fillArmedAt=0,fillReachedAt=0,draggingFillLine=false;

  const jarRectFor=(w,h)=>{const size=Math.max(140,Math.min(w*.96,h*.98));return{x:(w-size)/2,y:(h-size)/2,w:size,h:size}};
  const jarBounds=()=>{const j=currentJar||jarRectFor(cw,ch);return{floor:j.y+j.h*.895,top:j.y+j.h*.105,neckL:j.x+j.w*.285,neckR:j.x+j.w*.715,bodyL:j.x+j.w*.215,bodyR:j.x+j.w*.785,shoulderTop:j.y+j.h*.205,shoulderBottom:j.y+j.h*.31,bottomCurve:j.y+j.h*.765,bottomL:j.x+j.w*.265,bottomR:j.x+j.w*.735,j}};
  const fillLineY=()=>{const j=jarBounds().j;return j.y+j.h*progress.fillLine};
  const wallsAt=y=>{const b=jarBounds();if(y<b.shoulderTop)return[b.neckL,b.neckR];if(y<b.shoulderBottom){const t=clamp((y-b.shoulderTop)/(b.shoulderBottom-b.shoulderTop),0,1),ease=t*t*(3-2*t);return[b.neckL+(b.bodyL-b.neckL)*ease,b.neckR+(b.bodyR-b.neckR)*ease]}if(y>b.bottomCurve){const t=clamp((y-b.bottomCurve)/(b.floor-b.bottomCurve),0,1),ease=t*t*(3-2*t);return[b.bodyL+(b.bottomL-b.bodyL)*ease,b.bodyR+(b.bottomR-b.bodyR)*ease]}return[b.bodyL,b.bodyR]};
  const positionFillHandle=()=>{if(!fillHandle)return;const line=fillLineY(),[,lineR]=wallsAt(line);fillHandle.style.left=`${lineR+8}px`;fillHandle.style.top=`${line}px`};

  function resizeCanvas(){
    const nw=Math.max(220,canvas.clientWidth),nh=Math.max(210,canvas.clientHeight),old=currentJar||jarRectFor(cw,ch),next=jarRectFor(nw,nh),scale=next.w/old.w;
    if(bodies.length)for(const b of bodies){b.x=next.x+(b.x-old.x)*scale;b.y=next.y+(b.y-old.y)*scale;b.r*=scale}
    if(particles.length)for(const p of particles){p.x=next.x+(p.x-old.x)*scale;p.y=next.y+(p.y-old.y)*scale;p.r*=scale}
    cw=nw;ch=nh;currentJar=next;dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.round(cw*dpr);canvas.height=Math.round(ch*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);positionFillHandle()
  }
  const ro=new ResizeObserver(resizeCanvas);ro.observe(canvas);resizeCanvas();

  function burst(body,n=7){
    for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=18+Math.random()*48;particles.push({type:body.type,variant:body.variant,color:body.color,x:body.x+(Math.random()-.5)*body.r*.5,y:body.y+body.r*.4,vx:Math.cos(a)*s,vy:Math.sin(a)*s-18,life:.38+Math.random()*.28,max:.66,r:Math.max(1.4,body.r*(.11+Math.random()*.08)),rot:Math.random()*Math.PI*2,av:(Math.random()-.5)*4})}
  }

  function addItem({persist=true,detect=true}={}){
    if(bodies.length>=80||progress.filled||!activeClassId)return;
    const t=types[typeIndex],b=jarBounds(),r=Math.max(9,Math.min(16,b.j.w*.036))*(.88+Math.random()*.22);
    bodies.push({type:t.id,x:(b.neckL+b.neckR)/2+(Math.random()-.5)*(b.neckR-b.neckL)*.28,y:b.top-r-22,vx:(Math.random()-.5)*20,vy:18+Math.random()*12,r,rot:(Math.random()-.5)*.4,av:(Math.random()-.5)*1.25,color:colors[bodies.length%colors.length],variant:Math.floor(Math.random()*4),impact:false,onFloor:false,bornAt:detect?performance.now():performance.now()-1200});
    if(detect)fillArmedAt=performance.now()+300;
    updateCount();
    if(persist)persistProgress();
  }
  function updateCount(){
    countEl.textContent=`${bodies.length} item${bodies.length===1?'':'s'}`;
    jarsFilledEl.textContent=String(normalizeStarChartCount(progress.jarsFilled));
    emptyCurrent.disabled=bodies.length<=0&&!progress.filled;
    removeFill.disabled=progress.jarsFilled<=0;
    resetFills.disabled=progress.jarsFilled<=0;
  }

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
    particles=particles.filter(p=>p.life>0);
    checkJarFilled();
  }

  function checkJarFilled(){
    const now=performance.now();
    if(progress.filled||!activeClassId||now<fillArmedAt){fillReachedAt=0;return}
    const line=fillLineY(),bounds=jarBounds(),tolerance=Math.max(3,bounds.j.h*.012);
    const pileTop=bodies.reduce((top,body)=>{
      const age=now-(Number(body.bornAt)||0);
      const settledEnough=age>=450&&Math.abs(body.vy)<180&&Math.abs(body.vx)<100;
      const insideJar=body.y>=bounds.shoulderTop&&body.y<=bounds.floor;
      return settledEnough&&insideJar?Math.min(top,body.y-body.r):top;
    },Infinity);
    const reached=Number.isFinite(pileTop)&&pileTop<=line+tolerance;
    if(!reached){
      if(fillReachedAt&&now-fillReachedAt<140)return;
      fillReachedAt=0;
      return;
    }
    if(!fillReachedAt){fillReachedAt=now;return}
    if(now-fillReachedAt<180)return;
    fillReachedAt=0;
    progress.filled=true;
    progress.jarsFilled=normalizeStarChartCount(progress.jarsFilled+1);
    persistProgress();
    renderFilledState();
    launchConfetti(m);
    playUiSfx('confetti');
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
    const line=fillLineY(),[lineL,lineR]=wallsAt(line);
    ctx.save();ctx.strokeStyle=progress.filled?'rgba(50,159,105,.9)':'rgba(77,145,223,.78)';ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=Math.max(1.5,j.w*.006);ctx.setLineDash([Math.max(5,j.w*.02),Math.max(4,j.w*.014)]);ctx.beginPath();ctx.moveTo(lineL+5,line);ctx.lineTo(lineR-5,line);ctx.stroke();ctx.setLineDash([]);ctx.font=`900 ${Math.max(7,j.w*.025)}px Inter,system-ui,sans-serif`;ctx.textAlign='right';ctx.textBaseline='bottom';ctx.fillText(progress.filled?'FILLED':'FILL LINE',lineR-5,line-5);ctx.restore();
    for(const b of bodies)drawBody(b);for(const p of particles)drawParticle(p);
    if(jarBehind.complete){ctx.save();ctx.beginPath();ctx.rect(j.x+j.w*.205,j.y+j.h*.092,j.w*.59,j.h*.078);ctx.clip();ctx.drawImage(jarBehind,j.x,j.y,j.w,j.h);ctx.restore()}
  }
  function loop(now){if(dead)return;const dt=Math.min(.025,(now-last)/1000||.016);last=now;physics(dt);draw();raf=requestAnimationFrame(loop)}
  function renderType(){const t=types[typeIndex];m.dataset.item=t.id;typeLabel.textContent=t.label.toUpperCase();const preview=m.querySelector('.collection-current-preview');preview.className=`collectible-preview collection-current-preview preview-${t.id}`;pickerButtons.forEach(b=>b.classList.toggle('is-active',b.dataset.collectionType===t.id))}
  function closePicker(){picker.hidden=true;typeBtn.setAttribute('aria-expanded','false')}
  function togglePicker(){picker.hidden=!picker.hidden;typeBtn.setAttribute('aria-expanded',String(!picker.hidden))}

  const currentRoster=()=>readClassRosters().find(item=>item.id===activeClassId)||null;
  const setSettingsOpen=open=>{const show=Boolean(open);settings.hidden=!show;settingsToggle.setAttribute('aria-expanded',String(show))};
  const renderFilledState=()=>{
    const filled=Boolean(progress.filled);
    m.classList.toggle('is-collection-filled',filled);
    filledBanner.hidden=!filled;
    restart.hidden=!filled;
    add.hidden=filled;
    typeBtn.disabled=filled;
    fillHandle.disabled=filled;
    canvas.setAttribute('aria-disabled',String(filled));
    positionFillHandle();
    updateCount();
  };
  const render=()=>{
    const hasClass=Boolean(roster&&activeClassId);
    importView.hidden=hasClass;
    dashboard.hidden=!hasClass;
    if(!hasClass)return;
    className.textContent=roster.name;
    classLogo.textContent=normalizeClassLogo(roster.logo);
    renderType();renderFilledState();
  };
  const persistProgress=()=>{
    if(!activeClassId)return;
    progress.item=types[typeIndex]?.id||'pompom';
    progress.count=bodies.length;
    writing=true;
    const saved=writeClassCollection(activeClassId,progress);
    writing=false;
    if(saved)progress=saved;
    updateCount();
  };
  const rebuildBodies=count=>{
    bodies=[];particles=[];
    const filled=progress.filled;
    progress.filled=false;
    const safeCount=Math.max(0,Math.min(80,Math.round(Number(count)||0)));
    for(let i=0;i<safeCount;i++)addItem({persist:false,detect:false});
    progress.filled=filled;
    fillArmedAt=performance.now()+450;fillReachedAt=0;
    updateCount();
  };
  const applyRosterProgress=next=>{
    roster=next;
    progress=normalizeCollectionProgress(next.collectionJar);
    const nextIndex=types.findIndex(type=>type.id===progress.item);
    typeIndex=nextIndex>=0?nextIndex:0;
    rebuildBodies(progress.count);
    render();
  };
  const loadClass=(classId,{notify=false}={})=>{
    const next=readClassRosters().find(item=>item.id===classId);
    if(!next){activeClassId='';roster=null;progress=normalizeCollectionProgress(null);bodies=[];particles=[];render();return false}
    activeClassId=next.id;pendingClassId='';
    localStorage.setItem(collectionsLastClassStorageKey(),activeClassId);
    applyRosterProgress(next);
    if(notify)notifyBoardChanged('collection-class');
    return true;
  };

  const updateFillLineFromPointer=e=>{if(progress.filled)return;const r=canvas.getBoundingClientRect(),scale=boardCamera.scale||1,y=(e.clientY-r.top)/scale,j=jarBounds().j;progress.fillLine=clamp((y-j.y)/j.h,.24,.72);fillArmedAt=performance.now()+250;fillReachedAt=0;positionFillHandle()};
  fillHandle.addEventListener('pointerdown',e=>{if(progress.filled)return;e.preventDefault();e.stopPropagation();draggingFillLine=true;m.classList.add('is-moving-fill-line');try{fillHandle.setPointerCapture(e.pointerId)}catch{}updateFillLineFromPointer(e)});
  fillHandle.addEventListener('pointermove',e=>{if(!draggingFillLine)return;e.preventDefault();updateFillLineFromPointer(e)});
  const finishFillLineDrag=e=>{if(!draggingFillLine)return;draggingFillLine=false;m.classList.remove('is-moving-fill-line');try{if(e&&fillHandle.hasPointerCapture(e.pointerId))fillHandle.releasePointerCapture(e.pointerId)}catch{}persistProgress()};
  fillHandle.addEventListener('pointerup',finishFillLineDrag);fillHandle.addEventListener('pointercancel',finishFillLineDrag);fillHandle.addEventListener('lostpointercapture',()=>{if(draggingFillLine){draggingFillLine=false;m.classList.remove('is-moving-fill-line');persistProgress()}});
  canvas.addEventListener('pointerdown',e=>{if(progress.filled||draggingFillLine)return;const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/boardCamera.scale,y=(e.clientY-r.top)/boardCamera.scale,[l,rr]=wallsAt(y),b=jarBounds();if(x>=l&&x<=rr&&y>b.top&&y<b.floor+8)addItem()});
  add.addEventListener('click',()=>addItem());
  typeBtn.addEventListener('click',e=>{e.stopPropagation();togglePicker()});
  picker.addEventListener('click',e=>{const b=e.target.closest('[data-collection-type]');if(!b)return;const i=types.findIndex(t=>t.id===b.dataset.collectionType);if(i>=0){typeIndex=i;renderType();persistProgress();closePicker()}});
  document.addEventListener('pointerdown',e=>{if(!m.contains(e.target)||!e.target.closest('.collection-picker-wrap'))closePicker()});
  bgBtn.addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  const emptyJar=()=>{
    if(!activeClassId)return;
    bodies=[];particles=[];progress.count=0;progress.filled=false;fillArmedAt=performance.now()+450;fillReachedAt=0;persistProgress();renderFilledState();
  };
  restart.addEventListener('click',emptyJar);
  bannerRestart.addEventListener('click',emptyJar);
  emptyCurrent.addEventListener('click',()=>{emptyJar();setSettingsOpen(false)});
  settingsToggle.addEventListener('click',()=>setSettingsOpen(settings.hidden));
  m.addEventListener('pointerdown',event=>{if(!settings.hidden&&!event.target.closest('.collection-settings-wrap'))setSettingsOpen(false)});
  m.addEventListener('pointerleave',()=>{setSettingsOpen(false);closePicker()});
  addFill.addEventListener('click',()=>{progress.jarsFilled=normalizeStarChartCount(progress.jarsFilled+1);persistProgress();renderFilledState()});
  removeFill.addEventListener('click',()=>{if(progress.jarsFilled<=0)return;progress.jarsFilled=normalizeStarChartCount(progress.jarsFilled-1);persistProgress();renderFilledState()});
  resetFills.addEventListener('click',()=>{if(progress.jarsFilled<=0)return;progress.jarsFilled=0;persistProgress();renderFilledState();setSettingsOpen(false)});
  changeClass.addEventListener('click',()=>{activeClassId='';pendingClassId='';roster=null;progress=normalizeCollectionProgress(null);bodies=[];particles=[];localStorage.removeItem(collectionsLastClassStorageKey());setSettingsOpen(false);render();notifyBoardChanged('collection-class')});

  const detachRosterLoader=attachClassRosterLoader(m.querySelector('.collection-loader-anchor'),(_names,selectedRoster)=>loadClass(selectedRoster.id,{notify:true}));
  const handleClassesChange=()=>{
    if(!activeClassId){if(pendingClassId)loadClass(pendingClassId);return}
    const next=currentRoster();
    if(!next){activeClassId='';roster=null;progress=normalizeCollectionProgress(null);bodies=[];particles=[];localStorage.removeItem(collectionsLastClassStorageKey());render();return}
    applyRosterProgress(next);
  };
  const handleCollectionChange=event=>{
    if(writing||event.detail?.classId!==activeClassId)return;
    const next=currentRoster();if(next)applyRosterProgress(next);
  };
  window.addEventListener('teachertiles:classeschange',handleClassesChange);
  window.addEventListener('teachertiles:collectionchange',handleCollectionChange);

  renderType();updateCount();raf=requestAnimationFrame(loop);
  m._boardGetState=()=>({classId:activeClassId});
  m._boardSetState=state=>{
    const classId=String(state?.classId||'');
    if(classId&&!loadClass(classId))pendingClassId=classId;
  };
  const lastClassId=localStorage.getItem(collectionsLastClassStorageKey())||'';
  if(!lastClassId||!loadClass(lastClassId))render();
  m._cleanup=()=>{dead=true;draggingFillLine=false;cancelAnimationFrame(raf);ro.disconnect();detachRosterLoader();window.removeEventListener('teachertiles:classeschange',handleClassesChange);window.removeEventListener('teachertiles:collectionchange',handleCollectionChange)}
}

const LUNCH_COUNT_ICONS=[
  {src:'assets/lunch-icons/30.png',label:'Burger'},{src:'assets/lunch-icons/31.png',label:'Chicken sandwich'},
  {src:'assets/lunch-icons/32.png',label:'Pizza'},{src:'assets/lunch-icons/33.png',label:'Hot dog'},
  {src:'assets/lunch-icons/34.png',label:'Yogurt'},{src:'assets/lunch-icons/35.png',label:'Sandwich'},
  {src:'assets/lunch-icons/36.png',label:'Pasta'},{src:'assets/lunch-icons/37.png',label:'Spaghetti'},
  {src:'assets/lunch-icons/38.png',label:'Rice bowl'},{src:'assets/lunch-icons/39.png',label:'Snack'},
  {src:'assets/lunch-icons/40.png',label:'Chips'},{src:'assets/lunch-icons/41.png',label:'Taco'}
];

function setupLunchCount(m){
  const grid=m.querySelector('.lunchcount-grid');
  const pool=m.querySelector('.lunchcount-name-pool');
  const poolList=m.querySelector('.lunchcount-pool-list');
  const summary=m.querySelector('.lunchcount-summary');
  const modeButtons=[...m.querySelectorAll('[data-lunch-mode-button]')];
  const nameInput=m.querySelector('.lunchcount-name-input');
  const addNameButton=m.querySelector('.lunchcount-add-name');
  const resetCounts=m.querySelector('.lunchcount-reset-counts');
  const resetNames=m.querySelector('.lunchcount-reset-names');
  const inlineActions=m.querySelector('.lunchcount-inline-actions');
  const picker=m.querySelector('.lunchcount-icon-picker');
  const pickerGrid=m.querySelector('.lunchcount-icon-picker__grid');
  const pickerClose=m.querySelector('.lunchcount-icon-picker__close');
  const pickerTitle=m.querySelector('.lunchcount-icon-picker__head strong');
  const iconUpload=m.querySelector('.lunchcount-icon-upload');

  let students=[];
  let draggedStudent='';
  let activeCategoryId='';
  let categoryId=0;

  const createCategory=(name,iconSrc,{kind='normal'}={})=>({
    id:`lunch-${++categoryId}`,name,iconSrc,kind,tally:0,students:[]
  });

  const categories=[
    createCategory('Absent','',{kind:'absent'}),
    createCategory('Main','assets/lunch-icons/30.png'),
    createCategory('Hot','assets/lunch-icons/33.png'),
    createCategory('Yogurt','assets/lunch-icons/34.png'),
    createCategory('PB&J','assets/lunch-icons/35.png'),
    createCategory('Packer','assets/lunch-icons/lunchbox.png',{kind:'packer'})
  ];

  const findCategory=id=>categories.find(category=>category.id===id);
  const assignment=name=>categories.find(category=>category.students.includes(name))?.id||'';

  const setMode=mode=>{
    const next=mode==='names'?'names':'tally';
    m.dataset.lunchMode=next;
    modeButtons.forEach(button=>{
      const active=button.dataset.lunchModeButton===next;
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    summary.textContent=next==='tally'
      ?'Tap a category to add a tally'
      :'Add names below, then drag them to a lunch choice';
    pool.hidden=next!=='names';
    resetCounts.hidden=next!=='tally';
    resetNames.hidden=next!=='names';
    inlineActions.classList.toggle('is-names',next==='names');
    renderCategories();
    renderPool();
  };

  const addStudent=()=>{
    const value=nameInput.value.trim().replace(/\s+/g,' ');
    if(!value)return;
    if(students.some(name=>name.toLocaleLowerCase()===value.toLocaleLowerCase())){
      nameInput.select();
      return;
    }
    students.push(value);
    nameInput.value='';
    renderPool();
    nameInput.focus({preventScroll:true});
  };

  const removeStudent=name=>{
    categories.forEach(category=>{
      category.students=category.students.filter(student=>student!==name);
    });
    students=students.filter(student=>student!==name);
    renderCategories();
    renderPool();
    notifyBoardChanged('lunch-count-remove-student');
  };

  const assign=(name,targetId='')=>{
    categories.forEach(category=>{
      category.students=category.students.filter(student=>student!==name);
    });
    if(targetId){
      const target=findCategory(targetId);
      if(target&&!target.students.includes(name))target.students.push(name);
    }
    renderCategories();
    renderPool();
    notifyBoardChanged('lunch-count-assignment');
  };

  const studentChip=(name,{removable=false,unassignOnly=false}={})=>{
    const chip=document.createElement('div');
    chip.className='lunchcount-student-chip';
    chip.draggable=true;

    const text=document.createElement('span');
    text.textContent=name;
    chip.appendChild(text);

    chip.addEventListener('dragstart',event=>{
      draggedStudent=name;
      chip.classList.add('is-dragging');
      event.dataTransfer?.setData('text/plain',name);
      if(event.dataTransfer)event.dataTransfer.effectAllowed='move';
    });

    chip.addEventListener('dragend',()=>{
      draggedStudent='';
      chip.classList.remove('is-dragging');
      m.querySelectorAll('.is-drop-target').forEach(node=>node.classList.remove('is-drop-target'));
    });

    if(removable){
      const remove=document.createElement('button');
      remove.type='button';
      remove.textContent='×';
      remove.setAttribute('aria-label',unassignOnly?`Return ${name} to unassigned`:`Remove ${name}`);
      remove.addEventListener('click',event=>{
        event.stopPropagation();
        if(unassignOnly)assign(name,'');
        else removeStudent(name);
      });
      chip.appendChild(remove);
    }

    return chip;
  };

  const wireDrop=(element,targetId='')=>{
    element.addEventListener('dragover',event=>{
      if(m.dataset.lunchMode!=='names')return;
      event.preventDefault();
      element.classList.add('is-drop-target');
    });
    element.addEventListener('dragleave',event=>{
      if(!element.contains(event.relatedTarget))element.classList.remove('is-drop-target');
    });
    element.addEventListener('drop',event=>{
      if(m.dataset.lunchMode!=='names')return;
      event.preventDefault();
      element.classList.remove('is-drop-target');
      const name=draggedStudent||event.dataTransfer?.getData('text/plain');
      if(name&&students.includes(name))assign(name,targetId);
    });
  };

  const closePicker=()=>{
    activeCategoryId='';
    picker.hidden=true;
  };

  const openPicker=id=>{
    const category=findCategory(id);
    if(!category||category.kind!=='normal')return;
    activeCategoryId=id;
    pickerGrid.querySelectorAll('.lunchcount-icon-option').forEach(button=>{
      button.classList.toggle('is-selected',button.dataset.iconSrc===category.iconSrc);
    });
    picker.hidden=false;
  };

  const renderCategories=()=>{
    grid.replaceChildren();
    const namesMode=m.dataset.lunchMode==='names';

    categories.forEach((category,index)=>{
      const card=document.createElement('section');
      card.className='lunchcount-category';
      card.dataset.categoryKind=category.kind;
      if(namesMode)wireDrop(card,category.id);

      const controls=document.createElement('div');
      controls.className='lunchcount-category-controls';

      if(category.kind==='normal'){
        const remove=document.createElement('button');
        remove.type='button';
        remove.className='lunchcount-category-remove';
        remove.textContent='×';
        remove.title='Remove category';
        remove.setAttribute('aria-label',`Remove ${category.name}`);
        remove.addEventListener('click',event=>{
          event.stopPropagation();
          category.students.forEach(name=>assign(name,''));
          const categoryIndex=categories.indexOf(category);
          if(categoryIndex>=0)categories.splice(categoryIndex,1);
          renderCategories();
          renderPool();
        });
        controls.appendChild(remove);
      }

      const icon=document.createElement(category.kind==='normal'?'button':'div');
      if(category.kind==='normal')icon.type='button';
      icon.className='lunchcount-category-icon';

      if(category.kind==='absent'){
        icon.classList.add('is-empty');
        icon.innerHTML='<span aria-hidden="true">—</span>';
        icon.title='Absent does not use an icon';
      }else{
        const image=document.createElement('img');
        image.src=category.iconSrc;
        image.alt='';
        image.draggable=false;
        icon.appendChild(image);
      }

      if(category.kind==='normal'){
        icon.title='Change category icon';
        icon.addEventListener('click',event=>{
          event.stopPropagation();
          openPicker(category.id);
        });
      }
      if(category.kind==='packer')icon.title='Packer always uses the lunch box';

      const title=document.createElement('input');
      title.type='text';
      title.className='lunchcount-category-name';
      title.maxLength=22;
      title.value=category.name;
      title.addEventListener('click',event=>event.stopPropagation());
      title.addEventListener('input',()=>category.name=title.value);
      title.addEventListener('blur',()=>{
        category.name=title.value.trim()||`Choice ${index+1}`;
        title.value=category.name;
      });

      const count=document.createElement('strong');
      count.className='lunchcount-category-count';
      count.textContent=String(namesMode?category.students.length:category.tally);

      const content=document.createElement('div');
      content.className='lunchcount-category-content';

      if(namesMode){
        if(category.students.length){
          category.students.forEach(name=>content.appendChild(studentChip(name,{removable:true,unassignOnly:true})));
        }else{
          const empty=document.createElement('span');
          empty.className='lunchcount-category-empty';
          empty.textContent='Drop names here';
          content.appendChild(empty);
        }
      }else{
        const label=document.createElement('span');
        label.className='lunchcount-tally-label';
        label.textContent=category.tally===1?'student':'students';
        content.appendChild(label);

        const minus=document.createElement('button');
        minus.type='button';
        minus.className='lunchcount-tally-minus';
        minus.textContent='−';
        minus.disabled=category.tally<=0;
        minus.setAttribute('aria-label',`Remove one ${category.name} tally`);
        minus.addEventListener('click',event=>{
          event.stopPropagation();
          category.tally=Math.max(0,category.tally-1);
          renderCategories();
        });
        content.appendChild(minus);

        card.classList.add('is-tally');
        card.tabIndex=0;
        card.setAttribute('role','button');
        card.setAttribute('aria-label',`${category.name}: ${category.tally} students. Add one tally.`);

        const add=()=>{
          category.tally++;
          renderCategories();
        };

        card.addEventListener('click',event=>{
          if(!event.target.closest('input,button'))add();
        });
        card.addEventListener('keydown',event=>{
          if(event.key==='Enter'||event.key===' '){
            event.preventDefault();
            add();
          }
        });
      }

      card.append(controls,icon,title,count,content);
      grid.appendChild(card);
    });

    const addCard=document.createElement('button');
    addCard.type='button';
    addCard.className='lunchcount-add-category-card';
    addCard.setAttribute('aria-label','Add lunch category');
    addCard.title='Add category';
    addCard.innerHTML='<span aria-hidden="true">+</span><small>Add Category</small>';
    addCard.addEventListener('click',()=>{
      categories.push(createCategory(`Choice ${categories.length+1}`,'assets/lunch-icons/30.png'));
      renderCategories();
      requestAnimationFrame(()=>{
        const titles=[...grid.querySelectorAll('.lunchcount-category-name')];
        titles.at(-1)?.focus({preventScroll:true});
        titles.at(-1)?.select();
      });
    });
    grid.appendChild(addCard);
  };

  const renderPool=()=>{
    requestAnimationFrame(()=>fitNameModuleToRoster(m,students.length,{namesPerRow:6,rowHeight:30,threshold:12}));
    poolList.replaceChildren();
    if(m.dataset.lunchMode!=='names')return;

    const unassigned=students.filter(name=>!assignment(name));

    if(!students.length){
      const empty=document.createElement('span');
      empty.className='lunchcount-pool-empty';
      empty.textContent='Add student names above';
      poolList.appendChild(empty);
      return;
    }

    if(!unassigned.length){
      const empty=document.createElement('span');
      empty.className='lunchcount-pool-empty';
      empty.textContent='Everyone has a lunch choice';
      poolList.appendChild(empty);
      return;
    }

    unassigned.forEach(name=>{
      poolList.appendChild(studentChip(name,{removable:true}));
    });
  };

  const uploadOption=document.createElement('button');
  uploadOption.type='button';
  uploadOption.className='lunchcount-icon-option lunchcount-icon-option--upload';
  uploadOption.innerHTML='<span class="lunchcount-upload-art" aria-hidden="true">↑</span><span>Upload image</span>';
  uploadOption.addEventListener('click',()=>iconUpload?.click());
  pickerGrid.appendChild(uploadOption);

  iconUpload?.addEventListener('change',async()=>{
    const file=iconUpload.files?.[0];
    const categoryId=activeCategoryId;
    iconUpload.value='';
    if(!file||!categoryId)return;
    pickerTitle.textContent='Preparing image…';
    const data=await fileToBoardImageData(file,{maxSide:480,maxLength:70000,quality:.72,minSide:180});
    const category=findCategory(categoryId);
    if(data&&category?.kind==='normal'){
      category.iconSrc=data;
      closePicker();
      renderCategories();
      notifyBoardChanged('lunch-count-image');
    }else{
      pickerTitle.textContent='Choose a smaller image';
      window.setTimeout(()=>{pickerTitle.textContent='Choose an icon';},1800);
    }
  });

  LUNCH_COUNT_ICONS.forEach(icon=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='lunchcount-icon-option';
    button.dataset.iconSrc=icon.src;

    const image=document.createElement('img');
    image.src=icon.src;
    image.alt='';
    image.draggable=false;

    const caption=document.createElement('span');
    caption.textContent=icon.label;

    button.append(image,caption);
    button.addEventListener('click',()=>{
      const category=findCategory(activeCategoryId);
      if(category&&category.kind==='normal'){
        category.iconSrc=icon.src;
        closePicker();
        renderCategories();
        notifyBoardChanged('lunch-count-image');
      }
    });
    pickerGrid.appendChild(button);
  });

  wireDrop(poolList,'');

  modeButtons.forEach(button=>{
    button.addEventListener('click',()=>setMode(button.dataset.lunchModeButton));
  });

  addNameButton.addEventListener('click',addStudent);
  nameInput.addEventListener('keydown',event=>{
    if(event.key==='Enter'){
      event.preventDefault();
      addStudent();
    }
  });

  resetCounts.addEventListener('click',()=>{
    categories.forEach(category=>category.tally=0);
    renderCategories();
  });

  resetNames.addEventListener('click',()=>{
    categories.forEach(category=>category.students=[]);
    renderCategories();
    renderPool();
  });

  pickerClose.addEventListener('click',closePicker);
  picker.addEventListener('pointerdown',event=>{
    if(event.target===picker)closePicker();
  });
  picker.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});

  m.querySelector('.lunchcount-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.lunchcount-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.lunchcount-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  const detachRosterLoader=attachClassRosterLoader(nameInput.closest('.lunchcount-name-entry'),rosterNames=>{
    students=normalizeRosterNames(rosterNames);
    categories.forEach(category=>category.students=[]);
    setMode('names');
    renderCategories();
    renderPool();
  });

  m._boardGetState=()=>({
    mode:m.dataset.lunchMode||'tally',
    students:[...students],
    categories:categories.map(category=>({
      name:category.name,
      iconSrc:category.iconSrc,
      kind:category.kind,
      tally:category.tally,
      students:[...category.students]
    }))
  });
  m._boardSetState=state=>{
    if(!state)return;
    students=Array.isArray(state.students)?state.students.map(String):[];
    if(Array.isArray(state.categories)&&state.categories.length){
      categories.splice(0,categories.length);
      categoryId=0;
      for(const saved of state.categories){
        const category=createCategory(saved.name||'Choice',saved.iconSrc||'',{kind:saved.kind||'normal'});
        category.tally=Math.max(0,Math.round(Number(saved.tally)||0));
        category.students=Array.isArray(saved.students)?saved.students.filter(name=>students.includes(name)):[];
        categories.push(category);
      }
    }
    setMode(state.mode==='names'?'names':'tally');
    renderCategories();
    renderPool();
  };

  setMode('tally');
  const priorCleanup=m._cleanup;
  m._cleanup=()=>{priorCleanup?.();detachRosterLoader()};
}

function setupVoting(m){
  const grid=m.querySelector('.voting-grid');
  const pool=m.querySelector('.voting-name-pool');
  const poolList=m.querySelector('.voting-pool-list');
  const summary=m.querySelector('.voting-summary');
  const modeButtons=[...m.querySelectorAll('[data-voting-mode-button]')];
  const nameInput=m.querySelector('.voting-name-input');
  const addNameButton=m.querySelector('.voting-add-name');
  const resetCounts=m.querySelector('.voting-reset-counts');
  const resetNames=m.querySelector('.voting-reset-names');
  const inlineActions=m.querySelector('.voting-inline-actions');
  const imageInput=m.querySelector('.voting-image-input');

  let students=[];
  let draggedStudent='';
  let activeChoiceId='';
  let choiceId=0;

  const createChoice=name=>({
    id:`vote-${++choiceId}`,
    name,
    imageSrc:'',
    tally:0,
    students:[]
  });

  const choices=[
    createChoice('Choice 1'),
    createChoice('Choice 2')
  ];

  const findChoice=id=>choices.find(choice=>choice.id===id);
  const assignment=name=>choices.find(choice=>choice.students.includes(name))?.id||'';

  const setMode=mode=>{
    const next=mode==='names'?'names':'tally';
    m.dataset.votingMode=next;

    modeButtons.forEach(button=>{
      const active=button.dataset.votingModeButton===next;
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-pressed',String(active));
    });

    summary.textContent=next==='tally'
      ?'Tap a choice to add a vote'
      :'Add names below, then drag them to a choice';

    pool.hidden=next!=='names';
    resetCounts.hidden=next!=='tally';
    resetNames.hidden=next!=='names';
    inlineActions.classList.toggle('is-names',next==='names');

    renderChoices();
    renderPool();
  };

  const addStudent=()=>{
    const value=nameInput.value.trim().replace(/\s+/g,' ');
    if(!value)return;

    if(students.some(name=>name.toLocaleLowerCase()===value.toLocaleLowerCase())){
      nameInput.select();
      return;
    }

    students.push(value);
    nameInput.value='';
    renderPool();
    nameInput.focus({preventScroll:true});
  };

  const removeStudent=name=>{
    choices.forEach(choice=>{
      choice.students=choice.students.filter(student=>student!==name);
    });
    students=students.filter(student=>student!==name);
    renderChoices();
    renderPool();
    notifyBoardChanged('voting-remove-student');
  };

  const assign=(name,targetId='')=>{
    choices.forEach(choice=>{
      choice.students=choice.students.filter(student=>student!==name);
    });
    if(targetId){
      const target=findChoice(targetId);
      if(target&&!target.students.includes(name))target.students.push(name);
    }
    renderChoices();
    renderPool();
    notifyBoardChanged('voting-assignment');
  };

  const studentChip=(name,{removable=false,unassignOnly=false}={})=>{
    const chip=document.createElement('div');
    chip.className='voting-student-chip';
    chip.draggable=true;

    const text=document.createElement('span');
    text.textContent=name;
    chip.appendChild(text);

    chip.addEventListener('dragstart',event=>{
      draggedStudent=name;
      chip.classList.add('is-dragging');
      event.dataTransfer?.setData('text/plain',name);
      if(event.dataTransfer)event.dataTransfer.effectAllowed='move';
    });

    chip.addEventListener('dragend',()=>{
      draggedStudent='';
      chip.classList.remove('is-dragging');
      m.querySelectorAll('.is-drop-target').forEach(node=>node.classList.remove('is-drop-target'));
    });

    if(removable){
      const remove=document.createElement('button');
      remove.type='button';
      remove.textContent='×';
      remove.setAttribute('aria-label',unassignOnly?`Return ${name} to unassigned`:`Remove ${name}`);
      remove.addEventListener('click',event=>{
        event.stopPropagation();
        if(unassignOnly)assign(name,'');
        else removeStudent(name);
      });
      chip.appendChild(remove);
    }

    return chip;
  };

  const wireDrop=(element,targetId='')=>{
    element.addEventListener('dragover',event=>{
      if(m.dataset.votingMode!=='names')return;
      event.preventDefault();
      element.classList.add('is-drop-target');
    });

    element.addEventListener('dragleave',event=>{
      if(!element.contains(event.relatedTarget))element.classList.remove('is-drop-target');
    });

    element.addEventListener('drop',event=>{
      if(m.dataset.votingMode!=='names')return;
      event.preventDefault();
      element.classList.remove('is-drop-target');
      const name=draggedStudent||event.dataTransfer?.getData('text/plain');
      if(name&&students.includes(name))assign(name,targetId);
    });
  };

  const openImagePicker=id=>{
    activeChoiceId=id;
    imageInput.value='';
    imageInput.click();
  };

  const renderChoices=()=>{
    grid.replaceChildren();
    const namesMode=m.dataset.votingMode==='names';

    choices.forEach((choice,index)=>{
      const card=document.createElement('section');
      card.className='voting-choice';
      if(namesMode)wireDrop(card,choice.id);

      const controls=document.createElement('div');
      controls.className='voting-choice-controls';

      const remove=document.createElement('button');
      remove.type='button';
      remove.className='voting-choice-remove';
      remove.textContent='×';
      remove.title='Remove choice';
      remove.setAttribute('aria-label',`Remove ${choice.name}`);
      remove.disabled=choices.length<=1;
      remove.addEventListener('click',event=>{
        event.stopPropagation();
        if(choices.length<=1)return;
        choice.students.forEach(name=>assign(name,''));
        const choiceIndex=choices.indexOf(choice);
        if(choiceIndex>=0)choices.splice(choiceIndex,1);
        renderChoices();
        renderPool();
      });
      controls.appendChild(remove);

      const imageButton=document.createElement('button');
      imageButton.type='button';
      imageButton.className='voting-choice-image';
      imageButton.setAttribute('aria-label',choice.imageSrc?`Change image for ${choice.name}`:`Add image for ${choice.name}`);
      imageButton.title=choice.imageSrc?'Change image':'Add image';

      if(choice.imageSrc){
        const image=document.createElement('img');
        image.src=choice.imageSrc;
        image.alt='';
        image.draggable=false;
        imageButton.appendChild(image);
      }else{
        imageButton.innerHTML='<span aria-hidden="true">＋</span><small>Add Image</small>';
      }

      imageButton.addEventListener('click',event=>{
        event.stopPropagation();
        openImagePicker(choice.id);
      });

      const title=document.createElement('input');
      title.type='text';
      title.className='voting-choice-name';
      title.maxLength=30;
      title.value=choice.name;
      title.setAttribute('aria-label',`Voting choice ${index+1}`);
      title.addEventListener('click',event=>event.stopPropagation());
      title.addEventListener('input',()=>choice.name=title.value);
      title.addEventListener('blur',()=>{
        choice.name=title.value.trim()||`Choice ${index+1}`;
        title.value=choice.name;
      });

      const count=document.createElement('strong');
      count.className='voting-choice-count';
      count.textContent=String(namesMode?choice.students.length:choice.tally);

      const content=document.createElement('div');
      content.className='voting-choice-content';

      if(namesMode){
        if(choice.students.length){
          choice.students.forEach(name=>content.appendChild(studentChip(name,{removable:true,unassignOnly:true})));
        }else{
          const empty=document.createElement('span');
          empty.className='voting-choice-empty';
          empty.textContent='Drop names here';
          content.appendChild(empty);
        }
      }else{
        const label=document.createElement('span');
        label.className='voting-tally-label';
        label.textContent=choice.tally===1?'vote':'votes';
        content.appendChild(label);

        const minus=document.createElement('button');
        minus.type='button';
        minus.className='voting-tally-minus';
        minus.textContent='−';
        minus.disabled=choice.tally<=0;
        minus.setAttribute('aria-label',`Remove one vote from ${choice.name}`);
        minus.addEventListener('click',event=>{
          event.stopPropagation();
          choice.tally=Math.max(0,choice.tally-1);
          renderChoices();
        });
        content.appendChild(minus);

        card.classList.add('is-tally');
        card.tabIndex=0;
        card.setAttribute('role','button');
        card.setAttribute('aria-label',`${choice.name}: ${choice.tally} votes. Add one vote.`);

        const add=()=>{
          choice.tally++;
          renderChoices();
        };

        card.addEventListener('click',event=>{
          if(!event.target.closest('input,button'))add();
        });

        card.addEventListener('keydown',event=>{
          if(event.key==='Enter'||event.key===' '){
            event.preventDefault();
            add();
          }
        });
      }

      card.append(controls,imageButton,title,count,content);
      grid.appendChild(card);
    });

    const addCard=document.createElement('button');
    addCard.type='button';
    addCard.className='voting-add-choice-card';
    addCard.setAttribute('aria-label','Add voting choice');
    addCard.title='Add choice';
    addCard.innerHTML='<span aria-hidden="true">+</span><small>Add Choice</small>';
    addCard.addEventListener('click',()=>{
      choices.push(createChoice(`Choice ${choices.length+1}`));
      renderChoices();
      requestAnimationFrame(()=>{
        const titles=[...grid.querySelectorAll('.voting-choice-name')];
        titles.at(-1)?.focus({preventScroll:true});
        titles.at(-1)?.select();
      });
    });
    grid.appendChild(addCard);
  };

  const renderPool=()=>{
    requestAnimationFrame(()=>fitNameModuleToRoster(m,students.length,{namesPerRow:6,rowHeight:30,threshold:12}));
    poolList.replaceChildren();
    if(m.dataset.votingMode!=='names')return;

    const unassigned=students.filter(name=>!assignment(name));

    if(!students.length){
      const empty=document.createElement('span');
      empty.className='voting-pool-empty';
      empty.textContent='Add student names above';
      poolList.appendChild(empty);
      return;
    }

    if(!unassigned.length){
      const empty=document.createElement('span');
      empty.className='voting-pool-empty';
      empty.textContent='Everyone has voted';
      poolList.appendChild(empty);
      return;
    }

    unassigned.forEach(name=>{
      poolList.appendChild(studentChip(name,{removable:true}));
    });
  };

  wireDrop(poolList,'');

  modeButtons.forEach(button=>{
    button.addEventListener('click',()=>setMode(button.dataset.votingModeButton));
  });

  addNameButton.addEventListener('click',addStudent);
  nameInput.addEventListener('keydown',event=>{
    if(event.key==='Enter'){
      event.preventDefault();
      addStudent();
    }
  });

  resetCounts.addEventListener('click',()=>{
    choices.forEach(choice=>choice.tally=0);
    renderChoices();
  });

  resetNames.addEventListener('click',()=>{
    choices.forEach(choice=>choice.students=[]);
    renderChoices();
    renderPool();
  });

  imageInput.addEventListener('change',()=>{
    const file=imageInput.files?.[0];
    const choice=findChoice(activeChoiceId);
    if(!file||!choice)return;

    const reader=new FileReader();
    reader.addEventListener('load',()=>{
      if(typeof reader.result==='string'){
        choice.imageSrc=reader.result;
        renderChoices();
        notifyBoardChanged('voting-image');
      }
    },{once:true});
    reader.readAsDataURL(file);
  });

  m.querySelector('.voting-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.voting-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.voting-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  const detachRosterLoader=attachClassRosterLoader(nameInput.closest('.voting-name-entry'),rosterNames=>{
    students=normalizeRosterNames(rosterNames);
    choices.forEach(choice=>choice.students=[]);
    setMode('names');
    renderChoices();
    renderPool();
  });

  m._boardGetState=()=>({
    mode:m.dataset.votingMode||'tally',
    students:[...students],
    choices:choices.map(choice=>({
      name:choice.name,
      imageSrc:choice.imageSrc,
      tally:choice.tally,
      students:[...choice.students]
    }))
  });
  m._boardSetState=state=>{
    if(!state)return;
    students=Array.isArray(state.students)?state.students.map(String):[];
    if(Array.isArray(state.choices)&&state.choices.length){
      choices.splice(0,choices.length);
      choiceId=0;
      for(const saved of state.choices){
        const choice=createChoice(saved.name||'Choice');
        choice.imageSrc=saved.imageSrc||'';
        choice.tally=Math.max(0,Math.round(Number(saved.tally)||0));
        choice.students=Array.isArray(saved.students)?saved.students.filter(name=>students.includes(name)):[];
        choices.push(choice);
      }
    }
    setMode(state.mode==='names'?'names':'tally');
    renderChoices();
    renderPool();
  };

  const priorCleanup=m._cleanup;
  m._cleanup=()=>{priorCleanup?.();detachRosterLoader()};

  setMode('tally');
}


function setupGroupMaker(m){
  const nameInput=m.querySelector('.groupmaker-name-input');
  const addNameBtn=m.querySelector('.groupmaker-add-name');
  const nameList=m.querySelector('.groupmaker-name-list');
  const sizeInput=m.querySelector('.groupmaker-size');
  const makeBtn=m.querySelector('.groupmaker-make');
  const shuffleBtn=m.querySelector('.groupmaker-shuffle');
  const editBtn=m.querySelector('.groupmaker-edit-names');
  const results=m.querySelector('.groupmaker-results');
  const countLabel=m.querySelector('.groupmaker-name-count');
  const summary=m.querySelector('.groupmaker-summary');
  const bg=m.querySelector('.groupmaker-bg');
  const font=m.querySelector('.groupmaker-font');
  const textColor=m.querySelector('.groupmaker-text-color');

  let names=[];
  let groupTitles=[];
  let shuffleTimer=0;

  const normalizeName=value=>value.trim().replace(/\s+/g,' ');

  const updateCount=()=>{
    const count=names.length;
    countLabel.textContent=`${count} ${count===1?'name':'names'}`;
    makeBtn.disabled=count<2;
  };

  const renderNameList=()=>{
    requestAnimationFrame(()=>fitNameModuleToRoster(m,names.length,{namesPerRow:5,rowHeight:32,threshold:10}));
    nameList.replaceChildren();

    names.forEach((name,index)=>{
      const chip=document.createElement('div');
      chip.className='groupmaker-name-chip';

      const text=document.createElement('span');
      text.textContent=name;

      const remove=document.createElement('button');
      remove.type='button';
      remove.textContent='×';
      remove.setAttribute('aria-label',`Remove ${name}`);
      remove.addEventListener('click',()=>{
        names.splice(index,1);
        renderNameList();
        updateCount();
        if(m.classList.contains('has-groups')){
          if(names.length>=2){
            makeGroups(true);
          }else{
            m.classList.remove('has-groups');
          }
        }
      });

      chip.append(text,remove);
      nameList.appendChild(chip);
    });

    nameList.classList.toggle('is-empty',names.length===0);
  };

  const addName=()=>{
    const value=normalizeName(nameInput.value);
    if(!value)return;

    const exists=names.some(name=>name.toLocaleLowerCase()===value.toLocaleLowerCase());
    if(exists){
      nameInput.select();
      return;
    }

    names.push(value);
    nameInput.value='';
    renderNameList();
    updateCount();
    nameInput.focus({preventScroll:true});
  };

  const shuffleNames=list=>{
    const copy=[...list];
    for(let i=copy.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [copy[i],copy[j]]=[copy[j],copy[i]];
    }
    return copy;
  };

  const balanceGroups=(list,targetSize)=>{
    if(!list.length)return [];
    const groupCount=Math.max(1,Math.ceil(list.length/targetSize));
    const groups=Array.from({length:groupCount},()=>[]);
    list.forEach((name,index)=>{
      groups[index%groupCount].push(name);
    });
    return groups;
  };

  const ensureGroupTitles=count=>{
    while(groupTitles.length<count){
      groupTitles.push(`Group ${groupTitles.length+1}`);
    }
    if(groupTitles.length>count){
      groupTitles=groupTitles.slice(0,count);
    }
  };

  const renderGroups=(groups,{animate=false}={})=>{
    ensureGroupTitles(groups.length);
    results.replaceChildren();
    results.classList.toggle('is-shuffling',animate);

    const grid=document.createElement('div');
    grid.className='groupmaker-grid';
    grid.style.setProperty('--group-count',String(groups.length));

    groups.forEach((group,index)=>{
      const card=document.createElement('section');
      card.className='groupmaker-group';
      if(animate)card.style.setProperty('--group-delay',`${index*55}ms`);

      const title=document.createElement('input');
      title.className='groupmaker-group-title-input';
      title.type='text';
      title.maxLength=28;
      title.value=groupTitles[index]||`Group ${index+1}`;
      title.setAttribute('aria-label',`Edit name for group ${index+1}`);
      title.addEventListener('input',()=>{
        groupTitles[index]=title.value;
      });
      title.addEventListener('blur',()=>{
        const fallback=`Group ${index+1}`;
        const value=title.value.trim();
        groupTitles[index]=value||fallback;
        title.value=groupTitles[index];
      });

      const list=document.createElement('ol');
      list.className='groupmaker-group-list';

      group.forEach((name,nameIndex)=>{
        const item=document.createElement('li');
        item.textContent=name;
        if(animate)item.style.setProperty('--name-delay',`${index*55+nameIndex*38}ms`);
        list.appendChild(item);
      });

      card.append(title,list);
      grid.appendChild(card);
    });

    results.appendChild(grid);
    const total=groups.reduce((sum,group)=>sum+group.length,0);
    summary.textContent=`${total} students · ${groups.length} ${groups.length===1?'group':'groups'}`;
    m.classList.add('has-groups');

    if(animate){
      clearTimeout(shuffleTimer);
      shuffleTimer=setTimeout(()=>results.classList.remove('is-shuffling'),750);
    }
  };

  const makeGroups=(animate=true)=>{
    if(names.length<2){
      m.classList.remove('has-groups');
      updateCount();
      return;
    }

    const targetSize=Math.max(2,Math.min(12,Math.round(Number(sizeInput.value)||4)));
    sizeInput.value=String(targetSize);
    renderGroups(balanceGroups(shuffleNames(names),targetSize),{animate});
  };

  addNameBtn.addEventListener('click',addName);
  nameInput.addEventListener('keydown',e=>{
    if(e.key==='Enter'){
      e.preventDefault();
      addName();
    }
  });

  sizeInput.addEventListener('change',()=>{
    sizeInput.value=String(Math.max(2,Math.min(12,Math.round(Number(sizeInput.value)||4))));
    if(m.classList.contains('has-groups'))makeGroups(true);
  });

  makeBtn.addEventListener('click',()=>makeGroups(true));

  shuffleBtn.addEventListener('click',()=>{
    if(names.length<2){
      m.classList.remove('has-groups');
      nameInput.focus({preventScroll:true});
      return;
    }
    makeGroups(true);
  });

  editBtn.addEventListener('click',()=>{
    m.classList.remove('has-groups');
    summary.textContent='Edit your class list';
    requestAnimationFrame(()=>nameInput.focus({preventScroll:true}));
  });

  bg.addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  font.addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  textColor.addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  renderNameList();
  updateCount();

  const detachRosterLoader=attachClassRosterLoader(nameInput.closest('.groupmaker-name-entry'),rosterNames=>{
    names=normalizeRosterNames(rosterNames);
    groupTitles=[];
    m.classList.remove('has-groups');
    summary.textContent='Class roster loaded';
    renderNameList();
    updateCount();
  });

  m._boardGetState=()=>({
    names:[...names],
    groupTitles:[...groupTitles],
    targetSize:Number(sizeInput.value)||4,
    groups:[...results.querySelectorAll('.groupmaker-group')].map(card=>
      [...card.querySelectorAll('.groupmaker-group-list li')].map(item=>item.textContent||'')
    )
  });
  m._boardSetState=state=>{
    if(!state)return;
    names=Array.isArray(state.names)?state.names.map(String):[];
    groupTitles=Array.isArray(state.groupTitles)?state.groupTitles.map(String):[];
    sizeInput.value=String(Math.max(2,Math.min(12,Math.round(Number(state.targetSize)||4))));
    renderNameList();
    updateCount();
    if(Array.isArray(state.groups)&&state.groups.length&&names.length>=2)renderGroups(state.groups,{animate:false});
    else m.classList.remove('has-groups');
  };

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    detachRosterLoader();
    clearTimeout(shuffleTimer);
  };
}

function setupStoplight(m){
  const stage=m.querySelector('.stoplight-stage');
  const img=m.querySelector('.stoplight-image');
  const label=m.querySelector('.stoplight-label');
  const bg=m.querySelector('.stoplight-bg');
  const modeButton=m.querySelector('.stoplight-mode-button');
  const modeCurrent=m.querySelector('.stoplight-mode-button__current');
  const modeMenu=m.querySelector('.stoplight-mode-menu');
  const modeOptions=[...m.querySelectorAll('[data-stoplight-mode-option]')];

  const modes={
    voice:{
      name:'Voice Level',
      summary:'Normal · Whisper · Zero',
      labels:['NORMAL','WHISPER','ZERO']
    },
    choice:{
      name:'Yes / Maybe / No',
      summary:'Yes · Maybe · No',
      labels:['YES','MAYBE','NO']
    },
    classic:{
      name:'Classic',
      summary:'Go · Listen · Stop',
      labels:['GO','LISTEN','STOP']
    }
  };

  const states=[
    {id:'green',src:'assets/stoplight-green.png',alt:'Green stoplight'},
    {id:'yellow',src:'assets/stoplight-yellow.png',alt:'Yellow stoplight'},
    {id:'red',src:'assets/stoplight-red.png',alt:'Red stoplight'}
  ];

  let i=0;
  let mode=m.dataset.stoplightMode||'voice';
  if(!modes[mode])mode='voice';

  const closeModeMenu=()=>{
    modeMenu.hidden=true;
    modeButton.setAttribute('aria-expanded','false');
  };

  const render=(animate=true)=>{
    const state=states[i];
    const config=modes[mode];
    m.dataset.stoplight=state.id;
    m.dataset.stoplightMode=mode;
    label.textContent=config.labels[i];
    img.src=state.src;
    img.alt=state.alt;
    modeCurrent.textContent=config.summary;
    modeOptions.forEach(option=>{
      option.classList.toggle('is-active',option.dataset.stoplightModeOption===mode);
    });
    stage.setAttribute('aria-label',`${config.labels[i]}. Click to change stoplight state.`);
    modeButton.setAttribute('aria-label',`Change stoplight mode. Current mode: ${config.name}, ${config.summary}.`);
    if(animate){
      stage.classList.remove('stoplight-pop');
      void stage.offsetWidth;
      stage.classList.add('stoplight-pop');
      setTimeout(()=>stage.classList.remove('stoplight-pop'),220);
    }
  };

  stage.addEventListener('click',()=>{
    i=(i+1)%states.length;
    render(true);
  });

  modeButton.addEventListener('click',e=>{
    e.stopPropagation();
    const opening=modeMenu.hidden;
    modeMenu.hidden=!opening;
    modeButton.setAttribute('aria-expanded',String(opening));
  });

  modeOptions.forEach(option=>{
    option.addEventListener('click',e=>{
      e.stopPropagation();
      mode=option.dataset.stoplightModeOption;
      closeModeMenu();
      render(true);
    });
  });

  m.addEventListener('pointerdown',e=>{
    if(!e.target.closest('.stoplight-mode-wrap'))closeModeMenu();
  });

  bg.addEventListener('click',e=>{
    e.stopPropagation();
    cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']);
  });

  m._boardGetState=()=>({index:i,mode});
  m._boardSetState=state=>{
    if(!state)return;
    mode=modes[state.mode]?state.mode:'voice';
    i=Math.max(0,Math.min(states.length-1,Math.round(Number(state.index)||0)));
    render(false);
  };

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
async function fileToBoardImageData(file,{maxSide=1200,maxLength=760000,quality=.78,minSide=240}={}){
  if(!file||!file.type?.startsWith('image/'))return'';
  const raw=await new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(typeof reader.result==='string'?reader.result:'');
    reader.onerror=()=>reject(reader.error);
    reader.readAsDataURL(file);
  });
  if(!raw)return'';
  try{
    const source=new Image();
    source.src=raw;
    await source.decode();
    let scale=Math.min(1,maxSide/Math.max(source.naturalWidth||1,source.naturalHeight||1));
    const canvas=document.createElement('canvas');
    let data='';
    let nextQuality=quality;
    for(let attempt=0;attempt<7;attempt++){
      canvas.width=Math.max(1,Math.round((source.naturalWidth||1)*scale));
      canvas.height=Math.max(1,Math.round((source.naturalHeight||1)*scale));
      const ctx=canvas.getContext('2d');
      ctx.drawImage(source,0,0,canvas.width,canvas.height);
      data=canvas.toDataURL('image/webp',nextQuality);
      if(data.length<=maxLength)break;
      const longest=Math.max(canvas.width,canvas.height);
      if(longest<=minSide)break;
      scale*=.78;
      nextQuality=Math.max(.46,nextQuality-.07);
    }
    return data.length<=maxLength?data:'';
  }catch{
    return raw.length<maxLength?raw:'';
  }
}

async function boardImagePreviewData(src,{maxSide=220,maxLength=28000}={}){
  if(typeof src!=='string'||!src.startsWith('data:image/'))return src||'';
  try{
    const source=new Image();
    source.src=src;
    await source.decode();
    const ratio=Math.min(1,maxSide/Math.max(source.naturalWidth||1,source.naturalHeight||1));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round((source.naturalWidth||1)*ratio));
    canvas.height=Math.max(1,Math.round((source.naturalHeight||1)*ratio));
    canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);
    for(const quality of [.68,.56,.44]){
      const preview=canvas.toDataURL('image/webp',quality);
      if(preview.length<=maxLength)return preview;
    }
  }catch{}
  return'';
}

function setupImage(m){
  const stage=m.querySelector('.image-stage'),img=m.querySelector('.image-display'),input=m.querySelector('.image-input'),replace=m.querySelector('.image-replace'),borderStyle=m.querySelector('.image-border-style'),borderColor=m.querySelector('.image-border-color');
  let objectUrl='';
  let boardImageSrc='';
  let boardImagePreviewSrc='';

  const applyBorder=()=>{
    const style=borderStyle?.value||'none';
    const color=borderColor?.value||'#17191d';
    m.dataset.imageBorder=style;
    m.style.setProperty('--image-border-color',color);
  };
  applyBorder();

  const fitModule=()=>{
    const ratio=(img.naturalWidth||1)/(img.naturalHeight||1);
    m._imageRatio=ratio;
    const maxW=Math.min(680,innerWidth-36),maxH=Math.min(560,innerHeight-36);
    let w=Math.min(560,maxW),h=w/ratio;
    if(h>maxH){h=maxH;w=h*ratio}
    w=Math.max(220,w);h=w/ratio;
    if(h<150){h=150;w=h*ratio}
    m.style.width=`${w}px`;m.style.height=`${h}px`;
    m.style.left=`${clamp(m.offsetLeft,0,BOARD_WIDTH-w)}px`;
    m.style.top=`${clamp(m.offsetTop,0,BOARD_HEIGHT-h)}px`;
  };

  const setSrc=(src,alt='Board image',{fit=true}={})=>{
    img.onload=()=>{
      const ratio=(img.naturalWidth||1)/(img.naturalHeight||1);
      m._imageRatio=ratio;
      if(fit)fitModule();
    };
    img.onerror=()=>{img.hidden=true;m.classList.remove('has-image')};
    img.src=src;img.alt=alt;img.hidden=false;m.classList.add('has-image');
  };

  const setFile=file=>{
    if(!file||!file.type?.startsWith('image/'))return;
    if(objectUrl)URL.revokeObjectURL(objectUrl);
    objectUrl=URL.createObjectURL(file);
    setSrc(objectUrl,file.name||'Board image');
    fileToBoardImageData(file).then(data=>{
      if(data){
        boardImageSrc=data;
        return boardImagePreviewData(data).then(preview=>{
          boardImagePreviewSrc=preview;
          notifyBoardChanged('image');
        });
      }
    }).catch(()=>{});
  };

  const setUrl=(url,{notify=true,fit=true,previewSrc=''}={})=>{
    if(!url)return;
    if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=''}
    boardImageSrc=url;
    boardImagePreviewSrc=previewSrc||(!url.startsWith('data:image/')?url:'');
    setSrc(url,'Board image',{fit});
    if(url.startsWith('data:image/')&&!boardImagePreviewSrc){
      boardImagePreviewData(url).then(preview=>{
        if(!preview)return;
        boardImagePreviewSrc=preview;
        notifyBoardChanged('image-preview');
      }).catch(()=>{});
    }
    if(notify)notifyBoardChanged('image');
  };

  m._setImage=setFile;
  m._setImageUrl=setUrl;
  m._boardGetState=()=>({src:boardImageSrc||(!img.src.startsWith('blob:')?img.src:''),previewSrc:boardImagePreviewSrc,border:borderStyle?.value||'none',borderColor:borderColor?.value||'#17191d'});
  m._boardSetState=state=>{
    if(!state)return;
    if(borderStyle)borderStyle.value=['none','thin','medium','thick','double'].includes(state.border)?state.border:'none';
    if(borderColor&&/^#[0-9a-f]{6}$/i.test(state.borderColor||''))borderColor.value=state.borderColor;
    applyBorder();
    if(state.src)setUrl(state.src,{notify:false,fit:false,previewSrc:String(state.previewSrc||'')});
  };

  stage.addEventListener('click',()=>input.click());
  replace?.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();input.click()});
  borderStyle?.addEventListener('change',()=>{applyBorder();notifyBoardChanged('image-border')});
  borderColor?.addEventListener('input',applyBorder);
  borderColor?.addEventListener('change',()=>{applyBorder();notifyBoardChanged('image-border')});
  input.addEventListener('change',()=>{setFile(input.files?.[0]);input.value=''});
  stage.addEventListener('dragover',e=>{e.preventDefault();e.stopPropagation();stage.classList.add('is-dragover')});
  stage.addEventListener('dragleave',()=>stage.classList.remove('is-dragover'));
  stage.addEventListener('drop',e=>{
    e.preventDefault();e.stopPropagation();stage.classList.remove('is-dragover');
    const src=getDraggedImageSource(e.dataTransfer);
    if(src?.file)setFile(src.file);else if(src?.url)setUrl(src.url);
  });

  const prior=m._cleanup;
  m._cleanup=()=>{prior?.();if(objectUrl)URL.revokeObjectURL(objectUrl)}
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
  m._boardGetState=()=>({url:input.value,loaded:m.classList.contains('has-video')});
  m._boardSetState=state=>{if(!state)return;input.value=state.url||'';if(state.loaded&&input.value)loadVideo()};
  const prior=m._cleanup;m._cleanup=()=>{prior?.();frame.src=''}
}

function setupAmbienceVideo(m){
  const frame=m.querySelector('.ambience-video-frame');
  const title=m.querySelector('.ambience-video-title');
  const message=m.querySelector('.ambience-video-message');
  const channelButtons=[...m.querySelectorAll('[data-ambience-channel-button]')];

  const channels={
    campfire:{
      title:'Campfire',
      id:'E77jmtut1Zc'
    },
    fireplace:{
      title:'Fireplace',
      id:'mSX3OyW9Rao'
    },
    aquarium:{
      title:'Aquarium',
      id:'W0u-7lgWXpw'
    }
  };

  const loadChannel=channel=>{
    const key=channel in channels?channel:'campfire';
    const config=channels[key];

    m.dataset.ambienceChannel=key;
    title.textContent=config.title;
    frame.title=`${config.title} ambience video`;

    channelButtons.forEach(button=>{
      const active=button.dataset.ambienceChannelButton===key;
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-pressed',String(active));
    });

    message.textContent='';
    frame.hidden=false;

    const params=new URLSearchParams({
      autoplay:'1',
      mute:'1',
      rel:'0',
      playsinline:'1'
    });

    if(location.protocol==='http:'||location.protocol==='https:'){
      params.set('origin',location.origin);
    }

    frame.src=`https://www.youtube.com/embed/${encodeURIComponent(config.id)}?${params.toString()}`;
  };

  channelButtons.forEach(button=>{
    button.addEventListener('click',()=>{
      loadChannel(button.dataset.ambienceChannelButton);
    });
  });

  m.querySelector('.ambience-video-font').addEventListener('click',()=>{
    cycleData(m,'font',FONT_OPTIONS);
  });

  loadChannel(m.dataset.ambienceChannel||'campfire');

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    frame.src='';
  };
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
    let size=Math.min(14,Math.max(7,label.clientWidth*.18));
    const minSize=6.25;
    t.style.fontSize=`${size}px`;
    const fits=()=>words.every(w=>w.scrollWidth<=t.clientWidth+1)&&t.scrollHeight<=t.clientHeight+1;
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
    const needs={
      compact:{w:330,h:170,defaultW:390,defaultH:190},
      music:{w:270,h:330,defaultW:330,defaultH:430},
      ipod:{w:260,h:330,defaultW:300,defaultH:390},
      vinyl:{w:280,h:380,defaultW:320,defaultH:440}
    }[style];
    if(needs){
      m.style.minWidth=`${needs.w}px`;
      m.style.minHeight=`${needs.h}px`;
      const rect={width:m.offsetWidth,height:m.offsetHeight};
      if(style==='compact'){
        m.style.width=`${needs.defaultW}px`;
        m.style.height=`${needs.defaultH}px`;
      }else{
        if(rect.width<needs.w)m.style.width=`${needs.defaultW}px`;
        if(rect.height<needs.h)m.style.height=`${needs.defaultH}px`;
      }
    }
    if(style==='vinyl')requestAnimationFrame(()=>m.querySelectorAll('.vinyl-label .boombox-title').forEach(fitVinylTitle));
  };
  styleButton.addEventListener('click',e=>{e.stopPropagation();styleMenu.hidden=!styleMenu.hidden});
  styleMenu.querySelectorAll('[data-player-style-option]').forEach(b=>b.addEventListener('click',()=>setStyle(b.dataset.playerStyleOption)));
  document.addEventListener('pointerdown',m._boomboxOutside=e=>{if(!m.contains(e.target))styleMenu.hidden=true});
  audio.addEventListener('play',renderPlay);audio.addEventListener('pause',renderPlay);audio.addEventListener('loadedmetadata',syncProgress);audio.addEventListener('timeupdate',syncProgress);
  const boomboxResizeObserver=new ResizeObserver(()=>{
    if(m.dataset.playerStyle==='vinyl')m.querySelectorAll('.vinyl-label .boombox-title').forEach(fitVinylTitle);
  });
  boomboxResizeObserver.observe(m);
  setVolume(55);setStyle('compact');load(0,false);
  m._boardGetState=()=>({
    track:index,
    volume:Math.round(audio.volume*100),
    playerStyle:m.dataset.playerStyle||'compact',
    currentTime:Number.isFinite(audio.currentTime)?audio.currentTime:0
  });
  m._boardSetState=state=>{
    if(!state)return;
    const track=Math.max(0,Math.min(tracks.length-1,Math.round(Number(state.track)||0)));
    setStyle(['compact','music','ipod','vinyl'].includes(state.playerStyle)?state.playerStyle:'compact');
    setVolume(Number.isFinite(Number(state.volume))?Number(state.volume):55);
    load(track,false);
    const restoreTime=Math.max(0,Number(state.currentTime)||0);
    if(restoreTime){
      audio.addEventListener('loadedmetadata',()=>{try{audio.currentTime=Math.min(restoreTime,audio.duration||restoreTime)}catch{}},{once:true});
    }
  };
  const prior=m._cleanup;m._cleanup=()=>{prior?.();boomboxResizeObserver.disconnect();document.removeEventListener('pointerdown',m._boomboxOutside);audio.pause();audio.removeAttribute('src');audio.load()}
}

function setupTextBubble(m){
  const text=m.querySelector('.textbubble-text');m.querySelector('.textbubble-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));m.querySelector('.textbubble-font').addEventListener('click',()=>{cycleData(m,'font',FONT_OPTIONS);requestAnimationFrame(()=>text.dispatchEvent(new Event('input')))});m.querySelector('.textbubble-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));const cleanup=fitEditableText(text,m,'--bubble-size');m._cleanup=cleanup
}

function setupDictionary(m){
  const form=m.querySelector('.dictionary-search');
  const input=m.querySelector('.dictionary-input');
  const submit=m.querySelector('.dictionary-submit');
  const status=m.querySelector('.dictionary-status');
  const content=m.querySelector('.dictionary-content');
  const welcome=m.querySelector('.dictionary-welcome');
  const results=m.querySelector('.dictionary-results');
  let entries=[];
  let requestController=null;
  let activeAudio=null;

  const cleanText=(value,max=5000)=>String(value||'').trim().slice(0,max);
  const uniqueWords=(values,max=28)=>[...new Set((Array.isArray(values)?values:[]).map(value=>cleanText(value,80)).filter(Boolean))].slice(0,max);
  const normalizeEntries=data=>(Array.isArray(data)?data:[]).slice(0,4).map(entry=>({
    word:cleanText(entry?.word,120),
    phonetic:cleanText(entry?.phonetic,180),
    phonetics:(Array.isArray(entry?.phonetics)?entry.phonetics:[]).map(item=>({
      text:cleanText(item?.text,180),
      audio:cleanText(item?.audio,1000)
    })).filter(item=>item.text||item.audio).slice(0,10),
    origin:cleanText(entry?.origin,3000),
    sourceUrls:(Array.isArray(entry?.sourceUrls)?entry.sourceUrls:[]).map(url=>cleanText(url,1000)).filter(url=>/^https?:\/\//i.test(url)).slice(0,5),
    meanings:(Array.isArray(entry?.meanings)?entry.meanings:[]).map(meaning=>({
      partOfSpeech:cleanText(meaning?.partOfSpeech,80),
      synonyms:uniqueWords(meaning?.synonyms),
      antonyms:uniqueWords(meaning?.antonyms),
      definitions:(Array.isArray(meaning?.definitions)?meaning.definitions:[]).map(definition=>({
        definition:cleanText(definition?.definition),
        example:cleanText(definition?.example,2000),
        synonyms:uniqueWords(definition?.synonyms),
        antonyms:uniqueWords(definition?.antonyms)
      })).filter(definition=>definition.definition)
    })).filter(meaning=>meaning.partOfSpeech||meaning.definitions.length)
  })).filter(entry=>entry.word||entry.meanings.length);

  const createChipGroup=(label,words)=>{
    if(!words.length)return null;
    const row=document.createElement('div');
    row.className='dictionary-word-row';
    const heading=document.createElement('span');
    heading.textContent=label;
    const chips=document.createElement('div');
    chips.className='dictionary-chips';
    words.forEach(word=>{
      const chip=document.createElement('button');
      chip.type='button';
      chip.textContent=word;
      chip.title=`Look up ${word}`;
      chip.addEventListener('click',()=>{
        input.value=word;
        lookup(word);
      });
      chips.appendChild(chip);
    });
    row.append(heading,chips);
    return row;
  };

  const playPronunciation=(url,button,word)=>{
    if(activeAudio){activeAudio.pause();activeAudio=null}
    button.classList.add('is-playing');
    const finish=()=>button.classList.remove('is-playing');
    if(url){
      const resolved=url.startsWith('//')?`https:${url}`:url;
      const audio=new Audio(resolved);
      activeAudio=audio;
      const finishAudio=()=>{finish();if(activeAudio===audio)activeAudio=null};
      audio.addEventListener('ended',finishAudio,{once:true});
      audio.addEventListener('error',finishAudio,{once:true});
      audio.play().catch(finishAudio);
      return;
    }
    if('speechSynthesis'in window&&word){
      speechSynthesis.cancel();
      const utterance=new SpeechSynthesisUtterance(word);
      utterance.rate=.82;
      utterance.addEventListener('end',finish,{once:true});
      utterance.addEventListener('error',finish,{once:true});
      speechSynthesis.speak(utterance);
    }else finish();
  };

  const renderEntries=(animate=true)=>{
    results.replaceChildren();
    welcome.hidden=Boolean(entries.length);
    results.hidden=!entries.length;
    if(!entries.length)return;

    entries.forEach((entry,entryIndex)=>{
      const article=document.createElement('article');
      article.className='dictionary-entry';

      const head=document.createElement('header');
      head.className='dictionary-entry-head';
      const identity=document.createElement('div');
      const word=document.createElement('strong');
      word.textContent=entry.word||input.value;
      const phoneticText=entry.phonetic||entry.phonetics.find(item=>item.text)?.text||'';
      if(phoneticText){
        const phonetic=document.createElement('span');
        phonetic.textContent=phoneticText;
        identity.append(word,phonetic);
      }else identity.append(word);
      head.appendChild(identity);

      const audioUrl=entry.phonetics.find(item=>item.audio)?.audio||'';
      if(entry.word){
        const audioButton=document.createElement('button');
        audioButton.type='button';
        audioButton.className='dictionary-audio';
        audioButton.setAttribute('aria-label',`Hear ${entry.word} pronounced`);
        audioButton.title='Hear pronunciation';
        audioButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 10v4h3l4 3V7L8 10H5Z" fill="currentColor"/><path d="M15 9.2a4 4 0 0 1 0 5.6M17.5 6.8a7.3 7.3 0 0 1 0 10.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
        audioButton.addEventListener('click',()=>playPronunciation(audioUrl,audioButton,entry.word));
        head.appendChild(audioButton);
      }
      article.appendChild(head);

      if(entry.origin){
        const origin=document.createElement('p');
        origin.className='dictionary-origin';
        const originLabel=document.createElement('strong');
        originLabel.textContent='Origin';
        origin.append(originLabel,document.createTextNode(` ${entry.origin}`));
        article.appendChild(origin);
      }

      entry.meanings.forEach(meaning=>{
        const section=document.createElement('section');
        section.className='dictionary-meaning';
        const part=document.createElement('div');
        part.className='dictionary-part';
        const partName=document.createElement('strong');
        partName.textContent=meaning.partOfSpeech||'meaning';
        const line=document.createElement('i');
        part.append(partName,line);
        section.appendChild(part);

        const list=document.createElement('ol');
        meaning.definitions.forEach(definition=>{
          const item=document.createElement('li');
          const copy=document.createElement('p');
          copy.textContent=definition.definition;
          item.appendChild(copy);
          if(definition.example){
            const example=document.createElement('blockquote');
            example.textContent=`“${definition.example}”`;
            item.appendChild(example);
          }
          const synonymRow=createChipGroup('Similar',uniqueWords(definition.synonyms));
          const antonymRow=createChipGroup('Opposite',uniqueWords(definition.antonyms));
          if(synonymRow)item.appendChild(synonymRow);
          if(antonymRow)item.appendChild(antonymRow);
          list.appendChild(item);
        });
        section.appendChild(list);
        const meaningSynonyms=createChipGroup('Synonyms',uniqueWords(meaning.synonyms));
        const meaningAntonyms=createChipGroup('Antonyms',uniqueWords(meaning.antonyms));
        if(meaningSynonyms)section.appendChild(meaningSynonyms);
        if(meaningAntonyms)section.appendChild(meaningAntonyms);
        article.appendChild(section);
      });

      if(entry.sourceUrls.length){
        const source=document.createElement('a');
        source.className='dictionary-source';
        source.href=entry.sourceUrls[0];
        source.target='_blank';
        source.rel='noopener noreferrer';
        source.textContent='View source entry ↗';
        article.appendChild(source);
      }
      results.appendChild(article);
      if(entryIndex<entries.length-1){
        const divider=document.createElement('div');
        divider.className='dictionary-entry-divider';
        results.appendChild(divider);
      }
    });

    if(animate&&results.animate)results.animate([
      {opacity:0,transform:'translateY(8px)'},
      {opacity:1,transform:'translateY(0)'}
    ],{duration:260,easing:'cubic-bezier(.2,.8,.2,1)'});
  };

  const showMessage=(title,message)=>{
    entries=[];
    results.replaceChildren();
    results.hidden=true;
    welcome.hidden=false;
    welcome.querySelector('.dictionary-welcome-icon').textContent='?';
    welcome.querySelector('strong').textContent=title;
    welcome.querySelector('p').textContent=message;
  };

  const setLoading=loading=>{
    m.classList.toggle('is-loading',loading);
    submit.disabled=loading;
    input.disabled=loading;
  };

  const datamusePartNames={n:'noun',v:'verb',adj:'adjective',adv:'adverb',u:'word'};
  const datamuseEntry=(result,synonyms=[],antonyms=[])=>{
    if(!result||typeof result!=='object')return[];
    const meaningMap=new Map();
    for(const raw of Array.isArray(result.defs)?result.defs:[]){
      const [code,...definitionParts]=String(raw).split('\t');
      const definition=cleanText(definitionParts.join(' ').trim());
      if(!definition)continue;
      const partOfSpeech=datamusePartNames[code]||code||'word';
      if(!meaningMap.has(partOfSpeech))meaningMap.set(partOfSpeech,[]);
      meaningMap.get(partOfSpeech).push({definition,example:'',synonyms:[],antonyms:[]});
    }
    const tags=Array.isArray(result.tags)?result.tags.map(String):[];
    const ipa=tags.find(tag=>tag.startsWith('ipa_pron:'))?.slice(9).trim()||'';
    const pronunciation=ipa||tags.find(tag=>tag.startsWith('pron:'))?.slice(5).trim()||'';
    const syllables=Math.max(0,Number(result.numSyllables)||0);
    const word=cleanText(result.word,120);
    const meanings=[...meaningMap.entries()].map(([partOfSpeech,definitions],meaningIndex)=>({
      partOfSpeech,
      definitions,
      synonyms:meaningIndex===0?uniqueWords(synonyms.map(item=>item?.word)):[],
      antonyms:meaningIndex===0?uniqueWords(antonyms.map(item=>item?.word)):[]
    }));
    if(!meanings.length)return[];
    return normalizeEntries([{
      word,
      phonetic:pronunciation?`/${pronunciation}/`:syllables?`${syllables} ${syllables===1?'syllable':'syllables'}`:'',
      phonetics:pronunciation?[{text:`/${pronunciation}/`,audio:''}]:[],
      origin:'',
      sourceUrls:[],
      meanings
    }]);
  };

  async function lookup(value){
    const query=String(value||input.value).trim().replace(/\s+/g,' ');
    if(!query){input.focus();return}
    input.value=query;
    requestController?.abort();
    const controller=new AbortController();
    requestController=controller;
    let timedOut=false;
    const requestTimeout=window.setTimeout(()=>{
      timedOut=true;
      controller.abort();
    },12000);
    setLoading(true);
    status.textContent=`Looking up “${query}”…`;
    try{
      const exactUrl=`https://api.datamuse.com/words?sp=${encodeURIComponent(query)}&md=dpsr&ipa=1&max=10`;
      const synonymUrl=`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(query)}&max=28`;
      const antonymUrl=`https://api.datamuse.com/words?rel_ant=${encodeURIComponent(query)}&max=28`;
      const [exactResponse,synonymResponse,antonymResponse]=await Promise.all([
        fetch(exactUrl,{signal:controller.signal}),
        fetch(synonymUrl,{signal:controller.signal}),
        fetch(antonymUrl,{signal:controller.signal})
      ]);
      if(!exactResponse.ok)throw new Error(`request-${exactResponse.status}`);
      const [matches,synonyms,antonyms]=await Promise.all([
        exactResponse.json(),
        synonymResponse.ok?synonymResponse.json():[],
        antonymResponse.ok?antonymResponse.json():[]
      ]);
      const exact=(Array.isArray(matches)?matches:[]).find(item=>String(item?.word||'').toLocaleLowerCase()===query.toLocaleLowerCase())||matches?.[0];
      entries=datamuseEntry(exact,synonyms,antonyms);
      if(!entries.length)throw new Error('not-found');
      status.textContent='';
      welcome.querySelector('.dictionary-welcome-icon').textContent='A';
      welcome.querySelector('strong').textContent='Discover a word';
      welcome.querySelector('p').textContent='Search to see pronunciation, meanings, examples, synonyms, antonyms, and more.';
      renderEntries(true);
      notifyBoardChanged('dictionary-result');
    }catch(error){
      if(error?.name==='AbortError'&&!timedOut)return;
      status.textContent='';
      if(error?.message==='not-found')showMessage('Word not found','Check the spelling or try a different form of the word.');
      else showMessage('Lookup unavailable','The dictionary could not be reached. Check your connection and try again.');
      notifyBoardChanged('dictionary-result');
    }finally{
      window.clearTimeout(requestTimeout);
      if(requestController===controller){
        requestController=null;
        setLoading(false);
      }
    }
  }

  form.addEventListener('submit',event=>{
    event.preventDefault();
    lookup(input.value);
  });
  m.querySelector('.dictionary-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.dictionary-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.dictionary-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  m._boardGetState=()=>({query:input.value,entries});
  m._boardSetState=state=>{
    if(!state)return;
    input.value=cleanText(state.query,80);
    entries=normalizeEntries(state.entries);
    renderEntries(false);
  };

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    requestController?.abort();
    activeAudio?.pause();
    if('speechSynthesis'in window)speechSynthesis.cancel();
  };
}

function bindEditableModuleTitle(m,selectorOrElement,fallback){
  const title=selectorOrElement instanceof Element?selectorOrElement:m.querySelector(selectorOrElement);
  if(!title)return{get:()=>fallback,set:()=>{}};
  if(title._teacherTilesTitleBinding)return title._teacherTilesTitleBinding;
  const normalize=value=>String(value||'').replace(/[\r\n]+/g,' ').replace(/\s+/g,' ').trim().slice(0,60);
  const set=value=>{title.textContent=normalize(value)||fallback};
  const placeCaretAtEnd=()=>{
    if(document.activeElement!==title||!title.isContentEditable)return;
    const selection=getSelection();
    if(!selection)return;
    const range=document.createRange();
    range.selectNodeContents(title);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  };
  title.addEventListener('keydown',event=>{
    if(event.key===' '){event.stopPropagation();return}
    if(event.key==='Enter'){event.preventDefault();event.stopPropagation();exitModuleTextEdit(title)}
  });
  title.addEventListener('input',()=>{
    const clean=String(title.textContent||'').replace(/[\r\n]+/g,' ').slice(0,60);
    if(title.textContent!==clean){title.textContent=clean;placeCaretAtEnd()}
    notifyBoardChanged('module-title');
  });
  title.addEventListener('blur',()=>set(title.textContent));
  const binding={get:()=>normalize(title.textContent)||fallback,set};
  title._teacherTilesTitleBinding=binding;
  return binding;
}

const EDITABLE_TILE_HEADINGS={
  noise:'.noise-heading strong',
  collections:'.collection-title',
  groupmaker:'.groupmaker-heading strong',
  lunchcount:'.lunchcount-heading strong',
  voting:'.voting-heading strong',
  ruler:'.ruler-header>div>span',
  calculator:'.calculator-header>span',
  grapher:'.grapher-header strong',
  tablemaker:'.table-maker-title',
  tallychart:'.tally-chart-title',
  periodictable:'.periodic-header strong',
  money:'.money-header strong:first-of-type',
  cvcword:'.cvcword-header>div>span:first-child',
  highfrequency:'.highfrequency-header>div>span:first-child',
  customflashcards:'.customflashcards-header>div>span:first-child',
  abc:'.abc-header>div>span:first-child',
  numberline:'.numberline-heading>span:first-child',
  hundredschart:'.hundreds-header>div>span:first-child',
  tenframes:'.tenframes-heading>span:first-child',
  dictionary:'.dictionary-header strong',
  translation:'.translation-title',
  livecaption:'.livecaption-title',
  voicememo:'.voicememo-title',
  worldmap:'.worldmap-title',
  compass:'.compass-title',
  shapes:'.shapes-header>div>span:first-child',
  hangman:'.hangman-kicker',
  wordypuzzle:'.wordy-kicker',
  photobooth:'.photobooth-title',
  mirror:'.mirror-title',
  weather:'.weather-title',
  temperature:'.temperature-title'
};

function setupEditableTileHeading(m,type){
  const selector=EDITABLE_TILE_HEADINGS[type];
  if(!selector)return;
  const title=m.querySelector(selector);
  if(!title)return;
  const fallback=String(title.textContent||'Tile').replace(/\s+/g,' ').trim()||'Tile';
  title.contentEditable='true';
  title.dataset.textEditMode='double';
  title.classList.add('module-text-edit-target','editable-tile-heading');
  title.setAttribute('role','textbox');
  title.setAttribute('aria-label','Tile title');
  bindEditableModuleTitle(m,title,fallback);
}

function setupTranslation(m){
  const tileTitle=bindEditableModuleTitle(m,'.translation-title','Language bridge');
  const source=m.querySelector('.translation-source');
  const target=m.querySelector('.translation-target');
  const sourcePickerRoot=m.querySelector('[data-language-picker="source"]');
  const targetPickerRoot=m.querySelector('[data-language-picker="target"]');
  const input=m.querySelector('.translation-input');
  const output=m.querySelector('.translation-output');
  const count=m.querySelector('.translation-count');
  const status=m.querySelector('.translation-status');
  const submit=m.querySelector('.translation-submit');
  const swap=m.querySelector('.translation-swap');
  const mic=m.querySelector('.translation-mic');
  const speak=m.querySelector('.translation-speak');
  const copy=m.querySelector('.translation-copy');
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  let translatedText='';
  let requestController=null;
  let recognition=null;
  let listening=false;

  const languageFor=code=>TRANSLATION_LANGUAGES.find(language=>language.code===code)||TRANSLATION_LANGUAGES[0];
  const setupLanguagePicker=(root,field,defaultCode)=>{
    const search=root.querySelector('.translation-language-search');
    const menu=root.querySelector('.translation-language-menu');
    let visibleLanguages=[...TRANSLATION_LANGUAGES];
    let activeIndex=-1;

    const currentLanguage=()=>languageFor(field.value||defaultCode);
    const close=({restore=true}={})=>{
      root.classList.remove('is-open');
      search.setAttribute('aria-expanded','false');
      activeIndex=-1;
      if(restore)search.value=currentLanguage().name;
    };
    const choose=(code,{announce=true}={})=>{
      const language=languageFor(code);
      field.value=language.code;
      search.value=language.name;
      close({restore:false});
      if(announce){status.textContent='';notifyBoardChanged('translation-language')}
    };
    const render=(query='')=>{
      const normalized=query.trim().toLocaleLowerCase();
      visibleLanguages=TRANSLATION_LANGUAGES.filter(language=>!normalized||language.name.toLocaleLowerCase().includes(normalized)||language.code.toLocaleLowerCase().includes(normalized));
      activeIndex=visibleLanguages.length?0:-1;
      menu.replaceChildren();
      if(!visibleLanguages.length){
        const empty=document.createElement('span');
        empty.className='translation-language-empty';
        empty.textContent='No languages found';
        menu.appendChild(empty);
        return;
      }
      visibleLanguages.forEach((language,index)=>{
        const button=document.createElement('button');
        button.type='button';
        button.className='translation-language-option';
        button.setAttribute('role','option');
        button.dataset.languageCode=language.code;
        button.setAttribute('aria-selected',String(language.code===field.value));
        const name=document.createElement('strong');
        const codeLabel=document.createElement('small');
        name.textContent=language.name;
        codeLabel.textContent=language.code;
        button.append(name,codeLabel);
        button.classList.toggle('is-keyboard-active',index===activeIndex);
        button.addEventListener('pointerdown',event=>event.preventDefault());
        button.addEventListener('click',()=>{choose(language.code);search.focus({preventScroll:true})});
        menu.appendChild(button);
      });
    };
    const syncActiveOption=()=>{
      const options=[...menu.querySelectorAll('.translation-language-option')];
      options.forEach((option,index)=>option.classList.toggle('is-keyboard-active',index===activeIndex));
      options[activeIndex]?.scrollIntoView({block:'nearest'});
    };
    const open=()=>{
      root.classList.add('is-open');
      search.setAttribute('aria-expanded','true');
      render(search.value===currentLanguage().name?'':search.value);
    };
    search.addEventListener('focus',()=>{search.select();open()});
    search.addEventListener('input',()=>{open();render(search.value)});
    search.addEventListener('keydown',event=>{
      if(event.key==='ArrowDown'||event.key==='ArrowUp'){
        event.preventDefault();
        if(!root.classList.contains('is-open'))open();
        if(visibleLanguages.length)activeIndex=(activeIndex+(event.key==='ArrowDown'?1:-1)+visibleLanguages.length)%visibleLanguages.length;
        syncActiveOption();
      }else if(event.key==='Enter'){
        if(root.classList.contains('is-open')&&visibleLanguages[activeIndex]){event.preventDefault();choose(visibleLanguages[activeIndex].code)}
      }else if(event.key==='Escape'){
        event.preventDefault();
        close();
        search.blur();
      }
    });
    search.addEventListener('blur',()=>setTimeout(()=>{if(!root.contains(document.activeElement))close()},0));
    menu.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});
    choose(defaultCode,{announce:false});
    render();
    return{
      get:()=>field.value||defaultCode,
      set:(code,options={})=>choose(code,{announce:options.announce??false}),
      setDisabled:disabled=>{if(disabled)close();search.disabled=disabled;root.classList.toggle('is-disabled',disabled)}
    };
  };
  const sourcePicker=setupLanguagePicker(sourcePickerRoot,source,'en');
  const targetPicker=setupLanguagePicker(targetPickerRoot,target,'es');
  const renderOutput=(value,placeholder='Your translation will appear here.')=>{
    translatedText=String(value||'');
    output.replaceChildren();
    if(translatedText)output.textContent=translatedText;
    else{const span=document.createElement('span');span.textContent=placeholder;output.appendChild(span)}
    speak.disabled=!translatedText;
    copy.disabled=!translatedText;
  };
  const updateCount=()=>{count.textContent=`${input.value.length} / 450`};
  const setLoading=loading=>{
    m.classList.toggle('is-translating',loading);
    submit.disabled=loading;
    sourcePicker.setDisabled(loading);
    targetPicker.setDisabled(loading);
  };

  async function translate(){
    const text=input.value.trim();
    if(!text){status.textContent='Enter something to translate.';input.focus();return}
    if(new TextEncoder().encode(text).length>480){status.textContent='Please shorten the text slightly.';return}
    requestController?.abort();
    const controller=new AbortController();
    requestController=controller;
    status.textContent='Translating…';
    setLoading(true);
    try{
      if(sourcePicker.get()===targetPicker.get()){renderOutput(text);status.textContent='Languages match — no translation needed.';return}
      const url=`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sourcePicker.get())}&tl=${encodeURIComponent(targetPicker.get())}&dt=t&q=${encodeURIComponent(text)}`;
      const response=await fetch(url,{signal:controller.signal});
      if(!response.ok)throw new Error(`translation-${response.status}`);
      const data=await response.json();
      const result=Array.isArray(data?.[0])?data[0].map(segment=>Array.isArray(segment)?String(segment[0]||''):'').join('').trim():'';
      if(!result||/^[\s\-–—_.]+$/.test(result)||/^(testvalue|null|undefined)$/i.test(result))throw new Error('translation-unavailable');
      renderOutput(result);
      status.textContent='Translated';
      notifyBoardChanged('translation-result');
    }catch(error){
      if(error?.name==='AbortError')return;
      status.textContent='Translation is unavailable right now. Try again.';
      renderOutput('', 'Could not translate this text.');
    }finally{
      if(requestController===controller){requestController=null;setLoading(false)}
    }
  }

  input.addEventListener('input',()=>{updateCount();status.textContent=''});
  input.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();translate()}});
  submit.addEventListener('click',translate);
  swap.addEventListener('click',()=>{
    const priorSource=sourcePicker.get();
    sourcePicker.set(targetPicker.get());
    targetPicker.set(priorSource);
    if(translatedText){const priorInput=input.value;input.value=translatedText;renderOutput(priorInput);updateCount()}
    status.textContent='Languages swapped';
    notifyBoardChanged('translation-swap');
  });

  if(!SpeechRecognition){
    mic.disabled=true;
    mic.title='Speech input is not supported in this browser';
  }else{
    mic.addEventListener('click',()=>{
      if(listening){recognition?.stop();return}
      recognition=new SpeechRecognition();
      recognition.lang=languageFor(sourcePicker.get()).speech;
      recognition.interimResults=true;
      recognition.continuous=false;
      recognition.maxAlternatives=1;
      recognition.onstart=()=>{listening=true;m.classList.add('is-listening');status.textContent='Listening…'};
      recognition.onresult=event=>{
        let transcript='';
        for(let i=event.resultIndex;i<event.results.length;i++)transcript+=event.results[i][0]?.transcript||'';
        if(transcript){input.value=transcript.trim();updateCount()}
      };
      recognition.onerror=event=>{status.textContent=event.error==='not-allowed'?'Microphone permission was not granted.':'Speech input could not start.'};
      recognition.onend=()=>{listening=false;m.classList.remove('is-listening');if(input.value.trim()){status.textContent='Speech captured';notifyBoardChanged('translation-speech')}};
      try{recognition.start()}catch{status.textContent='Speech input could not start.'}
    });
  }

  speak.addEventListener('click',()=>{
    if(!translatedText||!('speechSynthesis'in window))return;
    speechSynthesis.cancel();
    const utterance=new SpeechSynthesisUtterance(translatedText);
    utterance.lang=languageFor(targetPicker.get()).speech;
    speechSynthesis.speak(utterance);
  });
  copy.addEventListener('click',async()=>{
    if(!translatedText)return;
    try{await navigator.clipboard.writeText(translatedText);status.textContent='Copied translation'}
    catch{status.textContent='Could not copy automatically.'}
  });
  m.querySelector('.translation-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.translation-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.translation-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  renderOutput('');
  updateCount();
  m._boardGetState=()=>({title:tileTitle.get(),source:sourcePicker.get(),target:targetPicker.get(),input:input.value,output:translatedText});
  m._boardSetState=state=>{
    if(!state)return;
    tileTitle.set(state.title);
    sourcePicker.set(TRANSLATION_LANGUAGES.some(language=>language.code===state.source)?state.source:'en');
    targetPicker.set(TRANSLATION_LANGUAGES.some(language=>language.code===state.target)?state.target:'es');
    input.value=String(state.input||'').slice(0,450);
    renderOutput(String(state.output||''));
    updateCount();
  };
  const prior=m._cleanup;
  m._cleanup=()=>{prior?.();requestController?.abort();recognition?.abort();if('speechSynthesis'in window)speechSynthesis.cancel()};
}

function setupLiveCaption(m){
  const tileTitle=bindEditableModuleTitle(m,'.livecaption-title','Live Captions');
  const toggle=m.querySelector('.livecaption-toggle');
  const toggleLabel=toggle.querySelector('span');
  const stateLabel=m.querySelector('.livecaption-state b');
  const message=m.querySelector('.livecaption-message');
  const current=m.querySelector('.livecaption-current-text');
  const historyEl=m.querySelector('.livecaption-history');
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  let recognition=null;
  let wantsListening=false;
  let isListening=false;
  let restartTimer=0;
  let history=[];
  let pendingInterim='';
  let currentFitFrame=0;

  const segmentCaptionText=value=>{
    const normalized=String(value||'').replace(/\s+/g,' ').trim();
    if(!normalized)return[];
    const sentences=normalized.match(/[^.!?]+(?:[.!?]+|$)/g)||[normalized];
    const segments=[];
    for(const sentence of sentences){
      const words=sentence.trim().split(/\s+/).filter(Boolean);
      let chunk=[];
      for(const word of words){
        const candidate=[...chunk,word].join(' ');
        if(chunk.length&&(chunk.length>=14||candidate.length>88)){
          segments.push(chunk.join(' '));
          chunk=[word];
        }else chunk.push(word);
      }
      if(chunk.length)segments.push(chunk.join(' '));
    }
    return segments.filter(Boolean);
  };
  const fitCurrentText=()=>{
    cancelAnimationFrame(currentFitFrame);
    currentFitFrame=requestAnimationFrame(()=>{
      let low=16,high=56,best=16;
      while(high-low>.5){
        const size=(low+high)/2;
        current.style.fontSize=`${size}px`;
        if(current.scrollHeight<=current.clientHeight+1&&current.scrollWidth<=current.clientWidth+1){best=size;low=size}else high=size;
      }
      current.style.fontSize=`${best}px`;
    });
  };
  const displayCurrent=value=>{
    const phrase=segmentCaptionText(value).at(-1)||'Listening…';
    current.textContent=phrase;
    fitCurrentText();
  };

  const renderHistory=()=>{
    historyEl.replaceChildren();
    if(!history.length){
      const empty=document.createElement('p');
      empty.className='livecaption-empty';
      empty.textContent='Your caption history will appear here.';
      historyEl.appendChild(empty);
      return;
    }
    history.forEach((caption,index)=>{
      const row=document.createElement('p');
      const number=document.createElement('span');
      const text=document.createElement('strong');
      number.textContent=String(index+1).padStart(2,'0');
      text.textContent=caption;
      row.append(number,text);
      historyEl.appendChild(row);
    });
    requestAnimationFrame(()=>{historyEl.scrollTop=historyEl.scrollHeight});
  };
  const setListeningUI=listening=>{
    isListening=listening;
    m.classList.toggle('is-listening',listening);
    m.classList.toggle('is-paused',!listening);
    toggle.setAttribute('aria-pressed',String(listening));
    toggleLabel.textContent=listening?'Pause captions':'Start captions';
    stateLabel.textContent=listening?'ON':'OFF';
    if(!listening)renderHistory();
  };
  const addCaption=value=>{
    const segments=segmentCaptionText(value);
    if(!segments.length)return;
    for(const text of segments)if(history[history.length-1]!==text)history.push(text);
    if(history.length>100)history=history.slice(-100);
    displayCurrent(segments.at(-1));
    notifyBoardChanged('live-caption');
  };
  const commitPending=()=>{
    if(!pendingInterim)return;
    addCaption(pendingInterim);
    pendingInterim='';
  };
  const startRecognition=()=>{
    if(!SpeechRecognition||!wantsListening)return;
    clearTimeout(restartTimer);
    recognition=new SpeechRecognition();
    recognition.continuous=true;
    recognition.interimResults=true;
    recognition.maxAlternatives=1;
    recognition.lang=document.documentElement.lang==='es'?'es-US':'en-US';
    recognition.onstart=()=>{
      if(!wantsListening){recognition.stop();return}
      setListeningUI(true);
      message.textContent='Listening clearly…';
      if(!history.length)displayCurrent('Listening… start speaking when you’re ready.');
    };
    recognition.onresult=event=>{
      if(!wantsListening&&!isListening)return;
      let interim='';
      for(let index=event.resultIndex;index<event.results.length;index++){
        const transcript=event.results[index][0]?.transcript||'';
        if(event.results[index].isFinal){addCaption(transcript);pendingInterim=''}
        else interim+=transcript;
      }
      const cleanInterim=interim.replace(/\s+/g,' ').trim();
      if(cleanInterim){pendingInterim=cleanInterim;displayCurrent(cleanInterim)}
    };
    recognition.onerror=event=>{
      if(event.error==='no-speech'){message.textContent='Still listening — no speech detected yet.';return}
      commitPending();
      wantsListening=false;
      const denied=event.error==='not-allowed'||event.error==='service-not-allowed';
      message.textContent=denied?'Microphone permission was not granted.':'Live captions could not continue. Try again.';
      setListeningUI(false);
    };
    recognition.onend=()=>{
      recognition=null;
      if(wantsListening){restartTimer=setTimeout(startRecognition,220);return}
      if(isListening){commitPending();setListeningUI(false)}
    };
    try{recognition.start()}catch{
      wantsListening=false;
      message.textContent='Live captions could not start. Try again.';
      setListeningUI(false);
    }
  };
  const start=()=>{
    if(!SpeechRecognition)return;
    wantsListening=true;
    setListeningUI(true);
    pendingInterim='';
    displayCurrent('Starting microphone…');
    message.textContent='Starting live captions…';
    startRecognition();
  };
  const pause=()=>{
    wantsListening=false;
    clearTimeout(restartTimer);
    commitPending();
    try{recognition?.stop()}catch{}
    setListeningUI(false);
    message.textContent=history.length?'Paused — scroll to review the caption history.':'Captions are paused.';
  };

  if(!SpeechRecognition){
    toggle.disabled=true;
    message.textContent='Live captions are not supported in this browser.';
    displayCurrent('This browser does not provide speech recognition.');
  }else toggle.addEventListener('click',()=>wantsListening||isListening?pause():start());

  historyEl.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});
  const captionResizeObserver=new ResizeObserver(fitCurrentText);
  captionResizeObserver.observe(m.querySelector('.livecaption-current'));
  m.querySelector('.livecaption-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.livecaption-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.livecaption-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));
  renderHistory();
  setListeningUI(false);
  m._boardGetState=()=>({title:tileTitle.get(),history:[...history]});
  m._boardSetState=state=>{
    tileTitle.set(state?.title);
    history=Array.isArray(state?.history)?state.history.map(value=>String(value||'').trim()).filter(Boolean).slice(-100):[];
    if(history.length)displayCurrent(history[history.length-1]);
    renderHistory();
    setListeningUI(false);
  };
  const prior=m._cleanup;
  m._cleanup=()=>{prior?.();wantsListening=false;clearTimeout(restartTimer);cancelAnimationFrame(currentFitFrame);captionResizeObserver.disconnect();try{recognition?.abort()}catch{}};
}

function setupVoiceMemo(m){
  const tileTitle=bindEditableModuleTitle(m,'.voicememo-title','Voice Memos');
  const recordButton=m.querySelector('.voicememo-record');
  const recordLabel=recordButton.querySelector('span');
  const timeEl=m.querySelector('.voicememo-time');
  const message=m.querySelector('.voicememo-message');
  const list=m.querySelector('.voicememo-list');
  const count=m.querySelector('.voicememo-count');
  let memos=[];
  let recorder=null;
  let stream=null;
  let chunks=[];
  let startedAt=0;
  let timerId=0;
  let disposed=false;

  const formatDuration=seconds=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
  const setRecordingUI=recording=>{
    m.classList.toggle('is-recording',recording);
    recordButton.setAttribute('aria-pressed',String(recording));
    recordLabel.textContent=recording?'Stop recording':'Record memo';
  };
  const stopTracks=()=>{stream?.getTracks().forEach(track=>track.stop());stream=null};
  const render=()=>{
    count.textContent=`${memos.length} / 5`;
    list.replaceChildren();
    if(!memos.length){
      const empty=document.createElement('p');
      empty.className='voicememo-empty';
      empty.textContent='Your recordings will appear here.';
      list.appendChild(empty);
      return;
    }
    memos.forEach((memo,index)=>{
      const row=document.createElement('article');
      row.className='voicememo-item';
      const meta=document.createElement('div');
      const title=document.createElement('input');
      const duration=document.createElement('small');
      title.type='text';
      title.className='voicememo-name';
      title.maxLength=40;
      title.value=String(memo.name||`Memo ${index+1}`).slice(0,40);
      title.setAttribute('aria-label',`Rename Memo ${index+1}`);
      title.addEventListener('input',()=>{memo.name=title.value.slice(0,40);notifyBoardChanged('voice-memo-rename')});
      title.addEventListener('blur',()=>{if(!title.value.trim()){memo.name=`Memo ${index+1}`;title.value=memo.name}});
      duration.textContent=formatDuration(memo.duration||0);
      meta.append(title,duration);
      const audio=document.createElement('audio');
      audio.controls=true;
      audio.preload='metadata';
      audio.src=memo.dataUrl;
      audio.setAttribute('controlsList','nodownload');
      audio.setAttribute('aria-label',`Play Memo ${index+1}`);
      audio.addEventListener('play',()=>list.querySelectorAll('audio').forEach(other=>{if(other!==audio)other.pause()}));
      const remove=document.createElement('button');
      remove.type='button';
      remove.className='voicememo-remove';
      remove.setAttribute('aria-label',`Delete Memo ${index+1}`);
      remove.textContent='×';
      remove.addEventListener('click',()=>{memos.splice(index,1);render();message.textContent='Memo deleted.';notifyBoardChanged('voice-memo-delete')});
      row.append(meta,audio,remove);
      list.appendChild(row);
    });
  };
  const finishRecording=()=>{
    clearInterval(timerId);
    timerId=0;
    if(recorder?.state==='recording')recorder.stop();
  };
  const beginRecording=async()=>{
    if(memos.length>=5){message.textContent='Delete a memo before recording another.';return}
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){message.textContent='Audio recording is not supported in this browser.';return}
    try{
      stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true}});
      const preferred=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(type=>MediaRecorder.isTypeSupported?.(type));
      recorder=new MediaRecorder(stream,preferred?{mimeType:preferred,audioBitsPerSecond:32000}:{audioBitsPerSecond:32000});
      chunks=[];
      startedAt=performance.now();
      recorder.ondataavailable=event=>{if(event.data?.size)chunks.push(event.data)};
      recorder.onerror=()=>{message.textContent='Recording stopped because of an audio error.';stopTracks();setRecordingUI(false)};
      recorder.onstop=()=>{
        const duration=Math.min(30,(performance.now()-startedAt)/1000);
        const blob=new Blob(chunks,{type:recorder?.mimeType||chunks[0]?.type||'audio/webm'});
        chunks=[];
        stopTracks();
        if(disposed)return;
        setRecordingUI(false);
        timeEl.textContent='0:00';
        if(!blob.size){message.textContent='No audio was captured.';return}
        const reader=new FileReader();
        reader.onload=()=>{
          memos.push({name:`Memo ${memos.length+1}`,dataUrl:String(reader.result||''),duration});
          render();
          message.textContent='Memo saved and ready to play.';
          notifyBoardChanged('voice-memo-add');
        };
        reader.onerror=()=>{message.textContent='The recording could not be prepared.'};
        reader.readAsDataURL(blob);
      };
      recorder.start(500);
      setRecordingUI(true);
      message.textContent='Recording… tap Stop when finished.';
      timerId=setInterval(()=>{
        const elapsed=Math.min(30,(performance.now()-startedAt)/1000);
        timeEl.textContent=formatDuration(elapsed);
        if(elapsed>=30)finishRecording();
      },200);
    }catch(error){
      stopTracks();
      setRecordingUI(false);
      message.textContent=error?.name==='NotAllowedError'?'Microphone permission was not granted.':'The microphone could not be started.';
    }
  };

  recordButton.addEventListener('click',()=>recorder?.state==='recording'?finishRecording():beginRecording());
  list.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});
  m.querySelector('.voicememo-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.voicememo-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.voicememo-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));
  render();
  m._boardGetState=()=>({title:tileTitle.get(),memos:memos.map(memo=>({...memo}))});
  m._boardSetState=state=>{tileTitle.set(state?.title);memos=Array.isArray(state?.memos)?state.memos.filter(memo=>typeof memo?.dataUrl==='string'&&memo.dataUrl.startsWith('data:audio/')).slice(0,5):[];render()};
  const prior=m._cleanup;
  m._cleanup=()=>{prior?.();disposed=true;clearInterval(timerId);try{if(recorder?.state==='recording')recorder.stop()}catch{}stopTracks()};
}

const PHOTOBOOTH_FILTERS={
  normal:'none',
  mono:'grayscale(1) contrast(1.12)',
  sepia:'sepia(.82) saturate(1.18) contrast(1.04)',
  pop:'saturate(1.75) contrast(1.18) brightness(1.04)',
  cool:'saturate(1.12) contrast(1.06) hue-rotate(176deg)',
  warm:'sepia(.24) saturate(1.32) contrast(1.05) brightness(1.04)'
};
let boardPhotoDropReady=false;

function setupBoardPhotoDrop(){
  if(boardPhotoDropReady)return;
  boardPhotoDropReady=true;
  const hasPhoto=event=>Array.from(event.dataTransfer?.types||[]).includes('application/x-teachertiles-photo');
  workspace.addEventListener('dragover',event=>{
    if(!hasPhoto(event))return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect='copy';
  });
  workspace.addEventListener('drop',event=>{
    if(!hasPhoto(event))return;
    event.preventDefault();
    event.stopPropagation();
    const src=event.dataTransfer?.getData('application/x-teachertiles-photo')||'';
    if(!src.startsWith('data:image/'))return;
    const point=screenToBoard(event.clientX,event.clientY);
    const imageTile=createModule('image',point.x,point.y);
    imageTile?._setImageUrl?.(src);
    notifyBoardChanged('photobooth-drop');
  });
}

const activeCameraStreams=new Map();

function releaseCameraStream(stream){
  if(!stream)return;
  stream.getTracks().forEach(track=>track.stop());
  activeCameraStreams.delete(stream);
}

function releaseAllCameraStreams(){
  for(const stream of [...activeCameraStreams.keys()])releaseCameraStream(stream);
}

function deactivateOtherCameraTiles(owner){
  document.querySelectorAll('.photobooth-module,.mirror-module').forEach(tile=>{
    if(tile!==owner)tile._deactivate?.();
  });
  for(const [stream,streamOwner] of [...activeCameraStreams]){
    if(streamOwner!==owner)releaseCameraStream(stream);
  }
}

window.addEventListener('pagehide',releaseAllCameraStreams);

async function requestFrontCamera(owner){
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('unsupported');
  deactivateOtherCameraTiles(owner);
  const stream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});
  activeCameraStreams.set(stream,owner);
  const track=stream.getVideoTracks()[0];
  track?.applyConstraints({width:{ideal:1280},height:{ideal:720},facingMode:{ideal:'user'}}).catch(()=>{});
  track?.addEventListener('ended',()=>activeCameraStreams.delete(stream),{once:true});
  return stream;
}

function cameraPreviewError(){
  const error=new Error('camera-preview');
  error.name='CameraPreviewError';
  return error;
}

function cameraAbortError(){
  try{return new DOMException('Camera startup was cancelled.','AbortError')}
  catch{const error=new Error('Camera startup was cancelled.');error.name='AbortError';return error}
}

async function attachCameraPreview(video,stream,signal){
  video.pause();
  video.srcObject=null;
  video.autoplay=true;
  video.muted=true;
  video.playsInline=true;
  video.setAttribute('autoplay','');
  video.setAttribute('muted','');
  video.setAttribute('playsinline','');
  video.srcObject=stream;

  const track=stream.getVideoTracks()[0];
  if(!track||track.readyState!=='live')throw cameraPreviewError();

  const frameReady=new Promise((resolve,reject)=>{
    let settled=false;
    let frameCallback=null;
    const timeout=window.setTimeout(()=>finish(reject,cameraPreviewError()),8000);
    const events=['loadeddata','canplay','playing','resize'];
    const finish=(callback,value)=>{
      if(settled)return;
      settled=true;
      window.clearTimeout(timeout);
      events.forEach(name=>video.removeEventListener(name,onReady));
      track.removeEventListener('ended',onEnded);
      signal?.removeEventListener('abort',onAbort);
      if(frameCallback!==null&&typeof video.cancelVideoFrameCallback==='function')video.cancelVideoFrameCallback(frameCallback);
      callback(value);
    };
    const onFrame=()=>{frameCallback=null;finish(resolve)};
    const onReady=()=>{
      if(video.readyState<2||video.videoWidth<1||video.videoHeight<1)return;
      if(typeof video.requestVideoFrameCallback==='function'){
        if(frameCallback===null)frameCallback=video.requestVideoFrameCallback(onFrame);
      }else finish(resolve);
    };
    const onEnded=()=>finish(reject,cameraPreviewError());
    const onAbort=()=>finish(reject,cameraAbortError());
    events.forEach(name=>video.addEventListener(name,onReady));
    track.addEventListener('ended',onEnded,{once:true});
    signal?.addEventListener('abort',onAbort,{once:true});
    if(signal?.aborted){onAbort();return}
    onReady();
  });

  let playback;
  try{playback=video.play()}
  catch{throw cameraPreviewError()}
  try{await Promise.all([Promise.resolve(playback),frameReady])}
  catch(error){
    if(error?.name==='AbortError')throw error;
    throw cameraPreviewError();
  }
}

function cameraStartMessage(error){
  if(error?.name==='NotAllowedError'||error?.name==='SecurityError')return'Camera permission was not granted. Allow camera access, then try again.';
  if(error?.name==='NotFoundError'||error?.name==='DevicesNotFoundError')return'No camera was found on this device.';
  if(error?.name==='NotReadableError'||error?.name==='TrackStartError')return'The browser found your camera but could not open it. Reload this page to release a stuck camera session, then try again.';
  if(error?.name==='OverconstrainedError'||error?.name==='ConstraintNotSatisfiedError')return'This camera could not use the requested video settings. Reload the page, then try again.';
  if(error?.name==='CameraPreviewError')return'Chrome opened the camera, but no video reached this tile. Reload this tab and try again.';
  if(error?.name==='AbortError')return'The camera stopped while starting. Wait a moment, then try again.';
  if(error?.message==='unsupported')return'Camera access is not supported in this browser.';
  return'The camera could not be started. Reload this page, then try again.';
}

function setupPhotobooth(m){
  setupBoardPhotoDrop();
  const tileTitle=bindEditableModuleTitle(m,'.photobooth-title','Photobooth');
  const video=m.querySelector('.photobooth-video');
  const toggle=m.querySelector('.photobooth-camera-toggle');
  const shutter=m.querySelector('.photobooth-shutter');
  const state=m.querySelector('.photobooth-camera-state b');
  const message=m.querySelector('.photobooth-message');
  const list=m.querySelector('.photobooth-photo-list');
  const count=m.querySelector('.photobooth-photo-count');
  const drawerToggle=m.querySelector('.photobooth-drawer-toggle');
  const placeholder=m.querySelector('.photobooth-placeholder');
  const flash=m.querySelector('.photobooth-flash');
  let stream=null;
  let filter='normal';
  let photos=[];
  let disposed=false;
  let cameraAttempt=0;
  let cameraAbort=null;

  const stopCamera=()=>{
    cameraAttempt++;
    cameraAbort?.abort();
    cameraAbort=null;
    releaseCameraStream(stream);
    stream=null;
    video.pause();
    video.srcObject=null;
    m.classList.remove('has-camera');
    toggle.textContent='Start camera';
    toggle.disabled=false;
    shutter.disabled=true;
    state.textContent='OFF';
  };
  const startCamera=async()=>{
    if(stream?.getVideoTracks().some(track=>track.readyState==='live')){stopCamera();message.textContent='Camera is off.';return}
    if(stream)stopCamera();
    const attempt=++cameraAttempt;
    const controller=new AbortController();
    cameraAbort=controller;
    toggle.disabled=true;
    message.textContent='Starting the camera…';
    let next=null;
    try{
      next=await requestFrontCamera(m);
      if(disposed||!m.isConnected||attempt!==cameraAttempt||controller.signal.aborted){releaseCameraStream(next);return}
      stream=next;
      await attachCameraPreview(video,stream,controller.signal);
      if(disposed||!m.isConnected||attempt!==cameraAttempt||controller.signal.aborted){releaseCameraStream(next);return}
      m.classList.add('has-camera');
      toggle.textContent='Stop camera';
      shutter.disabled=false;
      state.textContent='ON';
      message.textContent='Choose a filter, then take a photo.';
      stream.getVideoTracks().forEach(track=>track.addEventListener('ended',()=>{if(stream===next)stopCamera()},{once:true}));
    }catch(error){
      if(stream===next){releaseCameraStream(next);stream=null;video.pause();video.srcObject=null}
      if(attempt===cameraAttempt&&!disposed){
        m.classList.remove('has-camera');toggle.textContent='Start camera';shutter.disabled=true;state.textContent='OFF';message.textContent=cameraStartMessage(error);
      }
    }finally{if(attempt===cameraAttempt){cameraAbort=null;toggle.disabled=false}}
  };
  const setFilter=value=>{
    filter=PHOTOBOOTH_FILTERS[value]?value:'normal';
    m.dataset.photoFilter=filter;
    video.style.filter=PHOTOBOOTH_FILTERS[filter];
    m.querySelectorAll('[data-photo-filter-choice]').forEach(button=>button.classList.toggle('is-active',button.dataset.photoFilterChoice===filter));
  };
  const renderPhotos=()=>{
    count.textContent=String(photos.length);
    list.replaceChildren();
    if(!photos.length){
      const empty=document.createElement('p');
      empty.className='photobooth-photo-empty';
      empty.textContent='Your photos will appear here.';
      list.appendChild(empty);
      return;
    }
    photos.forEach((photo,index)=>{
      const card=document.createElement('div');
      card.className='photobooth-photo-card';
      card.draggable=true;
      card.tabIndex=0;
      card.setAttribute('role','img');
      card.setAttribute('aria-label',`Photo ${index+1}. Drag onto the board.`);
      const img=document.createElement('img');
      img.src=photo;
      img.alt='';
      img.draggable=false;
      const actions=document.createElement('div');
      actions.className='photobooth-photo-actions';
      const download=document.createElement('button');
      download.type='button';download.className='photobooth-photo-download';download.textContent='↓';download.title='Download photo';download.setAttribute('aria-label',`Download photo ${index+1}`);
      download.addEventListener('pointerdown',event=>event.stopPropagation());
      download.addEventListener('click',event=>{
        event.stopPropagation();
        const link=document.createElement('a');
        link.href=photo;link.download=`teachertiles-photo-${index+1}.jpg`;link.click();
      });
      const remove=document.createElement('button');
      remove.type='button';remove.className='photobooth-photo-delete';
      remove.textContent='×';
      remove.setAttribute('aria-label',`Delete photo ${index+1}`);
      remove.addEventListener('pointerdown',event=>event.stopPropagation());
      remove.addEventListener('click',event=>{event.stopPropagation();photos.splice(index,1);renderPhotos();notifyBoardChanged('photobooth-delete')});
      actions.append(download,remove);
      card.addEventListener('dragstart',event=>{
        event.stopPropagation();
        event.dataTransfer?.setData('application/x-teachertiles-photo',photo);
        if(event.dataTransfer)event.dataTransfer.effectAllowed='copy';
        card.classList.add('is-dragging');
      });
      card.addEventListener('dragend',()=>card.classList.remove('is-dragging'));
      card.append(img,actions);
      list.appendChild(card);
    });
  };
  const takePhoto=()=>{
    if(!stream||!video.videoWidth||photos.length>=8){message.textContent=photos.length>=8?'The drawer holds up to 8 photos. Delete one to take another.':'The camera is still getting ready.';return}
    const sourceW=video.videoWidth,sourceH=video.videoHeight;
    const scale=Math.min(1,960/Math.max(sourceW,sourceH));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(sourceW*scale));
    canvas.height=Math.max(1,Math.round(sourceH*scale));
    const ctx=canvas.getContext('2d');
    ctx.save();
    ctx.filter=PHOTOBOOTH_FILTERS[filter];
    ctx.translate(canvas.width,0);
    ctx.scale(-1,1);
    ctx.drawImage(video,0,0,canvas.width,canvas.height);
    ctx.restore();
    photos.unshift(canvas.toDataURL('image/jpeg',.8));
    renderPhotos();
    m.classList.add('is-drawer-open');
    drawerToggle.setAttribute('aria-expanded','true');
    flash.classList.remove('is-flashing');void flash.offsetWidth;flash.classList.add('is-flashing');
    message.textContent='Photo saved. Drag it from the drawer onto the board.';
    notifyBoardChanged('photobooth-photo');
  };

  toggle.addEventListener('click',startCamera);
  placeholder?.addEventListener('click',startCamera);
  shutter.addEventListener('click',takePhoto);
  drawerToggle.addEventListener('click',()=>{const open=m.classList.toggle('is-drawer-open');drawerToggle.setAttribute('aria-expanded',String(open))});
  m.querySelectorAll('[data-photo-filter-choice]').forEach(button=>button.addEventListener('click',()=>setFilter(button.dataset.photoFilterChoice)));
  list.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});
  m.querySelector('.photobooth-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.photobooth-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.photobooth-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));
  setFilter(filter);renderPhotos();
  m._boardGetState=()=>({title:tileTitle.get(),filter,photos:[...photos]});
  m._boardSetState=saved=>{tileTitle.set(saved?.title);photos=Array.isArray(saved?.photos)?saved.photos.filter(src=>typeof src==='string'&&src.startsWith('data:image/')).slice(0,8):[];setFilter(saved?.filter);renderPhotos()};
  m._deactivate=stopCamera;
  const prior=m._cleanup;
  m._cleanup=()=>{disposed=true;stopCamera();prior?.()};
}

function setupMirror(m){
  const tileTitle=bindEditableModuleTitle(m,'.mirror-title','Mirror');
  const video=m.querySelector('.mirror-video');
  const toggle=m.querySelector('.mirror-toggle');
  const placeholder=m.querySelector('.mirror-placeholder');
  const state=m.querySelector('.mirror-camera-state b');
  const message=m.querySelector('.mirror-message');
  let stream=null;
  let disposed=false;
  let cameraAttempt=0;
  let cameraAbort=null;
  const stop=()=>{
    cameraAttempt++;cameraAbort?.abort();cameraAbort=null;releaseCameraStream(stream);stream=null;video.pause();video.srcObject=null;
    m.classList.remove('has-camera');toggle.textContent='Start mirror';toggle.disabled=false;state.textContent='OFF';message.textContent='Camera is off.';
  };
  const start=async()=>{
    if(stream?.getVideoTracks().some(track=>track.readyState==='live')){stop();return}
    if(stream)stop();
    const attempt=++cameraAttempt;
    const controller=new AbortController();
    cameraAbort=controller;
    toggle.disabled=true;message.textContent='Starting your mirror…';
    let next=null;
    try{
      next=await requestFrontCamera(m);
      if(disposed||!m.isConnected||attempt!==cameraAttempt||controller.signal.aborted){releaseCameraStream(next);return}
      stream=next;await attachCameraPreview(video,stream,controller.signal);
      if(disposed||!m.isConnected||attempt!==cameraAttempt||controller.signal.aborted){releaseCameraStream(next);return}
      m.classList.add('has-camera');toggle.textContent='Stop mirror';state.textContent='ON';message.textContent='Mirror is on. Video stays on this device.';
      stream.getVideoTracks().forEach(track=>track.addEventListener('ended',()=>{if(stream===next)stop()},{once:true}));
    }catch(error){
      if(stream===next){releaseCameraStream(next);stream=null;video.pause();video.srcObject=null}
      if(attempt===cameraAttempt&&!disposed){m.classList.remove('has-camera');toggle.textContent='Start mirror';state.textContent='OFF';message.textContent=cameraStartMessage(error)}
    }
    finally{if(attempt===cameraAttempt){cameraAbort=null;toggle.disabled=false}}
  };
  toggle.addEventListener('click',start);
  placeholder?.addEventListener('click',start);
  m.querySelector('.mirror-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.mirror-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.mirror-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));
  m._boardGetState=()=>({title:tileTitle.get()});
  m._boardSetState=saved=>tileTitle.set(saved?.title);
  m._deactivate=stop;
  const prior=m._cleanup;
  m._cleanup=()=>{disposed=true;stop();prior?.()};
}

const WEATHER_CODES={
  0:['Clear sky','☀'],1:['Mostly clear','🌤'],2:['Partly cloudy','⛅'],3:['Overcast','☁'],
  45:['Fog','≋'],48:['Icy fog','≋'],51:['Light drizzle','🌦'],53:['Drizzle','🌦'],55:['Heavy drizzle','🌧'],
  56:['Freezing drizzle','🌧'],57:['Freezing drizzle','🌧'],61:['Light rain','🌦'],63:['Rain','🌧'],65:['Heavy rain','🌧'],
  66:['Freezing rain','🌧'],67:['Freezing rain','🌧'],71:['Light snow','🌨'],73:['Snow','🌨'],75:['Heavy snow','❄'],77:['Snow grains','❄'],
  80:['Rain showers','🌦'],81:['Rain showers','🌧'],82:['Heavy showers','🌧'],85:['Snow showers','🌨'],86:['Heavy snow showers','❄'],
  95:['Thunderstorm','⛈'],96:['Thunderstorm with hail','⛈'],99:['Thunderstorm with hail','⛈']
};
let localCoordinatesPromise=null;

function weatherCodeInfo(code){return WEATHER_CODES[Number(code)]||['Current conditions','○']}
function airQualityInfo(value){
  const aqi=Math.round(Number(value));
  if(!Number.isFinite(aqi))return{label:'Unavailable',className:'unknown',value:null};
  if(aqi<=50)return{label:'Good',className:'good',value:aqi};
  if(aqi<=100)return{label:'Moderate',className:'moderate',value:aqi};
  if(aqi<=150)return{label:'Sensitive groups',className:'sensitive',value:aqi};
  if(aqi<=200)return{label:'Unhealthy',className:'unhealthy',value:aqi};
  if(aqi<=300)return{label:'Very unhealthy',className:'very-unhealthy',value:aqi};
  return{label:'Hazardous',className:'hazardous',value:aqi};
}
function weatherDayLabel(value,index){
  if(index===0)return'Today';
  const date=new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime())?'Day':date.toLocaleDateString(undefined,{weekday:'short',timeZone:'UTC'});
}
function weatherClockLabel(value){
  const match=String(value||'').match(/T(\d{2}):(\d{2})/);
  if(!match)return'—';
  const hour=Number(match[1]);
  return`${hour%12||12}:${match[2]} ${hour>=12?'PM':'AM'}`;
}
function displayTemperature(celsius,unit){
  const value=unit==='f'?Number(celsius)*9/5+32:Number(celsius);
  return Number.isFinite(value)?`${Math.round(value)}°${unit.toUpperCase()}`:'—';
}
function requestLocalCoordinates(){
  if(localCoordinatesPromise)return localCoordinatesPromise;
  localCoordinatesPromise=new Promise((resolve,reject)=>{
    if(!navigator.geolocation){reject(new Error('unsupported'));return}
    navigator.geolocation.getCurrentPosition(
      position=>resolve({lat:position.coords.latitude,lon:position.coords.longitude}),
      error=>reject(error),
      {enableHighAccuracy:false,timeout:12000,maximumAge:10*60*1000}
    );
  }).catch(error=>{localCoordinatesPromise=null;throw error});
  return localCoordinatesPromise;
}
async function geocodeWeatherPlace(query,signal){
  const response=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`,{signal});
  if(!response.ok)throw new Error('geocoding');
  const result=(await response.json())?.results?.[0];
  if(!result)throw new Error('not-found');
  return{name:[result.name,result.admin1||result.country].filter(Boolean).join(', '),lat:Number(result.latitude),lon:Number(result.longitude),isLocal:false};
}
async function fetchCurrentConditions(location,signal,{extended=true}={}){
  const weatherQuery={
    latitude:String(location.lat),longitude:String(location.lon),
    current:'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,precipitation,is_day',
    timezone:'auto'
  };
  if(extended){
    weatherQuery.daily='weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,uv_index_max,sunrise,sunset';
    weatherQuery.forecast_days='7';
  }
  const params=new URLSearchParams(weatherQuery);
  const airParams=new URLSearchParams({
    latitude:String(location.lat),longitude:String(location.lon),
    current:'us_aqi,pm2_5',timezone:'auto'
  });
  const [response,airResult]=await Promise.all([
    fetch(`https://api.open-meteo.com/v1/forecast?${params}`,{signal}),
    extended?fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${airParams}`,{signal}).then(async airResponse=>airResponse.ok?airResponse.json():null).catch(error=>{if(error?.name==='AbortError')throw error;return null}):Promise.resolve(null)
  ]);
  if(!response.ok)throw new Error('forecast');
  const data=await response.json();
  if(!data?.current)throw new Error('forecast');
  const daily=data.daily||{};
  const days=Array.isArray(daily.time)?daily.time.slice(0,7).map((date,index)=>({
    date,
    label:weatherDayLabel(date,index),
    code:Number(daily.weather_code?.[index]),
    highC:Number(daily.temperature_2m_max?.[index]),
    lowC:Number(daily.temperature_2m_min?.[index]),
    precipitationProbability:Number(daily.precipitation_probability_max?.[index]),
    precipitation:Number(daily.precipitation_sum?.[index]),
    wind:Number(daily.wind_speed_10m_max?.[index]),
    uv:Number(daily.uv_index_max?.[index]),
    sunrise:daily.sunrise?.[index]||'',
    sunset:daily.sunset?.[index]||''
  })):[];
  return{
    tempC:Number(data.current.temperature_2m),
    apparentC:Number(data.current.apparent_temperature),
    humidity:Number(data.current.relative_humidity_2m),
    wind:Number(data.current.wind_speed_10m),
    code:Number(data.current.weather_code),
    precipitation:Number(data.current.precipitation),
    isDay:Boolean(data.current.is_day),
    time:data.current.time||'',
    forecast:days,
    air:{aqi:Number(airResult?.current?.us_aqi),pm25:Number(airResult?.current?.pm2_5)}
  };
}
function makeWeatherLocation(raw={}){
  return{
    id:String(raw.id||`weather-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`),
    name:String(raw.name||'My location').slice(0,80),
    lat:Number(raw.lat),lon:Number(raw.lon),isLocal:Boolean(raw.isLocal),
    loading:false,error:'',current:null
  };
}

function setupWeather(m){
  const tileTitle=bindEditableModuleTitle(m,'.weather-title','Weather');
  const segments=m.querySelector('.weather-segments');
  const form=m.querySelector('.weather-place-form');
  const input=m.querySelector('.weather-place-input');
  const useLocation=m.querySelector('.weather-use-location');
  const message=m.querySelector('.weather-message');
  const controller=new AbortController();
  let unit='f';
  let locations=[];
  let restored=false;
  let disposed=false;
  let autoFitComplete=Boolean(m._isBoardRestore);

  const fitNewWeatherTile=()=>{
    if(autoFitComplete||disposed)return;
    requestAnimationFrame(()=>{
      if(autoFitComplete||disposed||!locations.some(location=>location.current))return;
      const cards=[...segments.querySelectorAll('.weather-card')];
      if(!cards.length)return;
      const fullCardHeight=Math.max(...cards.map(card=>card.scrollHeight));
      const fixedHeight=Math.max(0,m.offsetHeight-segments.clientHeight);
      const neededHeight=Math.ceil(fixedHeight+fullCardHeight+4);
      if(neededHeight>m.offsetHeight){
        m.style.height=`${Math.min(neededHeight,BOARD_HEIGHT-m.offsetTop)}px`;
        notifyBoardChanged('weather-auto-fit');
      }
      autoFitComplete=true;
    });
  };

  const setMessage=value=>message.textContent=value;
  const render=()=>{
    segments.replaceChildren();
    segments.dataset.count=String(locations.length);
    for(const location of locations){
      const card=document.createElement('article');
      card.className='weather-card';
      if(location.loading)card.classList.add('is-loading');
      const head=document.createElement('header');
      const icon=document.createElement('span');
      const place=document.createElement('strong');
      place.textContent=location.name;
      const info=weatherCodeInfo(location.current?.code);
      icon.textContent=location.loading?'…':location.error?'!':info[1];
      head.append(icon,place);
      if(locations.length>1||!location.isLocal){
        const remove=document.createElement('button');
        remove.type='button';remove.textContent='×';remove.setAttribute('aria-label',`Remove ${location.name}`);
        remove.addEventListener('click',()=>{locations=locations.filter(item=>item!==location);render();notifyBoardChanged('weather-remove')});
        head.appendChild(remove);
      }
      const temp=document.createElement('div');
      temp.className='weather-card-temperature';
      temp.textContent=location.loading?'—':displayTemperature(location.current?.tempC,unit);
      const condition=document.createElement('p');
      condition.textContent=location.loading?'Loading current conditions…':location.error||info[0];
      const metrics=document.createElement('div');
      metrics.className='weather-card-metrics';
      if(location.current){
        const today=location.current.forecast?.[0]||{};
        const aqi=airQualityInfo(location.current.air?.aqi);
        const addMetric=(label,text,className='')=>{
          const item=document.createElement('span');
          if(className)item.className=className;
          const key=document.createElement('b');key.textContent=label;
          const val=document.createElement('em');val.textContent=text;
          item.append(key,val);metrics.appendChild(item);
          return item;
        };
        addMetric('Feels',displayTemperature(location.current.apparentC,unit));
        addMetric('Humidity',`${Math.round(location.current.humidity)}%`);
        addMetric('Precipitation',`${Math.round(today.precipitationProbability||0)}% · ${Number(today.precipitation||0).toFixed(1)} mm`);
        addMetric('Wind',`${Math.round(location.current.wind)} km/h`);
        addMetric('UV',Number.isFinite(today.uv)?today.uv.toFixed(1):'—');
        const airItem=addMetric('Air quality',aqi.value===null?'Unavailable':`${aqi.label} · AQI ${aqi.value}`,`weather-aqi weather-aqi--${aqi.className}`);
        if(Number.isFinite(location.current.air?.pm25))airItem.title=`PM2.5: ${location.current.air.pm25.toFixed(1)} µg/m³`;
        addMetric('Sunrise',weatherClockLabel(today.sunrise));
        addMetric('Sunset',weatherClockLabel(today.sunset));
      }
      const weekly=document.createElement('div');
      weekly.className='weather-weekly';
      for(const [index,day] of (location.current?.forecast||[]).entries()){
        const forecast=document.createElement('article');
        forecast.className='weather-forecast-day';
        const dayName=document.createElement('strong');dayName.textContent=day.label||weatherDayLabel(day.date,index);
        const dayIcon=document.createElement('span');dayIcon.textContent=weatherCodeInfo(day.code)[1];dayIcon.setAttribute('aria-label',weatherCodeInfo(day.code)[0]);
        const high=document.createElement('b');high.textContent=displayTemperature(day.highC,unit).replace(/[FC]$/,'');
        const low=document.createElement('small');low.textContent=displayTemperature(day.lowC,unit).replace(/[FC]$/,'');
        const rain=document.createElement('em');rain.textContent=`${Math.round(day.precipitationProbability||0)}%`;
        rain.title=`${Number(day.precipitation||0).toFixed(1)} mm precipitation`;
        forecast.append(dayName,dayIcon,high,low,rain);
        weekly.appendChild(forecast);
      }
      card.append(head,temp,condition,metrics,weekly);
      segments.appendChild(card);
    }
    if(!locations.length){
      const empty=document.createElement('div');empty.className='weather-empty';empty.textContent='Add a place or use your location.';segments.appendChild(empty);
    }
    m.querySelectorAll('[data-weather-unit]').forEach(button=>button.classList.toggle('is-active',button.dataset.weatherUnit===unit));
    fitNewWeatherTile();
  };
  const refresh=async location=>{
    if(!Number.isFinite(location.lat)||!Number.isFinite(location.lon))return;
    location.loading=true;location.error='';render();
    try{location.current=await fetchCurrentConditions(location,controller.signal);setMessage(`Updated ${location.name}.`)}
    catch(error){if(error?.name==='AbortError')return;location.error='Weather is unavailable right now.';setMessage('Current weather could not be loaded.')}
    finally{location.loading=false;if(!disposed)render()}
  };
  const loadLocal=async({replace=true}={})=>{
    useLocation.disabled=true;setMessage('Finding your local weather…');
    let location=locations.find(item=>item.isLocal);
    if(!location){location=makeWeatherLocation({name:'My location',isLocal:true});if(replace)locations.unshift(location);else locations.push(location)}
    location.loading=true;location.error='';render();
    try{
      const coords=await requestLocalCoordinates();
      location.lat=coords.lat;location.lon=coords.lon;location.loading=false;
      await refresh(location);
      notifyBoardChanged('weather-local');
    }catch(error){
      location.loading=false;location.error=error?.code===1?'Location permission is needed.':'Your location could not be found.';
      render();setMessage('Use the city box if you prefer not to share location.');
    }finally{useLocation.disabled=false}
  };
  const addPlace=async query=>{
    if(locations.length>=4){setMessage('This tile can compare up to 4 places.');return}
    setMessage('Finding that place…');
    try{
      const result=await geocodeWeatherPlace(query,controller.signal);
      if(locations.some(item=>Math.abs(item.lat-result.lat)<.001&&Math.abs(item.lon-result.lon)<.001)){setMessage('That place is already on this tile.');return}
      const location=makeWeatherLocation(result);locations.push(location);input.value='';render();await refresh(location);notifyBoardChanged('weather-place');
    }catch(error){if(error?.name!=='AbortError')setMessage(error?.message==='not-found'?'No matching place was found.':'That place could not be loaded.')}
  };

  form.addEventListener('submit',event=>{event.preventDefault();const query=input.value.trim();if(query)addPlace(query)});
  useLocation.addEventListener('click',()=>loadLocal());
  m.querySelectorAll('[data-weather-unit]').forEach(button=>button.addEventListener('click',()=>{unit=button.dataset.weatherUnit;render();notifyBoardChanged('weather-unit')}));
  segments.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});
  m.querySelector('.weather-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.weather-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.weather-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));
  render();
  m._boardGetState=()=>({title:tileTitle.get(),unit,locations:locations.map(location=>location.isLocal?{name:location.name,isLocal:true}:{name:location.name,lat:location.lat,lon:location.lon,isLocal:false})});
  m._boardSetState=saved=>{
    restored=true;tileTitle.set(saved?.title);unit=saved?.unit==='c'?'c':'f';
    const savedLocations=Array.isArray(saved?.locations)?saved.locations.slice(0,4):[];
    locations=savedLocations.map(makeWeatherLocation);render();
    locations.forEach(location=>location.isLocal?loadLocal():refresh(location));
    if(!locations.length)loadLocal();
  };
  queueMicrotask(()=>{if(!restored)loadLocal()});
  const prior=m._cleanup;
  m._cleanup=()=>{prior?.();disposed=true;controller.abort()};
}

const WEATHER_WHEEL_ITEMS=[
  {name:'Sunny',icon:'☀️',color:'#ffd66b'},
  {name:'Partly cloudy',icon:'🌤️',color:'#bcdff4'},
  {name:'Cloudy',icon:'☁️',color:'#b8c3d1'},
  {name:'Rainy',icon:'🌧️',color:'#77b6df'},
  {name:'Stormy',icon:'⛈️',color:'#8b82b8'},
  {name:'Snowy',icon:'🌨️',color:'#d8edf7'},
  {name:'Windy',icon:'💨',color:'#9bd8d0'},
  {name:'Foggy',icon:'🌫️',color:'#c8ced3'}
];
const SEASON_WHEEL_ITEMS=[
  {name:'Spring',icon:'🌷',color:'#a9dfa9'},
  {name:'Summer',icon:'☀️',color:'#ffd66b'},
  {name:'Fall',icon:'🍂',color:'#e9a064'},
  {name:'Winter',icon:'❄️',color:'#a9d8ee'}
];

function setupChoiceWheel(m,{items}){
  const face=m.querySelector('.choicewheel-face');
  const options=m.querySelector('.choicewheel-options');
  const pointer=m.querySelector('.choicewheel-pointer');
  const selectionDisplay=m.querySelector('.choicewheel-selection-display');
  const selectionIcon=m.querySelector('.choicewheel-selection-icon');
  const selectionName=m.querySelector('.choicewheel-selection-name');
  const hint=m.querySelector('.choicewheel-hint');
  const sector=360/items.length;
  let selected=0;
  let resizeFrame=0;

  const syncWheelSize=()=>{
    resizeFrame=0;
    const style=getComputedStyle(m);
    const number=value=>Number.parseFloat(value)||0;
    const width=m.clientWidth-number(style.paddingLeft)-number(style.paddingRight);
    const reservedHeight=selectionDisplay.offsetHeight+hint.offsetHeight+(number(style.rowGap)||number(style.gap)||5)*2;
    const height=m.clientHeight-number(style.paddingTop)-number(style.paddingBottom)-reservedHeight;
    const size=Math.max(160,Math.min(560,width,height));
    m.style.setProperty('--choicewheel-size',`${Math.floor(size)}px`);
  };
  const scheduleWheelSize=()=>{
    if(resizeFrame)return;
    resizeFrame=requestAnimationFrame(syncWheelSize);
  };
  const wheelResizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(scheduleWheelSize):null;
  wheelResizeObserver?.observe(m);
  queueMicrotask(scheduleWheelSize);

  m.style.setProperty('--choicewheel-count',String(items.length));
  m.style.setProperty('--choicewheel-offset',`${-sector/2}deg`);
  m.style.setProperty('--choicewheel-colors',items.map((item,index)=>`${item.color} ${index*sector}deg ${(index+1)*sector}deg`).join(','));

  const renderSelection=(index,{angle=index*sector,notify=false}={})=>{
    selected=(Math.round(Number(index))%items.length+items.length)%items.length;
    pointer.style.setProperty('--pointer-angle',`${angle}deg`);
    pointer.setAttribute('aria-valuenow',String(selected));
    pointer.setAttribute('aria-valuetext',items[selected].name);
    options.querySelectorAll('.choicewheel-option').forEach((option,optionIndex)=>option.classList.toggle('is-active',optionIndex===selected));
    selectionIcon.textContent=items[selected].icon;
    selectionName.textContent=items[selected].name;
    if(notify)notifyBoardChanged(`${m.dataset.type}-selection`);
  };

  items.forEach((item,index)=>{
    const angle=index*sector*Math.PI/180;
    const button=document.createElement('button');
    button.type='button';
    button.className='choicewheel-option';
    button.style.left=`${50+Math.sin(angle)*35}%`;
    button.style.top=`${50-Math.cos(angle)*35}%`;
    button.style.setProperty('--choice-color',item.color);
    button.setAttribute('aria-label',`Point to ${item.name}`);
    const icon=document.createElement('span');icon.textContent=item.icon;icon.setAttribute('aria-hidden','true');
    const label=document.createElement('strong');label.textContent=item.name;
    button.append(icon,label);
    button.addEventListener('click',event=>{event.stopPropagation();renderSelection(index,{notify:true})});
    options.appendChild(button);
  });

  const indexFromPointer=event=>{
    const rect=face.getBoundingClientRect();
    const dx=event.clientX-(rect.left+rect.width/2);
    const dy=event.clientY-(rect.top+rect.height/2);
    const angle=(Math.atan2(dy,dx)*180/Math.PI+90+360)%360;
    return{angle,index:Math.round(angle/sector)%items.length};
  };
  face.addEventListener('pointerdown',event=>{
    if(event.button!==0||event.target.closest('.choicewheel-option'))return;
    event.preventDefault();event.stopPropagation();
    pointer.focus({preventScroll:true});
    const pointerId=event.pointerId;
    face.setPointerCapture?.(pointerId);
    m.classList.add('is-wheel-dragging');
    const move=moveEvent=>{
      if(moveEvent.pointerId!==pointerId)return;
      moveEvent.preventDefault();moveEvent.stopPropagation();
      const next=indexFromPointer(moveEvent);
      renderSelection(next.index,{angle:next.angle});
    };
    const end=endEvent=>{
      if(endEvent.pointerId!==pointerId)return;
      face.removeEventListener('pointermove',move);
      face.removeEventListener('pointerup',end);
      face.removeEventListener('pointercancel',end);
      m.classList.remove('is-wheel-dragging');
      renderSelection(selected,{notify:true});
    };
    move(event);
    face.addEventListener('pointermove',move);
    face.addEventListener('pointerup',end);
    face.addEventListener('pointercancel',end);
  });
  pointer.addEventListener('keydown',event=>{
    let next=null;
    if(event.key==='ArrowRight'||event.key==='ArrowDown')next=selected+1;
    if(event.key==='ArrowLeft'||event.key==='ArrowUp')next=selected-1;
    if(event.key==='Home')next=0;
    if(event.key==='End')next=items.length-1;
    if(next===null)return;
    event.preventDefault();event.stopPropagation();
    renderSelection(next,{notify:true});
  });
  m.querySelector('.choicewheel-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.choicewheel-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.choicewheel-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));
  renderSelection(0);
  const prior=m._cleanup;
  m._cleanup=()=>{wheelResizeObserver?.disconnect();if(resizeFrame)cancelAnimationFrame(resizeFrame);prior?.()};
  return{
    getState:()=>({selected}),
    setState(saved){selected=clamp(Math.round(Number(saved?.selected)||0),0,items.length-1);renderSelection(selected)}
  };
}

function setupWeatherWheel(m){
  const wheel=setupChoiceWheel(m,{items:WEATHER_WHEEL_ITEMS});
  m._boardGetState=()=>wheel.getState();
  m._boardSetState=saved=>wheel.setState(saved);
}

function setupSeasonWheel(m){
  const wheel=setupChoiceWheel(m,{items:SEASON_WHEEL_ITEMS});
  m._boardGetState=()=>wheel.getState();
  m._boardSetState=saved=>wheel.setState(saved);
}

function setupTemperature(m){
  const tileTitle=bindEditableModuleTitle(m,'.temperature-title','Temperature');
  const value=m.querySelector('.temperature-value');
  const verticalValue=m.querySelector('.temperature-vertical-value');
  const horizontalValue=m.querySelector('.temperature-horizontal-value');
  const condition=m.querySelector('.temperature-condition');
  const verticalCondition=m.querySelector('.temperature-vertical-condition');
  const horizontalCondition=m.querySelector('.temperature-horizontal-condition');
  const icon=m.querySelector('.temperature-weather-icon');
  const form=m.querySelector('.temperature-place-form');
  const input=m.querySelector('.temperature-place-input');
  const useLocation=m.querySelector('.temperature-use-location');
  const message=m.querySelector('.temperature-message');
  const controller=new AbortController();
  let unit='f';
  let mode='number';
  let location=null;
  let current=null;
  let restored=false;
  let disposed=false;

  const render=()=>{
    m.dataset.temperatureMode=mode;
    const text=displayTemperature(current?.tempC,unit);
    value.textContent=text;verticalValue.textContent=text;horizontalValue.textContent=text;
    const info=weatherCodeInfo(current?.code);
    icon.textContent=current?info[1]:'○';
    const conditionText=current?`${location?.name||'Outside'} · ${info[0]}`:'Finding local temperature…';
    condition.textContent=conditionText;
    verticalCondition.textContent=conditionText;
    horizontalCondition.textContent=conditionText;
    const level=Number.isFinite(current?.tempC)?clamp((current.tempC+20)/70*100,4,96):4;
    m.style.setProperty('--temperature-level',`${level}%`);
    m.querySelectorAll('[data-temperature-unit]').forEach(button=>button.classList.toggle('is-active',button.dataset.temperatureUnit===unit));
    m.querySelectorAll('[data-temperature-mode-choice]').forEach(button=>button.classList.toggle('is-active',button.dataset.temperatureModeChoice===mode));
  };
  const load=async next=>{
    location=makeWeatherLocation(next);current=null;render();message.textContent=`Loading temperature for ${location.name}…`;
    try{current=await fetchCurrentConditions(location,controller.signal,{extended:false});message.textContent=`Current outdoor temperature for ${location.name}.`;notifyBoardChanged('temperature-place')}
    catch(error){if(error?.name!=='AbortError')message.textContent='Current temperature could not be loaded.'}
    finally{if(!disposed)render()}
  };
  const loadLocal=async()=>{
    useLocation.disabled=true;message.textContent='Finding your local temperature…';
    try{const coords=await requestLocalCoordinates();await load({name:'My location',isLocal:true,...coords})}
    catch(error){message.textContent=error?.code===1?'Location permission was not granted. Search for a city instead.':'Your location could not be found.'}
    finally{useLocation.disabled=false}
  };
  form.addEventListener('submit',async event=>{
    event.preventDefault();const query=input.value.trim();if(!query)return;
    message.textContent='Finding that place…';
    try{const result=await geocodeWeatherPlace(query,controller.signal);input.value='';await load(result)}
    catch(error){if(error?.name!=='AbortError')message.textContent=error?.message==='not-found'?'No matching place was found.':'That place could not be loaded.'}
  });
  useLocation.addEventListener('click',loadLocal);
  m.querySelectorAll('[data-temperature-unit]').forEach(button=>button.addEventListener('click',()=>{unit=button.dataset.temperatureUnit;render();notifyBoardChanged('temperature-unit')}));
  m.querySelectorAll('[data-temperature-mode-choice]').forEach(button=>button.addEventListener('click',()=>{mode=['number','vertical','horizontal'].includes(button.dataset.temperatureModeChoice)?button.dataset.temperatureModeChoice:'number';render();notifyBoardChanged('temperature-mode')}));
  m.querySelector('.temperature-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.temperature-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.temperature-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));
  render();
  m._boardGetState=()=>({title:tileTitle.get(),unit,mode,location:location?.isLocal?{name:location.name,isLocal:true}:location?{name:location.name,lat:location.lat,lon:location.lon,isLocal:false}:null});
  m._boardSetState=saved=>{
    restored=true;tileTitle.set(saved?.title);unit=saved?.unit==='c'?'c':'f';mode=['number','vertical','horizontal'].includes(saved?.mode)?saved.mode:'number';render();
    if(saved?.location?.isLocal)loadLocal();else if(saved?.location&&Number.isFinite(Number(saved.location.lat))&&Number.isFinite(Number(saved.location.lon)))load(saved.location);else loadLocal();
  };
  queueMicrotask(()=>{if(!restored)loadLocal()});
  const prior=m._cleanup;
  m._cleanup=()=>{prior?.();disposed=true;controller.abort()};
}

const WORLD_MAP_REGIONS=[
  {id:'north-america',name:'North America',hemisphere:'Northern and Western Hemispheres',fact:'North America stretches from the Arctic to the tropics and includes 23 independent countries.'},
  {id:'south-america',name:'South America',hemisphere:'Mostly Southern and Western Hemispheres',fact:'South America is home to the Andes, the world’s longest continental mountain range.'},
  {id:'europe',name:'Europe',hemisphere:'Northern Hemisphere; Eastern and Western Hemispheres',fact:'Europe and Asia share one large landmass called Eurasia.'},
  {id:'africa',name:'Africa',hemisphere:'All four hemispheres',fact:'Both the Equator and Prime Meridian cross Africa, placing it in all four hemispheres.'},
  {id:'asia',name:'Asia',hemisphere:'Mostly Northern and Eastern Hemispheres',fact:'Asia is the largest continent by both land area and population.'},
  {id:'australia',name:'Australia',hemisphere:'Southern and Eastern Hemispheres',fact:'Australia is the smallest continent and is surrounded by the Indian and Pacific Oceans.'},
  {id:'antarctica',name:'Antarctica',hemisphere:'Southern Hemisphere',fact:'Antarctica surrounds the South Pole and is the coldest continent on Earth.'}
];

function setupWorldMap(m){
  const tileTitle=bindEditableModuleTitle(m,'.worldmap-title','Explore the World');
  const stage=m.querySelector('.worldmap-stage');
  const mapLayer=m.querySelector('.worldmap-map-layer');
  const countries=m.querySelector('.worldmap-countries');
  const legend=m.querySelector('.worldmap-legend');
  const kicker=m.querySelector('.worldmap-kicker');
  const name=m.querySelector('.worldmap-name');
  const hemisphere=m.querySelector('.worldmap-hemisphere');
  const fact=m.querySelector('.worldmap-fact');
  let selected='';
  let selectedCountry='';
  let zoom=1;
  let centerX=500;
  let centerY=260;
  let pendingCountry='';
  let suppressMapClickUntil=0;
  const controller=new AbortController();
  const continentViews={
    'north-america':{x:205,y:145,zoom:1.65},'south-america':{x:300,y:330,zoom:1.75},europe:{x:515,y:145,zoom:2.35},africa:{x:520,y:285,zoom:1.8},asia:{x:710,y:165,zoom:1.5},australia:{x:825,y:350,zoom:2.05},antarctica:{x:500,y:462,zoom:1.55}
  };
  const constrainCenter=()=>{
    const halfWidth=500/zoom;
    const halfHeight=260/zoom;
    centerX=clamp(centerX,halfWidth,1000-halfWidth);
    centerY=clamp(centerY,halfHeight,520-halfHeight);
  };
  const applyZoom=()=>{
    constrainCenter();
    mapLayer.setAttribute('transform',`translate(${500-centerX*zoom} ${260-centerY*zoom}) scale(${zoom})`);
  };
  const selectRegion=(id,{animate=true}={})=>{
    const region=WORLD_MAP_REGIONS.find(item=>item.id===id);
    if(!region)return;
    selected=region.id;
    selectedCountry='';
    countries.querySelectorAll('[data-country-id]').forEach(path=>path.classList.remove('is-selected'));
    legend.querySelectorAll('[data-map-legend]').forEach(button=>button.classList.toggle('is-active',button.dataset.mapLegend===selected));
    kicker.textContent='CONTINENT VIEW';
    name.textContent=region.name;
    hemisphere.textContent=region.hemisphere;
    fact.textContent=region.fact;
    const view=continentViews[id];
    if(view){centerX=view.x;centerY=view.y;zoom=view.zoom;applyZoom()}
    if(animate&&m.querySelector('.worldmap-info')?.animate)m.querySelector('.worldmap-info').animate([{opacity:.45,transform:'translateY(4px)'},{opacity:1,transform:'none'}],{duration:230,easing:'ease-out'});
    notifyBoardChanged('world-map-region');
  };
  const selectCountry=(id,countryName,{notify=true}={})=>{
    selectedCountry=String(id||'');
    selected='';
    legend.querySelectorAll('[data-map-legend]').forEach(button=>button.classList.remove('is-active'));
    countries.querySelectorAll('[data-country-id]').forEach(path=>path.classList.toggle('is-selected',path.dataset.countryId===selectedCountry));
    kicker.textContent='COUNTRY';
    name.textContent=countryName||'Country';
    hemisphere.textContent='Natural Earth country boundary';
    fact.textContent='Click another country to compare its location, or use a continent button for a closer regional view.';
    if(notify)notifyBoardChanged('world-map-country');
  };
  const project=point=>[(point[0]+180)/360*1000,(90-point[1])/180*480+20];
  const renderTopology=topology=>{
    const scale=topology.transform?.scale||[1,1];
    const translate=topology.transform?.translate||[0,0];
    const decoded=topology.arcs.map(arc=>{
      let x=0,y=0;
      return arc.map(delta=>{x+=delta[0];y+=delta[1];return[x*scale[0]+translate[0],y*scale[1]+translate[1]]});
    });
    const pointsForArc=reference=>{
      const points=decoded[reference<0?~reference:reference]||[];
      return reference<0?[...points].reverse():points;
    };
    const ringPoints=references=>references.flatMap((reference,index)=>{const points=pointsForArc(reference);return index?points.slice(1):points});
    const ringPath=references=>{
      const points=ringPoints(references);
      if(!points.length)return'';
      const projected=points.map(project);
      for(let index=1;index<projected.length;index++){
        while(projected[index][0]-projected[index-1][0]>500)projected[index][0]-=1000;
        while(projected[index-1][0]-projected[index][0]>500)projected[index][0]+=1000;
      }
      return[-1000,0,1000].map(offset=>projected.map((point,index)=>`${index?'L':'M'}${(point[0]+offset).toFixed(2)} ${point[1].toFixed(2)}`).join('')+'Z').join('');
    };
    const geometryPath=geometry=>{
      const polygons=geometry.type==='Polygon'?[geometry.arcs]:geometry.type==='MultiPolygon'?geometry.arcs:[];
      return polygons.map(polygon=>polygon.map(ringPath).join('')).join('');
    };
    const svgNs='http://www.w3.org/2000/svg';
    const fragment=document.createDocumentFragment();
    for(const geometry of topology.objects?.countries?.geometries||[]){
      const path=document.createElementNS(svgNs,'path');
      const countryName=geometry.properties?.name||'Country';
      path.setAttribute('d',geometryPath(geometry));
      path.dataset.countryId=String(geometry.id||countryName);
      path.dataset.countryName=countryName;
      path.setAttribute('tabindex','0');
      path.setAttribute('role','button');
      path.setAttribute('aria-label',countryName);
      path.addEventListener('click',()=>{if(performance.now()>=suppressMapClickUntil)selectCountry(path.dataset.countryId,countryName)});
      path.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectCountry(path.dataset.countryId,countryName)}});
      fragment.appendChild(path);
    }
    countries.replaceChildren(fragment);
    if(pendingCountry){
      const path=countries.querySelector(`[data-country-id="${CSS.escape(pendingCountry)}"]`);
      if(path)selectCountry(pendingCountry,path.dataset.countryName,{notify:false});
    }
  };
  WORLD_MAP_REGIONS.forEach(region=>{
    const button=document.createElement('button');
    button.type='button';
    button.dataset.mapLegend=region.id;
    button.textContent=region.name;
    button.addEventListener('click',()=>selectRegion(region.id));
    legend.appendChild(button);
  });
  m.querySelectorAll('[data-map-zoom]').forEach(button=>button.addEventListener('click',()=>{
    const action=button.dataset.mapZoom;
    if(action==='reset'){zoom=1;centerX=500;centerY=260;selected='';legend.querySelectorAll('[data-map-legend]').forEach(item=>item.classList.remove('is-active'))}
    else zoom=clamp(zoom+(action==='in' ? .2 : -.2),1,3.2);
    applyZoom();
    notifyBoardChanged('world-map-zoom');
  }));
  stage?.addEventListener('wheel',event=>{
    if(event.ctrlKey)return;
    event.preventDefault();
    event.stopPropagation();
    const rect=stage.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    const pointerX=clamp((event.clientX-rect.left)/rect.width*1000,0,1000);
    const pointerY=clamp((event.clientY-rect.top)/rect.height*520,0,520);
    const mapX=centerX+(pointerX-500)/zoom;
    const mapY=centerY+(pointerY-260)/zoom;
    const delta=event.deltaMode===1?event.deltaY*16:event.deltaMode===2?event.deltaY*rect.height:event.deltaY;
    const next=clamp(Math.round(zoom*Math.exp(-delta*.0017)*20)/20,1,3.2);
    if(Math.abs(next-zoom)<.001)return;
    centerX=clamp(mapX-(pointerX-500)/next,0,1000);
    centerY=clamp(mapY-(pointerY-260)/next,0,520);
    zoom=next;
    applyZoom();
    notifyBoardChanged('world-map-wheel-zoom');
  },{passive:false});
  stage?.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    event.stopPropagation();
    const rect=stage.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    const pointerId=event.pointerId;
    const startX=event.clientX;
    const startY=event.clientY;
    const startCenterX=centerX;
    const startCenterY=centerY;
    let moved=false;
    const move=moveEvent=>{
      if(moveEvent.pointerId!==pointerId)return;
      const dx=moveEvent.clientX-startX;
      const dy=moveEvent.clientY-startY;
      if(!moved&&Math.hypot(dx,dy)<4)return;
      if(!moved){
        moved=true;
        stage.setPointerCapture?.(pointerId);
      }
      moveEvent.preventDefault();
      moveEvent.stopPropagation();
      m.classList.add('is-map-panning');
      centerX=startCenterX-dx/rect.width*1000/zoom;
      centerY=startCenterY-dy/rect.height*520/zoom;
      applyZoom();
    };
    const end=endEvent=>{
      if(endEvent.pointerId!==pointerId)return;
      stage.removeEventListener('pointermove',move);
      stage.removeEventListener('pointerup',end);
      stage.removeEventListener('pointercancel',end);
      m.classList.remove('is-map-panning');
      if(moved){
        suppressMapClickUntil=performance.now()+250;
        notifyBoardChanged('world-map-pan');
      }
    };
    stage.addEventListener('pointermove',move);
    stage.addEventListener('pointerup',end);
    stage.addEventListener('pointercancel',end);
  });
  m.querySelector('.worldmap-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.worldmap-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.worldmap-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));
  applyZoom();
  name.textContent='Loading world map…';
  fetch('assets/world-countries-110m.json',{signal:controller.signal}).then(response=>{if(!response.ok)throw new Error('map-data');return response.json()}).then(topology=>{
    renderTopology(topology);
    if(!selected&&!pendingCountry){name.textContent='World Map';hemisphere.textContent='Real Natural Earth boundaries';fact.textContent='Click any country, or use a continent button to zoom and learn.'}
  }).catch(error=>{if(error?.name!=='AbortError'){name.textContent='Map unavailable';fact.textContent='The geographic boundary file could not be loaded.'}});
  m._boardGetState=()=>({title:tileTitle.get(),selected,selectedCountry,zoom,centerX,centerY});
  m._boardSetState=state=>{
    tileTitle.set(state?.title);
    zoom=clamp(Number(state?.zoom)||1,1,3.2);
    centerX=Number.isFinite(Number(state?.centerX))?Number(state.centerX):500;
    centerY=Number.isFinite(Number(state?.centerY))?Number(state.centerY):260;
    pendingCountry=String(state?.selectedCountry||'');
    applyZoom();
    if(state?.selected)selectRegion(state.selected,{animate:false});
  };
  const prior=m._cleanup;
  m._cleanup=()=>{prior?.();controller.abort()};
}

const COMPASS_PARTS={
  needle:{name:'Direction needle',copy:'The colored end points toward the selected heading. Rotate it to practice finding directions.'},
  cardinal:{name:'Cardinal directions',copy:'North, east, south, and west are the four main—or cardinal—directions.'},
  intercardinal:{name:'Intercardinal directions',copy:'Northeast, southeast, southwest, and northwest sit halfway between the cardinal directions.'},
  degrees:{name:'Degree ring',copy:'A full turn is 360°. North is 0°, east is 90°, south is 180°, and west is 270°.'}
};

function setupCompass(m){
  const tileTitle=bindEditableModuleTitle(m,'.compass-title','Compass Explorer');
  const svg=m.querySelector('.compass-face');
  const ticks=m.querySelector('.compass-ticks');
  const needle=m.querySelector('.compass-needle');
  const slider=m.querySelector('.compass-slider input');
  const output=m.querySelector('.compass-heading');
  const partName=m.querySelector('.compass-part-name');
  const partCopy=m.querySelector('.compass-part-copy');
  let heading=0;
  let part='needle';
  const svgNs='http://www.w3.org/2000/svg';
  for(let degree=0;degree<360;degree+=5){
    const line=document.createElementNS(svgNs,'line');
    const major=degree%45===0;
    line.setAttribute('x1','210');line.setAttribute('x2','210');line.setAttribute('y1',major?'32':'36');line.setAttribute('y2',major?'50':'44');line.setAttribute('transform',`rotate(${degree} 210 210)`);line.classList.toggle('is-major',major);ticks.appendChild(line);
  }
  const directionFor=value=>['North','Northeast','East','Southeast','South','Southwest','West','Northwest'][Math.round(value/45)%8];
  const setHeading=(value,{notify=true}={})=>{
    heading=(Math.round(Number(value))%360+360)%360;
    slider.value=String(heading);
    needle.style.transform=`rotate(${heading}deg)`;
    output.textContent=`${heading}° · ${directionFor(heading)}`;
    if(notify)notifyBoardChanged('compass-heading');
  };
  const setPart=(next,{notify=true}={})=>{
    part=COMPASS_PARTS[next]?next:'needle';
    m.dataset.compassPart=part;
    partName.textContent=COMPASS_PARTS[part].name;
    partCopy.textContent=COMPASS_PARTS[part].copy;
    m.querySelectorAll('[data-compass-part]').forEach(button=>button.classList.toggle('is-active',button.dataset.compassPart===part));
    if(notify)notifyBoardChanged('compass-part');
  };
  slider.addEventListener('input',()=>setHeading(slider.value));
  m.querySelectorAll('[data-compass-part]').forEach(button=>button.addEventListener('click',()=>setPart(button.dataset.compassPart)));
  svg.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    event.stopPropagation();
    const rect=svg.getBoundingClientRect();
    const x=(event.clientX-rect.left)*420/rect.width-210;
    const y=(event.clientY-rect.top)*420/rect.height-210;
    setHeading(Math.atan2(x,-y)*180/Math.PI);
  });
  m.querySelector('.compass-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.compass-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.compass-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));
  setHeading(0,{notify:false});setPart('needle',{notify:false});
  m._boardGetState=()=>({title:tileTitle.get(),heading,part});
  m._boardSetState=state=>{tileTitle.set(state?.title);setHeading(state?.heading||0,{notify:false});setPart(state?.part||'needle',{notify:false})};
}

const SHAPES_TILE_DATA=[
  {id:'circle',name:'Circle',path:'M44 100 A76 76 0 0 1 196 100 A76 76 0 0 1 44 100 Z',sides:'0',vertices:'0',family:'Curved shape',fact:'A circle is perfectly round. Every point on its edge is the same distance from its center.'},
  {id:'square',name:'Square',path:'M48 28 H192 V172 H48 Z',sides:'4',vertices:'4',family:'Quadrilateral',fact:'A square has four equal sides and four right angles. Opposite sides are parallel.'},
  {id:'star',name:'Star',path:'M120 14 L145 70 L206 75 L159 115 L176 177 L120 143 L64 177 L81 115 L34 75 L95 70 Z',sides:'10',vertices:'10',family:'Concave polygon',fact:'This five-point star has ten straight sides and ten vertices: five outer points and five inner corners.'},
  {id:'triangle',name:'Triangle',path:'M120 22 L218 174 H22 Z',sides:'3',vertices:'3',family:'Triangle',fact:'Every triangle has three straight sides, three vertices, and interior angles that add to 180°.'},
  {id:'oval',name:'Oval',path:'M20 100 A100 58 0 0 1 220 100 A100 58 0 0 1 20 100 Z',sides:'0',vertices:'0',family:'Curved shape',fact:'An oval is a closed curved shape that is longer in one direction. It has no straight sides or vertices.'},
  {id:'diamond',name:'Diamond',path:'M120 16 L222 100 L120 184 L18 100 Z',sides:'4',vertices:'4',family:'Rhombus',fact:'A diamond, or rhombus, has four equal sides. Its opposite sides are parallel and opposite angles are equal.'},
  {id:'hexagon',name:'Hexagon',path:'M72 18 H168 L216 100 L168 182 H72 L24 100 Z',sides:'6',vertices:'6',family:'Polygon',fact:'A hexagon has six straight sides and six vertices. A regular hexagon has six equal sides and angles.'},
  {id:'rectangle',name:'Rectangle',path:'M24 52 H216 V148 H24 Z',sides:'4',vertices:'4',family:'Quadrilateral',fact:'A rectangle has four right angles. Its opposite sides are equal in length and parallel.'},
  {id:'pentagon',name:'Pentagon',path:'M120 14 L210 80 L176 186 H64 L30 80 Z',sides:'5',vertices:'5',family:'Polygon',fact:'A pentagon has five straight sides and five vertices. A regular pentagon has five equal sides.'},
  {id:'octagon',name:'Octagon',path:'M70 14 H170 L226 70 V130 L170 186 H70 L14 130 V70 Z',sides:'8',vertices:'8',family:'Polygon',fact:'An octagon has eight straight sides and eight vertices. Stop signs are shaped like regular octagons.'}
];

function setupShapes(m){
  const picker=m.querySelector('.shapes-picker');
  const stage=m.querySelector('.shapes-stage');
  const path=m.querySelector('.shapes-path');
  const visual=m.querySelector('.shapes-visual');
  const title=m.querySelector('.shapes-title');
  const index=m.querySelector('.shapes-index');
  const name=m.querySelector('.shapes-name');
  const sides=m.querySelector('.shapes-sides');
  const vertices=m.querySelector('.shapes-vertices');
  const family=m.querySelector('.shapes-family');
  const fact=m.querySelector('.shapes-fact');
  const svgNs='http://www.w3.org/2000/svg';

  const setShape=(shapeId,{animate=true}={})=>{
    const shape=SHAPES_TILE_DATA.find(item=>item.id===shapeId)||SHAPES_TILE_DATA[0];
    m.dataset.shape=shape.id;
    path.setAttribute('d',shape.path);
    visual.setAttribute('aria-label',shape.name);
    title.textContent=shape.name;
    name.textContent=shape.name;
    index.textContent=`${SHAPES_TILE_DATA.indexOf(shape)+1} / ${SHAPES_TILE_DATA.length}`;
    sides.textContent=shape.sides;
    vertices.textContent=shape.vertices;
    family.textContent=shape.family;
    fact.textContent=shape.fact;
    picker.querySelectorAll('[data-shape-choice]').forEach(button=>{
      const active=button.dataset.shapeChoice===shape.id;
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    if(animate&&stage.animate)stage.animate([
      {opacity:.55,transform:'scale(.94) translateY(4px)'},
      {opacity:1,transform:'scale(1.015) translateY(0)',offset:.72},
      {opacity:1,transform:'scale(1) translateY(0)'}
    ],{duration:330,easing:'cubic-bezier(.2,.85,.25,1)'});
  };

  SHAPES_TILE_DATA.forEach(shape=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='shapes-choice';
    button.dataset.shapeChoice=shape.id;
    button.setAttribute('aria-label',`Show ${shape.name}`);
    const icon=document.createElementNS(svgNs,'svg');
    icon.setAttribute('viewBox','0 0 240 200');
    icon.setAttribute('aria-hidden','true');
    const iconPath=document.createElementNS(svgNs,'path');
    iconPath.setAttribute('d',shape.path);
    icon.appendChild(iconPath);
    const label=document.createElement('span');
    label.textContent=shape.name;
    button.append(icon,label);
    button.addEventListener('click',()=>setShape(shape.id));
    picker.appendChild(button);
  });

  m.querySelector('.shapes-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.shapes-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.shapes-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));
  m.querySelector('.shapes-color').addEventListener('click',()=>cycleData(m,'shapeColor',['blue','green','amber','rose','purple','teal']));

  setShape(m.dataset.shape,{animate:false});
  m._boardGetState=()=>({shape:m.dataset.shape||'circle'});
  m._boardSetState=state=>setShape(state?.shape||m.dataset.shape,{animate:false});
}


const VISUAL_SCHEDULE_ICONS=[
  {src:'assets/schedule-icons/15.png',label:'Lunch'},
  {src:'assets/schedule-icons/16.png',label:'Math'},
  {src:'assets/schedule-icons/17.png',label:'Reading'},
  {src:'assets/schedule-icons/18.png',label:'Recess'},
  {src:'assets/schedule-icons/19.png',label:'Science'},
  {src:'assets/schedule-icons/20.png',label:'Celebration'},
  {src:'assets/schedule-icons/21.png',label:'Morning'},
  {src:'assets/schedule-icons/22.png',label:'Arrival'},
  {src:'assets/schedule-icons/23.png',label:'Spanish'},
  {src:'assets/schedule-icons/24.png',label:'Writing'},
  {src:'assets/schedule-icons/25.png',label:'Art'},
  {src:'assets/schedule-icons/26.png',label:'PE'},
  {src:'assets/schedule-icons/27.png',label:'Rest'},
  {src:'assets/schedule-icons/28.png',label:'Computer'},
  {src:'assets/schedule-icons/29.png',label:'Music'}
];

function resolveVisualScheduleIcon(src){
  const value=String(src||'').trim();
  if(!value)return null;
  const direct=VISUAL_SCHEDULE_ICONS.find(icon=>icon.src===value);
  if(direct)return direct;
  try{
    const wanted=new URL(value,document.baseURI).href;
    return VISUAL_SCHEDULE_ICONS.find(icon=>new URL(icon.src,document.baseURI).href===wanted)||null;
  }catch{return null}
}



function setupDate(m){
  const display=m.querySelector('.date-display');
  const weekday=m.querySelector('.date-weekday');
  const main=m.querySelector('.date-main');
  const year=m.querySelector('.date-year');
  const styleBtn=m.querySelector('.date-style');
  const layoutBtn=m.querySelector('.date-layout');
  const weekdayBtn=m.querySelector('.date-weekday-toggle');
  const yearBtn=m.querySelector('.date-year-toggle');

  let fitFrame=0;

  const fit=()=>{
    cancelAnimationFrame(fitFrame);
    fitFrame=requestAnimationFrame(()=>{
      const availableWidth=Math.max(40,m.clientWidth-24);
      const availableHeight=Math.max(40,m.clientHeight-34);

      let lo=10,hi=700,best=10;
      for(let i=0;i<18;i++){
        const mid=(lo+hi)/2;
        m.style.setProperty('--date-size',`${mid}px`);
        const fits=display.scrollWidth<=availableWidth+1&&display.scrollHeight<=availableHeight+1;
        if(fits){best=mid;lo=mid}else hi=mid;
      }
      m.style.setProperty('--date-size',`${Math.max(10,best*.97)}px`);
    });
  };

  const render=()=>{
    const d=new Date();
    const numeric=m.dataset.dateStyle==='numbers';
    const horizontal=m.dataset.dateLayout==='horizontal';
    const showWeekday=m.dataset.showWeekday!=='false';
    const showYear=m.dataset.showYear!=='false';

    m.classList.toggle('is-numeric',numeric);
    m.classList.toggle('is-horizontal',horizontal);

    weekday.hidden=!showWeekday;
    year.hidden=numeric||!showYear;

    const weekdayText=new Intl.DateTimeFormat([],{weekday:'long'}).format(d);
    const monthDayText=new Intl.DateTimeFormat([],{month:'long',day:'numeric'}).format(d);
    const numericText=new Intl.DateTimeFormat([],{month:'2-digit',day:'2-digit',year:'numeric'}).format(d);

    if(horizontal&&!numeric){
      weekday.textContent=showWeekday?`${weekdayText},`:'';
      main.textContent=showYear?`${monthDayText},`:monthDayText;
      year.textContent=String(d.getFullYear());
    }else{
      weekday.textContent=weekdayText.toUpperCase();
      main.textContent=numeric?numericText:monthDayText;
      year.textContent=String(d.getFullYear());
    }

    styleBtn.textContent=numeric?'Numbers':'Text';
    layoutBtn.textContent=horizontal?'Horizontal':'Stacked';

    weekdayBtn.classList.toggle('is-active',showWeekday);
    yearBtn.classList.toggle('is-active',showYear);
    yearBtn.disabled=numeric;
    yearBtn.hidden=numeric;
    yearBtn.setAttribute('aria-disabled',String(numeric));

    fit();
  };

  styleBtn.addEventListener('click',()=>{
    m.dataset.dateStyle=m.dataset.dateStyle==='numbers'?'text':'numbers';
    render();
  });

  layoutBtn.addEventListener('click',()=>{
    m.dataset.dateLayout=m.dataset.dateLayout==='horizontal'?'stacked':'horizontal';
    render();
  });

  weekdayBtn.addEventListener('click',()=>{
    m.dataset.showWeekday=m.dataset.showWeekday==='false'?'true':'false';
    render();
  });

  yearBtn.addEventListener('click',()=>{
    if(m.dataset.dateStyle==='numbers')return;
    m.dataset.showYear=m.dataset.showYear==='false'?'true':'false';
    render();
  });

  m.querySelector('.date-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.date-font').addEventListener('click',()=>{
    cycleData(m,'font',FONT_OPTIONS);
    fit();
  });
  m.querySelector('.date-text').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  const observer=new ResizeObserver(fit);
  observer.observe(m);
  observer.observe(display);

  const id=setInterval(render,30*1000);
  render();

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    clearInterval(id);
    cancelAnimationFrame(fitFrame);
    observer.disconnect();
  };
}

const CALENDAR_STORAGE_KEY='teachertiles-calendar-events-v1';

function getStoredCalendarEvents(){
  try{
    const parsed=JSON.parse(localStorage.getItem(CALENDAR_STORAGE_KEY)||'[]');
    return Array.isArray(parsed)?parsed:[];
  }catch{
    return [];
  }
}

function saveStoredCalendarEvents(events){
  try{localStorage.setItem(CALENDAR_STORAGE_KEY,JSON.stringify(events))}catch{}
  notifyBoardChanged('calendar');
}

function calendarDateKey(date){
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function calendarObservedDate(date){
  const d=new Date(date);
  if(d.getDay()===6)d.setDate(d.getDate()-1);
  if(d.getDay()===0)d.setDate(d.getDate()+1);
  return d;
}

function nthWeekdayOfMonth(year,month,weekday,n){
  const d=new Date(year,month,1);
  const offset=(weekday-d.getDay()+7)%7;
  d.setDate(1+offset+(n-1)*7);
  return d;
}

function lastWeekdayOfMonth(year,month,weekday){
  const d=new Date(year,month+1,0);
  const offset=(d.getDay()-weekday+7)%7;
  d.setDate(d.getDate()-offset);
  return d;
}

function usCalendarHolidays(year){
  const rows=[];
  const add=(date,title)=>rows.push({date:calendarDateKey(date),title,type:'holiday',builtIn:true});

  add(new Date(year,0,1),"New Year's Day");
  add(nthWeekdayOfMonth(year,0,1,3),'Martin Luther King Jr. Day');
  add(nthWeekdayOfMonth(year,1,1,3),"Presidents' Day");
  add(lastWeekdayOfMonth(year,4,1),'Memorial Day');
  add(new Date(year,5,19),'Juneteenth');
  add(new Date(year,6,4),'Independence Day');
  add(nthWeekdayOfMonth(year,8,1,1),'Labor Day');
  add(nthWeekdayOfMonth(year,9,1,2),'Columbus Day');
  add(new Date(year,10,11),"Veterans Day");
  add(nthWeekdayOfMonth(year,10,4,4),'Thanksgiving');
  add(new Date(year,11,25),'Christmas Day');

  [
    [new Date(year,0,1),"New Year's Day (Observed)"],
    [new Date(year,5,19),'Juneteenth (Observed)'],
    [new Date(year,6,4),'Independence Day (Observed)'],
    [new Date(year,10,11),"Veterans Day (Observed)"],
    [new Date(year,11,25),'Christmas Day (Observed)']
  ].forEach(([date,title])=>{
    const observed=calendarObservedDate(date);
    if(observed.getTime()!==date.getTime())add(observed,title);
  });

  return rows;
}

function setupCalendar(m){
  const grid=m.querySelector('.calendar-grid');
  const monthLabel=m.querySelector('.calendar-month');
  const yearLabel=m.querySelector('.calendar-year');
  const prev=m.querySelector('.calendar-prev');
  const next=m.querySelector('.calendar-next');
  const monthButton=m.querySelector('.calendar-month-label');
  const todayButton=m.querySelector('.calendar-today');
  const addButton=m.querySelector('.calendar-add-event');

  const eventPopover=m.querySelector('.calendar-event-popover');
  const eventForm=m.querySelector('.calendar-event-form');
  const eventDate=m.querySelector('.calendar-event-date');
  const eventTitle=m.querySelector('.calendar-event-title');
  const eventType=m.querySelector('.calendar-event-type');
  const eventRecurring=m.querySelector('.calendar-event-recurring');
  const eventClose=m.querySelector('.calendar-event-close');

  const dayPopover=m.querySelector('.calendar-day-popover');
  const dayPopoverTitle=m.querySelector('.calendar-day-popover-title');
  const dayPopoverSubtitle=m.querySelector('.calendar-day-popover-subtitle');
  const dayEvents=m.querySelector('.calendar-day-events');
  const dayClose=m.querySelector('.calendar-day-popover-close');
  const dayAdd=m.querySelector('.calendar-day-add');

  const now=new Date();
  let viewYear=now.getFullYear();
  let viewMonth=now.getMonth();
  let selectedDate=calendarDateKey(now);
  let events=getStoredCalendarEvents();

  const allEventsForYear=year=>[...events,...usCalendarHolidays(year)];

  const eventMatchesDate=(event,dateKey)=>{
    if(event.recurring){
      return event.date.slice(5)===dateKey.slice(5);
    }
    return event.date===dateKey;
  };

  const eventsForDate=dateKey=>{
    const y=Number(dateKey.slice(0,4));
    return allEventsForYear(y).filter(event=>eventMatchesDate(event,dateKey));
  };

  const closeEventPopover=()=>eventPopover.hidden=true;
  const closeDayPopover=()=>dayPopover.hidden=true;

  const openEventPopover=(dateKey=selectedDate)=>{
    selectedDate=dateKey||selectedDate;
    eventDate.value=selectedDate;
    eventTitle.value='';
    eventType.value='event';
    eventRecurring.checked=false;
    eventPopover.hidden=false;
    closeDayPopover();
    requestAnimationFrame(()=>eventTitle.focus({preventScroll:true}));
  };

  const deleteEvent=id=>{
    events=events.filter(event=>event.id!==id);
    saveStoredCalendarEvents(events);
    render();
    openDayPopover(selectedDate);
  };

  const openDayPopover=dateKey=>{
    selectedDate=dateKey;
    const d=new Date(`${dateKey}T12:00:00`);
    dayPopoverTitle.textContent=new Intl.DateTimeFormat([],{weekday:'long',month:'long',day:'numeric'}).format(d);
    dayPopoverSubtitle.textContent=String(d.getFullYear());
    dayEvents.innerHTML='';

    const rows=eventsForDate(dateKey);
    if(!rows.length){
      const empty=document.createElement('div');
      empty.className='calendar-day-empty';
      empty.textContent='Nothing added yet.';
      dayEvents.appendChild(empty);
    }else{
      rows.forEach(event=>{
        const row=document.createElement('div');
        row.className=`calendar-day-event calendar-day-event--${event.type||'event'}`;

        const dot=document.createElement('span');
        dot.className='calendar-day-event-dot';

        const copy=document.createElement('div');
        copy.className='calendar-day-event-copy';
        const strong=document.createElement('strong');
        strong.textContent=event.title;
        const small=document.createElement('small');
        if(event.type==='birthday')small.textContent=event.recurring?'Birthday • repeats yearly':'Birthday';
        else if(event.type==='holiday')small.textContent='Holiday';
        else if(event.type==='reminder')small.textContent=event.recurring?'Reminder • repeats yearly':'Reminder';
        else small.textContent=event.recurring?'Event • repeats yearly':'Event';
        copy.append(strong,small);

        row.append(dot,copy);

        if(!event.builtIn){
          const remove=document.createElement('button');
          remove.type='button';
          remove.className='calendar-day-event-remove';
          remove.setAttribute('aria-label',`Delete ${event.title}`);
          remove.textContent='×';
          remove.addEventListener('click',e=>{
            e.stopPropagation();
            deleteEvent(event.id);
          });
          row.appendChild(remove);
        }

        dayEvents.appendChild(row);
      });
    }

    closeEventPopover();
    dayPopover.hidden=false;
  };

  const render=()=>{
    monthLabel.textContent=new Intl.DateTimeFormat([],{month:'long'}).format(new Date(viewYear,viewMonth,1));
    yearLabel.textContent=String(viewYear);
    grid.innerHTML='';

    const firstDay=new Date(viewYear,viewMonth,1).getDay();
    const daysInMonth=new Date(viewYear,viewMonth+1,0).getDate();
    const prevMonthDays=new Date(viewYear,viewMonth,0).getDate();
    const todayKey=calendarDateKey(new Date());

    for(let cellIndex=0;cellIndex<42;cellIndex++){
      let date;
      let outside=false;

      if(cellIndex<firstDay){
        date=new Date(viewYear,viewMonth-1,prevMonthDays-firstDay+cellIndex+1);
        outside=true;
      }else if(cellIndex>=firstDay+daysInMonth){
        date=new Date(viewYear,viewMonth+1,cellIndex-firstDay-daysInMonth+1);
        outside=true;
      }else{
        date=new Date(viewYear,viewMonth,cellIndex-firstDay+1);
      }

      const dateKey=calendarDateKey(date);
      const rows=eventsForDate(dateKey);
      const button=document.createElement('button');
      button.type='button';
      button.className='calendar-day';
      button.dataset.date=dateKey;
      button.setAttribute('role','gridcell');
      if(outside)button.classList.add('is-outside');
      if(dateKey===todayKey)button.classList.add('is-today');
      if(dateKey===selectedDate)button.classList.add('is-selected');

      const number=document.createElement('span');
      number.className='calendar-day-number';
      number.textContent=String(date.getDate());
      button.appendChild(number);

      if(rows.length){
        const dots=document.createElement('span');
        dots.className='calendar-day-dots';
        rows.slice(0,3).forEach(event=>{
          const dot=document.createElement('i');
          dot.className=`calendar-dot calendar-dot--${event.type||'event'}`;
          dots.appendChild(dot);
        });
        button.appendChild(dots);

        const firstLabel=document.createElement('span');
        firstLabel.className='calendar-day-label';
        firstLabel.textContent=rows[0].title;
        button.appendChild(firstLabel);
      }

      button.addEventListener('click',()=>{
        const target=new Date(`${dateKey}T12:00:00`);
        if(target.getMonth()!==viewMonth||target.getFullYear()!==viewYear){
          viewMonth=target.getMonth();
          viewYear=target.getFullYear();
        }
        selectedDate=dateKey;
        render();
        openDayPopover(dateKey);
      });

      grid.appendChild(button);
    }
  };

  prev.addEventListener('click',()=>{
    viewMonth--;
    if(viewMonth<0){viewMonth=11;viewYear--}
    closeDayPopover();
    closeEventPopover();
    render();
  });

  next.addEventListener('click',()=>{
    viewMonth++;
    if(viewMonth>11){viewMonth=0;viewYear++}
    closeDayPopover();
    closeEventPopover();
    render();
  });

  const goToday=()=>{
    const d=new Date();
    viewYear=d.getFullYear();
    viewMonth=d.getMonth();
    selectedDate=calendarDateKey(d);
    closeDayPopover();
    closeEventPopover();
    render();
  };

  todayButton.addEventListener('click',goToday);
  monthButton.addEventListener('click',goToday);
  addButton.addEventListener('click',()=>openEventPopover(selectedDate));
  dayAdd.addEventListener('click',()=>openEventPopover(selectedDate));
  eventClose.addEventListener('click',closeEventPopover);
  dayClose.addEventListener('click',closeDayPopover);

  eventPopover.addEventListener('pointerdown',e=>{
    if(e.target===eventPopover)closeEventPopover();
  });
  dayPopover.addEventListener('pointerdown',e=>{
    if(e.target===dayPopover)closeDayPopover();
  });

  eventForm.addEventListener('submit',e=>{
    e.preventDefault();
    const title=eventTitle.value.trim();
    const date=eventDate.value;
    if(!title||!date)return;

    events.push({
      id:`evt-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      date,
      title,
      type:eventType.value,
      recurring:eventRecurring.checked
    });
    saveStoredCalendarEvents(events);

    const d=new Date(`${date}T12:00:00`);
    viewYear=d.getFullYear();
    viewMonth=d.getMonth();
    selectedDate=date;
    closeEventPopover();
    render();
    openDayPopover(date);
  });

  m.querySelector('.calendar-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.calendar-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.calendar-text').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  render();
}

function setupProgressBar(m){
  const remaining=m.querySelector('.progress-bar-remaining');
  const endLabel=m.querySelector('.progress-bar-end-label');
  const track=m.querySelector('.progress-bar-track');
  const fill=m.querySelector('.progress-bar-fill');
  const endInput=m.querySelector('.progress-bar-end-time');
  const setEndButton=m.querySelector('.progress-bar-set-end');
  const resetButton=m.querySelector('.progress-bar-reset');
  const orientationButton=m.querySelector('.progress-bar-orientation');
  const styleButton=m.querySelector('.progress-bar-style');
  const iconStart=m.querySelector('.progress-bar-icon-start');
  const iconEnd=m.querySelector('.progress-bar-icon-end');
  const picker=m.querySelector('.progress-bar-picker');
  const pickerGrid=m.querySelector('.progress-bar-picker__grid');
  const pickerClose=m.querySelector('.progress-bar-picker__close');
  const customImageInput=m.querySelector('.progress-bar-custom-image-input');

  const colors=['blue','green','amber','rose','purple','aqua'];
  const styles=[
    {key:'glass',label:'Glass'},
    {key:'striped',label:'Striped'},
    {key:'segmented',label:'Segments'},
    {key:'soft',label:'Soft'}
  ];

  let initializedAt=Date.now();
  let targetAt=initializedAt+60*60*1000;
  let activeIconSlot=null;
  let interval=0;
  let completed=false;
  let running=false;

  const pad=n=>String(n).padStart(2,'0');
  const formatInputTime=date=>`${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const formatClock=date=>date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});

  const formatRemaining=ms=>{
    const total=Math.max(0,Math.ceil(ms/1000));
    const hours=Math.floor(total/3600);
    const minutes=Math.floor((total%3600)/60);
    const seconds=total%60;
    return hours>0?`${hours}:${pad(minutes)}:${pad(seconds)}`:`${pad(minutes)}:${pad(seconds)}`;
  };

  const setSlotIcon=(slot,icon)=>{
    const image=slot.querySelector('img');
    image.src=icon.src;
    image.alt=icon.label;
    slot.dataset.iconSrc=icon.src;
    slot.classList.add('has-icon');
  };

  const clearSlotIcon=slot=>{
    const image=slot.querySelector('img');
    image.removeAttribute('src');
    image.alt='';
    delete slot.dataset.iconSrc;
    slot.classList.remove('has-icon');
  };

  const restoreSlotIcon=(slot,src)=>{
    const icon=resolveVisualScheduleIcon(src);
    if(icon)setSlotIcon(slot,icon);
    else if(typeof src==='string'&&src.startsWith('data:image/'))setSlotIcon(slot,{src,label:'Custom image'});
    else clearSlotIcon(slot);
  };

  const refreshPickerSelection=()=>{
    const current=activeIconSlot?.dataset.iconSrc||'';
    pickerGrid.querySelectorAll('.progress-bar-icon-option').forEach(button=>{
      button.classList.toggle('is-selected',button.dataset.iconSrc===current);
    });
  };

  const openPicker=slot=>{
    activeIconSlot=slot;
    refreshPickerSelection();
    picker.hidden=false;
    requestAnimationFrame(()=>pickerClose.focus({preventScroll:true}));
  };

  const closePicker=()=>{
    picker.hidden=true;
    activeIconSlot=null;
  };

  const uploadOption=document.createElement('button');
  uploadOption.type='button';
  uploadOption.className='progress-bar-icon-option progress-bar-icon-option--upload';
  uploadOption.innerHTML='<span class="custom-image-upload-mark" aria-hidden="true">+</span><span>Upload yours</span>';
  uploadOption.setAttribute('aria-label','Upload a custom progress bar image');
  uploadOption.addEventListener('click',()=>customImageInput?.click());
  pickerGrid.appendChild(uploadOption);

  customImageInput?.addEventListener('change',async()=>{
    const file=customImageInput.files?.[0];
    if(!file||!activeIconSlot)return;
    const data=await fileToBoardImageData(file,{maxSide:420,maxLength:70000,quality:.72,minSide:160});
    if(data){setSlotIcon(activeIconSlot,{src:data,label:file.name||'Custom image'});notifyBoardChanged('progress-bar-image')}
    customImageInput.value='';
    closePicker();
  });

  VISUAL_SCHEDULE_ICONS.forEach(icon=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='progress-bar-icon-option';
    button.dataset.iconSrc=icon.src;
    button.setAttribute('aria-label',`Use ${icon.label} image`);

    const image=document.createElement('img');
    image.src=icon.src;
    image.alt='';
    image.draggable=false;

    const caption=document.createElement('span');
    caption.textContent=icon.label;

    button.append(image,caption);
    button.addEventListener('click',()=>{
      if(activeIconSlot){
        setSlotIcon(activeIconSlot,icon);
        notifyBoardChanged('progress-bar-image');
      }
      closePicker();
    });
    pickerGrid.appendChild(button);
  });

  const render=()=>{
    const now=Date.now();
    const duration=Math.max(1,targetAt-initializedAt);
    const elapsed=completed?duration:(running?Math.max(0,now-initializedAt):0);
    const progress=clamp(elapsed/duration,0,1);

    const vertical=m.dataset.orientation==='vertical';
    const trackLength=vertical?track.clientHeight:track.clientWidth;
    const trueLength=Math.max(0,trackLength*progress);
    const visibleLength=progress>0&&progress<1?Math.max(6,trueLength):trueLength;

    if(vertical){
      fill.style.width='';
      fill.style.height=`${Math.min(trackLength,visibleLength)}px`;
    }else{
      fill.style.height='';
      fill.style.width=`${Math.min(trackLength,visibleLength)}px`;
    }

    m.style.setProperty('--progress',`${(progress*100).toFixed(4)}%`);
    remaining.textContent=formatRemaining(completed?0:(running?targetAt-now:duration));
    endLabel.textContent=`until ${formatClock(new Date(targetAt))}`;

    const isComplete=progress>=1;
    m.classList.toggle('is-complete',isComplete);
    if(isComplete&&!completed){
      completed=true;
      running=false;
      celebrateTimerFinish(m);
    }
  };

  const targetFromInput=()=>{
    if(!endInput.value)return;
    const [hour,minute]=endInput.value.split(':').map(Number);
    if(!Number.isFinite(hour)||!Number.isFinite(minute))return;

    const now=new Date();
    const target=new Date(now);
    target.setHours(hour,minute,0,0);
    if(target.getTime()<=now.getTime())target.setDate(target.getDate()+1);
    return target.getTime();
  };

  const syncTimeFromInput=()=>{
    const nextTarget=targetFromInput();
    if(!nextTarget)return;
    if(!running)initializedAt=Date.now();
    targetAt=nextTarget;
    completed=false;
    m.classList.remove('is-complete');
    render();
    notifyBoardChanged('progress-bar-time');
  };

  const start=()=>{
    const nextTarget=targetFromInput();
    if(!nextTarget)return;
    initializedAt=Date.now();
    targetAt=nextTarget;
    completed=false;
    running=true;
    m.classList.remove('is-complete');
    render();
    notifyBoardChanged('progress-bar-start');
  };

  const reset=()=>{
    const nextTarget=targetFromInput();
    initializedAt=Date.now();
    if(nextTarget)targetAt=nextTarget;
    completed=false;
    running=false;
    m.classList.remove('is-complete');
    render();
    notifyBoardChanged('progress-bar-reset');
  };

  const setOrientation=orientation=>{
    const vertical=orientation==='vertical';
    m.dataset.orientation=orientation;
    orientationButton.textContent=vertical?'↕':'↔';
    orientationButton.title=vertical?'Switch to horizontal':'Switch to vertical';

    const centerX=m.offsetLeft+m.offsetWidth/2;
    const centerY=m.offsetTop+m.offsetHeight/2;

    if(vertical){
      m.style.width='250px';
      m.style.height='700px';
    }else{
      m.style.width='760px';
      m.style.height='190px';
    }

    const w=m.offsetWidth,h=m.offsetHeight;
    m.style.left=`${clamp(centerX-w/2,0,BOARD_WIDTH-w)}px`;
    m.style.top=`${clamp(centerY-h/2,0,BOARD_HEIGHT-h)}px`;
    render();
    updateWorkspaceEmptyState();
  };

  const cycleStyle=()=>{
    const current=m.dataset.barStyle||'glass';
    const index=styles.findIndex(option=>option.key===current);
    const next=styles[(index+1)%styles.length];
    m.dataset.barStyle=next.key;
    styleButton.textContent=next.label;
  };

  const syncVisualControls=()=>{
    const vertical=m.dataset.orientation==='vertical';
    orientationButton.textContent=vertical?'↕':'↔';
    orientationButton.title=vertical?'Switch to horizontal':'Switch to vertical';
    const style=styles.find(option=>option.key===m.dataset.barStyle)||styles[0];
    m.dataset.barStyle=style.key;
    styleButton.textContent=style.label;
  };

  m.querySelector('.progress-bar-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.progress-bar-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.progress-bar-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));
  m.querySelector('.progress-bar-color').addEventListener('click',()=>cycleData(m,'barColor',colors));

  setEndButton.addEventListener('click',start);
  resetButton.addEventListener('click',reset);
  endInput.addEventListener('input',syncTimeFromInput);
  endInput.addEventListener('keydown',e=>{
    if(e.key==='Enter'){
      e.preventDefault();
      syncTimeFromInput();
      endInput.blur();
    }
  });

  orientationButton.addEventListener('click',()=>{
    setOrientation(m.dataset.orientation==='vertical'?'horizontal':'vertical');
  });
  styleButton.addEventListener('click',cycleStyle);

  iconStart.addEventListener('click',()=>openPicker(iconStart));
  iconEnd.addEventListener('click',()=>openPicker(iconEnd));
  pickerClose.addEventListener('click',closePicker);
  picker.addEventListener('pointerdown',e=>{
    if(e.target===picker)closePicker();
  });
  picker.addEventListener('wheel',e=>{
    e.preventDefault();
    e.stopPropagation();
    pickerGrid.scrollTop+=e.deltaY;
  },{passive:false});

  const defaultEnd=new Date(Date.now()+30*60*1000);
  endInput.value=formatInputTime(defaultEnd);
  syncTimeFromInput();
  syncVisualControls();

  interval=window.setInterval(render,200);
  render();

  m._boardGetState=()=>({
    initializedAt,
    targetAt,
    completed,
    running,
    orientation:m.dataset.orientation||'horizontal',
    barStyle:m.dataset.barStyle||'glass',
    startIconSrc:iconStart.dataset.iconSrc||'',
    endIconSrc:iconEnd.dataset.iconSrc||''
  });
  m._boardSetState=state=>{
    if(!state)return;
    initializedAt=Number(state.initializedAt)||Date.now();
    targetAt=Number(state.targetAt)||Date.now()+30*60*1000;
    completed=Boolean(state.completed);
    running=state.running===undefined?!completed:Boolean(state.running);
    if(state.orientation==='vertical'||state.orientation==='horizontal')m.dataset.orientation=state.orientation;
    if(styles.some(option=>option.key===state.barStyle))m.dataset.barStyle=state.barStyle;
    syncVisualControls();
    restoreSlotIcon(iconStart,state.startIconSrc||state.startIcon||'');
    restoreSlotIcon(iconEnd,state.endIconSrc||state.endIcon||'');
    endInput.value=formatInputTime(new Date(targetAt));
    render();
  };

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    window.clearInterval(interval);
  };
}

function setupVisualSchedule(m){
  const list=m.querySelector('.visual-schedule-list');
  const add=m.querySelector('.visual-schedule-add');
  const picker=m.querySelector('.visual-schedule-picker');
  const pickerGrid=m.querySelector('.visual-schedule-picker__grid');
  const pickerClose=m.querySelector('.visual-schedule-picker__close');
  const customImageInput=m.querySelector('.visual-schedule-custom-image-input');
  let activeSegment=null;
  let autoSizeFrame=0;
  let lastObservedWidth=0;

  m.querySelector('.visual-schedule-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.visual-schedule-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.visual-schedule-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  const autoSize=()=>{
    cancelAnimationFrame(autoSizeFrame);
    autoSizeFrame=requestAnimationFrame(()=>{
      const top=m.offsetTop;
      m.style.height='auto';
      const desired=Math.ceil(m.scrollHeight);
      const maxHeight=Math.max(parseFloat(getComputedStyle(m).minHeight)||250,BOARD_HEIGHT-top);
      m.style.height=`${Math.min(desired,maxHeight)}px`;
    });
  };

  const closePicker=()=>{
    picker.hidden=true;
    activeSegment=null;
  };

  const refreshPickerSelection=()=>{
    const current=activeSegment?.dataset.iconSrc||'';
    pickerGrid.querySelectorAll('.visual-schedule-icon-option').forEach(button=>{
      button.classList.toggle('is-selected',button.dataset.iconSrc===current);
    });
  };

  const uploadOption=document.createElement('button');
  uploadOption.type='button';
  uploadOption.className='visual-schedule-icon-option visual-schedule-icon-option--upload';
  uploadOption.innerHTML='<span class="custom-image-upload-mark" aria-hidden="true">+</span><span>Upload yours</span>';
  uploadOption.setAttribute('aria-label','Upload a custom visual schedule image');
  uploadOption.addEventListener('click',()=>customImageInput?.click());
  pickerGrid.appendChild(uploadOption);

  customImageInput?.addEventListener('change',async()=>{
    const file=customImageInput.files?.[0];
    if(!file||!activeSegment)return;
    const data=await fileToBoardImageData(file,{maxSide:420,maxLength:70000,quality:.72,minSide:160});
    if(data){
      const targetImage=activeSegment.querySelector('.visual-schedule-image img');
      targetImage.src=data;
      targetImage.alt=file.name||'Custom image';
      activeSegment.dataset.iconSrc=data;
      notifyBoardChanged('visual-schedule-image');
    }
    customImageInput.value='';
    closePicker();
  });

  VISUAL_SCHEDULE_ICONS.forEach(icon=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='visual-schedule-icon-option';
    button.dataset.iconSrc=icon.src;
    button.setAttribute('aria-label',`Use ${icon.label} image`);
    const image=document.createElement('img');
    image.src=icon.src;
    image.alt='';
    image.draggable=false;
    const caption=document.createElement('span');
    caption.textContent=icon.label;
    button.append(image,caption);
    button.addEventListener('click',()=>{
      if(!activeSegment)return;
      const targetImage=activeSegment.querySelector('.visual-schedule-image img');
      targetImage.src=icon.src;
      targetImage.alt=icon.label;
      activeSegment.dataset.iconSrc=icon.src;
      notifyBoardChanged('visual-schedule-image');
      closePicker();
    });
    pickerGrid.appendChild(button);
  });

  const openPicker=segment=>{
    activeSegment=segment;
    refreshPickerSelection();
    picker.hidden=false;
    requestAnimationFrame(()=>pickerClose.focus({preventScroll:true}));
  };

  pickerClose.addEventListener('click',closePicker);
  picker.addEventListener('pointerdown',e=>{
    if(e.target===picker)closePicker();
  });
  picker.addEventListener('wheel',e=>{
    e.stopPropagation();
  },{passive:true});

  const setSegmentSize=(row,value)=>{
    const size=clamp(Math.round(Number(value)||86),76,220);
    row.dataset.segmentSize=String(size);
    row.style.setProperty('--visual-segment-size',`${size}px`);
  };

  const addSegment=(data={},focus=false)=>{
    const fallbackIcon=VISUAL_SCHEDULE_ICONS[data.iconIndex??(list.children.length%VISUAL_SCHEDULE_ICONS.length)]||VISUAL_SCHEDULE_ICONS[0];
    const icon=resolveVisualScheduleIcon(data.iconSrc)||(typeof data.iconSrc==='string'&&data.iconSrc.startsWith('data:image/')?{src:data.iconSrc,label:'Custom image'}:fallbackIcon);
    const row=document.createElement('div');
    row.className='visual-schedule-segment';
    row.dataset.iconSrc=icon.src;
    row.innerHTML=`
      <button class="visual-schedule-image" type="button" aria-label="Change segment image" title="Change image">
        <img src="${icon.src}" alt="${icon.label}" draggable="false">
      </button>
      <input class="visual-schedule-segment-title" type="text" aria-label="Activity title">
      <input class="visual-schedule-segment-time" type="text" aria-label="Activity time">
      <div class="visual-schedule-segment-actions">
        <button class="visual-schedule-complete" type="button" aria-pressed="false">Complete</button>
        <button class="visual-schedule-remove" type="button" aria-label="Remove segment" title="Remove segment">×</button>
      </div>
      <button class="visual-schedule-resize" type="button" aria-label="Resize this schedule segment" title="Drag to resize segment"></button>
    `;
    setSegmentSize(row,data.size);
    const title=row.querySelector('.visual-schedule-segment-title');
    const time=row.querySelector('.visual-schedule-segment-time');
    title.value=data.title??'New Activity';
    time.value=data.time??'';
    row.classList.toggle('is-complete',Boolean(data.complete));
    const completeButton=row.querySelector('.visual-schedule-complete');
    const syncCompleteButton=()=>{
      const complete=row.classList.contains('is-complete');
      completeButton.textContent=complete?'Undo':'Complete';
      completeButton.setAttribute('aria-pressed',String(complete));
      completeButton.title=complete?'Mark segment incomplete':'Mark segment complete';
    };
    syncCompleteButton();

    completeButton.addEventListener('click',()=>{
      row.classList.toggle('is-complete');
      syncCompleteButton();
    });
    row.querySelector('.visual-schedule-image').addEventListener('click',()=>openPicker(row));
    row.querySelector('.visual-schedule-remove').addEventListener('click',()=>{
      if(activeSegment===row)closePicker();
      row.remove();
      autoSize();
      notifyBoardChanged('visual-schedule-remove');
    });
    const resizeHandle=row.querySelector('.visual-schedule-resize');
    resizeHandle.addEventListener('keydown',event=>{
      if(event.key!=='ArrowUp'&&event.key!=='ArrowDown')return;
      event.preventDefault();
      setSegmentSize(row,(Number(row.dataset.segmentSize)||86)+(event.key==='ArrowDown'?8:-8));
      autoSize();
      notifyBoardChanged('visual-schedule-resize');
    });
    resizeHandle.addEventListener('pointerdown',event=>{
      if(event.button!==0)return;
      event.preventDefault();
      event.stopPropagation();
      const startY=event.clientY;
      const startSize=Number(row.dataset.segmentSize)||86;
      resizeHandle.setPointerCapture(event.pointerId);

      const move=moveEvent=>{
        moveEvent.preventDefault();
        moveEvent.stopPropagation();
        setSegmentSize(row,startSize+(moveEvent.clientY-startY)/boardCamera.scale);
        autoSize();
      };
      const finish=finishEvent=>{
        finishEvent.stopPropagation();
        resizeHandle.removeEventListener('pointermove',move);
        resizeHandle.removeEventListener('pointerup',finish);
        resizeHandle.removeEventListener('pointercancel',finish);
        notifyBoardChanged('visual-schedule-resize');
      };

      resizeHandle.addEventListener('pointermove',move);
      resizeHandle.addEventListener('pointerup',finish);
      resizeHandle.addEventListener('pointercancel',finish);
    });

    list.appendChild(row);
    autoSize();
    if(focus)requestAnimationFrame(()=>{title.focus();title.select()});
  };

  add.addEventListener('click',()=>addSegment({},true));

  addSegment({title:'Arrival',time:'8:00 AM',iconIndex:7});
  addSegment({title:'Morning Work',time:'8:15 AM',iconIndex:6});
  addSegment({title:'Reading',time:'9:00 AM',iconIndex:2});

  m._boardGetState=()=>({segments:[...list.querySelectorAll('.visual-schedule-segment')].map(row=>({
    title:row.querySelector('.visual-schedule-segment-title')?.value||'',
    time:row.querySelector('.visual-schedule-segment-time')?.value||'',
    iconSrc:row.dataset.iconSrc||row.querySelector('.visual-schedule-image img')?.getAttribute('src')||'',
    complete:row.classList.contains('is-complete'),
    size:Number(row.dataset.segmentSize)||86
  }))});
  m._boardSetState=state=>{
    closePicker();
    list.replaceChildren();
    const segments=Array.isArray(state?.segments)?state.segments:[];
    segments.forEach(segment=>addSegment(segment,false));
    autoSize();
  };

  const resizeObserver=new ResizeObserver(entries=>{
    const width=entries[0]?.contentRect.width||m.offsetWidth;
    if(Math.abs(width-lastObservedWidth)>1){
      lastObservedWidth=width;
      autoSize();
    }
  });
  resizeObserver.observe(m);

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    cancelAnimationFrame(autoSizeFrame);
    resizeObserver.disconnect();
  };

  autoSize();
}

window.TeacherTilesRefreshLessonPlannerTiles=()=>{
  const tiles=[...document.querySelectorAll('.lesson-plan-tile')];
  tiles.forEach(tile=>tile._refreshLessonPlans?.());
  if(tiles.length)notifyBoardChanged('lesson-planner-plans');
};

function setupLessonPlannerTile(m){
  const body=m.querySelector('.lesson-plan-tile__body');
  const title=m.querySelector('.lesson-plan-tile__title');
  const range=m.querySelector('.lesson-plan-tile__range');
  const viewButtons=[...m.querySelectorAll('[data-lesson-plan-tile-view]')];
  const colorMap={sun:['#f3bd3d','#563b00'],sky:['#5ca7e8','#0c355a'],mint:['#61bf9a','#0b4433'],coral:['#ee7b68','#5b1e18'],grape:['#a883dc','#352050'],rose:['#dc79a6','#561b36'],ocean:['#397db9','#f4fbff'],slate:['#718096','#fff']};
  let mode=m.dataset.plannerTileView==='week'?'week':'day';
  const atNoon=date=>{const next=new Date(date);next.setHours(12,0,0,0);return next};
  const addDays=(date,amount)=>{const next=atNoon(date);next.setDate(next.getDate()+amount);return next};
  const dateKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const startOfWeek=date=>addDays(date,date.getDay()===0?-6:1-date.getDay());
  const timeLabel=value=>{const [hours,minutes]=String(value||'00:00').split(':').map(Number);return `${hours%12||12}:${String(minutes||0).padStart(2,'0')} ${hours<12?'AM':'PM'}`};
  const getBlocks=()=>{
    const apiBlocks=window.TeacherTilesLessonPlanner?.getBlocks?.();
    if(Array.isArray(apiBlocks))return apiBlocks;
    try{const value=JSON.parse(localStorage.getItem('teachertiles-lesson-planner-v1')||'[]');return Array.isArray(value)?value:[]}catch{return[]}
  };
  const renderEmpty=message=>{
    const empty=document.createElement('div');empty.className='lesson-plan-tile__empty';empty.innerHTML='<span aria-hidden="true">✎</span><strong>No plans yet</strong><small></small>';empty.querySelector('small').textContent=message;body.append(empty);
  };
  const makeBlock=block=>{
    const [color,ink]=colorMap[block.color]||colorMap.sun;
    const card=document.createElement('article');card.className='lesson-plan-tile__block';card.style.setProperty('--lesson-color',color);card.style.setProperty('--lesson-ink',ink);
    const time=document.createElement('span');time.className='lesson-plan-tile__time';time.textContent=`${timeLabel(block.start)}–${timeLabel(block.end)}`;
    const label=document.createElement('strong');label.textContent=String(block.label||'Untitled lesson');
    card.append(time,label);
    if(block.description){const description=document.createElement('p');description.textContent=String(block.description);card.append(description)}
    return card;
  };
  const render=()=>{
    const today=atNoon(new Date());
    const blocks=getBlocks().filter(block=>block&&typeof block.date==='string').sort((a,b)=>a.date.localeCompare(b.date)||String(a.start).localeCompare(String(b.start)));
    body.replaceChildren();m.dataset.plannerTileView=mode;
    viewButtons.forEach(button=>{const active=button.dataset.lessonPlanTileView===mode;button.classList.toggle('is-active',active);button.setAttribute('aria-pressed',String(active))});
    if(mode==='day'){
      const key=dateKey(today);const plans=blocks.filter(block=>block.date===key);
      title.textContent='Today’s Plans';range.textContent=new Intl.DateTimeFormat(undefined,{weekday:'long',month:'long',day:'numeric'}).format(today);
      if(!plans.length)renderEmpty('Open the Lesson Planner to plan today.');else plans.forEach(plan=>body.append(makeBlock(plan)));
      return;
    }
    const first=startOfWeek(today),last=addDays(first,6);title.textContent='This Week’s Plans';
    range.textContent=`${new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(first)}–${new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(last)}`;
    let count=0;
    for(let index=0;index<7;index++){
      const date=addDays(first,index);const plans=blocks.filter(block=>block.date===dateKey(date));if(!plans.length)continue;count+=plans.length;
      const group=document.createElement('section');group.className='lesson-plan-tile__day-group';
      const heading=document.createElement('header');heading.innerHTML='<strong></strong><span></span>';heading.querySelector('strong').textContent=new Intl.DateTimeFormat(undefined,{weekday:'long'}).format(date);heading.querySelector('span').textContent=new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(date);
      group.append(heading);plans.forEach(plan=>group.append(makeBlock(plan)));body.append(group);
    }
    if(!count)renderEmpty('Open the Lesson Planner to build this week.');
  };
  viewButtons.forEach(button=>button.addEventListener('click',()=>{mode=button.dataset.lessonPlanTileView==='week'?'week':'day';render();notifyBoardChanged('lesson-planner-tile-view')}));
  m.querySelector('.lesson-plan-tile__edit').addEventListener('click',()=>{if(window.TeacherTilesLessonPlanner?.open)window.TeacherTilesLessonPlanner.open();else document.getElementById('profile-lesson-planner-button')?.click()});
  m.querySelector('.lesson-plan-tile__bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.lesson-plan-tile__font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.lesson-plan-tile__text').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));
  const handleChange=()=>render();window.addEventListener('teachertiles:lessonplannerchange',handleChange);
  m._refreshLessonPlans=render;
  const dateTimer=setInterval(render,60000);
  m._boardGetState=()=>({mode});m._boardSetState=state=>{mode=state?.mode==='week'?'week':'day';render()};
  const prior=m._cleanup;m._cleanup=()=>{prior?.();clearInterval(dateTimer);window.removeEventListener('teachertiles:lessonplannerchange',handleChange);delete m._refreshLessonPlans};
  render();
}

const TABLE_MAKER_COLORS=['#4f8fe8','#ef6f78','#f0b44d','#55ae7b','#8d6bdd','#38aab7','#e47ca8','#7e91a8','#dd7a43','#74a84f','#5965c9','#c35c84'];

function makeChartSvgNode(tag,attributes={},text=''){
  const node=document.createElementNS('http://www.w3.org/2000/svg',tag);
  Object.entries(attributes).forEach(([key,value])=>node.setAttribute(key,String(value)));
  if(text!==''&&text!==undefined)node.textContent=String(text);
  return node;
}

function chartNiceMaximum(value){
  const max=Math.max(1,Number(value)||0);
  const magnitude=10**Math.floor(Math.log10(max));
  const fraction=max/magnitude;
  const nice=fraction<=1?1:fraction<=2?2:fraction<=5?5:10;
  return nice*magnitude;
}

function setupTableMaker(m){
  const chart=m.querySelector('.table-maker-chart');
  const legend=m.querySelector('.table-maker-legend');
  const empty=m.querySelector('.table-maker-empty');
  const editor=m.querySelector('.table-maker-editor');
  const dataRows=m.querySelector('.table-maker-data-rows');
  const dataToggle=m.querySelector('.table-maker-data-toggle');
  const dataCount=dataToggle.querySelector('b');
  const addRowButton=m.querySelector('.table-maker-add-row');
  const totalNode=m.querySelector('.table-maker-summary strong');
  const status=m.querySelector('.table-maker-status');
  const typeButtons=[...m.querySelectorAll('[data-chart-type]')];
  let chartType='bar';
  let editorOpen=true;
  let rows=[
    {label:'Reading',value:18,color:TABLE_MAKER_COLORS[0]},
    {label:'Math',value:24,color:TABLE_MAKER_COLORS[1]},
    {label:'Science',value:14,color:TABLE_MAKER_COLORS[2]},
    {label:'Writing',value:20,color:TABLE_MAKER_COLORS[3]}
  ];

  const normalizeRows=value=>(Array.isArray(value)?value:[]).slice(0,12).map((row,index)=>({
    label:String(row?.label||`Category ${index+1}`).slice(0,28),
    value:Math.max(0,Math.min(999999,Number(row?.value)||0)),
    color:/^#[0-9a-f]{6}$/i.test(String(row?.color||''))?String(row.color):TABLE_MAKER_COLORS[index%TABLE_MAKER_COLORS.length]
  }));
  const displayLabel=value=>String(value||'Untitled').trim().slice(0,12)||'Untitled';
  const setEditorOpen=open=>{
    editorOpen=Boolean(open);
    m.dataset.editorOpen=String(editorOpen);
    editor.hidden=!editorOpen;
    dataToggle.classList.toggle('is-active',editorOpen);
    dataToggle.setAttribute('aria-expanded',String(editorOpen));
    dataToggle.querySelector('span').textContent=editorOpen?'Hide Data':'Edit Data';
  };
  const addAxis=(maxValue,{left=54,right=22,top=22,bottom=53,width=600,height=340}={})=>{
    const plotWidth=width-left-right,plotHeight=height-top-bottom;
    for(let tick=0;tick<=4;tick++){
      const ratio=tick/4,y=top+plotHeight-(plotHeight*ratio);
      chart.appendChild(makeChartSvgNode('line',{x1:left,y1:y,x2:width-right,y2:y,class:'table-maker-grid-line'}));
      chart.appendChild(makeChartSvgNode('text',{x:left-10,y:y+4,'text-anchor':'end',class:'table-maker-axis-label'},Math.round(maxValue*ratio*100)/100));
    }
    chart.appendChild(makeChartSvgNode('line',{x1:left,y1:top,x2:left,y2:height-bottom,class:'table-maker-axis-line'}));
    chart.appendChild(makeChartSvgNode('line',{x1:left,y1:height-bottom,x2:width-right,y2:height-bottom,class:'table-maker-axis-line'}));
    return{left,right,top,bottom,width,height,plotWidth,plotHeight};
  };
  const renderLegend=activeRows=>{
    legend.replaceChildren();
    activeRows.forEach(row=>{
      const item=document.createElement('span');
      item.innerHTML='<i></i><b></b>';
      item.querySelector('i').style.background=row.color;
      item.querySelector('b').textContent=row.label||'Untitled';
      legend.appendChild(item);
    });
  };
  const renderChart=()=>{
    chart.replaceChildren();
    const activeRows=rows.filter(row=>row.value>0);
    const total=rows.reduce((sum,row)=>sum+row.value,0);
    totalNode.textContent=Number.isInteger(total)?total.toLocaleString():total.toLocaleString(undefined,{maximumFractionDigits:2});
    dataCount.textContent=String(rows.length);
    status.textContent=`${rows.length} ${rows.length===1?'category':'categories'} · ${chartType==='donut'?'donut':chartType} chart`;
    empty.hidden=activeRows.length>0;
    chart.hidden=activeRows.length===0;
    renderLegend(activeRows);
    if(!activeRows.length)return;
    chart.setAttribute('aria-label',`${chartType} chart with ${activeRows.length} categories and total ${total}`);
    if(chartType==='bar'||chartType==='line'){
      const maxValue=chartNiceMaximum(Math.max(...activeRows.map(row=>row.value)));
      const frame=addAxis(maxValue);
      if(chartType==='bar'){
        const slot=frame.plotWidth/activeRows.length;
        const barWidth=Math.min(76,Math.max(16,slot*.62));
        activeRows.forEach((row,index)=>{
          const height=Math.max(2,(row.value/maxValue)*frame.plotHeight);
          const x=frame.left+slot*index+(slot-barWidth)/2,y=frame.top+frame.plotHeight-height;
          const group=makeChartSvgNode('g',{class:'table-maker-bar-group'});
          group.style.setProperty('--chart-delay',`${index*45}ms`);
          const rect=makeChartSvgNode('rect',{x,y,width:barWidth,height,rx:Math.min(9,barWidth/4),fill:row.color,class:'table-maker-bar'});
          const value=makeChartSvgNode('text',{x:x+barWidth/2,y:y-8,'text-anchor':'middle',class:'table-maker-value-label'},Number(row.value).toLocaleString());
          const label=makeChartSvgNode('text',{x:x+barWidth/2,y:frame.height-28,'text-anchor':'middle',class:'table-maker-x-label'},displayLabel(row.label));
          group.append(rect,value,label);chart.appendChild(group);
        });
      }else{
        const slot=activeRows.length===1?0:frame.plotWidth/(activeRows.length-1);
        const points=activeRows.map((row,index)=>({row,x:activeRows.length===1?frame.left+frame.plotWidth/2:frame.left+slot*index,y:frame.top+frame.plotHeight-(row.value/maxValue)*frame.plotHeight}));
        const linePath=points.map((point,index)=>`${index?'L':'M'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
        const areaPath=`M${points[0].x} ${frame.height-frame.bottom} ${points.map(point=>`L${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')} L${points.at(-1).x} ${frame.height-frame.bottom} Z`;
        const area=makeChartSvgNode('path',{d:areaPath,fill:points[0].row.color,class:'table-maker-line-area'});
        const line=makeChartSvgNode('path',{d:linePath,fill:'none',stroke:points[0].row.color,class:'table-maker-line'});
        chart.append(area,line);
        points.forEach((point,index)=>{
          const dot=makeChartSvgNode('circle',{cx:point.x,cy:point.y,r:6,fill:point.row.color,class:'table-maker-point'});dot.style.setProperty('--chart-delay',`${index*55}ms`);
          chart.append(dot,makeChartSvgNode('text',{x:point.x,y:point.y-12,'text-anchor':'middle',class:'table-maker-value-label'},Number(point.row.value).toLocaleString()),makeChartSvgNode('text',{x:point.x,y:frame.height-28,'text-anchor':'middle',class:'table-maker-x-label'},displayLabel(point.row.label)));
        });
      }
      return;
    }
    const cx=300,cy=165,r=124;
    let angle=-Math.PI/2;
    activeRows.forEach((row,index)=>{
      const share=row.value/total;
      const next=angle+share*Math.PI*2;
      if(chartType==='donut'){
        const circumference=2*Math.PI*r;
        const circle=makeChartSvgNode('circle',{cx,cy,r,fill:'none',stroke:row.color,'stroke-width':62,'stroke-dasharray':`${Math.max(0,circumference*share-2)} ${circumference}`,'stroke-dashoffset':-(circumference*((angle+Math.PI/2)/(Math.PI*2))),transform:`rotate(-90 ${cx} ${cy})`,class:'table-maker-donut-segment'});
        circle.style.setProperty('--chart-delay',`${index*65}ms`);chart.appendChild(circle);
      }else if(share>.9999){
        chart.appendChild(makeChartSvgNode('circle',{cx,cy,r,fill:row.color,class:'table-maker-pie-slice'}));
      }else{
        const startX=cx+r*Math.cos(angle),startY=cy+r*Math.sin(angle),endX=cx+r*Math.cos(next),endY=cy+r*Math.sin(next);
        const path=makeChartSvgNode('path',{d:`M${cx} ${cy} L${startX} ${startY} A${r} ${r} 0 ${share>.5?1:0} 1 ${endX} ${endY} Z`,fill:row.color,class:'table-maker-pie-slice'});
        path.style.setProperty('--chart-delay',`${index*55}ms`);chart.appendChild(path);
      }
      angle=next;
    });
    if(chartType==='donut'){
      chart.append(makeChartSvgNode('circle',{cx,cy,r:76,class:'table-maker-donut-hole'}),makeChartSvgNode('text',{x:cx,y:cy-3,'text-anchor':'middle',class:'table-maker-donut-total'},Number(total).toLocaleString()),makeChartSvgNode('text',{x:cx,y:cy+22,'text-anchor':'middle',class:'table-maker-donut-caption'},'TOTAL'));
    }
  };
  const renderEditor=()=>{
    dataRows.replaceChildren();
    rows.forEach((row,index)=>{
      const item=document.createElement('div');item.className='table-maker-data-row';
      const color=document.createElement('input');color.type='color';color.value=row.color;color.setAttribute('aria-label',`Color for ${row.label}`);
      const label=document.createElement('input');label.type='text';label.maxLength=28;label.value=row.label;label.placeholder=`Category ${index+1}`;label.setAttribute('aria-label',`Label for row ${index+1}`);
      const value=document.createElement('input');value.type='number';value.min='0';value.max='999999';value.step='any';value.value=String(row.value);value.setAttribute('aria-label',`Value for ${row.label}`);
      const remove=document.createElement('button');remove.type='button';remove.className='table-maker-remove-row';remove.textContent='×';remove.setAttribute('aria-label',`Remove ${row.label}`);
      color.addEventListener('input',()=>{row.color=color.value;renderChart();notifyBoardChanged('table-maker-color')});
      label.addEventListener('input',()=>{row.label=label.value.slice(0,28);renderChart()});
      value.addEventListener('input',()=>{row.value=Math.max(0,Math.min(999999,Number(value.value)||0));renderChart()});
      remove.addEventListener('click',()=>{rows.splice(index,1);renderEditor();renderChart();notifyBoardChanged('table-maker-remove-row')});
      item.append(color,label,value,remove);dataRows.appendChild(item);
    });
    addRowButton.disabled=rows.length>=12;
    addRowButton.textContent=rows.length>=12?'12 row limit':'+ Add Data Row';
  };
  typeButtons.forEach(button=>button.addEventListener('click',()=>{
    chartType=['bar','line','pie','donut'].includes(button.dataset.chartType)?button.dataset.chartType:'bar';
    m.dataset.chartType=chartType;typeButtons.forEach(item=>{const active=item===button;item.classList.toggle('is-active',active);item.setAttribute('aria-pressed',String(active))});renderChart();notifyBoardChanged('table-maker-type');
  }));
  dataToggle.addEventListener('click',()=>{setEditorOpen(!editorOpen);notifyBoardChanged('table-maker-editor')});
  m.querySelector('.table-maker-editor-close').addEventListener('click',()=>{setEditorOpen(false);notifyBoardChanged('table-maker-editor')});
  addRowButton.addEventListener('click',()=>{
    if(rows.length>=12)return;
    rows.push({label:`Category ${rows.length+1}`,value:10,color:TABLE_MAKER_COLORS[rows.length%TABLE_MAKER_COLORS.length]});renderEditor();renderChart();notifyBoardChanged('table-maker-add-row');
    requestAnimationFrame(()=>{const field=dataRows.lastElementChild?.querySelector('input[type="text"]');if(field){enterModuleTextEdit(field);field.select()}});
  });
  m.querySelector('.table-maker-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.table-maker-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.table-maker-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));
  m._boardGetState=()=>({chartType,editorOpen,rows:rows.map(row=>({...row}))});
  m._boardSetState=state=>{
    rows=normalizeRows(state?.rows);if(!rows.length&&Array.isArray(state?.rows))rows=[];
    chartType=['bar','line','pie','donut'].includes(state?.chartType)?state.chartType:'bar';
    editorOpen=state?.editorOpen!==false;typeButtons.forEach(button=>{const active=button.dataset.chartType===chartType;button.classList.toggle('is-active',active);button.setAttribute('aria-pressed',String(active))});m.dataset.chartType=chartType;setEditorOpen(editorOpen);renderEditor();renderChart();
  };
  typeButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.chartType===chartType)));setEditorOpen(true);renderEditor();renderChart();
}

function setupTallyChart(m){
  const list=m.querySelector('.tally-chart-rows');
  const empty=m.querySelector('.tally-chart-empty');
  const totalNode=m.querySelector('.tally-chart-total strong');
  const sortButton=m.querySelector('.tally-chart-sort');
  const addButton=m.querySelector('.tally-chart-add');
  const resetButton=m.querySelector('.tally-chart-reset');
  const viewButtons=[...m.querySelectorAll('[data-tally-view]')];
  let view='tallies',sort='added';
  let rows=[
    {label:'Option A',count:3,color:TABLE_MAKER_COLORS[0]},
    {label:'Option B',count:5,color:TABLE_MAKER_COLORS[1]},
    {label:'Option C',count:2,color:TABLE_MAKER_COLORS[3]}
  ];
  const normalizeRows=value=>(Array.isArray(value)?value:[]).slice(0,16).map((row,index)=>({label:String(row?.label||`Category ${index+1}`).slice(0,28),count:Math.max(0,Math.min(999,Math.round(Number(row?.count)||0))),color:/^#[0-9a-f]{6}$/i.test(String(row?.color||''))?String(row.color):TABLE_MAKER_COLORS[index%TABLE_MAKER_COLORS.length]}));
  const renderTallies=(target,count)=>{
    target.replaceChildren();
    if(!count){const hint=document.createElement('small');hint.textContent='Click to tally';target.appendChild(hint);return}
    for(let remaining=count;remaining>0;remaining-=5){
      const amount=Math.min(5,remaining),group=document.createElement('span');group.className=`tally-mark-group${amount===5?' is-five':''}`;
      for(let index=0;index<Math.min(4,amount);index++)group.appendChild(document.createElement('i'));
      if(amount===5)group.appendChild(document.createElement('b'));
      target.appendChild(group);
    }
  };
  const updateTotal=()=>{totalNode.textContent=rows.reduce((sum,row)=>sum+row.count,0).toLocaleString()};
  const renderRows=()=>{
    list.replaceChildren();empty.hidden=rows.length>0;list.hidden=rows.length===0;updateTotal();addButton.disabled=rows.length>=16;addButton.textContent=rows.length>=16?'16 category limit':'+ Add Category';resetButton.disabled=!rows.some(row=>row.count>0);
    const ordered=rows.map((row,index)=>({row,index}));if(sort==='highest')ordered.sort((a,b)=>b.row.count-a.row.count||a.index-b.index);
    const max=Math.max(1,...rows.map(row=>row.count));
    ordered.forEach(({row,index},visualIndex)=>{
      const item=document.createElement('div');item.className='tally-chart-row';item.style.setProperty('--tally-color',row.color);item.style.setProperty('--tally-delay',`${visualIndex*35}ms`);
      const category=document.createElement('div');category.className='tally-chart-category';
      const color=document.createElement('input');color.type='color';color.value=row.color;color.setAttribute('aria-label',`Color for ${row.label}`);
      const label=document.createElement('input');label.type='text';label.maxLength=28;label.value=row.label;label.setAttribute('aria-label',`Tally category ${index+1}`);
      category.append(color,label);
      let display;
      if(view==='bars'){
        display=document.createElement('div');display.className='tally-chart-bar';display.innerHTML='<span></span>';display.querySelector('span').style.width=`${(row.count/max)*100}%`;
      }else{
        display=document.createElement('button');display.type='button';display.className='tally-chart-marks';display.setAttribute('aria-label',`Add one tally to ${row.label}`);renderTallies(display,row.count);
        display.addEventListener('click',()=>adjust(index,1));
      }
      const count=document.createElement('strong');count.className='tally-chart-count';count.textContent=String(row.count);
      const actions=document.createElement('div');actions.className='tally-chart-row-actions';
      const minus=document.createElement('button');minus.type='button';minus.textContent='−';minus.disabled=row.count===0;minus.setAttribute('aria-label',`Remove one tally from ${row.label}`);
      const plus=document.createElement('button');plus.type='button';plus.textContent='+';plus.setAttribute('aria-label',`Add one tally to ${row.label}`);
      const remove=document.createElement('button');remove.type='button';remove.className='tally-chart-remove';remove.textContent='×';remove.setAttribute('aria-label',`Remove ${row.label}`);
      minus.addEventListener('click',()=>adjust(index,-1));plus.addEventListener('click',()=>adjust(index,1));remove.addEventListener('click',()=>{rows.splice(index,1);renderRows();notifyBoardChanged('tally-remove-category')});
      color.addEventListener('input',()=>{row.color=color.value;item.style.setProperty('--tally-color',row.color);notifyBoardChanged('tally-color')});
      label.addEventListener('input',()=>{row.label=label.value.slice(0,28)});
      actions.append(minus,plus,remove);item.append(category,display,count,actions);list.appendChild(item);
    });
  };
  const adjust=(index,amount)=>{const row=rows[index];if(!row)return;row.count=Math.max(0,Math.min(999,row.count+amount));renderRows();notifyBoardChanged('tally-count')};
  viewButtons.forEach(button=>button.addEventListener('click',()=>{view=button.dataset.tallyView==='bars'?'bars':'tallies';m.dataset.tallyView=view;viewButtons.forEach(item=>{const active=item===button;item.classList.toggle('is-active',active);item.setAttribute('aria-pressed',String(active))});renderRows();notifyBoardChanged('tally-view')}));
  sortButton.addEventListener('click',()=>{sort=sort==='added'?'highest':'added';m.dataset.tallySort=sort;sortButton.lastChild.textContent=sort==='highest'?' Highest First':' Added Order';sortButton.classList.toggle('is-active',sort==='highest');sortButton.setAttribute('aria-pressed',String(sort==='highest'));renderRows();notifyBoardChanged('tally-sort')});
  addButton.addEventListener('click',()=>{
    if(rows.length>=16)return;rows.push({label:`Category ${rows.length+1}`,count:0,color:TABLE_MAKER_COLORS[rows.length%TABLE_MAKER_COLORS.length]});sort='added';m.dataset.tallySort=sort;sortButton.lastChild.textContent=' Added Order';sortButton.classList.remove('is-active');renderRows();notifyBoardChanged('tally-add-category');
    requestAnimationFrame(()=>{const field=list.lastElementChild?.querySelector('.tally-chart-category input[type="text"]');if(field){enterModuleTextEdit(field);field.select()}});
  });
  resetButton.addEventListener('click',()=>{rows.forEach(row=>row.count=0);renderRows();notifyBoardChanged('tally-reset')});
  m.querySelector('.tally-chart-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.tally-chart-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.tally-chart-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));
  m._boardGetState=()=>({view,sort,rows:rows.map(row=>({...row}))});
  m._boardSetState=state=>{rows=normalizeRows(state?.rows);view=state?.view==='bars'?'bars':'tallies';sort=state?.sort==='highest'?'highest':'added';m.dataset.tallyView=view;m.dataset.tallySort=sort;viewButtons.forEach(button=>{const active=button.dataset.tallyView===view;button.classList.toggle('is-active',active);button.setAttribute('aria-pressed',String(active))});sortButton.lastChild.textContent=sort==='highest'?' Highest First':' Added Order';sortButton.classList.toggle('is-active',sort==='highest');sortButton.setAttribute('aria-pressed',String(sort==='highest'));renderRows()};
  viewButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.tallyView===view)));sortButton.setAttribute('aria-pressed','false');renderRows();
}

function setupTodo(m){
  const list=m.querySelector('.todo-list'),add=m.querySelector('.todo-add');
  m.querySelector('.todo-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));m.querySelector('.todo-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));m.querySelector('.todo-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));
  const addRow=(value='New step',checked=false,focus=true,afterRow=null)=>{
    const row=document.createElement('div');
    row.className='todo-row';
    row.innerHTML='<input class="todo-check" type="checkbox" aria-label="Complete step"><input class="todo-item-text" type="text" aria-label="Checklist step"><button class="todo-remove" type="button" aria-label="Remove step">×</button>';
    const check=row.querySelector('.todo-check'),text=row.querySelector('.todo-item-text');
    text.value=value;
    check.checked=Boolean(checked);
    row.classList.toggle('is-done',check.checked);
    check.addEventListener('change',()=>row.classList.toggle('is-done',check.checked));
    text.addEventListener('keydown',event=>{
      if(event.key!=='Enter'||event.isComposing)return;
      event.preventDefault();
      addRow('',false,true,row);
      notifyBoardChanged('todo-add-step');
    });
    row.querySelector('.todo-remove').addEventListener('click',()=>row.remove());
    if(afterRow?.parentElement===list)afterRow.after(row);
    else list.appendChild(row);
    if(focus)requestAnimationFrame(()=>{
      enterModuleTextEdit(text);
      if(value)text.select();
    });
  };
  add.addEventListener('click',()=>addRow());
  addRow('First step',false,false);
  m._boardGetState=()=>({rows:[...list.querySelectorAll('.todo-row')].map(row=>({text:row.querySelector('.todo-item-text')?.value||'',checked:Boolean(row.querySelector('.todo-check')?.checked)}))});
  m._boardSetState=state=>{list.replaceChildren();const rows=Array.isArray(state?.rows)?state.rows:[];if(rows.length)rows.forEach(row=>addRow(row.text||'',Boolean(row.checked),false));};
}

workspace.addEventListener('dragover',e=>{const types=[...e.dataTransfer.types];if(types.includes('Files')||types.includes('text/uri-list')||types.includes('text/html')||types.includes('text/plain'))e.preventDefault()});
workspace.addEventListener('drop',e=>{if(e.target.closest('.image-module'))return;const src=getDraggedImageSource(e.dataTransfer);if(!src)return;e.preventDefault();const p=screenToBoard(e.clientX,e.clientY);const m=createModule('image',p.x,p.y);if(src.file)m?._setImage?.(src.file);else if(src.url)m?._setImageUrl?.(src.url)});

const THEME_STORAGE_KEY='modular-space-theme';
const TEACHERTILES_THEMES=new Set([
  'light','dark','gray',
  'pastel-red','pastel-yellow','pastel-green','pastel-blue','pastel-lilac',
  'polka-berry','polka-sunshine','polka-mint','polka-sky','polka-lavender',
  'programmer-green','programmer-red','programmer-yellow','programmer-blue',
  'wood-oak','wood-spruce','wood-redwood','wood-cherry',
  'notebook-red','notebook-blue','notebook-black',
  'cardboard-kraft','cardboard-white','cardboard-blue','cardboard-rose',
  'metal-copper','metal-iron','metal-dark-steel','metal-cobalt',
  'cosmos-nebula','cosmos-pulsar','cosmos-milky-way','cosmos-red-dwarf',
  'corkboard-red','corkboard-blue','corkboard-green','corkboard-gold'
]);
const THEME_BODY_CLASSES=[
  'dark','theme-gray',
  'theme-pastel-red','theme-pastel-yellow','theme-pastel-green','theme-pastel-blue','theme-pastel-lilac',
  'theme-polka-berry','theme-polka-sunshine','theme-polka-mint','theme-polka-sky','theme-polka-lavender',
  'theme-programmer-green','theme-programmer-red','theme-programmer-yellow','theme-programmer-blue',
  'theme-wood-oak','theme-wood-spruce','theme-wood-redwood','theme-wood-cherry',
  'theme-notebook-red','theme-notebook-blue','theme-notebook-black',
  'theme-cardboard-kraft','theme-cardboard-white','theme-cardboard-blue','theme-cardboard-rose',
  'theme-metal-copper','theme-metal-iron','theme-metal-dark-steel','theme-metal-cobalt',
  'theme-cosmos-nebula','theme-cosmos-pulsar','theme-cosmos-milky-way','theme-cosmos-red-dwarf',
  'theme-corkboard-red','theme-corkboard-blue','theme-corkboard-green','theme-corkboard-gold'
];

function updateThemeControls(theme){
  const current=TEACHERTILES_THEMES.has(theme)?theme:'light';
  document.querySelectorAll('[data-theme-choice]').forEach(card=>{
    const selected=card.dataset.themeChoice===current;
    card.classList.toggle('is-selected',selected);
    card.setAttribute('aria-pressed',String(selected));
  });
}

function materialRandomBetween(min,max){return min+Math.random()*(max-min)}
function materialSvgUrl(svg){return`url("data:image/svg+xml,${encodeURIComponent(svg)}")`}

function buildCosmosThemeArtwork(theme){
  const palettes={
    'cosmos-nebula':['#120b24','#7040b1','#dc72ff','#f7efff'],
    'cosmos-pulsar':['#1d0e08','#a84a1b','#ff9a38','#fff1d7'],
    'cosmos-milky-way':['#09101c','#66748f','#eef4ff','#ffffff'],
    'cosmos-red-dwarf':['#1d080b','#962936','#ff596a','#ffe8eb']
  };
  const [base,cloud,glow,star]=palettes[theme]||palettes['cosmos-nebula'];
  const seed=Math.floor(materialRandomBetween(1,9999));
  const stars=Array.from({length:260},()=>{
    const x=materialRandomBetween(8,1192).toFixed(1),y=materialRandomBetween(8,792).toFixed(1);
    const radius=materialRandomBetween(.45,1.65).toFixed(2),opacity=materialRandomBetween(.35,.96).toFixed(2);
    return`<circle cx="${x}" cy="${y}" r="${radius}" fill="${Math.random()>.72?glow:star}" opacity="${opacity}"/>`;
  }).join('');
  const spiralPath='M-175 7C-128-104 66-126 160-42C243 33 115 150-44 116C-157 91-205 7-135-61C-73-121 61-83 109-18C145 31 60 79-18 62C-76 50-89 2-49-27C-17-51 37-31 48 1';
  const swirls=Array.from({length:24},(_,index)=>{
    const x=materialRandomBetween(35,1165).toFixed(1),y=materialRandomBetween(30,770).toFixed(1);
    const rotate=materialRandomBetween(-175,175).toFixed(1),scale=materialRandomBetween(.12,.34).toFixed(2);
    const width=materialRandomBetween(7,16).toFixed(1),opacity=materialRandomBetween(.08,.2).toFixed(2);
    const color=index%3===0?glow:cloud;
    return`<g transform="translate(${x} ${y}) rotate(${rotate}) scale(${scale})" filter="url(#warp)"><path d="${spiralPath}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" opacity="${opacity}" filter="url(#soft)"/><path d="${spiralPath}" fill="none" stroke="${glow}" stroke-width="${materialRandomBetween(1,3).toFixed(1)}" stroke-linecap="round" opacity="${materialRandomBetween(.1,.22).toFixed(2)}"/></g>`;
  }).join('');
  return`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><defs><filter id="warp" x="-45%" y="-45%" width="190%" height="190%"><feTurbulence type="fractalNoise" baseFrequency=".012 .025" numOctaves="2" seed="${seed}" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="22"/></filter><filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter><radialGradient id="shade"><stop stop-color="${base}" stop-opacity="0"/><stop offset="1" stop-color="${base}" stop-opacity=".25"/></radialGradient></defs>${stars}${swirls}<rect width="1200" height="800" fill="url(#shade)" pointer-events="none"/></svg>`;
}

function buildCardboardThemeArtwork(theme){
  const labelColors={'cardboard-kraft':'#fffdf7','cardboard-white':'#fffdf7','cardboard-blue':'#b9dbea','cardboard-rose':'#e8bdc2'};
  const label=labelColors[theme]||labelColors['cardboard-kraft'];
  const ink=theme==='cardboard-blue'?'#274655':theme==='cardboard-rose'?'#5b343a':'#423a32';
  const seed=Math.floor(materialRandomBetween(1,9999));
  const cells=Array.from({length:96},(_,index)=>index).sort(()=>Math.random()-.5).slice(0,64);
  const labels=cells.map(index=>{
    const col=index%12,row=Math.floor(index/12);
    const x=col*100+materialRandomBetween(8,42),y=row*100+materialRandomBetween(9,55);
    const width=materialRandomBetween(28,52),height=materialRandomBetween(17,31),angle=materialRandomBetween(-14,14);
    const scaleX=width/210,scaleY=height/120;
    return`<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle.toFixed(1)}) scale(${scaleX.toFixed(2)} ${scaleY.toFixed(2)})"><rect width="210" height="120" rx="9" fill="${label}" fill-opacity=".9" filter="url(#labelShadow)"/><path d="M21 27h90M21 44h145M21 62h112" stroke="${ink}" stroke-opacity=".38" stroke-width="5" stroke-linecap="round"/><path d="M23 82v23m8-23v23m7-23v23m11-23v23m6-23v23m13-23v23m7-23v23m11-23v23m6-23v23m13-23v23m8-23v23" stroke="${ink}" stroke-opacity=".52" stroke-width="3"/></g>`;
  }).join('');
  return`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><defs><filter id="fiber"><feTurbulence type="fractalNoise" baseFrequency=".018 .11" numOctaves="3" seed="${seed}"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".2"/></feComponentTransfer></filter><filter id="labelShadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#4d2f19" flood-opacity=".2"/></filter></defs><rect width="1200" height="800" filter="url(#fiber)" opacity=".42"/>${labels}</svg>`;
}

function buildCorkboardThemeArtwork(theme){
  const pinColors={'corkboard-red':'#d84b4b','corkboard-blue':'#3f79c8','corkboard-green':'#43a266','corkboard-gold':'#e0ad37'};
  const pin=pinColors[theme]||pinColors['corkboard-red'];
  const seed=Math.floor(materialRandomBetween(1,9999));
  const points=[];
  for(let attempts=0;attempts<2500&&points.length<68;attempts++){
    const point={x:materialRandomBetween(18,1182),y:materialRandomBetween(18,782)};
    if(points.every(other=>Math.hypot(point.x-other.x,point.y-other.y)>72))points.push(point);
  }
  const flecks=Array.from({length:260},()=>`<circle cx="${materialRandomBetween(0,1200).toFixed(1)}" cy="${materialRandomBetween(0,800).toFixed(1)}" r="${materialRandomBetween(.45,1.5).toFixed(1)}" fill="${Math.random()>.5?'#6f4322':'#edc58f'}" opacity="${materialRandomBetween(.1,.28).toFixed(2)}"/>`).join('');
  const pins=points.map(point=>`<g transform="translate(${point.x.toFixed(1)} ${point.y.toFixed(1)}) rotate(${materialRandomBetween(-16,16).toFixed(1)})"><ellipse cy="2.2" rx="4" ry="2.5" fill="#4b2a16" opacity=".25"/><circle r="3.6" fill="${pin}"/><circle cx="-1.1" cy="-1.1" r="1.1" fill="#fff" opacity=".48"/><path d="M0 3.2v4.5" stroke="#6b523f" stroke-width=".8" opacity=".55"/></g>`).join('');
  return`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><defs><filter id="cork"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="4" seed="${seed}"/><feColorMatrix type="saturate" values=".25"/><feComponentTransfer><feFuncA type="linear" slope=".18"/></feComponentTransfer></filter></defs><rect width="1200" height="800" filter="url(#cork)" opacity=".55"/>${flecks}${pins}</svg>`;
}

function applyMaterialThemeArtwork(theme){
  workspace.style.removeProperty('background-image');
  workspace.style.removeProperty('background-size');
  workspace.style.removeProperty('background-repeat');
  workspace.style.removeProperty('background-position');
  let svg='';
  if(theme.startsWith('cosmos-'))svg=buildCosmosThemeArtwork(theme);
  else if(theme.startsWith('cardboard-'))svg=buildCardboardThemeArtwork(theme);
  else if(theme.startsWith('corkboard-'))svg=buildCorkboardThemeArtwork(theme);
  if(!svg)return;
  workspace.style.backgroundImage=materialSvgUrl(svg);
  workspace.style.backgroundSize='100% 100%';
  workspace.style.backgroundRepeat='no-repeat';
  workspace.style.backgroundPosition='center';
}

function applyTeacherTheme(theme,{persist=true}={}){
  const requested=TEACHERTILES_THEMES.has(theme)?theme:'light';
  const next=themeChoiceIsOwned(requested)?requested:'light';
  document.body.classList.remove(...THEME_BODY_CLASSES);
  if(next==='dark')document.body.classList.add('dark');
  else if(next==='gray')document.body.classList.add('theme-gray');
  else if(next!=='light')document.body.classList.add(`theme-${next}`);
  document.body.dataset.theme=next;
  const darkTheme=next==='dark'||next.startsWith('programmer-')||next.startsWith('cosmos-')||next.startsWith('metal-');
  if(darkTheme&&next!=='dark')document.body.classList.add('dark');
  document.documentElement.style.colorScheme=darkTheme?'dark':'light';
  applyMaterialThemeArtwork(next);
  if(persist)localStorage.setItem(THEME_STORAGE_KEY,next);
  updateThemeControls(next);
  if(persist)notifyBoardChanged('theme');
}

const savedTheme=localStorage.getItem(THEME_STORAGE_KEY);
applyTeacherTheme(TEACHERTILES_THEMES.has(savedTheme)?savedTheme:'light',{persist:false});

fullscreenToggle.addEventListener('click',async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen()}catch{}});
document.addEventListener('fullscreenchange',()=>{fullscreenToggle.childNodes[0].nodeValue=document.fullscreenElement?'↙':'⛶'});
window.addEventListener('resize',()=>document.querySelectorAll('.module').forEach(m=>{m.style.left=`${clamp(m.offsetLeft,0,Math.max(0,BOARD_WIDTH-m.offsetWidth))}px`;m.style.top=`${clamp(m.offsetTop,0,Math.max(0,BOARD_HEIGHT-m.offsetHeight))}px`}));

function createStickerModule({src='',emoji='',name='Sticker',aspect=1},clientX,clientY,{record=true,animate=true,objectId=''}={}){
  if(!src&&!emoji)return null;
  const isFlag=/flagcdn\.io\/flags\//i.test(src);
  const isTextSticker=Boolean(emoji&&/^[A-Za-z0-9]+$/.test(emoji));
  const p=screenToBoard(clientX,clientY);
  const ratio=emoji?1:(Number.isFinite(aspect)&&aspect>0?aspect:1);
  let width=180,height=180;
  if(ratio>=1){width=ratio>2?230:180;height=width/ratio}else{height=180;width=height*ratio}
  width=Math.max(64,width);
  height=Math.max(64,height);
  const m=document.createElement('section');
  m.className=`module sticker-module${isFlag?' sticker-module--flag':''}${isTextSticker?' sticker-module--text':''}${animate?' sticker-placed':''}`;
  m.dataset.type='sticker';
  m.dataset.stickerSrc=src;
  m.dataset.stickerEmoji=emoji;
  m.dataset.stickerName=name||'Sticker';
  m.dataset.stickerAspect=String(ratio);
  if(objectId)m.dataset.boardObjectId=objectId;
  m.dataset.stickerRotation='0';
  m._stickerRatio=ratio;
  m.setAttribute('aria-label',`${name||'Sticker'} sticker`);
  m.style.width=`${width}px`;
  m.style.height=`${height}px`;
  m.style.left=`${clamp(p.x-width/2,0,BOARD_WIDTH-width)}px`;
  m.style.top=`${clamp(p.y-height/2,0,BOARD_HEIGHT-height)}px`;

  const drag=document.createElement('div');
  drag.className='module-drag-handle';
  drag.setAttribute('aria-hidden','true');
  const del=document.createElement('button');
  del.className='module-delete';del.type='button';del.setAttribute('aria-label','Delete sticker');del.textContent='×';
  const art=document.createElement('div');art.className='sticker-art';
  const visual=document.createElement('div');visual.className=`sticker-visual${emoji?' sticker-visual--emoji':''}${isFlag?' sticker-visual--flag':''}${isTextSticker?' sticker-visual--text':''}`;
  if(emoji){
    const glyph=document.createElement('span');
    glyph.className=`sticker-emoji${isTextSticker?' sticker-emoji--text':''}`;glyph.setAttribute('aria-hidden','true');glyph.textContent=emoji;
    visual.appendChild(glyph);
  }else{
    const img=document.createElement('img');img.src=src;img.alt=name||'Sticker';img.draggable=false;
    visual.appendChild(img);
  }
  art.appendChild(visual);
  const pop=document.createElement('span');pop.className='sticker-stick-pop';pop.setAttribute('aria-hidden','true');
  m.append(drag,del,art,pop);
  workspace.appendChild(m);
  bringToFront(m);
  setupCommon(m);
  setupStickerTransformControls(m);
  if(record)recordHistory({type:'add',elements:[m]});
  if(animate)setTimeout(()=>m.classList.remove('sticker-placed'),620);
  return m;
}

function setupShelfStickerDrag(item,shelfShell){
  if(!item||item.dataset.stickerDragReady)return;
  item.dataset.stickerDragReady='true';
  item.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    const drawer=item.closest('.sticker-pack-drawer');
    const owner=drawer?.id?document.querySelector(`[data-sticker-pack][aria-controls="${CSS.escape(drawer.id)}"]`):null;
    if(owner?.dataset.shopLocked==='true')return;
    const src=item.dataset.stickerSrc||'';
    const emoji=item.dataset.stickerEmoji||'';
    const isTextSticker=Boolean(emoji&&/^[A-Za-z0-9]+$/.test(emoji));
    const isFlag=/flagcdn\.io\/flags\//i.test(src);
    const name=item.dataset.stickerName||'Sticker';
    const preview=item.querySelector('img');
    const aspect=emoji?1:(preview?.naturalWidth&&preview?.naturalHeight?preview.naturalWidth/preview.naturalHeight:1);
    if(!src&&!emoji)return;
    e.preventDefault();
    e.stopPropagation();
    item.setPointerCapture(e.pointerId);
    const startX=e.clientX,startY=e.clientY;
    let dragging=false;
    let ghost=null;
    let canDrop=false;

    const ensureGhost=()=>{
      if(ghost)return;
      ghost=document.createElement('div');
      ghost.className=`sticker-drag-ghost${emoji?' sticker-drag-ghost--emoji':''}${isFlag?' sticker-drag-ghost--flag':''}${isTextSticker?' sticker-drag-ghost--text':''}`;
      if(emoji){
        const glyph=document.createElement('span');glyph.className=`sticker-emoji sticker-emoji--ghost${isTextSticker?' sticker-emoji--text':''}`;glyph.textContent=emoji;ghost.appendChild(glyph);
      }else{
        const img=document.createElement('img');img.src=src;img.alt='';img.draggable=false;ghost.appendChild(img);
      }
      document.body.appendChild(ghost);
    };
    const updateGhost=ev=>{
      ensureGhost();
      ghost.style.left=`${ev.clientX}px`;
      ghost.style.top=`${ev.clientY}px`;
      const shellRect=shelfShell.getBoundingClientRect();
      const insideShelf=ev.clientX>=shellRect.left&&ev.clientX<=shellRect.right&&ev.clientY>=shellRect.top&&ev.clientY<=shellRect.bottom;
      const blocked=document.elementsFromPoint(ev.clientX,ev.clientY).some(el=>el.closest?.('.workspace-controls,.workspace-upcoming-controls,.context-menu'));
      canDrop=!insideShelf&&!blocked&&ev.clientX>=0&&ev.clientX<=innerWidth&&ev.clientY>=0&&ev.clientY<=innerHeight;
      ghost.classList.toggle('can-drop',canDrop);
    };
    const move=ev=>{
      if(!dragging&&Math.hypot(ev.clientX-startX,ev.clientY-startY)<5)return;
      if(!dragging){
        dragging=true;
        item.classList.add('is-dragging');
        document.body.classList.add('is-dragging-shelf-sticker');
      }
      updateGhost(ev);
    };
    const cleanup=()=>{
      item.classList.remove('is-dragging');
      document.body.classList.remove('is-dragging-shelf-sticker');
      ghost?.remove();
      item.removeEventListener('pointermove',move);
      item.removeEventListener('pointerup',end);
      item.removeEventListener('pointercancel',cancel);
    };
    const end=ev=>{
      if(dragging&&canDrop)createStickerModule({src,emoji,name,aspect},ev.clientX,ev.clientY);
      cleanup();
    };
    const cancel=()=>cleanup();
    item.addEventListener('pointermove',move);
    item.addEventListener('pointerup',end);
    item.addEventListener('pointercancel',cancel);
  });
}

function setupCollectionShelf(){
  const shelf=document.getElementById('asset-shelf');
  const title=document.getElementById('asset-shelf-title');
  const closeButton=document.getElementById('asset-shelf-close');
  const themeButton=document.getElementById('theme-shelf-toggle');
  const stickerButton=document.getElementById('sticker-shelf-toggle');
  const tileSkinsButton=document.getElementById('tile-skins-shelf-toggle');
  const cursorsButton=document.getElementById('cursors-shelf-toggle');
  const themePanel=document.getElementById('theme-shelf-content');
  const stickerPanel=document.getElementById('sticker-shelf-content');
  const tileSkinsPanel=document.getElementById('tile-skins-shelf-content');
  const tileSkinsSearch=document.getElementById('tile-skins-search');
  const tileSkinsSearchClear=document.getElementById('tile-skins-search-clear');
  const tileSkinsSort=document.getElementById('tile-skins-sort');
  const tileSkinsStatus=document.getElementById('tile-skins-search-status');
  const tileSkinsGroups=document.getElementById('tile-skins-groups');
  const cursorsPanel=document.getElementById('cursors-shelf-content');
  const cursorsGrid=document.getElementById('cursors-shelf-grid');
  const cursorsStatus=document.getElementById('cursors-shelf-status');
  const stickerSearch=document.getElementById('sticker-shelf-search');
  const stickerSearchClear=document.getElementById('sticker-shelf-search-clear');
  const stickerSearchStatus=document.getElementById('sticker-shelf-search-status');
  const packs=[...document.querySelectorAll('[data-theme-pack]')];
  const stickerPacks=[...document.querySelectorAll('[data-sticker-pack]')];
  const stickerItems=[...document.querySelectorAll('[data-sticker-src],[data-sticker-emoji]')];
  const stickerPackTags={
    'default-sticker-drawer':'classroom teacher school sticker stickers',
    'emoji-sticker-drawer':'emoji emojis face faces reaction reactions expression expressions celebration',
    'nature-emojis-sticker-drawer':'nature outdoors plant plants botanical botanicals weather sky',
    'weather-emojis-sticker-drawer':'weather forecast climate sun sunny cloud cloudy rain rainy storm thunder lightning snow snowy fog foggy wind windy tornado rainbow',
    'animal-emojis-sticker-drawer':'animal animals pet pets wildlife insect insects critter critters',
    'more-faces-sticker-drawer':'emoji emojis face faces reaction reactions expression expressions emotion emotions',
    'symbols-sticker-drawer':'symbol symbols classroom math mark marks sign signs',
    'food-sticker-drawer':'food foods snack snacks meal meals lunch dessert desserts treat treats',
    'colored-hearts-sticker-drawer':'heart hearts love color colors colored',
    'decorative-hearts-sticker-drawer':'heart hearts love decorative decoration decorations',
    'country-flags-sticker-drawer':'country countries nation nations flag flags geography world international'
  };
  stickerItems.forEach(item=>{
    const drawerId=item.closest('.sticker-pack-drawer')?.id||'';
    item.dataset.stickerTags=[item.dataset.stickerTags||'',stickerPackTags[drawerId]||''].join(' ').trim();
  });
  const bottomTray=document.querySelector('.workspace-upcoming-controls');
  const shelfScroll=themePanel?.querySelector('.asset-shelf__scroll');
  const stickerScroll=stickerPanel?.querySelector('.asset-shelf__scroll');
  stickerPanel?.querySelectorAll('.sticker-pack-drawer').forEach(drawer=>drawer.style.setProperty('--sticker-count',String(drawer.querySelectorAll('.sticker-shelf-item').length)));
  const shelfShell=shelf.querySelector('.asset-shelf__shell');
  if(!shelf||!title||!closeButton||!themeButton||!stickerButton||!tileSkinsButton||!cursorsButton||!themePanel||!stickerPanel||!tileSkinsPanel||!cursorsPanel||!shelfShell||!packs.length)return;

  let activeShelf=null;
  let activePack=null;
  let activeFan=null;
  let activeStickerPack=null;
  let activeStickerDrawer=null;

  const syncCollectionOwnership=()=>{
    [...packs,...stickerPacks].forEach(pack=>{
      const owned=collectionPackIsOwned(pack);
      const wrapper=pack.closest('.theme-pack-wrap,.sticker-pack-wrap');
      pack.dataset.shopLocked=String(!owned);
      pack.setAttribute('aria-disabled',String(!owned));
      wrapper?.classList.toggle('is-shop-locked',!owned);
      const drawerId=pack.getAttribute('aria-controls');
      document.getElementById(drawerId)?.classList.toggle('is-shop-locked',!owned);
      let badge=wrapper?.querySelector(':scope > .collection-pack-lock');
      if(!badge&&wrapper){
        badge=document.createElement('span');badge.className='collection-pack-lock';badge.setAttribute('aria-hidden','true');wrapper.appendChild(badge);
      }
      if(badge){badge.textContent=owned?'✓ Owned':'🔒 Shop';badge.hidden=owned}
    });
    if(!themeChoiceIsOwned(document.body.dataset.theme||'light'))applyTeacherTheme('light');
  };

  const openLockedCollection=pack=>{
    closeShelf();
    window.TeacherTilesShop?.openPage(pack.matches('[data-theme-pack]')?'themes':'stickers');
  };

  const makeClassicMagnifierArtwork=()=>{
    const art=document.createElement('span');
    art.className='classic-magnifier-art';
    const lens=document.createElement('i');
    const handle=document.createElement('b');
    const value=document.createElement('em');
    value.textContent='2×';
    handle.appendChild(value);
    art.append(lens,handle);
    return art;
  };

  const makeTileSkinArtwork=skin=>{
    if(skin.id==='magnifier-classic')return makeClassicMagnifierArtwork();
    const art=document.createElement('span');
    art.className=`tile-skin-art tile-skin-art--${skin.id}`;
    if(skin.id==='youtube-retro-tv')art.innerHTML='<i></i><b><em></em><em></em></b><small></small>';
    else if(skin.id==='todo-clipboard')art.innerHTML='<i><em></em><em></em><em></em></i><b></b>';
    else if(skin.id==='calendar-paper-stack')art.innerHTML='<i></i><b><em></em><em></em><em></em><em></em><em></em><em></em></b>';
    return art;
  };

  const setupTileSkinDrag=(button,skin)=>{
    button.addEventListener('pointerdown',event=>{
      if(event.button!==0||!tileSkinIsOwned(skin))return;
      event.preventDefault();
      event.stopPropagation();
      button.setPointerCapture(event.pointerId);
      const startX=event.clientX,startY=event.clientY;
      let dragging=false,canDrop=false,ghost=null;
      const ensureGhost=()=>{
        if(ghost)return;
        ghost=document.createElement('div');
        ghost.className='tile-skin-drag-ghost';
        ghost.appendChild(makeTileSkinArtwork(skin));
        document.body.appendChild(ghost);
      };
      const updateGhost=ev=>{
        ensureGhost();
        ghost.style.left=`${ev.clientX}px`;
        ghost.style.top=`${ev.clientY}px`;
        const shellRect=shelfShell.getBoundingClientRect();
        const insideShelf=ev.clientX>=shellRect.left&&ev.clientX<=shellRect.right&&ev.clientY>=shellRect.top&&ev.clientY<=shellRect.bottom;
        const blocked=document.elementsFromPoint(ev.clientX,ev.clientY).some(el=>el.closest?.('.workspace-controls,.workspace-upcoming-controls,.context-menu,.shop-modal'));
        canDrop=!insideShelf&&!blocked&&ev.clientX>=0&&ev.clientX<=innerWidth&&ev.clientY>=0&&ev.clientY<=innerHeight;
        ghost.classList.toggle('can-drop',canDrop);
      };
      const move=ev=>{
        if(!dragging&&Math.hypot(ev.clientX-startX,ev.clientY-startY)<5)return;
        if(!dragging){dragging=true;button.classList.add('is-dragging');document.body.classList.add('is-dragging-tile-skin')}
        updateGhost(ev);
      };
      const cleanup=()=>{
        button.classList.remove('is-dragging');
        document.body.classList.remove('is-dragging-tile-skin');
        ghost?.remove();
        button.removeEventListener('pointermove',move);
        button.removeEventListener('pointerup',end);
        button.removeEventListener('pointercancel',cancel);
      };
      const end=ev=>{
        if(dragging&&canDrop){
          const point=screenToBoard(ev.clientX,ev.clientY);
          createModule(skin.tileType,point.x,point.y,{tileSkin:skin.id});
          closeShelf();
        }
        cleanup();
      };
      const cancel=()=>cleanup();
      button.addEventListener('pointermove',move);
      button.addEventListener('pointerup',end);
      button.addEventListener('pointercancel',cancel);
    });
  };

  const normalizeTileSkinSearch=value=>String(value||'').toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim();
  const renderTileSkinShelf=()=>{
    if(!tileSkinsGroups)return;
    const query=normalizeTileSkinSearch(tileSkinsSearch?.value);
    const terms=query.split(/\s+/).filter(Boolean);
    const sort=tileSkinsSort?.value||'tile';
    const matching=TILE_SKIN_CATALOG.filter(skin=>{
      const haystack=normalizeTileSkinSearch(`${skin.name} ${skin.tileLabel} ${skin.description} ${skin.tags}`);
      return terms.every(term=>haystack.includes(term));
    }).sort((a,b)=>sort==='newest'?(b.released-a.released)||a.name.localeCompare(b.name):a.name.localeCompare(b.name));
    const grouped=new Map();
    matching.forEach(skin=>{if(!grouped.has(skin.tileType))grouped.set(skin.tileType,[]);grouped.get(skin.tileType).push(skin)});
    const groups=[...grouped.entries()].sort((a,b)=>a[1][0].tileLabel.localeCompare(b[1][0].tileLabel));
    tileSkinsGroups.replaceChildren();
    groups.forEach(([type,skins])=>{
      const section=document.createElement('section');
      section.className='tile-skin-group';
      section.dataset.tileSkinGroup=type;
      const heading=document.createElement('header');
      const headingCopy=document.createElement('div');
      const title=document.createElement('strong');title.textContent=skins[0].tileLabel;
      const count=document.createElement('small');count.textContent=`${skins.length} ${skins.length===1?'skin':'skins'}`;
      headingCopy.append(title,count);
      const tileType=document.createElement('span');tileType.textContent='Tile type';
      heading.append(headingCopy,tileType);
      const grid=document.createElement('div');grid.className='tile-skin-grid';
      skins.forEach(skin=>{
        const owned=tileSkinIsOwned(skin);
        const active=getDefaultTileSkins()[skin.tileType]===skin.id&&owned;
        const card=document.createElement('article');
        card.className=`tile-skin-card${owned?' is-owned':' is-locked'}${active?' is-default':''}`;
        card.dataset.tileSkin=skin.id;
        const drag=document.createElement('button');
        drag.type='button';drag.className='tile-skin-card__drag';drag.disabled=!owned;
        drag.setAttribute('aria-label',owned?`Drag ${skin.name} ${skin.tileLabel} skin onto the board`:`${skin.name} is available in the Shop`);
        const preview=document.createElement('span');preview.className='tile-skin-card__preview';preview.appendChild(makeTileSkinArtwork(skin));
        if(!owned){const lock=document.createElement('span');lock.className='collection-pack-lock';lock.textContent='🔒 Shop';lock.setAttribute('aria-hidden','true');preview.appendChild(lock)}
        const copy=document.createElement('span');copy.className='tile-skin-card__copy';
        const name=document.createElement('strong');name.textContent=skin.name;
        const hint=document.createElement('small');hint.textContent=owned?'Drag onto the board':`For the ${skin.tileLabel} tile`;
        copy.append(name,hint);drag.append(preview,copy);
        const actions=document.createElement('div');actions.className='tile-skin-card__actions';
        const badge=document.createElement('span');badge.className='tile-skin-owned-badge';badge.textContent='Owned';
        const action=document.createElement('button');action.type='button';
        if(owned){
          action.className='tile-skin-default-toggle';
          action.setAttribute('aria-pressed',String(active));
          action.setAttribute('aria-label',`${active?'Stop using':'Use'} ${skin.name} for all new ${skin.tileLabel} tiles`);
          const track=document.createElement('i');const label=document.createElement('b');label.textContent='All Tiles';
          action.append(track,label);
          action.addEventListener('click',event=>{event.stopPropagation();setDefaultTileSkin(skin.tileType,active?'':skin.id)});
        }else{
          action.className='tile-skin-shop-link';action.textContent='View in Shop';
          action.addEventListener('click',()=>{closeShelf();window.TeacherTilesShop?.openPage('tile-skins')});
        }
        if(owned)actions.append(badge,action);else actions.append(action);
        card.append(drag,actions);
        grid.appendChild(card);
        setupTileSkinDrag(drag,skin);
        drag.addEventListener('keydown',event=>{
          if(!owned||(event.key!=='Enter'&&event.key!==' '))return;
          event.preventDefault();
          const view=visibleBoardBounds();
          createModule(skin.tileType,(view.left+view.right)/2,(view.top+view.bottom)/2,{tileSkin:skin.id});
          closeShelf();
        });
      });
      section.append(heading,grid);tileSkinsGroups.appendChild(section);
    });
    if(!matching.length){
      const empty=document.createElement('div');empty.className='tile-skins-no-results';
      empty.innerHTML='<strong>No Tile Skins found</strong><small>Try another skin name or tile type.</small>';
      tileSkinsGroups.appendChild(empty);
    }
    const ownedCount=matching.filter(tileSkinIsOwned).length;
    if(tileSkinsStatus)tileSkinsStatus.textContent=query?`${matching.length} ${matching.length===1?'skin':'skins'} found`:`${matching.length} ${matching.length===1?'skin':'skins'} · ${ownedCount} owned`;
    if(tileSkinsSearchClear)tileSkinsSearchClear.hidden=!query;
  };

  const renderCursorShelf=()=>{
    if(!cursorsGrid)return;
    const saved=cursorById(localStorage.getItem(ACTIVE_CURSOR_KEY)||'default');
    const active=cursorIsOwned(saved)?saved.id:'default';
    if(active!==saved.id)applyAppCursor('default');
    cursorsGrid.replaceChildren();
    const makeArrow=(cursor,state='normal')=>{
      if(cursor.id==='default'){
        const arrow=document.createElement('img');arrow.className='cursor-arrow-art cursor-arrow-art--image cursor-arrow-art--default';arrow.src='assets/cursors/default-normal.png?v=1';arrow.alt='';arrow.draggable=false;return arrow;
      }
      const arrow=document.createElement('img');arrow.className=`cursor-arrow-art cursor-arrow-art--image cursor-arrow-art--${state}`;arrow.src=`assets/cursors/${cursor.id}-${state}.png?v=3`;arrow.alt='';arrow.draggable=false;return arrow;
    };
    const makePack=(label,detail,cursors,{locked=false,onClick}={})=>{
      const wrapper=document.createElement('div');wrapper.className=`cursor-pack-wrap${locked?' is-shop-locked':''}`;
      const pack=document.createElement('button');pack.type='button';pack.className='theme-pack cursor-pack';pack.setAttribute('aria-expanded','false');
      const stack=document.createElement('span');stack.className='cursor-pack__stack';stack.setAttribute('aria-hidden','true');
      const previewStates=['open','point','normal','grab','point'];
      cursors.forEach((cursor,index)=>stack.appendChild(makeArrow(cursor,cursors.length>1?previewStates[index%previewStates.length]:'normal')));
      const meta=document.createElement('span');meta.className='theme-pack__meta';meta.innerHTML=`<strong>${label}</strong><small>${detail}</small>`;
      pack.append(stack,meta);
      if(cursors.length>1){const chevron=document.createElement('span');chevron.className='theme-pack__chevron';chevron.textContent='⌃';chevron.setAttribute('aria-hidden','true');pack.appendChild(chevron)}
      if(locked){const badge=document.createElement('span');badge.className='collection-pack-lock';badge.textContent='🔒 Shop';badge.setAttribute('aria-hidden','true');wrapper.append(pack,badge)}else wrapper.appendChild(pack);
      pack.addEventListener('click',onClick);
      return{wrapper,pack};
    };
    const defaultCursor=CURSOR_CATALOG[0];
    const defaultPack=makePack('Default Cursor',active==='default'?'Equipped':'System pointer',[defaultCursor],{onClick:()=>applyAppCursor('default')});
    if(active==='default'){const check=document.createElement('span');check.className='cursor-pack__check';check.textContent='✓';defaultPack.wrapper.appendChild(check)}
    cursorsGrid.appendChild(defaultPack.wrapper);

    const colors=CURSOR_CATALOG.slice(1);
    const packOwned=getOwnedShopProducts().has(CURSOR_COLOR_PACK_PRODUCT_ID);
    let drawer=null;
    const colorPack=makePack('Colored Cursors',packOwned?'5 cursor colors':'Available in Shop',colors,{locked:!packOwned,onClick:()=>{
      if(!packOwned){closeShelf();window.TeacherTilesShop?.openPage('cursors');return}
      const open=!drawer.classList.contains('is-open');
      drawer.classList.toggle('is-open',open);colorPack.pack.classList.toggle('is-open',open);colorPack.pack.setAttribute('aria-expanded',String(open));
    }});
    drawer=document.createElement('div');drawer.className='cursor-pack-drawer';drawer.setAttribute('aria-label','Colored cursor choices');
    colors.forEach(cursor=>{
      const choice=document.createElement('button');choice.type='button';choice.className=`cursor-choice${active===cursor.id?' is-selected':''}`;choice.style.setProperty('--cursor-color',cursor.color);choice.setAttribute('aria-pressed',String(active===cursor.id));
      choice.appendChild(makeArrow(cursor));
      const name=document.createElement('span');name.textContent=cursor.name;choice.appendChild(name);
      if(active===cursor.id){const check=document.createElement('b');check.textContent='✓';choice.appendChild(check)}
      choice.addEventListener('click',()=>applyAppCursor(cursor.id));drawer.appendChild(choice);
    });
    cursorsGrid.append(colorPack.wrapper,drawer);
    if(cursorsStatus)cursorsStatus.textContent=packOwned?'Color pack owned':'1 free · 1 Shop pack';
  };

  const positionThemeFan=()=>{
    if(!activePack||!activeFan||!activeFan.classList.contains('is-open'))return;
    const packRect=activePack.getBoundingClientRect();
    const fanRect=activeFan.getBoundingClientRect();
    const width=fanRect.width||98;
    const height=fanRect.height||318;
    const left=clamp(packRect.left+(packRect.width-width)/2,10,Math.max(10,innerWidth-width-10));
    const top=Math.max(10,packRect.top-height-11);
    activeFan.style.left=`${left}px`;
    activeFan.style.top=`${top}px`;
  };

  const closeThemeFan=()=>{
    if(activePack){
      activePack.classList.remove('is-open');
      activePack.setAttribute('aria-expanded','false');
    }
    if(activeFan){
      activeFan.classList.remove('is-open');
      activeFan.setAttribute('aria-hidden','true');
    }
    activePack=null;
    activeFan=null;
  };

  const toggleThemeFan=pack=>{
    if(pack.dataset.shopLocked==='true'){openLockedCollection(pack);return}
    const fanId=pack.getAttribute('aria-controls');
    const fan=fanId?document.getElementById(fanId):null;
    if(!fan)return;
    if(activePack===pack&&fan.classList.contains('is-open')){
      closeThemeFan();
      return;
    }
    closeThemeFan();
    activePack=pack;
    activeFan=fan;
    pack.classList.add('is-open');
    pack.setAttribute('aria-expanded','true');
    fan.classList.add('is-open');
    fan.setAttribute('aria-hidden','false');
    positionThemeFan();
    requestAnimationFrame(positionThemeFan);
  };

  const closeStickerPack=()=>{
    if(activeStickerPack){
      activeStickerPack.classList.remove('is-open');
      activeStickerPack.setAttribute('aria-expanded','false');
    }
    if(activeStickerDrawer){
      activeStickerDrawer.classList.remove('is-open');
      activeStickerDrawer.setAttribute('aria-hidden','true');
    }
    activeStickerPack=null;
    activeStickerDrawer=null;
  };

  const normalizeStickerSearch=value=>String(value||'').toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim();
  const updateStickerSearch=()=>{
    const query=normalizeStickerSearch(stickerSearch?.value);
    const terms=query.split(/\s+/).filter(Boolean);
    const searching=terms.length>0;
    if(searching)closeStickerPack();
    stickerPanel.classList.toggle('is-searching',searching);
    let resultCount=0;
    stickerPacks.forEach(pack=>{
      const drawerId=pack.getAttribute('aria-controls');
      const drawer=drawerId?document.getElementById(drawerId):null;
      const wrapper=pack.closest('.sticker-pack-wrap');
      const items=drawer?[...drawer.querySelectorAll('.sticker-shelf-item')]:[];
      let packMatches=0;
      items.forEach(item=>{
        const haystack=normalizeStickerSearch(`${item.dataset.stickerName||''} ${item.dataset.stickerTags||''}`);
        const matches=!searching||terms.every(term=>haystack.includes(term));
        item.classList.toggle('is-search-hidden',!matches);
        if(searching&&matches){packMatches++;resultCount++}
      });
      const show=!searching||packMatches>0;
      wrapper?.classList.toggle('is-search-hidden',!show);
      drawer?.classList.toggle('is-search-hidden',!show);
      drawer?.classList.toggle('is-search-open',searching&&show);
      if(drawer)drawer.setAttribute('aria-hidden',searching?String(!show):String(!(drawer===activeStickerDrawer&&drawer.classList.contains('is-open'))));
    });
    if(stickerSearchClear)stickerSearchClear.hidden=!searching;
    if(stickerSearchStatus)stickerSearchStatus.textContent=searching?(resultCount?`${resultCount} ${resultCount===1?'sticker':'stickers'} found`:'No stickers found'):'Search every sticker pack';
    if(searching)requestAnimationFrame(()=>{if(stickerScroll)stickerScroll.scrollLeft=0});
  };

  const clearStickerSearch=({focus=false}={})=>{
    if(stickerSearch)stickerSearch.value='';
    updateStickerSearch();
    if(focus)stickerSearch?.focus();
  };

  const toggleStickerPack=pack=>{
    if(pack.dataset.shopLocked==='true'){openLockedCollection(pack);return}
    if(stickerPanel.classList.contains('is-searching'))return;
    const drawerId=pack.getAttribute('aria-controls');
    const drawer=drawerId?document.getElementById(drawerId):null;
    if(!drawer)return;
    if(activeStickerPack===pack&&drawer.classList.contains('is-open')){
      closeStickerPack();
      return;
    }
    closeStickerPack();
    activeStickerPack=pack;
    activeStickerDrawer=drawer;
    pack.classList.add('is-open');
    pack.setAttribute('aria-expanded','true');
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden','false');
    requestAnimationFrame(()=>{
      const left=Math.max(0,pack.parentElement.offsetLeft-12);
      stickerScroll?.scrollTo({left,behavior:'smooth'});
    });
  };

  const syncShelfButtons=()=>{
    themeButton.classList.toggle('is-active',activeShelf==='themes');
    stickerButton.classList.toggle('is-active',activeShelf==='stickers');
    tileSkinsButton.classList.toggle('is-active',activeShelf==='tile-skins');
    cursorsButton.classList.toggle('is-active',activeShelf==='cursors');
    themeButton.setAttribute('aria-expanded',String(activeShelf==='themes'));
    stickerButton.setAttribute('aria-expanded',String(activeShelf==='stickers'));
    tileSkinsButton.setAttribute('aria-expanded',String(activeShelf==='tile-skins'));
    cursorsButton.setAttribute('aria-expanded',String(activeShelf==='cursors'));
    bottomTray?.classList.toggle('has-shelf-open',Boolean(activeShelf));
  };

  const closeShelf=()=>{
    if(!activeShelf)return;
    activeShelf=null;
    closeThemeFan();
    closeStickerPack();
    clearStickerSearch();
    if(tileSkinsSearch)tileSkinsSearch.value='';
    shelf.classList.remove('is-open','is-sticker-mode','is-tile-skins-mode','is-cursors-mode');
    shelf.setAttribute('aria-hidden','true');
    syncShelfButtons();
  };

  const openShelf=type=>{
    if(activeShelf===type){closeShelf();return}
    activeShelf=type;
    closeThemeFan();
    if(type!=='stickers')closeStickerPack();
    const themes=type==='themes';
    const stickers=type==='stickers';
    const tileSkins=type==='tile-skins';
    const cursors=type==='cursors';
    themePanel.hidden=!themes;
    stickerPanel.hidden=!stickers;
    tileSkinsPanel.hidden=!tileSkins;
    cursorsPanel.hidden=!cursors;
    themePanel.classList.toggle('is-active',themes);
    stickerPanel.classList.toggle('is-active',stickers);
    tileSkinsPanel.classList.toggle('is-active',tileSkins);
    cursorsPanel.classList.toggle('is-active',cursors);
    shelf.classList.toggle('is-sticker-mode',stickers);
    shelf.classList.toggle('is-tile-skins-mode',tileSkins);
    shelf.classList.toggle('is-cursors-mode',cursors);
    if(tileSkins)renderTileSkinShelf();
    if(cursors)renderCursorShelf();
    title.textContent=themes?(window.TeacherTilesI18n?.t('top.themes')||'Themes'):stickers?(window.TeacherTilesI18n?.t('top.stickers')||'Stickers'):tileSkins?'Tile Skins':'Cursors';
    shelf.classList.add('is-open');
    shelf.setAttribute('aria-hidden','false');
    syncShelfButtons();
  };

  themeButton.addEventListener('click',e=>{e.stopPropagation();openShelf('themes')});
  stickerButton.addEventListener('click',e=>{e.stopPropagation();openShelf('stickers')});
  tileSkinsButton.addEventListener('click',e=>{e.stopPropagation();openShelf('tile-skins')});
  cursorsButton.addEventListener('click',e=>{e.stopPropagation();openShelf('cursors')});
  closeButton.addEventListener('click',closeShelf);
  packs.forEach(pack=>pack.addEventListener('click',e=>{e.stopPropagation();toggleThemeFan(pack)}));
  stickerPacks.forEach(pack=>pack.addEventListener('click',e=>{e.stopPropagation();toggleStickerPack(pack)}));
  stickerItems.forEach(item=>setupShelfStickerDrag(item,shelfShell));
  stickerSearch?.addEventListener('input',updateStickerSearch);
  stickerSearch?.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();clearStickerSearch({focus:true})}});
  stickerSearchClear?.addEventListener('click',()=>clearStickerSearch({focus:true}));
  tileSkinsSearch?.addEventListener('input',renderTileSkinShelf);
  tileSkinsSearch?.addEventListener('keydown',event=>{
    if(event.key!=='Escape')return;
    event.stopPropagation();
    tileSkinsSearch.value='';renderTileSkinShelf();tileSkinsSearch.focus();
  });
  tileSkinsSearchClear?.addEventListener('click',()=>{if(tileSkinsSearch)tileSkinsSearch.value='';renderTileSkinShelf();tileSkinsSearch?.focus()});
  tileSkinsSort?.addEventListener('change',renderTileSkinShelf);
  window.addEventListener('teachertiles:shopownershipchange',()=>{
    syncCollectionOwnership();
    renderTileSkinShelf();
    if(!cursorIsOwned(cursorById(localStorage.getItem(ACTIVE_CURSOR_KEY)||'default')))applyAppCursor('default');
    renderCursorShelf();
  });
  window.addEventListener('teachertiles:tileskinchange',renderTileSkinShelf);
  window.addEventListener('teachertiles:cursorchange',renderCursorShelf);

  document.querySelectorAll('.theme-fan [data-theme-choice]').forEach(card=>{
    card.addEventListener('click',()=>applyTeacherTheme(card.dataset.themeChoice));
  });

  shelfScroll?.addEventListener('scroll',positionThemeFan,{passive:true});
  shelfScroll?.addEventListener('wheel',e=>{
    if(shelfScroll.scrollWidth<=shelfScroll.clientWidth)return;
    if(Math.abs(e.deltaY)<=Math.abs(e.deltaX))return;
    shelfScroll.scrollLeft+=e.deltaY*(appPreferences.scrollSpeed/100);
    e.preventDefault();
  },{passive:false});

  stickerScroll?.addEventListener('wheel',e=>{
    if(stickerScroll.scrollWidth<=stickerScroll.clientWidth)return;
    if(Math.abs(e.deltaY)<=Math.abs(e.deltaX))return;
    stickerScroll.scrollLeft+=e.deltaY*(appPreferences.scrollSpeed/100);
    e.preventDefault();
  },{passive:false});

  window.addEventListener('resize',positionThemeFan,{passive:true});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&activeShelf)closeShelf()});
  document.addEventListener('pointerdown',e=>{
    if(!activeShelf)return;
    const target=e.target;
    if(!(target instanceof Element))return;
    if(target.closest('#asset-shelf,.theme-fan,.workspace-upcoming-controls'))return;
    closeShelf();
  });

  updateThemeControls(document.body.dataset.theme||'light');
  syncCollectionOwnership();
  renderTileSkinShelf();
  renderCursorShelf();
}

function createAdditionalStickerPackUi(){
  const shelfRow=document.querySelector('#sticker-shelf-content .sticker-shelf__row');
  const shopGrid=document.querySelector('[data-shop-page="stickers"] .shop-product-grid');
  const sampleClasses=['one','two','three','four'];
  ADDITIONAL_STICKER_PACKS.forEach(pack=>{
    if(shelfRow&&!document.getElementById(`${pack.id}-sticker-pack`)){
      const wrap=document.createElement('div');
      wrap.className='sticker-pack-wrap';
      const button=document.createElement('button');
      button.id=`${pack.id}-sticker-pack`;
      button.className=`theme-pack sticker-pack sticker-pack--emoji sticker-pack--emoji-collection${pack.category==='learning'?' sticker-pack--text':''}`;
      button.type='button';
      button.dataset.stickerPack='';
      button.setAttribute('aria-expanded','false');
      button.setAttribute('aria-controls',`${pack.id}-sticker-drawer`);
      const stack=document.createElement('span');
      stack.className='sticker-pack__stack sticker-pack__stack--emoji';
      stack.setAttribute('aria-hidden','true');
      pack.items.slice(0,4).forEach((item,index)=>{
        const sample=document.createElement('span');
        sample.className=`sticker-pack__emoji-sample sticker-pack__emoji-sample--${sampleClasses[index]}`;
        sample.textContent=item.emoji;
        stack.appendChild(sample);
      });
      const meta=document.createElement('span');
      meta.className='theme-pack__meta';
      const name=document.createElement('strong');
      name.textContent=pack.name;
      const count=document.createElement('small');
      count.dataset.generatedStickerCount=pack.id;
      count.textContent=`${pack.items.length} stickers`;
      meta.append(name,count);
      const chevron=document.createElement('span');
      chevron.className='theme-pack__chevron';
      chevron.setAttribute('aria-hidden','true');
      chevron.textContent='⌃';
      button.append(stack,meta,chevron);
      wrap.appendChild(button);
      const drawer=document.createElement('div');
      drawer.id=`${pack.id}-sticker-drawer`;
      drawer.className=`sticker-pack-drawer${pack.items.length>8?' sticker-pack-drawer--scrollable':''}${pack.category==='learning'?' sticker-pack-drawer--text':''}`;
      drawer.setAttribute('aria-hidden','true');
      drawer.setAttribute('role','group');
      drawer.setAttribute('aria-label',`${pack.name} sticker pack`);
      const track=document.createElement('div');
      track.className='sticker-pack-drawer__track';
      track.dataset.generatedStickers=pack.id;
      const hint=document.createElement('span');
      hint.className='sticker-pack-drawer__hint';
      hint.textContent='Drag a sticker onto the board';
      drawer.append(track,hint);
      const anchorId=pack.category==='faces'?'symbols-sticker-pack':'colored-hearts-sticker-pack';
      const anchor=document.getElementById(anchorId)?.closest('.sticker-pack-wrap');
      if(anchor)anchor.before(wrap,drawer);else shelfRow.append(wrap,drawer);
    }
    if(shopGrid&&!shopGrid.querySelector(`[data-shop-product="${pack.productId}"]`)){
      const article=document.createElement('article');
      article.className='shop-product';
      article.dataset.shopProduct=pack.productId;
      article.dataset.shopPrice=String(pack.price);
      const preview=document.createElement('div');
      preview.className=`shop-product__preview shop-product__preview--emoji${pack.category==='learning'?' shop-product__preview--text-stickers':''}`;
      preview.setAttribute('aria-hidden','true');
      pack.items.slice(0,4).forEach(item=>{
        const sample=document.createElement('span');
        sample.textContent=item.emoji;
        preview.appendChild(sample);
      });
      const body=document.createElement('div');
      body.className='shop-product__body';
      const copy=document.createElement('div');
      const type=document.createElement('span');
      type.className='shop-product__type';
      type.textContent='STICKER PACK';
      const title=document.createElement('h3');
      title.textContent=pack.name;
      const description=document.createElement('p');
      description.textContent=pack.description;
      copy.append(type,title,description);
      const buy=document.createElement('button');
      buy.className='shop-buy';
      buy.type='button';
      buy.dataset.shopBuy='';
      const coin=document.createElement('span');
      coin.className='shop-coin-icon shop-coin-icon--small';
      coin.setAttribute('aria-hidden','true');
      const coinImage=document.createElement('img');
      coinImage.src='assets/shop/coin.png';
      coinImage.alt='';
      coin.appendChild(coinImage);
      const price=document.createElement('strong');
      price.textContent=String(pack.price);
      buy.append(coin,price);
      body.append(copy,buy);
      article.append(preview,body);
      const anchorProduct=pack.category==='faces'?'sticker-symbols':'sticker-colored-hearts';
      const anchor=shopGrid.querySelector(`[data-shop-product="${anchorProduct}"]`);
      if(anchor)anchor.before(article);else shopGrid.appendChild(article);
    }
  });
}

function syncStickerShopPackCounts(){
  const productToPack=new Map(Object.entries(COLLECTION_PACK_PRODUCTS).map(([packId,productId])=>[productId,packId]));
  document.querySelectorAll('.shop-product[data-shop-product^="sticker-"]').forEach(product=>{
    const packId=productToPack.get(product.dataset.shopProduct||'');
    const packButton=packId?document.getElementById(packId):null;
    const drawerId=packButton?.getAttribute('aria-controls')||'';
    const stickerCount=drawerId?document.getElementById(drawerId)?.querySelectorAll('.sticker-shelf-item').length:0;
    const preview=product.querySelector('.shop-product__preview');
    if(!preview||!stickerCount)return;
    let badge=preview.querySelector('.shop-sticker-count');
    if(!badge){badge=document.createElement('span');badge.className='shop-sticker-count';preview.appendChild(badge)}
    badge.textContent=String(stickerCount);
    badge.title=`${stickerCount} stickers in this pack`;
  });
}

function populateGeneratedStickerPacks(){
  createAdditionalStickerPackUi();
  const makeStickerButton=({emoji='',src='',name,tags=''})=>{
    const button=document.createElement('button');
    const isText=!src&&/^[A-Za-z0-9]+$/.test(emoji);
    button.className=`sticker-shelf-item ${src?'sticker-shelf-item--flag':'sticker-shelf-item--emoji'}${isText?' sticker-shelf-item--text':''}`;
    button.type='button';
    if(src)button.dataset.stickerSrc=src;
    else button.dataset.stickerEmoji=emoji;
    button.dataset.stickerName=name;
    if(tags)button.dataset.stickerTags=tags;
    button.setAttribute('aria-label',`Drag ${name} sticker onto the board`);
    if(src){
      const image=document.createElement('img');
      image.src=src;
      image.alt='';
      image.draggable=false;
      button.appendChild(image);
    }else{
      const glyph=document.createElement('span');
      glyph.className=`sticker-shelf-emoji${isText?' sticker-shelf-emoji--text':''}`;
      glyph.setAttribute('aria-hidden','true');
      glyph.textContent=emoji;
      button.appendChild(glyph);
    }
    return button;
  };
  const fill=(key,items)=>{
    const track=document.querySelector(`[data-generated-stickers="${key}"]`);
    if(!track||track.childElementCount)return;
    track.append(...items.map(makeStickerButton));
    const count=document.querySelector(`[data-generated-sticker-count="${key}"]`);
    if(count)count.textContent=`${items.length} stickers`;
  };

  const coloredHearts=[
    ['❤️','Red heart'],['🧡','Orange heart'],['💛','Yellow heart'],['💚','Green heart'],['💙','Blue heart'],['💜','Purple heart'],
    ['🤎','Brown heart'],['🖤','Black heart'],['🤍','White heart'],['🩷','Pink heart'],['🩵','Light blue heart'],['🩶','Gray heart']
  ].map(([emoji,name])=>({emoji,name}));
  const decorativeHearts=[
    ['💖','Sparkling heart'],['💗','Growing heart'],['💓','Beating heart'],['💕','Two hearts'],['💞','Revolving hearts'],['💝','Heart with ribbon'],
    ['💘','Heart with arrow'],['💟','Heart decoration'],['❤️‍🔥','Heart on fire'],['❤️‍🩹','Mending heart']
  ].map(([emoji,name])=>({emoji,name}));
  const weatherEmojis=[
    ['☀️','Sunny'],['🌤️','Mostly sunny'],['⛅','Partly cloudy'],['🌥️','Mostly cloudy'],['☁️','Cloudy'],['🌦️','Sun shower'],['🌧️','Rainy'],
    ['⛈️','Thunderstorm'],['🌩️','Lightning'],['🌨️','Snow showers'],['❄️','Snowflake'],['🌫️','Foggy'],['💨','Windy'],['🌪️','Tornado']
  ].map(([emoji,name])=>({emoji,name}));
  fill('weather-emojis',weatherEmojis);
  fill('colored-hearts',coloredHearts);
  fill('decorative-hearts',decorativeHearts);
  ADDITIONAL_STICKER_PACKS.forEach(pack=>fill(pack.id,pack.items.map(item=>({...item,tags:`${item.tags||''} ${pack.tags}`.trim()}))));

  const regionCodes=`AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET EU FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM UN US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW`.split(/\s+/);
  const specialNames={EU:'European Union',UN:'United Nations',XK:'Kosovo'};
  let displayNames=null;
  try{displayNames=new Intl.DisplayNames(['en'],{type:'region'})}catch{}
  const flags=regionCodes.map(code=>({
    src:`https://flagcdn.io/flags/4x3/${code.toLowerCase()}.svg`,
    name:`${specialNames[code]||displayNames?.of(code)||code} flag`,
    tags:`country countries flag flags nation geography world international ${code.toLowerCase()}`
  }));
  fill('country-flags',flags);
  syncStickerShopPackCounts();
}

populateGeneratedStickerPacks();
setupCollectionShelf();

function setupCustomizeLauncher(){
  const launcher=document.getElementById('customize-launcher');
  const toggle=document.getElementById('customize-toggle');
  const menu=document.getElementById('customize-launch-menu');
  if(!launcher||!toggle||!menu)return;
  let closeTimer=0;
  const cancelClose=()=>{clearTimeout(closeTimer);closeTimer=0};
  const setOpen=open=>{
    cancelClose();
    launcher.classList.toggle('is-open',open);
    toggle.classList.toggle('is-active',open);
    toggle.setAttribute('aria-expanded',String(open));
    menu.setAttribute('aria-hidden',String(!open));
  };
  toggle.addEventListener('click',event=>{
    event.stopPropagation();
    setOpen(!launcher.classList.contains('is-open'));
  });
  launcher.addEventListener('pointerenter',cancelClose);
  launcher.addEventListener('pointerleave',()=>{
    if(!launcher.classList.contains('is-open'))return;
    cancelClose();
    closeTimer=setTimeout(()=>setOpen(false),900);
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&launcher.classList.contains('is-open'))setOpen(false);
  });
}

setupCustomizeLauncher();



const PERIODIC_ELEMENTS=[{"n":1,"symbol":"H","name":"Hydrogen","mass":"1.008","period":1,"group":1,"row":1,"col":1,"category":"Reactive nonmetal","categoryKey":"reactive-nonmetal","block":"s"},{"n":2,"symbol":"He","name":"Helium","mass":"4.003","period":1,"group":18,"row":1,"col":18,"category":"Noble gas","categoryKey":"noble-gas","block":"p"},{"n":3,"symbol":"Li","name":"Lithium","mass":"6.941","period":2,"group":1,"row":2,"col":1,"category":"Alkali metal","categoryKey":"alkali-metal","block":"s"},{"n":4,"symbol":"Be","name":"Beryllium","mass":"9.012","period":2,"group":2,"row":2,"col":2,"category":"Alkaline earth metal","categoryKey":"alkaline-earth-metal","block":"s"},{"n":5,"symbol":"B","name":"Boron","mass":"10.812","period":2,"group":13,"row":2,"col":13,"category":"Metalloid","categoryKey":"metalloid","block":"p"},{"n":6,"symbol":"C","name":"Carbon","mass":"12.011","period":2,"group":14,"row":2,"col":14,"category":"Reactive nonmetal","categoryKey":"reactive-nonmetal","block":"p"},{"n":7,"symbol":"N","name":"Nitrogen","mass":"14.007","period":2,"group":15,"row":2,"col":15,"category":"Reactive nonmetal","categoryKey":"reactive-nonmetal","block":"p"},{"n":8,"symbol":"O","name":"Oxygen","mass":"15.999","period":2,"group":16,"row":2,"col":16,"category":"Reactive nonmetal","categoryKey":"reactive-nonmetal","block":"p"},{"n":9,"symbol":"F","name":"Fluorine","mass":"18.998","period":2,"group":17,"row":2,"col":17,"category":"Halogen","categoryKey":"halogen","block":"p"},{"n":10,"symbol":"Ne","name":"Neon","mass":"20.18","period":2,"group":18,"row":2,"col":18,"category":"Noble gas","categoryKey":"noble-gas","block":"p"},{"n":11,"symbol":"Na","name":"Sodium","mass":"22.99","period":3,"group":1,"row":3,"col":1,"category":"Alkali metal","categoryKey":"alkali-metal","block":"s"},{"n":12,"symbol":"Mg","name":"Magnesium","mass":"24.305","period":3,"group":2,"row":3,"col":2,"category":"Alkaline earth metal","categoryKey":"alkaline-earth-metal","block":"s"},{"n":13,"symbol":"Al","name":"Aluminium","mass":"26.982","period":3,"group":13,"row":3,"col":13,"category":"Post-transition metal","categoryKey":"post-transition-metal","block":"p"},{"n":14,"symbol":"Si","name":"Silicon","mass":"28.086","period":3,"group":14,"row":3,"col":14,"category":"Metalloid","categoryKey":"metalloid","block":"p"},{"n":15,"symbol":"P","name":"Phosphorus","mass":"30.974","period":3,"group":15,"row":3,"col":15,"category":"Reactive nonmetal","categoryKey":"reactive-nonmetal","block":"p"},{"n":16,"symbol":"S","name":"Sulfur","mass":"32.067","period":3,"group":16,"row":3,"col":16,"category":"Reactive nonmetal","categoryKey":"reactive-nonmetal","block":"p"},{"n":17,"symbol":"Cl","name":"Chlorine","mass":"35.453","period":3,"group":17,"row":3,"col":17,"category":"Halogen","categoryKey":"halogen","block":"p"},{"n":18,"symbol":"Ar","name":"Argon","mass":"39.948","period":3,"group":18,"row":3,"col":18,"category":"Noble gas","categoryKey":"noble-gas","block":"p"},{"n":19,"symbol":"K","name":"Potassium","mass":"39.098","period":4,"group":1,"row":4,"col":1,"category":"Alkali metal","categoryKey":"alkali-metal","block":"s"},{"n":20,"symbol":"Ca","name":"Calcium","mass":"40.078","period":4,"group":2,"row":4,"col":2,"category":"Alkaline earth metal","categoryKey":"alkaline-earth-metal","block":"s"},{"n":21,"symbol":"Sc","name":"Scandium","mass":"44.956","period":4,"group":3,"row":4,"col":3,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":22,"symbol":"Ti","name":"Titanium","mass":"47.867","period":4,"group":4,"row":4,"col":4,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":23,"symbol":"V","name":"Vanadium","mass":"50.944","period":4,"group":5,"row":4,"col":5,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":24,"symbol":"Cr","name":"Chromium","mass":"51.996","period":4,"group":6,"row":4,"col":6,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":25,"symbol":"Mn","name":"Manganese","mass":"54.938","period":4,"group":7,"row":4,"col":7,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":26,"symbol":"Fe","name":"Iron","mass":"55.845","period":4,"group":8,"row":4,"col":8,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":27,"symbol":"Co","name":"Cobalt","mass":"58.933","period":4,"group":9,"row":4,"col":9,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":28,"symbol":"Ni","name":"Nickel","mass":"58.693","period":4,"group":10,"row":4,"col":10,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":29,"symbol":"Cu","name":"Copper","mass":"63.546","period":4,"group":11,"row":4,"col":11,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":30,"symbol":"Zn","name":"Zinc","mass":"65.39","period":4,"group":12,"row":4,"col":12,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":31,"symbol":"Ga","name":"Gallium","mass":"69.723","period":4,"group":13,"row":4,"col":13,"category":"Post-transition metal","categoryKey":"post-transition-metal","block":"p"},{"n":32,"symbol":"Ge","name":"Germanium","mass":"72.61","period":4,"group":14,"row":4,"col":14,"category":"Metalloid","categoryKey":"metalloid","block":"p"},{"n":33,"symbol":"As","name":"Arsenic","mass":"74.922","period":4,"group":15,"row":4,"col":15,"category":"Metalloid","categoryKey":"metalloid","block":"p"},{"n":34,"symbol":"Se","name":"Selenium","mass":"78.96","period":4,"group":16,"row":4,"col":16,"category":"Reactive nonmetal","categoryKey":"reactive-nonmetal","block":"p"},{"n":35,"symbol":"Br","name":"Bromine","mass":"79.904","period":4,"group":17,"row":4,"col":17,"category":"Halogen","categoryKey":"halogen","block":"p"},{"n":36,"symbol":"Kr","name":"Krypton","mass":"83.8","period":4,"group":18,"row":4,"col":18,"category":"Noble gas","categoryKey":"noble-gas","block":"p"},{"n":37,"symbol":"Rb","name":"Rubidium","mass":"85.468","period":5,"group":1,"row":5,"col":1,"category":"Alkali metal","categoryKey":"alkali-metal","block":"s"},{"n":38,"symbol":"Sr","name":"Strontium","mass":"87.62","period":5,"group":2,"row":5,"col":2,"category":"Alkaline earth metal","categoryKey":"alkaline-earth-metal","block":"s"},{"n":39,"symbol":"Y","name":"Yttrium","mass":"88.906","period":5,"group":3,"row":5,"col":3,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":40,"symbol":"Zr","name":"Zirconium","mass":"91.224","period":5,"group":4,"row":5,"col":4,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":41,"symbol":"Nb","name":"Niobium","mass":"92.906","period":5,"group":5,"row":5,"col":5,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":42,"symbol":"Mo","name":"Molybdenum","mass":"95.94","period":5,"group":6,"row":5,"col":6,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":43,"symbol":"Tc","name":"Technetium","mass":"98","period":5,"group":7,"row":5,"col":7,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":44,"symbol":"Ru","name":"Ruthenium","mass":"101.07","period":5,"group":8,"row":5,"col":8,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":45,"symbol":"Rh","name":"Rhodium","mass":"102.906","period":5,"group":9,"row":5,"col":9,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":46,"symbol":"Pd","name":"Palladium","mass":"106.42","period":5,"group":10,"row":5,"col":10,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":47,"symbol":"Ag","name":"Silver","mass":"107.868","period":5,"group":11,"row":5,"col":11,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":48,"symbol":"Cd","name":"Cadmium","mass":"112.412","period":5,"group":12,"row":5,"col":12,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":49,"symbol":"In","name":"Indium","mass":"114.818","period":5,"group":13,"row":5,"col":13,"category":"Post-transition metal","categoryKey":"post-transition-metal","block":"p"},{"n":50,"symbol":"Sn","name":"Tin","mass":"118.711","period":5,"group":14,"row":5,"col":14,"category":"Post-transition metal","categoryKey":"post-transition-metal","block":"p"},{"n":51,"symbol":"Sb","name":"Antimony","mass":"121.76","period":5,"group":15,"row":5,"col":15,"category":"Metalloid","categoryKey":"metalloid","block":"p"},{"n":52,"symbol":"Te","name":"Tellurium","mass":"127.6","period":5,"group":16,"row":5,"col":16,"category":"Metalloid","categoryKey":"metalloid","block":"p"},{"n":53,"symbol":"I","name":"Iodine","mass":"126.904","period":5,"group":17,"row":5,"col":17,"category":"Halogen","categoryKey":"halogen","block":"p"},{"n":54,"symbol":"Xe","name":"Xenon","mass":"131.29","period":5,"group":18,"row":5,"col":18,"category":"Noble gas","categoryKey":"noble-gas","block":"p"},{"n":55,"symbol":"Cs","name":"Caesium","mass":"132.905","period":6,"group":1,"row":6,"col":1,"category":"Alkali metal","categoryKey":"alkali-metal","block":"s"},{"n":56,"symbol":"Ba","name":"Barium","mass":"137.328","period":6,"group":2,"row":6,"col":2,"category":"Alkaline earth metal","categoryKey":"alkaline-earth-metal","block":"s"},{"n":57,"symbol":"La","name":"Lanthanum","mass":"138.906","period":6,"group":3,"row":6,"col":3,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":58,"symbol":"Ce","name":"Cerium","mass":"140.116","period":6,"group":null,"row":8,"col":4,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":59,"symbol":"Pr","name":"Praseodymium","mass":"140.908","period":6,"group":null,"row":8,"col":5,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":60,"symbol":"Nd","name":"Neodymium","mass":"144.24","period":6,"group":null,"row":8,"col":6,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":61,"symbol":"Pm","name":"Promethium","mass":"145","period":6,"group":null,"row":8,"col":7,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":62,"symbol":"Sm","name":"Samarium","mass":"150.36","period":6,"group":null,"row":8,"col":8,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":63,"symbol":"Eu","name":"Europium","mass":"151.964","period":6,"group":null,"row":8,"col":9,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":64,"symbol":"Gd","name":"Gadolinium","mass":"157.25","period":6,"group":null,"row":8,"col":10,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":65,"symbol":"Tb","name":"Terbium","mass":"158.925","period":6,"group":null,"row":8,"col":11,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":66,"symbol":"Dy","name":"Dysprosium","mass":"162.5","period":6,"group":null,"row":8,"col":12,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":67,"symbol":"Ho","name":"Holmium","mass":"164.93","period":6,"group":null,"row":8,"col":13,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":68,"symbol":"Er","name":"Erbium","mass":"167.26","period":6,"group":null,"row":8,"col":14,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":69,"symbol":"Tm","name":"Thulium","mass":"168.934","period":6,"group":null,"row":8,"col":15,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":70,"symbol":"Yb","name":"Ytterbium","mass":"173.04","period":6,"group":null,"row":8,"col":16,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":71,"symbol":"Lu","name":"Lutetium","mass":"174.967","period":6,"group":null,"row":8,"col":17,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":72,"symbol":"Hf","name":"Hafnium","mass":"178.49","period":6,"group":4,"row":6,"col":4,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":73,"symbol":"Ta","name":"Tantalum","mass":"180.948","period":6,"group":5,"row":6,"col":5,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":74,"symbol":"W","name":"Tungsten","mass":"183.84","period":6,"group":6,"row":6,"col":6,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":75,"symbol":"Re","name":"Rhenium","mass":"186.207","period":6,"group":7,"row":6,"col":7,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":76,"symbol":"Os","name":"Osmium","mass":"190.23","period":6,"group":8,"row":6,"col":8,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":77,"symbol":"Ir","name":"Iridium","mass":"192.217","period":6,"group":9,"row":6,"col":9,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":78,"symbol":"Pt","name":"Platinum","mass":"195.078","period":6,"group":10,"row":6,"col":10,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":79,"symbol":"Au","name":"Gold","mass":"196.967","period":6,"group":11,"row":6,"col":11,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":80,"symbol":"Hg","name":"Mercury","mass":"200.59","period":6,"group":12,"row":6,"col":12,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":81,"symbol":"Tl","name":"Thallium","mass":"204.383","period":6,"group":13,"row":6,"col":13,"category":"Post-transition metal","categoryKey":"post-transition-metal","block":"p"},{"n":82,"symbol":"Pb","name":"Lead","mass":"207.2","period":6,"group":14,"row":6,"col":14,"category":"Post-transition metal","categoryKey":"post-transition-metal","block":"p"},{"n":83,"symbol":"Bi","name":"Bismuth","mass":"208.98","period":6,"group":15,"row":6,"col":15,"category":"Post-transition metal","categoryKey":"post-transition-metal","block":"p"},{"n":84,"symbol":"Po","name":"Polonium","mass":"209","period":6,"group":16,"row":6,"col":16,"category":"Post-transition metal","categoryKey":"post-transition-metal","block":"p"},{"n":85,"symbol":"At","name":"Astatine","mass":"210","period":6,"group":17,"row":6,"col":17,"category":"Halogen","categoryKey":"halogen","block":"p"},{"n":86,"symbol":"Rn","name":"Radon","mass":"222","period":6,"group":18,"row":6,"col":18,"category":"Noble gas","categoryKey":"noble-gas","block":"p"},{"n":87,"symbol":"Fr","name":"Francium","mass":"223","period":7,"group":1,"row":7,"col":1,"category":"Alkali metal","categoryKey":"alkali-metal","block":"s"},{"n":88,"symbol":"Ra","name":"Radium","mass":"226","period":7,"group":2,"row":7,"col":2,"category":"Alkaline earth metal","categoryKey":"alkaline-earth-metal","block":"s"},{"n":89,"symbol":"Ac","name":"Actinium","mass":"227","period":7,"group":3,"row":7,"col":3,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":90,"symbol":"Th","name":"Thorium","mass":"232.038","period":7,"group":null,"row":9,"col":4,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":91,"symbol":"Pa","name":"Protactinium","mass":"231.036","period":7,"group":null,"row":9,"col":5,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":92,"symbol":"U","name":"Uranium","mass":"238.029","period":7,"group":null,"row":9,"col":6,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":93,"symbol":"Np","name":"Neptunium","mass":"237","period":7,"group":null,"row":9,"col":7,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":94,"symbol":"Pu","name":"Plutonium","mass":"244","period":7,"group":null,"row":9,"col":8,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":95,"symbol":"Am","name":"Americium","mass":"243","period":7,"group":null,"row":9,"col":9,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":96,"symbol":"Cm","name":"Curium","mass":"247","period":7,"group":null,"row":9,"col":10,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":97,"symbol":"Bk","name":"Berkelium","mass":"247","period":7,"group":null,"row":9,"col":11,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":98,"symbol":"Cf","name":"Californium","mass":"251","period":7,"group":null,"row":9,"col":12,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":99,"symbol":"Es","name":"Einsteinium","mass":"252","period":7,"group":null,"row":9,"col":13,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":100,"symbol":"Fm","name":"Fermium","mass":"257","period":7,"group":null,"row":9,"col":14,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":101,"symbol":"Md","name":"Mendelevium","mass":"258","period":7,"group":null,"row":9,"col":15,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":102,"symbol":"No","name":"Nobelium","mass":"259","period":7,"group":null,"row":9,"col":16,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":103,"symbol":"Lr","name":"Lawrencium","mass":"262","period":7,"group":null,"row":9,"col":17,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":104,"symbol":"Rf","name":"Rutherfordium","mass":"267","period":7,"group":4,"row":7,"col":4,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":105,"symbol":"Db","name":"Dubnium","mass":"268","period":7,"group":5,"row":7,"col":5,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":106,"symbol":"Sg","name":"Seaborgium","mass":"269","period":7,"group":6,"row":7,"col":6,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":107,"symbol":"Bh","name":"Bohrium","mass":"270","period":7,"group":7,"row":7,"col":7,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":108,"symbol":"Hs","name":"Hassium","mass":"269","period":7,"group":8,"row":7,"col":8,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":109,"symbol":"Mt","name":"Meitnerium","mass":"278","period":7,"group":9,"row":7,"col":9,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":110,"symbol":"Ds","name":"Darmstadtium","mass":"281","period":7,"group":10,"row":7,"col":10,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":111,"symbol":"Rg","name":"Roentgenium","mass":"281","period":7,"group":11,"row":7,"col":11,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":112,"symbol":"Cn","name":"Copernicium","mass":"285","period":7,"group":12,"row":7,"col":12,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":113,"symbol":"Nh","name":"Nihonium","mass":"284","period":7,"group":13,"row":7,"col":13,"category":"Post-transition metal","categoryKey":"post-transition-metal","block":"p"},{"n":114,"symbol":"Fl","name":"Flerovium","mass":"289","period":7,"group":14,"row":7,"col":14,"category":"Post-transition metal","categoryKey":"post-transition-metal","block":"p"},{"n":115,"symbol":"Mc","name":"Moscovium","mass":"288","period":7,"group":15,"row":7,"col":15,"category":"Post-transition metal","categoryKey":"post-transition-metal","block":"p"},{"n":116,"symbol":"Lv","name":"Livermorium","mass":"293","period":7,"group":16,"row":7,"col":16,"category":"Post-transition metal","categoryKey":"post-transition-metal","block":"p"},{"n":117,"symbol":"Ts","name":"Tennessine","mass":"292","period":7,"group":17,"row":7,"col":17,"category":"Halogen","categoryKey":"halogen","block":"p"},{"n":118,"symbol":"Og","name":"Oganesson","mass":"294","period":7,"group":18,"row":7,"col":18,"category":"Noble gas","categoryKey":"noble-gas","block":"p"}];

const CVC_WORD_SETS={"a":["cab","dab","jab","lab","tab","nab","tad","bad","dad","had","lad","pad","mad","rad","sad","wag","bag","gag","lag","nag","sag","rag","tag","hag","Sam","dam","ham"],"e":["bed","wed","fed","led","red","Ted","zed","Jed","Ned","beg","leg","peg","keg","Meg","neg","Ben","den","men","pen","ten","hen","Zen","Ken","Yen","bet","get","jet"],"i":["bib","fib","rib","jib","sib","bid","did","hid","kid","lid","rid","big","dig","fig","pig","rig","wig","jig","zig","dim","him","Kim","rim","Tim","Jim","Vim","bin"],"o":["cob","gob","job","lob","mob","rob","sob","dog","fog","jog","log","cop","hop","mop","pop","top","cot","dot","hot","not","pot","God","rod","pod","mod","cod","bop"],"u":["cub","hub","rub","pug","sub","tub","nub","rug","pub","dub","bud","tug","dud","mud","cud","gum","bug","dug","hug","hum","jug","lug","mug","mum"]};

function setupCVCWord(m){
  const card=m.querySelector('.cvcword-card');
  const wordEl=m.querySelector('.cvcword-word');
  const vowelLabel=m.querySelector('.cvcword-vowel-label');
  const categoryLabel=m.querySelector('.cvcword-category-label');
  const categorySelect=m.querySelector('.cvcword-category');
  const nextButton=m.querySelector('.cvcword-next');

  const categoryNames={
    all:'All Short Vowels',
    a:'Short A',
    e:'Short E',
    i:'Short I',
    o:'Short O',
    u:'Short U'
  };

  let currentWord='';
  let currentCategory='a';
  let animating=false;
  let resizeFrame=0;

  const measurer=document.createElement('span');
  measurer.className='cvcword-word cvcword-measurer';
  measurer.setAttribute('aria-hidden','true');
  card.appendChild(measurer);

  const getAvailableSpace=()=>{
    const cardRect=card.getBoundingClientRect();
    const labelRect=vowelLabel.getBoundingClientRect();

    return {
      maxWidth:Math.max(80,cardRect.width-34),
      maxHeight:Math.max(48,cardRect.height-38)
    };
  };

  const measureWordSize=word=>{
    const {maxWidth,maxHeight}=getAvailableSpace();

    measurer.textContent=word;
    measurer.style.fontFamily=getComputedStyle(wordEl).fontFamily;
    measurer.style.fontWeight=getComputedStyle(wordEl).fontWeight;
    measurer.style.letterSpacing=getComputedStyle(wordEl).letterSpacing;

    let low=18;
    let high=Math.max(24,Math.min(240,Math.floor(maxHeight*.9)));
    let best=low;

    while(low<=high){
      const mid=Math.floor((low+high)/2);
      measurer.style.fontSize=`${mid}px`;

      const rect=measurer.getBoundingClientRect();
      const fitsWidth=rect.width<=maxWidth+1;
      const fitsHeight=rect.height<=maxHeight+1;

      if(fitsWidth&&fitsHeight){
        best=mid;
        low=mid+1;
      }else{
        high=mid-1;
      }
    }

    return best;
  };

  const fitCurrentWord=()=>{
    cancelAnimationFrame(resizeFrame);
    resizeFrame=requestAnimationFrame(()=>{
      if(!currentWord)return;
      const size=measureWordSize(currentWord);
      wordEl.style.fontSize=`${size}px`;
      wordEl.classList.remove('is-fitting');
    });
  };

  const getPool=category=>{
    if(category!=='all'){
      return CVC_WORD_SETS[category].map(word=>({word,category}));
    }

    return Object.entries(CVC_WORD_SETS).flatMap(([key,words])=>
      words.map(word=>({word,category:key}))
    );
  };

  const chooseWord=()=>{
    const category=m.dataset.cvcCategory||'all';
    const pool=getPool(category);
    if(!pool.length)return null;

    let candidates=pool.filter(item=>item.word!==currentWord);
    if(!candidates.length)candidates=pool;

    return candidates[Math.floor(Math.random()*candidates.length)];
  };

  const prepareWord=item=>{
    if(!item)return null;
    return {
      ...item,
      fontSize:measureWordSize(item.word)
    };
  };

  const applyPreparedWord=prepared=>{
    if(!prepared)return;

    currentWord=prepared.word;
    currentCategory=prepared.category;

    wordEl.classList.add('is-fitting');
    wordEl.textContent=prepared.word;
    wordEl.style.fontSize=`${prepared.fontSize}px`;

    vowelLabel.textContent=`short ${prepared.category}`;
    card.dataset.vowel=prepared.category;
    card.setAttribute('aria-label',`${prepared.word}. Click for another CVC word.`);

    requestAnimationFrame(()=>{
      wordEl.classList.remove('is-fitting');
    });
  };

  const showNext=()=>{
    if(animating)return;

    const next=chooseWord();
    if(!next)return;

    const prepared=prepareWord(next);
    animating=true;

    card.classList.remove('is-flipping');
    void card.offsetWidth;
    card.classList.add('is-flipping');

    window.setTimeout(()=>{
      applyPreparedWord(prepared);
    },180);

    window.setTimeout(()=>{
      card.classList.remove('is-flipping');
      animating=false;
    },430);
  };

  const setCategory=category=>{
    const next=category in categoryNames?category:'all';
    m.dataset.cvcCategory=next;
    categorySelect.value=next;
    categoryLabel.textContent=categoryNames[next];
    currentWord='';
    showNext();
  };

  card.addEventListener('click',showNext);
  nextButton.addEventListener('click',showNext);

  categorySelect.addEventListener('change',()=>{
    setCategory(categorySelect.value);
  });

  m.querySelector('.cvcword-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.cvcword-font').addEventListener('click',()=>{
    cycleData(m,'font',FONT_OPTIONS);
    fitCurrentWord();
  });
  m.querySelector('.cvcword-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  const ro=new ResizeObserver(()=>{
    if(!currentWord)return;
    fitCurrentWord();
  });
  ro.observe(card);

  setCategory('all');

  m._boardGetState=()=>({
    category:m.dataset.cvcCategory||'all',
    currentWord,
    currentCategory
  });
  m._boardSetState=state=>{
    if(!state)return;
    const category=state.category in categoryNames?state.category:'all';
    m.dataset.cvcCategory=category;
    categorySelect.value=category;
    categoryLabel.textContent=categoryNames[category];
    const allowed=getPool(category);
    const saved=String(state.currentWord||'');
    const match=allowed.find(item=>item.word===saved);
    if(match)applyPreparedWord(prepareWord(match));
    else{currentWord='';showNext()}
  };

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    ro.disconnect();
    cancelAnimationFrame(resizeFrame);
    measurer.remove();
  };
}


const HIGH_FREQUENCY_WORD_SETS={"k":["can","I","the","we","see","a","like","to","and","go","you","do","my","are","with","he","is","little","she","was","for","have","of","they","said","want","here","me","this","what","help","too","has","play","where","look","good","who","come","does"],"1":["a","can","do","go","has","the","I","like","to","you","this","is","my","look","little","where","here","play","we","one","me","she","with","for","and","have","said","see","was","does","not","school","what","down","out","up","very","be","come","good","pull","fun","make","they","too","jump","move","run","two","again","help","new","there","use","could","live","then","three","eat","no","of","under","who","all","call","day","her","want","around","by","many","place","walk","away","now","some","today","way","why","green","grow","pretty","should","together","water","any","from","happy","once","so","upon","ago","boy","girl","how","old","people","after","buy","done","every","soon","work","about","animal","carry","eight","give","our","because","blue","into","or","other","small","find","food","more","over","start","warm","caught","flew","know","laugh","listen","were","found","hard","near","woman","would","write","four","large","none","only","put","round","another","climb","full","great","poor","through","began","better","guess","learn","right","sure","color","early","instead","nothing","oh","thought","above","build","fall","knew","money","toward","answer","brought","busy","door","enough","eyes","brother","father","friend","love","mother","picture","been","children","month","question","their","year","before","front","heard","push","tomorrow","your","favorite","few","gone","surprise","wonder","young"],"2":["ball","blue","both","even","for","help","put","there","why","yellow","could","find","funny","green","how","little","one","or","see","sounds","boy","by","girl","he","here","she","small","want","were","what","another","done","into","move","now","show","too","water","year","your","all","any","goes","new","number","other","right","says","understands","work"],"3plus":["a","about","after","again","all","also","always","am","an","and","another","any","are","around","as","ask","at","ate","away","back","be","because","been","before","best","better","big","black","blue","both","think","this","those","three","through","time","today","together","under","upon","very","want","water","went","where","which","would","write","years","yellow","yes","you","your"]};

function setupHighFrequencyWords(m){
  const card=m.querySelector('.highfrequency-card');
  const wordEl=m.querySelector('.highfrequency-word');
  const gradeLabel=m.querySelector('.highfrequency-grade-label');
  const gradeSelect=m.querySelector('.highfrequency-grade');
  const nextButton=m.querySelector('.highfrequency-next');
  const settingsButton=m.querySelector('.highfrequency-settings-button');
  const settings=m.querySelector('.highfrequency-settings');
  const settingsClose=m.querySelector('.highfrequency-settings-close');
  const settingsTitle=m.querySelector('.highfrequency-settings-title');
  const wordOptions=m.querySelector('.highfrequency-word-options');
  const enableAll=m.querySelector('.highfrequency-enable-all');
  const disableAll=m.querySelector('.highfrequency-disable-all');
  const enabledCount=m.querySelector('.highfrequency-enabled-count');

  const gradeNames={
    k:'Kindergarten',
    1:'Grade 1',
    2:'Grade 2',
    '3plus':'Grade 3+'
  };

  const enabledByGrade={};
  Object.entries(HIGH_FREQUENCY_WORD_SETS).forEach(([grade,words])=>{
    enabledByGrade[grade]=new Set(words);
  });

  let currentWord='';
  let animating=false;
  let resizeFrame=0;

  const measurer=document.createElement('span');
  measurer.className='highfrequency-word highfrequency-measurer';
  measurer.setAttribute('aria-hidden','true');
  card.appendChild(measurer);

  const measureWordSize=word=>{
    const cardRect=card.getBoundingClientRect();
    const maxWidth=Math.max(90,cardRect.width-36);
    const maxHeight=Math.max(54,cardRect.height-40);

    measurer.textContent=word;
    const computed=getComputedStyle(wordEl);
    measurer.style.fontFamily=computed.fontFamily;
    measurer.style.fontWeight=computed.fontWeight;
    measurer.style.letterSpacing=computed.letterSpacing;

    let low=18;
    let high=Math.max(24,Math.min(240,Math.floor(maxHeight*.9)));
    let best=low;

    while(low<=high){
      const mid=Math.floor((low+high)/2);
      measurer.style.fontSize=`${mid}px`;

      const rect=measurer.getBoundingClientRect();
      if(rect.width<=maxWidth+1&&rect.height<=maxHeight+1){
        best=mid;
        low=mid+1;
      }else{
        high=mid-1;
      }
    }

    return best;
  };

  const enabledWords=grade=>HIGH_FREQUENCY_WORD_SETS[grade].filter(word=>enabledByGrade[grade].has(word));

  const chooseWord=()=>{
    const grade=m.dataset.hfwGrade||'k';
    const pool=enabledWords(grade);
    if(!pool.length)return null;

    let candidates=pool.filter(word=>word!==currentWord);
    if(!candidates.length)candidates=pool;

    return candidates[Math.floor(Math.random()*candidates.length)];
  };

  const applyWord=(word,size)=>{
    currentWord=word;
    wordEl.classList.add('is-fitting');
    wordEl.textContent=word;
    wordEl.style.fontSize=`${size}px`;
    card.setAttribute('aria-label',`${word}. Click for another high frequency word.`);
    requestAnimationFrame(()=>wordEl.classList.remove('is-fitting'));
  };

  const fitCurrentWord=()=>{
    cancelAnimationFrame(resizeFrame);
    resizeFrame=requestAnimationFrame(()=>{
      if(!currentWord)return;
      wordEl.style.fontSize=`${measureWordSize(currentWord)}px`;
      wordEl.classList.remove('is-fitting');
    });
  };

  const showNext=()=>{
    if(animating)return;

    const next=chooseWord();
    if(!next){
      currentWord='';
      wordEl.classList.remove('is-fitting');
      wordEl.style.fontSize='';
      wordEl.textContent='No words enabled';
      card.classList.add('is-empty');
      return;
    }

    const size=measureWordSize(next);
    animating=true;
    card.classList.remove('is-empty','is-flipping');
    void card.offsetWidth;
    card.classList.add('is-flipping');

    window.setTimeout(()=>applyWord(next,size),180);

    window.setTimeout(()=>{
      card.classList.remove('is-flipping');
      animating=false;
    },430);
  };

  const renderSettings=()=>{
    const grade=m.dataset.hfwGrade||'k';
    const words=HIGH_FREQUENCY_WORD_SETS[grade];
    const enabled=enabledByGrade[grade];

    settingsTitle.textContent=gradeNames[grade];
    enabledCount.textContent=`${enabled.size} of ${words.length} enabled`;
    wordOptions.replaceChildren();

    words.forEach(word=>{
      const button=document.createElement('button');
      button.type='button';
      button.className='highfrequency-word-option';
      button.textContent=word;
      button.classList.toggle('is-enabled',enabled.has(word));
      button.setAttribute('aria-pressed',String(enabled.has(word)));

      button.addEventListener('click',()=>{
        if(enabled.has(word))enabled.delete(word);
        else enabled.add(word);

        button.classList.toggle('is-enabled',enabled.has(word));
        button.setAttribute('aria-pressed',String(enabled.has(word)));
        enabledCount.textContent=`${enabled.size} of ${words.length} enabled`;

        if(currentWord&&!enabled.has(currentWord)){
          currentWord='';
          showNext();
        }
      });

      wordOptions.appendChild(button);
    });
  };

  const setGrade=grade=>{
    const next=grade in gradeNames?grade:'k';
    m.dataset.hfwGrade=next;
    gradeSelect.value=next;
    gradeLabel.textContent=gradeNames[next];
    currentWord='';
    renderSettings();
    showNext();
  };

  card.addEventListener('click',showNext);
  nextButton.addEventListener('click',showNext);

  gradeSelect.addEventListener('change',()=>setGrade(gradeSelect.value));

  settingsButton.addEventListener('click',()=>{
    renderSettings();
    settings.hidden=false;
  });

  settingsClose.addEventListener('click',()=>{settings.hidden=true;});
  settings.addEventListener('pointerdown',event=>{
    if(event.target===settings)settings.hidden=true;
  });

  enableAll.addEventListener('click',()=>{
    const grade=m.dataset.hfwGrade||'k';
    enabledByGrade[grade]=new Set(HIGH_FREQUENCY_WORD_SETS[grade]);
    renderSettings();
    if(!currentWord)showNext();
  });

  disableAll.addEventListener('click',()=>{
    const grade=m.dataset.hfwGrade||'k';
    enabledByGrade[grade].clear();
    currentWord='';
    renderSettings();
    showNext();
  });

  m.querySelector('.highfrequency-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.highfrequency-font').addEventListener('click',()=>{
    cycleData(m,'font',FONT_OPTIONS);
    fitCurrentWord();
  });
  m.querySelector('.highfrequency-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  const ro=new ResizeObserver(()=>{
    if(currentWord)fitCurrentWord();
  });
  ro.observe(card);

  setGrade('k');

  m._boardGetState=()=>({
    grade:m.dataset.hfwGrade||'k',
    currentWord,
    enabledByGrade:Object.fromEntries(Object.entries(enabledByGrade).map(([grade,set])=>[grade,[...set]]))
  });
  m._boardSetState=state=>{
    if(!state)return;
    const savedEnabled=state.enabledByGrade&&typeof state.enabledByGrade==='object'?state.enabledByGrade:{};
    for(const [grade,words] of Object.entries(HIGH_FREQUENCY_WORD_SETS)){
      const allowed=new Set(words);
      const saved=Array.isArray(savedEnabled[grade])?savedEnabled[grade].filter(word=>allowed.has(word)):words;
      enabledByGrade[grade]=new Set(saved);
    }
    const grade=state.grade in gradeNames?state.grade:'k';
    m.dataset.hfwGrade=grade;
    gradeSelect.value=grade;
    gradeLabel.textContent=gradeNames[grade];
    renderSettings();
    const savedWord=String(state.currentWord||'');
    if(savedWord&&enabledByGrade[grade].has(savedWord))applyWord(savedWord,measureWordSize(savedWord));
    else{currentWord='';showNext()}
  };

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    ro.disconnect();
    cancelAnimationFrame(resizeFrame);
    measurer.remove();
  };
}

function setupABC(m){
  const card=m.querySelector('.abc-card');
  const letterEl=m.querySelector('.abc-letter');
  const modeLabel=m.querySelector('.abc-mode-label');
  const modeSelect=m.querySelector('.abc-mode');
  const nextButton=m.querySelector('.abc-next');

  const uppercase='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const lowercase='abcdefghijklmnopqrstuvwxyz'.split('');
  const vowels=new Set(['a','e','i','o','u','y']);

  const modeNames={
    uppercase:'Uppercase Letters',
    lowercase:'Lowercase Letters',
    both:'Uppercase + Lowercase'
  };

  let current='';
  let animating=false;
  let resizeFrame=0;

  const measurer=document.createElement('span');
  measurer.className='abc-letter abc-measurer';
  measurer.setAttribute('aria-hidden','true');
  card.appendChild(measurer);

  const measureLetterSize=letter=>{
    const rect=card.getBoundingClientRect();
    const maxWidth=Math.max(80,rect.width-12);
    const maxHeight=Math.max(80,rect.height-14);

    measurer.textContent=letter;

    let low=28;
    let high=Math.max(36,Math.min(720,Math.floor(maxHeight*1.35)));
    let best=low;

    while(low<=high){
      const mid=Math.floor((low+high)/2);
      measurer.style.fontSize=`${mid}px`;
      const measured=measurer.getBoundingClientRect();

      if(measured.width<=maxWidth+1&&measured.height<=maxHeight+1){
        best=mid;
        low=mid+1;
      }else{
        high=mid-1;
      }
    }

    return best;
  };

  const poolForMode=mode=>{
    if(mode==='lowercase')return lowercase;
    if(mode==='both')return [...uppercase,...lowercase];
    return uppercase;
  };

  const chooseLetter=()=>{
    const pool=poolForMode(m.dataset.abcMode||'uppercase');
    let candidates=pool.filter(letter=>letter!==current);
    if(!candidates.length)candidates=pool;
    return candidates[Math.floor(Math.random()*candidates.length)];
  };

  const applyLetter=(letter,size)=>{
    current=letter;
    letterEl.classList.add('is-fitting');
    letterEl.classList.toggle('is-vowel',vowels.has(letter.toLowerCase()));
    letterEl.textContent=letter;
    letterEl.style.fontSize=`${size}px`;
    card.setAttribute('aria-label',`${letter}. Click for another letter.`);
    requestAnimationFrame(()=>letterEl.classList.remove('is-fitting'));
  };

  const fitCurrent=()=>{
    cancelAnimationFrame(resizeFrame);
    resizeFrame=requestAnimationFrame(()=>{
      if(!current)return;
      letterEl.style.fontSize=`${measureLetterSize(current)}px`;
      letterEl.classList.remove('is-fitting');
    });
  };

  const showNext=()=>{
    if(animating)return;

    const next=chooseLetter();
    const size=measureLetterSize(next);

    animating=true;
    card.classList.remove('is-flipping');
    void card.offsetWidth;
    card.classList.add('is-flipping');

    window.setTimeout(()=>applyLetter(next,size),180);
    window.setTimeout(()=>{
      card.classList.remove('is-flipping');
      animating=false;
    },430);
  };

  const setMode=mode=>{
    const next=mode in modeNames?mode:'uppercase';
    m.dataset.abcMode=next;
    modeSelect.value=next;
    modeLabel.textContent=modeNames[next];
    current='';
    showNext();
  };

  card.addEventListener('click',showNext);
  nextButton.addEventListener('click',showNext);
  modeSelect.addEventListener('change',()=>setMode(modeSelect.value));

  m.querySelector('.abc-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.abc-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  const ro=new ResizeObserver(()=>{
    if(current)fitCurrent();
  });
  ro.observe(card);

  setMode('uppercase');

  m._boardGetState=()=>({mode:m.dataset.abcMode||'uppercase',current});
  m._boardSetState=state=>{
    if(!state)return;
    const mode=state.mode in modeNames?state.mode:'uppercase';
    m.dataset.abcMode=mode;
    modeSelect.value=mode;
    modeLabel.textContent=modeNames[mode];
    const saved=String(state.current||'');
    if(saved&&poolForMode(mode).includes(saved))applyLetter(saved,measureLetterSize(saved));
    else{current='';showNext()}
  };

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    ro.disconnect();
    cancelAnimationFrame(resizeFrame);
    measurer.remove();
  };
}

function setupCustomFlashcards(m){
  const card=m.querySelector('.customflashcards-card');
  const image=m.querySelector('.customflashcards-image');
  const textEl=m.querySelector('.customflashcards-text');
  const setLabel=m.querySelector('.customflashcards-set-label');
  const setSelect=m.querySelector('.customflashcards-set-select');
  const nextButton=m.querySelector('.customflashcards-next');
  const manageButton=m.querySelector('.customflashcards-manage');
  const editor=m.querySelector('.customflashcards-editor');
  const editorClose=m.querySelector('.customflashcards-editor-close');
  const setList=m.querySelector('.customflashcards-set-list');
  const addSetButton=m.querySelector('.customflashcards-add-set');
  const setNameInput=m.querySelector('.customflashcards-set-name');
  const deleteSetButton=m.querySelector('.customflashcards-delete-set');
  const cardList=m.querySelector('.customflashcards-card-list');
  const addCardButton=m.querySelector('.customflashcards-add-card');
  const imageInput=m.querySelector('.customflashcards-image-input');
  const status=m.querySelector('.customflashcards-editor-status');

  let serial=0;
  const makeId=prefix=>`${prefix}-${Date.now().toString(36)}-${(++serial).toString(36)}`;
  const makeSet=(name='My Cards')=>({id:makeId('set'),name,cards:[]});
  const makeCard=()=>({id:makeId('card'),text:'',imageSrc:'',imageName:''});

  let sets=[makeSet()];
  let activeSetId=sets[0].id;
  let currentCardId='';
  let uploadTargetId='';
  let animating=false;
  let resizeFrame=0;
  let flipTimer=0;
  let finishTimer=0;
  let statusTimer=0;

  const measurer=document.createElement('span');
  measurer.className='customflashcards-text customflashcards-measurer';
  measurer.setAttribute('aria-hidden','true');
  card.appendChild(measurer);

  const activeSet=()=>sets.find(set=>set.id===activeSetId)||sets[0];
  const currentCard=()=>activeSet()?.cards.find(item=>item.id===currentCardId)||null;

  const setStatus=(message='',isError=false)=>{
    clearTimeout(statusTimer);
    status.textContent=message;
    status.classList.toggle('is-error',isError);
    if(message)statusTimer=window.setTimeout(()=>{
      status.textContent='';
      status.classList.remove('is-error');
    },2600);
  };

  const measureTextSize=(value,hasImage)=>{
    const rect=card.getBoundingClientRect();
    const maxWidth=Math.max(100,rect.width-48);
    const maxHeight=Math.max(44,hasImage?rect.height*.28:rect.height-48);
    const computed=getComputedStyle(textEl);
    measurer.textContent=value||' ';
    measurer.style.width=`${maxWidth}px`;
    measurer.style.fontFamily=computed.fontFamily;
    measurer.style.fontWeight=computed.fontWeight;
    measurer.style.letterSpacing=computed.letterSpacing;

    let low=16;
    let high=Math.max(24,Math.min(150,Math.floor(maxHeight*.92)));
    let best=low;
    while(low<=high){
      const mid=Math.floor((low+high)/2);
      measurer.style.fontSize=`${mid}px`;
      const measured=measurer.getBoundingClientRect();
      if(measured.width<=maxWidth+1&&measured.height<=maxHeight+1){
        best=mid;
        low=mid+1;
      }else high=mid-1;
    }
    return best;
  };

  const applyCardContent=item=>{
    currentCardId=item?.id||'';
    const hasCard=Boolean(item);
    const hasImage=Boolean(item?.imageSrc);
    const value=String(item?.text||'').trim();
    card.classList.toggle('is-empty',!hasCard);
    card.classList.toggle('has-image',hasImage);
    card.classList.toggle('has-text',Boolean(value));

    if(hasImage){
      image.src=item.imageSrc;
      image.alt=value?`${value} flashcard image`:'Flashcard image';
      image.hidden=false;
    }else{
      image.removeAttribute('src');
      image.alt='';
      image.hidden=true;
    }

    textEl.textContent=hasCard?(value||'Untitled card'):'Add your first card';
    textEl.style.fontSize=hasCard?`${measureTextSize(textEl.textContent,hasImage)}px`:'';
    card.setAttribute('aria-label',hasCard
      ?`${value||'Image flashcard'}. Click for another card.`
      :'Open the set editor to add a flashcard.');
  };

  const displayCard=(item,{animate=true}={})=>{
    clearTimeout(flipTimer);
    clearTimeout(finishTimer);
    if(!animate){
      animating=false;
      card.classList.remove('is-flipping');
      applyCardContent(item);
      return;
    }
    if(animating)return;
    animating=true;
    card.classList.remove('is-flipping');
    void card.offsetWidth;
    card.classList.add('is-flipping');
    flipTimer=window.setTimeout(()=>applyCardContent(item),180);
    finishTimer=window.setTimeout(()=>{
      card.classList.remove('is-flipping');
      animating=false;
    },430);
  };

  const showNext=({animate=true}={})=>{
    const pool=activeSet()?.cards||[];
    if(!pool.length){
      displayCard(null,{animate:false});
      return;
    }
    let candidates=pool.filter(item=>item.id!==currentCardId);
    if(!candidates.length)candidates=pool;
    displayCard(candidates[Math.floor(Math.random()*candidates.length)],{animate});
  };

  const updateSetControls=()=>{
    const selected=activeSet();
    setSelect.replaceChildren();
    sets.forEach(set=>{
      const option=document.createElement('option');
      option.value=set.id;
      option.textContent=set.name;
      setSelect.appendChild(option);
    });
    if(selected){
      setSelect.value=selected.id;
      setLabel.textContent=selected.name;
      m.dataset.customFlashcardSet=selected.id;
    }
  };

  const renderSetList=()=>{
    setList.replaceChildren();
    sets.forEach(set=>{
      const button=document.createElement('button');
      button.type='button';
      button.className='customflashcards-set-item';
      button.classList.toggle('is-active',set.id===activeSetId);
      button.innerHTML='<span></span><small></small>';
      button.querySelector('span').textContent=set.name;
      button.querySelector('small').textContent=`${set.cards.length} ${set.cards.length===1?'card':'cards'}`;
      button.addEventListener('click',()=>{
        if(set.id===activeSetId)return;
        activeSetId=set.id;
        currentCardId='';
        updateSetControls();
        renderEditor();
        showNext({animate:false});
      });
      setList.appendChild(button);
    });
  };

  const totalImageLength=(exceptId='')=>sets.reduce((total,set)=>total+set.cards.reduce((sum,item)=>
    sum+(item.id===exceptId?0:String(item.imageSrc||'').length),0),0);

  const renderCardList=()=>{
    cardList.replaceChildren();
    const selected=activeSet();
    if(!selected?.cards.length){
      const empty=document.createElement('div');
      empty.className='customflashcards-editor-empty';
      empty.innerHTML='<strong>No cards yet</strong><span>Add a flashcard, then type text or upload an image.</span>';
      cardList.appendChild(empty);
      return;
    }

    selected.cards.forEach((item,index)=>{
      const row=document.createElement('article');
      row.className='customflashcards-card-row';
      row.dataset.cardId=item.id;

      const number=document.createElement('span');
      number.className='customflashcards-card-number';
      number.textContent=String(index+1);

      const media=document.createElement('button');
      media.type='button';
      media.className='customflashcards-card-media';
      media.title=item.imageSrc?'Replace image':'Upload image';
      media.setAttribute('aria-label',item.imageSrc?'Replace card image':'Upload a card image');
      if(item.imageSrc){
        const preview=document.createElement('img');
        preview.src=item.imageSrc;
        preview.alt='';
        media.appendChild(preview);
      }else media.innerHTML='<span aria-hidden="true">＋</span><small>Image</small>';
      media.addEventListener('click',()=>{
        uploadTargetId=item.id;
        imageInput.click();
      });

      const field=document.createElement('textarea');
      field.className='customflashcards-card-text-input';
      field.maxLength=180;
      field.rows=2;
      field.placeholder='Type the word, question, or answer shown on this card';
      field.value=item.text;
      field.setAttribute('aria-label',`Flashcard ${index+1} text`);
      field.addEventListener('input',()=>{
        item.text=field.value;
        if(item.id===currentCardId)applyCardContent(item);
      });

      const actions=document.createElement('div');
      actions.className='customflashcards-card-row-actions';
      if(item.imageSrc){
        const removeImage=document.createElement('button');
        removeImage.type='button';
        removeImage.textContent='Remove image';
        removeImage.addEventListener('click',()=>{
          item.imageSrc='';
          item.imageName='';
          if(item.id===currentCardId)applyCardContent(item);
          renderCardList();
          notifyBoardChanged('custom-flashcard-image');
        });
        actions.appendChild(removeImage);
      }

      const remove=document.createElement('button');
      remove.type='button';
      remove.className='customflashcards-remove-card';
      remove.textContent='Delete';
      remove.addEventListener('click',()=>{
        selected.cards=selected.cards.filter(cardItem=>cardItem.id!==item.id);
        if(currentCardId===item.id)currentCardId='';
        updateSetControls();
        renderEditor();
        showNext({animate:false});
      });
      actions.appendChild(remove);

      row.append(number,media,field,actions);
      cardList.appendChild(row);
    });
  };

  function renderEditor(){
    const selected=activeSet();
    updateSetControls();
    renderSetList();
    setNameInput.value=selected?.name||'';
    deleteSetButton.disabled=sets.length<=1;
    renderCardList();
  }

  const openEditor=()=>{
    renderEditor();
    editor.hidden=false;
  };

  const closeEditor=()=>{
    editor.hidden=true;
    setStatus('');
  };

  card.addEventListener('click',()=>{
    if(activeSet()?.cards.length)showNext();
    else openEditor();
  });
  nextButton.addEventListener('click',()=>{
    if(activeSet()?.cards.length)showNext();
    else openEditor();
  });
  manageButton.addEventListener('click',openEditor);
  editorClose.addEventListener('click',closeEditor);
  editor.addEventListener('pointerdown',event=>{if(event.target===editor)closeEditor();});
  editor.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});

  setSelect.addEventListener('change',()=>{
    if(!sets.some(set=>set.id===setSelect.value))return;
    activeSetId=setSelect.value;
    currentCardId='';
    updateSetControls();
    showNext({animate:true});
  });

  addSetButton.addEventListener('click',()=>{
    const set=makeSet(`Card Set ${sets.length+1}`);
    sets.push(set);
    activeSetId=set.id;
    currentCardId='';
    renderEditor();
    showNext({animate:false});
    requestAnimationFrame(()=>{
      setNameInput.focus({preventScroll:true});
      setNameInput.select();
    });
  });

  setNameInput.addEventListener('input',()=>{
    const selected=activeSet();
    if(!selected)return;
    selected.name=setNameInput.value.replace(/\s+/g,' ').slice(0,40)||'Untitled Set';
    updateSetControls();
    renderSetList();
  });
  setNameInput.addEventListener('blur',()=>{
    const selected=activeSet();
    if(!selected)return;
    selected.name=setNameInput.value.trim().replace(/\s+/g,' ')||'Untitled Set';
    setNameInput.value=selected.name;
    updateSetControls();
    renderSetList();
  });

  deleteSetButton.addEventListener('click',()=>{
    if(sets.length<=1)return;
    const index=Math.max(0,sets.findIndex(set=>set.id===activeSetId));
    sets=sets.filter(set=>set.id!==activeSetId);
    activeSetId=sets[Math.min(index,sets.length-1)].id;
    currentCardId='';
    renderEditor();
    showNext({animate:false});
  });

  addCardButton.addEventListener('click',()=>{
    const selected=activeSet();
    if(!selected||selected.cards.length>=60){
      setStatus('Each set can hold up to 60 cards.',true);
      return;
    }
    const item=makeCard();
    selected.cards.push(item);
    currentCardId=item.id;
    renderEditor();
    applyCardContent(item);
    requestAnimationFrame(()=>cardList.querySelector(`[data-card-id="${item.id}"] textarea`)?.focus({preventScroll:true}));
  });

  imageInput.addEventListener('change',async()=>{
    const file=imageInput.files?.[0];
    const targetId=uploadTargetId;
    imageInput.value='';
    uploadTargetId='';
    if(!file||!targetId)return;
    setStatus('Preparing image…');
    const data=await fileToBoardImageData(file,{maxSide:720,maxLength:85000,quality:.72,minSide:200});
    const item=sets.flatMap(set=>set.cards).find(cardItem=>cardItem.id===targetId);
    if(!item)return;
    if(!data){
      setStatus('That image could not be prepared. Try a smaller file.',true);
      return;
    }
    if(totalImageLength(targetId)+data.length>620000){
      setStatus('This tile has reached its image storage limit. Remove an image first.',true);
      return;
    }
    item.imageSrc=data;
    item.imageName=file.name||'Flashcard image';
    if(item.id===currentCardId)applyCardContent(item);
    renderCardList();
    setStatus('Image added.');
    notifyBoardChanged('custom-flashcard-image');
  });

  m.querySelector('.customflashcards-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.customflashcards-font').addEventListener('click',()=>{
    cycleData(m,'font',FONT_OPTIONS);
    if(currentCard())applyCardContent(currentCard());
  });
  m.querySelector('.customflashcards-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  const ro=new ResizeObserver(()=>{
    cancelAnimationFrame(resizeFrame);
    resizeFrame=requestAnimationFrame(()=>{
      const item=currentCard();
      if(item)applyCardContent(item);
    });
  });
  ro.observe(card);

  updateSetControls();
  showNext({animate:false});

  m._boardGetState=()=>(
    {
      activeSetId,
      currentCardId,
      sets:sets.map(set=>({
        id:set.id,
        name:set.name,
        cards:set.cards.map(item=>({id:item.id,text:item.text,imageSrc:item.imageSrc,imageName:item.imageName}))
      }))
    }
  );
  m._boardSetState=state=>{
    if(!state)return;
    const usedIds=new Set();
    const restored=[];
    for(const savedSet of Array.isArray(state.sets)?state.sets.slice(0,20):[]){
      const setId=String(savedSet?.id||makeId('set'));
      const uniqueSetId=usedIds.has(setId)?makeId('set'):setId;
      usedIds.add(uniqueSetId);
      const restoredSet={
        id:uniqueSetId,
        name:String(savedSet?.name||'Untitled Set').trim().slice(0,40)||'Untitled Set',
        cards:[]
      };
      for(const savedCard of Array.isArray(savedSet?.cards)?savedSet.cards.slice(0,60):[]){
        const cardId=String(savedCard?.id||makeId('card'));
        const uniqueCardId=usedIds.has(cardId)?makeId('card'):cardId;
        usedIds.add(uniqueCardId);
        const imageSrc=String(savedCard?.imageSrc||'');
        restoredSet.cards.push({
          id:uniqueCardId,
          text:String(savedCard?.text||'').slice(0,180),
          imageSrc:/^data:image\//i.test(imageSrc)?imageSrc:'',
          imageName:String(savedCard?.imageName||'').slice(0,120)
        });
      }
      restored.push(restoredSet);
    }
    sets=restored.length?restored:[makeSet()];
    activeSetId=sets.some(set=>set.id===state.activeSetId)?state.activeSetId:sets[0].id;
    const selected=activeSet();
    const savedCurrent=String(state.currentCardId||'');
    currentCardId=selected.cards.some(item=>item.id===savedCurrent)?savedCurrent:'';
    renderEditor();
    const item=currentCard();
    if(item)displayCard(item,{animate:false});
    else showNext({animate:false});
  };

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    ro.disconnect();
    cancelAnimationFrame(resizeFrame);
    clearTimeout(flipTimer);
    clearTimeout(finishTimer);
    clearTimeout(statusTimer);
    measurer.remove();
  };
}

function setupRuler(m){
  const stage=m.querySelector('.ruler-stage');
  const face=m.querySelector('.ruler-face');
  const svg=m.querySelector('.ruler-svg');
  const measurement=m.querySelector('.ruler-measurement');
  const handles={
    a:m.querySelector('[data-ruler-handle="a"]'),
    b:m.querySelector('[data-ruler-handle="b"]')
  };
  const readouts={
    a:m.querySelector('.ruler-a-value'),
    b:m.querySelector('.ruler-b-value')
  };
  const selectButtons=[...m.querySelectorAll('[data-ruler-select]')];
  const unitButtons=[...m.querySelectorAll('[data-ruler-unit-option]')];
  const resetButton=m.querySelector('.ruler-reset');

  let unit='in';
  let a=0;
  let b=1;
  let active='a';
  let dragging=null;
  let scaleFrame=0;

  const config=()=>unit==='cm'
    ?{max:30,divisions:10}
    :{max:12,divisions:8};

  const formatInches=value=>{
    const eighths=Math.round(value*8);
    const whole=Math.floor(eighths/8);
    const remainder=eighths%8;
    if(!remainder)return`${whole} in`;

    const divisor=remainder%4===0?4:remainder%2===0?2:1;
    const numerator=remainder/divisor;
    const denominator=8/divisor;

    return whole
      ?`${whole} ${numerator}/${denominator} in`
      :`${numerator}/${denominator} in`;
  };

  const formatValue=value=>{
    if(unit==='in')return formatInches(value);
    const rounded=Math.round(value*10)/10;
    return`${Number(rounded.toFixed(1))} cm`;
  };

  const valueFromFraction=fraction=>{
    const {max,divisions}=config();
    const steps=max*divisions;
    return Math.round(Math.max(0,Math.min(1,fraction))*steps)/divisions;
  };

  const renderScale=()=>{
    cancelAnimationFrame(scaleFrame);
    scaleFrame=requestAnimationFrame(()=>{
      const {max,divisions}=config();
      const total=max*divisions;

      const width=Math.max(320,Math.round(face.clientWidth||stage.clientWidth||760));
      const height=Math.max(82,Math.round(face.clientHeight||98));
      const baseline=height;
      const labelY=Math.max(17,Math.round(height*.22));

      svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
      svg.replaceChildren();

      const make=(tag,attrs={})=>{
        const el=document.createElementNS('http://www.w3.org/2000/svg',tag);
        Object.entries(attrs).forEach(([key,value])=>el.setAttribute(key,String(value)));
        return el;
      };

      const cmLabelEvery=width<590?5:width<820?2:1;

      for(let step=0;step<=total;step++){
        const x=step/total*width;
        const fraction=step/divisions;
        const isMajor=step%divisions===0;

        let tickHeight;
        if(unit==='in'){
          const eighth=step%8;
          tickHeight=isMajor
            ?Math.round(height*.55)
            :eighth===4
              ?Math.round(height*.40)
              :eighth%2===0
                ?Math.round(height*.30)
                :Math.round(height*.22);
        }else{
          const tenth=step%10;
          tickHeight=isMajor
            ?Math.round(height*.55)
            :tenth===5
              ?Math.round(height*.38)
              :Math.round(height*.23);
        }

        svg.appendChild(make('line',{
          x1:x,
          x2:x,
          y1:baseline-tickHeight,
          y2:baseline,
          class:isMajor?'ruler-tick ruler-tick--major':'ruler-tick'
        }));

        const showLabel=isMajor&&(
          unit==='in'||
          Math.round(fraction)%cmLabelEvery===0
        );

        if(showLabel){
          const label=make('text',{
            x,
            y:labelY,
            'text-anchor':step===0?'start':step===total?'end':'middle',
            class:'ruler-scale-label'
          });
          label.textContent=String(Math.round(fraction));
          svg.appendChild(label);
        }
      }
    });
  };

  const render=()=>{
    const {max}=config();
    const aValue=a*max;
    const bValue=b*max;
    const distance=Math.abs(bValue-aValue);

    handles.a.style.setProperty('--ruler-position',`${a*100}%`);
    handles.b.style.setProperty('--ruler-position',`${b*100}%`);

    handles.a.classList.toggle('is-active',active==='a');
    handles.b.classList.toggle('is-active',active==='b');

    selectButtons.forEach(button=>{
      button.classList.toggle('is-active',button.dataset.rulerSelect===active);
    });

    readouts.a.textContent=formatValue(aValue);
    readouts.b.textContent=formatValue(bValue);
    measurement.textContent=formatValue(distance);

    handles.a.setAttribute('aria-label',`Point A at ${formatValue(aValue)}`);
    handles.b.setAttribute('aria-label',`Point B at ${formatValue(bValue)}`);
  };

  const setHandleFromClient=(which,clientX)=>{
    const rect=stage.getBoundingClientRect();
    if(!rect.width)return;

    const raw=(clientX-rect.left)/rect.width;
    const {max}=config();
    const snapped=valueFromFraction(raw);
    const fraction=snapped/max;

    if(which==='a')a=fraction;
    else b=fraction;

    render();
  };

  const select=which=>{
    active=which==='b'?'b':'a';
    render();
  };

  Object.entries(handles).forEach(([which,handle])=>{
    handle.addEventListener('pointerdown',event=>{
      if(event.button!==0)return;
      event.preventDefault();
      event.stopPropagation();

      dragging=which;
      select(which);
      handle.setPointerCapture(event.pointerId);
      setHandleFromClient(which,event.clientX);
    });

    handle.addEventListener('pointermove',event=>{
      if(dragging!==which)return;
      event.preventDefault();
      setHandleFromClient(which,event.clientX);
    });

    const stop=event=>{
      if(dragging!==which)return;
      dragging=null;
      try{handle.releasePointerCapture(event.pointerId)}catch{}
    };

    handle.addEventListener('pointerup',stop);
    handle.addEventListener('pointercancel',stop);
  });

  stage.addEventListener('pointerdown',event=>{
    if(event.button!==0||event.target.closest('.ruler-handle'))return;
    event.preventDefault();
    setHandleFromClient(active,event.clientX);
  });

  selectButtons.forEach(button=>{
    button.addEventListener('click',()=>select(button.dataset.rulerSelect));
  });

  unitButtons.forEach(button=>{
    button.addEventListener('click',()=>{
      unit=button.dataset.rulerUnitOption==='cm'?'cm':'in';
      m.dataset.rulerUnit=unit;

      unitButtons.forEach(item=>{
        item.classList.toggle('is-active',item.dataset.rulerUnitOption===unit);
      });

      renderScale();
      render();
    });
  });

  resetButton.addEventListener('click',()=>{
    a=0;
    b=1;
    active='a';
    render();
  });

  m.querySelector('.ruler-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.ruler-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.ruler-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  const rulerResizeObserver=new ResizeObserver(renderScale);
  rulerResizeObserver.observe(face);

  renderScale();
  render();

  m._boardGetState=()=>({unit,a,b,active});
  m._boardSetState=state=>{
    if(!state)return;
    unit=state.unit==='cm'?'cm':'in';
    a=clamp(Number(state.a)||0,0,1);
    b=clamp(Number(state.b)??1,0,1);
    active=state.active==='b'?'b':'a';
    m.dataset.rulerUnit=unit;
    unitButtons.forEach(item=>item.classList.toggle('is-active',item.dataset.rulerUnitOption===unit));
    renderScale();
    render();
  };

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    rulerResizeObserver.disconnect();
    cancelAnimationFrame(scaleFrame);
  };
}


function setupCalculator(m){
  const expressionEl=m.querySelector('.calculator-expression');
  const valueEl=m.querySelector('.calculator-value');
  const valueButtons=[...m.querySelectorAll('[data-calc-value]')];
  const actionButtons=[...m.querySelectorAll('[data-calc-action]')];

  let expression='';
  let justEvaluated=false;

  const displayExpression=value=>value
    .replace(/\*/g,'×')
    .replace(/\//g,'÷');

  const evaluate=()=>{
    if(!expression)return 0;
    if(!/^[0-9+\-*/().\s]+$/.test(expression))throw new Error('Invalid expression');
    const result=Function(`"use strict";return (${expression})`)();
    if(typeof result!=='number'||!Number.isFinite(result))throw new Error('Invalid result');
    return Math.round((result+Number.EPSILON)*1e12)/1e12;
  };

  const render=()=>{
    expressionEl.textContent=displayExpression(expression);
    if(!expression){
      valueEl.textContent='0';
      return;
    }
    try{
      const endsWithOperator=/[+\-*/.(]$/.test(expression);
      if(!endsWithOperator)valueEl.textContent=String(evaluate());
    }catch{
      valueEl.textContent='…';
    }
  };

  const append=value=>{
    if(justEvaluated&&/[0-9.]/.test(value)){
      expression='';
    }
    justEvaluated=false;

    if(/[+\-*/]/.test(value)){
      if(!expression&&value!=='-')return;
      if(/[+\-*/]$/.test(expression)){
        expression=expression.slice(0,-1)+value;
        render();
        return;
      }
    }

    if(value==='.'){
      const tail=expression.split(/[+\-*/()]/).at(-1)||'';
      if(tail.includes('.'))return;
      if(!tail)expression+='0';
    }

    expression+=value;
    render();
  };

  const equals=()=>{
    if(!expression)return;
    try{
      const result=evaluate();
      expression=String(result);
      valueEl.textContent=String(result);
      expressionEl.textContent='';
      justEvaluated=true;
    }catch{
      valueEl.textContent='Error';
      justEvaluated=true;
    }
  };

  const percent=()=>{
    const match=expression.match(/(-?\d*\.?\d+)$/);
    if(!match)return;
    const value=Number(match[1])/100;
    expression=expression.slice(0,-match[1].length)+String(value);
    render();
  };

  const toggleSign=()=>{
    const match=expression.match(/(-?\d*\.?\d+)$/);
    if(!match)return;
    const raw=match[1];
    const replacement=raw.startsWith('-')?raw.slice(1):`-${raw}`;
    expression=expression.slice(0,-raw.length)+replacement;
    render();
  };

  valueButtons.forEach(button=>button.addEventListener('click',()=>append(button.dataset.calcValue)));

  actionButtons.forEach(button=>button.addEventListener('click',()=>{
    switch(button.dataset.calcAction){
      case 'clear':
        expression='';
        justEvaluated=false;
        render();
        break;
      case 'backspace':
        expression=expression.slice(0,-1);
        justEvaluated=false;
        render();
        break;
      case 'percent':
        percent();
        break;
      case 'sign':
        toggleSign();
        break;
      case 'equals':
        equals();
        break;
    }
  }));

  m.addEventListener('pointerdown',event=>{
    if(!event.target.closest('.module-delete,.resize-handle'))m.focus({preventScroll:true});
  });

  m.addEventListener('keydown',event=>{
    if(event.target.closest('input,textarea'))return;

    if(/^[0-9.]$/.test(event.key)){
      event.preventDefault();
      append(event.key);
    }else if(['+','-','*','/','(',')'].includes(event.key)){
      event.preventDefault();
      append(event.key);
    }else if(event.key==='Enter'||event.key==='='){
      event.preventDefault();
      equals();
    }else if(event.key==='Backspace'){
      event.preventDefault();
      expression=expression.slice(0,-1);
      render();
    }else if(event.key==='Escape'){
      expression='';
      render();
    }
  });

  m.querySelector('.calculator-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.calculator-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.calculator-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  m._boardGetState=()=>({expression,justEvaluated});
  m._boardSetState=state=>{
    expression=typeof state?.expression==='string'?state.expression:'';
    justEvaluated=Boolean(state?.justEvaluated);
    render();
  };

  render();
}

function setupGrapher(m){
  const svg=m.querySelector('.grapher-svg');
  const equationInput=m.querySelector('.grapher-equation');
  const graphButton=m.querySelector('.grapher-graph-equation');
  const pointX=m.querySelector('.grapher-point-x');
  const pointY=m.querySelector('.grapher-point-y');
  const addPointButton=m.querySelector('.grapher-add-point');
  const clearPoints=m.querySelector('.grapher-clear-points');
  const coordinateReadout=m.querySelector('.grapher-coordinate-readout');
  const xminInput=m.querySelector('.grapher-xmin');
  const xmaxInput=m.querySelector('.grapher-xmax');
  const yminInput=m.querySelector('.grapher-ymin');
  const ymaxInput=m.querySelector('.grapher-ymax');
  const applyRange=m.querySelector('.grapher-apply-range');
  const error=m.querySelector('.grapher-error');

  let range={xmin:-10,xmax:10,ymin:-10,ymax:10};
  let points=[];
  let equation='x';

  const W=700,H=480,pad=34;
  const mapX=x=>pad+(x-range.xmin)/(range.xmax-range.xmin)*(W-pad*2);
  const mapY=y=>H-pad-(y-range.ymin)/(range.ymax-range.ymin)*(H-pad*2);
  const unmapX=px=>range.xmin+(px-pad)/(W-pad*2)*(range.xmax-range.xmin);
  const unmapY=py=>range.ymin+(H-pad-py)/(H-pad*2)*(range.ymax-range.ymin);

  const niceStep=span=>{
    const raw=span/10;
    const power=Math.pow(10,Math.floor(Math.log10(raw)));
    const normalized=raw/power;
    const nice=normalized<=1?1:normalized<=2?2:normalized<=5?5:10;
    return nice*power;
  };

  const compileEquation=raw=>{
    let expr=(raw||'').trim().toLowerCase().replace(/^y\s*=\s*/,'').replace(/\^/g,'**');
    if(!expr)throw new Error('Enter an equation.');

    const words=expr.match(/[a-z]+/g)||[];
    const allowed=new Set(['x','sin','cos','tan','sqrt','abs','log','ln','exp','floor','ceil','round','pi','e']);
    if(words.some(word=>!allowed.has(word)))throw new Error('Use x, numbers, + − × ÷, powers, and common functions.');

    if(!/^[0-9a-z+\-*/().,\s*]+$/.test(expr))throw new Error('That equation contains unsupported characters.');

    expr=expr
      .replace(/\bpi\b/g,'Math.PI')
      .replace(/\be\b/g,'Math.E')
      .replace(/\bln\b/g,'Math.log')
      .replace(/\b(sin|cos|tan|sqrt|abs|log|exp|floor|ceil|round)\b/g,'Math.$1');

    const fn=Function('x',`"use strict";return (${expr})`);
    const test=fn(0);
    if(typeof test!=='number')throw new Error('Could not graph that equation.');
    return fn;
  };

  const makeSvg=(tag,attrs={})=>{
    const el=document.createElementNS('http://www.w3.org/2000/svg',tag);
    Object.entries(attrs).forEach(([key,value])=>el.setAttribute(key,String(value)));
    return el;
  };

  const render=()=>{
    svg.replaceChildren();

    const plot=makeSvg('rect',{x:pad,y:pad,width:W-pad*2,height:H-pad*2,class:'grapher-plot-bg'});
    svg.appendChild(plot);

    const xStep=niceStep(range.xmax-range.xmin);
    const yStep=niceStep(range.ymax-range.ymin);

    const firstX=Math.ceil(range.xmin/xStep)*xStep;
    for(let x=firstX;x<=range.xmax+1e-9;x+=xStep){
      const px=mapX(x);
      const line=makeSvg('line',{x1:px,x2:px,y1:pad,y2:H-pad,class:Math.abs(x)<1e-9?'grapher-axis':'grapher-grid-line'});
      svg.appendChild(line);
      const label=makeSvg('text',{x:px,y:Math.min(H-pad+20,Math.max(pad+14,mapY(0)+18)),class:'grapher-axis-label','text-anchor':'middle'});
      label.textContent=Number(x.toFixed(6)).toString();
      svg.appendChild(label);
    }

    const firstY=Math.ceil(range.ymin/yStep)*yStep;
    for(let y=firstY;y<=range.ymax+1e-9;y+=yStep){
      const py=mapY(y);
      const line=makeSvg('line',{x1:pad,x2:W-pad,y1:py,y2:py,class:Math.abs(y)<1e-9?'grapher-axis':'grapher-grid-line'});
      svg.appendChild(line);
      if(Math.abs(y)>1e-9){
        const label=makeSvg('text',{x:Math.min(W-pad-4,Math.max(pad+4,mapX(0)+7)),y:py-5,class:'grapher-axis-label'});
        label.textContent=Number(y.toFixed(6)).toString();
        svg.appendChild(label);
      }
    }

    try{
      const fn=compileEquation(equation);
      let d='';
      let drawing=false;

      for(let px=pad;px<=W-pad;px+=2){
        const x=unmapX(px);
        let y;
        try{y=fn(x)}catch{y=NaN}

        if(Number.isFinite(y)&&y>=range.ymin-(range.ymax-range.ymin)*.2&&y<=range.ymax+(range.ymax-range.ymin)*.2){
          const py=mapY(y);
          d+=`${drawing?'L':'M'}${px.toFixed(2)},${py.toFixed(2)}`;
          drawing=true;
        }else{
          drawing=false;
        }
      }

      if(d){
        const path=makeSvg('path',{d,class:'grapher-function'});
        svg.appendChild(path);
      }
      error.textContent='';
    }catch(err){
      error.textContent=err.message||'Could not graph that equation.';
    }

    points.forEach((point,index)=>{
      const group=makeSvg('g',{class:'grapher-point',tabindex:'0'});
      const circle=makeSvg('circle',{cx:mapX(point.x),cy:mapY(point.y),r:7});
      const label=makeSvg('text',{x:mapX(point.x)+10,y:mapY(point.y)-10});
      label.textContent=`(${Number(point.x.toFixed(2))}, ${Number(point.y.toFixed(2))})`;
      group.append(circle,label);
      group.addEventListener('click',event=>{
        event.stopPropagation();
        points.splice(index,1);
        render();
      });
      svg.appendChild(group);
    });

    svg.setAttribute('aria-label',`Coordinate plane from x ${range.xmin} to ${range.xmax} and y ${range.ymin} to ${range.ymax}.`);
  };

  const addPoint=(x,y)=>{
    if(!Number.isFinite(x)||!Number.isFinite(y))return;
    if(x<range.xmin||x>range.xmax||y<range.ymin||y>range.ymax){
      error.textContent='That point is outside the current graph range.';
      return;
    }
    points.push({x,y});
    coordinateReadout.textContent=`Last point: (${Number(x.toFixed(2))}, ${Number(y.toFixed(2))})`;
    error.textContent='';
    render();
  };

  svg.addEventListener('click',event=>{
    if(event.target.closest?.('.grapher-point'))return;
    const rect=svg.getBoundingClientRect();
    const px=(event.clientX-rect.left)/rect.width*W;
    const py=(event.clientY-rect.top)/rect.height*H;
    if(px<pad||px>W-pad||py<pad||py>H-pad)return;
    addPoint(unmapX(px),unmapY(py));
  });

  addPointButton.addEventListener('click',()=>addPoint(Number(pointX.value),Number(pointY.value)));
  clearPoints.addEventListener('click',()=>{points=[];coordinateReadout.textContent='Click the plane to place points';render();});

  const graphEquation=()=>{
    equation=equationInput.value.trim()||'x';
    render();
  };
  graphButton.addEventListener('click',graphEquation);
  equationInput.addEventListener('keydown',event=>{
    if(event.key==='Enter'){event.preventDefault();graphEquation();}
  });

  applyRange.addEventListener('click',()=>{
    const next={
      xmin:Number(xminInput.value),xmax:Number(xmaxInput.value),
      ymin:Number(yminInput.value),ymax:Number(ymaxInput.value)
    };
    if(!Object.values(next).every(Number.isFinite)||next.xmin>=next.xmax||next.ymin>=next.ymax){
      error.textContent='Use valid minimum and maximum values.';
      return;
    }
    range=next;
    points=points.filter(p=>p.x>=range.xmin&&p.x<=range.xmax&&p.y>=range.ymin&&p.y<=range.ymax);
    error.textContent='';
    render();
  });

  m.querySelector('.grapher-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.grapher-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.grapher-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  m._boardGetState=()=>({range:{...range},points:points.map(point=>({...point})),equation});
  m._boardSetState=state=>{
    if(!state)return;
    if(state.range&&['xmin','xmax','ymin','ymax'].every(key=>Number.isFinite(Number(state.range[key])))){
      range={xmin:Number(state.range.xmin),xmax:Number(state.range.xmax),ymin:Number(state.range.ymin),ymax:Number(state.range.ymax)};
      xminInput.value=String(range.xmin);xmaxInput.value=String(range.xmax);yminInput.value=String(range.ymin);ymaxInput.value=String(range.ymax);
    }
    points=Array.isArray(state.points)?state.points.filter(point=>Number.isFinite(Number(point.x))&&Number.isFinite(Number(point.y))).map(point=>({x:Number(point.x),y:Number(point.y)})):[];
    equation=typeof state.equation==='string'?state.equation:'x';
    equationInput.value=equation;
    render();
  };

  render();
}

function setupPeriodicTable(m){
  const grid=m.querySelector('.periodic-grid');
  const legend=m.querySelector('.periodic-legend');
  const detail=m.querySelector('.periodic-detail');
  const closeButton=m.querySelector('.periodic-detail-close');
  const symbolEl=m.querySelector('.periodic-detail-symbol');
  const numberEl=m.querySelector('.periodic-detail-number');
  const nameEl=m.querySelector('.periodic-detail-name');
  const categoryEl=m.querySelector('.periodic-detail-category');
  const facts=m.querySelector('.periodic-detail-facts');

  const categoryOrder=[
    'Alkali metal','Alkaline earth metal','Transition metal','Post-transition metal',
    'Metalloid','Reactive nonmetal','Halogen','Noble gas','Lanthanide','Actinide'
  ];

  const openElement=element=>{
    symbolEl.textContent=element.symbol;
    symbolEl.dataset.category=element.categoryKey;
    numberEl.textContent=`Atomic number ${element.n}`;
    nameEl.textContent=element.name;
    categoryEl.textContent=element.category;

    const group=element.group===null?'f-block':`Group ${element.group}`;
    facts.replaceChildren();

    [
      ['Atomic mass',element.mass],
      ['Period',String(element.period)],
      ['Group',group],
      ['Block',`${element.block}-block`]
    ].forEach(([label,value])=>{
      const item=document.createElement('div');
      const small=document.createElement('span');
      small.textContent=label;
      const strong=document.createElement('strong');
      strong.textContent=value;
      item.append(small,strong);
      facts.appendChild(item);
    });

    detail.hidden=false;
    detail.classList.remove('periodic-detail-pop');
    void detail.offsetWidth;
    detail.classList.add('periodic-detail-pop');
  };

  PERIODIC_ELEMENTS.forEach(element=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='periodic-element';
    button.dataset.category=element.categoryKey;
    button.style.gridRow=String(element.row);
    button.style.gridColumn=String(element.col);
    button.setAttribute('aria-label',`${element.name}, atomic number ${element.n}`);

    const number=document.createElement('span');
    number.className='periodic-element-number';
    number.textContent=String(element.n);

    const symbol=document.createElement('strong');
    symbol.textContent=element.symbol;

    const name=document.createElement('span');
    name.className='periodic-element-name';
    name.textContent=element.name;

    button.append(number,symbol,name);
    button.addEventListener('click',()=>openElement(element));
    grid.appendChild(button);
  });

  categoryOrder.forEach(category=>{
    const sample=PERIODIC_ELEMENTS.find(element=>element.category===category);
    if(!sample)return;

    const item=document.createElement('span');
    item.className='periodic-legend-item';

    const swatch=document.createElement('i');
    swatch.dataset.category=sample.categoryKey;

    const text=document.createElement('span');
    text.textContent=category;

    item.append(swatch,text);
    legend.appendChild(item);
  });

  closeButton.addEventListener('click',()=>{detail.hidden=true;});
  detail.addEventListener('keydown',event=>{
    if(event.key==='Escape')detail.hidden=true;
  });

  m.querySelector('.periodic-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.periodic-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
}

function setupMoney(m){
  const workspaceEl=m.querySelector('.money-workspace');
  const palette=m.querySelector('.money-palette');
  const totalEl=m.querySelector('.money-total');
  const toggleTotal=m.querySelector('.money-toggle-total');
  const countEl=m.querySelector('.money-count');
  const clearButton=m.querySelector('.money-clear');
  const empty=m.querySelector('.money-workspace-empty');
  const pieceDeleteZone=m.querySelector('.money-piece-delete-zone');

  const denominations=[
    {id:'penny',label:'Penny',cents:1,src:'assets/money/penny.png'},
    {id:'nickel',label:'Nickel',cents:5,src:'assets/money/nickle.png'},
    {id:'dime',label:'Dime',cents:10,src:'assets/money/dime.png'},
    {id:'quarter',label:'Quarter',cents:25,src:'assets/money/quarter.png'},
    {id:'half-dollar',label:'Half Dollar',cents:50,src:'assets/money/half dollar.png'},
    {id:'dollar',label:'Dollar',cents:100,src:'assets/money/dollar.png'}
  ];

  let pieces=[];
  let nextId=0;
  let totalVisible=true;
  let paletteDragId='';

  const denom=id=>denominations.find(item=>item.id===id);

  const workspacePoint=(clientX,clientY)=>{
    const rect=workspaceEl.getBoundingClientRect();
    const scaleX=rect.width>0?workspaceEl.clientWidth/rect.width:1;
    const scaleY=rect.height>0?workspaceEl.clientHeight/rect.height:1;
    return{
      x:(clientX-rect.left)*scaleX,
      y:(clientY-rect.top)*scaleY
    };
  };

  const pieceSize=denomId=>denomId==='dollar'?{width:104,height:82}:{width:78,height:78};

  const updateSummary=()=>{
    const cents=pieces.reduce((sum,piece)=>sum+(denom(piece.denom)?.cents||0),0);
    totalEl.textContent=`$${(cents/100).toFixed(2)}`;
    totalEl.classList.toggle('is-hidden',!totalVisible);
    toggleTotal.textContent=totalVisible?'Hide Total':'Show Total';
    countEl.textContent=`${pieces.length} ${pieces.length===1?'piece':'pieces'}`;
    empty.hidden=pieces.length>0;
  };

  const clampPiece=(piece,el)=>{
    const w=el?.offsetWidth||76;
    const h=el?.offsetHeight||76;
    piece.x=Math.max(0,Math.min(workspaceEl.clientWidth-w,piece.x));
    piece.y=Math.max(0,Math.min(workspaceEl.clientHeight-h,piece.y));
  };

  const addPiece=(denomId,x=null,y=null)=>{
    const d=denom(denomId);
    if(!d)return;

    const piece={
      id:++nextId,
      denom:denomId,
      x:x===null?Math.max(8,(workspaceEl.clientWidth-76)/2+(Math.random()-.5)*70):x,
      y:y===null?Math.max(8,(workspaceEl.clientHeight-76)/2+(Math.random()-.5)*50):y
    };
    pieces.push(piece);
    renderPieces();
    playUiSfx('money');
  };

  const renderPieces=()=>{
    workspaceEl.querySelectorAll('.money-piece').forEach(el=>el.remove());

    pieces.forEach(piece=>{
      const d=denom(piece.denom);
      const el=document.createElement('button');
      el.type='button';
      el.className=`money-piece money-piece--${piece.denom}`;
      el.dataset.moneyPiece=String(piece.id);
      el.style.left=`${piece.x}px`;
      el.style.top=`${piece.y}px`;
      el.title=`${d.label} · drag to move · double-click to remove`;
      el.setAttribute('aria-label',`${d.label}. Drag to move. Double click to remove.`);

      const img=document.createElement('img');
      img.src=d.src;
      img.alt=d.label;
      img.draggable=false;
      el.appendChild(img);

      let dragging=false;
      let offsetX=0;
      let offsetY=0;

      el.addEventListener('pointerdown',event=>{
        if(event.button!==0)return;
        event.stopPropagation();
        dragging=true;
        const point=workspacePoint(event.clientX,event.clientY);
        offsetX=point.x-piece.x;
        offsetY=point.y-piece.y;
        el.setPointerCapture(event.pointerId);
        el.classList.add('is-dragging');
        m.classList.add('is-dragging-money-piece');
      });

      el.addEventListener('pointermove',event=>{
        if(!dragging)return;
        const point=workspacePoint(event.clientX,event.clientY);
        piece.x=point.x-offsetX;
        piece.y=point.y-offsetY;
        clampPiece(piece,el);
        el.style.left=`${piece.x}px`;
        el.style.top=`${piece.y}px`;
        const deleteRect=pieceDeleteZone.getBoundingClientRect();
        const overDelete=event.clientX>=deleteRect.left&&event.clientX<=deleteRect.right&&event.clientY>=deleteRect.top&&event.clientY<=deleteRect.bottom;
        pieceDeleteZone.classList.toggle('is-armed',overDelete);
      });

      const stopDrag=(event,{cancelled=false}={})=>{
        if(!dragging)return;
        dragging=false;
        el.classList.remove('is-dragging');
        try{el.releasePointerCapture(event.pointerId)}catch{}
        const shouldDelete=!cancelled&&pieceDeleteZone.classList.contains('is-armed');
        pieceDeleteZone.classList.remove('is-armed');
        m.classList.remove('is-dragging-money-piece');
        if(shouldDelete){
          pieces=pieces.filter(item=>item.id!==piece.id);
          renderPieces();
        }
      };

      el.addEventListener('pointerup',stopDrag);
      el.addEventListener('pointercancel',event=>stopDrag(event,{cancelled:true}));

      el.addEventListener('dblclick',event=>{
        event.stopPropagation();
        pieces=pieces.filter(item=>item.id!==piece.id);
        renderPieces();
      });

      workspaceEl.appendChild(el);
    });

    updateSummary();
  };

  denominations.forEach(d=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='money-palette-item';
    button.dataset.denom=d.id;
    button.setAttribute('aria-label',`Add a ${d.label}`);

    const img=document.createElement('img');
    img.src=d.src;
    img.alt='';
    img.className='money-palette-piece';
    img.draggable=true;

    const text=document.createElement('span');
    const label=document.createElement('strong');
    label.textContent=d.label;
    const value=document.createElement('small');
    value.textContent=d.cents>=100?'$1.00':`${d.cents}¢`;
    text.append(label,value);

    button.append(img,text);

    button.addEventListener('click',()=>addPiece(d.id));
    img.addEventListener('dragstart',event=>{
      event.stopPropagation();
      paletteDragId=d.id;
      event.dataTransfer?.clearData();
      event.dataTransfer?.setData('text/plain',d.id);
      if(event.dataTransfer)event.dataTransfer.effectAllowed='copy';
    });
    img.addEventListener('dragend',()=>{paletteDragId='';});

    palette.appendChild(button);
  });

  workspaceEl.addEventListener('dragover',event=>{
    event.preventDefault();
    workspaceEl.classList.add('is-drop-target');
    if(event.dataTransfer)event.dataTransfer.dropEffect='copy';
  });

  workspaceEl.addEventListener('dragleave',event=>{
    if(!workspaceEl.contains(event.relatedTarget))workspaceEl.classList.remove('is-drop-target');
  });

  workspaceEl.addEventListener('drop',event=>{
    event.preventDefault();
    event.stopPropagation();
    workspaceEl.classList.remove('is-drop-target');

    const id=paletteDragId||event.dataTransfer?.getData('text/plain');
    if(!denom(id))return;

    const point=workspacePoint(event.clientX,event.clientY);
    const size=pieceSize(id);
    addPiece(id,point.x-size.width/2,point.y-size.height/2);
  });

  toggleTotal.addEventListener('click',()=>{
    totalVisible=!totalVisible;
    updateSummary();
  });

  clearButton.addEventListener('click',()=>{
    pieces=[];
    renderPieces();
  });

  m.querySelector('.money-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.money-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.money-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  const ro=new ResizeObserver(()=>{
    pieces.forEach(piece=>{
      const el=workspaceEl.querySelector(`[data-money-piece="${piece.id}"]`);
      if(el){
        clampPiece(piece,el);
        el.style.left=`${piece.x}px`;
        el.style.top=`${piece.y}px`;
      }
    });
  });
  ro.observe(workspaceEl);

  m._boardGetState=()=>({pieces:pieces.map(piece=>({...piece})),totalVisible});
  m._boardSetState=state=>{
    if(!state)return;
    pieces=Array.isArray(state.pieces)?state.pieces.filter(piece=>denom(piece.denom)).map((piece,index)=>({
      id:index+1,
      denom:piece.denom,
      x:Number(piece.x)||0,
      y:Number(piece.y)||0
    })):[];
    nextId=pieces.length;
    totalVisible=state.totalVisible!==false;
    renderPieces();
  };

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    ro.disconnect();
  };

  renderPieces();
}

function setupPatternMaker(m){
  const board=m.querySelector('.pattern-maker-board');
  const palette=m.querySelector('.pattern-maker-palette');
  const typeSelect=m.querySelector('.pattern-maker-type');
  const lengthSelect=m.querySelector('.pattern-maker-length');
  const applyButton=m.querySelector('.pattern-maker-apply');
  const addRowButton=m.querySelector('.pattern-maker-add-row');
  const clearButton=m.querySelector('.pattern-maker-clear');
  const colors=[
    {id:'red',label:'Red',value:'#ef4b45'},{id:'orange',label:'Orange',value:'#f58a3c'},
    {id:'yellow',label:'Yellow',value:'#f2cf45'},{id:'green',label:'Green',value:'#32a875'},
    {id:'blue',label:'Blue',value:'#3978cf'},{id:'purple',label:'Purple',value:'#8b5bc7'},
    {id:'pink',label:'Pink',value:'#e96f9e'},{id:'teal',label:'Teal',value:'#2aa8ad'}
  ];
  const patterns={ab:[0,1],aab:[0,0,1],abb:[0,1,1],abc:[0,1,2],abbc:[0,1,1,2]};
  let length=12;
  let rows=[Array(length).fill(''),Array(length).fill('')];
  let selectedColor='red';
  let painting=false;

  const colorById=id=>colors.find(color=>color.id===id);
  const normalizeRows=input=>{
    const source=Array.isArray(input)&&input.length?input.slice(0,4):[[]];
    return source.map(row=>Array.from({length},(_,index)=>colorById(row?.[index])?row[index]:''));
  };
  const notify=reason=>notifyBoardChanged(`pattern-maker-${reason}`);

  const paint=(rowIndex,cellIndex)=>{
    if(!rows[rowIndex]||cellIndex<0||cellIndex>=length)return;
    rows[rowIndex][cellIndex]=selectedColor;
    const cell=board.querySelector(`[data-pattern-row="${rowIndex}"][data-pattern-cell="${cellIndex}"]`);
    if(cell){cell.dataset.color=selectedColor;cell.style.setProperty('--pattern-cell-color',colorById(selectedColor)?.value||'transparent')}
  };

  const renderBoard=()=>{
    board.replaceChildren();
    rows.forEach((row,rowIndex)=>{
      const line=document.createElement('div');
      line.className='pattern-maker-row';
      const label=document.createElement('span');
      label.className='pattern-maker-row-label';
      label.textContent=`${rowIndex+1}`;
      const cells=document.createElement('div');
      cells.className='pattern-maker-cells';
      cells.style.gridTemplateColumns=`repeat(${length},minmax(18px,1fr))`;
      row.forEach((colorId,cellIndex)=>{
        const cell=document.createElement('button');
        cell.type='button';
        cell.className='pattern-maker-cell';
        cell.dataset.patternRow=String(rowIndex);
        cell.dataset.patternCell=String(cellIndex);
        cell.dataset.color=colorId;
        cell.style.setProperty('--pattern-cell-color',colorById(colorId)?.value||'transparent');
        cell.setAttribute('aria-label',`Row ${rowIndex+1}, square ${cellIndex+1}${colorId?`, ${colorById(colorId)?.label}`:''}`);
        cell.addEventListener('click',()=>{paint(rowIndex,cellIndex);notify('paint')});
        cell.addEventListener('contextmenu',event=>{
          event.preventDefault();event.stopPropagation();rows[rowIndex][cellIndex]='';renderBoard();notify('erase');
        });
        cells.appendChild(cell);
      });
      const remove=document.createElement('button');
      remove.type='button';
      remove.className='pattern-maker-remove-row';
      remove.textContent='×';
      remove.title='Remove row';
      remove.setAttribute('aria-label',`Remove pattern row ${rowIndex+1}`);
      remove.disabled=rows.length<=1;
      remove.addEventListener('click',()=>{if(rows.length<=1)return;rows.splice(rowIndex,1);renderBoard();notify('row')});
      line.append(label,cells,remove);
      board.appendChild(line);
    });
    addRowButton.disabled=rows.length>=4;
  };

  colors.forEach(color=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='pattern-maker-color';
    button.dataset.patternColor=color.id;
    button.style.setProperty('--pattern-swatch',color.value);
    button.title=color.label;
    button.setAttribute('aria-label',`Use ${color.label}`);
    button.addEventListener('click',()=>{
      selectedColor=color.id;
      palette.querySelectorAll('.pattern-maker-color').forEach(item=>item.classList.toggle('is-selected',item===button));
      notify('color');
    });
    palette.appendChild(button);
  });
  palette.querySelector('[data-pattern-color="red"]')?.classList.add('is-selected');

  board.addEventListener('pointerdown',event=>{
    const cell=event.target.closest('.pattern-maker-cell');
    if(!cell||event.button!==0)return;
    event.preventDefault();event.stopPropagation();painting=true;
    paint(Number(cell.dataset.patternRow),Number(cell.dataset.patternCell));
    try{board.setPointerCapture(event.pointerId)}catch{}
  });
  board.addEventListener('pointermove',event=>{
    if(!painting)return;
    const cell=document.elementFromPoint(event.clientX,event.clientY)?.closest('.pattern-maker-cell');
    if(cell&&board.contains(cell))paint(Number(cell.dataset.patternRow),Number(cell.dataset.patternCell));
  });
  const stopPainting=event=>{
    if(!painting)return;
    painting=false;
    try{board.releasePointerCapture(event.pointerId)}catch{}
    notify('paint');
  };
  board.addEventListener('pointerup',stopPainting);
  board.addEventListener('pointercancel',stopPainting);

  const applyPattern=()=>{
    const sequence=patterns[typeSelect.value];
    if(!sequence)return;
    const start=Math.max(0,colors.findIndex(color=>color.id===selectedColor));
    const patternColors=[colors[start],colors[(start+1)%colors.length],colors[(start+2)%colors.length]];
    rows=rows.map(()=>Array.from({length},(_,index)=>patternColors[sequence[index%sequence.length]].id));
    renderBoard();notify('preset');
  };
  applyButton.addEventListener('click',applyPattern);
  typeSelect.addEventListener('change',()=>{applyButton.disabled=typeSelect.value==='free';notify('type')});
  lengthSelect.addEventListener('change',()=>{
    length=[8,12,16,20].includes(Number(lengthSelect.value))?Number(lengthSelect.value):12;
    rows=normalizeRows(rows);renderBoard();notify('length');
  });
  addRowButton.addEventListener('click',()=>{if(rows.length<4){rows.push(Array(length).fill(''));renderBoard();notify('row')}});
  clearButton.addEventListener('click',()=>{rows=rows.map(()=>Array(length).fill(''));renderBoard();notify('clear')});
  m.querySelector('.pattern-maker-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.pattern-maker-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.pattern-maker-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  m._boardGetState=()=>({length,rows:rows.map(row=>[...row]),selectedColor,patternType:typeSelect.value});
  m._boardSetState=state=>{
    if(!state)return;
    length=[8,12,16,20].includes(Number(state.length))?Number(state.length):12;
    lengthSelect.value=String(length);
    selectedColor=colorById(state.selectedColor)?state.selectedColor:'red';
    typeSelect.value=state.patternType in patterns||state.patternType==='free'?state.patternType:'free';
    applyButton.disabled=typeSelect.value==='free';
    rows=normalizeRows(state.rows);
    palette.querySelectorAll('.pattern-maker-color').forEach(item=>item.classList.toggle('is-selected',item.dataset.patternColor===selectedColor));
    renderBoard();
  };
  applyButton.disabled=true;
  renderBoard();
}

function setupShapeManipulatives(m){
  const workspaceEl=m.querySelector('.shape-manipulatives-workspace');
  const palette=m.querySelector('.shape-manipulatives-palette');
  const countEl=m.querySelector('.shape-manipulatives-count');
  const empty=m.querySelector('.shape-manipulatives-empty');
  const rotateButton=m.querySelector('.shape-manipulatives-rotate');
  const deleteButton=m.querySelector('.shape-manipulatives-delete');
  const clearButton=m.querySelector('.shape-manipulatives-clear');
  const SIDE=64;
  const TRI_HEIGHT=Math.sqrt(3)*SIDE/2;
  const TAN_WIDTH=2*SIDE*Math.cos(Math.PI/12);
  const TAN_HEIGHT=2*SIDE*Math.sin(Math.PI/12);
  // Every polygon is derived from the same 64px edge. This is what lets a
  // triangle, rhombus, trapezoid, and hexagon meet without visible gaps.
  const definitions=[
    {id:'triangle',label:'Triangle',color:'#15966f',width:SIDE,height:TRI_HEIGHT,vertices:[[SIDE/2,0],[SIDE,TRI_HEIGHT],[0,TRI_HEIGHT]]},
    {id:'square',label:'Square',color:'#ef6547',width:SIDE,height:SIDE,vertices:[[0,0],[SIDE,0],[SIDE,SIDE],[0,SIDE]]},
    {id:'hexagon',label:'Hexagon',color:'#f0ca35',width:SIDE*2,height:TRI_HEIGHT*2,vertices:[[SIDE/2,0],[SIDE*1.5,0],[SIDE*2,TRI_HEIGHT],[SIDE*1.5,TRI_HEIGHT*2],[SIDE/2,TRI_HEIGHT*2],[0,TRI_HEIGHT]]},
    {id:'trapezoid',label:'Trapezoid',color:'#ed463d',width:SIDE*2,height:TRI_HEIGHT,vertices:[[SIDE/2,0],[SIDE*1.5,0],[SIDE*2,TRI_HEIGHT],[0,TRI_HEIGHT]]},
    {id:'rhombus-blue',label:'Blue rhombus',color:'#315fae',width:SIDE*1.5,height:TRI_HEIGHT,vertices:[[SIDE/2,0],[SIDE*1.5,0],[SIDE,TRI_HEIGHT],[0,TRI_HEIGHT]]},
    {id:'rhombus-tan',label:'Tan rhombus',color:'#d4ae6c',width:TAN_WIDTH,height:TAN_HEIGHT,vertices:[[TAN_WIDTH/2,0],[TAN_WIDTH,TAN_HEIGHT/2],[TAN_WIDTH/2,TAN_HEIGHT],[0,TAN_HEIGHT/2]]}
  ];
  let pieces=[];
  let nextId=0;
  let selectedId=0;
  let paletteDragType='';
  let paletteDragImage=null;
  const definition=id=>definitions.find(item=>item.id===id);
  const clearPaletteDragImage=()=>{paletteDragImage?.remove();paletteDragImage=null};
  const createPaletteDragImage=def=>{
    const padding=10;
    const canvas=document.createElement('canvas');
    canvas.width=Math.ceil(def.width+padding*2);canvas.height=Math.ceil(def.height+padding*2);
    canvas.style.position='fixed';canvas.style.left='-10000px';canvas.style.top='-10000px';canvas.style.pointerEvents='none';
    const ctx=canvas.getContext('2d');if(!ctx)return canvas;
    const traceShape=()=>{
      ctx.beginPath();def.vertices.forEach(([x,y],index)=>index?ctx.lineTo(x+padding,y+padding):ctx.moveTo(x+padding,y+padding));ctx.closePath();
    };
    ctx.save();ctx.shadowColor='rgba(15,23,42,.3)';ctx.shadowBlur=8;ctx.shadowOffsetY=4;traceShape();ctx.fillStyle=def.color;ctx.fill();ctx.restore();
    const gradient=ctx.createLinearGradient(padding,padding,padding+def.width,padding+def.height);
    gradient.addColorStop(0,'rgba(255,255,255,.38)');gradient.addColorStop(.42,'rgba(255,255,255,.04)');gradient.addColorStop(1,'rgba(0,0,0,.22)');
    traceShape();ctx.fillStyle=def.color;ctx.fill();ctx.fillStyle=gradient;ctx.fill();
    return canvas;
  };
  const selectedPiece=()=>pieces.find(piece=>piece.id===selectedId);
  const notify=reason=>notifyBoardChanged(`shape-manipulatives-${reason}`);
  const workspacePoint=(clientX,clientY)=>{
    const rect=workspaceEl.getBoundingClientRect();
    return{x:(clientX-rect.left)*(workspaceEl.clientWidth/Math.max(1,rect.width)),y:(clientY-rect.top)*(workspaceEl.clientHeight/Math.max(1,rect.height))};
  };
  const clampPiece=piece=>{
    const def=definition(piece.type);if(!def)return;
    piece.x=clamp(Number(piece.x)||0,0,Math.max(0,workspaceEl.clientWidth-def.width));
    piece.y=clamp(Number(piece.y)||0,0,Math.max(0,workspaceEl.clientHeight-def.height));
  };
  const worldVertices=(piece,def=definition(piece.type))=>{
    if(!def)return[];
    const radians=(Number(piece.rotation)||0)*Math.PI/180;
    const cosine=Math.cos(radians),sine=Math.sin(radians),cx=def.width/2,cy=def.height/2;
    return def.vertices.map(([x,y])=>({
      x:piece.x+cx+(x-cx)*cosine-(y-cy)*sine,
      y:piece.y+cy+(x-cx)*sine+(y-cy)*cosine
    }));
  };
  const polygonEdges=piece=>{
    const vertices=worldVertices(piece);const edges=[];
    vertices.forEach((start,index)=>{
      const end=vertices[(index+1)%vertices.length];
      const length=Math.hypot(end.x-start.x,end.y-start.y);
      const sections=Math.max(1,Math.round(length/SIDE));
      for(let part=0;part<sections;part++)edges.push({
        a:{x:start.x+(end.x-start.x)*part/sections,y:start.y+(end.y-start.y)*part/sections},
        b:{x:start.x+(end.x-start.x)*(part+1)/sections,y:start.y+(end.y-start.y)*(part+1)/sections},
        length:length/sections
      });
    });
    return edges;
  };
  const snapTranslation=piece=>{
    let best=null;
    const movingEdges=polygonEdges(piece);
    pieces.filter(other=>other.id!==piece.id).forEach(other=>{
      polygonEdges(other).forEach(target=>movingEdges.forEach(moving=>{
        if(Math.abs(moving.length-target.length)>1.5)return;
        const movingDx=(moving.b.x-moving.a.x)/moving.length,movingDy=(moving.b.y-moving.a.y)/moving.length;
        const targetDx=(target.b.x-target.a.x)/target.length,targetDy=(target.b.y-target.a.y)/target.length;
        if(movingDx*targetDx+movingDy*targetDy>-.965)return;
        const dx=((target.b.x-moving.a.x)+(target.a.x-moving.b.x))/2;
        const dy=((target.b.y-moving.a.y)+(target.a.y-moving.b.y))/2;
        const distance=Math.hypot(dx,dy);if(distance>22)return;
        const residual=Math.hypot(moving.a.x+dx-target.b.x,moving.a.y+dy-target.b.y)+Math.hypot(moving.b.x+dx-target.a.x,moving.b.y+dy-target.a.y);
        if(residual>3)return;
        const translated=worldVertices(piece).map(point=>({x:point.x+dx,y:point.y+dy}));
        if(translated.some(point=>point.x<-.5||point.y<-.5||point.x>workspaceEl.clientWidth+.5||point.y>workspaceEl.clientHeight+.5))return;
        const score=distance+residual*2;
        if(!best||score<best.score)best={dx,dy,score};
      }));
    });
    return best;
  };
  const snapPiece=piece=>{
    const translation=snapTranslation(piece);if(!translation)return false;
    piece.x+=translation.dx;piece.y+=translation.dy;return true;
  };
  const syncPieceElement=(piece,el)=>{
    if(!el)return;
    el.style.left=`${piece.x}px`;el.style.top=`${piece.y}px`;el.style.transform=`rotate(${Number(piece.rotation)||0}deg)`;
  };
  const pulseSnap=el=>{
    if(!el)return;el.classList.remove('is-snapping');void el.offsetWidth;el.classList.add('is-snapping');
    setTimeout(()=>el.classList.remove('is-snapping'),240);
  };
  const updateSummary=()=>{
    countEl.textContent=`${pieces.length} ${pieces.length===1?'piece':'pieces'}`;
    empty.hidden=pieces.length>0;
    const hasSelection=Boolean(selectedPiece());
    rotateButton.disabled=!hasSelection;
    deleteButton.disabled=!hasSelection;
  };
  const selectPiece=id=>{
    selectedId=pieces.some(piece=>piece.id===id)?id:0;
    workspaceEl.querySelectorAll('.shape-manipulative-piece').forEach(el=>el.classList.toggle('is-selected',Number(el.dataset.shapePiece)===selectedId));
    updateSummary();
  };
  const rotateSelected=(amount=30)=>{
    const piece=selectedPiece();if(!piece)return;
    piece.rotation=((Number(piece.rotation)||0)+amount)%360;
    const el=workspaceEl.querySelector(`[data-shape-piece="${piece.id}"]`);
    const snapped=snapPiece(piece);syncPieceElement(piece,el);if(snapped)pulseSnap(el);
    notify('rotate');
  };
  const removeSelected=()=>{
    if(!selectedId)return;
    pieces=pieces.filter(piece=>piece.id!==selectedId);selectedId=0;renderPieces();notify('delete');
  };

  const renderPieces=()=>{
    workspaceEl.querySelectorAll('.shape-manipulative-piece').forEach(el=>el.remove());
    pieces.forEach(piece=>{
      const def=definition(piece.type);if(!def)return;
      clampPiece(piece);
      const el=document.createElement('button');
      el.type='button';
      el.className=`shape-manipulative-piece shape-manipulative-piece--${piece.type}`;
      el.dataset.shapePiece=String(piece.id);
      el.style.left=`${piece.x}px`;el.style.top=`${piece.y}px`;
      el.style.width=`${def.width}px`;el.style.height=`${def.height}px`;
      el.style.transform=`rotate(${Number(piece.rotation)||0}deg)`;
      el.style.setProperty('--pattern-block-color',def.color);
      el.title=`${def.label} · drag to move · double-click to rotate`;
      el.setAttribute('aria-label',`${def.label}. Drag to move. Double click to rotate.`);
      const art=document.createElement('span');art.className='pattern-block-art';
      const rotateHandle=document.createElement('span');rotateHandle.className='shape-manipulative-rotate-handle';rotateHandle.textContent='↻';rotateHandle.setAttribute('aria-hidden','true');
      el.append(art,rotateHandle);
      el.classList.toggle('is-selected',piece.id===selectedId);
      let dragging=false,offsetX=0,offsetY=0;
      el.addEventListener('pointerdown',event=>{
        if(event.button!==0||event.target.closest('.shape-manipulative-rotate-handle'))return;
        event.preventDefault();event.stopPropagation();selectPiece(piece.id);dragging=true;
        const point=workspacePoint(event.clientX,event.clientY);offsetX=point.x-piece.x;offsetY=point.y-piece.y;
        try{el.setPointerCapture(event.pointerId)}catch{}el.classList.add('is-dragging');
      });
      el.addEventListener('pointermove',event=>{
        if(!dragging)return;
        const point=workspacePoint(event.clientX,event.clientY);
        piece.x=Math.round((point.x-offsetX)/4)*4;piece.y=Math.round((point.y-offsetY)/4)*4;clampPiece(piece);
        syncPieceElement(piece,el);
      });
      const stop=event=>{if(!dragging)return;dragging=false;el.classList.remove('is-dragging');try{el.releasePointerCapture(event.pointerId)}catch{}const snapped=snapPiece(piece);syncPieceElement(piece,el);if(snapped)pulseSnap(el);notify('move')};
      el.addEventListener('pointerup',stop);el.addEventListener('pointercancel',stop);
      let rotating=false,startPointerAngle=0,startRotation=0;
      rotateHandle.addEventListener('pointerdown',event=>{
        if(event.button!==0)return;event.preventDefault();event.stopPropagation();selectPiece(piece.id);rotating=true;
        const rect=el.getBoundingClientRect();startPointerAngle=Math.atan2(event.clientY-(rect.top+rect.height/2),event.clientX-(rect.left+rect.width/2));startRotation=Number(piece.rotation)||0;
        try{rotateHandle.setPointerCapture(event.pointerId)}catch{}
      });
      rotateHandle.addEventListener('pointermove',event=>{
        if(!rotating)return;event.preventDefault();event.stopPropagation();
        const rect=el.getBoundingClientRect();const angle=Math.atan2(event.clientY-(rect.top+rect.height/2),event.clientX-(rect.left+rect.width/2));
        piece.rotation=Math.round((startRotation+(angle-startPointerAngle)*180/Math.PI)/15)*15;syncPieceElement(piece,el);
      });
      const stopRotating=event=>{if(!rotating)return;rotating=false;try{rotateHandle.releasePointerCapture(event.pointerId)}catch{}const snapped=snapPiece(piece);syncPieceElement(piece,el);if(snapped)pulseSnap(el);notify('rotate')};
      rotateHandle.addEventListener('pointerup',stopRotating);rotateHandle.addEventListener('pointercancel',stopRotating);
      el.addEventListener('dblclick',event=>{event.preventDefault();event.stopPropagation();selectPiece(piece.id);rotateSelected()});
      el.addEventListener('keydown',event=>{
        if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();removeSelected();return}
        if(event.key.toLowerCase()==='r'){event.preventDefault();rotateSelected();return}
        const moves={ArrowLeft:[-4,0],ArrowRight:[4,0],ArrowUp:[0,-4],ArrowDown:[0,4]};
        if(moves[event.key]){event.preventDefault();piece.x+=moves[event.key][0];piece.y+=moves[event.key][1];clampPiece(piece);syncPieceElement(piece,el);notify('move')}
      });
      workspaceEl.appendChild(el);
    });
    updateSummary();
  };
  const addPiece=(type,x=null,y=null)=>{
    const def=definition(type);if(!def)return;
    const piece={id:++nextId,type,x:x??Math.max(8,(workspaceEl.clientWidth-def.width)/2+(Math.random()-.5)*70),y:y??Math.max(8,(workspaceEl.clientHeight-def.height)/2+(Math.random()-.5)*45),rotation:0};
    clampPiece(piece);pieces.push(piece);selectedId=piece.id;renderPieces();playUiSfx('click');notify('add');
  };

  definitions.forEach(def=>{
    const button=document.createElement('button');button.type='button';button.className='shape-manipulatives-palette-item';button.draggable=true;button.dataset.shapeType=def.id;button.setAttribute('aria-label',`Add ${def.label}`);
    const art=document.createElement('span');art.className=`pattern-block-art pattern-block-art--${def.id}`;art.draggable=false;art.style.setProperty('--pattern-block-color',def.color);
    const label=document.createElement('small');label.textContent=def.label.replace(/ rhombus/i,'');button.append(art,label);
    button.addEventListener('click',()=>addPiece(def.id));
    button.addEventListener('dragstart',event=>{
      event.stopPropagation();paletteDragType=def.id;clearPaletteDragImage();paletteDragImage=createPaletteDragImage(def);document.body.appendChild(paletteDragImage);
      event.dataTransfer?.setData('text/plain',def.id);
      if(event.dataTransfer){event.dataTransfer.effectAllowed='copy';event.dataTransfer.setDragImage(paletteDragImage,paletteDragImage.width/2,paletteDragImage.height/2)}
    });
    button.addEventListener('dragend',()=>{paletteDragType='';clearPaletteDragImage()});palette.appendChild(button);
  });
  workspaceEl.addEventListener('pointerdown',event=>{if(event.target===workspaceEl||event.target===empty)selectPiece(0)});
  workspaceEl.addEventListener('dragover',event=>{event.preventDefault();workspaceEl.classList.add('is-drop-target');if(event.dataTransfer)event.dataTransfer.dropEffect='copy'});
  workspaceEl.addEventListener('dragleave',event=>{if(!workspaceEl.contains(event.relatedTarget))workspaceEl.classList.remove('is-drop-target')});
  workspaceEl.addEventListener('drop',event=>{
    event.preventDefault();event.stopPropagation();workspaceEl.classList.remove('is-drop-target');
    const type=paletteDragType||event.dataTransfer?.getData('text/plain');const def=definition(type);if(!def)return;
    const point=workspacePoint(event.clientX,event.clientY);addPiece(type,point.x-def.width/2,point.y-def.height/2);
  });
  rotateButton.addEventListener('click',()=>rotateSelected());deleteButton.addEventListener('click',removeSelected);
  clearButton.addEventListener('click',()=>{pieces=[];selectedId=0;renderPieces();notify('clear')});
  m.querySelector('.shape-manipulatives-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.shape-manipulatives-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.shape-manipulatives-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));
  const ro=new ResizeObserver(()=>{pieces.forEach(clampPiece);renderPieces()});ro.observe(workspaceEl);
  m._boardGetState=()=>({pieces:pieces.map(piece=>({...piece}))});
  m._boardSetState=state=>{
    pieces=Array.isArray(state?.pieces)?state.pieces.filter(piece=>definition(piece.type)).slice(0,80).map((piece,index)=>({id:index+1,type:piece.type,x:Number(piece.x)||0,y:Number(piece.y)||0,rotation:Number(piece.rotation)||0})):[];
    nextId=pieces.length;selectedId=0;renderPieces();
  };
  const prior=m._cleanup;m._cleanup=()=>{prior?.();ro.disconnect();clearPaletteDragImage()};renderPieces();
}

function setupNumberLine(m){
  const stage=m.querySelector('.numberline-stage');
  const svg=m.querySelector('.numberline-svg');
  const valueAEl=m.querySelector('.numberline-value-a');
  const valueBEl=m.querySelector('.numberline-value-b');
  const pointSelectors=[...m.querySelectorAll('[data-numberline-point-select]')];
  const hopCount=m.querySelector('.numberline-hop-count');
  const stepButtons=[...m.querySelectorAll('[data-numberline-step]')];
  const extendButtons=[...m.querySelectorAll('[data-numberline-extend]')];
  const secondPointButton=m.querySelector('.numberline-second-point');
  const resetButton=m.querySelector('.numberline-reset');

  const defaultStart=0;
  const defaultEnd=20;
  const defaultWidth=920;
  const sidePadding=58;

  let start=defaultStart;
  let end=defaultEnd;
  let valueA=0;
  let valueB=null;
  let activePoint='a';

  const clampValue=n=>Math.max(start,Math.min(end,n));

  const labelSpacing=()=>{
    const longest=Math.max(String(start).length,String(end).length);
    return Math.max(38,longest*12+10);
  };

  const geometry=()=>{
    const spacing=labelSpacing();
    const count=end-start+1;
    const right=sidePadding+(count-1)*spacing;
    const totalWidth=right+sidePadding;
    return {
      spacing,
      left:sidePadding,
      right,
      totalWidth,
      xFor:n=>sidePadding+(n-start)*spacing
    };
  };

  const fitModuleToRange=({resetWidth=false}={})=>{
    const {totalWidth}=geometry();
    const requiredOuter=Math.ceil(totalWidth+36);
    const width=resetWidth
      ?Math.max(defaultWidth,requiredOuter)
      :Math.max(defaultWidth,requiredOuter,m.offsetWidth);

    m.style.minWidth=`${Math.max(defaultWidth,requiredOuter)}px`;
    m.style.width=`${width}px`;

    const currentLeft=parseFloat(m.style.left)||m.offsetLeft||0;
    if(currentLeft+width>BOARD_WIDTH){
      m.style.left=`${Math.max(0,BOARD_WIDTH-width)}px`;
    }
  };

  const selectPoint=point=>{
    if(point==='b'&&valueB===null)return;
    activePoint=point==='b'?'b':'a';

    pointSelectors.forEach(button=>{
      button.classList.toggle('is-active',button.dataset.numberlinePointSelect===activePoint);
    });

    render({fit:false});
  };

  const makeMarker=(point,value,xFor)=>{
    const marker=document.createElementNS('http://www.w3.org/2000/svg','g');
    marker.setAttribute('class',`numberline-marker numberline-marker--${point}${activePoint===point?' is-active':''}`);
    marker.dataset.numberlineMarkerPoint=point;
    marker.style.setProperty('--numberline-x',`${xFor(value)}px`);

    const stem=document.createElementNS('http://www.w3.org/2000/svg','line');
    stem.setAttribute('x1','0');
    stem.setAttribute('x2','0');
    stem.setAttribute('y1','50');
    stem.setAttribute('y2','93');
    stem.setAttribute('class','numberline-marker-stem');

    const circle=document.createElementNS('http://www.w3.org/2000/svg','circle');
    circle.setAttribute('cx','0');
    circle.setAttribute('cy','38');
    circle.setAttribute('r','18');
    circle.setAttribute('class','numberline-marker-dot');

    const markerText=document.createElementNS('http://www.w3.org/2000/svg','text');
    markerText.setAttribute('x','0');
    markerText.setAttribute('y','44');
    markerText.setAttribute('text-anchor','middle');
    markerText.setAttribute('class','numberline-marker-text');
    markerText.textContent=String(value);

    marker.append(stem,circle,markerText);
    marker.addEventListener('click',event=>{
      event.stopPropagation();
      selectPoint(point);
    });

    return marker;
  };

  const renderHops=(xFor)=>{
    if(valueB===null||valueA===valueB)return;

    const direction=valueB>valueA?1:-1;
    const hops=Math.abs(valueB-valueA);

    for(let i=0;i<hops;i++){
      const from=valueA+i*direction;
      const to=from+direction;
      const x1=xFor(from);
      const x2=xFor(to);
      const mid=(x1+x2)/2;

      const path=document.createElementNS('http://www.w3.org/2000/svg','path');
      path.setAttribute('d',`M ${x1} 101 Q ${mid} 63 ${x2} 101`);
      path.setAttribute('class','numberline-hop');
      path.style.setProperty('--hop-delay',`${i*70}ms`);
      svg.appendChild(path);

      const arrow=document.createElementNS('http://www.w3.org/2000/svg','path');
      arrow.setAttribute(
        'd',
        direction>0
          ?`M ${x2-8} 96 L ${x2} 101 L ${x2-8} 106`
          :`M ${x2+8} 96 L ${x2} 101 L ${x2+8} 106`
      );
      arrow.setAttribute('class','numberline-hop-arrow');
      arrow.style.setProperty('--hop-delay',`${i*70+110}ms`);
      svg.appendChild(arrow);
    }
  };

  const render=({fit=true,resetWidth=false}={})=>{
    if(fit)fitModuleToRange({resetWidth});

    svg.replaceChildren();

    const {spacing,left,right,totalWidth,xFor}=geometry();
    svg.setAttribute('viewBox',`0 0 ${totalWidth} 200`);
    svg.style.width=`${totalWidth}px`;
    svg.style.minWidth=`${totalWidth}px`;
    svg.style.maxWidth=`${totalWidth}px`;

    const line=document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1',String(left));
    line.setAttribute('x2',String(right));
    line.setAttribute('y1','105');
    line.setAttribute('y2','105');
    line.setAttribute('class','numberline-axis');
    svg.appendChild(line);

    const leftArrow=document.createElementNS('http://www.w3.org/2000/svg','path');
    leftArrow.setAttribute('d',`M ${left} 105 l 15 -9 v 18 z`);
    leftArrow.setAttribute('class','numberline-arrow');
    svg.appendChild(leftArrow);

    const rightArrow=document.createElementNS('http://www.w3.org/2000/svg','path');
    rightArrow.setAttribute('d',`M ${right} 105 l -15 -9 v 18 z`);
    rightArrow.setAttribute('class','numberline-arrow');
    svg.appendChild(rightArrow);

    renderHops(xFor);

    for(let n=start;n<=end;n++){
      const x=xFor(n);

      const tick=document.createElementNS('http://www.w3.org/2000/svg','line');
      tick.setAttribute('x1',String(x));
      tick.setAttribute('x2',String(x));
      tick.setAttribute('y1',n%5===0?'84':'91');
      tick.setAttribute('y2',n%5===0?'126':'119');
      tick.setAttribute('class','numberline-tick');
      tick.dataset.value=String(n);
      svg.appendChild(tick);

      const label=document.createElementNS('http://www.w3.org/2000/svg','text');
      label.setAttribute('x',String(x));
      label.setAttribute('y','158');
      label.setAttribute('text-anchor','middle');
      label.setAttribute('class','numberline-label');
      label.textContent=String(n);
      label.dataset.value=String(n);
      svg.appendChild(label);
    }

    svg.appendChild(makeMarker('a',valueA,xFor));
    if(valueB!==null)svg.appendChild(makeMarker('b',valueB,xFor));

    valueAEl.textContent=String(valueA);
    valueBEl.textContent=valueB===null?'':String(valueB);

    const bSelector=pointSelectors.find(button=>button.dataset.numberlinePointSelect==='b');
    if(bSelector)bSelector.hidden=valueB===null;

    pointSelectors.forEach(button=>{
      button.classList.toggle('is-active',button.dataset.numberlinePointSelect===activePoint);
    });

    secondPointButton.textContent=valueB===null?'+ Point':'Remove Point';

    if(valueB===null){
      hopCount.hidden=true;
      hopCount.textContent='';
    }else{
      const hops=Math.abs(valueB-valueA);
      hopCount.hidden=false;
      hopCount.textContent=`${hops} ${hops===1?'hop':'hops'}`;
    }

    const pointDescription=valueB===null
      ?`Point A is ${valueA}.`
      :`Point A is ${valueA}. Point B is ${valueB}. ${Math.abs(valueB-valueA)} hops between them.`;

    svg.setAttribute('aria-label',`Number line from ${start} to ${end}. ${pointDescription}`);
  };

  const moveActiveTo=next=>{
    const clamped=clampValue(Math.round(next));
    const current=activePoint==='b'?valueB:valueA;
    if(current===clamped)return;

    if(activePoint==='b'&&valueB!==null)valueB=clamped;
    else valueA=clamped;

    const readout=activePoint==='b'?valueBEl:valueAEl;
    readout.classList.remove('numberline-value-pop');
    void readout.offsetWidth;
    readout.classList.add('numberline-value-pop');

    render({fit:false});
  };

  svg.addEventListener('click',event=>{
    const marker=event.target.closest?.('[data-numberline-marker-point]');
    if(marker){
      selectPoint(marker.dataset.numberlineMarkerPoint);
      return;
    }

    const target=event.target.closest?.('[data-value]');
    if(target){
      moveActiveTo(Number(target.dataset.value));
      return;
    }

    const rect=svg.getBoundingClientRect();
    if(!rect.width)return;

    const {spacing}=geometry();
    const viewBox=svg.viewBox.baseVal;
    const x=((event.clientX-rect.left)/rect.width)*viewBox.width;
    const approx=start+(x-sidePadding)/spacing;
    moveActiveTo(Math.round(approx));
  });

  pointSelectors.forEach(button=>{
    button.addEventListener('click',()=>selectPoint(button.dataset.numberlinePointSelect));
  });

  stepButtons.forEach(button=>{
    button.addEventListener('click',()=>{
      const current=activePoint==='b'&&valueB!==null?valueB:valueA;
      moveActiveTo(current+Number(button.dataset.numberlineStep));
    });
  });

  secondPointButton.addEventListener('click',()=>{
    if(valueB===null){
      valueB=valueA<end?Math.min(end,valueA+5):Math.max(start,valueA-5);
      activePoint='b';
    }else{
      valueB=null;
      activePoint='a';
    }

    render({fit:false});
  });

  extendButtons.forEach(button=>{
    button.addEventListener('click',()=>{
      const nextStart=button.dataset.numberlineExtend==='left'?start-5:start;
      const nextEnd=button.dataset.numberlineExtend==='right'?end+5:end;

      const previousStart=start;
      const previousEnd=end;
      start=nextStart;
      end=nextEnd;

      const required=Math.ceil(geometry().totalWidth+36);
      if(required>BOARD_WIDTH-80){
        start=previousStart;
        end=previousEnd;
        return;
      }

      render();
    });
  });

  resetButton.addEventListener('click',()=>{
    start=defaultStart;
    end=defaultEnd;
    valueA=0;
    valueB=null;
    activePoint='a';
    m.style.minWidth='';
    m.style.width=`${defaultWidth}px`;
    render({fit:true,resetWidth:true});
  });

  m.addEventListener('pointerdown',event=>{
    if(!event.target.closest('button,input')){
      m.focus({preventScroll:true});
    }
  });

  m.addEventListener('keydown',event=>{
    if(event.target.closest('button,input'))return;

    const current=activePoint==='b'&&valueB!==null?valueB:valueA;

    if(event.key==='ArrowLeft'){
      event.preventDefault();
      moveActiveTo(current-1);
    }else if(event.key==='ArrowRight'){
      event.preventDefault();
      moveActiveTo(current+1);
    }
  });

  m.querySelector('.numberline-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.numberline-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.numberline-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  m._boardGetState=()=>({start,end,valueA,valueB,activePoint});
  m._boardSetState=state=>{
    if(!state)return;
    start=Number.isFinite(Number(state.start))?Number(state.start):defaultStart;
    end=Number.isFinite(Number(state.end))?Number(state.end):defaultEnd;
    if(end<=start)end=start+20;
    valueA=clampValue(Number.isFinite(Number(state.valueA))?Number(state.valueA):0);
    valueB=state.valueB===null||state.valueB===undefined?null:clampValue(Number(state.valueB));
    activePoint=state.activePoint==='b'&&valueB!==null?'b':'a';
    render({fit:true,resetWidth:false});
  };

  render({fit:true,resetWidth:true});
}


function setupHundredsChart(m){
  const grid=m.querySelector('.hundreds-grid');
  const toggleAll=m.querySelector('.hundreds-toggle-all');
  const highlightButton=m.querySelector('.hundreds-highlight');

  const hidden=new Set();
  let highlight='off';

  const isHighlighted=n=>{
    if(highlight==='5')return n%5===0;
    if(highlight==='10')return n%10===0;
    return false;
  };

  const render=()=>{
    grid.replaceChildren();

    for(let n=1;n<=100;n++){
      const button=document.createElement('button');
      button.type='button';
      button.className='hundreds-cell';
      button.dataset.number=String(n);
      button.setAttribute('aria-label',hidden.has(n)?`Reveal ${n}`:`Hide ${n}`);
      button.classList.toggle('is-hidden',hidden.has(n));
      button.classList.toggle('is-highlighted',isHighlighted(n));

      const span=document.createElement('span');
      span.textContent=String(n);
      button.appendChild(span);

      button.addEventListener('click',()=>{
        if(hidden.has(n))hidden.delete(n);
        else hidden.add(n);

        button.classList.remove('hundreds-cell-pop');
        void button.offsetWidth;
        button.classList.add('hundreds-cell-pop');
        render();
      });

      grid.appendChild(button);
    }

    toggleAll.textContent=hidden.size===100?'Show All':'Hide All';
    highlightButton.textContent=highlight==='off'
      ?'Highlight: Off'
      :highlight==='5'
        ?'Highlight: 5s'
        :'Highlight: 10s';

    m.dataset.highlight=highlight;
  };

  toggleAll.addEventListener('click',()=>{
    if(hidden.size===100)hidden.clear();
    else{
      hidden.clear();
      for(let n=1;n<=100;n++)hidden.add(n);
    }
    render();
  });

  highlightButton.addEventListener('click',()=>{
    highlight=highlight==='off'?'5':highlight==='5'?'10':'off';
    render();
  });

  m.querySelector('.hundreds-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.hundreds-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.hundreds-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  m._boardGetState=()=>({hidden:[...hidden],highlight});
  m._boardSetState=state=>{
    hidden.clear();
    for(const value of Array.isArray(state?.hidden)?state.hidden:[]){
      const n=Number(value);
      if(n>=1&&n<=100)hidden.add(n);
    }
    highlight=['off','5','10'].includes(state?.highlight)?state.highlight:'off';
    render();
  };

  render();
}

function setupTenFrames(m){
  const board=m.querySelector('.tenframes-board');
  const countEl=m.querySelector('.tenframes-count');
  const frameCountEl=m.querySelector('.tenframes-frame-count');
  const addFrameButton=m.querySelector('.tenframes-add-frame');
  const removeFrameButton=m.querySelector('.tenframes-remove-frame');
  const addButtons=[...m.querySelectorAll('[data-tenframes-add]')];
  const clearButton=m.querySelector('.tenframes-clear');

  let frameCount=1;
  let placements=Array(10).fill(false);
  let draggedIndex=-1;

  const capacity=()=>frameCount*10;
  const countCounters=()=>placements.slice(0,capacity()).filter(Boolean).length;

  const ensureCapacityFor=amount=>{
    const current=countCounters();
    const needed=current+amount;
    const framesNeeded=Math.min(10,Math.max(frameCount,Math.ceil(needed/10)));
    if(framesNeeded>frameCount){
      frameCount=framesNeeded;
      while(placements.length<capacity())placements.push(false);
    }
  };

  const addCounters=amount=>{
    ensureCapacityFor(amount);
    let remaining=amount;

    for(let i=0;i<capacity()&&remaining>0;i++){
      if(!placements[i]){
        placements[i]=true;
        remaining--;
      }
    }

    render();
  };

  const moveCounter=(from,to)=>{
    if(from===to||from<0||to<0||from>=capacity()||to>=capacity())return;
    if(!placements[from])return;

    if(placements[to]){
      placements[from]=false;
    }else{
      placements[from]=false;
      placements[to]=true;
    }

    render();
  };

  const render=()=>{
    while(placements.length<capacity())placements.push(false);
    if(placements.length>capacity())placements=placements.slice(0,capacity());

    board.replaceChildren();

    for(let frameIndex=0;frameIndex<frameCount;frameIndex++){
      const frame=document.createElement('section');
      frame.className='tenframe';
      frame.setAttribute('aria-label',`Ten frame ${frameIndex+1}`);

      for(let cell=0;cell<10;cell++){
        const absolute=frameIndex*10+cell;
        const slot=document.createElement('button');
        slot.type='button';
        slot.className='tenframe-slot';
        slot.dataset.slot=String(absolute);
        slot.setAttribute('aria-label',placements[absolute]?`Counter in box ${absolute+1}. Click to remove.`:`Empty box ${absolute+1}. Click to add counter.`);

        if(placements[absolute]){
          const counter=document.createElement('span');
          counter.className='tenframe-counter';
          counter.draggable=true;
          counter.dataset.counter=String(absolute);

          counter.addEventListener('dragstart',event=>{
            draggedIndex=absolute;
            counter.classList.add('is-dragging');
            event.dataTransfer?.setData('text/plain',String(absolute));
            if(event.dataTransfer)event.dataTransfer.effectAllowed='move';
          });

          counter.addEventListener('dragend',()=>{
            draggedIndex=-1;
            counter.classList.remove('is-dragging');
            board.querySelectorAll('.is-drop-target').forEach(node=>node.classList.remove('is-drop-target'));
          });

          slot.appendChild(counter);
        }

        slot.addEventListener('click',event=>{
          if(event.target.closest('.tenframe-counter'))return;
          placements[absolute]=!placements[absolute];
          render();
        });

        slot.addEventListener('dragover',event=>{
          event.preventDefault();
          slot.classList.add('is-drop-target');
          if(event.dataTransfer)event.dataTransfer.dropEffect='move';
        });

        slot.addEventListener('dragleave',()=>{
          slot.classList.remove('is-drop-target');
        });

        slot.addEventListener('drop',event=>{
          event.preventDefault();
          slot.classList.remove('is-drop-target');
          const from=draggedIndex>=0?draggedIndex:Number(event.dataTransfer?.getData('text/plain'));
          if(Number.isInteger(from))moveCounter(from,absolute);
        });

        frame.appendChild(slot);
      }

      board.appendChild(frame);
    }

    const total=countCounters();
    countEl.textContent=String(total);
    frameCountEl.textContent=`${frameCount} ${frameCount===1?'frame':'frames'}`;
    removeFrameButton.disabled=frameCount<=1;
    addFrameButton.disabled=frameCount>=10;
    addButtons.forEach(button=>{
      button.disabled=total>=100;
    });
  };

  addFrameButton.addEventListener('click',()=>{
    if(frameCount>=10)return;
    frameCount++;
    while(placements.length<capacity())placements.push(false);
    render();
  });

  removeFrameButton.addEventListener('click',()=>{
    if(frameCount<=1)return;

    const removedStart=(frameCount-1)*10;
    const hasCounters=placements.slice(removedStart,removedStart+10).some(Boolean);

    if(hasCounters){
      const freeSlots=placements.slice(0,removedStart).reduce((sum,filled)=>sum+(filled?0:1),0);
      const removedCount=placements.slice(removedStart,removedStart+10).filter(Boolean).length;

      if(freeSlots<removedCount)return;

      let toMove=removedCount;
      for(let i=0;i<removedStart&&toMove>0;i++){
        if(!placements[i]){
          placements[i]=true;
          toMove--;
        }
      }
    }

    frameCount--;
    placements=placements.slice(0,capacity());
    render();
  });

  addButtons.forEach(button=>{
    button.addEventListener('click',()=>{
      addCounters(Number(button.dataset.tenframesAdd));
    });
  });

  clearButton.addEventListener('click',()=>{
    placements=Array(capacity()).fill(false);
    render();
  });

  m.querySelector('.tenframes-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.tenframes-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.tenframes-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white']));

  m._boardGetState=()=>({frameCount,placements:[...placements]});
  m._boardSetState=state=>{
    frameCount=Math.max(1,Math.min(10,Math.round(Number(state?.frameCount)||1)));
    placements=Array.isArray(state?.placements)?state.placements.slice(0,frameCount*10).map(Boolean):Array(frameCount*10).fill(false);
    while(placements.length<frameCount*10)placements.push(false);
    render();
  };

  render();
}

function setupWordyPuzzle(m){
  const board=m.querySelector('.wordy-board');
  const keyboard=m.querySelector('.wordy-keyboard');
  const status=m.querySelector('.wordy-status');
  const guessCount=m.querySelector('.wordy-guess-count');
  const message=m.querySelector('.wordy-message');
  const setup=m.querySelector('.wordy-setup');
  const secretInput=m.querySelector('.wordy-secret-input');
  const setupError=m.querySelector('.wordy-setup-error');
  const startButton=m.querySelector('.wordy-start');
  const result=m.querySelector('.wordy-result');
  const resultLabel=m.querySelector('.wordy-result-label');
  const resultWord=m.querySelector('.wordy-result-word');
  const playAgain=m.querySelector('.wordy-play-again');
  const bgButton=m.querySelector('.wordy-bg');
  const fontButton=m.querySelector('.wordy-font');

  const keyboardRows=['QWERTYUIOP','ASDFGHJKL','ZXCVBNM'];
  const maxGuesses=6;

  let secret='';
  let guesses=[];
  let current='';
  let finished=false;
  let revealing=false;
  let keyboardState={};

  const normalizeWord=value=>(value||'')
    .toUpperCase()
    .replace(/[^A-Z]/g,'');

  const stateRank=state=>({absent:1,present:2,correct:3}[state]||0);

  function setKeyState(letter,state){
    if(stateRank(state)>stateRank(keyboardState[letter])){
      keyboardState[letter]=state;
    }
  }

  function clearAnimations(){
    board.querySelectorAll('.wordy-row,.wordy-tile').forEach(el=>{
      el.classList.remove('is-shaking','is-bouncing','is-flipping');
    });
  }

  function buildBoard(){
    board.replaceChildren();
    board.style.maxWidth=`${Math.min(590,secret.length*64)}px`;

    for(let rowIndex=0;rowIndex<maxGuesses;rowIndex++){
      const row=document.createElement('div');
      row.className='wordy-row';
      row.dataset.row=String(rowIndex);
      row.style.gridTemplateColumns=`repeat(${secret.length},minmax(0,1fr))`;

      for(let col=0;col<secret.length;col++){
        const tile=document.createElement('div');
        tile.className='wordy-tile';
        tile.setAttribute('aria-hidden','true');
        row.appendChild(tile);
      }

      board.appendChild(row);
    }
  }

  function buildKeyboard(){
    keyboard.replaceChildren();

    keyboardRows.forEach((letters,rowIndex)=>{
      const row=document.createElement('div');
      row.className='wordy-keyboard-row';

      if(rowIndex===2){
        const enter=document.createElement('button');
        enter.type='button';
        enter.className='wordy-key wordy-key--wide';
        enter.textContent='ENTER';
        enter.dataset.action='enter';
        enter.addEventListener('click',submitGuess);
        row.appendChild(enter);
      }

      [...letters].forEach(letter=>{
        const button=document.createElement('button');
        button.type='button';
        button.className='wordy-key';
        button.textContent=letter;
        button.dataset.letter=letter;
        button.addEventListener('click',()=>typeLetter(letter));
        row.appendChild(button);
      });

      if(rowIndex===2){
        const backspace=document.createElement('button');
        backspace.type='button';
        backspace.className='wordy-key wordy-key--wide wordy-key--backspace';
        backspace.textContent='⌫';
        backspace.dataset.action='backspace';
        backspace.setAttribute('aria-label','Backspace');
        backspace.addEventListener('click',backspaceLetter);
        row.appendChild(backspace);
      }

      keyboard.appendChild(row);
    });
  }

  function renderKeyboard(){
    keyboard.querySelectorAll('.wordy-key[data-letter]').forEach(button=>{
      const keyState=keyboardState[button.dataset.letter]||'';
      button.dataset.state=keyState;
      button.disabled=finished||revealing||!secret;
    });

    keyboard.querySelectorAll('.wordy-key[data-action]').forEach(button=>{
      button.disabled=finished||revealing||!secret;
    });
  }

  function renderCurrent(){
    const row=board.querySelector(`.wordy-row[data-row="${guesses.length}"]`);
    if(!row)return;

    [...row.children].forEach((tile,index)=>{
      tile.textContent=current[index]||'';
      tile.classList.toggle('has-letter',Boolean(current[index]));
    });
  }

  function renderProgress(){
    status.textContent=finished?'ROUND COMPLETE':'GUESS THE WORD';
    guessCount.textContent=secret&&!finished
      ?`Guess ${Math.min(guesses.length+1,maxGuesses)} of ${maxGuesses}`
      :'';
    renderKeyboard();
  }

  function scoreGuess(guess){
    const states=Array(secret.length).fill('absent');
    const remaining={};

    for(let i=0;i<secret.length;i++){
      if(guess[i]===secret[i]){
        states[i]='correct';
      }else{
        remaining[secret[i]]=(remaining[secret[i]]||0)+1;
      }
    }

    for(let i=0;i<secret.length;i++){
      if(states[i]==='correct')continue;
      const letter=guess[i];
      if(remaining[letter]>0){
        states[i]='present';
        remaining[letter]--;
      }
    }

    return states;
  }

  function shakeCurrentRow(text){
    const row=board.querySelector(`.wordy-row[data-row="${guesses.length}"]`);
    if(!row)return;

    message.textContent=text;
    row.classList.remove('is-shaking');
    void row.offsetWidth;
    row.classList.add('is-shaking');
    setTimeout(()=>row.classList.remove('is-shaking'),420);
  }

  function revealGuess(guess,states){
    revealing=true;
    renderKeyboard();

    const rowIndex=guesses.length-1;
    const row=board.querySelector(`.wordy-row[data-row="${rowIndex}"]`);
    const tiles=[...row.children];

    tiles.forEach((tile,index)=>{
      tile.textContent=guess[index];
      tile.classList.remove('has-letter');
      tile.classList.add('is-flipping');
      tile.style.setProperty('--wordy-delay',`${index*115}ms`);

      setTimeout(()=>{
        tile.dataset.state=states[index];
        setKeyState(guess[index],states[index]);
      },index*115+170);
    });

    const duration=(secret.length-1)*115+560;

    setTimeout(()=>{
      revealing=false;
      tiles.forEach(tile=>tile.classList.remove('is-flipping'));
      renderKeyboard();

      const won=guess===secret;
      const lost=!won&&guesses.length>=maxGuesses;

      if(won){
        row.classList.add('is-bouncing');
        setTimeout(()=>finishRound(true),430);
      }else if(lost){
        finishRound(false);
      }else{
        current='';
        message.textContent='';
        renderCurrent();
        renderProgress();
      }
    },duration);
  }

  function submitGuess(){
    if(!secret||finished||revealing)return;

    if(current.length!==secret.length){
      shakeCurrentRow(`Enter ${secret.length} letters`);
      return;
    }

    const guess=current;
    const states=scoreGuess(guess);
    guesses.push(guess);
    revealGuess(guess,states);
  }

  function typeLetter(letter){
    if(!secret||finished||revealing)return;
    if(current.length>=secret.length)return;

    current+=letter;
    message.textContent='';
    renderCurrent();

    const row=board.querySelector(`.wordy-row[data-row="${guesses.length}"]`);
    const tile=row?.children[current.length-1];
    if(tile){
      tile.classList.remove('wordy-pop');
      void tile.offsetWidth;
      tile.classList.add('wordy-pop');
    }
  }

  function backspaceLetter(){
    if(!secret||finished||revealing||!current.length)return;
    current=current.slice(0,-1);
    message.textContent='';
    renderCurrent();
  }

  function finishRound(won){
    finished=true;
    revealing=false;
    status.textContent=won?'YOU GOT IT!':'ROUND COMPLETE';
    guessCount.textContent='';
    renderKeyboard();

    resultLabel.textContent=won
      ?'You guessed the word'
      :'You ran out of guesses';
    resultWord.textContent=secret;
    result.hidden=false;

    if(won)launchConfetti(m);
  }

  function startGame(){
    const next=normalizeWord(secretInput.value);

    if(next.length<3||next.length>8){
      setupError.textContent='Enter a word from 3 to 8 letters.';
      secretInput.focus();
      return;
    }

    secret=next;
    guesses=[];
    current='';
    finished=false;
    revealing=false;
    keyboardState={};

    setupError.textContent='';
    secretInput.value='';
    setup.hidden=true;
    result.hidden=true;
    resultLabel.textContent='';
    resultWord.textContent='';
    message.textContent='';

    buildBoard();
    renderProgress();

    requestAnimationFrame(()=>{
      m.focus({preventScroll:true});
    });
  }

  function openSetup(){
    secret='';
    guesses=[];
    current='';
    finished=false;
    revealing=false;
    keyboardState={};

    clearAnimations();
    board.replaceChildren();
    message.textContent='';
    status.textContent='TEACHER SETUP';
    guessCount.textContent='';
    result.hidden=true;
    setup.hidden=false;
    setupError.textContent='';
    secretInput.value='';

    keyboard.querySelectorAll('.wordy-key').forEach(button=>{
      button.disabled=true;
      delete button.dataset.state;
    });

    requestAnimationFrame(()=>secretInput.focus({preventScroll:true}));
  }

  startButton.addEventListener('click',startGame);

  secretInput.addEventListener('input',()=>{
    const cleaned=normalizeWord(secretInput.value);
    if(secretInput.value!==cleaned)secretInput.value=cleaned;
    setupError.textContent='';
  });

  secretInput.addEventListener('keydown',event=>{
    if(event.key==='Enter'){
      event.preventDefault();
      startGame();
    }
  });

  playAgain.addEventListener('click',event=>{
    event.stopPropagation();
    openSetup();
  });

  m.addEventListener('pointerdown',event=>{
    if(setup.hidden&&result.hidden&&!event.target.closest('button,input')){
      m.focus({preventScroll:true});
    }
  });

  m.addEventListener('keydown',event=>{
    if(!secret||finished||revealing)return;
    if(event.target.closest('input'))return;

    if(/^[a-zA-Z]$/.test(event.key)){
      event.preventDefault();
      typeLetter(event.key.toUpperCase());
      return;
    }

    if(event.key==='Backspace'){
      event.preventDefault();
      backspaceLetter();
      return;
    }

    if(event.key==='Enter'){
      event.preventDefault();
      submitGuess();
    }
  });

  bgButton.addEventListener('click',()=>{
    cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']);
  });

  fontButton.addEventListener('click',()=>{
    cycleData(m,'font',FONT_OPTIONS);
  });

  buildKeyboard();
  openSetup();

  m._boardGetState=()=>({
    secret,
    guesses:[...guesses],
    current,
    finished,
    setupOpen:!setup.hidden
  });
  m._boardSetState=state=>{
    if(!state||state.setupOpen||!normalizeWord(state.secret||'')){
      openSetup();
      return;
    }
    secret=normalizeWord(state.secret);
    guesses=Array.isArray(state.guesses)
      ?state.guesses.map(normalizeWord).filter(guess=>guess.length===secret.length).slice(0,maxGuesses)
      :[];
    current=normalizeWord(state.current||'').slice(0,secret.length);
    finished=Boolean(state.finished);
    revealing=false;
    keyboardState={};
    setup.hidden=true;
    setupError.textContent='';
    result.hidden=true;
    resultLabel.textContent='';
    resultWord.textContent='';
    message.textContent='';
    buildBoard();
    guesses.forEach((guess,rowIndex)=>{
      const states=scoreGuess(guess);
      const row=board.querySelector(`.wordy-row[data-row="${rowIndex}"]`);
      [...(row?.children||[])].forEach((tile,index)=>{
        tile.textContent=guess[index]||'';
        tile.dataset.state=states[index]||'absent';
        setKeyState(guess[index],states[index]);
      });
    });
    if(!finished)renderCurrent();
    renderProgress();
    if(finished){
      const won=guesses.some(guess=>guess===secret);
      status.textContent=won?'YOU GOT IT!':'ROUND COMPLETE';
      guessCount.textContent='';
      resultLabel.textContent=won?'You guessed the word':'You ran out of guesses';
      resultWord.textContent=secret;
      result.hidden=false;
      renderKeyboard();
    }
  };
}

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

  m._boardGetState=()=>({
    secret,
    guessed:[...guessed],
    wrong:[...wrong],
    finished,
    setupOpen:!setup.hidden
  });
  m._boardSetState=state=>{
    if(!state||state.setupOpen||!normalizeWord(state.secret||'')){
      openSetup();
      return;
    }
    secret=normalizeWord(state.secret);
    const allowed=new Set(alphabet);
    guessed=new Set(Array.isArray(state.guessed)?state.guessed.map(String).filter(letter=>allowed.has(letter)):[]);
    wrong=Array.isArray(state.wrong)?state.wrong.map(String).filter(letter=>allowed.has(letter)&&!secret.includes(letter)).slice(0,maxWrong):[];
    finished=Boolean(state.finished);
    setup.hidden=true;
    result.hidden=true;
    m.classList.toggle('is-finished',finished);
    render();
    if(finished){
      const won=checkWin();
      status.textContent=won?'YOU WON!':'TRY AGAIN!';
      resultLabel.textContent=won?'YOU WON!':'TRY AGAIN!';
      resultMessage.textContent=`The word was ${secret}!`;
      result.hidden=false;
      renderWord();
      renderKeyboard();
    }
  };
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
    ['#ffb8a7','#ed806e'],['#ffe09a','#eebf50'],['#c8eaa9','#81bd67'],['#a9e7dc','#55bbaa'],
    ['#b7d7ff','#6fa5e9'],['#d5c4fa','#987bd8'],['#f7bed9','#df7dad'],['#ead9b8','#c7a36c'],
    ['#ffc9a8','#ef9364'],['#c4e4f5','#6eafd1'],['#d8eba8','#9ebd53'],['#efc1b2','#d77966']
  ];

  const getWheelFont=()=>{
    const family=getComputedStyle(m).getPropertyValue('--module-font').trim();
    return family||'Inter,system-ui,sans-serif';
  };

  function renderNameList(){
    requestAnimationFrame(()=>fitNameModuleToRoster(m,names.length,{namesPerRow:4,rowHeight:32,threshold:8}));
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
    const wheelWrap=canvas.parentElement;
    const displaySize=Math.max(190,Math.min(390,(wheelWrap?.clientWidth||390)*.94,wheelWrap?.clientHeight||390));
    m.style.setProperty('--spinner-wheel-size',`${displaySize}px`);
    m.style.setProperty('--spinner-wheel-radius',`${displaySize/2}px`);
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
    const wheelFont=getWheelFont();
    const labelStart=68;
    const labelEnd=r-16;
    const labelWidth=labelEnd-labelStart;

    const fitLabel=(name,maxFont)=>{
      const clean=String(name).trim()||'—';
      let lines=[clean];
      const words=clean.split(/\s+/);
      if(words.length>1){
        let best=[clean];
        let bestBalance=Infinity;
        for(let split=1;split<words.length;split++){
          const candidate=[words.slice(0,split).join(' '),words.slice(split).join(' ')];
          const balance=Math.max(...candidate.map(line=>line.length));
          if(balance<bestBalance){best=candidate;bestBalance=balance;}
        }
        lines=best;
      }
      let fontSize=maxFont;
      const fits=()=>{
        ctx.font=`850 ${fontSize}px ${wheelFont}`;
        return lines.every(line=>ctx.measureText(line).width<=labelWidth);
      };
      while(fontSize>7&&!fits())fontSize-=.5;
      if(!fits()&&lines.length===1&&clean.length>1){
        const split=Math.ceil(clean.length/2);
        lines=[clean.slice(0,split),clean.slice(split)];
        fontSize=maxFont;
        while(fontSize>7&&!fits())fontSize-=.5;
      }
      return{lines,fontSize};
    };

    names.forEach((name,i)=>{
      const start=-Math.PI/2+i*arc;
      const end=start+arc;
      const middle=start+arc/2;

      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.arc(0,0,r,start,end);
      ctx.closePath();
      const [innerColor,outerColor]=palette[i%palette.length];
      const fill=ctx.createRadialGradient(0,0,r*.08,0,0,r);
      fill.addColorStop(0,innerColor);
      fill.addColorStop(1,outerColor);
      ctx.fillStyle=fill;
      ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,.82)';
      ctx.lineWidth=2.5;
      ctx.stroke();

      ctx.save();
      ctx.rotate(middle);
      const upsideDown=Math.cos(middle)<0;
      if(upsideDown)ctx.rotate(Math.PI);
      const labelCenter=(labelStart+labelEnd)/2;
      ctx.translate(upsideDown?-labelCenter:labelCenter,0);
      ctx.fillStyle='#111820';
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      const maxFont=Math.max(10,Math.min(24,arc*112*.72));
      const fitted=fitLabel(name,maxFont);
      ctx.font=`950 ${fitted.fontSize}px ${wheelFont}`;
      ctx.lineJoin='round';
      ctx.strokeStyle='rgba(255,255,255,.78)';
      ctx.lineWidth=Math.max(2.4,fitted.fontSize*.18);
      ctx.shadowColor='rgba(255,255,255,.64)';
      ctx.shadowBlur=1.5;
      const lineHeight=fitted.fontSize*1.08;
      fitted.lines.forEach((line,lineIndex)=>{
        const y=(lineIndex-(fitted.lines.length-1)/2)*lineHeight;
        ctx.strokeText(line,0,y);
        ctx.fillText(line,0,y);
      });
      ctx.restore();
    });

    ctx.beginPath();
    ctx.arc(0,0,r,0,Math.PI*2);
    ctx.strokeStyle='rgba(20,27,35,.24)';
    ctx.lineWidth=5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0,0,56,0,Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,.2)';
    ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.72)';
    ctx.lineWidth=3;
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
    playUiSfx('confetti');
    playUiSfx('timer-tada');
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
  const refreshWheelLayout=()=>requestAnimationFrame(drawWheel);
  m.addEventListener('pointerenter',refreshWheelLayout);
  m.addEventListener('pointerleave',refreshWheelLayout);

  renderNameList();
  drawWheel();

  const detachRosterLoader=attachClassRosterLoader(input.closest('.spinner-name-entry'),rosterNames=>{
    if(spinning)return;
    names=normalizeRosterNames(rosterNames);
    dismissWinner();
    renderNameList();
    drawWheel();
    winner.textContent=names.length?'CLICK TO SPIN':'ADD NAMES';
  });

  m._boardGetState=()=>({names:[...names],rotation});
  m._boardSetState=state=>{
    if(!state)return;
    names=Array.isArray(state.names)?state.names.map(String):[];
    rotation=Number(state.rotation)||0;
    spinning=false;
    dismissWinner();
    renderNameList();
    drawWheel();
    winner.textContent=names.length?'CLICK TO SPIN':'ADD NAMES';
  };

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    detachRosterLoader();
    cancelAnimationFrame(raf);
    ro.disconnect();
    m.removeEventListener('pointerenter',refreshWheelLayout);
    m.removeEventListener('pointerleave',refreshWheelLayout);
    spinAudio.pause();
    spinAudio.currentTime=0;
  };
}



const BOARD_SAVE_SCHEMA_VERSION=2;
const BOARD_TRANSIENT_CLASSES=new Set([
  'is-selected','is-over-trash','is-dragging','trash-delete','sticker-placed',
  'is-sticker-resizing','is-sticker-rotating','is-snap-grouped','is-tug-armed','stoplight-pop','is-flipping',
  'is-fitting','is-shuffling','is-dragover','is-drop-target','is-meter-filling','is-meter-filled','is-collection-filled'
]);
let activeTeacherTilesBoardId='';

function makeBoardObjectId(){
  if(globalThis.crypto?.randomUUID)return crypto.randomUUID();
  return`obj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
}

function ensureBoardObjectId(m){
  if(!m.dataset.boardObjectId)m.dataset.boardObjectId=makeBoardObjectId();
  return m.dataset.boardObjectId;
}

function boardTypeAvailable(type){
  return type==='sticker'||Boolean(document.getElementById(`${type}-template`));
}

function boardStickerAvailable(sticker){
  if(!sticker||typeof sticker!=='object')return false;
  const wantedEmoji=String(sticker.emoji||'');
  const wantedSrc=String(sticker.src||'');
  if(!wantedEmoji&&!wantedSrc)return false;
  return[...document.querySelectorAll('[data-sticker-src],[data-sticker-emoji]')].some(item=>{
    if(wantedEmoji&&String(item.dataset.stickerEmoji||'')===wantedEmoji)return true;
    if(wantedSrc&&String(item.dataset.stickerSrc||'')===wantedSrc)return true;
    return false;
  });
}

function captureBoardDataset(m){
  const data={};
  for(const [key,value] of Object.entries(m.dataset)){
    if(['type','boardObjectId','stickerDragReady'].includes(key))continue;
    data[key]=value;
  }
  return data;
}

function restoreBoardDataset(m,dataset){
  if(!dataset||typeof dataset!=='object')return;
  for(const [key,value] of Object.entries(dataset)){
    if(key==='type'||key==='boardObjectId')continue;
    m.dataset[key]=String(value);
  }
}

function captureBoardFields(m){
  return[...m.querySelectorAll('input,textarea,select')].map((field,index)=>{
    if(field instanceof HTMLInputElement&&field.type==='file')return null;
    const saved={index,value:field.value};
    if('checked'in field)saved.checked=Boolean(field.checked);
    return saved;
  }).filter(Boolean);
}

function restoreBoardFields(m,fields,{dispatch=false}={}){
  if(!Array.isArray(fields))return;
  const controls=[...m.querySelectorAll('input,textarea,select')];
  for(const saved of fields){
    const field=controls[saved.index];
    if(!field||(field instanceof HTMLInputElement&&field.type==='file'))continue;
    if(typeof saved.value==='string')field.value=saved.value;
    if(saved.checked!==undefined&&'checked'in field)field.checked=Boolean(saved.checked);
    if(dispatch){
      field.dispatchEvent(new Event('input',{bubbles:true}));
      field.dispatchEvent(new Event('change',{bubbles:true}));
    }
  }
}

function captureBoardEditables(m){
  return[...m.querySelectorAll('[contenteditable]:not([contenteditable="false"])')].map((el,index)=>({index,html:el.innerHTML}));
}

function restoreBoardEditables(m,editables,{dispatch=false}={}){
  if(!Array.isArray(editables))return;
  const elements=[...m.querySelectorAll('[contenteditable]:not([contenteditable="false"])')];
  for(const saved of editables){
    const el=elements[saved.index];
    if(!el)continue;
    el.innerHTML=typeof saved.html==='string'?saved.html:'';
    if(dispatch)el.dispatchEvent(new Event('input',{bubbles:true}));
  }
}

function captureBoardClasses(m){
  return[...m.classList].filter(name=>
    !BOARD_TRANSIENT_CLASSES.has(name)&&
    name!=='module'&&
    !name.endsWith('-module')
  );
}

function applyBoardPreSetupState(m,state){
  if(!state)return;
  if(state.id)m.dataset.boardObjectId=state.id;
  restoreBoardDataset(m,state.dataset);
  for(const cls of Array.isArray(state.classes)?state.classes:[]){
    if(!BOARD_TRANSIENT_CLASSES.has(cls))m.classList.add(cls);
  }
  restoreBoardFields(m,state.fields,{dispatch:false});
  restoreBoardEditables(m,state.editables,{dispatch:false});
}

function applyBoardPostSetupState(m,state){
  if(!m||!state)return;
  // Setup routines may establish their own default data attributes while they
  // wire controls. Reapply the saved customization after setup so colors,
  // fonts, layouts, styles, and other dataset-backed choices always survive.
  restoreBoardDataset(m,state.dataset);
  restoreBoardFields(m,state.fields,{dispatch:true});
  restoreBoardEditables(m,state.editables,{dispatch:true});

  if(state.special&&typeof m._boardSetState==='function'){
    try{m._boardSetState(state.special)}catch(error){console.warn('TeacherTiles could not restore module state',state.type,error)}
  }
  if(state.timer&&typeof m._boardTimerSetState==='function'){
    try{m._boardTimerSetState(state.timer)}catch(error){console.warn('TeacherTiles could not restore timer state',error)}
  }

  if(state.transform)applyModuleTransform(m,state.transform);
  if(state.zIndex!==undefined&&Number.isFinite(Number(state.zIndex))){
    const saved=Math.max(1,Math.round(Number(state.zIndex)));
    if(m.dataset.type==='sticker'){
      const local=saved>=STICKER_Z_BASE?saved-STICKER_Z_BASE:saved;
      stickerZ=Math.max(stickerZ,local);
      m.style.zIndex=String(STICKER_Z_BASE+local);
    }else{
      const local=Math.min(STICKER_Z_BASE-1,saved);
      tileZ=Math.max(tileZ,local);
      m.style.zIndex=String(local);
    }
  }

  if(m.dataset.type==='youtube'&&state.special?.loaded&&m.querySelector('.youtube-load')){
    requestAnimationFrame(()=>m.querySelector('.youtube-load')?.click());
  }
  disableModuleSpellcheck(m);
}

function serializeBoardModule(m){
  const type=m.dataset.type||'';
  if(!type||!boardTypeAvailable(type))return null;
  const id=ensureBoardObjectId(m);
  const base={
    id,
    schemaVersion:BOARD_SAVE_SCHEMA_VERSION,
    type,
    transform:captureModuleTransform(m),
    zIndex:Number(m.style.zIndex)||0,
    dataset:captureBoardDataset(m),
    fields:captureBoardFields(m),
    editables:captureBoardEditables(m),
    classes:captureBoardClasses(m)
  };

  if(type==='sticker'){
    base.sticker={
      src:m.dataset.stickerSrc||m.querySelector('.sticker-visual img')?.getAttribute('src')||'',
      emoji:m.dataset.stickerEmoji||m.querySelector('.sticker-emoji')?.textContent||'',
      name:m.dataset.stickerName||m.getAttribute('aria-label')?.replace(/\s+sticker$/i,'')||'Sticker',
      aspect:Number(m.dataset.stickerAspect)||m._stickerRatio||1
    };
  }

  if(typeof m._boardGetState==='function'){
    try{base.special=m._boardGetState()}catch(error){console.warn('TeacherTiles could not capture module state',type,error)}
  }
  if(typeof m._boardTimerGetState==='function'){
    try{base.timer=m._boardTimerGetState()}catch(error){console.warn('TeacherTiles could not capture timer state',error)}
  }

  return base;
}

function buildBoardPreview(objects){
  const list=(Array.isArray(objects)?objects:[]).filter(Boolean).slice(0,48);
  if(!list.length)return[];
  const boxes=list.map(object=>{
    const t=object.transform||{};
    return{
      object,
      left:Number(t.left)||0,
      top:Number(t.top)||0,
      width:Math.max(24,Number(t.width)||160),
      height:Math.max(24,Number(t.height)||120)
    };
  });
  let minX=Math.min(...boxes.map(box=>box.left));
  let minY=Math.min(...boxes.map(box=>box.top));
  let maxX=Math.max(...boxes.map(box=>box.left+box.width));
  let maxY=Math.max(...boxes.map(box=>box.top+box.height));
  const pad=Math.max(120,Math.max(maxX-minX,maxY-minY)*.08);
  minX-=pad;minY-=pad;maxX+=pad;maxY+=pad;
  let spanX=Math.max(1,maxX-minX),spanY=Math.max(1,maxY-minY);
  const previewAspect=16/10,contentAspect=spanX/spanY;
  if(contentAspect>previewAspect){
    const fittedHeight=spanX/previewAspect;
    minY-=(fittedHeight-spanY)/2;
    spanY=fittedHeight;
  }else{
    const fittedWidth=spanY*previewAspect;
    minX-=(fittedWidth-spanX)/2;
    spanX=fittedWidth;
  }

  return boxes.map(({object,left,top,width,height})=>({
    type:object.type,
    x:clamp((left-minX)/spanX,0,1),
    y:clamp((top-minY)/spanY,0,1),
    w:clamp(width/spanX,.001,1),
    h:clamp(height/spanY,.001,1),
    zIndex:Number(object.zIndex)||0,
    emoji:object.sticker?.emoji||'',
    src:object.sticker?.src&&!String(object.sticker.src).startsWith('data:')?object.sticker.src:''
  }));
}

function captureTeacherTilesBoard(){
  const objects=[...workspace.querySelectorAll('.module')].map(serializeBoardModule).filter(Boolean);
  return{
    schemaVersion:BOARD_SAVE_SCHEMA_VERSION,
    theme:document.body.dataset.theme||'light',
    camera:{x:boardCamera.x,y:boardCamera.y,scale:boardCamera.scale},
    preferences:boardPreferenceSnapshot(),
    calendarEvents:getStoredCalendarEvents(),
    objects,
    preview:buildBoardPreview(objects)
  };
}

function clearTeacherTilesBoard(){
  clearSelection();
  for(const m of [...workspace.querySelectorAll('.module')]){
    try{m._cleanup?.()}catch{}
    m.remove();
  }
  workspace.querySelectorAll('.board-drawing-canvas').forEach(canvas=>canvas.remove());
  undoStack.splice(0,undoStack.length);
  redoStack.splice(0,redoStack.length);
  tileZ=10;
  stickerZ=10;
  updateWorkspaceEmptyState();
}

function restoreTeacherTilesBoardObject(state){
  if(!state||!boardTypeAvailable(state.type))return null;
  const t=state.transform||{};
  if(state.type==='sticker'){
    const sticker=state.sticker||{};
    if(!boardStickerAvailable(sticker))return null;
    const centerX=(Number(t.left)||BOARD_WIDTH/2)+(Number(t.width)||180)/2;
    const centerY=(Number(t.top)||BOARD_HEIGHT/2)+(Number(t.height)||180)/2;
    const clientX=boardCamera.x+centerX*boardCamera.scale;
    const clientY=boardCamera.y+centerY*boardCamera.scale;
    const m=createStickerModule({
      src:sticker.src||'',
      emoji:sticker.emoji||'',
      name:sticker.name||'Sticker',
      aspect:Number(sticker.aspect)||1
    },clientX,clientY,{record:false,animate:false,objectId:state.id||makeBoardObjectId()});
    if(!m)return null;
    applyBoardPreSetupState(m,state);
    applyBoardPostSetupState(m,state);
    return m;
  }

  const x=(Number(t.left)||BOARD_WIDTH/2)+(Number(t.width)||320)/2;
  const y=(Number(t.top)||BOARD_HEIGHT/2)+18;
  return createModule(state.type,x,y,{record:false,boardState:state});
}

function loadTeacherTilesBoard(snapshot){
  const data=snapshot&&typeof snapshot==='object'?snapshot:{};
  const removedObjectIds=[];
  withBoardChangesSuspended(()=>{
    clearTeacherTilesBoard();
    if(data.preferences&&typeof data.preferences==='object')applyAppPreferences(data.preferences,{persist:true,notify:false,applyView:false});
    applyTeacherTheme(TEACHERTILES_THEMES.has(data.theme)?data.theme:'light',{persist:false});
    if(Array.isArray(data.calendarEvents)){
      try{localStorage.setItem(CALENDAR_STORAGE_KEY,JSON.stringify(data.calendarEvents))}catch{}
    }

    const camera=data.camera||{};
    boardCamera.scale=clamp(Number(camera.scale)||1,BOARD_MIN_ZOOM,BOARD_MAX_ZOOM);
    boardCamera.x=Number.isFinite(Number(camera.x))?Number(camera.x):(innerWidth-BOARD_WIDTH*boardCamera.scale)/2;
    boardCamera.y=Number.isFinite(Number(camera.y))?Number(camera.y):(innerHeight-BOARD_HEIGHT*boardCamera.scale)/2;
    applyBoardCamera();

    for(const object of Array.isArray(data.objects)?data.objects:[]){
      if(!boardTypeAvailable(object?.type)){
        if(object?.id)removedObjectIds.push(object.id);
        continue;
      }
      try{
        const restored=restoreTeacherTilesBoardObject(object);
        if(!restored&&object?.id)removedObjectIds.push(object.id);
      }catch(error){
        console.warn('TeacherTiles skipped a saved board object',object?.type,error);
        if(object?.id)removedObjectIds.push(object.id);
      }
    }
    normalizeSnapGroups();
    clearSelection();
    undoStack.splice(0,undoStack.length);
    redoStack.splice(0,redoStack.length);
    updateWorkspaceEmptyState();
  });
  window.dispatchEvent(new CustomEvent('teachertiles:boardloaded',{detail:{removedObjectIds}}));
  return{removedObjectIds};
}

function blankTeacherTilesBoard(){
  const scale=clamp((Number(appPreferences.defaultViewSize)||100)/100,BOARD_MIN_ZOOM,BOARD_MAX_ZOOM);
  return{
    schemaVersion:BOARD_SAVE_SCHEMA_VERSION,
    theme:'light',
    camera:{
      x:(innerWidth-BOARD_WIDTH*scale)/2,
      y:(innerHeight-BOARD_HEIGHT*scale)/2,
      scale
    },
    preferences:boardPreferenceSnapshot(),
    calendarEvents:[],
    objects:[],
    preview:[]
  };
}

workspace.addEventListener('input',event=>{
  if(event.target instanceof Element&&event.target.closest('.module')&&!event.target.closest('[data-skip-board-save]'))notifyBoardChanged('input');
},true);
workspace.addEventListener('change',event=>{
  if(event.target instanceof Element&&event.target.closest('.module')&&!event.target.closest('[data-skip-board-save]'))notifyBoardChanged('change');
},true);
workspace.addEventListener('click',event=>{
  if(event.target instanceof Element&&event.target.closest('.module')&&!event.target.closest('[data-skip-board-save]'))setTimeout(()=>notifyBoardChanged('module-action'),0);
},true);
document.addEventListener('pointerup',event=>{
  const target=event.target;
  if(target instanceof Element&&!target.closest('[data-skip-board-save]')&&(target.closest('.module')||target.classList.contains('board-drawing-canvas')))notifyBoardChanged('pointer-action');
},true);

window.TeacherTilesBoard={
  schemaVersion:BOARD_SAVE_SCHEMA_VERSION,
  capture:captureTeacherTilesBoard,
  load:loadTeacherTilesBoard,
  blank:blankTeacherTilesBoard,
  clear:()=>withBoardChangesSuspended(clearTeacherTilesBoard),
  isTypeAvailable:boardTypeAvailable,
  isStickerAvailable:boardStickerAvailable,
  setActiveBoardId(id){activeTeacherTilesBoardId=String(id||'')},
  get activeBoardId(){return activeTeacherTilesBoardId},
  markChanged:notifyBoardChanged
};

function setupChangelog(){
  const changelogContent=document.getElementById('changelog-content');
  const newsContent=document.getElementById('news-content');
  const contactForm=document.getElementById('contact-form');
  const contactStatus=document.getElementById('contact-status');
  const contactSubmit=document.getElementById('contact-submit');

  if(!changelogContent||!newsContent)return;

  const loaded={announcements:false,news:false};

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
    safe=safe.replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g,'<img class="changelog-image" src="$2" alt="$1" loading="lazy" decoding="async">');
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
    const label=isNews?'news':'updates';

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

  window.addEventListener('teachertiles:settings-tab',event=>{
    const name=event.detail?.name;
    if((name==='announcements'||name==='news')&&!loaded[name])loadFeed(name);
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

        const response=await fetch('https://formsubmit.co/ajax/teachertiles@gmail.com',{
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


(() => {
  const topRightTray = document.querySelector('.workspace-controls');
  const bottomLeftTray = document.querySelector('.workspace-upcoming-controls');
  const topLeftButton = document.getElementById('boards-toggle');
  if (!topRightTray || !bottomLeftTray || !topLeftButton) return;

  const FULL_X = 250;
  const FULL_Y = 175;
  const NEAR_X = 330;
  const NEAR_Y = 235;
  let pointerX = -1;
  let pointerY = -1;

  const setState = (target, full, near) => {
    target.classList.toggle('is-revealed', full);
    target.classList.toggle('is-near', !full && near);
  };

  const hasKeyboardFocus = target => lastUiInteractionWasKeyboard && target.matches(':focus-within');
  const update = () => {
    const pointerKnown = pointerX >= 0 && pointerY >= 0;
    const topRightFull = pointerKnown && pointerX >= window.innerWidth - FULL_X && pointerY <= FULL_Y;
    const topRightNear = pointerKnown && pointerX >= window.innerWidth - NEAR_X && pointerY <= NEAR_Y;
    const bottomLeftFull = pointerKnown && pointerX <= FULL_X && pointerY >= window.innerHeight - FULL_Y;
    const bottomLeftNear = pointerKnown && pointerX <= NEAR_X && pointerY >= window.innerHeight - NEAR_Y;
    const topLeftFull = pointerKnown && pointerX <= FULL_X && pointerY <= FULL_Y;
    const topLeftNear = pointerKnown && pointerX <= NEAR_X && pointerY <= NEAR_Y;

    setState(topRightTray, topRightFull || topRightTray.matches(':hover') || hasKeyboardFocus(topRightTray), topRightNear);
    setState(bottomLeftTray, bottomLeftFull || bottomLeftTray.matches(':hover') || hasKeyboardFocus(bottomLeftTray), bottomLeftNear);
    setState(topLeftButton, topLeftFull || topLeftButton.matches(':hover') || (lastUiInteractionWasKeyboard && topLeftButton.matches(':focus-visible')), topLeftNear);
  };

  document.addEventListener('pointermove', event => {
    if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    pointerX = event.clientX;
    pointerY = event.clientY;
    update();
  }, { passive:true });

  document.addEventListener('pointerdown', event => {
    if (!event.pointerType || event.pointerType === 'mouse' || event.pointerType === 'pen') {
      pointerX = event.clientX;
      pointerY = event.clientY;
    }
    requestAnimationFrame(update);
  }, { passive:true });

  document.addEventListener('focusin', () => requestAnimationFrame(update));
  document.addEventListener('focusout', () => requestAnimationFrame(update));
  window.addEventListener('resize', update);
  window.addEventListener('blur', () => {
    pointerX = -1;
    pointerY = -1;
    setState(topRightTray, false, false);
    setState(bottomLeftTray, false, false);
    setState(topLeftButton, false, false);
  });

  topRightTray.addEventListener('pointerenter', () => setState(topRightTray, true, true));
  bottomLeftTray.addEventListener('pointerenter', () => setState(bottomLeftTray, true, true));
  topLeftButton.addEventListener('pointerenter', () => setState(topLeftButton, true, true));
  topRightTray.addEventListener('pointerleave', () => requestAnimationFrame(update));
  bottomLeftTray.addEventListener('pointerleave', () => requestAnimationFrame(update));
  topLeftButton.addEventListener('pointerleave', () => requestAnimationFrame(update));
})();



function setupTeacherTilesShop(){
  const modal=document.getElementById('shop-modal');
  const toggle=document.getElementById('shop-toggle');
  const close=document.getElementById('shop-close');
  if(!modal||!toggle||!close)return;

  const pages=[...modal.querySelectorAll('[data-shop-page]')];
  const pageButtons=[...modal.querySelectorAll('[data-shop-open-page]')];
  const balanceNode=document.getElementById('shop-coin-balance');
  const coinButton=document.getElementById('shop-coins-button');
  const coinMenu=document.getElementById('shop-coin-menu');
  const coinMenuClose=document.getElementById('shop-coin-menu-close');
  const toast=document.getElementById('shop-toast');
  const banners=[...modal.querySelectorAll('[data-shop-banner]')];
  const dots=[...modal.querySelectorAll('[data-shop-banner-dot]')];
  const prev=modal.querySelector('[data-shop-banner-prev]');
  const next=modal.querySelector('[data-shop-banner-next]');
  const products=[...modal.querySelectorAll('[data-shop-product]')];
  const redeemForm=document.getElementById('shop-redeem-form');
  const redeemInput=document.getElementById('shop-redeem-code');
  const redeemStatus=document.getElementById('shop-redeem-status');
  const subscribePreview=document.getElementById('shop-subscribe-preview');
  const reduceMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const COINS_KEY='teacherTilesCoins';
  let activePage='home',bannerIndex=0,bannerTimer=0,toastTimer=0,lastFocus=null;

  function getCoins(){
    const raw=Number(localStorage.getItem(COINS_KEY));
    return Number.isFinite(raw)&&raw>=0?Math.floor(raw):0;
  }
  function setCoins(value){
    const safe=Math.max(0,Math.floor(Number(value)||0));
    localStorage.setItem(COINS_KEY,String(safe));
    if(balanceNode)balanceNode.textContent=safe.toLocaleString();
    return safe;
  }
  function getOwned(){
    return getOwnedShopProducts();
  }
  function setOwned(set){
    localStorage.setItem(SHOP_OWNED_PRODUCTS_KEY,JSON.stringify([...set]));
    window.dispatchEvent(new CustomEvent('teachertiles:shopownershipchange',{detail:{owned:[...set]}}));
  }
  function syncProducts(){
    const owned=getOwned();
    products.forEach(card=>{
      const isOwned=owned.has(card.dataset.shopProduct);
      card.classList.toggle('is-owned',isOwned);
      const button=card.querySelector('[data-shop-buy]');
      if(!button)return;
      button.innerHTML=isOwned?'<strong>Owned</strong>':`<span class="shop-coin-icon shop-coin-icon--small" aria-hidden="true"><img src="assets/shop/coin.png" alt=""></span><strong>${Number(card.dataset.shopPrice||0).toLocaleString()}</strong>`;
      button.setAttribute('aria-label',isOwned?`${card.querySelector('h3')?.textContent||'Pack'} owned`:`Buy ${card.querySelector('h3')?.textContent||'pack'} for ${card.dataset.shopPrice||0} coins`);
    });
  }
  function showToast(message){
    if(!toast)return;
    toast.textContent=message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>toast.classList.remove('is-visible'),2300);
  }
  function showPage(name){
    if(!pages.some(page=>page.dataset.shopPage===name))name='home';
    activePage=name;
    pages.forEach(page=>{
      const active=page.dataset.shopPage===name;
      page.hidden=!active;
      page.classList.toggle('is-active',active);
    });
    modal.querySelector('.shop-content')?.scrollTo({top:0,behavior:reduceMotion?'auto':'smooth'});
  }
  function showBanner(index,restart=true){
    if(!banners.length)return;
    bannerIndex=(index+banners.length)%banners.length;
    banners.forEach((slide,i)=>slide.classList.toggle('is-active',i===bannerIndex));
    dots.forEach((dot,i)=>{
      const active=i===bannerIndex;
      dot.classList.toggle('is-active',active);
      dot.setAttribute('aria-selected',String(active));
    });
    if(restart)startBannerTimer();
  }
  function stopBannerTimer(){if(bannerTimer){clearInterval(bannerTimer);bannerTimer=0}}
  function startBannerTimer(){
    stopBannerTimer();
    if(reduceMotion||modal.hidden||coinMenu&&!coinMenu.hidden)return;
    bannerTimer=setInterval(()=>showBanner(bannerIndex+1,false),5200);
  }
  function openCoins(){
    if(!coinMenu)return;
    coinMenu.hidden=false;
    coinMenu.setAttribute('aria-hidden','false');
    coinButton?.setAttribute('aria-expanded','true');
    requestAnimationFrame(()=>coinMenu.classList.add('is-open'));
    stopBannerTimer();
    coinMenuClose?.focus({preventScroll:true});
  }
  function closeCoins(restoreFocus=true){
    if(!coinMenu||coinMenu.hidden)return;
    coinMenu.classList.remove('is-open');
    coinMenu.setAttribute('aria-hidden','true');
    coinButton?.setAttribute('aria-expanded','false');
    setTimeout(()=>{coinMenu.hidden=true;if(!modal.hidden)startBannerTimer()},reduceMotion?0:220);
    if(restoreFocus)coinButton?.focus({preventScroll:true});
  }
  function openShop(){
    lastFocus=document.activeElement;
    const shelf=document.getElementById('asset-shelf');
    if(shelf?.classList.contains('is-open'))document.getElementById('asset-shelf-close')?.click();
    modal.hidden=false;
    modal.setAttribute('aria-hidden','false');
    toggle.setAttribute('aria-expanded','true');
    showPage('home');
    setCoins(getCoins());
    syncProducts();
    syncStickerShopPackCounts();
    showBanner(bannerIndex,false);
    requestAnimationFrame(()=>modal.classList.add('is-open'));
    startBannerTimer();
    close.focus({preventScroll:true});
  }
  function closeShop(){
    closeCoins(false);
    stopBannerTimer();
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden','true');
    toggle.setAttribute('aria-expanded','false');
    setTimeout(()=>{modal.hidden=true},reduceMotion?0:220);
    if(lastFocus&&typeof lastFocus.focus==='function')lastFocus.focus({preventScroll:true});else toggle.focus({preventScroll:true});
  }
  function tryBuy(card){
    const id=card.dataset.shopProduct;
    const owned=getOwned();
    if(owned.has(id)){showToast('This pack is already owned.');return}
    const price=Math.max(0,Number(card.dataset.shopPrice)||0);
    const coins=getCoins();
    if(coins<price){
      showToast(`You need ${(price-coins).toLocaleString()} more coins.`);
      setTimeout(openCoins,260);
      return;
    }
    setCoins(coins-price);
    owned.add(id);setOwned(owned);syncProducts();
    showToast(`${card.querySelector('h3')?.textContent||'Pack'} added to your collection.`);
  }

  toggle.addEventListener('click',openShop);
  close.addEventListener('click',closeShop);
  modal.querySelectorAll('[data-shop-close]').forEach(node=>node.addEventListener('click',closeShop));
  pageButtons.forEach(button=>button.addEventListener('click',()=>showPage(button.dataset.shopOpenPage)));
  coinButton?.addEventListener('click',openCoins);
  coinMenuClose?.addEventListener('click',()=>closeCoins());
  prev?.addEventListener('click',()=>showBanner(bannerIndex-1));
  next?.addEventListener('click',()=>showBanner(bannerIndex+1));
  dots.forEach(dot=>dot.addEventListener('click',()=>showBanner(Number(dot.dataset.shopBannerDot)||0)));
  products.forEach(card=>card.querySelector('[data-shop-buy]')?.addEventListener('click',()=>tryBuy(card)));
  redeemInput?.addEventListener('input',()=>{
    const start=redeemInput.selectionStart;
    redeemInput.value=redeemInput.value.toUpperCase().replace(/[^A-Z0-9-]/g,'').slice(0,32);
    try{redeemInput.setSelectionRange(start,start)}catch{}
    if(redeemStatus)redeemStatus.textContent='';
  });
  redeemForm?.addEventListener('submit',event=>{
    event.preventDefault();
    const code=redeemInput?.value.trim()||'';
    if(!redeemStatus)return;
    if(!code){redeemStatus.textContent='Enter a code to continue.';redeemStatus.classList.add('is-error');redeemInput?.focus();return}
    redeemStatus.classList.remove('is-error');
    redeemStatus.textContent='Code redemption is ready for a future rewards backend.';
    showToast('Redemption UI ready — no code was applied.');
  });
  subscribePreview?.addEventListener('click',()=>showToast('Membership checkout is not active yet.'));
  modal.querySelector('.shop-banner')?.addEventListener('pointerenter',stopBannerTimer);
  modal.querySelector('.shop-banner')?.addEventListener('pointerleave',startBannerTimer);
  window.addEventListener('teachertiles:coinschange',()=>setCoins(getCoins()));
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||modal.hidden)return;
    if(coinMenu&&!coinMenu.hidden){closeCoins();return}
    closeShop();
  });
  setCoins(getCoins());
  syncProducts();
  syncStickerShopPackCounts();
  window.TeacherTilesShop={open:openShop,openPage:name=>{openShop();showPage(name)},sync:syncProducts};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setupTeacherTilesShop,{once:true});else setupTeacherTilesShop();

async function initializeSandboxRuntime(){
  try{
    const url=new URL('sandbox/sandbox.md',window.location.href);
    url.searchParams.set('ttSandboxCheck',Date.now().toString(36));
    const response=await fetch(url,{cache:'no-store'});
    if(!response.ok)return;
    const contentType=(response.headers.get('content-type')||'').toLowerCase();
    if(contentType.includes('text/html'))return;
    const moduleUrl=new URL('sandbox/dev-console.js',window.location.href);
    moduleUrl.searchParams.set('ttSandboxRuntime',Date.now().toString(36));
    await import(moduleUrl.href);
  }catch{
    // The removable sandbox/ folder is intentionally absent from production builds.
  }
}
initializeSandboxRuntime();
