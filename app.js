const workspace=document.getElementById('workspace');
const snapDisabledIndicator=document.getElementById('snap-disabled-indicator');
const menu=document.getElementById('context-menu');
const settingsToggle=document.getElementById('settings-toggle');
const fullscreenToggle=document.getElementById('fullscreen-toggle');
const trashZone=document.getElementById('trash-zone');
const STICKER_Z_BASE=100000;
let tileZ=10,stickerZ=10,spawn={x:innerWidth/2,y:innerHeight/2},uid=0;
const selectedModules=new Set();


let boardChangeSuspended=0;
let boardChangeTimer=0;


const undoStack=[];
const redoStack=[];
const HISTORY_LIMIT=80;
let applyingHistory=false;


const FONT_OPTIONS=['inter','poppins','nunito','quicksand','oswald','lora','merriweather','playfair','caveat','phantom','lexend','pacifico','calibri'];

const UI_SFX_KEY='teachertiles-ui-sfx-muted';
const APP_PREFERENCES_KEY='teachertiles-app-preferences-v1';
const DEFAULT_APP_PREFERENCES=Object.freeze({
  uiMuted:false,
  masterVolume:100,
  uiVolume:100,
  scrollSpeed:100,
  defaultViewSize:100,
  language:'en',
  disableTileSnapping:false,
  alwaysShowTileDeleteButtons:false
});

const CLASS_ROSTERS_KEY='teachertiles-class-rosters-v1';
const classRostersStorageKey=()=>`${CLASS_ROSTERS_KEY}:${window.TeacherTilesClassScope||'local'}`;
const STAR_CHART_LAST_CLASS_KEY='teachertiles-star-chart-last-class-v1';
const starChartLastClassStorageKey=()=>`${STAR_CHART_LAST_CLASS_KEY}:${window.TeacherTilesClassScope||'local'}`;
const CLASS_METER_LAST_CLASS_KEY='teachertiles-class-meter-last-class-v1';
const classMeterLastClassStorageKey=()=>`${CLASS_METER_LAST_CLASS_KEY}:${window.TeacherTilesClassScope||'local'}`;
const COLLECTIONS_LAST_CLASS_KEY='teachertiles-collections-last-class-v1';
const collectionsLastClassStorageKey=()=>`${COLLECTIONS_LAST_CLASS_KEY}:${window.TeacherTilesClassScope||'local'}`;
const COLLECTION_ITEM_TYPES=new Set(['pompom','candy','star','jellybean','fruit','coin']);
const CLASS_LOGO_OPTIONS=Object.freeze([
  Object.freeze({symbol:'👥',label:'Class team'}),Object.freeze({symbol:'🌟',label:'Shining star'}),
  Object.freeze({symbol:'🚀',label:'Rocket'}),Object.freeze({symbol:'🦉',label:'Owl'}),
  Object.freeze({symbol:'🐯',label:'Tiger'}),Object.freeze({symbol:'🌈',label:'Rainbow'}),
  Object.freeze({symbol:'⚡',label:'Lightning'}),Object.freeze({symbol:'🏆',label:'Trophy'}),
  Object.freeze({symbol:'🧠',label:'Brain'}),Object.freeze({symbol:'🎨',label:'Art palette'}),
  Object.freeze({symbol:'🌱',label:'Growing plant'}),Object.freeze({symbol:'🐝',label:'Bee'})
]);


const PBIS_CLOUD_SAVE_INTERVAL=10*60*1000;
let pbisCloudSaveTimer=0;
let pbisCloudSaveScope='';
let encryptedClassSaveQueue=Promise.resolve();
const lastEncryptedClassSaveSignatureByScope=new Map();
const pendingEncryptedClassSaveSignatureByScope=new Map();

const pbisDirtyStorageKey=(scope=window.TeacherTilesClassScope||'local')=>`teachertiles-pbis-dirty:${scope}`;


window.addEventListener('pagehide',flushPbisCloudSave);

window.addEventListener('teachertiles:encryptedclassesloaded',event=>{
  const classes=Array.isArray(event.detail?.classes)?event.detail.classes:[];
  const scope=window.TeacherTilesClassScope||'local';
  const cloudSignature=JSON.stringify(classes);
  lastEncryptedClassSaveSignatureByScope.set(scope,cloudSignature);
  const localDirtySignature=localStorage.getItem(pbisDirtyStorageKey(scope));
  const localSnapshot=localStorage.getItem(classRostersStorageKey());
  if(localDirtySignature===cloudSignature)clearPbisLocalDirty(localDirtySignature,scope);
  else if(localDirtySignature&&localSnapshot!==null){
    const localClasses=readClassRosters();
    window.dispatchEvent(new CustomEvent('teachertiles:classeschange',{detail:{classes:localClasses,source:'local-dirty'}}));
    queueEncryptedClassSave(localClasses,'pending PBIS stats');
    return;
  }
  localStorage.setItem(classRostersStorageKey(),JSON.stringify(classes));
  window.dispatchEvent(new CustomEvent('teachertiles:classeschange',{detail:{classes,source:'encrypted-cloud'}}));
});


const NAME_UI_MODULE_SELECTOR='.groupmaker-module,.lunchcount-module,.voting-module,.spinner-module';
document.addEventListener('pointerover',event=>{
  if(!(event.target instanceof Element))return;
  event.target.closest(NAME_UI_MODULE_SELECTOR)?.classList.remove('name-ui-force-hidden');
});
document.addEventListener('pointerout',event=>{
  if(!(event.target instanceof Element))return;
  const module=event.target.closest(NAME_UI_MODULE_SELECTOR);
  if(module&&!(event.relatedTarget instanceof Node&&module.contains(event.relatedTarget))){
    module.classList.add('name-ui-force-hidden');
  }
});


if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setupProfileClasses,{once:true});else setupProfileClasses();

const STUDENT_VIEW_STATS_KEY='teachertiles-student-view-stats-v1';
const studentViewStatsStorageKey=()=>`${STUDENT_VIEW_STATS_KEY}:${window.TeacherTilesClassScope||'local'}`;
const PBIS_STUDENT_STAT_DEFINITIONS=Object.freeze([
  ...[['eggPoints','Egg Hatching','🥚','eggHatching'],['flowerPoints','Flower Pots','🌷','flowerPots']].map(([id,label,icon,key])=>Object.freeze({id,label,icon,studentOnly:true,description:label+' PBIS points',value:(roster,name)=>normalizePunchcardProgress(roster[key],roster.students).studentPoints[starChartStudentKey(name)]||0})),
  Object.freeze({
    id:'stars',
    label:'Stars',
    description:'Stars earned in Star Chart',
    wholeClassDescription:'Whole-class stars earned in Star Chart',
    icon:'★',
    value:(roster,name)=>normalizeStarChartCount(roster.starChart?.studentStars?.[starChartStudentKey(name)]),
    wholeClassValue:roster=>normalizeStarChartCount(roster.starChart?.wholeClassStars)
  }),
  Object.freeze({
    id:'punchcardPoints',
    label:'Punchcard Points',
    description:'Punchcards completed by this student',
    wholeClassDescription:'Whole-class Punchcards completed by this class',
    icon:'●',
    value:(roster,name)=>normalizePunchcardProgress(roster.punchcards,roster.students).studentPoints[starChartStudentKey(name)]||0,
    wholeClassValue:roster=>normalizePunchcardProgress(roster.punchcards,roster.students).wholeClassPoints
  }),
  Object.freeze({
    id:'raceWins',
    label:'Race Wins',
    description:'Racer finish-line wins earned by this student',
    icon:'🏁',
    studentOnly:true,
    value:(roster,name)=>normalizeRacerProgress(roster.racer,roster.students).studentWins[starChartStudentKey(name)]||0,
    wholeClassValue:()=>0
  }),
  Object.freeze({
    id:'meterWins',
    label:'Class Meter Wins',
    description:'Whole-class Class Meter fills',
    wholeClassDescription:'Times this class filled its Class Meter',
    icon:'🌡️',
    wholeClassOnly:true,
    value:()=>0,
    wholeClassValue:roster=>normalizeClassMeterProgress(roster.classMeter).wins
  }),
  Object.freeze({
    id:'jarsFilled',
    label:'Jars Filled',
    description:'Whole-class Collection Jars filled',
    wholeClassDescription:'Collection Jars filled by this class',
    icon:'🫙',
    wholeClassOnly:true,
    value:()=>0,
    wholeClassValue:roster=>normalizeCollectionProgress(roster.collectionJar).jarsFilled
  })
]);


if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setupStudentView,{once:true});else setupStudentView();

const TRANSLATION_LANGUAGES=[
  {code:'en',name:'English',nativeName:'English',speech:'en-US'},
  {code:'es',name:'Spanish',nativeName:'Español',speech:'es-ES'},
  {code:'fr',name:'French',nativeName:'Français',speech:'fr-FR'},
  {code:'de',name:'German',nativeName:'Deutsch',speech:'de-DE'},
  {code:'it',name:'Italian',nativeName:'Italiano',speech:'it-IT'},
  {code:'pt',name:'Portuguese',nativeName:'Português',speech:'pt-BR'},
  {code:'zh-CN',name:'Chinese (Simplified)',nativeName:'中文（简体）',speech:'zh-CN'},
  {code:'ja',name:'Japanese',nativeName:'日本語',speech:'ja-JP'},
  {code:'ko',name:'Korean',nativeName:'한국어',speech:'ko-KR'},
  {code:'ar',name:'Arabic',nativeName:'العربية',speech:'ar-SA'},
  {code:'hi',name:'Hindi',nativeName:'हिन्दी',speech:'hi-IN'},
  {code:'ru',name:'Russian',nativeName:'Русский',speech:'ru-RU'},
  {code:'uk',name:'Ukrainian',nativeName:'Українська',speech:'uk-UA'},
  {code:'pl',name:'Polish',nativeName:'Polski',speech:'pl-PL'},
  {code:'nl',name:'Dutch',nativeName:'Nederlands',speech:'nl-NL'},
  {code:'tr',name:'Turkish',nativeName:'Türkçe',speech:'tr-TR'},
  {code:'vi',name:'Vietnamese',nativeName:'Tiếng Việt',speech:'vi-VN'},
  {code:'tl',name:'Filipino',nativeName:'Filipino',speech:'fil-PH'},
  {code:'ht',name:'Haitian Creole',nativeName:'Kreyòl ayisyen',speech:'ht-HT'},
  {code:'el',name:'Greek',nativeName:'Ελληνικά',speech:'el-GR'},
  {code:'he',name:'Hebrew',nativeName:'עברית',speech:'he-IL'},
  {code:'sv',name:'Swedish',nativeName:'Svenska',speech:'sv-SE'}
];
const APP_LANGUAGE_CODES=new Set(TRANSLATION_LANGUAGES.map(language=>language.code));


let appPreferences=readStoredAppPreferences();

applyTileDeleteVisibilityPreference();
let uiSfxMuted=appPreferences.uiMuted;
const uiSfxPrototype=new Audio('assets/ui/pop.mp3');
uiSfxPrototype.preload='auto';
const confettiSfxPrototype=new Audio('assets/ui/confetti-pop.mp3');
confettiSfxPrototype.preload='auto';
const timerTadaSfxPrototype=new Audio('assets/ui/timer-tada.mp3');
timerTadaSfxPrototype.preload='auto';
const moneySfxPrototype=new Audio('assets/ui/coin-drop.mp3');
moneySfxPrototype.preload='auto';
const holePunchSfxPrototype=new Audio('assets/ui/hole-punch.mp3');
holePunchSfxPrototype.preload='auto';
const stickerPlaceSfxPrototype=new Audio('assets/ui/sticker-place.wav?v=20260904-2');
stickerPlaceSfxPrototype.preload='auto';


const DEFAULT_TILE_AUDIO_STATE=Object.freeze({enabled:true,volume:100});


window.TeacherTilesMasterAudioLevel=masterAudioLevel;
let boostAudioContext=null;const boostedMedia=new WeakMap();


window.TeacherTilesTileAudio=Object.freeze({
  mediaVolume:setBoostedMediaVolume,release:releaseBoostedMedia,
  level:tileAudioLevel,
  state:owner=>({...tileAudioState(owner)}),
  set:(owner,value,options)=>setTileAudioState(owner,value,options)
});


const classMeterFillSfxPrototype=new Audio('assets/ui/class-meter-fill.wav');
classMeterFillSfxPrototype.preload='auto';


document.addEventListener('click',e=>{
  if(!e.isTrusted)return;
  const target=e.target;
  if(!(target instanceof Element))return;
  if(target.closest('#settings-ui-sfx-toggle,.punchcard-hole,.piano-key,.module-delete,.squishy-canvas'))return;
  const interactive=target.closest('button,[role="button"],input[type="checkbox"],input[type="radio"],select');
  if(interactive&&!interactive.disabled)playUiSfx('click',1,interactive.closest('.module'));
},true);


document.addEventListener('click',e=>{
  const t=e.target;
  if(!(t instanceof Element))return;
  if(t.closest('.collection-add,.collection-jar,.collection-canvas'))playUiSfx('collection',1,t.closest('.module'));
},true);

document.addEventListener('change',e=>{
  // Restoring saved slider values dispatches synthetic change events too.
  if(!e.isTrusted)return;
  const target=e.target;
  if(target instanceof HTMLInputElement&&target.type==='range')playUiSfx('click',1,target.closest('.module'));
},true);

// Pointer-clicked module controls should disappear again when the pointer leaves.
// Keyboard focus is preserved so the same controls remain accessible to tab users.
let lastUiInteractionWasKeyboard=false;
document.addEventListener('keydown',event=>{
  const typing=isTypingTarget(event.target)||isTypingTarget(document.activeElement);
  if(event.key==='Tab'||(event.key==='Enter'&&!typing)){
    lastUiInteractionWasKeyboard=true;
    document.body.classList.add('is-keyboard-navigation');
  }
},true);
document.addEventListener('pointerdown',event=>{
  lastUiInteractionWasKeyboard=false;
  document.body.classList.remove('is-keyboard-navigation');
},true);
document.addEventListener('pointerup',event=>{
  if(lastUiInteractionWasKeyboard||!(event.target instanceof Element))return;
  const control=event.target.closest('.customization-bar button,.lunchcount-inline-actions button');
  if(control instanceof HTMLElement)requestAnimationFrame(()=>control.blur());
},true);
document.addEventListener('change',event=>{
  if(lastUiInteractionWasKeyboard||!(event.target instanceof Element))return;
  const control=event.target.closest('.customization-bar input,.customization-bar select');
  if(control instanceof HTMLElement)requestAnimationFrame(()=>control.blur());
},true);

// Menu launchers use aria-expanded for their real open state. After a pointer
// closes a surface, release restored focus so the corner trays do not look active.
new MutationObserver(records=>{
  if(lastUiInteractionWasKeyboard)return;
  for(const record of records){
    const control=record.target;
    if(control instanceof HTMLElement&&control.matches('.workspace-control[aria-expanded="false"]')){
      requestAnimationFrame(()=>{
        if(!lastUiInteractionWasKeyboard&&control.matches(':focus'))control.blur();
      });
    }
  }
}).observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['aria-expanded']});

const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const formatCountdown=s=>{s=Math.max(0,Math.ceil(s));const m=Math.floor(s/60),ss=s%60;return `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`};

