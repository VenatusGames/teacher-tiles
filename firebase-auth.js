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
const profileBetaBadge = document.getElementById("profile-beta-badge");
const profileBadgeCount = document.getElementById("profile-badge-count");
const status = document.getElementById("profile-auth-status");
const saveWarning = document.getElementById("signed-out-save-warning");

const classSyncButton = document.getElementById("profile-class-sync-button");
const classSyncSummary = document.getElementById("profile-class-sync-summary");
const classSyncPanel = document.getElementById("profile-class-sync-panel");
const classSyncBack = document.getElementById("profile-class-sync-back");
const classSyncBackdrop = document.querySelector("#profile-class-sync-panel .class-sync-window__backdrop");
const classSyncStateBadge = document.getElementById("class-sync-state-badge");
const classSyncStateTitle = document.getElementById("class-sync-state-title");
const classSyncStateCopy = document.getElementById("class-sync-state-copy");
const classSyncForm = document.getElementById("class-sync-form");
const classSyncPassphrase = document.getElementById("class-sync-passphrase");
const classSyncConfirmWrap = document.getElementById("class-sync-confirm-wrap");
const classSyncConfirm = document.getElementById("class-sync-confirm");
const classSyncSubmit = document.getElementById("class-sync-submit");
const classSyncChange = document.getElementById("class-sync-change");
const classSyncRetry = document.getElementById("class-sync-retry");
const classSyncFeedback = document.getElementById("class-sync-feedback");
if (classSyncPanel && classSyncPanel.parentElement !== document.body) document.body.appendChild(classSyncPanel);

const boardsToggle = document.getElementById("boards-toggle");
const boardsView = document.getElementById("boards-view");
const boardsBack = document.getElementById("boards-back");
const boardsGrid = document.getElementById("boards-grid");
const boardsLoading = document.getElementById("boards-loading");
const boardsSaveStatus = document.getElementById("boards-save-status");

const gatedFeatureIds = new Set(["theme-shelf-toggle", "sticker-shelf-toggle", "tile-skins-shelf-toggle", "shop-toggle", "boards-toggle"]);
const subscriberMarkSvg = `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="m7.5 15 10.1 7.1L24 9l6.4 13.1L40.5 15l-4.2 22H11.7L7.5 15Z"/><path d="M12.7 31.5h22.6M15.7 26.6h16.6"/></svg>`;

let auth = null;
let authSdk = null;
let firestoreSdk = null;
let db = null;
let currentUser = null;
let authReady = false;
let busy = false;
let lastFocused = null;

let classKeyEnvelope = null;
let classSyncDocumentExists = false;
let classSyncHasCiphertext = false;
let classSyncMode = "setup";
let classSyncBusy = false;

let boardList = [];
let activeBoardId = "";
let boardLoading = false;
let boardDeleting = false;
let boardRenaming = false;
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
const classEncryptionKeyStorageKey = uid => `teachertiles-class-key-${uid}`;
const classSyncOfferStorageKey = uid => `teachertiles-class-sync-offered-${uid}`;
const CLASS_SYNC_KDF_ITERATIONS = 310000;
const CLASS_SYNC_MIN_PASSPHRASE_LENGTH = 10;

function classesDocument(uid) {
  return firestoreSdk.doc(db, "users", uid, "private", "classes");
}

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function normalizeClassSyncPassphrase(value) {
  return String(value || "").normalize("NFKC");
}

function hasCachedClassEncryptionKey(uid = currentUser?.uid) {
  if (!uid) return false;
  try {
    return base64ToBytes(localStorage.getItem(classEncryptionKeyStorageKey(uid)) || "").length === 32;
  } catch {
    return false;
  }
}

async function getClassEncryptionKeyBytes(uid, { create = false } = {}) {
  const storageKey = classEncryptionKeyStorageKey(uid);
  let encoded = localStorage.getItem(storageKey) || "";
  if (!encoded && create) {
    const raw = crypto.getRandomValues(new Uint8Array(32));
    encoded = bytesToBase64(raw);
    localStorage.setItem(storageKey, encoded);
    return raw;
  }
  if (!encoded) return null;
  const raw = base64ToBytes(encoded);
  if (raw.length !== 32) throw new Error("The cached class encryption key is invalid");
  return raw;
}

