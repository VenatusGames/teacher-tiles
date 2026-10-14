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
    winName.textContent=name;winTotal.textContent=String(total);win.hidden=false;launchConfetti(m);playUiSfx('confetti',1,m);requestAnimationFrame(()=>winDone.focus({preventScroll:true}));
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
  const ro=new ResizeObserver(renderTrack);ro.observe(stage);
  m._boardGetState=()=>({activeClassId,selectedStudent});
  m._boardSetState=state=>{selectedStudent=String(state?.selectedStudent||'');setClass(String(state?.activeClassId||''))};
  const prior=m._cleanup;m._cleanup=()=>{prior?.();detach();ro.disconnect();['teachertiles:classeschange','teachertiles:racerchange'].forEach(name=>window.removeEventListener(name,refresh))};
  render();
}
