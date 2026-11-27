/* Original winter artwork with lightweight, aligned animation overlays. */
(()=>{'use strict';
const tau=Math.PI*2,rand=i=>{const n=Math.sin(i*127.1+311.7)*43758.5453;return n-Math.floor(n)},art=new Map();
function load(name){if(!art.has(name)){const image=new Image();const ready=new Promise(resolve=>{image.onload=()=>resolve();image.onerror=()=>resolve()});art.set(name,{image,ready});image.src='assets/themes/winter/'+name+'.webp?v=20261127-layers'}return art.get(name).ready}
function prepare(id){if(id==='outdoor-christmas-tree')return Promise.all(['outdoor-forest','outdoor-tree-layer'].map(load));if(id.startsWith('menorah-window'))return load(id);if(id.startsWith('frosted-'))return load('frosted');return Promise.resolve()}
function sceneImage(v){return art.get(v.kind==='outdoor-christmas-tree'?'outdoor-forest':v.kind==='menorah-window'?v.id:v.kind)?.image}
function placement(w,h,image){const scale=Math.max(w/image.naturalWidth,h/image.naturalHeight);return {scale,x:(w-image.naturalWidth*scale)/2,y:(h-image.naturalHeight*scale)/2}}
function circle(g,x,y,r,color){g.fillStyle=color;g.beginPath();g.arc(x,y,r,0,tau);g.fill()}
function star(g,x,y,r,color){g.fillStyle=color;g.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r*.43:r;g.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr)}g.closePath();g.fill()}
function paint(g,w,h,v){g.save();g.fillStyle=v.bg;g.fillRect(0,0,w,h);const image=sceneImage(v);if(image?.naturalWidth){const p=placement(w,h,image);if(v.kind==='frosted')g.filter=v.id.endsWith('-rose')?'hue-rotate(115deg) saturate(.65)':v.id.endsWith('-lilac')?'hue-rotate(45deg) saturate(.6)':'none';g.drawImage(image,p.x,p.y,image.naturalWidth*p.scale,image.naturalHeight*p.scale)}g.restore()}
// Uneven pockets of icy condensation advance at different speeds each time.
function frost(g,w,h,color='#f4fcff',progress=1,seed=0){
 const grow=Math.max(0,Math.min(1,progress));if(!grow)return;g.save();const opacity=g.globalAlpha,short=Math.min(w,h);
 for(let i=0;i<58;i++){
  const n=seed+i*17.3,edge=Math.floor(rand(n+7)*4),delay=rand(n+3)*.38,p=Math.max(0,Math.min(1,(grow-delay)/(1-delay)));if(!p)continue;
  const u=rand(n+41),travel=short*(.05+rand(n+21)*.19)*p,r=short*(.19+rand(n+31)*.26)*Math.sqrt(p);
  const x=edge===0?travel:edge===1?w-travel:u*w,y=edge===2?travel:edge===3?h-travel:u*h;
  const cloud=g.createRadialGradient(x,y,0,x,y,r);cloud.addColorStop(0,i%3?'#f5fcffe8':'#b9dfedbd');cloud.addColorStop(.4,'#e3f6ffb5');cloud.addColorStop(.78,'#d6eefc40');cloud.addColorStop(1,'#dcf5ff00');g.globalAlpha=opacity*(.65+.35*p);g.fillStyle=cloud;g.fillRect(x-r,y-r,r*2,r*2);
 }
 // Fine frozen moisture, deliberately without branching/tree-shaped veins.
 g.fillStyle=color;for(let i=0;i<450;i++){const n=seed+i*5.13,x=rand(n+9)*w,y=rand(n+49)*h,edge=Math.min(x,w-x,y,h-y)/short,arrival=edge*2.8+rand(n+74)*.4;if(grow<=arrival)continue;g.globalAlpha=opacity*Math.min(.38,(grow-arrival)*.7);circle(g,x,y,.35+rand(n+91)*.65,color)}g.restore();
}
const flakePath=new Path2D();for(let j=0;j<6;j++){const a=j*Math.PI/3,c=Math.cos(a),s=Math.sin(a);flakePath.moveTo(0,0);flakePath.lineTo(c,s);for(const q of [.48,.72])for(const side of [-1,1]){const b=a+side*Math.PI/3;flakePath.moveTo(c*q,s*q);flakePath.lineTo(c*q-Math.cos(b)*.22,s*q-Math.sin(b)*.22)}}
function snowflakes(g,w,h,t){const count=Math.max(125,Math.min(320,Math.round(w*h/4200))),scale=Math.max(.6,Math.min(w/1100,h/700));for(let i=0;i<count;i++){const depth=rand(i+81),r=(3.4+depth*5.7)*scale,x=(rand(i+19)*w+Math.sin(t*.16+i)*22+w)%w,y=(rand(i+72)*(h+35)+t*(10+depth*24))%(h+35)-17;g.save();g.translate(x,y);g.rotate(t*(.07+depth*.08)+i);g.scale(r,r);g.lineWidth=(.65+depth*.35)/r;g.strokeStyle='#fff';g.globalAlpha=.35+depth*.6;g.stroke(flakePath);g.restore()}snow(g,w,h,t,18,.4)}
function treeSway(y,t){const bend=Math.pow(Math.max(0,1-y/882),1.35);return bend*(Math.sin(t*.65)*19+Math.sin(t*1.1+.6)*3)}
function snow(g,w,h,t,count=100,opacity=1){for(let i=0;i<count;i++){const depth=.4+rand(i+11)*.6,y=(rand(i+30)*(h+20)+t*(10+depth*22))%(h+20)-10,x=(rand(i+90)*w+Math.sin(t*.17+i)*25+w)%w;g.globalAlpha=opacity*(.3+depth*.55);circle(g,x,y,(1+rand(i+70)*2.4)*Math.max(.5,Math.min(w/1100,h/700)),'#fff')}g.globalAlpha=1}
const treeLights=[[835,119],[827,205],[775,232],[830,302],[866,299],[750,337],[773,377],[814,405],[757,452],[821,498],[887,516],[982,483],[676,546],[744,601],[868,635],[922,658],[817,682],[681,690],[629,738],[754,765],[909,768],[986,752],[1090,733],[776,848]];
function halo(g,x,y,r,opacity){const light=g.createRadialGradient(x,y,0,x,y,r);light.addColorStop(0,'#fff0a9');light.addColorStop(.2,'#ffd17a99');light.addColorStop(1,'#ffb95100');g.globalAlpha=opacity;g.fillStyle=light;g.fillRect(x-r,y-r,r*2,r*2)}
function draw(g,w,h,v,t){g.save();
 if(v.kind==='falling-snow')snowflakes(g,w,h,t);
 const image=sceneImage(v);
 if(image?.naturalWidth){const p=placement(w,h,image);g.translate(p.x,p.y);g.scale(p.scale,p.scale);
  if(v.kind==='outdoor-christmas-tree'){
   const tree=art.get('outdoor-tree-layer')?.image;if(tree?.naturalWidth){
    g.save();g.translate(835,868);g.scale(1,.13);const shadow=g.createRadialGradient(0,0,20,0,0,360);shadow.addColorStop(0,'#102236aa');shadow.addColorStop(.55,'#142c4266');shadow.addColorStop(1,'#10223600');g.fillStyle=shadow;g.fillRect(-360,-360,720,720);g.globalCompositeOperation='screen';const ground=g.createRadialGradient(0,0,5,0,0,340);ground.addColorStop(0,'#ffd79265');ground.addColorStop(.5,'#ffc56635');ground.addColorStop(1,'#ffc56600');g.fillStyle=ground;g.fillRect(-340,-340,680,680);g.restore();
    // Horizontal strips bend the branches progressively; the base stays rooted.
    for(let y=0;y<941;y+=7){const height=Math.min(7,941-y);g.drawImage(tree,0,y*tree.naturalHeight/941,tree.naturalWidth,height*tree.naturalHeight/941,treeSway(y,t),y,1672,height+.35)}
   }
   g.save();g.globalCompositeOperation='screen';treeLights.forEach(([baseX,y],i)=>{const x=baseX+treeSway(y,t),pulse=Math.pow(.5+.5*Math.sin(t*1.7+i*2.3),3);halo(g,x,y,15+14*pulse,.18+.7*pulse);if(pulse>.62){g.globalAlpha=(pulse-.62)*1.8;g.strokeStyle='#fff6ce';g.lineWidth=1.1;const r=5+pulse*8;g.beginPath();g.moveTo(x-r,y);g.lineTo(x+r,y);g.moveTo(x,y-r);g.lineTo(x,y+r);g.stroke()}});halo(g,835+treeSway(58,t),58,58,.3+.18*Math.sin(t*1.2));g.restore();snow(g,1672,941,t,140,.8);
  }
  if(v.kind==='menorah-window'){
   // Restrict snowfall to the distant glass above the candles and inside each mullion.
   g.save();g.beginPath();for(const [x,y,rw,rh]of [[185,0,194,106],[403,0,850,106],[1284,0,209,106],[185,147,194,211],[403,147,850,195],[1284,147,209,211]])g.rect(x,y,rw,rh);g.clip();g.globalAlpha=.24;snow(g,1672,941,t*.65,65,.24);g.restore();
   const flames=[[620,444],[671,444],[722,444],[773,444],[834,389],[898,444],[947,444],[997,444],[1047,444]];
   flames.forEach(([x,y],i)=>{const pulse=.55+.12*Math.sin(t*5.5+i)+.06*Math.sin(t*8.1-i);g.save();g.globalCompositeOperation='screen';halo(g,x,y-14,37,pulse*.5);g.globalAlpha=.7;const sway=Math.sin(t*3.5+i)*1.8;g.fillStyle='#ffe8a6';g.beginPath();g.moveTo(x,y);g.bezierCurveTo(x-5,y-9,x-3,y-20,x+sway,y-28-pulse*3);g.bezierCurveTo(x+5,y-15,x+5,y-4,x,y);g.fill();g.restore()});
  }
 }g.restore();}
window.TeacherTilesWinterScenes={prepare,paint,draw,frost,treeSway};})();