async function getClassEncryptionKey(uid, { create = false } = {}) {
  const raw = await getClassEncryptionKeyBytes(uid, { create });
  if (!raw) return null;
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function normalizeClassKeyEnvelope(value) {
  if (!value || typeof value !== "object") return null;
  const iterations = Math.max(100000, Number(value.iterations) || CLASS_SYNC_KDF_ITERATIONS);
  if (Number(value.version) !== 1 || value.kdf !== "PBKDF2-SHA-256" || value.algorithm !== "AES-GCM-256") return null;
  if (![value.salt, value.iv, value.ciphertext].every(item => typeof item === "string" && item)) return null;
  return {
    version: 1,
    kdf: "PBKDF2-SHA-256",
    iterations,
    algorithm: "AES-GCM-256",
    salt: value.salt,
    iv: value.iv,
    ciphertext: value.ciphertext
  };
}

function classSyncAdditionalData(uid) {
  return new TextEncoder().encode(`TeacherTiles:classes:${uid}:key-envelope-v1`);
}

async function deriveClassSyncWrappingKey(passphrase, salt, iterations = CLASS_SYNC_KDF_ITERATIONS) {
  const normalized = normalizeClassSyncPassphrase(passphrase);
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(normalized),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function createClassKeyEnvelope(uid, rawClassKey, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrappingKey = await deriveClassSyncWrappingKey(passphrase, salt);
  const wrapped = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: classSyncAdditionalData(uid) },
    wrappingKey,
    rawClassKey
  );
  return {
    version: 1,
    kdf: "PBKDF2-SHA-256",
    iterations: CLASS_SYNC_KDF_ITERATIONS,
    algorithm: "AES-GCM-256",
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(wrapped))
  };
}

async function unwrapClassKeyEnvelope(uid, envelope, passphrase) {
  const normalized = normalizeClassKeyEnvelope(envelope);
  if (!normalized) throw new Error("The saved Class Sync key is invalid");
  const wrappingKey = await deriveClassSyncWrappingKey(passphrase, base64ToBytes(normalized.salt), normalized.iterations);
  const raw = new Uint8Array(await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64ToBytes(normalized.iv),
      additionalData: classSyncAdditionalData(uid)
    },
    wrappingKey,
    base64ToBytes(normalized.ciphertext)
  ));
  if (raw.length !== 32) throw new Error("The saved Class Sync key is invalid");
  return raw;
}

async function decryptClassesValue(value, key) {
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(value.iv) },
    key,
    base64ToBytes(value.ciphertext)
  );
  const classes = JSON.parse(new TextDecoder().decode(plaintext));
  return Array.isArray(classes) ? classes : [];
}

function dispatchEncryptedClassesLoaded(classes) {
  window.dispatchEvent(new CustomEvent("teachertiles:encryptedclassesloaded", { detail: { classes } }));
}

async function saveEncryptedClasses(classes) {
  if (!currentUser || !db || !firestoreSdk || !crypto?.subtle) throw new Error("Encrypted class storage is unavailable");
  const key = await getClassEncryptionKey(currentUser.uid, { create: true });
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(Array.isArray(classes) ? classes : []));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  const payload = {
    version: classKeyEnvelope ? 2 : 1,
    algorithm: "AES-GCM-256",
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    updatedAt: firestoreSdk.serverTimestamp()
  };
  if (classKeyEnvelope) payload.keyEnvelope = classKeyEnvelope;
  await firestoreSdk.setDoc(classesDocument(currentUser.uid), payload, { merge: true });
  classSyncDocumentExists = true;
  classSyncHasCiphertext = true;
  refreshClassSyncUi();
}

function maybeOfferClassSyncSetup() {
  if (!currentUser || !classSyncHasCiphertext || classKeyEnvelope || !hasCachedClassEncryptionKey(currentUser.uid)) return;
  const offerKey = classSyncOfferStorageKey(currentUser.uid);
  if (localStorage.getItem(offerKey) === "1") return;
  localStorage.setItem(offerKey, "1");
  setTimeout(() => openClassSyncPanel("setup"), 0);
}

