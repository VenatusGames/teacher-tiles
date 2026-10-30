function setupRacer(m){
  const importView=m.querySelector('.racer-import'),dashboard=m.querySelector('.racer-dashboard'),loaderAnchor=m.querySelector('.racer-loader-anchor');
  const className=m.querySelector('.racer-class-name'),classLogo=m.querySelector('.racer-class-logo'),changeClass=m.querySelector('.racer-change-class');
  const racers=m.querySelector('.racer-standees'),studentSelect=m.querySelector('.racer-student'),distanceInput=m.querySelector('.racer-distance'),moveButton=m.querySelector('.racer-move'),reset=m.querySelector('.racer-reset');
  const status=m.querySelector('.racer-status'),win=m.querySelector('.racer-win'),winName=m.querySelector('.racer-win-name'),winTotal=m.querySelector('.racer-win-total'),winDone=m.querySelector('.racer-win-done');
  movePbisClassHeaderToFooter(m,'.racer-header');
  let activeClassId='',selectedStudent='';
  const roster=()=>readClassRosters().find(item=>item.id===activeClassId)||null;
  const progress=()=>{const r=roster();return normalizeRacerProgress(r?.racer,r?.students||[])};
  const keyFor=name=>starChartStudentKey(name);
  const updateStatus=()=>{
    const r=roster();if(!r){status.textContent='';return}
    const p=progress(),finishers=r.students.filter(name=>p.finished[keyFor(name)]).length;
    status.textContent=selectedStudent?`${selectedStudent} · ${Math.round(p.positions[keyFor(selectedStudent)]||0)}% · ${p.studentWins[keyFor(selectedStudent)]||0} race wins`:finishers?`${finishers} ${finishers===1?'finisher':'finishers'} • Race continues until you reset`:'Move a student forward to begin the race';
  };
  const renderSelection=()=>{
    const r=roster();if(!r)return;
    const p=progress(),key=keyFor(selectedStudent),done=Boolean(p.finished[key]);
    racers.querySelectorAll('.racer-standee').forEach(node=>{const selected=node.dataset.student===selectedStudent;node.classList.toggle('is-selected',selected);node.setAttribute('aria-pressed',String(selected))});
    updateStatus();
    moveButton.disabled=!selectedStudent||done;distanceInput.disabled=!selectedStudent||done;
    moveButton.textContent=done?'Finished':'Add Distance';
  };
  const renderTrack=()=>{
    const r=roster();if(!r)return;
    window.TeacherTilesRacerVisuals.render(racers,r,progress(),keyFor);
    renderSelection();
  };
  racers.addEventListener('click',event=>{
    const node=event.target.closest('.racer-standee');if(!node||!racers.contains(node))return;
    selectedStudent=node.dataset.student;studentSelect.value=selectedStudent;renderSelection();
    notifyBoardChanged('racer-student');
  });
  // Scrolling a large class must not pan or zoom the board behind the tile.
  m.querySelector('.racer-course-scroll').addEventListener('wheel',event=>event.stopPropagation(),{passive:true});
  const render=()=>{
    const r=roster();if(!r)return;
    className.textContent=r.name;classLogo.textContent=normalizeClassLogo(r.logo);
    const prior=selectedStudent;studentSelect.replaceChildren(new Option(r.students.length?'Choose a student…':'No students',''));
    r.students.forEach(name=>studentSelect.add(new Option(name,name)));
    selectedStudent=r.students.includes(prior)?prior:(r.students[0]||'');studentSelect.value=selectedStudent;
    renderTrack();
  };
  const showWin=(name,total)=>{
    winName.textContent=name;winTotal.textContent=String(total);win.hidden=false;launchConfetti(m);playUiSfx('tile-effect',1,m);requestAnimationFrame(()=>winDone.focus({preventScroll:true}));
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
  m.querySelector('.racer-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));
  const refresh=()=>{if(activeClassId&&!roster())setClass('');else render()};
  ['teachertiles:classeschange','teachertiles:racerchange'].forEach(name=>window.addEventListener(name,refresh));
  const ro=new ResizeObserver(()=>window.TeacherTilesRacerVisuals.layout(racers));ro.observe(racers);
  m._boardGetState=()=>({activeClassId,selectedStudent});
  m._boardSetState=state=>{selectedStudent=String(state?.selectedStudent||'');setClass(String(state?.activeClassId||''))};
  const prior=m._cleanup;m._cleanup=()=>{prior?.();detach();ro.disconnect();['teachertiles:classeschange','teachertiles:racerchange'].forEach(name=>window.removeEventListener(name,refresh))};
  render();
}
