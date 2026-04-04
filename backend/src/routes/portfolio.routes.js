import { Router } from "express";
import {
  attachPortfolioDomain,
  generateAndDeployPortfolio,
  getPortfolioDeploymentStatus
} from "../contollers/portfolio.controller.js";
import { verifyFirebaseToken } from "../middlewares/auth.middleware.js";
import { resolveVercelAuth } from "../middlewares/vercel.middleware.js";

const router = Router();

router.use(verifyFirebaseToken);
router.use(resolveVercelAuth);
router.post("/generate", generateAndDeployPortfolio);
router.post("/deploy", generateAndDeployPortfolio);
router.get("/status/:id", getPortfolioDeploymentStatus);
router.post("/domain", attachPortfolioDomain);

export default router;
