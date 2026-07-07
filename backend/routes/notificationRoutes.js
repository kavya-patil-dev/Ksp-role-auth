import express from "express";
import {
  createNotification,
  getNotificationDetails,
  getNotifications,
  updateNotification,
} from "../controllers/notificationController.js";
import { protect } from "../middleware/authMiddleware.js";
import { requirePermission, requireRole } from "../middleware/permissionMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(requireRole("SUPER_ADMIN"));

router.get("/", requirePermission("notifications.manage"), getNotifications);
router.get("/:notificationId", requirePermission("notifications.manage"), getNotificationDetails);
router.post("/", requirePermission("notifications.manage"), createNotification);
router.put("/:notificationId", requirePermission("notifications.manage"), updateNotification);

// Delete route is intentionally not added.
// Super Admin can send and view notification details, but cannot delete sent notifications.

export default router;