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
let boardDeleting = false;
let boardSaving = false;
let localBoardSaveTimer = 0;
let cloudBoardSaveTimer = 0;
let queuedSave = false;
let boardListLoadedFromNetwork = false;
let pendingBoardChangeReason = "";
const boardLocalHashes = new Map();
const localBoardMemory = new Map();
let localBoardDbPromise = null;

const LOCAL_SAVE_DELAY = 280;
const CLOUD_SAVE_DELAY = 8000;
const BOARD_LIST_CACHE_TTL = 60000;
const INLINE_OBJECT_BUDGET = 560000;
const CHUNK_OBJECT_BUDGET = 520000;
const MAX_SINGLE_OBJECT_BYTES = 900000;
const PREVIEW_OBJECT_BUDGET = 90000;

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

function legacyBoardObjectsCollection(uid, boardId) {
  return firestoreSdk.collection(db, "users", uid, "boards", boardId, "objects");
}

function boardStateCollection(uid, boardId) {
  return firestoreSdk.collection(db, "users", uid, "boards", boardId, "state");
}

function boardStateDocument(uid, boardId, index) {
  return firestoreSdk.doc(db, "users", uid, "boards", boardId, "state", `chunk-${String(index).padStart(3, "0")}`);
}

function timestampValue(value) {
  try {
    if (typeof value === "number") return value;
    if (value?.toMillis) return value.toMillis();
    if (value?.seconds) return Number(value.seconds) * 1000;
  } catch {}
  return 0;
}

function normalizeBoardMetadata(docSnapshot) {
  const data = docSnapshot.data() || {};
  const inlineObjects = Array.isArray(data.inlineObjects) ? data.inlineObjects : null;
  const storageFormat = typeof data.storageFormat === "string"
    ? data.storageFormat
    : (inlineObjects ? "inline-v2" : "legacy-objects-v1");
  return {
    id: docSnapshot.id,
    name: typeof data.name === "string" && data.name.trim() ? data.name.trim() : "Board",
    theme: typeof data.theme === "string" ? data.theme : "light",
    camera: data.camera || null,
    calendarEvents: Array.isArray(data.calendarEvents) ? data.calendarEvents : [],
    preview: Array.isArray(data.preview) ? data.preview : [],
    previewObjects: inlineObjects ? inlineObjects.slice(0, 48) : (Array.isArray(data.previewObjects) ? data.previewObjects : []),
    inlineObjects,
    objectCount: Math.max(0, Number(data.objectCount) || (inlineObjects?.length || 0)),
    schemaVersion: Number(data.schemaVersion) || 1,
    revision: Math.max(0, Number(data.revision) || 0),
    cloudContentHash: typeof data.contentHash === "string" ? data.contentHash : "",
    storageFormat,
    stateChunkCount: Math.max(0, Number(data.stateChunkCount) || 0),
    stateChunkHashes: Array.isArray(data.stateChunkHashes) ? data.stateChunkHashes.map(String) : [],
    legacyCleanupPending: Boolean(data.legacyCleanupPending || storageFormat === "legacy-objects-v1"),
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
    localDirty: false,
    needsMigration: storageFormat === "legacy-objects-v1"
  };
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
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (Array.isArray(value)) return value.map(item => cleanFirestoreValue(item)).filter(item => item !== undefined);
  if (typeof value === "object") {
    const clean = {};
    for (const [key, item] of Object.entries(value)) {
      const next = cleanFirestoreValue(item);
      if (next !== undefined) clean[key] = next;
    }
    return clean;
  }
  return String(value);
}

function byteLength(value) {
  try {
    return new TextEncoder().encode(typeof value === "string" ? value : JSON.stringify(value)).length;
  } catch {
    return JSON.stringify(value).length;
  }
}

function hashText(text) {
  let h1 = 2166136261 >>> 0;
  let h2 = 2246822519 >>> 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ c, 3266489917) >>> 0;
    h2 ^= h2 >>> 13;
  }
  return `${text.length.toString(36)}-${h1.toString(36)}-${h2.toString(36)}`;
}

function cleanBoardSnapshot(snapshot) {
  const data = snapshot && typeof snapshot === "object" ? snapshot : {};
  return cleanFirestoreValue({
    schemaVersion: Number(data.schemaVersion) || 1,
    theme: data.theme || "light",
    camera: data.camera || null,
    calendarEvents: Array.isArray(data.calendarEvents) ? data.calendarEvents : [],
    objects: Array.isArray(data.objects) ? data.objects.filter(object => object?.id) : [],
    preview: Array.isArray(data.preview) ? data.preview.slice(0, 48) : []
  });
}

function contentHashForSnapshot(snapshot) {
  const clean = cleanBoardSnapshot(snapshot);
  return hashText(JSON.stringify({
    schemaVersion: clean.schemaVersion,
    theme: clean.theme,
    calendarEvents: clean.calendarEvents,
    objects: clean.objects
  }));
}

function localHashForSnapshot(snapshot) {
  const clean = cleanBoardSnapshot(snapshot);
  return hashText(JSON.stringify({
    schemaVersion: clean.schemaVersion,
    theme: clean.theme,
    camera: clean.camera,
    calendarEvents: clean.calendarEvents,
    objects: clean.objects
  }));
}

