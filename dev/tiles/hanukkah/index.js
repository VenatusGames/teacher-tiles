(() => {
  'use strict';
  const sides = Object.freeze([
    {letter:'נ', name:'Nun'}, {letter:'ג', name:'Gimel'},
    {letter:'ה', name:'Hei'}, {letter:'ש', name:'Shin'}
  ]);
  const types = new Set(['dreidel', 'menorah']);
  let artId = 0;
  function sideIndex(value) {
    return Number.isInteger(value) && value >= 0 && value < 4 ? value : 0;
  }
  function candlesFrom(state) {
    return Array.from({length:9}, (_, i) => state?.candles?.[i] === true);
  }
  function dreidelArt() {
    return '<span class="dreidel-shadow"></span><span class="dreidel-object" aria-hidden="true">' +
      sides.map((side, i) => '<span class="dreidel-face" style="--face:'+i+'"><b lang="he">'+side.letter+'</b></span><span class="dreidel-tip" style="--face:'+i+'"></span><span class="dreidel-stem" style="--face:'+i+'"></span>').join('') +
      '<span class="dreidel-top"></span><span class="dreidel-stem-top"></span></span>';
  }
  function renderDreidel(m, state = {}) {
    const button = m.querySelector('.dreidel-spin');
    if (!button.firstElementChild) button.innerHTML = dreidelArt();
    const result = sideIndex(state.result), side = sides[result];
    button.querySelector('.dreidel-object').style.transform = 'rotateX(-12deg) rotateY('+(18-result*90)+'deg)';
    button.setAttribute('aria-label', side.name + '. Spin dreidel');
    button.removeAttribute('aria-busy');
    m.querySelector('.dreidel-result').textContent = side.letter + ' · ' + side.name;
  }
  function setupDreidel(m) {
    const button = m.querySelector('.dreidel-spin');
    let result = 0, spin = null;
    renderDreidel(m);
    const body = button.querySelector('.dreidel-object');
    function settle() {
      spin?.cancel();
      spin = null;
      m.classList.remove('is-dreidel-spinning');
      renderDreidel(m, {result});
    }
    function startSpin() {
      if (spin) return;
      const previous = result;
      result = crypto.getRandomValues(new Uint32Array(1))[0] % 4;
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        settle();
      } else {
        button.setAttribute('aria-busy', 'true');
        m.classList.add('is-dreidel-spinning');
        m.querySelector('.dreidel-result').textContent = 'Spinning…';
        const from = 18 - previous * 90;
        const to = from + 1800 + ((previous - result + 4) % 4) * 90;
        spin = body.animate([
          {transform:'rotateX(-12deg) rotateY('+from+'deg) rotateZ(0deg)'},
          {transform:'rotateX(-8deg) rotateY('+(from+(to-from)*.72)+'deg) rotateZ(-4deg)', offset:.46},
          {transform:'rotateX(-16deg) rotateY('+(from+(to-from)*.96)+'deg) rotateZ(3deg)', offset:.8},
          {transform:'rotateX(-12deg) rotateY('+to+'deg) rotateZ(0deg)'}
        ], {duration:2400, easing:'cubic-bezier(.18,.65,.28,1)'});
        spin.onfinish = settle;
      }
      notifyBoardChanged('dreidel-spin');
    }
    button.addEventListener('click', startSpin);
    m._boardGetState = () => ({result});
    m._boardSetState = state => {result = sideIndex(state?.result); settle();};
    const deactivate = m._deactivate, cleanup = m._cleanup;
    m._deactivate = () => {settle(); deactivate?.();};
    m._cleanup = () => {settle(); cleanup?.();};
  }
  function menorahArt() {
    const id = 'hanukkah-art-' + (++artId);
    const positions = [60,130,200,270,340,410,480,550,620];
    const arms = [0,1,2,3].map(i => {
      const x = positions[i], base = 330-i*28;
      return '<path d="M'+x+' 187 V'+(base-55)+' Q'+x+' '+base+' 340 '+base+' Q'+(680-x)+' '+base+' '+(680-x)+' '+(base-55)+' V187"/>';
    }).join('');
    const candles = positions.map((x, i) => {
      const y = i === 4 ? 55 : 115, name = i === 4 ? 'Shamash' : 'Candle '+(i < 4 ? i+1 : i);
      return '<g class="menorah-candle" data-candle="'+i+'" role="button" tabindex="0" aria-label="Light '+name+'" aria-pressed="false" style="--flicker-delay:-'+(i*.23)+'s">' +
        '<title>'+name+'</title><rect class="menorah-hit" x="'+(x-27)+'" y="'+(y-47)+'" width="54" height="132" rx="20"/>' +
        '<g class="menorah-flame" transform="translate('+x+' '+y+')"><ellipse class="menorah-glow" cy="-22" rx="26" ry="35" fill="#ffc65d" opacity=".18"/>' +
        '<g class="menorah-flame-dance"><path d="M0 -45 C-4 -31 -16 -23 -12 -11 C-9 1 10 1 13 -12 C16 -24 5 -31 0 -45Z" fill="url(#'+id+'-flame)"/><path d="M0 -22 C-1 -15 -7 -10 -5 -5 C-2 1 5 0 6 -6 C7 -12 2 -16 0 -22Z" fill="#fff9df"/></g></g>' +
        '<path d="M'+x+' '+(y+7)+'v-9" stroke="#524233" stroke-width="3" stroke-linecap="round"/>' +
        '<rect x="'+(x-11)+'" y="'+(y+6)+'" width="22" height="63" rx="5" fill="url(#'+id+'-wax)"/>' +
        '<path d="M'+(x-6)+' '+(y+14)+'v42" stroke="#fff" opacity=".65" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M'+(x-16)+' '+(y+68)+'h32l-5 11h-22Z" fill="url(#'+id+'-gold)"/>' +
        '</g>';
    }).join('');
    return '<svg class="menorah-art" viewBox="0 0 680 420" xmlns="http://www.w3.org/2000/svg" aria-label="Menorah with eight candles and a raised shamash">' +
      '<defs><linearGradient id="'+id+'-gold" x1="0" x2="1"><stop stop-color="#a26c27"/><stop offset=".32" stop-color="#e1b66a"/><stop offset=".52" stop-color="#fff0b8"/><stop offset=".74" stop-color="#d7a54e"/><stop offset="1" stop-color="#a66d26"/></linearGradient>' +
      '<linearGradient id="'+id+'-wax"><stop stop-color="#aac8ea"/><stop offset=".35" stop-color="#eff7ff"/><stop offset="1" stop-color="#749dce"/></linearGradient>' +
      '<linearGradient id="'+id+'-flame" x2="0" y2="1"><stop stop-color="#ffad35"/><stop offset=".65" stop-color="#ffdc73"/><stop offset="1" stop-color="#fff5c7"/></linearGradient></defs>' +
      '<ellipse cx="340" cy="393" rx="188" ry="12" fill="#283956" opacity=".09"/>' +
      '<g fill="none" stroke="#9e6a28" stroke-width="17" stroke-linecap="round" stroke-linejoin="round">'+arms+'<path d="M340 135V374"/></g>' +
      '<g fill="none" stroke="url(#'+id+'-gold)" stroke-width="12" stroke-linecap="round" stroke-linejoin="round">'+arms+'<path d="M340 135V374"/></g>' +
      '<path d="M340 347c-14 22-28 26-71 29l-13 14h168l-13-14c-43-3-57-7-71-29Z" fill="url(#'+id+'-gold)" stroke="#a97834" stroke-width="2"/>' +
      candles + '</svg>';
  }
  function renderCandles(m, state = {}) {
    const lit = candlesFrom(state);
    m.querySelectorAll('[data-candle]').forEach((candle, i) => {
      const name = i === 4 ? 'Shamash' : 'Candle ' + (i < 4 ? i+1 : i);
      candle.classList.toggle('is-lit', lit[i]);
      candle.setAttribute('aria-pressed', String(lit[i]));
      candle.setAttribute('aria-label', (lit[i] ? 'Extinguish ' : 'Light ') + name);
    });
  }
  function renderMenorah(m, state = {}) {
    m.querySelector('.menorah-stage').innerHTML = menorahArt();
    renderCandles(m, state);
  }
  function setupMenorah(m) {
    let candles = candlesFrom();
    renderMenorah(m);
    function toggle(candle) {
      const index = Number(candle.dataset.candle);
      candles[index] = !candles[index];
      renderCandles(m, {candles});
      notifyBoardChanged('menorah-candle');
    }
    m.querySelectorAll('[data-candle]').forEach(candle => {
      candle.addEventListener('pointerdown', event => event.stopPropagation());
      candle.addEventListener('click', event => {event.stopPropagation(); toggle(candle);});
      candle.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault(); event.stopPropagation(); toggle(candle);
        }
      });
    });
    m._boardGetState = () => ({candles:[...candles]});
    m._boardSetState = state => {candles = candlesFrom(state); renderCandles(m, {candles});};
  }
  function setup(m) {
    if (m.dataset.type === 'dreidel') setupDreidel(m);
    else setupMenorah(m);
  }
  function preview(m, state) {
    if (state.type === 'dreidel') renderDreidel(m, state.special);
    else renderMenorah(m, state.special);
    m.classList.add('hanukkah-static-preview');
  }
  window.TeacherTilesHanukkah = Object.freeze({types, setup, preview});
})();
