"use strict";
const HOME_SITE_URL = new URL(".", document.currentScript.src);
const CONTACT_EMAIL = "teachertiles@gmail.com";
const menu = document.querySelector(".menu-toggle");
const nav = document.querySelector("#site-nav");
function closeMenu() { menu.setAttribute("aria-expanded", "false"); nav.classList.remove("is-open"); }
menu.addEventListener("click", () => {
  const open = menu.getAttribute("aria-expanded") !== "true";
  menu.setAttribute("aria-expanded", String(open)); nav.classList.toggle("is-open", open);
});
nav.addEventListener("click", (event) => { if (event.target.closest("a")) closeMenu(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && nav.classList.contains("is-open")) { closeMenu(); menu.focus(); } });
document.addEventListener("click", (event) => { if (!event.target.closest(".site-header")) closeMenu(); });
window.matchMedia("(min-width: 901px)").addEventListener("change", closeMenu);
document.querySelector("#year").textContent = String(new Date().getFullYear());

const catalog = window.TEACHER_TILES_CATALOG;
const tileMap = new Map(catalog.tiles.map(tile => [tile.id, tile]));
const titleCase = text => text.split(' ').map(word => ['PBIS','SEL','ABC'].includes(word) ? word : word[0] + word.slice(1).toLowerCase()).join(' ');
const categoryNames = new Map(catalog.categories.map(category => [category.id, titleCase(category.name)]));
const boardModes={morning:'Morning Routine',lesson:'Lesson Time',mindfulness:'Mindfulness',planningboard:'Planning'};
const canvas=document.querySelector('#board-canvas');let currentMode='morning';let actualSize=false;
function makeFrame(mode){const frame=document.createElement('iframe');frame.className='native-board';frame.title=mode==='planning'?'Try the Lesson Planner':mode==='stars'?'Try the Star Chart':mode==='meter'?'Try the Class Meter':`Interactive ${boardModes[mode]} Board`;frame.setAttribute('sandbox','allow-scripts allow-same-origin');frame.setAttribute('allow','fullscreen');frame.src=new URL(`demo/index.html?mode=${mode}`, HOME_SITE_URL).href;return frame;}
const demos=new Map();
function loadDemo(container,mode){const prior=demos.get(container);clearTimeout(prior?.timer);const frame=makeFrame(mode);container.replaceChildren(frame);demos.set(container,{frame,mode,timer:null,visible:prior?.visible??false});}
function showBoard(mode){currentMode=mode;actualSize=false;canvas.dataset.mode=mode;canvas.style.height="";document.querySelector('#board-name').textContent=boardModes[mode];document.querySelector('#demo-fit').textContent='View at 100%';document.querySelector('#demo-fit').setAttribute('aria-pressed','false');loadDemo(canvas,mode);document.querySelectorAll('[data-mode]').forEach(button=>{if(button.tagName==='BUTTON')button.setAttribute('aria-pressed',String(button.dataset.mode===mode))});}
document.querySelectorAll('.board-modes button').forEach(button=>button.addEventListener('click',()=>showBoard(button.dataset.mode)));showBoard('morning');
document.querySelector('#demo-reset').addEventListener('click',()=>showBoard(currentMode));
document.querySelector('#demo-fit').addEventListener('click',event=>{actualSize=!actualSize;demos.get(canvas).frame.contentWindow.postMessage({type:'demo-zoom',actual:actualSize},'*');event.currentTarget.textContent=actualSize?'Fit Board':'View at 100%';event.currentTarget.setAttribute('aria-pressed',String(actualSize));});
// Unload after 20 seconds out of view. Reentering creates a fresh, memory-only app instance.
const demoObserver=new IntersectionObserver(entries=>{for(const entry of entries){const container=entry.target;let state=demos.get(container);if(!state){if(entry.isIntersecting)loadDemo(container,container.dataset.demo);else continue;state=demos.get(container)}state.visible=entry.isIntersecting;clearTimeout(state.timer);if(entry.isIntersecting){if(!state.frame?.isConnected){if(container===canvas)showBoard(state.mode);else loadDemo(container,state.mode)}}else state.timer=setTimeout(()=>{state.frame?.remove();state.frame=null;},20000)}},{threshold:0});
demoObserver.observe(canvas);document.querySelectorAll('.live-feature').forEach(el=>demoObserver.observe(el));
document.querySelectorAll('[data-pbis]').forEach(button=>button.addEventListener('click',()=>{const host=document.querySelector('.pbis-visual .live-feature');host.dataset.demo=button.dataset.pbis;loadDemo(host,button.dataset.pbis);document.querySelectorAll('[data-pbis]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));}));
window.addEventListener('message',event=>{const state=[...demos.values()].find(s=>s.frame?.contentWindow===event.source);if(!state)return;if(event.data?.type==='demo-height'&&state.frame.parentElement===canvas&&innerWidth<700&&Number.isFinite(event.data.height))canvas.style.height=Math.max(500,Math.min(1600,event.data.height))+'px';if(event.data?.type==='demo-scroll'&&Number.isFinite(event.data.delta))window.scrollBy({top:Math.max(-1200,Math.min(1200,event.data.delta)),behavior:'instant'});});
function nativeIcon(tile){const holder=document.createElement('span');holder.className='native-icon';holder.setAttribute('aria-hidden','true');holder.innerHTML=tile.icon;return holder;}
function loop(track,group){const copy=group.cloneNode(true);copy.setAttribute('aria-hidden','true');copy.inert=true;track.append(group,copy)}
const categories=document.createElement('div');categories.className='category-group';catalog.categories.filter(category=>! ["favorites","all"].includes(category.id)).forEach(category=>{const chip=document.createElement('span');chip.className='category-chip';chip.textContent=categoryNames.get(category.id);categories.append(chip)});loop(document.querySelector('#category-list'),categories);
const tickerGroup=document.createElement('div');tickerGroup.className='ticker-group';
catalog.tiles.forEach(tile=>{const card=document.createElement('article');card.className='ticker-card';const text=document.createElement('div');const name=document.createElement('h3');name.textContent=tile.name;const description=document.createElement('p');description.textContent=tile.description;text.append(name,description);card.append(nativeIcon(tile),text);tickerGroup.append(card)});loop(document.querySelector('#ticker-track'),tickerGroup);document.querySelector('#ticker-track').style.setProperty('--ticker-duration',`${catalog.tiles.length*7}s`);
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');let paused=reducedMotion.matches;
function updateMotion(){document.querySelectorAll('.marquee').forEach(el=>el.classList.toggle('is-paused',paused));const button=document.querySelector('#motion-toggle');button.textContent=paused?'Resume Motion':'Pause Motion';button.setAttribute('aria-pressed',String(paused))}
document.querySelector('#motion-toggle').addEventListener('click',()=>{paused=!paused;updateMotion()});reducedMotion.addEventListener('change',()=>{paused=reducedMotion.matches;updateMotion()});updateMotion();
document.querySelectorAll('[data-featured-tools]').forEach(list=>{list.dataset.featuredTools.split(',').forEach(id=>{const tile=tileMap.get(id);const item=document.createElement('div');item.className='featured-tool';const text=document.createElement('div');const name=document.createElement('h3');name.textContent=tile.name;const description=document.createElement('p');description.textContent=tile.description;text.append(name,description);item.append(nativeIcon(tile),text);list.append(item)})});
document.querySelectorAll('dialog').forEach(dialog=>{dialog.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close()})});

const contactForm = document.querySelector("#contact-form");
const inquiryText = document.querySelector("#inquiry-text");
const inquiryStatus = document.querySelector("#inquiry-status");
const hasInbox = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(CONTACT_EMAIL);
if (hasInbox) {
  document.querySelector("#contact-submit").textContent = "Start the conversation";
  document.querySelector("#form-note").textContent = `Opens your email app with your message ready to send to ${CONTACT_EMAIL}.`;
}
contactForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!contactForm.reportValidity()) return;
  const fields = new FormData(contactForm);
  const inquiry = ["TeacherTiles inquiry", "", `Name: ${fields.get("name")}`, `Email: ${fields.get("email")}`, `School / organization: ${fields.get("organization") || "Not provided"}`, `Role: ${fields.get("role") || "Not provided"}`, `Interest: ${fields.get("interest")}`, "", fields.get("message")].join("\n");
  if (hasInbox) {
    const subject = `TeacherTiles: ${fields.get("interest")}`;
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(inquiry)}`;
    document.querySelector("#form-status").textContent = "Review your message and choose Send in your email app. If it doesn’t open, copy your inquiry below and email teachertiles@gmail.com.";
    document.querySelector("#prepare-copy").hidden = false;
  }
  inquiryText.value = inquiry; inquiryStatus.textContent = "";
  if (!hasInbox) document.querySelector("#inquiry-dialog").showModal();
});
document.querySelector("#prepare-copy").addEventListener("click", () => { document.querySelector("#inquiry-dialog").showModal(); });
document.querySelector("#copy-inquiry").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(inquiryText.value); inquiryStatus.textContent = "Copied. Your inquiry is ready to paste into an email."; }
  catch { inquiryText.focus(); inquiryText.select(); inquiryStatus.textContent = "Select and copy the text above, or save it as a text file."; }
});
document.querySelector("#download-inquiry").addEventListener("click", () => {
  const url = URL.createObjectURL(new Blob([inquiryText.value], {type:"text/plain;charset=utf-8"}));
  const link = document.createElement("a"); link.href = url; link.download = "TeacherTiles-inquiry.txt"; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000); inquiryStatus.textContent = "Your inquiry file is ready. Nothing has been sent.";
});
document.querySelector("[data-general-contact]").addEventListener("click", () => { contactForm.elements.interest.value = "General question or feedback"; });


window.addEventListener("resize",()=>{if(innerWidth>=700)canvas.style.height=""});
