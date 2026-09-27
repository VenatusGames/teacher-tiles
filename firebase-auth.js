import {createTicketNotifications} from './support/notifications.js';
import {boardCosmetics,cosmeticAccessDialog,openCosmeticShop} from './boards/access.js?v=20260926-membership';
import {setupNickname} from './profile/nickname.js?v=20260926-edit';
import {setupBugReports} from './support/tickets.js?v=20260926-preview-titles';
import {previewThemeClass,layoutBoardPreviewObjects,createMiniObject,createBoardPreview} from './boards/preview.js?v=20260926-preview-reset';
import {createTemplateLibrary} from './templates/ui.js?v=20260926-preview-titles';
import {syncAwardedPatches} from './profile/awards.js?v=20261012-removal';
import {startSiteActivity} from './account/site-activity.js';
import { firebaseConfig } from './firebase-config.js';


const modal = document.getElementById("profile-modal");
const toggle = document.getElementById("profile-toggle");
const launchAvatar = document.getElementById("profile-launch-avatar");
const launchSubscriberCrown = document.getElementById("profile-launch-subscriber-crown");
const loadingState = document.getElementById("profile-auth-loading");
const signedOutState = document.getElementById("profile-signed-out");
const signedInState = document.getElementById("profile-signed-in");
const signInButton = document.getElementById("profile-google-signin");
const signOutButton = document.getElementById("profile-signout");
const profileAvatar = document.getElementById("profile-avatar");
const profileSubscriberCrown = document.getElementById("profile-avatar-subscriber-crown");
const profileDisplayName = document.getElementById("profile-display-name");
const profileEmail = document.getElementById("profile-email");
const profileBetaBadge = document.getElementById("profile-beta-badge");
const profileBadgeCount = document.getElementById("profile-badge-count");
const profileSubscriberBadge = document.getElementById("profile-subscriber-badge");
const subscriberPatchRequirement = document.getElementById("subscriber-patch-requirement");
const subscriberPatchEarned = document.getElementById("subscriber-patch-earned");
const subscriberPatchCheck = profileSubscriberBadge?.querySelector(".profile-badge__check");
const profileCoinBalance = document.getElementById("profile-coin-balance");
const profileCoinCard = document.getElementById("profile-coin-card");
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
let ticketInbox;
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
const boardsLibraryTab = document.getElementById("boards-library-tab");
const boardTemplatesTab = document.getElementById("board-templates-tab");
const boardsLibraryPanel = document.getElementById("boards-library-panel");
const boardTemplatesPanel = document.getElementById("board-templates-panel");

const gatedFeatureIds = new Set(["theme-shelf-toggle", "sticker-shelf-toggle", "tile-skins-shelf-toggle", "shop-toggle", "boards-toggle"]);
const subscriberMarkSvg = `<svg viewBox="0 0 48 48" aria-hidden="true"><use href="assets/ui/subscriber-crown.svg?v=20260926#crown"/></svg>`;

let auth = null;
let authSdk = null;
let firestoreSdk = null;
let functionsSdk = null;
let db = null;
let cloudFunctions = null;
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
let boardSavePromise = null;
let localBoardSaveTimer = 0;
const cloudBoardSaveTimers = new Map();
let boardListLoadedFromNetwork = false;
let pendingBoardChangeReason = "";
const boardLocalHashes = new Map();
const localBoardMemory = new Map();
let localBoardDbPromise = null;

const LOCAL_SAVE_DELAY = 280;
const CLOUD_SAVE_DELAY = 8000;
const BOARD_LIST_CACHE_TTL = 10 * 60 * 1000;
const SESSION_CLOUD_RECHECK_TTL = 10 * 60 * 1000;
const BOARD_LIBRARY_RECHECK_TTL = 60 * 1000;
const ACTIVE_BOARD_CLOUD_RECHECK_TTL = 10 * 60 * 1000;
const ORGANIZATION_CACHE_TTL = 5 * 60 * 1000;
const INLINE_OBJECT_BUDGET = 560000;
const CHUNK_OBJECT_BUDGET = 520000;
const MAX_SINGLE_OBJECT_BYTES = 900000;
const PREVIEW_OBJECT_BUDGET = 90000;
const SHOP_FUNCTION_REGION = "us-central1";
const shopAccountState = {
  ready: false,
  loading: false,
  signedIn: false,
  coinBalance: 0,
  ownedProductIds: [],
  subscriptionActive: false
};

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

function lessonPlannerDocument(uid) {
  return firestoreSdk.doc(db, "users", uid, "private", "lessonPlanner");
}

async function loadLessonPlannerCloud() {
  if (!currentUser || !db || !firestoreSdk) return { exists: false, revision: 0, state: null };
  const uid = currentUser.uid;
  const snapshot = await firestoreSdk.getDocFromServer(lessonPlannerDocument(uid));
  if (currentUser?.uid !== uid) throw new Error("Account changed while loading lesson planner data.");
  if (!snapshot.exists()) return { exists: false, revision: 0, state: null };
  const data = snapshot.data() || {};
  return {
    exists: true,
    revision: Math.max(0, Number(data.revision) || 0),
    state: data.state && typeof data.state === "object" ? data.state : null
  };
}

