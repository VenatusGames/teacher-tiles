(() => {
  'use strict';
  function names(value){return [...new Set((Array.isArray(value)?value:[]).filter(name=>typeof name==='string').map(name=>name.trim().slice(0,80)).filter(Boolean))].slice(0,80);}
  function normalize(raw={}){if(!raw||typeof raw!=='object')raw={};const students=names(raw.students);return {title:String(raw.title||"Santa's List").slice(0,80),classId:String(raw.classId||'').slice(0,120),className:String(raw.className||'').slice(0,100),students,drawerOpen:raw.drawerOpen===true,closedWidth:Number.isFinite(raw.closedWidth)?Math.max(310,Math.min(3000,raw.closedWidth)):0,listed:names(raw.listed).filter(name=>students.includes(name))};}
  function setup(tile){
    let state=normalize(),drag=null,pickingClass=true,fitFrame=0,disposed=false;
    const roster=tile.querySelector('.sl-roster'),paper=tile.querySelector('.sl-paper'),list=tile.querySelector('.sl-names'),title=tile.querySelector('.sl-title'),intro=tile.querySelector('.sl-class-import'),dashboard=tile.querySelector('.sl-dashboard'),drawer=tile.querySelector('.sl-students'),toggle=tile.querySelector('.sl-students-toggle'),status=tile.querySelector('.sl-status'),input=tile.querySelector('.sl-add-name');
    function changed(){(tile._presentationChanged||window.notifyBoardChanged)?.('santas-list');}
    function close(){pickingClass=false;render();}
    function scheduleFit(){
      if(!fitFrame&&!disposed)fitFrame=requestAnimationFrame(()=>{fitFrame=0;fitList()});
    }
    function fitList(){
      if(disposed||pickingClass||!tile.isConnected)return;
      // Measure layout pixels, independent of the board camera zoom.
      const ink=tile.querySelector('.sl-ink'),inkStyle=getComputedStyle(ink);
      const paperNeeded=title.offsetHeight+list.scrollHeight+parseFloat(getComputedStyle(list).marginTop)+parseFloat(inkStyle.top)+parseFloat(inkStyle.bottom)+4;
      const chrome=tile.offsetHeight-paper.clientHeight;
      const required=Math.ceil(paperNeeded+chrome);
      if(document.fullscreenElement===tile){
        const available=Math.max(80,ink.clientHeight-title.offsetHeight-12);
        const columns=Math.max(1,Math.min(Math.floor(ink.clientWidth/135)||1,Math.ceil(list.children.length/Math.max(1,Math.floor(available/48)))));
        const rows=Math.max(1,Math.ceil(list.children.length/columns));
        list.style.setProperty('--sl-columns',columns);
        list.style.setProperty('--sl-fullscreen-font',Math.min(36,Math.max(10,(available/rows-8)/1.2))+'px');
        return;
      }
      list.style.removeProperty('--sl-columns');list.style.removeProperty('--sl-fullscreen-font');
      tile.style.minHeight=Math.max(400,required)+'px';
      if(tile.offsetHeight<required)tile.style.height=required+'px';
    }
    function setDrawer(open){
      const wasOpen=tile.classList.contains('sl-drawer-open');
      if(open!==wasOpen&&document.fullscreenElement!==tile){
        const width=tile.offsetWidth||parseFloat(getComputedStyle(tile).width)||430;
        if(open){state.closedWidth=state.closedWidth||width;tile.style.width=(state.closedWidth+224)+'px'}
        else{state.closedWidth=Math.max(310,width-224);tile.style.width=state.closedWidth+'px'}
      }
      cancelDrag();state.drawerOpen=open;tile.classList.toggle('sl-drawer-open',open);drawer.inert=!open;drawer.setAttribute('aria-hidden',String(!open));toggle.setAttribute('aria-expanded',String(open));scheduleFit();
    }
    function cancelDrag(){if(!drag)return;drag.ghost?.remove();try{drag.chip.releasePointerCapture(drag.id)}catch{}drag=null;tile.classList.remove('sl-dragging');paper.classList.remove('sl-drop-target');}
    function add(name){if(state.listed.includes(name))return;state.listed.push(name);render(name);changed();playUiSfx?.('pop');}
    function remove(name){state.listed=state.listed.filter(value=>value!==name);render();changed();}
    function chipFor(name){
      const chip=document.createElement('div');chip.className='sl-student';chip.tabIndex=0;chip.setAttribute('role','button');chip.setAttribute('aria-label','Add '+name+' to the list');chip.textContent=name;
      chip.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();add(name)}});
      chip.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();cancelDrag();drag={id:event.pointerId,x:event.clientX,y:event.clientY,chip,name,ghost:null};chip.setPointerCapture(event.pointerId)});
      chip.addEventListener('pointermove',event=>{
        if(!drag||drag.id!==event.pointerId)return;event.stopPropagation();
        if(!drag.ghost&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<5)return;
        if(!drag.ghost){tile.classList.add('sl-dragging');drag.ghost=document.createElement('div');drag.ghost.className='student-drag-ghost sl-drag-ghost';drag.ghost.textContent=name;(document.fullscreenElement===tile?tile:document.body).append(drag.ghost);}
        drag.ghost.style.left=event.clientX+'px';drag.ghost.style.top=event.clientY+'px';
        const rect=paper.getBoundingClientRect();paper.classList.toggle('sl-drop-target',event.clientX>=rect.left&&event.clientX<=rect.right&&event.clientY>=rect.top&&event.clientY<=rect.bottom);
      });
      chip.addEventListener('pointerup',event=>{if(!drag||drag.id!==event.pointerId)return;event.stopPropagation();const rect=paper.getBoundingClientRect(),accept=!drag.ghost||(event.clientX>=rect.left&&event.clientX<=rect.right&&event.clientY>=rect.top&&event.clientY<=rect.bottom);cancelDrag();if(accept)add(name)});
      chip.addEventListener('pointercancel',cancelDrag);return chip;
    }
    function render(animatedName=''){
      intro.hidden=!pickingClass;dashboard.hidden=pickingClass;tile.querySelector('.sl-back').hidden=!state.classId&&!state.students.length;
      setDrawer(!pickingClass&&state.drawerOpen);
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

      }
      tile.querySelector('.sl-paper-empty').hidden=state.listed.length>0;
      status.textContent=state.listed.length?`${state.listed.length} on the list`:'';scheduleFit();
    }
    const detach=attachClassRosterLoader(tile.querySelector('.sl-loader-anchor'),(_,value)=>{
      cancelDrag();state.classId=String(value.id);state.className=String(value.name);state.students=names(value.students);state.listed=[];state.drawerOpen=true;close();changed();
    });
    tile.querySelector('.sl-load-class').addEventListener('click',()=>{cancelDrag();pickingClass=true;render();});
    tile.querySelector('.sl-back').addEventListener('click',close);
    tile.querySelector('.sl-manual').addEventListener('click',()=>{state.drawerOpen=true;close();input.focus();});
    toggle.addEventListener('click',()=>{setDrawer(!state.drawerOpen);changed();});
    tile.querySelector('.sl-drawer-close').addEventListener('click',()=>{setDrawer(false);toggle.focus({preventScroll:true});changed();});
    const outside=event=>{if(state.drawerOpen&&!drag&&!event.composedPath().includes(drawer)&&!event.composedPath().includes(toggle)&&!event.composedPath().includes(intro)&&!event.target.closest('.sl-load-class')){setDrawer(false);changed();}};
    const escape=event=>{if(event.key==='Escape'&&state.drawerOpen){event.preventDefault();event.stopPropagation();setDrawer(false);toggle.focus({preventScroll:true});changed();}};
    document.addEventListener('click',outside);tile.addEventListener('keydown',escape);
    title.addEventListener('input',()=>{state.title=title.value.slice(0,80);changed()});title.addEventListener('blur',()=>{if(!title.value.trim()){state.title="Santa's List";title.value=state.title;changed()}});
    tile.querySelector('.sl-add-form').addEventListener('submit',event=>{event.preventDefault();const name=input.value.trim().slice(0,80);if(!name)return;if(state.students.length>=80){status.textContent='This list supports up to 80 names';return;}if(!state.students.includes(name))state.students.push(name);input.value='';render();changed();});
    tile.querySelector('.sl-reset').addEventListener('click',()=>{cancelDrag();state.listed=[];render();changed()});
    function syncClass(){if(!state.classId)return;const found=readClassRosters().find(roster=>String(roster.id)===state.classId);if(!found)return;cancelDrag();state.className=found.name;state.students=names(found.students);state.listed=state.listed.filter(name=>state.students.includes(name));render();changed();}
    window.addEventListener('teachertiles:classeschange',syncClass);
    for(const element of [roster,list])element.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});
    tile._boardGetState=()=>normalize({...state,closedWidth:document.fullscreenElement===tile?state.closedWidth:Math.max(310,tile.offsetWidth-(state.drawerOpen?224:0))});
    tile._boardSetState=value=>{cancelDrag();state=normalize(value);pickingClass=!state.classId&&!state.students.length;render();};
    const sizing=new ResizeObserver(scheduleFit);sizing.observe(paper);sizing.observe(list);sizing.observe(title);
    document.fonts?.ready.then(scheduleFit);
    document.addEventListener('fullscreenchange',scheduleFit);
    const deactivate=tile._deactivate,cleanup=tile._cleanup;
    tile._deactivate=()=>{cancelDrag();setDrawer(false);deactivate?.()};tile._cleanup=()=>{disposed=true;cancelAnimationFrame(fitFrame);sizing.disconnect();document.removeEventListener('fullscreenchange',scheduleFit);cancelDrag();document.removeEventListener('click',outside);tile.removeEventListener('keydown',escape);detach();window.removeEventListener('teachertiles:classeschange',syncClass);cleanup?.()};
    render();
  }
  function preview(tile,raw){const state=normalize(raw);tile.querySelector('.sl-class-import').hidden=true;tile.querySelector('.sl-dashboard').hidden=false;tile.querySelector('.sl-title').value=state.title;const list=tile.querySelector('.sl-names');list.replaceChildren();state.listed.forEach(name=>{const row=document.createElement('li');row.className='sl-entry';row.textContent=name;list.append(row)});tile.querySelector('.sl-paper-empty').hidden=Boolean(state.listed.length);}
  window.TeacherTilesSantasList=Object.freeze({setup,preview,normalize});
})();
