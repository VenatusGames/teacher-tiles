function setupVoting(m){
  const grid=m.querySelector('.voting-grid');
  const pool=m.querySelector('.voting-name-pool');
  const poolList=m.querySelector('.voting-pool-list');
  const summary=m.querySelector('.voting-summary');
  const modeButtons=[...m.querySelectorAll('[data-voting-mode-button]')];
  const nameInput=m.querySelector('.voting-name-input');
  const addNameButton=m.querySelector('.voting-add-name');
  const resetCounts=m.querySelector('.voting-reset-counts');
  const resetNames=m.querySelector('.voting-reset-names');
  const inlineActions=m.querySelector('.voting-inline-actions');
  const imageInput=m.querySelector('.voting-image-input');

  let students=[];
  let draggedStudent='';
  let activeChoiceId='';
  let choiceId=0;

  const createChoice=name=>({
    id:`vote-${++choiceId}`,
    name,
    imageSrc:'',
    tally:0,
    students:[]
  });

  const choices=[
    createChoice('Choice 1'),
    createChoice('Choice 2')
  ];

  const findChoice=id=>choices.find(choice=>choice.id===id);
  const assignment=name=>choices.find(choice=>choice.students.includes(name))?.id||'';

  const setMode=mode=>{
    const next=mode==='names'?'names':'tally';
    m.dataset.votingMode=next;

    modeButtons.forEach(button=>{
      const active=button.dataset.votingModeButton===next;
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-pressed',String(active));
    });

    summary.textContent=next==='tally'
      ?'Tap a choice to add a vote'
      :'Open Students, then drag names to a choice';

    pool.hidden=next!=='names';
    resetCounts.hidden=next!=='tally';
    resetNames.hidden=next!=='names';
    inlineActions.classList.toggle('is-names',next==='names');

    renderChoices();
    renderPool();
  };

  const addStudent=()=>{
    const value=nameInput.value.trim().replace(/\s+/g,' ');
    if(!value)return;

    if(students.some(name=>name.toLocaleLowerCase()===value.toLocaleLowerCase())){
      nameInput.select();
      return;
    }

    students.push(value);
    nameInput.value='';
    renderPool();
    nameInput.focus({preventScroll:true});
  };

  const removeStudent=name=>{
    choices.forEach(choice=>{
      choice.students=choice.students.filter(student=>student!==name);
    });
    students=students.filter(student=>student!==name);
    renderChoices();
    renderPool();
    notifyBoardChanged('voting-remove-student');
  };

  const assign=(name,targetId='')=>{
    choices.forEach(choice=>{
      choice.students=choice.students.filter(student=>student!==name);
    });
    if(targetId){
      const target=findChoice(targetId);
      if(target&&!target.students.includes(name))target.students.push(name);
    }
    renderChoices();
    renderPool();
    notifyBoardChanged('voting-assignment');
  };

  const studentChip=(name,{removable=false,unassignOnly=false}={})=>{
    const chip=document.createElement('div');
    chip.className='voting-student-chip choice-student-chip';
    chip.draggable=true;

    const text=document.createElement('span');
    text.textContent=name;
    chip.appendChild(text);

    chip.addEventListener('dragstart',event=>{
      draggedStudent=name;
      chip.classList.add('is-dragging');
      event.dataTransfer?.setData('text/plain',name);
      if(event.dataTransfer)event.dataTransfer.effectAllowed='move';
    });

    chip.addEventListener('dragend',()=>{
      draggedStudent='';
      chip.classList.remove('is-dragging');
      m.querySelectorAll('.is-drop-target').forEach(node=>node.classList.remove('is-drop-target'));
    });

    if(removable){
      const remove=document.createElement('button');
      remove.type='button';
      remove.textContent='×';
      remove.setAttribute('aria-label',unassignOnly?`Return ${name} to unassigned`:`Remove ${name}`);
      remove.addEventListener('click',event=>{
        event.stopPropagation();
        if(unassignOnly)assign(name,'');
        else removeStudent(name);
      });
      chip.appendChild(remove);
    }

    return chip;
  };

  const wireDrop=(element,targetId='')=>{
    element.addEventListener('dragover',event=>{
      if(m.dataset.votingMode!=='names')return;
      event.preventDefault();
      element.classList.add('is-drop-target');
    });

    element.addEventListener('dragleave',event=>{
      if(!element.contains(event.relatedTarget))element.classList.remove('is-drop-target');
    });

    element.addEventListener('drop',event=>{
      if(m.dataset.votingMode!=='names')return;
      event.preventDefault();
      element.classList.remove('is-drop-target');
      const name=draggedStudent||event.dataTransfer?.getData('text/plain');
      if(name&&students.includes(name))assign(name,targetId);
    });
  };

  const openImagePicker=id=>{
    activeChoiceId=id;
    imageInput.value='';
    imageInput.click();
  };

  const renderChoices=()=>{
    grid.replaceChildren();
    const namesMode=m.dataset.votingMode==='names';

    choices.forEach((choice,index)=>{
      const card=document.createElement('section');
      card.className='voting-choice choice-card';
      if(namesMode)wireDrop(card,choice.id);

      const controls=document.createElement('div');
      controls.className='voting-choice-controls';

      const remove=document.createElement('button');
      remove.type='button';
      remove.className='voting-choice-remove choice-remove';
      remove.textContent='×';
      remove.title='Remove choice';
      remove.setAttribute('aria-label',`Remove ${choice.name}`);
      remove.disabled=choices.length<=1;
      remove.addEventListener('click',event=>{
        event.stopPropagation();
        if(choices.length<=1)return;
        choice.students.forEach(name=>assign(name,''));
        const choiceIndex=choices.indexOf(choice);
        if(choiceIndex>=0)choices.splice(choiceIndex,1);
        renderChoices();
        renderPool();
      });
      controls.appendChild(remove);

      const imageButton=document.createElement('button');
      imageButton.type='button';
      imageButton.className='voting-choice-image';
      imageButton.setAttribute('aria-label',choice.imageSrc?`Change image for ${choice.name}`:`Add image for ${choice.name}`);
      imageButton.title=choice.imageSrc?'Change image':'Add image';

      if(choice.imageSrc){
        const image=document.createElement('img');
        image.src=choice.imageSrc;
        image.alt='';
        image.draggable=false;
        imageButton.appendChild(image);
      }else{
        imageButton.innerHTML='<span aria-hidden="true">＋</span><small>Add Image</small>';
      }

      imageButton.addEventListener('click',event=>{
        event.stopPropagation();
        openImagePicker(choice.id);
      });

      const title=document.createElement('input');
      title.type='text';
      title.className='voting-choice-name choice-name';
      title.maxLength=30;
      title.value=choice.name;
      title.setAttribute('aria-label',`Poll choice ${index+1}`);
      title.addEventListener('click',event=>event.stopPropagation());
      title.addEventListener('input',()=>choice.name=title.value);
      title.addEventListener('blur',()=>{
        choice.name=title.value.trim()||`Choice ${index+1}`;
        title.value=choice.name;
      });

      const count=document.createElement('strong');
      count.className='voting-choice-count choice-count';
      count.textContent=String(namesMode?choice.students.length:choice.tally);

      const content=document.createElement('div');
      content.className='voting-choice-content choice-content';

      if(namesMode){
        if(choice.students.length){
          choice.students.forEach(name=>content.appendChild(studentChip(name,{removable:true,unassignOnly:true})));
        }else{
          const empty=document.createElement('span');
          empty.className='voting-choice-empty';
          empty.textContent='Drop names here';
          content.appendChild(empty);
        }
      }else{
        const label=document.createElement('span');
        label.className='voting-tally-label';
        label.textContent=choice.tally===1?'vote':'votes';
        content.appendChild(label);

        const minus=document.createElement('button');
        minus.type='button';
        minus.className='voting-tally-minus choice-tally-minus';
        minus.textContent='−';
        minus.disabled=choice.tally<=0;
        minus.setAttribute('aria-label',`Remove one vote from ${choice.name}`);
        minus.addEventListener('click',event=>{
          event.stopPropagation();
          choice.tally=Math.max(0,choice.tally-1);
          renderChoices();
        });
        content.appendChild(minus);

        card.classList.add('is-tally');
        card.tabIndex=0;
        card.setAttribute('role','button');
        card.setAttribute('aria-label',`${choice.name}: ${choice.tally} votes. Add one vote.`);

        const add=()=>{
          choice.tally++;
          renderChoices();
        };

        card.addEventListener('click',event=>{
          if(!event.target.closest('input,button'))add();
        });

        card.addEventListener('keydown',event=>{
          if(event.key==='Enter'||event.key===' '){
            event.preventDefault();
            add();
          }
        });
      }

      card.append(controls,imageButton,title,count,content);
      grid.appendChild(card);
    });

    const addCard=document.createElement('button');
    addCard.type='button';
    addCard.className='voting-add-choice-card choice-add-card';
    addCard.setAttribute('aria-label','Add voting choice');
    addCard.title='Add choice';
    addCard.innerHTML='<span aria-hidden="true">+</span><small>Add Choice</small>';
    addCard.addEventListener('click',()=>{
      choices.push(createChoice(`Choice ${choices.length+1}`));
      renderChoices();
      requestAnimationFrame(()=>{
        const titles=[...grid.querySelectorAll('.voting-choice-name')];
        titles.at(-1)?.focus({preventScroll:true});
        titles.at(-1)?.select();
      });
    });
    grid.appendChild(addCard);
  };

  const renderPool=()=>{
    requestAnimationFrame(()=>fitNameModuleToRoster(m,students.length,{namesPerRow:6,rowHeight:30,threshold:12}));
    poolList.replaceChildren();
    if(m.dataset.votingMode!=='names')return;

    const unassigned=students.filter(name=>!assignment(name));

    if(!students.length){
      const empty=document.createElement('span');
      empty.className='voting-pool-empty';
      empty.textContent='Add student names above';
      poolList.appendChild(empty);
      return;
    }

    if(!unassigned.length){
      const empty=document.createElement('span');
      empty.className='voting-pool-empty';
      empty.textContent='Everyone has voted';
      poolList.appendChild(empty);
      return;
    }

    unassigned.forEach(name=>{
      poolList.appendChild(studentChip(name,{removable:true}));
    });
  };

  wireDrop(poolList,'');

  modeButtons.forEach(button=>{
    button.addEventListener('click',()=>setMode(button.dataset.votingModeButton));
  });

  addNameButton.addEventListener('click',addStudent);
  nameInput.addEventListener('keydown',event=>{
    if(event.key==='Enter'){
      event.preventDefault();
      addStudent();
    }
  });

  resetCounts.addEventListener('click',()=>{
    choices.forEach(choice=>choice.tally=0);
    renderChoices();
  });

  resetNames.addEventListener('click',()=>{
    choices.forEach(choice=>choice.students=[]);
    renderChoices();
    renderPool();
  });

  imageInput.addEventListener('change',()=>{
    const file=imageInput.files?.[0];
    const choice=findChoice(activeChoiceId);
    if(!file||!choice)return;

    const reader=new FileReader();
    reader.addEventListener('load',()=>{
      if(typeof reader.result==='string'){
        choice.imageSrc=reader.result;
        renderChoices();
        notifyBoardChanged('voting-image');
      }
    },{once:true});
    reader.readAsDataURL(file);
  });

  m.querySelector('.voting-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.voting-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.voting-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));

  const detachRosterLoader=attachClassRosterLoader(nameInput.closest('.voting-name-entry'),rosterNames=>{
    students=normalizeRosterNames(rosterNames);
    choices.forEach(choice=>choice.students=[]);
    setMode('names');
    renderChoices();
    renderPool();
  });

  m._boardGetState=()=>({
    mode:m.dataset.votingMode||'tally',
    students:[...students],
    choices:choices.map(choice=>({
      name:choice.name,
      imageSrc:choice.imageSrc,
      tally:choice.tally,
      students:[...choice.students]
    }))
  });
  m._boardSetState=state=>{
    if(!state)return;
    students=Array.isArray(state.students)?state.students.map(String):[];
    if(Array.isArray(state.choices)&&state.choices.length){
      choices.splice(0,choices.length);
      choiceId=0;
      for(const saved of state.choices){
        const choice=createChoice(saved.name||'Choice');
        choice.imageSrc=saved.imageSrc||'';
        choice.tally=Math.max(0,Math.round(Number(saved.tally)||0));
        choice.students=Array.isArray(saved.students)?saved.students.filter(name=>students.includes(name)):[];
        choices.push(choice);
      }
    }
    setMode(state.mode==='names'?'names':'tally');
    renderChoices();
    renderPool();
  };

  const priorCleanup=m._cleanup;
  m._cleanup=()=>{priorCleanup?.();detachRosterLoader()};

  setupChoiceRosterDrawer(m);
  setMode('tally');
}
