import mongoose from "mongoose";

const indicatorSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    resultNode: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ResultNode",
      default: null,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    unit: {
      type: String,
      enum: ["number", "percent", "currency", "text"],
      default: "number",
    },
    direction: {
      type: String,
      enum: ["increase", "decrease", "maintain"],
      default: "increase",
    },
    baselineValue: { type: Number, default: 0 },
    baselineDate: { type: Date },
    aggregation: {
      type: String,
      enum: ["sum", "latest", "average"],
      default: "latest",
    },
    requiresEvidence: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Indicator", indicatorSchema);
