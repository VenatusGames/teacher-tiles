function setupNumberLine(m){
  const stage=m.querySelector('.numberline-stage');
  const svg=m.querySelector('.numberline-svg');
  const valueAEl=m.querySelector('.numberline-value-a');
  const valueBEl=m.querySelector('.numberline-value-b');
  const pointSelectors=[...m.querySelectorAll('[data-numberline-point-select]')];
  const hopCount=m.querySelector('.numberline-hop-count');
  const stepButtons=[...m.querySelectorAll('[data-numberline-step]')];
  const extendButtons=[...m.querySelectorAll('[data-numberline-extend]')];
  const secondPointButton=m.querySelector('.numberline-second-point');
  const resetButton=m.querySelector('.numberline-reset');

  const defaultStart=0;
  const defaultEnd=20;
  const defaultWidth=920;
  const sidePadding=58;

  let start=defaultStart;
  let end=defaultEnd;
  let valueA=0;
  let valueB=null;
  let activePoint='a';

  const clampValue=n=>Math.max(start,Math.min(end,n));

  const labelSpacing=()=>{
    const longest=Math.max(String(start).length,String(end).length);
    return Math.max(38,longest*12+10);
  };

  const geometry=()=>{
    const spacing=labelSpacing();
    const count=end-start+1;
    const right=sidePadding+(count-1)*spacing;
    const totalWidth=right+sidePadding;
    return {
      spacing,
      left:sidePadding,
      right,
      totalWidth,
      xFor:n=>sidePadding+(n-start)*spacing
    };
  };

  const fitModuleToRange=({resetWidth=false}={})=>{
    const {totalWidth}=geometry();
    const requiredOuter=Math.ceil(totalWidth+36);
    const width=resetWidth
      ?Math.max(defaultWidth,requiredOuter)
      :Math.max(defaultWidth,requiredOuter,m.offsetWidth);

    m.style.minWidth=`${Math.max(defaultWidth,requiredOuter)}px`;
    m.style.width=`${width}px`;

    const currentLeft=parseFloat(m.style.left)||m.offsetLeft||0;
    if(currentLeft+width>BOARD_WIDTH){
      m.style.left=`${Math.max(0,BOARD_WIDTH-width)}px`;
    }
  };

  const selectPoint=point=>{
    if(point==='b'&&valueB===null)return;
    activePoint=point==='b'?'b':'a';

    pointSelectors.forEach(button=>{
      button.classList.toggle('is-active',button.dataset.numberlinePointSelect===activePoint);
    });

    render({fit:false});
  };

  const makeMarker=(point,value,xFor)=>{
    const marker=document.createElementNS('http://www.w3.org/2000/svg','g');
    marker.setAttribute('class',`numberline-marker numberline-marker--${point}${activePoint===point?' is-active':''}`);
    marker.dataset.numberlineMarkerPoint=point;
    marker.style.setProperty('--numberline-x',`${xFor(value)}px`);

    const stem=document.createElementNS('http://www.w3.org/2000/svg','line');
    stem.setAttribute('x1','0');
    stem.setAttribute('x2','0');
    stem.setAttribute('y1','50');
    stem.setAttribute('y2','93');
    stem.setAttribute('class','numberline-marker-stem');

    const circle=document.createElementNS('http://www.w3.org/2000/svg','circle');
    circle.setAttribute('cx','0');
    circle.setAttribute('cy','38');
    circle.setAttribute('r','18');
    circle.setAttribute('class','numberline-marker-dot');

    const markerText=document.createElementNS('http://www.w3.org/2000/svg','text');
    markerText.setAttribute('x','0');
    markerText.setAttribute('y','44');
    markerText.setAttribute('text-anchor','middle');
    markerText.setAttribute('class','numberline-marker-text');
    markerText.textContent=String(value);

    marker.append(stem,circle,markerText);
    marker.addEventListener('click',event=>{
      event.stopPropagation();
      selectPoint(point);
    });

    return marker;
  };

  const renderHops=(xFor)=>{
    if(valueB===null||valueA===valueB)return;

    const direction=valueB>valueA?1:-1;
    const hops=Math.abs(valueB-valueA);

    for(let i=0;i<hops;i++){
      const from=valueA+i*direction;
      const to=from+direction;
      const x1=xFor(from);
      const x2=xFor(to);
      const mid=(x1+x2)/2;

      const path=document.createElementNS('http://www.w3.org/2000/svg','path');
      path.setAttribute('d',`M ${x1} 101 Q ${mid} 63 ${x2} 101`);
      path.setAttribute('class','numberline-hop');
      path.style.setProperty('--hop-delay',`${i*70}ms`);
      svg.appendChild(path);

      const arrow=document.createElementNS('http://www.w3.org/2000/svg','path');
      arrow.setAttribute(
        'd',
        direction>0
          ?`M ${x2-8} 96 L ${x2} 101 L ${x2-8} 106`
          :`M ${x2+8} 96 L ${x2} 101 L ${x2+8} 106`
      );
      arrow.setAttribute('class','numberline-hop-arrow');
      arrow.style.setProperty('--hop-delay',`${i*70+110}ms`);
      svg.appendChild(arrow);
    }
  };

  const render=({fit=true,resetWidth=false}={})=>{
    if(fit)fitModuleToRange({resetWidth});

    svg.replaceChildren();

    const {spacing,left,right,totalWidth,xFor}=geometry();
    svg.setAttribute('viewBox',`0 0 ${totalWidth} 200`);
    svg.style.width=`${totalWidth}px`;
    svg.style.minWidth=`${totalWidth}px`;
    svg.style.maxWidth=`${totalWidth}px`;

    const line=document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1',String(left));
    line.setAttribute('x2',String(right));
    line.setAttribute('y1','105');
    line.setAttribute('y2','105');
    line.setAttribute('class','numberline-axis');
    svg.appendChild(line);

    const leftArrow=document.createElementNS('http://www.w3.org/2000/svg','path');
    leftArrow.setAttribute('d',`M ${left} 105 l 15 -9 v 18 z`);
    leftArrow.setAttribute('class','numberline-arrow');
    svg.appendChild(leftArrow);

    const rightArrow=document.createElementNS('http://www.w3.org/2000/svg','path');
    rightArrow.setAttribute('d',`M ${right} 105 l -15 -9 v 18 z`);
    rightArrow.setAttribute('class','numberline-arrow');
    svg.appendChild(rightArrow);

    renderHops(xFor);

    for(let n=start;n<=end;n++){
      const x=xFor(n);

      const tick=document.createElementNS('http://www.w3.org/2000/svg','line');
      tick.setAttribute('x1',String(x));
      tick.setAttribute('x2',String(x));
      tick.setAttribute('y1',n%5===0?'84':'91');
      tick.setAttribute('y2',n%5===0?'126':'119');
      tick.setAttribute('class','numberline-tick');
      tick.dataset.value=String(n);
      svg.appendChild(tick);

      const label=document.createElementNS('http://www.w3.org/2000/svg','text');
      label.setAttribute('x',String(x));
      label.setAttribute('y','158');
      label.setAttribute('text-anchor','middle');
      label.setAttribute('class','numberline-label');
      label.textContent=String(n);
      label.dataset.value=String(n);
      svg.appendChild(label);
    }

    svg.appendChild(makeMarker('a',valueA,xFor));
    if(valueB!==null)svg.appendChild(makeMarker('b',valueB,xFor));

    valueAEl.textContent=String(valueA);
    valueBEl.textContent=valueB===null?'':String(valueB);

    const bSelector=pointSelectors.find(button=>button.dataset.numberlinePointSelect==='b');
    if(bSelector)bSelector.hidden=valueB===null;

    pointSelectors.forEach(button=>{
      button.classList.toggle('is-active',button.dataset.numberlinePointSelect===activePoint);
    });

    secondPointButton.textContent=valueB===null?'+ Point':'Remove Point';

    if(valueB===null){
      hopCount.hidden=true;
      hopCount.textContent='';
    }else{
      const hops=Math.abs(valueB-valueA);
      hopCount.hidden=false;
      hopCount.textContent=`${hops} ${hops===1?'hop':'hops'}`;
    }

    const pointDescription=valueB===null
      ?`Point A is ${valueA}.`
      :`Point A is ${valueA}. Point B is ${valueB}. ${Math.abs(valueB-valueA)} hops between them.`;

    svg.setAttribute('aria-label',`Number line from ${start} to ${end}. ${pointDescription}`);
  };

  const moveActiveTo=next=>{
    const clamped=clampValue(Math.round(next));
    const current=activePoint==='b'?valueB:valueA;
    if(current===clamped)return;

    if(activePoint==='b'&&valueB!==null)valueB=clamped;
    else valueA=clamped;

    const readout=activePoint==='b'?valueBEl:valueAEl;
    readout.classList.remove('numberline-value-pop');
    void readout.offsetWidth;
    readout.classList.add('numberline-value-pop');

    render({fit:false});
  };

  svg.addEventListener('click',event=>{
    const marker=event.target.closest?.('[data-numberline-marker-point]');
    if(marker){
      selectPoint(marker.dataset.numberlineMarkerPoint);
      return;
    }

    const target=event.target.closest?.('[data-value]');
    if(target){
      moveActiveTo(Number(target.dataset.value));
      return;
    }

    const rect=svg.getBoundingClientRect();
    if(!rect.width)return;

    const {spacing}=geometry();
    const viewBox=svg.viewBox.baseVal;
    const x=((event.clientX-rect.left)/rect.width)*viewBox.width;
    const approx=start+(x-sidePadding)/spacing;
    moveActiveTo(Math.round(approx));
  });

  pointSelectors.forEach(button=>{
    button.addEventListener('click',()=>selectPoint(button.dataset.numberlinePointSelect));
  });

  stepButtons.forEach(button=>{
    button.addEventListener('click',()=>{
      const current=activePoint==='b'&&valueB!==null?valueB:valueA;
      moveActiveTo(current+Number(button.dataset.numberlineStep));
    });
  });

  secondPointButton.addEventListener('click',()=>{
    if(valueB===null){
      valueB=valueA<end?Math.min(end,valueA+5):Math.max(start,valueA-5);
      activePoint='b';
    }else{
      valueB=null;
      activePoint='a';
    }

    render({fit:false});
  });

  extendButtons.forEach(button=>{
    button.addEventListener('click',()=>{
      const nextStart=button.dataset.numberlineExtend==='left'?start-5:start;
      const nextEnd=button.dataset.numberlineExtend==='right'?end+5:end;

      const previousStart=start;
      const previousEnd=end;
      start=nextStart;
      end=nextEnd;

      const required=Math.ceil(geometry().totalWidth+36);
      if(required>BOARD_WIDTH-80){
        start=previousStart;
        end=previousEnd;
        return;
      }

      render();
    });
  });

  resetButton.addEventListener('click',()=>{
    start=defaultStart;
    end=defaultEnd;
    valueA=0;
    valueB=null;
    activePoint='a';
    m.style.minWidth='';
    m.style.width=`${defaultWidth}px`;
    render({fit:true,resetWidth:true});
  });

  m.addEventListener('pointerdown',event=>{
    if(!event.target.closest('button,input')){
      m.focus({preventScroll:true});
    }
  });

  m.addEventListener('keydown',event=>{
    if(event.target.closest('button,input'))return;

    const current=activePoint==='b'&&valueB!==null?valueB:valueA;

    if(event.key==='ArrowLeft'){
      event.preventDefault();
      moveActiveTo(current-1);
    }else if(event.key==='ArrowRight'){
      event.preventDefault();
      moveActiveTo(current+1);
    }
  });

  m.querySelector('.numberline-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.numberline-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.numberline-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));

  m._boardGetState=()=>({start,end,valueA,valueB,activePoint});
  m._boardSetState=state=>{
    if(!state)return;
    start=Number.isFinite(Number(state.start))?Number(state.start):defaultStart;
    end=Number.isFinite(Number(state.end))?Number(state.end):defaultEnd;
    if(end<=start)end=start+20;
    valueA=clampValue(Number.isFinite(Number(state.valueA))?Number(state.valueA):0);
    valueB=state.valueB===null||state.valueB===undefined?null:clampValue(Number(state.valueB));
    activePoint=state.activePoint==='b'&&valueB!==null?'b':'a';
    render({fit:true,resetWidth:false});
  };

  render({fit:true,resetWidth:true});
}
