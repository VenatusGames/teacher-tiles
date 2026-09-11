(() => {
  'use strict';

  const LIB_URL='https://esm.sh/@imgly/background-removal@1.7.0?bundle&deps=onnxruntime-web@1.21.0-dev.20250206-d981b153d3';
  const MAX_RESULTS=6;
  const MAX_PROCESS_SIDE=1280;
  const MAX_SHELF_SIDE=860;
  const TARGET_DATA_LENGTH=125000;

  let removerPromise=null;

  function clamp(value,min,max){return Math.max(min,Math.min(max,value))}

  function loadRemover(){
    if(!removerPromise){
      removerPromise=import(LIB_URL).then(mod=>mod.default||mod.removeBackground).then(fn=>{
        if(typeof fn!=='function')throw new Error('Background remover failed to load.');
        return fn;
      }).catch(error=>{
        removerPromise=null;
        throw error;
      });
    }
    return removerPromise;
  }

  function readAsDataUrl(blob){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(typeof reader.result==='string'?reader.result:'');
      reader.onerror=()=>reject(reader.error||new Error('Could not read image.'));
      reader.readAsDataURL(blob);
    });
  }

  function canvasToBlob(canvas,type,quality){
    return new Promise(resolve=>canvas.toBlob(resolve,type,quality));
  }

  async function decodeImage(blob){
    if('createImageBitmap' in window){
      try{return await createImageBitmap(blob)}catch{}
    }
    const url=URL.createObjectURL(blob);
    try{
      const image=new Image();
      image.src=url;
      await image.decode();
      return image;
    }finally{
      URL.revokeObjectURL(url);
    }
  }

  async function resizeForProcessing(file){
    const image=await decodeImage(file);
    const width=image.width||image.naturalWidth||1;
    const height=image.height||image.naturalHeight||1;
    const scale=Math.min(1,MAX_PROCESS_SIDE/Math.max(width,height));
    if(scale>=.999)return file;
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(width*scale));
    canvas.height=Math.max(1,Math.round(height*scale));
    const ctx=canvas.getContext('2d',{alpha:true});
    ctx.drawImage(image,0,0,canvas.width,canvas.height);
    image.close?.();
    return await canvasToBlob(canvas,'image/png')||file;
  }

  async function makeShelfData(blob){
    const image=await decodeImage(blob);
    const width=image.width||image.naturalWidth||1;
    const height=image.height||image.naturalHeight||1;
    let scale=Math.min(1,MAX_SHELF_SIDE/Math.max(width,height));
    let best='';
    let mime='image/png';

    for(let attempt=0;attempt<8;attempt++){
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(width*scale));
      canvas.height=Math.max(1,Math.round(height*scale));
      const ctx=canvas.getContext('2d',{alpha:true});
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(image,0,0,canvas.width,canvas.height);

      const pngBlob=await canvasToBlob(canvas,'image/png');
      if(pngBlob){
        const pngData=await readAsDataUrl(pngBlob);
        best=pngData;
        mime='image/png';
        if(pngData.length<=TARGET_DATA_LENGTH)break;
      }

      const webpBlob=await canvasToBlob(canvas,'image/webp',.86);
      if(webpBlob){
        const webpData=await readAsDataUrl(webpBlob);
        if(!best||webpData.length<best.length){best=webpData;mime='image/webp'}
        if(webpData.length<=TARGET_DATA_LENGTH)break;
      }

      const longest=Math.max(canvas.width,canvas.height);
      if(longest<=300)break;
      scale*=.8;
    }
    image.close?.();
    return{dataUrl:best,mime};
  }

  function extensionFor(dataUrl,mime=''){
    if(mime.includes('webp')||String(dataUrl).startsWith('data:image/webp'))return'webp';
    if(mime.includes('jpeg')||String(dataUrl).startsWith('data:image/jpeg'))return'jpg';
    return'png';
  }

  function setup(m){
    const dropzone=m.querySelector('.backgroundremover-dropzone');
    const input=m.querySelector('.backgroundremover-input');
    const preview=m.querySelector('.backgroundremover-preview');
    const previewImage=m.querySelector('.backgroundremover-preview-image');
    const choose=m.querySelector('.backgroundremover-choose');
    const removeButton=m.querySelector('.backgroundremover-remove');
    const replaceButton=m.querySelector('.backgroundremover-replace');
    const clearButton=m.querySelector('.backgroundremover-clear');
    const status=m.querySelector('.backgroundremover-status');
    const list=m.querySelector('.backgroundremover-result-list');
    const count=m.querySelector('.backgroundremover-result-count');
    const drawerToggle=m.querySelector('.backgroundremover-drawer-toggle');
    const progress=m.querySelector('.backgroundremover-progress');

    let sourceFile=null;
    let sourceUrl='';
    let results=[];
    let busy=false;
    let disposed=false;

    const setStatus=text=>{status.textContent=text};

    const setBusy=value=>{
      busy=Boolean(value);
      m.classList.toggle('is-processing',busy);
      progress.hidden=!busy;
      removeButton.disabled=busy||!sourceFile||results.length>=MAX_RESULTS;
      replaceButton.disabled=busy;
      clearButton.disabled=busy;
    };

    const setSource=file=>{
      if(!file||!file.type?.startsWith('image/')){
        setStatus('Choose a PNG, JPG, or WebP image.');
        return;
      }
      sourceFile=file;
      if(sourceUrl)URL.revokeObjectURL(sourceUrl);
      sourceUrl=URL.createObjectURL(file);
      previewImage.src=sourceUrl;
      previewImage.alt=file.name||'Image selected for background removal';
      dropzone.hidden=true;
      preview.hidden=false;
      setStatus('Image ready. Select Remove background.');
      setBusy(false);
    };

    const clearSource=(message='Choose an image to remove its background.')=>{
      sourceFile=null;
      if(sourceUrl)URL.revokeObjectURL(sourceUrl);
      sourceUrl='';
      previewImage.removeAttribute('src');
      previewImage.alt='';
      preview.hidden=true;
      dropzone.hidden=false;
      input.value='';
      setBusy(false);
      setStatus(message);
    };

    const renderResults=()=>{
      count.textContent=String(results.length);
      list.replaceChildren();
      if(!results.length){
        const empty=document.createElement('p');
        empty.className='backgroundremover-result-empty';
        empty.textContent='Removed-background images will appear here.';
        list.appendChild(empty);
        return;
      }

      results.forEach((result,index)=>{
        const card=document.createElement('div');
        card.className='backgroundremover-result-card';
        card.draggable=true;
        card.tabIndex=0;
        card.setAttribute('role','img');
        card.setAttribute('aria-label',`Removed background image ${index+1}. Drag onto the board.`);

        const checker=document.createElement('span');
        checker.className='backgroundremover-result-checker';
        const image=document.createElement('img');
        image.src=result.dataUrl;
        image.alt='';
        image.draggable=false;
        checker.appendChild(image);

        const actions=document.createElement('div');
        actions.className='backgroundremover-result-actions';
        const download=document.createElement('button');
        download.type='button';
        download.textContent='↓';
        download.className='backgroundremover-result-download';
        download.title='Download image';
        download.setAttribute('aria-label',`Download removed background image ${index+1}`);
        download.addEventListener('pointerdown',event=>event.stopPropagation());
        download.addEventListener('click',event=>{
          event.stopPropagation();
          const link=document.createElement('a');
          link.href=result.dataUrl;
          link.download=`teachertiles-background-removed-${index+1}.${extensionFor(result.dataUrl,result.mime)}`;
          link.click();
        });

        const remove=document.createElement('button');
        remove.type='button';
        remove.textContent='×';
        remove.className='backgroundremover-result-delete';
        remove.setAttribute('aria-label',`Delete removed background image ${index+1}`);
        remove.addEventListener('pointerdown',event=>event.stopPropagation());
        remove.addEventListener('click',event=>{
          event.stopPropagation();
          results.splice(index,1);
          renderResults();
          setBusy(false);
          window.notifyBoardChanged?.('background-remover-delete');
        });

        actions.append(download,remove);
        card.addEventListener('dragstart',event=>{
          event.stopPropagation();
          event.dataTransfer?.setData('application/x-teachertiles-photo',result.dataUrl);
          if(event.dataTransfer)event.dataTransfer.effectAllowed='copy';
          card.classList.add('is-dragging');
        });
        card.addEventListener('dragend',()=>card.classList.remove('is-dragging'));
        card.append(checker,actions);
        list.appendChild(card);
      });
    };

    const processImage=async()=>{
      if(busy||!sourceFile)return;
      if(results.length>=MAX_RESULTS){
        setStatus(`The shelf holds up to ${MAX_RESULTS} images. Delete one to remove another background.`);
        return;
      }
      setBusy(true);
      setStatus('Loading the background remover… The first image can take a little longer.');
      try{
        const removeBackground=await loadRemover();
        if(disposed)return;
        setStatus('Removing the background…');
        const prepared=await resizeForProcessing(sourceFile);
        const resultBlob=await removeBackground(prepared);
        if(disposed)return;
        setStatus('Finishing transparent image…');
        const stored=await makeShelfData(resultBlob);
        if(!stored.dataUrl)throw new Error('Could not save the result.');
        results.unshift(stored);
        results=results.slice(0,MAX_RESULTS);
        renderResults();
        m.classList.add('is-drawer-open');
        drawerToggle.setAttribute('aria-expanded','true');
        setStatus('Background removed. Drag it onto the board or download it from the shelf.');
        window.notifyBoardChanged?.('background-remover-result');
      }catch(error){
        console.error('TeacherTiles background remover:',error);
        setStatus('Background removal could not finish. Check your connection, then try again.');
      }finally{
        if(!disposed)setBusy(false);
      }
    };

    const openPicker=()=>{if(!busy)input.click()};
    replaceButton.addEventListener('click',openPicker);
    clearButton.addEventListener('click',()=>{if(!busy)clearSource();});
    dropzone.addEventListener('click',openPicker);
    dropzone.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){event.preventDefault();openPicker()}
    });
    input.addEventListener('change',()=>{
      setSource(input.files?.[0]);
      input.value='';
    });

    dropzone.addEventListener('dragover',event=>{
      event.preventDefault();
      event.stopPropagation();
      dropzone.classList.add('is-dragover');
    });
    dropzone.addEventListener('dragleave',()=>dropzone.classList.remove('is-dragover'));
    dropzone.addEventListener('drop',event=>{
      event.preventDefault();
      event.stopPropagation();
      dropzone.classList.remove('is-dragover');
      setSource([...event.dataTransfer.files].find(file=>file.type?.startsWith('image/')));
    });

    preview.addEventListener('dragover',event=>{event.preventDefault();event.stopPropagation();preview.classList.add('is-dragover')});
    preview.addEventListener('dragleave',()=>preview.classList.remove('is-dragover'));
    preview.addEventListener('drop',event=>{
      event.preventDefault();
      event.stopPropagation();
      preview.classList.remove('is-dragover');
      const file=[...event.dataTransfer.files].find(item=>item.type?.startsWith('image/'));
      if(file)setSource(file);
    });

    removeButton.addEventListener('click',processImage);
    drawerToggle.addEventListener('click',()=>{
      const open=m.classList.toggle('is-drawer-open');
      drawerToggle.setAttribute('aria-expanded',String(open));
    });
    list.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});


    renderResults();
    clearSource();

    m._boardGetState=()=>({results:results.map(result=>({...result}))});
    m._boardSetState=state=>{
      results=Array.isArray(state?.results)?state.results.filter(result=>typeof result?.dataUrl==='string'&&result.dataUrl.startsWith('data:image/')).slice(0,MAX_RESULTS).map(result=>({dataUrl:result.dataUrl,mime:String(result.mime||'')})):[];
      renderResults();
      if(results.length){
        m.classList.add('is-drawer-open');
        drawerToggle.setAttribute('aria-expanded','true');
      }
      setBusy(false);
    };

    const priorCleanup=m._cleanup;
    m._cleanup=()=>{
      disposed=true;
      if(sourceUrl)URL.revokeObjectURL(sourceUrl);
      priorCleanup?.();
    };
  }

  window.TeacherTilesBackgroundRemover=Object.freeze({setup});
})();