async function loadEncryptedClasses({ promptForUnlock = true } = {}) {
  if (!currentUser || !db || !firestoreSdk || !crypto?.subtle) return [];
  const snapshot = await firestoreSdk.getDoc(classesDocument(currentUser.uid));
  classSyncDocumentExists = snapshot.exists();
  if (!snapshot.exists()) {
    classSyncHasCiphertext = false;
    classKeyEnvelope = null;
    classSyncMode = "setup";
    refreshClassSyncUi();
    return [];
  }

  const value = snapshot.data() || {};
  classSyncHasCiphertext = Boolean(value.ciphertext && value.iv);
  classKeyEnvelope = normalizeClassKeyEnvelope(value.keyEnvelope);

  if (!classSyncHasCiphertext) {
    classSyncMode = classKeyEnvelope && !hasCachedClassEncryptionKey(currentUser.uid) ? "unlock" : (classKeyEnvelope ? "ready" : "setup");
    refreshClassSyncUi();
    if (classSyncMode === "unlock" && promptForUnlock) openClassSyncPanel("unlock");
    return [];
  }

  let key = await getClassEncryptionKey(currentUser.uid);
  if (key) {
    try {
      const classes = await decryptClassesValue(value, key);
      classSyncMode = classKeyEnvelope ? "ready" : "setup";
      refreshClassSyncUi();
      dispatchEncryptedClassesLoaded(classes);
      maybeOfferClassSyncSetup();
      return classes;
    } catch (error) {
      if (!classKeyEnvelope) throw error;
      localStorage.removeItem(classEncryptionKeyStorageKey(currentUser.uid));
      key = null;
    }
  }

  if (classKeyEnvelope) {
    classSyncMode = "unlock";
    refreshClassSyncUi();
    if (promptForUnlock) openClassSyncPanel("unlock");
    return [];
  }

  classSyncMode = "legacy-missing";
  refreshClassSyncUi();
  if (promptForUnlock) openClassSyncPanel("legacy-missing");
  return [];
}

async function enableOrChangeClassSync(passphrase) {
  if (!currentUser || !db || !firestoreSdk || !crypto?.subtle) throw new Error("Class Sync is unavailable");
  const normalized = normalizeClassSyncPassphrase(passphrase);
  if (normalized.length < CLASS_SYNC_MIN_PASSPHRASE_LENGTH) throw new Error(`Use at least ${CLASS_SYNC_MIN_PASSPHRASE_LENGTH} characters for the sync passphrase`);

  const snapshot = await firestoreSdk.getDoc(classesDocument(currentUser.uid));
  const cloudValue = snapshot.exists() ? (snapshot.data() || {}) : {};
  classSyncDocumentExists = snapshot.exists();
  classSyncHasCiphertext = Boolean(cloudValue.ciphertext && cloudValue.iv);
  const cloudEnvelope = normalizeClassKeyEnvelope(cloudValue.keyEnvelope);
  if (cloudEnvelope) classKeyEnvelope = cloudEnvelope;

  let raw = await getClassEncryptionKeyBytes(currentUser.uid);
  if (classSyncHasCiphertext) {
    if (!raw) throw new Error("Unlock these classes on a device that already has the encryption key before setting a new sync passphrase");
    const candidateKey = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["decrypt"]);
    try {
      await decryptClassesValue(cloudValue, candidateKey);
    } catch {
      throw new Error("This browser's cached class key does not match the encrypted cloud roster. Unlock Class Sync before changing its passphrase.");
    }
  }
  if (!raw) raw = await getClassEncryptionKeyBytes(currentUser.uid, { create: true });

  const envelope = await createClassKeyEnvelope(currentUser.uid, raw, normalized);
  await firestoreSdk.setDoc(classesDocument(currentUser.uid), {
    version: 2,
    keyEnvelope: envelope,
    updatedAt: firestoreSdk.serverTimestamp()
  }, { merge: true });
  classKeyEnvelope = envelope;
  classSyncDocumentExists = true;
  classSyncMode = "ready";
  refreshClassSyncUi();
  window.dispatchEvent(new CustomEvent("teachertiles:classsyncenabled"));
}

