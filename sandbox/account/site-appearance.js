(() => {
  'use strict';
  const fonts={inter:'Inter,system-ui,sans-serif',system:'system-ui,-apple-system,"Segoe UI",sans-serif',arial:'Arial,Helvetica,sans-serif',verdana:'Verdana,Geneva,sans-serif',georgia:'Georgia,"Times New Roman",serif'};
  const roots='#settings-modal,#profile-modal,#context-menu,#boards-view,#boards-panel,#boards-modal,#asset-shelf,#shop-modal,#shop-shelf,#shop-panel,#shop-coin-menu,#board-frame-menu,.workspace-control,.theme-picker,.sticker-picker,.cursor-picker,.board-template-dialog,.template-library,.board-access-dialog,.board-template-report-dialog,.profile-patch-dialog,.profile-tool-panel,.board-menu,dialog,[role="dialog"]';
  const exclude='.settings-nav,.module,.board-mini-object,.board-preview,.board-card__preview,svg,script,style,.icon,[class*="__icon"],.help-section__heading>span,.settings-nav__icon,.settings-card__glyph,.help-mouse-icon';
  const pending=new Set();let frame=0,currentFont='inter',currentSize=100;
  function scan(){
    frame=0;document.body.removeAttribute('data-site-typography');
    if(currentFont==='inter'&&currentSize===100){pending.clear();return;}
    const targets=[];
    for(const root of pending){if(!root.isConnected||root.closest('[hidden]'))continue;for(const el of [root,...root.querySelectorAll('*')]){
      if(!(el instanceof HTMLElement)||el.closest(exclude))continue;
      if(!el.matches('input,select,textarea,button')&&![...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))continue;
      targets.push([el,parseFloat(getComputedStyle(el).fontSize)||14]);
    }}
    for(const [el,size]of targets){el.style.setProperty('--site-base-font-size',size+'px');el.dataset.siteText='';}
    pending.clear();document.body.dataset.siteTypography='true';
  }
  const queue=root=>{if(currentFont==='inter'&&currentSize===100)return;pending.add(root);if(!frame)frame=requestAnimationFrame(scan)};
  const observer=new MutationObserver(records=>{for(const r of records){const target=r.target instanceof Element?r.target:r.target.parentElement;if(!target||target.closest(exclude))continue;const root=target.closest(roots);if(root&&(r.addedNodes.length||r.type==='characterData'||r.type==='attributes'))queue(root);for(const node of r.addedNodes)if(node instanceof Element&&node.matches(roots))queue(node)}});
  observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['hidden','aria-hidden','open']});
  window.TeacherTilesSiteAppearance={apply(prefs){
    currentFont=fonts[prefs.siteFont]?prefs.siteFont:'inter';currentSize=Math.max(100,Math.min(150,Number(prefs.siteFontSize)||100));
    document.body.style.setProperty('--site-font-family',fonts[currentFont]);document.body.style.setProperty('--site-font-scale',currentSize/100);
    document.body.classList.toggle('site-square-corners',!!prefs.squareCorners);
    if(currentFont==='inter'&&currentSize===100)document.body.removeAttribute('data-site-typography');
    else document.querySelectorAll(roots).forEach(queue);
  }};
})();
