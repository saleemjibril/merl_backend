import mongoose from "mongoose";

const evidenceSchema = new mongoose.Schema(
  {
    indicatorActual: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "IndicatorActual",
      required: true,
      index: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    fileName: { type: String, required: true },
    storedName: { type: String, required: true },
    mimeType: { type: String, default: "application/octet-stream" },
    size: { type: Number, default: 0 },
    caption: { type: String, default: "" },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model("Evidence", evidenceSchema);
