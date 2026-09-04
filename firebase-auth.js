const firebaseConfig = {
  apiKey: "AIzaSyBa1AkZfYLemz4gDAI505704wsG1CC_sSQ",
  authDomain: "auth.teachertiles.com",
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
const classSyncRetry = document.getElementById("class-sync-retry");
const classSyncFeedback = document.getElementById("class-sync-feedback");
if (classSyncPanel && classSyncPanel.parentElement !== document.body) document.body.appendChild(classSyncPanel);

const organizationButton = document.getElementById("profile-organizations-button");
const organizationPanel = document.getElementById("profile-organizations-panel");
const organizationBack = document.getElementById("profile-organizations-back");
const organizationClose = document.getElementById("profile-organizations-close");
const organizationListView = document.getElementById("organization-list-view");
const organizationEditorView = document.getElementById("organization-editor-view");
const organizationCreateForm = document.getElementById("organization-create-form");
const organizationCreateName = document.getElementById("organization-create-name");
const organizationListElement = document.getElementById("organization-list");
const organizationCount = document.getElementById("organization-count");
const organizationFeedback = document.getElementById("organization-feedback");
const organizationInvitations = document.getElementById("organization-invitations");
const organizationInvitationCount = document.getElementById("organization-invitation-count");
const organizationInvitationList = document.getElementById("organization-invitation-list");
const organizationEditorBack = document.getElementById("organization-editor-back");
const organizationEditorDone = document.getElementById("organization-editor-done");
const organizationNameInput = document.getElementById("organization-name");
const organizationEditorTitle = document.getElementById("organization-editor-title");
const organizationEditorMeta = document.getElementById("organization-editor-meta");
const organizationEditorLogo = document.getElementById("organization-editor-logo");
const organizationCurrentRole = document.getElementById("organization-current-role");
const organizationEditorFeedback = document.getElementById("organization-editor-feedback");
const organizationLogoEditor = document.getElementById("organization-logo-editor");
const organizationLogoOptions = document.getElementById("organization-logo-options");
const organizationCustomLogo = document.getElementById("organization-custom-logo");
const organizationInviteForm = document.getElementById("organization-invite-form");
const organizationInviteEmail = document.getElementById("organization-invite-email");
const organizationMemberCount = document.getElementById("organization-member-count");
const organizationMemberList = document.getElementById("organization-member-list");
const organizationPendingSection = document.getElementById("organization-pending-section");
const organizationPendingCount = document.getElementById("organization-pending-count");
const organizationPendingList = document.getElementById("organization-pending-list");
const organizationDangerZone = document.getElementById("organization-danger-zone");
const organizationDelete = document.getElementById("organization-delete");
const notificationButton = document.getElementById("profile-notification-button");
const notificationCount = document.getElementById("profile-notification-count");
const notificationMenu = document.getElementById("profile-notification-menu");
const notificationSummary = document.getElementById("profile-notification-summary");
const notificationList = document.getElementById("profile-notification-list");
if (organizationPanel && organizationPanel.parentElement !== document.body) document.body.appendChild(organizationPanel);

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
let organizationBusy = false;
let organizationMemberships = [];
let organizationInvites = [];
let activeOrganization = null;
let activeOrganizationMembers = [];
let activeOrganizationInvites = [];
let organizationInvitesLoadedAt = 0;
let organizationInvitesPromise = null;
let organizationIndexLoadedAt = 0;
let organizationIndexPromise = null;
const organizationDetailCache = new Map();
const organizationDetailPromises = new Map();
let organizationLogoDraft = "🏫";
let organizationLogoFreshFocus = false;

const ORGANIZATION_LOGO_OPTIONS = Object.freeze([
  "🏫", "🏢", "🏛️", "📚", "🎓", "🍎",
  "🤝", "🌟", "🚀", "🌈", "🧩", "🦉"
]);

let classSyncDocumentExists = false;
let classSyncHasCiphertext = false;
let classSyncMode = "checking";
let classSyncBusy = false;
let classEncryptionKeyBytes = null;
let classEncryptionKeyUid = "";
let automaticClassKeyPromise = null;
let classKeyProtection = "";
let classSyncLastError = "";

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
const BOARD_LIST_CACHE_TTL = 10 * 60 * 1000;
const SESSION_CLOUD_RECHECK_TTL = 10 * 60 * 1000;
const ORGANIZATION_CACHE_TTL = 5 * 60 * 1000;
const INLINE_OBJECT_BUDGET = 560000;
const CHUNK_OBJECT_BUDGET = 520000;
const MAX_SINGLE_OBJECT_BYTES = 900000;
const PREVIEW_OBJECT_BUDGET = 90000;

const boardApi = () => window.TeacherTilesBoard || null;
const activeBoardStorageKey = uid => `teachertiles-active-board-${uid}`;
const classEncryptionKeyStorageKey = uid => `teachertiles-class-key-${uid}`;
const classEncryptionKeySessionStorageKey = uid => `teachertiles-class-key-session-${uid}`;
const classCloudLoadedSessionStorageKey = uid => `teachertiles-class-cloud-loaded-session-${uid}`;
const boardCloudLoadedSessionStorageKey = uid => `teachertiles-board-cloud-loaded-session-${uid}`;

function classesDocument(uid) {
  return firestoreSdk.doc(db, "users", uid, "private", "classes");
}

function classKeyVaultDocument(uid) {
  return firestoreSdk.doc(db, "users", uid, "private", "classKey");
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

function legacyClassEncryptionKeyBytes(uid = currentUser?.uid) {
  if (!uid) return null;
  try {
    const raw = base64ToBytes(localStorage.getItem(classEncryptionKeyStorageKey(uid)) || "");
    return raw.length === 32 ? raw : null;
  } catch {
    return null;
  }
}

function sessionClassEncryptionKeyBytes(uid = currentUser?.uid) {
  if (!uid) return null;
  try {
    const raw = base64ToBytes(sessionStorage.getItem(classEncryptionKeySessionStorageKey(uid)) || "");
    return raw.length === 32 ? raw : null;
  } catch {
    return null;
  }
}

function cacheClassEncryptionKeyForSession(uid, raw) {
  if (!uid || !raw?.length) return;
  try { sessionStorage.setItem(classEncryptionKeySessionStorageKey(uid), bytesToBase64(raw)); } catch {}
}

function markClassCloudLoadedForSession(uid) {
  if (!uid) return;
  const value = String(Date.now());
  try { sessionStorage.setItem(classCloudLoadedSessionStorageKey(uid), value); } catch {}
  try { localStorage.setItem(classCloudLoadedSessionStorageKey(uid), value); } catch {}
}

function classCloudAlreadyLoadedThisSession(uid) {
  if (!uid) return false;
  try {
    const checkedAt = Math.max(
      Number(sessionStorage.getItem(classCloudLoadedSessionStorageKey(uid)) || 0),
      Number(localStorage.getItem(classCloudLoadedSessionStorageKey(uid)) || 0)
    );
    return checkedAt > 0 && Date.now() - checkedAt < SESSION_CLOUD_RECHECK_TTL;
  } catch { return false; }
}

function markBoardCloudLoadedForSession(uid) {
  if (!uid) return;
  const value = String(Date.now());
  try { sessionStorage.setItem(boardCloudLoadedSessionStorageKey(uid), value); } catch {}
  try { localStorage.setItem(boardCloudLoadedSessionStorageKey(uid), value); } catch {}
}

function boardCloudAlreadyLoadedThisSession(uid) {
  if (!uid) return false;
  try {
    const checkedAt = Math.max(
      Number(sessionStorage.getItem(boardCloudLoadedSessionStorageKey(uid)) || 0),
      Number(localStorage.getItem(boardCloudLoadedSessionStorageKey(uid)) || 0)
    );
    return checkedAt > 0 && Date.now() - checkedAt < SESSION_CLOUD_RECHECK_TTL;
  } catch { return false; }
}

function hasLocalClassRosterSnapshot(uid) {
  if (!uid) return false;
  try { return localStorage.getItem(`teachertiles-class-rosters-v1:${uid}`) !== null; } catch { return false; }
}

function setActiveClassEncryptionKey(uid, raw, { removeLegacy = false } = {}) {
  const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw || []);
  if (!uid || bytes.length !== 32) throw new Error("The class encryption key is invalid");
  classEncryptionKeyUid = uid;
  classEncryptionKeyBytes = new Uint8Array(bytes);
  cacheClassEncryptionKeyForSession(uid, bytes);
  if (removeLegacy) {
    try { localStorage.removeItem(classEncryptionKeyStorageKey(uid)); } catch {}
  }
}

function clearActiveClassEncryptionKey() {
  classEncryptionKeyUid = "";
  classEncryptionKeyBytes = null;
  automaticClassKeyPromise = null;
}

function hasActiveClassEncryptionKey(uid = currentUser?.uid) {
  return Boolean(uid && classEncryptionKeyUid === uid && classEncryptionKeyBytes?.length === 32);
}

async function importClassEncryptionKey(raw, usages = ["encrypt", "decrypt"]) {
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, usages);
}

