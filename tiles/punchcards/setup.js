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
    playUiSfx('hole-punch',1,m);
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
  m.querySelector('.punchcard-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));
  const refresh=()=>{if(activeClassId&&!roster())setClass('');else render()};
  ['teachertiles:classeschange','teachertiles:punchcardchange'].forEach(name=>window.addEventListener(name,refresh));
  m._boardGetState=()=>({activeClassId,scope,student});
  m._boardSetState=state=>{scope=state?.scope==='class'?'class':'student';student=String(state?.student||'');setClass(String(state?.activeClassId||''))};
  const prior=m._cleanup;m._cleanup=()=>{prior?.();detach();['teachertiles:classeschange','teachertiles:punchcardchange'].forEach(name=>window.removeEventListener(name,refresh))};
  render();
}
