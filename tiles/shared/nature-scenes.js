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
 function pine(g,x,y,h,color,seed=0){
  path(g,[[x-h*.021,y],[x,y-h],[x+h*.021,y]],color);
  // Overlapping, irregular needle fans form a full crown instead of stacked triangles.
  for(let level=0;level<19;level++){
   const p=level/19,yy=y-h+h*p*.94,span=h*(.018+p*.30),tip=yy-h*(.09+random(seed+level)*.045);
   const pts=[[x,tip]];
   for(let side=1;side>=-1;side-=2){
    if(side===-1)pts.push([x,tip]);
    for(let j=1;j<=12;j++){const q=j/12,xx=x+side*span*q,base=yy+h*.055*q;pts.push([xx,base]);pts.push([xx-side*span*.045,base+h*(.01+random(seed+level*20+j)*.015)])}
    pts.push([x+side*span*.45,yy+h*.075],[x,yy+h*.1]);
   }
   path(g,pts,color);
   path(g,[[x,tip],[x+span*.68,yy+h*.034],[x,yy+h*.013]],'#9fc8b20b');
  }
 }
 function forest(g,kind){
  rect(g,0,0,W,H,gradient(g,0,0,0,H,[[0,'#081727'],[.5,'#223d47'],[1,'#081d21']]));
  glow(g,1090,190,430,'#a9cbd52a');ellipse(g,1110,162,36,36,'#dde4d6');ellipse(g,1126,153,33,33,'#213846');
  for(let i=0;i<90;i++)ellipse(g,random(i+110)*W,random(i+30)*390,.6+random(i+51),.6+random(i+51),'#c8dde080');
  for(let layer=0;layer<4;layer++){
   for(let i=0;i<20;i++){const x=i*93-70+random(i+layer*57)*50,h=240+random(i+layer*77)*380,y=690+layer*85;pine(g,x,y,h,['#365660','#29454e','#19353d','#0c262e'][layer],i+layer*30)}
   rect(g,0,610+layer*90,W,250,gradient(g,0,610+layer*90,0,860+layer*90,[[0,'#56747c00'],[.55,'#56747c12'],[1,'#0a222600']]));
  }
  path(g,[[0,870],[190,847],[380,883],[700,866],[1010,897],[1310,863],[1600,878],[1600,1000],[0,1000]],'#081b20');
  for(let i=0;i<190;i++){const x=random(i+900)*W,y=878+random(i+1100)*125;path(g,[[x,y],[x-5,y-9-random(i)*28],[x+1,y-5],[x+8,y-18]],i%2?'#28443b':'#17352f')}
  if(kind==='campfire'){
   glow(g,800,834,370,'#ef8a302f');ellipse(g,800,876,225,37,'#061318b0');
   for(let i=0;i<19;i++){const a=i/19*TAU;ellipse(g,800+Math.cos(a)*167,853+Math.sin(a)*36,22+random(i)*13,14,gradient(g,0,830,0,890,[[0,'#67645a'],[1,'#282e2b']]))}
   logs(g,800,846,1.1);
  }
 }
 function logs(g,x,y,scale){g.save();g.translate(x,y);g.scale(scale,scale);
  for(const [xx,yy,a] of [[-85,5,-.17],[-62,-14,.19],[-100,-27,-.07]]){g.save();g.translate(xx,yy);g.rotate(a);rect(g,0,-16,180,32,gradient(g,0,-16,0,16,[[0,'#69503b'],[.4,'#342b23'],[1,'#171e1b']]),9);for(let j=0;j<8;j++)path(g,[[7,j*3.5-12],[50,j*3.1-11],[95,j*3.7-15],[167,j*3.3-12]],j%2?'#94634680':'#171b19',1.6);ellipse(g,4,0,13,16,'#9a714a');for(let r=4;r<14;r+=4){g.strokeStyle='#63472e';g.lineWidth=1;g.beginPath();g.ellipse(4,0,r*.7,r,0,0,TAU);g.stroke()}g.restore()}
  g.restore();
 }
 function bricks(g,x,y,w,h,scale=1){
  rect(g,x,y,w,h,'#3a302b');const bh=48*scale,bw=126*scale;
  for(let row=0;row<h/bh;row++)for(let col=-1;col<w/bw+1;col++){const bx=x+col*bw+(row%2)*bw*.5,by=y+row*bh,k=row*80+col;g.save();g.beginPath();g.rect(x,y,w,h);g.clip();rect(g,bx+3,by+3,bw-6,bh-6,gradient(g,0,by,0,by+bh,[[0,`hsl(${16+random(k)*8} 26% ${24+random(k+80)*11}%)`],[1,'#45342c']]),3);path(g,[[bx+8,by+7],[bx+bw-9,by+7]],'#b2825440',1);for(let j=0;j<7;j++)path(g,[[bx+random(k+j*50)*bw,by+random(k+j)*bh],[bx+random(k+j*50)*bw+14,by+random(k+j)*bh]],'#231f1826',1);g.restore()}
 }
 function hearth(g,x,y,s){g.save();g.translate(x,y);g.scale(s,s);
  bricks(g,-390,-530,780,600);rect(g,-434,-545,868,37,gradient(g,0,-545,0,-508,[[0,'#77604b'],[.3,'#504030'],[1,'#201e1a']]),5);
  g.beginPath();g.moveTo(-265,20);g.lineTo(-265,-275);g.bezierCurveTo(-265,-485,265,-485,265,-275);g.lineTo(265,20);g.closePath();g.fillStyle='#171515';g.fill();g.lineWidth=33;g.strokeStyle='#82634a';g.stroke();
  for(let i=0;i<13;i++){const a=Math.PI+i/12*Math.PI;path(g,[[Math.cos(a)*278,-276+Math.sin(a)*169],[Math.cos(a)*311,-276+Math.sin(a)*192]],'#392d24',4)}
  glow(g,0,-70,270,'#d7601438');for(let i=0;i<5;i++)path(g,[[-249,-90-i*48],[249,-90-i*48]],'#482e21',3);
  rect(g,-423,22,846,48,gradient(g,0,22,0,70,[[0,'#7a6450'],[.15,'#564337'],[1,'#302920']]),4);logs(g,0,-8,1.75);g.restore();
 }
 function fireplace(g){
  bricks(g,0,0,W,880,1.7);rect(g,0,864,W,136,gradient(g,0,864,0,1000,[[0,'#3b3026'],[1,'#1d1a19']]));
  hearth(g,800,840,1.23);glow(g,800,765,620,'#ef9e3233');
  for(const x of [245,1320]){rect(g,x,670,20,178,'#161a19',4);ellipse(g,x+10,844,47,10,'#151917');rect(g,x-8,650,36,65,'#c4b89b',3)}
  vignette(g,.6);
 }
 function cabin(g){
  rect(g,0,0,W,H,'#38291e');for(let i=0;i<12;i++){rect(g,0,i*72,W,70,gradient(g,0,i*72,0,i*72+70,[[0,'#70513a'],[.18,'#8a6346'],[.6,'#5f432f'],[1,'#2b241d']]),21);for(let j=0;j<14;j++){const x=random(i*31+j)*W,y=i*72+10+random(i+j)*44;path(g,[[x,y],[x+60,y-2],[x+150,y+2]],'#bd936122',1)}}
  rect(g,0,858,W,142,gradient(g,0,858,0,1000,[[0,'#634830'],[1,'#251f1a']]));for(let i=0;i<16;i++)path(g,[[800+(i-8)*90,858],[(i-8)*180+800,1000]],'#171b1880',2);
  // Deep window frame; snowfall is clipped to the glass in the motion pass.
  rect(g,183,142,384,475,'#211d18',8);rect(g,200,157,350,440,gradient(g,0,157,0,597,[[0,'#162d45'],[1,'#6d8c97']]),3);
  g.save();g.beginPath();g.rect(200,157,350,440);g.clip();glow(g,480,227,140,'#c8dae849');ellipse(g,480,227,25,25,'#d5e1df');for(let i=0;i<8;i++)pine(g,207+i*49,570,140+random(i)*100,'#254453',i);path(g,[[200,570],[320,552],[440,578],[550,560],[550,597],[200,597]],'#b2c5c9');g.restore();
  hearth(g,795,840,.67);rect(g,504,458,582,23,'#37291e',3);
  for(const x of [542,601,985]){rect(g,x,414,15,43,'#d6c6a1',3);ellipse(g,x+7.5,411,4,8,'#ffdb8a')}
  // Woven rug and wrapped parcels.
  ellipse(g,1210,900,322,60,'#29261ea0');ellipse(g,1140,941,455,85,'#8d3f324a');
  pine(g,1250,884,650,'#102f27',35);pine(g,1250,868,610,'#194332',79);
  for(let i=0;i<135;i++){const yy=320+random(i+155)*540,span=(yy-245)*.30,xx=1250+(random(i+90)-.5)*span*2;path(g,[[xx,yy],[xx+16,yy-8],[xx+34,yy+3]],i%3?'#38725166':'#77916b44',2)}
  for(let i=0;i<48;i++){const yy=330+random(i+755)*500,xx=1250+(random(i+990)-.5)*(yy-235)*.55,r=5+random(i)*6;ellipse(g,xx,yy,r,r,gradient(g,xx-r,yy-r,xx+r,yy+r,[[0,i%3?'#f4d69a':'#f49876'],[.35,i%3?'#bf9856':'#b94432'],[1,i%3?'#705128':'#5a2320']]))}
  g.save();g.translate(1250,235);const pts=[];for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?11:27;pts.push([Math.cos(a)*r,Math.sin(a)*r])}path(g,pts,'#e4c078');g.restore();
  for(const [x,y,w,h,c] of [[1060,891,110,68,'#8f3f32'],[1360,872,92,85,'#b59461'],[1180,924,145,57,'#385b4a']]){rect(g,x,y-h,w,h,c,3);rect(g,x+w*.44,y-h,w*.13,h,'#e0c78e');rect(g,x,y-h*.7,w,7,'#e0c78e');ellipse(g,x+w*.5-12,y-h-4,14,6,'#d6bd87');ellipse(g,x+w*.5+12,y-h-4,14,6,'#d6bd87')}
  glow(g,795,792,560,'#e9973222');vignette(g,.55);
 }
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
 function vignette(g,opacity){const c=g.createRadialGradient(800,520,180,800,520,940);c.addColorStop(0,'transparent');c.addColorStop(1,`rgba(4,10,13,${opacity})`);rect(g,0,0,W,H,c)}
 function fire(g,x,y,s,t){g.save();g.translate(x,y);g.scale(s,s);
  glow(g,0,-65,260,'#f67d1626');g.globalCompositeOperation='screen';
  for(let layer=0;layer<3;layer++)for(let i=0;i<11;i++){
   const base=(i-5)*(layer===2?10:17)+Math.sin(t*1.3+i)*5,phase=i*2.17+layer*1.3,h=(layer===0?170:layer===1?135:80)*( .76+.18*Math.sin(t*3.1+phase)+.12*Math.sin(t*5.7-phase)),spread=23-layer*5,sway=Math.sin(t*2.6+phase)*24;
   g.beginPath();g.moveTo(base-spread,0);g.bezierCurveTo(base-spread*2,-h*.32,base+sway+spread*.7,-h*.60,base+sway,-h);g.bezierCurveTo(base+sway-16,-h*.67,base+spread*1.1,-h*.22,base+spread,0);g.closePath();g.fillStyle=gradient(g,0,0,0,-h,[[0,layer===2?'#fff1b0b0':'#ffb02190'],[.45,layer===2?'#ffdf69bb':'#f9671390'],[1,'#da391000']]);g.fill();
  }
  for(let i=0;i<29;i++){const life=(t*(.13+random(i)*.1)+random(i+53))%1,xx=(random(i+400)-.5)*150+Math.sin(life*7+i)*26,yy=-20-life*350;g.globalAlpha=Math.sin(life*Math.PI)*.8;ellipse(g,xx,yy,0.4+random(i)*.8,.7+random(i)*1.4,'#ffd787')}
  g.globalAlpha=1;g.globalCompositeOperation='source-over';logs(g,0,8,.9);glow(g,0,2,85,'#f9781735');g.restore();
 }
 function smoke(g,t){for(let i=0;i<11;i++){const p=(t*.065+i/11)%1,x=800+Math.sin(p*6+t*.3)*45+p*130,y=680-p*580;g.globalAlpha=Math.sin(p*Math.PI)*.08;glow(g,x,y,35+p*110,'#b7c4ca')}g.globalAlpha=1}
 function flies(g,t){
  for(let i=0;i<63;i++){const depth=.2+random(i+41)*.8,x=random(i+71)*W+Math.sin(t*.31+i)*40*depth,y=420+random(i+191)*500+Math.sin(t*.4+i*3)*28;const pulse=Math.pow(.5+.5*Math.sin(t*(.6+random(i)*.9)+i),2);g.globalAlpha=.18+pulse*.82;glow(g,x,y,8+depth*14,'#c1e97440');ellipse(g,x,y,1+depth*1.7,1+depth*1.7,'#efffac');g.globalAlpha=1}
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
 function christmas(g,t){
  g.save();g.beginPath();g.rect(200,157,350,440);g.clip();for(let i=0;i<52;i++){const p=random(i+97),x=200+(random(i+341)*350+Math.sin(t*.3+i)*14+350)%350,y=157+(p*440+t*(7+p*15))%440;ellipse(g,x,y,1+p*1.8,1+p*1.8,'#edf4efd9')}g.restore();
  rect(g,367,157,15,440,'#574334');rect(g,200,371,350,15,'#574334');rect(g,173,597,404,17,'#816147',3);
  fire(g,795,829,.67,t);glow(g,1250,235,42,'#ffd17930');
  for(let i=0;i<78;i++){const p=i/78,yy=320+p*536,xx=1250+Math.sin(p*TAU*5)*(30+p*173);const alpha=.6+.35*Math.sin(t*.75+i*1.81);g.globalAlpha=alpha;glow(g,xx,yy,12,'#ffc96066');ellipse(g,xx,yy,2.3,2.3,'#ffeac0');g.globalAlpha=1}
 }
 window.TeacherTilesNatureScenes={themes,
  paint(g,w,h,theme){scene(g,w,h,()=>{if(theme==='fireplace')fireplace(g);else if(theme==='christmas-tree')cabin(g);else if(theme==='beach')beach(g);else forest(g,theme)})},
  draw(g,w,h,theme,t){scene(g,w,h,()=>{if(theme==='fireplace'){g.save();g.beginPath();g.rect(495,430,610,465);g.clip();fire(g,800,824,2.15,t);g.restore();for(const x of [255,1330])fire(g,x,651,.13,t+x)}else if(theme==='campfire'){smoke(g,t);fire(g,800,837,1.15,t)}else if(theme==='fireflies')flies(g,t);else if(theme==='beach')waves(g,t);else christmas(g,t)})}
 };
})();
