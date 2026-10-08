function setupHangman(m){
  const status=m.querySelector('.hangman-status');
  const wordEl=m.querySelector('.hangman-word');
  const wrongEl=m.querySelector('.hangman-wrong-letters');
  const keyboard=m.querySelector('.hangman-keyboard');
  const setup=m.querySelector('.hangman-setup');
  const input=m.querySelector('.hangman-word-input');
  const saveButton=m.querySelector('.hangman-save-word');
  const result=m.querySelector('.hangman-result');
  const resultLabel=m.querySelector('.hangman-result-label');
  const resultMessage=m.querySelector('.hangman-result-message');
  const bgButton=m.querySelector('.hangman-bg');
  const fontButton=m.querySelector('.hangman-font');
  const parts=[...m.querySelectorAll('.hangman-part')];

  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  let secret='';
  let guessed=new Set();
  let wrong=[];
  let finished=false;
  const maxWrong=6;

  function normalizeWord(value){
    return value.toUpperCase().replace(/[^A-Z ]+/g,'').replace(/\s+/g,' ').trim();
  }

  function clearRound(){
    secret='';
    guessed=new Set();
    wrong=[];
    finished=false;
    m.classList.remove('is-finished');
    result.hidden=true;
    resultLabel.textContent='';
    resultMessage.textContent='';
    status.textContent='READY';
    wrongEl.textContent='—';

    parts.forEach(part=>part.classList.remove('is-visible'));

    wordEl.replaceChildren();
    const placeholder=document.createElement('div');
    placeholder.style.opacity='.35';
    placeholder.style.fontWeight='800';
    placeholder.style.fontSize='13px';
    placeholder.textContent='New round';
    wordEl.append(placeholder);

    keyboard.querySelectorAll('.hangman-key').forEach(b=>{
      b.disabled=true;
      b.classList.remove('is-correct','is-wrong');
    });
  }

  m.querySelector('.hangman-new-game')?.addEventListener('click',()=>{openSetup();notifyBoardChanged('hangman-new-game')});
  function openSetup(){
    clearRound();
    input.value='';
    setup.hidden=false;
    if(!m._isBoardRestore)requestAnimationFrame(()=>{if(m.isConnected&&!setup.hidden)input.focus({preventScroll:true})});
  }

  function closeSetup(){
    setup.hidden=true;
  }

  function buildKeyboard(){
    keyboard.replaceChildren();
    alphabet.forEach(letter=>{
      const b=document.createElement('button');
      b.className='hangman-key';
      b.type='button';
      b.textContent=letter;
      b.dataset.letter=letter;
      b.disabled=true;
      b.addEventListener('click',()=>guess(letter));
      keyboard.append(b);
    });
  }

  function renderFigure(){
    parts.forEach((part,i)=>part.classList.toggle('is-visible',i<wrong.length));
  }

  function renderWord(){
    wordEl.replaceChildren();

    if(!secret)return;

    [...secret].forEach(char=>{
      const slot=document.createElement('span');
      slot.className='hangman-letter-slot';

      if(char===' '){
        slot.classList.add('is-space');
      }else{
        slot.textContent=guessed.has(char)||finished?char:'';
      }

      wordEl.append(slot);
    });
  }

  function renderKeyboard(){
    keyboard.querySelectorAll('.hangman-key').forEach(b=>{
      const letter=b.dataset.letter;
      const used=guessed.has(letter);

      b.disabled=!secret||finished||used;
      b.classList.toggle('is-correct',used&&secret.includes(letter));
      b.classList.toggle('is-wrong',used&&!secret.includes(letter));
    });
  }

  function render(){
    renderWord();
    renderFigure();
    renderKeyboard();
    wrongEl.textContent=wrong.length?wrong.join(' '):'—';

    if(secret&&!finished){
      const tries=maxWrong-wrong.length;
      status.textContent=`${tries} ${tries===1?'TRY':'TRIES'} LEFT`;
    }
  }

  function checkWin(){
    const letters=[...new Set(secret.replace(/ /g,''))];
    return letters.every(letter=>guessed.has(letter));
  }

  function finish(won){
    finished=true;
    m.classList.add('is-finished');
    renderWord();
    renderKeyboard();

    if(won){
      status.textContent='YOU WON!';
      resultLabel.textContent='YOU WON!';
      resultMessage.textContent=`The word was ${secret}!`;
      launchConfetti(m);
    }else{
      status.textContent='TRY AGAIN!';
      resultLabel.textContent='TRY AGAIN!';
      resultMessage.textContent=`The word was ${secret}!`;
    }

    result.hidden=false;
  }

  function guess(letter){
    if(!secret||finished||guessed.has(letter))return;

    guessed.add(letter);

    if(!secret.includes(letter)){
      wrong.push(letter);
    }

    if(checkWin()){
      finish(true);
      return;
    }

    if(wrong.length>=maxWrong){
      finish(false);
      return;
    }

    render();
  }

  function startGame(){
    const next=normalizeWord(input.value);

    if(!next){
      input.focus();
      return;
    }

    secret=next;
    guessed=new Set();
    wrong=[];
    finished=false;
    m.classList.remove('is-finished');
    closeSetup();
    render();
  }

  saveButton.addEventListener('click',startGame);

  input.addEventListener('keydown',e=>{
    if(e.key==='Enter'){
      e.preventDefault();
      startGame();
    }
  });

  result.addEventListener('click',e=>{
    e.stopPropagation();
    if(result.hidden)return;
    openSetup();
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
    guessed:[...guessed],
    wrong:[...wrong],
    finished,
    setupOpen:!setup.hidden
  });
  m._boardSetState=state=>{
    if(!state||state.setupOpen||!normalizeWord(state.secret||'')){
      openSetup();
      return;
    }
    secret=normalizeWord(state.secret);
    const allowed=new Set(alphabet);
    guessed=new Set(Array.isArray(state.guessed)?state.guessed.map(String).filter(letter=>allowed.has(letter)):[]);
    wrong=Array.isArray(state.wrong)?state.wrong.map(String).filter(letter=>allowed.has(letter)&&!secret.includes(letter)).slice(0,maxWrong):[];
    finished=Boolean(state.finished);
    setup.hidden=true;
    result.hidden=true;
    m.classList.toggle('is-finished',finished);
    render();
    if(finished){
      const won=checkWin();
      status.textContent=won?'YOU WON!':'TRY AGAIN!';
      resultLabel.textContent=won?'YOU WON!':'TRY AGAIN!';
      resultMessage.textContent=`The word was ${secret}!`;
      result.hidden=false;
      renderWord();
      renderKeyboard();
    }
  };
}