async function unlockClassSync(passphrase) {
  if (!currentUser || !classKeyEnvelope) throw new Error("No Class Sync key is available for this account");
  const normalized = normalizeClassSyncPassphrase(passphrase);
  if (!normalized) throw new Error("Enter your Class Sync passphrase");
  let raw;
  try {
    raw = await unwrapClassKeyEnvelope(currentUser.uid, classKeyEnvelope, normalized);
  } catch {
    throw new Error("That Class Sync passphrase is incorrect");
  }
  localStorage.setItem(classEncryptionKeyStorageKey(currentUser.uid), bytesToBase64(raw));
  await loadEncryptedClasses({ promptForUnlock: false });
  classSyncMode = "ready";
  refreshClassSyncUi();
}

function setStatus(message = "", isError = false) {
  status.textContent = message;
  status.classList.toggle("is-error", isError);
}

function inferredClassSyncMode() {
  if (!currentUser) return "setup";
  const hasKey = hasCachedClassEncryptionKey(currentUser.uid);
  if (classKeyEnvelope) return hasKey ? "ready" : "unlock";
  if (classSyncHasCiphertext && !hasKey) return "legacy-missing";
  return "setup";
}

function setClassSyncFeedback(message = "", isError = false) {
  if (!classSyncFeedback) return;
  classSyncFeedback.textContent = message;
  classSyncFeedback.classList.toggle("is-error", isError);
}

function refreshClassSyncUi() {
  if (!classSyncButton) return;
  const mode = classSyncMode || inferredClassSyncMode();
  const hasKey = Boolean(currentUser && hasCachedClassEncryptionKey(currentUser.uid));
  if (classSyncSummary) {
    if (classKeyEnvelope && hasKey) classSyncSummary.textContent = "Encrypted classes sync across browsers and devices";
    else if (classKeyEnvelope) classSyncSummary.textContent = "Unlock your encrypted classes on this device";
    else if (classSyncHasCiphertext && hasKey) classSyncSummary.textContent = "Enable cross-device access for your encrypted classes";
    else if (classSyncHasCiphertext) classSyncSummary.textContent = "This device needs the original class encryption key";
    else classSyncSummary.textContent = "Set up encrypted class sync across devices";
  }
  classSyncButton.dataset.syncState = classKeyEnvelope ? (hasKey ? "ready" : "locked") : "setup";

  if (!classSyncPanel || classSyncPanel.hidden) return;
  classSyncMode = mode;
  const setupLike = mode === "setup" || mode === "change";
  const unlock = mode === "unlock";
  const legacyMissing = mode === "legacy-missing";
  const ready = mode === "ready";

  if (classSyncStateBadge) {
    classSyncStateBadge.textContent = ready ? "SYNC ENABLED" : unlock ? "LOCKED" : legacyMissing ? "ORIGINAL KEY NEEDED" : mode === "change" ? "CHANGE PASSPHRASE" : "SETUP";
    classSyncStateBadge.dataset.state = ready ? "ready" : unlock || legacyMissing ? "locked" : "setup";
  }
  if (classSyncStateTitle) classSyncStateTitle.textContent = ready
    ? "Your encrypted classes can travel with you"
    : unlock
      ? "Unlock your classes on this device"
      : legacyMissing
        ? "This roster was encrypted before Class Sync"
        : mode === "change"
          ? "Choose a new Class Sync passphrase"
          : "Enable encrypted Class Sync";
  if (classSyncStateCopy) classSyncStateCopy.textContent = ready
    ? "The AES key for your class rosters is wrapped with your Class Sync passphrase. Another browser or device can recover it after you sign in and enter that passphrase."
    : unlock
      ? "Sign-in found your encrypted class data and its wrapped encryption key. Enter the Class Sync passphrase you created on another device to decrypt the roster here."
      : legacyMissing
        ? "The cloud has encrypted class data, but it was created before a cross-device key was saved. Open TeacherTiles in a browser where these classes still load, enable Class Sync there, then come back and retry."
        : mode === "change"
          ? "This re-wraps the same class encryption key with a new passphrase. Your class and PBIS data do not need to be re-created."
          : "Create a separate passphrase that protects the existing AES-256 class key. Only the encrypted key wrapper is saved to Firebase; the passphrase never leaves your browser.";

  if (classSyncForm) classSyncForm.hidden = ready || legacyMissing;
  if (classSyncConfirmWrap) classSyncConfirmWrap.hidden = !setupLike;
  if (classSyncPassphrase) {
    classSyncPassphrase.autocomplete = unlock ? "current-password" : "new-password";
    classSyncPassphrase.placeholder = unlock ? "Enter Class Sync passphrase" : "At least 10 characters";
  }
  if (classSyncSubmit) classSyncSubmit.textContent = unlock ? "Unlock Classes" : mode === "change" ? "Save New Passphrase" : "Enable Class Sync";
  if (classSyncChange) classSyncChange.hidden = !ready;
  if (classSyncRetry) classSyncRetry.hidden = !legacyMissing;
}

