(() => {
  'use strict';

  const MODES = Object.freeze({
    upper: 'Uppercase Letters',
    lower: 'Lowercase Letters',
    mixed: 'Mixed Uppercase + Lowercase',
    numbers: 'Numbers 1–25'
  });
  const COUNTS = new Set([10, 20, 30]);
  const TEAM_LABEL = Object.freeze({blue: 'Blue', red: 'Red'});

  const random = (min, max) => min + Math.random() * (max - min);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const shuffle = values => {
    const items = [...values];
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  };

  function labelPool(mode) {
    if (mode === 'numbers') return Array.from({length: 25}, (_, i) => String(i + 1));
    const upper = Array.from({length: 26}, (_, i) => String.fromCharCode(65 + i));
    if (mode === 'lower') return upper.map(letter => letter.toLowerCase());
    if (mode === 'mixed') return [...upper, ...upper.map(letter => letter.toLowerCase())];
    return upper;
  }

  function labelsForRound(mode, count) {
    const base = labelPool(mode);
    const result = [];
    while (result.length < count) result.push(...shuffle(base));
    return result.slice(0, count);
  }

  function layoutForCount(count) {
    if (count <= 10) return {cols: 5, rows: 2, xMin: 12, xMax: 88, yMin: 17, yMax: 54};
    if (count <= 20) return {cols: 5, rows: 4, xMin: 11, xMax: 89, yMin: 12, yMax: 63};
    return {cols: 6, rows: 5, xMin: 9, xMax: 91, yMin: 9, yMax: 65};
  }

  function crawlPath() {
    const point = () => ({x: random(-14, 14), y: random(-11, 11), r: random(-15, 15)});
    const p1 = point();
    const p2 = point();
    const p3 = point();
    const p4 = point();
    const p5 = point();
    return {
      mx1: p1.x, my1: p1.y, mr1: p1.r,
      mx2: p2.x, my2: p2.y, mr2: p2.r,
      mx3: p3.x, my3: p3.y, mr3: p3.r,
      mx4: p4.x, my4: p4.y, mr4: p4.r,
      mx5: p5.x, my5: p5.y, mr5: p5.r,
      duration: random(5.4, 8.6),
      delay: random(-8, 0)
    };
  }

  function normalizeCrawl(fly = {}) {
    const fallback = crawlPath();
    const num = (key, fallbackValue) => Number.isFinite(Number(fly[key])) ? Number(fly[key]) : fallbackValue;
    return {
      mx1: num('mx1', fallback.mx1), my1: num('my1', fallback.my1), mr1: num('mr1', fallback.mr1),
      mx2: num('mx2', fallback.mx2), my2: num('my2', fallback.my2), mr2: num('mr2', fallback.mr2),
      mx3: num('mx3', fallback.mx3), my3: num('my3', fallback.my3), mr3: num('mr3', fallback.mr3),
      mx4: num('mx4', fallback.mx4), my4: num('my4', fallback.my4), mr4: num('mr4', fallback.mr4),
      mx5: num('mx5', fallback.mx5), my5: num('my5', fallback.my5), mr5: num('mr5', fallback.mr5),
      duration: Math.max(4.5, num('duration', fallback.duration)),
      delay: num('delay', fallback.delay)
    };
  }

  function makeFlies(mode, count) {
    const layout = layoutForCount(count);
    const labels = labelsForRound(mode, count);
    const cells = [];
    for (let row = 0; row < layout.rows; row += 1) {
      for (let col = 0; col < layout.cols; col += 1) {
        const xBase = layout.cols === 1 ? 50 : layout.xMin + ((layout.xMax - layout.xMin) * col) / (layout.cols - 1);
        const yBase = layout.rows === 1 ? 40 : layout.yMin + ((layout.yMax - layout.yMin) * row) / (layout.rows - 1);
        cells.push({x: xBase + random(-2.5, 2.5), y: yBase + random(-2.2, 2.2)});
      }
    }
    return shuffle(cells).slice(0, count).map((cell, index) => ({
      id: `${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      label: labels[index],
      x: clamp(cell.x, 6, 94),
      y: clamp(cell.y, 6, 68),
      hue: Math.round(random(0, 360)),
      ...crawlPath(),
      swatted: false
    }));
  }

  function setup(moduleElement) {
    const board = moduleElement.querySelector('.flyswat-board');
    const stage = moduleElement.querySelector('.flyswat-stage');
    const status = moduleElement.querySelector('.flyswat-status');
    const blueButton = moduleElement.querySelector('[data-flyswat-team="blue"]');
    const redButton = moduleElement.querySelector('[data-flyswat-team="red"]');
    const blueScore = moduleElement.querySelector('.flyswat-blue-score');
    const redScore = moduleElement.querySelector('.flyswat-red-score');
    const gameOver = moduleElement.querySelector('.flyswat-gameover');
    const gameOverResult = moduleElement.querySelector('.flyswat-gameover-result');
    const resetButtons = moduleElement.querySelectorAll('.flyswat-reset');
    const modeButtons = [...moduleElement.querySelectorAll('[data-flyswat-mode]')];
    const countButtons = [...moduleElement.querySelectorAll('[data-flyswat-count]')];
    const abortController = new AbortController();
    const {signal} = abortController;
    const timers = new Set();

    let state = {
      mode: 'upper',
      count: 20,
      activeTeam: 'blue',
      blueScore: 0,
      redScore: 0,
      ended: false,
      flies: makeFlies('upper', 20)
    };

    function markChanged(reason) {
      if (typeof notifyBoardChanged === 'function') notifyBoardChanged(reason);
    }

    function remainingFlies() {
      return state.flies.filter(fly => !fly.swatted).length;
    }

    function setPressed(buttons, attr, value) {
      buttons.forEach(button => {
        const active = button.getAttribute(attr) === String(value);
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      });
    }

    function winnerText() {
      if (state.blueScore === state.redScore) return `Tie game · ${state.blueScore}–${state.redScore}`;
      const team = state.blueScore > state.redScore ? 'Blue' : 'Red';
      return `${team} wins · ${state.blueScore}–${state.redScore}`;
    }

    function updateHud() {
      blueScore.textContent = String(state.blueScore);
      redScore.textContent = String(state.redScore);
      blueButton.classList.toggle('is-active', state.activeTeam === 'blue');
      redButton.classList.toggle('is-active', state.activeTeam === 'red');
      blueButton.setAttribute('aria-pressed', String(state.activeTeam === 'blue'));
      redButton.setAttribute('aria-pressed', String(state.activeTeam === 'red'));
      setPressed(modeButtons, 'data-flyswat-mode', state.mode);
      setPressed(countButtons, 'data-flyswat-count', state.count);
      const remaining = remainingFlies();
      status.textContent = state.ended
        ? `Board cleared · ${winnerText()}`
        : `${TEAM_LABEL[state.activeTeam]} team active · ${remaining} ${remaining === 1 ? 'fly' : 'flies'} left`;
      gameOver.hidden = !state.ended;
      if (state.ended) gameOverResult.textContent = winnerText();
    }

    function fitFlies() {
      const rect = stage.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const {cols, rows} = layoutForCount(state.count);
      const usableWidth = rect.width * .84;
      const usableHeight = rect.height * .72;
      const size = Math.max(34, Math.min(92, usableWidth / cols * .72, usableHeight / rows * .78));
      moduleElement.style.setProperty('--flyswat-fly-size', `${size}px`);
    }

    function applyCrawlVars(button, fly) {
      ['1','2','3','4','5'].forEach(index => {
        button.style.setProperty(`--fly-mx${index}`, `${fly[`mx${index}`]}px`);
        button.style.setProperty(`--fly-my${index}`, `${fly[`my${index}`]}px`);
        button.style.setProperty(`--fly-mr${index}`, `${fly[`mr${index}`]}deg`);
      });
      button.style.setProperty('--fly-duration', `${fly.duration}s`);
      button.style.setProperty('--fly-delay', `${fly.delay}s`);
    }

    function createFlyElement(fly) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'flyswat-fly';
      button.dataset.flyId = fly.id;
      button.setAttribute('aria-label', `Swat ${fly.label}`);
      button.style.left = `${fly.x}%`;
      button.style.top = `${fly.y}%`;
      button.style.setProperty('--fly-hue', `${fly.hue}deg`);
      applyCrawlVars(button, fly);
      button.innerHTML = `
        <span class="flyswat-fly-inner">
          <img src="tiles/fly-swat/assets/fly.png" alt="" draggable="false">
          <strong class="flyswat-fly-label">${fly.label}</strong>
        </span>`;
      button.addEventListener('click', () => swatFly(fly.id, button), {signal});
      return button;
    }

    function renderBoard() {
      board.replaceChildren();
      state.flies.filter(fly => !fly.swatted).forEach(fly => board.append(createFlyElement(fly)));
      updateHud();
      requestAnimationFrame(fitFlies);
    }

    function makeSplat(button, fly) {
      const boardRect = board.getBoundingClientRect();
      const flyRect = button.getBoundingClientRect();
      if (!boardRect.width || !boardRect.height) return;
      const x = flyRect.left + flyRect.width / 2 - boardRect.left;
      const y = flyRect.top + flyRect.height / 2 - boardRect.top;
      const color = `hsl(${fly.hue} 72% 72%)`;

      const core = document.createElement('span');
      core.className = 'flyswat-splat-core';
      core.style.left = `${x}px`;
      core.style.top = `${y}px`;
      core.style.setProperty('--splat-color', color);
      board.append(core);

      for (let i = 0; i < 12; i += 1) {
        const angle = random(0, Math.PI * 2);
        const distance = random(18, 50);
        const particle = document.createElement('span');
        particle.className = 'flyswat-splat-particle';
        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;
        particle.style.setProperty('--splat-color', i % 4 === 0 ? 'rgba(40,40,45,.62)' : color);
        particle.style.setProperty('--splat-x', `${Math.cos(angle) * distance}px`);
        particle.style.setProperty('--splat-y', `${Math.sin(angle) * distance}px`);
        particle.style.setProperty('--splat-rot', `${random(-160, 160)}deg`);
        particle.style.setProperty('--splat-size', `${random(4, 9)}px`);
        board.append(particle);
      }

      const timeout = window.setTimeout(() => {
        timers.delete(timeout);
        core.remove();
        board.querySelectorAll('.flyswat-splat-particle').forEach(particle => {
          if (particle.style.left === `${x}px` && particle.style.top === `${y}px`) particle.remove();
        });
      }, 720);
      timers.add(timeout);
    }

    function finishIfCleared() {
      if (remainingFlies() !== 0) return;
      state.ended = true;
      updateHud();
      markChanged('flyswat-complete');
    }

    function swatFly(id, button) {
      if (state.ended) return;
      const fly = state.flies.find(item => item.id === id);
      if (!fly || fly.swatted) return;
      fly.swatted = true;
      state[`${state.activeTeam}Score`] += 1;
      makeSplat(button, fly);
      button.disabled = true;
      button.classList.add('is-swatted');
      updateHud();
      markChanged('flyswat-swat');
      const timeout = window.setTimeout(() => {
        timers.delete(timeout);
        button.remove();
        finishIfCleared();
      }, 230);
      timers.add(timeout);
    }

    function resetRound({notify = true} = {}) {
      timers.forEach(clearTimeout);
      timers.clear();
      state.blueScore = 0;
      state.redScore = 0;
      state.ended = false;
      state.flies = makeFlies(state.mode, state.count);
      renderBoard();
      if (notify) markChanged('flyswat-reset');
    }

    function setTeam(team) {
      if (!TEAM_LABEL[team] || state.activeTeam === team) return;
      state.activeTeam = team;
      updateHud();
      markChanged('flyswat-team');
    }

    blueButton.addEventListener('click', () => setTeam('blue'), {signal});
    redButton.addEventListener('click', () => setTeam('red'), {signal});
    resetButtons.forEach(button => button.addEventListener('click', () => resetRound(), {signal}));

    modeButtons.forEach(button => button.addEventListener('click', () => {
      const next = button.dataset.flyswatMode;
      if (!MODES[next] || next === state.mode) return;
      state.mode = next;
      resetRound();
    }, {signal}));

    countButtons.forEach(button => button.addEventListener('click', () => {
      const next = Number(button.dataset.flyswatCount);
      if (!COUNTS.has(next) || next === state.count) return;
      state.count = next;
      resetRound();
    }, {signal}));

    const resizeObserver = new ResizeObserver(fitFlies);
    resizeObserver.observe(stage);

    moduleElement._boardGetState = () => ({
      mode: state.mode,
      count: state.count,
      activeTeam: state.activeTeam,
      blueScore: state.blueScore,
      redScore: state.redScore,
      ended: state.ended,
      flies: state.flies.map(fly => ({...fly}))
    });

    moduleElement._boardSetState = saved => {
      const mode = MODES[saved?.mode] ? saved.mode : 'upper';
      const count = COUNTS.has(Number(saved?.count)) ? Number(saved.count) : 20;
      const savedFlies = Array.isArray(saved?.flies) ? saved.flies : null;
      state = {
        mode,
        count,
        activeTeam: saved?.activeTeam === 'red' ? 'red' : 'blue',
        blueScore: Math.max(0, Number(saved?.blueScore) || 0),
        redScore: Math.max(0, Number(saved?.redScore) || 0),
        ended: Boolean(saved?.ended),
        flies: savedFlies?.length
          ? savedFlies.map((fly, index) => ({
              id: String(fly.id || `restored-${index}`),
              label: String(fly.label ?? '?'),
              x: clamp(Number(fly.x) || 50, 6, 94),
              y: clamp(Number(fly.y) || 40, 6, 68),
              hue: Number.isFinite(Number(fly.hue)) ? Number(fly.hue) : Math.round(random(0, 360)),
              ...normalizeCrawl(fly),
              swatted: Boolean(fly.swatted)
            }))
          : makeFlies(mode, count)
      };
      if (!state.flies.some(fly => !fly.swatted)) state.ended = true;
      renderBoard();
    };

    const priorCleanup = moduleElement._cleanup;
    moduleElement._cleanup = () => {
      abortController.abort();
      resizeObserver.disconnect();
      timers.forEach(clearTimeout);
      timers.clear();
      priorCleanup?.();
    };

    renderBoard();
  }

  window.TeacherTilesFlySwat = Object.freeze({setup});
})();
