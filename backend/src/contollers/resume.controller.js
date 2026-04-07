import { z } from "zod";
import fs from "fs/promises";
import path from "path"; // still needed for fs.unlink path resolution
import { env } from "../config/env.js";
import { Resume } from "../models/resume.models.js";
import { findUserByFirebaseUid } from "../services/user.service.js";
import {
  deleteFromCloudinary,
  getCloudinaryResumeDownloadUrl,
  getCloudinaryResumeUrl,
  isCloudinaryEnabled,
  resolveCloudinaryResumeResourceType,
  uploadResumeToCloudinary
} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createResumeSchema = z.object({
  title: z.string().min(2, "title must be at least 2 characters"),
  format: z.enum(["PDF", "DOCX", "TXT", "TEX", "IMAGE"]).optional(),
  sections: z.number().int().min(1).max(30).optional(),
  content: z.string().optional()
});

const makeTraceId = () => `resume-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const shouldKeepLocalResumeCopies = env.NODE_ENV !== "production";
const getLocalResumePublicPath = (storedFileName) => (storedFileName ? `/uploads/resumes/${storedFileName}` : "");
const getLocalResumeDiskPath = (storedFileName) =>
  storedFileName ? path.join(process.cwd(), "uploads", "resumes", storedFileName) : "";
const getResumeFileApiPath = (resumeId) => `${env.API_PREFIX}/resumes/${resumeId}/file`;
const hasLocalResumeFile = async (storedFileName) => {
  const diskPath = getLocalResumeDiskPath(storedFileName);

  if (!diskPath) {
    return false;
  }

  try {
    await fs.access(diskPath);
    return true;
  } catch {
    return false;
  }
};

const inferMimeTypeFromResume = (resume) => {
  const extension = path.extname(String(resume.originalFileName || resume.storedFileName || resume.cloudinaryPublicId || "")).toLowerCase();

  if (resume.mimeType) {
    return resume.mimeType;
  }

  if (extension === ".pdf") return "application/pdf";
  if (extension === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (extension === ".doc") return "application/msword";
  if (extension === ".txt") return "text/plain; charset=utf-8";
  if (extension === ".tex") return "application/x-tex";
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";

  return "application/octet-stream";
};

const buildInlineContentDisposition = (fileName) => {
  const fallbackName = String(fileName || "resume")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/["\\]/g, "")
    .trim() || "resume";
  const encodedName = encodeURIComponent(String(fileName || fallbackName));
  return `inline; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`;
};

const fetchRemoteResumeFile = async (url, traceId) => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new ApiError(502, `Failed to fetch remote resume file (${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();

  console.info(`[resume-debug][${traceId}] getResumeFile:remote-fetch:success`, {
    url,
    status: response.status,
    contentType: response.headers.get("content-type"),
    contentLength: response.headers.get("content-length")
  });

  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: response.headers.get("content-type") || "",
    contentLength: response.headers.get("content-length") || ""
  };
};

