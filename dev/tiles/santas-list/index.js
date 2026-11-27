(() => {
  'use strict';
  function names(value){return [...new Set((Array.isArray(value)?value:[]).filter(name=>typeof name==='string').map(name=>name.trim().slice(0,80)).filter(Boolean))].slice(0,80);}
  function normalize(raw={}){if(!raw||typeof raw!=='object')raw={};const students=names(raw.students);return {title:String(raw.title||"Santa's List").slice(0,80),classId:String(raw.classId||'').slice(0,120),className:String(raw.className||'').slice(0,100),students,listed:names(raw.listed).filter(name=>students.includes(name))};}
  function setup(tile){
    let state=normalize(),drag=null;
    const roster=tile.querySelector('.sl-roster'),paper=tile.querySelector('.sl-paper'),list=tile.querySelector('.sl-names'),title=tile.querySelector('.sl-title'),dialog=tile.querySelector('.sl-class-dialog'),status=tile.querySelector('.sl-status'),input=tile.querySelector('.sl-add-name');
    function changed(){(tile._presentationChanged||window.notifyBoardChanged)?.('santas-list');}
    function close(){dialog.close();}
    function cancelDrag(){if(!drag)return;drag.ghost?.remove();try{drag.chip.releasePointerCapture(drag.id)}catch{}drag=null;paper.classList.remove('sl-drop-target');}
    function add(name){if(state.listed.includes(name))return;state.listed.push(name);render(name);changed();playUiSfx?.('pop');}
    function remove(name){state.listed=state.listed.filter(value=>value!==name);render();changed();}
    function chipFor(name){
      const chip=document.createElement('div');chip.className='sl-student';chip.tabIndex=0;chip.setAttribute('role','button');chip.setAttribute('aria-label','Add '+name+' to the list');chip.textContent=name;
      chip.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();add(name)}});
      chip.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();cancelDrag();drag={id:event.pointerId,x:event.clientX,y:event.clientY,chip,name,ghost:null};chip.setPointerCapture(event.pointerId)});
      chip.addEventListener('pointermove',event=>{
        if(!drag||drag.id!==event.pointerId)return;event.stopPropagation();
        if(!drag.ghost&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<5)return;
        if(!drag.ghost){drag.ghost=document.createElement('div');drag.ghost.className='student-drag-ghost sl-drag-ghost';drag.ghost.textContent=name;(document.fullscreenElement===tile?tile:document.body).append(drag.ghost);}
        drag.ghost.style.left=event.clientX+'px';drag.ghost.style.top=event.clientY+'px';
        const rect=paper.getBoundingClientRect();paper.classList.toggle('sl-drop-target',event.clientX>=rect.left&&event.clientX<=rect.right&&event.clientY>=rect.top&&event.clientY<=rect.bottom);
      });
      chip.addEventListener('pointerup',event=>{if(!drag||drag.id!==event.pointerId)return;event.stopPropagation();const rect=paper.getBoundingClientRect(),accept=!drag.ghost||(event.clientX>=rect.left&&event.clientX<=rect.right&&event.clientY>=rect.top&&event.clientY<=rect.bottom);cancelDrag();if(accept)add(name)});
      chip.addEventListener('pointercancel',cancelDrag);return chip;
    }
    function render(animatedName=''){
      title.value=state.title;tile.querySelector('.sl-class-name').textContent=state.className;
      roster.replaceChildren();
      for(const name of state.students.filter(name=>!state.listed.includes(name)))roster.append(chipFor(name));
      if(!roster.children.length){const empty=document.createElement('p');empty.className='sl-empty';empty.textContent=state.students.length?'Everyone is on the list':'Load a class or add a name';roster.append(empty);}
      list.replaceChildren();
      for(const name of state.listed){
        const row=document.createElement('li');row.className='sl-entry';
        const word=document.createElement('span');word.textContent=name;
        if(name===animatedName)row.classList.add('sl-writing');
        const removeButton=document.createElement('button');removeButton.type='button';removeButton.className='sl-remove';removeButton.textContent='×';removeButton.setAttribute('aria-label','Remove '+name);removeButton.addEventListener('click',()=>remove(name));
        row.append(word,removeButton);list.append(row);
        if(name===animatedName)requestAnimationFrame(()=>row.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));
      }
      tile.querySelector('.sl-paper-empty').hidden=state.listed.length>0;
      status.textContent=state.listed.length?`${state.listed.length} on the list`:'';
    }
    const detach=attachClassRosterLoader(tile.querySelector('.sl-loader-anchor'),(_,value)=>{
      cancelDrag();state.classId=String(value.id);state.className=String(value.name);state.students=names(value.students);state.listed=[];close();render();changed();
    });
    tile.querySelector('.sl-load-class').addEventListener('click',()=>dialog.showModal());
    dialog.querySelector('.sl-dialog-close').addEventListener('click',close);
    dialog.addEventListener('pointerdown',event=>event.stopPropagation());dialog.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});
    dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close()});
    title.addEventListener('input',()=>{state.title=title.value.slice(0,80);changed()});title.addEventListener('blur',()=>{if(!title.value.trim()){state.title="Santa's List";title.value=state.title;changed()}});
    tile.querySelector('.sl-add-form').addEventListener('submit',event=>{event.preventDefault();const name=input.value.trim().slice(0,80);if(!name)return;if(state.students.length>=80){status.textContent='This list supports up to 80 names';return;}if(!state.students.includes(name))state.students.push(name);input.value='';render();changed();});
    tile.querySelector('.sl-reset').addEventListener('click',()=>{cancelDrag();state.listed=[];render();changed()});
    function syncClass(){if(!state.classId)return;const found=readClassRosters().find(roster=>String(roster.id)===state.classId);if(!found)return;cancelDrag();state.className=found.name;state.students=names(found.students);state.listed=state.listed.filter(name=>state.students.includes(name));render();changed();}
    window.addEventListener('teachertiles:classeschange',syncClass);
    for(const element of [roster,list])element.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});
    tile._boardGetState=()=>normalize(state);
    tile._boardSetState=value=>{cancelDrag();close();state=normalize(value);render();};
    const deactivate=tile._deactivate,cleanup=tile._cleanup;
    tile._deactivate=()=>{cancelDrag();close();deactivate?.()};tile._cleanup=()=>{cancelDrag();close();detach();window.removeEventListener('teachertiles:classeschange',syncClass);cleanup?.()};
    render();
  }
  function preview(tile,raw){const state=normalize(raw);tile.querySelector('.sl-title').value=state.title;const list=tile.querySelector('.sl-names');list.replaceChildren();state.listed.forEach(name=>{const row=document.createElement('li');row.className='sl-entry';row.textContent=name;list.append(row)});tile.querySelector('.sl-paper-empty').hidden=Boolean(state.listed.length);}
  window.TeacherTilesSantasList=Object.freeze({setup,preview,normalize});
})();
