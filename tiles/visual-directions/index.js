(() => {
  'use strict';
  const presets=[['58','Cut'],['59','Write'],['60','Use a glue stick'],['61','Glue'],['62','Write your name'],['63','Throw away scraps'],['64','Clean up'],['65','Use your computer']].map(([id,title])=>({title,image:`tiles/visual-directions/assets/${id}.png`}));
  const safeImage=value=>typeof value==='string'&&(presets.some(p=>p.image===value)||(/^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(value)&&value.length<800000))?value:presets[0].image;
  const ordinals=['First','Second','Third','Fourth','Fifth','Sixth','Seventh','Eighth','Ninth','Tenth','Eleventh','Twelfth','Thirteenth','Fourteenth','Fifteenth','Sixteenth','Seventeenth','Eighteenth','Nineteenth','Twentieth'];
  const stepLabel=(mode,i,count)=>mode==='ordinals'?ordinals[i]:mode==='sequence'?(i===0?'First':i===count-1?'Last':i===1?'Next':'Then'):String(i+1);
  function setup(m){
    const wall=m.querySelector('.directions-wall'),form=m.querySelector('.directions-form'),title=m.querySelector('.directions-title'),upload=m.querySelector('.directions-upload'),preview=m.querySelector('.directions-preview'),modeInput=m.querySelector('.directions-mode'),status=m.querySelector('.directions-status'),error=m.querySelector('.directions-error'),save=form.querySelector('[type=submit]');
    let cards=[],mode='numbers',editing=null,image=presets[0].image,revision=0,cancelDrag=null;
    const changed=()=>notifyBoardChanged('visual-directions');
    const selectImage=src=>{image=src;preview.src=src;form.querySelectorAll('[data-image]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.image===src)))};
    function close(){revision++;form.hidden=true;upload.value='';editing=null;save.disabled=false;error.textContent=''}
    function edit(index=null){revision++;editing=index;title.value=index===null?'':cards[index].title;selectImage(index===null?presets[0].image:cards[index].image);upload.value='';error.textContent='';save.disabled=false;form.hidden=false;title.focus({preventScroll:true})}
    const move=(from,to)=>{if(from===to||to<0||to>=cards.length)return;const [card]=cards.splice(from,1);cards.splice(to,0,card);render();changed()};
    function drag(handle,index){
      handle.addEventListener('pointerdown',e=>{
        if(e.button!==0)return;e.preventDefault();e.stopPropagation();cancelDrag?.();
        const originX=e.clientX,originY=e.clientY;let target=index,started=false;
        handle.setPointerCapture(e.pointerId);
        const cleanup=()=>{wall.querySelectorAll('.is-drop-target,.is-dragging').forEach(el=>el.classList.remove('is-drop-target','is-dragging'));handle.removeEventListener('pointermove',moving);handle.removeEventListener('pointerup',finish);handle.removeEventListener('pointercancel',cancel);window.removeEventListener('keydown',escape);window.removeEventListener('blur',cancel);if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId);cancelDrag=null};
        const cancel=()=>cleanup();const escape=event=>{if(event.key==='Escape'){event.stopPropagation();cancel()}};
        const moving=event=>{if(event.pointerId!==e.pointerId)return;if(!started&&Math.hypot(event.clientX-originX,event.clientY-originY)<5)return;started=true;handle.closest('article').classList.add('is-dragging');const r=wall.getBoundingClientRect();if(event.clientY<r.top+25)wall.scrollTop-=12;if(event.clientY>r.bottom-25)wall.scrollTop+=12;const hit=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-step-index]');wall.querySelectorAll('.is-drop-target').forEach(el=>el.classList.remove('is-drop-target'));target=hit&&wall.contains(hit)?Number(hit.dataset.stepIndex):index;if(hit&&wall.contains(hit))hit.classList.add('is-drop-target')};
        const finish=event=>{if(event.pointerId!==e.pointerId)return;cleanup();if(started)move(index,target)};
        cancelDrag=cancel;handle.addEventListener('pointermove',moving);handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',cancel);window.addEventListener('keydown',escape);window.addEventListener('blur',cancel);
      });
    }
    function render(){
      wall.replaceChildren();modeInput.value=mode;
      if(!cards.length){const empty=document.createElement('p');empty.className='widget-empty';empty.textContent='Make the next step clear. Add a picture direction to begin.';wall.appendChild(empty)}
      cards.forEach((card,i)=>{
        const article=document.createElement('article');article.className='direction-card';article.dataset.stepIndex=String(i);
        const label=document.createElement('span');label.className='direction-step';label.textContent=stepLabel(mode,i,cards.length);
        const content=document.createElement('button');content.type='button';content.className='direction-content';content.setAttribute('aria-label',`Edit step ${i+1}: ${card.title}`);
        const img=document.createElement('img');img.src=card.image;img.alt='';img.draggable=false;const name=document.createElement('strong');name.textContent=card.title;content.append(img,name);content.addEventListener('click',()=>edit(i));
        const tools=document.createElement('div');tools.className='direction-actions';
        for(const [text,description,action] of [['←','Move earlier',()=>move(i,i-1)],['⠿','Drag to reorder',null],['→','Move later',()=>move(i,i+1)],['×','Delete step',()=>{cards.splice(i,1);close();render();changed()}]]){
          const b=document.createElement('button');b.type='button';b.textContent=text;b.setAttribute('aria-label',`${description}: ${card.title}`);b.title=description;if(action)b.addEventListener('click',action);else{b.className='direction-grip';drag(b,i)}if(text==='←')b.disabled=i===0;if(text==='→')b.disabled=i===cards.length-1;tools.appendChild(b);
        }
        article.append(label,content,tools);wall.appendChild(article);
      });
      status.textContent=`${cards.length} steps · Drag the handles to reorder`;m.querySelector('.directions-add').disabled=cards.length>=20;
    }
    for(const preset of presets){const b=document.createElement('button');b.type='button';b.dataset.image=preset.image;b.setAttribute('aria-label',preset.title);const img=document.createElement('img');img.src=preset.image;img.alt='';const text=document.createElement('span');text.textContent=preset.title;b.append(img,text);b.addEventListener('click',()=>{revision++;save.disabled=false;error.textContent='';selectImage(preset.image);if(!title.value.trim())title.value=preset.title});m.querySelector('.directions-library').appendChild(b)}
    m.querySelector('.directions-add').addEventListener('click',()=>edit());m.querySelector('.directions-cancel').addEventListener('click',close);
    upload.addEventListener('change',async()=>{const file=upload.files[0];if(!file)return;const token=++revision;save.disabled=true;error.textContent='Loading image…';try{if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type))throw Error('Choose a PNG, JPEG, WebP, or GIF image.');const src=await fileToBoardImageData(file,{maxSide:640,maxLength:240000,minSide:160});if(token!==revision||!m.isConnected)return;selectImage(safeImage(src));error.textContent=''}catch(e){if(token===revision)error.textContent=e.message||'Could not load this image.'}finally{if(token===revision)save.disabled=false}});
    form.addEventListener('submit',e=>{e.preventDefault();if(save.disabled)return;const name=title.value.trim().slice(0,80);if(!name)return;const card={title:name,image};if(editing===null){if(cards.length>=20)return;cards.push(card)}else cards[editing]=card;close();render();changed()});
    form.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close()}});
    modeInput.addEventListener('change',()=>{mode=modeInput.value;render();changed()});
    m._boardGetState=()=>({cards:cards.map(c=>({...c})),mode});
    m._boardSetState=state=>{cancelDrag?.();close();cards=(Array.isArray(state?.cards)?state.cards:[]).slice(0,20).filter(c=>c&&typeof c==='object').map(c=>({title:String(c.title||'Step').slice(0,80),image:safeImage(c.image)}));mode=['numbers','ordinals','sequence'].includes(state?.mode)?state.mode:'numbers';render()};
    m._deactivate=()=>{cancelDrag?.();close()};m._cleanup=()=>{cancelDrag?.();revision++};render();
  }
  window.TeacherTilesVisualDirections=Object.freeze({setup,stepLabel,safeImage});
})();