function compactPreviewValue(value, depth = 0) {
  if (depth > 4 || value === undefined) return undefined;
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") {
    if (/^data:(?:image|audio|video)\//i.test(value)) return "";
    return value.length > 260 ? `${value.slice(0, 257)}…` : value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 24).map(item => compactPreviewValue(item, depth + 1)).filter(item => item !== undefined);
  }
  if (typeof value === "object") {
    const output = {};
    for (const [key, item] of Object.entries(value).slice(0, 28)) {
      const next = compactPreviewValue(item, depth + 1);
      if (next !== undefined) output[key] = next;
    }
    return output;
  }
  return undefined;
}

function compactPreviewObject(object) {
  const preview = {
    id: object.id,
    type: object.type,
    transform: compactPreviewValue(object.transform),
    zIndex: object.zIndex,
    dataset: compactPreviewValue(object.dataset),
    fields: compactPreviewValue(object.fields),
    editables: compactPreviewValue(object.editables),
    classes: compactPreviewValue(object.classes)
  };
  if (object.sticker) preview.sticker = compactPreviewValue(object.sticker);

  const special = compactPreviewValue(object.special);
  if (special !== undefined && byteLength(special) <= 4200) preview.special = special;
  const timer = compactPreviewValue(object.timer);
  if (timer !== undefined && byteLength(timer) <= 1800) preview.timer = timer;
  return cleanFirestoreValue(preview);
}

function buildCompactPreviewObjects(objects) {
  const result = [];
  let used = 2;
  for (const object of (Array.isArray(objects) ? objects : []).slice(0, 48)) {
    const preview = compactPreviewObject(object);
    const size = byteLength(preview) + 1;
    if (result.length && used + size > PREVIEW_OBJECT_BUDGET) break;
    if (size > PREVIEW_OBJECT_BUDGET) continue;
    result.push(preview);
    used += size;
  }
  return result;
}

function planBoardObjectStorage(objects) {
  const cleanedObjects = cleanFirestoreValue(Array.isArray(objects) ? objects : []);
  if (byteLength(cleanedObjects) <= INLINE_OBJECT_BUDGET) {
    return { format: "inline-v2", objects: cleanedObjects, chunks: [], chunkHashes: [] };
  }

  const chunks = [];
  let current = [];
  let currentBytes = 2;

  for (const object of cleanedObjects) {
    const objectBytes = byteLength(object) + 2;
    if (objectBytes > MAX_SINGLE_OBJECT_BYTES) {
      throw new Error("A board item is too large for Firestore. Large uploaded media will need Firebase Storage.");
    }
    if (current.length && currentBytes + objectBytes > CHUNK_OBJECT_BUDGET) {
      chunks.push(current);
      current = [];
      currentBytes = 2;
    }
    current.push(object);
    currentBytes += objectBytes;
  }
  if (current.length || !chunks.length) chunks.push(current);

  return {
    format: "chunked-v2",
    objects: cleanedObjects,
    chunks,
    chunkHashes: chunks.map(chunk => hashText(JSON.stringify(chunk)))
  };
}

const boardListCacheKey = uid => `teachertiles-board-list-v2-${uid}`;
const localBoardKey = (uid, boardId) => `${uid}:${boardId}`;

function serializableBoardMetadata(board) {
  return {
    id: board.id,
    name: board.name,
    theme: board.theme || "light",
    camera: board.camera || null,
    calendarEvents: Array.isArray(board.calendarEvents) ? board.calendarEvents : [],
    preview: Array.isArray(board.preview) ? board.preview : [],
    previewObjects: Array.isArray(board.previewObjects) ? board.previewObjects : [],
    objectCount: Math.max(0, Number(board.objectCount) || 0),
    schemaVersion: Number(board.schemaVersion) || 1,
    revision: Math.max(0, Number(board.revision) || 0),
    cloudContentHash: board.cloudContentHash || "",
    storageFormat: board.storageFormat || "inline-v2",
    stateChunkCount: Math.max(0, Number(board.stateChunkCount) || 0),
    stateChunkHashes: Array.isArray(board.stateChunkHashes) ? board.stateChunkHashes : [],
    legacyCleanupPending: Boolean(board.legacyCleanupPending),
    createdAt: timestampValue(board.createdAt),
    updatedAt: timestampValue(board.updatedAt)
  };
}

function cacheBoardListMetadata() {
  if (!currentUser) return;
  try {
    localStorage.setItem(boardListCacheKey(currentUser.uid), JSON.stringify({
      savedAt: Date.now(),
      activeBoardId,
      boards: boardList.map(serializableBoardMetadata)
    }));
  } catch {}
}

function restoreBoardListMetadata(uid) {
  try {
    const raw = JSON.parse(localStorage.getItem(boardListCacheKey(uid)) || "null");
    if (!raw || !Array.isArray(raw.boards)) return null;
    const boards = raw.boards.map(data => ({
      ...data,
      inlineObjects: null,
      localDirty: false,
      needsMigration: data.storageFormat === "legacy-objects-v1"
    }));
    return { savedAt: Number(raw.savedAt) || 0, activeBoardId: String(raw.activeBoardId || ""), boards };
  } catch {
    return null;
  }
}

