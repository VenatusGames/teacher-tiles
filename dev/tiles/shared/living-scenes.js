/* Photographic plates are loaded only when selected; all movement is composited live. */
(()=>{'use strict';
 const W=1600,H=900,TAU=Math.PI*2,cache=new Map();
 const names=['fireplace','campfire','fireflies','christmas-tree'];
 const assetRoot=new URL('../../assets/themes/scenes/',document.currentScript.src);
 const random=i=>{const v=Math.sin(i*127.1+47.3)*43758.5453;return v-Math.floor(v)};
 let flames=null,flameTried=false;
 const flameComposite=document.createElement('canvas');flameComposite.width=flameComposite.height=384;const flameContext=flameComposite.getContext('2d');
 const fireRegions={fireplace:{x:810,y:776,w:1050,h:710,logTop:540},campfire:{x:800,y:748,w:295,h:370,logTop:638},'christmas-tree':{x:685,y:638,w:235,h:227,logTop:553}};
 function glowSprite(color){const c=document.createElement('canvas');c.width=c.height=96;const g=c.getContext('2d'),gradient=g.createRadialGradient(48,48,0,48,48,48);gradient.addColorStop(0,color);gradient.addColorStop(.12,color);gradient.addColorStop(.4,color.replace('1)', '.15)'));gradient.addColorStop(1,color.replace('1)', '0)'));g.fillStyle=gradient;g.fillRect(0,0,96,96);return c}
 const gold=glowSprite('rgba(255,192,54,1)'),warm=glowSprite('rgba(255,120,24,1)'),mist=glowSprite('rgba(165,178,190,1)');
 function sprite(g,source,x,y,r,alpha=1){g.globalAlpha=alpha;g.drawImage(source,x-r,y-r,r*2,r*2);g.globalAlpha=1}
 function frame(g,w,h,paint){g.save();const scale=Math.max(w/W,h/H);g.translate((w-W*scale)/2,(h-H*scale)/2);g.scale(scale,scale);paint();g.restore()}
 function sampleLights(image){
  const c=document.createElement('canvas');c.width=400;c.height=225;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(image,0,0,400,225);const pixels=g.getImageData(0,0,400,225).data,result=[];
  for(let y=12;y<169;y+=2)for(let x=253;x<378;x+=2){const i=(y*400+x)*4,r=pixels[i],green=pixels[i+1],b=pixels[i+2];if(r>223&&green>162&&b>65&&r>green&&green>b*1.08&&!result.some(p=>Math.hypot(p.x-x*4,p.y-y*4)<14))result.push({x:x*4,y:y*4,phase:random(i)*TAU})}
  return result.slice(0,130);
 }
 function prepare(theme){
  if(!names.includes(theme))return Promise.resolve();
  if(cache.has(theme))return cache.get(theme).promise;
  // Keep at most two decoded background plates in memory.
  if(cache.size>=2){const key=cache.keys().next().value;cache.delete(key)}
  const image=new Image(),entry={image,ready:false,lights:[]};cache.set(theme,entry);image.src=new URL(theme+'.webp',assetRoot).href;
  entry.promise=image.decode().then(()=>{entry.ready=true;if(fireRegions[theme])entry.mask=logMask(image,fireRegions[theme],theme);if(theme==='christmas-tree')entry.lights=sampleLights(image);}).catch(()=>{entry.failed=true});return entry.promise;
 }
 function paint(g,w,h,theme){
  const entry=cache.get(theme);g.fillStyle=theme==='christmas-tree'?'#302014':theme==='fireplace'?'#231008':'#07151d';g.fillRect(0,0,w,h);
  if(entry?.ready)frame(g,w,h,()=>g.drawImage(entry.image,0,0,W,H));
 }
 function logMask(image,region,theme){
  const c=document.createElement('canvas');c.width=c.height=384;const g=c.getContext('2d',{willReadFrequently:true}),sx=image.naturalWidth/W,sy=image.naturalHeight/H;
  g.drawImage(image,(region.x-region.w/2)*sx,(region.y-region.h)*sy,region.w*sx,region.h*sy,0,0,384,384);
  const pixels=g.getImageData(0,0,384,384);
  for(let y=0;y<384;y++)for(let x=0;x<384;x++){const i=(y*384+x)*4,yy=region.y-region.h+y/384*region.h,xx=region.x-region.w/2+x/384*region.w;let top=region.logTop;if(theme==='campfire')top=638+Math.abs(xx-790)*.70;else if(theme==='christmas-tree')top=553+Math.abs(xx-685)*.3;else top=xx<665?535+Math.max(0,xx-235)*.36:xx>915?574+(xx-915)*.37:684;const fade=Math.max(0,Math.min(1,(yy-top)/14));const light=pixels.data[i]*.3+pixels.data[i+1]*.6+pixels.data[i+2]*.1;pixels.data[i+3]=Math.max(0,Math.min(1,(95-light)/55))*fade*255;}
  g.putImageData(pixels,0,0);return c;
 }
 function flamesAt(g,t,theme){
  if(!flameTried){flameTried=true;flames=window.TeacherTilesFlameRenderer?.()}
  const texture=flames?.draw(t),region=fireRegions[theme],entry=cache.get(theme);
  if(texture){
   flameContext.clearRect(0,0,384,384);flameContext.globalCompositeOperation='source-over';flameContext.drawImage(texture,0,0,384,384);
   if(entry.mask){flameContext.globalCompositeOperation='destination-out';flameContext.drawImage(entry.mask,0,0);flameContext.globalCompositeOperation='source-over'}
   g.save();g.globalCompositeOperation='screen';g.drawImage(flameComposite,region.x-region.w/2,region.y-region.h,region.w,region.h);g.restore();
  }
 }
 function emberDrift(g,t,x,y,width,height,count){
  g.save();g.globalCompositeOperation='screen';
  for(let i=0;i<count;i++){const age=(t*(.12+random(i+19)*.17)+random(i+93))%1,xx=x+(random(i+314)-.5)*width+Math.sin(age*9+i)*height*.065,yy=y-age*height;const a=Math.sin(age*Math.PI)*(1-age)*.7;const r=.45+random(i+91)*.8;sprite(g,warm,xx,yy,r*3,a);g.fillStyle=`rgba(255,206,109,${a})`;g.fillRect(xx,yy,r,r*(1.4+age))}
  g.restore();
 }
 function smoke(g,t,x,y,scale){
  g.save();g.globalCompositeOperation='screen';
  for(let i=0;i<16;i++){const life=(t*.062+i/16)%1,xx=x+Math.sin(life*7+t*.18)*27*scale+life*75*scale,yy=y-life*350*scale,r=(10+life*66)*scale;sprite(g,mist,xx,yy,r,Math.sin(life*Math.PI)*.042)}g.restore();
 }
 function relight(g,t,x,y,r){g.save();g.globalCompositeOperation='screen';sprite(g,warm,x,y,r,.035+Math.sin(t*3.7)*.008+Math.sin(t*6.3+1)*.005);g.restore()}
 function insects(g,t){
  g.save();g.globalCompositeOperation='screen';
  for(let i=0;i<104;i++){
   const depth=random(i+782),rate=.16+random(i+32)*.16,x=random(i+207)*W+Math.sin(t*rate+i*2.1)*(20+depth*60),y=220+random(i+623)*620+Math.sin(t*rate*.79+i*3.9)*(10+depth*32);
   const pulse=.12+.88*Math.pow(.5+.5*Math.sin(t*(.6+random(i+223)*.5)+i*2.4),2),r=.65+depth*depth*4.5;
   sprite(g,gold,x,y,r*(depth>.84?5:4),pulse*(.38+depth*.48));
   g.fillStyle=`rgba(255,233,136,${pulse*.75})`;g.beginPath();g.ellipse(x,y,r*(depth>.84?1.4:.8),r*.65,Math.sin(t*.4+i),0,TAU);g.fill();
   if(i%9===0){g.strokeStyle=`rgba(244,180,48,${pulse*.18})`;g.lineWidth=.8;g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x-4,y+2,x-9,y+1);g.stroke()}
  }
  g.restore();
 }
 function snow(g,t){
  // Perspective-correct panes exclude the photographed wooden frame and mullions.
  const panes=[[[85,135],[191,140],[192,275],[81,273]],[[205,141],[305,147],[306,279],[204,275]],[[81,288],[192,290],[192,434],[83,433]],[[205,291],[306,294],[307,437],[205,435]]];
  g.save();g.beginPath();for(const points of panes){points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath()}g.clip();
  for(let i=0;i<58;i++){const d=random(i+36),y=130+(random(i+951)*310+t*(7+d*10))%320,x=82+(random(i+401)*230+Math.sin(t*.27+i)*9+230)%230;g.fillStyle=`rgba(222,237,249,${.24+d*.42})`;g.beginPath();g.arc(x,y,.45+d*.85,0,TAU);g.fill()}g.restore();
 }
 function draw(g,w,h,theme,t){
  if(!cache.get(theme)?.ready)return;
  frame(g,w,h,()=>{
   if(theme==='fireplace'){
    relight(g,t,800,660,1100);flamesAt(g,t,theme);emberDrift(g,t,805,730,690,540,27);
   }else if(theme==='campfire'){
    smoke(g,t,800,681,1.1);relight(g,t,800,730,560);flamesAt(g,t,theme);emberDrift(g,t,800,712,100,345,29);
   }else if(theme==='fireflies')insects(g,t);
   else{
    g.save();g.beginPath();g.rect(557,452,270,187);g.clip();flamesAt(g,t,theme);emberDrift(g,t,685,620,130,160,12);g.restore();
    relight(g,t,700,630,430);snow(g,t);
    g.save();g.globalCompositeOperation='screen';for(const p of cache.get(theme).lights){const pulse=.2+.8*Math.pow(.5+.5*Math.sin(t*.9+p.phase),3);sprite(g,gold,p.x,p.y,8,pulse*.43)}g.restore();
   }
  });
 }
 window.TeacherTilesLivingScenes={names,prepare,paint,draw,ready:theme=>Boolean(cache.get(theme)?.ready)};
})();
