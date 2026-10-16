(() => {
 'use strict';
 const SEED_SECONDS=90,GROW_SECONDS=180;
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function setup(m){
  const layer=m.querySelector('.patch-pumpkins'),meter=m.querySelector('.patch-meter'),status=m.querySelector('.patch-status'),mic=m.querySelector('.patch-mic'),threshold=m.querySelector('.patch-threshold'),mode=m.querySelector('.patch-mode');
  let plants=[],progress=0,stream=null,audio=null,analyser=null,samples=null,token=0,disposed=false,visible=true,raf=0,last=0,paintAt=0,level=0;
  const previousCleanup=m._cleanup,previousDeactivate=m._deactivate;
  const toggle=m.querySelector('.tile-settings-toggle'),panel=m.querySelector('.tile-settings-panel');
  toggle.onclick=e=>{e.stopPropagation();panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));m.classList.toggle('has-tile-settings-open',!panel.hidden)};
  function render(){layer.replaceChildren();plants.forEach(p=>{const el=document.createElement('div');el.className='patch-plant';el.style.cssText=`left:${p.x}%;top:${p.y}%;width:${p.size}%;z-index:${Math.round(p.y)};--growth:${p.growth}`;el.dataset.color=p.color;el.innerHTML=`<img draggable="false" src="tiles/halloween/assets/pumpkin-${p.sprite}.png" alt="${p.color} pumpkin">`;layer.append(el)});}
  // Reserve space for mature pumpkins, including sprite size and the scene aspect ratio.
  function placePlant(plant, occupied){
   const ratio=Math.max(1,layer.clientWidth/Math.max(1,layer.clientHeight));
   const fits=p=>occupied.every(q=>{
    const dx=(p.x-q.x)/((p.size+q.size)*.53+1);
    const dy=(p.y-q.y)/((p.size+q.size)*ratio*.44+1);
    return dx*dx+dy*dy>=1;
   });
   if(plant.x!=null&&fits(plant))return plant;
   for(let size=plant.size;size>=7;size-=2){
    let best=null,score=-1;
    for(let row=0;row<13;row++)for(let col=0;col<23;col++){
     const p={...plant,size,x:7+col*86/22,y:53+row*38/12};
     if(p.x-size*.55<2||p.x+size*.55>98||p.y+size*ratio*.42>98||!fits(p))continue;
     const gap=occupied.length?Math.min(...occupied.map(q=>Math.hypot(p.x-q.x,(p.y-q.y)/ratio))):1;
     if(gap>score){best=p;score=gap;}
    }
    if(best)return best;
   }
   return null;
  }
  function seed(){
   if(plants.length>=24)return;
   const r=Math.random(),plant=placePlant({sprite:1+Math.floor(Math.random()*4),color:r<.08?'green':r<.18?'yellow':'orange',size:Math.random()<.2?20+Math.random()*5:9+Math.random()*9,growth:0},plants);
   if(plant){plants.push(plant);render();}
  }
  function stop(message='Microphone Off'){++token;stream?.getTracks().forEach(t=>t.stop());stream=null;audio?.close().catch(()=>{});audio=null;analyser=null;samples=null;mic.textContent='Enable Microphone';mic.disabled=false;mic.setAttribute('aria-pressed','false');meter.value=0;status.textContent=message;}
  async function start(){if(stream){stop();return}if(!navigator.mediaDevices?.getUserMedia){status.textContent='Microphone unavailable. Choose Ambient in Settings to grow without sound.';return}const attempt=++token;mic.disabled=true;status.textContent='Allow microphone access to grow your patch.';
   try{const incoming=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});if(disposed||attempt!==token){incoming.getTracks().forEach(t=>t.stop());return}stream=incoming;audio=new (window.AudioContext||window.webkitAudioContext)();await audio.resume();if(disposed||attempt!==token)return;analyser=audio.createAnalyser();analyser.fftSize=1024;samples=new Uint8Array(analyser.fftSize);audio.createMediaStreamSource(stream).connect(analyser);mic.textContent='Stop Microphone';mic.disabled=false;mic.setAttribute('aria-pressed','true');stream.getTracks().forEach(t=>t.addEventListener('ended',()=>stop('Microphone disconnected.'),{once:true}));}
   catch(e){if(attempt===token)stop(e.name==='NotAllowedError'?'Microphone permission declined. Try again or choose Ambient in Settings.':'Could not open microphone. Please try again.');}
  }
  function frame(now){raf=0;if(disposed)return;const dt=last?Math.min((now-last)/1000,.2):0;last=now;
   if(visible&&!document.hidden&&TeacherTilesHalloween.hasAccess()){
    if(analyser&&samples){analyser.getByteTimeDomainData(samples);let sum=0;for(const v of samples)sum+=((v-128)/128)**2;const raw=clamp((20*Math.log10(Math.sqrt(sum/samples.length)||.00001)+60)/60*100,0,100);level+=(raw-level)*Math.min(1,dt*8);meter.value=level;}
    const growing=mode.value==='ambient'||!!stream&&level<Number(threshold.value);
    if(growing&&plants.length<24){progress+=dt;if(progress>=SEED_SECONDS){progress-=SEED_SECONDS;seed();notifyBoardChanged('pumpkin-growth')}}
    if(growing){let matured=false;for(const p of plants){const before=p.growth;p.growth=Math.min(1,p.growth+dt/GROW_SECONDS);if(before<1&&p.growth===1)matured=true}if(matured)notifyBoardChanged('pumpkin-grown')}
    if(now-paintAt>180){paintAt=now;[...layer.children].forEach((el,i)=>el.style.setProperty('--growth',String(plants[i].growth)));const text=plants.length>=24?'Your Patch Is Full':mode.value==='ambient'?'Growing · Ambient':stream?(growing?'Quiet Voices · Growing':'Too Loud · Growth Paused'):status.textContent;if(text!==status.textContent)status.textContent=text;}
   }
   if(visible&&!document.hidden)raf=requestAnimationFrame(frame);
  }
  function wake(){cancelAnimationFrame(raf);last=0;if(!disposed&&visible&&!document.hidden)raf=requestAnimationFrame(frame)}
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;wake()});observer.observe(m);document.addEventListener('visibilitychange',wake);
  mic.onclick=start;mode.onchange=()=>{stop(mode.value==='ambient'?'Growing · Ambient':'Enable the microphone to grow with quiet voices.');mic.hidden=mode.value==='ambient';meter.hidden=mode.value==='ambient';notifyBoardChanged('pumpkin-mode')};
  threshold.oninput=()=>{m.querySelector('.patch-threshold-value').textContent=threshold.value+'%';notifyBoardChanged('pumpkin-threshold')};
  m.querySelector('.patch-reset').onclick=()=>{plants=[];progress=0;seed();notifyBoardChanged('pumpkin-reset')};
  m._boardGetState=()=>({layoutVersion:3,plants:plants.map(p=>({...p})),progress,mode:mode.value,threshold:Number(threshold.value)});
  m._boardSetState=s=>{plants=(Array.isArray(s?.plants)?s.plants:[]).slice(0,24).map((p,i)=>({sprite:clamp(Math.round(Number(p.sprite)||1),1,4),color:['orange','green','yellow'].includes(p.color)?p.color:'orange',x:clamp(Number(p.x)||50,5,95),y:s?.layoutVersion>=2?clamp(Number(p.y)||60,48,94):clamp(52+(Number(p.y)-42)*.8,48,94),size:s?.layoutVersion>=2?clamp(Number(p.size)||16,7,27):8+(i*7+Number(p.sprite)*3)%18,growth:clamp(Number(p.growth)||0,0,1)}));if(s?.layoutVersion!==3){const spaced=[];for(const p of plants){const placed=placePlant(p,spaced);spaced.push(placed||p);}plants=spaced;}progress=clamp(Number(s?.progress)||0,0,SEED_SECONDS);mode.value=s?.mode==='ambient'?'ambient':'microphone';threshold.value=clamp(Number(s?.threshold)||45,15,85);m.querySelector('.patch-threshold-value').textContent=threshold.value+'%';mic.hidden=mode.value==='ambient';meter.hidden=mode.value==='ambient';render();};
  m._deactivate=()=>{stop();previousDeactivate?.()};m._cleanup=()=>{disposed=true;stop();cancelAnimationFrame(raf);observer.disconnect();document.removeEventListener('visibilitychange',wake);previousCleanup?.()};
  seed();wake();
 }
 window.TeacherTilesPumpkinPatch={setup};
})();
