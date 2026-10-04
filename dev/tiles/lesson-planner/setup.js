function setupLessonPlannerTile(m){
  const body=m.querySelector('.lesson-plan-tile__body');
  const title=m.querySelector('.lesson-plan-tile__title');
  const range=m.querySelector('.lesson-plan-tile__range');
  const plannerSelect=m.querySelector('.lesson-plan-tile__planner');
  const viewButtons=[...m.querySelectorAll('[data-lesson-plan-tile-view]')];
  const colorMap={sun:['#f3bd3d','#563b00'],sky:['#5ca7e8','#0c355a'],mint:['#61bf9a','#0b4433'],coral:['#ee7b68','#5b1e18'],grape:['#a883dc','#352050'],rose:['#dc79a6','#561b36'],ocean:['#397db9','#f4fbff'],slate:['#718096','#fff']};
  let mode=m.dataset.plannerTileView==='week'?'week':'day';
  let plannerId=String(m.dataset.plannerTilePlanner||'');
  const atNoon=date=>{const next=new Date(date);next.setHours(12,0,0,0);return next};
  const addDays=(date,amount)=>{const next=atNoon(date);next.setDate(next.getDate()+amount);return next};
  const dateKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const startOfWeek=date=>addDays(date,date.getDay()===0?-6:1-date.getDay());
  const timeLabel=value=>{const [hours,minutes]=String(value||'00:00').split(':').map(Number);return `${hours%12||12}:${String(minutes||0).padStart(2,'0')} ${hours<12?'AM':'PM'}`};
  const getPlanners=()=>{
    const api=window.TeacherTilesLessonPlanner?.getPlanners?.();
    if(Array.isArray(api))return api;
    try{const value=JSON.parse(localStorage.getItem('teachertiles-lesson-planners-v2')||'[]');return Array.isArray(value)?value:[]}catch{return[]}
  };
  const syncPlannerPicker=()=>{
    const planners=getPlanners();
    const valid=planners.some(planner=>planner.id===plannerId);
    if(!valid)plannerId=planners[0]?.id||'';
    plannerSelect.replaceChildren();
    if(!planners.length){const option=new Option('No planners yet','');plannerSelect.append(option);plannerSelect.disabled=true;plannerId=''}
    else{
      plannerSelect.disabled=false;
      planners.forEach(planner=>plannerSelect.add(new Option(String(planner.name||'Untitled Planner'),String(planner.id||''))));
      plannerSelect.value=plannerId;
    }
    if(plannerId)m.dataset.plannerTilePlanner=plannerId;else delete m.dataset.plannerTilePlanner;
    return planners;
  };
  const getBlocks=()=>{
    const apiBlocks=window.TeacherTilesLessonPlanner?.getBlocks?.(plannerId);
    if(Array.isArray(apiBlocks))return apiBlocks;
    const planner=getPlanners().find(item=>item.id===plannerId);
    return Array.isArray(planner?.blocks)?planner.blocks:[];
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
    const planners=syncPlannerPicker();
    const today=atNoon(new Date());
    const blocks=getBlocks().filter(block=>block&&typeof block.date==='string').sort((a,b)=>a.date.localeCompare(b.date)||String(a.start).localeCompare(String(b.start)));
    const plannerName=planners.find(planner=>planner.id===plannerId)?.name||'';
    body.replaceChildren();m.dataset.plannerTileView=mode;
    viewButtons.forEach(button=>{const active=button.dataset.lessonPlanTileView===mode;button.classList.toggle('is-active',active);button.setAttribute('aria-pressed',String(active))});
    if(mode==='day'){
      const key=dateKey(today);const plans=blocks.filter(block=>block.date===key);
      title.textContent='Today’s Plans';range.textContent=`${new Intl.DateTimeFormat(undefined,{weekday:'long',month:'long',day:'numeric'}).format(today)}${plannerName?` · ${plannerName}`:''}`;
      if(!plans.length)renderEmpty(plannerName?'Open this planner to plan today.':'Create a planner to get started.');else plans.forEach(plan=>body.append(makeBlock(plan)));
      return;
    }
    const first=startOfWeek(today),last=addDays(first,6);title.textContent='This Week’s Plans';
    range.textContent=`${new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(first)}–${new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(last)}${plannerName?` · ${plannerName}`:''}`;
    let count=0;
    for(let index=0;index<7;index++){
      const date=addDays(first,index);const plans=blocks.filter(block=>block.date===dateKey(date));if(!plans.length)continue;count+=plans.length;
      const group=document.createElement('section');group.className='lesson-plan-tile__day-group';
      const heading=document.createElement('header');heading.innerHTML='<strong></strong><span></span>';heading.querySelector('strong').textContent=new Intl.DateTimeFormat(undefined,{weekday:'long'}).format(date);heading.querySelector('span').textContent=new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(date);
      group.append(heading);plans.forEach(plan=>group.append(makeBlock(plan)));body.append(group);
    }
    if(!count)renderEmpty(plannerName?'Open this planner to build this week.':'Create a planner to get started.');
  };
  plannerSelect.addEventListener('change',()=>{plannerId=plannerSelect.value;render();notifyBoardChanged('lesson-planner-tile-planner')});
  viewButtons.forEach(button=>button.addEventListener('click',()=>{mode=button.dataset.lessonPlanTileView==='week'?'week':'day';render();notifyBoardChanged('lesson-planner-tile-view')}));
  m.querySelector('.lesson-plan-tile__edit').addEventListener('click',()=>{if(window.TeacherTilesLessonPlanner?.open)window.TeacherTilesLessonPlanner.open(plannerId);else document.getElementById('profile-lesson-planner-button')?.click()});
  m.querySelector('.lesson-plan-tile__bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.lesson-plan-tile__font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.lesson-plan-tile__text').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));
  const handleChange=()=>render();window.addEventListener('teachertiles:lessonplannerchange',handleChange);
  m._refreshLessonPlans=render;
  const dateTimer=setInterval(render,60000);
  m._boardGetState=()=>({mode,plannerId});m._boardSetState=state=>{mode=state?.mode==='week'?'week':'day';plannerId=String(state?.plannerId||m.dataset.plannerTilePlanner||'');render()};
  const prior=m._cleanup;m._cleanup=()=>{prior?.();clearInterval(dateTimer);window.removeEventListener('teachertiles:lessonplannerchange',handleChange);delete m._refreshLessonPlans};
  render();
}