const APP_TRANSLATIONS={
  en:{
    'top.settings':'Settings','top.help':'Help','top.news':'News','top.fullscreen':'Fullscreen','top.profile':'Profile','top.themes':'Themes','top.stickers':'Stickers','top.shop':'Shop','top.boards':'Boards',
    'warning.signin':'Sign-in to save your board & more!','hint.addTile':'Right-click anywhere to add a tile',
    'boards.title':'Boards','boards.back':'Back to Board','boards.loading':'Loading boards…',
    'context.addTile':'Add tile','context.all':'TILES','context.search':'Search tiles...','context.none':'No tiles found','context.try':'Try another search.',
    'context.cat.text':'TEXT','context.cat.media':'MEDIA','context.cat.tools':'TOOLS','context.cat.language':'LANGUAGE','context.cat.geography':'GEOGRAPHY','context.cat.accessibility':'ACCESSIBILITY','context.cat.time':'TIME','context.cat.audio':'AUDIO','context.cat.games':'GAMES','context.cat.literacy':'LITERACY','context.cat.math':'MATH','context.cat.science':'SCIENCE','context.cat.planning':'PLANNING','context.cat.pbis':'PBIS','context.cat.sel':'SEL','context.cat.classconnect':'CLASS CONNECT','context.cat.favorites':'FAVORITES','context.cat.basics':'BASICS',
    'settings.eyebrow':'TEACHERTILES','settings.title':'Settings & Help','settings.tab.settings':'Settings','settings.tab.help':'Help','settings.tab.news':'News','settings.tab.announcements':'Updates','settings.tab.contact':'Contact Us','settings.tab.terms':'Terms & Conditions',
    'settings.preferences.kicker':'Preferences','settings.preferences.title':'Make TeacherTiles yours.','settings.preferences.copy':'These preferences are stored with the current board and sync in the same autosave.',
    'settings.sound.title':'Sound','settings.sound.copy':'Control TeacherTiles audio.','settings.mute.title':'Mute UI Sounds','settings.mute.copy':'Silence button clicks and interface effects.',
    'settings.masterVolume.title':'Master Volume','settings.masterVolume.copy':'Controls the overall volume of all TeacherTiles audio.','settings.volume.title':'UI Volume','settings.volume.copy':'Adjust the volume of interface sound effects.',
    'settings.board.title':'Board','settings.board.copy':'Tune how the canvas feels while you work.','settings.scroll.title':'Scroll Speed','settings.scroll.copy':'Changes mouse-wheel zoom and shelf scrolling sensitivity.',
    'settings.view.title':'Default View Size','settings.view.copy':'Sets your working zoom and the starting size for new boards.',
    'settings.deleteButtons.title':'Always Show Tile Options','settings.deleteButtons.copy':'Show tabbing, fullscreen, pin, and delete controls whenever you hover over a tile, instead of only near its corners.',
    'settings.language.title':'Language','settings.language.copy':'Choose the language used by TeacherTiles menus and controls.','settings.language.interface':'Interface Language','settings.language.note':'Your tile content is never translated or changed.',
    'settings.save.note':'Preference changes join the current board’s normal autosave—no extra Firestore save system.',
    'help.kicker':'HELP CENTER','help.title':'TeacherTiles Controls at a Glance','help.copy':'Keyboard shortcuts and mouse controls for moving quickly around your board.',
    'help.search':'Help search — coming soon','help.comingSoon':'COMING SOON','help.keyboard.title':'Keyboard Shortcuts','help.keyboard.copy':'Shortcuts are ignored while you are actively typing when appropriate.',
    'help.key.selectAll':'Select all tiles and stickers; press again to clear.','help.key.copy':'Copy the current board selection.','help.key.paste':'Paste copied tiles or stickers.','help.key.duplicate':'Duplicate the current selection.',
    'help.key.undo':'Undo the latest board action.','help.key.redo':'Redo an undone action. Ctrl/⌘ + Shift + Z also works.','help.key.delete':'Delete only the selected tile or sticker—even when it belongs to a snapped group.','help.key.arrows':'Navigate around the board.','help.key.noSnap':'Temporarily disable tile snapping while you drag.','help.key.frames':'Hold F to open Board Frames, capture views, and jump between saved areas.','help.key.escape':'Exit text editing or close the active overlay/menu.',
    'help.mouse.title':'Mouse & Trackpad','help.mouse.copy':'The board is designed to stay fast without switching tools.',
    'help.mouse.pan.title':'Pan the Board','help.mouse.pan.copy':'Left-drag empty board space or middle-mouse drag anywhere on the board.',
    'help.mouse.select.title':'Group Select','help.mouse.select.copy':'Hold Shift and left-drag empty space to draw a selection box.',
    'help.mouse.menu.title':'Add Tiles','help.mouse.menu.copy':'Right-click empty board space to open the Add Tile menu.',
    'help.mouse.zoom.title':'Zoom','help.mouse.zoom.copy':'Scroll over the board for fast zoom. Hold Shift while scrolling for precise 1% steps.',
    'help.mouse.move.title':'Move Tiles','help.mouse.move.copy':'Drag anywhere on a tile that is not an active button, slider, canvas, or other control.',
    'help.mouse.snap.title':'Snap & Group','help.mouse.snap.copy':'Place one tile against another to snap them into a group. Grouped tiles move together and share one layer.',
    'help.mouse.tug.title':'Hold, Then Tug','help.mouse.tug.copy':'Press and hold a grouped tile until it shakes, then pull through the resistance to detach and move it independently.',
    'help.mouse.text.title':'Edit Text','help.mouse.text.copy':'Double-click a text field to type. Click away from it to leave text-edit mode.',
    'help.mouse.sticker.title':'Transform Stickers','help.mouse.sticker.copy':'Use corner handles to resize and the round handle to rotate. Hold Shift while rotating to snap by 15°.',
    'help.mouse.trash.title':'Delete by Dragging','help.mouse.trash.copy':'Drag any snapped tile into the trash at the top of the board to delete its entire group.',
    'help.mouse.clear.title':'Clear Selection','help.mouse.clear.copy':'Click outside the current selection to deselect it.',
    'help.tutorial.kicker':'GUIDES','help.tutorial.title':'Watch a Board Walkthrough','help.tutorial.copy':'Choose a Mouse & Trackpad card above to watch a short demonstration with step-by-step instructions.',
    'profile.eyebrow':'TEACHERTILES ACCOUNT','profile.title':'Profile','profile.checking':'Checking your account…','profile.welcome':'WELCOME','profile.signinTitle':'Sign in to TeacherTiles','profile.signinCopy':'Log in to an account to save your TileSets, purchase optional cosmetics, access the full app, and explore all that TeacherTiles has to offer.','profile.google':'Continue with Google','profile.signedIn':'SIGNED IN','profile.coins':'COINS','profile.balance':'Account balance','profile.connectedTitle':'Your profile is connected.','profile.connectedCopy':'This account will be used for your saved TeacherTiles boards and account data.','profile.signout':'Sign out',
    'shop.title':'Shop','shop.coins':'Coins','shop.kicker':'MAKE IT YOURS','shop.customize':'Customize your board','shop.browse':'Browse visual packs made for TeacherTiles.','shop.collection':'COLLECTION','shop.themeCopy':'Color & board styles','shop.stickerPacks':'Sticker Packs','shop.stickerCopy':'Decorate your workspace','shop.coming':'COMING SOON','shop.tilePacks':'Tile Skins','shop.tileCopy':'Cosmetic Tile Skins','shop.comingTitle':'Coming Soon','shop.extras':'Extras','shop.extrasCopy':'More ways to customize',
    'boards.new':'New Board','boards.delete':'Delete board','boards.create':'Create new blank board'
  },
  es:{
    'top.settings':'Ajustes','top.help':'Ayuda','top.news':'Noticias','top.fullscreen':'Pantalla completa','top.profile':'Perfil','top.themes':'Temas','top.stickers':'Pegatinas','top.shop':'Tienda','top.boards':'Tableros',
    'warning.signin':'¡Inicia sesión para guardar tu tablero y mucho más!','hint.addTile':'Haz clic derecho en cualquier lugar para añadir un tile',
    'boards.title':'Tableros','boards.back':'Volver al tablero','boards.loading':'Cargando tableros…',
    'context.addTile':'Añadir tile','context.all':'TILES','context.search':'Buscar tiles...','context.none':'No se encontraron tiles','context.try':'Prueba otra búsqueda.',
    'context.cat.text':'TEXTO','context.cat.media':'MULTIMEDIA','context.cat.tools':'HERRAMIENTAS','context.cat.language':'IDIOMAS','context.cat.geography':'GEOGRAFÍA','context.cat.accessibility':'ACCESIBILIDAD','context.cat.time':'TIEMPO','context.cat.audio':'AUDIO','context.cat.games':'JUEGOS','context.cat.literacy':'LECTOESCRITURA','context.cat.math':'MATEMÁTICAS','context.cat.science':'CIENCIAS','context.cat.planning':'PLANIFICACIÓN','context.cat.pbis':'PBIS','context.cat.sel':'SEL','context.cat.classconnect':'CLASS CONNECT','context.cat.favorites':'FAVORITES','context.cat.basics':'BASICS',
    'settings.eyebrow':'TEACHERTILES','settings.title':'Ajustes y ayuda','settings.tab.settings':'Ajustes','settings.tab.help':'Ayuda','settings.tab.news':'Noticias','settings.tab.announcements':'Actualizaciones','settings.tab.contact':'Contáctanos','settings.tab.terms':'Términos y condiciones',
    'settings.preferences.kicker':'Preferencias','settings.preferences.title':'Haz TeacherTiles a tu manera.','settings.preferences.copy':'Estas preferencias se guardan con el tablero actual y se sincronizan en el mismo autoguardado.',
    'settings.sound.title':'Sonido','settings.sound.copy':'Controla el audio de TeacherTiles.','settings.mute.title':'Silenciar sonidos de la interfaz','settings.mute.copy':'Silencia los clics de botones y los efectos de la interfaz.',
    'settings.masterVolume.title':'Volumen maestro','settings.masterVolume.copy':'Controla el volumen general de todo el audio de TeacherTiles.','settings.volume.title':'Volumen de la interfaz','settings.volume.copy':'Ajusta el volumen de los efectos de sonido de la interfaz.',
    'settings.board.title':'Tablero','settings.board.copy':'Ajusta cómo se siente el lienzo mientras trabajas.','settings.scroll.title':'Velocidad de desplazamiento','settings.scroll.copy':'Cambia la sensibilidad del zoom con la rueda y del desplazamiento de las estanterías.',
    'settings.view.title':'Tamaño de vista predeterminado','settings.view.copy':'Define el zoom de trabajo y el tamaño inicial de los tableros nuevos.',
    'settings.deleteButtons.title':'Mostrar siempre las opciones del tile','settings.deleteButtons.copy':'Mantiene visibles los controles de pantalla completa, fijar y eliminar en cada tile en vez de mostrarlos solo cerca de la esquina superior derecha.',
    'settings.language.title':'Idioma','settings.language.copy':'Elige el idioma de los menús y controles de TeacherTiles.','settings.language.interface':'Idioma de la interfaz','settings.language.note':'El contenido de tus tiles nunca se traduce ni se modifica.',
    'settings.save.note':'Los cambios de preferencias se incluyen en el autoguardado normal del tablero; no usan un sistema adicional de Firestore.',
    'help.kicker':'CENTRO DE AYUDA','help.title':'Controles de TeacherTiles de un vistazo.','help.copy':'Atajos de teclado y controles del ratón para moverte rápidamente por tu tablero.',
    'help.search':'Búsqueda de ayuda — próximamente','help.comingSoon':'PRÓXIMAMENTE','help.keyboard.title':'Atajos de teclado','help.keyboard.copy':'Los atajos se ignoran cuando estás escribiendo, cuando corresponde.',
    'help.key.selectAll':'Selecciona todos los tiles y pegatinas; vuelve a pulsar para limpiar la selección.','help.key.copy':'Copia la selección actual del tablero.','help.key.paste':'Pega tiles o pegatinas copiados.','help.key.duplicate':'Duplica la selección actual.',
    'help.key.undo':'Deshace la última acción del tablero.','help.key.redo':'Rehace una acción deshecha. Ctrl/⌘ + Shift + Z también funciona.','help.key.delete':'Elimina solo el tile o la pegatina seleccionada, incluso si pertenece a un grupo acoplado.','help.key.arrows':'Navega por el tablero.','help.key.noSnap':'Desactiva temporalmente el acoplamiento mientras arrastras un tile.','help.key.frames':'Mantén F para abrir Marcos del tablero, guardar vistas y saltar entre áreas guardadas.','help.key.escape':'Sale de la edición de texto o cierra el menú/superposición activo.',
    'help.mouse.title':'Ratón y trackpad','help.mouse.copy':'El tablero está diseñado para trabajar rápido sin cambiar de herramienta.',
    'help.mouse.pan.title':'Mover el tablero','help.mouse.pan.copy':'Arrastra con clic izquierdo un espacio vacío o arrastra con el botón central en cualquier parte del tablero.',
    'help.mouse.select.title':'Selección de grupo','help.mouse.select.copy':'Mantén Shift y arrastra con clic izquierdo un espacio vacío para dibujar un área de selección.',
    'help.mouse.menu.title':'Añadir tiles','help.mouse.menu.copy':'Haz clic derecho en un espacio vacío para abrir el menú Añadir tile.',
    'help.mouse.zoom.title':'Zoom','help.mouse.zoom.copy':'Desplázate sobre el tablero para usar el zoom rápido. Mantén Shift mientras te desplazas para ajustar en pasos precisos del 1 %.',
    'help.mouse.move.title':'Mover tiles','help.mouse.move.copy':'Arrastra cualquier parte de un tile que no sea un botón, deslizador, lienzo u otro control activo.',
    'help.mouse.snap.title':'Acoplar y agrupar','help.mouse.snap.copy':'Coloca un tile junto a otro para acoplarlos en un grupo. Los tiles agrupados se mueven juntos y comparten una capa.',
    'help.mouse.tug.title':'Mantener y tirar','help.mouse.tug.copy':'Mantén pulsado un tile agrupado hasta que tiemble y luego tira venciendo la resistencia para separarlo y moverlo de forma independiente.',
    'help.mouse.text.title':'Editar texto','help.mouse.text.copy':'Haz doble clic en un campo de texto para escribir. Haz clic fuera para salir del modo de edición.',
    'help.mouse.sticker.title':'Transformar pegatinas','help.mouse.sticker.copy':'Usa las esquinas para cambiar el tamaño y el control circular para rotar. Mantén Shift para ajustar la rotación en pasos de 15°.',
    'help.mouse.trash.title':'Eliminar arrastrando','help.mouse.trash.copy':'Arrastra cualquier tile acoplado a la papelera de la esquina para eliminar todo su grupo.',
    'help.mouse.clear.title':'Limpiar selección','help.mouse.clear.copy':'Haz clic fuera de la selección actual para deseleccionarla.',
    'help.tutorial.kicker':'GUÍAS','help.tutorial.title':'Próximamente habrá más tutoriales.','help.tutorial.copy':'Esta página tendrá guías paso a paso, recorridos de funciones y ayuda con búsqueda.',
    'profile.eyebrow':'CUENTA DE TEACHERTILES','profile.title':'Perfil','profile.checking':'Comprobando tu cuenta…','profile.welcome':'BIENVENIDO','profile.signinTitle':'Inicia sesión en TeacherTiles','profile.signinCopy':'Inicia sesión en una cuenta para guardar tus TileSets, comprar cosméticos opcionales, acceder a toda la aplicación y descubrir todo lo que TeacherTiles ofrece.','profile.google':'Continuar con Google','profile.signedIn':'SESIÓN INICIADA','profile.coins':'MONEDAS','profile.balance':'Saldo de la cuenta','profile.connectedTitle':'Tu perfil está conectado.','profile.connectedCopy':'Esta cuenta se usará para tus tableros guardados de TeacherTiles y los datos de tu cuenta.','profile.signout':'Cerrar sesión',
    'shop.title':'Tienda','shop.coins':'Monedas','shop.kicker':'HAZLO TUYO','shop.customize':'Personaliza tu tablero','shop.browse':'Explora paquetes visuales creados para TeacherTiles.','shop.collection':'COLECCIÓN','shop.themeCopy':'Colores y estilos de tablero','shop.stickerPacks':'Paquetes de pegatinas','shop.stickerCopy':'Decora tu espacio de trabajo','shop.coming':'PRÓXIMAMENTE','shop.tilePacks':'Aspectos de tiles','shop.tileCopy':'Aspectos cosméticos para tiles','shop.comingTitle':'Próximamente','shop.extras':'Extras','shop.extrasCopy':'Más formas de personalizar',
    'boards.new':'Nuevo tablero','boards.delete':'Eliminar tablero','boards.create':'Crear un tablero nuevo en blanco'
  }
};

const CONTEXT_MODULE_TRANSLATIONS={
  en:{
    sticky:['Sticky Note','Write and format notes'],textbubble:['Text Bubble','Simple scalable text display'],todo:['To-Do','Build a customizable checklist'],visualschedule:['Visual Schedule','Build a picture-based daily schedule'],lessonplannertile:['Lesson Planner','Show today’s or this week’s lesson plans'],
    image:['Image','Display an image on the board'],youtube:['YouTube','Play a YouTube video'],windowshare:['Window Share','Share a tab, window, or screen'],timer:['Visual Timer','Shape-based progress timer'],
    dice:['Dice','Roll one to four dice'],seatingchart:['Seating Chart','Arrange your class and randomize seats'],fishtank:['Fish Tank','A quiet classroom brings more fish'],quietcritters:['Quiet Critters','Magical forest visitors appear when the room stays quiet'],chime:['Chime','Ring a meditation chime'],meditation:['Meditation','Follow a calming light as you breathe in and out'],transitionbell:['Transition Bell','Ring a classroom transition bell'],popsiclesticks:['Popsicle Sticks','Draw random student names from a cup'],
    interactive:['Interactive Timers','Hourglass, candle, rocket, and sunflower'],clock:['Clock','Current time display'],date:['Date','Today’s date in your chosen style'],calendar:['Calendar','Events, birthdays, holidays, and months'],
    stopwatch:['Stopwatch','Count up with lap times'],progressbar:['Progress Bar','Fill toward a set end time'],draw:['Draw','Draw freely across the board'],imagesearch:['Image Search','Find images and drag them onto the board'],dictionary:['Dictionary','Look up complete word entries'],translation:['Translation','Translate typed or spoken language'],attendance:['Attendance','Move student magnets for attendance check-ins'],writinglines:['Writing Lines','Handwriting practice template'],
    abc:['ABC','Animated alphabet flashcards'],numberflashcards:['Number Flashcards','Animated number cards from 1 to 100'],cvcword:['CVC Word','Random animated CVC flashcards'],highfrequency:['High Frequency Words','Grade-level animated word flashcards'],robothfw:['Robot HFW','Blast flying robots carrying sight words'],customflashcards:['Custom Flashcards','Create reusable text and image card sets'],wordweb:['Word Web','Connect related words around a central idea'],venndiagram:['Venn Diagrams','Compare ideas with editable, draggable sets'],essentialquestion:['Essential Question','Display a quoted essential question with an optional subheading'],shapes:['Shapes','Explore sides, vertices, and shape facts'],numberline:['Number Line','Interactive expandable number line'],
    hundredschart:['Hundreds Chart','Hide, reveal, and highlight 1–100'],tenframes:['Ten Frames','Build quantities with draggable counters'],ruler:['Ruler','Measure with draggable ruler points'],calculator:['Calculator','Basic classroom calculator'],
    grapher:['Graphing Tool','Plot points and graph equations'],tablemaker:['Table Maker','Turn your data into animated charts'],tallychart:['Tally Chart','Count and compare results in real time'],periodictable:['Periodic Table','Explore all 118 elements'],money:['Money','Drag money manipulatives and total them'],noise:['Noise Meter','Live microphone sound level'],
    collections:['Collections','Fill a class reward jar together'],prizeboard:['Prize Board','Create and redeem student or whole-class rewards'],pbisconsole:['PBIS Console','Manage every tracked PBIS stat in one place'],punchcards:['Punchcards','Punch reward cards for students or the whole class'],racer:['Racer','Move student racers toward the finish line'],stoplight:['Stoplight','Use a stoplight for various visual cues'],starchart:['Star Chart','Award stars to a class or individual students'],classmeter:['Class Meter','Hold to fill a whole-class reward meter'],classvsclass:['Class vs Class','Coming soon: class incentive competitions'],spinner:['Spinner','Spin a wheel to pick a name'],groupmaker:['Group Maker','Shuffle students into balanced groups'],
    lunchcount:['Lunch Count','Tally lunches or sort student names'],voting:['Polls','Tally votes or sort student names'],ambiencevideo:['Ambience Video','Campfire, fireplace, and aquarium scenes'],hangman:['Hangman','Guess the hidden word'],
    wordypuzzle:['Wordy Puzzle','Guess the teacher’s secret word'],minesweeper:['Minesweeper','Clear every safe square without hitting a mine'],boombox:['Soundscapes','Loop classroom soundscapes'],
    livecaption:['Live Captions','Display speech as clear, readable text'],voicememo:['Voice Memos','Record and replay short audio notes'],photobooth:['Photobooth','Take filtered photos with your camera'],backgroundremover:['Background Remover','Remove image backgrounds and save transparent cutouts'],mirror:['Mirror','Use the camera as a classroom mirror'],
    weather:['Weather','Compare current weather for several places'],weatherwheel:['Weather Wheel','Point to today’s weather'],seasonwheel:['Season Wheel','Explore spring, summer, fall, and winter'],temperature:['Temperature','Display the outdoor temperature your way'],worldmap:['World Map','Explore countries, continents, and hemispheres'],compass:['Compass','Explore directions and compass parts']
  },
  es:{
    sticky:['Nota adhesiva','Escribe y da formato a notas'],textbubble:['Burbuja de texto','Texto simple que se adapta de tamaño'],todo:['Lista de tareas','Crea una lista personalizable'],visualschedule:['Horario visual','Crea un horario diario con imágenes'],lessonplannertile:['Planificador de lecciones','Muestra los planes de hoy o de esta semana'],
    image:['Imagen','Muestra una imagen en el tablero'],youtube:['YouTube','Reproduce un video de YouTube'],windowshare:['Compartir ventana','Comparte una pestaña, ventana o pantalla'],timer:['Temporizador visual','Temporizador de progreso con formas'],
    dice:['Dados','Lanza de uno a cuatro dados'],seatingchart:['Plano de asientos','Organiza los asientos de tu clase'],fishtank:['Acuario','El silencio atrae más peces'],quietcritters:['Criaturas silenciosas','Visitantes mágicos aparecen cuando el salón está en silencio'],chime:['Campanilla','Haz sonar una campanilla de meditación'],meditation:['Meditación','Sigue una luz relajante al inhalar y exhalar'],transitionbell:['Campana de transición','Haz sonar una campana de transición del aula'],popsiclesticks:['Palitos de helado','Saca nombres de estudiantes al azar de un vaso'],
    interactive:['Temporizadores interactivos','Reloj de arena, vela, cohete y girasol'],clock:['Reloj','Muestra la hora actual'],date:['Fecha','La fecha de hoy en el estilo que elijas'],calendar:['Calendario','Eventos, cumpleaños, días festivos y meses'],
    stopwatch:['Cronómetro','Cuenta el tiempo con vueltas'],progressbar:['Barra de progreso','Avanza hasta una hora final'],draw:['Dibujar','Dibuja libremente por el tablero'],imagesearch:['Buscar imágenes','Busca imágenes y arrástralas al tablero'],dictionary:['Diccionario','Busca entradas completas de palabras'],translation:['Traducción','Traduce texto escrito o hablado'],attendance:['Asistencia','Mueve los imanes de estudiantes de Inicio a Presente'],writinglines:['Líneas de escritura','Plantilla para practicar la escritura'],
    abc:['ABC','Tarjetas animadas del alfabeto'],numberflashcards:['Tarjetas numéricas','Tarjetas animadas del 1 al 100'],cvcword:['Palabra CVC','Tarjetas animadas de palabras CVC'],highfrequency:['Palabras de alta frecuencia','Tarjetas animadas por nivel'],robothfw:['Robot HFW','Explota robots voladores con palabras de uso frecuente'],customflashcards:['Tarjetas personalizadas','Crea colecciones reutilizables con texto e imágenes'],wordweb:['Red de palabras','Conecta palabras relacionadas alrededor de una idea central'],venndiagram:['Diagramas de Venn','Compara ideas con conjuntos editables y arrastrables'],essentialquestion:['Pregunta esencial','Muestra una pregunta esencial entre comillas con un subtítulo opcional'],shapes:['Figuras','Explora lados, vértices y datos geométricos'],numberline:['Recta numérica','Recta numérica interactiva y ampliable'],
    hundredschart:['Tabla del 100','Oculta, revela y resalta del 1 al 100'],tenframes:['Marcos de diez','Construye cantidades con fichas arrastrables'],ruler:['Regla','Mide con puntos de regla arrastrables'],calculator:['Calculadora','Calculadora básica para el aula'],
    grapher:['Herramienta de gráficas','Traza puntos y grafica ecuaciones'],tablemaker:['Creador de tablas','Convierte tus datos en gráficas animadas'],tallychart:['Tabla de conteo','Cuenta y compara resultados en tiempo real'],periodictable:['Tabla periódica','Explora los 118 elementos'],money:['Dinero','Arrastra manipulativos de dinero y calcula el total'],noise:['Detector de ruido','Nivel de sonido en vivo con micrófono'],
    collections:['Colecciones','Llena en grupo el frasco de recompensas de la clase'],prizeboard:['Tablero de premios','Crea y canjea recompensas individuales o para toda la clase'],pbisconsole:['Consola PBIS','Administra todas las estadísticas PBIS en un solo lugar'],punchcards:['Tarjetas de puntos','Completa tarjetas para estudiantes o toda la clase'],racer:['Carrera','Mueve a los estudiantes hacia la meta'],stoplight:['Semáforo','Señal visual de SIGUE, ESCUCHA y ALTO'],starchart:['Tabla de estrellas','Otorga estrellas a la clase o a estudiantes'],classmeter:['Medidor de clase','Mantén pulsado para llenar una meta de toda la clase'],classvsclass:['Clase contra clase','Próximamente: competencias de incentivos'],spinner:['Ruleta','Gira una ruleta para elegir un nombre'],groupmaker:['Creador de grupos','Mezcla estudiantes en grupos equilibrados'],
    lunchcount:['Conteo de almuerzo','Cuenta almuerzos u organiza nombres'],voting:['Votación','Cuenta votos u organiza nombres'],ambiencevideo:['Video ambiente','Escenas de fogata, chimenea y acuario'],hangman:['Ahorcado','Adivina la palabra oculta'],
    wordypuzzle:['Rompecabezas de palabras','Adivina la palabra secreta del docente'],minesweeper:['Buscaminas','Despeja cada casilla segura sin tocar una mina'],boombox:['Paisajes sonoros','Repite paisajes sonoros del aula'],
    livecaption:['Subtítulos en vivo','Muestra el habla como texto claro y legible'],voicememo:['Notas de voz','Graba y reproduce notas de audio cortas'],photobooth:['Fotomatón','Toma fotos con filtros usando tu cámara'],backgroundremover:['Quitar fondo','Elimina fondos de imágenes y guarda recortes transparentes'],mirror:['Espejo','Usa la cámara como espejo del aula'],
    weather:['Clima','Compara el clima actual de varios lugares'],weatherwheel:['Rueda del clima','Señala el clima de hoy'],seasonwheel:['Rueda de estaciones','Explora primavera, verano, otoño e invierno'],temperature:['Temperatura','Muestra la temperatura exterior a tu manera'],worldmap:['Mapa mundial','Explora países, continentes y hemisferios'],compass:['Brújula','Explora direcciones y partes de la brújula']
  }
};

