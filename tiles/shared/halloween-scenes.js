/* Halloween scenery shares the board animation lifecycle and caches its artwork. */
(()=>{'use strict';
  const W=1600,H=900,TAU=Math.PI*2,assets=new Map();
  const random=n=>{const x=Math.sin(n*127.1+83.9)*43758.54;return x-Math.floor(x)};
  let forest=null,forestTried=false;
  function prepare(theme){
    if(assets.has(theme))return assets.get(theme).promise;
    const image=new Image(),entry={image,ready:false};assets.set(theme,entry);
    image.src=theme==='webbed'?'assets/themes/webbed.svg':'assets/themes/haunted-house.webp';
    entry.promise=image.decode().then(()=>{entry.ready=true}).catch(()=>{});
    return entry.promise;
  }
  function frame(g,w,h,paint){g.save();const s=Math.max(w/W,h/H);g.translate((w-W*s)/2,(h-H*s)/2);g.scale(s,s);paint();g.restore()}
  function paint(g,w,h,theme){g.fillStyle=theme==='webbed'?'#0b0d13':'#171c36';g.fillRect(0,0,w,h);const entry=assets.get(theme);if(entry?.ready)frame(g,w,h,()=>g.drawImage(entry.image,0,0,W,H))}
  function spider(g,x,y,size,t,angle=0){
    g.save();g.translate(x,y);g.rotate(angle);g.scale(size,size);
    g.lineCap='round';g.strokeStyle='#a4a6b2';g.lineWidth=.65;
    for(const side of [-1,1])for(let j=0;j<4;j++){
      const gait=Math.sin(t*4+j*1.9+side)*2.3,yy=-6+j*3.4;
      g.beginPath();g.moveTo(side*3,yy);g.lineTo(side*(9+j*.65),yy-5+gait);g.lineTo(side*(15-j*.7),yy+4+gait);g.stroke();
    }
    const sheen=g.createRadialGradient(-2,1,.2,0,3,8);sheen.addColorStop(0,'#565568');sheen.addColorStop(.35,'#252532');sheen.addColorStop(1,'#07080c');
    g.fillStyle=sheen;g.beginPath();g.ellipse(0,4,5.8,8,0,0,TAU);g.fill();g.strokeStyle='#7c7e9140';g.stroke();g.fillStyle='#161721';g.beginPath();g.ellipse(0,-5,3.8,4.5,0,0,TAU);g.fill();g.restore();
  }
  function webs(g,t){
    const corners=[[0,0,420,.48],[1600,0,355,.72],[0,900,290,.85],[1600,900,375,.54]];
    for(let i=0;i<corners.length;i++){
      const [cx,cy,range,a]=corners[i],r=range*(.55+.30*Math.sin(t*.075+i*2.1)),x=cx+Math.cos(a)*r*(cx?-1:1),y=cy+Math.sin(a)*r*(cy?-1:1);
      spider(g,x,y,.9+i*.11,t+i,Math.atan2(y-cy,x-cx)+Math.PI/2);
    }
    for(let i=0;i<2;i++){
      const x=575+i*470+Math.sin(t*.2+i)*9,y=80+(.5+.5*Math.sin(t*.15+i*2))*165;
      g.strokeStyle='#b9bcd147';g.lineWidth=.65;g.beginPath();g.moveTo(575+i*470,0);g.lineTo(x,y-10);g.stroke();spider(g,x,y,.9,t*.35,Math.sin(t*.2)*.08+Math.PI);
    }
  }
  // Soft irregular cloud banks are cached, then drift completely on and off screen.
  const cloud=document.createElement('canvas');cloud.width=900;cloud.height=360;
  const cg=cloud.getContext('2d');
  for(let i=0;i<65;i++){
    const x=90+random(i+7)*720,y=180+(random(i+61)-.5)*80,r=35+random(i+111)*65;
    const grad=cg.createRadialGradient(x,y,0,x,y,r);grad.addColorStop(0,'#bfc1dd24');grad.addColorStop(.5,'#969dc619');grad.addColorStop(1,'#69769b00');cg.fillStyle=grad;cg.fillRect(x-r,y-r,r*2,r*2);
  }
  function haunted(g,t){
    const entry=assets.get('haunted-house');
    if(entry?.ready){
      if(!forestTried){forestTried=true;forest=window.TeacherTilesForestMotion?.()}
      const moving=forest?.draw(entry.image,t,'haunted-house');if(moving)g.drawImage(moving,0,0,W,H);
    }
    g.save();g.globalCompositeOperation='screen';
    for(let i=0;i<4;i++){
      const width=850+i*90,span=W+width+120,progress=(t*(25+i*4)+i*span/4)%span;
      const x=i%2?W+60-progress:progress-width-60,y=5+i*55+Math.sin(t*.08+i)*8;
      g.globalAlpha=.85+i*.14;g.drawImage(cloud,x,y,width,180+i*10);
    }
    g.globalAlpha=.16;g.drawImage(cloud,((t*8+700)%2400)-800,550,1250,190);g.restore();
    for(let i=0;i<10;i++){
      const p=(t*(.006+random(i+81)*.004)+random(i+2))%1,x=p*(W+160)-80,y=160+random(i+25)*240+Math.sin(t*.6+i*3.7)*24,s=.75+random(i+41)*1.1;
      g.save();g.translate(x,y);g.rotate(Math.sin(t*.65+i)*.16);g.scale(s,s);
      const flap=Math.sin(t*(6+random(i)*2)+i)*.7;
      g.fillStyle='#202337';g.beginPath();g.moveTo(0,-.4);
      for(const d of [-1,1]){g.lineTo(d*.4,-1);g.quadraticCurveTo(d*1.6,-1.6-flap,d*3.2,-2.1-flap*2);g.quadraticCurveTo(d*2.7,.3,d*2.1,-.2);g.quadraticCurveTo(d*1.6,.9,d*1.1,.3);g.quadraticCurveTo(d*.6,1.3,0,.8)}g.closePath();g.fill();g.beginPath();g.ellipse(0,0,.38,.9,0,0,TAU);g.fill();g.restore();
    }
  }
  window.TeacherTilesHalloweenScenes={themes:['webbed','haunted-house'],prepare,paint,ready:theme=>Boolean(assets.get(theme)?.ready),draw(g,w,h,theme,t){frame(g,w,h,()=>theme==='webbed'?webs(g,t):haunted(g,t))}};
})();
