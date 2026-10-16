window.createThemePicker=function({panel,packs,owns,entitlement,requestAccess,apply,crown}){
  panel.querySelector('.asset-shelf__scroll').hidden=true;
  const root=document.createElement('div');root.className='theme-picker';root.innerHTML='<div class="theme-picker-toolbar"><label class="theme-picker-search"><span aria-hidden="true">⌕</span><input type="search" aria-label="Search themes" placeholder="Search Themes"></label><button type="button" class="theme-picker-filter-toggle" aria-expanded="false" aria-controls="theme-picker-options"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="var(--surface-solid)"/><circle cx="15" cy="17" r="3" fill="var(--surface-solid)"/></svg><span>Filters</span></button></div><div id="theme-picker-options" class="theme-picker-options" hidden><div class="theme-picker-order"><label>Category<select data-theme-category aria-label="Filter theme category"><option value="all">All Themes</option><option value="solid">Solid</option><option value="animated">Animated</option><option value="holiday">Holiday</option></select></label><label>Sort<select data-theme-sort aria-label="Sort theme packs"><option value="organized">Grouped</option><option value="name">A–Z</option><option value="owned">Owned First</option></select></label></div><div class="theme-picker-filter"><span class="theme-picker-count" role="status"></span><label>Owned Only <input type="checkbox" role="switch"><i aria-hidden="true"></i></label></div></div><div class="theme-picker-results"></div><p class="theme-picker-applied" role="status"></p>';panel.append(root);
  const results=root.querySelector('.theme-picker-results'),search=root.querySelector('input[type=search]'),owned=root.querySelector('input[type=checkbox]'),count=root.querySelector('.theme-picker-count'),applied=root.querySelector('.theme-picker-applied');
  const category=root.querySelector('[data-theme-category]'),sort=root.querySelector('[data-theme-sort]');
  const filterToggle=root.querySelector('.theme-picker-filter-toggle'),filterOptions=root.querySelector('.theme-picker-options');
  function setFiltersOpen(open){filterOptions.hidden=!open;filterToggle.setAttribute('aria-expanded',String(open));if(active)position()}
  filterToggle.addEventListener('click',()=>setFiltersOpen(filterOptions.hidden));
  filterOptions.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();setFiltersOpen(false);filterToggle.focus()}});
  const categories={default:'Default',solid:'Solid',animated:'Animated',holiday:'Holiday'};
  const groupTitles=Object.fromEntries(Object.entries(categories).map(([key,label])=>{const title=document.createElement('h4');title.className='theme-picker-group-title';title.textContent=label;results.append(title);return [key,title]}));
  const fan=document.createElement('div');fan.className='theme-picker theme-pack-fan';fan.setAttribute('popover','manual');fan.setAttribute('aria-label','Themes in this pack');fan.innerHTML='<header><div><small>EXPLORE THE PACK</small><h3></h3></div><button type="button" aria-label="Close theme pack">×</button></header><div class="theme-pack-stage"></div>';document.body.append(fan);const stage=fan.querySelector('.theme-pack-stage');let active=null;
  function close(){if(active)active.heading.setAttribute('aria-expanded','false');active=null;fan.hidePopover()}
  function position(){if(!active)return;const shelf=panel.closest('.asset-shelf__shell').getBoundingClientRect(),anchor=active.heading.getBoundingClientRect();const narrow=innerWidth<760,width=narrow?Math.min(500,innerWidth-32):Math.min(540,innerWidth-shelf.right-32);fan.style.width=width+'px';fan.style.left=(narrow?16:shelf.right+14)+'px';fan.style.top=Math.max(16,Math.min(anchor.top,innerHeight-fan.offsetHeight-20))+'px'}
  function open(group){if(active===group){close();return}close();active=group;group.heading.setAttribute('aria-expanded','true');fan.querySelector('h3').textContent=group.name;stage.replaceChildren(...group.cards.filter(item=>!item.card.hidden).map(item=>item.card));[...stage.children].forEach((card,i)=>{card.style.setProperty('--fan-index',i);card.style.setProperty('--fan-angle',((i%3)-1)*3+'deg')});fan.showPopover();position();stage.querySelector('button')?.focus({preventScroll:true})}
  fan.querySelector('header button').onclick=close;
  const groups=packs.map((pack,index)=>{
    const sourceFan=document.getElementById(pack.getAttribute('aria-controls')),name=pack.querySelector('strong')?.textContent||'Themes';const section=document.createElement('section');section.className='theme-picker-pack';const heading=document.createElement('button');heading.type='button';heading.className='theme-picker-pack-heading';heading.setAttribute('aria-expanded','false');heading.innerHTML='<span class="theme-pack-stack" aria-hidden="true"></span><span class="theme-pack-label"><strong></strong><small></small></span><span class="theme-pack-arrow" aria-hidden="true">›</span>';heading.querySelector('strong').textContent=name;if(pack.dataset.holiday){const holiday=document.createElement('span');holiday.className='holiday-badge';holiday.textContent='Holiday';holiday.title=pack.dataset.holiday==='halloween'?'Halloween':'Christmas';heading.querySelector('.theme-pack-label').append(holiday)}const badge=heading.querySelector('small');section.append(heading);results.append(section);
    const kind=pack.id==='default-theme-pack'?'default':pack.dataset.holiday?'holiday':sourceFan.querySelector('.animated-theme-preview')?'animated':'solid';
    const animated=Boolean(sourceFan.querySelector('.animated-theme-preview'))&&pack.id!=='pumpkin-theme-pack';
    const cards=[...sourceFan.querySelectorAll('[data-theme-choice]')].map((source,i)=>{const card=source.cloneNode(true);card.removeAttribute('id');card.classList.remove('is-cosmetic-locked');const product=entitlement(source);card.dataset.entitlement=product;card.querySelectorAll('.subscription-access-crown').forEach(el=>el.remove());card.title=source.querySelector('strong')?.textContent||card.dataset.themeChoice;card.onclick=()=>{if(!owns(product)){requestAccess(card);return}apply(card.dataset.themeChoice);if(!matchMedia('(prefers-reduced-motion: reduce)').matches)card.animate([{transform:'rotate(0deg) scale(1)'},{transform:'rotate(0deg) scale(1.07)',filter:'brightness(1.12)'},{transform:'rotate(0deg) scale(1)'}],{duration:360,easing:'ease-out'});refresh()};
      if(i<3){const sample=document.createElement('span');sample.className=source.className+' theme-pack-sample';sample.style.setProperty('--sample',i);sample.innerHTML=source.innerHTML;sample.querySelectorAll('.theme-card__check,.subscription-access-crown').forEach(el=>el.remove());heading.querySelector('.theme-pack-stack').append(sample)}
      return {card,product,text:(name+' '+card.textContent+' '+card.dataset.themeChoice+' '+(pack.dataset.holiday||'')+' '+categories[kind]).toLowerCase()};});
    const products=[...new Set(cards.map(item=>item.product).filter(Boolean))];
    const product=products.length===1?products[0]:'';
    if(product)heading.dataset.entitlement=product;
    const group={section,heading,badge,cards,name,product,kind,animated,index};
    heading.onclick=()=>{if(group.product&&!owns(group.product)){requestAccess(heading);return}open(group)};
    return group;
  });
  function refresh(){const terms=search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);let total=0;
    for(const group of groups){
      let visible=0;
      for(const item of group.cards){
        const accessible=!item.product||owns(item.product),show=(!owned.checked||accessible)&&(category.value==='all'||category.value===group.kind||(category.value==='animated'&&group.animated))&&terms.every(term=>item.text.includes(term));
        item.card.hidden=!show;if(show)visible++;
        item.card.classList.toggle('theme-picker-locked',!accessible);
        item.card.setAttribute('aria-label',(accessible?'Apply ':'Unlock ')+item.card.title);
        item.card.setAttribute('aria-pressed',String(item.card.dataset.themeChoice===document.body.dataset.theme));
        crown(item.card,item.product);
      }
      const packLocked=Boolean(group.product&&!owns(group.product));
      group.section.hidden=!visible;
      group.badge.textContent=(packLocked?'Locked · ':'')+visible+(visible===1?' theme':' themes');
      group.heading.classList.toggle('theme-picker-pack-locked',packLocked);
      group.heading.classList.toggle('is-cosmetic-locked',packLocked);
      group.heading.setAttribute('aria-disabled',String(packLocked));
      group.heading.setAttribute('aria-label',packLocked?`Unlock ${group.name} theme pack in Shop`:`Open ${group.name} theme pack`);
      total+=visible;
      group.heading.classList.toggle('has-selected-theme',group.cards.some(item=>item.card.dataset.themeChoice===document.body.dataset.theme));
    }
    const visible=groups.filter(group=>!group.section.hidden);
    Object.values(groupTitles).forEach(title=>title.hidden=true);
    const compare=(a,b)=>sort.value==='owned'?(Number(!a.product||owns(a.product))-Number(!b.product||owns(b.product)))*-1||a.name.localeCompare(b.name):a.name.localeCompare(b.name);
    if(sort.value==='organized'){
      for(const key of Object.keys(categories)){
        const matching=visible.filter(group=>group.kind===key);
        const title=groupTitles[key];title.hidden=!matching.length;results.append(title);
        // Keep the familiar color progression (Pastel, Basic, Polka Dot).
        matching.sort((a,b)=>key==='solid'||key==='default'?a.index-b.index:a.name.localeCompare(b.name)).forEach(group=>results.append(group.section));
      }
    }else visible.sort(compare).forEach(group=>results.append(group.section));
    const filtered=owned.checked||category.value!=='all'||sort.value!=='organized';
    filterToggle.classList.toggle('has-active-filters',filtered);
    filterToggle.setAttribute('aria-label',filtered?'Filters (active)':'Filters');
    count.textContent=total?total+(total===1?' theme · ':' themes · ')+groups.filter(g=>!g.section.hidden).length+(groups.filter(g=>!g.section.hidden).length===1?' pack':' packs'):'No matching themes';const selected=groups.flatMap(g=>g.cards).find(item=>item.card.dataset.themeChoice===document.body.dataset.theme);applied.textContent=selected?'✓ '+selected.card.title+' is applied':'Open a pack to explore';if(active){if(active.section.hidden||Boolean(active.product&&!owns(active.product)))close();else{const cards=active.cards.filter(item=>!item.card.hidden).map(item=>item.card);if(cards.length!==stage.children.length||cards.some((card,i)=>stage.children[i]!==card))stage.replaceChildren(...cards);position()}}
  }
  category.addEventListener('change',()=>{close();refresh();results.scrollTop=0});sort.addEventListener('change',()=>{close();refresh();results.scrollTop=0});
  search.addEventListener('input',refresh);owned.addEventListener('change',refresh);for(const event of ['teachertiles:accountchange','teachertiles:shopownershipchange','teachertiles:themechange'])window.addEventListener(event,refresh);
  document.addEventListener('pointerdown',e=>{if(active&&!fan.contains(e.target)&&!active.heading.contains(e.target))close()});fan.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();const button=active?.heading;close();button?.focus()}});window.addEventListener('resize',position);results.addEventListener('scroll',close,{passive:true});refresh();return {refresh,close,open(){setFiltersOpen(false);refresh();search.focus({preventScroll:true})}};
};
