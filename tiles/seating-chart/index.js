(() => {
  'use strict';
  const limit=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
  function layout(count,kind){
    return Array.from({length:count},(_,i)=>{
      if(kind==='groups'){const group=Math.floor(i/4),cols=Math.max(1,Math.ceil(Math.sqrt(Math.ceil(count/4)*1.4))),rows=Math.ceil(Math.ceil(count/4)/cols);return {x:6+(group%cols)*84/cols+(i%2)*38/cols,y:16+Math.floor(group/cols)*72/rows+Math.floor(i%4/2)*Math.min(11,26/rows)};}
      if(kind==='horseshoe'){const side=Math.ceil(count/3);if(i<side)return{x:5,y:17+i*68/side};if(i<side*2)return{x:86,y:17+(i-side)*68/side};return{x:18+(i-side*2)*62/Math.max(1,count-side*2),y:82};}
      const cols=Math.max(1,Math.ceil(Math.sqrt(count*1.5))),rows=Math.ceil(count/cols);return{x:5+(i%cols)*84/cols,y:17+Math.floor(i/cols)*68/rows};
    });
  }
  function shuffle(items){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  function setup(m){
    const room=m.querySelector('.seating-room'),status=m.querySelector('.seating-status'),assignment=m.querySelector('.seating-assignment'),layoutSelect=m.querySelector('.seating-layout');
    const editor=m.querySelector('.seating-editor'),importPanel=m.querySelector('.seating-class-import'),dashboard=m.querySelector('.seating-dashboard');
    let names=[],desks=[],selected='',className='',classId='',classLogo='👥',classReady=false,serial=0,cancelDrag=null;
    const changed=()=>notifyBoardChanged('seating-chart');
    const selectedDesk=()=>desks.find(d=>d.id===selected);
    function dimensions(count,kind){
      count=Math.max(1,count);const cols=Math.ceil(Math.sqrt(count*1.5));
      const width=layoutSelect.value==='groups'?Math.min(9,34/Math.ceil(Math.sqrt(Math.ceil(count/4)*1.4))):Math.min(9,78/cols);
      const height=layoutSelect.value==='horseshoe'?Math.min(9,60/Math.ceil(count/3)):Math.min(9,60/Math.ceil(count/cols));
      return kind==='teacher'?[17,9]:kind==='table'?[16,12]:[width,height];
    }
    function render(){
      importPanel.hidden=classReady;dashboard.hidden=!classReady;
      m.querySelector('.seating-class-name').textContent=className||'Class';
      m.querySelector('.seating-class-logo').textContent=classLogo;
      room.replaceChildren();const front=document.createElement('div');front.className='seating-front';front.textContent='FRONT OF CLASSROOM';room.append(front);
      const sizes={desk:dimensions(desks.length,'desk'),table:dimensions(desks.length,'table'),teacher:dimensions(desks.length,'teacher')};
      for(const desk of desks){
        const el=document.createElement('button');el.type='button';el.className=`seating-desk seating-${desk.kind}`;el.dataset.id=desk.id;
        el.style.left=`${desk.x}%`;el.style.top=`${desk.y}%`;el.style.width=`${sizes[desk.kind][0]}%`;el.style.height=`${sizes[desk.kind][1]}%`;el.style.transform=`rotate(${desk.angle}deg)`;
        el.classList.toggle('is-selected',selected===desk.id);el.classList.toggle('is-pinned',desk.pinned);
        const label=document.createElement('span');label.textContent=desk.name||(desk.kind==='teacher'?'Teacher':desk.kind==='table'?'Table':'Empty');label.style.transform=`rotate(${-desk.angle}deg)`;el.append(label);
        el.setAttribute('aria-label',`${desk.name||desk.kind}${desk.pinned?', assignment locked':''}. Drag to move or use arrow keys`);
        el.addEventListener('click',()=>{selected=desk.id;render();room.querySelector(`[data-id="${desk.id}"]`)?.focus();});
        el.addEventListener('pointerdown',event=>{
          if(event.button!==0)return;event.stopPropagation();event.preventDefault();cancelDrag?.();selected=desk.id;
          room.querySelectorAll('.seating-desk').forEach(e=>e.classList.toggle('is-selected',e===el));updateEditor();
          const rect=room.getBoundingClientRect(),startX=event.clientX,startY=event.clientY,x=desk.x,y=desk.y;
          const controller=new AbortController();el.setPointerCapture(event.pointerId);
          cancelDrag=()=>{controller.abort();cancelDrag=null;};
          el.addEventListener('pointermove',e=>{desk.x=limit(x+(e.clientX-startX)/rect.width*100,0,100-sizes[desk.kind][0]);desk.y=limit(y+(e.clientY-startY)/rect.height*100,10,100-sizes[desk.kind][1]);el.style.left=`${desk.x}%`;el.style.top=`${desk.y}%`;},{signal:controller.signal});
          const done=()=>{cancelDrag?.();changed();};el.addEventListener('pointerup',done,{signal:controller.signal});el.addEventListener('pointercancel',done,{signal:controller.signal});
        });
        el.addEventListener('keydown',e=>{const moves={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(!moves[e.key])return;e.preventDefault();e.stopPropagation();const [dx,dy]=moves[e.key],step=e.shiftKey?5:1;desk.x=limit(desk.x+dx*step,0,100-sizes[desk.kind][0]);desk.y=limit(desk.y+dy*step,10,100-sizes[desk.kind][1]);el.style.left=`${desk.x}%`;el.style.top=`${desk.y}%`;changed();});
        room.append(el);
      }
      updateEditor();const seated=new Set(desks.map(d=>d.name).filter(Boolean));
      status.textContent=names.length?`${seated.size}/${names.length} seated · Drag desks to arrange`:'This class has no students yet. Add students in your class roster.';
    }
    function updateEditor(){
      const desk=selectedDesk();editor.hidden=!desk;
      assignment.replaceChildren(new Option('Empty seat',''));names.forEach(name=>assignment.add(new Option(name,name)));assignment.value=desk?.name||'';
      assignment.disabled=!desk||desk.kind==='teacher';m.querySelector('.seating-pin').textContent=desk?.pinned?'Unlock student':'Keep student';
    }
    function arrange(){const positions=layout(desks.length,layoutSelect.value);desks.forEach((d,i)=>Object.assign(d,positions[i],{angle:0}));render();changed();}
    function load(students,roster){
      names=normalizeRosterNames(students).slice(0,80);className=String(roster.name||'').slice(0,80);classId=roster.id;classLogo=normalizeClassLogo(roster.logo);classReady=true;
      const positions=layout(names.length,layoutSelect.value);desks=names.map((name,i)=>({id:`seat-${++serial}`,name,kind:'desk',angle:0,pinned:false,...positions[i]}));selected='';render();changed();
    }
    const detach=attachClassRosterLoader(m.querySelector('.seating-loader-anchor'),load);
    m.querySelector('.seating-change-class').addEventListener('click',()=>{cancelDrag?.();classId='';classReady=false;className='';names=[];desks=[];selected='';render();changed();});
    function syncClass(){
      if(!classId)return;
      const roster=readClassRosters().find(r=>r.id===classId);
      if(!roster){classReady=false;render();return;}
      names=normalizeRosterNames(roster.students).slice(0,80);className=roster.name;classLogo=normalizeClassLogo(roster.logo);classReady=true;
      desks.forEach(d=>{if(d.name&&!names.includes(d.name)){d.name='';d.pinned=false;}});
      // Keep teacher-created desk locations and locked assignments when the
      // shared class roster changes. New students can be placed in empty desks.
      render();
    }
    window.addEventListener('teachertiles:classeschange',syncClass);
    m.querySelector('.seating-arrange').addEventListener('click',arrange);
    m.querySelector('.seating-randomize').addEventListener('click',()=>{
      const pinned=new Set(desks.filter(d=>d.pinned).map(d=>d.name));const available=shuffle(names.filter(n=>!pinned.has(n)));
      desks.filter(d=>!d.pinned&&d.kind!=='teacher').forEach(d=>{d.name=available.shift()||'';});render();changed();
    });
    m.querySelector('.seating-add').addEventListener('click',()=>{if(desks.length>=80)return;const kind=m.querySelector('.seating-kind').value;const d={id:`seat-${++serial}`,kind,name:'',x:40,y:40,angle:0,pinned:false};desks.push(d);selected=d.id;render();changed();});
    assignment.addEventListener('change',()=>{const d=selectedDesk();if(!d)return;const other=desks.find(s=>s!==d&&s.name&&s.name===assignment.value);if(other)other.name=d.name;d.name=assignment.value;render();changed();});
    m.querySelector('.seating-rotate').addEventListener('click',()=>{const d=selectedDesk();if(d){d.angle=(d.angle+90)%360;render();changed();}});
    m.querySelector('.seating-pin').addEventListener('click',()=>{const d=selectedDesk();if(d){d.pinned=!d.pinned;render();changed();}});
    m.querySelector('.seating-delete').addEventListener('click',()=>{desks=desks.filter(d=>d.id!==selected);selected='';render();changed();});
    m._boardGetState=()=>({classId,names:[...names],desks:desks.map(d=>({...d})),className,layout:layoutSelect.value});
    m._boardSetState=s=>{
      cancelDrag?.();names=[...new Set((Array.isArray(s?.names)?s.names:[]).map(n=>String(n).slice(0,80)))].filter(Boolean).slice(0,80);const used=new Set();
      layoutSelect.value=['rows','groups','horseshoe'].includes(s?.layout)?s.layout:'rows';
      const saved=(Array.isArray(s?.desks)?s.desks:[]).filter(d=>d&&typeof d==='object').slice(0,80);
      desks=saved.map(d=>{const name=names.includes(d.name)&&!used.has(d.name)?d.name:'';if(name)used.add(name);const kind=['desk','table','teacher'].includes(d.kind)?d.kind:'desk',[w,h]=dimensions(saved.length,kind);return{id:`seat-${++serial}`,name,kind,x:limit(d.x,0,100-w),y:limit(d.y,10,100-h),angle:[0,90,180,270].includes(d.angle)?d.angle:0,pinned:!!d.pinned};});
      className=String(s?.className||'').slice(0,80);classId=String(s?.classId||'').slice(0,160);classReady=!classId&&names.length>0;selected='';
      if(classId)syncClass();else render();
    };
    const prior=m._cleanup;m._cleanup=()=>{cancelDrag?.();detach();window.removeEventListener('teachertiles:classeschange',syncClass);prior?.();};render();
  }
  window.TeacherTilesSeating=Object.freeze({setup,layout,shuffle});
})();
