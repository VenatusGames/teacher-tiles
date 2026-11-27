(() => {
  'use strict';
  const snowmen = Object.freeze({
    classic:{name:'Classic',accent:'#d84b56'}, cheerful:{name:'Cheerful',accent:'#4c9b79'},
    sleepy:{name:'Sleepy',accent:'#8293d4'}, wink:{name:'Wink',accent:'#d576a2'},
    surprised:{name:'Surprised',accent:'#52a7bc'}, rosy:{name:'Rosy',accent:'#dc9a3e'}
  });
  const cookies = Object.freeze({
    gingerbread:{name:'Gingerbread',accent:'#b8793d'}, tree:{name:'Christmas Tree',accent:'#479774'},
    star:{name:'Santa Suit',accent:'#e7b746'}, snowflake:{name:'Snowflake',accent:'#79b5cf'},
    stocking:{name:'Christmas Elf',accent:'#cc5263'}, bell:{name:'Christmas Lights',accent:'#dfa549'}
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
    if(key==='classic'||key==='surprised')return `<path d="M20 21L23-22Q50-27 77-22L80 21Z" fill="#304358" stroke="#233549" stroke-width="1.3"/><path d="M21 9Q50 13 79 9L80 20H20Z" fill="${v.accent}"/><path d="M8 21Q50 29 92 21" fill="none" stroke="#233549" stroke-width="7" stroke-linecap="round"/><path d="M29-17L27 5" stroke="#6f8295" stroke-width="3" stroke-linecap="round" opacity=".45"/>`;
    return `<path d="M9 23C6-1 20-20 48-20C75-20 91-2 91 23Z" fill="${v.accent}" stroke="${v.accent}" stroke-width="2"/><circle cx="48" cy="-23" r="6" fill="${v.accent}"/><path d="M25-11Q20 0 21 17M37-17Q33 0 34 19M50-18V20M63-15Q67 1 66 19M75-8Q80 4 79 17" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="2.2"/><path d="M9 18Q50 10 91 18L92 28Q50 20 8 28Z" fill="${v.accent}" stroke="${v.accent}" stroke-width="2"/><path d="M10 20Q50 13 90 20" fill="none" stroke="#fff" stroke-opacity=".26" stroke-width="2"/><path d="M9 28Q50 20 91 28" fill="none" stroke="#142c4b" stroke-opacity=".16" stroke-width="2"/>`;
  }
  function cookie(key,id) {
    const frosting={gingerbread:['#dba273','#b97043'],tree:['#80bc85','#408760'],star:['#f16b72','#c42f43'],snowflake:['#c4eaf1','#76bad1'],stocking:['#9ac872','#5a9a53'],bell:['#fffdf0','#eae2cc']}[key]||['#dba273','#b97043'];
    const pipe='fill="none" stroke="#fff9e8" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"';
    const eye=(x,y)=>`<ellipse cx="${x}" cy="${y}" rx="3.8" ry="5" fill="#302622"/><circle cx="${x-1}" cy="${y-1.8}" r="1.1" fill="#fff9ee"/>`;
    let icing='';
    if(key==='gingerbread')icing=`<path d="M10 30C22 40 26 20 36 25S48 36 56 25S69 20 75 27S86 34 90 26" ${pipe}/>${eye(34,47)}${eye(66,47)}<ellipse cx="22" cy="63" rx="6" ry="4.5" fill="#f0a2ad"/><ellipse cx="78" cy="63" rx="6" ry="4.5" fill="#f0a2ad"/><ellipse cx="50" cy="61" rx="7" ry="5" fill="#e86d69"/><path d="M31 69Q50 91 70 68" fill="none" stroke="#58362d" stroke-width="2.1" stroke-linecap="round"/>`;
    else if(key==='tree')icing=`<path d="M50 23Q45 33 40 35Q50 39 60 35M50 30Q40 44 30 48Q50 55 70 48M50 40Q36 57 23 63Q50 72 77 63M50 51Q34 69 20 77Q50 87 80 77M50 24V82" ${pipe}/><path d="m50 14 2.6 5.4 6 .8-4.3 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8-4.3-4.1 6-.8Z" fill="#f8d56b"/><g fill="#fff8e9"><circle cx="24" cy="30" r="1.5"/><circle cx="76" cy="29" r="1.5"/><circle cx="17" cy="52" r="1.4"/><circle cx="83" cy="51" r="1.4"/></g>`;
    else if(key==='star')icing=`<path d="M9 44Q50 48 91 44V61Q50 65 9 61Z" fill="#342d2a"/><rect x="35" y="33" width="30" height="36" rx="7" fill="#f4cd55" stroke="#d8a434" stroke-width="1"/><rect x="42" y="40" width="16" height="22" rx="2" fill="#322b28"/><path d="M40 37H59" stroke="#ffe793" stroke-width="2" stroke-linecap="round"/>`;
    else if(key==='snowflake')icing=`<g ${pipe}>${[0,60,120].map(a=>`<g transform="rotate(${a} 50 50)"><path d="M50 19v62M43 25l7 7 7-7M41 36l9 8 9-8M43 75l7-7 7 7M41 64l9-8 9 8"/></g>`).join('')}</g><g fill="#fff9e8">${[[22,31],[78,31],[21,68],[79,68],[50,12],[50,88]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="1.6"/>`).join('')}</g>`;
    else if(key==='stocking')icing=`<path d="M8 39Q8 8 50 8Q92 8 92 39L77 49Q70 33 63 42L51 54Q41 35 34 43L23 52Q17 38 8 39Z" fill="#dc4653"/><g fill="#f7d55e" stroke="#d6aa3e" stroke-width=".7"><circle cx="23" cy="52" r="4"/><circle cx="51" cy="54" r="4"/><circle cx="77" cy="49" r="4"/></g><path d="M20 70Q50 77 80 70M27 81Q50 85 73 81" ${pipe}/>`;
    else icing=`<path d="M10 37Q47 69 89 30" fill="none" stroke="#37483d" stroke-width="2.2"/>${[[22,46,'#d94755'],[39,53,'#eebd45'],[57,52,'#4d9c6f'],[74,44,'#d94755']].map(([x,y,c])=>`<g transform="translate(${x} ${y})"><path d="M-3 1Q-9 12 0 16Q9 12 3 1Z" fill="${c}"/><path d="M-2 0h4v4h-4Z" fill="#37483d"/><path d="M-3 7v3" stroke="#fff" stroke-opacity=".55" stroke-width="1.4" stroke-linecap="round"/></g>`).join('')}`;
    return `<defs><radialGradient id="${id}-baked" cx=".35" cy=".25" r=".85"><stop stop-color="#f6dc9f"/><stop offset=".8" stop-color="#d8a565"/><stop offset="1" stop-color="#ac703e"/></radialGradient><radialGradient id="${id}-icing" cx=".35" cy=".24" r=".85"><stop stop-color="${frosting[0]}"/><stop offset="1" stop-color="${frosting[1]}"/></radialGradient><clipPath id="${id}-frost"><circle cx="50" cy="49" r="41.5"/></clipPath></defs><circle cx="50" cy="50" r="47" fill="url(#${id}-baked)"/><circle cx="50" cy="51.5" r="42.5" fill="#956334" opacity=".32"/><circle cx="50" cy="49" r="42" fill="url(#${id}-icing)" stroke="${frosting[0]}" stroke-width="1.3"/><path d="M14 32A40 40 0 0 1 72 15" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="1.7" stroke-linecap="round"/><g clip-path="url(#${id}-frost)">${icing}</g>`;
  }
  window.TeacherTilesChristmasArt=Object.freeze({snowmen,cookies,circle,paths,snowman,snowHat,cookie});
})();
