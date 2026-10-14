const NS='http://www.w3.org/2000/svg';
const node=(tag,className,text)=>{const element=document.createElement(tag);element.className=className;if(text!==undefined)element.textContent=text;return element;};
const svgNode=(tag,attrs,text)=>{const element=document.createElementNS(NS,tag);for(const [key,value] of Object.entries(attrs))element.setAttribute(key,value);if(text!==undefined)element.textContent=text;return element;};
const label=(day,options={month:'short',day:'numeric'})=>new Date(day+'T12:00:00Z').toLocaleDateString(undefined,{...options,timeZone:'UTC'});
export function createDailyActivityChart({rows,days,style,loaded,tabs}){
 const selected=rows.slice(-days),known=selected.filter(row=>Number.isFinite(row.users)),latest=known.at(-1);
 const card=node('article','trend-card trend-online trend-daily-online'),head=node('div','trend-card-heading'),copy=node('div','');
 copy.append(node('h3','','Daily Online Users'),node('p','','Unique signed-in accounts each calendar day · Eastern Time'));
 const summary=node('div','trend-summary');summary.append(node('strong','',latest?latest.users.toLocaleString():'—'),node('span','',latest?label(latest.day)+(latest.partial?' · Partial Day':''):'No daily history'));
 head.append(copy,summary,tabs);card.append(head);
 const plot=node('div','trend-plot'),tooltip=node('div','trend-tooltip');tooltip.hidden=true;tooltip.setAttribute('role','tooltip');
 const describe=row=>`${label(row.day)}: ${Number.isFinite(row.users)?row.users.toLocaleString()+' unique users':'not recorded'}${row.partial?' (partial day)':''}`;
 const bind=(element,row)=>{
  element.setAttribute('aria-label',describe(row));
  const show=()=>{tooltip.replaceChildren(node('strong','',row.users.toLocaleString()+' unique users'),node('span','',label(row.day)+(row.partial?' · Partial Day':'')+' · Eastern Time'));tooltip.hidden=false;const a=element.getBoundingClientRect(),b=plot.getBoundingClientRect();tooltip.style.left=Math.max(95,Math.min(b.width-95,a.left-b.left+a.width/2))+'px';};
  element.addEventListener('pointerenter',show);element.addEventListener('focus',show);element.addEventListener('pointerleave',()=>tooltip.hidden=true);element.addEventListener('blur',()=>tooltip.hidden=true);element.addEventListener('keydown',event=>{if(event.key==='Escape')tooltip.hidden=true;});
 };
 const ceiling=Math.ceil(Math.max(4,...known.map(row=>row.users))/4)*4;
 if(style==='bar'){
  const bars=node('div','portal-chart-bars');bars.setAttribute('aria-label','Daily unique online users in Eastern Time');
  selected.forEach((row,i)=>{const column=node('div','portal-bar-column'),track=node('button','portal-bar-track');track.type='button';track.setAttribute('aria-label',describe(row));
   if(Number.isFinite(row.users)){const fill=node('i','trend-bar');fill.style.height=row.users/ceiling*100+'%';if(row.users===0)fill.classList.add('is-zero');track.append(fill);bind(track,row);}
   else{track.classList.add('is-missing');track.append(node('span','','—'));}
   const tick=node('span','portal-bar-label',days===30&&i%5!==0&&i!==selected.length-1?'':label(row.day,days===7?{weekday:'short'}:{month:'short',day:'numeric'}));column.append(track,tick);bars.append(column);
  });plot.append(bars);
 }else{
  const svg=svgNode('svg',{viewBox:'0 0 500 235',role:'img','aria-label':'Daily unique online users in Eastern Time'}),left=42,right=482,top=18,bottom=190;
  const x=i=>selected.length===1?(left+right)/2:left+(right-left)*i/(selected.length-1),y=count=>bottom-(bottom-top)*count/ceiling;
  for(let i=0;i<=2;i++){const pos=bottom-(bottom-top)*i/2;svg.append(svgNode('line',{x1:left,x2:right,y1:pos,y2:pos,class:'trend-gridline'}),svgNode('text',{x:30,y:pos+5,'text-anchor':'end',class:'trend-axis'},String(ceiling*i/2)));}
  let path='',connected=false;
  selected.forEach((row,i)=>{if(!Number.isFinite(row.users)){connected=false;return;}path+=`${connected?'L':'M'}${x(i)},${y(row.users)} `;connected=true;});
  if(path)svg.append(svgNode('path',{d:path,fill:'none',class:'trend-line',pathLength:1}));
  selected.forEach((row,i)=>{if(Number.isFinite(row.users)){const dot=svgNode('circle',{cx:x(i),cy:y(row.users),r:4,class:'trend-mark',tabindex:0});bind(dot,row);svg.append(dot);}});
  const ticks=[...new Set([0,Math.floor((selected.length-1)/2),selected.length-1])].filter(i=>i>=0&&i<selected.length);
  for(const i of ticks)svg.append(svgNode('text',{x:x(i),y:222,'text-anchor':selected.length===1?'middle':i===0?'start':i===selected.length-1?'end':'middle',class:'trend-axis'},label(selected[i].day)));
  plot.append(svg);
 }
 if(!known.length){const empty=node('div','trend-empty');empty.append(node('strong','',loaded?'Daily history is not available yet':'Loading analytics'),node('span','',loaded?'Daily totals begin with site activity after deployment.':'Daily totals will appear here.'));plot.append(empty);}
 plot.append(tooltip);card.append(plot);
 const footer=node('div','trend-card-footer');footer.append(node('span','','Each account counted once per day'),node('span','','Today and the first tracking day are partial'));card.append(footer);return card;
}
