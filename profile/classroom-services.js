const CLASS_GRADE_LEVELS=Object.freeze(['Pre-K','K','1','2','3','4','5','6','7','8','9','10','11','12','Higher-Ed']);
function normalizeClassGradeLevel(value){return CLASS_GRADE_LEVELS.includes(String(value))?String(value):'';}
function defaultClassPbisEnabled(gradeLevel){return gradeLevel!=='Higher-Ed'&&!(Number(gradeLevel)>=7);}

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

// Seating layouts share the existing account-scoped, encrypted class storage.
function normalizeSeatingChart(value,students){
  if(!value||!Array.isArray(value.desks))return null;
  const names=new Set(students),used=new Set();
  const bounded=(n,min,max)=>Math.max(min,Math.min(max,Number(n)||0));
  return {layout:['rows','groups','horseshoe'].includes(value.layout)?value.layout:'rows',desks:value.desks.filter(d=>d&&typeof d==='object').slice(0,80).map(d=>{
    const name=names.has(d.name)&&!used.has(d.name)?d.name:'';if(name)used.add(name);
    return {name,kind:['desk','table','teacher'].includes(d.kind)?d.kind:'desk',x:bounded(d.x,0,100),y:bounded(d.y,10,100),angle:[0,90,180,270].includes(d.angle)?d.angle:0,pinned:!!d.pinned&&(!d.name||!!name)};
  })};
}

