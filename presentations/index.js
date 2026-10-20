(()=>{'use strict';
const $=(s,r=document)=>r.querySelector(s),id=()=>crypto.randomUUID(),copy=v=>structuredClone(v);
const mark='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v5M8 21l4-3 4 3M8 8h8M8 12h5"/></svg>';
const root=document.createElement('section');root.id='presentations-tool';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Presentations');
root.innerHTML='<header class="pres-header"><div class="pres-brand">'+mark+'<strong>Presentations</strong></div><input class="pres-title" aria-label="Presentation name" maxlength="100" hidden><span class="pres-save" role="status"></span><button data-action="import-presentation"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/></svg><span>Upload Presentation</span></button><button data-action="save" hidden>Save</button><button data-action="close">Back to Board</button></header><div class="pres-notice" role="status" hidden></div><section class="pres-library"><div class="pres-library-heading"><div class="pres-library-title"><h1>Your Presentations</h1></div><span class="pres-limit"></span></div><div class="pres-library-grid"></div><button data-action="more" hidden>Load more</button></section><section class="pres-editor" hidden><aside class="pres-sidebar"><div class="pres-sidebar-top"><button data-action="library"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg>Presentations</button><span class="pres-slide-count"></span></div><div class="pres-slide-list"></div><div class="pres-sidebar-bottom"><button data-action="themes">◈ Themes</button></div></aside><main class="pres-workspace"><div class="pres-toolbar"><button data-action="drawer" aria-expanded="true" aria-label="Toggle slides sidebar">☰ Slides</button><span class="pres-toolbar-divider"></span><label class="pres-background-label">Background <input class="pres-background" type="color" aria-label="Slide background color"></label><label class="pres-theme-background" hidden><select class="pres-theme-variant" aria-label="Theme background variation"><option value="">Original</option><option value="title">Title</option><option value="content">Content</option><option value="columns">Two Columns</option><option value="section">Section Divider</option><option value="image">Image &amp; Caption</option><option value="quote">Big Quote</option><option value="steps">Three Steps</option><option value="discussion">Discussion</option></select></label><button data-action="transitions" aria-haspopup="dialog">Transitions</button><span class="pres-toolbar-spacer"></span><button data-action="undo" aria-label="Undo"><svg class="tt-history-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5v6h6M4 11l4-4a7 7 0 1 1 1 12"/></svg></button><button data-action="redo" aria-label="Redo"><svg class="tt-history-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 5v6h-6M20 11l-4-4a7 7 0 1 0-1 12"/></svg></button><button data-action="export-presentation" aria-haspopup="menu" aria-expanded="false">Export</button><button data-action="present" class="pres-primary">▷ Present</button></div><div class="pres-object-tools" hidden><label class="pres-text-control">Size <input class="pres-font-size" type="number" min="6" max="300" aria-label="Font size"></label><button data-action="bold" class="pres-text-control" aria-label="Bold"><b>B</b></button><select class="pres-align pres-text-control" aria-label="Text alignment"><option>left</option><option>center</option><option>right</option></select><label class="pres-color-control">Color <input class="pres-object-color" type="color" aria-label="Object color"></label><select class="pres-shape-select" aria-label="Shape"><option>rectangle</option><option>ellipse</option><option>triangle</option><option>star</option><option>hexagon</option><option>heart</option></select><span class="pres-toolbar-spacer"></span><button data-action="backward">↓ Back</button><button data-action="forward">↑ Front</button><button data-action="duplicate-object">Duplicate</button><button data-action="delete-object" class="pres-danger">Delete</button></div><div class="pres-canvas-area"><div class="pres-slide pres-canvas" tabindex="0" aria-label="Slide. Right-click to add objects."></div></div><footer class="pres-editor-footer"><span class="pres-current-slide"></span><span>Right-click to add · Double-click text to edit · Shift-select · Middle-drag to pan</span></footer></main></section><div class="pres-menu" hidden role="menu" aria-label="Add to slide"></div><div class="pres-theme-dialog" hidden role="dialog" aria-label="Presentation themes"><header><strong>Presentation Themes</strong><button data-action="close-themes" aria-label="Close themes">×</button></header><input class="pres-theme-search" type="search" placeholder="Search themes…" aria-label="Search presentation themes"><div class="pres-theme-grid"></div><p class="pres-theme-empty" hidden>No matching themes.</p></div><div class="pres-confirm" hidden role="alertdialog" aria-label="Confirm deletion"><div><h2>Delete this presentation?</h2><p>This removes the presentation and its uploaded images.</p><div><button data-action="cancel-delete">Cancel</button><button class="pres-danger" data-action="confirm-delete">Delete Presentation</button></div></div></div><input class="pres-upload" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden><div class="pres-play-controls" hidden><button data-action="previous">←</button><span></span><button data-action="next">→</button><button data-action="stop-present">Exit</button></div>';
document.body.append(root);
const svg=paths=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths+'</svg>';
const icons={text:svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 8h10M12 8v9M9 17h6"/>'),image:svg('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m4 17 5-5 4 4 3-3 5 5"/>'),shape:svg('<rect x="3" y="3" width="11" height="11" rx="1.5"/><circle cx="16" cy="16" r="5"/>'),stickers:svg('<path d="M21 13V6a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h7zM13 21v-5a3 3 0 0 1 3-3h5"/><path d="M8 8h.01M14 8h.01M8 12q3 3 6 0"/>'),rotate:svg('<path d="M19 9a7 7 0 1 0 0 7M19 4v5h-5"/>'),plus:svg('<path d="M12 5v14M5 12h14"/>'),crown:'<svg viewBox="0 0 48 48" aria-hidden="true"><use href="assets/ui/subscriber-crown.svg?v=20260926#crown"/></svg>'};
const fonts=["Arial", "Arial Black", "Calibri", "Cambria", "Comic Sans MS", "Courier New", "Georgia", "Times New Roman", "Trebuchet MS", "Verdana", "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins", "Nunito", "Nunito Sans", "Lexend", "Quicksand", "Oswald", "Raleway", "Ubuntu", "PT Sans", "Source Sans 3", "Work Sans", "DM Sans", "Space Grotesk", "Merriweather", "Lora", "Playfair Display", "Libre Baskerville", "PT Serif", "Roboto Slab", "Bitter", "Crimson Text", "EB Garamond", "Caveat", "Pacifico", "Dancing Script", "Indie Flower", "Patrick Hand", "Shadows Into Light", "Permanent Marker", "Amatic SC", "Lobster", "Bebas Neue", "Comfortaa", "Abril Fatface", "Roboto Mono", "Source Code Pro"].sort((a,b)=>a.localeCompare(b));
icons.table=svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>');icons.tile=svg('<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 12h8M12 8v8"/>');
const modules=window.TeacherTilesPresentationModules,objectContract=window.TeacherTilesPresentationObjects;
const addMenuMarkup=[['text','Text Box'],['image','Image / GIF'],['shape','Shape'],['stickers','Stickers'],['table','Table'],['tile','Tile']].map(([key,label])=>'<button role="menuitem" data-action="'+key+'"'+(['shape','tile','table'].includes(key)?' aria-haspopup="menu"':'')+'>'+icons[key]+'<span>'+label+'</span>'+(['shape','tile','table'].includes(key)?'<span class="pres-menu-chevron" aria-hidden="true">›</span>':'')+'</button>').join('');
$('.pres-menu',root).innerHTML=addMenuMarkup;
function fitMenu(){menu.style.left=Math.max(8,Math.min(innerWidth-menu.offsetWidth-8,parseFloat(menu.style.left)||8))+'px';menu.style.top=Math.max(8,Math.min(innerHeight-menu.offsetHeight-8,parseFloat(menu.style.top)||8))+'px';}
function addMenu(){menu.innerHTML=addMenuMarkup;menu.setAttribute('aria-label','Add to slide');menu.hidden=false;fitMenu();}
const shapePaths={star:'M50 2 L61.5 35 L97.5 35 L68 56 L79 91 L50 70 L21 91 L32 56 L2.5 35 L38.5 35 Z',hexagon:'M25 0 H75 L100 50 L75 100 H25 L0 50 Z',heart:'M50 95 C43 88 0 61 0 30 C0 -2 35 -10 50 20 C65 -10 100 -2 100 30 C100 61 57 88 50 95 Z'};
function shapeMenu(){
 menu.replaceChildren();menu.setAttribute('aria-label','Choose a shape');
 const back=button('← Back','Back to add menu');back.setAttribute('role','menuitem');back.onclick=()=>{addMenu();menu.querySelector('[data-action=shape]').focus();};menu.append(back);
 for(const [shape,label,art] of [['rectangle','Rectangle','<rect x="3" y="5" width="18" height="14" rx="1"/>'],['ellipse','Ellipse','<ellipse cx="12" cy="12" rx="9" ry="7"/>'],['triangle','Triangle','<path d="M12 3 22 21H2Z"/>'],['star','Star','<path d="m12 2 3 6.6 7 1-5 5 1.2 7.2L12 18.4l-6.2 3.4 1.2-7.2-5-5 7-1Z"/>'],['hexagon','Hexagon','<path d="m7 3 10 0 5 9-5 9H7L2 12Z"/>'],['heart','Heart','<path d="M12 21 3.5 12.5C-3 6 6-2 12 6c6-8 15 0 8.5 6.5Z"/>']]){
  const choice=button('',label);choice.setAttribute('role','menuitem');choice.dataset.shapeChoice=shape;choice.innerHTML=svg(art)+'<span>'+label+'</span>';choice.onclick=()=>{addObject('shape',{shape});canvas.focus({preventScroll:true});};menu.append(choice);
 }
 menu.hidden=false;fitMenu();menu.querySelector('[data-shape-choice]').focus();
}
const richButton=(command,label,art)=>'<button class="pres-text-control" data-format="'+command+'" aria-label="'+label+'" title="'+label+'">'+art+'</button>';
$('.pres-object-tools',root).innerHTML='<select class="pres-block pres-text-control" aria-label="Text style"><option value="p">Body</option><option value="h1">Heading</option><option value="h2">Subheading</option><option value="h3">Section heading</option><option value="blockquote">Quote</option></select><select class="pres-font pres-text-control" aria-label="Font family">'+fonts.map(f=>'<option>'+f+'</option>').join('')+'</select><label class="pres-text-control">Size <input class="pres-font-size" type="number" min="6" max="300" aria-label="Font size"></label><label class="pres-color-control" title="Text or shape color">Color <input class="pres-object-color" type="color" aria-label="Object color"></label><label class="pres-text-control" title="Highlight color">Highlight <input class="pres-highlight" type="color" value="#fff2a8" aria-label="Highlight color"></label>'+richButton('clearHighlight','Remove highlight',svg('<path d="m4 20 16-16M5 16l8-8 4 4-8 8H5z"/>'))+[['bold','Bold','<b>B</b>'],['italic','Italic','<i>I</i>'],['underline','Underline','<u>U</u>'],['strikeThrough','Strikethrough','<s>S</s>'],['insertUnorderedList','Bulleted list','• ≡'],['insertOrderedList','Numbered list','1 ≡']].map(a=>richButton(...a)).join('')+'<select class="pres-align pres-text-control" aria-label="Text alignment"><option>left</option><option>center</option><option>right</option><option>justify</option></select>'+[['indent','Increase indent','→|'],['outdent','Decrease indent','|←'],['undo','Undo text edit','↶'],['redo','Redo text edit','↷'],['removeFormat','Clear formatting','T×']].map(a=>richButton(...a)).join('')+'<button class="pres-text-control" data-action="image" aria-label="Insert image">'+icons.image+'</button><button class="pres-text-control" data-format="export" title="Export formatted text">Export</button><button class="pres-text-control" data-format="spell" aria-pressed="true" title="Toggle spellcheck">Spell</button><select class="pres-shape-select" aria-label="Shape"><option>rectangle</option><option>ellipse</option><option>triangle</option><option>star</option><option>hexagon</option><option>heart</option></select><span class="pres-toolbar-spacer"></span><button data-action="backward" title="Send backward">↓ Back</button><button data-action="forward" title="Bring forward">↑ Front</button><button data-action="duplicate-object">Duplicate</button><button data-action="delete-object" class="pres-danger">Delete</button>';
const formatting=window.TeacherTilesFormattingToolbar;
const objectToolbar=$('.pres-object-tools',root);
for(const [selector,name]of [['.pres-object-color','color'],['.pres-highlight','highlight']]){const input=$(selector,root),label=input.parentElement;label.classList.add('tt-format-color');for(const node of [...label.childNodes])if(node!==input)node.remove();label.insertAdjacentHTML('afterbegin',formatting.icon(name)+formatting.icon('chevron'));}
const alignSelect=$('.pres-align',root);alignSelect.classList.remove('pres-text-control');alignSelect.hidden=true;
alignSelect.insertAdjacentHTML('afterend',[['justifyLeft','Align left'],['justifyCenter','Align center'],['justifyRight','Align right'],['justifyFull','Justify']].map(([cmd,label])=>richButton(cmd,label,formatting.icon(cmd))).join(''));
formatting.enhance(objectToolbar);
for(const [action,label,paths] of [['drawer','Slides','<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M5.5 8h1M5.5 12h1M5.5 16h1"/>'],['themes','Themes','<path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-4 2 2 0 0 1 1-3h3a3 3 0 0 0 3-3 9 9 0 0 0-9-8Z"/><path d="M7 9h.01M11 6h.01M16 8h.01M6 14h.01"/>'],['present','Present','<path d="m8 4 12 8-12 8z"/>']])$('[data-action="'+action+'"]',root).innerHTML=svg(paths)+'<span>'+label+'</span>';
toolbarSetup();
function toolbarSetup(){const controls=document.createElement('div');controls.className='pres-size-tools';controls.innerHTML='<label>W <input type="number" min="20" max="960" class="pres-width" aria-label="Object width"></label><label>H <input type="number" min="20" max="540" class="pres-height" aria-label="Object height"></label><button class="pres-aspect" aria-label="Unlock aspect ratio" aria-pressed="true">'+svg('<rect x="6" y="10" width="12" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>')+'</button><label>° <input type="number" min="0" max="359" class="pres-angle" aria-label="Object rotation"></label>';root.append(controls);controls.hidden=true;controls.addEventListener('pointerdown',event=>event.stopPropagation());}
const layoutDialog=document.createElement('div');layoutDialog.className='pres-layout-dialog';layoutDialog.hidden=true;layoutDialog.setAttribute('role','dialog');layoutDialog.setAttribute('aria-label','Choose slide layout');root.append(layoutDialog);

const library=$('.pres-library',root),editor=$('.pres-editor',root),canvas=$('.pres-canvas',root),area=$('.pres-canvas-area',root),title=$('.pres-title',root),notice=$('.pres-notice',root),status=$('.pres-save',root),menu=$('.pres-menu',root),toolbar=$('.pres-object-tools',root);
let owner='',items=[],cursor=null,loadedAt=0,deck=null,deckId='',revision=0,slideIndex=0,selected='',dirty=false,saveTimer=0,localTimer=0,saving=null,version=0,undo=[],redo=[],play=false,deleteId='',opening=false,cover='',coverKey='',insertPoint=null,generation=0;
let selection=new Set(),pan={x:0,y:0},zoom=1,objectClipboard=null,clipboardPaste=0,slideDrag=-1,editing=null,textRange=null;
const assets=new Map(),pendingAssets=new Map(),uid=()=>window.TeacherTilesAuth?.user?.uid||window.TeacherTilesAccount?.state?.userId||'';
const subscriber=()=>typeof hasCosmeticSubscription==='function'?hasCosmeticSubscription():!!window.TeacherTilesAccount?.state?.subscriptionActive;

const transitions=window.TeacherTilesPresentationTransitions,cosmetics=window.TeacherTilesPresentationCatalog;
function missingCosmetics(document){const state=window.TeacherTilesAccount?.state||{};return cosmetics.missing(cosmetics.requirements(document),state.ownedProductIds,subscriber());}
const accessDialog=document.createElement('dialog');accessDialog.className='pres-access-dialog';accessDialog.setAttribute('aria-label','Presentation locked');accessDialog.innerHTML='<h2>Presentation Locked</h2><p>This presentation uses cosmetics you do not own. Subscription access to those cosmetics is no longer active.</p><p>Buy the required cosmetics or renew your subscription to use it again. Your slides and progress are still saved.</p><ul></ul><footer><button data-access-close>Close</button><button data-access-shop>View in Shop</button></footer>';root.append(accessDialog);
let lockedProducts=[];
function showAccess(products=[]){const groups=products.map(p=>Array.isArray(p)?p:[p]);lockedProducts=[...new Set(groups.flat())];const list=accessDialog.querySelector('ul');list.replaceChildren();const name=product=>transitions.catalog.find(t=>t.productId===product)?.name||window.TeacherTilesPresentationThemes.catalog.find(t=>t.productId===product)?.name||product.replace(/^(presentation-theme-|presentation-transition-|sticker-)/,'').replaceAll('-',' ');for(const group of groups){const li=document.createElement('li');li.textContent=group.map(name).join(' or ');list.append(li);}if(!accessDialog.open){(document.fullscreenElement||document.body).append(accessDialog);accessDialog.showModal();}}

accessDialog.querySelector('[data-access-close]').onclick=()=>accessDialog.close();accessDialog.querySelector('[data-access-shop]').onclick=()=>{accessDialog.close();if(document.fullscreenElement===root)void document.exitFullscreen();window.TeacherTilesShop?.openProduct(lockedProducts[0]||'membership-monthly');};
function checkAccess(document,popup=true){const missing=missingCosmetics(document);if(missing.length&&popup)showAccess(missing);return !missing.length;}
const transitionDialog=document.createElement('div');transitionDialog.className='pres-transitions-dialog';transitionDialog.hidden=true;transitionDialog.setAttribute('role','dialog');transitionDialog.setAttribute('aria-label','Slide transitions');root.append(transitionDialog);
function transitionPicker(){
 if(!deck)return;finishText();transitionDialog.replaceChildren();const header=document.createElement('header'),heading=document.createElement('strong'),exit=button('×','Close transitions');heading.textContent='Transition after Slide '+(slideIndex+1);exit.onclick=()=>{transitionDialog.hidden=true;$('[data-action=transitions]',root).focus();};header.append(heading,exit);transitionDialog.append(header);
 for(const [title,entries] of [['Free',transitions.all.filter(t=>!t.productId)],['Shop Transitions',transitions.catalog]]){const h=document.createElement('h3');h.textContent=title;const grid=document.createElement('div');grid.className='pres-transition-grid';transitionDialog.append(h,grid);
  for(const item of entries){const b=button('',item.name),preview=transitions.preview(item.id),label=document.createElement('strong'),detail=document.createElement('small');b.dataset.transition=item.id;b.setAttribute('aria-pressed',String((slide().transition?.id||'none')===item.id));const accessible=!item.productId||cosmeticIsAccessible(item.productId);label.textContent=item.name;detail.textContent=accessible?(item.productId?'Apply':'Free'):'25 coins · Shop';b.append(preview,label,detail);b.onpointerenter=()=>preview.play();b.onfocus=()=>preview.play();b.onclick=()=>{if(!accessible){window.TeacherTilesShop.openProduct(item.productId);return;}checkpoint();slide().transition={id:item.id,duration:slide().transition?.duration||650};changed();transitionPicker();transitionDialog.querySelector('[data-transition="'+item.id+'"]').focus();};grid.append(b);}
 }
 const options=document.createElement('div');options.className='pres-transition-options';const label=document.createElement('label');label.textContent='Duration';const duration=document.createElement('select');duration.setAttribute('aria-label','Transition duration');for(const [value,text] of [[350,'Fast · 0.35s'],[650,'Normal · 0.65s'],[1000,'Slow · 1s'],[1500,'Extra Slow · 1.5s']])duration.add(new Option(text,value));duration.value=String(slide().transition?.duration||650);duration.onchange=()=>{checkpoint();slide().transition={id:slide().transition?.id||'none',duration:Number(duration.value)};changed();};label.append(duration);
 const all=button('Apply to All Slides');all.onclick=()=>{checkpoint();const transition=slide().transition||{id:'none',duration:650};deck.slides.forEach(s=>s.transition={...transition});changed();say('Transition applied to all slides.');};options.append(label,all);transitionDialog.append(options);transitionDialog.hidden=false;
}
document.addEventListener('pointerdown',event=>{if(!transitionDialog.hidden&&!transitionDialog.contains(event.target)&&!event.target.closest('[data-action=transitions]'))transitionDialog.hidden=true;},true);
transitionDialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();transitionDialog.hidden=true;$('[data-action=transitions]',root).focus();}});
new MutationObserver(()=>{if($('#shop-modal').hidden&&!root.hidden&&!transitionDialog.hidden)transitionPicker();}).observe($('#shop-modal'),{attributes:true,attributeFilter:['hidden']});
function lockCurrent(products){if(!deck||!products&&checkAccess(deck,false))return;const missing=products||missingCosmetics(deck);finishText();void writeDraft();clearTimeout(saveTimer);clearTimeout(localTimer);stopPlay();transitionDialog.hidden=true;$('.pres-theme-dialog',root).hidden=true;menu.hidden=true;hideDeckExport();deck=null;deckId='';dirty=false;generation++;editor.hidden=true;library.hidden=false;title.hidden=true;$('[data-action=save]',root).hidden=true;status.textContent='';renderLibrary();showAccess(missing);}
window.addEventListener('teachertiles:accountchange',()=>{if(!root.hidden){lockCurrent();renderLibrary();}});

