import { Router } from "express";
import {
	analyzeJobDescriptionEndpoint,
	extendProjectBullet,
	matchMasterDataForJd,
	generateUserProfileSummary,
	tailorResume,
	tailorResumeWithTwoStage
} from "../contollers/ai.controller.js";
import { verifyFirebaseToken } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/tailor", verifyFirebaseToken, tailorResume);
router.post("/project-bullet/extend", verifyFirebaseToken, extendProjectBullet);
router.post("/profile-summary", verifyFirebaseToken, generateUserProfileSummary);

// Two-stage prompting endpoints (NEW)
router.post("/analyze-jd", verifyFirebaseToken, analyzeJobDescriptionEndpoint);
router.post("/match-master-data", verifyFirebaseToken, matchMasterDataForJd);
router.post("/tailor-two-stage", verifyFirebaseToken, tailorResumeWithTwoStage);

export default router;
