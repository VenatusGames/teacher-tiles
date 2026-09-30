function setupMinesweeper(m){
  const board=m.querySelector('.minesweeper-board');
  const minesLeft=m.querySelector('.minesweeper-mines-left');
  const time=m.querySelector('.minesweeper-time');
  const status=m.querySelector('.minesweeper-status');
  const modeButton=m.querySelector('.minesweeper-mode');
  const modeLabel=modeButton.querySelector('span');
  const resetButton=m.querySelector('.minesweeper-reset');
  const resetFace=resetButton.querySelector('span');
  const levelButtons=[...m.querySelectorAll('[data-minesweeper-level]')];
  const levels={
    easy:{rows:9,cols:9,mines:10},
    medium:{rows:12,cols:12,mines:24},
    hard:{rows:16,cols:16,mines:40}
  };

  let level='easy';
  let rows=levels.easy.rows;
  let cols=levels.easy.cols;
  let mineTotal=levels.easy.mines;
  let cells=[];
  let cellButtons=[];
  let generated=false;
  let started=false;
  let finished=false;
  let won=false;
  let exploded=-1;
  let elapsed=0;
  let timerStart=0;
  let timerId=0;
  let mode='reveal';

  const validIndex=value=>Number.isInteger(Number(value))&&Number(value)>=0&&Number(value)<rows*cols;
  const neighborIndexes=index=>{
    const row=Math.floor(index/cols),col=index%cols,result=[];
    for(let rowOffset=-1;rowOffset<=1;rowOffset++){
      for(let colOffset=-1;colOffset<=1;colOffset++){
        if(!rowOffset&&!colOffset)continue;
        const nextRow=row+rowOffset,nextCol=col+colOffset;
        if(nextRow>=0&&nextRow<rows&&nextCol>=0&&nextCol<cols)result.push(nextRow*cols+nextCol);
      }
    }
    return result;
  };
  const currentElapsed=()=>started&&!finished?Math.max(0,Math.floor((Date.now()-timerStart)/1000)):elapsed;
  const formatTime=seconds=>{
    const safe=Math.max(0,Math.min(5999,Math.floor(Number(seconds)||0)));
    return `${Math.floor(safe/60)}:${String(safe%60).padStart(2,'0')}`;
  };
  const stopTimer=()=>{if(timerId){clearInterval(timerId);timerId=0}};
  const renderTime=()=>{elapsed=currentElapsed();time.textContent=formatTime(elapsed)};
  const startTimer=()=>{
    if(started||finished)return;
    started=true;
    timerStart=Date.now()-elapsed*1000;
    stopTimer();
    timerId=setInterval(renderTime,250);
    renderTime();
  };
  const syncLevels=()=>levelButtons.forEach(button=>{
    const active=button.dataset.minesweeperLevel===level;
    button.classList.toggle('is-active',active);
    button.setAttribute('aria-pressed',String(active));
  });
  const syncMode=()=>{
    const flagging=mode==='flag';
    modeButton.dataset.mode=mode;
    modeButton.classList.toggle('is-flagging',flagging);
    modeButton.setAttribute('aria-pressed',String(flagging));
    modeLabel.textContent=flagging?'Flag':'Reveal';
  };
  const flaggedCount=()=>cells.reduce((total,cell)=>total+(cell.flagged?1:0),0);
  const safeLeft=()=>cells.reduce((total,cell)=>total+(!cell.mine&&!cell.revealed?1:0),0);

  function syncStatus(){
    minesLeft.textContent=String(Math.max(0,mineTotal-flaggedCount()));
    if(finished){
      status.textContent=won?'Board cleared — you won!':'Mine hit — try again';
      resetFace.textContent=won?'😎':'😵';
    }else if(started){
      const remaining=safeLeft();
      status.textContent=`${remaining} safe ${remaining===1?'square':'squares'} left`;
      resetFace.textContent='🙂';
    }else{
      status.textContent='Reveal a square to begin';
      resetFace.textContent='🙂';
    }
    renderTime();
  }

  function updateCell(index,{animate=false}={}){
    const cell=cells[index],button=cellButtons[index];
    if(!cell||!button)return;
    button.className='minesweeper-cell';
    button.textContent='';
    delete button.dataset.number;
    button.disabled=finished;
    button.setAttribute('aria-pressed',String(Boolean(cell.revealed)));

    if(cell.revealed){
      button.classList.add('is-revealed');
      if(cell.mine){
        button.classList.add('is-mine');
        if(index===exploded)button.classList.add('is-exploded');
        button.textContent='✹';
        button.setAttribute('aria-label',index===exploded?'Exploded mine':'Mine');
      }else if(cell.adjacent){
        button.dataset.number=String(cell.adjacent);
        button.textContent=String(cell.adjacent);
        button.setAttribute('aria-label',`${cell.adjacent} neighboring ${cell.adjacent===1?'mine':'mines'}`);
      }else{
        button.setAttribute('aria-label','Empty square');
      }
    }else if(cell.flagged){
      button.classList.add('is-flagged');
      if(finished&&!cell.mine){
        button.classList.add('is-wrong-flag');
        button.textContent='×';
        button.setAttribute('aria-label','Incorrect flag');
      }else{
        button.textContent='⚑';
        button.setAttribute('aria-label','Flagged square');
      }
    }else{
      button.setAttribute('aria-label',`Hidden square, row ${Math.floor(index/cols)+1}, column ${index%cols+1}`);
    }

    if(animate){
      button.classList.remove('is-popping');
      void button.offsetWidth;
      button.classList.add('is-popping');
    }
  }

  const updateAllCells=()=>{
    cells.forEach((_,index)=>updateCell(index));
    syncStatus();
  };

  function generateMines(firstIndex){
    const protectedIndexes=new Set([firstIndex,...neighborIndexes(firstIndex)]);
    let candidates=Array.from({length:cells.length},(_,index)=>index).filter(index=>!protectedIndexes.has(index));
    if(candidates.length<mineTotal)candidates=Array.from({length:cells.length},(_,index)=>index).filter(index=>index!==firstIndex);
    for(let index=candidates.length-1;index>0;index--){
      const swap=Math.floor(Math.random()*(index+1));
      [candidates[index],candidates[swap]]=[candidates[swap],candidates[index]];
    }
    candidates.slice(0,mineTotal).forEach(index=>{cells[index].mine=true});
    cells.forEach((cell,index)=>{cell.adjacent=neighborIndexes(index).reduce((sum,next)=>sum+(cells[next].mine?1:0),0)});
    generated=true;
  }

  function finishGame(didWin){
    const finalElapsed=currentElapsed();
    won=Boolean(didWin);
    finished=true;
    elapsed=finalElapsed;
    stopTimer();
    if(!won)cells.forEach(cell=>{if(cell.mine)cell.revealed=true});
    updateAllCells();
    if(won)launchConfetti(m);
  }

  function reveal(index,{notify=true}={}){
    if(finished||!validIndex(index))return;
    const cell=cells[index];
    if(cell.revealed||cell.flagged)return;
    if(!generated)generateMines(index);
    startTimer();

    if(cell.mine){
      cell.revealed=true;
      exploded=index;
      finishGame(false);
      if(notify)notifyBoardChanged('minesweeper-loss');
      return;
    }

    const queue=[index],seen=new Set();
    while(queue.length){
      const current=queue.shift();
      if(seen.has(current))continue;
      seen.add(current);
      const nextCell=cells[current];
      if(nextCell.revealed||nextCell.flagged||nextCell.mine)continue;
      nextCell.revealed=true;
      updateCell(current,{animate:true});
      if(nextCell.adjacent===0)neighborIndexes(current).forEach(next=>{if(!seen.has(next))queue.push(next)});
    }

    if(safeLeft()===0)finishGame(true);
    else syncStatus();
    if(notify)notifyBoardChanged('minesweeper-reveal');
  }

  function toggleFlag(index){
    if(finished||!validIndex(index)||cells[index].revealed)return;
    cells[index].flagged=!cells[index].flagged;
    updateCell(index,{animate:true});
    syncStatus();
    notifyBoardChanged('minesweeper-flag');
  }

  function chord(index){
    if(finished||!validIndex(index))return;
    const cell=cells[index];
    if(!cell.revealed||!cell.adjacent)return;
    const neighbors=neighborIndexes(index);
    if(neighbors.filter(next=>cells[next].flagged).length!==cell.adjacent)return;
    for(const next of neighbors){
      if(finished)break;
      if(!cells[next].flagged&&!cells[next].revealed)reveal(next,{notify:false});
    }
    notifyBoardChanged('minesweeper-chord');
  }

  function handleCellAction(index){
    if(mode==='flag')toggleFlag(index);
    else reveal(index);
  }

  function buildBoard(){
    board.replaceChildren();
    cellButtons=[];
    board.style.setProperty('--minesweeper-cols',String(cols));
    board.style.setProperty('--minesweeper-rows',String(rows));
    board.setAttribute('aria-label',`${level[0].toUpperCase()+level.slice(1)} Minesweeper board, ${rows} by ${cols}`);
    cells.forEach((_,index)=>{
      const button=document.createElement('button');
      button.type='button';
      button.className='minesweeper-cell';
      button.setAttribute('role','gridcell');
      button.addEventListener('click',()=>handleCellAction(index));
      button.addEventListener('dblclick',event=>{event.preventDefault();chord(index)});
      button.addEventListener('contextmenu',event=>{event.preventDefault();event.stopPropagation();toggleFlag(index)});
      button.addEventListener('keydown',event=>{
        const moves={ArrowLeft:-1,ArrowRight:1,ArrowUp:-cols,ArrowDown:cols};
        if(!(event.key in moves))return;
        event.preventDefault();
        const next=index+moves[event.key];
        if(validIndex(next)&&!(event.key==='ArrowLeft'&&index%cols===0)&&!(event.key==='ArrowRight'&&index%cols===cols-1))cellButtons[next]?.focus();
      });
      board.appendChild(button);
      cellButtons.push(button);
    });
    updateAllCells();
  }

  function newGame(nextLevel=level,{notify=true}={}){
    level=levels[nextLevel]?nextLevel:'easy';
    ({rows,cols,mines:mineTotal}=levels[level]);
    cells=Array.from({length:rows*cols},()=>({mine:false,revealed:false,flagged:false,adjacent:0}));
    generated=false;
    started=false;
    finished=false;
    won=false;
    exploded=-1;
    elapsed=0;
    timerStart=0;
    stopTimer();
    m.dataset.minesweeperLevel=level;
    syncLevels();
    buildBoard();
    if(notify)notifyBoardChanged('minesweeper-new-game');
  }

  levelButtons.forEach(button=>button.addEventListener('click',()=>newGame(button.dataset.minesweeperLevel)));
  modeButton.addEventListener('click',()=>{mode=mode==='reveal'?'flag':'reveal';syncMode()});
  resetButton.addEventListener('click',()=>newGame(level));
  m.querySelector('.minesweeper-bg')?.addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.minesweeper-font')?.addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));

  syncMode();
  newGame('easy',{notify:false});

  m._boardGetState=()=>({
    level,
    mode,
    generated,
    started,
    finished,
    won,
    exploded,
    elapsed:currentElapsed(),
    mines:cells.flatMap((cell,index)=>cell.mine?[index]:[]),
    revealed:cells.flatMap((cell,index)=>cell.revealed?[index]:[]),
    flagged:cells.flatMap((cell,index)=>cell.flagged?[index]:[])
  });
  m._boardSetState=state=>{
    const savedLevel=levels[state?.level]?state.level:'easy';
    newGame(savedLevel,{notify:false});
    if(!state)return;
    const mineIndexes=new Set(Array.isArray(state.mines)?state.mines.map(Number).filter(validIndex):[]);
    const revealedIndexes=new Set(Array.isArray(state.revealed)?state.revealed.map(Number).filter(validIndex):[]);
    const flaggedIndexes=new Set(Array.isArray(state.flagged)?state.flagged.map(Number).filter(validIndex):[]);
    generated=Boolean(state.generated)&&mineIndexes.size===mineTotal;
    if(generated){
      mineIndexes.forEach(index=>{cells[index].mine=true});
      cells.forEach((cell,index)=>{cell.adjacent=neighborIndexes(index).reduce((sum,next)=>sum+(cells[next].mine?1:0),0)});
    }
    revealedIndexes.forEach(index=>{cells[index].revealed=true});
    flaggedIndexes.forEach(index=>{if(!cells[index].revealed)cells[index].flagged=true});
    finished=Boolean(state.finished);
    won=finished&&Boolean(state.won);
    exploded=validIndex(state.exploded)?Number(state.exploded):-1;
    elapsed=Math.max(0,Math.floor(Number(state.elapsed)||0));
    started=Boolean(state.started)&&generated;
    mode=state.mode==='flag'?'flag':'reveal';
    syncMode();
    if(started&&!finished){
      timerStart=Date.now()-elapsed*1000;
      timerId=setInterval(renderTime,250);
    }
    updateAllCells();
  };

  const previousCleanup=m._cleanup;
  m._cleanup=()=>{stopTimer();previousCleanup?.()};
}
