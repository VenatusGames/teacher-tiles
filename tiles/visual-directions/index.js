(() => {
  'use strict';
  const presets=[['58','Cut'],['59','Write'],['60','Use a glue stick'],['61','Glue'],['62','Write your name'],['63','Throw away scraps'],['64','Clean up'],['65','Use your computer'],['66','Use crayons'],['67','Color'],['68','Circle'],['69','Count']].map(([id,title])=>({title,image:`tiles/visual-directions/assets/${id}.png`}));
  const safeImage=value=>typeof value==='string'&&(presets.some(p=>p.image===value)||(/^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(value)&&value.length<800000))?value:presets[0].image;
  const ordinals=['First','Second','Third','Fourth','Fifth','Sixth','Seventh','Eighth','Ninth','Tenth','Eleventh','Twelfth','Thirteenth','Fourteenth','Fifteenth','Sixteenth','Seventeenth','Eighteenth','Nineteenth','Twentieth'];
  const stepLabel=(mode,i,count)=>mode==='ordinals'?ordinals[i]:mode==='sequence'?(i===0?'First':i===count-1?'Last':i===1?'Next':'Then'):String(i+1);
  const crayonCache=new Map();
  function colorCrayon(color){
    if(crayonCache.has(color))return crayonCache.get(color);
    const promise=new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{try{const canvas=document.createElement('canvas');canvas.width=canvas.height=540;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,540,540);const pixels=ctx.getImageData(0,0,540,540),rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));for(let i=0;i<pixels.data.length;i+=4){const shade=(pixels.data[i]+pixels.data[i+1]+pixels.data[i+2])/3;if(shade<25)continue;for(let c=0;c<3;c++)pixels.data[i+c]=Math.min(255,rgb[c]*shade/110)}ctx.putImageData(pixels,0,0);resolve(canvas.toDataURL('image/png'))}catch(e){reject(e)}};img.onerror=reject;img.src='tiles/visual-directions/assets/67.png'});crayonCache.set(color,promise);if(crayonCache.size>30)crayonCache.delete(crayonCache.keys().next().value);return promise;
  }
  function setup(m){
    const wall=m.querySelector('.directions-wall'),form=m.querySelector('.directions-form'),title=m.querySelector('.directions-title'),upload=m.querySelector('.directions-upload'),preview=m.querySelector('.directions-preview'),modeInput=m.querySelector('.directions-mode'),status=m.querySelector('.directions-status'),error=m.querySelector('.directions-error'),save=form.querySelector('[type=submit]');
    form.setAttribute('popover','manual');
    let layout='grid';
    function reshape(){
      const count=cards.length+1,cols=layout==='vertical'?1:layout==='horizontal'?count:Math.ceil(Math.sqrt(count));
      const rows=Math.ceil(count/cols),size=160;
      m.style.width=(cols*(size+8)+28)+'px';m.style.height=(rows*(size+8)+100)+'px';
    }
    const layoutControl=document.createElement('div');layoutControl.className='directions-layout-switch';layoutControl.setAttribute('role','group');layoutControl.setAttribute('aria-label','Direction layout');
    for(const value of ['vertical','horizontal','grid']){const b=document.createElement('button');b.type='button';b.textContent=value[0].toUpperCase()+value.slice(1);b.dataset.layout=value;b.onclick=()=>{layout=value;reshape();render();changed()};layoutControl.append(b)}
    m.querySelector('.tile-settings-panel').append(layoutControl);
    const crayonLabel=document.createElement('div');crayonLabel.className='tile-setting directions-crayon-color';crayonLabel.textContent='Crayon color';const crayonColor=document.createElement('input');crayonColor.type='color';crayonColor.hidden=true;crayonColor.setAttribute('aria-label','Custom crayon color');crayonColor.value='#4285d4';crayonLabel.append(crayonColor);form.insertBefore(crayonLabel,form.querySelector('.directions-library'));
    const swatches=document.createElement('div');swatches.className='directions-crayon-swatches';crayonLabel.append(swatches);
    for(const color of ['#ef4444','#f97316','#facc15','#22c55e','#3b82f6','#a855f7','#ec4899','#8b5e3c']){
      const button=document.createElement('button');button.type='button';button.style.background=color;button.setAttribute('aria-label','Use crayon color '+color);
      button.onclick=()=>{crayonColor.value=color;crayonColor.dispatchEvent(new Event('input',{bubbles:true}))};swatches.append(button);
    }
    const customColor=document.createElement('button');customColor.type='button';customColor.className='directions-crayon-custom';customColor.textContent='+';customColor.title='Choose a custom color';customColor.setAttribute('aria-label','Choose a custom crayon color');
    customColor.onclick=()=>{if(typeof crayonColor.showPicker==='function')crayonColor.showPicker();else crayonColor.click()};swatches.append(customColor);
    crayonColor.addEventListener('input',()=>{if(editing===null)return;cards[editing].color=crayonColor.value;selectImage(image);render();changed()});
    let cards=[],mode='numbers',editing=null,image=presets[0].image,revision=0,cancelDrag=null;
    const changed=()=>notifyBoardChanged('visual-directions');
    const selectImage=src=>{image=src;preview.src=src;crayonLabel.hidden=!src.endsWith('/67.png');crayonColor.value=cards[editing]?.color||'#4285d4';if(src.endsWith('/67.png'))colorCrayon(crayonColor.value).then(data=>{if(image===src)preview.src=data}).catch(()=>{});form.querySelectorAll('[data-image]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.image===src)))};
    function close(){revision++;if(form.matches(':popover-open'))form.hidePopover();form.hidden=true;upload.value='';editing=null;save.disabled=false;error.textContent=''}
    function edit(index=null){revision++;editing=index;title.value=index===null?'':cards[index].title;selectImage(index===null?presets[0].image:cards[index].image);upload.value='';error.textContent='';save.disabled=false;form.hidden=false;form.showPopover();form.querySelector('[data-image]')?.focus({preventScroll:true})}
    const move=(from,to)=>{if(from===to||to<0||to>=cards.length)return;const [card]=cards.splice(from,1);cards.splice(to,0,card);render();changed()};
    function drag(handle,index){
      handle.addEventListener('pointerdown',e=>{
        if(e.button!==0||e.target.closest('button,input,select,textarea,[contenteditable=true]'))return;e.preventDefault();e.stopPropagation();cancelDrag?.();
        const originX=e.clientX,originY=e.clientY;let target=index,started=false;

        const cleanup=()=>{wall.querySelectorAll('.is-drop-target,.is-dragging').forEach(el=>el.classList.remove('is-drop-target','is-dragging'));handle.removeEventListener('pointermove',moving);handle.removeEventListener('pointerup',finish);handle.removeEventListener('pointercancel',cancel);window.removeEventListener('keydown',escape);window.removeEventListener('blur',cancel);if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId);cancelDrag=null};
        const cancel=()=>cleanup();const escape=event=>{if(event.key==='Escape'){event.stopPropagation();cancel()}};
        const moving=event=>{if(event.pointerId!==e.pointerId)return;if(!started&&Math.hypot(event.clientX-originX,event.clientY-originY)<5)return;if(!started)handle.setPointerCapture(e.pointerId);started=true;handle.closest('article').classList.add('is-dragging');const r=wall.getBoundingClientRect();if(event.clientY<r.top+25)wall.scrollTop-=12;if(event.clientY>r.bottom-25)wall.scrollTop+=12;const hit=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-step-index]');wall.querySelectorAll('.is-drop-target').forEach(el=>el.classList.remove('is-drop-target'));target=hit&&wall.contains(hit)?Number(hit.dataset.stepIndex):index;if(hit&&wall.contains(hit))hit.classList.add('is-drop-target')};
        const finish=event=>{if(event.pointerId!==e.pointerId)return;cleanup();if(started)move(index,target)};
        cancelDrag=cancel;handle.addEventListener('pointermove',moving);handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',cancel);window.addEventListener('keydown',escape);window.addEventListener('blur',cancel);
      });
    }
    function fitCards(){
      const width=wall.clientWidth,height=wall.clientHeight,count=cards.length+1;
      if(!width||!height)return;
      let best=1,score=0;
      for(let cols=1;cols<=count;cols++){
        if(layout==='horizontal'&&cols!==count||layout==='vertical'&&cols!==1)continue;
        const rows=Math.ceil(count/cols),w=(width-8*(cols-1))/cols,h=(height-8*(rows-1))/rows;
        const size=Math.min(w,h);if(size>score){score=size;best=cols}
      }
      wall.style.setProperty('--direction-card-size',`${Math.max(1,score)}px`);
      wall.style.setProperty('--direction-columns',best);wall.style.setProperty('--direction-rows',Math.ceil(count/best));
      wall.style.setProperty('--direction-text',`${Math.max(7,Math.min(25,score*.13))}px`);
      wall.style.setProperty('--direction-label',`${Math.max(7,Math.min(14,score*.09))}px`);
    }
    const observer=new ResizeObserver(fitCards);observer.observe(wall);
    function render(){
      wall.replaceChildren();modeInput.value=mode;layoutControl.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.layout===layout)));
      cards.forEach((card,i)=>{
        const article=document.createElement('article');article.className='direction-card';article.dataset.stepIndex=String(i);
        const label=document.createElement('span');label.className='direction-step';label.textContent=stepLabel(mode,i,cards.length);
        const content=document.createElement('div');content.className='direction-content';
        const imageButton=document.createElement('button');imageButton.type='button';imageButton.className='direction-image-button';imageButton.setAttribute('aria-label',`Change image for ${card.title}`);
        const img=document.createElement('img');img.src=card.image;if(card.image.endsWith('/67.png'))colorCrayon(card.color||'#4285d4').then(src=>{if(img.isConnected)img.src=src}).catch(()=>{});img.alt='';img.draggable=false;imageButton.appendChild(img);imageButton.addEventListener('click',()=>edit(i));
        const name=document.createElement('strong');name.textContent=card.title;name.tabIndex=0;name.title='Double-click to edit title';name.setAttribute('aria-label',`Step title: ${card.title}. Press Enter to edit.`);
        const editTitle=()=>{
          if(content.querySelector('input'))return;
          const input=document.createElement('input');input.className='direction-inline-title';input.value=card.title;input.maxLength=80;input.setAttribute('aria-label','Step title');name.replaceWith(input);input.focus();input.select();let done=false;
          const finish=cancel=>{if(done)return;done=true;if(!cancel){card.title=input.value.trim().slice(0,80)||card.title;changed()}name.textContent=card.title;input.replaceWith(name)};
          input.addEventListener('blur',()=>finish(false));input.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Enter'){event.preventDefault();finish(false)}if(event.key==='Escape'){event.preventDefault();finish(true)}});
        };
        name.addEventListener('dblclick',event=>{event.stopPropagation();editTitle()});name.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();event.stopPropagation();editTitle()}});
        content.append(imageButton,name);
        const tools=document.createElement('div');tools.className='direction-actions';
        for(const [text,description,action] of [['×','Delete step',()=>{cards.splice(i,1);close();reshape();render();changed()}]]){
          const b=document.createElement('button');b.type='button';b.textContent=text;b.setAttribute('aria-label',`${description}: ${card.title}`);b.title=description;if(action)b.addEventListener('click',action);else{b.className='direction-grip';drag(b,i)}if(text==='←')b.disabled=i===0;if(text==='→')b.disabled=i===cards.length-1;tools.appendChild(b);
        }
        const grip=document.createElement('span');grip.className='direction-drag-indicator';grip.textContent='⠿';grip.title='Drag to reorder';grip.setAttribute('aria-hidden','true');article.append(label,grip,content,tools);drag(article,i);wall.appendChild(article);
      });
      const add=document.createElement('button');add.type='button';add.className='direction-add-card';add.textContent='+';add.setAttribute('aria-label','Add step');add.title='Add step';add.disabled=cards.length>=20;
      add.addEventListener('click',()=>{cards.push({title:'New step',image:presets[0].image});reshape();render();changed();fitCards()});wall.appendChild(add);
      requestAnimationFrame(fitCards);
      status.textContent=`${cards.length} steps · Drag to reorder · Double-click a title to edit`;
    }
    for(const preset of presets){const b=document.createElement('button');b.type='button';b.dataset.image=preset.image;b.setAttribute('aria-label',preset.title);const img=document.createElement('img');img.src=preset.image;img.alt='';const text=document.createElement('span');text.textContent=preset.image.endsWith('/67.png')?'Crayon · Pick a color':preset.title;b.append(img,text);b.addEventListener('click',()=>{revision++;save.disabled=false;error.textContent='';selectImage(preset.image);if(editing!==null){cards[editing].image=preset.image;if(!preset.image.endsWith('/67.png'))close();render();changed()}});m.querySelector('.directions-library').appendChild(b)}
    m.querySelector('.directions-add')?.remove();m.querySelector('.directions-cancel').addEventListener('click',close);
    upload.addEventListener('change',async()=>{const file=upload.files[0];if(!file)return;const token=++revision;save.disabled=true;error.textContent='Loading image…';try{if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type))throw Error('Choose a PNG, JPEG, WebP, or GIF image.');const src=await fileToBoardImageData(file,{maxSide:640,maxLength:240000,minSide:160});if(token!==revision||!m.isConnected)return;selectImage(safeImage(src));if(editing!==null){cards[editing].image=image;close();render();changed()}}catch(e){if(token===revision)error.textContent=e.message||'Could not load this image.'}finally{if(token===revision)save.disabled=false}});
    form.addEventListener('submit',e=>{e.preventDefault();if(save.disabled)return;const name=title.value.trim().slice(0,80);if(!name)return;const card={title:name,image};if(editing===null){if(cards.length>=20)return;cards.push(card)}else cards[editing]=card;close();render();changed()});
    form.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close()}});
    modeInput.addEventListener('change',()=>{mode=modeInput.value;render();changed()});
    m._boardGetState=()=>({cards:cards.map(c=>({...c})),mode,layout});
    m._boardSetState=state=>{cancelDrag?.();close();cards=(Array.isArray(state?.cards)?state.cards:[]).slice(0,20).filter(c=>c&&typeof c==='object').map(c=>({title:String(c.title||'Step').slice(0,80),image:safeImage(c.image),color:/^#[0-9a-f]{6}$/i.test(c.color)?c.color:'#4285d4'}));mode=['numbers','ordinals','sequence'].includes(state?.mode)?state.mode:'numbers';layout=['vertical','horizontal','grid'].includes(state?.layout)?state.layout:'grid';render()};
    m._deactivate=()=>{cancelDrag?.();close()};m._cleanup=()=>{cancelDrag?.();observer.disconnect();revision++};render();
  }
  window.TeacherTilesVisualDirections=Object.freeze({setup,stepLabel,safeImage});
})();
