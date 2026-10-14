function setupCollections(m){
  const importView=m.querySelector('.collection-import'),dashboard=m.querySelector('.collection-dashboard'),className=m.querySelector('.collection-class-name'),classLogo=m.querySelector('.collection-class-logo'),changeClass=m.querySelector('.collection-change-class');
  const canvas=m.querySelector('.collection-canvas'),ctx=canvas.getContext('2d'),fillHandle=m.querySelector('.collection-fill-line-handle'),add=m.querySelector('.collection-add'),typeBtn=m.querySelector('.collection-type'),typeLabel=m.querySelector('.collection-type-label'),picker=m.querySelector('.collection-picker'),pickerButtons=[...m.querySelectorAll('[data-collection-type]')],countEl=m.querySelector('.collection-count'),bgBtn=m.querySelector('.collection-bg');
  const filledBanner=m.querySelector('.collection-filled-banner'),restart=m.querySelector('.collection-restart'),bannerRestart=m.querySelector('.collection-banner-restart'),settingsToggle=m.querySelector('.collection-settings-toggle'),settings=m.querySelector('.collection-settings'),jarsFilledEl=m.querySelector('.collection-jars-filled'),emptyCurrent=m.querySelector('.collection-empty-current'),addFill=m.querySelector('.collection-add-fill'),removeFill=m.querySelector('.collection-remove-fill'),resetFills=m.querySelector('.collection-reset-fills');
  const headerActions=document.createElement('div');headerActions.className='pbis-header-actions';changeClass.before(headerActions);
  const fillCounter=document.createElement('span');fillCounter.className='collection-win-count';fillCounter.innerHTML='<span aria-hidden="true">🏆</span><strong><b>0</b> fills</strong>';headerActions.append(fillCounter,changeClass);
  const types=[
    {id:'pompom',label:'Pom Poms'},{id:'candy',label:'Candies'},{id:'star',label:'Stars'},
    {id:'jellybean',label:'Jellybeans'},{id:'fruit',label:'Fruits'},{id:'coin',label:'Coins'}
  ];
  const colors=['#ef7e91','#70bce9','#f1c858','#72c58a','#9a82d8','#ef9b61'];
  const jarBehind=new Image();
  jarBehind.src='assets/jar-behind.png';
  let typeIndex=0,bodies=[],particles=[],raf=0,last=performance.now(),cw=260,ch=320,dpr=1,dead=false,currentJar=null;
  let activeClassId='',pendingClassId='',roster=null,progress=normalizeCollectionProgress(null),writing=false,fillArmedAt=0,fillReachedAt=0,draggingFillLine=false;

  const jarRectFor=(w,h)=>{const size=Math.max(140,Math.min(w*.96,h*.98));return{x:(w-size)/2,y:(h-size)/2,w:size,h:size}};
  const jarBounds=()=>{const j=currentJar||jarRectFor(cw,ch);return{floor:j.y+j.h*.895,top:j.y+j.h*.105,neckL:j.x+j.w*.285,neckR:j.x+j.w*.715,bodyL:j.x+j.w*.215,bodyR:j.x+j.w*.785,shoulderTop:j.y+j.h*.205,shoulderBottom:j.y+j.h*.31,bottomCurve:j.y+j.h*.765,bottomL:j.x+j.w*.265,bottomR:j.x+j.w*.735,j}};
  const fillLineY=()=>{const j=jarBounds().j;return j.y+j.h*progress.fillLine};
  const wallsAt=y=>{const b=jarBounds();if(y<b.shoulderTop)return[b.neckL,b.neckR];if(y<b.shoulderBottom){const t=clamp((y-b.shoulderTop)/(b.shoulderBottom-b.shoulderTop),0,1),ease=t*t*(3-2*t);return[b.neckL+(b.bodyL-b.neckL)*ease,b.neckR+(b.bodyR-b.neckR)*ease]}if(y>b.bottomCurve){const t=clamp((y-b.bottomCurve)/(b.floor-b.bottomCurve),0,1),ease=t*t*(3-2*t);return[b.bodyL+(b.bottomL-b.bodyL)*ease,b.bodyR+(b.bottomR-b.bodyR)*ease]}return[b.bodyL,b.bodyR]};
  const positionFillHandle=()=>{if(!fillHandle)return;const line=fillLineY(),[,lineR]=wallsAt(line);fillHandle.style.left=`${lineR+8}px`;fillHandle.style.top=`${line}px`};

  function resizeCanvas(){
    const nw=Math.max(220,canvas.clientWidth),nh=Math.max(210,canvas.clientHeight),old=currentJar||jarRectFor(cw,ch),next=jarRectFor(nw,nh),scale=next.w/old.w;
    if(bodies.length)for(const b of bodies){b.x=next.x+(b.x-old.x)*scale;b.y=next.y+(b.y-old.y)*scale;b.r*=scale}
    if(particles.length)for(const p of particles){p.x=next.x+(p.x-old.x)*scale;p.y=next.y+(p.y-old.y)*scale;p.r*=scale}
    cw=nw;ch=nh;currentJar=next;dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.round(cw*dpr);canvas.height=Math.round(ch*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);positionFillHandle();draw()
  }
  const ro=new ResizeObserver(resizeCanvas);ro.observe(canvas);resizeCanvas();

  function burst(body,n=7){
    for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=18+Math.random()*48;particles.push({type:body.type,variant:body.variant,color:body.color,x:body.x+(Math.random()-.5)*body.r*.5,y:body.y+body.r*.4,vx:Math.cos(a)*s,vy:Math.sin(a)*s-18,life:.38+Math.random()*.28,max:.66,r:Math.max(1.4,body.r*(.11+Math.random()*.08)),rot:Math.random()*Math.PI*2,av:(Math.random()-.5)*4})}
  }

  function addItem({persist=true,detect=true}={}){
    if(bodies.length>=80||progress.filled||!activeClassId)return;
    const t=types[typeIndex],b=jarBounds(),r=Math.max(9,Math.min(16,b.j.w*.036))*(.88+Math.random()*.22);
    bodies.push({type:t.id,x:(b.neckL+b.neckR)/2+(Math.random()-.5)*(b.neckR-b.neckL)*.28,y:b.top-r-22,vx:(Math.random()-.5)*20,vy:18+Math.random()*12,r,rot:(Math.random()-.5)*.4,av:(Math.random()-.5)*1.25,color:colors[bodies.length%colors.length],variant:Math.floor(Math.random()*4),impact:false,onFloor:false,bornAt:detect?performance.now():performance.now()-1200});
    if(detect)fillArmedAt=performance.now()+300;
    updateCount();
    if(persist)persistProgress();
  }
  function updateCount(){
    countEl.textContent=`${bodies.length} item${bodies.length===1?'':'s'}`;
    jarsFilledEl.textContent=String(normalizeStarChartCount(progress.jarsFilled));fillCounter.querySelector('b').textContent=jarsFilledEl.textContent;
    emptyCurrent.disabled=bodies.length<=0&&!progress.filled;
    removeFill.disabled=progress.jarsFilled<=0;
    resetFills.disabled=progress.jarsFilled<=0;
  }

  function physics(dt){
    const floor=jarBounds().floor;
    for(const b of bodies){
      b.vy+=650*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;b.rot+=b.av*dt;
      b.vx*=Math.pow(.985,dt*60);b.av*=Math.pow(.94,dt*60);b.av=clamp(b.av,-2.25,2.25);b.onFloor=false;
      const [wl,wr]=wallsAt(b.y),edgeR=b.r*(b.type==='candy'?1.13:1.07);
      if(b.x-edgeR<wl){b.x=wl+edgeR;b.vx=Math.abs(b.vx)*.38;b.av=clamp(b.av+.18,-1.6,1.6)}
      if(b.x+edgeR>wr){b.x=wr-edgeR;b.vx=-Math.abs(b.vx)*.38;b.av=clamp(b.av-.18,-1.6,1.6)}
      if(b.y+b.r>floor){
        const impact=Math.abs(b.vy);b.y=floor-b.r;b.vy=-Math.abs(b.vy)*.14;b.vx*=.72;b.av*=.35;b.onFloor=true;
        if(impact>105&&!b.impact){burst(b,5);b.impact=true}
        if(Math.abs(b.vy)<18)b.vy=0;if(Math.abs(b.vx)<2.2)b.vx=0;if(Math.abs(b.av)<.12)b.av=0;
      }else b.impact=false;
    }
    for(let pass=0;pass<3;pass++)for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
      const a=bodies[i],b=bodies[j],dx=b.x-a.x,dy=b.y-a.y,rr=a.r+b.r,d2=dx*dx+dy*dy;if(d2<=0||d2>=rr*rr)continue;
      const d=Math.sqrt(d2),nx=dx/d,ny=dy/d,over=rr-d;a.x-=nx*over*.5;a.y-=ny*over*.5;b.x+=nx*over*.5;b.y+=ny*over*.5;
      const rvx=b.vx-a.vx,rvy=b.vy-a.vy,rel=rvx*nx+rvy*ny;if(rel<0){const imp=-(1.08)*rel*.46;a.vx-=imp*nx;a.vy-=imp*ny;b.vx+=imp*nx;b.vy+=imp*ny;const spin=clamp(rel*.0007,-.13,.13);a.av=clamp(a.av-spin,-1.5,1.5);b.av=clamp(b.av+spin,-1.5,1.5)}
    }
    for(const b of bodies){
      const [wl,wr]=wallsAt(b.y),edgeR=b.r*(b.type==='candy'?1.13:1.07);
      if(b.x-edgeR<wl){b.x=wl+edgeR;b.vx=Math.max(0,b.vx)*.3}
      if(b.x+edgeR>wr){b.x=wr-edgeR;b.vx=Math.min(0,b.vx)*.3}
      if(b.y+b.r>floor){b.y=floor-b.r;b.vy=Math.min(0,b.vy)*.15}
      if(b.y+b.r>=floor-.8){b.vx*=Math.pow(.88,dt*60);b.av*=Math.pow(.72,dt*60);if(Math.abs(b.vx)<1.5)b.vx=0;if(Math.abs(b.av)<.09)b.av=0}
      const supported=b.y+b.r>=floor-2||bodies.some(other=>other!==b&&other.y>b.y+b.r*.25&&Math.hypot(other.x-b.x,other.y-b.y)<=other.r+b.r+2);
      if(supported){b.av=0;}
      if(Math.hypot(b.vx,b.vy)<2.2&&Math.abs(b.av)<.1){b.vx=0;if(Math.abs(b.vy)<2)b.vy=0;b.av=0}
    }
    for(const p of particles){p.vy+=180*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.av*dt;p.life-=dt}
    particles=particles.filter(p=>p.life>0);
    checkJarFilled();
  }

  function checkJarFilled(){
    const now=performance.now();
    if(progress.filled||!activeClassId||now<fillArmedAt){fillReachedAt=0;return}
    const line=fillLineY(),bounds=jarBounds(),tolerance=Math.max(3,bounds.j.h*.012);
    const pileTop=bodies.reduce((top,body)=>{
      const age=now-(Number(body.bornAt)||0);
      const settledEnough=age>=450&&Math.abs(body.vy)<180&&Math.abs(body.vx)<100;
      const insideJar=body.y>=bounds.shoulderTop&&body.y<=bounds.floor;
      return settledEnough&&insideJar?Math.min(top,body.y-body.r):top;
    },Infinity);
    const reached=Number.isFinite(pileTop)&&pileTop<=line+tolerance;
    if(!reached){
      if(fillReachedAt&&now-fillReachedAt<140)return;
      fillReachedAt=0;
      return;
    }
    if(!fillReachedAt){fillReachedAt=now;return}
    if(now-fillReachedAt<180)return;
    fillReachedAt=0;
    progress.filled=true;
    progress.jarsFilled=normalizeStarChartCount(progress.jarsFilled+1);
    persistProgress();
    renderFilledState();
    launchConfetti(m);
    playUiSfx('confetti',1,m);
  }

  function starPath(r,target=ctx){target.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rad=i%2?r*.46:r,px=Math.cos(a)*rad,py=Math.sin(a)*rad;i?target.lineTo(px,py):target.moveTo(px,py)}target.closePath()}
  function drawPompom(b,ctx){
    const r=b.r;ctx.save();ctx.shadowColor='rgba(0,0,0,.13)';ctx.shadowBlur=r*.22;ctx.fillStyle=b.color;ctx.beginPath();ctx.arc(0,0,r*.7,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    for(let i=0;i<34;i++){const a=i*Math.PI*2/34+(b.variant*.17),dist=r*(.58+((i*17)%7)/34),fr=r*(.15+((i*13)%5)/42);ctx.globalAlpha=.78+.18*((i%3)/2);ctx.fillStyle=b.color;ctx.beginPath();ctx.arc(Math.cos(a)*dist,Math.sin(a)*dist,fr,0,Math.PI*2);ctx.fill()}
    ctx.globalAlpha=.35;ctx.strokeStyle='#ffffffaa';ctx.lineWidth=.65;for(let i=0;i<70;i++){const a=i*2.39996,d=Math.sqrt(i/70)*r*.92;ctx.beginPath();ctx.moveTo(Math.cos(a)*d,Math.sin(a)*d);ctx.lineTo(Math.cos(a)*(d+r*.12),Math.sin(a)*(d+r*.12));ctx.stroke()}ctx.globalAlpha=.28;ctx.fillStyle='#fff';for(let i=0;i<8;i++){const a=(i+.3)*Math.PI*2/8;ctx.beginPath();ctx.arc(Math.cos(a)*r*.42-r*.08,Math.sin(a)*r*.42-r*.1,r*.085,0,Math.PI*2);ctx.fill()}ctx.restore()
  }
  function drawBody(b,target=ctx){
    target.save();target.translate(b.x,b.y);target.rotate(b.rot);const r=b.r;
    if(b.type==='pompom')drawPompom(b,target);
    else if(b.type==='candy'){
      const candyGlow=target.createLinearGradient(0,-r*.6,0,r*.6);candyGlow.addColorStop(0,'#fff1f2');candyGlow.addColorStop(.3,b.color);candyGlow.addColorStop(1,'#a7466888');target.fillStyle=candyGlow;target.beginPath();target.roundRect(-r*.64,-r*.48,r*1.28,r*.96,r*.25);target.fill();target.beginPath();target.moveTo(-r*.62,-r*.32);target.lineTo(-r*1.05,-r*.62);target.lineTo(-r*.98,0);target.lineTo(-r*1.05,r*.62);target.lineTo(-r*.62,r*.32);target.closePath();target.fill();target.beginPath();target.moveTo(r*.62,-r*.32);target.lineTo(r*1.05,-r*.62);target.lineTo(r*.98,0);target.lineTo(r*1.05,r*.62);target.lineTo(r*.62,r*.32);target.closePath();target.fill();target.strokeStyle='rgba(255,255,255,.5)';target.lineWidth=1.5;target.beginPath();target.moveTo(-r*.3,-r*.35);target.lineTo(r*.35,r*.28);target.stroke()
    }else if(b.type==='star'){
      target.fillStyle='#f0bd47';target.strokeStyle='#d39a25';target.lineWidth=1.2;starPath(r,target);target.fill();target.stroke();target.fillStyle='rgba(255,255,255,.32)';target.beginPath();target.arc(-r*.18,-r*.2,r*.16,0,Math.PI*2);target.fill()
    }else if(b.type==='jellybean'){
      target.scale(1.08,.86);const bean=target.createRadialGradient(-r*.3,-r*.4,0,0,0,r);bean.addColorStop(0,'#ffeef6');bean.addColorStop(.35,['#ae8ee5','#f28fab','#87d99a','#ffd678'][b.variant%4]);bean.addColorStop(1,['#6652aa','#b54670','#3b9156','#cb8532'][b.variant%4]);target.fillStyle=bean;target.beginPath();target.moveTo(-r*.75,-r*.1);target.bezierCurveTo(-r*.92,-r*.72,-r*.18,-r*.92,r*.3,-r*.66);target.bezierCurveTo(r*.95,-r*.32,r*.87,r*.5,r*.28,r*.72);target.bezierCurveTo(-r*.28,r*.92,-r*.52,r*.44,-r*.75,-r*.1);target.fill();target.fillStyle='rgba(255,255,255,.3)';target.beginPath();target.ellipse(-r*.23,-r*.38,r*.25,r*.1,-.35,0,Math.PI*2);target.fill()
    }else if(b.type==='fruit'){
      const fc=['#ef6b62','#f09a47','#e9c64e','#8cc765'][b.variant%4];const fruit=target.createRadialGradient(-r*.25,-r*.3,0,0,0,r);fruit.addColorStop(0,'#ffedbb');fruit.addColorStop(.4,fc);fruit.addColorStop(1,['#b93f43','#c36c22','#b49528','#508f41'][b.variant%4]);target.fillStyle=fruit;target.beginPath();if(b.variant%4===2){target.ellipse(0,r*.08,r*.85,r*.59,-.25,0,Math.PI*2)}else{target.moveTo(0,-r*.55);target.bezierCurveTo(-r,-r*.95,-r,r*.75,-r*.2,r*.82);target.quadraticCurveTo(0,r*.65,r*.2,r*.82);target.bezierCurveTo(r,r*.75,r,-r*.95,0,-r*.55)}target.fill();target.fillStyle='#5e8f4f';target.beginPath();target.ellipse(r*.22,-r*.74,r*.34,r*.13,-.45,0,Math.PI*2);target.fill();target.strokeStyle='#75543b';target.lineWidth=1.7;target.beginPath();target.moveTo(0,-r*.55);target.lineTo(r*.08,-r*.92);target.stroke();target.fillStyle='rgba(255,255,255,.24)';target.beginPath();target.arc(-r*.27,-r*.18,r*.18,0,Math.PI*2);target.fill()
    }else{
      target.fillStyle='#e5b23e';target.strokeStyle='#b98220';target.lineWidth=1.6;target.beginPath();target.arc(0,0,r*.78,0,Math.PI*2);target.fill();target.stroke();target.strokeStyle='rgba(255,244,180,.7)';target.lineWidth=1.2;target.beginPath();target.arc(0,0,r*.56,0,Math.PI*2);target.stroke();target.fillStyle='#a9781d';target.font=`700 ${r*.7}px system-ui`;target.textAlign='center';target.textBaseline='middle';target.fillText('¢',0,0)
    }
    target.restore()
  }
  function drawParticle(p){
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.globalAlpha=Math.max(0,p.life/p.max);const r=p.r;
    if(p.type==='pompom'){ctx.fillStyle=p.color;for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ctx.beginPath();ctx.arc(Math.cos(a)*r*.4,Math.sin(a)*r*.4,r*.55,0,Math.PI*2);ctx.fill()}}
    else if(p.type==='candy'){ctx.fillStyle=p.color;ctx.fillRect(-r*.7,-r*.38,r*1.4,r*.76);ctx.beginPath();ctx.moveTo(-r*.7,0);ctx.lineTo(-r*1.25,-r*.55);ctx.lineTo(-r*1.25,r*.55);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(r*.7,0);ctx.lineTo(r*1.25,-r*.55);ctx.lineTo(r*1.25,r*.55);ctx.closePath();ctx.fill()}
    else if(p.type==='star'){ctx.fillStyle='#f0bd47';starPath(r*1.1);ctx.fill()}
    else if(p.type==='jellybean'){ctx.fillStyle=['#8f78d8','#e7728b','#65b97d','#efb74e'][p.variant%4];ctx.beginPath();ctx.ellipse(0,0,r*1.15,r*.72,.45,0,Math.PI*2);ctx.fill()}
    else if(p.type==='fruit'){ctx.fillStyle=['#ef6b62','#f09a47','#e9c64e','#8cc765'][p.variant%4];ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.fillStyle='#5e8f4f';ctx.beginPath();ctx.ellipse(r*.35,-r*.75,r*.55,r*.22,-.45,0,Math.PI*2);ctx.fill()}
    else{ctx.fillStyle='#e5b23e';ctx.strokeStyle='#b98220';ctx.lineWidth=.8;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.stroke()}
    ctx.restore()
  }
  function draw(){
    ctx.clearRect(0,0,cw,ch);const j=currentJar||jarRectFor(cw,ch);
    if(jarBehind.complete)ctx.drawImage(jarBehind,j.x,j.y,j.w,j.h);
    const line=fillLineY(),[lineL,lineR]=wallsAt(line);
    ctx.save();ctx.strokeStyle=progress.filled?'rgba(50,159,105,.9)':'rgba(77,145,223,.78)';ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=Math.max(1.5,j.w*.006);ctx.setLineDash([Math.max(5,j.w*.02),Math.max(4,j.w*.014)]);ctx.beginPath();ctx.moveTo(lineL+5,line);ctx.lineTo(lineR-5,line);ctx.stroke();ctx.setLineDash([]);ctx.font=`900 ${Math.max(7,j.w*.025)}px Inter,system-ui,sans-serif`;ctx.textAlign='right';ctx.textBaseline='bottom';ctx.fillText(progress.filled?'FILLED':'FILL LINE',lineR-5,line-5);ctx.restore();
    for(const b of bodies)drawBody(b);for(const p of particles)drawParticle(p);
    if(jarBehind.complete){ctx.save();ctx.beginPath();ctx.rect(j.x+j.w*.205,j.y+j.h*.092,j.w*.59,j.h*.078);ctx.clip();ctx.drawImage(jarBehind,j.x,j.y,j.w,j.h);ctx.restore()}
  }
  function loop(now){if(dead)return;const dt=Math.min(.025,(now-last)/1000||.016);last=now;physics(dt);draw();raf=requestAnimationFrame(loop)}
  function itemPreview(host,type){host.className='collectible-preview collection-art-preview'+(host.classList.contains('collection-current-preview')?' collection-current-preview':'');const icon=document.createElement('canvas');icon.width=96;icon.height=96;icon.setAttribute('aria-hidden','true');const paint=icon.getContext('2d');drawBody({type,x:48,y:48,r:34,rot:0,color:colors[0],variant:0},paint);host.replaceChildren(icon);}
  for(const button of pickerButtons)itemPreview(button.querySelector('.collectible-preview'),button.dataset.collectionType);
  function renderType(){const t=types[typeIndex];m.dataset.item=t.id;typeLabel.textContent=t.label;const preview=m.querySelector('.collection-current-preview');itemPreview(preview,t.id);pickerButtons.forEach(b=>b.classList.toggle('is-active',b.dataset.collectionType===t.id))}
  function closePicker(){picker.hidden=true;typeBtn.setAttribute('aria-expanded','false')}
  function togglePicker(){picker.hidden=!picker.hidden;typeBtn.setAttribute('aria-expanded',String(!picker.hidden))}

  const currentRoster=()=>readClassRosters().find(item=>item.id===activeClassId)||null;
  const setSettingsOpen=open=>{const show=Boolean(open);settings.hidden=!show;settingsToggle.setAttribute('aria-expanded',String(show))};
  const renderFilledState=()=>{
    const filled=Boolean(progress.filled);
    m.classList.toggle('is-collection-filled',filled);
    filledBanner.hidden=!filled;
    restart.hidden=!filled;
    add.hidden=filled;
    typeBtn.disabled=filled;
    fillHandle.disabled=filled;
    canvas.setAttribute('aria-disabled',String(filled));
    positionFillHandle();
    updateCount();
  };
  const render=()=>{
    const hasClass=Boolean(roster&&activeClassId);
    importView.hidden=hasClass;
    dashboard.hidden=!hasClass;
    if(!hasClass)return;
    className.textContent=roster.name;
    classLogo.textContent=normalizeClassLogo(roster.logo);
    renderType();renderFilledState();
  };
  const persistProgress=()=>{
    if(!activeClassId)return;
    progress.item=types[typeIndex]?.id||'pompom';
    progress.count=bodies.length;
    writing=true;
    const saved=writeClassCollection(activeClassId,progress);
    writing=false;
    if(saved)progress=saved;
    updateCount();
  };
  const rebuildBodies=count=>{
    bodies=[];particles=[];
    const filled=progress.filled;
    progress.filled=false;
    const safeCount=Math.max(0,Math.min(80,Math.round(Number(count)||0)));
    for(let i=0;i<safeCount;i++)addItem({persist:false,detect:false});
    progress.filled=filled;
    fillArmedAt=performance.now()+450;fillReachedAt=0;
    updateCount();
  };
  const applyRosterProgress=next=>{
    roster=next;
    progress=normalizeCollectionProgress(next.collectionJar);
    const nextIndex=types.findIndex(type=>type.id===progress.item);
    typeIndex=nextIndex>=0?nextIndex:0;
    rebuildBodies(progress.count);
    render();
  };
  const loadClass=(classId,{notify=false}={})=>{
    const next=readClassRosters().find(item=>item.id===classId);
    if(!next){activeClassId='';roster=null;progress=normalizeCollectionProgress(null);bodies=[];particles=[];render();return false}
    activeClassId=next.id;pendingClassId='';
    localStorage.setItem(collectionsLastClassStorageKey(),activeClassId);
    applyRosterProgress(next);
    if(notify)notifyBoardChanged('collection-class');
    return true;
  };

  const updateFillLineFromPointer=e=>{if(progress.filled)return;const r=canvas.getBoundingClientRect(),scale=boardCamera.scale||1,y=(e.clientY-r.top)/scale,j=jarBounds().j;progress.fillLine=clamp((y-j.y)/j.h,.24,.72);fillArmedAt=performance.now()+250;fillReachedAt=0;positionFillHandle()};
  fillHandle.addEventListener('pointerdown',e=>{if(progress.filled)return;e.preventDefault();e.stopPropagation();draggingFillLine=true;m.classList.add('is-moving-fill-line');try{fillHandle.setPointerCapture(e.pointerId)}catch{}updateFillLineFromPointer(e)});
  fillHandle.addEventListener('pointermove',e=>{if(!draggingFillLine)return;e.preventDefault();updateFillLineFromPointer(e)});
  const finishFillLineDrag=e=>{if(!draggingFillLine)return;draggingFillLine=false;m.classList.remove('is-moving-fill-line');try{if(e&&fillHandle.hasPointerCapture(e.pointerId))fillHandle.releasePointerCapture(e.pointerId)}catch{}persistProgress()};
  fillHandle.addEventListener('pointerup',finishFillLineDrag);fillHandle.addEventListener('pointercancel',finishFillLineDrag);fillHandle.addEventListener('lostpointercapture',()=>{if(draggingFillLine){draggingFillLine=false;m.classList.remove('is-moving-fill-line');persistProgress()}});
  canvas.addEventListener('pointerdown',e=>{if(progress.filled||draggingFillLine)return;const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/boardCamera.scale,y=(e.clientY-r.top)/boardCamera.scale,[l,rr]=wallsAt(y),b=jarBounds();if(x>=l&&x<=rr&&y>b.top&&y<b.floor+8)addItem()});
  add.addEventListener('click',()=>addItem());
  typeBtn.addEventListener('click',e=>{e.stopPropagation();togglePicker()});
  picker.addEventListener('click',e=>{const b=e.target.closest('[data-collection-type]');if(!b)return;const i=types.findIndex(t=>t.id===b.dataset.collectionType);if(i>=0){typeIndex=i;renderType();persistProgress();closePicker()}});
  document.addEventListener('pointerdown',e=>{if(!m.contains(e.target)||!e.target.closest('.collection-picker-wrap'))closePicker()});
  bgBtn.addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  const emptyJar=()=>{
    if(!activeClassId)return;
    bodies=[];particles=[];progress.count=0;progress.filled=false;fillArmedAt=performance.now()+450;fillReachedAt=0;persistProgress();renderFilledState();
  };
  m.querySelector('.collection-controls').insertBefore(emptyCurrent,m.querySelector('.collection-picker-wrap'));emptyCurrent.textContent='Reset';emptyCurrent.title='Empty current jar; keep completed jar rewards';
  restart.addEventListener('click',emptyJar);
  bannerRestart.addEventListener('click',emptyJar);
  emptyCurrent.addEventListener('click',()=>{emptyJar();setSettingsOpen(false)});
  settingsToggle.addEventListener('click',()=>setSettingsOpen(settings.hidden));
  m.addEventListener('pointerdown',event=>{if(!settings.hidden&&!event.target.closest('.collection-settings-wrap'))setSettingsOpen(false)});
  m.addEventListener('pointerleave',()=>{setSettingsOpen(false);closePicker()});
  addFill.addEventListener('click',()=>{progress.jarsFilled=normalizeStarChartCount(progress.jarsFilled+1);persistProgress();renderFilledState()});
  removeFill.addEventListener('click',()=>{if(progress.jarsFilled<=0)return;progress.jarsFilled=normalizeStarChartCount(progress.jarsFilled-1);persistProgress();renderFilledState()});
  resetFills.addEventListener('click',()=>{if(progress.jarsFilled<=0)return;progress.jarsFilled=0;persistProgress();renderFilledState();setSettingsOpen(false)});
  changeClass.addEventListener('click',()=>{activeClassId='';pendingClassId='';roster=null;progress=normalizeCollectionProgress(null);bodies=[];particles=[];localStorage.removeItem(collectionsLastClassStorageKey());setSettingsOpen(false);render();notifyBoardChanged('collection-class')});

  const detachRosterLoader=attachClassRosterLoader(m.querySelector('.collection-loader-anchor'),(_names,selectedRoster)=>loadClass(selectedRoster.id,{notify:true}));
  const handleClassesChange=()=>{
    if(!activeClassId){if(pendingClassId)loadClass(pendingClassId);return}
    const next=currentRoster();
    if(!next){activeClassId='';roster=null;progress=normalizeCollectionProgress(null);bodies=[];particles=[];localStorage.removeItem(collectionsLastClassStorageKey());render();return}
    applyRosterProgress(next);
  };
  const handleCollectionChange=event=>{
    if(writing||event.detail?.classId!==activeClassId)return;
    const next=currentRoster();if(next)applyRosterProgress(next);
  };
  window.addEventListener('teachertiles:classeschange',handleClassesChange);
  window.addEventListener('teachertiles:collectionchange',handleCollectionChange);

  renderType();updateCount();raf=requestAnimationFrame(loop);
  m._boardGetState=()=>({classId:activeClassId});
  m._boardSetState=state=>{
    const classId=String(state?.classId||'');
    if(classId&&!loadClass(classId))pendingClassId=classId;
  };
  const lastClassId=localStorage.getItem(collectionsLastClassStorageKey())||'';
  if(!lastClassId||!loadClass(lastClassId))render();
  m._cleanup=()=>{dead=true;draggingFillLine=false;cancelAnimationFrame(raf);ro.disconnect();detachRosterLoader();window.removeEventListener('teachertiles:classeschange',handleClassesChange);window.removeEventListener('teachertiles:collectionchange',handleCollectionChange)}
}
