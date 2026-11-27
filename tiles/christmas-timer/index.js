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
  let serial = 0;
  function colorKey(value) {return Object.hasOwn(colors,value) ? value : 'red';}
  function ball(color) {
    const option = colors[colorKey(color)], id = 'ornament-'+(++serial);
    return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>' +
      '<radialGradient id="'+id+'-glass" cx=".3" cy=".23" r=".78"><stop stop-color="'+option.light+'"/><stop offset=".35" stop-color="'+option.color+'"/><stop offset=".78" stop-color="'+option.dark+'"/><stop offset="1" stop-color="'+option.color+'"/></radialGradient>' +
      '<linearGradient id="'+id+'-rim" x2="1" y2="1"><stop stop-color="#fff" stop-opacity=".7"/><stop offset=".45" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#fff" stop-opacity=".3"/></linearGradient></defs>' +
      '<circle cx="50" cy="50" r="45" fill="url(#'+id+'-glass)" stroke="'+option.dark+'" stroke-width="1.2"/>' +
      '<path d="M8 39Q50 57 92 39M7 44Q50 62 93 44" fill="none" stroke="#ffe2a4" stroke-width="1.2" opacity=".75"/>' +
      '<g fill="#ffe8b3" opacity=".9"><path d="m24 60 1.5 4.5L30 66l-4.5 1.5L24 72l-1.5-4.5L18 66l4.5-1.5ZM50 67l2 5 5 2-5 2-2 5-2-5-5-2 5-2ZM76 60l1.5 4.5L82 66l-4.5 1.5L76 72l-1.5-4.5L70 66l4.5-1.5Z"/></g>' +
      '<ellipse cx="30" cy="25" rx="12" ry="7" transform="rotate(-35 30 25)" fill="#fff" opacity=".58"/>' +
      '<path d="M19 42Q13 57 22 68" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".23" fill="none"/>' +
      '<circle cx="50" cy="50" r="43.8" fill="none" stroke="url(#'+id+'-rim)" stroke-width="1.3"/></svg>';
  }
  function cap() {
    const id = 'ornament-cap-'+(++serial);
    return '<svg viewBox="0 0 100 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="'+id+'"><stop stop-color="#a06c25"/><stop offset=".25" stop-color="#ffe3a0"/><stop offset=".5" stop-color="#f4d17c"/><stop offset=".8" stop-color="#c48b33"/><stop offset="1" stop-color="#f7de96"/></linearGradient></defs>' +
      '<path d="M45 11V7a5 5 0 0 1 10 0v4" fill="none" stroke="#aa782e" stroke-width="2.4"/><path d="M46 10V7a4 4 0 0 1 8 0" fill="none" stroke="#ffe3a0" stroke-width="1"/>' +
      '<path d="M39 12Q50 9 61 12l2 10Q50 25 37 22Z" fill="url(#'+id+')" stroke="#ad792e" stroke-width=".7"/><path d="M41 13v8m4-9v10m5-10v11m5-11v10m4-9v8" stroke="#a97426" opacity=".45" stroke-width=".8"/><path d="M38 21q12 3 24 0" stroke="#ffe8b3" fill="none" stroke-width="1.5"/></svg>';
  }
  function icon(color) {
    return '<span class="ornament-mini">'+ball(color)+'<span class="ornament-mini-cap">'+cap()+'</span></span>';
  }
  function render(m) {
    const key = colorKey(m.dataset.shapeColor);
    m.dataset.shapeColor = key;
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