function openClassSyncPanel(mode = inferredClassSyncMode()) {
  if (!classSyncPanel || !currentUser) return;
  if (modal.hidden) openProfile();
  classSyncMode = mode;
  classSyncPanel.hidden = false;
  classSyncPanel.setAttribute("aria-hidden", "false");
  classSyncButton?.setAttribute("aria-expanded", "true");
  setClassSyncFeedback();
  if (classSyncPassphrase) classSyncPassphrase.value = "";
  if (classSyncConfirm) classSyncConfirm.value = "";
  refreshClassSyncUi();
  requestAnimationFrame(() => {
    if (mode === "ready") classSyncChange?.focus({ preventScroll: true });
    else if (mode === "legacy-missing") classSyncRetry?.focus({ preventScroll: true });
    else classSyncPassphrase?.focus({ preventScroll: true });
  });
}

function closeClassSyncPanel() {
  if (!classSyncPanel || classSyncPanel.hidden) return;
  classSyncPanel.hidden = true;
  classSyncPanel.setAttribute("aria-hidden", "true");
  classSyncButton?.setAttribute("aria-expanded", "false");
  classSyncMode = inferredClassSyncMode();
  setClassSyncFeedback();
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
  closeClassSyncPanel();
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
    preferences: data.preferences && typeof data.preferences === "object" ? data.preferences : {},
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
    preferences: data.preferences && typeof data.preferences === "object" ? data.preferences : {},
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
    preferences: clean.preferences,
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
    preferences: clean.preferences,
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

function boardUiText(key, fallback) {
  try { return window.TeacherTilesI18n?.t(key) || fallback; } catch { return fallback; }
}

const boardListCacheKey = uid => `teachertiles-board-list-v2-${uid}`;
const localBoardKey = (uid, boardId) => `${uid}:${boardId}`;

function serializableBoardMetadata(board) {
  return {
    id: board.id,
    name: board.name,
    theme: board.theme || "light",
    camera: board.camera || null,
    preferences: board.preferences && typeof board.preferences === "object" ? board.preferences : {},
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
    preferences: board.preferences || {},
    calendarEvents: board.calendarEvents,
    objects,
    preview: board.preview
  });
}

