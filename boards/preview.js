import '../tiles/countdown/index.js?v=20261003';
import '../tiles/tens-sticks/index.js?v=20261008';
import '../tiles/lava-lamp/index.js?v=20261008';
import '../tiles/interactive-timers/hourglass.js';
import '../tiles/interactive-timers/wonders.js?v=20261002-ice-cube';
import '../tiles/interactive-timers/garden-rocket.js';
import {renderTimerPreview} from './timer-preview.js?v=20261002-pack';
const EDITABLE_TILE_HEADINGS={
  wordoftheday:'.widget-title',
  quoteoftheday:'.widget-title',
  colorpicker:'.widget-title',
  rainbow:'.widget-title',
  meditation:'.meditation-title',rainbowbreath:'.meditation-title',
  noise:'.nm-heading',
  squishy:'.squishy-heading',
  coinflip:'.coinflip-heading',
  spreadsheet:'.sheet-heading',
  sentenceexpansion:'.sentence-heading',
  reminders:'.reminders-heading',
  glitterjar:'.glitter-jar-heading',
  tenssticks:'.tens-heading',
  lavalamp:'.lava-heading',
  piano:'.widget-title',
  musicscore:'.widget-title',
  vocabulary:'.widget-title',
  visualdirections:'.widget-title',
  timestables:'.widget-title',
  google:'.widget-title',
  link:'.widget-title',
  dice:'.dice-module h2',
  fishtank:'.fish-heading h2',
  sleepymonster:'.sleepymonster-heading h2',
  quietcritters:'.quietcritters-heading h2',
  chime:'.widget-title',
  butterflygarden:'.butterflygarden-heading h2',
  seatingchart:'.seating-title',
  imagesearch:'.image-search-header h2',

  collections:'.collection-title',
  groupmaker:'.groupmaker-heading strong',
  lunchcount:'.lunchcount-heading strong',
  voting:'.voting-heading strong',
  ruler:'.ruler-header>div>span',
  calculator:'.calculator-header>span',
  grapher:'.grapher-header strong',
  tablemaker:'.table-maker-title',
  tallychart:'.tally-chart-title',
  periodictable:'.periodic-header strong',
  money:'.money-header strong:first-of-type',
  cvcword:'.cvcword-header>div>span:first-child',
  highfrequency:'.highfrequency-header>div>span:first-child',
  customflashcards:'.customflashcards-header>div>span:first-child',
  abc:'.abc-header>div>span:first-child',
  numberflashcards:'.number-flashcards-header>div>span:first-child',
  numberline:'.numberline-heading>span:first-child',
  hundredschart:'.hundreds-header>div>span:first-child',
  tenframes:'.tenframes-heading>span:first-child',
  dictionary:'.dictionary-header strong',
  translation:'.translation-title',
  attendance:'.attendance-title',
  livecaption:'.livecaption-title',
  voicememo:'.voicememo-title',
  worldmap:'.worldmap-title',usstates:'.worldmap-title',
  compass:'.compass-title',
  shapes:'.shapes-header>div>span:first-child',
  hangman:'.hangman-kicker',
  wordypuzzle:'.wordy-kicker',
  photobooth:'.photobooth-title',
  backgroundremover:'.backgroundremover-title',
  mirror:'.mirror-title',
  weather:'.weather-title',
  temperature:'.temperature-title'
};
let previewIds=0;
let previewTemplates=null;
export function setPreviewTemplates(doc){previewTemplates=doc;}
function previewThemeClass(theme) {
  const safe = String(theme || "light").toLowerCase().replace(/[^a-z0-9-]/g, "");
  return `board-preview-theme-${safe || "light"}`;
}

function layoutBoardPreviewObjects(objects) {
  const list = (Array.isArray(objects) ? objects : []).filter(Boolean).slice(0, 48);
  if (!list.length) return [];

  const boxes = list.map(state => {
    const transform = state.transform || {};
    return {
      state,
      left: Number(transform.left) || 0,
      top: Number(transform.top) || 0,
      width: Math.max(24, (Number(transform.width) || 160) * (Number(transform.uniformScale) || 1)),
      height: Math.max(24, (Number(transform.height) || 120) * (Number(transform.uniformScale) || 1))
    };
  });

  let minX = Math.min(...boxes.map(box => box.left));
  let minY = Math.min(...boxes.map(box => box.top));
  let maxX = Math.max(...boxes.map(box => box.left + box.width));
  let maxY = Math.max(...boxes.map(box => box.top + box.height));
  const pad = Math.max(120, Math.max(maxX - minX, maxY - minY) * .08);
  minX -= pad;
  minY -= pad;
  maxX += pad;
  maxY += pad;
  let spanX = Math.max(1, maxX - minX);
  let spanY = Math.max(1, maxY - minY);
  const previewAspect = 16 / 10;
  const contentAspect = spanX / spanY;
  if (contentAspect > previewAspect) {
    const fittedHeight = spanX / previewAspect;
    minY -= (fittedHeight - spanY) / 2;
    spanY = fittedHeight;
  } else {
    const fittedWidth = spanY * previewAspect;
    minX -= (fittedWidth - spanX) / 2;
    spanX = fittedWidth;
  }

  return boxes.map(({ state, left, top, width, height }) => ({
    type: state.type,
    x: Math.max(0, Math.min(1, (left - minX) / spanX)),
    y: Math.max(0, Math.min(1, (top - minY) / spanY)),
    w: Math.max(.001, Math.min(1, width / spanX)),
    h: Math.max(.001, Math.min(1, height / spanY)),
    emoji: state.sticker?.emoji || "",
    src: state.sticker?.src || "",
    state
  }));
}

