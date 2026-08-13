import mongoose from "mongoose";

const LEVELS = ["goal", "outcome", "output", "activity"];

const resultNodeSchema = new mongoose.Schema(
  {
    framework: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Framework",
      required: true,
      index: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ResultNode",
      default: null,
      index: true,
    },
    level: {
      type: String,
      enum: LEVELS,
      required: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

resultNodeSchema.statics.LEVELS = LEVELS;

export default mongoose.model("ResultNode", resultNodeSchema);
