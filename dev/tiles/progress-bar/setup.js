function setupProgressBar(m){
  const remaining=m.querySelector('.progress-bar-remaining');
  const endLabel=m.querySelector('.progress-bar-end-label');
  const track=m.querySelector('.progress-bar-track');
  const fill=m.querySelector('.progress-bar-fill');
  const endInput=m.querySelector('.progress-bar-end-time');
  const setEndButton=m.querySelector('.progress-bar-set-end');
  const resetButton=m.querySelector('.progress-bar-reset');
  const orientationButton=m.querySelector('.progress-bar-orientation');
  const styleButton=m.querySelector('.progress-bar-style');
  const iconStart=m.querySelector('.progress-bar-icon-start');
  const iconEnd=m.querySelector('.progress-bar-icon-end');
  const picker=m.querySelector('.progress-bar-picker');
  const pickerGrid=m.querySelector('.progress-bar-picker__grid');
  const pickerClose=m.querySelector('.progress-bar-picker__close');
  const customImageInput=m.querySelector('.progress-bar-custom-image-input');

  const colors=['blue','green','amber','rose','purple','aqua'];
  const styles=[
    {key:'glass',label:'Glass'},
    {key:'striped',label:'Striped'},
    {key:'segmented',label:'Segments'},
    {key:'soft',label:'Soft'}
  ];

  let initializedAt=Date.now();
  let targetAt=initializedAt+60*60*1000;
  let activeIconSlot=null;
  let interval=0;
  let completed=false;
  let running=false;

  const pad=n=>String(n).padStart(2,'0');
  const formatInputTime=date=>`${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const formatClock=date=>date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});

  const formatRemaining=ms=>{
    const total=Math.max(0,Math.ceil(ms/1000));
    const hours=Math.floor(total/3600);
    const minutes=Math.floor((total%3600)/60);
    const seconds=total%60;
    return hours>0?`${hours}:${pad(minutes)}:${pad(seconds)}`:`${pad(minutes)}:${pad(seconds)}`;
  };

  const setSlotIcon=(slot,icon)=>{
    const image=slot.querySelector('img');
    image.src=icon.src;
    image.alt=icon.label;
    slot.dataset.iconSrc=icon.src;
    slot.classList.add('has-icon');
  };

  const clearSlotIcon=slot=>{
    const image=slot.querySelector('img');
    image.removeAttribute('src');
    image.alt='';
    delete slot.dataset.iconSrc;
    slot.classList.remove('has-icon');
  };

  const restoreSlotIcon=(slot,src)=>{
    const icon=resolveVisualScheduleIcon(src);
    if(icon)setSlotIcon(slot,icon);
    else if(typeof src==='string'&&src.startsWith('data:image/'))setSlotIcon(slot,{src,label:'Custom image'});
    else clearSlotIcon(slot);
  };

  const refreshPickerSelection=()=>{
    const current=activeIconSlot?.dataset.iconSrc||'';
    pickerGrid.querySelectorAll('.progress-bar-icon-option').forEach(button=>{
      button.classList.toggle('is-selected',button.dataset.iconSrc===current);
    });
  };

  const openPicker=slot=>{
    activeIconSlot=slot;
    refreshPickerSelection();
    picker.hidden=false;
    requestAnimationFrame(()=>pickerClose.focus({preventScroll:true}));
  };

  const closePicker=()=>{
    picker.hidden=true;
    activeIconSlot=null;
  };

  const uploadOption=document.createElement('button');
  uploadOption.type='button';
  uploadOption.className='progress-bar-icon-option progress-bar-icon-option--upload';
  uploadOption.innerHTML='<span class="custom-image-upload-mark" aria-hidden="true">+</span><span>Upload yours</span>';
  uploadOption.setAttribute('aria-label','Upload a custom progress bar image');
  uploadOption.addEventListener('click',()=>customImageInput?.click());
  pickerGrid.appendChild(uploadOption);

  customImageInput?.addEventListener('change',async()=>{
    const file=customImageInput.files?.[0];
    if(!file||!activeIconSlot)return;
    const data=await fileToBoardImageData(file,{maxSide:420,maxLength:70000,quality:.72,minSide:160});
    if(data){setSlotIcon(activeIconSlot,{src:data,label:file.name||'Custom image'});notifyBoardChanged('progress-bar-image')}
    customImageInput.value='';
    closePicker();
  });

  VISUAL_SCHEDULE_ICONS.forEach(icon=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='progress-bar-icon-option';
    button.dataset.iconSrc=icon.src;
    button.setAttribute('aria-label',`Use ${icon.label} image`);

    const image=document.createElement('img');
    image.src=icon.src;
    image.alt='';
    image.draggable=false;

    const caption=document.createElement('span');
    caption.textContent=icon.label;

    button.append(image,caption);
    button.addEventListener('click',()=>{
      if(activeIconSlot){
        setSlotIcon(activeIconSlot,icon);
        notifyBoardChanged('progress-bar-image');
      }
      closePicker();
    });
    pickerGrid.appendChild(button);
  });

  const render=()=>{
    const now=Date.now();
    const duration=Math.max(1,targetAt-initializedAt);
    const elapsed=completed?duration:(running?Math.max(0,now-initializedAt):0);
    const progress=clamp(elapsed/duration,0,1);

    const vertical=m.dataset.orientation==='vertical';
    const trackLength=vertical?track.clientHeight:track.clientWidth;
    const trueLength=Math.max(0,trackLength*progress);
    const visibleLength=progress>0&&progress<1?Math.max(6,trueLength):trueLength;

    if(vertical){
      fill.style.width='';
      fill.style.height=`${Math.min(trackLength,visibleLength)}px`;
    }else{
      fill.style.height='';
      fill.style.width=`${Math.min(trackLength,visibleLength)}px`;
    }

    m.style.setProperty('--progress',`${(progress*100).toFixed(4)}%`);
    remaining.textContent=formatRemaining(completed?0:(running?targetAt-now:duration));
    endLabel.textContent=`until ${formatClock(new Date(targetAt))}`;

    const isComplete=progress>=1;
    m.classList.toggle('is-complete',isComplete);
    if(isComplete&&!completed){
      completed=true;
      running=false;
      celebrateTimerFinish(m);
    }
  };

  const targetFromInput=()=>{
    if(!endInput.value)return;
    const [hour,minute]=endInput.value.split(':').map(Number);
    if(!Number.isFinite(hour)||!Number.isFinite(minute))return;

    const now=new Date();
    const target=new Date(now);
    target.setHours(hour,minute,0,0);
    if(target.getTime()<=now.getTime())target.setDate(target.getDate()+1);
    return target.getTime();
  };

  const syncTimeFromInput=()=>{
    const nextTarget=targetFromInput();
    if(!nextTarget)return;
    if(!running)initializedAt=Date.now();
    targetAt=nextTarget;
    completed=false;
    m.classList.remove('is-complete');
    render();
    notifyBoardChanged('progress-bar-time');
  };

  const start=()=>{
    const nextTarget=targetFromInput();
    if(!nextTarget)return;
    initializedAt=Date.now();
    targetAt=nextTarget;
    completed=false;
    running=true;
    m.classList.remove('is-complete');
    render();
    notifyBoardChanged('progress-bar-start');
  };

  const reset=()=>{
    const nextTarget=targetFromInput();
    initializedAt=Date.now();
    if(nextTarget)targetAt=nextTarget;
    completed=false;
    running=false;
    m.classList.remove('is-complete');
    render();
    notifyBoardChanged('progress-bar-reset');
  };

  const setOrientation=orientation=>{
    const vertical=orientation==='vertical';
    m.dataset.orientation=orientation;
    orientationButton.textContent=vertical?'↕':'↔';
    orientationButton.title=vertical?'Switch to horizontal':'Switch to vertical';

    const centerX=m.offsetLeft+m.offsetWidth/2;
    const centerY=m.offsetTop+m.offsetHeight/2;

    if(vertical){
      m.style.width='250px';
      m.style.height='700px';
    }else{
      m.style.width='760px';
      m.style.height='190px';
    }

    const w=m.offsetWidth,h=m.offsetHeight;
    m.style.left=`${clamp(centerX-w/2,0,BOARD_WIDTH-w)}px`;
    m.style.top=`${clamp(centerY-h/2,0,BOARD_HEIGHT-h)}px`;
    render();
    updateWorkspaceEmptyState();
  };

  const cycleStyle=()=>{
    const current=m.dataset.barStyle||'glass';
    const index=styles.findIndex(option=>option.key===current);
    const next=styles[(index+1)%styles.length];
    m.dataset.barStyle=next.key;
    styleButton.textContent=next.label;
  };

  const syncVisualControls=()=>{
    const vertical=m.dataset.orientation==='vertical';
    orientationButton.textContent=vertical?'↕':'↔';
    orientationButton.title=vertical?'Switch to horizontal':'Switch to vertical';
    const style=styles.find(option=>option.key===m.dataset.barStyle)||styles[0];
    m.dataset.barStyle=style.key;
    styleButton.textContent=style.label;
  };

  m.querySelector('.progress-bar-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.progress-bar-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.progress-bar-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));
  m.querySelector('.progress-bar-color').addEventListener('click',()=>cycleData(m,'barColor',colors));

  setEndButton.addEventListener('click',start);
  resetButton.addEventListener('click',reset);
  endInput.addEventListener('input',syncTimeFromInput);
  endInput.addEventListener('keydown',e=>{
    if(e.key==='Enter'){
      e.preventDefault();
      syncTimeFromInput();
      endInput.blur();
    }
  });

  orientationButton.addEventListener('click',()=>{
    setOrientation(m.dataset.orientation==='vertical'?'horizontal':'vertical');
  });
  styleButton.addEventListener('click',cycleStyle);

  iconStart.addEventListener('click',()=>openPicker(iconStart));
  iconEnd.addEventListener('click',()=>openPicker(iconEnd));
  pickerClose.addEventListener('click',closePicker);
  picker.addEventListener('pointerdown',e=>{
    if(e.target===picker)closePicker();
  });
  picker.addEventListener('wheel',e=>{
    e.preventDefault();
    e.stopPropagation();
    pickerGrid.scrollTop+=e.deltaY;
  },{passive:false});

  const defaultEnd=new Date(Date.now()+30*60*1000);
  endInput.value=formatInputTime(defaultEnd);
  syncTimeFromInput();
  syncVisualControls();

  interval=window.setInterval(render,200);
  render();

  m._boardGetState=()=>({
    title:m.querySelector(".progress-bar-title")?.value||"",
    initializedAt,
    targetAt,
    completed,
    running,
    orientation:m.dataset.orientation||'horizontal',
    barStyle:m.dataset.barStyle||'glass',
    startIconSrc:iconStart.dataset.iconSrc||'',
    endIconSrc:iconEnd.dataset.iconSrc||''
  });
  m._boardSetState=state=>{
    if(!state)return;
    if(typeof state.title==="string")m.querySelector(".progress-bar-title").value=state.title;
    initializedAt=Number(state.initializedAt)||Date.now();
    targetAt=Number(state.targetAt)||Date.now()+30*60*1000;
    completed=Boolean(state.completed);
    running=state.running===undefined?!completed:Boolean(state.running);
    if(state.orientation==='vertical'||state.orientation==='horizontal')m.dataset.orientation=state.orientation;
    if(styles.some(option=>option.key===state.barStyle))m.dataset.barStyle=state.barStyle;
    syncVisualControls();
    restoreSlotIcon(iconStart,state.startIconSrc||state.startIcon||'');
    restoreSlotIcon(iconEnd,state.endIconSrc||state.endIcon||'');
    endInput.value=formatInputTime(new Date(targetAt));
    render();
  };

  const priorDeactivate=m._deactivate,priorReactivate=m._reactivate;
  m._deactivate=()=>{running=false;window.clearInterval(interval);interval=null;priorDeactivate?.()};
  m._reactivate=()=>{priorReactivate?.();if(!interval)interval=window.setInterval(render,200);render()};
  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    window.clearInterval(interval);
  };
}
