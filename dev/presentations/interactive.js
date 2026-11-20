// Lightweight, disposable interactive slide objects. No board/editor initialization or persistence.
(()=>{'use strict';
const make=(tag,cls='',text='')=>{const e=document.createElement(tag);e.className=cls;e.textContent=text;return e;};
const backgrounds={white:'#fff',cream:'#fff5dc',orange:'#ffdfc2',blue:'#dfeeff',pink:'#ffe0ea',green:'#e1f5e5',lavender:'#eee3ff',charcoal:'#25282e'};
const texts={dark:'#17191d',soft:'#5d6470',blue:'#244d78',rose:'#8b4055',white:'#f7f8fa',cream:'#fff0d6',red:'#b42332',orange:'#b54708',gold:'#92700c',green:'#287442',teal:'#087e8b',purple:'#7543a8',brown:'#79523b'};
const fonts={inter:'Inter',lexend:'Lexend',pacifico:'Pacifico',poppins:'Poppins',nunito:'Nunito',quicksand:'Quicksand',oswald:'Oswald',lora:'Lora',merriweather:'Merriweather',playfair:'Playfair Display',caveat:'Caveat',dm:'DM Sans',space:'Space Grotesk',mono:'Roboto Mono',calibri:'Calibri'};
function mount(host,element,{interaction,slideId}){
 const state=element.tileState||{},data=state.dataset||{},box=make('section','pres-embedded-tile pres-interactive-wordcloud'),title=make('h3','',state.special?.prompt||'Send a word to the Word Cloud'),art=make('div','pres-interactive-cloud-art'),note=make('p','pres-interactive-feedback');
 box.style.background=backgrounds[data.bg]||'#fff';box.style.color=data.bg==='charcoal'?'#f7f8fa':texts[data.text]||'#263249';box.style.setProperty('--module-font','"'+(fonts[data.font]||'Inter')+'", Arial, sans-serif');box.style.setProperty('--module-bg',box.style.backgroundColor);box.style.setProperty('--module-text',box.style.color);box.append(title,art,note);host.append(box);
 const respond=element.tileType==='respond',teacher=!!interaction?.display;
 let focus=null,focusArt=null,shareButton=null,focusButton=null,respondForm=null;
 if(respond)title.textContent=state.special?.prompt||'What do you think?';
 const answers=()=>interaction?.responses(slideId,element.id)||[];
 const shared=()=>!!interaction?.shared(slideId,element.id);
 const focused=()=>!!interaction?.focused(slideId,element.id);
 function closeFocus(){if(focus){focus.close();focus.remove();focus=null;focusArt=null;}}
 function control(label,control,enabled){
  const button=make('button','respond-action tt-board-action',label);button.type='button';
  const paths=control==='share'?'<path d="M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="2.8"/>':'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>';
  button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+paths+'</svg>';
  button.append(make('span','',label));
  button.onclick=async()=>{button.disabled=true;try{await interaction.display(slideId,element.id,control,enabled());}catch(error){note.textContent=error.message;}finally{button.disabled=false;}};
  return button;
 }
 function paintFocus(){
  if(!focused()){closeFocus();return;}
  if(!focus){
   focus=make('dialog','respond-focus');focus.setAttribute('aria-label','ClassConnect results');
   const heading=make('h2','',title.textContent);focusArt=make('div','respond-focus-art');
   focus.append(heading,focusArt);
   if(teacher)focus.append(control('Return to Slide','focus',()=>false));
   else{const back=make('button','respond-action tt-board-action','Back to Profile');back.onclick=()=>box.closest('.cc-presentation-viewer')?.close();focus.append(back);}
   focus.addEventListener('cancel',event=>{event.preventDefault();if(teacher)interaction.display(slideId,element.id,'focus',false).catch(error=>note.textContent=error.message);});
   for(const type of ['click','dblclick','contextmenu','pointerdown','keydown','wheel'])focus.addEventListener(type,event=>event.stopPropagation());
   (document.fullscreenElement||document.body).append(focus);focus.showModal();
  }
  if(respond){TeacherTilesRespond.list(focusArt,answers());if(!answers().length)focusArt.textContent='Waiting for responses…';}
  else TeacherTilesWordCloud.render(focusArt,interaction.read(slideId,element.id));
 }
 if(teacher){
  const actions=make('div','respond-actions');
  if(respond){shareButton=control('Show Responses to Students','share',()=>!shared());actions.append(shareButton);}
  focusButton=control('Fullscreen Results','focus',()=>true);actions.append(focusButton);box.append(actions);
 }
 let off=null,closed=false,pending=null,busy=false,timer=0,until=0;
 const draw=()=>{if(closed)return;
  paintFocus();
  if(respond){
   const visible=teacher||shared(),rows=visible?answers():[];
   art.hidden=!visible;TeacherTilesRespond.list(art,rows,teacher);
   if(shareButton){shareButton.lastElementChild.textContent=shared()?'Hide Responses':'Show Responses to Students';shareButton.setAttribute('aria-pressed',String(shared()));}
   note.textContent=interaction?.problem||(!interaction?'Start a ClassConnect session to begin':visible&&!rows.length?'Waiting for responses…':'');
   return;
  }
  const value=interaction?.read(slideId,element.id)||[];TeacherTilesWordCloud.render(art,value);if(interaction?.problem){note.textContent=interaction.problem;return;}if(!busy&&!pending&&!value.length)note.textContent=interaction?'Waiting for words…':'Start a ClassConnect presentation to collect words';else if(!busy&&!pending)note.textContent='';};
 const form=make('form'),input=make('input'),send=make('button','tt-board-action','Send Word');input.type='text';input.maxLength=40;input.required=true;input.autocomplete='off';input.placeholder='Your word…';input.setAttribute('aria-label','Your word');send.type='submit';note.setAttribute('role','status');
 function button(){const seconds=Math.max(0,Math.ceil((until-performance.now())/1000));send.disabled=busy||seconds>0;send.textContent=seconds?'Send in '+seconds+'s':'Send Word';if(!seconds&&timer){clearInterval(timer);timer=0;}}
 function cooldown(){until=performance.now()+2000;if(!timer)timer=setInterval(button,100);button();}
 if(respond&&interaction?.submit){
  respondForm=TeacherTilesRespond.form(input=>interaction.submit(slideId,element.id,input),interaction.answered(slideId,element.id));
  box.insertBefore(respondForm,note);
 }
 if(!respond&&interaction?.submit){form.append(input,send);box.insertBefore(form,note);form.onsubmit=async event=>{event.preventDefault();if(closed||busy||performance.now()<until)return;const word=input.value.trim();if(!word)return;if(!pending||pending.word!==word)pending={word,requestId:crypto.randomUUID()};busy=true;button();input.disabled=true;note.textContent='Sending…';try{await interaction.submit(slideId,element.id,pending);if(closed)return;pending=null;input.value='';note.textContent='Word added!';cooldown();}catch(error){if(closed)return;if(error.code==='functions/resource-exhausted'&&/moment/.test(error.message)){note.textContent='';cooldown();}else note.textContent=String(error.message||'Could not send. Try again.').replace(/\s*\[\d{3}\]\s*$/,'');}finally{busy=false;if(!closed){input.disabled=false;button();input.focus({preventScroll:true});}}};}
 for(const name of ['click','dblclick','contextmenu','pointerdown','keydown','wheel'])box.addEventListener(name,event=>event.stopPropagation());
 if(interaction)off=interaction.subscribe(draw);draw();window.TeacherTilesPresentationRenderer?.loadFont(fonts[data.font]||'Inter').then(()=>{if(!closed)draw();});
 return()=>{closed=true;closeFocus();off?.();clearInterval(timer);pending=null;};
}
window.TeacherTilesPresentationInteractive=Object.freeze({mount});
})();
