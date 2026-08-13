import Notification from "../models/Notification.js";
import User from "../models/User.js";

/** Create the same notification for many users at once. */
export async function notifyUsers(userIds, payload) {
  const ids = [...new Set((userIds || []).map((u) => String(u)))].filter(Boolean);
  if (ids.length === 0) return;
  const docs = ids.map((user) => ({ user, ...payload }));
  try {
    await Notification.insertMany(docs);
  } catch (err) {
    console.error("Notification create failed:", err.message);
  }
}

/** All active users in an organization. */
export async function orgUserIds(orgId) {
  const users = await User.find({ organization: orgId, isActive: true }).select("_id");
  return users.map((u) => u._id);
}

/** Reviewers (owner/coordinator) in an organization. */
export async function orgReviewerIds(orgId) {
  const users = await User.find({
    organization: orgId,
    isActive: true,
    role: { $in: ["owner", "coordinator"] },
  }).select("_id");
  return users.map((u) => u._id);
}
