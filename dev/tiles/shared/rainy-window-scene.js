/* Oblique cabin window: cached forest/glass, clear beads and broken rain residue. */
(()=>{'use strict';
 const source=new URL('../../assets/themes/rainy-forest.webp',document.currentScript.src).href;
 const forest=new Image();forest.decoding='async';let loading=null;
 const random=i=>{const n=Math.sin(i*127.1+72.9)*43758.5453;return n-Math.floor(n)};
 const beads=Array.from({length:680},(_,i)=>({u:random(i+1),v:random(i+911),r:.45+random(i+1751)**2*3.1,shape:.82+random(i+2031)*.38}));
 const runners=Array.from({length:38},(_,i)=>({u:random(i+221),phase:random(i+501),duration:24+random(i+821)*24,r:2.1+random(i+1221)*1.8}));
 function prepare(){if(forest.complete&&forest.naturalWidth)return Promise.resolve();if(loading)return loading;loading=new Promise(resolve=>{forest.onload=()=>resolve();forest.onerror=()=>{loading=null;resolve()};forest.src=source});return loading;}
 // A receding plane: distant left panes are narrower, rails converge toward the left.
 function point(u,v,w,h){const f=u/(1.65-.65*u);return {x:w*(.035+1.06*f+.018*(v-.5)*(1-f)),y:h*(.16-.24*f+v*(.73+.46*f)),size:.67+.5*f};}
 function bead(g,x,y,r,shape,w,h){
   if(r<.55){g.fillStyle='#dce8e72c';g.fillRect(x,y,.6,.8);return;}
   const ry=r*shape;
   g.save();g.translate(x,y);g.beginPath();
   g.moveTo(-r*.12,-ry);g.bezierCurveTo(-r*.82,-ry,-r*1.08,-ry*.2,-r*.9,ry*.36);
   g.bezierCurveTo(-r*.72,ry*1.08,r*.6,ry*1.13,r*.9,ry*.4);
   g.bezierCurveTo(r*1.1,-ry*.22,r*.66,-ry*1.02,-r*.12,-ry);g.closePath();
   g.save();g.clip();
   if(forest.naturalWidth&&r>1){
     const cover=Math.max(w/forest.naturalWidth,h/forest.naturalHeight),ox=(w-forest.naturalWidth*cover)/2,oy=(h-forest.naturalHeight*cover)/2;
     const sample=r*6/cover,sx=Math.max(0,Math.min(forest.naturalWidth-sample,(x-ox)/cover-sample/2)),sy=Math.max(0,Math.min(forest.naturalHeight-sample,(y-oy)/cover-sample/2));
     g.globalAlpha*=.72;g.scale(1,-1);g.drawImage(forest,sx,sy,sample,sample,-r,-ry,r*2,ry*2);
   }
   g.restore();g.lineWidth=Math.max(.35,r*.1);g.strokeStyle='#07111765';g.stroke();
   g.beginPath();g.ellipse(0,ry*.1,r*.72,ry*.72,0,.15,1.9);g.strokeStyle='#d8e5e567';g.stroke();
   g.fillStyle='#e9f2ee83';g.beginPath();g.ellipse(-r*.38,-ry*.44,Math.max(.3,r*.15),Math.max(.3,r*.1),-.5,0,Math.PI*2);g.fill();g.restore();
 }
 function paint(g,w,h){
   g.fillStyle='#23333b';g.fillRect(0,0,w,h);
   if(forest.naturalWidth){const s=Math.max(w/forest.naturalWidth,h/forest.naturalHeight);g.drawImage(forest,(w-forest.naturalWidth*s)/2,(h-forest.naturalHeight*s)/2,forest.naturalWidth*s,forest.naturalHeight*s);}
   g.fillStyle='#15232b25';g.fillRect(0,0,w,h);
   const shade=g.createRadialGradient(w*.6,h*.4,Math.min(w,h)*.15,w*.5,h*.5,Math.max(w,h)*.78);shade.addColorStop(0,'#0b111600');shade.addColorStop(1,'#050b1070');g.fillStyle=shade;g.fillRect(0,0,w,h);
   const scale=Math.max(w/1600,h/1000);
   for(const d of beads){const p=point(d.u,d.v,w,h);bead(g,p.x,p.y,d.r*scale*p.size,d.shape,w,h);}
 }
 const frameCache=new Map();
 function frame(target,w,h){
   const key=w+'x'+h;
   if(frameCache.has(key)){target.drawImage(frameCache.get(key),0,0,w,h);return;}
   const canvas=document.createElement('canvas');canvas.width=Math.ceil(w);canvas.height=Math.ceil(h);const g=canvas.getContext('2d');
   const polygon=points=>{g.beginPath();points.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath();g.fill();};
   const q=(u,v)=>point(u,v,w,h),scale=Math.max(w/1600,h/1000);
   // The angled opening is surrounded by a real wall surface, not an empty mask.
   g.save();g.beginPath();g.rect(0,0,w,h);[q(0,0),q(1,0),q(1,1),q(0,1)].forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath();g.clip('evenodd');
   g.fillStyle='#4d4a41';g.fillRect(0,0,w,h);
   // Fine plaster grain is painted once, and never moves with the rain.
   for(let i=0;i<Math.ceil(w*h/85);i++){const x=random(i+12001)*w,y=random(i+31001)*h;g.fillStyle=i%3?'#c5bc9b0c':'#171c1811';g.fillRect(x,y,Math.max(.6,random(i+44001)*1.5*scale),Math.max(.6,random(i+53001)*1.5*scale));}
   g.shadowColor='#10141090';g.shadowBlur=14*scale;g.lineWidth=9*scale;g.strokeStyle='#262b25';g.beginPath();[q(0,0),q(1,0),q(1,1),q(0,1)].forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath();g.stroke();g.restore();
   // Flat, distinct trim and reveal faces give the frame depth without shiny gradients.
   g.fillStyle='#373b32';polygon([q(-.022,-.027),q(1.022,-.027),q(1.022,0),q(-.022,0)]);
   g.fillStyle='#292e27';polygon([q(-.022,-.027),q(0,0),q(0,1),q(-.022,1.025)]);
   g.fillStyle='#1b211c';polygon([q(1,0),q(1.022,-.027),q(1.022,1.025),q(1,1)]);
   g.fillStyle='#101612';
   const panes=w/h>1.25?4:3,rail=.012;
   for(let i=0;i<=panes;i++){const u=i/panes,half=i===0||i===panes?.012:.008;polygon([q(u-half,0),q(u+half,0),q(u+half,1),q(u-half,1)]);}
   for(const v of [0,.52,1])polygon([q(0,v-rail),q(1,v-rail),q(1,v+rail),q(0,v+rail)]);
   // A shallow projecting sill with a separate front edge anchors the window in the room.
   const left=q(-.027,1),right=q(1.027,1),frontLeft={x:left.x-8*scale,y:left.y+18*scale},frontRight={x:right.x+8*scale,y:right.y+25*scale};
   g.fillStyle='#635d4c';polygon([left,right,frontRight,frontLeft]);
   g.strokeStyle='#aea18a26';g.lineWidth=.7*scale;
   for(let i=1;i<5;i++){const f=i/5;g.beginPath();g.moveTo(left.x+(frontLeft.x-left.x)*f,left.y+(frontLeft.y-left.y)*f);g.lineTo(right.x+(frontRight.x-right.x)*f,right.y+(frontRight.y-right.y)*f);g.stroke();}
   g.fillStyle='#373b31';polygon([frontLeft,frontRight,{x:frontRight.x,y:frontRight.y+9*scale},{x:frontLeft.x,y:frontLeft.y+9*scale}]);
   if(frameCache.size>=6)frameCache.delete(frameCache.keys().next().value);frameCache.set(key,canvas);target.drawImage(canvas,0,0,w,h);
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
   g.restore();frame(g,w,h);
 }
 window.TeacherTilesRainyWindowScene={themes:['rainy-window'],prepare,paint,draw};
})();
