import mongoose from "mongoose";
import crypto from "crypto";

const shareLinkSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    token: { type: String, required: true, unique: true },
    label: { type: String, default: "Donor view" },
    period: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReportingPeriod",
      default: null,
    },
    expiresAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

shareLinkSchema.statics.createToken = () => crypto.randomBytes(24).toString("hex");

export default mongoose.model("ShareLink", shareLinkSchema);