const runtimeInterfaceTranslations={};
const interfaceTranslationRequests=new Map();
const INTERFACE_TRANSLATION_CACHE_VERSION='v5';


window.TeacherTilesPreferences={
  get(){return boardPreferenceSnapshot()},
  apply(value,options){return applyAppPreferences(value,options)},
  t:translateAppText
};
window.TeacherTilesI18n={t:translateAppText,get language(){return appPreferences.language},apply:applyAppLanguage};


setupSettingsHub();

const BOARD_WIDTH=12000;
const BOARD_HEIGHT=8000;
const boardCamera={x:0,y:0,scale:1};
const BOARD_MIN_ZOOM=.35;
const BOARD_MAX_ZOOM=1.8;
const BOARD_OVERSCROLL=120;
const zoomIndicator=document.getElementById('zoom-indicator');
const boardMinimap=document.getElementById('board-minimap');
const boardMinimapCanvas=document.getElementById('board-minimap-canvas');
const boardFrameMenu=document.getElementById('board-frame-menu');
const boardFrameCapture=document.getElementById('board-frame-capture');
const boardFrameList=document.getElementById('board-frame-list');
const boardFrameEmpty=document.getElementById('board-frame-empty');
const boardFrameCount=document.getElementById('board-frame-count');
const BOARD_FRAME_LIMIT=5;
let boardFrames=[];
let boardFrameKeyHeld=false;
let boardFrameCloseTimer=0;
let boardFrameJumpTimer=0;
let boardFrameDragId='';
let zoomIndicatorTimer=0;
let boardZoomIntentPercent=100;
let boardZoomWheelAt=0;
let boardZoomPrecision=false;
let boardMinimapShowTimer=0;
let boardMinimapHideTimer=0;
let boardMinimapFrame=0;


boardFrameList?.addEventListener('dragover',event=>{
  if(!boardFrameDragId)return;
  event.preventDefault();
  if(event.dataTransfer)event.dataTransfer.dropEffect='move';
  const dragged=boardFrameList.querySelector(`.board-frame-row[data-frame-id="${CSS.escape(boardFrameDragId)}"]`);
  const target=event.target instanceof Element?event.target.closest('.board-frame-row'):null;
  boardFrameList.querySelectorAll('.board-frame-row').forEach(item=>item.classList.remove('is-drop-before','is-drop-after'));
  if(!dragged||!target||target===dragged||!boardFrameList.contains(target))return;
  const rect=target.getBoundingClientRect();
  const after=event.clientY>rect.top+rect.height/2;
  target.classList.add(after?'is-drop-after':'is-drop-before');
  if(after)target.after(dragged);else target.before(dragged);
});

boardFrameList?.addEventListener('drop',event=>{
  if(!boardFrameDragId)return;
  event.preventDefault();
  const ids=[...boardFrameList.querySelectorAll('.board-frame-row')].map(row=>row.dataset.frameId).filter(Boolean);
  const byId=new Map(boardFrames.map(frame=>[frame.id,frame]));
  const reordered=ids.map(id=>byId.get(id)).filter(Boolean);
  if(reordered.length===boardFrames.length){
    const changed=reordered.some((frame,index)=>frame!==boardFrames[index]);
    boardFrames=reordered;
    if(changed)persistBoardFrameChange('board-frame-reorder');
  }
  boardFrameDragId='';
  renderBoardFrames();
});

boardFrameCapture?.addEventListener('click',()=>{
  if(boardFrames.length>=BOARD_FRAME_LIMIT)return;
  const center=screenToBoard(innerWidth/2,innerHeight/2);
  boardFrames.push({
    id:`frame-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`,
    name:nextBoardFrameName(),
    centerX:center.x,
    centerY:center.y,
    scale:boardCamera.scale
  });
  renderBoardFrames();
  persistBoardFrameChange('board-frame-capture');
});

boardFrameMenu?.addEventListener('pointerenter',()=>clearTimeout(boardFrameCloseTimer));
boardFrameMenu?.addEventListener('pointerleave',()=>scheduleBoardFrameMenuClose(120));
boardFrameMenu?.addEventListener('focusin',()=>clearTimeout(boardFrameCloseTimer));
boardFrameMenu?.addEventListener('focusout',()=>scheduleBoardFrameMenuClose(120));


window.addEventListener('keydown',event=>{
  const isFrameKey=event.code==='KeyF'||String(event.key||'').toLowerCase()==='f';
  if(!isFrameKey||event.ctrlKey||event.metaKey||event.altKey)return;
  const boardsView=document.getElementById('boards-view');
  if(boardsView&&!boardsView.hidden)return;
  const target=event.target instanceof Element?event.target:null;
  if(isVisibleTypingTarget(target)||isVisibleTypingTarget(document.activeElement))return;
  event.preventDefault();
  event.stopPropagation();
  if(event.repeat)return;
  boardFrameKeyHeld=true;
  openBoardFrameMenu();
},{capture:true});

window.addEventListener('keyup',event=>{
  const isFrameKey=event.code==='KeyF'||String(event.key||'').toLowerCase()==='f';
  if(!isFrameKey)return;
  boardFrameKeyHeld=false;
  scheduleBoardFrameMenuClose(120);
},{capture:true});

window.addEventListener('blur',()=>resetBoardFrameHotkey());
window.addEventListener('pageshow',()=>resetBoardFrameHotkey({blurTypingFocus:true}));
window.addEventListener('teachertiles:boardloaded',()=>{
  // Board setup can queue focus() calls while restoring tiles. The boardloaded
  // event is dispatched on the next animation frame after restore, so clearing
  // typing focus here removes restore-created focus without affecting normal use.
  resetBoardFrameHotkey({blurTypingFocus:true});
});

document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!boardFrameMenu?.hidden)closeBoardFrameMenu({force:true});
},{capture:true});

renderBoardFrames();


boardMinimapCanvas?.addEventListener('pointerdown',event=>{
  if(event.button!==0)return;
  event.preventDefault();
  clearTimeout(boardMinimapHideTimer);
  boardMinimap?.classList.add('is-dragging');
  boardMinimapCanvas.setPointerCapture(event.pointerId);
  centerBoardFromMinimapPointer(event);
  const move=next=>centerBoardFromMinimapPointer(next);
  const end=()=>{
    boardMinimap?.classList.remove('is-dragging');
    boardMinimapCanvas.removeEventListener('pointermove',move);
    boardMinimapCanvas.removeEventListener('pointerup',end);
    boardMinimapCanvas.removeEventListener('pointercancel',end);
    scheduleBoardMinimapHide(1300);
  };
  boardMinimapCanvas.addEventListener('pointermove',move);
  boardMinimapCanvas.addEventListener('pointerup',end);
  boardMinimapCanvas.addEventListener('pointercancel',end);
});


workspace.style.width=`${BOARD_WIDTH}px`;
workspace.style.height=`${BOARD_HEIGHT}px`;
workspace.style.transformOrigin='0 0';
workspace.spellcheck=false;
workspace.setAttribute('spellcheck','false');


centerBoardCamera();

workspace.addEventListener('wheel',e=>{
  if(e.ctrlKey)return;
  e.preventDefault();
  const wheelDelta=e.deltaY||e.deltaX;
  if(!wheelDelta)return;
  const now=performance.now();
  let next;
  if(e.shiftKey){
    boardZoomPrecision=true;
    boardZoomIntentPercent=Math.round(boardCamera.scale*100);
    boardZoomWheelAt=now;
    const nextPercent=clamp(boardZoomIntentPercent+(wheelDelta<0?1:-1),BOARD_MIN_ZOOM*100,BOARD_MAX_ZOOM*100);
    boardZoomIntentPercent=nextPercent;
    next=nextPercent/100;
  }else{
    boardZoomPrecision=false;
    if(now-boardZoomWheelAt>220)boardZoomIntentPercent=Math.round(boardCamera.scale*100);
    boardZoomWheelAt=now;
    const delta=e.deltaMode===1?wheelDelta*16:e.deltaMode===2?wheelDelta*innerHeight:wheelDelta;
    boardZoomIntentPercent=clamp(boardZoomIntentPercent-delta*.12*(appPreferences.scrollSpeed/100),BOARD_MIN_ZOOM*100,BOARD_MAX_ZOOM*100);
    next=clamp(Math.round(boardZoomIntentPercent)/100,BOARD_MIN_ZOOM,BOARD_MAX_ZOOM);
  }
  showZoomIndicator(next,{precise:e.shiftKey});
  if(Math.abs(next-boardCamera.scale)<.0001)return;
  const anchor=screenToBoard(e.clientX,e.clientY);
  boardCamera.scale=next;
  boardCamera.x=e.clientX-anchor.x*next;
  boardCamera.y=e.clientY-anchor.y*next;
  applyBoardCamera();
},{passive:false});

window.addEventListener('keydown',event=>{
  if(event.key!=='Shift'||event.repeat)return;
  if(document.body.classList.contains('is-module-dragging'))return;
  boardZoomPrecision=true;
  showZoomIndicator(boardCamera.scale,{precise:true});
});
window.addEventListener('keyup',event=>{
  if(event.key!=='Shift')return;
  boardZoomPrecision=false;
  if(document.body.classList.contains('is-module-dragging'))return;
  showZoomIndicator(boardCamera.scale,{precise:false});
});
window.addEventListener('blur',()=>{
  boardZoomPrecision=false;
  zoomIndicator?.classList.remove('is-precise','is-visible');
});


window.addEventListener('keyup',event=>{if(event.code==='Space'&&!isSpaceTypingTarget(event.target)&&!isSpaceTypingTarget(document.activeElement)&&!boardKeyboardPanBlocked(true)){event.preventDefault();event.stopImmediatePropagation()}},{capture:true});
window.addEventListener('keydown',event=>{
  if(event.code!=='Space'||event.ctrlKey||event.metaKey||event.altKey)return;
  const target=event.target instanceof Element?event.target:null;
  if(isSpaceTypingTarget(target)||isSpaceTypingTarget(document.activeElement))return;

  if(boardKeyboardPanBlocked(true))return;
  event.preventDefault();
  event.stopImmediatePropagation();
  lastUiInteractionWasKeyboard=false;document.body.classList.remove('is-keyboard-navigation');
  if(document.activeElement instanceof HTMLElement&&!isSpaceTypingTarget(document.activeElement))document.activeElement.blur();
  if(event.repeat)return;
  const defaultScale=clamp((Number(appPreferences.defaultViewSize)||100)/100,BOARD_MIN_ZOOM,BOARD_MAX_ZOOM);
  setCurrentBoardViewSize(appPreferences.defaultViewSize);
  boardZoomIntentPercent=Math.round(defaultScale*100);
  showZoomIndicator(defaultScale,{precise:false});
},{capture:true});


const boardPanKeys=new Set();
let boardKeyboardPanFrame=0;
let boardKeyboardPanTime=0;
const BOARD_KEYBOARD_PAN_SPEED=720;
const boardPanKeyDirection={
  arrowup:[0,1],
  arrowdown:[0,-1],
  arrowleft:[1,0],
  arrowright:[-1,0]
};


window.addEventListener('blur',stopBoardKeyboardPan);
document.addEventListener('keyup',e=>{
  const key=e.key.toLowerCase();
  if(!boardPanKeyDirection[key])return;
  boardPanKeys.delete(key);
  if(!boardPanKeys.size)stopBoardKeyboardPan();
});

const selectionMarquee=document.createElement('div');
selectionMarquee.className='board-selection-marquee';
selectionMarquee.setAttribute('aria-hidden','true');
selectionMarquee.hidden=true;
document.body.appendChild(selectionMarquee);


workspace.addEventListener('pointerdown',e=>{
  if(e.target instanceof Element&&e.target.classList.contains('board-drawing-canvas'))return;
  if(e.button===1){beginBoardPan(e);return}
  if(e.button===0&&e.target===workspace){
    if(e.shiftKey)beginBoardSelection(e);
    else beginBoardPan(e);
  }
},true);

workspace.addEventListener('auxclick',e=>{
  if(e.button===1)e.preventDefault();
});

let boardClipboard=null;
let boardClipboardPasteCount=0;


document.addEventListener('keydown',e=>{
  if(isTypingTarget(e.target)||isTypingTarget(document.activeElement))return;
  const command=e.ctrlKey||e.metaKey;
  const key=e.key.toLowerCase();
  if(command&&!e.altKey&&!e.shiftKey&&key==='c'){
    if(selectedModules.size){
      e.preventDefault();
      copyBoardSelection();
    }
    return;
  }
  if(command&&!e.altKey&&!e.shiftKey&&key==='v'){
    if(boardClipboard?.objects?.length){
      e.preventDefault();
      pasteBoardClipboard();
    }
    return;
  }
  if(command&&!e.altKey&&!e.shiftKey&&key==='d'){
    e.preventDefault();
    if(selectedModules.size)duplicateBoardSelection();
    return;
  }
  if(command&&!e.altKey&&key==='a'&&!boardKeyboardPanBlocked()){
    e.preventDefault();
    const modules=[...workspace.querySelectorAll('.module')];
    const allSelected=modules.length>0&&modules.every(module=>selectedModules.has(module));
    if(allSelected){
      clearSelection();
    }else{
      clearSelection();
      for(const module of modules)selectModule(module);
    }
    return;
  }
  if(command&&!e.altKey&&(key==='z'||key==='y')){
    e.preventDefault();
    if(key==='y'||(key==='z'&&e.shiftKey))redoBoardAction();
    else undoBoardAction();
    return;
  }
  if((e.key==='Delete'||e.key==='Backspace')&&selectedModules.size){
    e.preventDefault();
    deleteModules([...selectedModules]);
    return;
  }
  if(!command&&!e.altKey&&boardPanKeyDirection[key]&&!boardKeyboardPanBlocked()){
    e.preventDefault();
    startBoardKeyboardPan(key);
  }
});

window.addEventListener('resize',applyBoardCamera);


workspace.addEventListener('contextmenu',e=>{
  if(e.target instanceof Element&&e.target.closest('.richtext-editor.module-text-edit-active'))return;
  e.preventDefault();spawn=screenToBoard(e.clientX,e.clientY);if(menuSearch)menuSearch.value='';setMenuCategoryDrawer(false);setMenuCategory('all');if(menuCategoryDrawer)menuCategoryDrawer.scrollTop=0;menu.classList.remove('is-open');void menu.offsetWidth;menu.style.left=`${e.clientX}px`;menu.style.top=`${e.clientY}px`;menu.classList.add('is-open');const r={width:menu.offsetWidth,height:menu.offsetHeight};menu.style.left=`${clamp(e.clientX,8,innerWidth-r.width-8)}px`;menu.style.top=`${clamp(e.clientY,8,innerHeight-r.height-8)}px`;menu.setAttribute('aria-hidden','false');keepTileMenuOnScreen();requestAnimationFrame(()=>{if(menuCategoryDrawer)menuCategoryDrawer.scrollTop=0});
});
document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target))closeMenu()});

