import {createBoardPreview,setPreviewTemplates} from '../boards/preview.js';
let assets;
function loadAssets(){
  return assets ||= fetch(new URL('../board.html',import.meta.url)).then(async response=>{
    if(!response.ok)throw new Error('Board preview assets could not load.');
    const doc=new DOMParser().parseFromString(await response.text(),'text/html');
    setPreviewTemplates(doc);
    const links=[...doc.querySelectorAll('link[rel="stylesheet"]')].map(link=>new URL(link.getAttribute('href'),response.url).href).filter(url=>new URL(url).origin===location.origin);
    // Parse each app stylesheet once, then share it between all isolated previews.
    const sheets=await Promise.all(links.map(async href=>{const res=await fetch(href);if(!res.ok)throw new Error('Board preview styling could not load.');const sheet=new CSSStyleSheet();sheet.replaceSync((await res.text()).replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi,(_,quote,url)=>`url("${url.startsWith('data:')||url.startsWith('#')?url:new URL(url,href).href}")`));return sheet;}));
    const overrides=new CSSStyleSheet();overrides.replaceSync(':host{--surface:#fff;--surface-solid:#fff;--text:#20272c;--muted:#64748b;--border:#dbe1eb;font-family:Inter,system-ui,sans-serif}.board-card__preview{height:100%;width:100%;aspect-ratio:auto}.module{pointer-events:none}');return [...sheets,overrides];
  }).catch(error=>{assets=null;throw error;});
}
function fit(host){for(const box of host.shadowRoot?.querySelectorAll('.board-mini-object.is-real-tile')||[]){const module=box.querySelector('.module');if(!module||!box.clientWidth)continue;const scale=Math.min(box.clientWidth/parseFloat(module.style.width),box.clientHeight/parseFloat(module.style.height));if(scale>0)module.style.transform=`scale(${scale})`;}}
window.addEventListener('resize',()=>document.querySelectorAll('.admin-board-preview').forEach(fit),{passive:true});
export function adminBoardPreview(snapshot){
 const host=document.createElement('div');host.className='admin-board-preview';host.style.cssText='display:block;width:100%;height:100%;';const root=host.attachShadow({mode:'open'}),message=document.createElement('p');message.textContent='Loading board preview…';root.append(message);
 loadAssets().then(sheets=>{
  if(!host.isConnected)return;
  root.adoptedStyleSheets=sheets;message.remove();root.append(createBoardPreview({theme:snapshot.theme,inlineObjects:snapshot.objects}));requestAnimationFrame(()=>fit(host));
 }).catch(error=>{message.textContent=error.message;});return host;
}
