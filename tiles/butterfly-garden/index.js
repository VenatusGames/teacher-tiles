(() => {
  'use strict';

  const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));
  const FLOWER_BASE_WIDTH=78;
  const FLOWER_HEIGHT_RATIO=1.42;
  const BUTTERFLY_BASE_WIDTH=72;
  const GOLDEN_BASE_WIDTH=80;
  const GROWTH_INTERVAL_AMBIENT=8;
  const GROWTH_INTERVAL_QUIET=6;
  const GOLDEN_AMBIENT_DELAY=180;
  const GOLDEN_QUIET_DELAY=14;
  const FLOWER_SOURCES=Array.from({length:10},(_,index)=>`tiles/butterfly-garden/assets/flower-${String(index+1).padStart(2,'0')}.png`);
  const BUTTERFLY_VARIANTS=[
    {id:'blue',src:'tiles/butterfly-garden/assets/butterfly-blue.png'},
    {id:'mint',src:'tiles/butterfly-garden/assets/butterfly-mint.png'},
    {id:'pink',src:'tiles/butterfly-garden/assets/butterfly-pink.png'}
  ];
  const GOLDEN_VARIANT={id:'golden',src:'tiles/butterfly-garden/assets/butterfly-gold.png'};

  [...FLOWER_SOURCES,...BUTTERFLY_VARIANTS.map(item=>item.src),GOLDEN_VARIANT.src].forEach(src=>{
    const image=new Image();
    image.src=src;
  });

  function randomBetween(min,max){return min+Math.random()*(max-min)}
  function pick(list){return list[Math.floor(Math.random()*list.length)]}

  function setup(moduleElement){
    const stage=moduleElement.querySelector('.butterflygarden-stage');
    const flowerLayer=moduleElement.querySelector('.butterflygarden-flowers');
    const butterflyLayer=moduleElement.querySelector('.butterflygarden-butterflies');
    const particlesCanvas=moduleElement.querySelector('.butterflygarden-particles');
    const particlesContext=particlesCanvas.getContext('2d');
    const counts=moduleElement.querySelector('.butterflygarden-counts');
    const status=moduleElement.querySelector('.butterflygarden-status');
    const meter=moduleElement.querySelector('.butterflygarden-meter');
    const micButton=moduleElement.querySelector('.butterflygarden-mic');
    const rareBadge=moduleElement.querySelector('.butterflygarden-rare');
    const thresholdInput=moduleElement.querySelector('.butterflygarden-threshold');
    const thresholdValue=moduleElement.querySelector('.butterflygarden-threshold-value');
    const sensitivityInput=moduleElement.querySelector('.butterflygarden-sensitivity');
    const sensitivityValue=moduleElement.querySelector('.butterflygarden-sensitivity-value');

    let flowers=[];
    let butterflies=[];
    let particles=[];
    let mode='ambient';
    let active=false;
    let pending=false;
    let disposed=false;
    let visible=true;
    let animationFrame=0;
    let lastFrameTime=0;
    let elapsed=0;
    let level=0;
    let quietRun=0;
    let veryQuietRun=0;
    let ambientRun=0;
    let growthCharge=0;
    let goldenCooldown=32;
    let stream=null;
    let audioContext=null;
    let analyser=null;
    let samples=null;
    let requestToken=0;

    function notify(reason){window.notifyBoardChanged?.(`butterfly-garden-${reason}`)}
    function getThreshold(){return clamp(Number(thresholdInput.value)||45,15,85)}
    function getSensitivity(){return clamp(Number(sensitivityInput.value)||100,30,200)}
    function maxFlowers(){
      const rect=stage.getBoundingClientRect();
      const area=Math.max(1,rect.width*rect.height);
      return clamp(Math.round(area/5200),14,28);
    }
    function regularButterflyTarget(){
      if(flowers.length<10)return 0;
      return Math.min(4,1+Math.floor((flowers.length-10)/5));
    }
    function say(text){if(status.textContent!==text)status.textContent=text}

    function refreshCounts(){
      const butterflyCount=butterflies.length;
      const flowerLabel=flowers.length===1?'flower':'flowers';
      const butterflyLabel=butterflyCount===1?'butterfly':'butterflies';
      counts.textContent=`${flowers.length} ${flowerLabel} · ${butterflyCount} ${butterflyLabel}`;
    }

    function clearFlowers(){
      flowers.forEach(flower=>flower.element.remove());
      flowers=[];
      refreshCounts();
    }

    function clearButterflies(){
      butterflies.forEach(butterfly=>butterfly.element.remove());
      butterflies=[];
      rareBadge.hidden=true;
      refreshCounts();
    }

    function stageSize(){
      return {width:Math.max(240,stage.clientWidth||360),height:Math.max(120,stage.clientHeight||200)};
    }

    function chooseFlowerSpot(){
      const {width,height}=stageSize();
      for(let attempt=0;attempt<120;attempt+=1){
        const x=randomBetween(.08,.92);
        const base=randomBetween(.02,.21);
        const scale=randomBetween(.76,1.28);
        const radius=16+scale*20;
        let blocked=false;
        for(const flower of flowers){
          const dx=(x-flower.x)*width;
          const dy=(base-flower.base)*height*1.35;
          const minDistance=(radius+flower.radius)*.82;
          if(dx*dx+dy*dy<minDistance*minDistance){blocked=true;break;}
        }
        if(!blocked)return{x,base,scale,radius};
      }
      return null;
    }

    function sortFlowers(){
      flowers.sort((a,b)=>a.base-b.base||a.x-b.x);
      flowers.forEach((flower,index)=>{flower.element.style.zIndex=String(2+index);});
    }

    function addFlower(seed={},notifyChange=true){
      if(flowers.length>=maxFlowers())return false;
      const spot=seed.x==null?chooseFlowerSpot():{
        x:clamp(Number(seed.x)||.5,.05,.95),
        base:clamp(Number(seed.base)||.08,.01,.24),
        scale:clamp(Number(seed.scale)||1,.72,1.34),
        radius:16+clamp(Number(seed.scale)||1,.72,1.34)*20
      };
      if(!spot)return false;
      const assetIndex=Number.isInteger(seed.assetIndex)?((seed.assetIndex%FLOWER_SOURCES.length)+FLOWER_SOURCES.length)%FLOWER_SOURCES.length:Math.floor(Math.random()*FLOWER_SOURCES.length);
      const image=document.createElement('img');
      image.className='butterflygarden-flower';
      image.src=FLOWER_SOURCES[assetIndex];
      image.alt='';
      image.draggable=false;
      image.decoding='async';
      flowerLayer.appendChild(image);
      flowers.push({
        element:image,
        assetIndex,
        x:spot.x,
        base:spot.base,
        scale:spot.scale,
        growth:clamp(Number(seed.growth)||0,0,1),
        radius:spot.radius,
        swaySeed:randomBetween(0,Math.PI*2)
      });
      sortFlowers();
      refreshCounts();
      if(notifyChange)notify('flower-grown');
      return true;
    }

    function getFlowerVisualMetrics(flower){
      const grownScale=Math.max(.32,flower.growth)*flower.scale;
      const width=FLOWER_BASE_WIDTH*grownScale;
      const height=FLOWER_BASE_WIDTH*FLOWER_HEIGHT_RATIO*grownScale;
      const {width:stageWidth,height:stageHeight}=stageSize();
      return {
        width,
        height,
        left:flower.x*stageWidth,
        bottom:flower.base*stageHeight,
        nectarX:flower.x*stageWidth,
        nectarY:stageHeight-(flower.base*stageHeight+height*.74)
      };
    }

    function updateFlowerStyles(dt){
      for(const flower of flowers){
        flower.growth=Math.min(1,flower.growth+dt*.82);
        const sway=Math.sin(elapsed*.8+flower.swaySeed)*3.2;
        const rise=Math.sin(elapsed*.52+flower.swaySeed)*1.8;
        flower.element.style.left=`${(flower.x*100).toFixed(3)}%`;
        flower.element.style.bottom=`${(flower.base*100).toFixed(3)}%`;
        flower.element.style.transform=`translateX(-50%) translateY(${rise.toFixed(2)}px) rotate(${sway.toFixed(2)}deg) scale(${(flower.growth*flower.scale).toFixed(4)})`;
      }
    }

    function removeButterfly(target){
      const index=butterflies.indexOf(target);
      if(index>=0)butterflies.splice(index,1);
      target.element.remove();
      if(target.isGolden)rareBadge.hidden=true;
      refreshCounts();
    }

    function chooseButterflyTarget(butterfly){
      if(!flowers.length){
        butterfly.target=null;
        butterfly.nextHop=elapsed+2;
        return;
      }
      const candidates=[...flowers].sort(()=>Math.random()-.5).slice(0,Math.min(flowers.length,5));
      butterfly.target=pick(candidates);
      butterfly.nextHop=elapsed+randomBetween(2.6,5.3)+(butterfly.isGolden?1.5:0);
    }

    function spawnButterfly(variant){
      const image=document.createElement('img');
      image.className=`butterflygarden-butterfly${variant.id==='golden'?' is-golden':''}`;
      image.src=variant.src;
      image.alt='';
      image.draggable=false;
      image.decoding='async';
      butterflyLayer.appendChild(image);
      const {width,height}=stageSize();
      const butterfly={
        element:image,
        id:variant.id,
        x:randomBetween(width*.18,width*.82),
        y:randomBetween(height*.18,height*.48),
        phase:randomBetween(0,Math.PI*2),
        nextHop:0,
        target:null,
        facing:1,
        isGolden:variant.id==='golden',
        particleClock:randomBetween(.04,.22)
      };
      butterflies.push(butterfly);
      chooseButterflyTarget(butterfly);
      if(butterfly.isGolden)rareBadge.hidden=false;
      refreshCounts();
      return butterfly;
    }

    function ensureButterflyPopulation(){
      const goal=regularButterflyTarget();
      const regular=butterflies.filter(butterfly=>!butterfly.isGolden);
      while(regular.length<goal){regular.push(spawnButterfly(pick(BUTTERFLY_VARIANTS)));}
      while(regular.length>goal){removeButterfly(regular.pop());}
      if(flowers.length<10){
        butterflies.filter(butterfly=>butterfly.isGolden).forEach(removeButterfly);
      }
    }

    function maybeSpawnGoldenButterfly(dt){
      if(flowers.length<10)return;
      const activeGolden=butterflies.some(butterfly=>butterfly.isGolden);
      if(activeGolden)return;
      goldenCooldown=Math.max(0,goldenCooldown-dt);
      if(goldenCooldown>0)return;
      const quietReady=mode==='microphone'&&active&&veryQuietRun>=GOLDEN_QUIET_DELAY;
      const ambientReady=mode==='ambient'&&ambientRun>=GOLDEN_AMBIENT_DELAY;
      if(!quietReady&&!ambientReady)return;
      const chance=quietReady?dt/6:dt/16;
      if(Math.random()<chance){
        const golden=spawnButterfly(GOLDEN_VARIANT);
        golden.leaveAt=elapsed+randomBetween(14,22);
        goldenCooldown=randomBetween(60,110);
        notify('golden-visitor');
      }
    }

    function spawnParticle(x,y,isGolden){
      particles.push({
        x,
        y,
        vx:randomBetween(-9,9),
        vy:randomBetween(15,30),
        size:isGolden?randomBetween(1.6,3.2):randomBetween(1.2,2.3),
        life:0,
        maxLife:isGolden?randomBetween(.9,1.45):randomBetween(1.2,1.9),
        swaySeed:randomBetween(0,Math.PI*2),
        isGolden
      });
    }

    function updateButterflies(dt){
      const {width,height}=stageSize();
      for(const butterfly of butterflies.slice()){
        if(butterfly.leaveAt&&elapsed>butterfly.leaveAt){
          removeButterfly(butterfly);
          continue;
        }
        if(!butterfly.target||!flowers.includes(butterfly.target)||elapsed>butterfly.nextHop)chooseButterflyTarget(butterfly);
        let destinationX=width*.5;
        let destinationY=height*.3;
        if(butterfly.target){
          const targetMetrics=getFlowerVisualMetrics(butterfly.target);
          destinationX=targetMetrics.nectarX+Math.sin(elapsed*.8+butterfly.phase)*8;
          destinationY=targetMetrics.nectarY-randomBetween(18,30)-(butterfly.isGolden?7:0);
        }
        butterfly.facing=destinationX>=butterfly.x?1:-1;
        butterfly.x+= (destinationX-butterfly.x)*Math.min(1,dt*1.8);
        butterfly.y+= (destinationY-butterfly.y)*Math.min(1,dt*1.8);
        const hover=Math.sin(elapsed*5.6+butterfly.phase)*(butterfly.isGolden?7:5);
        const drift=Math.cos(elapsed*2.4+butterfly.phase)*3;
        const flap=1+Math.sin(elapsed*18+butterfly.phase)*.045;
        const tilt=Math.sin(elapsed*3.8+butterfly.phase)*4.2;
        const drawX=clamp(butterfly.x+drift,18,width-18);
        const drawY=clamp(butterfly.y+hover,12,height-10);
        butterfly.element.style.left=`${drawX.toFixed(2)}px`;
        butterfly.element.style.top=`${drawY.toFixed(2)}px`;
        butterfly.element.style.transform=`translate(-50%,-50%) scale(${(butterfly.facing*flap).toFixed(4)},${flap.toFixed(4)}) rotate(${tilt.toFixed(2)}deg)`;
        butterfly.particleClock-=dt;
        if(butterfly.particleClock<=0){
          spawnParticle(drawX,drawY+(butterfly.isGolden?6:10),butterfly.isGolden);
          butterfly.particleClock=butterfly.isGolden?randomBetween(.05,.11):randomBetween(.14,.28);
        }
      }
    }

    function updateParticles(dt){
      const {height}=stageSize();
      for(const particle of particles){
        particle.life+=dt;
        particle.x+=particle.vx*dt+Math.sin(elapsed*2.2+particle.swaySeed)*3*dt;
        particle.y+=particle.vy*dt;
        particle.vy+=14*dt;
      }
      particles=particles.filter(particle=>particle.life<particle.maxLife&&particle.y<height+24);
    }

    function resizeCanvas(){
      const rect=particlesCanvas.getBoundingClientRect();
      const ratio=Math.min(window.devicePixelRatio||1,2);
      particlesCanvas.width=Math.max(1,Math.round(rect.width*ratio));
      particlesCanvas.height=Math.max(1,Math.round(rect.height*ratio));
      particlesContext.setTransform(ratio,0,0,ratio,0,0);
    }

    function drawParticles(){
      const rect=particlesCanvas.getBoundingClientRect();
      particlesContext.clearRect(0,0,rect.width,rect.height);
      for(const particle of particles){
        const alpha=1-particle.life/particle.maxLife;
        particlesContext.beginPath();
        particlesContext.fillStyle=particle.isGolden?`rgba(244,196,69,${(alpha*.9).toFixed(4)})`:`rgba(231,191,84,${(alpha*.42).toFixed(4)})`;
        particlesContext.shadowColor=particle.isGolden?'rgba(255,211,92,.6)':'rgba(245,223,141,.28)';
        particlesContext.shadowBlur=particle.isGolden?8:3;
        particlesContext.arc(particle.x,particle.y,particle.size,0,Math.PI*2);
        particlesContext.fill();
      }
      particlesContext.shadowBlur=0;
      particlesContext.shadowColor='transparent';
    }

    function stopMicrophone(message='Microphone off · Enable it so quiet voices help the garden grow.'){
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
      meter.value=0;
      micButton.disabled=false;
      micButton.textContent='Enable microphone';
      micButton.setAttribute('aria-pressed','false');
      if(mode==='microphone')say(message);
    }

    function applySettings(notifyChange=true){
      thresholdInput.value=String(getThreshold());
      thresholdValue.textContent=`${thresholdInput.value}%`;
      sensitivityInput.value=String(getSensitivity());
      sensitivityValue.textContent=`${sensitivityInput.value}%`;
      if(notifyChange)notify('settings');
    }

    function setMode(nextMode,{notifyChange=true}={}){
      const normalized=nextMode==='microphone'?'microphone':'ambient';
      if(mode!==normalized){
        stopMicrophone();
        mode=normalized;
      }
      meter.hidden=mode!=='microphone';
      micButton.hidden=mode!=='microphone';
      moduleElement.dataset.butterflyMode=mode;
      moduleElement.querySelectorAll('[data-butterfly-mode]').forEach(button=>{
        const selected=button.dataset.butterflyMode===mode;
        button.classList.toggle('is-active',selected);
        button.setAttribute('aria-pressed',String(selected));
      });
      moduleElement.querySelectorAll('.butterflygarden-mic-setting').forEach(element=>{element.hidden=mode!=='microphone';});
      if(mode==='ambient')say('No mic mode · Flowers grow over time and butterflies visit later.');
      else if(!active) say('Microphone off · Enable it so quiet voices help the garden grow.');
      if(notifyChange)notify('mode');
      wake();
    }

    async function startMicrophone(){
      if(active||pending||mode!=='microphone')return;
      if(!navigator.mediaDevices?.getUserMedia){
        say('Microphone unavailable on this device. You can still use No mic mode.');
        return;
      }
      pending=true;
      micButton.disabled=false;
      micButton.textContent='Cancel microphone request';
      say('Allow microphone access to let quiet voices grow the garden.');
      const token=++requestToken;
      try{
        const incoming=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
        if(disposed||token!==requestToken){incoming.getTracks().forEach(track=>track.stop());return;}
        stream=incoming;
        audioContext=new (window.AudioContext||window.webkitAudioContext)();
        await audioContext.resume();
        if(disposed||token!==requestToken)return;
        analyser=audioContext.createAnalyser();
        analyser.fftSize=1024;
        samples=new Uint8Array(analyser.fftSize);
        audioContext.createMediaStreamSource(stream).connect(analyser);
        active=true;
        pending=false;
        micButton.textContent='Turn microphone off';
        micButton.setAttribute('aria-pressed','true');
        stream.getAudioTracks().forEach(track=>track.addEventListener('ended',()=>{if(active)stopMicrophone('Microphone disconnected. Enable it again to keep using quiet mode.');},{once:true}));
        wake();
      }catch(error){
        if(token!==requestToken||disposed)return;
        pending=false;
        stopMicrophone(error?.name==='NotAllowedError'?'Microphone permission was declined. You can still use No mic mode.':'Could not start the microphone. Check your device and try again.');
      }
    }

    function updateAudio(dt){
      if(mode!=='microphone'||!active||!analyser||!samples)return;
      analyser.getByteTimeDomainData(samples);
      let sum=0;
      for(const value of samples)sum+=((value-128)/128)**2;
      const raw=clamp((20*Math.log10(Math.sqrt(sum/samples.length)||.00001)+60)/60*100,0,100)*getSensitivity()/100;
      level+=(clamp(raw,0,100)-level)*Math.min(1,dt*9);
      meter.value=level;
    }

    function updateGrowth(dt){
      if(mode==='ambient'){
        ambientRun+=dt;
        quietRun+=dt;
        veryQuietRun+=dt;
        growthCharge+=dt/GROWTH_INTERVAL_AMBIENT;
      }else if(active){
        const threshold=getThreshold();
        if(level<threshold){
          quietRun+=dt;
          growthCharge+=dt/GROWTH_INTERVAL_QUIET;
          if(level<threshold*.55)veryQuietRun+=dt;
          else veryQuietRun=0;
        }else{
          quietRun=0;
          veryQuietRun=0;
        }
      }else{
        quietRun=0;
        veryQuietRun=0;
      }
      while(growthCharge>=1&&flowers.length<maxFlowers()){
        growthCharge-=1;
        addFlower();
      }
      if(flowers.length>=maxFlowers())growthCharge=Math.min(growthCharge,1.5);
    }

    function updateStatus(){
      const hasGolden=butterflies.some(butterfly=>butterfly.isGolden);
      if(hasGolden){
        say('Golden butterfly visiting · A very calm room brought a rare guest to the garden!');
        return;
      }
      if(mode==='ambient'){
        if(flowers.length<10)say(`No mic mode · ${flowers.length} flowers blooming · More will grow over time.`);
        else say(`No mic mode · ${flowers.length} flowers blooming · Butterflies are visiting the garden.`);
        return;
      }
      if(!active&&!pending){
        say('Microphone off · Enable it so quiet voices help the garden grow.');
        return;
      }
      if(pending)return;
      if(level<getThreshold()){
        if(flowers.length<10)say(`Quiet classroom · ${Math.floor(quietRun)}s calm · New flowers are growing.`);
        else say(`Quiet classroom · ${Math.floor(quietRun)}s calm · Butterflies are happily visiting.`);
      }else{
        say('A little loud right now · Growth pauses until the room gets quieter.');
      }
    }

    function tick(now){
      animationFrame=0;
      if(disposed||document.hidden||!visible)return;
      const dt=lastFrameTime?Math.min(.1,(now-lastFrameTime)/1000):0;
      lastFrameTime=now;
      elapsed+=dt;
      updateAudio(dt);
      updateGrowth(dt);
      ensureButterflyPopulation();
      maybeSpawnGoldenButterfly(dt);
      updateFlowerStyles(dt);
      updateButterflies(dt);
      updateParticles(dt);
      updateStatus();
      drawParticles();
      animationFrame=requestAnimationFrame(tick);
    }

    function wake(){
      if(disposed||document.hidden||!visible||animationFrame)return;
      lastFrameTime=0;
      animationFrame=requestAnimationFrame(tick);
    }

    thresholdInput.addEventListener('input',()=>{applySettings();wake();});
    sensitivityInput.addEventListener('input',()=>{applySettings();wake();});
    moduleElement.querySelectorAll('[data-butterfly-mode]').forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.butterflyMode)));
    micButton.addEventListener('click',()=>{
      if(mode!=='microphone')return;
      if(active||pending)stopMicrophone('Microphone off · Flowers will pause until the room gets quieter again.');
      else startMicrophone();
    });

    const resizeObserver=new ResizeObserver(()=>{resizeCanvas();drawParticles();});
    resizeObserver.observe(stage);
    const intersectionObserver=new IntersectionObserver(entries=>{
      visible=Boolean(entries[0]?.isIntersecting);
      if(!visible){cancelAnimationFrame(animationFrame);animationFrame=0;lastFrameTime=0;}
      else wake();
    });
    intersectionObserver.observe(stage);
    function handleVisibility(){
      if(document.hidden){
        cancelAnimationFrame(animationFrame);
        animationFrame=0;
        lastFrameTime=0;
        if(active||pending)stopMicrophone('Microphone paused while this tab is hidden.');
      }else wake();
    }
    document.addEventListener('visibilitychange',handleVisibility);

    moduleElement._boardGetState=()=>({
      mode,
      threshold:getThreshold(),
      sensitivity:getSensitivity(),
      ambientRun:Number(ambientRun.toFixed(2)),
      growthCharge:Number(growthCharge.toFixed(3)),
      goldenCooldown:Number(goldenCooldown.toFixed(2)),
      flowers:flowers.map(flower=>({
        assetIndex:flower.assetIndex,
        x:Number(flower.x.toFixed(4)),
        base:Number(flower.base.toFixed(4)),
        scale:Number(flower.scale.toFixed(4)),
        growth:1
      }))
    });

    moduleElement._boardSetState=state=>{
      stopMicrophone();
      particles=[];
      clearFlowers();
      clearButterflies();
      ambientRun=Math.max(0,Number(state?.ambientRun)||0);
      growthCharge=Math.max(0,Number(state?.growthCharge)||0);
      goldenCooldown=Math.max(12,Number(state?.goldenCooldown)||32);
      thresholdInput.value=String(clamp(Number(state?.threshold)||45,15,85));
      sensitivityInput.value=String(clamp(Number(state?.sensitivity)||100,30,200));
      applySettings(false);
      setMode(state?.mode,{notifyChange:false});
      const savedFlowers=Array.isArray(state?.flowers)?state.flowers:[];
      savedFlowers.slice(0,maxFlowers()).forEach(savedFlower=>addFlower(savedFlower,false));
      flowers.forEach(flower=>{flower.growth=1;});
      ensureButterflyPopulation();
      updateFlowerStyles(0);
      updateStatus();
      drawParticles();
    };

    const priorCleanup=moduleElement._cleanup;
    moduleElement._cleanup=()=>{
      disposed=true;
      stopMicrophone();
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener('visibilitychange',handleVisibility);
      priorCleanup?.();
    };

    applySettings(false);
    setMode('ambient',{notifyChange:false});
    resizeCanvas();
    refreshCounts();
    drawParticles();
    wake();
  }

  window.TeacherTilesButterflyGarden=Object.freeze({setup});
})();
