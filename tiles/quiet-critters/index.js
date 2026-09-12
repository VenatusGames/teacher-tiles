(() => {
  'use strict';

  const BASE='tiles/quiet-critters/assets';
  const SCENERY={
    tree:`${BASE}/scenery/tree.png`,
    stump:`${BASE}/scenery/stump.png`,
    mushrooms:[
      `${BASE}/scenery/mushroom-blue.png`,
      `${BASE}/scenery/mushroom-gold.png`,
      `${BASE}/scenery/mushroom-green.png`
    ]
  };
  const FRAMES={
    arms:[1,2,3,4].map(n=>`${BASE}/critters/armsway-${n}.png`),
    blink:[1,2].map(n=>`${BASE}/critters/blink-${n}.png`),
    dance:[1,2,3].map(n=>`${BASE}/critters/dance-${n}.png`),
    drowsy:`${BASE}/critters/drowsy.png`,
    happy:`${BASE}/critters/happy.png`,
    happy2:`${BASE}/critters/happy-2.png`,
    jump:[1,2,3].map(n=>`${BASE}/critters/jump-${n}.png`),
    sleep:[1,2].map(n=>`${BASE}/critters/sleep-${n}.png`)
  };
  const ALL_FRAMES=[
    ...FRAMES.arms,...FRAMES.blink,...FRAMES.dance,FRAMES.drowsy,FRAMES.happy,FRAMES.happy2,...FRAMES.jump,...FRAMES.sleep
  ];
  const COLORS=[
    {id:'lavender',hex:'#9f87ea'},
    {id:'blue',hex:'#6baee8'},
    {id:'mint',hex:'#74c7a4'},
    {id:'rose',hex:'#df8fb4'},
    {id:'amber',hex:'#dfa95e'},
    {id:'moss',hex:'#8fb66d'},
    {id:'sky',hex:'#79c8d9'}
  ];
  const MAX_CRITTERS=5;
  const RENDER_SIZE=256;
  const imageCache=new Map();
  const tintedCache=new Map();

  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const random=(min,max)=>min+Math.random()*(max-min);
  const pick=list=>list[Math.floor(Math.random()*list.length)];

  function imageFor(src){
    if(imageCache.has(src))return imageCache.get(src);
    const image=new Image();
    image.decoding='async';
    image.src=src;
    imageCache.set(src,image);
    return image;
  }

  [...ALL_FRAMES,SCENERY.tree,SCENERY.stump,...SCENERY.mushrooms].forEach(imageFor);

  function hexToRgb(hex){
    const value=String(hex).replace('#','');
    return{
      r:parseInt(value.slice(0,2),16),
      g:parseInt(value.slice(2,4),16),
      b:parseInt(value.slice(4,6),16)
    };
  }

  function tintedFrame(src,color){
    const key=`${src}|${color.hex}`;
    if(tintedCache.has(key))return tintedCache.get(key);
    const image=imageFor(src);
    if(!image.complete||!image.naturalWidth)return null;
    const canvas=document.createElement('canvas');
    canvas.width=RENDER_SIZE;
    canvas.height=RENDER_SIZE;
    const context=canvas.getContext('2d',{willReadFrequently:true});
    context.imageSmoothingEnabled=true;
    context.imageSmoothingQuality='high';
    context.clearRect(0,0,RENDER_SIZE,RENDER_SIZE);
    context.drawImage(image,0,0,RENDER_SIZE,RENDER_SIZE);
    const pixels=context.getImageData(0,0,RENDER_SIZE,RENDER_SIZE);
    const data=pixels.data;
    const target=hexToRgb(color.hex);
    const targetLuminance=Math.max(1,.2126*target.r+.7152*target.g+.0722*target.b);
    for(let index=0;index<data.length;index+=4){
      if(data[index+3]===0)continue;
      const r=data[index],g=data[index+1],b=data[index+2];
      const luminance=.2126*r+.7152*g+.0722*b;
      // Preserve the critter's white eye areas and black pupils/linework.
      if(luminance>=232||luminance<=48)continue;
      const scale=luminance/targetLuminance;
      const tintedR=clamp(target.r*scale,0,255);
      const tintedG=clamp(target.g*scale,0,255);
      const tintedB=clamp(target.b*scale,0,255);
      const mix=.92;
      data[index]=Math.round(r*(1-mix)+tintedR*mix);
      data[index+1]=Math.round(g*(1-mix)+tintedG*mix);
      data[index+2]=Math.round(b*(1-mix)+tintedB*mix);
    }
    context.putImageData(pixels,0,0);
    tintedCache.set(key,canvas);
    return canvas;
  }

  function setup(moduleElement){
    const stage=moduleElement.querySelector('.quietcritters-stage');
    const treeLayer=moduleElement.querySelector('.quietcritters-trees');
    const propLayer=moduleElement.querySelector('.quietcritters-props');
    const fairyLayer=moduleElement.querySelector('.quietcritters-fairies');
    const critterLayer=moduleElement.querySelector('.quietcritters-critters');
    const poofLayer=moduleElement.querySelector('.quietcritters-poofs');
    const stateBadge=moduleElement.querySelector('.quietcritters-state');
    const status=moduleElement.querySelector('.quietcritters-status');
    const stageMessage=moduleElement.querySelector('.quietcritters-stage-message');
    const levelFill=moduleElement.querySelector('.quietcritters-level-fill');
    const thresholdMarker=moduleElement.querySelector('.quietcritters-threshold-marker');
    const micButton=moduleElement.querySelector('.quietcritters-mic');
    const thresholdInput=moduleElement.querySelector('.quietcritters-threshold');
    const thresholdValue=moduleElement.querySelector('.quietcritters-threshold-value');
    const sensitivityInput=moduleElement.querySelector('.quietcritters-sensitivity');
    const sensitivityValue=moduleElement.querySelector('.quietcritters-sensitivity-value');

    let critters=[];
    let active=false;
    let pending=false;
    let disposed=false;
    let stream=null;
    let audioContext=null;
    let analyser=null;
    let samples=null;
    let requestToken=0;
    let animationFrame=0;
    let lastFrameTime=0;
    let level=0;
    let loudRun=0;
    let quietCharge=0;
    let calmTime=0;
    let returnCooldown=0;
    let nextInvite=random(2.4,4.2);

    function notify(reason){window.notifyBoardChanged?.(`quiet-critters-${reason}`)}
    function threshold(){return clamp(Number(thresholdInput.value)||45,15,85)}
    function sensitivity(){return clamp(Number(sensitivityInput.value)||100,30,200)}
    function say(text){if(status.textContent!==text)status.textContent=text}

    function setBadge(text,tone='neutral'){
      if(stateBadge.textContent!==text)stateBadge.textContent=text;
      stateBadge.dataset.tone=tone;
    }

    function randomizeForest(){
      treeLayer.replaceChildren();
      propLayer.replaceChildren();
      fairyLayer.replaceChildren();

      const treeCount=3+Math.floor(Math.random()*2);
      const slots=Array.from({length:treeCount},(_,index)=>(index+.5)/treeCount);
      slots.forEach((slot,index)=>{
        const image=document.createElement('img');
        image.className='quietcritters-tree';
        image.src=SCENERY.tree;
        image.alt='';
        image.draggable=false;
        const x=clamp((slot+random(-.11,.11))*100,5,95);
        image.style.left=`${x.toFixed(2)}%`;
        image.style.setProperty('--scale',random(.72,1.15).toFixed(3));
        image.style.setProperty('--opacity',random(.24,.46).toFixed(3));
        image.style.zIndex=String(index%2);
        treeLayer.appendChild(image);
      });

      const stump=document.createElement('img');
      stump.className='quietcritters-prop quietcritters-prop--stump';
      stump.src=SCENERY.stump;
      stump.alt='';
      stump.draggable=false;
      stump.style.setProperty('--left',`${random(24,76).toFixed(2)}%`);
      stump.style.setProperty('--bottom',`${random(-5,2).toFixed(2)}%`);
      stump.style.setProperty('--width',`${random(76,106).toFixed(1)}px`);
      stump.style.setProperty('--scale',random(.86,1.12).toFixed(3));
      propLayer.appendChild(stump);

      const mushroomCount=4+Math.floor(Math.random()*4);
      for(let index=0;index<mushroomCount;index+=1){
        const image=document.createElement('img');
        image.className='quietcritters-prop quietcritters-prop--mushroom';
        image.src=pick(SCENERY.mushrooms);
        image.alt='';
        image.draggable=false;
        image.style.setProperty('--left',`${random(5,95).toFixed(2)}%`);
        image.style.setProperty('--bottom',`${random(-7,7).toFixed(2)}%`);
        image.style.setProperty('--width',`${random(46,76).toFixed(1)}px`);
        image.style.setProperty('--scale',random(.66,1.02).toFixed(3));
        image.style.zIndex=String(2+Math.floor(random(0,3)));
        propLayer.appendChild(image);
      }

      const fairyCount=16+Math.floor(Math.random()*8);
      for(let index=0;index<fairyCount;index+=1){
        const fairy=document.createElement('span');
        fairy.className='quietcritters-fairy';
        fairy.style.setProperty('--x',`${random(3,97).toFixed(2)}%`);
        fairy.style.setProperty('--y',`${random(5,80).toFixed(2)}%`);
        fairy.style.setProperty('--size',`${random(2.2,5.1).toFixed(2)}px`);
        fairy.style.setProperty('--duration',`${random(3.8,7.8).toFixed(2)}s`);
        fairy.style.setProperty('--delay',`${random(-7,0).toFixed(2)}s`);
        fairy.style.setProperty('--drift-x',`${random(-19,19).toFixed(1)}px`);
        fairy.style.setProperty('--drift-y',`${random(-18,12).toFixed(1)}px`);
        fairyLayer.appendChild(fairy);
      }
    }

    function chooseColor(){
      const activeIds=new Set(critters.map(critter=>critter.color.id));
      const available=COLORS.filter(color=>!activeIds.has(color.id));
      return pick(available.length?available:COLORS);
    }

    function choosePosition(){
      for(let attempt=0;attempt<40;attempt+=1){
        const candidate={x:random(15,85),y:random(66,82)};
        if(critters.every(critter=>Math.hypot(candidate.x-critter.x,(candidate.y-critter.y)*1.35)>19))return candidate;
      }
      return{x:random(16,84),y:random(67,82)};
    }

    function burst(x,y,color,large=false){
      const ring=document.createElement('span');
      ring.className='quietcritters-poof-ring';
      ring.style.setProperty('--x',`${x}%`);
      ring.style.setProperty('--y',`${y}%`);
      ring.style.setProperty('--poof-color',color.hex);
      poofLayer.appendChild(ring);
      setTimeout(()=>ring.remove(),760);
      const amount=large?20:15;
      for(let index=0;index<amount;index+=1){
        const particle=document.createElement('span');
        particle.className=`quietcritters-poof-particle${index%5===0?' is-star':''}`;
        if(index%5===0)particle.textContent=index%10===0?'✦':'✧';
        const angle=random(0,Math.PI*2);
        const distance=random(18,large?62:48);
        particle.style.setProperty('--x',`${x}%`);
        particle.style.setProperty('--y',`${y}%`);
        particle.style.setProperty('--dx',`${(Math.cos(angle)*distance).toFixed(1)}px`);
        particle.style.setProperty('--dy',`${(Math.sin(angle)*distance).toFixed(1)}px`);
        particle.style.setProperty('--p-size',`${random(index%5===0?7:3,index%5===0?12:7).toFixed(1)}px`);
        particle.style.setProperty('--poof-color',color.hex);
        poofLayer.appendChild(particle);
        setTimeout(()=>particle.remove(),820);
      }
    }

    function sequenceFor(name){
      switch(name){
        case 'blink':return{frames:[FRAMES.happy,FRAMES.blink[0],FRAMES.blink[1],FRAMES.blink[0],FRAMES.happy],step:.105,duration:.58};
        case 'sway':return{frames:[FRAMES.arms[0],FRAMES.arms[1],FRAMES.arms[2],FRAMES.arms[3],FRAMES.arms[2],FRAMES.arms[1]],step:.24,duration:2.9};
        case 'dance':return{frames:[FRAMES.dance[0],FRAMES.dance[1],FRAMES.dance[2],FRAMES.dance[1]],step:.17,duration:2.45};
        case 'jump':return{frames:[FRAMES.jump[0],FRAMES.jump[1],FRAMES.jump[2],FRAMES.jump[1],FRAMES.jump[0]],step:.14,duration:1.55};
        case 'drowsy':return{frames:[FRAMES.drowsy],step:.7,duration:1.45,next:'sleep'};
        case 'sleep':return{frames:[FRAMES.sleep[0],FRAMES.sleep[1]],step:.68,duration:random(4.2,7.4)};
        case 'happy':return{frames:[FRAMES.happy,FRAMES.happy2,FRAMES.happy],step:.46,duration:random(1.5,2.6)};
        default:return{frames:[FRAMES.happy],step:.7,duration:random(1.7,3.0)};
      }
    }

    function chooseBehavior(critter,now){
      if(critter.followUp){
        const next=critter.followUp;
        critter.followUp='';
        setBehavior(critter,next,now);
        return;
      }
      const roll=Math.random();
      let behavior='idle';
      if(calmTime>22&&roll<.11)behavior='drowsy';
      else if(roll<.28)behavior='sway';
      else if(roll<.49)behavior='dance';
      else if(roll<.65)behavior='jump';
      else if(roll<.82)behavior='blink';
      else behavior='happy';
      setBehavior(critter,behavior,now);
    }

    function setBehavior(critter,name,now=performance.now()/1000){
      const sequence=sequenceFor(name);
      critter.behavior=name;
      critter.frames=sequence.frames;
      critter.frameStep=sequence.step;
      critter.frameIndex=0;
      critter.nextFrame=now;
      critter.behaviorEnds=now+sequence.duration;
      critter.followUp=sequence.next||'';
      critter.element.dataset.behavior=name;
      drawCritter(critter,critter.frames[0]);
    }

    function drawCritter(critter,src){
      if(critter.lastFrame===src)return;
      const tinted=tintedFrame(src,critter.color);
      if(!tinted)return;
      critter.lastFrame=src;
      const context=critter.context;
      context.clearRect(0,0,RENDER_SIZE,RENDER_SIZE);
      context.imageSmoothingEnabled=true;
      context.imageSmoothingQuality='high';
      context.drawImage(tinted,0,0,RENDER_SIZE,RENDER_SIZE);
    }

    function spawnCritter(){
      if(critters.length>=MAX_CRITTERS)return;
      const position=choosePosition();
      const color=chooseColor();
      const element=document.createElement('div');
      element.className='quietcritters-actor is-entering';
      element.style.setProperty('--x',`${position.x.toFixed(2)}%`);
      element.style.setProperty('--y',`${position.y.toFixed(2)}%`);
      element.style.setProperty('--size',`${random(102,132).toFixed(1)}px`);
      const canvas=document.createElement('canvas');
      canvas.width=RENDER_SIZE;
      canvas.height=RENDER_SIZE;
      canvas.setAttribute('aria-hidden','true');
      element.appendChild(canvas);
      critterLayer.appendChild(element);
      const critter={
        element,canvas,context:canvas.getContext('2d'),color,
        x:position.x,y:position.y,behavior:'idle',frames:[FRAMES.happy],frameStep:.7,frameIndex:0,nextFrame:0,behaviorEnds:0,followUp:'',lastFrame:''
      };
      critters.push(critter);
      setBehavior(critter,Math.random()<.58?'happy':'sway');
      burst(position.x,position.y,color,true);
      setTimeout(()=>element.classList.remove('is-entering'),520);
      say(`${critters.length} quiet ${critters.length===1?'critter is':'critters are'} visiting the forest.`);
    }

    function dismissCritter(critter){
      if(!critter||critter.leaving)return;
      critter.leaving=true;
      critter.element.classList.add('is-leaving');
      burst(critter.x,critter.y,critter.color,true);
      setTimeout(()=>{
        critter.element.remove();
        critters=critters.filter(item=>item!==critter);
      },430);
    }

    function dismissAll(){
      critters.slice().forEach(dismissCritter);
    }

    function updateCritters(now){
      for(const critter of critters){
        if(critter.leaving)continue;
        if(now>=critter.behaviorEnds){
          chooseBehavior(critter,now);
          continue;
        }
        if(now>=critter.nextFrame){
          const frames=critter.frames;
          critter.frameIndex=(critter.frameIndex+1)%frames.length;
          drawCritter(critter,frames[critter.frameIndex]);
          critter.nextFrame=now+critter.frameStep;
        }else if(!critter.lastFrame){
          drawCritter(critter,critter.frames[critter.frameIndex]||FRAMES.happy);
        }
      }
    }

    function updateSettings(notifyChange=true){
      thresholdInput.value=String(threshold());
      sensitivityInput.value=String(sensitivity());
      thresholdValue.textContent=`${Math.round(threshold())}%`;
      sensitivityValue.textContent=`${Math.round(sensitivity())}%`;
      thresholdMarker.style.left=`${threshold().toFixed(2)}%`;
      if(notifyChange)notify('settings');
    }

    function stopMicrophone(message='Microphone off · Enable it to invite quiet critters.'){
      requestToken+=1;
      active=false;
      pending=false;
      stream?.getTracks().forEach(track=>track.stop());
      stream=null;
      if(audioContext&&audioContext.state!=='closed')audioContext.close().catch(()=>{});
      audioContext=null;
      analyser=null;
      samples=null;
      level=0;
      loudRun=0;
      quietCharge=0;
      calmTime=0;
      returnCooldown=0;
      levelFill.style.width='0%';
      micButton.disabled=false;
      micButton.textContent='Enable microphone';
      micButton.setAttribute('aria-pressed','false');
      stageMessage.hidden=false;
      stageMessage.textContent='Enable the microphone to invite quiet critters.';
      setBadge('MIC OFF');
      say(message);
      dismissAll();
      if(!critters.length&&animationFrame){cancelAnimationFrame(animationFrame);animationFrame=0;lastFrameTime=0}
    }

    async function startMicrophone(){
      if(active||pending){stopMicrophone();return}
      if(!navigator.mediaDevices?.getUserMedia){
        stageMessage.hidden=false;
        stageMessage.textContent='Microphone access is not available in this browser.';
        say('Microphone unavailable in this browser.');
        return;
      }
      pending=true;
      const token=++requestToken;
      micButton.textContent='Cancel microphone request';
      micButton.setAttribute('aria-pressed','false');
      stageMessage.hidden=false;
      stageMessage.textContent='Allow microphone access to wake the forest.';
      setBadge('WAITING');
      say('Waiting for microphone permission...');
      try{
        const incoming=await navigator.mediaDevices.getUserMedia({
          audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},
          video:false
        });
        if(disposed||token!==requestToken){incoming.getTracks().forEach(track=>track.stop());return}
        stream=incoming;
        audioContext=new (window.AudioContext||window.webkitAudioContext)();
        await audioContext.resume();
        if(disposed||token!==requestToken)return;
        analyser=audioContext.createAnalyser();
        analyser.fftSize=1024;
        analyser.smoothingTimeConstant=.78;
        samples=new Uint8Array(analyser.fftSize);
        audioContext.createMediaStreamSource(stream).connect(analyser);
        active=true;
        pending=false;
        level=0;
        quietCharge=0;
        calmTime=0;
        loudRun=0;
        nextInvite=random(2.4,4.2);
        micButton.textContent='Turn microphone off';
        micButton.setAttribute('aria-pressed','true');
        stageMessage.hidden=true;
        setBadge('LISTENING');
        say('Listening for a quiet classroom...');
        stream.getAudioTracks().forEach(track=>track.addEventListener('ended',()=>{
          if(active)stopMicrophone('Microphone disconnected. Enable it to listen again.');
        },{once:true}));
        wake();
      }catch(error){
        if(disposed||token!==requestToken)return;
        stopMicrophone(error?.name==='NotAllowedError'?'Microphone permission was declined.':'Could not start the microphone. Check your device and try again.');
      }
    }

    function updateAudio(dt){
      if(active&&analyser&&samples){
        analyser.getByteTimeDomainData(samples);
        let sum=0;
        for(const value of samples)sum+=((value-128)/128)**2;
        const rms=Math.sqrt(sum/samples.length)||.00001;
        const raw=clamp((20*Math.log10(rms)+60)/60*100,0,100)*sensitivity()/100;
        level+=(clamp(raw,0,100)-level)*Math.min(1,dt*8.5);
      }else{
        level+=(0-level)*Math.min(1,dt*7);
      }
      levelFill.style.width=`${clamp(level,0,100).toFixed(2)}%`;
    }

    function updateQuietLogic(dt){
      if(!active)return;
      returnCooldown=Math.max(0,returnCooldown-dt);
      const low=threshold()-4;
      const high=threshold()+4;
      if(level<=low){
        quietCharge+=dt;
        calmTime+=dt;
        loudRun=Math.max(0,loudRun-dt*3.2);
        setBadge('QUIET','quiet');
        if(critters.length)say(`${critters.length} quiet ${critters.length===1?'critter is':'critters are'} visiting the forest.`);
        else say('The room is quiet... watch the forest closely.');
      }else if(level>=high){
        loudRun+=dt;
        quietCharge=Math.max(0,quietCharge-dt*5);
        calmTime=0;
        setBadge('TOO LOUD','loud');
        say(critters.length?'Too loud! The quiet critters are hiding.':'The forest is waiting for quieter voices.');
      }else{
        loudRun=Math.max(0,loudRun-dt*1.25);
        quietCharge=Math.max(0,quietCharge-dt*.25);
        calmTime=Math.max(0,calmTime-dt*.2);
        setBadge('LISTENING');
        say(critters.length?'The critters are listening...':'Almost quiet enough for a visitor...');
      }

      if(loudRun>=.22){
        if(critters.length)dismissAll();
        loudRun=0;
        quietCharge=0;
        calmTime=0;
        returnCooldown=1.4;
        nextInvite=random(3.4,6.2);
      }

      if(returnCooldown<=0&&level<=low&&quietCharge>=nextInvite&&critters.length<MAX_CRITTERS){
        spawnCritter();
        quietCharge=0;
        nextInvite=random(4.8,8.4);
      }
    }

    function tick(timestamp){
      animationFrame=0;
      if(disposed)return;
      const now=timestamp/1000;
      const dt=lastFrameTime?Math.min(.08,now-lastFrameTime):0;
      lastFrameTime=now;
      updateAudio(dt);
      updateQuietLogic(dt);
      updateCritters(now);
      if(active||critters.length)animationFrame=requestAnimationFrame(tick);
      else lastFrameTime=0;
    }

    function wake(){
      if(!disposed&&!animationFrame){lastFrameTime=0;animationFrame=requestAnimationFrame(tick)}
    }

    micButton.addEventListener('click',startMicrophone);
    thresholdInput.addEventListener('input',()=>updateSettings(true));
    sensitivityInput.addEventListener('input',()=>updateSettings(true));

    function onVisibility(){
      if(document.hidden&&(active||pending))stopMicrophone('Microphone paused while the tab is hidden. Enable it again when you return.');
    }
    document.addEventListener('visibilitychange',onVisibility);

    moduleElement._boardGetState=()=>({
      threshold:threshold(),
      sensitivity:sensitivity()
    });

    moduleElement._boardSetState=state=>{
      stopMicrophone();
      thresholdInput.value=String(clamp(Number(state?.threshold)||45,15,85));
      sensitivityInput.value=String(clamp(Number(state?.sensitivity)||100,30,200));
      updateSettings(false);
    };

    const priorDeactivate=moduleElement._deactivate;
    const priorReactivate=moduleElement._reactivate;
    moduleElement._deactivate=()=>{
      priorDeactivate?.();
      if(active||pending)stopMicrophone('Microphone off · Enable it again when the tile is restored.');
    };
    moduleElement._reactivate=()=>{priorReactivate?.()};

    const priorCleanup=moduleElement._cleanup;
    moduleElement._cleanup=()=>{
      disposed=true;
      requestToken+=1;
      stream?.getTracks().forEach(track=>track.stop());
      stream=null;
      if(audioContext&&audioContext.state!=='closed')audioContext.close().catch(()=>{});
      audioContext=null;
      analyser=null;
      samples=null;
      cancelAnimationFrame(animationFrame);
      animationFrame=0;
      document.removeEventListener('visibilitychange',onVisibility);
      poofLayer.replaceChildren();
      critters=[];
      priorCleanup?.();
    };

    randomizeForest();
    updateSettings(false);
    setBadge('MIC OFF');
    stageMessage.hidden=false;
    stageMessage.textContent='Enable the microphone to invite quiet critters.';
    say('Microphone off · Enable it to invite quiet critters.');
  }

  window.TeacherTilesQuietCritters=Object.freeze({setup});
})();
