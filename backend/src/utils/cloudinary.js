import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env.js";

const hasCloudinaryConfig = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
);

if (hasCloudinaryConfig) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET
  });
}

export const isCloudinaryEnabled = () => hasCloudinaryConfig;

const isPdfFile = (value) => /\.pdf$/i.test(String(value || ""));
const isDocumentFile = (value) => /\.(pdf|docx?|txt|tex)$/i.test(String(value || ""));
const isImageFile = (value) => /\.(png|jpe?g|webp)$/i.test(String(value || ""));
const extensionFromValue = (value) => {
  const match = String(value || "").match(/\.([a-z0-9]+)(?:[?#].*)?$/i);
  return match?.[1]?.toLowerCase() || "";
};
const stripKnownExtension = (value, extension) => {
  const normalizedValue = String(value || "");
  const normalizedExtension = String(extension || "").replace(/^\./, "").toLowerCase();

  if (!normalizedValue || !normalizedExtension) {
    return normalizedValue;
  }

  return normalizedValue.replace(new RegExp(`\\.${normalizedExtension}$`, "i"), "");
};

const pdfMimeTypes = new Set(["application/pdf"]);
const rawDocumentMimeTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "application/x-tex",
  "text/x-tex"
]);
const imageMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const mimeTypeToFormat = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
  "text/plain": "txt",
  "application/x-tex": "tex",
  "text/x-tex": "tex",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp"
};

