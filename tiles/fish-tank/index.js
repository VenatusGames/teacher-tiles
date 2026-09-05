(() => {
  'use strict';
  const species=[
    ['blue-fish','Blue fish',0,1],['pink-clownfish','Pink clownfish',0,1],['striped-fish','Striped fish',0,1],['goldfish','Goldfish',0,1],['red-fish','Red fish',0,1],['butterfly-fish','Butterfly fish',0,1],['clownfish','Clownfish',0,1],
    ['tuna','Tuna',30,-1],['pufferfish','Pufferfish',60,1],['tilapia','Tilapia',90,1],['anglerfish','Anglerfish',120,1],['shark','Shark',180,-1]
  ];
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const eligible=seconds=>species.filter(s=>s[2]<=seconds);
  function ecology(state,level,threshold,dt){
    dt=clamp(dt,0,.2);
    if(level>threshold+5){state.loud+=dt;state.quiet=0;if(state.loud>.3)state.scared=3;}
    else {state.loud=Math.max(0,state.loud-dt*2);state.scared=Math.max(0,state.scared-dt);if(level<threshold-5)state.quiet+=dt;}
    return state;
  }
  function setup(m){
    const canvas=m.querySelector('canvas'),ctx=canvas.getContext('2d'),button=m.querySelector('.fish-mic'),status=m.querySelector('.fish-status'),meter=m.querySelector('meter'),threshold=m.querySelector('.fish-threshold'),sensitivity=m.querySelector('.fish-sensitivity'),collection=m.querySelector('.fish-collection');
    let fishes=[],food=[],frame=0,last=0,time=0,active=false,pending=false,disposed=false,visible=true,stream=null,audio=null,analyser=null,samples=null,request=0,level=0,nextArrival=8,lastFeed=0,lastStatus='',lastNotify=0;
    const environment={quiet:0,loud:0,scared:0};
    const images=species.map(s=>{const img=new Image();img.src=`tiles/fish-tank/assets/${s[0]}.png`;img.onload=()=>{if(!disposed)draw();};return img;});
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    function addFish(index,inside=false){const s=species[index],direction=Math.random()<.5?1:-1;fishes.push({index,x:inside?.15+Math.random()*.7:direction>0?-.14:1.14,y:.2+Math.random()*.52,dir:direction,speed:.022+Math.random()*.025,size:s[0]==='shark'?.22:s[2]>0?.17:.12,phase:Math.random()*6.28});}
    [0,3,5,6].forEach(i=>addFish(i,true));
    function say(text){if(text!==lastStatus){status.textContent=text;lastStatus=text;}}
    function stop(message='Microphone off · Feed the fish for fun'){
      ++request;active=false;pending=false;stream?.getTracks().forEach(t=>t.stop());stream=null;
      if(audio&&audio.state!=='closed')audio.close().catch(()=>{});audio=analyser=samples=null;level=0;environment.quiet=environment.loud=environment.scared=0;nextArrival=8;
      button.disabled=false;button.textContent='Enable microphone';button.setAttribute('aria-pressed','false');meter.value=0;say(message);
    }
    button.addEventListener('click',async()=>{
      if(active||pending){stop();return;}
      if(!navigator.mediaDevices?.getUserMedia){say('Microphone unavailable. You can still feed the fish.');return;}
      pending=true;button.textContent='Cancel microphone request';say('Allow microphone access to invite more fish.');const token=++request;
      try{
        const incoming=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
        if(disposed||token!==request){incoming.getTracks().forEach(t=>t.stop());return;}
        stream=incoming;audio=new (window.AudioContext||window.webkitAudioContext)();await audio.resume();
        if(disposed||token!==request)return;
        analyser=audio.createAnalyser();analyser.fftSize=1024;samples=new Uint8Array(analyser.fftSize);audio.createMediaStreamSource(stream).connect(analyser);
        active=true;pending=false;button.textContent='Turn microphone off';button.setAttribute('aria-pressed','true');last=0;
        stream.getAudioTracks().forEach(t=>t.addEventListener('ended',()=>{if(active)stop('Microphone disconnected. Enable it to try again.');},{once:true}));wake();
      }catch(error){if(token!==request||disposed)return;stop(error?.name==='NotAllowedError'?'Microphone permission was declined. You can still feed the fish.':'Could not start microphone. Check your device and try again.');}
    });
    function feed(x=.2+Math.random()*.6){const now=performance.now();if(now-lastFeed<200)return;lastFeed=now;for(let i=0;i<8&&food.length<48;i++)food.push({x:clamp(x+(Math.random()-.5)*.1,.04,.96),y:.04,life:0});wake();}
    m.querySelector('.fish-feed').addEventListener('click',()=>feed());
    canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.stopPropagation();const r=canvas.getBoundingClientRect();feed((e.clientX-r.left)/r.width);});
    function settings(){threshold.value=String(clamp(Number(threshold.value)||45,15,85));sensitivity.value=String(clamp(Number(sensitivity.value)||100,30,200));m.querySelector('.fish-threshold-value').textContent=`${threshold.value}%`;notifyBoardChanged('fish-settings');}
    threshold.addEventListener('input',settings);sensitivity.addEventListener('input',settings);
    function update(dt){
      if(active&&analyser){
        analyser.getByteTimeDomainData(samples);let sum=0;for(const v of samples)sum+=((v-128)/128)**2;
        const raw=clamp((20*Math.log10(Math.sqrt(sum/samples.length)||.00001)+60)/60*100,0,100)*Number(sensitivity.value)/100;
        level+= (clamp(raw,0,100)-level)*Math.min(1,dt*9);meter.value=level;ecology(environment,level,Number(threshold.value),dt);
        if(environment.quiet>=nextArrival){
          nextArrival=environment.quiet+8;
          const unlocked=eligible(environment.quiet);const visitor=[...unlocked].reverse().find(s=>s[2]>0&&!fishes.some(f=>species[f.index]===s));
          if(visitor&&fishes.length>=18){const common=fishes.findIndex(f=>species[f.index][2]===0);if(common>=0)fishes.splice(common,1);}
          if(fishes.length<18){addFish(species.indexOf(visitor||unlocked[Math.floor(Math.random()*Math.min(7,unlocked.length))]));notifyBoardChanged('fish-visitor');}
        }
        if(environment.quiet===0)nextArrival=8;
        say(environment.scared>0?'A little loud — the fish are finding shelter.':`Quiet for ${Math.floor(environment.quiet)}s · ${environment.quiet<30?'More fish are on their way':environment.quiet<180?'Keep it calm for rare visitors':'Rare visitors feel at home'}`);
      }
      for(const f of fishes){
        if(environment.scared>0){f.dir=f.x<.5?-1:1;f.x+=f.dir*.45*dt;f.x=clamp(f.x,-.3,1.3);continue;}
        if(f.x<-.2||f.x>1.2){if(active&&environment.quiet<5)continue;f.dir=f.x<0?1:-1;}
        let speed=f.speed;
        const meal=food.find(p=>Math.abs(p.x-f.x)<.35);
        if(meal){f.dir=meal.x>f.x?1:-1;speed*=2;f.y+=Math.sign(meal.y-f.y)*dt*.06;if(Math.hypot(meal.x-f.x,meal.y-f.y)<.035)food.splice(food.indexOf(meal),1);}
        f.x+=f.dir*speed*dt*(reduced.matches?.35:1);
        if(f.x>1.08)f.dir=-1;if(f.x<-.08)f.dir=1;
        f.y=clamp(f.y+Math.sin(time*.4+f.phase)*dt*.005,.1,.8);
      }
      for(const p of food){p.y+=dt*.055;p.life+=dt;}food=food.filter(p=>p.life<10&&p.y<.91);
      if(time-lastNotify>1){lastNotify=time;collection.textContent=`${fishes.length} fish · ${new Set(fishes.map(f=>f.index)).size} species`;} 
    }
    function draw(){
      if(disposed||!ctx)return;const w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);
      const water=ctx.createLinearGradient(0,0,0,h);water.addColorStop(0,'#a6e8ec');water.addColorStop(.28,'#3facca');water.addColorStop(1,'#164d78');ctx.fillStyle=water;ctx.fillRect(0,0,w,h);
      ctx.fillStyle='#ffffff0e';for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(w*(i*.24-.1),0);ctx.lineTo(w*(i*.24+.02),0);ctx.lineTo(w*(i*.24+.4),h);ctx.lineTo(w*(i*.24+.05),h);ctx.fill();}
      ctx.fillStyle='#d6c894';ctx.beginPath();ctx.moveTo(0,h*.93);ctx.quadraticCurveTo(w*.5,h*.86,w,h*.93);ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.fill();
      for(let i=0;i<11;i++){
        const x=w*(i<6?.03+i*.028:.78+(i-6)*.043),height=h*(.16+(i%4)*.055),sway=reduced.matches?0:Math.sin(time*.7+i)*w*.012;
        ctx.beginPath();ctx.moveTo(x,h*.94);ctx.bezierCurveTo(x-w*.04,h*.94-height*.4,x+w*.025+sway,h*.94-height*.8,x+sway,h*.94-height);ctx.strokeStyle=i%2?'#419c81':'#226e69';ctx.lineWidth=w*.012;ctx.lineCap='round';ctx.stroke();
      }
      ctx.strokeStyle='#d3fbfb60';ctx.lineWidth=1.2;for(let i=0;i<8;i++){const phase=(time*.032+i*.13)%1;ctx.beginPath();ctx.arc(w*(.06+(i*37%89)/100),h*(1-phase),2+(i%3)*1.5,0,Math.PI*2);ctx.stroke();}
      for(const f of fishes){const img=images[f.index];if(!img.complete||!img.naturalWidth)continue;const size=Math.min(w*f.size,h*.28);ctx.save();ctx.translate(f.x*w,(f.y+(reduced.matches?0:Math.sin(time*1.5+f.phase)*.009))*h);ctx.scale(f.dir*species[f.index][3],1);ctx.drawImage(img,-size/2,-size/2,size,size);ctx.restore();}
      ctx.fillStyle='#9a6030';for(const p of food){ctx.beginPath();ctx.arc(p.x*w,p.y*h,Math.max(1.5,w*.003),0,Math.PI*2);ctx.fill();}
    }
    function tick(now){frame=0;if(disposed||document.hidden||!visible)return;const dt=last?Math.min(.1,(now-last)/1000):0;last=now;time+=dt;update(dt);draw();frame=requestAnimationFrame(tick);}
    function wake(){if(!disposed&&!document.hidden&&visible&&!frame){last=0;frame=requestAnimationFrame(tick);}}
    const resize=new ResizeObserver(entries=>{const r=entries[0].contentRect,ratio=Math.min(devicePixelRatio||1,2);if(r.width&&r.height){canvas.width=Math.round(r.width*ratio);canvas.height=Math.round(r.height*ratio);draw();}});resize.observe(canvas);
    const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(!visible){cancelAnimationFrame(frame);frame=0;last=0;}else wake();});observer.observe(canvas);
    function visibility(){if(document.hidden){cancelAnimationFrame(frame);frame=0;last=0;if(active||pending)stop('Microphone paused while the tab is hidden.');}else wake();}
    document.addEventListener('visibilitychange',visibility);
    m._boardGetState=()=>({threshold:Number(threshold.value),sensitivity:Number(sensitivity.value),fish:fishes.map(f=>f.index)});
    m._boardSetState=s=>{stop();food=[];threshold.value=String(clamp(Number(s?.threshold)||45,15,85));sensitivity.value=String(clamp(Number(s?.sensitivity)||100,30,200));m.querySelector('.fish-threshold-value').textContent=`${threshold.value}%`;fishes=[];const stock=(Array.isArray(s?.fish)?s.fish:[0,3,5,6]).filter(i=>Number.isInteger(i)&&i>=0&&i<species.length).slice(0,18);(stock.length?stock:[0,3,5,6]).forEach(i=>addFish(i,true));draw();};
    m._cleanup=()=>{disposed=true;stop();cancelAnimationFrame(frame);resize.disconnect();observer.disconnect();document.removeEventListener('visibilitychange',visibility);images.forEach(img=>img.onload=null);};wake();
  }
  window.TeacherTilesFishTank=Object.freeze({setup,eligible,ecology});
})();
