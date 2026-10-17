import {createProductPicker} from './product-picker.js?v=20261015-picker';
import {readShopCatalog} from '../shop/catalog-reader.js?v=20261016-presentation-themes';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
const group=id=>id.startsWith('presentation-theme-')?'Presentation Themes':id.startsWith('profile-frame')?'Profile Cosmetics':id.startsWith('planner-')?'Planner Skins':id.startsWith('theme-')?'Themes':id.startsWith('sticker-')?'Stickers':id.startsWith('cursor-')?'Cursors':'Tile Skins';
export function createProductManagementPanel(call){
 const element=el('section','product-management');element.hidden=true;
 element.innerHTML='<header class="tm-heading"><div><p class="eyebrow">LIVE APP</p><h1>Product Management</h1></div><button type="button" class="quiet" data-refresh>Refresh</button></header><div class="pm-tabs"><button class="quiet" data-tab="products">Cosmetics</button><button class="quiet" data-tab="bundles">Bundles</button><button class="quiet" data-tab="sales">Sales</button><button class="quiet" data-tab="banners">Shop Banners</button></div><div class="pm-toolbar"><input type="search" placeholder="Search Products" aria-label="Search Products"><select aria-label="Product Category"><option value="">All Categories</option></select><button class="primary" data-add hidden></button></div><p class="pm-status" role="status"></p><div class="pm-grid"></div><dialog class="pm-editor"><header><h2></h2><button type="button" class="quiet" data-close aria-label="Close Editor">×</button></header><form><div class="pm-fields"></div><p class="pm-editor-status" role="status"></p><footer><button class="primary" type="submit">Save Changes</button></footer></form></dialog>';
 const grid=element.querySelector('.pm-grid'),status=element.querySelector('.pm-status'),search=element.querySelector('input'),category=element.querySelector('select'),add=element.querySelector('[data-add]'),dialog=element.querySelector('dialog'),form=dialog.querySelector('form'),fields=dialog.querySelector('.pm-fields'),message=dialog.querySelector('.pm-editor-status');
 for(const name of ['Themes','Tile Skins','Stickers','Cursors','Planner Skins','Presentation Themes','Profile Cosmetics']){const o=el('option','',name);o.value=name;category.append(o)}
 let config,catalog=[],defaults=new Map(),defaultBanners=[],tab='products',loaded=false,busy=false,epoch=0,saveAction=null;
 const request=async data=>{const r=await call('developerProductManagement',data);return r?.data??r};
 const effective=p=>({...p,...config.products[p.id],tags:defaults.get(p.id)?.tags||'',description:config.products[p.id]?.description??defaults.get(p.id)?.description??p.description??''});
 const live=p=>p.sale&&p.sale.endsAt>Date.now()&&p.sale.startsAt<=Date.now();
 function render(){
  grid.replaceChildren();add.hidden=tab==='products';add.textContent=tab==='bundles'?'Create Bundle':tab==='sales'?'Create Sale':'Upload Banner';category.hidden=tab!=='products';search.placeholder=tab==='banners'?'Search Banners':tab==='sales'?'Search Sales':'Search Products';
  element.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===tab)));if(!config)return;
  let rows=tab==='products'?catalog.map(effective):tab==='bundles'?Object.entries(config.bundles).map(([id,p])=>({id,...p})):tab==='sales'?Object.entries(config.sales||{}).map(([id,s])=>({id,...s})):defaultBanners.filter(b=>!(config.banners.removed||[]).includes(b.id)).map(b=>({...b,disabled:config.banners.hidden.includes(b.id)})).concat(config.banners.custom.map(b=>({...b,disabled:b.active===false})));
  rows=rows.filter(p=>(tab!=='products'||!category.value||group(p.id)===category.value)&&`${p.name||p.title} ${p.id} ${p.description||''}`.toLowerCase().includes(search.value.trim().toLowerCase()));
  status.textContent=`${rows.length} ${tab==='banners'?'Banners':tab==='bundles'?'Bundles':tab==='sales'?'Sales':'Cosmetics'}`;
  for(const p of rows){const card=el(['banners','sales','bundles'].includes(tab)?'article':'button','pm-card');if(!['banners','sales','bundles'].includes(tab))card.type='button';card.dataset.productId=p.id;
   if(tab==='banners'){const preview=el('div','pm-banner-preview');if(p.art)preview.append(p.art.cloneNode(true));else{const img=el('img');img.src=p.url;img.alt=p.title;preview.append(img)}card.append(preview);card.append(el('strong','',p.title));const controls=el('div','pm-banner-controls'),label=el('label','pm-banner-active'),toggle=el('input');toggle.type='checkbox';toggle.setAttribute('role','switch');toggle.checked=!p.disabled;toggle.setAttribute('aria-label',`Active: ${p.title}`);toggle.onchange=()=>bannerToggle(p,toggle.checked);label.append(toggle,document.createTextNode(p.disabled?'Inactive':'Active'));const remove=el('button','quiet','Remove');remove.type='button';remove.onclick=()=>bannerRemove(p);controls.append(label,remove);card.append(controls)}
   else if(tab==='sales'){
    const active=p.endsAt>Date.now();card.classList.add('pm-sale-card');card.append(el('span','pm-badge',active?'Active':'Ended'),el('strong','',p.name),el('p','',`${Object.keys(p.prices).length} Products · ${active?'Ends':'Ended'} ${new Date(p.endsAt).toLocaleString()}`));
    const actions=el('div','pm-sale-actions'),editButton=el('button','quiet',active?'Edit Sale':'Restart Sale');editButton.type='button';editButton.onclick=()=>editSale(p);actions.append(editButton);
    if(active){const end=el('button','quiet','End Sale');end.type='button';end.onclick=()=>endSale(p);actions.append(end)}card.append(actions);
   }
   else{card.append(el('strong','',p.name),el('span','pm-price',`${live(p)?p.sale.price:p.price} Coins`),el('p','',p.description??defaults.get(p.id)?.description??'Default Shop Description'));if(live(p))card.append(el('span','pm-badge',`Sale Ends ${new Date(p.sale.endsAt).toLocaleDateString()}`));if(p.active===false)card.append(el('span','pm-badge','Hidden'));if(tab==='bundles'){
    card.classList.add('pm-bundle-card');
    const actions=el('div','pm-bundle-actions'),editButton=el('button','quiet','Edit Bundle'),remove=el('button','quiet pm-bundle-delete','Delete Bundle');
    editButton.type=remove.type='button';editButton.onclick=()=>{if(!busy)edit(p,true)};remove.onclick=()=>deleteBundle(p);actions.append(editButton,remove);card.append(actions);
    card.onclick=e=>{if(!busy&&!e.target.closest('button'))edit(p,true)};
   }else card.onclick=()=>{if(!busy)edit(p,false)}}
   grid.append(card);
  }
 }
 async function load(force=false){if(busy||loaded&&!force)return;const token=++epoch;busy=true;status.textContent='Loading Products…';try{
  const [result,local]=await Promise.all([request({action:'list'}),readShopCatalog()]);if(token!==epoch)return;defaults=local.defaults;defaultBanners=local.banners;
  config=result.config;catalog=result.catalog.map(p=>({...p,name:(defaults.get(p.id)?.name||p.name).replaceAll('â€”','—').replaceAll('â€“','–').replaceAll('â€™','’')})).sort((a,b)=>a.name.localeCompare(b.name));loaded=true;render();
 }catch(e){if(token===epoch)status.textContent=e.message||'Unable to load products.'}finally{if(token===epoch)busy=false}}
 function input(label,name,value,type='text'){const wrap=el('label','',label),field=el(type==='textarea'?'textarea':'input');if(type!=='textarea')field.type=type;field.name=name;field.value=value??'';if(type==='number'){field.min='1';field.max='100000';field.step='1'}if(type==='textarea'){field.rows=3;field.maxLength=1000}wrap.append(field);fields.append(wrap);return field}
 function check(label,name,value){const wrap=el('label','pm-check'),box=el('input');box.type='checkbox';box.name=name;box.checked=value;wrap.append(box,document.createTextNode(label));fields.append(wrap);return box}
 function begin(title){dialog.classList.remove('pm-editor--collection');fields.replaceChildren();message.textContent='';dialog.querySelector('h2').textContent=title;form.querySelector('[type=submit]').disabled=false;dialog.showModal()}
 function mountPicker(picker){dialog.classList.add('pm-editor--collection');const details=el('div','pm-details');details.append(...fields.childNodes);fields.append(details,picker)}
 function edit(p,isBundle){
  begin(isBundle?p.id?'Edit Bundle':'Create Bundle':p.name);const revision=config.revision;
  if(isBundle)input('Bundle Name','name',p.name).required=true;
  const priceField=input('Regular Price (Coins)','price',p.price??'','number');priceField.required=true;let manualPrice=!!p.id;priceField.oninput=()=>{manualPrice=true};
  input('Shop Description','description',p.description??defaults.get(p.id)?.description??'','textarea');
  let useDefault;if(!isBundle)useDefault=check('Use the app’s default description','defaultDescription',config.products[p.id]?.description==null);
  if(useDefault)form.elements.description.addEventListener('input',()=>{useDefault.checked=false});
  let members=new Set(p.items||[]);let active;
  const updateBundlePrice=()=>{if(!manualPrice)priceField.value=[...members].reduce((sum,id)=>sum+Number(effective(catalog.find(c=>c.id===id)).price),0)||''};
  if(isBundle){const recalculate=el('button','quiet','Use Combined Product Price');recalculate.type='button';recalculate.onclick=()=>{manualPrice=false;updateBundlePrice()};fields.append(recalculate)}
  if(isBundle){
   active=check('Show Bundle in Shop','active',p.active!==false);
   fields.append(el('p','','The bundle has a fixed price. Previously owned items are not discounted.'));
   mountPicker(createProductPicker({products:catalog.map(effective),selected:new Map([...members].map(id=>[id,true])),onChange:selected=>{members=new Set(selected.keys());updateBundlePrice()}}));
  }
  saveAction=()=>({action:isBundle?'saveBundle':'saveProduct',id:p.id||`bundle-${crypto.randomUUID()}`,expectedRevision:revision,price:Number(priceField.value),description:useDefault?.checked?null:form.elements.description.value,...(isBundle?{name:form.elements.name.value,items:[...members],active:active.checked}:{})});

 }
 function editSale(p={}){
  begin(p.id?'Edit Sale':'Create Sale');const revision=config.revision;
  input('Sale Name','name',p.name||'').required=true;
  const days=input(p.endsAt>Date.now()?'New Duration (Days) — Leave Blank to Keep the End Date':'Duration (Days)','saleDays',p.endsAt>Date.now()?'':7,'number');days.max='365';days.required=!(p.endsAt>Date.now());
  const selected=new Map(Object.entries(p.prices||{}));
  const choices=[...catalog.map(effective),...Object.entries(config.bundles).map(([id,b])=>({id,...b}))];
  mountPicker(createProductPicker({products:choices,selected,sale:true}));
  saveAction=()=>{if(!selected.size)throw Error('Choose at least one product.');for(const [id,amount] of selected){const regular=choices.find(c=>c.id===id)?.price;if(!Number.isSafeInteger(amount)||amount<1||amount>=regular)throw Error('Every selected product needs a sale price below its regular price.');}return {action:'saveSale',id:p.id||`sale-${crypto.randomUUID()}`,expectedRevision:revision,name:form.elements.name.value,prices:Object.fromEntries(selected),...(days.value?{saleDays:Number(days.value)}:{})}};
 }
 async function deleteBundle(p){
  if(busy||!confirm(`Delete “${p.name}”? This removes the bundle from the shop and any sales. Customers keep cosmetics they already own.`))return;
  busy=true;const token=epoch;grid.querySelectorAll('.pm-bundle-actions button').forEach(b=>b.disabled=true);status.textContent='Deleting Bundle…';
  try{const next=await request({action:'deleteBundle',id:p.id,expectedRevision:config.revision});if(token!==epoch)return;config=next;render();status.textContent='Bundle Deleted.'}
  catch(e){if(token===epoch){render();status.textContent=e.message||'Unable to delete this bundle.'}}
  finally{if(token===epoch)busy=false}
 }
 async function endSale(p){if(busy||!confirm(`End “${p.name}” and restore regular prices?`))return;busy=true;const token=epoch;try{const next=await request({action:'endSale',id:p.id,expectedRevision:config.revision});if(token!==epoch)return;config=next;render()}catch(e){if(token===epoch)status.textContent=e.message}finally{if(token===epoch)busy=false}}
 async function bannerToggle(b,enabled){if(busy){render();return}busy=true;const token=epoch;try{const next=await request({action:'setBannerEnabled',id:b.id,enabled,expectedRevision:config.revision});if(token!==epoch)return;config=next;render()}catch(e){if(token===epoch){render();status.textContent=e.message}}finally{if(token===epoch)busy=false}}
 async function bannerRemove(b){if(busy||!confirm('Remove this banner? Use the Active switch instead to keep it for later.'))return;busy=true;const token=epoch;try{const next=await request({action:'removeBanner',id:b.id,expectedRevision:config.revision});if(token!==epoch)return;config=next;render()}catch(e){if(token===epoch)status.textContent=e.message}finally{if(token===epoch)busy=false}}
 function upload(){begin('Upload Shop Banner');const revision=config.revision;input('Banner Title','title','').required=true;const file=input('Image (PNG, JPEG, or WebP)','file','','file');file.accept='image/png,image/jpeg,image/webp';file.required=true;const label=el('label','','Open When Clicked'),select=el('select');select.name='target';for(const [id,name] of [['home','Shop Home'],['themes','Themes'],['stickers','Stickers'],['tile-skins','Tile Skins'],['cursors','Cursors'],['planner-skins','Planners'],['presentation-themes','Presentations'],['profile-cosmetics','Profiles'],['halloween','Halloween'],['membership','Subscription']]){const o=el('option','',name);o.value=id;select.append(o)}label.append(select);fields.append(label,el('p','','Wide images work best (about 2.4:1). Images are resized before upload.'));
  saveAction=async()=>{const chosen=file.files[0];if(!chosen||!['image/png','image/jpeg','image/webp'].includes(chosen.type)||chosen.size>15*1024*1024)throw Error('Choose a PNG, JPEG, or WebP smaller than 15 MB.');const bitmap=await createImageBitmap(chosen);if(bitmap.width*bitmap.height>40000000){bitmap.close();throw Error('Choose a smaller image.')}const scale=Math.min(1,1600/bitmap.width,800/bitmap.height),canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();return {action:'uploadBanner',expectedRevision:revision,title:form.elements.title.value,target:select.value,image:canvas.toDataURL('image/webp',.88)}};
 }
 form.onsubmit=async e=>{e.preventDefault();if(busy||!saveAction)return;busy=true;const token=epoch;form.querySelector('[type=submit]').disabled=true;message.textContent='Saving…';try{const input=await saveAction();if(token!==epoch)return;const result=await request(input);if(token!==epoch)return;config=result;dialog.close();render();status.textContent='Saved. Shop changes appear when users reopen the shop after its short cache refresh.'}catch(err){if(token===epoch)message.textContent=err.message||'Unable to save.'}finally{if(token===epoch){busy=false;form.querySelector('[type=submit]').disabled=false}}};
 dialog.querySelector('[data-close]').onclick=()=>{if(!busy)dialog.close()};dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault()});
 search.oninput=render;category.onchange=render;add.onclick=()=>tab==='bundles'?edit({},true):tab==='sales'?editSale():upload();element.querySelector('[data-refresh]').onclick=()=>load(true);element.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;search.value='';render()});
 return {element,load,reset(){epoch++;busy=false;loaded=false;config=null;catalog=[];if(dialog.open)dialog.close();grid.replaceChildren();element.hidden=true}};
}