export const resolveCloudinaryResumeResourceType = ({
  resourceType,
  cloudinaryUrl,
  publicId,
  originalFileName,
  mimeType,
  format
} = {}) => {
  const debugInput = {
    resourceType,
    cloudinaryUrl,
    publicId,
    originalFileName,
    mimeType,
    format
  };
  const normalizedResourceType = String(resourceType || "")
    .trim()
    .toLowerCase();

  if (normalizedResourceType) {
    console.info("[resume-debug][cloudinary] resolveResourceType:explicit", {
      ...debugInput,
      resolved: normalizedResourceType
    });
    return normalizedResourceType;
  }

  const cloudinaryUrlMatch = String(cloudinaryUrl || "").match(/\/(image|raw|video)\/upload\//i);
  if (cloudinaryUrlMatch?.[1]) {
    const detectedFromUrl = cloudinaryUrlMatch[1].toLowerCase();
    if (!isPdfFile(publicId) && !isPdfFile(originalFileName) && !pdfMimeTypes.has(String(mimeType || "").toLowerCase())) {
      console.info("[resume-debug][cloudinary] resolveResourceType:from-url", {
        ...debugInput,
        resolved: detectedFromUrl
      });
      return detectedFromUrl;
    }
  }

  const normalizedMimeType = String(mimeType || "").toLowerCase();
  const normalizedFormat = String(format || "").toUpperCase();

  if (
    isDocumentFile(publicId) ||
    isDocumentFile(originalFileName) ||
    rawDocumentMimeTypes.has(normalizedMimeType) ||
    new Set(["PDF", "DOCX", "TXT", "TEX"]).has(normalizedFormat)
  ) {
    console.info("[resume-debug][cloudinary] resolveResourceType:document", {
      ...debugInput,
      resolved: "raw"
    });
    return "raw";
  }

  if (
    isImageFile(publicId) ||
    isImageFile(originalFileName) ||
    imageMimeTypes.has(normalizedMimeType) ||
    normalizedFormat === "IMAGE"
  ) {
    console.info("[resume-debug][cloudinary] resolveResourceType:image", {
      ...debugInput,
      resolved: "image"
    });
    return "image";
  }

  console.info("[resume-debug][cloudinary] resolveResourceType:fallback", {
    ...debugInput,
    resolved: "raw"
  });
  return "raw";
};

export const getCloudinaryResumeUrl = ({ publicId, resourceType = "raw" }) => {
  if (!hasCloudinaryConfig || !publicId) {
    console.warn("[resume-debug][cloudinary] getCloudinaryResumeUrl:skipped", {
      hasCloudinaryConfig,
      publicId
    });
    return "";
  }

  const normalizedResourceType = resolveCloudinaryResumeResourceType({
    resourceType,
    publicId
  });
  const shouldSignUrl = normalizedResourceType === "raw" || isDocumentFile(publicId);

  const generatedUrl = cloudinary.url(publicId, {
    secure: true,
    type: "upload",
    resource_type: normalizedResourceType,
    sign_url: shouldSignUrl
  });

  console.info("[resume-debug][cloudinary] getCloudinaryResumeUrl:generated", {
    publicId,
    inputResourceType: resourceType,
    normalizedResourceType,
    shouldSignUrl,
    generatedUrl
  });

  return generatedUrl;
};

export const getCloudinaryResumeDownloadUrl = ({
  publicId,
  resourceType = "raw",
  originalFileName,
  mimeType,
  format,
  cloudinaryUrl,
  expiresAt
}) => {
  if (!hasCloudinaryConfig || !publicId) {
    console.warn("[resume-debug][cloudinary] getCloudinaryResumeDownloadUrl:skipped", {
      hasCloudinaryConfig,
      publicId
    });
    return "";
  }

  const normalizedMimeType = String(mimeType || "").toLowerCase();
  const normalizedFormat = String(format || "").toUpperCase();
  const fileFormat =
    extensionFromValue(publicId) ||
    extensionFromValue(originalFileName) ||
    extensionFromValue(cloudinaryUrl) ||
    mimeTypeToFormat[normalizedMimeType] ||
    (normalizedFormat && normalizedFormat !== "IMAGE" ? normalizedFormat.toLowerCase() : "");

  if (!fileFormat) {
    console.warn("[resume-debug][cloudinary] getCloudinaryResumeDownloadUrl:missing-format", {
      publicId,
      resourceType,
      originalFileName,
      mimeType,
      format
    });
    return "";
  }

  const normalizedResourceType =
    String(resourceType || "")
      .trim()
      .toLowerCase() ||
    resolveCloudinaryResumeResourceType({
      resourceType,
      cloudinaryUrl,
      publicId,
      originalFileName,
      mimeType,
      format
    });

  const basePublicId = stripKnownExtension(publicId, fileFormat);
  const generatedUrl = cloudinary.utils.private_download_url(basePublicId, fileFormat, {
    resource_type: normalizedResourceType,
    type: "upload",
    attachment: false,
    expires_at: expiresAt || Math.floor(Date.now() / 1000) + 60 * 60
  });

  console.info("[resume-debug][cloudinary] getCloudinaryResumeDownloadUrl:generated", {
    publicId,
    basePublicId,
    fileFormat,
    resourceType,
    normalizedResourceType,
    generatedUrl
  });

  return generatedUrl;
};

export const uploadResumeToCloudinary = async (localFilePath) => {
  if (!localFilePath || !hasCloudinaryConfig) {
    console.warn("[resume-debug][cloudinary] upload:skipped", {
      hasLocalFilePath: Boolean(localFilePath),
      hasCloudinaryConfig
    });
    return null;
  }

  const selectedResourceType = isDocumentFile(localFilePath) ? "raw" : "auto";

  console.info("[resume-debug][cloudinary] upload:start", {
    localFilePath,
    selectedResourceType,
    folder: env.CLOUDINARY_RESUME_FOLDER
  });

  const response = await cloudinary.uploader.upload(localFilePath, {
    resource_type: selectedResourceType,
    folder: env.CLOUDINARY_RESUME_FOLDER
  });

  console.info("[resume-debug][cloudinary] upload:success", {
    public_id: response?.public_id,
    resource_type: response?.resource_type,
    format: response?.format,
    secure_url: response?.secure_url,
    bytes: response?.bytes
  });

  return response;
};

export const deleteFromCloudinary = async ({ publicId, resourceType = "raw" }) => {
  if (!hasCloudinaryConfig || !publicId) {
    return;
  }

  await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    invalidate: true
  });
};
