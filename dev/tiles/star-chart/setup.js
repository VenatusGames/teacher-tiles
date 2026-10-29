function setupStarChart(m){
  const importView=m.querySelector('.starchart-import');
  const dashboard=m.querySelector('.starchart-dashboard');
  const className=m.querySelector('.starchart-class-name');
  const wholeClassName=m.querySelector('.starchart-whole-class-name');
  const wholeClassLogo=m.querySelector('.starchart-whole-badge');
  const changeClass=m.querySelector('.starchart-change-class');
  const modeToggle=m.querySelector('.pbis-scope-toggle');
  const studentView=m.querySelector('.starchart-student-view');
  const wholeView=m.querySelector('.starchart-whole-view');
  const studentGrid=m.querySelector('.starchart-student-grid');
  const noStudents=m.querySelector('.starchart-no-students');
  const wholeCount=m.querySelector('.starchart-whole-count b');
  const wholeBundles=m.querySelector('.starchart-whole-bundles');
  const wholeAdd=m.querySelector('.starchart-whole-add');
  const wholeRemove=m.querySelector('.starchart-whole-remove');
  const showAllButton=m.querySelector('.starchart-show-all');
  const search=document.createElement('input');search.type='search';search.className='starchart-search';search.placeholder='Find a student';search.setAttribute('aria-label','Find a student');
  m.querySelector('.starchart-student-toolbar').prepend(search);
  const filterStudents=()=>{
    const query=search.value.trim().toLocaleLowerCase();let visible=0;
    studentGrid.querySelectorAll('.starchart-student-row').forEach(row=>{row.hidden=!row.querySelector('strong').textContent.toLocaleLowerCase().includes(query);if(!row.hidden)visible++});
    noStudents.hidden=visible>0;
    noStudents.textContent=roster?.students?.length?'No students match your search.':'Add students in Class View to begin awarding stars.';
    if(showAllStudents)scheduleShowAllSize();
  };
  search.addEventListener('input',filterStudents);
  let activeClassId='';
  let pendingClassId='';
  let roster=null;
  let progress=normalizeStarChartProgress(null,[]);
  let showAllStudents=false;
  let collapsedHeight=Math.max(380,m.offsetHeight||560);
  let collapsedWidth=Math.max(380,m.offsetWidth||700);
  let showAllFrame=0;
  const flyingStars=new Set();
  const awardFrames=new Set();
  const bundleLevels=[
    {weight:1000,level:3,label:'1K'},
    {weight:100,level:2,label:'100'},
    {weight:10,level:1,label:'10'},
    {weight:1,level:0,label:'1'}
  ];

  const currentRoster=()=>readClassRosters().find(item=>item.id===activeClassId)||null;

  const syncShowAllSize=()=>{
    showAllFrame=0;
    if(document.fullscreenElement===m)return;
    if(!showAllStudents||progress.mode!=='student'||studentView.hidden||studentGrid.hidden){
      if(showAllStudents){m.style.height=`${collapsedHeight}px`;m.style.width=`${collapsedWidth}px`;}
      return;
    }
    // Three readable columns, with enough height for every row and the hover controls.
    m.style.width=`${Math.max(1000,collapsedWidth)}px`;
    m.style.height=`${collapsedHeight}px`;
    const overhead=m.offsetHeight-studentGrid.clientHeight;
    // Measure the rows themselves, not scrollHeight (which includes unused viewport space).
    const oldFlex=studentGrid.style.flex,oldHeight=studentGrid.style.height;
    studentGrid.style.flex='none';studentGrid.style.height='max-content';
    const contentHeight=studentGrid.offsetHeight;
    studentGrid.style.flex=oldFlex;studentGrid.style.height=oldHeight;
    m.style.height=`${Math.min(BOARD_HEIGHT,Math.max(220,Math.ceil(overhead+contentHeight+2)))}px`;
  };

  const scheduleShowAllSize=()=>{
    if(showAllFrame)cancelAnimationFrame(showAllFrame);
    showAllFrame=requestAnimationFrame(syncShowAllSize);
  };

  const setShowAllStudents=(show,{notify=false,captureHeight=true}={})=>{
    const next=Boolean(show);
    if(next&&!showAllStudents&&captureHeight){collapsedHeight=Math.max(380,m.offsetHeight||collapsedHeight);collapsedWidth=Math.max(380,m.offsetWidth||collapsedWidth);}
    showAllStudents=next;
    m.classList.toggle('is-showing-all-students',showAllStudents);
    showAllButton.setAttribute('aria-pressed',String(showAllStudents));
    if(showAllStudents)scheduleShowAllSize();
    else{
      if(showAllFrame)cancelAnimationFrame(showAllFrame);
      showAllFrame=0;
      if(document.fullscreenElement!==m){m.style.height=`${collapsedHeight}px`;m.style.width=`${collapsedWidth}px`;}
    }
    if(notify)notifyBoardChanged('star-chart-show-all');
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

  const animateStarAward=(sourceRect,studentKey)=>{
    if(!sourceRect||!landingTargetFor(studentKey)||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const star=document.createElement('span');star.className='starchart-flying-star';star.textContent='★';star.setAttribute('aria-hidden','true');
    const startX=sourceRect.left+sourceRect.width*.65,startY=sourceRect.top+sourceRect.height*.5;
    (document.fullscreenElement===m?m:document.body).append(star);flyingStars.add(star);
    const flight={frame:0},started=performance.now();awardFrames.add(flight);
    const finish=()=>{awardFrames.delete(flight);flyingStars.delete(star);star.remove()};
    const tick=now=>{
      // Resolve the live destination every frame: hover shelves and roster updates can move it.
      const target=landingTargetFor(studentKey);if(!target?.isConnected){finish();return;}
      const rect=target.getBoundingClientRect(),p=Math.min(1,(now-started)/620),t=p*p*(3-2*p);
      const endX=rect.left+rect.width/2,endY=rect.top+rect.height/2;
      const controlY=Math.min(startY,endY)-Math.min(44,Math.abs(endX-startX)*.22+20);
      const x=startX+(endX-startX)*t,y=(1-t)*(1-t)*startY+2*(1-t)*t*controlY+t*t*endY;
      star.style.left=`${x}px`;star.style.top=`${y}px`;
      star.style.opacity=String(Math.min(1,p/.12)*(1-Math.max(0,(p-.86)/.14)));
      star.style.transform=`translate(-50%,-50%) scale(${.7+Math.sin(p*Math.PI)*.4}) rotate(${-18+36*t}deg)`;
      if(p<1){flight.frame=requestAnimationFrame(tick);return;}
      target.animate([{transform:'scale(1)',filter:'brightness(1)'},{transform:'scale(1.18)',filter:'brightness(1.18)',offset:.35},{transform:'scale(1)',filter:'brightness(1)'}],{duration:360,easing:'cubic-bezier(.2,.7,.3,1)'});
      finish();
    };
    flight.frame=requestAnimationFrame(tick);
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
    const focused=document.activeElement;
    const focusedKey=studentGrid.contains(focused)?focused.closest('[data-student-key]')?.dataset.studentKey:null;
    const focusedAction=focused?.dataset.starAction;
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
      const avatar=document.createElement('span');avatar.className='starchart-student-avatar';avatar.setAttribute('aria-hidden','true');
      const profile=roster.studentProfiles?.[key],visual=studentProfileVisual(name,roster.id);
      avatar.style.setProperty('--avatar-hue',visual.hue);
      if(profile?.image){const image=document.createElement('img');image.src=profile.image;image.alt='';image.decoding='async';avatar.append(image);}
      else avatar.textContent=profile?.emoji||visual.initials;
      exact.className='starchart-student-total';
      nameButton.append(avatar,label);

      const starStage=document.createElement('div');starStage.className='starchart-star-stage';starStage.setAttribute('aria-label',`${count} stars earned by ${name}`);
      renderStarBundles(starStage,count,name);

      const subtractToggle=document.createElement('button');
      subtractToggle.type='button';subtractToggle.className='starchart-subtract-toggle';subtractToggle.dataset.subtractToggle='';subtractToggle.disabled=count===0;subtractToggle.setAttribute('aria-expanded','false');subtractToggle.setAttribute('aria-label',`Subtract multiple stars from ${name}`);
      subtractToggle.title='Remove Stars';
      subtractToggle.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>';
      const stars=document.createElement('div');stars.className='starchart-student-stars';stars.append(starStage,exact);
      main.append(nameButton,stars,subtractToggle);

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
      if(focusedKey===key&&focusedAction)row.querySelector(`[data-star-action="${focusedAction}"]`)?.focus({preventScroll:true});
    });
    filterStudents();
  };

  const render=()=>{
    const hasClass=Boolean(roster&&activeClassId);
    importView.hidden=hasClass;
    dashboard.hidden=!hasClass;
    modeToggle.hidden=!hasClass;
    if(!hasClass)return;
    className.textContent=roster.name;
    wholeClassName.textContent=roster.name;
    wholeClassLogo.textContent=normalizeClassLogo(roster.logo);
    wholeCount.textContent=String(progress.wholeClassStars);
    wholeRemove.disabled=progress.wholeClassStars===0;
    renderStarBundles(wholeBundles,progress.wholeClassStars,roster.name);
    const mode=progress.mode==='whole'?'whole':'student';
    modeToggle.textContent=mode==='whole'?'Whole Class':'Student';
    modeToggle.setAttribute('aria-pressed',String(mode==='whole'));
    modeToggle.setAttribute('aria-label',mode==='whole'?'Whole Class mode: switch to Student':'Student mode: switch to Whole Class');
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
    if(activeClassId!==next.id)search.value='';
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

  modeToggle.addEventListener('click',()=>{
    progress.mode=progress.mode==='whole'?'student':'whole';
    persistProgress();
    notifyBoardChanged('star-chart-mode');
  });

  studentGrid.addEventListener('click',event=>{
    const target=event.target instanceof Element?event.target:null;
    const row=target?.closest('[data-student-key]');
    if(!row||!activeClassId)return;
    if(target.closest('[data-subtract-toggle],.starchart-subtract-panel'))return;
    const action=target.closest('[data-star-action]');
    const key=row.dataset.studentKey;
    const current=normalizeStarChartCount(progress.studentStars[key]);
    const adding=action?.dataset.starAction!=='remove';
    if(!adding&&!current)return;
    const source=adding?(action||row).getBoundingClientRect():null;
    progress.studentStars[key]=normalizeStarChartCount(current+(adding?1:-1));
    persistProgress();
    if(source)animateStarAward(source,key);
  });

  studentGrid.addEventListener('wheel',event=>{
    if(studentGrid.scrollHeight>studentGrid.clientHeight+1)event.stopPropagation();
  },{passive:true});
  showAllButton.addEventListener('click',()=>setShowAllStudents(!showAllStudents,{notify:true}));

  wholeAdd.addEventListener('click',()=>{
    const source=wholeAdd.getBoundingClientRect();
    progress.wholeClassStars=normalizeStarChartCount(progress.wholeClassStars+1);
    persistProgress();
    animateStarAward(source,'__whole__');
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
  m.querySelector('.starchart-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));

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

  m._boardGetState=()=>({classId:activeClassId,showAllStudents,collapsedHeight,collapsedWidth});
  m._boardSetState=state=>{
    if(Number.isFinite(Number(state?.collapsedHeight)))collapsedHeight=clamp(Number(state.collapsedHeight),380,BOARD_HEIGHT);
    if(Number.isFinite(Number(state?.collapsedWidth)))collapsedWidth=clamp(Number(state.collapsedWidth),380,BOARD_WIDTH);
    setShowAllStudents(Boolean(state?.showAllStudents),{captureHeight:false});
    const classId=String(state?.classId||'');
    if(!classId)return;
    if(!loadClass(classId))pendingClassId=classId;
  };
  const lastClassId=localStorage.getItem(starChartLastClassStorageKey())||'';
  if(!lastClassId||!loadClass(lastClassId))render();

  let lastWidth=m.clientWidth;
  const overviewResize=new ResizeObserver(()=>{const width=m.clientWidth;if(width===lastWidth)return;lastWidth=width;if(showAllStudents)scheduleShowAllSize();});
  overviewResize.observe(m);
  const fitAfterShelf=event=>{if(showAllStudents&&((event.target===m&&event.propertyName==='padding-bottom')||(event.target===m.querySelector('.starchart-student-toolbar')&&event.propertyName==='max-height')))scheduleShowAllSize()};
  const fitOnInteraction=()=>{if(showAllStudents)scheduleShowAllSize()};
  for(const type of ['pointerenter','pointerleave','focusin','focusout'])m.addEventListener(type,fitOnInteraction);
  m.addEventListener('transitionend',fitAfterShelf);
  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();detachRosterLoader();overviewResize.disconnect();
    awardFrames.forEach(flight=>cancelAnimationFrame(flight.frame));awardFrames.clear();
    m.removeEventListener('transitionend',fitAfterShelf);
    for(const type of ['pointerenter','pointerleave','focusin','focusout'])m.removeEventListener(type,fitOnInteraction);
    flyingStars.forEach(star=>star.remove());flyingStars.clear();
    if(showAllFrame)cancelAnimationFrame(showAllFrame);
    window.removeEventListener('teachertiles:classeschange',handleClassesChange);
    window.removeEventListener('teachertiles:starchartchange',handleStarChartChange);
  };
}
