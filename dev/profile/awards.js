import {ensurePlannedPatches} from './patches.js?v=20260930-single-inspector';
export function syncAwardedPatches(user,awards={}) {
  ensurePlannedPatches();
  const created=Date.parse(user?.metadata?.creationTime||'');
  const legacyBeta=!!user&&Number.isFinite(created)&&created<=Date.parse('2026-08-29T04:00:00Z');
  const comingSoon=new Set(['stickerer','tile-layer','template-creator','template-artist']);
  for(const id of ['beta','contributor','stickerer','tile-layer','template-creator','template-artist']){
    const patch=document.querySelector(`.profile-badge-grid .profile-badge--${id}`);if(!patch)continue;
    const award=user?awards?.[id]:null,earned=!award?.revoked&&(!!award||(id==='beta'&&legacyBeta));
    patch.hidden=false;patch.classList.toggle('profile-badge--locked',!earned);
    const date=!earned?null:award?.awardedAt?new Date(award.awardedAt).toISOString().slice(0,10):id==='beta'&&legacyBeta?'2026-08-28':null;
    if(date)patch.dataset.awarded=date;else delete patch.dataset.awarded;
    let check=patch.querySelector('.profile-badge__check');if(!check){check=document.createElement('span');check.className='profile-badge__check';check.setAttribute('aria-hidden','true');check.textContent='✓';patch.append(check);}check.hidden=!earned;
    const name=patch.querySelector('strong').textContent;patch.setAttribute('aria-label',`${name} patch. ${earned?'Earned':'Locked'}.${comingSoon.has(id)?' Coming Soon.':''}`);
  }
}
