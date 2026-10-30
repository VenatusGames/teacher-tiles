(()=>{'use strict';
 const star='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.3.9-4.55 4.43 1.08 6.27L12 17.34l-5.63 2.96 1.08-6.27L2.9 9.6l6.3-.9L12 3Z"/></svg>';
 function updateFavorite(button,name,active){
   button.setAttribute('aria-pressed',String(active));
   button.setAttribute('aria-label',(active?'Unfavorite ':'Favorite ')+name);
   button.title=active?'Remove from Favorites':'Add to Favorites';
 }
 function favoriteButton(name,active,onToggle){
   const button=document.createElement('button');button.type='button';button.className='cosmetic-favorite';button.innerHTML=star;
   updateFavorite(button,name,active);button.addEventListener('click',event=>{event.stopPropagation();onToggle()});return button;
 }
 window.TeacherTilesCollectionControls=Object.freeze({favoriteButton,updateFavorite});
})();
