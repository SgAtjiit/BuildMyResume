import { Router } from "express";
import { randomUUID } from "crypto";
import { verifyFirebaseToken } from "../middlewares/auth.middleware.js";
import { publishPortfolio } from "../services/portfolioService.js";

const router = Router();

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
  const startedAt = Date.now();
  const { preference = "", customDomain = "" } = req.body || {};

  console.info("[portfolio/publish:start]", {
    traceId,
    uid: req.user?.id,
    hasPreference: Boolean(String(preference || "").trim()),
    hasCustomDomain: Boolean(String(customDomain || "").trim())
  });

  try {
    const { url, domainInfo } = await publishPortfolio(req.user.id, preference, customDomain, {
      traceId
    });

    console.info("[portfolio/publish:success]", {
      traceId,
      uid: req.user?.id,
      url,
      customDomain: domainInfo?.domain || null,
      durationMs: Date.now() - startedAt
    });

    return res.json({
      success: true,
      traceId,
      url,
      domainSetup: domainInfo
    });
  } catch (error) {
    console.error("[portfolio/publish:error]", {
      traceId,
      uid: req.user?.id,
      message: error?.message || "Unknown error",
      stack: error?.stack,
      durationMs: Date.now() - startedAt
    });

    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;

    return res.status(statusCode).json({
      success: false,
      error: "Failed to publish portfolio",
      traceId,
      details:
        process.env.NODE_ENV === "development"
          ? error?.details || (error?.message || "Unknown error")
          : undefined
    });
  }
});

export default router;
