(()=>{
  'use strict';

  const FONT_CHOICES=[
    ['Inter','Inter'],['Lexend','Lexend'],['Poppins','Poppins'],['Nunito','Nunito'],['Quicksand','Quicksand'],['Oswald','Oswald'],
    ['Lora','Lora'],['Merriweather','Merriweather'],['Playfair Display','Playfair Display'],['Caveat','Caveat'],['Pacifico','Pacifico'],
    ['DM Sans','DM Sans'],['Space Grotesk','Space Grotesk'],['Roboto Mono','Roboto Mono'],['Calibri','Calibri']
  ];
  const FONT_SIZES=[12,14,16,18,22,28,36,48,64];
  const ALLOWED_TAGS=new Set(['P','DIV','BR','H1','H2','H3','BLOCKQUOTE','B','STRONG','I','EM','U','S','STRIKE','SPAN','UL','OL','LI','FONT']);
  const BLOCK_TAGS=new Set(['P','DIV','H1','H2','H3','BLOCKQUOTE','LI']);

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
  function cleanStyle(styleText=''){
    const source=document.createElement('span');
    source.setAttribute('style',styleText);
    const clean=[];
    const color=safeColor(source.style.color);if(color)clean.push(`color:${color}`);
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
    template.innerHTML=String(html).slice(0,350000);
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
  function rgbToHex(value){
    const match=String(value||'').match(/rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)/i);
    if(!match)return /^#[0-9a-f]{6}$/i.test(value||'')?value:'#17191d';
    return '#'+[match[1],match[2],match[3]].map(n=>Math.max(0,Math.min(255,Number(n))).toString(16).padStart(2,'0')).join('');
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
    const buttons=[...toolbar.querySelectorAll('[data-rich-command]')];
    let savedRange=null;
    let selectionFrame=0;
    let changeFrame=0;

    FONT_CHOICES.forEach(([value,label])=>{const option=document.createElement('option');option.value=value;option.textContent=label;fontSelect.appendChild(option)});
    FONT_SIZES.forEach(size=>{const option=document.createElement('option');option.value=String(size);option.textContent=`${size}px`;sizeSelect.appendChild(option)});
    fontSelect.value='Inter';sizeSelect.value='16';

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
    };
    const queueSync=()=>{cancelAnimationFrame(selectionFrame);selectionFrame=requestAnimationFrame(()=>{selectionFrame=0;rememberSelection();syncToolbar()})};

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

    editor.addEventListener('input',()=>{rememberSelection();markChanged()});
    editor.addEventListener('keyup',queueSync);
    editor.addEventListener('pointerup',queueSync);
    editor.addEventListener('focus',queueSync);
    editor.addEventListener('paste',event=>{
      event.preventDefault();
      const data=event.clipboardData||window.clipboardData;
      const html=data?.getData('text/html')||'';
      const text=data?.getData('text/plain')||'';
      if(html)document.execCommand('insertHTML',false,sanitizeHTML(html));
      else document.execCommand('insertText',false,text);
      requestAnimationFrame(()=>{rememberSelection();syncToolbar();markChanged()});
    });
    document.addEventListener('selectionchange',queueSync);

    m._boardGetState=()=>({html:sanitizeHTML(editor.innerHTML)});
    m._boardSetState=state=>{
      editor.innerHTML=sanitizeHTML(typeof state?.html==='string'?state.html:'');
      savedRange=null;requestAnimationFrame(syncToolbar);
    };

    const priorCleanup=m._cleanup;
    m._cleanup=()=>{
      cancelAnimationFrame(selectionFrame);cancelAnimationFrame(changeFrame);
      document.removeEventListener('selectionchange',queueSync);
      priorCleanup?.();
    };

    colorSwatch.style.background=colorInput.value;
  }

  window.TeacherTilesRichText={setup};
})();
