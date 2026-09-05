/* Image Search uses the public Commons API; no account keys are shipped to browsers. */
(() => {
  'use strict';
  const DRAG_TYPE = 'application/x-teachertiles-image-search';
  const LIMIT = 60;
  function safeUrl(value, source = false) {
    try {
      if (typeof value !== 'string' || value.length > 4096) return '';
      const url = new URL(String(value || ''));
      if (url.protocol !== 'https:' || url.username || url.password || url.port) return '';
      if (source) {
        if (url.hostname !== 'commons.wikimedia.org' || !url.pathname.startsWith('/wiki/File:')) return '';
      } else if (!['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(url.hostname) || !url.pathname.startsWith('/wikipedia/commons/')) return '';
      return url.href;
    } catch { return ''; }
  }
  function normalizeResult(item) {
    if (!item || typeof item !== 'object') return null;
    const url = safeUrl(item.url), sourceUrl = safeUrl(item.sourceUrl, true);
    if (!url || !sourceUrl) return null;
    return { url, sourceUrl, title: String(item.title || 'Commons image').slice(0, 180),
      creator: String(item.creator || '').slice(0, 240), license: String(item.license || 'See source for license').slice(0, 100) };
  }
  function plainMetadata(value) {
    const text = document.createElement('textarea');
    text.innerHTML = String(value || '').slice(0, 4000).replace(/<[^>]*>/g, ' ');
    return text.value.replace(/\s+/g, ' ').trim();
  }
  function readDrag(dataTransfer) {
    const raw = dataTransfer?.getData(DRAG_TYPE) || '';
    if (raw.length > 12000) return null;
    try { return normalizeResult(JSON.parse(raw)); } catch { return null; }
  }
  function setup(m) {
    const form = m.querySelector('.image-search-form'), input = m.querySelector('.image-search-input');
    const results = m.querySelector('.image-search-results'), status = m.querySelector('.image-search-status');
    const more = m.querySelector('.image-search-more'), submit = form.querySelector('button');
    let items = [], query = '', nextOffset = null, controller = null, revision = 0, cancelDrag = null;
    const captureResultsWheel = event => {
      if (results.scrollHeight > results.clientHeight) event.stopPropagation();
    };
    results.addEventListener('wheel', captureResultsWheel, { passive: true });
    const message = text => { status.textContent = text; };
    const setBusy = busy => {
      m.classList.toggle('is-loading', busy);
      results.setAttribute('aria-busy', String(busy));
      submit.textContent = busy ? 'Searching…' : 'Search';
      more.disabled = busy;
      if (busy && !items.length) {
        results.querySelector('.image-search-empty strong').textContent = 'Finding your images…';
        results.querySelector('.image-search-empty p').textContent = 'Results will appear here, ready to drag onto your board.';
      }
    };
    function addImage(item) {
      const bounds = m.getBoundingClientRect();
      const x = bounds.right + 280 < innerWidth ? bounds.right + 260 : Math.max(280, bounds.left - 280);
      const point = screenToBoard(Math.min(innerWidth - 40, x), Math.max(60, Math.min(innerHeight - 180, bounds.top + 70)));
      const image = createModule('image', point.x, point.y);
      image?._setImageUrl?.(item.url, { attribution: item });
      if (image) message('Image added to your board.');
    }
    function beginBoardDrag(event, item, image) {
      if (event.button !== 0 || event.pointerType === 'touch' || !image.naturalWidth) return;
      event.preventDefault(); event.stopPropagation(); cancelDrag?.();
      const startX = event.clientX, startY = event.clientY, pointerId = event.pointerId;
      const listeners = new AbortController();
      let ghost = null;
      cancelDrag = () => { listeners.abort(); ghost?.remove(); cancelDrag = null; };
      document.addEventListener('pointermove', move => {
        if (move.pointerId !== pointerId) return;
        if (!ghost && Math.hypot(move.clientX - startX, move.clientY - startY) < 7) return;
        if (!ghost) {
          ghost = document.createElement('img'); ghost.src = item.url; ghost.alt = '';
          ghost.className = 'image-search-drag-ghost'; document.body.appendChild(ghost);
        }
        ghost.style.left = `${move.clientX + 12}px`; ghost.style.top = `${move.clientY + 12}px`;
        move.preventDefault();
      }, { signal: listeners.signal, passive: false });
      document.addEventListener('pointerup', up => {
        if (up.pointerId !== pointerId) return;
        const destination = document.elementFromPoint(up.clientX, up.clientY);
        if (ghost && m.isConnected && destination?.closest('#workspace') && !destination.closest('.image-search-module')) {
          const point = screenToBoard(up.clientX, up.clientY);
          const tile = createModule('image', point.x, point.y);
          tile?._setImageUrl?.(item.url, { attribution: item });
          if (tile) message('Image added to your board.');
        }
        cancelDrag?.();
      }, { signal: listeners.signal });
      document.addEventListener('pointercancel', () => cancelDrag?.(), { signal: listeners.signal });
      window.addEventListener('blur', () => cancelDrag?.(), { signal: listeners.signal });
      document.addEventListener('keydown', key => { if (key.key === 'Escape') cancelDrag?.(); }, { signal: listeners.signal });
    }
    function render() {
      results.replaceChildren();
      if (!items.length) {
        const empty = document.createElement('div');
        empty.className = 'image-search-empty';
        const icon = document.createElement('span'); icon.textContent = '▧'; icon.setAttribute('aria-hidden', 'true');
        const title = document.createElement('strong'); title.textContent = query ? 'No images found' : 'Find a picture for your lesson';
        const hint = document.createElement('p'); hint.textContent = query ? 'Try a different subject or a shorter search.' : 'Search animals, places, science, art, and more. Drag a result onto your board.';
        empty.append(icon, title, hint); results.append(empty);
      }
      for (const item of items) {
        const card = document.createElement('article'); card.className = 'image-search-card';
        const image = document.createElement('img'); image.src = item.url; image.alt = item.title;
        image.loading = 'lazy'; image.decoding = 'async'; image.referrerPolicy = 'no-referrer'; image.draggable = true;
        image.addEventListener('pointerdown', event => beginBoardDrag(event, item, image));
        image.addEventListener('dragstart', event => {
          if (!event.dataTransfer || !image.naturalWidth) { event.preventDefault(); return; }
          event.stopPropagation();
          event.dataTransfer.effectAllowed = 'copy';
          event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(item));
          event.dataTransfer.setData('text/uri-list', item.url);
          event.dataTransfer.setData('text/plain', item.url);
        });
        const title = document.createElement('div'); title.className = 'image-search-card-title'; title.textContent = item.title; title.title = item.title;
        const actions = document.createElement('div'); actions.className = 'image-search-card-actions';
        const add = document.createElement('button'); add.type = 'button'; add.textContent = '+ Add';
        add.setAttribute('aria-label', `Add ${item.title} to board`); add.addEventListener('click', () => addImage(item));
        const source = document.createElement('a'); source.href = item.sourceUrl; source.target = '_blank'; source.rel = 'noopener noreferrer';
        source.textContent = item.license; source.title = [item.creator, item.license, 'View source'].filter(Boolean).join(' · ');
        source.setAttribute('aria-label', `Source and license for ${item.title}`); source.draggable = false;
        image.addEventListener('error', () => {
          image.hidden = true; add.disabled = true; title.textContent = 'Preview unavailable';
          card.classList.add('is-unavailable');
        });
        actions.append(add, source); card.append(image, title, actions); results.append(card);
      }
      more.hidden = nextOffset === null || items.length >= LIMIT;
    }
    async function search(append = false) {
      const term = (append ? query : input.value).trim().slice(0, 120);
      if (!term) { input.focus(); message('Enter a subject to find images.'); return; }
      cancelDrag?.(); controller?.abort(); controller = new AbortController();
      const request = ++revision, signal = controller.signal;
      const offset = append ? nextOffset : 0;
      if (append && (offset === null || items.length >= LIMIT)) return;
      if (!append) { query = term; items = []; nextOffset = null; render(); results.scrollTop = 0; notifyBoardChanged('image-search-query'); }
      setBusy(true); message(`Searching for “${term}”…`);
      const timeout = setTimeout(() => controller?.signal === signal && controller.abort(), 15000);
      try {
        const params = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', origin: '*',
          generator: 'search', gsrsearch: `${term} filetype:bitmap`, gsrnamespace: '6', gsrlimit: '20', gsroffset: String(offset || 0),
          prop: 'imageinfo', iiprop: 'url|mime|extmetadata', iiurlwidth: '960',
          iiextmetadatafilter: 'Artist|LicenseShortName', iiextmetadatalanguage: 'en' });
        const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
        if (!response.ok) throw new Error('Search unavailable');
        const data = await response.json();
        if (data.error) throw new Error('Search unavailable');
        if (request !== revision) return;
        const pages = Array.isArray(data.query?.pages) ? [...data.query.pages].sort((a,b) => (a.index || 0) - (b.index || 0)) : [];
        const found = pages.map(page => {
          const info = page.imageinfo?.[0];
          if (!info || !/^image\/(jpeg|png|gif|webp|avif)$/i.test(info.mime || '')) return null;
          return normalizeResult({ url: info.thumburl || info.url, sourceUrl: info.descriptionurl,
            title: String(page.title || '').replace(/^File:/, ''), creator: plainMetadata(info.extmetadata?.Artist?.value),
            license: plainMetadata(info.extmetadata?.LicenseShortName?.value) });
        }).filter(Boolean);
        const seen = new Set(items.map(item => item.sourceUrl));
        items.push(...found.filter(item => !seen.has(item.sourceUrl) && seen.add(item.sourceUrl)));
        items = items.slice(0, LIMIT);
        const next = data.continue?.gsroffset;
        nextOffset = Number.isInteger(next) && next > (offset || 0) ? next : null;
        render();
        message(items.length ? `${items.length} images · Drag onto the board or choose Add.` : 'No matching images. Try another search.');
        notifyBoardChanged('image-search-results');
      } catch {
        if (request !== revision) return;
        message('Image search is unavailable right now. Check your connection and try again.');
        if (!items.length) {
          results.querySelector('.image-search-empty strong').textContent = 'Couldn’t load images';
          results.querySelector('.image-search-empty p').textContent = 'Please try your search again.';
        }
      } finally {
        clearTimeout(timeout);
        if (request === revision) setBusy(false);
      }
    }
    form.addEventListener('submit', event => { event.preventDefault(); search(); });
    more.addEventListener('click', () => search(true));
    // Dropping back into the search panel must not create an image beneath it.
    m.addEventListener('dragover', event => { if ([...event.dataTransfer.types].includes(DRAG_TYPE)) { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'none'; } });
    m.addEventListener('drop', event => { if ([...event.dataTransfer.types].includes(DRAG_TYPE)) { event.preventDefault(); event.stopPropagation(); } });
    m._boardGetState = () => ({ query, items, nextOffset });
    m._boardSetState = state => {
      ++revision; cancelDrag?.(); controller?.abort(); setBusy(false);
      query = String(state?.query || '').slice(0, 120); input.value = query;
      items = (Array.isArray(state?.items) ? state.items.slice(0, LIMIT) : []).map(normalizeResult).filter(Boolean);
      nextOffset = Number.isInteger(state?.nextOffset) && state.nextOffset > 0 && state.nextOffset < 10000 ? state.nextOffset : null;
      render(); message(items.length ? `${items.length} saved results · Drag onto the board or choose Add.` : 'Search images from Wikimedia Commons.');
    };
    const prior = m._cleanup;
    m._cleanup = () => { ++revision; cancelDrag?.(); controller?.abort(); results.removeEventListener('wheel', captureResultsWheel); prior?.(); };
    render();
  }
  window.TeacherTilesImageSearch = Object.freeze({ setup, normalizeResult, readDrag, DRAG_TYPE });
})();
