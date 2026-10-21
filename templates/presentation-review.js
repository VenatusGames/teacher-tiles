// Slides are fetched only when the uploader or reviewer opens this control.
export function presentationReview(state,request){
 const wrap=document.createElement('div'),open=document.createElement('button'),status=document.createElement('p');open.type='button';open.textContent='Review Presentation';status.setAttribute('role','status');wrap.append(open,status);
 open.onclick=async()=>{
  open.disabled=true;status.textContent='Loading slides…';
  try{
   const shared=state.sharedPresentation,api=window.TeacherTilesPresentations;
   const loaded=api?await api.viewerLoad(shared?.id||state.presentationId,shared):await request({action:'presentation-load',id:shared.id,templateId:shared.templateId});
   if(!wrap.isConnected)return;
   const doc=loaded.document,images=new Map();let index=0;
   const image=asset=>{if(!images.has(asset))images.set(asset,request({action:'presentation-asset',id:shared.id,templateId:shared.templateId,asset}).catch(error=>{images.delete(asset);throw error;}));return images.get(asset);};
   const controls=document.createElement('div');controls.style.cssText='display:flex;align-items:center;gap:10px;margin:12px 0';
   const previous=document.createElement('button'),next=document.createElement('button'),select=document.createElement('select');previous.type=next.type='button';previous.textContent='←';next.textContent='→';previous.setAttribute('aria-label','Previous presentation slide');next.setAttribute('aria-label','Next presentation slide');select.setAttribute('aria-label','Review presentation slide');
   doc.slides.forEach((_,i)=>{const option=document.createElement('option');option.value=i;option.textContent='Slide '+(i+1)+' of '+doc.slides.length;select.append(option);});controls.append(previous,select,next);
   const stage=document.createElement('div');stage.className='pres-slide';stage.style.cssText='position:relative;width:100%;aspect-ratio:16/9;container-type:inline-size;overflow:hidden;background:white;isolation:isolate;border:1px solid #dce3ed;border-radius:8px;';
   status.textContent=loaded.title||doc.title;wrap.replaceChildren(status,controls,stage);
   if(!loaded.render)await import('../presentations/themes.js?v=20261017-layout-backgrounds');
   function paint(){previous.disabled=index===0;next.disabled=index===doc.slides.length-1;select.value=index;
    if(loaded.render){loaded.render(stage,index);stage.querySelectorAll('img').forEach(img=>{img.style.maxHeight='none';img.style.margin='0';});return;}
    // Portal review is read-only and never mounts the account presentation editor.
    const slide=doc.slides[index],theme=window.TeacherTilesPresentationThemes;
    stage.replaceChildren();stage.style.backgroundColor=doc.theme==='none'?slide.background:theme.get(doc.theme).background;const art=theme.url(doc.theme,slide.themeLayout);stage.style.backgroundImage=art?'url("'+art+'")':'';stage.style.backgroundSize='100% 100%';
    for(const item of slide.elements){const el=document.createElement('div');el.style.cssText='position:absolute;overflow:hidden;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.18;left:'+item.x/9.6+'%;top:'+item.y/5.4+'%;width:'+item.w/9.6+'%;height:'+item.h/5.4+'%;transform:rotate('+item.rotation+'deg)';
     if(item.type==='text'){el.textContent=item.text;el.style.fontSize=item.fontSize/9.6+'cqw';el.style.textAlign=item.align;el.style.fontWeight=item.bold?'700':'400';el.style.color=item.color==='auto'?(doc.theme==='black'?'#f7f8fb':'#263249'):item.color;}
     if(item.type==='shape'){el.style.background=item.color;if(item.shape==='ellipse')el.style.borderRadius='50%';if(item.shape==='triangle')el.style.clipPath='polygon(50% 0,100% 100%,0 100%)';}
     if(item.emoji){el.textContent=item.emoji;el.style.fontSize=Math.min(item.w,item.h)/12+'cqw';el.style.display='grid';el.style.placeItems='center';}
     if(item.src||item.asset){const img=document.createElement('img');img.alt='Slide image';img.style.cssText='display:block;width:100%;height:100%;max-height:none;object-fit:contain';el.append(img);if(item.src)img.src=item.src;else image(item.asset).then(value=>{if(img.isConnected)img.src=value.image;}).catch(()=>{if(el.isConnected)el.textContent='Image unavailable. Reopen the review to retry.';});}
     stage.append(el);
    }
   }
   previous.onclick=()=>{index--;paint();};next.onclick=()=>{index++;paint();};select.onchange=()=>{index=Number(select.value);paint();};paint();
  }catch(error){open.disabled=false;status.textContent=error.message||'Could not load the presentation.';}
 };return wrap;
}
