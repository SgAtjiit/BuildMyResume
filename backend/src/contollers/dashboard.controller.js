import { Resume } from "../models/resume.models.js";
import { findUserByFirebaseUid } from "../services/user.service.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getDashboardSummary = asyncHandler(async (req, res) => {
  const user = await findUserByFirebaseUid(req.auth.uid);

  const resumeCount = await Resume.countDocuments({ owner: user._id });

  const recentResumes = await Resume.find({ owner: user._id })
    .sort({ updatedAt: -1 })
    .limit(5)
    .select("title updatedAt");

  const recentActivity = recentResumes.map((resume) => ({
    action: "Updated resume",
    target: resume.title,
    time: resume.updatedAt
  }));

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        stats: {
          resumes: resumeCount,
          tailoredVersions: resumeCount,
          portfolios: 0,
          viewsThisWeek: 0
        },
        recentActivity
      },
      "Dashboard summary fetched successfully"
    )
  );
});
