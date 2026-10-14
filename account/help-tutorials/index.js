(()=>{'use strict';
function setup(){
 const list=document.querySelector('.help-mouse-list');if(!list)return;
 const catalog=window.TeacherTilesTutorialCatalog||{};
 const dialog=document.createElement('dialog');dialog.className='help-tutorial-dialog';dialog.setAttribute('aria-labelledby','help-demo-title');
 dialog.innerHTML='<header><div><small>BOARD WALKTHROUGH</small><h2 id="help-demo-title"></h2></div><button class="help-demo-close" type="button" aria-label="Close tutorial">×</button></header><p class="help-demo-description"></p><div class="help-demo-screen"><video controls playsinline preload="none" aria-label="Board demonstration"></video><p class="help-demo-error" role="status" hidden>This demonstration could not load. Use Replay to try again.</p></div><footer><span class="help-demo-length"></span><button class="help-demo-replay" type="button"><span aria-hidden="true">↻</span> Replay</button></footer><details class="help-demo-transcript"><summary>Step-by-Step Instructions</summary><ol></ol></details>';
 document.body.append(dialog);
 const video=dialog.querySelector('video'),error=dialog.querySelector('.help-demo-error');let sourceButton=null;
 const close=()=>dialog.close();
 dialog.querySelector('.help-demo-close').addEventListener('click',close);
 dialog.addEventListener('keydown',event=>event.stopPropagation());
 dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)close()});
 dialog.addEventListener('close',()=>{video.pause();video.removeAttribute('src');video.removeAttribute('poster');video.querySelectorAll('track').forEach(track=>track.remove());video.load();error.hidden=true;sourceButton?.setAttribute('aria-expanded','false');sourceButton?.focus({preventScroll:true})});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)video.pause()});
 video.addEventListener('loadedmetadata',()=>{if(Number.isFinite(video.duration))dialog.querySelector('.help-demo-length').textContent=Math.ceil(video.duration)+' second demonstration'});
 video.addEventListener('error',()=>{if(dialog.open&&video.getAttribute('src'))error.hidden=false});
 dialog.querySelector('.help-demo-replay').addEventListener('click',()=>{error.hidden=true;if(video.error)video.load();video.currentTime=0;video.play().catch(()=>{})});
 function open(button,key){
  const entry=catalog[key];if(!entry)return;sourceButton=button;button.setAttribute('aria-expanded','true');
  const title=button.querySelector('strong').textContent;
  dialog.querySelector('h2').textContent=title;dialog.querySelector('.help-demo-description').textContent=button.querySelector('small').textContent;
  dialog.querySelector('.help-demo-length').textContent=Math.ceil(entry.duration)+' second demonstration';
  const steps=dialog.querySelector('ol');steps.replaceChildren();for(const text of entry.steps){const li=document.createElement('li');li.textContent=text;steps.append(li)}
  dialog.querySelector('details').open=false;error.hidden=true;video.setAttribute('aria-label',title+' demonstration');
  video.poster='assets/help/tutorials/'+key+'.jpg';video.src='assets/help/tutorials/'+key+'.webm';
  const track=document.createElement('track');track.kind='captions';track.label='English';track.srclang='en';track.src='assets/help/tutorials/'+key+'.vtt';video.replaceChildren(track);
  dialog.showModal();dialog.scrollTop=0;dialog.querySelector('.help-demo-close').focus({preventScroll:true});
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)video.play().catch(()=>{});
 }
 for(const row of list.children){
  const heading=row.querySelector('strong[data-i18n]'),key=heading?.dataset.i18n.split('.')[2],entry=catalog[key];if(!entry)continue;
  row.classList.add('help-mouse-card');row.dataset.helpTopic=key;row.dataset.helpType='Video';row.dataset.searchTranscript=entry.steps.join(' ');row.dataset.searchKeywords='video tutorial demonstration walkthrough '+(entry.keywords||'');
  const button=document.createElement('button');button.type='button';button.className='help-mouse-button';button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-expanded','false');
  const copy=row.querySelector('p');if(copy){const span=document.createElement('span');span.className='help-mouse-button__copy';span.append(...copy.childNodes);copy.replaceWith(span)}
  button.append(...row.childNodes);const play=document.createElement('span');play.className='help-mouse-button__play';play.setAttribute('aria-hidden','true');play.innerHTML='<svg viewBox="0 0 20 20"><path d="m7 4 9 6-9 6Z" fill="currentColor"/></svg>';button.append(play);row.append(button);button.addEventListener('click',()=>open(button,key));
 }
 window.TeacherTilesPanelSearch?.refresh();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
