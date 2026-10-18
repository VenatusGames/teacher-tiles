/* Global celebration preference. No per-tile state or additional cloud reads. */
(()=>{'use strict';
 const catalog=window.TeacherTilesTileEffectCatalog,key='teacherTilesActiveTileEffect',running=new Map();
 const accessible=item=>!item.productId||typeof cosmeticIsAccessible==='function'&&cosmeticIsAccessible(item.productId);
 const selected=()=>{let id;try{id=localStorage.getItem(key)}catch{}const item=catalog.get(id);return accessible(item)?item:catalog.all[0];};
 function equip(id){const item=catalog.get(id);if(!accessible(item))return false;try{localStorage.setItem(key,item.id)}catch{}window.dispatchEvent(new Event('teachertiles:tileeffectchange'));return true;}
 function cancel(layer){running.get(layer)?.();}
 function launch(layer,id){
  if(!layer)return;cancel(layer);layer.replaceChildren();const item=id?catalog.get(id):selected(),animations=[];let timer;
  const stop=()=>{clearTimeout(timer);for(const a of animations)a.cancel();layer.replaceChildren();running.delete(layer);};running.set(layer,stop);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animate=(node,frames,options)=>{if(reduced){node.style.opacity='.8';return;}animations.push(node.animate(frames,{fill:'both',...options}));};
  if(item.kind==='confetti'){
   const spinner=layer.classList.contains('spinner-confetti-layer'),count=reduced?12:spinner?66:54;
   for(let i=0;i<count;i++){const p=document.createElement('i'),a=Math.random()*Math.PI*2,d=(90+Math.random()*230)*(layer.classList.contains('tile-effect-demo')?Math.min(1,layer.clientWidth/400):1);p.className=spinner?'spinner-confetti-piece':'confetti-piece';p.style.setProperty('--x',`${Math.cos(a)*d}px`);p.style.setProperty('--y',`${Math.sin(a)*d+(spinner?65:-50)}px`);p.style.setProperty('--r',`${Math.round(Math.random()*760-380)}deg`);p.style.setProperty('--confetti',item.colors[i%item.colors.length]);p.style.width=`${6+Math.random()*5}px`;p.style.height=`${8+Math.random()*10}px`;p.style.animationDelay=`${Math.random()*.12}s`;if(reduced){p.style.animation='none';p.style.opacity='.85';p.style.left=(20+Math.random()*60)+'%';p.style.top=(20+Math.random()*60)+'%';}layer.append(p);}
  }else{
   const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 400 300');svg.setAttribute('preserveAspectRatio','xMidYMid meet');svg.classList.add('tile-effect-stage');svg.setAttribute('aria-hidden','true');layer.append(svg);
   const shape=(tag,attrs)=>{const e=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);svg.append(e);return e;};
   if(item.kind==='lightning'){
    for(let chain=0;chain<6;chain++){const a=chain*Math.PI/3;let x=200,y=150,points=`${x},${y}`;
     for(let step=1;step<6;step++){x=200+Math.cos(a)*step*30+(Math.random()-.5)*24;y=150+Math.sin(a)*step*24+(Math.random()-.5)*24;points+=` ${x},${y}`;if(step===3){const b=shape('polyline',{points:`${x},${y} ${x+25*Math.cos(a+1)},${y+25*Math.sin(a+1)} ${x+50*Math.cos(a+1)},${y+50*Math.sin(a+1)}`,fill:'none',stroke:item.colors[1],'stroke-width':2});animate(b,[{opacity:0},{opacity:1,offset:.2},{opacity:.7,offset:.65},{opacity:0}],{duration:750,delay:chain*65});}}
     const p=shape('polyline',{points,fill:'none',stroke:item.colors[chain%3],'stroke-width':3,'stroke-linejoin':'round','stroke-linecap':'round'});p.style.filter='drop-shadow(0 0 5px #7b9dff)';animate(p,[{opacity:0},{opacity:1,offset:.18},{opacity:.85,offset:.6},{opacity:0}],{duration:950,delay:chain*65});
    }
   }else{
    const bursts=item.kind==='fireworks'?[[115,115],[280,105],[205,195]]:[[200,150]];
    bursts.forEach(([cx,cy],burst)=>{
     const ring=shape('circle',{cx,cy,r:10,fill:item.kind==='explosion'?'#ffbf54':'none',stroke:item.colors[0],'stroke-width':item.kind==='explosion'?4:1});ring.style.transformOrigin=`${cx}px ${cy}px`;animate(ring,[{transform:'scale(.1)',opacity:1},{transform:item.kind==='explosion'?'scale(12)':'scale(6)',opacity:0}],{duration:900,delay:burst*250,easing:'ease-out'});
     for(let i=0;i<32;i++){const a=i/32*Math.PI*2,d=45+Math.random()*(item.kind==='explosion'?120:45),dx=Math.cos(a)*d,dy=Math.sin(a)*d,color=item.colors[i%item.colors.length];const spark=shape('circle',{cx,cy,r:item.kind==='explosion'?3+Math.random()*5:1.5+Math.random(),fill:color});spark.style.filter=`drop-shadow(0 0 2px ${color})`;animate(spark,[{transform:'translate(0,0)',opacity:0},{opacity:1,offset:.12},{transform:`translate(${dx}px,${dy+20}px)`,opacity:0}],{duration:1100+Math.random()*300,delay:burst*250,easing:'cubic-bezier(.15,.65,.3,1)'});
      if(item.kind==='fireworks'){const trail=shape('line',{x1:cx,y1:cy,x2:cx+dx*.15,y2:cy+dy*.15,stroke:color,'stroke-width':1.2,'stroke-linecap':'round'});animate(trail,[{transform:'translate(0,0)',opacity:0},{opacity:.8,offset:.15},{transform:`translate(${dx*.85}px,${dy*.85}px)`,opacity:0}],{duration:1000,delay:burst*250});}
     }
     if(item.kind==='explosion')for(let i=0;i<9;i++){const a=i/9*Math.PI*2,p=shape('circle',{cx,cy,r:16,fill:'#8d7d88'});p.style.transformOrigin=`${cx}px ${cy}px`;animate(p,[{transform:'scale(.2)',opacity:0},{opacity:.3,offset:.2},{transform:`translate(${Math.cos(a)*85}px,${Math.sin(a)*65-25}px) scale(1.6)`,opacity:0}],{duration:1400,delay:200});}
    });
   }
  }
  timer=setTimeout(stop,reduced?450:2200);return stop;
 }
 function preview(id){const item=catalog.get(id),box=document.createElement('div');box.className='tile-effect-preview';box.dataset.effectPreview=item.id;box.setAttribute('aria-hidden','true');
  const colors=item.colors;let art='';
  if(item.kind==='confetti')for(let i=0;i<27;i++){const a=i*2.4,r=22+(i%5)*12;art+=`<rect x="${100+Math.cos(a)*r}" y="${64+Math.sin(a)*r*.65}" width="${4+i%3}" height="${8+i%5}" rx="1.4" fill="${colors[i%colors.length]}" transform="rotate(${i*31} ${100+Math.cos(a)*r} ${64+Math.sin(a)*r*.65})"/>`;}
  else if(item.kind==='lightning')art='<path d="m105 12-38 55h30l-9 44 48-63h-33l16-36M77 34l-19-9 9 22-29 8M131 70l23 4-11 15 30 8" fill="none" stroke="#9879eb" stroke-width="5" stroke-linejoin="round"/>';
  else if(item.kind==='explosion')art='<path d="m100 10 13 32 34-17-9 34 43 10-36 18 12 30-40-14-20 24-13-34-39 16 12-31-37-19 45-8-6-32 27 17Z" fill="#ff9e38"/><circle cx="103" cy="70" r="23" fill="#ffdd74"/>';
  else for(const [cx,cy,r]of [[69,57,36],[135,76,29]])for(let i=0;i<16;i++){const a=i*Math.PI/8;art+=`<path d="M${cx+Math.cos(a)*12} ${cy+Math.sin(a)*12}l${Math.cos(a)*(r-12)} ${Math.sin(a)*(r-12)}" stroke="${colors[i%colors.length]}" stroke-width="2.4" stroke-linecap="round"/>`;}
  box.innerHTML='<svg viewBox="0 0 200 140" class="tile-effect-art">'+art+'</svg><div class="tile-effect-demo"></div>';box.play=()=>launch(box.lastElementChild,item.id);return box;
 }
 function bindPreviews(root){for(const type of ['pointerover','focusin'])root.addEventListener(type,event=>{const card=event.target.closest('[data-shop-product],.shop-search-result,.shop-category,.tile-effect-choice');if(!card||card.contains(event.relatedTarget))return;for(let p of card.querySelectorAll('[data-effect-preview]')){if(!p.play){const fresh=preview(p.dataset.effectPreview);p.replaceWith(fresh);p=fresh;}p.play();}});}
 function picker(panel,unlock){let query='';const search=document.createElement('input');search.type='search';search.className='tile-effects-search';search.placeholder='Search tile effects';search.setAttribute('aria-label','Search tile effects');const content=document.createElement('div');content.className='tile-effects-groups';panel.append(search,content);
  const render=()=>{content.replaceChildren();for(const group of ['Confetti','Fireworks','Special Effects']){const entries=catalog.all.filter(e=>e.group===group&&e.name.toLowerCase().includes(query));if(!entries.length)continue;const section=document.createElement('section'),h=document.createElement('h3'),grid=document.createElement('div');h.textContent=group;grid.className='tile-effects-grid';section.append(h,grid);content.append(section);for(const item of entries){const b=document.createElement('button');b.type='button';b.className='tile-effect-choice';b.dataset.effect=item.id;b.setAttribute('aria-pressed',String(selected().id===item.id));const name=document.createElement('strong'),detail=document.createElement('small');name.textContent=item.name;const allowed=accessible(item);detail.textContent=selected().id===item.id?'Equipped':allowed?'Apply Effect':'50 coins · Shop';b.append(preview(item.id),name,detail);if(typeof markSubscriptionAccess==='function')markSubscriptionAccess(b,item.productId);b.onclick=()=>allowed?equip(item.id):unlock(item.productId);grid.append(b);}}if(!content.childElementCount)content.textContent='No tile effects found.';};
  search.oninput=()=>{query=search.value.trim().toLowerCase();render();};for(const event of ['teachertiles:accountchange','teachertiles:shopownershipchange','teachertiles:tileeffectchange'])window.addEventListener(event,render);bindPreviews(panel);render();return {render};
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden)for(const stop of [...running.values()])stop();});
 window.addEventListener('storage',e=>{if(e.key===key)window.dispatchEvent(new Event('teachertiles:tileeffectchange'));});
 window.TeacherTilesTileEffects=Object.freeze({...catalog,selected,equip,launch,cancel,preview,picker,bindPreviews});
})();
