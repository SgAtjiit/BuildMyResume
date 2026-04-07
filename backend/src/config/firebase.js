import admin from "firebase-admin";
import { env } from "./env.js";
import { ApiError } from "../utils/ApiError.js";

let firebaseApp;
let firebaseAppInitError = "";

const normalizePrivateKey = (value) => {
  return value
    .trim()
    .replace(/^"|"$/g, "")
    .replace(/^'|'$/g, "")
    .replace(/\\n/g, "\n")
    .replace(/\r/g, "");
};

const parseServiceAccountJson = () => {
  const rawJson = String(env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();

  if (!rawJson) {
    return null;
  }

  try {
    let normalizedJson = rawJson;

    if (
      (normalizedJson.startsWith('"') && normalizedJson.endsWith('"')) ||
      (normalizedJson.startsWith("'") && normalizedJson.endsWith("'"))
    ) {
      const unwrappedJson = normalizedJson.slice(1, -1).trim();

      if (unwrappedJson.startsWith("{") && unwrappedJson.endsWith("}")) {
        normalizedJson = unwrappedJson;
      }
    }

    const parsed = JSON.parse(normalizedJson);

    return {
      projectId: parsed.project_id || parsed.projectId || env.FIREBASE_PROJECT_ID,
      clientEmail: parsed.client_email || parsed.clientEmail || env.FIREBASE_CLIENT_EMAIL,
      privateKey: normalizePrivateKey(parsed.private_key || parsed.privateKey || env.FIREBASE_PRIVATE_KEY || "")
    };
  } catch (error) {
    firebaseAppInitError = `Invalid FIREBASE_SERVICE_ACCOUNT_JSON: ${
      error instanceof Error ? error.message : String(error)
    }`;
    return null;
  }
};

const getAdminCredentialParts = () => {
  const serviceAccountFromJson = parseServiceAccountJson();

  if (serviceAccountFromJson?.clientEmail && serviceAccountFromJson?.privateKey) {
    return serviceAccountFromJson;
  }

  if (env.FIREBASE_CLIENT_EMAIL?.trim() && env.FIREBASE_PRIVATE_KEY?.trim()) {
    return {
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: normalizePrivateKey(env.FIREBASE_PRIVATE_KEY || "")
    };
  }

  return null;
};

const hasAdminCredentials = () => Boolean(getAdminCredentialParts());

const getFirebaseAdminSetupErrorMessage = () => {
  if (firebaseAppInitError) {
    return firebaseAppInitError;
  }

  return (
    "Firebase Admin SDK is not configured. " +
    "Set FIREBASE_SERVICE_ACCOUNT_JSON or both FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY, plus FIREBASE_STORAGE_BUCKET."
  );
};

export const getFirebaseAdminApp = () => {
  if (!hasAdminCredentials()) {
    firebaseAppInitError = getFirebaseAdminSetupErrorMessage();
    return null;
  }

  if (firebaseApp) {
    return firebaseApp;
  }

  const credentialParts = getAdminCredentialParts();

  if (!credentialParts) {
    firebaseAppInitError = getFirebaseAdminSetupErrorMessage();
    return null;
  }

  try {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: credentialParts.projectId,
        clientEmail: credentialParts.clientEmail,
        privateKey: credentialParts.privateKey
      }),
      storageBucket: env.FIREBASE_STORAGE_BUCKET
    });
    firebaseAppInitError = "";
  } catch (error) {
    firebaseAppInitError = error instanceof Error ? error.message : String(error);
    console.error("[firebase-admin] initialization failed", {
      message: firebaseAppInitError
    });
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

export const getFirebaseStorageBucket = (bucketName = env.FIREBASE_STORAGE_BUCKET) => {
  const app = getFirebaseAdminApp();

  if (!app) {
    throw new ApiError(500, `Firebase Admin SDK is not configured for storage access. ${getFirebaseAdminSetupErrorMessage()}`);
  }

  return app.storage().bucket(bucketName);
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
