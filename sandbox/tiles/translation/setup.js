function setupTranslation(m){
  const tileTitle=bindEditableModuleTitle(m,'.translation-title','Language bridge');
  const source=m.querySelector('.translation-source');
  const target=m.querySelector('.translation-target');
  const sourcePickerRoot=m.querySelector('[data-language-picker="source"]');
  const targetPickerRoot=m.querySelector('[data-language-picker="target"]');
  const input=m.querySelector('.translation-input');
  const output=m.querySelector('.translation-output');
  const count=m.querySelector('.translation-count');
  const status=m.querySelector('.translation-status');
  const submit=m.querySelector('.translation-submit');
  const swap=m.querySelector('.translation-swap');
  const mic=m.querySelector('.translation-mic');
  const speak=m.querySelector('.translation-speak');
  const copy=m.querySelector('.translation-copy');
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  let translatedText='';
  let requestController=null;
  let recognition=null;
  let listening=false;

  const languageFor=code=>TRANSLATION_LANGUAGES.find(language=>language.code===code)||TRANSLATION_LANGUAGES[0];
  const setupLanguagePicker=(root,field,defaultCode)=>{
    const search=root.querySelector('.translation-language-search');
    const menu=root.querySelector('.translation-language-menu');
    let visibleLanguages=[...TRANSLATION_LANGUAGES];
    let activeIndex=-1;

    const currentLanguage=()=>languageFor(field.value||defaultCode);
    const close=({restore=true}={})=>{
      root.classList.remove('is-open');
      search.setAttribute('aria-expanded','false');
      activeIndex=-1;
      if(restore)search.value=currentLanguage().name;
    };
    const choose=(code,{announce=true}={})=>{
      const language=languageFor(code);
      field.value=language.code;
      search.value=language.name;
      close({restore:false});
      if(announce){status.textContent='';notifyBoardChanged('translation-language')}
    };
    const render=(query='')=>{
      const normalized=query.trim().toLocaleLowerCase();
      visibleLanguages=TRANSLATION_LANGUAGES.filter(language=>!normalized||language.name.toLocaleLowerCase().includes(normalized)||language.code.toLocaleLowerCase().includes(normalized));
      activeIndex=visibleLanguages.length?0:-1;
      menu.replaceChildren();
      if(!visibleLanguages.length){
        const empty=document.createElement('span');
        empty.className='translation-language-empty';
        empty.textContent='No languages found';
        menu.appendChild(empty);
        return;
      }
      visibleLanguages.forEach((language,index)=>{
        const button=document.createElement('button');
        button.type='button';
        button.className='translation-language-option';
        button.setAttribute('role','option');
        button.dataset.languageCode=language.code;
        button.setAttribute('aria-selected',String(language.code===field.value));
        const name=document.createElement('strong');
        const codeLabel=document.createElement('small');
        name.textContent=language.name;
        codeLabel.textContent=language.code;
        button.append(name,codeLabel);
        button.classList.toggle('is-keyboard-active',index===activeIndex);
        button.addEventListener('pointerdown',event=>event.preventDefault());
        button.addEventListener('click',()=>{choose(language.code);search.focus({preventScroll:true})});
        menu.appendChild(button);
      });
    };
    const syncActiveOption=()=>{
      const options=[...menu.querySelectorAll('.translation-language-option')];
      options.forEach((option,index)=>option.classList.toggle('is-keyboard-active',index===activeIndex));
      options[activeIndex]?.scrollIntoView({block:'nearest'});
    };
    const open=()=>{
      root.classList.add('is-open');
      search.setAttribute('aria-expanded','true');
      render(search.value===currentLanguage().name?'':search.value);
    };
    search.addEventListener('focus',()=>{search.select();open()});
    search.addEventListener('input',()=>{open();render(search.value)});
    search.addEventListener('keydown',event=>{
      if(event.key==='ArrowDown'||event.key==='ArrowUp'){
        event.preventDefault();
        if(!root.classList.contains('is-open'))open();
        if(visibleLanguages.length)activeIndex=(activeIndex+(event.key==='ArrowDown'?1:-1)+visibleLanguages.length)%visibleLanguages.length;
        syncActiveOption();
      }else if(event.key==='Enter'){
        if(root.classList.contains('is-open')&&visibleLanguages[activeIndex]){event.preventDefault();choose(visibleLanguages[activeIndex].code)}
      }else if(event.key==='Escape'){
        event.preventDefault();
        close();
        search.blur();
      }
    });
    search.addEventListener('blur',()=>setTimeout(()=>{if(!root.contains(document.activeElement))close()},0));
    menu.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});
    choose(defaultCode,{announce:false});
    render();
    return{
      get:()=>field.value||defaultCode,
      set:(code,options={})=>choose(code,{announce:options.announce??false}),
      setDisabled:disabled=>{if(disabled)close();search.disabled=disabled;root.classList.toggle('is-disabled',disabled)}
    };
  };
  const sourcePicker=setupLanguagePicker(sourcePickerRoot,source,'en');
  const targetPicker=setupLanguagePicker(targetPickerRoot,target,'es');
  const renderOutput=(value,placeholder='Your translation will appear here.')=>{
    translatedText=String(value||'');
    output.replaceChildren();
    if(translatedText)output.textContent=translatedText;
    else{const span=document.createElement('span');span.textContent=placeholder;output.appendChild(span)}
    speak.disabled=!translatedText;
    copy.disabled=!translatedText;
  };
  const updateCount=()=>{count.textContent=`${input.value.length} / 450`};
  const setLoading=loading=>{
    m.classList.toggle('is-translating',loading);
    submit.disabled=loading;
    sourcePicker.setDisabled(loading);
    targetPicker.setDisabled(loading);
  };

  async function translate(){
    const text=input.value.trim();
    if(!text){status.textContent='Enter something to translate.';input.focus();return}
    if(new TextEncoder().encode(text).length>480){status.textContent='Please shorten the text slightly.';return}
    requestController?.abort();
    const controller=new AbortController();
    requestController=controller;
    status.textContent='Translating…';
    setLoading(true);
    try{
      if(sourcePicker.get()===targetPicker.get()){renderOutput(text);status.textContent='Languages match — no translation needed.';return}
      const url=`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sourcePicker.get())}&tl=${encodeURIComponent(targetPicker.get())}&dt=t&q=${encodeURIComponent(text)}`;
      const response=await fetch(url,{signal:controller.signal});
      if(!response.ok)throw new Error(`translation-${response.status}`);
      const data=await response.json();
      const result=Array.isArray(data?.[0])?data[0].map(segment=>Array.isArray(segment)?String(segment[0]||''):'').join('').trim():'';
      if(!result||/^[\s\-–—_.]+$/.test(result)||/^(testvalue|null|undefined)$/i.test(result))throw new Error('translation-unavailable');
      renderOutput(result);
      status.textContent='Translated';
      notifyBoardChanged('translation-result');
    }catch(error){
      if(error?.name==='AbortError')return;
      status.textContent='Translation is unavailable right now. Try again.';
      renderOutput('', 'Could not translate this text.');
    }finally{
      if(requestController===controller){requestController=null;setLoading(false)}
    }
  }

  input.addEventListener('input',()=>{updateCount();status.textContent=''});
  input.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();translate()}});
  submit.addEventListener('click',translate);
  swap.addEventListener('click',()=>{
    const priorSource=sourcePicker.get();
    sourcePicker.set(targetPicker.get());
    targetPicker.set(priorSource);
    if(translatedText){const priorInput=input.value;input.value=translatedText;renderOutput(priorInput);updateCount()}
    status.textContent='Languages swapped';
    notifyBoardChanged('translation-swap');
  });

  if(!SpeechRecognition){
    mic.disabled=true;
    mic.title='Speech input is not supported in this browser';
  }else{
    mic.addEventListener('click',()=>{
      if(listening){recognition?.stop();return}
      recognition=new SpeechRecognition();
      recognition.lang=languageFor(sourcePicker.get()).speech;
      recognition.interimResults=true;
      recognition.continuous=false;
      recognition.maxAlternatives=1;
      recognition.onstart=()=>{listening=true;m.classList.add('is-listening');status.textContent='Listening…'};
      recognition.onresult=event=>{
        let transcript='';
        for(let i=event.resultIndex;i<event.results.length;i++)transcript+=event.results[i][0]?.transcript||'';
        if(transcript){input.value=transcript.trim();updateCount()}
      };
      recognition.onerror=event=>{status.textContent=event.error==='not-allowed'?'Microphone permission was not granted.':'Speech input could not start.'};
      recognition.onend=()=>{listening=false;m.classList.remove('is-listening');if(input.value.trim()){status.textContent='Speech captured';notifyBoardChanged('translation-speech')}};
      try{recognition.start()}catch{status.textContent='Speech input could not start.'}
    });
  }

  speak.addEventListener('click',()=>{
    if(!translatedText||!('speechSynthesis'in window))return;
    speechSynthesis.cancel();
    const utterance=new SpeechSynthesisUtterance(translatedText);
    utterance.lang=languageFor(targetPicker.get()).speech;
    speechSynthesis.speak(utterance);
  });
  copy.addEventListener('click',async()=>{
    if(!translatedText)return;
    try{await navigator.clipboard.writeText(translatedText);status.textContent='Copied translation'}
    catch{status.textContent='Could not copy automatically.'}
  });
  m.querySelector('.translation-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.translation-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.translation-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));

  renderOutput('');
  updateCount();
  m._boardGetState=()=>({title:tileTitle.get(),source:sourcePicker.get(),target:targetPicker.get(),input:input.value,output:translatedText});
  m._boardSetState=state=>{
    if(!state)return;
    tileTitle.set(state.title);
    sourcePicker.set(TRANSLATION_LANGUAGES.some(language=>language.code===state.source)?state.source:'en');
    targetPicker.set(TRANSLATION_LANGUAGES.some(language=>language.code===state.target)?state.target:'es');
    input.value=String(state.input||'').slice(0,450);
    renderOutput(String(state.output||''));
    updateCount();
  };
  const prior=m._cleanup;
  m._cleanup=()=>{prior?.();requestController?.abort();recognition?.abort();if('speechSynthesis'in window)speechSynthesis.cancel()};
}
