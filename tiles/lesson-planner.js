(() => {
  const openButton = document.getElementById('profile-lesson-planner-button');
  const panel = document.getElementById('lesson-planner-panel');
  if (!openButton || !panel) return;

  const library = document.getElementById('lesson-planner-library');
  const libraryGrid = document.getElementById('lesson-planner-library-grid');
  const libraryLimit = document.getElementById('lesson-planner-library-limit');
  const libraryPlan = document.getElementById('lesson-planner-library-plan');
  const createPlannerButton = document.getElementById('lesson-planner-create');
  const plannerWindow = panel.querySelector('.lesson-planner-window');
  const plannerTitle = document.getElementById('lesson-planner-title');
  const schedulingButton = document.getElementById('lesson-planner-scheduling-button');
  const schedulingPanel = document.getElementById('lesson-planner-scheduling');
  const schedulingForm = document.getElementById('lesson-planner-schedule-form');
  const schedulingLabel = document.getElementById('lesson-planner-schedule-label');
  const schedulingStart = document.getElementById('lesson-planner-schedule-start');
  const schedulingEnd = document.getElementById('lesson-planner-schedule-end');
  const schedulingRepeat = document.getElementById('lesson-planner-schedule-repeat');
  const schedulingWeekdayWrap = document.getElementById('lesson-planner-schedule-weekday-wrap');
  const schedulingWeekday = document.getElementById('lesson-planner-schedule-weekday');
  const schedulingColors = document.getElementById('lesson-planner-schedule-colors');
  const schedulingList = document.getElementById('lesson-planner-schedule-list');
  const schedulingCount = document.getElementById('lesson-planner-schedule-count');
  const schedulingCancel = document.getElementById('lesson-planner-schedule-cancel');
  const canvas = document.getElementById('lesson-planner-canvas');
  const editor = document.getElementById('lesson-planner-editor');
  const form = document.getElementById('lesson-planner-form');
  const labelInput = document.getElementById('lesson-planner-label');
  const dateInput = document.getElementById('lesson-planner-date');
  const startInput = document.getElementById('lesson-planner-start');
  const endInput = document.getElementById('lesson-planner-end');
  const descriptionInput = document.getElementById('lesson-planner-description');
  const descriptionCount = document.getElementById('lesson-planner-description-count');
  const deleteButton = document.getElementById('lesson-planner-delete');
  const duplicateButton = document.getElementById('lesson-planner-duplicate');
  const colorsElement = document.getElementById('lesson-planner-colors');
  const rangeTitle = document.getElementById('lesson-planner-range-title');
  const rangeKicker = document.getElementById('lesson-planner-range-kicker');
  const focusWeekday = document.getElementById('lesson-planner-focus-weekday');
  const focusDay = document.getElementById('lesson-planner-focus-day');
  const focusMonth = document.getElementById('lesson-planner-focus-month');
  const agendaList = document.getElementById('lesson-planner-agenda-list');
  const agendaCount = document.getElementById('lesson-planner-agenda-count');
  const zoomInput = document.getElementById('lesson-planner-zoom');
  const viewTabs = [...document.querySelectorAll('[data-planner-view]')];
  const LEGACY_STORAGE_KEY = 'teachertiles-lesson-planner-v1';
  const PLANNERS_STORAGE_KEY = 'teachertiles-lesson-planners-v2';
  const ACTIVE_PLANNER_KEY = 'teachertiles-active-lesson-planner-v2';
  const FREE_PLANNER_LIMIT = 2;
  const PAID_PLANNER_LIMIT = 10;
  const VIEWS = ['day', 'week', 'month', 'year'];
  const DAY_START = 6 * 60;
  const DAY_END = 20 * 60;
  const COLORS = [
    { id: 'sun', name: 'Sunshine', value: '#f3bd3d', ink: '#563b00' },
    { id: 'sky', name: 'Sky', value: '#5ca7e8', ink: '#0c355a' },
    { id: 'mint', name: 'Mint', value: '#61bf9a', ink: '#0b4433' },
    { id: 'coral', name: 'Coral', value: '#ee7b68', ink: '#5b1e18' },
    { id: 'grape', name: 'Grape', value: '#a883dc', ink: '#352050' },
    { id: 'rose', name: 'Rose', value: '#dc79a6', ink: '#561b36' },
    { id: 'ocean', name: 'Ocean', value: '#397db9', ink: '#f4fbff' },
    { id: 'slate', name: 'Slate', value: '#718096', ink: '#ffffff' }
  ];
  const monthLong = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
  const dayTitle = new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  const weekdayLong = new Intl.DateTimeFormat(undefined, { weekday: 'long' });
  const monthDay = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
  const fullDate = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  let planners = readPlanners();
  let activePlannerId = readActivePlannerId();
  if (activePlannerId && !planners.some(planner => planner.id === activePlannerId)) activePlannerId = '';
  if (!activePlannerId && planners.length) activePlannerId = planners[0].id;
  let blocks = readBlocks();
  if (!localStorage.getItem(PLANNERS_STORAGE_KEY) && planners.length) savePlanners();
  let currentDate = atNoon(new Date());
  let selectedDate = atNoon(new Date());
  let view = 'week';
  let editingId = '';
  let editorColor = COLORS[0].id;
  let editingScheduleId = '';
  let scheduleEditorColor = COLORS[0].id;

  panel.remove();
  document.body.appendChild(panel);

  function atNoon(date) {
    const next = new Date(date);
    next.setHours(12, 0, 0, 0);
    return next;
  }

  function dateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function fromDateKey(value) {
    const [year, month, day] = String(value || '').split('-').map(Number);
    return atNoon(new Date(year || 2000, Math.max(0, (month || 1) - 1), day || 1));
  }

  function addDays(date, amount) {
    const next = atNoon(date);
    next.setDate(next.getDate() + amount);
    return next;
  }

  function addMonths(date, amount) {
    const next = atNoon(date);
    next.setDate(1);
    next.setMonth(next.getMonth() + amount);
    return next;
  }

  function startOfWeek(date) {
    const day = date.getDay();
    return addDays(date, day === 0 ? -6 : 1 - day);
  }

  function minutes(value) {
    const [hours, mins] = String(value || '00:00').split(':').map(Number);
    return (hours || 0) * 60 + (mins || 0);
  }

  function timeValue(total) {
    const safe = Math.max(0, Math.min(1439, Math.round(total / 15) * 15));
    return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
  }

  function timeLabel(value) {
    const total = minutes(value);
    const hour = Math.floor(total / 60);
    const mins = total % 60;
    return `${hour % 12 || 12}:${String(mins).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
  }

  function blockColor(id) {
    return COLORS.find(color => color.id === id) || COLORS[0];
  }

  function normalizeBlock(block) {
    if (!block || typeof block !== 'object' || !/^\d{4}-\d{2}-\d{2}$/.test(block.date || '')) return null;
    const start = /^\d{2}:\d{2}$/.test(block.start || '') ? block.start : '08:00';
    let end = /^\d{2}:\d{2}$/.test(block.end || '') ? block.end : '09:00';
    if (minutes(end) <= minutes(start)) end = timeValue(minutes(start) + 60);
    return {
      id: String(block.id || `lesson-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      label: String(block.label || 'Untitled lesson').slice(0, 80),
      date: block.date,
      start,
      end,
      color: COLORS.some(color => color.id === block.color) ? block.color : COLORS[0].id,
      description: String(block.description || '').slice(0, 4000),
      scheduleId: String(block.scheduleId || '').slice(0, 80)
    };
  }

  function cleanPlannerName(value, fallback = 'Untitled Planner') {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 60) || fallback;
  }

  function plannerId() {
    return `planner-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function scheduleId() {
    return `schedule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function normalizeScheduleItem(item, index = 0) {
    if (!item || typeof item !== 'object') return null;
    const start = /^\d{2}:\d{2}$/.test(item.start || '') ? item.start : '08:00';
    let end = /^\d{2}:\d{2}$/.test(item.end || '') ? item.end : '09:00';
    if (minutes(end) <= minutes(start)) end = timeValue(minutes(start) + 60);
    const repeat = item.repeat === 'weekly' ? 'weekly' : 'daily';
    const rawWeekday = Number(item.weekday);
    const weekday = Number.isInteger(rawWeekday) ? Math.max(0, Math.min(6, rawWeekday)) : 1;
    return {
      id: String(item.id || scheduleId()),
      label: String(item.label || `Schedule block ${index + 1}`).replace(/\s+/g, ' ').trim().slice(0, 80),
      start,
      end,
      repeat,
      weekday,
      color: COLORS.some(color => color.id === item.color) ? item.color : COLORS[index % COLORS.length].id
    };
  }

  function normalizePlanner(planner, index = 0) {
    if (!planner || typeof planner !== 'object') return null;
    const plannerBlocks = Array.isArray(planner.blocks) ? planner.blocks.map(normalizeBlock).filter(Boolean).slice(0, 2500) : [];
    const plannerSchedule = Array.isArray(planner.schedule) ? planner.schedule.map(normalizeScheduleItem).filter(Boolean).slice(0, 120) : [];
    return {
      id: String(planner.id || plannerId()),
      name: cleanPlannerName(planner.name, `Planner ${index + 1}`),
      color: COLORS.some(color => color.id === planner.color) ? planner.color : COLORS[index % COLORS.length].id,
      blocks: plannerBlocks,
      schedule: plannerSchedule
    };
  }

  function readLegacyBlocks() {
    try {
      const parsed = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.map(normalizeBlock).filter(Boolean).slice(0, 2500) : [];
    } catch {
      return [];
    }
  }

  function readPlanners() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PLANNERS_STORAGE_KEY) || 'null');
      if (Array.isArray(parsed)) return parsed.map(normalizePlanner).filter(Boolean).slice(0, PAID_PLANNER_LIMIT);
    } catch {}
    const legacy = readLegacyBlocks();
    return legacy.length ? [{ id: 'planner-migrated-default', name: 'My Planner', color: COLORS[0].id, blocks: legacy, schedule: [] }] : [];
  }

  function readActivePlannerId() {
    try { return String(localStorage.getItem(ACTIVE_PLANNER_KEY) || ''); } catch { return ''; }
  }

  function activePlanner() {
    return planners.find(planner => planner.id === activePlannerId) || null;
  }

  function hasPlannerSubscription() {
    const accountState = window.TeacherTilesAccount?.state;
    return Boolean(accountState?.subscriptionActive || window.TeacherTilesSandbox?.subscriptionEnabled);
  }

  function plannerLimit() {
    return hasPlannerSubscription() ? PAID_PLANNER_LIMIT : FREE_PLANNER_LIMIT;
  }

  function savePlanners() {
    try {
      localStorage.setItem(PLANNERS_STORAGE_KEY, JSON.stringify(planners));
      if (activePlannerId) localStorage.setItem(ACTIVE_PLANNER_KEY, activePlannerId);
      else localStorage.removeItem(ACTIVE_PLANNER_KEY);
    } catch {}
  }

  function readBlocks() {
    const planner = activePlanner();
    return planner ? planner.blocks.map(block => ({ ...block })) : [];
  }

  function publishPlannerChange() {
    const snapshot = blocks.map(block => ({ ...block }));
    const planner = activePlanner();
    window.TeacherTilesRefreshLessonPlannerTiles?.(snapshot);
    window.dispatchEvent(new CustomEvent('teachertiles:lessonplannerchange', {
      detail: { blocks: snapshot, plannerId: planner?.id || '', plannerName: planner?.name || '' }
    }));
  }

  function saveBlocks() {
    blocks.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
    const planner = activePlanner();
    if (planner) planner.blocks = blocks.map(block => ({ ...block }));
    savePlanners();
    try { localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(blocks)); } catch {}
    publishPlannerChange();
  }

  function blocksForDate(date) {
    const key = typeof date === 'string' ? date : dateKey(date);
    return blocks.filter(block => block.date === key).sort((a, b) => a.start.localeCompare(b.start));
  }

  function scheduleForDate(date) {
    const target = typeof date === 'string' ? fromDateKey(date) : atNoon(date);
    const planner = activePlanner();
    const schedule = Array.isArray(planner?.schedule) ? planner.schedule : [];
    const weekday = target.getDay();
    return schedule.filter(item => item.repeat === 'weekly' ? item.weekday === weekday : weekday >= 1 && weekday <= 5)
      .slice().sort((a, b) => a.start.localeCompare(b.start));
  }

  function scheduleIsPlanned(item, date) {
    const key = typeof date === 'string' ? date : dateKey(date);
    return blocks.some(block => block.date === key && block.scheduleId === item.id);
  }

  function unplannedScheduleForDate(date) {
    return scheduleForDate(date).filter(item => !scheduleIsPlanned(item, date));
  }

  function scheduleRepeatLabel(item) {
    if (item.repeat === 'weekly') return `Every ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][item.weekday]}`;
    return 'Every weekday';
  }

  function make(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }


  function plannerColor(planner) {
    return COLORS.find(color => color.id === planner?.color) || COLORS[0];
  }

  function renderLibrary() {
    if (!libraryGrid) return;
    const limit = plannerLimit();
    const paid = hasPlannerSubscription();
    libraryLimit.textContent = `${planners.length} / ${limit}`;
    libraryLimit.title = `${planners.length} of ${limit} planners used`;
    libraryPlan.textContent = paid ? 'SUPPORTER · UP TO 10 PLANNERS' : 'FREE · UP TO 2 PLANNERS';
    libraryPlan.classList.toggle('is-subscriber', paid);
    createPlannerButton.disabled = planners.length >= limit;
    createPlannerButton.setAttribute('aria-disabled', String(createPlannerButton.disabled));
    createPlannerButton.title = createPlannerButton.disabled ? `Planner limit reached (${limit})` : 'Create planner';
    libraryGrid.replaceChildren();

    if (!planners.length) {
      const empty = make('section', 'planner-library-empty');
      empty.innerHTML = '<span aria-hidden="true">＋</span><h3>Create your first planner</h3><p>Make a separate lesson-planning book for a class, subject, or school year.</p>';
      const add = make('button', 'planner-library-empty__create', 'Create planner');
      add.type = 'button';
      add.addEventListener('click', () => createPlannerButton.click());
      empty.append(add);
      libraryGrid.append(empty);
      return;
    }

    planners.forEach(planner => {
      const color = plannerColor(planner);
      const card = make('article', 'planner-book-card');
      card.dataset.plannerId = planner.id;
      card.style.setProperty('--planner-book-color', color.value);
      card.style.setProperty('--planner-book-ink', color.ink);

      const open = make('div', 'planner-book-open');
      open.setAttribute('role', 'button');
      open.tabIndex = 0;
      open.setAttribute('aria-label', `Open ${planner.name}`);
      open.innerHTML = '<span class="planner-book-art" aria-hidden="true"><i></i><b></b><em></em></span><span class="planner-book-copy"><small>LESSON PLANNER</small><strong title="Double-click to rename"></strong><em></em></span>';
      const name = open.querySelector('strong');
      name.textContent = planner.name;
      const count = planner.blocks.length;
      open.querySelector('.planner-book-copy>em').textContent = `${count} ${count === 1 ? 'lesson block' : 'lesson blocks'}`;
      open.addEventListener('click', event => {
        if (event.target.closest('.planner-book-copy strong,.planner-book-name-input')) return;
        openPlannerBook(planner.id);
      });
      open.addEventListener('keydown', event => {
        if (event.target !== open || !['Enter', ' '].includes(event.key)) return;
        event.preventDefault();
        openPlannerBook(planner.id);
      });
      name.addEventListener('dblclick', event => {
        event.preventDefault();
        event.stopPropagation();
        beginPlannerRename(card, planner);
      });

      const customize = make('button', 'planner-book-tool-button planner-book-customize');
      customize.type = 'button';
      customize.title = 'Planner color';
      customize.setAttribute('aria-label', `Change ${planner.name} color`);
      customize.setAttribute('aria-expanded', 'false');
      const brush = document.querySelector('#customize-toggle svg');
      if (brush) customize.appendChild(brush.cloneNode(true));
      else customize.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.7 3.9a1.5 1.5 0 0 1 2.1 2.1l-8.2 8.2-2.8-2.8 8.9-7.5Z"/><path d="M8.8 12.4c-1.9 0-3.4 1.5-3.4 3.4 0 1.4-.7 2.6-2.1 3.5 1.2.7 2.7 1.1 4.2 1.1 3.2 0 5.4-1.8 5.4-4.4 0-1.9-1.8-3.6-4.1-3.6Z"/></svg>';

      const colorPanel = make('div', 'planner-book-popover planner-book-color-panel');
      colorPanel.hidden = true;
      const colors = make('div', 'planner-book-colors');
      colors.setAttribute('aria-label', `${planner.name} color`);
      COLORS.forEach(option => {
        const swatch = make('button', 'planner-book-color');
        swatch.type = 'button';
        swatch.title = option.name;
        swatch.setAttribute('aria-label', `Use ${option.name} for ${planner.name}`);
        swatch.setAttribute('aria-pressed', String(option.id === planner.color));
        swatch.classList.toggle('is-selected', option.id === planner.color);
        swatch.style.setProperty('--planner-swatch', option.value);
        swatch.addEventListener('click', event => {
          event.stopPropagation();
          planner.color = option.id;
          savePlanners();
          renderLibrary();
        });
        colors.append(swatch);
      });
      colorPanel.append(colors);

      const settings = make('button', 'planner-book-tool-button planner-book-settings');
      settings.type = 'button';
      settings.title = 'Planner settings';
      settings.setAttribute('aria-label', `Open ${planner.name} settings`);
      settings.setAttribute('aria-expanded', 'false');
      settings.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m9 3-.6 3-2 1-2.8-1-2 3.5 2.2 2v2L1.6 16l2 3.5 2.8-1 2 1L9 22h4l.6-2.5 2-1 2.8 1 2-3.5-2.2-2.5v-2l2.2-2-2-3.5-2.8 1-2-1L13 3Z"/><circle cx="11" cy="12.5" r="3"/></svg>';

      const settingsPanel = make('div', 'planner-book-popover planner-book-settings-panel');
      settingsPanel.hidden = true;
      const actions = make('div', 'planner-book-actions');
      const collaborate = make('button', 'planner-library-collaborate', 'Collaborate');
      collaborate.type = 'button';
      collaborate.dataset.comingSoon = 'Coming soon';
      collaborate.setAttribute('aria-label', 'Collaborate — coming soon');
      collaborate.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); });
      const remove = make('button', 'planner-library-delete', 'Delete');
      remove.type = 'button';
      remove.addEventListener('click', event => {
        event.stopPropagation();
        if (!confirm(`Delete “${planner.name}” and all of its lesson blocks?`)) return;
        planners = planners.filter(item => item.id !== planner.id);
        if (activePlannerId === planner.id) activePlannerId = planners[0]?.id || '';
        blocks = readBlocks();
        savePlanners();
        try { localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(blocks)); } catch {}
        publishPlannerChange();
        renderLibrary();
      });
      actions.append(collaborate, remove);
      settingsPanel.append(actions);

      const closeBookPopovers = () => {
        libraryGrid.querySelectorAll('.planner-book-popover:not([hidden])').forEach(panel => { panel.hidden = true; });
        libraryGrid.querySelectorAll('.planner-book-tool-button[aria-expanded="true"]').forEach(button => button.setAttribute('aria-expanded', 'false'));
      };
      const toggleBookPopover = (event, button, popover) => {
        event.preventDefault();
        event.stopPropagation();
        const shouldOpen = popover.hidden;
        closeBookPopovers();
        if (shouldOpen) {
          popover.hidden = false;
          button.setAttribute('aria-expanded', 'true');
        }
      };
      customize.addEventListener('click', event => toggleBookPopover(event, customize, colorPanel));
      settings.addEventListener('click', event => toggleBookPopover(event, settings, settingsPanel));
      card.append(open, customize, settings, colorPanel, settingsPanel);
      libraryGrid.append(card);
    });
  }

  function beginPlannerRename(card, planner) {
    const title = card.querySelector('.planner-book-copy strong');
    if (!title || card.querySelector('.planner-book-name-input')) return;
    const input = make('input', 'planner-book-name-input');
    input.type = 'text';
    input.maxLength = 60;
    input.value = planner.name;
    title.replaceWith(input);
    input.addEventListener('pointerdown', event => event.stopPropagation());
    input.addEventListener('click', event => event.stopPropagation());
    input.addEventListener('dblclick', event => event.stopPropagation());
    input.focus({ preventScroll: true });
    input.select();
    let done = false;
    const finish = cancel => {
      if (done) return;
      done = true;
      if (!cancel) planner.name = cleanPlannerName(input.value, planner.name);
      savePlanners();
      publishPlannerChange();
      renderLibrary();
    };
    input.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.key === 'Enter') { event.preventDefault(); finish(false); }
      if (event.key === 'Escape') { event.preventDefault(); finish(true); }
    });
    input.addEventListener('blur', () => finish(false), { once: true });
  }

  function createPlanner() {
    const limit = plannerLimit();
    if (planners.length >= limit) { renderLibrary(); return; }
    const planner = {
      id: plannerId(),
      name: `Planner ${planners.length + 1}`,
      color: COLORS[planners.length % COLORS.length].id,
      blocks: [],
      schedule: []
    };
    planners.push(planner);
    activePlannerId = planner.id;
    savePlanners();
    renderLibrary();
    requestAnimationFrame(() => {
      const card = libraryGrid.querySelector(`[data-planner-id="${CSS.escape(planner.id)}"]`);
      if (card) beginPlannerRename(card, planner);
    });
  }

  function showPlannerLibrary({ focus = true } = {}) {
    cancelLessonDrag?.();
    closeEditor();
    closeScheduling();
    plannerWindow.hidden = true;
    plannerWindow.setAttribute('aria-hidden', 'true');
    library.hidden = false;
    library.setAttribute('aria-hidden', 'false');
    renderLibrary();
    if (focus) requestAnimationFrame(() => (libraryGrid.querySelector('.planner-book-open') || createPlannerButton)?.focus({ preventScroll: true }));
  }

  function openPlannerBook(id) {
    const planner = planners.find(item => item.id === id);
    if (!planner) { showPlannerLibrary(); return; }
    activePlannerId = planner.id;
    closeScheduling();
    blocks = planner.blocks.map(block => ({ ...block }));
    savePlanners();
    try { localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(blocks)); } catch {}
    plannerTitle.textContent = planner.name;
    library.hidden = true;
    library.setAttribute('aria-hidden', 'true');
    plannerWindow.hidden = false;
    plannerWindow.setAttribute('aria-hidden', 'false');
    currentDate = atNoon(new Date());
    selectedDate = atNoon(new Date());
    renderAll();
    publishPlannerChange();
    requestAnimationFrame(() => document.getElementById('lesson-planner-new')?.focus({ preventScroll: true }));
  }

  function renderScheduleColors() {
    schedulingColors.replaceChildren();
    COLORS.forEach(color => {
      const button = make('button', 'lesson-planner-color');
      button.type = 'button';
      button.style.setProperty('--lesson-color', color.value);
      button.title = color.name;
      button.setAttribute('aria-label', `${color.name} schedule color`);
      button.setAttribute('aria-pressed', String(color.id === scheduleEditorColor));
      button.classList.toggle('is-selected', color.id === scheduleEditorColor);
      button.addEventListener('click', () => { scheduleEditorColor = color.id; renderScheduleColors(); });
      schedulingColors.append(button);
    });
  }

  function syncScheduleRepeatUi() {
    schedulingWeekdayWrap.hidden = schedulingRepeat.value !== 'weekly';
  }

  function resetScheduleForm() {
    editingScheduleId = '';
    schedulingForm.reset();
    schedulingStart.value = '08:00';
    schedulingEnd.value = '09:00';
    schedulingRepeat.value = 'daily';
    schedulingWeekday.value = '1';
    scheduleEditorColor = COLORS[0].id;
    schedulingCancel.hidden = true;
    schedulingForm.querySelector('.lesson-planner-schedule-save').textContent = 'Add schedule block';
    syncScheduleRepeatUi();
    renderScheduleColors();
  }

  function renderSchedulingList() {
    const schedule = activePlanner()?.schedule || [];
    schedulingCount.textContent = `${schedule.length} ${schedule.length === 1 ? 'block' : 'blocks'}`;
    schedulingList.replaceChildren();
    if (!schedule.length) {
      const empty = make('div', 'lesson-planner-schedule-list__empty');
      empty.innerHTML = '<span aria-hidden="true">＋</span><strong>No schedule blocks yet</strong><small>Add a recurring time block on the left.</small>';
      schedulingList.append(empty);
      return;
    }
    schedule.slice().sort((a,b)=>a.start.localeCompare(b.start)).forEach(item => {
      const color = blockColor(item.color);
      const row = make('article', 'lesson-planner-schedule-item');
      row.style.setProperty('--lesson-color', color.value);
      row.innerHTML = '<i aria-hidden="true"></i><div><strong></strong><span></span><small></small></div><div class="lesson-planner-schedule-item__actions"></div>';
      row.querySelector('strong').textContent = item.label;
      row.querySelector('span').textContent = `${timeLabel(item.start)}–${timeLabel(item.end)}`;
      row.querySelector('small').textContent = scheduleRepeatLabel(item);
      const actions = row.querySelector('.lesson-planner-schedule-item__actions');
      const edit = make('button', '', 'Edit'); edit.type='button';
      const remove = make('button', 'is-delete', 'Delete'); remove.type='button';
      edit.addEventListener('click', () => {
        editingScheduleId = item.id;
        schedulingLabel.value = item.label;
        schedulingStart.value = item.start;
        schedulingEnd.value = item.end;
        schedulingRepeat.value = item.repeat;
        schedulingWeekday.value = String(item.weekday);
        scheduleEditorColor = item.color;
        schedulingCancel.hidden = false;
        schedulingForm.querySelector('.lesson-planner-schedule-save').textContent = 'Save changes';
        syncScheduleRepeatUi(); renderScheduleColors(); schedulingLabel.focus({preventScroll:true}); schedulingLabel.select();
      });
      remove.addEventListener('click', () => {
        const planner = activePlanner(); if (!planner) return;
        planner.schedule = planner.schedule.filter(scheduleItem => scheduleItem.id !== item.id);
        if (editingScheduleId === item.id) resetScheduleForm();
        savePlanners(); publishPlannerChange(); renderSchedulingList(); renderAll();
      });
      actions.append(edit, remove); row.append(actions); schedulingList.append(row);
    });
  }

  function openScheduling() {
    if (!activePlanner()) return;
    resetScheduleForm();
    renderSchedulingList();
    schedulingPanel.hidden = false;
    schedulingPanel.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => schedulingLabel.focus({ preventScroll: true }));
  }

  function closeScheduling() {
    schedulingPanel.hidden = true;
    schedulingPanel.setAttribute('aria-hidden', 'true');
    editingScheduleId = '';
  }

  function schedulePlaceholder(item, date, compact = false) {
    const color = blockColor(item.color);
    const element = make('button', compact ? 'lesson-calendar-chip lesson-calendar-chip--schedule' : 'lesson-schedule-template');
    element.type = 'button';
    element.style.setProperty('--lesson-color', color.value);
    element.style.setProperty('--lesson-ink', color.ink);
    element.title = `${item.label} · ${timeLabel(item.start)}–${timeLabel(item.end)} · Add plans`;
    if (compact) {
      element.innerHTML = '<i aria-hidden="true"></i><span></span>';
      element.querySelector('span').textContent = item.label;
    } else {
      element.innerHTML = '<strong></strong><small></small><em>Add plans</em>';
      element.querySelector('strong').textContent = item.label;
      element.querySelector('small').textContent = `${timeLabel(item.start)}–${timeLabel(item.end)}`;
    }
    element.addEventListener('click', event => {
      event.stopPropagation();
      selectedDate = typeof date === 'string' ? fromDateKey(date) : atNoon(date);
      openEditor(null, { date: dateKey(selectedDate), start: item.start, end: item.end, label: item.label, color: item.color, scheduleId: item.id });
    });
    return element;
  }

  function updateHeader() {
    const selectedKey = dateKey(selectedDate);
    focusWeekday.textContent = dateKey(new Date()) === selectedKey ? 'TODAY' : weekdayLong.format(selectedDate).toUpperCase();
    focusDay.textContent = String(selectedDate.getDate());
    focusMonth.textContent = monthLong.format(selectedDate);
    viewTabs.forEach(button => {
      const active = button.dataset.plannerView === view;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });
    zoomInput.value = String(VIEWS.indexOf(view));
    if (view === 'day') {
      rangeKicker.textContent = weekdayLong.format(currentDate).toUpperCase();
      rangeTitle.textContent = dayTitle.format(currentDate);
    } else if (view === 'week') {
      const first = startOfWeek(currentDate);
      const last = addDays(first, 6);
      rangeKicker.textContent = 'WEEK VIEW';
      rangeTitle.textContent = first.getMonth() === last.getMonth()
        ? `${monthDay.format(first)}–${last.getDate()}, ${last.getFullYear()}`
        : `${monthDay.format(first)} – ${monthDay.format(last)}, ${last.getFullYear()}`;
    } else if (view === 'month') {
      rangeKicker.textContent = 'MONTH VIEW';
      rangeTitle.textContent = monthLong.format(currentDate);
    } else {
      rangeKicker.textContent = 'YEAR AT A GLANCE';
      rangeTitle.textContent = String(currentDate.getFullYear());
    }
  }

  function renderAgenda() {
    const dayBlocks = blocksForDate(selectedDate);
    const scheduleSlots = unplannedScheduleForDate(selectedDate);
    const total = dayBlocks.length + scheduleSlots.length;
    agendaCount.textContent = `${total} ${total === 1 ? 'block' : 'blocks'}`;
    agendaList.replaceChildren();
    if (!total) {
      const empty = make('div', 'lesson-planner-agenda__empty');
      empty.innerHTML = '<span aria-hidden="true">✎</span><strong>Open space</strong><small>Add a lesson block for this day.</small>';
      agendaList.append(empty);
      return;
    }
    const entries=[...dayBlocks.map(block=>({type:'block',start:block.start,value:block})),...scheduleSlots.map(item=>({type:'schedule',start:item.start,value:item}))].sort((a,b)=>a.start.localeCompare(b.start));
    entries.forEach(entry=>{
      if(entry.type==='schedule'){
        const item=entry.value,color=blockColor(item.color),button=make('button','lesson-planner-agenda-item lesson-planner-agenda-item--schedule');
        button.type='button';button.style.setProperty('--lesson-color',color.value);button.style.setProperty('--lesson-ink',color.ink);
        button.innerHTML='<i aria-hidden="true"></i><span><strong></strong><small></small></span><em>Add plans</em>';
        button.querySelector('strong').textContent=item.label;button.querySelector('small').textContent=`${timeLabel(item.start)}–${timeLabel(item.end)}`;
        button.addEventListener('click',()=>openEditor(null,{date:dateKey(selectedDate),start:item.start,end:item.end,label:item.label,color:item.color,scheduleId:item.id}));agendaList.append(button);return;
      }
      const block=entry.value,color=blockColor(block.color),button=make('div','lesson-planner-agenda-item');
      button.type='button';button.style.setProperty('--lesson-color',color.value);button.style.setProperty('--lesson-ink',color.ink);button.innerHTML='<i aria-hidden="true"></i><span><strong></strong><small></small></span>';
      button.querySelector('strong').textContent=block.label;button.querySelector('small').textContent=`${timeLabel(block.start)}–${timeLabel(block.end)}`;attachLessonDrag(button,block);button.addEventListener('click',()=>openEditor(block));agendaList.append(button);
    });
  }

  let cancelLessonDrag=null,suppressLessonClickUntil=0;
  panel.addEventListener('click',event=>{if(performance.now()<suppressLessonClickUntil){event.preventDefault();event.stopImmediatePropagation()}},true);
  function attachLessonDrag(button,block){
    button.dataset.lessonBlock=block.id;
    button.setAttribute('role','button');button.tabIndex=0;
    button.setAttribute('aria-label',`Edit ${block.label}`);
    button.addEventListener('keydown',event=>{
      if(event.target===button&&(event.key==='Enter'||event.key===' ')){
        event.preventDefault();button.click();
      }
    });
    const remove=make('button','lesson-block-delete','×');remove.type='button';
    remove.title=`Delete ${block.label}`;remove.setAttribute('aria-label',remove.title);
    remove.addEventListener('pointerdown',event=>event.stopPropagation());
    remove.addEventListener('dblclick',event=>event.stopPropagation());
    remove.addEventListener('click',event=>{
      event.preventDefault();event.stopPropagation();
      cancelLessonDrag?.();
      const scrollTop=canvas.scrollTop,scrollLeft=canvas.scrollLeft;
      blocks=blocks.filter(item=>item.id!==block.id);
      saveBlocks();renderAll();canvas.scrollTop=scrollTop;canvas.scrollLeft=scrollLeft;
    });
    button.appendChild(remove);
    button.addEventListener('pointerdown',event=>{
      if(event.button!==0)return;
      cancelLessonDrag?.();
      const originX=event.clientX,originY=event.clientY,duration=minutes(block.end)-minutes(block.start);
      const sourceColumn=button.closest('.lesson-planner-day-column');
      const sourceRect=sourceColumn?.getBoundingClientRect();
      const offset=sourceRect?DAY_START+(originY-sourceRect.top)/sourceRect.height*(DAY_END-DAY_START)-minutes(block.start):0;
      let x=originX,y=originY,dragging=false,ghost=null,target=null,placement=null,placeholder=null,raf=0;
      const clearTarget=()=>{target?.classList.remove('is-lesson-drop-target');target=null;placement=null;placeholder?.remove();placeholder=null};
      const update=()=>{
        if(!dragging)return;
        const bounds=canvas.getBoundingClientRect();
        if(x>=bounds.left&&x<=bounds.right&&y>=bounds.top&&y<=bounds.bottom){
          if(y<bounds.top+40)canvas.scrollTop-=12;else if(y>bounds.bottom-40)canvas.scrollTop+=12;
          if(x<bounds.left+30)canvas.scrollLeft-=10;else if(x>bounds.right-30)canvas.scrollLeft+=10;
        }
        ghost.style.left=`${x+14}px`;ghost.style.top=`${y+14}px`;
        clearTarget();
        const hit=document.elementFromPoint(x,y)?.closest('[data-lesson-drop-date]');
        if(hit&&canvas.contains(hit)){
          target=hit;target.classList.add('is-lesson-drop-target');
          let start=minutes(block.start);
          if(hit.classList.contains('lesson-planner-day-column')){
            const rect=hit.getBoundingClientRect();
            start=Math.round((DAY_START+(y-rect.top)/rect.height*(DAY_END-DAY_START)-offset)/15)*15;
            start=Math.max(0,Math.min(1439-duration,start));
          }
          const exactTime=total=>`${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
          placement={date:hit.dataset.lessonDropDate,start:exactTime(start),end:exactTime(start+duration)};
          placeholder=make('div','lesson-planner-drop-placeholder');
          placeholder.setAttribute('aria-hidden','true');
          placeholder.textContent=`${block.label} · ${timeLabel(placement.start)}–${timeLabel(placement.end)}`;
          if(hit.classList.contains('lesson-planner-day-column')){
            const visibleStart=Math.max(DAY_START,start),visibleEnd=Math.min(DAY_END,start+duration);
            placeholder.style.top=`${(visibleStart-DAY_START)/(DAY_END-DAY_START)*100}%`;
            placeholder.style.height=`${Math.max(0,visibleEnd-visibleStart)/(DAY_END-DAY_START)*100}%`;
            placeholder.style.minHeight='52px';
          }
          hit.appendChild(placeholder);
          ghost.textContent=`${block.label} · ${monthDay.format(fromDateKey(placement.date))} · ${timeLabel(placement.start)}–${timeLabel(placement.end)}`;
        }else ghost.textContent=`${block.label} · Drop on a day or time`;
        raf=requestAnimationFrame(update);
      };
      const cleanup=()=>{
        cancelAnimationFrame(raf);clearTarget();ghost?.remove();button.classList.remove('is-lesson-dragging');
        window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',finish);window.removeEventListener('pointercancel',cancel);window.removeEventListener('blur',cancel);window.removeEventListener('keydown',key);
        if(button.hasPointerCapture(event.pointerId))button.releasePointerCapture(event.pointerId);
        cancelLessonDrag=null;
      };
      const cancel=()=>{if(dragging)suppressLessonClickUntil=performance.now()+250;cleanup()};
      const key=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();cancel()}};
      const move=e=>{
        if(e.pointerId!==event.pointerId)return;x=e.clientX;y=e.clientY;
        if(!dragging&&Math.hypot(x-originX,y-originY)>=6){
          dragging=true;button.setPointerCapture(event.pointerId);button.classList.add('is-lesson-dragging');
          ghost=make('div','lesson-planner-drag-preview');ghost.setAttribute('aria-hidden','true');document.body.appendChild(ghost);update();
        }
        if(dragging)e.preventDefault();
      };
      const finish=e=>{
        if(e.pointerId!==event.pointerId)return;
        if(!dragging){cleanup();return}
        x=e.clientX;y=e.clientY;cancelAnimationFrame(raf);update();
        const next=placement;const scrollTop=canvas.scrollTop,scrollLeft=canvas.scrollLeft;
        suppressLessonClickUntil=performance.now()+250;cleanup();
        if(!next||!blocks.includes(block))return;
        if(next.date===block.date&&next.start===block.start)return;
        Object.assign(block,next);selectedDate=fromDateKey(next.date);saveBlocks();renderAll();canvas.scrollTop=scrollTop;canvas.scrollLeft=scrollLeft;
      };
      cancelLessonDrag=cancel;
      window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',finish);window.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel);window.addEventListener('keydown',key);
    });
  }

  function lessonBlockButton(block, compact = false) {
    const color = blockColor(block.color);
    const button = make('div', compact ? 'lesson-calendar-chip' : 'lesson-schedule-block');
    button.type = 'button';
    button.style.setProperty('--lesson-color', color.value);
    button.style.setProperty('--lesson-ink', color.ink);
    button.title = `${block.label} · ${timeLabel(block.start)}–${timeLabel(block.end)}`;
    if (compact) {
      button.innerHTML = '<i aria-hidden="true"></i><span></span>';
      button.querySelector('span').textContent = block.label;
    } else {
      button.innerHTML = '<strong></strong><small></small><p></p>';
      button.querySelector('strong').textContent = block.label;
      button.querySelector('small').textContent = `${timeLabel(block.start)}–${timeLabel(block.end)}`;
      button.querySelector('p').textContent = block.description;
    }
    attachLessonDrag(button,block);
    button.addEventListener('click', event => { event.stopPropagation(); openEditor(block); });
    return button;
  }

  function renderSchedule(dates) {
    const schedule = make('section', `lesson-planner-schedule lesson-planner-schedule--${dates.length === 1 ? 'day' : 'week'}`);
    const head = make('header', 'lesson-planner-schedule__head');
    head.style.setProperty('--planner-days', dates.length);
    head.append(make('span', 'lesson-planner-time-corner', 'TIME'));
    dates.forEach(date => {
      const button = make('button', 'lesson-planner-day-heading');
      button.type = 'button';
      button.classList.toggle('is-today', dateKey(date) === dateKey(new Date()));
      button.classList.toggle('is-selected', dateKey(date) === dateKey(selectedDate));
      button.innerHTML = '<span></span><strong></strong>';
      button.querySelector('span').textContent = weekdayLong.format(date).slice(0, 3).toUpperCase();
      button.querySelector('strong').textContent = String(date.getDate());
      button.addEventListener('click', () => { selectedDate = atNoon(date); renderAll(); });
      head.append(button);
    });
    const body = make('div', 'lesson-planner-schedule__body');
    body.style.setProperty('--planner-days', dates.length);
    const times = make('div', 'lesson-planner-times');
    for (let total = DAY_START; total <= DAY_END; total += 60) {
      const label = make('span', '', timeLabel(timeValue(total)).replace(':00', ''));
      label.style.top = `${((total - DAY_START) / (DAY_END - DAY_START)) * 100}%`;
      times.append(label);
    }
    body.append(times);
    dates.forEach(date => {
      const column = make('div', 'lesson-planner-day-column');
      column.dataset.lessonDropDate=dateKey(date);
      column.classList.toggle('is-today', dateKey(date) === dateKey(new Date()));
      const preview=make('div','lesson-planner-add-preview');preview.setAttribute('aria-hidden','true');column.appendChild(preview);
      const startAtPointer=event=>{
        const rect=column.getBoundingClientRect();
        const total=DAY_START+((event.clientY-rect.top)/Math.max(1,rect.height))*(DAY_END-DAY_START);
        return Math.max(DAY_START,Math.min(DAY_END-60,Math.round(total)));
      };
      column.addEventListener('pointermove',event=>{
        const show=event.target===column&&!event.buttons&&event.pointerType!=='touch'&&!cancelLessonDrag;
        preview.classList.toggle('is-visible',show);if(!show)return;
        const start=startAtPointer(event);
        preview.style.top=`${(start-DAY_START)/(DAY_END-DAY_START)*100}%`;
        preview.style.height=`${60/(DAY_END-DAY_START)*100}%`;
        preview.textContent=`+ Add lesson · ${timeLabel(timeValue(start))}`;
      });
      column.addEventListener('pointerleave',()=>preview.classList.remove('is-visible'));
      column.addEventListener('pointerdown',()=>preview.classList.remove('is-visible'));
      column.addEventListener('click', event => {
        if (event.target !== column) return;
        const start = startAtPointer(event);
        selectedDate = atNoon(date);
        openEditor(null, { date: dateKey(date), start: timeValue(start), end: timeValue(start + 60) });
      });
      unplannedScheduleForDate(date).forEach(item => {
        const start = Math.max(DAY_START, minutes(item.start));
        const end = Math.min(DAY_END, Math.max(start + 15, minutes(item.end)));
        if (end <= DAY_START || start >= DAY_END) return;
        const slot = schedulePlaceholder(item, date);
        slot.style.top = `${((start - DAY_START) / (DAY_END - DAY_START)) * 100}%`;
        slot.style.minHeight = `${Math.max(52, ((end - start) / (DAY_END - DAY_START)) * 980)}px`;
        slot.style.height = 'auto';
        column.append(slot);
      });
      blocksForDate(date).forEach(block => {
        const start = Math.max(DAY_START, minutes(block.start));
        const end = Math.min(DAY_END, Math.max(start + 15, minutes(block.end)));
        if (end <= DAY_START || start >= DAY_END) return;
        const eventButton = lessonBlockButton(block);
        eventButton.style.top = `${((start - DAY_START) / (DAY_END - DAY_START)) * 100}%`;
        eventButton.style.minHeight = `${Math.max(52, ((end - start) / (DAY_END - DAY_START)) * 980)}px`;
        eventButton.style.height = 'auto';
        column.append(eventButton);
      });
      if (dateKey(date) === dateKey(new Date())) {
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        if (nowMinutes >= DAY_START && nowMinutes <= DAY_END) {
          const line = make('span', 'lesson-planner-now-line');
          line.style.top = `${((nowMinutes - DAY_START) / (DAY_END - DAY_START)) * 100}%`;
          column.append(line);
        }
      }
      body.append(column);
    });
    schedule.append(head, body);
    canvas.append(schedule);
  }

  function renderMonth() {
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    const first = new Date(year, month, 1, 12);
    const start = addDays(first, -first.getDay());
    const shell = make('section', 'lesson-planner-month');
    const weekdays = make('div', 'lesson-planner-month__weekdays');
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => weekdays.append(make('span', '', day)));
    const grid = make('div', 'lesson-planner-month__grid');
    for (let index = 0; index < 42; index++) {
      const date = addDays(start, index);
      const cell = make('article', 'lesson-planner-month-day');
      cell.dataset.lessonDropDate=dateKey(date);
      cell.classList.toggle('is-outside', date.getMonth() !== month);
      cell.classList.toggle('is-today', dateKey(date) === dateKey(new Date()));
      cell.classList.toggle('is-selected', dateKey(date) === dateKey(selectedDate));
      const dayButton = make('button', 'lesson-planner-month-day__number', String(date.getDate()));
      dayButton.type = 'button';
      dayButton.setAttribute('aria-label', fullDate.format(date));
      dayButton.addEventListener('click', () => { selectedDate = atNoon(date); currentDate = atNoon(date); renderAll(); });
      cell.append(dayButton);
      const dayBlocks = blocksForDate(date);
      const scheduleSlots = unplannedScheduleForDate(date);
      const monthEntries=[...dayBlocks.map(block=>({type:'block',start:block.start,value:block})),...scheduleSlots.map(item=>({type:'schedule',start:item.start,value:item}))].sort((a,b)=>a.start.localeCompare(b.start));
      monthEntries.slice(0, 3).forEach(entry => cell.append(entry.type==='block'?lessonBlockButton(entry.value,true):schedulePlaceholder(entry.value,date,true)));
      if (monthEntries.length > 3) cell.append(make('small', 'lesson-planner-month-day__more', `+${monthEntries.length - 3} more`));
      cell.addEventListener('dblclick', event => { if (event.target.closest('.lesson-calendar-chip')) return; selectedDate = atNoon(date); currentDate = atNoon(date); setView('day'); });
      grid.append(cell);
    }
    shell.append(weekdays, grid);
    canvas.append(shell);
  }

  function renderYear() {
    const year = currentDate.getFullYear();
    const shell = make('section', 'lesson-planner-year');
    for (let month = 0; month < 12; month++) {
      const card = make('article', 'lesson-planner-year-month');
      const title = make('button', 'lesson-planner-year-month__title', new Intl.DateTimeFormat(undefined, { month: 'long' }).format(new Date(year, month, 1)));
      title.type = 'button';
      title.addEventListener('click', () => { currentDate = atNoon(new Date(year, month, 1)); selectedDate = atNoon(currentDate); setView('month'); });
      const weekdays = make('div', 'lesson-planner-year-month__weekdays');
      ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(day => weekdays.append(make('span', '', day)));
      const days = make('div', 'lesson-planner-year-month__days');
      const first = new Date(year, month, 1, 12);
      for (let blank = 0; blank < first.getDay(); blank++) days.append(make('span', 'is-blank'));
      const totalDays = new Date(year, month + 1, 0).getDate();
      for (let day = 1; day <= totalDays; day++) {
        const date = atNoon(new Date(year, month, day));
        const button = make('button', 'lesson-planner-year-day', String(day));
        button.type = 'button';
        button.classList.toggle('has-lessons', blocksForDate(date).length > 0 || scheduleForDate(date).length > 0);
        button.classList.toggle('is-today', dateKey(date) === dateKey(new Date()));
        {const count=blocksForDate(date).length,scheduleCount=unplannedScheduleForDate(date).length;button.setAttribute('aria-label',`${fullDate.format(date)}${count?`, ${count} lesson blocks`:''}${scheduleCount?`, ${scheduleCount} scheduled slots`:''}`);}
        button.addEventListener('click', () => { currentDate = date; selectedDate = date; setView('day'); });
        days.append(button);
      }
      card.append(title, weekdays, days);
      shell.append(card);
    }
    canvas.append(shell);
  }

  function renderCanvas() {
    canvas.replaceChildren();
    if (view === 'day') renderSchedule([atNoon(currentDate)]);
    else if (view === 'week') {
      const first = startOfWeek(currentDate);
      renderSchedule(Array.from({ length: 7 }, (_, index) => addDays(first, index)));
    } else if (view === 'month') renderMonth();
    else renderYear();
  }

  function renderAll() {
    updateHeader();
    renderAgenda();
    renderCanvas();
  }

  function setView(next) {
    if (!VIEWS.includes(next)) return;
    view = next;
    renderAll();
  }

  function renderColors() {
    colorsElement.replaceChildren();
    COLORS.forEach(color => {
      const button = make('button', 'lesson-planner-color');
      button.type = 'button';
      button.style.setProperty('--lesson-color', color.value);
      button.title = color.name;
      button.setAttribute('aria-label', `${color.name} block color`);
      button.setAttribute('aria-pressed', String(color.id === editorColor));
      button.classList.toggle('is-selected', color.id === editorColor);
      button.addEventListener('click', () => { editorColor = color.id; renderColors(); });
      colorsElement.append(button);
    });
  }

  function openEditor(block = null, prefill = {}) {
    editingId = block?.id || '';
    editingScheduleId = block?.scheduleId || prefill.scheduleId || '';
    const date = block?.date || prefill.date || dateKey(selectedDate);
    labelInput.value = block?.label || prefill.label || '';
    dateInput.value = date;
    startInput.value = block?.start || prefill.start || '08:00';
    endInput.value = block?.end || prefill.end || '09:00';
    descriptionInput.value = block?.description || '';
    descriptionCount.textContent = String(descriptionInput.value.length);
    editorColor = block?.color || prefill.color || COLORS[0].id;
    deleteButton.hidden = !block;
    duplicateButton.hidden = !block;
    document.getElementById('lesson-planner-editor-title').textContent = block ? 'Edit lesson' : 'Plan a lesson';
    renderColors();
    editor.hidden = false;
    editor.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => labelInput.focus({ preventScroll: true }));
  }

  function closeEditor() {
    editor.hidden = true;
    editor.setAttribute('aria-hidden', 'true');
    editingId = '';
    editingScheduleId = '';
  }

  function openPlanner(requestedPlannerId = '') {
    document.querySelector('[data-profile-close]')?.click();
    panel.hidden = false;
    panel.setAttribute('aria-hidden', 'false');
    openButton.setAttribute('aria-expanded', 'true');
    document.body.classList.add('lesson-planner-open');
    closeScheduling();
    if(requestedPlannerId&&planners.some(planner=>planner.id===requestedPlannerId))openPlannerBook(requestedPlannerId);else showPlannerLibrary();
  }

  function closePlanner(reopenProfile = false) {
    cancelLessonDrag?.();
    closeEditor();
    closeScheduling();
    library.hidden = false;
    plannerWindow.hidden = true;
    panel.hidden = true;
    panel.setAttribute('aria-hidden', 'true');
    openButton.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('lesson-planner-open');
    if (reopenProfile) document.getElementById('profile-toggle')?.click();
    else document.getElementById('profile-toggle')?.focus({ preventScroll: true });
  }

  function navigate(direction) {
    if (view === 'day') currentDate = addDays(currentDate, direction);
    else if (view === 'week') currentDate = addDays(currentDate, direction * 7);
    else if (view === 'month') currentDate = addMonths(currentDate, direction);
    else currentDate = atNoon(new Date(currentDate.getFullYear() + direction, currentDate.getMonth(), 1));
    selectedDate = atNoon(currentDate);
    renderAll();
  }

  openButton.addEventListener('click', openPlanner);
  createPlannerButton.addEventListener('click', createPlanner);
  document.getElementById('lesson-planner-library-close').addEventListener('click', () => closePlanner(false));
  document.getElementById('lesson-planner-library-back').addEventListener('click', () => closePlanner(true));
  document.getElementById('lesson-planner-close').addEventListener('click', () => closePlanner(false));
  document.getElementById('lesson-planner-back').addEventListener('click', () => showPlannerLibrary());
  schedulingButton.addEventListener('click', openScheduling);
  document.getElementById('lesson-planner-scheduling-close').addEventListener('click', closeScheduling);
  schedulingPanel.querySelector('.lesson-planner-scheduling__backdrop').addEventListener('click', closeScheduling);
  schedulingRepeat.addEventListener('change', syncScheduleRepeatUi);
  schedulingStart.addEventListener('change',()=>{if(minutes(schedulingEnd.value)<=minutes(schedulingStart.value))schedulingEnd.value=timeValue(minutes(schedulingStart.value)+60)});
  schedulingCancel.addEventListener('click', resetScheduleForm);
  schedulingForm.addEventListener('submit',event=>{
    event.preventDefault();
    const planner=activePlanner();if(!planner)return;
    const item=normalizeScheduleItem({id:editingScheduleId||scheduleId(),label:schedulingLabel.value,start:schedulingStart.value,end:schedulingEnd.value,repeat:schedulingRepeat.value,weekday:Number(schedulingWeekday.value),color:scheduleEditorColor});
    if(!item)return;
    const existing=planner.schedule.findIndex(value=>value.id===item.id);if(existing>=0)planner.schedule[existing]=item;else planner.schedule.push(item);
    savePlanners();publishPlannerChange();resetScheduleForm();renderSchedulingList();renderAll();
  });
  panel.querySelector('.lesson-planner-backdrop').addEventListener('click', () => closePlanner(false));
  window.addEventListener('teachertiles:accountchange', () => { if (!panel.hidden && !library.hidden) renderLibrary(); });
  document.getElementById('lesson-planner-prev').addEventListener('click', () => navigate(-1));
  document.getElementById('lesson-planner-next').addEventListener('click', () => navigate(1));
  document.getElementById('lesson-planner-today').addEventListener('click', () => { currentDate = atNoon(new Date()); selectedDate = atNoon(new Date()); renderAll(); });
  document.getElementById('lesson-planner-new').addEventListener('click', () => openEditor());
  viewTabs.forEach(button => button.addEventListener('click', () => setView(button.dataset.plannerView)));
  zoomInput.addEventListener('input', () => setView(VIEWS[Number(zoomInput.value)] || 'week'));
  document.getElementById('lesson-planner-editor-close').addEventListener('click', closeEditor);
  editor.querySelector('.lesson-planner-editor__backdrop').addEventListener('click', closeEditor);
  descriptionInput.addEventListener('input', () => descriptionCount.textContent = String(descriptionInput.value.length));
  startInput.addEventListener('change', () => {
    if (minutes(endInput.value) <= minutes(startInput.value)) endInput.value = timeValue(minutes(startInput.value) + 60);
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const start = startInput.value;
    const end = endInput.value;
    if (minutes(end) <= minutes(start)) {
      endInput.setCustomValidity('The lesson must end after it starts.');
      endInput.reportValidity();
      return;
    }
    endInput.setCustomValidity('');
    const saved = normalizeBlock({
      id: editingId || `lesson-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label: labelInput.value.trim(), date: dateInput.value, start, end,
      color: editorColor, description: descriptionInput.value.trim(), scheduleId: editingScheduleId
    });
    if (!saved) return;
    const existing = blocks.findIndex(block => block.id === saved.id);
    if (existing >= 0) blocks[existing] = saved; else blocks.push(saved);
    selectedDate = fromDateKey(saved.date);
    currentDate = atNoon(selectedDate);
    saveBlocks();
    closeEditor();
    renderAll();
  });
  deleteButton.addEventListener('click', () => {
    const block = blocks.find(item => item.id === editingId);
    if (!block || !confirm(`Delete “${block.label}”?`)) return;
    blocks = blocks.filter(item => item.id !== editingId);
    saveBlocks();
    closeEditor();
    renderAll();
  });
  duplicateButton.addEventListener('click', () => {
    const block = blocks.find(item => item.id === editingId);
    if (!block) return;
    editingId = '';
    editingScheduleId = '';
    labelInput.value = `${block.label} copy`.slice(0, 80);
    document.getElementById('lesson-planner-editor-title').textContent = 'Duplicate lesson';
    deleteButton.hidden = true;
    duplicateButton.hidden = true;
    labelInput.focus({ preventScroll: true });
    labelInput.select();
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || panel.hidden) return;
    event.preventDefault();
    if (!schedulingPanel.hidden) closeScheduling();
    else if (!editor.hidden) closeEditor();
    else if (!plannerWindow.hidden) showPlannerLibrary();
    else closePlanner(false);
  });

  window.TeacherTilesLessonPlanner = Object.freeze({
    getBlocks: plannerId => {const planner=planners.find(item=>item.id===(plannerId||activePlannerId));return planner?planner.blocks.map(block=>({...block})):[]},
    getSchedules: plannerId => {const planner=planners.find(item=>item.id===(plannerId||activePlannerId));return planner?(planner.schedule||[]).map(item=>({...item})):[]},
    getPlanners: () => planners.map(planner => ({ ...planner, blocks: planner.blocks.map(block => ({ ...block })), schedule:(planner.schedule||[]).map(item=>({...item})) })),
    getActivePlannerId: () => activePlannerId,
    open: openPlanner,
    close: () => closePlanner(false)
  });
  renderColors();
  renderScheduleColors();
  syncScheduleRepeatUi();
})();
