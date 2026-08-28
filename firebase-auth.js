const firebaseConfig = {
  apiKey: "AIzaSyBa1AkZfYLemz4gDAI505704wsG1CC_sSQ",
  authDomain: "teachertiles-6739b.firebaseapp.com",
  projectId: "teachertiles-6739b",
  storageBucket: "teachertiles-6739b.firebasestorage.app",
  messagingSenderId: "41204185343",
  appId: "1:41204185343:web:1b170fbf73e35d2926f4ca",
  measurementId: "G-18VJG8SWLD"
};

const modal = document.getElementById("profile-modal");
const toggle = document.getElementById("profile-toggle");
const launchAvatar = document.getElementById("profile-launch-avatar");
const loadingState = document.getElementById("profile-auth-loading");
const signedOutState = document.getElementById("profile-signed-out");
const signedInState = document.getElementById("profile-signed-in");
const signInButton = document.getElementById("profile-google-signin");
const signOutButton = document.getElementById("profile-signout");
const profileAvatar = document.getElementById("profile-avatar");
const profileDisplayName = document.getElementById("profile-display-name");
const profileEmail = document.getElementById("profile-email");
const status = document.getElementById("profile-auth-status");
const saveWarning = document.getElementById("signed-out-save-warning");

const boardsToggle = document.getElementById("boards-toggle");
const boardsView = document.getElementById("boards-view");
const boardsBack = document.getElementById("boards-back");
const boardsGrid = document.getElementById("boards-grid");
const boardsLoading = document.getElementById("boards-loading");
const boardsSaveStatus = document.getElementById("boards-save-status");

const gatedFeatureIds = new Set(["theme-shelf-toggle", "sticker-shelf-toggle", "shop-toggle", "boards-toggle"]);

let auth = null;
let authSdk = null;
let firestoreSdk = null;
let db = null;
let currentUser = null;
let authReady = false;
let busy = false;
let lastFocused = null;

let boardList = [];
let activeBoardId = "";
let boardLoading = false;
let boardSaving = false;
let boardSaveTimer = 0;
let queuedSave = false;
const knownBoardObjectIds = new Map();
const knownBoardObjectHashes = new Map();

const boardApi = () => window.TeacherTilesBoard || null;
const activeBoardStorageKey = uid => `teachertiles-active-board-${uid}`;

function setStatus(message = "", isError = false) {
  status.textContent = message;
  status.classList.toggle("is-error", isError);
}

function setBoardStatus(message = "", isError = false) {
  if (!boardsSaveStatus) return;
  boardsSaveStatus.textContent = message;
  boardsSaveStatus.classList.toggle("is-error", isError);
}

