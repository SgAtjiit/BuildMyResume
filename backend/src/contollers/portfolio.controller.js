import { z } from "zod";
import { Project } from "../models/project.models.js";
import { GeneratorService } from "../services/portfolio-generator.service.js";
import { VercelService } from "../services/vercel.service.js";
import { buildPortfolioSourceBundle } from "../services/portfolioService.js";
import { pushPortfolioSourceToGitHub } from "../services/github-export.service.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const generatePortfolioSchema = z.object({
  preferences: z.object({
    theme: z.enum(["modern", "minimal"]).default("modern"),
    stack: z.enum(["static", "react"]).default("static")
  }),
  projectName: z.string().trim().min(2).max(80).optional()
});

const deploymentStatusParamsSchema = z.object({
  id: z.string().trim().min(3)
});

const customDomainSchema = z.object({
  projectId: z.string().trim().min(2),
  domain: z
    .string()
    .trim()
    .min(3)
    .max(253)
    .regex(/^[a-z0-9.-]+$/i, "Domain must contain only letters, numbers, dashes and dots")
});

const githubExportSchema = z.object({
  token: z.string().trim().min(20),
  repoName: z.string().trim().min(2).max(100),
  repoOwner: z.string().trim().max(100).optional().default(""),
  branch: z.string().trim().min(1).max(100).optional().default("main"),
  pathPrefix: z.string().trim().max(120).optional().default(""),
  preference: z
    .object({
      theme: z.enum(["minimal", "dark", "glassmorphism", "cyberpunk"]).optional(),
      font: z.enum(["Inter", "JetBrains Mono", "Sora", "Space Grotesk"]).optional(),
      animations: z.enum(["none", "subtle", "rich"]).optional(),
      accent: z.string().max(32).optional(),
      notes: z.string().max(500).optional()
    })
    .optional(),
  createRepo: z.boolean().optional().default(true),
  privateRepo: z.boolean().optional().default(false)
});

const generateCooldownMs = 30 * 1000;
const generateCooldownTracker = new Map();

const enforceGenerateCooldown = (uid) => {
  const now = Date.now();
  const lastUsedAt = generateCooldownTracker.get(uid);

  if (lastUsedAt && now - lastUsedAt < generateCooldownMs) {
    const retryAfterSeconds = Math.ceil((generateCooldownMs - (now - lastUsedAt)) / 1000);
    throw new ApiError(429, `Please wait ${retryAfterSeconds}s before generating another portfolio`);
  }

  generateCooldownTracker.set(uid, now);
};

const mapDeploymentState = (state) => {
  if (state === "READY") {
    return "READY";
  }

  if (state === "ERROR" || state === "CANCELED") {
    return "ERROR";
  }

  return "BUILDING";
};

export const generateAndDeployPortfolio = asyncHandler(async (req, res) => {
  const parsed = generatePortfolioSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ApiError(400, "Invalid generate payload", parsed.error.issues);
  }

  enforceGenerateCooldown(req.auth.uid);

  const user = req.currentUser;
  const projects = await Project.find({ owner: user._id }).sort({ updatedAt: -1 }).limit(24).lean();

  const generated = GeneratorService.generate({
    userProfile: user,
    projects,
    preferences: parsed.data.preferences
  });

  const deployment = await VercelService.createDeployment({
    auth: req.vercelAuth,
    name: (parsed.data.projectName || `${user.displayName || "portfolio"}-site`)
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 52) || "portfolio-site",
    files: generated.files,
    framework: generated.framework
  });

  return res.status(202).json(
    new ApiResponse(
      202,
      {
        deploymentId: deployment.id,
        status: mapDeploymentState(deployment.readyState),
        url: deployment.url ? `https://${deployment.url}` : null,
        source: req.vercelAuth.source,
        payloadSize: generated.payloadSize
      },
      "Portfolio generation and deployment started"
    )
  );
});

export const getPortfolioDeploymentStatus = asyncHandler(async (req, res) => {
  const parsedParams = deploymentStatusParamsSchema.safeParse(req.params);

  if (!parsedParams.success) {
    throw new ApiError(400, "Invalid deployment id", parsedParams.error.issues);
  }

  const deployment = await VercelService.getDeploymentStatus({
    auth: req.vercelAuth,
    deploymentId: parsedParams.data.id
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        deploymentId: deployment.id,
        status: mapDeploymentState(deployment.readyState),
        url: deployment.url ? `https://${deployment.url}` : null,
        errorMessage: deployment.errorMessage || ""
      },
      "Deployment status fetched"
    )
  );
});

export const attachPortfolioDomain = asyncHandler(async (req, res) => {
  const parsed = customDomainSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ApiError(400, "Invalid custom domain payload", parsed.error.issues);
  }

  try {
    const domainResponse = await VercelService.addCustomDomain({
      auth: req.vercelAuth,
      projectId: parsed.data.projectId,
      domain: parsed.data.domain
    });

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          domain: domainResponse.name || parsed.data.domain,
          verified: Boolean(domainResponse.verified),
          verification: domainResponse.verification || []
        },
        "Domain attached successfully"
      )
    );
  } catch (error) {
    const verification = error?.errors?.verification || error?.errors?.domainVerification || [];

    if (verification.length) {
      return res.status(400).json(
        new ApiResponse(
          400,
          {
            error: "verification",
            verification
          },
          "Domain verification required"
        )
      );
    }

    throw error;
  }
});

export const exportPortfolioToGitHub = asyncHandler(async (req, res) => {
  const parsed = githubExportSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ApiError(400, "Invalid GitHub export payload", parsed.error.issues);
  }

  const bundle = await buildPortfolioSourceBundle(req.auth.uid, parsed.data.preference || {}, {
    traceId: req.traceId || ""
  });

  const exportResult = await pushPortfolioSourceToGitHub({
    token: parsed.data.token,
    owner: parsed.data.repoOwner || "",
    repoName: parsed.data.repoName,
    branch: parsed.data.branch,
    pathPrefix: parsed.data.pathPrefix,
    filesMap: bundle.generatedProject.filesMap,
    createRepo: parsed.data.createRepo,
    privateRepo: parsed.data.privateRepo,
    traceId: req.traceId || ""
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        repoUrl: exportResult.repoUrl,
        owner: exportResult.owner,
        repoName: exportResult.repoName,
        branch: exportResult.branch,
        pathPrefix: exportResult.pathPrefix,
        filesUpdated: exportResult.filesUpdated,
        createdRepo: exportResult.createdRepo
      },
      "Portfolio source exported to GitHub successfully"
    )
  );
});
