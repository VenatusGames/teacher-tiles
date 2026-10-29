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
  const pendingAwards=new Map();
  const displayedCount=(key,total)=>Math.max(0,normalizeStarChartCount(total)-(pendingAwards.get(key)||0));
  const clearAwards=()=>{
    awardFrames.forEach(flight=>cancelAnimationFrame(flight.frame));awardFrames.clear();
    flyingStars.forEach(star=>star.remove());flyingStars.clear();pendingAwards.clear();
  };
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
    // Natural height follows the shelf and padding together, without a second resize on landing.
    m.style.width=`${Math.max(1000,collapsedWidth)}px`;
    m.style.height='auto';
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
    if(roster)renderStudentGrid();
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
      for(let index=0;index<quantity&&remaining>0;index++){
        const value=level.weight;
        remaining-=value;
        const token=document.createElement('span');
        token.className=`starchart-star-token starchart-star-token--level-${level.level}`;
        if(value>level.weight)token.classList.add('is-bundle');
        token.dataset.bundleValue=String(value);
        const represented=value===1?'1 star':`${value.toLocaleString()} stars`;
        token.setAttribute('role','img');token.setAttribute('aria-label',`${represented} for ${ownerLabel}`);
        token.title=`${represented}${value>1?' grouped together':''}`;
        const icon=document.createElement('span');icon.textContent='★';icon.setAttribute('aria-hidden','true');
        const badge=document.createElement('small');badge.textContent=value>=1000&&value%1000===0?`${value/1000}K`:value.toLocaleString();badge.setAttribute('aria-hidden','true');
        token.append(icon,badge);container.append(token);
      }
    });
  };

  const tokenCount=(total,whole=false)=>{
    let remaining=total,count=0;
    for(const level of bundleLevels){count+=Math.floor(remaining/level.weight);remaining%=level.weight;}
    return count;
  };
  const reserveLandingSlot=(container,count,key)=>{
    if(!pendingAwards.has(key)||tokenCount(count+1,key==='__whole__')<=tokenCount(count,key==='__whole__'))return;
    container.querySelector('.starchart-star-empty')?.remove();
    const slot=document.createElement('span');slot.className='starchart-star-token is-award-slot';slot.style.visibility='hidden';slot.setAttribute('aria-hidden','true');container.append(slot);
  };
  const landingTargetFor=(studentKey,includePending=true)=>{
    const container=studentKey==='__whole__'?wholeBundles:[...studentGrid.querySelectorAll('[data-student-key]')].find(row=>row.dataset.studentKey===studentKey)?.querySelector('.starchart-star-stage');
    if(!container)return null;
    const tokens=container.querySelectorAll('.starchart-star-token');
    const total=studentKey==='__whole__'?progress.wholeClassStars:progress.studentStars[studentKey];
    const next=displayedCount(studentKey,total)+(includePending&&pendingAwards.has(studentKey)?1:0);
    return tokens[Math.min(tokens.length,tokenCount(next,studentKey==='__whole__'))-1]||container;
  };

  const animateStarAward=(sourceRect,studentKey,complete)=>{
    if(!sourceRect||!landingTargetFor(studentKey)||matchMedia('(prefers-reduced-motion: reduce)').matches){complete();return;}
    const star=document.createElement('span');star.className='starchart-flying-star';star.textContent='★';star.setAttribute('aria-hidden','true');
    const startX=sourceRect.left+sourceRect.width*.65,startY=sourceRect.top+sourceRect.height*.5;
    (document.fullscreenElement===m?m:document.body).append(star);flyingStars.add(star);
    const flight={frame:0},started=performance.now();awardFrames.add(flight);
    const finish=()=>{awardFrames.delete(flight);flyingStars.delete(star);star.remove();complete()};
    const tick=now=>{
      // Resolve the live destination every frame: hover shelves and roster updates can move it.
      const target=landingTargetFor(studentKey);if(!target?.isConnected){finish();return;}
      const rect=target.getBoundingClientRect(),p=Math.min(1,(now-started)/620),t=p*p*(3-2*p);
      const endX=rect.left+rect.width/2,endY=rect.top+rect.height/2;
      const controlY=Math.min(startY,endY)-Math.min(44,Math.abs(endX-startX)*.22+20);
      const x=startX+(endX-startX)*t,y=(1-t)*(1-t)*startY+2*(1-t)*t*controlY+t*t*endY;
      star.style.left=`${x}px`;star.style.top=`${y}px`;
      star.style.opacity=String(Math.min(1,p/.12));
      star.style.transform=`translate(-50%,-50%) scale(${.7+Math.sin(p*Math.PI)*.4}) rotate(${-18+36*t}deg)`;
      if(p<1){flight.frame=requestAnimationFrame(tick);return;}
      finish();
      landingTargetFor(studentKey,false)?.animate([{transform:'scale(1)',filter:'brightness(1)'},{transform:'scale(1.18)',filter:'brightness(1.18)',offset:.35},{transform:'scale(1)',filter:'brightness(1)'}],{duration:360,easing:'cubic-bezier(.2,.7,.3,1)'});
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

  const fitOverviewStars=stage=>{
    if(!showAllStudents||!stage.isConnected)return;
    const width=stage.clientWidth,count=stage.querySelectorAll('.starchart-star-token').length;if(!width||!count)return;
    let bestSize=0,columns=5;
    for(let cols=5;cols<=Math.max(5,count);cols++){
      const rows=Math.ceil(count/cols),size=Math.min(40,(width-(cols-1)*2)/cols,(64-(rows-1)*2)/rows);
      if(size>bestSize){bestSize=size;columns=cols;}
    }
    stage.style.setProperty('--star-columns',String(columns));
    stage.style.setProperty('--overview-star-size',`${Math.max(1,Math.floor(bestSize*10)/10)}px`);
  };
  const starLayoutObserver=new ResizeObserver(entries=>entries.forEach(entry=>fitOverviewStars(entry.target)));
  const renderStudentGrid=()=>{
    starLayoutObserver.disconnect();
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
      const count=displayedCount(key,progress.studentStars[key]);
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
      reserveLandingSlot(starStage,count,key);

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
      const takeAway=document.createElement('button');takeAway.type='submit';takeAway.textContent='Take Away';
      const reset=document.createElement('button');reset.type='button';reset.className='starchart-subtract-reset';reset.textContent='Reset';reset.title='Reset stars to 0';reset.setAttribute('aria-label',`Reset stars for ${name} to zero`);
      reset.addEventListener('click',event=>{event.stopPropagation();if(!activeClassId)return;clearAwards();progress.studentStars[key]=0;persistProgress()});
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
        clearAwards();
        progress.studentStars[key]=normalizeStarChartCount(currentValue-Math.min(currentValue,requestedValue));
        persistProgress();
        if(showAllStudents)scheduleShowAllSize();
      });
      form.append(input,takeAway,reset,cancel);panel.append(prompt,form);
      row.append(main,panel);studentGrid.append(row);
      starLayoutObserver.observe(starStage);fitOverviewStars(starStage);
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
    wholeClassLogo.replaceChildren();
    wholeClassLogo.style.setProperty('--avatar-hue',String(studentProfileVisual(roster.name,roster.id).hue));
    if(roster.logoImage){const image=document.createElement('img');image.src=roster.logoImage;image.alt='';wholeClassLogo.append(image);}else wholeClassLogo.textContent=normalizeClassLogo(roster.logo);
    const shownWhole=displayedCount('__whole__',progress.wholeClassStars);
    wholeCount.textContent=String(shownWhole);
    wholeRemove.disabled=progress.wholeClassStars===0;
    renderStarBundles(wholeBundles,shownWhole,roster.name);
    reserveLandingSlot(wholeBundles,shownWhole,'__whole__');
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
      clearAwards();activeClassId='';roster=null;progress=normalizeStarChartProgress(null,[]);render();return false;
    }
    if(activeClassId!==next.id){clearAwards();search.value='';}
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

  const awardStar=(key,source)=>{
    const whole=key==='__whole__',current=normalizeStarChartCount(whole?progress.wholeClassStars:progress.studentStars[key]),next=normalizeStarChartCount(current+1);
    if(!activeClassId||next===current)return;
    const classId=activeClassId;
    pendingAwards.set(key,(pendingAwards.get(key)||0)+1);
    if(whole)progress.wholeClassStars=next;else progress.studentStars[key]=next;
    // Save immediately; only the visible total is held back while the star travels.
    persistProgress();playUiSfx('star-award',1,m);
    animateStarAward(source,key,()=>{
      if(activeClassId!==classId||!pendingAwards.has(key))return;
      const left=pendingAwards.get(key)-1;if(left)pendingAwards.set(key,left);else pendingAwards.delete(key);
      render();
    });
  };

  modeToggle.addEventListener('click',()=>{
    clearAwards();
    progress.mode=progress.mode==='whole'?'student':'whole';
    persistProgress();
    notifyBoardChanged('star-chart-mode');
  });

  studentGrid.addEventListener('click',event=>{
    const target=event.target instanceof Element?event.target:null;
    const row=target?.closest('[data-student-key]');
    if(!row||!activeClassId)return;
    if(target.closest('[data-subtract-toggle],.starchart-subtract-panel,.starchart-star-token'))return;
    const action=target.closest('[data-star-action]');
    const key=row.dataset.studentKey;
    awardStar(key,(action||row).getBoundingClientRect());
  });

  studentGrid.addEventListener('wheel',event=>{
    if(studentGrid.scrollHeight>studentGrid.clientHeight+1)event.stopPropagation();
  },{passive:true});
  showAllButton.addEventListener('click',()=>setShowAllStudents(!showAllStudents,{notify:true}));

  wholeAdd.addEventListener('click',()=>{
    awardStar('__whole__',wholeAdd.getBoundingClientRect());
  });
  wholeView.querySelector('.starchart-whole-card').addEventListener('click',event=>{if(!event.target.closest('button,.starchart-star-token'))wholeAdd.click()});
  wholeRemove.addEventListener('click',()=>{
    clearAwards();
    progress.wholeClassStars=normalizeStarChartCount(progress.wholeClassStars-1);
    persistProgress();
  });
  changeClass.addEventListener('click',()=>{
    clearAwards();
    activeClassId='';pendingClassId='';roster=null;progress=normalizeStarChartProgress(null,[]);localStorage.removeItem(starChartLastClassStorageKey());render();notifyBoardChanged('star-chart-class');
  });

  m.querySelector('.starchart-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.starchart-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.starchart-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));

  const detachRosterLoader=attachClassRosterLoader(m.querySelector('.starchart-loader-anchor'),(_names,selectedRoster)=>loadClass(selectedRoster.id,{notify:true}));
  const syncRosterProgress=next=>{
    const fresh=normalizeStarChartProgress(next.starChart,next.students);
    // A reset/removal from another tile cancels flights instead of hiding the new score.
    if([...pendingAwards.keys()].some(key=>(key==='__whole__'?fresh.wholeClassStars:fresh.studentStars[key]||0)<(key==='__whole__'?progress.wholeClassStars:progress.studentStars[key]||0)))clearAwards();
    roster=next;progress=fresh;render();
  };
  const handleClassesChange=()=>{
    if(!activeClassId){if(pendingClassId)loadClass(pendingClassId);return}
    const next=currentRoster();
    if(!next){clearAwards();activeClassId='';roster=null;progress=normalizeStarChartProgress(null,[]);localStorage.removeItem(starChartLastClassStorageKey());render();return}
    syncRosterProgress(next);
  };
  const handleStarChartChange=event=>{
    if(event.detail?.classId!==activeClassId)return;
    const next=currentRoster();
    if(!next)return;
    syncRosterProgress(next);
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
  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();detachRosterLoader();overviewResize.disconnect();starLayoutObserver.disconnect();
    clearAwards();
    flyingStars.forEach(star=>star.remove());flyingStars.clear();
    if(showAllFrame)cancelAnimationFrame(showAllFrame);
    window.removeEventListener('teachertiles:classeschange',handleClassesChange);
    window.removeEventListener('teachertiles:starchartchange',handleStarChartChange);
  };
}
