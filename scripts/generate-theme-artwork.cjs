// Regenerate the material artwork with: node scripts/generate-theme-artwork.cjs
// These deterministic, local SVGs are shared by boards, the shelf, and shop previews.
const fs = require('node:fs');
const path = require('node:path');
const output = path.join(__dirname, '../assets/themes');
fs.mkdirSync(output, { recursive: true });
let seed = 41;
const random = (a = 0, b = 1) => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return a + seed / 4294967296 * (b - a);
};
const n = value => Number(value.toFixed(2));
const noise = (frequency, opacity, id = 'grain') => `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${frequency}" numOctaves="3" seed="17" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope="${opacity}"/></feComponentTransfer><feBlend in="SourceGraphic" mode="soft-light"/></filter>`;
const svg = (w, h, defs, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs}</defs>${body}</svg>`;
const write = (name, art) => fs.writeFileSync(path.join(output, `${name}.svg`), art + '\n');

function wood(base, dark, light) {
  seed = 37;
  const defs = noise('.035 .48', .24) + `<linearGradient id="finish" x2="0" y2="1"><stop stop-color="${light}" stop-opacity=".16"/><stop offset=".3" stop-color="${light}" stop-opacity="0"/><stop offset="1" stop-color="${dark}" stop-opacity=".15"/></linearGradient>`;
  let body = `<rect width="1200" height="800" fill="${base}"/>`;
  for (let row = 0; row < 5; row++) {
    const y = row * 160;
    const knot = { x: random(190, 1050), y: y + random(48, 115) };
    body += `<rect y="${y}" width="1200" height="160" fill="${row % 2 ? dark : light}" opacity="${n(random(.025, .095))}"/>`;
    // Long fibers flow around a knot rather than forming a regular stripe pattern.
    for (let j = 0; j < 68; j++) {
      const lineY = y + j * 2.35;
      const phase = random(0, 6.28);
      let d = '';
      for (let x = 0; x <= 1200; x += 12) {
        const distance = lineY - knot.y;
        const bend = Math.sign(distance) * 14 * Math.exp(-Math.abs(distance) / 28) * Math.exp(-(((x - knot.x) / 105) ** 2));
        const wave = (Math.sin(x / 120 + phase) * 1.1 + Math.sin(x / 39 + phase) * .45) * Math.sin(Math.PI * x / 1200);
        d += `${x ? 'L' : 'M'}${x} ${n(lineY + bend + wave)}`;
      }
      body += `<path d="${d}" fill="none" stroke="${j % 4 ? dark : light}" stroke-width="${n(random(.3, 1))}" opacity="${n(random(.06, .19))}"/>`;
    }
    body += `<ellipse cx="${n(knot.x)}" cy="${n(knot.y)}" rx="8" ry="2.8" fill="${dark}" opacity=".24"/><ellipse cx="${n(knot.x - 1)}" cy="${n(knot.y - 1)}" rx="4" ry=".9" fill="${light}" opacity=".2"/>`;
    const joint = [360, 900, 570, 180, 760][row];
    body += `<path d="M0 ${y}H1200M${joint} ${y}v160" stroke="${dark}" stroke-opacity=".42" stroke-width="2"/><path d="M0 ${y + 2}H1200M${joint + 2} ${y + 2}v157" stroke="${light}" stroke-opacity=".28"/><rect y="${y + 3}" width="1200" height="156" fill="url(#finish)"/>`;
  }
  body += `<rect width="1200" height="800" fill="${base}" fill-opacity=".035" filter="url(#grain)"/>`;
  return svg(1200, 800, defs, body);
}

function cork(pin) {
  seed = 121;
  const defs = noise('.36', .32) + `<radialGradient id="pin" cx="30%" cy="22%" r="80%"><stop stop-color="#fff" stop-opacity=".86"/><stop offset=".2" stop-color="${pin}"/><stop offset=".65" stop-color="${pin}"/><stop offset="1" stop-color="#462618"/></radialGradient><filter id="shadow" x="-70%" y="-60%" width="260%" height="290%"><feDropShadow dx="2" dy="4" stdDeviation="2" flood-color="#3c210f" flood-opacity=".4"/></filter>`;
  let body = '<rect width="1200" height="800" fill="#ba8a58"/>';
  const colors = ['#795030', '#e0b582', '#99683c', '#d3a371', '#a97845', '#efd0a2'];
  const chips = Array.from({ length: 24 }, () => []);
  for (let i = 0; i < 7200; i++) {
    const x = random(0, 1200), y = random(0, 800), rx = random(1, 6), ry = random(1, 4);
    const points = Array.from({ length: 5 }, (_, j) => {
      const a = j * Math.PI * 2 / 5;
      return `${j ? 'L' : 'M'}${(x + Math.cos(a) * rx).toFixed(1)} ${ (y + Math.sin(a) * ry).toFixed(1)}`;
    }).join('') + 'Z';
    chips[(i % colors.length) * 4 + Math.floor(random(0, 4))].push(points);
  }
  body += chips.map((paths, i) => `<path d="${paths.join('')}" fill="${colors[Math.floor(i / 4)]}" opacity="${n(.16 + (i % 4) * .1)}"/>`).join('');
  body += '<rect width="1200" height="800" fill="#bc8f62" fill-opacity=".03" filter="url(#grain)"/>';
  for (const [x, y] of [[95, 105], [420, 255], [955, 125], [705, 550], [190, 654], [1080, 695]]) {
    body += `<g transform="translate(${x} ${y})"><path d="M1 5l3 9" stroke="#614936" stroke-width="1.4"/><circle r="7" fill="url(#pin)" stroke="#673d24" stroke-opacity=".35" stroke-width=".5" filter="url(#shadow)"/><ellipse cx="-2" cy="-2.5" rx="2" ry="1.2" fill="#fff" opacity=".55"/></g>`;
  }
  return svg(1200, 800, defs, body);
}

function cardboard(label, ink, white = false) {
  seed = 304;
  const base = white ? '#ded8cb' : '#bd9569';
  const defs = noise('.58 .32', .36) + `<filter id="paperShadow" x="-25%" y="-30%" width="160%" height="180%"><feDropShadow dx="1" dy="3" stdDeviation="2" flood-color="#553a20" flood-opacity=".22"/></filter><linearGradient id="tape"><stop stop-color="#e9c58a" stop-opacity=".07"/><stop offset=".5" stop-color="#e9c58a" stop-opacity=".2"/><stop offset="1" stop-color="#e9c58a" stop-opacity=".07"/></linearGradient>`;
  let body = `<rect width="1200" height="800" fill="${base}"/><rect width="1200" height="800" fill="${base}" filter="url(#grain)"/>`;
  for (let i = 0; i < 1700; i++) {
    const x = random(0, 1200), y = random(0, 800);
    body += `<path d="M${n(x)} ${n(y)}l${n(random(1, 5))} ${n(random(-1, 1))}" stroke="${i % 3 ? '#72502f' : '#fff1d3'}" stroke-width=".6" opacity="${n(random(.05, .17))}"/>`;
  }
  body += '<path d="M0 530H1200" stroke="#735030" opacity=".09"/><path d="M0 532H1200" stroke="#fff4db" opacity=".2"/><rect x="824" width="46" height="800" fill="url(#tape)"/><path d="M824 0V800M870 0V800" stroke="#785932" opacity=".1"/>';
  for (const [x, y, angle, scale] of [[115, 95, -7, .85], [685, 300, 5, 1], [300, 645, -3, .72]]) {
    body += `<g transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})"><path d="M0 0H142V76L130 88H0Z" fill="${label}" filter="url(#paperShadow)"/><path d="M130 88V76H142" fill="#fff" fill-opacity=".5"/><rect x="10" y="10" width="24" height="16" rx="1" fill="${ink}" opacity=".12"/><path d="M42 13h60M42 21h43M12 38h91M12 45h69" stroke="${ink}" stroke-width="2" opacity=".28"/>`;
    let xBar = 12;
    while (xBar < 103) {
      const width = Math.round(random(1, 3));
      body += `<rect x="${xBar}" y="58" width="${width}" height="17" fill="${ink}" opacity=".58"/>`;
      xBar += width + Math.round(random(1, 4));
    }
    body += `<path d="M116 17l5-6 5 6m-5-6v18M110 32h22" fill="none" stroke="${ink}" stroke-width="1.5" opacity=".45"/></g>`;
  }
  return svg(1200, 800, defs, body);
}

