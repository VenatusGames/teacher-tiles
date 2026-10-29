/* Original blurred city lights, with refracting glass beads and broken rain residue. */
(()=>{'use strict';
 const random=i=>{const n=Math.sin(i*127.1+72.9)*43758.5453;return n-Math.floor(n)};
 const beads=Array.from({length:680},(_,i)=>({u:random(i+1),v:random(i+911),r:.45+random(i+1751)**2*3.1,shape:.82+random(i+2031)*.38}));
 const runners=Array.from({length:38},(_,i)=>({u:random(i+221),phase:random(i+501),duration:24+random(i+821)*24,r:2.1+random(i+1221)*1.8}));
 const backgroundRandom=i=>{const n=Math.sin(i*127.1+311.7)*43758.5453;return n-Math.floor(n)};
 const backgroundCache=new Map();
 function prepare(){return Promise.resolve();}
 function point(u,v,w,h){return {x:u*w,y:v*h,size:1};}
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
 function bead(g,x,y,r,shape,w,h){
   if(r<.55){g.fillStyle='#dce8e72c';g.fillRect(x,y,.6,.8);return;}
   const ry=r*shape;
   g.save();g.translate(x,y);g.beginPath();
   g.moveTo(-r*.12,-ry);g.bezierCurveTo(-r*.82,-ry,-r*1.08,-ry*.2,-r*.9,ry*.36);
   g.bezierCurveTo(-r*.72,ry*1.08,r*.6,ry*1.13,r*.9,ry*.4);
   g.bezierCurveTo(r*1.1,-ry*.22,r*.66,-ry*1.02,-r*.12,-ry);g.closePath();
   g.save();g.clip();
   if(r>1){
     const scene=sceneFor(w,h),sample=r*6,sx=Math.max(0,Math.min(w-sample,x-sample/2)),sy=Math.max(0,Math.min(h-sample,y-sample/2));
     g.globalAlpha*=.72;g.scale(1,-1);g.drawImage(scene,sx,sy,sample,sample,-r,-ry,r*2,ry*2);
   }
   g.restore();g.lineWidth=Math.max(.35,r*.1);g.strokeStyle='#07111765';g.stroke();
   g.beginPath();g.ellipse(0,ry*.1,r*.72,ry*.72,0,.15,1.9);g.strokeStyle='#d8e5e567';g.stroke();
   g.fillStyle='#e9f2ee83';g.beginPath();g.ellipse(-r*.38,-ry*.44,Math.max(.3,r*.15),Math.max(.3,r*.1),-.5,0,Math.PI*2);g.fill();g.restore();
 }
 function paint(g,w,h){
   g.drawImage(sceneFor(w,h),0,0,w,h);
   const scale=Math.max(w/1600,h/1000);
   for(const d of beads){const p=point(d.u,d.v,w,h);bead(g,p.x,p.y,d.r*scale,d.shape,w,h);}
   const mist=g.createLinearGradient(0,0,w,0);mist.addColorStop(0,'#b3cbd413');mist.addColorStop(.2,'#b3cbd400');mist.addColorStop(.8,'#b3cbd400');mist.addColorStop(1,'#b3cbd41c');g.fillStyle=mist;g.fillRect(0,0,w,h);
 }
 function progress(phase){const s=phase*7,k=Math.floor(s),f=s-k;return (k+f*f*(3-2*f))/7;}
 function trailPoint(d,i,v,w,h){return point(d.u+Math.sin(v*32+i)*.0012+Math.sin(v*77+i*.7)*.0006,v,w,h);}
 function draw(g,w,h,_theme,t){
   const scale=Math.max(w/1600,h/1000);
   g.save();g.strokeStyle='#c0d1d117';g.lineWidth=Math.max(.35,.55*scale);g.beginPath();
   for(let i=0;i<110;i++){const x=random(i+3401)*w,y=(random(i+4501)*h+t*(170+random(i+5101)*90)*scale)%(h+40*scale)-40*scale;g.moveTo(x,y);g.lineTo(x-2*scale,y+(12+random(i+6001)*17)*scale);}g.stroke();
   for(let i=0;i<runners.length;i++){
     const d=runners[i],phase=(t/d.duration+d.phase)%1,p=progress(phase),v=p*1.12-.06;
     // Small stationary beads remain where the moving drop has passed, fading separately.
     // There is deliberately no continuous luminous tail attached to the drop.
     for(let j=0;j<27;j++){
       const site=(j+.25+random(i*31+j+7401)*.5)/27,age=((p-site+1)%1)*d.duration;
       if(age>11)continue;
       const spot=trailPoint(d,i,site*1.12-.06,w,h),r=(.35+random(i*31+j+8201)*.8)*scale*spot.size;
       g.globalAlpha=Math.min(1,(11-age)/4)*.7;
       bead(g,spot.x+(random(i*31+j+9101)-.5)*2*scale,spot.y,r,1.1,w,h);
       if(j%3===0){g.fillStyle='#c7dadb29';g.fillRect(spot.x-.3*scale,spot.y+2*scale,Math.max(.35,.5*scale),2.5*scale);}
     }
     g.globalAlpha=1;const pos=trailPoint(d,i,v,w,h),speed=Math.sin((phase*7%1)*Math.PI);
     bead(g,pos.x,pos.y,d.r*scale*pos.size,1+speed*.22,w,h);
   }
   g.restore();
 }
 window.TeacherTilesRainyWindowScene={themes:['rainy-window'],prepare,paint,draw};
})();
