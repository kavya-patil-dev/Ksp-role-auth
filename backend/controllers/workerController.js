import prisma from "../config/prisma.js";

const VALID_WORKER_STATUS = ["ACTIVE", "INACTIVE"];

const normalizeText = (value) => {
  return typeof value === "string" ? value.trim() : "";
};

const normalizeMobile = (value) => {
  return typeof value === "string" ? value.trim() : "";
};

const normalizeDailyWage = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numberValue = Number(value);

  if (Number.isNaN(numberValue) || numberValue < 0) {
    return null;
  }

  return numberValue;
};

const formatWorker = (worker) => {
  const status = worker.status || "INACTIVE";

  return {
    id: worker.id,
    name: worker.name,
    mobile: worker.mobile,
    address: worker.address,
    skillType: worker.skillType,
    dailyWage: worker.dailyWage,
    status,
    isActive: status === "ACTIVE",
    createdById: worker.createdById,
    updatedById: worker.updatedById,
    createdAt: worker.createdAt,
    updatedAt: worker.updatedAt,
  };
};

const getWorkerSnapshot = (worker) => {
  if (!worker) {
    return null;
  }

  return {
    id: worker.id,
    name: worker.name,
    mobile: worker.mobile,
    address: worker.address,
    skillType: worker.skillType,
    dailyWage: worker.dailyWage,
    status: worker.status,
    createdById: worker.createdById,
    updatedById: worker.updatedById,
    createdAt: worker.createdAt,
    updatedAt: worker.updatedAt,
  };
};

const createAuditLog = async ({
  actorId,
  action,
  entityId,
  title,
  description,
  oldData = null,
  newData = null,
}) => {
  try {
    await prisma.adminAuditLog.create({
      data: {
        actorId,
        action,
        module: "Workers",
        entityType: "Worker",
        entityId,
        title,
        description,
        oldData,
        newData,
      },
    });
  } catch (error) {
    console.error("Worker audit log creation failed:", error);
  }
};

const notifySuperAdminsForAdminWorkerChange = async ({
  actor,
  actionTitle,
  description,
  workerId,
  oldData = null,
  newData = null,
}) => {
  try {
    /*
      Only Admin actions should notify Super Admin.
      If Super Admin himself changes worker, audit log is enough.
    */
    if (actor?.role !== "ADMIN") {
      return;
    }

    const superAdmins = await prisma.user.findMany({
      where: {
        status: "ACTIVE",
        role: {
          name: "SUPER_ADMIN",
        },
      },
      select: {
        id: true,
      },
    });

    if (!superAdmins.length) {
      return;
    }

    const notification = await prisma.notification.create({
      data: {
        title: actionTitle,
        message: description,
        audience: "SUPER_ADMIN",
        priority: "HIGH",
        createdById: actor.id,
      },
    });

    await prisma.userNotification.createMany({
      data: superAdmins.map((superAdmin) => {
        return {
          userId: superAdmin.id,
          notificationId: notification.id,
        };
      }),
      skipDuplicates: true,
    });

    /*
      Also keep one detailed audit log already created separately.
      Notification message is for dashboard alert.
    */
  } catch (error) {
    console.error("Super Admin worker notification failed:", error);
  }
};

const createWorkerAuditAndNotification = async ({
  req,
  action,
  workerId,
  title,
  description,
  oldData = null,
  newData = null,
}) => {
  await createAuditLog({
    actorId: req.user.id,
    action,
    entityId: workerId,
    title,
    description,
    oldData,
    newData,
  });

  await notifySuperAdminsForAdminWorkerChange({
    actor: req.user,
    actionTitle: title,
    description,
    workerId,
    oldData,
    newData,
  });
};

