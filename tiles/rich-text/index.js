(()=>{
  'use strict';

  const FONT_CHOICES=[
    ['Inter','Inter'],['Lexend','Lexend'],['Poppins','Poppins'],['Nunito','Nunito'],['Quicksand','Quicksand'],['Oswald','Oswald'],
    ['Lora','Lora'],['Merriweather','Merriweather'],['Playfair Display','Playfair Display'],['Caveat','Caveat'],['Pacifico','Pacifico'],
    ['DM Sans','DM Sans'],['Space Grotesk','Space Grotesk'],['Roboto Mono','Roboto Mono'],['Calibri','Calibri']
  ];
  const FONT_SIZES=[12,14,16,18,22,28,36,48,64];
  const ALLOWED_TAGS=new Set(['P','DIV','BR','H1','H2','H3','BLOCKQUOTE','B','STRONG','I','EM','U','S','STRIKE','SPAN','UL','OL','LI','FONT','IMG']);
  const MAX_SANITIZED_HTML=6000000;
  const MAX_IMAGE_DATA_URL=800000;
  const IMAGE_TYPES=new Set(['image/png','image/jpeg','image/webp']);
  const XHTML_NS='http://www.w3.org/1999/xhtml';
  const TEXT_COLOR_CHOICES=['#17191d','#ffffff','#5d6470','#244d78','#1d4ed8','#087e8b','#287442','#92700c','#b54708','#b42332','#8b4055','#7543a8'];
  const HIGHLIGHT_COLOR_CHOICES=['#fff2a8','#ffe0a6','#ffd4bf','#ffcdd8','#eadcff','#dce8ff','#d4f2df','#cff0ee','#e2e8f0'];
  const IMAGE_LAYOUTS=new Set(['block','wrap-left','wrap-right','free']);
  const limit=(value,min,max)=>Math.max(min,Math.min(max,value));


  function safeColor(value){
    const probe=document.createElement('span');
    probe.style.color='';
    probe.style.color=String(value||'');
    return probe.style.color||'';
  }
  function safeFont(value){
    const raw=String(value||'').replace(/["']/g,'').trim();
    const match=FONT_CHOICES.find(([font])=>raw.toLowerCase().includes(font.toLowerCase()));
    return match?.[0]||'';
  }
  function safeImageSrc(value){
    const src=String(value||'');
    return src.length<=MAX_IMAGE_DATA_URL&&/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(src)?src:'';
  }
  function normalizeHexColor(value,fallback='#17191d'){
    const raw=String(value||'').trim();
    const short=raw.match(/^#([0-9a-f]{3})$/i);
    if(short)return '#'+short[1].split('').map(char=>char+char).join('').toLowerCase();
    return /^#[0-9a-f]{6}$/i.test(raw)?raw.toLowerCase():fallback;
  }
  function hexToHsv(value){
    const hex=normalizeHexColor(value,'#17191d').slice(1);
    const r=parseInt(hex.slice(0,2),16)/255,g=parseInt(hex.slice(2,4),16)/255,b=parseInt(hex.slice(4,6),16)/255;
    const max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;
    let h=0;
    if(delta){
      if(max===r)h=60*(((g-b)/delta)%6);
      else if(max===g)h=60*((b-r)/delta+2);
      else h=60*((r-g)/delta+4);
    }
    if(h<0)h+=360;
    return{h,s:max?delta/max:0,v:max};
  }
  function hsvToHex(h,s,v){
    const hue=((Number(h)%360)+360)%360,sat=limit(Number(s)||0,0,1),val=limit(Number(v)||0,0,1);
    const c=val*sat,x=c*(1-Math.abs((hue/60)%2-1)),s0=val-c;
    let r=0,g=0,b=0;
    if(hue<60){r=c;g=x}else if(hue<120){r=x;g=c}else if(hue<180){g=c;b=x}else if(hue<240){g=x;b=c}else if(hue<300){r=x;b=c}else{r=c;b=x}
    return '#'+[r+s0,g+s0,b+s0].map(channel=>Math.round(channel*255).toString(16).padStart(2,'0')).join('');
  }
  function imageNumeric(value,fallback=0){
    const number=Number(value);return Number.isFinite(number)?number:fallback;
  }
  function applyImagePresentation(img){
    if(!(img instanceof HTMLImageElement))return;
    const layout=IMAGE_LAYOUTS.has(img.dataset.richLayout)?img.dataset.richLayout:'block';
    const width=limit(imageNumeric(img.dataset.richWidth,parseFloat(img.style.width)||320),64,1600);
    img.dataset.richImage='true';img.dataset.richLayout=layout;img.dataset.richWidth=String(Math.round(width));
    img.draggable=false;img.style.width=`${Math.round(width)}px`;img.style.height='auto';img.style.display='block';img.style.boxSizing='border-box';
    img.style.maxWidth=layout==='free'?'none':'calc(100% - 8px)';
    if(layout==='free'){
      const left=limit(imageNumeric(img.dataset.richLeft,18),-5000,5000),top=limit(imageNumeric(img.dataset.richTop,18),-5000,5000);
      img.dataset.richLeft=String(Math.round(left));img.dataset.richTop=String(Math.round(top));
      img.style.position='absolute';img.style.left=`${Math.round(left)}px`;img.style.top=`${Math.round(top)}px`;img.style.float='none';img.style.margin='0';img.style.zIndex='2';
    }else{
      delete img.dataset.richLeft;delete img.dataset.richTop;img.style.position='relative';img.style.left='';img.style.top='';img.style.zIndex='';
      if(layout==='wrap-left'){img.style.float='left';img.style.margin='.35em 16px .7em 0'}
      else if(layout==='wrap-right'){img.style.float='right';img.style.margin='.35em 0 .7em 16px'}
      else{img.style.float='none';img.style.margin='.75em auto'}
    }
  }
  function cleanStyle(styleText=''){
    const source=document.createElement('span');
    source.setAttribute('style',styleText);
    const clean=[];
    const color=safeColor(source.style.color);if(color)clean.push(`color:${color}`);
    const background=safeColor(source.style.backgroundColor);if(background&&background!=='rgba(0, 0, 0, 0)'&&background!=='transparent')clean.push(`background-color:${background}`);
    const family=safeFont(source.style.fontFamily);if(family)clean.push(`font-family:${family}`);
    const size=source.style.fontSize;if(/^\d+(?:\.\d+)?px$/.test(size))clean.push(`font-size:${size}`);
    const align=source.style.textAlign;if(['left','center','right','justify'].includes(align))clean.push(`text-align:${align}`);
    const weight=source.style.fontWeight;if(/^(?:normal|bold|[1-9]00)$/.test(weight))clean.push(`font-weight:${weight}`);
    const fontStyle=source.style.fontStyle;if(['normal','italic'].includes(fontStyle))clean.push(`font-style:${fontStyle}`);
    const decoration=source.style.textDecorationLine||source.style.textDecoration;
    if(decoration&&/^(?:(?:none|underline|line-through)(?:\s+|$))+$/.test(decoration.trim()))clean.push(`text-decoration-line:${decoration.trim()}`);
    return clean.join(';');
  }
  function sanitizeHTML(html=''){
    const template=document.createElement('template');
    template.innerHTML=String(html).slice(0,MAX_SANITIZED_HTML);
    const visit=node=>{
      for(const child of [...node.childNodes]){
        if(child.nodeType===Node.COMMENT_NODE){child.remove();continue}
        if(child.nodeType!==Node.ELEMENT_NODE)continue;
        const tag=child.tagName;
        if(!ALLOWED_TAGS.has(tag)){
          visit(child);
          child.replaceWith(...child.childNodes);
          continue;
        }
        if(tag==='IMG'){
          const src=safeImageSrc(child.getAttribute('src'));
          if(!src){child.remove();continue}
          const alt=String(child.getAttribute('alt')||'').slice(0,180);
          const layout=IMAGE_LAYOUTS.has(child.dataset.richLayout)?child.dataset.richLayout:'block';
          const width=limit(imageNumeric(child.dataset.richWidth,parseFloat(child.style.width)||320),64,1600);
          const left=limit(imageNumeric(child.dataset.richLeft,18),-5000,5000),top=limit(imageNumeric(child.dataset.richTop,18),-5000,5000);
          for(const attr of [...child.attributes])child.removeAttribute(attr.name);
          child.setAttribute('src',src);child.setAttribute('alt',alt);child.setAttribute('draggable','false');
          child.dataset.richImage='true';child.dataset.richLayout=layout;child.dataset.richWidth=String(Math.round(width));
          if(layout==='free'){child.dataset.richLeft=String(Math.round(left));child.dataset.richTop=String(Math.round(top))}
          applyImagePresentation(child);
          continue;
        }
        const style=cleanStyle(child.getAttribute('style')||'');
        const fontFace=tag==='FONT'?safeFont(child.getAttribute('face')||''):'';
        const fontColor=tag==='FONT'?safeColor(child.getAttribute('color')||''):'';
        const fontSize=tag==='FONT'&&/^[1-7]$/.test(child.getAttribute('size')||'')?child.getAttribute('size'):'';
        for(const attr of [...child.attributes])child.removeAttribute(attr.name);
        if(style)child.setAttribute('style',style);
        if(fontFace)child.setAttribute('face',fontFace);
        if(fontColor)child.setAttribute('color',fontColor);
        if(fontSize)child.setAttribute('size',fontSize);
        visit(child);
      }
    };
    visit(template.content);
    return template.innerHTML;
  }
  function rgbToHex(value,fallback='#17191d'){
    const match=String(value||'').match(/rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)/i);
    if(!match)return /^#[0-9a-f]{6}$/i.test(value||'')?value:fallback;
    return '#'+[match[1],match[2],match[3]].map(n=>Math.max(0,Math.min(255,Number(n))).toString(16).padStart(2,'0')).join('');
  }
  function isTransparent(value){
    return !value||value==='transparent'||/^rgba\([^)]*,\s*0(?:\.0+)?\s*\)$/i.test(value);
  }
  function readFileAsDataURL(file){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result||''));
      reader.onerror=()=>reject(reader.error||new Error('Could not read image'));
      reader.readAsDataURL(file);
    });
  }
  function loadImage(url,timeout=6000){
    return new Promise((resolve,reject)=>{
      const image=new Image();
      const timer=setTimeout(()=>{image.src='';reject(new Error('Image loading timed out'))},timeout);
      image.onload=()=>{clearTimeout(timer);resolve(image)};
      image.onerror=()=>{clearTimeout(timer);reject(new Error('Could not load image'))};
      image.src=url;
    });
  }
  async function prepareImageFile(file){
    if(!file||!IMAGE_TYPES.has(file.type))throw new Error('Choose a PNG, JPG, or WebP image.');
    if(file.size>12*1024*1024)throw new Error('That image is too large. Choose one under 12 MB.');
    const source=await readFileAsDataURL(file);
    const image=await loadImage(source);
    const sourceWidth=Math.max(1,image.naturalWidth||image.width||1);
    const sourceHeight=Math.max(1,image.naturalHeight||image.height||1);
    const attempts=[
      [1400,.86],[1400,.72],[1200,.72],[1100,.64],[950,.62],[800,.6],[680,.58]
    ];
    let best='',bestWidth=sourceWidth,bestHeight=sourceHeight;
    for(const [maxSide,quality] of attempts){
      const scale=Math.min(1,maxSide/Math.max(sourceWidth,sourceHeight));
      const width=Math.max(1,Math.round(sourceWidth*scale));
      const height=Math.max(1,Math.round(sourceHeight*scale));
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
      const context=canvas.getContext('2d',{alpha:true});
      context.drawImage(image,0,0,width,height);
      const data=canvas.toDataURL('image/webp',quality);
      best=data;bestWidth=width;bestHeight=height;
      if(data.length<=MAX_IMAGE_DATA_URL)break;
    }
    if(!safeImageSrc(best))throw new Error('That image could not be compressed enough for the tile.');
    return{src:best,width:bestWidth,height:bestHeight,alt:String(file.name||'Inserted image').replace(/\.[^.]+$/,'').slice(0,180)||'Inserted image'};
  }
  function escapeHTML(value){
    return String(value||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  }
  function downloadBlob(blob,filename){
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;anchor.rel='noopener';
    document.body.appendChild(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2500);
  }

  function setup(m){
    const editor=m.querySelector('.richtext-editor');
    const toolbar=m.querySelector('.richtext-toolbar');
    const blockSelect=m.querySelector('.richtext-block');
    const fontSelect=m.querySelector('.richtext-font');
    const sizeSelect=m.querySelector('.richtext-size');
    const colorButton=m.querySelector('.richtext-color');
    const colorSwatch=m.querySelector('.richtext-color-swatch');
    const highlightButton=m.querySelector('.richtext-highlight');
    const highlightSwatch=m.querySelector('.richtext-highlight-swatch');
    const imageButton=m.querySelector('.richtext-image');
    const imageInput=m.querySelector('.richtext-image-input');
    const exportButton=m.querySelector('.richtext-export-button');
    const toast=m.querySelector('.richtext-toast');
    const buttons=[...toolbar.querySelectorAll('[data-rich-command]')];
    let savedRange=null;
    let selectionFrame=0;
    let changeFrame=0;
    let toastTimer=0;
    let exportFrame=0;
    let colorPickerFrame=0;
    let imageOverlayFrame=0;
    let selectedImage=null;
    let textColor='#17191d';
    let highlightColor='#fff2a8';

    toolbar.dataset.preserveTextEdit='true';

    FONT_CHOICES.forEach(([value,label])=>{const option=document.createElement('option');option.value=value;option.textContent=label;fontSelect.appendChild(option)});
    FONT_SIZES.forEach(size=>{const option=document.createElement('option');option.value=String(size);option.textContent=`${size}px`;sizeSelect.appendChild(option)});
    fontSelect.value='Inter';sizeSelect.value='16';

    const richSelectControls=[];
    let activeRichSelect=null;
    const closeRichSelect=()=>{
      if(!activeRichSelect)return;
      activeRichSelect.menu.hidden=true;
      activeRichSelect.trigger.setAttribute('aria-expanded','false');
      activeRichSelect=null;
      if(!m.classList.contains('is-richtext-color-open')&&!m.classList.contains('is-richtext-export-open'))m.classList.remove('is-richtext-popover-open');
    };
    const positionRichSelect=control=>{
      if(!control||control.menu.hidden||!control.trigger.isConnected){closeRichSelect();return}
      const rect=control.trigger.getBoundingClientRect(),width=control.menu.offsetWidth,height=control.menu.offsetHeight;
      const left=Math.max(8,Math.min(rect.left,innerWidth-width-8));
      const below=rect.bottom+6;
      const top=below+height<=innerHeight-8?below:Math.max(8,rect.top-height-6);
      control.menu.style.left=`${left}px`;control.menu.style.top=`${top}px`;
    };
    const syncRichSelect=control=>{
      const option=control.select.selectedOptions?.[0]||control.select.options?.[control.select.selectedIndex];
      control.label.textContent=option?.textContent||'';
      control.menu.querySelectorAll('[data-rich-select-value]').forEach(button=>{
        const selected=button.dataset.richSelectValue===control.select.value;
        button.classList.toggle('is-selected',selected);
        button.setAttribute('aria-selected',String(selected));
      });
    };
    const buildRichSelect=(select,kind)=>{
      select.style.display='none';
      const trigger=document.createElement('button');
      trigger.type='button';
      trigger.className=`richtext-select-trigger richtext-select-trigger--${kind}`;
      trigger.setAttribute('aria-haspopup','listbox');
      trigger.setAttribute('aria-expanded','false');
      trigger.dataset.preserveTextEdit='true';
      const label=document.createElement('span');
      label.className='richtext-select-trigger-label';
      const chevron=document.createElement('svg');
      chevron.setAttribute('viewBox','0 0 12 8');
      chevron.setAttribute('aria-hidden','true');
      chevron.innerHTML='<path d="M1.5 1.5 6 6l4.5-4.5"/>';
      trigger.append(label,chevron);
      select.after(trigger);

      const menu=document.createElement('div');
      menu.className=`richtext-select-menu richtext-select-menu--${kind}`;
      menu.hidden=true;
      menu.setAttribute('role','listbox');
      menu.setAttribute('aria-label',select.getAttribute('aria-label')||'Rich Text options');
      menu.dataset.preserveTextEdit='true';
      for(const option of select.options){
        const choice=document.createElement('button');
        choice.type='button';
        choice.dataset.richSelectValue=option.value;
        choice.setAttribute('role','option');
        choice.textContent=option.textContent;
        choice.addEventListener('pointerdown',event=>{
          rememberSelection();
          event.preventDefault();
          event.stopPropagation();
        });
        choice.addEventListener('click',()=>{
          select.value=option.value;
          select.dispatchEvent(new Event('change',{bubbles:true}));
          syncRichSelect(control);
          closeRichSelect();
        });
        menu.appendChild(choice);
      }
      document.body.appendChild(menu);

      const control={select,trigger,label,menu,kind};
      richSelectControls.push(control);
      syncRichSelect(control);

      trigger.addEventListener('pointerdown',event=>{
        rememberSelection();
        event.preventDefault();
        event.stopPropagation();
      });
      trigger.addEventListener('click',()=>{
        rememberSelection();
        if(activeRichSelect===control){closeRichSelect();return}
        closeRichSelect();
        activeRichSelect=control;
        menu.hidden=false;
        trigger.setAttribute('aria-expanded','true');
        m.classList.add('is-richtext-popover-open');
        syncRichSelect(control);
        positionRichSelect(control);
      });
      return control;
    };
    const blockControl=buildRichSelect(blockSelect,'block');
    const fontControl=buildRichSelect(fontSelect,'font');
    const sizeControl=buildRichSelect(sizeSelect,'size');
    const syncRichSelects=()=>richSelectControls.forEach(syncRichSelect);
    const outsideRichSelect=event=>{
      if(!activeRichSelect)return;
      if(activeRichSelect.menu.contains(event.target)||activeRichSelect.trigger.contains(event.target))return;
      closeRichSelect();
    };
    document.addEventListener('pointerdown',outsideRichSelect,true);
    window.addEventListener('resize',closeRichSelect);

    const showToast=(message,{error=false}={})=>{
      if(!toast)return;
      clearTimeout(toastTimer);toast.textContent=message;toast.hidden=false;toast.classList.toggle('is-error',error);
      toastTimer=setTimeout(()=>{toast.hidden=true;toast.classList.remove('is-error')},2800);
    };
    const selectionInEditor=()=>{
      const selection=getSelection();
      return Boolean(selection?.rangeCount&&selection.anchorNode&&editor.contains(selection.anchorNode));
    };
    const rememberSelection=()=>{
      if(!selectionInEditor())return;
      const selection=getSelection();
      savedRange=selection.getRangeAt(0).cloneRange();
    };
    const focusEditor=()=>{
      if(typeof enterModuleTextEdit==='function')enterModuleTextEdit(editor);
      else editor.focus({preventScroll:true});
    };
    const restoreSelection=()=>{
      focusEditor();
      const selection=getSelection();
      selection.removeAllRanges();
      if(savedRange&&editor.contains(savedRange.commonAncestorContainer))selection.addRange(savedRange);
      else{
        const range=document.createRange();
        range.selectNodeContents(editor);range.collapse(false);selection.addRange(range);
      }
    };
    const markChanged=()=>{
      cancelAnimationFrame(changeFrame);
      changeFrame=requestAnimationFrame(()=>{changeFrame=0;notifyBoardChanged('rich-text')});
    };
    const convertSizeFonts=size=>{
      editor.querySelectorAll('font[size="7"]').forEach(font=>{
        const span=document.createElement('span');span.style.fontSize=`${size}px`;
        while(font.firstChild)span.appendChild(font.firstChild);
        for(const attr of [...font.attributes]){
          if(attr.name==='face')span.style.fontFamily=safeFont(attr.value)||'';
          if(attr.name==='color')span.style.color=safeColor(attr.value)||'';
        }
        font.replaceWith(span);
      });
    };
    const runCommand=(command,value=null)=>{
      restoreSelection();
      try{document.execCommand('styleWithCSS',false,true)}catch{}
      if(command==='fontSizePx'){
        try{document.execCommand('styleWithCSS',false,false)}catch{}
        document.execCommand('fontSize',false,'7');
        convertSizeFonts(Number(value)||16);
        try{document.execCommand('styleWithCSS',false,true)}catch{}
      }else document.execCommand(command,false,value);
      rememberSelection();syncToolbar();markChanged();
    };
    const runHighlight=value=>{
      restoreSelection();
      try{document.execCommand('styleWithCSS',false,true)}catch{}
      let applied=false;
      try{applied=document.execCommand('hiliteColor',false,value)}catch{}
      if(!applied)try{document.execCommand('backColor',false,value)}catch{}
      rememberSelection();syncToolbar();markChanged();
    };

    const colorPicker=document.createElement('div');colorPicker.className='richtext-color-picker';colorPicker.hidden=true;colorPicker.setAttribute('role','dialog');colorPicker.setAttribute('aria-label','Rich Text color picker');colorPicker.dataset.preserveTextEdit='true';document.body.appendChild(colorPicker);
    let colorPickerMode='',colorPickerAnchor=null;
    const closeColorPicker=()=>{
      colorPicker.hidden=true;colorPickerMode='';colorPickerAnchor?.setAttribute('aria-expanded','false');colorPickerAnchor=null;m.classList.remove('is-richtext-color-open');if(!activeRichSelect&&!m.classList.contains('is-richtext-export-open'))m.classList.remove('is-richtext-popover-open');cancelAnimationFrame(colorPickerFrame);colorPickerFrame=0;
    };
    const positionColorPicker=()=>{
      if(colorPicker.hidden||!colorPickerAnchor?.isConnected){closeColorPicker();return}
      const anchorRect=colorPickerAnchor.getBoundingClientRect(),width=colorPicker.offsetWidth,height=colorPicker.offsetHeight;
      const left=Math.max(8,Math.min(anchorRect.left,innerWidth-width-8));
      const below=anchorRect.bottom+7,top=below+height<=innerHeight-8?below:Math.max(8,anchorRect.top-height-7);
      colorPicker.style.left=`${left}px`;colorPicker.style.top=`${top}px`;colorPickerFrame=requestAnimationFrame(positionColorPicker);
    };
    const applyPickerColor=value=>{
      if(colorPickerMode==='text'){
        textColor=normalizeHexColor(value,textColor);colorSwatch.style.background=textColor;colorSwatch.classList.remove('is-clear');runCommand('foreColor',textColor);
      }else if(colorPickerMode==='highlight'){
        if(value==='transparent'){
          runHighlight('transparent');highlightSwatch.classList.add('is-clear');highlightSwatch.style.background='transparent';
        }else{
          highlightColor=normalizeHexColor(value,highlightColor);highlightSwatch.style.background=highlightColor;highlightSwatch.classList.remove('is-clear');runHighlight(highlightColor);
        }
      }
      closeColorPicker();
    };
    const buildColorPicker=mode=>{
      colorPicker.replaceChildren();colorPicker.dataset.mode=mode;
      const header=document.createElement('header');
      const copy=document.createElement('div');
      const eyebrow=document.createElement('small');eyebrow.textContent='RICH TEXT';
      const title=document.createElement('strong');title.textContent=mode==='text'?'Text color':'Highlight';
      copy.append(eyebrow,title);
      const close=document.createElement('button');close.type='button';close.className='richtext-color-picker-close';close.setAttribute('aria-label','Close color picker');close.textContent='×';close.addEventListener('click',closeColorPicker);
      header.append(copy,close);colorPicker.appendChild(header);

      if(mode==='text'){
        const picker=document.createElement('div');picker.className='richtext-spectrum-picker';
        const area=document.createElement('div');area.className='richtext-spectrum-area';area.setAttribute('role','slider');area.setAttribute('aria-label','Text color saturation and brightness');area.tabIndex=0;
        const areaKnob=document.createElement('i');areaKnob.className='richtext-spectrum-area-knob';area.appendChild(areaKnob);
        const hue=document.createElement('div');hue.className='richtext-spectrum-hue';hue.setAttribute('role','slider');hue.setAttribute('aria-label','Text color hue');hue.tabIndex=0;
        const hueKnob=document.createElement('i');hueKnob.className='richtext-spectrum-hue-knob';hue.appendChild(hueKnob);
        picker.append(area,hue);

        let state=hexToHsv(textColor);
        const controls=document.createElement('form');controls.className='richtext-spectrum-controls';
        const preview=document.createElement('span');preview.className='richtext-spectrum-preview';preview.setAttribute('aria-hidden','true');
        const fieldWrap=document.createElement('label');fieldWrap.className='richtext-spectrum-hex';fieldWrap.textContent='#';
        const input=document.createElement('input');input.type='text';input.inputMode='text';input.maxLength=6;input.autocomplete='off';input.spellcheck=false;input.setAttribute('aria-label','Text color hex value');fieldWrap.appendChild(input);
        const apply=document.createElement('button');apply.type='submit';apply.textContent='Apply';
        controls.append(preview,fieldWrap,apply);

        const renderSpectrum=({syncInput=true}={})=>{
          const hex=hsvToHex(state.h,state.s,state.v);
          area.style.setProperty('--richtext-picker-hue',String(state.h));
          areaKnob.style.left=`${state.s*100}%`;areaKnob.style.top=`${(1-state.v)*100}%`;
          hueKnob.style.left=`${state.h/360*100}%`;preview.style.background=hex;
          if(syncInput)input.value=hex.slice(1).toUpperCase();
          area.setAttribute('aria-valuetext',hex);hue.setAttribute('aria-valuenow',String(Math.round(state.h)));
        };
        const setAreaPoint=event=>{
          const rect=area.getBoundingClientRect();
          state.s=limit((event.clientX-rect.left)/Math.max(1,rect.width),0,1);
          state.v=1-limit((event.clientY-rect.top)/Math.max(1,rect.height),0,1);
          renderSpectrum();
        };
        const beginArea=event=>{
          if(event.button!==undefined&&event.button!==0)return;
          event.preventDefault();area.setPointerCapture?.(event.pointerId);setAreaPoint(event);
          const move=moveEvent=>{if(moveEvent.pointerId===event.pointerId)setAreaPoint(moveEvent)};
          const stop=upEvent=>{if(upEvent.pointerId!==event.pointerId)return;area.removeEventListener('pointermove',move);area.removeEventListener('pointerup',stop);area.removeEventListener('pointercancel',stop)};
          area.addEventListener('pointermove',move);area.addEventListener('pointerup',stop);area.addEventListener('pointercancel',stop);
        };
        const setHuePoint=event=>{
          const rect=hue.getBoundingClientRect();
          state.h=limit((event.clientX-rect.left)/Math.max(1,rect.width),0,1)*360;
          renderSpectrum();
        };
        const beginHue=event=>{
          if(event.button!==undefined&&event.button!==0)return;
          event.preventDefault();hue.setPointerCapture?.(event.pointerId);setHuePoint(event);
          const move=moveEvent=>{if(moveEvent.pointerId===event.pointerId)setHuePoint(moveEvent)};
          const stop=upEvent=>{if(upEvent.pointerId!==event.pointerId)return;hue.removeEventListener('pointermove',move);hue.removeEventListener('pointerup',stop);hue.removeEventListener('pointercancel',stop)};
          hue.addEventListener('pointermove',move);hue.addEventListener('pointerup',stop);hue.addEventListener('pointercancel',stop);
        };
        area.addEventListener('pointerdown',beginArea);hue.addEventListener('pointerdown',beginHue);
        area.addEventListener('keydown',event=>{
          const step=event.shiftKey?.05:.015;
          if(event.key==='ArrowLeft'){state.s=limit(state.s-step,0,1)}
          else if(event.key==='ArrowRight'){state.s=limit(state.s+step,0,1)}
          else if(event.key==='ArrowUp'){state.v=limit(state.v+step,0,1)}
          else if(event.key==='ArrowDown'){state.v=limit(state.v-step,0,1)}
          else return;
          event.preventDefault();renderSpectrum();
        });
        hue.addEventListener('keydown',event=>{
          if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
          event.preventDefault();state.h=(state.h+(event.key==='ArrowRight'?(event.shiftKey?15:3):-(event.shiftKey?15:3))+360)%360;renderSpectrum();
        });
        input.addEventListener('input',()=>{
          input.classList.remove('is-invalid');
          const raw=`#${input.value.trim().replace(/^#/,'')}`;
          if(/^#[0-9a-f]{6}$/i.test(raw)){state=hexToHsv(raw);renderSpectrum({syncInput:false});preview.style.background=raw}
        });
        controls.addEventListener('submit',event=>{
          event.preventDefault();
          const raw=`#${input.value.trim().replace(/^#/,'')}`;
          const chosen=/^#[0-9a-f]{6}$/i.test(raw)?raw:hsvToHex(state.h,state.s,state.v);
          if(!/^#[0-9a-f]{6}$/i.test(chosen)){input.classList.add('is-invalid');input.focus();return}
          applyPickerColor(chosen);
        });
        renderSpectrum();colorPicker.append(picker,controls);

        const quickLabel=document.createElement('div');quickLabel.className='richtext-color-section-label';quickLabel.textContent='Quick colors';colorPicker.appendChild(quickLabel);
        const grid=document.createElement('div');grid.className='richtext-color-grid richtext-color-grid--text';
        TEXT_COLOR_CHOICES.forEach(value=>{
          const button=document.createElement('button');button.type='button';button.className='richtext-color-choice';button.style.setProperty('--choice-color',value);button.setAttribute('aria-label',value);button.title=value;
          const dot=document.createElement('span');dot.setAttribute('aria-hidden','true');button.appendChild(dot);button.addEventListener('click',()=>applyPickerColor(value));grid.appendChild(button);
        });
        colorPicker.appendChild(grid);
        return;
      }

      const grid=document.createElement('div');grid.className='richtext-color-grid richtext-color-grid--highlight';
      const none=document.createElement('button');none.type='button';none.className='richtext-color-choice richtext-color-choice--clear';none.setAttribute('aria-label','No highlight');none.title='No highlight';none.innerHTML='<span aria-hidden="true"></span>';none.addEventListener('click',()=>applyPickerColor('transparent'));grid.appendChild(none);
      HIGHLIGHT_COLOR_CHOICES.forEach(value=>{
        const button=document.createElement('button');button.type='button';button.className='richtext-color-choice';button.style.setProperty('--choice-color',value);button.setAttribute('aria-label',value);button.title=value;
        const dot=document.createElement('span');dot.setAttribute('aria-hidden','true');button.appendChild(dot);button.addEventListener('click',()=>applyPickerColor(value));grid.appendChild(button);
      });
      colorPicker.appendChild(grid);
      const custom=document.createElement('form');custom.className='richtext-color-custom';
      const label=document.createElement('label');label.textContent='Custom';
      const fieldWrap=document.createElement('span');fieldWrap.className='richtext-color-hex-wrap';fieldWrap.textContent='#';
      const input=document.createElement('input');input.type='text';input.inputMode='text';input.maxLength=6;input.autocomplete='off';input.spellcheck=false;input.value=highlightColor.replace('#','').toUpperCase();input.setAttribute('aria-label','Custom highlight hex color');
      fieldWrap.appendChild(input);label.appendChild(fieldWrap);
      const apply=document.createElement('button');apply.type='submit';apply.textContent='Apply';custom.append(label,apply);
      custom.addEventListener('submit',event=>{event.preventDefault();const raw=`#${input.value.trim().replace(/^#/,'')}`;if(!/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(raw)){input.classList.add('is-invalid');input.focus();return}applyPickerColor(raw)});
      input.addEventListener('input',()=>input.classList.remove('is-invalid'));colorPicker.appendChild(custom);
    };
    const openColorPicker=(mode,anchorButton)=>{
      rememberSelection();closeRichSelect();if(!exportMenu?.hidden)closeExportMenu();
      if(!colorPicker.hidden&&colorPickerMode===mode){closeColorPicker();return}
      closeColorPicker();colorPickerMode=mode;colorPickerAnchor=anchorButton;buildColorPicker(mode);colorPicker.hidden=false;anchorButton.setAttribute('aria-expanded','true');m.classList.add('is-richtext-popover-open','is-richtext-color-open');positionColorPicker();
    };
    const outsideColorPicker=event=>{if(!colorPicker.hidden&&!colorPicker.contains(event.target)&&!colorPickerAnchor?.contains(event.target))closeColorPicker()};
    colorPicker.addEventListener('pointerdown',event=>{
      rememberSelection();
      const editableField=event.target.closest('input,textarea');
      if(!editableField&&event.target.closest('button'))event.preventDefault();
      event.stopPropagation();
    });
    document.addEventListener('pointerdown',outsideColorPicker,true);colorPicker.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();const anchor=colorPickerAnchor;closeColorPicker();anchor?.focus({preventScroll:true})}});
    const selectionElement=()=>{
      const selection=getSelection();
      if(!selection?.rangeCount||!selection.anchorNode||!editor.contains(selection.anchorNode))return null;
      return selection.anchorNode.nodeType===Node.ELEMENT_NODE?selection.anchorNode:selection.anchorNode.parentElement;
    };
    const blockName=element=>{
      const block=element?.closest?.('h1,h2,h3,blockquote,p,div,li');
      if(!block||!editor.contains(block))return 'p';
      return block.tagName.toLowerCase()==='div'?'p':block.tagName.toLowerCase();
    };
    const activeBackground=element=>{
      let node=element;
      while(node&&node!==editor){
        const value=getComputedStyle(node).backgroundColor;
        if(!isTransparent(value))return rgbToHex(value,highlightColor);
        node=node.parentElement;
      }
      return '';
    };
    const syncToolbar=()=>{
      if(!selectionInEditor())return;
      const element=selectionElement();
      if(!element)return;
      for(const button of buttons){
        const command=button.dataset.richCommand;
        if(!['bold','italic','underline','strikeThrough','insertUnorderedList','insertOrderedList','justifyLeft','justifyCenter','justifyRight'].includes(command))continue;
        let active=false;try{active=document.queryCommandState(command)}catch{}
        button.classList.toggle('is-active',active);button.setAttribute('aria-pressed',String(active));
      }
      const block=blockName(element);blockSelect.value=[...blockSelect.options].some(option=>option.value===block)?block:'p';
      const computed=getComputedStyle(element);
      const family=FONT_CHOICES.find(([font])=>computed.fontFamily.toLowerCase().includes(font.toLowerCase()))?.[0]||'Inter';
      fontSelect.value=family;
      const px=parseFloat(computed.fontSize)||16;
      const nearest=FONT_SIZES.reduce((best,size)=>Math.abs(size-px)<Math.abs(best-px)?size:best,FONT_SIZES[0]);
      sizeSelect.value=String(nearest);
      textColor=rgbToHex(computed.color,textColor);colorSwatch.style.background=textColor;colorSwatch.classList.remove('is-clear');
      const highlight=activeBackground(element);
      if(highlight){highlightColor=highlight;highlightSwatch.style.background=highlightColor;highlightSwatch.classList.remove('is-clear')}
      else{highlightSwatch.style.background='transparent';highlightSwatch.classList.add('is-clear')}
      syncRichSelects();
    };
    const queueSync=()=>{cancelAnimationFrame(selectionFrame);selectionFrame=requestAnimationFrame(()=>{selectionFrame=0;rememberSelection();syncToolbar()})};

    const imageOverlay=document.createElement('div');imageOverlay.className='richtext-image-overlay';imageOverlay.hidden=true;imageOverlay.setAttribute('aria-hidden','true');imageOverlay.dataset.preserveTextEdit='true';
    const imageControls=document.createElement('div');imageControls.className='richtext-image-controls';imageControls.setAttribute('role','toolbar');imageControls.setAttribute('aria-label','Image layout');
    const imageLayoutButtons=[];
    const imageLayouts=[
      ['block','Text above and below','<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16M7 9h10v7H7zM4 20h16"/></svg>'],
      ['wrap-left','Wrap text on right','<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="6" width="7" height="8" rx="1"/><path d="M14 6h6M14 10h6M14 14h6M4 18h16"/></svg>'],
      ['wrap-right','Wrap text on left','<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="13" y="6" width="7" height="8" rx="1"/><path d="M4 6h6M4 10h6M4 14h6M4 18h16"/></svg>'],
      ['free','Free placement','<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M9.5 4 12 1.5 14.5 4M9.5 20 12 22.5l2.5-2.5M4 9.5 1.5 12 4 14.5M20 9.5l2.5 2.5-2.5 2.5"/></svg>']
    ];
    imageLayouts.forEach(([layout,label,icon])=>{const button=document.createElement('button');button.type='button';button.dataset.imageLayout=layout;button.title=label;button.setAttribute('aria-label',label);button.setAttribute('aria-pressed','false');button.innerHTML=icon;imageControls.appendChild(button);imageLayoutButtons.push(button)});
    const resetImage=document.createElement('button');resetImage.type='button';resetImage.className='richtext-image-reset';resetImage.title='Reset image size';resetImage.setAttribute('aria-label','Reset image size');resetImage.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8V4h4M19 16v4h-4M6 5a8 8 0 0 1 12 3M18 19a8 8 0 0 1-12-3"/></svg>';
    const deleteImage=document.createElement('button');deleteImage.type='button';deleteImage.className='richtext-image-delete';deleteImage.title='Delete image';deleteImage.setAttribute('aria-label','Delete image');deleteImage.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>';
    imageControls.append(resetImage,deleteImage);imageOverlay.appendChild(imageControls);
    ['tl','tr','bl','br'].forEach(corner=>{const handle=document.createElement('button');handle.type='button';handle.className=`richtext-image-resize richtext-image-resize--${corner}`;handle.dataset.imageResize=corner;handle.setAttribute('aria-label',`Resize image from ${corner}`);imageOverlay.appendChild(handle)});m.appendChild(imageOverlay);
    imageOverlay.addEventListener('pointerdown',event=>{rememberSelection();event.preventDefault();event.stopPropagation()});

    const moduleScale=()=>{const rect=m.getBoundingClientRect();return{x:rect.width/Math.max(1,m.offsetWidth),y:rect.height/Math.max(1,m.offsetHeight)}};
    const clearImageSelection=()=>{selectedImage=null;imageOverlay.hidden=true;imageOverlay.setAttribute('aria-hidden','true');cancelAnimationFrame(imageOverlayFrame);imageOverlayFrame=0;m.classList.remove('has-richtext-image-selected')};
    const updateImageOverlay=()=>{
      imageOverlayFrame=0;
      if(!selectedImage?.isConnected||!editor.classList.contains('module-text-edit-active')){imageOverlay.hidden=true;return}
      const moduleRect=m.getBoundingClientRect(),imageRect=selectedImage.getBoundingClientRect(),scale=moduleScale();
      imageOverlay.style.left=`${(imageRect.left-moduleRect.left)/scale.x}px`;imageOverlay.style.top=`${(imageRect.top-moduleRect.top)/scale.y}px`;imageOverlay.style.width=`${imageRect.width/scale.x}px`;imageOverlay.style.height=`${imageRect.height/scale.y}px`;
      imageOverlay.hidden=false;imageOverlay.setAttribute('aria-hidden','false');
      imageLayoutButtons.forEach(button=>{const active=button.dataset.imageLayout===selectedImage.dataset.richLayout;button.setAttribute('aria-pressed',String(active));button.classList.toggle('is-active',active)});
      imageOverlayFrame=requestAnimationFrame(updateImageOverlay);
    };
    const selectImage=img=>{
      if(!(img instanceof HTMLImageElement)||!editor.contains(img))return;
      applyImagePresentation(img);selectedImage=img;m.classList.add('has-richtext-image-selected');cancelAnimationFrame(imageOverlayFrame);updateImageOverlay();
    };
    const setSelectedImageLayout=layout=>{
      if(!selectedImage||!IMAGE_LAYOUTS.has(layout))return;
      if(layout==='free'&&selectedImage.dataset.richLayout!=='free'){
        const scale=moduleScale(),imageRect=selectedImage.getBoundingClientRect(),editorRect=editor.getBoundingClientRect();
        selectedImage.dataset.richLeft=String(Math.round((imageRect.left-editorRect.left)/scale.x+editor.scrollLeft));selectedImage.dataset.richTop=String(Math.round((imageRect.top-editorRect.top)/scale.y+editor.scrollTop));
      }
      selectedImage.dataset.richLayout=layout;applyImagePresentation(selectedImage);selectImage(selectedImage);markChanged();
    };
    imageLayoutButtons.forEach(button=>button.addEventListener('click',()=>setSelectedImageLayout(button.dataset.imageLayout)));
    resetImage.addEventListener('click',()=>{if(!selectedImage)return;const natural=Math.max(120,Math.min(selectedImage.naturalWidth||320,Math.max(160,editor.clientWidth*.56),420));selectedImage.dataset.richWidth=String(Math.round(natural));applyImagePresentation(selectedImage);markChanged()});
    deleteImage.addEventListener('click',()=>{if(!selectedImage)return;const image=selectedImage;clearImageSelection();image.remove();markChanged();showToast('Image removed')});

    const beginImageResize=(event,corner)=>{
      if(!selectedImage||event.button!==0)return;event.preventDefault();event.stopPropagation();focusEditor();
      const image=selectedImage,scale=moduleScale(),rect=image.getBoundingClientRect(),startWidth=rect.width/scale.x,startHeight=rect.height/scale.y,ratio=startWidth/Math.max(1,startHeight),startX=event.clientX,startY=event.clientY,startLeft=imageNumeric(image.dataset.richLeft,0),startTop=imageNumeric(image.dataset.richTop,0),free=image.dataset.richLayout==='free';
      const xSign=corner.includes('l')?-1:1,ySign=corner.includes('t')?-1:1;
      const move=moveEvent=>{
        const sx=moduleScale(),dx=(moveEvent.clientX-startX)/sx.x*xSign,dy=(moveEvent.clientY-startY)/sx.y*ySign*ratio,delta=(dx+dy)/2,maxWidth=free?1600:Math.max(96,editor.clientWidth-18),width=limit(startWidth+delta,64,maxWidth),height=width/ratio;
        image.dataset.richWidth=String(Math.round(width));
        if(free){if(xSign<0)image.dataset.richLeft=String(Math.round(startLeft+(startWidth-width)));if(ySign<0)image.dataset.richTop=String(Math.round(startTop+(startHeight-height)))}
        applyImagePresentation(image);
      };
      const up=()=>{document.removeEventListener('pointermove',move,true);document.removeEventListener('pointerup',up,true);document.removeEventListener('pointercancel',up,true);markChanged()};
      document.addEventListener('pointermove',move,true);document.addEventListener('pointerup',up,true);document.addEventListener('pointercancel',up,true);
    };
    imageOverlay.querySelectorAll('[data-image-resize]').forEach(handle=>handle.addEventListener('pointerdown',event=>beginImageResize(event,handle.dataset.imageResize)));

    const beginFreeImageDrag=(event,image)=>{
      if(image.dataset.richLayout!=='free'||event.button!==0)return;event.preventDefault();event.stopPropagation();
      const startX=event.clientX,startY=event.clientY,startLeft=imageNumeric(image.dataset.richLeft,0),startTop=imageNumeric(image.dataset.richTop,0);
      const move=moveEvent=>{const scale=moduleScale();image.dataset.richLeft=String(Math.round(startLeft+(moveEvent.clientX-startX)/scale.x));image.dataset.richTop=String(Math.round(startTop+(moveEvent.clientY-startY)/scale.y));applyImagePresentation(image)};
      const up=()=>{document.removeEventListener('pointermove',move,true);document.removeEventListener('pointerup',up,true);document.removeEventListener('pointercancel',up,true);markChanged()};
      document.addEventListener('pointermove',move,true);document.addEventListener('pointerup',up,true);document.addEventListener('pointercancel',up,true);
    };

    const insertPreparedImage=image=>{
      restoreSelection();
      const selection=getSelection();
      if(!selection?.rangeCount)return;
      const range=selection.getRangeAt(0);
      const img=document.createElement('img');img.src=image.src;img.alt=image.alt;img.draggable=false;img.dataset.richImage='true';img.dataset.richLayout='block';img.dataset.richWidth=String(Math.round(Math.min(image.width||320,Math.max(180,editor.clientWidth*.56),420)));applyImagePresentation(img);
      range.deleteContents();range.insertNode(img);
      range.setStartAfter(img);range.collapse(true);
      selection.removeAllRanges();selection.addRange(range);
      savedRange=range.cloneRange();selectImage(img);
      markChanged();showToast('Image added');
    };
    const addImageFile=async file=>{
      const selectionBefore=savedRange?.cloneRange?.()||null;
      try{
        showToast('Preparing image…');
        const image=await prepareImageFile(file);
        if(selectionBefore&&editor.contains(selectionBefore.commonAncestorContainer))savedRange=selectionBefore;
        insertPreparedImage(image);
      }catch(error){showToast(error?.message||'Could not add that image.',{error:true})}
    };

    const exportBackground=()=>{
      const value=getComputedStyle(m).backgroundColor;
      return isTransparent(value)?'transparent':value;
    };
    const exportBaseCSS=({background='transparent',print=false}={})=>`
      *{box-sizing:border-box}html,body{margin:0;padding:0}body{background:${background==='transparent'?(print?'#fff':'transparent'):background};color:#17191d;font-family:Inter,Arial,sans-serif}
      .richtext-export-document{position:relative;width:100%;padding:${print?'0':'22px'};font:400 16px/1.55 Inter,Arial,sans-serif;overflow-wrap:anywhere;background:${background}}
      .richtext-export-document p,.richtext-export-document div{margin:.35em 0}.richtext-export-document p:first-child,.richtext-export-document div:first-child{margin-top:0}
      .richtext-export-document h1{font-size:2em;line-height:1.12;margin:.25em 0 .45em;font-weight:800}.richtext-export-document h2{font-size:1.55em;line-height:1.2;margin:.35em 0 .45em;font-weight:750}.richtext-export-document h3{font-size:1.25em;line-height:1.3;margin:.45em 0 .4em;font-weight:700}
      .richtext-export-document blockquote{margin:.65em 0;padding:.1em 0 .1em 14px;border-left:3px solid #64748b66}.richtext-export-document ul,.richtext-export-document ol{margin:.45em 0;padding-left:1.7em}.richtext-export-document li{margin:.2em 0}
      .richtext-export-document img{box-sizing:border-box;height:auto;border-radius:10px}
      ${print?'@page{margin:.65in}body{padding:0}.richtext-export-document{background:#fff!important}':''}`;
    const documentName=()=>{
      const first=(editor.innerText||'').split(/\n+/).map(line=>line.trim()).find(Boolean)||'Rich Text';
      const slug=first.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,42)||'rich-text';
      return slug;
    };
    const exportHTMLDocument=({print=false}={})=>{
      const title=(editor.innerText||'Rich Text').split(/\n+/).map(line=>line.trim()).find(Boolean)||'Rich Text';
      const background=exportBackground();
      return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(title)}</title><link href="https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&family=Pacifico&family=Caveat:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=Lora:wght@400;500;600;700&family=Merriweather:wght@400;700&family=Nunito:wght@400;500;600;700;800&family=Oswald:wght@400;500;600;700&family=Playfair+Display:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&family=Quicksand:wght@400;500;600;700&family=Roboto+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet"><style>${exportBaseCSS({background,print})}</style></head><body><article class="richtext-export-document">${sanitizeHTML(editor.innerHTML)}</article></body></html>`;
    };
    const exportPDF=()=>{
      const popup=window.open('','_blank','width=900,height=760');
      if(!popup){showToast('Allow pop-ups to export PDF.',{error:true});return}
      popup.opener=null;
      popup.document.open();popup.document.write(exportHTMLDocument({print:true}));popup.document.close();
      popup.addEventListener('afterprint',()=>popup.close(),{once:true});
      setTimeout(async()=>{
        try{await popup.document.fonts?.ready}catch{}
        popup.focus();popup.print();
      },300);
      showToast('PDF print dialog opened');
    };
    const exportHTML=()=>{
      downloadBlob(new Blob([exportHTMLDocument()],{type:'text/html;charset=utf-8'}),`${documentName()}.html`);
      showToast('HTML exported');
    };
    const exportWord=()=>{
      downloadBlob(new Blob(['\ufeff',exportHTMLDocument()],{type:'application/msword'}),`${documentName()}.doc`);
      showToast('Word document exported');
    };
    const exportText=()=>{
      downloadBlob(new Blob([editor.innerText||''],{type:'text/plain;charset=utf-8'}),`${documentName()}.txt`);
      showToast('Text exported');
    };
    const exportMenu=document.createElement('div');exportMenu.className='richtext-export-menu';exportMenu.hidden=true;exportMenu.setAttribute('role','menu');exportMenu.setAttribute('aria-label','Export Rich Text');
    const exportOptions=[
      ['pdf','PDF','Print or save as PDF',exportPDF],
      ['doc','Word','Editable .doc file',exportWord],
      ['html','HTML','Formatted web document',exportHTML],
      ['txt','Text','Plain .txt file',exportText]
    ];
    exportOptions.forEach(([key,label,detail,action])=>{
      const button=document.createElement('button');button.type='button';button.dataset.exportFormat=key;button.setAttribute('role','menuitem');
      const strong=document.createElement('strong');strong.textContent=label;
      const small=document.createElement('small');small.textContent=detail;
      button.append(strong,small);button.addEventListener('click',async()=>{closeExportMenu();await action()});exportMenu.appendChild(button);
    });
    exportMenu.dataset.preserveTextEdit='true';document.body.appendChild(exportMenu);
    const positionExportMenu=()=>{
      if(exportMenu.hidden||!m.isConnected){cancelAnimationFrame(exportFrame);exportFrame=0;return}
      const anchor=exportButton.getBoundingClientRect(),width=exportMenu.offsetWidth,height=exportMenu.offsetHeight;
      const left=Math.max(8,Math.min(anchor.right-width,innerWidth-width-8));
      const below=anchor.bottom+7;
      const top=below+height<=innerHeight-8?below:Math.max(8,anchor.top-height-7);
      exportMenu.style.left=`${left}px`;exportMenu.style.top=`${top}px`;
      exportFrame=requestAnimationFrame(positionExportMenu);
    };
    const closeExportMenu=()=>{
      exportMenu.hidden=true;exportButton.setAttribute('aria-expanded','false');m.classList.remove('is-richtext-export-open');if(!activeRichSelect&&!m.classList.contains('is-richtext-color-open'))m.classList.remove('is-richtext-popover-open');cancelAnimationFrame(exportFrame);exportFrame=0;
    };
    const openExportMenu=()=>{
      closeRichSelect();exportMenu.hidden=false;exportButton.setAttribute('aria-expanded','true');m.classList.add('is-richtext-popover-open','is-richtext-export-open');positionExportMenu();
    };
    const outsideExport=event=>{if(!exportMenu.hidden&&!exportMenu.contains(event.target)&&!exportButton.contains(event.target))closeExportMenu()};
    document.addEventListener('pointerdown',outsideExport,true);
    exportMenu.addEventListener('pointerdown',event=>{rememberSelection();event.preventDefault();event.stopPropagation()});
    exportMenu.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();closeExportMenu();exportButton.focus({preventScroll:true})}});

    toolbar.addEventListener('pointerdown',event=>{
      rememberSelection();
      event.stopPropagation();
      const field=event.target.closest('input,textarea');
      if(!field)event.preventDefault();
    });
    toolbar.addEventListener('click',event=>{
      const button=event.target.closest('[data-rich-command]');if(!button)return;
      const command=button.dataset.richCommand;
      if(command==='removeFormat'){runCommand('removeFormat');return}
      if(command==='undo'||command==='redo'){runCommand(command);return}
      runCommand(command);
    });
    blockSelect.addEventListener('change',()=>runCommand('formatBlock',blockSelect.value));
    fontSelect.addEventListener('change',()=>runCommand('fontName',fontSelect.value));
    sizeSelect.addEventListener('change',()=>runCommand('fontSizePx',sizeSelect.value));
    colorButton.addEventListener('click',()=>openColorPicker('text',colorButton));
    highlightButton.addEventListener('click',()=>openColorPicker('highlight',highlightButton));
    imageButton.addEventListener('click',()=>{rememberSelection();imageInput.click()});
    imageInput.addEventListener('change',async()=>{const file=imageInput.files?.[0];imageInput.value='';if(file)await addImageFile(file)});
    exportButton.addEventListener('click',()=>{if(exportMenu.hidden)openExportMenu();else closeExportMenu()});

    editor.addEventListener('input',()=>{rememberSelection();editor.querySelectorAll('img').forEach(applyImagePresentation);markChanged()});
    editor.addEventListener('keyup',queueSync);
    editor.addEventListener('pointerdown',event=>{
      if(!editor.classList.contains('module-text-edit-active'))return;
      const image=event.target instanceof Element?event.target.closest('img[data-rich-image],img'):null;
      if(image&&editor.contains(image)){
        event.preventDefault();selectImage(image);if(image.dataset.richLayout==='free')beginFreeImageDrag(event,image);return;
      }
      clearImageSelection();
    },true);
    editor.addEventListener('pointerup',queueSync);
    editor.addEventListener('focus',queueSync);
    editor.addEventListener('dragstart',event=>{if(event.target instanceof HTMLImageElement)event.preventDefault()});
    editor.addEventListener('paste',event=>{
      const data=event.clipboardData||window.clipboardData;
      const imageFile=[...(data?.files||[])].find(file=>IMAGE_TYPES.has(file.type));
      if(imageFile){
        event.preventDefault();rememberSelection();addImageFile(imageFile);return;
      }
      event.preventDefault();
      const html=data?.getData('text/html')||'';
      const text=data?.getData('text/plain')||'';
      if(html)document.execCommand('insertHTML',false,sanitizeHTML(html));
      else document.execCommand('insertText',false,text);
      requestAnimationFrame(()=>{rememberSelection();syncToolbar();markChanged()});
    });
    document.addEventListener('selectionchange',queueSync);

    const priorCleanup=m._cleanup;
    m._cleanup=()=>{
      cancelAnimationFrame(selectionFrame);cancelAnimationFrame(changeFrame);cancelAnimationFrame(exportFrame);cancelAnimationFrame(colorPickerFrame);cancelAnimationFrame(imageOverlayFrame);clearTimeout(toastTimer);
      document.removeEventListener('selectionchange',queueSync);document.removeEventListener('pointerdown',outsideExport,true);document.removeEventListener('pointerdown',outsideColorPicker,true);document.removeEventListener('pointerdown',outsideRichSelect,true);window.removeEventListener('resize',closeRichSelect);
      richSelectControls.forEach(control=>control.menu.remove());exportMenu.remove();colorPicker.remove();imageOverlay.remove();priorCleanup?.();
    };

    editor.querySelectorAll('img').forEach(applyImagePresentation);
    colorSwatch.style.background=textColor;colorSwatch.classList.remove('is-clear');
    highlightSwatch.style.background='transparent';highlightSwatch.classList.add('is-clear');
  }

  window.TeacherTilesRichText={setup};
})();
