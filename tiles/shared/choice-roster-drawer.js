/* Polls and Lunch Count retain their roster controls inside a compact drawer. */
function setupChoiceRosterDrawer(m){
  const toggle=m.querySelector('.choice-students-toggle'),drawer=m.querySelector('.choice-roster-drawer');
  const close=()=>{m.classList.remove('is-roster-open','is-roster-dragging');toggle.setAttribute('aria-expanded','false')};
  toggle.addEventListener('click',()=>{const open=!m.classList.contains('is-roster-open');m.classList.toggle('is-roster-open',open);toggle.setAttribute('aria-expanded',String(open));if(open)drawer.querySelector('input')?.focus({preventScroll:true})});
  drawer.querySelector('.choice-roster-close').addEventListener('click',close);
  const outside=e=>{if(!drawer.contains(e.target)&&!toggle.contains(e.target))close()};
  const escape=e=>{if(e.key==='Escape'&&m.classList.contains('is-roster-open')){e.stopPropagation();close();toggle.focus({preventScroll:true})}};
  let dragFrame=0;
  const dragStart=e=>{if(e.target.closest('.choice-student-chip'))dragFrame=requestAnimationFrame(()=>{if(m.isConnected&&m.classList.contains('is-roster-open'))m.classList.add('is-roster-dragging')})};
  const dragEnd=()=>{cancelAnimationFrame(dragFrame);m.classList.remove('is-roster-dragging')};
  drawer.addEventListener('dragstart',dragStart);m.addEventListener('dragend',dragEnd);m.addEventListener('drop',dragEnd);
  document.addEventListener('pointerdown',outside);m.addEventListener('keydown',escape);
  m.querySelectorAll('[data-voting-mode-button],[data-lunch-mode-button]').forEach(b=>b.addEventListener('click',close));
  const cleanup=m._cleanup,deactivate=m._deactivate;
  m._cleanup=()=>{dragEnd();close();drawer.removeEventListener('dragstart',dragStart);m.removeEventListener('dragend',dragEnd);m.removeEventListener('drop',dragEnd);document.removeEventListener('pointerdown',outside);m.removeEventListener('keydown',escape);cleanup?.()};
  m._deactivate=()=>{close();deactivate?.()};
}