export const getWorkers = async (req, res) => {
  try {
    const { search = "", status = "", skillType = "" } = req.query;

    const where = {};

    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
          },
        },
        {
          mobile: {
            contains: search,
          },
        },
        {
          address: {
            contains: search,
          },
        },
        {
          skillType: {
            contains: search,
          },
        },
      ];
    }

    if (status) {
      const normalizedStatus = status.toUpperCase();

      if (VALID_WORKER_STATUS.includes(normalizedStatus)) {
        where.status = normalizedStatus;
      }
    }

    if (skillType) {
      where.skillType = {
        contains: skillType,
      };
    }

    const workers = await prisma.worker.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      workers: workers.map(formatWorker),
    });
  } catch (error) {
    console.error("Get workers error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch workers",
    });
  }
};

export const getWorkerById = async (req, res) => {
  try {
    const { workerId } = req.params;

    const worker = await prisma.worker.findUnique({
      where: {
        id: workerId,
      },
    });

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: "Worker not found",
      });
    }

    return res.status(200).json({
      success: true,
      worker: formatWorker(worker),
    });
  } catch (error) {
    console.error("Get worker by id error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch worker",
    });
  }
};

export const createWorker = async (req, res) => {
  try {
    const { name, mobile, address, skillType, dailyWage, status = "ACTIVE" } =
      req.body;

    const trimmedName = normalizeText(name);
    const trimmedMobile = normalizeMobile(mobile);
    const trimmedAddress = normalizeText(address);
    const trimmedSkillType = normalizeText(skillType);
    const normalizedStatus = normalizeText(status).toUpperCase() || "ACTIVE";
    const normalizedDailyWage = normalizeDailyWage(dailyWage);

    if (!trimmedName) {
      return res.status(400).json({
        success: false,
        message: "Worker name is required",
      });
    }

    if (!VALID_WORKER_STATUS.includes(normalizedStatus)) {
      return res.status(400).json({
        success: false,
        message: "Worker status must be ACTIVE or INACTIVE",
      });
    }

    if (
      dailyWage !== undefined &&
      dailyWage !== null &&
      dailyWage !== "" &&
      normalizedDailyWage === null
    ) {
      return res.status(400).json({
        success: false,
        message: "Daily wage must be a valid positive number",
      });
    }

    const worker = await prisma.worker.create({
      data: {
        name: trimmedName,
        mobile: trimmedMobile || null,
        address: trimmedAddress || null,
        skillType: trimmedSkillType || null,
        dailyWage: normalizedDailyWage,
        status: normalizedStatus,
        createdById: req.user.id,
        updatedById: req.user.id,
      },
    });

    const newData = getWorkerSnapshot(worker);

    const description = `${req.user.name} (${req.user.role}) created worker ${worker.name}. Mobile: ${
      worker.mobile || "NA"
    }, Skill: ${worker.skillType || "NA"}, Daily Wage: ${
      worker.dailyWage ?? "NA"
    }, Status: ${worker.status}.`;

    await createWorkerAuditAndNotification({
      req,
      action: "CREATE",
      workerId: worker.id,
      title: "Worker created",
      description,
      newData,
    });

    return res.status(201).json({
      success: true,
      message: "Worker created successfully",
      worker: formatWorker(worker),
    });
  } catch (error) {
    console.error("Create worker error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create worker",
    });
  }
};

