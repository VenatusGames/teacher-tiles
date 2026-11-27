(() => {
  'use strict';
  if(window.TeacherTilesChristmasTimer)return;
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
    return '<svg viewBox="0 0 100 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="'+id+'"><stop stop-color="#b78c3c"/><stop offset=".32" stop-color="#edd18c"/><stop offset=".62" stop-color="#dfbd6d"/><stop offset="1" stop-color="#aa7f31"/></linearGradient></defs>' +
      '<path d="M46 12V6a4 4 0 0 1 8 0v6" fill="none" stroke="#a7833b" stroke-width="2"/>' +
      '<path d="M40 12Q50 9 60 12L63 21Q50 25 37 21Z" fill="url(#'+id+')" stroke="#9e7836" stroke-width=".65"/>' +
      '<path d="M43 13l-1 8m5-9-.3 10m6-10 .3 10m4-9 1 8" fill="none" stroke="#9c7535" stroke-opacity=".4" stroke-width=".8"/>' +
      '<path d="M37 21Q50 25 63 21" fill="none" stroke="#8e682e" stroke-opacity=".55" stroke-width=".9"/></svg>';
  }
  function kind(m) {
    if(m.dataset.tileSkin==='christmastimer-snowman')return 'snowman';
    if(m.dataset.tileSkin==='christmastimer-cookies')return 'cookies';
    return 'ornament';
  }
  function choices(m) {
    const type=kind(m);
    return type==='snowman'?TeacherTilesChristmasArt.snowmen:type==='cookies'?TeacherTilesChristmasArt.cookies:colors;
  }
  function contents(svg) {return svg.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');}
  function sweep(progress) {
    const p=Math.max(0,Math.min(1,Number(progress)||0));
    if(p>=1)return 'M-40-40H140V140H-40Z';
    if(p<=0)return 'M50 50Z';
    const a=-Math.PI+p*Math.PI*2;
    return 'M50 50L-30 50A80 80 0 '+(p>.5?1:0)+' 1 '+(50+80*Math.cos(a))+' '+(50+80*Math.sin(a))+'Z';
  }
  function artwork(type,key,progress=1) {
    const art=TeacherTilesChristmasArt,id='christmas-art-'+(++serial);
    const options=type==='snowman'?art.snowmen:type==='cookies'?art.cookies:colors;
    key=Object.hasOwn(options,key)?key:Object.keys(options)[0];
    const body=type==='snowman'?art.snowman(key,id):type==='cookies'?art.cookie(key,id):contents(ball(key));
    const base=type==='snowman'?art.snowman(key,id+'-base'):type==='cookies'?art.cookie(key,id+'-base'):contents(ball(key));
    const path=type==='cookies'?art.paths[key]:art.circle;
    const edge=type==='ornament'?colors[key].dark:type==='snowman'?'#7d9bb3':'#94602f';
    const top=type==='ornament'?'<g class="ornament-cap" transform="translate(0 -14) translate(50 18) scale(1.16) translate(-50 -18)">'+contents(cap())+'</g>':'';
    return '<svg class="christmas-art-svg" viewBox="'+(type==='ornament'?'0 -20 100 120':'0 0 100 100')+'" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><clipPath id="'+id+'-sweep"><path class="christmas-sweep" d="'+sweep(progress)+'"/></clipPath></defs><g class="christmas-base" opacity=".27">'+base+'</g><g clip-path="url(#'+id+'-sweep)">'+body+'</g><path class="christmas-outline" d="'+path+'" fill="none" stroke="'+edge+'" stroke-width="1.2"/>'+top+'</svg>';
  }
  function icon(key,type='ornament') {
    return '<span class="ornament-mini'+(type==='ornament'?'':' ornament-mini--round')+'">'+artwork(type,key)+'</span>';
  }
  function label(m) {return kind(m)==='snowman'?'Snowman Face':kind(m)==='cookies'?'Christmas Cookie':'Ornament Color';}
  function updateProgress(m,progress) {
    m.querySelector('.ornament-timer-art .christmas-sweep')?.setAttribute('d',sweep(progress));
  }
  function render(m) {
    const type=kind(m),options=choices(m);
    const key=Object.hasOwn(options,m.dataset.shapeColor)?m.dataset.shapeColor:Object.keys(options)[0];
    m.dataset.shapeColor=key;m.dataset.christmasArt=type;
    m.style.setProperty('--timer',options[key].color||options[key].accent);
    const visual=m.querySelector('.timer-visual');
    let art=visual.querySelector('.ornament-timer-art');
    if(!art){art=document.createElement('div');art.className='ornament-timer-art';art.setAttribute('aria-hidden','true');visual.append(art);}
    art.innerHTML=artwork(type,key,m.style.getPropertyValue('--timer-progress-ratio'));
  }
  function preview(m) {
    render(m);
    const readout = m.querySelector('.timer-readout');
    if (readout) m.querySelector('.timer-stage').prepend(readout);
  }
  window.TeacherTilesChristmasTimer = Object.freeze({colors,render,preview,icon,kind,choices,label,artwork,updateProgress});
})();
