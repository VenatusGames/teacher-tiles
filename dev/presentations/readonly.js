// Shared presentation artwork for editor text, board players and ClassConnect viewers.
// No account, library, IndexedDB or board initialization is performed here.
(()=>{'use strict';
const fonts=["Arial", "Arial Black", "Calibri", "Cambria", "Comic Sans MS", "Courier New", "Georgia", "Times New Roman", "Trebuchet MS", "Verdana", "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins", "Nunito", "Nunito Sans", "Lexend", "Quicksand", "Oswald", "Raleway", "Ubuntu", "PT Sans", "Source Sans 3", "Work Sans", "DM Sans", "Space Grotesk", "Merriweather", "Lora", "Playfair Display", "Libre Baskerville", "PT Serif", "Roboto Slab", "Bitter", "Crimson Text", "EB Garamond", "Caveat", "Pacifico", "Dancing Script", "Indie Flower", "Patrick Hand", "Shadows Into Light", "Permanent Marker", "Amatic SC", "Lobster", "Bebas Neue", "Comfortaa", "Abril Fatface", "Roboto Mono", "Source Code Pro"].sort((a,b)=>a.localeCompare(b));
const shapePaths={star:'M50 2 L61.5 35 L97.5 35 L68 56 L79 91 L50 70 L21 91 L32 56 L2.5 35 L38.5 35 Z',hexagon:'M25 0 H75 L100 50 L75 100 H25 L0 50 Z',heart:'M50 95 C43 88 0 61 0 30 C0 -2 35 -10 50 20 C65 -10 100 -2 100 30 C100 61 57 88 50 95 Z'};
const fontLoads=new Map(),embeddedFontLoads=new Map();
function fontStack(name){const serif=['Georgia','Cambria','Times New Roman','Lora','Merriweather','Playfair Display','Libre Baskerville','PT Serif','Roboto Slab','Bitter','Crimson Text','EB Garamond','Abril Fatface'].includes(name),mono=['Courier New','Roboto Mono','Source Code Pro'].includes(name);return '"'+name.replace(/["\\]/g,'')+'", '+(mono?'monospace':serif?'serif':'sans-serif');}
function loadFont(name){if(!fonts.includes(name)||fontLoads.has(name))return fontLoads.get(name)||Promise.resolve();if(['Arial','Arial Black','Calibri','Cambria','Comic Sans MS','Courier New','Georgia','Times New Roman','Trebuchet MS','Verdana'].includes(name))return Promise.resolve();const promise=new Promise(resolve=>{const link=document.createElement('link');link.rel='stylesheet';link.href='https://fonts.googleapis.com/css2?family='+encodeURIComponent(name)+(['Pacifico','Indie Flower','Patrick Hand','Shadows Into Light','Permanent Marker','Lobster','Bebas Neue','Abril Fatface'].includes(name)?'':':wght@400;700')+'&display=swap';setTimeout(resolve,8000);link.onload=()=>document.fonts.load('16px "'+name+'"').then(resolve,resolve);link.onerror=()=>resolve();document.head.append(link);});fontLoads.set(name,promise);return promise;}
function emojiCanvas(e,k=2){const c=document.createElement('canvas');c.width=Math.max(1,Math.ceil(e.w*k));c.height=Math.max(1,Math.ceil(e.h*k));const g=c.getContext('2d');g.scale(k,k);const size=Math.min(e.w,e.h)*.76,text=/^[A-Za-z0-9]+$/.test(e.emoji);g.font=(text?'950 ':'')+size+'px '+(text?'Inter,Arial,sans-serif':'"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif');g.textAlign='center';g.textBaseline='alphabetic';let m=g.measureText(e.emoji);const fit=Math.min(1,e.w*.86/Math.max(1,m.width),e.h*.86/Math.max(1,m.actualBoundingBoxAscent+m.actualBoundingBoxDescent));if(fit<1){g.font=g.font.replace(/[0-9.]+px/,size*fit+'px');m=g.measureText(e.emoji);}const x=e.w/2,y=e.h/2+(m.actualBoundingBoxAscent-m.actualBoundingBoxDescent)/2,b=Math.min(e.w,e.h)*.025;const layer=document.createElement('canvas');layer.width=c.width;layer.height=c.height;const l=layer.getContext('2d');l.scale(k,k);l.font=g.font;l.textAlign='center';l.textBaseline='alphabetic';l.fillText(e.emoji,x,y);l.globalCompositeOperation='source-in';l.fillStyle='#fff';l.fillRect(0,0,e.w,e.h);for(let i=0;i<16;i++){const a=i*Math.PI/8;g.drawImage(layer,Math.cos(a)*b,Math.sin(a)*b,e.w,e.h);}g.fillStyle='#263342';g.fillText(e.emoji,x,y);return c;}
const richTags=new Set(['p','div','br','h1','h2','h3','blockquote','b','strong','i','em','u','s','strike','span','ul','ol','li','font']);
function renderRich(el,e){
 const content=document.createElement('div');content.className='pres-rich';renderRichContent(content,e);el.replaceChildren(content);
}
function renderRichContent(content,e){
 content.replaceChildren();
 const build=node=>{if(typeof node.text==='string')return document.createTextNode(node.text);const n=document.createElement(richTags.has(node.tag)?node.tag:'span');for(const [key,value] of Object.entries(node.style||{})){if(key==='fontSize')n.style.fontSize=value/9.6+'cqw';else if(key==='fontFamily'){loadFont(value);n.style.fontFamily=fontStack(value);}else if(['color','backgroundColor','fontWeight','fontStyle','textDecorationLine','textAlign','marginLeft','lineHeight'].includes(key))n.style[key]=key==='marginLeft'?value+'em':value;}for(const child of node.children||[])n.append(build(child));return n;};
 if(e.rich?.length)e.rich.forEach(n=>content.append(build(n)));else content.textContent=e.text;
}

const textColor=(e,theme)=>e.color==='auto'||!e.color?(theme==='black'?'#f7f8fb':'#263249'):e.color;
function paint(host,data,theme,{read:resolveAsset,liveTiles=false,scope=""}={}){
 const modules=window.TeacherTilesPresentationModules;
 modules.dispose(host);host.replaceChildren();host.dataset.theme=theme;host.style.backgroundColor=theme==='none'?data.background:window.TeacherTilesPresentationThemes.get(theme).background;const themeArt=window.TeacherTilesPresentationThemes.url(theme,data.themeLayout);host.classList.toggle('has-theme-art',!!themeArt);host.style.backgroundImage=themeArt?`url("${themeArt}")`:'';host.style.backgroundSize='100% 100%';
 for(const e of data.elements){
  const el=document.createElement('div');el.className='pres-object pres-object--'+e.type;el.dataset.object=e.id;el.style.cssText='left:'+e.x/9.6+'%;top:'+e.y/5.4+'%;width:'+e.w/9.6+'%;height:'+e.h/5.4+'%;';
  if(e.type==='text'){el.textContent=e.text;el.style.fontSize=e.fontSize/9.6+'cqw';el.style.fontWeight=e.bold?'750':'450';el.style.color=textColor(e,theme);el.style.textAlign=e.align;renderRich(el,e);}
  if(e.type==='shape'){const fill=document.createElement('div');fill.className='pres-shape-fill';fill.dataset.shape=e.shape;if(shapePaths[e.shape]){fill.style.background='none';fill.innerHTML='<svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%"><path d="'+shapePaths[e.shape]+'"/></svg>';fill.querySelector('path').setAttribute('fill',e.color);}else fill.style.backgroundColor=e.color;el.append(fill);}
  if(e.type==='sticker'&&e.emoji){const glyph=emojiCanvas(e);glyph.className='pres-emoji';glyph.setAttribute('aria-label',e.emoji);el.append(glyph);}
  if(e.type==='image'||e.type==='sticker'&&e.src){const img=document.createElement('img');img.draggable=false;img.alt=e.type==='image'?'Uploaded image':'Sticker';el.append(img);if(e.src)img.src=e.src;else resolveAsset(e.asset).then(src=>{if(img.isConnected)img.src=src}).catch(()=>{if(img.isConnected){img.remove();el.textContent='Image unavailable';el.classList.add('pres-image-error')}});}
  el.style.transform='rotate('+(e.rotation||0)+'deg)';
  host.append(el);
  if(e.type==='table')modules.mountTable(el,e,{editable:false});
  if(e.type==='tile')modules.mountTile(el,e,{live:liveTiles,editable:false,read:resolveAsset,scope});
 }
}
async function loadFonts(deck,read){
 for(const info of deck.fonts||[]){if(!embeddedFontLoads.has(info.family))embeddedFontLoads.set(info.family,(async()=>{try{const data=await read(info.asset),face=new FontFace(info.family,'url('+data+')');await face.load();document.fonts.add(face);}catch(error){embeddedFontLoads.delete(info.family);throw error;}})());await embeddedFontLoads.get(info.family);}
 const names=new Set();const visit=nodes=>{for(const n of nodes||[]){if(n.style?.fontFamily)names.add(n.style.fontFamily);visit(n.children);}};for(const slide of deck.slides)for(const e of slide.elements)visit(e.rich);await Promise.all([...names].map(loadFont));
}
window.TeacherTilesPresentationRenderer=Object.freeze({paint,fonts,shapePaths,emojiCanvas,renderRich,renderRichContent,fontStack,loadFont,loadFonts});
})();