document.addEventListener('pointerdown',e=>{
  if(e.button!==0||!selectedModules.size)return;
  const target=e.target instanceof Element?e.target:null;
  const module=target?.closest('.module');
  if(module&&selectedModules.has(module))return;
  clearSelection();
},true);


new ResizeObserver(keepTileMenuOnScreen).observe(menu);
window.addEventListener('resize',keepTileMenuOnScreen);
window.visualViewport?.addEventListener('resize',keepTileMenuOnScreen);
window.visualViewport?.addEventListener('scroll',keepTileMenuOnScreen);
keepTileMenuOnScreen();

const menuSearch=menu.querySelector('#context-menu-search');
const menuSearchClear=menu.querySelector('.context-menu__search-clear');
const menuNoResults=menu.querySelector('.context-menu__no-results');
const menuItems=[...menu.querySelectorAll('.context-menu__item[data-category]')];
menuItems.forEach(item=>{if(item.dataset.comingSoon==='true'||item.classList.contains('context-menu__item--coming-soon')||/coming soon/i.test(item.querySelector('small')?.textContent||'')){item.classList.add('context-menu__item--coming-soon');item.dataset.comingSoon='true';item.disabled=true;item.setAttribute('aria-disabled','true');item.setAttribute('aria-label',`${item.querySelector('strong')?.textContent}: Coming soon`)}});
const menuCategoryCycle=menu.querySelector('.context-menu__category-cycle');
const menuCategoryCycleLabel=menu.querySelector('.context-menu__category-cycle-label');
const menuDrawerFilters=[...menu.querySelectorAll('[data-category-drawer-filter]')];
const menuCategoryDrawer=menu.querySelector('.context-menu__category-drawer');
const menuCategoryDrawerToggle=menuCategoryCycle;
const menuCategoryDrawerClose=menu.querySelector('.context-menu__category-drawer-close');
let activeMenuCategory='all';
const menuCategoryOrder=['favorites','holidays','basics','all','accessibility','art','audio','classconnect','games','geography','language','literacy','math','media','music','pbis','planning','science','sel','text','time','tools'];

const menuFavoritesStorageKey='teacherTiles.tileFavorites.v1';
const menuFavorites=new Set();
try{const saved=JSON.parse(localStorage.getItem(menuFavoritesStorageKey)||'[]');if(Array.isArray(saved))saved.filter(id=>typeof id==='string').forEach(id=>menuFavorites.add(id))}catch{}
const menuItemKey=item=>item.dataset.module||`coming-soon:${item.querySelector('strong')?.textContent.trim()}`;
menu.addEventListener('click',event=>{
  const star=event.target.closest('[data-tile-favorite]');if(!star)return;
  event.preventDefault();event.stopPropagation();
  const id=star.dataset.tileFavorite;
  if(menuFavorites.has(id))menuFavorites.delete(id);else menuFavorites.add(id);
  try{window.TeacherTilesCollectionPreferences.write(menuFavoritesStorageKey,JSON.stringify([...menuFavorites]))}catch{}
  const list=menu.querySelector('.context-menu__list'),scroll=list.scrollTop;
  applyMenuView();renderMenuCategoryPins();list.scrollTop=scroll;
  const next=[...menu.querySelectorAll('[data-tile-favorite]')].find(button=>button.dataset.tileFavorite===id);
  (next||menuDrawerFilters.find(button=>button.dataset.categoryDrawerFilter==='favorites'))?.focus({preventScroll:true});
});

const menuHolidays=['Christmas','Hannukah','Halloween',"Valentine’s Day","St. Patrick’s Day",'Thanksgiving'];
let menuAllExpanded=true,menuHolidaysExpanded=true,menuFavoritesExpanded=true;


// Categories retain their buttons; pins only change their visual order.
const menuPinnedCategories=new Set();
try{const saved=JSON.parse(localStorage.getItem('teacherTiles.categoryPins.v1')||'[]');if(Array.isArray(saved))saved.filter(id=>(menuCategoryOrder.includes(id)||/^holiday:[0-5]$/.test(id))&&id!=='all').forEach(id=>menuPinnedCategories.add(id))}catch{}

menu.addEventListener('click',event=>{
  const pin=event.target.closest('[data-category-pin]');if(!pin)return;
  event.preventDefault();event.stopPropagation();const id=pin.dataset.categoryPin;
  if(menuPinnedCategories.has(id))menuPinnedCategories.delete(id);else menuPinnedCategories.add(id);
  try{window.TeacherTilesCollectionPreferences.write('teacherTiles.categoryPins.v1',JSON.stringify([...menuPinnedCategories]))}catch{}
  renderMenuCategoryPins();
  [...menu.querySelectorAll('[data-category-pin]')].find(button=>button.dataset.categoryPin===id)?.focus({preventScroll:true});
});
renderMenuCategoryPins();

// A keyboard-accessible corner grip resizes the catalog without changing board zoom.
const menuResizeGrip=document.createElement('button');menuResizeGrip.type='button';menuResizeGrip.className='context-menu__resize';menuResizeGrip.setAttribute('aria-label','Resize Add tile menu');menuResizeGrip.title='Drag to resize. Arrow keys adjust size.';menu.appendChild(menuResizeGrip);
const menuResetSize=document.createElement('button');menuResetSize.type='button';menuResetSize.className='context-menu__reset-size';menuResetSize.textContent='Reset Scale';menuResetSize.title='Restore the default menu size';menuResetSize.hidden=true;
menu.querySelector('.context-menu__title-row').insertBefore(menuResetSize,menu.querySelector('.context-menu__close'));

menuResetSize.addEventListener('click',event=>{
  event.stopPropagation();menu.style.removeProperty('--tile-menu-width');menu.style.removeProperty('--tile-menu-height');
  try{localStorage.removeItem('teacherTiles.menuSize.v1')}catch{}
  syncMenuResetSize();
  const rect=menu.getBoundingClientRect();menu.style.left=`${Math.max(8,Math.min(rect.left,innerWidth-rect.width-8))}px`;menu.style.top=`${Math.max(8,Math.min(rect.top,innerHeight-rect.height-8))}px`;
  menu.querySelector('.context-menu__close')?.focus({preventScroll:true});
});


try{const saved=JSON.parse(localStorage.getItem('teacherTiles.menuSize.v1')||'null');if(saved&&Number.isFinite(saved.width)&&Number.isFinite(saved.height)){menu.style.setProperty('--tile-menu-width',`${Math.max(360,saved.width)}px`);menu.style.setProperty('--tile-menu-height',`${Math.max(280,saved.height)}px`)}}catch{}
syncMenuResetSize();
menuResizeGrip.addEventListener('pointerdown',event=>{
  if(event.button!==0)return;event.preventDefault();event.stopPropagation();
  const rect=menu.getBoundingClientRect(),x=event.clientX,y=event.clientY;menuResizeGrip.setPointerCapture(event.pointerId);
  const move=e=>sizeTileMenu(Math.max(360,rect.width+e.clientX-x),Math.max(280,rect.height+e.clientY-y));
  const end=e=>{menuResizeGrip.removeEventListener('pointermove',move);menuResizeGrip.removeEventListener('pointerup',end);menuResizeGrip.removeEventListener('pointercancel',cancel);try{menuResizeGrip.releasePointerCapture(e.pointerId)}catch{}saveTileMenuSize()};
  const cancel=e=>{sizeTileMenu(rect.width,rect.height);end(e)};
  menuResizeGrip.addEventListener('pointermove',move);menuResizeGrip.addEventListener('pointerup',end);menuResizeGrip.addEventListener('pointercancel',cancel);
});
menuResizeGrip.addEventListener('keydown',event=>{
  const steps={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]},step=steps[event.key];if(!step)return;
  event.preventDefault();event.stopPropagation();const rect=menu.getBoundingClientRect();sizeTileMenu(Math.max(360,rect.width+step[0]),Math.max(280,rect.height+step[1]));saveTileMenuSize();
});
menu.insertBefore(menuCategoryDrawer,menu.querySelector('.context-menu__list'));
menuCategoryDrawer.setAttribute('aria-hidden','false');
menuCategoryDrawer.setAttribute('aria-label','Tile categories');
menu.querySelector('.context-menu__close')?.addEventListener('click',closeMenu);
const menuDragHeader=menu.querySelector('.context-menu__title-row');
menuDragHeader.addEventListener('pointerdown',event=>{
  if(event.button!==0||event.target.closest('button,input'))return;
  event.preventDefault();event.stopPropagation();
  const rect=menu.getBoundingClientRect(),startX=event.clientX,startY=event.clientY;
  menuDragHeader.setPointerCapture(event.pointerId);menu.classList.add('is-menu-dragging');
  const move=e=>{
    if(e.pointerId!==event.pointerId)return;
    menu.style.left=`${Math.max(8,Math.min(rect.left+e.clientX-startX,innerWidth-menu.offsetWidth-8))}px`;
    menu.style.top=`${Math.max(8,Math.min(rect.top+e.clientY-startY,innerHeight-menu.offsetHeight-8))}px`;
  };
  const end=e=>{
    if(e.pointerId!==event.pointerId)return;
    menu.classList.remove('is-menu-dragging');
    menuDragHeader.removeEventListener('pointermove',move);
    menuDragHeader.removeEventListener('pointerup',end);
    menuDragHeader.removeEventListener('pointercancel',end);
    menuDragHeader.removeEventListener('lostpointercapture',end);
    if(menuDragHeader.hasPointerCapture(event.pointerId))menuDragHeader.releasePointerCapture(event.pointerId);
  };
  menuDragHeader.addEventListener('pointermove',move);
  menuDragHeader.addEventListener('pointerup',end);
  menuDragHeader.addEventListener('pointercancel',end);
  menuDragHeader.addEventListener('lostpointercapture',end);
});

menu.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();closeMenu()}});


menuCategoryCycle?.addEventListener('click',event=>{
  event.stopPropagation();
  setMenuCategoryDrawer(!menu.classList.contains('has-category-drawer'));
});
menuDrawerFilters.forEach(b=>b.addEventListener('click',e=>{
  e.stopPropagation();
  if(menuSearch)menuSearch.value='';
  setMenuCategory(b.dataset.categoryDrawerFilter);
  setMenuCategoryDrawer(false);
}));
menuCategoryDrawerClose?.addEventListener('click',event=>{event.stopPropagation();setMenuCategoryDrawer(false)});

menuSearch?.addEventListener('input',applyMenuView);
menuSearch?.addEventListener('pointerdown',e=>e.stopPropagation());
menuSearch?.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    e.stopPropagation();
    if(menu.classList.contains('has-category-drawer')){
      setMenuCategoryDrawer(false);
    }else if(menuSearch.value){
      clearMenuSearch();
    }else{
      closeMenu();
    }
  }
});
menuSearchClear?.addEventListener('click',e=>{
  e.stopPropagation();
  clearMenuSearch();
  menuSearch?.focus();
});

setMenuCategory('all');
window.addEventListener('resize',()=>{if(menu.classList.contains('has-category-drawer'))syncMenuCategoryDrawerLayout()});
window.addEventListener('teachertiles:languagechange',()=>requestAnimationFrame(applyMenuView));


menu.addEventListener('click',e=>{const b=e.target.closest('[data-module]');if(!b||b.disabled||b.dataset.comingSoon==='true')return;createModule(b.dataset.module,spawn.x,spawn.y);closeMenu()});

