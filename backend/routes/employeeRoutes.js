import express from "express";
import {
  createEmployeeRequest,
  getEmployeeDirectory,
  getMyEmployeeRequests,
} from "../controllers/employeeController.js";
import { protect } from "../middleware/authMiddleware.js";
import {
  requirePermission,
  requireRole,
} from "../middleware/permissionMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(requireRole("EMPLOYEE"));

router.get("/directory", requirePermission("employeeDirectory.view"), getEmployeeDirectory);
router.get("/requests", requirePermission("employeeRequests.create"), getMyEmployeeRequests);
router.post("/requests", requirePermission("employeeRequests.create"), createEmployeeRequest);

export default router;
