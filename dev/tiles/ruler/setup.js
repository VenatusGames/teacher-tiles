function setupRuler(m){
  const stage=m.querySelector('.ruler-stage');
  const face=m.querySelector('.ruler-face');
  const svg=m.querySelector('.ruler-svg');
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

  let unit='in';
  let a=0;
  let b=1;
  let active='a';
  let dragging=null;
  let scaleFrame=0;

  const config=()=>unit==='cm'
    ?{max:30,divisions:10}
    :{max:12,divisions:8};

  const formatInches=value=>{
    const eighths=Math.round(value*8);
    const whole=Math.floor(eighths/8);
    const remainder=eighths%8;
    if(!remainder)return`${whole} in`;

    const divisor=remainder%4===0?4:remainder%2===0?2:1;
    const numerator=remainder/divisor;
    const denominator=8/divisor;

    return whole
      ?`${whole} ${numerator}/${denominator} in`
      :`${numerator}/${denominator} in`;
  };

  const formatValue=value=>{
    if(unit==='in')return formatInches(value);
    const rounded=Math.round(value*10)/10;
    return`${Number(rounded.toFixed(1))} cm`;
  };

  const valueFromFraction=fraction=>{
    const {max,divisions}=config();
    const steps=max*divisions;
    return Math.round(Math.max(0,Math.min(1,fraction))*steps)/divisions;
  };

  const renderScale=()=>{
    cancelAnimationFrame(scaleFrame);
    scaleFrame=requestAnimationFrame(()=>{
      const {max,divisions}=config();
      const total=max*divisions;

      const width=Math.max(320,Math.round(face.clientWidth||stage.clientWidth||760));
      const height=Math.max(82,Math.round(face.clientHeight||98));
      const baseline=height;
      const labelY=Math.max(17,Math.round(height*.22));

      svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
      svg.replaceChildren();

      const make=(tag,attrs={})=>{
        const el=document.createElementNS('http://www.w3.org/2000/svg',tag);
        Object.entries(attrs).forEach(([key,value])=>el.setAttribute(key,String(value)));
        return el;
      };

      const cmLabelEvery=width<590?5:width<820?2:1;

      for(let step=0;step<=total;step++){
        const x=step/total*width;
        const fraction=step/divisions;
        const isMajor=step%divisions===0;

        let tickHeight;
        if(unit==='in'){
          const eighth=step%8;
          tickHeight=isMajor
            ?Math.round(height*.55)
            :eighth===4
              ?Math.round(height*.40)
              :eighth%2===0
                ?Math.round(height*.30)
                :Math.round(height*.22);
        }else{
          const tenth=step%10;
          tickHeight=isMajor
            ?Math.round(height*.55)
            :tenth===5
              ?Math.round(height*.38)
              :Math.round(height*.23);
        }

        svg.appendChild(make('line',{
          x1:x,
          x2:x,
          y1:baseline-tickHeight,
          y2:baseline,
          class:isMajor?'ruler-tick ruler-tick--major':'ruler-tick'
        }));

        const showLabel=isMajor&&(
          unit==='in'||
          Math.round(fraction)%cmLabelEvery===0
        );

        if(showLabel){
          const label=make('text',{
            x,
            y:labelY,
            'text-anchor':step===0?'start':step===total?'end':'middle',
            class:'ruler-scale-label'
          });
          label.textContent=String(Math.round(fraction));
          svg.appendChild(label);
        }
      }
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
    });

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
      try{handle.releasePointerCapture(event.pointerId)}catch{}
    };

    handle.addEventListener('pointerup',stop);
    handle.addEventListener('pointercancel',stop);
  });

  stage.addEventListener('pointerdown',event=>{
    if(event.button!==0||event.target.closest('.ruler-handle'))return;
    event.preventDefault();
    setHandleFromClient(active,event.clientX);
  });

  selectButtons.forEach(button=>{
    button.addEventListener('click',()=>select(button.dataset.rulerSelect));
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
    });
  });

  resetButton.addEventListener('click',()=>{
    a=0;
    b=1;
    active='a';
    render();
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
    b=clamp(Number(state.b)??1,0,1);
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
