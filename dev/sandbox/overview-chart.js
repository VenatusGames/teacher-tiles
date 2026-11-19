const svgNS = 'http://www.w3.org/2000/svg';
const dayMs = 86400000;
const zone = 'America/New_York';
const format = opts => new Intl.DateTimeFormat(undefined,{timeZone:zone,...opts});
const dateFormat = format({month:'short',day:'numeric'});
const timeFormat = format({hour:'numeric',minute:'2-digit'});
const stamp = at => dateFormat.format(at) + ', ' + timeFormat.format(at);
const calendarDate = new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'});
export function node(tag,cls='',text) {
  const el=document.createElement(tag);
  if (cls) el.className=cls;
  if (text!==undefined) el.textContent=text;
  return el;
}
function svg(tag,attributes,text) {
  const el=document.createElementNS(svgNS,tag);
  for (const [key,value] of Object.entries(attributes)) el.setAttribute(key,value);
  if (text!==undefined) el.textContent=text;
  return el;
}
const valid = value => Number.isFinite(value) && value>=0;
export const count = value => valid(value) ? value.toLocaleString() : '—';

export function snapshotSeries(data,key,days) {
  const end=data.asOf, start=end-days*dayMs;
  const buckets=days===1 ? 24 : days===7 ? 28 : 30;
  const step=(end-start)/buckets;
  const slots=Array.from({length:buckets},(_,i)=>({at:start+(i+.5)*step,value:null}));
  const samples=(data.history || []).filter(p=>p && Number.isFinite(p.at) && p.at>=start && p.at<=end && valid(p[key])).sort((a,b)=>a.at-b.at);
  for (const p of samples) {
    const index=Math.min(buckets-1,Math.floor((p.at-start)/step));
    slots[index]={...slots[index],value:p[key],label:stamp(p.at)};
  }
  // Show individual readings on the line when available. Bars summarize each interval.
  const line=samples.length<=120 ? samples.map(p=>({at:p.at,value:p[key],label:stamp(p.at)})) : slots;
  return {start,end,step,slots,line,tick:at=>(days===1 ? timeFormat : dateFormat).format(at),
    note:'Eastern Time',barNote:'Latest reading per '+(days===1?'hour':days===7?'6 hours':'day')};
}

export function dailySeries(data,days) {
  const today=calendarDate.format(data.asOf);
  const last=Date.parse(today+'T12:00:00Z'),first=last-(days-1)*dayMs;
  const rows=new Map((data.dailyOnline || []).map(row=>[row.day,row]));
  const slots=Array.from({length:days},(_,i)=>{
    const at=first+i*dayMs,day=new Date(at).toISOString().slice(0,10),row=rows.get(day);
    const partial=row?.partial || day===today;
    return {at,value:valid(row?.users)?row.users:null,label:dateFormat.format(at)+(partial?' · Partial Day':''),partial};
  });
  return {slots,line:slots,start:first-dayMs/2,end:last+dayMs/2,step:dayMs,tick:at=>dateFormat.format(at),
    daily:true,note:'Eastern Time · Today is a partial day.'};
}
function axis(low,high) {
  const rough=Math.max(1,(high-low)/4);
  const magnitude=10**Math.floor(Math.log10(rough));
  const step=magnitude*[1,2,2.5,5,10].find(n=>n*magnitude>=rough && Number.isInteger(n*magnitude));
  const min=Math.max(0,Math.floor(low/step)*step);
  const max=Math.max(min+step,Math.ceil(high/step)*step);
  return {min,max,step};
}
export function drawChart(host,{series,style,label,loaded,failed}) {
  const bars=style==='bar';
  const points=(bars?series.slots:series.line).filter(p=>valid(p.value));
  if (!loaded || !points.length) {
    const empty=node('div','overview-empty');
    const title=loaded?'No Recorded Data':failed?'Analytics Unavailable':'Loading Analytics…';
    empty.append(node('strong','',title),node('p','',loaded?'Try a different time range.':failed?'Refresh Insights to try again.':'Fetching the latest snapshot.'));
    host.append(empty); return;
  }
  const render=()=>{
    const width=Math.max(220,host.clientWidth),height=196,top=16,bottom=158,right=width-12;
    const values=points.map(p=>p.value),highest=Math.max(...values),lowest=Math.min(...values);
    const {min,max,step}=axis(bars||lowest===highest?0:Math.max(0,lowest-(highest-lowest)*.1),highest);
    const numbers=new Intl.NumberFormat(undefined,{notation:highest>=10000?'compact':'standard',maximumFractionDigits:2});
    const left=12+7*Math.max(...[min,max].map(v=>numbers.format(v).length));
    const x=at=>left+(at-series.start)/(series.end-series.start)*(right-left);
    const y=value=>bottom-(value-min)/(max-min)*(bottom-top);
    const chart=svg('svg',{viewBox:`0 0 ${width} ${height}`,role:'group','aria-label':label});
    const tip=node('div','overview-tooltip');
    tip.hidden=true;
    for (let v=min;v<=max;v+=step) {
      chart.append(svg('line',{x1:left,x2:right,y1:y(v),y2:y(v),class:'overview-gridline'}),
        svg('text',{x:left-7,y:y(v)+4,'text-anchor':'end',class:'overview-axis'},numbers.format(v)));
    }
    let previous=null,hasGap=false;
    const barWidth=Math.min(48,(right-left)/series.slots.length*.72);
    for (const point of points) {
      const cx=x(point.at),cy=y(point.value);
      if (!bars && previous) {
        const gap=point.at-previous.at>series.step*1.5;
        hasGap ||= gap;
        chart.append(svg('line',{x1:x(previous.at),y1:y(previous.value),x2:cx,y2:cy,class:'overview-line'+(gap?' overview-gap':'')}));
      }
      previous=point;
    }
    for (const point of points) {
      const cx=x(point.at),cy=y(point.value),h=Math.max(2,bottom-cy);
      const mark=bars ? svg('rect',{x:cx-barWidth/2,y:bottom-h,width:barWidth,height:h,rx:Math.min(3,h/2),class:'overview-bar'})
        : svg('circle',{cx,cy:y(point.value),r:points.length>60?2.5:4,class:'overview-dot'});
      if (point.partial) mark.classList.add('is-partial');
      const text=count(point.value)+' · '+point.label;
      mark.setAttribute('aria-label',label+' · '+text);
      mark.setAttribute('tabindex','0');
      const show=()=>{
        tip.textContent=text; tip.hidden=false;
        const half=tip.offsetWidth/2;
        tip.style.left=Math.min(width-half,Math.max(half,cx))+'px';
      };
      const hide=()=>{tip.hidden=true;};
      mark.onfocus=mark.onpointerenter=show; mark.onblur=mark.onpointerleave=hide;
      mark.onkeydown=e=>{if(e.key==='Escape')hide();};
      chart.append(mark);
    }
    const ticks=width<360 ? 3 : 4;
    for(let i=0;i<ticks;i++){
      const fraction=i/(ticks-1);
      const at=series.daily?series.slots[Math.round(fraction*(series.slots.length-1))].at:series.start+fraction*(series.end-series.start);
      chart.append(svg('text',{x:x(at),y:184,'text-anchor':i===0?'start':i===ticks-1?'end':'middle',class:'overview-axis'},series.tick(at)));
    }
    const caption=points.length===1?'1 recorded reading':hasGap?'Dotted segments span gaps in recorded history.':bars?series.barNote:'';
    host.replaceChildren(chart,tip);
    if(caption)host.append(node('small','overview-plot-caption',caption));
  };
  host.addEventListener('plotresize',render);
  render();
}
