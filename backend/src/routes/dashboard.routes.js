import { Router } from "express";
import { getDashboardSummary } from "../contollers/dashboard.controller.js";
import { verifyFirebaseToken } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/summary", verifyFirebaseToken, getDashboardSummary);

export default router;
