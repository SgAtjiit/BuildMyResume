import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { Resume } from "../models/resume.models.js";
import { findUserByFirebaseUid } from "../services/user.service.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createResumeSchema = z.object({
  title: z.string().min(2, "title must be at least 2 characters"),
  format: z.enum(["PDF", "DOCX", "TXT", "TEX", "IMAGE"]).optional(),
  sections: z.number().int().min(1).max(30).optional(),
  content: z.string().optional()
});

const resolveFileMeta = (file) => {
  if (!file) {
    return {};
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
  const user = await findUserByFirebaseUid(req.auth.uid);

  const resumes = await Resume.find({ owner: user._id }).sort({ updatedAt: -1 });

  return res.status(200).json(new ApiResponse(200, { resumes }, "Resumes fetched successfully"));
});

export const createResume = asyncHandler(async (req, res) => {
  const hasUpload = Boolean(req.file);
  const body = {
    ...req.body,
    sections: req.body.sections ? Number(req.body.sections) : undefined
  };

  const parsed = createResumeSchema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError(400, "Invalid resume payload", parsed.error.issues);
  }

  const user = await findUserByFirebaseUid(req.auth.uid);
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

  const resume = await Resume.create({
    owner: user._id,
    ...parsed.data,
    ...resolveFileMeta(req.file),
    format: detectedFormat,
    title: req.file ? parsed.data.title || req.file.originalname.replace(/\.[^.]+$/, "") : parsed.data.title,
    content: hasUpload ? parsed.data.content || "Uploaded resume" : parsed.data.content || ""
  });

  return res.status(201).json(new ApiResponse(201, { resume }, "Resume created successfully"));
});

export const deleteResume = asyncHandler(async (req, res) => {
  const user = await findUserByFirebaseUid(req.auth.uid);
  const { resumeId } = req.params;

  const deleted = await Resume.findOneAndDelete({ _id: resumeId, owner: user._id });

  if (!deleted) {
    throw new ApiError(404, "Resume not found");
  }

  if (deleted.filePath) {
    try {
      await fs.unlink(path.join(process.cwd(), deleted.filePath.replace(/^\//, "")));
    } catch {
      // ignore missing file on disk
    }
  }

  return res.status(200).json(new ApiResponse(200, { resumeId }, "Resume deleted successfully"));
});
