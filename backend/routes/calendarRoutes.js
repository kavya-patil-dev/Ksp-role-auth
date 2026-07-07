import express from "express";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  getCalendarEvents,
  updateCalendarEvent,
} from "../controllers/calendarController.js";
import { protect } from "../middleware/authMiddleware.js";
import { requirePermission, requireRole } from "../middleware/permissionMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(requireRole("SUPER_ADMIN"));

router.get("/", requirePermission("calendar.view"), getCalendarEvents);
router.post("/", requirePermission("calendar.manage"), createCalendarEvent);
router.put("/:eventId", requirePermission("calendar.manage"), updateCalendarEvent);
router.delete("/:eventId", requirePermission("calendar.manage"), deleteCalendarEvent);

export default router;