const api=async data=>{const expected=owner;if(!expected||uid()!==expected)throw Error('Sign in to use Presentations.');let response;try{response=await window.TeacherTilesAuth.call('presentations',data);}catch(error){if(error.details?.presentationLocked){if(deck)lockCurrent(error.details.requirements||error.details.products);else showAccess(error.details.requirements||error.details.products);}throw error;}if(uid()!==expected||owner!==expected)throw Error('Your account changed. Reopen Presentations.');return response.data;};
const db=new Promise((resolve,reject)=>{const req=indexedDB.open('teachertiles-presentations',1);req.onupgradeneeded=()=>req.result.createObjectStore('drafts');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
// Attach a rejection handler immediately; storage may be disabled before the tool opens.
db.catch(()=>{});
async function local(key,value){const connection=await db;return new Promise((resolve,reject)=>{const tx=connection.transaction('drafts',value===undefined?'readonly':'readwrite'),store=tx.objectStore('drafts');const req=value===undefined?store.get(key):value===null?store.delete(key):store.put(value,key);let result;req.onsuccess=()=>result=req.result;tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);});}
// Library caching contains summaries and small covers only, never slide bodies or assets.
const LIBRARY_TTL=60000,LIBRARY_CACHE_LIMIT=100;
let libraryKnown=false,libraryRequest=null,libraryEpoch=0,libraryChanges=0,libraryRenderPending=false;
const libraryCacheKey=user=>'library:v1:'+user;
function libraryRows(rows){return (Array.isArray(rows)?rows:[]).filter(x=>x&&/^[a-zA-Z0-9_-]{1,80}$/.test(x.id)&&typeof x.title==='string').map(x=>({id:x.id,title:x.title.slice(0,100),theme:String(x.theme||'none'),cosmeticRequirements:(Array.isArray(x.cosmeticRequirements)?x.cosmeticRequirements:[]).map(g=>Array.isArray(g)?g:g.products||[]).filter(g=>g.length),slideCount:Number(x.slideCount)||1,revision:Number(x.revision)||0,updatedAt:Number(x.updatedAt)||0,cover:typeof x.cover==='string'&&x.cover.length<=40000&&/^data:image\/(webp|png|jpeg);base64,/.test(x.cover)?x.cover:''}));}
function persistLibrary(){
 if(!owner||!libraryKnown)return;
 const user=owner,sorted=libraryRows(items).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0),rows=sorted.slice(0,LIBRARY_CACHE_LIMIT);
 const value={version:1,items:rows,cursor:sorted.length>rows.length?rows.at(-1).id:cursor,loadedAt};
 // Cache failures must not interrupt the cloud library or the separate unsaved-draft path.
 void local(libraryCacheKey(user),value).catch(()=>{});
}
function libraryChanged(){libraryChanges++;persistLibrary();}
async function hydrateLibrary(user,epoch){
 try{const cached=await local(libraryCacheKey(user));if(owner!==user||uid()!==user||libraryEpoch!==epoch||libraryKnown||cached?.version!==1||!Array.isArray(cached.items))return;
  items=libraryRows(cached.items).slice(0,LIBRARY_CACHE_LIMIT);cursor=typeof cached.cursor==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(cached.cursor)?cached.cursor:null;
  loadedAt=Number.isFinite(cached.loadedAt)&&cached.loadedAt<=Date.now()?cached.loadedAt:0;libraryKnown=true;renderLibrary();
 }catch{/* Browsers with unavailable local storage still use the normal cloud flow. */}
}
function paintLibraryUpdate(){
 if(document.activeElement?.matches('.pres-library-card input')){libraryRenderPending=true;return;}
 libraryRenderPending=false;renderLibrary();
}
library.addEventListener('focusout',()=>{if(libraryRenderPending)setTimeout(paintLibraryUpdate,0);});
let noticeTimer=0;
function say(message,error=false){clearTimeout(noticeTimer);notice.classList.remove('is-fading');notice.textContent=message;notice.hidden=!message;notice.classList.toggle('is-error',error);if(message&&!message.endsWith('…'))noticeTimer=setTimeout(()=>{notice.classList.add('is-fading');noticeTimer=setTimeout(()=>{notice.hidden=true;notice.classList.remove('is-fading');},220);},error?12000:4500);}
function busy(value){root.classList.toggle('is-busy',value);root.setAttribute('aria-busy',String(value));}
function button(text,label){const b=document.createElement('button');b.type='button';b.textContent=text;if(label)b.setAttribute('aria-label',label);return b;}
const slide=()=>deck?.slides[slideIndex],current=()=>slide()?.elements.find(e=>e.id===selected);
function select(ids=[]){selection=new Set(ids);selected=ids.at(-1)||'';}
const chosen=()=>slide()?.elements.filter(e=>selection.has(e.id))||[];
function checkpoint(){undo.push(JSON.stringify(deck));if(undo.length>40)undo.shift();redo=[];}
function writeDraft(){if(!deck||!owner)return Promise.resolve();return local(owner+'/'+deckId,dirty?{document:copy(deck),revision,dirty,cover,updatedAt:Date.now()}:null).catch(()=>say('Local backup could not be saved. Keep this window open until cloud saving finishes.',true));}
function changed(){dirty=true;version++;status.textContent='Unsaved changes';clearTimeout(localTimer);localTimer=setTimeout(writeDraft,250);clearTimeout(saveTimer);saveTimer=setTimeout(()=>save().catch(()=>{}),5000);}
function cacheAsset(key,image){assets.set(key,image);let bytes=[...assets.values()].reduce((n,v)=>n+v.length,0);while(assets.size>100||bytes>24000000){const first=assets.keys().next().value;bytes-=assets.get(first).length;assets.delete(first);}}
async function asset(hash){const assetDeck=deckId,key=owner+'/'+assetDeck+'/'+hash;if(assets.has(key))return assets.get(key);if(pendingAssets.has(key))return pendingAssets.get(key);const promise=(async()=>{const image=(await api({action:'asset',id:assetDeck,asset:hash})).image;cacheAsset(key,image);return image;})();pendingAssets.set(key,promise);try{return await promise}finally{pendingAssets.delete(key)}}
const textColor=(e,theme=deck?.theme)=>e.color==='auto'||!e.color?(theme==='black'?'#f7f8fb':'#263249'):e.color;
function paintSlide(host,data,theme,interactive=false,resolveAsset=asset,liveTiles=false){
 modules.dispose(host);host.replaceChildren();host.dataset.theme=theme;host.style.backgroundColor=theme==='none'?data.background:window.TeacherTilesPresentationThemes.get(theme).background;const themeArt=window.TeacherTilesPresentationThemes.url(theme,data.themeLayout);host.classList.toggle('has-theme-art',!!themeArt);host.style.backgroundImage=themeArt?`url("${themeArt}")`:'';host.style.backgroundSize='100% 100%';
 for(const e of data.elements){
  const el=document.createElement('div');el.className='pres-object pres-object--'+e.type;el.dataset.object=e.id;el.style.cssText='left:'+e.x/9.6+'%;top:'+e.y/5.4+'%;width:'+e.w/9.6+'%;height:'+e.h/5.4+'%;';
  if(e.type==='text'){el.textContent=e.text;el.style.fontSize=e.fontSize/9.6+'cqw';el.style.fontWeight=e.bold?'750':'450';el.style.color=textColor(e,theme);el.style.textAlign=e.align;renderRich(el,e);}
  if(e.type==='shape'){const fill=document.createElement('div');fill.className='pres-shape-fill';fill.dataset.shape=e.shape;if(shapePaths[e.shape]){fill.style.background='none';fill.innerHTML='<svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%"><path d="'+shapePaths[e.shape]+'"/></svg>';fill.querySelector('path').setAttribute('fill',e.color);}else fill.style.backgroundColor=e.color;el.append(fill);}
  if(e.type==='sticker'&&e.emoji){const glyph=emojiCanvas(e);glyph.className='pres-emoji';glyph.setAttribute('aria-label',e.emoji);el.append(glyph);}
  if(e.type==='image'||e.type==='sticker'&&e.src){const img=document.createElement('img');img.draggable=false;img.alt=e.type==='image'?'Uploaded image':'Sticker';el.append(img);if(e.src)img.src=e.src;else resolveAsset(e.asset).then(src=>{if(img.isConnected)img.src=src}).catch(()=>{if(img.isConnected){img.remove();el.textContent='Image unavailable';el.classList.add('pres-image-error')}});}
  el.style.transform='rotate('+(e.rotation||0)+'deg)';
  if(interactive&&e.type!=='tile'){el.tabIndex=0;el.setAttribute('aria-label',e.type==='text'?'Text: '+e.text.slice(0,60):e.type+' object');el.classList.toggle('is-selected',selection.has(e.id));for(const corner of ['nw','ne','sw','se',...(e.type==='text'?['w','e']:[])]){const handle=button('','Resize '+corner.toUpperCase());handle.className='pres-resize';handle.dataset.handle=corner;handle.title=corner.length===2?'Scale from corner':'Adjust text wrapping';el.append(handle);}const rotate=button('','Rotate object');rotate.className='pres-rotate';rotate.innerHTML=icons.rotate;rotate.title='Drag to rotate · Shift snaps to 15°';if(e.y<34)rotate.style.top='4px';const remove=button('×','Delete selected object');remove.className='pres-object-remove';if(e.y<34){remove.style.top='8px';remove.style.right='8px';}if(e.x+e.w>946)remove.style.right='4px';remove.onpointerdown=ev=>ev.stopPropagation();remove.onclick=ev=>{ev.stopPropagation();select([e.id]);actions['delete-object']()};el.append(rotate,remove);el.addEventListener('pointerdown',event=>drag(event,e,el));if(e.type==='text')el.addEventListener('dblclick',()=>editText(e,el));}
  host.append(el);
  if(e.type==='table')modules.mountTable(el,e,{editable:interactive,change:changed,checkpoint,select:()=>{select([e.id]);updateTools();}});
  if(e.type==='tile')modules.mountTile(el,e,{live:interactive||host===canvas||liveTiles,editable:interactive,change:changed,checkpoint,deselect:()=>{select();updateTools();},commit:()=>{changed();renderSlides();},remove:()=>{select([e.id]);deleteObjects();},read:resolveAsset,scope:owner+'/'+deckId,upload:async image=>{const result=await api({action:'upload',id:deckId,image});return result.asset;},error:error=>say(error.message||String(error),true)});
 }
}
function renderCanvas(){closeColorPopup();if(!deck)return;finishText();paintSlide(canvas,slide(),deck.theme,!play);$('.pres-current-slide',root).textContent='Slide '+(slideIndex+1)+' of '+deck.slides.length;$('.pres-play-controls span',root).textContent=(slideIndex+1)+' / '+deck.slides.length;updateTools();}
function renderSlides(){const list=$('.pres-slide-list',root);list.replaceChildren();deck.slides.forEach((s,i)=>{const row=document.createElement('div');row.className='pres-slide-entry';wireSlideDrag(row,i,list);row.classList.toggle('is-active',i===slideIndex);const thumb=button('','Open slide '+(i+1));thumb.className='pres-slide-thumb';thumb.setAttribute('aria-current',String(i===slideIndex));const preview=document.createElement('div');preview.className='pres-slide';paintSlide(preview,s,deck.theme);thumb.append(preview);thumb.onclick=()=>{slideIndex=i;select();renderEditor()};const controls=document.createElement('div');controls.className='pres-slide-actions';const n=document.createElement('span');n.textContent=String(i+1).padStart(2,'0');controls.append(n);for(const [text,label,fn]of [['↑','Move slide up',()=>moveSlide(i,-1)],['↓','Move slide down',()=>moveSlide(i,1)],['⧉','Duplicate slide',()=>duplicateSlide(i)],['×','Delete slide',()=>deleteSlide(i)]]){const b=button(text,label);b.onclick=fn;b.disabled=label==='Move slide up'&&i===0||label==='Move slide down'&&i===deck.slides.length-1||label==='Delete slide'&&deck.slides.length===1;controls.append(b)}row.append(thumb,controls);list.append(row)});const add=button('','Add slide');add.className='pres-add-slide';add.dataset.action='add-slide';add.innerHTML=icons.plus+'<span>New Slide</span>';list.append(add);$('.pres-slide-count',root).textContent=deck.slides.length+' slides';}
function fit(){if(!deck)return;const inset=play?0:48;canvas.style.width=Math.max(120,Math.min(area.clientWidth-inset,(area.clientHeight-inset)*16/9))+'px';applyView();}
new ResizeObserver(fit).observe(area);
function renderEditor(){toolbar.querySelectorAll('select').forEach(s=>s._formatControl?.close());transitionDialog.hidden=true;transitions.cancel(canvas);title.value=deck.title;renderCanvas();renderSlides();fit();}
function updateTools(){const e=current();$('.pres-size-tools',root).hidden=!e||e.type==='tile'||play;positionObjectTools();for(const [selector,key] of [['.pres-width','w'],['.pres-height','h'],['.pres-angle','rotation']])$(selector,root).value=e?Math.round(e[key]||0):'';$('.pres-background-label',root).hidden=deck?.theme!=='none';$('.pres-theme-background',root).hidden=deck?.theme==='none';if(slide()){$('.pres-background',root).value=slide().background;$('.pres-theme-variant',root).value=slide().themeLayout||'';}toolbar.hidden=!e||e.type==='tile'||play;tableTools.hidden=e?.type!=='table';if(e?.type==='table')for(const input of tableTools.querySelectorAll('input')){if(input.type==='checkbox')input.checked=e[input.dataset.table];else input.value=e[input.dataset.table];}for(const el of toolbar.querySelectorAll('.pres-text-control'))el.hidden=e?.type!=='text';$('.pres-shape-select',root).hidden=e?.type!=='shape';$('.pres-color-control',root).hidden=!['text','shape'].includes(e?.type);if(e){$('.pres-font-size',root).value=e.fontSize||36;$('.pres-align',root).value=e.align||'left';$('.pres-shape-select',root).value=e.shape||'rectangle';$('.pres-object-color',root).value=e.type==='text'?textColor(e):e.color||'#819cc6';updateRichTools(e);}canvas.querySelectorAll('.pres-object').forEach(n=>n.classList.toggle('is-selected',selection.has(n.dataset.object)));$('[data-action="undo"]',root).disabled=!undo.length;$('[data-action="redo"]',root).disabled=!redo.length;}

