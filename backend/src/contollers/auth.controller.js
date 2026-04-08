import { verifyFirebaseIdToken } from "../config/firebase.js";
import { upsertUserFromFirebase } from "../services/auth.service.js";
import { findUserByFirebaseUid } from "../services/user.service.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { z } from "zod";
import {
  AchievementEntry,
  EducationEntry,
  ExperienceEntry,
  normalizeSkillBuckets,
  normalizeTextArray,
  SkillSection
} from "../classes/profile.classes.js";
import { env } from "../config/env.js";
import { createOAuthState, verifyOAuthState } from "../utils/vercel-oauth-state.js";
import { VercelService } from "../services/vercel.service.js";
import { encryptToken } from "../utils/vercel-token-crypto.js";

const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(80).optional(),
  headline: z.string().max(120).optional(),
  phone: z.string().max(30).optional(),
  about: z.string().max(2000).optional(),
  customDomain: z.string().max(120).optional(),
  notificationsEnabled: z.boolean().optional(),
  onboardingCompleted: z.boolean().optional(),
  linkedInUrl: z.string().max(300).optional(),
  githubUrl: z.string().max(300).optional(),
  leetCodeId: z.string().max(120).optional(),
  geeksForGeeksId: z.string().max(120).optional(),
  education: z.array(z.string().min(2).max(200)).max(10).optional(),
  educationEntries: z
    .array(
      z.object({
        degree: z.string().max(120).optional().default(""),
        specialization: z.string().max(120).optional().default(""),
        college: z.string().max(160).optional().default(""),
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
        title: z.string().max(80).optional().default(""),
        skills: z.array(z.string().min(1).max(80)).max(20)
      })
    )
    .max(10)
    .optional(),
  experience: z
    .array(
      z.object({
        role: z.string().max(120).optional().default(""),
        company: z.string().max(120).optional().default(""),
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
        title: z.string().max(120).optional().default(""),
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

  if (parsed.data.headline !== undefined) {
    user.headline = parsed.data.headline;
  }

  if (parsed.data.phone !== undefined) {
    user.phone = parsed.data.phone;
  }

  if (parsed.data.about !== undefined) {
    user.about = parsed.data.about;
  }

  if (parsed.data.customDomain !== undefined) {
    user.customDomain = parsed.data.customDomain;
  }

  if (parsed.data.notificationsEnabled !== undefined) {
    user.notificationsEnabled = parsed.data.notificationsEnabled;
  }

  if (parsed.data.onboardingCompleted !== undefined) {
    user.onboardingCompletedAt = parsed.data.onboardingCompleted ? new Date() : null;
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

  const hasEducationEntriesUpdate = parsed.data.educationEntries !== undefined;
  const hasSkillUpdate =
    parsed.data.skillSections !== undefined ||
    parsed.data.skillLanguages !== undefined ||
    parsed.data.skillFrameworks !== undefined ||
    parsed.data.skillTools !== undefined ||
    parsed.data.skillLibraries !== undefined;

  if (hasEducationEntriesUpdate) {
    const normalizedEducationEntries = EducationEntry.fromList(parsed.data.educationEntries)
      .filter((entry) => !entry.isEmpty());

    user.educationEntries = normalizedEducationEntries.map((entry) => entry.toObject());
    user.education = normalizedEducationEntries.map((entry) => entry.toSummaryLine()).filter(Boolean);
  } else if (parsed.data.education !== undefined) {
    user.education = normalizeTextArray(parsed.data.education);
  }

  if (hasSkillUpdate) {
    const skillSections = parsed.data.skillSections !== undefined
      ? SkillSection.fromList(parsed.data.skillSections).filter((section) => !section.isEmpty()).map((section) => section.toObject())
      : user.skillSections;

    const normalizedBuckets = normalizeSkillBuckets({
      skillSections,
      skillLanguages: parsed.data.skillLanguages !== undefined ? parsed.data.skillLanguages : user.skillLanguages,
      skillFrameworks: parsed.data.skillFrameworks !== undefined ? parsed.data.skillFrameworks : user.skillFrameworks,
      skillTools: parsed.data.skillTools !== undefined ? parsed.data.skillTools : user.skillTools,
      skillLibraries: parsed.data.skillLibraries !== undefined ? parsed.data.skillLibraries : user.skillLibraries
    });

    user.skillSections = normalizedBuckets.skillSections;
    user.skillLanguages = normalizedBuckets.skillLanguages;
    user.skillFrameworks = normalizedBuckets.skillFrameworks;
    user.skillTools = normalizedBuckets.skillTools;
    user.skillLibraries = normalizedBuckets.skillLibraries;
  }

  if (parsed.data.experience !== undefined) {
    user.experience = ExperienceEntry.fromList(parsed.data.experience)
      .filter((entry) => !entry.isEmpty())
      .map((entry) => entry.toObject());
  }

  if (parsed.data.achievements !== undefined) {
    user.achievements = AchievementEntry.fromList(parsed.data.achievements)
      .filter((entry) => !entry.isEmpty())
      .map((entry) => entry.toObject());
  }

  await user.save();

  return res.status(200).json(new ApiResponse(200, { user }, "Profile updated successfully"));
});

export const startVercelOAuth = asyncHandler(async (req, res) => {
  if (!env.VERCEL_OAUTH_CLIENT_ID || !env.VERCEL_OAUTH_REDIRECT_URI) {
    throw new ApiError(500, "Vercel OAuth is not configured");
  }

  const state = createOAuthState({
    uid: req.auth.uid,
    ts: Date.now(),
    redirectTo: typeof req.query.redirectTo === "string" ? req.query.redirectTo : ""
  });

  const oauthUrl = new URL("https://vercel.com/oauth/authorize");
  oauthUrl.searchParams.set("client_id", env.VERCEL_OAUTH_CLIENT_ID);
  oauthUrl.searchParams.set("redirect_uri", env.VERCEL_OAUTH_REDIRECT_URI);
  oauthUrl.searchParams.set("scope", env.VERCEL_OAUTH_SCOPE);
  oauthUrl.searchParams.set("state", state);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        authorizationUrl: oauthUrl.toString()
      },
      "Vercel OAuth URL generated"
    )
  );
});

