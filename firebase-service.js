import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import {
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
let enabled = false;
let app = null;
let auth = null;
let db = null;
let initPromise = null;

export function isFirebaseEnabled() {
  return enabled;
}

export function isSecureAuthContext() {
  if (typeof window === "undefined") {
    return true;
  }

  return window.isSecureContext || window.location.hostname === "localhost";
}

export function watchAuthState(callback) {
  if (!enabled) {
    callback(null);
    return () => {};
  }

  return onAuthStateChanged(auth, callback);
}

export async function createAccountWithEmail(email, password) {
  await ensureFirebaseReady();

  if (!enabled) {
    throw new Error("Firebase is not configured yet.");
  }

  const result = await createUserWithEmailAndPassword(auth, email, password);
  await ensureUserProfile(result.user);
  return result.user;
}

export async function signInWithEmail(email, password) {
  await ensureFirebaseReady();

  if (!enabled) {
    throw new Error("Firebase is not configured yet.");
  }

  const result = await signInWithEmailAndPassword(auth, email, password);
  await ensureUserProfile(result.user);
  return result.user;
}

export function getAuthErrorMessage(error) {
  const code = error?.code ?? "";

  if (code === "auth/configuration-not-found") {
    return "Firebase sign-in is not fully configured. Enable Authentication > Sign-in method > Email/Password and add your site domain in Authentication > Settings > Authorized domains.";
  }

  if (code === "auth/operation-not-allowed") {
    return "Email/password sign-in is turned off in Firebase. In the Firebase console open Authentication > Sign-in method and enable Email/Password.";
  }

  if (code === "auth/email-already-in-use") {
    return "That email already has an account. Use Sign In instead.";
  }

  if (code === "auth/invalid-credential" || code === "auth/user-not-found" || code === "auth/wrong-password") {
    return "Email or password is incorrect.";
  }

  if (code === "auth/unauthorized-domain") {
    return "This domain is not authorized in Firebase yet. Add your live site domain under Authentication > Settings > Authorized domains.";
  }

  if (code === "auth/invalid-email") {
    return "Enter a valid email address.";
  }

  if (code === "auth/weak-password") {
    return "Password should be at least 6 characters.";
  }

  if (code === "auth/network-request-failed") {
    return "Network error while contacting Firebase. Check your internet connection and try again.";
  }

  return error?.message ?? "Something went wrong while talking to Firebase.";
}

export async function logoutCurrentUser() {
  await ensureFirebaseReady();

  if (!enabled) {
    return;
  }

  await signOut(auth);
}

export async function loadUserProfile(uid) {
  await ensureFirebaseReady();

  if (!enabled) {
    return null;
  }

  try {
    const snapshot = await getDoc(doc(db, "scores", uid));
    return snapshot.exists() ? snapshot.data() : null;
  } catch {
    return null;
  }
}

export async function saveHighScore(user, score) {
  await ensureFirebaseReady();

  if (!enabled || !user) {
    return null;
  }

  try {
    const ref = doc(db, "scores", user.uid);
    const snapshot = await getDoc(ref);
    const currentHigh = snapshot.exists() ? snapshot.data().highestScore ?? 0 : 0;

    if (score <= currentHigh) {
      return currentHigh;
    }

    await setDoc(
      ref,
      {
        uid: user.uid,
        email: user.email ?? "",
        highestScore: score,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    return score;
  } catch {
    return null;
  }
}

async function ensureUserProfile(user) {
  if (!enabled || !user) {
    return;
  }

  try {
    const ref = doc(db, "scores", user.uid);
    const snapshot = await getDoc(ref);

    if (snapshot.exists()) {
      return;
    }

    await setDoc(
      ref,
      {
        uid: user.uid,
        email: user.email ?? "",
        highestScore: 0,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch {
    // Auth already succeeded; Firestore rules or network must not block sign-in.
  }
}

export async function initializeFirebase() {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const config = await loadFirebaseConfig();

    if (!hasFirebaseConfig(config)) {
      enabled = false;
      return false;
    }

    app = initializeApp(config);
    auth = getAuth(app);
    try {
      await setPersistence(auth, browserLocalPersistence);
    } catch {
      // Use default persistence if explicit local persistence is unavailable.
    }
    db = getFirestore(app);
    enabled = true;
    return true;
  })();

  return initPromise;
}

async function ensureFirebaseReady() {
  await initializeFirebase();
}

async function loadFirebaseConfig() {
  const staticRuntimeConfig = await fetchStaticRuntimeConfig();
  if (hasFirebaseConfig(staticRuntimeConfig)) {
    return staticRuntimeConfig;
  }

  const runtimeConfig = await fetchRuntimeConfig();
  if (hasFirebaseConfig(runtimeConfig)) {
    return runtimeConfig;
  }

  const localConfig = await fetchLocalConfig();
  if (hasFirebaseConfig(localConfig)) {
    return localConfig;
  }

  return null;
}

async function fetchStaticRuntimeConfig() {
  try {
    const response = await fetch("./firebase-config.runtime.json", { cache: "no-store" });
    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch {
    return null;
  }
}

async function fetchRuntimeConfig() {
  try {
    const response = await fetch("/api/firebase-config", { cache: "no-store" });
    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch {
    return null;
  }
}

async function fetchLocalConfig() {
  try {
    const response = await fetch("./firebase-config.local.json", { cache: "no-store" });
    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch {
    return null;
  }
}

function hasFirebaseConfig(config) {
  if (!config) {
    return false;
  }

  return Object.values(config).every(
    (value) => typeof value === "string" && value && !value.startsWith("REPLACE_WITH_"),
  );
}