function plainTextFromSavedHtml(html = "") {
  const template = document.createElement("template");
  template.innerHTML = String(html);
  return template.content.textContent || "";
}

const PBIS_PREVIEW_SHELLS = {
  starchart: ["starchart", "classId"],
  classmeter: ["classmeter", "classId"],
  collections: ["collection", "classId"],
  prizeboard: ["prizeboard", "activeClassId"],
  pbisconsole: ["pbisconsole", "activeClassId"],
  punchcards: ["punchcard", "activeClassId"],
  racer: ["racer", "activeClassId"]
};

function previewStudentKey(name = "") {
  return `student:${String(name).trim().toLocaleLowerCase()}`;
}

function previewCount(value, max = 9999) {
  return Math.max(0, Math.min(max, Math.round(Number(value) || 0)));
}

function previewRosterForState(state, special) {
  const config = PBIS_PREVIEW_SHELLS[state?.type];
  if (!config) return null;
  const classId = String(special?.[config[1]] || "");
  if (!classId) return null;
  if (special?.previewRoster && typeof special.previewRoster === "object") return special.previewRoster;
  try {
    if (typeof readClassRosters !== "function") return null;
    return readClassRosters().find(item => item?.id === classId) || null;
  } catch {
    return null;
  }
}

function setPreviewText(module, selector, value) {
  const element = module.querySelector(selector);
  if (element) element.textContent = String(value ?? "");
}

