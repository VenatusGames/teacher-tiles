/* Draw decoration along the actual rounded edge, at the same scale in every preview. */
(() => {
  const NS='http://www.w3.org/2000/svg';
  const supported=new Set(['garden','confetti','starlight','stitched','checker','notebook','terrazzo']);
  function node(tag,attrs={}){const n=document.createElementNS(NS,tag);for(const [key,value] of Object.entries(attrs))n.setAttribute(key,value);return n;}
  function outline(w,h,r,inset){
    const x=inset,y=inset,right=w-inset,bottom=h-inset,rad=Math.max(0,r-inset);
    return `M ${x+rad} ${y} H ${right-rad} Q ${right} ${y} ${right} ${y+rad} V ${bottom-rad} Q ${right} ${bottom} ${right-rad} ${bottom} H ${x+rad} Q ${x} ${bottom} ${x} ${bottom-rad} V ${y+rad} Q ${x} ${y} ${x+rad} ${y} Z`;
  }
  // Sample the same rounded outline in memory; DOM geometry queries can force a
  // layout after every ornament is appended and make checker frames especially slow.
  function measureOutline(w,h,r,inset){
    const x=inset,y=inset,right=w-inset,bottom=h-inset,rad=Math.max(0,r-inset);
    const points=[{x:x+rad,y,length:0}];
    const add=(x,y)=>{const previous=points.at(-1);points.push({x,y,length:previous.length+Math.hypot(x-previous.x,y-previous.y)});};
    const curve=(cx,cy,x,y)=>{const start=points.at(-1);for(let i=1;i<=16;i++){const t=i/16,u=1-t;add(u*u*start.x+2*u*t*cx+t*t*x,u*u*start.y+2*u*t*cy+t*t*y);}};
    add(right-rad,y);curve(right,y,right,y+rad);
    add(right,bottom-rad);curve(right,bottom,right-rad,bottom);
    add(x+rad,bottom);curve(x,bottom,x,bottom-rad);
    add(x,y+rad);curve(x,y,x+rad,y);
    const length=points.at(-1).length;
    return {length,point(distance){
      const d=Math.max(0,Math.min(length,distance));let low=1,high=points.length-1;
      while(low<high){const middle=(low+high)>>1;if(points[middle].length<d)low=middle+1;else high=middle;}
      const a=points[low-1],b=points[low],t=(d-a.length)/(b.length-a.length||1);
      return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
    }};
  }
  // Bound the cache so resizing cannot retain unlimited artwork.
  const artworkCache=new Map();
  class FrameArt extends HTMLElement {
    connectedCallback(){
      this.observer=new ResizeObserver(()=>this.draw());this.observer.observe(this);
    }
    disconnectedCallback(){this.observer?.disconnect();this.observer=null;}
    draw(){
      const id=this.getAttribute('frame');if(!supported.has(id))return;
      const w=this.clientWidth,h=this.clientHeight;if(!w||!h)return;
      const r=Math.min(parseFloat(getComputedStyle(this.parentElement).borderTopLeftRadius)||16,w/2,h/2);
      const key=[id,w,h,r].join(':');if(this.drawn===key)return;this.drawn=key;
      if(artworkCache.has(key)){const cached=artworkCache.get(key);artworkCache.delete(key);artworkCache.set(key,cached);this.replaceChildren(cached.cloneNode(true));return;}
      const svg=node('svg',{width:w,height:h,viewBox:`0 0 ${w} ${h}`,'aria-hidden':'true',focusable:'false'});
      const base={garden:'#d5e4d0',confetti:'#fff0d9',starlight:'#283654',stitched:'#466d98',checker:'#f1eaf9',notebook:'#fff9e9',terrazzo:'#eee1d1'}[id];
      const path=node('path',{d:outline(w,h,r,5),fill:'none',stroke:base,'stroke-width':10});svg.append(path);
      const geometry=measureOutline(w,h,r,5),length=geometry.length;
      const commit=()=>{
        artworkCache.set(key,svg.cloneNode(true));
        if(artworkCache.size>64)artworkCache.delete(artworkCache.keys().next().value);
        this.replaceChildren(svg);
      };
      const line=(inset,color,width,attrs={})=>svg.append(node('path',{d:outline(w,h,r,inset),fill:'none',stroke:color,'stroke-width':width,...attrs}));
      if(id==='checker'){
        // Both rows use the same centerline stations so squares align on every edge.
        const count=Math.max(8,Math.round(length/10)*2);
        const point=(distance,offset)=>{
          const d=(distance+length)%length,p=geometry.point(d);
          const before=geometry.point((d-.1+length)%length),after=geometry.point((d+.1)%length);
          const angle=Math.atan2(after.y-before.y,after.x-before.x);
          return `${p.x-Math.sin(angle)*offset},${p.y+Math.cos(angle)*offset}`;
        };
        for(let i=0;i<count;i++){
          const outer=i%2?0:-5,inner=outer+5,points=[];
          for(let j=0;j<=4;j++)points.push(point((i+j/4)*length/count,outer));
          for(let j=4;j>=0;j--)points.push(point((i+j/4)*length/count,inner));
          svg.append(node('polygon',{points:points.join(' '),fill:'#9584bd'}));
        }
        commit();return;
      }
      if(id==='stitched'){
        line(1,'#345779',1);line(9,'#345779',1);
        line(3,'#f9e7bb',1.2,{'stroke-dasharray':'3 3','stroke-linecap':'round'});
        line(7,'#f9e7bb',1.2,{'stroke-dasharray':'3 3','stroke-linecap':'round'});
        commit();return;
      }
      if(id==='notebook'){
        for(const y of [2.5,5.5,8.5,h-2.5,h-5.5,h-8.5])svg.append(node('path',{d:`M ${r+2} ${y} H ${w-r-2}`,stroke:'#a6c6dd','stroke-width':.65}));
        for(let y=r+5;y<h-r-2;y+=9){
          svg.append(node('path',{d:`M 1 ${y} H 9 M ${w-9} ${y} H ${w-1}`,stroke:'#a6c6dd','stroke-width':.8}));
          svg.append(node('circle',{cx:3.5,cy:y-3,r:1.2,fill:'#c6baa5'}));
        }
        svg.append(node('path',{d:`M 7.5 ${r} V ${h-r}`,stroke:'#db8793','stroke-width':1}));commit();return;
      }
      if(id==='garden')line(5,'#86a87a',.8);
      if(id==='starlight'){line(.6,'#657697',.7);line(9.4,'#657697',.7);}
      const spacing={garden:21,confetti:10,starlight:18,terrazzo:9}[id];
      const count=Math.max(4,Math.round(length/spacing));
      for(let i=0;i<count;i++){
        const distance=(i+.5)*length/count,p=geometry.point(distance),next=geometry.point(Math.min(length,distance+.5));
        const angle=Math.atan2(next.y-p.y,next.x-p.x)*180/Math.PI;
        const g=node('g',{transform:`translate(${p.x} ${p.y}) rotate(${angle})`});svg.append(g);
        if(id==='garden'){
          g.append(node('ellipse',{cx:-6,cy:-1.4,rx:3.4,ry:1.4,fill:'#568264',transform:'rotate(25 -6 -1.4)'}));
          g.append(node('ellipse',{cx:6,cy:1.5,rx:3.4,ry:1.4,fill:'#769867',transform:'rotate(25 6 1.5)'}));
          for(let petal=0;petal<5;petal++)g.append(node('ellipse',{cx:0,cy:-2,rx:1.65,ry:2,fill:i%2?'#efb2c1':'#f9d9de',transform:`rotate(${petal*72})`}));
          g.append(node('circle',{r:1.25,fill:'#c59c47'}));
        }else if(id==='starlight'){
          const points=Array.from({length:10},(_,j)=>{const a=j*Math.PI/5-Math.PI/2,rad=j%2?1.6:3.6;return `${Math.cos(a)*rad},${Math.sin(a)*rad}`;}).join(' ');
          g.append(node('polygon',{points,fill:i%3?'#f4d68e':'#d6c8ee'}));
          g.append(node('circle',{cx:8,cy:1.8,r:.75,fill:'#e8e9fc'}));
        }else if(id==='confetti'){
          const color=['#df7b95','#6aa5b4','#e0ae51','#a28ac6'][i%4];
          if(i%3===0)g.append(node('circle',{cy:-1,r:1.65,fill:color}));
          else g.append(node('rect',{x:-2.5,y:-1.2,width:5,height:2.4,rx:.6,fill:color,transform:`rotate(${i%2?35:-35})`}));
        }else{
          const colors=['#ba7f6b','#829f91','#c4aa84','#7c8c9e','#d6ad9b'];
          const shapes=['-3,-2 1,-3 3,0 0,2 -2,1','-2,-3 2,-1 1,3 -3,2','-3,-1 0,-3 3,1 1,3'];
          g.append(node('polygon',{points:shapes[i%3],fill:colors[i%5],transform:`translate(0 ${i%2?.6:-.6})`}));
          g.append(node('circle',{cx:4,cy:-2,r:.65,fill:'#9c8c7c'}));
        }
      }
      commit();
    }
  }
  customElements.define('tt-profile-frame-art',FrameArt);
})();
