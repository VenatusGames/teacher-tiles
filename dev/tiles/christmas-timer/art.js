(() => {
  'use strict';
  const snowmen = Object.freeze({
    classic:{name:'Classic',accent:'#d84b56'}, cheerful:{name:'Cheerful',accent:'#4c9b79'},
    sleepy:{name:'Sleepy',accent:'#8293d4'}, wink:{name:'Wink',accent:'#d576a2'},
    surprised:{name:'Surprised',accent:'#52a7bc'}, rosy:{name:'Rosy',accent:'#dc9a3e'}
  });
  const cookies = Object.freeze({
    gingerbread:{name:'Gingerbread',accent:'#b8793d'}, tree:{name:'Christmas Tree',accent:'#479774'},
    star:{name:'Christmas Star',accent:'#e7b746'}, snowflake:{name:'Snowflake',accent:'#79b5cf'},
    stocking:{name:'Stocking',accent:'#cc5263'}, bell:{name:'Christmas Bell',accent:'#dfa549'}
  });
  const circle = 'M50 3a47 47 0 1 1-.001 0Z';
  const paths = Object.freeze(Object.fromEntries(Object.keys(cookies).map(key=>[key,circle])));
  function coal(x,y,r=2) {return `<circle cx="${x}" cy="${y}" r="${r}" fill="#354458"/>`;}
  function snowman(key,id) {
    const v=snowmen[key]||snowmen.classic;
    let eyes=coal(34,44,3)+coal(66,44,3);
    if(key==='sleepy')eyes='<path d="M29 45q5-6 10 0m22 0q5-6 10 0" fill="none" stroke="#354458" stroke-width="2.5" stroke-linecap="round"/>';
    if(key==='wink')eyes=coal(34,44,3)+'<path d="M61 45q5-6 10 0" fill="none" stroke="#354458" stroke-width="2.5" stroke-linecap="round"/>';
    const mouth=key==='surprised'?'<ellipse cx="50" cy="73" rx="5" ry="7" fill="#354458"/>':[[33,66],[40,72],[50,74],[60,72],[67,66]].map(([x,y])=>coal(x,y,key==='cheerful'?2.8:2)).join('');
    return `<defs><radialGradient id="${id}-snow" cx=".32" cy=".25" r=".8"><stop stop-color="#fff"/><stop offset=".6" stop-color="#f2f8fc"/><stop offset="1" stop-color="#bad2e4"/></radialGradient><clipPath id="${id}-head"><path d="${circle}"/></clipPath></defs><path d="${circle}" fill="url(#${id}-snow)"/><g clip-path="url(#${id}-head)"><ellipse cx="24" cy="60" rx="8" ry="4.5" fill="#eea8ad" opacity="${key==='rosy'?'.9':'.45'}"/><ellipse cx="76" cy="60" rx="8" ry="4.5" fill="#eea8ad" opacity="${key==='rosy'?'.9':'.45'}"/>${eyes}<path d="M47 51Q41 57 47 61L66 55Z" fill="#ed953d" stroke="#d47a2d" stroke-width=".6"/>${mouth}</g>`;
  }
  function snowHat(key) {
    const v=snowmen[key]||snowmen.classic;
    if(key==='classic'||key==='surprised')return `<path d="M26 12V-23q24-5 48 0v35" fill="#34485d" stroke="#293c50" stroke-width="1"/><path d="M26 3h48v9H26" fill="${v.accent}"/><path d="M17 13h66" stroke="#293c50" stroke-width="6" stroke-linecap="round"/>`;
    return `<path d="M14 11Q14-22 50-22Q86-22 86 11Z" fill="${v.accent}"/><circle cx="50" cy="-23" r="6" fill="${v.accent}"/><path d="M14 11q36-6 72 0" fill="none" stroke="${v.accent}" stroke-width="9" stroke-linecap="round"/><path d="M28-12v16m11-22v19m11-21v20m11-19v20m11-15v16" stroke="#fff" stroke-opacity=".25" stroke-width="2"/>`;
  }
  function cookie(key,id) {
    const v=cookies[key]||cookies.gingerbread,shape=paths[key]||paths.gingerbread;
    const lines='fill="none" stroke="#fff5de" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';
    let icing='';
    if(key==='gingerbread')icing=`<path d="M22 29Q50 7 78 29M17 49Q9 70 29 80M83 49Q91 70 71 80" ${lines}/><circle cx="34" cy="43" r="4" fill="#623c29"/><circle cx="66" cy="43" r="4" fill="#623c29"/><ellipse cx="25" cy="59" rx="7" ry="4" fill="#dc8270"/><ellipse cx="75" cy="59" rx="7" ry="4" fill="#dc8270"/><path d="M32 62Q50 82 68 62" fill="none" stroke="#fff5de" stroke-width="4" stroke-linecap="round"/>`;
    else if(key==='tree')icing=`<path d="M50 12L66 27H57L76 49H63L85 76H15L37 49H24L43 27H34Z" fill="#4b9b73"/><path d="M35 39q15 10 30 0M25 61q25 13 50 0" ${lines}/><g fill="#df4e5b"><circle cx="45" cy="34" r="3"/><circle cx="58" cy="53" r="3"/><circle cx="36" cy="67" r="3"/><circle cx="69" cy="71" r="3"/></g><path d="m50 12 2 5 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1Z" fill="#f9d66d"/>`;
    else if(key==='star')icing=`<path d="M50 14L60 38L84 41L66 58L71 81L50 70L29 81L34 58L16 41L40 38Z" fill="#f6e4a4"/><path d="M39 48q3-4 6 0m10 0q3-4 6 0M42 57q8 7 16 0" fill="none" stroke="#a47436" stroke-width="2" stroke-linecap="round"/><g fill="#dc535c"><circle cx="50" cy="27" r="2"/><circle cx="27" cy="44" r="2"/><circle cx="73" cy="44" r="2"/></g>`;
    else if(key==='snowflake')icing=`<circle cx="50" cy="50" r="39" fill="#8bc4df"/><g ${lines}>${[0,60,120].map(a=>`<g transform="rotate(${a} 50 50)"><path d="M50 22v56M43 28l7 7 7-7M43 72l7-7 7 7"/></g>`).join('')}</g><g fill="#fff5de"><circle cx="23" cy="48" r="1.7"/><circle cx="78" cy="48" r="1.7"/><circle cx="37" cy="17" r="1.7"/><circle cx="64" cy="83" r="1.7"/></g>`;
    else if(key==='stocking')icing=`<path d="M36 25H70V51L83 69Q90 80 75 87L36 90Q16 92 15 80Q15 71 28 68L36 63Z" fill="#d95a66"/><path d="M34 13h38v17H34Z" fill="#fff1d8"/><path d="M15 80q9-5 15 10M74 59q-12 5-6 18" fill="none" stroke="#f5e4c4" stroke-width="8"/><path d="m51 41 2 5 5 1-4 4 1 5-4-3-5 3 1-5-4-4 5-1Z" fill="#fff1d8"/>`;
    else icing=`<path d="M50 24Q74 22 74 49V65L84 79H16L26 65V49Q26 22 50 24Z" fill="#f0cb6a"/><path d="M22 72h56M33 60V48q0-16 11-17" ${lines}/><path d="M32 21l18 6 18-6v13l-18-6-18 6Z" fill="#ce4e5b"/><circle cx="50" cy="88" r="4" fill="#f5dd94"/>`;
    if(!['gingerbread','snowflake'].includes(key))icing='<circle cx="50" cy="50" r="40" fill="#fff0d7"/><g transform="translate(50 50) scale(.82) translate(-50 -50)">'+icing+'</g>';
    return `<defs><linearGradient id="${id}-baked" x2=".6" y2="1"><stop stop-color="#e9bd78"/><stop offset=".55" stop-color="#cd9856"/><stop offset="1" stop-color="#ad7037"/></linearGradient></defs><path d="${shape}" fill="url(#${id}-baked)"/><path d="${shape}" fill="none" stroke="#f3d49a" stroke-width="3" transform="translate(2 2) scale(.96)"/>${icing}`;
  }
  window.TeacherTilesChristmasArt=Object.freeze({snowmen,cookies,circle,paths,snowman,snowHat,cookie});
})();
