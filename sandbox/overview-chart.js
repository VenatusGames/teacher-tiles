const NS='http://www.w3.org/2000/svg';
export const node=(tag,cls='',text)=>{const el=document.createElement(tag);el.className=cls;if(text!==undefined)el.textContent=text;return el;};
const svg=(tag,attrs,text)=>{const el=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);if(text!==undefined)el.textContent=text;return el;};
export const count=value=>Number.isFinite(value)&&value>=0?value.toLocaleString():'—';
const dayKey=at=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(at);
export const dayLabel=day=>new Date(day+'T12:00:00Z').toLocaleDateString(undefined,{month:'short',day:'numeric',timeZone:'UTC'});
const stamp=at=>new Date(at).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/New_York'});
export function snapshotSeries(data,key,days){
 const end=data.asOf,start=end-days*86400000,n=days===1?24:days===7?28:30,step=(end-start)/n;
 const slots=Array.from({length:n},(_,i)=>({value:null,label:stamp(start+(i+.5)*step),at:start+(i+.5)*step}));
 for(const p of [...(Array.isArray(data.history)?data.history:[])].sort((a,b)=>a.at-b.at)){if(!Number.isFinite(p.at)||p.at<start||p.at>end||!Number.isFinite(p[key])||p[key]<0)continue;const i=Math.min(n-1,Math.floor((p.at-start)/step));slots[i]={...slots[i],value:p[key],label:stamp(p.at),observed:p.at};}
 return {slots,note:'Latest snapshot per '+(days===1?'hour':days===7?'6 hours':'day')+' · Eastern Time',tick:i=>new Date(slots[i].at).toLocaleString(undefined,days===1?{hour:'numeric',timeZone:'America/New_York'}:{month:'short',day:'numeric',timeZone:'America/New_York'})};
}
export function dailySeries(data,days){
 const today=dayKey(data.asOf),end=Date.parse(today+'T12:00:00Z'),rows=new Map((Array.isArray(data.dailyOnline)?data.dailyOnline:[]).map(r=>[r.day,r]));
 const slots=Array.from({length:days},(_,i)=>{const day=new Date(end-(days-i-1)*86400000).toISOString().slice(0,10),r=rows.get(day),partial=r?.partial||day===today;return {value:Number.isFinite(r?.users)&&r.users>=0?r.users:null,label:dayLabel(day)+(partial?' · Partial day':''),day,partial};});
 return {slots,note:'Unique accounts per day · Eastern Time. Today is partial.',tick:i=>dayLabel(slots[i].day)};
}
function scaleTop(max){const rough=Math.max(1,max/4),power=10**Math.floor(Math.log10(rough)),step=[1,2,5,10].map(n=>n*power).find(n=>n>=rough);return Math.max(4,Math.ceil(max/(step*4))*step*4);}
export function drawChart(host,{series,style='line',label,loaded}){
 host.replaceChildren();const {slots,tick}=series,known=slots.filter(p=>p.value!==null);
 if(!loaded||!known.length){const empty=node('div','overview-empty');empty.append(node('span','overview-empty-icon',loaded?'—':''),node('strong','',loaded?'No data in this range':'Loading analytics…'),node('p','',loaded?'Choose another range or refresh the snapshot.':'Your saved counts will appear here.'));host.append(empty);return;}
 const left=58,right=594,top=20,bottom=202,width=620,height=250,ceiling=scaleTop(Math.max(...known.map(p=>p.value))),step=(right-left)/slots.length;
 const x=i=>left+(i+.5)*step,y=v=>bottom-(bottom-top)*v/ceiling;
 const chart=svg('svg',{viewBox:`0 0 ${width} ${height}`,role:'group','aria-label':label}),tip=node('div','overview-tooltip');tip.hidden=true;tip.setAttribute('role','tooltip');
 for(let n=0;n<=4;n++){const value=ceiling*n/4,pos=y(value);chart.append(svg('line',{x1:left,x2:right,y1:pos,y2:pos,class:'overview-gridline'}),svg('text',{x:left-12,y:pos+4,'text-anchor':'end',class:'overview-axis'},new Intl.NumberFormat(undefined,{notation:ceiling>=10000?'compact':'standard',maximumFractionDigits:1}).format(value)));}
 const hide=()=>{tip.hidden=true;};
 const bind=(mark,p)=>{const text=p.value===null?'No observation':count(p.value)+' '+label.toLowerCase();mark.setAttribute('aria-label',p.label+': '+text);mark.setAttribute('tabindex','0');const show=()=>{tip.replaceChildren(node('strong','',text),node('span','',p.label));tip.hidden=false;const a=mark.getBoundingClientRect(),b=host.getBoundingClientRect();tip.style.left=Math.max(90,Math.min(b.width-90,a.left-b.left+a.width/2))+'px';};mark.addEventListener('pointerenter',show);mark.addEventListener('pointerleave',hide);mark.addEventListener('focus',show);mark.addEventListener('blur',hide);mark.addEventListener('keydown',e=>{if(e.key==='Escape')hide();});};
 if(style==='line'){let d='',connected=false;slots.forEach((p,i)=>{if(p.value===null){connected=false;return;}d+=`${connected?'L':'M'}${x(i)},${y(p.value)} `;connected=true;});chart.append(svg('path',{d,fill:'none',class:'overview-line'}));}
 slots.forEach((p,i)=>{let mark;if(p.value===null){mark=svg('line',{x1:x(i)-3,x2:x(i)+3,y1:bottom,y2:bottom,class:'overview-missing'});}else if(style==='bar'){const h=p.value===0?2:bottom-y(p.value);mark=svg('rect',{x:x(i)-step*.29,y:bottom-h,width:step*.58,height:h,rx:Math.min(4,step*.16,h/2),class:'overview-bar'+(p.partial?' is-partial':'')});}else mark=svg('circle',{cx:x(i),cy:y(p.value),r:3.5,class:'overview-dot'+(p.partial?' is-partial':'')});bind(mark,p);chart.append(mark);});
 const ticks=[...new Set([0,Math.floor((slots.length-1)/3),Math.floor((slots.length-1)*2/3),slots.length-1])];
 for(const i of ticks)chart.append(svg('text',{x:x(i),y:235,'text-anchor':i===0?'start':i===slots.length-1?'end':'middle',class:'overview-axis'},tick(i)));
 host.append(chart,tip);
}