function metal(dark, mid, light) {
  seed = 218;
  const defs = noise('.014 .68', .25) + `<linearGradient id="steel" x1="0" y1="0" x2="1" y2="0"><stop stop-color="${mid}"/><stop offset=".17" stop-color="${dark}"/><stop offset=".39" stop-color="${mid}"/><stop offset=".52" stop-color="${light}"/><stop offset=".59" stop-color="${light}"/><stop offset=".76" stop-color="${mid}"/><stop offset="1" stop-color="${mid}"/></linearGradient>`;
  let body = '<rect width="1600" height="1000" fill="url(#steel)" filter="url(#grain)"/>';
  for (let i = 0; i < 1800; i++) {
    const x = random(-300, 1600), y = random(0, 1000);
    body += `<path d="M${n(x)} ${n(y)}h${n(random(20, 420))}" stroke="${i % 2 ? light : dark}" stroke-width="${n(random(.2, .65))}" opacity="${n(random(.04, .18))}"/>`;
  }
  return svg(1600, 1000, defs, body);
}

function cosmosBoard(kind, defs, feature, glow) {
  // One composition spans the entire board. Rejection sampling keeps features
  // irregularly spaced without assigning them to rows, columns, or repeat cells.
  seed = { nebula: 9107, pulsar: 4219, 'milky-way': 7301, 'red-dwarf': 1837 }[kind];
  const locations = [];
  for (let attempt = 0; attempt < 4000 && locations.length < 25; attempt++) {
    const x = random(150, 11850), y = random(150, 7850);
    if (locations.some(p => Math.hypot(p.x - x, p.y - y) < 1250)) continue;
    locations.push({ x, y, angle: random(-180, 180), scale: random(.85, 1.8), opacity: random(.65, 1) });
  }
  let body = '<rect width="12000" height="8000" fill="#080c19"/>';
  body += locations.map(p => `<use href="#space-feature" transform="translate(${n(p.x)} ${n(p.y)}) rotate(${n(p.angle)}) scale(${n(p.scale)}) translate(-800 -500)" opacity="${n(p.opacity)}"/>`).join('');
  // Stars are independently distributed across the board, not stamped with each feature.
  const stars = Array.from({ length: 4 }, () => []);
  for (let i = 0; i < 24000; i++) {
    stars[i % 4].push(`M${n(random(2, 11998))} ${n(random(2, 7998))}h.01`);
  }
  body += stars.map((points, i) => `<path d="${points.join('')}" fill="none" stroke="${i === 3 ? glow : '#e4eeff'}" stroke-width="${[.8, 1.2, 1.8, 2.4][i]}" stroke-linecap="round" opacity="${[.28, .42, .58, .7][i]}"/>`).join('');
  return svg(12000, 8000, `${defs}<g id="space-feature">${feature}</g>`, body);
}