function writeClassSeatingChart(classId,value,source){
  const classes=readClassRosters(),roster=classes.find(item=>item.id===classId);
  if(!roster)return null;
  const chart=normalizeSeatingChart(value,roster.students);
  if(JSON.stringify(chart)===JSON.stringify(roster.seatingChart))return chart;
  roster.seatingChart=chart;
  markPbisLocalDirty(classes);
  localStorage.setItem(classRostersStorageKey(),JSON.stringify(classes));
  window.dispatchEvent(new CustomEvent('teachertiles:seatingchange',{detail:{classId,chart,source}}));
  schedulePbisCloudSave();
  return chart;
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
        logoImage:normalizeProfileImage(item.logoImage),
        gradeLevel:normalizeClassGradeLevel(item.gradeLevel),
        students,
        pbisEnabled:typeof item.pbisEnabled==='boolean'?item.pbisEnabled:defaultClassPbisEnabled(normalizeClassGradeLevel(item.gradeLevel)),
        showAddStudent:item.showAddStudent!==false,
        pbisStats:normalizeClassPbisPreferences(item.pbisStats),
        studentProfiles:normalizeStudentProfiles(item.studentProfiles,students),
        seatingChart:normalizeSeatingChart(item.seatingChart,students),
        starChart:normalizeStarChartProgress(item.starChart,students),
        classMeter:normalizeClassMeterProgress(item.classMeter),
        collectionJar:normalizeCollectionProgress(item.collectionJar),
        punchcards:normalizePunchcardProgress(item.punchcards,students),
        eggHatching:normalizePunchcardProgress(item.eggHatching,students),
        flowerPots:normalizePunchcardProgress(item.flowerPots,students),
        racer:normalizeRacerProgress(item.racer,students)
      };
    });
  }catch{return []}
}

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
    window.dispatchEvent(new CustomEvent('teachertiles:classsavestatus',{detail:{scope,status:'saving'}}));
    return save(snapshot).then(()=>{
      window.dispatchEvent(new CustomEvent('teachertiles:classsavestatus',{detail:{scope,status:'saved'}}));
      lastEncryptedClassSaveSignatureByScope.set(scope,signature);
      clearPbisLocalDirty(signature,scope);
    });
  }).catch(error=>{console.error(`TeacherTiles could not save encrypted ${description}`,error);window.dispatchEvent(new CustomEvent('teachertiles:classsavestatus',{detail:{scope,status:'error'}}));}).finally(()=>{
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

function writeClassGrowth(classId,kind,value){
  if(!['eggHatching','flowerPots'].includes(kind))return null;
  const classes=readClassRosters(),roster=classes.find(item=>item.id===classId);if(!roster)return null;
  roster[kind]=normalizePunchcardProgress(value,roster.students);
  markPbisLocalDirty(classes);localStorage.setItem(classRostersStorageKey(),JSON.stringify(classes));
  window.dispatchEvent(new CustomEvent('teachertiles:classeschange',{detail:{classes}}));schedulePbisCloudSave();return roster[kind];
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

function classRosterId(){
  return typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():`class-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
}

function attachClassRosterLoader(anchor,onLoad){
  if(!anchor||typeof onLoad!=='function')return()=>{};
  const row=document.createElement('div');
  row.className='tile-class-loader class-roster-picker';
  const module=anchor.closest('.module');
  const pbisTypes=['starchart','classmeter','collections','prizeboard','pbisconsole','punchcards','racer','egghatching','flowerpots'];
  if(module&&pbisTypes.includes(module.dataset.type)){
    module.classList.add('pbis-tile');
    if(!module.classList.contains('growth-module'))movePbisClassActionsToFooter(module);
  }
  const intro=anchor.parentElement;
  if([...intro.classList].some(name=>name.endsWith('-import'))){
    intro.classList.add('class-roster-intro');
    let mark=intro.querySelector('[class$="import__mark"]');
    if(!mark){mark=document.createElement('div');intro.prepend(mark)}
    mark.classList.add('class-roster-intro__icon');mark.setAttribute('aria-hidden','true');
    const icon=document.querySelector(`#context-menu [data-module="${CSS.escape(module?.dataset.type||'')}"] .context-menu__icon svg`);
    if(icon)mark.replaceChildren(icon.cloneNode(true));
    const title=intro.querySelector(':scope>strong');if(title)title.textContent='Load a Class';
  }
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

function fitNameModuleToRoster(module,count,{namesPerRow=5,rowHeight=31,threshold=10}={}){
  if(!module)return;
  if(!module.dataset.rosterBaseHeight)module.dataset.rosterBaseHeight=String(Math.max(module.offsetHeight,Number.parseFloat(getComputedStyle(module).height)||0));
  const base=Number(module.dataset.rosterBaseHeight)||module.offsetHeight;
  const extraRows=Math.max(0,Math.ceil((Math.max(0,count)-threshold)/namesPerRow));
  const desired=Math.min(Math.max(base,base+extraRows*rowHeight),Math.max(base,BOARD_HEIGHT-module.offsetTop));
  module.style.height=`${desired}px`;
}

function bindStudentPointerDrag(chip,name,module,onDrop,{ghostClass='',skinId=''}={}){
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
      ghost=document.createElement('div');ghost.className=`student-drag-ghost${ghostClass?` ${ghostClass}`:''}`;
      if(skinId)ghost.dataset.tileSkin=skinId;
      const art=chip.querySelector('.attendance-student-art')?.cloneNode(true);
      const label=document.createElement('span');label.textContent=name;
      if(art)ghost.append(art,label);else ghost.textContent=name;
      document.body.appendChild(ghost);
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
      if(target&&module.contains(target))onDrop(target.dataset.studentDropTarget||'',{
        clientX:event.clientX,
        clientY:event.clientY,
        target
      });
    }
    cleanup();
  };
  chip.addEventListener('pointerup',finish);
  chip.addEventListener('pointercancel',cleanup);
}

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


function normalizeClassPbisPreferences(value){
  const saved=value&&typeof value==='object'?value:readStudentViewStatPreferences();
  return Object.fromEntries(PBIS_STUDENT_STAT_DEFINITIONS.map(stat=>[stat.id,saved[stat.id]!==false]));
}
const STUDENT_PROFILE_IMAGE_MAX_LENGTH=48000;
function normalizeProfileImage(image){
  return typeof image==='string'&&image.length<=STUDENT_PROFILE_IMAGE_MAX_LENGTH&&/^data:image\/(?:webp|png|jpeg);base64,[a-zA-Z0-9+/=]+$/.test(image)?image:'';
}
function normalizeStudentProfiles(value,students){
  const source=value&&typeof value==='object'?value:{};
  return Object.fromEntries(students.map(name=>{
    const key=starChartStudentKey(name),profile=source[key]||{};
    const image=normalizeProfileImage(profile.image);
    return [key,{emoji:profile.emoji?normalizeClassLogo(profile.emoji):'',image}];
  }));
}
// Student names remain compatible with board tiles; carry every reward map along when renamed.
function renameClassStudent(roster,oldName,newName){
  const oldKey=starChartStudentKey(oldName),newKey=starChartStudentKey(newName);
  for(const [kind,fields] of [['starChart',['studentStars']],['punchcards',['studentPoints','studentProgress']],['eggHatching',['studentPoints','studentProgress']],['flowerPots',['studentPoints','studentProgress']],['racer',['positions','studentWins','finished']]]){
    for(const field of fields){const values=roster[kind]?.[field];if(values&&oldKey!==newKey){if(Object.hasOwn(values,oldKey))values[newKey]=values[oldKey];delete values[oldKey];}}
  }
  if(oldKey!==newKey){roster.studentProfiles[newKey]=roster.studentProfiles[oldKey]||{};delete roster.studentProfiles[oldKey];}
  roster.students=roster.students.map(name=>name===oldName?newName:name);
}
