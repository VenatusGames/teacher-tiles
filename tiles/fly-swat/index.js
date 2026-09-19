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
    if (count <= 10) return {cols: 5, rows: 2, xMin: 10, xMax: 90, yMin: 18, yMax: 82};
    if (count <= 20) return {cols: 5, rows: 4, xMin: 10, xMax: 90, yMin: 12, yMax: 88};
    return {cols: 6, rows: 5, xMin: 8, xMax: 92, yMin: 10, yMax: 90};
  }

  function cellsForCount(count) {
    const layout = layoutForCount(count);
    const cells = [];
    for (let row = 0; row < layout.rows; row += 1) {
      for (let col = 0; col < layout.cols; col += 1) {
        const xBase = layout.cols === 1 ? 50 : layout.xMin + ((layout.xMax - layout.xMin) * col) / (layout.cols - 1);
        const yBase = layout.rows === 1 ? 50 : layout.yMin + ((layout.yMax - layout.yMin) * row) / (layout.rows - 1);
        cells.push({x: xBase + random(-.2, .2), y: yBase + random(-.2, .2)});
      }
    }
    return shuffle(cells).slice(0, count);
  }

  function crawlPath() {
    const points = [];
    let x = 0;
    let y = 0;
    let heading = random(-7, 7);
    const radius = random(1.35, 1.8);

    for (let i = 0; i < 4; i += 1) {
      heading = clamp(heading + random(-4.5, 4.5), -16, 16);

      let distance = random(.42, .82);
      let radians = heading * Math.PI / 180;
      let nextX = x + Math.sin(radians) * distance + random(-.08, .08);
      let nextY = y - Math.cos(radians) * distance + random(-.08, .08);

      if (Math.hypot(nextX, nextY) > radius) {
        const inwardHeading = Math.atan2(-x, y) * 180 / Math.PI;
        heading = clamp(inwardHeading * .45 + heading * .55 + random(-3, 3), -16, 16);
        distance = random(.32, .66);
        radians = heading * Math.PI / 180;
        nextX = x + Math.sin(radians) * distance + random(-.05, .05);
        nextY = y - Math.cos(radians) * distance + random(-.05, .05);
      }

      x = clamp(nextX, -1.8, 1.8);
      y = clamp(nextY, -1.8, 1.8);
      points.push({x, y, r: heading});
    }

    const settleHeading = clamp((Math.atan2(-x, y) * 180 / Math.PI) * .35 + heading * .65 + random(-2.5, 2.5), -14, 14);
    points.push({
      x: clamp(x * random(.25, .48), -.9, .9),
      y: clamp(y * random(.25, .48), -.9, .9),
      r: settleHeading
    });

    return {
      mx1: points[0].x, my1: points[0].y, mr1: points[0].r,
      mx2: points[1].x, my2: points[1].y, mr2: points[1].r,
      mx3: points[2].x, my3: points[2].y, mr3: points[2].r,
      mx4: points[3].x, my4: points[3].y, mr4: points[3].r,
      mx5: points[4].x, my5: points[4].y, mr5: points[4].r,
      mr6: points[4].r,
      duration: random(26, 36),
      delay: random(-32, 0)
    };
  }

  function normalizeCrawl(fly = {}) {
    const fallback = crawlPath();
    const num = (key, fallbackValue) => Number.isFinite(Number(fly[key])) ? Number(fly[key]) : fallbackValue;
    const move = key => clamp(num(key, fallback[key]), -1.8, 1.8);
    const turn = key => clamp(num(key, fallback[key]), -16, 16);
    return {
      mx1: move('mx1'), my1: move('my1'), mr1: turn('mr1'),
      mx2: move('mx2'), my2: move('my2'), mr2: turn('mr2'),
      mx3: move('mx3'), my3: move('my3'), mr3: turn('mr3'),
      mx4: move('mx4'), my4: move('my4'), mr4: turn('mr4'),
      mx5: move('mx5'), my5: move('my5'), mr5: turn('mr5'),
      mr6: turn('mr6'),
      duration: Math.max(24, num('duration', fallback.duration)),
      delay: num('delay', fallback.delay)
    };
  }

  function makeFlies(mode, count) {
    const labels = labelsForRound(mode, count);
    const cells = cellsForCount(count);
    return cells.map((cell, index) => ({
      id: `${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      label: labels[index],
      x: cell.x,
      y: cell.y,
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
    const squishPrototype = new Audio('tiles/fly-swat/assets/squish.mp3');
    squishPrototype.preload = 'auto';
    const activeSquishes = new Set();

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

    function uiSoundLevel() {
      try {
        const muted = localStorage.getItem('teachertiles-ui-sfx-muted') === 'true';
        const preferences = JSON.parse(localStorage.getItem('teachertiles-app-preferences-v1') || '{}');
        if (muted || preferences?.uiMuted) return 0;
        const volume = Number(preferences?.uiVolume);
        return clamp(Number.isFinite(volume) ? volume / 100 : 1, 0, 1);
      } catch {
        return 1;
      }
    }

    function playSquish() {
      const level = uiSoundLevel();
      if (level <= 0 || !moduleElement.isConnected) return;
      try {
        const sound = squishPrototype.cloneNode();
        sound.volume = clamp(.56 * level, 0, 1);
        sound.currentTime = 0;
        activeSquishes.add(sound);
        const release = () => activeSquishes.delete(sound);
        sound.addEventListener('ended', release, {once: true});
        sound.addEventListener('error', release, {once: true});
        sound.play().catch(release);
      } catch {}
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
      const rect = board.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const {cols, rows} = layoutForCount(state.count);
      const fullscreenElement = document.fullscreenElement;
      const isFullscreen = Boolean(fullscreenElement && (
        fullscreenElement === moduleElement ||
        fullscreenElement.contains(moduleElement) ||
        moduleElement.contains(fullscreenElement)
      ));
      const layout = layoutForCount(state.count);
      const maxSize = isFullscreen ? 156 : 110;
      const desiredScale = isFullscreen ? .98 : .88;
      const desiredVerticalScale = isFullscreen ? 1 : .94;
      const desired = Math.min(maxSize, rect.width / cols * desiredScale, rect.height / rows * desiredVerticalScale);
      const xStep = cols > 1 ? rect.width * ((layout.xMax - layout.xMin) / 100) / (cols - 1) : rect.width;
      const yStep = rows > 1 ? rect.height * ((layout.yMax - layout.yMin) / 100) / (rows - 1) : rect.height;
      const movementRoom = 4.5;
      const visualScale = 1.12;
      const neighborGap = isFullscreen ? 8 : 6;
      const spacingLimit = (Math.min(xStep, yStep) - neighborGap - movementRoom) / visualScale;
      const edgeX = rect.width * (Math.min(layout.xMin, 100 - layout.xMax) / 100);
      const edgeY = rect.height * (Math.min(layout.yMin, 100 - layout.yMax) / 100);
      const edgeLimit = Math.min((edgeX * 2 - movementRoom) / visualScale, (edgeY * 2 - movementRoom) / visualScale);
      const size = Math.max(32, Math.min(desired, spacingLimit, edgeLimit));
      moduleElement.style.setProperty('--flyswat-fly-size', `${size}px`);
    }

    function applyCrawlVars(button, fly) {
      ['1','2','3','4','5'].forEach(index => {
        const rotation = fly[`mr${index}`];
        button.style.setProperty(`--fly-mx${index}`, `${fly[`mx${index}`]}px`);
        button.style.setProperty(`--fly-my${index}`, `${fly[`my${index}`]}px`);
        button.style.setProperty(`--fly-mr${index}`, `${rotation}deg`);
        button.style.setProperty(`--fly-lr${index}`, `${-rotation}deg`);
      });
      button.style.setProperty('--fly-mr6', `${fly.mr6}deg`);
      button.style.setProperty('--fly-lr6', `${-fly.mr6}deg`);
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
      const stageRect = stage.getBoundingClientRect();
      const flyVisual = button.querySelector('img');
      const flyRect = flyVisual?.getBoundingClientRect() || button.getBoundingClientRect();
      if (!stageRect.width || !stageRect.height) return;
      const x = flyRect.left + flyRect.width / 2 - stageRect.left;
      const y = flyRect.top + flyRect.height / 2 - stageRect.top;
      const color = `hsl(${fly.hue} 72% 72%)`;

      const core = document.createElement('span');
      core.className = 'flyswat-splat-core';
      core.style.left = `${x}px`;
      core.style.top = `${y}px`;
      core.style.setProperty('--splat-color', color);
      stage.append(core);

      for (let i = 0; i < 20; i += 1) {
        const angle = random(0, Math.PI * 2);
        const distance = random(30, 78);
        const particle = document.createElement('span');
        particle.className = 'flyswat-splat-particle';
        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;
        particle.style.setProperty('--splat-color', i % 5 === 0 ? 'rgba(36,36,42,.68)' : color);
        particle.style.setProperty('--splat-x', `${Math.cos(angle) * distance}px`);
        particle.style.setProperty('--splat-y', `${Math.sin(angle) * distance}px`);
        particle.style.setProperty('--splat-rot', `${random(-240, 240)}deg`);
        particle.style.setProperty('--splat-w', `${random(9, 20)}px`);
        particle.style.setProperty('--splat-h', `${random(7, 17)}px`);
        stage.append(particle);
      }

      const timeout = window.setTimeout(() => {
        timers.delete(timeout);
        core.remove();
        stage.querySelectorAll('.flyswat-splat-particle').forEach(particle => {
          if (particle.style.left === `${x}px` && particle.style.top === `${y}px`) particle.remove();
        });
      }, 920);
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
      playSquish();
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
    document.addEventListener('fullscreenchange', () => requestAnimationFrame(fitFlies), {signal});

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
      const restoredCells = savedFlies?.length ? cellsForCount(count) : null;
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
              x: restoredCells?.[index]?.x ?? 50,
              y: restoredCells?.[index]?.y ?? 50,
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
      activeSquishes.forEach(sound => {
        sound.pause();
        try { sound.currentTime = 0; } catch {}
      });
      activeSquishes.clear();
      priorCleanup?.();
    };

    renderBoard();
  }

  window.TeacherTilesFlySwat = Object.freeze({setup});
})();
