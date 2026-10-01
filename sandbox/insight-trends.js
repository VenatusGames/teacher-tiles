const NS = 'http://www.w3.org/2000/svg';
const number = value => Number(value).toLocaleString();
const stamp = at => new Date(at).toLocaleString(undefined, {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
const node = (tag, className, text) => { const el=document.createElement(tag);el.className=className;if(text!==undefined)el.textContent=text;return el; };
const svgNode = (tag, attrs, text) => { const el=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([key,value])=>el.setAttribute(key,String(value)));if(text!==undefined)el.textContent=text;return el; };

export function createTrendCharts(root) {
 root.innerHTML=`<header class="trend-heading"><div><h2>User Analytics</h2><p>Your recorded online users and memberships.</p></div><div class="trend-controls"><div class="portal-segments" role="group" aria-label="Analytics time range"><button type="button" data-range="1" aria-pressed="false">24 Hours</button><button type="button" data-range="7" aria-pressed="true">7 Days</button><button type="button" data-range="30" aria-pressed="false">30 Days</button></div><div class="portal-segments" role="group" aria-label="Analytics chart style"><button type="button" data-style="bar" aria-pressed="false">Bars</button><button type="button" data-style="line" aria-pressed="true">Line</button></div></div></header><div class="trend-grid"></div><p class="trend-footnote">Snapshots are recorded on refresh, at most once every 15 minutes. Gaps mean no recorded observation, not zero users.</p>`;
 const grid=root.querySelector('.trend-grid');
 let points=[],asOf=Date.now(),loaded=false,days=7,style='line';
 function render() {
  grid.replaceChildren();
  const start=asOf-days*86400000,visible=points.filter(p=>p.at>=start&&p.at<=asOf);
  for(const [key,title,description] of [['online','Online Users','Active in the last 6 minutes at each snapshot'],['subscribers','Subscribers','Active subscriptions · dev previews excluded']]) {
   const card=node('article','trend-card trend-'+key);
   const head=node('div','trend-card-heading'),copy=node('div','');copy.append(node('h3','',title),node('p','',description));
   const summary=node('div','trend-summary');summary.append(node('strong','',visible.length?number(visible.at(-1)[key]):'—'),node('span','','Latest snapshot'));head.append(copy,summary);card.append(head);
   const plot=node('div','trend-plot'),tooltip=node('div','trend-tooltip');tooltip.hidden=true;tooltip.setAttribute('role','tooltip');
   const show=(element,point)=>{tooltip.replaceChildren(node('strong','',`${number(point[key])} ${title.toLowerCase()}`),node('span','',stamp(point.at)));tooltip.hidden=false;const a=element.getBoundingClientRect(),b=plot.getBoundingClientRect();tooltip.style.left=Math.max(95,Math.min(b.width-95,a.left-b.left+a.width/2))+'px';};
   const bind=(element,point)=>{element.addEventListener('pointerenter',()=>show(element,point));element.addEventListener('pointerleave',()=>tooltip.hidden=true);element.addEventListener('focus',()=>show(element,point));element.addEventListener('blur',()=>tooltip.hidden=true);element.addEventListener('keydown',e=>{if(e.key==='Escape')tooltip.hidden=true;});};
   if(style==='bar') {
    const count=days===1?24:days,step=(asOf-start)/count,buckets=Array(count).fill(null);
    // Counts are snapshots, not totals: show the latest observation in each interval.
    for(const point of visible)buckets[Math.min(count-1,Math.floor((point.at-start)/step))]=point;
    const max=Math.max(1,...buckets.filter(Boolean).map(p=>p[key]));
    const bars=node('div','portal-chart-bars');bars.setAttribute('aria-label',`${title}: latest snapshot in each ${days===1?'hour':'24-hour interval'}`);
    buckets.forEach((point,i)=>{
     const column=node('div','portal-bar-column'),track=node('button','portal-bar-track');track.type='button';
     const at=start+step*(i+1),date=new Date(at),label=date.toLocaleDateString(undefined,{month:'short',day:'numeric'});
     track.setAttribute('aria-label',point?`${stamp(point.at)}: ${number(point[key])} ${title.toLowerCase()}`:`${stamp(at)}: no observation`);
     if(point){const fill=node('i','trend-bar');fill.style.height=(point[key]/max*100)+'%';fill.style.animationDelay=Math.min(i*25,350)+'ms';if(!point[key])fill.classList.add('is-zero');track.append(fill);bind(track,point);}
     else {track.classList.add('is-missing');track.title='No observation';track.append(node('span','','—'));}
     const short=days===1?date.toLocaleTimeString(undefined,{hour:'numeric'}):days===7?date.toLocaleDateString(undefined,{weekday:'short'}):String(date.getDate());
     const tick=node('span','portal-bar-label',(days===1&&i%6!==0&&i!==count-1)||(days===30&&i%5!==0&&i!==count-1)?'':short);tick.title=label;
     column.append(track,tick);bars.append(column);
    });
    plot.append(bars);
   } else {
    const svg=svgNode('svg',{viewBox:'0 0 500 235',role:'img','aria-label':`${title}: recorded counts over the last ${days} days`});
    const left=42,right=482,top=18,bottom=190,max=Math.max(4,...visible.map(p=>p[key])),ceiling=Math.ceil(max/4)*4;
    const x=at=>left+(right-left)*(at-start)/(asOf-start),y=value=>bottom-(bottom-top)*value/ceiling;
    for(let i=0;i<=2;i++){const pos=bottom-(bottom-top)*i/2;svg.append(svgNode('line',{x1:left,x2:right,y1:pos,y2:pos,class:'trend-gridline'}),svgNode('text',{x:30,y:pos+5,'text-anchor':'end',class:'trend-axis'},number(ceiling*i/2)));}
    if(visible.length>1){
     const path=visible.map((p,i)=>`${i?'L':'M'}${x(p.at)},${y(p[key])}`).join(' '),defs=svgNode('defs',{}),gradient=svgNode('linearGradient',{id:'portal-area-'+key,x1:0,y1:0,x2:0,y2:1});
     gradient.append(svgNode('stop',{offset:'0%','stop-color':'var(--series)','stop-opacity':'.18'}),svgNode('stop',{offset:'100%','stop-color':'var(--series)','stop-opacity':'.015'}));defs.append(gradient);svg.append(defs,svgNode('path',{d:path+` L${x(visible.at(-1).at)},${bottom} L${x(visible[0].at)},${bottom} Z`,fill:`url(#portal-area-${key})`,class:'trend-area'}),svgNode('path',{d:path,fill:'none',class:'trend-line',pathLength:1}));
    }
    visible.forEach((point,i)=>{const dot=svgNode('circle',{cx:x(point.at),cy:y(point[key]),r:visible.length>70?2:4,class:'trend-mark',tabindex:(i===visible.length-1||i%Math.max(1,Math.ceil(visible.length/12))===0)?0:-1,'aria-label':`${stamp(point.at)}: ${number(point[key])}`});bind(dot,point);svg.append(dot);});
    for(const [at,anchor] of [[start,'start'],[start+(asOf-start)/2,'middle'],[asOf,'end']])svg.append(svgNode('text',{x:x(at),y:222,'text-anchor':anchor,class:'trend-axis'},new Date(at).toLocaleString(undefined,days===1?{hour:'numeric',minute:'2-digit'}:{month:'short',day:'numeric'})));
    plot.append(svg);
   }
   if(!visible.length){const empty=node('div','trend-empty');empty.append(node('strong','',loaded?'No observations yet':'Loading analytics'),node('span','',loaded?'Try another time range.':'Your recorded snapshots will appear here.'));plot.append(empty);}
   plot.append(tooltip);card.append(plot);
   const footer=node('div','trend-card-footer'),difference=visible.length>1?visible.at(-1)[key]-visible[0][key]:null;
   footer.append(node('span','trend-change',difference===null?(visible.length?'First observation':'No observations'):`${difference>0?'+':''}${number(difference)} in this range`),node('span','',style==='bar'?`Latest per ${days===1?'hour':'24-hour interval'}`:'Recorded observations'));card.append(footer);grid.append(card);
  }
 }
 root.querySelectorAll('[data-range],[data-style]').forEach(button=>button.onclick=()=>{if(button.dataset.range)days=Number(button.dataset.range);else style=button.dataset.style;root.querySelectorAll('[data-range]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.range)===days)));root.querySelectorAll('[data-style]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.style===style)));render();});
 render();
 return {update(data){asOf=data.asOf;points=(Array.isArray(data.history)?data.history:[{at:data.asOf,online:data.online,subscribers:data.subscribers}]).slice().sort((a,b)=>a.at-b.at);loaded=true;render();},reset(){points=[];loaded=false;render();}};
}
