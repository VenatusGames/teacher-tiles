function setupLunchCount(m){
  const grid=m.querySelector('.lunchcount-grid');
  const pool=m.querySelector('.lunchcount-name-pool');
  const poolList=m.querySelector('.lunchcount-pool-list');
  const summary=m.querySelector('.lunchcount-summary');
  const modeButtons=[...m.querySelectorAll('[data-lunch-mode-button]')];
  const nameInput=m.querySelector('.lunchcount-name-input');
  const addNameButton=m.querySelector('.lunchcount-add-name');
  const resetCounts=m.querySelector('.lunchcount-reset-counts');
  const resetNames=m.querySelector('.lunchcount-reset-names');
  const inlineActions=m.querySelector('.lunchcount-inline-actions');
  const picker=m.querySelector('.lunchcount-icon-picker');
  const pickerGrid=m.querySelector('.lunchcount-icon-picker__grid');
  const pickerClose=m.querySelector('.lunchcount-icon-picker__close');
  const pickerTitle=m.querySelector('.lunchcount-icon-picker__head strong');
  const iconUpload=m.querySelector('.lunchcount-icon-upload');

  let students=[];
  let draggedStudent='';
  let activeCategoryId='';
  let categoryId=0;

  const createCategory=(name,iconSrc,{kind='normal'}={})=>({
    id:`lunch-${++categoryId}`,name,iconSrc,kind,tally:0,students:[]
  });

  const categories=[
    createCategory('Absent','',{kind:'absent'}),
    createCategory('Main','assets/lunch-icons/30.png'),
    createCategory('Hot','assets/lunch-icons/33.png'),
    createCategory('Yogurt','assets/lunch-icons/34.png'),
    createCategory('PB&J','assets/lunch-icons/35.png'),
    createCategory('Packer','assets/lunch-icons/lunchbox.png',{kind:'packer'})
  ];

  const findCategory=id=>categories.find(category=>category.id===id);
  const assignment=name=>categories.find(category=>category.students.includes(name))?.id||'';

  const setMode=mode=>{
    const next=mode==='names'?'names':'tally';
    m.dataset.lunchMode=next;
    modeButtons.forEach(button=>{
      const active=button.dataset.lunchModeButton===next;
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    summary.textContent=next==='tally'
      ?'Tap a category to add a tally'
      :'Add names below, then drag them to a lunch choice';
    pool.hidden=next!=='names';
    resetCounts.hidden=next!=='tally';
    resetNames.hidden=next!=='names';
    inlineActions.classList.toggle('is-names',next==='names');
    renderCategories();
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
    categories.forEach(category=>{
      category.students=category.students.filter(student=>student!==name);
    });
    students=students.filter(student=>student!==name);
    renderCategories();
    renderPool();
    notifyBoardChanged('lunch-count-remove-student');
  };

  const assign=(name,targetId='')=>{
    categories.forEach(category=>{
      category.students=category.students.filter(student=>student!==name);
    });
    if(targetId){
      const target=findCategory(targetId);
      if(target&&!target.students.includes(name))target.students.push(name);
    }
    renderCategories();
    renderPool();
    notifyBoardChanged('lunch-count-assignment');
  };

  const studentChip=(name,{removable=false,unassignOnly=false}={})=>{
    const chip=document.createElement('div');
    chip.className='lunchcount-student-chip';
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
      if(m.dataset.lunchMode!=='names')return;
      event.preventDefault();
      element.classList.add('is-drop-target');
    });
    element.addEventListener('dragleave',event=>{
      if(!element.contains(event.relatedTarget))element.classList.remove('is-drop-target');
    });
    element.addEventListener('drop',event=>{
      if(m.dataset.lunchMode!=='names')return;
      event.preventDefault();
      element.classList.remove('is-drop-target');
      const name=draggedStudent||event.dataTransfer?.getData('text/plain');
      if(name&&students.includes(name))assign(name,targetId);
    });
  };

  const closePicker=()=>{
    activeCategoryId='';
    picker.hidden=true;
  };

  const openPicker=id=>{
    const category=findCategory(id);
    if(!category||category.kind!=='normal')return;
    activeCategoryId=id;
    pickerGrid.querySelectorAll('.lunchcount-icon-option').forEach(button=>{
      button.classList.toggle('is-selected',button.dataset.iconSrc===category.iconSrc);
    });
    picker.hidden=false;
  };

  const renderCategories=()=>{
    grid.replaceChildren();
    const namesMode=m.dataset.lunchMode==='names';

    categories.forEach((category,index)=>{
      const card=document.createElement('section');
      card.className='lunchcount-category';
      card.dataset.categoryKind=category.kind;
      if(namesMode)wireDrop(card,category.id);

      const controls=document.createElement('div');
      controls.className='lunchcount-category-controls';

      if(category.kind==='normal'){
        const remove=document.createElement('button');
        remove.type='button';
        remove.className='lunchcount-category-remove';
        remove.textContent='×';
        remove.title='Remove category';
        remove.setAttribute('aria-label',`Remove ${category.name}`);
        remove.addEventListener('click',event=>{
          event.stopPropagation();
          category.students.forEach(name=>assign(name,''));
          const categoryIndex=categories.indexOf(category);
          if(categoryIndex>=0)categories.splice(categoryIndex,1);
          renderCategories();
          renderPool();
        });
        controls.appendChild(remove);
      }

      const icon=document.createElement(category.kind==='normal'?'button':'div');
      if(category.kind==='normal')icon.type='button';
      icon.className='lunchcount-category-icon';

      if(category.kind==='absent'){
        icon.classList.add('is-empty');
        icon.innerHTML='<span aria-hidden="true">—</span>';
        icon.title='Absent does not use an icon';
      }else{
        const image=document.createElement('img');
        image.src=category.iconSrc;
        image.alt='';
        image.draggable=false;
        icon.appendChild(image);
      }

      if(category.kind==='normal'){
        icon.title='Change category icon';
        icon.addEventListener('click',event=>{
          event.stopPropagation();
          openPicker(category.id);
        });
      }
      if(category.kind==='packer')icon.title='Packer always uses the lunch box';

      const title=document.createElement('input');
      title.type='text';
      title.className='lunchcount-category-name';
      title.maxLength=22;
      title.value=category.name;
      title.addEventListener('click',event=>event.stopPropagation());
      title.addEventListener('input',()=>category.name=title.value);
      title.addEventListener('blur',()=>{
        category.name=title.value.trim()||`Choice ${index+1}`;
        title.value=category.name;
      });

      const count=document.createElement('strong');
      count.className='lunchcount-category-count';
      count.textContent=String(namesMode?category.students.length:category.tally);

      const content=document.createElement('div');
      content.className='lunchcount-category-content';

      if(namesMode){
        if(category.students.length){
          category.students.forEach(name=>content.appendChild(studentChip(name,{removable:true,unassignOnly:true})));
        }else{
          const empty=document.createElement('span');
          empty.className='lunchcount-category-empty';
          empty.textContent='Drop names here';
          content.appendChild(empty);
        }
      }else{
        const label=document.createElement('span');
        label.className='lunchcount-tally-label';
        label.textContent=category.tally===1?'student':'students';
        content.appendChild(label);

        const minus=document.createElement('button');
        minus.type='button';
        minus.className='lunchcount-tally-minus';
        minus.textContent='−';
        minus.disabled=category.tally<=0;
        minus.setAttribute('aria-label',`Remove one ${category.name} tally`);
        minus.addEventListener('click',event=>{
          event.stopPropagation();
          category.tally=Math.max(0,category.tally-1);
          renderCategories();
        });
        content.appendChild(minus);

        card.classList.add('is-tally');
        card.tabIndex=0;
        card.setAttribute('role','button');
        card.setAttribute('aria-label',`${category.name}: ${category.tally} students. Add one tally.`);

        const add=()=>{
          category.tally++;
          renderCategories();
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

      card.append(controls,icon,title,count,content);
      grid.appendChild(card);
    });

    const addCard=document.createElement('button');
    addCard.type='button';
    addCard.className='lunchcount-add-category-card';
    addCard.setAttribute('aria-label','Add lunch category');
    addCard.title='Add category';
    addCard.innerHTML='<span aria-hidden="true">+</span><small>Add Category</small>';
    addCard.addEventListener('click',()=>{
      categories.push(createCategory(`Choice ${categories.length+1}`,'assets/lunch-icons/30.png'));
      renderCategories();
      requestAnimationFrame(()=>{
        const titles=[...grid.querySelectorAll('.lunchcount-category-name')];
        titles.at(-1)?.focus({preventScroll:true});
        titles.at(-1)?.select();
      });
    });
    grid.appendChild(addCard);
  };

  const renderPool=()=>{
    requestAnimationFrame(()=>fitNameModuleToRoster(m,students.length,{namesPerRow:6,rowHeight:30,threshold:12}));
    poolList.replaceChildren();
    if(m.dataset.lunchMode!=='names')return;

    const unassigned=students.filter(name=>!assignment(name));

    if(!students.length){
      const empty=document.createElement('span');
      empty.className='lunchcount-pool-empty';
      empty.textContent='Add student names above';
      poolList.appendChild(empty);
      return;
    }

    if(!unassigned.length){
      const empty=document.createElement('span');
      empty.className='lunchcount-pool-empty';
      empty.textContent='Everyone has a lunch choice';
      poolList.appendChild(empty);
      return;
    }

    unassigned.forEach(name=>{
      poolList.appendChild(studentChip(name,{removable:true}));
    });
  };

  const uploadOption=document.createElement('button');
  uploadOption.type='button';
  uploadOption.className='lunchcount-icon-option lunchcount-icon-option--upload';
  uploadOption.innerHTML='<span class="lunchcount-upload-art" aria-hidden="true">↑</span><span>Upload image</span>';
  uploadOption.addEventListener('click',()=>iconUpload?.click());
  pickerGrid.appendChild(uploadOption);

  iconUpload?.addEventListener('change',async()=>{
    const file=iconUpload.files?.[0];
    const categoryId=activeCategoryId;
    iconUpload.value='';
    if(!file||!categoryId)return;
    pickerTitle.textContent='Preparing image…';
    const data=await fileToBoardImageData(file,{maxSide:480,maxLength:70000,quality:.72,minSide:180});
    const category=findCategory(categoryId);
    if(data&&category?.kind==='normal'){
      category.iconSrc=data;
      closePicker();
      renderCategories();
      notifyBoardChanged('lunch-count-image');
    }else{
      pickerTitle.textContent='Choose a smaller image';
      window.setTimeout(()=>{pickerTitle.textContent='Choose an icon';},1800);
    }
  });

  LUNCH_COUNT_ICONS.forEach(icon=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='lunchcount-icon-option';
    button.dataset.iconSrc=icon.src;

    const image=document.createElement('img');
    image.src=icon.src;
    image.alt='';
    image.draggable=false;

    const caption=document.createElement('span');
    caption.textContent=icon.label;

    button.append(image,caption);
    button.addEventListener('click',()=>{
      const category=findCategory(activeCategoryId);
      if(category&&category.kind==='normal'){
        category.iconSrc=icon.src;
        closePicker();
        renderCategories();
        notifyBoardChanged('lunch-count-image');
      }
    });
    pickerGrid.appendChild(button);
  });

  wireDrop(poolList,'');

  modeButtons.forEach(button=>{
    button.addEventListener('click',()=>setMode(button.dataset.lunchModeButton));
  });

  addNameButton.addEventListener('click',addStudent);
  nameInput.addEventListener('keydown',event=>{
    if(event.key==='Enter'){
      event.preventDefault();
      addStudent();
    }
  });

  resetCounts.addEventListener('click',()=>{
    categories.forEach(category=>category.tally=0);
    renderCategories();
  });

  resetNames.addEventListener('click',()=>{
    categories.forEach(category=>category.students=[]);
    renderCategories();
    renderPool();
  });

  pickerClose.addEventListener('click',closePicker);
  picker.addEventListener('pointerdown',event=>{
    if(event.target===picker)closePicker();
  });
  picker.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});

  m.querySelector('.lunchcount-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.lunchcount-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.lunchcount-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));

  const detachRosterLoader=attachClassRosterLoader(nameInput.closest('.lunchcount-name-entry'),rosterNames=>{
    students=normalizeRosterNames(rosterNames);
    categories.forEach(category=>category.students=[]);
    setMode('names');
    renderCategories();
    renderPool();
  });

  m._boardGetState=()=>({
    mode:m.dataset.lunchMode||'tally',
    students:[...students],
    categories:categories.map(category=>({
      name:category.name,
      iconSrc:category.iconSrc,
      kind:category.kind,
      tally:category.tally,
      students:[...category.students]
    }))
  });
  m._boardSetState=state=>{
    if(!state)return;
    students=Array.isArray(state.students)?state.students.map(String):[];
    if(Array.isArray(state.categories)&&state.categories.length){
      categories.splice(0,categories.length);
      categoryId=0;
      for(const saved of state.categories){
        const category=createCategory(saved.name||'Choice',saved.iconSrc||'',{kind:saved.kind||'normal'});
        category.tally=Math.max(0,Math.round(Number(saved.tally)||0));
        category.students=Array.isArray(saved.students)?saved.students.filter(name=>students.includes(name)):[];
        categories.push(category);
      }
    }
    setMode(state.mode==='names'?'names':'tally');
    renderCategories();
    renderPool();
  };

  setMode('tally');
  const priorCleanup=m._cleanup;
  m._cleanup=()=>{priorCleanup?.();detachRosterLoader()};
}
