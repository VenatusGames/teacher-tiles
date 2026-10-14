// A bounded, rotating display of the existing catalog. Purchases use the shop's normal flow.
function createShopFeaturedLibrary({modal, sources, mount, unmount, sync, canRotate}){
  const root=modal.querySelector('.shop-featured-library');
  const stage=root.querySelector('.shop-library-stage');
  const showcase=root.querySelector('.shop-library-showcase');
  const medium=root.querySelector('.shop-library-medium');
  const filters=root.querySelector('.shop-library-filters');
  const counter=root.querySelector('.shop-library-count');
  const pause=root.querySelector('[data-library-pause]');
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const compact=matchMedia('(max-width: 650px)');
  const categories=[['all','All Cosmetics'],['themes','Themes'],['tile-skins','Tile Skins'],['stickers','Stickers'],['cursors','Cursors'],['planner-skins','Planners'],['profile-cosmetics','Profiles']];
  const accents={'themes':'#809adc','tile-skins':'#a58bd0','stickers':'#dc9b72','cursors':'#7eafb2','planner-skins':'#85aa91','profile-cosmetics':'#cd91b3'};
  let catalog=[],pool=[],cards=[],index=0,filter='all',timer=0,active=false,inView=false,hover=false,paused=motion.matches;
  const count=()=>Math.min(compact.matches?7:12,pool.length);
  function schedule(){
    clearTimeout(timer);
    if(!active||!inView||hover||paused||motion.matches||document.hidden||root.contains(document.activeElement)||pool.length<=count())return;
    timer=setTimeout(()=>{if(canRotate())move(count());else schedule()},12000);
  }
  function render(){
    for(const card of cards)unmount(card);
    cards=[];
    const fragment=document.createDocumentFragment();
    showcase.replaceChildren();
    medium.replaceChildren();
    root.classList.toggle('is-single-product',pool.length===1);
    for(let offset=0;offset<count();offset++){
      const source=pool[(index+offset)%pool.length];
      const card=source.cloneNode(true);
      card.hidden=false;card.classList.remove('shop-filter-hidden','is-shop-highlighted','is-purchasing');
      card.classList.add('shop-library-card');
      card.classList.toggle('shop-library-card--showcase',offset===0);
      card.classList.toggle('shop-library-card--medium',offset>0&&offset<4);
      card.style.setProperty('--library-accent',accents[source.closest('[data-shop-page]').dataset.shopPage]);
      card.style.setProperty('--library-order',offset);
      card.querySelectorAll('[id]').forEach(node=>{if(!node.closest('svg'))node.removeAttribute('id')});
      mount(card);cards.push(card);
      if(offset===0)showcase.append(card);else if(offset<4)medium.append(card);else fragment.append(card);
    }
    stage.replaceChildren(fragment);
    sync();
    counter.textContent=pool.length?`${index+1} / ${pool.length} cosmetics`:'Your collection is complete';
    root.querySelector('.shop-library-empty').hidden=pool.length>0;
    root.querySelectorAll('[data-library-step]').forEach(button=>button.disabled=pool.length<=count());
    pause.disabled=pool.length<=count()||motion.matches;
    pause.setAttribute('aria-pressed',String(paused||motion.matches));
    pause.setAttribute('aria-label',paused||motion.matches?'Resume featured rotation':'Pause featured rotation');
    pause.innerHTML=paused||motion.matches?'<svg viewBox="0 0 24 24"><path d="m9 5 10 7-10 7Z"/></svg>':'<svg viewBox="0 0 24 24"><path d="M9 5v14M15 5v14"/></svg>';
    schedule();
  }
  function move(amount){if(!pool.length)return;index=(index+amount+pool.length)%pool.length;render()}
  function select(value){
    filter=value;pool=catalog.filter(source=>filter==='all'||source.closest('[data-shop-page]').dataset.shopPage===filter);index=0;
    filters.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.libraryFilter===filter)));
    render();
  }
  for(const [value,label] of categories){
    const button=document.createElement('button');button.type='button';button.dataset.libraryFilter=value;button.textContent=label;
    button.addEventListener('click',()=>select(value));filters.append(button);
  }
  root.querySelectorAll('[data-library-step]').forEach(button=>button.addEventListener('click',()=>move(Number(button.dataset.libraryStep)*count())));
  pause.addEventListener('click',()=>{paused=!paused;pause.setAttribute('aria-pressed',String(paused));pause.setAttribute('aria-label',paused?'Resume featured rotation':'Pause featured rotation');pause.innerHTML=paused?'<svg viewBox="0 0 24 24"><path d="m9 5 10 7-10 7Z"/></svg>':'<svg viewBox="0 0 24 24"><path d="M9 5v14M15 5v14"/></svg>';schedule()});
  root.addEventListener('pointerenter',()=>{hover=true;schedule()});root.addEventListener('pointerleave',()=>{hover=false;schedule()});
  root.addEventListener('focusin',schedule);root.addEventListener('focusout',()=>queueMicrotask(schedule));
  document.addEventListener('visibilitychange',schedule);
  motion.addEventListener('change',()=>{paused=motion.matches;render()});compact.addEventListener('change',render);
  new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;schedule()},{threshold:.25}).observe(root);
  return {
    refresh(){
      const owned=new Set(window.TeacherTilesAccount?.state?.ownedProductIds||[]);
      // Interleave categories so smaller collections get seen alongside large catalogs.
      const groups=categories.slice(1).map(([category])=>{
        const list=sources.filter(source=>source.closest('[data-shop-page]').dataset.shopPage===category&&!owned.has(source.dataset.shopProduct));
        for(let i=list.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[list[i],list[j]]=[list[j],list[i]]}return list;
      });
      catalog=[];for(let row=0;groups.some(list=>row<list.length);row++)for(const list of groups)if(list[row])catalog.push(list[row]);
      select(filter);
    },
    setActive(value){active=value;schedule()}
  };
}
