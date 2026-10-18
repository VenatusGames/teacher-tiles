function setupShopExtras(modal) {
  if(modal.querySelector('[data-shop-page="planner-skins"]'))return;
  const skins=window.TeacherTilesPlannerSkins,frames=window.TeacherTilesProfileFrames,themes=window.TeacherTilesPresentationThemes,transitions=window.TeacherTilesPresentationTransitions;
  function page(id,title,description){
    const section=document.createElement('section');section.className='shop-page';section.dataset.shopPage=id;section.hidden=true;
    section.innerHTML='<div class="shop-page-heading"><button class="shop-back" type="button" data-shop-open-page="home" aria-label="Back to shop home">←</button><div><span>COLLECTION</span><h2></h2><p></p></div></div><div class="shop-product-grid shop-product-grid--extras"></div>';
    section.querySelector('h2').textContent=title;section.querySelector('p').textContent=description;modal.querySelector('.shop-content').append(section);return section;
  }
  function product(item,kind,preview){
    const card=document.createElement('article');card.className='shop-product shop-product--'+kind;card.dataset.shopProduct=item.productId;card.dataset.shopPrice=item.price;
    card.innerHTML='<div class="shop-product__preview" aria-hidden="true"></div><div class="shop-product__body"><div><span class="shop-product__type"></span><h3></h3><p></p></div><button class="shop-buy" type="button" data-shop-buy><span class="shop-coin-icon shop-coin-icon--small" aria-hidden="true"><img src="assets/shop/coin.png" alt=""></span><strong></strong></button></div>';
    card.querySelector('h3').textContent=item.name;card.querySelector('p').textContent=item.description;card.querySelector('.shop-buy strong').textContent=item.price;
    card.querySelector('.shop-product__type').textContent=kind==='presentation-transition'?'PRESENTATION TRANSITION':kind==='presentation-theme'?'PRESENTATION THEME':kind==='planner-skin'?'PLANNER SKIN':item.tier==='animated'?'ANIMATED PROFILE FRAME':'PROFILE FRAME';
    const art=card.querySelector('.shop-product__preview');art.classList.add('shop-product__preview--'+(kind.startsWith('presentation-')?'presentation':kind==='planner-skin'?'planner':'frame'));art.append(preview);
    if(kind==='presentation-transition'||kind==='profile-frame'&&item.tier==='animated'){
      const badge=document.createElement('span');badge.className='shop-animated-badge';badge.textContent='ANIMATED';art.append(badge);
    }
    return card;
  }
  const planners=page('planner-skins','Planner Skins','A personal touch for your planning shelf. Choose a cover for each book.');
  for(const skin of skins.catalog)planners.querySelector('.shop-product-grid').append(product(skin,'planner-skin',skins.preview(skin.id)));
  const presentations=page('presentation-themes','Presentation Themes','');
  for(const theme of themes.catalog)presentations.querySelector('.shop-product-grid').append(product(theme,'presentation-theme',themes.preview(theme.id)));
  const transitionPage=page('presentation-transitions','Transitions','');
  for(const item of transitions.catalog)transitionPage.querySelector('.shop-product-grid').append(product(item,'presentation-transition',transitions.preview(item.id)));
  transitionPage.querySelector('.shop-back').dataset.shopOpenPage='presentations';
  modal.addEventListener('pointerover',event=>{let preview=event.target.closest('[data-transition-preview]');if(!preview||preview.contains(event.relatedTarget))return;if(!preview.play){const replacement=transitions.preview(preview.dataset.transitionPreview);preview.replaceWith(replacement);preview=replacement;}preview.play();});
  const presentationHome=page('presentations','Presentations','');
  const collections=presentationHome.querySelector('.shop-product-grid');collections.className='shop-presentation-collections';
  for(const [title,kind] of [['Presentation Themes','themes'],['Transitions','transitions'],['Coming Soon','future'],['Coming Soon','future']]){
    const button=document.createElement('button');button.type='button';button.className='shop-category shop-presentation-collection';button.dataset.collectionKind=kind;
    button.innerHTML='<span class="shop-category__art shop-presentation-art" aria-hidden="true"></span><span class="shop-category__copy"><strong>'+title+'</strong>'+'</span>';
    const art=button.querySelector('.shop-category__art');
    if(kind==='themes')for(const id of ['pastel-blue','pastel-purple','notebook-paper'])art.append(themes.preview(id));
    else if(kind==='transitions')for(const id of ['iris','flip'])art.append(transitions.preview(id));
    else art.innerHTML='<span class="shop-presentation-placeholder"></span><span class="shop-presentation-placeholder"></span>';
    if(kind==='themes')button.dataset.shopOpenPage='presentation-themes';else if(kind==='transitions')button.dataset.shopOpenPage='presentation-transitions';else{button.disabled=true;button.classList.add('shop-category--coming-soon');}collections.append(button);
  }
  const themesBack=presentations.querySelector('.shop-back');themesBack.dataset.shopOpenPage='presentations';themesBack.setAttribute('aria-label','Back to Presentations');
  const profiles=page('profile-cosmetics','Profile Cosmetics','Frame your profile. Basic colors · 10 coins. Decorative · 25 coins. Animated · 40 coins.');
  for(const frame of frames.catalog)profiles.querySelector('.shop-product-grid').append(product(frame,'profile-frame',frames.preview(frame.id)));
  const categories=[['planner-skins','Planner Skins','Covers for Your Plans'],['presentation-themes','Presentations',''],['profile-cosmetics','Profile Cosmetics','Frames for Your Profile'],['tile-effects','Tile Effects','Coming Soon']];
  for(const [id,title,subtitle] of categories){
    const category=document.createElement('button');category.type='button';category.className='shop-category shop-category--'+id;category.dataset.shopCategory=id;
    category.innerHTML='<span class="shop-category__art shop-category__art--extras" aria-hidden="true"></span><span class="shop-category__copy"><strong></strong><em></em></span>';
    category.querySelector('strong').textContent=title;category.querySelector('em').textContent=subtitle;
    const art=category.querySelector('.shop-category__art');
    if(id==='planner-skins'){category.dataset.shopOpenPage=id;for(const skin of skins.catalog.slice(0,2))art.append(skins.preview(skin.id));}
    else if(id==='presentation-themes'){category.dataset.shopOpenPage='presentations';art.append(themes.preview('pastel-purple'));}
    else if(id==='profile-cosmetics'){category.dataset.shopOpenPage=id;art.append(frames.preview('aurora'));}
    else{category.disabled=true;category.classList.add('shop-category--coming-soon');art.innerHTML=id==='presentation-themes'?'<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="10" width="46" height="32" rx="5"/><path d="M32 42v12M22 55l10-7 10 7M19 21h26M19 30h16"/></svg>':'<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="13" y="22" width="30" height="30" rx="7"/><path d="m45 7 3 8 8 3-8 3-3 8-3-8-8-3 8-3 3-8ZM15 8v8M11 12h8M52 40v8M48 44h8"/></svg>';}
    modal.querySelector('.shop-category-grid').append(category);
  }
}
