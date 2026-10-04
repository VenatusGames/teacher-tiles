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
    if(stat.id==='eggPoints'||stat.id==='flowerPoints'){
      const kind=stat.id==='eggPoints'?'eggHatching':'flowerPots',progress=normalizePunchcardProgress(roster[kind],roster.students);progress.studentPoints[starChartStudentKey(name)]=0;writeClassGrowth(roster.id,kind,progress);
    }else if(stat.id==='stars'){
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
    if(!compact){const heading=document.createElement('h5');heading.className='student-profile-rewards-heading';heading.textContent='PBIS Rewards';container.append(heading);}
    const stats=enabledStats({wholeClass});
    if(!stats.length){
      const empty=document.createElement(compact?'span':'p');
      empty.className=compact?'student-view-stat-summary--empty':'student-profile-stats-empty';
      empty.textContent=compact?'Stats hidden':'No PBIS stats are currently enabled for student profiles.';
      container.append(empty);return;
    }
    const valueFor=stat=>wholeClass?stat.wholeClassValue?.(roster)??0:stat.value(roster,name);
    if(compact){
      const total=stats.reduce((sum,stat)=>sum+valueFor(stat),0),summary=document.createElement('span');summary.className='student-view-reward-total';summary.textContent=total+' PBIS Rewards';summary.title=stats.map(stat=>stat.label+': '+valueFor(stat)).join(' · ');container.append(summary);return;
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
  document.getElementById('student-view-settings-close')?.addEventListener('click',()=>{setStatMenuOpen(false);statMenuToggle.focus()});
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