function fallbackAvatarData(name = "Teacher") {
  const letter = (name.trim()[0] || "T").toUpperCase();
  const safeLetter = letter.replace(/[<&>"']/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="36" fill="#eef1f4"/><text x="80" y="101" text-anchor="middle" font-family="Arial,sans-serif" font-size="76" font-weight="700" fill="#30343b">${safeLetter}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function closeBoardsView() {
  if (!boardsView || boardsView.hidden) return;
  boardsView.hidden = true;
  boardsView.setAttribute("aria-hidden", "true");
  document.body.classList.remove("boards-screen-open");
  boardsToggle?.setAttribute("aria-expanded", "false");
}

function closeOtherSurfaces({ keepBoards = false } = {}) {
  const shelf = document.getElementById("asset-shelf");
  if (shelf?.classList.contains("is-open")) document.getElementById("asset-shelf-close")?.click();

  const shop = document.getElementById("shop-modal");
  if (shop && !shop.hidden) document.getElementById("shop-close")?.click();

  if (!keepBoards) closeBoardsView();
}

function openProfile() {
  if (!modal.hidden) return;
  closeOtherSurfaces();
  lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  toggle.setAttribute("aria-expanded", "true");
  requestAnimationFrame(() => modal.querySelector(".profile-panel__close")?.focus());
}

function closeProfile() {
  if (modal.hidden) return;
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  toggle.setAttribute("aria-expanded", "false");
  setStatus();
  if (lastFocused?.isConnected) lastFocused.focus();
  lastFocused = null;
}

function boardCollection(uid) {
  return firestoreSdk.collection(db, "users", uid, "boards");
}

function boardDocument(uid, boardId) {
  return firestoreSdk.doc(db, "users", uid, "boards", boardId);
}

function boardObjectsCollection(uid, boardId) {
  return firestoreSdk.collection(db, "users", uid, "boards", boardId, "objects");
}

function boardObjectDocument(uid, boardId, objectId) {
  return firestoreSdk.doc(db, "users", uid, "boards", boardId, "objects", objectId);
}

function normalizeBoardMetadata(docSnapshot) {
  const data = docSnapshot.data() || {};
  return {
    id: docSnapshot.id,
    name: typeof data.name === "string" && data.name.trim() ? data.name.trim() : "Board",
    theme: typeof data.theme === "string" ? data.theme : "light",
    camera: data.camera || null,
    calendarEvents: Array.isArray(data.calendarEvents) ? data.calendarEvents : [],
    preview: Array.isArray(data.preview) ? data.preview : [],
    objectCount: Math.max(0, Number(data.objectCount) || 0),
    schemaVersion: Number(data.schemaVersion) || 1,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null
  };
}

function timestampValue(value) {
  try {
    if (value?.toMillis) return value.toMillis();
    if (value?.seconds) return Number(value.seconds) * 1000;
  } catch {}
  return 0;
}

function sortBoards(list) {
  return [...list].sort((a, b) => {
    if (a.id === activeBoardId) return -1;
    if (b.id === activeBoardId) return 1;
    return timestampValue(b.updatedAt) - timestampValue(a.updatedAt);
  });
}

function cleanFirestoreValue(value) {
  if (value === undefined) return undefined;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (Array.isArray(value)) return value.map(item => cleanFirestoreValue(item)).filter(item => item !== undefined);
  if (typeof value === 'object') {
    const clean = {};
    for (const [key, item] of Object.entries(value)) {
      const next = cleanFirestoreValue(item);
      if (next !== undefined) clean[key] = next;
    }
    return clean;
  }
  return String(value);
}

function makeBoardMeta(name, snapshot, { isNew = false } = {}) {
  const meta = {
    name,
    schemaVersion: Number(snapshot.schemaVersion) || 1,
    theme: snapshot.theme || "light",
    camera: snapshot.camera || null,
    calendarEvents: Array.isArray(snapshot.calendarEvents) ? snapshot.calendarEvents : [],
    preview: Array.isArray(snapshot.preview) ? snapshot.preview.slice(0, 48) : [],
    objectCount: Array.isArray(snapshot.objects) ? snapshot.objects.length : 0,
    updatedAt: firestoreSdk.serverTimestamp()
  };
  if (isNew) meta.createdAt = firestoreSdk.serverTimestamp();
  return meta;
}

async function commitBoardSnapshot(boardId, name, snapshot, { isNew = false } = {}) {
  if (!currentUser || !db || !firestoreSdk || !boardId || !snapshot) return;

  const objects = Array.isArray(snapshot.objects) ? snapshot.objects.filter(object => object?.id) : [];
  const cleanedObjects = objects.map(object => cleanFirestoreValue(object));
  const currentIds = new Set(cleanedObjects.map(object => object.id));
  const previousIds = knownBoardObjectIds.get(boardId) || new Set();
  const previousHashes = knownBoardObjectHashes.get(boardId) || new Map();
  const currentHashes = new Map();
  const changedObjects = [];

  for (const object of cleanedObjects) {
    const hash = JSON.stringify(object);
    currentHashes.set(object.id, hash);
    if (isNew || previousHashes.get(object.id) !== hash) changedObjects.push(object);
  }

  const deletes = [...previousIds].filter(id => !currentIds.has(id));
  const operations = [
    ...changedObjects.map(object => ({ type: "set", id: object.id, data: object })),
    ...deletes.map(id => ({ type: "delete", id }))
  ];

  for (let index = 0; index < operations.length; index += 430) {
    const batch = firestoreSdk.writeBatch(db);
    for (const operation of operations.slice(index, index + 430)) {
      const ref = boardObjectDocument(currentUser.uid, boardId, operation.id);
      if (operation.type === "delete") batch.delete(ref);
      else batch.set(ref, operation.data);
    }
    await batch.commit();
  }

  await firestoreSdk.setDoc(
    boardDocument(currentUser.uid, boardId),
    cleanFirestoreValue(makeBoardMeta(name, snapshot, { isNew })),
    { merge: true }
  );

  knownBoardObjectIds.set(boardId, currentIds);
  knownBoardObjectHashes.set(boardId, currentHashes);
}

function getBoardName(boardId) {
  return boardList.find(board => board.id === boardId)?.name || "Board";
}

async function saveCurrentBoard({ immediate = false } = {}) {
  clearTimeout(boardSaveTimer);
  if (!currentUser || !activeBoardId || !db || !firestoreSdk || boardLoading) return;
  if (boardSaving) {
    queuedSave = true;
    return;
  }

  const api = boardApi();
  if (!api) return;

  boardSaving = true;
  setBoardStatus("Saving…");
  try {
    const snapshot = api.capture();
    const name = getBoardName(activeBoardId);
    await commitBoardSnapshot(activeBoardId, name, snapshot);

    const existing = boardList.find(board => board.id === activeBoardId);
    if (existing) {
      existing.theme = snapshot.theme;
      existing.camera = snapshot.camera;
      existing.calendarEvents = snapshot.calendarEvents;
      existing.preview = snapshot.preview;
      existing.objectCount = snapshot.objects.length;
      existing.updatedAt = { seconds: Date.now() / 1000 };
    }

    setBoardStatus("Saved");
    if (!boardsView?.hidden) renderBoards();
    window.setTimeout(() => {
      if (boardsSaveStatus?.textContent === "Saved") setBoardStatus("");
    }, 1400);
  } catch (error) {
    console.error("TeacherTiles board save failed", error);
    setBoardStatus("Save failed", true);
  } finally {
    boardSaving = false;
    if (queuedSave) {
      queuedSave = false;
      if (immediate) await saveCurrentBoard({ immediate: true });
      else scheduleBoardSave();
    }
  }
}

function scheduleBoardSave() {
  if (!currentUser || !activeBoardId || boardLoading) return;
  clearTimeout(boardSaveTimer);
  setBoardStatus("Unsaved");
  boardSaveTimer = window.setTimeout(() => saveCurrentBoard(), 1250);
}

async function fetchBoards() {
  if (!currentUser || !db || !firestoreSdk) return [];
  const snapshot = await firestoreSdk.getDocs(boardCollection(currentUser.uid));
  const boards = snapshot.docs.map(normalizeBoardMetadata);
  boardList = sortBoards(boards);
  return boardList;
}

async function fetchBoardObjects(boardId) {
  const snapshot = await firestoreSdk.getDocs(boardObjectsCollection(currentUser.uid, boardId));
  const objects = snapshot.docs.map(docSnapshot => {
    const data = cleanFirestoreValue(docSnapshot.data() || {});
    return { ...data, id: docSnapshot.id };
  });
  knownBoardObjectIds.set(boardId, new Set(objects.map(object => object.id)));
  knownBoardObjectHashes.set(boardId, new Map(objects.map(object => [object.id, JSON.stringify(cleanFirestoreValue(object))])));
  return objects;
}

async function loadBoard(boardId, { closeView = true } = {}) {
  if (!currentUser || !boardId || !db || !firestoreSdk) return;
  const api = boardApi();
  if (!api) return;

  boardLoading = true;
  let needsCompatibilityCleanup = false;
  setBoardStatus("Loading…");

  try {
    const metaSnapshot = await firestoreSdk.getDoc(boardDocument(currentUser.uid, boardId));
    if (!metaSnapshot.exists()) throw new Error("Board no longer exists.");

    const meta = normalizeBoardMetadata(metaSnapshot);
    const objects = await fetchBoardObjects(boardId);

    activeBoardId = boardId;
    localStorage.setItem(activeBoardStorageKey(currentUser.uid), activeBoardId);
    api.setActiveBoardId(activeBoardId);

    const result = api.load({
      schemaVersion: meta.schemaVersion,
      theme: meta.theme,
      camera: meta.camera,
      calendarEvents: meta.calendarEvents,
      objects
    });

    const existingIndex = boardList.findIndex(board => board.id === boardId);
    if (existingIndex >= 0) boardList[existingIndex] = meta;
    else boardList.push(meta);

    boardList = sortBoards(boardList);
    setBoardStatus("");

    needsCompatibilityCleanup = Boolean(result?.removedObjectIds?.length);

    if (closeView) closeBoardsView();
  } catch (error) {
    console.error("TeacherTiles board load failed", error);
    setBoardStatus("Could not load board", true);
  } finally {
    boardLoading = false;
    if (needsCompatibilityCleanup) scheduleBoardSave();
  }
}

function createBoardReference() {
  return firestoreSdk.doc(boardCollection(currentUser.uid));
}

async function createInitialBoardFromWorkspace() {
  const api = boardApi();
  if (!api) return null;
  const ref = createBoardReference();
  const snapshot = api.capture();
  const name = "Board 1";

  await commitBoardSnapshot(ref.id, name, snapshot, { isNew: true });
  const board = {
    id: ref.id,
    name,
    theme: snapshot.theme,
    camera: snapshot.camera,
    calendarEvents: snapshot.calendarEvents,
    preview: snapshot.preview,
    objectCount: snapshot.objects.length,
    schemaVersion: snapshot.schemaVersion,
    createdAt: { seconds: Date.now() / 1000 },
    updatedAt: { seconds: Date.now() / 1000 }
  };

  boardList = [board];
  activeBoardId = ref.id;
  localStorage.setItem(activeBoardStorageKey(currentUser.uid), activeBoardId);
  api.setActiveBoardId(activeBoardId);
  return board;
}

function nextBoardName() {
  const used = new Set(boardList.map(board => board.name));
  let n = 1;
  while (used.has(`Board ${n}`)) n++;
  return `Board ${n}`;
}

async function createBlankBoard() {
  if (!currentUser || !firestoreSdk || !db) return;
  const api = boardApi();
  if (!api) return;

  await saveCurrentBoard({ immediate: true });

  const ref = createBoardReference();
  const snapshot = api.blank();
  const name = nextBoardName();

  setBoardStatus("Creating…");
  try {
    await commitBoardSnapshot(ref.id, name, snapshot, { isNew: true });

    boardList.push({
      id: ref.id,
      name,
      theme: snapshot.theme,
      camera: snapshot.camera,
      calendarEvents: [],
      preview: [],
      objectCount: 0,
      schemaVersion: snapshot.schemaVersion,
      createdAt: { seconds: Date.now() / 1000 },
      updatedAt: { seconds: Date.now() / 1000 }
    });

    activeBoardId = ref.id;
    localStorage.setItem(activeBoardStorageKey(currentUser.uid), activeBoardId);
    api.setActiveBoardId(activeBoardId);
    api.load(snapshot);
    boardList = sortBoards(boardList);
    setBoardStatus("");
    closeBoardsView();
  } catch (error) {
    console.error("TeacherTiles board creation failed", error);
    setBoardStatus("Could not create board", true);
  }
}

function previewThemeClass(theme) {
  const safe = String(theme || "light").toLowerCase().replace(/[^a-z0-9-]/g, "");
  return `board-preview-theme-${safe || "light"}`;
}

function createMiniObject(item) {
  const el = document.createElement("span");
  el.className = `board-mini-object${item.type === "sticker" ? " is-sticker" : ""}`;

  const x = Math.max(0, Math.min(1, Number(item.x) || 0));
  const y = Math.max(0, Math.min(1, Number(item.y) || 0));
  const w = Math.max(.025, Math.min(.72, Number(item.w) || .08));
  const h = Math.max(.025, Math.min(.72, Number(item.h) || .08));

  el.style.left = `${x * 100}%`;
  el.style.top = `${y * 100}%`;
  el.style.width = `${w * 100}%`;
  el.style.height = `${h * 100}%`;

  if (item.type === "sticker") {
    if (item.emoji) {
      el.textContent = item.emoji;
    } else if (item.src) {
      const image = document.createElement("img");
      image.src = item.src;
      image.alt = "";
      el.appendChild(image);
    }
  }

  return el;
}

function createBoardCard(board) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `board-card${board.id === activeBoardId ? " is-active" : ""}`;
  button.dataset.boardId = board.id;
  button.setAttribute("aria-label", `Open ${board.name}`);

  const preview = document.createElement("div");
  preview.className = `board-card__preview ${previewThemeClass(board.theme)}`;

  const objects = document.createElement("div");
  objects.className = "board-card__objects";
  for (const item of Array.isArray(board.preview) ? board.preview : []) {
    objects.appendChild(createMiniObject(item));
  }
  preview.appendChild(objects);

  const meta = document.createElement("div");
  meta.className = "board-card__meta";

  const title = document.createElement("strong");
  title.textContent = board.name;

  const count = document.createElement("span");
  const total = Math.max(0, Number(board.objectCount) || 0);
  count.textContent = `${total} ${total === 1 ? "item" : "items"}`;

  meta.append(title, count);
  button.append(preview, meta);

  button.addEventListener("click", async () => {
    if (boardLoading) return;
    if (board.id === activeBoardId) {
      closeBoardsView();
      return;
    }

    button.disabled = true;
    try {
      await saveCurrentBoard({ immediate: true });
      await loadBoard(board.id);
    } finally {
      button.disabled = false;
    }
  });

  return button;
}

function createNewBoardCard() {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "board-new-card";
  button.setAttribute("aria-label", "Create new blank board");

  const preview = document.createElement("div");
  preview.className = "board-new-card__preview";

  const plus = document.createElement("span");
  plus.className = "board-new-card__plus";
  plus.textContent = "+";

  preview.appendChild(plus);

  const label = document.createElement("strong");
  label.className = "board-new-card__label";
  label.textContent = "New Board";

  button.append(preview, label);
  button.addEventListener("click", createBlankBoard);
  return button;
}

function renderBoards() {
  if (!boardsGrid) return;
  boardsGrid.replaceChildren();
  for (const board of sortBoards(boardList)) boardsGrid.appendChild(createBoardCard(board));
  boardsGrid.appendChild(createNewBoardCard());
  boardsLoading.hidden = true;
}

async function openBoardsView() {
  if (!currentUser) {
    openProfile();
    return;
  }
  if (boardLoading) return;

  closeProfile();
  closeOtherSurfaces({ keepBoards: true });

  boardsView.hidden = false;
  boardsView.setAttribute("aria-hidden", "false");
  document.body.classList.add("boards-screen-open");
  boardsToggle?.setAttribute("aria-expanded", "true");
  boardsLoading.hidden = false;
  boardsGrid.replaceChildren();

  try {
    await saveCurrentBoard({ immediate: true });
    await fetchBoards();
    renderBoards();
  } catch (error) {
    console.error("TeacherTiles could not open Boards", error);
    boardsLoading.hidden = true;
    setBoardStatus("Could not load boards", true);
  }
}

async function initializeBoardsForUser(user) {
  if (!user || !db || !firestoreSdk || !boardApi()) return;

  boardLoading = true;
  setBoardStatus("Loading…");

  try {
    await fetchBoards();

    if (!boardList.length) {
      await createInitialBoardFromWorkspace();
      setBoardStatus("");
      return;
    }

    const stored = localStorage.getItem(activeBoardStorageKey(user.uid));
    const desired = boardList.some(board => board.id === stored) ? stored : boardList[0].id;
    await loadBoard(desired, { closeView: false });
  } catch (error) {
    console.error("TeacherTiles could not initialize cloud boards", error);
    setBoardStatus("Cloud save unavailable", true);
  } finally {
    boardLoading = false;
  }
}

async function renderUser(user) {
  const previousUser = currentUser;
  currentUser = user || null;
  authReady = true;
  loadingState.hidden = true;
  signedInState.hidden = !user;
  signedOutState.hidden = Boolean(user);
  signInButton.disabled = false;
  setStatus();

  if (saveWarning) saveWarning.hidden = Boolean(user);

  if (user) {
    const name = user.displayName?.trim() || "Teacher";
    const photo = user.photoURL || fallbackAvatarData(name);
    profileDisplayName.textContent = name;
    profileEmail.textContent = user.email || "Google account";
    profileAvatar.src = photo;
    profileAvatar.alt = `${name}'s Google profile picture`;
    launchAvatar.src = photo;
    launchAvatar.hidden = false;
    toggle.classList.add("is-signed-in");
    toggle.setAttribute("aria-label", `Open ${name}'s profile`);
    boardsToggle?.setAttribute("aria-label", "Open boards");

    if (!previousUser || previousUser.uid !== user.uid) {
      activeBoardId = "";
      boardList = [];
      knownBoardObjectIds.clear();
      knownBoardObjectHashes.clear();
      await initializeBoardsForUser(user);
    }
  } else {
    clearTimeout(boardSaveTimer);
    activeBoardId = "";
    boardList = [];
    knownBoardObjectIds.clear();
    knownBoardObjectHashes.clear();
    boardApi()?.setActiveBoardId("");

    launchAvatar.removeAttribute("src");
    launchAvatar.hidden = true;
    toggle.classList.remove("is-signed-in");
    toggle.setAttribute("aria-label", "Open profile");
    profileAvatar.removeAttribute("src");
    closeOtherSurfaces();
  }

  document.getElementById("theme-shelf-toggle")?.setAttribute("aria-label", user ? "Open theme shelf" : "Sign in to open themes");
  document.getElementById("sticker-shelf-toggle")?.setAttribute("aria-label", user ? "Open sticker shelf" : "Sign in to open stickers");
  document.getElementById("shop-toggle")?.setAttribute("aria-label", user ? "Open shop" : "Sign in to open shop");
  boardsToggle?.setAttribute("aria-label", user ? "Open boards" : "Sign in to open boards");
}

async function handleSignIn() {
  if (busy) return;
  if (!auth || !authSdk) {
    setStatus("Google sign-in is still loading. Try again in a moment.", true);
    return;
  }

  busy = true;
  signInButton.disabled = true;
  setStatus("Opening Google sign-in…");

  try {
    await authSdk.setPersistence(auth, authSdk.browserLocalPersistence);
    const provider = new authSdk.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await authSdk.signInWithPopup(auth, provider);
    setStatus("Signed in successfully.");
  } catch (error) {
    if (error?.code === "auth/popup-closed-by-user" || error?.code === "auth/cancelled-popup-request") {
      setStatus("Sign-in was canceled.");
    } else if (error?.code === "auth/popup-blocked") {
      setStatus("Your browser blocked the Google sign-in popup. Allow popups for TeacherTiles and try again.", true);
    } else if (error?.code === "auth/unauthorized-domain") {
      setStatus("This domain is not authorized for Google sign-in in Firebase Authentication.", true);
    } else {
      console.error("TeacherTiles Google sign-in failed", error);
      setStatus("Google sign-in couldn't be completed. Please try again.", true);
    }
  } finally {
    busy = false;
    signInButton.disabled = false;
  }
}

async function handleSignOut() {
  if (busy || !auth || !authSdk) return;
  busy = true;
  signOutButton.disabled = true;
  setStatus("Saving and signing out…");

  try {
    await saveCurrentBoard({ immediate: true });
    await authSdk.signOut(auth);
    setStatus("Signed out.");
  } catch (error) {
    console.error("TeacherTiles sign-out failed", error);
    setStatus("We couldn't sign you out. Please try again.", true);
  } finally {
    busy = false;
    signOutButton.disabled = false;
  }
}

async function initializeFirebaseAuth() {
  signInButton.disabled = true;

  try {
    const [appModule, authModule, firestoreModule] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js")
    ]);

    authSdk = authModule;
    firestoreSdk = firestoreModule;

    const firebaseApp = appModule.initializeApp(firebaseConfig);
    auth = authModule.getAuth(firebaseApp);
    db = firestoreModule.getFirestore(firebaseApp);

    try {
      await authModule.setPersistence(auth, authModule.browserLocalPersistence);
    } catch (error) {
      console.warn("TeacherTiles could not set local Firebase auth persistence", error);
    }

    authModule.onAuthStateChanged(auth, user => {
      renderUser(user).catch(error => {
        console.error("TeacherTiles account initialization failed", error);
        setStatus("Your account signed in, but cloud boards could not be initialized.", true);
      });
    }, error => {
      console.error("TeacherTiles auth state error", error);
      authReady = true;
      loadingState.hidden = true;
      signedOutState.hidden = false;
      signedInState.hidden = true;
      signInButton.disabled = false;
      if (saveWarning) saveWarning.hidden = false;
      setStatus("We couldn't check your sign-in status. Refresh and try again.", true);
    });
  } catch (error) {
    console.error("TeacherTiles Firebase SDK failed to load", error);
    authReady = true;
    loadingState.hidden = true;
    signedOutState.hidden = false;
    signedInState.hidden = true;
    signInButton.disabled = true;
    if (saveWarning) saveWarning.hidden = false;
    setStatus("Google sign-in couldn't load. Check your internet connection and refresh the page.", true);
  }
}

