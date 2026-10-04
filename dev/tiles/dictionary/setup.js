function setupDictionary(m){
  const form=m.querySelector('.dictionary-search');
  const input=m.querySelector('.dictionary-input');
  const submit=m.querySelector('.dictionary-submit');
  const status=m.querySelector('.dictionary-status');
  const content=m.querySelector('.dictionary-content');
  const welcome=m.querySelector('.dictionary-welcome');
  const results=m.querySelector('.dictionary-results');
  let entries=[];
  let requestController=null;
  let activeAudio=null;

  const cleanText=(value,max=5000)=>String(value||'').trim().slice(0,max);
  const uniqueWords=(values,max=28)=>[...new Set((Array.isArray(values)?values:[]).map(value=>cleanText(value,80)).filter(Boolean))].slice(0,max);
  const normalizeEntries=data=>(Array.isArray(data)?data:[]).slice(0,4).map(entry=>({
    word:cleanText(entry?.word,120),
    phonetic:cleanText(entry?.phonetic,180),
    phonetics:(Array.isArray(entry?.phonetics)?entry.phonetics:[]).map(item=>({
      text:cleanText(item?.text,180),
      audio:cleanText(item?.audio,1000)
    })).filter(item=>item.text||item.audio).slice(0,10),
    origin:cleanText(entry?.origin,3000),
    sourceUrls:(Array.isArray(entry?.sourceUrls)?entry.sourceUrls:[]).map(url=>cleanText(url,1000)).filter(url=>/^https?:\/\//i.test(url)).slice(0,5),
    meanings:(Array.isArray(entry?.meanings)?entry.meanings:[]).map(meaning=>({
      partOfSpeech:cleanText(meaning?.partOfSpeech,80),
      synonyms:uniqueWords(meaning?.synonyms),
      antonyms:uniqueWords(meaning?.antonyms),
      definitions:(Array.isArray(meaning?.definitions)?meaning.definitions:[]).map(definition=>({
        definition:cleanText(definition?.definition),
        example:cleanText(definition?.example,2000),
        synonyms:uniqueWords(definition?.synonyms),
        antonyms:uniqueWords(definition?.antonyms)
      })).filter(definition=>definition.definition)
    })).filter(meaning=>meaning.partOfSpeech||meaning.definitions.length)
  })).filter(entry=>entry.word||entry.meanings.length);

  const createChipGroup=(label,words)=>{
    if(!words.length)return null;
    const row=document.createElement('div');
    row.className='dictionary-word-row';
    const heading=document.createElement('span');
    heading.textContent=label;
    const chips=document.createElement('div');
    chips.className='dictionary-chips';
    words.forEach(word=>{
      const chip=document.createElement('button');
      chip.type='button';
      chip.textContent=word;
      chip.title=`Look up ${word}`;
      chip.addEventListener('click',()=>{
        input.value=word;
        lookup(word);
      });
      chips.appendChild(chip);
    });
    row.append(heading,chips);
    return row;
  };

  const playPronunciation=(url,button,word)=>{
    if(activeAudio){activeAudio.pause();activeAudio=null}
    button.classList.add('is-playing');
    const finish=()=>button.classList.remove('is-playing');
    if(url){
      const resolved=url.startsWith('//')?`https:${url}`:url;
      const audio=new Audio(resolved);
      audio.volume=masterAudioLevel();
      activeAudio=audio;
      const finishAudio=()=>{finish();if(activeAudio===audio)activeAudio=null};
      audio.addEventListener('ended',finishAudio,{once:true});
      audio.addEventListener('error',finishAudio,{once:true});
      audio.play().catch(finishAudio);
      return;
    }
    if('speechSynthesis'in window&&word){
      speechSynthesis.cancel();
      const utterance=new SpeechSynthesisUtterance(word);
      utterance.rate=.82;
      utterance.volume=masterAudioLevel();
      utterance.addEventListener('end',finish,{once:true});
      utterance.addEventListener('error',finish,{once:true});
      speechSynthesis.speak(utterance);
    }else finish();
  };

  const onDictionaryAudioPreferences=()=>{if(activeAudio)activeAudio.volume=masterAudioLevel()};
  window.addEventListener('teachertiles:audiopreferenceschange',onDictionaryAudioPreferences);

  const renderEntries=(animate=true)=>{
    results.replaceChildren();
    welcome.hidden=Boolean(entries.length);
    results.hidden=!entries.length;
    if(!entries.length)return;

    entries.forEach((entry,entryIndex)=>{
      const article=document.createElement('article');
      article.className='dictionary-entry';

      const head=document.createElement('header');
      head.className='dictionary-entry-head';
      const identity=document.createElement('div');
      const word=document.createElement('strong');
      word.textContent=entry.word||input.value;
      const phoneticText=entry.phonetic||entry.phonetics.find(item=>item.text)?.text||'';
      if(phoneticText){
        const phonetic=document.createElement('span');
        phonetic.textContent=phoneticText;
        identity.append(word,phonetic);
      }else identity.append(word);
      head.appendChild(identity);

      const audioUrl=entry.phonetics.find(item=>item.audio)?.audio||'';
      if(entry.word){
        const audioButton=document.createElement('button');
        audioButton.type='button';
        audioButton.className='dictionary-audio';
        audioButton.setAttribute('aria-label',`Hear ${entry.word} pronounced`);
        audioButton.title='Hear pronunciation';
        audioButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 10v4h3l4 3V7L8 10H5Z" fill="currentColor"/><path d="M15 9.2a4 4 0 0 1 0 5.6M17.5 6.8a7.3 7.3 0 0 1 0 10.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
        audioButton.addEventListener('click',()=>playPronunciation(audioUrl,audioButton,entry.word));
        head.appendChild(audioButton);
      }
      article.appendChild(head);

      if(entry.origin){
        const origin=document.createElement('p');
        origin.className='dictionary-origin';
        const originLabel=document.createElement('strong');
        originLabel.textContent='Origin';
        origin.append(originLabel,document.createTextNode(` ${entry.origin}`));
        article.appendChild(origin);
      }

      entry.meanings.forEach(meaning=>{
        const section=document.createElement('section');
        section.className='dictionary-meaning';
        const part=document.createElement('div');
        part.className='dictionary-part';
        const partName=document.createElement('strong');
        partName.textContent=meaning.partOfSpeech||'meaning';
        const line=document.createElement('i');
        part.append(partName,line);
        section.appendChild(part);

        const list=document.createElement('ol');
        meaning.definitions.forEach(definition=>{
          const item=document.createElement('li');
          const copy=document.createElement('p');
          copy.textContent=definition.definition;
          item.appendChild(copy);
          if(definition.example){
            const example=document.createElement('blockquote');
            example.textContent=`“${definition.example}”`;
            item.appendChild(example);
          }
          const synonymRow=createChipGroup('Similar',uniqueWords(definition.synonyms));
          const antonymRow=createChipGroup('Opposite',uniqueWords(definition.antonyms));
          if(synonymRow)item.appendChild(synonymRow);
          if(antonymRow)item.appendChild(antonymRow);
          list.appendChild(item);
        });
        section.appendChild(list);
        const meaningSynonyms=createChipGroup('Synonyms',uniqueWords(meaning.synonyms));
        const meaningAntonyms=createChipGroup('Antonyms',uniqueWords(meaning.antonyms));
        if(meaningSynonyms)section.appendChild(meaningSynonyms);
        if(meaningAntonyms)section.appendChild(meaningAntonyms);
        article.appendChild(section);
      });

      if(entry.sourceUrls.length){
        const source=document.createElement('a');
        source.className='dictionary-source';
        source.href=entry.sourceUrls[0];
        source.target='_blank';
        source.rel='noopener noreferrer';
        source.textContent='View source entry ↗';
        article.appendChild(source);
      }
      results.appendChild(article);
      if(entryIndex<entries.length-1){
        const divider=document.createElement('div');
        divider.className='dictionary-entry-divider';
        results.appendChild(divider);
      }
    });

    if(animate&&results.animate)results.animate([
      {opacity:0,transform:'translateY(8px)'},
      {opacity:1,transform:'translateY(0)'}
    ],{duration:260,easing:'cubic-bezier(.2,.8,.2,1)'});
  };

  const showMessage=(title,message)=>{
    entries=[];
    results.replaceChildren();
    results.hidden=true;
    welcome.hidden=false;
    welcome.querySelector('.dictionary-welcome-icon').textContent='?';
    welcome.querySelector('strong').textContent=title;
    welcome.querySelector('p').textContent=message;
  };

  const setLoading=loading=>{
    m.classList.toggle('is-loading',loading);
    submit.disabled=loading;
    input.disabled=loading;
  };

  const datamusePartNames={n:'noun',v:'verb',adj:'adjective',adv:'adverb',u:'word'};
  const datamuseEntry=(result,synonyms=[],antonyms=[])=>{
    if(!result||typeof result!=='object')return[];
    const meaningMap=new Map();
    for(const raw of Array.isArray(result.defs)?result.defs:[]){
      const [code,...definitionParts]=String(raw).split('\t');
      const definition=cleanText(definitionParts.join(' ').trim());
      if(!definition)continue;
      const partOfSpeech=datamusePartNames[code]||code||'word';
      if(!meaningMap.has(partOfSpeech))meaningMap.set(partOfSpeech,[]);
      meaningMap.get(partOfSpeech).push({definition,example:'',synonyms:[],antonyms:[]});
    }
    const tags=Array.isArray(result.tags)?result.tags.map(String):[];
    const ipa=tags.find(tag=>tag.startsWith('ipa_pron:'))?.slice(9).trim()||'';
    const pronunciation=ipa||tags.find(tag=>tag.startsWith('pron:'))?.slice(5).trim()||'';
    const syllables=Math.max(0,Number(result.numSyllables)||0);
    const word=cleanText(result.word,120);
    const meanings=[...meaningMap.entries()].map(([partOfSpeech,definitions],meaningIndex)=>({
      partOfSpeech,
      definitions,
      synonyms:meaningIndex===0?uniqueWords(synonyms.map(item=>item?.word)):[],
      antonyms:meaningIndex===0?uniqueWords(antonyms.map(item=>item?.word)):[]
    }));
    if(!meanings.length)return[];
    return normalizeEntries([{
      word,
      phonetic:pronunciation?`/${pronunciation}/`:syllables?`${syllables} ${syllables===1?'syllable':'syllables'}`:'',
      phonetics:pronunciation?[{text:`/${pronunciation}/`,audio:''}]:[],
      origin:'',
      sourceUrls:[],
      meanings
    }]);
  };

  async function lookup(value){
    const query=String(value||input.value).trim().replace(/\s+/g,' ');
    if(!query){input.focus();return}
    input.value=query;
    requestController?.abort();
    const controller=new AbortController();
    requestController=controller;
    let timedOut=false;
    const requestTimeout=window.setTimeout(()=>{
      timedOut=true;
      controller.abort();
    },12000);
    setLoading(true);
    status.textContent=`Looking up “${query}”…`;
    try{
      const exactUrl=`https://api.datamuse.com/words?sp=${encodeURIComponent(query)}&md=dpsr&ipa=1&max=10`;
      const synonymUrl=`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(query)}&max=28`;
      const antonymUrl=`https://api.datamuse.com/words?rel_ant=${encodeURIComponent(query)}&max=28`;
      const [exactResponse,synonymResponse,antonymResponse]=await Promise.all([
        fetch(exactUrl,{signal:controller.signal}),
        fetch(synonymUrl,{signal:controller.signal}),
        fetch(antonymUrl,{signal:controller.signal})
      ]);
      if(!exactResponse.ok)throw new Error(`request-${exactResponse.status}`);
      const [matches,synonyms,antonyms]=await Promise.all([
        exactResponse.json(),
        synonymResponse.ok?synonymResponse.json():[],
        antonymResponse.ok?antonymResponse.json():[]
      ]);
      const exact=(Array.isArray(matches)?matches:[]).find(item=>String(item?.word||'').toLocaleLowerCase()===query.toLocaleLowerCase())||matches?.[0];
      entries=datamuseEntry(exact,synonyms,antonyms);
      if(!entries.length)throw new Error('not-found');
      status.textContent='';
      welcome.querySelector('.dictionary-welcome-icon').textContent='A';
      welcome.querySelector('strong').textContent='Discover a word';
      welcome.querySelector('p').textContent='Search to see pronunciation, meanings, examples, synonyms, antonyms, and more.';
      renderEntries(true);
      notifyBoardChanged('dictionary-result');
    }catch(error){
      if(error?.name==='AbortError'&&!timedOut)return;
      status.textContent='';
      if(error?.message==='not-found')showMessage('Word not found','Check the spelling or try a different form of the word.');
      else showMessage('Lookup unavailable','The dictionary could not be reached. Check your connection and try again.');
      notifyBoardChanged('dictionary-result');
    }finally{
      window.clearTimeout(requestTimeout);
      if(requestController===controller){
        requestController=null;
        setLoading(false);
      }
    }
  }

  form.addEventListener('submit',event=>{
    event.preventDefault();
    lookup(input.value);
  });
  m.querySelector('.dictionary-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.dictionary-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.dictionary-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));

  m._boardGetState=()=>({query:input.value,entries});
  m._boardSetState=state=>{
    if(!state)return;
    input.value=cleanText(state.query,80);
    entries=normalizeEntries(state.entries);
    renderEntries(false);
  };

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    requestController?.abort();
    activeAudio?.pause();
    window.removeEventListener('teachertiles:audiopreferenceschange',onDictionaryAudioPreferences);
    if('speechSynthesis'in window)speechSynthesis.cancel();
  };
}
