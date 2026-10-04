function setupRobotHfw(m){
  const stage=m.querySelector('.robothfw-stage');
  const timebar=m.querySelector('.robothfw-timebar');
  const robot=m.querySelector('.robothfw-robot');
  const face=m.querySelector('.robothfw-face-sprite');
  const wordTag=m.querySelector('.robothfw-word-tag');
  const wordEl=m.querySelector('.robothfw-word');
  const statusEl=m.querySelector('.robothfw-status');
  const gradeLabel=m.querySelector('.robothfw-grade-label');
  const gradeSelect=m.querySelector('.robothfw-grade');
  const leftCount=m.querySelector('.robothfw-left-count');
  const scoreCount=m.querySelector('.robothfw-score-count');
  const healthText=m.querySelector('.robothfw-health-text');
  const healthFill=m.querySelector('.robothfw-health-fill');
  const settingsButton=m.querySelector('.robothfw-settings-button');
  const settings=m.querySelector('.robothfw-settings');
  const settingsClose=m.querySelector('.robothfw-settings-close');
  const settingsTitle=m.querySelector('.robothfw-settings-title');
  const wordOptions=m.querySelector('.robothfw-word-options');
  const enableAll=m.querySelector('.robothfw-enable-all');
  const disableAll=m.querySelector('.robothfw-disable-all');
  const enabledCount=m.querySelector('.robothfw-enabled-count');
  const endcard=m.querySelector('.robothfw-endcard');
  const endcardTitle=m.querySelector('.robothfw-endcard-title');
  const endcardCopy=m.querySelector('.robothfw-endcard-copy');
  const resetButtons=m.querySelectorAll('.robothfw-reset');
  const startButtons=m.querySelectorAll('.robothfw-start');

  const gradeNames={k:'Kindergarten Pack',1:'Grade 1 Pack',2:'Grade 2 Pack','3plus':'Grade 3+ Pack'};
  const faceMap={
    idle:'0% 0%',happy:'33.333% 0%',alert:'66.666% 0%',
    exclaim:'100% 50%',warn:'33.333% 50%',angry:'33.333% 100%',
    furious:'66.666% 100%',blast:'100% 100%',dizzy:'66.666% 50%'
  };

  const enabledByGrade={};
  Object.entries(HIGH_FREQUENCY_WORD_SETS).forEach(([grade,words])=>{enabledByGrade[grade]=new Set(words)});

  const timers=new Set();
  const maxHealth=5;
  const laserPrototype=new Audio('tiles/robot-hfw/assets/laser.mp3');
  const explodePrototype=new Audio('tiles/robot-hfw/assets/explode.mp3');
  const explodeLayerPrototype=new Audio('tiles/robot-hfw/assets/explode-layer.mp3');
  const rocketLoop=new Audio('tiles/robot-hfw/assets/rocket-loop.mp3');
  laserPrototype.preload='auto';
  explodePrototype.preload='auto';
  explodeLayerPrototype.preload='auto';
  rocketLoop.preload='auto';
  rocketLoop.loop=true;

  let health=maxHealth;
  let currentWord='';
  let incomingWord='';
  let queue=[];
  let completed=0;
  let totalWords=0;
  let phase='ready';
  let wordVisible=false;
  let resizeFrame=0;
  let started=false;
  let disposed=false;

  const measurer=document.createElement('span');
  measurer.className='robothfw-word robothfw-measurer';
  measurer.setAttribute('aria-hidden','true');
  stage.appendChild(measurer);

  const schedule=(fn,delay)=>{
    const timer=window.setTimeout(()=>{timers.delete(timer);if(!disposed&&m.isConnected)fn()},delay);
    timers.add(timer);
    return timer;
  };
  const clearTimers=()=>{for(const timer of timers)window.clearTimeout(timer);timers.clear()};
  const shuffle=list=>{
    const copy=[...list];
    for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]]}
    return copy;
  };
  const enabledWords=grade=>HIGH_FREQUENCY_WORD_SETS[grade].filter(word=>enabledByGrade[grade].has(word));

  const measureWordSize=word=>{
    const rect=wordTag.getBoundingClientRect();
    const maxWidth=Math.max(84,rect.width-20);
    const maxHeight=Math.max(28,rect.height-10);
    measurer.textContent=word;
    const computed=getComputedStyle(wordEl);
    measurer.style.fontFamily=computed.fontFamily;
    measurer.style.fontWeight=computed.fontWeight;
    measurer.style.letterSpacing=computed.letterSpacing;
    let low=12,high=Math.max(18,Math.min(42,Math.floor(maxHeight*1.35))),best=low;
    while(low<=high){
      const mid=Math.floor((low+high)/2);
      measurer.style.fontSize=`${mid}px`;
      const measured=measurer.getBoundingClientRect();
      if(measured.width<=maxWidth+1&&measured.height<=maxHeight+1){best=mid;low=mid+1}else high=mid-1;
    }
    return best;
  };

  const playTileAudio=(prototype,baseVolume=.4,playbackRate=1)=>{
    if(disposed||!m.isConnected)return;
    const level=tileAudioLevel(m);
    if(level<=0)return;
    try{
      const sound=prototype.cloneNode();
      setBoostedMediaVolume(sound,baseVolume*level);
      sound.playbackRate=playbackRate;
      sound.currentTime=0;
      const sounds=m._activeTileSounds||(m._activeTileSounds=new Set());
      sounds.add(sound);
      const release=()=>{releaseBoostedMedia(sound);sounds.delete(sound)};
      sound.addEventListener('ended',release,{once:true});
      sound.addEventListener('error',release,{once:true});
      sound.play().catch(release);
    }catch{}
  };

  const robotIsFlying=()=>!disposed&&m.isConnected&&started&&['intro','active','warn','angry','blasting','escaping'].includes(phase)&&!robot.classList.contains('is-hidden');
  const syncRocketLoop=()=>{
    const level=tileAudioLevel(m);
    rocketLoop.volume=clamp(.024*level,0,.04);
    if(robotIsFlying()&&rocketLoop.volume>0&&!document.hidden){
      rocketLoop.play().catch(()=>{});
    }else{
      rocketLoop.pause();
      if(!robotIsFlying()){try{rocketLoop.currentTime=0}catch{}}
    }
  };
  const onRobotAudioChange=()=>syncRocketLoop();
  m.addEventListener('teachertiles:tileaudiochange',onRobotAudioChange);
  window.addEventListener('teachertiles:audiopreferenceschange',onRobotAudioChange);
  document.addEventListener('visibilitychange',onRobotAudioChange);

  const setFace=key=>{face.style.backgroundPosition=faceMap[key]||faceMap.idle};
  const totalRemaining=()=>queue.length+((currentWord||incomingWord)&&phase!=='won'&&phase!=='lost'&&started?1:0);
  const updateHud=()=>{
    leftCount.textContent=String(totalRemaining());
    scoreCount.textContent=String(completed);
    healthText.textContent=`${health} / ${maxHealth}`;
    healthFill.style.width=`${Math.max(0,health/maxHealth)*100}%`;
    gradeLabel.textContent=gradeNames[m.dataset.hfwGrade||'k'];
  };
  const updateWordFit=()=>{
    cancelAnimationFrame(resizeFrame);
    resizeFrame=requestAnimationFrame(()=>{
      if(!currentWord||wordTag.hidden)return;
      wordEl.style.fontSize=`${measureWordSize(currentWord)}px`;
    });
  };
  const setStatus=message=>{statusEl.textContent=message};

  const stopThreatTimer=()=>{
    stage.classList.remove('is-counting-down');
    timebar?.setAttribute('aria-valuenow','100');
  };
  const startThreatTimer=()=>{
    stage.classList.remove('is-counting-down');
    void timebar?.offsetWidth;
    stage.classList.add('is-counting-down');
    timebar?.setAttribute('aria-valuenow','100');
  };

  const showEndcard=(title,copy,{showStart=false,startLabel='Start',showReset=true}={})=>{
    stopThreatTimer();
    endcardTitle.textContent=title;
    endcardCopy.textContent=copy;
    endcard.hidden=false;
    robot.classList.add('is-hidden');
    syncRocketLoop();
    const endcardStart=endcard.querySelector('.robothfw-start');
    const endcardReset=endcard.querySelector('.robothfw-reset');
    if(endcardStart){endcardStart.textContent=startLabel;endcardStart.hidden=!showStart}
    if(endcardReset)endcardReset.hidden=!showReset;
  };
  const hideEndcard=()=>{endcard.hidden=true};

  const createParticle=(className,x,y,vars={},lifetime=900)=>{
    const node=document.createElement('span');
    node.className=className;
    node.style.left=`${x}px`;
    node.style.top=`${y}px`;
    for(const [key,value] of Object.entries(vars))node.style.setProperty(key,String(value));
    stage.appendChild(node);
    schedule(()=>node.remove(),lifetime);
    return node;
  };
  const playExplosionMix=(baseVolume=.52)=>{
    playTileAudio(explodePrototype,baseVolume,1);
    playTileAudio(explodeLayerPrototype,baseVolume*.48,1.02);
  };
  const createBurst=(x,y,{count=12,color='rgba(255,188,75,.95)',size=12,spread=82,className='robothfw-particle'}={})=>{
    for(let i=0;i<count;i++){
      const distance=spread*(.38+Math.random()*.9),angle=Math.random()*Math.PI*2;
      createParticle(className,x,y,{
        '--burst-size':`${Math.max(6,size+Math.random()*size)}px`,
        '--burst-color':i%4===0?'rgba(255,255,255,.98)':color,
        '--burst-x':`${Math.cos(angle)*distance}px`,
        '--burst-y':`${Math.sin(angle)*distance}px`,
        '--burst-rot':`${(Math.random()*620)-310}deg`
      },760);
    }
  };
  const createExplosion=(x,y,{power='pop'}={})=>{
    const popped=power==='pop';
    const warmColor=popped?'rgba(255,173,31,.98)':'rgba(248,113,113,.94)';
    const coolColor=popped?'rgba(191,219,254,.96)':'rgba(255,255,255,.95)';

    createParticle('robothfw-comic-burst robothfw-comic-burst--behind',x,y,{
      '--comic-burst-spin':`${Math.round(Math.random()*12-6)}deg`,
      '--comic-size':popped?'250px':'180px',
      '--comic-duration':popped?'.96s':'.76s'
    },1100);
    createParticle(`robothfw-comic-burst robothfw-comic-burst--front${popped?'':' robothfw-comic-burst--small'}`,x,y,{
      '--comic-burst-spin':`${Math.round(Math.random()*18-9)}deg`,
      '--comic-size':popped?'216px':'154px',
      '--comic-duration':popped?'.86s':'.72s'
    },1000);

    const miniCount=popped?3:2;
    for(let i=0;i<miniCount;i++){
      const angle=Math.random()*Math.PI*2;
      const distance=(popped?48:32)+Math.random()*(popped?82:48);
      const behind=i%2===0;
      const delay=55+i*42+Math.random()*65;
      createParticle(`robothfw-comic-burst robothfw-comic-burst--mini ${behind?'robothfw-comic-burst--behind':'robothfw-comic-burst--front'}`,
        x+Math.cos(angle)*distance,
        y+Math.sin(angle)*distance*.7,
        {
          '--comic-burst-spin':`${Math.round(Math.random()*34-17)}deg`,
          '--comic-size':`${Math.round((popped?58:42)+Math.random()*(popped?56:38))}px`,
          '--comic-duration':`${(.46+Math.random()*.24).toFixed(2)}s`,
          '--comic-delay':`${Math.round(delay)}ms`
        },1200);
    }

    createBurst(x,y,{count:popped?22:14,color:warmColor,size:popped?8:6,spread:popped?148:92,className:'robothfw-particle robothfw-particle--spark'});
    createBurst(x,y,{count:popped?12:8,color:coolColor,size:popped?11:8,spread:popped?112:62,className:'robothfw-particle robothfw-particle--metal'});
    createBurst(x,y,{count:popped?8:5,color:'rgba(71,85,105,.86)',size:popped?9:7,spread:popped?132:70,className:'robothfw-particle robothfw-particle--debris'});
    createParticle('robothfw-shockwave',x,y,{'--ring-color':warmColor},760);
    createParticle('robothfw-shockwave robothfw-shockwave--late',x,y,{'--ring-color':coolColor},900);
    createParticle('robothfw-flash',x,y,{'--flash-color':popped?'rgba(255,251,235,.98)':'rgba(254,202,202,.9)'},460);
    for(let i=0;i<(popped?8:3);i++){
      createParticle('robothfw-smoke',x+(Math.random()*28-14),y+(Math.random()*24-12),{
        '--smoke-x':`${(Math.random()*2-1)*(popped?46:22)}px`,
        '--smoke-y':`${-(28+Math.random()*(popped?70:34))}px`,
        '--smoke-scale':`${.9+Math.random()*1.65}`
      },1180);
    }
  };
  const robotCenter=()=>{
    const stageRect=stage.getBoundingClientRect(),rect=robot.getBoundingClientRect();
    const scaleX=stageRect.width/stage.offsetWidth||1,scaleY=stageRect.height/stage.offsetHeight||1;
    return{x:(rect.left-stageRect.left+rect.width*.5)/scaleX-stage.clientLeft,y:(rect.top-stageRect.top+rect.height*.5)/scaleY-stage.clientTop};
  };
  const clearEffects=()=>{
    stage.querySelectorAll('.robothfw-particle,.robothfw-shockwave,.robothfw-smoke,.robothfw-flash,.robothfw-comic-burst').forEach(node=>node.remove());
  };

  const applyWord=word=>{
    currentWord=word;
    wordEl.textContent=word;
    wordEl.style.fontSize=`${measureWordSize(word)}px`;
    robot.setAttribute('aria-label',`Tap the robot carrying ${word}`);
  };
  const clearRobotStateClasses=()=>robot.classList.remove('is-hidden','is-arriving','is-live','is-warning','is-angry','is-popped','is-blasting','is-escaping');
  const clearVisibleWord=()=>{
    wordTag.classList.remove('is-deploying');
    wordTag.hidden=true;
    wordVisible=false;
    wordEl.textContent='';
    wordEl.style.fontSize='';
    robot.setAttribute('aria-label','Tap the robot before it blasts you');
  };

  const startWarnings=()=>{
    startThreatTimer();
    schedule(()=>{
      if(phase!=='active')return;
      phase='warn';
      setFace('warn');
      robot.classList.add('is-warning');
      updateHud();
    },2200);
    schedule(()=>{
      if(phase!=='warn')return;
      phase='angry';
      setFace('furious');
      robot.classList.add('is-angry');
      updateHud();
    },4200);
    schedule(()=>{if(['active','warn','angry'].includes(phase))blastPlayer()},6200);
  };

  const spawnRobot=()=>{
    clearTimers();
    clearEffects();
    stopThreatTimer();
    hideEndcard();
    clearRobotStateClasses();
    robot.classList.add('is-hidden');
    robot.disabled=true;
    clearVisibleWord();
    currentWord='';
    incomingWord='';
    syncRocketLoop();
    updateHud();

    if(health<=0){
      started=false;
      phase='lost';
      setStatus('You are out of health. Press Start to try again.');
      showEndcard('Game over','The robots blasted through your health bar.',{showStart:true,startLabel:'Start Again',showReset:true});
      return;
    }
    if(!queue.length){
      started=false;
      phase='won';
      setStatus('You cleared the whole pack!');
      showEndcard('Pack complete!','Every robot in this pack has been popped.',{showStart:true,startLabel:'Play Again',showReset:true});
      return;
    }

    const next=queue.shift();
    incomingWord=next;
    phase='intro';
    setFace('exclaim');
    setStatus('Incoming robot!');
    updateHud();

    schedule(()=>{
      robot.classList.remove('is-hidden');
      robot.classList.add('is-arriving');
      robot.disabled=false;
      syncRocketLoop();
    },90);

    schedule(()=>{
      if(phase!=='intro')return;
      applyWord(incomingWord||next);
      incomingWord='';
      wordTag.classList.remove('is-deploying');
      wordTag.hidden=false;
      void wordTag.offsetWidth;
      wordTag.classList.add('is-deploying');
      wordVisible=true;
      robot.classList.add('is-live');
      phase='active';
      setFace(Math.random()>.5?'idle':'happy');
      updateWordFit();
      updateHud();
      syncRocketLoop();
      schedule(()=>wordTag.classList.remove('is-deploying'),720);
      startWarnings();
    },790);
  };

  function blastPlayer(){
    clearTimers();
    stopThreatTimer();
    phase='blasting';
    health=Math.max(0,health-1);
    setFace('blast');
    robot.disabled=true;
    robot.classList.add('is-blasting');
    stage.classList.add('is-hit');
    setStatus(`${currentWord||incomingWord||'The robot'} blasted you.`);
    updateHud();
    syncRocketLoop();
    const {x,y}=robotCenter();
    playTileAudio(laserPrototype,.55,1);
    createExplosion(x,y,{power:'blast'});
    schedule(()=>stage.classList.remove('is-hit'),360);
    schedule(()=>{
      robot.classList.remove('is-blasting');
      robot.classList.add('is-escaping');
      phase='escaping';
      setFace('furious');
      syncRocketLoop();
    },180);
    schedule(()=>spawnRobot(),1080);
    notifyBoardChanged('robot-hfw-blast');
  }

  const popRobot=()=>{
    if(!['intro','active','warn','angry'].includes(phase))return;
    clearTimers();
    stopThreatTimer();
    const poppedWord=currentWord||incomingWord;
    phase='popped';
    completed+=1;
    robot.disabled=true;
    robot.classList.remove('is-live','is-warning','is-angry');
    robot.classList.add('is-popped');
    setFace('dizzy');
    clearVisibleWord();
    currentWord='';
    incomingWord='';
    syncRocketLoop();
    setStatus(`You popped ${poppedWord}.`);
    updateHud();
    const {x,y}=robotCenter();
    playExplosionMix(.52);
    createExplosion(x,y,{power:'pop'});
    schedule(()=>robot.classList.add('is-hidden'),700);
    schedule(()=>spawnRobot(),1080);
    notifyBoardChanged('robot-hfw-pop');
  };

  const renderSettings=()=>{
    const grade=m.dataset.hfwGrade||'k',words=HIGH_FREQUENCY_WORD_SETS[grade],enabled=enabledByGrade[grade];
    settingsTitle.textContent=gradeNames[grade];
    enabledCount.textContent=`${enabled.size} of ${words.length} enabled`;
    wordOptions.replaceChildren();
    words.forEach(word=>{
      const button=document.createElement('button');
      button.type='button';
      button.className='robothfw-word-option';
      button.textContent=word;
      button.classList.toggle('is-enabled',enabled.has(word));
      button.setAttribute('aria-pressed',String(enabled.has(word)));
      button.addEventListener('click',()=>{
        if(enabled.has(word))enabled.delete(word);else enabled.add(word);
        button.classList.toggle('is-enabled',enabled.has(word));
        button.setAttribute('aria-pressed',String(enabled.has(word)));
        enabledCount.textContent=`${enabled.size} of ${words.length} enabled`;
        resetRound(false);
        renderSettings();
      });
      wordOptions.appendChild(button);
    });
  };

  const setReadyPanel=(copy='Press Start when you are ready.')=>{
    clearTimers();
    clearEffects();
    stopThreatTimer();
    started=false;
    phase='ready';
    clearRobotStateClasses();
    robot.classList.add('is-hidden');
    robot.disabled=true;
    clearVisibleWord();
    currentWord='';
    incomingWord='';
    setFace('alert');
    setStatus('Press Start to begin Robot HFW.');
    syncRocketLoop();
    showEndcard('Robot HFW',copy,{showStart:true,startLabel:'Start',showReset:true});
    updateHud();
  };

  const resetRound=(notify=true)=>{
    clearTimers();
    stopThreatTimer();
    const grade=m.dataset.hfwGrade||'k';
    queue=shuffle(enabledWords(grade));
    totalWords=queue.length;
    completed=0;
    health=maxHealth;
    started=false;
    renderSettings();
    if(!totalWords){
      phase='empty';
      clearRobotStateClasses();
      robot.classList.add('is-hidden');
      robot.disabled=true;
      clearVisibleWord();
      currentWord='';
      incomingWord='';
      setFace('alert');
      setStatus('No words are enabled for this pack.');
      syncRocketLoop();
      showEndcard('No words enabled','Choose Edit Words and turn on at least one word for this pack.',{showStart:false,showReset:true});
      updateHud();
    }else setReadyPanel(`Press Start to battle the ${gradeNames[grade]}.`);
    if(notify)notifyBoardChanged('robot-hfw-reset');
  };

  const startGame=()=>{
    if(disposed||!m.isConnected)return;
    if(['active','warn','angry','intro','blasting','escaping','popped'].includes(phase))return;
    if(phase==='won'||phase==='lost'||phase==='empty'||!queue.length)resetRound(false);
    if(!queue.length)return;
    started=true;
    hideEndcard();
    setStatus('Launching Robot HFW…');
    spawnRobot();
    notifyBoardChanged('robot-hfw-start');
  };

  const setGrade=grade=>{
    const next=grade in gradeNames?grade:'k';
    m.dataset.hfwGrade=next;
    gradeSelect.value=next;
    gradeLabel.textContent=gradeNames[next];
    resetRound(true);
  };

  robot.addEventListener('click',popRobot);
  gradeSelect.addEventListener('change',()=>setGrade(gradeSelect.value));
  settingsButton.addEventListener('click',()=>{renderSettings();settings.hidden=false});
  settingsClose.addEventListener('click',()=>{settings.hidden=true});
  settings.addEventListener('pointerdown',event=>{if(event.target===settings)settings.hidden=true});
  enableAll.addEventListener('click',()=>{
    const grade=m.dataset.hfwGrade||'k';enabledByGrade[grade]=new Set(HIGH_FREQUENCY_WORD_SETS[grade]);resetRound(true);
  });
  disableAll.addEventListener('click',()=>{
    const grade=m.dataset.hfwGrade||'k';enabledByGrade[grade].clear();resetRound(true);
  });
  resetButtons.forEach(button=>button.addEventListener('click',()=>resetRound(true)));
  startButtons.forEach(button=>button.addEventListener('click',startGame));

  m.querySelector('.robothfw-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.robothfw-font').addEventListener('click',()=>{cycleData(m,'font',FONT_OPTIONS);updateWordFit()});
  m.querySelector('.robothfw-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));

  const ro=new ResizeObserver(()=>{if(wordVisible)updateWordFit()});
  ro.observe(stage);ro.observe(wordTag);

  resetRound(false);

  m._boardGetState=()=>({
    grade:m.dataset.hfwGrade||'k',
    enabledByGrade:Object.fromEntries(Object.entries(enabledByGrade).map(([grade,set])=>[grade,[...set]])),
    queue:[...queue],completed,totalWords,health,currentWord,incomingWord,phase,wordVisible,status:statusEl.textContent,started
  });
  m._boardSetState=state=>{
    if(!state)return;
    const savedEnabled=state.enabledByGrade&&typeof state.enabledByGrade==='object'?state.enabledByGrade:{};
    for(const [grade,words] of Object.entries(HIGH_FREQUENCY_WORD_SETS)){
      const allowed=new Set(words),saved=Array.isArray(savedEnabled[grade])?savedEnabled[grade].filter(word=>allowed.has(word)):words;
      enabledByGrade[grade]=new Set(saved);
    }
    const grade=state.grade in gradeNames?state.grade:'k';
    m.dataset.hfwGrade=grade;gradeSelect.value=grade;gradeLabel.textContent=gradeNames[grade];
    queue=Array.isArray(state.queue)?state.queue.filter(word=>enabledByGrade[grade].has(word)):shuffle(enabledWords(grade));
    completed=Math.max(0,Number(state.completed)||0);
    totalWords=Math.max(completed+queue.length+((state.currentWord||state.incomingWord)?1:0),Number(state.totalWords)||0);
    health=Math.max(0,Math.min(maxHealth,Number(state.health)||maxHealth));
    currentWord=String(state.currentWord||'');
    incomingWord=String(state.incomingWord||'');
    phase=String(state.phase||'ready');wordVisible=Boolean(state.wordVisible);started=Boolean(state.started);
    statusEl.textContent=String(state.status||'Press Start to begin Robot HFW.');
    renderSettings();clearTimers();stopThreatTimer();clearRobotStateClasses();clearVisibleWord();robot.disabled=true;

    if(!enabledWords(grade).length){resetRound(false);return}
    if(phase==='lost')showEndcard('Game over','The robots blasted through your health bar.',{showStart:true,startLabel:'Start Again',showReset:true});
    else if(phase==='won')showEndcard('Pack complete!','Every robot in this pack has been popped.',{showStart:true,startLabel:'Play Again',showReset:true});
    else if(!started||phase==='ready'||phase==='empty')setReadyPanel(`Press Start to battle the ${gradeNames[grade]}.`);
    else if(currentWord||incomingWord){
      hideEndcard();
      robot.classList.remove('is-hidden');
      robot.disabled=false;
      if(currentWord){
        applyWord(currentWord);
        wordTag.hidden=!wordVisible;
        if(wordVisible)updateWordFit();
        robot.classList.add('is-live');
        if(phase==='warn'){setFace('warn');robot.classList.add('is-warning')}
        else if(phase==='angry'){setFace('furious');robot.classList.add('is-warning','is-angry')}
        else{phase='active';setFace('idle')}
        syncRocketLoop();startWarnings();
      }else{
        clearVisibleWord();
        robot.classList.add('is-arriving');
        setFace('exclaim');
        syncRocketLoop();
      }
    }else setReadyPanel(`Press Start to battle the ${gradeNames[grade]}.`);
    updateHud();
  };

  const stopSounds=()=>{
    rocketLoop.pause();try{rocketLoop.currentTime=0}catch{}
    for(const sound of m._activeTileSounds||[]){sound.pause();releaseBoostedMedia(sound);try{sound.currentTime=0}catch{}}
    m._activeTileSounds?.clear();
  };
  const priorDeactivate=m._deactivate;
  m._deactivate=()=>{
    const pending=currentWord||incomingWord;
    if(pending&&['intro','active','warn','angry'].includes(phase))queue.unshift(pending);
    setReadyPanel('Press Start to continue your word pack.');
    stage.classList.remove('is-hit');
    cancelAnimationFrame(resizeFrame);
    stopSounds();
    priorDeactivate?.();
  };
  const prior=m._cleanup;
  m._cleanup=()=>{
    disposed=true;started=false;
    stopSounds();
    prior?.();
    clearTimers();clearEffects();stopThreatTimer();
    ro.disconnect();cancelAnimationFrame(resizeFrame);measurer.remove();
    m.removeEventListener('teachertiles:tileaudiochange',onRobotAudioChange);
    window.removeEventListener('teachertiles:audiopreferenceschange',onRobotAudioChange);
    document.removeEventListener('visibilitychange',onRobotAudioChange);
    rocketLoop.pause();try{rocketLoop.currentTime=0}catch{}
  };
}
