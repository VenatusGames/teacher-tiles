function setupAttendance(m){
  const loaderAnchor=m.querySelector('.attendance-loader-anchor');
  const classNameNode=m.querySelector('.attendance-class-name');
  const classLogoNode=m.querySelector('.attendance-class-logo');
  const summaryValue=m.querySelector('.attendance-summary strong');
  const summaryLabel=m.querySelector('.attendance-summary span');
  const resetButton=m.querySelector('.attendance-reset');
  const emptyState=m.querySelector('.attendance-empty-state');
  const statusNode=m.querySelector('.attendance-status');
  const worldImage=m.querySelector('.attendance-world__main');
  const jungleLeaves=m.querySelector('.attendance-jungle-leaves');
  const stages=Object.fromEntries([...m.querySelectorAll('[data-attendance-stage]')].map(stage=>[stage.dataset.attendanceStage,stage]));
  const counts=Object.fromEntries([...m.querySelectorAll('[data-attendance-count]')].map(count=>[count.dataset.attendanceCount,count]));
  const orderedStatuses=['default','present'];
  const skinArt={
    'attendance-beehive':'assets/attendance/bee.png',
    'attendance-monkeys':'assets/attendance/monkey.png',
    'attendance-froggies':'assets/attendance/froggie.png',
    'attendance-bubble-tea':'assets/attendance/boba.png'
  };
  const sceneArt={
    'attendance-beehive':'assets/attendance/scene-hive.png',
    'attendance-monkeys':'assets/attendance/scene-tree.png',
    'attendance-froggies':'assets/attendance/scene-lily-pads.png',
    'attendance-bubble-tea':'assets/attendance/scene-boba-cup.png'
  };
  let activeClassId='';
  let pendingClassId='';
  let activeClassName='';
  let activeClassLogo='👥';
  let students=[];
  let assignments=Object.create(null);
  let positions=Object.create(null);
  let arrivingStudent='';

  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const normalizeStatus=value=>value==='present'?'present':'default';
  const normalizeAssignments=(value,names)=>{
    const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
    const next=Object.create(null);
    names.forEach(name=>next[name]=normalizeStatus(source[name]));
    return next;
  };
  const normalizePositions=(value,names,nextAssignments)=>{
    const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
    const next=Object.create(null);
    names.forEach(name=>{
      const saved=source[name];
      if(!saved||!Number.isFinite(Number(saved.x))||!Number.isFinite(Number(saved.y)))return;
      next[name]={
        zone:normalizeStatus(saved.zone||saved.status||nextAssignments[name]),
        x:clamp(Number(saved.x),.18,.82),
        y:clamp(Number(saved.y),.14,.86)
      };
      if(next[name].zone!==nextAssignments[name])next[name].zone=nextAssignments[name];
    });
    return next;
  };
  const magnetFootprint=()=>{
    const sizes={
      'attendance-beehive':[108,83],
      'attendance-monkeys':[82,108],
      'attendance-froggies':[100,88],
      'attendance-bubble-tea':[64,64]
    };
    const density=students.length>24?.78:students.length>12?.9:1;
    return(sizes[m.dataset.tileSkin||'']||[126,48]).map(value=>value*density);
  };
  const placementRange=(status,insetX,insetY)=>{
    const sceneBounds=status==='present'&&m.dataset.tileSkin==='attendance-bubble-tea'
      ?{minX:.18,maxX:.82,minY:.4,maxY:.86}
      :{minX:0,maxX:1,minY:0,maxY:1};
    let minX=Math.max(insetX,sceneBounds.minX);
    let maxX=Math.min(1-insetX,sceneBounds.maxX);
    let minY=Math.max(insetY,sceneBounds.minY);
    let maxY=Math.min(1-insetY,sceneBounds.maxY);
    if(minX>maxX)minX=maxX=.5;
    if(minY>maxY)minY=maxY=.5;
    return{minX,maxX,minY,maxY};
  };
  const gridPosition=(index,total,status='default')=>{
    const stage=stages[status];
    const stageWidth=stage?.clientWidth||400;
    const stageHeight=stage?.clientHeight||340;
    const [pieceWidth,pieceHeight]=magnetFootprint();
    const insetX=clamp((pieceWidth/2+7)/stageWidth,.16,.3);
    const insetY=clamp((pieceHeight/2+7)/stageHeight,.14,.32);
    const range=placementRange(status,insetX,insetY);
    const preferred=total<=8?3:total<=16?4:total<=25?5:6;
    const fits=Math.max(1,Math.floor((stageWidth*(range.maxX-range.minX))/Math.max(44,pieceWidth*.9))+1);
    const columns=Math.max(1,Math.min(total||1,preferred,fits));
    const rows=Math.max(1,Math.ceil(total/columns));
    const column=index%columns;
    const row=Math.floor(index/columns);
    return{
      x:columns===1?(range.minX+range.maxX)/2:range.minX+(column/(columns-1))*(range.maxX-range.minX),
      y:rows===1?(range.minY+range.maxY)/2:range.minY+(row/(rows-1))*(range.maxY-range.minY)
    };
  };
  const ensurePositions=grouped=>{
    orderedStatuses.forEach(status=>grouped[status].forEach((name,index)=>{
      const saved=positions[name];
      if(saved&&saved.zone===status)return;
      positions[name]={zone:status,...gridPosition(index,grouped[status].length,status)};
    }));
  };
  const currentRoster=id=>readClassRosters().find(item=>item.id===id)||null;
  const setRoster=(roster,{reset=false,notify=true}={})=>{
    if(!roster)return false;
    const nextStudents=normalizeRosterNames(roster.students);
    const priorAssignments=assignments;
    const priorPositions=positions;
    activeClassId=String(roster.id||'');
    pendingClassId='';
    activeClassName=String(roster.name||'Class').trim()||'Class';
    activeClassLogo=normalizeClassLogo(roster.logo);
    students=nextStudents;
    assignments=reset?normalizeAssignments({},students):normalizeAssignments(priorAssignments,students);
    positions=reset?Object.create(null):normalizePositions(priorPositions,students,assignments);
    render();
    if(notify)notifyBoardChanged('attendance-class');
    return true;
  };
  const openPosition=(name,status)=>{
    const peers=students.filter(student=>student!==name&&normalizeStatus(assignments[student])===status);
    return{zone:status,...gridPosition(peers.length,peers.length+1,status)};
  };
  const positionFromDrop=(name,status,detail)=>{
    const stage=stages[status];
    if(!stage||!detail||!Number.isFinite(detail.clientX)||!Number.isFinite(detail.clientY))return openPosition(name,status);
    const rect=stage.getBoundingClientRect();
    if(!rect.width||!rect.height)return openPosition(name,status);
    const chip=[...m.querySelectorAll('.attendance-student')].find(item=>item.dataset.studentName===name);
    const chipRect=chip?.getBoundingClientRect();
    const insetX=clamp(((chipRect?.width||72)/2+5)/rect.width,.09,.3);
    const insetY=clamp(((chipRect?.height||55)/2+5)/rect.height,.1,.32);
    const range=placementRange(status,insetX,insetY);
    const baseX=clamp((detail.clientX-rect.left)/rect.width,range.minX,range.maxX);
    const baseY=clamp((detail.clientY-rect.top)/rect.height,range.minY,range.maxY);
    const peers=students.filter(student=>student!==name&&normalizeStatus(assignments[student])===status).map(student=>positions[student]).filter(Boolean);
    const minDistance=m.dataset.attendanceDensity==='dense'?48:m.dataset.attendanceDensity==='compact'?58:68;
    for(let attempt=0;attempt<42;attempt++){
      const ring=Math.ceil(attempt/6);
      const angle=attempt*2.399963;
      const radius=ring*15;
      const x=clamp(baseX+(Math.cos(angle)*radius)/rect.width,range.minX,range.maxX);
      const y=clamp(baseY+(Math.sin(angle)*radius)/rect.height,range.minY,range.maxY);
      const collides=peers.some(peer=>Math.hypot((peer.x-x)*rect.width,(peer.y-y)*rect.height)<minDistance);
      if(!collides)return{zone:status,x,y};
    }
    return{zone:status,x:baseX,y:baseY};
  };
  const place=(name,status,detail)=>{
    if(!students.includes(name))return;
    const next=normalizeStatus(status);
    const changedColumn=assignments[name]!==next;
    const nextPosition=positionFromDrop(name,next,detail);
    const prior=positions[name];
    if(!changedColumn&&prior&&Math.abs(prior.x-nextPosition.x)<.001&&Math.abs(prior.y-nextPosition.y)<.001)return;
    assignments[name]=next;
    positions[name]=nextPosition;
    const hasDropPoint=detail&&Number.isFinite(detail.clientX)&&Number.isFinite(detail.clientY);
    if(changedColumn&&!hasDropPoint){
      orderedStatuses.forEach(zone=>{
        const group=students.filter(student=>normalizeStatus(assignments[student])===zone);
        group.forEach((student,index)=>positions[student]={zone,...gridPosition(index,group.length,zone)});
      });
    }
    arrivingStudent=changedColumn?name:'';
    render();
    arrivingStudent='';
    notifyBoardChanged(changedColumn?'attendance-status':'attendance-position');
  };
  const makeStudent=(name,status)=>{
    const chip=document.createElement('div');
    chip.className=`attendance-student${arrivingStudent===name?' is-arriving':''}`;
    chip.dataset.studentName=name;
    chip.tabIndex=0;
    chip.setAttribute('role','button');
    chip.setAttribute('aria-label',`${name}: ${status==='present'?'present':'not checked in'}. Drag anywhere in either side, or use the left and right arrow keys.`);
    chip.setAttribute('aria-keyshortcuts','ArrowLeft ArrowRight D P');
    chip.title='Drag this magnet anywhere · D default · P present';
    const art=document.createElement('span');art.className='attendance-student-art';art.setAttribute('aria-hidden','true');
    const asset=skinArt[m.dataset.tileSkin||''];
    if(asset){
      const image=document.createElement('img');image.src=asset;image.alt='';image.draggable=false;art.appendChild(image);
    }else art.innerHTML='<i></i><b></b>';
    const label=document.createElement('span');label.className='attendance-student-name';label.textContent=name;
    chip.append(art,label);
    const position=positions[name]||{x:.5,y:.5};
    chip.style.left=`${position.x*100}%`;
    chip.style.top=`${position.y*100}%`;
    const tilt=[...name].reduce((total,letter)=>total+letter.codePointAt(0),0)%7-3;
    chip.style.setProperty('--attendance-tilt',`${tilt}deg`);
    chip.addEventListener('keydown',event=>{
      let next='';
      if(event.key==='ArrowLeft'||event.key.toLocaleLowerCase()==='d')next='default';
      else if(event.key==='ArrowRight')next='present';
      else if(event.key.toLocaleLowerCase()==='p')next='present';
      else if(event.key==='Enter')next=status==='default'?'present':'default';
      if(!next||next===status)return;
      event.preventDefault();event.stopPropagation();place(name,next);
      requestAnimationFrame(()=>[...m.querySelectorAll('.attendance-student')].find(item=>item.dataset.studentName===name)?.focus({preventScroll:true}));
    });
    bindStudentPointerDrag(chip,name,m,(target,detail)=>place(name,target,detail),{ghostClass:'attendance-student-ghost',skinId:m.dataset.tileSkin||''});
    return chip;
  };
  function render(){
    const grouped={default:[],present:[]};
    students.forEach(name=>grouped[normalizeStatus(assignments[name])].push(name));
    ensurePositions(grouped);
    m.dataset.attendanceDensity=students.length>24?'dense':students.length>12?'compact':'comfortable';
    orderedStatuses.forEach(status=>{
      const stage=stages[status];if(!stage)return;
      stage.replaceChildren();
      grouped[status].forEach(name=>stage.appendChild(makeStudent(name,status)));
      if(!grouped[status].length){
        const hint=document.createElement('span');hint.className='attendance-stage-empty';
        hint.textContent=status==='present'?'Drop students anywhere here':students.length?'Every student is present':'No students in this class';
        stage.appendChild(hint);
      }
      if(counts[status])counts[status].textContent=String(grouped[status].length);
    });
    const hasClass=Boolean(activeClassId||students.length);
    m.classList.toggle('has-attendance-class',hasClass);
    m.dataset.attendanceReady=String(hasClass);
    classNameNode.textContent=hasClass?activeClassName:'No class loaded';
    classLogoNode.textContent=hasClass?activeClassLogo:'👥';
    summaryValue.textContent=`${grouped.present.length}/${students.length}`;
    summaryLabel.textContent='present';
    emptyState.hidden=hasClass;
    resetButton.hidden=!hasClass;
    resetButton.disabled=!students.length;
    statusNode.textContent=!hasClass?'Choose a saved class above to begin.':!students.length?'This class does not have any students yet.':grouped.present.length===students.length?`Check-in complete · all ${students.length} students present`:`${grouped.default.length} not checked in · ${grouped.present.length} present`;
  }

  resetButton.addEventListener('click',()=>{
    assignments=normalizeAssignments({},students);
    positions=Object.create(null);
    render();
    notifyBoardChanged('attendance-reset');
  });
  m.querySelector('.attendance-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.attendance-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.attendance-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));

  const sceneSource=sceneArt[m.dataset.tileSkin||'']||'';
  if(worldImage){worldImage.src=sceneSource;worldImage.hidden=!sceneSource}
  if(jungleLeaves){
    jungleLeaves.replaceChildren();
    if(m.dataset.tileSkin==='attendance-monkeys'){
      const leafSources=['assets/attendance/jungle-leaf.png','assets/attendance/jungle-leaf-cluster.png'];
      for(let index=0;index<14;index++){
        const leaf=document.createElement('img');
        leaf.src=leafSources[index%leafSources.length];
        leaf.alt='';
        leaf.draggable=false;
        leaf.style.setProperty('--jungle-leaf-x',`${-15+Math.random()*105}%`);
        leaf.style.setProperty('--jungle-leaf-y',`${-12+Math.random()*93}%`);
        leaf.style.setProperty('--jungle-leaf-size',`${20+Math.random()*28}%`);
        leaf.style.setProperty('--jungle-leaf-turn',`${-44+Math.random()*88}deg`);
        leaf.style.setProperty('--jungle-leaf-scale',`${.72+Math.random()*.56}`);
        leaf.style.setProperty('--jungle-leaf-opacity',`${.36+Math.random()*.32}`);
        jungleLeaves.appendChild(leaf);
      }
    }
  }
  let resizeFrame=0;
  const keepMagnetsVisible=()=>{
    cancelAnimationFrame(resizeFrame);
    resizeFrame=requestAnimationFrame(()=>{
      orderedStatuses.forEach(status=>{
        const stage=stages[status];
        const stageRect=stage?.getBoundingClientRect();
        if(!stageRect?.width||!stageRect.height)return;
        stage.querySelectorAll('.attendance-student').forEach(chip=>{
          const name=chip.dataset.studentName;
          const position=positions[name];
          if(!position)return;
          const chipRect=chip.getBoundingClientRect();
          const insetX=clamp((chipRect.width/2+5)/stageRect.width,.09,.3);
          const insetY=clamp((chipRect.height/2+5)/stageRect.height,.1,.32);
          const range=placementRange(status,insetX,insetY);
          position.x=clamp(position.x,range.minX,range.maxX);
          position.y=clamp(position.y,range.minY,range.maxY);
          chip.style.left=`${position.x*100}%`;
          chip.style.top=`${position.y*100}%`;
        });
      });
    });
  };
  const magnetResizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(keepMagnetsVisible):null;
  magnetResizeObserver?.observe(m);

  const detachRosterLoader=attachClassRosterLoader(loaderAnchor,(_names,roster)=>setRoster(roster,{reset:true}));
  const handleClassesChange=()=>{
    const wanted=pendingClassId||activeClassId;
    if(!wanted)return;
    const roster=currentRoster(wanted);
    if(roster)setRoster(roster,{reset:false,notify:false});
  };
  window.addEventListener('teachertiles:classeschange',handleClassesChange);

  m._boardGetState=()=>({
    classId:activeClassId,
    className:activeClassName,
    classLogo:activeClassLogo,
    students:[...students],
    assignments:{...assignments},
    positions:Object.fromEntries(students.map(name=>{
      const position=positions[name]||{zone:normalizeStatus(assignments[name]),x:.5,y:.5};
      return[name,{zone:normalizeStatus(position.zone),x:Number(position.x.toFixed(4)),y:Number(position.y.toFixed(4))}];
    }))
  });
  m._boardSetState=state=>{
    if(!state)return;
    const classId=String(state.classId||'');
    const savedStudents=normalizeRosterNames(state.students);
    const roster=classId?currentRoster(classId):null;
    if(roster){
      setRoster(roster,{reset:true,notify:false});
      assignments=normalizeAssignments(state.assignments,students);
      positions=normalizePositions(state.positions,students,assignments);
    }else{
      activeClassId=classId;
      pendingClassId=classId;
      activeClassName=String(state.className||'Saved Class').trim()||'Saved Class';
      activeClassLogo=normalizeClassLogo(state.classLogo);
      students=savedStudents;
      assignments=normalizeAssignments(state.assignments,students);
      positions=normalizePositions(state.positions,students,assignments);
    }
    render();
  };
  render();
  const priorCleanup=m._cleanup;
  m._cleanup=()=>{priorCleanup?.();detachRosterLoader();magnetResizeObserver?.disconnect();cancelAnimationFrame(resizeFrame);window.removeEventListener('teachertiles:classeschange',handleClassesChange)};
}