function cosmos(kind, cloud, glow, secondary, fullBoard = false) {
  seed = 987;
  const defs = `<radialGradient id="haze"><stop stop-color="${cloud}" stop-opacity=".72"/><stop offset=".45" stop-color="${cloud}" stop-opacity=".34"/><stop offset="1" stop-color="${cloud}" stop-opacity="0"/></radialGradient><radialGradient id="halo"><stop stop-color="${glow}" stop-opacity=".65"/><stop offset=".18" stop-color="${cloud}" stop-opacity=".5"/><stop offset="1" stop-color="${cloud}" stop-opacity="0"/></radialGradient><radialGradient id="star"><stop stop-color="#fffef5"/><stop offset=".12" stop-color="${glow}"/><stop offset=".4" stop-color="${cloud}" stop-opacity=".36"/><stop offset="1" stop-color="${cloud}" stop-opacity="0"/></radialGradient><filter id="cloud" x="-45%" y="-60%" width="190%" height="220%"><feTurbulence type="fractalNoise" baseFrequency=".007 .011" numOctaves="3" seed="31" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="125"/><feGaussianBlur stdDeviation="15"/></filter><filter id="soft"><feGaussianBlur stdDeviation="3"/></filter>`;
  let body = '<rect width="1600" height="1000" fill="#080c19"/>';
  if (kind === 'nebula' || kind === 'milky-way') {
    body += `<ellipse cx="800" cy="500" rx="660" ry="370" fill="url(#haze)" transform="rotate(-24 800 500)"/>`;
    body += `<g filter="url(#cloud)"><path d="M100 720C440 790 430 390 810 490S1230 240 1510 200" fill="none" stroke="${cloud}" stroke-width="130" opacity=".32"/><path d="M130 750C470 770 520 410 840 470S1240 230 1450 240" fill="none" stroke="${glow}" stroke-width="40" opacity=".27"/><path d="M100 630C440 720 570 360 830 430S1210 230 1510 160" fill="none" stroke="${secondary}" stroke-width="65" opacity=".25"/><path d="M130 680C480 730 530 390 820 460S1240 210 1450 215" fill="none" stroke="#050814" stroke-width="26" opacity=".65"/></g>`;
    for (let i = 0; i < (kind === 'milky-way' ? 1400 : 360); i++) {
      const x = random(140, 1450), y = 780 - x * .4 + random(-1, 1) * random(0, 130);
      body += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(random(.25, .8))}" fill="${glow}" opacity="${n(random(.12, .65))}"/>`;
    }
  } else if (kind === 'pulsar') {
    body += `<ellipse cx="900" cy="440" rx="650" ry="420" fill="url(#haze)"/><g transform="rotate(-27 900 440)"><ellipse cx="900" cy="440" rx="210" ry="52" fill="none" stroke="${cloud}" stroke-width="36" opacity=".35" filter="url(#cloud)"/><ellipse cx="900" cy="440" rx="165" ry="30" fill="none" stroke="${glow}" stroke-width="2" opacity=".45"/><path d="M900 180V700" stroke="${glow}" stroke-width="2" opacity=".45" filter="url(#soft)"/><ellipse cx="900" cy="440" rx="35" ry="280" fill="url(#star)"/></g><circle cx="900" cy="440" r="105" fill="url(#star)"/>`;
  } else {
    body += `<ellipse cx="1030" cy="430" rx="520" ry="400" fill="url(#haze)"/><circle cx="1030" cy="430" r="240" fill="url(#halo)"/><circle cx="1030" cy="430" r="73" fill="${cloud}" opacity=".45" filter="url(#cloud)"/><circle cx="1030" cy="430" r="45" fill="url(#star)"/><path d="M987 432C950 375 1053 336 1071 412" fill="none" stroke="${glow}" stroke-width="2" opacity=".45" filter="url(#soft)"/><ellipse cx="470" cy="640" rx="400" ry="240" fill="url(#haze)" opacity=".25"/>`;
  }
  if (fullBoard) return cosmosBoard(kind, defs, body.replace('<rect width="1600" height="1000" fill="#080c19"/>', ''), glow);
  for (let i = 0; i < 1250; i++) {
    const x = random(3, 1597), y = random(3, 997), r = random(.25, i % 29 === 0 ? 1.5 : .85);
    body += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${i % 7 === 0 ? glow : '#e4eeff'}" opacity="${n(random(.18, .85))}"/>`;
    if (i % 151 === 0) body += `<circle cx="${n(x)}" cy="${n(y)}" r="10" fill="url(#star)" opacity=".55"/><path d="M${n(x - 4)} ${n(y)}h8M${n(x)} ${n(y - 4)}v8" stroke="#e9f0ff" stroke-width=".5" opacity=".5"/>`;
  }
  return svg(1600, 1000, defs, body);
}

