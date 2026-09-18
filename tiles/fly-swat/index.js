(() => {
  'use strict';

  const MODES = Object.freeze({
    upper: 'Uppercase Letters',
    lower: 'Lowercase Letters',
    numbers: 'Numbers 1–25'
  });
  const COUNTS = new Set([10, 20, 30]);
  const TEAM_LABEL = Object.freeze({blue: 'Blue', red: 'Red'});

  const random = (min, max) => min + Math.random() * (max - min);
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
    const letters = Array.from({length: 26}, (_, i) => String.fromCharCode(65 + i));
    return mode === 'lower' ? letters.map(letter => letter.toLowerCase()) : letters;
  }

  function labelsForRound(mode, count) {
    const base = labelPool(mode);
    const result = [];
    while (result.length < count) result.push(...shuffle(base));
    return result.slice(0, count);
  }

  function layoutForCount(count) {
    if (count <= 10) return {cols: 5, rows: 2, xMin: 12, xMax: 88, yMin: 18, yMax: 61};
    if (count <= 20) return {cols: 5, rows: 4, xMin: 11, xMax: 89, yMin: 12, yMax: 70};
    return {cols: 6, rows: 5, xMin: 9, xMax: 91, yMin: 9, yMax: 72};
  }

  function makeFlies(mode, count) {
    const layout = layoutForCount(count);
    const labels = labelsForRound(mode, count);
    const cells = [];
    for (let row = 0; row < layout.rows; row += 1) {
      for (let col = 0; col < layout.cols; col += 1) {
        const xBase = layout.cols === 1 ? 50 : layout.xMin + ((layout.xMax - layout.xMin) * col) / (layout.cols - 1);
        const yBase = layout.rows === 1 ? 42 : layout.yMin + ((layout.yMax - layout.yMin) * row) / (layout.rows - 1);
        cells.push({
          x: xBase + random(-2.5, 2.5),
          y: yBase + random(-2.2, 2.2)
        });
      }
    }
    return shuffle(cells).slice(0, count).map((cell, index) => ({
      id: `${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      label: labels[index],
      x: Math.max(6, Math.min(94, cell.x)),
      y: Math.max(6, Math.min(76, cell.y)),
      hue: Math.round(random(0, 360)),
      dx1: random(-4.5, -1.8),
      dy1: random(-3.5, 1.5),
      dx2: random(1.8, 4.5),
      dy2: random(-1.5, 3.5),
      tilt1: random(-4, -1),
      tilt2: random(1, 4),
      duration: random(2.4, 4.2),
      delay: random(-3.5, 0),
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
    const newRoundButtons = moduleElement.querySelectorAll('.flyswat-new-round');
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
      const usableHeight = rect.height * .66;
      const size = Math.max(36, Math.min(94, usableWidth / cols * .72, usableHeight / rows * .82));
      moduleElement.style.setProperty('--flyswat-fly-size', `${size}px`);
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
      button.style.setProperty('--fly-dx1', `${fly.dx1}px`);
      button.style.setProperty('--fly-dy1', `${fly.dy1}px`);
      button.style.setProperty('--fly-dx2', `${fly.dx2}px`);
      button.style.setProperty('--fly-dy2', `${fly.dy2}px`);
      button.style.setProperty('--fly-tilt1', `${fly.tilt1}deg`);
      button.style.setProperty('--fly-tilt2', `${fly.tilt2}deg`);
      button.style.setProperty('--fly-duration', `${fly.duration}s`);
      button.style.setProperty('--fly-delay', `${fly.delay}s`);
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
      button.disabled = true;
      button.classList.add('is-swatted');
      updateHud();
      markChanged('flyswat-swat');
      const timeout = window.setTimeout(() => {
        timers.delete(timeout);
        button.remove();
        finishIfCleared();
      }, 360);
      timers.add(timeout);
    }

    function newRound({resetScores = true, notify = true} = {}) {
      timers.forEach(clearTimeout);
      timers.clear();
      if (resetScores) {
        state.blueScore = 0;
        state.redScore = 0;
      }
      state.ended = false;
      state.flies = makeFlies(state.mode, state.count);
      renderBoard();
      if (notify) markChanged('flyswat-new-round');
    }

    function setTeam(team) {
      if (!TEAM_LABEL[team] || state.activeTeam === team) return;
      state.activeTeam = team;
      updateHud();
      markChanged('flyswat-team');
    }

    blueButton.addEventListener('click', () => setTeam('blue'), {signal});
    redButton.addEventListener('click', () => setTeam('red'), {signal});
    newRoundButtons.forEach(button => button.addEventListener('click', () => newRound(), {signal}));

    modeButtons.forEach(button => button.addEventListener('click', () => {
      const next = button.dataset.flyswatMode;
      if (!MODES[next] || next === state.mode) return;
      state.mode = next;
      newRound();
    }, {signal}));

    countButtons.forEach(button => button.addEventListener('click', () => {
      const next = Number(button.dataset.flyswatCount);
      if (!COUNTS.has(next) || next === state.count) return;
      state.count = next;
      newRound();
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
              x: Math.max(6, Math.min(94, Number(fly.x) || 50)),
              y: Math.max(6, Math.min(76, Number(fly.y) || 40)),
              hue: Number.isFinite(Number(fly.hue)) ? Number(fly.hue) : Math.round(random(0, 360)),
              dx1: Number(fly.dx1) || -3,
              dy1: Number(fly.dy1) || -2,
              dx2: Number(fly.dx2) || 3,
              dy2: Number(fly.dy2) || 2,
              tilt1: Number(fly.tilt1) || -2,
              tilt2: Number(fly.tilt2) || 2,
              duration: Math.max(1.8, Number(fly.duration) || 3.2),
              delay: Number(fly.delay) || 0,
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
