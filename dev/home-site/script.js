import {fetchCatalog,getReader,renderIcon} from './catalog-client.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const appRoot=new URL('../',import.meta.url);$$('a[href="/board.html"]').forEach(link=>{link.href=new URL('board.html',appRoot).href});
const reduced=matchMedia('(prefers-reduced-motion: reduce)');let motionPaused=reduced.matches;
function syncMotion(){document.body.classList.toggle('motion-paused',motionPaused);$$('[data-motion-toggle]').forEach(button=>{button.disabled=reduced.matches;button.textContent=reduced.matches?'Reduced Motion':motionPaused?'Resume Motion ▷':'Pause Motion Ⅱ';button.setAttribute('aria-pressed',String(motionPaused))});document.body.classList.toggle('js-motion',!motionPaused)}
syncMotion();$$('[data-motion-toggle]').forEach(button=>button.addEventListener('click',()=>{motionPaused=!motionPaused;syncMotion()}));reduced.addEventListener('change',event=>{motionPaused=event.matches;syncMotion()});
const revealObserver=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('visible');revealObserver.unobserve(entry.target)}},{threshold:.07});$$('.reveal').forEach(el=>revealObserver.observe(el));
const highlightObserver=new IntersectionObserver(entries=>{for(const entry of entries)entry.target.classList.toggle('highlight-visible',entry.isIntersecting)},{threshold:.7,rootMargin:'0px 0px -45px 0px'});$$('.marker').forEach(el=>highlightObserver.observe(el));
function updateHeader(){document.body.classList.toggle('scrolled',scrollY>45)}updateHeader();addEventListener('scroll',updateHeader,{passive:true});
$('.menu-toggle').addEventListener('click',()=>{const open=$('#navigation').classList.toggle('is-open');$('.menu-toggle').setAttribute('aria-expanded',String(open))});$$('#navigation a').forEach(a=>a.addEventListener('click',()=>{$('#navigation').classList.remove('is-open');$('.menu-toggle').setAttribute('aria-expanded','false')}));
const scene=$('.hero-scene');scene.addEventListener('pointermove',event=>{if(motionPaused||event.pointerType==='touch')return;const box=scene.getBoundingClientRect();scene.style.setProperty('--mouse-x',`${((event.clientX-box.left)/box.width-.5)*14}px`);scene.style.setProperty('--mouse-y',`${((event.clientY-box.top)/box.height-.5)*12}px`)});scene.addEventListener('pointerleave',()=>{scene.style.setProperty('--mouse-x','0px');scene.style.setProperty('--mouse-y','0px')});
function showDialog(dialog){dialog.showModal();document.documentElement.style.overflow='hidden'}
$$('dialog').forEach(dialog=>{dialog.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();dialog.close()}});dialog.addEventListener('close',()=>{document.documentElement.style.overflow=''});dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const b=dialog.getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)dialog.close()})});
$('#year').textContent=new Date().getFullYear();

