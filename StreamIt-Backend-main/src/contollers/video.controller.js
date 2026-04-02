import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.models.js";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const getAllVideos = asyncHandler(async (req, res) => {
  //sortType 1 :ascending -1 for descending
  let { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
  //TODO: get all videos based on query, sort, pagination
  const pipeline = [];

  if (query) {
    pipeline.push({
      $match: {
        $or: [
          { title: { $regex: query, $options: "i" } },
          { description: { $regex: query, $options: "i" } },
        ],
      },
    });
  }
  if (userId) {
    pipeline.push({
      $match: { owner: new mongoose.Types.ObjectId(userId) },
    });
  }
  if (
    sortBy &&
    !["duration", "views", "createdAt", "updatedAt"].includes(sortBy)
  ) {
    sortBy = "updatedAt";
    // console.log("Since no valid sorting criterion shifting to sort by duration")
  }
  let newsortType = Number(sortType);
  if (sortType && ![-1, 1].includes(newsortType)) {
    newsortType = 1;
    // console.log("Since no valid sort type shifting to ascending")
  }
  if (sortBy && sortType) {
    pipeline.push({
      $sort: { [sortBy]: newsortType },
    });
  }

  pipeline.push(
    {
      $skip: (page - 1) * limit,
    },
    {
      $limit: Number(limit),
    }
  );
  pipeline.unshift({
    $match: { isPublished: true },
  });

  const videos = await Video.aggregate(pipeline);
  console.log(videos);

  return res
    .status(200)
    .json(new ApiResponse(200, videos, "Videos extracted successfully"));
});

const publishAVideo = asyncHandler(async (req, res) => {
  try {
    console.log("i got hit");
    const { title, description } = req.body;
    // TODO: get video, upload to cloudinary, create video

    if (!title || !description) {
      throw new ApiError(400, "Title and description are required");
    }
    const videoFilePath = req.files?.videoFile[0]?.path;
    const thumbnailPath = req.files?.thumbnail[0]?.path;

    if (!videoFilePath) {
      throw new ApiError(404, "Video File not Found");
    }
    if (!thumbnailPath) {
      throw new ApiError(404, "Thumbnail File not Found");
    }
    const videoFile = await uploadOnCloudinary(videoFilePath);
    const thumbnail = await uploadOnCloudinary(thumbnailPath);
    if (!videoFile) {
      throw new ApiError(401, "Error while uploading the file");
    }
    if (!thumbnail) {
      throw new ApiError(401, "Error while uploading thumbnail");
    }
    // const owner = await User.findById(req.user?._id)
    const video = await Video.create({
      title: title,
      description: description,
      duration: videoFile.duration,
      isPublished: true,
      videoFile: videoFile.url,
      thumbNail: thumbnail.url,
      owner: req.user?._id,
    });
    if (!video) {
      throw new ApiError(401, "Error while publishing video");
    }
    return res
      .status(200)
      .json(new ApiResponse(200, video, "Video published Successfully"));
  } catch (error) {
    throw new ApiError(401, error.message);
  }
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: get video by id
  if (!videoId) {
    throw new ApiError(401, "No video id in params");
  }
  const video = await Video.findById(videoId);

  return res.status(200).json(new ApiResponse(200, video, "Video found by Id"));
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: update video details like title, description, thumbnail
  const { title, description } = req.body;
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(401, "Video not found");
  }
  if (title) {
    video.title = title;
  }
  if (description) {
    video.description = description;
  }
  if (req.file && req.file.path) {
    const newThumbnailPath = req.file.path;
    const newThumbnail = await uploadOnCloudinary(newThumbnailPath);
    if (!newThumbnail.url) {
      throw new ApiError(
        401,
        "Error while uploading new thumbnail file to cloudinary"
      );
    }
    video.thumbNail = newThumbnail.url;
  }
  await video.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video details updated successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: delete video
  if (!videoId) {
    throw new ApiError(401, "No video id in params");
  }
  await Video.findByIdAndDelete(videoId);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Video deleted Successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!videoId) {
    throw new ApiError(401, "No video id in params");
  }
  const video = await Video.findById(videoId);
  video.isPublished = !video.isPublished;
  await video.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(
      new ApiResponse(200, video, "Video published status toggled Successfully")
    );
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
