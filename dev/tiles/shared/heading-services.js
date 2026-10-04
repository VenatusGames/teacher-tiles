function setupEditableTileHeading(m,type){
  const selector=EDITABLE_TILE_HEADINGS[type];
  if(!selector)return;
  const title=m.querySelector(selector);
  if(!title)return;
  const fallback=String(title.textContent||'Tile').replace(/\s+/g,' ').trim()||'Tile';
  title.contentEditable='true';
  title.dataset.textEditMode='double';
  title.classList.add('module-text-edit-target','editable-tile-heading');
  title.setAttribute('role','textbox');
  title.setAttribute('aria-label','Tile title');
  bindEditableModuleTitle(m,title,fallback);
}

function setupTileHeadingVisibility(m,type){
  const selector=TILE_HEADING_VISIBILITY_SELECTORS[type];
  if(!selector)return;
  const heading=m.querySelector(selector);
  if(!heading)return;
  window.TeacherTilesSettings?.addHeadingToggle?.(m,heading);
}
