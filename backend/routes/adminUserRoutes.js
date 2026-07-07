import express from "express";
import {
  createAdminUser,
  deleteAdminUser,
  getAdminPermissions,
  getAdminRoles,
  getAdminUserPermissionOverrides,
  getAdminUsers,
  updateAdminRolePermissions,
  updateAdminUserDetails,
  updateAdminUserPermissionOverrides,
  updateAdminUserRole,
  updateAdminUserStatus,
} from "../controllers/adminUserController.js";
import {
  protect,
  requirePermission,
  requireSuperAdmin,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(requireSuperAdmin);

router.get("/roles", requirePermission("roles.view"), getAdminRoles);

router.get("/permissions", requirePermission("roles.view"), getAdminPermissions);

router.put(
  "/roles/:roleId/permissions",
  requirePermission("roles.manage"),
  updateAdminRolePermissions
);

router.get("/users", requirePermission("users.view"), getAdminUsers);

router.post("/users", requirePermission("users.manage"), createAdminUser);

router.put(
  "/users/:userId",
  requirePermission("users.manage"),
  updateAdminUserDetails
);

router.patch(
  "/users/:userId/status",
  requirePermission("users.manage"),
  updateAdminUserStatus
);

router.put(
  "/users/:userId/role",
  requirePermission("users.manage"),
  updateAdminUserRole
);

router.delete(
  "/users/:userId",
  requirePermission("users.manage"),
  deleteAdminUser
);

router.get(
  "/users/:userId/permission-overrides",
  requirePermission("adminAccess.manage"),
  getAdminUserPermissionOverrides
);

router.put(
  "/users/:userId/permission-overrides",
  requirePermission("adminAccess.manage"),
  updateAdminUserPermissionOverrides
);

export default router;