(() => {
  'use strict';

  const ASSET_BASE='tiles/sleepy-monster/assets';
  const SPRITES=Object.freeze({
    idle:`${ASSET_BASE}/idle.png`,
    walk:[`${ASSET_BASE}/walk-1.png`,`${ASSET_BASE}/walk-2.png`,`${ASSET_BASE}/walk-3.png`,`${ASSET_BASE}/walk-2.png`],
    angry:`${ASSET_BASE}/angry.png`,
    wakeStand:`${ASSET_BASE}/wake-stand.png`,
    wakeBack:`${ASSET_BASE}/wake-back.png`,
    sleepStand:[`${ASSET_BASE}/sleep-stand-1.png`,`${ASSET_BASE}/sleep-stand-2.png`,`${ASSET_BASE}/sleep-stand-3.png`,`${ASSET_BASE}/sleep-stand-2.png`],
    sleepBack:[`${ASSET_BASE}/sleep-back-1.png`,`${ASSET_BASE}/sleep-back-2.png`,`${ASSET_BASE}/sleep-back-3.png`,`${ASSET_BASE}/sleep-back-2.png`]
  });

  const STATES=new Set(['idle','walk','sleep-stand','sleep-back','wake-stand','wake-back','angry','grumpy-walk']);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const random=(min,max)=>min+Math.random()*(max-min);

  const preload=[SPRITES.idle,SPRITES.angry,SPRITES.wakeStand,SPRITES.wakeBack,...SPRITES.walk,...SPRITES.sleepStand,...SPRITES.sleepBack];
  [...new Set(preload)].forEach(src=>{const image=new Image();image.src=src;});

  function setup(m){
    const actor=m.querySelector('.sleepymonster-actor');
    const sprite=m.querySelector('.sleepymonster-sprite');
    const stage=m.querySelector('.sleepymonster-stage');
    const status=m.querySelector('.sleepymonster-status');
    const stateLabel=m.querySelector('.sleepymonster-state');
    const meter=m.querySelector('.sleepymonster-meter');
    const micButton=m.querySelector('.sleepymonster-mic');
    const thresholdInput=m.querySelector('.sleepymonster-threshold');
    const thresholdValue=m.querySelector('.sleepymonster-threshold-value');
    const sensitivityInput=m.querySelector('.sleepymonster-sensitivity');
    const sensitivityValue=m.querySelector('.sleepymonster-sensitivity-value');
    const delayInput=m.querySelector('.sleepymonster-delay');
    const delayValue=m.querySelector('.sleepymonster-delay-value');
    const zzz=m.querySelector('.sleepymonster-zzz');
    const scribble=m.querySelector('.sleepymonster-scribble');

    let state='idle';
    let sleepVariant=1;
    let x=.28;
    let direction=1;
    let stateTimer=random(1.6,3.2);
    let quietTime=0;
    let loudTime=0;
    let animationTime=0;
    let frame=0;
    let last=0;
    let visible=true;
    let disposed=false;
    let active=false;
    let pending=false;
    let stream=null;
    let audio=null;
    let analyser=null;
    let samples=null;
    let request=0;
    let level=0;
    let lastSprite='';
    let pulseTimer=0;
    let savedStateRestored=false;

    function threshold(){return clamp(Number(thresholdInput.value)||45,15,85)}
    function sensitivity(){return clamp(Number(sensitivityInput.value)||100,30,200)}
    function quietDelay(){return clamp(Number(delayInput.value)||4.5,1.5,12)}

    function updateSettingLabels(){
      thresholdValue.textContent=`${Math.round(threshold())}%`;
      sensitivityValue.textContent=`${Math.round(sensitivity())}%`;
      delayValue.textContent=`${quietDelay().toFixed(1)}s`;
    }

    function say(text){status.textContent=text}

    function setSprite(src){
      if(lastSprite===src)return;
      lastSprite=src;
      sprite.src=src;
    }

    function pulse(){
      clearTimeout(pulseTimer);
      actor.classList.remove('sleepymonster-state-pulse');
      void actor.offsetWidth;
      actor.classList.add('sleepymonster-state-pulse');
      pulseTimer=setTimeout(()=>actor.classList.remove('sleepymonster-state-pulse'),360);
    }

    function setState(next,{announce=true}={}){
      if(!STATES.has(next))next='idle';
      const changed=state!==next;
      state=next;
      stage.dataset.state=state;
      actor.classList.toggle('is-idle',state==='idle');
      actor.classList.toggle('is-sleeping',state==='sleep-stand'||state==='sleep-back');
      actor.classList.toggle('is-walking',state==='walk'||state==='grumpy-walk');
      actor.classList.toggle('is-angry',state==='angry');
      zzz.hidden=!(state==='sleep-stand'||state==='sleep-back');
      scribble.hidden=state!=='angry';

      if(state==='idle')stateLabel.textContent='AWAKE';
      else if(state==='walk')stateLabel.textContent='WANDERING';
      else if(state==='sleep-stand'||state==='sleep-back')stateLabel.textContent='SLEEPING';
      else if(state==='wake-stand'||state==='wake-back')stateLabel.textContent='WAKING';
      else if(state==='angry')stateLabel.textContent='ANGRY';
      else stateLabel.textContent='GRUMPY';

      if(changed)pulse();
      if(!announce)return;
      if(state==='idle')say('Awake and resting. Keep it quiet and he may doze off.');
      else if(state==='walk')say('Awake and wandering around the tile.');
      else if(state==='sleep-stand'||state==='sleep-back')say('Shhh... the monster fell asleep.');
      else if(state==='wake-stand'||state==='wake-back')say('Noise detected. He is waking up...');
      else if(state==='angry')say('Too noisy! The sleepy monster is not happy.');
      else say('Still grumpy. He is stomping around for a bit.');
    }

    function chooseAwakeState(){
      stateTimer=random(1.7,3.6);
      setState(Math.random()<.58?'walk':'idle');
    }

    function fallAsleep(){
      sleepVariant=Math.random()<.5?1:2;
      quietTime=0;
      loudTime=0;
      animationTime=0;
      setState(sleepVariant===1?'sleep-stand':'sleep-back');
    }

    function startWaking(){
      stateTimer=1.45;
      quietTime=0;
      loudTime=0;
      animationTime=0;
      setState(sleepVariant===1?'wake-stand':'wake-back');
    }

    function getAngry(){
      stateTimer=1.15;
      animationTime=0;
      setState('angry');
    }

    function startGrumpyWalk(){
      stateTimer=random(4.2,6.2);
      animationTime=0;
      setState('grumpy-walk');
    }

    function stop(message='Microphone off · The monster can still doze off on his own'){
      ++request;
      active=false;
      pending=false;
      stream?.getTracks().forEach(track=>track.stop());
      stream=null;
      if(audio&&audio.state!=='closed')audio.close().catch(()=>{});
      audio=analyser=samples=null;
      level=0;
      quietTime=0;
      loudTime=0;
      meter.value=0;
      meter.hidden=true;
      micButton.disabled=false;
      micButton.textContent='Enable microphone';
      micButton.setAttribute('aria-pressed','false');
      say(message);
    }

    async function startMicrophone(){
      if(active||pending){stop();return}
      if(!navigator.mediaDevices?.getUserMedia){say('Microphone unavailable in this browser.');return}
      pending=true;
      micButton.textContent='Cancel microphone request';
      micButton.disabled=false;
      say('Allow microphone access so the monster can listen to the room.');
      const token=++request;
      try{
        const incoming=await navigator.mediaDevices.getUserMedia({
          audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},
          video:false
        });
        if(disposed||token!==request){incoming.getTracks().forEach(track=>track.stop());return}
        stream=incoming;
        audio=new (window.AudioContext||window.webkitAudioContext)();
        await audio.resume();
        if(disposed||token!==request)return;
        analyser=audio.createAnalyser();
        analyser.fftSize=1024;
        analyser.smoothingTimeConstant=.78;
        samples=new Uint8Array(analyser.fftSize);
        audio.createMediaStreamSource(stream).connect(analyser);
        active=true;
        pending=false;
        meter.hidden=false;
        micButton.textContent='Turn microphone off';
        micButton.setAttribute('aria-pressed','true');
        say('Listening now. Quiet helps him sleep; noise wakes him up.');
        stream.getAudioTracks().forEach(track=>track.addEventListener('ended',()=>{if(active)stop('Microphone disconnected. Enable it to try again.');},{once:true}));
        wake();
      }catch(error){
        if(disposed||token!==request)return;
        stop(error?.name==='NotAllowedError'?'Microphone permission was declined.':'Could not start the microphone. Check your device and try again.');
      }
    }

    micButton.addEventListener('click',startMicrophone);

    function updateAudio(dt){
      if(active&&analyser&&samples){
        analyser.getByteTimeDomainData(samples);
        let sum=0;
        for(const value of samples)sum+=((value-128)/128)**2;
        const raw=clamp((20*Math.log10(Math.sqrt(sum/samples.length)||.00001)+60)/60*100,0,100)*sensitivity()/100;
        level+=(clamp(raw,0,100)-level)*Math.min(1,dt*9);
        meter.value=level;
      }else{
        level+=(0-level)*Math.min(1,dt*7);
        meter.value=level;
      }
    }

    function updateNoiseTimers(dt){
      if(!active){
        if(state==='idle'||state==='walk'||state==='grumpy-walk')quietTime+=dt;
        else quietTime=0;
        loudTime=0;
        return;
      }
      const high=threshold()+4;
      const low=threshold()-4;
      if(level>=high){
        loudTime+=dt;
        quietTime=0;
      }else if(level<=low){
        quietTime+=dt;
        loudTime=Math.max(0,loudTime-dt*2.4);
      }else{
        loudTime=Math.max(0,loudTime-dt*.8);
        quietTime=Math.max(0,quietTime-dt*.35);
      }
    }

    function updateState(dt){
      updateNoiseTimers(dt);
      const delay=quietDelay();

      if(state==='idle'||state==='walk'){
        stateTimer-=dt;
        if(quietTime>=delay){fallAsleep();return}
        if(stateTimer<=0)chooseAwakeState();
        return;
      }

      if(state==='sleep-stand'||state==='sleep-back'){
        if(active&&loudTime>=.22)startWaking();
        return;
      }

      if(state==='wake-stand'||state==='wake-back'){
        stateTimer-=dt;
        if(active&&quietTime>=.62){fallAsleep();return}
        if(stateTimer<=0){
          if(active&&level>=threshold())getAngry();
          else chooseAwakeState();
        }
        return;
      }

      if(state==='angry'){
        // Stay angry for as long as the room remains at or above the threshold.
        // Once the smoothed microphone level drops below it, the angry bubble
        // disappears and he stomps around grumpily before settling again.
        if(!active){startGrumpyWalk();return}
        if(level<threshold()){startGrumpyWalk();return}
        return;
      }

      if(state==='grumpy-walk'){
        stateTimer-=dt;
        if(quietTime>=delay){fallAsleep();return}
        if(stateTimer<=0)chooseAwakeState();
      }
    }

    function updateMovement(dt){
      let speed=0;
      if(state==='walk')speed=.09;
      else if(state==='grumpy-walk')speed=.135;
      if(speed){
        x+=direction*speed*dt;
        if(x<=.16){x=.16;direction=1}
        else if(x>=.84){x=.84;direction=-1}
      }
      actor.style.setProperty('--sleepy-x',`${x*100}%`);
      actor.style.setProperty('--sleepy-facing',direction>0?'-1':'1');
    }

    function updateSprite(dt){
      animationTime+=dt;
      if(state==='idle')setSprite(SPRITES.idle);
      else if(state==='walk')setSprite(SPRITES.walk[Math.floor(animationTime*5.2)%SPRITES.walk.length]);
      else if(state==='grumpy-walk')setSprite(SPRITES.walk[Math.floor(animationTime*6.4)%SPRITES.walk.length]);
      else if(state==='angry')setSprite(SPRITES.angry);
      else if(state==='wake-stand')setSprite(SPRITES.wakeStand);
      else if(state==='wake-back')setSprite(SPRITES.wakeBack);
      else if(state==='sleep-stand')setSprite(SPRITES.sleepStand[Math.floor(animationTime*2.05)%SPRITES.sleepStand.length]);
      else if(state==='sleep-back')setSprite(SPRITES.sleepBack[Math.floor(animationTime*1.8)%SPRITES.sleepBack.length]);
    }

    function tick(now){
      frame=0;
      if(disposed||document.hidden||!visible)return;
      const dt=last?Math.min(.08,(now-last)/1000):0;
      last=now;
      updateAudio(dt);
      updateState(dt);
      updateMovement(dt);
      updateSprite(dt);
      frame=requestAnimationFrame(tick);
    }

    function wake(){
      if(!disposed&&!document.hidden&&visible&&!frame){last=0;frame=requestAnimationFrame(tick)}
    }

    function updateSettings(){
      thresholdInput.value=String(threshold());
      sensitivityInput.value=String(sensitivity());
      delayInput.value=String(quietDelay());
      updateSettingLabels();
      notifyBoardChanged('sleepy-monster-settings');
    }
    thresholdInput.addEventListener('input',updateSettings);
    sensitivityInput.addEventListener('input',updateSettings);
    delayInput.addEventListener('input',updateSettings);

    const observer=new IntersectionObserver(entries=>{
      visible=entries[0]?.isIntersecting!==false;
      if(!visible){cancelAnimationFrame(frame);frame=0;last=0}
      else wake();
    });
    observer.observe(stage);

    function onVisibility(){
      if(document.hidden){
        cancelAnimationFrame(frame);frame=0;last=0;
        if(active||pending)stop('Microphone paused while the tab is hidden.');
      }else wake();
    }
    document.addEventListener('visibilitychange',onVisibility);

    m._boardGetState=()=>({
      threshold:threshold(),
      sensitivity:sensitivity(),
      quietDelay:quietDelay(),
      state:state==='sleep-stand'||state==='sleep-back'?state:(state==='idle'||state==='walk'?state:'idle'),
      sleepVariant,
      x,
      direction
    });

    m._boardSetState=s=>{
      stop();
      thresholdInput.value=String(clamp(Number(s?.threshold)||45,15,85));
      sensitivityInput.value=String(clamp(Number(s?.sensitivity)||100,30,200));
      delayInput.value=String(clamp(Number(s?.quietDelay)||4.5,1.5,12));
      sleepVariant=s?.sleepVariant===2?2:1;
      x=clamp(Number(s?.x)||.28,.16,.84);
      direction=Number(s?.direction)<0?-1:1;
      const restored=STATES.has(s?.state)&&['idle','walk','sleep-stand','sleep-back'].includes(s.state)?s.state:'idle';
      stateTimer=random(1.8,3.4);
      quietTime=0;
      loudTime=0;
      animationTime=0;
      setState(restored,{announce:false});
      updateSettingLabels();
      updateMovement(0);
      updateSprite(0);
      savedStateRestored=true;
      say(restored.startsWith('sleep-')?'Still asleep. Enable the microphone so room noise can wake him.':'Microphone off · Enable it so the monster can react to room noise.');
      wake();
    };

    const priorDeactivate=m._deactivate;
    const priorReactivate=m._reactivate;
    m._deactivate=()=>{
      priorDeactivate?.();
      cancelAnimationFrame(frame);frame=0;last=0;
      if(active||pending)stop('Microphone off · Enable it again when the tile is restored.');
    };
    m._reactivate=()=>{priorReactivate?.();wake()};

    const priorCleanup=m._cleanup;
    m._cleanup=()=>{
      disposed=true;
      clearTimeout(pulseTimer);
      stop();
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange',onVisibility);
      priorCleanup?.();
    };

    updateSettingLabels();
    setState('idle',{announce:false});
    updateMovement(0);
    updateSprite(0);
    if(!savedStateRestored)say('Microphone off · He will doze off after a little quiet time.');
    wake();
  }

  window.TeacherTilesSleepyMonster=Object.freeze({setup});
})();
