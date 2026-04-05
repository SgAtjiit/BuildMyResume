import { Router } from "express";
import {
  attachPortfolioDomain,
  generateAndDeployPortfolio,
  getPortfolioDeploymentStatus,
  exportPortfolioToGitHub
} from "../contollers/portfolio.controller.js";
import { verifyFirebaseToken } from "../middlewares/auth.middleware.js";
import { resolveVercelAuth } from "../middlewares/vercel.middleware.js";

const router = Router();

router.use(verifyFirebaseToken);
router.post("/github", exportPortfolioToGitHub);

router.post("/generate", resolveVercelAuth, generateAndDeployPortfolio);
router.post("/deploy", resolveVercelAuth, generateAndDeployPortfolio);
router.get("/status/:id", resolveVercelAuth, getPortfolioDeploymentStatus);
router.post("/domain", resolveVercelAuth, attachPortfolioDomain);

export default router;
