/* Global celebration preference. No per-tile state or additional cloud reads. */
(()=>{'use strict';
 const catalog=window.TeacherTilesTileEffectCatalog,key='teacherTilesActiveTileEffect',running=new Map();
 const accessible=item=>!item.productId||typeof cosmeticIsAccessible==='function'&&cosmeticIsAccessible(item.productId);
 const selected=()=>{let id;try{id=localStorage.getItem(key)}catch{}const item=catalog.get(id);return accessible(item)?item:catalog.all[0];};
 function equip(id){const item=catalog.get(id);if(!accessible(item))return false;try{localStorage.setItem(key,item.id)}catch{}window.dispatchEvent(new Event('teachertiles:tileeffectchange'));return true;}
 function cancel(layer){running.get(layer)?.();}
 function launch(layer,id){
  if(!layer)return;cancel(layer);const item=id?catalog.get(id):selected(),preview=layer.classList.contains('tile-effect-demo');
  if(preview&&matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const canvas=document.createElement('canvas');canvas.className='tile-effect-stage';canvas.setAttribute('aria-hidden','true');
  const w=layer.clientWidth||400,h=layer.clientHeight||300,scale=Math.min(preview?1:1.5,devicePixelRatio||1);canvas.width=Math.ceil(w*scale);canvas.height=Math.ceil(h*scale);layer.replaceChildren(canvas);
  const ctx=canvas.getContext('2d'),duration=item.kind==='confetti'?1700:2800;let frame=0,finish=0,start=performance.now();
  const stop=()=>{cancelAnimationFrame(frame);clearTimeout(finish);canvas.remove();if(running.get(layer)===stop)running.delete(layer);};running.set(layer,stop);
  const rnd=(a,b)=>a+Math.random()*(b-a),colors=item.colors,particles=[];
  const burstPoints=[[114,110,350],[285,90,850],[210,176,1350]];
  if(item.kind==='confetti')for(let i=0;i<(preview?32:60);i++){const a=rnd(0,Math.PI*2),v=rnd(75,190);particles.push({x:200,y:140,vx:Math.cos(a)*v,vy:Math.sin(a)*v-70,color:colors[i%colors.length],r:rnd(2,5),angle:rnd(0,6),spin:rnd(-8,8)});}
  if(item.kind==='fireworks')for(const [x,y,delay]of burstPoints)for(let i=0;i<(preview?42:68);i++){const a=rnd(0,Math.PI*2),speed=rnd(35,120);particles.push({x,y,delay,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,color:colors[i%colors.length],size:rnd(1.4,2.4),life:rnd(950,1450)});}
  if(item.kind==='explosion')for(let i=0;i<65;i++){const a=rnd(0,Math.PI*2),speed=rnd(50,190);particles.push({vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,color:colors[i%3],r:rnd(1,3),life:rnd(.7,1.8)});}
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
   if(item.kind==='confetti')for(const p of particles){const f=Math.min(1,t/1.4),d=1-Math.pow(1-f,3);ctx.globalAlpha=Math.min(1,t*12)*(1-f*f);ctx.save();ctx.translate(p.x+p.vx*d,p.y+p.vy*d+65*t*t);ctx.rotate(p.angle+p.spin*t);ctx.scale(1,Math.cos(t*9+p.angle)*.5+.7);ctx.fillStyle=p.color;ctx.fillRect(-p.r,-p.r*1.5,p.r*2,p.r*3);ctx.restore();}
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
    const strike=Math.floor(t/.75),phase=t% .75,alpha=strike<3?Math.max(0,1-phase/.62):0;if(alpha){glow(200,150,165,'#8c77ff',alpha*.27);ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();for(let i=0;i<bolts.length;i++){if(i%3===strike%3&&phase<.1)continue;const pts=bolts[i];ctx.moveTo(...pts[0]);for(const p of pts.slice(1))ctx.lineTo(...p);const [x,y]=pts[4];ctx.moveTo(x,y);ctx.lineTo(x+18,y-22);ctx.lineTo(x+33,y-16);ctx.lineTo(x+46,y-38);}for(const [width,color,a]of [[13,'#8562e7',.12],[7,'#91b5ff',.4],[3,'#bceaff',.95],[1.2,'#ffffff',1]]){ctx.globalAlpha=alpha*a;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}glow(200,150,32,'#f2f9ff',alpha*.7);}
   }
   ctx.globalAlpha=1;
  }
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduced){paint(550);finish=setTimeout(stop,400);return stop;}
  function tick(now){if(!layer.isConnected||document.hidden||layer.closest('[hidden],#asset-shelf[aria-hidden="true"]')||now-start>duration){stop();return;}paint(Math.max(0,now-start));frame=requestAnimationFrame(tick);}
  frame=requestAnimationFrame(tick);return stop;
 }
 function preview(id){const item=catalog.get(id),box=document.createElement('div');box.className='tile-effect-preview';box.dataset.effectPreview=item.id;box.setAttribute('aria-hidden','true');
  box.dataset.effectKind=item.kind;const colors=item.colors;let art='';
  if(item.kind==='confetti')for(let i=0;i<27;i++){const a=i*2.4,r=22+(i%5)*12;art+=`<rect x="${100+Math.cos(a)*r}" y="${64+Math.sin(a)*r*.65}" width="${4+i%3}" height="${8+i%5}" rx="1.4" fill="${colors[i%colors.length]}" transform="rotate(${i*31} ${100+Math.cos(a)*r} ${64+Math.sin(a)*r*.65})"/>`;}
  else if(item.kind==='lightning')art='<path d="m105 12-38 55h30l-9 44 48-63h-33l16-36M77 34l-19-9 9 22-29 8M131 70l23 4-11 15 30 8" fill="none" stroke="#9879eb" stroke-width="5" stroke-linejoin="round"/>';
  else if(item.kind==='explosion')art='<path d="m100 10 13 32 34-17-9 34 43 10-36 18 12 30-40-14-20 24-13-34-39 16 12-31-37-19 45-8-6-32 27 17Z" fill="#ff9e38"/><circle cx="103" cy="70" r="23" fill="#ffdd74"/>';
  else for(const [cx,cy,r]of [[69,57,36],[135,76,29]])for(let i=0;i<16;i++){const a=i*Math.PI/8;art+=`<path d="M${cx+Math.cos(a)*12} ${cy+Math.sin(a)*12}l${Math.cos(a)*(r-12)} ${Math.sin(a)*(r-12)}" stroke="${colors[i%colors.length]}" stroke-width="2.4" stroke-linecap="round"/>`;}
  const image=document.createElement('img');image.className='tile-effect-art';image.alt='';image.draggable=false;image.decoding='async';image.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140">'+art+'</svg>');const demo=document.createElement('div');demo.className='tile-effect-demo';box.append(image,demo);box.play=()=>launch(box.lastElementChild,item.id);return box;
 }
 let hoverRun=null;
 function stopPreview(){if(!hoverRun)return;clearTimeout(hoverRun.timer);hoverRun.stop?.();hoverRun=null;}
 function bindPreviews(root){
  root.addEventListener('pointerover',event=>{const card=event.target.closest('[data-shop-product],.shop-search-result,.tile-effect-choice');if(!card||card.contains(event.relatedTarget))return;const p=card.querySelector('[data-effect-preview]');if(!p)return;stopPreview();const run={card,timer:0,stop:null};hoverRun=run;run.start=()=>{if(hoverRun!==run)return;if(!card.matches(':hover')||!card.isConnected||card.closest('[hidden]')){stopPreview();return;}run.stop=launch(p.querySelector('.tile-effect-demo'),p.dataset.effectPreview);};run.timer=setTimeout(run.start,100);});
  root.addEventListener('pointerout',event=>{if(hoverRun&&hoverRun.card.contains(event.target)&&!hoverRun.card.contains(event.relatedTarget))stopPreview();});
  root.addEventListener('scroll',()=>{if(!hoverRun)return;hoverRun.stop?.();hoverRun.stop=null;clearTimeout(hoverRun.timer);hoverRun.timer=setTimeout(hoverRun.start,180);},true);
  const visibility=new MutationObserver(()=>{if(root.hidden||root.closest('[aria-hidden="true"]'))stopPreview();});visibility.observe(root,{attributes:true,attributeFilter:['hidden']});const shelf=root.closest('#asset-shelf');if(shelf)visibility.observe(shelf,{attributes:true,attributeFilter:['aria-hidden']});
 }
 function picker(panel,unlock){
  const key='teacherTilesEffectFavorites';let query='',view='all',ownedOnly=false,favorites=new Set();const read=()=>{try{favorites=new Set(JSON.parse(localStorage.getItem(key)||'[]'))}catch{favorites=new Set();}};read();
  panel.innerHTML='<div class="tile-effect-views cursor-picker-views"><button type="button" data-view="all" aria-pressed="true">All effects</button><button type="button" data-view="favorites" aria-pressed="false">☆ Favorites <span></span></button></div><input class="tile-effects-search" type="search" placeholder="Search tile effects" aria-label="Search tile effects"><div class="cursor-picker-filters"><span role="status"></span><label>Owned only <input type="checkbox" role="switch" aria-label="Owned tile effects only"><i aria-hidden="true"></i></label></div><div class="tile-effects-groups"></div>';
  const content=panel.querySelector('.tile-effects-groups'),cells=new Map(),sections=[];
  for(const group of ['Confetti','Fireworks','Special Effects']){const section=document.createElement('section'),h=document.createElement('h3'),grid=document.createElement('div');h.textContent=group;grid.className='tile-effects-grid';section.append(h,grid);content.append(section);sections.push(section);
   for(const item of catalog.all.filter(e=>e.group===group)){const cell=document.createElement('div');cell.className='tile-effect-cell';const b=document.createElement('button');b.type='button';b.className='tile-effect-choice';b.dataset.effect=item.id;const name=document.createElement('strong'),detail=document.createElement('small');name.textContent=item.name;b.append(preview(item.id),name,detail);b.onclick=()=>accessible(item)?equip(item.id):unlock(item.productId);
    const star=document.createElement('button');star.type='button';star.className='cursor-picker-favorite tile-effect-favorite';star.onclick=()=>{favorites.has(item.id)?favorites.delete(item.id):favorites.add(item.id);const value=JSON.stringify([...favorites]);if(window.TeacherTilesCollectionPreferences)window.TeacherTilesCollectionPreferences.write(key,value);else try{localStorage.setItem(key,value)}catch{}render();};cell.append(b,star);grid.append(cell);cells.set(item.id,{item,cell,b,star,detail,stamp:''});
   }
  }
  const empty=document.createElement('p');empty.className='tile-effects-empty';content.append(empty);
  function render(){const active=selected().id;let total=0;for(const {item,cell,b,star,detail}of cells.values()){const allowed=accessible(item),favorite=favorites.has(item.id),visible=(!query||item.name.toLowerCase().includes(query))&&(!ownedOnly||allowed)&&(view!=='favorites'||favorite);cell.hidden=!visible;if(visible)total++;b.setAttribute('aria-pressed',String(active===item.id));const text=active===item.id?'Equipped':allowed?'Apply Effect':'50 coins · Shop';if(detail.textContent!==text)detail.textContent=text;const glyph=favorite?'★':'☆';if(star.textContent!==glyph)star.textContent=glyph;star.setAttribute('aria-label',(favorite?'Unfavorite ':'Favorite ')+item.name);star.setAttribute('aria-pressed',String(favorite));const stamp=Boolean(window.TeacherTilesAccount?.state?.ownedProductIds?.includes(item.productId))+':'+allowed+':'+Boolean(window.TeacherTilesAccount?.state?.subscriptionActive)+':'+Boolean(window.TeacherTilesAccount?.state?.subscriptionOverride);const entry=cells.get(item.id);if(entry.stamp!==stamp){entry.stamp=stamp;if(typeof markSubscriptionAccess==='function')markSubscriptionAccess(b,item.productId);}}
   for(const section of sections)section.hidden=![...section.querySelectorAll('.tile-effect-cell')].some(c=>!c.hidden);empty.hidden=total>0;empty.textContent=view==='favorites'?'Star an effect to keep it here.':'No tile effects found.';panel.querySelector('[role=status]').textContent=total+' effects';panel.querySelector('[data-view=favorites] span').textContent=favorites.size||'';
  }
  panel.querySelector('input[type=search]').oninput=e=>{stopPreview();query=e.target.value.trim().toLowerCase();render();};panel.querySelector('[role=switch]').onchange=e=>{stopPreview();ownedOnly=e.target.checked;render();};panel.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{stopPreview();view=b.dataset.view;panel.querySelectorAll('[data-view]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));render();});
  for(const event of ['teachertiles:accountchange','teachertiles:shopownershipchange','teachertiles:tileeffectchange'])window.addEventListener(event,()=>{if(!panel.hidden)render();});window.addEventListener('teachertiles:collectionpreferences',()=>{read();if(!panel.hidden)render();});window.addEventListener('storage',e=>{if(e.key===key){read();if(!panel.hidden)render();}});bindPreviews(panel);render();return {render};
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden)for(const stop of [...running.values()])stop();});
 window.addEventListener('storage',e=>{if(e.key===key)window.dispatchEvent(new Event('teachertiles:tileeffectchange'));});
 window.TeacherTilesTileEffects=Object.freeze({...catalog,selected,equip,launch,cancel,preview,picker,bindPreviews});
})();
