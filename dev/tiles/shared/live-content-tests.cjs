const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let saved={},calls=0,now=Date.now(),online=true;
class Clock extends Date{static now(){return now;}}
const c={window:{},Date:Clock,AbortSignal,localStorage:{getItem:k=>saved[k],setItem:(k,v)=>saved[k]=v},fetch:async url=>{calls++;if(!online)throw Error('offline');return {ok:true,json:async()=>JSON.parse(fs.readFileSync(url,'utf8'))};}};
for(const path of ['word-of-the-day/words','quote-of-the-day/quotes','shared/live','shared/daily'])vm.runInNewContext(fs.readFileSync('tiles/'+path+'.js','utf8'),c);
(async()=>{
const live=c.window.TeacherTilesLive,daily=c.window.TeacherTilesDaily;
const [first,second]=await Promise.all([daily.feed(),daily.feed()]);assert.equal(calls,2);assert.equal(first.words.length,365);assert.equal(first.quotes.length,365);assert.equal(second.words.length,365);
assert.equal(new Set(first.words.map(w=>w.word)).size,365);
for(const word of first.words){assert(live.validWord(word));assert(word.definition.length>=15);assert(!/[{}|\uFFFD]/.test(word.definition));}
for(const q of first.quotes)assert(live.validQuote(q));
assert(!first.words.some(w=>/nuyorican|nyuorican|supercalifragilistic/i.test(w.word)));
assert(!live.validWord({...first.words[0],definition:'Unreviewed replacement'}));
assert(!live.validQuote({...first.quotes[0],text:'An inappropriate replacement pretending to be approved.'}));
assert(!live.validQuote({text:'Anything with inspiring keywords',author:'Someone'}));
await daily.feed();assert.equal(calls,2);
const ids=Array.from({length:365},(_,i)=>first.words[daily.index(365,i)].id);assert.equal(new Set(ids).size,365);
for(const entries of [first.words,first.quotes]){
 const mixed=daily.mixed(entries);
 assert.notDeepEqual(Array.from(mixed,x=>x.id),Array.from(entries,x=>x.id));
 assert.deepEqual(Array.from(mixed,x=>x.id),Array.from(daily.mixed([...entries].reverse()),x=>x.id));
 for(const start of [new Date(2026,8,8),new Date(2027,10,1),new Date(2028,0,1)]){
  const cycle=Array.from({length:365},(_,i)=>mixed[daily.index(mixed.length,0,new Date(start.getFullYear(),start.getMonth(),start.getDate()+i))].id);
  assert.equal(new Set(cycle).size,365);
 }
}
assert.equal(new Set(first.quotes.map(q=>q.text.toLowerCase().replace(/[^a-z0-9]/g,''))).size,365);
for(const word of ['perspicacious','assiduous','equanimity','ephemeral','verisimilitude'])assert(first.words.some(w=>w.word===word));
for(const word of ['adapt','describe','improve','entire','enormous','nuyorican','supercalifragilisticexpialidocious'])assert(!first.words.some(w=>w.word===word));
const html=fs.readFileSync('index.html','utf8');assert(html.includes('GROW YOUR VOCABULARY'));assert(!html.includes('GROW YOUR WORDS'));
online=false;const key=Object.keys(saved)[0];saved[key]=JSON.stringify({...first,day:'old',wordsDay:'old',quotesDay:'old',words:[{word:'Nuyorican',definition:'bad'},...first.words]});now+=61000;
const offline=await daily.feed();assert.equal(offline.words.length,365);assert(offline.words.every(live.validWord));
saved[key]=JSON.stringify({...first,quotes:first.quotes.slice(0,20)});now+=61000;
const partial=await daily.feed();assert.equal(partial.quotes.length,0,'Incomplete cached collections must use the full bundled fallback');
online=true;saved[key]=JSON.stringify({...first,quotes:[...first.quotes,first.quotes[0]]});
assert.equal((await daily.feed()).quotes.length,365,'Duplicate cached entries must not extend the cycle');
const originalFetch=c.fetch;c.fetch=async()=>({ok:true,json:async()=>({version:1,quotes:first.quotes.slice(0,20)})});
await assert.rejects(()=>live.quotes(),/Incomplete classroom collection/);c.fetch=originalFetch;
console.log('Approved catalogs: 365 advanced words, 365 distinct quotes, stable mixed order, full-year cycles including DST and leap day, exact-entry validation, daily refresh and offline recovery passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
