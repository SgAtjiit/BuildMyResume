import { verifyFirebaseIdToken } from "../config/firebase.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const verifyFirebaseToken = asyncHandler(async (req, _res, next) => {
  const authHeader = req.header("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (!token) {
    throw new ApiError(401, "Missing Firebase ID token");
  }

  const decoded = await verifyFirebaseIdToken(token);

  req.auth = {
    uid: decoded.uid,
    email: decoded.email || null,
    name: decoded.name || null,
    picture: decoded.picture || null,
    decodedToken: decoded
  };

  next();
});