document.addEventListener("click", event => {
  const target = event.target instanceof Element
    ? event.target.closest("#theme-shelf-toggle, #sticker-shelf-toggle, #shop-toggle, #boards-toggle")
    : null;

  if (!target || !gatedFeatureIds.has(target.id) || currentUser) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  openProfile();
}, true);

toggle.addEventListener("click", () => modal.hidden ? openProfile() : closeProfile());
modal.querySelectorAll("[data-profile-close]").forEach(button => button.addEventListener("click", closeProfile));
signInButton.addEventListener("click", handleSignIn);
signOutButton.addEventListener("click", handleSignOut);

boardsToggle?.addEventListener("click", () => {
  if (!currentUser) return;
  if (boardsView.hidden) openBoardsView();
  else closeBoardsView();
});
boardsBack?.addEventListener("click", closeBoardsView);

document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;

  if (!boardsView?.hidden) {
    event.preventDefault();
    closeBoardsView();
    return;
  }

  if (!modal.hidden) {
    event.preventDefault();
    closeProfile();
  }
});

["theme-shelf-toggle", "sticker-shelf-toggle", "shop-toggle"].forEach(id => {
  document.getElementById(id)?.addEventListener("click", () => {
    if (!modal.hidden) closeProfile();
  });
});

window.addEventListener("teachertiles:boardchange", () => {
  scheduleBoardSave();
});

window.addEventListener("beforeunload", () => {
  if (currentUser && activeBoardId) {
    const api = boardApi();
    if (api) {
      try {
        localStorage.setItem(
          `teachertiles-last-local-board-${currentUser.uid}`,
          JSON.stringify({ boardId: activeBoardId, snapshot: api.capture(), savedAt: Date.now() })
        );
      } catch {}
    }
  }
});

window.TeacherTilesAuth = {
  get auth() { return auth; },
  get user() { return currentUser; },
  get ready() { return authReady; },
  openProfile
};

window.TeacherTilesCloudBoards = {
  get activeBoardId() { return activeBoardId; },
  get boards() { return [...boardList]; },
  open: openBoardsView,
  save: () => saveCurrentBoard({ immediate: true }),
  create: createBlankBoard,
  load: loadBoard
};

initializeFirebaseAuth();
