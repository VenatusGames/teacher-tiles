/* Rain against cabin glass. Forest and stationary beads are cached by the theme renderer. */
(()=>{'use strict';
 const source=new URL('../../assets/themes/rainy-forest.webp',document.currentScript.src).href;
 const forest=new Image();forest.decoding='async';let loading=null;
 const random=i=>{const n=Math.sin(i*127.1+72.9)*43758.5453;return n-Math.floor(n)};
 const beads=Array.from({length:720},(_,i)=>({x:random(i+1),y:random(i+911),r:.65+random(i+1751)**2*2.5}));
 const runners=Array.from({length:48},(_,i)=>({x:random(i+221),phase:random(i+501),duration:13+random(i+821)*21,r:1.7+random(i+1221)*2.8,tail:30+random(i+1421)*110}));
 function prepare(){if(forest.complete&&forest.naturalWidth)return Promise.resolve();if(loading)return loading;loading=new Promise(resolve=>{forest.onload=()=>resolve();forest.onerror=()=>{loading=null;resolve()};forest.src=source});return loading;}
 function bead(g,x,y,r,stretch=1){
   g.save();g.translate(x,y);g.scale(1,stretch);
   g.beginPath();g.moveTo(0,-r*1.35);g.bezierCurveTo(-r*.35,-r*.9,-r,-r*.5,-r,r*.2);g.bezierCurveTo(-r,r*1.15,r,r*1.15,r,r*.2);g.bezierCurveTo(r,-r*.5,r*.3,-r,0,-r*1.35);
   const lens=g.createLinearGradient(-r,-r,r,r);lens.addColorStop(0,'#07141a90');lens.addColorStop(.38,'#b4cdd617');lens.addColorStop(.72,'#101f28a0');lens.addColorStop(1,'#b6ced39e');g.fillStyle=lens;g.fill();
   g.strokeStyle='#bed2d16b';g.lineWidth=Math.max(.4,r*.15);g.beginPath();g.moveTo(-r*.45,-r*.75);g.quadraticCurveTo(-r*.85,-r*.1,-r*.55,r*.4);g.stroke();
   g.strokeStyle='#e0ebe78a';g.beginPath();g.moveTo(-r*.15,r*.63);g.quadraticCurveTo(r*.45,r*.8,r*.65,r*.25);g.stroke();g.restore();
 }
 function paint(g,w,h){
   g.fillStyle='#23333b';g.fillRect(0,0,w,h);
   if(forest.naturalWidth){const s=Math.max(w/forest.naturalWidth,h/forest.naturalHeight);g.drawImage(forest,(w-forest.naturalWidth*s)/2,(h-forest.naturalHeight*s)/2,forest.naturalWidth*s,forest.naturalHeight*s);}
   g.fillStyle='#15232b25';g.fillRect(0,0,w,h);
   const shade=g.createRadialGradient(w*.55,h*.4,Math.min(w,h)*.18,w*.5,h*.5,Math.max(w,h)*.72);shade.addColorStop(0,'#0b111600');shade.addColorStop(1,'#050b108f');g.fillStyle=shade;g.fillRect(0,0,w,h);
   const scale=Math.max(w/1600,h/1000);
   for(const d of beads)bead(g,d.x*w,d.y*h,d.r*scale);
 }
 function frame(g,w,h){
   const s=Math.max(.3,Math.min(w/1400,h/850)),edge=Math.max(7,20*s),bar=Math.max(4,17*s);
   const wood=(x,y,bw,bh)=>{const shade=g.createLinearGradient(x,y,x+bw,y+Math.min(bh,14*s));shade.addColorStop(0,'#202521');shade.addColorStop(.18,'#111713');shade.addColorStop(.7,'#0a100e');shade.addColorStop(1,'#050a08');g.fillStyle=shade;g.fillRect(x,y,bw,bh);g.fillStyle='#9eafa217';g.fillRect(x,y,Math.max(.5,s),bh);g.fillRect(x,y,bw,Math.max(.5,s));};
   g.save();g.shadowColor='#0009';g.shadowBlur=10*s;g.shadowOffsetX=2*s;g.shadowOffsetY=3*s;
   const panes=w/h>1.25?4:3;
   for(let i=1;i<panes;i++)wood(w*i/panes-bar/2,0,bar,h);
   wood(0,h*.53-bar*.38,w,bar*.76);
   wood(0,0,edge,h);wood(w-edge,0,edge,h);wood(0,0,w,edge*.7);wood(0,h-edge,w,edge);g.restore();
 }
 function draw(g,w,h,_theme,t){
   const scale=Math.max(w/1600,h/1000);
   // One batched layer of fine rain beyond the pane, kept quieter than the glass droplets.
   g.save();g.strokeStyle='#c0d1d123';g.lineWidth=Math.max(.4,.75*scale);g.beginPath();
   for(let i=0;i<125;i++){const x=random(i+3401)*w,y=(random(i+4501)*h+t*(150+random(i+5101)*100)*scale)%(h+60*scale)-60*scale;g.moveTo(x,y);g.lineTo(x-3*scale,y+(16+random(i+6001)*25)*scale);}g.stroke();
   for(let i=0;i<runners.length;i++){
     const d=runners[i],phase=(t/d.duration+d.phase)%1,p=phase<.18?0:((phase-.18)/.82)**1.35;
     const y=p*(h+200*scale)-100*scale,tail=d.tail*scale,r=d.r*scale;
     const x=d.x*w+Math.sin(y/(92*scale)+i)*3.2*scale;
     if(p>0){const shine=g.createLinearGradient(0,y-tail,0,y);shine.addColorStop(0,'#c4d6d300');shine.addColorStop(.8,'#c4d6d323');shine.addColorStop(1,'#d2dfd94f');g.lineCap='round';g.strokeStyle=shine;g.lineWidth=r*.95;g.beginPath();g.moveTo(x+Math.sin(i)*3*scale,y-tail);g.bezierCurveTo(x-4*scale,y-tail*.64,x+3*scale,y-tail*.28,x,y);g.stroke();g.strokeStyle='#07131c35';g.lineWidth=Math.max(.4,.65*scale);g.stroke();}
     bead(g,x,y,r,1.35);
   }
   g.restore();frame(g,w,h);
 }
 window.TeacherTilesRainyWindowScene={themes:['rainy-window'],prepare,paint,draw};
})();
