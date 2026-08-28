const firebaseConfig = {
  apiKey: "AIzaSyBa1AkZfYLemz4gDAI505704wsG1CC_sSQ",
  authDomain: "teachertiles-6739b.firebaseapp.com",
  projectId: "teachertiles-6739b",
  storageBucket: "teachertiles-6739b.firebasestorage.app",
  messagingSenderId: "41204185343",
  appId: "1:41204185343:web:99bcbdcb359f8a5326f4ca",
  measurementId: "G-0BD062KY34"
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
const gatedFeatureIds = new Set(["theme-shelf-toggle", "sticker-shelf-toggle", "shop-toggle"]);

let auth = null;
let authSdk = null;
let currentUser = null;
let authReady = false;
let busy = false;
let lastFocused = null;

function setStatus(message = "", isError = false) {
  status.textContent = message;
  status.classList.toggle("is-error", isError);
}

function fallbackAvatarData(name = "Teacher") {
  const letter = (name.trim()[0] || "T").toUpperCase();
  const safeLetter = letter.replace(/[<&>"']/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="36" fill="#eef1f4"/><text x="80" y="101" text-anchor="middle" font-family="Arial,sans-serif" font-size="76" font-weight="700" fill="#30343b">${safeLetter}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function renderUser(user) {
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
  } else {
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
}

function closeOtherSurfaces() {
  const shelf = document.getElementById("asset-shelf");
  if (shelf?.classList.contains("is-open")) document.getElementById("asset-shelf-close")?.click();
  const shop = document.getElementById("shop-modal");
  if (shop && !shop.hidden) document.getElementById("shop-close")?.click();
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
  setStatus("Signing out…");
  try {
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
    const [appModule, authModule] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js")
    ]);

    authSdk = authModule;
    const firebaseApp = appModule.initializeApp(firebaseConfig);
    auth = authModule.getAuth(firebaseApp);

    try {
      await authModule.setPersistence(auth, authModule.browserLocalPersistence);
    } catch (error) {
      console.warn("TeacherTiles could not set local Firebase auth persistence", error);
    }

    authModule.onAuthStateChanged(auth, renderUser, (error) => {
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


document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target.closest("#theme-shelf-toggle, #sticker-shelf-toggle, #shop-toggle") : null;
  if (!target || !gatedFeatureIds.has(target.id) || currentUser) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  openProfile();
}, true);

toggle.addEventListener("click", () => modal.hidden ? openProfile() : closeProfile());
modal.querySelectorAll("[data-profile-close]").forEach((button) => button.addEventListener("click", closeProfile));
signInButton.addEventListener("click", handleSignIn);
signOutButton.addEventListener("click", handleSignOut);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.hidden) {
    event.preventDefault();
    closeProfile();
  }
});

["theme-shelf-toggle", "sticker-shelf-toggle", "shop-toggle"].forEach((id) => {
  document.getElementById(id)?.addEventListener("click", () => {
    if (!modal.hidden) closeProfile();
  });
});

window.TeacherTilesAuth = {
  get auth() { return auth; },
  get user() { return currentUser; },
  get ready() { return authReady; },
  openProfile
};

initializeFirebaseAuth();
