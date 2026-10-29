/* Global celebration preference. No per-tile state or additional cloud reads. */
(()=>{'use strict';
 const catalog=window.TeacherTilesTileEffectCatalog,key='teacherTilesActiveTileEffect',running=new Map();
 const randomKey='teacherTilesRandomTileEffects',celebrations=new WeakMap();
 let randomEnabled=false,randomBag=[],randomPool='',lastRandom='';
 const readRandom=()=>{try{randomEnabled=localStorage.getItem(randomKey)==='true'}catch{randomEnabled=false}};readRandom();
 function setRandom(enabled){randomEnabled=Boolean(enabled);randomBag=[];randomPool='';try{localStorage.setItem(randomKey,String(randomEnabled))}catch{}window.dispatchEvent(new Event('teachertiles:tileeffectchange'));}
 function nextEffect(){
  if(!randomEnabled)return selected();
  const pool=catalog.all.filter(accessible),signature=pool.map(item=>item.id).join('|');
  if(signature!==randomPool||!randomBag.length){
   randomPool=signature;randomBag=[...pool];
   for(let i=randomBag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[randomBag[i],randomBag[j]]=[randomBag[j],randomBag[i]];}
   if(randomBag.length>1&&randomBag.at(-1).id===lastRandom)[randomBag[0],randomBag[randomBag.length-1]]=[randomBag.at(-1),randomBag[0]];
  }
  const item=randomBag.pop()||catalog.all[0];lastRandom=item.id;return item;
 }
 const forOwner=owner=>owner&&celebrations.get(owner)||selected();
 const accessible=item=>!item.productId||typeof cosmeticIsAccessible==='function'&&cosmeticIsAccessible(item.productId);
 const selected=()=>{let id;try{id=localStorage.getItem(key)}catch{}const item=catalog.get(id);return accessible(item)?item:catalog.all[0];};
 function equip(id){const item=catalog.get(id);if(!accessible(item))return false;try{localStorage.setItem(key,item.id)}catch{}if(randomEnabled)setRandom(false);window.dispatchEvent(new Event('teachertiles:tileeffectchange'));return true;}
 function cancel(layer){running.get(layer)?.();}
 // One reusable bill sprite keeps dozens of spinning notes inexpensive to draw.
 const moneyBill=document.createElement('canvas');moneyBill.width=128;moneyBill.height=64;
 {const g=moneyBill.getContext('2d');g.fillStyle='#dcebb8';g.fillRect(1,1,126,62);g.strokeStyle='#386346';g.lineWidth=2;g.strokeRect(2,2,124,60);g.strokeRect(7,7,114,50);g.fillStyle='#adc78b';g.beginPath();g.ellipse(64,32,20,23,0,0,Math.PI*2);g.fill();g.stroke();g.fillStyle='#32573d';g.textAlign='center';g.textBaseline='middle';g.font='bold 34px Georgia';g.fillText('$',64,34);g.font='bold 15px Georgia';g.fillText('1',20,20);g.fillText('1',108,46);g.lineWidth=1;for(let i=0;i<4;i++){g.beginPath();g.moveTo(17,34+i*4);g.lineTo(36,34+i*4);g.moveTo(92,15+i*4);g.lineTo(111,15+i*4);g.stroke();}}
 const celebrationLeadMs=300;
 function launch(layer,id,ready=false,still=null){
  if(!layer)return;cancel(layer);const preview=layer.classList.contains('tile-effect-demo'),item=id?catalog.get(id):preview?selected():nextEffect();
  // Choose once for each celebration, so simultaneous tiles retain their own matching sound.
  if(!preview&&!ready&&still===null)celebrations.set(layer.closest('.module')||layer,item);
  if(still===null&&preview&&matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  if(!preview&&!['confetti','money-confetti'].includes(item.kind)&&!ready){
    const timer=setTimeout(()=>{if(layer.isConnected)launch(layer,item.id,true);else cancel(layer);},celebrationLeadMs);
    const stop=()=>{clearTimeout(timer);if(running.get(layer)===stop)running.delete(layer);};running.set(layer,stop);return stop;
  }
  const canvas=document.createElement('canvas');canvas.className='tile-effect-stage';canvas.setAttribute('aria-hidden','true');
  const w=layer.clientWidth||400,h=layer.clientHeight||300,scale=Math.min(preview?1:1.5,devicePixelRatio||1);canvas.width=Math.ceil(w*scale);canvas.height=Math.ceil(h*scale);layer.replaceChildren(canvas);if(item.kind==='slime')canvas.style.borderRadius=getComputedStyle(layer.closest('.module')||layer).borderRadius;
  const ctx=canvas.getContext('2d'),duration=item.kind==='leaves'?4000:item.kind==='slime'?5200:['confetti','money-confetti'].includes(item.kind)?1700:2800;let frame=0,finish=0,start=performance.now();
  const stop=()=>{cancelAnimationFrame(frame);clearTimeout(finish);canvas.remove();if(running.get(layer)===stop)running.delete(layer);};running.set(layer,stop);
  const rnd=(a,b)=>a+Math.random()*(b-a),colors=item.colors,particles=[];
  const burstPoints=[[114,110,350],[285,90,850],[210,176,1350]];
  if(['confetti','money-confetti'].includes(item.kind))for(let i=0;i<(item.kind==='money-confetti'?(preview?22:40):(preview?32:60));i++){const a=rnd(0,Math.PI*2),v=rnd(75,190);particles.push({x:200,y:140,vx:Math.cos(a)*v,vy:Math.sin(a)*v-70,color:colors[i%colors.length],r:rnd(2,5),angle:rnd(0,6),spin:rnd(-8,8)});}
  if(item.kind==='fireworks')for(const [x,y,delay]of burstPoints)for(let i=0;i<(preview?42:68);i++){const a=rnd(0,Math.PI*2),speed=rnd(35,120);particles.push({x,y,delay,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,color:colors[i%colors.length],size:rnd(1.4,2.4),life:rnd(950,1450)});}
  if(item.kind==='explosion')for(let i=0;i<65;i++){const a=rnd(0,Math.PI*2),speed=rnd(50,190);particles.push({vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,color:colors[i%3],r:rnd(1,3),life:rnd(.7,1.8)});}
  if(item.kind==='leaves')for(let i=0;i<(preview?35:65);i++)particles.push({delay:rnd(-800,1800),y:rnd(-.1,1.1),size:rnd(.25,.65),speed:rnd(.75,1.2),phase:rnd(0,6),color:colors[i%colors.length],index:i});
  if(item.kind==='rain')for(let i=0;i<(preview?85:145);i++)particles.push({x:rnd(-.08,1.08),delay:rnd(0,1550),length:rnd(24,64),weight:rnd(.65,1.65),depth:rnd(.3,.85)});
  if(item.kind==='smoke')for(let i=0;i<28;i++)particles.push({x:rnd(-1,1),y:rnd(-1,1),r:rnd(.14,.26),phase:rnd(0,6),color:colors[i%colors.length]});
  // Several irregular, shaded cloud silhouettes avoid repeated stamped cloud icons.
  const smokeArts=[];
  if(item.kind==='smoke')for(let v=0;v<4;v++){
   const art=document.createElement('canvas');art.width=256;art.height=224;const g=art.getContext('2d'),cloud=new Path2D();
   const lobes=Array.from({length:9},(_,i)=>{const a=i*Math.PI*2/9;return [128+Math.cos(a)*(46+8*Math.sin(i*3+v)),112+Math.sin(a)*37,35+10*Math.sin(i*2.3+v)];});lobes.push([128,112,63]);
   for(const [x,y,r]of lobes){cloud.moveTo(x+r,y);cloud.arc(x,y,r,0,Math.PI*2);}
   const shade=g.createLinearGradient(70,35,155,190);shade.addColorStop(0,colors[0]);shade.addColorStop(.48,colors[1]);shade.addColorStop(1,colors[2]);g.fillStyle=shade;g.filter='blur(2px)';g.fill(cloud);g.filter='none';
   g.save();g.clip(cloud);for(const [x,y,r]of lobes){const light=g.createRadialGradient(x-r*.25,y-r*.4,0,x,y,r*1.3);light.addColorStop(0,colors[0]+'66');light.addColorStop(1,colors[0]+'00');g.fillStyle=light;g.fillRect(x-r*1.5,y-r*1.5,r*3,r*3);}g.restore();smokeArts.push(art);
  }
  const slimeArms=Array.from({length:9},(_,i)=>({a:i*Math.PI*2/9+rnd(-.18,.18),reach:rnd(.22,.55),width:rnd(.1,.2)}));
  const slimeLobes=Array.from({length:96},(_,i)=>{const a=i*Math.PI*2/96;return .73+slimeArms.reduce((v,p)=>{const d=Math.atan2(Math.sin(a-p.a),Math.cos(a-p.a));return v+p.reach*Math.exp(-d*d/(p.width*p.width));},0);});
  const slimeDrops=Array.from({length:12},(_,i)=>({a:i*Math.PI*2/12,r:rnd(.8,1.5),size:rnd(.05,.13),speed:rnd(.7,1.3)}));
  const bolts=Array.from({length:9},(_,i)=>{const a=i*Math.PI*2/9,pts=[[200,150]];for(let j=1;j<=7;j++)pts.push([200+Math.cos(a)*j*25+rnd(-13,13),150+Math.sin(a)*j*19+rnd(-10,10)]);return pts;});
  const glow=(x,y,r,color,alpha)=>{ctx.globalAlpha=alpha;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.globalAlpha=1;};
  const dot=(x,y,r,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();};
  function paint(ms){
   // Keep particles circular at every tile aspect ratio, including a resize mid-effect.
   const width=layer.clientWidth||400,height=layer.clientHeight||300;
   if(canvas.width!==Math.ceil(width*scale)||canvas.height!==Math.ceil(height*scale)){canvas.width=Math.ceil(width*scale);canvas.height=Math.ceil(height*scale);}
   ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
   const fit=Math.min(canvas.width/400,canvas.height/300);
   ctx.setTransform(fit,0,0,fit,(canvas.width-400*fit)/2,(canvas.height-300*fit)/2);
   const t=Math.max(0,ms)/1000;
   if(['confetti','money-confetti'].includes(item.kind))for(const p of particles){const f=Math.min(1,t/1.4),d=1-Math.pow(1-f,3);ctx.globalAlpha=Math.min(1,t*12)*(1-f*f);ctx.save();ctx.translate(p.x+p.vx*d,p.y+p.vy*d+65*t*t);ctx.rotate(p.angle+p.spin*t);ctx.scale(1,Math.cos(t*9+p.angle)*.5+.7);ctx.fillStyle=p.color;if(item.kind==='money-confetti'){const size=19+p.r*2;ctx.drawImage(moneyBill,-size/2,-size/4,size,size/2);}else ctx.fillRect(-p.r,-p.r*1.5,p.r*2,p.r*3);ctx.restore();}
   if(item.kind==='leaves'){ctx.save();ctx.setTransform(scale,0,0,scale,0,0);for(const p of particles){const progress=(ms-p.delay)/(2300*p.speed);if(progress<0||progress>1)continue;const size=p.size*Math.min(width,height)/300;ctx.globalAlpha=Math.min(1,progress*9,(1-progress)*7,Math.max(0,(duration-ms)/500));window.TeacherTilesAutumnScenes.leaf(ctx,-45+progress*(width+90),p.y*height+Math.sin(progress*6+p.phase)*height*.12,size,progress*5+p.phase,p.color,p.index,Math.cos(progress*7+p.phase));}ctx.restore();}
   if(item.kind==='fireworks'){
    for(const [x,y,delay]of burstPoints){const age=ms-delay;if(age<0&&age>-350){const u=1+age/350,cy=300+(y-300)*u;ctx.globalAlpha=u;ctx.strokeStyle='#f5c566';ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(x,cy+22);ctx.lineTo(x,cy);ctx.stroke();dot(x,cy,2,'#fff8cf');}if(age>=0&&age<300)glow(x,y,35*(1+age/300),colors[0],.45*(1-age/300));}
    for(const p of particles){const age=ms-p.delay;if(age<0||age>p.life)continue;const q=age/1000,k=1-Math.exp(-q*2.1),prev=1-Math.exp(-Math.max(0,q-.14)*2.1),x=p.x+p.vx*k,y=p.y+p.vy*k+35*q*q;ctx.globalAlpha=Math.pow(1-age/p.life,.75);ctx.strokeStyle=p.color;ctx.lineWidth=p.size;ctx.beginPath();ctx.moveTo(p.x+p.vx*prev,p.y+p.vy*prev+35*Math.max(0,q-.14)**2);ctx.lineTo(x,y);const brightness=ctx.globalAlpha;ctx.globalAlpha=brightness*.2;ctx.lineWidth=p.size*3;ctx.stroke();ctx.globalAlpha=brightness;ctx.lineWidth=p.size;ctx.stroke();dot(x,y,p.size,p.color);ctx.globalAlpha*=.8;dot(x,y,.55,'#fffbea');}
   }
   if(item.kind==='explosion'){
    const blast=Math.min(1,t/.28),fade=Math.max(0,1-t/1.1);
    // Rolling smoke behind a hot, scalloped fireball and an expanding pressure ring.
    for(let i=0;i<10;i++){const a=i*Math.PI/5,r=26+55*Math.min(1,t/1.3);ctx.globalAlpha=Math.max(0,Math.min(.5,t*.8)*(1-t/2.7));dot(200+Math.cos(a)*r,145+Math.sin(a)*r*.7-t*18,16+t*14,i%2?'#6c6677':'#89818a');}
    if(t<1.1){glow(200,150,130*blast,'#ff8b26',fade*.75);for(let i=0;i<12;i++){const a=i*Math.PI/6,r=(44+18*Math.sin(i*5))*blast;ctx.globalAlpha=fade;dot(200+Math.cos(a)*r,150+Math.sin(a)*r,36*blast,'#f46c24');dot(200+Math.cos(a)*r*.55,150+Math.sin(a)*r*.55,28*blast,'#ffb642');}ctx.globalAlpha=fade;dot(200,150,38*blast,'#fff2b2');}
    ctx.globalAlpha=Math.max(0,1-t/1.2)*.7;ctx.strokeStyle='#ffd48c';ctx.lineWidth=4*(1-Math.min(1,t/1.2));ctx.beginPath();ctx.ellipse(200,155,Math.max(1,175*Math.min(1,t/.8)),Math.max(1,104*Math.min(1,t/.8)),0,0,Math.PI*2);ctx.stroke();
    for(const p of particles){if(t>p.life)continue;ctx.globalAlpha=1-t/p.life;const x=200+p.vx*t,y=150+p.vy*t+65*t*t;ctx.strokeStyle=p.color;ctx.lineWidth=p.r;ctx.beginPath();ctx.moveTo(x-p.vx*.04,y-p.vy*.04);ctx.lineTo(x,y);ctx.stroke();}
   }
   if(item.kind==='lightning'){
    const strike=Math.floor(t/.75),phase=t% .75,alpha=strike<3?Math.max(0,1-phase/.62):0;if(alpha){glow(200,150,165,colors[2],alpha*.27);ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();for(let i=0;i<bolts.length;i++){if(i%3===strike%3&&phase<.1)continue;const pts=bolts[i];ctx.moveTo(...pts[0]);for(const p of pts.slice(1))ctx.lineTo(...p);const [x,y]=pts[4];ctx.moveTo(x,y);ctx.lineTo(x+18,y-22);ctx.lineTo(x+33,y-16);ctx.lineTo(x+46,y-38);}for(const [width,color,a]of [[13,colors[2],.12],[7,colors[1],.4],[3,colors[0],.95],[1.2,'#ffffff',1]]){ctx.globalAlpha=alpha*a;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}glow(200,150,32,colors[0],alpha*.7);}
   }
   if(item.kind==='rain'||item.kind==='smoke'){
    ctx.setTransform(scale,0,0,scale,0,0);
    if(item.kind==='rain'){
     // Fine wind-slanted streaks, with transparent tails instead of droplet silhouettes.
     const rainScale=Math.max(.6,Math.min(1.6,Math.min(width,height)/300));
     ctx.lineCap='round';
     for(const p of particles){
      const u=(ms-p.delay)/950;if(u<0||u>1.2)continue;
      const length=p.length*rainScale,y=-length+u*(height+length*2),x=p.x*width+y*.1;
      const tailX=x-length*.1,tailY=y-length;
      ctx.globalAlpha=p.depth*Math.min(1,u*10)*Math.max(0,1-(t-2.3)/.5);
      const streak=ctx.createLinearGradient(tailX,tailY,x,y);
      streak.addColorStop(0,colors[1]+'00');streak.addColorStop(.35,colors[1]+'88');streak.addColorStop(.85,colors[1]);streak.addColorStop(1,colors[0]);
      ctx.strokeStyle=streak;ctx.lineWidth=p.weight*rainScale;
      ctx.beginPath();ctx.moveTo(tailX,tailY);ctx.lineTo(x,y);ctx.stroke();
     }
    }
    if(item.kind==='smoke'){
     const spread=1-Math.exp(-t*5),fade=Math.min(1,t*9)*Math.max(0,1-(t-1.2)/1.6),radius=Math.hypot(width,height);
     for(const [i,p] of particles.entries()){const x=width/2+p.x*width*.65*spread+Math.sin(t+p.phase)*8,y=height/2+p.y*height*.6*spread-t*12,r=Math.max(1,radius*p.r*spread);ctx.globalAlpha=fade*.72;ctx.save();ctx.translate(x,y);ctx.rotate(p.phase*.4);ctx.drawImage(smokeArts[i%smokeArts.length],-r,-r*.875,r*2,r*1.75);ctx.restore();}
    }
   }
   if(item.kind==='slime'){
    ctx.setTransform(scale,0,0,scale,0,0);
    const cx=width/2,cy=height*.43;
    const radius=Math.min(width,height)*.31,grow=1-Math.pow(1-Math.min(1,t/.24),3),drip=Math.max(0,t-.6),slide=Math.pow(Math.max(0,t-1.8)/3.4,2)*height*1.1;
    ctx.globalAlpha=Math.min(1,t*15)*Math.max(0,1-(t-4.1)/1.1);ctx.save();ctx.translate(cx,cy+slide);ctx.scale(grow,grow);
    const splat=new Path2D(),points=slimeLobes.map((v,i)=>{const a=i/slimeLobes.length*Math.PI*2;return [Math.cos(a)*radius*v,Math.sin(a)*radius*v*.7];});const last=points.at(-1),first=points[0];splat.moveTo((last[0]+first[0])/2,(last[1]+first[1])/2);for(let i=0;i<points.length;i++){const p=points[i],n=points[(i+1)%points.length];splat.quadraticCurveTo(p[0],p[1],(p[0]+n[0])/2,(p[1]+n[1])/2);}splat.closePath();
    // Thick rounded trails remain joined to the main splat as gravity pulls them down.
    for(let i=0;i<5;i++){const x=(i-2)*radius*.34,y=radius*.35,length=drip*radius*(.12+.06*(i%3)),thick=radius*(.08+.02*(i%2));splat.moveTo(x+thick*1.5,y-thick);splat.bezierCurveTo(x+thick*.55,y+length*.35,x+thick*.6,y+length*.75,x+thick,y+length);splat.bezierCurveTo(x+thick*1.4,y+length+thick*2,x-thick*1.4,y+length+thick*2,x-thick,y+length);splat.bezierCurveTo(x-thick*.6,y+length*.75,x-thick*.55,y+length*.35,x-thick*1.5,y-thick);splat.closePath();}
    const fill=ctx.createLinearGradient(-radius,-radius,radius,radius*1.4);fill.addColorStop(0,colors[0]);fill.addColorStop(.3,colors[1]);fill.addColorStop(1,colors[2]);ctx.fillStyle=fill;ctx.shadowColor=colors[2]+'66';ctx.shadowBlur=10;ctx.shadowOffsetY=5;ctx.fill(splat);ctx.shadowBlur=0;ctx.shadowOffsetY=0;
    for(const d of slimeDrops){const x=Math.cos(d.a)*radius*d.r*1.4,y=Math.sin(d.a)*radius*d.r+drip*radius*.15*d.speed;ctx.fillStyle=fill;ctx.beginPath();ctx.ellipse(x,y,radius*d.size,radius*d.size*(1+drip*.15),-.3,0,Math.PI*2);ctx.fill();}
    ctx.strokeStyle=colors[0]+'bb';ctx.lineWidth=radius*.055;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-radius*.65,-radius*.05);ctx.quadraticCurveTo(-radius*.65,-radius*.45,-radius*.2,-radius*.46);ctx.stroke();ctx.fillStyle='#ffffff99';ctx.beginPath();ctx.ellipse(radius*.3,-radius*.18,radius*.1,radius*.045,-.4,0,Math.PI*2);ctx.fill();ctx.restore();
   }
   ctx.globalAlpha=1;
  }
  if(still!==null){paint(still);return stop;}
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduced){paint(550);finish=setTimeout(stop,400);return stop;}
  function tick(now){if(!layer.isConnected||document.hidden||layer.closest('[hidden],#asset-shelf[aria-hidden="true"]')||now-start>duration){stop();return;}paint(Math.max(0,now-start));frame=requestAnimationFrame(tick);}
  frame=requestAnimationFrame(tick);return stop;
 }
 const stillPreviews=new Map();
 function preview(id){const item=catalog.get(id),box=document.createElement('div');box.className='tile-effect-preview';box.dataset.effectPreview=item.id;box.setAttribute('aria-hidden','true');
  box.dataset.effectKind=item.kind;const colors=item.colors;let art='';
  if(item.kind==='confetti')for(let i=0;i<27;i++){const a=i*2.4,r=22+(i%5)*12;art+=`<rect x="${100+Math.cos(a)*r}" y="${64+Math.sin(a)*r*.65}" width="${4+i%3}" height="${8+i%5}" rx="1.4" fill="${colors[i%colors.length]}" transform="rotate(${i*31} ${100+Math.cos(a)*r} ${64+Math.sin(a)*r*.65})"/>`;}
  else if(item.kind==='lightning')art=`<path d="M77 34l-19-9 9 22-29 8M131 70l23 4-11 15 30 8" fill="none" stroke="${colors[2]}" stroke-width="5" stroke-linejoin="round"/><path d="m105 12-38 55h30l-9 44 48-63h-33l16-36Z" fill="${colors[0]}" stroke="${colors[1]}" stroke-width="5" stroke-linejoin="round"/>`;
  else if(item.kind==='explosion')art='<path d="m100 10 13 32 34-17-9 34 43 10-36 18 12 30-40-14-20 24-13-34-39 16 12-31-37-19 45-8-6-32 27 17Z" fill="#ff9e38"/><circle cx="103" cy="70" r="23" fill="#ffdd74"/>';
  else for(const [cx,cy,r]of [[69,57,36],[135,76,29]])for(let i=0;i<16;i++){const a=i*Math.PI/8;art+=`<path d="M${cx+Math.cos(a)*12} ${cy+Math.sin(a)*12}l${Math.cos(a)*(r-12)} ${Math.sin(a)*(r-12)}" stroke="${colors[i%colors.length]}" stroke-width="2.4" stroke-linecap="round"/>`;}
  const image=document.createElement('img');image.className='tile-effect-art';image.alt='';image.draggable=false;image.decoding='async';image.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140">'+art+'</svg>');const demo=document.createElement('div');demo.className='tile-effect-demo';box.append(image,demo);if(['leaves','lightning','rain','smoke','slime','money-confetti'].includes(item.kind)){if(!stillPreviews.has(item.id)){const stop=launch(demo,item.id,true,item.kind==='lightning'?140:item.kind==='rain'?1100:650);stillPreviews.set(item.id,demo.querySelector('canvas').toDataURL());stop();}image.src=stillPreviews.get(item.id);}box.play=()=>launch(box.lastElementChild,item.id);return box;
 }
 let hoverRun=null;
 function stopPreview(){if(!hoverRun)return;clearTimeout(hoverRun.timer);hoverRun.stop?.();hoverRun=null;}
 function bindPreviews(root){
  root.addEventListener('pointerover',event=>{const card=event.target.closest('[data-shop-product],.shop-search-result,.tile-effect-choice,.shop-category--tile-effects');if(!card||card.contains(event.relatedTarget))return;const previews=[...card.querySelectorAll('[data-effect-preview]')];if(!previews.length)return;stopPreview();const run={card,timer:0,stop:null};hoverRun=run;run.start=()=>{if(hoverRun!==run)return;if(card.closest('.is-browse-scrolling')){run.timer=setTimeout(run.start,180);return;}if(!card.matches(':hover')||!card.isConnected||card.closest('[hidden]')){stopPreview();return;}const stops=previews.map(p=>launch(p.querySelector('.tile-effect-demo'),p.dataset.effectPreview));run.stop=()=>stops.forEach(stop=>stop?.());};run.timer=setTimeout(run.start,100);});
  root.addEventListener('pointerout',event=>{if(hoverRun&&hoverRun.card.contains(event.target)&&!hoverRun.card.contains(event.relatedTarget))stopPreview();});
  root.addEventListener('scroll',()=>{if(!hoverRun)return;hoverRun.stop?.();hoverRun.stop=null;clearTimeout(hoverRun.timer);hoverRun.timer=setTimeout(hoverRun.start,180);},true);
  const visibility=new MutationObserver(()=>{if(root.hidden||root.closest('[aria-hidden="true"]'))stopPreview();});visibility.observe(root,{attributes:true,attributeFilter:['hidden']});const shelf=root.closest('#asset-shelf');if(shelf)visibility.observe(shelf,{attributes:true,attributeFilter:['aria-hidden']});
 }
 function picker(panel,unlock){
  const key='teacherTilesEffectFavorites';let query='',view='all',ownedOnly=false,favorites=new Set();const read=()=>{try{favorites=new Set(JSON.parse(localStorage.getItem(key)||'[]'))}catch{favorites=new Set();}};read();
  panel.innerHTML='<div class="tile-effect-views cursor-picker-views"><button type="button" data-view="all" aria-pressed="true">All Effects</button><button type="button" data-view="favorites" aria-pressed="false">Favorites <span></span></button></div><input class="tile-effects-search" type="search" placeholder="Search tile effects" aria-label="Search tile effects"><div class="cursor-picker-filters tile-effects-filter-row"><span role="status"></span><label>Random <input data-random type="checkbox" role="switch" aria-label="Random owned tile effects"><i aria-hidden="true"></i></label><label>Owned Only <input data-owned type="checkbox" role="switch" aria-label="Owned tile effects only"><i aria-hidden="true"></i></label></div><div class="tile-effects-groups"></div>';
  const content=panel.querySelector('.tile-effects-groups'),cells=new Map(),sections=[];
  for(const group of [...new Set(catalog.all.map(item=>item.group))]){const section=document.createElement('section'),h=document.createElement('h3'),grid=document.createElement('div');h.textContent=group;grid.className='tile-effects-grid';section.append(h,grid);content.append(section);sections.push(section);
   for(const item of catalog.all.filter(e=>e.group===group)){const cell=document.createElement('div');cell.className='tile-effect-cell';const b=document.createElement('button');b.type='button';b.className='tile-effect-choice';b.dataset.effect=item.id;const name=document.createElement('strong'),detail=document.createElement('small');name.textContent=item.name;const art=preview(item.id),lock=document.createElement('span');lock.className='tile-effect-lock';lock.setAttribute('aria-hidden','true');lock.innerHTML='<span><img src="assets/ui/lock.svg?v=20260927-gold" alt="">Unlock</span>';art.append(lock);b.append(art,name,detail);b.onclick=()=>accessible(item)?equip(item.id):unlock(item.productId);
    const star=document.createElement('button');star.type='button';star.className='cursor-picker-favorite tile-effect-favorite';star.onclick=()=>{favorites.has(item.id)?favorites.delete(item.id):favorites.add(item.id);const value=JSON.stringify([...favorites]);if(window.TeacherTilesCollectionPreferences)window.TeacherTilesCollectionPreferences.write(key,value);else try{localStorage.setItem(key,value)}catch{}render();};cell.append(b,star);grid.append(cell);cells.set(item.id,{item,cell,b,star,detail,stamp:''});
   }
  }
  const empty=document.createElement('p');empty.className='tile-effects-empty';content.append(empty);
  function render(){panel.querySelector('[data-random]').checked=randomEnabled;const active=randomEnabled?null:selected().id;let total=0;for(const {item,cell,b,star,detail}of cells.values()){const allowed=accessible(item),favorite=favorites.has(item.id),visible=(!query||item.name.toLowerCase().includes(query))&&(!ownedOnly||allowed)&&(view!=='favorites'||favorite);cell.hidden=!visible;if(visible)total++;b.setAttribute('aria-pressed',String(active===item.id));b.classList.toggle('is-cosmetic-locked',!allowed);b.setAttribute('aria-label',allowed?item.name:(item.name+' — locked; purchase in Shop'));const text=active===item.id?'Equipped':allowed?'Apply Effect':'50 coins · Shop';if(detail.textContent!==text)detail.textContent=text;const glyph=favorite?'★':'☆';if(star.textContent!==glyph)star.textContent=glyph;star.setAttribute('aria-label',(favorite?'Unfavorite ':'Favorite ')+item.name);star.setAttribute('aria-pressed',String(favorite));const stamp=Boolean(window.TeacherTilesAccount?.state?.ownedProductIds?.includes(item.productId))+':'+allowed+':'+Boolean(window.TeacherTilesAccount?.state?.subscriptionActive)+':'+Boolean(window.TeacherTilesAccount?.state?.subscriptionOverride)+':'+Boolean(window.TeacherTilesAccount?.state?.districtPremium);const entry=cells.get(item.id);if(entry.stamp!==stamp){entry.stamp=stamp;if(typeof markSubscriptionAccess==='function')markSubscriptionAccess(b,item.productId);}}
   for(const section of sections)section.hidden=![...section.querySelectorAll('.tile-effect-cell')].some(c=>!c.hidden);empty.hidden=total>0;empty.textContent=view==='favorites'?'Star an effect to keep it here.':'No tile effects found.';panel.querySelector('[role=status]').textContent=total+' effects';panel.querySelector('[data-view=favorites] span').textContent=favorites.size||'';
  }
  panel.querySelector('input[type=search]').oninput=e=>{stopPreview();query=e.target.value.trim().toLowerCase();render();};panel.querySelector('[data-random]').onchange=e=>setRandom(e.target.checked);panel.querySelector('[data-owned]').onchange=e=>{stopPreview();ownedOnly=e.target.checked;render();};panel.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{stopPreview();view=b.dataset.view;panel.querySelectorAll('[data-view]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));render();});
  for(const event of ['teachertiles:accountchange','teachertiles:shopownershipchange','teachertiles:tileeffectchange'])window.addEventListener(event,()=>{if(!panel.hidden)render();});window.addEventListener('teachertiles:collectionpreferences',()=>{read();if(!panel.hidden)render();});window.addEventListener('storage',e=>{if(e.key===key){read();if(!panel.hidden)render();}});bindPreviews(panel);render();return {render};
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden)for(const stop of [...running.values()])stop();});
 window.addEventListener('storage',e=>{if(e.key===randomKey){readRandom();randomBag=[];randomPool='';}if(e.key===key||e.key===randomKey)window.dispatchEvent(new Event('teachertiles:tileeffectchange'));});
 window.TeacherTilesTileEffects=Object.freeze({...catalog,selected,forOwner,setRandom,isRandom:()=>randomEnabled,equip,launch,cancel,preview,picker,bindPreviews,celebrationLeadMs});
})();
