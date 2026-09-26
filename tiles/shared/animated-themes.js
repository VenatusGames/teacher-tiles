(()=>{'use strict';
  const canvas=document.createElement('canvas');canvas.className='animated-board-backdrop';canvas.setAttribute('aria-hidden','true');canvas.hidden=true;document.body.prepend(canvas);
  const ctx=canvas.getContext('2d'),background=document.createElement('canvas'),bg=background.getContext('2d'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let theme='',width=1,height=1,frame=0,last=0,time=0;
  // Seeded positions keep resizing and theme changes calm rather than randomizing the scene.
  const random=i=>{const n=Math.sin(i*127.1+311.7)*43758.5453;return n-Math.floor(n)};
  const bubbles=Array.from({length:48},(_,i)=>({x:random(i+1),y:random(i+101),r:2+random(i+201)*7,speed:9+random(i+301)*20}));
  const drops=Array.from({length:220},(_,i)=>({x:random(i+401),y:random(i+601),r:1+random(i+801)*4.3,speed:12+random(i+1001)*70}));
  function gradient(context,y,stops){const g=context.createLinearGradient(0,0,0,y);stops.forEach(([at,color])=>g.addColorStop(at,color));return g}
  function paintBackground(){background.width=width;background.height=height;
    if(theme==='outer-space'){
      bg.fillStyle=gradient(bg,height,[[0,'#080e24'],[.55,'#141d38'],[1,'#17273e']]);bg.fillRect(0,0,width,height);
      const haze=bg.createRadialGradient(width*.7,height*.4,0,width*.7,height*.4,width*.6);haze.addColorStop(0,'#58406b35');haze.addColorStop(1,'#58406b00');bg.fillStyle=haze;bg.fillRect(0,0,width,height);

    }else if(theme==='frosted-window'){
      bg.fillStyle=gradient(bg,height,[[0,'#708b9f'],[.58,'#b3c6ce'],[1,'#e2e9e8']]);bg.fillRect(0,0,width,height);
      bg.filter='blur(5px)';for(let i=0;i<20;i++){const x=random(i+70)*width,h=height*(.1+random(i+45)*.28),y=height*.86;bg.fillStyle=i%2?'#5876824a':'#405d7138';bg.beginPath();bg.moveTo(x,y-h);bg.lineTo(x-h*.32,y);bg.lineTo(x+h*.32,y);bg.closePath();bg.fill()}bg.filter='none';
      const frost=bg.createRadialGradient(width*.5,height*.5,Math.min(width,height)*.25,width*.5,height*.5,Math.max(width,height)*.65);frost.addColorStop(0,'#f3fcff00');frost.addColorStop(.65,'#e5f5fb45');frost.addColorStop(1,'#f2fbffd9');bg.fillStyle=frost;bg.fillRect(0,0,width,height);
    }else if(theme==='underwater-ocean'){

      bg.fillStyle=gradient(bg,height,[[0,'#208caa'],[.28,'#126781'],[.7,'#094156'],[1,'#092f42']]);bg.fillRect(0,0,width,height);
      const glow=bg.createRadialGradient(width*.42,-height*.15,0,width*.42,0,width*.8);glow.addColorStop(0,'#baf1e86b');glow.addColorStop(1,'#2fc8d000');bg.fillStyle=glow;bg.fillRect(0,0,width,height);
      for(let layer=0;layer<3;layer++){bg.beginPath();bg.moveTo(0,height);for(let x=0;x<=width+30;x+=30)bg.lineTo(x,height*(.91+layer*.035)+Math.sin(x/180+layer)*18);bg.lineTo(width,height);bg.fillStyle=['#185260','#164553','#123745'][layer];bg.fill()}
      // Branching coral at the seabed, kept around the edges for readable boards.
      function branch(x,y,length,angle,depth,color){if(depth===0)return;const ex=x+Math.sin(angle)*length,ey=y-Math.cos(angle)*length;bg.strokeStyle=color;bg.lineWidth=depth*1.8;bg.lineCap='round';bg.beginPath();bg.moveTo(x,y);bg.quadraticCurveTo(x,ey,ex,ey);bg.stroke();branch(ex,ey,length*.66,angle-.48,depth-1,color);branch(ex,ey,length*.7,angle+.42,depth-1,color)}
      for(let i=0;i<8;i++)branch(width*(i<4?.035+i*.043:.83+(i-4)*.044),height*.98,Math.min(height*.1,78)*(0.6+random(i+90)*.5),-.3+random(i)*.6,4,['#a26c83','#557e98','#9d837f','#487e80'][i%4]);
    }else{
      bg.fillStyle=gradient(bg,height,[[0,'#202f40'],[.42,'#536674'],[.68,'#8a9697'],[1,'#263e48']]);bg.fillRect(0,0,width,height);
      bg.filter='blur(14px)';for(let i=0;i<35;i++){const x=random(i+40)*width,h=height*(.08+random(i+9)*.22);bg.fillStyle=i%2?'#2b434ab0':'#384d55a0';bg.fillRect(x,height*.67-h,width*.035+random(i)*45,h+height*.4)}
      for(let i=0;i<24;i++){const x=random(i+110)*width,y=height*(.58+random(i+10)*.3),r=3+random(i+140)*12;bg.fillStyle=i%3?'#c4d9d46b':'#e7c18d99';bg.beginPath();bg.arc(x,y,r,0,Math.PI*2);bg.fill()}bg.filter='none';
      const vignette=bg.createRadialGradient(width*.5,height*.4,0,width*.5,height*.4,Math.max(width,height)*.7);vignette.addColorStop(0,'#152b3500');vignette.addColorStop(1,'#091820a8');bg.fillStyle=vignette;bg.fillRect(0,0,width,height);
    }
  }
  function underwater(t){
    ctx.save();ctx.globalCompositeOperation='screen';for(let i=0;i<7;i++){const x=width*(.05+i*.15)+Math.sin(t*.12+i)*30;ctx.beginPath();ctx.moveTo(x,-10);ctx.lineTo(x+width*.17,height);ctx.lineTo(x+width*.04,height);ctx.lineTo(x+width*.025,-10);ctx.fillStyle=gradient(ctx,height,[[0,'#adefe51c'],[1,'#adefe500']]);ctx.fill()}ctx.restore();
    for(let i=0;i<24;i++){const base=width*(i<12?i*.019:.79+(i-12)*.019),h=Math.min(height*.32,260)*(.3+random(i+80)*.7),sway=Math.sin(t*.55+i*.9)*h*.13;ctx.strokeStyle=['#216c70','#358789','#398180','#27676f'][i%4];ctx.lineWidth=5+random(i+18)*9;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(base,height+8);ctx.bezierCurveTo(base-h*.14,height-h*.33,base+sway+h*.12,height-h*.67,base+sway,height-h);ctx.stroke();for(let j=1;j<4;j++){const y=height-h*j/4,x=base+sway*j/4,dir=j%2?1:-1;ctx.fillStyle=ctx.strokeStyle;ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+dir*33,y-24,x+dir*26+sway*.15,y-42);ctx.quadraticCurveTo(x+dir*3,y-29,x,y);ctx.fill()}}
    for(const b of bubbles){const y=height+14-((b.y*height+t*b.speed)%(height+30)),x=b.x*width+Math.sin(t*.55+b.x*20)*13;ctx.strokeStyle='#cbf6f04a';ctx.lineWidth=1;ctx.beginPath();ctx.arc(x,y,b.r,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#e0fff48a';ctx.beginPath();ctx.arc(x-1,y-1,b.r*.65,3.5,4.8);ctx.stroke()}
    for(let i=0;i<42;i++){ctx.fillStyle='#c0e5df22';ctx.beginPath();ctx.arc((random(i+180)*width+t*2) % width,random(i+240)*height,1,0,Math.PI*2);ctx.fill()}
  }
  function rainy(t){
    // Distant rain behind the glass has a different speed and focus than the drops on it.
    ctx.lineWidth=.7;ctx.strokeStyle='#dbe9ed25';ctx.beginPath();for(let i=0;i<180;i++){const x=random(i+70)*width,y=(random(i+220)*height+t*(210+random(i)*140))%(height+70)-70;ctx.moveTo(x,y);ctx.lineTo(x-9,y+36)}ctx.stroke();
    for(let i=0;i<drops.length;i++){const d=drops[i],moving=i<65,y=moving?((d.y*height+t*d.speed)%(height+100))-50:d.y*height,x=d.x*width+(moving?Math.sin(y*.012+i)*3:0),r=d.r;
      if(moving){const trail=Math.min(100,18+r*13);ctx.strokeStyle='#cadce221';ctx.lineWidth=r*.75;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x+3,y-trail*.3,x-4,y-trail*.6,x+Math.sin(i)*4,y-trail);ctx.stroke();ctx.strokeStyle='#10263250';ctx.lineWidth=.8;ctx.stroke()}
      ctx.save();ctx.translate(x,y);ctx.scale(1,moving?1.65:1.2);const g=ctx.createRadialGradient(-r*.3,-r*.4,.1,0,0,r);g.addColorStop(0,'#e5f4f44d');g.addColorStop(.55,'#c3dce013');g.addColorStop(.85,'#0a233a73');g.addColorStop(1,'#d5e9ec73');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#e6f5f59c';ctx.lineWidth=.55;ctx.beginPath();ctx.arc(-.2,-.3,r*.7,3.8,5.1);ctx.stroke();ctx.restore();
    }
    // Soft condensation along the pane edges.
    const mist=ctx.createLinearGradient(0,0,width,0);mist.addColorStop(0,'#b3cbd413');mist.addColorStop(.2,'#b3cbd400');mist.addColorStop(.8,'#b3cbd400');mist.addColorStop(1,'#b3cbd41c');ctx.fillStyle=mist;ctx.fillRect(0,0,width,height);
  }
  function space(t){
      for(const [x,y,r,color] of [[.17,.24,12,'#899acb'],[.8,.35,20,'#bd907e'],[.63,.75,9,'#77aeb0'],[.35,.62,6,'#b3a1c5']]){const px=x*width+Math.sin(t*.22+x*9)*9,py=y*height+Math.cos(t*.28+y*8)*6;const g=ctx.createRadialGradient(px-r*.4,py-r*.4,0,px,py,r);g.addColorStop(0,color);g.addColorStop(.72,color);g.addColorStop(1,'#202b42');ctx.fillStyle=g;ctx.beginPath();ctx.arc(px,py,r,0,Math.PI*2);ctx.fill();if(r===20){ctx.strokeStyle='#cfb6a15e';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(px,py,r*1.7,r*.32,-.3,0,Math.PI*2);ctx.stroke()}}
    for(let i=0;i<150;i++){
      const x=random(i+10)*width,y=random(i+210)*height,pulse=(.5+.5*Math.sin(t*(1.1+random(i)*1.5)+i*2.4)),r=.55+random(i+410)*.8;
      ctx.globalAlpha=.12+.88*pulse;ctx.fillStyle='#edf3ff';ctx.beginPath();ctx.arc(x,y,r*(.65+pulse*.55),0,Math.PI*2);ctx.fill();
      if(i%9===0){ctx.strokeStyle='#dbeaff';ctx.lineWidth=.7;const ray=1.2+pulse*3;ctx.beginPath();ctx.moveTo(x-ray,y);ctx.lineTo(x+ray,y);ctx.moveTo(x,y-ray);ctx.lineTo(x,y+ray);ctx.stroke()}
    }
    ctx.globalAlpha=1;
    // First meteor appears after four seconds, then occasionally in different places.
    const cycle=Math.floor((t+29)/33),phase=(t+29)%33;
    if(phase<1.8){const progress=phase/1.8,x=width*(.2+random(cycle+710)*.45)+progress*width*.24,y=height*(.12+random(cycle+810)*.2)+progress*height*.2,tail=ctx.createLinearGradient(x-145,y-65,x,y);tail.addColorStop(0,'#e9f4ff00');tail.addColorStop(1,'#ffffff');ctx.strokeStyle=tail;ctx.lineWidth=2;ctx.globalAlpha=Math.sin(progress*Math.PI);ctx.beginPath();ctx.moveTo(x-145,y-65);ctx.lineTo(x,y);ctx.stroke();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x,y,2,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1}
  }
  function snow(t){for(let i=0;i<85;i++){const depth=random(i+801),x=(random(i+401)*width+Math.sin(t*.25+i)*22+width)%width,y=(random(i+601)*height+t*(8+depth*22))%(height+20)-10,r=1.4+depth*2.6;ctx.strokeStyle='#ffffffc4';ctx.fillStyle='#ffffffb8';ctx.lineWidth=.8;if(r>2.3){ctx.beginPath();for(let k=0;k<3;k++){const a=k*Math.PI/3;ctx.moveTo(x-Math.cos(a)*r*1.6,y-Math.sin(a)*r*1.6);ctx.lineTo(x+Math.cos(a)*r*1.6,y+Math.sin(a)*r*1.6)}ctx.stroke()}else{ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}}}
  function draw(){ctx.clearRect(0,0,width,height);ctx.drawImage(background,0,0);if(theme==='underwater-ocean')underwater(time);else if(theme==='outer-space')space(time);else if(theme==='frosted-window')snow(time);else rainy(time)}
  function tick(now){frame=0;if(!theme||document.hidden||reduced.matches)return;if(now-last>=32){time+=Math.min((now-last)/1000,.06);last=now;draw()}frame=requestAnimationFrame(tick)}
  function resize(){width=Math.max(1,innerWidth);height=Math.max(1,innerHeight);const dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=width*dpr;canvas.height=height*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);if(theme){paintBackground();draw()}}
  function sync(){cancelAnimationFrame(frame);frame=0;const selected=document.body.dataset.theme,base=selected?.replace(/-light$/,'');const next=['underwater-ocean','rainy-window','outer-space','frosted-window'].includes(base)?base:'';if(next!==theme){theme=next;time=0}canvas.hidden=!theme;if(!theme)return;resize();last=performance.now();if(!document.hidden&&!reduced.matches)frame=requestAnimationFrame(tick)}
  window.addEventListener('teachertiles:themechange',sync);window.addEventListener('resize',resize);document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);sync();
})();