function positionObjectTools(){const panel=$('.pres-size-tools',root),e=current(),target=e&&canvas.querySelector('[data-object="'+e.id+'"]');if(!target||e.type==='tile'||play||root.hidden){panel.hidden=true;return;}const r=target.getBoundingClientRect();panel.style.left=Math.max(8,Math.min(innerWidth-panel.offsetWidth-8,r.left+r.width/2-panel.offsetWidth/2))+'px';panel.style.top=Math.max(8,Math.min(innerHeight-panel.offsetHeight-8,r.bottom+18))+'px';}
const objectToolsResize=new ResizeObserver(positionObjectTools);objectToolsResize.observe(canvas);objectToolsResize.observe($('.pres-size-tools',root));
function tileMenu(){menu.replaceChildren();menu.setAttribute('aria-label','Choose a tile');for(const [type,name]of modules.entries){const b=button('',name);b.innerHTML=modules.icon(type)+'<span>'+name+'</span>';b.dataset.tileChoice=type;b.onclick=()=>addObject('tile',{...modules.tileSize(type),tileType:type,tileState:{}});menu.append(b);}menu.hidden=false;fitMenu();}
function tableMenu(){menu.replaceChildren();menu.setAttribute('aria-label','Create table');const form=document.createElement('form');form.className='pres-table-create';form.innerHTML='<strong>Table</strong><label>Rows<input name="rows" type="number" min="1" max="20" value="3" required></label><label>Columns<input name="cols" type="number" min="1" max="12" value="3" required></label><button type="submit">Insert Table</button>';form.onsubmit=event=>{event.preventDefault();addObject('table',{w:540,h:240,...objectContract.table({rows:Number(form.elements.rows.value),cols:Number(form.elements.cols.value)})});};menu.append(form);menu.hidden=false;fitMenu();}
const tableTools=document.createElement('div');tableTools.className='pres-table-tools';tableTools.hidden=true;tableTools.innerHTML='<label>Rows<input type="number" min="1" max="20" data-table="rows"></label><label>Columns<input type="number" min="1" max="12" data-table="cols"></label><label>Size<input type="number" min="8" max="72" data-table="fontSize"></label><label>Text<input type="color" data-table="color"></label><label>Fill<input type="color" data-table="fill"></label><label>Lines<input type="color" data-table="border"></label><label>Header<input type="checkbox" data-table="header"></label><label>Header Color<input type="color" data-table="headerFill"></label>';toolbar.prepend(tableTools);
tableTools.addEventListener('change',event=>{const key=event.target.dataset.table;if(!key)return;alter(e=>{e[key]=event.target.type==='checkbox'?event.target.checked:event.target.type==='number'?Number(event.target.value):event.target.value;Object.assign(e,objectContract.table(e));});});

function addObject(type,extra={}){if(!deck||play)return;finishText();if(slide().elements.length>=100){say('This slide has 100 objects. Add another slide.',true);return}checkpoint();const e={id:id(),type,x:insertPoint?.x??220,y:insertPoint?.y??150,w:type==='text'?460:220,h:type==='text'?140:180,...(type==='text'?{text:'Double-click to edit',fontSize:40,color:'auto',bold:false,align:'left'}:{}),...(type==='shape'?{shape:'rectangle',color:'#91add5'}:{}),...extra};e.x=Math.max(0,Math.min(960-e.w,e.x));e.y=Math.max(0,Math.min(540-e.h,e.y));slide().elements.push(e);select([e.id]);insertPoint=null;menu.hidden=true;changed();renderEditor();return e;}
function scaleRich(nodes,factor){for(const n of nodes){if(n.style?.fontSize)n.style.fontSize=Math.max(6,Math.min(300,n.style.fontSize*factor));if(n.children)scaleRich(n.children,factor);}}
function drag(event,e,el){if(event.target.closest('.pres-size-tools,.pres-tile-done')||event.target.isContentEditable||el.classList.contains('is-tile-editing')&&event.target.closest('.pres-embedded-tile'))return;
 if(play||event.button!==0||event.target.closest('[contenteditable="true"]'))return;
 event.preventDefault();event.stopPropagation();finishText();
 const toggleOff=event.shiftKey&&selection.has(e.id)&&!event.target.closest('.pres-resize,.pres-rotate');
 if(event.shiftKey&&!event.target.closest('.pres-resize,.pres-rotate')){select([...new Set([...selection,e.id])]);}
 else if(!selection.has(e.id))select([e.id]);
 updateTools();canvas.focus({preventScroll:true});
 const resize=event.target.closest('.pres-resize'),rotate=event.target.closest('.pres-rotate'),r=canvas.getBoundingClientRect(),scale=r.width/960;
 const original=chosen().map(copy),primary=copy(e),cx=r.left+(e.x+e.w/2)*scale,cy=r.top+(e.y+e.h/2)*scale;
 const angle=Math.atan2(event.clientY-cy,event.clientX-cx),sx=event.clientX,sy=event.clientY;
 let moved=false;el.setPointerCapture(event.pointerId);
 const move=ev=>{
  if(ev.pointerId!==event.pointerId)return;
  let dx=(ev.clientX-sx)/scale,dy=(ev.clientY-sy)/scale;
  if(!moved&&Math.abs(dx)+Math.abs(dy)<2)return;
  if(!moved){checkpoint();moved=true;}
  if(rotate){let a=(primary.rotation||0)+(Math.atan2(ev.clientY-cy,ev.clientX-cx)-angle)*180/Math.PI;if(ev.shiftKey)a=Math.round(a/15)*15;e.rotation=((a%360)+360)%360;}
  else if(resize){
   const edge=resize.dataset.handle||'se',a=(primary.rotation||0)*Math.PI/180,cos=Math.cos(a),sin=Math.sin(a),rx=dx*cos+dy*sin,ry=-dx*sin+dy*cos;
   const hx=edge.includes('w')?-1:1,corner=edge.length===2,hy=corner?(edge.includes('n')?-1:1):0;
   let w=Math.max(20,primary.w+rx*hx),h=corner?Math.max(20,primary.h+ry*hy):primary.h;
   if((aspectLocked||ev.shiftKey)){const k=corner?Math.max(20/primary.w,20/primary.h,1+(rx*hx*primary.w+ry*hy*primary.h)/(primary.w**2+primary.h**2)):w/primary.w;w=primary.w*k;h=primary.h*k;}
   const max=Math.min(1,960/w,540/h);w*=max;h*=max;
   const cx=primary.x+primary.w/2+cos*(w-primary.w)*hx/2-sin*(h-primary.h)*hy/2,cy=primary.y+primary.h/2+sin*(w-primary.w)*hx/2+cos*(h-primary.h)*hy/2;
   e.w=w;e.h=h;e.x=Math.max(0,Math.min(960-w,cx-w/2));e.y=Math.max(0,Math.min(540-h,cy-h/2));
   if(e.type==='text'&&(corner||(aspectLocked||ev.shiftKey))){const factor=Math.min(w/primary.w,h/primary.h);e.fontSize=Math.max(6,Math.min(300,primary.fontSize*factor));if(primary.rich){e.rich=copy(primary.rich);scaleRich(e.rich,factor);}}
   if(e.type==='text'&&!corner&&!(aspectLocked||ev.shiftKey)){const node=el.querySelector('.pres-rich');el.style.width=w/9.6+'%';node.style.height='auto';e.h=Math.min(540-e.y,Math.max(e.fontSize*1.18,node.scrollHeight/(canvas.clientWidth/960)));node.style.height='100%';}
  }
  else{if(ev.shiftKey){if(Math.abs(dx)>Math.abs(dy))dy=0;else dx=0;}const left=Math.min(...original.map(o=>o.x)),right=Math.max(...original.map(o=>o.x+o.w)),top=Math.min(...original.map(o=>o.y)),bottom=Math.max(...original.map(o=>o.y+o.h));dx=Math.max(-left,Math.min(960-right,dx));dy=Math.max(-top,Math.min(540-bottom,dy));for(const old of original){const target=slide().elements.find(o=>o.id===old.id);target.x=old.x+dx;target.y=old.y+dy;}}
  for(const obj of chosen()){const node=canvas.querySelector('[data-object="'+obj.id+'"]');node.style.left=obj.x/9.6+'%';node.style.top=obj.y/5.4+'%';node.style.width=obj.w/9.6+'%';node.style.height=obj.h/5.4+'%';node.style.transform='rotate('+(obj.rotation||0)+'deg)';if(obj.type==='text'){node.style.fontSize=obj.fontSize/9.6+'cqw';renderRichContent(node.querySelector('.pres-rich'),obj);}}
  positionObjectTools();
 };
 const end=()=>{el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',end);el.removeEventListener('pointercancel',end);if(moved){changed();renderEditor();}else if(toggleOff){select([...selection].filter(key=>key!==e.id));updateTools();}};
 el.addEventListener('pointermove',move);el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
}
function workspacePointer(event){
 if(play||!deck)return;
 if(event.button===1){event.preventDefault();finishText();const start={x:event.clientX,y:event.clientY,...{px:pan.x,py:pan.y}};area.setPointerCapture(event.pointerId);area.classList.add('is-panning');const move=e=>{pan.x=start.px+e.clientX-start.x;pan.y=start.py+e.clientY-start.y;applyView();};const end=()=>{area.removeEventListener('pointermove',move);area.removeEventListener('pointerup',end);area.removeEventListener('pointercancel',end);area.classList.remove('is-panning');};area.addEventListener('pointermove',move);area.addEventListener('pointerup',end);area.addEventListener('pointercancel',end);return;}
 if(event.button!==0||event.target.closest('.pres-object'))return;
 event.preventDefault();finishText();canvas.focus({preventScroll:true});const start={x:event.clientX,y:event.clientY},previous=event.shiftKey?[...selection]:[];select(previous);updateTools();
 const box=document.createElement('div');box.className='pres-marquee';root.append(box);area.setPointerCapture(event.pointerId);
 const move=e=>{const x=Math.min(start.x,e.clientX),y=Math.min(start.y,e.clientY),w=Math.abs(e.clientX-start.x),h=Math.abs(e.clientY-start.y);Object.assign(box.style,{left:x+'px',top:y+'px',width:w+'px',height:h+'px'});const hits=[...canvas.querySelectorAll('.pres-object:not(.pres-object--tile)')].filter(n=>{const b=n.getBoundingClientRect();return b.right>x&&b.left<x+w&&b.bottom>y&&b.top<y+h}).map(n=>n.dataset.object);select([...new Set([...previous,...hits])]);updateTools();};
 const end=()=>{box.remove();area.removeEventListener('pointermove',move);area.removeEventListener('pointerup',end);area.removeEventListener('pointercancel',end);};area.addEventListener('pointermove',move);area.addEventListener('pointerup',end);area.addEventListener('pointercancel',end);
}
function applyView(){canvas.style.transform=play?'none':'translate('+pan.x+'px,'+pan.y+'px) scale('+zoom+')';positionObjectTools();}
function deleteObjects(){if(!selection.size)return;finishText();checkpoint();slide().elements=slide().elements.filter(e=>!selection.has(e.id));select();changed();renderEditor();}
function duplicateObjects(source=chosen()){if(!source.length)return;finishText();if(slide().elements.length+source.length>100){say('This slide can contain up to 100 objects.',true);return;}checkpoint();const clones=source.map(e=>({...copy(e),id:id(),x:Math.min(960-e.w,e.x+20),y:Math.min(540-e.h,e.y+20)}));slide().elements.push(...clones);select(clones.map(e=>e.id));changed();renderEditor();}
function reorderSlide(from,to){if(from===to)return;finishText();checkpoint();const active=slide().id,[moved]=deck.slides.splice(from,1);deck.slides.splice(to,0,moved);slideIndex=deck.slides.findIndex(s=>s.id===active);changed();renderEditor();}
function wireSlideDrag(row,i,list){row.draggable=true;row.dataset.slideIndex=i;row.addEventListener('dragstart',event=>{finishText();slideDrag=i;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('application/x-teachertiles-slide',String(i));row.classList.add('is-dragging');});row.addEventListener('dragend',()=>{slideDrag=-1;list.querySelectorAll('.is-drop-target,.is-dragging').forEach(n=>n.classList.remove('is-drop-target','is-dragging'));});row.addEventListener('dragover',event=>{if(slideDrag<0)return;event.preventDefault();event.dataTransfer.dropEffect='move';list.querySelectorAll('.is-drop-target').forEach(n=>n.classList.remove('is-drop-target'));row.classList.add('is-drop-target');});row.addEventListener('drop',event=>{if(slideDrag<0)return;event.preventDefault();event.stopPropagation();reorderSlide(slideDrag,i);slideDrag=-1;});}

function alter(fn){if(!current())return;finishText();checkpoint();chosen().forEach(fn);changed();renderEditor();}
function moveSlide(i,offset){if(i+offset<0||i+offset>=deck.slides.length)return;checkpoint();const [s]=deck.slides.splice(i,1);deck.slides.splice(i+offset,0,s);slideIndex=i+offset;changed();renderEditor();}
function duplicateSlide(i){if(deck.slides.length>=500)return;checkpoint();const s=copy(deck.slides[i]);s.id=id();s.elements.forEach(e=>e.id=id());deck.slides.splice(i+1,0,s);slideIndex=i+1;select();changed();renderEditor();}
function deleteSlide(i){if(deck.slides.length===1)return;checkpoint();deck.slides.splice(i,1);slideIndex=Math.min(slideIndex,deck.slides.length-1);select();changed();renderEditor();}
function themeDialog(){
 const dialog=$('.pres-theme-dialog',root),grid=$('.pres-theme-grid',root);grid.replaceChildren();
 for(const theme of window.TeacherTilesPresentationThemes.all){
  const accessible=!theme.productId||cosmeticIsAccessible(theme.productId),b=button('');b.dataset.presentationTheme=theme.id;b.setAttribute('aria-pressed',String(deck.theme===theme.id));b.setAttribute('aria-label',theme.name+(accessible?'':', view in shop'));b.classList.toggle('is-locked',!accessible);
  const swatch=document.createElement('div');swatch.className='pres-slide';paintSlide(swatch,{background:'#ffffff',elements:[{id:'theme',type:'text',text:'Aa',fontSize:100,x:100,y:160,w:600,h:180,color:'auto'}]},theme.id);
  const label=document.createElement('strong');label.textContent=theme.name;const status=document.createElement('small');status.textContent=!accessible?'View in Shop':deck.theme===theme.id?'Applied':'Apply Theme';b.append(swatch,label,status);
  b.onclick=()=>{if(!accessible){window.TeacherTilesShop.openProduct(theme.productId);return;}finishText();checkpoint();deck.theme=theme.id;changed();dialog.hidden=true;renderEditor();$('[data-action=themes]',root).focus();};grid.append(b);
 }
 filterThemes();dialog.hidden=false;
}
function filterThemes(){const query=$('.pres-theme-search',root).value.trim().toLowerCase();let count=0;for(const choice of $('.pres-theme-grid',root).children){choice.hidden=!choice.querySelector('strong').textContent.toLowerCase().includes(query);if(!choice.hidden)count++;}$('.pres-theme-empty',root).hidden=!!count;}
$('.pres-theme-search',root).addEventListener('input',filterThemes);
// Shop ownership updates are reflected when returning to the open picker.
new MutationObserver(()=>{if(!$('#shop-modal').hidden||root.hidden||!deck||$('.pres-theme-dialog',root).hidden)return;themeDialog();}).observe($('#shop-modal'),{attributes:true,attributeFilter:['hidden']});

async function upload(file){
 if(!file||!deck)return;const targetDeck=deckId,targetSlide=slide().id,point=insertPoint?{...insertPoint}:null;
 try{
  if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type)||file.size>20000000)throw Error('Choose a PNG, JPEG, WebP, or GIF under 20 MB.');
  say('Preparing image…');let image,width,height;
  if(file.type==='image/gif'){
   if(file.size>6000000)throw Error('Choose a GIF under 6 MB to keep your presentation quick to load.');
   image=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Could not read GIF.'));reader.readAsDataURL(file);});
   const img=new Image();img.src=image;await img.decode();width=img.naturalWidth;height=img.naturalHeight;
  }else{
   const bitmap=await createImageBitmap(file),c=document.createElement('canvas'),ratio=Math.min(1,1280/Math.max(bitmap.width,bitmap.height));c.width=Math.round(bitmap.width*ratio);c.height=Math.round(bitmap.height*ratio);c.getContext('2d').drawImage(bitmap,0,0,c.width,c.height);bitmap.close();
   image=c.toDataURL('image/webp',.8);for(let q=.65;image.length>340000&&q>=.2;q-=.15)image=c.toDataURL('image/webp',q);if(image.length>340000)throw Error('This image is too detailed. Try a smaller image.');width=c.width;height=c.height;
  }
  const result=await api({action:'upload',id:targetDeck,image});if(deckId!==targetDeck||slide()?.id!==targetSlide)throw Error('Slide changed while uploading. Select the original slide and try again.');
  cacheAsset(owner+'/'+deckId+'/'+result.asset,image);insertPoint=point;
  const k=Math.min(360/width,320/height);addObject('image',{asset:result.asset,w:Math.max(20,width*k),h:Math.max(20,height*k)});say('');
 }catch(error){say(error.message,true);}
}
function drawRichPreview(g,e){
 const host=document.createElement('div');host.className='pres-slide';host.style.cssText='position:fixed;left:-12000px;top:0;width:960px;height:540px;pointer-events:none;';root.append(host);
 try{
  paintSlide(host,{background:'#fff',elements:[{...e,rotation:0}]},'none');const text=host.querySelector('.pres-rich'),origin=host.getBoundingClientRect();
  const walker=document.createTreeWalker(text,NodeFilter.SHOW_TEXT);let node;
  while((node=walker.nextNode())){
   const cs=getComputedStyle(node.parentElement);g.font=cs.fontStyle+' '+cs.fontWeight+' '+cs.fontSize+' '+cs.fontFamily;g.textBaseline='alphabetic';
   for(const match of node.textContent.matchAll(/\S+|\s/g)){
    const range=document.createRange();range.setStart(node,match.index);range.setEnd(node,match.index+match[0].length);const boxes=[...range.getClientRects()];
    const draw=(value,box)=>{if(!box.width||!box.height)return;const x=box.left-origin.left,y=box.top-origin.top,size=parseFloat(cs.fontSize),baseline=y+(box.height-size)/2+size*.82;
     if(cs.backgroundColor!=='rgba(0, 0, 0, 0)'&&cs.backgroundColor!=='transparent'){g.fillStyle=cs.backgroundColor;g.fillRect(x,y,box.width,box.height);}g.fillStyle=cs.color;g.fillText(value,x,baseline);
     for(const [key,offset] of [['underline',size*.08],['line-through',-size*.3]])if(cs.textDecorationLine.includes(key)){g.fillRect(x,baseline+offset,box.width,Math.max(1,size*.05));}
    };
    if(boxes.length===1)draw(match[0],boxes[0]);else for(let i=0;i<match[0].length;i++){range.setStart(node,match.index+i);range.setEnd(node,match.index+i+1);draw(match[0][i],range.getBoundingClientRect());}
   }
  }
  text.querySelectorAll('li').forEach(li=>{const b=li.getBoundingClientRect(),cs=getComputedStyle(li);g.font=cs.font;g.fillStyle=cs.color;g.fillText(li.parentElement.tagName==='OL'?([...li.parentElement.children].indexOf(li)+1)+'.':'•',b.left-origin.left-parseFloat(cs.fontSize),b.top-origin.top+parseFloat(cs.fontSize));});
 }finally{host.remove();}
}


