/* Shared presentation object contract: no arbitrary HTML, CSS, tile types or URLs. */
(function(root){'use strict';
const types=['clock','colorpicker','grapher','rainbow','sticky','tablemaker','tallychart','translation','timer','voicememo'];
const text=(v,n=1000)=>String(v??'').slice(0,n),num=(v,a,b,d)=>Number.isFinite(v)?Math.max(a,Math.min(b,v)):d;
const color=(v,d)=>/^#[0-9a-f]{6}$/i.test(v||'')?v:d;
function table(e){const rows=Math.round(num(e.rows,1,20,3)),cols=Math.round(num(e.cols,1,12,3));return {rows,cols,cells:Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,c)=>text(e.cells?.[r]?.[c],1000))),fontSize:num(e.fontSize,8,72,22),color:color(e.color,'#263249'),fill:color(e.fill,'#ffffff'),border:color(e.border,'#aebdd1'),header:e.header!==false,headerFill:color(e.headerFill,'#e4ecf7')};}
function tile(e){if(!types.includes(e.tileType))throw Error('Unsupported presentation tile.');const s=e.tileState||{},dataset={};
 for(const key of ['bg','font','text','color','clockMode','timerShape','timerColor','timerFill','timerDirection','shapeColor','showHeading'])if(/^[a-zA-Z0-9# ._-]{1,80}$/.test(s.dataset?.[key]||''))dataset[key]=s.dataset[key];
 const special={},v=s.special||{};
 if(e.tileType==='tablemaker'||e.tileType==='tallychart'){
  const tally=e.tileType==='tallychart',defaults=tally?[{label:'Option A',count:3},{label:'Option B',count:5},{label:'Option C',count:2}]:[{label:'Reading',value:18},{label:'Math',value:24},{label:'Science',value:14},{label:'Writing',value:20}];
  special.rows=(Array.isArray(v.rows)?v.rows:defaults).slice(0,tally?16:12).map((row,i)=>({label:text(row?.label||'Category '+(i+1),28),[tally?'count':'value']:tally?Math.round(num(row?.count,0,999,0)):num(row?.value,0,999999,0),color:color(row?.color,['#729de0','#e7ad76','#9abd91','#ba99cd'][i%4])}));
  if(tally){special.view=v.view==='bars'?'bars':'tallies';special.sort=v.sort==='highest'?'highest':'added';}
  else{special.chartType=['bar','line','pie','donut'].includes(v.chartType)?v.chartType:'bar';special.editorOpen=v.editorOpen!==false;special.expandedWidth=num(v.expandedWidth,520,1600,860);special.expandedHeight=num(v.expandedHeight,450,1200,600);}
 }
 if(e.tileType==='grapher'){
  const r=v.range||{};special.range={xmin:num(r.xmin,-1000000,1000000,-10),xmax:num(r.xmax,-1000000,1000000,10),ymin:num(r.ymin,-1000000,1000000,-10),ymax:num(r.ymax,-1000000,1000000,10)};
  if(special.range.xmax-special.range.xmin<.000001){special.range.xmin=-10;special.range.xmax=10;}if(special.range.ymax-special.range.ymin<.000001){special.range.ymin=-10;special.range.ymax=10;}
  special.points=(Array.isArray(v.points)?v.points:[]).filter(p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y)).slice(0,500).map(p=>({x:num(p.x,-1000000,1000000,0),y:num(p.y,-1000000,1000000,0)}));special.equation=text(v.equation??'x',500);
 }
 if(e.tileType==='rainbow')special.selected=Math.round(num(v.selected,0,6,0));
 if(e.tileType==='colorpicker')special.color=color(v.color,'#6f8fb7');
 if(e.tileType==='translation'){for(const k of ['title','source','target','input','output'])special[k]=text(v[k],k==='output'?10000:k==='input'?450:100);}
 if(e.tileType==='voicememo'){special.title=text(v.title,100);special.memos=(Array.isArray(v.memos)?v.memos:[]).slice(0,5).map(m=>({name:text(m.name,40),duration:num(m.duration,0,30,0),...(typeof m.asset==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(m.asset)?{asset:m.asset}:{})}));}
 const state={dataset,special,classes:(Array.isArray(s.classes)?s.classes:[]).filter(c=>['show-seconds','hide-period'].includes(c)),fields:(Array.isArray(s.fields)?s.fields:[]).slice(0,60).map(f=>({index:Math.round(num(f.index,0,100,0)),value:text(f.value,2000),checked:!!f.checked})),sticky:text(s.sticky,10000),stickyHtml:text(s.stickyHtml,20000).replace(/<(script|style|iframe|object|svg|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'').replace(/<[^>]*>/g,tag=>{const m=tag.match(/^<\s*(\/?)\s*(b|strong|i|em|u|s|p|div|br|ul|ol|li)\b[^>]*>$/i);return m?'<' +m[1]+m[2].toLowerCase()+'>':'';})};
 if(e.tileType==='timer'){const t=s.timer||{};state.timer={total:num(t.total,0,86400,60),left:num(t.left,0,86400,60),running:!!t.running,finished:!!t.finished,endAt:num(t.endAt,0,1e14,0)};}
 return {tileType:e.tileType,tileState:state};
}
const api={types,table,tile,assets:deck=>[...new Set(deck.slides.flatMap(s=>s.elements.flatMap(e=>[...(e.asset?[e.asset]:[]),...(e.tileType==='voicememo'?(e.tileState?.special?.memos||[]).map(m=>m.asset).filter(Boolean):[])])).concat((deck.fonts||[]).map(f=>f.asset)))]};
if(typeof module!=='undefined')module.exports=api;else root.TeacherTilesPresentationObjects=api;
})(globalThis);