const TILE_SKIN_CATALOG=Object.freeze([
  Object.freeze({"id": "sticky-taped", "productId": "tile-skin-sticky-taped", "tileType": "sticky", "tileLabel": "Sticky Note", "name": "Taped Up", "description": "A softly textured strip of tape holds your note on the board.", "tags": "Sticky Note Taped Up", "released": 21}),
  Object.freeze({"id": "sticky-ripped", "productId": "tile-skin-sticky-ripped", "tileType": "sticky", "tileLabel": "Sticky Note", "name": "Ripped-Edge", "description": "A paper note with a naturally torn bottom edge.", "tags": "Sticky Note Ripped-Edge", "released": 22}),
  Object.freeze({"id": "sticky-pinned", "productId": "tile-skin-sticky-pinned", "tileType": "sticky", "tileLabel": "Sticky Note", "name": "Pinned", "description": "A glossy red thumbtack pins your note in place.", "tags": "Sticky Note Pinned", "released": 23}),
  Object.freeze({"id": "textbubble-clear", "productId": "tile-skin-textbubble-clear", "tileType": "textbubble", "tileLabel": "Text Bubble", "name": "No Background", "description": "Your text floats directly on the board.", "tags": "Text Bubble No Background", "released": 24}),
  Object.freeze({"id": "richtext-clear", "productId": "tile-skin-richtext-clear", "tileType": "richtext", "tileLabel": "Rich Text", "name": "No Background", "description": "Your formatted document floats directly on the board with no tile shell.", "tags": "Rich Text No Background transparent clear floating text document", "released": 27}),
  Object.freeze({"id": "chime-clear", "productId": "tile-skin-chime-clear", "tileType": "chime", "tileLabel": "Chime", "name": "No Background", "description": "Let the classroom chime float directly on the board with no tile shell.", "tags": "Chime No Background clear transparent sel calm mindfulness mallet", "released": 28}),
  Object.freeze({"id": "clock-digital", "productId": "tile-skin-clock-digital", "tileType": "clock", "tileLabel": "Clock", "name": "Digital Clock", "description": "A bedside clock with a dark casing and glowing digital display.", "tags": "Clock Digital Clock", "released": 25}),
  Object.freeze({"id": "clock-analog-clear", "productId": "tile-skin-clock-analog-clear", "tileType": "clock", "tileLabel": "Clock", "name": "No Background Analog", "description": "A classic round analog clock floating directly on the board.", "tags": "Clock No Background Analog", "released": 26}),
  Object.freeze({id:'dice-clear',productId:'tile-skin-dice-clear',tileType:'dice',tileLabel:'Dice',name:'No Background',description:'Loose dice on the board, with no tile background.',tags:'dice clear transparent floating math tools',released:20}),
  Object.freeze({
    id:'magnifier-classic',
    productId:'tile-skin-magnifier-classic',
    tileType:'magnifier',
    tileLabel:'Magnifier',
    name:'Classic Magnifying Glass',
    description:'The original round lens with a steel rim and angled handle.',
    tags:'accessibility lens glass round classic original',
    released:1
  }),
  Object.freeze({
    id:'youtube-retro-tv',productId:'tile-skin-youtube-retro-tv',tileType:'youtube',tileLabel:'YouTube',
    name:'Vintage Television',description:'A woodgrain television with rounded glass, speaker vents, and tuning knobs.',
    tags:'youtube video tv television retro vintage old fashioned wood',released:2
  }),
  Object.freeze({
    id:'todo-clipboard',productId:'tile-skin-todo-clipboard',tileType:'todo',tileLabel:'To-Do',
    name:'Classroom Clipboard',description:'A paper checklist clipped onto a warm wooden board.',
    tags:'todo to-do checklist clipboard paper classroom office',released:3
  }),
  Object.freeze({
    id:'calendar-paper-stack',productId:'tile-skin-calendar-paper-stack',tileType:'calendar',tileLabel:'Calendar',
    name:'Page-Stack Calendar',description:'A bound paper calendar with dimensional pages layered underneath.',
    tags:'calendar paper pages stack realistic bound depth',released:4
  }),
  Object.freeze({
    id:'attendance-beehive',productId:'tile-skin-attendance-beehive',tileType:'attendance',tileLabel:'Attendance',
    name:'Beehive',description:'Students become busy bees that check in by flying into a warm classroom hive.',
    tags:'attendance bee bees beehive hive honey garden yellow classroom',magnetSrc:'assets/attendance/bee.png',released:5
  }),
  Object.freeze({
    id:'attendance-monkeys',productId:'tile-skin-attendance-monkeys',tileType:'attendance',tileLabel:'Attendance',
    name:'Monkeys',description:'Students become playful monkeys that check in on a leafy jungle tree.',
    tags:'attendance monkey monkeys jungle tree forest animal green',magnetSrc:'assets/attendance/monkey.png',released:6
  }),
  Object.freeze({
    id:'attendance-froggies',productId:'tile-skin-attendance-froggies',tileType:'attendance',tileLabel:'Attendance',
    name:'Froggies',description:'Students become little frogs that hop onto a giant lily pad in the pond.',
    tags:'attendance frog frogs froggies pond lily pad lilypad water animal',magnetSrc:'assets/attendance/froggie.png',released:7
  }),
  Object.freeze({
    id:'attendance-bubble-tea',productId:'tile-skin-attendance-bubble-tea',tileType:'attendance',tileLabel:'Attendance',
    name:'Bubble Tea',description:'Students become boba pearls that drop into a colorful bubble tea cup.',
    tags:'attendance bubble tea boba pearls drink cup cafe',magnetSrc:'assets/attendance/boba.png',released:8
  }),
  Object.freeze({
    id:'stoplight-freestanding',productId:'tile-skin-stoplight-freestanding',tileType:'stoplight',tileLabel:'Stoplight',
    name:'No Background',description:'The stoplight itself becomes the tile, floating cleanly on the board.',
    tags:'stoplight traffic light freestanding floating object sel',released:9
  }),
  Object.freeze({
    id:'stoplight-simplistic',productId:'tile-skin-stoplight-simplistic',tileType:'stoplight',tileLabel:'Stoplight',
    name:'Simplistic Stoplight',description:'A simplified version of the stoplight with minimalistic design.',
    tags:'stoplight traffic light simple simplistic classroom gray',released:10
  }),
  Object.freeze({
    id:'progressbar-capsule',productId:'tile-skin-progressbar-capsule',tileType:'progressbar',tileLabel:'Progress Bar',
    name:'No Background',description:'A large pill-shaped progress bar without a rectangular tile shell.',
    tags:'progress bar capsule pill floating freestanding timer',released:11
  }),
  Object.freeze({
    id:'timer-freestanding',productId:'tile-skin-timer-freestanding',tileType:'timer',tileLabel:'Visual Timer',
    name:'No Background',description:'The animated timer shape becomes the tile and floats directly on the board.',
    tags:'visual timer floating freestanding object clock countdown',released:12
  }),
  Object.freeze({id:'timer-solid',productId:'tile-skin-timer-solid',tileType:'timer',tileLabel:'Visual Timer',name:'Solid',description:'A bold timer that starts empty and fills with solid color as time passes.',tags:'visual timer solid vivid bold',released:13}),
  Object.freeze({id:'timer-liquid',productId:'tile-skin-timer-liquid',tileType:'timer',tileLabel:'Visual Timer',name:'Liquid Fill',description:'Your timer shape fills with gently moving liquid as time passes.',tags:'visual timer liquid fill water wave',released:14}),
  Object.freeze({id:'visualschedule-planner',productId:'tile-skin-visualschedule-planner',tileType:'visualschedule',tileLabel:'Visual Schedule',name:'Planner Book',description:'A spiral-bound blue planner with paper pages for your daily schedule.',tags:'visual schedule planner book spiral notebook',released:34}),
  Object.freeze({id:'interactive-wonders',productId:'tile-skin-interactive-wonders',tileType:'interactive',tileLabel:'Interactive Timers',name:'Interactive Pack I',description:'Four playful timers: Firework, Ice, Ice Cream, and Ants.',tags:'interactive timer firework ice cream ants pizza',released:40}),
  Object.freeze({id:'meditation-rainbow',productId:'tile-skin-meditation-rainbow',tileType:'meditation',tileLabel:'Meditation',name:'Rainbow Breath',description:'Translucent rainbow bands rise together on the inhale and recede on the exhale.',tags:'meditation rainbow breath breathing sel',released:33,preferredSize:Object.freeze({width:640,height:440})}),
  Object.freeze({id:'squishy-gel-cube',productId:'tile-skin-squishy-gel-cube',tileType:'squishy',tileLabel:'Squishy',name:'3D Squishy',description:'Grab, stretch, rotate, and toss a soft 3D gel cube with spring physics.',tags:'squishy gel cube 3d sensory',released:32}),
  Object.freeze({id:'soundscapes-vinyl',productId:'tile-skin-soundscapes-vinyl',tileType:'boombox',tileLabel:'Soundscapes',name:'Vinyl',description:'Turn Soundscapes into a spinning record player.',tags:'soundscapes audio vinyl record music ambient sound',released:29}),
  Object.freeze({id:'soundscapes-music-player',productId:'tile-skin-soundscapes-music-player',tileType:'boombox',tileLabel:'Soundscapes',name:'Music Player',description:'A polished modern music-player layout for classroom soundscapes.',tags:'soundscapes audio music player modern ambient sound',released:30}),
  Object.freeze({id:'soundscapes-ipod',productId:'tile-skin-soundscapes-ipod',tileType:'boombox',tileLabel:'Soundscapes',name:'iPod',description:'A classic click-wheel player look for your classroom soundscapes.',tags:'soundscapes audio ipod click wheel retro music ambient sound',released:31,preferredSize:Object.freeze({width:270,height:430})})
]);
const CURSOR_COLOR_PACK_PRODUCT_ID='cursor-color-pack';
const CURSOR_CATALOG=Object.freeze([
  Object.freeze({id:'default',productId:'',name:'Default',description:'Use your normal device cursor.',color:'#252a31'}),
  Object.freeze({id:'blue',productId:CURSOR_COLOR_PACK_PRODUCT_ID,name:'Electric Blue',description:'Bright and crisp.',color:'#3182f6'}),
  Object.freeze({id:'red',productId:CURSOR_COLOR_PACK_PRODUCT_ID,name:'Cherry Red',description:'Bold classroom red.',color:'#ef4444'}),
  Object.freeze({id:'green',productId:CURSOR_COLOR_PACK_PRODUCT_ID,name:'Marker Green',description:'Lively marker green.',color:'#22a860'}),
  Object.freeze({id:'purple',productId:CURSOR_COLOR_PACK_PRODUCT_ID,name:'Violet',description:'Rich violet purple.',color:'#8b5cf6'}),
  Object.freeze({id:'gold',productId:CURSOR_COLOR_PACK_PRODUCT_ID,name:'Golden Chalk',description:'Warm golden yellow.',color:'#e2a51f'}),
  ...window.TeacherTilesCursorPacks.flatMap(pack=>pack.cursors)
]);
const ACTIVE_CURSOR_KEY='teacherTilesActiveCursor';
const SHOP_OWNED_PRODUCTS_KEY='teacherTilesOwnedShopPacks';
const stickerCatalogItems=(entries,tags='')=>Object.freeze(entries.map(([emoji,name])=>Object.freeze({emoji,name,tags})));
const ADDITIONAL_STICKER_PACKS=Object.freeze([
  Object.freeze({id:'faces-happy',productId:'sticker-faces-happy',category:'faces',name:'Happy Faces',description:'Eight cheerful smiles for celebrations and encouragement.',tags:'emoji emojis face faces happy smile smiles cheerful positive reaction emotion',price:180,items:stickerCatalogItems([['😄','Smiling face with open mouth'],['😁','Beaming face'],['😊','Smiling face with smiling eyes'],['🙂','Slightly smiling face'],['😇','Smiling face with halo'],['😌','Relieved face'],['☺️','Smiling face'],['🥰','Smiling face with hearts']])}),
  Object.freeze({id:'faces-silly',productId:'sticker-faces-silly',category:'faces',name:'Silly Faces',description:'Eight playful reactions for fun classroom moments.',tags:'emoji emojis face faces silly playful funny reaction expression emotion',price:180,items:stickerCatalogItems([['😛','Face with tongue'],['😜','Winking face with tongue'],['😝','Squinting face with tongue'],['🤭','Face with hand over mouth'],['🤫','Shushing face'],['🤗','Hugging face'],['🫠','Melting face'],['🙃','Upside-down face']])}),
  Object.freeze({id:'faces-worried',productId:'sticker-faces-worried',category:'faces',name:'Worried Faces',description:'Eight concerned and frustrated expressions.',tags:'emoji emojis face faces worried concern sad frustrated reaction expression emotion',price:180,items:stickerCatalogItems([['😟','Worried face'],['😕','Confused face'],['🙁','Slightly frowning face'],['☹️','Frowning face'],['😣','Persevering face'],['😖','Confounded face'],['😫','Tired face'],['😩','Weary face']])}),
  Object.freeze({id:'faces-big-reactions',productId:'sticker-faces-big-reactions',category:'faces',name:'Big Reactions',description:'Eight surprised, amazed, and dramatic expressions.',tags:'emoji emojis face faces surprised amazed shocked dramatic reaction expression emotion',price:180,items:stickerCatalogItems([['😮','Face with open mouth'],['😯','Hushed face'],['😲','Astonished face'],['😳','Flushed face'],['🥺','Pleading face'],['😱','Face screaming in fear'],['🤯','Exploding head'],['🥶','Cold face']])}),
  Object.freeze({id:'food-fruit',productId:'sticker-food-fruit',category:'food',name:'Fresh Fruit',description:'Eight colorful fruits for snacks, charts, and rewards.',tags:'food foods fruit fruits fresh snack healthy',price:180,items:stickerCatalogItems([['🍏','Green apple'],['🍐','Pear'],['🍊','Tangerine'],['🍋','Lemon'],['🍌','Banana'],['🍉','Watermelon'],['🍇','Grapes'],['🫐','Blueberries']])}),
  Object.freeze({id:'food-vegetables',productId:'sticker-food-vegetables',category:'food',name:'Vegetables',description:'Eight garden vegetables and healthy classroom favorites.',tags:'food foods vegetable vegetables veggie veggies garden healthy',price:180,items:stickerCatalogItems([['🥕','Carrot'],['🌽','Ear of corn'],['🥦','Broccoli'],['🥒','Cucumber'],['🫑','Bell pepper'],['🍅','Tomato'],['🍆','Eggplant'],['🥔','Potato']])}),
  Object.freeze({id:'food-meals',productId:'sticker-food-meals',category:'food',name:'Meals',description:'Eight lunch, dinner, and takeout favorites.',tags:'food foods meal meals lunch dinner entree',price:180,items:stickerCatalogItems([['🌭','Hot dog'],['🌮','Taco'],['🌯','Burrito'],['🥪','Sandwich'],['🍝','Spaghetti'],['🍜','Steaming bowl'],['🍣','Sushi'],['🍱','Bento box']])}),
  Object.freeze({id:'food-sweet-treats',productId:'sticker-food-sweet-treats',category:'food',name:'Sweet Treats',description:'Eight desserts, candies, and celebration treats.',tags:'food foods sweet sweets treat treats dessert desserts candy celebration',price:180,items:stickerCatalogItems([['🍦','Soft ice cream'],['🍧','Shaved ice'],['🍨','Ice cream'],['🍰','Shortcake'],['🎂','Birthday cake'],['🍫','Chocolate bar'],['🍬','Candy'],['🍭','Lollipop']])}),
  Object.freeze({id:'numbers-1-25',productId:'sticker-numbers-1-25',category:'learning',name:'Numbers 1–25',description:'Twenty-five bold number stickers for counting and labeling.',tags:'number numbers counting count math mathematics classroom label labels',price:180,items:Object.freeze(Array.from({length:25},(_,index)=>Object.freeze({emoji:String(index+1),name:`Number ${index+1}`,tags:'number numbers counting math'})))}),
  Object.freeze({id:'letters-lowercase',productId:'sticker-letters-lowercase',category:'learning',name:'Lowercase Letters',description:'All twenty-six lowercase letter stickers from a to z.',tags:'letter letters lowercase alphabet phonics literacy classroom',price:180,items:Object.freeze(Array.from({length:26},(_,index)=>{const letter=String.fromCharCode(97+index);return Object.freeze({emoji:letter,name:`Lowercase ${letter}`,tags:'letter letters lowercase alphabet phonics'})}))}),
  Object.freeze({id:'letters-uppercase',productId:'sticker-letters-uppercase',category:'learning',name:'Uppercase Letters',description:'All twenty-six uppercase letter stickers from A to Z.',tags:'letter letters uppercase capital capitals alphabet phonics literacy classroom',price:180,items:Object.freeze(Array.from({length:26},(_,index)=>{const letter=String.fromCharCode(65+index);return Object.freeze({emoji:letter,name:`Uppercase ${letter}`,tags:'letter letters uppercase capital alphabet phonics'})}))}),
  Object.freeze({id:'quiet-critters',productId:'sticker-quiet-critters',category:'characters',name:'Quiet Critters',description:'Eight colorful Quiet Critter poses for praise, routines, and classroom fun.',tags:'quiet critter critters character characters monster monsters classroom cute reward',price:180,items:Object.freeze([
    Object.freeze({src:'assets/stickers/quiet-critters/jump-lavender.png?v=2',name:'Lavender jumping Quiet Critter',tags:'lavender purple jump jumping'}),
    Object.freeze({src:'assets/stickers/quiet-critters/jump-blue.png?v=2',name:'Blue jumping Quiet Critter',tags:'blue jump jumping'}),
    Object.freeze({src:'assets/stickers/quiet-critters/sleep-mint.png?v=2',name:'Mint sleeping Quiet Critter',tags:'mint green sleep sleeping calm'}),
    Object.freeze({src:'assets/stickers/quiet-critters/sway-rose.png?v=2',name:'Rose swaying Quiet Critter',tags:'rose pink sway swaying'}),
    Object.freeze({src:'assets/stickers/quiet-critters/blink-amber.png?v=2',name:'Amber blinking Quiet Critter',tags:'amber orange blink blinking happy'}),
    Object.freeze({src:'assets/stickers/quiet-critters/dance-moss.png?v=2',name:'Moss dancing Quiet Critter',tags:'moss green dance dancing'}),
    Object.freeze({src:'assets/stickers/quiet-critters/dance-sky.png?v=2',name:'Sky dancing Quiet Critter',tags:'sky teal blue dance dancing'}),
    Object.freeze({src:'assets/stickers/quiet-critters/sway-lavender.png?v=2',name:'Lavender swaying Quiet Critter',tags:'lavender purple sway swaying'})
  ])})
]);
const COLLECTION_PACK_PRODUCTS=Object.freeze({
  'outer-space-theme-pack':'theme-outer-space','frosted-window-theme-pack':'theme-frosted-window',
  'basic-theme-pack':'theme-basic',
  'bamboo-theme-pack':'theme-bamboo',
  'underwater-theme-pack':'theme-underwater','rainy-window-theme-pack':'theme-rainy-window',
  'pastel-theme-pack':'theme-pastel',
  'polka-dot-theme-pack':'theme-polka-dot',
  'programmer-theme-pack':'theme-programmer',
  'wood-theme-pack':'theme-wood',
  'notebook-theme-pack':'theme-notebook',
  'cardboard-theme-pack':'theme-cardboard',
  'metal-theme-pack':'theme-metal',
  'cosmos-theme-pack':'theme-cosmos',
  'corkboard-theme-pack':'theme-corkboard',
  'emoji-sticker-pack':'sticker-emoji',
  'nature-emojis-sticker-pack':'sticker-nature-emojis',
  'weather-emojis-sticker-pack':'sticker-weather-emojis',
  'animal-emojis-sticker-pack':'sticker-animal-emojis',
  'more-faces-sticker-pack':'sticker-more-faces',
  'symbols-sticker-pack':'sticker-symbols',
  'food-sticker-pack':'sticker-food',
  'colored-hearts-sticker-pack':'sticker-colored-hearts',
  'decorative-hearts-sticker-pack':'sticker-decorative-hearts',
  'country-flags-sticker-pack':'sticker-country-flags',
  ...Object.fromEntries(ADDITIONAL_STICKER_PACKS.map(pack=>[`${pack.id}-sticker-pack`,pack.productId]))
});
const THEME_CHOICE_PRODUCTS=Object.freeze({
  outer:'theme-outer-space',frosted:'theme-frosted-window',
  basic:'theme-basic',
  bamboo:'theme-bamboo',
  underwater:'theme-underwater',rainy:'theme-rainy-window',
  pastel:'theme-pastel',polka:'theme-polka-dot',programmer:'theme-programmer',wood:'theme-wood',notebook:'theme-notebook',cardboard:'theme-cardboard',metal:'theme-metal',cosmos:'theme-cosmos',corkboard:'theme-corkboard'
});


// Render crown hints outside cards and drawers so overflow cannot clip them.
(()=>{
  let hint=null,anchor=null;
  function hide(){hint?.remove();hint=null;anchor=null}
  function show(target){
    if(anchor===target)return;
    hide();anchor=target;
    hint=document.createElement('div');hint.className='subscription-access-tooltip';
    hint.setAttribute('role','tooltip');hint.textContent=target.getAttribute('aria-label');
    (document.fullscreenElement||document.body).append(hint);
    const rect=target.getBoundingClientRect(),box=hint.getBoundingClientRect();
    hint.style.left=Math.max(8,Math.min(rect.left,innerWidth-box.width-8))+'px';
    hint.style.top=Math.max(8,rect.bottom+8+box.height<=innerHeight-8?rect.bottom+8:rect.top-box.height-8)+'px';
  }
  document.addEventListener('pointerover',event=>{const target=event.target.closest?.('.subscription-access-crown');if(target)show(target)});
  document.addEventListener('pointerout',event=>{if(anchor?.contains(event.target)&&!anchor.contains(event.relatedTarget))hide()});
  document.addEventListener('focusin',event=>{if(event.target.matches('.subscription-access-crown'))show(event.target)});
  document.addEventListener('focusout',event=>{if(event.target===anchor)hide()});
  document.addEventListener('scroll',hide,true);window.addEventListener('resize',hide);
  document.addEventListener('pointerdown',hide,true);
  document.addEventListener('keydown',event=>{if(event.key==='Escape')hide()});
  new MutationObserver(()=>{if(anchor&&!anchor.isConnected)hide()}).observe(document.documentElement,{childList:true,subtree:true});
})();


const cursorSpriteLoads=new Map();
let cursorEquipGeneration=0;


migrateLegacyCursorOwnership();
applyAppCursor(localStorage.getItem(ACTIVE_CURSOR_KEY)||'default',{persist:false});


// Optional controls for standalone tile files use the board's existing
// palette, typography, state notification and keyboard interaction helpers.


const TILE_AUDIO_SETTING_TYPES=new Set([
  'timer','interactive','classmeter','racer','punchcards','collections','money','shapemanipulatives','spinner',
  'flyswat','quietcritters','robothfw','chime','transitionbell','meditation','rainbowbreath','squishy'
]);
const TILE_AUDIO_TITLES=Object.freeze({
  squishy:'Squishy',timer:'Visual Timer',interactive:'Interactive Timers',classmeter:'Class Meter',racer:'Racer',punchcards:'Punchcards',
  collections:'Collections',money:'Money',shapemanipulatives:'Shape Manipulatives',spinner:'Spinner',flyswat:'Fly Swat',
  rainbowbreath:'Rainbow Breath',meditation:'Meditation',quietcritters:'Quiet Critters',robothfw:'Robot HFW',chime:'Chime',transitionbell:'Transition Bell'
});
const TILE_AUDIO_HOSTS=Object.freeze({
  timer:'.timer-customization',interactive:'.interactive-customization',racer:'.racer-customization',punchcards:'.punchcard-customization',
  money:'.money-customization',shapemanipulatives:'.shape-manipulatives-customization',spinner:'.spinner-customization',
  rainbowbreath:'.meditation-controls',meditation:'.meditation-controls',robothfw:'.robothfw-customization',chime:'.chime-controls',transitionbell:'.transition-bell-controls'
});


