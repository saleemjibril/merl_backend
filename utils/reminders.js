import Reminder from "../models/Reminder.js";
import { notifyUsers, orgUserIds } from "./notify.js";

/** Fire any reminders whose time has arrived and notify all org users. */
export async function runDueReminders() {
  const now = new Date();
  const due = await Reminder.find({ sentAt: null, dueAt: { $lte: now } })
    .populate("project", "name")
    .populate("indicator", "name");

  for (const reminder of due) {
    try {
      const recipients = await orgUserIds(reminder.organization);
      const scope = reminder.indicator?.name
        ? `${reminder.project?.name} · ${reminder.indicator.name}`
        : reminder.project?.name || "Project";
      await notifyUsers(recipients, {
        organization: reminder.organization,
        project: reminder.project?._id || reminder.project,
        type: "reminder",
        title: "Reminder",
        body: `${scope}: ${reminder.message}`,
        link: `/projects/${reminder.project?._id || reminder.project}/data-entry`,
      });
      reminder.sentAt = new Date();
      await reminder.save();
    } catch (err) {
      console.error("Reminder dispatch failed:", err.message);
    }
  }
  return due.length;
}

/** Start a lightweight in-process scheduler (checks every minute). */
export function startReminderScheduler() {
  const tick = () => {
    runDueReminders().catch((err) =>
      console.error("Reminder scheduler error:", err.message)
    );
  };
  tick();
  return setInterval(tick, 60 * 1000);
}