const resolveResumeFileResponse = async (resume, traceId) => {
  const localDiskPath = getLocalResumeDiskPath(resume.storedFileName);
  const localExists = await hasLocalResumeFile(resume.storedFileName);

  if (localExists && localDiskPath) {
    const buffer = await fs.readFile(localDiskPath);

    console.info(`[resume-debug][${traceId}] getResumeFile:source-local`, {
      resumeId: String(resume._id || ""),
      localDiskPath,
      bytes: buffer.length
    });

    return {
      buffer,
      contentType: inferMimeTypeFromResume(resume),
      fileName: resume.originalFileName || resume.storedFileName || "resume"
    };
  }

  if (resume.cloudinaryPublicId) {
    const cloudinaryResourceType = resolveCloudinaryResumeResourceType({
      resourceType: resume.cloudinaryResourceType,
      cloudinaryUrl: resume.cloudinaryUrl,
      publicId: resume.cloudinaryPublicId,
      originalFileName: resume.originalFileName,
      mimeType: resume.mimeType,
      format: resume.format
    });
    const cloudinaryDownloadUrl =
      getCloudinaryResumeDownloadUrl({
        publicId: resume.cloudinaryPublicId,
        resourceType: cloudinaryResourceType,
        originalFileName: resume.originalFileName,
        mimeType: resume.mimeType,
        format: resume.format,
        cloudinaryUrl: resume.cloudinaryUrl
      }) ||
      getCloudinaryResumeUrl({
        publicId: resume.cloudinaryPublicId,
        resourceType: cloudinaryResourceType
      });

    if (cloudinaryDownloadUrl) {
      console.info(`[resume-debug][${traceId}] getResumeFile:source-cloudinary`, {
        resumeId: String(resume._id || ""),
        cloudinaryPublicId: resume.cloudinaryPublicId,
        cloudinaryResourceType,
        cloudinaryDownloadUrl
      });

      const remoteFile = await fetchRemoteResumeFile(cloudinaryDownloadUrl, traceId);

      return {
        buffer: remoteFile.buffer,
        contentType: remoteFile.contentType || inferMimeTypeFromResume(resume),
        fileName: resume.originalFileName || resume.storedFileName || "resume"
      };
    }
  }

  if (/^https?:\/\//i.test(String(resume.filePath || ""))) {
    console.info(`[resume-debug][${traceId}] getResumeFile:source-remote-filePath`, {
      resumeId: String(resume._id || ""),
      filePath: resume.filePath
    });

    const remoteFile = await fetchRemoteResumeFile(resume.filePath, traceId);

    return {
      buffer: remoteFile.buffer,
      contentType: remoteFile.contentType || inferMimeTypeFromResume(resume),
      fileName: resume.originalFileName || resume.storedFileName || "resume"
    };
  }

  throw new ApiError(404, "Resume file not found");
};

const resolveCloudinaryDeliveryMeta = ({ cloudUpload, file }) => {
  if (!cloudUpload?.public_id) {
    return null;
  }

  const cloudinaryResourceType = resolveCloudinaryResumeResourceType({
    resourceType: cloudUpload.resource_type,
    cloudinaryUrl: cloudUpload.secure_url,
    publicId: cloudUpload.public_id,
    originalFileName: file?.originalname,
    mimeType: file?.mimetype
  });

  const cloudinaryUrl = getCloudinaryResumeUrl({
    publicId: cloudUpload.public_id,
    resourceType: cloudinaryResourceType
  });

  return {
    cloudinaryUrl,
    cloudinaryResourceType
  };
};

const resolveFileMeta = (file, cloudUpload = null) => {
  if (!file) {
    return {};
  }

  if (cloudUpload) {
    const deliveryMeta = resolveCloudinaryDeliveryMeta({
      cloudUpload,
      file
    });

    return {
      originalFileName: file.originalname,
      storedFileName: file.filename,
      filePath: getLocalResumePublicPath(file.filename),
      cloudinaryUrl: deliveryMeta?.cloudinaryUrl || "",
      mimeType: file.mimetype,
      fileSize: file.size,
      cloudinaryPublicId: cloudUpload.public_id,
      cloudinaryResourceType: deliveryMeta?.cloudinaryResourceType || "raw"
    };
  }

  return {
    originalFileName: file.originalname,
    storedFileName: file.filename,
    filePath: `/uploads/resumes/${file.filename}`,
    mimeType: file.mimetype,
    fileSize: file.size
  };
};

