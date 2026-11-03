import {renderText} from './document.js?v=20261103-news-folders';
const root=new URL('../../',import.meta.url);
export const el=(tag,cls='',text)=>{const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n};
export function safeUrl(value){try{const url=new URL(value,root);return ['http:','https:'].includes(url.protocol)?url.href:''}catch{return ''}}
// Captions are revealed on demand without adding a frame or a separate button.
function imageCaption(img,caption){
 const hide=()=>{caption.hidden=true;if(img.hasAttribute('role'))img.setAttribute('aria-expanded','false');};
 const toggle=()=>{if(!caption.textContent)return;caption.hidden=!caption.hidden;img.setAttribute('aria-expanded',String(!caption.hidden));};
 img.onclick=toggle;
 img.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();toggle();}else if(e.key==='Escape')hide();};
 return text=>{caption.textContent=text||'';if(text){img.tabIndex=0;img.setAttribute('role','button');img.setAttribute('aria-label','Show or hide image caption');}else{img.removeAttribute('tabindex');img.removeAttribute('role');img.removeAttribute('aria-label');img.removeAttribute('aria-expanded');}hide();};
}
function galleryView(post){const article=el('div');let dispose=()=>{};
 if(post.gallery?.length){const gallery=el('figure','news-gallery'),img=el('img'),caption=el('figcaption'),controls=el('div','news-gallery-controls'),prev=el('button','','‹'),next=el('button','','›'),count=el('span'),pause=el('button','','Pause');prev.type=next.type=pause.type='button';prev.setAttribute('aria-label','Previous image');next.setAttribute('aria-label','Next image');pause.setAttribute('aria-label','Pause image rotation');let at=0,paused=matchMedia('(prefers-reduced-motion: reduce)').matches,visible=false,timer=0;
 const setCaption=imageCaption(img,caption);
 const show=()=>{img.src=safeUrl(post.gallery[at].image);img.alt=post.gallery[at].caption||`${post.title} — image ${at+1}`;setCaption(post.gallery[at].caption);count.textContent=`${at+1} / ${post.gallery.length}`};const tick=()=>{clearInterval(timer);if(visible&&!paused&&!document.hidden&&!gallery.matches(':hover')&&!gallery.contains(document.activeElement)&&post.gallery.length>1)timer=setInterval(()=>{at=(at+1)%post.gallery.length;show()},6000)};
 prev.onclick=()=>{at=(at-1+post.gallery.length)%post.gallery.length;show();tick()};next.onclick=()=>{at=(at+1)%post.gallery.length;show();tick()};pause.onclick=()=>{paused=!paused;pause.textContent=paused?'Play':'Pause';pause.setAttribute('aria-label',paused?'Play image rotation':'Pause image rotation');tick()};pause.textContent=paused?'Play':'Pause';pause.setAttribute('aria-label',paused?'Play image rotation':'Pause image rotation');gallery.onpointerenter=()=>clearInterval(timer);gallery.onpointerleave=tick;gallery.onfocusin=()=>clearInterval(timer);gallery.onfocusout=()=>queueMicrotask(tick);controls.append(prev,count,next,pause);controls.hidden=post.gallery.length<2;gallery.append(img,caption,controls);article.append(gallery);show();const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;tick()});observer.observe(gallery);document.addEventListener('visibilitychange',tick);dispose=()=>{clearInterval(timer);observer.disconnect();document.removeEventListener('visibilitychange',tick)};
 }return {element:article.firstElementChild,dispose};}
export function postArticle(post){
 const article=el('article','news-post'),header=el('header'),time=el('time','',new Date((post.publishedAt||new Date().toISOString().slice(0,10))+'T12:00:00').toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'})),dispose=[];
 time.dateTime=post.publishedAt||'';header.append(time,el('h2','',post.title||'Untitled Post'));article.append(header);
 for(const block of post.blocks||[]){if(block.type==='text'){const content=el('div','news-prose');content.append(renderText(block.content));article.append(content);}else if(block.type==='photo'&&block.images?.length){const figure=el('figure','news-photo'),img=el('img');img.src=safeUrl(block.images[0].image);img.alt=block.images[0].caption||post.title||'Article photo';img.loading='lazy';img.decoding='async';figure.append(img);if(block.images[0].caption){const caption=el('figcaption');imageCaption(img,caption)(block.images[0].caption);figure.append(caption);}article.append(figure);}else if(block.type==='gallery'&&block.images.length){const view=galleryView({title:post.title,gallery:block.images});article.append(view.element);dispose.push(view.dispose);}}
 return {element:article,dispose:()=>dispose.forEach(fn=>fn())};
}