function openLocalBoardDb() {
  if (localBoardDbPromise) return localBoardDbPromise;
  if (!("indexedDB" in window)) return Promise.resolve(null);
  localBoardDbPromise = new Promise(resolve => {
    try {
      const request = indexedDB.open("TeacherTilesBoardCache", 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains("snapshots")) database.createObjectStore("snapshots", { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return localBoardDbPromise;
}

async function readLocalBoardSnapshot(uid, boardId) {
  const key = localBoardKey(uid, boardId);
  if (localBoardMemory.has(key)) return localBoardMemory.get(key);
  const database = await openLocalBoardDb();
  if (!database) return null;
  return new Promise(resolve => {
    try {
      const tx = database.transaction("snapshots", "readonly");
      const request = tx.objectStore("snapshots").get(key);
      request.onsuccess = () => {
        const value = request.result || null;
        if (value) localBoardMemory.set(key, value);
        resolve(value);
      };
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function writeLocalBoardSnapshot(uid, boardId, record) {
  const key = localBoardKey(uid, boardId);
  const value = { key, ...record, savedAt: Date.now() };
  localBoardMemory.set(key, value);
  const database = await openLocalBoardDb();
  if (!database) return;
  await new Promise(resolve => {
    try {
      const tx = database.transaction("snapshots", "readwrite");
      tx.objectStore("snapshots").put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function deleteLocalBoardSnapshot(uid, boardId) {
  const key = localBoardKey(uid, boardId);
  localBoardMemory.delete(key);
  boardLocalHashes.delete(boardId);
  const database = await openLocalBoardDb();
  if (!database) return;
  await new Promise(resolve => {
    try {
      const tx = database.transaction("snapshots", "readwrite");
      tx.objectStore("snapshots").delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

function snapshotFromBoard(board, objects) {
  return cleanBoardSnapshot({
    schemaVersion: board.schemaVersion,
    theme: board.theme,
    camera: board.camera,
    calendarEvents: board.calendarEvents,
    objects,
    preview: board.preview
  });
}

function updateBoardMemoryFromSnapshot(board, snapshot, { previewObjects = null } = {}) {
  if (!board || !snapshot) return;
  board.theme = snapshot.theme;
  board.camera = snapshot.camera;
  board.calendarEvents = snapshot.calendarEvents;
  board.preview = snapshot.preview;
  board.previewObjects = previewObjects || buildCompactPreviewObjects(snapshot.objects);
  board.objectCount = snapshot.objects.length;
  board.schemaVersion = snapshot.schemaVersion;
  board.updatedAt = { seconds: Date.now() / 1000 };
}

async function cacheSnapshotLocally(boardId, snapshot, { dirty = null } = {}) {
  if (!currentUser || !boardId || !snapshot) return null;
  const clean = cleanBoardSnapshot(snapshot);
  const board = boardList.find(item => item.id === boardId);
  if (!board) return null;
  const contentHash = contentHashForSnapshot(clean);
  const fullHash = localHashForSnapshot(clean);
  const isDirty = dirty === null ? Boolean(board.needsMigration || contentHash !== board.cloudContentHash) : Boolean(dirty);

  updateBoardMemoryFromSnapshot(board, clean);
  board.localDirty = isDirty;

  if (boardLocalHashes.get(boardId) !== fullHash) {
    boardLocalHashes.set(boardId, fullHash);
    await writeLocalBoardSnapshot(currentUser.uid, boardId, {
      snapshot: clean,
      revision: board.revision,
      cloudContentHash: board.cloudContentHash || "",
      contentHash,
      dirty: isDirty
    });
  } else {
    const existing = localBoardMemory.get(localBoardKey(currentUser.uid, boardId));
    if (existing && existing.dirty !== isDirty) {
      existing.dirty = isDirty;
      existing.contentHash = contentHash;
      localBoardMemory.set(existing.key, existing);
      await writeLocalBoardSnapshot(currentUser.uid, boardId, existing);
    }
  }

  cacheBoardListMetadata();
  return { snapshot: clean, contentHash, fullHash, dirty: isDirty };
}

function getBoardName(boardId) {
  return boardList.find(board => board.id === boardId)?.name || "Board";
}

async function writeBoardSnapshotToCloud(boardId, name, snapshot, { isNew = false, forceMigration = false } = {}) {
  if (!currentUser || !db || !firestoreSdk || !boardId || !snapshot) return false;
  const board = boardList.find(item => item.id === boardId);
  if (!board) return false;

  const clean = cleanBoardSnapshot(snapshot);
  const contentHash = contentHashForSnapshot(clean);
  const migrationNeeded = forceMigration || board.needsMigration || board.storageFormat === "legacy-objects-v1";
  if (!isNew && !migrationNeeded && board.cloudContentHash === contentHash) {
    board.localDirty = false;
    await cacheSnapshotLocally(boardId, clean, { dirty: false });
    return false;
  }

  const plan = planBoardObjectStorage(clean.objects);
  const previousChunkCount = Math.max(0, Number(board.stateChunkCount) || 0);
  const previousChunkHashes = Array.isArray(board.stateChunkHashes) ? board.stateChunkHashes : [];
  const revision = Math.max(0, Number(board.revision) || 0) + 1;
  const legacyCleanupPending = Boolean(board.legacyCleanupPending || board.storageFormat === "legacy-objects-v1");

  const payload = cleanFirestoreValue({
    name,
    schemaVersion: clean.schemaVersion,
    theme: clean.theme,
    camera: clean.camera,
    calendarEvents: clean.calendarEvents,
    preview: clean.preview,
    objectCount: clean.objects.length,
    storageFormat: plan.format,
    stateChunkCount: plan.chunks.length,
    stateChunkHashes: plan.chunkHashes,
    revision,
    contentHash,
    legacyCleanupPending,
    updatedAt: firestoreSdk.serverTimestamp()
  });
  if (isNew) payload.createdAt = firestoreSdk.serverTimestamp();

  if (plan.format === "inline-v2") {
    payload.inlineObjects = plan.objects;
    payload.previewObjects = firestoreSdk.deleteField();
  } else {
    payload.inlineObjects = firestoreSdk.deleteField();
    payload.previewObjects = buildCompactPreviewObjects(plan.objects);
  }

  const stateWrites = [];
  if (plan.format === "chunked-v2") {
    for (let index = 0; index < plan.chunks.length; index++) {
      if (previousChunkHashes[index] === plan.chunkHashes[index] && board.storageFormat === "chunked-v2") continue;
      stateWrites.push({ type: "set", index, data: cleanFirestoreValue({ index, objects: plan.chunks[index] }) });
    }
  }
  for (let index = plan.chunks.length; index < previousChunkCount; index++) {
    stateWrites.push({ type: "delete", index });
  }

  // Write chunk data first for very large boards, then atomically point metadata at it.
  for (let offset = 0; offset < stateWrites.length; offset += 400) {
    const batch = firestoreSdk.writeBatch(db);
    for (const operation of stateWrites.slice(offset, offset + 400)) {
      const ref = boardStateDocument(currentUser.uid, boardId, operation.index);
      if (operation.type === "delete") batch.delete(ref);
      else batch.set(ref, operation.data);
    }
    await batch.commit();
  }

  await firestoreSdk.setDoc(boardDocument(currentUser.uid, boardId), payload, { merge: true });

  board.revision = revision;
  board.cloudContentHash = contentHash;
  board.storageFormat = plan.format;
  board.stateChunkCount = plan.chunks.length;
  board.stateChunkHashes = plan.chunkHashes;
  board.legacyCleanupPending = legacyCleanupPending;
  board.needsMigration = false;
  board.inlineObjects = plan.format === "inline-v2" ? plan.objects : null;

  // If the user changed the board while this cloud write was in flight, keep the
  // newer local snapshot dirty instead of overwriting it with the older saved copy.
  const localKey = localBoardKey(currentUser.uid, boardId);
  const latestLocal = localBoardMemory.get(localKey);
  const hasNewerLocal = Boolean(latestLocal?.snapshot && latestLocal.contentHash && latestLocal.contentHash !== contentHash);

  if (hasNewerLocal) {
    board.localDirty = true;
    updateBoardMemoryFromSnapshot(board, cleanBoardSnapshot(latestLocal.snapshot));
    await writeLocalBoardSnapshot(currentUser.uid, boardId, {
      snapshot: cleanBoardSnapshot(latestLocal.snapshot),
      revision,
      cloudContentHash: contentHash,
      contentHash: latestLocal.contentHash,
      dirty: true
    });
    boardLocalHashes.set(boardId, localHashForSnapshot(latestLocal.snapshot));
    queuedSave = true;
  } else {
    board.localDirty = false;
    board.previewObjects = plan.format === "inline-v2" ? plan.objects.slice(0, 48) : buildCompactPreviewObjects(plan.objects);
    updateBoardMemoryFromSnapshot(board, clean, { previewObjects: board.previewObjects });
    await writeLocalBoardSnapshot(currentUser.uid, boardId, {
      snapshot: clean,
      revision,
      cloudContentHash: contentHash,
      contentHash,
      dirty: false
    });
    boardLocalHashes.set(boardId, localHashForSnapshot(clean));
  }

  cacheBoardListMetadata();
  return true;
}

async function flushCurrentBoardLocal() {
  clearTimeout(localBoardSaveTimer);
  if (!currentUser || !activeBoardId || boardLoading) return null;
  const api = boardApi();
  if (!api) return null;
  const result = await cacheSnapshotLocally(activeBoardId, api.capture());
  if (result?.dirty) setBoardStatus("Unsaved");
  if (!boardsView?.hidden) renderBoards();
  return result;
}

function scheduleCloudBoardSave(delay = CLOUD_SAVE_DELAY) {
  if (!currentUser || !activeBoardId || boardLoading) return;
  clearTimeout(cloudBoardSaveTimer);
  cloudBoardSaveTimer = window.setTimeout(() => saveCurrentBoard({ immediate: true }), delay);
}

async function saveCurrentBoard({ immediate = false } = {}) {
  clearTimeout(localBoardSaveTimer);
  if (!currentUser || !activeBoardId || !db || !firestoreSdk || boardLoading) return;
  if (boardSaving) {
    queuedSave = true;
    return;
  }

  const local = await flushCurrentBoardLocal();
  if (!local?.dirty) {
    clearTimeout(cloudBoardSaveTimer);
    if (boardsSaveStatus?.textContent === "Unsaved") setBoardStatus("");
    return;
  }

  if (!immediate) {
    scheduleCloudBoardSave();
    return;
  }

  clearTimeout(cloudBoardSaveTimer);
  boardSaving = true;
  setBoardStatus("Saving…");
  const savingBoardId = activeBoardId;
  const savingSnapshot = local.snapshot;
  try {
    const board = boardList.find(item => item.id === savingBoardId);
    await writeBoardSnapshotToCloud(savingBoardId, getBoardName(savingBoardId), savingSnapshot, {
      forceMigration: Boolean(board?.needsMigration)
    });
    setBoardStatus("Saved");
    if (!boardsView?.hidden) renderBoards();
    window.setTimeout(() => {
      if (boardsSaveStatus?.textContent === "Saved") setBoardStatus("");
    }, 1400);
  } catch (error) {
    console.error("TeacherTiles board save failed", error);
    setBoardStatus("Saved locally — cloud sync failed", true);
  } finally {
    boardSaving = false;
    if (queuedSave) {
      queuedSave = false;
      scheduleCloudBoardSave(1200);
    }
  }
}

function scheduleBoardSave(reason = "change") {
  if (!currentUser || !activeBoardId || boardLoading) return;
  pendingBoardChangeReason = reason || "change";
  clearTimeout(localBoardSaveTimer);
  localBoardSaveTimer = window.setTimeout(async () => {
    const local = await flushCurrentBoardLocal();
    if (local?.dirty) scheduleCloudBoardSave();
    pendingBoardChangeReason = "";
  }, LOCAL_SAVE_DELAY);
}

async function fetchBoards() {
  if (!currentUser || !db || !firestoreSdk) return [];
  const snapshot = await firestoreSdk.getDocs(boardCollection(currentUser.uid));
  boardList = sortBoards(snapshot.docs.map(normalizeBoardMetadata));
  boardListLoadedFromNetwork = true;

  // Inline boards arrive with their full state in the same billed document read.
  for (const board of boardList) {
    if (!Array.isArray(board.inlineObjects)) continue;
    const cloudSnapshot = snapshotFromBoard(board, board.inlineObjects);
    const local = await readLocalBoardSnapshot(currentUser.uid, board.id);
    if (!local || (!local.dirty && Number(local.revision) <= board.revision)) {
      await writeLocalBoardSnapshot(currentUser.uid, board.id, {
        snapshot: cloudSnapshot,
        revision: board.revision,
        cloudContentHash: board.cloudContentHash || contentHashForSnapshot(cloudSnapshot),
        contentHash: board.cloudContentHash || contentHashForSnapshot(cloudSnapshot),
        dirty: false
      });
      boardLocalHashes.set(board.id, localHashForSnapshot(cloudSnapshot));
    }
  }

  cacheBoardListMetadata();
  return boardList;
}

async function refreshSingleBoardMetadata(boardId) {
  const snapshot = await firestoreSdk.getDoc(boardDocument(currentUser.uid, boardId));
  if (!snapshot.exists()) throw new Error("Board no longer exists.");
  const board = normalizeBoardMetadata(snapshot);
  const index = boardList.findIndex(item => item.id === boardId);
  if (index >= 0) boardList[index] = board;
  else boardList.push(board);
  boardList = sortBoards(boardList);
  cacheBoardListMetadata();
  return board;
}

async function readCloudBoardSnapshot(board) {
  let meta = board;
  if (!meta) throw new Error("Board not found.");

  if (meta.storageFormat === "inline-v2" && !Array.isArray(meta.inlineObjects)) {
    meta = await refreshSingleBoardMetadata(meta.id);
  }

  if (meta.storageFormat === "inline-v2" && Array.isArray(meta.inlineObjects)) {
    return { snapshot: snapshotFromBoard(meta, meta.inlineObjects), legacy: false };
  }

  if (meta.storageFormat === "chunked-v2") {
    const chunkSnapshot = await firestoreSdk.getDocs(boardStateCollection(currentUser.uid, meta.id));
    const docs = [...chunkSnapshot.docs].sort((a, b) => a.id.localeCompare(b.id));
    const objects = docs.flatMap(docSnapshot => {
      const data = docSnapshot.data() || {};
      return Array.isArray(data.objects) ? data.objects : [];
    });
    return { snapshot: snapshotFromBoard(meta, objects), legacy: false };
  }

  // One-time migration path for boards created by the earlier object-per-document build.
  const objectSnapshot = await firestoreSdk.getDocs(legacyBoardObjectsCollection(currentUser.uid, meta.id));
  const objects = objectSnapshot.docs.map(docSnapshot => {
    const data = cleanFirestoreValue(docSnapshot.data() || {});
    return { ...data, id: docSnapshot.id };
  });
  return { snapshot: snapshotFromBoard(meta, objects), legacy: true };
}

async function resolveBoardSnapshot(boardId) {
  let board = boardList.find(item => item.id === boardId);
  if (!board) board = await refreshSingleBoardMetadata(boardId);

  const local = await readLocalBoardSnapshot(currentUser.uid, boardId);
  if (local?.snapshot) {
    const localRevision = Math.max(0, Number(local.revision) || 0);
    if ((local.dirty && localRevision >= board.revision) || (!local.dirty && localRevision === board.revision)) {
      board.localDirty = Boolean(local.dirty);
      boardLocalHashes.set(boardId, localHashForSnapshot(local.snapshot));
      return { snapshot: cleanBoardSnapshot(local.snapshot), fromLocal: true, dirty: Boolean(local.dirty), legacy: false };
    }
  }

  const cloud = await readCloudBoardSnapshot(board);
  const clean = cleanBoardSnapshot(cloud.snapshot);
  const hash = contentHashForSnapshot(clean);
  if (!board.cloudContentHash) board.cloudContentHash = hash;
  board.needsMigration = Boolean(cloud.legacy);
  board.localDirty = Boolean(cloud.legacy);
  updateBoardMemoryFromSnapshot(board, clean, { previewObjects: Array.isArray(board.inlineObjects) ? board.inlineObjects.slice(0, 48) : buildCompactPreviewObjects(clean.objects) });

  await writeLocalBoardSnapshot(currentUser.uid, boardId, {
    snapshot: clean,
    revision: board.revision,
    cloudContentHash: board.cloudContentHash,
    contentHash: hash,
    dirty: Boolean(cloud.legacy)
  });
  boardLocalHashes.set(boardId, localHashForSnapshot(clean));
  cacheBoardListMetadata();
  return { snapshot: clean, fromLocal: false, dirty: Boolean(cloud.legacy), legacy: Boolean(cloud.legacy) };
}

async function loadBoard(boardId, { closeView = true } = {}) {
  if (!currentUser || !boardId || !db || !firestoreSdk) return;
  const api = boardApi();
  if (!api) return;

  boardLoading = true;
  setBoardStatus("Loading…");

  try {
    const resolved = await resolveBoardSnapshot(boardId);
    activeBoardId = boardId;
    localStorage.setItem(activeBoardStorageKey(currentUser.uid), activeBoardId);
    api.setActiveBoardId(activeBoardId);

    const result = api.load(resolved.snapshot);
    const board = boardList.find(item => item.id === boardId);
    if (board) updateBoardMemoryFromSnapshot(board, resolved.snapshot);
    boardList = sortBoards(boardList);
    cacheBoardListMetadata();
    setBoardStatus("");

    if (result?.removedObjectIds?.length) {
      const compatibleSnapshot = cleanBoardSnapshot(api.capture());
      await cacheSnapshotLocally(boardId, compatibleSnapshot, { dirty: true });
      scheduleCloudBoardSave(1800);
    } else if (resolved.dirty || resolved.legacy) {
      scheduleCloudBoardSave(resolved.legacy ? 2200 : CLOUD_SAVE_DELAY);
    }

    if (closeView) closeBoardsView();
  } catch (error) {
    console.error("TeacherTiles board load failed", error);
    setBoardStatus("Could not load board", true);
  } finally {
    boardLoading = false;
  }
}

function createBoardReference() {
  return firestoreSdk.doc(boardCollection(currentUser.uid));
}

async function createInitialBoardFromWorkspace() {
  const api = boardApi();
  if (!api) return null;
  const ref = createBoardReference();
  const snapshot = cleanBoardSnapshot(api.capture());
  const name = "Board 1";
  const board = {
    id: ref.id,
    name,
    theme: snapshot.theme,
    camera: snapshot.camera,
    calendarEvents: snapshot.calendarEvents,
    preview: snapshot.preview,
    previewObjects: buildCompactPreviewObjects(snapshot.objects),
    inlineObjects: null,
    objectCount: snapshot.objects.length,
    schemaVersion: snapshot.schemaVersion,
    revision: 0,
    cloudContentHash: "",
    storageFormat: "inline-v2",
    stateChunkCount: 0,
    stateChunkHashes: [],
    legacyCleanupPending: false,
    needsMigration: false,
    localDirty: true,
    createdAt: { seconds: Date.now() / 1000 },
    updatedAt: { seconds: Date.now() / 1000 }
  };
  boardList = [board];
  activeBoardId = ref.id;
  localStorage.setItem(activeBoardStorageKey(currentUser.uid), activeBoardId);
  api.setActiveBoardId(activeBoardId);
  await cacheSnapshotLocally(ref.id, snapshot, { dirty: true });
  await writeBoardSnapshotToCloud(ref.id, name, snapshot, { isNew: true });
  cacheBoardListMetadata();
  return board;
}

function nextBoardName() {
  const used = new Set(boardList.map(board => board.name));
  let n = 1;
  while (used.has(`Board ${n}`)) n++;
  return `Board ${n}`;
}

async function createBlankBoard({ skipSave = false, closeView = true } = {}) {
  if (!currentUser || !firestoreSdk || !db) return;
  const api = boardApi();
  if (!api) return;

  if (!skipSave) await saveCurrentBoard({ immediate: true });

  const ref = createBoardReference();
  const snapshot = cleanBoardSnapshot(api.blank());
  const name = nextBoardName();
  const board = {
    id: ref.id,
    name,
    theme: snapshot.theme,
    camera: snapshot.camera,
    calendarEvents: [],
    preview: [],
    previewObjects: [],
    inlineObjects: null,
    objectCount: 0,
    schemaVersion: snapshot.schemaVersion,
    revision: 0,
    cloudContentHash: "",
    storageFormat: "inline-v2",
    stateChunkCount: 0,
    stateChunkHashes: [],
    legacyCleanupPending: false,
    needsMigration: false,
    localDirty: true,
    createdAt: { seconds: Date.now() / 1000 },
    updatedAt: { seconds: Date.now() / 1000 }
  };

  setBoardStatus("Creating…");
  try {
    boardList.push(board);
    await cacheSnapshotLocally(ref.id, snapshot, { dirty: true });
    await writeBoardSnapshotToCloud(ref.id, name, snapshot, { isNew: true });

    activeBoardId = ref.id;
    localStorage.setItem(activeBoardStorageKey(currentUser.uid), activeBoardId);
    api.setActiveBoardId(activeBoardId);
    api.load(snapshot);
    boardList = sortBoards(boardList);
    cacheBoardListMetadata();
    setBoardStatus("");
    if (closeView) closeBoardsView();
    else renderBoards();
  } catch (error) {
    boardList = boardList.filter(item => item.id !== ref.id);
    console.error("TeacherTiles board creation failed", error);
    setBoardStatus("Could not create board", true);
  }
}

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
      width: Math.max(24, Number(transform.width) || 160),
      height: Math.max(24, Number(transform.height) || 120)
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
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);

  return boxes.map(({ state, left, top, width, height }) => ({
    type: state.type,
    x: Math.max(0, Math.min(1, (left - minX) / spanX)),
    y: Math.max(0, Math.min(1, (top - minY) / spanY)),
    w: Math.max(.025, Math.min(.72, width / spanX)),
    h: Math.max(.025, Math.min(.72, height / spanY)),
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

function applyPreviewState(module, state) {
  if (!module || !state) return;

  for (const element of module.querySelectorAll("[id]")) element.removeAttribute("id");
  module.removeAttribute("id");
  module.setAttribute("aria-hidden", "true");

  if (state.dataset && typeof state.dataset === "object") {
    for (const [key, value] of Object.entries(state.dataset)) {
      if (key === "type" || key === "boardObjectId") continue;
      module.dataset[key] = String(value);
    }
  }

  for (const cls of Array.isArray(state.classes) ? state.classes : []) module.classList.add(cls);

  const controls = [...module.querySelectorAll("input,textarea,select")];
  for (const saved of Array.isArray(state.fields) ? state.fields : []) {
    const field = controls[saved.index];
    if (!field) continue;
    if (typeof saved.value === "string") field.value = saved.value;
    if (saved.checked !== undefined && "checked" in field) field.checked = Boolean(saved.checked);
    field.tabIndex = -1;
  }

  const editables = [...module.querySelectorAll('[contenteditable]:not([contenteditable="false"])')];
  for (const saved of Array.isArray(state.editables) ? state.editables : []) {
    const editable = editables[saved.index];
    if (!editable) continue;
    editable.textContent = plainTextFromSavedHtml(saved.html);
    editable.removeAttribute("contenteditable");
  }

  module.querySelectorAll("button,input,textarea,select,a").forEach(control => {
    control.tabIndex = -1;
    control.setAttribute("aria-hidden", "true");
  });
}

function createMiniObject(item) {
  const state = item?.state || null;
  const type = state?.type || item?.type || "";
  const el = document.createElement("span");
  el.className = `board-mini-object${type === "sticker" ? " is-sticker" : ""}`;

  const x = Math.max(0, Math.min(1, Number(item.x) || 0));
  const y = Math.max(0, Math.min(1, Number(item.y) || 0));
  const w = Math.max(.025, Math.min(.72, Number(item.w) || .08));
  const h = Math.max(.025, Math.min(.72, Number(item.h) || .08));

  el.style.left = `${x * 100}%`;
  el.style.top = `${y * 100}%`;
  el.style.width = `${w * 100}%`;
  el.style.height = `${h * 100}%`;

  if (type === "sticker") {
    const emoji = state?.sticker?.emoji || item.emoji || "";
    const src = state?.sticker?.src || item.src || "";
    if (emoji) {
      el.textContent = emoji;
      if (state?.transform?.rotation) el.style.transform = `rotate(${Number(state.transform.rotation) || 0}deg)`;
    } else if (src && !String(src).startsWith("data:")) {
      const image = document.createElement("img");
      image.src = src;
      image.alt = "";
      el.appendChild(image);
      if (state?.transform?.rotation) image.style.transform = `rotate(${Number(state.transform.rotation) || 0}deg)`;
    }
    return el;
  }

  if (state) {
    const template = document.getElementById(`${type}-template`);
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
      module.style.transform = "none";
      module.style.transformOrigin = "0 0";
      el.appendChild(module);

      requestAnimationFrame(() => {
        if (!el.isConnected || !module.isConnected) return;
        const scaleX = el.clientWidth / originalWidth;
        const scaleY = el.clientHeight / originalHeight;
        if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY) || scaleX <= 0 || scaleY <= 0) return;
        module.style.transform = `scale(${scaleX}, ${scaleY})`;
      });
      return el;
    }
  }

  el.dataset.previewType = type;
  return el;
}

async function deleteBoard(boardId) {
  if (!currentUser || !db || !firestoreSdk || !boardId || boardDeleting) return;
  const board = boardList.find(item => item.id === boardId);
  if (!board) return;
  if (!window.confirm(`Delete ${board.name}? This cannot be undone.`)) return;

  boardDeleting = true;
  setBoardStatus("Deleting…");
  const wasActive = boardId === activeBoardId;

  try {
    // New-format chunk documents are addressable directly, so deletion needs no reads.
    const stateRefs = [];
    for (let index = 0; index < Math.max(0, Number(board.stateChunkCount) || 0); index++) {
      stateRefs.push(boardStateDocument(currentUser.uid, boardId, index));
    }

    // Legacy object documents are queried only during the rare explicit delete path.
    if (board.legacyCleanupPending || board.storageFormat === "legacy-objects-v1") {
      try {
        const legacy = await firestoreSdk.getDocs(legacyBoardObjectsCollection(currentUser.uid, boardId));
        stateRefs.push(...legacy.docs.map(docSnapshot => docSnapshot.ref));
      } catch (error) {
        console.warn("TeacherTiles could not clean legacy board objects", error);
      }
    }

    for (let index = 0; index < stateRefs.length; index += 400) {
      const batch = firestoreSdk.writeBatch(db);
      for (const ref of stateRefs.slice(index, index + 400)) batch.delete(ref);
      await batch.commit();
    }

    await firestoreSdk.deleteDoc(boardDocument(currentUser.uid, boardId));
    await deleteLocalBoardSnapshot(currentUser.uid, boardId);
    boardList = boardList.filter(item => item.id !== boardId);

    if (wasActive) {
      activeBoardId = "";
      boardApi()?.setActiveBoardId("");
      localStorage.removeItem(activeBoardStorageKey(currentUser.uid));

      const next = sortBoards(boardList)[0];
      if (next) await loadBoard(next.id, { closeView: false });
      else await createBlankBoard({ skipSave: true, closeView: false });
    }

    cacheBoardListMetadata();
    setBoardStatus("");
    renderBoards();
  } catch (error) {
    console.error("TeacherTiles board deletion failed", error);
    setBoardStatus("Could not delete board", true);
  } finally {
    boardDeleting = false;
  }
}

function createBoardCard(board) {
  const card = document.createElement("article");
  card.className = `board-card${board.id === activeBoardId ? " is-active" : ""}`;
  card.dataset.boardId = board.id;

  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.className = "board-card__open";
  openButton.setAttribute("aria-label", `Open ${board.name}`);

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
  preview.appendChild(objects);

  const meta = document.createElement("div");
  meta.className = "board-card__meta";

  const title = document.createElement("strong");
  title.textContent = board.name;

  const count = document.createElement("span");
  const total = Math.max(0, Number(board.objectCount) || 0);
  count.textContent = `${total} ${total === 1 ? "item" : "items"}`;

  meta.append(title, count);
  openButton.append(preview, meta);

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "board-card__delete";
  deleteButton.setAttribute("aria-label", `Delete ${board.name}`);
  deleteButton.title = "Delete board";
  deleteButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8.5h10M9 8.5V6.7h6v1.8m-7 0 .7 9.1h6.6l.7-9.1M10.5 11v4.4M13.5 11v4.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  openButton.addEventListener("click", async () => {
    if (boardLoading || boardDeleting) return;
    if (board.id === activeBoardId) {
      closeBoardsView();
      return;
    }

    openButton.disabled = true;
    try {
      await saveCurrentBoard({ immediate: true });
      await loadBoard(board.id);
    } finally {
      openButton.disabled = false;
    }
  });

  deleteButton.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    deleteBoard(board.id);
  });

  card.append(openButton, deleteButton);
  return card;
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

  // Opening the manager is local-only: no Firestore read and no forced cloud write.
  await flushCurrentBoardLocal();
  boardsLoading.hidden = true;
  renderBoards();
}

async function initializeBoardsForUser(user) {
  if (!user || !db || !firestoreSdk || !boardApi()) return;

  boardLoading = true;
  setBoardStatus("Loading…");

  try {
    const cached = restoreBoardListMetadata(user.uid);
    const cachedIsFresh = Boolean(cached && Date.now() - cached.savedAt < BOARD_LIST_CACHE_TTL && cached.boards.length);

    if (cachedIsFresh) {
      boardList = sortBoards(cached.boards);
      boardListLoadedFromNetwork = false;
      activeBoardId = boardList.some(board => board.id === cached.activeBoardId)
        ? cached.activeBoardId
        : (boardList.some(board => board.id === localStorage.getItem(activeBoardStorageKey(user.uid)))
          ? localStorage.getItem(activeBoardStorageKey(user.uid))
          : boardList[0].id);

      const local = await readLocalBoardSnapshot(user.uid, activeBoardId);
      if (local?.snapshot) {
        boardApi().setActiveBoardId(activeBoardId);
        boardApi().load(cleanBoardSnapshot(local.snapshot));
        const active = boardList.find(board => board.id === activeBoardId);
        if (active) {
          active.localDirty = Boolean(local.dirty);
          updateBoardMemoryFromSnapshot(active, cleanBoardSnapshot(local.snapshot));
        }
        if (local.dirty) scheduleCloudBoardSave(CLOUD_SAVE_DELAY);
        setBoardStatus("");
        return;
      }
    }

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
      boardLocalHashes.clear();
      localBoardMemory.clear();
      boardListLoadedFromNetwork = false;
      await initializeBoardsForUser(user);
    }
  } else {
    clearTimeout(localBoardSaveTimer);
    clearTimeout(cloudBoardSaveTimer);
    activeBoardId = "";
    boardList = [];
    boardLocalHashes.clear();
    localBoardMemory.clear();
    boardListLoadedFromNetwork = false;
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

window.addEventListener("teachertiles:boardchange", event => {
  scheduleBoardSave(event?.detail?.reason || "change");
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
