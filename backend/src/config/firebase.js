import admin from "firebase-admin";
import { env } from "./env.js";
import { ApiError } from "../utils/ApiError.js";

let firebaseApp;

const normalizePrivateKey = (value) => {
  return value
    .trim()
    .replace(/^"|"$/g, "")
    .replace(/^'|'$/g, "")
    .replace(/\\n/g, "\n")
    .replace(/\r/g, "");
};

const hasAdminCredentials = () => {
  return Boolean(env.FIREBASE_CLIENT_EMAIL?.trim() && env.FIREBASE_PRIVATE_KEY?.trim());
};

export const getFirebaseAdminApp = () => {
  if (!hasAdminCredentials()) {
    return null;
  }

  if (firebaseApp) {
    return firebaseApp;
  }

  const privateKey = normalizePrivateKey(env.FIREBASE_PRIVATE_KEY || "");

  try {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey
      })
    });
  } catch {
    firebaseApp = null;
  }

  return firebaseApp;
};

export const firebaseAuth = () => {
  const app = getFirebaseAdminApp();
  if (!app) {
    return null;
  }
  return app.auth();
};

const verifyIdTokenWithRest = async (idToken) => {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ idToken })
  });

  const payload = await response.json();

  if (!response.ok || !payload?.users?.length) {
    throw new ApiError(401, "Invalid Firebase ID token");
  }

  const user = payload.users[0];

  return {
    uid: user.localId,
    email: user.email || null,
    name: user.displayName || null,
    picture: user.photoUrl || null,
    provider: "firebase-rest"
  };
};

export const verifyFirebaseIdToken = async (idToken) => {
  const auth = firebaseAuth();

  if (auth) {
    return auth.verifyIdToken(idToken, true);
  }

  return verifyIdTokenWithRest(idToken);
};
