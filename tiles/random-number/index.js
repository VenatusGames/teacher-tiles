(() => {
  'use strict';

  const MIN_VALUE = -999999999;
  const MAX_VALUE = 999999999;
  const IDLE_INSET = 12;
  const HOVER_RESERVED_BOTTOM = 146;
  const FIT_SAFETY = 0.93;
  const MIN_MEASURABLE_TILE = 80;
  const SETTLE_FRAMES = 6;

  function normalizeInteger(value, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(MIN_VALUE, Math.min(MAX_VALUE, Math.trunc(number)));
  }

  function normalizeRange(minValue, maxValue) {
    const first = normalizeInteger(minValue, 1);
    const second = normalizeInteger(maxValue, 100);
    return first <= second ? [first, second] : [second, first];
  }

  function randomInclusive(minValue, maxValue) {
    const [min, max] = normalizeRange(minValue, maxValue);
    const span = max - min + 1;
    const ceiling = 0x100000000;
    const limit = ceiling - (ceiling % span);
    const sample = new Uint32Array(1);
    do {
      crypto.getRandomValues(sample);
    } while (sample[0] >= limit);
    return min + (sample[0] % span);
  }

  function setup(module) {
    if (!module || module.dataset.randomNumberReady === 'true') return;
    module.dataset.randomNumberReady = 'true';

    const display = module.querySelector('.random-number-display');
    const valueElement = module.querySelector('.random-number-value');
    const minInput = module.querySelector('.random-number-min');
    const maxInput = module.querySelector('.random-number-max');
    const generateButton = module.querySelector('.random-number-generate');
    if (!display || !valueElement || !minInput || !maxInput || !generateButton) return;

    let min = 1;
    let max = 100;
    let current = randomInclusive(min, max);
    let resizeFrame = 0;
    let settleFrame = 0;
    let settleGeneration = 0;
    let transitionsReady = false;
    let disposed = false;

    const measureAt100 = () => {
      const previousTransition = valueElement.style.transition;
      const previousSize = valueElement.style.fontSize;
      valueElement.style.transition = 'none';
      valueElement.style.fontSize = '100px';
      // Force layout while transitions are disabled. Measuring during a font-size
      // transition can report an interpolated old size and wildly overscale the tile.
      const rect = valueElement.getBoundingClientRect();
      valueElement.style.fontSize = previousSize;
      valueElement.style.transition = previousTransition;
      return {
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height)
      };
    };

    const fittedSize = (availableWidth, availableHeight, measured) => {
      const scale = Math.min(
        Math.max(1, availableWidth) / measured.width,
        Math.max(1, availableHeight) / measured.height
      );
      return Math.max(24, Math.min(2400, Math.floor(100 * scale * FIT_SAFETY)));
    };

    const fitDisplay = () => {
      resizeFrame = 0;
      const width = Number(module.clientWidth) || 0;
      const height = Number(module.clientHeight) || 0;

      // During board restore the custom element can connect while the workspace is
      // still hidden or before its saved transform has been applied. Never commit a
      // tiny fallback size from that temporary 0x0/near-0 box; wait until the tile
      // has real board dimensions instead.
      if (width < MIN_MEASURABLE_TILE || height < MIN_MEASURABLE_TILE) return false;

      const availableWidth = Math.max(1, width - IDLE_INSET);
      const idleHeight = Math.max(1, height - IDLE_INSET);
      const hoverHeight = Math.max(1, height - HOVER_RESERVED_BOTTOM - 6);
      const measured = measureAt100();
      const idleSize = fittedSize(availableWidth, idleHeight, measured);
      const hoverSize = fittedSize(availableWidth, hoverHeight, measured);

      module.style.setProperty('--random-number-idle-size', `${idleSize}px`);
      module.style.setProperty('--random-number-hover-size', `${hoverSize}px`);

      if (!transitionsReady) {
        valueElement.style.transition = 'none';
        requestAnimationFrame(() => {
          if (disposed) return;
          valueElement.style.transition = '';
          transitionsReady = true;
        });
      }
      return true;
    };

    const scheduleFit = () => {
      if (disposed) return;
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(fitDisplay);
    };

    // Board restore applies the saved tile transform after this custom element has
    // connected and after _boardSetState runs. Refit over a few layout frames so the
    // final saved dimensions win even on a cold refresh. This is deliberately separate
    // from hover state: hovering must never be required to repair the tile size.
    const settleFit = () => {
      if (disposed) return;
      const generation = ++settleGeneration;
      if (settleFrame) cancelAnimationFrame(settleFrame);
      let frames = 0;
      const step = () => {
        if (disposed || generation !== settleGeneration) return;
        fitDisplay();
        frames += 1;
        if (frames < SETTLE_FRAMES) settleFrame = requestAnimationFrame(step);
        else settleFrame = 0;
      };
      settleFrame = requestAnimationFrame(step);
    };

    const render = () => {
      minInput.value = String(min);
      maxInput.value = String(max);
      valueElement.textContent = String(current);
      display.setAttribute('aria-label', `Random number ${current}`);
      scheduleFit();
    };

    const announceChange = reason => {
      if (typeof notifyBoardChanged === 'function') notifyBoardChanged(reason);
    };

    const commitRange = ({ generate = true, notify = true } = {}) => {
      [min, max] = normalizeRange(minInput.value, maxInput.value);
      if (generate || current < min || current > max) current = randomInclusive(min, max);
      render();
      if (notify) announceChange('random-number-range');
    };

    const generate = () => {
      [min, max] = normalizeRange(minInput.value, maxInput.value);
      current = randomInclusive(min, max);
      render();
      announceChange('random-number-generate');
    };

    generateButton.addEventListener('click', generate);
    minInput.addEventListener('change', () => commitRange());
    maxInput.addEventListener('change', () => commitRange());
    for (const input of [minInput, maxInput]) {
      input.addEventListener('keydown', event => {
        event.stopPropagation();
        if (event.key === 'Enter') {
          event.preventDefault();
          commitRange();
          input.blur();
        }
      });
    }

    module._boardGetState = () => ({ min, max, value: current });
    module._boardSetState = state => {
      [min, max] = normalizeRange(state?.min ?? 1, state?.max ?? 100);
      const saved = normalizeInteger(state?.value, NaN);
      current = Number.isInteger(saved) && saved >= min && saved <= max ? saved : randomInclusive(min, max);
      render();
    };

    const resizeObserver = new ResizeObserver(scheduleFit);
    resizeObserver.observe(module);

    const refitAfterRestore = () => settleFit();
    window.addEventListener?.('teachertiles:boardloaded', refitAfterRestore);
    window.addEventListener?.('pageshow', refitAfterRestore);
    window.addEventListener?.('load', refitAfterRestore);
    if (typeof document !== 'undefined' && document.fonts?.ready?.then) {
      document.fonts.ready.then(() => { if (!disposed) settleFit(); });
    }

    const priorAfterResize = module._afterModuleResize;
    module._afterModuleResize = () => {
      priorAfterResize?.();
      settleFit();
    };

    const priorCleanup = module._cleanup;
    module._cleanup = () => {
      disposed = true;
      resizeObserver.disconnect();
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      if (settleFrame) cancelAnimationFrame(settleFrame);
      window.removeEventListener?.('teachertiles:boardloaded', refitAfterRestore);
      window.removeEventListener?.('pageshow', refitAfterRestore);
      window.removeEventListener?.('load', refitAfterRestore);
      priorCleanup?.();
    };

    render();
    settleFit();
  }

  class TeacherTilesRandomNumberElement extends HTMLElement {
    connectedCallback() {
      setup(this);
    }
  }

  if (!customElements.get('teacher-random-number')) {
    customElements.define('teacher-random-number', TeacherTilesRandomNumberElement);
  }

  window.TeacherTilesRandomNumber = Object.freeze({ setup, randomInclusive, normalizeRange });
})();