function setupModuleByType(m,type){
  setupCommon(m);
  if(type==='dice')window.TeacherTilesDice.setup(m);
  if(type==='flyswat')window.TeacherTilesFlySwat.setup(m);
  if(type==='seatingchart')window.TeacherTilesSeating.setup(m);
  if(type==='fishtank')window.TeacherTilesFishTank.setup(m);
  if(type==='sleepymonster')window.TeacherTilesSleepyMonster.setup(m);
  if(type==='quietcritters')window.TeacherTilesQuietCritters.setup(m);
  if(type==='chime')window.TeacherTilesChime.setup(m);
  if(type==='meditation'||type==='rainbowbreath')window.TeacherTilesMeditation.setup(m);
  if(type==='sentenceexpansion')window.TeacherTilesSentenceExpansion.setup(m);
  if(type==='spreadsheet')window.TeacherTilesSpreadsheet.setup(m);
  if(type==='reminders')window.TeacherTilesReminders.setup(m);
  if(type==='glitterjar')window.TeacherTilesGlitterJar.setup(m);
  if(type==='transitionbell')window.TeacherTilesTransitionBell.setup(m);
  if(type==='popsiclesticks')window.TeacherTilesPopsicleSticks.setup(m);
  if(type==='butterflygarden')window.TeacherTilesButterflyGarden.setup(m);
  if(type==='backgroundremover'){setupBoardPhotoDrop();window.TeacherTilesBackgroundRemover.setup(m);}
  if(type==='wordoftheday')window.TeacherTilesWordOfTheDay.setup(m);
  if(type==='quoteoftheday')window.TeacherTilesQuoteOfTheDay.setup(m);
  if(type==='visualdirections')window.TeacherTilesVisualDirections.setup(m);
  if(type==='colorpicker')window.TeacherTilesColorpicker.setup(m);
  if(type==='rainbow')window.TeacherTilesRainbow.setup(m);
  if(type==='piano')window.TeacherTilesPiano.setup(m);
  if(type==='musicscore')window.TeacherTilesMusicscore.setup(m);
  if(type==='richtext')window.TeacherTilesRichText.setup(m);
  if(type==='vocabulary')window.TeacherTilesVocabulary.setup(m);
  if(type==='essentialquestion')window.TeacherTilesEssentialQuestion.setup(m);
  if(type==='wordweb')window.TeacherTilesWordWeb.setup(m);
  if(type==='venndiagram')window.TeacherTilesVennDiagrams.setup(m);
  if(type==='timestables')window.TeacherTilesTimesTables.setup(m);
  if(type==='google')window.TeacherTilesGoogle.setup(m);
  if(type==='link')window.TeacherTilesLink.setup(m);
  if(m.classList.contains('classroom-widget')||['dice','seatingchart','fishtank','sleepymonster','quietcritters','butterflygarden','backgroundremover','boombox'].includes(type))setupClassroomTileControls(m);
  if(type==='sticky')setupSticky(m);
  if(type==='timer')setupTimer(m);
  if(type==='interactive')setupHourglass(m);
  if(type==='clock')setupClock(m);
  if(type==='stopwatch')setupStopwatch(m);
  if(type==='draw')setupDraw(m);
  if(type==='magnifier')setupMagnifier(m);
  if(type==='dictionary')setupDictionary(m);
  if(type==='translation')setupTranslation(m);
  if(type==='attendance')setupAttendance(m);
  if(type==='livecaption')setupLiveCaption(m);
  if(type==='voicememo')setupVoiceMemo(m);
  if(type==='photobooth')setupPhotobooth(m);
  if(type==='mirror')setupMirror(m);
  if(type==='weather')setupWeather(m);
  if(type==='weatherwheel')setupWeatherWheel(m);
  if(type==='seasonwheel')setupSeasonWheel(m);
  if(type==='temperature')setupTemperature(m);
  if(type==='worldmap'||type==='usstates')setupWorldMap(m);
  if(type==='compass')setupCompass(m);
  if(type==='writinglines')setupWritingLines(m);
  if(type==='noise')window.TeacherTilesNoiseMeter.setup(m);
  if(type==='classroomjobs')window.TeacherTilesClassroomJobs.setup(m);
  if(type==='countdown')window.TeacherTilesCountdown.setup(m);
  if(type==='coinflip')window.TeacherTilesCoinFlip.setup(m);
  if(type==='squishy')window.TeacherTilesSquishy.setup(m);
  if(type==='starchart')setupStarChart(m);
  if(type==='classmeter')setupClassMeter(m);
  if(type==='collections')setupCollections(m);
  if(type==='prizeboard')setupPrizeBoard(m);
  if(type==='pbisconsole')setupPbisConsole(m);
  if(type==='punchcards')setupPunchcards(m);
  if(type==='egghatching'||type==='flowerpots')window.TeacherTilesGrowthRewards.setup(m);
  if(type==='racer')setupRacer(m);
  if(type==='stoplight')setupStoplight(m);
  if(type==='groupmaker')setupGroupMaker(m);
  if(type==='lunchcount')setupLunchCount(m);
  if(type==='voting')setupVoting(m);
  if(type==='image')setupImage(m);
  if(type==='imagesearch')window.TeacherTilesImageSearch.setup(m);
  if(type==='youtube')setupYoutube(m);
  if(type==='ambiencevideo')setupAmbienceVideo(m);
  if(type==='windowshare')setupWindowShare(m);
  if(type==='boombox')window.TeacherTilesSoundscapes.setup(m);
  if(type==='spinner')setupSpinner(m);
  if(type==='hangman')setupHangman(m);
  if(type==='wordypuzzle')setupWordyPuzzle(m);
  if(type==='minesweeper')setupMinesweeper(m);
  if(type==='cvcword')setupCVCWord(m);
  if(type==='highfrequency')setupHighFrequencyWords(m);
  if(type==='robothfw')setupRobotHfw(m);
  if(type==='customflashcards')setupCustomFlashcards(m);
  if(type==='abc')setupABC(m);
  if(type==='numberflashcards')setupNumberFlashcards(m);
  if(type==='ruler')setupRuler(m);
  if(type==='calculator')setupCalculator(m);
  if(type==='grapher')setupGrapher(m);
  if(type==='tablemaker')setupTableMaker(m);
  if(type==='tallychart')setupTallyChart(m);
  if(type==='periodictable')setupPeriodicTable(m);
  if(type==='money')setupMoney(m);
  if(type==='patternmaker')setupPatternMaker(m);
  if(type==='shapemanipulatives')setupShapeManipulatives(m);
  if(type==='shapes')setupShapes(m);
  if(type==='numberline')setupNumberLine(m);
  if(type==='hundredschart')setupHundredsChart(m);
  if(type==='tenframes')setupTenFrames(m);
  if(type==='textbubble')setupTextBubble(m);
  if(type==='todo')setupTodo(m);
  if(type==='visualschedule')setupVisualSchedule(m);
  if(type==='lessonplannertile')setupLessonPlannerTile(m);
  if(type==='progressbar')setupProgressBar(m);
  if(type==='date')setupDate(m);
  if(type==='calendar')setupCalendar(m);
  window.TeacherTilesFlashcardNavigation?.setup(m);
  setupTileAudioSettings(m,type);
  setupEditableTileHeading(m,type);
  window.TeacherTilesAppearance.setup(m,{fonts:FONT_OPTIONS,onChange:notifyBoardChanged});
  setupTileHeadingVisibility(m,type);
  window.TeacherTilesSkins.setup(m,{catalog:TILE_SKIN_CATALOG,owned:tileSkinIsOwned,apply:applyTileSkinToModule});
}


const workspaceEmptyHint=document.getElementById('workspace-empty-hint');


const workspaceModuleObserver=new MutationObserver(updateWorkspaceEmptyState);
workspaceModuleObserver.observe(workspace,{childList:true,subtree:false});
updateWorkspaceEmptyState();

const workspaceSpellcheckObserver=new MutationObserver(records=>{
  for(const record of records){
    for(const node of record.addedNodes){
      if(node instanceof Element&&(node.classList.contains('module')||node.closest('.module')))disableModuleSpellcheck(node);
    }
  }
});
workspaceSpellcheckObserver.observe(workspace,{childList:true,subtree:true});

let snapGroupSequence=0;


const TEXT_ENTRY_SELECTOR='textarea,[contenteditable]:not([contenteditable="false"]),[role="textbox"],input:not([type]),input[type="text"],input[type="search"],input[type="email"],input[type="url"],input[type="tel"],input[type="password"]';
let activeModuleTextEditor=null;
const moduleTextClickState=new WeakMap();


const FLOATING_TILE_SKIN_IDS=new Set(['stoplight-freestanding','progressbar-capsule','timer-freestanding','magnifier-classic']);

const TILE_FULLSCREEN_ENTER_ICON='<svg class="module-fullscreen-icon module-fullscreen-icon--enter" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4H4v5M15 4h5v5M20 15v5h-5M4 15v5h5"/></svg>';
const TILE_FULLSCREEN_EXIT_ICON='<svg class="module-fullscreen-icon module-fullscreen-icon--exit" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h5V4M20 9h-5V4M15 20v-5h5M9 20v-5H4"/></svg>';
const TILE_PIN_OFF_ICON='<svg class="module-pin-icon module-pin-icon--off" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8l-1 5 3 3v2H6v-2l3-3-1-5Z"/><path d="M12 14v6"/></svg>';
const TILE_PIN_ON_ICON='<svg class="module-pin-icon module-pin-icon--on" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8l-1 5 3 3v2H6v-2l3-3-1-5Z" fill="currentColor"/><path d="M12 14v6"/></svg>';


document.addEventListener('pointerdown',event=>{
  if(!activeModuleTextEditor||!(event.target instanceof Node))return;
  if(event.target instanceof Element&&event.target.closest('[data-preserve-text-edit="true"]'))return;
  if(event.target===activeModuleTextEditor||activeModuleTextEditor.contains(event.target))return;
  exitModuleTextEdit(activeModuleTextEditor);
},true);

document.addEventListener('pointerdown',event=>{
  const field=document.activeElement;
  if(!(field instanceof HTMLElement)||!field.matches(TEXT_ENTRY_SELECTOR)||!(event.target instanceof Node))return;
  if(event.target instanceof Element&&event.target.closest('[data-preserve-text-edit="true"]'))return;
  if(event.target===field||field.contains(event.target))return;
  collapseTextEntrySelection(field);
},true);

document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&activeModuleTextEditor){
    event.preventDefault();
    exitModuleTextEdit(activeModuleTextEditor);
  }
},true);


const shapePaths={
  circle:'M50 4 A46 46 0 1 1 49.999 4 Z',
  triangle:'M50 5 L96 92 L4 92 Z',
  square:'M8 8 H92 V92 H8 Z',
  diamond:'M50 4 L96 50 L50 96 L4 50 Z',
  pentagon:'M50 4 L93.8 35.8 L77.1 87.2 H22.9 L6.2 35.8 Z',
  hexagon:'M25 6 H75 L96 50 L75 94 H25 L4 50 Z',
  star:'M50 4 L61.4 36.2 L95.5 36.9 L68.4 57.7 L78.2 90.4 L50 71 L21.8 90.4 L31.6 57.7 L4.5 36.9 L38.6 36.2 Z',
  heart:'M50 91 C42 82 10 63 7 35 C5 16 18 6 33 6 C42 6 48 11 50 18 C52 11 58 6 67 6 C82 6 95 16 93 35 C90 63 58 82 50 91 Z'
};


const timerSyncSoundEnds=new Map();


const PRIZE_STAT_OPTIONS=Object.freeze([
  Object.freeze({id:'studentEggPoints',label:'Egg Hatching Points',icon:'🥚',scope:'student'}),
  Object.freeze({id:'studentFlowerPoints',label:'Flower Pot Points',icon:'🌷',scope:'student'}),
  Object.freeze({id:'studentStars',label:'Student Stars',icon:'★',scope:'student'}),
  Object.freeze({id:'studentPunchcardPoints',label:'Punchcard Points',icon:'●',scope:'student'}),
  Object.freeze({id:'studentRaceWins',label:'Race Wins',icon:'🏁',scope:'student'}),
  Object.freeze({id:'classStars',label:'Whole-class Stars',icon:'★',scope:'class'}),
  Object.freeze({id:'meterWins',label:'Class Meter Wins',icon:'🏆',scope:'class'}),
  Object.freeze({id:'jarsFilled',label:'Jars Filled',icon:'🫙',scope:'class'}),
  Object.freeze({id:'classPunchcardPoints',label:'Whole-class Punchcard Points',icon:'●',scope:'class'})
]);


const LUNCH_COUNT_ICONS=[
  {src:'assets/lunch-icons/30.png',label:'Burger'},{src:'assets/lunch-icons/31.png',label:'Chicken sandwich'},
  {src:'assets/lunch-icons/32.png',label:'Pizza'},{src:'assets/lunch-icons/33.png',label:'Hot dog'},
  {src:'assets/lunch-icons/34.png',label:'Yogurt'},{src:'assets/lunch-icons/35.png',label:'Sandwich'},
  {src:'assets/lunch-icons/36.png',label:'Pasta'},{src:'assets/lunch-icons/37.png',label:'Spaghetti'},
  {src:'assets/lunch-icons/38.png',label:'Rice bowl'},{src:'assets/lunch-icons/39.png',label:'Snack'},
  {src:'assets/lunch-icons/40.png',label:'Chips'},{src:'assets/lunch-icons/41.png',label:'Taco'}
];


const EDITABLE_TILE_HEADINGS={
  wordoftheday:'.widget-title',
  quoteoftheday:'.widget-title',
  colorpicker:'.widget-title',
  rainbow:'.widget-title',
  meditation:'.meditation-title',rainbowbreath:'.meditation-title',
  noise:'.nm-heading',
  squishy:'.squishy-heading',
  countdown:'.countdown-heading',
  coinflip:'.coinflip-heading',
  spreadsheet:'.sheet-heading',
  sentenceexpansion:'.sentence-heading',
  reminders:'.reminders-heading',
  glitterjar:'.glitter-jar-heading',
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

const TILE_HEADING_VISIBILITY_SELECTORS={
  ...EDITABLE_TILE_HEADINGS,
  essentialquestion:'.widget-title',
  popsiclesticks:'.popsicle-sticks-title',
  ambiencevideo:'.ambience-video-heading',
  lessonplannertile:'.lesson-plan-tile__header>div',
  visualschedule:'.visual-schedule-title'
};


const PHOTOBOOTH_FILTERS={
  normal:'none',
  mono:'grayscale(1) contrast(1.12)',
  sepia:'sepia(.82) saturate(1.18) contrast(1.04)',
  pop:'saturate(1.75) contrast(1.18) brightness(1.04)',
  cool:'saturate(1.12) contrast(1.06) hue-rotate(176deg)',
  warm:'sepia(.24) saturate(1.32) contrast(1.05) brightness(1.04)'
};
let boardPhotoDropReady=false;


const activeCameraStreams=new Map();


window.addEventListener('pagehide',releaseAllCameraStreams);


const WEATHER_CODES={
  0:['Clear sky','☀'],1:['Mostly clear','🌤'],2:['Partly cloudy','⛅'],3:['Overcast','☁'],
  45:['Fog','≋'],48:['Icy fog','≋'],51:['Light drizzle','🌦'],53:['Drizzle','🌦'],55:['Heavy drizzle','🌧'],
  56:['Freezing drizzle','🌧'],57:['Freezing drizzle','🌧'],61:['Light rain','🌦'],63:['Rain','🌧'],65:['Heavy rain','🌧'],
  66:['Freezing rain','🌧'],67:['Freezing rain','🌧'],71:['Light snow','🌨'],73:['Snow','🌨'],75:['Heavy snow','❄'],77:['Snow grains','❄'],
  80:['Rain showers','🌦'],81:['Rain showers','🌧'],82:['Heavy showers','🌧'],85:['Snow showers','🌨'],86:['Heavy snow showers','❄'],
  95:['Thunderstorm','⛈'],96:['Thunderstorm with hail','⛈'],99:['Thunderstorm with hail','⛈']
};
let localCoordinatesPromise=null;


const WEATHER_WHEEL_ITEMS=[
  {name:'Sunny',icon:'☀️',color:'#ffd66b'},
  {name:'Partly cloudy',icon:'🌤️',color:'#bcdff4'},
  {name:'Cloudy',icon:'☁️',color:'#b8c3d1'},
  {name:'Rainy',icon:'🌧️',color:'#77b6df'},
  {name:'Stormy',icon:'⛈️',color:'#8b82b8'},
  {name:'Snowy',icon:'🌨️',color:'#d8edf7'},
  {name:'Windy',icon:'💨',color:'#9bd8d0'},
  {name:'Foggy',icon:'🌫️',color:'#c8ced3'}
];
const SEASON_WHEEL_ITEMS=[
  {name:'Spring',icon:'🌷',color:'#a9dfa9'},
  {name:'Summer',icon:'☀️',color:'#ffd66b'},
  {name:'Fall',icon:'🍂',color:'#e9a064'},
  {name:'Winter',icon:'❄️',color:'#a9d8ee'}
];


const WORLD_MAP_REGIONS=[
  {id:'north-america',name:'North America',hemisphere:'Northern and Western Hemispheres',fact:'North America stretches from the Arctic to the tropics and includes 23 independent countries.'},
  {id:'south-america',name:'South America',hemisphere:'Mostly Southern and Western Hemispheres',fact:'South America is home to the Andes, the world’s longest continental mountain range.'},
  {id:'europe',name:'Europe',hemisphere:'Northern Hemisphere; Eastern and Western Hemispheres',fact:'Europe and Asia share one large landmass called Eurasia.'},
  {id:'africa',name:'Africa',hemisphere:'All four hemispheres',fact:'Both the Equator and Prime Meridian cross Africa, placing it in all four hemispheres.'},
  {id:'asia',name:'Asia',hemisphere:'Mostly Northern and Eastern Hemispheres',fact:'Asia is the largest continent by both land area and population.'},
  {id:'australia',name:'Australia',hemisphere:'Southern and Eastern Hemispheres',fact:'Australia is the smallest continent and is surrounded by the Indian and Pacific Oceans.'},
  {id:'antarctica',name:'Antarctica',hemisphere:'Southern Hemisphere',fact:'Antarctica surrounds the South Pole and is the coldest continent on Earth.'}
];


const COMPASS_PARTS={
  needle:{name:'Direction needle',copy:'The colored end points toward the selected heading. Grab the compass and spin it to practice finding directions.'},
  cardinal:{name:'Cardinal directions',copy:'North, east, south, and west are the four main—or cardinal—directions.'},
  intercardinal:{name:'Intercardinal directions',copy:'Northeast, southeast, southwest, and northwest sit halfway between the cardinal directions.'},
  degrees:{name:'Degree ring',copy:'A full turn is 360°. North is 0°, east is 90°, south is 180°, and west is 270°.'}
};


const SHAPES_TILE_DATA=[
  {id:'circle',name:'Circle',path:'M44 100 A76 76 0 0 1 196 100 A76 76 0 0 1 44 100 Z',sides:'0',vertices:'0',family:'Curved shape',fact:'A circle is perfectly round. Every point on its edge is the same distance from its center.'},
  {id:'square',name:'Square',path:'M48 28 H192 V172 H48 Z',sides:'4',vertices:'4',family:'Quadrilateral',fact:'A square has four equal sides and four right angles. Opposite sides are parallel.'},
  {id:'star',name:'Star',path:'M120 14 L145 70 L206 75 L159 115 L176 177 L120 143 L64 177 L81 115 L34 75 L95 70 Z',sides:'10',vertices:'10',family:'Concave polygon',fact:'This five-point star has ten straight sides and ten vertices: five outer points and five inner corners.'},
  {id:'triangle',name:'Triangle',path:'M120 22 L218 174 H22 Z',sides:'3',vertices:'3',family:'Triangle',fact:'Every triangle has three straight sides, three vertices, and interior angles that add to 180°.'},
  {id:'oval',name:'Oval',path:'M20 100 A100 58 0 0 1 220 100 A100 58 0 0 1 20 100 Z',sides:'0',vertices:'0',family:'Curved shape',fact:'An oval is a closed curved shape that is longer in one direction. It has no straight sides or vertices.'},
  {id:'diamond',name:'Diamond',path:'M120 16 L222 100 L120 184 L18 100 Z',sides:'4',vertices:'4',family:'Rhombus',fact:'A diamond, or rhombus, has four equal sides. Its opposite sides are parallel and opposite angles are equal.'},
  {id:'hexagon',name:'Hexagon',path:'M72 18 H168 L216 100 L168 182 H72 L24 100 Z',sides:'6',vertices:'6',family:'Polygon',fact:'A hexagon has six straight sides and six vertices. A regular hexagon has six equal sides and angles.'},
  {id:'rectangle',name:'Rectangle',path:'M24 52 H216 V148 H24 Z',sides:'4',vertices:'4',family:'Quadrilateral',fact:'A rectangle has four right angles. Its opposite sides are equal in length and parallel.'},
  {id:'pentagon',name:'Pentagon',path:'M120 14 L210 80 L176 186 H64 L30 80 Z',sides:'5',vertices:'5',family:'Polygon',fact:'A pentagon has five straight sides and five vertices. A regular pentagon has five equal sides.'},
  {id:'octagon',name:'Octagon',path:'M70 14 H170 L226 70 V130 L170 186 H70 L14 130 V70 Z',sides:'8',vertices:'8',family:'Polygon',fact:'An octagon has eight straight sides and eight vertices. Stop signs are shaped like regular octagons.'}
];


const VISUAL_SCHEDULE_ICONS=[
  {src:'assets/schedule-icons/15.png',label:'Lunch'},
  {src:'assets/schedule-icons/16.png',label:'Math'},
  {src:'assets/schedule-icons/17.png',label:'Reading'},
  {src:'assets/schedule-icons/18.png',label:'Recess'},
  {src:'assets/schedule-icons/19.png',label:'Science'},
  {src:'assets/schedule-icons/20.png',label:'Celebration'},
  {src:'assets/schedule-icons/21.png',label:'Morning'},
  {src:'assets/schedule-icons/22.png',label:'Arrival'},
  {src:'assets/schedule-icons/23.png',label:'Spanish'},
  {src:'assets/schedule-icons/24.png',label:'Writing'},
  {src:'assets/schedule-icons/25.png',label:'Art'},
  {src:'assets/schedule-icons/26.png',label:'PE'},
  {src:'assets/schedule-icons/27.png',label:'Rest'},
  {src:'assets/schedule-icons/28.png',label:'Computer'},
  {src:'assets/schedule-icons/29.png',label:'Music'}
];


const CALENDAR_STORAGE_KEY='teachertiles-calendar-events-v1';


window.TeacherTilesRefreshLessonPlannerTiles=()=>{
  const tiles=[...document.querySelectorAll('.lesson-plan-tile')];
  tiles.forEach(tile=>tile._refreshLessonPlans?.());
  if(tiles.length)notifyBoardChanged('lesson-planner-plans');
};


const TABLE_MAKER_COLORS=['#4f8fe8','#ef6f78','#f0b44d','#55ae7b','#8d6bdd','#38aab7','#e47ca8','#7e91a8','#dd7a43','#74a84f','#5965c9','#c35c84'];


workspace.addEventListener('dragover',e=>{const types=[...e.dataTransfer.types];if(types.includes('Files')||types.includes('text/uri-list')||types.includes('text/html')||types.includes('text/plain'))e.preventDefault()});
workspace.addEventListener('drop',e=>{if(e.target.closest('.image-module'))return;const src=getDraggedImageSource(e.dataTransfer);if(!src)return;e.preventDefault();const p=screenToBoard(e.clientX,e.clientY);const m=createModule('image',p.x,p.y);if(src.file)m?._setImage?.(src.file);else if(src.url)m?._setImageUrl?.(src.url,{attribution:src.attribution})});

const THEME_STORAGE_KEY='modular-space-theme';
const TEACHERTILES_THEMES=new Set([
  "outer-space-light","outer-space","frosted-window-light","frosted-window",
  "basic-red","basic-orange","basic-yellow","basic-green","basic-blue","basic-indigo","basic-violet","bamboo-yellow","bamboo-brown","bamboo-green",
  'underwater-ocean','rainy-window','underwater-ocean-light','rainy-window-light',
  'light','dark','gray',
  'pastel-red','pastel-yellow','pastel-green','pastel-blue','pastel-lilac',
  'polka-berry','polka-sunshine','polka-mint','polka-sky','polka-lavender',
  'programmer-green','programmer-red','programmer-yellow','programmer-blue',
  'wood-oak','wood-spruce','wood-redwood','wood-cherry',
  'notebook-red','notebook-blue','notebook-black',
  'cardboard-kraft','cardboard-white','cardboard-blue','cardboard-rose',
  'metal-copper','metal-iron','metal-dark-steel','metal-cobalt',
  'cosmos-nebula','cosmos-pulsar','cosmos-milky-way','cosmos-red-dwarf',
  'corkboard-red','corkboard-blue','corkboard-green','corkboard-gold'
]);
const THEME_BODY_CLASSES=[
  "theme-outer-space-light","theme-outer-space","theme-frosted-window-light","theme-frosted-window",
  "theme-basic-red","theme-basic-orange","theme-basic-yellow","theme-basic-green","theme-basic-blue","theme-basic-indigo","theme-basic-violet","theme-bamboo-yellow","theme-bamboo-brown","theme-bamboo-green",
  'theme-underwater-ocean','theme-rainy-window','theme-underwater-ocean-light','theme-rainy-window-light',
  'dark','theme-gray',
  'theme-pastel-red','theme-pastel-yellow','theme-pastel-green','theme-pastel-blue','theme-pastel-lilac',
  'theme-polka-berry','theme-polka-sunshine','theme-polka-mint','theme-polka-sky','theme-polka-lavender',
  'theme-programmer-green','theme-programmer-red','theme-programmer-yellow','theme-programmer-blue',
  'theme-wood-oak','theme-wood-spruce','theme-wood-redwood','theme-wood-cherry',
  'theme-notebook-red','theme-notebook-blue','theme-notebook-black',
  'theme-cardboard-kraft','theme-cardboard-white','theme-cardboard-blue','theme-cardboard-rose',
  'theme-metal-copper','theme-metal-iron','theme-metal-dark-steel','theme-metal-cobalt',
  'theme-cosmos-nebula','theme-cosmos-pulsar','theme-cosmos-milky-way','theme-cosmos-red-dwarf',
  'theme-corkboard-red','theme-corkboard-blue','theme-corkboard-green','theme-corkboard-gold'
];


const THEME_ENTITLEMENT_PREFIXES=[
  ['outer-space','theme-outer-space'],['frosted-window','theme-frosted-window'],
  ['basic-','theme-basic'],
  ['bamboo-','theme-bamboo'],
  ['underwater-','theme-underwater'],['rainy-','theme-rainy-window'],
  ['pastel-','theme-pastel'],['polka-','theme-polka-dot'],['programmer-','theme-programmer'],
  ['wood-','theme-wood'],['notebook-','theme-notebook'],['cardboard-','theme-cardboard'],
  ['metal-','theme-metal'],['cosmos-','theme-cosmos'],['corkboard-','theme-corkboard']
];
const SHELF_ENTITLEMENTS={
  'outer-space-theme-pack':'theme-outer-space','outer-space-theme-fan':'theme-outer-space','frosted-window-theme-pack':'theme-frosted-window','frosted-window-theme-fan':'theme-frosted-window',
  'basic-theme-pack':'theme-basic','basic-theme-fan':'theme-basic',
  'bamboo-theme-pack':'theme-bamboo','bamboo-theme-fan':'theme-bamboo',
  'underwater-theme-pack':'theme-underwater','underwater-theme-fan':'theme-underwater',
  'rainy-window-theme-pack':'theme-rainy-window','rainy-window-theme-fan':'theme-rainy-window',
  'pastel-theme-pack':'theme-pastel','pastel-theme-fan':'theme-pastel',
  'polka-dot-theme-pack':'theme-polka-dot','polka-dot-theme-fan':'theme-polka-dot',
  'programmer-theme-pack':'theme-programmer','programmer-theme-fan':'theme-programmer',
  'wood-theme-pack':'theme-wood','wood-theme-fan':'theme-wood',
  'notebook-theme-pack':'theme-notebook','notebook-theme-fan':'theme-notebook',
  'cardboard-theme-pack':'theme-cardboard','cardboard-theme-fan':'theme-cardboard',
  'metal-theme-pack':'theme-metal','metal-theme-fan':'theme-metal',
  'cosmos-theme-pack':'theme-cosmos','cosmos-theme-fan':'theme-cosmos',
  'corkboard-theme-pack':'theme-corkboard','corkboard-theme-fan':'theme-corkboard',
  'emoji-sticker-pack':'sticker-emoji','emoji-sticker-drawer':'sticker-emoji',
  'nature-emojis-sticker-pack':'sticker-nature-emojis','nature-emojis-sticker-drawer':'sticker-nature-emojis',
  'animal-emojis-sticker-pack':'sticker-animal-emojis','animal-emojis-sticker-drawer':'sticker-animal-emojis',
  'more-faces-sticker-pack':'sticker-more-faces','more-faces-sticker-drawer':'sticker-more-faces',
  'symbols-sticker-pack':'sticker-symbols','symbols-sticker-drawer':'sticker-symbols',
  'food-sticker-pack':'sticker-food','food-sticker-drawer':'sticker-food',
  'colored-hearts-sticker-pack':'sticker-colored-hearts','colored-hearts-sticker-drawer':'sticker-colored-hearts',
  'decorative-hearts-sticker-pack':'sticker-decorative-hearts','decorative-hearts-sticker-drawer':'sticker-decorative-hearts',
  'country-flags-sticker-pack':'sticker-country-flags','country-flags-sticker-drawer':'sticker-country-flags'
};


window.addEventListener('teachertiles:accountchange',syncCosmeticEntitlements);


let activeBoardTheme='light';


applyTeacherTheme('light',{persist:false});
window.TeacherTilesTheme={get selected(){return activeBoardTheme},showBoard:()=>applyTeacherTheme(activeBoardTheme,{persist:false,presentation:true}),hideBoard:()=>applyTeacherTheme('light',{persist:false,presentation:true})};

fullscreenToggle.addEventListener('click',async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen()}catch{}});
document.addEventListener('fullscreenchange',()=>{
  const fullscreenElement=document.fullscreenElement;
  const active=Boolean(fullscreenElement);
  fullscreenToggle.classList.toggle('is-fullscreen-active',active);
  fullscreenToggle.setAttribute('aria-label',active?'Exit fullscreen':'Enter fullscreen');
  syncTileFullscreenControls();syncPinnedTilesToCamera();
  {
    document.querySelectorAll('.module').forEach(module=>{
      if(module._tileFullscreenGeometry)restoreTileFullscreenGeometry(module);
    });
  }
});
// Viewport resizing does not change coordinates on the fixed-size board. Fullscreen
// layout can briefly report offsetLeft/Top as zero; never persist those offsets.
window.addEventListener('resize',()=>syncPinnedTilesToCamera());