for (const [name, colors] of Object.entries({ oak: ['#b98b59', '#634128', '#eed5a7'], spruce: ['#68503b', '#2e2119', '#be9b70'], redwood: ['#995c46', '#4e281f', '#dba282'], cherry: ['#be8b8d', '#673c43', '#f0c7c6'] })) write(`wood-${name}`, wood(...colors));
for (const [name, pin] of Object.entries({ red: '#ce4549', blue: '#397fc2', green: '#408e62', gold: '#dda936' })) write(`corkboard-${name}`, cork(pin));
for (const [name, colors] of Object.entries({ kraft: ['#f6efdd', '#5b4936'], white: ['#fffdf5', '#65615b', true], blue: ['#bcd8e1', '#345567'], rose: ['#e4bbc0', '#714b55'] })) write(`cardboard-${name}`, cardboard(...colors));
for (const [name, colors] of Object.entries({ copper: ['#704230', '#a26b4c', '#d4a382'], iron: ['#555e67', '#87919a', '#c1cbd0'], 'dark-steel': ['#171e26', '#303b47', '#606e7c'], cobalt: ['#122d49', '#2b5276', '#6388a6'] })) write(`metal-${name}`, metal(...colors));
for (const [name, colors] of Object.entries({ nebula: ['#713c9f', '#e0a1ec', '#29799a'], pulsar: ['#9c442c', '#ffd4a0', '#754952'], 'milky-way': ['#536c95', '#e3e9ed', '#956f99'], 'red-dwarf': ['#99333d', '#ffb08e', '#6a263a'] })) {
  write(`cosmos-${name}`, cosmos(name, ...colors));
  write(`cosmos-${name}-board`, cosmos(name, ...colors, true));
}
console.log('Generated 20 material theme SVGs and four non-repeating Cosmos boards.');

