import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/like.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleVideoLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: toggle like on video
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid Video id");
  }
  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(400,"Invalid user id");
  }
  const existingLike = await Like.findOne({
    video: videoId,
    likedBy: userId,
  });

  console.log(existingLike);
  let like;
  if (!existingLike) {
    like = await Like.create({
      video: videoId,
      likedBy: userId,
    });
    console.log(like);
  } else {
    like = await Like.findByIdAndDelete(existingLike._id);
  }
  if (!like) {
    throw new ApiError(401, "Error while toggling like for video");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        !existingLike ? like : {},
        "Like toggled for video successfully"
      )
    );
});

const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid comment id");
  }
  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(400,"Invalid user id");
  }
  const existingLike = await Like.findOne({
    comment: commentId,
    likedBy: userId,
  });

  //   console.log(existingLike);
  let like;
  if (!existingLike) {
    like = await Like.create({
      comment: commentId,
      likedBy: userId,
    });
    // console.log(like);
  } else {
    like = await Like.findByIdAndDelete(existingLike._id);
  }
  if (!like) {
    throw new ApiError(401, "Error while toggling like for comment");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        !existingLike ? like : {},
        "Like toggled for comment successfully"
      )
    );
});

const toggleTweetLike = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid tweet id");
  }
  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(400,"Invalid user id");
  }
  const existingLike = await Like.findOne({
    tweet: tweetId,
    likedBy: userId,
  });

  //   console.log(existingLike);
  let like;
  if (!existingLike) {
    like = await Like.create({
      tweet: tweetId,
      likedBy: userId,
    });
    // console.log(like);
  } else {
    like = await Like.findByIdAndDelete(existingLike._id);
  }
  if (!like) {
    throw new ApiError(401, "Error while toggling like for tweet");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        !existingLike ? like : {},
        "Like toggled for comment successfully"
      )
    );
});

const getLikedVideos = asyncHandler(async (req, res) => {
  //TODO: get all liked videos
  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(401, "User id not found");
  }
  const likedVideos = await Like.aggregate([
    {
      $match: {
        likedBy: new mongoose.Types.ObjectId(userId),
        video: { $exists: true },
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "video",
      },
    },
    { $unwind: "$video" },
  ]);

//   console.log(likedVideos);
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        likedVideos,
        "Liked videos for user fetched successfully"
      )
    );
});

export { toggleCommentLike, toggleTweetLike, toggleVideoLike, getLikedVideos };
