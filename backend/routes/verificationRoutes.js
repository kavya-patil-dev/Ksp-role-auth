import express from "express";
import {
  approveUserRole,
  createVerification,
  getVerifications,
  sendVerificationOtps,
  updateVerificationStatus,
  verifyUserOtps,
} from "../controllers/verificationController.js";
import { protect } from "../middleware/authMiddleware.js";
import { requirePermission, requireRole } from "../middleware/permissionMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(requireRole("SUPER_ADMIN"));

router.get("/", requirePermission("verifications.view"), getVerifications);

router.post("/", requirePermission("verifications.manage"), createVerification);

router.post(
  "/:userId/send-otps",
  requirePermission("verifications.manage"),
  sendVerificationOtps
);

router.post(
  "/:userId/verify-otps",
  requirePermission("verifications.manage"),
  verifyUserOtps
);

router.post(
  "/:userId/approve-role",
  requirePermission("verifications.manage"),
  approveUserRole
);

router.patch(
  "/:verificationId/status",
  requirePermission("verifications.manage"),
  updateVerificationStatus
);

export default router;