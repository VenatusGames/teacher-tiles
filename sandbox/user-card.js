export function createUserCard(user){
    const item=document.createElement('article');item.className='user-card';
    item.innerHTML='<div class="user-avatar"></div><div class="user-info"><strong></strong><span class="user-email"></span><small class="user-presence"></small></div>';
    const avatar=item.querySelector('.user-avatar');avatar.textContent=(user.displayName||user.email||'?').slice(0,1).toUpperCase();
    if(user.photoURL){try{const url=new URL(user.photoURL);if(url.protocol==='https:'){const image=new Image();image.alt='';image.referrerPolicy='no-referrer';image.loading='lazy';image.src=url.href;image.onerror=()=>image.remove();avatar.append(image);}}catch{}}
    item.querySelector('strong').textContent=user.displayName||user.email||'Unnamed account';
    item.querySelector('.user-email').textContent=(user.email||'No email address')+(user.nickname?' · '+user.nickname:'');
    if(user.subscriber||user.subscriptionPreview||user.subscriptionOverride){const crown=document.createElementNS('http://www.w3.org/2000/svg','svg');crown.setAttribute('viewBox','0 0 48 48');crown.setAttribute('class','user-crown');crown.setAttribute('role','img');crown.setAttribute('aria-label',user.subscriber?'Subscriber':user.subscriptionOverride?'Subscriber · free permanent access':'Subscriber · dev console preview');const title=document.createElementNS('http://www.w3.org/2000/svg','title');title.textContent=user.subscriber?'Subscriber':user.subscriptionOverride?'Subscriber · free permanent access':'Subscriber · dev console preview';crown.innerHTML='<use href="assets/ui/subscriber-crown.svg#crown"/>';crown.append(title);item.querySelector('strong').append(crown);}
    const presence=item.querySelector('.user-presence'),online=!!user.lastSeen&&Date.now()-user.lastSeen<=15*60*1000;
    presence.textContent=online?'Online · active recently':user.lastSeen?'Offline · last active '+new Date(user.lastSeen).toLocaleString():'No recent activity';presence.classList.toggle('is-online',online);
    return item;
}
