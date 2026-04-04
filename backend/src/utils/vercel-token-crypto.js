import crypto from "crypto";
import { env } from "../config/env.js";
import { ApiError } from "./ApiError.js";

const KEY_LENGTH = 32;
const IV_LENGTH = 12;

const getKey = () => {
  const rawKey = env.TOKEN_ENCRYPTION_KEY || "";
  const hash = crypto.createHash("sha256").update(rawKey).digest();

  if (hash.length !== KEY_LENGTH) {
    throw new ApiError(500, "Invalid token encryption key configuration");
  }

  return hash;
};

export const encryptToken = (token) => {
  if (!token) {
    return {
      encryptedAccessToken: "",
      tokenIv: "",
      tokenAuthTag: ""
    };
  }

  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedAccessToken: encrypted.toString("base64"),
    tokenIv: iv.toString("base64"),
    tokenAuthTag: authTag.toString("base64")
  };
};

export const decryptToken = ({ encryptedAccessToken, tokenIv, tokenAuthTag }) => {
  if (!encryptedAccessToken || !tokenIv || !tokenAuthTag) {
    return "";
  }

  try {
    const key = getKey();
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(tokenIv, "base64")
    );

    decipher.setAuthTag(Buffer.from(tokenAuthTag, "base64"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedAccessToken, "base64")),
      decipher.final()
    ]);

    return decrypted.toString("utf8");
  } catch {
    throw new ApiError(500, "Failed to decrypt Vercel token");
  }
};
