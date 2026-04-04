import { VercelService } from "../services/vercel.service.js";
import { findUserByFirebaseUid } from "../services/user.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const resolveVercelAuth = asyncHandler(async (req, _res, next) => {
  const user = await findUserByFirebaseUid(req.auth.uid);
  let vercelAuth;

  try {
    vercelAuth = await VercelService.resolveAuth(user);
  } catch (error) {
    if ((error.statusCode === 401 || error.statusCode === 403) && user.vercelConnection?.encryptedAccessToken) {
      user.vercelConnection = {
        encryptedAccessToken: "",
        tokenIv: "",
        tokenAuthTag: "",
        teamId: "",
        scope: "",
        connectedAt: null
      };
      await user.save();
    }

    throw error;
  }

  req.currentUser = user;
  req.vercelAuth = vercelAuth;

  next();
});