// Mount real, memory-only app demos near the viewport, and dispose them after 20s away.
const demoRoots=$$('[data-demo]'),timers=new Map();let actualSize=false;
function mountDemo(root,force=false){if(root.querySelector('iframe')&&!force)return;clearTimeout(timers.get(root));const iframe=document.createElement('iframe');iframe.title=`Interactive TeacherTiles ${root.dataset.demo} example`;iframe.setAttribute('sandbox','allow-scripts allow-same-origin');iframe.setAttribute('allow','fullscreen');iframe.src=new URL(`demo/index.html?mode=${encodeURIComponent(root.dataset.demo)}`,import.meta.url);root.replaceChildren(iframe)}
function unmountLater(root){clearTimeout(timers.get(root));timers.set(root,setTimeout(()=>{root.replaceChildren();if(root.id==='board-canvas'){actualSize=false;$('#demo-fit').textContent='View at 100%';$('#demo-fit').setAttribute('aria-pressed','false')}},20000))}
const demoObserver=new IntersectionObserver(entries=>{for(const entry of entries){entry.target.dataset.visible=String(entry.isIntersecting);if(entry.isIntersecting){clearTimeout(timers.get(entry.target));mountDemo(entry.target)}else unmountLater(entry.target)}},{rootMargin:'100px',threshold:0});demoRoots.forEach(root=>demoObserver.observe(root));
function chooseDemo(root,mode){root.dataset.demo=mode;root.style.height='';mountDemo(root,true)}
$$('[data-mode]').forEach(button=>button.addEventListener('click',()=>{$$('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));$('#board-name').textContent=button.querySelector('strong').textContent;actualSize=false;$('#demo-fit').textContent='View at 100%';$('#demo-fit').setAttribute('aria-pressed','false');chooseDemo($('#board-canvas'),button.dataset.mode)}));
$('#demo-reset').addEventListener('click',()=>{actualSize=false;$('#demo-fit').textContent='View at 100%';$('#demo-fit').setAttribute('aria-pressed','false');mountDemo($('#board-canvas'),true)});
$('#demo-fit').addEventListener('click',()=>{actualSize=!actualSize;$('#board-canvas iframe')?.contentWindow.postMessage({type:'demo-zoom',actual:actualSize},location.origin);$('#demo-fit').textContent=actualSize?'Fit Board':'View at 100%';$('#demo-fit').setAttribute('aria-pressed',String(actualSize))});
$$('[data-planning]').forEach(button=>button.addEventListener('click',()=>{$$('[data-planning]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));chooseDemo($('#planning-preview'),button.dataset.planning)}));
$$('[data-pbis]').forEach(button=>button.addEventListener('click',()=>{$$('[data-pbis]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));chooseDemo($('#pbis-preview'),button.dataset.pbis);$('.pbis-stage .stage-note').textContent=button.dataset.pbis==='stars'?'Click a student to celebrate a little win.':'Build toward a shared goal, one little win at a time.'}));
addEventListener('message',event=>{if(event.origin!==location.origin)return;const root=demoRoots.find(el=>el.querySelector('iframe')?.contentWindow===event.source);if(!root)return;const data=event.data;if(data?.type==='demo-ready'){root.querySelector('iframe').classList.add('is-ready')}if(data?.type==='demo-height'&&Number.isFinite(data.height)){root.style.height=`${Math.min(2100,Math.max(300,data.height))}px`}if(data?.type==='demo-scroll'&&Number.isFinite(data.delta)&&!$('dialog[open]'))window.scrollBy({top:Math.max(-1000,Math.min(1000,data.delta)),behavior:'instant'})});
document.addEventListener('visibilitychange',()=>{if(document.hidden){demoRoots.forEach(unmountLater)}else demoRoots.filter(root=>root.dataset.visible==='true').forEach(root=>{clearTimeout(timers.get(root));mountDemo(root)})});

// Both moving strips and the searchable library are rebuilt from the same current catalog.
let catalog=null,iconRenderer=null,loading=false,lastRefresh=0,signature='';
function toolById(id){return catalog?.tiles.find(tile=>tile.id===id)}
function iconFor(tile){return renderIcon(tile,iconRenderer)}
function tileCard(tile,{interactive=false}={}){const card=document.createElement(interactive?'button':'article');card.className='tile-card';if(interactive){card.type='button';card.addEventListener('click',()=>openLibrary(tile.name));card.setAttribute('aria-label',`Explore ${tile.name}`)}const icon=document.createElement('span');icon.className='catalog-icon';icon.append(iconFor(tile));const body=document.createElement('div'),name=document.createElement('h3'),description=document.createElement('p');name.textContent=tile.name;description.textContent=tile.description;body.append(name,description);card.append(icon,body);return card}
function renderCatalog(){
  const categoryGroup=document.createElement('div');categoryGroup.className='category-group';for(const category of catalog.categories){const item=document.createElement('span');item.textContent=category.label;categoryGroup.append(item)}
  const categoryClone=categoryGroup.cloneNode(true);categoryClone.setAttribute('aria-hidden','true');$('#category-track').replaceChildren(categoryGroup,categoryClone);$('#category-track').style.setProperty('--category-speed',`${Math.max(45,catalog.categories.length*5)}s`);
  // Feature useful classroom staples first; every available tile follows once.
  const priorities=['timer','clock','visualschedule','abc','lessonplannertile','starchart','attendance','calendar','chime','fishtank'];const sorted=[...catalog.tiles].sort((a,b)=>{const ai=priorities.indexOf(a.id),bi=priorities.indexOf(b.id);return(ai<0?999:ai)-(bi<0?999:bi)||a.name.localeCompare(b.name)});
  const group=document.createElement('div');group.className='tile-group';for(const tile of sorted)group.append(tileCard(tile,{interactive:true}));const clone=group.cloneNode(true);clone.setAttribute('aria-hidden','true');clone.querySelectorAll('button').forEach(button=>{button.tabIndex=-1;button.addEventListener('mousedown',event=>event.preventDefault());button.addEventListener('click',()=>openLibrary(button.querySelector('h3').textContent))});$('#tile-track').replaceChildren(group,clone);$('#tile-track').style.setProperty('--tile-speed',`${Math.max(75,sorted.length*8)}s`);
  $('#catalog-summary').textContent=`${catalog.tiles.length} classroom tools, and room to grow. Find your favorites. Bring them together.`;
  const select=$('#tile-category'),previous=select.value;select.replaceChildren(new Option('All Categories','all'));for(const category of catalog.categories)select.add(new Option(category.label,category.id));if([...select.options].some(option=>option.value===previous))select.value=previous;
  $$('[data-tool-icon]').forEach(el=>{const tile=toolById(el.dataset.toolIcon);if(tile)el.replaceChildren(iconFor(tile))});
  $$('[data-hero-tool]').forEach(el=>{const tile=toolById(el.dataset.heroTool);if(tile)el.querySelector('.hero-tool-icon').replaceChildren(iconFor(tile))});
  $$('[data-featured-tools]').forEach(el=>{el.replaceChildren();for(const id of el.dataset.featuredTools.split(',')){const tile=toolById(id);if(!tile)continue;const item=document.createElement('span');item.append(iconFor(tile),document.createTextNode(tile.name));el.append(item)}});
  renderLibrary();
}
function renderLibrary(){if(!catalog)return;const query=$('#tile-search').value.trim().toLowerCase(),category=$('#tile-category').value;const tiles=catalog.tiles.filter(tile=>(category==='all'||tile.categories.includes(category))&&`${tile.name} ${tile.description}`.toLowerCase().includes(query));$('#library-results').replaceChildren(...tiles.map(tile=>tileCard(tile)));$('#library-result-count').textContent=`${tiles.length} ${tiles.length===1?'tile':'tiles'}${query?' matching your search':''}`;$('.library-empty').hidden=tiles.length>0}
function openLibrary(query=''){$('#tile-search').value=query;$('#tile-category').value='all';renderLibrary();showDialog($('#library-dialog'))}
$('#open-library').addEventListener('click',()=>openLibrary());$('#tile-search').addEventListener('input',renderLibrary);$('#tile-category').addEventListener('change',renderLibrary);
async function refreshCatalog(){if(loading)return;loading=true;if($('#refresh-catalog'))$('#refresh-catalog').disabled=true;try{const next=await fetchCatalog({fallback:!catalog});({tileIcon:iconRenderer}=await getReader());const nextSignature=JSON.stringify([next.categories,next.tiles]);catalog=next;if(signature!==nextSignature){signature=nextSignature;renderCatalog()}lastRefresh=Date.now();if($('#catalog-status'))$('#catalog-status').textContent=`${next.source==='app'?'Current app catalog':'Bundled fallback catalog'} · ${next.tiles.length} available tiles · checked ${new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}${next.source==='fallback'?'. Live source unavailable; retry to reconnect.':''}`;}catch(error){if($('#catalog-status'))$('#catalog-status').textContent=catalog?'Could not refresh. Keeping the last valid catalog.':'The tile library could not load. Please try Refresh Catalog.';if(!catalog)$('#catalog-summary').textContent='Explore the classroom tools in TeacherTiles.'}finally{loading=false;if($('#refresh-catalog'))$('#refresh-catalog').disabled=false}}
$('#refresh-catalog')?.addEventListener('click',refreshCatalog);refreshCatalog();setInterval(()=>{if(!document.hidden&&Date.now()-lastRefresh>300000)refreshCatalog()},60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-lastRefresh>300000)refreshCatalog()});

$('#contact-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const form=event.currentTarget,button=form.querySelector('[type="submit"]'),status=$('#form-status');
  if(button.disabled||!form.reportValidity())return;
  const data=new FormData(form);
  const message=`School / organization: ${data.get('organization')||'Not specified'}\nRole: ${data.get('role')||'Not specified'}\nInterest: ${data.get('interest')}\n\n${String(data.get('message')||'').trim()}`;
  if(message.length>5000){status.textContent='Please shorten your message so it and your school details fit within 5,000 characters.';return;}
  const fields=[...form.querySelectorAll('input,select,textarea')];
  button.disabled=true;fields.forEach(field=>field.disabled=true);status.textContent='Sending your message…';
  try{
    const {firebaseConfig}=await import('../firebase-config.js');
    const response=await fetch(`https://us-central1-${firebaseConfig.projectId}.cloudfunctions.net/contactEmail`,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name:String(data.get('name')||'').trim(),email:String(data.get('email')||'').trim(),subject:`TeacherTiles inquiry: ${data.get('interest')}`,message})
    });
    const result=await response.json().catch(()=>null);
    if(!response.ok||result?.success!==true)throw new Error(result?.message||'Message could not be sent. Please try again in a moment.');
    form.reset();status.textContent='Message sent. Thank you!';
  }catch(error){status.textContent=error.message||'Message could not be sent. Please try again in a moment.';}
  finally{button.disabled=false;fields.forEach(field=>field.disabled=false);}
});
