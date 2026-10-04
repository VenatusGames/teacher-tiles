(() => {
 'use strict';
 const pitches=[60,62,64,65,67,69,71,72,74,76,77,79,81,83,84];
 const names=['C4','D4','E4','F4','G4','A4','B4','C5','D5','E5','F5','G5','A5','B5','C6'];
 const colors=['#df5252','#e38935','#b89c1d','#42a26b','#3799d2','#7160bc','#b65ea5'];
 const rowUnits=220,firstBeat=166,beatStep=52,measureStart=140,measureEnd=972;
 const NS='http://www.w3.org/2000/svg';
 function setup(m) {
  const staff=m.querySelector('.score-grid'),tempo=m.querySelector('.score-tempo'),status=m.querySelector('.score-status'),play=m.querySelector('.score-play'),instrument=TeacherTilesInstrument();
  let rows=1,labels=true,notes=[],timers=[],playing=false,cancelDrag=null,ignoreStaffClickUntil=0;
  staff.classList.remove('score-grid');staff.classList.add('music-staff');m.querySelector('.score-palette').remove();
  const toolbar=m.querySelector('.score-toolbar'),slot=document.createElement('div');slot.className='score-toolbar-slot';toolbar.before(slot);slot.append(toolbar);
  const settings=document.createElement('div');settings.className='tile-settings-wrap';
  settings.innerHTML='<button type="button" class="custom-icon tile-settings-toggle" aria-label="Music Score Settings" aria-expanded="false">⚙</button><div class="tile-settings-panel" hidden><strong>Music Score Settings</strong><label class="tile-setting">Staff Rows<select class="score-rows"><option>1</option><option>2</option><option>3</option><option>4</option></select></label><div class="score-label-setting"><span>Show Note Letters</span><button type="button" class="score-labels" role="switch" aria-checked="true" aria-label="Show note letters"><i aria-hidden="true"></i></button></div></div>';
  m.querySelector('.customization-bar').append(settings);
  const changed=()=>notifyBoardChanged('music-score');
  const fit=()=>{
   const rowHeight=staff.clientHeight/rows,noteSize=Math.max(6,Math.min(88,rowHeight*.20,staff.clientWidth*.054));
   const clefHeight=Math.min(rowHeight*.6,staff.clientWidth*.075*720/422);
   staff.style.setProperty('--staff-note-size',noteSize+'px');staff.style.setProperty('--staff-clef-height',clefHeight+'px');staff.style.setProperty('--staff-clef-width',clefHeight*422/720+'px');
  };
  const observer=new ResizeObserver(fit);observer.observe(staff);
  function stop(){instrument.stop();timers.forEach(clearTimeout);timers=[];playing=false;play.textContent='Play';staff.querySelectorAll('.is-playing').forEach(n=>n.classList.remove('is-playing'));}
  function coords(e){
   const rect=staff.getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width*1000,y=(e.clientY-rect.top)/rect.height*rowUnits*rows;
   if(x<measureStart||x>measureEnd||y<0||y>rowUnits*rows)return null;
   const row=Math.min(rows-1,Math.floor(y/rowUnits));
   return {beat:row*16+Math.max(0,Math.min(15,Math.round((x-firstBeat)/beatStep))),pitch:pitches[Math.max(0,Math.min(14,Math.round((190-(y-row*rowUnits))/11)))]};
  }
  function position(button,note){
   button.style.left=(firstBeat+(note.beat%16)*beatStep)/10+'%';
   button.style.top=(Math.floor(note.beat/16)*rowUnits+(note.rest?124:190-pitches.indexOf(note.pitch)*11))/(2.2*rows)+'%';
  }
  function toggleRest(note,index){stop();note.rest=!note.rest;render();staff.querySelector(`[data-note="${index}"]`)?.focus({preventScroll:true});changed();if(!note.rest)instrument.note(note.pitch,.35).catch(()=>{});}
  function render(){
   staff.replaceChildren();
   const svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox',`0 0 1000 ${rowUnits*rows}`);svg.setAttribute('preserveAspectRatio','none');svg.classList.add('music-staff-lines');
   const line=d=>{const path=document.createElementNS(NS,'path');path.setAttribute('d',d);svg.append(path);};
   for(let row=0;row<rows;row++){
    for(const y of [80,102,124,146,168])line(`M0 ${y+row*rowUnits}H${measureEnd}`);
    for(let measure=0;measure<=4;measure++)line(`M${measureStart+measure*4*beatStep} ${80+row*rowUnits}V${168+row*rowUnits}`);
   }
   staff.append(svg);
   for(let row=0;row<rows;row++){const clef=document.createElement('span');clef.className='music-clef';clef.setAttribute('aria-hidden','true');clef.style.top=(row*rowUnits+124)/(2.2*rows)+'%';staff.append(clef);}
   notes.forEach((note,index)=>{
    if(note.beat>=rows*16)return;
    const button=document.createElement('button');button.type='button';button.className='music-staff-note'+(note.rest?' is-rest':'');button.dataset.note=index;position(button,note);
    const glyph=document.createElement('span');glyph.className='score-note-glyph';glyph.setAttribute('aria-hidden','true');
    if(note.rest){glyph.innerHTML='<svg viewBox="0 0 30 60" class="score-rest-glyph" fill="currentColor"><path d="M10 2 23 20 16 27 25 40C12 34 8 37 14 54C-1 43 3 31 14 33L6 24 14 16Z"/></svg>';}
    else glyph.textContent='♪';
    const letter=document.createElement('span');letter.className='score-letter';letter.textContent=names[pitches.indexOf(note.pitch)].replace(/[0-9]/g,'');letter.hidden=!labels||!!note.rest;button.append(glyph,letter);
    button.style.color=note.rest?'var(--module-text,#17191d)':colors[pitches.indexOf(note.pitch)%7];
    button.setAttribute('aria-label',`${note.rest?'Rest':names[pitches.indexOf(note.pitch)]}, beat ${note.beat+1}. Click to ${note.rest?'restore note':'make a rest'}. Drag or use arrow keys to change pitch; Delete removes.`);
    button.title=`${note.rest?'Rest':names[pitches.indexOf(note.pitch)]} · Beat ${note.beat+1}`;
    button.addEventListener('click',e=>{e.stopPropagation();toggleRest(note,index);});
    button.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();stop();notes.splice(index,1);render();changed();});
    button.addEventListener('keydown',e=>{
     if(!['ArrowUp','ArrowDown','Delete','Backspace','Enter'].includes(e.key))return;
     e.preventDefault();e.stopPropagation();if(e.key==='Enter'){toggleRest(note,index);return;}
     stop();if(e.key==='Delete'||e.key==='Backspace')notes.splice(index,1);
     else {note.pitch=pitches[Math.max(0,Math.min(14,pitches.indexOf(note.pitch)+(e.key==='ArrowUp'?1:-1)))];note.rest=false;}
     render();staff.querySelector(`[data-note="${index}"]`)?.focus({preventScroll:true});changed();
    });
    button.addEventListener('pointerdown',e=>{
     if(e.button!==0)return;e.preventDefault();e.stopPropagation();cancelDrag?.();stop();
     const old={pitch:note.pitch,rest:note.rest},startY=e.clientY;let dragged=false,previewPitch=null;
     button.setPointerCapture(e.pointerId);
     const move=event=>{
      if(!dragged&&Math.abs(event.clientY-startY)<4)return;dragged=true;
      const rect=staff.getBoundingClientRect(),y=(event.clientY-rect.top)/rect.height*rowUnits*rows-Math.floor(note.beat/16)*rowUnits;
      note.pitch=pitches[Math.max(0,Math.min(14,Math.round((190-y)/11)))];note.rest=false;
      button.classList.remove('is-rest');glyph.textContent='♪';letter.hidden=!labels;position(button,note);
      const pi=pitches.indexOf(note.pitch);letter.textContent=names[pi].replace(/[0-9]/g,'');button.style.color=colors[pi%7];
      if(previewPitch!==note.pitch){previewPitch=note.pitch;instrument.stop();instrument.note(note.pitch,.18).catch(()=>{});}
     };
     const clean=()=>{button.removeEventListener('pointermove',move);button.removeEventListener('pointerup',up);button.removeEventListener('pointercancel',cancel);if(button.hasPointerCapture(e.pointerId))button.releasePointerCapture(e.pointerId);cancelDrag=null;};
     const up=()=>{clean();if(dragged){ignoreStaffClickUntil=performance.now()+100;render();changed();instrument.note(note.pitch,.35).catch(()=>{});}};
     const cancel=()=>{Object.assign(note,old);clean();ignoreStaffClickUntil=performance.now()+100;instrument.stop();render();};
     cancelDrag=cancel;button.addEventListener('pointermove',move);button.addEventListener('pointerup',up);button.addEventListener('pointercancel',cancel);
    });
    staff.append(button);
   });
   status.textContent='Click to add · Click a note for a rest · Drag to change pitch · Right-click to remove';fit();
  }
  settings.querySelector('.score-rows').addEventListener('change',e=>{cancelDrag?.();stop();rows=Number(e.target.value);render();changed();});
  settings.querySelector('.score-labels').addEventListener('click',e=>{labels=!labels;e.currentTarget.setAttribute('aria-checked',String(labels));render();changed();});
  staff.addEventListener('click',e=>{
   if(e.target.closest('button')||performance.now()<ignoreStaffClickUntil)return;
   const note=coords(e);if(!note)return;stop();const existing=notes.find(n=>n.beat===note.beat);
   if(existing)Object.assign(existing,note,{rest:false});else notes.push(note);
   render();changed();instrument.note(note.pitch,.35).catch(()=>{});
  });
  play.addEventListener('click',()=>{
   if(playing){stop();return;}stop();const visible=notes.filter(n=>n.beat<rows*16);
   if(!visible.length){status.textContent='Click the staff to add your first note.';return;}
   playing=true;play.textContent='Stop';const seconds=60/(Number(tempo.value)||100);
   notes.forEach((note,index)=>{
    if(note.beat>=rows*16)return;
    if(!note.rest)instrument.note(note.pitch,seconds*.9,note.beat*seconds).catch(()=>{status.textContent='Audio unavailable. Try Play again.';});
    timers.push(setTimeout(()=>{staff.querySelectorAll('.is-playing').forEach(b=>b.classList.remove('is-playing'));staff.querySelector(`[data-note="${index}"]`)?.classList.add('is-playing');},note.beat*seconds*1000));
   });
   timers.push(setTimeout(stop,(Math.max(...visible.map(n=>n.beat))+1)*seconds*1000));
  });
  m.querySelector('.score-stop').addEventListener('click',stop);
  m.querySelector('.score-clear').addEventListener('click',()=>{cancelDrag?.();stop();notes=[];render();changed();});
  tempo.addEventListener('change',()=>{tempo.value=Math.max(40,Math.min(200,Number(tempo.value)||100));stop();changed();});
  m._boardGetState=()=>({notes:notes.map(n=>({...n})),tempo:Number(tempo.value),rows,labels});
  m._boardSetState=s=>{
   cancelDrag?.();stop();rows=Math.max(1,Math.min(4,Math.floor(Number(s?.rows)||1)));labels=s?.labels===undefined?true:Boolean(s.labels);
   settings.querySelector('.score-rows').value=rows;settings.querySelector('.score-labels').setAttribute('aria-checked',String(labels));
   notes=(Array.isArray(s?.notes)?s.notes:[]).map((n,i)=>typeof n==='number'?{beat:i,pitch:n}:n).filter(n=>n&&pitches.includes(n.pitch)&&Number.isInteger(n.beat)&&n.beat>=0&&n.beat<64).map(n=>({beat:n.beat,pitch:n.pitch,...(n.rest===true?{rest:true}:{})}));
   tempo.value=Math.max(40,Math.min(200,Number(s?.tempo)||100));render();
  };
  m._deactivate=()=>{cancelDrag?.();stop();};m._cleanup=()=>{cancelDrag?.();stop();observer.disconnect();instrument.close();};render();
 }
 window.TeacherTilesMusicscore={setup};
})();
