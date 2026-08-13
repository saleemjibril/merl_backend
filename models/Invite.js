import mongoose from "mongoose";
import crypto from "crypto";

const inviteSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: {
      type: String,
      enum: ["coordinator", "contributor", "viewer"],
      default: "contributor",
    },
    token: { type: String, required: true, unique: true },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    acceptedAt: { type: Date, default: null },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 86400000),
    },
  },
  { timestamps: true }
);

inviteSchema.statics.createToken = () => crypto.randomBytes(24).toString("hex");

export default mongoose.model("Invite", inviteSchema);