export const listResumes = asyncHandler(async (req, res) => {
  const traceId = makeTraceId();
  const user = await findUserByFirebaseUid(req.auth.uid);

  console.info(`[resume-debug][${traceId}] listResumes:start`, {
    firebaseUid: req.auth.uid,
    userId: String(user?._id || "")
  });

  const resumes = await Resume.find({ owner: user._id }).sort({ updatedAt: -1 });

  console.info(`[resume-debug][${traceId}] listResumes:fetched`, {
    count: resumes.length
  });

  const normalizedResumes = await Promise.all(resumes.map(async (resume) => {
    const plainResume = resume.toObject();
    const localFilePath = getLocalResumePublicPath(plainResume.storedFileName);
    const hasLocalFile = await hasLocalResumeFile(plainResume.storedFileName);
    const fileProxyPath = getResumeFileApiPath(String(plainResume._id || ""));

    if (hasLocalFile && localFilePath) {
      plainResume.filePath = fileProxyPath;

      console.info(`[resume-debug][${traceId}] listResumes:item-local`, {
        resumeId: String(plainResume._id || ""),
        title: plainResume.title,
        storedFileName: plainResume.storedFileName,
        filePath: plainResume.filePath
      });
    }

    if (!hasLocalFile && plainResume.cloudinaryPublicId) {
      const cloudinaryResourceType = resolveCloudinaryResumeResourceType({
        resourceType: plainResume.cloudinaryResourceType,
        cloudinaryUrl: plainResume.cloudinaryUrl,
        publicId: plainResume.cloudinaryPublicId,
        originalFileName: plainResume.originalFileName,
        mimeType: plainResume.mimeType,
        format: plainResume.format
      });
      const cloudinaryUrl =
        getCloudinaryResumeDownloadUrl({
          publicId: plainResume.cloudinaryPublicId,
          resourceType: cloudinaryResourceType,
          originalFileName: plainResume.originalFileName,
          mimeType: plainResume.mimeType,
          format: plainResume.format,
          cloudinaryUrl: plainResume.cloudinaryUrl
        }) ||
        getCloudinaryResumeUrl({
          publicId: plainResume.cloudinaryPublicId,
          resourceType: cloudinaryResourceType
        });

      if (cloudinaryUrl) {
        plainResume.cloudinaryUrl = cloudinaryUrl;
        plainResume.filePath = fileProxyPath;
        plainResume.cloudinaryResourceType = cloudinaryResourceType;
      }

      console.info(`[resume-debug][${traceId}] listResumes:item-cloudinary`, {
        resumeId: String(plainResume._id || ""),
        title: plainResume.title,
        cloudinaryPublicId: plainResume.cloudinaryPublicId,
        cloudinaryResourceType,
        filePath: plainResume.filePath
      });
    }

    if (!plainResume.filePath && (plainResume.storedFileName || plainResume.cloudinaryPublicId)) {
      plainResume.filePath = fileProxyPath;
    }

    return plainResume;
  }));

  return res.status(200).json(new ApiResponse(200, { resumes: normalizedResumes }, "Resumes fetched successfully"));
});

export const createResume = asyncHandler(async (req, res) => {
  const traceId = makeTraceId();
  const hasUpload = Boolean(req.file);
  const body = {
    ...req.body,
    sections: req.body.sections ? Number(req.body.sections) : undefined
  };

  console.info(`[resume-debug][${traceId}] createResume:start`, {
    firebaseUid: req.auth.uid,
    hasUpload,
    frontendTraceId: typeof req.body?.debugTraceId === "string" ? req.body.debugTraceId : "",
    body: {
      title: body.title,
      sections: body.sections,
      format: body.format,
      contentLength: typeof body.content === "string" ? body.content.length : 0
    },
    file: req.file
      ? {
          originalname: req.file.originalname,
          filename: req.file.filename,
          mimetype: req.file.mimetype,
          size: req.file.size,
          path: req.file.path
        }
      : null
  });

  const parsed = createResumeSchema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError(400, "Invalid resume payload", parsed.error.issues);
  }

  const user = await findUserByFirebaseUid(req.auth.uid);
  let cloudUpload = null;
  if (req.file && isCloudinaryEnabled()) {
    console.info(`[resume-debug][${traceId}] createResume:cloudinary-upload:start`, {
      localFilePath: req.file.path,
      originalFileName: req.file.originalname,
      mimeType: req.file.mimetype
    });

    cloudUpload = await uploadResumeToCloudinary(req.file.path);

    console.info(`[resume-debug][${traceId}] createResume:cloudinary-upload:response`, {
      public_id: cloudUpload?.public_id,
      resource_type: cloudUpload?.resource_type,
      format: cloudUpload?.format,
      secure_url: cloudUpload?.secure_url
    });

    if (!cloudUpload?.secure_url && !cloudUpload?.public_id) {
      console.error(`[resume-debug][${traceId}] createResume:cloudinary-upload:invalid-response`, {
        cloudUpload
      });
      throw new ApiError(502, "Cloudinary upload failed for the resume file");
    }
  }

  const detectedFormat = req.file
    ? req.file.originalname.toLowerCase().endsWith(".docx")
      ? "DOCX"
      : req.file.originalname.toLowerCase().endsWith(".txt")
      ? "TXT"
      : req.file.originalname.toLowerCase().endsWith(".tex")
      ? "TEX"
      : new Set([".png", ".jpg", ".jpeg", ".webp"]).has(path.extname(req.file.originalname).toLowerCase())
      ? "IMAGE"
      : "PDF"
    : parsed.data.format || "PDF";

  const resolvedFileMeta = resolveFileMeta(req.file, cloudUpload);

  console.info(`[resume-debug][${traceId}] createResume:resolved-file-meta`, {
    filePath: resolvedFileMeta.filePath,
    cloudinaryUrl: resolvedFileMeta.cloudinaryUrl,
    cloudinaryPublicId: resolvedFileMeta.cloudinaryPublicId,
    cloudinaryResourceType: resolvedFileMeta.cloudinaryResourceType
  });

  const resume = await Resume.create({
    owner: user._id,
    ...parsed.data,
    ...resolvedFileMeta,
    format: detectedFormat,
    title: req.file ? parsed.data.title || req.file.originalname.replace(/\.[^.]+$/, "") : parsed.data.title,
    content: hasUpload ? parsed.data.content || "Uploaded resume" : parsed.data.content || ""
  });

  console.info(`[resume-debug][${traceId}] createResume:db-saved`, {
    resumeId: String(resume._id || ""),
    title: resume.title,
    format: resume.format,
    filePath: resume.filePath,
    cloudinaryPublicId: resume.cloudinaryPublicId,
    cloudinaryResourceType: resume.cloudinaryResourceType
  });

  if (req.file?.path && cloudUpload && !shouldKeepLocalResumeCopies) {
    await fs.unlink(req.file.path).catch((unlinkError) => {
      console.warn(`[resume-debug][${traceId}] createResume:cleanup-local-file:failed`, {
        path: req.file.path,
        error: unlinkError instanceof Error ? unlinkError.message : String(unlinkError)
      });
    });
  }

  const responseResume = resume.toObject();
  if (responseResume.storedFileName || responseResume.cloudinaryPublicId) {
    responseResume.filePath = getResumeFileApiPath(String(responseResume._id || ""));
  }

  return res.status(201).json(new ApiResponse(201, { resume: responseResume }, "Resume created successfully"));
});

