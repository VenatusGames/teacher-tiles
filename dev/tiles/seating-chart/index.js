(() => {
  'use strict';
  function layout(count,kind){
    return Array.from({length:count},(_,i)=>{
      if(kind==='groups'){const group=Math.floor(i/4),cols=Math.max(1,Math.ceil(Math.sqrt(Math.ceil(count/4)*1.4))),rows=Math.ceil(Math.ceil(count/4)/cols);return {x:6+(group%cols)*84/cols+(i%2)*38/cols,y:16+Math.floor(group/cols)*72/rows+Math.floor(i%4/2)*Math.min(11,26/rows)};}
      if(kind==='horseshoe'){const side=Math.ceil(count/3);if(i<side)return{x:5,y:17+i*68/side};if(i<side*2)return{x:86,y:17+(i-side)*68/side};return{x:18+(i-side*2)*62/Math.max(1,count-side*2),y:82};}
      const cols=Math.max(1,Math.ceil(Math.sqrt(count*1.5))),rows=Math.ceil(count/cols);return{x:5+(i%cols)*84/cols,y:17+Math.floor(i/cols)*68/rows};
    });
  }
  function shuffle(items){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  function setup(m){
    const furniture=window.TeacherTilesSeatingFurniture;
    const room=m.querySelector('.seating-room'),status=m.querySelector('.seating-status'),assignment=m.querySelector('.seating-assignment'),layoutSelect=m.querySelector('.seating-layout');
    const editor=m.querySelector('.seating-editor'),importPanel=m.querySelector('.seating-class-import'),dashboard=m.querySelector('.seating-dashboard');
    const changeClass=m.querySelector('.seating-change-class');
    changeClass.classList.remove('tile-action');changeClass.classList.add('pbis-change-class');
    movePbisClassActionsToFooter(m);
    const footer=m.querySelector('.pbis-footer-actions');
    footer.prepend(m.querySelector('.seating-randomize'),m.querySelector('.seating-reset'));
    const layoutWrap=document.createElement('div');layoutWrap.className='seating-layout-wrap';layoutWrap.dataset.skipBoardSave='';
    layoutWrap.innerHTML='<button type="button" class="seating-layout-toggle tile-action" aria-expanded="false" title="Layout"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg><span>Layout</span></button><div class="seating-layout-panel" hidden><header><strong>Layout</strong><button type="button" class="custom-icon seating-layout-close" aria-label="Close Layout">×</button></header><small>Arrange student desks. Furniture stays in place.</small></div>';
    footer.prepend(layoutWrap);
    const layoutToggle=layoutWrap.querySelector('.seating-layout-toggle'),layoutPanel=layoutWrap.querySelector('.seating-layout-panel');
    layoutToggle.setAttribute('aria-label','Layout');layoutSelect.hidden=true;layoutPanel.append(layoutSelect);
    const setLayoutOpen=open=>{layoutPanel.hidden=!open;layoutToggle.setAttribute('aria-expanded',String(open));m.classList.toggle('is-layout-open',open)};
    layoutToggle.addEventListener('click',()=>setLayoutOpen(layoutPanel.hidden));
    layoutWrap.querySelector('.seating-layout-close').addEventListener('click',()=>{setLayoutOpen(false);layoutToggle.focus({preventScroll:true})});
    for(const [value,label] of [['rows','Rows'],['groups','Groups of Four'],['horseshoe','Horseshoe']]){
      const button=document.createElement('button');button.type='button';button.className='seating-layout-choice';button.dataset.layout=value;
      const cells=layout(12,value).map(p=>`<rect x="${p.x}" y="${p.y}" width="9" height="9" rx="2"/>`).join('');
      button.innerHTML=`<svg viewBox="0 0 100 100" aria-hidden="true">${cells}</svg><span>${label}</span>`;
      button.addEventListener('click',()=>{layoutSelect.value=value;arrange();setLayoutOpen(false);layoutToggle.focus({preventScroll:true})});layoutPanel.append(button);
    }
    const tools=document.createElement('div'),clip=document.createElement('div'),content=document.createElement('div');
    tools.className='seating-hover-tools';clip.className='seating-hover-clip';content.className='seating-hover-content';
    room.after(tools);tools.append(clip);clip.append(content);content.append(editor,status);
    window.TeacherTilesMathControls.bindHover(m,'is-seating-controls-open');
    let names=[],desks=[],selected='',className='',classId='',classLogo='👥',classReady=false,serial=0,cancelDrag=null;
    let scope=window.TeacherTilesClassScope||'local';
    const saveLayout=()=>{if(classReady&&classId&&scope===(window.TeacherTilesClassScope||'local'))writeClassSeatingChart(classId,{layout:layoutSelect.value,desks},m);};
    const changed=()=>{saveLayout();notifyBoardChanged('seating-chart');};
    const selectedDesk=()=>desks.find(d=>d.id===selected);
    function dimensions(count,kind){
      count=Math.max(1,count);const cols=Math.ceil(Math.sqrt(count*1.5));
      const width=layoutSelect.value==='groups'?Math.min(9,34/Math.ceil(Math.sqrt(Math.ceil(count/4)*1.4))):Math.min(9,78/cols);
      const height=layoutSelect.value==='horseshoe'?Math.min(9,60/Math.ceil(count/3)):Math.min(9,60/Math.ceil(count/cols));
      return furniture.catalog[kind]?.size||[width,height];
    }
    const sizeOf=kind=>dimensions(desks.filter(d=>d.kind==='desk').length||names.length,kind);
    const geometry=()=>room.getBoundingClientRect();
    function placeElement(el,desk){const [w,h]=sizeOf(desk.kind);Object.assign(el.style,{left:desk.x+'%',top:desk.y+'%',width:w+'%',height:h+'%',transform:`rotate(${desk.angle}deg)`})}
    function makeElement(desk,preview=false){
      const el=document.createElement(preview?'div':'button');if(!preview)el.type='button';
      el.className=`seating-desk seating-${desk.kind}${preview?' seating-placement-preview':''}`;el.dataset.id=desk.id;
      el.innerHTML=furniture.art(desk.kind);placeElement(el,desk);
      const label=document.createElement('span');label.textContent=desk.name||(desk.kind==='desk'?'Empty':furniture.catalog[desk.kind].name);label.style.transform=`rotate(${-desk.angle}deg)`;el.append(label);
      el.setAttribute('aria-label',`${desk.name||furniture.catalog[desk.kind].name}${desk.pinned?', assignment locked':''}. Drag to move or use arrow keys`);
      return el;
    }
    function drawGuides(guides){
      room.querySelectorAll('.seating-snap-guide').forEach(e=>e.remove());
      for(const guide of guides){const el=document.createElement('i');el.className=`seating-snap-guide seating-snap-guide--${guide.axis}`;el.style[guide.axis==='x'?'left':'top']=guide.at+'%';room.append(el)}
    }
    function clearPreview(){room.querySelectorAll('.seating-placement-preview,.seating-snap-guide').forEach(e=>e.remove())}
    function placement(kind,event){
      const r=geometry();if(!classReady||desks.length>=80||event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)return null;
      const [w,h]=sizeOf(kind),desk={id:'preview',kind,name:'',x:(event.clientX-r.left)/r.width*100-w/2,y:(event.clientY-r.top)/r.height*100-h/2,angle:0,pinned:false};
      if(event.autoPlace){
        const fits=candidate=>{const b=furniture.bounds(candidate,[w,h],r);return desks.every(other=>{const t=furniture.bounds(other,sizeOf(other.kind),r);return b.x+b.w+2<=t.x||t.x+t.w+2<=b.x||b.y+b.h+2<=t.y||t.y+t.h+2<=b.y})};
        if(!fits(desk)){let found=false;for(let y=12;y<=98-h&&!found;y+=8)for(let x=3;x<=97-w;x+=8){const candidate={...desk,x,y};if(fits(candidate)){Object.assign(desk,candidate);found=true;break}}}
      }
      return furniture.snap(desk,desks,sizeOf,r,event.altKey);
    }
    function selectDesk(id){selected=id;room.querySelectorAll('.seating-desk').forEach(el=>el.classList.toggle('is-selected',el.dataset.id===id));updateEditor()}
    const furnitureUI=furniture.drawer(m,{room,
      preview(kind,event){clearPreview();const result=placement(kind,event);if(result){room.append(makeElement(result.item,true));drawGuides(result.guides)}},
      clearPreview,
      add(kind,event){const result=placement(kind,event);if(!result)return;const desk={...result.item,id:`seat-${++serial}`};desks.push(desk);selected=desk.id;render();changed()}
    });
    const outside=e=>{if(!layoutWrap.contains(e.target))setLayoutOpen(false);if(selected&&!(m.contains(e.target)&&e.target.closest('.seating-desk,.seating-editor')))selectDesk('')};
    document.addEventListener('pointerdown',outside,true);
    const escape=e=>{if(e.key==='Escape'){cancelDrag?.();clearPreview();selectDesk('');setLayoutOpen(false)}};
    m.addEventListener('keydown',escape);
    function render(){
      layoutPanel.querySelectorAll('[data-layout]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.layout===layoutSelect.value)));
      importPanel.hidden=classReady;dashboard.hidden=!classReady;if(!classReady){furnitureUI.close();setLayoutOpen(false)}
      m.querySelector('.seating-clear').disabled=desks.length===0;
      m.querySelector('.seating-class-name').textContent=className||'Class';
      m.querySelector('.seating-class-logo').textContent=classLogo;
      room.replaceChildren();const front=document.createElement('div');front.className='seating-front';front.textContent='FRONT OF CLASSROOM';room.append(front);
      for(const desk of desks){
        const el=makeElement(desk);el.classList.toggle('is-selected',selected===desk.id);el.classList.toggle('is-pinned',desk.pinned);
        el.addEventListener('click',()=>{selectDesk(desk.id);el.focus({preventScroll:true})});
        el.addEventListener('pointerdown',event=>{
          if(event.button!==0)return;event.stopPropagation();event.preventDefault();cancelDrag?.();selected=desk.id;
          room.querySelectorAll('.seating-desk').forEach(e=>e.classList.toggle('is-selected',e===el));
          const startX=event.clientX,startY=event.clientY,x=desk.x,y=desk.y;
          const controller=new AbortController();el.setPointerCapture(event.pointerId);m.classList.add('is-seating-dragging');
          cancelDrag=()=>{controller.abort();cancelDrag=null;drawGuides([]);m.classList.remove('is-seating-dragging');};
          el.addEventListener('pointermove',e=>{
            const rect=geometry(),result=furniture.snap({...desk,x:x+(e.clientX-startX)/rect.width*100,y:y+(e.clientY-startY)/rect.height*100},desks,sizeOf,rect,e.altKey);
            Object.assign(desk,{x:result.item.x,y:result.item.y});placeElement(el,desk);drawGuides(result.guides);
          },{signal:controller.signal});
          const done=()=>{cancelDrag?.();updateEditor();changed();};el.addEventListener('pointerup',done,{signal:controller.signal});el.addEventListener('pointercancel',done,{signal:controller.signal});
        });
        el.addEventListener('keydown',e=>{const moves={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(!moves[e.key])return;e.preventDefault();e.stopPropagation();const [dx,dy]=moves[e.key],step=e.shiftKey?5:1;const next=furniture.contain({...desk,x:desk.x+dx*step,y:desk.y+dy*step},sizeOf(desk.kind),geometry());Object.assign(desk,{x:next.x,y:next.y});placeElement(el,desk);changed();});
        room.append(el);
      }
      updateEditor();const seated=new Set(desks.filter(d=>d.kind==='desk').map(d=>d.name).filter(Boolean));
      status.textContent=names.length?`${seated.size}/${names.length} seated · Drag desks to arrange`:'This class has no students yet. Add students in your class roster.';
    }
    function updateEditor(){
      const desk=selectedDesk();editor.hidden=!desk;
      assignment.replaceChildren(new Option('Empty seat',''));names.forEach(name=>assignment.add(new Option(name,name)));assignment.value=desk?.name||'';
      const student=desk?.kind==='desk';assignment.closest('label').hidden=!student;assignment.disabled=!student;
      m.querySelector('.seating-pin').hidden=!student;m.querySelector('.seating-pin').textContent=desk?.pinned?'Unlock Student':'Keep Student';
      m.querySelector('.seating-delete').textContent=student?'Remove Desk':'Remove Furniture';
    }
    function arrange(){const seats=desks.filter(d=>d.kind==='desk'),positions=layout(seats.length,layoutSelect.value);seats.forEach((d,i)=>Object.assign(d,positions[i],{angle:0}));render();changed();}
    function restoreLayout(value){
      const chart=normalizeSeatingChart(value,names);if(!chart)return false;
      layoutSelect.value=chart.layout;
      desks=chart.desks.map(d=>({...d,id:`seat-${++serial}`}));
      selected='';return true;
    }
    function defaultLayout(){
      cancelDrag?.();layoutSelect.value='rows';
      const positions=layout(names.length,'rows');desks=names.map((name,i)=>({id:`seat-${++serial}`,name,kind:'desk',angle:0,pinned:false,...positions[i]}));selected='';
    }
    function load(students,roster){
      cancelDrag?.();saveLayout();scope=window.TeacherTilesClassScope||'local';
      names=normalizeRosterNames(students).slice(0,80);className=String(roster.name||'').slice(0,80);classId=roster.id;classLogo=normalizeClassLogo(roster.logo);classReady=true;
      if(!restoreLayout(readClassRosters().find(r=>r.id===classId)?.seatingChart))defaultLayout();
      render();changed();
    }
    const detach=attachClassRosterLoader(m.querySelector('.seating-loader-anchor'),load);
    m.querySelector('.seating-change-class').addEventListener('click',()=>{cancelDrag?.();saveLayout();classId='';classReady=false;className='';names=[];desks=[];selected='';render();changed();});
    function syncClass(){
      if(!classId||scope!==(window.TeacherTilesClassScope||'local'))return;
      const roster=readClassRosters().find(r=>r.id===classId);
      if(!roster){classReady=false;render();return;}
      names=normalizeRosterNames(roster.students).slice(0,80);className=roster.name;classLogo=normalizeClassLogo(roster.logo);classReady=true;
      if(roster.seatingChart)restoreLayout(roster.seatingChart);
      else desks.forEach(d=>{if(d.name&&!names.includes(d.name)){d.name='';d.pinned=false;}});
      // Keep teacher-created desk locations and locked assignments when the
      // shared class roster changes. New students can be placed in empty desks.
      render();
    }
    const syncLayout=event=>{if(event.detail?.classId===classId&&event.detail.source!==m){cancelDrag?.();syncClass();}};
    window.addEventListener('teachertiles:classeschange',syncClass);
    window.addEventListener('teachertiles:seatingchange',syncLayout);
    m.querySelector('.seating-reset').addEventListener('click',()=>{defaultLayout();render();changed();});
    layoutSelect.addEventListener('change',changed);
    m.querySelector('.seating-randomize').addEventListener('click',()=>{
      const pinned=new Set(desks.filter(d=>d.pinned).map(d=>d.name));const available=shuffle(names.filter(n=>!pinned.has(n)));
      desks.filter(d=>!d.pinned&&d.kind==='desk').forEach(d=>{d.name=available.shift()||'';});render();changed();
    });
    assignment.addEventListener('change',()=>{const d=selectedDesk();if(!d||d.kind!=='desk')return;const other=desks.find(s=>s!==d&&s.name&&s.name===assignment.value);if(other)other.name=d.name;d.name=assignment.value;render();changed();});
    m.querySelector('.seating-rotate').addEventListener('click',()=>{const d=selectedDesk();if(d){d.angle=(d.angle+90)%360;Object.assign(d,furniture.contain(d,sizeOf(d.kind),geometry()));render();changed();}});
    m.querySelector('.seating-pin').addEventListener('click',()=>{const d=selectedDesk();if(d?.kind==='desk'){d.pinned=!d.pinned;render();changed();}});
    m.querySelector('.seating-delete').addEventListener('click',()=>{desks=desks.filter(d=>d.id!==selected);selected='';render();changed();});
    m.querySelector('.seating-clear').addEventListener('click',()=>{cancelDrag?.();desks=[];selected='';render();changed();});
    m._boardGetState=()=>({classId,names:[...names],desks:desks.map(d=>({...d})),className,layout:layoutSelect.value});
    m._boardSetState=s=>{
      cancelDrag?.();names=[...new Set((Array.isArray(s?.names)?s.names:[]).map(n=>String(n).slice(0,80)))].filter(Boolean).slice(0,80);
      layoutSelect.value=['rows','groups','horseshoe'].includes(s?.layout)?s.layout:'rows';
      desks=(normalizeSeatingChart(s,names)?.desks||[]).map(d=>({...d,id:`seat-${++serial}`}));
      className=String(s?.className||'').slice(0,80);classId=String(s?.classId||'').slice(0,160);classReady=!classId&&names.length>0;selected='';
      if(classId)syncClass();else render();
    };
    const prior=m._cleanup;m._cleanup=()=>{cancelDrag?.();furnitureUI.cleanup();document.removeEventListener('pointerdown',outside,true);m.removeEventListener('keydown',escape);detach();window.removeEventListener('teachertiles:classeschange',syncClass);window.removeEventListener('teachertiles:seatingchange',syncLayout);prior?.();};render();
  }
  window.TeacherTilesSeating=Object.freeze({setup,layout,shuffle});
})();
