/* One cached backdrop and a bounded set of particles; the board owns the animation lifecycle. */
(()=>{'use strict';
 const assetBase=new URL('../../assets/themes/',document.currentScript.src);
 const W=1672,H=941,assets=new Map(),random=i=>{const v=Math.sin(i*127.1+83.9)*43758.54;return v-Math.floor(v)};
 const maple=new Path2D('M0-23 5-12 12-17 11-7 23-10 18 0 26 4 10 11 11 18 2 15 0 25-2 15-11 18-10 11-26 4-18 0-23-10-11-7-12-17-5-12Z');
 const oak=new Path2D('M0-25C9-22 5-15 9-16C20-19 19-7 13-6C28-7 24 4 16 5C25 14 14 20 4 15L0 25-4 15C-14 20-25 14-16 5C-24 4-28-7-13-6C-19-7-20-19-9-16C-5-15-9-22 0-25Z');
 function leaf(g,x,y,size,angle,color,index=0,flip=1){g.save();g.translate(x,y);g.rotate(angle);g.scale(size*Math.max(.25,Math.abs(flip)),size);g.fillStyle=color;g.strokeStyle='#633a234f';g.lineWidth=1;g.fill(index%2?oak:maple);g.stroke(index%2?oak:maple);g.strokeStyle='#593b3677';g.beginPath();g.moveTo(0,-18);g.lineTo(0,25);for(const sign of [-1,1]){g.moveTo(0,1);g.lineTo(sign*13,-7);g.moveTo(0,9);g.lineTo(sign*15,3);}g.stroke();g.restore();}
 const frame=(g,w,h,draw)=>{const s=Math.max(w/W,h/H);g.save();g.translate((w-W*s)/2,(h-H*s)/2);g.scale(s,s);draw();g.restore();};
 function prepare(theme){if(assets.has(theme))return assets.get(theme).promise;const image=new Image(),entry={image,ready:false};assets.set(theme,entry);image.src=new URL(`${theme}.webp`,assetBase).href;entry.promise=image.decode().then(()=>entry.ready=true).catch(()=>{});return entry.promise;}
 function paint(g,w,h,theme){g.fillStyle='#b17b43';g.fillRect(0,0,w,h);const item=assets.get(theme);if(item?.ready)frame(g,w,h,()=>g.drawImage(item.image,0,0,W,H));}
 function draw(g,w,h,theme,t){frame(g,w,h,()=>{
  if(theme==='autumn-forest')for(let i=0;i<44;i++){const depth=.4+random(i+4)*.6,y=(random(i+80)*(H+100)+t*(15+depth*24))%(H+100)-50,x=random(i+9)*W+Math.sin(t*.45+i*2.3)*(22+depth*35);leaf(g,x,y,.22+depth*.46,Math.sin(t*.6+i)*.9+t*.11,['#df872a','#b54930','#e3ad42','#a86637'][i%4],i,Math.cos(t*.75+i));}
  else if(theme==='feast')for(const [x,y,r]of [[820,650,1.3],[230,405,.8],[1420,440,1],[1470,125,.65]])for(let i=0;i<5;i++){const phase=(t*.15+i*.2)%1,yy=y-phase*170*r,xx=x+Math.sin(t*.7+i)*18*r+(i-2)*22*r;g.save();g.globalAlpha=Math.sin(phase*Math.PI)*.23;g.strokeStyle='#fff9e9';g.lineWidth=(9+phase*12)*r;g.lineCap='round';g.filter='blur(7px)';g.beginPath();g.moveTo(xx,yy);g.bezierCurveTo(xx-26*r,yy-28*r,xx+29*r,yy-52*r,xx,yy-82*r);g.stroke();g.restore();}
 });}
 window.TeacherTilesAutumnScenes={themes:['autumn-forest','feast'],prepare,paint,draw,leaf,ready:theme=>!!assets.get(theme)?.ready};
})();
