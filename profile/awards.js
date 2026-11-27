import {manualPatchIds, getPatchName} from './patch-catalog.js?v=20261105-patch-names';
import {ensurePlannedPatches} from './patches.js?v=20261105-patch-names';

export function syncAwardedPatches(user, awards = {}, catalog = {}) {
  ensurePlannedPatches(catalog);
  const created = Date.parse(user?.metadata?.creationTime || '');
  const legacyBeta = !!user && Number.isFinite(created)
    && created <= Date.parse('2026-08-29T04:00:00Z');
  const comingSoon = new Set(['beloved', 'connected', 'stickerer', 'tile-layer', 'template-creator', 'template-artist']);

  for (const id of manualPatchIds) {
    const patch = document.querySelector(`.profile-badge-grid .profile-badge--${id}`);
    if (!patch) continue;

    const award = user ? awards?.[id] : null;
    const earned = !award?.revoked && (!!award || (id === 'beta' && legacyBeta));
    patch.hidden = false;
    patch.classList.toggle('profile-badge--locked', !earned);

    let date = null;
    if (earned) {
      if (award?.awardedAt) {
        date = new Date(award.awardedAt).toISOString().slice(0, 10);
      } else if (id === 'beta' && legacyBeta) {
        date = '2026-08-28';
      }
    }
    if (date) {
      patch.dataset.awarded = date;
    } else {
      delete patch.dataset.awarded;
    }

    let check = patch.querySelector('.profile-badge__check');
    if (!check) {
      check = document.createElement('span');
      check.className = 'profile-badge__check';
      check.setAttribute('aria-hidden', 'true');
      check.textContent = '✓';
      patch.append(check);
    }
    check.hidden = !earned;

    const name = getPatchName(catalog, id);
    patch.querySelector('strong').textContent = name;
    if (id === 'beta') {
      patch.querySelector('.profile-badge__requirement').textContent = `Unlock: ${name}!`;
    }
    patch.setAttribute('aria-label', `${name} patch. ${earned ? 'Earned' : 'Locked'}.${comingSoon.has(id) ? ' Coming Soon.' : ''}`);
  }

  // A normal refresh also updates an inspector that is already open.
  const inspector = document.querySelector('.patch-inspector[open]');
  const inspectedId = inspector?.dataset.patchId;
  if (manualPatchIds.includes(inspectedId)) {
    inspector.querySelector('h2').textContent = getPatchName(catalog, inspectedId);
    if (inspectedId === 'beta') {
      inspector.querySelector('.patch-inspector__flavor').textContent = `Unlock: ${getPatchName(catalog, inspectedId)}!`;
    }
  }
}
