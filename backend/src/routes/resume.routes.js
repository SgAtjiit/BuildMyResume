import { Router } from "express";
import multer from "multer";
import { createResume, deleteResume, getResumeFile, listResumes } from "../contollers/resume.firebase.controller.js";
import { verifyFirebaseToken } from "../middlewares/auth.middleware.js";
import { resumeUpload } from "../middlewares/multer.middleware.js";

const router = Router();

router.use(verifyFirebaseToken);
router.get("/", listResumes);
router.get("/:resumeId/file", getResumeFile);
router.post("/", (req, res, next) => {
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

		createResume(req, res, next);
	});
});
router.delete("/:resumeId", deleteResume);

export default router;