export const getResumeFile = asyncHandler(async (req, res) => {
  const traceId = makeTraceId();
  const user = await findUserByFirebaseUid(req.auth.uid);
  const { resumeId } = req.params;

  const resume = await Resume.findOne({ _id: resumeId, owner: user._id });

  if (!resume) {
    throw new ApiError(404, "Resume not found");
  }

  console.info(`[resume-debug][${traceId}] getResumeFile:start`, {
    resumeId,
    title: resume.title,
    storedFileName: resume.storedFileName,
    cloudinaryPublicId: resume.cloudinaryPublicId
  });

  const fileResponse = await resolveResumeFileResponse(resume, traceId);

  res.setHeader("Content-Type", fileResponse.contentType || "application/octet-stream");
  res.setHeader("Content-Disposition", buildInlineContentDisposition(fileResponse.fileName));
  res.setHeader("Cache-Control", "private, max-age=300");

  return res.status(200).send(fileResponse.buffer);
});

export const deleteResume = asyncHandler(async (req, res) => {
  const user = await findUserByFirebaseUid(req.auth.uid);
  const { resumeId } = req.params;

  const deleted = await Resume.findOneAndDelete({ _id: resumeId, owner: user._id });

  if (!deleted) {
    throw new ApiError(404, "Resume not found");
  }

  if (deleted.cloudinaryPublicId) {
    try {
      await deleteFromCloudinary({
        publicId: deleted.cloudinaryPublicId,
        resourceType: resolveCloudinaryResumeResourceType({
          resourceType: deleted.cloudinaryResourceType,
          cloudinaryUrl: deleted.cloudinaryUrl,
          publicId: deleted.cloudinaryPublicId,
          originalFileName: deleted.originalFileName,
          mimeType: deleted.mimeType,
          format: deleted.format
        })
      });
    } catch {
      // ignore remote deletion failure to avoid blocking DB cleanup
    }
  }

  if (deleted.filePath?.startsWith("/uploads/")) {
    try {
      await fs.unlink(path.join(process.cwd(), deleted.filePath.replace(/^\//, "")));
    } catch {
      // ignore missing file on disk
    }
  } else if (deleted.storedFileName) {
    try {
      await fs.unlink(path.join(process.cwd(), "uploads", "resumes", deleted.storedFileName));
    } catch {
      // ignore missing file on disk
    }
  }

  return res.status(200).json(new ApiResponse(200, { resumeId }, "Resume deleted successfully"));
});
