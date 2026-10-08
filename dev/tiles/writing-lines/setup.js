function setupWritingLines(m){
  const paper=m.querySelector('.writinglines-paper');
  const rows=[...m.querySelectorAll('.writinglines-row')];
  const entries=[...m.querySelectorAll('.writinglines-entry')];
  const toggle=m.querySelector('.writinglines-toggle-type');
  const countBtn=m.querySelector('.writinglines-count');
  const countLabel=countBtn?.querySelector('span');
  const clear=m.querySelector('.writinglines-clear');
  const resizeHandles=[...m.querySelectorAll('[data-resize]')];
  let fitFrame=0;
  let preferredHeight=m.offsetHeight;
  let userSizingHeight=false;

  const visibleRows=()=>rows.filter(row=>!row.hidden);
  const visibleEntries=()=>entries.filter(entry=>!entry.closest('.writinglines-row')?.hidden);

  const fitAll=()=>{
    cancelAnimationFrame(fitFrame);
    fitFrame=requestAnimationFrame(()=>{
      const activeRows=visibleRows();
      const activeEntries=visibleEntries();
      if(!paper||!activeRows.length)return;

      const paperStyle=getComputedStyle(paper);
      const padY=(parseFloat(paperStyle.paddingTop)||0)+(parseFloat(paperStyle.paddingBottom)||0);
      const borderY=Math.max(0,paper.offsetHeight-paper.clientHeight);
      const moduleChrome=Math.max(0,m.offsetHeight-paper.offsetHeight);

      const targetModuleHeight=userSizingHeight?m.offsetHeight:preferredHeight;
      const targetPaperOuter=Math.max(10,targetModuleHeight-moduleChrome);
      const targetPaperInner=Math.max(10,targetPaperOuter-borderY-padY);
      const baseRowHeight=targetPaperInner/activeRows.length;

      paper.style.setProperty('--writing-row-height',`${baseRowHeight}px`);

      const innerWidth=Math.max(10,
        paper.clientWidth-
        (parseFloat(paperStyle.paddingLeft)||0)-
        (parseFloat(paperStyle.paddingRight)||0)
      );
      const availableTextWidth=Math.max(10,innerWidth-10);
      let sharedScale=1;

      activeEntries.forEach(entry=>{
        const naturalWidth=Math.max(entry.clientWidth,entry.scrollWidth);
        if(naturalWidth>availableTextWidth){
          sharedScale=Math.min(sharedScale,availableTextWidth/naturalWidth);
        }
      });

      sharedScale=Math.max(.22,Math.min(1,sharedScale));
      const finalRowHeight=baseRowHeight*sharedScale;
      paper.style.setProperty('--writing-row-height',`${finalRowHeight}px`);

      if(!userSizingHeight){
        const desiredPaperOuter=finalRowHeight*activeRows.length+padY+borderY;
        const desiredModuleHeight=moduleChrome+desiredPaperOuter;
        if(Math.abs(m.offsetHeight-desiredModuleHeight)>.75){
          m.style.height=`${desiredModuleHeight}px`;
        }
      }
    });
  };

  const setLineCount=count=>{
    const next=Math.max(1,Math.min(4,Number(count)||3));
    m.dataset.lineCount=String(next);
    rows.forEach((row,index)=>{
      row.hidden=index>=next;
    });
    if(countLabel)countLabel.textContent=String(next);
    countBtn?.setAttribute('aria-label',`${next} writing ${next===1?'line':'lines'}; click to change`);
    countBtn?.setAttribute('title',`${next} writing ${next===1?'line':'lines'} — click to change`);
    fitAll();
  };

  const setMode=(typing,{focus=false}={})=>{
    m.dataset.writingMode=typing?'type':'practice';
    toggle.classList.toggle('is-active',typing);
    toggle.setAttribute('aria-pressed',String(typing));
    entries.forEach(entry=>{
      entry.setAttribute('contenteditable',typing?'true':'false');
      entry.tabIndex=typing&&!entry.closest('.writinglines-row')?.hidden?0:-1;
    });
    fitAll();
    if(typing&&focus)requestAnimationFrame(()=>{if(m.isConnected)visibleEntries()[0]?.focus({preventScroll:true})});
  };

  toggle.addEventListener('click',()=>setMode(m.dataset.writingMode!=='type',{focus:true}));

  countBtn?.addEventListener('click',()=>{
    const current=Number(m.dataset.lineCount)||3;
    const next=current>=4?1:current+1;
    setLineCount(next);
    setMode(m.dataset.writingMode==='type');
  });

  clear.addEventListener('click',()=>{
    entries.forEach(entry=>entry.textContent='');
    fitAll();
    if(m.dataset.writingMode==='type')visibleEntries()[0]?.focus({preventScroll:true});
  });

  entries.forEach(entry=>{
    entry.addEventListener('input',fitAll);

    entry.addEventListener('keydown',e=>{
      const visible=visibleEntries();
      const index=visible.indexOf(entry);
      if(index<0)return;

      if(e.key==='Enter'){
        e.preventDefault();
        visible[Math.min(visible.length-1,index+1)]?.focus({preventScroll:true});
      }else if(e.key==='ArrowDown'&&index<visible.length-1){
        e.preventDefault();
        visible[index+1].focus({preventScroll:true});
      }else if(e.key==='ArrowUp'&&index>0){
        e.preventDefault();
        visible[index-1].focus({preventScroll:true});
      }
    });

    entry.addEventListener('paste',e=>{
      e.preventDefault();
      const text=(e.clipboardData||window.clipboardData)?.getData('text/plain')||'';
      document.execCommand('insertText',false,text.replace(/[\r\n]+/g,' '));
      requestAnimationFrame(fitAll);
    });
  });

  m.querySelector('.writinglines-bg').addEventListener('click',()=>{
    cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']);
  });

  m.querySelector('.writinglines-text').addEventListener('click',()=>{
    cycleData(m,'text',['dark','soft','blue','rose','white','cream']);
  });

  resizeHandles.forEach(handle=>{
    const direction=handle.dataset.resize||'';
    if(!/[tb]/.test(direction))return;

    const begin=()=>{
      userSizingHeight=true;
    };
    const finish=()=>{
      preferredHeight=m.offsetHeight;
      userSizingHeight=false;
      fitAll();
    };

    handle.addEventListener('pointerdown',begin,true);
    handle.addEventListener('pointerup',finish,true);
    handle.addEventListener('pointercancel',finish,true);
  });

  const resizeObserver=new ResizeObserver(fitAll);
  resizeObserver.observe(m);
  if(paper)resizeObserver.observe(paper);

  if(document.fonts?.ready){
    document.fonts.ready.then(fitAll);
  }

  setLineCount(Number(m.dataset.lineCount)||3);
  setMode(m.dataset.writingMode==='type');
  fitAll();

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    cancelAnimationFrame(fitFrame);
    resizeObserver.disconnect();
  };
}
