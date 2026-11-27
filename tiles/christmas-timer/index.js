(() => {
  'use strict';
  const colors = Object.freeze({
    red:{name:'Red',light:'#ffb0a0',color:'#d72d41',dark:'#750d27'},
    green:{name:'Green',light:'#b0e4bb',color:'#278d5d',dark:'#0d4437'},
    blue:{name:'Blue',light:'#b2dafa',color:'#357fcb',dark:'#163b78'},
    gold:{name:'Gold',light:'#fff0b0',color:'#dca837',dark:'#8b5712'},
    silver:{name:'Silver',light:'#ffffff',color:'#b4c3d2',dark:'#566779'},
    purple:{name:'Purple',light:'#e1baf6',color:'#9861c0',dark:'#4b286c'},
    pink:{name:'Pink',light:'#ffd0e3',color:'#db679e',dark:'#842c64'},
    teal:{name:'Teal',light:'#adf1e5',color:'#329d9c',dark:'#14585e'}
  });
  function colorKey(value) {return Object.hasOwn(colors,value) ? value : 'red';}
  let serial = 0;
  function ball(color) {
    const option = colors[colorKey(color)], id = 'ornament-glass-'+(++serial);
    return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>' +
      '<radialGradient id="'+id+'" cx=".3" cy=".23" r=".78"><stop stop-color="'+option.light+'"/><stop offset=".35" stop-color="'+option.color+'"/><stop offset=".78" stop-color="'+option.dark+'"/><stop offset="1" stop-color="'+option.color+'"/></radialGradient></defs>' +
      '<circle cx="50" cy="50" r="47" fill="url(#'+id+')" stroke="'+option.dark+'" stroke-width="1.2"/></svg>';
  }
  function cap() {
    const id = 'ornament-cap-'+(++serial);
    return '<svg viewBox="0 0 100 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="'+id+'"><stop stop-color="#d0a74e"/><stop offset=".4" stop-color="#f1d793"/><stop offset="1" stop-color="#c9a04a"/></linearGradient></defs>' +
      '<path d="M45 12V7a5 5 0 0 1 10 0v5" fill="none" stroke="#b28b43" stroke-width="2.6"/><rect x="39" y="11" width="22" height="13" rx="2" fill="url(#'+id+')" stroke="#b28b43" stroke-width=".7"/>' +
      '<path d="M44 14v7m6-7v7m6-7v7" stroke="#aa823c" stroke-opacity=".4" stroke-width=".8" stroke-linecap="round"/></svg>';
  }
  function icon(color) {
    return '<span class="ornament-mini">'+ball(color)+'<span class="ornament-mini-cap">'+cap()+'</span></span>';
  }
  function render(m) {
    const key = colorKey(m.dataset.shapeColor);
    m.dataset.shapeColor = key;
    // Keep the timer aura matched to the selected ornament color.
    m.style.setProperty('--timer',colors[key].color);
    m.style.setProperty('--timer-soft','color-mix(in srgb, '+colors[key].color+' 18%, var(--module-bg, #fff))');
    const visual = m.querySelector('.timer-visual');
    let art = visual.querySelector('.ornament-timer-art');
    if (!art) {
      art = document.createElement('div');
      art.className = 'ornament-timer-art';
      art.setAttribute('aria-hidden','true');
      visual.append(art);
    }
    art.innerHTML = '<div class="ornament-base">'+ball(key)+'</div><div class="ornament-filled">'+ball(key)+'</div><div class="ornament-cap">'+cap()+'</div>';
  }
  function preview(m) {
    render(m);
    const readout = m.querySelector('.timer-readout');
    if (readout) m.querySelector('.timer-stage').prepend(readout);
  }
  window.TeacherTilesChristmasTimer = Object.freeze({colors,render,preview,icon});
})();
