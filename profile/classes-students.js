/* Unified class library, student profiles, and per-class PBIS preferences. */
function setupClassesStudents(){
  const opener=document.getElementById('profile-classes-button');if(!opener)return;
  const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
  const icons={pbis:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',assessment:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v3H9zM9 11h6M9 15h4"/>',connect:'<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M2 21v-3a6 6 0 0 1 12 0v3m2-7a5 5 0 0 1 6 5v2"/>',extras:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><path d="M14 17.5h7m-3.5-3.5v7"/>',pet:'<ellipse cx="12" cy="16" rx="5" ry="4"/><ellipse cx="5" cy="10" rx="2" ry="2.5"/><ellipse cx="10" cy="5" rx="2" ry="2.5"/><ellipse cx="16" cy="5" rx="2" ry="2.5"/><ellipse cx="20" cy="11" rx="2" ry="2.5"/>',borders:'<rect x="3" y="3" width="18" height="18" rx="4"/><rect x="6" y="6" width="12" height="12" rx="2"/>',podium:'<path d="M3 21V14h6V10h6v7h6v4H3Zm6-7v7m6-4v4M12 2v3M5 5l2 2m12-2-2 2"/>',back:'<path d="m14 6-6 6 6 6"/>',plus:'<path d="M12 5v14M5 12h14"/>',settings:'<path d="M9.6 3.8h4.8l.55 2.05c.55.2 1.08.5 1.55.88l2.05-.58 2.4 4.15-1.52 1.49c.05.3.07.61.07.93s-.02.63-.07.93l1.52 1.49-2.4 4.15-2.05-.58c-.47.38-1 .68-1.55.88l-.55 2.05H9.6l-.55-2.05a7 7 0 0 1-1.55-.88l-2.05.58-2.4-4.15 1.52-1.49a5.6 5.6 0 0 1 0-1.86L3.05 10.3l2.4-4.15 2.05.58c.47-.38 1-.68 1.55-.88l.55-2.05Z" fill="none" stroke="currentColor" stroke-width="1.55"/><circle cx="12" cy="12.72" r="2.6" fill="none" stroke="currentColor" stroke-width="1.6"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>'};
  const icon=name=>{const span=el('span','cs-icon');span.setAttribute('aria-hidden','true');if(name==='edit'){span.classList.add('cs-edit-pencil');span.textContent=document.getElementById('profile-nickname-edit')?.textContent.trim()||'✎';return span;}span.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[name]||icons.plus}</svg>`;return span;};
  const button=(label,action,cls='cs-button',symbol)=>{const b=el('button',cls);b.type='button';if(symbol)b.append(icon(symbol));b.append(el('span','',label));b.onclick=action;return b;};
  const panel=el('dialog','cs-tool');panel.id='profile-classes-panel';panel.setAttribute('aria-label','Class View');
  const top=el('header','cs-topbar'),brand=el('div','cs-brand');const brandIcon=opener.querySelector('.profile-tool-button__icon svg')?.cloneNode(true);if(brandIcon){brandIcon.classList.add('cs-tool-logo');brandIcon.setAttribute('aria-hidden','true');brand.append(brandIcon);}brand.append(el('strong','','Class View'),el('span','profile-tool-beta','BETA'));
  const topActions=el('div','cs-top-actions'),saveStatus=el('span','cs-save-status','Saved on this device');saveStatus.setAttribute('role','status');
  const profileBack=button('Profile',()=>{panel.addEventListener('close',()=>window.TeacherTilesAuth?.openProfile?.(),{once:true});panel.close();},'profile-tool-back','back');profileBack.setAttribute('aria-label','Back to profile');
  const exit=button('Back to Board',()=>panel.close(),'profile-tool-exit');topActions.append(saveStatus,exit);const topBrand=el('div','cs-top-brand');topBrand.append(profileBack,brand);top.append(topBrand,topActions);
  const content=el('main','cs-content'),classHeader=el('section','cs-class-header'),heading=el('div','cs-list-heading'),titleBox=el('div'),title=el('h1'),subtitle=el('p');titleBox.append(title,subtitle);
  const searchLabel=el('label','cs-search'),search=el('input');search.type='search';searchLabel.append(icon('search'),search);const listActions=el('div','cs-list-actions'),editRoster=button('Edit',e=>{e.stopPropagation();if(editMode||revealedStudent)endDeletion();else{editMode=true;syncDeletion();armDeletionIdle();}},'cs-button cs-roster-edit','edit');editRoster.setAttribute('aria-label','Edit students');listActions.append(searchLabel,editRoster);heading.append(titleBox,listActions);
  const grid=el('div','cs-grid');content.append(classHeader,heading,grid);panel.append(top,content);document.body.append(panel);
  const editor=el('dialog','cs-modal'),settings=el('dialog','cs-modal cs-settings'),detail=el('dialog','cs-modal cs-detail');document.body.append(editor,settings,detail);
  let editMode=false,revealedStudent='',holdTimer=0,deletionIdleTimer=0;
  const cancelHold=()=>{clearTimeout(holdTimer);holdTimer=0;};
  function syncDeletion(){
    editRoster.setAttribute('aria-pressed',String(editMode||Boolean(revealedStudent)));
    editRoster.lastElementChild.textContent=editMode||revealedStudent?'Done':'Edit';
    grid.querySelectorAll('.cs-student-entry').forEach(entry=>{
      const active=editMode||entry.dataset.studentKey===revealedStudent;
      entry.classList.toggle('is-removable',active);entry.querySelector('.cs-student-remove').hidden=!active;
    });
  }
  function endDeletion(){
    cancelHold();clearTimeout(deletionIdleTimer);deletionIdleTimer=0;editMode=false;revealedStudent='';syncDeletion();
  }
  function armDeletionIdle(){
    clearTimeout(deletionIdleTimer);deletionIdleTimer=0;
    if(editMode||revealedStudent)deletionIdleTimer=setTimeout(endDeletion,8000);
  }
  let visibleStudents=new Set(),activeClass='',activeStudent=null,scope=window.TeacherTilesClassScope||'local',photoTask=0;
  const notice=el('p','cs-notice');notice.setAttribute('role','status');panel.append(notice);let noticeTimer;
  function notify(message){clearTimeout(noticeTimer);notice.textContent=message;notice.classList.add('is-visible');noticeTimer=setTimeout(()=>notice.classList.remove('is-visible'),5000);}
  const current=()=>readClassRosters().find(c=>c.id===activeClass);
  function commit(change){
    try{
      if(scope!==(window.TeacherTilesClassScope||'local'))throw new Error('Your account changed. Reopen Class View to continue.');
      const classes=readClassRosters();change(classes);
      // Leave room for encrypted base64 overhead and future PBIS progress in the existing class document.
      if(new TextEncoder().encode(JSON.stringify(classes)).length>600000)throw new Error('Your class photo storage is full. Remove a photo or use an emoji to save this change.');
      writeClassRosters(classes);if(!window.TeacherTilesAuth?.user)saveStatus.textContent='Saved on this device';return true;
    }catch(error){return error.message||'Unable to save this change. Please try again.';}
  }
  const updateClass=change=>commit(classes=>{const c=classes.find(c=>c.id===activeClass);if(!c)throw new Error('This class is no longer available.');change(c);});
  function avatar(c,name,large=false){
    const profile=name?c.studentProfiles?.[starChartStudentKey(name)]:{image:c.logoImage},v=studentProfileVisual(name||c.name,c.id),node=el('span','cs-avatar'+(large?' cs-avatar-large':''));node.style.setProperty('--avatar-hue',v.hue);node.setAttribute('aria-hidden','true');
    if(profile?.image){const img=el('img');img.src=profile.image;img.alt='';img.decoding='async';img.loading='lazy';node.append(img);}else if(name&&!profile?.emoji){node.classList.add('cs-avatar-initials');node.append(el('span','cs-initials',v.initials));}else node.textContent=name?profile.emoji:normalizeClassLogo(c.logo);return node;
  }
  const statsFor=(c,whole=false)=>c.pbisEnabled===false?[]:PBIS_STUDENT_STAT_DEFINITIONS.filter(s=>c.pbisStats?.[s.id]!==false&&(!s.wholeClassOnly||whole)&&(!s.studentOnly||!whole));
  const statValue=(s,c,name)=>{if(!name)return s.wholeClassValue?.(c)||0;const key=starChartStudentKey(name),map={eggPoints:c.eggHatching?.studentPoints,flowerPoints:c.flowerPots?.studentPoints,stars:c.starChart?.studentStars,punchcardPoints:c.punchcards?.studentPoints,raceWins:c.racer?.studentWins};return normalizeStarChartCount(map[s.id]?.[key]);};
  function addCard(label,action){const b=button(label,action,'cs-add-card','plus');b.setAttribute('aria-label',label);return b;}
  function openClass(id){endDeletion();activeClass=id;search.value='';render();content.scrollTop=0;title.focus({preventScroll:true});}
  title.tabIndex=-1;
  function render(){
    cancelHold();const c=current();profileBack.hidden=Boolean(c);if(activeClass&&!c)activeClass='';editRoster.hidden=!c;editRoster.setAttribute('aria-pressed',String(editMode||Boolean(revealedStudent)));editRoster.lastElementChild.textContent=editMode||revealedStudent?'Done':'Edit';classHeader.replaceChildren();classHeader.hidden=!c;grid.replaceChildren();
    title.textContent=c?'Students':'Your Classes';subtitle.textContent=c?`${c.students.length} ${c.students.length===1?'student':'students'}`:'';subtitle.hidden=!c;grid.classList.toggle('cs-students-grid',Boolean(c));search.placeholder=c?'Search students':'Search classes';search.setAttribute('aria-label',search.placeholder);
    if(c){
      const back=button('All Classes',()=>openClass(''),'cs-button cs-back','back');
      const info=el('div','cs-class-info'),copy=el('div');copy.append(el('h2','',c.name),el('p','',`${c.students.length} ${c.students.length===1?'student':'students'}`));const edit=button('',e=>{if(e.detail>0)editor.addEventListener('close',()=>{if(document.activeElement===edit)edit.blur();},{once:true});editClass(c.id);},'cs-class-info-edit profile-panel__close','edit');edit.setAttribute('aria-label','Edit Class');edit.title='Edit Class';info.append(avatar(c),copy,edit);
      const rewards=button('PBIS',()=>showDetail(null),'cs-button cs-class-pbis','pbis');rewards.setAttribute('aria-label','View whole-class PBIS rewards');rewards.hidden=c.pbisEnabled===false;
      const modules=el('div','cs-class-modules');
      for(const [label,symbol] of [['Assessment','assessment'],['ClassConnect','connect']]){const b=button(label,null,'cs-button cs-class-coming-soon',symbol);b.disabled=true;b.append(el('small','','Coming soon'));modules.append(b);}
      modules.append(rewards);
      const configure=button('',showSettings,'cs-button cs-class-settings','settings');configure.setAttribute('aria-label','Class Settings');configure.title='Class Settings';classHeader.append(back,info,modules,configure);
      const names=c.students.filter(n=>n.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase()));
      for(const [index,name] of names.entries()){
        const entry=el('div','cs-student-entry'),key=starChartStudentKey(name);let suppressClick=false;
        const card=button('',e=>{if(suppressClick){e.preventDefault();e.stopPropagation();suppressClick=false;return;}if(editMode||revealedStudent){endDeletion();return;}showDetail(name);},'cs-student-card');
        card.setAttribute('aria-label',`Open ${name}'s student profile`);card.replaceChildren(avatar(c,name),el('strong','cs-card-name',name));
        entry.dataset.studentKey=key;entry.classList.toggle('is-removable',editMode||revealedStudent===key);
        const remove=button('',e=>{e.stopPropagation();clearTimeout(deletionIdleTimer);removeStudent(c.id,name);armDeletionIdle();},'cs-student-remove profile-panel__close','close');remove.setAttribute('aria-label',`Remove ${name}`);remove.title=`Remove ${name}`;remove.hidden=!editMode&&revealedStudent!==key;
        let origin=null;
        card.addEventListener('pointerdown',e=>{
          if(e.button!==0||!e.isPrimary)return;cancelHold();suppressClick=false;origin={x:e.clientX,y:e.clientY};
          holdTimer=setTimeout(()=>{holdTimer=0;if(!card.isConnected||current()?.id!==c.id)return;suppressClick=true;revealedStudent=key;syncDeletion();armDeletionIdle();},650);
        });
        card.addEventListener('pointermove',e=>{if(origin&&Math.hypot(e.clientX-origin.x,e.clientY-origin.y)>10)cancelHold();});
        for(const event of ['pointerup','pointercancel','pointerleave','lostpointercapture'])card.addEventListener(event,cancelHold);
        card.addEventListener('contextmenu',e=>e.preventDefault());
        if(!visibleStudents.has(c.id+':'+key)){card.classList.add('is-entering');card.style.setProperty('--student-enter-delay',Math.min(index,6)*35+'ms');}
        entry.append(card,remove);grid.append(entry);
      }
      visibleStudents=new Set(names.map(name=>c.id+':'+starChartStudentKey(name)));
      if(c.showAddStudent!==false)grid.append(addCard('Add Student',()=>editStudent()));
      if(!names.length)grid.append(el('p','cs-empty',c.students.length?'No students match your search.':c.showAddStudent===false?'Turn on Show Add Student in Class Settings to add your first student.':'Add your first student using a first name or nickname.'));
    }else{
      visibleStudents.clear();
      const classes=readClassRosters().filter(c=>c.name.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase()));
      for(const c of classes){
        const card=el('article','cs-class-card'),open=button('',()=>openClass(c.id),'cs-class-open');open.setAttribute('aria-label',`Open ${c.name}`);open.replaceChildren(avatar(c),el('strong','cs-card-name',c.name),el('small','',`${c.students.length} ${c.students.length===1?'student':'students'}`));
        if(c.gradeLevel)open.append(el('small','cs-class-grade',/^\d+$/.test(c.gradeLevel)?`Grade ${c.gradeLevel}`:c.gradeLevel));
        const edit=button('',e=>{if(e.detail>0)editor.addEventListener('close',()=>{if(document.activeElement===edit)edit.blur();},{once:true});editClass(c.id);},'cs-card-edit','edit');edit.setAttribute('aria-label',`Edit ${c.name}`);edit.title='Edit Class';card.append(open,edit);grid.append(card);
      }
      grid.append(addCard('New Class',()=>editClass()));
      if(!classes.length)grid.append(el('p','cs-empty',search.value?'No classes match your search.':'Create your first class to get started.'));
    }
  }
  function removeStudent(classId,name){
    const c=current();if(!c||c.id!==classId||!c.students.includes(name))return;
    if(!confirm(`Remove ${name} from ${c.name}? Their profile and individual PBIS progress will be deleted.`))return;
    const result=updateClass(target=>{
      if(target.id!==classId)throw new Error('The selected class changed. Reopen this student.');
      const key=starChartStudentKey(name);target.students=target.students.filter(n=>n!==name);delete target.studentProfiles[key];
      for(const [kind,fields] of [['starChart',['studentStars']],['punchcards',['studentPoints','studentProgress']],['eggHatching',['studentPoints','studentProgress']],['flowerPots',['studentPoints','studentProgress']],['racer',['positions','studentWins','finished']]]){
        for(const field of fields){const values=target[kind]?.[field];if(values){delete values[key];delete values[name];}}
      }
    });
    if(result!==true){notify(result);return;}revealedStudent='';render();editRoster.focus({preventScroll:true});notify(`${name} removed`);
  }
  function modalHeader(dialog,label){dialog.replaceChildren();dialog.setAttribute('aria-label',label);const head=el('header','cs-modal-header'),h=el('h2','',label),close=button('',()=>dialog.close(),'cs-close profile-panel__close','close');close.setAttribute('aria-label',`Close ${label}`);head.append(h,close);dialog.append(head);}
  function field(label,value,max){const holder=el('label','cs-field'),input=el('input');input.type='text';input.required=true;input.maxLength=max;input.value=value;input.setAttribute('aria-label',label);holder.append(el('span','',label),input);return{holder,input};}
  function emojiPicker(selected,onChange){
    const box=el('fieldset','cs-emoji-picker');box.append(el('legend','','Choose an emoji'));const choices=el('div','cs-emoji-options');
    const options=[...CLASS_LOGO_OPTIONS.map(o=>o.symbol),'🐸','🦋','🐱','🐶','🦊','🐼','🐙','🌻','🍀','⚽','🎵','📚'];
    for(const emoji of options){const b=button(emoji,()=>choose(emoji),'cs-emoji');b.setAttribute('aria-label',`Use ${emoji}`);b.dataset.emoji=emoji;b.setAttribute('aria-pressed',String(selected===emoji));choices.append(b);}
    const custom=field('Custom emoji',options.includes(selected)?'':selected,16);custom.input.required=false;custom.input.placeholder='Type or paste an emoji';custom.input.addEventListener('input',()=>choose(custom.input.value,false));
    function choose(value,reset=true){selected=value?normalizeClassLogo(value):'';choices.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.emoji===selected)));if(reset)custom.input.value='';onChange(selected);}
    box.append(choices,custom.holder);return box;
  }
  function editClass(id=''){
    const c=readClassRosters().find(c=>c.id===id);if(id&&!c)return;modalHeader(editor,c?'Edit Class':'New Class');
    const form=el('form','cs-form'),name=field('Class name',c?.name||'',50),preview=el('div','cs-form-preview');let emoji=c?.logo||'👥',image=c?.logoImage||'';
    const gradeField=el('label','cs-field'),grade=el('select');grade.setAttribute('aria-label','Class grade level');gradeField.append(el('span','','Grade Level'),grade);
    const unset=el('option','','Not set');unset.value='';grade.append(unset);for(const value of CLASS_GRADE_LEVELS){const option=el('option','',value);option.value=value;grade.append(option);}grade.value=c?.gradeLevel||'';
    const gradeHint=el('small','cs-muted');gradeHint.hidden=Boolean(c);const updateGradeHint=()=>{gradeHint.textContent=defaultClassPbisEnabled(grade.value)?'PBIS starts on. You can change it in Class Settings.':'PBIS starts off for grade 7 and above. You can turn it on in Class Settings.';};grade.addEventListener('change',updateGradeHint);updateGradeHint();gradeField.append(gradeHint);
    const paint=()=>{preview.replaceChildren();if(image){const img=el('img');img.src=image;img.alt='Class image preview';preview.append(img);}else preview.textContent=emoji;};paint();
    const error=el('p','cs-error');error.setAttribute('role','alert');const actions=el('div','cs-form-actions'),save=button(c?'Save Changes':'Create Class',null,'cs-button cs-primary');save.type='submit';actions.append(button('Cancel',()=>editor.close()),save);
    if(c)actions.prepend(button('Delete Class',()=>{if(!confirm(`Delete ${c.name}, its roster, and all saved PBIS history?`))return;const result=commit(classes=>{const i=classes.findIndex(t=>t.id===c.id);if(i>=0)classes.splice(i,1);});if(result!==true){error.textContent=result;return;}editor.close();if(detail.open)detail.close();if(settings.open)settings.close();openClass('');notify('Class deleted');},'cs-button cs-danger'));
    const picker=emojiPicker(image?'':emoji,value=>{photoTask++;emoji=value||'👥';image='';file.value='';save.disabled=false;error.textContent='';paint();}),file=el('input');file.type='file';file.accept='image/png,image/jpeg,image/webp,image/gif';file.hidden=true;file.setAttribute('aria-label','Upload class image');
    const photoActions=el('div','cs-photo-actions');photoActions.append(button('Upload Image',()=>file.click()),button('Use Emoji',()=>{photoTask++;image='';file.value='';save.disabled=false;error.textContent='';paint();picker.querySelectorAll('[data-emoji]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.emoji===emoji)));}),file);
    form.append(preview,name.holder,gradeField,picker,photoActions,el('small','cs-muted','Images are cropped to a square and resized automatically.'),error,actions);editor.append(form);
    file.onchange=async()=>{const chosen=file.files?.[0];if(!chosen)return;const task=++photoTask;save.disabled=true;error.textContent='Resizing image…';try{const data=await compactPhoto(chosen);if(task!==photoTask||!editor.open)return;image=data;paint();picker.querySelectorAll('[data-emoji]').forEach(b=>b.setAttribute('aria-pressed','false'));error.textContent='';}catch(e){if(task===photoTask)error.textContent=e.message;}finally{if(task===photoTask)save.disabled=false;}};
    form.onsubmit=e=>{e.preventDefault();if(save.disabled)return;const clean=name.input.value.trim().replace(/\s+/g,' ');if(!clean){error.textContent='Enter a class name.';return;}
      const result=commit(classes=>{if(c){const target=classes.find(v=>v.id===id);if(!target)throw new Error('This class is no longer available.');target.name=clean;target.logo=emoji;target.logoImage=image;target.gradeLevel=normalizeClassGradeLevel(grade.value);}else classes.push({id:classRosterId(),name:clean,logo:emoji,logoImage:image,gradeLevel:normalizeClassGradeLevel(grade.value),students:[],studentProfiles:{},pbisEnabled:defaultClassPbisEnabled(grade.value),pbisStats:readStudentViewStatPreferences()});});
      if(result!==true){error.textContent=result;return;}editor.close();render();renderDetail();notify(c?'Class updated':'Class created');};editor.showModal();name.input.focus();
  }
  async function compactPhoto(file){
    if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type))throw new Error('Choose a PNG, JPG, WebP, or GIF image.');if(file.size>12*1024*1024)throw new Error('Choose an image smaller than 12 MB.');
    const url=URL.createObjectURL(file),img=new Image();
    try{
      img.src=url;await img.decode();const size=Math.min(img.naturalWidth,img.naturalHeight),canvas=document.createElement('canvas');
      // Keep enough pixels for the enlarged profile on high-density displays.
      for(const edge of [256,224,192]){
        const pixels=Math.min(edge,size);canvas.width=canvas.height=pixels;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
        ctx.drawImage(img,(img.naturalWidth-size)/2,(img.naturalHeight-size)/2,size,size,0,0,pixels,pixels);
        for(const quality of [.92,.86,.8]){const data=canvas.toDataURL('image/webp',quality);if(data.length<=STUDENT_PROFILE_IMAGE_MAX_LENGTH)return data;}
      }
      throw new Error('This image could not be resized. Try another image.');
    }finally{URL.revokeObjectURL(url);}

  }
  function editStudent(oldName=''){
    const c=current();if(!c)return;if(oldName&&!c.students.includes(oldName))return;const classId=c.id,original=c.studentProfiles?.[starChartStudentKey(oldName)]||{};let emoji=original.emoji||'',image=original.image||'';
    modalHeader(editor,oldName?'Edit Student':'Add Student');const form=el('form','cs-form'),name=field('Student first name or nickname',oldName,60),preview=el('div','cs-form-preview'),error=el('p','cs-error');error.setAttribute('role','alert');
    const paint=()=>{preview.replaceChildren();preview.classList.toggle('cs-avatar-initials',!image&&!emoji);if(image){const img=el('img');img.src=image;img.alt='Student image preview';preview.append(img);}else if(emoji)preview.textContent=emoji;else preview.append(el('span','cs-initials',studentProfileVisual(name.input.value).initials));};paint();name.input.addEventListener('input',paint);
    const picker=emojiPicker(emoji,value=>{photoTask++;emoji=value;image='';file.value='';save.disabled=false;error.textContent='';paint();}),file=el('input');file.type='file';file.accept='image/png,image/jpeg,image/webp,image/gif';file.hidden=true;file.setAttribute('aria-label','Upload student image');
    const photoActions=el('div','cs-photo-actions');photoActions.append(button('Upload Image',()=>file.click()),button('Use Initials',()=>{photoTask++;emoji='';image='';save.disabled=false;error.textContent='';paint();picker.querySelectorAll('[data-emoji]').forEach(b=>b.setAttribute('aria-pressed','false'));}),file);
    const actions=el('div','cs-form-actions'),save=button(oldName?'Save Changes':'Add Student',null,'cs-button cs-primary');save.type='submit';actions.append(button('Cancel',()=>editor.close()),save);
    form.append(preview,name.holder,picker,photoActions,el('small','cs-muted','Images are cropped to a square and resized automatically.'),error,actions);editor.append(form);
    file.onchange=async()=>{const chosen=file.files?.[0];if(!chosen)return;const task=++photoTask;save.disabled=true;error.textContent='Resizing image…';try{const data=await compactPhoto(chosen);if(task!==photoTask||!editor.open)return;image=data;emoji='';paint();picker.querySelectorAll('[data-emoji]').forEach(b=>b.setAttribute('aria-pressed','false'));error.textContent='';}catch(e){if(task===photoTask)error.textContent=e.message;}finally{if(task===photoTask)save.disabled=false;}};
    form.onsubmit=e=>{e.preventDefault();if(save.disabled)return;const clean=name.input.value.trim().replace(/\s+/g,' ');if(!clean){error.textContent='Enter a first name or nickname.';return;}
      const result=updateClass(target=>{if(target.id!==classId)throw new Error('The selected class changed. Reopen this student.');if(target.students.some(n=>n!==oldName&&n.toLocaleLowerCase()===clean.toLocaleLowerCase()))throw new Error('A student with that name already exists in this class.');if(!oldName&&target.students.length>=300)throw new Error('This class already has 300 students.');
        if(oldName){if(!target.students.includes(oldName))throw new Error('This student is no longer in the class.');renameClassStudent(target,oldName,clean);}else target.students.push(clean);
        target.studentProfiles[starChartStudentKey(clean)]={emoji,image};});
      if(result!==true){error.textContent=result;return;}if(activeStudent?.name===oldName){activeStudent.name=clean;renderDetail();}editor.close();render();notify(oldName?'Student updated':'Student added');};
    editor.showModal();name.input.focus();
  }
  function toggle(label,checked,action,description=''){
    const row=el('label','cs-toggle'),copy=el('span');copy.append(el('strong','',label));if(description)copy.append(el('small','',description));const input=el('input');input.type='checkbox';input.checked=checked;input.setAttribute('role','switch');input.setAttribute('aria-label',label);input.onchange=()=>action(input.checked,input);const track=el('i');track.setAttribute('aria-hidden','true');row.append(copy,input,track);return row;
  }
  function showSettings(){
    const c=current();if(!c)return;modalHeader(settings,'Class Settings');
    const body=el('div','cs-settings-body'),pbisGroup=el('div','cs-pbis-group'),disclosure=el('details','cs-pbis-disclosure'),statOptions=el('fieldset','cs-pbis-options'),error=el('p','cs-error');
    error.setAttribute('role','alert');statOptions.setAttribute('aria-label','PBIS reward types');disclosure.open=true;disclosure.hidden=!c.pbisEnabled;
    const summary=el('summary','','Reward Types');disclosure.append(summary,statOptions);
    body.append(toggle('Show Add Student',c.showAddStudent!==false,(enabled,input)=>{const result=updateClass(target=>target.showAddStudent=enabled);if(result!==true){input.checked=!enabled;error.textContent=result;}},'Show the + outline at the end of the student list.'));
    pbisGroup.append(toggle('Enable PBIS',c.pbisEnabled,(enabled,input)=>{const result=updateClass(target=>target.pbisEnabled=enabled);if(result!==true){input.checked=!enabled;error.textContent=result;return;}disclosure.hidden=!enabled;renderDetail();},'Show class and student reward totals. Turning this off keeps their saved progress.'),disclosure);
    for(const stat of PBIS_STUDENT_STAT_DEFINITIONS)statOptions.append(toggle(stat.label,c.pbisStats[stat.id]!==false,(enabled,input)=>{const result=updateClass(target=>target.pbisStats[stat.id]=enabled);if(result!==true){input.checked=!enabled;error.textContent=result;}renderDetail();},stat.wholeClassOnly?(stat.wholeClassDescription||stat.description):stat.description));
    const actions=el('div','cs-settings-actions');actions.append(button('Edit Class Name & Logo',()=>{settings.close();editClass(c.id);},'cs-button','edit'));
    body.append(pbisGroup,error,actions);settings.append(body);settings.showModal();
  }
  function rewardIcon(stat){
    const modules={eggPoints:'egghatching',flowerPoints:'flowerpots',stars:'starchart',punchcardPoints:'punchcards',raceWins:'racer',meterWins:'classmeter',jarsFilled:'collections'};
    const holder=el('span','cs-stat-icon');holder.setAttribute('aria-hidden','true');
    const source=document.querySelector(`.context-menu__item[data-module="${modules[stat.id]}"] .context-menu__icon svg`);
    holder.append(source?source.cloneNode(true):icon('pbis'));return holder;
  }
  function setStatValue(target,stat,name,value){
    const key=starChartStudentKey(name),whole=!name;
    if(stat.id==='stars'){if(whole)target.starChart.wholeClassStars=value;else target.starChart.studentStars[key]=value;}
    else if(stat.id==='punchcardPoints'){if(whole)target.punchcards.wholeClassPoints=value;else target.punchcards.studentPoints[key]=value;}
    else if(stat.id==='eggPoints'||stat.id==='flowerPoints')target[stat.id==='eggPoints'?'eggHatching':'flowerPots'].studentPoints[key]=value;
    else if(stat.id==='raceWins')target.racer.studentWins[key]=value;
    else if(stat.id==='meterWins')target.classMeter.wins=value;
    else if(stat.id==='jarsFilled')target.collectionJar.jarsFilled=value;
  }
  function checkRewardTarget(target,c,stat,name){
    if(target.id!==c.id||(name&&!target.students.includes(name)))throw new Error('This profile is no longer available. Reopen it to continue.');
    if(!statsFor(target,!name).some(s=>s.id===stat.id))throw new Error('This reward is turned off in Class Settings.');
  }
  function adjustStat(stat,c,name,redeem=false){
    const action=redeem?'Redeem':'Add';modalHeader(editor,`${action} ${stat.label}`);
    const form=el('form','cs-form'),amount=field('Amount','1',4),error=el('p','cs-error');error.setAttribute('role','alert');
    amount.input.type='number';amount.input.min='1';amount.input.max='9999';amount.input.step='1';
    const balance=el('p','cs-reward-balance',`${name||c.name} · Current balance: ${statValue(stat,c,name)}`);
    const actions=el('div','cs-form-actions'),save=button(action,null,'cs-button cs-primary');save.type='submit';
    actions.append(button('Cancel',()=>editor.close()),save);form.append(balance,amount.holder,error,actions);editor.append(form);
    form.onsubmit=e=>{
      e.preventDefault();const quantity=Number(amount.input.value);
      if(!Number.isSafeInteger(quantity)||quantity<1||quantity>9999){error.textContent='Enter a whole number from 1 to 9999.';return;}
      const result=updateClass(target=>{
        checkRewardTarget(target,c,stat,name);
        // Read the latest earned balance; leave in-progress tile rewards untouched.
        const current=statValue(stat,target,name),next=current+(redeem?-quantity:quantity);
        if(next<0)throw new Error(`Only ${current} available to redeem.`);
        if(next>9999)throw new Error('The balance cannot exceed 9999.');
        setStatValue(target,stat,name,next);
      });
      if(result!==true){error.textContent=result;return;}editor.close();renderDetail();
    };
    editor.showModal();amount.input.focus();amount.input.select();
  }
  function resetStat(stat,c,name){
    if(!confirm(`Reset ${stat.label} for ${name||c.name}? This cannot be undone.`))return;
    const result=updateClass(target=>{checkRewardTarget(target,c,stat,name);setStatValue(target,stat,name,0);});
    if(result!==true)notify(result);else renderDetail();
  }
  function renderDetail(animate=false){
    if(!detail.open||!activeStudent)return;
    const c=current(),name=activeStudent.name;
    if(!c||(name&&!c.students.includes(name))){detail.close();return;}
    const focusKey=detail.contains(document.activeElement)?document.activeElement.dataset.detailFocus:null;
    const scroll=detail.scrollTop;
    modalHeader(detail,name?'Student Profile':'Whole-Class Rewards');
    const layout=el('div','cs-profile-layout'),hero=el('aside','cs-detail-hero');
    hero.append(avatar(c,name,true),el('h3','',name||c.name),el('p','cs-muted',name?c.name:'Whole class'));
    if(name){const edit=button('Edit Student',()=>editStudent(name),'cs-button cs-detail-edit','edit');edit.dataset.detailFocus='edit';hero.append(edit);}
    const body=el('section','cs-profile-body'+(animate?' is-entering':''));
    const view=activeStudent.view||'home';
    function navigate(next){activeStudent.view=next;renderDetail(true);detail.querySelector('.cs-profile-title')?.focus({preventScroll:true});}
    const title=el('h3','cs-profile-title',view==='pbis'?'PBIS Rewards':view==='extras'?'Extras':'Student Profile');title.tabIndex=-1;
    if(name&&view!=='home'){const back=button('Student Profile',()=>navigate('home'),'cs-button cs-profile-back','back');back.dataset.detailFocus='back';back.setAttribute('aria-label','Student Profile');const head=detail.querySelector('.cs-modal-header');head.prepend(back);head.querySelector('h2').textContent=view==='pbis'?'PBIS Rewards':'Extras';}
    body.append(title);
    function sectionButton(label,symbol,action,status=''){
      const b=button('',action,'cs-profile-section',symbol),copy=el('span','cs-section-copy');
      b.lastElementChild.remove();copy.append(el('strong','',label));if(status)copy.append(el('small','cs-section-status',status));b.append(copy);
      b.dataset.detailFocus=symbol;b.disabled=!action;return b;
    }
    if(view==='home'){
      const sections=el('div','cs-profile-sections');
      sections.append(sectionButton('PBIS','pbis',c.pbisEnabled?()=>navigate('pbis'):null,c.pbisEnabled?'View rewards':'Off in Class Settings'),sectionButton('Assessments','assessment',null,'Coming soon'),sectionButton('ClassConnect','connect',null,'Coming soon'),sectionButton('Extras','extras',()=>navigate('extras')));
      body.append(sections);
    }else if(view==='extras'){
      const sections=el('div','cs-profile-sections');sections.append(sectionButton('Student Pets','pet',null,'Coming soon'),sectionButton('Profile Borders','borders',null,'Coming soon'),sectionButton('Podium Effects','podium',null,'Coming soon'));body.append(sections);
    }else if(c.pbisEnabled){
      const stats=el('div','cs-detail-stats');stats.setAttribute('aria-label','PBIS rewards');
      for(const [index,stat] of statsFor(c,!name).entries()){
        const row=el('article','cs-stat'),count=statValue(stat,c,name),label=el('h4','',stat.label),value=el('strong','cs-stat-value',String(count));
        row.style.setProperty('--stat-hue',[38,265,150,205,340,22,180][index%7]);
        row.setAttribute('aria-label',stat.label);value.setAttribute('aria-live','polite');
        const symbol=rewardIcon(stat),actions=el('div','cs-stat-actions');
        const add=button('Add',()=>adjustStat(stat,c,name),'cs-button'),redeem=button('Redeem',()=>adjustStat(stat,c,name,true),'cs-button');
        add.setAttribute('aria-label',`Add ${stat.label}`);redeem.setAttribute('aria-label',`Redeem ${stat.label}`);add.dataset.detailFocus='add-'+stat.id;redeem.dataset.detailFocus='redeem-'+stat.id;redeem.disabled=!count;add.disabled=count>=9999;
        const reset=button('Reset',()=>resetStat(stat,c,name),'cs-button');reset.disabled=!count;reset.setAttribute('aria-label',`Reset ${stat.label}`);reset.dataset.detailFocus='reset-'+stat.id;
        actions.append(add,redeem,reset);row.append(symbol,value,label,el('p','cs-stat-description',name?stat.description:stat.wholeClassDescription||stat.description),actions);stats.append(row);
      }
      if(!stats.children.length)stats.append(el('p','cs-muted','No reward types selected in Class Settings.'));
      body.append(stats);
    }else body.append(el('p','cs-muted','PBIS is turned off in Class Settings. Your saved progress is kept.'));
    layout.append(hero,body);detail.append(layout);detail.scrollTop=scroll;
    if(focusKey&&!animate)Array.from(detail.querySelectorAll('[data-detail-focus]')).find(b=>b.dataset.detailFocus===focusKey)?.focus({preventScroll:true});
  }
  function showDetail(name){activeStudent={name,view:name?'home':'pbis'};detail.showModal();renderDetail();detail.scrollTop=0;detail.querySelector('.cs-close')?.focus();}
  search.addEventListener('input',render);
  opener.addEventListener('click',()=>{document.querySelector('[data-profile-close]')?.click();scope=window.TeacherTilesClassScope||'local';activeClass='';editMode=false;revealedStudent='';search.value='';render();panel.showModal();opener.setAttribute('aria-expanded','true');document.body.classList.add('classes-tool-open');});
  content.addEventListener('scroll',cancelHold,{passive:true});
  window.addEventListener('blur',()=>{cancelHold();if(panel.open)endDeletion();});
  panel.addEventListener('click',e=>{if((editMode||revealedStudent)&&!e.target.closest('.cs-student-remove,.cs-roster-edit'))endDeletion();});
  for(const event of ['pointerdown','pointermove','keydown','input','wheel'])panel.addEventListener(event,()=>{if(editMode||revealedStudent)armDeletionIdle();},{passive:true});
  panel.addEventListener('close',()=>{endDeletion();for(const d of [editor,settings,detail])if(d.open)d.close();flushPbisCloudSave();document.body.classList.remove('classes-tool-open');opener.setAttribute('aria-expanded','false');document.getElementById('profile-toggle')?.focus({preventScroll:true});});
  panel.addEventListener('cancel',e=>{e.preventDefault();if(editMode||revealedStudent){endDeletion();return;}if(activeClass)openClass('');else panel.close();});
  for(const d of [panel,editor,settings,detail])d.addEventListener('keydown',e=>e.stopPropagation());
  for(const d of [editor,settings,detail])d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();});
  editor.addEventListener('close',()=>photoTask++);detail.addEventListener('close',()=>activeStudent=null);
  function refresh(){if(!panel.open)return;const next=window.TeacherTilesClassScope||'local';if(scope!==next){scope=next;activeClass='';endDeletion();for(const d of [editor,settings,detail])if(d.open)d.close();saveStatus.textContent='Saved on this device';}render();if(!editor.open)renderDetail();}
  for(const event of ['teachertiles:classeschange','teachertiles:starchartchange','teachertiles:classmeterchange','teachertiles:collectionchange','teachertiles:punchcardchange','teachertiles:racerchange'])window.addEventListener(event,refresh);
  window.addEventListener('teachertiles:classsavestatus',event=>{if(event.detail?.scope!==scope)return;saveStatus.textContent=({saving:'Saving…',saved:'Saved',error:'Saved on this device · sync pending'})[event.detail.status]||'';});
}