function updateBoardMemoryFromSnapshot(board, snapshot, { previewObjects = null } = {}) {
  if (!board || !snapshot) return;
  board.theme = snapshot.theme;
  board.camera = snapshot.camera;
  board.preferences = snapshot.preferences || {};
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
    preferences: clean.preferences,
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

function showBoardLimitPopup() {
  let popup = document.getElementById("board-limit-popup");
  if (!popup) {
    popup = document.createElement("div");
    popup.id = "board-limit-popup";
    popup.className = "board-limit-popup";
    popup.hidden = true;
    popup.innerHTML = `
      <button class="board-limit-popup__backdrop" type="button" aria-label="Close subscription message"></button>
      <div class="board-limit-popup__card" role="dialog" aria-modal="true" aria-labelledby="board-limit-popup-title">
        <span class="board-limit-popup__crown" aria-hidden="true">${subscriberMarkSvg}</span>
        <strong id="board-limit-popup-title">Subscribe to save more than two boards.</strong>
        <button class="board-limit-popup__close" type="button">Got it</button>
      </div>`;
    document.body.appendChild(popup);
    popup.querySelectorAll(".board-limit-popup__backdrop,.board-limit-popup__close").forEach(button => {
      button.addEventListener("click", () => {
        popup.classList.remove("is-open");
        window.setTimeout(() => popup.hidden = true, 160);
      });
    });
  }
  popup.hidden = false;
  requestAnimationFrame(() => popup.classList.add("is-open"));
  popup.querySelector(".board-limit-popup__close")?.focus({ preventScroll: true });
}

async function createBlankBoard({ skipSave = false, closeView = true } = {}) {
  if (!currentUser || !firestoreSdk || !db) return;
  if (boardList.length >= 2) {
    showBoardLimitPopup();
    return;
  }
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
    preferences: snapshot.preferences || {},
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

  if (state.type === "interactive") {
    const candle = module.dataset.interactiveMode === "candle";
    const hourglassStage = module.querySelector(".hourglass-stage");
    const candleStage = module.querySelector(".candle-stage");
    if (hourglassStage) hourglassStage.hidden = candle;
    if (candleStage) candleStage.hidden = !candle;
    module.querySelectorAll("[data-interactive]").forEach(button => {
      button.classList.toggle("is-active", button.dataset.interactive === (candle ? "candle" : "hourglass"));
    });
  }

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

  const special = state.special && typeof state.special === "object" ? state.special : null;
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
  if (!currentUser || !db || !firestoreSdk || !boardId || boardDeleting || boardRenaming) return;
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

async function renameBoard(boardId, nextName) {
  if (!currentUser || !db || !firestoreSdk || !boardId || boardRenaming) return false;
  const board = boardList.find(item => item.id === boardId);
  const name = String(nextName || "").trim().replace(/\s+/g, " ").slice(0, 80);
  if (!board || !name) return false;
  if (name === board.name) return true;

  boardRenaming = true;
  setBoardStatus("Renaming…");
  try {
    await firestoreSdk.setDoc(boardDocument(currentUser.uid, boardId), {
      name,
      updatedAt: firestoreSdk.serverTimestamp()
    }, { merge: true });
    board.name = name;
    board.updatedAt = { seconds: Date.now() / 1000 };
    cacheBoardListMetadata();
    setBoardStatus("Saved");
    renderBoards();
    window.setTimeout(() => {
      if (boardsSaveStatus?.textContent === "Saved") setBoardStatus("");
    }, 1400);
    return true;
  } catch (error) {
    console.error("TeacherTiles board rename failed", error);
    setBoardStatus("Could not rename board", true);
    return false;
  } finally {
    boardRenaming = false;
  }
}

function beginBoardRename(card, board, title) {
  if (!card || !board || !title || boardLoading || boardDeleting || boardRenaming || card.classList.contains("is-renaming")) return;
  card.classList.add("is-renaming");

  const form = document.createElement("form");
  form.className = "board-card__rename-form";

  const input = document.createElement("input");
  input.className = "board-card__rename-input";
  input.type = "text";
  input.value = board.name;
  input.maxLength = 80;
  input.setAttribute("aria-label", "Board name");

  const save = document.createElement("button");
  save.type = "submit";
  save.className = "board-card__rename-save";
  save.textContent = "Save";

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "board-card__rename-cancel";
  cancel.textContent = "Cancel";

  form.append(input, save, cancel);
  title.replaceWith(form);

  const stopEditing = () => {
    if (!form.isConnected) return;
    form.replaceWith(title);
    card.classList.remove("is-renaming");
  };

  cancel.addEventListener("click", stopEditing);
  input.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      event.preventDefault();
      stopEditing();
    }
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const name = input.value.trim().replace(/\s+/g, " ");
    if (!name) {
      input.setCustomValidity("Enter a board name.");
      input.reportValidity();
      return;
    }
    input.setCustomValidity("");
    input.disabled = true;
    save.disabled = true;
    cancel.disabled = true;
    const renamed = await renameBoard(board.id, name);
    if (!renamed && form.isConnected) {
      input.disabled = false;
      save.disabled = false;
      cancel.disabled = false;
      input.focus();
    }
  });

  requestAnimationFrame(() => {
    input.focus({ preventScroll: true });
    input.select();
  });
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
  title.className = "board-card__title";
  title.textContent = board.name;

  const count = document.createElement("span");
  const total = Math.max(0, Number(board.objectCount) || 0);
  count.textContent = `${total} ${total === 1 ? "item" : "items"}`;

  meta.append(title, count);
  openButton.append(preview);

  const renameButton = document.createElement("button");
  renameButton.type = "button";
  renameButton.className = "board-card__rename";
  renameButton.setAttribute("aria-label", `Rename ${board.name}`);
  renameButton.title = "Rename board";
  renameButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 16.8-.7 3 3-.7L18.2 8.2l-2.3-2.3L5 16.8ZM14.8 7l2.3 2.3M4.3 19.8h15.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "board-card__delete";
  deleteButton.setAttribute("aria-label", `Delete ${board.name}`);
  deleteButton.title = boardUiText("boards.delete", "Delete board");
  deleteButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8.5h10M9 8.5V6.7h6v1.8m-7 0 .7 9.1h6.6l.7-9.1M10.5 11v4.4M13.5 11v4.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  openButton.addEventListener("click", async () => {
    if (boardLoading || boardDeleting || boardRenaming) return;
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

  renameButton.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    beginBoardRename(card, board, title);
  });

  title.addEventListener("dblclick", event => {
    event.preventDefault();
    event.stopPropagation();
    beginBoardRename(card, board, title);
  });

  card.append(openButton, meta, renameButton, deleteButton);
  return card;
}

