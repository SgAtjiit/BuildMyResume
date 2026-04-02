import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.models.js";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createTweet = asyncHandler(async (req, res) => {
  //TODO: create tweet
  const { content } = req.body;
  if (!content) {
    throw new ApiError(401, "Content is required ");
  }
  const user = await User.findById(req.user?._id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  const tweet = await Tweet.create({
    content,
    owner: user._id,
  });
  if (!tweet) {
    throw new ApiError(401, "Error occured while creating tweet");
  }
  //here i needed to test by putting in raw and not formdata as it would have only worked if multer middleware was used
  return res
    .status(201)
    .json(new ApiResponse(200, tweet, "Tweet created successfully"));
});

const getUserTweets = asyncHandler(async (req, res) => {
  // TODO: get user tweets
  const { userId } = req.params;
  if (!userId) {
    throw new ApiError("User ID is required");
  }
  if (!isValidObjectId(userId)) {
    throw new ApiError(401, "Invalid object Id");
  }
  const tweets = await Tweet.aggregate([
    {
      $match: { owner: new mongoose.Types.ObjectId(userId) },
    },
  ]);


  return res
    .status(200)
    .json(new ApiResponse(200, tweets, "Tweets for user fetched successfully"));
});

const updateTweet = asyncHandler(async (req, res) => {
  //TODO: update tweet
  const { tweetId } = req.params;
  const { content } = req.body;
  if (!isValidObjectId(tweetId)) {
    throw new ApiError(401, "Invalid Tweet Id");
  }
  if (!content) {
    throw new ApiError(404, "No content found to update");
  }
  const updatedTweet = await Tweet.findByIdAndUpdate(
    tweetId,
    {
      $set: { content },
    },
    {
      new: true,
    }
  );

  if (!updatedTweet) {
    throw new ApiError(401, "Error occured while updating tweet");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, updatedTweet, "Tweet updated successfully"));
});

const deleteTweet = asyncHandler(async (req, res) => {
  //TODO: delete tweet
  const { tweetId } = req.params;
  if (!isValidObjectId(tweetId)) {
    throw new ApiError(404, "Invalid tweet id");
  }
  const deleted = await Tweet.findByIdAndDelete(tweetId);
  if (!deleted) {
    throw new ApiError(401, "Error while deleting tweet");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Tweet deleted successfully"));
});

export { createTweet, getUserTweets, updateTweet, deleteTweet };
