/* Cached scenery and bounded motion layers for the nature theme packs. */
(()=>{'use strict';
 const W=1600,H=1000,TAU=Math.PI*2;
 const random=i=>{const n=Math.sin(i*127.1+91.7)*43758.5453;return n-Math.floor(n)};
 const themes=['fireplace','campfire','fireflies','beach','christmas-tree'];
 function gradient(g,x,y,x2,y2,stops){const c=g.createLinearGradient(x,y,x2,y2);stops.forEach(([p,v])=>c.addColorStop(p,v));return c}
 function rect(g,x,y,w,h,color,r=0){g.fillStyle=color;g.beginPath();g.roundRect(x,y,w,h,r);g.fill()}
 function ellipse(g,x,y,rx,ry,color){g.fillStyle=color;g.beginPath();g.ellipse(x,y,rx,ry,0,0,TAU);g.fill()}
 function glow(g,x,y,r,color){const c=g.createRadialGradient(x,y,0,x,y,r);c.addColorStop(0,color);c.addColorStop(1,'transparent');g.fillStyle=c;g.fillRect(x-r,y-r,r*2,r*2)}
 function path(g,points,color,stroke=0){g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));if(stroke){g.strokeStyle=color;g.lineWidth=stroke;g.stroke()}else{g.closePath();g.fillStyle=color;g.fill()}}
 function scene(g,w,h,paint){g.save();const s=Math.max(w/W,h/H);g.translate((w-W*s)/2,(h-H*s)/2);g.scale(s,s);paint();g.restore()}
 function beach(g){
  rect(g,0,0,W,H,gradient(g,0,0,0,H,[[0,'#548fad'],[.26,'#c6dfdc'],[.27,'#3e7a91'],[.46,'#3197a5'],[.70,'#72c6bc'],[.72,'#c9cab0'],[.86,'#e6d3ab'],[1,'#d2b88d']]));
  glow(g,1170,155,280,'#fff3c380');ellipse(g,1170,155,35,35,'#fff3d7');
  for(let i=0;i<24;i++){const x=random(i+6)*W,y=60+random(i+75)*160;ellipse(g,x,y,55+random(i)*110,2+random(i)*8,'#f5eee329')}
  // Far headland and tiny distant islands.
  path(g,[[0,272],[0,228],[75,230],[142,259],[204,258],[271,275]],'#527f8266');path(g,[[1300,274],[1370,258],[1440,260],[1490,248],[1600,237],[1600,276]],'#698e8c66');
  for(let i=0;i<2600;i++){const x=random(i+971)*W,y=815+random(i+1951)*190;ellipse(g,x,y,.4+random(i)*1.2,.4,'#816d4440')}
  for(let i=0;i<8;i++){const x=150+random(i+179)*1300,y=876+random(i+210)*104;ellipse(g,x,y,4+random(i)*5,2+random(i)*2,i%2?'#e8dbc2':'#a89374')}
  // A quiet patch of dune grass in the near corners.
  for(let i=0;i<50;i++){const x=i<25?random(i)*160:W-random(i)*130,y=H+10;g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x-25,y-60,x-40+random(i+23)*80,y-70-random(i+16)*90);g.strokeStyle=i%2?'#607665':'#9d9c76';g.lineWidth=1+random(i)*2;g.stroke()}
 }
 function waves(g,t){
  // Translucent wash advances over the wet sand, then recedes beneath the next break.
  const shore=x=>748+Math.sin(t*.55)*22+Math.sin(x*.005+t*.2)*13+Math.sin(x*.017-t*.3)*3;
  g.beginPath();g.moveTo(0,675);g.lineTo(W,675);for(let x=W;x>=0;x-=8)g.lineTo(x,shore(x));g.closePath();g.fillStyle=gradient(g,0,675,0,805,[[0,'#73c7bd00'],[.35,'#66bbb777'],[.75,'#97d5c3aa'],[1,'#e2e3c855']]);g.fill();
  g.beginPath();for(let x=0;x<=W;x+=8){const y=shore(x);x?g.lineTo(x,y):g.moveTo(x,y)}g.strokeStyle='#f3fae6a0';g.lineWidth=2.3;g.stroke();
  for(let i=0;i<230;i++){const x=random(i+3301)*W,offset=random(i+3371)*13;ellipse(g,x,shore(x)-offset,1+random(i)*2.3,.6+random(i+51),'#eef6de55')}
  for(let band=0;band<7;band++){
   const p=(t*.045+band/7)%1,yy=285+Math.pow(p,1.6)*532,amplitude=2+p*p*16;
   const waveY=x=>yy+Math.sin(x*.005+p*7)*amplitude+Math.sin(x*.016-p*9)*amplitude*.25;
   const alpha=Math.sin(p*Math.PI)*(.15+p*.40);g.beginPath();for(let x=-8;x<=W+8;x+=8){const y=waveY(x);x===-8?g.moveTo(x,y):g.lineTo(x,y)}for(let x=W+8;x>=-8;x-=8)g.lineTo(x,waveY(x)-5-p*30);g.closePath();g.fillStyle=gradient(g,0,yy-40,0,yy+20,[[0,'#b9e8db00'],[.7,`rgba(218,245,228,${alpha*.55})`],[1,`rgba(248,250,229,${alpha})`]]);g.fill();
   g.beginPath();for(let x=-8;x<=W+8;x+=8){const y=waveY(x);x===-8?g.moveTo(x,y):g.lineTo(x,y)}g.strokeStyle=`rgba(242,255,241,${alpha})`;g.lineWidth=1+p*3;g.stroke();
   if(p>.5)for(let i=0;i<160;i++){const x=random(i+band*19)*W,y=waveY(x)-random(i+133)*p*20;ellipse(g,x,y,.5+p*random(i+33)*3,.5+p*.8,`rgba(239,252,233,${alpha*(.2+random(i))})`)}
  }
  for(let i=0;i<120;i++){const x=random(i+751)*W,y=290+random(i+46)*330,pulse=.4+.6*Math.sin(t*.7+i);path(g,[[x,y],[x+4+((y-290)/330)*19,y]],`rgba(205,243,228,${.05+pulse*.08})`,.8)}
 }
 const living=window.TeacherTilesLivingScenes;
 window.TeacherTilesNatureScenes={themes,
  prepare:theme=>living.prepare(theme),
  ready:theme=>theme==='beach'||living.ready(theme),
  paint(g,w,h,theme){if(theme==='beach')scene(g,w,h,()=>beach(g));else living.paint(g,w,h,theme)},
  draw(g,w,h,theme,t){if(theme==='beach')scene(g,w,h,()=>waves(g,t));else living.draw(g,w,h,theme,t)}
 };
})();
