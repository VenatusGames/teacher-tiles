(() => {
  'use strict';
  const backgrounds={white:'#ffffff',cream:'#fff5dc',blue:'#dfeeff',pink:'#ffe0ea',green:'#e1f5e5',lavender:'#eee3ff',charcoal:'#25282e'};
  const texts={dark:'#17191d',soft:'#5d6470',blue:'#244d78',rose:'#8b4055',white:'#f7f8fa',red:'#b42332',orange:'#b54708',gold:'#92700c',green:'#287442',teal:'#087e8b',purple:'#7543a8',brown:'#79523b'};
  const notes={yellow:'#fff2aa',pink:'#ffdbe5',blue:'#dbeeff',green:'#ddf4df',lavender:'#eadfff'};
  const fontNames={lexend:'Lexend',pacifico:'Pacifico',calibri:'Calibri',inter:'Inter',poppins:'Poppins',nunito:'Nunito',quicksand:'Quicksand',oswald:'Oswald',lora:'Lora',merriweather:'Merriweather',playfair:'Playfair Display',caveat:'Caveat',phantom:'Phantom Guardians',dm:'DM Sans',space:'Space Grotesk',mono:'Roboto Mono'};
  let active=null,frame=0,hideTimer=0,keyboard=false;
  const flyout=document.createElement('div');flyout.className='tile-appearance-flyout';flyout.hidden=true;flyout.setAttribute('role','group');flyout.setAttribute('aria-label','Tile appearance');
  const rail=document.createElement('div');rail.className='tile-appearance-rail';
  const picker=document.createElement('div');picker.className='tile-appearance-picker';picker.hidden=true;
  flyout.append(rail,picker);document.body.appendChild(flyout);
  const titleCase=value=>value[0].toUpperCase()+value.slice(1);
  function close(){
    clearTimeout(hideTimer);cancelAnimationFrame(frame);
    if(active){active.button.setAttribute('aria-expanded','false');active.module.classList.remove('is-appearance-open')}
    active=null;flyout.hidden=true;picker.hidden=true;rail.replaceChildren();picker.replaceChildren();
  }
  function deferClose(){clearTimeout(hideTimer);hideTimer=setTimeout(()=>{if(!flyout.matches(':hover')&&!active?.module.matches(':hover')&&!(keyboard&&(flyout.matches(':focus-within')||active?.module.matches(':has(:focus-visible)'))))close()},240)}
  function position(){
    if(!active)return;
    if(!active.module.isConnected){close();return}
    const rect=active.module.getBoundingClientRect(),anchor=active.button.getBoundingClientRect();
    const left=Math.max(8,Math.min(rect.left-48,innerWidth-48)),top=Math.max(8,Math.min(anchor.bottom-rail.offsetHeight,innerHeight-rail.offsetHeight-8));
    flyout.style.left=`${left}px`;flyout.style.top=`${top}px`;
    if(!picker.hidden){
      const w=picker.offsetWidth,h=picker.offsetHeight;
      const desired=left-w-8;
      picker.style.left=`${Math.max(8,Math.min(desired>=8?desired:left+48,innerWidth-w-8))-left}px`;
      picker.style.top=`${Math.max(8,Math.min(top+rail.offsetHeight-h,innerHeight-h-8))-top}px`;
    }
    frame=requestAnimationFrame(position);
  }
  function showPicker(control){
    if(!active)return;
    picker.replaceChildren();picker.hidden=false;
    const heading=document.createElement('strong');heading.className='tile-appearance-heading';heading.textContent=control.label;picker.appendChild(heading);
    const choices=document.createElement('div');choices.className=control.key==='font'?'tile-appearance-fonts':'tile-appearance-colors';
    const m=active.module;
    for(const value of control.values){
      const option=document.createElement('button');option.type='button';option.className='tile-appearance-option';
      const name=control.key==='font'?(fontNames[value]||titleCase(value)):titleCase(value);
      option.setAttribute('aria-label',name);option.setAttribute('aria-pressed',String((m.dataset[control.key]||control.values[0])===value));
      if(control.key==='font')option.style.fontFamily=`"${fontNames[value]||value}",sans-serif`;
      else{const swatch=document.createElement('i');swatch.style.background=control.colors[value];swatch.setAttribute('aria-hidden','true');option.appendChild(swatch)}
      const label=document.createElement('span');label.textContent=name;option.appendChild(label);
      option.addEventListener('click',()=>{
        if(!active||!m.isConnected)return;
        // Keep tile-specific redraw and text-fitting callbacks, choosing instead of cycling.
        m._appearanceChoice={key:control.key,value};
        try{control.original.click()}finally{delete m._appearanceChoice}
        active.onChange('tile-appearance');
        choices.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===option)));
      });
      choices.appendChild(option);
    }
    picker.appendChild(choices);
    rail.querySelectorAll('button').forEach(button=>button.setAttribute('aria-expanded',String(button.dataset.appearanceKey===control.key)));
    picker.querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});
  }
  function borderPicker(){
    const m=active.module;picker.replaceChildren();picker.hidden=false;
    const heading=document.createElement('strong');heading.className='tile-appearance-heading';heading.textContent='Border';picker.appendChild(heading);
    const legacy=m.querySelector('.image-border-style');
    const legacyStyle=legacy?.value||'none';
    const current={style:m.dataset.appearanceBorderStyle||(legacyStyle==='double'?'double':legacyStyle==='none'?'none':'solid'),size:m.dataset.appearanceBorderSize||({thin:2,medium:4,thick:8,double:6}[legacyStyle]||2),color:m.dataset.appearanceBorderColor||m.querySelector('.image-border-color')?.value||'#17191d'};
    const fields={};
    for(const [key,label] of [['style','Style'],['size','Size (px)'],['color','Color']]){
      const row=document.createElement('label');row.className='tile-appearance-field';row.textContent=label;
      const input=document.createElement(key==='style'?'select':'input');input.setAttribute('aria-label',`Border ${label}`);
      if(key==='style')for(const value of ['none','solid','dashed','dotted','double']){const option=document.createElement('option');option.value=value;option.textContent=titleCase(value);input.appendChild(option)}
      else input.type=key==='size'?'number':'color';
      if(key==='size'){input.min='1';input.max='20';input.step='1'}
      input.value=current[key];fields[key]=input;row.appendChild(input);picker.appendChild(row);
      input.addEventListener('input',()=>{
        const size=Math.max(1,Math.min(20,Number(fields.size.value)||2));
        m.dataset.appearanceBorderStyle=fields.style.value;m.dataset.appearanceBorderSize=String(size);m.dataset.appearanceBorderColor=fields.color.value;
        if(legacy){legacy.value='none';legacy.dispatchEvent(new Event('change'))}
        applyBorder(m);active?.onChange('tile-border');
      });
    }
  }
  function applyBorder(m){
    const style=m.dataset.appearanceBorderStyle;
    if(!style||style==='none'){m.style.removeProperty('outline');m.style.removeProperty('outline-offset');return}
    const size=Math.max(1,Math.min(20,Number(m.dataset.appearanceBorderSize)||2));
    const color=/^#[0-9a-f]{6}$/i.test(m.dataset.appearanceBorderColor||'')?m.dataset.appearanceBorderColor:'#17191d';
    if(!['solid','dashed','dotted','double'].includes(style))return;
    m.style.setProperty('outline',`${size}px ${style} ${color}`,'important');m.style.setProperty('outline-offset','0px');
  }
  function resetAppearance(){
    const state=active,m=state.module;
    for(const control of state.controls){
      const value=state.defaults[control.key]||control.values[0];
      m._appearanceChoice={key:control.key,value};
      try{control.original.click()}finally{delete m._appearanceChoice}
    }
    for(const key of ['appearanceBorderStyle','appearanceBorderSize','appearanceBorderColor'])delete m.dataset[key];
    const legacy=m.querySelector('.image-border-style');if(legacy){legacy.value='none';legacy.dispatchEvent(new Event('change'))}
    const color=m.querySelector('.image-border-color');if(color){color.value='#17191d';color.dispatchEvent(new Event('change'))}
    applyBorder(m);state.onChange('tile-appearance-reset');picker.hidden=true;
    rail.querySelectorAll('button').forEach(button=>button.setAttribute('aria-expanded','false'));
  }
  function open(state){
    if(active===state){close();return}
    close();active=state;state.button.setAttribute('aria-expanded','true');state.module.classList.add('is-appearance-open');flyout.hidden=false;
    state.controls.forEach(control=>{
      const button=document.createElement('button');button.type='button';button.className='tile-appearance-tool';button.dataset.appearanceKey=control.key;
      button.setAttribute('aria-label',control.label);button.title=control.label;button.setAttribute('aria-expanded','false');
      const icon=control.original.querySelector('.icon-font,.icon-palette,.icon-text-color');
      if(icon)button.appendChild(icon.cloneNode(true));else button.textContent=control.key==='font'?'Aa':'◉';
      button.addEventListener('click',()=>showPicker(control));rail.appendChild(button);
    });
    for(const [key,label,path,action] of [
      ['border','Border','M4 4h16v16H4z',borderPicker],
      ['reset','Reset appearance','M4 10a8 8 0 1 1 1 8M4 4v6h6',resetAppearance]
    ]){
      const button=document.createElement('button');button.type='button';button.className='tile-appearance-tool';button.dataset.appearanceKey=key;button.title=label;button.setAttribute('aria-label',label);
      button.innerHTML=`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
      button.addEventListener('click',action);rail.appendChild(button);
    }
    position();
  }
  flyout.addEventListener('pointerenter',()=>clearTimeout(hideTimer));flyout.addEventListener('pointerleave',deferClose);flyout.addEventListener('focusout',deferClose);
  flyout.addEventListener('pointerdown',event=>event.stopPropagation());
  flyout.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});
  flyout.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Escape'){const button=active?.button;close();button?.focus()}});
  document.addEventListener('keydown',event=>{if(event.key==='Tab')keyboard=true},true);
  document.addEventListener('pointerdown',()=>{keyboard=false},true);
  document.addEventListener('pointerdown',event=>{if(active&&!flyout.contains(event.target)&&!active.button.contains(event.target))close()});
  window.addEventListener('blur',close);
  document.addEventListener('fullscreenchange',close);
  function setup(m,{fonts,onChange}){
    if(m.querySelector('.tile-appearance-toggle'))return;
    const controls=[];
    for(const original of m.querySelectorAll('button')){
      const classes=[...original.classList];let key=null;
      if(original.classList.contains('sticky-color-cycle'))key='color';
      else if(original.querySelector('.icon-font'))key='font';
      else if(original.querySelector('.icon-text-color'))key='text';
      else if(classes.some(c=>/(?:-|__)bg$/.test(c))&&original.querySelector('.icon-palette'))key='bg';
      if(!key||controls.some(control=>control.key===key))continue;
      const colors=key==='bg'?backgrounds:key==='text'?texts:notes;
      const values=key==='font'?[...fonts]:Object.keys(colors);
      // Keep legacy saved font values selectable as well.
      if(m.dataset[key]&&fontNames[m.dataset[key]]&&!values.includes(m.dataset[key])&&key==='font')values.push(m.dataset[key]);
      controls.push({key,original,values,colors,label:key==='font'?'Font':key==='text'?'Text color':'Tile color'});
      original.classList.add('tile-appearance-original');original.setAttribute('aria-hidden','true');original.tabIndex=-1;
    }
    m.querySelector('.image-customization')?.classList.add('tile-appearance-original');
    applyBorder(m);
    const template=[...document.querySelectorAll('template')].map(t=>t.content.querySelector('.module')).find(el=>el&&[...el.classList].some(c=>c!=='module'&&c.endsWith('-module')&&m.classList.contains(c)));
    const defaults=template?{...template.dataset}:{};
    controls.sort((a,b)=>['font','bg','color','text'].indexOf(a.key)-['font','bg','color','text'].indexOf(b.key));
    const button=document.createElement('button');button.type='button';button.className='tile-appearance-toggle';button.setAttribute('aria-label','Customize tile');button.title='Customize tile';button.setAttribute('aria-expanded','false');
    const brush=document.querySelector('#customize-toggle svg');if(brush)button.appendChild(brush.cloneNode(true));
    m.classList.add('has-appearance-controls');m.appendChild(button);
    const settings=m.querySelector('.tile-settings-toggle,.collection-settings-toggle,.classmeter-settings-toggle,.highfrequency-settings-button');
    if(settings){
      if(settings.classList.contains('highfrequency-settings-button')){settings.textContent='⚙';settings.setAttribute('aria-label','Open settings');settings.title='Settings'}
      const anchor=settings.closest('.tile-settings-wrap,.collection-settings-wrap,.classmeter-settings-wrap')||settings;
      anchor.classList.add('tile-settings-beside-brush');m.appendChild(anchor);
      window.TeacherTilesSettings.setup(m,settings);
    }

    const state={module:m,button,controls,onChange,defaults};button.addEventListener('click',()=>open(state));
    m.addEventListener('pointerenter',()=>{if(active===state)clearTimeout(hideTimer)});m.addEventListener('pointerleave',deferClose);
    m.addEventListener('keydown',event=>{if(event.key==='Escape'&&active===state){event.stopPropagation();close();button.focus()}});
    const deactivate=m._deactivate;m._deactivate=()=>{if(active===state)close();deactivate?.()};
    const cleanup=m._cleanup;m._cleanup=()=>{if(active===state)close();cleanup?.()};
  }
  window.TeacherTilesAppearance=Object.freeze({setup});
})();
