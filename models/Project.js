import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    sector: {
      type: String,
      enum: ["agriculture", "health", "education", "other"],
      default: "other",
    },
    location: { type: String, default: "" },
    state: { type: String, default: "" },
    lga: { type: String, default: "" },
    startDate: { type: Date },
    endDate: { type: Date },
    status: {
      type: String,
      enum: ["active", "archived"],
      default: "active",
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    templateKey: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Project", projectSchema);
