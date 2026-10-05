(()=>{'use strict';
const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/⌘/g,' command ').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const groups=['sound audio volume loud quiet mute silence','font text typography lettering','bigger larger increase size enlarge','smaller decrease reduce','zoom scroll wheel magnify','recenter centre center space spacebar','ctrl control command cmd','delete remove trash erase','snap snapping join group detach ungroup','copy duplicate clone','redo restore','stop disable off prevent','settings preferences options','video tutorial walkthrough watch','image visual picture illustration'];
const aliases=new Map();for(const group of groups){const words=group.split(' ');for(const word of words)aliases.set(word,words)}
const stop=new Set('a an the how do i my me to of for in on is can you please change make want it with and turn'.split(' '));
function near(a,b){if(a.length<4||Math.abs(a.length-b.length)>1)return false;let i=0,j=0,errors=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue}if(++errors>1)return false;if(a.length>=b.length)i++;if(b.length>=a.length)j++}return errors+(i<a.length||j<b.length?1:0)<=1}
function rank(items,query){const phrase=normalize(query),terms=[...new Set(phrase.split(' ').filter(t=>t&&!stop.has(t)))];if(!terms.length)return [];return items.map(item=>{const title=normalize(item.title),keywords=normalize(item.keywords),body=normalize(item.text),words=(title+' '+keywords+' '+body).split(' ');let score=title===phrase?100: title.includes(phrase)?45:0;for(const term of terms){if(title.split(' ').includes(term)){score+=20;continue}if(keywords.split(' ').includes(term)){score+=15;continue}if(words.includes(term)){score+=9;continue}if(term.length>=2&&words.some(w=>w.startsWith(term))){score+=6;continue}if((aliases.get(term)||[]).some(a=>words.includes(a))){score+=4;continue}if(words.some(w=>near(term,w))){score+=1;continue}return null}if(item.shortcut){const keys=normalize(item.shortcut).split(' ');if(terms.every(t=>keys.includes(t)||(aliases.get(t)||[]).some(a=>keys.includes(a))))score+=40}return{...item,score}}).filter(Boolean).sort((a,b)=>b.score-a.score)}
const hints={
 'settings-ui-sfx-toggle':'quiet clicks mute buttons interface effects',
 'settings-master-volume':'all audio overall loud quiet music',
 'settings-ui-volume':'button click sound effects',
 'settings-scroll-speed':'wheel sensitivity trackpad zoom speed',
 'settings-default-view':'starting zoom default scale',
 'settings-site-font-size':'bigger text larger lettering readability',
 'settings-site-font':'typeface typography lettering',
 'settings-square-corners':'rounded round edges square corners',
 'settings-language':'translate translation english spanish french',
 'settings-tile-delete-toggle':'hover corners tile options fullscreen pin delete'
};
const controllers=[];
function mount(pane,kind){
 const help=kind==='help',title=help?'Help':'Settings';
 const search=document.createElement('form');search.className='panel-search';search.setAttribute('role','search');search.setAttribute('aria-label',title+' search');
 search.innerHTML='<div class="panel-search__field"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input type="search" maxlength="160" autocomplete="off" spellcheck="false"><button type="button" class="panel-search__clear" aria-label="Clear search" hidden>×</button></div><p class="panel-search__status" role="status" aria-live="polite"></p>';
 const input=search.querySelector('input'),clear=search.querySelector('button'),status=search.querySelector('p');input.id=kind+'-search';input.placeholder=help?'Search Help — try “move tiles”':'Search Settings — try “font size”';input.setAttribute('aria-label','Search '+title);
 const results=document.createElement('div');results.id=kind+'-search-results';results.className='panel-search__results';results.hidden=true;
 pane.querySelector('.help-search-coming')?.remove();pane.querySelector('.settings-page-heading').after(search);search.after(results);
 let timer=0;const filtered=new Set();let matches=[];
 function items(){
  const selectors=help?'.help-shortcut,.help-mouse-list>div,[data-help-topic]':'.settings-row';
  return [...pane.querySelectorAll(selectors)].filter(el=>!el.parentElement.closest('[data-help-topic]')).map(el=>{
   const control=el.querySelector('input,select,button'),shortcut=el.matches('.help-shortcut');
   const title=el.dataset.searchTitle||(shortcut?el.querySelector('span')?.textContent:el.querySelector('strong,h2,h3,h4')?.textContent)||'Help Topic';
   const category=help?(el.closest('.help-section')?.querySelector('.help-section__heading strong')?.textContent||'Tutorials'):el.closest('.settings-card')?.querySelector('.settings-card__title strong')?.textContent;
   const caption=shortcut?el.querySelector('div')?.textContent:el.querySelector('small,p,[data-search-summary]')?.textContent;
   const transcript=el.dataset.searchTranscript||el.querySelector('[data-search-transcript]')?.textContent||'';
   return{el,shortcut:shortcut?el.querySelector('div')?.textContent:'',title:title.trim(),category:category||title,text:[caption,el.querySelector('select')?.textContent,transcript].filter(Boolean).join(' '),caption:caption?.trim()||'',keywords:[category,el.dataset.searchKeywords,hints[control?.id],shortcut?el.querySelector('div')?.textContent:'',el.dataset.helpType].filter(Boolean).join(' '),type:el.dataset.helpType|| (shortcut?'Shortcut':help?'Guide':'Setting')};
  });
 }
 function reset(){input.value='';update()}
 function hide(el){el.classList.add('panel-search-filtered');filtered.add(el)}
 function update(){
  clearTimeout(timer);for(const el of filtered)el.classList.remove('panel-search-filtered');filtered.clear();
  const query=input.value.trim(),active=!!query;clear.hidden=!active;results.hidden=true;results.replaceChildren();status.textContent='';matches=[];
  if(!active)return;
  const entries=items();matches=rank(entries,query);const visible=new Set(matches.map(item=>item.el));
  status.textContent=matches.length+' '+(matches.length===1?'result':'results');
  // Keep the original controls and their event handlers in place; filter only presentation.
  for(const item of entries)if(!visible.has(item.el))hide(item.el);
  const containers=new Set();
  for(const item of entries){let parent=item.el.parentElement;while(parent&&parent!==pane){containers.add(parent);parent=parent.parentElement}}
  for(const container of containers)if(!matches.some(item=>container.contains(item.el)))hide(container);
  for(const child of pane.children){if(child===search||child===results||child.matches('.settings-page-heading'))continue;if(!matches.some(item=>child===item.el||child.contains(item.el)))hide(child)}
  if(!matches.length){results.hidden=false;const empty=document.createElement('div');empty.className='panel-search__empty';const heading=document.createElement('strong');heading.textContent='No Matches Yet';const copy=document.createElement('p');copy.textContent=help?'Try fewer words, such as “zoom”, “copy”, or “keyboard”.':'Try a setting name, such as “sound”, “font”, or “language”.';const back=document.createElement('button');back.type='button';back.textContent='Show All '+title;back.onclick=()=>{reset();input.focus()};empty.append(heading,copy,back);results.append(empty)}
 }
 input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(update,100)});
 clear.addEventListener('click',()=>{reset();input.focus()});
 search.addEventListener('submit',event=>{event.preventDefault();update()});
 input.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&input.value){event.stopPropagation();event.preventDefault();reset()}
  else if(event.key==='ArrowDown'){
   event.preventDefault();update();const first=matches[0]?.el,target=first?.querySelector('input,select,button,summary,a[href]')||first||results.querySelector('button');
   if(target){if(!target.matches('input,select,button,summary,a[href]')&&!target.hasAttribute('tabindex')){target.tabIndex=-1;target.addEventListener('blur',()=>target.removeAttribute('tabindex'),{once:true})}target.focus()}
  }
 });
 controllers.push({update});
}
function setup(){for(const name of ['settings','help']){const pane=document.querySelector('[data-settings-pane="'+name+'"]');if(pane)mount(pane,name)}window.addEventListener('teachertiles:settings-tab',()=>controllers.forEach(c=>c.update()))}
window.TeacherTilesPanelSearch=Object.freeze({rank,refresh:()=>controllers.forEach(c=>c.update())});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
