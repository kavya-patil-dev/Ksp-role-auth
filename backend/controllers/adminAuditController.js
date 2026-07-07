import prisma from "../config/prisma.js";

const formatAuditLog = (log) => ({
  id: log.id,
  action: log.action,
  module: log.module,
  entityType: log.entityType,
  entityId: log.entityId,
  targetUserId: log.targetUserId,
  title: log.title,
  description: log.description,
  oldData: log.oldData,
  newData: log.newData,
  actor: log.actor
    ? {
        id: log.actor.id,
        name: log.actor.name,
        email: log.actor.email,
        role: log.actor.role?.name || null,
      }
    : null,
  targetUser: log.targetUser
    ? {
        id: log.targetUser.id,
        name: log.targetUser.name,
        email: log.targetUser.email,
        role: log.targetUser.role?.name || null,
      }
    : null,
  createdAt: log.createdAt,
});

export const getAdminAuditLogs = async (req, res) => {
  try {
    const logs = await prisma.adminAuditLog.findMany({
      take: 100,
      include: {
        actor: {
          include: {
            role: true,
          },
        },
        targetUser: {
          include: {
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      logs: logs.map(formatAuditLog),
    });
  } catch (error) {
    console.error("Get admin audit logs error:", error);
    return res.status(500).json({ message: "Failed to fetch admin audit logs" });
  }
};