function createNewBoardCard() {
  const isAtFreeLimit = boardList.length >= 2;
  const button = document.createElement("button");
  button.type = "button";
  button.className = `board-new-card${isAtFreeLimit ? " is-subscriber-gated" : ""}`;
  button.setAttribute("aria-label", isAtFreeLimit ? "Subscribe to save more than two boards" : boardUiText("boards.create", "Create new blank board"));

  const preview = document.createElement("div");
  preview.className = "board-new-card__preview";

  const plus = document.createElement("span");
  plus.className = "board-new-card__plus";
  plus.textContent = "+";

  preview.appendChild(plus);
  if (isAtFreeLimit) {
    const crown = document.createElement("span");
    crown.className = "board-new-card__crown";
    crown.innerHTML = subscriberMarkSvg;
    crown.setAttribute("aria-hidden", "true");
    preview.appendChild(crown);
  }

  const label = document.createElement("strong");
  label.className = "board-new-card__label";
  label.textContent = boardUiText("boards.new", "New Board");

  button.append(preview, label);
  button.addEventListener("click", () => isAtFreeLimit ? showBoardLimitPopup() : createBlankBoard());
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
  if (!user || previousUser?.uid !== user?.uid) {
    classKeyEnvelope = null;
    classSyncDocumentExists = false;
    classSyncHasCiphertext = false;
    classSyncMode = "setup";
    closeClassSyncPanel();
  }
  window.TeacherTilesClassScope = user?.uid || "local";
  window.dispatchEvent(new CustomEvent("teachertiles:classeschange", { detail: { userId: user?.uid || "" } }));
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
    const betaCutoff = Date.parse("2026-08-29T04:00:00Z");
    const createdAt = Date.parse(user.metadata?.creationTime || "");
    const isBetaTester = !Number.isFinite(createdAt) || createdAt <= betaCutoff;
    if (profileBetaBadge) profileBetaBadge.hidden = !isBetaTester;
    if (profileBadgeCount) profileBadgeCount.textContent = isBetaTester ? "1 earned" : "0 earned";
    profileDisplayName.textContent = name;
    profileEmail.textContent = user.email || "Google account";
    profileAvatar.src = photo;
    profileAvatar.alt = `${name}'s Google profile picture`;
    launchAvatar.src = photo;
    launchAvatar.hidden = false;
    toggle.classList.add("is-signed-in");
    toggle.setAttribute("aria-label", `Open ${name}'s profile`);
    boardsToggle?.setAttribute("aria-label", "Open boards");

    loadEncryptedClasses().catch(error => {
      console.error("TeacherTiles could not decrypt class rosters", error);
      setStatus("Saved class rosters could not be opened. Open Class Sync for recovery options.", true);
      classSyncMode = inferredClassSyncMode();
      refreshClassSyncUi();
    });

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
  document.getElementById("tile-skins-shelf-toggle")?.setAttribute("aria-label", user ? "Open Tile Skins shelf" : "Sign in to open Tile Skins");
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
    ? event.target.closest("#theme-shelf-toggle, #sticker-shelf-toggle, #tile-skins-shelf-toggle, #shop-toggle, #boards-toggle")
    : null;

  if (!target || !gatedFeatureIds.has(target.id) || currentUser) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  openProfile();
}, true);

