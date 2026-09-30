const grid = document.querySelector('.profile-badge-grid');
const tabs = document.querySelector('.profile-patch-tabs');

const plannedPatches = [
  {
    id: 'template-creator',
    name: 'Template Creator',
    requirement: 'Upload your first template!',
    icon: '<svg viewBox="0 0 48 48"><path d="M12 7h17l7 7v27H12V7Z"/><path d="M29 7v8h7M24 33V20M18.5 25.5 24 20l5.5 5.5"/></svg>'
  },
  {
    id: 'template-artist',
    name: 'Template Artist',
    requirement: 'Create and Upload 10 Templates!',
    icon: '<svg viewBox="0 0 48 48"><path d="M24 7C14.6 7 7 13.9 7 22.3 7 31.5 14.6 39 24 39h3.6c2.7 0 3.8-3.3 1.7-4.9-1.8-1.4-.8-4.2 1.5-4.2h3.1c4.4 0 7.1-3.4 7.1-7.7C41 13.8 33.4 7 24 7Z"/><path d="M16 19h.1M22 14h.1M29 16h.1M14 26h.1"/></svg>'
  }
];

export function ensurePlannedPatches() {
  if (!grid) return;
  for (const patch of plannedPatches) {
    if (grid.querySelector(`.profile-badge--${patch.id}`)) continue;
    const button = document.createElement('button');
    const requirementId = `${patch.id}-patch-requirement`;
    button.type = 'button';
    button.className = `profile-badge profile-badge--locked profile-badge--coming-soon profile-badge--${patch.id}`;
    button.setAttribute('aria-describedby', requirementId);
    button.setAttribute('aria-label', `${patch.name} patch. Locked. Coming Soon. ${patch.requirement}`);
    button.innerHTML = `<span class="profile-badge__medallion" aria-hidden="true"><span class="profile-badge__shine"></span>${patch.icon}</span>
      <span class="profile-badge__copy"><strong>${patch.name}</strong></span>
      <span id="${requirementId}" class="profile-badge__requirement" role="tooltip">Unlock: ${patch.requirement}</span>
      <span class="profile-badge__check" aria-hidden="true" hidden>✓</span>`;
    grid.append(button);
  }
}

ensurePlannedPatches();

