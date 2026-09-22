window.createThemePicker=function({panel,packs,owns,entitlement,requestAccess,apply,crown}){
  panel.querySelector('.asset-shelf__scroll').hidden=true;
  const root=document.createElement('div');root.className='theme-picker';
  root.innerHTML='<div class="theme-picker-intro">A new mood for your board.</div><label class="theme-picker-search"><span aria-hidden="true">⌕</span><input type="search" aria-label="Search themes" placeholder="Search colors, materials, moods…"></label><div class="theme-picker-filter"><span class="theme-picker-count" role="status"></span><label>Owned only <input type="checkbox" role="switch"><i aria-hidden="true"></i></label></div><div class="theme-picker-results"></div><p class="theme-picker-applied" role="status"></p>';
  panel.append(root);const results=root.querySelector('.theme-picker-results'),search=root.querySelector('input[type=search]'),owned=root.querySelector('input[type=checkbox]'),count=root.querySelector('.theme-picker-count'),applied=root.querySelector('.theme-picker-applied');
  const groups=packs.map(pack=>{
    const fan=document.getElementById(pack.getAttribute('aria-controls')),name=pack.querySelector('strong')?.textContent||'Themes';
    const section=document.createElement('section');section.className='theme-picker-pack';const heading=document.createElement('button');heading.className='theme-picker-pack-heading';heading.type='button';heading.setAttribute('aria-expanded','true');const label=document.createElement('strong');label.textContent=name;const badge=document.createElement('span');heading.append(label,badge);
    const body=document.createElement('div');body.className='theme-picker-pack-body';const grid=document.createElement('div');grid.className='theme-picker-grid';body.append(grid);section.append(heading,body);results.append(section);
    heading.onclick=()=>{const open=heading.getAttribute('aria-expanded')!=='true';heading.setAttribute('aria-expanded',String(open));section.classList.toggle('is-collapsed',!open);body.inert=!open};
    const cards=[...fan.querySelectorAll('[data-theme-choice]')].map(source=>{
      const card=source.cloneNode(true);card.removeAttribute('id');card.classList.remove('is-cosmetic-locked');const product=entitlement(source);card.dataset.entitlement=product;card.querySelectorAll('.subscription-access-crown').forEach(el=>el.remove());card.title=source.querySelector('strong')?.textContent||card.dataset.themeChoice;
      const text=(name+' '+card.textContent+' '+card.dataset.themeChoice).toLowerCase();card.onclick=()=>{if(!owns(product)){requestAccess(card);return}apply(card.dataset.themeChoice);refresh()};grid.append(card);return {card,product,text};
    });return {section,heading,badge,cards};
  });
  function refresh(){
    const terms=search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);let total=0;
    for(const group of groups){let visible=0;for(const item of group.cards){const accessible=owns(item.product),show=(!owned.checked||accessible)&&terms.every(term=>item.text.includes(term));item.card.hidden=!show;if(show)visible++;item.card.classList.toggle('theme-picker-locked',!accessible);item.card.setAttribute('aria-label',(accessible?'Apply ':'Unlock ')+item.card.title);item.card.setAttribute('aria-pressed',String(item.card.dataset.themeChoice===document.body.dataset.theme));crown(item.card,item.product)}group.section.hidden=!visible;group.badge.textContent=visible+' '+(visible===1?'theme':'themes')+'  ⌄';total+=visible;
      if(terms.length){group.heading.setAttribute('aria-expanded','true');group.section.classList.remove('is-collapsed');group.heading.nextElementSibling.inert=false}
    }
    count.textContent=total?total+' themes':'No matching themes';const active=groups.flatMap(group=>group.cards).find(item=>item.card.dataset.themeChoice===document.body.dataset.theme);applied.textContent=active?'✓ '+active.card.title+' is applied':'Choose a theme to apply it';
  }
  search.addEventListener('input',refresh);owned.addEventListener('change',refresh);
  for(const event of ['teachertiles:accountchange','teachertiles:shopownershipchange','teachertiles:themechange'])window.addEventListener(event,refresh);
  refresh();return {refresh,open(){refresh();search.focus({preventScroll:true})}};
};