toggle.addEventListener("click", () => modal.hidden ? openProfile() : closeProfile());
classSyncButton?.addEventListener("click", () => openClassSyncPanel(inferredClassSyncMode()));
classSyncBack?.addEventListener("click", closeClassSyncPanel);
classSyncBackdrop?.addEventListener("click", closeClassSyncPanel);
classSyncChange?.addEventListener("click", () => {
  classSyncMode = "change";
  setClassSyncFeedback();
  refreshClassSyncUi();
  requestAnimationFrame(() => classSyncPassphrase?.focus({ preventScroll: true }));
});
classSyncRetry?.addEventListener("click", async () => {
  if (classSyncBusy) return;
  classSyncBusy = true;
  classSyncRetry.disabled = true;
  setClassSyncFeedback("Checking encrypted class data…");
  try {
    await loadEncryptedClasses({ promptForUnlock: false });
    const mode = inferredClassSyncMode();
    classSyncMode = mode;
    setClassSyncFeedback(mode === "legacy-missing" ? "The cloud key is not available yet. Enable Class Sync on an original device first." : "Class Sync information refreshed.", mode === "legacy-missing");
    refreshClassSyncUi();
  } catch (error) {
    setClassSyncFeedback(error?.message || "Could not refresh Class Sync.", true);
  } finally {
    classSyncBusy = false;
    classSyncRetry.disabled = false;
  }
});
classSyncForm?.addEventListener("submit", async event => {
  event.preventDefault();
  if (classSyncBusy || !currentUser) return;
  const passphrase = normalizeClassSyncPassphrase(classSyncPassphrase?.value || "");
  const confirmPassphrase = normalizeClassSyncPassphrase(classSyncConfirm?.value || "");
  if ((classSyncMode === "setup" || classSyncMode === "change") && passphrase !== confirmPassphrase) {
    setClassSyncFeedback("The two Class Sync passphrases do not match.", true);
    classSyncConfirm?.focus();
    return;
  }
  const actionMode = classSyncMode;
  classSyncBusy = true;
  if (classSyncSubmit) classSyncSubmit.disabled = true;
  setClassSyncFeedback(actionMode === "unlock" ? "Unlocking encrypted classes…" : "Securing your cross-device class key…");
  try {
    if (actionMode === "unlock") {
      await unlockClassSync(passphrase);
      setClassSyncFeedback("Classes unlocked. This browser can now read and save your encrypted rosters.");
    } else {
      await enableOrChangeClassSync(passphrase);
      setClassSyncFeedback(actionMode === "change" ? "Class Sync passphrase updated." : "Class Sync enabled. Your encrypted classes can now be unlocked on other devices.");
      classSyncMode = "ready";
    }
    if (classSyncPassphrase) classSyncPassphrase.value = "";
    if (classSyncConfirm) classSyncConfirm.value = "";
    refreshClassSyncUi();
  } catch (error) {
    setClassSyncFeedback(error?.message || "Class Sync could not be updated.", true);
  } finally {
    classSyncBusy = false;
    if (classSyncSubmit) classSyncSubmit.disabled = false;
  }
});

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

["theme-shelf-toggle", "sticker-shelf-toggle", "tile-skins-shelf-toggle", "shop-toggle"].forEach(id => {
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

window.TeacherTilesEncryptedClasses = {
  save: saveEncryptedClasses,
  load: loadEncryptedClasses,
  enableSync: enableOrChangeClassSync,
  unlockSync: unlockClassSync,
  get syncEnabled() { return Boolean(classKeyEnvelope); },
  get unlocked() { return Boolean(currentUser && hasCachedClassEncryptionKey(currentUser.uid)); }
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