function applyPbisPreviewState(module, state, special) {
  const config = PBIS_PREVIEW_SHELLS[state?.type];
  if (!config) return;
  const roster = previewRosterForState(state, special);
  if (!roster) return;
  const prefix = config[0];
  const importView = module.querySelector(`.${prefix}-import`);
  const dashboard = module.querySelector(`.${prefix}-dashboard`);
  if (importView) importView.hidden = true;
  if (dashboard) dashboard.hidden = false;
  setPreviewText(module, `.${prefix}-class-name`, roster.name || "Class");
  setPreviewText(module, `.${prefix}-class-logo`, roster.logo || "👥");

  if (state.type === "classmeter") {
    const fill = Math.max(0, Math.min(100, Number(roster.classMeter?.fill) || 0));
    const wins = previewCount(roster.classMeter?.wins);
    module.dataset.orientation = special?.orientation === "horizontal" ? "horizontal" : "vertical";
    module.style.setProperty("--classmeter-fill", `${fill}%`);
    module.classList.toggle("has-meter-fill", fill > 0);
    setPreviewText(module, ".classmeter-percent", `${Math.round(fill)}%`);
    setPreviewText(module, ".classmeter-win-count b", wins);
    module.querySelector(".classmeter-meter")?.setAttribute("aria-valuenow", String(Math.round(fill)));
  }

  if (state.type === "starchart") {
    const progress = roster.starChart || {};
    const whole = progress.mode === "whole";
    module.querySelectorAll("[data-starchart-mode]").forEach(button => {
      button.classList.toggle("is-active", button.dataset.starchartMode === (whole ? "whole" : "student"));
    });
    const studentView = module.querySelector(".starchart-student-view");
    const wholeView = module.querySelector(".starchart-whole-view");
    if (studentView) studentView.hidden = whole;
    if (wholeView) wholeView.hidden = !whole;
    setPreviewText(module, ".starchart-whole-class-name", roster.name || "Class");
    setPreviewText(module, ".starchart-whole-badge", roster.logo || "★");
    setPreviewText(module, ".starchart-whole-count b", previewCount(progress.wholeClassStars));
    const bundles = module.querySelector(".starchart-whole-bundles");
    if (bundles) bundles.textContent = "★".repeat(Math.min(12, previewCount(progress.wholeClassStars)));
    const grid = module.querySelector(".starchart-student-grid");
    if (grid) {
      grid.replaceChildren();
      for (const name of (roster.students || []).slice(0, 12)) {
        const count = previewCount(progress.studentStars?.[previewStudentKey(name)]);
        const row = document.createElement("article");
        row.className = "starchart-student-row";
        const main = document.createElement("div");
        main.className = "starchart-student-row__main";
        const identity = document.createElement("div");
        identity.className = "starchart-student-name";
        const label = document.createElement("strong");
        label.textContent = name;
        const total = document.createElement("span");
        total.textContent = `${count} ${count === 1 ? "star" : "stars"}`;
        const stars = document.createElement("div");
        stars.className = "starchart-star-stage";
        stars.textContent = count ? `${"★".repeat(Math.min(8, count))}${count > 8 ? ` +${count - 8}` : ""}` : "No stars yet";
        identity.append(label, total);
        main.append(identity, stars);
        row.append(main);
        grid.append(row);
      }
      grid.hidden = !(roster.students || []).length;
    }
    const noStudents = module.querySelector(".starchart-no-students");
    if (noStudents) noStudents.hidden = Boolean((roster.students || []).length);
  }

  if (state.type === "collections") {
    const progress = roster.collectionJar || {};
    const count = previewCount(progress.count, 80);
    const icons = { pompom: "●", candy: "🍬", star: "★", jellybean: "◉", fruit: "🍎", coin: "●" };
    setPreviewText(module, ".collection-count", `${count} item${count === 1 ? "" : "s"}`);
    setPreviewText(module, ".collection-jars-filled", previewCount(progress.jarsFilled));
    setPreviewText(module, ".collection-type-label", String(progress.item || "pompom").replace(/^./, letter => letter.toUpperCase()));
    module.classList.toggle("is-collection-filled", Boolean(progress.filled));
    const filledBanner = module.querySelector(".collection-filled-banner");
    if (filledBanner) filledBanner.hidden = !progress.filled;
    const stage = module.querySelector(".collection-stage");
    if (stage) {
      const visual = document.createElement("div");
      visual.className = "collection-preview-state";
      visual.textContent = `${icons[progress.item] || "●"} ${count}`;
      visual.style.cssText = "position:absolute;inset:15% 20%;z-index:3;display:grid;place-items:center;border:3px solid rgba(83,126,173,.32);border-radius:28% 28% 42% 42%;background:linear-gradient(180deg,rgba(255,255,255,.18),rgba(85,156,220,.16));font-size:clamp(28px,12cqw,72px);font-weight:950;color:#4d91df";
      stage.append(visual);
    }
  }

  if (state.type === "punchcards") {
    const progress = roster.punchcards || {};
    const scope = special?.scope === "class" ? "class" : "student";
    const student = (roster.students || []).includes(special?.student) ? special.student : (roster.students?.[0] || "");
    const key = previewStudentKey(student);
    const punched = scope === "class" ? previewCount(progress.wholeClassProgress, 9) : previewCount(progress.studentProgress?.[key], 9);
    const points = scope === "class" ? previewCount(progress.wholeClassPoints) : previewCount(progress.studentPoints?.[key]);
    module.querySelectorAll("[data-punchcard-scope]").forEach(tab => tab.classList.toggle("is-active", tab.dataset.punchcardScope === scope));
    const studentWrap = module.querySelector(".punchcard-student-wrap");
    if (studentWrap) studentWrap.hidden = scope === "class";
    setPreviewText(module, ".punchcard-name", scope === "class" ? roster.name : (student || "Student"));
    setPreviewText(module, ".punchcard-type", scope === "class" ? "WHOLE CLASS PUNCHCARD" : "STUDENT PUNCHCARD");
    setPreviewText(module, ".punchcard-points-value", points);
    const holes = module.querySelector(".punchcard-holes");
    if (holes) {
      holes.replaceChildren();
      for (let index = 0; index < 10; index++) {
        const hole = document.createElement("span");
        hole.className = `punchcard-hole${index < punched ? " is-punched" : ""}`;
        holes.append(hole);
      }
    }
  }

  if (state.type === "racer") {
    const progress = roster.racer || {};
    const standees = module.querySelector(".racer-standees");
    if (standees) {
      standees.replaceChildren();
      for (const [index, name] of (roster.students || []).slice(0, 10).entries()) {
        const key = previewStudentKey(name);
        const percent = Math.max(0, Math.min(100, Number(progress.positions?.[key]) || 0));
        const t = percent / 100;
        const standee = document.createElement("span");
        standee.className = `racer-standee is-ready${progress.finished?.[key] ? " is-finished" : ""}`;
        standee.style.left = `${6 + t * 88}%`;
        standee.style.top = `${54 - 40 * t * (1 - t)}%`;
        standee.style.zIndex = String(20 + index % 6);
        standee.style.setProperty("--racer-hue", String((index * 47 + 195) % 360));
        const character = document.createElement("span");
        character.className = "racer-character";
        const label = document.createElement("strong");
        label.textContent = name;
        character.append(label);
        standee.append(character);
        standees.append(standee);
      }
    }
    const finishers = (roster.students || []).filter(name => progress.finished?.[previewStudentKey(name)]).length;
    setPreviewText(module, ".racer-status", finishers ? `${finishers} ${finishers === 1 ? "finisher" : "finishers"}` : "Race in progress");
  }

  if (state.type === "pbisconsole") {
    const view = special?.view === "class" ? "class" : "students";
    const student = (roster.students || []).includes(special?.student) ? special.student : (roster.students?.[0] || "");
    module.querySelectorAll("[data-pbisconsole-view]").forEach(tab => tab.classList.toggle("is-active", tab.dataset.pbisconsoleView === view));
    const toolbar = module.querySelector(".pbisconsole-student-toolbar");
    if (toolbar) toolbar.hidden = view === "class";
    const key = previewStudentKey(student);
    const definitions = view === "class"
      ? [["★", "Whole-class Stars", roster.starChart?.wholeClassStars], ["🏆", "Meter Wins", roster.classMeter?.wins], ["🫙", "Jars Filled", roster.collectionJar?.jarsFilled], ["💧", "Meter Fill", `${Math.round(Number(roster.classMeter?.fill) || 0)}%`]]
      : [["★", "Student Stars", roster.starChart?.studentStars?.[key]], ["●", "Punchcard Points", roster.punchcards?.studentPoints?.[key]], ["🏁", "Race Wins", roster.racer?.studentWins?.[key]]];
    const stats = module.querySelector(".pbisconsole-stats");
    if (stats) {
      stats.replaceChildren();
      for (const [icon, label, rawValue] of definitions) {
        const row = document.createElement("section");
        row.className = "pbisconsole-stat";
        row.innerHTML = `<div class="pbisconsole-stat-copy"><span>${icon}</span><div><strong></strong><small></small></div></div><div class="pbisconsole-stat-value"><strong></strong></div>`;
        row.querySelector(".pbisconsole-stat-copy strong").textContent = label;
        row.querySelector(".pbisconsole-stat-copy small").textContent = view === "class" ? "Whole class" : (student || "Student");
        row.querySelector(".pbisconsole-stat-value strong").textContent = typeof rawValue === "string" ? rawValue : String(previewCount(rawValue));
        stats.append(row);
      }
    }
  }

  if (state.type === "prizeboard") {
    const scope = special?.scope === "class" ? "class" : "student";
    module.querySelectorAll("[data-prize-scope]").forEach(tab => tab.classList.toggle("is-active", tab.dataset.prizeScope === scope));
    const grid = module.querySelector(".prizeboard-grid");
    if (grid) {
      grid.replaceChildren();
      const prizes = (Array.isArray(special?.prizes) ? special.prizes : []).filter(prize => prize?.scope === scope).slice(0, 8);
      if (!prizes.length) {
        const empty = document.createElement("div");
        empty.className = "prizeboard-empty";
        empty.innerHTML = `<span>${scope === "class" ? "🎉" : "🎁"}</span><strong>No prizes yet</strong>`;
        grid.append(empty);
      }
      for (const prize of prizes) {
        const card = document.createElement("article");
        card.className = "prize-card";
        const image = document.createElement("img");
        image.alt = "";
        if (prize.image) image.src = prize.image;
        const copy = document.createElement("span");
        copy.className = "prize-card-copy";
        const title = document.createElement("strong");
        title.textContent = prize.title || "Prize";
        const cost = document.createElement("span");
        cost.className = "prize-card-cost";
        cost.textContent = String(previewCount(prize.cost));
        copy.append(title);
        card.append(image, copy, cost);
        grid.append(card);
      }
    }
  }
}