async function saveLessonPlannerCloud(state, { expectedRevision = null } = {}) {
  if (!currentUser || !db || !firestoreSdk) throw new Error("Sign in to save lesson planner data.");
  const uid = currentUser.uid;
  const reference = lessonPlannerDocument(uid);
  const revision = await firestoreSdk.runTransaction(db, async transaction => {
    const snapshot = await transaction.get(reference);
    const currentRevision = snapshot.exists() ? Math.max(0, Number(snapshot.data()?.revision) || 0) : 0;
    if (expectedRevision != null && currentRevision !== Number(expectedRevision)) {
      const error = new Error("Lesson planner cloud data changed on another device.");
      error.code = "planner-conflict";
      error.remoteRevision = currentRevision;
      throw error;
    }
    const nextRevision = currentRevision + 1;
    transaction.set(reference, {
      schemaVersion: 1,
      revision: nextRevision,
      state,
      updatedAt: firestoreSdk.serverTimestamp()
    });
    return nextRevision;
  });
  if (currentUser?.uid !== uid) throw new Error("Account changed while saving lesson planner data.");
  return { revision };
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

function boardCloudLastCheckedAt(uid) {
  if (!uid) return 0;
  try {
    return Math.max(
      Number(sessionStorage.getItem(boardCloudLoadedSessionStorageKey(uid)) || 0),
      Number(localStorage.getItem(boardCloudLoadedSessionStorageKey(uid)) || 0)
    );
  } catch { return 0; }
}

function boardCloudAlreadyLoadedThisSession(uid) {
  const checkedAt = boardCloudLastCheckedAt(uid);
  return checkedAt > 0 && Date.now() - checkedAt < SESSION_CLOUD_RECHECK_TTL;
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
  window.dispatchEvent(new CustomEvent('teachertiles:authstatus',{detail:{message,isError}}));
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

function syncProfileBadgeCount() {
  if (!profileBadgeCount) return;
  const earned = document.querySelectorAll(".profile-badge-grid .profile-badge:not(.profile-badge--locked):not([hidden])").length;
  profileBadgeCount.textContent = `${earned} earned`;
}

function syncSubscriberMarks(state = shopAccountState) {
  const active = Boolean(state?.signedIn && (state?.subscriptionActive || window.TeacherTilesAccount?.state.subscriptionActive));
  if (launchSubscriberCrown) launchSubscriberCrown.hidden = !active;
  if (profileSubscriberCrown) profileSubscriberCrown.hidden = !active;
  toggle?.classList.toggle("is-subscriber", active);
  if (profileSubscriberBadge) {
    profileSubscriberBadge.classList.toggle("profile-badge--locked", !active);

    profileSubscriberBadge.setAttribute("aria-describedby", active ? "subscriber-patch-earned" : "subscriber-patch-requirement");
    profileSubscriberBadge.setAttribute("aria-label", active ? "Subscriber patch. Earned with an active subscription." : "Subscriber patch. Locked. Pay for a monthly subscription to unlock.");
  }
  if (subscriberPatchRequirement) subscriberPatchRequirement.hidden = active;
  if (subscriberPatchEarned) subscriberPatchEarned.hidden = !active;
  if (subscriberPatchCheck) subscriberPatchCheck.hidden = !active;
  syncProfileBadgeCount();
}

window.addEventListener("teachertiles:accountchange", event => syncSubscriberMarks(event.detail));

function publishShopAccount(patch = {}) {
  Object.assign(shopAccountState, patch);
  shopAccountState.coinBalance = Number.isSafeInteger(Number(shopAccountState.coinBalance))
    ? Number(shopAccountState.coinBalance)
    : 0;
  shopAccountState.ownedProductIds = [...new Set(
    (Array.isArray(shopAccountState.ownedProductIds) ? shopAccountState.ownedProductIds : [])
      .filter(value => typeof value === "string")
  )];
  const formattedCoinBalance = shopAccountState.coinBalance.toLocaleString();
  if (profileCoinBalance) profileCoinBalance.textContent = formattedCoinBalance;
  if (profileCoinCard) {
    profileCoinCard.dataset.coinDigits = String(formattedCoinBalance.length);
    profileCoinCard.classList.toggle("is-wide-balance", formattedCoinBalance.length > 9);
    profileCoinCard.classList.toggle("is-extra-wide-balance", formattedCoinBalance.length > 13);
    profileCoinCard.setAttribute("aria-label", `Open the coin shop. Balance: ${formattedCoinBalance} coins.`);
  }
  if(!shopAccountState.signedIn)shopAccountState.patchAwards={};
  syncAwardedPatches(currentUser,shopAccountState.patchAwards);
  syncSubscriberMarks(shopAccountState);
  window.dispatchEvent(new CustomEvent("teachertiles:accountchange", {
    detail: {
      ready: shopAccountState.ready,
      loading: shopAccountState.loading,
      userId: currentUser?.uid || "",
      signedIn: shopAccountState.signedIn,
      coinBalance: shopAccountState.coinBalance,
      ownedProductIds: [...shopAccountState.ownedProductIds],
      subscriptionActive: Boolean(shopAccountState.subscriptionActive)
    }
  }));
}

async function callShopFunction(name, data = {}) {
  if (!currentUser) throw new Error("Sign in to use the TeacherTiles shop.");
  if (!cloudFunctions || !functionsSdk) throw new Error("The TeacherTiles shop is still loading. Try again in a moment.");
  const callable = functionsSdk.httpsCallable(cloudFunctions, name);
  return (await callable(data)).data || {};
}

let shopAccessCheckedAt=0,shopAccessRequest=null;
async function ensureShopAccess(){if(!shopAccountState.ready||Date.now()-shopAccessCheckedAt>300000){if(!shopAccessRequest)shopAccessRequest=refreshShopAccount().finally(()=>{shopAccessRequest=null;});await shopAccessRequest;}return shopAccountState;}
async function refreshShopAccount() {
  if (!currentUser) {
    publishShopAccount({ ready: true, loading: false, signedIn: false, coinBalance: 0, ownedProductIds: [], subscriptionActive: false });
    return { ...shopAccountState };
  }

  const uid = currentUser.uid;
  publishShopAccount({ loading: true, signedIn: true });
  try {
    const account = await callShopFunction("getShopAccount");shopAccessCheckedAt=Date.now();
    if (currentUser?.uid === uid) {
      publishShopAccount({
        ready: true,
        loading: false,
        signedIn: true,
        coinBalance: account.coinBalance,
        ownedProductIds: account.ownedProductIds,
        patchAwards: account.patchAwards || {},
        subscriptionActive: Boolean(account.subscriptionActive)
      });
    }
    return account;
  } catch (error) {
    if (currentUser?.uid === uid) publishShopAccount({ ready: true, loading: false, signedIn: true });
    throw error;
  }
}

function applyReturnedShopAccount(result) {
  if (result && ("coinBalance" in result || "ownedProductIds" in result || "subscriptionActive" in result)) {
    publishShopAccount({
      ready: true,
      loading: false,
      signedIn: Boolean(currentUser),
      coinBalance: result.coinBalance,
      ownedProductIds: result.ownedProductIds,
      subscriptionActive: "subscriptionActive" in result ? Boolean(result.subscriptionActive) : shopAccountState.subscriptionActive
    });
  }
  return result;
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
  const reminders = window.TeacherTilesReminders?.inbox() || [];
  const count = organizationInvites.length + reminders.length+(ticketInbox?.count||0);
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
  ticketInbox?.render(notificationList);
  reminders.forEach(item => {
    const card=document.createElement('article');card.className='profile-notification-card';
    const copy=document.createElement('div');copy.className='profile-notification-card__copy';
    const title=document.createElement('strong');title.textContent=item.text;
    const detail=document.createElement('small');detail.textContent='Reminder · '+new Date(item.dueAt).toLocaleString();
    const dismiss=document.createElement('button');dismiss.type='button';dismiss.className='reminder-dismiss';dismiss.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m5 10 3 3 7-7"/></svg><span>Dismiss</span>';dismiss.onclick=()=>window.TeacherTilesReminders.dismiss(item.id);
    copy.append(title,detail,dismiss);card.append(copy);notificationList.append(card);
  });
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

window.addEventListener('teachertiles:reminderschange',renderNotificationInbox);

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
  if(lockedCosmeticBoard){void reviewLockedBoard();return;}
  if (!boardsView) return;
  // Always synchronize the DOM and body state. A stale boards-screen-open class
  // must never survive just because the view was already marked hidden.
  boardsView.hidden = true;
  boardsView.setAttribute("aria-hidden", "true");
  document.body.classList.remove("boards-screen-open");window.TeacherTilesTheme?.showBoard();
  boardsToggle?.setAttribute("aria-expanded", "false");
}

let lockedCosmeticBoard=null,cosmeticReviewOpen=false;
async function reviewLockedBoard(){if(!lockedCosmeticBoard||cosmeticReviewOpen)return;cosmeticReviewOpen=true;const locked=lockedCosmeticBoard,uid=currentUser?.uid;try{const action=await cosmeticAccessDialog();if(currentUser?.uid!==uid||locked!==lockedCosmeticBoard)return;if(action==='remove'){const snapshot=boardCosmetics.strip(locked.snapshot,await ensureShopAccess());lockedCosmeticBoard=null;document.getElementById('workspace').inert=false;boardApi().load(snapshot);await saveCurrentBoard({immediate:true});closeBoardsView();}else if(action==='subscribe'||action==='shop')openCosmeticShop(action);}catch(error){setBoardStatus(error.message||'Could not update board access.',true);}finally{cosmeticReviewOpen=false;}}
window.TeacherTilesBoardAccessCheck=snapshot=>{if(!currentUser)return true;const needs=boardCosmetics.requirements(snapshot).filter(r=>r.kind!=='theme').length;if(needs&&(!shopAccountState.ready||boardCosmetics.missing(snapshot,shopAccountState).some(r=>r.kind!=='theme'))){lockedCosmeticBoard={id:activeBoardId,snapshot,notLoaded:true};document.getElementById('workspace').inert=true;openBoardsView();if(shopAccountState.ready)void reviewLockedBoard();return false;}return true;};
function checkActiveCosmetics(){if(!currentUser||!activeBoardId||boardLoading||!shopAccountState.ready||shopAccountState.loading)return;if(lockedCosmeticBoard&&lockedCosmeticBoard.id!==activeBoardId){lockedCosmeticBoard=null;document.getElementById('workspace').inert=false;}const snapshot=lockedCosmeticBoard?.snapshot||boardApi()?.capture();if(!snapshot)return;if(boardCosmetics.missing(snapshot,shopAccountState).some(r=>r.kind!=='theme')){if(!lockedCosmeticBoard){lockedCosmeticBoard={id:activeBoardId,snapshot};document.getElementById('workspace').inert=true;openBoardsView();void reviewLockedBoard();}else if(lockedCosmeticBoard.notLoaded)void reviewLockedBoard();}else if(lockedCosmeticBoard){const locked=lockedCosmeticBoard;lockedCosmeticBoard=null;document.getElementById('workspace').inert=false;if(locked.notLoaded)boardApi().load(locked.snapshot);}}
window.addEventListener('teachertiles:accountchange',checkActiveCosmetics);window.addEventListener('teachertiles:boardloaded',()=>queueMicrotask(checkActiveCosmetics));
setInterval(()=>{if(currentUser&&activeBoardId&&!document.hidden)ensureShopAccess().catch(()=>{});},300000);
window.addEventListener('focus',()=>{if(currentUser&&activeBoardId)ensureShopAccess().catch(()=>{});});
let communityTemplates;
function templateLibrary(){
  return communityTemplates ||= createTemplateLibrary({element:boardTemplatesPanel,call:callShopFunction,
    renderPreview:snapshot=>createBoardPreview({theme:snapshot.theme,inlineObjects:snapshot.objects}),
    listBoards:async()=>{await saveCurrentBoard({immediate:true});return boardList.map(board=>({...board,snapshot:{theme:board.theme,objects:board.inlineObjects||board.previewObjects||[]}}));},
    readBoard:async id=>id===activeBoardId?(lockedCosmeticBoard?.snapshot||boardApi().capture()):(await resolveBoardSnapshot(id)).snapshot,
getUid:()=>currentUser?.uid,capture:()=>lockedCosmeticBoard?.snapshot||boardApi()?.capture(),knownTypes:()=>[...document.querySelectorAll('template[id$="-template"]')].map(t=>t.id.slice(0,-9)).concat('sticker'),importBoard:async(id,requestId)=>{
    if(boardList.length>=membershipBoardLimit()){showBoardLimitPopup();throw new Error('You have reached your board limit.');}
    const uid=currentUser?.uid;
    await saveCurrentBoard({immediate:true});
    let result;try{result=await callShopFunction('boardTemplates',{action:'import',id,requestId,clientVersion:globalThis.TeacherTilesTemplateContract.VERSION,viewport:{width:innerWidth,height:innerHeight},supportedTypes:[...document.querySelectorAll('template[id$="-template"]')].map(t=>t.id.slice(0,-9)).concat('sticker')});}catch(error){if(error.details?.reason==='missing-cosmetics'){const action=await cosmeticAccessDialog({importing:true});document.querySelectorAll('.template-dialog').forEach(d=>d.close());if(action==='subscribe')openCosmeticShop(action);return;}throw error;}
    if(currentUser?.uid!==uid)return;
    await fetchBoards();
    await loadBoard(result.boardId,{forceCloudCheck:true});
    if(result.warnings?.length)setBoardStatus('Template added. Some tile content was reset for compatibility.',true);
  }});
}
function setBoardsMenu(menu = "boards") {
  const showTemplates = menu === "templates";
  if(showTemplates)void templateLibrary().open();
  boardsLibraryTab?.classList.toggle("is-active", !showTemplates);
  boardTemplatesTab?.classList.toggle("is-active", showTemplates);
  boardsLibraryTab?.setAttribute("aria-selected", String(!showTemplates));
  boardTemplatesTab?.setAttribute("aria-selected", String(showTemplates));
  if (boardsLibraryPanel) boardsLibraryPanel.hidden = showTemplates;
  if (boardTemplatesPanel) boardTemplatesPanel.hidden = !showTemplates;
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
    frames: Array.isArray(data.frames) ? data.frames.slice(0, 5) : [],
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
    frames: Array.isArray(data.frames) ? data.frames.slice(0, 5) : [],
    preferences: data.preferences && typeof data.preferences === "object" ? data.preferences : {},
    calendarEvents: Array.isArray(data.calendarEvents) ? data.calendarEvents : [],
    objects: Array.isArray(data.objects) ? data.objects.filter(object => object?.id) : [],
    preview: Array.isArray(data.preview) ? data.preview.slice(0, 48) : []
  });
}

