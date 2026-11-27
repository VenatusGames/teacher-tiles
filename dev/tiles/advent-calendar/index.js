(() => {
  'use strict';
  if(window.TeacherTilesAdvent)return;
  const themes={cranberry:['#7b2134','#ae384c','#e5ba77'],evergreen:['#174f44','#2e7964','#e1c58c'],midnight:['#233858','#3e5980','#d7c38d'],frost:['#5b839b','#a3c5d6','#f5ead5'],sugarplum:['#634674','#96729d','#f2d1b0']};
  const icons=['🎁','⭐','❄️','🎄','🍪','🎨','📚','🎉'];
  const imagePattern=/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
  const safeText=(v,n)=>String(v??'').slice(0,n);
  function dayCount(value){return Number.isFinite(Number(value))?Math.max(1,Math.min(24,Math.round(Number(value)))):24;}
  function normalize(raw={}) {
    if(!raw||typeof raw!=='object')raw={};
    return {version:1,title:safeText(raw.title||'Advent Calendar',60),days:dayCount(raw.days),theme:Object.hasOwn(themes,raw.theme)?raw.theme:'cranberry',style:['panels','ribbons','stars'].includes(raw.style)?raw.style:'panels',font:['classic','elegant','playful'].includes(raw.font)?raw.font:'elegant',seed:Math.max(0,Math.min(99999,Math.floor(Number(raw.seed)||0))),cards:Array.from({length:24},(_,i)=>{
      const c=raw.cards?.[i]||{},image=String(c.image||'');
      return {title:safeText(c.title,80),text:safeText(c.text,500),image:image.length<=18000&&imagePattern.test(image)?image:'',emoji:icons.includes(c.emoji)?c.emoji:'🎁',color:/^#[0-9a-f]{6}$/i.test(c.color||'')?c.color:'',layout:['portrait','postcard','spotlight'].includes(c.layout)?c.layout:'portrait',fit:c.fit==='cover'?'cover':'contain',opened:c.opened===true};
    })};
  }
  function random(seed){let n=seed+31;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
  function layout(count) {
    const rects=[{x:0,y:0,w:12,h:12}],rng=random(7);
    while(rects.length<count){
      rects.sort((a,b)=>b.w*b.h-a.w*a.h);
      const index=rects.findIndex(r=>r.w>=4||r.h>=4),r=rects.splice(index,1)[0];
      const vertical=r.w>=4&&(r.h<4||r.w>r.h||r.w===r.h&&rng()>.45);
      const length=vertical?r.w:r.h,cut=Math.max(2,Math.min(length-2,Math.round(length/4)*2+(length>=8&&rng()>.55?2:0)));
      rects.push(vertical?{...r,w:cut}:{...r,h:cut},vertical?{...r,x:r.x+cut,w:r.w-cut}:{...r,y:r.y+cut,h:r.h-cut});
    }
    return rects.sort((a,b)=>a.y-b.y||a.x-b.x);
  }
  function order(state){const ids=Array.from({length:state.days},(_,i)=>i);if(state.seed){const rng=random(state.seed);for(let i=ids.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}}return ids;}
  function make(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;}
  function button(text,cls){const el=make('button',cls,text);el.type='button';return el;}
  function paint(m,state,select) {
    const [dark,main,gold]=themes[state.theme];m.style.setProperty('--advent-dark',dark);m.style.setProperty('--advent-main',main);m.style.setProperty('--advent-gold',gold);m.dataset.adventStyle=state.style;m.dataset.adventFont=state.font;
    m.querySelector('.advent-heading').textContent=state.title;
    const grid=m.querySelector('.advent-grid');grid.replaceChildren();const positions=layout(state.days),numbers=order(state);
    positions.forEach((r,i)=>{
      const index=numbers[i],card=state.cards[index],door=button('','advent-door');door.dataset.day=index;door.style.gridArea=`${r.y+1} / ${r.x+1} / span ${r.h} / span ${r.w}`;
      door.setAttribute('aria-label',`December ${index+1}${card.opened?', Opened':''}`);door.classList.toggle('is-opened',card.opened);if(card.color)door.style.setProperty('--door-color',card.color);
      const inside=make('span','advent-door-inside',card.opened?'✓':'✦'),front=make('span','advent-door-front');front.append(make('span','advent-day',index+1),make('i','advent-handle'));door.append(inside,front);
      if(select)door.onclick=()=>select(index,door);else door.tabIndex=-1;
      grid.append(door);
    });
  }
  function prizeCard(host,card,day) {
    host.replaceChildren();host.dataset.layout=card.layout;host.style.setProperty('--prize-color',card.color||'#ac384d');
    const art=make('div','advent-prize-art');
    if(card.image){const img=make('img');img.src=card.image;img.alt=card.title||`Day ${day}`;img.style.objectFit=card.fit;art.append(img);}else art.append(make('span','advent-prize-emoji',card.emoji));
    const copy=make('div','advent-prize-copy');copy.append(make('small','',`DECEMBER ${day}`),make('h3','',card.title||'A Little Surprise'));if(card.text)copy.append(make('p','',card.text));host.append(art,copy);
  }
  async function shrinkImage(file) {
    if(!/^image\/(png|jpeg|webp)$/.test(file.type))throw Error('Choose a PNG, JPG, or WebP image');
    if(file.size>10*1024*1024)throw Error('Choose an image under 10 MB');
    const bitmap=await createImageBitmap(file);
    try{for(const size of [480,360,240,160]){const scale=Math.min(1,size/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);for(const quality of [.85,.65,.45]){const data=canvas.toDataURL('image/webp',quality);if(data.length<=18000)return data;}}throw Error('This image is too detailed; try cropping it first');}finally{bitmap.close();}
  }
  function setup(m) {
    let state=normalize(),timeout=0,disposed=false,revision=0,selected=0,draft=null,opener=null,openIndex=null,resetPending=false;
    const reveal=m.querySelector('.advent-reveal'),result=m.querySelector('.advent-prize'),close=m.querySelector('.advent-reveal-close'),editor=m.querySelector('.advent-editor'),form=editor.querySelector('form'),error=editor.querySelector('.advent-error');
    const field=name=>form.elements.namedItem(name);
    function changed(){(m._presentationChanged||notifyBoardChanged)('advent-calendar');}
    function closeReveal(){clearTimeout(timeout);timeout=0;reveal.hidden=true;openIndex=null;m.classList.remove('advent-revealing');m.querySelector('.is-opening')?.classList.remove('is-opening');}
    function render(){paint(m,state,openDay);}
    function openDay(index,door){
      if(timeout||!TeacherTilesHalloween.hasAccess())return;
      const card=state.cards[index];if(!card.title&&!card.text&&!card.image){if(!window.ClassConnectPolicy?.student)edit(index);return;}
      closeReveal();opener=door;openIndex=index;
      const already=card.opened;
      if(!already)door.classList.add('is-opening');
      // Start the prize at the selected drawer, then smoothly expand into the cabinet.
      const drawerRect=door.getBoundingClientRect(),cabinet=m.querySelector('.advent-cabinet').getBoundingClientRect();
      reveal.style.setProperty('--prize-x',`${(drawerRect.left+drawerRect.width/2-cabinet.left-cabinet.width/2)/cabinet.width*100}%`);
      reveal.style.setProperty('--prize-y',`${(drawerRect.top+drawerRect.height/2-cabinet.top-cabinet.height/2)/cabinet.height*100}%`);
      reveal.style.setProperty('--prize-scale',Math.max(.15,Math.min(.5,drawerRect.width/cabinet.width)));

      timeout=setTimeout(()=>{timeout=0;if(disposed||!m.isConnected)return;card.opened=true;door.classList.add('is-opened');door.classList.remove('is-opening');door.setAttribute('aria-label',`December ${index+1}, Opened`);door.querySelector('.advent-door-inside').textContent='✓';prizeCard(result,card,index+1);reveal.hidden=false;m.classList.add('advent-revealing');close.focus({preventScroll:true});if(!already){launchConfetti(m);playUiSfx('tile-effect',1,m);playUiSfx('confetti-celebration',1,m);changed();}},matchMedia('(prefers-reduced-motion: reduce)').matches||already?0:320);
    }
    close.onclick=()=>{closeReveal();opener?.focus({preventScroll:true});};
    function resetDrawers(index){
      if(window.ClassConnectPolicy?.student)return;
      closeReveal();
      if(Number.isInteger(index))state.cards[index].opened=false;
      else state.cards.forEach(card=>card.opened=false);
      render();changed();
      if(Number.isInteger(index))m.querySelector(`.advent-cabinet [data-day="${index}"]`)?.focus({preventScroll:true});
    }
    m.querySelector('.advent-reset-all').onclick=()=>resetDrawers();
    m.querySelector('.advent-reset-day').onclick=()=>resetDrawers(openIndex);

    m.addEventListener('keydown',event=>{if(event.key==='Escape'&&!reveal.hidden){event.stopPropagation();close.click();}});
    function stash(){if(!draft)return;const c=draft.cards[selected];c.title=field('prizeTitle').value;c.text=field('prizeText').value;c.layout=field('prizeLayout').value;c.fit=field('imageFit').value;}
    function designPreview(){draft.title=field('calendarTitle').value;draft.theme=field('calendarTheme').value;draft.style=field('drawerStyle').value;draft.font=field('titleFont').value;paint(editor.querySelector('.advent-design-preview'),draft);}
    function previewDraft(){stash();designPreview();prizeCard(editor.querySelector('.advent-card-preview'),draft.cards[selected],selected+1);}
    function choose(index,save=true){if(save)stash();selected=index;const c=draft.cards[index];field('prizeTitle').value=c.title;field('prizeText').value=c.text;field('prizeColor').value=c.color||themes[draft.theme][1];field('prizeLayout').value=c.layout;field('imageFit').value=c.fit;editor.querySelector('.advent-edit-day').textContent=`December ${index+1}`;editor.querySelectorAll('[data-edit-day]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.editDay)===index)));editor.querySelectorAll('[data-emoji]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.emoji===c.emoji)));field('prizeImage').value='';error.textContent='';prizeCard(editor.querySelector('.advent-card-preview'),c,index+1);designPreview();}
    function dayButtons(save=true){const list=editor.querySelector('.advent-edit-days');list.replaceChildren();for(let i=0;i<draft.days;i++){const b=button(i+1);b.dataset.editDay=i;b.onclick=()=>choose(i);list.append(b);}choose(Math.min(selected,draft.days-1),save);}
    function closeEditor(){revision++;if(editor.open)editor.close();draft=null;resetPending=false;editor.querySelector('.advent-reset').textContent='Reset All Drawers';}
    function edit(index=0){if(window.ClassConnectPolicy?.student)return;closeReveal();draft=normalize(state);selected=index;field('calendarTitle').value=draft.title;field('calendarDays').value=draft.days;field('calendarTheme').value=draft.theme;field('drawerStyle').value=draft.style;field('titleFont').value=draft.font;form.querySelector('[type="submit"]').disabled=false;editor.showModal();dayButtons(false);}
    const emojis=editor.querySelector('.advent-emoji-options');for(const icon of icons){const b=button(icon);b.dataset.emoji=icon;b.setAttribute('aria-label',`Use ${icon}`);b.onclick=()=>{draft.cards[selected].emoji=icon;editor.querySelectorAll('[data-emoji]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));previewDraft();};emojis.append(b);}
    m.querySelector('.advent-edit').onclick=()=>edit();
    editor.querySelectorAll('[data-advent-close]').forEach(b=>b.onclick=closeEditor);
    editor.addEventListener('cancel',e=>{e.preventDefault();closeEditor();});
    editor.addEventListener('click',e=>{if(e.target===editor){const r=editor.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeEditor();}});
    editor.addEventListener('pointerdown',e=>e.stopPropagation());editor.addEventListener('wheel',e=>e.stopPropagation(),{passive:true});
    form.addEventListener('input',e=>{if(!draft||e.target.type==='file')return;if(e.target.name==='calendarDays'){draft.days=Math.max(1,Math.min(24,Number(field('calendarDays').value)||1));dayButtons();}if(e.target.name==='calendarTheme'){draft.theme=field('calendarTheme').value;if(!draft.cards[selected].color)field('prizeColor').value=themes[draft.theme][1];}if(e.target.name==='prizeColor')draft.cards[selected].color=field('prizeColor').value;previewDraft();});
    field('prizeImage').addEventListener('change',async()=>{const file=field('prizeImage').files[0];if(!file)return;const token=++revision,index=selected;error.textContent='Preparing image…';form.querySelector('[type="submit"]').disabled=true;try{const image=await shrinkImage(file);if(token!==revision||!draft)return;draft.cards[index].image=image;if(selected===index)previewDraft();error.textContent='';}catch(e){if(token===revision)error.textContent=e.message;}finally{if(token===revision)form.querySelector('[type="submit"]').disabled=false;}});
    editor.querySelector('.advent-remove-image').onclick=()=>{revision++;draft.cards[selected].image='';field('prizeImage').value='';form.querySelector('[type="submit"]').disabled=false;previewDraft();};
    editor.querySelector('.advent-apply-style').onclick=()=>{stash();const source=draft.cards[selected];for(const card of draft.cards){card.color=source.color;card.layout=source.layout;card.fit=source.fit;}designPreview();error.textContent='Card style applied to all drawers';};
    editor.querySelector('.advent-mix').onclick=()=>{draft.seed=1+Math.floor(Math.random()*99998);designPreview();error.textContent='Drawer numbers will be mixed when saved';};
    editor.querySelector('.advent-order').onclick=()=>{draft.seed=0;designPreview();error.textContent='Drawer numbers will be in order when saved';};
    editor.querySelector('.advent-reset').onclick=event=>{if(!resetPending){resetPending=true;event.currentTarget.textContent='Confirm Reset';return;}draft.cards.forEach(c=>c.opened=false);resetPending=false;event.currentTarget.textContent='Reset All Drawers';error.textContent='All drawers will be closed when saved';};
    form.addEventListener('submit',event=>{event.preventDefault();stash();draft.title=field('calendarTitle').value;draft.days=Number(field('calendarDays').value);draft.theme=field('calendarTheme').value;draft.style=field('drawerStyle').value;draft.font=field('titleFont').value;state=normalize(draft);closeEditor();render();settingsDays.value=state.days;changed();});
    TeacherTilesSettings.ensure(m);const settings=m.querySelector('.tile-settings-panel'),row=make('label','advent-days-setting');row.append(make('span','','Days in Calendar'));const settingsDays=make('input');settingsDays.type='number';settingsDays.min='1';settingsDays.max='24';settingsDays.value='24';settingsDays.setAttribute('aria-label','Days in Calendar');row.append(settingsDays);settings.append(row);settingsDays.onchange=()=>{state.days=dayCount(settingsDays.value);settingsDays.value=state.days;closeReveal();render();changed();};const editButton=button('Edit Calendar','advent-settings-edit');editButton.onclick=()=>edit();settings.append(editButton);
    m.querySelector('.advent-heading').addEventListener('input',e=>{state.title=safeText(e.currentTarget.textContent,60);});
    m._boardGetState=()=>normalize(state);
    m._boardSetState=value=>{closeReveal();closeEditor();state=normalize(value);settingsDays.value=state.days;render();};
    const deactivate=m._deactivate,cleanup=m._cleanup;m._deactivate=()=>{closeReveal();closeEditor();deactivate?.();};m._cleanup=()=>{disposed=true;closeReveal();closeEditor();cleanup?.();};
    if(window.ClassConnectPolicy?.student)m.querySelectorAll('.advent-edit,.advent-reset-all,.advent-reset-day').forEach(button=>button.hidden=true);
    render();
  }
  function preview(m,state){paint(m,normalize(state));}
  window.TeacherTilesAdvent=Object.freeze({setup,preview,normalize,layout});
})();
