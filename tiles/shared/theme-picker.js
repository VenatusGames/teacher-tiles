window.createThemePicker=function({panel,packs,owns,entitlement,requestAccess,apply,crown}){
  panel.querySelector('.asset-shelf__scroll').hidden=true;
  const root=document.createElement('div');root.className='theme-picker';root.innerHTML='<div class="theme-picker-intro">Pick a pack. Find your mood.</div><label class="theme-picker-search"><span aria-hidden="true">⌕</span><input type="search" aria-label="Search themes" placeholder="Find your next theme…"></label><div class="theme-picker-filter"><span class="theme-picker-count" role="status"></span><label>Owned only <input type="checkbox" role="switch"><i aria-hidden="true"></i></label></div><div class="theme-picker-results"></div><p class="theme-picker-applied" role="status"></p>';panel.append(root);
  const results=root.querySelector('.theme-picker-results'),search=root.querySelector('input[type=search]'),owned=root.querySelector('input[type=checkbox]'),count=root.querySelector('.theme-picker-count'),applied=root.querySelector('.theme-picker-applied');
  const fan=document.createElement('div');fan.className='theme-picker theme-pack-fan';fan.setAttribute('popover','manual');fan.setAttribute('aria-label','Themes in this pack');fan.innerHTML='<header><div><small>EXPLORE THE PACK</small><h3></h3></div><button type="button" aria-label="Close theme pack">×</button></header><div class="theme-pack-stage"></div>';document.body.append(fan);const stage=fan.querySelector('.theme-pack-stage');let active=null;
  function close(){if(active)active.heading.setAttribute('aria-expanded','false');active=null;fan.hidePopover()}
  function position(){if(!active)return;const shelf=panel.closest('.asset-shelf__shell').getBoundingClientRect(),anchor=active.heading.getBoundingClientRect();const narrow=innerWidth<760,width=narrow?Math.min(500,innerWidth-32):Math.min(540,innerWidth-shelf.right-32);fan.style.width=width+'px';fan.style.left=(narrow?16:shelf.right+14)+'px';fan.style.top=Math.max(16,Math.min(anchor.top,innerHeight-fan.offsetHeight-20))+'px'}
  function open(group){if(active===group){close();return}close();active=group;group.heading.setAttribute('aria-expanded','true');fan.querySelector('h3').textContent=group.name;stage.replaceChildren(...group.cards.filter(item=>!item.card.hidden).map(item=>item.card));[...stage.children].forEach((card,i)=>{card.style.setProperty('--fan-index',i);card.style.setProperty('--fan-angle',((i%3)-1)*3+'deg')});fan.showPopover();position();stage.querySelector('button')?.focus({preventScroll:true})}
  fan.querySelector('header button').onclick=close;
  const groups=packs.map(pack=>{
    const sourceFan=document.getElementById(pack.getAttribute('aria-controls')),name=pack.querySelector('strong')?.textContent||'Themes';const section=document.createElement('section');section.className='theme-picker-pack';const heading=document.createElement('button');heading.type='button';heading.className='theme-picker-pack-heading';heading.setAttribute('aria-expanded','false');heading.innerHTML='<span class="theme-pack-stack" aria-hidden="true"></span><span class="theme-pack-label"><strong></strong><small></small></span><span class="theme-pack-arrow" aria-hidden="true">›</span>';heading.querySelector('strong').textContent=name;const badge=heading.querySelector('small');section.append(heading);results.append(section);
    const cards=[...sourceFan.querySelectorAll('[data-theme-choice]')].map((source,i)=>{const card=source.cloneNode(true);card.removeAttribute('id');card.classList.remove('is-cosmetic-locked');const product=entitlement(source);card.dataset.entitlement=product;card.querySelectorAll('.subscription-access-crown').forEach(el=>el.remove());card.title=source.querySelector('strong')?.textContent||card.dataset.themeChoice;card.onclick=()=>{if(!owns(product)){requestAccess(card);return}apply(card.dataset.themeChoice);if(!matchMedia('(prefers-reduced-motion: reduce)').matches)card.animate([{transform:'rotate(0deg) scale(1)'},{transform:'rotate(0deg) scale(1.07)',filter:'brightness(1.12)'},{transform:'rotate(0deg) scale(1)'}],{duration:360,easing:'ease-out'});refresh()};
      if(i<3){const sample=document.createElement('span');sample.className=source.className+' theme-pack-sample';sample.style.setProperty('--sample',i);sample.innerHTML=source.innerHTML;sample.querySelectorAll('.theme-card__check,.subscription-access-crown').forEach(el=>el.remove());heading.querySelector('.theme-pack-stack').append(sample)}
      return {card,product,text:(name+' '+card.textContent+' '+card.dataset.themeChoice).toLowerCase()};});
    const products=[...new Set(cards.map(item=>item.product).filter(Boolean))];
    const product=products.length===1?products[0]:'';
    if(product)heading.dataset.entitlement=product;
    const group={section,heading,badge,cards,name,product};
    heading.onclick=()=>{if(group.product&&!owns(group.product)){requestAccess(heading);return}open(group)};
    return group;
  });
  function refresh(){const terms=search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);let total=0;
    for(const group of groups){
      let visible=0;
      for(const item of group.cards){
        const accessible=!item.product||owns(item.product),show=(!owned.checked||accessible)&&terms.every(term=>item.text.includes(term));
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
    count.textContent=total?total+(total===1?' theme · ':' themes · ')+groups.filter(g=>!g.section.hidden).length+(groups.filter(g=>!g.section.hidden).length===1?' pack':' packs'):'No matching themes';const selected=groups.flatMap(g=>g.cards).find(item=>item.card.dataset.themeChoice===document.body.dataset.theme);applied.textContent=selected?'✓ '+selected.card.title+' is applied':'Open a pack to explore';if(active){if(active.section.hidden||Boolean(active.product&&!owns(active.product)))close();else{const cards=active.cards.filter(item=>!item.card.hidden).map(item=>item.card);if(cards.length!==stage.children.length||cards.some((card,i)=>stage.children[i]!==card))stage.replaceChildren(...cards);position()}}
  }
  search.addEventListener('input',refresh);owned.addEventListener('change',refresh);for(const event of ['teachertiles:accountchange','teachertiles:shopownershipchange','teachertiles:themechange'])window.addEventListener(event,refresh);
  document.addEventListener('pointerdown',e=>{if(active&&!fan.contains(e.target)&&!active.heading.contains(e.target))close()});fan.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();const button=active?.heading;close();button?.focus()}});window.addEventListener('resize',position);results.addEventListener('scroll',close,{passive:true});refresh();return {refresh,close,open(){refresh();search.focus({preventScroll:true})}};
};
