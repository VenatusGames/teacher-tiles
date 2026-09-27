const grid = document.querySelector('.profile-badge-grid');
const tabs = document.querySelector('.profile-patch-tabs');

if (grid && tabs) {
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
    dialog.querySelector('.patch-inspector__flavor').textContent =
      patch.querySelector('.profile-badge__requirement:not([hidden]), .profile-badge__date:not([hidden])')?.textContent || '';
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
