(() => {
  const openButton = document.getElementById('profile-lesson-planner-button');
  const panel = document.getElementById('lesson-planner-panel');
  if (!openButton || !panel) return;

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
  const STORAGE_KEY = 'teachertiles-lesson-planner-v1';
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
  let blocks = readBlocks();
  let currentDate = atNoon(new Date());
  let selectedDate = atNoon(new Date());
  let view = 'week';
  let editingId = '';
  let editorColor = COLORS[0].id;

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
      description: String(block.description || '').slice(0, 4000)
    };
  }

  function readBlocks() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.map(normalizeBlock).filter(Boolean).slice(0, 2500) : [];
    } catch {
      return [];
    }
  }

  function saveBlocks() {
    blocks.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(blocks)); } catch {}
  }

  function blocksForDate(date) {
    const key = typeof date === 'string' ? date : dateKey(date);
    return blocks.filter(block => block.date === key).sort((a, b) => a.start.localeCompare(b.start));
  }

  function make(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
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
    agendaCount.textContent = `${dayBlocks.length} ${dayBlocks.length === 1 ? 'block' : 'blocks'}`;
    agendaList.replaceChildren();
    if (!dayBlocks.length) {
      const empty = make('div', 'lesson-planner-agenda__empty');
      empty.innerHTML = '<span aria-hidden="true">✎</span><strong>Open space</strong><small>Add a lesson block for this day.</small>';
      agendaList.append(empty);
      return;
    }
    dayBlocks.forEach(block => {
      const color = blockColor(block.color);
      const button = make('button', 'lesson-planner-agenda-item');
      button.type = 'button';
      button.style.setProperty('--lesson-color', color.value);
      button.style.setProperty('--lesson-ink', color.ink);
      button.innerHTML = `<i aria-hidden="true"></i><span><strong></strong><small></small></span>`;
      button.querySelector('strong').textContent = block.label;
      button.querySelector('small').textContent = `${timeLabel(block.start)}–${timeLabel(block.end)}`;
      button.addEventListener('click', () => openEditor(block));
      agendaList.append(button);
    });
  }

  function lessonBlockButton(block, compact = false) {
    const color = blockColor(block.color);
    const button = make('button', compact ? 'lesson-calendar-chip' : 'lesson-schedule-block');
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
      column.classList.toggle('is-today', dateKey(date) === dateKey(new Date()));
      column.addEventListener('click', event => {
        if (event.target !== column) return;
        const rect = column.getBoundingClientRect();
        const total = DAY_START + ((event.clientY - rect.top) / Math.max(1, rect.height)) * (DAY_END - DAY_START);
        const start = Math.max(DAY_START, Math.min(DAY_END - 30, Math.round(total / 15) * 15));
        selectedDate = atNoon(date);
        openEditor(null, { date: dateKey(date), start: timeValue(start), end: timeValue(start + 60) });
      });
      blocksForDate(date).forEach(block => {
        const start = Math.max(DAY_START, minutes(block.start));
        const end = Math.min(DAY_END, Math.max(start + 15, minutes(block.end)));
        if (end <= DAY_START || start >= DAY_END) return;
        const eventButton = lessonBlockButton(block);
        eventButton.style.top = `${((start - DAY_START) / (DAY_END - DAY_START)) * 100}%`;
        eventButton.style.height = `${Math.max(2.1, ((end - start) / (DAY_END - DAY_START)) * 100)}%`;
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
      cell.classList.toggle('is-outside', date.getMonth() !== month);
      cell.classList.toggle('is-today', dateKey(date) === dateKey(new Date()));
      cell.classList.toggle('is-selected', dateKey(date) === dateKey(selectedDate));
      const dayButton = make('button', 'lesson-planner-month-day__number', String(date.getDate()));
      dayButton.type = 'button';
      dayButton.setAttribute('aria-label', fullDate.format(date));
      dayButton.addEventListener('click', () => { selectedDate = atNoon(date); currentDate = atNoon(date); renderAll(); });
      cell.append(dayButton);
      const dayBlocks = blocksForDate(date);
      dayBlocks.slice(0, 3).forEach(block => cell.append(lessonBlockButton(block, true)));
      if (dayBlocks.length > 3) cell.append(make('small', 'lesson-planner-month-day__more', `+${dayBlocks.length - 3} more`));
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
        button.classList.toggle('has-lessons', blocksForDate(date).length > 0);
        button.classList.toggle('is-today', dateKey(date) === dateKey(new Date()));
        button.setAttribute('aria-label', `${fullDate.format(date)}${blocksForDate(date).length ? `, ${blocksForDate(date).length} lesson blocks` : ''}`);
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
    const date = block?.date || prefill.date || dateKey(selectedDate);
    labelInput.value = block?.label || '';
    dateInput.value = date;
    startInput.value = block?.start || prefill.start || '08:00';
    endInput.value = block?.end || prefill.end || '09:00';
    descriptionInput.value = block?.description || '';
    descriptionCount.textContent = String(descriptionInput.value.length);
    editorColor = block?.color || COLORS[0].id;
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
  }

  function openPlanner() {
    document.querySelector('[data-profile-close]')?.click();
    panel.hidden = false;
    panel.setAttribute('aria-hidden', 'false');
    openButton.setAttribute('aria-expanded', 'true');
    document.body.classList.add('lesson-planner-open');
    renderAll();
    requestAnimationFrame(() => document.getElementById('lesson-planner-new')?.focus({ preventScroll: true }));
  }

  function closePlanner(reopenProfile = false) {
    closeEditor();
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
  document.getElementById('lesson-planner-close').addEventListener('click', () => closePlanner(false));
  document.getElementById('lesson-planner-back').addEventListener('click', () => closePlanner(true));
  panel.querySelector('.lesson-planner-backdrop').addEventListener('click', () => closePlanner(false));
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
      color: editorColor, description: descriptionInput.value.trim()
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
    if (!editor.hidden) closeEditor(); else closePlanner(false);
  });

  renderColors();
})();
