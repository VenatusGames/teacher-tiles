function setupRuler(m){
  const stage=m.querySelector('.ruler-stage');
  const face=m.querySelector('.ruler-face');
  const measurement=m.querySelector('.ruler-measurement');
  const handles={
    a:m.querySelector('[data-ruler-handle="a"]'),
    b:m.querySelector('[data-ruler-handle="b"]')
  };
  const readouts={
    a:m.querySelector('.ruler-a-value'),
    b:m.querySelector('.ruler-b-value')
  };
  const selectButtons=[...m.querySelectorAll('[data-ruler-select]')];
  const unitButtons=[...m.querySelectorAll('[data-ruler-unit-option]')];
  const resetButton=m.querySelector('.ruler-reset');
  const shelf=document.createElement('div');shelf.className='ruler-tools';
  const clip=document.createElement('div');clip.className='ruler-tools-clip';
  const toolbar=document.createElement('div');toolbar.className='ruler-toolbar';
  const readoutRow=m.querySelector('.ruler-point-readouts');readoutRow.before(shelf);shelf.append(clip);clip.append(toolbar);toolbar.append(readoutRow,m.querySelector('.ruler-controls'));
  resetButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/></svg><span>Reset</span>';


  let unit='in';
  let a=0;
  let b=1;
  let active='a';
  let dragging=null;
  let scaleFrame=0;

  const config=()=>unit==='cm'
    ?{max:30,divisions:10}
    :{max:12,divisions:8};

  const formatValue=value=>TeacherTilesRulerVisuals.formatValue(unit,value);

  const valueFromFraction=fraction=>{
    const {max,divisions}=config();
    const steps=max*divisions;
    return Math.round(Math.max(0,Math.min(1,fraction))*steps)/divisions;
  };

  const renderScale=()=>{
    cancelAnimationFrame(scaleFrame);
    scaleFrame=requestAnimationFrame(()=>{
      TeacherTilesRulerVisuals.drawScale(m,unit);
    });
  };

  const render=()=>{
    const {max}=config();
    const aValue=a*max;
    const bValue=b*max;
    const distance=Math.abs(bValue-aValue);

    handles.a.style.setProperty('--ruler-position',`${a*100}%`);
    handles.b.style.setProperty('--ruler-position',`${b*100}%`);

    handles.a.classList.toggle('is-active',active==='a');
    handles.b.classList.toggle('is-active',active==='b');

    selectButtons.forEach(button=>{
      button.classList.toggle('is-active',button.dataset.rulerSelect===active);
      button.setAttribute('aria-pressed',String(button.dataset.rulerSelect===active));
    });

    unitButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.rulerUnitOption===unit)));
    readouts.a.textContent=formatValue(aValue);
    readouts.b.textContent=formatValue(bValue);
    measurement.textContent=formatValue(distance);

    handles.a.setAttribute('aria-label',`Point A at ${formatValue(aValue)}`);
    handles.b.setAttribute('aria-label',`Point B at ${formatValue(bValue)}`);
  };

  const setHandleFromClient=(which,clientX)=>{
    const rect=stage.getBoundingClientRect();
    if(!rect.width)return;

    const raw=(clientX-rect.left)/rect.width;
    const {max}=config();
    const snapped=valueFromFraction(raw);
    const fraction=snapped/max;

    if(which==='a')a=fraction;
    else b=fraction;

    render();
  };

  const select=which=>{
    active=which==='b'?'b':'a';
    render();
  };

  Object.entries(handles).forEach(([which,handle])=>{
    handle.addEventListener('pointerdown',event=>{
      if(event.button!==0)return;
      event.preventDefault();
      event.stopPropagation();

      dragging=which;
      select(which);
      handle.setPointerCapture(event.pointerId);
      setHandleFromClient(which,event.clientX);
    });

    handle.addEventListener('pointermove',event=>{
      if(dragging!==which)return;
      event.preventDefault();
      setHandleFromClient(which,event.clientX);
    });

    const stop=event=>{
      if(dragging!==which)return;
      dragging=null;
      notifyBoardChanged('ruler-measurement');
      try{handle.releasePointerCapture(event.pointerId)}catch{}
    };

    handle.addEventListener('pointerup',stop);
    handle.addEventListener('pointercancel',stop);
  });

  stage.addEventListener('pointerdown',event=>{
    if(event.button!==0||event.target.closest('.ruler-handle'))return;
    event.preventDefault();
    setHandleFromClient(active,event.clientX);
    notifyBoardChanged('ruler-measurement');
  });

  selectButtons.forEach(button=>{
    button.addEventListener('click',()=>{select(button.dataset.rulerSelect);notifyBoardChanged('ruler-point')});
  });

  unitButtons.forEach(button=>{
    button.addEventListener('click',()=>{
      unit=button.dataset.rulerUnitOption==='cm'?'cm':'in';
      m.dataset.rulerUnit=unit;

      unitButtons.forEach(item=>{
        item.classList.toggle('is-active',item.dataset.rulerUnitOption===unit);
      });

      renderScale();
      render();
      notifyBoardChanged('ruler-units');
    });
  });

  resetButton.addEventListener('click',()=>{
    a=0;
    b=1;
    active='a';
    render();
    notifyBoardChanged('ruler-reset');
  });

  m.querySelector('.ruler-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.ruler-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.ruler-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));

  const rulerResizeObserver=new ResizeObserver(renderScale);
  rulerResizeObserver.observe(face);

  renderScale();
  render();

  m._boardGetState=()=>({unit,a,b,active});
  m._boardSetState=state=>{
    if(!state)return;
    unit=state.unit==='cm'?'cm':'in';
    a=clamp(Number(state.a)||0,0,1);
    b=Number.isFinite(Number(state.b))?clamp(Number(state.b),0,1):1;
    active=state.active==='b'?'b':'a';
    m.dataset.rulerUnit=unit;
    unitButtons.forEach(item=>item.classList.toggle('is-active',item.dataset.rulerUnitOption===unit));
    renderScale();
    render();
  };

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    rulerResizeObserver.disconnect();
    cancelAnimationFrame(scaleFrame);
  };
}
