import path from "path";
import { randomUUID } from "crypto";
import { env } from "../config/env.js";
import { getFirebaseStorageBucket } from "../config/firebase.js";

const normalizeStorageSegment = (value) =>
  String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "anonymous";

const sanitizeFileName = (value) =>
  String(value || "resume")
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "") || "resume";

const buildInlineContentDisposition = (fileName) => {
  const safeFileName = sanitizeFileName(fileName);
  const encodedFileName = encodeURIComponent(safeFileName);

  return `inline; filename="${safeFileName}"; filename*=UTF-8''${encodedFileName}`;
};

const parseFirebaseStorageUri = (value) => {
  const match = String(value || "").trim().match(/^gs:\/\/([^/]+)\/(.+)$/i);

  if (!match) {
    return {
      bucketName: "",
      storagePath: ""
    };
  }

  return {
    bucketName: match[1],
    storagePath: match[2]
  };
};

export const buildFirebaseStorageUri = (bucketName, storagePath) => {
  const normalizedBucketName = String(bucketName || "").trim();
  const normalizedStoragePath = String(storagePath || "").trim();

  if (!normalizedBucketName || !normalizedStoragePath) {
    return "";
  }

  return `gs://${normalizedBucketName}/${normalizedStoragePath}`;
};

export const resolveFirebaseResumeStorageLocation = (resume = {}) => {
  const explicitStoragePath = String(resume.firebaseStoragePath || "").trim();

  if (explicitStoragePath) {
    return {
      bucketName: String(resume.firebaseStorageBucket || env.FIREBASE_STORAGE_BUCKET).trim(),
      storagePath: explicitStoragePath
    };
  }

  return parseFirebaseStorageUri(resume.filePath);
};

const buildResumeStoragePath = ({ ownerKey, originalFileName }) => {
  const safeOwnerKey = normalizeStorageSegment(ownerKey);
  const safeFileName = sanitizeFileName(originalFileName);

  return path.posix.join(
    env.FIREBASE_RESUME_FOLDER,
    safeOwnerKey,
    `${Date.now()}-${randomUUID()}-${safeFileName}`
  );
};

export const uploadResumeToFirebaseStorage = async ({ buffer, originalFileName, mimeType, ownerKey }) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("Resume file buffer is required for Firebase Storage upload");
  }

  const bucket = getFirebaseStorageBucket();
  const storagePath = buildResumeStoragePath({
    ownerKey,
    originalFileName
  });
  const file = bucket.file(storagePath);

  await file.save(buffer, {
    resumable: false,
    validation: false,
    metadata: {
      contentType: mimeType || "application/octet-stream",
      cacheControl: "private, max-age=0, no-transform",
      contentDisposition: buildInlineContentDisposition(originalFileName),
      metadata: {
        originalFileName: String(originalFileName || "resume")
      }
    }
  });

  return {
    bucketName: bucket.name,
    storagePath,
    fileName: path.posix.basename(storagePath),
    contentType: mimeType || "application/octet-stream",
    size: buffer.length,
    filePath: buildFirebaseStorageUri(bucket.name, storagePath)
  };
};

export const downloadResumeFromFirebaseStorage = async ({ bucketName, storagePath }) => {
  if (!storagePath) {
    throw new Error("Firebase Storage path is required");
  }

  const bucket = getFirebaseStorageBucket(bucketName || env.FIREBASE_STORAGE_BUCKET);
  const file = bucket.file(storagePath);
  const [metadataResult, bufferResult] = await Promise.all([file.getMetadata(), file.download()]);
  const metadata = metadataResult?.[0] || {};
  const buffer = bufferResult?.[0] || Buffer.alloc(0);

  return {
    buffer,
    contentType: metadata.contentType || "",
    contentLength: metadata.size || String(buffer.length),
    metadata
  };
};

export const getFirebaseResumeSignedReadUrl = async ({
  bucketName,
  storagePath,
  originalFileName,
  mimeType,
  expiresInMinutes = env.FIREBASE_SIGNED_URL_TTL_MINUTES
}) => {
  if (!storagePath) {
    throw new Error("Firebase Storage path is required");
  }

  const bucket = getFirebaseStorageBucket(bucketName || env.FIREBASE_STORAGE_BUCKET);
  const file = bucket.file(storagePath);
  const expiresAt = Date.now() + Number(expiresInMinutes || env.FIREBASE_SIGNED_URL_TTL_MINUTES) * 60 * 1000;
  const [signedUrl] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: expiresAt,
    responseDisposition: buildInlineContentDisposition(originalFileName || path.posix.basename(storagePath)),
    responseType: mimeType || "application/octet-stream"
  });

  return {
    url: signedUrl,
    expiresAt
  };
};

export const deleteResumeFromFirebaseStorage = async ({ bucketName, storagePath }) => {
  if (!storagePath) {
    return;
  }

  try {
    const bucket = getFirebaseStorageBucket(bucketName || env.FIREBASE_STORAGE_BUCKET);
    await bucket.file(storagePath).delete();
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 404) {
      return;
    }

    throw error;
  }
};
