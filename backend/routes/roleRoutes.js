import express from "express";
import {
  getRoles,
  getUsers,
  assignRoleToUser,
} from "../controllers/roleController.js";
import { protect } from "../middleware/authMiddleware.js";
import { requirePermission } from "../middleware/permissionMiddleware.js";

const router = express.Router();

router.get("/", protect, requirePermission("roles.manage"), getRoles);

router.get(
  "/users",
  protect,
  requirePermission("roles.manage"),
  getUsers
);

router.put(
  "/users/:userId/assign-role",
  protect,
  requirePermission("roles.manage"),
  assignRoleToUser
);

export default router;