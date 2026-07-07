import prisma from "../config/prisma.js";

const roleToAudience = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  EMPLOYEE: "EMPLOYEE",
  USER: "USER",
};

const priorityToDb = {
  Low: "LOW",
  Normal: "NORMAL",
  Important: "HIGH",
  High: "HIGH",
  Urgent: "URGENT",
  LOW: "LOW",
  NORMAL: "NORMAL",
  HIGH: "HIGH",
  URGENT: "URGENT",
};

const uniqueValues = (values) => Array.from(new Set(values.filter(Boolean)));

const createNotificationForRecipients = async ({
  userIds,
  title,
  message,
  audience,
  priority = "HIGH",
  createdById = null,
}) => {
  try {
    const recipientIds = uniqueValues(userIds || []);

    if (!recipientIds.length || !title || !message || !audience) {
      return null;
    }

    const notification = await prisma.notification.create({
      data: {
        title,
        message,
        audience,
        priority: priorityToDb[priority] || "HIGH",
        createdById,
      },
    });

    await prisma.userNotification.createMany({
      data: recipientIds.map((userId) => ({
        userId,
        notificationId: notification.id,
      })),
      skipDuplicates: true,
    });

    return notification;
  } catch (error) {
    console.error("Dashboard notification creation failed:", error);
    return null;
  }
};

export const notifyRoleUsers = async ({
  roleName,
  title,
  message,
  priority = "HIGH",
  createdById = null,
}) => {
  try {
    const audience = roleToAudience[roleName];

    if (!audience) {
      return null;
    }

    const users = await prisma.user.findMany({
      where: {
        status: "ACTIVE",
        role: {
          name: roleName,
        },
      },
      select: {
        id: true,
      },
    });

    return createNotificationForRecipients({
      userIds: users.map((user) => user.id),
      title,
      message,
      audience,
      priority,
      createdById,
    });
  } catch (error) {
    console.error("Role notification lookup failed:", error);
    return null;
  }
};

export const notifySingleUser = async ({
  userId,
  title,
  message,
  priority = "HIGH",
  createdById = null,
}) => {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        role: true,
      },
    });

    if (!user || user.status !== "ACTIVE") {
      return null;
    }

    return createNotificationForRecipients({
      userIds: [user.id],
      title,
      message,
      audience: roleToAudience[user.role?.name] || "USER",
      priority,
      createdById,
    });
  } catch (error) {
    console.error("User notification lookup failed:", error);
    return null;
  }
};
