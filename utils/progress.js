/** Calendar-day difference from today to end date (local). */
export function getDeadlineCountdown(isoOrDate) {
  if (!isoOrDate) return null;
  const end = new Date(isoOrDate);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diffDays = Math.round((end.getTime() - start.getTime()) / 86400000);
  if (diffDays > 0) return { kind: "remaining", days: diffDays };
  if (diffDays === 0) return { kind: "today", days: 0 };
  return { kind: "overdue", days: Math.abs(diffDays) };
}

export function computeProgress({
  baseline = 0,
  target,
  actual,
  direction = "increase",
}) {
  const t = Number(target);
  const a = actual == null || actual === "" ? null : Number(actual);
  const b = Number(baseline) || 0;

  if (!Number.isFinite(t)) {
    return { percent: null, status: a == null ? "missing" : "reported" };
  }
  if (a == null || !Number.isFinite(a)) {
    return { percent: 0, status: "missing" };
  }

  let percent;
  if (direction === "decrease") {
    const span = b - t;
    percent = span === 0 ? (a <= t ? 100 : 0) : ((b - a) / span) * 100;
  } else if (direction === "maintain") {
    const tol = Math.abs(t) * 0.05 || 1;
    percent = Math.abs(a - t) <= tol ? 100 : Math.max(0, 100 - (Math.abs(a - t) / tol) * 50);
  } else {
    const span = t - b;
    percent = span === 0 ? (a >= t ? 100 : 0) : ((a - b) / span) * 100;
  }

  percent = Math.max(0, Math.min(150, Math.round(percent * 10) / 10));

  let status = "on_track";
  if (percent < 50) status = "off_track";
  else if (percent < 80) status = "at_risk";
  else if (percent >= 100) status = "achieved";

  return { percent, status };
}

/**
 * Roll many contributor entries (IndicatorActual docs) for one indicator+period
 * into a single reported figure. Only APPROVED entries count toward the target —
 * draft/submitted values are tracked separately as "pending" until reviewed.
 */
export function aggregateEntries(entries = []) {
  const hasVal = (e) => e.value !== null && e.value !== undefined;
  const approved = entries.filter((e) => e.status === "approved" && hasVal(e));
  const submitted = entries.filter((e) => e.status === "submitted" && hasVal(e));

  const value = approved.length
    ? approved.reduce((sum, e) => sum + Number(e.value || 0), 0)
    : null;
  const pendingValue = submitted.length
    ? submitted.reduce((sum, e) => sum + Number(e.value || 0), 0)
    : null;

  let status = null;
  if (entries.length > 0) {
    if (entries.some((e) => e.status === "submitted")) status = "submitted";
    else if (entries.some((e) => e.status === "approved")) status = "approved";
    else if (entries.every((e) => e.status === "rejected")) status = "rejected";
    else status = "draft";
  }

  const narrative = approved
    .map((e) => e.narrative)
    .filter(Boolean)
    .join("\n");

  return {
    value,
    pendingValue,
    status,
    narrative,
    count: entries.length,
    counts: {
      draft: entries.filter((e) => e.status === "draft").length,
      submitted: entries.filter((e) => e.status === "submitted").length,
      approved: entries.filter((e) => e.status === "approved").length,
      rejected: entries.filter((e) => e.status === "rejected").length,
    },
  };
}

/** Build indicatorId -> aggregate map from a flat list of entries. */
export function aggregateByIndicator(entries = []) {
  const grouped = {};
  for (const e of entries) {
    const key = String(e.indicator);
    (grouped[key] = grouped[key] || []).push(e);
  }
  const map = {};
  for (const [key, list] of Object.entries(grouped)) {
    map[key] = aggregateEntries(list);
  }
  return map;
}

export function periodLifecycleStatus(period, now = new Date()) {
  if (period.status === "locked") return "locked";
  const start = new Date(period.startDate);
  const end = new Date(period.endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  if (now < start) return "upcoming";
  if (now > end) return "closed";
  return "open";
}
