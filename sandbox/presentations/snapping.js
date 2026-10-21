(()=>{'use strict';
 const key='teacherTiles.presentationSnapping';let enabled=true;try{enabled=localStorage.getItem(key)!=='off';}catch{}
 const box=o=>{const a=(o.rotation||0)*Math.PI/180,w=Math.abs(o.w*Math.cos(a))+Math.abs(o.h*Math.sin(a)),h=Math.abs(o.w*Math.sin(a))+Math.abs(o.h*Math.cos(a));return {x:o.x+(o.w-w)/2,y:o.y+(o.h-h)/2,w,h};};
 function clear(canvas){canvas.querySelector(':scope > .pres-snap-guides')?.remove();}
 function move(canvas,objects,others,dx,dy,{axis=null}={}){
  clear(canvas);if(!enabled||!objects.length)return {dx,dy};
  const boxes=objects.map(box),left=Math.min(...boxes.map(b=>b.x)),top=Math.min(...boxes.map(b=>b.y)),right=Math.max(...boxes.map(b=>b.x+b.w)),bottom=Math.max(...boxes.map(b=>b.y+b.h));
  const moving={x:left+dx,y:top+dy,w:right-left,h:bottom-top},targets=others.map(box),threshold=6/(canvas.getBoundingClientRect().width/960||1),guides=[];
  for(const dim of ['x','y']){
   if(axis&&axis!==dim)continue;
   const size=dim==='x'?'w':'h',cross=dim==='x'?'y':'x',crossSize=dim==='x'?'h':'w',extent=dim==='x'?960:540;
   let best=null;
   const offer=(delta,guide)=>{if(Math.abs(delta)<=threshold&&(!best||Math.abs(delta)<Math.abs(best.delta)))best={delta,guide};};
   const anchors=[moving[dim],moving[dim]+moving[size]/2,moving[dim]+moving[size]];
   for(const target of [0,extent/2,extent])for(const from of anchors)offer(target-from,{dim,pos:target});
   for(const b of targets)for(const target of [b[dim],b[dim]+b[size]/2,b[dim]+b[size]])for(const from of anchors)offer(target-from,{dim,pos:target});
   const aligned=targets.filter(b=>b[cross]<moving[cross]+moving[crossSize]&&b[cross]+b[crossSize]>moving[cross]).sort((a,b)=>a[dim]-b[dim]);
   const before=aligned.filter(b=>b[dim]+b[size]<=moving[dim]+threshold).at(-1),after=aligned.find(b=>b[dim]>=moving[dim]+moving[size]-threshold);
   if(before&&after){const gap=(after[dim]-before[dim]-before[size]-moving[size])/2;if(gap>=0)offer(before[dim]+before[size]+gap-moving[dim],{dim,gap,before:before[dim]+before[size],after:after[dim],cross:moving[cross]+moving[crossSize]/2,size:moving[size]});}
   // Continue an existing spacing rhythm when dragging after/before a row or column.
   for(let i=1;i<aligned.length;i++){const a=aligned[i-1],b=aligned[i],gap=b[dim]-a[dim]-a[size];if(gap<0)continue;
    for(const pos of [b[dim]+b[size]+gap,a[dim]-gap-moving[size]])offer(pos-moving[dim],{dim,gap,before:pos< a[dim]?pos+moving[size]:b[dim]+b[size],after:pos<a[dim]?a[dim]:pos,cross:moving[cross]+moving[crossSize]/2,single:true});
   }
   if(best){moving[dim]+=best.delta;if(dim==='x')dx+=best.delta;else dy+=best.delta;guides.push(best.guide);}
  }
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.classList.add('pres-snap-guides');svg.setAttribute('viewBox','0 0 960 540');svg.setAttribute('aria-hidden','true');
  const line=(x1,y1,x2,y2)=>{const n=document.createElementNS(ns,'line');for(const [k,v]of Object.entries({x1,y1,x2,y2}))n.setAttribute(k,v);svg.append(n);};
  for(const g of guides){if(g.gap===undefined){g.dim==='x'?line(g.pos,0,g.pos,540):line(0,g.pos,960,g.pos);continue;}
   const measure=(a,b)=>{if(g.dim==='x'){line(a,g.cross,b,g.cross);line(a,g.cross-4,a,g.cross+4);line(b,g.cross-4,b,g.cross+4);}else{line(g.cross,a,g.cross,b);line(g.cross-4,a,g.cross+4,a);line(g.cross-4,b,g.cross+4,b);}const text=document.createElementNS(ns,'text');text.setAttribute('x',g.dim==='x'?(a+b)/2:g.cross+8);text.setAttribute('y',g.dim==='x'?g.cross-7:(a+b)/2);text.textContent=Math.round(g.gap);svg.append(text);};
   if(g.single)measure(g.before,g.after);else{measure(g.before,g.before+g.gap);measure(g.after-g.gap,g.after);}
  }
  if(guides.length)canvas.append(svg);return {dx,dy};
 }
 window.TeacherTilesPresentationSnapping={get enabled(){return enabled;},set(value){enabled=!!value;try{localStorage.setItem(key,enabled?'on':'off');}catch{}},move,clear};
})();
