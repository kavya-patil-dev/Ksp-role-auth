import express from "express";
import {
  createWorker,
  deleteWorker,
  getWorkerById,
  getWorkers,
  updateWorker,
  updateWorkerStatus,
} from "../controllers/workerController.js";
import {
  protect,
  requirePermission,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/", requirePermission("workers.view"), getWorkers);

router.get("/:workerId", requirePermission("workers.view"), getWorkerById);

router.post("/", requirePermission("workers.manage"), createWorker);

router.put("/:workerId", requirePermission("workers.manage"), updateWorker);

router.patch(
  "/:workerId/status",
  requirePermission("workers.manage"),
  updateWorkerStatus
);

router.delete("/:workerId", requirePermission("workers.manage"), deleteWorker);

export default router;