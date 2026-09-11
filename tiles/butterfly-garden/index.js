(() => {
  'use strict';

  const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));
  const FLOWER_BASE_WIDTH=66;
  const GROWTH_INTERVAL_AMBIENT=18;
  const GROWTH_INTERVAL_QUIET=14;
  const GOLDEN_AMBIENT_DELAY=240;
  const GOLDEN_QUIET_DELAY=26;
  const FLOWER_SOURCES=Array.from({length:9},(_,index)=>`tiles/butterfly-garden/assets/flower-${String(index+1).padStart(2,'0')}.png`);
  const FLOWER_PROFILES=[
    {ratio:1.411,lift:.78,radius:.32,stem:.085},
    {ratio:1.409,lift:.78,radius:.32,stem:.085},
    {ratio:1.409,lift:.78,radius:.32,stem:.085},
    {ratio:1.409,lift:.78,radius:.32,stem:.085},
    {ratio:1.987,lift:.86,radius:.34,stem:.08},
    {ratio:1.246,lift:.74,radius:.39,stem:.12},
    {ratio:1.633,lift:.82,radius:.31,stem:.09},
    {ratio:1.318,lift:.72,radius:.34,stem:.10},
    {ratio:.670,lift:.58,radius:.43,stem:.24}
  ];
  const BUTTERFLY_VARIANTS=[
    {id:'blue',src:'tiles/butterfly-garden/assets/butterfly-blue.png'},
    {id:'mint',src:'tiles/butterfly-garden/assets/butterfly-mint.png'},
    {id:'pink',src:'tiles/butterfly-garden/assets/butterfly-pink.png'},
    {id:'purple',src:'tiles/butterfly-garden/assets/butterfly-purple.png'}
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
    let goldenCooldown=45;
    let nextButterflyArrival=0;
    let loudRun=0;
    let returnQuietRun=0;
    let butterflyEvictionActive=false;
    let lastDepartedVariant='';
    let stream=null;
    let audioContext=null;
    let analyser=null;
    let samples=null;
    let requestToken=0;

    function notify(reason){window.notifyBoardChanged?.(`butterfly-garden-${reason}`)}
    function getThreshold(){return clamp(Number(thresholdInput.value)||45,15,85)}
    function getSensitivity(){return clamp(Number(sensitivityInput.value)||100,30,200)}
    function stageSize(){return{width:Math.max(240,stage.clientWidth||360),height:Math.max(120,stage.clientHeight||200)}}
    function maxFlowers(){
      const {width,height}=stageSize();
      return clamp(Math.round((width*height)/4000),18,32);
    }
    function regularButterflyTarget(){
      if(flowers.length<3)return 0;
      if(flowers.length<10)return 1;
      return Math.min(16,4+Math.floor((flowers.length-10)/1.5));
    }
    function chooseRegularVariant(){
      const activeCounts=new Map(BUTTERFLY_VARIANTS.map(variant=>[variant.id,0]));
      butterflies.forEach(butterfly=>{
        if(!butterfly.isGolden&&!butterfly.exiting)activeCounts.set(butterfly.id,(activeCounts.get(butterfly.id)||0)+1);
      });
      const minimum=Math.min(...activeCounts.values());
      let choices=BUTTERFLY_VARIANTS.filter(variant=>(activeCounts.get(variant.id)||0)===minimum&&variant.id!==lastDepartedVariant);
      if(!choices.length)choices=BUTTERFLY_VARIANTS.filter(variant=>variant.id!==lastDepartedVariant);
      if(!choices.length)choices=BUTTERFLY_VARIANTS;
      return pick(choices);
    }
    function say(text){if(status.textContent!==text)status.textContent=text}

    function refreshCounts(){
      const butterflyCount=butterflies.length;
      counts.textContent=`${flowers.length} ${flowers.length===1?'flower':'flowers'} · ${butterflyCount} ${butterflyCount===1?'butterfly':'butterflies'}`;
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

    function flowerGeometry(candidate){
      const {width:stageWidth,height:stageHeight}=stageSize();
      const profile=FLOWER_PROFILES[candidate.assetIndex]||FLOWER_PROFILES[0];
      const width=FLOWER_BASE_WIDTH*candidate.scale;
      const height=width*profile.ratio;
      const groundX=candidate.x*stageWidth;
      const groundY=stageHeight-candidate.base*stageHeight;
      const bloomX=groundX;
      const bloomY=groundY-height*profile.lift;
      const bloomRadius=width*profile.radius;
      const stemHalf=width*profile.stem;
      return{width,height,groundX,groundY,bloomX,bloomY,bloomRadius,stemHalf,top:groundY-height};
    }

    function stemIntersectsBloom(stemFlower,bloomFlower){
      const stem=flowerGeometry(stemFlower);
      const bloom=flowerGeometry(bloomFlower);
      const stemTop=Math.min(stem.groundY,stem.bloomY+stem.bloomRadius*.15);
      const stemBottom=stem.groundY;
      const bloomTop=bloom.bloomY-bloom.bloomRadius*.78;
      const bloomBottom=bloom.bloomY+bloom.bloomRadius*.78;
      const verticalOverlap=Math.min(stemBottom,bloomBottom)-Math.max(stemTop,bloomTop);
      if(verticalOverlap<=0)return false;
      return Math.abs(stem.groundX-bloom.bloomX)<stem.stemHalf+bloom.bloomRadius*.70;
    }

    function spotIsSafe(candidate){
      const candidateGeometry=flowerGeometry(candidate);
      const {width:stageWidth,height:stageHeight}=stageSize();
      if(candidateGeometry.groundX-candidateGeometry.width*.48<4)return false;
      if(candidateGeometry.groundX+candidateGeometry.width*.48>stageWidth-4)return false;
      if(candidateGeometry.top<8)return false;
      if(candidateGeometry.groundY>stageHeight+2)return false;
      for(const flower of flowers){
        const existingGeometry=flowerGeometry(flower);
        const dx=candidateGeometry.bloomX-existingGeometry.bloomX;
        const dy=candidateGeometry.bloomY-existingGeometry.bloomY;
        const minBloomDistance=(candidateGeometry.bloomRadius+existingGeometry.bloomRadius)*.80;
        if(dx*dx+dy*dy<minBloomDistance*minBloomDistance)return false;
        if(stemIntersectsBloom(candidate,flower)||stemIntersectsBloom(flower,candidate))return false;
        const groundDx=Math.abs(candidateGeometry.groundX-existingGeometry.groundX);
        const groundDy=Math.abs(candidateGeometry.groundY-existingGeometry.groundY);
        if(groundDx<(candidateGeometry.stemHalf+existingGeometry.stemHalf)*1.15&&groundDy<34)return false;
      }
      return true;
    }

    function chooseFlowerSpot(assetIndex,preferred={}){
      const attempts=preferred.x==null?180:1;
      for(let attempt=0;attempt<attempts;attempt+=1){
        const candidate={
          assetIndex,
          x:preferred.x==null?randomBetween(.08,.92):clamp(Number(preferred.x)||.5,.05,.95),
          base:preferred.base==null?randomBetween(.015,.30):clamp(Number(preferred.base)||.08,.01,.31),
          scale:preferred.scale==null?randomBetween(.64,.96):clamp(Number(preferred.scale)||1,.60,1.04)
        };
        if(spotIsSafe(candidate))return candidate;
      }
      if(preferred.x!=null)return chooseFlowerSpot(assetIndex,{});
      return null;
    }

    function sortFlowers(){
      flowers.sort((a,b)=>b.base-a.base||a.x-b.x);
      flowers.forEach((flower,index)=>{flower.element.style.zIndex=String(2+index)});
    }

    function addFlower(seed={},notifyChange=true){
      if(flowers.length>=maxFlowers())return false;
      const assetIndex=Number.isInteger(seed.assetIndex)?((seed.assetIndex%FLOWER_SOURCES.length)+FLOWER_SOURCES.length)%FLOWER_SOURCES.length:Math.floor(Math.random()*FLOWER_SOURCES.length);
      const spot=chooseFlowerSpot(assetIndex,seed);
      if(!spot)return false;
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
        growDuration:randomBetween(5.8,8.4),
        swaySeed:randomBetween(0,Math.PI*2)
      });
      sortFlowers();
      refreshCounts();
      if(notifyChange)notify('flower-grown');
      return true;
    }

    function getFlowerVisualMetrics(flower){
      const geometry=flowerGeometry(flower);
      return{
        nectarX:geometry.bloomX,
        nectarY:geometry.bloomY-geometry.bloomRadius*.15,
        groundX:geometry.groundX,
        groundY:geometry.groundY
      };
    }

    function updateFlowerStyles(dt){
      for(const flower of flowers){
        flower.growth=Math.min(1,flower.growth+dt/flower.growDuration);
        const sway=Math.sin(elapsed*.62+flower.swaySeed)*2.2;
        const rise=Math.sin(elapsed*.38+flower.swaySeed)*1.15;
        const visualScale=Math.max(.02,flower.growth*flower.scale);
        flower.element.style.left=`${(flower.x*100).toFixed(3)}%`;
        flower.element.style.bottom=`${(flower.base*100).toFixed(3)}%`;
        flower.element.style.transform=`translateX(-50%) translateY(${rise.toFixed(2)}px) rotate(${sway.toFixed(2)}deg) scale(${visualScale.toFixed(4)})`;
      }
    }

    function removeButterfly(target){
      const index=butterflies.indexOf(target);
      if(index>=0)butterflies.splice(index,1);
      target.element.remove();
      if(target.isGolden)rareBadge.hidden=true;
      else lastDepartedVariant=target.id;
      refreshCounts();
    }

    function chooseButterflyTarget(butterfly){
      if(!flowers.length){butterfly.target=null;return;}
      const choices=flowers.filter(flower=>flower.growth>.72&&flower!==butterfly.target);
      butterfly.target=pick(choices.length?choices:flowers);
      butterfly.state='travel';
      butterfly.hoverUntil=0;
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
      const enterFromLeft=Math.random()<.5;
      const butterfly={
        element:image,
        id:variant.id,
        x:enterFromLeft?-54:width+54,
        y:randomBetween(height*.14,height*.56),
        phase:randomBetween(0,Math.PI*2),
        target:null,
        state:'travel',
        hoverUntil:0,
        facing:enterFromLeft?1:-1,
        isGolden:variant.id==='golden',
        particleClock:randomBetween(.08,.30),
        speed:variant.id==='golden'?randomBetween(22,28):randomBetween(25,32),
        exiting:false,
        exitX:0,
        exitY:0,
        entering:true,
        visitDuration:variant.id==='golden'?randomBetween(18,27):randomBetween(30,52),
        leaveAt:0
      };
      butterflies.push(butterfly);
      chooseButterflyTarget(butterfly);
      if(butterfly.isGolden)rareBadge.hidden=false;
      refreshCounts();
      return butterfly;
    }

    function sendButterflyAway(butterfly,{fast=false}={}){
      if(!butterfly||butterfly.exiting)return;
      const {width,height}=stageSize();
      butterfly.exiting=true;
      butterfly.entering=false;
      butterfly.target=null;
      butterfly.state='exit';
      butterfly.leaveAt=0;
      butterfly.exitX=butterfly.x<width*.5?-84:width+84;
      butterfly.exitY=clamp(butterfly.y+randomBetween(-42,28),8,height-8);
      if(fast)butterfly.speed=Math.max(butterfly.speed,randomBetween(54,68));
    }

    function scareAwayAllButterflies(){
      if(butterflyEvictionActive)return;
      butterflyEvictionActive=true;
      returnQuietRun=0;
      nextButterflyArrival=Infinity;
      butterflies.forEach(butterfly=>sendButterflyAway(butterfly,{fast:true}));
      goldenCooldown=Math.max(goldenCooldown,75);
    }

    function ensureButterflyPopulation(){
      const goal=regularButterflyTarget();
      const regular=butterflies.filter(butterfly=>!butterfly.isGolden&&!butterfly.exiting);
      const arrivalInProgress=butterflies.some(butterfly=>butterfly.entering&&!butterfly.exiting);
      const canInvite=!butterflyEvictionActive&&(mode!=='microphone'||!active||level<getThreshold());
      if(regular.length<goal&&!arrivalInProgress&&canInvite&&elapsed>=nextButterflyArrival){
        spawnButterfly(chooseRegularVariant());
        nextButterflyArrival=Infinity;
      }
      if(regular.length>goal){
        const extra=regular[regular.length-1];
        if(extra)sendButterflyAway(extra);
      }
      if(flowers.length<10){
        butterflies.filter(butterfly=>butterfly.isGolden).forEach(butterfly=>sendButterflyAway(butterfly));
      }
    }

    function maybeSpawnGoldenButterfly(dt){
      if(flowers.length<10||butterflyEvictionActive||butterflies.some(butterfly=>butterfly.isGolden&&!butterfly.exiting))return;
      if(butterflies.some(butterfly=>butterfly.entering&&!butterfly.exiting))return;
      goldenCooldown=Math.max(0,goldenCooldown-dt);
      if(goldenCooldown>0)return;
      const quietReady=mode==='microphone'&&active&&veryQuietRun>=GOLDEN_QUIET_DELAY;
      const ambientReady=mode==='ambient'&&ambientRun>=GOLDEN_AMBIENT_DELAY;
      if(!quietReady&&!ambientReady)return;
      const chance=quietReady?dt/18:dt/28;
      if(Math.random()<chance){
        spawnButterfly(GOLDEN_VARIANT);
        goldenCooldown=randomBetween(105,175);
        notify('golden-visitor');
      }
    }

    function spawnParticle(x,y,isGolden){
      particles.push({
        x,y,
        vx:randomBetween(-7,7),
        vy:randomBetween(12,24),
        size:isGolden?randomBetween(1.5,2.8):randomBetween(1.0,2.0),
        life:0,
        maxLife:isGolden?randomBetween(1.05,1.6):randomBetween(1.35,2.0),
        swaySeed:randomBetween(0,Math.PI*2),
        isGolden
      });
    }

    function moveToward(butterfly,destinationX,destinationY,dt){
      const dx=destinationX-butterfly.x;
      const dy=destinationY-butterfly.y;
      const distance=Math.hypot(dx,dy);
      if(distance<.001)return 0;
      const step=Math.min(distance,butterfly.speed*dt);
      butterfly.x+=dx/distance*step;
      butterfly.y+=dy/distance*step;
      butterfly.facing=dx>=0?1:-1;
      return distance;
    }

    function updateButterflies(dt){
      const {width,height}=stageSize();
      for(const butterfly of butterflies.slice()){
        if(butterfly.leaveAt&&elapsed>butterfly.leaveAt&&!butterfly.exiting)sendButterflyAway(butterfly);

        let destinationX=butterfly.x;
        let destinationY=butterfly.y;
        if(butterfly.exiting){
          destinationX=butterfly.exitX;
          destinationY=butterfly.exitY;
          const distance=moveToward(butterfly,destinationX,destinationY,dt);
          if(distance<8){removeButterfly(butterfly);continue;}
        }else{
          if(!butterfly.target||!flowers.includes(butterfly.target))chooseButterflyTarget(butterfly);
          const metrics=butterfly.target?getFlowerVisualMetrics(butterfly.target):null;
          if(metrics){
            destinationX=metrics.nectarX;
            destinationY=metrics.nectarY-(butterfly.isGolden?16:11);
            if(butterfly.state==='travel'){
              const distance=moveToward(butterfly,destinationX,destinationY,dt);
              if(distance<12){
                butterfly.state='hover';
                butterfly.hoverUntil=elapsed+randomBetween(2.7,5.1)+(butterfly.isGolden?1.2:0);
              }
            }else if(butterfly.state==='hover'){
              moveToward(butterfly,destinationX,destinationY,dt*.35);
              if(elapsed>=butterfly.hoverUntil)chooseButterflyTarget(butterfly);
            }
          }
        }

        const hover=Math.sin(elapsed*4.4+butterfly.phase)*(butterfly.isGolden?5.2:4.2);
        const drift=Math.cos(elapsed*1.8+butterfly.phase)*2.2;
        const flap=1+Math.sin(elapsed*14+butterfly.phase)*.035;
        const tilt=Math.sin(elapsed*2.7+butterfly.phase)*3.2;
        const drawX=butterfly.x+drift;
        const drawY=butterfly.y+hover;
        if(butterfly.entering&&drawX>10&&drawX<width-10){
          butterfly.entering=false;
          butterfly.leaveAt=elapsed+butterfly.visitDuration;
          nextButterflyArrival=elapsed+randomBetween(5.8,8.4);
        }
        butterfly.element.style.left=`${drawX.toFixed(2)}px`;
        butterfly.element.style.top=`${drawY.toFixed(2)}px`;
        butterfly.element.style.transform=`translate(-50%,-50%) scale(${(butterfly.facing*flap).toFixed(4)},${flap.toFixed(4)}) rotate(${tilt.toFixed(2)}deg)`;
        butterfly.particleClock-=dt;
        if(!butterfly.exiting&&butterfly.particleClock<=0){
          const butterflyRect=butterfly.element.getBoundingClientRect();
          const stageRect=stage.getBoundingClientRect();
          const particleX=butterflyRect.left-stageRect.left+butterflyRect.width/2;
          const particleY=butterflyRect.top-stageRect.top+butterflyRect.height/2;
          spawnParticle(particleX,particleY,butterfly.isGolden);
          butterfly.particleClock=butterfly.isGolden?randomBetween(.07,.13):randomBetween(.19,.34);
        }
      }
    }

    function updateParticles(dt){
      const {height}=stageSize();
      for(const particle of particles){
        particle.life+=dt;
        particle.x+=particle.vx*dt+Math.sin(elapsed*2+particle.swaySeed)*2.3*dt;
        particle.y+=particle.vy*dt;
        particle.vy+=11*dt;
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
      moduleElement.querySelectorAll('.butterflygarden-mic-setting').forEach(element=>{element.hidden=mode!=='microphone'});
      if(mode==='ambient')say('No mic mode · Flowers grow over time and butterflies visit later.');
      else if(!active)say('Microphone off · Enable it so quiet voices help the garden grow.');
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

    function updateButterflyNoiseBehavior(dt){
      if(mode!=='microphone'||!active){
        loudRun=0;
        if(butterflyEvictionActive){
          butterflyEvictionActive=false;
          returnQuietRun=0;
          nextButterflyArrival=Math.min(nextButterflyArrival,elapsed+3);
        }
        return;
      }
      const threshold=getThreshold();
      if(level>=threshold+7){
        loudRun+=dt;
        returnQuietRun=0;
        if(loudRun>=.65)scareAwayAllButterflies();
        return;
      }
      loudRun=Math.max(0,loudRun-dt*2.2);
      if(!butterflyEvictionActive)return;
      if(level<threshold){
        returnQuietRun+=dt;
        if(returnQuietRun>=2.4){
          butterflyEvictionActive=false;
          returnQuietRun=0;
          nextButterflyArrival=elapsed+randomBetween(2.2,3.6);
        }
      }else returnQuietRun=0;
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
          if(level<threshold*.52)veryQuietRun+=dt;
          else veryQuietRun=0;
        }else{
          quietRun=0;
          veryQuietRun=0;
        }
      }else{
        quietRun=0;
        veryQuietRun=0;
      }
      if(growthCharge>=1&&flowers.length<maxFlowers()){
        if(addFlower())growthCharge-=1;
        else growthCharge=Math.min(growthCharge,1.15);
      }
      if(flowers.length>=maxFlowers())growthCharge=Math.min(growthCharge,1.15);
    }

    function updateStatus(){
      if(butterflies.some(butterfly=>butterfly.isGolden&&!butterfly.exiting)){
        say('Golden butterfly visiting · A very calm room brought a rare guest to the garden!');
        return;
      }
      if(mode==='ambient'){
        if(flowers.length<10)say(`No mic mode · ${flowers.length} flowers blooming · More will grow slowly over time.`);
        else say(`No mic mode · ${flowers.length} flowers blooming · Butterflies are visiting the garden.`);
        return;
      }
      if(!active&&!pending){say('Microphone off · Enable it so quiet voices help the garden grow.');return;}
      if(pending)return;
      if(butterflyEvictionActive&&level<getThreshold()){say('The room is calming down · Butterflies will return one by one.');return;}
      if(level<getThreshold()){
        if(flowers.length<10)say(`Quiet classroom · ${Math.floor(quietRun)}s calm · The garden is growing.`);
        else say(`Quiet classroom · ${Math.floor(quietRun)}s calm · Butterflies are happily visiting.`);
      }else if(butterflyEvictionActive||loudRun>=.65)say('Too loud · The butterflies are flying away. Stay quiet and they will return one by one.');
      else say('A little loud right now · Growth pauses until the room gets quieter.');
    }

    function tick(now){
      animationFrame=0;
      if(disposed||document.hidden||!visible)return;
      const dt=lastFrameTime?Math.min(.1,(now-lastFrameTime)/1000):0;
      lastFrameTime=now;
      elapsed+=dt;
      updateAudio(dt);
      updateButterflyNoiseBehavior(dt);
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

    thresholdInput.addEventListener('input',()=>{applySettings();wake()});
    sensitivityInput.addEventListener('input',()=>{applySettings();wake()});
    moduleElement.querySelectorAll('[data-butterfly-mode]').forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.butterflyMode)));
    micButton.addEventListener('click',()=>{
      if(mode!=='microphone')return;
      if(active||pending)stopMicrophone('Microphone off · Flowers will pause until the room gets quieter again.');
      else startMicrophone();
    });

    const resizeObserver=new ResizeObserver(()=>{resizeCanvas();drawParticles()});
    resizeObserver.observe(stage);
    const intersectionObserver=new IntersectionObserver(entries=>{
      visible=Boolean(entries[0]?.isIntersecting);
      if(!visible){cancelAnimationFrame(animationFrame);animationFrame=0;lastFrameTime=0}
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
      goldenCooldown=Math.max(20,Number(state?.goldenCooldown)||45);
      nextButterflyArrival=0;
      thresholdInput.value=String(clamp(Number(state?.threshold)||45,15,85));
      sensitivityInput.value=String(clamp(Number(state?.sensitivity)||100,30,200));
      applySettings(false);
      setMode(state?.mode,{notifyChange:false});
      const savedFlowers=Array.isArray(state?.flowers)?state.flowers:[];
      savedFlowers.slice(0,maxFlowers()).forEach(savedFlower=>addFlower(savedFlower,false));
      flowers.forEach(flower=>{flower.growth=1});
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
