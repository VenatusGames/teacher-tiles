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
          for(const attr of [...child.attributes])child.removeAttribute(attr.name);
          child.setAttribute('src',src);
          child.setAttribute('alt',alt);
          child.setAttribute('draggable','false');
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
    let best='';
    for(const [maxSide,quality] of attempts){
      const scale=Math.min(1,maxSide/Math.max(sourceWidth,sourceHeight));
      const width=Math.max(1,Math.round(sourceWidth*scale));
      const height=Math.max(1,Math.round(sourceHeight*scale));
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
      const context=canvas.getContext('2d',{alpha:true});
      context.drawImage(image,0,0,width,height);
      const data=canvas.toDataURL('image/webp',quality);
      best=data;
      if(data.length<=MAX_IMAGE_DATA_URL)break;
    }
    if(!safeImageSrc(best))throw new Error('That image could not be compressed enough for the tile.');
    return{src:best,alt:String(file.name||'Inserted image').replace(/\.[^.]+$/,'').slice(0,180)||'Inserted image'};
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
    const colorInput=m.querySelector('.richtext-color-input');
    const colorButton=m.querySelector('.richtext-color');
    const colorSwatch=m.querySelector('.richtext-color-swatch');
    const highlightInput=m.querySelector('.richtext-highlight-input');
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

    FONT_CHOICES.forEach(([value,label])=>{const option=document.createElement('option');option.value=value;option.textContent=label;fontSelect.appendChild(option)});
    FONT_SIZES.forEach(size=>{const option=document.createElement('option');option.value=String(size);option.textContent=`${size}px`;sizeSelect.appendChild(option)});
    fontSelect.value='Inter';sizeSelect.value='16';

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
        if(!isTransparent(value))return rgbToHex(value,'#fff2a8');
        node=node.parentElement;
      }
      return highlightInput?.value||'#fff2a8';
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
      const color=rgbToHex(computed.color);colorInput.value=color;colorSwatch.style.background=color;
      const highlight=activeBackground(element);highlightInput.value=highlight;highlightSwatch.style.background=highlight;
    };
    const queueSync=()=>{cancelAnimationFrame(selectionFrame);selectionFrame=requestAnimationFrame(()=>{selectionFrame=0;rememberSelection();syncToolbar()})};

    const insertPreparedImage=image=>{
      restoreSelection();
      const selection=getSelection();
      if(!selection?.rangeCount)return;
      const range=selection.getRangeAt(0);
      const img=document.createElement('img');img.src=image.src;img.alt=image.alt;img.draggable=false;
      range.deleteContents();range.insertNode(img);
      range.setStartAfter(img);range.collapse(true);
      selection.removeAllRanges();selection.addRange(range);
      savedRange=range.cloneRange();
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
      .richtext-export-document{width:100%;padding:${print?'0':'22px'};font:400 16px/1.55 Inter,Arial,sans-serif;overflow-wrap:anywhere;background:${background}}
      .richtext-export-document p,.richtext-export-document div{margin:.35em 0}.richtext-export-document p:first-child,.richtext-export-document div:first-child{margin-top:0}
      .richtext-export-document h1{font-size:2em;line-height:1.12;margin:.25em 0 .45em;font-weight:800}.richtext-export-document h2{font-size:1.55em;line-height:1.2;margin:.35em 0 .45em;font-weight:750}.richtext-export-document h3{font-size:1.25em;line-height:1.3;margin:.45em 0 .4em;font-weight:700}
      .richtext-export-document blockquote{margin:.65em 0;padding:.1em 0 .1em 14px;border-left:3px solid #64748b66}.richtext-export-document ul,.richtext-export-document ol{margin:.45em 0;padding-left:1.7em}.richtext-export-document li{margin:.2em 0}
      .richtext-export-document img{display:block;max-width:100%;height:auto;margin:.75em auto;border-radius:10px}
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
    const exportPNG=async()=>{
      try{
        const content=sanitizeHTML(editor.innerHTML);
        const sourceWidth=Math.max(320,Math.min(1800,editor.clientWidth||680));
        const naturalHeight=Math.max(editor.clientHeight||280,editor.scrollHeight||280);
        const maxHeight=12000;
        const scaleDown=Math.min(1,maxHeight/naturalHeight);
        const width=Math.max(1,Math.round(sourceWidth*scaleDown));
        const height=Math.max(1,Math.round(naturalHeight*scaleDown));
        const root=document.createElementNS(XHTML_NS,'div');root.setAttribute('xmlns',XHTML_NS);root.setAttribute('class','richtext-export-root');
        const style=document.createElementNS(XHTML_NS,'style');style.textContent=exportBaseCSS({background:exportBackground()});
        const body=document.createElementNS(XHTML_NS,'div');body.setAttribute('class','richtext-export-document');body.innerHTML=content;
        root.append(style,body);
        const serialized=new XMLSerializer().serializeToString(root);
        const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${sourceWidth} ${naturalHeight}"><foreignObject x="0" y="0" width="${sourceWidth}" height="${naturalHeight}">${serialized}</foreignObject></svg>`;
        const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
        try{
          const image=await loadImage(url);
          const renderScale=Math.min(2,8192/width,12000/height);
          const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.floor(width*renderScale));canvas.height=Math.max(1,Math.floor(height*renderScale));
          const context=canvas.getContext('2d',{alpha:true});
          context.drawImage(image,0,0,canvas.width,canvas.height);
          const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
          if(!blob)throw new Error('PNG export failed.');
          downloadBlob(blob,`${documentName()}.png`);showToast('PNG exported');
        }finally{URL.revokeObjectURL(url)}
      }catch(error){showToast(error?.message||'PNG export failed.',{error:true})}
    };

    const exportMenu=document.createElement('div');exportMenu.className='richtext-export-menu';exportMenu.hidden=true;exportMenu.setAttribute('role','menu');exportMenu.setAttribute('aria-label','Export Rich Text');
    const exportOptions=[
      ['pdf','PDF','Print or save as PDF',exportPDF],
      ['png','PNG','Full document image',exportPNG],
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
    document.body.appendChild(exportMenu);
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
      exportMenu.hidden=true;exportButton.setAttribute('aria-expanded','false');cancelAnimationFrame(exportFrame);exportFrame=0;
    };
    const openExportMenu=()=>{
      exportMenu.hidden=false;exportButton.setAttribute('aria-expanded','true');positionExportMenu();
    };
    const outsideExport=event=>{if(!exportMenu.hidden&&!exportMenu.contains(event.target)&&!exportButton.contains(event.target))closeExportMenu()};
    document.addEventListener('pointerdown',outsideExport,true);
    exportMenu.addEventListener('pointerdown',event=>event.stopPropagation());
    exportMenu.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();closeExportMenu();exportButton.focus({preventScroll:true})}});

    toolbar.addEventListener('pointerdown',event=>{
      if(event.target.closest('button,select,input'))rememberSelection();
      if(event.target.closest('button'))event.preventDefault();
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
    colorInput.addEventListener('input',()=>{colorSwatch.style.background=colorInput.value});
    colorInput.addEventListener('change',()=>runCommand('foreColor',colorInput.value));
    colorButton.addEventListener('click',()=>{rememberSelection();colorInput.click()});
    highlightInput.addEventListener('input',()=>{highlightSwatch.style.background=highlightInput.value});
    highlightInput.addEventListener('change',()=>runHighlight(highlightInput.value));
    highlightButton.addEventListener('click',()=>{rememberSelection();highlightInput.click()});
    imageButton.addEventListener('click',()=>{rememberSelection();imageInput.click()});
    imageInput.addEventListener('change',async()=>{const file=imageInput.files?.[0];imageInput.value='';if(file)await addImageFile(file)});
    exportButton.addEventListener('click',()=>{if(exportMenu.hidden)openExportMenu();else closeExportMenu()});

    editor.addEventListener('input',()=>{rememberSelection();markChanged()});
    editor.addEventListener('keyup',queueSync);
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
      cancelAnimationFrame(selectionFrame);cancelAnimationFrame(changeFrame);cancelAnimationFrame(exportFrame);clearTimeout(toastTimer);
      document.removeEventListener('selectionchange',queueSync);document.removeEventListener('pointerdown',outsideExport,true);
      exportMenu.remove();priorCleanup?.();
    };

    colorSwatch.style.background=colorInput.value;
    highlightSwatch.style.background=highlightInput.value;
  }

  window.TeacherTilesRichText={setup};
})();
