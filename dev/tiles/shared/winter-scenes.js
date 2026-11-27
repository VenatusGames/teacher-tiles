/* Original winter artwork with lightweight, aligned animation overlays. */
(()=>{'use strict';
const tau=Math.PI*2,rand=i=>{const n=Math.sin(i*127.1+311.7)*43758.5453;return n-Math.floor(n)},art=new Map();
function prepare(id){const kind=id.startsWith('frosted-')?'frosted':id;if(!['menorah-window','outdoor-christmas-tree','frosted'].includes(kind))return Promise.resolve();if(!art.has(kind)){const image=new Image();const ready=new Promise(resolve=>{image.onload=()=>resolve();image.onerror=()=>resolve()});art.set(kind,{image,ready});image.src='assets/themes/winter/'+kind+'.webp?v=20261127-art'}return art.get(kind).ready}
function placement(w,h,image){const scale=Math.max(w/image.naturalWidth,h/image.naturalHeight);return {scale,x:(w-image.naturalWidth*scale)/2,y:(h-image.naturalHeight*scale)/2}}
function circle(g,x,y,r,color){g.fillStyle=color;g.beginPath();g.arc(x,y,r,0,tau);g.fill()}
function star(g,x,y,r,color){g.fillStyle=color;g.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r*.43:r;g.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr)}g.closePath();g.fill()}
function paint(g,w,h,v){g.save();g.fillStyle=v.bg;g.fillRect(0,0,w,h);const image=art.get(v.kind)?.image;if(image?.naturalWidth){const p=placement(w,h,image);if(v.kind==='frosted')g.filter=v.id.endsWith('-rose')?'hue-rotate(115deg) saturate(.65)':v.id.endsWith('-lilac')?'hue-rotate(45deg) saturate(.6)':'none';g.drawImage(image,p.x,p.y,image.naturalWidth*p.scale,image.naturalHeight*p.scale)}g.restore()}
// Branches grow lengthwise from the border; opacity stays strong as they advance.
function frost(g,w,h,color='#f4fcff',progress=1){
 const grow=Math.max(0,Math.min(1,progress));if(!grow)return;g.save();g.lineCap='round';
 const reach=Math.min(w,h)*.43*grow;
 for(let edge=0;edge<4;edge++){const vertical=edge<2,span=vertical?w:h,start=edge%2?span:0,end=edge%2?span-reach:reach;const haze=vertical?g.createLinearGradient(start,0,end,0):g.createLinearGradient(0,start,0,end);haze.addColorStop(0,'#eefaffed');haze.addColorStop(.4,'#cae9f6b5');haze.addColorStop(1,'#c6eaff00');g.fillStyle=haze;g.fillRect(vertical?Math.min(start,end):0,vertical?0:Math.min(start,end),vertical?reach:w,vertical?h:reach)}
 for(let i=0;i<64;i++){
  const edge=i%4,x=edge===0?0:edge===1?w:rand(i+10)*w,y=edge===2?0:edge===3?h:rand(i+80)*h,len=Math.min(w,h)*(.21+rand(i+30)*.29),a=(edge===0?0:edge===1?Math.PI:edge===2?Math.PI/2:-Math.PI/2)+(rand(i+60)-.5)*1.1;
  const local=Math.max(0,Math.min(1,(grow-rand(i+150)*.16)/.84));if(!local)continue;
  g.save();g.translate(x,y);g.rotate(a);g.beginPath();g.rect(-2,-len*.5,len*local+2,len);g.clip();g.strokeStyle='#7bbcd2b0';g.lineWidth=Math.max(2.4,Math.min(w,h)/120);g.beginPath();g.moveTo(0,1);g.lineTo(len,1);g.stroke();g.strokeStyle=color;g.lineWidth=Math.max(1.2,Math.min(w,h)/260);g.beginPath();g.moveTo(0,0);g.lineTo(len,0);
  for(let j=1;j<18;j++){const bx=len*j/18,b=len*.27*(1-j/20);for(const dir of [-1,1]){g.moveTo(bx,0);g.lineTo(bx-b,b*dir);for(let k=1;k<5;k++){const q=k/5,cx=bx-b*q,cy=b*q*dir,l=b*.24*(1-q*.6);g.moveTo(cx,cy);g.lineTo(cx-l,cy);g.moveTo(cx,cy);g.lineTo(cx-l*.2,cy+l*dir)}}}g.stroke();g.restore();
 }g.restore();
}
function snow(g,w,h,t,count=100,opacity=1){for(let i=0;i<count;i++){const depth=.4+rand(i+11)*.6,y=(rand(i+30)*(h+20)+t*(10+depth*22))%(h+20)-10,x=(rand(i+90)*w+Math.sin(t*.17+i)*25+w)%w;g.globalAlpha=opacity*(.3+depth*.55);circle(g,x,y,(1+rand(i+70)*2.4)*Math.max(.5,Math.min(w/1100,h/700)),'#fff')}g.globalAlpha=1}
const treeLights=[[835,119],[827,205],[775,232],[830,302],[866,299],[750,337],[773,377],[814,405],[757,452],[821,498],[887,516],[982,483],[676,546],[744,601],[868,635],[922,658],[817,682],[681,690],[629,738],[754,765],[909,768],[986,752],[1090,733],[776,848]];
function halo(g,x,y,r,opacity){const light=g.createRadialGradient(x,y,0,x,y,r);light.addColorStop(0,'#fff0a9');light.addColorStop(.2,'#ffd17a99');light.addColorStop(1,'#ffb95100');g.globalAlpha=opacity;g.fillStyle=light;g.fillRect(x-r,y-r,r*2,r*2)}
function draw(g,w,h,v,t){g.save();
 if(v.kind==='falling-snow'){snow(g,w,h,t,110);for(let i=0;i<15;i++){const x=rand(i+15)*w+Math.sin(t*.1+i)*15,y=(rand(i+80)*(h+30)+t*(9+rand(i)*8))%(h+30)-15,r=3+rand(i+25)*4;g.save();g.translate(x,y);g.rotate(t*.05+i);g.globalAlpha=.4;g.strokeStyle='#fff';g.lineWidth=.8;for(let j=0;j<3;j++){const a=j*Math.PI/3;g.beginPath();g.moveTo(Math.cos(a)*r,Math.sin(a)*r);g.lineTo(-Math.cos(a)*r,-Math.sin(a)*r);g.stroke()}g.restore()}}
 const image=art.get(v.kind)?.image;
 if(image?.naturalWidth){const p=placement(w,h,image);g.translate(p.x,p.y);g.scale(p.scale,p.scale);
  if(v.kind==='outdoor-christmas-tree'){snow(g,1672,941,t,120);g.globalCompositeOperation='screen';treeLights.forEach(([x,y],i)=>{const pulse=Math.pow(.5+.5*Math.sin(t*1.15+i*2.3),4);halo(g,x,y,13+9*pulse,.12+.65*pulse);if(pulse>.9){g.globalAlpha=(pulse-.9)*4;star(g,x,y,7,'#fff3be')}});halo(g,835,58,47,.15+.1*Math.sin(t*.8))}
  if(v.kind==='menorah-window'){
   // Restrict snowfall to the distant glass above the candles and inside each mullion.
   g.save();g.beginPath();for(const [x,y,rw,rh]of [[185,0,194,106],[403,0,850,106],[1284,0,209,106],[185,147,194,211],[403,147,850,195],[1284,147,209,211]])g.rect(x,y,rw,rh);g.clip();g.globalAlpha=.24;snow(g,1672,941,t*.65,65,.24);g.restore();
   const flames=[[620,444],[671,444],[722,444],[773,444],[834,389],[898,444],[947,444],[997,444],[1047,444]];
   flames.forEach(([x,y],i)=>{const pulse=.55+.12*Math.sin(t*5.5+i)+.06*Math.sin(t*8.1-i);g.save();g.globalCompositeOperation='screen';halo(g,x,y-14,37,pulse*.5);g.globalAlpha=.7;const sway=Math.sin(t*3.5+i)*1.8;g.fillStyle='#ffe8a6';g.beginPath();g.moveTo(x,y);g.bezierCurveTo(x-5,y-9,x-3,y-20,x+sway,y-28-pulse*3);g.bezierCurveTo(x+5,y-15,x+5,y-4,x,y);g.fill();g.restore()});
  }
 }g.restore();}
window.TeacherTilesWinterScenes={prepare,paint,draw,frost};})();