if (grid && tabs && grid.dataset.patchInspectorInitialized !== 'true') {
  grid.dataset.patchInspectorInitialized = 'true';
  for (const id of ['stickerer', 'tile-layer', 'template-creator', 'template-artist']) {
    grid.querySelector(`.profile-badge--${id}`)?.classList.add('profile-badge--coming-soon');
  }

  if (!document.getElementById('template-patch-styles')) {
    const style = document.createElement('style');
    style.id = 'template-patch-styles';
    style.textContent = `
      .profile-badge--coming-soon .profile-badge__requirement::before{content:'Coming Soon';display:block;margin-bottom:2px;color:#ffd976;font-size:7px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}

      /* Keep these patches on the SAME stitched rim treatment as Beta Tester.
         Only swap thread/medallion colors. */
      .profile-badge--stickerer:not(.profile-badge--locked),
      .profile-badge--tile-layer:not(.profile-badge--locked),
      .profile-badge--template-creator:not(.profile-badge--locked),
      .profile-badge--template-artist:not(.profile-badge--locked){cursor:default}

      .profile-badge--stickerer:not(.profile-badge--locked){--patch-high:#f8a4c5;--patch-low:#a8417c;--braid-light:#ffe0ec;--braid-mid:#d47aa9;--braid-dark:#783459}
      .profile-badge--tile-layer:not(.profile-badge--locked){--patch-high:#99d8b7;--patch-low:#26776a;--braid-light:#d7f5cf;--braid-mid:#70ad91;--braid-dark:#23584e}
      .profile-badge--template-creator:not(.profile-badge--locked){--patch-high:#8bdcff;--patch-low:#2c64c7;--braid-light:#d8f5ff;--braid-mid:#67aee8;--braid-dark:#244f9f}
      .profile-badge--template-artist:not(.profile-badge--locked){--patch-high:#d6a3ff;--patch-low:#7b3fb7;--braid-light:#f2dbff;--braid-mid:#b779df;--braid-dark:#5e2f8c}

      /* Exact Beta Tester rim geometry; these patches only change thread/medallion colors. */
      .profile-badge--stickerer:not(.profile-badge--locked) .profile-badge__medallion,
      .profile-badge--tile-layer:not(.profile-badge--locked) .profile-badge__medallion,
      .profile-badge--template-creator:not(.profile-badge--locked) .profile-badge__medallion,
      .profile-badge--template-artist:not(.profile-badge--locked) .profile-badge__medallion{
        border:4px solid transparent !important;
        border-radius:50% !important;
        background:radial-gradient(circle at 38% 30%,var(--patch-high),var(--patch-low) 76%) padding-box,repeating-conic-gradient(from 2deg,var(--braid-light) 0 2.5deg,var(--braid-mid) 2.5deg 5deg,var(--braid-dark) 5deg 7.5deg,var(--braid-mid) 7.5deg 10deg) border-box !important;
        box-shadow:0 0 0 1px #77818a,0 5px 10px rgba(33,48,67,.18),inset 0 0 0 1px rgba(255,255,255,.22) !important;
      }

      .profile-badge--stickerer:not(.profile-badge--locked) .profile-badge__medallion::before,
      .profile-badge--tile-layer:not(.profile-badge--locked) .profile-badge__medallion::before,
      .profile-badge--template-creator:not(.profile-badge--locked) .profile-badge__medallion::before,
      .profile-badge--template-artist:not(.profile-badge--locked) .profile-badge__medallion::before{
        content:'' !important;
        position:absolute !important;
        z-index:2 !important;
        inset:-1px !important;
        border:1px dashed rgba(248,250,252,.65) !important;
        border-radius:50% !important;
        box-shadow:inset 0 0 0 1px rgba(52,63,74,.2) !important;
        pointer-events:none !important;
      }

      .profile-badge--stickerer:not(.profile-badge--locked) .profile-badge__medallion::after,
      .profile-badge--tile-layer:not(.profile-badge--locked) .profile-badge__medallion::after,
      .profile-badge--template-creator:not(.profile-badge--locked) .profile-badge__medallion::after,
      .profile-badge--template-artist:not(.profile-badge--locked) .profile-badge__medallion::after{
        content:'' !important;
        position:absolute !important;
        inset:6px !important;
        border:0 !important;
        border-radius:50% !important;
        background:radial-gradient(circle at 36% 25%,rgba(255,255,255,.2),transparent 48%) !important;
        pointer-events:none !important;
      }

      .profile-badge--stickerer:not(.profile-badge--locked) .profile-badge__medallion svg{stroke:#fff0f7;filter:drop-shadow(0 2px 1px #70245266)}
      .profile-badge--tile-layer:not(.profile-badge--locked) .profile-badge__medallion svg{stroke:#ecffde;filter:drop-shadow(0 2px 1px #164e4266)}
      .profile-badge--template-creator:not(.profile-badge--locked) .profile-badge__medallion svg{stroke:#f2fbff;filter:drop-shadow(0 2px 1px #173c7666)}
      .profile-badge--template-artist:not(.profile-badge--locked) .profile-badge__medallion svg{stroke:#fff1c7;filter:drop-shadow(0 2px 1px #51266f66)}
    `;
    document.head.append(style);
  }

  tabs.addEventListener('click', event => {
    const button = event.target.closest('[data-patch-category]');
    if (!button) return;
    grid.dataset.category = button.dataset.patchCategory;
    tabs.querySelectorAll('button').forEach(tab => tab.setAttribute('aria-pressed', String(tab === button)));
  });

  const dialog = document.createElement('dialog');
  dialog.className = 'patch-inspector';
  dialog.setAttribute('aria-labelledby', 'patch-inspector-name');
  dialog.innerHTML = `<button class="patch-inspector__close" type="button" aria-label="Close patch detail">×</button>
    <p class="patch-inspector__flavor"></p><div class="patch-inspector__art"></div>
    <h2 id="patch-inspector-name"></h2><p class="patch-inspector__date"></p>`;
  document.body.append(dialog);
  const close = () => dialog.close();
  dialog.querySelector('button').addEventListener('click', close);
  dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
  dialog.addEventListener('keydown', event => event.stopPropagation());

  grid.addEventListener('click', event => {
    const patch = event.target.closest('.profile-badge');
    if (!patch) return;
    const medallion = patch.querySelector('.profile-badge__medallion');
    const origin = medallion.getBoundingClientRect();
    const art = dialog.querySelector('.patch-inspector__art');
    const copy = document.createElement('div');
    copy.className = patch.className;
    copy.append(medallion.cloneNode(true));
    art.replaceChildren(copy);
    dialog.querySelector('h2').textContent = patch.querySelector('strong').textContent;
    const flavor = patch.querySelector('.profile-badge__requirement:not([hidden]), .profile-badge__date:not([hidden])')?.textContent || '';
    dialog.querySelector('.patch-inspector__flavor').textContent = patch.classList.contains('profile-badge--coming-soon') ? `Coming Soon · ${flavor}` : flavor;
    const date = dialog.querySelector('.patch-inspector__date');
    const awarded = patch.dataset.awarded;
    date.textContent = awarded ? `Awarded ${new Date(`${awarded}T12:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}` : '';
    date.hidden = !awarded;
    dialog.showModal();
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const destination = art.getBoundingClientRect();
      art.animate([
        { transform: `translate(${origin.x + origin.width / 2 - destination.x - destination.width / 2}px, ${origin.y + origin.height / 2 - destination.y - destination.height / 2}px) scale(${origin.width / 240})`, opacity: .6 },
        { transform: 'none', opacity: 1 }
      ], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
  });
}
