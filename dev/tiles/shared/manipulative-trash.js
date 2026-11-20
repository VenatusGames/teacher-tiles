// Shared drop target for movable pieces. Hit-test the release position in screen coordinates.
function manipulativeTrash(parent) {
  const zone=document.createElement('div');
  zone.className='manipulative-trash';
  zone.innerHTML='<b aria-hidden="true">×</b> Drop to Delete';
  zone.hidden=true;
  parent.append(zone);
  const hit=event=>{
    const rect=zone.getBoundingClientRect();
    return !zone.hidden && event.clientX>=rect.left && event.clientX<=rect.right && event.clientY>=rect.top && event.clientY<=rect.bottom;
  };
  const close=()=>{zone.hidden=true;zone.classList.remove('is-armed');};
  return {zone,show(){zone.hidden=false;},move(e){zone.classList.toggle('is-armed',hit(e));},
    finish(e){const remove=e.type!=='pointercancel'&&hit(e);close();return remove;},close};
}
