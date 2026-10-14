function setupImage(m){
  const stage=m.querySelector('.image-stage'),img=m.querySelector('.image-display'),input=m.querySelector('.image-input'),replace=m.querySelector('.image-replace'),borderStyle=m.querySelector('.image-border-style'),borderColor=m.querySelector('.image-border-color');
  let objectUrl='';
  let boardImageSrc='';
  let boardImagePreviewSrc='';
  let attribution=null;
  const credit=document.createElement('a');
  credit.className='image-source-credit';credit.target='_blank';credit.rel='noopener noreferrer';credit.hidden=true;
  credit.addEventListener('click',event=>event.stopPropagation());
  credit.draggable=false;m.appendChild(credit);
  const setAttribution=value=>{
    attribution=window.TeacherTilesImageSearch?.normalizeResult(value) || null;
    credit.hidden=!attribution;
    if(attribution){
      credit.href=attribution.sourceUrl;
      credit.textContent=[attribution.creator,attribution.license].filter(Boolean).join(' · ');
      credit.title=`${attribution.title} — View source and license`;
      credit.setAttribute('aria-label',credit.title);
    }else credit.removeAttribute('href');
  };

  const applyBorder=()=>{
    const style=borderStyle?.value||'none';
    const color=borderColor?.value||'#17191d';
    m.dataset.imageBorder=style;
    m.style.setProperty('--image-border-color',color);
  };
  applyBorder();

  const fitModule=()=>{
    const ratio=(img.naturalWidth||1)/(img.naturalHeight||1);
    m._imageRatio=ratio;
    const maxW=Math.min(680,innerWidth-36),maxH=Math.min(560,innerHeight-36);
    let w=Math.min(560,maxW),h=w/ratio;
    if(h>maxH){h=maxH;w=h*ratio}
    w=Math.max(220,w);h=w/ratio;
    if(h<150){h=150;w=h*ratio}
    m.style.width=`${w}px`;m.style.height=`${h}px`;
    m.style.left=`${clamp(m.offsetLeft,0,BOARD_WIDTH-w)}px`;
    m.style.top=`${clamp(m.offsetTop,0,BOARD_HEIGHT-h)}px`;
  };

  const setSrc=(src,alt='Board image',{fit=true}={})=>{
    img.onload=()=>{
      const ratio=(img.naturalWidth||1)/(img.naturalHeight||1);
      m._imageRatio=ratio;
      if(fit)fitModule();
    };
    img.onerror=()=>{img.hidden=true;m.classList.remove('has-image')};
    img.src=src;img.alt=alt;img.hidden=false;m.classList.add('has-image');
  };

  const setFile=file=>{
    if(!file||!file.type?.startsWith('image/'))return;
    setAttribution(null);
    if(objectUrl)URL.revokeObjectURL(objectUrl);
    objectUrl=URL.createObjectURL(file);
    setSrc(objectUrl,file.name||'Board image');
    fileToBoardImageData(file).then(data=>{
      if(data){
        boardImageSrc=data;
        return boardImagePreviewData(data).then(preview=>{
          boardImagePreviewSrc=preview;
          notifyBoardChanged('image');
        });
      }
    }).catch(()=>{});
  };

  const setUrl=(url,{notify=true,fit=true,previewSrc='',attribution:sourceCredit=null}={})=>{
    if(!url)return;
    setAttribution(sourceCredit);
    if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=''}
    boardImageSrc=url;
    boardImagePreviewSrc=previewSrc||(!url.startsWith('data:image/')?url:'');
    setSrc(url,attribution?.title||'Board image',{fit});
    if(url.startsWith('data:image/')&&!boardImagePreviewSrc){
      boardImagePreviewData(url).then(preview=>{
        if(!preview)return;
        boardImagePreviewSrc=preview;
        notifyBoardChanged('image-preview');
      }).catch(()=>{});
    }
    if(notify)notifyBoardChanged('image');
  };

  m._setImage=setFile;
  m._setImageUrl=setUrl;
  m._boardGetState=()=>({src:boardImageSrc||(!img.src.startsWith('blob:')?img.src:''),previewSrc:boardImagePreviewSrc,border:borderStyle?.value||'none',borderColor:borderColor?.value||'#17191d',attribution});
  m._boardSetState=state=>{
    if(!state)return;
    if(borderStyle)borderStyle.value=['none','thin','medium','thick','double'].includes(state.border)?state.border:'none';
    if(borderColor&&/^#[0-9a-f]{6}$/i.test(state.borderColor||''))borderColor.value=state.borderColor;
    applyBorder();
    if(state.src)setUrl(state.src,{notify:false,fit:false,previewSrc:String(state.previewSrc||''),attribution:state.attribution});
  };

  stage.addEventListener('click',()=>input.click());
  replace?.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();input.click()});
  borderStyle?.addEventListener('change',()=>{applyBorder();notifyBoardChanged('image-border')});
  borderColor?.addEventListener('input',applyBorder);
  borderColor?.addEventListener('change',()=>{applyBorder();notifyBoardChanged('image-border')});
  input.addEventListener('change',()=>{setFile(input.files?.[0]);input.value=''});
  stage.addEventListener('dragover',e=>{e.preventDefault();e.stopPropagation();stage.classList.add('is-dragover')});
  stage.addEventListener('dragleave',()=>stage.classList.remove('is-dragover'));
  stage.addEventListener('drop',e=>{
    e.preventDefault();e.stopPropagation();stage.classList.remove('is-dragover');
    const src=getDraggedImageSource(e.dataTransfer);
    if(src?.file)setFile(src.file);else if(src?.url)setUrl(src.url,{attribution:src.attribution});
  });

  const prior=m._cleanup;
  m._cleanup=()=>{prior?.();if(objectUrl)URL.revokeObjectURL(objectUrl)}
}
