const fs=require('node:fs'),path=require('node:path');
const sharp=require('C:/Users/Jack/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve('assets/cursors'),states=['normal','point','open','grab'];
const hands={
 point:'M23 34V9Q23 3 28 3Q33 3 33 9V24Q33 19 38 20Q42 21 42 27Q42 23 47 25Q51 26 51 31Q54 28 57 32V42Q57 51 49 55H29Q21 52 18 45L9 31Q6 26 11 24Q15 23 19 29Z',
 open:'M20 33L13 15Q11 9 16 8Q20 7 22 13L27 28V7Q27 2 32 3Q36 3 36 8V27L40 11Q41 6 45 8Q49 9 47 15L44 31L50 20Q52 16 56 18Q59 20 56 25L51 43Q49 52 43 55H29Q23 53 19 48L8 37Q4 33 8 30Q11 28 15 32L22 38Z',
 grab:'M16 33V25Q16 18 22 19Q27 19 27 26Q27 18 33 19Q38 19 38 27Q39 20 44 22Q49 23 48 30Q51 25 55 29Q59 33 56 42Q54 51 47 55H29Q22 52 18 47L9 40Q5 35 9 32Q12 30 17 35Z'
};
function cuff(){return '<path d="M25 50Q28 48 32 51Q36 49 40 51Q44 49 48 51L51 59Q46 63 40 61Q35 63 31 61Q26 62 23 58Z" fill="#fff9ed" stroke="#65302b" stroke-width="1.8" stroke-linejoin="round"/><path d="M27 58Q36 61 47 57" fill="none" stroke="#d4dfdf" stroke-width="2.2" stroke-linecap="round"/>'}
function glove(state){const pose=state==='normal'?'point':state,d=hands[pose];return `<g ${state==='normal'?'transform="rotate(-28 32 32) scale(.94)"':''}><defs><clipPath id="hand"><path d="${d}"/></clipPath></defs><path d="${d}" fill="#ef3c3b" stroke="#652323" stroke-width="2.2" stroke-linejoin="round"/><g clip-path="url(#hand)"><path d="M59 23Q51 45 20 45L25 58H61Z" fill="#bd1e2e"/><path d="${pose==='point'?'M27 10V30':pose==='open'?'M31 8V29M16 14 23 32':'M21 25V34M32 24V32M43 27V34'}" fill="none" stroke="#ff8d79" stroke-width="2.4" stroke-linecap="round"/></g>${cuff()}</g>`}
function cane(state){const transforms={normal:'',point:'translate(9 6) rotate(25) scale(.86) translate(-9 -6)',open:'rotate(-7 32 32)',grab:'translate(4 5) rotate(9 30 30) scale(.86)'};const line='M9 6L32 44C40 57 57 48 50 37L47 32';return `<g transform="${transforms[state]}"><path d="${line}" fill="none" stroke="#74403f" stroke-width="10" stroke-linecap="round"/><path d="${line}" fill="none" stroke="#fff9ef" stroke-width="7.5" stroke-linecap="round"/><path d="${line}" fill="none" stroke="#dc3041" stroke-width="7.6" stroke-dasharray="5.3 7.2"/><path d="M7.8 7L32.8 47" stroke="#fff" stroke-width="1.5" opacity=".6" stroke-linecap="round"/></g>`}
function pinecone(x,y){let out=`<g transform="translate(${x} ${y}) rotate(-20)"><ellipse rx="4.4" ry="6.5" fill="#6a3d19"/>`;for(let row=0;row<4;row++)for(let col=0;col<2;col++)out+=`<path d="M${-4+col*4+(row%2)} ${-5+row*3}q2-1 3 1q-1 3-3 0" fill="#c78b43" stroke="#784819" stroke-width=".45"/>`;return out+'</g>'}
function evergreen(state){const d=state==='normal'?'M7 4L54 32L36 38L46 55L36 61L26 43L15 54Z':hands[state],random=i=>{const n=Math.sin(i*127.1)*43758.54;return n-Math.floor(n)};let out=`<defs><clipPath id="pine"><path d="${d}"/></clipPath><linearGradient id="green" x2="1" y2="1"><stop stop-color="#76a323"/><stop offset=".5" stop-color="#27652d"/><stop offset="1" stop-color="#123f27"/></linearGradient><radialGradient id="bauble" cx=".3" cy=".25"><stop stop-color="#ff9b61"/><stop offset=".4" stop-color="#e53628"/><stop offset="1" stop-color="#8d1420"/></radialGradient></defs><path d="${d}" fill="url(#green)" stroke="#244a20" stroke-width="1.4" stroke-linejoin="round"/><g clip-path="url(#pine)">`;
 out+='<path d="M9 6L39 57M29 7V52M15 19L33 48M45 15L36 51M55 29L40 53" stroke="#987134" stroke-width="1.5"/>';
 for(let i=0;i<155;i++){const x=5+random(i+4)*53,y=3+random(i+83)*57,len=3+random(i+51)*6;out+=`<path d="M${x} ${y}l${-len*.6} ${-len}" stroke="${['#98bb35','#60942b','#b1c54a','#3b842d'][i%4]}" stroke-width=".65" stroke-linecap="round" opacity=".8"/>`}
 out+='<path d="M6 19Q36 30 58 35M12 35Q37 42 53 49" fill="none" stroke="#d6b84f" stroke-width=".7"/>';
 for(const [x,y,r,c]of [[22,22,4.2,'url(#bauble)'],[39,40,4.5,'url(#bauble)'],[26,40,3.4,'#d9bc40']])out+=`<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="#633b19" stroke-width=".6"/><circle cx="${x-1}" cy="${y-1.4}" r="1" fill="#fff0b5" opacity=".7"/>`;
 out+=pinecone(17,32)+pinecone(38,29);
 for(const [x,y]of [[15,14],[31,24],[20,45],[47,34],[38,50]])out+=`<circle cx="${x}" cy="${y}" r="1.2" fill="#fff2a1"/>`;
 out+='</g>';
 if(state!=='normal')out+='<path d="M36 53Q25 42 24 50Q23 57 35 56Q44 46 48 50Q52 57 38 56L43 62L36 59L30 62Z" fill="#da3e2b" stroke="#883223" stroke-width="1"/><circle cx="36" cy="55" r="2.5" fill="#f2743c"/>';
 return out;
}
const pack={id:'christmas',name:'Christmas Cursors',productId:'cursor-christmas-pack',price:350,holiday:'christmas',cursors:[]};
(async()=>{
 for(const [slug,name,color,render,hotspots]of [
 ['candy-cane','Candy Cane','#dc3041',cane,{normal:[5,3],point:[5,3],open:[3,5],grab:[8,4]}],
 ['santa-glove','Santa Glove','#ef3c3b',glove,{normal:[7,4],point:[14,2],open:[16,16],grab:[16,18]}],
 ['christmas-tree','Christmas Tree','#397731',evergreen,{normal:[4,2],point:[14,2],open:[16,16],grab:[16,18]}]
 ]){
 const id='christmas-'+slug;pack.cursors.push({id,name,productId:pack.productId,color,runtimeDirectory:'runtime/',assetVersion:'20261127-christmas',hotspots});
 for(const state of states){const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">${render(state)}</svg>`;fs.mkdirSync(path.join(root,'display'),{recursive:true});fs.writeFileSync(path.join(root,'display',id+'-'+state+'.svg'),svg);await sharp(Buffer.from(svg)).resize(128,128).png().toFile(path.join(root,id+'-'+state+'.png'));await sharp(Buffer.from(svg)).resize(32,32).png().toFile(path.join(root,'runtime',id+'-'+state+'.png'));}
 }
 fs.writeFileSync(path.join(root,'christmas-pack.js'),'// Christmas pointer artwork and four interaction poses per cursor.\nwindow.TeacherTilesCursorPacks.push('+JSON.stringify(pack,null,2)+');\n');
 console.log('Built Christmas cursor pack: 3 cursors × 4 poses, sharp previews and 32px runtime assets');
})();