export const handleVercelOAuthCallback = asyncHandler(async (req, res) => {
  const { code, state, teamId } = req.query;

  if (!code || typeof code !== "string") {
    throw new ApiError(400, "Missing OAuth code");
  }

  if (!state || typeof state !== "string") {
    throw new ApiError(400, "Missing OAuth state");
  }

  const parsedState = verifyOAuthState(state);
  const maxStateAgeMs = 10 * 60 * 1000;

  if (!parsedState?.uid || !parsedState?.ts || Date.now() - parsedState.ts > maxStateAgeMs) {
    throw new ApiError(400, "OAuth state is invalid or expired");
  }

  const tokenPayload = await VercelService.exchangeOAuthCode({ code });
  const user = await findUserByFirebaseUid(parsedState.uid);
  const encrypted = encryptToken(tokenPayload.access_token || "");

  user.vercelConnection = {
    ...encrypted,
    teamId: typeof teamId === "string" ? teamId : tokenPayload.team_id || "",
    scope: tokenPayload.scope || env.VERCEL_OAUTH_SCOPE,
    connectedAt: new Date()
  };

  await user.save();

  if (parsedState.redirectTo) {
    const redirectUrl = new URL(parsedState.redirectTo);
    redirectUrl.searchParams.set("vercel_connected", "1");
    if (user.vercelConnection.teamId) {
      redirectUrl.searchParams.set("vercel_team_id", user.vercelConnection.teamId);
    }
    return res.redirect(302, redirectUrl.toString());
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        connected: true,
        teamId: user.vercelConnection.teamId,
        scope: user.vercelConnection.scope
      },
      "Vercel connected successfully"
    )
  );
});
