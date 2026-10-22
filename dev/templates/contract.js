/* Shared, deliberately explicit export boundary. New tile state must opt in here. */
(function(root){
  'use strict';
  const VERSION=1, MAX_BYTES=600000;
  const text=(value,max=4000)=>String(value??'').normalize('NFKC').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').slice(0,max);
  const num=(v,min,max,fallback)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):fallback;
  const escape=value=>text(value,30000).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // Preserve only formatting tags; attributes, links, embeds and executable content never cross this boundary.
  function html(value){return text(value,30000).replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style|iframe|object|svg|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'').replace(/<[^>]*>/g,tag=>{const m=tag.match(/^<\s*(\/?)\s*(b|strong|i|em|u|s|p|div|br|ul|ol|li|h1|h2|h3|blockquote)\b[^>]*>$/i);return m?`<${m[1]}${m[2].toLowerCase()}>`:'';});}
  function raster(value){const s=String(value||'');if(s.length>400000)return '';return /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(s)?s:'';}
  function remoteImage(value){
    const source=String(value||'');
    if(!source||source.length>4096)return '';
    try{
      const url=new URL(source);
      if(url.protocol!=='https:'||url.username||url.password||url.port)return '';
      if(!['upload.wikimedia.org','thumb.wikimedia.org'].includes(url.hostname))return '';
      if(!url.pathname.startsWith('/wikipedia/commons/'))return '';
      return url.href;
    }catch{return '';}
  }
  function commonsSource(value){
    const source=String(value||'');
    if(!source||source.length>4096)return '';
    try{
      const url=new URL(source);
      if(url.protocol!=='https:'||url.username||url.password||url.port)return '';
      if(url.hostname!=='commons.wikimedia.org'||!url.pathname.startsWith('/wiki/File:'))return '';
      return url.href;
    }catch{return '';}
  }
  const image=value=>raster(value)||(/^https:\/\/flagcdn\.io\/flags\/4x3\/[a-z]{2}(?:-[a-z0-9]+)?\.svg$/.test(String(value||''))?String(value):'')||(/^(?:assets|stickers|tiles)\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_. -]+\.(?:png|webp|jpg|jpeg|gif|svg)(?:\?v=[a-zA-Z0-9_-]+)?$/.test(String(value||''))?String(value):'');
  const templateImage=value=>raster(value)||remoteImage(value);
  const token=v=>/^[a-zA-Z0-9# ._-]{1,80}$/.test(String(v||''))?String(v):'';
  const list=(v,max=100)=>Array.isArray(v)?v.slice(0,max):[];
  const adapters={
    presentation:s=>{const v=s.sharedPresentation,shared=v&&/^[a-zA-Z0-9_-]{1,100}$/.test(v.id||'')&&/^[a-zA-Z0-9_-]{1,100}$/.test(v.templateId||'')?{id:v.id,templateId:v.templateId,title:text(v.title,100),slideCount:num(v.slideCount,1,500,1),cover:typeof v.cover==='string'&&v.cover.length<=40000?raster(v.cover):''}:null;return {presentationId:'',slideIndex:0,autoplay:s.autoplay===true,loop:s.loop===true,interval:num(s.interval,2,300,5),...(shared?{sharedPresentation:shared,previewSrc:shared.cover}:{})};},
    visualdirections:s=>({cards:list(s.cards,20).filter(c=>c&&typeof c==='object').map(c=>({title:text(c.title,80),image:image(c.image),color:/^#[0-9a-f]{6}$/i.test(c.color||'')?c.color:'#4285d4'})),mode:['numbers','ordinals','sequence'].includes(s.mode)?s.mode:'numbers',layout:['vertical','horizontal','grid'].includes(s.layout)?s.layout:'grid'}),
    halloweentimer:()=>({}),
    thanksgivingtimer:()=>({}),
    thankfulturkey:s=>({feathers:list(s.feathers,12).filter(v=>typeof v==='string').map(v=>text(v,60).trim()).filter(Boolean)}),
    cookafeast:s=>({title:text(s.title,200),orientation:'horizontal',barStyle:token(s.barStyle),running:false,completed:false,dish:''}),
    pumpkincarving:s=>({cuts:list(s.cuts,100).filter(p=>typeof p==='string'&&p.length<=24000&&/^[MLAZamlz0-9eE.,\s+-]+$/.test(p))}),
    pumpkinpatch:s=>({layoutVersion:3,plants:list(s.plants,24).filter(p=>p&&typeof p==='object').map(p=>({sprite:num(p.sprite,1,4,1),color:['orange','green','yellow'].includes(p.color)?p.color:'orange',x:num(p.x,5,95,50),y:num(p.y,48,94,75),size:num(p.size,7,27,15),growth:num(p.growth,0,1,0)})),progress:0,mode:'ambient',threshold:num(s.threshold,15,85,55)}),
    trickortreat:s=>({variant:Math.round(num(s.variant,0,7,0)),lastKnock:-1,reward:null}),
    tenssticks:s=>({pieces:list(s.pieces,120).filter(p=>p&&typeof p==='object').map((p,i)=>({id:'piece-'+i,value:[1,10,100].includes(p.value)?p.value:1,scale:p.scale===.7?.7:1,x:num(p.x,0,640,0),y:num(p.y,0,340,0)}))}),
    tensblock:s=>({value:[1,10,100].includes(s.value)?s.value:1}),
    lavalamp:s=>({color:token(s.color)}),
    countdown:s=>({event:text(s.event,120),target:Number.isFinite(Date.parse(s.target))?new Date(s.target).toISOString():'',unit:['weeks','days','hours','minutes','seconds'].includes(s.unit)?s.unit:'days'}),
    classroomjobs:s=>({version:1,classId:'',assignments:{},allowMultiple:s.allowMultiple===true,jobs:list(s.jobs,100).filter(j=>j&&typeof j==='object').map((j,i)=>({id:'job-'+i,title:text(j.title,60),icon:text(j.icon,12),image:raster(j.image)}))}),

    progressbar:s=>({title:text(s.title,200),orientation:token(s.orientation),barStyle:token(s.barStyle),startIconSrc:image(s.startIconSrc),endIconSrc:image(s.endIconSrc),running:false}),
    essentialquestion:s=>({question:text(s.question,2000),subheading:text(s.subheading,500)}),
    vocabulary:s=>({cards:list(s.cards,100).map(v=>({word:text(v.word,100),definition:text(v.definition,800)})),showDefinitions:s.showDefinitions!==false,size:token(s.size)}),
    venndiagram:s=>({title:text(s.title,100),mode:s.mode==='3'?'3':'2',headings:{a:text(s.headings?.a,100),b:text(s.headings?.b,100),c:text(s.headings?.c,100)},selectedRegion:1,items:list(s.items,100).map((v,i)=>({id:`item-${i}`,text:text(v.text,500),region:num(v.region,1,7,1)}))}),
    customflashcards:s=>({sets:list(s.sets,20).map((v,i)=>({id:`set-${i}`,name:text(v.name,40),cards:list(v.cards,60).map((c,j)=>({id:`card-${i}-${j}`,text:text(c.text,180),imageSrc:raster(c.imageSrc),imageName:text(c.imageName,120)}))})),completed:false}),
    abc:s=>({mode:token(s.mode),redVowels:s.redVowels!==false,completed:false}),
    numberflashcards:s=>({mode:token(s.mode),completed:false}),
    cvcword:s=>({category:token(s.category),completed:false}),
    highfrequency:s=>({grade:token(s.grade),completed:false}),
    robothfw:s=>({grade:token(s.grade),completed:false,started:false}),
    noise:s=>({version:1,threshold:num(s.threshold,10,100,70),sensitivity:num(s.sensitivity,50,200,100),view:token(s.view)}),
    randomnumber:s=>({min:num(s.min,-1000000,1000000,1),max:num(s.max,-1000000,1000000,100)}),
    squishy:s=>({version:1,color:token(s.color)}),
    colorpicker:s=>({color:token(s.color)}),
    interactive:s=>({mode:token(s.mode)}),
    musicscore:s=>({tempo:num(s.tempo,40,200,100),rows:num(s.rows,1,4,1),labels:s.labels!==false,notes:list(s.notes,256).map(n=>({beat:num(n.beat,0,63,0),pitch:num(n.pitch,0,127,60),duration:[1,2,4].includes(n.duration)?n.duration:1,rest:n.rest===true}))}),
    meditation:s=>({version:4,inhaleSeconds:num(s.inhaleSeconds,1,30,4),exhaleSeconds:num(s.exhaleSeconds,1,30,6),durationSeconds:num(s.durationSeconds,10,7200,60),showCues:s.showCues!==false,palette:token(s.palette)}),
    sentenceexpansion:s=>({version:1,source:list(s.source,2).map(v=>text(v)),draft:list(s.source,2).map(v=>text(v)),history:[],image:raster(s.image)}),
    wordweb:s=>({center:text(s.center,300),nodes:list(s.nodes,24).map((n,i)=>({id:`node-${i}`,text:text(n.text,400)}))}),
    image:s=>{
      const src=templateImage(s.src),previewSrc=templateImage(s.previewSrc)||src;
      const attribution=s.attribution&&typeof s.attribution==='object'?{
        url:src,
        sourceUrl:commonsSource(s.attribution.sourceUrl),
        title:text(s.attribution.title,180),
        creator:text(s.attribution.creator,240),
        license:text(s.attribution.license,100)
      }:null;
      return {src,previewSrc,border:token(s.border),borderColor:token(s.borderColor),...(attribution?.sourceUrl?{attribution}: {})};
    },
    youtube:s=>{let id='';try{const u=new URL(s.url);if(['youtube.com','www.youtube.com','youtu.be','www.youtube-nocookie.com'].includes(u.hostname))id=u.hostname==='youtu.be'?u.pathname.slice(1):u.searchParams.get('v')||u.pathname.split('/').pop();}catch{}const url=/^[\w-]{11}$/.test(id)?`https://www.youtube.com/watch?v=${id}`:'';return {url,loaded:Boolean(url&&s.loaded)};},
    visualschedule:s=>({segments:list(s.segments,40).map(v=>({title:text(v.title,200),time:text(v.time,40),iconSrc:image(v.iconSrc),complete:false,size:num(v.size,24,150,44)}))}),
    todo:s=>({rows:list(s.rows,50).map(v=>({text:text(v.text,400),checked:false}))}),
    spreadsheet:s=>{const cells={},pictures={},formats={};for(const [key,value] of Object.entries(s.cells||{}).slice(0,1000))if(/^[A-Z][1-9][0-9]?$/.test(key))cells[key]=text(value,2000);for(const [key,value] of Object.entries(s.pictures||{}).slice(0,100))if(/^[A-Z][1-9][0-9]?$/.test(key)&&raster(value))pictures[key]=raster(value);for(const [key,f] of Object.entries(s.formats||{}).slice(0,1000)){if(!/^[A-Z][1-9][0-9]?$/.test(key)||!f)continue;const out={};for(const k of ['bold','italic','underline','strike'])if(f[k]===true)out[k]=true;for(const k of ['font','color','highlight','align','block'])if(token(f[k]))out[k]=token(f[k]);out.size=num(f.size,10,64,16);formats[key]=out;}return{version:3,rows:num(s.rows,1,99,12),cols:num(s.cols,1,26,6),cells,pictures,formats,columnWidths:list(s.columnWidths,26).map(v=>num(v,48,600,96)),rowHeights:list(s.rowHeights,99).map(v=>num(v,24,240,29))};}
  };
  const rich=new Set(['sticky','richtext','textbubble','essentialquestion']);
  function sanitize(snapshot,{knownTypes,presentationSources=false}={}){
    if(!snapshot||typeof snapshot!=='object')throw new Error('Choose a board to share.');
    if(snapshot.templateVersion!==undefined&&snapshot.templateVersion!==VERSION)throw new Error('This template format needs a newer app. Refresh before importing.');
    const warnings=new Set(),types=knownTypes?new Set(knownTypes):null;let count=0;
    function tile(raw,tab=false){
      if(!raw||typeof raw!=='object'||!/^[-a-z0-9]{1,60}$/.test(raw.type||''))return null;
      if(raw.type==='rainbowbreath'){raw={...raw,type:'meditation',dataset:{...raw.dataset,tileSkin:'meditation-rainbow'}};warnings.add('Rainbow Breath updated to the Meditation rainbow skin');}
      if(++count>100)throw new Error('Templates can contain at most 100 tiles, including tabs.');
      if(types&&!types.has(raw.type)){warnings.add(`${raw.type}: unavailable tile omitted`);return null;}
      if(Number(raw.templateTileVersion||1)>1){warnings.add(`${raw.type}: newer tile format omitted`);return null;}
      const t=raw.transform||{},out={templateTileVersion:1,id:`template-${count}`,schemaVersion:2,type:raw.type,transform:{left:num(t.left,-100000,100000,0),top:num(t.top,-100000,100000,0),width:num(t.width,80,2400,320),height:num(t.height,60,2400,240),uniformScale:num(t.uniformScale,.25,4,1),rotation:num(t.rotation,-360,360,0)},zIndex:count,dataset:{}};
      for(const key of ['bg','font','text','color','shape','orientation','tileSkin','timerColor','timerShape','interactiveMode','squishyColor','shapeColor','candleColor','appearanceBorderStyle','appearanceBorderSize','appearanceBorderColor','pieFlavor','pumpkinFace','pumpkinLit','tileHeadingHidden','blockValue'])if(token(raw.dataset?.[key]))out.dataset[key]=token(raw.dataset[key]);
      if(rich.has(raw.type))out.editables=list(raw.editables,3).map((v,i)=>({index:i,html:html(v.html)}));
      if(adapters[raw.type])out.special=adapters[raw.type](raw.type==='progressbar'?{...raw.special,title:raw.special?.title??list(raw.fields).find(f=>f.index===0)?.value}:raw.special||{});
      else if(!rich.has(raw.type)&&raw.type!=='sticker')warnings.add(`${raw.type}: activity and content reset; layout and appearance kept`);
      if(raw.type==='presentation'&&presentationSources&&!out.special.sharedPresentation&&/^[a-zA-Z0-9_-]{1,80}$/.test(raw.special?.presentationId||''))out.special.presentationId=raw.special.presentationId;
      if(raw.type==='sticker'){out.sticker={emoji:text(raw.sticker?.emoji,20),src:image(raw.sticker?.src),name:text(raw.sticker?.name,80),aspect:num(raw.sticker?.aspect,.1,10,1)};if(!out.sticker.emoji&&!out.sticker.src){warnings.add('An unavailable sticker was omitted');return null;}}
      if(raw.type==='image'&&raw.special?.src&&!out.special.src)warnings.add('External or oversized image omitted; use an embedded image under 300 KB or an Image Search result');
      if(!tab&&raw.tabs){const items=list(raw.tabs.items,20).map(v=>tile(v,true)).filter(Boolean);if(items.length>1)out.tabs={active:0,items};}
      return out;
    }
    const objects=list(snapshot.objects,101).map(v=>tile(v)).filter(Boolean);
    const result={templateVersion:VERSION,schemaVersion:2,theme:token(snapshot.theme)||'light',objects,frames:list(snapshot.frames,30).map((f,i)=>({id:`frame-${i}`,name:text(f.name,40),centerX:num(f.centerX,-100000,100000,0),centerY:num(f.centerY,-100000,100000,0),scale:num(f.scale,.1,4,1)})),calendarEvents:[],preview:[]};
    if(new TextEncoder().encode(JSON.stringify(result)).length>MAX_BYTES)throw new Error('This template is too large. Use fewer or smaller images (600 KB total).');
    return {snapshot:result,warnings:[...warnings]};
  }
  function words(value){return text(value,8000).toLowerCase().match(/[\p{L}\p{N}]{2,32}/gu)||[];}
  const api=Object.freeze({VERSION,MAX_BYTES,sanitize,words,text,escape});
  if(typeof module!=='undefined')module.exports=api;else root.TeacherTilesTemplateContract=api;
})(globalThis);
