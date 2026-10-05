(() => {
 'use strict';
 const pitches=[60,62,64,65,67,69,71,72];
 const names=['C4','D4','E4','F4','G4','A4','B4','C5'];
 const colors=['#df5252','#e38935','#b89c1d','#42a26b','#3799d2','#7160bc','#b65ea5'];
 const rowUnits=140,firstBeat=166,beatStep=52,measureStart=140,measureEnd=972;
 const NS='http://www.w3.org/2000/svg';
 function setup(m) {
  const staff=m.querySelector('.score-grid'),tempo=m.querySelector('.score-tempo'),status=m.querySelector('.score-status'),play=m.querySelector('.score-play'),instrument=TeacherTilesInstrument();
  let choice={duration:1,rest:false},rows=1,labels=true,notes=[],timers=[],playing=false,cancelDrag=null,ignoreStaffClickUntil=0;
  staff.classList.remove('score-grid');staff.classList.add('music-staff');const palette=m.querySelector('.score-palette');palette.setAttribute('role','group');palette.setAttribute('aria-label','Notes and rests');
  const toolbar=m.querySelector('.score-toolbar'),slot=document.createElement('div');slot.className='score-toolbar-slot';staff.after(slot);slot.append(toolbar);toolbar.append(palette);
  const settings=document.createElement('div');settings.className='tile-settings-wrap';
  settings.innerHTML='<button type="button" class="custom-icon tile-settings-toggle" aria-label="Music Score Settings" aria-expanded="false">⚙</button><div class="tile-settings-panel" hidden><strong>Music Score Settings</strong><label class="tile-setting">Staff Rows<select class="score-rows"><option>1</option><option>2</option><option>3</option><option>4</option></select></label><div class="score-label-setting"><span>Show Note Letters</span><button type="button" class="score-labels" role="switch" aria-checked="true" aria-label="Show note letters"><i aria-hidden="true"></i></button></div></div>';
  m.querySelector('.customization-bar').append(settings);
  const changed=()=>notifyBoardChanged('music-score');
  const durationName=d=>d===4?'Whole':d===2?'Half':'Quarter';
  const duration=n=>[1,2,4].includes(n.duration)?n.duration:1;
  function glyphMarkup(n){
   const d=duration(n);let shape='';
   if(n.rest){shape=d===1?'<path d="M15 18C19 24 22 28 28 34L21 43Q26 50 29 55C17 49 11 52 18 68C4 59 5 45 18 47L10 38Q21 29 15 18Z"/>':`<path d="M6 46H34" fill="none" stroke="currentColor" stroke-width="2"/><path d="M11 ${d===4?46:38}H29V${d===4?54:46}H11Z"/>`;}
   else shape=`<ellipse cx="20" cy="52" rx="${d===4?13:10}" ry="7" transform="rotate(-18 20 52)" fill="${d===1?'currentColor':'var(--module-bg,#fff)'}" stroke="currentColor" stroke-width="${d===4?3.8:3.3}"/>${d===4?'':'<path d="M29 49V9" stroke="currentColor" stroke-width="2.7" fill="none"/>'}`;
   return `<svg viewBox="0 0 40 76" aria-hidden="true" fill="currentColor"><g class="score-symbol-outline" stroke-linejoin="round" stroke-linecap="round">${shape}</g><g stroke-linejoin="round" stroke-linecap="round">${shape}</g></svg>`;
  }
  function aligned(note,d){const measure=Math.floor(note.beat/4)*4;return {...note,beat:measure+Math.floor((note.beat-measure)/d)*d,duration:d};}
  function removeOverlaps(note){notes=notes.filter(other=>other===note||other.beat+duration(other)<=note.beat||other.beat>=note.beat+duration(note));}
  function place(at){if(!at)return;cancelDrag?.();stop();const note={...aligned(at,choice.duration),rest:choice.rest};removeOverlaps(note);notes.push(note);render();changed();if(!note.rest)instrument.note(note.pitch,.35).catch(()=>{});}
  let ghost=null,band=null;
  function clearPreview(){ghost?.remove();band?.remove();ghost=null;band=null;}
  function preview(at){clearPreview();if(!at)return;const note={...aligned(at,choice.duration),rest:choice.rest};band=document.createElement('span');band.className='score-drop-band';band.style.cssText=`left:${(firstBeat+(note.beat%16)*beatStep-beatStep/2)/10}%;top:${(Math.floor(note.beat/16)*rowUnits+20)/(rowUnits*rows)*100}%;width:${choice.duration*beatStep/10}%;height:${100/(rowUnits*rows)*100}%`;ghost=document.createElement('span');ghost.className='music-staff-note score-drop-note';ghost.innerHTML=glyphMarkup(note);position(ghost,note);staff.append(band,ghost);}
  function selectTool(button,d,rest){choice={duration:d,rest};palette.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));}
  for(const rest of [false,true])for(const d of [1,2,4]){
   const button=document.createElement('button');button.type='button';button.className='score-duration';button.dataset.duration=d;button.dataset.rest=String(rest);button.setAttribute('aria-label',`${durationName(d)} ${rest?'rest':'note'} (${d} ${d===1?'beat':'beats'})`);button.title=button.getAttribute('aria-label');button.setAttribute('aria-pressed',String(d===1&&!rest));button.innerHTML=glyphMarkup({duration:d,rest})+`<span>${d} ${d===1?'beat':'beats'}</span>`;
   button.addEventListener('click',()=>{if(performance.now()<ignoreStaffClickUntil)return;selectTool(button,d,rest)});
   button.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.stopPropagation();selectTool(button,d,rest);cancelDrag?.();button.setPointerCapture(e.pointerId);const start={x:e.clientX,y:e.clientY};let dragged=false;
    const move=ev=>{if(Math.hypot(ev.clientX-start.x,ev.clientY-start.y)>5)dragged=true;if(dragged)preview(coords(ev));};
    const clean=()=>{clearPreview();button.removeEventListener('pointermove',move);button.removeEventListener('pointerup',up);button.removeEventListener('pointercancel',cancel);if(button.hasPointerCapture(e.pointerId))button.releasePointerCapture(e.pointerId);cancelDrag=null;};
    const up=ev=>{const at=coords(ev);clean();if(dragged){ignoreStaffClickUntil=performance.now()+150;place(at)}};
    const cancel=()=>{clean();ignoreStaffClickUntil=performance.now()+150};cancelDrag=cancel;button.addEventListener('pointermove',move);button.addEventListener('pointerup',up);button.addEventListener('pointercancel',cancel);
   });palette.append(button);
  }

  const fit=()=>{
   const rowHeight=staff.clientHeight/rows,noteSize=Math.max(6,Math.min(88,rowHeight*.42,staff.clientWidth*.060));
   const clefHeight=Math.min(rowHeight*.88,staff.clientWidth*.075*720/422);
   staff.style.setProperty('--staff-note-size',noteSize+'px');staff.style.setProperty('--staff-clef-height',clefHeight+'px');staff.style.setProperty('--staff-clef-width',clefHeight*422/720+'px');
  };
  const observer=new ResizeObserver(fit);observer.observe(staff);
  function stop(){instrument.stop();timers.forEach(clearTimeout);timers=[];playing=false;play.textContent='Play';staff.querySelectorAll('.is-playing').forEach(n=>n.classList.remove('is-playing'));}
  function coords(e){
   const rect=staff.getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width*1000,y=(e.clientY-rect.top)/rect.height*rowUnits*rows;
   if(x<measureStart||x>measureEnd||y<0||y>=rowUnits*rows)return null;
   const row=Math.min(rows-1,Math.floor(y/rowUnits)),localY=y-row*rowUnits;
   if(localY<45||localY>125)return null;
   return {beat:row*16+Math.max(0,Math.min(15,Math.round((x-firstBeat)/beatStep))),pitch:pitches[Math.max(0,Math.min(7,Math.round((120-localY)/10)))]};
  }
  function position(button,note){
   button.style.left=(firstBeat+(note.beat%16)*beatStep)/10+'%';
   button.style.top=(Math.floor(note.beat/16)*rowUnits+(note.rest?60:120-pitches.indexOf(note.pitch)*10))/(rowUnits*rows)*100+'%';
  }
  function toggleRest(note,index){stop();note.rest=!note.rest;render();staff.querySelector(`[data-note="${index}"]`)?.focus({preventScroll:true});changed();if(!note.rest)instrument.note(note.pitch,.35).catch(()=>{});}
  function render(){
   clearPreview();staff.replaceChildren();
   const svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox',`0 0 1000 ${rowUnits*rows}`);svg.setAttribute('preserveAspectRatio','none');svg.classList.add('music-staff-lines');
   const line=d=>{const path=document.createElementNS(NS,'path');path.setAttribute('d',d);svg.append(path);};
   for(let row=0;row<rows;row++){
    for(const y of [20,40,60,80,100])line(`M0 ${y+row*rowUnits}H${measureEnd}`);
    for(let measure=0;measure<=4;measure++)line(`M${measureStart+measure*4*beatStep} ${20+row*rowUnits}V${100+row*rowUnits}`);
   }
   staff.append(svg);
   for(let row=0;row<rows;row++){const clef=document.createElement('span');clef.className='music-clef';clef.setAttribute('aria-hidden','true');clef.style.top=(row*rowUnits+60)/(rowUnits*rows)*100+'%';staff.append(clef);}
   notes.forEach((note,index)=>{
    if(note.beat>=rows*16)return;
    const button=document.createElement('button');button.type='button';button.className='music-staff-note'+(note.rest?' is-rest':'');button.dataset.note=index;position(button,note);
    const glyph=document.createElement('span');glyph.className='score-note-glyph';glyph.setAttribute('aria-hidden','true');
    glyph.innerHTML=glyphMarkup(note);
    if(!note.rest){const y=120-pitches.indexOf(note.pitch)*10,x=firstBeat+(note.beat%16)*beatStep,base=Math.floor(note.beat/16)*rowUnits;for(let ledger=100;y>=ledger+20;){ledger+=20;line(`M${x-16} ${base+ledger}h32`)}for(let ledger=20;y<=ledger-20;){ledger-=20;line(`M${x-16} ${base+ledger}h32`)}}
    const letter=document.createElement('span');letter.className='score-letter';letter.textContent=names[pitches.indexOf(note.pitch)].replace(/[0-9]/g,'');letter.hidden=!labels||!!note.rest;button.append(glyph,letter);
    button.style.color=note.rest?'var(--module-text,#17191d)':colors[pitches.indexOf(note.pitch)%7];
    button.setAttribute('aria-label',`${durationName(duration(note))} ${note.rest?'rest':names[pitches.indexOf(note.pitch)]}, beat ${note.beat+1}. Click to ${note.rest?'restore note':'make a rest'}. Drag or use arrow keys to change pitch; Delete removes.`);
    button.title=`${durationName(duration(note))} ${note.rest?'rest':names[pitches.indexOf(note.pitch)]} · Beat ${note.beat+1}`;
    button.addEventListener('click',e=>{e.stopPropagation();if(performance.now()>=ignoreStaffClickUntil)toggleRest(note,index);});
    button.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();stop();notes.splice(index,1);render();changed();});
    button.addEventListener('keydown',e=>{
     if(!['ArrowUp','ArrowDown','Delete','Backspace','Enter'].includes(e.key))return;
     e.preventDefault();e.stopPropagation();if(e.key==='Enter'){toggleRest(note,index);return;}
     stop();if(e.key==='Delete'||e.key==='Backspace')notes.splice(index,1);
     else {note.pitch=pitches[Math.max(0,Math.min(7,pitches.indexOf(note.pitch)+(e.key==='ArrowUp'?1:-1)))];note.rest=false;}
     render();staff.querySelector(`[data-note="${index}"]`)?.focus({preventScroll:true});changed();
    });
    button.addEventListener('pointerdown',e=>{
     if(e.button!==0)return;e.preventDefault();e.stopPropagation();cancelDrag?.();stop();
     const old={...note},startY=e.clientY,startX=e.clientX;let dragged=false,previewPitch=null;
     button.setPointerCapture(e.pointerId);
     const move=event=>{
      if(!dragged&&Math.hypot(event.clientX-startX,event.clientY-startY)<4)return;dragged=true;
      const at=coords(event);if(!at)return;Object.assign(note,aligned(at,duration(note)));
      button.classList.toggle('is-rest',!!note.rest);glyph.innerHTML=glyphMarkup(note);letter.hidden=!labels||note.rest;position(button,note);
      const pi=pitches.indexOf(note.pitch);letter.textContent=names[pi].replace(/[0-9]/g,'');button.style.color=note.rest?'var(--module-text,#17191d)':colors[pi%7];
      if(!note.rest&&previewPitch!==note.pitch){previewPitch=note.pitch;instrument.stop();instrument.note(note.pitch,.18).catch(()=>{});}
     };
     const clean=()=>{button.removeEventListener('pointermove',move);button.removeEventListener('pointerup',up);button.removeEventListener('pointercancel',cancel);if(button.hasPointerCapture(e.pointerId))button.releasePointerCapture(e.pointerId);cancelDrag=null;};
     const up=event=>{clean();if(dragged){ignoreStaffClickUntil=performance.now()+150;if(!coords(event))Object.assign(note,old);else removeOverlaps(note);render();changed();if(!note.rest)instrument.note(note.pitch,.35).catch(()=>{});}};
     const cancel=()=>{Object.assign(note,old);clean();ignoreStaffClickUntil=performance.now()+100;instrument.stop();render();};
     cancelDrag=cancel;button.addEventListener('pointermove',move);button.addEventListener('pointerup',up);button.addEventListener('pointercancel',cancel);
    });
    staff.append(button);
   });
   status.textContent='Choose a symbol, then click or drag onto the staff · Click a note to toggle its rest · Right-click to remove';fit();
  }
  settings.querySelector('.score-rows').addEventListener('change',e=>{cancelDrag?.();stop();rows=Number(e.target.value);render();changed();});
  settings.querySelector('.score-labels').addEventListener('click',e=>{labels=!labels;e.currentTarget.setAttribute('aria-checked',String(labels));render();changed();});
  staff.addEventListener('pointerdown',e=>{if(e.button===0)e.stopPropagation()});
  staff.addEventListener('click',e=>{
   if(e.target.closest('button')||performance.now()<ignoreStaffClickUntil)return;
   place(coords(e));
  });
  play.addEventListener('click',()=>{
   if(playing){stop();return;}stop();const visible=notes.filter(n=>n.beat<rows*16);
   if(!visible.length){status.textContent='Click the staff to add your first note.';return;}
   playing=true;play.textContent='Stop';const seconds=60/(Number(tempo.value)||100);
   notes.forEach((note,index)=>{
    if(note.beat>=rows*16)return;
    if(!note.rest)instrument.note(note.pitch,seconds*duration(note)*.9,note.beat*seconds).catch(()=>{status.textContent='Audio unavailable. Try Play again.';});
    timers.push(setTimeout(()=>{staff.querySelectorAll('.is-playing').forEach(b=>b.classList.remove('is-playing'));staff.querySelector(`[data-note="${index}"]`)?.classList.add('is-playing');},note.beat*seconds*1000));
   });
   timers.push(setTimeout(stop,(Math.max(...visible.map(n=>n.beat+duration(n))))*seconds*1000));
  });
  m.querySelector('.score-stop').addEventListener('click',stop);
  m.querySelector('.score-clear').addEventListener('click',()=>{cancelDrag?.();stop();notes=[];render();changed();});
  tempo.addEventListener('change',()=>{tempo.value=Math.max(40,Math.min(200,Number(tempo.value)||100));stop();changed();});
  m._boardGetState=()=>({notes:notes.map(n=>({...n})),tempo:Number(tempo.value),rows,labels});
  m._boardSetState=s=>{
   cancelDrag?.();stop();rows=Math.max(1,Math.min(4,Math.floor(Number(s?.rows)||1)));labels=s?.labels===undefined?true:Boolean(s.labels);
   settings.querySelector('.score-rows').value=rows;settings.querySelector('.score-labels').setAttribute('aria-checked',String(labels));
   notes=(Array.isArray(s?.notes)?s.notes:[]).map((n,i)=>typeof n==='number'?{beat:i,pitch:n}:n).map(n=>n&&({...n,pitch:n.pitch>72&&n.pitch<=84?n.pitch-12:n.pitch})).filter(n=>n&&pitches.includes(n.pitch)&&Number.isInteger(n.beat)&&n.beat>=0&&n.beat<64).map(n=>({...aligned({beat:n.beat,pitch:n.pitch},duration(n)),rest:n.rest===true}));
   const loaded=notes;notes=[];for(const note of loaded){removeOverlaps(note);notes.push(note)}
   tempo.value=Math.max(40,Math.min(200,Number(s?.tempo)||100));render();
  };
  const deactivate=m._deactivate,cleanup=m._cleanup;m._deactivate=()=>{cancelDrag?.();clearPreview();stop();deactivate?.();};m._cleanup=()=>{cancelDrag?.();clearPreview();stop();observer.disconnect();instrument.close();cleanup?.();};render();
 }
 window.TeacherTilesMusicscore={setup};
})();
