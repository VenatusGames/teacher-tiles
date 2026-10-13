import {loadTileCatalog,gradeOptions,tileIcon} from '../tiles/shared/tile-catalog.js';
import {rememberTileMetadata} from '../tiles/shared/tile-metadata-client.js';
const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
export function createTileManagementPanel(call){
  const element=el('section','tile-management');element.id='portal-tile-management';element.hidden=true;
  element.innerHTML=`<header class="tm-heading"><div><p class="eyebrow">TILE LIBRARY</p><h1>Tile Management</h1><p>Organize tiles for everyone. New tiles appear here automatically.</p></div><button class="quiet" data-refresh type="button">Refresh</button></header>
    <div class="tm-toolbar"><label class="tm-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg><input type="search" aria-label="Search Tiles" placeholder="Search tiles, categories, or grades…" maxlength="120"></label><select aria-label="Filter by Category"><option value="">All Categories</option></select></div>
    <p class="tm-status" role="status" aria-live="polite"></p><div class="tm-grid"></div>
    <dialog class="tm-editor" aria-labelledby="tm-editor-title"><button type="button" class="quiet tm-close" aria-label="Close Tile Editor">×</button><div class="tm-editor-heading"></div><p class="tm-description"></p><form><section data-tag-section="categories"><div class="tm-section-heading"><h3>Categories</h3><button class="tm-link" type="button" data-defaults>Restore Default Categories</button></div><div class="tm-tags"></div><div class="tm-choices" hidden></div></section><section data-tag-section="grades"><div class="tm-section-heading"><h3>Grade Levels</h3><span>Optional</span></div><p class="tm-hint">Stored for future grade filters. These tags do not restrict access.</p><div class="tm-tags"></div><div class="tm-choices" hidden></div></section><p class="tm-editor-status" role="status" aria-live="polite"></p><footer><span>Category changes apply to all users.</span><button class="primary" type="submit">Save Changes</button></footer></form></dialog>`;
  const search=element.querySelector('input'),filter=element.querySelector('select'),grid=element.querySelector('.tm-grid'),status=element.querySelector('.tm-status'),refresh=element.querySelector('[data-refresh]');
  const dialog=element.querySelector('dialog'),form=dialog.querySelector('form'),save=form.querySelector('[type="submit"]'),editorStatus=dialog.querySelector('.tm-editor-status');
  let catalog,metadata,loaded=false,loading=false,generation=0,selected,draft,initial,saving=false;
  const request=async data=>{const response=await call('developerTileManagement',data);return response?.data??response;};
  const categoryName=id=>catalog?.categories.find(c=>c.id===id)?.label||id;
  const gradeName=id=>gradeOptions.find(g=>g.id===id)?.label||id;
  const effective=tile=>metadata?.tiles[tile.id]?.categories??tile.categories;
  function chips(parent,values,label,kind){for(const id of values)parent.append(el('span',`tm-chip tm-chip--${kind}`,label(id)));}
  function render(){
    grid.replaceChildren();if(!catalog||!metadata)return;
    const query=search.value.trim().toLowerCase(),terms=query.split(/\s+/).filter(Boolean);
    const tiles=catalog.tiles.filter(tile=>{
      const categories=effective(tile),grades=metadata.tiles[tile.id]?.grades||[];
      const text=[tile.name,tile.id,tile.description,...categories.map(categoryName),...grades.map(gradeName),tile.comingSoon?'coming soon':''].join(' ').toLowerCase();
      return (!filter.value||categories.includes(filter.value))&&terms.every(term=>text.includes(term));
    });
    status.textContent=`${tiles.length} of ${catalog.tiles.length} Tiles · Click a tile to edit`;
    for(const tile of tiles){
      const card=el('button','tm-card');card.type='button';card.dataset.tileId=tile.id;card.setAttribute('aria-label',`Edit ${tile.name}`);
      const heading=el('div','tm-card-heading'),title=el('div');title.append(el('strong','',tile.name));
      if(tile.comingSoon)title.append(el('small','tm-coming-soon','Coming Soon'));
      heading.append(tileIcon(tile.icon),title);card.append(heading);
      const categories=el('div','tm-tags');chips(categories,effective(tile),categoryName,'category');card.append(categories);
      const grades=metadata.tiles[tile.id]?.grades||[],gradeTags=el('div','tm-tags tm-card-grades');
      if(grades.length)chips(gradeTags,grades,gradeName,'grade');else gradeTags.append(el('span','tm-untagged','No Grade Tags'));
      card.append(gradeTags);card.onclick=()=>open(tile);grid.append(card);
    }
    if(!tiles.length)grid.append(el('p','tm-empty','No tiles match your search. Try a different name or category.'));
  }
  function renderTags(kind){
    const section=dialog.querySelector(`[data-tag-section="${kind}"]`),tags=section.querySelector('.tm-tags'),choices=section.querySelector('.tm-choices');
    tags.replaceChildren();choices.replaceChildren();choices.hidden=true;
    const values=kind==='categories'?(draft.categories??selected.categories):draft.grades;
    const options=kind==='categories'?catalog.categories:gradeOptions,label=kind==='categories'?categoryName:gradeName;
    for(const id of values){
      const tag=el('span',`tm-chip tm-chip--${kind==='categories'?'category':'grade'}`),remove=el('button','tm-tag-remove','×');remove.type='button';remove.setAttribute('aria-label',`Remove ${label(id)}`);
      tag.append(document.createTextNode(label(id)),remove);tags.append(tag);
      remove.onclick=()=>{draft[kind]=values.filter(value=>value!==id);renderTags(kind);updateSave();};
    }
    const add=el('button','tm-add','+');add.type='button';add.setAttribute('aria-label',kind==='categories'?'Add Category':'Add Grade Level');add.setAttribute('aria-expanded','false');tags.append(add);
    const available=options.filter(option=>!values.includes(option.id));add.disabled=!available.length;
    for(const option of available){const button=el('button','tm-choice',option.label);button.type='button';button.onclick=()=>{draft[kind]=[...values,option.id];renderTags(kind);updateSave();section.querySelector('.tm-add').focus();};choices.append(button);}
    add.onclick=()=>{choices.hidden=!choices.hidden;add.setAttribute('aria-expanded',String(!choices.hidden));};
  }
  function updateSave(){
    const empty=draft.categories!==null&&!draft.categories.length;
    save.disabled=saving||empty||JSON.stringify(draft)===initial;
    editorStatus.textContent=empty?'Add at least one category so this tile stays discoverable.':'';
  }
  function open(tile){
    selected=tile;const record=metadata.tiles[tile.id];draft={categories:record?.categories?[...record.categories]:null,grades:[...(record?.grades||[])]};initial=JSON.stringify(draft);
    const heading=dialog.querySelector('.tm-editor-heading');heading.replaceChildren(tileIcon(tile.icon));const title=el('h2','',tile.name);title.id='tm-editor-title';heading.append(title);
    dialog.querySelector('.tm-description').textContent=tile.description;renderTags('categories');renderTags('grades');updateSave();dialog.showModal();
  }
  dialog.querySelector('[data-defaults]').onclick=()=>{draft.categories=null;renderTags('categories');updateSave();};
  dialog.querySelector('.tm-close').onclick=()=>{if(!saving)dialog.close();};dialog.addEventListener('cancel',event=>{if(saving)event.preventDefault();});
  form.onsubmit=async event=>{
    event.preventDefault();if(save.disabled||saving)return;const attempt=generation;
    saving=true;dialog.querySelectorAll('button').forEach(button=>button.disabled=true);editorStatus.textContent='Saving changes…';
    try{
      const result=await request({action:'save',tileId:selected.id,expectedRevision:metadata.tiles[selected.id]?.revision||0,...draft});
      if(attempt!==generation)return;
      metadata=result;rememberTileMetadata(result);render();dialog.close();status.textContent=`${selected.name} updated. Other sessions refresh categories within a few minutes.`;
    }catch(error){if(attempt===generation)editorStatus.textContent=error.message||'Unable to save. Try again.';}
    finally{saving=false;if(attempt===generation){dialog.querySelectorAll('button').forEach(button=>button.disabled=false);save.disabled=JSON.stringify(draft)===initial;}}
  };
  async function load(force=false){
    if(loading||loaded&&!force)return;const attempt=++generation;loading=true;refresh.disabled=true;status.textContent='Loading tiles…';
    try{
      const [nextCatalog,nextMetadata]=await Promise.all([loadTileCatalog(),request({action:'list'})]);
      if(attempt!==generation)return;
      catalog=nextCatalog;metadata=nextMetadata;rememberTileMetadata(metadata);loaded=true;
      const previous=filter.value;filter.replaceChildren(new Option('All Categories',''));for(const category of catalog.categories)filter.add(new Option(category.label,category.id));filter.value=previous;render();
    }catch(error){if(attempt===generation)status.textContent=error.message||'Tiles could not load. Choose Refresh to try again.';}
    finally{if(attempt===generation){loading=false;refresh.disabled=false;}}
  }
  search.oninput=render;filter.onchange=render;refresh.onclick=()=>load(true);
  return {element,load,reset(){generation++;loaded=loading=saving=false;dialog.querySelectorAll('button').forEach(button=>button.disabled=false);catalog=metadata=selected=draft=null;dialog.close();grid.replaceChildren();status.textContent='';search.value='';filter.value='';refresh.disabled=false;}};
}
