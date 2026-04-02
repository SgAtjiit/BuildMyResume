import { Router } from "express";
import {
	acceptTailoredResume,
	editTailoredResumeSection,
	getTailorInputs,
	tailorResume,
	tailorResumeLatex
} from "../contollers/ai.controller.js";
import { verifyFirebaseToken } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/tailor", verifyFirebaseToken, tailorResume);
router.get("/tailor-inputs", verifyFirebaseToken, getTailorInputs);
router.post("/tailor-latex", verifyFirebaseToken, tailorResumeLatex);
router.post("/tailor-latex/edit-section", verifyFirebaseToken, editTailoredResumeSection);
router.post("/tailor-latex/accept", verifyFirebaseToken, acceptTailoredResume);

export default router;
