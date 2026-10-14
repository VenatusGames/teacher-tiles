function getDraggedImageSource(dt){
  if(window.TeacherTilesImageSearch && [...dt.types].includes(window.TeacherTilesImageSearch.DRAG_TYPE)){
    const item=window.TeacherTilesImageSearch.readDrag(dt);
    return item?{url:item.url,attribution:item}:null;
  }
  const file=[...dt.files].find(f=>f.type.startsWith('image/'));if(file)return{file};
  const uri=(dt.getData('text/uri-list')||'').split(/\r?\n/).find(x=>x&&!x.startsWith('#'));
  const html=dt.getData('text/html')||'';const match=html.match(/<img[^>]+src=["']([^"']+)["']/i);
  const plain=(dt.getData('text/plain')||'').trim();
  const url=match?.[1]||uri||(/^https?:\/\//i.test(plain)||/^data:image\//i.test(plain)?plain:'');
  return url?{url}:null
}

async function fileToBoardImageData(file,{maxSide=1200,maxLength=760000,quality=.78,minSide=240}={}){
  if(!file||!file.type?.startsWith('image/'))return'';
  const raw=await new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(typeof reader.result==='string'?reader.result:'');
    reader.onerror=()=>reject(reader.error);
    reader.readAsDataURL(file);
  });
  if(!raw)return'';
  try{
    const source=new Image();
    source.src=raw;
    await source.decode();
    let scale=Math.min(1,maxSide/Math.max(source.naturalWidth||1,source.naturalHeight||1));
    const canvas=document.createElement('canvas');
    let data='';
    let nextQuality=quality;
    for(let attempt=0;attempt<7;attempt++){
      canvas.width=Math.max(1,Math.round((source.naturalWidth||1)*scale));
      canvas.height=Math.max(1,Math.round((source.naturalHeight||1)*scale));
      const ctx=canvas.getContext('2d');
      ctx.drawImage(source,0,0,canvas.width,canvas.height);
      data=canvas.toDataURL('image/webp',nextQuality);
      if(data.length<=maxLength)break;
      const longest=Math.max(canvas.width,canvas.height);
      if(longest<=minSide)break;
      scale*=.78;
      nextQuality=Math.max(.46,nextQuality-.07);
    }
    return data.length<=maxLength?data:'';
  }catch{
    return raw.length<maxLength?raw:'';
  }
}

async function boardImagePreviewData(src,{maxSide=220,maxLength=28000}={}){
  if(typeof src!=='string'||!src.startsWith('data:image/'))return src||'';
  try{
    const source=new Image();
    source.src=src;
    await source.decode();
    const ratio=Math.min(1,maxSide/Math.max(source.naturalWidth||1,source.naturalHeight||1));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round((source.naturalWidth||1)*ratio));
    canvas.height=Math.max(1,Math.round((source.naturalHeight||1)*ratio));
    canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);
    for(const quality of [.68,.56,.44]){
      const preview=canvas.toDataURL('image/webp',quality);
      if(preview.length<=maxLength)return preview;
    }
  }catch{}
  return'';
}

function fitEditableText(el,m,cssVar){
  const measure=document.createElement('div');measure.className='text-fit-measure';m.appendChild(measure);
  const fit=()=>{const aw=Math.max(30,el.clientWidth-12),ah=Math.max(26,el.clientHeight-12);measure.style.width=`${aw}px`;measure.style.fontFamily=getComputedStyle(el).fontFamily;measure.style.fontWeight=getComputedStyle(el).fontWeight;measure.style.lineHeight=getComputedStyle(el).lineHeight;measure.textContent=el.innerText||' ';let lo=10,hi=800,best=10;for(let i=0;i<18;i++){const mid=(lo+hi)/2;measure.style.fontSize=`${mid}px`;if(measure.scrollHeight<=ah&&measure.scrollWidth<=aw){best=mid;lo=mid}else hi=mid}m.style.setProperty(cssVar,`${Math.max(10,best*.97)}px`)};
  const ro=new ResizeObserver(()=>requestAnimationFrame(fit));ro.observe(m);ro.observe(el);el.addEventListener('input',fit);requestAnimationFrame(fit);return()=>{ro.disconnect();measure.remove()}
}

function bindEditableModuleTitle(m,selectorOrElement,fallback){
  const title=selectorOrElement instanceof Element?selectorOrElement:m.querySelector(selectorOrElement);
  if(!title)return{get:()=>fallback,set:()=>{}};
  if(title._teacherTilesTitleBinding)return title._teacherTilesTitleBinding;
  const normalize=value=>String(value||'').replace(/[\r\n]+/g,' ').replace(/\s+/g,' ').trim().slice(0,60);
  const set=value=>{title.textContent=normalize(value)||fallback};
  const placeCaretAtEnd=()=>{
    if(document.activeElement!==title||!title.isContentEditable)return;
    const selection=getSelection();
    if(!selection)return;
    const range=document.createRange();
    range.selectNodeContents(title);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  };
  title.addEventListener('keydown',event=>{
    if(event.key===' '){event.stopPropagation();return}
    if(event.key==='Enter'){event.preventDefault();event.stopPropagation();exitModuleTextEdit(title)}
  });
  title.addEventListener('input',()=>{
    const clean=String(title.textContent||'').replace(/[\r\n]+/g,' ').slice(0,60);
    if(title.textContent!==clean){title.textContent=clean;placeCaretAtEnd()}
    notifyBoardChanged('module-title');
  });
  title.addEventListener('blur',()=>set(title.textContent));
  const binding={get:()=>normalize(title.textContent)||fallback,set};
  title._teacherTilesTitleBinding=binding;
  return binding;
}
