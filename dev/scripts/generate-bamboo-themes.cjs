const fs=require('fs'),path=require('path'),sharp=require(process.env.SHARP_MODULE||'sharp');
const root=path.join(__dirname,'../assets/themes');
const palettes={yellow:['#d4b45e','#927234','#f2df99'],brown:['#9f7450','#63462f','#c59a71'],green:['#7f9957','#455d32','#b5c58a']};
(async()=>{for(const [name,[base,dark,light]] of Object.entries(palettes)){
let body=`<defs><linearGradient id="stalk"><stop stop-color="${dark}"/><stop offset=".18" stop-color="${base}"/><stop offset=".42" stop-color="${light}"/><stop offset=".7" stop-color="${base}"/><stop offset="1" stop-color="${dark}"/></linearGradient></defs><rect width="1200" height="800" fill="${dark}"/>`;
for(let i=0;i<16;i++){const x=i*75;body+=`<rect x="${x+1}" y="-10" width="73" height="820" rx="18" fill="url(#stalk)"/>`;
for(let k=0;k<19;k++){const xx=x+5+k*3.5;body+=`<path d="M${xx} 0q4 200 0 400t0 400" stroke="${k%3?dark:light}" opacity="${k%3?.1:.24}" fill="none" stroke-width=".7"/>`}
for(let y=(i%4)*51-200;y<850;y+=200){body+=`<path d="M${x+2} ${y}q35 7 70 0" stroke="${dark}" stroke-width="5" fill="none" opacity=".8"/><path d="M${x+3} ${y+4}q35 7 68 0" stroke="${light}" stroke-width="3" fill="none" opacity=".75"/><path d="M${x+9} ${y-10}l-3 9m59-8 3 8" stroke="${dark}" stroke-width="2" opacity=".5"/>`}}
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">${body}</svg>`;fs.writeFileSync(path.join(root,`bamboo-${name}.svg`),svg);await sharp(Buffer.from(svg)).webp({quality:93}).toFile(path.join(root,`baked/bamboo-${name}.webp`));await sharp(Buffer.from(svg)).resize(360,240).webp({quality:90}).toFile(path.join(root,`previews/bamboo-${name}.webp`));}
console.log('Baked three Bamboo themes and previews');})().catch(e=>{console.error(e);process.exitCode=1});
