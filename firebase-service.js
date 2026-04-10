import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
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
import { firebaseConfig } from "./firebase-config.js";

function hasFirebaseConfig(config) {
  return Object.values(config).every(
    (value) => typeof value === "string" && value && !value.startsWith("REPLACE_WITH_"),
  );
}

const enabled = hasFirebaseConfig(firebaseConfig);
const app = enabled ? initializeApp(firebaseConfig) : null;
const auth = enabled ? getAuth(app) : null;
const db = enabled ? getFirestore(app) : null;

export function isFirebaseEnabled() {
  return enabled;
}

export function watchAuthState(callback) {
  if (!enabled) {
    callback(null);
    return () => {};
  }

  return onAuthStateChanged(auth, callback);
}

export async function registerWithEmail(email, password) {
  if (!enabled) {
    throw new Error("Firebase is not configured yet.");
  }

  const result = await createUserWithEmailAndPassword(auth, email, password);
  await ensureUserProfile(result.user);
  return result.user;
}

export async function loginWithEmail(email, password) {
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
    return "Firebase Email/Password sign-in is not fully configured. Enable Authentication > Sign-in method > Email/Password and add your site domain in Authentication > Settings > Authorized domains.";
  }

  if (code === "auth/invalid-credential") {
    return "Invalid email or password.";
  }

  if (code === "auth/invalid-email") {
    return "Enter a valid email address.";
  }

  if (code === "auth/email-already-in-use") {
    return "This email is already registered. Try signing in instead.";
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
  if (!enabled) {
    return;
  }

  await signOut(auth);
}

export async function loadUserProfile(uid) {
  if (!enabled) {
    return null;
  }

  const snapshot = await getDoc(doc(db, "scores", uid));
  return snapshot.exists() ? snapshot.data() : null;
}

export async function saveHighScore(user, score) {
  if (!enabled || !user) {
    return null;
  }

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
}

async function ensureUserProfile(user) {
  if (!enabled || !user) {
    return;
  }

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
}
