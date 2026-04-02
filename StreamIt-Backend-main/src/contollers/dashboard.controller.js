import mongoose from "mongoose";
import { Video } from "../models/video.models.js";
import { Subscription } from "../models/subscription.models.js";
import { Like } from "../models/like.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * GET CHANNEL STATS (OPTIMIZED)
 */
const getChannelStats = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new ApiError(401, "Unauthorized request");
  }

  // Video count + views in single aggregation
  const [videoStats] = await Video.aggregate([
    { $match: { owner: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalVideos: { $sum: 1 },
        totalViews: { $sum: "$views" },
      },
    },
  ]);

  // Subscribers count
  const totalSubscribers = await Subscription.countDocuments({
    channel: userId,
  });

  // Likes count on user's videos
  const [likesStats] = await Like.aggregate([
    {
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "video",
      },
    },
    { $unwind: "$video" },
    { $match: { "video.owner": new mongoose.Types.ObjectId(userId) } },
    { $count: "totalLikes" },
  ]);

  const stats = {
    totalVideos: videoStats?.totalVideos || 0,
    totalViews: videoStats?.totalViews || 0,
    totalSubscribers,
    totalLikes: likesStats?.totalLikes || 0,
  };

  return res
    .status(200)
    .json(new ApiResponse(200, stats, "Channel stats fetched successfully"));
});

/**
 * GET CHANNEL VIDEOS
 * - aggregatePaginate
 * - separate options object
 */
const getChannelVideos = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new ApiError(401, "Unauthorized request");
  }

  const { page = 1, limit = 10 } = req.query;

  // pagination options
  const options = {
    page: Number(page),
    limit: Number(limit),
    sort: { createdAt: -1 },
  };

  // aggregation pipeline
  const pipeline = [
    { $match: { owner: new mongoose.Types.ObjectId(userId) } },
    {
      $project: {
        title: 1,
        thumbnail: 1,
        views: 1,
        createdAt: 1,
      },
    },
  ];

  const videos = await Video.aggregatePaginate(
    Video.aggregate(pipeline),
    options
  );

  return res
    .status(200)
    .json(new ApiResponse(200, videos, "Channel videos fetched successfully"));
});

export { getChannelStats, getChannelVideos };
