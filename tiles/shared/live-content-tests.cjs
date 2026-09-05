const assert=require('node:assert/strict');
const {parseWord,handler}=require('../../functions/daily-learning');
const raw='{{WOTD|skint|adj|{{lb|en|informal}} [[have#Verb|Having]] [[no]] [[money]]; [[broke#Adjective|broke]].|comment=Extra|September|5}}';
assert.equal(parseWord(raw).definition,'Having no money; broke.');
assert.equal(parseWord('malformed'),null);
assert.equal(parseWord('{{WOTD|test|noun|sexual content|September|5}}'),null);
let stored={},fetches=0;
const ref={get:async()=>({data:()=>stored}),set:async v=>{stored=v;}};
const db={collection:()=>({doc:()=>ref}),runTransaction:async fn=>fn({get:ref.get,set:(_,v)=>{stored={...stored,...v};}})};
global.fetch=async url=>{fetches++;return {ok:true,text:async()=>JSON.stringify(url.includes('wiktionary')?{parse:{wikitext:{'*':raw}}}:[{q:'Learning gives us courage.',a:'Test author'}])};};
function response(){return {code:200,set(){},status(c){this.code=c;return this;},json(v){this.body=v;},end(){}};}
(async()=>{
 const run=handler(db),r=response();await run({method:'GET'},r);assert.equal(r.body.words[0].word,'skint');assert.equal(r.body.quotes.length,1);assert.equal(fetches,2);
 await run({method:'GET'},response());assert.equal(fetches,2,'same-day content must use database cache');
 const bad=response();await run({method:'POST'},bad);assert.equal(bad.code,405);
 stored.day='old';stored.leaseUntil=Date.now()+60000;await run({method:'GET'},response());assert.equal(fetches,2,'active lease must prevent another upstream fetch');
 stored.leaseUntil=0;global.fetch=async()=>{throw Error('offline');};const offline=response();await run({method:'GET'},offline);assert.equal(offline.body.words[0].word,'skint');
 console.log('Live content: nested word parsing, filtering, database caching, lease, method restrictions and offline fallback passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
