// Lightweight, disposable interactive slide objects. No board/editor initialization or persistence.
(()=>{'use strict';
const make=(tag,cls='',text='')=>{const e=document.createElement(tag);e.className=cls;e.textContent=text;return e;};
const backgrounds={white:'#fff',cream:'#fff5dc',orange:'#ffdfc2',blue:'#dfeeff',pink:'#ffe0ea',green:'#e1f5e5',lavender:'#eee3ff',charcoal:'#25282e'};
const texts={dark:'#17191d',soft:'#5d6470',blue:'#244d78',rose:'#8b4055',white:'#f7f8fa',cream:'#fff0d6',red:'#b42332',orange:'#b54708',gold:'#92700c',green:'#287442',teal:'#087e8b',purple:'#7543a8',brown:'#79523b'};
const fonts={inter:'Inter',lexend:'Lexend',pacifico:'Pacifico',poppins:'Poppins',nunito:'Nunito',quicksand:'Quicksand',oswald:'Oswald',lora:'Lora',merriweather:'Merriweather',playfair:'Playfair Display',caveat:'Caveat',dm:'DM Sans',space:'Space Grotesk',mono:'Roboto Mono',calibri:'Calibri'};
function mount(host,element,{interaction,slideId}){
 const state=element.tileState||{},data=state.dataset||{},box=make('section','pres-embedded-tile pres-interactive-wordcloud'),title=make('h3','',state.special?.prompt||'Send a word to the Word Cloud'),art=make('div','pres-interactive-cloud-art'),note=make('p','pres-interactive-feedback');
 box.style.background=backgrounds[data.bg]||'#fff';box.style.color=data.bg==='charcoal'?'#f7f8fa':texts[data.text]||'#263249';box.style.setProperty('--module-font','"'+(fonts[data.font]||'Inter')+'", Arial, sans-serif');box.append(title,art,note);host.append(box);
 let off=null,closed=false,pending=null,busy=false,timer=0,until=0;
 const draw=()=>{if(closed)return;const value=interaction?.read(slideId,element.id)||[];TeacherTilesWordCloud.render(art,value);if(interaction?.problem){note.textContent=interaction.problem;return;}if(!busy&&!pending&&!value.length)note.textContent=interaction?'Waiting for words…':'Start a ClassConnect presentation to collect words';else if(!busy&&!pending)note.textContent='';};
 const form=make('form'),input=make('input'),send=make('button','','Send Word');input.type='text';input.maxLength=40;input.required=true;input.autocomplete='off';input.placeholder='Your word…';input.setAttribute('aria-label','Your word');send.type='submit';note.setAttribute('role','status');
 function button(){const seconds=Math.max(0,Math.ceil((until-performance.now())/1000));send.disabled=busy||seconds>0;send.textContent=seconds?'Send in '+seconds+'s':'Send Word';if(!seconds&&timer){clearInterval(timer);timer=0;}}
 function cooldown(){until=performance.now()+2000;if(!timer)timer=setInterval(button,100);button();}
 if(interaction?.submit){form.append(input,send);box.insertBefore(form,note);form.onsubmit=async event=>{event.preventDefault();if(closed||busy||performance.now()<until)return;const word=input.value.trim();if(!word)return;if(!pending||pending.word!==word)pending={word,requestId:crypto.randomUUID()};busy=true;button();input.disabled=true;note.textContent='Sending…';try{await interaction.submit(slideId,element.id,pending);if(closed)return;pending=null;input.value='';note.textContent='Word added!';cooldown();}catch(error){if(closed)return;if(error.code==='functions/resource-exhausted'&&/moment/.test(error.message)){note.textContent='';cooldown();}else note.textContent=String(error.message||'Could not send. Try again.').replace(/\s*\[\d{3}\]\s*$/,'');}finally{busy=false;if(!closed){input.disabled=false;button();input.focus({preventScroll:true});}}};}
 for(const name of ['click','dblclick','contextmenu','pointerdown','keydown','wheel'])box.addEventListener(name,event=>event.stopPropagation());
 if(interaction)off=interaction.subscribe(draw);draw();window.TeacherTilesPresentationRenderer?.loadFont(fonts[data.font]||'Inter').then(()=>{if(!closed)draw();});
 return()=>{closed=true;off?.();clearInterval(timer);pending=null;};
}
window.TeacherTilesPresentationInteractive=Object.freeze({mount});
})();
