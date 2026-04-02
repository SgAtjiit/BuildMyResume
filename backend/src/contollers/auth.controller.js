import { verifyFirebaseIdToken } from "../config/firebase.js";
import { upsertUserFromFirebase } from "../services/auth.service.js";
import { findUserByFirebaseUid } from "../services/user.service.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { z } from "zod";

const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(80).optional(),
  customDomain: z.string().max(120).optional(),
  notificationsEnabled: z.boolean().optional(),
  linkedInUrl: z.string().max(300).optional(),
  githubUrl: z.string().max(300).optional(),
  leetCodeId: z.string().max(120).optional(),
  geeksForGeeksId: z.string().max(120).optional(),
  education: z.array(z.string().min(2).max(200)).max(10).optional(),
  educationEntries: z
    .array(
      z.object({
        degree: z.string().min(1).max(120),
        specialization: z.string().max(120).optional().default(""),
        college: z.string().min(1).max(160),
        location: z.string().max(120).optional().default(""),
        endDate: z.string().max(60).optional().default(""),
        grade: z.string().max(40).optional().default("")
      })
    )
    .max(10)
    .optional(),
  skillLanguages: z.array(z.string().min(1).max(80)).max(20).optional(),
  skillFrameworks: z.array(z.string().min(1).max(80)).max(20).optional(),
  skillTools: z.array(z.string().min(1).max(80)).max(20).optional(),
  skillLibraries: z.array(z.string().min(1).max(80)).max(20).optional(),
  skillSections: z
    .array(
      z.object({
        title: z.string().min(1).max(80),
        skills: z.array(z.string().min(1).max(80)).max(20)
      })
    )
    .max(10)
    .optional(),
  experience: z
    .array(
      z.object({
        role: z.string().min(1).max(120),
        company: z.string().min(1).max(120),
        location: z.string().max(120).optional().default(""),
        date: z.string().max(60).optional().default(""),
        bullets: z.array(z.string().min(1).max(200)).max(10)
      })
    )
    .max(10)
    .optional(),
  achievements: z
    .array(
      z.object({
        title: z.string().min(1).max(120),
        date: z.string().max(60).optional().default(""),
        bullets: z.array(z.string().min(1).max(200)).max(10)
      })
    )
    .max(10)
    .optional()
});

export const firebaseSignIn = asyncHandler(async (req, res) => {
  const { idToken } = req.body;

  if (!idToken || typeof idToken !== "string") {
    throw new ApiError(400, "idToken is required");
  }

  const decodedToken = await verifyFirebaseIdToken(idToken);
  const user = await upsertUserFromFirebase(decodedToken);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        user,
        auth: {
          uid: decodedToken.uid,
          email: decodedToken.email || null
        }
      },
      "User authenticated successfully"
    )
  );
});

export const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await upsertUserFromFirebase(req.auth.decodedToken);

  return res.status(200).json(new ApiResponse(200, { user }, "Current user profile"));
});

export const updateCurrentUser = asyncHandler(async (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ApiError(400, "Invalid profile payload", parsed.error.issues);
  }

  const user = await findUserByFirebaseUid(req.auth.uid);

  if (parsed.data.displayName !== undefined) {
    user.displayName = parsed.data.displayName;
  }

  if (parsed.data.customDomain !== undefined) {
    user.customDomain = parsed.data.customDomain;
  }

  if (parsed.data.notificationsEnabled !== undefined) {
    user.notificationsEnabled = parsed.data.notificationsEnabled;
  }

  if (parsed.data.linkedInUrl !== undefined) {
    user.linkedInUrl = parsed.data.linkedInUrl;
  }

  if (parsed.data.githubUrl !== undefined) {
    user.githubUrl = parsed.data.githubUrl;
  }

  if (parsed.data.leetCodeId !== undefined) {
    user.leetCodeId = parsed.data.leetCodeId;
  }

  if (parsed.data.geeksForGeeksId !== undefined) {
    user.geeksForGeeksId = parsed.data.geeksForGeeksId;
  }

  if (parsed.data.education !== undefined) {
    user.education = parsed.data.education;
  }

  if (parsed.data.educationEntries !== undefined) {
    user.educationEntries = parsed.data.educationEntries;
  }

  if (parsed.data.skillLanguages !== undefined) {
    user.skillLanguages = parsed.data.skillLanguages;
  }

  if (parsed.data.skillFrameworks !== undefined) {
    user.skillFrameworks = parsed.data.skillFrameworks;
  }

  if (parsed.data.skillTools !== undefined) {
    user.skillTools = parsed.data.skillTools;
  }

  if (parsed.data.skillLibraries !== undefined) {
    user.skillLibraries = parsed.data.skillLibraries;
  }

  if (parsed.data.skillSections !== undefined) {
    user.skillSections = parsed.data.skillSections;
  }

  if (parsed.data.experience !== undefined) {
    user.experience = parsed.data.experience;
  }

  if (parsed.data.achievements !== undefined) {
    user.achievements = parsed.data.achievements;
  }

  await user.save();

  return res.status(200).json(new ApiResponse(200, { user }, "Profile updated successfully"));
});
