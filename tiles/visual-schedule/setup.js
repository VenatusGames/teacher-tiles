function setupVisualSchedule(m){
  const settings=document.createElement('div');settings.className='tile-settings-wrap';settings.innerHTML='<button type="button" class="custom-icon tile-settings-toggle" aria-label="Visual Schedule settings" aria-expanded="false">⚙</button><div class="tile-settings-panel" hidden><strong>Visual Schedule settings</strong></div>';
  const dock=m.querySelector('.visual-schedule-scale-dock');settings.querySelector('.tile-settings-panel').append(dock);m.querySelector('.visual-schedule-customization').append(settings);
  m.querySelector('.visual-schedule-row-size-input').value='44';

  setupClassroomTileControls(m);
  const list=m.querySelector('.visual-schedule-list');
  const add=m.querySelector('.visual-schedule-add');
  add.textContent='+';
  const reset=m.querySelector('.visual-schedule-reset');
  const count=m.querySelector('.visual-schedule-count');
  const rowSizeInput=m.querySelector('.visual-schedule-row-size-input');
  const rowSizeOutput=m.querySelector('.visual-schedule-row-size-output');
  const rowSizeSync=m.querySelector('.visual-schedule-row-size-sync');
  const picker=m.querySelector('.visual-schedule-picker');
  const pickerGrid=m.querySelector('.visual-schedule-picker__grid');
  const pickerClose=m.querySelector('.visual-schedule-picker__close');
  const customImageInput=m.querySelector('.visual-schedule-custom-image-input');
  let activeSegment=null;
  let autoSizeFrame=0;
  let addExpanded=false;

  m.querySelector('.visual-schedule-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.visual-schedule-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.visual-schedule-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));

  const updateSummary=()=>{
    const rows=[...list.querySelectorAll('.visual-schedule-segment')];
    const complete=rows.filter(row=>row.classList.contains('is-complete')).length;
    count.textContent=`${rows.length} ${rows.length===1?'activity':'activities'}${complete?` · ${complete} done`:''}`;
    reset.disabled=!complete;
  };

  const autoSize=()=>{
    cancelAnimationFrame(autoSizeFrame);
    autoSizeFrame=requestAnimationFrame(()=>{
      updateSummary();
      const top=m.offsetTop;
      m.classList.add('is-measuring-rest');
      m.style.height='auto';
      const desired=Math.ceil(m.scrollHeight);
      m.classList.remove('is-measuring-rest');
      const minHeight=parseFloat(getComputedStyle(m).minHeight)||160;
      const viewportHeight=Math.max(minHeight,(innerHeight-96)/boardCamera.scale);
      const maxHeight=Math.max(minHeight,Math.min(720,viewportHeight,BOARD_HEIGHT-top));
      m.style.height=`${clamp(desired,minHeight,maxHeight)}px`;
    });
  };

  const expandAddFooter=()=>{
    if(addExpanded)return;
    addExpanded=true;
    m.classList.add('is-add-expanded');
  };
  const collapseAddFooter=()=>{
    if(!addExpanded)return;
    addExpanded=false;
    m.classList.remove('is-add-expanded');
  };
  const onPointerEnter=()=>expandAddFooter();
  const onPointerLeave=()=>{if(!m.classList.contains('is-resizing'))collapseAddFooter()};
  const onFocusIn=()=>expandAddFooter();
  const onFocusOut=()=>requestAnimationFrame(()=>{
    if(!m.matches(':hover')&&!m.contains(document.activeElement))collapseAddFooter();
  });
  m._afterModuleResize=()=>{
    if(addExpanded&&!m.matches(':hover'))collapseAddFooter();
  };
  m.addEventListener('pointerenter',onPointerEnter);
  m.addEventListener('pointerleave',onPointerLeave);
  m.addEventListener('focusin',onFocusIn);
  m.addEventListener('focusout',onFocusOut);

  const closePicker=()=>{
    picker.hidden=true;
    activeSegment=null;
  };

  const refreshPickerSelection=()=>{
    const current=activeSegment?.dataset.iconSrc||'';
    pickerGrid.querySelectorAll('.visual-schedule-icon-option').forEach(button=>{
      button.classList.toggle('is-selected',button.dataset.iconSrc===current);
    });
  };

  const uploadOption=document.createElement('button');
  uploadOption.type='button';
  uploadOption.className='visual-schedule-icon-option visual-schedule-icon-option--upload';
  uploadOption.innerHTML='<span class="custom-image-upload-mark" aria-hidden="true">+</span><span>Upload yours</span>';
  uploadOption.setAttribute('aria-label','Upload a custom visual schedule image');
  uploadOption.addEventListener('click',()=>customImageInput?.click());
  pickerGrid.appendChild(uploadOption);

  customImageInput?.addEventListener('change',async()=>{
    const file=customImageInput.files?.[0];
    if(!file||!activeSegment)return;
    const data=await fileToBoardImageData(file,{maxSide:420,maxLength:70000,quality:.72,minSide:160});
    if(data){
      const targetImage=activeSegment.querySelector('.visual-schedule-image img');
      targetImage.src=data;
      targetImage.alt=file.name||'Custom image';
      activeSegment.dataset.iconSrc=data;
      notifyBoardChanged('visual-schedule-image');
    }
    customImageInput.value='';
    closePicker();
  });

  VISUAL_SCHEDULE_ICONS.forEach(icon=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='visual-schedule-icon-option';
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
      if(!activeSegment)return;
      const targetImage=activeSegment.querySelector('.visual-schedule-image img');
      targetImage.src=icon.src;
      targetImage.alt=icon.label;
      activeSegment.dataset.iconSrc=icon.src;
      notifyBoardChanged('visual-schedule-image');
      closePicker();
    });
    pickerGrid.appendChild(button);
  });

  const openPicker=segment=>{
    activeSegment=segment;
    refreshPickerSelection();
    picker.hidden=false;
    requestAnimationFrame(()=>pickerClose.focus({preventScroll:true}));
  };

  pickerClose.addEventListener('click',closePicker);
  picker.addEventListener('pointerdown',e=>{
    if(e.target===picker)closePicker();
  });
  picker.addEventListener('wheel',e=>{
    e.stopPropagation();
  },{passive:true});
  list.addEventListener('wheel',event=>{
    if(list.scrollHeight<=list.clientHeight+1)return;
    const wheelDelta=event.deltaY||event.deltaX;
    if(!wheelDelta)return;
    event.preventDefault();
    event.stopPropagation();
    const delta=event.deltaMode===1?wheelDelta*16:event.deltaMode===2?wheelDelta*list.clientHeight:wheelDelta;
    list.scrollTop+=delta;
  },{passive:false});

  const setSegmentSize=(row,value)=>{
    const size=clamp(Math.round(Number(value)||44),44,220);
    row.dataset.segmentSize=String(size);
    row.style.setProperty('--visual-segment-size',`${size}px`);
  };
  const syncRowSizeControl=()=>{
    const sizes=[...list.querySelectorAll('.visual-schedule-segment')].map(row=>Number(row.dataset.segmentSize)||44);
    const unique=[...new Set(sizes)];
    const representative=unique.length===1?unique[0]:Math.round((sizes.reduce((sum,size)=>sum+size,0)/(sizes.length||1))/4)*4||44;
    rowSizeInput.value=String(clamp(representative,44,220));
    rowSizeOutput.value=unique.length>1?'Mixed':`${representative} px`;
    rowSizeOutput.textContent=rowSizeOutput.value;
    rowSizeSync.hidden=unique.length<=1;
  };

  const addSegment=(data={},focus=false)=>{
    const segmentCount=list.querySelectorAll('.visual-schedule-segment').length;
    const fallbackIcon=VISUAL_SCHEDULE_ICONS[data.iconIndex??(segmentCount%VISUAL_SCHEDULE_ICONS.length)]||VISUAL_SCHEDULE_ICONS[0];
    const icon=resolveVisualScheduleIcon(data.iconSrc)||(typeof data.iconSrc==='string'&&data.iconSrc.startsWith('data:image/')?{src:data.iconSrc,label:'Custom image'}:fallbackIcon);
    const row=document.createElement('div');
    row.className='visual-schedule-segment';
    row.dataset.iconSrc=icon.src;
    row.innerHTML=`
      <button class="visual-schedule-image" type="button" aria-label="Change segment image" title="Change image">
        <img src="${icon.src}" alt="${icon.label}" draggable="false">
      </button>
      <div class="visual-schedule-segment-copy"><input class="visual-schedule-segment-title" type="text" aria-label="Activity title" data-text-edit-mode="double"><span class="visual-schedule-divider" aria-hidden="true"></span><input class="visual-schedule-segment-time" type="text" aria-label="Activity time" data-text-edit-mode="double"></div>
      <div class="visual-schedule-segment-actions">
        <button class="visual-schedule-complete" type="button" aria-pressed="false" aria-label="Mark segment complete"><span aria-hidden="true">✓</span></button>
        <button class="visual-schedule-remove" type="button" aria-label="Remove segment" title="Remove segment">×</button>
      </div>
      <button class="visual-schedule-resize" type="button" aria-label="Resize this schedule segment" title="Drag to resize segment"></button>
    `;
    setSegmentSize(row,data.size??(Number(rowSizeInput.value)||44));
    const title=row.querySelector('.visual-schedule-segment-title');
    const time=row.querySelector('.visual-schedule-segment-time');
    title.value=data.title??'New Activity';
    time.value=data.time??'';
    const fitCopy=()=>{title.style.width=Math.max(4,title.value.length+.5)+'ch';time.style.width=Math.max(5,time.value.length+.5)+'ch'};
    title.addEventListener('input',fitCopy);time.addEventListener('input',fitCopy);fitCopy();
    row.classList.toggle('is-complete',Boolean(data.complete));
    const completeButton=row.querySelector('.visual-schedule-complete');
    const syncCompleteButton=()=>{
      const complete=row.classList.contains('is-complete');
      completeButton.setAttribute('aria-pressed',String(complete));
      completeButton.setAttribute('aria-label',complete?'Mark segment incomplete':'Mark segment complete');
      completeButton.title=complete?'Mark segment incomplete':'Mark segment complete';
    };
    row._syncCompleteButton=syncCompleteButton;
    syncCompleteButton();

    completeButton.addEventListener('click',()=>{
      row.classList.toggle('is-complete');
      syncCompleteButton();
      updateSummary();
      notifyBoardChanged('visual-schedule-complete');
    });
    title.addEventListener('change',()=>notifyBoardChanged('visual-schedule-text'));
    time.addEventListener('change',()=>notifyBoardChanged('visual-schedule-text'));
    row.querySelector('.visual-schedule-image').addEventListener('click',()=>openPicker(row));
    row.querySelector('.visual-schedule-remove').addEventListener('click',()=>{
      if(activeSegment===row)closePicker();
      row.remove();
      syncRowSizeControl();
      autoSize();
      notifyBoardChanged('visual-schedule-remove');
    });
    const resizeHandle=row.querySelector('.visual-schedule-resize');
    resizeHandle.addEventListener('keydown',event=>{
      if(event.key!=='ArrowUp'&&event.key!=='ArrowDown')return;
      event.preventDefault();
      setSegmentSize(row,(Number(row.dataset.segmentSize)||44)+(event.key==='ArrowDown'?8:-8));
      syncRowSizeControl();
      autoSize();
      notifyBoardChanged('visual-schedule-resize');
    });
    resizeHandle.addEventListener('pointerdown',event=>{
      if(event.button!==0)return;
      event.preventDefault();
      event.stopPropagation();
      const startY=event.clientY;
      const startSize=Number(row.dataset.segmentSize)||44;
      resizeHandle.setPointerCapture(event.pointerId);

      const move=moveEvent=>{
        moveEvent.preventDefault();
        moveEvent.stopPropagation();
        setSegmentSize(row,startSize+(moveEvent.clientY-startY)/boardCamera.scale);
        syncRowSizeControl();
      };
      const finish=finishEvent=>{
        finishEvent.stopPropagation();
        resizeHandle.removeEventListener('pointermove',move);
        resizeHandle.removeEventListener('pointerup',finish);
        resizeHandle.removeEventListener('pointercancel',finish);
        autoSize();
        notifyBoardChanged('visual-schedule-resize');
      };

      resizeHandle.addEventListener('pointermove',move);
      resizeHandle.addEventListener('pointerup',finish);
      resizeHandle.addEventListener('pointercancel',finish);
    });

    list.insertBefore(row,add);
    syncRowSizeControl();
    autoSize();
    if(focus)requestAnimationFrame(()=>{title.focus();title.select()});
  };

  add.addEventListener('click',()=>{
    addSegment({},true);
    notifyBoardChanged('visual-schedule-add');
  });
  const setAllSegmentSizes=value=>{
    const rows=[...list.querySelectorAll('.visual-schedule-segment')];
    if(!rows.length)return;
    rows.forEach(row=>setSegmentSize(row,value));
    syncRowSizeControl();
  };
  rowSizeInput.addEventListener('input',()=>setAllSegmentSizes(Number(rowSizeInput.value)||44));
  rowSizeInput.addEventListener('change',()=>{
    autoSize();
    notifyBoardChanged('visual-schedule-resize-all');
  });
  rowSizeSync.addEventListener('click',()=>{
    setAllSegmentSizes(Number(rowSizeInput.value)||44);
    autoSize();
    notifyBoardChanged('visual-schedule-resize-all');
  });
  reset.addEventListener('click',()=>{
    const completed=[...list.querySelectorAll('.visual-schedule-segment.is-complete')];
    if(!completed.length)return;
    completed.forEach(row=>{
      row.classList.remove('is-complete');
      row._syncCompleteButton?.();
    });
    updateSummary();
    notifyBoardChanged('visual-schedule-reset');
  });

  addSegment({title:'Arrival',time:'8:00 AM',iconIndex:7});
  addSegment({title:'Morning Work',time:'8:15 AM',iconIndex:6});
  addSegment({title:'Reading',time:'9:00 AM',iconIndex:2});

  m._boardGetState=()=>({segments:[...list.querySelectorAll('.visual-schedule-segment')].map(row=>({
    title:row.querySelector('.visual-schedule-segment-title')?.value||'',
    time:row.querySelector('.visual-schedule-segment-time')?.value||'',
    iconSrc:row.dataset.iconSrc||row.querySelector('.visual-schedule-image img')?.getAttribute('src')||'',
    complete:row.classList.contains('is-complete'),
    size:Number(row.dataset.segmentSize)||44
  }))});
  m._boardSetState=state=>{
    closePicker();
    list.querySelectorAll('.visual-schedule-segment').forEach(row=>row.remove());
    const segments=Array.isArray(state?.segments)?state.segments:[];
    segments.forEach(segment=>addSegment(segment,false));
    syncRowSizeControl();
    autoSize();
  };

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    cancelAnimationFrame(autoSizeFrame);
    m.removeEventListener('pointerenter',onPointerEnter);
    m.removeEventListener('pointerleave',onPointerLeave);
    m.removeEventListener('focusin',onFocusIn);
    m.removeEventListener('focusout',onFocusOut);
    delete m._afterModuleResize;
  };

  autoSize();
  requestAnimationFrame(()=>{if(m.matches(':hover'))expandAddFooter()});
}
