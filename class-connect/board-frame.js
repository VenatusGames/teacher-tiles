// Runs inside the isolated session board before the application scripts.
(()=>{
 const store=new Map(),storage={getItem:k=>store.get(String(k))??null,setItem:(k,v)=>store.set(String(k),String(v)),removeItem:k=>store.delete(String(k)),clear:()=>store.clear(),key:i=>[...store.keys()][i]??null,get length(){return store.size}};
 Object.defineProperty(window,'localStorage',{value:storage});Object.defineProperty(window,'sessionStorage',{value:storage});
 window.ClassConnectPolicy={controlled:false,hydrating:true,allowed:[],ready:false,canCreate(type){return this.hydrating||this.replacing===true||(!this.controlled&&this.allowed.includes(type));},canDelete(){return this.hydrating||!this.controlled;}};

 // Embedded tiles can listen directly on the window, including during pointer capture.
 const blockLockedInput=event=>{
  if(!window.ClassConnectPolicy.locked)return;
  event.stopImmediatePropagation();
  if(event.cancelable)event.preventDefault();
 };
 for(const type of ['pointerdown','pointermove','pointerup','mousedown','mousemove','mouseup','click','dblclick','contextmenu','keydown','keyup','beforeinput','input','change','submit','wheel','touchstart','touchmove','touchend','dragstart','dragover','drop']){
  window.addEventListener(type,blockLockedInput,{capture:true,passive:false});
 }

 // Seed only the names/avatars already visible through the shared class link.
 // This writes to the private Map above, not browser storage or any save helper.
 window.ClassConnectPolicy.followCamera=camera=>{
  if(camera){Object.assign(boardCamera,camera);applyBoardCamera();}
 };
 window.ClassConnectPolicy.seedRoster=roster=>{
  if(!Array.isArray(roster?.students))return;
  const studentProfiles={};for(const member of roster.students)studentProfiles[window.starChartStudentKey(member.name)]={emoji:member.emoji||'',image:member.image||''};
  store.set('teachertiles-class-rosters-v1:local',JSON.stringify([{id:'classconnect',name:roster.name||'Our Class',gradeLevel:roster.gradeLevel||'',students:roster.students.map(member=>member.name),studentProfiles,pbisEnabled:true}]));
 };
 window.TeacherTilesAuth={user:null};
 window.setupTeacherTilesShop=()=>{};
 // Session tiles are authorized by the teacher, including holiday tools.
 window.addEventListener('DOMContentLoaded',()=>{if(window.TeacherTilesHalloween){TeacherTilesHalloween.hasAccess=()=>true;TeacherTilesHalloween.guard=()=>{};}window.TeacherTilesBoardAccessCheck=()=>true;});
 document.addEventListener('DOMContentLoaded',()=>{document.querySelector('#teachertiles-intro')?.remove();document.documentElement.classList.remove('sandbox-access-locked');});
})();
