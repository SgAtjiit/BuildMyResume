import { Router } from "express";
import {
	firebaseSignIn,
	getCurrentUser,
	handleVercelOAuthCallback,
	startVercelOAuth,
	updateCurrentUser
} from "../contollers/auth.controller.js";
import { verifyFirebaseToken } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/firebase/sign-in", firebaseSignIn);
router.get("/me", verifyFirebaseToken, getCurrentUser);
router.patch("/me", verifyFirebaseToken, updateCurrentUser);
router.get("/vercel", verifyFirebaseToken, startVercelOAuth);
router.get("/vercel/callback", handleVercelOAuthCallback);

export default router;
