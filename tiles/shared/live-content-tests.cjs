const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let saved={},wordCalls=0,quoteCalls=0,quoteOnline=false,now=Date.now();
class Clock extends Date {static now(){return now;}}
const context={window:{TeacherTilesLive:{words:async()=>{wordCalls++;return [{word:'limnological'}];},quotes:async()=>{quoteCalls++;if(!quoteOnline)throw Error('offline');return [{text:'Keep discovering.',author:'Test author'}];}}},Date:Clock,localStorage:{getItem:k=>saved[k],setItem:(k,v)=>saved[k]=v}};
vm.runInNewContext(fs.readFileSync('tiles/shared/daily.js','utf8'),context);
(async()=>{
 const daily=context.window.TeacherTilesDaily;
 const [one,two]=await Promise.all([daily.feed(),daily.feed()]);assert.equal(wordCalls,1);assert.equal(quoteCalls,1);assert.equal(one.words.length,1);assert.equal(two.quotes.length,0);assert(!one.quotesDay);
 await daily.feed();assert.equal(wordCalls,1,'failure retry is throttled');
 now+=61000;quoteOnline=true;const full=await daily.feed();assert.equal(full.quotes.length,1);assert.equal(full.quotesDay,daily.dayKey());
 await daily.feed();assert.equal(quoteCalls,2,'fresh content is cached for the day');
 const parser={window:{}};vm.runInNewContext(fs.readFileSync('tiles/shared/live.js','utf8'),parser);
 const parse=parser.window.TeacherTilesLive.parseWord;
 assert.equal(parse('{{WOTD|limnological|adj|Relating to [[lake]]s.|comment=Extra|September|5}}').definition,'Relating to lakes.');assert.equal(parse('invalid'),null);
 assert.equal(parse('{{WOTD|limnological|adj|Relating to {{l|en|lake}}s and their study.|September|5}}').definition,'Relating to lakes and their study.');
 assert.equal(parse('{{WOTD|example|n|A {{unknown-template|critical meaning}}.|September|5}}'),null);
 assert.equal(parse('{{WOTD|example|n|{{unknown-template|all the definition}}|September|5}}'),null);
 assert.equal(parse('{{WOTD|example|n|A [[lake#English]] with &quot;clear&quot; water.|September|5}}').definition,'A lake with "clear" water.');
 assert.equal(parser.window.TeacherTilesLive.validQuote({text:'',author:'Someone'}),false);
 assert.equal(parser.window.TeacherTilesLive.validWord({word:'test',part:'noun',definition:'{{broken}}'}),false);
 console.log('Live feeds: shared requests, independent freshness, failure retry, daily cache, and nested word parsing passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
