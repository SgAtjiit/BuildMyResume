import { Router } from "express";
import multer from "multer";
import {
	analyzeJobDescriptionEndpoint,
	generateDescriptionBullets,
	parseResumeForOnboarding,
	extendProjectBullet,
	matchMasterDataForJd,
	generateUserProfileSummary,
	tailorResume,
	tailorResumeWithTwoStage
} from "../contollers/ai.controller.js";
import { verifyFirebaseToken } from "../middlewares/auth.middleware.js";
import { resumeUpload } from "../middlewares/multer.middleware.js";

const router = Router();

router.post("/tailor", verifyFirebaseToken, tailorResume);
router.post("/project-bullet/extend", verifyFirebaseToken, extendProjectBullet);
router.post("/profile-summary", verifyFirebaseToken, generateUserProfileSummary);
router.post("/description-bullets", verifyFirebaseToken, generateDescriptionBullets);
router.post("/onboarding/parse-resume", verifyFirebaseToken, (req, res, next) => {
	resumeUpload.single("resumeFile")(req, res, (error) => {
		if (error) {
			if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
				return res.status(413).json({
					success: false,
					message: "Resume file must not exceed 25 MB.",
					statusCode: 413
				});
			}
			next(error);
			return;
		}

		parseResumeForOnboarding(req, res, next);
	});
});

// Two-stage prompting endpoints (NEW)
router.post("/analyze-jd", verifyFirebaseToken, analyzeJobDescriptionEndpoint);
router.post("/match-master-data", verifyFirebaseToken, matchMasterDataForJd);
router.post("/tailor-two-stage", verifyFirebaseToken, tailorResumeWithTwoStage);

export default router;
