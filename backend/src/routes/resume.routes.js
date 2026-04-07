import { Router } from "express";
import { createResume, deleteResume, getResumeFile, listResumes } from "../contollers/resume.controller.js";
import { verifyFirebaseToken } from "../middlewares/auth.middleware.js";
import { resumeUpload } from "../middlewares/multer.middleware.js";

const router = Router();

router.use(verifyFirebaseToken);
router.get("/", listResumes);
router.get("/:resumeId/file", getResumeFile);
router.post("/", (req, res, next) => {
	resumeUpload.single("resumeFile")(req, res, (error) => {
		if (error) {
			next(error);
			return;
		}

		createResume(req, res, next);
	});
});
router.delete("/:resumeId", deleteResume);

export default router;
