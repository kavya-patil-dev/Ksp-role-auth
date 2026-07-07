import express from "express";
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../controllers/notificationController.js";
import { protect, requirePermission } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/my", requirePermission("notifications.view"), getMyNotifications);
router.patch("/read-all", requirePermission("notifications.view"), markAllNotificationsRead);
router.patch("/:notificationId/read", requirePermission("notifications.view"), markNotificationRead);

export default router;
