(() => {
  'use strict';
  const assets='tiles/christmas-tree/assets/';
  let instance=0;
  const colors=['#d94d60','#e8b649','#84c6e1','#b58bd2','#ea9866','#87cfb0'];
  function number(value,min,max,fallback){return Number.isFinite(Number(value))?Math.max(min,Math.min(max,Number(value))):fallback;}
  function normalize(value={}){
    if(!value||typeof value!=='object')value={};
    return {mode:value.mode==='noise'?'noise':'timer',duration:number(value.duration,10,7200,300),threshold:number(value.threshold,10,95,45),sensitivity:number(value.sensitivity,50,200,100),elapsed:number(value.elapsed,0,7200,0),seed:Math.floor(number(value.seed,1,2147483647,1))};
  }
  function random(seed){let n=seed;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
  function decorations(seed){
    const rng=random(seed),items=[];
    // Reserve distinct bands for ornaments, lights, and tinsel instead of stacking them.
    const branches=[{y:235,left:525,right:525,count:1},{y:355,left:455,right:610,count:3},{y:550,left:440,right:620,count:3},{y:750,left:315,right:735,count:5},{y:890,left:370,right:735,count:4}];
    for(const branch of branches){
      for(let col=0;col<branch.count;col++)items.push({kind:'ornament',x:branch.left+col*(branch.right-branch.left)/Math.max(1,branch.count-1)+(rng()-.5)*12,y:branch.y+(rng()-.5)*8,color:Math.floor(rng()*colors.length),size:76+rng()*10});
    }
    const strings=[
      {kind:'lights',y:285,left:458,right:600,sag:20},
      {kind:'tinsel',y:415,left:414,right:635,sag:24},
      {kind:'lights',y:480,left:335,right:692,sag:20},
      {kind:'tinsel',y:615,left:320,right:707,sag:26},
      {kind:'lights',y:680,left:342,right:752,sag:22},
      {kind:'tinsel',y:810,left:161,right:850,sag:20}
    ];
    for(const string of strings){
      items.push({...string,x:string.left,width:(string.right-string.left)/2,color:Math.floor(rng()*colors.length),...(string.kind==='lights'?{colors:Array.from({length:string.right-string.left<200?5:9},()=>Math.floor(rng()*colors.length))}:{})});
    }
    // Each round is varied, but the topper is always the final reveal.
    for(let i=items.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[items[i],items[j]]=[items[j],items[i]];}
    items.push({kind:'star',x:525,y:95});return items;
  }
  function paint(tile,state){
    const id='tree-'+(++instance),items=decorations(state.seed),svg=tile.querySelector('.ct-art');
    svg.setAttribute('viewBox','112 25 776 1000');
    const filters=colors.map((hex,i)=>{const rgb=[1,3,5].map(offset=>parseInt(hex.slice(offset,offset+2),16)/255);return `<filter id="${id}-${i}" color-interpolation-filters="sRGB"><feColorMatrix values="${rgb[0]} 0 0 0 0 0 ${rgb[1]} 0 0 0 0 0 ${rgb[2]} 0 0 0 0 0 1 0"/></filter>`}).join('');
    svg.innerHTML=`<defs>${filters}<clipPath id="${id}-ball"><rect x="0" y="34" width="100" height="66"/></clipPath></defs><image href="${assets}tree.png" x="50" y="70" width="900" height="1000"/>`;
    // Reveal order is independent of paint order: strings always stay behind ornaments.
    const rear=document.createElementNS('http://www.w3.org/2000/svg','g');rear.classList.add('ct-strings-layer');
    const front=document.createElementNS('http://www.w3.org/2000/svg','g');front.classList.add('ct-ornaments-layer');
    svg.append(rear,front);
    const nodes=[];
    for(const [index,item] of items.entries()){
      const g=document.createElementNS('http://www.w3.org/2000/svg','g');g.classList.add('ct-decoration');g.dataset.kind=item.kind;
      const color=colors[item.color];
      if(item.kind==='ornament'){
        g.innerHTML=`<svg x="${item.x-item.size/2}" y="${item.y-item.size/2}" width="${item.size}" height="${item.size}" viewBox="0 0 100 100"><image href="${assets}ornament.png" width="100" height="100"/><g clip-path="url(#${id}-ball)" filter="url(#${id}-${item.color})"><image href="${assets}ornament.png" width="100" height="100"/></g></svg>`;
      }else if(item.kind==='tinsel'){
        const d=`M${item.x} ${item.y}Q${item.x+item.width} ${item.y+item.sag*2} ${item.x+item.width*2} ${item.y}`;
        const maskId=`${id}-tinsel-${index}`;
        g.innerHTML=`<defs><mask id="${maskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1100"><path class="ct-tinsel-reveal" d="${d}" pathLength="1" fill="none" stroke="white" stroke-width="24" stroke-linecap="round" stroke-dasharray="1"/></mask></defs><g mask="url(#${maskId})"><path d="${d}" fill="none" stroke="#fff0c5" stroke-width="14" stroke-linecap="round" stroke-dasharray="1 8"/><path d="${d}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#fff6dd" stroke-opacity=".6" stroke-width="3" stroke-dasharray="1 11"/></g>`;
      }else if(item.kind==='lights'){
        const d=`M${item.x} ${item.y}Q${item.x+item.width} ${item.y+item.sag*2} ${item.x+item.width*2} ${item.y}`;
        g.innerHTML=`<path class="ct-light-wire" d="${d}" pathLength="1" fill="none" stroke="#c4d4b2" stroke-opacity=".42" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="1"/>`;
        for(let i=0;i<item.colors.length;i++){
          const t=i/(item.colors.length-1),x=item.x+item.width*2*t,y=item.y+4*item.sag*t*(1-t),color=colors[item.colors[i]];
          g.innerHTML+=`<g class="ct-bulb" style="--light-delay:${i*75}ms"><path d="M${x} ${y}v6" stroke="#b4c6a7" stroke-opacity=".6" stroke-width="2"/><circle cx="${x}" cy="${y+11}" r="15" fill="${color}" opacity=".2"/><ellipse cx="${x}" cy="${y+11}" rx="6" ry="9" fill="${color}"/><ellipse cx="${x-1.5}" cy="${y+8}" rx="2" ry="3" fill="#fff8db"/></g>`;
        }
      }
      else g.innerHTML=`<image href="${assets}star.png" x="435" y="24" width="180" height="180"/>`;
      if(item.kind==='ornament'||item.kind==='star')g.innerHTML+=`<path class="ct-spark" d="M${item.x-28} ${item.y-24}v-16m-8 8h16M${item.x+31} ${item.y+10}v-12m-6 6h12" fill="none" stroke="#ffe8a3" stroke-width="4" stroke-linecap="round"/>`;
      (item.kind==='tinsel'||item.kind==='lights'?rear:front).append(g);
      nodes.push(g);
    }
    return nodes;
  }
  function setup(tile){
    let state=normalize({seed:1+Math.floor(Math.random()*2147483646)}),nodes=paint(tile,state),running=false,frame=0,last=0,lastRender=0,level=0,stream=null,context=null,analyser=null,pending=false,generation=0,disposed=false;
    const samples=new Uint8Array(1024),start=tile.querySelector('.ct-start'),status=tile.querySelector('.ct-status'),meter=tile.querySelector('.ct-meter'),readout=tile.querySelector('.ct-time');
    TeacherTilesSettings.ensure(tile);
    const settings=tile.querySelector('.tile-settings-panel'),controls=document.createElement('div');controls.className='ct-settings';
    controls.innerHTML='<label>Mode<select aria-label="Tree Mode"><option value="timer">Timer</option><option value="noise">Noise Meter</option></select></label><label>Time to Decorate (Minutes)<input class="ct-duration" type="number" min="0.167" max="120" step="0.5" value="5"></label><label class="ct-noise-setting">Quiet Threshold <output class="ct-threshold-value">45%</output><input class="ct-threshold" type="range" min="10" max="95" value="45"></label><label class="ct-noise-setting">Microphone Sensitivity<input class="ct-sensitivity" type="range" min="50" max="200" value="100"></label>';
    settings.append(controls);
    const mode=controls.querySelector('select'),duration=controls.querySelector('.ct-duration'),threshold=controls.querySelector('.ct-threshold'),sensitivity=controls.querySelector('.ct-sensitivity');
    function changed(){(tile._presentationChanged||window.notifyBoardChanged)?.('christmas-tree');}
    function update(animate=false){
      const progress=Math.min(1,state.elapsed/state.duration),count=Math.floor(progress*nodes.length);
      nodes.forEach((node,i)=>{
        const visible=i<count;
        if(animate&&visible&&!node.classList.contains('is-visible')){
          const animation=node.dataset.kind==='tinsel'?'ct-flow':node.dataset.kind==='lights'?'ct-light-sequence':'ct-pop';
          node.classList.add(animation);
        }
        node.classList.toggle('is-visible',visible);
      });
      tile.querySelector('.ct-art').style.setProperty('--tree-growth',String(.97+progress*.03));
      const seconds=Math.ceil(Math.max(0,state.duration-state.elapsed));readout.textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
      tile.querySelector('.ct-progress span').style.width=progress*100+'%';
      start.textContent=pending?'Connecting…':running?'Pause':progress>=1?'Decorated!':'Start';start.disabled=pending||progress>=1;
      meter.hidden=state.mode!=='noise';meter.querySelector('span').style.width=level+'%';meter.style.setProperty('--quiet-threshold',state.threshold+'%');
      tile.classList.toggle('ct-loud',running&&state.mode==='noise'&&level>=state.threshold);
      if(!pending){
        const message=progress>=1?'Ready for Christmas':running?(state.mode==='noise'?(level>=state.threshold?'Too loud · Decorating paused':'Quiet room · Decorating'):'Decorating…'):(state.mode==='noise'?'Ready to listen':'Ready to decorate');
        if(status.textContent!==message)status.textContent=message;
      }
    }
    function stop(){generation++;pending=false;running=false;cancelAnimationFrame(frame);stream?.getTracks().forEach(track=>track.stop());stream=null;if(context)context.close().catch(()=>{});context=analyser=null;level=0;update();}
    function tick(now){
      if(!running||!tile.isConnected){stop();return;}
      const delta=Math.min(.25,Math.max(0,(now-last)/1000));last=now;
      if(analyser){analyser.getByteTimeDomainData(samples);let sum=0;for(const sample of samples)sum+=((sample-128)/128)**2;const raw=Math.max(0,Math.min(100,(20*Math.log10(Math.sqrt(sum/samples.length)||.00001)+60)/60*state.sensitivity));level+=(raw-level)*.2;}
      if(state.mode==='timer'||level<state.threshold)state.elapsed=Math.min(state.duration,state.elapsed+delta);
      if(now-lastRender>=100||state.elapsed>=state.duration){update(true);lastRender=now;}
      if(state.elapsed>=state.duration){stop();launchConfetti(tile);playUiSfx('tile-effect',1,tile);playUiSfx('confetti-celebration',1,tile);changed();return;}
      frame=requestAnimationFrame(tick);
    }
    start.addEventListener('click',async()=>{
      if(running||pending){stop();changed();return;}
      const ticket=++generation;
      if(state.mode==='noise'){
        pending=true;update();status.textContent='Waiting for microphone…';let requested;
        try{
          requested=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:false,autoGainControl:false}});
          if(disposed||ticket!==generation||!tile.isConnected){requested.getTracks().forEach(track=>track.stop());return;}
          stream=requested;context=new(window.AudioContext||window.webkitAudioContext)();await context.resume();
          if(disposed||ticket!==generation)return;
          analyser=context.createAnalyser();analyser.fftSize=2048;context.createMediaStreamSource(stream).connect(analyser);level=state.threshold;
        }catch{requested?.getTracks().forEach(track=>track.stop());if(ticket!==generation)return;stop();status.textContent='Microphone unavailable · Check browser permissions';return;}
      }
      pending=false;running=true;last=performance.now();update();frame=requestAnimationFrame(tick);
    });
    tile.querySelector('.ct-reset').addEventListener('click',()=>{stop();state.elapsed=0;state.seed=1+Math.floor(Math.random()*2147483646);nodes=paint(tile,state);update();changed();});
    function syncSettings(){mode.value=state.mode;duration.value=Number((state.duration/60).toFixed(2));threshold.value=state.threshold;sensitivity.value=state.sensitivity;controls.querySelector('output').textContent=state.threshold+'%';controls.querySelectorAll('.ct-noise-setting').forEach(row=>row.hidden=state.mode!=='noise');}
    mode.onchange=()=>{stop();state.mode=mode.value;syncSettings();update();changed();};
    duration.onchange=()=>{stop();state.duration=number(Number(duration.value)*60,10,7200,300);state.elapsed=Math.min(state.elapsed,state.duration);syncSettings();update();changed();};
    threshold.oninput=()=>{state.threshold=Number(threshold.value);syncSettings();update();};threshold.onchange=changed;
    sensitivity.oninput=()=>state.sensitivity=Number(sensitivity.value);sensitivity.onchange=changed;
    const visibility=()=>{if(document.hidden){stop();changed();}};document.addEventListener('visibilitychange',visibility);
    tile._boardGetState=()=>({...state});
    tile._boardSetState=value=>{stop();state=normalize(value);state.elapsed=Math.min(state.elapsed,state.duration);nodes=paint(tile,state);syncSettings();update();};
    const deactivate=tile._deactivate,cleanup=tile._cleanup;
    tile._deactivate=()=>{stop();deactivate?.();};tile._cleanup=()=>{disposed=true;stop();document.removeEventListener('visibilitychange',visibility);cleanup?.();};
    syncSettings();update();
  }
  function preview(tile,value){const state=normalize(value),nodes=paint(tile,state),count=Math.floor(Math.min(1,state.elapsed/state.duration)*nodes.length);nodes.forEach((node,i)=>node.classList.toggle('is-visible',i<count));}
  window.TeacherTilesChristmasTree=Object.freeze({setup,preview,normalize,decorations});
})();
