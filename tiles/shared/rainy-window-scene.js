/* Original blurred city lights, with refracting glass beads and broken rain residue. */
(()=>{'use strict';
 const random=i=>{const n=Math.sin(i*127.1+72.9)*43758.5453;return n-Math.floor(n)};
 const backgroundRandom=i=>{const n=Math.sin(i*127.1+311.7)*43758.5453;return n-Math.floor(n)};
 const backgroundCache=new Map();
 function prepare(){return Promise.resolve();}
 function sceneFor(w,h){
   const key=w+'x'+h;if(backgroundCache.has(key))return backgroundCache.get(key);
   const canvas=document.createElement('canvas');canvas.width=Math.ceil(w);canvas.height=Math.ceil(h);const bg=canvas.getContext('2d');
   const gradient=(context,y,stops)=>{const g=context.createLinearGradient(0,0,0,y);stops.forEach(([at,color])=>g.addColorStop(at,color));return g};
      bg.fillStyle=gradient(bg,h,[[0,'#202f40'],[.42,'#536674'],[.68,'#8a9697'],[1,'#263e48']]);bg.fillRect(0,0,w,h);
      bg.filter='blur(14px)';for(let i=0;i<35;i++){const x=backgroundRandom(i+40)*w,buildingHeight=h*(.08+backgroundRandom(i+9)*.22);bg.fillStyle=i%2?'#2b434ab0':'#384d55a0';bg.fillRect(x,h*.67-buildingHeight,w*.035+backgroundRandom(i)*45,buildingHeight+h*.4)}
      for(let i=0;i<24;i++){const x=backgroundRandom(i+110)*w,y=h*(.58+backgroundRandom(i+10)*.3),r=3+backgroundRandom(i+140)*12;bg.fillStyle=i%3?'#c4d9d46b':'#e7c18d99';bg.beginPath();bg.arc(x,y,r,0,Math.PI*2);bg.fill()}bg.filter='none';
      const vignette=bg.createRadialGradient(w*.5,h*.4,0,w*.5,h*.4,Math.max(w,h)*.7);vignette.addColorStop(0,'#152b3500');vignette.addColorStop(1,'#091820a8');bg.fillStyle=vignette;bg.fillRect(0,0,w,h);
   if(backgroundCache.size>=3)backgroundCache.delete(backgroundCache.keys().next().value);
   backgroundCache.set(key,canvas);return canvas;
 }
 // Each board/preview owns its rain, so a shop preview cannot change the board.
 const panes=new WeakMap();
 const outline=new Path2D('M-.16 -1 C-.73 -.98 -1.04 -.38 -.91 .29 C-.82 .92 -.38 1.05 .15 1.02 C.77 1 .99 .61 .9 .12 C.85 -.42 .53 -1.04 -.16 -1 Z');
 function water(g,scene,d){
   const r=d.visibleR,ry=r*(d.speed>0?1.16:1.02),x=d.x,y=d.y;
   g.save();g.translate(x,y);g.scale(r,ry);g.save();g.clip(outline);
   // Slightly displace the scene through the water rather than lighting a sphere.
   const sample=r*1.65,sx=Math.max(0,Math.min(scene.width-sample,x-sample/2+1)),sy=Math.max(0,Math.min(scene.height-sample,y-sample/2-r*.18));
   g.drawImage(scene,sx,sy,sample,sample,-1,-1,2,2);
   const shading=g.createLinearGradient(0,-1,0,1);shading.addColorStop(0,'#0a1a2218');shading.addColorStop(.5,'#a1bec000');shading.addColorStop(1,'#d2e2e51e');g.fillStyle=shading;g.fillRect(-1,-1,2,2);g.restore();
   // Broken, low-contrast menisci; no dark outline, white dot, or drop shadow.
   g.lineWidth=(d.kind==='residue'?.85:.6)/Math.max(r,.5);g.strokeStyle=d.kind==='residue'?'#dce8e796':'#dce8e72b';g.beginPath();g.moveTo(-.83,.4);g.bezierCurveTo(-.66,.96,.18,1.12,.65,.78);g.stroke();
   g.strokeStyle='#0c202327';g.beginPath();g.moveTo(-.72,-.58);g.bezierCurveTo(-.3,-1,.3,-1,.61,-.65);g.stroke();g.restore();
 }
 function paint(g,w,h){g.drawImage(sceneFor(w,h),0,0,w,h)}
 function makePane(w,h){
   const state={w,h,scale:Math.max(w/1600,h/1000),last:null,seed:0,drops:[],tracks:[],spawn:0};
   state.rand=()=>random(++state.seed+8121);
   for(let i=0;i<215;i++)spawn(state,i<28?'slow':i<38?'fast':'bead',true);
   return state;
 }
 function spawn(s,kind,initial=false){
   const rnd=s.rand,scale=s.scale,r=(kind==='bead'?1.6+rnd()**1.7*5.8:5.5+rnd()*5.5)*scale;
   const x=rnd()*s.w,y=initial?rnd()*s.h:kind==='fast'?-20*scale:rnd()*s.h*.92;
   if(s.drops.some(d=>!d.dead&&Math.hypot(d.x-x,d.y-y)<d.r+r+2*scale))return;
   s.drops.push({x,y,r,visibleR:initial?r:r*.65,kind,dead:false,speed:kind==='fast'?130*scale:0,
     wait:kind==='slow'?18+rnd()*28:kind==='fast'?0:80+rnd()*140,
     age:initial?.3:0,life:Infinity,wander:rnd()*6.28,trail:0});
 }
 function step(s,dt){
   const scale=s.scale,bucketSize=36*scale,buckets=new Map();
   let residueCount=s.drops.filter(d=>d.kind==='residue').length;
   for(const d of s.drops){const key=Math.floor(d.x/bucketSize)+','+Math.floor(d.y/bucketSize);if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(d)}
   for(const d of s.drops){
     if(d.dead)continue;d.age+=dt;d.wait-=dt;if(d.age>d.life){d.dead=true;continue}
     const ox=d.x,oy=d.y;
     if(d.wait<=0){
       const target=(d.kind==='fast'?260:55+Math.max(0,d.r/scale-6)*11)*scale;
       d.speed+=(target-d.speed)*Math.min(1,dt*2.2);d.y+=d.speed*dt;d.x+=Math.sin(d.y/(85*scale)+d.wander)*d.speed*dt*.035;
     }
     // Swept collision catches beads between frames, including fast runners.
     const range=d.r+17*scale;
     for(let bx=Math.floor((d.x-range)/bucketSize);bx<=Math.floor((d.x+range)/bucketSize);bx++){
       for(let by=Math.floor((oy-range)/bucketSize);by<=Math.floor((d.y+range)/bucketSize);by++){
         for(const other of buckets.get(bx+','+by)||[]){
           if(other===d||other.dead)continue;
           const nearestY=Math.max(oy,Math.min(d.y,other.y));
           if(Math.hypot(d.x-other.x,nearestY-other.y)>(d.r+other.r)*.88)continue;
           other.dead=true;const area=d.r*d.r+other.r*other.r;
           d.r=Math.min(17*scale,Math.sqrt(area));
           if(d.speed===0){d.wait=Math.min(d.wait,1.5);d.kind='slow'}
         }
       }
     }
     d.visibleR+=(d.r-d.visibleR)*Math.min(1,dt*7);
     if(d.speed>8*scale){
       s.tracks.push({x:ox,y:oy,x2:d.x,y2:d.y,r:d.r*.3,life:7});
       d.trail+=d.y-oy;
       if(d.trail>(d.nextResidue||35*scale)&&residueCount<500){d.trail=0;d.nextResidue=(22+s.rand()*38)*scale;residueCount++;s.drops.push({x:ox+(s.rand()-.5)*d.r*.45,y:oy-2*d.r,r:Math.max(.85,(1.8+s.rand()*1.3)*scale),visibleR:.7*scale,kind:'residue',speed:0,wait:Infinity,age:0,life:8,wander:0,dead:false,trail:0})}
     }
     if(d.y>s.h+30*scale)d.dead=true;
   }
   s.drops=s.drops.filter(d=>!d.dead);
   for(const track of s.tracks)track.life-=dt;s.tracks=s.tracks.filter(p=>p.life>0).slice(-900);
   s.spawn+=dt;
   if(s.spawn>.55){s.spawn=0;if(s.drops.length<260)spawn(s,'bead');if(s.drops.filter(d=>d.kind==='slow').length<28)spawn(s,'slow');if(s.drops.filter(d=>d.kind==='fast').length<10)spawn(s,'fast')}
 }
 function draw(g,w,h,_theme,t){
   let s=panes.get(g);if(!s||s.w!==w||s.h!==h||t<s.last){s=makePane(w,h);panes.set(g,s)}
   // Bound catch-up after tab suspension; normal animation steps stay continuous.
   let elapsed=s.last===null?0:Math.min(.25,Math.max(0,t-s.last));s.last=t;
   while(elapsed>0){const dt=Math.min(1/60,elapsed);step(s,dt);elapsed-=dt}
   const scene=sceneFor(w,h);g.save();g.lineCap='round';
   // Soft distant rainfall sits beneath the fogged pane and its water droplets.
   g.save();g.filter='blur('+Math.max(1.4,2.4*s.scale)+'px)';
   g.strokeStyle='#dbe8ec0a';g.lineWidth=Math.max(.5,.9*s.scale);g.beginPath();
   for(let i=0;i<75;i++){const x=random(i+940)*w,y=(random(i+1940)*h+t*(240+random(i)*180)*s.scale)%(h+60*s.scale)-30*s.scale;g.moveTo(x,y);g.lineTo(x-6*s.scale,y+24*s.scale)}g.stroke();g.restore();
   // The distant streaks are veiled by condensation before any foreground water.
   g.fillStyle='#91a9b508';g.fillRect(0,0,w,h);
   for(const p of s.tracks){g.lineWidth=Math.max(.4,p.r);g.strokeStyle=`rgba(170,194,198,${.025*p.life/7})`;g.beginPath();g.moveTo(p.x,p.y);g.lineTo(p.x2,p.y2);g.stroke()}
   // As the original fine trail fades, beads of water gently emerge along its path.
   for(const d of s.drops){
     const beadFade=Math.max(0,Math.min(1,(d.age-.1)/1.2));
     g.globalAlpha=d.kind==='residue'?beadFade*beadFade*(3-2*beadFade)*Math.min(1,(d.life-d.age)/2)*.85:Math.min(1,d.age/.3);water(g,scene,d);
   }
   g.globalAlpha=1;
   // A single reflection over all water places it on the far side of the pane.
   const glaze=g.createLinearGradient(0,0,w,h*.4);glaze.addColorStop(0,'#b9d0d208');glaze.addColorStop(.38,'#b9d0d200');glaze.addColorStop(.53,'#dae9e609');glaze.addColorStop(.68,'#b9d0d200');glaze.addColorStop(1,'#b9d0d204');g.fillStyle=glaze;g.fillRect(0,0,w,h);g.restore();
 }
 window.TeacherTilesRainyWindowScene={themes:['rainy-window'],prepare,paint,draw};
})();