function emojiCanvas(e,k=2){const c=document.createElement('canvas');c.width=Math.max(1,Math.ceil(e.w*k));c.height=Math.max(1,Math.ceil(e.h*k));const g=c.getContext('2d');g.scale(k,k);const size=Math.min(e.w,e.h)*.76,text=/^[A-Za-z0-9]+$/.test(e.emoji);g.font=(text?'950 ':'')+size+'px '+(text?'Inter,Arial,sans-serif':'"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif');g.textAlign='center';g.textBaseline='alphabetic';let m=g.measureText(e.emoji);const fit=Math.min(1,e.w*.86/Math.max(1,m.width),e.h*.86/Math.max(1,m.actualBoundingBoxAscent+m.actualBoundingBoxDescent));if(fit<1){g.font=g.font.replace(/[0-9.]+px/,size*fit+'px');m=g.measureText(e.emoji);}const x=e.w/2,y=e.h/2+(m.actualBoundingBoxAscent-m.actualBoundingBoxDescent)/2,b=Math.min(e.w,e.h)*.025;const layer=document.createElement('canvas');layer.width=c.width;layer.height=c.height;const l=layer.getContext('2d');l.scale(k,k);l.font=g.font;l.textAlign='center';l.textBaseline='alphabetic';l.fillText(e.emoji,x,y);l.globalCompositeOperation='source-in';l.fillStyle='#fff';l.fillRect(0,0,e.w,e.h);for(let i=0;i<16;i++){const a=i*Math.PI/8;g.drawImage(layer,Math.cos(a)*b,Math.sin(a)*b,e.w,e.h);}g.fillStyle='#263342';g.fillText(e.emoji,x,y);return c;}

