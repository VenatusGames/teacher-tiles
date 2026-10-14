function setupTenFrames(m){
  const board=m.querySelector('.tenframes-board');
  const countEl=m.querySelector('.tenframes-count');
  const frameCountEl=m.querySelector('.tenframes-frame-count');
  const addFrameButton=m.querySelector('.tenframes-add-frame');
  const removeFrameButton=m.querySelector('.tenframes-remove-frame');
  const addButtons=[...m.querySelectorAll('[data-tenframes-add]')];
  const clearButton=m.querySelector('.tenframes-clear');

  let frameCount=1;
  let placements=Array(10).fill(false);
  let draggedIndex=-1;

  const capacity=()=>frameCount*10;
  const countCounters=()=>placements.slice(0,capacity()).filter(Boolean).length;

  const ensureCapacityFor=amount=>{
    const current=countCounters();
    const needed=current+amount;
    const framesNeeded=Math.min(10,Math.max(frameCount,Math.ceil(needed/10)));
    if(framesNeeded>frameCount){
      frameCount=framesNeeded;
      while(placements.length<capacity())placements.push(false);
    }
  };

  const addCounters=amount=>{
    ensureCapacityFor(amount);
    let remaining=amount;

    for(let i=0;i<capacity()&&remaining>0;i++){
      if(!placements[i]){
        placements[i]=true;
        remaining--;
      }
    }

    render();
  };

  const moveCounter=(from,to)=>{
    if(from===to||from<0||to<0||from>=capacity()||to>=capacity())return;
    if(!placements[from])return;

    if(placements[to]){
      placements[from]=false;
    }else{
      placements[from]=false;
      placements[to]=true;
    }

    render();
  };

  const render=()=>{
    while(placements.length<capacity())placements.push(false);
    if(placements.length>capacity())placements=placements.slice(0,capacity());

    board.replaceChildren();

    for(let frameIndex=0;frameIndex<frameCount;frameIndex++){
      const frame=document.createElement('section');
      frame.className='tenframe';
      frame.setAttribute('aria-label',`Ten frame ${frameIndex+1}`);

      for(let cell=0;cell<10;cell++){
        const absolute=frameIndex*10+cell;
        const slot=document.createElement('button');
        slot.type='button';
        slot.className='tenframe-slot';
        slot.dataset.slot=String(absolute);
        slot.setAttribute('aria-label',placements[absolute]?`Counter in box ${absolute+1}. Click to remove.`:`Empty box ${absolute+1}. Click to add counter.`);

        if(placements[absolute]){
          const counter=document.createElement('span');
          counter.className='tenframe-counter';
          counter.draggable=true;
          counter.dataset.counter=String(absolute);

          counter.addEventListener('dragstart',event=>{
            draggedIndex=absolute;
            counter.classList.add('is-dragging');
            event.dataTransfer?.setData('text/plain',String(absolute));
            if(event.dataTransfer)event.dataTransfer.effectAllowed='move';
          });

          counter.addEventListener('dragend',()=>{
            draggedIndex=-1;
            counter.classList.remove('is-dragging');
            board.querySelectorAll('.is-drop-target').forEach(node=>node.classList.remove('is-drop-target'));
          });

          slot.appendChild(counter);
        }

        slot.addEventListener('click',event=>{
          if(event.target.closest('.tenframe-counter'))return;
          placements[absolute]=!placements[absolute];
          render();
        });

        slot.addEventListener('dragover',event=>{
          event.preventDefault();
          slot.classList.add('is-drop-target');
          if(event.dataTransfer)event.dataTransfer.dropEffect='move';
        });

        slot.addEventListener('dragleave',()=>{
          slot.classList.remove('is-drop-target');
        });

        slot.addEventListener('drop',event=>{
          event.preventDefault();
          slot.classList.remove('is-drop-target');
          const from=draggedIndex>=0?draggedIndex:Number(event.dataTransfer?.getData('text/plain'));
          if(Number.isInteger(from))moveCounter(from,absolute);
        });

        frame.appendChild(slot);
      }

      board.appendChild(frame);
    }

    const total=countCounters();
    countEl.textContent=String(total);
    frameCountEl.textContent=`${frameCount} ${frameCount===1?'frame':'frames'}`;
    removeFrameButton.disabled=frameCount<=1;
    addFrameButton.disabled=frameCount>=10;
    addButtons.forEach(button=>{
      button.disabled=total>=100;
    });
  };

  addFrameButton.addEventListener('click',()=>{
    if(frameCount>=10)return;
    frameCount++;
    while(placements.length<capacity())placements.push(false);
    render();
  });

  removeFrameButton.addEventListener('click',()=>{
    if(frameCount<=1)return;

    const removedStart=(frameCount-1)*10;
    const hasCounters=placements.slice(removedStart,removedStart+10).some(Boolean);

    if(hasCounters){
      const freeSlots=placements.slice(0,removedStart).reduce((sum,filled)=>sum+(filled?0:1),0);
      const removedCount=placements.slice(removedStart,removedStart+10).filter(Boolean).length;

      if(freeSlots<removedCount)return;

      let toMove=removedCount;
      for(let i=0;i<removedStart&&toMove>0;i++){
        if(!placements[i]){
          placements[i]=true;
          toMove--;
        }
      }
    }

    frameCount--;
    placements=placements.slice(0,capacity());
    render();
  });

  addButtons.forEach(button=>{
    button.addEventListener('click',()=>{
      addCounters(Number(button.dataset.tenframesAdd));
    });
  });

  clearButton.addEventListener('click',()=>{
    placements=Array(capacity()).fill(false);
    render();
  });

  m.querySelector('.tenframes-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.tenframes-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.tenframes-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));

  m._boardGetState=()=>({frameCount,placements:[...placements]});
  m._boardSetState=state=>{
    frameCount=Math.max(1,Math.min(10,Math.round(Number(state?.frameCount)||1)));
    placements=Array.isArray(state?.placements)?state.placements.slice(0,frameCount*10).map(Boolean):Array(frameCount*10).fill(false);
    while(placements.length<frameCount*10)placements.push(false);
    render();
  };

  render();
}
