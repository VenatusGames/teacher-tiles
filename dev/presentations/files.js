/* Local, on-demand presentation interchange. No presentation data leaves this browser. */
(()=>{'use strict';
const BASE=new URL('.',document.currentScript.src),loads=new Map(),MB=1000000;
const uid=()=>crypto.randomUUID(),hex=v=>String(v||'').replace('#',''),nextFrame=()=>new Promise(r=>setTimeout(r,0));
async function lib(name){
 const files={zip:'jszip-3.10.1.min.js',pptx:'pptxgen-4.0.1.min.js',pdf:'jspdf-4.2.1.umd.min.js'};
 if(!loads.has(name))loads.set(name,new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=new URL('vendor/'+files[name],BASE);s.onload=resolve;s.onerror=()=>{loads.delete(name);s.remove();reject(Error('Could not load the export tools. Please try again.'));};document.head.append(s);}));
 await loads.get(name);
}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
function filename(name){return (String(name||'Presentation').replace(/[<>:"/\\|?*\x00-\x1f]/g,'').trim().slice(0,90)||'Presentation');}
function dataURL(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('Could not read this image.'));r.readAsDataURL(blob);});}
function canvasBlob(c){return new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('Could not render a slide.')),'image/png'));}
async function media(src){const image=new Image();if(!src.startsWith('data:'))image.crossOrigin='anonymous';image.src=src;await image.decode();return image;}
async function imageData(src){
 if(/^data:image\/(png|jpeg|gif);base64,/.test(src))return src;
 const image=await media(src),c=document.createElement('canvas');c.width=Math.min(4096,image.naturalWidth);c.height=Math.round(image.naturalHeight*c.width/image.naturalWidth);if(c.height>4096){c.width=Math.round(c.width*4096/c.height);c.height=4096;}c.getContext('2d').drawImage(image,0,0,c.width,c.height);return c.toDataURL('image/png');
}
function colorHex(value,fallback='263249'){
 if(/^#[0-9a-f]{6}$/i.test(value))return value.slice(1);
 if(/^#[0-9a-f]{3}$/i.test(value))return value.slice(1).split('').map(c=>c+c).join('');
 const m=/^rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)/.exec(value||'');return m?m.slice(1,4).map(x=>Math.min(255,+x).toString(16).padStart(2,'0')).join(''):fallback;
}
function runsFor(e,theme){
 const runs=[],base={fontFace:'Inter',fontSize:e.fontSize*.75,color:e.color==='auto'?(theme==='black'?'F7F8FB':'263249'):colorHex(e.color),bold:e.bold,align:e.align};
 const walk=(n,style)=>{
  if(typeof n.text==='string'){runs.push({text:n.text,options:style});return;}
  const s=n.style||{},o={...style};
  if(s.fontFamily)o.fontFace=s.fontFamily;if(s.fontSize)o.fontSize=s.fontSize*.75;if(s.color)o.color=colorHex(s.color,o.color);
  if(s.fontWeight)o.bold=s.fontWeight==='bold'||+s.fontWeight>=600;
  if(['b','strong'].includes(n.tag))o.bold=true;if(['i','em'].includes(n.tag)||s.fontStyle==='italic')o.italic=true;
  if(n.tag==='u'||s.textDecorationLine?.includes('underline'))o.underline=true;
  if(['s','strike'].includes(n.tag)||s.textDecorationLine?.includes('line-through'))o.strike=true;
  if(s.textAlign)o.align=s.textAlign;if(s.backgroundColor&&s.backgroundColor!=='transparent')o.highlight=colorHex(s.backgroundColor,'FFFFFF');
  if(/^h[123]$/.test(n.tag)){o.bold=true;o.fontSize*=({h1:1.6,h2:1.3,h3:1.1}[n.tag]);}
  if(n.tag==='br'){runs.push({text:'\n',options:o});return;}
  if(n.tag==='li')runs.push({text:'• ',options:o});
  (n.children||[]).forEach(c=>walk(c,o));
  if(['p','div','h1','h2','h3','li','blockquote'].includes(n.tag)&&runs.length)runs.push({text:'\n',options:o});
 };
 if(e.rich?.length)e.rich.forEach(n=>walk(n,base));else runs.push({text:e.text||'',options:base});
 if(runs.at(-1)?.text==='\n')runs.pop();return runs;
}
async function exportFile(format,deck,{asset,render,progress=()=>{}}){
 await document.fonts.ready;const name=filename(deck.title),count=deck.slides.length;
 if(format==='tt'){
  await lib('zip');const zip=new JSZip(),images={};let n=0;
  for(const key of new Set(deck.slides.flatMap(s=>s.elements.filter(e=>e.asset).map(e=>e.asset)).concat((deck.fonts||[]).map(f=>f.asset)))){
   progress('Packing image '+(++n)+'…');const src=await asset(key),match=/^data:(?:image|font)\/(png|jpeg|webp|gif|ttf|otf);base64,(.+)$/.exec(src);if(!match)throw Error('An image could not be included.');
   const path='media/'+key+'.'+match[1];images[key]=path;zip.file(path,match[2],{base64:true});
  }
  zip.file('presentation.json',JSON.stringify({format:'TeacherTilesPresentation',version:1,document:deck,images}));
  download(await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}}),name+'.tt');return;
 }
 if(format==='pptx'){
  await lib('zip');await lib('pptx');const pptx=new PptxGenJS();pptx.defineLayout({name:'TT',width:10,height:5.625});pptx.layout='TT';pptx.author='TeacherTiles';pptx.subject=deck.title;pptx.title=deck.title;pptx.lang='en-US';
  for(const [i,s] of deck.slides.entries()){
   progress('Exporting slide '+(i+1)+' of '+count+'…');const out=pptx.addSlide();
   if(deck.theme==='none')out.background={color:hex(s.background)};else{const c=await render({...deck,slides:[{...s,elements:[]}]},0,1);out.addImage({data:c.toDataURL('image/png'),x:0,y:0,w:10,h:5.625});}
   for(const e of s.elements){const box={x:e.x/96,y:e.y/96,w:e.w/96,h:e.h/96,rotate:e.rotation||0};
    if(e.type==='text'&&JSON.stringify(e.rich||[]).includes('TTFont_')){const c=await render({...deck,theme:'none',slides:[{background:'#ffffff',elements:[{...e,x:0,y:0,rotation:0}]}]},0,2,true);const crop=document.createElement('canvas');crop.width=Math.ceil(e.w*2);crop.height=Math.ceil(e.h*2);crop.getContext('2d').drawImage(c,0,0);out.addImage({data:crop.toDataURL('image/png'),...box});}
    else if(e.type==='text')out.addText(runsFor(e,deck.theme),{...box,fontFace:'Inter',fontSize:e.fontSize*.75,margin:0,breakLine:false,paraSpaceAfter:0,valign:'top',align:e.align,wrap:true});
    else if(e.type==='shape')out.addShape({rectangle:pptx.ShapeType.rect,ellipse:pptx.ShapeType.ellipse,triangle:pptx.ShapeType.triangle}[e.shape],{...box,line:{color:hex(e.color),transparency:100},fill:{color:hex(e.color)}});
    else if(e.emoji){const c=await render({theme:'none',slides:[{background:'#ffffff',elements:[{...e,x:0,y:0,rotation:0}]}]},0,1,true);const crop=document.createElement('canvas');crop.width=e.w;crop.height=e.h;crop.getContext('2d').drawImage(c,0,0);out.addImage({data:crop.toDataURL('image/png'),...box});}
    else{const src=await imageData(e.asset?await asset(e.asset):e.src),img=await media(src),k=Math.min(box.w/img.width,box.h/img.height),w=img.width*k,h=img.height*k;out.addImage({data:src,...box,x:box.x+(box.w-w)/2,y:box.y+(box.h-h)/2,w,h});}
   }await nextFrame();
  }
  download(new Blob([await pptx.write({outputType:'arraybuffer',compression:true})],{type:'application/vnd.openxmlformats-officedocument.presentationml.presentation'}),name+'.pptx');return;
 }
 if(format==='pdf')await lib('pdf');else await lib('zip');
 const pdf=format==='pdf'?new jspdf.jsPDF({orientation:'landscape',unit:'pt',format:[720,405],compress:true}):null,zip=pdf?null:new JSZip();
 for(let i=0;i<count;i++){
  progress('Rendering slide '+(i+1)+' of '+count+'…');const c=await render(deck,i,2);
  if(pdf){if(i)pdf.addPage([720,405],'landscape');pdf.addImage(c.toDataURL('image/png'),'PNG',0,0,720,405,undefined,'FAST');}
  else{const b=await canvasBlob(c);if(count===1){download(b,name+'.png');return;}zip.file('Slide-'+String(i+1).padStart(3,'0')+'.png',b);}
  c.width=c.height=1;await nextFrame();
 }
 if(pdf){pdf.setProperties({title:deck.title,creator:'TeacherTiles'});download(pdf.output('blob'),name+'.pdf');}else download(await zip.generateAsync({type:'blob'}),name+'-slides.zip');
}
// Check expanded sizes before asking JSZip to inflate any entry; reject unsafe paths and external media.
async function archive(file){
 if(file.size>50*MB)throw Error('Choose a presentation smaller than 50 MB.');
 await lib('zip');let zip;try{zip=await JSZip.loadAsync(await file.arrayBuffer());}catch{throw Error('This is not a valid .pptx or .tt file.');}
 let total=0;const entries=Object.values(zip.files);if(entries.length>6000)throw Error('This file contains too many parts.');
 for(const f of entries){const n=f.unsafeOriginalName||f.name;if(n.startsWith('/')||n.includes('\\')||n.split('/').includes('..'))throw Error('The file contains an unsafe path.');const size=f._data?.uncompressedSize||0;total+=size;if(size>40*MB||total>100*MB)throw Error('This presentation is too large when unpacked.');}
 return zip;
}
function xml(text){const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.querySelector('parsererror')||/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('Invalid PowerPoint XML.');return doc;}
const children=(n,name)=>[...(n?.children||[])].filter(x=>x.localName===name),first=(n,name)=>children(n,name)[0],all=(n,name)=>[...(n?.getElementsByTagNameNS('*',name)||[])],one=(n,name)=>all(n,name)[0];
async function readXML(zip,path){const f=zip.file(path);if(!f)return null;if(f._data.uncompressedSize>6*MB)throw Error('A presentation part is too large.');return xml(await f.async('string'));}
function resolvePath(base,target){if(/^(?:[a-z]+:|\/\/)/i.test(target))return null;const p=target.startsWith('/')?[]:base.split('/').slice(0,-1);for(const part of target.split('/')){if(part==='..'){if(!p.length)return null;p.pop();}else if(part&&part!=='.')p.push(part);}return p.join('/');}
async function rels(zip,path){const parts=path.split('/'),file=parts.pop(),doc=await readXML(zip,parts.join('/')+'/_rels/'+file+'.rels'),map=new Map();for(const r of all(doc,'Relationship'))if(r.getAttribute('TargetMode')!=='External'){const target=resolvePath(path,r.getAttribute('Target')||'');if(target)map.set(r.getAttribute('Id'),{path:target,type:r.getAttribute('Type')||''});}return map;}
function relId(n,name='id'){return n?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships',name)||n?.getAttribute('r:'+name);}
async function importFile(file,progress=()=>{}){
 const extension=file.name.split('.').pop().toLowerCase();if(!['tt','pptx'].includes(extension))throw Error('Upload a .pptx PowerPoint file or a .tt TeacherTiles file.');const zip=await archive(file);
 if(extension==='tt'){
  const entry=zip.file('presentation.json');if(!entry||entry._data.uncompressedSize>700000)throw Error('Invalid TeacherTiles presentation.');let data;try{data=JSON.parse(await entry.async('string'));}catch{throw Error('Invalid TeacherTiles presentation.');}
  if(data.format!=='TeacherTilesPresentation'||data.version!==1||data.document?.schemaVersion!==1)throw Error('This TeacherTiles file version is not supported.');
  const images=new Map();let total=0;const refs=new Set((data.document.slides||[]).flatMap(s=>(s.elements||[]).filter(e=>e.type==='image').map(e=>e.asset)).concat((data.document.fonts||[]).map(f=>f.asset)));
  if(refs.size>100)throw Error('A presentation can contain up to 100 uploaded images.');
  for(const key of refs){if(!/^[\w-]{1,80}$/.test(key))throw Error('Invalid image reference.');const path=data.images?.[key];if(typeof path!=='string'||!/^media\/[\w-]+\.(png|jpeg|webp|gif|ttf|otf)$/.test(path))throw Error('Missing presentation image.');const f=zip.file(path);if(!f||f._data.uncompressedSize>6*MB)throw Error('An image is missing or exceeds 6 MB.');total+=f._data.uncompressedSize;if(total>32*MB)throw Error('Images exceed the 32 MB presentation limit.');images.set(key,'data:'+(/\.(ttf|otf)$/.test(path)?'font':'image')+'/'+path.split('.').pop()+';base64,'+await f.async('base64'));}
  // The server normalizes the document before it is ever rendered by the editor.
  return {document:data.document,images,warnings:[]};
 }
 return importPowerPoint(zip,file.name,progress);
}
async function importPowerPoint(zip,name,progress){
 const doc=await readXML(zip,'ppt/presentation.xml');if(!doc)throw Error('This file does not contain a PowerPoint presentation.');
 const links=await rels(zip,'ppt/presentation.xml'),size=one(doc,'sldSz'),cx=+(size?.getAttribute('cx')||12192000),cy=+(size?.getAttribute('cy')||6858000);
 if(!Number.isFinite(cx)||!Number.isFinite(cy)||cx<=0||cy<=0)throw Error('Invalid slide size.');
 const scale=Math.min(960/cx,540/cy),offsetX=(960-cx*scale)/2,offsetY=(540-cy*scale)/2;
 const ids=all(doc,'sldId');if(!ids.length||ids.length>500)throw Error('Import between 1 and 500 slides.');
 const images=new Map(),imageKeys=new Map(),warnings=new Set(),slides=[],embeddedFonts=[],fontNames=new Map(),decoded=new Map();let total=0;
 const warning=()=>warnings.add('Some PowerPoint features (such as charts, effects, animations, or unsupported shapes) need review after import.');

 async function storeData(data){const bytes=Uint8Array.from(atob(data.split(',')[1]),c=>c.charCodeAt(0)),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');if(images.has(hash))return hash;if(bytes.length>6*MB||total+bytes.length>32*MB||images.size>=100)throw Error('Imported assets exceed the 6 MB per image, 32 MB total, or 100 asset limit.');total+=bytes.length;images.set(hash,data);return hash;}
 async function source(path){if(decoded.has(path))return decoded.get(path);const entry=zip.file(path);if(!entry){warning();return null;}if(entry._data.uncompressedSize>6*MB)throw Error('An imported image exceeds 6 MB.');const ext=path.split('.').pop().toLowerCase(),mime={png:'png',jpg:'jpeg',jpeg:'jpeg',gif:'gif',webp:'webp',svg:'svg+xml'}[ext];if(!mime){warnings.add('Some media could not be imported. Video, audio, and metafiles are not supported yet.');return null;}let data;if(ext==='svg'){
  const svg=xml(await entry.async('string'));for(const node of [...svg.getElementsByTagName('*')]){if(['script','foreignObject','style','animate','set','use','image'].includes(node.localName)){node.remove();continue;}for(const attr of [...node.attributes])if(/^on/i.test(attr.name)||/href|style/i.test(attr.name)||/url\s*\(/i.test(attr.value))node.removeAttribute(attr.name);}const text=new XMLSerializer().serializeToString(svg);data='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(text)));
 }else data='data:image/'+mime+';base64,'+await entry.async('base64');try{const img=await media(data);decoded.set(path,img);return img;}catch{warning();return null;}}
 // PowerPoint .fntdata commonly wraps an uncompressed sfnt in an EOT header.
 for(const entry of all(doc,'embeddedFont')){
  if(embeddedFonts.length>=8)break;const name=first(entry,'font')?.getAttribute('typeface'),part=links.get(relId(first(entry,'regular')))?.path,f=part&&zip.file(part);if(!name||!f||f._data.uncompressedSize>500000)continue;
  try{let bytes=await f.async('uint8array');const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);if(bytes.length>82&&view.getUint16(34,true)===0x504c){const length=view.getUint32(4,true),flags=view.getUint32(12,true);if(flags&4||length>bytes.length)throw Error('Compressed font');bytes=bytes.slice(bytes.length-length);}if(bytes.length<12||!((bytes[0]===0&&bytes[1]===1&&bytes[2]===0&&bytes[3]===0)||String.fromCharCode(...bytes.slice(0,4))==='OTTO'))throw Error('Unsupported font');const data=await dataURL(new Blob([bytes],{type:'font/'+(bytes[0]===0?'ttf':'otf')})),key=await storeData(data),family='TTFont_'+key,face=new FontFace(family,bytes);await face.load();if(![...document.fonts].some(f=>f.family===family))document.fonts.add(face);embeddedFonts.push({name,family,asset:key});fontNames.set(name,family);}catch{warnings.add('An embedded font could not be loaded; its text uses a fallback font.');}
 }
 function matrixFor(xfrm,parent){const off=first(xfrm,'off'),ext=first(xfrm,'ext'),x=+(off?.getAttribute('x')||0),y=+(off?.getAttribute('y')||0),w=+(ext?.getAttribute('cx')||0),h=+(ext?.getAttribute('cy')||0),flipH=['1','true'].includes(xfrm?.getAttribute('flipH')),flipV=['1','true'].includes(xfrm?.getAttribute('flipV')),angle=+(xfrm?.getAttribute('rot')||0)/60000;return parent.translate(x+w/2,y+h/2).rotate(angle).scale(flipH?-1:1,flipV?-1:1).translate(-w/2,-h/2);}
 function trace(ctx,properties,w,h){const custom=one(properties,'custGeom'),paths=children(one(custom,'pathLst'),'path');if(paths.length){ctx.beginPath();for(const path of paths){const sx=w/(+path.getAttribute('w')||w),sy=h/(+path.getAttribute('h')||h);for(const command of path.children){const pts=children(command,'pt').map(p=>[+p.getAttribute('x')*sx,+p.getAttribute('y')*sy]);if(pts.some(p=>!p.every(Number.isFinite))){warning();continue;}switch(command.localName){case 'moveTo':ctx.moveTo(...pts[0]);break;case 'lnTo':ctx.lineTo(...pts[0]);break;case 'cubicBezTo':ctx.bezierCurveTo(...pts.flat());break;case 'quadBezTo':ctx.quadraticCurveTo(...pts.flat());break;case 'close':ctx.closePath();break;default:warning();}}}return;}ctx.beginPath();switch(one(properties,'prstGeom')?.getAttribute('prst')){case 'ellipse':ctx.ellipse(w/2,h/2,w/2,h/2,0,0,Math.PI*2);break;case 'triangle':ctx.moveTo(w/2,0);ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.closePath();break;case 'roundRect':ctx.roundRect(0,0,w,h,Math.min(w,h)*.12);break;default:ctx.rect(0,0,w,h);}}
 async function graphic(n,properties,map,m,w,h,color){
  const corners=[[0,0],[w,0],[0,h],[w,h]].map(([x,y])=>new DOMPoint(x,y).matrixTransform(m)),left=Math.max(0,Math.floor(Math.min(...corners.map(p=>p.x)))),top=Math.max(0,Math.floor(Math.min(...corners.map(p=>p.y)))),right=Math.min(960,Math.ceil(Math.max(...corners.map(p=>p.x)))),bottom=Math.min(540,Math.ceil(Math.max(...corners.map(p=>p.y))));if(right<=left||bottom<=top)return null;
  const c=document.createElement('canvas');c.width=(right-left)*2;c.height=(bottom-top)*2;const g=c.getContext('2d');g.setTransform(m.a*2,m.b*2,m.c*2,m.d*2,(m.e-left)*2,(m.f-top)*2);trace(g,properties,w,h);
  const fill=first(properties,'solidFill'),blipFill=first(properties,'blipFill')||first(n,'blipFill'),blip=one(blipFill,'blip');
  if(blip){const target=map.get(relId(blip,'embed'))?.path;if(!target){warnings.add('An external image was skipped. Embed linked images before importing.');return null;}const img=await source(target);if(!img)return null;g.save();g.clip();const alpha=one(blip,'alphaModFix');g.globalAlpha=Math.max(0,Math.min(1,+(alpha?.getAttribute('amt')||100000)/100000));const crop=one(blipFill,'srcRect'),dest=one(blipFill,'fillRect'),value=(node,k)=>+(node?.getAttribute(k)||0)/100000,l=value(crop,'l'),r=value(crop,'r'),t=value(crop,'t'),b=value(crop,'b'),dl=value(dest,'l'),dr=value(dest,'r'),dt=value(dest,'t'),db=value(dest,'b');g.drawImage(img,img.width*l,img.height*t,img.width*(1-l-r),img.height*(1-t-b),w*dl,h*dt,w*(1-dl-dr),h*(1-dt-db));g.restore();}
  else if(fill){g.fillStyle=color(fill,'#91add5');const alpha=one(fill,'alpha');g.globalAlpha=alpha?+alpha.getAttribute('val')/100000:1;g.fill();g.globalAlpha=1;}
  const line=first(properties,'ln');if(line&&!first(line,'noFill')){g.strokeStyle=color(first(line,'solidFill'),'#263249');g.lineWidth=+(line.getAttribute('w')||12700);g.stroke();}
  if(!blip&&!fill&&!line)return null;
  const key=await storeData(c.toDataURL('image/png'));return {id:uid(),type:'image',asset:key,x:left,y:top,w:right-left,h:bottom-top,rotation:0};
 }

 for(const [index,slideId] of ids.entries()){
  progress('Reading slide '+(index+1)+' of '+ids.length+'…');const path=links.get(relId(slideId))?.path;if(!path)throw Error('A PowerPoint slide is missing.');const s=await readXML(zip,path);if(!s)throw Error('A PowerPoint slide is missing.');const sr=await rels(zip,path),layoutPath=[...sr.values()].find(r=>r.type.endsWith('/slideLayout'))?.path,layout=layoutPath?await readXML(zip,layoutPath):null,lr=layoutPath?await rels(zip,layoutPath):new Map(),masterPath=[...lr.values()].find(r=>r.type.endsWith('/slideMaster'))?.path,master=masterPath?await readXML(zip,masterPath):null,mr=masterPath?await rels(zip,masterPath):new Map(),themePath=[...mr.values()].find(r=>r.type.endsWith('/theme'))?.path,theme=await readXML(zip,themePath||'ppt/theme/theme1.xml');
  const palette={dk1:'000000',lt1:'FFFFFF',dk2:'263249',lt2:'EEEEEE',accent1:'91ADD5',accent2:'EAB795',accent3:'A7C4A0'};
  for(const c of one(theme,'clrScheme')?.children||[]){const value=c.firstElementChild;palette[c.localName]=value?.getAttribute('val')?.replace(/^window.*$/,'')||value?.getAttribute('lastClr')||palette[c.localName];}
  function color(node,fallback){if(!node)return fallback;const rgb=one(node,'srgbClr'),sys=one(node,'sysClr'),scheme=one(node,'schemeClr');let v=rgb?.getAttribute('val')||sys?.getAttribute('lastClr')||palette[({tx1:'dk1',tx2:'dk2',bg1:'lt1',bg2:'lt2'}[scheme?.getAttribute('val')]||scheme?.getAttribute('val'))];if(!/^[0-9a-f]{6}$/i.test(v||''))return fallback;const root=rgb||sys||scheme;let channels=v.match(/../g).map(x=>parseInt(x,16));for(const t of root?.children||[]){const n=+t.getAttribute('val')/100000;if(t.localName==='lumMod')channels=channels.map(c=>c*n);if(t.localName==='lumOff')channels=channels.map(c=>c+255*n);if(t.localName==='tint')channels=channels.map(c=>c+(255-c)*n);if(t.localName==='shade')channels=channels.map(c=>c*n);}return '#'+channels.map(c=>Math.max(0,Math.min(255,Math.round(c))).toString(16).padStart(2,'0')).join('');}
  const bg=one(s,'bg')||one(layout,'bg')||one(master,'bg'),slide={id:uid(),background:color(one(bg,'solidFill'),'#ffffff'),elements:[]};
  function placeholder(n,tree){const ph=one(n,'ph');if(!ph)return null;return all(tree,'sp').find(x=>{const p=one(x,'ph');return p&&(p.getAttribute('idx')||'0')===(ph.getAttribute('idx')||'0')&&(p.getAttribute('type')||'body')===(ph.getAttribute('type')||'body');});}

  async function visit(n,map,parent=new DOMMatrix([scale,0,0,scale,offsetX,offsetY])){
   if(n.localName==='grpSp'){
    const x=one(first(n,'grpSpPr'),'xfrm'),ext=first(x,'ext'),co=first(x,'chOff'),ce=first(x,'chExt');if(!x){warning();return;}
    const sx=+(ext?.getAttribute('cx')||1)/+(ce?.getAttribute('cx')||1),sy=+(ext?.getAttribute('cy')||1)/+(ce?.getAttribute('cy')||1);if(!Number.isFinite(sx)||!Number.isFinite(sy))return;
    const m=matrixFor(x,parent).scale(sx,sy).translate(-+(co?.getAttribute('x')||0),-+(co?.getAttribute('y')||0));for(const child of n.children)await visit(child,map,m);return;
   }
   if(!['sp','pic','graphicFrame','cxnSp'].includes(n.localName))return;
   if(['graphicFrame','cxnSp'].includes(n.localName)){warning();return;}
   if(one(n,'videoFile')||one(n,'audioFile'))warnings.add('Video/audio playback is not supported yet; the poster image is preserved.');
   const inherited=placeholder(n,layout)||placeholder(n,master),properties=first(n,'spPr'),xfrm=one(properties,'xfrm')||one(first(inherited,'spPr'),'xfrm'),off=first(xfrm,'off'),ext=first(xfrm,'ext');if(!off||!ext){warning();return;}
   const w=+ext.getAttribute('cx'),h=+ext.getAttribute('cy'),m=matrixFor(xfrm,parent),width=w*Math.hypot(m.a,m.b),height=h*Math.hypot(m.c,m.d),center=new DOMPoint(w/2,h/2).matrixTransform(m),base={id:uid(),x:center.x-width/2,y:center.y-height/2,w:width,h:height,rotation:((Math.atan2(m.b,m.a)*180/Math.PI)%360+360)%360};
   if(![base.x,base.y,base.w,base.h].every(Number.isFinite)||w<=0||h<=0)return;
   const geom=one(properties,'prstGeom'),shape={rect:'rectangle',ellipse:'ellipse',triangle:'triangle'}[geom?.getAttribute('prst')],fill=first(properties,'solidFill'),blip=one(properties,'blipFill')||first(n,'blipFill');
   if(blip||one(properties,'custGeom')||(first(properties,'ln')&&!first(first(properties,'ln'),'noFill')&&one(first(properties,'ln'),'alpha')?.getAttribute('val')!=='0')||one(fill,'alpha')){const art=await graphic(n,properties,map,m,w,h,color);if(art)slide.elements.push(art);}
   else if(fill&&shape)slide.elements.push({...base,type:'shape',shape,color:color(fill,'#91add5')});else if(fill)warning();
   if(n.localName==='pic')return;
   const body=first(n,'txBody');if(!body)return;const paragraphs=children(body,'p'),plain=paragraphs.map(p=>all(p,'t').map(t=>t.textContent).join('')).join('\n');if(!plain)return;
   const defaultRun=one(first(inherited,'txBody'),'defRPr')||one(master,one(n,'ph')?.getAttribute('type')==='title'?'titleStyle':'bodyStyle')?.getElementsByTagNameNS('*','defRPr')[0];
   const fontScale=Math.hypot(m.a,m.b)*12700,rich=paragraphs.map(p=>{const pp=first(p,'pPr'),defaults=first(pp,'defRPr')||defaultRun,align={l:'left',ctr:'center',r:'right',just:'justify'}[pp?.getAttribute('algn')]||'left',nodes=[];
    for(const run of p.children){if(run.localName==='br'){nodes.push({tag:'br',children:[]});continue;}if(!['r','fld'].includes(run.localName))continue;const rp=first(run,'rPr')||defaults,font=one(rp,'latin')?.getAttribute('typeface'),style={fontSize:Math.max(6,Math.min(300,+(rp?.getAttribute('sz')||defaults?.getAttribute('sz')||2400)/100*fontScale)),color:color(one(rp,'solidFill'),color(one(defaults,'solidFill'),'#263249'))};if(font&&!font.startsWith('+'))style.fontFamily=fontNames.get(font)||font;if(rp?.getAttribute('b')==='1')style.fontWeight='bold';if(rp?.getAttribute('i')==='1')style.fontStyle='italic';if(rp?.getAttribute('u')&&rp.getAttribute('u')!=='none')style.textDecorationLine='underline';nodes.push({tag:'span',style,children:[{text:one(run,'t')?.textContent||''}]});}
    if(one(pp,'buChar'))nodes.unshift({text:'• '});const sz=nodes.find(n=>n.style?.fontSize)?.style.fontSize||32,spacing=one(pp,'lnSpc'),pts=one(spacing,'spcPts'),pct=one(spacing,'spcPct'),lineHeight=pts?+pts.getAttribute('val')/100*fontScale/sz:pct?+pct.getAttribute('val')/100000:1.18;return {tag:'p',style:{textAlign:align,lineHeight:Math.max(.5,Math.min(4,lineHeight))},children:nodes};});
   const bodyPr=first(body,'bodyPr'),unit=Math.hypot(m.a,m.b),left=+(bodyPr?.getAttribute('lIns')??91440)*unit,right=+(bodyPr?.getAttribute('rIns')??91440)*unit,top=+(bodyPr?.getAttribute('tIns')??45720)*unit,bottom=+(bodyPr?.getAttribute('bIns')??45720)*unit;const fontSize=rich[0]?.children.find(n=>n.style?.fontSize)?.style.fontSize||32;base.x+=left;base.y+=top;base.w=Math.max(1,base.w-left-right);base.h=Math.max(1,base.h-top-bottom);const lines=rich.reduce((sum,p)=>sum+(p.children.find(n=>n.style?.fontSize)?.style.fontSize||fontSize)*(p.style.lineHeight||1.18),0),anchor=bodyPr?.getAttribute('anchor');if(anchor==='ctr')base.y+=Math.max(0,(base.h-lines)/2);if(anchor==='b')base.y+=Math.max(0,base.h-lines);if(anchor==='ctr'||anchor==='b')base.h=Math.min(base.h,lines+fontSize*.2);slide.elements.push({...base,id:uid(),type:'text',text:plain,fontSize,color:'#263249',bold:false,align:rich[0]?.style.textAlign||'left',rich});
  }
  // Preserve non-placeholder artwork on masters/layouts behind the slide's own objects.
  if(s.documentElement.getAttribute('showMasterSp')!=='0')for(const [tree,map] of [[master,mr],[layout,lr]])for(const n of one(tree,'spTree')?.children||[])if(!one(n,'ph'))await visit(n,map);
  for(const n of one(s,'spTree')?.children||[])await visit(n,sr);
  if(one(s,'timing')||one(s,'transition')||one(bg,'gradFill')||one(bg,'blipFill'))warning();
  if(slide.elements.length>100)throw Error('Slide '+(index+1)+' exceeds the 100 object limit.');slides.push(slide);await nextFrame();
 }
 const used=new Set(slides.flatMap(s=>s.elements.filter(e=>e.asset).map(e=>e.asset)).concat(embeddedFonts.map(f=>f.asset)));for(const key of images.keys())if(!used.has(key))images.delete(key);
 return {document:{schemaVersion:1,title:name.replace(/\.pptx$/i,'').slice(0,100),theme:'none',slides,...(embeddedFonts.length?{fonts:embeddedFonts}:{})},images,warnings:[...warnings]};
}
window.TeacherTilesPresentationFiles={exportFile,importFile};
})();

