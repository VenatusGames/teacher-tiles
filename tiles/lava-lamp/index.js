(() => {
  'use strict';
  const palette=window.TeacherTilesTimerColors;
  const aliases={violet:'purple',sunset:'amber',ocean:'teal',lime:'green',gold:'amber'};
  const normalizeColor=key=>Object.hasOwn(palette,key)?key:(aliases[key]||'purple');
  const colors=Object.fromEntries(Object.entries(palette).map(([key,hex])=>[key,{label:key[0].toUpperCase()+key.slice(1),wax:[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)),liquid:key==='midnight'?'#a2afc4':'#211e38'}]));
  const neonPalette=window.TeacherTilesNeonColors;
  const neonLabels=window.TeacherTilesNeonColorLabels;
  const neonColors=Object.fromEntries(Object.entries(neonPalette).map(([key,hex])=>[key,{label:neonLabels[key],wax:[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)),liquid:'#161027'}]));
  function createRenderer(canvas,neon=false){
    const ctx=canvas.getContext('2d'),buffer=document.createElement('canvas');buffer.width=152;buffer.height=280;
    const wax=buffer.getContext('2d'),pixels=wax.createImageData(152,280);
    const dpr=Math.min(devicePixelRatio||1,2);canvas.width=360*dpr;canvas.height=540*dpr;ctx.scale(dpr,dpr);
    const vessel=new Path2D('M139 68Q135 116 117 198L81 387Q76 413 97 427Q180 449 263 427Q284 413 279 387L243 198Q225 116 221 68Z');
    function gradient(x,y,x2,y2,stops){const g=ctx.createLinearGradient(x,y,x2,y2);stops.forEach(([at,color])=>g.addColorStop(at,color));return g}
    function draw(time=0,key='purple'){
      const options=neon?neonColors:colors,color=options[key]||options.purple;
      ctx.clearRect(0,0,360,540);
      const shadow=ctx.createRadialGradient(180,498,5,180,498,122);shadow.addColorStop(0,'#28334828');shadow.addColorStop(1,'#28334800');ctx.fillStyle=shadow;ctx.save();ctx.translate(0,379);ctx.scale(1,.24);ctx.fillRect(50,0,260,540);ctx.restore();
      if(neon){ctx.save();ctx.shadowColor=`rgba(${color.wax.join(',')},.45)`;ctx.shadowBlur=24;ctx.fillStyle='#171327';ctx.fill(vessel);ctx.restore();}
      ctx.save();ctx.clip(vessel);
      ctx.fillStyle=gradient(80,80,280,440,[[0,color.liquid],[.5,'#121428'],[1,color.liquid]]);ctx.fillRect(70,60,220,390);
      const glow=ctx.createRadialGradient(180,420,5,180,340,220);glow.addColorStop(0,`rgba(${color.wax.join(',')},.65)`);glow.addColorStop(.45,`rgba(${color.wax.join(',')},.12)`);glow.addColorStop(1,'transparent');ctx.fillStyle=glow;ctx.fillRect(70,60,220,390);
      const blobs=Array.from({length:7},(_,i)=>{
        const phase=time*(.115+i*.007)+i*1.73;
        return {x:76+Math.sin(phase*.78+i*.7)*(19+i%3*7),y:144+Math.cos(phase)*(89+i%2*15),rx:16+i%3*4+Math.sin(phase*1.4)*3,ry:24+i%3*5+Math.cos(phase*.9)*6};
      });
      blobs.push({x:76+Math.sin(time*.15)*13,y:293,rx:82,ry:24},{x:76,y:-12,rx:28,ry:11});
      // A shared density field lets rising wax merge, stretch, and separate.
      const data=pixels.data;
      for(let y=0;y<280;y++)for(let x=0;x<152;x++){
        let field=0,nx=0,ny=0;
        for(const b of blobs){const dx=(x-b.x)/b.rx,dy=(y-b.y)/b.ry,d=dx*dx+dy*dy+.08,inv=1/d;field+=inv;nx+=dx*inv*inv/b.rx;ny+=dy*inv*inv/b.ry;}
        const alpha=Math.max(0,Math.min(1,(field-1.65)*7)),offset=(y*152+x)*4;
        if(alpha===0){data[offset+3]=0;continue;}
        const length=Math.hypot(nx,ny)||1,edge=Math.min(1,Math.max(0,(2.9-field)/1.3));
        const light=(neon?1.02:.78)+(-nx/length*.12-ny/length*.16)*edge+(y/280)*.14;
        const highlight=Math.max(0,(-nx-ny*.6)/length)*edge*36;
        data[offset]=Math.min(255,color.wax[0]*light+highlight);data[offset+1]=Math.min(255,color.wax[1]*light+highlight);data[offset+2]=Math.min(255,color.wax[2]*light+highlight);data[offset+3]=alpha*255;
      }
      wax.putImageData(pixels,0,0);ctx.imageSmoothingEnabled=true;
      if(neon){ctx.save();ctx.globalAlpha=.7;ctx.filter='blur(11px)';ctx.drawImage(buffer,78,72,204,365);ctx.restore();}
      ctx.drawImage(buffer,78,72,204,365);
      const glass=gradient(78,0,282,0,[[0,'#ffffff55'],[.05,'#ffffff12'],[.21,'#ffffff03'],[.67,'#ffffff00'],[.92,'#00000039'],[1,'#ffffff65']]);ctx.fillStyle=glass;ctx.fillRect(70,60,220,390);
      ctx.strokeStyle='#ffffff38';ctx.lineWidth=4;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(141,92);ctx.bezierCurveTo(132,169,105,283,98,354);ctx.stroke();ctx.strokeStyle='#ffffff18';ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(150,95);ctx.bezierCurveTo(139,169,113,287,108,343);ctx.stroke();
      ctx.restore();ctx.strokeStyle='#a2bbd55c';ctx.lineWidth=1.3;ctx.stroke(vessel);
      const metal=gradient(87,0,275,0,[[0,'#555e6c'],[.13,'#aeb9c7'],[.31,'#eef3f8'],[.48,'#a7b2c1'],[.69,'#6e798b'],[.85,'#c7d0dc'],[1,'#596576']]);
      ctx.fillStyle=metal;ctx.beginPath();ctx.moveTo(134,68);ctx.lineTo(144,34);ctx.quadraticCurveTo(180,23,216,34);ctx.lineTo(226,68);ctx.quadraticCurveTo(180,78,134,68);ctx.fill();
      ctx.strokeStyle='#eef5ff88';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(136,67);ctx.quadraticCurveTo(180,76,224,67);ctx.stroke();
      ctx.fillStyle=metal;ctx.beginPath();ctx.moveTo(91,421);ctx.quadraticCurveTo(180,444,269,421);ctx.lineTo(233,468);ctx.lineTo(263,502);ctx.quadraticCurveTo(180,522,97,502);ctx.lineTo(127,468);ctx.closePath();ctx.fill();
      ctx.fillStyle=gradient(0,434,0,509,[[0,'#00000000'],[.5,'#17203644'],[1,'#ffffff00']]);ctx.fill();ctx.strokeStyle='#eef5ff55';ctx.beginPath();ctx.moveTo(98,501);ctx.quadraticCurveTo(180,518,262,501);ctx.stroke();
    }
    return {draw};
  }
  function render(m,state={}){const key=normalizeColor(state.color);m.dataset.lavaColor=key;createRenderer(m.querySelector('canvas'),m.dataset.tileSkin==='lavalamp-neon').draw(12,key);}
  function setup(m){
    const neon=m.dataset.tileSkin==='lavalamp-neon',activePalette=neon?neonPalette:palette,activeColors=neon?neonColors:colors;
    const renderer=createRenderer(m.querySelector('canvas'),neon),toggle=m.querySelector('.lava-colors-toggle'),drawer=m.querySelector('.lava-color-drawer');
    let color='purple',raf=0,visible=true,disposed=false,elapsed=12,last=0,painted=0;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    function choose(key){color=normalizeColor(key);m.dataset.lavaColor=color;toggle.querySelector('.timer-color-swatch').style.background=activePalette[color];drawer.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.color===color)));renderer.draw(elapsed,color)}
    let drawerFrame=0;
    drawer.className='timer-shape-shelf lava-color-drawer';drawer.setAttribute('popover','manual');
    function close(){cancelAnimationFrame(drawerFrame);if(drawer.matches(':popover-open'))drawer.hidePopover();drawer.hidden=true;toggle.setAttribute('aria-expanded','false')}
    function position(){if(!m.isConnected){close();return}const rect=toggle.getBoundingClientRect();drawer.style.left=Math.max(8,Math.min(rect.left+rect.width/2-drawer.offsetWidth/2,innerWidth-drawer.offsetWidth-8))+'px';drawer.style.top=Math.max(8,rect.top-drawer.offsetHeight-8)+'px';drawerFrame=requestAnimationFrame(position)}
    for(const [key,option] of Object.entries(activeColors)){
      const b=document.createElement('button');b.type='button';b.dataset.color=key;b.title=option.label;b.setAttribute('aria-label',option.label);b.innerHTML='<i></i><span></span>';b.querySelector('i').className='timer-shelf-swatch';b.querySelector('i').style.background=activePalette[key];b.querySelector('span').textContent=option.label;
      b.addEventListener('click',()=>{choose(key);close();notifyBoardChanged('lava-color')});drawer.append(b);
    }
    toggle.addEventListener('click',()=>{if(!drawer.hidden){close();return}drawer.hidden=false;drawer.showPopover();toggle.setAttribute('aria-expanded','true');position()});
    const outside=e=>{if(!drawer.contains(e.target)&&!toggle.contains(e.target))close()};const escape=e=>{if(e.key==='Escape'&&!drawer.hidden){e.stopPropagation();close();toggle.focus({preventScroll:true})}};
    document.addEventListener('pointerdown',outside);m.addEventListener('keydown',escape);drawer.addEventListener('pointerdown',e=>e.stopPropagation());
    function frame(now){raf=0;if(disposed||!visible||document.hidden||reduced.matches)return;if(now-painted>=32){elapsed+=last?Math.min((now-last)/1000,.1):0;last=now;painted=now;renderer.draw(elapsed,color)}raf=requestAnimationFrame(frame)}
    function resume(){cancelAnimationFrame(raf);raf=0;last=0;if(!disposed&&visible&&!document.hidden&&!reduced.matches)raf=requestAnimationFrame(frame);else renderer.draw(elapsed,color)}
    const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;resume()});observer.observe(m);
    document.addEventListener('visibilitychange',resume);reduced.addEventListener('change',resume);
    m._boardGetState=()=>({color});m._boardSetState=s=>choose(s?.color);
    const cleanup=m._cleanup;m._cleanup=()=>{close();disposed=true;cancelAnimationFrame(raf);observer.disconnect();document.removeEventListener('visibilitychange',resume);document.removeEventListener('pointerdown',outside);reduced.removeEventListener('change',resume);cleanup?.()};
    const deactivate=m._deactivate;m._deactivate=()=>{close();deactivate?.()};
    choose(m.dataset.lavaColor||'purple');resume();
  }
  window.TeacherTilesLavaLamp={setup,render};
})();
