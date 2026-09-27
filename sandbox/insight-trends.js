export function createTrendCharts(root){
 root.innerHTML=`<header class="trend-heading"><div><h2>User analytics</h2><p>Observed counts over time · saved on dashboard refresh, at most once per 15 minutes</p></div><div class="trend-controls"><label>Time range<select aria-label="Analytics time range"><option value="1">24 hours</option><option value="7" selected>7 days</option><option value="30">30 days</option></select></label><label>Chart style<select aria-label="Analytics chart style"><option value="line">Line</option><option value="bar">Bars</option></select></label></div></header><div class="trend-grid"></div><p class="trend-footnote">History begins when these analytics are deployed. No earlier counts are estimated.</p>`;
 const grid=root.querySelector('.trend-grid'),range=root.querySelector('[aria-label="Analytics time range"]'),style=root.querySelector('[aria-label="Analytics chart style"]');
 let points=[],asOf=Date.now(),loaded=false;
 const NS='http://www.w3.org/2000/svg';
 function svgElement(name,attrs={},content){const el=document.createElementNS(NS,name);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,String(value));if(content!==undefined)el.textContent=content;return el;}
 function render(){
  grid.replaceChildren();const start=asOf-Number(range.value)*86400000,visible=points.filter(p=>p.at>=start&&p.at<=asOf);
  for(const [key,title,description] of [['online','Online Users','Active within 6 minutes at each observation'],['subscribers','Subscribers','Active paid subscriptions · excludes dev previews']]){
   const card=document.createElement('article');card.className='trend-card trend-'+key;
   const heading=document.createElement('h3');heading.textContent=title;
   const detail=document.createElement('p');detail.textContent=description;
   const summary=document.createElement('div');summary.className='trend-summary';
   const value=document.createElement('strong');value.textContent=visible.length?visible.at(-1)[key].toLocaleString():'—';
   const delta=document.createElement('span');const difference=visible.length>1?visible.at(-1)[key]-visible[0][key]:null;delta.textContent=difference===null?'First observation':`${difference>0?'+':''}${difference} since first observation in view`;
   summary.append(value,delta);card.append(heading,detail,summary);
   const svg=svgElement('svg',{viewBox:'0 0 500 220',role:'img','aria-label':`${title} count over the last ${range.value} days`});
   const max=Math.max(4,...visible.map(p=>p[key])),ceiling=Math.ceil(max/4)*4,left=40,right=480,top=12,bottom=177;
   for(let i=0;i<=4;i++){const y=bottom-(bottom-top)*i/4;svg.append(svgElement('line',{x1:left,x2:right,y1:y,y2:y,class:'trend-gridline'}));svg.append(svgElement('text',{x:30,y:y+4,'text-anchor':'end',class:'trend-axis'},String(ceiling*i/4)));}
   const x=at=>left+(right-left)*(at-start)/(asOf-start),y=count=>bottom-(bottom-top)*count/ceiling;
   if(visible.length){
    if(style.value==='line'){
     const path=visible.map((p,i)=>`${i?'L':'M'}${x(p.at)},${y(p[key])}`).join(' ');
     // Dots mark actual observations; the line connects samples, not continuous monitoring.
     if(visible.length>1)svg.append(svgElement('path',{d:path,fill:'none',class:'trend-line'}));
    }
    for(const point of visible){const marker=style.value==='bar'?svgElement('rect',{x:x(point.at)-2,y:y(point[key]),width:4,height:Math.max(1,bottom-y(point[key])),rx:1,class:'trend-mark'}):svgElement('circle',{cx:x(point.at),cy:y(point[key]),r:visible.length>300?1.8:3.5,class:'trend-mark'});marker.append(svgElement('title',{},`${new Date(point.at).toLocaleString()}: ${point[key]} ${title.toLowerCase()}`));svg.append(marker);}
   }
   for(const [at,anchor] of [[start,'start'],[start+(asOf-start)/2,'middle'],[asOf,'end']])svg.append(svgElement('text',{x:x(at),y:204,'text-anchor':anchor,class:'trend-axis'},new Date(at).toLocaleString(undefined,Number(range.value)===1?{hour:'numeric',minute:'2-digit'}:{month:'short',day:'numeric'})));
   card.append(svg);
   const note=document.createElement('p');note.className='trend-note';note.textContent=!loaded?'Waiting for analytics…':!visible.length?'No observations in this time range.':visible.length<2?'One observation so far. Later visits or refreshes will build the trend.':`${visible.length} observations · hover a point for its time and count`;card.append(note);grid.append(card);
  }
 }
 range.onchange=style.onchange=render;render();
 return {update(data){asOf=data.asOf;points=Array.isArray(data.history)?data.history:[{at:data.asOf,online:data.online,subscribers:data.subscribers}];loaded=true;render();},reset(){points=[];loaded=false;render();}};
}
