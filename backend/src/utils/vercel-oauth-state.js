import crypto from "crypto";
import { env } from "../config/env.js";
import { ApiError } from "./ApiError.js";

const getStateSecret = () => {
  const secret = env.VERCEL_OAUTH_STATE_SECRET || env.TOKEN_ENCRYPTION_KEY;

  if (!secret) {
    throw new ApiError(500, "Missing Vercel OAuth state secret");
  }

  return secret;
};

const sign = (payload) =>
  crypto.createHmac("sha256", getStateSecret()).update(payload).digest("base64url");

export const createOAuthState = (stateData) => {
  const payload = Buffer.from(JSON.stringify(stateData), "utf8").toString("base64url");
  const signature = sign(payload);
  return `${payload}.${signature}`;
};

export const verifyOAuthState = (state) => {
  if (!state || typeof state !== "string" || !state.includes(".")) {
    throw new ApiError(400, "Invalid OAuth state");
  }

  const [payload, signature] = state.split(".");
  const expectedSignature = sign(payload);

  if (signature !== expectedSignature) {
    throw new ApiError(400, "OAuth state verification failed");
  }

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new ApiError(400, "OAuth state payload is malformed");
  }
};
