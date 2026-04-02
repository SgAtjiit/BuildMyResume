import mongoose from "mongoose";

const editHistorySchema = new mongoose.Schema(
  {
    sectionName: { type: String, trim: true, default: "" },
    instruction: { type: String, trim: true, default: "" },
    latexSource: { type: String, default: "" },
    pdfPath: { type: String, trim: true, default: "" }
  },
  { _id: false, timestamps: true }
);

const tailoredResumeSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    sourceResume: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Resume",
      required: true,
      index: true
    },
    jobDescription: {
      type: String,
      required: true,
      trim: true
    },
    extractedText: {
      type: String,
      default: ""
    },
    focusedSections: {
      skillsText: { type: String, default: "" },
      projectsText: { type: String, default: "" },
      achievementsText: { type: String, default: "" },
      experienceText: { type: String, default: "" }
    },
    normalizedSkills: {
      type: [String],
      default: []
    },
    profileSnapshot: {
      name: { type: String, default: "" },
      email: { type: String, default: "" },
      linkedInUrl: { type: String, default: "" },
      githubUrl: { type: String, default: "" },
      leetCodeId: { type: String, default: "" },
      geeksForGeeksId: { type: String, default: "" },
      education: { type: [String], default: [] }
    },
    redactedText: {
      type: String,
      default: ""
    },
    extractedUrls: {
      type: [String],
      default: []
    },
    sensitiveFindings: {
      type: [String],
      default: []
    },
    latexSource: {
      type: String,
      required: true
    },
    sectionNames: {
      type: [String],
      default: []
    },
    pdfPath: {
      type: String,
      required: true,
      trim: true
    },
    texPath: {
      type: String,
      required: true,
      trim: true
    },
    compileEngine: {
      type: String,
      default: "node-latex-pdf"
    },
    status: {
      type: String,
      enum: ["draft", "accepted"],
      default: "draft"
    },
    edits: {
      type: [editHistorySchema],
      default: []
    }
  },
  { timestamps: true }
);

export const TailoredResume = mongoose.model("TailoredResume", tailoredResumeSchema);