async function renderSlide(document,index=0,scale=2,transparent=false,resolveAsset=asset,strict=true){const families=new Set();const collect=nodes=>{for(const n of nodes||[]){if(n.style?.fontFamily)families.add(n.style.fontFamily.split(',')[0].replace(/[\"']/g,''));collect(n.children);}};document.slides[index].elements.forEach(e=>collect(e.rich));await Promise.all([...families].map(loadFont));await window.document.fonts.ready;const c=window.document.createElement('canvas');c.width=Math.round(960*scale);c.height=Math.round(540*scale);const g=c.getContext('2d');g.scale(scale,scale);const s=document.slides[index];g.fillStyle=document.theme==='none'?s.background:window.TeacherTilesPresentationThemes.get(document.theme).background;if(!transparent)g.fillRect(0,0,960,540);if(document.theme==='white'){g.fillStyle='#8da5c32b';g.beginPath();g.arc(921.6,31.2,182.4,0,Math.PI*2);g.fill();g.fillRect(0,515.16,960,24.84)}else if(document.theme==='gray'){g.fillStyle='#d1dae7';g.beginPath();g.moveTo(0,0);g.lineTo(260,0);g.lineTo(0,260);g.fill();g.fillStyle='#c5d2e3';g.beginPath();g.moveTo(960,540);g.lineTo(760,540);g.lineTo(960,340);g.fill();g.fillStyle='#a1b2c6';g.fillRect(57.6,499,844.8,3.24)}else if(document.theme==='black'){g.strokeStyle='#a6bed52b';g.lineWidth=11.52;g.beginPath();g.arc(921.6,31.2,176.64,0,Math.PI*2);g.stroke();g.fillStyle='#a6bed5';g.fillRect(57.6,499.23,192,2.97)}await window.TeacherTilesPresentationThemes.draw(g,document.theme,s.themeLayout);for(const e of s.elements){if(e.type==='tile'){if(!strict){g.save();g.translate(e.x+e.w/2,e.y+e.h/2);g.rotate((e.rotation||0)*Math.PI/180);g.translate(-e.x-e.w/2,-e.y-e.h/2);modules.drawTile(g,e);g.restore();}continue;}g.save();if(e.rotation){g.translate(e.x+e.w/2,e.y+e.h/2);g.rotate(e.rotation*Math.PI/180);g.translate(-e.x-e.w/2,-e.y-e.h/2);}g.beginPath();g.rect(e.x,e.y,e.w,e.h);g.clip();if(e.type==='table'){modules.drawTable(g,e);}else if(e.type==='shape'){g.fillStyle=e.color;g.beginPath();if(e.shape==='ellipse')g.ellipse(e.x+e.w/2,e.y+e.h/2,e.w/2,e.h/2,0,0,Math.PI*2);else if(e.shape==='triangle'){g.moveTo(e.x+e.w/2,e.y);g.lineTo(e.x+e.w,e.y+e.h);g.lineTo(e.x,e.y+e.h)}else if(['star','hexagon','heart'].includes(e.shape)){const shapePath=new Path2D(shapePaths[e.shape]);g.translate(e.x,e.y);g.scale(e.w/100,e.h/100);g.fill(shapePath);g.scale(100/e.w,100/e.h);g.translate(-e.x,-e.y);}else g.rect(e.x,e.y,e.w,e.h);g.fill()}else if(e.type==='text'){drawRichPreview(g,{...e,color:textColor(e,document.theme)});}else if(e.emoji){g.drawImage(emojiCanvas(e),e.x,e.y,e.w,e.h)}else{try{const src=e.asset?await resolveAsset(e.asset):e.src;const img=new Image();if(src.startsWith('https:'))img.crossOrigin='anonymous';img.src=src;await img.decode();const k=Math.min(e.w/img.width,e.h/img.height);g.drawImage(img,e.x+(e.w-img.width*k)/2,e.y+(e.h-img.height*k)/2,img.width*k,img.height*k)}catch(error){if(strict)throw Error('An image on slide '+(index+1)+' could not be exported. '+error.message);}}g.restore()}return c;}
async function thumbnail(document){const key=JSON.stringify([document.theme,document.slides[0]]);if(key===coverKey&&cover)return cover;return (await renderSlide(document,0,1/3,false,asset,false)).toDataURL('image/webp',.55);}
async function save(){syncText();await modules.flush();clearTimeout(saveTimer);clearTimeout(localTimer);if(saving){await saving;if(dirty)return save();return}if(!deck||!dirty)return;const token=generation,target=deckId,stamp=version,snapshot=copy(deck),expected=revision;status.textContent='Saving…';saving=(async()=>{libraryChanges++;try{await writeDraft();const preview=await thumbnail(snapshot);const result=await api({action:'save',id:target,document:snapshot,cover:preview,expectedRevision:expected});if(token!==generation||deckId!==target)return;revision=result.revision;cover=preview;coverKey=JSON.stringify([snapshot.theme,snapshot.slides[0]]);dirty=stamp!==version;status.textContent=dirty?'Unsaved changes':'Saved';await writeDraft();const entry=items.find(x=>x.id===target);if(entry)Object.assign(entry,{title:snapshot.title,theme:snapshot.theme,cosmeticRequirements:cosmetics.requirements(snapshot),slideCount:snapshot.slides.length,cover,updatedAt:result.updatedAt,revision});libraryChanged();say('');}catch(error){status.textContent='Not synced';say(error.message+' Your draft is saved on this device.',true);if(String(error.code||'').includes('aborted')){const reload=button('Open cloud version');reload.onclick=()=>openDeck(target);notice.append(' ',reload)}throw error;}finally{saving=null}})();return saving;}
function downloadDraft(document){const blob=new Blob([JSON.stringify(document,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=window.document.createElement('a');a.href=url;a.download='presentation-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function renderLibrary(){const grid=$('.pres-library-grid',root);grid.replaceChildren();$('.pres-limit',root).innerHTML='<strong>Presentation Limit · '+items.length+' / '+(subscriber()?'∞':'5')+'</strong><span class="pres-plan '+(subscriber()?'is-subscriber':'')+'">'+(subscriber()?icons.crown+' SUBSCRIBER · UNLIMITED PRESENTATIONS':'FREE · UP TO 5 PRESENTATIONS')+'</span>'+(!subscriber()?'<span class="pres-upgrade">'+icons.crown+' Unlimited presentations with a subscription</span>':'');$('[data-action="more"]',root).hidden=!cursor;for(const item of [...items].sort((a,b)=>b.updatedAt-a.updatedAt)){const card=document.createElement('article');card.className='pres-library-card';const open=button('','Open '+item.title);open.className='pres-library-cover';if(item.cover){const img=document.createElement('img');img.loading='lazy';img.decoding='async';img.src=item.cover;img.alt='First slide of '+item.title;open.append(img)}else{const blank=document.createElement('div');blank.className='pres-library-blank';open.append(blank)}const missing=cosmetics.missing(item.cosmeticRequirements,window.TeacherTilesAccount?.state?.ownedProductIds,subscriber());if(missing.length){const lock=document.createElement('span');lock.className='pres-library-locked';lock.textContent='Locked · Cosmetics required';open.append(lock);}open.onclick=()=>missing.length?showAccess(missing):openDeck(item.id);const name=document.createElement('input');name.value=item.title;name.maxLength=100;name.setAttribute('aria-label','Presentation name');name.onchange=()=>rename(item,name.value);const foot=document.createElement('div');foot.className='pres-card-footer';const count=document.createElement('span');count.textContent=item.slideCount+' slide'+(item.slideCount===1?'':'s');const remove=button('Delete','Delete '+item.title);remove.onclick=()=>{deleteId=item.id;$('.pres-confirm',root).hidden=false};foot.append(count,remove);card.append(open,name,foot);grid.append(card)}const add=button('','New Presentation');add.className='pres-new-presentation';add.dataset.action='create';add.innerHTML=icons.plus+'<span>New Presentation</span>';grid.prepend(add);}
async function loadLibrary(more=false){
 if(libraryRequest)return libraryRequest.promise;
 if(!owner||more&&!cursor)return;
 const user=owner,epoch=libraryEpoch,changes=libraryChanges,startCursor=more?cursor:null,request={promise:null};
 libraryRequest=request;library.classList.add('is-loading');library.setAttribute('aria-busy','true');$('[data-action=more]',root).disabled=true;
 if(!deck)status.textContent=libraryKnown?'Updating presentations…':'Loading presentations…';
 request.promise=(async()=>{
  try{
   let next=startCursor,rows=[],pages=0;const wanted=more?25:Math.max(25,Math.min(LIBRARY_CACHE_LIMIT,items.length));
   do{const result=await api({action:'list',cursor:next});rows.push(...libraryRows(result.items));next=result.cursor||null;pages++;}while(!more&&next&&rows.length<wanted&&pages<4&&owner===user&&libraryEpoch===epoch);
   if(owner!==user||uid()!==user||libraryEpoch!==epoch)return;
   // A concurrent rename/create/delete/save wins over a list request started earlier.
   if(libraryChanges!==changes){loadedAt=0;persistLibrary();return;}
   const updated=[...new Map((more?[...items,...rows]:rows).map(item=>[item.id,item])).values()],needsPaint=JSON.stringify(updated)!==JSON.stringify(items)||cursor!==next;items=updated;cursor=next;loadedAt=Date.now();libraryKnown=true;persistLibrary();if(needsPaint)paintLibraryUpdate();
  }catch(error){if(owner!==user||libraryEpoch!==epoch)return;say(libraryKnown?'Could not update presentations. Showing the saved library on this device.':error.message,true);const retry=button('Retry');retry.onclick=()=>loadLibrary(more);notice.append(' ',retry);}
  finally{if(libraryRequest===request){libraryRequest=null;library.classList.remove('is-loading');library.setAttribute('aria-busy','false');$('[data-action=more]',root).disabled=false;if(!deck)status.textContent='';}}
 })();return request.promise;
}

async function openDeck(key){if(opening)return;opening=true;busy(true);say('');try{const result=await api({action:'load',id:key});const cached=await local(owner+'/'+key);if(!checkAccess(cached?.dirty&&cached.revision===result.revision?cached.document:result.document))return;deckId=key;revision=result.revision;deck=result.document;deck.title=result.title;await loadDeckFonts(deck);renderFonts();cover=result.cover||'';coverKey='';dirty=false;if(cached?.dirty){if(cached.revision===revision){deck=cached.document;dirty=true;say('Recovered your unsaved draft.')}else {await local(owner+'/'+key+'/conflict',cached);say('A local draft conflicts with a newer cloud version. The cloud version is open.',true);const download=button('Download local draft');download.onclick=()=>downloadDraft(cached.document);notice.append(' ',download);}}slideIndex=0;select();pan={x:0,y:0};zoom=1;undo=[];redo=[];generation++;version=0;library.hidden=true;editor.hidden=false;title.hidden=false;$('[data-action="save"]',root).hidden=false;status.textContent=dirty?'Recovered draft':'Saved';renderEditor();if(dirty)changed();}catch(error){say(error.message,true)}finally{opening=false;busy(false)}}
async function create(){if(opening)return;libraryChanges++;if(!subscriber()&&items.length>=5){say('Free accounts can save up to 5 presentations. Subscribe for unlimited presentations.',true);return}opening=true;busy(true);try{const key=id(),document={schemaVersion:1,title:'Untitled Presentation',theme:'none',slides:[{id:id(),background:'#ffffff',elements:[]}]};await api({action:'create',id:key,document});items.push({id:key,title:document.title,slideCount:1,updatedAt:Date.now(),cover:''});libraryKnown=true;libraryChanged();opening=false;await openDeck(key);}catch(error){say(error.message,true)}finally{opening=false;busy(false)}}
async function rename(item,value){libraryChanges++;try{const result=await api({action:'load',id:item.id});result.document.title=value.trim()||'Untitled Presentation';const saved=await api({action:'save',id:item.id,expectedRevision:result.revision,document:result.document,cover:result.cover||''});Object.assign(items.find(row=>row.id===item.id)||item,{title:result.document.title,revision:saved.revision,updatedAt:saved.updatedAt||Date.now()});libraryChanged();renderLibrary();}catch(error){say(error.message,true)}}
async function back(){closeColorPopup();if(backgroundMenu.matches(':popover-open'))backgroundMenu.hidePopover();transitionDialog.hidden=true;hideDeckExport();finishText();layoutDialog.hidden=true;await save();if(dirty)return;stopPlay();deck=null;deckId='';select();editor.hidden=true;library.hidden=false;title.hidden=true;$('[data-action="save"]',root).hidden=true;status.textContent='';menu.hidden=true;$('.pres-theme-dialog',root).hidden=true;document.getElementById('asset-shelf-close')?.click();renderLibrary();}
async function close(){closeColorPopup();if(backgroundMenu.matches(':popover-open'))backgroundMenu.hidePopover();toolbar.querySelectorAll('select').forEach(s=>s._formatControl?.close());transitionDialog.hidden=true;hideDeckExport();finishText();layoutDialog.hidden=true;await save();if(dirty)return;stopPlay();exportMenu.hidden=true;root.hidden=true;document.body.classList.remove('presentations-open');document.getElementById('asset-shelf-close')?.click();deck=null;deckId='';$('#profile-toggle')?.focus();}
async function open(){
 const next=uid();root.hidden=false;document.body.classList.add('presentations-open');document.getElementById('profile-modal').hidden=true;document.getElementById('asset-shelf-close')?.click();
 if(owner!==next){for(const face of document.fonts)if(face.family.startsWith('TTFont_'))document.fonts.delete(face);embeddedFontLoads.clear();owner=next;items=[];cursor=null;loadedAt=0;deck=null;deckId='';assets.clear();libraryKnown=false;libraryRequest=null;libraryEpoch++;libraryChanges=0;libraryRenderPending=false;library.classList.remove('is-loading');library.setAttribute('aria-busy','false');}
 library.hidden=false;editor.hidden=true;title.hidden=true;status.textContent='';$('[data-action="save"]',root).hidden=true;say('');renderLibrary();
 if(!owner){say('Sign in to create and save presentations.',true);return;}
 const user=owner,epoch=libraryEpoch;
 if(!libraryKnown)await Promise.race([hydrateLibrary(user,epoch),new Promise(resolve=>setTimeout(resolve,120))]);
 if(owner!==user||uid()!==user||libraryEpoch!==epoch)return;
 if(!libraryKnown||Date.now()-loadedAt>LIBRARY_TTL)await loadLibrary();
}

let presentationFullscreen=false;
document.addEventListener('fullscreenchange',()=>{if(document.fullscreenElement===root){presentationFullscreen=true;fit();}else if(presentationFullscreen){presentationFullscreen=false;if(play)stopPlay();}});
function stopPlay(){transitions.cancel(canvas);if(document.fullscreenElement===root)void document.exitFullscreen().catch(()=>{});play=false;root.classList.remove('is-presenting');$('.pres-play-controls',root).hidden=true;if(deck){renderCanvas();fit()}}
function navigate(amount){if(!checkAccess(deck)){lockCurrent();return;}const next=Math.max(0,Math.min(deck.slides.length-1,slideIndex+amount));if(next===slideIndex)return;const transition=transitions.between(deck.slides,slideIndex,next,amount);transitionDialog.hidden=true;slideIndex=next;transitions.animate(canvas,transition,renderCanvas,amount);}

// File operations stay separate from autosave and only load their converters on demand.
let fileToolsPromise=null,fileOperation=false;
function fileTools(){if(!fileToolsPromise)fileToolsPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='presentations/files.js?v=20261020-objects';script.onload=()=>resolve(window.TeacherTilesPresentationFiles);script.onerror=()=>{fileToolsPromise=null;script.remove();reject(Error('Could not load presentation file tools. Please try again.'));};document.head.append(script);});return fileToolsPromise;}
const deckExportMenu=document.createElement('div');deckExportMenu.className='pres-menu pres-deck-export-menu';deckExportMenu.hidden=true;deckExportMenu.setAttribute('role','menu');deckExportMenu.setAttribute('aria-label','Export presentation');root.append(deckExportMenu);
function hideDeckExport(){deckExportMenu.hidden=true;$('[data-action="export-presentation"]',root).setAttribute('aria-expanded','false');}
for(const [format,label,detail] of [['pdf','PDF','All slides · ready to print'],['pptx','PowerPoint (.pptx)','Editable text, shapes & images'],['png','PNG images','All slides · ZIP for multiple slides'],['tt','TeacherTiles (.tt)','Complete editable presentation']]){
 const b=button('',label);b.dataset.exportFormat=format;b.setAttribute('role','menuitem');const strong=document.createElement('strong'),small=document.createElement('small');strong.textContent=label;small.textContent=detail;b.append(strong,small);b.onclick=()=>exportPresentation(format);deckExportMenu.append(b);
}
function openDeckExport(){finishText();deckExportMenu.querySelector('.pres-tile-export-warning')?.remove();if(deck.slides.some(s=>s.elements.some(e=>e.type==='tile'))){const warning=document.createElement('p');warning.className='pres-tile-export-warning';warning.textContent='Tiles are removed from PDF, PowerPoint and PNG exports. Choose TeacherTiles (.tt) to keep working tiles.';deckExportMenu.prepend(warning);}if(!deckExportMenu.hidden){hideDeckExport();return;}menu.hidden=true;const b=$('[data-action="export-presentation"]',root),r=b.getBoundingClientRect();deckExportMenu.hidden=false;deckExportMenu.style.left=Math.max(8,Math.min(innerWidth-deckExportMenu.offsetWidth-8,r.right-deckExportMenu.offsetWidth))+'px';deckExportMenu.style.top=(r.bottom+8)+'px';b.setAttribute('aria-expanded','true');deckExportMenu.querySelector('button').focus();}
async function exportPresentation(format){
 if(fileOperation||!deck||!checkAccess(deck))return;finishText();await modules.flush();hideDeckExport();fileOperation=true;root.classList.add('is-file-operation');const token=owner,target=deckId,snapshot=copy(deck);say('Preparing export…');
 try{const files=await fileTools();if(format!=='tt')for(const s of snapshot.slides)s.elements=s.elements.filter(e=>e.type!=='tile');const read=async hash=>{if(owner!==token||uid()!==token)throw Error('Your account changed.');const key=token+'/'+target+'/'+hash;if(assets.has(key))return assets.get(key);const result=await api({action:'asset',id:target,asset:hash});cacheAsset(key,result.image);return result.image;};await Promise.all([...fontLoads.values()]);await files.exportFile(format,snapshot,{asset:read,render:(doc,i,k,transparent)=>renderSlide(doc,i,k,transparent,read),progress:message=>say(message)});say('Presentation exported.');}catch(error){say('Export failed: '+error.message,true);}finally{fileOperation=false;root.classList.remove('is-file-operation');}
}
const presentationUpload=document.createElement('input');presentationUpload.type='file';presentationUpload.accept='.pptx,.tt';presentationUpload.hidden=true;presentationUpload.setAttribute('aria-label','Upload presentation');root.append(presentationUpload);
presentationUpload.onchange=async()=>{
 const file=presentationUpload.files[0];presentationUpload.value='';if(!file||fileOperation)return;
 if(!subscriber()&&items.length>=5){say('Free accounts can save up to 5 presentations. Subscribe for unlimited presentations.',true);return;}
 libraryChanges++;fileOperation=true;root.classList.add('is-file-operation');busy(true);let created='',complete=false;const token=owner;
 try{
  say('Reading presentation…');const files=await fileTools(),imported=await files.importFile(file,message=>say(message));if(owner!==token||uid()!==token)throw Error('Your account changed. Reopen Presentations.');
  const key=id(),result=await api({action:'create',id:key,document:imported.document});created=key;
  // Load the server-normalized tree before creating any preview DOM from imported data.
  const normalized=(await api({action:'load',id:key})).document;let n=0;
  const mapped=new Map();for(const [old,image] of imported.images){say('Importing image '+(++n)+' of '+imported.images.size+'…');const uploaded=await api({action:'upload',id:key,image});mapped.set(old,uploaded.asset);cacheAsset(token+'/'+key+'/'+uploaded.asset,image);}
  for(const s of normalized.slides)for(const e of s.elements)if(e.type==='tile'&&e.tileType==='voicememo')for(const memo of e.tileState.special.memos){if(!mapped.has(memo.asset))throw Error('An imported voice memo is missing.');memo.asset=mapped.get(memo.asset);}
  for(const slide of normalized.slides)for(const element of slide.elements)if(element.type==='image'){if(!mapped.has(element.asset))throw Error('An imported image is missing.');element.asset=mapped.get(element.asset);}
  for(const font of normalized.fonts||[]){if(!mapped.has(font.asset))throw Error('An imported font is missing.');font.asset=mapped.get(font.asset);}
  const read=async hash=>assets.get(token+'/'+key+'/'+hash)||(await api({action:'asset',id:key,asset:hash})).image;
  await loadDeckFonts(normalized,read);
  const preview=(await renderSlide(normalized,0,1/3,false,read,false)).toDataURL('image/webp',.55);
  await api({action:'save',id:key,document:normalized,cover:preview,expectedRevision:result.revision});complete=true;items.push({id:key,title:normalized.title,slideCount:normalized.slides.length,cover:preview,updatedAt:Date.now()});libraryKnown=true;libraryChanged();
  await openDeck(key);say(imported.warnings.length?'Imported. '+imported.warnings.join(' '):'Presentation imported.');
 }catch(error){
  let cleanup='';if(created&&!complete){try{if(owner!==token||uid()!==token)throw Error('Account changed');await api({action:'delete',id:created});}catch{loadedAt=0;cleanup=' An incomplete import remains in your library; delete it before trying again.';}}
  say('Import failed: '+error.message+cleanup,true);
 }finally{fileOperation=false;root.classList.remove('is-file-operation');busy(false);}
};
root.addEventListener('pointerdown',event=>{if(!deckExportMenu.contains(event.target)&&!event.target.closest('[data-action="export-presentation"]'))hideDeckExport();});
root.addEventListener('keydown',event=>{if(event.key==='Escape')hideDeckExport();if(!deckExportMenu.hidden&&['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();const list=[...deckExportMenu.querySelectorAll('button')],i=list.indexOf(document.activeElement);list[(i+(event.key==='ArrowDown'?1:list.length-1))%list.length].focus();}});

const actions={tile:tileMenu,table:tableMenu,transitions:transitionPicker,'export-presentation':openDeckExport,'import-presentation':()=>presentationUpload.click(),create,close,library:back,more:()=>loadLibrary(true),save,text:()=>addObject('text'),shape:shapeMenu,image:()=>{$('.pres-upload',root).click();menu.hidden=true},stickers:()=>{menu.hidden=true;document.getElementById('sticker-shelf-toggle')?.click()},drawer:()=>{root.classList.toggle('is-sidebar-hidden');$('[data-action="drawer"]',root).setAttribute('aria-expanded',String(!root.classList.contains('is-sidebar-hidden')))},themes:themeDialog,'close-themes':()=>$('.pres-theme-dialog',root).hidden=true,'add-slide':addSlideMenu,bold:()=>alter(e=>e.bold=!e.bold),'delete-object':deleteObjects,'duplicate-object':duplicateObjects,forward:()=>layer(1),backward:()=>layer(-1),undo:()=>history(false),redo:()=>history(true),present:()=>{if(!checkAccess(deck))return;transitionDialog.hidden=true;$('.pres-theme-dialog',root).hidden=true;finishText();if(document.fullscreenElement!==root&&root.requestFullscreen)void root.requestFullscreen().catch(()=>{});play=true;root.classList.add('is-presenting');$('.pres-play-controls',root).hidden=false;menu.hidden=true;select();renderCanvas();fit()},'stop-present':stopPlay,next:()=>navigate(1),previous:()=>navigate(-1),'cancel-delete':()=>$('.pres-confirm',root).hidden=true,'confirm-delete':async()=>{libraryChanges++;const key=deleteId;busy(true);try{await api({action:'delete',id:key});await local(owner+'/'+key,null);items=items.filter(x=>x.id!==key);libraryChanged();$('.pres-confirm',root).hidden=true;renderLibrary();}finally{busy(false)}}};
function layer(direction){if(!current())return;finishText();checkpoint();const objects=slide().elements;if(direction>0){for(let i=objects.length-2;i>=0;i--)if(selection.has(objects[i].id)&&!selection.has(objects[i+1].id))[objects[i],objects[i+1]]=[objects[i+1],objects[i]];}else{for(let i=1;i<objects.length;i++)if(selection.has(objects[i].id)&&!selection.has(objects[i-1].id))[objects[i],objects[i-1]]=[objects[i-1],objects[i]];}changed();renderEditor();}
function history(forward){finishText();const from=forward?redo:undo,to=forward?undo:redo;if(!from.length)return;to.push(JSON.stringify(deck));deck=JSON.parse(from.pop());slideIndex=Math.min(slideIndex,deck.slides.length-1);select();changed();renderEditor();}
root.addEventListener('click',event=>{if(play&&!event.target.closest('button,input,select,.pres-play-controls,.pres-embedded-tile')){event.stopPropagation();navigate(1);return;}const action=event.target.closest('[data-action]')?.dataset.action;if(action&&actions[action])Promise.resolve().then(actions[action]).catch(error=>{if(status.textContent!=='Not synced')say(error.message,true)});});
root.addEventListener('pointerdown',event=>{if(!layoutDialog.hidden&&!layoutDialog.contains(event.target)&&!event.target.closest('[data-action=add-slide]'))layoutDialog.hidden=true;if(editing&&!event.target.closest('.pres-object-tools,.pres-rich,.pres-size-tools'))finishText();if(!menu.contains(event.target))menu.hidden=true;event.stopPropagation();});
root.addEventListener('contextmenu',event=>{event.preventDefault();event.stopPropagation();if(play&&!event.target.closest('button,input,select,.pres-play-controls,.pres-embedded-tile'))navigate(-1);});
area.addEventListener('pointerdown',workspacePointer);
area.addEventListener('auxclick',event=>{if(event.button===1)event.preventDefault()});
area.addEventListener('contextmenu',event=>{if(play)return;event.preventDefault();event.stopPropagation();finishText();const r=canvas.getBoundingClientRect();insertPoint={x:(event.clientX-r.left)*960/r.width,y:(event.clientY-r.top)*540/r.height};menu.style.left=event.clientX+'px';menu.style.top=event.clientY+'px';addMenu();});
// Native color pickers emit input while choosing and change when dismissed.
// Preview immediately, with one history entry for the whole picker interaction.
function liveColor(input,target,apply){
 let session='';
 const update=event=>{
  const value=input.value,where=target();
  if(where&&/^#[0-9a-f]{6}$/i.test(value)&&where.value!==value){
   finishText();if(session!==where.key){checkpoint();session=where.key;}
   apply(value);changed();renderEditor();
  }
  if(event.type==='change')session='';
 };
 input.addEventListener('pointerdown',()=>{session='';});input.addEventListener('blur',()=>{session='';});
 input.addEventListener('input',update);input.addEventListener('change',update);
}
$('.pres-theme-variant',root).onchange=event=>{if(!deck||deck.theme==='none')return;finishText();checkpoint();const value=event.target.value;if(window.TeacherTilesPresentationThemes.layoutIds.includes(value))slide().themeLayout=value;else delete slide().themeLayout;changed();renderEditor();};
const backgroundSelect=$('.pres-theme-variant',root),backgroundButton=button('Background','Slide background');
backgroundSelect.hidden=true;backgroundSelect.after(backgroundButton);
const backgroundMenu=document.createElement('div');backgroundMenu.className='pres-background-menu';backgroundMenu.setAttribute('popover','auto');backgroundMenu.setAttribute('aria-label','Slide backgrounds');root.append(backgroundMenu);
backgroundButton.onclick=()=>{
 if(backgroundMenu.matches(':popover-open')){backgroundMenu.hidePopover();return;}
 finishText();backgroundMenu.replaceChildren();const grid=document.createElement('div');grid.className='pres-layout-grid';
 for(const option of backgroundSelect.options){const b=button('',option.textContent+' background'),preview=document.createElement('div'),caption=document.createElement('span');preview.className='pres-slide';paintSlide(preview,{background:slide().background,elements:[],themeLayout:option.value||undefined},deck.theme);caption.textContent=option.textContent;b.append(preview,caption);b.setAttribute('aria-pressed',String(option.value===backgroundSelect.value));b.onclick=()=>{backgroundSelect.value=option.value;backgroundMenu.hidePopover();backgroundSelect.dispatchEvent(new Event('change'));};grid.append(b);}
 backgroundMenu.append(grid);backgroundMenu.showPopover();const r=backgroundButton.getBoundingClientRect();backgroundMenu.style.left=Math.max(8,Math.min(r.left,innerWidth-backgroundMenu.offsetWidth-8))+'px';backgroundMenu.style.top=Math.max(8,Math.min(r.bottom+8,innerHeight-backgroundMenu.offsetHeight-8))+'px';
};

liveColor($('.pres-background',root),()=>deck?.theme==='none'?{key:deckId+'/'+slide().id,value:slide().background}:null,value=>{slide().background=value;});
liveColor($('.pres-object-color',root),()=>current()?.type==='shape'?{key:deckId+'/'+slide().id+'/'+[...selection].join(','),value:chosen().filter(o=>o.type==='shape').every(o=>o.color===current().color)?current().color:''}:null,value=>{chosen().filter(o=>o.type==='shape').forEach(o=>o.color=value);});
$('.pres-upload',root).onchange=async e=>{const files=[...e.target.files];e.target.value='';for(const file of files)await upload(file)};
$('.pres-font-size',root).onchange=e=>formatText('fontSize',Math.max(6,Math.min(300,Number(e.target.value)||36)));
$('.pres-object-color',root).onchange=e=>{if(current()?.type==='text')formatText('foreColor',e.target.value);};
$('.pres-align',root).onchange=e=>formatText(({left:'justifyLeft',center:'justifyCenter',right:'justifyRight',justify:'justifyFull'})[e.target.value]);
$('.pres-shape-select',root).onchange=e=>alter(o=>o.shape=e.target.value);
title.onchange=()=>{checkpoint();deck.title=title.value.trim()||'Untitled Presentation';changed()};
root.addEventListener('keydown',keyboard);
// Rich text is stored as an allowlisted tree, never executable HTML.
const richTags=new Set(['p','div','br','h1','h2','h3','blockquote','b','strong','i','em','u','s','strike','span','ul','ol','li','font']);
function renderRich(el,e){
 const content=document.createElement('div');content.className='pres-rich';renderRichContent(content,e);el.replaceChildren(content);
}
function renderRichContent(content,e){
 content.replaceChildren();
 const build=node=>{if(typeof node.text==='string')return document.createTextNode(node.text);const n=document.createElement(richTags.has(node.tag)?node.tag:'span');for(const [key,value] of Object.entries(node.style||{})){if(key==='fontSize')n.style.fontSize=value/9.6+'cqw';else if(key==='fontFamily'){loadFont(value);n.style.fontFamily=fontStack(value);}else if(['color','backgroundColor','fontWeight','fontStyle','textDecorationLine','textAlign','marginLeft','lineHeight'].includes(key))n.style[key]=key==='marginLeft'?value+'em':value;}for(const child of node.children||[])n.append(build(child));return n;};
 if(e.rich?.length)e.rich.forEach(n=>content.append(build(n)));else content.textContent=e.text;
}
function readRich(content){
 let count=0,total=0;
 const visit=(n,depth=0)=>{
  if(++count>2000||depth>16)return null;
  if(n.nodeType===3){const text=n.textContent.slice(0,Math.max(0,10000-total));total+=text.length;return {text};}
  if(n.nodeType!==1||['SCRIPT','STYLE','IFRAME'].includes(n.tagName))return null;
  const tag=richTags.has(n.localName)?n.localName:'span',style={};
  for(const key of ['color','backgroundColor','fontFamily','fontWeight','fontStyle','textDecorationLine','textAlign','lineHeight'])if(n.style[key])style[key]=n.style[key];
  if(n.tagName==='FONT'){if(n.color)style.color=n.color;if(n.face)style.fontFamily=n.face;}
  if(n.style.lineHeight){style.lineHeight=parseFloat(n.style.lineHeight)/(n.style.lineHeight.endsWith('px')?parseFloat(getComputedStyle(n).fontSize):1);}
  if(n.style.fontSize){const raw=n.style.fontSize;style.fontSize=Math.max(6,Math.min(300,parseFloat(raw)*(raw.endsWith('cqw')?9.6:960/canvas.clientWidth)));}
  if(n.style.marginLeft)style.marginLeft=Math.min(8,parseFloat(n.style.marginLeft)/(n.style.marginLeft.endsWith('px')?40:1)||0);
  return {tag,style,children:[...n.childNodes].map(c=>visit(c,depth+1)).filter(Boolean)};
 };
 return [...content.childNodes].map(n=>visit(n)).filter(Boolean);
}
function syncText(){if(!editing)return;const rich=readRich(editing.node),text=editing.node.innerText.slice(0,10000);if(JSON.stringify(rich)!==JSON.stringify(editing.e.rich)||editing.e.text!==text||editing.lastFontSize!==editing.e.fontSize){editing.e.rich=rich;editing.e.text=text;editing.lastFontSize=editing.e.fontSize;if(!editing.restoring){const snapshot=JSON.stringify({rich,text,fontSize:editing.e.fontSize});if(editing.history.at(-1)!==snapshot){editing.history.push(snapshot);if(editing.history.length>60)editing.history.shift();editing.redo=[];}}changed();}}
// Measure a natural-height copy in the same slide container so cqw fonts and wrapping match.
function fitTextLineBoxes(node,e){
 const scale=canvas.clientWidth/960;
 for(const block of [node,...node.querySelectorAll('p,div,h1,h2,h3,blockquote,li')].reverse()){
  const walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT);let text,max=0;
  while(text=walker.nextNode()){if(!text.textContent.trim())continue;const owner=text.parentElement.closest('p,div,h1,h2,h3,blockquote,li');if(owner!==block)continue;max=Math.max(max,parseFloat(getComputedStyle(text.parentElement).fontSize));}
  if(max&&max<parseFloat(getComputedStyle(block).fontSize)-.1){const size=max/scale;block.style.fontSize=size/9.6+'cqw';if(block===node){e.fontSize=size;node.parentElement.style.fontSize=size/9.6+'cqw';}}
 }
}
function fitEditingText(){
 if(!editing)return;const {node,e}=editing;fitTextLineBoxes(node,e);syncText();const host=node.parentElement,probe=node.cloneNode(true);probe.removeAttribute('contenteditable');probe.removeAttribute('role');probe.removeAttribute('aria-label');probe.setAttribute('aria-hidden','true');
 Object.assign(probe.style,{position:'absolute',top:'0',left:'0',height:'auto',minHeight:'0',maxHeight:'none',overflow:'visible',visibility:'hidden',pointerEvents:'none'});host.append(probe);
 let height=Math.ceil(probe.scrollHeight*960/canvas.clientWidth)+3;
 while(height>540&&e.w<960){e.w=Math.min(960,e.w*1.2);e.x=Math.min(e.x,960-e.w);host.style.width=e.w/9.6+'%';host.style.left=e.x/9.6+'%';height=Math.ceil(probe.scrollHeight*960/canvas.clientWidth)+3;}
 probe.remove();height=Math.max(8,height);$('.pres-width',root).value=Math.round(e.w);
 if(Math.abs(e.h-height)<1)return;e.h=height;e.y=Math.max(0,Math.min(e.y,540-height));host.style.height=e.h/5.4+'%';host.style.top=e.y/5.4+'%';$('.pres-height',root).value=Math.round(e.h);changed();
}
function finishText(){if(!editing)return;syncText();editing.node.contentEditable='false';editing.node.classList.remove('is-editing');editing=null;textRange=null;}
function rememberText(){if(!editing||!(document.activeElement===editing.node||editing.node.contains(document.activeElement)))return;const s=getSelection();if(s.rangeCount&&editing.node.contains(s.anchorNode)&&editing.node.contains(s.focusNode))textRange=s.getRangeAt(0).cloneRange();}
function editText(e,el){
 if(play||editing?.e.id===e.id)return;finishText();select([e.id]);checkpoint();
 const node=el.querySelector('.pres-rich');node.contentEditable='true';node.spellcheck=e.spellcheck!==false;node.setAttribute('role','textbox');node.setAttribute('aria-label','Edit slide text');node.classList.add('is-editing');editing={e,node,lastFontSize:e.fontSize,history:[JSON.stringify({rich:readRich(node),text:node.innerText,fontSize:e.fontSize})],redo:[],restoring:false};
 node.focus();const r=document.createRange();r.selectNodeContents(node);const s=getSelection();s.removeAllRanges();s.addRange(r);rememberText();updateTools();fitEditingText();
 node.oninput=()=>{fitEditingText();rememberText();};node.onkeyup=node.onmouseup=()=>{rememberText();updateRichTools(e);};
 node.onpaste=event=>{event.preventDefault();const plain=event.clipboardData.getData('text/plain').slice(0,10000);document.execCommand('insertText',false,plain);syncText();};
 node.onblur=()=>setTimeout(()=>{if(editing?.node===node&&!toolbar.contains(document.activeElement)&&document.activeElement!==node){finishText();renderSlides();}},150);
}
function updateRichTools(e){
 formatting.sync(toolbar);
 if(e?.type!=='text')return;
 for(const b of toolbar.querySelectorAll('[data-format]')){if(['bold','italic','underline','strikeThrough','insertUnorderedList','insertOrderedList','justifyLeft','justifyCenter','justifyRight','justifyFull'].includes(b.dataset.format))b.setAttribute('aria-pressed',String(editing?document.queryCommandState(b.dataset.format):b.dataset.format==='bold'?!!e.bold:({left:'justifyLeft',center:'justifyCenter',right:'justifyRight',justify:'justifyFull'})[e.align||'left']===b.dataset.format));}
 toolbar.querySelector('[data-format=spell]').setAttribute('aria-pressed',String(e.spellcheck!==false));
 if(editing){const sel=getSelection();let element=sel.anchorNode?.nodeType===1?sel.anchorNode:sel.anchorNode?.parentElement;if(element===editing.node){while(element.firstElementChild)element=element.firstElementChild;}if(element&&editing.node.contains(element)){const cs=getComputedStyle(element),family=[...(deck?.fonts||[]).map(f=>f.family),...fonts].find(f=>cs.fontFamily.includes(f));if(family)$('.pres-font',root).value=family;$('.pres-font-size',root).value=Math.round(parseFloat(cs.fontSize)*960/canvas.clientWidth);$('.pres-block',root).value=element.closest('h1,h2,h3,blockquote,p')?.localName||'p';formatting.sync(toolbar);$('.pres-object-color',root).parentElement.style.setProperty('--format-color',cs.color);}}
}

const exportMenu=document.createElement('div');exportMenu.className='pres-menu pres-export-menu';exportMenu.hidden=true;exportMenu.setAttribute('role','menu');exportMenu.setAttribute('aria-label','Export text');root.append(exportMenu);
function openTextExport(){
 const e=current();if(!e||e.type!=='text')return;finishText();exportMenu.replaceChildren();
 for(const [format,label] of [['pdf','PDF / Print'],['doc','Word'],['html','HTML'],['txt','Plain Text']]){const b=button(label);b.setAttribute('role','menuitem');b.onclick=()=>{exportMenu.hidden=true;exportText(e,format);};exportMenu.append(b);}
 const anchor=toolbar.querySelector('[data-format=export]').getBoundingClientRect();exportMenu.hidden=false;exportMenu.style.left=Math.max(8,Math.min(innerWidth-244,anchor.left))+'px';exportMenu.style.top=Math.min(innerHeight-exportMenu.offsetHeight-12,anchor.bottom+8)+'px';
}
function exportText(e,format){
 const node=document.createElement('div');renderRich(node,e);node.querySelectorAll('[style]').forEach(n=>{if(n.style.fontSize.endsWith('cqw'))n.style.fontSize=parseFloat(n.style.fontSize)*9.6+'px';});
 const html='<!doctype html><html><head><meta charset="utf-8"><title>Slide text</title><style>body{padding:24px;font:'+e.fontSize+'px Inter,Arial,sans-serif;color:#202b3d;line-height:1.2}.pres-rich{white-space:pre-wrap}p,div{margin:0}h1,h2,h3{margin:0 0 .25em}blockquote{border-left:3px solid;padding-left:16px}@media print{body{padding:0}}</style></head><body>'+node.innerHTML+'</body></html>';
 if(format==='pdf'){const popup=window.open('','_blank','width=900,height=760');if(!popup){say('Allow pop-ups to print or save this text as PDF.',true);return;}popup.opener=null;popup.document.open();popup.document.write(html);popup.document.close();popup.addEventListener('afterprint',()=>popup.close(),{once:true});setTimeout(()=>{popup.focus();popup.print();},300);return;}
 const mime={doc:'application/msword',html:'text/html',txt:'text/plain'}[format],url=URL.createObjectURL(new Blob([format==='txt'?e.text:html],{type:mime+';charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='slide-text.'+format;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
root.addEventListener('pointerdown',event=>{if(!exportMenu.contains(event.target)&&!event.target.closest('[data-format=export]'))exportMenu.hidden=true;});

function formatText(command,value){
 const e=current();if(!e||e.type!=='text')return;
 if(command==='export'){openTextExport();return;}
 if(!editing)editText(e,canvas.querySelector('[data-object="'+e.id+'"]'));
 if(!editing)return;editing.node.focus({preventScroll:true});if(textRange){const s=getSelection();s.removeAllRanges();s.addRange(textRange);}
 if(command==='spell'){e.spellcheck=e.spellcheck===false;editing.node.spellcheck=e.spellcheck;changed();updateRichTools(e);return;}
 if(command==='undo'||command==='redo'){const state=editing;if(command==='undo'&&state.history.length>1)state.redo.push(state.history.pop());else if(command==='redo'&&state.redo.length)state.history.push(state.redo.pop());else return;const data=JSON.parse(state.history.at(-1)),host=document.createElement('div');e.fontSize=data.fontSize||e.fontSize;state.node.style.fontSize='';state.node.parentElement.style.fontSize=e.fontSize/9.6+'cqw';renderRich(host,{...e,...data});state.node.replaceChildren(...host.firstChild.childNodes);state.restoring=true;syncText();fitEditingText();state.restoring=false;const r=document.createRange();r.selectNodeContents(state.node);r.collapse(false);const selection=getSelection();selection.removeAllRanges();selection.addRange(r);rememberText();updateRichTools(e);renderSlides();return;}
 document.execCommand('styleWithCSS',false,true);
 if(command==='fontSize'){document.execCommand('styleWithCSS',false,false);document.execCommand('fontSize',false,'7');editing.node.querySelectorAll('font[size="7"]').forEach(n=>{n.removeAttribute('size');n.style.fontSize=value/9.6+'cqw';});document.execCommand('styleWithCSS',false,true);}
 else if(command==='strikeThrough'){document.execCommand('styleWithCSS',false,false);document.execCommand('strikeThrough',false,null);document.execCommand('styleWithCSS',false,true);}
 else if(command==='clearHighlight')document.execCommand('hiliteColor',false,'transparent');
 else document.execCommand(command,false,value??null);
 if(['fontSize','fontName','formatBlock','bold','italic','insertUnorderedList','insertOrderedList','indent','outdent','removeFormat'].includes(command))fitEditingText();else syncText();rememberText();updateRichTools(e);renderSlides();
}
toolbar.addEventListener('pointerdown',event=>{rememberText();if(event.target.closest('button'))event.preventDefault();});
toolbar.addEventListener('click',event=>{const command=event.target.closest('[data-format]')?.dataset.format;if(command)formatText(command);});


const embeddedFontLoads=new Map();
async function loadDeckFonts(document,read=asset){for(const info of document.fonts||[]){if(!embeddedFontLoads.has(info.family))embeddedFontLoads.set(info.family,(async()=>{try{const data=await read(info.asset),face=new FontFace(info.family,'url('+data+')');await face.load();window.document.fonts.add(face);}catch(error){embeddedFontLoads.delete(info.family);throw Error('Could not load the embedded font '+info.name+'. '+error.message);}})());await embeddedFontLoads.get(info.family);}}

const recentFontKey='tt-presentation-recent-fonts',fontLoads=new Map();
function fontStack(name){const serif=['Georgia','Cambria','Times New Roman','Lora','Merriweather','Playfair Display','Libre Baskerville','PT Serif','Roboto Slab','Bitter','Crimson Text','EB Garamond','Abril Fatface'].includes(name),mono=['Courier New','Roboto Mono','Source Code Pro'].includes(name);return '"'+name.replace(/["\\]/g,'')+'", '+(mono?'monospace':serif?'serif':'sans-serif');}
function loadFont(name){if(!fonts.includes(name)||fontLoads.has(name))return fontLoads.get(name)||Promise.resolve();if(['Arial','Arial Black','Calibri','Cambria','Comic Sans MS','Courier New','Georgia','Times New Roman','Trebuchet MS','Verdana'].includes(name))return Promise.resolve();const promise=new Promise(resolve=>{const link=document.createElement('link');link.rel='stylesheet';link.href='https://fonts.googleapis.com/css2?family='+encodeURIComponent(name)+(['Pacifico','Indie Flower','Patrick Hand','Shadows Into Light','Permanent Marker','Lobster','Bebas Neue','Abril Fatface'].includes(name)?'':':wght@400;700')+'&display=swap';setTimeout(resolve,8000);link.onload=()=>document.fonts.load('16px "'+name+'"').then(resolve,resolve);link.onerror=()=>resolve();document.head.append(link);});fontLoads.set(name,promise);return promise;}
function recentFonts(){try{return JSON.parse(localStorage.getItem(recentFontKey)||'[]').filter(f=>fonts.includes(f)).slice(0,6);}catch{return [];}}
function renderFonts(value){const select=$('.pres-font',root);select.replaceChildren();for(const [label,entries] of [['Recently used',recentFonts()],['Imported fonts',(deck?.fonts||[]).map(f=>f.family)],['All fonts',fonts]]){if(!entries.length)continue;const group=document.createElement('optgroup');group.label=label;for(const f of entries){const option=document.createElement('option');option.textContent=deck?.fonts?.find(font=>font.family===f)?.name||f;option.value=f;option.style.fontFamily=fontStack(f);group.append(option);}select.append(group);}select.value=value||'Inter';}
renderFonts();
formatting.selectMenu($('.pres-font',root),{kind:'font',beforeOpen:rememberText,preview:loadFont});
formatting.selectMenu($('.pres-block',root),{kind:'block',beforeOpen:rememberText});
$('.pres-font',root).onchange=event=>{const family=event.target.value;loadFont(family);try{localStorage.setItem(recentFontKey,JSON.stringify([family,...recentFonts().filter(f=>f!==family)].slice(0,6)));}catch{}formatText('fontName',family);renderFonts(family);formatting.sync(toolbar);loadFont(family).then(()=>{if(editing){fitEditingText();renderSlides();}});};
let aspectLocked=false,shiftAspectHeld=false;
function syncAspectControl(){const locked=aspectLocked||shiftAspectHeld,b=$('.pres-aspect',root);b.setAttribute('aria-pressed',String(locked));b.setAttribute('aria-label',locked?'Unlock aspect ratio':'Lock aspect ratio');b.title=locked?'Keep width and height proportional':'Resize freely · Hold Shift to keep proportions';b.innerHTML=svg('<rect x="6" y="10" width="12" height="11" rx="2"/>'+(locked?'<path d="M8 10V7a4 4 0 0 1 8 0v3"/>':'<path d="M8 10V7a4 4 0 0 1 7-2"/>'));}
$('.pres-aspect',root).onclick=()=>{aspectLocked=!aspectLocked;syncAspectControl();};
window.addEventListener('keydown',event=>{if(event.key==='Shift'&&!root.hidden&&!shiftAspectHeld){shiftAspectHeld=true;syncAspectControl();}},true);
window.addEventListener('keyup',event=>{if(event.key==='Shift'){shiftAspectHeld=false;syncAspectControl();}},true);
window.addEventListener('blur',()=>{shiftAspectHeld=false;syncAspectControl();});
syncAspectControl();
for(const [selector,key] of [['.pres-width','w'],['.pres-height','h'],['.pres-angle','rotation']])$(selector,root).onchange=event=>{const value=Number(event.target.value);if(!Number.isFinite(value)||!current()||Math.abs((current()[key]||0)-value)<.01)return;alter(e=>{if(key==='rotation'){e.rotation=((value%360)+360)%360;return;}const old=e[key],v=Math.max(20,Math.min(key==='w'?960:540,value)),factor=v/old;if(aspectLocked||shiftAspectHeld){const k=Math.min(factor,960/e.w,540/e.h);e.w*=k;e.h*=k;if(e.type==='text'){e.fontSize=Math.max(6,Math.min(300,e.fontSize*k));if(e.rich)scaleRich(e.rich,k);}}else e[key]=v;e.x=Math.min(e.x,960-e.w);e.y=Math.min(e.y,540-e.h);});};

$('.pres-block',root).onchange=e=>formatText('formatBlock',e.target.value);
$('.pres-highlight',root).onchange=e=>formatText('hiliteColor',e.target.value);

const colorPopup=document.createElement('div');colorPopup.className='richtext-color-picker pres-color-popup';colorPopup.setAttribute('popover','auto');colorPopup.setAttribute('role','dialog');colorPopup.dataset.preserveTextEdit='true';toolbar.append(colorPopup);
let colorTrigger=null;
const closeColorPopup=()=>{if(colorPopup.matches(':popover-open'))colorPopup.hidePopover();colorTrigger?.setAttribute('aria-expanded','false');};
for(const [selector,mode] of [['.pres-object-color','text'],['.pres-highlight','highlight']]){
 const input=$(selector,root),label=input.parentElement;
 const trigger=document.createElement('button');trigger.type='button';trigger.className=label.className;trigger.innerHTML=formatting.icon(mode==='text'?'color':'highlight')+formatting.icon('chevron');trigger.title=mode==='text'?'Text or shape color':'Highlight';trigger.setAttribute('aria-label',trigger.title);trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-expanded','false');
 input.hidden=true;input.style.display='none';trigger.append(input);label.replaceWith(trigger);
 trigger.onpointerdown=e=>{rememberText();e.preventDefault();};
 trigger.onclick=()=>{
  if(colorTrigger===trigger&&colorPopup.matches(':popover-open')){closeColorPopup();return;}closeColorPopup();rememberText();colorTrigger=trigger;
  formatting.buildColorPickerContent(colorPopup,mode,{textColor:$('.pres-object-color',root).value,highlightColor:$('.pres-highlight',root).value,closeColorPicker:closeColorPopup,applyPickerColor:value=>{
   if(mode==='text'&&current()?.type==='shape'){alter(e=>{if(e.type==='shape')e.color=value;});}else formatText(mode==='text'?'foreColor':'hiliteColor',value);
   if(value!=='transparent')input.value=value;trigger.style.setProperty('--format-color',value);closeColorPopup();
  }});
  colorPopup.querySelector('header small').textContent=current()?.type==='shape'?'SHAPE':'TEXT';
  colorPopup.setAttribute('aria-label',mode==='text'?'Color':'Highlight');colorPopup.showPopover();trigger.setAttribute('aria-expanded','true');
  const r=trigger.getBoundingClientRect();colorPopup.style.left=Math.max(8,Math.min(r.left,innerWidth-colorPopup.offsetWidth-8))+'px';colorPopup.style.top=Math.max(8,Math.min(r.bottom+7,innerHeight-colorPopup.offsetHeight-8))+'px';
 };
}
colorPopup.addEventListener('toggle',()=>{if(!colorPopup.matches(':popover-open'))colorTrigger?.setAttribute('aria-expanded','false');});

// Capture from editor input/key/pointer events and toolbar pointerdown. Moving focus
// into a formatting menu must not replace the saved text range with a collapsed caret.
function layouts(theme){
 const {accent='#829cc0',soft='#e7eef7'}=window.TeacherTilesPresentationThemes.get(theme);
 const t=(text,x,y,w,h,size=32,bold=false)=>({id:id(),type:'text',text,x,y,w,h,fontSize:size,bold,color:'auto',align:'left'});
 const box=(x,y,w,h,color=soft,shape='rectangle')=>({id:id(),type:'shape',x,y,w,h,color,shape});
 const head=label=>t(label,65,45,790,70,44,true);
 return [
  ['Title',[box(65,130,7,250,accent),t('Presentation title',100,150,750,140,62,true),t('Subtitle or class name',104,315,700,70,28)]],
  ['Title & Content',[head('Slide title'),box(65,129,120,5,accent),t('Add your main idea here.\n\nSupporting details go here.',65,170,800,290,30)]],
  ['Two Columns',[head('Compare ideas'),box(65,150,395,320),box(485,150,395,320),t('First idea',90,175,345,55,32,true),t('Add details',90,250,345,180,25),t('Second idea',510,175,345,55,32,true),t('Add details',510,250,345,180,25)]],
  ['Section Divider',[box(65,155,90,90,accent,'ellipse'),t('01',79,174,65,50,34,true),t('A new section',195,155,650,100,56,true),t('Introduce your next topic',200,280,620,80,28)]],
  ['Image & Caption',[head('Explore the picture'),box(65,145,535,315),t('Drop an image here',145,270,380,60,28),t('What do you notice?',640,160,240,110,32,true),t('Add a caption or explanation.',640,300,240,140,25)]],
  ['Big Quote',[box(65,115,10,310,accent),t('“',100,115,120,100,100,true),t('A thought worth sharing.',205,165,635,165,48),t('— Attribution',215,370,620,55,25)]],
  ['Three Steps',[head('Three steps'),...[0,1,2].flatMap(i=>[box(75+i*290,170,240,280),box(150+i*290,195,65,65,accent,'ellipse'),t(String(i+1),171+i*290,207,45,45,30,true),t('Step '+(i+1),95+i*290,290,205,60,30,true),t('Add your instructions',95+i*290,365,205,70,23)])]],
  ['Discussion',[head('Let’s discuss'),box(85,165,790,250),t('What do you think?',125,210,700,85,46,true),t('Add a question to start the conversation.',125,325,700,65,26)]]
 ];
}
function addSlide(elements=[],themeLayout){if(deck.slides.length>=500){say('This presentation has 500 slides.',true);return;}finishText();checkpoint();deck.slides.splice(slideIndex+1,0,{id:id(),background:'#ffffff',elements,...(themeLayout?{themeLayout}:{})});slideIndex++;select();changed();layoutDialog.hidden=true;renderEditor();}
function addSlideMenu(){if(deck.theme==='none'){addSlide();return;}layoutDialog.replaceChildren();const head=document.createElement('header'),label=document.createElement('strong'),exit=button('×','Close slide layouts');label.textContent='Choose a slide layout';exit.onclick=()=>layoutDialog.hidden=true;head.append(label,exit);layoutDialog.append(head);const grid=document.createElement('div');grid.className='pres-layout-grid';for(const [name,elements,themeLayout] of [['Blank Slide',[]],...layouts(deck.theme).map(([name,elements],i)=>[name,elements,window.TeacherTilesPresentationThemes.layoutIds[i]])]){const b=button(''),preview=document.createElement('div'),caption=document.createElement('span');b.setAttribute('aria-label','Add '+name);preview.className='pres-slide';paintSlide(preview,{background:'#fff',elements,themeLayout},deck.theme);caption.textContent=name;b.append(preview,caption);b.onclick=()=>addSlide(copy(elements),themeLayout);grid.append(b);}layoutDialog.append(grid);layoutDialog.hidden=false;}
function keyboard(event){
 if(fileOperation){event.preventDefault();return;}
 if(root.hidden)return;const key=event.key.toLowerCase(),mod=event.ctrlKey||event.metaKey,inField=event.target.closest('input,textarea,select,[contenteditable="true"]');
 event.stopPropagation();
 if(mod&&key==='s'){event.preventDefault();save().catch(()=>{});return;}
 if(editing&&event.target.closest('[contenteditable="true"]')){if(event.key==='Escape'){event.preventDefault();finishText();renderCanvas();canvas.focus();}else if(mod&&['b','i','u'].includes(key)){event.preventDefault();formatText({b:'bold',i:'italic',u:'underline'}[key]);}else if(mod&&['z','y'].includes(key)){event.preventDefault();formatText(key==='y'||event.shiftKey?'redo':'undo');}return;}
 if(event.key==='Tab'&&!event.target.closest('.pres-canvas')){const scope=!transitionDialog.hidden?transitionDialog:!layoutDialog.hidden?layoutDialog:!$('.pres-theme-dialog',root).hidden?$('.pres-theme-dialog',root):root,controls=[...scope.querySelectorAll('button,input,select,textarea,[tabindex="0"]')].filter(n=>!n.disabled&&n.getClientRects().length),first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}if(inField)return;if(!deck)return;
 if(play){if(['ArrowRight',' ','PageDown'].includes(event.key)){event.preventDefault();navigate(1);}if(['ArrowLeft','PageUp'].includes(event.key)){event.preventDefault();navigate(-1);}if(event.key==='Home')navigate(-deck.slides.length);if(event.key==='End')navigate(deck.slides.length);if(event.key==='Escape')stopPlay();return;}
 if(event.key==='Escape'){transitionDialog.hidden=true;exportMenu.hidden=true;menu.hidden=true;layoutDialog.hidden=true;$('.pres-theme-dialog',root).hidden=true;finishText();select();updateTools();return;}
 if(event.key==='F5'){event.preventDefault();actions.present();return;}
 if(mod){
  if(key==='z'||key==='y'){event.preventDefault();history(key==='y'||event.shiftKey);return;}
  if(key==='a'){event.preventDefault();select(slide().elements.map(e=>e.id));updateTools();return;}
  if(key==='d'){event.preventDefault();if(event.target.closest('.pres-sidebar'))duplicateSlide(slideIndex);else duplicateObjects();return;}
  if(['b','i','u'].includes(key)){event.preventDefault();formatText({b:'bold',i:'italic',u:'underline'}[key]);return;}
  if(key==='m'){event.preventDefault();addSlideMenu();return;}
  if(['=','+','-','0'].includes(key)){event.preventDefault();if(key==='0'){zoom=1;pan={x:0,y:0};}else zoom=Math.max(.25,Math.min(3,zoom+(key==='-'?-.1:.1)));applyView();return;}
  if(key==='['||key===']'){event.preventDefault();layer(key===']'?1:-1);return;}
 }
 if(['Delete','Backspace'].includes(event.key)){event.preventDefault();if(event.target.closest('.pres-sidebar'))deleteSlide(slideIndex);else deleteObjects();return;}
 if(event.key==='Enter'&&current()?.type==='text'){event.preventDefault();editText(current(),canvas.querySelector('[data-object="'+selected+'"]'));return;}
 if(['PageDown','PageUp'].includes(event.key)){event.preventDefault();finishText();select();navigate(event.key==='PageDown'?1:-1);renderSlides();return;}
 if(event.key.startsWith('Arrow')&&selection.size){event.preventDefault();const step=event.shiftKey?10:1;alter(e=>{e.x=Math.max(0,Math.min(960-e.w,e.x+(event.key==='ArrowRight'?step:event.key==='ArrowLeft'?-step:0)));e.y=Math.max(0,Math.min(540-e.h,e.y+(event.key==='ArrowDown'?step:event.key==='ArrowUp'?-step:0)));});return;}
 if(!selection.size&&['ArrowRight','ArrowDown','ArrowLeft','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();navigate(event.key==='Home'?-deck.slides.length:event.key==='End'?deck.slides.length:['ArrowRight','ArrowDown'].includes(event.key)?1:-1);renderSlides();return;}
 if(event.key==='Tab'&&event.target.closest('.pres-canvas')){event.preventDefault();const all=slide().elements,i=all.findIndex(e=>e.id===selected);if(all.length){select([all[(i+(event.shiftKey?-1:1)+all.length)%all.length].id]);updateTools();}return;}
}
// Clipboard events retain native text editing while supporting repeated object paste.
root.addEventListener('copy',event=>{if(!deck||play||event.target.closest('input,textarea,[contenteditable="true"],[contenteditable="plaintext-only"]'))return;const elements=chosen();if(!elements.length)return;event.preventDefault();event.stopPropagation();objectClipboard={deckId,owner,elements:copy(elements)};clipboardPaste=0;event.clipboardData.setData('application/x-teachertiles-objects',JSON.stringify(objectClipboard));event.clipboardData.setData('text/plain',elements.filter(e=>e.type==='text').map(e=>e.text).join('\n'));});
root.addEventListener('cut',event=>{if(!deck||play||event.target.closest('input,textarea,[contenteditable="true"],[contenteditable="plaintext-only"]'))return;const elements=chosen();if(!elements.length)return;event.preventDefault();event.stopPropagation();objectClipboard={deckId,owner,elements:copy(elements)};clipboardPaste=0;event.clipboardData.setData('application/x-teachertiles-objects',JSON.stringify(objectClipboard));event.clipboardData.setData('text/plain',elements.filter(e=>e.type==='text').map(e=>e.text).join('\n'));deleteObjects();});
root.addEventListener('paste',async event=>{if(!deck||play||event.target.closest('input,textarea,[contenteditable="true"],[contenteditable="plaintext-only"]'))return;event.preventDefault();event.stopPropagation();const files=[...event.clipboardData.files];if(files.length){for(const file of files)await upload(file);return;}const data=event.clipboardData.getData('application/x-teachertiles-objects');if(data){try{const parsed=JSON.parse(data);if(parsed.owner!==owner||!Array.isArray(parsed.elements))return;let elements=copy(parsed.elements);if(parsed.deckId!==deckId){const mapped=new Map();for(const hash of objectContract.assets({slides:[{elements}]})){const image=(await api({action:'asset',id:parsed.deckId,asset:hash})).image;mapped.set(hash,(await api({action:'upload',id:deckId,image})).asset);}for(const e of elements){if(e.asset)e.asset=mapped.get(e.asset);for(const memo of e.tileState?.special?.memos||[])if(memo.asset)memo.asset=mapped.get(memo.asset);}}duplicateObjects(elements.map(e=>({...e,x:Math.min(960-e.w,e.x+clipboardPaste*20),y:Math.min(540-e.h,e.y+clipboardPaste*20)})));clipboardPaste++;}catch(error){say('Could not paste these objects: '+error.message,true);}return;}const text=event.clipboardData.getData('text/plain');if(text)addObject('text',{text:text.slice(0,10000)});});
area.addEventListener('wheel',event=>{if(!deck||play||fileOperation)return;event.preventDefault();const r=area.getBoundingClientRect(),x=event.clientX-r.left-r.width/2,y=event.clientY-r.top-r.height/2,old=zoom;zoom=Math.max(.25,Math.min(4,zoom*Math.exp(-event.deltaY*(event.deltaMode===1?.035:.0015))));pan.x=x-(x-pan.x)*zoom/old;pan.y=y-(y-pan.y)*zoom/old;applyView();},{passive:false});
area.addEventListener('dragover',event=>{if(!deck||play||slideDrag>=0)return;event.preventDefault();event.dataTransfer.dropEffect='copy';area.classList.add('is-image-drop');});
area.addEventListener('dragleave',event=>{if(!area.contains(event.relatedTarget))area.classList.remove('is-image-drop');});
area.addEventListener('drop',async event=>{
 if(!deck||play||slideDrag>=0)return;event.preventDefault();event.stopPropagation();area.classList.remove('is-image-drop');finishText();const r=canvas.getBoundingClientRect();insertPoint={x:(event.clientX-r.left)*960/r.width,y:(event.clientY-r.top)*540/r.height};
 const files=[...event.dataTransfer.files];if(files.length){for(const file of files)await upload(file);return;}
 const html=event.dataTransfer.getData('text/html'),doc=new DOMParser().parseFromString(html,'text/html'),url=doc.querySelector('img')?.getAttribute('src')||event.dataTransfer.getData('text/uri-list').split('\n').find(line=>line&&!line.startsWith('#'));
 if(!url||!(/^(https?:\/\/|data:image\/(png|jpeg|webp|gif);base64,)/i.test(url))){say('Drop an image file or a browser image here.',true);return;}
 try{say('Importing image…');const response=await fetch(url,{credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Image download failed');if(Number(response.headers.get('content-length'))>20000000)throw Error('Image exceeds 20 MB');const reader=response.body.getReader(),parts=[];let size=0;try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>20000000){await reader.cancel();throw Error('Image exceeds 20 MB');}parts.push(part.value);}}finally{reader.releaseLock();}const blob=new Blob(parts,{type:response.headers.get('content-type')?.split(';')[0]||'image/png'});await upload(new File([blob],'dropped-image',{type:blob.type}));}catch{say('This website blocks image importing. Save the image or GIF, then drop the file here.',true);}
});

window.addEventListener('beforeunload',event=>{if(dirty){writeDraft();event.preventDefault();event.returnValue=''}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&dirty)save().catch(()=>{})});
window.addEventListener('teachertiles:authchange',()=>{if(owner&&uid()!==owner){writeDraft();generation++;clearTimeout(saveTimer);clearTimeout(localTimer);root.hidden=true;document.body.classList.remove('presentations-open');deck=null;deckId='';owner='';dirty=false;items=[];assets.clear();libraryEpoch++;libraryRequest=null;libraryKnown=false;loadedAt=0;cursor=null;libraryRenderPending=false;}});
$('#profile-presentations-button')?.addEventListener('click',open);
// Read-only board players share the renderer and bounded asset cache, not editor state.
const viewerLoads=new Map();
async function viewerCall(user,data,endpoint='presentations'){if(!user||uid()!==user)throw Error('Sign in to load your presentations.');const response=await window.TeacherTilesAuth.call(endpoint,data);if(uid()!==user)throw Error('Your account changed. Choose a presentation again.');return response.data;}
async function viewerLibrary(nextCursor=null,refresh=false){
 const user=uid();if(!user)throw Error('Sign in to load your presentations.');
 if(!nextCursor&&!refresh){if(owner===user&&libraryKnown&&Date.now()-loadedAt<LIBRARY_TTL)return {items:libraryRows(items),cursor};
  try{const cached=await Promise.race([local(libraryCacheKey(user)),new Promise(resolve=>setTimeout(resolve,120))]);if(uid()!==user)throw Error('Your account changed.');if(cached?.version===1&&Date.now()-cached.loadedAt<LIBRARY_TTL)return {items:libraryRows(cached.items),cursor:cached.cursor||null};}catch{/* Cloud reads remain available without IndexedDB. */}}
 const result=await viewerCall(user,{action:'list',cursor:nextCursor});return {items:libraryRows(result.items),cursor:result.cursor||null};
}
async function viewerLoad(key,shared=null){
 const endpoint=shared?'boardTemplates':'presentations',source=shared?{id:shared.id,templateId:shared.templateId}:{id:key};
 const user=uid(),cacheKey=user+'/'+(shared?'shared/':'')+key;if(!user)throw Error('Sign in to load your presentations.');
 const read=async hash=>{if(uid()!==user)throw Error('Your account changed.');const k=cacheKey+'/'+hash;if(assets.has(k))return assets.get(k);if(pendingAssets.has(k))return pendingAssets.get(k);const request=viewerCall(user,{...source,action:shared?'presentation-asset':'asset',asset:hash},endpoint).then(result=>{cacheAsset(k,result.image);return result.image;});pendingAssets.set(k,request);try{return await request;}finally{pendingAssets.delete(k);}};
 if(!viewerLoads.has(cacheKey))viewerLoads.set(cacheKey,viewerCall(user,{...source,action:shared?'presentation-load':'load'},endpoint));
 let result;try{result=await viewerLoads.get(cacheKey);}finally{viewerLoads.delete(cacheKey);}
 if(!checkAccess(result.document))throw Error('Presentation locked. Buy the required cosmetics or renew your subscription.');await loadDeckFonts(result.document,read);if(uid()!==user)throw Error('Your account changed.');
 return {title:result.title,cover:result.cover||'',document:result.document,render(host,index){if(uid()!==user)throw Error('Your account changed.');if(!checkAccess(result.document,false))throw Error('Presentation locked. Buy the required cosmetics or renew your subscription.');paintSlide(host,result.document.slides[index],result.document.theme,false,read,true);}};
}
window.TeacherTilesPresentations=Object.freeze({open,flush:save,viewerLibrary,viewerLoad,checkAccess,showAccess,get active(){return !root.hidden&&!!deck&&!play},addSticker(data,clientX,clientY){if(!this.active)return null;const ratio=data.aspect||1,r=canvas.getBoundingClientRect();if(clientX>=r.left&&clientX<=r.right&&clientY>=r.top&&clientY<=r.bottom)insertPoint={x:(clientX-r.left)*960/r.width-90,y:(clientY-r.top)*540/r.height-90/ratio};const e=addObject('sticker',{src:data.src||'',emoji:data.emoji||'',w:180,h:Math.min(400,180/ratio)});if(e)window.dispatchEvent(new CustomEvent('teachertiles:stickerplaced',{detail:{key:data.src||data.emoji}}));return e?canvas.querySelector('[data-object="'+e.id+'"]'):null;}});
})();
