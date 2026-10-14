(()=>{'use strict';
function setup(m){
  const source=[...m.querySelectorAll('.sentence-source [contenteditable]')],draft=[...m.querySelectorAll('.sentence-draft [contenteditable]')];
  const ghost=m.querySelector('.sentence-ghost'),historyPanel=m.querySelector('.sentence-history'),image=m.querySelector('.sentence-image'),drop=m.querySelector('.sentence-drop'),upload=m.querySelector('.sentence-upload'),notice=m.querySelector('.sentence-notice');
  let versions=[],imageData='',imageTicket=0,disposed=false;
  const text=value=>String(value??'').replace(/[\r\n]+/g,' ').slice(0,2000);
  const pair=fields=>fields.map(el=>text(el.textContent));
  const write=(fields,values)=>fields.forEach((el,i)=>el.textContent=text(values?.[i]));
  let fitFrame=0;
  const sourceLine=m.querySelector('.sentence-source'),draftLine=m.querySelector('.sentence-draft'),bottom=m.querySelector('.sentence-bottom');
  function fitLine(line,limit){
    if(!line.clientWidth||limit<=0)return;
    line.style.removeProperty('font-size');
    const maximum=parseFloat(getComputedStyle(line).fontSize);
    const fits=()=>line.scrollHeight<=limit+1&&line.scrollWidth<=line.clientWidth+1;
    if(!fits()){let low=1,high=maximum;for(let i=0;i<12;i++){const size=(low+high)/2;line.style.fontSize=size+'px';if(fits())low=size;else high=size}line.style.fontSize=low+'px'}
    line.scrollTop=line.scrollLeft=0;
  }
  function fitText(){fitFrame=0;if(disposed||!m.isConnected)return;
    fitLine(sourceLine,parseFloat(getComputedStyle(sourceLine).maxHeight)||70);
    const hint=m.querySelector('.sentence-hint'),shown=[ghost,hint].filter(el=>getComputedStyle(el).display!=='none'),gap=parseFloat(getComputedStyle(bottom).rowGap)||0;
    const available=Math.max(1,bottom.clientHeight-shown.reduce((sum,el)=>sum+el.offsetHeight+(parseFloat(getComputedStyle(el).marginTop)||0),0)-shown.length*gap);
    draftLine.style.maxHeight=available+'px';fitLine(draftLine,available);
  }
  function queueFit(){if(!fitFrame&&!disposed)fitFrame=requestAnimationFrame(fitText)}
  const fitObserver=new ResizeObserver(queueFit);fitObserver.observe(m);fitObserver.observe(bottom);
  const appearanceObserver=new MutationObserver(queueFit);appearanceObserver.observe(m,{attributes:true,attributeFilter:['style','data-font']});
  m.addEventListener('pointerenter',queueFit);m.addEventListener('pointerleave',queueFit);document.fonts?.addEventListener('loadingdone',queueFit);
  const changed=()=>{queueFit();notifyBoardChanged('sentence-expansion')};
  function sentenceNode(values){const node=document.createElement('span');for(let i=0;i<2;i++){const part=document.createElement('span');part.className=i?'sentence-predicate':'sentence-subject';part.textContent=values[i];node.append(part,document.createTextNode(i?'.':' '))}return node}
  function closeHistory(){historyPanel.hidden=true;ghost.setAttribute('aria-expanded','false')}
  function renderHistory(){ghost.hidden=!versions.length;ghost.replaceChildren();if(versions.length){ghost.append(sentenceNode(versions.at(-1)));const count=document.createElement('small');count.textContent=versions.length+' saved '+(versions.length===1?'sentence':'sentences');ghost.append(count)}historyPanel.replaceChildren();versions.forEach((value,i)=>{const button=document.createElement('button');button.type='button';button.setAttribute('aria-label','Use sentence '+(i+1)+': '+value.join(' ')+'.');const number=document.createElement('small');number.textContent=String(i+1).padStart(2,'0');button.append(number,sentenceNode(value));button.onclick=()=>{write(draft,value);closeHistory();draft[0].focus();changed()};historyPanel.append(button)})}
  function commit(){const current=pair(draft);if(!current.some(Boolean))return;if(!versions.length){const starting=pair(source);if(starting.some((v,i)=>v!==current[i]))versions.push(starting)}const previous=versions.at(-1);if(!previous||previous.some((v,i)=>v!==current[i]))versions.push(current);renderHistory();closeHistory();changed();if(!matchMedia('(prefers-reduced-motion: reduce)').matches)ghost.animate([{opacity:0,transform:'translateY(9px)'},{opacity:1,transform:'none'}],{duration:220,easing:'ease-out'})}
  for(const field of [...source,...draft]){field.addEventListener('input',()=>{if(field.textContent.length>2000)field.textContent=text(field.textContent);if(source.includes(field)){write(draft,pair(source));closeHistory()}changed()});field.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();e.stopPropagation();if(source.includes(field))draft[0].focus()}});field.addEventListener('paste',e=>{e.preventDefault();const plain=text(e.clipboardData.getData('text/plain'));document.execCommand('insertText',false,plain)})}
  m.querySelector('.sentence-apply').onclick=commit;
  const reset=document.createElement('button');reset.type='button';reset.className='sentence-reset';reset.textContent='Reset';reset.title='Reset to the starting sentence and clear history';reset.setAttribute('aria-label','Reset sentence expansion');m.append(reset);reset.onclick=()=>{write(draft,pair(source));versions=[];closeHistory();renderHistory();notice.textContent='';changed()};
  ghost.onclick=()=>{historyPanel.hidden=!historyPanel.hidden;ghost.setAttribute('aria-expanded',String(!historyPanel.hidden))};
  const outside=e=>{if(!historyPanel.contains(e.target)&&!ghost.contains(e.target))closeHistory()};document.addEventListener('pointerdown',outside);
  historyPanel.addEventListener('keydown',e=>{if(e.key==='Escape'){closeHistory();ghost.focus();e.stopPropagation()}});
  historyPanel.addEventListener('wheel',e=>e.stopPropagation(),{passive:true});
  function paintImage(){image.hidden=!imageData;if(imageData)image.src=imageData;else image.removeAttribute('src');drop.classList.toggle('has-image',!!imageData);m.querySelector('.sentence-remove-image').hidden=!imageData}
  async function loadImage(file){if(!file)return;const ticket=++imageTicket;notice.textContent='';if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)||file.size>15000000){notice.textContent='Choose a PNG, JPG, WebP or GIF under 15 MB.';return}try{const bitmap=await createImageBitmap(file);if(disposed||ticket!==imageTicket){bitmap.close();return}const c=document.createElement('canvas'),scale=Math.min(1,1200/Math.max(bitmap.width,bitmap.height));c.width=Math.max(1,Math.round(bitmap.width*scale));c.height=Math.max(1,Math.round(bitmap.height*scale));c.getContext('2d').drawImage(bitmap,0,0,c.width,c.height);bitmap.close();imageData=c.toDataURL('image/webp',.82);paintImage();changed()}catch{if(!disposed)notice.textContent='That image could not be opened.'}}
  drop.onclick=e=>{if(!e.target.closest('.sentence-remove-image'))upload.click()};drop.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target===drop){e.preventDefault();upload.click()}});
  upload.onchange=()=>{loadImage(upload.files[0]);upload.value=''};
  drop.addEventListener('dragover',e=>{e.preventDefault();e.stopPropagation();drop.classList.add('is-drop-target')});drop.addEventListener('dragleave',e=>{if(!drop.contains(e.relatedTarget))drop.classList.remove('is-drop-target')});drop.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();drop.classList.remove('is-drop-target');loadImage(e.dataTransfer.files[0])});
  m.querySelector('.sentence-remove-image').onclick=e=>{e.stopPropagation();imageTicket++;imageData='';paintImage();changed()};
  m._boardGetState=()=>({version:1,source:pair(source),draft:pair(draft),history:versions.map(v=>[...v]),image:imageData});
  m._boardSetState=state=>{imageTicket++;write(source,Array.isArray(state?.source)?state.source:['subject','predicate']);write(draft,Array.isArray(state?.draft)?state.draft:pair(source));versions=Array.isArray(state?.history)?state.history.filter(v=>Array.isArray(v)&&v.length===2).map(v=>v.map(text)):[];imageData=/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(state?.image||'')&&state.image.length<6000000?state.image:'';closeHistory();renderHistory();paintImage()};
  const deactivate=m._deactivate;m._deactivate=()=>{closeHistory();deactivate?.()};const cleanup=m._cleanup;m._cleanup=()=>{disposed=true;imageTicket++;document.removeEventListener('pointerdown',outside);cleanup?.()};
  const restore=m._boardSetState;m._boardSetState=state=>{restore(state);queueFit()};
  const clearFit=m._cleanup;m._cleanup=()=>{cancelAnimationFrame(fitFrame);fitObserver.disconnect();appearanceObserver.disconnect();document.fonts?.removeEventListener('loadingdone',queueFit);clearFit?.()};
  m._boardSetState(null);
}
window.TeacherTilesSentenceExpansion=Object.freeze({setup});})();
