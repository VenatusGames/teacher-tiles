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
