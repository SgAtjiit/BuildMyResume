import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../models/user.models.js";
import { Subscription } from "../models/subscription.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  // TODO: toggle subscription
  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid channel id");
  }
  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(404, "No user found");
  }
  if (channelId.toString() === userId.toString()) {
    throw new ApiError(400, "You cannot subscribe to your own channel");
  }

  const existingSubscription = await Subscription.findOne({
    channel: new mongoose.Types.ObjectId(channelId),
    subscriber: userId,
  });
  let subscription;
  if (existingSubscription) {
    subscription = await Subscription.findByIdAndDelete(
      existingSubscription._id
    );
  } else {
    subscription = await Subscription.create({
      channel: new mongoose.Types.ObjectId(channelId),
      subscriber: userId,
    });
  }
  if (!subscription) {
    throw new ApiError(401, "Error while toggling subscription");
  }
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        !existingSubscription ? subscription : {},
        "Subscription toggled successfully"
      )
    );
});

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!isValidObjectId(channelId)) {
    throw new ApiError(400,"Invalid channel id");
  }
  const channelSubscribers = await Subscription.aggregate([
    {
      $match: {
        channel: new mongoose.Types.ObjectId(channelId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "subscriber",
        foreignField: "_id",
        as: "subscriber",
      },
    },
    { $unwind: "$subscriber" },
    {
      $project: {
        "subscriber.password": 0,
        "subscriber.refreshToken": 0,
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        channelSubscribers,
        "Channel subscriber list fetched successfully"
      )
    );
});

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
//   const { subscriberId } = req.params;
    const subscriberId  = req.user?._id
  if (!isValidObjectId(subscriberId)) {
    throw new ApiError(400, "Invalid subscriber id");
  }
  const channelsSubscribed = await Subscription.aggregate([
    {
      $match: { subscriber: new mongoose.Types.ObjectId(subscriberId) },
    },
    {
      $lookup: {
        from: "users",
        localField: "channel",
        foreignField: "_id",
        as: "channel",
      },
    },
    { $unwind: "$channel" },
    {
      $project: {
        "subscriber.password": 0,
        "subscriber.refreshToken": 0,
      },
    },
  ]);
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        channelsSubscribed,
        "Subscribed channnels list extracted successfully"
      )
    );
});

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels };
