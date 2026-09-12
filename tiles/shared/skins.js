(()=>{
  const icon='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="11" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M9 19h8a2 2 0 0 0 2-2V9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
  let active=null;
  function setup(m,{catalog,owned,apply}){
    if(m.querySelector(':scope > .tile-skins-toggle'))return;
    const button=document.createElement('button');button.type='button';button.className='tile-skins-toggle';button.innerHTML=icon;button.title='Tile Skins';button.setAttribute('aria-label','Tile Skins');button.setAttribute('aria-expanded','false');m.append(button);
    let drawer=null,frame=0;
    function close(focus=false){if(!drawer)return;cancelAnimationFrame(frame);drawer.remove();drawer=null;m.classList.remove('is-skins-open');button.setAttribute('aria-expanded','false');document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',keyboard,true);if(active===close)active=null;if(focus&&m.isConnected)button.focus();}
    function outside(e){if(drawer&&!drawer.contains(e.target)&&!button.contains(e.target))close();}
    function keyboard(e){if(e.key==='Escape'){e.preventDefault();close(true);}}
    function position(){if(!m.isConnected){close();return;}drawer.querySelectorAll('.tile-skins-choice-preview').forEach(preview=>{const art=preview.querySelector('.tile-skin-art,.classic-magnifier-art');if(!art)return;const scale=Math.min(1,(preview.clientWidth-24)/art.offsetWidth,(preview.clientHeight-24)/art.offsetHeight);art.style.transform=`translate(-50%,-50%) scale(${Math.max(0,scale)})`;});const r=button.getBoundingClientRect(),d=drawer.getBoundingClientRect();drawer.style.left=Math.max(8,Math.min(innerWidth-d.width-8,r.left))+'px';drawer.style.top=Math.max(8,Math.min(innerHeight-d.height-8,r.top-d.height-8))+'px';frame=requestAnimationFrame(position);}
    function render(){
      drawer.replaceChildren();const header=document.createElement('header'),title=document.createElement('strong'),x=document.createElement('button');title.textContent='Tile Skins';x.type='button';x.textContent='×';x.setAttribute('aria-label','Close Skins');x.onclick=()=>close(true);header.append(title,x);drawer.append(header);
      const grid=document.createElement('div');grid.className='tile-skins-drawer-grid';drawer.append(grid);
      for(const skin of [null,...catalog.filter(s=>s.tileType===m.dataset.type)]){
        const id=skin?.id||'',locked=skin&&!owned(skin),selected=(m.dataset.tileSkin||'')===id,card=document.createElement('button');card.type='button';card.className='tile-skins-choice';card.classList.toggle('is-locked',!!locked);card.setAttribute('aria-pressed',String(selected));card.title=skin?.description||'Original tile appearance';
        const preview=document.createElement('span');preview.className='tile-skins-choice-preview';
        const source=skin&&document.querySelector(`.shop-product[data-shop-product="${skin.productId}"] .shop-product__preview`);
        if(source){const clone=source.cloneNode(true);clone.removeAttribute('id');clone.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));preview.append(clone);}else preview.innerHTML=icon;
        const name=document.createElement('strong'),status=document.createElement('small');name.textContent=skin?.name||'Default';status.textContent=locked?'🔒 Locked · Shop':selected?'✓ Applied':'Apply Skin';card.append(preview,name,status);card.onclick=()=>{if(skin&&!owned(skin)){close();window.TeacherTilesShop?.openPage('tile-skins');return;}close();const next=apply(m,id);next?.querySelector(':scope > .tile-skins-toggle')?.focus();};grid.append(card);
      }
    }
    button.addEventListener('pointerdown',e=>e.stopPropagation());button.addEventListener('click',e=>{e.stopPropagation();if(drawer){close();return;}active?.();active=close;drawer=document.createElement('section');drawer.className='tile-skins-drawer';drawer.setAttribute('role','dialog');drawer.setAttribute('aria-label','Tile Skins');document.body.append(drawer);m.classList.add('is-skins-open');button.setAttribute('aria-expanded','true');render();position();document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',keyboard,true);drawer.querySelector('header button').focus();});
    const refresh=()=>{if(drawer)render();};window.addEventListener('teachertiles:shopownershipchange',refresh);window.addEventListener('teachertiles:accountchange',refresh);
    const deactivate=m._deactivate,cleanup=m._cleanup;m._deactivate=function(...args){close();return deactivate?.apply(this,args);};m._cleanup=function(...args){close();window.removeEventListener('teachertiles:shopownershipchange',refresh);window.removeEventListener('teachertiles:accountchange',refresh);return cleanup?.apply(this,args);};
  }
  window.TeacherTilesSkins={setup};
})();
