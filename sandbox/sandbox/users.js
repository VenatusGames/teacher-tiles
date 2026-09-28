import {createBulkPatches} from './bulk-patches.js?v=20260927-template-patches';
import {createUsersClient} from './users-cache.js?v=20260926-nicknames';
import {createUserDetails} from './user-details.js?v=20260927-template-patches';
export function createUsersPanel(rawCall,getUid=()=>'') {
  const client=createUsersClient(rawCall,getUid),call=client.request;
  const element=document.getElementById('portal-users'),list=document.getElementById('users-list');
  const status=document.getElementById('users-status'),more=document.getElementById('users-more'),refresh=document.getElementById('users-refresh');
  const search=document.getElementById('users-search');
  const online=document.getElementById('users-online-filter'),subscribers=document.getElementById('users-subscriber-filter'),selected=new Set();
  const selectionToggle=document.getElementById('users-selection-toggle');
  function setSelectionMode(enabled){element.classList.toggle('is-selecting-users',enabled);selectionToggle.setAttribute('aria-pressed',String(enabled));selectionToggle.textContent=enabled?'Cancel selection':'Select users';if(!enabled){selected.clear();list.querySelectorAll('.user-select').forEach(input=>input.checked=false);}bulk.update();}
  selectionToggle.onclick=()=>setSelectionMode(!element.classList.contains('is-selecting-users'));
  const bulk=createBulkPatches(document.getElementById('bulk-patch-tool'),call,selected,()=>{client.invalidate();if(!element.hidden){clear();void load();}},()=>setSelectionMode(true));
  online.onchange=subscribers.onchange=()=>{clear();void load();};
  const details=createUserDetails(call,()=>{clear();void load();});
  const searchButton=document.getElementById('users-search-submit');
  let query='';
  let nextPageToken=null,loaded=false,busy=false,generation=0;
  function clear(){details.close();generation++;loaded=false;busy=false;nextPageToken=null;list.replaceChildren();status.textContent='';more.hidden=true;refresh.disabled=false;}
  function row(user){
    const item=document.createElement('article');item.className='user-card';
    item.innerHTML='<div class="user-avatar"></div><div class="user-info"><strong></strong><span class="user-email"></span><small class="user-presence"></small></div><label class="beta-toggle"><span>Has Beta access</span><input type="checkbox" role="switch"><i aria-hidden="true"></i></label>';
    const avatar=item.querySelector('.user-avatar');avatar.textContent=(user.displayName||user.email||'?').slice(0,1).toUpperCase();
    if(user.photoURL){try{const url=new URL(user.photoURL);if(url.protocol==='https:'){const image=new Image();image.alt='';image.referrerPolicy='no-referrer';image.loading='lazy';image.src=url.href;image.onerror=()=>image.remove();avatar.append(image);}}catch{}}
    item.querySelector('strong').textContent=user.displayName||user.email||'Unnamed account';
    item.querySelector('.user-email').textContent=(user.email||'No email address')+(user.nickname?' · '+user.nickname:'');
    if(user.subscriber||user.subscriptionPreview){const crown=document.createElementNS('http://www.w3.org/2000/svg','svg');crown.setAttribute('viewBox','0 0 48 48');crown.setAttribute('class','user-crown');crown.setAttribute('role','img');crown.setAttribute('aria-label',user.subscriber?'Subscriber':'Subscriber · dev console preview');const title=document.createElementNS('http://www.w3.org/2000/svg','title');title.textContent=user.subscriber?'Subscriber':'Subscriber · dev console preview';crown.innerHTML='<use href="assets/ui/subscriber-crown.svg#crown"/>';crown.append(title);item.querySelector('strong').append(crown);}
    const presence=item.querySelector('.user-presence'),online=!!user.lastSeen&&Date.now()-user.lastSeen<360000;
    presence.textContent=online?'Online · active recently':user.lastSeen?'Offline · last active '+new Date(user.lastSeen).toLocaleString():'No recent activity';presence.classList.toggle('is-online',online);
    const input=item.querySelector('input');input.checked=user.betaAccess;input.setAttribute('aria-label','Has Beta access: '+(user.email||user.uid));
    if(user.developer){input.disabled=true;input.closest('label').title='Developer accounts already have sandbox access.';item.querySelector('.beta-toggle span').textContent='Developer access';input.checked=true;}
    input.onchange=async()=>{const before=!input.checked,enabled=input.checked,attempt=generation;input.disabled=true;status.textContent='Saving beta access…';try{await call('setUserBetaAccess',{uid:user.uid,enabled});if(attempt===generation)status.textContent=enabled?'Beta access granted.':'Beta access removed. Open sandbox sessions recheck approximately every 5 minutes.';}catch(error){input.checked=before;if(attempt===generation)status.textContent='Could not save beta access. '+(error.message||'Please try again.');}finally{if(!user.developer)input.disabled=false;}};
    const select=document.createElement('input');select.type='checkbox';select.className='user-select';select.checked=selected.has(user.uid);select.disabled=!!user.disabled;select.setAttribute('aria-label','Select '+(user.email||user.uid));select.onchange=()=>{if(select.checked)selected.add(user.uid);else selected.delete(user.uid);bulk.update();};item.prepend(select);
    const open=document.createElement('button');open.className='user-details-open';open.type='button';open.textContent='View details';open.setAttribute('aria-label','View details for '+(user.email||user.uid));open.onclick=()=>details.open(user.uid);item.append(open);
    item.addEventListener('click',event=>{if(!event.target.closest('button,input,label'))details.open(user.uid);});
    return item;
  }
  async function load(append=false){
    if(busy||(!append&&loaded))return;
    const attempt=generation;busy=true;refresh.disabled=more.disabled=true;status.textContent='Loading users…';
    try{const response=await call('listDeveloperUsers',{query,onlineOnly:online.checked,subscribersOnly:subscribers.checked,...(append&&nextPageToken?{pageToken:nextPageToken}:{})});if(attempt!==generation)return;
      for(const user of response.data.users){if(online.checked&&(!user.lastSeen||Date.now()-user.lastSeen>=360000))continue;list.append(row(user));}
      loaded=true;nextPageToken=response.data.nextPageToken;more.hidden=!nextPageToken;status.textContent=list.children.length+' users loaded'+(nextPageToken?' · more available':'');
    }catch(error){if(attempt===generation)status.textContent='Could not load users. '+(error.message||'Please try again.');}
    finally{if(attempt===generation){busy=false;refresh.disabled=more.disabled=false;}}
  }
  const submitSearch=()=>{query=search.value.trim().toLowerCase();clear();void load();};
  searchButton.onclick=submitSearch;search.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();submitSearch();}};
  search.addEventListener('search',()=>{if(!search.value)submitSearch();});
  refresh.onclick=()=>{client.invalidate();clear();void load();};more.onclick=()=>load(true);
  return {element,load,clear,reset(){setSelectionMode(false);bulk.reset();online.checked=subscribers.checked=false;client.clearSession();clear();query='';search.value='';}};
}
