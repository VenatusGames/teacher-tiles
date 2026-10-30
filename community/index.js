import {firebaseConfig} from '../firebase-config.js';
import {el,eventArt,eventDates,resultRows,eventTitle} from './shared.js?v=20261021-banner-library';
const pane=document.querySelector('[data-settings-pane="news"]'),eventsRoot=document.getElementById('community-events'),pollsRoot=document.getElementById('community-polls'),status=document.getElementById('community-status');
let feed=null,votes={},loadedAt=0,epoch=0,busy=false,identity='',voteReady=false;
const eventLoading=el('div','community-loading community-events-loading','Loading events…');eventLoading.setAttribute('role','status');eventLoading.hidden=true;eventsRoot.before(eventLoading);
const pollLoading=el('div','community-loading community-polls-loading','Loading Polls');pollLoading.setAttribute('role','status');pollLoading.hidden=true;pollsRoot.before(pollLoading);
function setFeedLoading(loading){eventLoading.hidden=!loading;pollLoading.hidden=!loading;eventsRoot.setAttribute('aria-busy',String(loading));pollsRoot.setAttribute('aria-busy',String(loading));}
eventsRoot.tabIndex=0;eventsRoot.setAttribute('role','region');eventsRoot.setAttribute('aria-label','Running events');
const uid=()=>window.TeacherTilesAuth?.user?.uid||'';
const call=async data=>{const r=await window.TeacherTilesAuth.call('communityPolls',data);return r?.data??r};
const eventDialog=el('dialog','community-event-dialog');eventDialog.setAttribute('aria-labelledby','community-event-title');document.body.append(eventDialog);
eventDialog.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();eventDialog.close();}});
eventDialog.addEventListener('click',e=>{if(e.target===eventDialog){const r=eventDialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)eventDialog.close();}});
function openEvent(event){
 eventDialog.replaceChildren();const header=el('header'),title=eventTitle(event,'h2'),close=el('button','settings-panel__close');title.id='community-event-title';close.type='button';close.setAttribute('aria-label','Close Event');close.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg>';close.onclick=()=>eventDialog.close();header.append(title,close);eventDialog.append(header);const art=eventArt(event);if(art)eventDialog.append(art);const details=el('div','community-event-details');if(eventDates(event))details.append(el('time','',eventDates(event)));if(event.description)details.append(el('p','community-event-description',event.description));if(details.childNodes.length)eventDialog.append(details);eventDialog.showModal();
}
function render(){
 if(!feed)return;eventsRoot.replaceChildren();pollsRoot.replaceChildren();
 if(!feed.events.length)eventsRoot.append(el('p','community-empty','No community events are running at this time, check back soon! :)'));
 for(const event of feed.events){const card=el('article','community-card'),body=el('div','community-card-body'),art=eventArt(event);if(art){const opener=el('button','community-event-open');opener.type='button';opener.setAttribute('aria-label',`View ${event.name} event`);opener.append(art);opener.onclick=()=>openEvent(event);card.append(opener)}body.append(eventTitle(event));if(eventDates(event))body.append(el('time','',eventDates(event)));card.append(body);eventsRoot.append(card)}
 if(!feed.polls.length)pollsRoot.append(el('p','community-empty','No community polls are running at this time, check back soon! :)'));
 for(const poll of feed.polls){const card=el('article','community-card'),body=el('div','community-card-body'),art=eventArt(poll);if(art)card.append(art);body.append(el('h4','',poll.question));
 if(poll.state==='ended'){body.append(el('p','community-vote-note','Poll ended'),resultRows(poll,poll.results||{}))}
 else{const options=el('div','community-poll-options');for(const option of poll.options){const b=el('button','community-poll-option',option.label);b.type='button';b.disabled=!uid()||!voteReady||Boolean(votes[poll.id]);b.setAttribute('aria-pressed',String(votes[poll.id]===option.id));b.onclick=()=>vote(poll.id,option.id,options);options.append(b)}body.append(options,el('p','community-vote-note',!uid()?'Sign in to vote.':votes[poll.id]?'Your vote is recorded. Thank you!':!voteReady?'Checking your vote…':'Choose one answer. You can vote once.'))}
 card.append(body);pollsRoot.append(card)}
}
async function vote(pollId,optionId,options){if(!uid()||votes[pollId])return;const token=epoch,user=uid();options.querySelectorAll('button').forEach(b=>b.disabled=true);status.textContent='Submitting vote…';try{const result=await call({action:'vote',pollId,optionId});if(token!==epoch||user!==uid())return;votes[pollId]=result.optionId;status.textContent='Your vote is recorded.';render()}catch(e){if(token!==epoch)return;status.textContent=e.message||'Unable to submit your vote. Please try again.';loadedAt=0;render();if(String(e.code).includes('failed-precondition'))void load(true)}}
async function load(force=false){const user=uid();if(busy||!force&&feed&&Date.now()-loadedAt<30000&&identity===user)return;const token=++epoch;identity=user;busy=true;votes={};voteReady=false;status.textContent='Loading community…';setFeedLoading(true);render();try{
 const response=await fetch(`https://us-central1-${firebaseConfig.projectId}.cloudfunctions.net/communityFeed`,{signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error('Community could not load. Please try again.');const next=await response.json();if(token!==epoch)return;feed=next;setFeedLoading(false);render();
 if(user){const result=await call({action:'status'});if(token!==epoch||user!==uid())return;votes=result.votes||{}}voteReady=true;loadedAt=Date.now();status.textContent='';render();
 }catch(e){if(token!==epoch)return;status.replaceChildren(document.createTextNode(e.message||'Community could not load. '));const retry=el('button','community-retry','Retry');retry.type='button';retry.onclick=()=>load(true);status.append(' ',retry);if(!feed){eventsRoot.replaceChildren();pollsRoot.replaceChildren()}}
 finally{if(token===epoch){busy=false;setFeedLoading(false)}}}
window.addEventListener('teachertiles:settings-tab',e=>{if(e.detail?.name==='news')void load()});
const modal=document.getElementById('settings-modal');new MutationObserver(()=>{if(!modal.hidden&&!pane.hidden)void load()}).observe(modal,{attributes:true,attributeFilter:['hidden']});
for(const event of ['teachertiles:accountchange','teachertiles:authready'])window.addEventListener(event,()=>{if(identity===uid())return;epoch++;busy=false;setFeedLoading(false);identity=uid();votes={};voteReady=false;loadedAt=0;render();if(!modal.hidden&&!pane.hidden)void load(true)});