async function getClassEncryptionKey(uid) {
  if (!uid || !hasActiveClassEncryptionKey(uid)) return null;
  return importClassEncryptionKey(classEncryptionKeyBytes);
}

function isLegacyMigrationRequiredError(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  return code.includes("failed-precondition") && message.includes("original browser key");
}

async function markAutomaticKeyProtection() {
  if (!currentUser || !db || !firestoreSdk) return;
  try {
    await firestoreSdk.setDoc(classesDocument(currentUser.uid), {
      version: 4,
      keyProtection: "FIRESTORE_PRIVATE_VAULT",
      keyEnvelope: firestoreSdk.deleteField(),
      updatedAt: firestoreSdk.serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.warn("TeacherTiles could not update the class key protection marker", error);
  }
}

async function validateLegacyClassKey(raw, encryptedValue) {
  if (!raw?.length || !encryptedValue?.ciphertext || !encryptedValue?.iv) return false;
  try {
    const key = await importClassEncryptionKey(raw, ["decrypt"]);
    await decryptClassesValue(encryptedValue, key);
    return true;
  } catch {
    return false;
  }
}

async function readOrCreatePrivateClassKey(uid, candidateRaw, encryptedValue) {
  const vaultRef = classKeyVaultDocument(uid);
  const result = await firestoreSdk.runTransaction(db, async transaction => {
    const vaultSnapshot = await transaction.get(vaultRef);
    if (vaultSnapshot.exists()) {
      return { key: String(vaultSnapshot.data()?.keyMaterial || ""), existing: true };
    }

    let raw = candidateRaw instanceof Uint8Array ? candidateRaw : null;
    const hasExistingRoster = Boolean(encryptedValue?.ciphertext && encryptedValue?.iv);
    if (hasExistingRoster) {
      if (!raw?.length || !(await validateLegacyClassKey(raw, encryptedValue))) {
        const migrationError = new Error("This older encrypted roster needs its original browser key one time before automatic sync can be enabled.");
        migrationError.code = "failed-precondition/original-browser-key";
        throw migrationError;
      }
    } else if (!raw?.length) {
      raw = crypto.getRandomValues(new Uint8Array(32));
    }

    if (raw.length !== 32) throw new Error("The class encryption key is invalid");
    const keyMaterial = bytesToBase64(raw);
    transaction.set(vaultRef, {
      version: 1,
      algorithm: "AES-GCM-256",
      keyMaterial,
      ownerUid: uid,
      createdAt: firestoreSdk.serverTimestamp(),
      updatedAt: firestoreSdk.serverTimestamp()
    });
    return { key: keyMaterial, existing: false };
  });

  const raw = base64ToBytes(result.key || "");
  if (raw.length !== 32) throw new Error("The private class key vault contains invalid key material");
  return { raw, existing: result.existing };
}

async function requestAutomaticClassKey({ force = false, encryptedValue = null } = {}) {
  if (!currentUser || !crypto?.subtle) throw new Error("Encrypted class storage is unavailable");
  const uid = currentUser.uid;
  if (!force && hasActiveClassEncryptionKey(uid) && classSyncMode === "ready") return classEncryptionKeyBytes;
  if (!force) {
    const sessionRaw = sessionClassEncryptionKeyBytes(uid);
    if (sessionRaw) {
      setActiveClassEncryptionKey(uid, sessionRaw);
      classKeyProtection = "FIRESTORE_PRIVATE_VAULT";
      classSyncMode = "ready";
      classSyncLastError = "";
      refreshClassSyncUi();
      return classEncryptionKeyBytes;
    }
  }
  if (!force && automaticClassKeyPromise) return automaticClassKeyPromise;

  const legacyRaw = legacyClassEncryptionKeyBytes(uid) || (hasActiveClassEncryptionKey(uid) ? classEncryptionKeyBytes : null);
  classSyncMode = "checking";
  classSyncLastError = "";
  refreshClassSyncUi();

  automaticClassKeyPromise = (async () => {
    try {
      let cloudEncryptedValue = encryptedValue && typeof encryptedValue === "object" ? encryptedValue : null;
      if (!cloudEncryptedValue) {
        const classesSnapshot = await firestoreSdk.getDoc(classesDocument(uid));
        cloudEncryptedValue = classesSnapshot.exists() ? (classesSnapshot.data() || {}) : {};
      }
      const { raw, existing } = await readOrCreatePrivateClassKey(uid, legacyRaw, cloudEncryptedValue);
      setActiveClassEncryptionKey(uid, raw, { removeLegacy: true });
      classKeyProtection = "FIRESTORE_PRIVATE_VAULT";
      classSyncMode = "ready";
      classSyncLastError = "";
      refreshClassSyncUi();
      if (!existing || cloudEncryptedValue.keyProtection !== "FIRESTORE_PRIVATE_VAULT") markAutomaticKeyProtection();
      return classEncryptionKeyBytes;
    } catch (error) {
      if (isLegacyMigrationRequiredError(error)) {
        clearActiveClassEncryptionKey();
        classSyncMode = "legacy-missing";
        classSyncLastError = "This older encrypted roster needs to be opened once in a browser that still has its original key.";
        refreshClassSyncUi();
        throw error;
      }
      if (legacyRaw?.length === 32) {
        setActiveClassEncryptionKey(uid, legacyRaw);
        classSyncMode = "migration-pending";
        classSyncLastError = "Cloud key sync is temporarily unavailable, so this browser is using its existing local key.";
        refreshClassSyncUi();
        return classEncryptionKeyBytes;
      }
      clearActiveClassEncryptionKey();
      classSyncMode = "error";
      classSyncLastError = error?.message || "Automatic encrypted class sync is unavailable.";
      refreshClassSyncUi();
      throw error;
    }
  })();

  try {
    return await automaticClassKeyPromise;
  } finally {
    automaticClassKeyPromise = null;
  }
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
  await requestAutomaticClassKey();
  const key = await getClassEncryptionKey(currentUser.uid);
  if (!key) throw new Error("The class encryption key is not available");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(Array.isArray(classes) ? classes : []));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  const payload = {
    version: classSyncMode === "ready" ? 4 : 1,
    algorithm: "AES-GCM-256",
    keyProtection: classSyncMode === "ready" ? "FIRESTORE_PRIVATE_VAULT" : "LEGACY_BROWSER_KEY",
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    updatedAt: firestoreSdk.serverTimestamp()
  };
  await firestoreSdk.setDoc(classesDocument(currentUser.uid), payload, { merge: true });
  classSyncDocumentExists = true;
  classSyncHasCiphertext = true;
  markClassCloudLoadedForSession(currentUser.uid);
  refreshClassSyncUi();
}

async function loadEncryptedClasses() {
  if (!currentUser || !db || !firestoreSdk || !crypto?.subtle) return [];
  const snapshot = await firestoreSdk.getDoc(classesDocument(currentUser.uid));
  classSyncDocumentExists = snapshot.exists();
  const value = snapshot.exists() ? (snapshot.data() || {}) : {};
  classSyncHasCiphertext = Boolean(value.ciphertext && value.iv);

  let raw;
  try {
    raw = await requestAutomaticClassKey({ encryptedValue: value });
  } catch (error) {
    if (classSyncMode === "legacy-missing") return [];
    throw error;
  }

  if (!classSyncHasCiphertext) {
    markClassCloudLoadedForSession(currentUser.uid);
    refreshClassSyncUi();
    return [];
  }

  const key = await importClassEncryptionKey(raw, ["decrypt"]);
  try {
    const classes = await decryptClassesValue(value, key);
    markClassCloudLoadedForSession(currentUser.uid);
    dispatchEncryptedClassesLoaded(classes);
    refreshClassSyncUi();
    return classes;
  } catch (error) {
    if (classSyncMode === "migration-pending") {
      classSyncLastError = "The saved classes could not be decrypted with this browser's legacy key.";
      classSyncMode = "legacy-missing";
      refreshClassSyncUi();
    } else {
      classSyncLastError = "The encrypted class roster could not be decrypted with the account key.";
      classSyncMode = "error";
      refreshClassSyncUi();
    }
    throw error;
  }
}

function setStatus(message = "", isError = false) {
  status.textContent = message;
  status.classList.toggle("is-error", isError);
}

function inferredClassSyncMode() {
  if (!currentUser) return "checking";
  if (classSyncMode === "legacy-missing" || classSyncMode === "error" || classSyncMode === "migration-pending") return classSyncMode;
  if (hasActiveClassEncryptionKey(currentUser.uid)) return "ready";
  return "checking";
}

function setClassSyncFeedback(message = "", isError = false) {
  if (!classSyncFeedback) return;
  classSyncFeedback.textContent = message;
  classSyncFeedback.classList.toggle("is-error", isError);
}

function refreshClassSyncUi() {
  if (!classSyncButton) return;
  const mode = inferredClassSyncMode();
  if (classSyncSummary) {
    classSyncSummary.textContent = mode === "ready"
      ? "Automatic encrypted sync with your Google account"
      : mode === "migration-pending"
        ? "Using this browser's key while automatic sync reconnects"
        : mode === "legacy-missing"
          ? "One-time migration needs an original browser"
          : mode === "error"
            ? "Encrypted sync needs attention"
            : "Connecting automatic encrypted class sync…";
  }
  classSyncButton.dataset.syncState = mode === "ready" ? "ready" : mode === "checking" ? "checking" : "locked";

  if (!classSyncPanel || classSyncPanel.hidden) return;
  classSyncMode = mode;
  const state = mode === "ready" ? "ready" : mode === "checking" ? "checking" : "locked";
  if (classSyncStateBadge) {
    classSyncStateBadge.textContent = mode === "ready"
      ? "PROTECTED"
      : mode === "checking"
        ? "CONNECTING"
        : mode === "migration-pending"
          ? "MIGRATION PENDING"
          : mode === "legacy-missing"
            ? "ORIGINAL BROWSER NEEDED"
            : "SYNC ERROR";
    classSyncStateBadge.dataset.state = state;
  }
  if (classSyncStateTitle) classSyncStateTitle.textContent = mode === "ready"
    ? "Your classes follow your Google account"
    : mode === "checking"
      ? "Connecting encrypted class sync"
      : mode === "migration-pending"
        ? "Your classes still work on this browser"
        : mode === "legacy-missing"
          ? "One-time migration is required"
          : "Automatic encrypted sync needs attention";
  if (classSyncStateCopy) classSyncStateCopy.textContent = mode === "ready"
    ? "TeacherTiles encrypts class, student, and PBIS data with AES-256-GCM before it is saved. The account key is stored separately in a private Firestore key vault that only your signed-in Firebase UID can access. No separate sync passphrase is needed."
    : mode === "checking"
      ? "Firebase is verifying your Google sign-in and loading your private class encryption key."
      : mode === "migration-pending"
        ? "This browser still has the older local encryption key, so your classes remain available. TeacherTiles will automatically copy that key into your private Firestore key vault when cloud sync is reachable."
        : mode === "legacy-missing"
          ? "This roster was encrypted before automatic account-key sync and this browser no longer has the original AES key. Open the updated TeacherTiles once in a browser where these classes still load; migration happens automatically there."
          : (classSyncLastError || "TeacherTiles could not retrieve the protected account key.");
  if (classSyncRetry) classSyncRetry.hidden = mode === "ready" || mode === "checking";
  setClassSyncFeedback(mode === "ready" ? "Google sign-in will load the same private class key automatically on your other devices." : "", false);
}

function openClassSyncPanel() {
  if (!classSyncPanel || !currentUser) return;
  if (modal.hidden) openProfile();
  classSyncPanel.hidden = false;
  classSyncPanel.setAttribute("aria-hidden", "false");
  classSyncButton?.setAttribute("aria-expanded", "true");
  refreshClassSyncUi();
  requestAnimationFrame(() => {
    if (!classSyncRetry?.hidden) classSyncRetry.focus({ preventScroll: true });
    else classSyncBack?.focus({ preventScroll: true });
  });
}

function closeClassSyncPanel() {
  if (!classSyncPanel || classSyncPanel.hidden) return;
  classSyncPanel.hidden = true;
  classSyncPanel.setAttribute("aria-hidden", "true");
  classSyncButton?.setAttribute("aria-expanded", "false");
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

function organizationDocument(organizationId) {
  return firestoreSdk.doc(db, "organizations", organizationId);
}

function organizationMemberDocument(organizationId, uid) {
  return firestoreSdk.doc(db, "organizationMembers", `${organizationId}_${uid}`);
}

function organizationInviteDocument(inviteId) {
  return firestoreSdk.doc(db, "organizationInvites", inviteId);
}

function normalizeOrganizationEmail(value = "") {
  return String(value).trim().toLowerCase();
}

function normalizeOrganizationLogo(value = "") {
  const logo = String(value).trim();
  return logo ? Array.from(logo).slice(0, 8).join("") : "🏫";
}

function syncOrganizationLogoPicker({ syncCustom = true } = {}) {
  const logo = normalizeOrganizationLogo(organizationLogoDraft);
  organizationLogoOptions?.querySelectorAll("[data-organization-logo]").forEach(button => {
    const selected = button.dataset.organizationLogo === logo;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  if (syncCustom && organizationCustomLogo) {
    organizationCustomLogo.value = ORGANIZATION_LOGO_OPTIONS.includes(logo) ? "" : logo;
  }
  if (organizationEditorLogo) organizationEditorLogo.textContent = logo;
}

function setOrganizationLogoEditable(editable) {
  organizationLogoOptions?.querySelectorAll("button").forEach(button => button.disabled = !editable);
  if (organizationCustomLogo) organizationCustomLogo.disabled = !editable;
  if (organizationLogoEditor) organizationLogoEditor.classList.toggle("is-read-only", !editable);
}

ORGANIZATION_LOGO_OPTIONS.forEach(logo => {
  if (!organizationLogoOptions) return;
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.organizationLogo = logo;
  button.textContent = logo;
  button.setAttribute("aria-label", `Use ${logo} as the organization logo`);
  button.setAttribute("aria-pressed", "false");
  button.addEventListener("click", () => {
    if (currentOrganizationRole() !== "Owner") return;
    organizationLogoDraft = logo;
    syncOrganizationLogoPicker();
  });
  organizationLogoOptions.appendChild(button);
});

function setOrganizationFeedback(element, message = "", isError = false) {
  if (!element) return;
  element.textContent = message;
  element.hidden = !message;
  element.classList.toggle("is-error", Boolean(message && isError));
}

function organizationErrorMessage(error, fallback) {
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();
  if (code.includes("permission-denied") || message.includes("missing or insufficient permissions")) {
    return "Organizations are not active for this build yet. Publish the updated Firebase rules, then try again.";
  }
  return fallback;
}

function currentOrganizationMembership() {
  if (!activeOrganization || !currentUser) return null;
  return activeOrganizationMembers.find(member => member.uid === currentUser.uid)
    || activeOrganization.membership
    || null;
}

function currentOrganizationRole() {
  return currentOrganizationMembership()?.role || "Member";
}

function canInviteOrganizationMembers() {
  return ["Owner", "Admin"].includes(currentOrganizationRole());
}

function canEditOrganizationRoles() {
  return currentOrganizationRole() === "Owner";
}

function roleTag(role = "Member") {
  const tag = document.createElement("span");
  tag.className = "organization-role-tag";
  tag.dataset.role = role;
  tag.textContent = role;
  return tag;
}

function closeNotificationMenu() {
  if (!notificationMenu) return;
  notificationMenu.hidden = true;
  notificationButton?.setAttribute("aria-expanded", "false");
}

async function acceptOrganizationInvite(invite) {
  if (organizationBusy || !currentUser || !firestoreSdk || !db) return;
  organizationBusy = true;
  setOrganizationFeedback(organizationFeedback, `Joining ${invite.organizationName || "organization"}…`);
  try {
    const batch = firestoreSdk.writeBatch(db);
    batch.set(organizationMemberDocument(invite.organizationId, currentUser.uid), {
      organizationId: invite.organizationId,
      uid: currentUser.uid,
      email: normalizeOrganizationEmail(currentUser.email),
      displayName: currentUser.displayName?.trim() || "Teacher",
      photoURL: currentUser.photoURL || "",
      role: "Member",
      inviteId: invite.id,
      joinedAt: firestoreSdk.serverTimestamp(),
      updatedAt: firestoreSdk.serverTimestamp()
    });
    batch.delete(organizationInviteDocument(invite.id));
    await batch.commit();
    organizationInvites = organizationInvites.filter(item => item.id !== invite.id);
    renderNotificationInbox();
    renderOrganizationInvitations();
    setOrganizationFeedback(organizationFeedback, `You joined ${invite.organizationName || "the organization"}.`);
    organizationIndexLoadedAt = 0;
    await loadOrganizationIndex({ force: true });
  } catch (error) {
    console.error("TeacherTiles could not accept the organization invitation", error);
    setOrganizationFeedback(organizationFeedback, "The invitation could not be accepted. Please try again.", true);
    if (notificationSummary) notificationSummary.textContent = "Could not join";
  } finally {
    organizationBusy = false;
  }
}

async function declineOrganizationInvite(invite) {
  if (organizationBusy || !currentUser || !firestoreSdk || !db) return;
  organizationBusy = true;
  try {
    await firestoreSdk.deleteDoc(organizationInviteDocument(invite.id));
    organizationInvites = organizationInvites.filter(item => item.id !== invite.id);
    renderNotificationInbox();
    renderOrganizationInvitations();
  } catch (error) {
    console.error("TeacherTiles could not decline the organization invitation", error);
    setOrganizationFeedback(organizationFeedback, "The invitation could not be declined. Please try again.", true);
    if (notificationSummary) notificationSummary.textContent = "Could not update";
  } finally {
    organizationBusy = false;
  }
}

function buildInvitationActions(invite, compact = false) {
  const actions = document.createElement("div");
  actions.className = compact ? "profile-notification-card__actions" : "organization-invitation-actions";
  const accept = document.createElement("button");
  accept.type = "button";
  accept.textContent = "Join";
  accept.addEventListener("click", async event => {
    event.stopPropagation();
    accept.disabled = true;
    decline.disabled = true;
    await acceptOrganizationInvite(invite);
    if (accept.isConnected) {
      accept.disabled = false;
      decline.disabled = false;
    }
  });
  const decline = document.createElement("button");
  decline.type = "button";
  decline.textContent = "Decline";
  decline.addEventListener("click", async event => {
    event.stopPropagation();
    accept.disabled = true;
    decline.disabled = true;
    await declineOrganizationInvite(invite);
    if (accept.isConnected) {
      accept.disabled = false;
      decline.disabled = false;
    }
  });
  actions.append(accept, decline);
  return actions;
}

function renderNotificationInbox() {
  if (!notificationList) return;
  notificationList.replaceChildren();
  const count = organizationInvites.length;
  if (notificationCount) {
    notificationCount.textContent = count > 99 ? "99+" : String(count);
    notificationCount.hidden = count === 0;
  }
  if (notificationSummary) notificationSummary.textContent = count ? `${count} new` : "All caught up";
  notificationButton?.setAttribute("aria-label", count ? `Open notifications, ${count} pending` : "Open notifications");
  if (!count) {
    const empty = document.createElement("div");
    empty.className = "profile-notification-empty";
    empty.textContent = currentUser ? "You do not have any new notifications." : "Sign in to view notifications.";
    notificationList.appendChild(empty);
    return;
  }
  organizationInvites.forEach(invite => {
    const card = document.createElement("article");
    card.className = "profile-notification-card";
    const icon = document.createElement("span");
    icon.className = "profile-notification-card__icon";
    icon.textContent = normalizeOrganizationLogo(invite.organizationLogo);
    const copy = document.createElement("div");
    copy.className = "profile-notification-card__copy";
    const title = document.createElement("strong");
    title.textContent = invite.organizationName || "Organization invitation";
    const detail = document.createElement("small");
    detail.textContent = `${invite.invitedByName || "An organization owner"} invited you to join as a Member.`;
    copy.append(title, detail, buildInvitationActions(invite, true));
    card.append(icon, copy);
    notificationList.appendChild(card);
  });
}

function renderOrganizationInvitations() {
  if (!organizationInvitationList || !organizationInvitations) return;
  organizationInvitationList.replaceChildren();
  organizationInvitations.hidden = organizationInvites.length === 0;
  if (organizationInvitationCount) organizationInvitationCount.textContent = `${organizationInvites.length} pending`;
  organizationInvites.forEach(invite => {
    const card = document.createElement("article");
    card.className = "organization-invitation-card";
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = invite.organizationName || "Organization invitation";
    const detail = document.createElement("small");
    detail.textContent = `${invite.invitedByName || "An owner"} invited ${currentUser?.email || "your Google account"} as a Member.`;
    copy.append(title, detail);
    card.append(copy, buildInvitationActions(invite));
    organizationInvitationList.appendChild(card);
  });
}

function stopOrganizationInviteListener() {
  organizationInvitesLoadedAt = 0;
  organizationInvitesPromise = null;
  organizationInvites = [];
  renderNotificationInbox();
  renderOrganizationInvitations();
}

async function refreshOrganizationInvites({ force = false } = {}) {
  const email = normalizeOrganizationEmail(currentUser?.email);
  if (!currentUser || !email || !firestoreSdk || !db) return organizationInvites;
  const requestedUid = currentUser.uid;
  if (!force && organizationInvitesLoadedAt && Date.now() - organizationInvitesLoadedAt < ORGANIZATION_CACHE_TTL) {
    return organizationInvites;
  }
  if (organizationInvitesPromise) return organizationInvitesPromise;
  const invitesQuery = firestoreSdk.query(
    firestoreSdk.collection(db, "organizationInvites"),
    firestoreSdk.where("email", "==", email)
  );
  organizationInvitesPromise = (async () => {
    try {
      const snapshot = await firestoreSdk.getDocs(invitesQuery);
      if (currentUser?.uid !== requestedUid) return organizationInvites;
      organizationInvites = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
      organizationInvitesLoadedAt = Date.now();
      renderNotificationInbox();
      renderOrganizationInvitations();
      return organizationInvites;
    } catch (error) {
      console.error("TeacherTiles could not load organization invitations", error);
      return organizationInvites;
    } finally {
      organizationInvitesPromise = null;
    }
  })();
  return organizationInvitesPromise;
}

function renderOrganizationList() {
  if (!organizationListElement) return;
  organizationListElement.replaceChildren();
  if (organizationCount) organizationCount.textContent = `${organizationMemberships.length} ${organizationMemberships.length === 1 ? "organization" : "organizations"}`;
  if (!organizationMemberships.length) {
    const empty = document.createElement("div");
    empty.className = "organization-empty";
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = "No organizations yet";
    const detail = document.createElement("p");
    detail.textContent = "Create one above or accept an invitation from your notifications.";
    copy.append(title, detail);
    empty.appendChild(copy);
    organizationListElement.appendChild(empty);
    return;
  }
  organizationMemberships.forEach(item => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "organization-card";
    const icon = document.createElement("span");
    icon.className = "organization-card__icon";
    icon.textContent = normalizeOrganizationLogo(item.logo);
    const copy = document.createElement("span");
    copy.className = "organization-card__copy";
    const title = document.createElement("strong");
    title.textContent = item.name;
    const detail = document.createElement("small");
    detail.textContent = `Your role: ${item.membership.role}`;
    copy.append(title, detail);
    const arrow = document.createElement("i");
    arrow.textContent = "›";
    card.append(icon, copy, arrow);
    card.addEventListener("click", () => openOrganizationEditor(item));
    organizationListElement.appendChild(card);
  });
}

async function loadOrganizationIndex({ force = false } = {}) {
  if (!currentUser || !firestoreSdk || !db) {
    organizationMemberships = [];
    renderOrganizationList();
    return organizationMemberships;
  }
  if (!force && organizationIndexLoadedAt && Date.now() - organizationIndexLoadedAt < ORGANIZATION_CACHE_TTL) {
    renderOrganizationList();
    return organizationMemberships;
  }
  if (organizationIndexPromise) return organizationIndexPromise;
  const requestedUid = currentUser.uid;

  organizationIndexPromise = (async () => {
    try {
      const membershipsQuery = firestoreSdk.query(
        firestoreSdk.collection(db, "organizationMembers"),
        firestoreSdk.where("uid", "==", currentUser.uid)
      );
      const membershipsSnapshot = await firestoreSdk.getDocs(membershipsQuery);
      const memberships = membershipsSnapshot.docs.map(item => ({ id: item.id, ...item.data() }));
      const items = await Promise.all(memberships.map(async membership => {
        const organizationSnapshot = await firestoreSdk.getDoc(organizationDocument(membership.organizationId));
        if (!organizationSnapshot.exists()) return null;
        return { id: organizationSnapshot.id, ...organizationSnapshot.data(), membership };
      }));
      if (currentUser?.uid !== requestedUid) return organizationMemberships;
      organizationMemberships = items.filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
      organizationIndexLoadedAt = Date.now();
      renderOrganizationList();
      return organizationMemberships;
    } catch (error) {
      console.error("TeacherTiles could not load organizations", error);
      setOrganizationFeedback(organizationFeedback, organizationErrorMessage(error, "Organizations could not be loaded. Check your connection and try again."), true);
      return organizationMemberships;
    } finally {
      organizationIndexPromise = null;
    }
  })();
  return organizationIndexPromise;
}

function setOrganizationEditorOpen(open) {
  if (!organizationListView || !organizationEditorView) return;
  organizationListView.hidden = open;
  organizationEditorView.hidden = !open;
  if (!open) {
    activeOrganization = null;
    activeOrganizationMembers = [];
    activeOrganizationInvites = [];
    setOrganizationFeedback(organizationEditorFeedback);
  }
}

function canRemoveOrganizationMember(member) {
  if (!member || member.uid === currentUser?.uid || member.role === "Owner") return false;
  const role = currentOrganizationRole();
  return role === "Owner" || (role === "Admin" && member.role === "Member");
}

function renderOrganizationMembers() {
  if (!organizationMemberList) return;
  organizationMemberList.replaceChildren();
  if (organizationMemberCount) organizationMemberCount.textContent = `${activeOrganizationMembers.length} ${activeOrganizationMembers.length === 1 ? "person" : "people"}`;
  const currentRole = currentOrganizationRole();
  if (organizationCurrentRole) {
    organizationCurrentRole.textContent = currentRole;
    organizationCurrentRole.dataset.role = currentRole;
  }
  if (organizationEditorMeta) organizationEditorMeta.textContent = `${activeOrganizationMembers.length} ${activeOrganizationMembers.length === 1 ? "member" : "members"} · You are ${currentRole}`;
  activeOrganizationMembers.forEach(member => {
    const card = document.createElement("article");
    card.className = `organization-member-card${member.uid === currentUser?.uid ? " is-current" : ""}`;
    const avatarWrap = document.createElement("div");
    avatarWrap.className = "organization-member-avatar-wrap";
    const avatar = document.createElement("span");
    avatar.className = "organization-member-avatar";
    if (member.photoURL) {
      const image = document.createElement("img");
      image.src = member.photoURL;
      image.alt = "";
      avatar.appendChild(image);
    } else avatar.textContent = (member.displayName?.trim()[0] || member.email?.trim()[0] || "T").toUpperCase();
    avatarWrap.append(avatar, roleTag(member.role));
    const copy = document.createElement("div");
    copy.className = "organization-member-copy";
    const name = document.createElement("strong");
    name.textContent = `${member.displayName || "Teacher"}${member.uid === currentUser?.uid ? " (You)" : ""}`;
    const email = document.createElement("small");
    email.textContent = member.email || "Google account";
    copy.append(name, email);
    const actions = document.createElement("div");
    actions.className = "organization-member-actions";
    if (canEditOrganizationRoles() && member.uid !== currentUser?.uid) {
      const select = document.createElement("select");
      select.className = "organization-member-role";
      select.setAttribute("aria-label", `Role for ${member.displayName || member.email}`);
      ["Owner", "Admin", "Member"].forEach(role => {
        const option = document.createElement("option");
        option.value = role;
        option.textContent = role;
        option.selected = role === member.role;
        select.appendChild(option);
      });
      select.addEventListener("change", () => updateOrganizationMemberRole(member, select.value));
      actions.appendChild(select);
    }
    if (canRemoveOrganizationMember(member)) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "organization-member-remove";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `Remove ${member.displayName || member.email}`);
      remove.addEventListener("click", () => removeOrganizationMember(member));
      actions.appendChild(remove);
    }
    card.append(avatarWrap, copy, actions);
    organizationMemberList.appendChild(card);
  });
}

function renderOrganizationPendingInvites() {
  if (!organizationPendingList || !organizationPendingSection) return;
  organizationPendingList.replaceChildren();
  organizationPendingSection.hidden = activeOrganizationInvites.length === 0;
  if (organizationPendingCount) organizationPendingCount.textContent = `${activeOrganizationInvites.length} pending`;
  activeOrganizationInvites.forEach(invite => {
    const card = document.createElement("article");
    card.className = "organization-pending-card";
    const copy = document.createElement("div");
    const email = document.createElement("strong");
    email.textContent = invite.email;
    const detail = document.createElement("small");
    detail.textContent = "Invited as Member";
    copy.append(email, detail);
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancel Invite";
    cancel.addEventListener("click", async () => {
      cancel.disabled = true;
      try {
        await firestoreSdk.deleteDoc(organizationInviteDocument(invite.id));
        await refreshOrganizationEditor({ force: true });
      } catch (error) {
        console.error("TeacherTiles could not cancel the organization invitation", error);
        setOrganizationFeedback(organizationEditorFeedback, "The invitation could not be canceled.", true);
        cancel.disabled = false;
      }
    });
    card.append(copy, cancel);
    organizationPendingList.appendChild(card);
  });
}

async function refreshOrganizationEditor({ force = false } = {}) {
  if (!activeOrganization || !currentUser || !firestoreSdk || !db) return;
  const organizationId = activeOrganization.id;
  const requestedUid = currentUser.uid;
  const applyEditorData = (members, invites) => {
    activeOrganizationMembers = members.map(member => ({ ...member }));
    activeOrganizationMembers.sort((a, b) => {
      const rank = { Owner: 0, Admin: 1, Member: 2 };
      return (rank[a.role] ?? 3) - (rank[b.role] ?? 3) || String(a.displayName || a.email).localeCompare(String(b.displayName || b.email));
    });
    const role = currentOrganizationRole();
    activeOrganizationInvites = ["Owner", "Admin"].includes(role) ? invites.map(invite => ({ ...invite })) : [];
    if (organizationInviteForm) organizationInviteForm.hidden = !canInviteOrganizationMembers();
    if (organizationNameInput) organizationNameInput.disabled = role !== "Owner";
    setOrganizationLogoEditable(role === "Owner");
    if (organizationDangerZone) organizationDangerZone.hidden = role !== "Owner";
    renderOrganizationMembers();
    renderOrganizationPendingInvites();
  };

  const cached = organizationDetailCache.get(organizationId);
  if (!force && cached && Date.now() - cached.loadedAt < ORGANIZATION_CACHE_TTL) {
    applyEditorData(cached.members, cached.invites);
    return;
  }
  if (organizationDetailPromises.has(organizationId)) return organizationDetailPromises.get(organizationId);

  const request = (async () => {
    try {
      const memberQuery = firestoreSdk.query(
        firestoreSdk.collection(db, "organizationMembers"),
        firestoreSdk.where("organizationId", "==", organizationId)
      );
      const memberSnapshot = await firestoreSdk.getDocs(memberQuery);
      const members = memberSnapshot.docs.map(item => ({ id: item.id, ...item.data() }));
      const ownMembership = members.find(member => member.uid === currentUser.uid) || activeOrganization.membership;
      let invites = [];
      if (["Owner", "Admin"].includes(ownMembership?.role)) {
        const inviteQuery = firestoreSdk.query(
          firestoreSdk.collection(db, "organizationInvites"),
          firestoreSdk.where("organizationId", "==", organizationId)
        );
        const inviteSnapshot = await firestoreSdk.getDocs(inviteQuery);
        invites = inviteSnapshot.docs.map(item => ({ id: item.id, ...item.data() }));
      }
      if (currentUser?.uid !== requestedUid) return;
      organizationDetailCache.set(organizationId, { loadedAt: Date.now(), members, invites });
      if (activeOrganization?.id === organizationId) applyEditorData(members, invites);
    } catch (error) {
      console.error("TeacherTiles could not load organization members", error);
      setOrganizationFeedback(organizationEditorFeedback, "Organization members could not be loaded.", true);
    } finally {
      organizationDetailPromises.delete(organizationId);
    }
  })();
  organizationDetailPromises.set(organizationId, request);
  return request;
}

async function openOrganizationEditor(item) {
  activeOrganization = item;
  organizationLogoDraft = normalizeOrganizationLogo(item.logo);
  const initialRole = item.membership?.role || "Member";
  if (organizationNameInput) organizationNameInput.value = item.name;
  if (organizationEditorTitle) organizationEditorTitle.textContent = item.name;
  if (organizationNameInput) organizationNameInput.disabled = initialRole !== "Owner";
  setOrganizationLogoEditable(initialRole === "Owner");
  if (organizationDangerZone) organizationDangerZone.hidden = initialRole !== "Owner";
  syncOrganizationLogoPicker();
  setOrganizationEditorOpen(true);
  setOrganizationFeedback(organizationEditorFeedback, "Loading organization…");
  await refreshOrganizationEditor();
  if (!organizationEditorFeedback?.classList.contains("is-error")) setOrganizationFeedback(organizationEditorFeedback);
}

async function updateOrganizationMemberRole(member, role) {
  if (!activeOrganization || !canEditOrganizationRoles() || !["Owner", "Admin", "Member"].includes(role)) return;
  setOrganizationFeedback(organizationEditorFeedback, `Updating ${member.displayName || member.email}…`);
  try {
    await firestoreSdk.updateDoc(organizationMemberDocument(activeOrganization.id, member.uid), {
      role,
      updatedAt: firestoreSdk.serverTimestamp()
    });
    await refreshOrganizationEditor({ force: true });
    setOrganizationFeedback(organizationEditorFeedback, `${member.displayName || member.email} is now ${role}.`);
  } catch (error) {
    console.error("TeacherTiles could not update the organization role", error);
    setOrganizationFeedback(organizationEditorFeedback, "That role could not be updated.", true);
    await refreshOrganizationEditor({ force: true });
  }
}

async function removeOrganizationMember(member) {
  if (!activeOrganization || !canRemoveOrganizationMember(member)) return;
  if (!confirm(`Remove ${member.displayName || member.email} from ${activeOrganization.name}?`)) return;
  setOrganizationFeedback(organizationEditorFeedback, `Removing ${member.displayName || member.email}…`);
  try {
    await firestoreSdk.deleteDoc(organizationMemberDocument(activeOrganization.id, member.uid));
    await refreshOrganizationEditor({ force: true });
    setOrganizationFeedback(organizationEditorFeedback, `${member.displayName || member.email} was removed.`);
  } catch (error) {
    console.error("TeacherTiles could not remove the organization member", error);
    setOrganizationFeedback(organizationEditorFeedback, "That member could not be removed.", true);
  }
}

async function saveOrganizationDetails() {
  if (!activeOrganization || currentOrganizationRole() !== "Owner" || !organizationNameInput) return;
  const name = organizationNameInput.value.trim();
  const logo = normalizeOrganizationLogo(organizationLogoDraft);
  if (!name) {
    setOrganizationFeedback(organizationEditorFeedback, "Enter an organization name.", true);
    organizationNameInput.focus();
    return;
  }
  if (name === activeOrganization.name && logo === normalizeOrganizationLogo(activeOrganization.logo)) return;
  try {
    await firestoreSdk.updateDoc(organizationDocument(activeOrganization.id), {
      name,
      logo,
      updatedAt: firestoreSdk.serverTimestamp()
    });
    activeOrganization.name = name;
    activeOrganization.logo = logo;
    if (organizationEditorTitle) organizationEditorTitle.textContent = name;
    if (organizationEditorLogo) organizationEditorLogo.textContent = logo;
    const cachedItem = organizationMemberships.find(item => item.id === activeOrganization.id);
    if (cachedItem) {
      cachedItem.name = name;
      cachedItem.logo = logo;
    }
    renderOrganizationList();
    setOrganizationFeedback(organizationEditorFeedback, "Organization changes saved.");
  } catch (error) {
    console.error("TeacherTiles could not save the organization", error);
    setOrganizationFeedback(organizationEditorFeedback, "The organization changes could not be saved.", true);
  }
}

async function closeOrganizationEditor() {
  await saveOrganizationDetails();
  setOrganizationEditorOpen(false);
  renderOrganizationList();
}

async function deleteOrganizationReferences(references) {
  for (let index = 0; index < references.length; index += 400) {
    const batch = firestoreSdk.writeBatch(db);
    references.slice(index, index + 400).forEach(reference => batch.delete(reference));
    await batch.commit();
  }
}

async function deleteActiveOrganization() {
  if (organizationBusy || !activeOrganization || currentOrganizationRole() !== "Owner") return;
  const organizationId = activeOrganization.id;
  const organizationName = activeOrganization.name;
  if (!confirm(`Permanently delete ${organizationName}? Its members and pending invitations will also be removed.`)) return;
  organizationBusy = true;
  if (organizationDelete) organizationDelete.disabled = true;
  setOrganizationFeedback(organizationEditorFeedback, `Deleting ${organizationName}…`);
  try {
    const memberQuery = firestoreSdk.query(
      firestoreSdk.collection(db, "organizationMembers"),
      firestoreSdk.where("organizationId", "==", organizationId)
    );
    const inviteQuery = firestoreSdk.query(
      firestoreSdk.collection(db, "organizationInvites"),
      firestoreSdk.where("organizationId", "==", organizationId)
    );
    const [memberSnapshot, inviteSnapshot] = await Promise.all([
      firestoreSdk.getDocs(memberQuery),
      firestoreSdk.getDocs(inviteQuery)
    ]);
    await deleteOrganizationReferences(inviteSnapshot.docs.map(item => item.ref));
    await deleteOrganizationReferences(
      memberSnapshot.docs.filter(item => item.data().uid !== currentUser.uid).map(item => item.ref)
    );
    const finalBatch = firestoreSdk.writeBatch(db);
    const currentMembership = memberSnapshot.docs.find(item => item.data().uid === currentUser.uid);
    if (currentMembership) finalBatch.delete(currentMembership.ref);
    finalBatch.delete(organizationDocument(organizationId));
    await finalBatch.commit();
    organizationDetailCache.delete(organizationId);
    organizationIndexLoadedAt = 0;
    setOrganizationEditorOpen(false);
    await loadOrganizationIndex({ force: true });
    setOrganizationFeedback(organizationFeedback, `${organizationName} was deleted.`);
  } catch (error) {
    console.error("TeacherTiles could not delete the organization", error);
    setOrganizationFeedback(organizationEditorFeedback, organizationErrorMessage(error, "The organization could not be deleted. Please try again."), true);
  } finally {
    organizationBusy = false;
    if (organizationDelete) organizationDelete.disabled = false;
  }
}

async function openOrganizationsPanel() {
  if (!currentUser) {
    openProfile();
    return;
  }
  closeNotificationMenu();
  closeProfile();
  organizationPanel.hidden = false;
  organizationPanel.setAttribute("aria-hidden", "false");
  organizationButton?.setAttribute("aria-expanded", "true");
  setOrganizationEditorOpen(false);
  setOrganizationFeedback(organizationFeedback, "Loading organizations…");
  await Promise.all([loadOrganizationIndex(), refreshOrganizationInvites()]);
  if (!organizationFeedback?.classList.contains("is-error")) setOrganizationFeedback(organizationFeedback);
  requestAnimationFrame(() => organizationClose?.focus({ preventScroll: true }));
}

function closeOrganizationsPanel({ reopenProfile = false } = {}) {
  if (!organizationPanel || organizationPanel.hidden) return;
  organizationPanel.hidden = true;
  organizationPanel.setAttribute("aria-hidden", "true");
  organizationButton?.setAttribute("aria-expanded", "false");
  setOrganizationEditorOpen(false);
  if (reopenProfile) openProfile();
  else toggle?.focus({ preventScroll: true });
}

async function createOrganization(event) {
  event?.preventDefault();
  if (organizationBusy || !currentUser || !firestoreSdk || !db || !organizationCreateName) return;
  const name = organizationCreateName.value.trim();
  if (!name) return;
  organizationBusy = true;
  const submit = organizationCreateForm?.querySelector('button[type="submit"]');
  if (submit) submit.disabled = true;
  setOrganizationFeedback(organizationFeedback, `Creating ${name}…`);
  try {
    const reference = firestoreSdk.doc(firestoreSdk.collection(db, "organizations"));
    const batch = firestoreSdk.writeBatch(db);
    batch.set(reference, {
      name,
      logo: "🏫",
      ownerId: currentUser.uid,
      ownerEmail: normalizeOrganizationEmail(currentUser.email),
      createdAt: firestoreSdk.serverTimestamp(),
      updatedAt: firestoreSdk.serverTimestamp(),
      schemaVersion: 1
    });
    batch.set(organizationMemberDocument(reference.id, currentUser.uid), {
      organizationId: reference.id,
      uid: currentUser.uid,
      email: normalizeOrganizationEmail(currentUser.email),
      displayName: currentUser.displayName?.trim() || "Teacher",
      photoURL: currentUser.photoURL || "",
      role: "Owner",
      inviteId: "",
      joinedAt: firestoreSdk.serverTimestamp(),
      updatedAt: firestoreSdk.serverTimestamp()
    });
    await batch.commit();
    organizationCreateName.value = "";
    organizationIndexLoadedAt = 0;
    await loadOrganizationIndex({ force: true });
    const created = organizationMemberships.find(item => item.id === reference.id);
    setOrganizationFeedback(organizationFeedback, `${name} was created.`);
    if (created) await openOrganizationEditor(created);
  } catch (error) {
    console.error("TeacherTiles could not create the organization", error);
    setOrganizationFeedback(organizationFeedback, organizationErrorMessage(error, "The organization could not be created. Please try again."), true);
  } finally {
    organizationBusy = false;
    if (submit) submit.disabled = false;
  }
}

async function inviteToOrganization(event) {
  event?.preventDefault();
  if (organizationBusy || !activeOrganization || !canInviteOrganizationMembers() || !organizationInviteEmail) return;
  const email = normalizeOrganizationEmail(organizationInviteEmail.value);
  if (!email || !email.includes("@")) return;
  if (email === normalizeOrganizationEmail(currentUser?.email)) {
    setOrganizationFeedback(organizationEditorFeedback, "You are already in this organization.", true);
    return;
  }
  if (activeOrganizationMembers.some(member => normalizeOrganizationEmail(member.email) === email)) {
    setOrganizationFeedback(organizationEditorFeedback, "That Google account is already a member.", true);
    return;
  }
  if (activeOrganizationInvites.some(invite => normalizeOrganizationEmail(invite.email) === email)) {
    setOrganizationFeedback(organizationEditorFeedback, "That Google account already has a pending invitation.", true);
    return;
  }
  organizationBusy = true;
  const submit = organizationInviteForm?.querySelector('button[type="submit"]');
  if (submit) submit.disabled = true;
  setOrganizationFeedback(organizationEditorFeedback, `Inviting ${email}…`);
  try {
    const reference = firestoreSdk.doc(firestoreSdk.collection(db, "organizationInvites"));
    await firestoreSdk.setDoc(reference, {
      organizationId: activeOrganization.id,
      organizationName: activeOrganization.name,
      organizationLogo: normalizeOrganizationLogo(activeOrganization.logo),
      email,
      role: "Member",
      invitedByUid: currentUser.uid,
      invitedByName: currentUser.displayName?.trim() || "Teacher",
      invitedByEmail: normalizeOrganizationEmail(currentUser.email),
      createdAt: firestoreSdk.serverTimestamp()
    });
    organizationInviteEmail.value = "";
    await refreshOrganizationEditor({ force: true });
    setOrganizationFeedback(organizationEditorFeedback, `Invitation sent to ${email}.`);
  } catch (error) {
    console.error("TeacherTiles could not invite the Google account", error);
    setOrganizationFeedback(organizationEditorFeedback, "The invitation could not be sent. Please try again.", true);
  } finally {
    organizationBusy = false;
    if (submit) submit.disabled = false;
  }
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
  if (currentUser) void refreshOrganizationInvites();
  lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  toggle.setAttribute("aria-expanded", "true");
  requestAnimationFrame(() => modal.querySelector(".profile-panel__close")?.focus());
}

function closeProfile() {
  if (modal.hidden) return;
  closeClassSyncPanel();
  closeNotificationMenu();
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

function buildPbisPreviewRoster(object) {
  const classKeyByType = {
    starchart: "classId",
    classmeter: "classId",
    collections: "classId",
    prizeboard: "activeClassId",
    pbisconsole: "activeClassId",
    punchcards: "activeClassId",
    racer: "activeClassId"
  };
  const classKey = classKeyByType[object?.type];
  const classId = classKey ? String(object?.special?.[classKey] || "") : "";
  if (!classId) return null;
  try {
    if (typeof readClassRosters !== "function") return null;
    const roster = readClassRosters().find(item => item?.id === classId);
    if (!roster) return null;
    const selected = String(object.special?.student || object.special?.selectedStudent || "");
    const students = [...new Set([...(roster.students || []).slice(0, 10), selected].filter(Boolean))];
    const keys = students.map(name => `student:${String(name).trim().toLocaleLowerCase()}`);
    const selectValues = source => Object.fromEntries(keys.map(key => [key, source?.[key]]).filter(([, value]) => value !== undefined));
    return {
      id: String(roster.id || classId),
      name: String(roster.name || "Class").slice(0, 50),
      logo: String(roster.logo || "👥").slice(0, 12),
      students,
      starChart: {
        mode: roster.starChart?.mode === "whole" ? "whole" : "student",
        wholeClassStars: Number(roster.starChart?.wholeClassStars) || 0,
        studentStars: selectValues(roster.starChart?.studentStars)
      },
      classMeter: {
        fill: Number(roster.classMeter?.fill) || 0,
        wins: Number(roster.classMeter?.wins) || 0
      },
      collectionJar: {
        count: Number(roster.collectionJar?.count) || 0,
        jarsFilled: Number(roster.collectionJar?.jarsFilled) || 0,
        filled: Boolean(roster.collectionJar?.filled),
        item: String(roster.collectionJar?.item || "pompom")
      },
      punchcards: {
        wholeClassPoints: Number(roster.punchcards?.wholeClassPoints) || 0,
        wholeClassProgress: Number(roster.punchcards?.wholeClassProgress) || 0,
        studentPoints: selectValues(roster.punchcards?.studentPoints),
        studentProgress: selectValues(roster.punchcards?.studentProgress)
      },
      racer: {
        positions: selectValues(roster.racer?.positions),
        studentWins: selectValues(roster.racer?.studentWins),
        finished: selectValues(roster.racer?.finished)
      }
    };
  } catch {
    return null;
  }
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

  if (object.type === "attendance" && object.special && typeof object.special === "object") {
    const students = (Array.isArray(object.special.students) ? object.special.students : [])
      .map(name => String(name || "").trim().slice(0, 60))
      .filter(Boolean)
      .slice(0, 36);
    const assignments = {};
    for (const name of students) {
      const status = object.special.assignments?.[name];
      assignments[name] = status === "absent" || status === "present" ? status : "waiting";
    }
    preview.special = {
      classId: String(object.special.classId || "").slice(0, 180),
      className: String(object.special.className || "Class").slice(0, 100),
      classLogo: String(object.special.classLogo || "👥").slice(0, 16),
      students,
      assignments
    };
  }

  const pbisPreviewKeys = {
    starchart: ["classId", "showAllStudents", "collapsedHeight"],
    classmeter: ["classId", "orientation"],
    collections: ["classId"],
    prizeboard: ["activeClassId", "scope"],
    pbisconsole: ["activeClassId", "student", "view"],
    punchcards: ["activeClassId", "scope", "student"],
    racer: ["activeClassId", "selectedStudent"]
  };
  const selectedPbisKeys = pbisPreviewKeys[object.type];
  if (selectedPbisKeys && object.special && typeof object.special === "object") {
    if (!preview.special || typeof preview.special !== "object") preview.special = {};
    for (const key of selectedPbisKeys) {
      const value = compactPreviewValue(object.special[key]);
      if (value !== undefined) preview.special[key] = value;
    }
    if (object.type === "prizeboard" && Array.isArray(object.special.prizes)) {
      preview.special.prizes = object.special.prizes.slice(0, 8).map(prize => ({
        title: String(prize?.title || "").slice(0, 80),
        cost: Number(prize?.cost) || 0,
        scope: prize?.scope === "class" ? "class" : "student",
        image: /^(?:https?:|assets\/|\.\/|\.\.\/)/i.test(String(prize?.image || "")) ? String(prize.image) : ""
      }));
    }
    const previewRoster = buildPbisPreviewRoster(object);
    if (previewRoster) preview.special.previewRoster = previewRoster;
  }
  if (object.type === "image" && typeof object.special?.previewSrc === "string") {
    const previewSrc = object.special.previewSrc;
    const safePreviewSrc = /^data:image\//i.test(previewSrc) && previewSrc.length <= 32000
      ? previewSrc
      : (/^(?:https?:|assets\/|\.\/|\.\.\/)/i.test(previewSrc) ? previewSrc : "");
    if (safePreviewSrc) {
      if (!preview.special || typeof preview.special !== "object") preview.special = {};
      preview.special.previewSrc = safePreviewSrc;
    }
  }
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
  markBoardCloudLoadedForSession(currentUser.uid);

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
  markBoardCloudLoadedForSession(currentUser.uid);
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
    const statuses = ["absent", "waiting", "present"];
    const students = (Array.isArray(special.students) ? special.students : [])
      .map(name => String(name || "").trim())
      .filter(Boolean)
      .slice(0, 36);
    const grouped = { absent: [], waiting: [], present: [] };
    for (const name of students) {
      const saved = special.assignments?.[name];
      grouped[saved === "absent" || saved === "present" ? saved : "waiting"].push(name);
    }
    const hasClass = Boolean(special.classId || students.length);
    module.classList.toggle("has-attendance-class", hasClass);
    module.dataset.attendanceReady = String(hasClass);
    setPreviewText(module, ".attendance-class-name", hasClass ? (special.className || "Class") : "No class loaded");
    setPreviewText(module, ".attendance-class-logo", hasClass ? (special.classLogo || "👥") : "👥");
    setPreviewText(module, ".attendance-summary strong", `${grouped.present.length}/${students.length}`);
    setPreviewText(module, ".attendance-status", hasClass ? `${grouped.waiting.length} waiting · ${grouped.present.length} present · ${grouped.absent.length} absent` : "Choose a saved class above to begin.");
    const emptyState = module.querySelector(".attendance-empty-state");
    if (emptyState) emptyState.hidden = hasClass;
    const reset = module.querySelector(".attendance-reset");
    if (reset) reset.hidden = true;
    for (const status of statuses) {
      const list = module.querySelector(`[data-attendance-list="${status}"]`);
      const count = module.querySelector(`[data-attendance-count="${status}"]`);
      if (count) count.textContent = String(grouped[status].length);
      if (!list) continue;
      list.replaceChildren();
      for (const name of grouped[status]) {
        const chip = document.createElement("span");
        chip.className = "attendance-student";
        const art = document.createElement("span");
        art.className = "attendance-student-art";
        art.innerHTML = "<i></i><b></b><em></em>";
        const label = document.createElement("span");
        label.className = "attendance-student-name";
        label.textContent = name;
        chip.append(art, label);
        list.appendChild(chip);
      }
      if (!grouped[status].length) {
        const hint = document.createElement("span");
        hint.className = "attendance-column-empty";
        hint.textContent = status === "waiting" ? "Everyone is sorted" : status === "present" ? "Present" : "Absent";
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
        const scale = Math.min(el.clientWidth / originalWidth, el.clientHeight / originalHeight);
        if (!Number.isFinite(scale) || scale <= 0) return;
        module.style.transform = `scale(${scale})`;
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
    const cachedIsFresh = Boolean(cached && cached.boards.length && (
      boardCloudAlreadyLoadedThisSession(user.uid) || Date.now() - cached.savedAt < BOARD_LIST_CACHE_TTL
    ));

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
  const isInitialAuthResolution = !authReady;
  const previousUser = currentUser;
  currentUser = user || null;
  if (!user && previousUser?.uid) {
    try {
      sessionStorage.removeItem(classEncryptionKeySessionStorageKey(previousUser.uid));
      sessionStorage.removeItem(classCloudLoadedSessionStorageKey(previousUser.uid));
      sessionStorage.removeItem(boardCloudLoadedSessionStorageKey(previousUser.uid));
    } catch {}
  }
  if (!user || previousUser?.uid !== user?.uid) {
    classSyncDocumentExists = false;
    classSyncHasCiphertext = false;
    classSyncMode = "checking";
    classKeyProtection = "";
    classSyncLastError = "";
    clearActiveClassEncryptionKey();
    closeClassSyncPanel();
    stopOrganizationInviteListener();
    organizationMemberships = [];
    activeOrganization = null;
    activeOrganizationMembers = [];
    activeOrganizationInvites = [];
    organizationIndexLoadedAt = 0;
    organizationIndexPromise = null;
    organizationDetailCache.clear();
    organizationDetailPromises.clear();
    renderOrganizationList();
    closeOrganizationsPanel();
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

    const sessionKey = sessionClassEncryptionKeyBytes(user.uid);
    if (sessionKey) {
      setActiveClassEncryptionKey(user.uid, sessionKey);
      classKeyProtection = "FIRESTORE_PRIVATE_VAULT";
      classSyncMode = "ready";
      classSyncLastError = "";
      refreshClassSyncUi();
    }

    const canReuseLocalClasses = classCloudAlreadyLoadedThisSession(user.uid) && hasLocalClassRosterSnapshot(user.uid);
    if (!canReuseLocalClasses) {
      loadEncryptedClasses().catch(error => {
        console.error("TeacherTiles could not decrypt class rosters", error);
        setStatus("Saved class rosters could not be opened. Please sign out and sign back in, then try again.", true);
        classSyncMode = inferredClassSyncMode();
        refreshClassSyncUi();
      });
    }

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
    closeNotificationMenu();

    if (isInitialAuthResolution) {
      requestAnimationFrame(() => {
        if (!currentUser && modal.hidden) openProfile();
      });
    }
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
      openProfile();
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
    openProfile();
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
organizationButton?.addEventListener("click", openOrganizationsPanel);
organizationBack?.addEventListener("click", () => closeOrganizationsPanel({ reopenProfile: true }));
organizationClose?.addEventListener("click", () => closeOrganizationsPanel());
organizationPanel?.querySelector(".organization-window__backdrop")?.addEventListener("click", () => closeOrganizationsPanel());
organizationCreateForm?.addEventListener("submit", createOrganization);
organizationInviteForm?.addEventListener("submit", inviteToOrganization);
organizationEditorBack?.addEventListener("click", closeOrganizationEditor);
organizationEditorDone?.addEventListener("click", closeOrganizationEditor);
organizationDelete?.addEventListener("click", deleteActiveOrganization);
organizationNameInput?.addEventListener("keydown", event => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  saveOrganizationDetails();
});
organizationCustomLogo?.addEventListener("input", () => {
  if (currentOrganizationRole() !== "Owner") return;
  const value = String(organizationCustomLogo.value || "").trim();
  organizationLogoDraft = value ? normalizeOrganizationLogo(value) : "🏫";
  syncOrganizationLogoPicker({ syncCustom: false });
});
organizationCustomLogo?.addEventListener("focus", () => {
  organizationLogoFreshFocus = true;
  organizationCustomLogo.placeholder = "";
  requestAnimationFrame(() => organizationCustomLogo.select());
});
organizationCustomLogo?.addEventListener("click", () => {
  if (!organizationLogoFreshFocus) return;
  organizationLogoFreshFocus = false;
  organizationCustomLogo.select();
});
organizationCustomLogo?.addEventListener("blur", () => {
  organizationLogoFreshFocus = false;
  organizationCustomLogo.placeholder = "🏫";
});
organizationCustomLogo?.addEventListener("paste", event => {
  if (currentOrganizationRole() !== "Owner") return;
  const pasted = event.clipboardData?.getData("text");
  if (typeof pasted !== "string") return;
  event.preventDefault();
  organizationLogoFreshFocus = false;
  organizationCustomLogo.value = normalizeOrganizationLogo(pasted);
  organizationCustomLogo.dispatchEvent(new Event("input", { bubbles: true }));
});
notificationButton?.addEventListener("click", event => {
  event.stopPropagation();
  if (!notificationMenu) return;
  const open = notificationMenu.hidden;
  notificationMenu.hidden = !open;
  notificationButton.setAttribute("aria-expanded", String(open));
  if (open) {
    renderNotificationInbox();
    void refreshOrganizationInvites();
  }
});
notificationMenu?.addEventListener("click", event => event.stopPropagation());
document.addEventListener("click", event => {
  if (notificationMenu?.hidden || event.target.closest?.(".profile-notification-wrap")) return;
  closeNotificationMenu();
});
classSyncButton?.addEventListener("click", openClassSyncPanel);
classSyncBack?.addEventListener("click", closeClassSyncPanel);
classSyncBackdrop?.addEventListener("click", closeClassSyncPanel);
classSyncRetry?.addEventListener("click", async () => {
  if (classSyncBusy || !currentUser) return;
  classSyncBusy = true;
  classSyncRetry.disabled = true;
  setClassSyncFeedback("Retrying automatic encrypted sync…");
  try {
    await requestAutomaticClassKey({ force: true });
    await loadEncryptedClasses();
    setClassSyncFeedback(classSyncMode === "ready" ? "Encrypted class sync is connected." : classSyncLastError, classSyncMode !== "ready");
  } catch (error) {
    setClassSyncFeedback(classSyncLastError || error?.message || "Automatic encrypted sync could not connect.", true);
  } finally {
    classSyncBusy = false;
    classSyncRetry.disabled = false;
    refreshClassSyncUi();
  }
});

modal.querySelectorAll("[data-profile-close]").forEach(button => button.addEventListener("click", closeProfile));
signInButton.addEventListener("click", handleSignIn);
signOutButton.addEventListener("click", handleSignOut);

if (saveWarning) {
  saveWarning.setAttribute("role", "button");
  saveWarning.setAttribute("tabindex", "0");
  saveWarning.setAttribute("aria-label", "Sign in to save your TileSet layout");
  const openSignInFromWarning = event => {
    if (currentUser) return;
    if (event?.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;
    event?.preventDefault();
    openProfile();
  };
  saveWarning.addEventListener("click", openSignInFromWarning);
  saveWarning.addEventListener("keydown", openSignInFromWarning);
}

boardsToggle?.addEventListener("click", () => {
  if (!currentUser) {
    openProfile();
    return;
  }
  if (boardsView.hidden) openBoardsView();
  else closeBoardsView();
});
boardsBack?.addEventListener("click", closeBoardsView);

document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;

  if (!organizationPanel?.hidden) {
    event.preventDefault();
    closeOrganizationsPanel();
    return;
  }

  if (!notificationMenu?.hidden) {
    event.preventDefault();
    closeNotificationMenu();
    notificationButton?.focus();
    return;
  }

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
  retrySync: () => requestAutomaticClassKey({ force: true }),
  get syncEnabled() { return classSyncMode === "ready"; },
  get unlocked() { return Boolean(currentUser && hasActiveClassEncryptionKey(currentUser.uid)); },
  get protection() { return classKeyProtection || (classSyncMode === "ready" ? "FIRESTORE_PRIVATE_VAULT" : ""); }
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
