import express from "express";
import { getAdminAuditLogs } from "../controllers/adminAuditController.js";
import { protect } from "../middleware/authMiddleware.js";
import {
  requirePermission,
  requireRole,
} from "../middleware/permissionMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(requireRole("SUPER_ADMIN"));

router.get("/", requirePermission("auditLogs.view"), getAdminAuditLogs);

export default router;
