import {loadTileCatalog,gradeOptions,badgeOptions,tileIcon} from '../tiles/shared/tile-catalog.js?v=20261017-all-grades';
import {rememberTileMetadata} from '../tiles/shared/tile-metadata-client.js';
const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
export function createTileManagementPanel(call){
  const element=el('section','tile-management');element.id='portal-tile-management';element.hidden=true;
  element.innerHTML=`<header class="tm-heading"><div><p class="eyebrow">TILE LIBRARY</p><h1>Tile Management</h1><p>Organize tiles for everyone. New tiles appear here automatically.</p></div><button class="quiet" data-refresh type="button">Refresh</button></header>
    <div class="tm-toolbar"><label class="tm-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg><input type="search" aria-label="Search Tiles" placeholder="Search tiles, categories, grades, or badges…" maxlength="120"></label><select aria-label="Filter by Category"><option value="">All Categories</option></select></div>
    <p class="tm-status" role="status" aria-live="polite"></p><div class="tm-grid"></div>
    <dialog class="tm-editor" aria-labelledby="tm-editor-title"><button type="button" class="quiet tm-close" aria-label="Close Tile Editor">×</button><div class="tm-editor-heading"></div><form><section class="tm-description-section"><div class="tm-section-heading"><h3><label for="tm-description">Description</label></h3><button class="tm-link" type="button" data-description-defaults>Restore Default Description</button></div><textarea id="tm-description" class="tm-description-input" rows="3" maxlength="300" aria-describedby="tm-description-count"></textarea><p class="tm-hint" id="tm-description-count"></p></section><section data-tag-section="categories"><div class="tm-section-heading"><h3>Categories</h3><button class="tm-link" type="button" data-defaults>Restore Default Categories</button></div><div class="tm-tags"></div><div class="tm-choices" hidden></div></section><section data-tag-section="grades"><div class="tm-section-heading"><h3>Grade Levels</h3><span>Optional</span></div><p class="tm-hint">Choose individual grades, or use a shortcut to add a whole group.</p><div class="tm-tags"></div><div class="tm-choices" hidden></div></section><section data-tag-section="badges"><div class="tm-section-heading"><h3>Badges</h3><button class="tm-link" type="button" data-badge-defaults>Restore Default Badges</button></div><div class="tm-tags"></div><div class="tm-choices" hidden></div></section><p class="tm-editor-status" role="status" aria-live="polite"></p><footer><span>Description, category, and badge changes apply to all users.</span><button class="primary" type="submit">Save Changes</button></footer></form></dialog>`;
  const search=element.querySelector('input'),filter=element.querySelector('select'),grid=element.querySelector('.tm-grid'),status=element.querySelector('.tm-status'),refresh=element.querySelector('[data-refresh]');
  const dialog=element.querySelector('dialog'),form=dialog.querySelector('form'),save=form.querySelector('[type="submit"]'),editorStatus=dialog.querySelector('.tm-editor-status');
  const descriptionInput=dialog.querySelector('.tm-description-input'),descriptionCount=dialog.querySelector('#tm-description-count');
  let catalog,metadata,loaded=false,loading=false,generation=0,selected,draft,initial,saving=false;
  const individualGrades=gradeOptions.filter(grade=>grade.id!=='all');
  const expandGrades=grades=>grades.includes('all')?individualGrades.map(grade=>grade.id):[...grades];
  const schoolLevels=[
    {name:'All Grades',range:'Pre-K–12',grades:individualGrades.map(grade=>grade.id)},
    {name:'Elementary',range:'Pre-K–5',grades:['pre-k','k','1','2','3','4','5']},
    {name:'Middle School',range:'6–8',grades:['6','7','8']},
    {name:'High School',range:'9–12',grades:['9','10','11','12']}
  ];
  const request=async data=>{const response=await call('developerTileManagement',data);return response?.data??response;};
  const categoryName=id=>catalog?.categories.find(c=>c.id===id)?.label||id;
  const gradeName=id=>gradeOptions.find(g=>g.id===id)?.label||id;
  const badgeName=id=>badgeOptions.find(b=>b.id===id)?.label||id;
  const effectiveDescription=tile=>metadata?.tiles[tile.id]?.description??tile.description;
  const badgeClass=id=>`tm-badge ${badgeOptions.find(b=>b.id===id)?.className||''}`;
  const effectiveBadges=tile=>metadata?.tiles[tile.id]?.badges??tile.badges;
  const effective=tile=>metadata?.tiles[tile.id]?.categories??tile.categories;
  function chips(parent,values,label,kind){for(const id of values)parent.append(el('span',kind==='badge'?badgeClass(id):`tm-chip tm-chip--${kind}`,label(id)));}
  function render(){
    grid.replaceChildren();if(!catalog||!metadata)return;
    const query=search.value.trim().toLowerCase(),terms=query.split(/\s+/).filter(Boolean);
    const tiles=catalog.tiles.filter(tile=>{
      const categories=effective(tile),grades=expandGrades(metadata.tiles[tile.id]?.grades||[]);
      const text=[tile.name,tile.id,effectiveDescription(tile),...categories.map(categoryName),...grades.map(gradeName),...effectiveBadges(tile).map(badgeName),tile.comingSoon?'coming soon':''].join(' ').toLowerCase();
      return (!filter.value||categories.includes(filter.value))&&terms.every(term=>text.includes(term));
    });
    status.textContent=`${tiles.length} of ${catalog.tiles.length} Tiles · Click a tile to edit`;
    for(const tile of tiles){
      const card=el('button','tm-card');card.type='button';card.dataset.tileId=tile.id;card.setAttribute('aria-label',`Edit ${tile.name}`);
      const heading=el('div','tm-card-heading'),title=el('div');title.append(el('strong','',tile.name));
      if(tile.comingSoon)title.append(el('small','tm-coming-soon','Coming Soon'));
      heading.append(tileIcon(tile.icon,tile.iconText),title);card.append(heading);
      card.append(el('p','tm-card-description',effectiveDescription(tile)||'No description.'));
      const badges=el('div','tm-tags tm-card-badges');chips(badges,effectiveBadges(tile),badgeName,'badge');if(badges.childElementCount)card.append(badges);
      const categories=el('div','tm-tags');chips(categories,effective(tile),categoryName,'category');card.append(categories);
      const grades=expandGrades(metadata.tiles[tile.id]?.grades||[]),gradeTags=el('div','tm-tags tm-card-grades');
      if(grades.length)chips(gradeTags,grades,gradeName,'grade');else gradeTags.append(el('span','tm-untagged','No Grade Tags'));
      card.append(gradeTags);card.onclick=()=>open(tile);grid.append(card);
    }
    if(!tiles.length)grid.append(el('p','tm-empty','No tiles match your search. Try a different name or category.'));
  }
  function renderTags(kind){
    const section=dialog.querySelector(`[data-tag-section="${kind}"]`),tags=section.querySelector('.tm-tags'),choices=section.querySelector('.tm-choices');
    tags.replaceChildren();choices.replaceChildren();choices.hidden=true;
    const values=kind==='grades'?draft.grades:(draft[kind]??selected[kind]);
    const options=kind==='categories'?catalog.categories:kind==='grades'?individualGrades:badgeOptions,label=kind==='categories'?categoryName:kind==='grades'?gradeName:badgeName;
    for(const id of values){
      const tag=el('span',kind==='badges'?badgeClass(id):`tm-chip tm-chip--${kind==='categories'?'category':'grade'}`),remove=el('button','tm-tag-remove');remove.innerHTML='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 4.5 7 7m0-7-7 7"/></svg>';remove.type='button';remove.setAttribute('aria-label',`Remove ${label(id)}${kind==='badges'?' Badge':''}`);
      tag.append(document.createTextNode(label(id)),remove);tags.append(tag);
      remove.onclick=()=>{draft[kind]=values.filter(value=>value!==id);renderTags(kind);updateSave();};
    }
    const add=el('button','tm-add');add.innerHTML='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10"/></svg>';add.type='button';add.setAttribute('aria-label',kind==='categories'?'Add Category':kind==='grades'?'Add Grade Level':'Add Badge');add.setAttribute('aria-expanded','false');tags.append(add);
    const available=options.filter(option=>!values.includes(option.id));add.disabled=!available.length;
    const shortcuts=el('div','tm-grade-shortcuts');shortcuts.setAttribute('role','group');shortcuts.setAttribute('aria-label','Add Grade Groups');
    if(kind==='grades')for(const level of schoolLevels){
      if(level.grades.every(grade=>values.includes(grade)))continue;
      const button=el('button','tm-choice tm-grade-shortcut',level.name);button.type='button';button.title=`Add grades ${level.range}`;
      button.onclick=()=>{draft.grades=[...new Set([...draft.grades,...level.grades])];renderTags('grades');updateSave();section.querySelector('.tm-add').focus();};
      shortcuts.append(button);
    }
    if(shortcuts.childElementCount)choices.append(shortcuts);
    for(const option of available){const button=el('button',kind==='badges'?`tm-choice ${badgeClass(option.id)}`:'tm-choice',option.label);button.type='button';button.onclick=()=>{draft[kind]=[...values,option.id];renderTags(kind);updateSave();section.querySelector('.tm-add').focus();};choices.append(button);}
    add.onclick=()=>{choices.hidden=!choices.hidden;add.setAttribute('aria-expanded',String(!choices.hidden));};
  }
  function updateSave(){
    const empty=draft.categories!==null&&!draft.categories.length;
    save.disabled=saving||empty||JSON.stringify(draft)===initial;
    editorStatus.textContent=empty?'Add at least one category so this tile stays discoverable.':'';
  }
  function open(tile){
    selected=tile;const record=metadata.tiles[tile.id];draft={categories:record?.categories?[...record.categories]:null,grades:expandGrades(record?.grades||[]),badges:record?.badges?[...record.badges]:null,description:record?.description??null};initial=JSON.stringify(draft);
    const heading=dialog.querySelector('.tm-editor-heading');heading.replaceChildren(tileIcon(tile.icon,tile.iconText));const title=el('h2','',tile.name);title.id='tm-editor-title';heading.append(title);
    descriptionInput.value=effectiveDescription(tile);updateDescriptionCount();renderTags('categories');renderTags('grades');renderTags('badges');updateSave();dialog.showModal();
  }
  function updateDescriptionCount(){descriptionCount.textContent=`${descriptionInput.value.length} / 300 · Shown in the Add Tile menu`; }
  descriptionInput.oninput=()=>{draft.description=descriptionInput.value;updateDescriptionCount();updateSave();};
  dialog.querySelector('[data-description-defaults]').onclick=()=>{draft.description=null;descriptionInput.value=selected.description;updateDescriptionCount();updateSave();};
  dialog.querySelector('[data-defaults]').onclick=()=>{draft.categories=null;renderTags('categories');updateSave();};
  dialog.querySelector('[data-badge-defaults]').onclick=()=>{draft.badges=null;renderTags('badges');updateSave();};
  dialog.querySelector('.tm-close').onclick=()=>{if(!saving)dialog.close();};dialog.addEventListener('cancel',event=>{if(saving)event.preventDefault();});
  form.onsubmit=async event=>{
    event.preventDefault();if(save.disabled||saving)return;const attempt=generation;
    saving=true;dialog.querySelectorAll('button,textarea').forEach(button=>button.disabled=true);editorStatus.textContent='Saving changes…';
    try{
      const result=await request({action:'save',tileId:selected.id,expectedRevision:metadata.tiles[selected.id]?.revision||0,...draft});
      if(attempt!==generation)return;
      metadata=result;rememberTileMetadata(result);render();dialog.close();status.textContent=`${selected.name} updated. Other sessions refresh tile labels within a few minutes.`;
    }catch(error){if(attempt===generation)editorStatus.textContent=error.message||'Unable to save. Try again.';}
    finally{saving=false;if(attempt===generation){dialog.querySelectorAll('button,textarea').forEach(button=>button.disabled=false);save.disabled=JSON.stringify(draft)===initial;}}
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
  return {element,load,reset(){generation++;loaded=loading=saving=false;dialog.querySelectorAll('button,textarea').forEach(button=>button.disabled=false);catalog=metadata=selected=draft=null;dialog.close();grid.replaceChildren();status.textContent='';search.value='';filter.value='';refresh.disabled=false;}};
}