function applyPreviewState(module, state) {
  if (!module || !state) return;
  const special = state.special && typeof state.special === "object" ? state.special : null;

  const ids=new Map();for(const element of module.querySelectorAll('[id]')){if(element instanceof SVGElement){const before=element.id,after='board-preview-'+(++previewIds);ids.set(before,after);element.id=after;}else element.removeAttribute('id');}for(const element of module.querySelectorAll('*'))for(const attr of [...element.attributes]){let value=attr.value;for(const [before,after] of ids){value=value.split('url(#'+before+')').join('url(#'+after+')');if(value==='#'+before)value='#'+after;}if(value!==attr.value)element.setAttribute(attr.name,value);}
  module.removeAttribute("id");
  module.setAttribute("aria-hidden", "true");

  if (state.dataset && typeof state.dataset === "object") {
    for (const [key, value] of Object.entries(state.dataset)) {
      if (key === "type" || key === "boardObjectId") continue;
      module.dataset[key] = String(value);
    }
  }

  const border=state.dataset?.appearanceBorderStyle;if(['solid','dashed','dotted','double'].includes(border)){const size=Math.max(1,Math.min(20,Number(state.dataset.appearanceBorderSize)||2)),color=/^#[0-9a-f]{6}$/i.test(state.dataset.appearanceBorderColor||'')?state.dataset.appearanceBorderColor:'#17191d';module.style.setProperty('outline',size+'px '+border+' '+color,'important');module.style.setProperty('outline-offset',-size+'px');}
  for (const cls of Array.isArray(state.classes) ? state.classes : []) module.classList.add(cls);


  if (state.type === "shapes") {
    const shapePaths = {
      circle: "M44 100 A76 76 0 0 1 196 100 A76 76 0 0 1 44 100 Z",
      square: "M48 28 H192 V172 H48 Z",
      star: "M120 14 L145 70 L206 75 L159 115 L176 177 L120 143 L64 177 L81 115 L34 75 L95 70 Z",
      triangle: "M120 22 L218 174 H22 Z",
      oval: "M20 100 A100 58 0 0 1 220 100 A100 58 0 0 1 20 100 Z",
      diamond: "M120 16 L222 100 L120 184 L18 100 Z",
      hexagon: "M72 18 H168 L216 100 L168 182 H72 L24 100 Z",
      rectangle: "M24 52 H216 V148 H24 Z",
      pentagon: "M120 14 L210 80 L176 186 H64 L30 80 Z",
      octagon: "M70 14 H170 L226 70 V130 L170 186 H70 L14 130 V70 Z"
    };
    const savedShape = state.special?.shape || state.dataset?.shape || "circle";
    const selected = shapePaths[savedShape] ? savedShape : "circle";
    const names = { circle: "Circle", square: "Square", star: "Star", triangle: "Triangle", oval: "Oval", diamond: "Diamond", hexagon: "Hexagon", rectangle: "Rectangle", pentagon: "Pentagon", octagon: "Octagon" };
    const counts = { circle: ["0", "0"], square: ["4", "4"], star: ["10", "10"], triangle: ["3", "3"], oval: ["0", "0"], diamond: ["4", "4"], hexagon: ["6", "6"], rectangle: ["4", "4"], pentagon: ["5", "5"], octagon: ["8", "8"] };
    module.querySelector(".shapes-path")?.setAttribute("d", shapePaths[selected]);
    module.querySelectorAll(".shapes-title,.shapes-name").forEach(element => { element.textContent = names[selected]; });
    const sides = module.querySelector(".shapes-sides");
    const vertices = module.querySelector(".shapes-vertices");
    if (sides) sides.textContent = counts[selected][0];
    if (vertices) vertices.textContent = counts[selected][1];
    module.querySelectorAll("[data-shape-choice]").forEach(button => {
      button.classList.toggle("is-active", button.dataset.shapeChoice === selected);
    });
  }

  if (state.type === "dictionary" && Array.isArray(state.special?.entries) && state.special.entries.length) {
    const entry = state.special.entries[0] || {};
    const firstMeaning = Array.isArray(entry.meanings) ? entry.meanings[0] : null;
    const firstDefinition = Array.isArray(firstMeaning?.definitions) ? firstMeaning.definitions[0] : null;
    const welcome = module.querySelector(".dictionary-welcome");
    const results = module.querySelector(".dictionary-results");
    if (welcome) welcome.hidden = true;
    if (results) {
      results.hidden = false;
      const article = document.createElement("article");
      article.className = "dictionary-entry";
      const heading = document.createElement("header");
      heading.className = "dictionary-entry-head";
      const identity = document.createElement("div");
      const word = document.createElement("strong");
      word.textContent = String(entry.word || state.special.query || "Word");
      identity.appendChild(word);
      heading.appendChild(identity);
      article.appendChild(heading);
      if (firstDefinition?.definition) {
        const meaning = document.createElement("section");
        meaning.className = "dictionary-meaning";
        const copy = document.createElement("p");
        copy.textContent = String(firstDefinition.definition);
        meaning.appendChild(copy);
        article.appendChild(meaning);
      }
      results.replaceChildren(article);
    }
  }

  const controls = [...module.querySelectorAll("input,textarea,select")];
  for (const saved of Array.isArray(state.fields) ? state.fields : []) {
    const field = controls[saved.index];
    if (!field || (field instanceof HTMLInputElement && field.type === "file")) continue;
    if (typeof saved.value === "string") field.value = saved.value;
    if (saved.checked !== undefined && "checked" in field) field.checked = Boolean(saved.checked);
    field.tabIndex = -1;
  }

  if(state.type==='tenssticks'){window.TeacherTilesTensSticks.render(module,state.special||{});const area=module.querySelector('.tens-workspace');const w=Number(state.transform?.width)||700,h=Number(state.transform?.height)||460;area.style.transform=`translate(-50%,-50%) scale(${Math.min((w-34)/640,(h-143)/340)})`;}
  if(state.type==='tensblock')module.querySelector('.tens-block-art').innerHTML=window.TeacherTilesTensSticks.art(Number(state.dataset?.blockValue)||1);
  if(state.type==='lavalamp')window.TeacherTilesLavaLamp.render(module,state.special||{});
  if(state.type==='countdown'){window.TeacherTilesCountdown.render(module,state.special||{});module.querySelector('.countdown-heading')?.classList.toggle('tile-heading-hidden',state.dataset?.tileHeadingHidden!=='false');}
  if (state.type === 'timer' || state.type === 'interactive') {
    module.querySelectorAll('input[type="number"],input[type="time"]').forEach(n=>n.value='');
    renderTimerPreview(module,state);
  }
  if(state.type==='progressbar'){
    const title=module.querySelector('.progress-bar-title');
    if(title){const heading=document.createElement('div');heading.className=title.className;heading.textContent=state.special?.title??title.value;heading.style.cssText='border:0;background:transparent;box-shadow:none';title.replaceWith(heading);}
    module.querySelector('.progress-bar-remaining').textContent='00:00';
    module.querySelector('.progress-bar-end-label').textContent='';
  }
  const headingSelector=EDITABLE_TILE_HEADINGS[state.type];
  const heading=headingSelector?module.querySelector(headingSelector):null;
  if(heading)heading.setAttribute('contenteditable','true');
  const editables = [...module.querySelectorAll('[contenteditable]:not([contenteditable="false"])')];
  for (const saved of Array.isArray(state.editables) ? state.editables : []) {
    const editable = editables[saved.index];
    if (!editable) continue;
    editable.textContent = plainTextFromSavedHtml(saved.html);
    editable.removeAttribute("contenteditable");
  }

  if(heading){if(typeof special?.title==='string')heading.textContent=special.title;heading.removeAttribute('contenteditable');}
  if (state.type === "image" && special) {
    const image = module.querySelector(".image-display");
    const src = String(special.previewSrc || special.src || "");
    if (image && src) {
      image.src = src;
      image.alt = "";
      image.hidden = false;
      module.classList.add("has-image");
    }
    module.dataset.imageBorder = ["none", "thin", "medium", "thick", "double"].includes(special.border) ? special.border : "none";
    if (/^#[0-9a-f]{6}$/i.test(special.borderColor || "")) module.style.setProperty("--image-border-color", special.borderColor);
  }

  if (state.type === "attendance" && special) {
    const statuses = ["default", "present"];
    const students = (Array.isArray(special.students) ? special.students : [])
      .map(name => String(name || "").trim())
      .filter(Boolean)
      .slice(0, 36);
    const grouped = { default: [], present: [] };
    for (const name of students) {
      const saved = special.assignments?.[name];
      grouped[saved === "present" ? "present" : "default"].push(name);
    }
    const hasClass = Boolean(special.classId || students.length);
    module.classList.toggle("has-attendance-class", hasClass);
    module.dataset.attendanceReady = String(hasClass);
    setPreviewText(module, ".attendance-class-name", hasClass ? (special.className || "Class") : "No class loaded");
    setPreviewText(module, ".attendance-class-logo", hasClass ? (special.classLogo || "👥") : "👥");
    setPreviewText(module, ".attendance-summary strong", `${grouped.present.length}/${students.length}`);
    setPreviewText(module, ".attendance-status", hasClass ? `${grouped.default.length} not checked in · ${grouped.present.length} present` : "Choose a saved class above to begin.");
    const emptyState = module.querySelector(".attendance-empty-state");
    if (emptyState) emptyState.hidden = hasClass;
    const reset = module.querySelector(".attendance-reset");
    if (reset) reset.hidden = true;
    module.dataset.attendanceDensity = students.length > 24 ? "dense" : students.length > 12 ? "compact" : "comfortable";
    const assets = {
      "attendance-beehive": "assets/attendance/bee.png",
      "attendance-monkeys": "assets/attendance/monkey.png",
      "attendance-froggies": "assets/attendance/froggie.png",
      "attendance-bubble-tea": "assets/attendance/boba.png"
    };
    const asset = assets[module.dataset.tileSkin || ""] || "";
    const scenes = {
      "attendance-beehive": "assets/attendance/scene-hive.png",
      "attendance-monkeys": "assets/attendance/scene-tree.png",
      "attendance-froggies": "assets/attendance/scene-lily-pads.png",
      "attendance-bubble-tea": "assets/attendance/scene-boba-cup.png"
    };
    const worldImage = module.querySelector(".attendance-world__main");
    const scene = scenes[module.dataset.tileSkin || ""] || "";
    if (worldImage) {
      worldImage.src = scene;
      worldImage.hidden = !scene;
    }
    const fallbackPosition = (index, total) => {
      const preferred = total <= 8 ? 3 : total <= 16 ? 4 : total <= 25 ? 5 : 6;
      const columns = Math.max(1, Math.min(total || 1, preferred));
      const rows = Math.max(1, Math.ceil(total / columns));
      return {
        x: columns === 1 ? 0.5 : 0.2 + ((index % columns) / (columns - 1)) * 0.6,
        y: rows === 1 ? 0.5 : 0.17 + (Math.floor(index / columns) / (rows - 1)) * 0.66
      };
    };
    for (const status of statuses) {
      const list = module.querySelector(`[data-attendance-stage="${status}"]`);
      const count = module.querySelector(`[data-attendance-count="${status}"]`);
      if (count) count.textContent = String(grouped[status].length);
      if (!list) continue;
      list.replaceChildren();
      grouped[status].forEach((name, index) => {
        const chip = document.createElement("span");
        chip.className = "attendance-student";
        const art = document.createElement("span");
        art.className = "attendance-student-art";
        if (asset) {
          const image = document.createElement("img");
          image.src = asset;
          image.alt = "";
          art.appendChild(image);
        } else art.innerHTML = "<i></i><b></b>";
        const label = document.createElement("span");
        label.className = "attendance-student-name";
        label.textContent = name;
        const saved = special.positions?.[name];
        const position = saved && Number.isFinite(Number(saved.x)) && Number.isFinite(Number(saved.y)) ? {
          x: Math.max(0.18, Math.min(0.82, Number(saved.x))),
          y: Math.max(0.14, Math.min(0.86, Number(saved.y)))
        } : fallbackPosition(index, grouped[status].length);
        chip.style.left = `${position.x * 100}%`;
        chip.style.top = `${position.y * 100}%`;
        const tilt = [...name].reduce((total, letter) => total + letter.codePointAt(0), 0) % 7 - 3;
        chip.style.setProperty("--attendance-tilt", `${tilt}deg`);
        chip.append(art, label);
        list.appendChild(chip);
      });
      if (!grouped[status].length) {
        const hint = document.createElement("span");
        hint.className = "attendance-stage-empty";
        hint.textContent = status === "present" ? "Drop students anywhere here" : "Every student is present";
        list.appendChild(hint);
      }
    }
  }

  applyPbisPreviewState(module, state, special);
  if (state.type === "progressbar" && special) {
    const applyIcon = (selector, src) => {
      const slot = module.querySelector(selector);
      const image = slot?.querySelector("img");
      if (!slot || !image || !src) return;
      image.src = String(src);
      image.alt = "";
      slot.dataset.iconSrc = String(src);
      slot.classList.add("has-icon");
    };
    applyIcon(".progress-bar-icon-start", special.startIconSrc || special.startIcon || "");
    applyIcon(".progress-bar-icon-end", special.endIconSrc || special.endIcon || "");
  }

  if (state.type === "visualschedule" && special && Array.isArray(special.segments)) {
    const list = module.querySelector(".visual-schedule-list");
    if (list) {
      list.replaceChildren();
      for (const segment of special.segments.slice(0, 12)) {
        const row = document.createElement("div");
        row.className = `visual-schedule-segment${segment?.complete ? " is-complete" : ""}`;
        if (segment?.iconSrc) row.dataset.iconSrc = String(segment.iconSrc);
        const segmentSize = Math.max(76, Math.min(220, Number(segment?.size) || 86));
        row.dataset.segmentSize = String(segmentSize);
        row.style.setProperty("--visual-segment-size", `${segmentSize}px`);

        const imageButton = document.createElement("button");
        imageButton.type = "button";
        imageButton.className = "visual-schedule-image";
        const image = document.createElement("img");
        image.alt = "";
        image.draggable = false;
        if (segment?.iconSrc) image.src = String(segment.iconSrc);
        imageButton.appendChild(image);

        const title = document.createElement("input");
        title.className = "visual-schedule-segment-title";
        title.type = "text";
        title.value = String(segment?.title || "");

        const time = document.createElement("input");
        time.className = "visual-schedule-segment-time";
        time.type = "text";
        time.value = String(segment?.time || "");

        const actions = document.createElement("div");
        actions.className = "visual-schedule-segment-actions";
        row.append(imageButton, title, time, actions);
        list.appendChild(row);
      }
    }
  }

  if (state.type === "patternmaker" && special && Array.isArray(special.rows)) {
    const board = module.querySelector(".pattern-maker-board");
    if (board) {
      const palette = { red: "#ef4b45", orange: "#f58a3c", yellow: "#f2cf45", green: "#32a875", blue: "#3978cf", purple: "#8b5bc7", pink: "#e96f9e", teal: "#2aa8ad" };
      const length = [8, 12, 16, 20].includes(Number(special.length)) ? Number(special.length) : 12;
      board.replaceChildren();
      special.rows.slice(0, 4).forEach((savedRow, rowIndex) => {
        const line = document.createElement("div");
        line.className = "pattern-maker-row";
        const label = document.createElement("span");
        label.className = "pattern-maker-row-label";
        label.textContent = String(rowIndex + 1);
        const cells = document.createElement("div");
        cells.className = "pattern-maker-cells";
        cells.style.gridTemplateColumns = `repeat(${length},minmax(18px,1fr))`;
        for (let index = 0; index < length; index++) {
          const colorId = String(savedRow?.[index] || "");
          const cell = document.createElement("span");
          cell.className = "pattern-maker-cell";
          cell.dataset.color = palette[colorId] ? colorId : "";
          cell.style.setProperty("--pattern-cell-color", palette[colorId] || "transparent");
          cells.appendChild(cell);
        }
        line.append(label, cells);
        board.appendChild(line);
      });
    }
  }

  if (state.type === "shapemanipulatives" && special && Array.isArray(special.pieces)) {
    const workspace = module.querySelector(".shape-manipulatives-workspace");
    if (workspace) {
      const definitions = {
        triangle: { color: "#15966f", width: 64, height: 55.4256 }, square: { color: "#ef6547", width: 64, height: 64 },
        hexagon: { color: "#f0ca35", width: 128, height: 110.8512 }, trapezoid: { color: "#ed463d", width: 128, height: 55.4256 },
        "rhombus-blue": { color: "#315fae", width: 96, height: 55.4256 }, "rhombus-tan": { color: "#d4ae6c", width: 123.638, height: 33.128 }
      };
      workspace.querySelectorAll(".shape-manipulative-piece").forEach(piece => piece.remove());
      const empty = workspace.querySelector(".shape-manipulatives-empty");
      if (empty) empty.hidden = special.pieces.length > 0;
      special.pieces.slice(0, 80).forEach(saved => {
        const definition = definitions[saved?.type];
        if (!definition) return;
        const piece = document.createElement("span");
        piece.className = `shape-manipulative-piece shape-manipulative-piece--${saved.type}`;
        piece.style.left = `${Number(saved.x) || 0}px`;
        piece.style.top = `${Number(saved.y) || 0}px`;
        piece.style.width = `${definition.width}px`;
        piece.style.height = `${definition.height}px`;
        piece.style.transform = `rotate(${Number(saved.rotation) || 0}deg)`;
        piece.style.setProperty("--pattern-block-color", definition.color);
        const art = document.createElement("span");
        art.className = "pattern-block-art";
        piece.appendChild(art);
        workspace.appendChild(piece);
      });
    }
  }

  if (state.type === "lessonplannertile") {
    const body = module.querySelector(".lesson-plan-tile__body");
    const title = module.querySelector(".lesson-plan-tile__title");
    const range = module.querySelector(".lesson-plan-tile__range");
    const mode = special?.mode === "week" ? "week" : "day";
    const colors = { sun: "#f3bd3d", sky: "#5ca7e8", mint: "#61bf9a", coral: "#ee7b68", grape: "#a883dc", rose: "#dc79a6", ocean: "#397db9", slate: "#718096" };
    const atNoon = value => { const date = new Date(value); date.setHours(12, 0, 0, 0); return date; };
    const addDays = (date, amount) => { const next = atNoon(date); next.setDate(next.getDate() + amount); return next; };
    const key = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const time = value => { const [hour, minute] = String(value || "00:00").split(":").map(Number); return `${hour % 12 || 12}:${String(minute || 0).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`; };
    const plans = window.TeacherTilesLessonPlanner?.getBlocks?.() || [];
    const today = atNoon(new Date());
    const makePlan = plan => {
      const card = document.createElement("article");
      card.className = "lesson-plan-tile__block";
      card.style.setProperty("--lesson-color", colors[plan.color] || colors.sun);
      const clock = document.createElement("span"); clock.className = "lesson-plan-tile__time"; clock.textContent = `${time(plan.start)}–${time(plan.end)}`;
      const heading = document.createElement("strong"); heading.textContent = String(plan.label || "Untitled lesson");
      card.append(clock, heading);
      if (plan.description) { const copy = document.createElement("p"); copy.textContent = String(plan.description); card.append(copy); }
      return card;
    };
    module.querySelectorAll("[data-lesson-plan-tile-view]").forEach(button => button.classList.toggle("is-active", button.dataset.lessonPlanTileView === mode));
    if (body) {
      body.replaceChildren();
      if (mode === "day") {
        if (title) title.textContent = "Today’s Plans";
        if (range) range.textContent = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(today);
        plans.filter(plan => plan.date === key(today)).forEach(plan => body.append(makePlan(plan)));
      } else {
        const first = addDays(today, today.getDay() === 0 ? -6 : 1 - today.getDay());
        if (title) title.textContent = "This Week’s Plans";
        if (range) range.textContent = `${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(first)}–${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(addDays(first, 6))}`;
        for (let index = 0; index < 7; index++) {
          const date = addDays(first, index);
          const dayPlans = plans.filter(plan => plan.date === key(date));
          if (!dayPlans.length) continue;
          const group = document.createElement("section"); group.className = "lesson-plan-tile__day-group";
          const heading = document.createElement("header"); heading.innerHTML = `<strong>${new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(date)}</strong><span>${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date)}</span>`;
          group.append(heading); dayPlans.forEach(plan => group.append(makePlan(plan))); body.append(group);
        }
      }
    }
  }

  module.querySelectorAll("button,input,textarea,select,a").forEach(control => {
    control.tabIndex = -1;
    control.setAttribute("aria-hidden", "true");
  });
}

const previewResize=new ResizeObserver(entries=>{for(const {target} of entries){if(!target.isConnected){previewResize.unobserve(target);continue;}const module=target.querySelector(':scope > .module');if(!module)continue;const w=parseFloat(module.style.width),h=parseFloat(module.style.height),scale=Math.min(target.clientWidth/w,target.clientHeight/h);if(Number.isFinite(scale)&&scale>0){module.style.transform='scale('+scale+')';module.style.visibility='visible';}}});
function createMiniObject(item) {
  const state = item?.state || null;
  const type = state?.type || item?.type || "";
  const el = document.createElement("span");
  el.className = `board-mini-object${type === "sticker" ? " is-sticker" : ""}`;

  const x = Math.max(0, Math.min(1, Number(item.x) || 0));
  const y = Math.max(0, Math.min(1, Number(item.y) || 0));
  const w = Math.max(.001, Math.min(1, Number(item.w) || .08));
  const h = Math.max(.001, Math.min(1, Number(item.h) || .08));

  el.style.left = `${x * 100}%`;
  el.style.top = `${y * 100}%`;
  el.style.width = `${w * 100}%`;
  el.style.height = `${h * 100}%`;
  const savedZIndex = Number(state?.zIndex ?? item?.zIndex);
  if (Number.isFinite(savedZIndex)) el.style.zIndex = String(Math.round(savedZIndex));

  if (type === "sticker") {
    const emoji = state?.sticker?.emoji || item.emoji || "";
    const src = state?.sticker?.src || item.src || "";
    if (emoji) {
      const glyph = document.createElement("span");
      glyph.className = `board-mini-sticker-emoji${/^[A-Za-z0-9]+$/.test(emoji) ? " is-text" : ""}`;
      glyph.textContent = emoji;
      el.appendChild(glyph);
    } else if (src && !String(src).startsWith("data:")) {
      const image = document.createElement("img");
      image.src = src;
      image.alt = "";
      el.appendChild(image);
    }
    if (state?.transform?.rotation) el.style.transform = `rotate(${Number(state.transform.rotation) || 0}deg)`;
    return el;
  }

  if (state) {
    const template = (previewTemplates||document).getElementById(`${type}-template`);
    const sourceModule = template?.content?.querySelector?.(".module");
    if (sourceModule) {
      const module = sourceModule.cloneNode(true);
      applyPreviewState(module, state);
      el.classList.add("is-real-tile");

      const originalWidth = Math.max(24, Number(state.transform?.width) || 320);
      const originalHeight = Math.max(24, Number(state.transform?.height) || 220);
      module.style.width = `${originalWidth}px`;
      module.style.height = `${originalHeight}px`;
      module.style.minWidth = "0";
      module.style.minHeight = "0";
      module.style.maxWidth = "none";
      module.style.maxHeight = "none";
      module.style.left = "0";
      module.style.top = "0";
      module.style.transform = "scale(0)";module.style.visibility="hidden";
      module.style.transformOrigin = "0 0";
      el.appendChild(module);previewResize.observe(el);

      requestAnimationFrame(() => {
        if (!el.isConnected || !module.isConnected) return;
        const scale = Math.min(el.clientWidth / originalWidth, el.clientHeight / originalHeight);
        if (!Number.isFinite(scale) || scale <= 0) return;
        module.style.transform = `scale(${scale})`;module.style.visibility="visible";
      });
      return el;
    }
  }

  el.dataset.previewType = type;
  return el;
}

const previewLayout=new ResizeObserver(entries=>{for(const {target} of entries){if(!target.isConnected){previewLayout.unobserve(target);continue;}const layer=target.querySelector('.board-card__objects'),w=target.clientWidth,h=target.clientHeight,width=Math.min(w,h*1.6),height=width/1.6;if(layer&&w&&h){Object.assign(layer.style,{width:width+'px',height:height+'px',left:(w-width)/2+'px',top:(h-height)/2+'px',right:'auto',bottom:'auto'});}}});
function createBoardPreview(board) {
  const preview = document.createElement("div");
  preview.className = `board-card__preview ${previewThemeClass(board.theme)}`;

  const objects = document.createElement("div");
  objects.className = "board-card__objects";
  const previewSource = Array.isArray(board.inlineObjects) && board.inlineObjects.length
    ? board.inlineObjects.slice(0, 48)
    : (Array.isArray(board.previewObjects) ? board.previewObjects : []);
  const previewItems = previewSource.length
    ? layoutBoardPreviewObjects(previewSource)
    : (Array.isArray(board.preview) ? board.preview : []);
  for (const item of previewItems) objects.appendChild(createMiniObject(item));
  preview.appendChild(objects);previewLayout.observe(preview);

  return preview;
}


export {previewThemeClass,layoutBoardPreviewObjects,createMiniObject,createBoardPreview};
