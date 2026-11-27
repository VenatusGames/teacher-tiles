(() => {
  'use strict';
  const sides = Object.freeze([
    {letter:'נ', name:'Nun'}, {letter:'ג', name:'Gimel'},
    {letter:'ה', name:'Hei'}, {letter:'ש', name:'Shin'}
  ]);
  const types = new Set(['dreidel', 'menorah']);
  let artId = 0;
  const colors = Object.freeze({
    blue:[210,62,'#367bbc'], red:[3,65,'#c74740'], orange:[28,80,'#df8a31'],
    yellow:[45,83,'#dab231'], green:[142,43,'#389d65'], purple:[273,48,'#9560bf'],
    pink:[329,62,'#d45d9a'], charcoal:[218,12,'#657184']
  });
  function colorKey(value) {
    return Object.hasOwn(colors, value) ? value : 'blue';
  }
  function applyColor(m, value) {
    const color = colors[colorKey(value)];
    const body = m.querySelector('.dreidel-object');
    body.style.setProperty('--dreidel-hue', color[0]);
    body.style.setProperty('--dreidel-saturation', color[1]+'%');
  }
  function setupColorDrawer(m, choose) {
    const toggle = m.querySelector('.dreidel-colors-toggle');
    const drawer = m.querySelector('.dreidel-color-drawer');
    let frame = 0;
    function close() {
      cancelAnimationFrame(frame);
      if (drawer.matches(':popover-open')) drawer.hidePopover();
      drawer.hidden = true;
      toggle.setAttribute('aria-expanded','false');
    }
    function position() {
      if (!m.isConnected || drawer.hidden) {close();return;}
      const rect = toggle.getBoundingClientRect();
      drawer.style.left = Math.max(8,Math.min(rect.right-drawer.offsetWidth,innerWidth-drawer.offsetWidth-8))+'px';
      drawer.style.top = Math.max(8,Math.min(rect.top-drawer.offsetHeight-8,innerHeight-drawer.offsetHeight-8))+'px';
      frame = requestAnimationFrame(position);
    }
    for (const [key, color] of Object.entries(colors)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.color = key;
      button.setAttribute('aria-label',key[0].toUpperCase()+key.slice(1));
      button.innerHTML = '<i class="timer-shelf-swatch"></i><span></span>';
      button.querySelector('i').style.background = color[2];
      button.querySelector('span').textContent = key[0].toUpperCase()+key.slice(1);
      button.addEventListener('click', () => {choose(key);close();notifyBoardChanged('dreidel-color');});
      drawer.append(button);
    }
    toggle.addEventListener('click', () => {
      if (!drawer.hidden) {close();return;}
      drawer.hidden = false;drawer.showPopover();
      toggle.setAttribute('aria-expanded','true');position();
    });
    const outside = event => {if (!drawer.contains(event.target)&&!toggle.contains(event.target)) close();};
    const escape = event => {
      if (event.key === 'Escape'&&!drawer.hidden) {
        event.stopPropagation();close();toggle.focus({preventScroll:true});
      }
    };
    drawer.addEventListener('pointerdown', event => event.stopPropagation());
    document.addEventListener('pointerdown',outside);
    document.addEventListener('keydown',escape);
    const cleanup = m._cleanup, deactivate = m._deactivate;
    m._cleanup = () => {close();document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);cleanup?.();};
    m._deactivate = () => {close();deactivate?.();};
    return key => {
      toggle.querySelector('.timer-color-swatch').style.background = colors[key][2];
      drawer.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.color === key)));
    };
  }

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
    applyColor(m, state.color);
    const result = sideIndex(state.result), side = sides[result];
    button.querySelector('.dreidel-object').style.transform = 'rotateX(-12deg) rotateY('+(18-result*90)+'deg)';
    button.setAttribute('aria-label', side.name + '. Spin dreidel');
    button.removeAttribute('aria-busy');
    m.querySelector('.dreidel-result').textContent = side.letter + ' · ' + side.name;
  }
  function setupDreidel(m) {
    const button = m.querySelector('.dreidel-spin');
    const popup = m.querySelector('.dreidel-result-popup');
    let result = 0, spin = null, color = 'blue';
    renderDreidel(m);
    const body = button.querySelector('.dreidel-object');
    const syncDrawer = setupColorDrawer(m, key => {color = colorKey(key);applyColor(m,color);syncDrawer(color);});
    syncDrawer(color);
    function dismissResult() {popup.hidden = true;}
    function settle(showResult = false) {
      spin?.cancel();
      spin = null;
      m.classList.remove('is-dreidel-spinning');
      renderDreidel(m, {result, color});
      popup.hidden = !showResult;
    }
    function startSpin() {
      if (spin) return;
      dismissResult();
      const previous = result;
      result = crypto.getRandomValues(new Uint32Array(1))[0] % 4;
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        settle(true);
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
        spin.onfinish = () => settle(true);
      }
      notifyBoardChanged('dreidel-spin');
    }
    button.addEventListener('click', event => {event.stopPropagation();startSpin();});
    popup.querySelector('.dreidel-spin-again').addEventListener('click', event => {event.stopPropagation();startSpin();});
    popup.querySelector('.dreidel-result-close').addEventListener('click', event => {event.stopPropagation();dismissResult();button.focus({preventScroll:true});});
    const outside = event => {if (!m.contains(event.target)) dismissResult();};
    const escape = event => {if (event.key === 'Escape'&&!popup.hidden) {event.stopPropagation();dismissResult();button.focus({preventScroll:true});}};
    m.addEventListener('click', event => {if (!popup.contains(event.target)) dismissResult();});
    m.addEventListener('keydown',escape);
    document.addEventListener('pointerdown',outside);
    m._boardGetState = () => ({result, color});
    m._boardSetState = state => {result = sideIndex(state?.result);color = colorKey(state?.color);syncDrawer(color);settle();};
    const deactivate = m._deactivate, cleanup = m._cleanup;
    m._deactivate = () => {settle(); deactivate?.();};
    m._cleanup = () => {settle();document.removeEventListener('pointerdown',outside);cleanup?.();};
  }
  function menorahArt() {
    const id = 'hanukkah-art-' + (++artId);
    const positions = [45,94,143,192,240,288,337,386,435];
    const wax = [
      ['#a42123','#e85039','#ffb28b'], ['#bb650c','#f5a125','#ffe293'],
      ['#145573','#318eb0','#9cdbec'], ['#27645c','#579e87','#b9e1c4'],
      ['#c7ac6c','#f5e3ac','#fffbee'], ['#bb650c','#f5a125','#ffe293'],
      ['#a42123','#e85039','#ffb28b'], ['#195c64','#368d96','#a4d9d6'],
      ['#a42123','#e85039','#ffb28b']
    ];
    // Every branch rises continuously from the central stem to its candle cup.
    const arms = [0,1,2,3].map(i => {
      const x = positions[i], join = 440-i*27;
      return '<path d="M240 '+join+' C'+(210-i*8)+' '+(join-48)+' '+x+' '+(join-43)+' '+x+' 249"/>' +
        '<path d="M240 '+join+' C'+(270+i*8)+' '+(join-48)+' '+(480-x)+' '+(join-43)+' '+(480-x)+' 249"/>';
    }).join('');
    const gradients = wax.map((color,i) =>
      '<linearGradient id="'+id+'-wax-'+i+'"><stop stop-color="'+color[0]+'"/><stop offset=".28" stop-color="'+color[1]+'"/><stop offset=".48" stop-color="'+color[2]+'"/><stop offset=".75" stop-color="'+color[1]+'"/><stop offset="1" stop-color="'+color[0]+'"/></linearGradient>'
    ).join('');
    const candles = positions.map((x, i) => {
      const y = i === 4 ? 77 : 121, length = 218-y;
      const name = i === 4 ? 'Shamash' : 'Candle '+(i < 4 ? i+1 : i);
      const spiral = 'M-8 0 C-16 6-14 13-9 19 C-15 25-15 33-9 39 C-15 45-15 53-9 59 C-15 65-15 73-9 79 C-14 86-12 92-8 97 L8 97 C16 91 14 84 9 79 C15 73 15 65 9 59 C15 53 15 45 9 39 C15 33 15 25 9 19 C14 12 14 5 8 0Z';
      const waxBody = i === 4
        ? '<rect x="-11" y="0" width="22" height="'+length+'" rx="8" fill="url(#'+id+'-wax-'+i+')"/><path d="M-5 9v'+(length-18)+'" stroke="#fff8df" opacity=".6" stroke-width="2" stroke-linecap="round"/>'
        : '<path d="'+spiral+'" fill="url(#'+id+'-wax-'+i+')"/>' +
          Array.from({length:5},(_,j) => '<path d="M-8 '+(j*20+4)+' C-12 '+(j*20+14)+' 9 '+(j*20+11)+' 9 '+(j*20+20)+'" fill="none" stroke="'+wax[i][0]+'" stroke-opacity=".5" stroke-width="3"/><path d="M-5 '+(j*20+3)+'q-7 7-2 12" fill="none" stroke="'+wax[i][2]+'" stroke-opacity=".75" stroke-width="3" stroke-linecap="round"/>').join('');
      return '<g class="menorah-candle" data-candle="'+i+'" role="button" tabindex="0" aria-label="Light '+name+'" aria-pressed="false" style="--flicker-delay:-'+(i*.23)+'s">' +
        '<title>'+name+'</title><rect class="menorah-hit" x="'+(x-22)+'" y="'+(y-57)+'" width="44" height="'+(length+81)+'" rx="18"/>' +
        '<g class="menorah-flame" transform="translate('+x+' '+(y-5)+')"><ellipse class="menorah-glow" cy="-23" rx="24" ry="34" fill="#ffc65d" opacity=".12"/>' +
        '<g class="menorah-flame-dance"><path d="M0-51C-4-36-19-29-16-15C-13 4 13 4 16-15C19-29 4-38 0-51Z" fill="#ffcc32"/><path d="M0-41C-4-29-13-24-10-12C-7 1 9 0 11-13C12-24 3-30 0-41Z" fill="#f88716"/><path d="M0-30C-2-20-8-14-6-7C-4 2 5 2 7-7C9-15 3-21 0-30Z" fill="#ffe36d"/><path d="M0-17C-2-11-5-6-3-2Q0 3 4-2C5-7 2-11 0-17Z" fill="#fff9d9"/></g></g>' +
        '<g transform="translate('+x+' '+y+')"><path d="M0 3v-8" stroke="#655037" stroke-width="2.7" stroke-linecap="round"/>'+waxBody+'</g>' +
        '<g fill="url(#'+id+'-gold)" stroke="#b77b1b" stroke-width="1.2"><path d="M'+(x-18)+' 219h36l-4 13q-14 10-28 0Z"/><rect x="'+(x-20)+'" y="216" width="40" height="5" rx="2.5"/><rect x="'+(x-12)+'" y="239" width="24" height="7" rx="3"/><rect x="'+(x-14)+'" y="248" width="28" height="5" rx="2"/><rect x="'+(x-12)+'" y="255" width="24" height="5" rx="2"/></g>' +
        '</g>';
    }).join('');
    return '<svg class="menorah-art" viewBox="0 0 480 535" xmlns="http://www.w3.org/2000/svg" aria-label="Menorah with eight candles and a taller shamash">' +
      '<defs><linearGradient id="'+id+'-gold"><stop stop-color="#a76113"/><stop offset=".18" stop-color="#eaa327"/><stop offset=".38" stop-color="#ffe89b"/><stop offset=".52" stop-color="#fff2b6"/><stop offset=".68" stop-color="#f4bb3d"/><stop offset="1" stop-color="#b67515"/></linearGradient>' +
      '<linearGradient id="'+id+'-base" x2="0" y2="1"><stop stop-color="#ffe4a0"/><stop offset=".4" stop-color="#edb53d"/><stop offset=".75" stop-color="#d08b17"/><stop offset="1" stop-color="#a36213"/></linearGradient>'+gradients+'</defs>' +
      '<ellipse cx="240" cy="517" rx="121" ry="8" fill="#573c18" opacity=".10"/>' +
      '<g fill="none" stroke="#af7219" stroke-width="17" stroke-linecap="round">'+arms+'</g>' +
      '<g fill="none" stroke="url(#'+id+'-gold)" stroke-width="13" stroke-linecap="round">'+arms+'</g>' +
      '<path d="M181 443C166 436 179 419 196 427L240 449L284 427C301 419 314 436 299 443" fill="none" stroke="#b97c1c" stroke-width="13" stroke-linecap="round"/>' +
      '<path d="M181 441C170 431 182 423 196 430L240 452L284 430C298 423 310 431 299 441" fill="none" stroke="url(#'+id+'-gold)" stroke-width="8" stroke-linecap="round"/>' +
      '<path d="M232 242h16v210h-16Z" fill="url(#'+id+'-gold)" stroke="#b97c1c" stroke-width="1"/>' +
      '<g fill="url(#'+id+'-gold)" stroke="#ac7019" stroke-width="1.2"><ellipse cx="240" cy="453" rx="23" ry="8"/><rect x="213" y="456" width="54" height="8" rx="4"/><ellipse cx="240" cy="466" rx="31" ry="7"/></g>' +
      '<path d="M205 473Q240 463 275 473L311 502H169Z" fill="url(#'+id+'-base)" stroke="#a76814" stroke-width="2"/>' +
      '<path d="M175 496Q193 473 209 483C227 494 193 503 191 491C191 484 207 484 211 492M305 496Q287 473 271 483C253 494 287 503 289 491C289 484 273 484 269 492M228 497Q240 473 252 497M235 498l5-13 5 13" fill="none" stroke="#a86a16" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M161 501h158l19 9H142Z" fill="url(#'+id+'-gold)" stroke="#bd841b" stroke-width="2"/><rect x="138" y="509" width="204" height="7" rx="3" fill="#8f5814"/>' +
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
    m.querySelector('.hanukkah-heading').classList.toggle('tile-heading-hidden',state.dataset?.tileHeadingHidden !== 'false');
    m.classList.add('hanukkah-static-preview');
  }
  window.TeacherTilesHanukkah = Object.freeze({types, setup, preview});
})();