// One artwork assignment for every surface prevents previews drifting from the board.
const families = { wood: ['oak', 'spruce', 'redwood', 'cherry'], cardboard: ['kraft', 'white', 'blue', 'rose'], metal: ['copper', 'iron', 'dark-steel', 'cobalt'], cosmos: ['nebula', 'pulsar', 'milky-way', 'red-dwarf'], corkboard: ['red', 'blue', 'green', 'gold'] };
let css = '/* Generated by scripts/generate-theme-artwork.cjs. URLs resolve in the root styles-materials.css that consumes these variables. */\n';
for (const [family, variants] of Object.entries(families)) {
  variants.forEach((variant, index) => {
    const theme = `${family}-${variant}`;
    const card = `${family === 'corkboard' ? 'cork' : family}-${variant}`;
    const shop = ['wood', 'metal', 'cosmos'].includes(family) ? `,\n.shop-product__preview--${family} > i:nth-child(${index + 1})` : '';
    css += `body.theme-${theme},\n.theme-card--${card},\n.theme-pack__sheet--${card},\n.board-preview-theme-${theme}${shop}{--material-art:url("assets/themes/${theme}.svg")}\n`;
    if (family === 'cosmos') css += `body.theme-${theme},\n.board-preview-theme-${theme}{--cosmos-board-art:url("assets/themes/${theme}-board.svg")}\n`;
  });
}
fs.writeFileSync(path.join(output, 'palette.css'), css);
