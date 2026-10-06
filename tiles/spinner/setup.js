function setupSpinner(m){
  const canvas=m.querySelector('.spinner-canvas');
  const ctx=canvas.getContext('2d');
  const spinButton=m.querySelector('.spinner-spin-button');
  const winner=m.querySelector('.spinner-winner');
  const resultOverlay=m.querySelector('.spinner-result-overlay');
  const resultName=m.querySelector('.spinner-result-name');
  const spinAgainButton=m.querySelector('.spinner-spin-again');
  const confettiLayer=m.querySelector('.spinner-confetti-layer');
  const spinAudio=m.querySelector('.spinner-spin-audio');
  const input=m.querySelector('.spinner-name-input');
  const addButton=m.querySelector('.spinner-add-name');
  const list=m.querySelector('.spinner-name-list');
  const bgButton=m.querySelector('.spinner-bg');
  const fontButton=m.querySelector('.spinner-font');
  const settings=m.querySelector('.spinner-settings');
  const namesButton=document.createElement('button');
  namesButton.type='button';namesButton.className='spinner-names-toggle';
  namesButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/></svg><span>Names</span>';
  namesButton.setAttribute('aria-label','Edit Spinner Names');
  namesButton.setAttribute('aria-expanded','false');
  const drawerTitle=document.createElement('strong');drawerTitle.className='spinner-drawer-title';drawerTitle.textContent='Spinner Names';
  settings.prepend(drawerTitle);settings.hidden=true;
  m.append(namesButton,settings);
  function closeNames(){
    if(settings.contains(document.activeElement))document.activeElement.blur();
    settings.hidden=true;namesButton.setAttribute('aria-expanded','false');
  }
  namesButton.addEventListener('click',event=>{
    event.stopPropagation();
    if(!settings.hidden){closeNames();return}
    settings.hidden=false;namesButton.setAttribute('aria-expanded','true');input.focus({preventScroll:true});
  });
  const outsideNames=event=>{if(!m.contains(event.target))closeNames()};
  const escapeNames=event=>{if(event.key==='Escape'&&!settings.hidden){event.stopPropagation();closeNames();namesButton.focus({preventScroll:true})}};
  document.addEventListener('pointerdown',outsideNames);
  settings.addEventListener('keydown',escapeNames);
  settings.addEventListener('wheel',event=>{if(!event.ctrlKey)event.stopPropagation()},{passive:true});
  m.addEventListener('pointerleave',closeNames);

  let names=['Alex','Jordan','Taylor','Morgan'];
  let rotation=0;
  let spinning=false;
  let raf=0;
  let winnerVisible=false;
  let spinGeneration=0,cancelMetadata=null;

  const syncSpinnerAudio=()=>{
    spinAudio.volume=clamp(.62*tileAudioLevel(m),0,1);
    if(spinAudio.volume<=0&&!spinAudio.paused)spinAudio.pause();
  };
  m.addEventListener('teachertiles:tileaudiochange',syncSpinnerAudio);
  window.addEventListener('teachertiles:audiopreferenceschange',syncSpinnerAudio);
  syncSpinnerAudio();

  const palette=[
    ['#bcdcff','#91bdf5'],['#ffdad1','#f7a999'],['#fff0ba','#f1d17b'],['#c8eadb','#94cfb6'],
    ['#e1d4ff','#bfa6ed'],['#ffdae8','#eeacc5'],['#c7ecf1','#91cbd5'],['#e4edc0','#bed18e']
  ];

  const getWheelFont=()=>{
    const family=getComputedStyle(m).getPropertyValue('--module-font').trim();
    return family||'Inter,system-ui,sans-serif';
  };

  function renderNameList(){
    namesButton.querySelector('span').textContent=`Names · ${names.length}`;
    list.replaceChildren();
    names.forEach((name,i)=>{
      const chip=document.createElement('div');
      chip.className='spinner-name-chip';
      const text=document.createElement('span');
      text.textContent=name;
      const remove=document.createElement('button');
      remove.type='button';
      remove.setAttribute('aria-label',`Remove ${name}`);
      remove.textContent='×';
      remove.addEventListener('click',()=>{
        if(spinning)return;
        names.splice(i,1);
        renderNameList();
        drawWheel();
        winner.textContent=names.length?'CLICK TO SPIN':'ADD NAMES';
        notifyBoardChanged('spinner-names');
      });
      chip.append(text,remove);
      list.append(chip);
    });
  }

  function drawWheel(){
    const dpr=Math.min(2,Math.max(1,window.devicePixelRatio||1));
    const size=560;
    const wheelWrap=canvas.parentElement;
    const displaySize=Math.max(1,Math.min(wheelWrap.clientWidth,wheelWrap.clientHeight));
    m.style.setProperty('--spinner-wheel-size',`${displaySize}px`);
    m.style.setProperty('--spinner-wheel-radius',`${displaySize/2}px`);
    const resolution=Math.min(2048,Math.max(560,Math.round(displaySize*dpr)));
    if(canvas.width!==resolution||canvas.height!==resolution){
      canvas.width=resolution;
      canvas.height=resolution;
      canvas.style.aspectRatio='1';
    }
    ctx.setTransform(resolution/size,0,0,resolution/size,0,0);
    ctx.clearRect(0,0,size,size);

    const cx=size/2,cy=size/2,r=268;
    ctx.save();
    ctx.translate(cx,cy);
    ctx.rotate(rotation);

    if(!names.length){
      ctx.beginPath();
      ctx.arc(0,0,r,0,Math.PI*2);
      ctx.fillStyle='#ececef';
      ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,.12)';
      ctx.lineWidth=3;
      ctx.stroke();
      ctx.restore();
      return;
    }

    const arc=Math.PI*2/names.length;
    const wheelFont=getWheelFont();
    const labelStart=68;
    const labelEnd=r-16;
    const labelWidth=labelEnd-labelStart;

    const fitLabel=(name,maxFont)=>{
      const clean=String(name).trim()||'—';
      let lines=[clean];
      const words=clean.split(/\s+/);
      if(words.length>1){
        let best=[clean];
        let bestBalance=Infinity;
        for(let split=1;split<words.length;split++){
          const candidate=[words.slice(0,split).join(' '),words.slice(split).join(' ')];
          const balance=Math.max(...candidate.map(line=>line.length));
          if(balance<bestBalance){best=candidate;bestBalance=balance;}
        }
        lines=best;
      }
      let fontSize=maxFont;
      const fits=()=>{
        ctx.font=`700 ${fontSize}px ${wheelFont}`;
        return lines.every(line=>ctx.measureText(line).width<=labelWidth);
      };
      while(fontSize>7&&!fits())fontSize-=.5;
      if(!fits()&&lines.length===1&&clean.length>1){
        const split=Math.ceil(clean.length/2);
        lines=[clean.slice(0,split),clean.slice(split)];
        fontSize=maxFont;
        while(fontSize>7&&!fits())fontSize-=.5;
      }
      return{lines,fontSize};
    };

    names.forEach((name,i)=>{
      const start=-Math.PI/2+i*arc;
      const end=start+arc;
      const middle=start+arc/2;

      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.arc(0,0,r,start,end);
      ctx.closePath();
      const [innerColor,outerColor]=palette[i%palette.length];
      const fill=ctx.createRadialGradient(0,0,r*.08,0,0,r);
      fill.addColorStop(0,innerColor);
      fill.addColorStop(1,outerColor);
      ctx.fillStyle=fill;
      ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,.82)';
      ctx.lineWidth=2.5;
      ctx.stroke();

      ctx.save();
      ctx.rotate(middle);
      const upsideDown=Math.cos(middle)<0;
      if(upsideDown)ctx.rotate(Math.PI);
      const labelCenter=(labelStart+labelEnd)/2;
      ctx.translate(upsideDown?-labelCenter:labelCenter,0);
      ctx.fillStyle='#243348';
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      const maxFont=Math.max(10,Math.min(25,arc*112*.72));
      const fitted=fitLabel(name,maxFont);
      ctx.font=`700 ${fitted.fontSize}px ${wheelFont}`;
      ctx.lineJoin='round';
      ctx.shadowColor='rgba(255,255,255,.45)';
      ctx.shadowOffsetY=1;
      const lineHeight=fitted.fontSize*1.08;
      fitted.lines.forEach((line,lineIndex)=>{
        const y=(lineIndex-(fitted.lines.length-1)/2)*lineHeight;
        ctx.fillText(line,0,y);
      });
      ctx.restore();
    });

    ctx.beginPath();
    ctx.arc(0,0,r,0,Math.PI*2);
    ctx.strokeStyle='#fff';
    ctx.lineWidth=9;
    ctx.stroke();
    ctx.beginPath();ctx.arc(0,0,r-6,0,Math.PI*2);
    ctx.strokeStyle='rgba(35,52,77,.13)';ctx.lineWidth=1.5;ctx.stroke();

    ctx.beginPath();
    ctx.arc(0,0,56,0,Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,.2)';
    ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.72)';
    ctx.lineWidth=3;
    ctx.stroke();
    ctx.restore();
  }

  function addName(){
    const value=input.value.trim();
    if(!value||spinning)return;
    names.push(value);
    input.value='';
    renderNameList();
    drawWheel();
    winner.textContent='CLICK TO SPIN';
    input.focus({preventScroll:true});
    notifyBoardChanged('spinner-names');
  }

  function fireSpinnerConfetti(){
    confettiLayer.replaceChildren();
    const colors=['#ff6b7a','#ffd34e','#69c6ff','#7edc8b','#9d7cff','#ff9c5a'];
    for(let i=0;i<66;i++){
      const p=document.createElement('i');
      p.className='spinner-confetti-piece';
      const a=Math.random()*Math.PI*2;
      const d=110+Math.random()*250;
      p.style.setProperty('--x',`${Math.cos(a)*d}px`);
      p.style.setProperty('--y',`${Math.sin(a)*d+65}px`);
      p.style.setProperty('--r',`${Math.round(Math.random()*900-450)}deg`);
      p.style.setProperty('--confetti',colors[i%colors.length]);
      p.style.width=`${5+Math.random()*6}px`;
      p.style.height=`${7+Math.random()*9}px`;
      p.style.animationDelay=`${Math.random()*.1}s`;
      confettiLayer.append(p);
    }
    setTimeout(()=>confettiLayer.replaceChildren(),1550);
  }

  function dismissWinner(){
    if(!winnerVisible)return;
    winnerVisible=false;
    resultOverlay.classList.remove('is-visible');
    resultOverlay.hidden=true;
    winner.textContent=names.length?'CLICK TO SPIN':'ADD NAMES';
  }

  function showWinner(name){
    if(!m.isConnected)return;
    winnerVisible=true;
    winner.textContent=name;
    resultName.textContent=name;
    resultOverlay.hidden=false;
    resultOverlay.classList.remove('is-visible');
    void resultOverlay.offsetWidth;
    resultOverlay.classList.add('is-visible');

    m.classList.remove('spinner-pop');
    void m.offsetWidth;
    m.classList.add('spinner-pop');

    fireSpinnerConfetti();
    playUiSfx('confetti',1,m);
    playUiSfx('timer-tada',1,m);
  }

  async function spin(){
    if(!m.isConnected||spinning||winnerVisible||names.length<1)return;
    const generation=++spinGeneration;
    closeNames();

    spinning=true;
    m.classList.add('is-spinning');
    spinButton.disabled=true;
    winner.textContent='SPINNING…';

    resultOverlay.classList.remove('is-visible');
    resultOverlay.hidden=true;

    const arc=Math.PI*2/names.length;

    // Choose a target segment, but stop inside its safe center zone rather than on an edge.
    const targetIndex=Math.floor(Math.random()*names.length);
    const safety=arc*.18;
    const jitterRange=Math.max(0,arc/2-safety);
    const centerJitter=(Math.random()*2-1)*jitterRange*.55;

    // Segments are drawn starting at -PI/2 before wheel rotation.
    // The fixed pointer is at -PI/2, so solve the final rotation that places
    // the selected segment's interior point directly beneath the pointer.
    const targetLocalAngle=-Math.PI/2+(targetIndex+.5)*arc+centerJitter;
    const desiredRotation=-Math.PI/2-targetLocalAngle;

    const tau=Math.PI*2;
    const currentNorm=((rotation%tau)+tau)%tau;
    const desiredNorm=((desiredRotation%tau)+tau)%tau;

    let delta=desiredNorm-currentNorm;
    if(delta<0)delta+=tau;

    const turns=5+Math.floor(Math.random()*3);
    const total=turns*tau+delta;
    const startRotation=rotation;

    spinAudio.pause();
    spinAudio.currentTime=0;

    if(!Number.isFinite(spinAudio.duration)||spinAudio.duration<=0){
      await new Promise(resolve=>{
        const done=()=>{clearTimeout(timeout);spinAudio.removeEventListener('loadedmetadata',done);spinAudio.removeEventListener('error',done);cancelMetadata=null;resolve()};
        const timeout=setTimeout(done,2000);cancelMetadata=done;
        spinAudio.addEventListener('error',done,{once:true});
        spinAudio.addEventListener('loadedmetadata',done,{once:true});
        spinAudio.load();
      });
    }

    if(generation!==spinGeneration||!m.isConnected)return;
    const duration=Math.max(600,(Number.isFinite(spinAudio.duration)?spinAudio.duration:3.683)*1000);
    const start=performance.now();
    const ease=t=>1-Math.pow(1-t,4);

    syncSpinnerAudio();
    if(spinAudio.volume>0)spinAudio.play().catch(()=>{});

    cancelAnimationFrame(raf);
    const tick=now=>{
      if(generation!==spinGeneration||!m.isConnected)return;
      const t=Math.min(1,(now-start)/duration);
      rotation=startRotation+total*ease(t);
      drawWheel();

      if(t<1){
        raf=requestAnimationFrame(tick);
      }else{
        rotation=startRotation+total;
        drawWheel();

        spinning=false;
        m.classList.remove('is-spinning');
        spinButton.disabled=false;

        if(!spinAudio.paused){
          spinAudio.pause();
          spinAudio.currentTime=spinAudio.duration||0;
        }

        // Determine the actual winning segment from the wheel's final physical
        // position under the fixed pointer. This guarantees popup = landed tile.
        const finalNorm=((rotation%tau)+tau)%tau;
        const pointerLocal=(((-Math.PI/2-finalNorm)+tau)%tau);
        const segmentIndex=Math.floor(((pointerLocal+Math.PI/2+tau)%tau)/arc)%names.length;

        showWinner(names[segmentIndex]);
      }
    };

    raf=requestAnimationFrame(tick);
  }

  bgButton.addEventListener('click',()=>{
    cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']);
  });

  fontButton.addEventListener('click',()=>{
    cycleData(m,'font',FONT_OPTIONS);
    requestAnimationFrame(drawWheel);
  });

  addButton.addEventListener('click',addName);
  input.addEventListener('keydown',e=>{
    if(e.key==='Enter'){
      e.preventDefault();
      addName();
    }
  });

  spinButton.addEventListener('click',e=>{
    e.stopPropagation();
    spin();
  });

  spinAgainButton?.addEventListener('click',e=>{
    e.preventDefault();
    e.stopPropagation();
    dismissWinner();
    spin();
  });

  canvas.addEventListener('click',e=>{
    e.stopPropagation();
    spin();
  });

  m.addEventListener('click',e=>{
    if(!winnerVisible)return;
    if(e.target.closest('.module-delete,.spinner-customization,.spinner-settings,.spinner-names-toggle,.resize-handle'))return;
    dismissWinner();
  });

  const ro=new ResizeObserver(()=>drawWheel());
  ro.observe(m);
  ro.observe(canvas.parentElement);
  const refreshWheelLayout=()=>requestAnimationFrame(drawWheel);
  m.addEventListener('pointerenter',refreshWheelLayout);
  m.addEventListener('pointerleave',refreshWheelLayout);

  renderNameList();
  drawWheel();

  const detachRosterLoader=attachClassRosterLoader(input.closest('.spinner-name-entry'),rosterNames=>{
    if(spinning)return;
    names=normalizeRosterNames(rosterNames);
    notifyBoardChanged('spinner-names');
    dismissWinner();
    renderNameList();
    drawWheel();
    winner.textContent=names.length?'CLICK TO SPIN':'ADD NAMES';
  });

  m._boardGetState=()=>({names:[...names],rotation});
  m._boardSetState=state=>{
    if(!state)return;
    names=Array.isArray(state.names)?state.names.map(String):[];
    rotation=Number(state.rotation)||0;
    spinning=false;
    dismissWinner();
    renderNameList();
    drawWheel();
    winner.textContent=names.length?'CLICK TO SPIN':'ADD NAMES';
  };

  const priorDeactivate=m._deactivate;
  m._deactivate=()=>{
    closeNames();
    spinGeneration++;cancelMetadata?.();cancelAnimationFrame(raf);spinning=false;
    spinAudio.pause();spinAudio.currentTime=0;spinButton.disabled=false;m.classList.remove('is-spinning');
    dismissWinner();winner.textContent=names.length?'CLICK TO SPIN':'ADD NAMES';priorDeactivate?.();
  };
  const prior=m._cleanup;
  m._cleanup=()=>{
    m._deactivate();prior?.();
    document.removeEventListener('pointerdown',outsideNames);
    m.removeEventListener('pointerleave',closeNames);
    detachRosterLoader();
    cancelAnimationFrame(raf);
    ro.disconnect();
    m.removeEventListener('pointerenter',refreshWheelLayout);
    m.removeEventListener('pointerleave',refreshWheelLayout);
    m.removeEventListener('teachertiles:tileaudiochange',syncSpinnerAudio);
    window.removeEventListener('teachertiles:audiopreferenceschange',syncSpinnerAudio);
    spinAudio.pause();
    spinAudio.currentTime=0;
  };
}
