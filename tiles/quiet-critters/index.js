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
  const AUDIO={
    crickets:`${BASE}/audio/crickets.mp3`,
    sparkle:`${BASE}/audio/sparkle.mp3`,
    twinkle:`${BASE}/audio/twinkly-forest.mp3`
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
    const foregroundLayer=moduleElement.querySelector('.quietcritters-foreground');
    const poofLayer=moduleElement.querySelector('.quietcritters-poofs');
    const stateBadge=moduleElement.querySelector('.quietcritters-state');
    const status=moduleElement.querySelector('.quietcritters-status');
    const stageMessage=moduleElement.querySelector('.quietcritters-stage-message');
    const levelWrap=moduleElement.querySelector('.quietcritters-level');
    const levelFill=moduleElement.querySelector('.quietcritters-level-fill');
    const thresholdMarker=moduleElement.querySelector('.quietcritters-threshold-marker');
    const micButton=moduleElement.querySelector('.quietcritters-mic');
    const thresholdInput=moduleElement.querySelector('.quietcritters-threshold');
    const thresholdValue=moduleElement.querySelector('.quietcritters-threshold-value');
    const sensitivityInput=moduleElement.querySelector('.quietcritters-sensitivity');
    const sensitivityValue=moduleElement.querySelector('.quietcritters-sensitivity-value');
    const resetButton=moduleElement.querySelector('.quietcritters-reset');
    const disableSfxInput=moduleElement.querySelector('.quietcritters-disable-sfx');

    const cricketAudio=new Audio(AUDIO.crickets);
    cricketAudio.loop=true;
    cricketAudio.preload='auto';
    cricketAudio.volume=.035;
    const twinkleAudio=new Audio(AUDIO.twinkle);
    twinkleAudio.loop=true;
    twinkleAudio.preload='auto';
    twinkleAudio.volume=.012;
    const sparklePrototype=new Audio(AUDIO.sparkle);
    sparklePrototype.preload='auto';
    sparklePrototype.volume=.055;

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
    let mode='ambient';
    let nextInvite=random(14,22);
    let soundDisabled=false;

    function notify(reason){window.notifyBoardChanged?.(`quiet-critters-${reason}`)}
    function threshold(){return clamp(Number(thresholdInput.value)||45,15,85)}
    function sensitivity(){return clamp(Number(sensitivityInput.value)||100,30,200)}
    function say(text){if(status.textContent!==text)status.textContent=text}

    function setBadge(text,tone='neutral'){
      if(stateBadge.textContent!==text)stateBadge.textContent=text;
      stateBadge.dataset.tone=tone;
    }

    function pauseAmbience(reset=false){
      [cricketAudio,twinkleAudio].forEach(sound=>{
        sound.pause();
        if(reset){try{sound.currentTime=0}catch{}}
      });
    }

    function startAmbience(){
      if(soundDisabled||disposed||document.hidden)return;
      cricketAudio.play().catch(()=>{});
      twinkleAudio.play().catch(()=>{});
    }

    function playSparkle(){
      if(soundDisabled||disposed)return;
      const sound=sparklePrototype.cloneNode();
      sound.volume=.055;
      sound.play().catch(()=>{});
    }

    function setSoundDisabled(disabled,{notifyChange=true}={}){
      soundDisabled=Boolean(disabled);
      if(disableSfxInput)disableSfxInput.checked=soundDisabled;
      if(soundDisabled)pauseAmbience(false);
      else startAmbience();
      if(notifyChange)notify('sfx');
    }

    function randomizeForest(){
      treeLayer.replaceChildren();
      propLayer.replaceChildren();
      fairyLayer.replaceChildren();
      foregroundLayer.replaceChildren();

      // Rear trees sit behind the hill, but are raised enough for a section of
      // trunk to stay visible above the ridge before the hill hides their base.
      const treeCount=4+Math.floor(Math.random()*2);
      const slots=Array.from({length:treeCount},(_,index)=>(index+.5)/treeCount);
      slots.forEach((slot,index)=>{
        const image=document.createElement('img');
        image.className='quietcritters-tree';
        image.src=SCENERY.tree;
        image.alt='';
        image.draggable=false;
        const x=clamp((slot+random(-.065,.065))*100,6,94);
        image.style.left=`${x.toFixed(2)}%`;
        image.style.setProperty('--tree-bottom',`${random(13,21).toFixed(2)}%`);
        image.style.setProperty('--scale',random(.72,1.02).toFixed(3));
        image.style.setProperty('--opacity',random(.30,.48).toFixed(3));
        image.style.zIndex=String(index%2);
        treeLayer.appendChild(image);
      });

      // Props use reserved footprints and a shared hill-depth range. Their base
      // is always anchored to the hill, with a small contact shadow underneath.
      const occupiedProps=[];
      function choosePropSpot(width,minBottom,maxBottom){
        for(let attempt=0;attempt<240;attempt+=1){
          const candidate={x:random(7,93),bottom:random(minBottom,maxBottom),width};
          const overlaps=occupiedProps.some(existing=>{
            const xGap=Math.abs(candidate.x-existing.x);
            const yGap=Math.abs(candidate.bottom-existing.bottom);
            const horizontal=(candidate.width+existing.width)*.60;
            const vertical=(candidate.width+existing.width)*.34;
            return xGap<horizontal&&yGap<vertical;
          });
          if(!overlaps){occupiedProps.push(candidate);return candidate;}
        }
        const fallback={x:random(8,92),bottom:random(minBottom,maxBottom),width};
        occupiedProps.push(fallback);
        return fallback;
      }

      function addGroundShadow(spot,width,kind){
        const shadow=document.createElement('span');
        shadow.className=`quietcritters-ground-shadow quietcritters-ground-shadow--${kind}`;
        shadow.style.setProperty('--left',`${spot.x.toFixed(2)}%`);
        shadow.style.setProperty('--bottom',`${spot.bottom.toFixed(2)}%`);
        shadow.style.setProperty('--shadow-width',`${(width*.66).toFixed(2)}%`);
        propLayer.appendChild(shadow);
      }

      for(let index=0;index<3;index+=1){
        const width=random(12.5,16.5);
        const spot=choosePropSpot(width,7,31);
        addGroundShadow(spot,width,'stump');
        const stump=document.createElement('img');
        stump.className='quietcritters-prop quietcritters-prop--stump';
        stump.src=SCENERY.stump;
        stump.alt='';
        stump.draggable=false;
        stump.style.setProperty('--left',`${spot.x.toFixed(2)}%`);
        stump.style.setProperty('--bottom',`${spot.bottom.toFixed(2)}%`);
        stump.style.setProperty('--width',`${width.toFixed(2)}%`);
        stump.style.zIndex=String(4+Math.round((31-spot.bottom)/5));
        propLayer.appendChild(stump);
      }

      const mushroomCount=5+Math.floor(Math.random()*3);
      for(let index=0;index<mushroomCount;index+=1){
        const width=random(8.0,11.5);
        const spot=choosePropSpot(width,8,34);
        addGroundShadow(spot,width,'mushroom');
        const image=document.createElement('img');
        image.className='quietcritters-prop quietcritters-prop--mushroom';
        image.src=pick(SCENERY.mushrooms);
        image.alt='';
        image.draggable=false;
        image.style.setProperty('--left',`${spot.x.toFixed(2)}%`);
        image.style.setProperty('--bottom',`${spot.bottom.toFixed(2)}%`);
        image.style.setProperty('--width',`${width.toFixed(2)}%`);
        image.style.zIndex=String(4+Math.round((34-spot.bottom)/5));
        propLayer.appendChild(image);
      }

      const foregroundPositions=[
        {x:random(-1,7),scale:random(.80,1.02)},
        {x:random(93,101),scale:random(.80,1.02)}
      ];
      if(Math.random()<.42)foregroundPositions.push({x:Math.random()<.5?random(7,14):random(86,93),scale:random(.62,.78)});
      foregroundPositions.forEach((position,index)=>{
        const image=document.createElement('img');
        image.className='quietcritters-foreground-tree';
        image.src=SCENERY.tree;
        image.alt='';
        image.draggable=false;
        image.style.left=`${position.x.toFixed(2)}%`;
        image.style.setProperty('--scale',position.scale.toFixed(3));
        image.style.setProperty('--opacity',random(.66,.84).toFixed(3));
        image.style.zIndex=String(index);
        foregroundLayer.appendChild(image);
      });

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
      for(let attempt=0;attempt<100;attempt+=1){
        const candidate={x:random(7,93),bottom:random(7,34)};
        const separated=critters.every(critter=>Math.hypot(candidate.x-critter.x,(candidate.bottom-critter.bottom)*1.25)>7.0);
        if(separated){candidate.y=clamp(100-candidate.bottom-4.7,8,90);return candidate;}
      }
      const candidate={x:random(8,92),bottom:random(8,32)};
      candidate.y=clamp(100-candidate.bottom-4.7,8,90);
      return candidate;
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
        case 'sway':return{frames:[FRAMES.arms[0],FRAMES.arms[1],FRAMES.arms[2],FRAMES.arms[3],FRAMES.arms[2],FRAMES.arms[1]],step:.30,duration:1.75};
        case 'dance':return{frames:[FRAMES.dance[0],FRAMES.dance[1],FRAMES.dance[2],FRAMES.dance[1]],step:.22,duration:1.35};
        case 'jump':return{frames:[FRAMES.jump[0],FRAMES.jump[1],FRAMES.jump[2],FRAMES.jump[1],FRAMES.jump[0]],step:.17,duration:1.05};
        case 'drowsy':return{frames:[FRAMES.drowsy],step:.8,duration:1.1,next:'sleep'};
        case 'sleep':return{frames:[FRAMES.sleep[0],FRAMES.sleep[1]],step:.62,duration:random(5.5,9.0)};
        case 'happy':return{frames:[FRAMES.happy,FRAMES.happy2,FRAMES.happy],step:.50,duration:random(1.15,1.55)};
        case 'idle':
        default:return{frames:[pick(FRAMES.arms)],step:99,duration:random(6.5,12.0)};
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
      if(roll<.70)behavior='idle';
      else if(roll<.81)behavior='sleep';
      else if(roll<.89)behavior='sway';
      else if(roll<.94)behavior='happy';
      else if(roll<.98)behavior='dance';
      else behavior='jump';
      setBehavior(critter,behavior,now);
    }

    function setBehavior(critter,name,now=performance.now()/1000){
      const sequence=sequenceFor(name);
      critter.behavior=name;
      critter.frames=sequence.frames;
      critter.frameStep=sequence.step;
      critter.frameIndex=0;
      critter.nextFrame=now+sequence.step;
      critter.behaviorEnds=now+sequence.duration;
      critter.followUp=sequence.next||'';
      critter.element.dataset.behavior=name;
      if(!Number.isFinite(critter.nextBlink))critter.nextBlink=now+random(1.4,3.2);
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
      element.style.setProperty('--bottom',`${position.bottom.toFixed(2)}%`);
      element.style.setProperty('--size',`${random(25,38).toFixed(1)}px`);
      element.style.zIndex=String(10+Math.round((34-position.bottom)/3));
      const canvas=document.createElement('canvas');
      canvas.width=RENDER_SIZE;
      canvas.height=RENDER_SIZE;
      canvas.setAttribute('aria-hidden','true');
      element.appendChild(canvas);
      critterLayer.appendChild(element);
      const critter={
        element,canvas,context:canvas.getContext('2d'),color,
        x:position.x,y:position.y,bottom:position.bottom,behavior:'idle',frames:[FRAMES.arms[0]],frameStep:99,frameIndex:0,nextFrame:0,behaviorEnds:0,followUp:'',lastFrame:'',
        nextBlink:performance.now()/1000+random(2.0,4.5),blinkRestoreAt:0,blinkRestoreSrc:'',blinkActive:false
      };
      critters.push(critter);
      setBehavior(critter,Math.random()<.13?'sleep':'idle');
      burst(position.x,position.y,color,true);
      playSparkle();
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

        // A blink is only a very short visual interruption. Remember the exact
        // frame the critter was on, flash one blink sprite, then immediately
        // restore the prior idle/dance/sway/jump frame.
        if(critter.blinkActive){
          if(now<critter.blinkRestoreAt)continue;
          critter.blinkActive=false;
          const restore=critter.blinkRestoreSrc||critter.frames[critter.frameIndex]||FRAMES.arms[0];
          critter.blinkRestoreSrc='';
          drawCritter(critter,restore);
          critter.nextBlink=now+random(2.0,5.0);
        }

        if(now>=critter.behaviorEnds){
          chooseBehavior(critter,now);
          continue;
        }

        if(now>=critter.nextBlink&&!['sleep','drowsy'].includes(critter.behavior)){
          critter.blinkActive=true;
          critter.blinkRestoreSrc=critter.lastFrame||critter.frames[critter.frameIndex]||FRAMES.arms[0];
          critter.blinkRestoreAt=now+random(.055,.085);
          drawCritter(critter,Math.random()<.5?FRAMES.blink[0]:FRAMES.blink[1]);
          continue;
        }

        if(now>=critter.nextFrame){
          const frames=critter.frames;
          critter.frameIndex=(critter.frameIndex+1)%frames.length;
          drawCritter(critter,frames[critter.frameIndex]);
          critter.nextFrame=now+critter.frameStep;
        }else if(!critter.lastFrame){
          drawCritter(critter,critter.frames[critter.frameIndex]||FRAMES.arms[0]);
        }
      }
    }

    function resetVisitors(){
      dismissAll();
      quietCharge=0;
      calmTime=0;
      loudRun=0;
      returnCooldown=0;
      nextInvite=mode==='ambient'?random(14,22):random(10,16);
      if(mode==='ambient'){
        setBadge('NO MIC');
        say('No mic mode · The forest is starting fresh. Quiet critters will visit slowly over time.');
      }else if(active){
        setBadge(level<=threshold()-4?'QUIET':'LISTENING',level<=threshold()-4?'quiet':'neutral');
        say('Quiet Critters reset · Keep the room calm to invite new visitors.');
      }else{
        setBadge('MIC OFF');
        say('Quiet Critters reset · Enable the microphone when you are ready to listen again.');
      }
      notify('reset');
      wake();
    }

    function updateSettings(notifyChange=true){
      thresholdInput.value=String(threshold());
      sensitivityInput.value=String(sensitivity());
      thresholdValue.textContent=`${Math.round(threshold())}%`;
      sensitivityValue.textContent=`${Math.round(sensitivity())}%`;
      thresholdMarker.style.left=`${threshold().toFixed(2)}%`;
      if(notifyChange)notify('settings');
    }

    function stopMicrophone(message='Microphone off · Enable it to listen for quiet voices.'){
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
      levelWrap.hidden=true;
      micButton.disabled=false;
      micButton.textContent='Enable microphone';
      micButton.setAttribute('aria-pressed','false');
      if(mode==='microphone'){
        stageMessage.hidden=false;
        stageMessage.textContent='Enable the microphone to let room noise guide the forest.';
        setBadge('MIC OFF');
        if(message)say(message);
      }
    }

    function setMode(nextMode,{notifyChange=true}={}){
      const normalized=nextMode==='microphone'?'microphone':'ambient';
      if(mode!==normalized){
        if(active||pending)stopMicrophone();
        mode=normalized;
      }
      moduleElement.dataset.quietcrittersMode=mode;
      moduleElement.querySelectorAll('[data-quietcritters-mode]').forEach(button=>{
        const selected=button.dataset.quietcrittersMode===mode;
        button.classList.toggle('is-active',selected);
        button.setAttribute('aria-pressed',String(selected));
      });
      moduleElement.querySelectorAll('.quietcritters-mic-setting').forEach(element=>{element.hidden=mode!=='microphone'});
      micButton.hidden=mode!=='microphone';
      levelWrap.hidden=mode!=='microphone'||!active;
      quietCharge=0;
      loudRun=0;
      calmTime=0;
      returnCooldown=0;
      nextInvite=mode==='ambient'?random(14,22):random(10,16);
      if(mode==='ambient'){
        stageMessage.hidden=true;
        setBadge('NO MIC');
        say(critters.length?`${critters.length} quiet ${critters.length===1?'critter is':'critters are'} visiting in No mic mode.`:'No mic mode · Quiet critters will visit slowly over time.');
      }else if(!active){
        stageMessage.hidden=false;
        stageMessage.textContent='Enable the microphone to let room noise guide the forest.';
        setBadge('MIC OFF');
        say('Microphone mode · Enable it so quiet voices can invite critters.');
      }
      if(notifyChange)notify('mode');
      wake();
    }

    async function startMicrophone(){
      if(mode!=='microphone')return;
      if(active||pending){stopMicrophone();return}
      if(!navigator.mediaDevices?.getUserMedia){
        stageMessage.hidden=false;
        stageMessage.textContent='Microphone access is not available in this browser.';
        say('Microphone unavailable in this browser. You can still use No mic mode.');
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
        nextInvite=random(10,16);
        micButton.textContent='Turn microphone off';
        micButton.setAttribute('aria-pressed','true');
        levelWrap.hidden=false;
        stageMessage.hidden=true;
        setBadge('LISTENING');
        say('Listening for a quiet classroom...');
        stream.getAudioTracks().forEach(track=>track.addEventListener('ended',()=>{
          if(active)stopMicrophone('Microphone disconnected. Enable it to listen again.');
        },{once:true}));
        wake();
      }catch(error){
        if(disposed||token!==requestToken)return;
        stopMicrophone(error?.name==='NotAllowedError'?'Microphone permission was declined. You can still use No mic mode.':'Could not start the microphone. Check your device and try again.');
      }
    }

    function updateAudio(dt){
      if(mode==='microphone'&&active&&analyser&&samples){
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
      if(mode==='ambient'){
        quietCharge+=dt;
        calmTime+=dt;
        setBadge('NO MIC');
        if(critters.length)say(`${critters.length} quiet ${critters.length===1?'critter is':'critters are'} visiting in No mic mode.`);
        else say('No mic mode · Quiet critters will visit slowly over time.');
        if(quietCharge>=nextInvite&&critters.length<MAX_CRITTERS){
          spawnCritter();
          quietCharge=0;
          nextInvite=random(22,36);
        }
        return;
      }

      if(!active){
        quietCharge=0;
        loudRun=0;
        calmTime=0;
        return;
      }
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
        returnCooldown=2.2;
        nextInvite=random(12,18);
      }

      if(returnCooldown<=0&&level<=low&&quietCharge>=nextInvite&&critters.length<MAX_CRITTERS){
        spawnCritter();
        quietCharge=0;
        nextInvite=random(16,26);
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
      if(mode==='ambient'||active||pending||critters.length)animationFrame=requestAnimationFrame(tick);
      else lastFrameTime=0;
    }

    function wake(){
      if(!disposed&&!animationFrame){lastFrameTime=0;animationFrame=requestAnimationFrame(tick)}
    }

    moduleElement.querySelectorAll('[data-quietcritters-mode]').forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.quietcrittersMode)));
    resetButton?.addEventListener('click',()=>{resetVisitors();resetButton.blur();});
    micButton.addEventListener('click',()=>{
      if(mode!=='microphone')return;
      if(active||pending)stopMicrophone();
      else startMicrophone();
    });
    thresholdInput.addEventListener('input',()=>updateSettings(true));
    sensitivityInput.addEventListener('input',()=>updateSettings(true));
    disableSfxInput?.addEventListener('change',()=>setSoundDisabled(disableSfxInput.checked));
    const retryAmbience=()=>startAmbience();
    moduleElement.addEventListener('pointerdown',retryAmbience,{passive:true});
    moduleElement.addEventListener('keydown',retryAmbience);

    function onVisibility(){
      if(document.hidden){
        pauseAmbience(false);
        if(active||pending)stopMicrophone('Microphone paused while the tab is hidden. Enable it again when you return.');
      }else{
        startAmbience();
        wake();
      }
    }
    document.addEventListener('visibilitychange',onVisibility);

    moduleElement._boardGetState=()=>(
      {
        mode,
        threshold:threshold(),
        sensitivity:sensitivity(),
        soundDisabled
      }
    );

    moduleElement._boardSetState=state=>{
      if(active||pending)stopMicrophone();
      thresholdInput.value=String(clamp(Number(state?.threshold)||45,15,85));
      sensitivityInput.value=String(clamp(Number(state?.sensitivity)||100,30,200));
      updateSettings(false);
      setSoundDisabled(Boolean(state?.soundDisabled),{notifyChange:false});
      setMode(state?.mode,{notifyChange:false});
    };

    const priorDeactivate=moduleElement._deactivate;
    const priorReactivate=moduleElement._reactivate;
    moduleElement._deactivate=()=>{
      priorDeactivate?.();
      cancelAnimationFrame(animationFrame);
      animationFrame=0;
      lastFrameTime=0;
      pauseAmbience(false);
      if(active||pending)stopMicrophone('Microphone off · Enable it again when the tile is restored.');
    };
    moduleElement._reactivate=()=>{priorReactivate?.();startAmbience();wake()};

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
      moduleElement.removeEventListener('pointerdown',retryAmbience);
      moduleElement.removeEventListener('keydown',retryAmbience);
      pauseAmbience(true);
      sparklePrototype.pause();
      poofLayer.replaceChildren();
      critters=[];
      priorCleanup?.();
    };

    randomizeForest();
    updateSettings(false);
    setSoundDisabled(false,{notifyChange:false});
    setMode('ambient',{notifyChange:false});
    startAmbience();
  }

  window.TeacherTilesQuietCritters=Object.freeze({setup});
})();
