import mongoose from "mongoose";

const frameworkSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      unique: true,
      index: true,
    },
    name: { type: String, default: "Results framework" },
    type: {
      type: String,
      enum: ["logframe", "custom"],
      default: "logframe",
    },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

export default mongoose.model("Framework", frameworkSchema);
