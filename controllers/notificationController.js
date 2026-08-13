import Notification from "../models/Notification.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/AppError.js";

export const listNotifications = catchAsync(async (req, res) => {
  const items = await Notification.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(100);
  const unread = await Notification.countDocuments({
    user: req.user._id,
    read: false,
  });
  res.json({ status: "success", data: { notifications: items, unread } });
});

export const unreadCount = catchAsync(async (req, res) => {
  const unread = await Notification.countDocuments({
    user: req.user._id,
    read: false,
  });
  res.json({ status: "success", data: { unread } });
});

export const markRead = catchAsync(async (req, res) => {
  const item = await Notification.findOne({
    _id: req.params.notificationId,
    user: req.user._id,
  });
  if (!item) throw new AppError("Notification not found", 404);
  item.read = true;
  await item.save();
  res.json({ status: "success", data: { notification: item } });
});

export const markAllRead = catchAsync(async (req, res) => {
  await Notification.updateMany(
    { user: req.user._id, read: false },
    { $set: { read: true } }
  );
  res.json({ status: "success", message: "All notifications marked read" });
});
