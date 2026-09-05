(() => {
  'use strict';
  function safeUrl(value){
    let text=String(value??'').trim();if(!text||text.length>4096)return'';
    if(!/^[a-z][a-z0-9+.-]*:/i.test(text))text=`https://${text}`;
    try{const url=new URL(text);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password&&url.hostname?url.href:'';}catch{return'';}
  }
  const safeImage=value=>typeof value==='string'&&value.length<=760000&&/^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(value)?value:'';
  function setup(m){
    const anchor=m.querySelector('.link-target'),image=m.querySelector('.link-image'),caption=m.querySelector('.link-caption'),form=m.querySelector('.link-form'),urlInput=m.querySelector('.link-url'),labelInput=m.querySelector('.link-label'),fileInput=m.querySelector('.link-file'),status=m.querySelector('.link-status');
    let url='',label='',imageData='',revision=0,disposed=false;
    function render(syncFields=true){
      m.classList.toggle('has-link-image',!!imageData);m.classList.toggle('has-link-target',!!url);
      if(url)anchor.href=url;else anchor.removeAttribute('href');
      const text=label||(url?new URL(url).hostname:'Add a link');caption.textContent=text;
      anchor.setAttribute('aria-label',url?`Open ${text} in a new tab`:'Set up a link');anchor.title=url||'Set up a link';
      if(imageData)image.src=imageData;else image.removeAttribute('src');image.alt=label||'Linked image';image.hidden=!imageData;
      if(syncFields){urlInput.value=url;labelInput.value=label;}m.querySelector('.link-remove-image').disabled=!imageData;
    }
    form.addEventListener('submit',event=>{event.preventDefault();const next=safeUrl(urlInput.value);if(!next){status.textContent='Enter a valid website address, such as https://example.com.';urlInput.focus({preventScroll:true});return;}
      url=next;label=labelInput.value.trim().slice(0,100);render();status.textContent='Link saved.';notifyBoardChanged('link-target');m.querySelector('.tile-settings-toggle').click();
    });
    anchor.addEventListener('click',event=>{if(!url){event.preventDefault();const panel=m.querySelector('.tile-settings-panel');if(panel.hidden)m.querySelector('.tile-settings-toggle').click();urlInput.focus({preventScroll:true});}});
    anchor.addEventListener('keydown',event=>{if(!url&&(event.key==='Enter'||event.key===' ')){event.preventDefault();anchor.click();}});
    async function upload(file){
      if(!file)return;
      if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)||file.size>10*1024*1024){status.textContent='Choose a PNG, JPEG, WebP, or GIF image under 10 MB.';return;}
      const token=++revision;status.textContent='Adding image…';
      try{const data=safeImage(await fileToBoardImageData(file));if(disposed||token!==revision)return;if(!data)throw Error('image');imageData=data;render(false);status.textContent='Image added.';notifyBoardChanged('link-image');}
      catch{if(!disposed&&token===revision)status.textContent='This image could not be opened. Try another image.';}
      finally{if(!disposed)fileInput.value='';}
    }
    fileInput.addEventListener('change',()=>upload(fileInput.files?.[0]));
    m.querySelector('.link-upload').addEventListener('click',()=>fileInput.click());
    m.querySelector('.link-remove-image').addEventListener('click',()=>{revision++;imageData='';render(false);status.textContent='Image removed.';notifyBoardChanged('link-image');});
    m.addEventListener('dragover',e=>{if(e.dataTransfer?.types.includes('Files')){e.preventDefault();e.stopPropagation();}});
    m.addEventListener('drop',e=>{if(!e.dataTransfer?.files.length)return;e.preventDefault();e.stopPropagation();upload(e.dataTransfer.files[0]);});
    m._boardGetState=()=>({url,label,image:imageData});
    m._boardSetState=s=>{revision++;url=safeUrl(s?.url);label=String(s?.label??'').slice(0,100);imageData=safeImage(s?.image);render();};
    const prior=m._cleanup;m._cleanup=()=>{disposed=true;revision++;prior?.();};render();
  }
  window.TeacherTilesLink=Object.freeze({setup,safeUrl,safeImage});
})();
