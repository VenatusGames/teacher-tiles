/* Shared editor artwork and menu previews; commands remain in each editor. */
(()=>{'use strict';
const paths={
 color:'<path d="m6 17 6-13 6 13M8 13h8"/>',
 highlight:'<path d="m9 15 8-10 4 4-10 8-2-2ZM9 15l-3 3 2 2 3-3M4 21h8"/>',
 clearHighlight:'<path d="m9 15 8-10 4 4-10 8-2-2M9 15l-3 3 2 2 3-3M3 3l18 18"/>',
 fill:'<path d="m4 12 8-8 8 8-8 8zM9 3l5 5M20 16s3 3 0 4c-3-1 0-4 0-4Z"/>',
 justifyLeft:'<path d="M4 5h16M4 10h10M4 15h16M4 20h10"/>',
 justifyCenter:'<path d="M4 5h16M7 10h10M4 15h16M7 20h10"/>',
 justifyRight:'<path d="M4 5h16M10 10h10M4 15h16M10 20h10"/>',
 justifyFull:'<path d="M4 5h16M4 10h16M4 15h16M4 20h16"/>',
 insertUnorderedList:'<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/>',
 insertOrderedList:'<path d="M10 6h10M10 12h10M10 18h10M3 4h1v5M3 9h3M3 13c3-2 4 1 1 3l-1 2h3"/>',
 indent:'<path d="M4 5h16M11 10h9M11 15h9M4 20h16m0-11 4 3-4 3"/>',
 outdent:'<path d="M4 5h16M11 10h9M11 15h9M4 20h16M8 9l-4 3 4 3"/>',
 undo:'<path d="M4 5v6h6M4 11l4-4a7 7 0 1 1 1 12"/>',
 redo:'<path d="M20 5v6h-6M20 11l-4-4a7 7 0 1 0-1 12"/>',
 strikeThrough:'<path d="M17 5c-1-1-3-2-5-2-3 0-5 2-5 4 0 3 4 4 7 5 2 1 3 2 3 4 0 3-3 5-6 5-2 0-4-1-5-2M3 12h18"/>',
 removeFormat:'<path d="M4 5h13M10 5l-3 14M4 19h5m5-5 6 6m0-6-6 6"/>',
 chevron:'<path d="m7 10 5 5 5-5"/>'
};
const icon=name=>'<svg class="tt-format-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[name]||'')+'</svg>';
const TEXT_COLOR_CHOICES=['#17191d','#ffffff','#5d6470','#244d78','#1d4ed8','#087e8b','#287442','#92700c','#b54708','#b42332','#8b4055','#7543a8'];
const HIGHLIGHT_COLOR_CHOICES=['#fff2a8','#ffe0a6','#ffd4bf','#ffcdd8','#eadcff','#dce8ff','#d4f2df','#cff0ee','#e2e8f0'];
const limit=(value,min,max)=>Math.max(min,Math.min(max,value));
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

function buildColorPickerContent(colorPicker,mode,{textColor,highlightColor,applyPickerColor,closeColorPicker}){
      const bindPickerChoice=(button,value)=>{button.dataset.richPickerColor=value;button.addEventListener('pointerdown',event=>{event.preventDefault();event.stopPropagation();applyPickerColor(value);});button.addEventListener('click',event=>{if(event.detail===0)applyPickerColor(value);});};
      colorPicker.replaceChildren();colorPicker.dataset.mode=mode;
      const header=document.createElement('header');
      const copy=document.createElement('div');
      const eyebrow=document.createElement('small');eyebrow.textContent='RICH TEXT';
      const title=document.createElement('strong');title.textContent=mode==='text'?'Text color':'Highlight';
      copy.append(eyebrow,title);
      const close=document.createElement('button');close.type='button';close.className='richtext-color-picker-close';close.setAttribute('aria-label','Close color picker');close.textContent='×';close.addEventListener('click',closeColorPicker);
      header.append(copy,close);colorPicker.appendChild(header);

      {
        const currentColor=mode==='text'?textColor:highlightColor;
        const picker=document.createElement('div');picker.className='richtext-spectrum-picker';
        const area=document.createElement('div');area.className='richtext-spectrum-area';area.setAttribute('role','slider');area.setAttribute('aria-label',(mode==='text'?'Text':'Highlight')+' color saturation and brightness');area.tabIndex=0;
        const areaKnob=document.createElement('i');areaKnob.className='richtext-spectrum-area-knob';area.appendChild(areaKnob);
        const hue=document.createElement('div');hue.className='richtext-spectrum-hue';hue.setAttribute('role','slider');hue.setAttribute('aria-label',(mode==='text'?'Text':'Highlight')+' color hue');hue.tabIndex=0;
        const hueKnob=document.createElement('i');hueKnob.className='richtext-spectrum-hue-knob';hue.appendChild(hueKnob);
        picker.append(area,hue);

        let state=hexToHsv(currentColor);
        const controls=document.createElement('form');controls.className='richtext-spectrum-controls';
        const preview=document.createElement('span');preview.className='richtext-spectrum-preview';preview.setAttribute('aria-hidden','true');
        const fieldWrap=document.createElement('label');fieldWrap.className='richtext-spectrum-hex';fieldWrap.textContent='#';
        const input=document.createElement('input');input.type='text';input.inputMode='text';input.maxLength=6;input.autocomplete='off';input.spellcheck=false;input.setAttribute('aria-label',(mode==='text'?'Text':'Highlight')+' color hex value');fieldWrap.appendChild(input);
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
        renderSpectrum();picker.hidden=true;
        const expand=document.createElement('button');expand.type='button';expand.className='richtext-spectrum-toggle';expand.textContent='Color picker';expand.setAttribute('aria-expanded','false');expand.onclick=()=>{picker.hidden=!picker.hidden;expand.setAttribute('aria-expanded',String(!picker.hidden));};

        const quickLabel=document.createElement('div');quickLabel.className='richtext-color-section-label';quickLabel.textContent='Quick colors';colorPicker.appendChild(quickLabel);
        const grid=document.createElement('div');grid.className='richtext-color-grid richtext-color-grid--text';
        if(mode==='highlight'){const none=document.createElement('button');none.type='button';none.className='richtext-color-choice richtext-color-choice--clear';none.setAttribute('aria-label','No highlight');none.innerHTML='<span aria-hidden="true"></span>';bindPickerChoice(none,'transparent');grid.append(none);}
        (mode==='text'?TEXT_COLOR_CHOICES:HIGHLIGHT_COLOR_CHOICES).forEach(value=>{
          const button=document.createElement('button');button.type='button';button.className='richtext-color-choice';button.style.setProperty('--choice-color',value);button.setAttribute('aria-label',value);button.title=value;
          button.classList.toggle('is-active',normalizeHexColor(value,value).toLowerCase()===normalizeHexColor(currentColor,currentColor).toLowerCase());
          const dot=document.createElement('span');dot.setAttribute('aria-hidden','true');button.appendChild(dot);bindPickerChoice(button,value);grid.appendChild(button);
        });
        colorPicker.append(grid,controls,expand,picker);
        return;
      }


    }
function optionPreview(button,kind,value){
 button.classList.add('tt-format-option');button.dataset.previewKind=kind;
 if(kind==='font')button.style.fontFamily='"'+value.replace(/["\\]/g,'')+'", sans-serif';
 if(kind==='block'){button.dataset.textStyle=value;button.style.setProperty('--preview-size',({p:14,h1:28,h2:23,h3:18,blockquote:16}[value]||14)+'px');}
}
function enhance(toolbar){
 toolbar.classList.add('tt-format-toolbar');toolbar.dataset.preserveTextEdit='true';
 toolbar.querySelectorAll('[data-format],[data-rich-command]').forEach(b=>{const key=b.dataset.format||b.dataset.richCommand;if(paths[key]){b.innerHTML=icon(key);b.classList.add('tt-format-button');}});
 for(const [selector,name]of [['.richtext-color','color'],['.richtext-highlight','highlight']]){const b=toolbar.querySelector(selector);if(!b)continue;b.querySelector('svg')?.remove();b.insertAdjacentHTML('afterbegin',icon(name));b.insertAdjacentHTML('beforeend',icon('chevron'));b.classList.add('tt-format-color');}
}
function sync(toolbar){
 for(const input of toolbar.querySelectorAll('.pres-object-color,.pres-highlight'))input.parentElement.style.setProperty('--format-color',input.value);
 toolbar.querySelectorAll('select').forEach(s=>s._formatControl?.sync());
}
function selectMenu(select,{kind,beforeOpen=()=>{},preview=()=>{}}={}){
 select.style.display='none';const trigger=document.createElement('button');trigger.type='button';trigger.className='tt-format-select pres-text-control';trigger.dataset.selectKind=kind;trigger.setAttribute('aria-label',select.getAttribute('aria-label'));trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
 const label=document.createElement('span');trigger.append(label);trigger.insertAdjacentHTML('beforeend',icon('chevron'));select.after(trigger);
 const menu=document.createElement('div');menu.className='tt-format-menu';menu.setAttribute('popover','auto');menu.dataset.menuKind=kind;menu.setAttribute('aria-label',select.getAttribute('aria-label'));select.parentElement.append(menu);
 const list=document.createElement('div');list.setAttribute('role','listbox');list.setAttribute('aria-label',select.getAttribute('aria-label'));
 let search=null;if(kind==='font'){search=document.createElement('input');search.type='search';search.placeholder='Search fonts';search.setAttribute('aria-label','Search fonts');menu.append(search);}menu.append(list);
 const sync=()=>{label.textContent=select.selectedOptions[0]?.textContent||'';list.querySelectorAll('[role=option]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.value===select.value)));};
 function render(){list.replaceChildren();const query=search?.value.trim().toLowerCase()||'';for(const child of select.children){const group=child.tagName==='OPTGROUP'?child:null,options=group?[...group.children]:[child],matches=options.filter(o=>o.textContent.toLowerCase().includes(query));if(!matches.length)continue;if(group){const h=document.createElement('div');h.className='tt-format-menu-label';h.textContent=group.label;list.append(h);}for(const option of matches){const b=document.createElement('button');b.type='button';b.textContent=option.textContent;b.dataset.value=option.value;b.setAttribute('role','option');optionPreview(b,kind,option.value);b.onpointerdown=e=>e.preventDefault();b.onpointerenter=()=>preview(option.value);b.onclick=()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));sync();menu.hidePopover();};list.append(b);}}sync();}
 if(search)search.oninput=render;
 trigger.onclick=()=>{if(menu.matches(':popover-open')){menu.hidePopover();return;}beforeOpen();if(search)search.value='';render();menu.showPopover();const r=trigger.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(r.left,innerWidth-menu.offsetWidth-8))+'px';menu.style.top=Math.max(8,Math.min(r.bottom+6,innerHeight-menu.offsetHeight-8))+'px';(search||list.querySelector('[aria-selected=true]')||list.querySelector('button'))?.focus({preventScroll:true});};
 menu.addEventListener('toggle',()=>trigger.setAttribute('aria-expanded',String(menu.matches(':popover-open'))));
 menu.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();menu.hidePopover();trigger.focus();}if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const buttons=[...list.querySelectorAll('button')],i=buttons.indexOf(document.activeElement),next=e.key==='Home'?0:e.key==='End'?buttons.length-1:Math.max(0,Math.min(buttons.length-1,i+(e.key==='ArrowDown'?1:-1)));buttons[next]?.focus();}});
 select._formatControl={sync,close:()=>{if(menu.matches(':popover-open'))menu.hidePopover();}};sync();return select._formatControl;
}
window.TeacherTilesFormattingToolbar=Object.freeze({icon,enhance,sync,optionPreview,selectMenu,buildColorPickerContent});
})();