export const updateWorker = async (req, res) => {
  try {
    const { workerId } = req.params;
    const { name, mobile, address, skillType, dailyWage, status } = req.body;

    const existingWorker = await prisma.worker.findUnique({
      where: {
        id: workerId,
      },
    });

    if (!existingWorker) {
      return res.status(404).json({
        success: false,
        message: "Worker not found",
      });
    }

    const trimmedName = normalizeText(name);
    const trimmedMobile = normalizeMobile(mobile);
    const trimmedAddress = normalizeText(address);
    const trimmedSkillType = normalizeText(skillType);
    const normalizedDailyWage = normalizeDailyWage(dailyWage);

    if (!trimmedName) {
      return res.status(400).json({
        success: false,
        message: "Worker name is required",
      });
    }

    if (
      dailyWage !== undefined &&
      dailyWage !== null &&
      dailyWage !== "" &&
      normalizedDailyWage === null
    ) {
      return res.status(400).json({
        success: false,
        message: "Daily wage must be a valid positive number",
      });
    }

    let normalizedStatus = existingWorker.status;

    if (typeof status === "string" && status.trim()) {
      normalizedStatus = status.trim().toUpperCase();

      if (!VALID_WORKER_STATUS.includes(normalizedStatus)) {
        return res.status(400).json({
          success: false,
          message: "Worker status must be ACTIVE or INACTIVE",
        });
      }
    }

    const oldData = getWorkerSnapshot(existingWorker);

    const worker = await prisma.worker.update({
      where: {
        id: workerId,
      },
      data: {
        name: trimmedName,
        mobile: trimmedMobile || null,
        address: trimmedAddress || null,
        skillType: trimmedSkillType || null,
        dailyWage: normalizedDailyWage,
        status: normalizedStatus,
        updatedById: req.user.id,
      },
    });

    const newData = getWorkerSnapshot(worker);

    const description = `${req.user.name} (${req.user.role}) updated worker ${worker.name}. Previous data: ${JSON.stringify(
      oldData
    )}. New data: ${JSON.stringify(newData)}.`;

    await createWorkerAuditAndNotification({
      req,
      action: "UPDATE",
      workerId: worker.id,
      title: "Worker updated",
      description,
      oldData,
      newData,
    });

    return res.status(200).json({
      success: true,
      message: "Worker updated successfully",
      worker: formatWorker(worker),
    });
  } catch (error) {
    console.error("Update worker error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update worker",
    });
  }
};

export const updateWorkerStatus = async (req, res) => {
  try {
    const { workerId } = req.params;
    const { isActive, status } = req.body;

    const existingWorker = await prisma.worker.findUnique({
      where: {
        id: workerId,
      },
    });

    if (!existingWorker) {
      return res.status(404).json({
        success: false,
        message: "Worker not found",
      });
    }

    let newStatus = null;

    if (typeof isActive === "boolean") {
      newStatus = isActive ? "ACTIVE" : "INACTIVE";
    }

    if (typeof status === "string") {
      const normalizedStatus = status.toUpperCase();

      if (VALID_WORKER_STATUS.includes(normalizedStatus)) {
        newStatus = normalizedStatus;
      }
    }

    if (!newStatus) {
      return res.status(400).json({
        success: false,
        message: "Send isActive as true/false or status as ACTIVE/INACTIVE.",
      });
    }

    const oldData = getWorkerSnapshot(existingWorker);

    const worker = await prisma.worker.update({
      where: {
        id: workerId,
      },
      data: {
        status: newStatus,
        updatedById: req.user.id,
      },
    });

    const newData = getWorkerSnapshot(worker);

    const description = `${req.user.name} (${req.user.role}) changed worker ${worker.name} status from ${existingWorker.status} to ${newStatus}.`;

    await createWorkerAuditAndNotification({
      req,
      action: "STATUS_CHANGE",
      workerId: worker.id,
      title: "Worker status changed",
      description,
      oldData,
      newData,
    });

    return res.status(200).json({
      success: true,
      message:
        newStatus === "ACTIVE"
          ? "Worker activated successfully"
          : "Worker deactivated successfully",
      worker: formatWorker(worker),
    });
  } catch (error) {
    console.error("Update worker status error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update worker status",
    });
  }
};

export const deleteWorker = async (req, res) => {
  try {
    const { workerId } = req.params;

    const existingWorker = await prisma.worker.findUnique({
      where: {
        id: workerId,
      },
    });

    if (!existingWorker) {
      return res.status(404).json({
        success: false,
        message: "Worker not found",
      });
    }

    const oldData = getWorkerSnapshot(existingWorker);

    await prisma.worker.delete({
      where: {
        id: workerId,
      },
    });

    const description = `${req.user.name} (${req.user.role}) deleted worker ${existingWorker.name}. Deleted data: ${JSON.stringify(
      oldData
    )}.`;

    await createWorkerAuditAndNotification({
      req,
      action: "DELETE",
      workerId,
      title: "Worker deleted",
      description,
      oldData,
    });

    return res.status(200).json({
      success: true,
      message: "Worker deleted successfully",
    });
  } catch (error) {
    console.error("Delete worker error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete worker",
    });
  }
};