export function createUsersPanel(call) {
  const element=document.getElementById('portal-users'),list=document.getElementById('users-list');
  const status=document.getElementById('users-status'),more=document.getElementById('users-more'),refresh=document.getElementById('users-refresh');
  let nextPageToken=null,loaded=false,busy=false,generation=0;
  function clear(){generation++;loaded=false;busy=false;nextPageToken=null;list.replaceChildren();status.textContent='';more.hidden=true;refresh.disabled=false;}
  function row(user){
    const item=document.createElement('article');item.className='user-card';
    item.innerHTML='<div class="user-avatar"></div><div class="user-info"><strong></strong><span class="user-email"></span><small class="user-presence"></small></div><label class="beta-toggle"><span>Has Beta access</span><input type="checkbox" role="switch"><i aria-hidden="true"></i></label>';
    const avatar=item.querySelector('.user-avatar');avatar.textContent=(user.displayName||user.email||'?').slice(0,1).toUpperCase();
    if(user.photoURL){try{const url=new URL(user.photoURL);if(url.protocol==='https:'){const image=new Image();image.alt='';image.referrerPolicy='no-referrer';image.loading='lazy';image.src=url.href;image.onerror=()=>image.remove();avatar.append(image);}}catch{}}
    item.querySelector('strong').textContent=user.displayName||user.email||'Unnamed account';
    item.querySelector('.user-email').textContent=user.email||'No email address';
    if(user.subscriber){const crown=document.createElementNS('http://www.w3.org/2000/svg','svg');crown.setAttribute('viewBox','0 0 48 48');crown.setAttribute('class','user-crown');crown.setAttribute('role','img');crown.setAttribute('aria-label','Subscriber');crown.innerHTML='<use href="assets/ui/subscriber-crown.svg#crown"/>';item.querySelector('strong').append(crown);}
    const presence=item.querySelector('.user-presence'),online=!!user.lastSeen&&Date.now()-user.lastSeen<360000;
    presence.textContent=online?'Online · active recently':user.lastSeen?'Offline · last active '+new Date(user.lastSeen).toLocaleString():'No recent activity';presence.classList.toggle('is-online',online);
    const input=item.querySelector('input');input.checked=user.betaAccess;input.setAttribute('aria-label','Has Beta access: '+(user.email||user.uid));
    if(user.developer){input.disabled=true;input.closest('label').title='Developer accounts already have sandbox access.';item.querySelector('.beta-toggle span').textContent='Developer access';input.checked=true;}
    input.onchange=async()=>{const before=!input.checked,enabled=input.checked,attempt=generation;input.disabled=true;status.textContent='Saving beta access…';try{await call('setUserBetaAccess',{uid:user.uid,enabled});if(attempt===generation)status.textContent=enabled?'Beta access granted.':'Beta access removed. Open sandbox sessions recheck approximately every 5 minutes.';}catch(error){input.checked=before;if(attempt===generation)status.textContent='Could not save beta access. '+(error.message||'Please try again.');}finally{if(!user.developer)input.disabled=false;}};
    return item;
  }
  async function load(append=false){
    if(busy||(!append&&loaded))return;
    const attempt=generation;busy=true;refresh.disabled=more.disabled=true;status.textContent='Loading users…';
    try{const response=await call('listDeveloperUsers',append&&nextPageToken?{pageToken:nextPageToken}:{});if(attempt!==generation)return;
      for(const user of response.data.users)list.append(row(user));
      loaded=true;nextPageToken=response.data.nextPageToken;more.hidden=!nextPageToken;status.textContent=list.children.length+' users loaded'+(nextPageToken?' · more available':'');
    }catch(error){if(attempt===generation)status.textContent='Could not load users. '+(error.message||'Please try again.');}
    finally{if(attempt===generation){busy=false;refresh.disabled=more.disabled=false;}}
  }
  refresh.onclick=()=>{clear();void load();};more.onclick=()=>load(true);
  return {element,load,clear};
}
