import { Router } from "express";
import { randomUUID } from "crypto";
import { verifyFirebaseToken } from "../middlewares/auth.middleware.js";
import { exportPortfolioToGitHub } from "../contollers/portfolio.controller.js";
import { publishPortfolio } from "../services/portfolioService.js";
import { incrementDailyCounter } from "../models/analytics.models.js";

const router = Router();

// In-Memory Job Queue (since it's a single Node instance, this is perfectly fine)
const activeBuildJobs = new Map();

const authMiddleware = (req, res, next) => {
  verifyFirebaseToken(req, res, (error) => {
    if (error) {
      next(error);
      return;
    }

    req.user = {
      id: req.auth.uid
    };

    next();
  });
};

router.post("/publish", authMiddleware, async (req, res) => {
  const traceId = randomUUID();
  const jobId = randomUUID();
  const startedAt = Date.now();
  const { preference = "", customDomain = "" } = req.body || {};

  console.info("[portfolio/publish:queued]", {
    traceId,
    jobId,
    uid: req.user?.id
  });

  activeBuildJobs.set(jobId, { status: "processing", progress: 0 });

  // Respond to frontend INSTANTLY to avoid 100s Load Balancer timeout.
  res.json({ success: true, jobId, traceId });

  // Fire and forget heavy task in background
  (async () => {
    try {
      const { url, domainInfo } = await publishPortfolio(req.user.id, preference, customDomain, {
        traceId
      });

      incrementDailyCounter("portfoliosPublished", 1);

      console.info("[portfolio/publish:success]", {
        traceId,
        jobId,
        uid: req.user?.id,
        url,
        durationMs: Date.now() - startedAt
      });

      activeBuildJobs.set(jobId, { status: "completed", url, domainSetup: domainInfo });
      
      // Auto-cleanup memory after 5 minutes
      setTimeout(() => activeBuildJobs.delete(jobId), 300000);
    } catch (error) {
      console.error("[portfolio/publish:error]", {
        traceId,
        jobId,
        uid: req.user?.id,
        message: error?.message || "Unknown error",
        durationMs: Date.now() - startedAt
      });

      const rawDetails = error?.message || "Unknown error";
      const stack = error?.stack || "";
      
      let friendlyError = "Deployment failed due to Backend server error.";
      
      if (rawDetails.toLowerCase().includes("cloudflare") || stack.includes("deployToCloudflare")) {
        friendlyError = "Deployment failed due to Cloudflare.";
      } else if (rawDetails.toLowerCase().includes("vite") || stack.includes("buildViteProject")) {
        friendlyError = "Deployment failed due to Backend (Vite Compilation).";
      } else if (rawDetails.toLowerCase().includes("timeout") || error?.message?.includes("Abort")) {
        friendlyError = "Deployment failed due to Render Backend (Timeout).";
      } else {
        // Fallback to exact message if it's something specific we know
        friendlyError = `Deployment failed: ${rawDetails}`;
      }

      activeBuildJobs.set(jobId, { status: "failed", error: friendlyError });
      
      // Auto-cleanup memory after 5 minutes
      setTimeout(() => activeBuildJobs.delete(jobId), 300000);
    }
  })();
});

router.get("/status/:jobId", authMiddleware, (req, res) => {
  const { jobId } = req.params;
  const job = activeBuildJobs.get(jobId);
  
  if (!job) {
    return res.status(404).json({ success: false, error: "Job ID not found or expired." });
  }

  res.json({ success: true, ...job });
});

router.post("/github", authMiddleware, exportPortfolioToGitHub);

export default router;