function stableBoardJson(value) {
  return JSON.stringify(value, (_key, item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    return Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]]));
  });
}

function contentHashForSnapshot(snapshot) {
  const clean = cleanBoardSnapshot(snapshot);
  return hashText(stableBoardJson({
    schemaVersion: clean.schemaVersion,
    theme: clean.theme,
    frames: clean.frames,
    preferences: clean.preferences,
    calendarEvents: clean.calendarEvents,
    objects: clean.objects
  }));
}

function localHashForSnapshot(snapshot) {
  const clean = cleanBoardSnapshot(snapshot);
  return hashText(stableBoardJson({
    schemaVersion: clean.schemaVersion,
    theme: clean.theme,
    camera: clean.camera,
    frames: clean.frames,
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
    egghatching: "activeClassId",flowerpots: "activeClassId",
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
      eggHatching: {studentPoints: selectValues(roster.eggHatching?.studentPoints),studentProgress: selectValues(roster.eggHatching?.studentProgress)},
      flowerPots: {studentPoints: selectValues(roster.flowerPots?.studentPoints),studentProgress: selectValues(roster.flowerPots?.studentProgress)},
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
    const positions = {};
    for (const name of students) {
      const status = object.special.assignments?.[name];
      assignments[name] = status === "present" ? "present" : "default";
      const saved = object.special.positions?.[name];
      if (saved && Number.isFinite(Number(saved.x)) && Number.isFinite(Number(saved.y))) {
        positions[name] = {
          zone: assignments[name],
          x: Math.max(0.18, Math.min(0.82, Number(saved.x))),
          y: Math.max(0.14, Math.min(0.86, Number(saved.y)))
        };
      }
    }
    preview.special = {
      classId: String(object.special.classId || "").slice(0, 180),
      className: String(object.special.className || "Class").slice(0, 100),
      classLogo: String(object.special.classLogo || "👥").slice(0, 16),
      students,
      assignments,
      positions
    };
  }

  const pbisPreviewKeys = {
    starchart: ["classId", "showAllStudents", "collapsedHeight"],
    classmeter: ["classId", "orientation"],
    collections: ["classId"],
    prizeboard: ["activeClassId", "scope"],
    pbisconsole: ["activeClassId", "student", "view"],
    egghatching: ["activeClassId"],
    flowerpots: ["activeClassId", "goal"],
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

function markBoardMetadataChecked(board, checkedAt = Date.now()) {
  if (board) board.cloudCheckedAt = checkedAt;
  return board;
}

function boardMetadataRecentlyChecked(board, maxAge = ACTIVE_BOARD_CLOUD_RECHECK_TTL) {
  const checkedAt = Number(board?.cloudCheckedAt) || 0;
  return checkedAt > 0 && Date.now() - checkedAt < maxAge;
}

function boardNeedsOpenCloudCheck(boardId) {
  // Reuse the document just returned by the library or a save, but still check
  // older boards when explicitly opening them on another device/session.
  return !boardMetadataRecentlyChecked(boardList.find(board => board.id === boardId), 15000);
}

function serializableBoardMetadata(board) {
  return {
    id: board.id,
    name: board.name,
    theme: board.theme || "light",
    camera: board.camera || null,
    frames: Array.isArray(board.frames) ? board.frames.slice(0, 5) : [],
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
    hasConflict: Boolean(board.hasConflict),
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
  // Each tab owns its pending edits; another window must not replace them.
  try {
    const pending = JSON.parse(sessionStorage.getItem(key) || "null");
    if (pending?.snapshot) {
      localBoardMemory.set(key, pending);
      return pending;
    }
  } catch {}
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
  try {
    if (value.dirty) sessionStorage.setItem(key, JSON.stringify(value));
    else sessionStorage.removeItem(key);
  } catch (error) { console.warn("TeacherTiles pending save backup failed", error); }
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
  try { sessionStorage.removeItem(key); } catch {}
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
    frames: board.frames,
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
  board.frames = snapshot.frames || [];
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
  const uid = currentUser.uid;
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
    frames: clean.frames,
    preferences: clean.preferences,
    calendarEvents: clean.calendarEvents,
    preview: clean.preview,
    objectCount: clean.objects.length,
    storageFormat: plan.format,
    stateChunkCount: plan.chunks.length,
    stateChunkHashes: plan.chunkHashes,
    revision,
    contentHash,
    legacyCleanupPending
  });
  payload.updatedAt = firestoreSdk.serverTimestamp();
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

  // Never publish partial chunks or overwrite a revision from another device.
  if (stateWrites.length > 450 || byteLength(clean) > 8 * 1024 * 1024) {
    throw new Error("This board is too large to sync atomically. Your local copy is retained.");
  }
  await firestoreSdk.runTransaction(db, async transaction => {
    const ref = boardDocument(uid, boardId);
    const remote = await transaction.get(ref);
    const data = remote.exists() ? remote.data() : null;
    if ((isNew && data) || (!isNew && (!data ||
        (Number(data.revision) || 0) !== revision - 1 ||
        (data.contentHash && data.contentHash !== (board.cloudContentHash || ""))))) {
      const error = new Error("This board changed on another device.");
      error.code = "board-conflict";
      throw error;
    }
    for (const operation of stateWrites) {
      const chunkRef = boardStateDocument(uid, boardId, operation.index);
      if (operation.type === "delete") transaction.delete(chunkRef);
      else transaction.set(chunkRef, operation.data);
    }
    // Renaming is independent of board content; a stale tab must not undo it.
    transaction.set(ref, { ...payload, name: isNew ? name : (data.name || name) }, { merge: true });
  });
  if (currentUser?.uid !== uid) return true;

  board.revision = revision;
  board.cloudContentHash = contentHash;
  markBoardMetadataChecked(board);
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

  // Capture the board id and its snapshot together before the first await. A board
  // switch must never be able to pair one board's state with another board's id.
  const savingBoardId = activeBoardId;
  const savingSnapshot = cleanBoardSnapshot(lockedCosmeticBoard?.snapshot||api.capture());
  const result = await cacheSnapshotLocally(savingBoardId, savingSnapshot);
  if (result?.dirty && activeBoardId === savingBoardId) setBoardStatus("Unsaved");
  if (!boardsView?.hidden) renderBoards();
  return result ? { ...result, boardId: savingBoardId } : null;
}

// Per-board automatic saves are coalesced; explicit switch/sign-out saves still flush.
const cloudBoardLastWriteAt = new Map();
const cloudBoardRetryCounts = new Map();
const AUTOMATIC_CLOUD_SAVE_INTERVAL = 30000;
function clearCloudBoardSaveTimer(boardId) {
  const id = String(boardId || "");
  if (!id) return;
  const timer = cloudBoardSaveTimers.get(id);
  if (timer) clearTimeout(timer);
  cloudBoardSaveTimers.delete(id);
}

function clearAllCloudBoardSaveTimers() {
  for (const timer of cloudBoardSaveTimers.values()) clearTimeout(timer);
  cloudBoardSaveTimers.clear();
  cloudBoardLastWriteAt.clear();
  cloudBoardRetryCounts.clear();
}

function scheduleCloudBoardSave(delay = CLOUD_SAVE_DELAY, boardId = activeBoardId) {
  const targetBoardId = String(boardId || "");
  if (!currentUser || !targetBoardId) return;
  clearCloudBoardSaveTimer(targetBoardId);
  const timer = window.setTimeout(() => {
    cloudBoardSaveTimers.delete(targetBoardId);
    saveCachedBoardToCloud(targetBoardId, { automatic: true });
  }, Math.max(delay, (cloudBoardLastWriteAt.get(targetBoardId) || 0) + AUTOMATIC_CLOUD_SAVE_INTERVAL - Date.now()));
  cloudBoardSaveTimers.set(targetBoardId, timer);
}

async function saveCachedBoardToCloud(boardId, { automatic = false } = {}) {
  const targetBoardId = String(boardId || "");
  if (!currentUser || !targetBoardId || !db || !firestoreSdk) return false;
  const userId = currentUser.uid;
  clearCloudBoardSaveTimer(targetBoardId);

  // Serialize cloud writes, but keep every write tied to the board id that
  // produced it. This prevents an in-flight save from following activeBoardId
  // after the user switches boards.
  const previous = boardSavePromise;
  const task = (previous ? previous.catch(() => {}) : Promise.resolve()).then(async () => {
    if (!currentUser || currentUser.uid !== userId) return false;
    if (automatic && Date.now() - (cloudBoardLastWriteAt.get(targetBoardId) || 0) < AUTOMATIC_CLOUD_SAVE_INTERVAL) {
      scheduleCloudBoardSave(CLOUD_SAVE_DELAY, targetBoardId);
      return false;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
    const pendingConflict = await readLocalBoardSnapshot(userId, boardConflictKey(targetBoardId));
    if (pendingConflict?.pending) { setBoardStatus('Save conflict — review this board in Boards. Edits are saved locally.'); return false; }
    boardSaving = true;
    const showStatus = activeBoardId === targetBoardId;
    if (showStatus) setBoardStatus("Saving…");
    let wrote = false;

    try {
      // A write can finish after a newer local snapshot has been captured. The
      // cloud writer deliberately leaves that newer snapshot dirty; loop until
      // this specific board is truly clean instead of queueing a save against
      // whichever board happens to be active later.
      while (currentUser?.uid === userId) {
        const local = await readLocalBoardSnapshot(userId, targetBoardId);
        if (!local?.snapshot || !local.dirty) break;
        const board = boardList.find(item => item.id === targetBoardId);
        if (!board) break;
        board.revision = Number(local.revision) || 0;
        board.cloudContentHash = local.cloudContentHash || "";
        await writeBoardSnapshotToCloud(targetBoardId, getBoardName(targetBoardId), cleanBoardSnapshot(local.snapshot), {
          forceMigration: Boolean(board.needsMigration)
        });
        wrote = true;
        cloudBoardLastWriteAt.set(targetBoardId, Date.now());
        cloudBoardRetryCounts.delete(targetBoardId);
        if (automatic) {
          const pending = await readLocalBoardSnapshot(userId, targetBoardId);
          if (pending?.dirty) scheduleCloudBoardSave(CLOUD_SAVE_DELAY, targetBoardId);
          break;
        }
      }

      if (showStatus && activeBoardId === targetBoardId && localBoardMemory.get(localBoardKey(userId, targetBoardId))?.dirty) {
        setBoardStatus("Saved locally — waiting to sync");
      } else if (showStatus && activeBoardId === targetBoardId) {
        setBoardStatus("Saved");
        window.setTimeout(() => {
          if (activeBoardId === targetBoardId && boardsSaveStatus?.textContent === "Saved") setBoardStatus("");
        }, 1400);
      }
      if (!boardsView?.hidden) renderBoards();
      return wrote;
    } catch (error) {
      if (error.code === "board-conflict" && currentUser?.uid === userId) {
        try {
          await preserveConflictingBoard(targetBoardId);
          return true;
        } catch (recoveryError) { console.error("TeacherTiles recovery save failed", recoveryError); }
      }
      console.error("TeacherTiles board save failed", error);
      if (activeBoardId === targetBoardId) setBoardStatus("Saved locally — cloud sync failed", true);
      if (currentUser?.uid === userId && !['permission-denied','unauthenticated','invalid-argument','failed-precondition','not-found'].includes(error.code)) {
        const failures = (cloudBoardRetryCounts.get(targetBoardId) || 0) + 1;
        cloudBoardRetryCounts.set(targetBoardId, failures);
        scheduleCloudBoardSave(Math.min(300000, 15000 * 2 ** Math.min(failures - 1, 5)), targetBoardId);
      }
      return false;
    } finally {
      boardSaving = false;
    }
  });

  boardSavePromise = task;
  try {
    return await task;
  } finally {
    if (boardSavePromise === task) boardSavePromise = null;
  }
}

function boardConflictKey(boardId) { return 'conflict/' + boardId; }
function boardHasConflict(board) {
  return Boolean(board?.hasConflict || localBoardMemory.get(localBoardKey(currentUser?.uid, boardConflictKey(board?.id)))?.pending);
}
async function preserveConflictingBoard(boardId) {
  const uid = currentUser.uid;
  const local = await readLocalBoardSnapshot(uid, boardId);
  if (!local?.snapshot) throw new Error('No local recovery snapshot available.');
  // Recovery belongs to the existing board, never to another board quota slot.
  await writeLocalBoardSnapshot(uid, boardConflictKey(boardId), { snapshot: local.snapshot, pending: true, dirty: true });
  if (currentUser?.uid !== uid) return;
  const board = boardList.find(item => item.id === boardId);
  if (board) board.hasConflict = true;
  clearCloudBoardSaveTimer(boardId);
  cacheBoardListMetadata();
  setBoardStatus('Save conflict — review both versions in Boards. Your edits are safe in this browser.');
  if (!boardsView?.hidden) renderBoards();
}

function mergeBoardConflictSnapshots(local, cloud, settingsSource = 'local') {
  const primary = settingsSource === 'cloud' ? cloud : local;
  const secondary = settingsSource === 'cloud' ? local : cloud;
  const combine = (first, second) => {
    const result = cleanFirestoreValue(first || []);
    const byId = new Map(result.map(item => [item.id, item]));
    for (const item of second || []) {
      const existing = byId.get(item.id);
      if (!existing) { result.push(cleanFirestoreValue(item)); byId.set(item.id, item); }
      else if (stableBoardJson(existing) !== stableBoardJson(item)) {
        let id = item.id + '-merged', n = 1;
        while (byId.has(id) || (second || []).some(other => other.id === id)) id = item.id + '-merged-' + n++;
        const copy = { ...cleanFirestoreValue(item), id };
        result.push(copy); byId.set(id, copy);
      }
    }
    return result;
  };
  return cleanBoardSnapshot({ ...primary, objects: combine(primary.objects, secondary.objects), calendarEvents: combine(primary.calendarEvents, secondary.calendarEvents), preview: [] });
}

async function readBoardConflictReview(boardId) {
  const uid = currentUser.uid;
  if (activeBoardId === boardId) await flushCurrentBoardLocal();
  const pending = await readLocalBoardSnapshot(uid, boardConflictKey(boardId));
  if (!pending?.pending) throw new Error('This board no longer has a pending conflict.');
  const local = await readLocalBoardSnapshot(uid, boardId);
  const doc = await firestoreSdk.getDocFromServer(boardDocument(uid, boardId));
  if (!doc.exists()) throw new Error('The cloud board was deleted. Your local copy is retained; review cannot replace a deleted board.');
  const remote = normalizeBoardMetadata(doc);
  const cloud = await readCloudBoardSnapshot(remote);
  if (currentUser?.uid !== uid) throw new Error('Account changed during review.');
  return { uid, boardId, local: cleanBoardSnapshot(local?.snapshot || pending.snapshot), cloud: cloud.snapshot, remote };
}

function clearEmergencyBoardBackup(uid, boardId) {
  const key = `teachertiles-last-local-board-${uid}`;
  for (const storage of [sessionStorage, localStorage]) {
    try {
      const backup = JSON.parse(storage.getItem(key) || "null");
      if (backup?.boardId === boardId) storage.removeItem(key);
    } catch {}
  }
}

async function resolveBoardConflict(review, choice, settingsSource = 'local') {
  if (!['local', 'cloud', 'merge'].includes(choice)) throw new Error('Choose a version to keep.');
  const { uid, boardId } = review;
  if (currentUser?.uid !== uid) throw new Error('Account changed. Open the review again.');
  const chosen = choice === 'merge' ? mergeBoardConflictSnapshots(review.local, review.cloud, settingsSource) : review[choice];
  const oldBoard = boardList.find(board => board.id === boardId);
  if (!oldBoard) throw new Error('Board not found.');
  const originalMeta = { ...oldBoard };
  let latest = await readLocalBoardSnapshot(uid, boardId);
  let migrateCloudChoice = false;

  boardLoading = true;
  clearTimeout(localBoardSaveTimer);
  clearCloudBoardSaveTimer(boardId);
  try {
    if (boardSavePromise) await boardSavePromise.catch(() => {});
    latest = await readLocalBoardSnapshot(uid, boardId) || latest;
    const doc = await firestoreSdk.getDocFromServer(boardDocument(uid, boardId));
    if (currentUser?.uid !== uid) throw new Error('Account changed. Open the review again.');
    if (!doc.exists() || (Number(doc.data().revision) || 0) !== review.remote.revision || (doc.data().contentHash || '') !== review.remote.cloudContentHash) throw new Error('The cloud board changed again. Close and reopen the review before choosing.');

    // Retain both reviewed versions locally even after the chosen result syncs.
    await writeLocalBoardSnapshot(uid, 'conflict-archive/' + boardId, { snapshot: review.local, cloudSnapshot: review.cloud, dirty: false });
    if (currentUser?.uid !== uid) throw new Error('Account changed. Open the review again.');

    Object.assign(oldBoard, review.remote, { hasConflict: true });
    boardLocalHashes.delete(boardId);

    if (choice === 'cloud') {
      // Choosing cloud is a discard operation for this browser. Replace the local
      // cache with the reviewed cloud snapshot rather than sending it back through
      // the cloud writer or retaining stale conflict-era metadata.
      await deleteLocalBoardSnapshot(uid, boardId);
      const needsMigration = Boolean(oldBoard.needsMigration || oldBoard.storageFormat === 'legacy-objects-v1');
      await cacheSnapshotLocally(boardId, chosen, { dirty: needsMigration });
      migrateCloudChoice = needsMigration;
    } else {
      await cacheSnapshotLocally(boardId, chosen, { dirty: true });
      if (currentUser?.uid !== uid) throw new Error('Account changed. Open the review again.');
      await writeBoardSnapshotToCloud(boardId, oldBoard.name, chosen);
    }

    if (currentUser?.uid !== uid) return;
    await deleteLocalBoardSnapshot(uid, boardConflictKey(boardId));
    clearEmergencyBoardBackup(uid, boardId);
    oldBoard.hasConflict = false;
    if (activeBoardId === boardId) boardApi().load(chosen);
    if (migrateCloudChoice) scheduleCloudBoardSave(2200, boardId);
    cacheBoardListMetadata(); renderBoards(); setBoardStatus('Conflict resolved — saved');
  } catch (error) {
    if (currentUser?.uid === uid) {
      Object.assign(oldBoard, originalMeta, { hasConflict: true });
      boardLocalHashes.delete(boardId);
      await cacheSnapshotLocally(boardId, latest?.snapshot || review.local, { dirty: true });
    }
    throw error;
  } finally { boardLoading = false; }
}

async function openBoardConflictReview(boardId) {
  const dialog = document.createElement('dialog');dialog.className = 'board-conflict-review';
  const title = document.createElement('h2');title.textContent = 'Review conflicting versions';
  const intro = document.createElement('p');intro.textContent = 'Loading both versions…';
  const content = document.createElement('div');content.className = 'board-conflict-versions';
  const status = document.createElement('p');status.setAttribute('role','status');
  const close = document.createElement('button');close.type = 'button';close.textContent = 'Review later';close.className = 'board-conflict-close';
  close.onclick = () => dialog.close();dialog.addEventListener('close',()=>{dialog.remove();document.querySelector('.board-card[data-board-id="'+CSS.escape(boardId)+'"] .board-card__conflict')?.focus()});
  dialog.append(title,intro,content,status,close);document.body.append(dialog);dialog.showModal();
  let busy = false;dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault()});
  try {
    const review = await readBoardConflictReview(boardId);
    if (!dialog.isConnected) return;
    intro.textContent = 'Choose a version or combine their tiles. This keeps one board and uses no extra board slot. Local edits remain in this browser until you resolve the conflict.';
    const actions = [];
    const resolve = async choice => {
      if (busy) return;busy = true;actions.forEach(button=>button.disabled=true);close.disabled=true;settings.disabled=true;status.textContent='Saving your choice…';
      try { await resolveBoardConflict(review,choice,settings.value);dialog.close(); }
      catch(error){status.textContent=error.message;busy=false;actions.forEach(button=>button.disabled=false);close.disabled=false;settings.disabled=false;}
    };
    for (const [key,label] of [['local','This browser'],['cloud','Cloud version']]) {
      const snapshot = review[key],section = document.createElement('section'),heading = document.createElement('h3');heading.textContent=label;
      const preview = document.createElement('div');preview.className='board-card__preview '+previewThemeClass(snapshot.theme);
      const objects = document.createElement('div');objects.className='board-card__objects';
      for(const item of layoutBoardPreviewObjects(snapshot.objects.slice(0,48))) objects.append(createMiniObject(item));preview.append(objects);
      const details = document.createElement('p');details.textContent=snapshot.objects.length+' '+(snapshot.objects.length===1?'tile':'tiles')+' · '+snapshot.frames.length+' '+(snapshot.frames.length===1?'frame':'frames');
      const frames = document.createElement('p');frames.className='board-conflict-frames';frames.textContent=snapshot.frames.map(frame=>frame.name||'Untitled frame').join(' · ')||'No frames';
      const button=document.createElement('button');button.type='button';button.textContent=key==='local'?'Keep this browser’s version':'Keep cloud version';button.onclick=()=>resolve(key);actions.push(button);section.append(heading,preview,details,frames,button);content.append(section);
    }
    const merge = document.createElement('div');merge.className='board-conflict-merge';
    const explanation=document.createElement('p');explanation.textContent='Merge keeps tiles from both versions. Differently edited copies of the same tile are kept separately, in their original positions. Tiles deleted in only one version will return. Choose which frame list, theme, view and settings to keep:';
    const settings=document.createElement('select');settings.setAttribute('aria-label','Board settings to keep when merging');settings.add(new Option('Keep this browser’s frames and settings','local'));settings.add(new Option('Keep the cloud version’s frames and settings','cloud'));
    const button=document.createElement('button');button.type='button';button.textContent='Merge tiles into this board';button.onclick=()=>resolve('merge');actions.push(button);merge.append(explanation,settings,button);content.after(merge);
  } catch(error){intro.textContent=error.message;}
}

async function saveCurrentBoard({ immediate = false } = {}) {
  clearTimeout(localBoardSaveTimer);
  if (!currentUser || !activeBoardId || !db || !firestoreSdk || boardLoading || lockedCosmeticBoard) return false;
  const api = boardApi();
  if (!api) return false;

  // Capture synchronously so asynchronous IndexedDB/Firestore work can never
  // change which board this snapshot belongs to.
  const savingBoardId = activeBoardId;
  const savingSnapshot = cleanBoardSnapshot(lockedCosmeticBoard?.snapshot||api.capture());
  const local = await cacheSnapshotLocally(savingBoardId, savingSnapshot);

  if (!local?.dirty) {
    clearCloudBoardSaveTimer(savingBoardId);
    if (activeBoardId === savingBoardId && boardsSaveStatus?.textContent === "Unsaved") setBoardStatus("");
    return false;
  }

  if (!immediate) {
    scheduleCloudBoardSave(CLOUD_SAVE_DELAY, savingBoardId);
    return true;
  }

  return saveCachedBoardToCloud(savingBoardId);
}

function scheduleBoardSave(reason = "change") {
  if (!currentUser || !activeBoardId || boardLoading) return;
  pendingBoardChangeReason = reason || "change";
  const scheduledBoardId = activeBoardId;
  clearTimeout(localBoardSaveTimer);
  localBoardSaveTimer = window.setTimeout(async () => {
    // loadBoard() flushes the outgoing board before changing activeBoardId. If
    // some other path changed it, do not capture the new board under the old
    // change event.
    if (activeBoardId !== scheduledBoardId) {
      pendingBoardChangeReason = "";
      return;
    }
    const local = await flushCurrentBoardLocal();
    if (local?.dirty) scheduleCloudBoardSave(CLOUD_SAVE_DELAY, local.boardId);
    pendingBoardChangeReason = "";
  }, LOCAL_SAVE_DELAY);
}

let boardLibraryRefreshPromise = null;
let boardLibraryCheckedAt = 0;
function refreshBoardLibrary({ force = false } = {}) {
  if (!currentUser || !db || !firestoreSdk) return Promise.resolve();
  if (!force && boardLibraryCheckedAt && Date.now() - boardLibraryCheckedAt < BOARD_LIBRARY_RECHECK_TTL) return Promise.resolve();
  if (boardLibraryRefreshPromise) return boardLibraryRefreshPromise;
  const uid = currentUser.uid;
  const idsAtStart = new Set(boardList.map(board => board.id));
  boardLibraryRefreshPromise = (async () => {
    const result = await firestoreSdk.getDocsFromServer(boardCollection(uid));
    if (currentUser?.uid !== uid) return;
    const checkedAt = Date.now();
    const remote = result.docs.map(item => markBoardMetadataChecked(normalizeBoardMetadata(item), checkedAt));
    const preserved = new Map();
    for (const board of [...boardList]) {
      const local = await readLocalBoardSnapshot(uid, board.id);
      if (board.id === activeBoardId || local?.dirty || !idsAtStart.has(board.id)) preserved.set(board.id, board);
    }
    if (currentUser?.uid !== uid) return;
    boardList = sortBoards(remote.map(board => preserved.get(board.id) || board));
    for (const board of preserved.values()) {
      if (!boardList.some(item => item.id === board.id)) boardList.push(board);
    }
    for (const board of boardList) board.hasConflict = Boolean((await readLocalBoardSnapshot(uid, boardConflictKey(board.id)))?.pending);
    boardLibraryCheckedAt = checkedAt;
    markBoardCloudLoadedForSession(uid);
    cacheBoardListMetadata();
  })().finally(() => { boardLibraryRefreshPromise = null; });
  return boardLibraryRefreshPromise;
}

async function fetchBoards() {
  if (!currentUser || !db || !firestoreSdk) return [];
  const uid = currentUser.uid;
  const snapshot = await firestoreSdk.getDocsFromServer(boardCollection(uid));
  if (currentUser?.uid !== uid) return [];
  const checkedAt = Date.now();
  boardList = sortBoards(snapshot.docs.map(item => markBoardMetadataChecked(normalizeBoardMetadata(item), checkedAt)));
  const cached = restoreBoardListMetadata(uid);
  for (const previous of cached?.boards || []) {
    if (boardList.some(board => board.id === previous.id)) continue;
    const local = await readLocalBoardSnapshot(uid, previous.id);
    if (local?.dirty) boardList.push(previous);
  }
  boardListLoadedFromNetwork = true;
  boardLibraryCheckedAt = checkedAt;
  markBoardCloudLoadedForSession(uid);

  for (const board of boardList) {
    board.hasConflict = Boolean((await readLocalBoardSnapshot(uid, boardConflictKey(board.id)))?.pending);
    if (!Array.isArray(board.inlineObjects)) continue;
    const cloudSnapshot = snapshotFromBoard(board, board.inlineObjects);
    const local = await readLocalBoardSnapshot(uid, board.id);
    if (!local || (!local.dirty && Number(local.revision) <= board.revision)) {
      await writeLocalBoardSnapshot(uid, board.id, {
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
  const uid = currentUser.uid;
  const snapshot = await firestoreSdk.getDocFromServer(boardDocument(uid, boardId));
  if (currentUser?.uid !== uid) throw new Error("Account changed while loading.");
  if (!snapshot.exists()) {
    const local = await readLocalBoardSnapshot(uid, boardId);
    const cached = boardList.find(board => board.id === boardId);
    if (local?.dirty && cached) return cached;
    throw new Error("Board no longer exists.");
  }
  const board = markBoardMetadataChecked(normalizeBoardMetadata(snapshot));
  const index = boardList.findIndex(item => item.id === boardId);
  if (index >= 0) boardList[index] = board;
  else boardList.push(board);
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
    const chunkSnapshot = await firestoreSdk.getDocsFromServer(boardStateCollection(currentUser.uid, meta.id));
    const docs = [...chunkSnapshot.docs].sort((a, b) => a.id.localeCompare(b.id));
    if (docs.length !== meta.stateChunkCount || docs.some((doc, index) =>
      doc.id !== `chunk-${String(index).padStart(3, "0")}` ||
      !Array.isArray(doc.data().objects))) {
      throw new Error("Board chunks changed while loading. Please retry; the saved board has been retained.");
    }
    const objects = docs.flatMap(docSnapshot => {
      const data = docSnapshot.data() || {};
      return Array.isArray(data.objects) ? data.objects : [];
    });
    const latest = await firestoreSdk.getDocFromServer(boardDocument(currentUser.uid, meta.id));
    if (!latest.exists() || (Number(latest.data().revision) || 0) !== meta.revision ||
        (latest.data().contentHash || "") !== meta.cloudContentHash || objects.length !== meta.objectCount) {
      throw new Error("Board changed while loading. Please retry; the saved board has been retained.");
    }
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

async function resolveBoardSnapshot(boardId, { forceCloudCheck = false } = {}) {
  let board = boardList.find(item => item.id === boardId);
  const local = await readLocalBoardSnapshot(currentUser.uid, boardId);

  if (board && local?.snapshot && local.dirty) {
    board.revision = Math.max(0, Number(local.revision) || 0);
    board.cloudContentHash = local.cloudContentHash || "";
    board.localDirty = true;
    boardLocalHashes.set(boardId, localHashForSnapshot(local.snapshot));
    return { snapshot: cleanBoardSnapshot(local.snapshot), fromLocal: true, dirty: true, legacy: false };
  }

  if (!board || forceCloudCheck || !boardMetadataRecentlyChecked(board)) board = await refreshSingleBoardMetadata(boardId);

  if (local?.snapshot) {
    const localRevision = Math.max(0, Number(local.revision) || 0);
    if (localRevision === board.revision && local.contentHash === board.cloudContentHash) {
      board.localDirty = false;
      boardLocalHashes.set(boardId, localHashForSnapshot(local.snapshot));
      return { snapshot: cleanBoardSnapshot(local.snapshot), fromLocal: true, dirty: false, legacy: false };
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

async function loadBoard(boardId, { closeView = true, forceCloudCheck = false } = {}) {
  let showBoardsAfterLoad=false;
  if (!currentUser || !boardId || !db || !firestoreSdk) return;
  const api = boardApi();
  if (!api) return;

  // Do not let a board switch discard or redirect the outgoing board's last
  // changes. This also waits for any frame save already in flight.
  if (activeBoardId && activeBoardId !== boardId) {
    clearTimeout(localBoardSaveTimer);
    await saveCurrentBoard({ immediate: true });
  }

  boardLoading = true;
  setBoardStatus("Loading…");

  try {
    const uid=currentUser.uid;
    const resolved = await resolveBoardSnapshot(boardId, { forceCloudCheck });
    await ensureShopAccess();if(currentUser?.uid!==uid)return;if(boardCosmetics.missing({...resolved.snapshot,objects:[]},shopAccountState).length){resolved.snapshot={...resolved.snapshot,theme:'light'};resolved.dirty=true;await cacheSnapshotLocally(boardId,resolved.snapshot,{dirty:true});}
    if(boardCosmetics.missing(resolved.snapshot,shopAccountState).some(r=>r.kind!=='theme')){const action=await cosmeticAccessDialog();if(currentUser?.uid!==uid)return;if(action!=='remove'){showBoardsAfterLoad=true;openBoardsView();if(action==='subscribe'||action==='shop')openCosmeticShop(action);return;}resolved.snapshot=boardCosmetics.strip(resolved.snapshot,shopAccountState);resolved.dirty=true;await cacheSnapshotLocally(boardId,resolved.snapshot,{dirty:true});}
    lockedCosmeticBoard=null;document.getElementById('workspace').inert=false;
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
      setBoardStatus("Some tiles could not display. Their saved data has been retained.", true);
    }
    if (resolved.dirty || resolved.legacy) {
      scheduleCloudBoardSave(resolved.legacy ? 2200 : CLOUD_SAVE_DELAY, boardId);
    }

    if (closeView) closeBoardsView();

    // Tile setup may schedule focus() during restore. Dispatch after those queued
    // callbacks have had a chance to run so app.js can normalize frame-hotkey
    // state and clear restore-created input focus.
    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent("teachertiles:boardloaded", { detail: { boardId } }));
    });
  } catch (error) {
    console.error("TeacherTiles board load failed", error);
    setBoardStatus("Could not load board", true);
  } finally {
    boardLoading = false;
    if(showBoardsAfterLoad||lockedCosmeticBoard){void openBoardsView();checkActiveCosmetics();}
  }
}

function createBoardReference() {
  return firestoreSdk.doc(boardCollection(currentUser.uid));
}

async function createInitialBoardFromWorkspace() {
  const api = boardApi();
  if (!api) return null;
  const ref = createBoardReference();
  const snapshot = cleanBoardSnapshot(lockedCosmeticBoard?.snapshot||api.capture());
  const name = "Board 1";
  const board = {
    id: ref.id,
    name,
    theme: snapshot.theme,
    camera: snapshot.camera,
    frames: snapshot.frames,
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
  popup.querySelector("#board-limit-popup-title").textContent=membershipBoardLimit()===20?"You have reached the 20-board limit.":"Subscribe to save more than two boards.";
  popup.hidden = false;
  requestAnimationFrame(() => popup.classList.add("is-open"));
  popup.querySelector(".board-limit-popup__close")?.focus({ preventScroll: true });
}

function membershipBoardLimit(){return shopAccountState.subscriptionActive||window.TeacherTilesAccount?.state.subscriptionActive?20:2}

async function createBlankBoard({ skipSave = false, closeView = true } = {}) {
  if (!currentUser || !firestoreSdk || !db) return;
  if (boardList.length >= membershipBoardLimit()) {
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
    frames: snapshot.frames,
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
    window.TeacherTilesReminders?.cancelBoard(boardId);
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

  const preview = createBoardPreview(board);

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
      openButton.disabled = true;
      try { await refreshActiveBoardFromCloud({ force: boardNeedsOpenCloudCheck(board.id) }); }
      finally { openButton.disabled = false; }
      closeBoardsView();
      return;
    }

    openButton.disabled = true;
    try {
      await saveCurrentBoard({ immediate: true });
      await loadBoard(board.id, { forceCloudCheck: boardNeedsOpenCloudCheck(board.id) });
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
  if (boardHasConflict(board)) {
    const review = document.createElement('button');review.type='button';review.className='board-card__conflict';review.textContent='! Review conflict';review.setAttribute('aria-label','Review conflicting versions of '+board.name);
    review.addEventListener('click',event=>{event.stopPropagation();openBoardConflictReview(board.id)});card.append(review);
  }
  return card;
}

function createNewBoardCard() {
  const isAtFreeLimit = boardList.length >= membershipBoardLimit();
  const button = document.createElement("button");
  button.type = "button";
  button.className = `board-new-card${isAtFreeLimit ? " is-subscriber-gated" : ""}`;
  button.setAttribute("aria-label", isAtFreeLimit ? (membershipBoardLimit()===20?"20-board limit reached":"Subscribe to save more than two boards") : boardUiText("boards.create", "Create new blank board"));

  const preview = document.createElement("div");
  preview.className = "board-new-card__preview";

  const plus = document.createElement("span");
  plus.className = "board-new-card__plus";
  plus.textContent = "+";

  preview.appendChild(plus);
  if (isAtFreeLimit && membershipBoardLimit()===2) {
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
  button.addEventListener("click", () => boardList.length >= membershipBoardLimit() ? showBoardLimitPopup() : createBlankBoard());
  return button;
}

function updateBoardCapacity(){const badge=document.getElementById("boards-capacity");if(!badge)return;const limit=membershipBoardLimit();badge.textContent=`${boardList.length} / ${limit} boards`;badge.setAttribute("aria-label",`${boardList.length} of ${limit} boards used`);badge.classList.toggle("is-full",boardList.length>=limit);}
window.addEventListener("teachertiles:accountchange",()=>{updateBoardCapacity();if(!boardsView?.hidden)renderBoards();});
function renderBoards() {
  updateBoardCapacity();
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
  document.body.classList.add("boards-screen-open");window.TeacherTilesTheme?.hideBoard();
  boardsToggle?.setAttribute("aria-expanded", "true");
  setBoardsMenu("boards");

  // Show local boards immediately, then discover boards saved by other sessions.
  await flushCurrentBoardLocal();
  renderBoards();
  boardsLoading.hidden = false;
  try {
    await refreshBoardLibrary();
    renderBoards();
  } catch (error) {
    console.warn("TeacherTiles could not refresh the board library", error);
    setBoardStatus("Showing local boards — could not check for other saved boards. Reopen Boards to retry.", true);
  } finally { boardsLoading.hidden = true; }
}

async function initializeBoardsForUser(user) {
  if (!user || !db || !firestoreSdk || !boardApi()) return;

  boardLoading = true;
  setBoardStatus("Loading…");

  try {
    await restoreEmergencyBoardSnapshot(user.uid);
    const cached = restoreBoardListMetadata(user.uid);
    const cloudCheckedAt = boardCloudLastCheckedAt(user.uid);
    const cachedIsFresh = Boolean(cached?.boards?.length && cloudCheckedAt > 0 && Date.now() - cloudCheckedAt < SESSION_CLOUD_RECHECK_TTL);

    if (cachedIsFresh) {
      boardList = sortBoards(cached.boards);
      boardLibraryCheckedAt = cloudCheckedAt;
      boardListLoadedFromNetwork = false;
      activeBoardId = boardList.some(board => board.id === cached.activeBoardId)
        ? cached.activeBoardId
        : (boardList.some(board => board.id === localStorage.getItem(activeBoardStorageKey(user.uid)))
          ? localStorage.getItem(activeBoardStorageKey(user.uid))
          : boardList[0].id);

      const local = await readLocalBoardSnapshot(user.uid, activeBoardId);
      if (local?.snapshot) {
        const active = boardList.find(board => board.id === activeBoardId);
        if (active) {
          active.cloudCheckedAt = cloudCheckedAt;
          active.localDirty = Boolean(local.dirty);
          if (local.dirty) {
            active.revision = Math.max(0, Number(local.revision) || 0);
            active.cloudContentHash = local.cloudContentHash || "";
          }
          updateBoardMemoryFromSnapshot(active, cleanBoardSnapshot(local.snapshot));
        }
        boardApi().setActiveBoardId(activeBoardId);
        boardApi().load(cleanBoardSnapshot(local.snapshot));
        boardLocalHashes.set(activeBoardId, localHashForSnapshot(local.snapshot));
        if (local.dirty) scheduleCloudBoardSave(CLOUD_SAVE_DELAY, activeBoardId);
        setBoardStatus("");
        requestAnimationFrame(() => {
          window.dispatchEvent(new CustomEvent("teachertiles:boardloaded", { detail: { boardId: activeBoardId } }));
        });
        if (Date.now() - cloudCheckedAt >= ACTIVE_BOARD_CLOUD_RECHECK_TTL) {
          window.setTimeout(() => { void refreshActiveBoardFromCloud(); }, 0);
        }
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
    const cached = restoreBoardListMetadata(user.uid);
    const desired = localStorage.getItem(activeBoardStorageKey(user.uid)) || cached?.activeBoardId;
    const local = desired ? await readLocalBoardSnapshot(user.uid, desired) : null;
    if (currentUser?.uid === user.uid && local?.snapshot && cached?.boards.some(board => board.id === desired)) {
      boardList = cached.boards;
      activeBoardId = desired;
      const board = boardList.find(item => item.id === desired);
      board.revision = Number(local.revision) || 0;
      board.cloudContentHash = local.cloudContentHash || "";
      boardApi().setActiveBoardId(desired);
      boardApi().load(cleanBoardSnapshot(local.snapshot));
      if (local.dirty) scheduleCloudBoardSave(15000, desired);
      setBoardStatus("Opened local copy — cloud sync unavailable", true);
    } else setBoardStatus("Cloud save unavailable", true);
  } finally {
    boardLoading = false;
  }
}

async function renderUser(user) {
  const isInitialAuthResolution = !authReady;
  const previousUser = currentUser;
  if(currentUser?.uid!==user?.uid){lockedCosmeticBoard=null;shopAccessCheckedAt=0;shopAccessRequest=null;Object.assign(shopAccountState,{ready:false,ownedProductIds:[],subscriptionActive:false});document.getElementById('workspace').inert=false;document.querySelectorAll('.board-access-dialog').forEach(d=>d.close());}
  currentUser = user || null;if(!user)window.TeacherTilesTheme?.hideBoard();
  window.dispatchEvent(new CustomEvent("teachertiles:authchange", { detail: { userId: currentUser?.uid || "" } }));
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
  nicknameUi.load(user);
  supportUi.reset();ticketInbox?.reset();if(user)void ticketInbox?.refresh();
  authReady = true;
  loadingState.hidden = true;
  signedInState.hidden = !user;
  signedOutState.hidden = Boolean(user);
  if (profileCoinCard) profileCoinCard.hidden = !user;
  signInButton.disabled = false;
  setStatus();

  if (saveWarning) saveWarning.hidden = Boolean(user);

  if (user) {
    const name = user.displayName?.trim() || "Teacher";
    const photo = user.photoURL || fallbackAvatarData(name);
    shopAccountState.patchAwards={};
    syncAwardedPatches(user,{});
    syncProfileBadgeCount();
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

    ensureShopAccess().catch(error => {
      console.error("TeacherTiles could not load the shop account", error);
      setStatus("Your profile loaded, but the shop balance is temporarily unavailable.", true);
    });

    if (!previousUser || previousUser.uid !== user.uid) {
      activeBoardId = "";
      boardList = [];
      boardLocalHashes.clear();
      localBoardMemory.clear();
      boardListLoadedFromNetwork = false;
      boardLibraryCheckedAt = 0;
      await initializeBoardsForUser(user);
    }
  } else {
    publishShopAccount({ ready: true, loading: false, signedIn: false, coinBalance: 0, ownedProductIds: [], subscriptionActive: false });
    clearTimeout(localBoardSaveTimer);
    clearAllCloudBoardSaveTimers();
    activeBoardId = "";
    boardList = [];
    boardLocalHashes.clear();
    localBoardMemory.clear();
    boardListLoadedFromNetwork = false;
    boardLibraryCheckedAt = 0;
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
    // Persistence is configured during initialization. Open the popup directly
    // from the click so a second IndexedDB wait cannot consume user activation.
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
    await window.TeacherTilesLessonPlanner?.flushCloud?.();
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

let accountAuthGeneration = 0;
let renderedAccountUid;
function syncStaffPatch(allowed) {
  const badge = document.getElementById('profile-teachertiles-badge');
  if (!badge) return;
  badge.classList.toggle('profile-badge--locked', !allowed);

  badge.setAttribute('aria-label', allowed ? 'TeacherTiles patch. TeacherTiles Employee.' : 'TeacherTiles patch. Locked. TeacherTiles Employee.');
  badge.querySelector('.profile-badge__check').hidden = !allowed;
  document.getElementById('teachertiles-patch-requirement').textContent = 'Unlock: TeacherTiles Employee';
  syncProfileBadgeCount();
}

async function handleAccountAuthChange(user) {
  if(currentUser?.uid!==user?.uid)communityTemplates?.reset();
  const generation=++accountAuthGeneration;
  const checks=[];
  window.dispatchEvent(new CustomEvent('teachertiles:beforeaccountload',{detail:{user,waitUntil:promise=>checks.push(promise)}}));
  try { await Promise.all(checks); } catch { return; }
  if(generation!==accountAuthGeneration||auth.currentUser?.uid!==user?.uid)return;
  const claims=user?(await authSdk.getIdTokenResult(user)).claims:{};
  if(generation!==accountAuthGeneration||auth.currentUser?.uid!==user?.uid)return;
  syncStaffPatch(['owner','admin'].includes(claims.portalRole));
  const uid=user?.uid||'';
  if(renderedAccountUid!==uid){renderedAccountUid=uid;await renderUser(user);}
}

async function initializeFirebaseAuth() {
  signInButton.disabled = true;

  try {
    const [appModule, authModule, firestoreModule, functionsModule] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js"),
      import("https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js")
    ]);

    authSdk = authModule;
    firestoreSdk = window.TeacherTilesReadDiagnostics?.wrap(firestoreModule) || firestoreModule;
    functionsSdk = functionsModule;

    const firebaseApp = appModule.initializeApp(firebaseConfig);
    auth = authModule.getAuth(firebaseApp);
    db = firestoreModule.getFirestore(firebaseApp);
    cloudFunctions = functionsModule.getFunctions(firebaseApp, SHOP_FUNCTION_REGION);

    try {
      await authModule.setPersistence(auth, authModule.browserLocalPersistence);
    } catch (error) {
      console.warn("TeacherTiles could not set local Firebase auth persistence", error);
    }

    window.TeacherTilesAuth=Object.freeze({
      get user(){return auth.currentUser},
      signIn:handleSignIn,signOut:handleSignOut,
      refresh:()=>handleAccountAuthChange(auth.currentUser),
      call:(name,data={})=>functionsSdk.httpsCallable(cloudFunctions,name,{timeout:15000})(data)
    });
    window.dispatchEvent(new Event('teachertiles:authready'));
    startSiteActivity(()=>auth.currentUser,(name,data)=>window.TeacherTilesAuth.call(name,data));
    authModule.onIdTokenChanged(auth, user => {
      handleAccountAuthChange(user).catch(error => {
        console.error("TeacherTiles account initialization failed", error);
        setStatus("Your account signed in, but cloud boards could not be initialized.", true);
      });
    }, error => {
      window.dispatchEvent(new CustomEvent("teachertiles:autherror"));
      console.error("TeacherTiles auth state error", error);
      authReady = true;
      loadingState.hidden = true;
      signedOutState.hidden = false;
      signedInState.hidden = true;
      if (profileCoinCard) profileCoinCard.hidden = true;
      signInButton.disabled = false;
      if (saveWarning) saveWarning.hidden = false;
      setStatus("We couldn't check your sign-in status. Refresh and try again.", true);
      openProfile();
    });
  } catch (error) {
    window.dispatchEvent(new CustomEvent("teachertiles:autherror"));
    console.error("TeacherTiles Firebase SDK failed to load", error);
    authReady = true;
    loadingState.hidden = true;
    signedOutState.hidden = false;
    signedInState.hidden = true;
    if (profileCoinCard) profileCoinCard.hidden = true;
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
  void ticketInbox?.refresh();
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
  saveWarning.setAttribute("aria-label", "Sign-in to save your board and more");
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
boardsLibraryTab?.addEventListener("click", () => setBoardsMenu("boards"));
boardTemplatesTab?.addEventListener("click", () => setBoardsMenu("templates"));

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

function backupCurrentBoard() {
  if (currentUser && activeBoardId && !boardLoading) {
    const api = boardApi();
    if (api) {
      try {
        const board = boardList.find(item => item.id === activeBoardId);
        sessionStorage.setItem(
          `teachertiles-last-local-board-${currentUser.uid}`,
          JSON.stringify({ boardId: activeBoardId, snapshot: lockedCosmeticBoard?.snapshot||api.capture(), savedAt: Date.now(),
            revision: board?.revision || 0, cloudContentHash: board?.cloudContentHash || "" })
        );
      } catch {}
    }
  }
}

async function restoreEmergencyBoardSnapshot(uid) {
  const key = `teachertiles-last-local-board-${uid}`;
  for (const storage of [sessionStorage, localStorage]) {
    let backup;
    try { backup = JSON.parse(storage.getItem(key) || "null"); } catch { continue; }
    if (!backup?.boardId || !backup.snapshot) continue;
    const local = await readLocalBoardSnapshot(uid, backup.boardId);
    if (!local || backup.savedAt > local.savedAt) {
      const snapshot = cleanBoardSnapshot(backup.snapshot);
      const contentHash = contentHashForSnapshot(snapshot);
      const cloudContentHash = backup.cloudContentHash ?? local?.cloudContentHash ?? "";
      await writeLocalBoardSnapshot(uid, backup.boardId, { snapshot, contentHash, cloudContentHash,
        revision: backup.revision ?? local?.revision ?? 0, dirty: contentHash !== cloudContentHash });
    }
    try { storage.removeItem(key); } catch {}
  }
}

let boardRefreshPromise = null;
function refreshActiveBoardFromCloud({ force = false } = {}) {
  if (boardRefreshPromise || !currentUser || !activeBoardId || boardLoading) return boardRefreshPromise;
  const uid = currentUser.uid;
  const id = activeBoardId;
  const known = boardList.find(board => board.id === id);
  if (!force && boardMetadataRecentlyChecked(known, ACTIVE_BOARD_CLOUD_RECHECK_TTL)) return Promise.resolve();
  boardRefreshPromise = (async () => {
    const local = await readLocalBoardSnapshot(uid, id);
    if (!local || local.dirty || currentUser?.uid !== uid || activeBoardId !== id || boardLoading) return;
    const before = contentHashForSnapshot(boardApi().capture());
    const remote = await firestoreSdk.getDocFromServer(boardDocument(uid, id));
    if (!remote.exists()) return;
    const meta = markBoardMetadataChecked(normalizeBoardMetadata(remote));
    if (currentUser?.uid !== uid || activeBoardId !== id || boardLoading) return;
    boardList = boardList.map(board => board.id === id ? meta : board);
    cacheBoardListMetadata();
    if (meta.cloudContentHash === local.contentHash) return;
    const cloud = await readCloudBoardSnapshot(meta);
    if (currentUser?.uid !== uid || activeBoardId !== id || boardLoading ||
        contentHashForSnapshot(boardApi().capture()) !== before ||
        localBoardMemory.get(localBoardKey(uid, id))?.dirty) return;
    boardLoading = true;
    try {
      boardApi().load(cloud.snapshot);
      await cacheSnapshotLocally(id, cloud.snapshot, { dirty: false });
    } finally { boardLoading = false; }
  })().catch(error => console.warn("TeacherTiles could not refresh the active board", error))
    .finally(() => { boardRefreshPromise = null; });
  return boardRefreshPromise;
}

window.addEventListener("beforeunload", backupCurrentBoard);
window.addEventListener("pagehide", backupCurrentBoard);
window.addEventListener("focus", () => { void refreshActiveBoardFromCloud(); });
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    backupCurrentBoard();
    void saveCurrentBoard({ immediate: true });
  } else void refreshActiveBoardFromCloud();
});
window.addEventListener("online", () => {
  for (const board of boardList) scheduleCloudBoardSave(0, board.id);
});

window.TeacherTilesAuth = {
  get auth() { return auth; },
  get user() { return currentUser; },
  get ready() { return authReady; },
  openProfile
};

window.TeacherTilesLessonPlannerCloud = Object.freeze({
  load: loadLessonPlannerCloud,
  save: saveLessonPlannerCloud
});

window.TeacherTilesEncryptedClasses = {
  save: saveEncryptedClasses,
  load: loadEncryptedClasses,
  retrySync: () => requestAutomaticClassKey({ force: true }),
  get syncEnabled() { return classSyncMode === "ready"; },
  get unlocked() { return Boolean(currentUser && hasActiveClassEncryptionKey(currentUser.uid)); },
  get protection() { return classKeyProtection || (classSyncMode === "ready" ? "FIRESTORE_PRIVATE_VAULT" : ""); }
};

window.TeacherTilesAccount = {
  get state() {
    return {
      userId: currentUser?.uid || "",
      ready: shopAccountState.ready,
      loading: shopAccountState.loading,
      signedIn: shopAccountState.signedIn,
      coinBalance: shopAccountState.coinBalance,
      ownedProductIds: [...shopAccountState.ownedProductIds],
      subscriptionActive: Boolean(shopAccountState.subscriptionActive)
    };
  },
  owns(productId) {
    return shopAccountState.ownedProductIds.includes(String(productId || ""));
  },
  refresh: refreshShopAccount,
  async createCoinCheckout(packId) {
    const returnUrl = new URL(window.location.href);
    returnUrl.hash = "";
    returnUrl.searchParams.delete("tt_checkout");
    const result = await callShopFunction("createCoinCheckoutSession", { packId, returnUrl: returnUrl.href });
    if (!result.url) throw new Error("Stripe Checkout did not return a payment page.");
    return result;
  },
  async createSubscriptionCheckout(priceId) {
    const returnUrl = new URL(window.location.href);
    returnUrl.hash = "";
    returnUrl.searchParams.delete("tt_checkout");
    const result = await callShopFunction("createSubscriptionCheckoutSession", { priceId, returnUrl: returnUrl.href });
    if (!result.url) throw new Error("Stripe Checkout did not return a payment page.");
    return result;
  },
  async purchase(productId) {
    return applyReturnedShopAccount(await callShopFunction("purchaseCosmetic", { productId }));
  },
  async redeem(code) {
    return applyReturnedShopAccount(await callShopFunction("redeemCoinCode", { code }));
  },
  async generateCode(packId) {
    return callShopFunction("generateCoinCode", { packId });
  }
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

const profileCall=async(name,data)=>{if(!currentUser)throw new Error('Sign in to use Support.');if(!functionsSdk||!cloudFunctions)throw new Error('The reporting service is still loading. Please try again.');return (await functionsSdk.httpsCallable(cloudFunctions,name)(data)).data;};
const nicknameUi=setupNickname(profileCall);
const supportUi=setupBugReports(profileCall);
ticketInbox=createTicketNotifications(profileCall,()=>currentUser?.uid,renderNotificationInbox);
