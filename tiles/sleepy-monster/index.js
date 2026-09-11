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
    const sleepTime=m.querySelector('.sleepymonster-sleep-time');
    const goalText=m.querySelector('.sleepymonster-goal-text');
    const goalTrack=m.querySelector('.sleepymonster-goal-track');
    const goalFill=m.querySelector('.sleepymonster-goal-fill');
    const goalInput=m.querySelector('.sleepymonster-goal-input');
    const goalEnabledInput=m.querySelector('.sleepymonster-goal-enabled');
    const goalWrap=m.querySelector('.sleepymonster-goal');

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
    let cycleSleepSeconds=0;
    let sleepCycleActive=false;
    let goalReached=false;
    let goalEnabled=true;
    let goalSeconds=300;
    let mode='ambient';

    function threshold(){return clamp(Number(thresholdInput.value)||45,15,85)}
    function sensitivity(){return clamp(Number(sensitivityInput.value)||100,30,200)}
    function quietDelay(){return clamp(Number(delayInput.value)||4.5,1.5,12)}
    function sleepGoalMinutes(){return goalSeconds/60}

    function parseGoalTime(value){
      const raw=String(value??'').trim();
      if(!raw)return null;
      if(!/^\d+(?::\d{1,2}){0,2}$/.test(raw))return null;
      const parts=raw.split(':').map(Number);
      if(parts.some(part=>!Number.isFinite(part)))return null;
      let seconds=0;
      if(parts.length===1)seconds=parts[0]*60;
      else if(parts.length===2){
        if(parts[1]>59)return null;
        seconds=parts[0]*60+parts[1];
      }else{
        if(parts[1]>59||parts[2]>59)return null;
        seconds=parts[0]*3600+parts[1]*60+parts[2];
      }
      return clamp(Math.round(seconds),30,3600);
    }

    function formatGoalInput(seconds){
      const safe=clamp(Math.round(Number(seconds)||300),30,3600);
      const hours=Math.floor(safe/3600);
      const minutes=Math.floor((safe%3600)/60);
      const remainder=safe%60;
      return hours?`${hours}:${String(minutes).padStart(2,'0')}:${String(remainder).padStart(2,'0')}`:`${minutes}:${String(remainder).padStart(2,'0')}`;
    }

    function formatDuration(totalSeconds){
      const seconds=Math.max(0,Math.floor(Number(totalSeconds)||0));
      const hours=Math.floor(seconds/3600);
      const minutes=Math.floor((seconds%3600)/60);
      const remainder=seconds%60;
      return hours?`${hours}:${String(minutes).padStart(2,'0')}:${String(remainder).padStart(2,'0')}`:`${minutes}:${String(remainder).padStart(2,'0')}`;
    }

    function updateGoalUI(){
      const currentGoalSeconds=goalSeconds;
      const progress=clamp(cycleSleepSeconds/currentGoalSeconds,0,1);
      const reached=goalEnabled&&cycleSleepSeconds>=currentGoalSeconds;
      sleepTime.textContent=formatDuration(cycleSleepSeconds);
      goalWrap.classList.toggle('is-disabled',!goalEnabled);
      goalTrack.hidden=!goalEnabled;
      goalText.textContent=!goalEnabled?'Goal off':(reached?'Goal reached!':`Goal ${formatDuration(currentGoalSeconds)}`);
      goalFill.style.width=`${goalEnabled?progress*100:0}%`;
      goalTrack.setAttribute('aria-valuemax',String(Math.round(currentGoalSeconds)));
      goalTrack.setAttribute('aria-valuenow',String(Math.round(Math.min(cycleSleepSeconds,currentGoalSeconds))));
      goalTrack.setAttribute('aria-hidden',goalEnabled?'false':'true');
      goalWrap.classList.toggle('is-complete',reached);
      if(reached&&!goalReached){
        goalReached=true;
        goalWrap.classList.remove('sleepymonster-goal-pop');
        void goalWrap.offsetWidth;
        goalWrap.classList.add('sleepymonster-goal-pop');
      }else if(!reached){
        goalReached=false;
      }
    }

    function updateSettingLabels(){
      thresholdValue.textContent=`${Math.round(threshold())}%`;
      sensitivityValue.textContent=`${Math.round(sensitivity())}%`;
      delayValue.textContent=`${quietDelay().toFixed(1)}s`;
      goalEnabledInput.checked=goalEnabled;
      goalInput.disabled=!goalEnabled;
      updateGoalUI();
    }

    function say(text){status.textContent=text}

    function setMode(next,{notify=true}={}){
      const normalized=next==='microphone'?'microphone':'ambient';
      if(mode!==normalized){
        stop();
        mode=normalized;
      }
      m.dataset.sleepyMode=mode;
      micButton.hidden=mode!=='microphone';
      meter.hidden=mode!=='microphone'||!active;
      m.querySelectorAll('[data-sleepy-mode]').forEach(button=>{
        const selected=button.dataset.sleepyMode===mode;
        button.classList.toggle('is-active',selected);
        button.setAttribute('aria-pressed',String(selected));
      });
      m.querySelectorAll('.sleepymonster-mic-setting').forEach(element=>{element.hidden=mode!=='microphone';});
      if(mode==='ambient')say('No mic mode · He will doze off on his own after a little time.');
      else if(!active)say('Microphone mode · Enable it so room noise can wake him up.');
      if(notify)notifyBoardChanged('sleepy-monster-mode');
      wake();
    }

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
      if(state==='wake-stand'||state==='wake-back')sleepCycleActive=false;
      stateTimer=random(1.7,3.6);
      setState(Math.random()<.58?'walk':'idle');
    }

    function fallAsleep(){
      const resumingCycle=state==='wake-stand'||state==='wake-back';
      if(!resumingCycle){
        cycleSleepSeconds=0;
        sleepCycleActive=true;
        goalReached=false;
        updateGoalUI();
      }else{
        sleepCycleActive=true;
      }
      sleepVariant=resumingCycle?sleepVariant:(Math.random()<.5?1:2);
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
      sleepCycleActive=false;
      stateTimer=1.15;
      animationTime=0;
      setState('angry');
    }

    function startGrumpyWalk(){
      stateTimer=random(4.2,6.2);
      animationTime=0;
      setState('grumpy-walk');
    }

    function stop(message='Microphone off · Enable it so the monster can react to room noise.'){
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
      meter.hidden=mode!=='microphone'||!active;
      micButton.disabled=false;
      micButton.textContent='Enable microphone';
      micButton.setAttribute('aria-pressed','false');
      if(mode==='microphone')say(message);
    }

    async function startMicrophone(){
      if(mode!=='microphone')return;
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
    m.querySelectorAll('[data-sleepy-mode]').forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.sleepyMode)));

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
      if(mode==='ambient'){
        if(state==='idle'||state==='walk'||state==='grumpy-walk')quietTime+=dt;
        else quietTime=0;
        loudTime=0;
        return;
      }
      if(!active){
        quietTime=0;
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
      if(sleepCycleActive&&(state==='sleep-stand'||state==='sleep-back')){
        cycleSleepSeconds+=dt;
        updateGoalUI();
      }
      updateNoiseTimers(dt);
      const delay=quietDelay();

      if(state==='idle'||state==='walk'){
        stateTimer-=dt;
        if(quietTime>=delay){fallAsleep();return}
        if(stateTimer<=0)chooseAwakeState();
        return;
      }

      if(state==='sleep-stand'||state==='sleep-back'){
        if(mode==='microphone'&&active&&loudTime>=.22)startWaking();
        return;
      }

      if(state==='wake-stand'||state==='wake-back'){
        stateTimer-=dt;
        if(mode==='microphone'&&active&&quietTime>=.62){fallAsleep();return}
        if(stateTimer<=0){
          if(mode==='microphone'&&active&&level>=threshold())getAngry();
          else chooseAwakeState();
        }
        return;
      }

      if(state==='angry'){
        if(mode!=='microphone'||!active){startGrumpyWalk();return}
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

    function commitGoalTime(){
      const parsed=parseGoalTime(goalInput.value);
      if(parsed===null){
        goalInput.setCustomValidity('Enter a time like 5:00 or 1:00:00.');
        goalInput.reportValidity();
        goalInput.value=formatGoalInput(goalSeconds);
        goalInput.setCustomValidity('');
        return;
      }
      goalSeconds=parsed;
      goalInput.value=formatGoalInput(goalSeconds);
      updateGoalUI();
      notifyBoardChanged('sleepy-monster-goal-time');
    }

    thresholdInput.addEventListener('input',updateSettings);
    sensitivityInput.addEventListener('input',updateSettings);
    delayInput.addEventListener('input',updateSettings);
    goalEnabledInput.addEventListener('change',()=>{
      goalEnabled=goalEnabledInput.checked;
      goalInput.disabled=!goalEnabled;
      updateGoalUI();
      notifyBoardChanged('sleepy-monster-goal-toggle');
    });
    goalInput.addEventListener('change',commitGoalTime);
    goalInput.addEventListener('keydown',event=>{
      if(event.key==='Enter'){
        event.preventDefault();
        commitGoalTime();
        goalInput.blur();
      }
    });

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
      goalEnabled,
      sleepGoalSeconds:goalSeconds,
      sleepGoalMinutes:sleepGoalMinutes(),
      cycleSleepSeconds,
      sleepCycleActive,
      mode,
      state:state==='sleep-stand'||state==='sleep-back'?state:(state==='idle'||state==='walk'?state:'idle'),
      sleepVariant,
      x,
      direction
    });

    m._boardSetState=s=>{
      stop();
      mode=s?.mode==='microphone'?'microphone':'ambient';
      thresholdInput.value=String(clamp(Number(s?.threshold)||45,15,85));
      sensitivityInput.value=String(clamp(Number(s?.sensitivity)||100,30,200));
      delayInput.value=String(clamp(Number(s?.quietDelay)||4.5,1.5,12));
      goalEnabled=s?.goalEnabled!==false;
      goalSeconds=clamp(Math.round(Number(s?.sleepGoalSeconds)||(Number(s?.sleepGoalMinutes)*60)||300),30,3600);
      goalEnabledInput.checked=goalEnabled;
      goalInput.value=formatGoalInput(goalSeconds);
      goalInput.disabled=!goalEnabled;
      cycleSleepSeconds=Math.max(0,Number(s?.cycleSleepSeconds)||0);
      sleepVariant=s?.sleepVariant===2?2:1;
      x=clamp(Number(s?.x)||.28,.16,.84);
      direction=Number(s?.direction)<0?-1:1;
      const restored=STATES.has(s?.state)&&['idle','walk','sleep-stand','sleep-back'].includes(s.state)?s.state:'idle';
      sleepCycleActive=restored==='sleep-stand'||restored==='sleep-back'?s?.sleepCycleActive!==false:false;
      goalReached=goalEnabled&&cycleSleepSeconds>=goalSeconds;
      stateTimer=random(1.8,3.4);
      quietTime=0;
      loudTime=0;
      animationTime=0;
      setState(restored,{announce:false});
      setMode(mode,{notify:false});
      updateSettingLabels();
      updateMovement(0);
      updateSprite(0);
      savedStateRestored=true;
      if(mode==='microphone')say(restored.startsWith('sleep-')?'Still asleep. Enable the microphone so room noise can wake him.':'Microphone mode · Enable it so the monster can react to room noise.');
      else say(restored.startsWith('sleep-')?'Still asleep in No mic mode.':'No mic mode · He will doze off on his own after a little time.');
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

    goalInput.value=formatGoalInput(goalSeconds);
    goalEnabledInput.checked=goalEnabled;
    goalInput.disabled=!goalEnabled;
    updateSettingLabels();
    setMode('ambient',{notify:false});
    setState('idle',{announce:false});
    updateMovement(0);
    updateSprite(0);
    if(!savedStateRestored)say('No mic mode · He will doze off on his own after a little time.');
    wake();
  }

  window.TeacherTilesSleepyMonster=Object.freeze({setup});
})();
