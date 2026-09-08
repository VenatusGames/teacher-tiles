const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let saved={},calls=0,now=Date.now(),online=true;
class Clock extends Date{static now(){return now;}}
const c={window:{},Date:Clock,AbortSignal,localStorage:{getItem:k=>saved[k],setItem:(k,v)=>saved[k]=v},fetch:async url=>{calls++;if(!online)throw Error('offline');return {ok:true,json:async()=>JSON.parse(fs.readFileSync(url,'utf8'))};}};
for(const path of ['word-of-the-day/words','quote-of-the-day/quotes','shared/live','shared/daily'])vm.runInNewContext(fs.readFileSync('tiles/'+path+'.js','utf8'),c);
(async()=>{
const live=c.window.TeacherTilesLive,daily=c.window.TeacherTilesDaily;
const [first,second]=await Promise.all([daily.feed(),daily.feed()]);assert.equal(calls,2);assert.equal(first.words.length,365);assert.equal(first.quotes.length,20);assert.equal(second.words.length,365);
assert.equal(new Set(first.words.map(w=>w.word)).size,365);
for(const word of first.words){assert(live.validWord(word));assert(word.definition.length>=15);assert(!/[{}|\uFFFD]/.test(word.definition));}
for(const q of first.quotes)assert(live.validQuote(q));
assert(!first.words.some(w=>/nuyorican|nyuorican|supercalifragilistic/i.test(w.word)));
assert(!live.validWord({...first.words[0],definition:'Unreviewed replacement'}));
assert(!live.validQuote({...first.quotes[0],text:'An inappropriate replacement pretending to be approved.'}));
assert(!live.validQuote({text:'Anything with inspiring keywords',author:'Someone'}));
await daily.feed();assert.equal(calls,2);
const ids=Array.from({length:365},(_,i)=>first.words[daily.index(365,i)].id);assert.equal(new Set(ids).size,365);
online=false;const key=Object.keys(saved)[0];saved[key]=JSON.stringify({...first,day:'old',wordsDay:'old',quotesDay:'old',words:[{word:'Nuyorican',definition:'bad'},...first.words]});now+=61000;
const offline=await daily.feed();assert.equal(offline.words.length,365);assert(offline.words.every(live.validWord));
console.log('Approved catalogs: 365 unique words, 20 reviewed quotes, exact-entry validation, daily refresh, no 365-day repeats, tampered/legacy cache rejection and offline recovery passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