populateGeneratedStickerPacks();
setupCollectionShelf();


setupCustomizeLauncher();


const PERIODIC_ELEMENTS=[{"n":1,"symbol":"H","name":"Hydrogen","mass":"1.008","period":1,"group":1,"row":1,"col":1,"category":"Reactive nonmetal","categoryKey":"reactive-nonmetal","block":"s"},{"n":2,"symbol":"He","name":"Helium","mass":"4.003","period":1,"group":18,"row":1,"col":18,"category":"Noble gas","categoryKey":"noble-gas","block":"p"},{"n":3,"symbol":"Li","name":"Lithium","mass":"6.941","period":2,"group":1,"row":2,"col":1,"category":"Alkali metal","categoryKey":"alkali-metal","block":"s"},{"n":4,"symbol":"Be","name":"Beryllium","mass":"9.012","period":2,"group":2,"row":2,"col":2,"category":"Alkaline earth metal","categoryKey":"alkaline-earth-metal","block":"s"},{"n":5,"symbol":"B","name":"Boron","mass":"10.812","period":2,"group":13,"row":2,"col":13,"category":"Metalloid","categoryKey":"metalloid","block":"p"},{"n":6,"symbol":"C","name":"Carbon","mass":"12.011","period":2,"group":14,"row":2,"col":14,"category":"Reactive nonmetal","categoryKey":"reactive-nonmetal","block":"p"},{"n":7,"symbol":"N","name":"Nitrogen","mass":"14.007","period":2,"group":15,"row":2,"col":15,"category":"Reactive nonmetal","categoryKey":"reactive-nonmetal","block":"p"},{"n":8,"symbol":"O","name":"Oxygen","mass":"15.999","period":2,"group":16,"row":2,"col":16,"category":"Reactive nonmetal","categoryKey":"reactive-nonmetal","block":"p"},{"n":9,"symbol":"F","name":"Fluorine","mass":"18.998","period":2,"group":17,"row":2,"col":17,"category":"Halogen","categoryKey":"halogen","block":"p"},{"n":10,"symbol":"Ne","name":"Neon","mass":"20.18","period":2,"group":18,"row":2,"col":18,"category":"Noble gas","categoryKey":"noble-gas","block":"p"},{"n":11,"symbol":"Na","name":"Sodium","mass":"22.99","period":3,"group":1,"row":3,"col":1,"category":"Alkali metal","categoryKey":"alkali-metal","block":"s"},{"n":12,"symbol":"Mg","name":"Magnesium","mass":"24.305","period":3,"group":2,"row":3,"col":2,"category":"Alkaline earth metal","categoryKey":"alkaline-earth-metal","block":"s"},{"n":13,"symbol":"Al","name":"Aluminium","mass":"26.982","period":3,"group":13,"row":3,"col":13,"category":"Post-transition metal","categoryKey":"post-transition-metal","block":"p"},{"n":14,"symbol":"Si","name":"Silicon","mass":"28.086","period":3,"group":14,"row":3,"col":14,"category":"Metalloid","categoryKey":"metalloid","block":"p"},{"n":15,"symbol":"P","name":"Phosphorus","mass":"30.974","period":3,"group":15,"row":3,"col":15,"category":"Reactive nonmetal","categoryKey":"reactive-nonmetal","block":"p"},{"n":16,"symbol":"S","name":"Sulfur","mass":"32.067","period":3,"group":16,"row":3,"col":16,"category":"Reactive nonmetal","categoryKey":"reactive-nonmetal","block":"p"},{"n":17,"symbol":"Cl","name":"Chlorine","mass":"35.453","period":3,"group":17,"row":3,"col":17,"category":"Halogen","categoryKey":"halogen","block":"p"},{"n":18,"symbol":"Ar","name":"Argon","mass":"39.948","period":3,"group":18,"row":3,"col":18,"category":"Noble gas","categoryKey":"noble-gas","block":"p"},{"n":19,"symbol":"K","name":"Potassium","mass":"39.098","period":4,"group":1,"row":4,"col":1,"category":"Alkali metal","categoryKey":"alkali-metal","block":"s"},{"n":20,"symbol":"Ca","name":"Calcium","mass":"40.078","period":4,"group":2,"row":4,"col":2,"category":"Alkaline earth metal","categoryKey":"alkaline-earth-metal","block":"s"},{"n":21,"symbol":"Sc","name":"Scandium","mass":"44.956","period":4,"group":3,"row":4,"col":3,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":22,"symbol":"Ti","name":"Titanium","mass":"47.867","period":4,"group":4,"row":4,"col":4,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":23,"symbol":"V","name":"Vanadium","mass":"50.944","period":4,"group":5,"row":4,"col":5,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":24,"symbol":"Cr","name":"Chromium","mass":"51.996","period":4,"group":6,"row":4,"col":6,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":25,"symbol":"Mn","name":"Manganese","mass":"54.938","period":4,"group":7,"row":4,"col":7,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":26,"symbol":"Fe","name":"Iron","mass":"55.845","period":4,"group":8,"row":4,"col":8,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":27,"symbol":"Co","name":"Cobalt","mass":"58.933","period":4,"group":9,"row":4,"col":9,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":28,"symbol":"Ni","name":"Nickel","mass":"58.693","period":4,"group":10,"row":4,"col":10,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":29,"symbol":"Cu","name":"Copper","mass":"63.546","period":4,"group":11,"row":4,"col":11,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":30,"symbol":"Zn","name":"Zinc","mass":"65.39","period":4,"group":12,"row":4,"col":12,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":31,"symbol":"Ga","name":"Gallium","mass":"69.723","period":4,"group":13,"row":4,"col":13,"category":"Post-transition metal","categoryKey":"post-transition-metal","block":"p"},{"n":32,"symbol":"Ge","name":"Germanium","mass":"72.61","period":4,"group":14,"row":4,"col":14,"category":"Metalloid","categoryKey":"metalloid","block":"p"},{"n":33,"symbol":"As","name":"Arsenic","mass":"74.922","period":4,"group":15,"row":4,"col":15,"category":"Metalloid","categoryKey":"metalloid","block":"p"},{"n":34,"symbol":"Se","name":"Selenium","mass":"78.96","period":4,"group":16,"row":4,"col":16,"category":"Reactive nonmetal","categoryKey":"reactive-nonmetal","block":"p"},{"n":35,"symbol":"Br","name":"Bromine","mass":"79.904","period":4,"group":17,"row":4,"col":17,"category":"Halogen","categoryKey":"halogen","block":"p"},{"n":36,"symbol":"Kr","name":"Krypton","mass":"83.8","period":4,"group":18,"row":4,"col":18,"category":"Noble gas","categoryKey":"noble-gas","block":"p"},{"n":37,"symbol":"Rb","name":"Rubidium","mass":"85.468","period":5,"group":1,"row":5,"col":1,"category":"Alkali metal","categoryKey":"alkali-metal","block":"s"},{"n":38,"symbol":"Sr","name":"Strontium","mass":"87.62","period":5,"group":2,"row":5,"col":2,"category":"Alkaline earth metal","categoryKey":"alkaline-earth-metal","block":"s"},{"n":39,"symbol":"Y","name":"Yttrium","mass":"88.906","period":5,"group":3,"row":5,"col":3,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":40,"symbol":"Zr","name":"Zirconium","mass":"91.224","period":5,"group":4,"row":5,"col":4,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":41,"symbol":"Nb","name":"Niobium","mass":"92.906","period":5,"group":5,"row":5,"col":5,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":42,"symbol":"Mo","name":"Molybdenum","mass":"95.94","period":5,"group":6,"row":5,"col":6,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":43,"symbol":"Tc","name":"Technetium","mass":"98","period":5,"group":7,"row":5,"col":7,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":44,"symbol":"Ru","name":"Ruthenium","mass":"101.07","period":5,"group":8,"row":5,"col":8,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":45,"symbol":"Rh","name":"Rhodium","mass":"102.906","period":5,"group":9,"row":5,"col":9,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":46,"symbol":"Pd","name":"Palladium","mass":"106.42","period":5,"group":10,"row":5,"col":10,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":47,"symbol":"Ag","name":"Silver","mass":"107.868","period":5,"group":11,"row":5,"col":11,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":48,"symbol":"Cd","name":"Cadmium","mass":"112.412","period":5,"group":12,"row":5,"col":12,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":49,"symbol":"In","name":"Indium","mass":"114.818","period":5,"group":13,"row":5,"col":13,"category":"Post-transition metal","categoryKey":"post-transition-metal","block":"p"},{"n":50,"symbol":"Sn","name":"Tin","mass":"118.711","period":5,"group":14,"row":5,"col":14,"category":"Post-transition metal","categoryKey":"post-transition-metal","block":"p"},{"n":51,"symbol":"Sb","name":"Antimony","mass":"121.76","period":5,"group":15,"row":5,"col":15,"category":"Metalloid","categoryKey":"metalloid","block":"p"},{"n":52,"symbol":"Te","name":"Tellurium","mass":"127.6","period":5,"group":16,"row":5,"col":16,"category":"Metalloid","categoryKey":"metalloid","block":"p"},{"n":53,"symbol":"I","name":"Iodine","mass":"126.904","period":5,"group":17,"row":5,"col":17,"category":"Halogen","categoryKey":"halogen","block":"p"},{"n":54,"symbol":"Xe","name":"Xenon","mass":"131.29","period":5,"group":18,"row":5,"col":18,"category":"Noble gas","categoryKey":"noble-gas","block":"p"},{"n":55,"symbol":"Cs","name":"Caesium","mass":"132.905","period":6,"group":1,"row":6,"col":1,"category":"Alkali metal","categoryKey":"alkali-metal","block":"s"},{"n":56,"symbol":"Ba","name":"Barium","mass":"137.328","period":6,"group":2,"row":6,"col":2,"category":"Alkaline earth metal","categoryKey":"alkaline-earth-metal","block":"s"},{"n":57,"symbol":"La","name":"Lanthanum","mass":"138.906","period":6,"group":3,"row":6,"col":3,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":58,"symbol":"Ce","name":"Cerium","mass":"140.116","period":6,"group":null,"row":8,"col":4,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":59,"symbol":"Pr","name":"Praseodymium","mass":"140.908","period":6,"group":null,"row":8,"col":5,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":60,"symbol":"Nd","name":"Neodymium","mass":"144.24","period":6,"group":null,"row":8,"col":6,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":61,"symbol":"Pm","name":"Promethium","mass":"145","period":6,"group":null,"row":8,"col":7,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":62,"symbol":"Sm","name":"Samarium","mass":"150.36","period":6,"group":null,"row":8,"col":8,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":63,"symbol":"Eu","name":"Europium","mass":"151.964","period":6,"group":null,"row":8,"col":9,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":64,"symbol":"Gd","name":"Gadolinium","mass":"157.25","period":6,"group":null,"row":8,"col":10,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":65,"symbol":"Tb","name":"Terbium","mass":"158.925","period":6,"group":null,"row":8,"col":11,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":66,"symbol":"Dy","name":"Dysprosium","mass":"162.5","period":6,"group":null,"row":8,"col":12,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":67,"symbol":"Ho","name":"Holmium","mass":"164.93","period":6,"group":null,"row":8,"col":13,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":68,"symbol":"Er","name":"Erbium","mass":"167.26","period":6,"group":null,"row":8,"col":14,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":69,"symbol":"Tm","name":"Thulium","mass":"168.934","period":6,"group":null,"row":8,"col":15,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":70,"symbol":"Yb","name":"Ytterbium","mass":"173.04","period":6,"group":null,"row":8,"col":16,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":71,"symbol":"Lu","name":"Lutetium","mass":"174.967","period":6,"group":null,"row":8,"col":17,"category":"Lanthanide","categoryKey":"lanthanide","block":"f"},{"n":72,"symbol":"Hf","name":"Hafnium","mass":"178.49","period":6,"group":4,"row":6,"col":4,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":73,"symbol":"Ta","name":"Tantalum","mass":"180.948","period":6,"group":5,"row":6,"col":5,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":74,"symbol":"W","name":"Tungsten","mass":"183.84","period":6,"group":6,"row":6,"col":6,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":75,"symbol":"Re","name":"Rhenium","mass":"186.207","period":6,"group":7,"row":6,"col":7,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":76,"symbol":"Os","name":"Osmium","mass":"190.23","period":6,"group":8,"row":6,"col":8,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":77,"symbol":"Ir","name":"Iridium","mass":"192.217","period":6,"group":9,"row":6,"col":9,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":78,"symbol":"Pt","name":"Platinum","mass":"195.078","period":6,"group":10,"row":6,"col":10,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":79,"symbol":"Au","name":"Gold","mass":"196.967","period":6,"group":11,"row":6,"col":11,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":80,"symbol":"Hg","name":"Mercury","mass":"200.59","period":6,"group":12,"row":6,"col":12,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":81,"symbol":"Tl","name":"Thallium","mass":"204.383","period":6,"group":13,"row":6,"col":13,"category":"Post-transition metal","categoryKey":"post-transition-metal","block":"p"},{"n":82,"symbol":"Pb","name":"Lead","mass":"207.2","period":6,"group":14,"row":6,"col":14,"category":"Post-transition metal","categoryKey":"post-transition-metal","block":"p"},{"n":83,"symbol":"Bi","name":"Bismuth","mass":"208.98","period":6,"group":15,"row":6,"col":15,"category":"Post-transition metal","categoryKey":"post-transition-metal","block":"p"},{"n":84,"symbol":"Po","name":"Polonium","mass":"209","period":6,"group":16,"row":6,"col":16,"category":"Post-transition metal","categoryKey":"post-transition-metal","block":"p"},{"n":85,"symbol":"At","name":"Astatine","mass":"210","period":6,"group":17,"row":6,"col":17,"category":"Halogen","categoryKey":"halogen","block":"p"},{"n":86,"symbol":"Rn","name":"Radon","mass":"222","period":6,"group":18,"row":6,"col":18,"category":"Noble gas","categoryKey":"noble-gas","block":"p"},{"n":87,"symbol":"Fr","name":"Francium","mass":"223","period":7,"group":1,"row":7,"col":1,"category":"Alkali metal","categoryKey":"alkali-metal","block":"s"},{"n":88,"symbol":"Ra","name":"Radium","mass":"226","period":7,"group":2,"row":7,"col":2,"category":"Alkaline earth metal","categoryKey":"alkaline-earth-metal","block":"s"},{"n":89,"symbol":"Ac","name":"Actinium","mass":"227","period":7,"group":3,"row":7,"col":3,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":90,"symbol":"Th","name":"Thorium","mass":"232.038","period":7,"group":null,"row":9,"col":4,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":91,"symbol":"Pa","name":"Protactinium","mass":"231.036","period":7,"group":null,"row":9,"col":5,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":92,"symbol":"U","name":"Uranium","mass":"238.029","period":7,"group":null,"row":9,"col":6,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":93,"symbol":"Np","name":"Neptunium","mass":"237","period":7,"group":null,"row":9,"col":7,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":94,"symbol":"Pu","name":"Plutonium","mass":"244","period":7,"group":null,"row":9,"col":8,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":95,"symbol":"Am","name":"Americium","mass":"243","period":7,"group":null,"row":9,"col":9,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":96,"symbol":"Cm","name":"Curium","mass":"247","period":7,"group":null,"row":9,"col":10,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":97,"symbol":"Bk","name":"Berkelium","mass":"247","period":7,"group":null,"row":9,"col":11,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":98,"symbol":"Cf","name":"Californium","mass":"251","period":7,"group":null,"row":9,"col":12,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":99,"symbol":"Es","name":"Einsteinium","mass":"252","period":7,"group":null,"row":9,"col":13,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":100,"symbol":"Fm","name":"Fermium","mass":"257","period":7,"group":null,"row":9,"col":14,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":101,"symbol":"Md","name":"Mendelevium","mass":"258","period":7,"group":null,"row":9,"col":15,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":102,"symbol":"No","name":"Nobelium","mass":"259","period":7,"group":null,"row":9,"col":16,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":103,"symbol":"Lr","name":"Lawrencium","mass":"262","period":7,"group":null,"row":9,"col":17,"category":"Actinide","categoryKey":"actinide","block":"f"},{"n":104,"symbol":"Rf","name":"Rutherfordium","mass":"267","period":7,"group":4,"row":7,"col":4,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":105,"symbol":"Db","name":"Dubnium","mass":"268","period":7,"group":5,"row":7,"col":5,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":106,"symbol":"Sg","name":"Seaborgium","mass":"269","period":7,"group":6,"row":7,"col":6,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":107,"symbol":"Bh","name":"Bohrium","mass":"270","period":7,"group":7,"row":7,"col":7,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":108,"symbol":"Hs","name":"Hassium","mass":"269","period":7,"group":8,"row":7,"col":8,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":109,"symbol":"Mt","name":"Meitnerium","mass":"278","period":7,"group":9,"row":7,"col":9,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":110,"symbol":"Ds","name":"Darmstadtium","mass":"281","period":7,"group":10,"row":7,"col":10,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":111,"symbol":"Rg","name":"Roentgenium","mass":"281","period":7,"group":11,"row":7,"col":11,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":112,"symbol":"Cn","name":"Copernicium","mass":"285","period":7,"group":12,"row":7,"col":12,"category":"Transition metal","categoryKey":"transition-metal","block":"d"},{"n":113,"symbol":"Nh","name":"Nihonium","mass":"284","period":7,"group":13,"row":7,"col":13,"category":"Post-transition metal","categoryKey":"post-transition-metal","block":"p"},{"n":114,"symbol":"Fl","name":"Flerovium","mass":"289","period":7,"group":14,"row":7,"col":14,"category":"Post-transition metal","categoryKey":"post-transition-metal","block":"p"},{"n":115,"symbol":"Mc","name":"Moscovium","mass":"288","period":7,"group":15,"row":7,"col":15,"category":"Post-transition metal","categoryKey":"post-transition-metal","block":"p"},{"n":116,"symbol":"Lv","name":"Livermorium","mass":"293","period":7,"group":16,"row":7,"col":16,"category":"Post-transition metal","categoryKey":"post-transition-metal","block":"p"},{"n":117,"symbol":"Ts","name":"Tennessine","mass":"292","period":7,"group":17,"row":7,"col":17,"category":"Halogen","categoryKey":"halogen","block":"p"},{"n":118,"symbol":"Og","name":"Oganesson","mass":"294","period":7,"group":18,"row":7,"col":18,"category":"Noble gas","categoryKey":"noble-gas","block":"p"}];

const CVC_WORD_SETS={"a":["cab","dab","jab","lab","tab","nab","tad","bad","dad","had","lad","pad","mad","rad","sad","wag","bag","gag","lag","nag","sag","rag","tag","hag","Sam","dam","ham"],"e":["bed","wed","fed","led","red","Ted","zed","Jed","Ned","beg","leg","peg","keg","Meg","neg","Ben","den","men","pen","ten","hen","Zen","Ken","Yen","bet","get","jet"],"i":["bib","fib","rib","jib","sib","bid","did","hid","kid","lid","rid","big","dig","fig","pig","rig","wig","jig","zig","dim","him","Kim","rim","Tim","Jim","Vim","bin"],"o":["cob","gob","job","lob","mob","rob","sob","dog","fog","jog","log","cop","hop","mop","pop","top","cot","dot","hot","not","pot","God","rod","pod","mod","cod","bop"],"u":["cub","hub","rub","pug","sub","tub","nub","rug","pub","dub","bud","tug","dud","mud","cud","gum","bug","dug","hug","hum","jug","lug","mug","mum"]};


const HIGH_FREQUENCY_WORD_SETS={"k":["can","I","the","we","see","a","like","to","and","go","you","do","my","are","with","he","is","little","she","was","for","have","of","they","said","want","here","me","this","what","help","too","has","play","where","look","good","who","come","does"],"1":["a","can","do","go","has","the","I","like","to","you","this","is","my","look","little","where","here","play","we","one","me","she","with","for","and","have","said","see","was","does","not","school","what","down","out","up","very","be","come","good","pull","fun","make","they","too","jump","move","run","two","again","help","new","there","use","could","live","then","three","eat","no","of","under","who","all","call","day","her","want","around","by","many","place","walk","away","now","some","today","way","why","green","grow","pretty","should","together","water","any","from","happy","once","so","upon","ago","boy","girl","how","old","people","after","buy","done","every","soon","work","about","animal","carry","eight","give","our","because","blue","into","or","other","small","find","food","more","over","start","warm","caught","flew","know","laugh","listen","were","found","hard","near","woman","would","write","four","large","none","only","put","round","another","climb","full","great","poor","through","began","better","guess","learn","right","sure","color","early","instead","nothing","oh","thought","above","build","fall","knew","money","toward","answer","brought","busy","door","enough","eyes","brother","father","friend","love","mother","picture","been","children","month","question","their","year","before","front","heard","push","tomorrow","your","favorite","few","gone","surprise","wonder","young"],"2":["ball","blue","both","even","for","help","put","there","why","yellow","could","find","funny","green","how","little","one","or","see","sounds","boy","by","girl","he","here","she","small","want","were","what","another","done","into","move","now","show","too","water","year","your","all","any","goes","new","number","other","right","says","understands","work"],"3plus":["a","about","after","again","all","also","always","am","an","and","another","any","are","around","as","ask","at","ate","away","back","be","because","been","before","best","better","big","black","blue","both","think","this","those","three","through","time","today","together","under","upon","very","want","water","went","where","which","would","write","years","yellow","yes","you","your"]};


const BOARD_SAVE_SCHEMA_VERSION=2;
const BOARD_TRANSIENT_CLASSES=new Set([
  'is-resize-threshold',
  'is-selected','is-over-trash','is-dragging','trash-delete','sticker-placed',
  'is-sticker-resizing','is-sticker-rotating','is-snap-grouped','is-tug-armed','stoplight-pop','is-flipping',
  'is-appearance-open','is-fitting','is-shuffling','is-dragover','is-drop-target','is-meter-filling','is-meter-filled','is-collection-filled','has-tile-settings-open','is-pointer-over','has-keyboard-focus',
  'is-delete-hotzone','is-tile-options-hotzone','is-tab-options-hotzone','is-tile-fullscreen','is-tile-pinned','is-composing-reminder'
]);
let activeTeacherTilesBoardId='';


let unrestoredBoardObjects=[];


workspace.addEventListener('input',event=>{
  if(event.target instanceof Element&&event.target.closest('.module')&&!event.target.closest('[data-skip-board-save]'))notifyBoardChanged('input');
},true);
workspace.addEventListener('change',event=>{
  if(event.target instanceof Element&&event.target.closest('.module')&&!event.target.closest('[data-skip-board-save]'))notifyBoardChanged('change');
},true);
workspace.addEventListener('click',event=>{
  if(event.target instanceof Element&&event.target.closest('.module')&&!event.target.closest('[data-skip-board-save]'))setTimeout(()=>notifyBoardChanged('module-action'),0);
},true);
document.addEventListener('pointerup',event=>{
  const target=event.target;
  if(target instanceof Element&&!target.closest('[data-skip-board-save]')&&(target.closest('.module')||target.classList.contains('board-drawing-canvas')))notifyBoardChanged('pointer-action');
},true);

window.TeacherTilesBoard={
  schemaVersion:BOARD_SAVE_SCHEMA_VERSION,
  capture:captureTeacherTilesBoard,
  load:loadTeacherTilesBoard,
  blank:blankTeacherTilesBoard,
  clear:()=>withBoardChangesSuspended(clearTeacherTilesBoard),
  isTypeAvailable:boardTypeAvailable,
  isStickerAvailable:boardStickerAvailable,
  setActiveBoardId(id){activeTeacherTilesBoardId=String(id||'')},
  get activeBoardId(){return activeTeacherTilesBoardId},
  markChanged:notifyBoardChanged
};


if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',setupChangelog,{once:true});
}else{
  setupChangelog();
}

(function setupTeacherTilesIntro() {
  const intro = document.getElementById('teachertiles-intro');
  if (!intro) return;

  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const holdTime = reduced ? 220 : 1260;

  if (!reduced) window.setTimeout(() => playUiSfx('intro'), 830);

  window.setTimeout(() => {
    intro.classList.add('is-leaving');
    window.setTimeout(() => intro.remove(), reduced ? 150 : 430);
  }, holdTime);
})();


(() => {
  const topRightTray = document.querySelector('.workspace-controls');
  const bottomLeftTray = document.querySelector('.workspace-upcoming-controls');
  const topLeftButton = document.getElementById('boards-toggle');
  if (!topRightTray || !bottomLeftTray || !topLeftButton) return;

  const FULL_X = 250;
  const FULL_Y = 175;
  const NEAR_X = 330;
  const NEAR_Y = 235;
  let pointerX = -1;
  let pointerY = -1;

  const setState = (target, full, near) => {
    target.classList.toggle('is-revealed', full);
    target.classList.toggle('is-near', !full && near);
  };

  const hasKeyboardFocus = target => lastUiInteractionWasKeyboard && target.matches(':focus-within');
  const update = () => {
    const pointerKnown = pointerX >= 0 && pointerY >= 0;
    const topRightFull = pointerKnown && pointerX >= window.innerWidth - FULL_X && pointerY <= FULL_Y;
    const topRightNear = pointerKnown && pointerX >= window.innerWidth - NEAR_X && pointerY <= NEAR_Y;
    const bottomLeftFull = pointerKnown && pointerX <= FULL_X && pointerY >= window.innerHeight - FULL_Y;
    const bottomLeftNear = pointerKnown && pointerX <= NEAR_X && pointerY >= window.innerHeight - NEAR_Y;
    const topLeftFull = pointerKnown && pointerX <= FULL_X && pointerY <= FULL_Y;
    const topLeftNear = pointerKnown && pointerX <= NEAR_X && pointerY <= NEAR_Y;

    setState(topRightTray, topRightFull || topRightTray.matches(':hover') || hasKeyboardFocus(topRightTray), topRightNear);
    setState(bottomLeftTray, bottomLeftFull || bottomLeftTray.matches(':hover') || hasKeyboardFocus(bottomLeftTray), bottomLeftNear);
    setState(topLeftButton, topLeftFull || topLeftButton.matches(':hover') || (lastUiInteractionWasKeyboard && topLeftButton.matches(':focus-visible')), topLeftNear);
  };

  document.addEventListener('pointermove', event => {
    if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    pointerX = event.clientX;
    pointerY = event.clientY;
    update();
  }, { passive:true });

  document.addEventListener('pointerdown', event => {
    if (!event.pointerType || event.pointerType === 'mouse' || event.pointerType === 'pen') {
      pointerX = event.clientX;
      pointerY = event.clientY;
    }
    requestAnimationFrame(update);
  }, { passive:true });

  document.addEventListener('focusin', () => requestAnimationFrame(update));
  document.addEventListener('focusout', () => requestAnimationFrame(update));
  window.addEventListener('resize', update);
  window.addEventListener('blur', () => {
    pointerX = -1;
    pointerY = -1;
    setState(topRightTray, false, false);
    setState(bottomLeftTray, false, false);
    setState(topLeftButton, false, false);
  });

  topRightTray.addEventListener('pointerenter', () => setState(topRightTray, true, true));
  bottomLeftTray.addEventListener('pointerenter', () => setState(bottomLeftTray, true, true));
  topLeftButton.addEventListener('pointerenter', () => setState(topLeftButton, true, true));
  topRightTray.addEventListener('pointerleave', () => requestAnimationFrame(update));
  bottomLeftTray.addEventListener('pointerleave', () => requestAnimationFrame(update));
  topLeftButton.addEventListener('pointerleave', () => requestAnimationFrame(update));
})();

(() => {
  const IDLE_DELAY=10000;
  let idleTimer=0;

  const clearIdleTimer=()=>{
    if(idleTimer)clearTimeout(idleTimer);
    idleTimer=0;
  };
  const boardHasTiles=()=>Boolean(workspace.querySelector('.module'));
  const clearIdleModuleState=()=>{
    workspace.querySelectorAll('.module.is-idle-unhovered').forEach(module=>module.classList.remove('is-idle-unhovered'));
  };
  const wake=()=>{
    clearIdleTimer();
    document.body.classList.remove('is-board-idle');
    clearIdleModuleState();
  };
  const enterIdle=()=>{
    idleTimer=0;
    if(!boardHasTiles()){
      wake();
      return;
    }
    if(activeModuleTextEditor)exitModuleTextEdit(activeModuleTextEditor);
    const active=document.activeElement;
    if(active instanceof HTMLElement&&workspace.contains(active))active.blur();
    clearSelection();
    for(const module of workspace.querySelectorAll('.module')){
      module.classList.remove('is-pointer-over','has-keyboard-focus');
      module.classList.add('is-idle-unhovered');
    }
    document.body.classList.add('is-board-idle');
  };
  const arm=()=>{
    clearIdleTimer();
    if(!boardHasTiles()){
      wake();
      return;
    }
    idleTimer=setTimeout(enterIdle,IDLE_DELAY);
  };
  const activity=()=>{
    wake();
    arm();
  };

  document.addEventListener('pointermove',activity,{capture:true,passive:true});
  document.addEventListener('pointerdown',activity,{capture:true,passive:true});
  document.addEventListener('wheel',activity,{capture:true,passive:true});
  document.addEventListener('keydown',activity,true);
  document.addEventListener('touchstart',activity,{capture:true,passive:true});
  document.addEventListener('focusin',activity,true);
  document.addEventListener('input',activity,true);
  window.addEventListener('focus',activity);
  window.addEventListener('blur',wake);

  new MutationObserver(()=>{
    if(!boardHasTiles())wake();
    else if(!document.body.classList.contains('is-board-idle'))arm();
  }).observe(workspace,{childList:true});
})();


if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setupTeacherTilesShop,{once:true});else setupTeacherTilesShop();

window.addEventListener('teachertiles:collectionpreferences',()=>{
  for(const [set,key] of [[menuFavorites,menuFavoritesStorageKey],[menuPinnedCategories,'teacherTiles.categoryPins.v1']]){
    set.clear();try{for(const id of JSON.parse(localStorage.getItem(key)||'[]'))set.add(id)}catch{}
  }
  applyMenuView();renderMenuCategoryPins();
});
