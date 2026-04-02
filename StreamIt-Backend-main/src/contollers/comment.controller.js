import mongoose, { isValidObjectId } from "mongoose";
import { Comment } from "../models/comment.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.models.js";

const getVideoComments = asyncHandler(async (req, res) => {
  //TODO: get all comments for a video
  const { videoId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  if (!isValidObjectId(videoId)) {
    throw new ApiError("Invalid video id");
  }
  const options = {
    page,
    limit,
  };

  const comments = await Comment.aggregatePaginate(
    [
      {
        $match: { video: new mongoose.Types.ObjectId(videoId) },
      },
    ],
    options
  );

  //   console.log(comments)

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        comments,
        "Comments for video fetched successfully"
      )
    );
});

const addComment = asyncHandler(async (req, res) => {
  // TODO: add a comment to a video
  const { content } = req.body;
  if (!content) {
    throw new ApiError(401, "Content for comment is  required");
  }
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) {
    throw new ApiError(401, "Invalid video id");
  }
  //   console.log("User id is :",userId)
  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(401, "User not found");
  }
  const comment = await Comment.create({
    content,
    video: new mongoose.Types.ObjectId(videoId),
    // owner:new mongoose.Types.ObjectId(userId)
    owner: userId,
  });

  if (!comment) {
    throw new ApiError(401, "Error while adding comment to video");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, comment, "Comment added to video successfully"));
});

const updateComment = asyncHandler(async (req, res) => {
  // TODO: update a comment
  const { commentId } = req.params;
  if (!isValidObjectId(commentId)) {
    throw new ApiError(401, "Invalid comment id");
  }
  const { content } = req.body;
  if (!content) {
    throw new ApiError(400, "Content is required to update");
  }
  const comment = await Comment.findByIdAndUpdate(
    commentId,
    {
      $set: {
        content,
      },
    },
    {
      new: true,
    }
  );
  if (!comment) {
    throw new ApiError("Error while updating the comment");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, comment, "Comment updated successfully"));
});

const deleteComment = asyncHandler(async (req, res) => {
  // TODO: delete a comment
  const { commentId } = req.params;
  if (!isValidObjectId(commentId)) {
    throw new ApiError(401, "Invalid comment id");
  }
  const deleted = await Comment.findByIdAndDelete(commentId);
  if (!deleted) {
    throw new ApiError(401, "Error while deleting comment");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Comment Deleted Successfully"));
});

export { getVideoComments, addComment, updateComment, deleteComment };
