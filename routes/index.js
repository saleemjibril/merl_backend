import { Router } from "express";
import { protect, requireMinRole } from "../middleware/auth.js";
import * as auth from "../controllers/authController.js";
import * as org from "../controllers/orgController.js";
import * as projects from "../controllers/projectController.js";
import * as framework from "../controllers/frameworkController.js";
import * as indicators from "../controllers/indicatorController.js";
import * as periods from "../controllers/periodController.js";
import * as targets from "../controllers/targetController.js";
import * as actuals from "../controllers/actualController.js";
import * as dashboard from "../controllers/dashboardController.js";
import * as evidence from "../controllers/evidenceController.js";
import * as reports from "../controllers/reportController.js";
import * as share from "../controllers/shareController.js";
import * as templates from "../controllers/templateController.js";
import * as imports from "../controllers/importController.js";
import * as notifications from "../controllers/notificationController.js";
import * as reminders from "../controllers/reminderController.js";

const router = Router();

// Public
router.get("/health", (_req, res) =>
  res.json({ status: "success", message: "MERL API ok" })
);
router.post("/auth/signup", auth.signup);
router.post("/auth/login", auth.login);
router.get("/share/:token", share.publicShareView);
router.get("/templates", templates.listTemplates);
router.get("/templates/:key", templates.getTemplate);

// Authenticated
router.use(protect);

router.get("/auth/me", auth.me);
router.patch("/auth/me", auth.updateMe);

router.get("/org", org.getOrganization);
router.patch("/org", org.updateOrganization);
router.post("/org/invites", org.inviteMember);
router.post("/org/members", org.createMember);
router.get("/org/invites", org.listInvites);
router.patch("/org/members/:userId/role", org.updateMemberRole);
router.patch("/org/members/:userId/status", org.setMemberActive);
router.post("/org/plan", org.updatePlan);

router.get("/portfolio", dashboard.portfolioDashboard);
router.get("/review-queue", actuals.reviewQueue);

router.get("/notifications", notifications.listNotifications);
router.get("/notifications/unread-count", notifications.unreadCount);
router.post("/notifications/read-all", notifications.markAllRead);
router.patch("/notifications/:notificationId/read", notifications.markRead);

router.get("/projects", projects.listProjects);
router.post("/projects", projects.createProject);
router.get("/projects/:id", projects.getProject);
router.patch("/projects/:id", projects.updateProject);
router.delete("/projects/:id", projects.deleteProject);

router.get("/projects/:projectId/dashboard", dashboard.projectDashboard);

router.get("/projects/:projectId/framework", framework.getFrameworkTree);
router.post("/projects/:projectId/framework/nodes", framework.createNode);
router.patch(
  "/projects/:projectId/framework/nodes/:nodeId",
  framework.updateNode
);
router.delete(
  "/projects/:projectId/framework/nodes/:nodeId",
  framework.deleteNode
);
router.post("/projects/:projectId/framework/reorder", framework.reorderNodes);
router.post(
  "/projects/:projectId/framework/apply-template",
  templates.applyTemplateToProject
);

router.get("/projects/:projectId/indicators", indicators.listIndicators);
router.post("/projects/:projectId/indicators", indicators.createIndicator);
router.patch(
  "/projects/:projectId/indicators/:indicatorId",
  indicators.updateIndicator
);
router.delete(
  "/projects/:projectId/indicators/:indicatorId",
  indicators.deleteIndicator
);

router.get("/projects/:projectId/periods", periods.listPeriods);
router.post("/projects/:projectId/periods", periods.createPeriod);
router.patch("/projects/:projectId/periods/:periodId", periods.updatePeriod);
router.post("/projects/:projectId/periods/:periodId/lock", periods.lockPeriod);
router.delete("/projects/:projectId/periods/:periodId", periods.deletePeriod);

router.get("/projects/:projectId/targets", targets.listTargets);
router.put("/projects/:projectId/targets", targets.upsertTargets);

router.get("/projects/:projectId/actuals", actuals.listActuals);
router.get("/projects/:projectId/entry-matrix", actuals.getEntryMatrix);
router.post("/projects/:projectId/actuals", actuals.createEntry);
router.patch("/projects/:projectId/actuals/:actualId", actuals.updateEntry);
router.delete("/projects/:projectId/actuals/:actualId", actuals.deleteEntry);
router.post(
  "/projects/:projectId/actuals/:actualId/submit",
  actuals.submitActual
);
router.post(
  "/projects/:projectId/actuals/:actualId/review",
  actuals.reviewActual
);

router.get("/projects/:projectId/evidence", evidence.listEvidence);
router.post(
  "/projects/:projectId/evidence",
  evidence.upload.single("file"),
  evidence.uploadEvidence
);
router.get(
  "/projects/:projectId/evidence/:evidenceId/download",
  evidence.downloadEvidence
);
router.delete(
  "/projects/:projectId/evidence/:evidenceId",
  evidence.deleteEvidence
);

router.get("/projects/:projectId/reports", reports.listReports);
router.post("/projects/:projectId/reports", reports.generateReport);
router.get(
  "/projects/:projectId/reports/:reportId/download",
  reports.downloadReport
);

router.get("/projects/:projectId/share-links", share.listShareLinks);
router.post("/projects/:projectId/share-links", share.createShareLink);
router.delete(
  "/projects/:projectId/share-links/:linkId",
  share.revokeShareLink
);

router.get("/projects/:projectId/reminders", reminders.listReminders);
router.post("/projects/:projectId/reminders", reminders.createReminder);
router.delete(
  "/projects/:projectId/reminders/:reminderId",
  reminders.deleteReminder
);

router.post("/projects/:projectId/import", imports.importCsvRows);

// silence unused import lint for requireMinRole if not used above
void requireMinRole;

export default router;
