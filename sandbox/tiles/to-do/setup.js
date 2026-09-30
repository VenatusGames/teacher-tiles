function setupTodo(m){
  const list=m.querySelector('.todo-list'),add=m.querySelector('.todo-add');
  add.textContent='+';add.setAttribute('aria-label','Add step');list.appendChild(add);
  m.querySelector('.todo-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));m.querySelector('.todo-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));m.querySelector('.todo-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));
  const addRow=(value='New step',checked=false,focus=true,afterRow=null)=>{
    const row=document.createElement('div');
    row.className='todo-row';
    row.innerHTML='<input class="todo-check" type="checkbox" aria-label="Complete step"><input class="todo-item-text" type="text" aria-label="Checklist step"><button class="todo-remove" type="button" aria-label="Remove step">×</button>';
    const check=row.querySelector('.todo-check'),text=row.querySelector('.todo-item-text');
    text.value=value;
    check.checked=Boolean(checked);
    row.classList.toggle('is-done',check.checked);
    check.addEventListener('change',()=>row.classList.toggle('is-done',check.checked));
    text.addEventListener('keydown',event=>{
      if(event.key!=='Enter'||event.isComposing)return;
      event.preventDefault();
      addRow('',false,true,row);
      notifyBoardChanged('todo-add-step');
    });
    row.querySelector('.todo-remove').addEventListener('click',()=>row.remove());
    if(afterRow?.parentElement===list)afterRow.after(row);
    else list.insertBefore(row,add);
    if(focus)requestAnimationFrame(()=>{
      enterModuleTextEdit(text);
      if(value)text.select();
    });
  };
  add.addEventListener('click',()=>addRow());
  addRow('First step',false,false);
  m._boardGetState=()=>({rows:[...list.querySelectorAll('.todo-row')].map(row=>({text:row.querySelector('.todo-item-text')?.value||'',checked:Boolean(row.querySelector('.todo-check')?.checked)}))});
  m._boardSetState=state=>{list.replaceChildren(add);const rows=Array.isArray(state?.rows)?state.rows:[];if(rows.length)rows.forEach(row=>addRow(row.text||'',Boolean(row.checked),false));};
}
