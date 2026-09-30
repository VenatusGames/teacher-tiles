function setupWordyPuzzle(m){
  const board=m.querySelector('.wordy-board');
  const keyboard=m.querySelector('.wordy-keyboard');
  const status=m.querySelector('.wordy-status');
  const guessCount=m.querySelector('.wordy-guess-count');
  const message=m.querySelector('.wordy-message');
  const setup=m.querySelector('.wordy-setup');
  const secretInput=m.querySelector('.wordy-secret-input');
  const setupError=m.querySelector('.wordy-setup-error');
  const startButton=m.querySelector('.wordy-start');
  const result=m.querySelector('.wordy-result');
  const resultLabel=m.querySelector('.wordy-result-label');
  const resultWord=m.querySelector('.wordy-result-word');
  const playAgain=m.querySelector('.wordy-play-again');
  const bgButton=m.querySelector('.wordy-bg');
  const fontButton=m.querySelector('.wordy-font');

  const keyboardRows=['QWERTYUIOP','ASDFGHJKL','ZXCVBNM'];
  const maxGuesses=6;

  let secret='';
  let guesses=[];
  let current='';
  let finished=false;
  let revealing=false;
  let keyboardState={};

  const normalizeWord=value=>(value||'')
    .toUpperCase()
    .replace(/[^A-Z]/g,'');

  const stateRank=state=>({absent:1,present:2,correct:3}[state]||0);

  function setKeyState(letter,state){
    if(stateRank(state)>stateRank(keyboardState[letter])){
      keyboardState[letter]=state;
    }
  }

  function clearAnimations(){
    board.querySelectorAll('.wordy-row,.wordy-tile').forEach(el=>{
      el.classList.remove('is-shaking','is-bouncing','is-flipping');
    });
  }

  function buildBoard(){
    board.replaceChildren();
    board.style.maxWidth=`${Math.min(590,secret.length*64)}px`;

    for(let rowIndex=0;rowIndex<maxGuesses;rowIndex++){
      const row=document.createElement('div');
      row.className='wordy-row';
      row.dataset.row=String(rowIndex);
      row.style.gridTemplateColumns=`repeat(${secret.length},minmax(0,1fr))`;

      for(let col=0;col<secret.length;col++){
        const tile=document.createElement('div');
        tile.className='wordy-tile';
        tile.setAttribute('aria-hidden','true');
        row.appendChild(tile);
      }

      board.appendChild(row);
    }
  }

  function buildKeyboard(){
    keyboard.replaceChildren();

    keyboardRows.forEach((letters,rowIndex)=>{
      const row=document.createElement('div');
      row.className='wordy-keyboard-row';

      if(rowIndex===2){
        const enter=document.createElement('button');
        enter.type='button';
        enter.className='wordy-key wordy-key--wide';
        enter.textContent='ENTER';
        enter.dataset.action='enter';
        enter.addEventListener('click',submitGuess);
        row.appendChild(enter);
      }

      [...letters].forEach(letter=>{
        const button=document.createElement('button');
        button.type='button';
        button.className='wordy-key';
        button.textContent=letter;
        button.dataset.letter=letter;
        button.addEventListener('click',()=>typeLetter(letter));
        row.appendChild(button);
      });

      if(rowIndex===2){
        const backspace=document.createElement('button');
        backspace.type='button';
        backspace.className='wordy-key wordy-key--wide wordy-key--backspace';
        backspace.textContent='⌫';
        backspace.dataset.action='backspace';
        backspace.setAttribute('aria-label','Backspace');
        backspace.addEventListener('click',backspaceLetter);
        row.appendChild(backspace);
      }

      keyboard.appendChild(row);
    });
  }

  function renderKeyboard(){
    keyboard.querySelectorAll('.wordy-key[data-letter]').forEach(button=>{
      const keyState=keyboardState[button.dataset.letter]||'';
      button.dataset.state=keyState;
      button.disabled=finished||revealing||!secret;
    });

    keyboard.querySelectorAll('.wordy-key[data-action]').forEach(button=>{
      button.disabled=finished||revealing||!secret;
    });
  }

  function renderCurrent(){
    const row=board.querySelector(`.wordy-row[data-row="${guesses.length}"]`);
    if(!row)return;

    [...row.children].forEach((tile,index)=>{
      tile.textContent=current[index]||'';
      tile.classList.toggle('has-letter',Boolean(current[index]));
    });
  }

  function renderProgress(){
    status.textContent=finished?'ROUND COMPLETE':'GUESS THE WORD';
    guessCount.textContent=secret&&!finished
      ?`Guess ${Math.min(guesses.length+1,maxGuesses)} of ${maxGuesses}`
      :'';
    renderKeyboard();
  }

  function scoreGuess(guess){
    const states=Array(secret.length).fill('absent');
    const remaining={};

    for(let i=0;i<secret.length;i++){
      if(guess[i]===secret[i]){
        states[i]='correct';
      }else{
        remaining[secret[i]]=(remaining[secret[i]]||0)+1;
      }
    }

    for(let i=0;i<secret.length;i++){
      if(states[i]==='correct')continue;
      const letter=guess[i];
      if(remaining[letter]>0){
        states[i]='present';
        remaining[letter]--;
      }
    }

    return states;
  }

  function shakeCurrentRow(text){
    const row=board.querySelector(`.wordy-row[data-row="${guesses.length}"]`);
    if(!row)return;

    message.textContent=text;
    row.classList.remove('is-shaking');
    void row.offsetWidth;
    row.classList.add('is-shaking');
    setTimeout(()=>row.classList.remove('is-shaking'),420);
  }

  function revealGuess(guess,states){
    revealing=true;
    renderKeyboard();

    const rowIndex=guesses.length-1;
    const row=board.querySelector(`.wordy-row[data-row="${rowIndex}"]`);
    const tiles=[...row.children];

    tiles.forEach((tile,index)=>{
      tile.textContent=guess[index];
      tile.classList.remove('has-letter');
      tile.classList.add('is-flipping');
      tile.style.setProperty('--wordy-delay',`${index*115}ms`);

      setTimeout(()=>{
        tile.dataset.state=states[index];
        setKeyState(guess[index],states[index]);
      },index*115+170);
    });

    const duration=(secret.length-1)*115+560;

    setTimeout(()=>{
      revealing=false;
      tiles.forEach(tile=>tile.classList.remove('is-flipping'));
      renderKeyboard();

      const won=guess===secret;
      const lost=!won&&guesses.length>=maxGuesses;

      if(won){
        row.classList.add('is-bouncing');
        setTimeout(()=>finishRound(true),430);
      }else if(lost){
        finishRound(false);
      }else{
        current='';
        message.textContent='';
        renderCurrent();
        renderProgress();
      }
    },duration);
  }

  function submitGuess(){
    if(!secret||finished||revealing)return;

    if(current.length!==secret.length){
      shakeCurrentRow(`Enter ${secret.length} letters`);
      return;
    }

    const guess=current;
    const states=scoreGuess(guess);
    guesses.push(guess);
    revealGuess(guess,states);
  }

  function typeLetter(letter){
    if(!secret||finished||revealing)return;
    if(current.length>=secret.length)return;

    current+=letter;
    message.textContent='';
    renderCurrent();

    const row=board.querySelector(`.wordy-row[data-row="${guesses.length}"]`);
    const tile=row?.children[current.length-1];
    if(tile){
      tile.classList.remove('wordy-pop');
      void tile.offsetWidth;
      tile.classList.add('wordy-pop');
    }
  }

  function backspaceLetter(){
    if(!secret||finished||revealing||!current.length)return;
    current=current.slice(0,-1);
    message.textContent='';
    renderCurrent();
  }

  function finishRound(won){
    finished=true;
    revealing=false;
    status.textContent=won?'YOU GOT IT!':'ROUND COMPLETE';
    guessCount.textContent='';
    renderKeyboard();

    resultLabel.textContent=won
      ?'You guessed the word'
      :'You ran out of guesses';
    resultWord.textContent=secret;
    result.hidden=false;

    if(won)launchConfetti(m);
  }

  function startGame(){
    const next=normalizeWord(secretInput.value);

    if(next.length<3||next.length>8){
      setupError.textContent='Enter a word from 3 to 8 letters.';
      secretInput.focus();
      return;
    }

    secret=next;
    guesses=[];
    current='';
    finished=false;
    revealing=false;
    keyboardState={};

    setupError.textContent='';
    secretInput.value='';
    setup.hidden=true;
    result.hidden=true;
    resultLabel.textContent='';
    resultWord.textContent='';
    message.textContent='';

    buildBoard();
    renderProgress();

    requestAnimationFrame(()=>{
      m.focus({preventScroll:true});
    });
  }

  function openSetup(){
    secret='';
    guesses=[];
    current='';
    finished=false;
    revealing=false;
    keyboardState={};

    clearAnimations();
    board.replaceChildren();
    message.textContent='';
    status.textContent='TEACHER SETUP';
    guessCount.textContent='';
    result.hidden=true;
    setup.hidden=false;
    setupError.textContent='';
    secretInput.value='';

    keyboard.querySelectorAll('.wordy-key').forEach(button=>{
      button.disabled=true;
      delete button.dataset.state;
    });

    requestAnimationFrame(()=>secretInput.focus({preventScroll:true}));
  }

  startButton.addEventListener('click',startGame);

  secretInput.addEventListener('input',()=>{
    const cleaned=normalizeWord(secretInput.value);
    if(secretInput.value!==cleaned)secretInput.value=cleaned;
    setupError.textContent='';
  });

  secretInput.addEventListener('keydown',event=>{
    if(event.key==='Enter'){
      event.preventDefault();
      startGame();
    }
  });

  playAgain.addEventListener('click',event=>{
    event.stopPropagation();
    openSetup();
  });

  m.addEventListener('pointerdown',event=>{
    if(setup.hidden&&result.hidden&&!event.target.closest('button,input')){
      m.focus({preventScroll:true});
    }
  });

  m.addEventListener('keydown',event=>{
    if(!secret||finished||revealing)return;
    if(event.target.closest('input'))return;

    if(/^[a-zA-Z]$/.test(event.key)){
      event.preventDefault();
      typeLetter(event.key.toUpperCase());
      return;
    }

    if(event.key==='Backspace'){
      event.preventDefault();
      backspaceLetter();
      return;
    }

    if(event.key==='Enter'){
      event.preventDefault();
      submitGuess();
    }
  });

  bgButton.addEventListener('click',()=>{
    cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']);
  });

  fontButton.addEventListener('click',()=>{
    cycleData(m,'font',FONT_OPTIONS);
  });

  buildKeyboard();
  openSetup();

  m._boardGetState=()=>({
    secret,
    guesses:[...guesses],
    current,
    finished,
    setupOpen:!setup.hidden
  });
  m._boardSetState=state=>{
    if(!state||state.setupOpen||!normalizeWord(state.secret||'')){
      openSetup();
      return;
    }
    secret=normalizeWord(state.secret);
    guesses=Array.isArray(state.guesses)
      ?state.guesses.map(normalizeWord).filter(guess=>guess.length===secret.length).slice(0,maxGuesses)
      :[];
    current=normalizeWord(state.current||'').slice(0,secret.length);
    finished=Boolean(state.finished);
    revealing=false;
    keyboardState={};
    setup.hidden=true;
    setupError.textContent='';
    result.hidden=true;
    resultLabel.textContent='';
    resultWord.textContent='';
    message.textContent='';
    buildBoard();
    guesses.forEach((guess,rowIndex)=>{
      const states=scoreGuess(guess);
      const row=board.querySelector(`.wordy-row[data-row="${rowIndex}"]`);
      [...(row?.children||[])].forEach((tile,index)=>{
        tile.textContent=guess[index]||'';
        tile.dataset.state=states[index]||'absent';
        setKeyState(guess[index],states[index]);
      });
    });
    if(!finished)renderCurrent();
    renderProgress();
    if(finished){
      const won=guesses.some(guess=>guess===secret);
      status.textContent=won?'YOU GOT IT!':'ROUND COMPLETE';
      guessCount.textContent='';
      resultLabel.textContent=won?'You guessed the word':'You ran out of guesses';
      resultWord.textContent=secret;
      result.hidden=false;
      renderKeyboard();
    }
  };
}
